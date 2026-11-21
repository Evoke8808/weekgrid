import { describe, it, expect } from 'vitest';
import { handle, memoryDb, redisDb, blobDb, MAX_BYTES } from './_sync.js';

const ID = 'a'.repeat(32);
const req = (method, body, id = ID) => new Request(`http://x/api/sync?id=${id}`, {
  method, body: body === undefined ? undefined : JSON.stringify(body), headers: body ? { 'content-type': 'application/json' } : {}
});

describe('sync api', () => {
  it('stores, versions and refuses stale writes', async () => {
    const db = memoryDb();
    expect((await handle(req('GET'), db)).status).toBe(404);
    let r = await handle(req('PUT', { base: 0, d: 'QUJD' }), db);
    expect(await r.json()).toEqual({ v: 1 });
    r = await handle(req('PUT', { base: 0, d: 'WFla' }), db); // someone else wrote version 1 first
    expect(r.status).toBe(409);
    expect((await r.json()).v).toBe(1);
    r = await handle(req('PUT', { base: 1, d: 'WFla' }), db);
    expect(await r.json()).toEqual({ v: 2 });
    expect(await (await handle(req('GET'), db)).json()).toEqual({ v: 2, d: 'WFla' });
  });

  it('rejects bad ids, bodies and oversize data', async () => {
    const db = memoryDb();
    expect((await handle(req('GET', undefined, 'nope'), db)).status).toBe(400);
    expect((await handle(req('PUT', { base: 0, d: 'not base64!' }), db)).status).toBe(400);
    expect((await handle(req('PUT', { base: -1, d: 'QQ==' }), db)).status).toBe(400);
    expect((await handle(req('PUT', { base: 0, d: 'A'.repeat(MAX_BYTES + 4) }), db)).status).toBe(413);
    expect((await handle(req('DELETE'), db)).status).toBe(405);
  });

  it('says so when the server has no database', async () => {
    expect(redisDb({})).toBeNull();
    expect((await handle(req('GET'), null)).status).toBe(503);
  });

  it('Vercel Blob store: conditional writes, conflicts and storage errors', async () => {
    class BlobPreconditionFailedError extends Error {}
    class BlobNotFoundError extends Error {}
    const files = new Map(); let n = 0;
    const sdk = {
      BlobPreconditionFailedError, BlobNotFoundError,
      // like the real service: get() hands back a delivery-network ETag that put() does not accept
      async get(p) { const f = files.get(p); return f ? { statusCode: 200, stream: new Response(f.body).body, blob: { etag: `W/"${f.etag}-cdn"` } } : null; },
      async head(p) { const f = files.get(p); if (!f) throw new BlobNotFoundError(); return { etag: f.etag }; },
      async put(p, body, o) {
        const f = files.get(p);
        if (o.ifMatch && (!f || f.etag !== o.ifMatch)) throw new BlobPreconditionFailedError();
        if (!o.ifMatch && f && !o.allowOverwrite) throw new Error('This blob already exists');
        files.set(p, { body, etag: `e${++n}` });
      }
    };
    expect(blobDb({})).toBeNull();
    const db = blobDb({ BLOB_READ_WRITE_TOKEN: 'x' }, sdk);
    expect((await handle(req('GET'), db)).status).toBe(404);
    expect(await (await handle(req('PUT', { base: 0, d: 'QUJD' }), db)).json()).toEqual({ v: 1 });
    expect((await handle(req('PUT', { base: 0, d: 'QUJD' }), db)).status).toBe(409);
    expect(await (await handle(req('PUT', { base: 1, d: 'WFla' }), db)).json()).toEqual({ v: 2 });
    expect(await (await handle(req('GET'), db)).json()).toEqual({ v: 2, d: 'WFla' });
    expect([...files.keys()]).toEqual([`sync/${ID}.json`]);

    // someone writes between our read and our write → conflict, not an overwrite
    const realPut = sdk.put;
    sdk.put = async (p, b, o) => { files.set(p, { body: JSON.stringify({ v: 3, d: 'Wg==' }), etag: 'sneaky' }); return realPut(p, b, o); };
    expect((await handle(req('PUT', { base: 2, d: 'Wlo=' }), db)).status).toBe(409);
    sdk.put = async () => { throw new Error('store suspended'); };
    expect((await handle(req('PUT', { base: 3, d: 'Wlo=' }), db)).status).toBe(502);
  });
});

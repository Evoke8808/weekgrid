import { describe, it, expect } from 'vitest';
import { handle, memoryDb, redisDb, MAX_BYTES } from './_sync.js';

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
});

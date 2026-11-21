// Sync storage logic, shared by the Vercel function (api/sync.js) and the local dev server.
// The server only ever sees: a room id (a hash derived from the sync code) and an encrypted blob.
// It cannot read the data or recover the code.

export const MAX_BYTES = 1_000_000; // encrypted, gzipped blob; years of logs fit easily
const TTL = 60 * 60 * 24 * 400; // a room unused for 400 days is removed
const ID = /^[0-9a-f]{32}$/;
const B64 = /^[A-Za-z0-9+/=]+$/;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

// db: { get(id) -> { v, d } | null, cas(id, base, d) -> newVersion | -1 (someone wrote first) }
export async function handle(request, db) {
  if (!db) return json({ error: 'Sync storage is not set up on the server' }, 503);
  const url = new URL(request.url);
  const id = url.searchParams.get('id') || '';
  if (!ID.test(id)) return json({ error: 'Bad sync id' }, 400);

  if (request.method === 'GET') {
    const room = await db.get(id);
    return room ? json(room) : json({ v: 0 }, 404);
  }

  if (request.method === 'PUT') {
    const len = Number(request.headers.get('content-length') || 0);
    if (len > MAX_BYTES + 200) return json({ error: 'Too much data' }, 413);
    let body;
    try { body = await request.json(); } catch (e) { return json({ error: 'Bad body' }, 400); }
    const { base, d } = body || {};
    if (!Number.isInteger(base) || base < 0 || typeof d !== 'string' || !B64.test(d)) return json({ error: 'Bad body' }, 400);
    if (d.length > MAX_BYTES) return json({ error: 'Too much data' }, 413);
    const v = await db.cas(id, base, d);
    if (v < 0) return json({ error: 'Changed elsewhere', ...(await db.get(id)) }, 409);
    return json({ v });
  }

  return json({ error: 'Method not allowed' }, 405);
}

// In-memory store for local development and tests.
export function memoryDb() {
  const rooms = new Map();
  return {
    rooms,
    async get(id) { return rooms.get(id) || null; },
    async cas(id, base, d) {
      const cur = rooms.get(id)?.v || 0;
      if (cur !== base) return -1;
      rooms.set(id, { v: cur + 1, d });
      return cur + 1;
    }
  };
}

// Upstash Redis over its REST API (no package needed). The Vercel integration sets these variables.
const CAS = `
local v = tonumber(redis.call('GET', KEYS[1]) or '0')
if v ~= tonumber(ARGV[1]) then return -1 end
redis.call('SET', KEYS[2], ARGV[2], 'EX', ARGV[3])
redis.call('SET', KEYS[1], v + 1, 'EX', ARGV[3])
return v + 1`;

export function redisDb(env = process.env) {
  const url = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL;
  const token = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  const call = async (cmd) => {
    const r = await fetch(url, { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: JSON.stringify(cmd) });
    const out = await r.json();
    if (!r.ok || out.error) throw new Error(out.error || `Redis ${r.status}`);
    return out.result;
  };
  return {
    async get(id) {
      const [v, d] = await call(['MGET', `wg:${id}:v`, `wg:${id}:d`]);
      return v && d ? { v: Number(v), d } : null;
    },
    async cas(id, base, d) {
      return Number(await call(['EVAL', CAS, '2', `wg:${id}:v`, `wg:${id}:d`, String(base), d, String(TTL)]));
    }
  };
}

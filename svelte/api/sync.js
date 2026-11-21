// Vercel function: GET/PUT /api/sync?id=<room id>. See api/_sync.js.
import { handle, redisDb } from './_sync.js';

const db = redisDb();
export const GET = (request) => handle(request, db);
export const PUT = (request) => handle(request, db);

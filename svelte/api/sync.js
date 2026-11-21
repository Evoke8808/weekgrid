// Vercel function: GET/PUT /api/sync?id=<room id>. See api/_sync.js.
// Uses the project's Vercel Blob store, or Upstash Redis if that is connected instead.
import { handle, blobDb, redisDb } from './_sync.js';

const db = blobDb() || redisDb();
export const GET = (request) => handle(request, db);
export const PUT = (request) => handle(request, db);

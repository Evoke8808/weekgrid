// Sync code -> room id + encryption key, and sealing data so the server cannot read it.
// The code never leaves the device; the server only sees a hash of it and the sealed blob.

// No 0/O, 1/I/L: easy to read out and type on a phone
export const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const LEN = 12; // ≈ 59 bits

export function newCode() {
  const out = [];
  const buf = new Uint8Array(1);
  while (out.length < LEN) {
    crypto.getRandomValues(buf);
    if (buf[0] < 248) out.push(ALPHABET[buf[0] % 31]); // 248 = 8 × 31: no bias
  }
  return out.join('');
}

// "k7qm r2xd-…" → "K7QMR2XD…", or null if it cannot be a code
export function cleanCode(input) {
  const c = String(input || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return c.length === LEN && [...c].every((ch) => ALPHABET.includes(ch)) ? c : null;
}

export const showCode = (c) => c.match(/.{1,4}/g).join('-');

const enc = new TextEncoder();
const toB64 = (bytes) => { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s); };
const fromB64 = (s) => Uint8Array.from(atob(s), (ch) => ch.charCodeAt(0));

// Slow on purpose (150k rounds) so a stolen blob cannot be brute-forced cheaply.
export async function deriveKeys(code) {
  const base = await crypto.subtle.importKey('raw', enc.encode(code), 'PBKDF2', false, ['deriveBits']);
  const bits = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode('weekgrid-sync-v1'), iterations: 150000 }, base, 512));
  const key = await crypto.subtle.importKey('raw', bits.slice(0, 32), 'AES-GCM', false, ['encrypt', 'decrypt']);
  const id = [...bits.slice(32, 48)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return { id, key };
}

async function pipe(bytes, stream) {
  return new Uint8Array(await new Response(new Response(bytes).body.pipeThrough(stream)).arrayBuffer());
}

export async function seal(obj, key) {
  const zipped = await pipe(enc.encode(JSON.stringify(obj)), new CompressionStream('gzip'));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, zipped));
  const out = new Uint8Array(13 + ct.length);
  out[0] = 1; // format version
  out.set(iv, 1);
  out.set(ct, 13);
  return toB64(out);
}

export async function open(str, key) {
  const raw = fromB64(str);
  if (raw[0] !== 1) throw new Error('Unknown sync format');
  const zipped = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: raw.slice(1, 13) }, key, raw.slice(13)));
  return JSON.parse(new TextDecoder().decode(await pipe(zipped, new DecompressionStream('gzip'))));
}

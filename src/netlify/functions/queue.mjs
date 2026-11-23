// Darkon's shared queue for open services (11.41.0, task legal-server; decisions/2026-11-21-review-legal-review.md Q12, Q13 item 1).
// Nominatim's usage policy allows one request a second for the whole app, not per phone; Transitous asks for light use. So the phones ask
// this function, which forwards each request to the service at the provider's pace for ALL users together, from the site's server:
//   - each request's time slot, per provider, in the site's own storage (Netlify Blobs, store "queue", keys "slot-<provider>-<n>"), claimed
//     with a write that succeeds only for a new key (onlyIfNew), so two instances never take the same second;
//   - a shared answer cache (key "c-<provider>-<sha256 of the address>"): an address one user looked up is not sent again while it is kept;
//     the cache keeps the address asked and the service's answer only - never who asked (no network address, no device id);
//   - a proper User-Agent with the app's name and its contact address (a browser cannot set one; the service sees the server, not the phone);
//   - a daily count for all users where a provider has a daily limit (Transitous: stops before 720 /plan a day - keys "day-<provider>-<UTC date>-<i>").
// Generic: a provider joins by a row of ROWS (its base address, the paths it may be asked, its pace, how long answers are kept, a daily cap).
//   GET /api/queue?p=<provider>&u=<path and query, as the service takes it>
//     -> the service's answer as it came (status and body; X-Queue: 1 on every answer of this function, X-Queue-Cache: hit|miss, and on a
//        miss X-Queue-At: the moment of its slot in ms - legal-server-fixes, read by tests/deployed_check.mjs to see the slots' spacing)
//     -> 400 bad input · 403 not from the app's own pages (../lib/from-app.mjs) · 429 { error: 'day' } the day's cap for all users (Retry-After
//        to the next UTC day) · 503 { error: 'busy' } the queue is more than MAX_WAIT ahead (Retry-After) · 502 { error: 'upstream' } no answer
//        · 504 { error: 'timeout' } the service gave no answer within FETCH_MS (Retry-After; the phone waits, as for 503)
// legal-server-fixes (decisions/2026-11-21-review-legal-server.md Q3): the service's fetch has a time limit (FETCH_MS) - a slow answer never
// holds a phone past its own 15 s; MAX_WAIT + FETCH_MS (13 s) is well inside Netlify's synchronous run-time limit (60 s, not configurable -
// docs.netlify.com/build/functions/overview, "Default values", read 21.11.2026). Cache entries older than their row's `keep` are deleted (on
// a read, and by a sweep of a sixteenth of the cache now and then); every sweep and background write is kept alive past the answer with the
// platform's context.waitUntil; a daily count is taken only after the request got its turn, so a "busy" answer spends none of the day.
// The phone (services.js svcRun, a provider row's `queue`) asks here first; when this function does not answer (no X-Queue header, a
// network failure of the site, 5xx of its own), it asks the service directly - background requests one per 3 s per phone.
// Public like the other functions: the origin check and Netlify's rate limit per caller (config below) before anything else.
import { fromApp, refused } from '../lib/from-app.mjs';
import { createHash } from 'node:crypto';
export const config = { path: '/api/queue', rateLimit: { windowLimit: 60, windowSize: 60, aggregateBy: ['ip', 'domain'] } };
export const UA = 'Darkon trip app (https://darkon-eran.netlify.app; appshelf.home@gmail.com)';
const DAY = 864e5;
export const ROWS = {
  nominatim: { base: 'https://nominatim.openstreetmap.org/', path: /^(search|reverse)$/, gap: 1050, keep: 30 * DAY },
  transitous: { base: 'https://api.transitous.org/', path: /^api\/v5\/plan$/, gap: 1050, keep: 0, day: 700 }, // 720 /plan a day: stop at 700
};
export const HOSTS = Object.values(ROWS).map(r => new URL(r.base).hostname); // the outside hosts it reaches - read by the terms page's host guard (t1135)
const MAX_WAIT = 6000; // a request waits at most this long for its turn; more - "busy" (the phone waits and asks again)
const FETCH_MS = 7000; // the service's answer within this, or 504 "timeout" (legal-server-fixes, Q3)
const PASS = ['accept-language']; // the only headers passed on from the phone
const json = (code, body, h) => new Response(JSON.stringify(body), { status: code, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Queue': '1', ...(h || {}) } });
async function store() { if (globalThis.__queueStore) return globalThis.__queueStore; // the tests' own store (else Netlify Blobs)
  const { getStore } = await import('@netlify/blobs'); return getStore({ name: 'queue', consistency: 'strong' }); }
const sleep = ms => new Promise(r => setTimeout(r, ms));
// this request's turn: the first free time slot from now on (slot n = the moment n * gap), claimed by a write that succeeds only for a key
// that does not exist yet (onlyIfNew) - so two instances never take the same slot, whatever the store's read consistency. "next-<p>" is only
// a hint where to start (written without a condition); old slots are swept now and then. -1 when the next free slot is too far ahead.
async function turn(st, prov, gap, bg) {
  let n = Math.ceil(Date.now() / gap); const hint = Number(await st.get('next-' + prov).catch(() => 0)) || 0; if (hint > n) n = hint;
  for (let i = 0; i < 40; i++, n++) {
    if (n * gap - Date.now() > MAX_WAIT) return -1;
    const w = await st.setJSON('slot-' + prov + '-' + n, { at: Date.now() }, { onlyIfNew: true });
    if (w && w.modified) { bg(st.set('next-' + prov, String(n + 1)).catch(() => {})); if (Math.random() < 0.02) bg(sweep(st, 'slot-' + prov + '-', async k => +k < n - 100)); return n * gap; }
  }
  return -1;
}
// one more request today for a provider with a daily cap: the day's count is the number of keys "day-<p>-<UTC date>-<i>" claimed (onlyIfNew),
// so the cap is exact across instances; false at the cap (or when no index is free near the hint)
async function countDay(st, prov, cap, bg) {
  const date = new Date().toISOString().slice(0, 10), pre = 'day-' + prov + '-' + date + '-';
  let k = Number(await st.get('dayhint-' + prov + '-' + date).catch(() => 0)) || 0;
  for (let i = 0; i < 60 && k < cap; i++, k++) {
    const w = await st.setJSON(pre + k, { at: Date.now() }, { onlyIfNew: true });
    if (w && w.modified) { bg(st.set('dayhint-' + prov + '-' + date, String(k + 1)).catch(() => {})); if (k === 0) bg(sweep(st, 'day-' + prov + '-', async key => key.slice(0, 10) < date)); return true; }
  }
  return false;
}
// deletes the keys under a prefix whose rest passes `old` (async); returns its promise, which the caller hands to bg (context.waitUntil) -
// a failure leaves them for the next sweep
function sweep(st, prefix, old) { return (async () => { const { blobs } = await st.list({ prefix }); for (const b of blobs) if (await old(b.key.slice(prefix.length))) await st.delete(b.key); })().catch(() => {}); }
// a cache entry's age: its metadata `at` (written with it), else - an entry written before legal-server-fixes - its own body's `at`
async function cacheOld(st, key, keep) { const m = await st.getMetadata(key).catch(() => null); let at = m && m.metadata && +m.metadata.at;
  if (!at) { const c = await st.get(key, { type: 'json' }).catch(() => null); at = c && +c.at; } return !at || Date.now() - at >= keep; }
// deletes a provider's expired cache entries whose hash starts with `hex` (one of 16 parts, so one sweep stays short)
export function sweepCache(st, prov, keep, hex) { const pre = 'c-' + prov + '-' + hex; return sweep(st, pre, k => cacheOld(st, pre + k, keep)); }
const toTomorrow = () => { const d = new Date(); d.setUTCHours(24, 0, 0, 0); return Math.max(60, Math.ceil((d - Date.now()) / 1000)); };
export default async (req, context) => {
  if (!fromApp(req)) return refused();
  const bg = p => { try { if (context && typeof context.waitUntil === 'function') context.waitUntil(p); } catch (e) {} return p; }; // kept alive past the answer
  const q = new URL(req.url).searchParams, prov = q.get('p'), R = ROWS[prov], u = String(q.get('u') || '');
  if (!R) return json(400, { error: 'provider' });
  const path = u.split('?')[0];
  if (!R.path.test(path) || u.length > 2000 || /[\s#]|\/\/|\.\./.test(u)) return json(400, { error: 'input' });
  const url = R.base + u;
  let st; try { st = await store(); } catch (e) { return json(502, { error: 'store' }); }
  const hdr = { 'User-Agent': UA }; PASS.forEach(h => { const v = req.headers.get(h); if (v) hdr[h] = v.slice(0, 100); });
  const ck = 'c-' + prov + '-' + createHash('sha256').update(url + '|' + (hdr['accept-language'] || '')).digest('hex');
  if (R.keep) { try { const c = await st.get(ck, { type: 'json' }); if (c && Date.now() - c.at < R.keep) return new Response(c.body, { status: c.status, headers: { 'Content-Type': c.type || 'application/json', 'Cache-Control': 'no-store', 'X-Queue': '1', 'X-Queue-Cache': 'hit' } });
    if (c) bg(st.delete(ck).catch(() => {})); } catch (e) {} } // an expired entry goes (legal-server-fixes)
  const t = await turn(st, prov, R.gap, bg);
  if (t < 0) return json(503, { error: 'busy' }, { 'Retry-After': '3' });
  if (R.day && !(await countDay(st, prov, R.day, bg))) return json(429, { error: 'day' }, { 'Retry-After': String(toTomorrow()) }); // after the turn: "busy" spends none of the day
  const wait = t - Date.now(); if (wait > 0) await sleep(wait);
  const at = { 'X-Queue-At': String(t) };
  let r, body; try { r = await fetch(url, { headers: hdr, signal: AbortSignal.timeout(FETCH_MS) }); body = await r.text(); }
  catch (e) { return e && (e.name === 'TimeoutError' || e.name === 'AbortError') ? json(504, { error: 'timeout' }, { 'Retry-After': '3', ...at }) : json(502, { error: 'upstream' }, at); }
  const type = r.headers.get('content-type') || 'application/json';
  if (R.keep && r.status === 200) { const now = Date.now(); try { await st.setJSON(ck, { at: now, status: 200, type, body }, { metadata: { at: now } }); } catch (e) {} // only a real answer is kept
    if (Math.random() < 0.01) bg(sweepCache(st, prov, R.keep, '0123456789abcdef'[Math.floor(Math.random() * 16)])); } // a sixteenth of the cache, now and then
  return new Response(body, { status: r.status, headers: { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Queue': '1', 'X-Queue-Cache': 'miss', ...at, ...(r.headers.get('retry-after') ? { 'Retry-After': r.headers.get('retry-after') } : {}) } });
};

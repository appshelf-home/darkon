// Darkon's server function for Google place ids (11.23.0, task place-gid-2; decisions/2026-11-16-google-place-id.md Q3-Q5, Q11).
// The app asks it, in the background, for the Google id of a place it knows by name and point; Google is asked only inside a small box
// around that point (below) and no Google location is read, returned, stored or shown - only the id leaves (Google's terms allow keeping ids).
// The key lives only in the site's environment variable GOOGLE_PLACES_KEY (Netlify, a secret), restricted in Google to the Places API.
//   GET /api/place-id?op=find&q=<name, city>&lat=<lat>&lng=<lng>
//     legal-server (11.41.0; decisions 2026-11-21 · Review of the legal-review report, Q10 - S15): Text Search (New) with the field mask
//     places.id only (Essentials IDs Only, free), restricted (locationRestriction) to a rectangle of about 150 m each way around our point -
//     Google filters by place, and its first result's id is the match. No Place Details call, and no Google coordinate is read at all
//     (until 11.40.0: a 500 m bias, then Place Details' location checked within 150 m - Google's location read to accept a match).
//     -> 200 { r: 'found', id } | { r: 'none' } | { r: 'later', until: 'day' }
//   GET /api/place-id?op=check&id=<id>
//     Place Details (New) with the field mask id only (Essentials IDs Only, free): Google's recommended refresh of a kept id.
//     -> 200 { r: 'same' } | { r: 'new', id } | { r: 'obsolete' } | { r: 'later', until: 'day' | 'month' }
//   400 bad input · 403 not from the app's own pages (../lib/from-app.mjs) · 429 this caller asks too often · 502 Google answered otherwise · 503 Google's per-minute cap (the app waits and asks again)
// Three stops on the details requests (since legal-server only op=check asks Place Details), so the free allowance is never passed: (1) this function's monthly counter (Netlify Blobs, store
// "place-id", key details-YYYY-MM by UTC month) answers "later" from the 9,000th request of a calendar month; (2) Google's own per-day
// caps (the owner set Place Details 300 a day, Text Search 1,000 a day, 30 a minute each) - a refusal over a day's cap, and any quota refusal
// not told as per-minute, is answered { r: 'later', until: 'day' }; (3) the budget alert in Google's billing. The counter's "later" says
// until: 'month'. The app pauses its pass until the next day (the phone's date) or the next calendar month (gid-fixes item 4;
// decisions 2026-11-18 · Review of the 11.23.0 summary, Q1); an older answer without `until` is read as 'month'.
// The counter is read and written per request (not atomic across instances: two at the same moment may count once - a few over 9,000
// at most, still under Google's 10,000; the day cap stops the rest).
// 11.38.2 (privacy-server): the address /api/place-id (Netlify's rate limit needs the function's own path; the default
// /.netlify/functions/place-id is then closed), Netlify's rate limit at its edge across instances (config below: 40 a minute per
// caller - the app asks about one in 2 s), and the origin check before anything else. The function is public: an abuser who forges
// the headers can still spend the day's and month's caps (cheaply bounded by the rate limit per address) - never money.
import { fromApp, refused } from '../lib/from-app.mjs';
export const config = { path: '/api/place-id', rateLimit: { windowLimit: 40, windowSize: 60, aggregateBy: ['ip', 'domain'] } };
const GOOGLE = 'https://places.googleapis.com/v1/';
export const HOSTS = ['places.googleapis.com']; // legal-server (11.41.0): the outside hosts it reaches - read by the terms page's host guard (t1135)
const NEAR_M = 150, MONTH_CAP = 9000; // NEAR_M: the rectangle's half side (legal-server: about the old 150 m acceptance)
const WINDOW = 60 * 1000, LIMIT = 60, SEEN = new Map(); // a caller (per warm instance): 60 a minute - the app asks about one in 2 s
const ID = /^[A-Za-z0-9_-]{16,300}$/;
const json = (code, body) => new Response(JSON.stringify(body), { status: code, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
const LATER = { r: 'later', until: 'month' }, LATER_DAY = { r: 'later', until: 'day' };
// the rectangle around a point, about NEAR_M each way (Text Search (New) locationRestriction takes only a rectangle)
function box(lat, lng) { const dLa = NEAR_M / 111320, dLo = NEAR_M / (111320 * Math.max(0.01, Math.cos(lat * Math.PI / 180)));
  return { rectangle: { low: { latitude: Math.max(-90, lat - dLa), longitude: Math.max(-180, lng - dLo) }, high: { latitude: Math.min(90, lat + dLa), longitude: Math.min(180, lng + dLo) } } }; }
async function store() { if (globalThis.__placeIdStore) return globalThis.__placeIdStore; // the tests' own store
  const { getStore } = await import('@netlify/blobs'); return getStore({ name: 'place-id', consistency: 'strong' }); }
// one more details request this month, or false when the month's cap is reached (or the counter cannot be read: no request then)
async function countDetails() {
  const key = 'details-' + new Date().toISOString().slice(0, 7);
  try { const s = await store(), n = Number(await s.get(key)) || 0; if (n >= MONTH_CAP) return false; await s.set(key, String(n + 1)); return true; }
  catch (e) { return false; }
}
// Google's answer -> 'ok' | 'later' (a day's cap, or a quota refusal not told as per-minute) | 'minute' (the per-minute cap) | 'gone' (404) | 'error'
async function google(path, mask, key, body) {
  let r; try {
    r = await fetch(GOOGLE + path, { method: body ? 'POST' : 'GET', headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': mask, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  } catch (e) { return { k: 'error' }; }
  if (r.ok) { try { return { k: 'ok', d: await r.json() }; } catch (e) { return { k: 'error' }; } }
  let msg = ''; try { msg = JSON.stringify(await r.json()); } catch (e) {}
  if (r.status === 429 || /RESOURCE_EXHAUSTED/.test(msg)) return { k: /per minute/i.test(msg) ? 'minute' : 'later' };
  if (r.status === 404) return { k: 'gone' };
  return { k: 'error' };
}
const fail = g => g.k === 'later' ? json(200, LATER_DAY) : g.k === 'minute' ? json(503, { error: 'busy' }) : json(502, { error: 'google' });
export default async (req, context) => {
  if (!fromApp(req)) return refused();
  const who = (context && context.ip) || req.headers.get('x-nf-client-connection-ip') || 'unknown', now = Date.now();
  const mine = (SEEN.get(who) || []).filter(t => now - t < WINDOW); if (mine.length >= LIMIT) return json(429, { error: 'rate' });
  mine.push(now); SEEN.set(who, mine); if (SEEN.size > 5000) SEEN.clear();
  const key = (globalThis.Netlify && Netlify.env && Netlify.env.get('GOOGLE_PLACES_KEY')) || process.env.GOOGLE_PLACES_KEY;
  if (!key) return json(500, { error: 'no key' });
  const p = new URL(req.url).searchParams, op = p.get('op');
  if (op === 'find') {
    const q = String(p.get('q') || '').trim(), lat = Number(p.get('lat')), lng = Number(p.get('lng'));
    if (!q || q.length > 200 || !(Math.abs(lat) <= 90) || !(Math.abs(lng) <= 180) || p.get('lat') === null || p.get('lng') === null) return json(400, { error: 'input' });
    const s = await google('places:searchText', 'places.id', key, { textQuery: q, pageSize: 1, locationRestriction: box(lat, lng) });
    if (s.k !== 'ok') return fail(s);
    const id = s.d && Array.isArray(s.d.places) && s.d.places[0] && s.d.places[0].id;
    return json(200, id && ID.test(id) ? { r: 'found', id } : { r: 'none' }); // only the id is read (legal-server, Q10)
  }
  if (op === 'check') {
    const id = String(p.get('id') || ''); if (!ID.test(id)) return json(400, { error: 'input' });
    if (!(await countDetails())) return json(200, LATER);
    const d = await google('places/' + encodeURIComponent(id), 'id', key);
    if (d.k === 'gone') return json(200, { r: 'obsolete' });
    if (d.k !== 'ok') return fail(d);
    const nid = d.d && d.d.id; if (!nid || !ID.test(nid)) return json(502, { error: 'google' });
    return json(200, nid === id ? { r: 'same' } : { r: 'new', id: nid });
  }
  return json(400, { error: 'op' });
};

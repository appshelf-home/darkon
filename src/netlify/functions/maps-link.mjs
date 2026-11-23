// Darkon's server function (11.20.0, task place-search-upgrade; decisions/2026-11-15-place-search.md "Q2 again" (2), Q9 (5)).
// Follows a Google Maps short link (maps.app.goo.gl, goo.gl/maps; since 11.21.6 Google Search's share.google) and returns only the final address, so the app can read the
// place's name and point from it - a phone cannot follow such a link itself (the browser hides the redirect). No key, no storage;
// only Google Maps' link hosts, at most 6 redirects, and a rate limit per caller (20 in 10 minutes, per warm instance).
// GET /api/maps-link?u=<short link>  ->  200 { "url": "<final address>" } | 400 | 403 (not from the app's own pages) | 429 | 502
// 11.38.2 (privacy-server): the address /api/maps-link (Netlify's rate limit needs the function's own path), Netlify's rate limit at
// its edge across instances (10 a minute per caller; the code's limit stays as a second layer) and the origin check first.
import { fromApp, refused } from '../lib/from-app.mjs';
export const config = { path: '/api/maps-link', rateLimit: { windowLimit: 10, windowSize: 60, aggregateBy: ['ip', 'domain'] } };
export const HOSTS = ['maps.app.goo.gl', 'goo.gl', 'share.google', 'consent.google.com', 'www.google.com', 'maps.google.com']; // legal-server (11.41.0): the outside hosts it reaches (and google.<country> on Google's redirects) - read by the terms page's host guard (t1135)
const START = /^https:\/\/(maps\.app\.goo\.gl\/[\w-]+|goo\.gl\/maps\/[\w-]+|share\.google\/[\w-]+)\/?(\?.*)?$/; // 11.21.6 (P2): Google Search's share link too
const NEXT = /^(maps\.app\.goo\.gl|goo\.gl|share\.google|(www\.|maps\.)?google\.[a-z.]{2,8}|consent\.google\.com)$/;
const WINDOW = 10 * 60 * 1000, LIMIT = 20, SEEN = new Map();
const json = (code, body) => new Response(JSON.stringify(body), { status: code, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
export default async (req, context) => {
  if (!fromApp(req)) return refused();
  const who = (context && context.ip) || req.headers.get('x-nf-client-connection-ip') || 'unknown', now = Date.now();
  const mine = (SEEN.get(who) || []).filter(t => now - t < WINDOW); if (mine.length >= LIMIT) return json(429, { error: 'rate' });
  mine.push(now); SEEN.set(who, mine); if (SEEN.size > 5000) SEEN.clear();
  let cur = new URL(req.url).searchParams.get('u') || '';
  if (!START.test(cur)) return json(400, { error: 'not a Google Maps short link' });
  try {
    for (let i = 0; i < 6; i++) {
      const r = await fetch(cur, { redirect: 'manual', headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 14) Darkon link reader' } });
      const loc = r.headers.get('location'); if (!loc || r.status < 300 || r.status >= 400) break;
      const next = new URL(loc, cur); if (next.protocol !== 'https:' || !NEXT.test(next.hostname)) return json(502, { error: 'unexpected host' });
      if (next.hostname === 'consent.google.com' && next.searchParams.get('continue')) { const c = new URL(next.searchParams.get('continue')); if (NEXT.test(c.hostname)) { cur = c.href; break; } }
      cur = next.href;
    }
  } catch (e) { return json(502, { error: 'fetch' }); }
  return json(200, { url: cur });
};

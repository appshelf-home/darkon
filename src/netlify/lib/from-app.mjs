// The server functions' one origin check (11.38.2, task privacy-server; decisions/2026-11-20-review-quality-review.md Q3).
// A call is taken only from the app's own pages: the site, the test address, or the address the function itself was called on
// (the same deploy - a branch deploy or a preview answers its own pages only). Another website's script is refused; so is a bare
// request with nothing that names its page (curl as it comes). A browser's same-origin GET sends no Origin, so the order is:
//   Origin (when sent) must be one of ours; else Sec-Fetch-Site (modern browsers) must be same-origin; else the Referer's origin
//   (older browsers; the app sets no blocking Referrer-Policy - t810) must be one of ours; nothing of the three -> refused.
// This is a filter against other websites and casual use, not authentication: a request can forge its headers. The hard stops are
// the platform's rate limit (each function's config.rateLimit) and, for place-id, its counters.
export const APP_ORIGINS = ['https://darkon-eran.netlify.app', 'https://darkon-test--darkon-eran.netlify.app'];
const originOf = u => { try { return new URL(u).origin; } catch (e) { return ''; } };
export function fromApp(req) {
  const h = req.headers, own = originOf(req.url), ours = o => !!o && o !== 'null' && (o === own || APP_ORIGINS.includes(o));
  const origin = h.get('origin'); if (origin) return ours(origin);
  const site = h.get('sec-fetch-site'); if (site) return site === 'same-origin';
  const ref = h.get('referer'); if (ref) return ours(originOf(ref));
  return false;
}
// the refusal both functions answer
export const refused = () => new Response(JSON.stringify({ error: 'origin' }), { status: 403, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });

// מחתימים דרכון · service worker · 4.3.3 · 7.1.0: TILE_HOSTS is written by build.py from the registry (the screen tiles' providers)
// Shell: the page opens from the saved copy (cache-first) and the copy is refreshed in the background - 11.29.0 (task launch-fast; decisions
// 2026-11-19 · The launch screen, Q4): an opening never waits for the network; the first opening (nothing saved) goes to the network. Libraries and fonts: cache-first.
// Map tiles: cache-first, capped. Shared files (share_target POST) go to the share cache, then the app opens with ?shared=files.
// A new version installs in the background and waits; the page asks it for its version ('version' on a MessageChannel port): the same
// as the open page - the page sends 'skip' quietly; an older page - the app's "🆕 יש גרסה חדשה" bar, whose "רענון" sends 'skip' - 11.29.1
// (task sw-bar-quiet; decisions 2026-11-19 · The "יש גרסה חדשה" bar only when the open page is really old). A failed precache fails the
// install (the current worker stays; the browser tries again later), and the old shell is deleted only when the new one holds the page.
const VERSION = '11.47.0';
const SHELL = 'darkon-shell-' + VERSION, LIBS = 'darkon-libs', TILES = 'darkon-tiles', SHARE = 'darkon-share';
const TILE_MAX = 2500; // 4.16.0: also satellite and topographic tiles
const TILE_HOSTS = ['tile.openstreetmap.org', 'server.arcgisonline.com', 'ibasemaps-api.arcgis.com', 'static-map-tiles-api.arcgis.com', 'tile.openmaps.fr'];
const FONT_FILES = ['./fonts/rubik-hebrew.woff2', './fonts/rubik-latin.woff2', './fonts/frank-ruhl-libre-hebrew.woff2', './fonts/frank-ruhl-libre-latin.woff2']; // legal-server (11.41.0): the two text fonts, offline too; legal-server-fixes (Q4): their hebrew and latin files only (tests/textfonts.py SHELL, SHELL_SCRIPTS) - latin-ext loads when a text needs it (unicode-range) and is kept then, like a heading font (same origin, below)
const SHELL_FILES = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './terms.html', './licenses.txt', ...FONT_FILES]; // 11.39.0 (legal-page): the terms page and the licences, offline too
const PAGES = { '/terms': './terms.html', '/terms.html': './terms.html' }; // 11.39.0: pages of the site outside the app - a navigation to one gets that page, not the app
const LIB_HOSTS = ['cdnjs.cloudflare.com', 'cdn.jsdelivr.net']; // legal-server (11.41.0): the fonts come from the site (FONT_FILES), not from Google Fonts

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(SHELL_FILES))); // 11.29.1: a failure fails the install - never a worker with no saved page
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys(), mine = await (await caches.open(SHELL)).match('./index.html');
    if (mine) await Promise.all(keys.filter(k => k.startsWith('darkon-shell-') && k !== SHELL).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener('message', e => {
  if (e.data === 'skip') self.skipWaiting();
  else if (e.data === 'version' && e.ports && e.ports[0]) e.ports[0].postMessage(VERSION); // 11.29.1: the page compares it with its own
});

async function trimTiles() {
  const c = await caches.open(TILES); const keys = await c.keys();
  if (keys.length > TILE_MAX) await Promise.all(keys.slice(0, keys.length - TILE_MAX).map(k => c.delete(k)));
}
async function handleShare(req) {
  const scope = self.registration.scope;
  try {
    const form = await req.formData(); const c = await caches.open(SHARE); let n = 0;
    for (const f of form.getAll('files')) {
      if (!f || typeof f === 'string') continue;
      await c.put(new Request(scope + '__shared/' + Date.now() + '-' + n), new Response(await f.text(), { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Name': encodeURIComponent(f.name || '') } })); n++;
    }
    const title = form.get('title') || '', text = form.get('text') || '', url = form.get('url') || '';
    if (!n && /^\s*\{/.test(text) && text.includes('budapest-trip')) { // an app file shared as text
      await c.put(new Request(scope + '__shared/' + Date.now() + '-t'), new Response(text, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Name': encodeURIComponent(title || 'shared.json') } })); n++;
    }
    if (n) return Response.redirect(scope + '?shared=files', 303);
    const q = new URLSearchParams(); if (title) q.set('title', title); if (text) q.set('text', text); if (url) q.set('url', url);
    return Response.redirect(scope + (q.toString() ? '?' + q.toString() : ''), 303);
  } catch (err) { return Response.redirect(scope + '?shared=error', 303); }
}
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method === 'POST' && url.origin === location.origin && url.pathname.endsWith('/share-target')) { e.respondWith(handleShare(req)); return; }
  if (req.method !== 'GET') return;
  const page = req.mode === 'navigate' && url.origin === location.origin && PAGES[url.pathname.replace(/^.*(\/terms(\.html)?)$/, '$1')];
  if (page) { // 11.39.0 (legal-page): the saved copy first, refreshed in the background; the network when nothing is saved
    e.respondWith((async () => {
      const c = await caches.open(SHELL); let hit = await c.match(page);
      if (hit && hit.redirected) hit = new Response(await hit.blob(), { status: 200, headers: hit.headers }); // as the app's page: a navigation may not be answered by a redirected response
      const net = fetch(req).then(async r => { if (r && r.ok && r.type === 'basic' && !r.redirected) await c.put(page, r.clone()); return r; });
      if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
      try { return await net; } catch (err) { return Response.error(); }
    })());
    return;
  }
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      const c = await caches.open(SHELL); let hit = (await c.match('./index.html')) || (await c.match('./'));
      if (hit && hit.redirected) hit = new Response(await hit.blob(), { status: 200, headers: hit.headers }); // a navigation may not be answered by a redirected response
      const net = fetch(req).then(async r => { if (r && r.ok && r.type === 'basic') await c.put('./index.html', r.clone()); return r; });
      if (hit) { e.waitUntil(net.catch(() => {})); return hit; } // the saved copy now; a new version reaches the page through the update bar or at the next opening
      try { return await net; } catch (err) { return (await caches.match('./index.html')) || Response.error(); }
    })());
    return;
  }
  if (TILE_HOSTS.some(h => url.hostname === h || url.hostname.endsWith('.' + h))) {
    e.respondWith((async () => {
      const c = await caches.open(TILES); const hit = await c.match(req); if (hit && !(req.mode === 'cors' && hit.type === 'opaque')) return hit; // 4.36.1: a picture drawn from tiles needs a CORS copy, not the opaque one the map saved
      try { const r = await fetch(req); if (r && (r.ok || r.type === 'opaque')) { c.put(req, r.clone()); if (Math.random() < 0.05) trimTiles(); } return r; }
      catch (err) { return Response.error(); }
    })());
    return;
  }
  if (url.hostname === 'upload.wikimedia.org') { // 4.25.0: 📚 images the app kept (only discoveries that were opened)
    e.respondWith((async () => { const hit = await caches.match(req, { cacheName: 'darkon-disc-img' }); if (hit) return hit; try { return await fetch(req); } catch (err) { return Response.error(); } })());
    return;
  }
  if (LIB_HOSTS.includes(url.hostname)) {
    e.respondWith((async () => {
      const c = await caches.open(LIBS); const hit = await c.match(req); if (hit) return hit;
      const r = await fetch(req); if (r && (r.ok || r.type === 'opaque')) c.put(req, r.clone()); return r;
    })());
    return;
  }
  if (url.origin === location.origin && url.pathname.includes('/fonts/')) { // legal-server (11.41.0): a font file - kept once fetched (a heading font a trip shows)
    e.respondWith((async () => { const hit = await caches.match(req); if (hit) return hit; const r = await fetch(req); if (r && r.ok) (await caches.open(LIBS)).put(req, r.clone()); return r; })());
    return;
  }
  if (url.origin === location.origin) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req)));
  }
  // weather, currency and geocoding APIs: network only (the app keeps its own caches)
});

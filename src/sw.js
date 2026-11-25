// מחתימים דרכון · service worker · 4.3.3 · 7.1.0: TILE_HOSTS is written by build.py from the registry (the screen tiles' providers)
// Shell: the page opens from the saved copy (cache-first) and the copy is refreshed in the background - 11.29.0 (task launch-fast; decisions
// 2026-11-19 · The launch screen, Q4): an opening never waits for the network; the first opening (nothing saved) goes to the network. Libraries and fonts: cache-first.
// Map tiles: cache-first, capped by size - storage (decisions 2026-11-23 · Storage on the phone, Q2-Q3): kept only at a known size (fetched with CORS,
// never an opaque response, which Chrome counts as several MB), 200 MB at most, the least recently used going first past it. Shared files (share_target POST) go to the share cache, then the app opens with ?shared=files.
// A new version installs in the background and waits; the page asks it for its version ('version' on a MessageChannel port): the same
// as the open page - the page sends 'skip' quietly; an older page - the app's "🆕 יש גרסה חדשה" bar, whose "רענון" sends 'skip' - 11.29.1
// (task sw-bar-quiet; decisions 2026-11-19 · The "יש גרסה חדשה" bar only when the open page is really old). A failed precache fails the
// install (the current worker stays; the browser tries again later), and the old shell is deleted only when the new one holds the page.
const VERSION = '11.47.1'; // written by build.py from APP_VERSION (arch-guard item 4) - this value is only read in the source
const APP_ID = 'budapest-trip'; // written by build.py from the app's file prefix (BACKUP_APP): an app file shared as text is recognised by it
const SHELL = 'darkon-shell-' + VERSION, LIBS = 'darkon-libs', TILES = 'darkon-tiles', SHARE = 'darkon-share';
const TILE_CAP = 200 * 1048576; // storage (Q3): the tiles kept on the way, by size (replaces the count cap of 2,500 tiles); offline maps (IndexedDB) are not counted
const TILE_INDEX = '__tiles-index'; // storage (Q2): the size and last use of every kept tile, one small entry in the tile cache (data-stores.js reads it for the settings section)
const TILE_HOSTS = ['tile.openstreetmap.org', 'server.arcgisonline.com', 'ibasemaps-api.arcgis.com', 'static-map-tiles-api.arcgis.com', 'tile.openmaps.fr'];
const FONT_FILES = ['./fonts/rubik-hebrew.woff2', './fonts/rubik-latin.woff2', './fonts/frank-ruhl-libre-hebrew.woff2', './fonts/frank-ruhl-libre-latin.woff2']; // legal-server (11.41.0): the two text fonts, offline too; legal-server-fixes (Q4): their hebrew and latin files only (tests/textfonts.py SHELL, SHELL_SCRIPTS) - latin-ext loads when a text needs it (unicode-range) and is kept then, like a heading font (same origin, below)
const SHELL_FILES = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './terms.html', './licenses.txt', './countries-110m.json', ...FONT_FILES]; // 11.39.0 (legal-page): the terms page and the licences, offline too; countries-visited: the world's borders
const PAGES = { '/terms': './terms.html', '/terms.html': './terms.html', '/licenses.txt': './licenses.txt' }; // 11.39.0: pages of the site outside the app - a navigation to one gets that page, not the app (task terms-inside: licenses.txt too - opened inside the app it is a navigation of its frame)
const LIB_HOSTS = ['cdnjs.cloudflare.com']; // legal-credits-2 (S9): no jsDelivr - the route pictures' borders are a file of the site (LIB_FILES) // legal-server (11.41.0): the fonts come from the site (FONT_FILES), not from Google Fonts
const LIB_KEEP = []; // written by build.py: the page's library addresses (LIB_HOSTS), the site's font files and the 3D map's engine (maplibre/) - the library cache keeps only these at activate (arch-guard item 4: an old Leaflet does not stay forever); empty - nothing pruned

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(SHELL_FILES))); // 11.29.1: a failure fails the install - never a worker with no saved page
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys(), mine = await (await caches.open(SHELL)).match('./index.html');
    if (mine) await Promise.all(keys.filter(k => k.startsWith('darkon-shell-') && k !== SHELL).map(k => caches.delete(k)));
    if (LIB_KEEP.length && keys.includes(LIBS)) try { // the library cache: what this version's page no longer asks for goes
      const keep = new Set(LIB_KEEP.map(u => new URL(u, self.registration.scope).href)), c = await caches.open(LIBS);
      await Promise.all((await c.keys()).filter(r => !keep.has(r.url.split(/[?#]/)[0])).map(r => c.delete(r)));
    } catch (err) {} // a failed prune never stops the activation
    await self.clients.claim();
  })());
});
self.addEventListener('message', e => {
  if (e.data === 'skip') self.skipWaiting();
  else if (e.data === 'version' && e.ports && e.ports[0]) e.ports[0].postMessage(VERSION); // 11.29.1: the page compares it with its own
  else if (e.data === 'tiles-cleared') TIDX = null; // storage (Q5): the page cleared the tile cache - the index is read anew (empty)
});

// storage (Q2, Q3): the tile index - url -> [bytes, last use in seconds]; read once from the cache, written back a moment after a change
let TIDX = null, TIDX_SAVE = null; const NO_CORS = new Set(); // a host that answered without CORS: served from the network, never kept
const tidxKey = () => self.registration.scope + TILE_INDEX, nowS = () => Math.round(Date.now() / 1000);
async function tilesIndex() {
  if (TIDX) return TIDX;
  try { const r = await (await caches.open(TILES)).match(tidxKey()); TIDX = new Map(r ? Object.entries(await r.json()) : []); } catch (err) { TIDX = new Map(); }
  return TIDX;
}
function tilesIndexSave() { // one write for the changes of the next two seconds
  if (!TIDX_SAVE) TIDX_SAVE = new Promise(r => setTimeout(r, 2000)).then(async () => { TIDX_SAVE = null; if (!TIDX) return;
    try { await (await caches.open(TILES)).put(tidxKey(), new Response(JSON.stringify(Object.fromEntries(TIDX)), { headers: { 'Content-Type': 'application/json' } })); } catch (err) {} });
  return TIDX_SAVE;
}
async function trimTiles(idx, c) { // past the cap the least recently used go, down to 90% of it
  let total = 0; idx.forEach(v => { total += v[0]; }); if (total <= TILE_CAP) return;
  const old = [...idx.entries()].sort((a, b) => a[1][1] - b[1][1]), gone = [];
  for (const [u, v] of old) { if (total <= TILE_CAP * 0.9) break; total -= v[0]; idx.delete(u); gone.push(u); }
  await Promise.all(gone.map(u => c.delete(u).catch(() => false)));
}
async function tileFetch(req, host) { // CORS first, so the response's size is known; a host with no CORS gets the page's own request (opaque, not kept)
  if (!NO_CORS.has(host)) try { return await fetch(req.url, { mode: 'cors', credentials: 'omit' }); }
  catch (err) { const r = await fetch(req); if (r && r.type === 'opaque') NO_CORS.add(host); return r; } // no network throws again here (nothing marked)
  return fetch(req);
}
async function tileServe(e, req, host) {
  const c = await caches.open(TILES), idx = await tilesIndex(), hit = await c.match(req.url);
  if (hit) { const v = idx.get(req.url); if (v) { if (nowS() - v[1] > 60) { v[1] = nowS(); e.waitUntil(tilesIndexSave()); } } else { e.waitUntil(hit.clone().blob().then(b => { idx.set(req.url, [b.size, nowS()]); return tilesIndexSave(); }).catch(() => {})); } return hit; }
  try {
    const r = await tileFetch(req, host);
    if (r && r.ok && r.type !== 'opaque') e.waitUntil((async () => { // a known size only (storage, Q2) - an opaque answer is served and never kept
      try { const b = await r.clone().blob(); await c.put(req.url, new Response(b, { status: r.status, headers: r.headers })); idx.set(req.url, [b.size, nowS()]); await trimTiles(idx, c); await tilesIndexSave(); }
      catch (err) { try { await trimTiles(idx, c); } catch (x) {} } // a full device: the tile is only shown
    })());
    return r;
  } catch (err) { return Response.error(); }
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
    if (!n && /^\s*\{/.test(text) && text.includes(APP_ID)) { // an app file shared as text
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
  const page = req.mode === 'navigate' && url.origin === location.origin && PAGES['/' + url.pathname.split('/').pop()];
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
  if (TILE_HOSTS.some(h => url.hostname === h || url.hostname.endsWith('.' + h))) { e.respondWith(tileServe(e, req, url.hostname)); return; } // storage (Q2): 4.36.1's CORS copy for a picture is now the only copy
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
  if (url.origin === location.origin && (url.pathname.includes('/fonts/') || url.pathname.includes('/maplibre/') || url.pathname.endsWith('/countries-50m.json'))) { // legal-credits-2 (S9): the route pictures' borders, kept once fetched // legal-server (11.41.0): a font file - kept once fetched (a heading font a trip shows); map-3d: the 3D map's engine (its file names carry their version)
    e.respondWith((async () => { const hit = await caches.match(req); if (hit) return hit; const r = await fetch(req); if (r && r.ok) (await caches.open(LIBS)).put(req, r.clone()); return r; })());
    return;
  }
  if (url.origin === location.origin) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req)));
  }
  // weather, currency and geocoding APIs: network only (the app keeps its own caches)
});

// ================= 11.29.0: THE MAP LIBRARY OFF THE STARTUP PATH (task launch-fast; decisions 2026-11-19 · The launch screen, Q6 (a)) =================
// Leaflet (script and style) is no longer in the page's head: the first screen is drawn without it, then leafLoad() adds both (the
// service worker answers them from its library cache, as before). Whether maps exist is MAP_AVAILABLE (the installed site, not the copy
// inside Claude), never window.L. Every map entry asks leafGate(box, again) first: with the library there it answers true and the map
// is drawn at once; until then the box shows the loading mark (the small spinner), and once the library is in, `again` draws it - if the
// box is still on the page. Offline with no saved copy of the library the box shows the offline mark, and the library is asked again when
// the network returns. A map that opens on a tap with no box yet (picking a point, a place on the map) asks leafThen(fn).
// 11.38.2 (privacy-server): with Subresource Integrity - the browser runs the file only if it is exactly Leaflet 1.9.4's own (the
// package's dist/leaflet.js and leaflet.css, which cdnjs serves unchanged; the same files as tests/vendor/leaflet, whose hashes t810
// checks against these). The .min names cdnjs made itself were left for these two, so the hashes can be checked from the tree.
// One source for the app and the pages it builds (leafletTags, page-maps.js).
const LEAF_SRC = { js: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js', css: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css',
  jsSri: 'sha512-BwHfrr4c9kmRkLw6iXFdzcdWV/PGkVgiIyIWLLlTSXzWQzxuSg4DiQUCpauz/EWjgk5TYQqX/kvn9pG1NpYfqg==',
  cssSri: 'sha512-Zcn6bjR/8RZbLEpLIeOwNtzREBAJnUKESxces60Mpoj+2okopSAcSUIUOseddDm0cxnGQzxIR7vJgsLZbdLE3w==' };
const LEAF = { st: 'idle', wait: new Map(), then: null }; // st: idle → loading → ok / failed (failed → idle again when the network returns)
function leafOk() { return !!(window.L && L.map); }
function leafLoad() {
  if (leafOk()) { if (LEAF.st !== 'ok') leafDone(true); return; }
  if (!MAP_AVAILABLE || LEAF.st === 'loading') return; LEAF.st = 'loading';
  svcLibrary(LEAF_SRC.js, LEAF_SRC.css, () => leafDone(leafOk()), { js: LEAF_SRC.jsSri, css: LEAF_SRC.cssSri }); // through the services block (the one place that reaches outside); the map is drawn once both are in
}
function leafDone(ok) {
  LEAF.st = ok ? 'ok' : 'failed'; if (ok && LIFE.leaf) LIFE.leaf();
  const w = [...LEAF.wait]; LEAF.wait.clear();
  w.forEach(([el, again]) => { if (!el.isConnected) return; el.querySelectorAll(':scope > .leaf-wait').forEach(x => x.remove());
    if (ok) { try { again(); } catch (e) { console.error(e); } } else { el.insertAdjacentHTML('beforeend', leafMarkHTML(false)); LEAF.wait.set(el, again); } });
  const t = LEAF.then; LEAF.then = null; if (t && ok && Date.now() - t.at < 15000) { try { t.fn(); } catch (e) { console.error(e); } } // a tap answered late is still the person's, for a while
  else if (t && !ok) showToast(SY.warn + ' המפה תיטען כשתחזור הרשת');
}
function leafMarkHTML(loading) { return `<div class="map-empty-msg leaf-wait" role="status">${loading ? '<span class="spin" aria-hidden="true"></span>טוען מפה…' : msi('cloud_off', { size: 16, cls: 'msi-in' }) + ' המפה' + SEP + SVC_WAIT_NET}</div>`; }
function leafGate(box, again) {
  if (leafOk()) return true;
  const el = typeof box === 'string' ? document.getElementById(box) : box; if (!el) return false;
  if (!MAP_AVAILABLE) return false;
  if (!el.querySelector(':scope > .leaf-wait')) el.insertAdjacentHTML('beforeend', leafMarkHTML(LEAF.st !== 'failed'));
  LEAF.wait.set(el, again); leafLoad(); return false;
}
function leafThen(fn) { if (leafOk()) return fn(); if (!MAP_AVAILABLE) return;
  LEAF.then = { fn, at: Date.now() }; if (LEAF.st === 'failed') { LEAF.then = null; showToast(SY.warn + ' המפה תיטען כשתחזור הרשת'); return; }
  showToast('טוען מפה…'); leafLoad(); }
svcOnBack(() => { if (LEAF.st === 'failed') { LEAF.st = 'idle'; if (LEAF.wait.size) leafLoad(); } });

// ================= THE MAP OF A PAGE FOR PEOPLE, PACKED (diet-room; split from map-component.js) =================
// The pages group (decisions 2026-11-26 · Review of `big-dest-search`, Q1; the diet's rules, decisions 2026-11-23): only a page for people
// needs it (page-maps.js builds the page, after needGroup('pages')); the map component it packs stays in the main script.
// ---- 8.0.0 (ק19-ק21, ק23, cl-files-impl-plan stage 7): the map of a page for people is this component itself, packed from
// the running code (no second map code in the files): fileMapView is its view for a page - pins from the page's data, the
// read-only floating card, ⛶, the map type, ◎, the scale and clustering (no 📏 and no 📚). fmapPack() takes fileMapView and
// everything it reaches (functions, constants, the map's own actions and CSS) into one script; what belongs to the app only
// answers "nothing" there (FMAP_STUB), and the state a page starts with is FMAP_HOST - the small host of ק20 (1).
function fileMapView(F) {
  const host = document.getElementById('fmapLive'); if (!host || !window.L) return null;
  const c0 = (F.b && F.b[0]) || (F.items[0] ? [F.items[0].a, F.items[0].o] : [0, 0]), M = mapMake('fmapLive', { loading: false, restore: null, track: false, clusters: true, center: c0 }); if (!M) return null; const map = M.map;
  if (F.fade) host.classList.add('faded');
  const card = x => openFloatCard('fmapLive', cdCard({ cls: 'mc-card mc-ro', lead: leadHTML('place', x.h ? msi('hotel', { size: 18 }) : typeIcon(x.i, { size: 18 }), x.h ? 'var(--primary)' : x.c, x.n !== '' && x.n != null ? x.n : ''), name: x.t,
    tags: x.s ? [cdMeta([x.s])] : [], desc: x.d ? `<span class="mc-desc">${x.d}</span>` : '',
    acts: `<div class="tl-acts mc-acts">${x.v ? `<a class="tl-act a-nav" href="${x.v}" target="_blank" rel="noopener" aria-label="ניווט">${actIc('navigation')}</a>` : ''}<a class="tl-act a-g" href="https://www.google.com/search?q=${encodeURIComponent(x.q || x.t)}" target="_blank" rel="noopener" aria-label="חיפוש ב-Google">${actIc('travel_explore')}</a></div>` }), null, null, null);
  const all = F.items.map((x, i) => { const p = { id: 'f' + i, color: x.h ? 'var(--hotel-pin)' : x.c, icon: x.i || '', name: x.t };
    const mk = M.pin(p, { lat: x.a, lng: x.o }, x.h ? {} : { numbered: x.n !== '' && x.n != null, number: x.n !== '' && x.n != null ? x.n : (x.l ? '❤️' : null) }, () => card(x)); mk._x = x; M.grow({ lat: x.a, lng: x.o }); return mk; });
  if (F.r && F.r.length > 1) L.polyline(F.r, { color: '#1C2B33', weight: 3, opacity: .55, dashArray: '6 6' }).addTo(map);
  // memory-photos (Q4-Q5): the memory's photos at their highlights' places, as the phone's choice was when the page was made (F.ph); a tap shows them in the card
  (F.ph || []).forEach(x => L.marker([x.a, x.o], { keyboard: false, zIndexOffset: 800, icon: L.divIcon({ className: 'mem-ph-ic', html: `<span class="mem-ph${x.u.length > 1 ? ' mem-ph-st' : ''}"><span class="ph-cut mem-ph-bg" style="background-image:url(${x.u[0]})"></span>${x.u.length > 1 ? `<b>${x.u.length}</b>` : ''}</span>`, iconSize: [48, 48], iconAnchor: [24, 54] }) })
    .on('click', () => openFloatCard('fmapLive', cdCard({ cls: 'mc-card mc-ro', lead: '', name: x.t, tags: [], desc: `<span class="fmap-phs">${x.u.map(u => `<span role="img" aria-label="תמונה" style="background-image:url(${u})"></span>`).join('')}</span>`, acts: '' }), null, null, null)).addTo(map));
  M.finish('');
  let line = null; const fit = b => { if (b && b.length) map.fitBounds(L.latLngBounds(b), { padding: [24, 24], maxZoom: 16 }); };
  return { filter(fn, pts) { all.forEach(mk => { const on = fn(mk._x); if (on && !map.hasLayer(mk)) mk.addTo(map); if (!on && map.hasLayer(mk)) map.removeLayer(mk); });
      if (line) { map.removeLayer(line); line = null; } if (pts && pts.length > 1) { line = L.polyline(pts, { color: '#C08A2E', weight: 4, opacity: .85 }).addTo(map); fit(pts); }
      else { const v = all.filter(mk => map.hasLayer(mk) && !mk._x.h).map(mk => [mk._x.a, mk._x.o]); fit(v.length ? v : F.b); } } };
}
const FMAP_WORDS = new Set('setTimeout clearTimeout setInterval clearInterval requestAnimationFrame cancelAnimationFrame Date ClockDate performance true false null undefined this new typeof instanceof return if else for while do const let var function class of in delete void yield await async break continue switch case default try catch finally throw'.split(' '));
const FMAP_ACTS = ['map.full', 'map.typeMenu', 'map.type', 'map.locate', 'float.close', 'map.cr', 'map.crX']; // map-credit-line: the credit line's tap and its panel's ✕
// the app's own things a page has no use for (ק23: no 📏, no 📚, no offline maps, no windows or saving) - stubs that do nothing; relief-phone: no relief in a page
// (reliefLayer, reliefLine - the drawing would pass the packed map's size cap; Esri's relief never drew there, its key is the site's only)
// merge 11.50.0 (decisions 2026-11-23 · Review of the parallel day's summaries, Q6): introShow too - a page shows no screen intro (only introMaybe
// starts one), and through tipDismiss (TOUCH_ANY) it carried the whole guide (GUIDE, ~12 KB) past the packed map's cap (t830: 121,769 on the merged build; no function of the pack changed since 11.49.0)
// diet-groups: no group in a page (groupHas, groupFn, needGroup - a page's map type is never one a group draws)
// map-credit-line (11.73.0): the credit panel is no window of a stack in a page (layerPush, layerDone); closeSheet - a page opens no sheet, and through
// TOUCH_ANY's swipe it carried the window stack (layerRestore, layerMotion, ~4 KB) past the cap with the line's own code (t830: 121,503)
// map-3d: no 3D in a page (m3Row - 3d-find: the menu's row -, m3Close, m3Again, m3ThemeChanged - its engine is a file of the site, and its code would pass the cap)
const FMAP_STUB = ['groupHas', 'groupFn', 'needGroup', 'introShow', 'layerPush', 'layerDone', 'closeSheet', 'mapSweep', 'm3Row', 'm3Close', 'm3Again', 'm3ThemeChanged', 'mapDispose', 'measBtn', 'measDraw', 'measOnMapClick', 'measActiveOn', 'measAddMe', 'measAddPoint', 'measFrom', 'discAttach', 'offLayerFor', 'planItem', 'draftItems', 'openPlaceEditor', 'openPlaceSheet',
  'layerPush', 'layerPushHistory', 'render', 'persist', 'devSet', 'refreshBaseMaps', 'showUndoToast', 'dataChanged', 'redrawSoon', 'winRedraw', 'refOf', 'svcLine', 'svcGaveUpCount', 'curDest', 'regRead', 'regWrite', 'regChanged', 'filterAct',
  'showMapCard', 'miniCardHTML', 'itemOf', 'fsFilterHTML', 'filterHiddenCount', 'filterCountText', 'isHiddenPoint', 'routeHiddenCount', 'searchShown', 'tdOf', 'stashActive', 'rerenderKeepingMap', 'layerAppBack', 'hintMark', 'hintSeen', 'applyMapRestore', 'takeMapRestore', 'mapStatusLine', 'pastRatingFor', 'activeTripObj', 'hasTrip', 'heMapLayer', 'heLabelLayer', 'mapLightSync', 'reliefLayer', 'reliefLine']; // hebrew-map: a page has no "מפה בעברית" (its "מפה" is already the vector drawing); relief-phone: no relief in a page
// t830-steady (11.63.1): values a page takes as they are at the app's start, never as this session holds them. The services' state (SVC) carried
// the queues, the providers' down and send times (the app's own clock, meaningless in a page)
// and the keys waiting for the network - another trip's addresses, whose number grew the packed map past its cap (t830: 121,551 at short waits)
const FMAP_FRESH = { SVC: () => svcStart() };
// what a page starts with (the host): the device's choices are the defaults, nothing is saved
const FMAP_HOST = `var FMAP_PAGE=1,DESTS={},POINTS=[],FP={},FILTER={points:{},draft:{}},GEOCODE_CACHE={},TRIP_DAYS=[],LAYER_DEFS=[],TRIP_HIDDEN=new Set(),ARCHIVE_VIEW=null,activeTab='map',_SIMULATED_DATE=null,_tmFmtCache={},_sheetFromMap=null,_lastBuild=null;
var DEV={hints:{}},STATE={settings:{prefs:{cluster:'full',selfLoc:'off'}},visited:new Set(),favorites:new Set(),trips:{},tripData:{}},MAPS={},_mapState={},LIVE_MAPS=new Set(),FS=null,FS_FILTER={},MEAS=null,userPos=null,_selfAt=0,_keepMapView=false,_dataGen=0,_inAct=0,ACT_ERRORS=[],ACTIONS={},WIN_STACK=[],MAP_AVAILABLE=true,DRAFT=null;
function act(n,f){ACTIONS[n]=f;}function showToast(){}function render(){}function persist(){}function leafGate(){return true}
function runAct(el,ev,name){name=name||el.dataset.act;var f=ACTIONS[name];if(!f)return;try{f({el:el,v:el.dataset.v,ev:ev})}catch(e){console.error(e)}}
document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('[data-act]');if(!a||a.closest('.leaflet-container'))return;runAct(a,e);});`;
function fmapPack() {
  const G = globalThis, ev = n => { try { return (0, eval)(n); } catch (e) { return undefined; } };
  const host = new Set(['FMAP_PAGE', 'DESTS', 'POINTS', 'FP', 'FILTER', 'GEOCODE_CACHE', 'TRIP_DAYS', 'LAYER_DEFS', 'TRIP_HIDDEN', 'ARCHIVE_VIEW', 'activeTab', '_SIMULATED_DATE', '_tmFmtCache', '_sheetFromMap', '_lastBuild', 'DEV', 'STATE', 'MAPS', '_mapState', 'LIVE_MAPS', 'FS', 'FS_FILTER', 'MEAS', 'userPos', '_selfAt', '_keepMapView', '_dataGen', '_inAct', 'ACT_ERRORS', 'ACTIONS', 'WIN_STACK', 'MAP_AVAILABLE', 'DRAFT', 'act', 'runAct', 'showToast', 'render', 'persist', 'leafGate']); // 11.29.0: a page loads the library in its head - its maps never wait
  const stub = new Set(FMAP_STUB), fns = new Map(), vals = new Map(), todo = ['fileMapView'].concat(FMAP_ACTS.map(a => '\u0000' + a));
  const fsrc = f => { let t = Function.prototype.toString.call(f); if (!/^(async\s+)?function\b|^\(|^(async\s+)?[\w$]+\s*=>|^async\s*\(/.test(t)) t = 'function ' + t; return t; };
  const scan = src => { const ids = new Set(); src.replace(/(^|[^.\w$'"`])([A-Za-z_$][\w$]*)/g, (m, a, n) => { ids.add(n); return m; }); return ids; };
  const take = src => scan(src).forEach(n => { if (!fns.has(n) && !vals.has(n) && !host.has(n) && !stub.has(n)) todo.push(n); });
  while (todo.length) { const n = todo.pop(); if (fns.has(n) || vals.has(n) || FMAP_WORDS.has(n)) continue;
    if (n[0] === '\u0000') { const f = ACTIONS[n.slice(1)]; if (f) { const t = fsrc(f); fns.set(n, `act(${JSON.stringify(n.slice(1))},${t});`); take(t); } continue; }
    if (Object.prototype.hasOwnProperty.call(G, n) && typeof G[n] === 'function') { if (G[n].__life) continue; /* 10.11.0: a browser function counted by LIFE is still the browser's */ const t = fsrc(G[n]); if (/\[native code\]/.test(t)) continue; fns.set(n, /^function|^async function/.test(t) ? t : `var ${n}=${t};`); take(t); continue; }
    if (n in G || FMAP_WORDS.has(n)) continue; // a browser global (window, document, JSON...) or a word of the language
    const v = FMAP_FRESH[n] ? FMAP_FRESH[n]() : ev(n); if (v === undefined || typeof v === 'function' && /\[native code\]/.test(String(v))) continue;
    const s = fmapSer(v); if (s == null) continue; vals.set(n, `var ${n}=${s};`); take(s); }
  const stubs = [...stub].map(n => `function ${n}(){return false}`).join('');
  return FMAP_HOST + stubs + [...vals.values()].join('\n') + '\n' + [...fns.values()].join('\n');
}
function fmapSer(v, d) { d = d || 0; if (d > 8) return 'null';
  if (v === null || ['number', 'boolean', 'string'].includes(typeof v)) return JSON.stringify(v);
  if (typeof v === 'function') { let t = Function.prototype.toString.call(v); if (/\[native code\]/.test(t)) return null; if (!/^(async\s+)?function\b|^\(|^(async\s+)?[\w$]+\s*=>|^async\s*\(/.test(t)) t = 'function ' + t; return '(' + t + ')'; }
  if (typeof TextDecoder !== 'undefined' && v instanceof TextDecoder) return 'new TextDecoder()'; // friend-page-map (G128): the tiles' reader (VT_TD) - a browser object is made anew in the page, never left out
  if (v instanceof Set) return `new Set(${fmapSer([...v], d + 1)})`; if (v instanceof Map) return `new Map(${fmapSer([...v], d + 1)})`;
  if (Array.isArray(v)) return '[' + v.map(x => fmapSer(x, d + 1) || 'null').join(',') + ']';
  if (typeof v === 'object') { if (Object.getPrototypeOf(v) !== Object.prototype && Object.getPrototypeOf(v) !== null) return null;
    return '{' + Object.entries(v).map(([k, x]) => JSON.stringify(k) + ':' + (fmapSer(x, d + 1) || 'null')).join(',') + '}'; }
  return null; }
// the CSS the packed map uses: the theme's colours (light and dark) and the rules of the map, its buttons and the card
// legal-credits (11.40.0; decisions 2026-11-21 · Review of the map-upgrades report, Q1): the page's icons are its own small subset (FMAP_FONT, made by
// tests/msfont.py from ICON_MS and this line), never the app's font - the built app's CSS has no copy a page could take (the empty squares)
// friend-page-map (G130): 'map-fs' - full screen's own rule (fixed, the whole screen); without it ⛶ only swapped its icon
// FMAP_MS: fullscreen close layers my_location navigation travel_explore hotel location_on map landscape satellite_alt terrain check info kid_star favorite bar_chart calendar_month recommend link
const FMAP_CSS_KEYS = ['map-fs', 'map-cr', 'svc-cr', 'mem-ph', 'ph-cut', 'cd-', 'msi', 'pin-marker', 'pin-sel', 'map-float', 'mf-', 'tl-', 'mc-', 'ly-', 'fs-btn', 'fs-on', 'locate-me', 'clu-', 'fanned', 'leaflet', 'map-status', 'map-empty', 'faded', 'mem-tt', 'card'];
function fmapCSS() {
  const css = [...document.querySelectorAll('style')].map(x => x.textContent).join('\n').replace(/\/\*[\s\S]*?\*\//g, ''), out = []; // page-look: no comment of the app's style goes out (one carried a ©)
  const walk = (txt, wrap) => { let i = 0; while (i < txt.length) { const o = txt.indexOf('{', i); if (o < 0) break; const head = txt.slice(i, o).trim();
      let d = 1, k = o + 1; while (k < txt.length && d) { if (txt[k] === '{') d++; else if (txt[k] === '}') d--; k++; }
      const body = txt.slice(o + 1, k - 1);
      if (head.startsWith('@media')) walk(body, head); else if (head === '@font-face') { /* the app's fonts stay in the app (FMAP_FONT below) */ } else if (/^:root/.test(head) || FMAP_CSS_KEYS.some(x => head.includes(x))) out.push(wrap ? `${wrap}{${head}{${body}}}` : `${head}{${body}}`);
      i = k; } };
  walk(css.replace(/\/\*[\s\S]*?\*\//g, ''), ''); return FMAP_FONT + '\n' + out.join('\n'); }


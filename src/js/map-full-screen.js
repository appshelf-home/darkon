// ================= FULL-SCREEN MAP (4.14.0) =================
// ⛶ in the corner of every map (or turning the phone sideways) shows the map on the whole screen; ✕ in the same corner,
// Back, or turning back (when that is how it started) returns. Top bar, bottom bar and filter rows hide. The main map and
// the draft keep the filter button (5.14.0, ס3: the same funnel and the same filter window as on the screen). In the installed
// app the browser itself goes full screen too (status bar hidden). Not remembered: every visit to a map starts normal.
const FS_ICON = msi('fullscreen'); // 10.3.0 (design-3)
const FS_FILTER = { mapView_screen: 'points', draftMap: 'draft' }; // maps whose full screen keeps the filter button, and its family
let FS = null; // { id, how: 'btn' | 'rotate', depth, native }
function fsFilterHTML(id) { // in a full-screen map every filter that is on counts (ס4)
  const fam = FS_FILTER[id], n = filterHiddenCount(fam, true), c = fam === 'draft' ? (DRAFT ? draftShown(DRAFT).length + ' ' + TX.places : '') : filterCountText()[0];
  return `${FUNNEL_SVG}<span>סינון</span>${n ? `<b class="fbadge">${n}</b>` : ''}<small>${c}</small>`;
}
function fsSyncAll() { if (FS) fsSync(FS.id); }
act('map.full', c => { const id = c.el.parentElement.id; if (FS && FS.id === id) exitFS(); else enterFS(id, 'btn'); return 'quiet'; });
act('map.filterPill', c => { filterAct(FS_FILTER[c.el.parentElement.id], 'open'); return 'quiet'; });
function fsDecorate(id) {
  const host = document.getElementById(id); if (!host) return;
  let b = host.querySelector(':scope > .fs-btn');
  if (!b) { b = document.createElement('button'); b.type = 'button'; b.className = 'fs-btn'; b.dataset.act = 'map.full'; host.appendChild(b); mapCtl(b); }
  addLayerBtn(host); measBtn(host, id); // 4.31.0: 📏 under the map type
  if (FS_FILTER[id] && !host.querySelector(':scope > .fs-pill')) { const pl = document.createElement('button'); pl.type = 'button'; pl.className = 'fs-pill ffunnel'; pl.dataset.fx = 'open'; pl.dataset.act = 'map.filterPill'; host.appendChild(pl); mapCtl(pl); }
  fsSync(id);
}
function fsSync(id) {
  const host = document.getElementById(id); if (!host) return;
  const on = !!(FS && FS.id === id), b = host.querySelector(':scope > .fs-btn'), pl = host.querySelector(':scope > .fs-pill');
  host.classList.toggle('map-fs', on);
  if (b) { b.innerHTML = on ? msi('close') : FS_ICON; b.setAttribute('aria-label', on ? 'יציאה ממסך מלא' : 'מפה במסך מלא'); b.title = on ? 'יציאה ממסך מלא' : 'מסך מלא'; }
  if (pl && on) { pl.innerHTML = fsFilterHTML(id); pl.dataset.active = String(filterHiddenCount(FS_FILTER[id], true) > 0); pl.setAttribute('aria-label', 'סינון'); }
  if (on) fsInvalidate(id);
}
function fsInvalidate(id) { const r = MAPS[id]; if (!r) return; requestAnimationFrame(() => { try { r.map.invalidateSize(); } catch (e) {} }); setTimeout(() => { try { r.map.invalidateSize(); } catch (e) {} }, 250); }
function fsBody() {
  document.body.classList.toggle('fs-on', !!FS);
  document.body.classList.toggle('fs-main', !!(FS && FS.id === 'mapView_screen'));
}
function canNativeFS() { return prefs().fsReal === 'real' && MAP_AVAILABLE && !!document.documentElement.requestFullscreen && !document.fullscreenElement; } // 4.19.1: the browser's own full screen (and its exit message) only when chosen
function enterFS(id, how) {
  if (FS) exitFS();
  if (!document.getElementById(id)) return;
  FS = { id, how, depth: 1, native: false };
  layerPush('fs', 'full', fp => exitFS(fp)); // 5.4.0
  fsBody(); fsSync(id);
  if (how === 'btn') fsNative(FS); else fsNativeOnTouch(FS);
}
// the browser's own full screen hides the phone's bar (when chosen in settings); the browser allows it only right after a touch
function fsNative(f) { if (!canNativeFS()) return; document.documentElement.requestFullscreen({ navigationUI: 'hide' }).then(() => { if (FS === f) { f.native = true; fsInvalidate(f.id); } }).catch(() => {}); }
// 9.3.0 (ס14): turning the phone opens full screen at once, without a touch - so the phone's bar hides at the first touch on
// the map (a tap, a drag or a pinch); until then it shows. Leaving stays as it was: ✕ or turning back
function fsNativeOnTouch(f) {
  const el = document.getElementById(f.id); if (!el || !canNativeFS()) return;
  const go = e => { if (!el.isConnected || FS !== f) { touchAny('end', go, false); return; } if (!el.contains(e.target)) return; touchAny('end', go, false); if (!f.native) fsNative(f); };
  touchAny('end', go);
}
function exitFS(fromPop) {
  if (!FS) return;
  const f = FS; FS = null; if (M3.id === f.id) m3Close(); // map-3d: leaving full screen leaves 3D too
  fsBody(); fsSync(f.id);
  if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
  { const k = WIN_STACK.filter(e => e.key === 'fs').length; WIN_STACK = WIN_STACK.filter(e => e.key !== 'fs'); layerAppBack(fromPop ? k - 1 : k); } // 5.4.0
  if (f.id === 'mapView_screen' && activeTab === 'map') rerenderKeepingMap(); // the screen's map height was measured without the top bar
  else fsInvalidate(f.id);
}
function fsAfterRender() { // a re-render that left the full-screen map's screen ends full screen
  if (FS && !document.getElementById(FS.id)) { if (_sheetOpen) { FS = null; fsBody(); } else exitFS(); return; }
  if (FS) fsSync(FS.id);
  if (M3.again) m3Again(); // map-3d: the screen was drawn again under the 3D view - it opens again on the new map
}
// turning the phone: sideways opens the map that fills most of the screen (or the point picker when the place editor is
// open); back upright closes it, only if turning is how it was opened
function fsBestMap() {
  let best = null, area = 0; const vh = window.innerHeight, vw = window.innerWidth;
  Object.keys(MAPS).forEach(id => { const el = document.getElementById(id); if (!el || !el.isConnected) return;
    const r = el.getBoundingClientRect(), h = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0)), w = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0));
    if (h * w > area && (h > r.height * 0.25 || h * w > vw * vh * 0.3)) { area = h * w; best = id; } });
  return best;
}
function onTurn(landscape) {
  if (!(window.matchMedia && matchMedia('(pointer: coarse)').matches)) return; // a desktop window is not a turned phone
  if (landscape) {
    if (FS || FS_PICK) return;
    if (_sheetOpen) { const fb = document.querySelector('#sheet .fm-map .fs-btn'); if (fb) fb.click(); return; } // 7.2.0: the location block's ⛶
    const id = fsBestMap(); if (id) enterFS(id, 'rotate');
  } else {
    if (FS_PICK && FS_PICK.how === 'rotate') closePick();
    else if (FS && FS.how === 'rotate') exitFS();
  }
}
try { const mq = matchMedia('(orientation: landscape)'), h = e => onTurn(e.matches); sysOn(mq, 'change', h); } catch (e) {}
sysOn(document, 'fullscreenchange', () => { // the phone's own Back (or Esc) ended the browser's full screen
  if (document.fullscreenElement) return;
  if (FS && FS.native) exitFS(); else if (FS_PICK && FS_PICK.native) closePick();
});

// The point picker of the place editor, in full screen. The pin stays in the middle: tapping a spot slides the map so the
// spot comes under the pin, dragging the map fine-tunes under it, search and ◎ bring a place to the middle.
// ⚙️ הגדרות ← 🎛️ ← 📌 סימון נקודה במפה: both (default), only dragging the map, or only tapping (the pin moves, as in the small map).
// off-frame: o.frame - the same layer as a frame on the map (the offline area editor; pickFrame below)
let FS_PICK = null; // { how, map, marker, native, done }
function openPick(o) {
  if (FS_PICK || !MAP_AVAILABLE) return;
  if (!leafOk()) { leafThen(() => openPick(o)); return; } // 11.29.0 (launch-fast): the library first
  const mode = 'both', esc = escH, fr = o.frame;
  const el = document.createElement('div'); el.className = 'fs-pick' + (fr ? ' fsp-fr' : ''); el.id = 'fsPick'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', fr ? fr.title : 'בחירת מיקום במפה');
  if (fr) el.innerHTML = pickFrameHTML(fr); else el.innerHTML = `<div class="fsp-map" id="fsPickMap"></div>${mode === 'tap' ? '' : '<div class="fsp-pin" aria-hidden="true">' + msi('location_on', { fill: true }) + '</div>'}
    <div class="fsp-top"><b class="fsp-title">בחירת מיקום</b><div class="fsp-search">${searchFieldHTML('fspQ', 'חיפוש כתובת או מקום', '')}<button type="button" class="btn-nav" id="fspGo" data-act="pick.search">חיפוש</button></div>
      <div class="fsp-res" id="fspRes"></div></div>
    <button type="button" class="fs-btn" id="fspClose" data-act="pick.close" aria-label="סגירה בלי שינוי" title="סגירה">${msi('close')}</button>
    <button type="button" class="locate-me-btn" id="fspMe" data-act="pick.me" aria-label="המיקום שלי" title="המיקום שלי">${msi('my_location')}</button>
    <div class="fsp-card"><small>מזיזים את המפה (או נוגעים במקום) עד שהסיכה במקום</small><b id="fspAddr" hidden></b><button type="button" class="fsp-ok" id="fspOk" data-act="pick.ok">${msi('check', { size: 18 })} כאן</button></div>`; // 10.5.0 (design-4 part 2, look.md "Maps"): a card at the bottom - the hint, the address found, "כאן"
  document.body.appendChild(el);
  const $ = q => el.querySelector(q);
  const map = mapTool('fsPickMap').setView(o.start, o.zoom || 16); // 5.9.0
  if (!fr) { addLayerBtn(el); discAttach('fsPickMap', map, 'edit', el); }
  FS_PICK = { how: o.how, map, marker: null, native: false, found: null, o };
  layerPush('fsp', 'full', fp => closePick(fp)); const ctl = layerTop().ctl = {}; // 5.4.0
  if (fr) { pickFrame(el, map, fr, ctl); return; }
  const seen = () => hintMark('pick');
  const put = ll => { if (FS_PICK.marker) FS_PICK.marker.setLatLng(ll); else { FS_PICK.marker = L.marker(ll, { draggable: true }).addTo(map); FS_PICK.marker.on('dragend', seen); } };
  if (mode === 'tap' && o.has) put(o.start);
  if (mode === 'both') map.on('click', e => { map.panTo(e.latlng); seen(); });
  if (mode === 'tap') map.on('click', e => { put(e.latlng); seen(); });
  if (mode !== 'tap') map.on('dragend', seen);
  const go = (c, z) => { map.setView([c.lat, c.lng], Math.max(map.getZoom(), z || 17)); if (mode === 'tap') put([c.lat, c.lng]); };
  // 11.20.0 (place-search-upgrade): the one place search - typing pauses ask Photon, "חיפוש" / Enter both; a pick brings the place to the pin
  // 11.28.0 (area-search Q1): o.kind 'area' (from the destination's centre) - areas anywhere, no box and no bias; a picked area fits its extent
  const ps = psHost({ box: () => $('#fspRes'), kind: o.kind, near: () => o.kind === 'area' ? false : map.getCenter(), ret: o.ret || null, map: () => { const H = PS_HOSTS[ps]; if (H) H.st = null; $('#fspRes').innerHTML = ''; showToast('מזיזים את המפה עד שהסיכה במקום'); },
    pick: x => { FS_PICK.found = x; const ez = x.area && x.ext ? psExtZoom(map, x.coord, x.ext) : null; if (ez != null) map.setView([x.coord.lat, x.coord.lng], ez); else go(x.coord); const a = $('#fspAddr'); a.textContent = [x.name, x.sub].filter(Boolean).join(', '); a.hidden = !a.textContent; } });
  $('#fspQ').dataset.ps = ps;
  const search = async () => {
    const q = $('#fspQ').value.trim(); if (!q) { showToast('כתבו שם או כתובת'); return; }
    if (psSpecial(q)) { const r = await psReadLink(q); if (!FS_PICK) return; if (r && r.coord) { FS_PICK.found = { name: r.name, sub: '', coord: r.coord }; go(r.coord); const a = $('#fspAddr'); a.textContent = r.name || ''; a.hidden = !r.name; } else showToast(PS_NO_POINT); return; }
    psRun(ps, q, 'explicit');
  };
  ctl.search = () => { search(); }; $('#fspQ').dataset.actEnter = 'pick.search';
  ctl.me = async () => { const b = $('#fspMe'); b.innerHTML = msi('hourglass_top'); const pos = await requestUserLocation(); b.innerHTML = msi('my_location'); if (pos) go(pos, 17); else showToast('לא הצלחנו לקבל מיקום - בדוק שהאיתור פעיל במכשיר'); };
  ctl.close = () => closePick();
  ctl.ok = () => {
    let c;
    if (mode === 'tap') { if (!FS_PICK.marker) { showToast('לוחצים על המפה כדי לסמן'); return; } const ll = FS_PICK.marker.getLatLng(); c = { lat: ll.lat, lng: ll.lng }; }
    else { const ll = map.getCenter(); c = { lat: ll.lat, lng: ll.lng }; }
    const f = FS_PICK.found, near = f && Math.abs(f.coord.lat - c.lat) < 0.0006 && Math.abs(f.coord.lng - c.lng) < 0.0009; // ~60m: still the place that was found
    const cb = o.onPick; closePick(); seen();
    cb({ coord: c, addr: near ? [f.name, f.sub].filter(Boolean).join(', ') : '', name: near ? f.name : '', ...(near && f.area ? { cc: f.cc, area: f.area, ext: f.ext } : {}) }); // 11.28.0: a picked area's country and extent
  };
  setTimeout(() => { try { map.invalidateSize(); } catch (e) {} }, 60);
  if (o.how === 'btn' && canNativeFS()) { const p = FS_PICK; document.documentElement.requestFullscreen({ navigationUI: 'hide' }).then(() => { if (FS_PICK === p) { p.native = true; setTimeout(() => { try { map.invalidateSize(); } catch (e) {} }, 200); } }).catch(() => {}); }
}
ctlActs('pick', ['search', 'me', 'close', 'ok', 'orig'], ['search', 'me']);
// off-frame (decisions 2026-11-23 · Offline maps - an area framed, resized and moved on the map, Q2, Q6): the point picker as a frame. A fixed
// frame in the middle of the free part of the screen (between the top bar and the bottom card); the map moves and zooms under it (one finger
// drags, two zoom - the map's own); each corner is dragged (the scrub - touch.js) to change the frame's shape, the frame staying centred.
// fr: { title, bb [s, w, n, e] - opens filling the frame exactly, card - the bottom card's html, draw(map) - what is drawn under the frame,
// change(bb, live) - on every move (live: during it, every 150 ms), save(bb) - false keeps the layer open, else a function run once it is
// closed, orig - null or the action of "חזרה לגודל המקורי" }. Back and ✕ close it with no change, as the picker
const FSP_FRAME = { min: 72, pad: 16, every: 150 }; // the frame's smallest side (px - a finger on two corners); its margin in the free part; the live count's pause (ms)
function pickFrameHTML(fr) {
  return `<div class="fsp-map" id="fsPickMap"></div><div class="fsp-frame" id="fspFrame"><i class="fsp-c fsp-ne" aria-hidden="true"></i><i class="fsp-c fsp-nw" aria-hidden="true"></i><i class="fsp-c fsp-se" aria-hidden="true"></i><i class="fsp-c fsp-sw" aria-hidden="true"></i></div>
    <div class="fsp-bar"><button type="button" class="top-ic" id="fspClose" data-act="pick.close" aria-label="ביטול" title="ביטול">${msi('close')}</button><b class="fsp-title">${escH(fr.title)}</b><button type="button" class="btn-nav fsp-save" id="fspSave" data-act="pick.ok">שמירה</button></div>
    <div class="fsp-card fsp-fcard" id="fspCard">${fr.card}</div>`; }
function pickFrame(el, map, fr, ctl) {
  const $ = q => el.querySelector(q), F = $('#fspFrame'); let box = null, last = fr.bb, tm = 0;
  map.options.zoomSnap = 0; // an area fills the frame exactly (a zoom between steps)
  const free = () => { const B = el.getBoundingClientRect(), t = $('.fsp-bar').getBoundingClientRect().bottom - B.top, b = $('#fspCard').getBoundingClientRect().top - B.top;
    return { l: FSP_FRAME.pad, r: B.width - FSP_FRAME.pad, t: t + FSP_FRAME.pad, b: Math.max(t + FSP_FRAME.pad + FSP_FRAME.min, b - FSP_FRAME.pad) }; };
  const place = () => { Object.assign(F.style, { left: (box.cx - box.w / 2) + 'px', top: (box.cy - box.h / 2) + 'px', width: box.w + 'px', height: box.h + 'px' }); };
  const bbOf = () => { const a = map.containerPointToLatLng([box.cx - box.w / 2, box.cy - box.h / 2]), b = map.containerPointToLatLng([box.cx + box.w / 2, box.cy + box.h / 2]);
    return [b.lat, a.lng, a.lat, b.lng].map(v => +v.toFixed(5)); };
  const fit = bb => { const f = free(), W = f.r - f.l, H = f.b - f.t, z0 = map.getZoom(), p = map.project([bb[2], bb[1]], z0), q = map.project([bb[0], bb[3]], z0);
    const bw = Math.max(1, q.x - p.x), bh = Math.max(1, q.y - p.y), z = Math.min(map.getMaxZoom(), z0 + Math.log2(Math.min(W / bw, H / bh))), k = 2 ** (z - z0);
    box = { cx: (f.l + f.r) / 2, cy: (f.t + f.b) / 2, w: Math.max(FSP_FRAME.min, Math.min(W, bw * k)), h: Math.max(FSP_FRAME.min, Math.min(H, bh * k)) }; place();
    const S = map.getSize(), c = map.project(map.unproject(p.add(q).divideBy(2), z0), z).subtract([box.cx - S.x / 2, box.cy - S.y / 2]); // the area's centre at the frame's centre
    map.setView(map.unproject(c, z), z, { animate: false }); };
  const fire = live => { clearTimeout(tm); if (!box || !FS_PICK) return; if (live) { tm = setTimeout(() => { if (FS_PICK) fr.change(last = bbOf(), true); }, FSP_FRAME.every); return; } fr.change(last = bbOf(), false); };
  F.querySelectorAll('.fsp-c').forEach(c => { let d = null; // a corner follows the finger; the opposite one mirrors it, so the frame stays in the middle
    scrubGesture(c, (x, y, start) => { const B = el.getBoundingClientRect(), f = free(), hx = Math.abs(x - B.left - box.cx), hy = Math.abs(y - B.top - box.cy);
      if (start || !d) { d = { x: hx - box.w / 2, y: hy - box.h / 2 }; return; }
      box.w = Math.max(FSP_FRAME.min, Math.min(2 * Math.min(box.cx - f.l, f.r - box.cx), 2 * (hx - d.x))); box.h = Math.max(FSP_FRAME.min, Math.min(2 * Math.min(box.cy - f.t, f.b - box.cy), 2 * (hy - d.y)));
      place(); fire(true); }, () => { d = null; fire(false); }); });
  ctl.close = () => closePick();
  ctl.ok = () => { const go = fr.save(bbOf()); if (!go) return; closePick(); go(); };
  ctl.orig = () => { if (!fr.orig) return; closePick(); fr.orig(); };
  const start = () => { try { map.invalidateSize(); fit(last); fr.draw(map); } catch (e) {} map.on('move', () => fire(true)); map.on('moveend', () => fire(false)); map.on('resize', () => { fit(last); fire(false); }); fire(false); };
  requestAnimationFrame(start); }
function closePick(fromPop) {
  if (!FS_PICK) return;
  const p = FS_PICK; FS_PICK = null;
  mapDispose(p.map);
  const el = document.getElementById('fsPick'); if (el) el.remove();
  if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
  layerDone('fsp', fromPop); // 5.4.0
}
function regMarker(containerId, id, marker) {
  const r = MAPS[containerId]; if (!r) return; r.markers.set(String(id), marker); cluItem(containerId, id, marker, 'p'); // 4.31.0
  const st = _mapState[containerId]; if ((st && st.selectedId != null && String(st.selectedId) === String(id)) || (r.selId != null && String(r.selId) === String(id))) markSelected(containerId, id);
}
function markSelected(containerId, id) {
  const r = MAPS[containerId]; if (!r) return;
  if (r.selId != null) { const old = r.markers.get(String(r.selId)); if (old) { const e = old.getElement && old.getElement(); if (e) e.classList.remove('pin-sel'); old.setZIndexOffset(old.options._baseZ || 0); } }
  r.selId = id; if (id == null) return;
  const m = r.markers.get(String(id)); if (!m) return;
  const e = m.getElement && m.getElement(); if (e) e.classList.add('pin-sel');
  if (m.options._baseZ == null) m.options._baseZ = m.options.zIndexOffset || 0;
  m.setZIndexOffset(4000);
  requestAnimationFrame(() => { const host = document.getElementById(containerId), box = host && host.querySelector(':scope > .map-float');
    try { r.map.panInside(m.getLatLng(), { paddingTopLeft: [24, 56], paddingBottomRight: [24, (box ? box.offsetHeight : 0) + 28] }); } catch (err) {} });
}
// 4.3.3: the floating card is always short and never cut (name, one info row, two lines of description, buttons).
// The full details open in a dialog: tap the text, "פרטים ›", or swipe the card up. Swiping it down closes it.
function openFloatCard(hostId, html, wire, onClose, onDetails) {
  const host = document.getElementById(hostId); if (!host) return null;
  const old = host.querySelector(':scope > .map-float'); if (old) old.remove();
  const box = document.createElement('div'); box.className = 'map-float';
  box.innerHTML = (onDetails ? '<span class="mf-grip" aria-hidden="true"></span>' : `<button type="button" class="mf-x" data-act="float.close" aria-label="סגירה">${msi('close')}</button>`) + html; // 10.2.0 (design-2): a card that opens its details is closed by pulling it down (or a tap on the map) - no ✕; the grip says so
  host.appendChild(box); box._onClose = onClose; box._onDetails = onDetails || null; // the card's own close / details (float.close, float.details)
  if (onDetails) { box.classList.add('g-float'); // follows the finger (TOUCH 'pull'): up opens the details, down closes
    box.querySelectorAll('[data-mfmore], .mf-body, .tl-card > .tl-body').forEach(el => { if (!el.dataset.act) el.dataset.act = 'float.details'; }); // the card's body and "פרטים ›" open its details
  }
  if (wire) wire(box);
  document.body.classList.add('map-card-open');
  return box;
}
act('float.close', c => { const box = c.el.closest('.map-float'); if (box && box.parentElement) closeFloatCard(box.parentElement.id); });
act('float.details', c => { const box = c.el.closest('.map-float'); if (box && box._onDetails) box._onDetails(); });
gestureOn('pull', '.map-float.g-float', { at: TOUCH.floatAt, up: TOUCH.floatUp, done: (box, dir) => { if (dir < 0) box._onDetails(); else closeFloatCard(box.parentElement.id); } });
function closeFloatCard(hostId) {
  const host = document.getElementById(hostId), box = host && host.querySelector(':scope > .map-float');
  if (box) { box.remove(); if (box._onClose) box._onClose(); }
  if (!document.querySelector('.map-float')) document.body.classList.remove('map-card-open');
}
let _sheetFromMap = null;
var _placeSheetCtx = null; // 5.2.0: opened from a plan card - its day and token (the instance shown in the status line)
let _placeSheetSched = null; // 4.37.0: opened from a line of the organized schedule - its details (and my changes) on top
function openPlaceSheet(p) { // 5.2.0: every "details" opens the one item window
  const mh = _sheetFromMap; _sheetFromMap = null; const sid = _placeSheetSched; _placeSheetSched = null; const pc = _placeSheetCtx; _placeSheetCtx = null;
  openItemWin(sid ? 's:' + sid : p.id, { mapHost: mh, day: pc && pc.day, tok: pc && pc.tok });
}

// ================= map-3d: THE TILTED 3D MAP (decisions 2026-11-21 · Review of the map upgrades, Q11, Q15-Q16, Q18-Q19; the owner) =================
// "תלת־ממד" is the last row of the map types' menu (3d-find; decisions 2026-11-23 · The 3D map found from the map types' menu, Q1) on the destination's
// map, the day map and the memory map - online only; chosen from a small map it opens the full screen (⛶) straight in 3D. Never kept (DEV.baseMap
// unchanged): another type chosen, or the full screen closed, returns to the 2D map as it was. The engine
// is MapLibre GL JS with the RTL text plugin, files of the app's own site (maplibre/, the service worker keeps them), loaded on the first tap -
// never at startup. The view: OpenFreeMap's vector tiles with 3D buildings, names Hebrew-first (vtName) growing with the text size, in the
// "מפה בעברית" style (the --vmap-* tokens, light or dark: heStyle); terrain and its hillshade from Mapterhorn (the relief's row: 512-px tiles,
// heights to z12 of its tiles = z13 of 256-px detail). The trip on it is read from the 2D map under it (m3Trip): its pins (a tap opens the same
// floating card, through the 2D pin's own tap) and its lines (the day's route, travels, Timeline paths). Measuring, 📚, clustering and edge
// arrows stay in the 2D map. A second map object with its own lifecycle: m3Close removes it and its GPU memory (on ✕, Back, another type chosen, or when
// its 2D map is disposed); LIFE.gl counts it. The engine's code stays loaded for the session. The first open shows a one-time note on its cost.
// Parts: here, in the full-screen map's part (a part of its own would join the parts' cycle); the menu's row (m3Row, from map.typeMenu in
// js/map-types.js), exitFS / mapDispose / pinTap (the lifecycle and the tap), css/maps.css; spec/map-component.md.
const M3_LIB = { js: './maplibre/maplibre-gl-4.7.1.js', css: './maplibre/maplibre-gl-4.7.1.css', rtl: './maplibre/mapbox-gl-rtl-text-0.2.3.min.js',
  jsSri: 'sha384-SYKAG6cglRMN0RVvhNeBY0r3FYKNOJtznwA0v7B5Vp9tr31xAHsZC0DqkQ/pZDmj', cssSri: 'sha384-MinO0mNliZ3vwppuPOUnGa+iq619pfMhLVUXfC4LHwSCvF9H+6P/KO4Q7qBOYV5V' }; // Subresource Integrity: the files exactly as npm ships them (tests check)
const M3_STYLE = 'https://tiles.openfreemap.org/styles/liberty'; // OpenFreeMap's style: its sources, glyphs and sprite (with 3D buildings, building-3d)
const M3 = { st: 'idle', ready: null, raw: null, map: null, id: null, l2: null, t0: 0, last: null, pend: null, again: null };
const M3_NOTE = 'm3.note'; // the one-time note (DEV.hints)
function m3Can(id) { return id === 'mapView_screen' || /^mapView_day_/.test(id) || id === 'memMap'; } // the destination's map, a day's map, the memory map
function m3Gl() { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } }
function m3Why() { // why the switch is not offered now (a quiet word), or ''
  if (svcNetDown()) return 'תלת־ממד' + SEP + 'רק עם רשת';
  if (RELIEF.down || svcProvDown('mapterhorn')) return RELIEF_DOWN + SEP + 'ולכן גם לא תלת־ממד'; // Q19: no heights, no 3D - the relief's own word
  if (!m3Gl()) return 'תלת־ממד לא נתמך בדפדפן הזה';
  return ''; }
// 3d-find: the menu's row - on the maps that have it (m3Can), never in a page for people; greyed with its reason when not offered now (offline: "צריך רשת"),
// its tap then explains (a toast); checked only while the 3D view is shown on this map
function m3Row(id) { if (!m3Can(id) || typeof FMAP_PAGE !== 'undefined') return ''; const on = M3.id === id, why = on ? '' : m3Why(), sub = !why ? 'נפתח במסך מלא' : svcNetDown() ? 'צריך רשת' : why;
  return `<button type="button" role="menuitemradio" aria-checked="${on ? 'true' : 'false'}" data-act="map.3d" data-v="3d" data-active="${on ? 'true' : 'false'}"${why ? ' data-off="true"' : ''}>${msi('view_in_ar', { cls: 'ly-ic' })}<span class="ly-t"><b>תלת־ממד</b><small>${sub}</small></span>${on ? msi('check', { cls: 'ly-ck' }) : ''}</button>`; }
function m3SyncAll() { document.querySelectorAll('.ly-menu > [data-v="3d"]:not([data-active="true"])').forEach(b => { const why = m3Why(), s = b.querySelector('small'); // the network came or went while the menu is open
  b.toggleAttribute('data-off', !!why); if (why) b.dataset.off = 'true'; if (s) s.textContent = !why ? 'נפתח במסך מלא' : svcNetDown() ? 'צריך רשת' : why; }); }
act('map.3d', c => { const m = c.el.closest('.ly-menu'), host = m.parentElement, id = host.id; m.remove(); if (M3.id === id) return 'quiet'; // already shown
  const why = m3Why(); if (why) { showToast(why); return 'quiet'; }
  if (!FS || FS.id !== id) enterFS(id, 'btn'); // from a small map: its full screen first, then 3D
  if (!hintSeen(M3_NOTE)) { m3Note(id); return 'quiet'; } m3Open(id); return 'quiet'; });
// the note on its cost (the owner): once, at the first open; the same words in the guide's maps chapter
const M3_NOTE_LINES = ['צריך רשת: כל מבט מוריד כמה מגה-בייט של מפה וגבהים.', 'כבד יותר על הסוללה ועל הטלפון מהמפה הרגילה.', 'שום דבר ממנה לא נשמר בטלפון לשימוש בלי רשת, מלבד המטמון הרגיל של הדפדפן.', 'שתי אצבעות מטות ומסובבות; הכפתור עם המצפן מסובב את המפה לצפון למעלה, וההטיה נשארת.'];
function m3Note(id) { layerNote(m3Note, arguments); M3.pend = id; const sheet = document.getElementById('sheet');
  sheet.innerHTML = `${fmHead(`${msi('view_in_ar', { cls: 'head-ic' })} מפה בתלת־ממד`)}<p>ההרים, העמקים והבניינים בנפח, והמקומות והמסלול של הטיול עליהם.</p>
    <ul class="m3-note">${M3_NOTE_LINES.map(t => `<li>${t}</li>`).join('')}</ul>
    <div class="brow sheet-save-bar"><button type="button" class="btn-nav" data-act="m3.noteOk">הבנתי</button></div>`;
  showSheetBackdrop('m3Note'); }
act('m3.noteOk', () => { hintMark(M3_NOTE); const id = M3.pend; M3.pend = null; closeSheet(); if (id && FS && FS.id === id) setTimeout(() => m3Open(id), 0); return 'quiet'; });
// the engine: once per session, from the site, never before the first tap
function m3Load() { if (window.maplibregl && M3.st === 'ok') return Promise.resolve(true); if (M3.ready) return M3.ready;
  M3.st = 'loading';
  M3.ready = new Promise(res => svcLibrary(M3_LIB.js, M3_LIB.css, ok => { ok = ok && !!window.maplibregl; M3.st = ok ? 'ok' : 'idle'; if (!ok) M3.ready = null;
    if (ok) { try { maplibregl.addProtocol('m3', m3Proto); } catch (e) {} // every tile, height and glyph through the one client
      try { maplibregl.setRTLTextPlugin(new URL(M3_LIB.rtl, location.href).href, true).catch(() => {}); } catch (e) {} } // lazy: asked only when Hebrew is drawn; a failure never stops the map
    res(ok); }, { js: M3_LIB.jsSri, css: M3_LIB.cssSri }));
  return M3.ready; }
// the style: OpenFreeMap's through the one client (kept for the session), its vector source the tiles of the app's own TileJSON (vtTemplate),
// coloured by the tokens, names Hebrew-first, the terrain and the trip
function m3StyleRaw() { if (M3.raw) return Promise.resolve(M3.raw);
  return Promise.all([svcAsk('map3d', { key: 'style', build: prov => prov === 'openfreemap' ? { url: M3_STYLE, as: 'json', ms: 15000 } : null, parse: j => { if (!j || !j.layers || !j.sources) throw new Error('style'); return j; } }), vtTemplate()])
    .then(([r, T]) => { if (r.kind !== 'ok') throw new Error('style ' + r.kind); const st = r.value;
      Object.keys(st.sources).forEach(k => { const s = st.sources[k]; if (s.type === 'vector') { delete s.url; s.tiles = [T.t]; s.maxzoom = T.max; } }); return (M3.raw = st); }); }
// the engine asks its tiles, heights and glyphs as m3://<host>/<path> (m3Via): the page answers each through the one client - the provider's
// queue (OpenFreeMap: 4 at once), its counts and its "down"; the engine's own fetch (in its worker) never reaches the outside
function m3Via(u) { return typeof u === 'string' && u.startsWith('https://') ? 'm3://' + u.slice(8) : u; }
function m3Proto(params) { const u = 'https://' + String(params.url).replace(/^m3:\/\//, ''), mh = u.startsWith('https://' + PROVIDERS.mapterhorn.hosts[0] + '/');
  return svcAsk('map3d', { key: u, build: prov => prov === (mh ? 'mapterhorn' : 'openfreemap') ? { url: u, as: 'bytes', empty404: true, ms: 20000 } : null, parse: d => mh ? d : vtUnzip(d) }) // OpenFreeMap's tiles can come still gzipped (as the offline maps read them)
    .then(r => { if (r.kind === 'ok') { const b = r.value; return { data: b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) }; }
      if (r.kind === 'empty' && !mh) return { data: new ArrayBuffer(0) }; // a vector tile with nothing in it
      throw new Error(r.kind); }); } // a height tile that is not there is the open sea (flat), as the relief reads it
const M3_FILL = [[/park/, 'park'], [/wood/, 'wood'], [/grass/, 'grass'], [/ice/, 'ice'], [/sand/, 'sand'], [/residential/, 'residential'], [/pitch|track/, 'pitch'], [/cemetery/, 'cemetery'], [/hospital|school/, 'civic'], [/^water$/, 'water'], [/aeroway/, 'aeroway'], [/building/, 'building']];
function m3LineColor(l, S) { const id = l.id, sl = l['source-layer'];
  if (sl === 'waterway') return S.water; if (sl === 'boundary') return S.boundary; if (sl === 'park') return S.park; if (sl === 'aeroway') return S.road.minor;
  if (sl !== 'transportation') return null; if (/casing/.test(id)) return S.casing; if (/rail/.test(id)) return S.rail;
  if (/motorway/.test(id) && !/link/.test(id)) return S.road.motorway; if (/trunk_primary/.test(id)) return S.road.primary; if (/secondary_tertiary/.test(id)) return S.road.secondary;
  if (/path|pedestrian/.test(id)) return S.road.path; return S.road.minor; }
function m3Size(v, k) { if (typeof v === 'number') return Math.round(v * k * 10) / 10; // a text size, by the text size of the app (heTextScale)
  if (Array.isArray(v) && (v[0] === 'interpolate' || v[0] === 'step')) return v.map((x, i) => (v[0] === 'interpolate' ? i > 3 && i % 2 === 0 : i > 1 && i % 2 === 0) && typeof x === 'number' ? Math.round(x * k * 10) / 10 : x);
  return v; }
function m3Style(raw, trip) { const S = heStyle(), k = heTextScale(), st = JSON.parse(JSON.stringify(raw)), mh = PROVIDERS.mapterhorn;
  st.layers.forEach(l => { const p = l.paint = l.paint || {}, L2 = l.layout = l.layout || {};
    if (l.type === 'background') p['background-color'] = S.land;
    else if (l.type === 'raster') p['raster-opacity'] = S.dark ? 0.08 : 0.25;
    else if (l.type === 'fill' || l.type === 'fill-extrusion') { const f = M3_FILL.find(([re]) => re.test(l.id)); if (f && !p['fill-pattern']) { if (l.type === 'fill') { p['fill-color'] = S[f[1]]; delete p['fill-outline-color']; } else p['fill-extrusion-color'] = S[f[1]]; } }
    else if (l.type === 'line') { const c = m3LineColor(l, S); if (c) p['line-color'] = c; }
    else if (l.type === 'symbol' && L2['text-field']) { if (JSON.stringify(L2['text-field']).includes('name')) L2['text-field'] = ['coalesce', ['get', 'name:he'], ['get', 'name'], ['get', 'name:en']]; // vtName
      if (L2['text-size'] != null) L2['text-size'] = m3Size(L2['text-size'], k);
      p['text-color'] = /water/.test(l['source-layer']) ? S.waterLabel : l['source-layer'] === 'poi' ? S.poi : S.label; p['text-halo-color'] = S.halo; } });
  Object.values(st.sources).forEach(s => { if (s.tiles) s.tiles = s.tiles.map(m3Via); }); if (st.glyphs) st.glyphs = m3Via(st.glyphs);
  const dem = { type: 'raster-dem', tiles: [m3Via(mh.tiles)], tileSize: 512, maxzoom: 12, encoding: 'terrarium' }; // Q18: z12 of Mapterhorn's 512-px tiles is the data's depth (a sea tile 404s: flat)
  st.sources.m3dem = dem; st.sources.m3hs = { ...dem }; // the terrain and its hillshade from two sources, as the engine advises (and the tested page)
  st.sources.m3trip = { type: 'geojson', data: trip || { type: 'FeatureCollection', features: [] } };
  const at = st.layers.findIndex(l => l.type === 'symbol'), dash = ['==', ['get', 'd'], 1];
  st.layers.splice(at < 0 ? st.layers.length : at, 0,
    { id: 'm3-hs', type: 'hillshade', source: 'm3hs', paint: { 'hillshade-exaggeration': S.dark ? 0.55 : 0.45, 'hillshade-shadow-color': S.dark ? 'rgb(0,0,0)' : 'rgb(40,40,40)', 'hillshade-highlight-color': S.dark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.35)' } },
    { id: 'm3-case', type: 'line', source: 'm3trip', filter: ['!', dash], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': S.halo, 'line-width': ['+', ['get', 'w'], 3], 'line-opacity': ['get', 'o'] } },
    { id: 'm3-line', type: 'line', source: 'm3trip', filter: ['!', dash], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': ['get', 'c'], 'line-width': ['get', 'w'], 'line-opacity': ['get', 'o'] } },
    { id: 'm3-dash', type: 'line', source: 'm3trip', filter: dash, layout: { 'line-join': 'round' }, paint: { 'line-color': ['get', 'c'], 'line-width': ['get', 'w'], 'line-opacity': ['get', 'o'], 'line-dasharray': [2, 2] } });
  st.terrain = { source: 'm3dem', exaggeration: 1.5 };
  return st; }
// the trip on it, read from the 2D map: its lines (GeoJSON) and its pins (the 2D marker each stands for); never the measuring, 📚, bubbles or fans
const M3_SKIP = /disc-pin|clu-b|ms-pt|ms-seg|ms-ring-lbl/;
function m3Trip(map, id) { const feats = [], pins = [], seen = new Set(), meas = MEAS && MEAS.map === map ? new Set(MEAS.layers || []) : new Set();
  const pin = mk => { if (!mk || seen.has(mk) || meas.has(mk) || !mk.getLatLng) return; seen.add(mk); const ic = mk.options && mk.options.icon && mk.options.icon.options;
    if (!ic || !ic.html || M3_SKIP.test(ic.html) || mk._cluKeys) return; const ll = mk._fanOrig || mk.getLatLng(); pins.push({ mk, ll: [ll.lng, ll.lat], html: ic.html, size: ic.iconSize || [30, 30], anchor: ic.iconAnchor || [15, 15], z: mk.options.zIndexOffset || 0 }); };
  map.eachLayer(l => { if (meas.has(l)) return; if (l instanceof L.Marker) return pin(l);
    if (l instanceof L.Polyline && !/fan-leg|ms-/.test(l.options.className || '')) { const o = l.options, flat = a => (Array.isArray(a[0]) ? a : [a]).map(r => r.map(q => [q.lng, q.lat])), lls = l.getLatLngs(), parts = Array.isArray(lls[0]) ? lls : [lls];
      parts.forEach(pp => { const c = (Array.isArray(pp[0]) ? pp.flat() : pp).map(q => [q.lng, q.lat]); if (c.length > 1) feats.push({ type: 'Feature', properties: { c: o.color || '#3388ff', w: o.weight || 3, o: o.opacity == null ? 1 : o.opacity, d: o.dashArray ? 1 : 0 }, geometry: { type: 'LineString', coordinates: c } }); }); } });
  const clu = MAPS[id] && MAPS[id].clu; if (clu) clu.items.forEach(it => { if (!String(it.key).startsWith('disc:')) pin(it.m); }); // the pins a bubble holds in 2D stand on their own here
  return { lines: { type: 'FeatureCollection', features: feats }, pins }; }
function m3Pins(m3, pins, id) { return pins.sort((a, b) => a.z - b.z).map(P => { const el = document.createElement('div'); el.className = 'm3-pin'; el.append(...P.mk.options.icon.createIcon().childNodes); // the 2D pin's own markup, built by its icon
    el.style.width = P.size[0] + 'px'; el.style.height = P.size[1] + 'px';
    const mk = new maplibregl.Marker({ element: el, anchor: 'top-left', offset: [-P.anchor[0], -P.anchor[1]] }).setLngLat(P.ll).addTo(m3);
    if (P.mk.listens && P.mk.listens('click')) { el.classList.add('m3-tap'); el.dataset.act = 'm3.pin'; el._mk = P.mk; } // the one action mechanism (after the map's own click, which closed the card)
    return mk; }); }
act('m3.pin', c => { if (M3.id && c.el._mk) m3Tap(M3.id, c.el._mk, c.el); return 'quiet'; });
function m3Tap(id, mk, el) { document.querySelectorAll('.m3-pin.pin-sel').forEach(x => x.classList.remove('pin-sel')); el.classList.add('pin-sel'); mk.fire('click'); } // the 2D pin's own tap: the same floating card
// open and close
function m3Status(box, t, spin) { const s = box.querySelector('.m3-st'); if (!s) return; s.hidden = !t; s.textContent = t || '';
  if (t && spin) { const sp = document.createElement('span'); sp.className = 'spin'; sp.setAttribute('aria-hidden', 'true'); s.prepend(sp); } }
async function m3Open(id, cam) {
  const host = document.getElementById(id), r = MAPS[id]; if (!host || !r || M3.id) return; const why = m3Why(); if (why) { showToast(why); return; }
  M3.id = id; M3.l2 = r.map; M3.t0 = performance.now(); M3.last = null; closeFloatCard(id); host.classList.add('m3-on'); document.body.classList.add('m3-open');
  const box = document.createElement('div'); box.className = 'm3-box'; box.innerHTML = `<div class="m3-gl"></div><div class="m3-st" role="status"></div><div class="m3-cr">${svcCredit('openfreemap')}${SEP}${svcCredit('mapterhorn')}</div>
    <button type="button" class="m3-north" data-act="m3.north" aria-label="צפון למעלה" title="צפון למעלה">${msi('explore', { size: 20 })}</button>`;
  host.appendChild(box); m3Status(box, 'טוען תלת־ממד', true);
  const fail = t => { if (M3.id !== id) return; m3Close(); showToast(SY.warn + ' ' + t); };
  if (!(await m3Load())) return fail('תלת־ממד לא נטען - אולי אין רשת');
  let raw; try { raw = await m3StyleRaw(); } catch (e) { return fail('תלת־ממד לא נטען - המפה לא ענתה'); }
  if (M3.id !== id || !box.isConnected) return;
  const T = m3Trip(r.map, id), c = r.map.getCenter(), z = Math.max(1, r.map.getZoom() - 1); // a 256-px zoom is a 512-px zoom less one
  let m3; try { m3 = new maplibregl.Map({ container: box.querySelector('.m3-gl'), style: m3Style(raw, T.lines), center: cam ? cam.c : [c.lng, c.lat], zoom: cam ? cam.z : z, pitch: cam ? cam.p : 60, bearing: cam ? cam.b : 0, maxPitch: 75,
    attributionControl: false, pixelRatio: Math.min(window.devicePixelRatio || 1, 2), fadeDuration: 0 }); } // Q16: at most 2 - a phone's 3x screen would more than double the buffers
  catch (e) { return fail('תלת־ממד לא נפתח בטלפון הזה'); }
  M3.map = m3; M3.trip = T.lines; LIFE.gl.add(m3); m3.__pins = m3Pins(m3, T.pins, id);
  m3.on('click', () => { closeFloatCard(id); document.querySelectorAll('.m3-pin.pin-sel').forEach(x => x.classList.remove('pin-sel')); });
  m3.on('error', e => { if (e && (e.tile || e.sourceId)) return; if (M3.map === m3 && !m3.loaded()) m3Status(box, 'תלת־ממד לא נטען', false); }); // a missing tile (the sea) is no error
  m3.on('webglcontextlost', () => fail('הגרפיקה של הטלפון עצרה את התלת־ממד (זיכרון)')); // the engine's own event
  m3.once('idle', () => { if (M3.map !== m3) return; M3.last = { ms: Math.round(performance.now() - M3.t0), id }; m3Status(box, '', false); });
  m3.once('load', () => { if (M3.map === m3) m3Status(box, '', false); }); }
act('m3.north', () => { if (M3.map) M3.map.easeTo({ bearing: 0, duration: 500 }); return 'quiet'; }); // round6-behaviour (G105): north up, the tilt kept - a view from above has no value here
function m3Close() { const id = M3.id; if (!id) return; const m3 = M3.map; M3.id = null; M3.map = null; M3.l2 = null; M3.trip = null;
  if (m3) { (m3.__pins || []).forEach(p => { try { p.remove(); } catch (e) {} }); m3.__pins = null; try { m3.remove(); } catch (e) {} LIFE.gl.delete(m3); } // remove() releases the GPU context and its buffers
  document.body.classList.remove('m3-open'); const host = document.getElementById(id); if (host) { host.classList.remove('m3-on'); const box = host.querySelector(':scope > .m3-box'); if (box) box.remove(); }
  closeFloatCard(id); }
// the screen drawn again under the 3D view (a change saved from the card, say) disposes its 2D map: the 3D view closes with it and opens again on
// the new map with the same camera, once the screen is drawn (fsAfterRender) - the engine, the style and the tiles are already in
function m3Lost() { const m3 = M3.map, id = M3.id; let cam = null; try { if (m3) { const c = m3.getCenter(); cam = { c: [c.lng, c.lat], z: m3.getZoom(), p: m3.getPitch(), b: m3.getBearing() }; } } catch (e) {}
  m3Close(); if (id && FS && FS.id === id) M3.again = { id, cam, at: Date.now() }; }
function m3Again() { const a = M3.again; M3.again = null; if (!a || !FS || FS.id !== a.id || Date.now() - a.at > 5000) return;
  setTimeout(() => { if (FS && FS.id === a.id && !M3.id && MAPS[a.id]) m3Open(a.id, a.cam); }, 300); } // the pins are placed by then (their places are already found)
function m3ThemeChanged() { if (M3.map && M3.raw) try { M3.map.setStyle(m3Style(M3.raw, M3.trip)); } catch (e) {} } // the light or dark style follows the app
svcOnBack(m3SyncAll); sysOn(window, 'offline', m3SyncAll);

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
  const f = FS; FS = null; if (M3.id === f.id) groupFn('special-maps', 'm3Close')(); // map-3d: leaving full screen leaves 3D too
  fsBody(); fsSync(f.id);
  if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
  { const k = WIN_STACK.filter(e => e.key === 'fs').length; WIN_STACK = WIN_STACK.filter(e => e.key !== 'fs'); layerAppBack(fromPop ? k - 1 : k); } // 5.4.0
  if (f.id === 'mapView_screen' && activeTab === 'map') rerenderKeepingMap(); // the screen's map height was measured without the top bar
  else fsInvalidate(f.id);
}
function fsAfterRender() { // a re-render that left the full-screen map's screen ends full screen
  if (FS && !document.getElementById(FS.id)) { if (_sheetOpen) { FS = null; fsBody(); } else exitFS(); return; }
  if (FS) fsSync(FS.id);
  if (M3.again) groupFn('special-maps', 'm3Again')(); // map-3d: the screen was drawn again under the 3D view - it opens again on the new map
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
// Parts (diet-groups, 11.62.0): the engine, the style, the trip and open / close in js/map-3d.js (special-maps group); here the state M3, the offer and the menu's row. Before: here, in the full-screen map's part (a part of its own would join the parts' cycle); the menu's row (m3Row, from map.typeMenu in
// js/map-types.js), exitFS / mapDispose / pinTap (the lifecycle and the tap), css/maps.css; spec/map-component.md.
const M3 = { st: 'idle', ready: null, raw: null, map: null, id: null, l2: null, t0: 0, last: null, pend: null, again: null };
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
svcOnBack(m3SyncAll); sysOn(window, 'offline', m3SyncAll);

// ================= 5.9.0: ONE MAP COMPONENT (stage 1 of cl-maps-impl-plan; imvwfw0d4 decisions מ1-מ5) =================
// Every map in the app is born here: the box, ◎ and the status line, back to the same place (or first on all the points), the
// map type's tiles, ⛶ / 📏 / 📚 (regMap), clustering by the setting, the legend by the rule (only when its colors mean something
// not told elsewhere), and pins whose tap opens the floating card. A screen adds only what is its own. Tools (picking a point,
// the small map in an editor, the areas for offline maps, 🗺️ במפה) use mapTool - the same base map without a view.
// No screen calls L.map directly (a test scan checks it).
function mapTool(box, o) { o = o || {}; mapSweep(typeof box === 'string' ? document.getElementById(box) : box); const map = L.map(box, { zoomControl: screenAtLeast('wide'), attributionControl: false, ...(o.leaflet || {}) }); /* 5.15.0 (ד3): no ＋/− on a phone (pinch), the scale takes their corner; map-credit-line: Leaflet's corner off - the credit line below */
  const c = map.getContainer(); map.on('layeradd layerremove', e => { if (e.layer && e.layer.options && e.layer.options.crd) mapCrDraw(c); }); map.on('click', () => { if (MAPCR.host === c) mapCrClose(); });
  addBaseTiles(map); mapCrMount(c, () => mapCrOf(map)); if (o.twoFinger) mapTwoFinger(map, typeof box === 'string' ? document.getElementById(box) : box); return map; }
// ================= map-credit-line (decisions 2026-11-27 · The map's credits take over the map, Q1-Q5; standard ui-maps.md) =================
// Every live map's credits are one thin line at its bottom edge, in place of Leaflet's corner (off in mapTool): 12 px whatever the text size,
// the credits left to right, the short required names first (a row's `lead`, Esri's "Powered by", then OpenStreetMap's credit), cut with "…",
// ⓘ at its end. A tap opens "מקורות המפה" above it inside the map: every credit of what is drawn, a row each with its links (svcCredit -
// OSM's copyright page, "לתקן את המפה", OpenTopoMap's donation, Mapterhorn's list, Esri's), at the app's text size, scrolling inside. A second
// tap, ✕, a tap on the map, Back (a layer of the stack) or the map leaving the page closes it. Only what is drawn is credited: a layer carries
// its credit as crd ([provider, options], the base types' rows and the offline drawing's), and a layer with crNow() is credited only while it
// answers true (the offline drawing: no network). Leaflet's own name is in "מקורות ורישיונות" (TERMS_LIBS), not on the map. The 3D view mounts
// the same line on its own box (m3Open), a page for people gets it with the packed map component.
const MAPCR = { host: null }; // the box whose panel is open - one at a time
function mapCrOf(map) { const out = []; try { map.eachLayer(l => { const d = l.options && l.options.crd; if (d && !(l.crNow && !l.crNow())) out.push(d); }); } catch (e) {} return out; }
// the panel stands beside the map's own buttons (◎, the type): a map's box is isolated, so inside it the panel would lie under them
function mapCrMount(host, list) { if (!host.querySelector(':scope > .map-cr')) { const ln = document.createElement('button'), pn = document.createElement('div'), P = host.parentElement;
    ln.type = 'button'; ln.className = 'map-cr'; ln.dataset.act = 'map.cr'; ln.setAttribute('aria-expanded', 'false'); ln.setAttribute('aria-label', 'מקורות המפה'); ln.innerHTML = `<span class="map-cr-t" dir="ltr"></span>${msi('info')}`;
    pn.className = 'map-crp'; pn.hidden = true; pn.setAttribute('role', 'dialog'); pn.setAttribute('aria-label', 'מקורות המפה'); pn.innerHTML = `<div class="map-crp-h"><b>מקורות המפה</b><button type="button" class="map-crp-x" data-act="map.crX" aria-label="סגירה">${msi('close', { size: 20 })}</button></div><ul class="map-crp-l" dir="ltr"></ul>`;
    host.append(ln); (host.classList.contains('leaflet-container') && P && P !== document.body && /relative|absolute|fixed/.test(getComputedStyle(P).position) ? P : host).append(pn); host._crPn = pn; mapCtl(ln); mapCtl(pn); if (L.DomEvent && L.DomEvent.disableScrollPropagation) L.DomEvent.disableScrollPropagation(pn); }
  host._crList = list; mapCrDraw(host); }
// a map's rows: a row per credit of what is drawn; OpenStreetMap named inside another credit (Esri's labels) gets its own row with its copyright page
function mapCrDraw(host) { const ln = host && host._crList && host.querySelector(':scope > .map-cr'); if (!ln) return; const all = host._crList();
  const line = mapCrLine(all), seen = new Set(); ln.hidden = !all.length; ln.querySelector('.map-cr-t').textContent = line;
  let rows = all.filter(([p, o]) => { const k = p + ':' + ((o && o.as) || ''); return !seen.has(k) && seen.add(k); });
  if (line.includes(OSM_ATTR.t) && !rows.some(([p, o]) => svcCredit(p, o).includes(OSM_ATTR.u))) rows = rows.concat([['osm']]);
  host._crPn.querySelector('.map-crp-l').innerHTML = rows.map(([p, o]) => `<li>${svcCredit(p, o)}</li>`).join(''); }
// the line: every credit's parts (between SEPs) once, in three ranks - a row's lead part, then OpenStreetMap's credit (pulled out of a list that names
// it among others, as Esri's labels do), then the rest in the layers' order
function mapCrLine(all) { const U = [], seen = new Set(), O = OSM_ATTR.t, mid = ', ' + O;
  all.forEach(([p, o]) => { const A = PROVIDERS[p].attr, as = o && o.as; String(as ? A[as] : A.t).split(SEP).forEach((t, i) => { let r = A.lead && !as && !i ? 0 : 2;
    if (t.includes(mid)) { t = t.replace(mid, ''); U.push([1, O]); } else if (t.includes(O)) r = 1; U.push([r, t]); }); });
  return U.filter(u => !seen.has(u[1]) && seen.add(u[1])).sort((a, b) => a[0] - b[0]).map(u => u[1]).join(SEP); }
function mapCrOpen(host) { mapCrClose(); const ln = host.querySelector(':scope > .map-cr'), pn = host._crPn; if (!ln || !pn) return;
  MAPCR.host = host; mapCrDraw(host); pn.hidden = false; ln.setAttribute('aria-expanded', 'true'); document.body.classList.add('mapcr-open'); layerPush('mapcr', 'panel', fp => mapCrClose(fp)); }
function mapCrClose(fromPop) { const host = MAPCR.host; if (!host) return; MAPCR.host = null;
  const ln = host.querySelector(':scope > .map-cr'), pn = host._crPn; if (pn) pn.hidden = true; if (ln) ln.setAttribute('aria-expanded', 'false'); document.body.classList.remove('mapcr-open'); layerDone('mapcr', fromPop); }
act('map.cr', c => { const host = c.el.parentElement; if (MAPCR.host === host) mapCrClose(); else mapCrOpen(host); return 'quiet'; });
act('map.crX', () => { mapCrClose(); return 'quiet'; }); // the panel's ✕
// 10.11.0 (task memory-leak, decisions 2026-11-08 Q1): one lifecycle for every map. Every map is born in mapTool and listed in
// LIVE_MAPS; it is disposed - map.remove() and everything attached to it: its MAPS entry (markers, clusters and their timer), "מה יש כאן"
// (DISC_MAPS), the measuring's drawing, its ResizeObserver, the tiles' retry timers, the floating card, the legend and a form's
// fmLocMaps entry - when its container gets a new map (mapTool) or has left the page (mapSweep: on every draw of a screen, when a
// window closes and before any new map). A window's content kept aside for a moment (layerStash) is not "left".
function mapDispose(map) {
  if (!map || map._removed) return; map._removed = true; LIVE_MAPS.delete(map); { const cc = map.getContainer(); if (MAPCR.host === cc) mapCrClose(); if (cc._crPn && !cc.contains(cc._crPn)) cc._crPn.remove(); } // map-credit-line: leaving the map closes its panel, and the panel beside the box goes with it
  if (M3.l2 === map) groupFn('special-maps', 'm3Lost')(); // diet-groups: M3 is set only by its group // map-3d: the 3D view over it goes with it
  Object.keys(MAPS).forEach(id => { const r = MAPS[id]; if (r.map !== map) return; if (r.clu) clearTimeout(r.clu.t); delete MAPS[id];
    const host = document.getElementById(id); if (!host || !host.isConnected) { const lg = document.getElementById(id + '-legend'); if (lg) lg.remove(); } });
  Object.keys(DISC_MAPS).forEach(id => { const d = DISC_MAPS[id]; if (d.map === map) { DISC_LAST[id] = d.last; delete DISC_MAPS[id]; } });
  Object.keys(fmLocMaps).forEach(id => { if (fmLocMaps[id].map === map) delete fmLocMaps[id]; });
  if (MEAS && MEAS.map === map) { measWipe(MEAS); MEAS.map = null; } // the measurement itself follows its screen (measAfterRender)
  const c = map.getContainer(), fl = c && c.parentElement && c.parentElement.querySelector(':scope > .map-float'); if (fl && fl.parentElement.id) closeFloatCard(fl.parentElement.id);
  if (map._ro) { map._ro.disconnect(); map._ro = null; }
  if (map._ctlW) { map._ctlW.stop(); map._ctlW = null; } // 11.8.0: the edge arrows' watcher of the controls
  (map._baseLayers || []).forEach(l => clearTimeout(l._rtT));
  map._animatingZoom = false; // a zoom animation's own timer then does nothing
  try { map.stop(); map.remove(); map.off(); } catch (e) {}
  // a late call - geocoding, a route or a timer that was on its way when the map went - finds nothing to draw on and does nothing
  ['addLayer', 'removeLayer', 'setView', 'fitBounds', 'flyTo', 'panTo', 'panBy', 'panInside', 'setZoom', 'invalidateSize', 'addControl'].forEach(k => { map[k] = () => map; });
}
function mapSweep(inside) { LIVE_MAPS.forEach(m => { const c = m.getContainer();
  if (inside ? inside.contains(c) : !c.isConnected && !(_stash && _stash.frag.contains(c))) mapDispose(m); }); }
// 4.3.4 → 9.7.0 (Q10): a small map inside a scrolling form - one finger scrolls the form, two move and zoom the map (map._gest while
// they do); the end of a two-finger move counts as the map's own drag end. The map's own touch code, so it lives in the map component.
// phone-round-1-fixes P23 (11.14.0): the map follows the fingers live, the way the library's own pinch does - one move per frame through
// map._move (the tiles it has are moved and scaled), the zoom settled once at the end. Before, every touchmove was a setView without
// animation: any change of zoom (a pinch, or two fingers whose distance shifts a little) is a full reset that throws every tile away,
// so the map stood blank or stale until the fingers stopped and the tiles came back
function mapTwoFinger(map, box) { box.style.touchAction = 'pan-y'; let M = null; box.insertAdjacentHTML('beforeend', '<div class="map-gesture">' + msi('touch_double_2', { size: 18 }) + ' שתי אצבעות להזזה</div>'); // P23: an icon of two fingers (pinch drew one)
  const mid = t => ({ x: (t[0].clientX + t[1].clientX) / 2, y: (t[0].clientY + t[1].clientY) / 2 }), dist = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY) || 1;
  const live = !!(map._move && map._moveStart && map._moveEnd); // the library's own moving steps (not in a stand-in library: a setView per move there)
  box.addEventListener('touchstart', e => { if (e.touches.length !== 2) return; if (map._stop) map._stop(); const c = map.getCenter(); M = { c0: L.latLng ? L.latLng(c.lat, c.lng) : c, z0: map.getZoom(), m0: mid(e.touches), d0: dist(e.touches), raf: 0 }; map._gest = true; }, { passive: true });
  box.addEventListener('touchmove', e => { if (!M || e.touches.length !== 2) return; e.preventDefault(); const m = mid(e.touches), z = Math.max(3, Math.min(19, M.z0 + Math.log2(dist(e.touches) / M.d0)));
    const p = map.project(M.c0, z), q = L.point ? L.point(p.x - (m.x - M.m0.x), p.y - (m.y - M.m0.y)) : { x: p.x - (m.x - M.m0.x), y: p.y - (m.y - M.m0.y) }, c = map.unproject(q, z);
    M.c = c; M.z = z; if (!live) { map.setView(c, z, { animate: false }); M.moved = true; return; }
    if (!M.moved) { map._moveStart(true, false); M.moved = true; }
    if (!M.raf) M.raf = requestAnimationFrame(() => { if (!M) return; M.raf = 0; map._move(M.c, M.z, { pinch: true, round: false }); }); }, { passive: false });
  const end = e => { if (!M || (e.touches && e.touches.length >= 2)) return; const g = M; M = null; map._gest = false; if (g.raf) cancelAnimationFrame(g.raf); if (!g.moved) return;
    if (live) { map._move(g.c, g.z, { pinch: true, round: false }); const z = map._limitZoom(Math.round(g.z));
      if (map._zoomAnimated && z !== g.z) map._animateZoom(g.c, z, true, true); else if (z !== g.z) map._resetView(g.c, z); else map._moveEnd(true); } // the zoom settled on a whole step, as the library's own pinch ends
    else map.setView(map.getCenter(), Math.round(map.getZoom()), { animate: false });
    map.fire('dragend'); };
  box.addEventListener('touchend', end); box.addEventListener('touchcancel', end); }
function mapMake(containerId, o) {
  o = o || {}; const el = document.getElementById(containerId); if (!el) return null;
  if (!leafGate(el, o.again || (() => redrawSoon()))) return null; // 11.29.0 (launch-fast): the library may still be on its way - the screen (and its window) is drawn again once it is in
  { const old = document.getElementById(containerId + '-legend'); if (old) old.remove(); }
  if (o.legend) el.insertAdjacentHTML('afterend', `<div class="map-legend" id="${containerId}-legend">${o.legend}</div>`);
  el.innerHTML = `<div id="${containerId}-leaflet" style="height:100%"></div>${locateMeButtonHTML(containerId)}${o.loading === false ? '' : `<div class="map-status" id="${containerId}-loading" hidden></div>`}`; // 7.1.0 (ש10): the one status line, shown when there is something to wait for
  const restore = o.restore !== undefined ? o.restore : takeMapRestore(containerId); // 4.33.0: taken first, so the map is born where it was
  const map = mapTool(containerId + '-leaflet');
  if (restore) map.setView(restore.center, restore.zoom); else map.setView(o.center || curDest().meta.center, o.zoom || 13);
  if (o.register !== false) regMap(containerId, map);
  if (o.clusters) cluEnableFull(containerId);
  if (o.addHere) map.on('contextmenu', e => openPlaceEditor({ coord: { lat: e.latlng.lat, lng: e.latlng.lng } }));
  if (o.track !== false) { trackMapView(map, containerId); if (o.restore === undefined) applyMapRestore(map, restore, containerId, o.card); }
  locateBridge(containerId, map); addSelfLocationMarker(map);
  const M = { id: containerId, el, map, restore, card: o.card, bounds: [], placed: 0 };
  M.progress = (done, total) => mapStatusLine(containerId, done, total);
  // a pin: its tap is the floating card (or the screen's own onTap); the map widens to it until the first view is set
  M.pin = (p, coord, iconOpts, onTap) => { const mk = L.marker([coord.lat, coord.lng], { icon: pinDivIcon(p, iconOpts) }).addTo(map);
    mk.on('click', () => pinTap(containerId, p.id) || (onTap ? onTap(p) : showMapCard(containerId, o.card, p))); regMarker(containerId, p.id, mk); return mk; };
  M.grow = coord => { M.bounds.push([coord.lat, coord.lng]); M.placed++; if (!restore && (M.placed === 1 || M.placed % 5 === 0)) map.fitBounds(M.bounds, { padding: [30, 30], maxZoom: 16 }); };
  M.finish = empty => { const l = document.getElementById(containerId + '-loading'); if (l) l.remove();
    if (!M.bounds.length) { if (empty) el.insertAdjacentHTML('beforeend', `<div class="map-empty-msg">${empty}</div>`); }
    else if (!restore) map.fitBounds(M.bounds, { padding: [30, 30], maxZoom: 16 }); };
  return M;
}
// 7.1.0 (ש10): "📍 12 מתוך 40 על המפה" on a map while addresses are found - the one component; a tap explains (once, kept)
function mapStatusLine(containerId, done, total) { const l = document.getElementById(containerId + '-loading'); if (!l) return;
  const h = svcLine(containerId + '-ln', 'geocode', done, total, null, { gaveUp: svcGaveUpCount('geocode') }); l.innerHTML = h; l.hidden = !h; if (!l._ctl && l.closest('.leaflet-container, [id$="-leaflet"]') === null) { l._ctl = 1; try { mapCtl(l); } catch (e) {} } }
function renderPointsMap(containerId, cardContainerId, points, opts) {
  opts = opts || {};
  { const hs = hotelMarks().map(h => h.id); points = points.filter(p => !hs.includes(p.id)); } // emphasized hotels get their own marker
  const ids = new Set(points.map(p => p.layer)), ls = LAYER_DEFS.filter(l => ids.has(l.id)); // 4.3.0: no legend where the layer chips are the legend
  const M = mapMake(containerId, { card: cardContainerId, clusters: true, addHere: containerId === 'mapView_screen',
    legend: ls.length > 1 && !opts.chips ? ls.map(l => `<span><i style="background:${l.color}"></i>${escH(l.label)}</span>`).join('') : '' });
  if (!M) return; const map = M.map;
  if (opts.emptyMsg) M.el.insertAdjacentHTML('beforeend', `<div class="map-empty-msg">${opts.emptyMsg}</div>`);
  const hotelReady = addHotelMarker(map, M.bounds, containerId);
  const pointsReady = ensureGeocoded(points, M.progress, (p, coord) => { if (!coord) return; M.pin(p, coord); M.grow(coord); });
  Promise.all([hotelReady, pointsReady]).then(() => { M.finish(opts.emptyMsg ? '' : 'לא נמצאו מיקומים להצגה'); });
}
// 5.9.0 (decision מ2): a day of the plan is the days view with one day - the same code as the days on the map screen
function renderItineraryMap(containerId, cardContainerId, dayData) { renderDaysMap(containerId, cardContainerId, null, [containerId.replace('mapView_day_', '')]); }
let _geocodingForSort = false;
function maybeGeocodeForSort(pts) {
  if (FP.sort !== 'near' || _geocodingForSort) return;
  const needsGeocode = pts.some(p => !(p.address in GEOCODE_CACHE));
  if (!needsGeocode) return;
  _geocodingForSort = true;
  ensureGeocoded(pts).then(() => { _geocodingForSort = false; render(); });
}

function sortPoints(pts) { // 4.12.0: ✓ visited places last when the setting says so (stable)
  const out = sortPointsBase(pts);
  return prefs().visited === 'end' ? out.filter(p => !STATE.visited.has(p.id)).concat(out.filter(p => STATE.visited.has(p.id))) : out;
}
function sortPointsBase(pts) {
  const arr = [...pts];
  if (FP.sort === 'alpha') {
    arr.sort((a,b) => placeLabel(a).localeCompare(placeLabel(b), 'he'));
    return arr;
  }
  if (FP.sort === 'near' && userPos) {
    const withDist = (list) => list.map(p => {
      const c = GEOCODE_CACHE[p.address];
      const d = c ? distanceKm(userPos, c) : Infinity;
      return {p, d};
    }).sort((a,b) => a.d - b.d).map(x => x.p);
    const favs = withDist(arr.filter(p => STATE.favorites.has(p.id)));
    const rest = withDist(arr.filter(p => !STATE.favorites.has(p.id)));
    return [...favs, ...rest];
  }
  const favs = arr.filter(p => STATE.favorites.has(p.id)).sort((a,b) => placeLabel(a).localeCompare(placeLabel(b),'he'));
  const rest = arr.filter(p => !STATE.favorites.has(p.id)).sort((a,b) => placeLabel(a).localeCompare(placeLabel(b),'he'));
  return [...favs, ...rest];
}

function navUrl(address) {
  return 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(address);
}
// big-dest-search item 8 (decisions 2026-11-26 · Review of `name-lead`, Q2): a place is searched on Google by the name on its sign - its
// local name when it has one (placeForeign), else its name; the address as before
function googlePlaceUrl(p) { return googleInfoUrl(placeForeign(p) || p.name, p.address); }
function googleInfoUrl(name, address) {
  return 'https://www.google.com/search?q=' + encodeURIComponent(name + ' ' + address);
}

// reservationClass lives in js/booking-price.js since 11.42.0 (it reads the booking choice, not the text)

function copyWithFallback(text, successMsg) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(
      () => showToast(successMsg),
      () => copyViaTextarea(text, successMsg)
    );
  } else {
    copyViaTextarea(text, successMsg);
  }
}
function copyViaTextarea(text, successMsg) {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus(); ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    if (ok) showToast(successMsg);
    else showToast('ההעתקה נכשלה - סמנו והעתיקו ידנית');
  } catch (e) {
    showToast('ההעתקה נכשלה - סמנו והעתיקו ידנית');
  }
}
function copyAddress(address, btn) {
  copyWithFallback(address, 'הכתובת הועתקה');
}

// diet-room: the map of a page for people, packed from this component (fileMapView, fmapPack, fmapCSS, FMAP_*), is js/map-pack.js - the
// pages group, with the page's icon subset (generated/ms-font-page.js) and the recommendations' page
// 11.4.0 (the 11.2.0 review's Q3; standard ui-maps.md "Points outside a map's frame"): the maps' one live edge arrow. A map framed on part
// of its points shows, for each point outside the view, an arrow on the frame's edge where its line leaves (from near - the line's other
// end, or the frame's centre - toward the point; from the view's centre when near is out of view too), named "<name> · N ק״מ"; moved as
// the map moves, hidden while the point is in view (or when it would sit on another arrow); a tap fits it (fit: the points to show).
// items: [{ c, near, name, km, fit }]; cls: the arrow's kind (tv-edge - a travel's far end on the day map, in the travel tone; none - a far place of a
// memory: the neutral look). Returns the update function (already bound to the map's moves).
// 11.6.0 (the 11.4.0 review's Q6; standard ui-maps.md): an arrow never sits on or beside one of the map's controls. The controls' areas
// (mapCtlAreas) are read on every update: one that spans most of an edge (a mode's banner on top, the credit line under a narrow map)
// moves that edge of the arrows' frame in; any other (◎, full screen, the map type, measuring, "מה יש כאן", the scale) is an area an
// arrow slides out of - along the frame's edge, around a corner when the edge is taken, to the nearest free place - and it then points
// from where it stands to its point. With no free place it is not shown.
const EDGE = { ins: 26, top: 10, bottom: 30, ar: 15, lbTop: 19, pad: 6, strip: 2, apart: 40, step: 4, near: 120 }; // px: the frame's inset (more on top and at the bottom: the name hangs under the arrow), the arrow's half size, the name's offset under it, the room kept from a control / from a strip, between two arrows, the slide's step, how far a slide looks for a place off the other arrows' names before it settles for apart from them
function mapCtlAreas(map) { const cr = map.getContainer().getBoundingClientRect(), out = [];
  mapCtlEls(map).forEach(e => { const st = getComputedStyle(e); if (st.display === 'none' || st.visibility === 'hidden') return; const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return;
    const a = { l: r.left - cr.left, t: r.top - cr.top, r: r.right - cr.left, b: r.bottom - cr.top }; if (a.r > 0 && a.l < cr.width && a.b > 0 && a.t < cr.height) out.push(a); }); // the app's buttons and a mode's banner lie over the map as its neighbours
  return out; }
function mapEdgeArrows(map, items, cls) { if (!items.length || map._removed) return () => {}; const mks = []; let pane = null;
  try { if (!map.getPane('edgeArrows')) { map.createPane('edgeArrows'); map.getPane('edgeArrows').style.zIndex = 660; } pane = 'edgeArrows'; } catch (e) {} // above every pin and dot (the memory's places sit in a pane over the markers), so an arrow that slid among them keeps its name whole
  const upd = () => { let vb; try { vb = map.getBounds(); } catch (e) { return; } const sz = map.getSize(), used = [], lh0 = Math.max(0, ...mks.map(m => (m && m._lh) || 0)) || 22;
    let F = { l: EDGE.ins, r: sz.x - EDGE.ins, t: EDGE.ins + EDGE.top, b: sz.y - EDGE.ins - EDGE.bottom }; const F0 = { ...F }, obs = [];
    mapCtlAreas(map).forEach(a => { const wide = a.r - a.l >= sz.x * .5, tall = a.b - a.t >= sz.y * .5; // a strip along an edge moves the frame in; anything else is slid out of
      if (wide && !tall) { if ((a.t + a.b) / 2 < sz.y / 2) F.t = Math.max(F.t, a.b + EDGE.strip + EDGE.ar); else F.b = Math.min(F.b, a.t - EDGE.strip - EDGE.lbTop - lh0); }
      else if (tall && !wide) { if ((a.l + a.r) / 2 < sz.x / 2) F.l = Math.max(F.l, a.r + EDGE.strip + EDGE.ar); else F.r = Math.min(F.r, a.l - EDGE.strip - EDGE.ar); }
      else obs.push({ l: a.l - EDGE.pad, t: a.t - EDGE.pad, r: a.r + EDGE.pad, b: a.b + EDGE.pad }); });
    if (F.r - F.l < 40 || F.b - F.t < 40) F = F0; const W = F.r - F.l, H = F.b - F.t, P = 2 * (W + H);
    const at = q => { q = ((q % P) + P) % P; return q < W ? [F.l + q, F.t] : q < W + H ? [F.r, F.t + q - W] : q < 2 * W + H ? [F.r - (q - W - H), F.b] : [F.l, F.b - (q - 2 * W - H)]; }; // along the frame, clockwise from its top left
    const of = (x, y) => { const d = [y - F.t, F.r - x, F.b - y, x - F.l], e = d.indexOf(Math.min(...d)); return e === 0 ? x - F.l : e === 1 ? W + y - F.t : e === 2 ? W + H + F.r - x : 2 * W + H + F.b - y; };
    const hits = (b, o) => b.l < o.r && b.r > o.l && b.t < o.b && b.b > o.t;
    const boxes = (x, y, lw, lh) => { const lx = Math.max(4, Math.min(x - lw / 2, sz.x - 4 - lw)); return [{ l: x - EDGE.ar, t: y - EDGE.ar, r: x + EDGE.ar, b: y + EDGE.ar }, { l: lx, t: y + EDGE.lbTop, r: lx + lw, b: y + EDGE.lbTop + lh }]; }; // the arrow and its name under it
    const free = (x, y, lw, lh, slide) => { const bs = boxes(x, y, lw, lh); // clear of every control; an arrow that slides also keeps off the arrows already standing - 2: off them and their names, 1 (a crowded frame): apart from them
      return !obs.some(o => bs.some(b => hits(b, o))) && !(slide && used.some(u => Math.hypot(u.x - x, u.y - y) < EDGE.apart || (slide > 1 && u.bs.some(o => bs.some(b => hits(b, o)))))); };
    const nat = [], late = []; // two rounds: the arrows whose own place is free stand first, then the ones that slide find a place among them
    const place = (it, i, slide) => { let mk = mks[i]; const inView = vb.contains([it.c.lat, it.c.lng]), hide = () => { if (mk) mk.setOpacity(0); if (mk && mk._icon) mk._icon.style.pointerEvents = 'none'; };
      const p1 = map.latLngToContainerPoint([it.c.lat, it.c.lng]), p0n = map.latLngToContainerPoint([it.near.lat, it.near.lng]), p0 = vb.contains([it.near.lat, it.near.lng]) ? p0n : L.point(sz.x / 2, sz.y / 2);
      const dx = p1.x - p0.x, dy = p1.y - p0.y; let k = 1; [[F.l - p0.x, dx], [F.r - p0.x, dx]].forEach(([n, d]) => { if (d) { const q = n / d; if (q > 0 && q < k) k = q; } });
      [[F.t - p0.y, dy], [F.b - p0.y, dy]].forEach(([n, d]) => { if (d) { const q = n / d; if (q > 0 && q < k) k = q; } });
      let ex = p0.x + dx * k, ey = p0.y + dy * k;
      if (!slide) { const clash = nat.some(([a, b]) => Math.hypot(a - ex, b - ey) < EDGE.apart); if (inView || clash || (!dx && !dy)) { hide(); return; } nat.push([ex, ey]); } // two points the same way are one arrow, as before
      const lb = `${escH(it.name)}${SEP}${fmtKm(it.km)}`;
      if (!mk) { mk = mks[i] = L.marker(map.containerPointToLatLng([ex, ey]), { zIndexOffset: 1800, keyboard: false, ...(pane ? { pane } : {}), icon: L.divIcon({ className: '', iconSize: [0, 0], html: `<div class="map-edge ${cls || ''}" role="button" aria-label="${lb}"><span class="map-edge-ar"><svg width="16" height="16" viewBox="-12 -12 24 24" aria-hidden="true"><path d="M10 0 L-6 -8 L-2 0 L-6 8 Z"/></svg></span><span class="map-edge-lb" dir="auto">${lb}</span></div>` }) }).addTo(map);
        mk.on('click', () => { try { map.fitBounds(L.latLngBounds(it.fit), { padding: [40, 40], maxZoom: 14 }); } catch (e) {} }); }
      const lbl = mk._icon && mk._icon.querySelector('.map-edge-lb'); if (lbl && !mk._lw) { mk._lw = lbl.offsetWidth; mk._lh = lbl.offsetHeight; } // the name's size (its text never changes)
      const lw = mk._lw || 90, lh = mk._lh || 22; let ang = Math.atan2(dy, dx) * 180 / Math.PI;
      if (!free(ex, ey, lw, lh, slide ? 2 : 0)) { if (!slide) { late.push([it, i]); return; } const q0 = of(Math.max(F.l, Math.min(ex, F.r)), Math.max(F.t, Math.min(ey, F.b))); let to = null; // out of a control's area: the nearest free place along the frame
        for (const how of [2, 1]) { for (let d = EDGE.step; d <= (how > 1 ? EDGE.near : P / 2) && !to; d += EDGE.step) for (const g of [d, -d]) { const [x, y] = at(q0 + g); if (free(x, y, lw, lh, how)) { to = [x, y]; break; } } if (to) break; }
        if (!to) { hide(); return; } [ex, ey] = to; ang = Math.atan2(p1.y - ey, p1.x - ex) * 180 / Math.PI; } // still pointing at its point
      used.push({ x: ex, y: ey, bs: boxes(ex, ey, lw, lh) }); mk.setLatLng(map.containerPointToLatLng([ex, ey]));
      mk.setOpacity(1); if (mk._icon) { mk._icon.style.pointerEvents = ''; const ar = mk._icon.querySelector('.map-edge-ar'); if (ar) ar.style.transform = `rotate(${ang.toFixed(1)}deg)`;
        if (lbl) { lbl.style.transform = ''; const cr = map.getContainer().getBoundingClientRect(), r = lbl.getBoundingClientRect(); // the name stays inside the map
          const sh = r.left < cr.left + 4 ? cr.left + 4 - r.left : r.right > cr.right - 4 ? cr.right - 4 - r.right : 0; if (sh) lbl.style.transform = `translateX(${sh.toFixed(0)}px)`; } } };
    items.forEach((it, i) => place(it, i, false)); late.forEach(([it, i]) => place(it, i, true)); };
  map.on('moveend zoomend resize', upd); mapCtlWatch(map, upd); upd(); return upd; }
// 11.8.0 (task travels-7-followups, the 11.6.0 review's miss a): the arrows are placed again whenever the controls' areas change - a
// mode's banner opens or closes, ◎ appears or goes, a control changes size - not only when the map moves, zooms or resizes. One
// watcher per map (map._ctlW, disposed with the map): a MutationObserver on the map's box and its host (a control added or removed)
// and on each control (its class, style or hidden), and a ResizeObserver on each control (its size); a change runs the map's
// listeners once on the next frame. The map's own moves stay with the map's events.
function mapCtlEls(map) { const c = map.getContainer(), host = c.parentElement, over = e => !/leaflet-(pane|control-container)|map-float/.test(e.className || '') && /absolute|fixed/.test(getComputedStyle(e).position);
  return [...c.querySelectorAll('.leaflet-control'), ...[...c.children].filter(over), ...(host ? [...host.children].filter(e => e !== c && over(e)) : [])]; }
function mapCtlWatch(map, fn) { if (map._removed) return; if (map._ctlW) { // a late call (a route's answer after a redraw) on a disposed map makes no watcher
   map._ctlW.fns.push(fn); return; } const c = map.getContainer(), host = c.parentElement; if (!window.MutationObserver) return;
  let raf = 0; const seen = new WeakSet(), kick = () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; if (map._removed || !c.isConnected) return; W.scan(); W.fns.forEach(f => { try { f(); } catch (e) {} }); }); };
  const W = map._ctlW = { fns: [fn], mo: new MutationObserver(kick), ro: window.ResizeObserver ? new ResizeObserver(kick) : null,
    scan: () => mapCtlEls(map).forEach(e => { if (seen.has(e)) return; seen.add(e); W.mo.observe(e, { attributes: true, attributeFilter: ['class', 'style', 'hidden'] }); if (W.ro) W.ro.observe(e); }),
    stop: () => { cancelAnimationFrame(raf); W.mo.disconnect(); if (W.ro) W.ro.disconnect(); W.fns = []; } };
  W.mo.observe(c, { childList: true }); if (host) W.mo.observe(host, { childList: true }); W.scan(); map.once('unload', () => { if (map._ctlW === W) { W.stop(); map._ctlW = null; } }); } // stopped with the map however it is removed (mapDispose, or the library's own remove)

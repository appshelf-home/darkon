// ================= 4.31.0: MAP TOOLS - 📏 MEASURING, PIN CLUSTERING / FAN =================
// 📏 on every browsing map (map, days, plan, route map, 📚, draft), under ⛶ and the map type. Two ways in:
//  - 📏 itself: a ruler - every tap on the map adds a point (a tap on a pin snaps to the place and shows its name), each leg
//    has its distance, the bar on top the total and a walking time. Points can be dragged, ↩️ removes the last, ✕ ends.
//  - "📏 מדידה מכאן" in a pin's card or details: the place becomes the reference - rings of 10/20/30 minutes' walk, every
//    card shows the distance from it, and the 📍 נקודות list is sorted by distance from it while measuring.
// ◎ inside the measuring starts it from my location (as reference, the rings follow me). The measurement is temporary:
// it stays while the map screen is open (also through the list and back); leaving the screen, ✕ or Back clear it.
// Distance is a straight line; time is the planning rule (× 1.3 for the streets, the walking pace from ⚙️ 🎛️).
let MEAS = null; // { id, mode: 'ruler' | 'ref', pts: [{ ll:{lat,lng}, name, me }], depth, layers: [], map }
function measSpeed() { return WALK_SPEED[prefs().walk] || WALK_SPEED.normal; }
function measTime(km, plain) { // km in a straight line -> "≈ 12 דק׳" walking (or the road distance by car beyond the walking distance of the setting); 10.10.0: line icons, none in the banner's title (plain)
  const road = km * 1.3, max = parseFloat(prefs().walkMax) || 2.5, ic = (k, w) => plain ? w : msiT(k, w, { size: 16 }); // size-fixes-2 (2): the icon tied to its word (msiT) - the walk is mirrored
  // value-tie-source: the estimate is one value - "≈", its icon, the number and its unit never part (.est-v: no wrap inside; the formatters tie the unit)
  if (road <= max) return `<span class="est est-v est-tip sym-tip" data-act="tip" data-v="sym.est">≈\u00A0${ic('directions_walk', tmFmt('dur', Math.max(1, Math.round(road / measSpeed() * 60))))}</span>`;
  return `<span class="est est-v est-tip sym-tip" data-act="tip" data-v="sym.est">≈\u00A0${ic('directions_car', fmtKm(road))}${plain ? ' ברכב' : ''}</span>`;
}
function measKm(pts) { let km = 0; for (let i = 1; i < pts.length; i++) km += distanceKm(pts[i - 1].ll, pts[i].ll); return km; }
function measRefName() { const a = MEAS && MEAS.pts[0]; return !a ? '' : a.me ? 'המיקום שלי' : (a.name || 'המיקום'); }
function measFrom(ll) { // "1.2 ק״מ · ≈ 20 דק׳ מ-…" for a card, while measuring from a reference (10.10.0: the mode's line icon)
  if (!MEAS || !MEAS.pts.length || !ll) return ''; const km = distanceKm(MEAS.pts[0].ll, ll);
  return `${msiT('track_changes', fmtKm(km), { size: 16 })}${SEP}${measTime(km)} מ${measRefName() === 'המיקום שלי' ? 'המיקום שלי' : '-' + _escH(measRefName())}`; // value-tie-source: the parts joined by SEP, each value whole
}
function measActiveOn(id) { return !!(MEAS && MEAS.id === id); }
function measStart(id, mode, first, reuseEntry) {
  const r = MAPS[id]; if (!r) return;
  if (MEAS && MEAS.id !== id) measClear();
  closeFloatCard(id);
  // 4.33.0: from the details dialog the measuring takes over the dialog's history entry (closing the dialog with a Back and
  // pushing a new entry in the same moment lost the entry, so ✕ then left the app)
  if (!MEAS) { MEAS = { id, mode, pts: [], depth: 1, layers: [] }; layerPush('meas', 'mode', fp => measClear(fp)); } // 5.4.0: one entry on the stack (the window it came from stays under it)
  MEAS.mode = mode; MEAS.map = r.map; if (first) MEAS.pts = [first];
  document.body.classList.add('meas-on'); measDraw();
  if (mode === 'ruler' && !MEAS.pts.length) showToast(('נוגעים במפה כדי להוסיף נקודות' + SEP + 'נגיעה בסיכה נצמדת למקום'));
}
function measClear(fromPop) {
  if (!MEAS) return; const m = MEAS; MEAS = null;
  measWipe(m); document.body.classList.remove('meas-on');
  const host = document.getElementById(m.id), bar = host && host.querySelector(':scope > .ms-bar'); if (bar) bar.remove(); if (host) host.classList.remove('meas-host');
  document.querySelectorAll('.ms-btn').forEach(b => b.dataset.active = 'false');
  layerDone('meas', fromPop);
  if (activeTab === 'all' && m.id === 'mapView_screen') render(); // the list leaves the distance order
}
function measWipe(m) { (m.layers || []).forEach(l => { try { m.map.removeLayer(l); } catch (e) {} }); m.layers = []; }
function measAddPoint(ll, name) {
  if (!MEAS) return; MEAS.pts.push({ ll: { lat: ll.lat, lng: ll.lng }, name: name || '' });
  if (MEAS.mode === 'ref' && MEAS.pts.length > 1) MEAS.mode = 'ruler';
  measDraw(); buzz('light');
}
function measUndo() { if (!MEAS || !MEAS.pts.length) return; MEAS.pts.pop(); measDraw(); }
function measDraw() {
  const m = MEAS; if (!m) return; const r = MAPS[m.id]; if (!r) return; m.map = r.map; measWipe(m);
  const map = m.map, pts = m.pts, add = l => { l.addTo(map); m.layers.push(l); return l; };
  if (m.mode === 'ref' && pts.length) { // rings of walking time around the reference (straight-line equivalent of the minutes)
    const c = pts[0].ll, sp = measSpeed();
    [10, 20, 30].forEach(min => { const rad = sp * min / 60 / 1.3 * 1000;
      add(L.circle([c.lat, c.lng], { radius: rad, className: 'ms-ring', color: '#2563EB', weight: 1.5, opacity: .75, fill: false, dashArray: '4 5', interactive: false }));
      const lab = L.latLng(c.lat + rad / 111320, c.lng);
      add(L.marker(lab, { icon: L.divIcon({ className: '', html: `<div class="ms-ring-lbl">≈\u00A0${tmFmt('dur', min)}</div>`, iconSize: [46, 18], iconAnchor: [23, 9] }), interactive: false, zIndexOffset: 900 }));
    });
  }
  if (pts.length > 1) { if (m.road) measRoadLines(add); else add(L.polyline(pts.map(p => [p.ll.lat, p.ll.lng]), { className: 'ms-line', color: '#2563EB', weight: 3, opacity: .9, interactive: false })); }
  for (let i = 1; i < pts.length; i++) { const a = pts[i - 1].ll, b = pts[i].ll;
    add(L.marker([(a.lat + b.lat) / 2, (a.lng + b.lng) / 2], { icon: L.divIcon({ className: '', html: `<div class="ms-seg">${fmtKm(distanceKm(a, b))}</div>`, iconSize: [64, 18], iconAnchor: [32, 9] }), interactive: false, zIndexOffset: 950 })); }
  pts.forEach((p, i) => { const mk = add(L.marker([p.ll.lat, p.ll.lng], { draggable: !p.me, zIndexOffset: 2000,
      icon: L.divIcon({ className: '', html: `<div class="ms-pt${i ? '' : ' first'}${p.me ? ' me' : ''}">${p.name ? `<b>${escH(p.name)}</b>` : ''}</div>`, iconSize: [16, 16], iconAnchor: [8, 8] }) }));
    mk.on('drag', e => { const ll = (e && e.latlng) || mk.getLatLng(); p.ll = { lat: ll.lat, lng: ll.lng }; p.name = ''; measBar(); });
    mk.on('dragend', () => measDraw());
    mk.on('click', e => { if (e && e.originalEvent && L.DomEvent) L.DomEvent.stopPropagation(e.originalEvent); }); });
  measBar();
  document.querySelectorAll('.ms-btn').forEach(b => b.dataset.active = String(b.closest('#' + CSS.escape(m.id)) != null));
}
// 10.10.0 (design-maps, gap 7, design-gaps Q3): the map's mode banner, built like the "מה יש כאן" banner in the secondary container -
// the mode's icon, a title and a supporting line, ⓘ, ✕ alone at the end; rings / ruler as a segmented button and "הסרת נקודה" (a measuring point is "נקודה" - the owner, 8.11.2026; the undo icon as drawn, not mirrored);
// in the ruler the way as one segmented button of four (offline the three road ways dimmed). The map's side buttons move under it.
const MEAS_WAYS = [['air', 'straighten', 'קו אוויר'], ['walk', 'directions_walk', 'ברגל'], ['transit', 'directions_transit', 'תחבורה'], ['car', 'directions_car', 'רכב']];
function measSegN(k) { return k === 1 ? 'קטע אחד' : k + ' קטעים'; }
function measBar() {
  const m = MEAS; if (!m) return; const host = document.getElementById(m.id); if (!host) return;
  let bar = host.querySelector(':scope > .ms-bar');
  if (!bar) { bar = document.createElement('div'); bar.className = 'ms-bar'; host.appendChild(bar); mapCtl(bar); }
  const n = m.pts.length, way = m.road || 'air', wayW = (MEAS_WAYS.find(w => w[0] === way) || MEAS_WAYS[0])[2]; let t, l;
  if (m.mode === 'ref') { t = n ? `מודדים מ${m.pts[0].me ? 'המיקום שלי' : '-' + _escH(measRefName())}` : 'מדידה'; l = ('טבעות של 10' + SEP + '20' + SEP + '30\u00A0דק׳ הליכה'); }
  else if (n < 2) { t = n ? 'נוגעים בנקודה הבאה' : 'נוגעים במפה כדי למדוד'; l = m.road ? wayW + ' לפי הדרכים' : wayW; }
  else if (m.road) ({ t, l } = measRoadText());
  else { const km = measKm(m.pts); t = `<b>${fmtKm(km)}</b>${SEP}${measTime(km, true)}`; l = `קו אוויר${SEP}${measSegN(n - 1)}`; }
  const btn = (v, ic, label, on, cls) => `<button type="button" data-act="map.measBar" data-v="${v}"${on != null ? ` data-active="${on}" aria-pressed="${on}"` : ''}${cls ? ` class="${cls}"` : ''} aria-label="${label}" title="${label}">${ic}</button>`;
  const sw = n ? `<div class="view-toggle seg ms-seg" role="group">${btn('ring', msi('track_changes', { size: 20 }), 'טבעות זמן הליכה', m.mode === 'ref')}${btn('ruler', msi('polyline', { size: 20 }), 'סרגל', m.mode === 'ruler')}</div>` : '';
  const un = m.mode === 'ruler' && n ? `<button type="button" class="ms-undo" data-act="map.measBar" data-v="undo">${msi('undo', { size: 18 })}הסרת נקודה</button>` : '';
  const ways = m.mode === 'ruler' ? `<div class="ms-row"><div class="view-toggle seg ms-ways" role="group">${MEAS_WAYS.map(([k, ic, w]) => `<button type="button" data-act="map.measBar" data-v="rw:${k}" data-active="${way === k}" aria-pressed="${way === k}"${k !== 'air' && !navigator.onLine ? ' class="off"' : ''}>${msi(ic, { size: 18 })}${w}</button>`).join('')}</div></div>` : '';
  bar.innerHTML = `<div class="ms-top">${msi(m.mode === 'ref' ? 'track_changes' : 'polyline', { size: 22, cls: 'ms-ic' })}<span class="ms-tt"><span class="ms-t">${sepTie(numTie(t))}</span><small>${sepTie(l)}</small></span>${tipI('meas.mode')}${btn('x', msi('close'), 'סיום המדידה', null, 'ms-x')}</div>${sw || un ? `<div class="ms-row">${sw}${un}</div>` : ''}${ways}`;
  measWaysFit(bar);
  host.classList.add('meas-host'); const fb = host.querySelector(':scope > .fs-btn');
  host.style.setProperty('--msb', Math.max(0, bar.offsetTop + bar.offsetHeight + 8 - (fb ? fb.offsetTop : 10)) + 'px');
}
// size-fixes (1): the four ways keep one line at every text size - where their words and icons do not fit (360 wide from "גדול מאוד"),
// the icons step aside and the words stay whole; measured again when the text size changes (its resize)
function measWaysFit(root) { (root || document).querySelectorAll('.ms-ways').forEach(g => { g.classList.remove('tight'); if ([...g.children].some(b => b.scrollWidth > b.clientWidth + 1)) g.classList.add('tight'); }); }
window.addEventListener('resize', () => measWaysFit());
act('map.measBar', c => { const a = c.v;
  if (a === 'x') measClear(); else if (a === 'undo') measUndo();
  else if (a === 'ruler') { if (MEAS.mode === 'ruler') return 'quiet'; MEAS.mode = 'ruler'; measDraw(); showToast('נוגעים במפה כדי למדוד מהמיקום'); }
  else if (a === 'ring') { if (MEAS.mode === 'ref') return 'quiet'; MEAS.mode = 'ref'; MEAS.pts = MEAS.pts.slice(0, 1); MEAS.road = null; measDraw(); } // 4.33.0: back to the rings around the first point
  else measBarAction(a); return 'quiet'; });
function measBarAction(a) { // 10.10.0: the way is one choice of four (קו אוויר · ברגל · תחבורה · רכב); a road way needs a network
  if (!a.startsWith('rw:')) return; const k = a.slice(3), road = k === 'air' ? null : k;
  if (road && !MEAS.road && !navigator.onLine) { showToast(('לפי דרכים צריך רשת' + SEP + 'בינתיים הערכה ≈ לפי קו אוויר')); return; }
  if (MEAS.road === road) return; MEAS.road = road; measDraw();
}
function measSegs() { const m = MEAS, out = []; for (let i = 1; i < m.pts.length; i++) { const a = m.pts[i - 1].ll, b = m.pts[i].ll, w = m.road === 'transit' ? tmMeasWhen() : '';
  const r = routeGet(m.road, a, b, w); if (!r) routeWant(m.road, a, b, w, () => { if (MEAS) measDraw(); }); out.push({ a, b, r }); } return out; }
function measRoadLines(add) { measSegs().forEach(s => { if (s.r && !s.r.none && s.r.g && s.r.g.length > 1) add(L.polyline(s.r.g, { className: 'ms-line road', color: '#2563EB', weight: 4, opacity: .9, interactive: false }));
  else add(L.polyline([[s.a.lat, s.a.lng], [s.b.lat, s.b.lng]], { className: 'ms-line est', color: '#2563EB', weight: 2, opacity: .5, dashArray: '4 6', interactive: false })); }); }
function measRoadText() { // the banner's title and line for a ruler along the roads
  const ss = measSegs(), wayW = { walk: 'ברגל', transit: 'בתחבורה', car: 'ברכב' }[MEAS.road], segs = measSegN(ss.length);
  if (ss.some(s => s.r && s.r.none)) return MEAS.road === 'transit' ? { t: 'לא נמצא קו תחבורה ציבורית', l: 'בין המיקומים, או שאין לשירות נתונים כאן' } : { t: 'אין מסלול כזה כאן', l: `${wayW} לפי הדרכים` };
  if (MEAS.road === 'transit' && ss.every(s => s.r && s.r.walkOnly)) { const d0 = ss.reduce((x, s) => x + s.r.d, 0), t0 = ss.reduce((x, s) => x + s.r.t, 0); return { t: `<b>${fmtKm(d0 / 1000)}</b>${SEP}${fmtLegMin(t0 / 60)}`, l: 'ברגל - מהיר יותר מכל קו' }; }
  if (ss.some(s => !s.r)) return navigator.onLine ? { t: 'מחשב לפי הדרכים…', l: `${wayW} לפי הדרכים${SEP}${segs}` } : { t: `<span class="est est-tip sym-tip" data-act="tip" data-v="sym.est">≈ ${fmtKm(measKm(MEAS.pts) * 1.3)}</span>`, l: `<span class="net-wait">${msiT('cloud_off', SVC_WAIT_NET, { size: 16 })}</span>` };
  const d = ss.reduce((x, s) => x + s.r.d, 0), t = ss.reduce((x, s) => x + s.r.t, 0);
  return { t: `<b>${fmtKm(d / 1000)}</b>${SEP}${fmtLegMin(t / 60)}`, l: `${wayW} לפי הדרכים${SEP}${segs}` };
}
function measOnMapClick(id, e) { // a tap on the map while measuring
  if (!measActiveOn(id) || !e || !e.latlng) return false;
  if (MEAS.mode === 'ruler') { measAddPoint(e.latlng); return true; }
  return false; // reference mode: the map tap only closes a card
}
function measAddMe() { // ◎ inside the measuring: my location becomes the start
  if (!MEAS || !userPos) return; const me = { ll: { lat: userPos.lat, lng: userPos.lng }, me: true, name: 'אני' };
  if (MEAS.mode === 'ref' || !MEAS.pts.length) MEAS.pts = [me].concat(MEAS.mode === 'ref' ? [] : MEAS.pts);
  else MEAS.pts.unshift(me);
  if (MEAS.pts.length === 1) MEAS.mode = 'ref';
  measDraw();
}
function measFollowMe() { if (MEAS && MEAS.pts[0] && MEAS.pts[0].me && userPos) { MEAS.pts[0].ll = { lat: userPos.lat, lng: userPos.lng }; measDraw(); } }
function measAfterRender() { // a measurement stays while the map screen (or its list) is open; anywhere else it ends
  if (!MEAS) return;
  if (MEAS.id === 'mapView_screen' && (activeTab === 'map' || activeTab === 'all')) { if (document.getElementById('mapView_screen')) setTimeout(() => { if (MEAS) measDraw(); }, 0); return; }
  if (!document.getElementById(MEAS.id)) measClear();
}
function measBtn(host, id) {
  if (!host || host.querySelector(':scope > .ms-btn') || id === 'peMap') return;
  const b = document.createElement('button'); b.type = 'button'; b.className = 'ms-btn'; b.innerHTML = msi('polyline'); b.title = 'מדידת מרחק'; b.setAttribute('aria-label', 'מדידת מרחק');
  b.dataset.active = String(measActiveOn(id)); b.dataset.act = 'map.measure'; host.appendChild(b); mapCtl(b);
}
act('map.measure', c => { const id = c.el.parentElement.id; if (measActiveOn(id)) measClear(); else measStart(id, 'ruler'); return 'quiet'; });
function measFromPlace(id, p) { // 📏 מדידה מכאן (card or details)
  const r = MAPS[id]; let ll = null; const mk = r && r.markers.get(String(p.id));
  if (mk && mk.getLatLng) { const l = (mk._fanOrig) || mk.getLatLng(); ll = { lat: l.lat, lng: l.lng }; } else { const c = routeCoordOf(p) || draftCoordSafe(p); if (c) ll = c; }
  if (!ll) { showToast('אין מיקום למקום הזה'); return; }
  // 5.4.0: from a window the window stays in the stack and steps aside; ✕ of the measuring returns to it
  if (MEAS && MEAS.id === id) { MEAS.mode = 'ref'; MEAS.pts = [{ ll, name: p.name }]; measDraw(); }
  else measStart(id, 'ref', { ll, name: p.name });
}
function draftCoordSafe(p) { try { return typeof draftCoord === 'function' ? draftCoord(p) : null; } catch (e) { return null; } }

// ---- pin clustering and the fan ----
// ⚙️ ← 🎛️ ← 📍 קיבוץ סיכות: "רק מניפה" (default) - the map looks as before, and a tap on pins that sit on each other fans
// them out around the spot; "מלא" - in a far view (neighbourhood zoom and out) close pins merge into a bubble with a count
// and a ring colored by their layers (one layer: its icon too); a tap zooms in. "כבוי" - as before 4.31.0.
// Never in a bubble: 🏨 hotels, ★ key points, the blue dot, measuring points, route stops; days and plan maps fan only;
// the pin whose card is open; 📚 discoveries merge only among themselves.
const CLU_FULL_MAX_Z = 14;
function cluMode() { return prefs().cluster; } // 4.33.0: "מלא" is the default
function cluState(id) { const r = MAPS[id]; if (!r) return null; return r.clu || (r.clu = { full: false, items: new Map(), bubbles: [], fan: null, t: 0 }); }
function cluEnableFull(id) { const s = cluState(id); if (!s) return; s.full = true; const map = MAPS[id].map; map.on('zoomend', () => cluSoon(id)); map.on('zoomstart', () => fanClose(id)); }
function cluItem(id, key, marker, group) {
  const s = cluState(id); if (!s || !marker) return; const p = typeof key === 'string' && key.startsWith('disc:') ? null : (typeof planItem === 'function' ? planItem(cluPid(key)) : null);
  const html = (marker.options.icon && marker.options.icon.options && marker.options.icon.options.html) || '';
  const excl = /hotel-marker|rt-key|rt-stop|rt-leg|self-loc/.test(html) || !!(p && p.key);
  const color = (html.match(/background:\s*([^;"]+)/) || [])[1] || '#888';
  const own = ((htmlFrag(html).querySelector('span.msi') || {}).outerHTML) || msi('location_on'); // 10.10.0 (design-maps): the pin's own line icon
  const ld = p && typeof layerDef === 'function' ? layerDef(p.layer) : null;
  s.items.set(String(key), { key: String(key), m: marker, group: group || 'p', excl, color: (p && p.color) || color, layer: p ? p.layer : color, lic: ld ? typeIcon(ld.icon) : own, hidden: false });
  cluSoon(id);
}
function cluPid(k) { return typeof k === 'string' && /^\d+$/.test(k) ? Number(k) : k; }
function cluSoon(id) { const s = cluState(id); if (!s) return; clearTimeout(s.t); s.t = setTimeout(() => cluRun(id), 40); }
function cluRun(id) {
  const r = MAPS[id], s = r && r.clu; if (!s) return; const map = r.map; if (map._removed) return;
  s.bubbles.forEach(b => { try { map.removeLayer(b); } catch (e) {} }); s.bubbles = [];
  const on = s.full && cluMode() === 'full' && map.getZoom() <= CLU_FULL_MAX_Z && !(s.fan);
  const show = it => { if (it.hidden) { it.hidden = false; try { map.addLayer(it.m); } catch (e) {} } };
  if (!on) { s.items.forEach(show); return; }
  const groups = {}; s.items.forEach(it => { if (!it.m || it.excl || String(r.selId) === it.key) { show(it); return; } (groups[it.group] = groups[it.group] || []).push(it); });
  Object.entries(groups).forEach(([g, list]) => {
    const cl = [];
    list.forEach(it => { const ll = it.m.getLatLng(), pt = map.latLngToContainerPoint(ll); it._pt = pt;
      const c = cl.find(c => Math.hypot(c.x - pt.x, c.y - pt.y) < 46); if (c) { c.items.push(it); } else cl.push({ x: pt.x, y: pt.y, items: [it] }); });
    cl.forEach(c => {
      if (c.items.length < 2) { show(c.items[0]); return; }
      c.items.forEach(it => { if (!it.hidden) { it.hidden = true; try { map.removeLayer(it.m); } catch (e) {} } });
      const lat = c.items.reduce((a, it) => a + it.m.getLatLng().lat, 0) / c.items.length, lng = c.items.reduce((a, it) => a + it.m.getLatLng().lng, 0) / c.items.length;
      const by = {}; c.items.forEach(it => { const k = String(it.layer); (by[k] = by[k] || { n: 0, color: it.color, ic: it.lic }).n++; });
      const parts = Object.values(by), n = c.items.length; let acc = 0;
      // 10.10.0 (design-maps, gap 1, design-gaps Q1): each layer's share of the ring with a thin gap between segments; one layer - a full ring and its line icon before the count; discoveries - the violet ring and the book
      const gap = parts.length > 1 ? 4 : 0, ring = g === 'disc' ? '' : `conic-gradient(${parts.map(x => { const a = acc; acc += x.n / n * 360; return `var(--surface-container) ${a}deg ${a + gap}deg,${x.color} ${a + gap}deg ${acc}deg`; }).join(',')})`;
      const one = g === 'disc' ? msi('auto_stories') : parts.length === 1 ? parts[0].ic : '';
      const px = n >= 50 ? 46 : n >= 10 ? 40 : 34;
      const b = L.marker([lat, lng], { zIndexOffset: 500, icon: L.divIcon({ className: '', iconSize: [px, px], iconAnchor: [px / 2, px / 2],
        html: `<div class="clu-b${g === 'disc' ? ' disc' : ''}${one && g !== 'disc' ? ' one' : ''}" style="width:${px}px;height:${px}px;${ring ? `background:${ring};` : ''}${one && g !== 'disc' ? `--lc:${parts[0].color}` : ''}"><span>${one}${n}</span></div>` }) }).addTo(map);
      b._cluKeys = c.items.map(it => it.key);
      b.on('click', e => { if (e && e.originalEvent && L.DomEvent) L.DomEvent.stopPropagation(e.originalEvent);
        const bb = L.latLngBounds(c.items.map(it => it.m.getLatLng()));
        if (map.getZoom() >= CLU_FULL_MAX_Z) map.setView([lat, lng], CLU_FULL_MAX_Z + 1); else map.fitBounds(bb, { padding: [50, 50], maxZoom: CLU_FULL_MAX_Z + 1 }); });
      s.bubbles.push(b);
    });
  });
}
function fanClose(id) {
  const r = MAPS[id], s = r && r.clu; if (!s || !s.fan) return; const f = s.fan; s.fan = null;
  f.legs.forEach(l => { try { r.map.removeLayer(l); } catch (e) {} });
  f.members.forEach(x => { if (x.it.m._fanOrig) { x.it.m.setLatLng(x.it.m._fanOrig); x.it.m._fanOrig = null; } const el = x.it.m.getElement && x.it.m.getElement(); if (el) el.classList.remove('fanned'); });
  cluSoon(id);
}
function fanOpen(id, key) { // pins that sit on each other spread around the spot; returns true when it fanned
  if (cluMode() === 'off') return false;
  const r = MAPS[id], s = r && cluState(id); if (!s) return false; const map = r.map;
  if (s.fan) { if (s.fan.members.some(x => x.it.key === String(key))) return false; fanClose(id); }
  const it0 = s.items.get(String(key)); if (!it0 || !it0.m || it0.hidden) return false;
  const p0 = map.latLngToContainerPoint(it0.m.getLatLng());
  const near = [...s.items.values()].filter(it => it.m && !it.hidden && map.hasLayer(it.m) && map.latLngToContainerPoint(it.m.getLatLng()).distanceTo(p0) < 18);
  if (near.length < 2) return false;
  const c = it0.m.getLatLng(), n = near.length, legs = [];
  near.forEach((it, i) => { const ang = -Math.PI / 2 + i * 2 * Math.PI / n, rad = n <= 8 ? 30 + n * 3 : 26 + i * 4.5, a2 = n <= 8 ? ang : i * 0.9;
    const to = map.containerPointToLatLng([p0.x + Math.cos(a2) * rad, p0.y + Math.sin(a2) * rad]);
    it.m._fanOrig = it.m.getLatLng(); it.m.setLatLng(to); const el = it.m.getElement && it.m.getElement(); if (el) el.classList.add('fanned');
    legs.push(L.polyline([[c.lat, c.lng], [to.lat, to.lng]], { className: 'fan-leg', color: '#555', weight: 1.5, opacity: .7, interactive: false }).addTo(map)); });
  s.fan = { members: near.map(it => ({ it })), legs };
  if (!hintSeen('fan') && cluMode() === 'fan') { hintMark('fan'); showToast(tipText('hint.fan'), { ms: hintMs(tipText('hint.fan')) }); } // a one-time hint: the hints' timing rule
  return true;
}
// one decision for every tap on a pin: measuring snaps to it, pins on each other fan out, otherwise the card opens
function pinTap(id, key) {
  if (measActiveOn(id) && MEAS.mode === 'ruler') { const r = MAPS[id], mk = r && r.markers.get(String(key)); if (mk) { const ll = mk._fanOrig || mk.getLatLng(); let nm = ''; try { const p = planItem(cluPid(key)); nm = p ? p.name : ''; } catch (e) {}
      if (!nm && typeof draftItems === 'function' && DRAFT) { try { const x = draftItems(DRAFT).find(x => x.key === key); nm = x ? x.p.name : ''; } catch (e) {} }
      measAddPoint(ll, nm); } return true; }
  return fanOpen(id, key);
}

// ---- 🏔️ map with relief: Esri World Hillshade over the regular map, multiplied (dark variant in dark mode) ----
function isDarkUI() { const t = document.documentElement.dataset.theme; return t === 'dark' || (t !== 'light' && !!(window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches)); }
function hillshadeUrl(k) { const n = isDarkUI() ? 'World_Hillshade_Dark' : 'World_Hillshade';
  return `https://ibasemaps-api.arcgis.com/arcgis/rest/services/Elevation/${n}/MapServer/tile/{z}/{y}/{x}?token=${encodeURIComponent(k || ESRI_SITE_KEY)}`; } // legal-server (11.41.0): keyed only - the app's key when the person has none (esriKey)
try { const mq = matchMedia('(prefers-color-scheme: dark)'), h = () => { if (baseMapId() === 'relief') refreshBaseMaps(); }; sysOn(mq, 'change', h); } catch (e) {}


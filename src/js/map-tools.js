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
  return `${msiT('track_changes', fmtKm(km), { size: 16 })}${SEP}${measTime(km)} מ${measRefName() === 'המיקום שלי' ? 'המיקום שלי' : '-' + escH(measRefName())}`; // value-tie-source: the parts joined by SEP, each value whole
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
  if (m.mode === 'ref') { t = n ? `מודדים מ${m.pts[0].me ? 'המיקום שלי' : '-' + escH(measRefName())}` : 'מדידה'; l = ('טבעות של 10' + SEP + '20' + SEP + '30\u00A0דק׳ הליכה'); }
  else if (n < 2) { t = n ? 'נוגעים בנקודה הבאה' : 'נוגעים במפה כדי למדוד'; l = m.road ? wayW + ' לפי הדרכים' : wayW; }
  else if (m.road) ({ t, l } = measRoadText());
  else { const km = measKm(m.pts); t = `<b>${fmtKm(km)}</b>${SEP}${measTime(km, true)}`; l = `קו אוויר${SEP}${measSegN(n - 1)}`; }
  const btn = (v, ic, label, on, cls) => `<button type="button" data-act="map.measBar" data-v="${v}"${on != null ? ` data-active="${on}" aria-pressed="${on}"` : ''}${cls ? ` class="${cls}"` : ''} aria-label="${label}" title="${label}">${ic}</button>`;
  const sw = n ? `<div class="view-toggle seg ms-seg" role="group">${btn('ring', msi('track_changes', { size: 20 }), 'טבעות זמן הליכה', m.mode === 'ref')}${btn('ruler', msi('polyline', { size: 20 }), 'סרגל', m.mode === 'ruler')}</div>` : '';
  const un = m.mode === 'ruler' && n ? `<button type="button" class="ms-undo" data-act="map.measBar" data-v="undo">${msi('undo', { size: 18 })}הסרת נקודה</button>` : '';
  const ways = m.mode === 'ruler' ? `<div class="ms-row"><div class="view-toggle seg ms-ways" role="group">${MEAS_WAYS.map(([k, ic, w]) => `<button type="button" data-act="map.measBar" data-v="rw:${k}" data-active="${way === k}" aria-pressed="${way === k}"${k !== 'air' && !svcOnline() ? ' class="off"' : ''}>${msi(ic, { size: 18 })}${w}</button>`).join('')}</div></div>` : '';
  bar.innerHTML = `<div class="ms-top">${msi(m.mode === 'ref' ? 'track_changes' : 'polyline', { size: 22, cls: 'ms-ic' })}<span class="ms-tt"><span class="ms-t">${sepTie(numTie(t))}</span><small>${sepTie(l)}</small></span>${tipI('meas.mode')}${btn('x', msi('close'), 'סיום המדידה', null, 'ms-x')}</div>${sw || un ? `<div class="ms-row">${sw}${un}</div>` : ''}${ways}`;
  measWaysFit(bar);
  host.classList.add('meas-host'); const fb = host.querySelector(':scope > .fs-btn');
  host.style.setProperty('--msb', Math.max(0, bar.offsetTop + bar.offsetHeight + 8 - (fb ? fb.offsetTop : 10)) + 'px');
}
// size-fixes (1): the four ways keep one line at every text size - where their words and icons do not fit (360 wide from "גדול מאוד"),
// the icons step aside and the words stay whole; measured again when the text size changes (its resize)
function measWaysFit(root) { (root || document).querySelectorAll('.ms-ways').forEach(g => { g.classList.remove('tight'); if ([...g.children].some(b => b.scrollWidth > b.clientWidth + 1)) g.classList.add('tight'); }); }
sysOn(window, 'resize', () => measWaysFit());
act('map.measBar', c => { const a = c.v;
  if (a === 'x') measClear(); else if (a === 'undo') measUndo();
  else if (a === 'ruler') { if (MEAS.mode === 'ruler') return 'quiet'; MEAS.mode = 'ruler'; measDraw(); showToast('נוגעים במפה כדי למדוד מהמיקום'); }
  else if (a === 'ring') { if (MEAS.mode === 'ref') return 'quiet'; MEAS.mode = 'ref'; MEAS.pts = MEAS.pts.slice(0, 1); MEAS.road = null; measDraw(); } // 4.33.0: back to the rings around the first point
  else measBarAction(a); return 'quiet'; });
function measBarAction(a) { // 10.10.0: the way is one choice of four (קו אוויר · ברגל · תחבורה · רכב); a road way needs a network
  if (!a.startsWith('rw:')) return; const k = a.slice(3), road = k === 'air' ? null : k;
  if (road && !MEAS.road && !svcOnline()) { showToast(('לפי דרכים צריך רשת' + SEP + 'בינתיים הערכה ≈ לפי קו אוויר')); return; }
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
  if (ss.some(s => !s.r)) return svcOnline() ? { t: 'מחשב לפי הדרכים…', l: `${wayW} לפי הדרכים${SEP}${segs}` } : { t: `<span class="est est-tip sym-tip" data-act="tip" data-v="sym.est">≈ ${fmtKm(measKm(MEAS.pts) * 1.3)}</span>`, l: `<span class="net-wait">${msiT('cloud_off', SVC_WAIT_NET, { size: 16 })}</span>` };
  const d = ss.reduce((x, s) => x + s.r.d, 0), t = ss.reduce((x, s) => x + s.r.t, 0);
  return { t: `<b>${fmtKm(d / 1000)}</b>${SEP}${fmtLegMin(t / 60)}`, l: `${wayW} לפי הדרכים${SEP}${segs}` };
}
function measOnMapClick(id, e) { // a tap on the map while measuring
  if (walkOnMapClick(id, e)) return true; // walk-time: the walking rings' tool takes the tap (a point)
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
  walkAfterRender();
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

// ---- walk-time: "מה במרחק הליכה" (decisions 2026-11-24 · "מה במרחק הליכה", Q1-Q5; spec map-component.md) ----
// Three walking-time rings (10 / 20 / 30 min) around a point, from Valhalla's /isochrone (FOSSGIS, service walkIso - one request with
// three contours, through the one client and fossgis's one-a-second queue). Ways in: the 📚 menu ("מה במרחק הליכה" beside "מה יש כאן",
// discMenu) - then a tap on the map adds a point; a place's details window from a map ("מה במרחק הליכה מכאן", a link, walkFromPlace).
// The rings are drawn under the pins (the overlay pane), shades of one colour (--walk-*); the trip's places inside a ring highlighted,
// the rest dimmed; the banner's line counts them (point-in-polygon). Up to three points as rows at the bottom (a fourth replaces the
// oldest); a tap on a row brings its rings back, ✕ removes it. Nothing is stored: the answers live in WALK_ISO for the session, and
// closing the tool (✕, Back, leaving the map) clears the rest.
const WALK_MIN = [10, 20, 30], WALK_MAX = 3, WALK_ISO = new Map(), WALK_CLS = { 10: 'wk-ring wk-10', 20: 'wk-ring wk-20', 30: 'wk-ring wk-30' }; // the session's answers: a point's key -> { 10: polygons, 20: …, 30: … }
const WK = { on: null }; // the tool's state, WK.on: { id, map, pts: [{ ll, name, n, pid, st: 'ask' | 'ok' | 'err' | 'off', iso, counts }], cur, seq, layers: [], wait }
function walkActiveOn(id) { return !!(WK.on && WK.on.id === id); }
function walkCan(id) { const d = typeof DISC_MAPS !== 'undefined' && DISC_MAPS[id]; return !!(MAPS[id] && d && d.ctx === 'main'); } // the live maps with the 📚 menu
function walkKey(ll) { return (+ll.lat).toFixed(5) + ',' + (+ll.lng).toFixed(5); }
function walkUrl(ll) { return 'https://valhalla1.openstreetmap.de/isochrone?json=' + encodeURIComponent(JSON.stringify({ locations: [{ lat: +(+ll.lat).toFixed(6), lon: +(+ll.lng).toFixed(6) }], costing: 'pedestrian', contours: WALK_MIN.map(time => ({ time })), polygons: true })); }
// Valhalla's answer: a FeatureCollection, a feature per contour (Polygon or MultiPolygon, [lng, lat]) -> { minutes: [polygon: [ring: [[lat, lng]]]] }
function walkParse(d) { if (!d || !Array.isArray(d.features)) return undefined; const out = {};
  d.features.forEach(f => { const m = f && f.properties ? +f.properties.contour : NaN, g = f && f.geometry; if (!WALK_MIN.includes(m) || !g) return;
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
    out[m] = polys.map(P => P.map(R => R.map(c => [+c[1], +c[0]]))).filter(P => P.length && P[0].length > 2); });
  return WALK_MIN.every(m => out[m] && out[m].length) ? out : undefined; }
function walkAsk(ll) { const k = walkKey(ll); if (WALK_ISO.has(k)) return Promise.resolve({ kind: 'ok', value: WALK_ISO.get(k) }); // same point, same answer
  return svcAsk('walkIso', { key: k, prio: 'screen', build: prov => prov === 'fossgis' ? { url: walkUrl(ll), as: 'json', ms: 20000 } : null, parse: walkParse })
    .then(r => { if (r.kind === 'ok') WALK_ISO.set(k, r.value); return r; }); }
// point in polygon: inside the outer ring and in none of its holes; a point on a ring's edge counts as inside
function walkOnEdge(ll, R) { for (let i = 0, j = R.length - 1; i < R.length; j = i++) { const [ay, ax] = R[j], [by, bx] = R[i], dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
  const t = L2 ? Math.max(0, Math.min(1, ((ll.lng - ax) * dx + (ll.lat - ay) * dy) / L2)) : 0, ex = ax + t * dx - ll.lng, ey = ay + t * dy - ll.lat; if (ex * ex + ey * ey < 1e-16) return true; } return false; }
function walkInRing(ll, R) { if (walkOnEdge(ll, R)) return true; let ins = false;
  for (let i = 0, j = R.length - 1; i < R.length; j = i++) { const [yi, xi] = R[i], [yj, xj] = R[j]; if ((yi > ll.lat) !== (yj > ll.lat) && ll.lng < (xj - xi) * (ll.lat - yi) / (yj - yi) + xi) ins = !ins; }
  return ins; }
function walkIn(ll, polys) { return (polys || []).some(P => walkInRing(ll, P[0]) && !P.slice(1).some(h => !walkOnEdge(ll, h) && walkInRing(ll, h))); }
function walkBand(ll, iso) { if (!iso || !ll) return 0; for (const m of WALK_MIN) if (walkIn(ll, iso[m])) return m; return 0; } // the smallest ring that holds it (0: outside)
function walkPlaces() { return POINTS.map(p => ({ p, ll: routeCoordOf(p) })).filter(x => x.ll); } // the trip's places with a point
function walkCount(pt) { const all = walkPlaces().filter(x => x.p.id !== pt.pid), c = WALK_MIN.map(() => 0);
  all.forEach(x => { const b = walkBand(x.ll, pt.iso); if (b) WALK_MIN.forEach((m, i) => { if (m >= b) c[i]++; }); }); return { c, of: all.length }; }
function walkStart(id, first) {
  if (!MAPS[id]) return; if (WK.on && WK.on.id !== id) walkClear();
  if (MEAS) measClear(); closeFloatCard(id);
  if (!WK.on) { WK.on = { id, pts: [], cur: -1, seq: 0, layers: [] }; layerPush('walk', 'mode', fp => walkClear(fp)); }
  document.body.classList.add('walk-on');
  if (first) walkAdd(first.ll, first.name, first.pid); else { walkDraw(); showToast('נוגעים במפה כדי לבדוק מה במרחק הליכה מהנקודה'); }
}
function walkClear(fromPop) {
  if (!WK.on) return; const w = WK.on; WK.on = null; if (w.wait) w.wait.done();
  walkWipe(w); walkPins(w.id, null); document.body.classList.remove('walk-on');
  const host = document.getElementById(w.id); if (host) { host.querySelectorAll(':scope > .wk-bar, :scope > .wk-rows').forEach(e => e.remove()); host.classList.remove('meas-host'); host.style.removeProperty('--msb'); }
  layerDone('walk', fromPop);
}
function walkWipe(w) { (w.layers || []).forEach(l => { try { w.map.removeLayer(l); } catch (e) {} }); w.layers = []; }
function walkAdd(ll, name, pid) {
  if (!WK.on) return; const W = WK.on;
  if (W.pts.length >= WALK_MAX) W.pts.shift(); // a fourth replaces the oldest
  const pt = { ll: { lat: +ll.lat, lng: +ll.lng }, name: name || '', pid: pid != null ? pid : null, n: ++W.seq, st: 'ask' };
  W.pts.push(pt); W.cur = W.pts.length - 1; buzz('light'); walkFetch(pt);
}
async function walkFetch(pt) {
  if (!WK.on) return; if (svcNetDown()) { pt.st = 'off'; walkDraw(); return; }
  pt.st = 'ask'; pt.why = ''; walkDraw();
  const r = await walkAsk(pt.ll); if (!WK.on || !WK.on.pts.includes(pt)) return;
  if (r.kind === 'ok') { pt.iso = r.value; pt.counts = walkCount(pt); pt.st = 'ok'; }
  else if (r.kind === 'offline') pt.st = 'off';
  else { pt.st = 'err'; pt.why = r.kind === 'busy' ? 'השירות עמוס' : r.kind === 'blocked' ? 'השירות חסם את הבקשות להיום' : 'השירות לא ענה'; }
  walkDraw();
}
function walkName(pt) { return pt.name || 'נקודה ' + pt.n; }
function walkDraw() {
  const W = WK.on; if (!W) return; const r = MAPS[W.id]; if (!r) return; W.map = r.map; walkWipe(W);
  const map = W.map, add = l => { l.addTo(map); W.layers.push(l); return l; }, cur = W.pts[W.cur];
  if (cur && cur.iso) [...WALK_MIN].reverse().forEach(m => add(L.polygon(cur.iso[m], { className: WALK_CLS[m], weight: 1.5, interactive: false }))); // the overlay pane: under the pins
  W.pts.forEach((p, i) => add(L.marker([p.ll.lat, p.ll.lng], { interactive: false, zIndexOffset: 2000,
    icon: L.divIcon({ className: '', html: `<div class="wk-pt${i === W.cur ? ' cur' : ''}"><b>${escH(walkName(p))}</b></div>`, iconSize: [16, 16], iconAnchor: [8, 8] }) })));
  walkPins(W.id, cur && cur.iso ? cur.iso : null); walkBar(); walkRows();
}
// the trip's pins on the map: inside a ring highlighted, the rest dimmed (none while no rings are shown)
function walkPins(id, iso) { const r = MAPS[id]; if (!r) return;
  r.markers.forEach(mk => { const el = mk.getElement && mk.getElement(); if (!el) return; const l = mk._fanOrig || (mk.getLatLng && mk.getLatLng());
    const b = iso && l ? walkBand({ lat: l.lat, lng: l.lng }, iso) : 0; el.classList.toggle('wk-in', !!iso && !!b); el.classList.toggle('wk-out', !!iso && !b); }); }
function walkSum(pt) { const c = pt.counts; return c ? WALK_MIN.map((m, i) => `${tmFmt('dur', m)}: <bdi>${c.c[i]}</bdi>`).join(SEP) + ` מתוך <bdi>${c.of}</bdi> מקומות` : ''; }
function walkBar() {
  const W = WK.on; if (!W) return; const host = document.getElementById(W.id); if (!host) return;
  if (W.wait) { W.wait.done(); W.wait = null; }
  let bar = host.querySelector(':scope > .wk-bar');
  if (!bar) { bar = document.createElement('div'); bar.className = 'ms-bar wk-bar wait-keep'; host.appendChild(bar); mapCtl(bar); }
  const cur = W.pts[W.cur]; let t, l = '', more = '';
  if (!cur) { t = 'מה במרחק הליכה'; l = 'נוגעים במפה כדי להוסיף נקודה'; }
  else { t = escH(walkName(cur));
    if (cur.st === 'ok') l = walkSum(cur);
    else if (cur.st === 'ask') l = '<span class="wk-wait"></span>';
    else if (cur.st === 'off') l = `<span class="net-wait">${msiT('cloud_off', 'צריך רשת כדי לחשב טבעות הליכה', { size: 16 })}</span>`;
    else { l = `${escH(cur.why || 'השירות לא ענה')}${SEP}הנקודה נשמרה`; more = `<div class="ms-row"><button type="button" class="ms-undo" data-act="walk.bar" data-v="retry">${msi('refresh', { size: 18 })}נסה שוב</button></div>`; } }
  bar.innerHTML = `<div class="ms-top">${msi('hiking', { size: 22, cls: 'ms-ic' })}<span class="ms-tt"><span class="ms-t">${t}</span><small class="wk-sum">${l}</small></span><button type="button" class="ms-x" data-act="walk.bar" data-v="x" aria-label="סיום" title="סיום">${msi('close')}</button></div>${more}`;
  if (cur && cur.st === 'ask') W.wait = waitOn(bar, { head: bar.querySelector(':scope > .ms-top'), line: bar.querySelector('.wk-wait'), stage: 'מחשבים טבעות הליכה' });
  host.classList.add('meas-host'); const fb = host.querySelector(':scope > .fs-btn');
  host.style.setProperty('--msb', Math.max(0, bar.offsetTop + bar.offsetHeight + 8 - (fb ? fb.offsetTop : 10)) + 'px');
}
function walkRows() {
  const W = WK.on; if (!W) return; const host = document.getElementById(W.id); if (!host) return;
  let box = host.querySelector(':scope > .wk-rows');
  if (!W.pts.length) { if (box) box.remove(); return; }
  if (!box) { box = document.createElement('div'); box.className = 'wk-rows'; host.appendChild(box); mapCtl(box); }
  box.innerHTML = walkRowsHTML(W) + `<small class="walk-cr">${svcCredit('fossgis', { fix: true })}</small>`; // legal-credits-2 (S6): the rings' data credited with "לתקן את המפה" on every base map
}
function walkRowsHTML(W) { return W.pts.map((p, i) => { const c = p.counts ? p.counts.c.map(x => `<bdi>${escH(x)}</bdi>`).join(SEP) : escH({ ask: 'מחשבים…', off: 'צריך רשת', err: 'לא חושב' }[p.st] || ''), n = escH(walkName(p));
  return `<div class="wk-row${i === W.cur ? ' cur' : ''}"><button type="button" class="wk-r" data-act="walk.row" data-v="${escH(i)}" aria-pressed="${i === W.cur ? 'true' : 'false'}"><b class="t-ell">${n}</b><small>${c}</small></button><button type="button" class="wk-x" data-act="walk.del" data-v="${escH(i)}" aria-label="הסרת ${n}" title="הסרה">${msi('close', { size: 18 })}</button></div>`; }).join(''); }
act('walk.bar', c => { if (!WK.on) return 'quiet'; if (c.v === 'x') walkClear(); else if (c.v === 'retry') { const p = WK.on.pts[WK.on.cur]; if (p) walkFetch(p); } return 'quiet'; });
act('walk.row', c => { if (!WK.on) return 'quiet'; const i = +c.v; if (WK.on.pts[i]) { WK.on.cur = i; const p = WK.on.pts[i]; if (p.st === 'err' || p.st === 'off') walkFetch(p); else walkDraw(); } return 'quiet'; });
act('walk.del', c => { if (!WK.on) return 'quiet'; const i = +c.v; if (!WK.on.pts[i]) return 'quiet'; WK.on.pts.splice(i, 1);
  const n = WK.on.pts.length; WK.on.cur = !n ? -1 : WK.on.cur > i ? WK.on.cur - 1 : Math.min(WK.on.cur, n - 1); walkDraw(); return 'quiet'; });
function walkOnMapClick(id, e) { if (!walkActiveOn(id) || !e || !e.latlng) return false; walkAdd(e.latlng); return true; }
function walkFromPlace(id, p) { // "מה במרחק הליכה מכאן" in a place's details window: the place becomes a point
  const r = MAPS[id]; let ll = null; const mk = r && r.markers.get(String(p.id));
  if (mk && mk.getLatLng) { const l = mk._fanOrig || mk.getLatLng(); ll = { lat: l.lat, lng: l.lng }; } else ll = routeCoordOf(p);
  if (!ll) { showToast('אין מיקום למקום הזה'); return; }
  if (WK.on && WK.on.id === id) walkAdd(ll, p.name, p.id); else walkStart(id, { ll, name: p.name, pid: p.id });
}
act('walk.from', c => { const x = c.ref && c.ref.obj, p = x && (x.place || x); if (!p || !walkCan(c.v)) return 'quiet'; walkFromPlace(c.v, p); return 'quiet'; });
act('walk.menu', c => { const m = c.el.closest('.disc-menu'), h = m && m.parentElement, id = h && h.id; if (m) m.remove(); if (id && walkCan(id)) walkStart(id); return 'quiet'; });
// a pin's card while the rings are shown: its walk from the point - a real leg time when the legs already have one, else the ring it is in
function walkFrom(ll) { const pt = WK.on && WK.on.pts[WK.on.cur]; if (!pt || !pt.iso || !ll) return ''; const from = ' מ' + (pt.name ? '-' + escH(pt.name) : 'הנקודה');
  const r = routeGet('walk', pt.ll, ll); if (r && !r.none && r.t) return `${msiT('directions_walk', fmtLegMin(r.t / 60), { size: 16 })}${from}`;
  const b = walkBand(ll, pt.iso); return b ? `${msiT('directions_walk', 'עד ' + tmFmt('dur', b), { size: 16 })}${from}` : `${msiT('directions_walk', 'יותר מ-' + tmFmt('dur', 30), { size: 16 })}${from}`; }
function walkAfterRender() { // the tool stays while its map is on the page (drawn again on its new map); anywhere else it ends
  if (!WK.on) return; if (!document.getElementById(WK.on.id)) { walkClear(); return; } setTimeout(() => { if (WK.on && MAPS[WK.on.id]) walkDraw(); }, 0); }

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
  if (M3.id === id) return false; // map-3d: a pin tapped in the 3D view opens its card
  if (measActiveOn(id) && MEAS.mode === 'ruler') { const r = MAPS[id], mk = r && r.markers.get(String(key)); if (mk) { const ll = mk._fanOrig || mk.getLatLng(); let nm = ''; try { const p = planItem(cluPid(key)); nm = p ? placeLabel(p) : ''; } catch (e) {}
      if (!nm && typeof draftItems === 'function' && DRAFT) { try { const x = draftItems(DRAFT).find(x => x.key === key); nm = x ? x.p.name : ''; } catch (e) {} }
      measAddPoint(ll, nm); } return true; }
  return fanOpen(id, key);
}

// ---- relief-phone (decisions 2026-11-21 · Review of the map-upgrades-review report, Q14, Q18-Q19): "מפה עם תבליט" - the relief drawn on the phone ----
// from Mapterhorn's terrain tiles (512-px Terrarium WebP; the provider row `mapterhorn`), as the relief-compare prototype draws it: a Leaflet grid of
// canvases over the regular map; the work in a worker (reliefCore - the heights decoded, the shading computed, a bitmap handed back); "lazy" seams (a
// tile drawn before its neighbour arrived is drawn again once it is known, no new download); four lights weighted by their angle to the slope; a z-factor
// by zoom; bicubic overzoom past the deepest data of the place; transparent shading (shadows darken, lit slopes lighten, flat ground untouched), so the
// same layer lies over the light map and the dark one. The tiles come through the one client (service `relief`; reliefAsk) - the worker never asks the
// network: it asks the page, which answers with the bytes. Its height cache keeps ~12 decoded 512-px tiles (~12 MB). Esri's hillshade left the app.
// When Mapterhorn does not answer (Q19): no other source - the relief is not drawn, the map says "התבליט לא זמין כרגע" (reliefLine), and it is asked
// again when the service is back; what the height cache holds keeps drawing.
function isDarkUI() { const t = document.documentElement.dataset.theme; return t === 'dark' || (t !== 'light' && !!(window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches)); }
// hebrew-map: one reaction to a theme change (the phone's, or the app's own - applyTheme): the relief redraws its shading (relief-phone: dark shadows in dark mode), the Hebrew map its dark style
function mapThemeChanged() { if (groupHas('special-maps')) groupFn('special-maps', 'heStyleReset')(); /* diet-groups: no style kept while its group is out */ if (M3.map) groupFn('special-maps', 'm3ThemeChanged')(); if (baseMapId() === 'relief' || baseMapId() === 'he') refreshBaseMaps(); }
try { const mq = matchMedia('(prefers-color-scheme: dark)'); sysOn(mq, 'change', () => mapThemeChanged()); } catch (e) {}
const RELIEF = { w: null, core: null, seq: 0, wait: new Map(), down: false, retryT: 0, slow: 12e3 }; // slow: no answer for that long says "not available"
// one 512-px terrain tile for the core, through the one client (a page for people has no relief - FMAP_STUB)
function reliefGet(z, x, y) { return reliefAsk(svcTileUrl('mapterhorn').replace('{z}', z).replace('{x}', x).replace('{y}', y)); }
function reliefAsk(u) { const slow = setTimeout(() => { if (svcOnline()) reliefState(true); }, RELIEF.slow); // busy (the client waits 30 s → 2 → 10 min) or no answer: said after 12 s
  return svcAsk('relief', { build: p => p === 'mapterhorn' ? { url: u, as: 'bytes', empty404: true, ms: 15000 } : null, parse: d => d })
  .then(r => { clearTimeout(slow); if (r.kind === 'ok' || r.kind === 'empty') { reliefState(false); return r.kind === 'ok' ? { b: r.value } : { none: 1 }; } if (r.kind !== 'offline') reliefState(true); return null; }); }
// whether Mapterhorn answers: a failure (not "no network") shows the line on every map with relief and asks again in 2 minutes; an answer clears it
function reliefState(down) { if (RELIEF.down === down) return; RELIEF.down = down; reliefLines();
  clearTimeout(RELIEF.retryT); if (down) RELIEF.retryT = setTimeout(reliefAgain, 120e3); }
function reliefAgain() { LIVE_MAPS.forEach(m => { try { if (m.getContainer().isConnected) (m._baseLayers || []).forEach(l => { if (l._relief) l.redraw(); }); } catch (e) {} }); }
svcOnBack(reliefAgain);
function reliefLines() { LIVE_MAPS.forEach(m => { try { reliefLine(m); } catch (e) {} }); }
const RELIEF_DOWN = 'התבליט לא זמין כרגע'; // Q19: the status line's word (map-3d's switch is not offered with the same word)
function reliefLine(map) { const c = map.getContainer && map.getContainer(); if (!c) return; const on = RELIEF.down && (map._baseLayers || []).some(l => l._relief);
  const el = c.querySelector(':scope > .relief-down'); if (!on) { if (el) el.remove(); return; }
  if (!el) c.insertAdjacentHTML('beforeend', `<div class="map-status relief-down" role="status">${msi('landscape', { size: 16 })} ${RELIEF_DOWN}</div>`); }
// diet-room: the drawing itself - the core, its worker, the shaded tile, the layer and the relief in a picture - is js/relief.js (special-maps group,
// loaded when "מפה עם תבליט" is drawn or a picture asks for it); the state, the asker and the status line stay here

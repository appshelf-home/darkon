// ---- 🗺️ the live map in the memory screen ----
var MEM_UNVISITED = false;
const MEM_MAP_VIEW = {};
function memLegendHTML(withMissed) {
  return `<div class="mem-legend"><span><i style="background:${RATE_COLOR.love}"></i>❤️ אהבנו</span><span><i style="background:${RATE_COLOR.like}"></i>👍 היה טוב</span><span><i style="background:${RATE_COLOR.dislike}"></i>👎</span><span><i style="background:${UNRATED_COLOR}"></i>בלי דירוג</span><span>${msi('hotel', { size: 16 })} לינה</span>${withMissed ? `<span><i style="background:${UNRATED_COLOR};opacity:.45"></i>לא הגענו</span>` : ''}</div>`;
}
function memMapBlockHTML(M) {
  const D = mementoData(M.t.id); if (!D || (!D.visited.length && !D.stops.length)) return '';
  const missed = (M.places || []).some(p => !(M.td.visited || []).includes(p.id) && snapCoord(p));
  const body = MAP_AVAILABLE ? `<div class="map-container mem-live" id="memMap"></div>` : memoryMapSVG(M, 360, 260);
  const fn = MEM_F.rates.size + (MEM_F.hotels ? 0 : 1) + (MEM_UNVISITED ? 1 : 0) + (MEM_F.path || !tlPaths(M.t.id).length ? 0 : 1) + (DEV.memPhotosOff && memPhotoSpots(M).length ? 1 : 0); // 10.3.0 (design-3): one filter chip; its small sheet holds the ratings and the switches (tl-paths Q3: "המסלול שהלכנו")
  // 11.6.0 (the 11.4.0 review's Q5): a city trip's map says nothing about far places - the edge arrows show them (name, km, a tap fits)
  const hint = [MAP_AVAILABLE ? 'נגיעה במקום מראה את השם והדירוג.' : '', memKind(D) === 'city' ? '' : 'כל המסלול, והלינות לפי הסדר.'].filter(Boolean).join(' ');
  // along-time-field item 10 (G123): the filter chip above the map, as the places screen's filter bar above its map (it sat under the legend, out of sight)
  return `<div class="mem-block"><h3>${msi('map', { size: 20 })} איפה ${TX.visited}</h3>${MAP_AVAILABLE ? `<div class="fbar"><button type="button" class="fpick mem-fchip" id="memFilter" data-act="memory.mf" data-active="${fn > 0}">${FUNNEL_SVG}<span>סינון${SEP}${fn ? fn + ' פעילים' : 'הכל'}</span>${msi('arrow_drop_down', { size: 18, cls: 'fp-caret' })}</button></div>` : ''}${body}${memLegendHTML(MEM_UNVISITED && missed)}
    ${hint ? `<small class="sh-hint">${hint}</small>` : ''}</div>`;
}
// 4.38.1: the travels between the stays of a remembered trip, drawn like the route map: a flight as an arc, a bus or car on
// the road (computed once and kept), a train/ferry/unknown as its own line. Built from the trip's own lodging and travels,
// so it works for an archived trip too. 11.2.0 (travels-3-maps): every travel (travelsOf); a way through its travels' confirmed
// ends with their kept paths (tvChain - no lookup here, Q10); the outings as loops (Q8, memOutings)
function memStops(M) { const st = []; M.stops.forEach(s => { const c = snapCoord(s.p), last = st[st.length - 1]; if (!c) return; if (last && distanceKm(last.c, c) < 8) { if (s.l.checkOut > last.to) last.to = s.l.checkOut; return; } st.push({ c, from: s.l.checkIn, to: s.l.checkOut }); }); return st; }
function memLegs(M) {
  const st = memStops(M), C = memTvCtx(M), R = travelRoles(M.t, C);
  const trs = travelsOf(M.t).filter(f => f.date && R.get(String(f.id)) === 'move').sort((a, b) => (a.date + (a.depart || '')).localeCompare(b.date + (b.depart || ''))), used = new Set();
  return st.slice(0, -1).map((a, i) => { const b = st[i + 1], lo = a.to <= b.from ? a.to : b.from, tr = trs.filter(f => !used.has(f) && f.date >= lo && f.date <= b.from); tr.forEach(f => used.add(f));
    const f = tr[0], mode = tr.length ? (tr.find(x => x.mode === 'flight') ? 'flight' : f.mode || 'flight') : 'none';
    return { a: a.c, b: b.c, mode, path: f && Array.isArray(f.path) && f.path.length > 1 ? f.path : null, chain: tvChain(a.c, b.c, tr, C) }; });
}
// 5.9.0 (decision מ3): a point of a past trip - the same floating card in its third state, read only: the small line with the
// rating, 🧭 and 🔍 in their fixed places (the ⭐ and 📏 slots stay empty so nothing moves); a tap opens the details window read
// only (no ✏️, "היינו" instead of the scheduling line). Ratings do not change here - an archived trip is read only.
function memSmall(x) { return [x.kind === 'hotel' ? `${x.nights === 1 ? 'לילה אחד' : x.nights + ' לילות'}` : x.kind === 'missed' ? 'לא הגענו' : TX.visited, x.r ? RATE[x.r] : '', x.w ? '"' + escH(x.w) + '"' : '', x.hi ? msiT('celebration', 'רגע שיא') : ''].filter(Boolean); } // 10.15.0 (design-review Q14): celebration (✨ is Claude's)
function memNav(x) { return navUrl(x.c.lat.toFixed(6) + ',' + x.c.lng.toFixed(6)); }
function memCard(x) {
  const p = x.p, esc = escH;
  const html = cdCard({ cls: 'mc-card mc-ro', lead: x.kind === 'hotel' ? leadHTML('place', msi('hotel', { size: 18 }), 'var(--primary)') : leadHTML(x.kind === 'missed' ? 'grey' : 'place', typeIcon(p.icon, { size: 18 }), x.color || p.color), name: esc(x.name),
    tags: [cdMeta(memSmall(x))], desc: p.description ? `<span class="mc-desc">${esc(p.description)}</span>` : '',
    acts: `<div class="tl-acts mc-acts">${linkBtn('tl-act a-nav', memNav(x), actIc('navigation'), 'ניווט')}${linkBtn('tl-act a-g', googleInfoUrl(p.name, p.address), actIc('travel_explore'), 'חיפוש ב-Google')}</div>` });
  openFloatCard('memMap', html, null, null, () => { closeFloatCard('memMap'); openCandWin({ lead: x.kind === 'hotel' ? leadHTML('place', msi('hotel', { size: 18 }), 'var(--primary)') : leadHTML('place', typeIcon(p.icon, { size: 18 }), x.color || p.color), name: x.name,
    pick: { label: memSmall(x)[0], disabled: true }, small: memSmall(x).slice(1), nav: memNav(x), search: googleInfoUrl(p.name, p.address), searchLabel: 'שעות, אתר וביקורות ב-Google',
    what: () => p.description ? `<p class="iw-desc open">${esc(p.description)}</p>` : '' }); });
}
function initMemMap(M) {
  const host = document.getElementById('memMap'); if (!host) return;
  const id = M.t.id, D = mementoData(id), I = memItems(M, MEM_UNVISITED), kind = memKind(D);
  if (MEM_F.rates.size) I.places = I.places.filter(x => MEM_F.rates.has(x.r || 'none')); if (!MEM_F.hotels) I.hotels = []; // 10.3.0: the filter chip's choices
  // 5.9.0: the one map component (◎, ⛶, the map type, 📏 and the floating card like every map); the memory keeps its own frame and view
  const MM = mapMake('memMap', { loading: false, restore: null, track: false }); if (!MM) return; const map = MM.map;
  const fr = memFrame(I.places.concat(I.hotels), kind), view = MEM_MAP_VIEW[id];
  if (view) map.setView(view.c, view.z); else if (fr.core.length) map.fitBounds(L.latLngBounds(fr.core.map(x => [x.c.lat, x.c.lng])), { padding: [26, 26], maxZoom: 16 });
  map.on('moveend', () => { MEM_MAP_VIEW[id] = { c: map.getCenter(), z: map.getZoom() }; });
  const legs = memLegs(M);
  const drawLegs = () => { (map._memLegs || []).forEach(x => { try { map.removeLayer(x); } catch (e) {} }); map._memLegs = [];
    legs.forEach(l => { if (l.chain) { l.chain.forEach(sg => { const S = ROUTE_STYLE[sg.mode] || ROUTE_STYLE.none; map._memLegs.push(L.polyline(sg.pts, { color: S.color, weight: S.w, opacity: sg.approx ? .4 : .6, dashArray: sg.approx ? '4 6' : S.dash || null, interactive: false }).addTo(map)); }); return; } const S = ROUTE_STYLE[l.mode] || ROUTE_STYLE.none, road = l.mode === 'car' || l.mode === 'bus', cached = road && !l.path ? roadPathGet(l.a, l.b) : null;
      const line = l.path || (cached && cached.path) || (l.mode === 'flight' ? arcPoints(l.a, l.b) : [[l.a.lat, l.a.lng], [l.b.lat, l.b.lng]]);
      map._memLegs.push(L.polyline(line, { color: S.color, weight: S.w, opacity: .6, dashArray: S.dash || null, interactive: false }).addTo(map));
      if (road && !l.path && !cached && !l.asked) { l.asked = true; roadPathWant(l.a, l.b).then(v => { if (v && MAPS.memMap && MAPS.memMap.map === map) drawLegs(); }); } }); };
  // 11.9.0 (timeline-import, Q1): each day's real path from Google Timeline, under the moves and the travels (their kept paths are not replaced);
  // tl-paths (Q2-Q3): cleaned segments - walking a solid line, a ride a dashed lighter one, both in the --visited token (the CSS of .gl-walk /
  // .gl-ride); hidden by the filter's "המסלול שהלכנו"
  if (MEM_F.path) tlPaths(id).forEach(g => L.polyline(g.p, { weight: g.m === 'r' ? 2.5 : 3, className: 'gl-path ' + (g.m === 'r' ? 'gl-ride' : 'gl-walk'), interactive: false }).addTo(map));
  if (legs.length) drawLegs();
  memOutings(M, memStops(M)).forEach(o => { tvLoop(o.c, o.g).forEach(pts => L.polyline(pts, { color: ROUTE_STYLE.none.color, weight: 3, opacity: .6, dashArray: '6 6', className: 'rt-out', interactive: false }).addTo(map)); // Q8: an outing, a loop
    L.marker([o.g.lat, o.g.lng], { interactive: false, icon: L.divIcon({ className: '', html: `<div class="rt-goal">${msi(TRAVEL_MS[o.mode] || 'flight', { size: 14 })}<b class="rt-lbl">${escH(o.name)}${SEP}טיול יום</b></div>`, iconSize: [26, 26], iconAnchor: [13, 13] }), zIndexOffset: 400 }).addTo(map); });
  if (!legs.length && I.hotels.length > 1) L.polyline(I.hotels.map(h => [h.c.lat, h.c.lng]), { color: '#1C2B33', weight: 3, opacity: .55, dashArray: '6 6' }).addTo(map);
  // 4.38.1: the places sit above the hotels (their own pane), and are a little bigger when the map is zoomed far out
  try { if (!map.getPane('memPts')) { map.createPane('memPts'); map.getPane('memPts').style.zIndex = 650; } } catch (e) {}
  const dots = [];
  I.extra.forEach(x => { const mk = L.circleMarker([x.c.lat, x.c.lng], { pane: 'memPts', radius: 5, color: '#fff', weight: 1, fillColor: UNRATED_COLOR, fillOpacity: .45, opacity: .6, bubblingMouseEvents: false }).on('click', () => memCard(x)).addTo(map); dots.push({ mk, r: 5 }); });
  I.places.slice().sort((a, b) => (a.hi || a.key ? 1 : 0) - (b.hi || b.key ? 1 : 0)).forEach(x => {
    const big = x.hi || x.key || x.r === 'love', mk = L.circleMarker([x.c.lat, x.c.lng], { pane: 'memPts', radius: big ? 9 : 6, color: '#fff', weight: 2, fillColor: x.color, fillOpacity: 1, bubblingMouseEvents: false }); dots.push({ mk, r: big ? 9 : 6 });
    mk.on('click', () => memCard(x)); // 5.9.0 (decision מ3): the floating card, read only
    if (x.hi || x.key) mk.bindTooltip(escH(x.name.slice(0, 26)), { permanent: true, direction: 'top', className: 'mem-tt', offset: [0, -8] });
    mk.addTo(map); });
  I.hotels.forEach((h, i) => L.marker([h.c.lat, h.c.lng], { icon: L.divIcon({ className: '', html: `<div class="mem-hotel">${msi('hotel')}${I.hotels.length > 1 ? `<b>${i + 1}</b>` : ''}</div>`, iconSize: [24, 24], iconAnchor: [12, 12] }), zIndexOffset: 500 })
    .on('click', () => memCard(h)).addTo(map));
  if (!DEV.memPhotosOff) memPhotoMarks(map, M); // memory-photos (Q4-Q6): the highlights' photos at their places, unless turned off on this phone
  memReplayBtn(MM, M); // trip-replay (Q10): ▶ - nothing loads or runs before the tap
  const grow = () => { let z = 12; try { z = map.getZoom(); } catch (e) {} const add = z < 7 ? 3 : z < 10 ? 1.5 : 0; dots.forEach(d => { try { d.mk.setRadius(d.r + add); } catch (e) {} });
    try { const c = map.getContainer(); c.classList.toggle('mem-far', z < 7); c.classList.toggle('mem-mid', z >= 7 && z < 10); } catch (e) {} }; // 4.38.1: the names of the highlights get small far out, and wait for a tap when the whole route is shown
  map.on('zoomend', grow); grow();
  // 11.4.0 (the 11.2.0 review's Q3): the places left out of the frame (a city trip's day trips and airport) - a live edge arrow each, as the
  // day map's far ends (mapEdgeArrows): from the frame's centre, "<name> · N ק״מ" as the memory pictures' arrows (places within 3 km are one
  // arrow, "+N"), a tap fits the frame with that place
  if (fr.far.length && fr.center) { const gs = []; fr.far.forEach(x => { const g = gs.find(y => distanceKm(y.c, x.c) < 3); if (g) g.n++; else gs.push({ c: x.c, name: x.name, n: 1 }); });
    mapEdgeArrows(map, gs.map(g => ({ c: g.c, near: fr.center, name: g.name.slice(0, 28) + (g.n > 1 ? ` +${g.n - 1}` : ''), km: distanceKm(fr.center, g.c), fit: fr.core.map(x => [x.c.lat, x.c.lng]).concat([[g.c.lat, g.c.lng]]) }))); }
}
// memory-photos (decisions 2026-11-21 · Review of the map-upgrades report, Q4-Q6): a highlight's photo sits at its highlight's place (h.placeId) -
// a highlight with no place puts no photo on the map (no GPS is read from photos); photos at one place are one stack (a tap: a small card of
// them); a tap on one photo opens the one viewer. "תמונות" in the filter turns them off for every trip on this phone (DEV.memPhotosOff, kept).
function memPhotoSpots(M) { const out = [], have = new Set(tripPhotoKeys(M.t.id));
  (M.td.highlights || []).forEach(h => { if (!h || !h.photo || !have.has(h.photo) || h.placeId == null) return; const p = M.pmap.get(h.placeId), c = p && snapCoord(p); if (!c) return;
    let s = out.find(x => x.id === h.placeId); if (!s) { s = { id: h.placeId, c, name: String(p.name || '').replace(/\s*\(.*$/, ''), ks: [] }; out.push(s); } if (!s.ks.includes(h.photo)) s.ks.push(h.photo); });
  return out.map(s => ({ ...s, ks: s.ks.slice(0, MEMO_PHOTO_MAX) })); }
function memTripHasPhotoSpots(id) { const M = tripMemoryData(id); return !!M && memPhotoSpots(M).length > 0; }
function memPhotoIconHTML(k, u, n) { return `<span class="mem-ph${n > 1 ? ' mem-ph-st' : ''}"><span class="ph-cut">${photoImgHTML(k, u)}</span>${n > 1 ? `<b>${n}</b>` : ''}</span>`; }
function memPhotoMarks(map, M, only, pane) { const S = memPhotoSpots(M).filter(s => !only || only.has(s.id)), mks = [];
  try { if (!pane && !map.getPane('memPhs')) { map.createPane('memPhs'); map.getPane('memPhs').style.zIndex = 655; } } catch (e) {}
  S.forEach(s => { const u = photoUrl(s.ks[0]); if (!u) return;
    const mk = L.marker([s.c.lat, s.c.lng], { pane: pane || 'memPhs', keyboard: false, title: s.name, icon: L.divIcon({ className: 'mem-ph-ic', html: memPhotoIconHTML(s.ks[0], u, s.ks.length), iconSize: [48, 48], iconAnchor: [24, 54] }), bubblingMouseEvents: false })
      .on('click', () => { if (s.ks.length === 1) openPhotoView({ key: s.ks[0], name: s.name }); else memPhotoStack(map, s); }).addTo(map); mks.push(mk); });
  return mks; }
function memPhotoStack(map, s) { const host = map.getContainer().parentElement; if (!host || !host.id) return;
  openFloatCard(host.id, cdCard({ cls: 'mc-card mc-ro', lead: leadHTML('place', msi('photo_library', { size: 18 }), 'var(--primary)'), name: escH(s.name), tags: [cdMeta([`${s.ks.length} תמונות`])],
    desc: `<div class="ph-row mem-ph-row">${s.ks.map(k => photoThumbHTML(k, { data: `data-name="${escH(s.name)}"` })).join('')}</div>` }), null, null, () => { closeFloatCard(host.id); openPhotoView({ key: s.ks[0], name: s.name }); }); } // pulled up (its details): the first photo in the viewer
const MEM_F = { rates: new Set(), hotels: true, path: true, trip: null }; // the memory map's filter (this visit only); path: tl-paths (Q3); trip: the trip whose map it filters (its "המסלול שהלכנו" only when it has a path)
const MEM_RATES = [['love', 'אהבנו'], ['like', 'היה טוב'], ['dislike', 'לא שווה'], ['none', 'בלי דירוג']];
function openMemFilter(id) { const ctl = {}; layerNote(openMemFilter, arguments); const sheet = document.getElementById('sheet'); MEM_F.trip = id || null;
  const sw = (k, on, label) => `<div class="fm-f fm-togrow"><button type="button" class="fm-tog t-wrap" role="switch" aria-checked="${on}" data-act="memFilter.mt" data-mt="${k}"><span class="fm-sw" aria-hidden="true"></span><span class="fm-togl">${label}</span></button></div>`;
  const draw = () => { sheet.innerHTML = `${fmHead(msi('tune') + ' סינון המפה', 'mfClose')}<div class="fsec"><div class="fsec-h">דירוג</div>${choiceSetHTML([{ v: '', html: 'הכל', on: !MEM_F.rates.size }].concat(MEM_RATES.map(([v, l]) => ({ v, html: l, on: MEM_F.rates.has(v) }))), { as: 'chips', act: 'memFilter.mr' })}</div>
    <div class="fsec">${sw('hotels', MEM_F.hotels, 'הלינות')}${sw('missed', MEM_UNVISITED, 'גם מה שלא הגענו אליו')}${MEM_F.trip && tlPaths(MEM_F.trip).length ? sw('path', MEM_F.path, 'המסלול שהלכנו') : ''}${MEM_F.trip && memTripHasPhotoSpots(MEM_F.trip) ? sw('photos', !DEV.memPhotosOff, 'תמונות') : ''}</div>`; };
  const redo = () => { draw(); redrawSoon(); };
  ctl.mr = b => { const v = b.dataset.v; if (!v) MEM_F.rates.clear(); else if (MEM_F.rates.has(v)) MEM_F.rates.delete(v); else MEM_F.rates.add(v); if (MEM_F.rates.size === MEM_RATES.length) MEM_F.rates.clear(); redo(); };
  ctl.mt = b => { const k = b.dataset.mt; if (k === 'hotels') MEM_F.hotels = !MEM_F.hotels; else if (k === 'path') MEM_F.path = !MEM_F.path; else if (k === 'photos') devSet({ memPhotosOff: !DEV.memPhotosOff }); else MEM_UNVISITED = !MEM_UNVISITED; redo(); };
  draw(); showSheetBackdrop('openMemFilter'); layerTop().ctl = ctl; }
ctlActs('memFilter', ['mr', 'mt']);
act('memory.mf', () => { openMemFilter(memoryTrip); return 'quiet'; });
// ---- ▶ play the trip on the memory map (trip-replay, merged into memory-photos) ----
// decisions 2026-11-21 · Review of the map-upgrades report, Q10; 2026-11-21 · Review of the queue (evening), Q2. A ▶ on the memory map (and so
// in its full screen - the same host): nothing is read or drawn before the tap. Day after day: the map frames the day, its path draws itself
// (the cleaned Timeline segments of that day - tlPaths' d -, else the move between two stays that lands that day, as the memory map draws it),
// then the day's places light up in their rating's colour, with their photo (memory-photos, unless turned off on this phone). The days before
// stay drawn, quieter. A bar under the map: play / pause, a day back and forward, "יום N מתוך M" (a tap: the list of days, to jump), the
// speed (×1, ×2, ×4); while it plays the ▶ in the map's corner is ✕, which ends it. 2D on the existing map; no service and no request, so it plays offline over a downloaded area. One timer, cleared
// by ✕, by the end of a day's play when paused, and when the map goes (its 'unload' - leaving the screen, a redraw): nothing stays behind (LIFE).
const RP = { R: null }; // the replay playing now: { id, map, host, D, i, f, lit, speed, playing, t, L: { past, now, pts } }
const RP_DIM = [['overlayPane', 'rp-dim'], ['markerPane', 'rp-dim'], ['memPts', 'rp-dim'], ['memPhs', 'rp-hide']]; // while it plays: the memory's own layers step back, its photos wait
const REPLAY_SPEEDS = [1, 2, 4], REPLAY_DAY_MS = 3600, REPLAY_TICK = 60;
function memReplayBtn(MM, M) {
  const host = MM.el; if (!host || dayList(M.t.start, M.t.end).length < 2) return;
  const b = document.createElement('button'); b.type = 'button'; b.className = 'rp-btn'; b.dataset.v = M.t.id; b.innerHTML = msi('play_arrow', { cls: 'rp-go' }) + msi('close', { cls: 'rp-x' }); host.appendChild(b); mapCtl(b); replayBtnSync(b, false);
  MM.map.on('unload', () => { if (RP.R && RP.R.map === MM.map) replayStop(true); });
}
function replayBtnSync(b, on) { if (!b) return; if (on) b.dataset.act = 'replay.close'; else b.dataset.act = 'replay.start'; const t = on ? 'סיום הניגון' : 'לנגן את הטיול יום אחר יום'; b.setAttribute('aria-label', t); b.title = t; }
// the days, read at the tap: each day's places (a Timeline visit's day, else the plan's day), its path segments, its move and its stay
function replayDays(M) {
  const days = dayList(M.t.start, M.t.end), vis = new Set(M.td.visited || []), rate = M.td.rating || {}, tlv = ((M.td.tl || {}).v) || {}, at = new Map();
  Object.keys(tlv).forEach(k => { const v = tlv[k]; if (v && v.d && vis.has(Number(k))) at.set(Number(k), v.d); });
  days.forEach(d => { const it = (M.td.itinerary || {})[d.key] || {}; ['morning', 'afternoon', 'evening', 'unassigned'].flatMap(k => it[k] || []).forEach(id => { if (typeof id === 'number' && vis.has(id) && !at.has(id)) at.set(id, d.date); }); });
  (M.t.schedule || []).forEach(s => { const id = s.placeId != null ? Number(s.placeId) : null; if (id != null && vis.has(id) && !at.has(id) && s.date) at.set(id, s.date); });
  const segs = tlPaths(M.t.id), st = memStops(M), legs = memLegs(M), nm = p => String(p.name || '').replace(/\s*\(.*$/, '');
  const legLine = l => l.chain ? l.chain.map(sg => sg.pts) : [l.path || ((l.mode === 'car' || l.mode === 'bus') && (roadPathGet(l.a, l.b) || {}).path) || (l.mode === 'flight' ? arcPoints(l.a, l.b) : [[l.a.lat, l.a.lng], [l.b.lat, l.b.lng]])];
  return days.map(d => {
    const places = [...at].filter(([, dd]) => dd === d.date).map(([id]) => M.pmap.get(id)).filter(p => p && snapCoord(p)).map(p => ({ id: p.id, c: snapCoord(p), color: rateColor((rate[p.id] || {}).r || ''), name: nm(p) }));
    let paths = segs.filter(g => g.d === d.date).map(g => ({ m: g.m, p: g.p }));
    if (!paths.length) legs.forEach((l, i) => { if (st[i + 1] && st[i + 1].from === d.date) legLine(l).forEach(p => { if (p && p.length > 1) paths.push({ m: 'move', p }); }); });
    const stay = st.find(s => s.from <= d.date && d.date < s.to) || null, stayP = stay && M.stops.find(s => { const c = snapCoord(s.p); return c && distanceKm(c, stay.c) < 8; });
    return { date: d.date, title: [tmFmt('day', d.date), stayP ? nm({ name: stayP.l.name || stayP.p.name }) : ''].filter(Boolean).join(SEP), places, paths, stay: stay ? stay.c : null };
  });
}
act('replay.start', c => { const M = tripMemoryData(c.v), R = MAPS.memMap; if (!M || !R) return 'quiet'; replayStop(true);
  const host = document.getElementById('memMap'), map = R.map, D = replayDays(M);
  RP.R = { id: M.t.id, M, map, host, D, i: 0, f: 0, lit: false, speed: REPLAY_SPEEDS[0], playing: true, t: null, L: { past: [], now: [], pts: [] }, view: { c: map.getCenter(), z: map.getZoom() } };
  try { [['rpLines', 640], ['rpPts', 670]].forEach(([n, z]) => { if (!map.getPane(n)) { map.createPane(n); map.getPane(n).style.zIndex = z; } }); } catch (e) {}
  RP_DIM.forEach(([n, c]) => { const p = map.getPane(n); if (p) p.classList.add(c); }); host.classList.add('rp-on'); closeFloatCard('memMap'); replayBtnSync(host.querySelector(':scope > .rp-btn'), true);
  const bar = document.createElement('div'); bar.className = 'rp-bar'; bar.setAttribute('role', 'group'); bar.setAttribute('aria-label', 'ניגון הטיול'); host.appendChild(bar); mapCtl(bar);
  replayDay(0); replayRun(); return 'quiet'; });
function replayBarHTML() { const R = RP.R, n = R.D.length, d = R.D[R.i], b = (a, ic, label, dis) => `<button type="button" class="rp-b" ${a} aria-label="${escH(label)}" title="${escH(label)}"${dis ? ' disabled' : ''}>${ic}</button>`;
  const end = !R.playing && R.i === n - 1 && R.f >= 1;
  return `${b('data-act="replay.toggle"', R.playing ? msi('pause') : end ? msi('replay') : msi('play_arrow'), R.playing ? 'השהיה' : end ? 'מההתחלה' : 'המשך')}${b('data-act="replay.prev"', msi('skip_previous', { cls: 'rp-sk' }), 'היום הקודם', R.i === 0)}
    <span class="rp-day">${fmSelect({ cls: 'rp-pick', act: 'replay.jump', value: R.i, options: R.D.map((x, j) => [j, `יום ${j + 1} מתוך ${n}`]) })}<small class="rp-t">${escH(d.title)}</small></span>
    ${b('data-act="replay.next"', msi('skip_next', { cls: 'rp-sk' }), 'היום הבא', R.i === n - 1)}<button type="button" class="rp-b rp-sp" data-act="replay.speed" aria-label="מהירות ×${R.speed}" title="מהירות">×${R.speed}</button>`; }
function replayBar() { const R = RP.R; if (!R) return; const bar = R.host.querySelector(':scope > .rp-bar'); if (bar) bar.innerHTML = replayBarHTML(); }
function replayClear(k) { const R = RP.R; R.L[k].forEach(x => { try { R.map.removeLayer(x); } catch (e) {} }); R.L[k] = []; }
function replayLine(pts, now, m) { return L.polyline(pts, { pane: 'rpLines', interactive: false, weight: now ? 5 : 3, className: `rp-line ${now ? 'rp-now' : 'rp-past'}${m === 'r' || m === 'move' ? ' rp-ride' : ''}` }).addTo(RP.R.map); }
// day i: the days before it drawn whole and quiet, its own path from nothing, the map framed on it
function replayDay(i) { const R = RP.R, map = R.map; R.i = i; R.f = 0; R.lit = false; ['past', 'now', 'pts'].forEach(replayClear);
  R.D.slice(0, i).forEach(d => d.paths.forEach(g => R.L.past.push(replayLine(g.p, false, g.m))));
  const d = R.D[i], b = d.places.map(x => [x.c.lat, x.c.lng]).concat(...d.paths.map(g => g.p)).concat(d.stay ? [[d.stay.lat, d.stay.lng]] : []);
  if (b.length) { try { map.flyToBounds(L.latLngBounds(b), { padding: [40, 40], maxZoom: 15, duration: Math.max(.4, 1 / R.speed) }); } catch (e) {} }
  d.paths.forEach(g => R.L.now.push(replayLine([g.p[0]], true, g.m))); replayBar(); }
// f (0..1) of the day: its path drawn up to 60%, then its places and photos light up
function replayDraw() { const R = RP.R, d = R.D[R.i], tot = d.paths.reduce((n, g) => n + g.p.length, 0); let left = Math.ceil(tot * Math.min(1, R.f / .6));
  d.paths.forEach((g, j) => { const k = Math.max(1, Math.min(g.p.length, left)); left -= g.p.length; try { R.L.now[j].setLatLngs(g.p.slice(0, k)); } catch (e) {} });
  if (R.f >= .6 && !R.lit) { R.lit = true;
    d.places.forEach(x => R.L.pts.push(L.circleMarker([x.c.lat, x.c.lng], { pane: 'rpPts', radius: 9, color: '#fff', weight: 2.5, fillColor: x.color, fillOpacity: 1, className: 'rp-pt', interactive: false }).bindTooltip(escH(x.name.slice(0, 26)), { permanent: true, direction: 'top', className: 'mem-tt', offset: [0, -9] }).addTo(R.map)));
    if (!DEV.memPhotosOff) R.L.pts.push(...memPhotoMarks(R.map, R.M, new Set(d.places.map(x => x.id)), 'rpPts')); } }
function replayRun() { const R = RP.R; if (!R) return; clearTimeout(R.t); R.t = null; if (!R.playing) return;
  R.t = setTimeout(() => { if (RP.R !== R) return; R.f += REPLAY_TICK * R.speed / REPLAY_DAY_MS; replayDraw();
    if (R.f >= 1) { if (R.i < R.D.length - 1) replayDay(R.i + 1); else { R.f = 1; R.playing = false; replayBar(); return; } }
    replayRun(); }, REPLAY_TICK); }
// a day shown at once (a jump, a day back or forward while paused): drawn whole
function replayGo(i) { const R = RP.R; replayDay(Math.max(0, Math.min(R.D.length - 1, i))); if (!R.playing) { R.f = 1; replayDraw(); replayBar(); } else replayRun(); }
function replayStop(quiet) { const R = RP.R; if (!R) return; clearTimeout(R.t); RP.R = null;
  if (!R.map._removed) { RP_DIM.forEach(([n, c]) => { const p = R.map.getPane(n); if (p) p.classList.remove(c); }); R.L.past.concat(R.L.now, R.L.pts).forEach(x => { try { R.map.removeLayer(x); } catch (e) {} }); if (!quiet) try { R.map.setView(R.view.c, R.view.z); } catch (e) {} }
  if (R.host) { R.host.classList.remove('rp-on'); const bar = R.host.querySelector(':scope > .rp-bar'); if (bar) bar.remove(); replayBtnSync(R.host.querySelector(':scope > .rp-btn'), false); } }
act('replay.toggle', () => { const R = RP.R; if (!R) return 'quiet'; if (!R.playing && R.i === R.D.length - 1 && R.f >= 1) { R.playing = true; replayDay(0); } else R.playing = !R.playing; replayBar(); replayRun(); return 'quiet'; });
act('replay.prev', () => { if (RP.R) replayGo(RP.R.i - 1); return 'quiet'; });
act('replay.next', () => { if (RP.R) replayGo(RP.R.i + 1); return 'quiet'; });
act('replay.jump', c => { if (RP.R) replayGo(Number(c.el.value)); return 'quiet'; });
act('replay.speed', () => { const R = RP.R; if (!R) return 'quiet'; R.speed = REPLAY_SPEEDS[(REPLAY_SPEEDS.indexOf(R.speed) + 1) % REPLAY_SPEEDS.length]; replayBar(); return 'quiet'; });
act('replay.close', () => { replayStop(); return 'quiet'; });

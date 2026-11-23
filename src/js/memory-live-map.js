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
  const fn = MEM_F.rates.size + (MEM_F.hotels ? 0 : 1) + (MEM_UNVISITED ? 1 : 0); // 10.3.0 (design-3): one filter chip; its small sheet holds the ratings and two switches
  // 11.6.0 (the 11.4.0 review's Q5): a city trip's map says nothing about far places - the edge arrows show them (name, km, a tap fits)
  const hint = [MAP_AVAILABLE ? 'נגיעה במקום מראה את השם והדירוג.' : '', memKind(D) === 'city' ? '' : 'כל המסלול, והלינות לפי הסדר.'].filter(Boolean).join(' ');
  return `<div class="mem-block"><h3>${msi('map', { size: 20 })} איפה ${TX.visited}</h3>${body}${memLegendHTML(MEM_UNVISITED && missed)}
    ${MAP_AVAILABLE ? `<div class="fbar"><button type="button" class="fpick mem-fchip" id="memFilter" data-act="memory.mf" data-active="${fn > 0}">${FUNNEL_SVG}<span>סינון${SEP}${fn ? fn + ' פעילים' : 'הכל'}</span>${msi('arrow_drop_down', { size: 18, cls: 'fp-caret' })}</button></div>` : ''}
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
function memSmall(x) { return [x.kind === 'hotel' ? `${x.nights === 1 ? 'לילה אחד' : x.nights + ' לילות'}` : x.kind === 'missed' ? 'לא הגענו' : TX.visited, x.r ? RATE[x.r] : '', x.w ? '"' + _escH(x.w) + '"' : '', x.hi ? msiT('celebration', 'רגע שיא') : ''].filter(Boolean); } // 10.15.0 (design-review Q14): celebration (✨ is Claude's)
function memNav(x) { return navUrl(x.c.lat.toFixed(6) + ',' + x.c.lng.toFixed(6)); }
function memCard(x) {
  const p = x.p, esc = _escH;
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
  tlPaths(id).forEach(p => L.polyline(p, { color: '#2E7D32', weight: 3, opacity: .75, className: 'gl-path', interactive: false }).addTo(map)); // 11.9.0 (timeline-import, Q1): each day's real path from Google Timeline, under the moves and the travels (their kept paths are not replaced)
  if (legs.length) drawLegs();
  memOutings(M, memStops(M)).forEach(o => { tvLoop(o.c, o.g).forEach(pts => L.polyline(pts, { color: ROUTE_STYLE.none.color, weight: 3, opacity: .6, dashArray: '6 6', className: 'rt-out', interactive: false }).addTo(map)); // Q8: an outing, a loop
    L.marker([o.g.lat, o.g.lng], { interactive: false, icon: L.divIcon({ className: '', html: `<div class="rt-goal">${msi(TRAVEL_MS[o.mode] || 'flight', { size: 14 })}<b class="rt-lbl">${_escH(o.name)}${SEP}טיול יום</b></div>`, iconSize: [26, 26], iconAnchor: [13, 13] }), zIndexOffset: 400 }).addTo(map); });
  if (!legs.length && I.hotels.length > 1) L.polyline(I.hotels.map(h => [h.c.lat, h.c.lng]), { color: '#1C2B33', weight: 3, opacity: .55, dashArray: '6 6' }).addTo(map);
  // 4.38.1: the places sit above the hotels (their own pane), and are a little bigger when the map is zoomed far out
  try { if (!map.getPane('memPts')) { map.createPane('memPts'); map.getPane('memPts').style.zIndex = 650; } } catch (e) {}
  const dots = [];
  I.extra.forEach(x => { const mk = L.circleMarker([x.c.lat, x.c.lng], { pane: 'memPts', radius: 5, color: '#fff', weight: 1, fillColor: UNRATED_COLOR, fillOpacity: .45, opacity: .6, bubblingMouseEvents: false }).on('click', () => memCard(x)).addTo(map); dots.push({ mk, r: 5 }); });
  I.places.slice().sort((a, b) => (a.hi || a.key ? 1 : 0) - (b.hi || b.key ? 1 : 0)).forEach(x => {
    const big = x.hi || x.key || x.r === 'love', mk = L.circleMarker([x.c.lat, x.c.lng], { pane: 'memPts', radius: big ? 9 : 6, color: '#fff', weight: 2, fillColor: x.color, fillOpacity: 1, bubblingMouseEvents: false }); dots.push({ mk, r: big ? 9 : 6 });
    mk.on('click', () => memCard(x)); // 5.9.0 (decision מ3): the floating card, read only
    if (x.hi || x.key) mk.bindTooltip(_qe(x.name.slice(0, 26)), { permanent: true, direction: 'top', className: 'mem-tt', offset: [0, -8] });
    mk.addTo(map); });
  I.hotels.forEach((h, i) => L.marker([h.c.lat, h.c.lng], { icon: L.divIcon({ className: '', html: `<div class="mem-hotel">${msi('hotel')}${I.hotels.length > 1 ? `<b>${i + 1}</b>` : ''}</div>`, iconSize: [24, 24], iconAnchor: [12, 12] }), zIndexOffset: 500 })
    .on('click', () => memCard(h)).addTo(map));
  const grow = () => { let z = 12; try { z = map.getZoom(); } catch (e) {} const add = z < 7 ? 3 : z < 10 ? 1.5 : 0; dots.forEach(d => { try { d.mk.setRadius(d.r + add); } catch (e) {} });
    try { const c = map.getContainer(); c.classList.toggle('mem-far', z < 7); c.classList.toggle('mem-mid', z >= 7 && z < 10); } catch (e) {} }; // 4.38.1: the names of the highlights get small far out, and wait for a tap when the whole route is shown
  map.on('zoomend', grow); grow();
  // 11.4.0 (the 11.2.0 review's Q3): the places left out of the frame (a city trip's day trips and airport) - a live edge arrow each, as the
  // day map's far ends (mapEdgeArrows): from the frame's centre, "<name> · N ק״מ" as the memory pictures' arrows (places within 3 km are one
  // arrow, "+N"), a tap fits the frame with that place
  if (fr.far.length && fr.center) { const gs = []; fr.far.forEach(x => { const g = gs.find(y => distanceKm(y.c, x.c) < 3); if (g) g.n++; else gs.push({ c: x.c, name: x.name, n: 1 }); });
    mapEdgeArrows(map, gs.map(g => ({ c: g.c, near: fr.center, name: g.name.slice(0, 28) + (g.n > 1 ? ` +${g.n - 1}` : ''), km: distanceKm(fr.center, g.c), fit: fr.core.map(x => [x.c.lat, x.c.lng]).concat([[g.c.lat, g.c.lng]]) }))); }
}
const MEM_F = { rates: new Set(), hotels: true }; // the memory map's filter (this visit only)
const MEM_RATES = [['love', 'אהבנו'], ['like', 'היה טוב'], ['dislike', 'לא שווה'], ['none', 'בלי דירוג']];
function openMemFilter() { const ctl = {}; layerNote(openMemFilter, arguments); const sheet = document.getElementById('sheet');
  const sw = (k, on, label) => `<div class="fm-f fm-togrow"><button type="button" class="fm-tog t-wrap" role="switch" aria-checked="${on}" data-act="memFilter.mt" data-mt="${k}"><span class="fm-sw" aria-hidden="true"></span><span class="fm-togl">${label}</span></button></div>`;
  const draw = () => { sheet.innerHTML = `${fmHead(msi('tune') + ' סינון המפה', 'mfClose')}<div class="fsec"><div class="fsec-h">דירוג</div>${choiceSetHTML([{ v: '', html: 'הכל', on: !MEM_F.rates.size }].concat(MEM_RATES.map(([v, l]) => ({ v, html: l, on: MEM_F.rates.has(v) }))), { as: 'chips', act: 'memFilter.mr' })}</div>
    <div class="fsec">${sw('hotels', MEM_F.hotels, 'הלינות')}${sw('missed', MEM_UNVISITED, 'גם מה שלא הגענו אליו')}</div>`; };
  const redo = () => { draw(); redrawSoon(); };
  ctl.mr = b => { const v = b.dataset.v; if (!v) MEM_F.rates.clear(); else if (MEM_F.rates.has(v)) MEM_F.rates.delete(v); else MEM_F.rates.add(v); if (MEM_F.rates.size === MEM_RATES.length) MEM_F.rates.clear(); redo(); };
  ctl.mt = b => { if (b.dataset.mt === 'hotels') MEM_F.hotels = !MEM_F.hotels; else MEM_UNVISITED = !MEM_UNVISITED; redo(); };
  draw(); showSheetBackdrop('openMemFilter'); layerTop().ctl = ctl; }
ctlActs('memFilter', ['mr', 'mt']);
act('memory.mf', () => { openMemFilter(); return 'quiet'; });


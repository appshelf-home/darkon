// ================= ROUTE MAP (4.15.0) =================
// The trip's stops in order (where you sleep; the destinations when no lodging is set), the legs between them by mode,
// and the ★ key points. Zoomed out: only those; zoomed in: every place, as on the regular map. During the trip: what is
// past is pale, today's stop stands out, the next leg is marked, and the blue dot shows where you are.
const ROUTE_STYLE = { flight: { color: '#534AB7', dash: '2 8', w: 3 }, train: { color: '#0F6E56', dash: '10 5', w: 3.5 }, bus: { color: '#1C2B33', dash: null, w: 3.5 },
  car: { color: '#1C2B33', dash: null, w: 3.5 }, ferry: { color: '#185FA5', dash: '5 6', w: 3.5 }, none: { color: '#888780', dash: '1 7', w: 2.5 } };
const ROUTE_REVEAL_ZOOM = 11; // from this zoom the places themselves appear
function routeCoordOf(p) { if (!p) return null; const c = p.manualCoord || (p.address && GEOCODE_CACHE[p.address]); return c && isFinite(c.lat) && isFinite(c.lng) ? { lat: +c.lat, lng: +c.lng } : null; }
function routeVisits() { // [{ n:[numbers], name, from, to, nights, hotels:[names], places:[p], dest, coord }]
  const t = activeTripObj(); if (!t || !t.id) return [];
  const lod = (t.lodging || []).filter(l => l.checkIn && l.checkOut).slice().sort((a, b) => a.checkIn.localeCompare(b.checkIn));
  let out = [];
  if (lod.length) lod.forEach(l => { const p = l.placeId != null ? POINTS.find(q => q.id === l.placeId) : null;
    out.push({ lodgingId: l.id, name: (p && regionName(p)) || (p && p.dest && tripDests(t).length > 1 ? destName(p.dest) : '') || l.name || (p && p.name) || 'לינה', from: l.checkIn, to: l.checkOut,
      hotels: [l.name || (p && p.name) || ''].filter(Boolean), places: p ? [p] : [], dest: p ? p.dest : '', coord: routeCoordOf(p) }); });
  else (t.segments || []).forEach(sg => { const d = DESTS[sg.dest]; if (!d) return;
    out.push({ name: d.meta.name, from: sg.from, to: sg.to, hotels: [], places: [], dest: d.id, coord: d.meta.center ? { lat: d.meta.center[0], lng: d.meta.center[1] } : null }); });
  // consecutive stays a few kilometers apart (two hotels in one city) are one stop
  const merged = [];
  out.forEach(v => { const m = merged[merged.length - 1];
    if (m && ((m.coord && v.coord && distanceKm(m.coord, v.coord) < 8) || (!m.coord && !v.coord && m.name === v.name))) { m.to = v.to > m.to ? v.to : m.to; m.hotels = [...new Set(m.hotels.concat(v.hotels))]; m.places = m.places.concat(v.places); m.coord = m.coord || v.coord; }
    else merged.push({ ...v }); });
  merged.forEach((v, i) => { v.i = i; v.nights = Math.max(0, nightsBetween(v.from, v.to)); });
  // a stop is named by its city: the region of its hotel, else where the travel into it goes (or the travel out of it
  // comes from), else the destination; the hotel's name only as a last resort
  const tr = sortedTravels();
  merged.forEach((v, i) => { const p = v.places[0]; if (p && regionName(p)) { v.name = regionName(p); return; }
    const prev = merged[i - 1], inT = tr.filter(f => f.date && f.date <= v.from && (!prev || f.date >= (prev.to <= v.from ? prev.to : v.from))).pop();
    const outT = tr.find(f => f.date && f.date >= v.to && (!merged[i + 1] || f.date <= merged[i + 1].from));
    const c = (inT && inT.to) || (outT && outT.from); if (c) v.name = c; });
  return merged;
}
function routeOffered() { return hasTrip() && routeVisits().length > 1; }
// 4.24.0: hiding a stop or a leg in the route map only (the trip itself doesn't change). Personal per trip, in planX
// (so it travels in backup and only with the plan when a trip is sent). Keys are dates, the same on every device.
// 11.21.6 (phone-round-2-fixes P5): every key stored in routeHide is made through the door's own conversion (idFix, deterministic), so a
// key the door or the once pass already converted is the key the app looks up - a hidden leg or day trip stays hidden after a restore
function stopKey(v) { return idFix('v:' + v.from, null, 'key'); }
function legKey(l) { return idFix('l:' + l.a.from + '>' + l.b.from, null, 'key'); }
function routeHideMap() { const r = (STATE.planX || {}).routeHide; return r || { stops: {}, legs: {}, outs: {} }; }
function stopHidden(v) { return !!(routeHideMap().stops || {})[stopKey(v)]; }
function legHidden(l) { return !!(routeHideMap().legs || {})[legKey(l)]; }
function outHidden(o) { return !!(routeHideMap().outs || {})[outingKey(o)]; } // 11.2.0: an outing's row and loop (Q8)
function routeHiddenCount() { if (!routeOffered()) return 0; const vs = routeVisits(), legs = routeLegs(vs); return vs.filter(stopHidden).length + legs.filter(legHidden).length + routeOutings(vs).filter(outHidden).length; }
function legName(l) { return `${l.a.name} ← ${l.b.name}`; }
function setRouteHidden(kind, key, name, on) {
  planChange((on ? 'הוסתר במסלול: ' + name + SEP + 'מחזירים ב"מוסתרים" במפה או בעין ב-ℹ️' : 'מוצג במסלול: ' + name), () => { const x = planX(); x.routeHide = x.routeHide || {}; const r = x.routeHide[kind] = { ...(x.routeHide[kind] || {}) };
    if (on) r[key] = true; else delete r[key]; }, on ? 9000 : 0); // 4.37.0: longer undo, and the toast says where to bring it back
  refreshRouteHideUI();
}
function showAllRoute() { planChange('כל המסלול מוצג', () => { const x = planX(); delete x.routeHide; }); refreshRouteHideUI(); }
function refreshRouteHideUI() { if (_sheetOpen && _sheetKind === 'openRouteHidePicker' && typeof _rhDraw === 'function') _rhDraw(); }
undoAfter(() => refreshRouteHideUI()); // undo-history: the route-hide picker shows the restored plan (restorePlan used to call it)
// the rows of the route list; nav = the stop opens it on the map (the list in ℹ️ כללי), otherwise rows only toggle
function routeRowsHTML(nav) {
  const esc = escH;
  const vs = routeVisits(), legs = routeLegs(vs), iso = routeNow(), nx = nextLegIdx(legs, iso), outs = routeOutings(vs);
  const eye = (attr, i, hid, name) => `<button type="button" class="rl-eye" data-act="route.eye" data-${attr}="${i}" aria-pressed="${hid}" aria-label="${hid ? 'להציג במסלול: ' : 'להסתיר במסלול: '}${esc(name)}">${msi(hid ? 'visibility_off' : 'visibility', { size: attr === 'rhs' ? 18 : 16 })}</button>`; // one-way (6): the set's eye; the legs' eye a little smaller
  let h = '';
  vs.forEach((v, i) => { const st = visitState(v, iso), hid = stopHidden(v), tag = nav ? 'button type="button"' : 'div', end = nav ? 'button' : 'div';
    h += `<div class="rl-row${hid ? ' hid' : ''}"><${tag} class="rl-stop t-wrap ${st}"${nav ? ` data-act="route.stop" data-v="${i}"` : ''}><span class="rt-stop ${st}">${i + 1}</span><span><b>${esc(v.name)}${st === 'now' ? (SEP + 'היום') : ''}</b><small>${sepTie(visitSub(v))}${v.hotels.length ? SEP + msi('hotel', { size: 16, cls: 'msi-in' }) + '\u00a0' + esc(v.hotels.join(', ')) : ''}</small></span></${end}>${eye('rhs', i, hid, v.name)}</div>`;
    outs.forEach((o, j) => { if (o.vi !== i) return; const oh = outHidden(o); // Q8: an outing is a row under its stop, with a dashed start edge - no number of its own
      h += `<div class="rl-leg rl-out${oh ? ' hid' : ''}"><span class="rl-mode">${msi(TRAVEL_MS[o.f.mode] || 'flight', { size: 16 })}</span><span>${sepTie(outingHTML(o))}</span>${eye('rho', j, oh, 'טיול יום ל' + o.goal.name)}</div>`; });
    if (legs[i]) { const lh = legHidden(legs[i]); h += `<div class="rl-leg ${legState(legs[i], iso, nx)}${lh ? ' hid' : ''}"><span class="rl-mode">${legs[i].travels[0] ? msi(TRAVEL_MS[legs[i].travels[0].mode] || 'flight', { size: 16 }) : ''}</span><span>${sepTie(esc(legText(legs[i])))}</span>${eye('rhl', i, lh, legName(legs[i]))}</div>`; } });
  return h;
}
act('route.eye', c => { const vs = routeVisits(), legs = routeLegs(vs), b = c.el;
  if (b.dataset.rhs != null) { const v = vs[+b.dataset.rhs]; if (v) setRouteHidden('stops', stopKey(v), v.name, !stopHidden(v)); }
  else if (b.dataset.rho != null) { const o = routeOutings(vs)[+b.dataset.rho]; if (o) setRouteHidden('outs', outingKey(o), 'טיול יום ל' + o.goal.name, !outHidden(o)); }
  else { const l = legs[+b.dataset.rhl]; if (l) setRouteHidden('legs', legKey(l), legName(l), !legHidden(l)); } });
let _rhDraw = null;
act('route.showAll', () => showAllRoute());
function openRouteHidePicker() { layerNote(openRouteHidePicker, arguments);
  const sheet = document.getElementById('sheet');
  _rhDraw = () => { const n = routeHiddenCount();
    sheet.innerHTML = `${fmHead('🧭 מה מוצג במסלול ' + tipI('route.hidden'), 'rhClose')}
      <div class="sh-hint">העין מסתירה רק במפת המסלול. הטיול עצמו לא משתנה.</div>
      <div class="route-list">${routeRowsHTML(false)}</div>${n ? `<button type="button" class="btn-nav rh-all" id="rhAll" data-act="route.showAll">${msi('visibility', { size: 18 })} הצגת הכל (${n})</button>` : ''}`;
  };
  _rhDraw(); showSheetBackdrop('openRouteHidePicker');
 
}
// 11.2.0 (travels-3-maps; the 11.0.0 review): every travel of the trip (travelsOf) - mine and the group's; an outing is not a way between stops (Q8)
function sortedTravels() { return tripMoves(); } // in travelsOf's order: by date, then time - a travel with no time last on its day
function routeLegs(vs) { const used = new Set(), R = travelRoles(), ms = sortedTravels().filter(f => R.get(String(f.id)) !== 'home'); // the way from home and back is not part of the route (4.16.1, Q6)
  return vs.slice(0, -1).map((a, i) => { const b = vs[i + 1], lo = a.to <= b.from ? a.to : b.from, tr = ms.filter(f => f.date && f.date >= lo && f.date <= b.from && !used.has(f.id)); tr.forEach(f => used.add(f.id)); // the day you leave one stop up to the day you reach the next
    return { i, a, b, travels: tr, mode: tr.length ? (tr.find(f => f.mode === 'flight') ? 'flight' : tr[0].mode || 'flight') : 'none', date: tr.length ? tr[0].date : a.to }; }); }
// the outings under their stops (Q8): the stop of the night before the outing
function routeOutings(vs) { return tripOutings().map(o => { const n = isoAdd(o.date, -1); let vi = vs.findIndex(v => v.from <= n && n < v.to); if (vi < 0) vi = vs.findIndex(v => v.from <= o.date && o.date < v.to); return { ...o, vi }; }).filter(o => o.vi >= 0); }
function routeNow() { const t = activeTripObj(), iso = todayStr(); return t.start && iso >= t.start && iso <= t.end ? iso : null; }
function visitState(v, iso) { if (!iso) return ''; if (v.from <= iso && iso < v.to) return 'now'; return v.to <= iso ? 'past' : ''; } // on a move day the stop you left is past and the new one is today's
function legState(l, iso, nextIdx) { if (!iso) return ''; if (l.i === nextIdx) return 'next'; return l.date < iso ? 'past' : ''; }
function nextLegIdx(legs, iso) { if (!iso) return -1; const l = legs.find(x => x.date >= iso); return l ? l.i : -1; }
function visitDaysRange(v) { const ks = TRIP_DAYS.filter(d => d.date >= v.from && d.date <= v.to).map(d => d.key); return ks.length ? { from: ks[0], to: ks[ks.length - 1] } : null; }
function visitKeys(v) { return POINTS.filter(p => p.key && !isHiddenPoint(p) && v.coord && routeCoordOf(p) && distanceKm(v.coord, routeCoordOf(p)) < 60); }
function legText(l) { const f = l.travels[0]; if (!f) return 'מעבר (בלי נסיעה רשומה)';
  const m = TRAVEL_MODES[f.mode] || TRAVEL_MODES.flight; return `${m[1]}${SEP}${tmFmt('dayN', f.date)}${f.depart ? SEP + f.depart : ''}${f.airline || f.number ? SEP + [f.airline, f.number].filter(Boolean).join(' ') : ''}${l.travels.length > 1 ? ` (+${l.travels.length - 1})` : ''}`; }
function visitSub(v) { return `${tmFmt('range', [v.from, v.to])}${v.nights ? SEP + v.nights + ' לילות' : ''}`; } // 4.18.0: a date range reads left to right

// the list in ℹ️ כללי: stops in order with dates, nights and hotel, the leg between them, today's stop highlighted
function routeBlockHTML() {
  if (!routeOffered()) return '';
  const esc = escH;
  const vs = routeVisits(), legs = routeLegs(vs), iso = routeNow(), nx = nextLegIdx(legs, iso);
  const h = routeRowsHTML(true); // 4.16.1: the flights from home and back are not part of the route (they stay in ✈️ נסיעות); 4.24.0: 👁 per row
  return `<div class="accordion-item" data-open="true">
  <button class="accordion-header t-wrap" data-act="acc.toggle">${accLead('🧭 המסלול' + SEP + vs.length + ' תחנות')} <span class="accordion-arrow">${msi('expand_more')}</span></button>
  <div class="accordion-body"><div class="route-list">${h}</div>${MAP_AVAILABLE ? '<button type="button" class="btn-nav btn-wide" id="routeOnMap" data-act="route.map">' + msi('map', { size: 18 }) + ' על המפה</button>' : '<p class="sh-hint">המפה עובדת באפליקציה המותקנת.</p>'}</div></div>`;
}
function routeGo(i) { if (!MAP_AVAILABLE) return; resetFilter(); FP.route = true; _routeOpenStop = i; goTab('map'); }
act('route.map', () => routeGo(null));
act('route.stop', c => routeGo(+c.v));
function arcPoints(a, b) { // a gentle arc for a flight
  const mx = (a.lat + b.lat) / 2, my = (a.lng + b.lng) / 2, dx = b.lat - a.lat, dy = b.lng - a.lng, k = 0.18;
  const c = { lat: mx - dy * k, lng: my + dx * k }, pts = [];
  for (let i = 0; i <= 24; i++) { const t = i / 24, u = 1 - t; pts.push([u * u * a.lat + 2 * u * t * c.lat + t * t * b.lat, u * u * a.lng + 2 * u * t * c.lng + t * t * b.lng]); }
  return pts;
}
// 7.1.0 (ש5): the road line of a travel on the route and memory maps comes from the route service (the planning's server, by
// car), kept with the routes ("line|..."), by its shape; the demo server (router.project-osrm.org) and "קווי מסלול" are gone
function routePathKey(a, b) { return 'line|' + [a.lat, a.lng, b.lat, b.lng].map(x => (+x).toFixed(3)).join(','); }
function roadPathGet(a, b) { const e = routeStore()[routePathKey(a, b)]; return e && !e.none && e.path && svcFresh('route', e) ? e : null; }
const _rpWait = new Map();
function roadPathWant(a, b) { // a promise of {path, km, min} or null
  const k = routePathKey(a, b), have = roadPathGet(a, b); if (have) return Promise.resolve(have); if (_rpWait.has(k)) return _rpWait.get(k);
  const e = routeStore()[k]; if (e && e.none && svcFresh('route', e)) return Promise.resolve(null);
  const p = svcAsk('route', { key: k, build: () => osrmReq('car', a, b, true), parse: osrmParse }).then(r => { _rpWait.delete(k);
    if (r.kind === 'ok') { routeStore()[k] = { path: r.value.g, km: Math.round(r.value.d / 1000), min: Math.round(r.value.t / 60), at: Date.now() }; routeSave(); return routeStore()[k]; }
    if (r.kind === 'empty') { routeStore()[k] = { none: 1, at: Date.now() }; routeSave(); } return null; });
  _rpWait.set(k, p); return p;
}
function legDuration(f) { if (!f || !f.depart || !f.arrive) return ''; const [a, b] = [f.depart, f.arrive].map(x => { const [h, m] = x.split(':').map(Number); return h * 60 + m; });
  const d = b - a + (b < a ? 1440 : 0); return f.mode === 'flight' || !d ? '' : tmFmt('dur', d); } // flights cross time zones: no guessing

function renderRouteMap(containerId, pts) {
  const el = document.getElementById(containerId); if (!el) return;
  const vs = routeVisits(), legs = routeLegs(vs), iso = routeNow(), nx = nextLegIdx(legs, iso);
  let legend; {
    const modes = [...new Set(legs.map(l => l.mode))];
    legend = (`${modes.map(m => `<span>${m === 'none' ? '<i class="leg-dash"></i> מעבר' : TRAVEL_MODES[m] ? msi(TRAVEL_MS[m], { size: 16, cls: 'msi-in' }) + ' ' + TRAVEL_MODES[m][1] : m}</span>`).join('')}<span><span class="key-badge">${SYM_KEY}</span> נקודת מפתח</span><span>מתקרבים לכל המקומות</span>`); } // 10.15.0 (design-review Q13): TRAVEL_MS in the legend; the hint without 🔍
  const M = mapMake(containerId, { addHere: true, zoom: 5, legend, restore: takeMapRestore(containerId), track: false }); // 5.9.0
  if (!M) return; const map = M.map, restore = M.restore;
  trackMapView(map, containerId);
  const keyIds = new Set(POINTS.filter(p => p.key).map(p => p.id));
  // places revealed when zoomed in (the filter's layers apply to them; stops and ★ always show)
  const near = []; let shown = false;
  const reveal = () => { const on = map.getZoom() >= ROUTE_REVEAL_ZOOM; if (on === shown) return; shown = on; near.forEach(m => on ? m.addTo(map) : map.removeLayer(m)); };
  map.on('zoomend', reveal);
  const C = tvCtx(), outs = routeOutings(vs), again = w => { if (w) w.then(ok => { if (ok && MAPS[containerId] && MAPS[containerId].map === map) drawLegs(); }); };
  const drawLegs = () => {
    (map._rtLayers || []).forEach(x => map.removeLayer(x)); map._rtLayers = [];
    legs.forEach(l => { const a = l.a.coord, b = l.b.coord; if (!a || !b || legHidden(l)) return; // 4.24.0: a hidden leg goes with its line
      const st = legState(l, iso, nx), S = ROUTE_STYLE[l.mode] || ROUTE_STYLE.none, f = l.travels[0];
      const chain = tvChain(a, b, l.travels, C); // 11.2.0 (Q2): through the travels' ends - the stop, its departure point, the travel's own line, its arrival point, the next stop
      if (chain) { let mid = null, best = -1;
        chain.forEach(sg => { const S2 = ROUTE_STYLE[sg.mode] || ROUTE_STYLE.none, pl = L.polyline(sg.pts, { color: st === 'next' && !sg.link ? '#C08A2E' : S2.color, weight: sg.link ? S2.w : (st === 'next' ? S2.w + 2 : S2.w), opacity: st === 'past' ? 0.35 : sg.approx ? 0.5 : 0.85, dashArray: sg.approx ? '4 6' : S2.dash || null, className: sg.approx ? 'rt-approx' : '' }).addTo(map);
          pl.on('click', () => openLegCard(containerId, l)); map._rtLayers.push(pl); const km = sg.link ? -1 : distanceKm({ lat: sg.pts[0][0], lng: sg.pts[0][1] }, { lat: sg.pts[sg.pts.length - 1][0], lng: sg.pts[sg.pts.length - 1][1] }); if (km > best) { best = km; mid = sg.pts[Math.floor(sg.pts.length / 2)]; } });
        const mk = L.marker(mid, { icon: L.divIcon({ className: '', html: `<div class="rt-leg ${st}">${msi(TRAVEL_MS[l.mode] || 'flight', { size: 16 })}</div>`, iconSize: [26, 26], iconAnchor: [13, 13] }), zIndexOffset: 600 }).addTo(map);
        mk.on('click', () => openLegCard(containerId, l)); map._rtLayers.push(mk); chain.forEach(sg => { if (sg.f) again(travelPathWant(sg.f, C, sg.gc)); }); return; }
      const given = f && Array.isArray(f.path) && f.path.length > 1 ? f.path : null, cached = (l.mode === 'car' || l.mode === 'bus') ? roadPathGet(a, b) : null;
      const line = given || (cached && cached.path) || (l.mode === 'flight' ? arcPoints(a, b) : [[a.lat, a.lng], [b.lat, b.lng]]);
      const pl = L.polyline(line, { color: st === 'next' ? '#C08A2E' : S.color, weight: st === 'next' ? S.w + 2 : S.w, opacity: st === 'past' ? 0.35 : 0.85, dashArray: S.dash || null }).addTo(map);
      pl.on('click', () => openLegCard(containerId, l)); map._rtLayers.push(pl);
      const mid = line[Math.floor(line.length / 2)], icon = msi(l.mode === 'none' ? 'more_horiz' : TRAVEL_MS[l.mode] || 'flight', { size: 16 }); // 10.8.0 (design-icons, gap 61 part): the leg's mark in the line-icon set
      const mk = L.marker(mid, { icon: L.divIcon({ className: '', html: `<div class="rt-leg ${st}">${icon}</div>`, iconSize: [26, 26], iconAnchor: [13, 13] }), zIndexOffset: 600 }).addTo(map);
      mk.on('click', () => openLegCard(containerId, l)); map._rtLayers.push(mk);
      if ((l.mode === 'car' || l.mode === 'bus') && !given && !cached && MAP_AVAILABLE) roadPathWant(a, b).then(v => { if (v && MAPS[containerId] && MAPS[containerId].map === map) drawLegs(); });
    });
    outs.forEach(o => { const v = vs[o.vi], g = o.goal.c; if (!g || !v || !v.coord || outHidden(o) || stopHidden(v)) return; // Q8: a light dashed loop from the stop to the outing's goal and back, the goal a small pin
      tvLoop(v.coord, g).forEach(pts => map._rtLayers.push(L.polyline(pts, { color: ROUTE_STYLE.none.color, weight: 3, opacity: 0.6, dashArray: '6 6', className: 'rt-out', interactive: false }).addTo(map)));
      const mk = L.marker([g.lat, g.lng], { icon: L.divIcon({ className: '', html: `<div class="rt-goal">${msi(TRAVEL_MS[o.f.mode] || 'flight', { size: 14 })}<b class="rt-lbl">${escH(o.goal.name)}${SEP}טיול יום</b></div>`, iconSize: [26, 26], iconAnchor: [13, 13] }), zIndexOffset: 700 }).addTo(map);
      mk.on('click', () => openTravelFloat(containerId, o.f)); map._rtLayers.push(mk); });
  };
  const drawStops = () => {
    const groups = []; // a stop visited twice (back to the same city) is one marker with both numbers
    vs.forEach(v => { if (!v.coord || stopHidden(v)) return; const g = groups.find(x => distanceKm(x.coord, v.coord) < 8); if (g) g.vs.push(v); else groups.push({ coord: v.coord, vs: [v] }); });
    const bounds = [];
    groups.forEach(g => { const nums = g.vs.map(v => v.i + 1).join('·'), st = g.vs.map(v => visitState(v, iso)).includes('now') ? 'now' : (g.vs.every(v => visitState(v, iso) === 'past') ? 'past' : '');
      const v0 = g.vs[0], label = `${v0.name}${SEP}${g.vs.reduce((s, v) => s + v.nights, 0)}`;
      const mk = L.marker([g.coord.lat, g.coord.lng], { icon: L.divIcon({ className: '', html: `<div class="rt-stop ${st}${nums.length > 2 ? ' wide' : ''}"><span>${nums}</span><b class="rt-lbl">${escH(label)}</b></div>`, iconSize: [30, 30], iconAnchor: [15, 15] }), zIndexOffset: 2000 }).addTo(map);
      mk.on('click', () => openStopCard(containerId, g.vs[0])); regMarker(containerId, 'stop' + v0.i, mk); g.vs.forEach(v => { if (v !== v0) regMarker(containerId, 'stop' + v.i, mk); });
      bounds.push([g.coord.lat, g.coord.lng]); });
    return bounds;
  };
  // stops need coordinates: their hotels are found by address once (and kept), like every place
  const hotelPts = [].concat(...vs.map(v => v.places)).filter(p => p && !routeCoordOf(p) && p.address);
  const keyPts = POINTS.filter(p => keyIds.has(p.id) && !isHiddenPoint(p));
  const nearPts = pts.filter(p => !keyIds.has(p.id));
  ensureGeocoded(hotelPts.concat(keyPts.filter(p => !routeCoordOf(p) && p.address)), null, () => {}).then(() => { // the overview first: stops and ★
    vs.forEach(v => { if (!v.coord && v.places[0]) v.coord = routeCoordOf(v.places[0]); });
    const bounds = drawStops(); drawLegs();
    keyPts.forEach(p => { const c = routeCoordOf(p); if (!c) return;
      const mk = L.marker([c.lat, c.lng], { icon: L.divIcon({ className: '', html: `<div class="rt-key" title="${escH(p.name)}">${SYM_KEY}</div>`, iconSize: [24, 24], iconAnchor: [12, 12] }), zIndexOffset: 1500 }).addTo(map);
      mk.on('click', () => pinTap(containerId, p.id) || showMapCard(containerId, null, p)); regMarker(containerId, p.id, mk); });
    { const fb = bounds.length ? bounds : vs.filter(v => v.coord).map(v => [v.coord.lat, v.coord.lng]); if (!restore && fb.length) map.fitBounds(fb, { padding: [50, 50], maxZoom: 12 }); }
    reveal();
    if (_routeOpenStop != null) { const v = vs[_routeOpenStop]; _routeOpenStop = null; if (v) setTimeout(() => openStopCard(containerId, v), 50); }
  }).then(() => ensureGeocoded(nearPts, (d, t) => mapStatusLine(containerId, d, t), (p, c) => { if (!c) return;
      const mk = L.marker([c.lat, c.lng], { icon: pinDivIcon(p) }); mk.on('click', () => pinTap(containerId, p.id) || showMapCard(containerId, null, p)); near.push(mk); if (shown) mk.addTo(map); regMarker(containerId, p.id, mk); }))
    .then(() => { const l = document.getElementById(containerId + '-loading'); if (l) l.remove(); });
}
function openStopCard(hostId, v) {
  const esc = escH, iso = routeNow(), st = visitState(v, iso), keys = visitKeys(v);
  const html = cdCard({ lead: leadHTML('grey stop', `<span class="cd-n">${v.i + 1}</span>`, ''), name: esc(v.name), // 10.2.0 (design-2): the same card - the stop's number in its circle
    tags: [st === 'now' ? `<span class="tl-tag cd-when time">${tagIc('today')}היום</span>` : '', cdMeta([visitSub(v)]), st === 'past' ? `<span class="tl-tag vis-on">${tagIc('check_circle')}${TX.visited}</span>` : '',
      v.coord ? `<span class="cd-mt" data-elev="${v.coord.lat},${v.coord.lng}" data-elevmin="1200" data-elevsuffix=" מעל הים" hidden></span>` : ''],
    desc: `${v.hotels.length ? `<span class="mc-desc">${esc(v.hotels.join(SEP))}</span>` : ''}${keys.length ? `<div class="rk-chips">${keys.slice(0, 8).map(p => `<button type="button" class="tl-tag key" data-act="route.key" data-v="${p.id}">${msi('workspace_premium', { size: 16, fill: 1 })}${esc(p.name)}</button>`).join('')}</div>` : ''}`,
    acts: `<div class="tl-acts mc-acts">${visitDaysRange(v) ? `<button type="button" class="tl-act" data-act="route.days" aria-label="הימים כאן" title="הימים כאן">${actIc('calendar_month')}</button>` : ''}${v.lodgingId ? `<button type="button" class="tl-act" data-act="route.hotel" aria-label="הלינה" title="הלינה">${actIc('hotel')}</button>` : ''}<button type="button" class="tl-act" data-act="route.hide" aria-label="הסתרה" title="הסתרה במפת המסלול בלבד">${actIc('visibility_off')}</button></div>` });
  const box = openFloatCard(hostId, html, b => fillElev(b), () => markSelected(hostId, null)); if (box) box._stop = v;
  markSelected(hostId, 'stop' + v.i);
}
function openLegCard(hostId, l) {
  const esc = escH, f = l.travels[0];
  const km = l.a.coord && l.b.coord ? Math.round(distanceKm(l.a.coord, l.b.coord)) : null, road = l.a.coord && l.b.coord && (l.mode === 'car' || l.mode === 'bus') ? roadPathGet(l.a.coord, l.b.coord) : null;
  const m = f ? (TRAVEL_MODES[f.mode] || TRAVEL_MODES.flight) : ['⋯', 'מעבר'];
  const dist = road ? `${fmtKm(road.km)} בכביש${road.min ? SEP + 'כ-' + tmFmt('dur', road.min) : ''}` : (km != null ? `${fmtKm(km)} בקו אווירי` : ''), dur = legDuration(f);
  const html = cdCard({ lead: leadHTML('travel', msi(f ? TRAVEL_MS[f.mode] || 'flight' : 'more_horiz', { size: 18 }), ''), name: `${esc(l.a.name)} ← ${esc(l.b.name)}`, // 10.2.0 (design-2): the same card
    tags: [f && (f.depart || f.arrive) ? `<span class="tl-tag cd-when time">${tagIc('schedule')}<span dir="ltr">${esc(f.depart || '?')}–${esc(f.arrive || '?')}</span></span>` : '', cdMeta([m[1], f ? tmFmt('date', f.date) : '', dur])],
    desc: `<span class="mc-desc mc-desc2">${[f && [f.airline, f.number].filter(Boolean).join(' '), f && f.terminal ? 'טרמינל ' + f.terminal : '', dist, f && f.note].filter(Boolean).map(esc).join(SEP) || 'אין נסיעה רשומה למעבר הזה'}${l.travels.length > 1 ? `${SEP}ועוד: ${l.travels.slice(1).map(x => esc(flightPlanName(x))).join(SEP)}` : ''}</span>${road ? `<small class="cd-cred">${svcCredit('fossgis', { fix: true })}</small>` : ''}`,
    acts: `<div class="tl-acts mc-acts"><button type="button" class="tl-act" data-act="route.legEdit" aria-label="${f ? 'עריכת הנסיעה' : 'נסיעה חדשה'}" title="${f ? 'עריכת הנסיעה' : 'נסיעה חדשה'}">${actIc(f ? 'edit' : 'add')}</button><button type="button" class="tl-act" data-act="route.hide" aria-label="הסתרה" title="הסתרה במפת המסלול בלבד">${actIc('visibility_off')}</button></div>` });
  const box = openFloatCard(hostId, html); if (box) box._leg = l;
}
const floatOf = el => { const box = el.closest('.map-float'); return { box, hostId: box && box.parentElement.id }; };
act('route.hotel', c => goLodgingCard(floatOf(c.el).box._stop.lodgingId));
act('route.days', c => { const { box, hostId } = floatOf(c.el), v = box._stop, r = visitDaysRange(v); FP.route = false; FP.days = r; closeFloatCard(hostId); showToast(SY.days + ' הימים ב' + v.name); return 'redraw'; });
act('route.key', c => { const { hostId } = floatOf(c.el), p = POINTS.find(x => String(x.id) === c.v); if (p) showMapCard(hostId, null, p); return 'quiet'; });
act('route.hide', c => { const { box, hostId } = floatOf(c.el); closeFloatCard(hostId); if (box._stop) setRouteHidden('stops', stopKey(box._stop), box._stop.name, true); else setRouteHidden('legs', legKey(box._leg), legName(box._leg), true); });
act('route.legEdit', c => { const f = floatOf(c.el).box._leg.travels[0]; openTravelEditor(f ? f.id : null); });

// ================= map-side-view: A ROUTE'S SIDE VIEW - the height along a route (decisions 2026-11-21 · Review of the
// `map-upgrades-review` report, Q2-Q3; notes/map-upgrades/c01-profile.md) =================
// One component for four places: the day's plan and its day map (the day's walking and driving legs), a drive's travel card (its kept
// road path) and the memory (a day's Timeline walk). Each place builds a route { key, name, segs: [[[lat, lng], ...], ...], via } and draws
// svBtnHTML(route): a mountain icon tied to the word "גובה" - nothing is drawn and nothing is asked before the tap. The tap opens a window
// (openSideView): the route's map above, the chart under it (the app's own SVG - no chart library), total climb and descent, the highest
// point and the steepest stretch; a finger on the chart (TOUCH 'scrub') moves a dot on the map. Heights: the route sampled to at most
// SV_MAX points by distance, asked once through elevMany (service "גובה", the `elev` row - kept with every other height, no expiry), so
// the window opens offline afterwards; from then the button also carries the summary (svSumHTML). Credit: Open-Meteo's under the chart
// (the heights) and the route's provider (FOSSGIS's routes) - the map's own tiles carry theirs.
const SV_MAX = 100; // at most this many heights per route: one request (Open-Meteo takes up to 100 points)
const SV_STEEP = { win: 0.2, min: 0.05 }; // km over which a grade is measured (at least one sample's step); a grade below min marks nothing
const SV = { routes: {}, asked: new Set(), cur: null }; // key -> its route (the last drawn); keys asked this opening; the open window's state
// the samples: { lat, lng, d } every step of the route's length (the jump between two segments adds no distance)
function svSample(R) {
  const pts = []; let d = 0;
  (R.segs || []).forEach(g => { (g || []).forEach((p, i) => { const c = { lat: +p[0], lng: +p[1] }; if (!isFinite(c.lat) || !isFinite(c.lng)) return;
    if (i && pts.length) d += distanceKm(pts[pts.length - 1], c); pts.push({ ...c, d }); }); });
  if (pts.length < 2 || d < 0.05) return null;
  const n = Math.min(SV_MAX, Math.max(2, pts.length)), step = d / (n - 1), out = []; let j = 0;
  for (let k = 0; k < n; k++) { const t = k === n - 1 ? d : k * step; while (j < pts.length - 2 && pts[j + 1].d < t) j++;
    const a = pts[j], b = pts[j + 1], f = b.d > a.d ? Math.max(0, Math.min(1, (t - a.d) / (b.d - a.d))) : 0;
    out.push({ lat: +(a.lat + (b.lat - a.lat) * f).toFixed(5), lng: +(a.lng + (b.lng - a.lng) * f).toFixed(5), d: t }); }
  return out;
}
// the kept heights of the samples, or null while any is missing
function svHeights(S) { if (!S) return null; const h = S.map(knownElev); return h.every(v => v != null) ? h : null; }
// climb, descent, the highest point and the steepest stretch (over SV_STEEP.win, a grade of SV_STEEP.min or more)
function svStats(S, h) {
  let up = 0, down = 0, top = 0; for (let i = 1; i < h.length; i++) { const x = h[i] - h[i - 1]; if (x > 0) up += x; else down -= x; if (h[i] > h[top]) top = i; }
  const win = Math.max(SV_STEEP.win, S[S.length - 1].d / (S.length - 1)); let steep = null;
  for (let i = 0; i < S.length - 1; i++) { let j = i + 1; while (j < S.length - 1 && S[j].d - S[i].d < win) j++;
    const run = S[j].d - S[i].d, g = run > 0 ? Math.abs(h[j] - h[i]) / (run * 1000) : 0; if (g >= SV_STEEP.min && (!steep || g > steep.g)) steep = { i, j, g, up: h[j] > h[i] }; }
  return { up: Math.round(up), down: Math.round(down), top, topH: h[top], km: S[S.length - 1].d, steep };
}
function svStatsOf(R) { const S = svSample(R), h = svHeights(S); return h ? svStats(S, h) : null; }
function svSumHTML(st) { return `${msiT('north_east', fmtM(st.up))} ${msiT('south_east', fmtM(st.down))}`; }
// the button of every place: the icon and its word in one chip (or a card's tag), which never breaks; the summary once the heights are kept
function svBtnHTML(R, o) { if (!R || (!R.pending && !svSample(R))) return ''; SV.routes[R.key] = R; const st = R.pending ? null : svStatsOf(R); // o.tag: a card's tag (the card's tag size); otherwise a chip in its own row
  return `<button type="button" class="${o && o.tag ? 'tl-tag' : 'chip'} sv-btn" data-act="side.open" data-v="${escH(R.key)}" aria-label="גובה לאורך הדרך${st ? `: עלייה ${st.up} מטר, ירידה ${st.down} מטר` : ''}">${o && o.tag ? tagIc('landscape') : msi('landscape', { size: 18 })}גובה${st ? `<span class="sv-sum">${svSumHTML(st)}</span>` : ''}</button>`; }
function svRefreshBtns(key) { document.querySelectorAll('[data-act="side.open"]').forEach(b => { if (b.dataset.v !== key || !SV.routes[key]) return; const t = document.createElement('div'); t.innerHTML = svBtnHTML(SV.routes[key], { tag: b.classList.contains('tl-tag') }); if (t.firstElementChild && t.firstElementChild.outerHTML !== b.outerHTML) b.replaceWith(t.firstElementChild); }); }
// ---- the four places' routes ----
// the day's plan and its day map: the day's walking and driving legs with a found path, in the day's order (last night's hotel first,
// tonight's last); a day with none has no button
function svDayRoute(dKey) { const ls = Object.values(LEGS).filter(L => L.day === dKey), ord = L => L.hotel === 'from' ? 0 : L.hotel === 'to' ? 2 : 1;
  const segs = [], via = new Set(); ls.map((L, i) => [L, i]).sort((a, b) => ord(a[0]) - ord(b[0]) || a[1] - b[1]).forEach(([L]) => { let m = legMode(L), v = legValue(L, m); if (v.none) { m = legNoTransit(L); v = legValue(L, m); }
    if (m !== 'walk' && m !== 'car') return; const r = routeGet(m, L.a, L.b, ''); if (r && Array.isArray(r.g) && r.g.length > 1) { segs.push(r.g); via.add('fossgis'); } });
  const d = dayByKey(dKey); return segs.length ? { key: 'd:' + dKey, name: d ? tmFmt('day', d.date) : '', segs, via: [...via] } : null; }
function svDayRowHTML(dKey) { const b = svBtnHTML(svDayRoute(dKey)); return `<div class="sv-row" data-svday="${escH(dKey)}"${b ? '' : ' hidden'}>${b}</div>`; }
// a leg's path that arrives after the day was drawn shows the button in place (routeTick), with nothing jumping above it
function svDayRowsTick() { document.querySelectorAll('#main .sv-row[data-svday]').forEach(r => { const t = document.createElement('div'); t.innerHTML = svBtnHTML(svDayRoute(r.dataset.svday)); if (r.innerHTML !== t.innerHTML) { r.replaceChildren(...t.childNodes); r.hidden = !r.firstChild; } }); }
// a drive's travel card: its road path as kept (never a straight line between its ends)
// (a path not found yet - the day map asks for it - is asked at the tap: R.want, then the route is built again by R.again)
function svTravelRoute(f, day) { if (!f || f.mode !== 'car') return null; const C = tvCtx(), x = tvCur(f, C), gc = (DAY_TV_FROM[day] || {})[x.id] || null, L = travelLine(x, C, gc); if (!L) return null;
  const R = { key: 'tv:' + x.id, name: travelTitle(x), segs: L.approx ? [] : [L.pts], via: ['fossgis'], again: () => svTravelRoute(f, day) };
  if (L.approx) { R.pending = true; R.want = () => travelPathWant(x, C, gc); } return R; }
// the memory: a day's Timeline walk (its walking segments, cleaned as tlPaths reads them)
function svTlRoute(id, date) { const tl = tlOf(id), x = tl && (tl.days || {})[date]; if (!x) return null;
  const segs = Array.isArray(x.s) ? x.s.filter(g => g && g.m !== 'r' && Array.isArray(g.p) && g.p.length > 1).map(g => g.p) : Array.isArray(x.p) && x.p.length > 1 ? tlCleanOld(x.p) : [];
  return segs.length ? { key: 'tl:' + id + '|' + date, name: 'הליכה' + SEP + tmFmt('day', date), segs, via: [] } : null; }
// ---- the window ----
act('side.open', c => openSideView(c.v));
function openSideView(key) { const R = SV.routes[key]; if (!R) return; layerNote(openSideView, arguments); const sheet = document.getElementById('sheet');
  sheet.innerHTML = `${fmHead(`${msiT('landscape', 'גובה')}${SEP}${nameB(R.name)}`, 'svClose')}<div class="sv-map" id="svMap"></div><div class="sv-body" id="svBody" data-sv="${escH(key)}"></div>
    <p class="sh-hint sv-cr">${[svcCredit('openmeteo', { as: 'elev' })].concat((R.via || []).map(p => svcCredit(p))).join(SEP)}</p>`;
  openSheet('openSideView'); svMap(R); svFill(R); }
function svMap(R) { const box = document.getElementById('svMap'); SV.cur = null; if (!box || !MAP_AVAILABLE) { if (box) box.remove(); return; } if (!R.segs.length) return; // a drive's path still asked: the map comes with it
  if (!leafGate(box, () => { if (document.getElementById('svMap') === box) svMap(R); })) return;
  const map = mapTool('svMap'), all = [].concat(...R.segs); R.segs.forEach(g => L.polyline(g, { className: 'sv-line', weight: 4, interactive: false }).addTo(map));
  map.fitBounds(all, { padding: [24, 24], maxZoom: 16 }); SV.cur = { key: R.key, map, dot: null }; }
function svFill(R) { const box = document.getElementById('svBody'); if (!box || box.dataset.sv !== R.key) return;
  if (R.pending) { const w = SV.asked.has('p|' + R.key) || !svcOnline() ? null : R.want(); SV.asked.add('p|' + R.key);
    if (!w) { box.innerHTML = `<p class="sh-hint">${msi(svcOnline() ? 'route' : 'cloud_off', { cls: 'msi-in' })} ${svcOnline() ? 'הדרך עוד לא נמצאה. אפשר לנסות שוב אחר כך.' : 'הדרך והגבהים יגיעו כשתהיה רשת.'}</p>`; return; }
    box.innerHTML = `<p class="sh-hint sv-wait">מחפש את הדרך…</p>`;
    w.then(() => { const N = R.again && R.again(); if (!N || N.pending || document.getElementById('svBody') !== box) { if (document.getElementById('svBody') === box) box.innerHTML = `<p class="sh-hint">${warnIc()} הדרך לא נמצאה, ולכן אין גבהים לאורכה.</p>`; return; }
      SV.routes[N.key] = N; svMap(N); svFill(N); }); return; }
  const S = svSample(R), h = svHeights(S);
  if (h) { svDraw(box, S, h); svRefreshBtns(R.key); return; }
  if (SV.asked.has(R.key)) { box.innerHTML = `<p class="sh-hint">${warnIc()} הגבהים לא התקבלו מהשירות. אפשר לנסות שוב אחר כך.</p>`; return; }
  if (!svcOnline()) { box.innerHTML = `<p class="sh-hint">${msi('cloud_off', { cls: 'msi-in' })} הגבהים יגיעו כשתהיה רשת. אחרי הפעם הראשונה הם נשמרים, וגם בלי רשת הם כאן.</p>`; return; }
  SV.asked.add(R.key); box.innerHTML = `<p class="sh-hint sv-wait">מביא את הגבהים…</p>`;
  elevMany(S).then(() => { svRefreshBtns(R.key); svFill(R); }); }
// the chart: distance along (left to right, as every chart) and height up; labels in the text's size, the height grows with it
// along-time-field (G121): the labels are right-to-left text (their unit is Hebrew; .sv-lab says so), so each is placed by the edge that
// sits at x - 'r' its right edge, 'l' its left; the start's room is measured from the widest height label, so it never reaches the line
function svDraw(box, S, h, padL) { const st = svStats(S, h), em = parseFloat(getComputedStyle(box).fontSize) || 16, W = Math.max(240, Math.round(box.clientWidth || 320)), H = Math.round(em * 8.5);
  const pl = padL || Math.round(em * 3.6), pr = Math.round(em * .6), pt = Math.round(em * .8), pb = Math.round(em * 1.6), iw = W - pl - pr, ih = H - pt - pb;
  let lo = Math.min(...h), hi = Math.max(...h); if (hi - lo < 20) { const m = (hi + lo) / 2; lo = m - 10; hi = m + 10; }
  const X = d => pl + (st.km ? d / st.km : 0) * iw, Y = v => pt + (1 - (v - lo) / (hi - lo)) * ih, P = i => `${X(S[i].d).toFixed(1)},${Y(h[i]).toFixed(1)}`;
  const line = S.map((s, i) => P(i)).join(' '), steep = st.steep ? S.slice(st.steep.i, st.steep.j + 1).map((s, k) => P(st.steep.i + k)).join(' ') : '';
  const lab = (x, y, t, edge, k) => `<text class="sv-lab"${k ? ` data-sv="${escH(k)}"` : ''} x="${(+x).toFixed(1)}" y="${(+y).toFixed(1)}" text-anchor="${edge === 'r' ? 'start' : 'end'}">${escH(t)}</text>`;
  box.innerHTML = `<div class="sv-read" id="svRead" aria-live="polite">${svReadHTML(S, h, st.top)}</div>
    <svg class="sv-chart" id="svChart" dir="ltr" width="${W.toFixed(0)}" height="${H.toFixed(0)}" viewBox="0 0 ${W} ${H}" role="img" aria-label="גובה לאורך הדרך">
      <line class="sv-axis" x1="${pl.toFixed(0)}" y1="${(pt + ih).toFixed(0)}" x2="${(pl + iw).toFixed(0)}" y2="${(pt + ih).toFixed(0)}"/>
      ${lab(pl - em * .5, pt + em * .35, fmtM(hi), 'r', 'h')}${lab(pl - em * .5, pt + ih, fmtM(lo), 'r', 'h')}${lab(pl, H - em * .3, '0', 'l')}${lab(pl + iw, H - em * .3, fmtKm(st.km), 'r')}
      <polygon class="sv-area"/><polyline class="sv-path"/>${steep ? '<polyline class="sv-steep"/>' : ''}
      <circle class="sv-top" cx="${X(S[st.top].d).toFixed(1)}" cy="${Y(h[st.top]).toFixed(1)}" r="${(em * .3).toFixed(1)}"/>
      <line class="sv-cur" id="svCur" x1="0" y1="${pt.toFixed(0)}" x2="0" y2="${(pt + ih).toFixed(0)}" visibility="hidden"/><circle class="sv-dot" id="svDot" r="${(em * .35).toFixed(1)}" visibility="hidden"/>
    </svg>
    <div class="tags sv-stats"><span>${msiT('north_east', 'עלייה ' + fmtM(st.up))}</span><span>${msiT('south_east', 'ירידה ' + fmtM(st.down))}</span><span>${msiT('landscape', 'הכי גבוה ' + fmtM(st.topH))}</span>${st.steep ? `<span class="sv-st">${msiT('warning', `הכי תלול ${Math.round(st.steep.g * 100)}% (${st.steep.up ? 'עלייה' : 'ירידה'})`)}</span>` : ''}</div>`;
  const svg = box.querySelector('#svChart'), need = Math.ceil(Math.max(0, ...[...svg.querySelectorAll('.sv-lab[data-sv="h"]')].map(t => t.getBBox().width)) + em * .8);
  if (!padL && need > pl) return svDraw(box, S, h, need);
  const pts = (q, v) => { const e = svg.querySelector(q); if (e) e.setAttribute('points', v); }; // the lines' numbers set on the drawn elements
  pts('.sv-area', `${pl},${pt + ih} ${line} ${pl + iw},${pt + ih}`); pts('.sv-path', line); pts('.sv-steep', steep);
  scrubGesture(svg, x => { const r = svg.getBoundingClientRect(), d = Math.max(0, Math.min(1, (x - r.left - pl * r.width / W) / (iw * r.width / W))) * st.km; let i = 0; S.forEach((s, k) => { if (Math.abs(s.d - d) < Math.abs(S[i].d - d)) i = k; }); svAt(S, h, i, X, Y); }); }
function svReadHTML(S, h, i) { return `${escH(fmtKm(S[i].d))}${SEP}${msiT('landscape', escH(fmtM(h[i])))}`; }
// a point of the chart: the cursor, the reading, the dot on the map
function svAt(S, h, i, X, Y) { const cur = document.getElementById('svCur'), dot = document.getElementById('svDot'), rd = document.getElementById('svRead'); if (!cur || !dot) return;
  const x = X(S[i].d).toFixed(1); cur.setAttribute('x1', x); cur.setAttribute('x2', x); cur.setAttribute('visibility', 'visible'); dot.setAttribute('cx', x); dot.setAttribute('cy', Y(h[i]).toFixed(1)); dot.setAttribute('visibility', 'visible');
  if (rd) rd.innerHTML = svReadHTML(S, h, i);
  const M = SV.cur; if (!M || M.map._removed) return; const ll = [S[i].lat, S[i].lng];
  if (M.dot) M.dot.setLatLng(ll); else M.dot = L.circleMarker(ll, { className: 'sv-mdot', radius: 7, weight: 3, fillOpacity: 1, interactive: false }).addTo(M.map);
  if (M.map.getBounds && !M.map.getBounds().contains(ll)) M.map.panTo(ll); }
// ================= END SIDE VIEW =================

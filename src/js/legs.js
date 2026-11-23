// ================= 4.32.0: REAL TIME AND DISTANCE IN PLANNING =================
// Every leg of the plan (between neighbouring cards, and from last night's hotel / to tonight's) gets a real route when
// there is a network: 🚶 walking and 🚕 driving from the FOSSGIS OSRM server (routing.openstreetmap.de), 🚇 public
// transport from Transitous (only where it has data - otherwise 🚇 just doesn't show). The way is automatic (walking up to
// the walking distance of the setting, beyond it the trip's main way: on foot & public transport, or car), and a tap on
// the leg chooses another way for that leg. Legs are computed in the background, one request a second, each once, and
// kept on this device (not in backups: they can be computed again), so they work without a network. A value that is
// still an estimate (straight line × 1.3) is marked ≈ and lighter; a tap says what it is based on.
const ROUTE_MAX = 900;
const LEG_MODES = { walk: { ms: 'directions_walk', label: 'הליכה', short: 'הליכה', gm: 'walking' }, transit: { ms: 'directions_transit', label: 'תחבורה ציבורית', short: 'ציבורית', gm: 'transit' }, car: { ms: 'directions_car', label: 'רכב (נהיגה או מונית)', short: 'רכב', gm: 'driving' } }; // 4.33.0: 🚗 instead of 🚕, with words
let _routes = null;
function routeStore() { if (_routes) return _routes; _routes = regRead('routes'); return _routes; }
function routeSave() { const s = routeStore(), ks = Object.keys(s); if (ks.length > ROUTE_MAX) ks.sort((a, b) => (s[a].at || 0) - (s[b].at || 0)).slice(0, ks.length - ROUTE_MAX).forEach(k => delete s[k]);
  if (!regWrite('routes', s)) { ks.slice(0, Math.ceil(ks.length / 3)).forEach(k => delete s[k]); regWrite('routes', s); } }
const _r5 = c => (+c.lat).toFixed(5) + ',' + (+c.lng).toFixed(5);
function routeKey(mode, a, b, when) { return mode + '|' + _r5(a) + '|' + _r5(b) + (mode === 'transit' ? '|' + when : ''); }
function routeSvc(mode) { return mode === 'transit' ? 'transit' : 'route'; }
// 7.1.0 (ש8): an answer is used while it is fresh - transit 14 days, "no route" / "no coverage" 30 days, a route for good
function routeGet(mode, a, b, when) { const e = routeStore()[routeKey(mode, a, b, when)]; return e && svcFresh(routeSvc(mode), e) ? e : null; }
// background: each leg asks its service once; the client keeps the provider's rate and queue (ש5); a late answer redraws in place
const _rqWait = new Map(); // key -> callbacks waiting for it
function routeWant(mode, a, b, when, cb) {
  const k = routeKey(mode, a, b, when), have = routeGet(mode, a, b, when); if (have) { if (cb) cb(have); return; }
  if (_rqWait.has(k)) { if (cb) _rqWait.get(k).push(cb); return; }
  _rqWait.set(k, cb ? [cb] : []);
  const req = mode === 'transit' ? transitReq(a, b, when) : osrmReq(mode, a, b);
  svcAsk(routeSvc(mode), { key: k, build: () => req, parse: mode === 'transit' ? transitParse : osrmParse }).then(r => {
    const cbs = _rqWait.get(k) || []; _rqWait.delete(k);
    if (r.kind === 'ok' || r.kind === 'empty') { routeStore()[k] = { ...(r.kind === 'ok' ? r.value : { none: 1 }), at: Date.now() }; routeSave(); if (r.kind === 'ok') cbs.forEach(f => f(routeStore()[k])); }
    routeTick(); });
}
function routeGaveUp(mode, a, b, when) { const s = SVC.gaveUp[routeSvc(mode)]; return !!s && s.has(routeKey(mode, a, b, when)); }
function osrmReq(mode, a, b, full) { const prof = mode === 'walk' ? 'routed-foot' : 'routed-car';
  return { url: `https://routing.openstreetmap.de/${prof}/route/v1/driving/${(+a.lng).toFixed(6)},${(+a.lat).toFixed(6)};${(+b.lng).toFixed(6)},${(+b.lat).toFixed(6)}?overview=${full ? 'full' : 'simplified'}&geometries=geojson` }; }
function osrmParse(j) { if (!j || !Array.isArray(j.routes)) { if (j && j.code === 'NoRoute') return SVC_EMPTY; throw new Error('answer'); } const rt = j.routes[0]; if (!rt) return SVC_EMPTY;
  return { d: Math.round(rt.distance), t: Math.round(rt.duration), g: routeLineOf((rt.geometry || {}).coordinates || []) }; }
// 7.1.0 (ש5): a line is kept by its shape (Douglas-Peucker, like the schematic background) instead of points at equal steps,
// so bends keep their corners; at most ROUTE_LINE_PTS points (measured on the demo trip)
var ROUTE_LINE_PTS = 160; // var: the 7.1.0 conversion of the memories uses it at startup
function routeLineOf(lngLat) { let pts = lngLat.map(c => [+c[0], +c[1]]); if (pts.length < 3) return pts.map(c => [+c[1].toFixed(5), +c[0].toFixed(5)]);
  let tol = 0.00004, out = simplifyLine(pts, tol); while (out.length > (ROUTE_LINE_PTS || 160) && tol < 0.05) { tol *= 1.6; out = simplifyLine(pts, tol); }
  return out.map(c => [c[1], c[0]]); }
function decodePoly(str, prec) { // Google encoded polyline, any precision
  const f = Math.pow(10, prec || 5), out = []; let i = 0, lat = 0, lng = 0;
  while (i < str.length) { for (const k of [0, 1]) { let r = 0, sh = 0, c; do { c = str.charCodeAt(i++) - 63; r |= (c & 31) << sh; sh += 5; } while (c >= 32 && i < str.length); const d = r & 1 ? ~(r >> 1) : r >> 1; if (k) lng += d; else lat += d; }
    out.push([+(lat / f).toFixed(5), +(lng / f).toFixed(5)]); }
  return out;
}
function transitReq(a, b, when, modes) { // modes (11.2.0): a travel's kind (TV_TRANSIT) - its path only on its own kind of line
  const [d, hm, by] = String(when).split(' '); // 11.3.0 (travels-4-claude, the 11.1.0 review's miss a): "… A" = arrive by that time (legWhen)
  const time = tmIsoStamp(tmMoment(d, hm, dayZone(d)));
  return { url: `https://api.transitous.org/api/v5/plan?fromPlace=${(+a.lat).toFixed(6)},${(+a.lng).toFixed(6)}&toPlace=${(+b.lat).toFixed(6)},${(+b.lng).toFixed(6)}&time=${encodeURIComponent(time)}${by === 'A' ? '&arriveBy=true' : ''}${modes ? '&transitModes=' + modes : ''}` }; }
function transitParse(j) {
  if (!j || typeof j !== 'object') throw new Error('answer'); const it = j.itineraries && j.itineraries[0];
  if (!it) { const dw = j.direct && j.direct[0]; // 4.33.0: short distances - walking beats every line, so there is no itinerary
    if (dw) return { t: Math.round(dw.duration || 0), d: Math.round((dw.legs || []).reduce((x, l) => x + (l.distance || 0), 0)), tr: 0, dep: '', legs: [{ m: 'WALK', n: '', h: '', c: '', s: dw.startTime || '', f: '', to: '', t: Math.round(dw.duration || 0), d: 0 }], color: '', walkOnly: 1, st: dw.startTime || '' };
    return SVC_EMPTY; } // no coverage here: 🚇 is simply not offered
  const legs = (it.legs || []).map(l => ({ m: l.mode, n: l.routeShortName || l.displayName || '', h: l.headsign || '', c: l.routeColor ? '#' + String(l.routeColor).replace('#', '') : '', s: l.startTime || '', f: (l.from || {}).name || '', to: (l.to || {}).name || '', t: Math.round(l.duration || 0), d: Math.round(l.distance || 0) }));
  const walkM = legs.filter(l => l.m === 'WALK').reduce((x, l) => x + l.d, 0);
  let g = []; try { (it.legs || []).forEach(l => { const lg = l.legGeometry; if (lg && lg.points) g = g.concat(decodePoly(lg.points, lg.precision || 6)); }); } catch (e) { g = []; } // 4.34.0: the real line on the map
  return { t: Math.round(it.duration || 0), d: Math.round(walkM), tr: it.transfers || 0, dep: (legs.find(l => l.m !== 'WALK') || {}).s || it.startTime || '', st: it.startTime || '', legs, color: (legs.find(l => l.c) || {}).c || '', ...(g.length > 1 ? { g: routeLineOf(g.map(c => [c[1], c[0]])) } : {}) };
}
// ---- legs of the plan ----
function tripLegMain() { const t = activeTripObj(); return t && t.legMain === 'car' ? 'car' : 'transit'; }
function legModes() { return (planX().legMode = planX().legMode || {}); }
function legAuto(a, b) { const km = distanceKm(a, b) * 1.3, max = parseFloat(prefs().walkMax) || 2.5; return km <= max ? 'walk' : tripLegMain(); }
// the transit lookup's day and hour of a leg; a leg to a travel with a "by" time asks to arrive by it (11.3.0, arriveBy), any other at its start
function legWhen(L) { return L.tv && L.tv.by ? tmRouteWhen(L.date, L.tv.by) + ' A' : tmRouteWhen(L.date, L.hm); }
const LEGS = {}; // key -> { key, a, b, an, bn, date, hm, tA, tB } (filled while the plan is drawn)
function legMode(L) { const m = legModes()[L.key]; if (m && LEG_MODES[m]) return m; return legAuto(L.a, L.b); }
function legNoTransit(L) { const km = distanceKm(L.a, L.b) * 1.3, max = parseFloat(prefs().walkMax) || 2.5; return km <= max * 2 ? 'walk' : 'car'; }
function legValue(L, mode) { // { min, km, est, none }
  mode = mode || legMode(L); const est = distanceKm(L.a, L.b) * 1.3, sp = WALK_SPEED[prefs().walk] || WALK_SPEED.normal;
  const r = routeGet(mode, L.a, L.b, mode === 'transit' ? legWhen(L) : '');
  if (r && !r.none) return { min: Math.max(1, Math.round(r.t / 60)), km: r.d / 1000, est: false, r };
  if (r && r.none && mode === 'transit') return { none: true };
  const min = mode === 'walk' ? est / sp * 60 : mode === 'car' ? est / 30 * 60 + 4 : est / 18 * 60 + 8;
  return { min: Math.max(1, Math.round(min)), km: est, est: true };
}
function legEnsure(L, mode) { mode = mode || legMode(L); const when = mode === 'transit' ? legWhen(L) : ''; if (!routeGet(mode, L.a, L.b, when)) routeWant(mode, L.a, L.b, when); }
function fmtLegMin(m) { return tmFmt('dur', m); }
function legRowHTML(L) {
  let mode = legMode(L), v = legValue(L, mode);
  if (v.none) { mode = legNoTransit(L); v = legValue(L, mode); } // 4.37.0: no line here -> walk when it is walkable, otherwise a car or taxi
  legEnsure(L, mode);
  const wo = mode === 'transit' && v.r && v.r.walkOnly; // 4.37.0: the service says walking beats every line
  const ic = msi(wo ? 'directions_walk' : LEG_MODES[mode].ms, { size: 18 }), gap = legGap(L), warn = gap != null && v.min > gap; // 10.2.0 (design-2): the mode's icon, minutes, distance; a warning in a warm color
  const txt = `<span>${v.est ? '≈ ' : ''}${fmtLegMin(v.min)}${SEP}${fmtKm(v.km)}${wo ? (SEP + 'ברגל מהיר יותר') : ''}${L.hotel === 'from' ? (SEP + 'מהמלון') : L.hotel === 'to' ? (SEP + 'למלון') : ''}${legModes()[L.key] ? `${SEP}${msi('back_hand', { size: 16, cls: 'msi-in' })}` : ''}${legLeaveBy(L, v) ? `${SEP}לצאת עד <bdi dir="ltr">${legLeaveBy(L, v)}</bdi>` : ''}</span>`; // final-review-fixes (16): a way chosen by hand, as a line icon; travels-2-plan (Q2): the leg to a travel says when to leave
  return `<button type="button" class="tl-leg${v.est ? ' est' : ''}${warn ? ' warn' : ''}${L.hotel ? ' hotel' : ''}" data-act="leg.open" data-v="${L.key}">${ic}${txt}${warn ? ` <b>צריך ${fmtLegMin(v.min)}, יש ${fmtLegMin(Math.max(0, gap))}</b>` : ''}</button>`;
}
// travels-2-plan (Q2, Q7): the leg to a travel with a departure time - leave by its departure less its "before", less the leg's own time;
// 11.3.0: by public transport asked to arrive by that time, the answer's own departure when it has one (else the estimate)
function legLeaveBy(L, v) { if (!L.tv || !L.tv.by) return ''; v = v || legValue(L); const own = v.r && !v.est && v.r.st ? tmFmt('time', v.r.st, { zone: dayZone(L.date) }) : '';
  return isHM(own) ? own : tmAddMin(L.tv.by, -v.min); }
const _hm2m = t => { const m = /^(\d{1,2}):(\d{2})/.exec(t || ''); return m ? +m[1] * 60 + +m[2] : null; };
function legGap(L) { const e = _hm2m(L.tA && L.tA.end), s = _hm2m(L.tB && L.tB.start); return e != null && s != null ? s - e : null; } // only between an item that ends at a time and one that starts at a time
function legsDaySummary(dKey) { // "בדרכים כ-1:40 · 🚶 6.2 ק״מ"
  const ls = Object.values(LEGS).filter(L => L.day === dKey); if (!ls.length) return '';
  let min = 0, walk = 0, est = false; ls.forEach(L => { let m = legMode(L), v = legValue(L, m); if (v.none) { m = legNoTransit(L); v = legValue(L, m); } if (m === 'transit' && v.r && v.r.walkOnly) m = 'walk'; min += v.min; est = est || v.est; if (m === 'walk') walk += v.km; else if (m === 'transit' && v.r) walk += (v.r.d || 0) / 1000; });
  return `${est ? '≈ ' : ''}בדרכים כ-${fmtLegMin(min)}${walk > 0.05 ? `${SEP}${msiT('directions_walk', fmtKm(walk))}` : ''}`; // 10.8.0 (design-icons, gap 16): HTML - a line icon
}
function legsStatus(id) { // "🧭 32 מתוך 40 קטעים" while something is still open - the one status line (ש10); the plan, and the "לקראת הטיול" card (all days)
  const ls = Object.values(LEGS); if (!ls.length || !(WALK_SPEED[prefs().walk])) return '';
  const st = ls.map(L => { let m = legMode(L), v = legValue(L, m); if (v.none) { m = legNoTransit(L); v = legValue(L, m); } return { done: !v.est, gave: v.est && routeGaveUp(m, L.a, L.b, m === 'transit' ? legWhen(L) : '') }; });
  id = typeof id === 'string' ? id : 'legsStatus';
  return svcLine(id, 'route', st.filter(x => x.done).length, ls.length, id === 'legsStatus' ? legsStatus : () => legsStatus(id), { gaveUp: st.filter(x => x.gave).length });
}
let _routeTickT = 0;
function routeTick() { clearTimeout(_routeTickT); _routeTickT = setTimeout(() => { // refresh what shows legs, without jumping
  if (activeTab === 'itinerary') { // in place, so nothing jumps or interrupts a drag
    document.querySelectorAll('#main [data-act="leg.open"]').forEach(b => { const L = LEGS[b.dataset.v]; if (!L) return; const t = document.createElement('div'); t.innerHTML = legRowHTML(L); const nb = t.firstElementChild; if (nb.outerHTML !== b.outerHTML) b.replaceWith(nb); });
    const st = document.getElementById('legsStatus'), h = legsStatus(); if (st) { if (h) st.outerHTML = h; else st.remove(); }
    document.querySelectorAll('#main [data-act="day.toggle"]').forEach(b => { const d = TRIP_DAYS.find(x => x.key === b.closest('[data-day-item]').dataset.dayItem), sm = b.querySelector('.dh-t small'); if (d && sm) sm.innerHTML = glueText(dayHeadInfo(d).sum); }); }
  if (MEAS && MEAS.road) measDraw();
  const sh = document.getElementById('legSheetBody'); if (sh && sh.dataset.leg && LEGS[sh.dataset.leg]) legSheetFill(LEGS[sh.dataset.leg]);
}, 350); }
function legsPendingAll() { try { TRIP_DAYS.forEach(d => dayTimelineHTML(d)); } catch (e) {} return legsPendingCount(); }
function legsPendingCount() { return Object.values(LEGS).filter(L => legValue(L).est).length; }
// the legs of one day, in the order of the timeline (parts of the day joined), stretched over items with no place; plus last night's
// hotel to the first point and the last point to tonight's hotel.
// travels-2-plan (decisions 2026-11-10 Q2, Q7, Q18, derived 1-3): a travel is a link of the day's chain - the leg before it runs to its
// departure point and the leg after it from its arrival point, each only when that end's location is confirmed (Q5: never on a guess;
// an end at home is not a point, Q6). The leg to a travel is checked against its departure time less its "before" (travelMargins) and
// says "לצאת עד"; the leg from it starts at its arrival time plus its "after". An overnight travel ends its departure day at its
// departure point (D1) and its landing row starts the arrival day at its arrival point; with no departure time the leg has no check
// (D2); legs between points that coincide (under ~50 m, as every leg) are not shown (D3). A travel with an end unknown breaks the chain.
const LEG_GAPS = {}; // day key -> [{ a, b, mode }] - the map's line across a travel with an end unknown (from its departure point, or the point before it, to its arrival point or the next); a travel with both ends draws its own line (DAY_TRAVELS, travels-3-maps)
const DAY_TRAVELS = {}; // day key -> the travels of the day's chain, in its order (11.2.0: the day map draws them - travel-maps.js)
// 11.3.0 (the 11.1.0 review, Q1): a group travel with no confirmed "מ-" leaves from the day's previous point (the previous place, a landing
// or last night's hotel) - no leg, no break in the chain; the maps start its line there. day key -> { travel id: that point }
const DAY_TV_FROM = {};
function legTravelOf(e) { if (e.land) return e.land;
  if (e.sched) { if (!isTravelKind(e.sched.kind)) return null; const raw = rawSched(e.sched.id); return raw ? grpTravelOf(raw, e.sched, activeTripObj()) : { id: 's:' + e.sched.id, mode: 'bus' }; }
  return e.p && isTravelItem(e.p) ? (tripFlights().find(x => String(x.id) === String(e.p.id)) || { id: e.p.id, mode: e.p.travel }) : null; }
function legTravelEnd(f, side, t) { if (!f.date) return { name: f[side] || '', c: null }; const x = travelEnd(f, side, t); return { name: x.name, c: x.home ? null : x.coord }; }
function buildDayLegs(d, seqs, coordOf) {
  Object.keys(LEGS).forEach(k => { if (LEGS[k].day === d.key) delete LEGS[k]; });
  const on = !!WALK_SPEED[prefs().walk], t = activeTripObj(), flat = [].concat(...seqs), byB = {}, gaps = [], tvs = [];
  const tm = e => e.sched ? (e.sched.start ? { start: e.sched.start, end: e.sched.end } : null) : e.t;
  const nm = e => e.sched ? e.sched.title : (e.p && e.p.name) || '';
  const far = (a, b) => distanceKm(a, b) * 1.3 >= 0.05;
  const hotelAt = iso => { const l = tripLodging().find(x => x.checkIn <= iso && iso < x.checkOut && x.placeId != null); if (!l) return null; const c = routeCoordOf(POINTS.find(q => q.id === l.placeId)); return c ? { c, l } : null; };
  const mk = (A, B, tv) => { if (!on || !far(A.c, B.c)) return null; const key = `${d.key}|${A.tok}|${B.tok}`; // a point: { c, tok, n (name), t ({ start, end } or null), tv (the travel it leads to) }
    return LEGS[key] = { key, day: d.key, date: d.date, a: A.c, b: B.c, an: A.n, bn: B.n, tA: A.t, tB: B.t, hm: (A.t || {}).end || (A.t || {}).start || '', ...(tv ? { tv } : {}) }; };
  let prev = null, first = null, last = null, started = false, tr = null; const impl = {}, hPrev0 = hotelAt(isoAdd(d.date, -1));
  flat.forEach(e => {
    const tok = entryTok(e), f = legTravelOf(e);
    if (f) { if (!tvs.includes(f)) tvs.push(f); const mg = travelMargins(f), kind = travelKindName(f), A = legTravelEnd(f, 'to', t), done = isHM(f.arrive) ? tmAddMin(f.arrive, mg.after) : '';
      if (!e.land) { const D = legTravelEnd(f, 'from', t), dep = isHM(f.depart) ? f.depart : '', by = dep ? tmAddMin(dep, -mg.before) : '';
        const gc = !D.c && f.group && !travelEnd(f, 'from', t).home ? (prev ? prev.c : !started && hPrev0 ? hPrev0.c : null) : null; // Q1: the group collects you where you are
        if (gc) impl[f.id] = gc;
        const P = D.c ? { c: D.c, tok, n: D.name || kind, t: by ? { start: by } : null, tv: { by, before: mg.before, kind } } : null;
        if (P && prev) { const L = mk(prev, P, P.tv); if (L) byB[tok] = L; }
        if (!started) { started = true; first = P || (gc ? { c: gc, tok, n: kind, t: null } : null); }
        if (!tr) tr = { a: D.c || gc || (prev && prev.c), mode: f.mode || 'flight', own: !!((D.c || gc) && A.c) }; // own: the travel draws its own line (travels-3-maps) - no gap
        if (Number(f.arriveDay) > 0) { prev = last = null; return; } } // D1: the day ends at the departure point
      else { started = true; tr = null; } // the landing of a travel that left on another day: the day starts at its arrival point
      if (A.c) { if (tr && tr.a && !tr.own && distanceKm(tr.a, A.c) > 0.05) gaps.push({ a: tr.a, b: A.c, mode: tr.mode }); tr = null;
        prev = last = { c: A.c, tok, n: A.name || kind, t: done ? { end: done } : null }; }
      else prev = last = null;
      return; }
    const c = coordOf(e); if (!c) return;
    if (tr) { if (tr.a && distanceKm(tr.a, c) > 0.05) gaps.push({ a: tr.a, b: c, mode: tr.mode }); tr = null; }
    const Q = { c, tok, n: nm(e), t: tm(e) };
    if (!started) { started = true; first = Q; }
    if (prev) { const L = mk(prev, Q); if (L) byB[tok] = L; }
    prev = last = Q;
  });
  LEG_GAPS[d.key] = gaps; DAY_TRAVELS[d.key] = tvs; DAY_TV_FROM[d.key] = impl;
  if (!on) return {};
  const out = { byB };
  const hPrev = hPrev0, hNow = hotelAt(d.date);
  if (first && hPrev && far(hPrev.c, first.c)) { const key = `${d.key}|h:${hPrev.l.id}|${first.tok}`;
    out.from = LEGS[key] = { key, day: d.key, date: d.date, a: hPrev.c, b: first.c, an: hPrev.l.name || 'הלינה', bn: first.n, tA: null, tB: first.t, hm: '', hotel: 'from', ...(first.tv ? { tv: first.tv } : {}) }; out.fromTok = first.tok; }
  if (last && hNow && far(last.c, hNow.c)) { const key = `${d.key}|${last.tok}|h:${hNow.l.id}`;
    out.to = LEGS[key] = { key, day: d.key, date: d.date, a: last.c, b: hNow.c, an: last.n, bn: hNow.l.name || 'הלינה', tA: last.t, tB: null, hm: (last.t || {}).end || '', hotel: 'to' }; }
  return out;
}
// ---- the leg sheet: three ways side by side ----
function openLegSheet(key) {
  const L = LEGS[key]; if (!L) return; const sheet = document.getElementById('sheet');
  sheet.innerHTML = `${fmHead(`🧭 ${nameB(L.an)} ← ${nameB(L.bn)}`, 'lgClose')}<div id="legSheetBody" data-leg="${key}"></div>
    <div class="brow sheet-actions sheet-save-bar"><button class="btn-nav" data-act="win.done">✓ סיום</button><a class="sh-secondary" id="legNav" target="_blank" rel="noopener" href="#">${msi('navigation', { size: 18 })} ניווט בגוגל מפות</a></div>`;
  
  ['walk', 'car', 'transit'].forEach(m => legEnsure(L, m));
  legSheetFill(L); openSheet('leg');
}
function legSheetFill(L) {
  const box = document.getElementById('legSheetBody'); if (!box) return; const cur = legMode(L), manual = legModes()[L.key];
  // 10.5.0 (design-4 part 2, look.md "Planning windows"): a choice card per mode - its line icon, the name with its details under it,
  // minutes and distance at the end; a mode with no line or slower than walking dimmed with its reason; the chosen one tinted
  const card = (m, t, v, cls, at) => `<${at ? 'button type="button"' : 'div'} class="leg-way${cls}"${at || ''}>${msi(LEG_MODES[m].ms, { cls: 'lw-ic' })}<span class="lw-t"><b>${LEG_MODES[m].label}</b>${t}</span>${v}</${at ? 'button' : 'div'}>`;
  const row = m => { const v = legValue(L, m);
    if (m === 'transit' && v.none) return card(m, '<small>לא נמצא קו בין שני המקומות (או שאין לשירות נתונים כאן)</small>', '', ' off'); // 4.37.0: say why, don't just drop the row
    if (m === 'transit' && v.r && v.r.walkOnly) return card(m, `<small>ברגל מהיר יותר מכל קו (${fmtLegMin(v.min)})</small>`, '', ' off');
    const r = v.r, det = m === 'transit' && r ? `<small>${(r.legs || []).filter(l => l.m !== 'WALK').map(l => `<span class="tr-line" style="${l.c ? `background:${l.c};color:#fff` : ''}">${_escH(l.n || l.m)}</span>${l.h ? ' ל' + _escH(l.h) : ''}`).join(' ← ')}${r.tr ? `${SEP}${r.tr} החלפות` : ''}${r.d ? `${SEP}${msiT('directions_walk', fmtKm(r.d / 1000) + ' ברגל', { size: 16 })}` : ''}${r.dep ? `${SEP}יציאה ${tmFmt('time', r.dep, { zone: dayZone(L.date) })}` : ''}</small>` : '';
    return card(m, `${v.est ? `<small>${navigator.onLine ? 'מחשב…' : 'הערכה לפי קו אוויר' + SEP + SVC_WAIT_NET}</small>` : ''}${det}`, `<span class="lw-v${v.est ? ' est' : ''}">${v.est ? '≈ ' : ''}${fmtLegMin(v.min)}${SEP}${fmtKm(v.km)}</span>`, m === cur ? ' on' : '', ` data-act="leg.way" data-v="${m}"`); };
  const gap = legGap(L);
  const by = legLeaveBy(L), tv = L.tv; // travels-2-plan: the leg to a travel - when to leave, and by when to be there ("before" counted)
  box.innerHTML = `${by ? `<p class="sh-hint">לצאת עד <bdi dir="ltr">${by}</bdi>, כדי להגיע עד <bdi dir="ltr">${tv.by}</bdi>${tv.before ? ` (${marginText(tv.before)} לפני ה${_escH(tv.kind)})` : ''}.</p>` : gap != null ? `<p class="sh-hint">יש ${fmtLegMin(Math.max(0, gap))} בין ${_escH(L.an)} ל${_escH(L.bn)}.</p>` : ''}<div class="leg-ways">${['walk', 'transit', 'car'].map(row).join('')}</div>
    <div class="lw-auto">${segHTML('leg.way', [['auto', `${msi('autorenew', { size: 18 })} אוטומטי`]], manual ? '' : 'auto')}</div>
    ${gap != null && legValue(L).min > gap ? `<p class="sh-hint">${warnIc()} אין מספיק זמן. בוחרים דרך מהירה יותר, או מזיזים את ${_escH(tv ? L.an : L.bn)} ב-${msi('schedule', { cls: 'msi-in' })}.</p>` : ''}
    <p class="sh-hint">${svcCredit('fossgis', { fix: true })}${['transit'].some(m => legValue(L, m).r) ? SEP + 'תחבורה ציבורית: ' + svcCredit('transitous') : ''}</p>`; // 7.1.0 (ש6): from the providers' rows, with "לתקן את המפה"
  const nav = document.getElementById('legNav'); if (nav) nav.href = `https://www.google.com/maps/dir/?api=1&origin=${L.a.lat},${L.a.lng}&destination=${L.b.lat},${L.b.lng}&travelmode=${LEG_MODES[cur].gm}`;
}
act('leg.way', c => { const L = LEGS[document.getElementById('legSheetBody').dataset.leg]; if (!L) return; const m = c.v; if ((legModes()[L.key] || 'auto') === m) return 'quiet'; // undo-history: the current way again is not a change (no empty row)
  if (m === 'auto') delete legModes()[L.key]; else legModes()[L.key] = m; persist(); legSheetFill(L); routeTick();
  showUndoToast(m === 'auto' ? 'דרך אוטומטית' : LEG_MODES[m].label); return 'quiet'; });
undoAfter(keys => { const sh = document.getElementById('legSheetBody'); // undo-history: an open leg sheet shows the way restored (the plan itself is redrawn by the undo)
  if (sh && sh.dataset.leg && LEGS[sh.dataset.leg] && keys.some(k => /^\["d",.*"planX"\]$/.test(k))) legSheetFill(LEGS[sh.dataset.leg]); });
// ≈ anywhere: a tap explains it


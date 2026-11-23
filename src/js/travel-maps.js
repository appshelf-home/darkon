// ================= TRAVELS ON THE MAPS (11.2.0, travels-3-maps) =================
// decisions 2026-11-10 "Travels on the map" Q2 (display), Q8, Q9, Q10, derived 7-8; the 11.0.0 review (every travel on every map:
// travelsOf - the list of the travels drawn before 11.0.0 is gone). A travel is drawn between its two ends only when both are confirmed and neither is at
// home (Q5, Q6) - never on a guess.
// - Its line (Q10): a flight an arc; a car on the road; a train, a bus and a ferry on their real path from the public-transport service,
//   asked by the travel's day and time (a date whose timetable is not out yet: the same weekday soon - tmRouteWhen - and once more when
//   the date comes into range, D7). The path is asked once and kept with the travel (path; pathK - the kind and the ends it was asked
//   for; pathNear - the near date used), so the memory map and the trip picture draw it after the trip with no lookup. No path found: a
//   straight line marked as approximate (pale and dashed, as an estimated leg) - a permanent fallback. A path a file brought (no pathK)
//   is used as given until the ends change.
// - Its role (Q8, D8): a move (the night after it is in another lodging than the night before), an outing (the same lodging: a light
//   dashed loop from the stop to its goal and back, and a row under its stop), or the way from home and back (not drawn, Q6). With no
//   lodging for one of those nights, an outing only when the day's travels return to where the first one left (11.4.0, the 11.2.0 review's Q1).
// - On the day map (Q9): the ends as pins in the travel tone with the kind's icon, the line; the frame follows the day's places - a short
//   travel fits in, a long one leaves it to an edge arrow named for its far end, and a tap on the arrow fits the whole travel.
const TV_FAR = 0.05; // km: two points closer than this are one point (as the legs, D3)
const TV_TRANSIT = { train: 'RAIL', bus: 'BUS,COACH', ferry: 'FERRY' }; // the service's modes for each kind
// the context of a drawing: the trip, its ends at home, and (a memory) its places' coordinates by id
function tvCtx(t, pc) { t = t || activeTripObj(); return { t, home: travelHomeEnds(t), pc: pc || null }; }
// a travel's record as it is now (a group travel's record is rebuilt when its line changes - a kept path included)
function tvCur(f, C) { return (f && f.id != null && travelById(f.id, C.t)) || f; }
// gc (11.3.0, the 11.1.0 review's Q1): the day's previous point, where a group travel with no confirmed "מ-" leaves from (the plan's
// chain on the day map - DAY_TV_FROM; the stop or the previous travel's arrival on the route and the memory - tvChain); mine still need "מ-"
function tvEndC(f, side, C, gc) { if (C.home.has(f.id + '|' + side)) return null; const loc = f[side + 'Loc']; if (!loc) return side === 'from' && f.group && gc ? gc : null;
  return loc.pid != null && C.pc ? C.pc(loc.pid) : endCoord(loc, C.t); }
function travelPts(f, C, gc) { const a = tvEndC(f, 'from', C, gc), b = tvEndC(f, 'to', C); return a && b ? { a, b } : null; }
function travelPathK(f, P) { return (f.mode || 'flight') + '|' + _r5(P.a) + '|' + _r5(P.b); }
// { a, b, mode, pts, approx } - null while an end is unknown
function travelLine(f, C, gc) { const P = travelPts(f, C, gc); if (!P) return null; const mode = f.mode || 'flight';
  if (mode === 'flight') return { ...P, mode, pts: arcPoints(P.a, P.b), approx: false };
  const kept = Array.isArray(f.path) && f.path.length > 1 && (!f.pathK || f.pathK === travelPathK(f, P)) ? f.path : null;
  return { ...P, mode, pts: kept || [[P.a.lat, P.a.lng], [P.b.lat, P.b.lng]], approx: !kept }; }
// a found path is kept in the record the travel lives in - mine: trip.travels; the group's: its program line (derived, like a found
// address: not a change of mine, so no undo row, and the line's own fields stay as the source gave them)
function travelPathPut(f, t, val) { const rec = f.group ? (t.schedule || []).find(s => s && String(s.id) === String(f.src)) : (t.travels || []).find(x => String(x.id) === String(f.id)); if (!rec) return false;
  ['path', 'pathK', 'pathNear'].forEach(k => { if (val[k] == null) delete rec[k]; else rec[k] = val[k]; }); return true; }
// 11.4.0 (the 11.2.0 review's miss): a source update replaces the program's lines - a group travel's kept path (on its line) stays when the
// new line is the same travel with the same kind and ends, so its pathK still matches: not asked again, and a memory never falls back to a straight line
function schedPathsKeep(sch, old) { (sch || []).forEach(s => { const o = s && !s.path && (old || []).find(x => x && String(x.id) === String(s.id)); if (!o || !o.pathK) return;
  const k = x => JSON.stringify([x.kind, x.mode || '', x.fromLoc || null, x.toLoc || null]); if (k(o) !== k(s)) return;
  ['path', 'pathK', 'pathNear'].forEach(f => { if (o[f] != null && o[f] !== '') s[f] = JSON.parse(JSON.stringify(o[f])); }); }); }
const _TV_PW = new Set(), _TV_DONE = new Set();
// asks once for a travel's path (none kept for its kind and ends, or a near date's to refresh in range); a promise of true when one was kept
function travelPathWant(f0, C, gc) { if (!f0 || (f0.mode || 'flight') === 'flight' || !MAP_AVAILABLE) return null; const t = C.t;
  if (!t || !t.id || t.__draft || t.archived || ARCHIVE_VIEW) return null; // a memory and the draft never ask
  const f = travelById(f0.id, t); if (!f) return null; // the record as it is now
  const P = travelPts(f, C, gc); if (!P) return null; const k = travelPathK(f, P), car = f.mode === 'car';
  const refresh = f.pathK === k && !!f.pathNear && !!f.date && f.date >= todayStr() && tmRouteWhen(f.date, f.depart).slice(0, 10) === f.date;
  if ((f.pathK === k && !refresh) || (!f.pathK && Array.isArray(f.path) && f.path.length > 1)) return null; // kept for these ends, or brought by a file (used as given)
  const wk = t.id + '|' + f.id + '|' + k + (refresh ? '|r' : ''); if (_TV_PW.has(wk) || _TV_DONE.has(wk)) return null; _TV_PW.add(wk);
  const when = car ? '' : tmRouteWhen(f.date || todayStr(), f.depart), req = car ? osrmReq('car', P.a, P.b, true) : transitReq(P.a, P.b, when, TV_TRANSIT[f.mode] || 'TRANSIT');
  return svcAsk(car ? 'route' : 'transit', { key: 'tv|' + k + '|' + when, build: () => req, parse: car ? osrmParse : transitParse }).then(r => { _TV_PW.delete(wk);
    if (r.kind !== 'ok' && r.kind !== 'empty') return false; // no answer (offline, gave up): asked again another time
    _TV_DONE.add(wk); // answered: never twice in one opening, whatever happens to the stored copy
    const g = r.kind === 'ok' && !r.value.walkOnly && Array.isArray(r.value.g) && r.value.g.length > 1 ? r.value.g : null;
    if (refresh && !g) travelPathPut(f, t, { path: f.path, pathK: k }); // D7: refreshed once - a near date's path stays when the real date finds none
    else travelPathPut(f, t, { path: g, pathK: k, pathNear: !car && !refresh && when.slice(0, 10) !== f.date ? when.slice(0, 10) : null });
    persist(true); hRebase(); return true; }); }
// ---- roles (Q8, D8) ----
function tvNight(t, iso) { const l = (t.lodging || []).find(x => x && x.checkIn && x.checkOut && x.checkIn <= iso && iso < x.checkOut); return l ? (l.placeId != null ? 'p' + l.placeId : 'n' + (l.name || l.id)) : null; }
// 11.4.0 (the 11.2.0 review's Q1, replacing D8's destinations): when a night on either side has no lodging, a travel is part of an
// outing only when the day's travels return to the first one's departure point (within TV_BACK) on the same day - those travels, up to
// the one that returns, are the outing; any other is a move.
// 11.6.0 (the 11.4.0 review's Q3): a group travel with no confirmed "מ-" leaves from the day's previous point, as in its chain (tvChain,
// DAY_TV_FROM) - where a travel of an earlier day landed that day (an overnight flight), else last night's lodging - and the return is
// measured from there (tvDayStart); with no such point (no such landing, no lodging with a place the night before) the day's travels stay
// moves. Mine still need "מ-". A travel of the same day is never that point: it is one of the day's travels, and could "return" to itself.
const TV_BACK = 0.3; // km: "back where it left from"
function tvDayStart(t, f, d, C) { const c = tvEndC(f, 'from', C); if (c || !f.group || f.fromLoc || C.home.has(f.id + '|from')) return c;
  const land = travelsOf(t).filter(x => x.date && x.date < d && travelLandDate(x) === d).pop();
  if (land) return tvEndC(land, 'to', C);
  const n = isoAdd(d, -1), l = (t.lodging || []).find(x => x && x.checkIn && x.checkOut && x.checkIn <= n && n < x.checkOut && x.placeId != null);
  return l ? (C.pc ? C.pc(l.placeId) : endCoord({ pid: l.placeId }, t)) || null : null; }
function tvDayReturn(t, d, home, C) { const fs = travelsOf(t).filter(f => f.date === d && !home.has(f.id + '|from') && !home.has(f.id + '|to')).sort((p, q) => String(p.depart || '').localeCompare(String(q.depart || '')));
  const p0 = fs.length > 1 ? tvDayStart(t, fs[0], d, C) : null; if (!p0) return new Set();
  const j = fs.findIndex((f, i) => i > 0 && travelLandDate(f) === d && (c => c && distanceKm(c, p0) <= TV_BACK)(tvEndC(f, 'to', C)));
  return new Set(j > 0 ? fs.slice(0, j + 1).map(f => String(f.id)) : []); }
function travelRoles(t, C) { t = t || activeTripObj(); const home = travelHomeEnds(t), R = new Map(), back = new Map(); C = C || tvCtx(t);
  travelsOf(t).forEach(f => { const id = String(f.id); if (home.has(f.id + '|from') || home.has(f.id + '|to')) { R.set(id, 'home'); return; } if (!f.date) { R.set(id, 'move'); return; }
    const nb = tvNight(t, isoAdd(f.date, -1)), na = tvNight(t, travelLandDate(f));
    const same = nb && na ? nb === na : (back.has(f.date) ? back : back.set(f.date, tvDayReturn(t, f.date, home, C))).get(f.date).has(id);
    R.set(id, same ? 'out' : 'move'); });
  return R; }
// every travel that is not an outing, by date and time - the route, the memory and the trip picture read the ways between stops from it
function tripMoves(t, C) { t = t || activeTripObj(); const R = travelRoles(t, C); return travelsOf(t).filter(f => R.get(String(f.id)) !== 'out'); }
// the outings: [{ f (the first travel of the day out), fs, date, night, goal: { c, name } }] - travels out of the same night's lodging on one day are one outing
function tripOutings(t, C) { t = t || activeTripObj(); C = C || tvCtx(t); const R = travelRoles(t, C), out = [];
  travelsOf(t).forEach(f => { if (R.get(String(f.id)) !== 'out') return; const n = tvNight(t, isoAdd(f.date, -1)) || dayDestId(f.date, t), o = out[out.length - 1];
    if (o && o.date === f.date && o.night === n) o.fs.push(f); else out.push({ f, fs: [f], date: f.date, night: n }); });
  out.forEach(o => { const c = tvEndC(o.f, 'to', C); o.goal = { c, name: String(o.f.to || travelTitle(o.f)).trim() }; });
  return out; }
function outingHTML(o) { return `טיול יום${SEP}${travelKindName(o.f)} ל<bdi>${_escH(o.goal.name)}</bdi>${SEP}${tmFmt('dayN', o.date)}`; } // the goal's name isolated: a Latin name keeps its place in the Hebrew line
function outingKey(o) { return idFix('o:' + o.date + '>' + o.goal.name, null, 'key'); } // 11.21.6 (P5): the key of the file form, as the door converts it
// the way from one stop to the next through its travels' ends (Q2): [{ pts, mode, approx, link, f }]; null when a travel has an end
// unknown (the stop-to-stop line stays, as before)
function tvChain(a, b, fs, C) { if (!a || !b || !fs.length) return null; fs = fs.map(f => tvCur(f, C)); let at = a; const gs = [];
  const Ls = fs.map(f => { gs.push(at); const x = travelLine(f, C, at); if (x) at = x.b; return x; }); if (Ls.some(x => !x)) return null; // a group travel with no "מ-" leaves from the point before it (Q1)
  const out = [], link = (p, q) => { if (distanceKm(p, q) > TV_FAR) out.push({ pts: [[p.lat, p.lng], [q.lat, q.lng]], mode: 'none', link: true }); }; let cur = a;
  Ls.forEach((x, i) => { link(cur, x.a); out.push({ pts: x.pts, mode: x.mode, approx: x.approx, f: fs[i], gc: gs[i] }); cur = x.b; }); link(cur, b); return out; }
function tvLoop(a, g) { const p = { lat: a.lat, lng: a.lng }, q = { lat: g.lat, lng: g.lng }; return [arcPoints(p, q), arcPoints(q, p)]; } // out and back (Q8)
// ---- the day map (Q9) ----
// the travels of the shown days: pins, lines and the far ends (for the frame and the edge arrows); redrawn with the day's lines
function dayTravelGeo(keys) { const C = tvCtx(), out = [];
  keys.forEach(k => (DAY_TRAVELS[k] || []).forEach(f0 => { const f = tvCur(f0, C); if (out.some(x => x.f === f)) return; const gc = (DAY_TV_FROM[k] || {})[f.id] || null, L = travelLine(f, C, gc);
    out.push({ f, L, gc, mark: !!TV_MARK && TV_MARK.day === k && String(TV_MARK.id) === String(f.id),
      ends: ['from', 'to'].map(side => ({ side, c: tvEndC(f, side, C, gc), name: String(f[side] || '').trim(), pid: (f[side + 'Loc'] || {}).pid, gc: side === 'from' && !f.fromLoc && !!gc })) }); }));
  return { C, list: out }; }
// 11.3.0 (the 11.1.0 review's miss b): "על מפת היום" on a travel card - the day map framed by the day (Q9), with that travel marked: its
// line above the others and heavier, its ends' pins in the maps' selected state (pin-sel); a far end by its edge arrow. Until another
// travel is marked or that day goes back to its list.
let TV_MARK = null;
function tvPinIcon(f) { const big = (f.mode || 'flight') === 'flight', s = big ? 34 : 26;
  return L.divIcon({ className: '', html: `<div class="tv-pin${big ? ' big' : ''}">${msi(TRAVEL_MS[f.mode] || 'flight', { size: big ? 18 : 14 })}</div>`, iconSize: [s, s], iconAnchor: [s / 2, s / 2] }); }
function tvLineOpts(x) { const fl = x.mode === 'flight', S = ROUTE_STYLE[x.mode] || ROUTE_STYLE.none;
  return x.approx ? { weight: 2.5, opacity: .5, dashArray: '4 6', className: 'tv-line approx' } : { weight: fl ? 3 : S.w, opacity: .9, dashArray: fl ? '2 8' : S.dash, lineCap: 'round', className: 'tv-line ' + (fl ? 'flight' : x.mode) }; }
// draws the day's travels on map (pins - one per point, none over a pinned place of the day - and lines); returns the layers
function dayTravelsDraw(map, hostId, G, pinned) { const out = [], seen = [];
  G.list.slice().sort((p, q) => (p.mark ? 1 : 0) - (q.mark ? 1 : 0)).forEach(x => { if (x.L) { const o = tvLineOpts(x.L), pl = L.polyline(x.L.pts, x.mark ? { ...o, weight: o.weight + 2, opacity: 1, className: o.className + ' tv-mark' } : o).addTo(map); pl.on('click', () => openTravelFloat(hostId, x.f, x.gc)); out.push(pl); }
    x.ends.forEach(e => { if (!e.c || e.gc || (e.pid != null && pinned.has(e.pid)) || seen.some(c => distanceKm(c, e.c) < TV_FAR)) return; seen.push(e.c); // the previous point a group travel leaves from is already pinned
      const mk = L.marker([e.c.lat, e.c.lng], { icon: tvPinIcon(x.f), zIndexOffset: x.mark ? 3000 : 800, title: e.name }).addTo(map); mk.on('click', () => openTravelFloat(hostId, x.f, x.gc)); out.push(mk);
      if (x.mark) { const el = mk.getElement && mk.getElement(); if (el) el.classList.add('pin-sel'); } }); });
  return out; }
// the frame (Q9): the day's places, and a travel's end only when it is near them (a short travel fits; a long one's far end stays out)
function dayTravelFrame(bounds, G) { const ends = [].concat(...G.list.map(x => x.ends.filter(e => e.c).map(e => e.c)));
  if (!ends.length) return bounds; let core = bounds.map(b => ({ lat: b[0], lng: b[1] }));
  if (!core.length) { const last = G.list.slice().reverse().map(x => x.ends[1].c || x.ends[0].c).find(Boolean); if (!last) return bounds; core = [last]; } // no place: where the day goes on
  let diam = 0; core.forEach(p => core.forEach(q => { diam = Math.max(diam, distanceKm(p, q)); }));
  const R = Math.max(40, diam * 1.5), near = ends.filter(c => core.some(p => distanceKm(p, c) <= R));
  return core.concat(near).map(c => [c.lat, c.lng]); }
// the edge arrows (Q9): a travel's far end outside the view - an arrow on the frame's edge where its line leaves, named "<far end> · N ק״מ"
// (the travel's length); a tap fits the whole travel. 11.4.0: built by the maps' one live edge arrow (mapEdgeArrows, map-component.js).
function tvEdgeArrows(map, G) { const items = []; G.list.forEach(x => { if (!x.L) return; [[x.ends[1], x.L.a], [x.ends[0], x.L.b]].forEach(([e, near]) => { if (e.c) items.push({ c: e.c, near, name: e.name || travelKindName(x.f), km: distanceKm(near, e.c), fit: x.L.pts }); }); });
  return mapEdgeArrows(map, items, 'tv-edge'); }
// a travel's floating card on a map: its kind, time, ends and length; navigate to the departure point and the editor (not in a memory)
function openTravelFloat(hostId, f, gc) { const esc = _escH, C = tvCtx(), P = travelPts(f, C, gc), ro = !!activeTripObj().archived || !!ARCHIVE_VIEW, nav = travelNavUrl(f);
  const km = P ? Math.round(distanceKm(P.a, P.b)) : null, Ln = P ? travelLine(f, C, gc) : null;
  const html = cdCard({ lead: leadHTML('travel', msi(TRAVEL_MS[f.mode] || 'flight', { size: 18 }), ''), name: esc(travelTitle(f)),
    tags: [f.depart || f.arrive ? `<span class="tl-tag cd-when time">${tagIc('schedule')}<span dir="ltr">${esc(f.depart || '?')}–${esc(f.arrive || '?')}</span></span>` : '', cdMeta([travelKindName(f), f.date ? tmFmt('date', f.date) : '', f.group ? 'קבוצתי' : ''])],
    desc: `${travelEndsLine(f)}${km != null ? `<span class="mc-desc mc-desc2">${fmtKm(km)}${Ln && Ln.approx ? (SEP + '≈ קו משוער') : ''}</span>` : ''}`,
    acts: `<div class="tl-acts mc-acts">${nav ? linkBtn('tl-act a-nav', nav, actIc('navigation'), 'ניווט למיקום היציאה') : ''}${ro ? '' : `<button type="button" class="tl-act a-ed" data-act="trip.editTravel" data-v="${esc(String(f.id))}" aria-label="עריכת הנסיעה" title="עריכת הנסיעה">${actIc('edit')}</button>`}</div>` });
  openFloatCard(hostId, html); }
// ---- a memory (the memory map, the trip picture): its places by the trip's snapshot, kept paths only ----
function memTvCtx(M) { return tvCtx(M.t, pid => { const p = (M.pmap && M.pmap.get(pid)) || (M.places || []).find(q => q.id === pid); return p ? snapCoord(p) : null; }); }
// [{ c (the stop of the night before), g (the goal), name, mode, f }] - stops: [{ c, from, to | nights }]
function memOutings(M, stops) { const C = memTvCtx(M), to = s => s.to || isoAdd(s.from, s.nights || 1);
  return tripOutings(M.t, C).map(o => { const n = isoAdd(o.date, -1), s = stops.find(x => x.from <= n && n < to(x)) || stops.find(x => x.from <= o.date && o.date < to(x));
    return s && s.c && o.goal.c ? { c: s.c, g: o.goal.c, name: o.goal.name, mode: o.f.mode || 'flight', f: o.f } : null; }).filter(Boolean); }

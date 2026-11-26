// ================= 11.9.0: GOOGLE TIMELINE - import at the end of a trip (task timeline-import; decisions 2026-11-07, Q1-Q4 and addendum) =================
// diet-groups (11.62.0): tlOf, tlCancelled, the before-trip row and the late line are in js/ratings.js (main: the trips screen and the general screen draw them)
// Google keeps Timeline on the phone since 2024 and exports it to a file (Android: Location → Timeline → Export; iPhone: Google Maps →
// Personal content → Export Timeline data). The file is read here, on the phone, and forgotten at once (Q4): only the trip's days are
// read; what is kept, with the trip (registry row "timeline", td.tl, the trip's "visits" part - a friend's trip file leaves it out):
//   tl = { at, n: days read, days: { 'YYYY-MM-DD': { s: [{ m: 'w' | 'r', p: [[lat, lng], ...] }] (tl-paths: the day's cleaned segments, walk or
//          ride, in time order, simplified to a few hundred points in all), km: walking km, r: { <ride kind>: km } (ride-km; from ride-no-home
//          (rh: 1) without the way from home and back - tlHomeMoves) } },
//          (a day imported before tl-paths has p: [[lat, lng], ...] - one line, no kinds - instead of s and r; cleaned on read, tlPaths)
//          v: { <placeId>: { d: date, s: 'HH:MM', m: minutes } } - only for a place marked "היינו" (confirmed or added) }
// What a review needs and is not kept (the matches of places not confirmed, the places not on the list) lives in TL_REVIEW for the
// session. Formats read: the on-device export (Android: { semanticSegments }, iPhone: a list of segments) and the old Takeout
// ({ timelineObjects }); the CSV some EU users get carries no places, so it gets a clear message (tlParse).
// Matching (Q1): a visit is a trip place when it is within TL_NEAR of the place (the export has a Google place id but no name, and the
// app's places have no Google place id - so by distance); a visit near none, of at least TL_EXTRA_MIN minutes and not home or work, is
// offered as "היינו גם כאן · לא היה ברשימה". A day's path: its segments, walk and ride, cleaned (tlDaySegs - tl-paths) and simplified
// (tlSimplifyDays, the one line simplifier simplifyLine) to TL_MAX_PTS; walking km: the walking moves' own distance (else the straight line
// between their ends); ride-km: the other moves' km by kind (tlRideKm).
// 11.18.0 (timeline-offers; decisions 2026-11-15 "Which places the Google Timeline import offers" Q3-Q4): the radius by kind - a pin is
// one point and an airport spans kilometres: an airport TL_NEAR_AIRPORT, a train or bus station and a port TL_NEAR_STATION, every other
// place TL_NEAR; the nearest wins by distance, whatever the radii. A travel's located end that is not a trip place takes its kind's.
const TL_NEAR = 0.15, TL_NEAR_AIRPORT = 3, TL_NEAR_STATION = 0.4, TL_EXTRA_MIN = 15, TL_MAX_PTS = 400, TL_FILE_MAX = 300e6;
// legal-server (11.41.0; decisions 2026-11-21 · Review of the legal-review report, Q11 - S2, U6): an offer near the person's home or work, or at a
// place they keep coming back to, is never sent for a name - offered without one, named by hand. Home / work: the visits the file marks so
// (semanticType HOME / WORK, INFERRED_HOME / INFERRED_WORK - anywhere in the file, any day), within TL_PRIV_KM; a place they keep coming back to:
// visits within TL_NEAR of it on TL_FREQ_DAYS different days outside the trip (tlPrivate)
const TL_PRIV_KM = 0.5, TL_FREQ_DAYS = 6;
const TL_GID_KM = 1; // 11.22.0 (place-gid-1, Q6 (1)): a visit with a place's Google id is that place up to 1 km
const TL_STATIONS = new Set(['train_station', 'bus_station', 'port']);
function tlRadius(icon) { return icon === 'airport' ? TL_NEAR_AIRPORT : TL_STATIONS.has(icon) ? TL_NEAR_STATION : TL_NEAR; }
function tlEndRadius(mode) { mode = mode || 'flight'; return mode === 'flight' ? TL_NEAR_AIRPORT : mode === 'car' ? TL_NEAR : TL_NEAR_STATION; }
let TL_REVIEW = null; // { id, at, matched: { pid: { d, s, m } }, extras: [{ k, ll, d, s, m }], added: [k], stats } - the review of an import, not stored
function tlLL(v) {
  if (!v) return null;
  if (typeof v === 'object') { if (v.latitudeE7 != null) return { lat: v.latitudeE7 / 1e7, lng: v.longitudeE7 / 1e7 }; if (v.latE7 != null) return { lat: v.latE7 / 1e7, lng: v.lngE7 / 1e7 }; /* tl-paths: the old Takeout's waypoints */ return tlLL(v.latLng || v.point || v.placeLocation || v.location); }
  const m = String(v).match(/(-?\d+(?:\.\d+)?)°?\s*,\s*(-?\d+(?:\.\d+)?)°?/); if (!m) return null;
  const c = { lat: +m[1], lng: +m[2] }; return Math.abs(c.lat) <= 90 && Math.abs(c.lng) <= 180 ? c : null;
}
// a moment of the file: its local date and hour as written (the export writes the place's own offset); the old Takeout writes UTC (Z)
function tlAt(s) { s = String(s || ''); const m = s.match(/^(\d{4}-\d\d-\d\d)T(\d\d:\d\d)/); if (!m) return null; return { d: m[1], hm: m[2], ms: tmMs(s) }; }
const TL_WALK = /^(walking|on_foot|running|walk)$/i, TL_HOME = /home|work/i;
function tlParse(text) {
  const t = String(text || '').replace(/^\uFEFF/, '').trim();
  if (!t) return { err: 'הקובץ ריק' };
  if (!/^[\[{]/.test(t)) return { err: /^[^\n]*,/.test(t) ? 'זה קובץ CSV של ציר הזמן - הוא לא כולל את המקומות. מייצאים שוב כ-JSON (בהגדרות ציר הזמן, "ייצוא")' : 'זה לא קובץ של ציר הזמן של גוגל' };
  let o; try { o = JSON.parse(t); } catch (e) { return { err: 'הקובץ לא נקרא - צריך את קובץ ה-JSON שגוגל מייצא' }; }
  const segs = Array.isArray(o) ? o : Array.isArray(o.semanticSegments) ? o.semanticSegments : null, out = { visits: [], moves: [], pts: [] };
  if (segs) segs.forEach(g => { if (!g || typeof g !== 'object') return; const a = tlAt(g.startTime), b = tlAt(g.endTime);
    if (g.visit && a) { const c = g.visit.topCandidate || {}, ll = tlLL(c.placeLocation || c.placeLocation); if (ll) out.visits.push({ a, b: b || a, ll, type: String(c.semanticType || ''), gid: gidOfId(c.placeId) }); }
    else if (g.activity && a) { const x = g.activity, c = x.topCandidate || {}, s = tlLL(x.start), e = tlLL(x.end), km = x.distanceMeters != null ? +x.distanceMeters / 1000 : null;
      out.moves.push({ a, b: b || a, s, e, km: isFinite(km) ? km : null, walk: TL_WALK.test(String(c.type || '')), kind: tlRideKind(c.type) }); }
    else if (Array.isArray(g.timelinePath) && a) g.timelinePath.forEach(q => { const ll = tlLL(q.point); if (!ll) return;
      const at = q.time ? tlAt(q.time) : q.durationMinutesOffsetFromStartTime != null ? { d: a.d, ms: a.ms + (+q.durationMinutesOffsetFromStartTime) * 6e4 } : a;
      if (at) out.pts.push({ d: at.d || a.d, ms: at.ms, ll }); }); });
  else if (Array.isArray(o.timelineObjects)) o.timelineObjects.forEach(g => { // the old Takeout ("Semantic Location History")
    if (g.placeVisit) { const v = g.placeVisit, a = tlAt((v.duration || {}).startTimestamp), b = tlAt((v.duration || {}).endTimestamp), ll = tlLL(v.location);
      if (a && ll) out.visits.push({ a, b: b || a, ll, type: String((v.location || {}).semanticType || ''), gid: gidOfId((v.location || {}).placeId) }); }
    else if (g.activitySegment) { const x = g.activitySegment, a = tlAt((x.duration || {}).startTimestamp), b = tlAt((x.duration || {}).endTimestamp);
      if (!a) return; const mv = { a, b: b || a, s: tlLL(x.startLocation), e: tlLL(x.endLocation), km: x.distance != null ? x.distance / 1000 : null, walk: TL_WALK.test(String(x.activityType || '')), kind: tlRideKind(x.activityType), path: [] }; out.moves.push(mv);
      // tl-paths: the old Takeout's waypoints carry no time - each its share of the move's time, in order, kept with its move
      const wp = ((x.waypointPath || {}).waypoints || (x.simplifiedRawPath || {}).points || []).map(tlLL).filter(Boolean);
      wp.forEach((ll, i) => mv.path.push({ d: a.d, ms: a.ms + (mv.b.ms - a.ms) * (i + 1) / (wp.length + 1), ll })); } });
  else return { err: 'זה לא קובץ של ציר הזמן של גוגל' };
  if (!out.visits.length && !out.moves.length && !out.pts.length) return { err: 'אין בקובץ ביקורים או מסלולים' };
  return out;
}
// ride-km (Q1): a move's kind from the file's activity type (Android / iPhone / Takeout spell it differently)
function tlRideKind(t) { t = String(t || '').toUpperCase().replace(/[\s-]+/g, '_');
  return /FLY|PLANE/.test(t) ? 'flight' : /SUBWAY|METRO|TRAM|CABLE|FUNICULAR|GONDOLA|CYCL|BIKE|SKI/.test(t) ? 'city' : /TRAIN|RAIL/.test(t) ? 'train'
    : /BUS|COACH/.test(t) ? 'bus' : /FERRY|BOAT|SAIL/.test(t) ? 'ferry' : /VEHICLE|CAR|TAXI|DRIV|MOTOR/.test(t) ? 'car' : 'city'; }
// the trip's places that a visit can be (located; airports too since 11.18.0, Q3), each with its coordinate and its radius
// (a closed trip: its snapshot's places - what the memory screen shows; tripMemoryData)
function tlPlaceList(id) { const t = STATE.trips[id]; return t && t.archived && t.archived.snap ? (t.archived.snap.places || []) : withTrip(id, () => POINTS.map(q => ({ ...q }))); }
function tlPlaces(id) { return tlPlaceList(id).map(p => ({ p, c: snapCoord(p), r: tlRadius(p.icon) })).filter(x => x.c); }
// Q3: the travels' confirmed ends that are not trip places ({ lat, lng }, my travels and the group's) - a visit near one is absorbed
function tlTravelEnds(t) { const out = []; travelsOf(t).forEach(f => ['from', 'to'].forEach(side => { const l = f[side + 'Loc'];
  if (l && l.pid == null && isFinite(l.lat) && isFinite(l.lng)) out.push({ c: { lat: +l.lat, lng: +l.lng }, r: tlEndRadius(f.mode) }); })); return out; }
// Q1-Q2 (1), derived: the moments an offer must fall between - the departure of the first travel from home and the landing of the last
// travel home (travelHomeEnds; with arriveDay; no landing time - from its departure); a side with no time gives no cut (null)
function tlTripWindow(t) { const all = travelsOf(t).filter(f => f.date), out = { from: null, to: null }; if (!all.length) return out;
  const home = travelHomeEnds(t), f0 = all[0], L = all[all.length - 1];
  if (home.has(f0.id + '|from') && isHM(f0.depart)) out.from = tmMoment(f0.date, f0.depart, TM_HOME);
  if (home.has(L.id + '|to')) { if (isHM(L.arrive)) out.to = tmMoment(travelLandDate(L), L.arrive, TM_HOME); else if (isHM(L.depart)) out.to = travelStartsAt(L, t); }
  return out; }
// read a parsed file against a trip: only its days; the matches, the places not on the list, each day's path and walking km
function tlRead(id, F) {
  const t = STATE.trips[id]; if (!t || !t.start) return { err: 'לטיול בלי תאריכים אין ימים לקרוא מציר הזמן' };
  const days = new Set(tlDates(t)), inT = d => days.has(d), PL = tlPlaces(id), ENDS = tlTravelEnds(t), W = tlTripWindow(t), abroad = tripAbroad(t);
  const visits = F.visits.filter(v => inT(v.a.d)), moves = F.moves.filter(m => inT(m.a.d)), pts = F.pts.filter(q => inT(q.d));
  if (!visits.length && !moves.length && !pts.length) return { err: `אין בקובץ ימים מהטיול (${tmFmt('range', [t.start, t.end], { year: true })}). כדאי לבדוק שציר הזמן היה דלוק בטיול` };
  const matched = {}, extras = [], priv = tlPrivate(F, inT); // legal-server (Q11)
  // 11.22.0 (place-gid-1; decisions 2026-11-16 · A Google place id, Q6): (1) a visit whose id is a trip place's is matched to it up to
  // TL_GID_KM; (2) else by distance only among places without an id - never a place with another id; (3) removed in gid-fixes
  // (decisions 2026-11-18 · Review of the 11.22.0 summary, Q1): a place matched by distance never takes the visit's id;
  // (5) a visit without an id: by distance among all, as before
  visits.forEach(v => { const m = Math.max(0, Math.round((v.b.ms - v.a.ms) / 6e4)); let best = null, bd = Infinity;
    const byId = v.gid && v.gid.cid ? PL.filter(x => gidSame(gidOf(x.p), v.gid)).map(x => ({ x, d: distanceKm(v.ll, x.c) })).filter(o => o.d <= TL_GID_KM).sort((a, b) => a.d - b.d)[0] : null;
    if (byId) best = byId.x;
    else { const cand = v.gid ? PL.filter(x => !gidOf(x.p)).concat(ENDS) : PL.concat(ENDS);
      cand.forEach(x => { const d = distanceKm(v.ll, x.c); if (d <= x.r && d < bd) { bd = d; best = x; } }); }
    if (best && !best.p) return; // a travel's end that is not a place: not offered, nothing marked
    if (best) { const k = best.p.id, cur = matched[k]; if (!cur) matched[k] = { d: v.a.d, s: v.a.hm, m }; else cur.m += m; return; }
    if (m < TL_EXTRA_MIN || TL_HOME.test(v.type)) return;
    if ((W.from != null && v.b.ms < W.from) || (W.to != null && v.a.ms > W.to)) return; // the time rule: offers only - before leaving home, after landing back
    if (abroad && inIsrael(v.ll)) return; // the place rule: on a trip abroad an offer in Israel never (a country only; a trip in Israel filters nothing)
    const near = extras.find(e => distanceKm(e.ll, v.ll) < 0.1 && (!e.gid || !v.gid || gidSame(e.gid, v.gid))); if (near) { near.m += m; if (!near.gid && v.gid) near.gid = v.gid; return; }
    extras.push({ k: 'x' + extras.length, ll: { lat: +v.ll.lat.toFixed(6), lng: +v.ll.lng.toFixed(6) }, d: v.a.d, s: v.a.hm, m, ...(v.gid ? { gid: v.gid } : {}), ...(priv(v.ll) ? { quiet: 1 } : {}) }); }); // quiet: near home / work or a frequent place - never sent for a name
  // tl-paths (Q1-Q2): each day's segments, cleaned at the source (tlDaySegs); walking km and (ride-km, Q1) the rides' km by kind, per day
  // ride-no-home (decisions 2026-11-20 · "ק״מ בנסיעות", Q5): a move on the way from home or back is not a ride of the trip (tlHomeMoves)
  const mvKm = m => m.km != null ? m.km : m.s && m.e ? distanceKm(m.s, m.e) : 0, walk = {}, ride = {}, dset = new Set(), homeMv = tlHomeMoves(F, moves, t, inT);
  moves.forEach(m => { const km = mvKm(m); if (m.walk) walk[m.a.d] = (walk[m.a.d] || 0) + km; else if (km > 0 && !homeMv.has(m)) { const r = (ride[m.a.d] = ride[m.a.d] || {}); r[m.kind] = (r[m.kind] || 0) + km; } });
  visits.forEach(v => { dset.add(v.a.d); }); moves.forEach(m => dset.add(m.a.d)); pts.forEach(q => dset.add(q.d)); Object.keys(walk).forEach(d => dset.add(d));
  const out = {}, r1 = x => Math.round(x * 10) / 10, stats = tlCleanStats();
  [...dset].filter(inT).sort().forEach(d => { const r = {}; Object.keys(ride[d] || {}).forEach(k => { const v = r1(ride[d][k]); if (v > 0) r[k] = v; });
    out[d] = { s: tlDaySegs(visits.filter(v => v.a.d === d), moves.filter(m => m.a.d === d), pts.filter(q => q.d === d), stats), km: r1(walk[d] || 0), r }; });
  tlSimplifyDays(out); Object.assign(TL_CLEAN_LAST, stats);
  return { days: out, matched, extras: extras.sort((a, b) => (a.d + a.s).localeCompare(b.d + b.s)), n: Object.keys(out).length };
}
// ride-no-home (decisions 2026-11-20 · "ק״מ בנסיעות", Q5): the moves on the way out from home to the trip and back - their rides are not
// counted in "ק״מ בנסיעות" (the picture's "ק״מ" counts them already). Home is the move's end: on a trip abroad any end in Israel (the taxi to
// the airport, the flight from it - inIsrael, as the offers' place rule); on a trip in Israel an end within TL_PRIV_KM of the home the file
// marks (semanticType HOME, on a day outside the trip - a hotel Google took for home during the trip is not home). A connection on the way
// (a stop-over abroad) belongs to the home leg, as the travels' chains (travelHomeEnds): a flight leaving on the day a home flight lands
// out, and a flight landing on the day a home flight leaves back. -> Set of moves
function tlHomeMoves(F, moves, t, inT) { const abroad = tripAbroad(t), out = new Set(), fl = m => !m.walk && m.kind === 'flight';
  const homes = abroad ? [] : F.visits.filter(v => TL_HOME.test(v.type) && !/work/i.test(v.type) && !inT(v.a.d)).map(v => v.ll);
  const atHome = c => !!c && (abroad ? inIsrael(c) : homes.some(h => distanceKm(h, c) <= TL_PRIV_KM));
  const rides = moves.filter(m => !m.walk).sort((a, b) => a.a.ms - b.a.ms);
  rides.forEach(m => { if (atHome(m.s) || atHome(m.e)) out.add(m); });
  const chain = (C, link) => { let more = true; while (more) { more = false; rides.forEach((m, i) => { if (C.has(m) || !fl(m)) return;
    if (rides.some((h, j) => C.has(h) && link(h, m, j, i))) { C.add(m); out.add(m); more = true; } }); } };
  chain(new Set(rides.filter(m => fl(m) && atHome(m.s))), (h, m, j, i) => j < i && m.a.d === h.b.d); // out: a flight leaving the day the one before it landed
  chain(new Set(rides.filter(m => fl(m) && atHome(m.e))), (h, m, j, i) => j > i && m.b.d === h.a.d); // back: a flight landing the day the one after it leaves
  return out; }
// legal-server (Q11): (ll) -> true when a point is near home / work or at a frequent place (the whole file read once, on the phone; nothing kept)
function tlPrivate(F, inTrip) {
  const G = 0.002, cell = ll => Math.floor(ll.lat / G) + ':' + Math.floor(ll.lng / G), homes = [], grid = new Map();
  F.visits.forEach(v => { if (TL_HOME.test(v.type)) { if (!homes.some(h => distanceKm(h, v.ll) < 0.05)) homes.push(v.ll); return; }
    if (inTrip(v.a.d)) return; const k = cell(v.ll); (grid.get(k) || grid.set(k, []).get(k)).push(v); });
  const freq = ll => { const days = new Set(), y = Math.floor(ll.lat / G), x = Math.floor(ll.lng / G);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) (grid.get((y + dy) + ':' + (x + dx)) || []).forEach(v => { if (distanceKm(v.ll, ll) <= TL_NEAR) days.add(v.a.d); });
    return days.size >= TL_FREQ_DAYS; };
  return ll => homes.some(h => distanceKm(h, ll) <= TL_PRIV_KM) || freq(ll);
}
function tlDates(t) { return dayList(t.start, t.end).map(x => x.date || x); }
function tlKm(id) { const tl = tlOf(id); return tl ? Math.round(Object.values(tl.days || {}).reduce((s, x) => s + (x.km || 0), 0) * 10) / 10 : 0; }
// ride-km (Q1): the rides' km from the Timeline, by kind - only the days imported with kinds (s); { by: { kind: km }, days: Set }
// ride-no-home (Q5): an import from ride-no-home on (tl.rh) left the way from home and back out of r already (tlHomeMoves); a day imported
// before kept it - there, on the days of a travel from home or back (travelHomeEnds), that travel's kind is left out (tlHomeKinds)
function tlRideKm(id, t) { const tl = tlOf(id), by = {}, days = new Set(); if (!tl) return { by, days };
  const drop = tl.rh ? null : tlHomeKinds(t || STATE.trips[id]);
  Object.keys(tl.days || {}).forEach(d => { const x = tl.days[d] || {}; if (!Array.isArray(x.s)) return; days.add(d);
    Object.keys(x.r || {}).forEach(k => { if (!drop || !drop.has(d + '|' + k)) by[k] = (by[k] || 0) + (+x.r[k] || 0); }); });
  return { by, days }; }
// the travels from home and back (an end at home - travelHomeEnds, with their connections): 'date|kind' of the days they leave and land
function tlHomeKinds(t) { const out = new Set(); if (!t) return out; const home = travelHomeEnds(t);
  travelsOf(t).forEach(f => { if (!f.date || !(home.has(f.id + '|from') || home.has(f.id + '|to'))) return; const k = rideKind(f.mode);
    [f.date, travelLandDate(f) || f.date].forEach(d => out.add(d + '|' + k)); });
  return out; }
// the kept visits follow "היינו": a place marked keeps its time and length, any other loses them (Q4); TL_REVIEW keeps them for the review
// td: the record already in hand (a second tdOf would stash the active trip over it)
function tlSyncVisits(id, td) { td = td || tdOf(id); if (!td.tl) return; const vs = new Set(td.visited || []), all = { ...(td.tl.v || {}), ...((TL_REVIEW && TL_REVIEW.id === id && TL_REVIEW.matched) || {}) }, v = {};
  Object.keys(all).forEach(k => { if (vs.has(Number(k))) v[k] = all[k]; }); td.tl = { ...td.tl, v }; }
// an import: the file read and forgotten; the matched places marked "היינו" unless already marked either way (re-import keeps them)
function tlImport(id, text) {
  const F = tlParse(text); if (F.err) return F; const R = tlRead(id, F); if (R.err) return R;
  const td = tdOf(id), vs = new Set(td.visited || []), nr = new Set(td.notReached || []), had = !!td.tl;
  const fresh = Object.keys(R.matched).map(Number).filter(k => !vs.has(k) && !nr.has(k));
  td.visited = [...(td.visited || []), ...fresh];
  const no = (td.tl && td.tl.no) || []; // closing-where (Q4): offers dismissed with "לא הגענו" stay dismissed - a re-import does not offer them again
  td.tl = { at: Date.now(), n: R.n, days: R.days, v: {}, rh: 1, ...(no.length ? { no } : {}) }; // rh (ride-no-home): r holds the trip's own rides only
  TL_REVIEW = { id, at: Date.now(), matched: R.matched, extras: R.extras.filter(e => !tlNoHas(no, e)), added: [], pidOf: {}, at0: {}, marked: fresh, asking: new Set() };
  tlSyncVisits(id, td); tdSave(id);
  return { ok: true, had, n: R.n, matched: Object.keys(R.matched).length, fresh: fresh.length, extras: R.extras.length, km: tlKm(id) };
}
// the file chooser of the closing step and of the memory screen's ⋮ row: read, import, a snackbar with undo, the review
act('tl.file', async c => { const f = c.el.files && c.el.files[0], id = c.v; c.el.value = ''; if (!f || !STATE.trips[id]) return 'quiet';
  if (f.size > TL_FILE_MAX) { showToast('הקובץ גדול מדי לקריאה בטלפון'); return 'quiet'; }
  const reading = await fmReading(c.el); // P12: the line shows before the read and the parse (seconds for a real export)
  let text; try { text = await f.text(); } catch (e) { reading(); showToast('הקובץ לא נקרא: ' + e.message); return 'quiet'; }
  let r; try { r = tlImport(id, text); } finally { reading(); } text = null;
  if (r.err) { showToast(r.err); return 'quiet'; }
  showUndoToast(`${r.had ? 'יובא מחדש' : 'יובא'} מציר הזמן: ${r.n} ימים${SEP}${r.matched} מקומות זוהו`);
  if (CLOSING && CLOSING.id === id) { CLOSING.key = 'where'; CLOSING.whereIds = null; CLOSING.whereView = null; CLOSING.tlV = null; redrawSoon(); appScroll(0); } // an async action: drawn again as the file door does
  else openTlReview(id); });
// closing-where (Q4, fixes G40): an offer is "added" exactly while its place is in the trip - an undo of "היינו" brings the offer back,
// a redo (or an undo of clearing it) marks it again
undoAfter(() => { if (TL_REVIEW && !tlOf(TL_REVIEW.id)) TL_REVIEW = null; const R = TL_REVIEW; if (!R) return; const t = STATE.trips[R.id]; if (!t) return;
  const has = new Set((t.places || []).map(q => q.id)), m = { ...R.matched };
  R.added = Object.keys(R.pidOf || {}).filter(k => has.has(R.pidOf[k])); Object.keys(R.pidOf || {}).forEach(k => { const pid = R.pidOf[k]; if (has.has(pid)) m[pid] = R.at0[pid]; else delete m[pid]; }); R.matched = m; });
// the dismissed offers (Q4): their day and point in the trip's Timeline record (tl.no; a friend's trip file leaves tl out); the same offer is
// the same day within 100 m (a re-import's offer starts at the same visit)
function tlNoHas(no, e) { return (no || []).some(x => x.d === e.d && distanceKm(x.ll, e.ll) < 0.1); }
function tlNoSet(td, e, on) { const no = (td.tl.no || []).filter(x => !(x.d === e.d && distanceKm(x.ll, e.ll) < 0.1)); td.tl = { ...td.tl, no: on ? no.concat({ d: e.d, ll: { lat: e.ll.lat, lng: e.ll.lng } }) : no }; if (!td.tl.no.length) delete td.tl.no; }
// the review (Q1, picture "איפה היינו"): the summary card, the rows by day, the places not on the list - in the closing step and in a window
function tlSummaryHTML(id) {
  const tl = tlOf(id); if (!tl) return ''; const R = TL_REVIEW && TL_REVIEW.id === id ? TL_REVIEW : null, nM = R ? Object.keys(R.matched).length : Object.keys(tl.v || {}).length, nX = R ? R.extras.length - R.added.length : 0, paths = tlPaths(id).length, km = tlKm(id);
  const chip = (ic, t) => `<span class="gl-fact">${msi(ic, { size: 16 })}<span>${t}</span></span>`;
  return `<div class="gl-sum card"><div class="gl-sum-h">${msi('timeline', { size: 20 })}<b>מציר הזמן של גוגל${SEP}${tl.n} ימים</b></div>
    <div class="gl-facts">${chip('check_circle', `${nM} מקומות זוהו`)}${nX ? chip('add_location_alt', `${nX} שלא היו ברשימה`) : ''}${paths ? chip('route', 'מסלול לכל יום') : ''}${km ? chip('directions_walk', `${fmtKm(km)} ברגל`) : ''}</div>
    <small class="gl-sum-l">${msi('info', { size: 16, cls: 'msi-in' })} מה שזוהה כבר מסומן "${TX.visited}"${SEP}אפשר לשנות כל שורה</small>${tlAgainHTML(id)}</div>`;
}
// tl-paths (Q5): a trip imported before keeps one line a day with no kinds - a quiet line offers the re-import (the import window's door)
function tlAgainHTML(id) { return tlOldDays(id) && !tlCancelled(STATE.trips[id]) ? `<small class="gl-sum-l gl-again">${msi('update', { size: 16, cls: 'msi-in' })} <span>${tipText('tl.again')}</span> <button type="button" class="link-btn" id="tlAgain" data-act="tl.again" data-v="${escH(id)}">ייבוא מחדש</button></small>` : ''; }
act('tl.again', c => { openTlImport(c.v); return 'quiet'; });
// Q2 (decisions 2026-11-13): a name for each offered place - a reverse lookup by its coordinate through the one services client
// (service placeName: Nominatim, Photon when it is busy; their queue, rates and network waiting). Only the offers' coordinates
// leave the phone - never the file, the path or the matched visits. The answers live for the session (the offers are not kept);
// until one comes, and with no network, the offer shows as before and "להוסיף" uses the date and hour.
const TL_NAMES = {}; // 'lat,lng' (4 places, ~10 m) -> the name, or '' when the service found none
function tlNameKey(e) { return e.ll.lat.toFixed(4) + ',' + e.ll.lng.toFixed(4); }
function tlNameOf(e) { return TL_NAMES[tlNameKey(e)] || ''; }
function tlNamesAsk(R) { if (!R || !R.extras) return; R.asking = R.asking || new Set();
  R.extras.forEach(e => { const k = tlNameKey(e); if (e.quiet || k in TL_NAMES || R.asking.has(k) || R.added.includes(e.k)) return; R.asking.add(k); // legal-server (Q11): a quiet offer is never sent
    svcAsk('placeName', { key: k, build: prov => prov === 'nominatim' ? { url: `https://nominatim.openstreetmap.org/reverse?format=json&zoom=18&lat=${e.ll.lat}&lon=${e.ll.lng}`, init: { headers: { 'Accept-Language': 'he,en' } } }
        : { url: `https://photon.komoot.io/reverse?limit=1&lang=en&lat=${e.ll.lat}&lon=${e.ll.lng}` }, // B4: Photon has no Hebrew - English where it has it, the local name otherwise
      parse: (d, prov) => { if (!d || typeof d !== 'object') throw new Error('answer'); let nm = '', near = '';
        if (prov === 'nominatim') { if (d.error) return SVC_EMPTY; const a = d.address || {}; nm = d.name || a.tourism || a.amenity || a.leisure || a.historic || a.attraction || a.building || ''; near = a.road || a.pedestrian || a.footway || a.square || a.neighbourhood || a.quarter || a.suburb || ''; }
        else { if (!Array.isArray(d.features)) throw new Error('answer'); const f = d.features[0]; if (!f) return SVC_EMPTY; const pp = f.properties || {}; nm = pp.name || ''; near = pp.street || pp.district || pp.locality || ''; }
        const cl = x => String(x).replace(/\s+/g, ' ').trim().slice(0, 80); nm = cl(nm); near = cl(near);
        return nm || (near ? 'ליד ' + near : SVC_EMPTY); } }) // B4: no place name but a street or a neighbourhood - "ליד <it>"; the date placeholder only when there is not even that
    .then(r => { R.asking.delete(k); const got = r.kind === 'ok' || r.kind === 'empty'; if (got) TL_NAMES[k] = r.kind === 'ok' ? r.value : ''; // offline / busy / error: asked again on the next draw
      if (!got) R.hold = true; // wait-look: the draw that ends a wait with a failure does not ask again at once (the next one does)
      if ((r.kind === 'ok' || !R.asking.size) && TL_REVIEW === R && tlCtxId() === R.id) redrawSoon(); }); }); }
// wait-look (decisions 2026-11-23 · One "in progress" look, Q2): while names are asked, the group of the places not on the list waits with
// the one "in progress" component, measured (state 3): the bar under its head fills with the names answered, the line "12 מתוך 40"
function tlNamesWaitHTML(R) { if (!R || !R.asking || !R.asking.size) return ''; const ex = R.extras.filter(e => !e.quiet && !R.added.includes(e.k)), n = { done: ex.filter(e => tlNameKey(e) in TL_NAMES).length, total: ex.length };
  return waitBarHTML('מחפשים שמות למקומות', n) + waitLineHTML('מחפשים שמות למקומות', n); }
function tlTagHTML(x, day) { return `<span class="gl-tag">${msi('schedule', { size: 14 })}${day ? `${day}${SEP}` : ''}<bdi>${x.s}</bdi>${SEP}${tmFmt('dur', Math.max(1, x.m))}</span>`; } // day: an offer's own day (11.14.0, P14) - a found row has it in its day's head
// 11.14.0 (phone-round-1-fixes P14, G16): an offer says its day as the found rows' day head does - "יום N · <date>" (only the date for a day outside the trip's dates)
function tlDayTx(dl, d) { const i = (dl || []).indexOf(d); return (i >= 0 ? `יום ${i + 1}${SEP}` : '') + tmFmt('date', d); }
function tlVisRowHTML(id, p, x) { const td = tdOf(id), on = (td.visited || []).includes(p.id), no = (td.notReached || []).includes(p.id);
  return `<div class="cl-row gl-row g-swipe" data-ref="place:${p.id}"><span class="gl-rn"><span class="gl-nm">${typeIcon(p.icon, { size: 18, cls: 'msi-in' })} <b>${escH(p.name)}</b></span>${x ? tlTagHTML(x) : `<small class="gl-miss">לא זוהה בציר הזמן</small>`}</span>${fmMark({ act: 'tl.vis', on, no })}</div>`; }
// the rows: every place the Timeline found, by day and hour; then the planned places it did not find (closing's "where" rows, the
// window's - one review in both doors, C5); then the places not on the list, with the name the names service gave (Q2).
// closing-where (Q3): V is the door's view, kept by it (CLOSING.tlV, TL_WIN_V) - "עוד לא סומנו" | "הכל"; the rows of "עוד לא סומנו" are fixed when
// the view is drawn first, so a row marked there stays in place (V.keep); V.add: places chosen from "＋ עוד מקום שהיינו בו" (Q6), each a marked row.
// The offers (Q4) are rows with the same mark; an offer marked "היינו" stays in its group (its place is not drawn again in the days).
// round6-behaviour (G115): the groups too are fixed when the view is drawn first (V.lay - each row's group, its day and hour), under both views:
// a mark set, changed or cleared never moves its row to another group (a "לא הגענו" leaves the day's match, tlSyncVisits) or out of "הכל"
function tlReviewHTML(id, V) {
  const tl = tlOf(id); if (!tl) return ''; V = V || {}; const R = TL_REVIEW && TL_REVIEW.id === id ? TL_REVIEW : null, pm = new Map(tlPlaceList(id).map(q => [q.id, q]));
  const offerPids = new Set(R ? Object.values(R.pidOf || {}) : []), t = STATE.trips[id], td = tdOf(id), dl = tlDates(t);
  const vs = new Set(td.visited || []), ns = new Set(td.notReached || []), marked = k => vs.has(k) || ns.has(k);
  if (!V.lay) { const M0 = R ? R.matched : (tl.v || {}), ids0 = Object.keys(M0).map(Number).filter(k => pm.has(k) && !offerPids.has(k)).sort((a, b) => (M0[a].d + M0[a].s).localeCompare(M0[b].d + M0[b].s)), inM0 = new Set(ids0);
    const pl0 = [...tripPlannedIds(id, t, td)].filter(k => pm.has(k) && !inM0.has(k) && !offerPids.has(k)), inP0 = new Set(pl0);
    V.lay = { m: Object.fromEntries(ids0.map(k => [k, M0[k]])), ids: ids0, planned: pl0, others: [...new Set([...vs, ...ns])].filter(k => pm.has(k) && !inM0.has(k) && !inP0.has(k) && !offerPids.has(k)) }; } // "הכל": every place marked either way (Q3)
  const LY = V.lay, M = LY.m, ids = LY.ids.filter(k => pm.has(k) && !offerPids.has(k)), inM = new Set(ids), planned = LY.planned.filter(k => pm.has(k) && !offerPids.has(k)), inP = new Set(planned);
  const others = [...new Set([...LY.others, ...(V.add || [])])].filter(k => pm.has(k) && !inM.has(k) && !inP.has(k) && !offerPids.has(k));
  const all = [...ids, ...planned, ...others], nUn = all.filter(k => !marked(k)).length;
  if (!V.view) V.view = nUn ? 'un' : 'all'; if (!V.keep) V.keep = all.filter(k => !marked(k));
  const keep = new Set([...V.keep, ...(V.add || [])]), sh = k => V.view === 'all' || keep.has(k), byDay = {};
  ids.filter(sh).forEach(k => (byDay[M[k].d] = byDay[M[k].d] || []).push(k));
  let h = fmMarkView({ act: 'tl.view', view: V.view, nUn, nAll: all.length });
  h += Object.keys(byDay).sort().map(d => `<div class="gl-day"><div class="gl-dh">${msi('calendar_today', { size: 16 })} יום ${dl.indexOf(d) + 1}${SEP}${tmFmt('date', d)}</div><div class="cl-list">${byDay[d].map(k => tlVisRowHTML(id, pm.get(k), M[k])).join('')}</div></div>`).join('');
  const miss = planned.filter(sh), more = others.filter(sh);
  if (miss.length) h += `<div class="gl-day"><div class="gl-dh">${msi('help', { size: 16 })} תוכנן ולא זוהה</div><div class="cl-list">${miss.map(k => tlVisRowHTML(id, pm.get(k), null)).join('')}</div></div>`;
  if (more.length) h += `<div class="gl-day"><div class="gl-dh">${msi('add_location', { size: 16 })} עוד מקומות שסומנו</div><div class="cl-list">${more.map(k => tlVisRowHTML(id, pm.get(k), null)).join('')}</div></div>`;
  if (!all.length && !(R && R.extras.length)) h += `<div class="callout">אין מקומות לסמן.</div>`;
  else if (V.view === 'un' && !ids.some(sh) && !miss.length && !more.length) h += `<div class="callout">${nUn ? '' : '✓ '}${nUn ? 'אין כאן מקומות שעוד לא סומנו.' : 'הכל סומן.'} ב"הכל" אפשר לתקן.</div>`;
  const ex = R ? R.extras : []; if (ex.some(e => !R.added.includes(e.k))) { if (R.hold) R.hold = false; else tlNamesAsk(R); }
  if (ex.length) h += `<div class="gl-day gl-extra"><div class="gl-dh">${msi('add_location_alt', { size: 16 })} ${TX.visited} גם כאן${SEP}לא היה ברשימה</div>${tlNamesWaitHTML(R)}<div class="cl-list">${ex.map(e => `<div class="cl-row gl-row g-swipe" data-tlx="${e.k}"><span class="gl-rn"><b>${tlNameOf(e) ? escH(tlNameOf(e)) : 'מקום בלי שם'}</b>${tlTagHTML(e, tlDayTx(dl, e.d))}<small class="gl-ll" dir="ltr">${e.ll.lat.toFixed(4)}, ${e.ll.lng.toFixed(4)}</small>${e.quiet ? '<small class="gl-ll">ליד הבית או מקום קבוע - השם לא נשלח לחיפוש</small>' : ''}</span>${fmMark({ acts: ['tl.no', 'tl.add'], v: e.k, on: R.added.includes(e.k), no: tlNoHas((tl || {}).no, e) })}</div>`).join('')}</div></div>`;
  return h;
}
act('tl.view', c => { const id = tlCtxId(); if (!id) return 'quiet'; const V = { view: c.v }; if (CLOSING && activeTab === 'closing' && CLOSING.id === id) CLOSING.tlV = V; else TL_WIN_V = V; return 'redraw'; });
function tlMark(id, pid, v, off) { const td = tdOf(id);
  td.visited = (td.visited || []).filter(x => x !== pid); td.notReached = (td.notReached || []).filter(x => x !== pid);
  if (!off) { if (v) td.visited = [...td.visited, pid]; else td.notReached = [...td.notReached, pid]; } tlSyncVisits(id, td); tdSave(id); }
act('tl.vis', c => { const id = tlCtxId(); if (!id) return 'quiet'; const pid = Number(refOf(c.el).id), v = c.el.dataset.clvis === '1', off = c.el.getAttribute('aria-pressed') === 'true';
  tlMark(id, pid, v, off); showUndoToast(`${off ? 'בוטל' : v ? TX.visited : 'לא הגענו'}: ${(tlPlaceList(id).find(q => q.id === pid) || {}).name || ''}`); });
// closing-where (Q4): an offer's "✓ היינו" (was "להוסיף") - the place joins the trip (this trip only, in its destination of that day), marked
// "היינו" with its time and Google's id; the row stays, marked. A second tap takes the place out of the trip and the row is an offer again;
// "לא הגענו" dismisses it (kept in tl.no, not offered again by a re-import); one action each, one undo row
function tlOfferOf(c) { const id = tlCtxId(), R = TL_REVIEW; if (!id || !R || R.id !== id) return null; const e = R.extras.find(x => x.k === c.v); return e ? { id, R, e } : null; }
function tlOfferOut(id, R, e) { const pid = R.pidOf[e.k], t = STATE.trips[id]; if (pid == null) return '';
  const nm = ((t.places || []).find(q => q.id === pid) || {}).name || '';
  t.places = (t.places || []).filter(q => q.id !== pid); if (t.archived && t.archived.snap) t.archived.snap.places = (t.archived.snap.places || []).filter(q => q.id !== pid);
  R.added = R.added.filter(k => k !== e.k); const m = { ...R.matched }; delete m[pid]; R.matched = m;
  persist(); if (id === STATE.activeTrip) applyActiveTrip();
  const td = tdOf(id); td.visited = (td.visited || []).filter(x => x !== pid); td.notReached = (td.notReached || []).filter(x => x !== pid); if (td.rating && td.rating[pid]) { td.rating = { ...td.rating }; delete td.rating[pid]; }
  tlSyncVisits(id, td); return nm; }
// a place that joins the trip from outside its lists (an offer, or the search of "＋ עוד מקום שהיינו בו"): this trip only, in the destination of
// its day (an offer) or the nearest of the trip's destinations; a closed trip shows its snapshot. Returns the new id, or null with no destination
function tlTripPlace(id, o) { const t = STATE.trips[id], seg = o.d ? (t.segments || []).find(s => s.from <= o.d && o.d <= s.to) : null, near = !o.d && o.ll ? psDestNear([o.ll.lat, o.ll.lng], tripDests(t)) : null;
  const d = DESTS[seg && seg.dest] || near || DESTS[tripDests(t)[0]]; if (!d) return null;
  const ly = (d.meta.layers || []).find(l => l.type === 'attractions') || (d.meta.layers || []).find(l => l.type !== 'lodging') || (d.meta.layers || [])[0], pid = Date.now();
  const np = { id: pid, dest: d.id, layer: ly ? ly.id : 1, name: o.name, address: '', manualCoord: { lat: o.ll.lat, lng: o.ll.lng }, icon: 'location', description: '', ...(o.tl ? { fromTimeline: true } : {}), ...(o.gid ? { gid: o.gid } : {}) };
  if (o.quiet) np.quiet = true; // legal-server-fixes (Q1): an offer near home - never sent for a name, an address or a Google id, also once named by hand
  t.places = (t.places || []).concat(np); if (t.archived && t.archived.snap) t.archived.snap.places = (t.archived.snap.places || []).concat({ ...np, layer: (d.idBase || 0) + np.layer, tripOnly: true }); // a closed trip shows its snapshot
  persist(); if (id === STATE.activeTrip) applyActiveTrip(); // the place exists first - loading the trip's marks drops ids it does not know
  return pid; }
act('tl.add', c => { const O = tlOfferOf(c); if (!O) return 'quiet'; const { id, R, e } = O;
  if (R.added.includes(e.k)) { const nm = tlOfferOut(id, R, e); tdSave(id); showUndoToast(`בוטל: ${nm}${SEP}יצא מהטיול`); return; }
  const name = tlNameOf(e) || `מקום בלי שם · ${tmFmt('date', e.d)} ${e.s}`; // a stored place name - data, plain " · " (t1132 SEP_OK); Q2: the name the names service gave, else the row's words with the date and hour (11.17.0, review of 11.16.0 Q2)
  const pid = tlTripPlace(id, { name, ll: e.ll, d: e.d, tl: true, quiet: !!e.quiet, gid: e.gid ? gidNew(e.gid, 'timeline') : null }); if (pid == null) { showToast('אין יעד לטיול'); return 'quiet'; } // 11.22.0 (Q6 (4)): with its id
  R.pidOf = { ...R.pidOf, [e.k]: pid }; R.at0 = { ...R.at0, [pid]: { d: e.d, s: e.s, m: e.m } }; R.added = R.added.concat(e.k); R.matched = { ...R.matched, [pid]: R.at0[pid] };
  const td = tdOf(id); td.visited = [...(td.visited || []), pid]; tlNoSet(td, e, false); tlSyncVisits(id, td); tdSave(id);
  showUndoToast('נוסף לטיול ו' + TX.visited + ': ' + name); });
act('tl.no', c => { const O = tlOfferOf(c); if (!O) return 'quiet'; const { id, R, e } = O, off = c.el.getAttribute('aria-pressed') === 'true', nm = tlNameOf(e) || 'מקום בלי שם';
  if (R.added.includes(e.k)) tlOfferOut(id, R, e); const td = tdOf(id); if (!td.tl) return 'quiet'; tlNoSet(td, e, !off); tdSave(id);
  showUndoToast(off ? `בוטל: ${nm}` : `לא הגענו: ${nm}${SEP}לא יוצע שוב`); });
function tlCtxId() { return CLOSING && activeTab === 'closing' ? CLOSING.id : TL_WIN || null; }
let TL_WIN = null, TL_WIN_V = null; // the window's trip, and its view (closing-where Q3: "עוד לא סומנו" | "הכל", its rows fixed when drawn first, so a marked row stays with its state)
// the review in a window - the memory screen's ⋮ row "ייבוא מציר הזמן של גוגל" (a closed trip; also Budapest's real path)
function openTlReview(id, redraw) { layerNote(openTlReview, arguments); const top = layerTop(); redraw = redraw || !!(top && top.key === 'openTlReview' && TL_WIN === id); // its own draw (winRedraw) passes only the id
  if (!redraw || !TL_WIN_V) TL_WIN_V = {}; TL_WIN = id; const sheet = document.getElementById('sheet'), sc = redraw ? (sheet.querySelector('.sheet-body') || sheet).scrollTop : 0;
  sheet.innerHTML = `${fmHead(`${msi('timeline', { size: 20 })} איפה ${TX.visited}${SEP}ציר הזמן`)}<div class="sheet-body gl-win">${tlSummaryHTML(id)}${tlReviewHTML(id, TL_WIN_V)}${whereMoreRowHTML()}</div>
    <div class="brow export-actions sheet-save-bar"><button type="button" class="btn-nav" id="tlDone" data-act="tl.done">סיום</button></div>`; // 11.10.0: "סיום" closes, it saves nothing - not the save bar's #fmSave, or a marked row would make the window "unsaved" and stop it from drawing again
  if (!redraw) showSheetBackdrop('openTlReview'); else { const b = sheet.querySelector('.sheet-body'); if (b) b.scrollTop = sc; }
}
act('tl.done', () => { TL_WIN = null; TL_WIN_V = null; closeSheet(); });
// the door on the memory screen's ⋮ and the closing step: a chooser with the file input, "איך מייצאים", the privacy line
function tlDoorHTML(id, main) { return fmFile({ label: `${msi('file_open', { size: 18 })} ${tlOf(id) && !main ? 'בחירת קובץ חדש' : 'בחירת הקובץ'}`, cls: main ? 'btn-nav' : 'icon-btn btn-copy', act: 'tl.file', v: id, accept: '.json,.csv,application/json,text/csv' }); }
// the step's and the window's doors: the file chooser, "איך מייצאים" and the privacy line - or, for a trip without dates (C8), the line
// and a button that opens choosing the trip's dates (tl.dates); once they are set the same doors come back
function tlDoorsHTML(id) { const t = STATE.trips[id];
  if (!t || !t.start) return `<div class="callout">${msi('calendar_month', { size: 18, cls: 'msi-in' })} כדי לייבא מציר הזמן צריך תאריכים לטיול</div>
    <div class="brow export-actions"><button type="button" class="btn-nav" data-act="tl.dates" data-v="${escH(id)}">${msi('edit_calendar', { size: 18 })} בחירת התאריכים</button></div>`;
  return `<div class="brow export-actions">${tlDoorHTML(id, true)}<button type="button" class="link-btn" data-act="tl.how">איך מייצאים</button></div>
    <p class="sh-hint">${msi('lock', { size: 16, cls: 'msi-in' })} ${tipText('tl.privacy')}</p>`; }
function openTlImport(id, redraw) { if (tlCancelled(STATE.trips[id])) return; layerNote(openTlImport, arguments); const sheet = document.getElementById('sheet'), had = !!tlOf(id);
  sheet.innerHTML = `${fmHead(`${msi('timeline', { size: 20 })} ${had ? 'ייבוא מחדש מציר הזמן' : 'ייבוא מציר הזמן של גוגל'}`)}
    <p class="sh-p">${had ? 'הקובץ קורא שוב את ימי הטיול: המסלול, השעות והק״מ מתעדכנים. מקומות שכבר סימנתם "' + TX.visited + '" או "לא הגענו" לא משתנים.' : 'אם ציר הזמן היה דלוק בטיול, הקובץ ממלא את "איפה ' + TX.visited + '", מציע מקומות שלא היו ברשימה ומצייר את המסלול האמיתי של כל יום.'}</p>
    ${had && tlOldDays(id) ? `<p class="sh-hint">${msi('update', { size: 16, cls: 'msi-in' })} ${tipText('tl.again')}</p>` : ''}${tlDoorsHTML(id)}`;
  if (!redraw) showSheetBackdrop('openTlImport'); }
// The dates window (B5, decisions 2026-11-13 review of 11.10.0): a closed or dateless trip's first and last day, as the trip editor's
// dates. The last day is filled in from the trip's planned days; a changed length follows the trip editor's rule for days - a day
// added goes to the last destination's end (te.plus), a day removed is the last destination's last (te.minus, then the one before
// it), and a removed day with a plan waits in "מחוץ לטיול", asked first with te.minus's question. A last day after today is refused
// with the reason; one undo row. Doors: the memory ⋮ row's import (tlDoorsHTML) and closing a dateless trip that happened (B1,
// opts.close: then the regular closing flow opens).
function openTlDates(id, close) { layerNote(openTlDates, arguments); const t = STATE.trips[id]; if (!t) return; const sheet = document.getElementById('sheet'), F = fmNew({ id, close: !!close }), n = tripLen(t);
  sheet.innerHTML = `${fmHead(`${msi('edit_calendar', { size: 20 })} תאריכי הטיול`)}
    <p class="sh-p">מתי הייתם בטיול? היום האחרון נקבע לפי ${n} הימים שתוכננו. היה קצר או ארוך יותר? משנים אותו.</p>
    <div class="sh-times">${fmDate(F, 'start', { label: 'היום הראשון', req: true, value: '', max: todayStr(), on: v => { v = tlDatesCap(F, 'start', v); if (isIso(v)) teSetDate(F, 'end', tlMinIso(isoAdd(v, n - 1), todayStr())); const el = fmIn(F, 'end'); if (el) el.min = v || ''; } })}${fmDate(F, 'end', { label: 'היום האחרון', req: true, value: '', max: todayStr(), on: v => { tlDatesCap(F, 'end', v); } })}</div>
    ${fmSaveBar({ act: 'tl.datesSave' })}`;
  openSheet('openTlDates'); fmAttach(F); }
// phone-round-2b-fixes P2 (G45): a trip that happened ends today at the latest - the first day's fill stops at today, and a day after
// today picked in either field (a phone's picker that ignores the field's max - the owner's Samsung) is brought back to today with the reason
function tlMinIso(a, b) { return a < b ? a : b; }
function tlDatesCap(F, id, v) { const td = todayStr(); if (!isIso(v) || v <= td) return v;
  teSetDate(F, id, td); showToast(`${tmFmt('date', v)} עוד לא הגיע - טיול שהתקיים נגמר לכל המאוחר היום`); return td; }
act('tl.dates', c => { openTlDates(c.v); return 'quiet'; });
// the new segments' lengths for a trip of len days, by the editor's rule (days added or removed at the end of the last destination)
function tlDatesSegs(t, len) { const segs = segLensOf(t).map(s => ({ ...s })); if (!segs.length) return segs; let d = len - segs.reduce((a, s) => a + s.len, 0);
  if (d > 0) segs[segs.length - 1].len += d;
  for (let k = segs.length - 1; d < 0 && k >= 0; k--) { const take = Math.min(-d, segs[k].len - 1); segs[k].len -= take; d += take; }
  return segs; }
act('tl.datesSave', c => { const F = fmOf(c.el); if (!F) return 'quiet'; const id = F.opts.id, t = STATE.trips[id]; if (!t) return 'quiet'; const start = fmGet(F, 'start'); let end = fmGet(F, 'end');
  if (!isIso(start)) return fmFail(F, 'start', 'חסר תאריך');
  if (!end) { end = isoAdd(start, tripLen(t) - 1); teSetDate(F, 'end', end); } // phone-round-2-fixes P4 (G43): the paragraph's rule also on "שמירה" - an empty last day is the planned days' (a phone whose picker's events did not reach the first day's fill)
  if (!isIso(end)) return fmFail(F, 'end', 'חסר תאריך');
  if (end < start) return fmFail(F, 'end', 'היום האחרון לפני הראשון');
  if (end > todayStr()) return fmFail(F, 'end', `${tmFmt('date', end)} עוד לא הגיע - טיול שהתקיים נגמר לכל המאוחר היום`);
  const len = daysBetween(start, end) + 1, n = tripLen(t), segs = tlDatesSegs(t, len);
  if (len > 60) return fmFail(F, 'end', 'טיול עד 60 יום'); if (segs.reduce((a, s) => a + s.len, 0) !== len) return fmFail(F, 'end', 'לכל יעד צריך להישאר לפחות יום אחד');
  const td = tdOf(id), gone = []; for (let i = len + 1; i <= n; i++) if (dayIds((td.itinerary || {})['d' + i]).length) gone.push(i);
  const go = () => { stashActive();
    if (len === n) rebuildTripDays(t, { mode: 'fixed', start, segs, lead: 0, tail: 0 });
    else { const old = segRanges(t), pos = []; let cur = 1; segs.forEach(s => { pos.push(cur); cur += s.len; });
      rebuildTripDays(t, { mode: 'fixed', start, segs, lead: 0, tail: 0, map: i => { const r = old.find(x => i >= x.a && i <= x.b); if (!r) return null; const k = segs.findIndex(s => s.orig === r.i); if (k < 0) return null; const j = i - r.a; return j < segs[k].len ? pos[k] + j : null; } }); }
    (t.segments || []).forEach((g, k, a) => { if (k) a[k - 1].to = g.from; }); // with dates a transfer day is in both segments (as te.save)
    if (id === STATE.activeTrip) { loadPersonal(id); applyActiveTrip(); } persist(); closeSheet();
    showUndoToast(`נקבעו תאריכים לטיול: ${tmFmt('range', [t.start, t.end], { year: true })}${gone.length ? ` (${gone.length === 1 ? 'יום אחד עבר' : gone.length + ' ימים עברו'} ל"מחוץ לטיול")` : ''}`); // one undo row
    if (F.opts.close) openClosingFlow(id, true); // B1: a dateless trip that happened goes on to the regular closing flow (item 1: with today as its last day too, no "during" question)
    return 'quiet'; };
  return gone.length ? askSure({ ic: 'event_busy', title: gone.length === 1 ? `להוריד את יום ${gone[0]}?` : `להוריד ${gone.length} ימים עם תוכנית?`, text: `${gone.length === 1 ? 'יש בו תוכנית. הוא יעבור' : `ימים ${gone.join(', ')} עם תוכנית. הם יעברו`} ל"מחוץ לטיול" (לא נמחק${gone.length === 1 ? '' : 'ים'}).`, ok: 'הורדה' }, go) : go(); });
act('tl.how', () => openTlHow('export'));
// before the trip (Q3): the sheet behind the "לקראת הטיול" row - and "איך מייצאים" (the same sheet, the export's steps)
let TL_OS = /iphone|ipad/i.test(navigator.userAgent) ? 'ios' : 'android';
const TL_STEPS = { on: { android: ['הגדרות הטלפון ← מיקום ← שירותי מיקום', 'ציר הזמן ← להדליק', 'מחיקה אוטומטית ← לבחור את זמן השמירה הארוך ביותר'], ios: ['גוגל מפות ← התמונה שלכם ← ציר הזמן', 'להדליק את ציר הזמן', 'הגדרות ציר הזמן ← מחיקה אוטומטית ← לבחור את זמן השמירה הארוך ביותר'] },
  export: { android: ['הגדרות הטלפון ← מיקום ← שירותי מיקום ← ציר הזמן', 'ייצוא נתוני ציר הזמן ← שמירה בקבצים', 'כאן: "בחירת הקובץ" ובוחרים אותו'], ios: ['גוגל מפות ← הגדרות ← תוכן אישי', 'ייצוא נתוני ציר הזמן ← שמירה בקבצים', 'כאן: "בחירת הקובץ" ובוחרים אותו'] } };
function openTlHow(kind, redraw) { layerNote(openTlHow, arguments); const sheet = document.getElementById('sheet'), on = kind === 'on', t = activeTripObj();
  sheet.innerHTML = `${fmHead(`${msi('timeline', { size: 20 })} ${on ? 'ציר הזמן של גוגל' : 'איך מייצאים את ציר הזמן'}`)}
    <p class="sh-p">${on ? tipText('tl.why') : tipText('tl.export')}</p>
    ${segHTML('tl.os', [['android', 'אנדרואיד'], ['ios', 'אייפון']], TL_OS)}
    <ol class="gl-steps">${TL_STEPS[on ? 'on' : 'export'][TL_OS].map(s => `<li>${escH(s)}</li>`).join('')}</ol>
    <p class="sh-hint">${msi('info', { size: 16, cls: 'msi-in' })} השמות יכולים להשתנות קצת בין טלפונים</p>
    ${on ? `<p class="sh-hint">${msi('auto_delete', { size: 16, cls: 'msi-in' })} ${tipText('tl.keep')}</p>` : ''}
    <p class="sh-hint">${msi('lock', { size: 16, cls: 'msi-in' })} ההיסטוריה נשמרת אצלך בטלפון, לא אצלנו</p>
    ${on && t.id ? `<div class="brow export-actions sheet-save-bar"><button type="button" class="btn-nav" id="tlOn" data-act="tl.isOn">${msi('check', { size: 18 })} כבר דלוק</button><button type="button" class="link-btn" data-act="tl.never">לא מעניין אותי</button></div>` : ''}`; // A7: a plain footer - the window has no field, so no save bar (whose unsaved-changes guard a tap on the system switch would set)
  if (!redraw) showSheetBackdrop('openTlHow'); }
act('tl.os', c => { TL_OS = c.v; const on = !!document.querySelector('#sheet [data-act="tl.isOn"]'); openTlHow(on ? 'on' : 'export', true); return 'quiet'; });
act('tl.isOn', () => { const t = activeTripObj(); if (!t.id) return; const td = tdOf(t.id); td.tlOn = 1; tdSave(t.id); closeSheet(); showUndoToast('מעולה. ציר הזמן ימלא את סגירת הטיול'); });
act('tl.never', () => { closeSheet(); hintMark('tl.never'); showToast('לא נזכיר. אפשר להחזיר בהגדרות'); return 'redraw'; }); // a device hint: no data changed, so the draw is asked for
act('tl.remind', () => openTlHow('on'));

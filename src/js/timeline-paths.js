// ================= tl-paths (11.48.0): THE TIMELINE'S DAY PATHS - cleaned at the import, read by every drawer =================
// Moved out of js/timeline.js (ride-no-home, at its size light) with no change: the import (tlRead) calls tlDaySegs and tlSimplifyDays; the
// memory map and the picture read tlPaths.
// tl-paths (decisions 2026-11-20 · The Timeline's day paths, Q1-Q2): a day is stored as segments, walk ('w') or ride ('r'), in time order,
// cleaned here once for every drawer. A visit is one point (its own) - the points recorded during it are noise and dropped; a move's points
// (its own, or the day's recorded points inside its time) are its segment, from the visit before it to the visit after it; two visits with
// no move between are not joined (that line was the jump across the river). Inside a segment a point whose speed from the last kept one is
// not plausible for its kind is dropped (a run of TL_CLEAN.run such points that agree with each other starts a new piece - the anchor was
// the wrong one), and a spike - out and straight back - is dropped. The thresholds, in one place (measured on tests/tlfake.py's jumps and
// noise; the summary of tl-paths has the table): still - under it a step is never a jump; minH - the shortest time a speed is read over;
// ratio - a spike's way out and back against the straight line; w / r / f - walking, a ride, a flight: the top speed and the shortest spike.
// old*: a day stored before (no times, no kinds) - a step longer than oldJump splits the line, a spike longer than oldSpike is dropped.
// zz - the zig-zag (tl-zigzag): a point within near of a side's centre is on that side; the two centres at least gap apart; a run with at
// least flips side changes, each faster than kmh (a walker crossing would leave a point between), is a location flipping between two places.
const TL_CLEAN = { still: 0.05, minH: 1 / 120, ratio: 2, run: 3, w: { kmh: 20, spike: 0.15 }, r: { kmh: 250, spike: 1 }, f: { kmh: 1100, spike: 30 }, oldJump: 1, oldSpike: 0.15,
  zz: { near: 0.1, gap: 0.2, flips: 3, kmh: 8 } };
const TL_CLEAN_LAST = {}; // the last import's counts (what each rule dropped) - for the tests and the summary's table, never stored (filled in place: no new mutable binding)
function tlCleanStats() { return { visit: 0, speed: 0, spike: 0, split: 0, gap: 0, zig: 0, kept: 0 }; }
// tl-zigzag (decisions 2026-11-26 · The Timeline path's remaining jumps, Q1): a location flipping between two fixed places (a Wi-Fi or a
// cell on either bank, every minute or two) passes the speed rule (350 m in two minutes reads as a walk) and the spike rule (two points in a
// row on one side are no spike). A run of points each near one of two centres (TL_CLEAN.zz) with enough fast side changes keeps only the
// side that agrees with the points before and after it; where they disagree (a real crossing inside the run), one crossing, at the place
// that drops the fewest points. Runs before the speed rule, so the run of 3 never confirms the wrong side. pts ({ ll, ms }) -> pts
function tlZigzag(pts, st) { const Z = TL_CLEAN.zz, d = distanceKm, out = []; let i = 0;
  const mean = (c, n, q) => ({ lat: c.lat + (q.lat - c.lat) / n, lng: c.lng + (q.lng - c.lng) / n });
  while (i < pts.length) { const C = [pts[i].ll, null], N = [1, 0], side = [0]; let e = i + 1, flips = 0;
    for (; e < pts.length; e++) { const q = pts[e].ll; let s;
      if (!C[1]) { if (d(C[0], q) <= Z.near) s = 0; else if (d(C[0], q) >= Z.gap) { C[1] = q; s = 1; } else break; }
      else { const a = d(C[0], q), b = d(C[1], q); s = a <= Z.near && a <= b ? 0 : b <= Z.near ? 1 : -1; if (s < 0) break; }
      if (s !== side[side.length - 1] && d(pts[e - 1].ll, q) / Math.max((pts[e].ms - pts[e - 1].ms) / 36e5, TL_CLEAN.minH) > Z.kmh) flips++;
      if (N[s]++) C[s] = mean(C[s], N[s], q); side.push(s); }
    if (flips < Z.flips) { out.push(pts[i]); i++; continue; }
    const sideOf = x => d(C[0], x.ll) <= d(C[1], x.ll) ? 0 : 1, prev = out[out.length - 1], next = pts[e], more = side.filter(s => s).length * 2 > side.length ? 1 : 0;
    let b = prev ? sideOf(prev) : null, a = next ? sideOf(next) : null; if (b === null) b = a === null ? more : a; if (a === null) a = b;
    let best = side.length, cost = side.filter(s => s !== b).length, c = cost; // the crossing at k: before it the side b, from it the side a
    for (let k = side.length - 1; k >= 0; k--) { c += (side[k] !== a) - (side[k] !== b); if (c < cost) { cost = c; best = k; } }
    side.forEach((s, k) => { if (s === (k < best ? b : a)) out.push(pts[i + k]); else st.zig++; }); i = e; }
  return out; }
// one segment's points ({ ll, ms }) cleaned -> pieces of [{ lat, lng }]
function tlCleanSeg(pts, lim, st) { const out = []; pts = tlZigzag(pts, st); if (!pts.length) return out; let k = [pts[0]], drops = [];
  const fast = (a, q) => { const d = distanceKm(a.ll, q.ll); return d > TL_CLEAN.still && d / Math.max((q.ms - a.ms) / 36e5, TL_CLEAN.minH) > lim.kmh; };
  for (let i = 1; i < pts.length; i++) { const q = pts[i];
    if (!fast(k[k.length - 1], q)) { k.push(q); st.speed += drops.length; drops = []; continue; }
    drops.push(q); if (drops.length >= TL_CLEAN.run && drops.every((x, j) => !j || !fast(drops[j - 1], x))) { out.push(k); k = drops; drops = []; st.split++; } }
  st.speed += drops.length; out.push(k);
  return out.map(a => { for (let pass = 0; pass < 2; pass++) for (let i = 1; i < a.length - 1; i++) { const x = a[i - 1].ll, y = a[i].ll, z = a[i + 1].ll, xy = distanceKm(x, y), yz = distanceKm(y, z);
      if (xy > lim.spike && yz > lim.spike && xy + yz > TL_CLEAN.ratio * Math.max(distanceKm(x, z), TL_CLEAN.still)) { a.splice(i, 1); i--; st.spike++; } }
    st.kept += a.length; return a.map(x => x.ll); }).filter(a => a.length > 1); }
// a day's visits, moves and recorded points -> [{ m, p: [{ lat, lng }] }]
// dup-both-names (G147, phone round 10): a move's start or end point (Google's activity start / end) is placed by where it fits - kept only when
// the move's own point nearest to it is its first (the start) or its last (the end); when the recorded points pass it (the walk from Rudas
// went on past the bridge's end to the hotel), it is left out, never stamped at the move's edge after them
function tlEdgeFits(ll, own, at) { if (!own.length) return true; let bi = 0, bd = Infinity; own.forEach((q, i) => { const d = distanceKm(q.ll, ll); if (d < bd) { bd = d; bi = i; } }); return bi === at; }
function tlDaySegs(V, Mv, P, st) {
  const ev = V.map(v => ({ t: v.a.ms, e: v.b.ms, v })).concat(Mv.map(m => ({ t: m.a.ms, e: m.b.ms, m, own: (m.path || []).slice() }))), inside = (q, x) => q.ms >= x.t && q.ms <= x.e, loose = [];
  P.forEach(q => { const m = ev.find(x => x.m && inside(q, x)); if (m) { m.own.push(q); return; } if (ev.some(x => x.v && inside(q, x))) { st.visit++; return; } loose.push(q); });
  // recorded points between the events: each run its own move, walk or ride by its pace
  loose.sort((a, b) => a.ms - b.ms); let run = [];
  const flush = () => { if (run.length > 1) { const km = run.slice(1).reduce((s, q, i) => s + distanceKm(run[i].ll, q.ll), 0), h = Math.max((run[run.length - 1].ms - run[0].ms) / 36e5, TL_CLEAN.minH);
    ev.push({ t: run[0].ms, e: run[run.length - 1].ms, m: { walk: km / h <= 8, kind: 'city', s: run[0].ll, e: run[run.length - 1].ll }, own: run.slice(1, -1) }); } run = []; };
  loose.forEach(q => { if (run.length && ev.some(x => x.t > run[run.length - 1].ms && x.t < q.ms)) flush(); run.push(q); }); flush();
  ev.sort((a, b) => a.t - b.t || (a.v ? -1 : 1));
  const segs = []; let last = null, open = null;
  ev.forEach(x => { if (x.v) { const P0 = { ll: x.v.ll, ms: x.t }; if (open) { open.pts.push(P0); open = null; } else if (last) st.gap++; last = { ll: x.v.ll, ms: x.e }; return; }
    const m = x.m, k = m.walk ? 'w' : 'r', lim = TL_CLEAN[m.walk ? 'w' : m.kind === 'flight' ? 'f' : 'r'], pts = [], s0 = m.s ? { ll: m.s, ms: x.t } : null;
    const own = x.own.sort((a, b) => a.ms - b.ms);
    if (last && (!s0 || distanceKm(last.ll, s0.ll) <= lim.spike)) pts.push(last); else if (s0 && tlEdgeFits(s0.ll, own, 0)) pts.push(s0);
    own.forEach(q => pts.push({ ll: q.ll, ms: q.ms })); if (m.e && tlEdgeFits(m.e, own, own.length - 1)) pts.push({ ll: m.e, ms: x.e });
    open = { m: k, lim, pts }; segs.push(open); last = null; });
  const out = []; segs.forEach(g => tlCleanSeg(g.pts, g.lim, st).forEach(p => { const prev = out[out.length - 1];
    if (prev && prev.m === g.m && prev.p[prev.p.length - 1] === p[0]) prev.p = prev.p.concat(p.slice(1)); else out.push({ m: g.m, p }); })); // the same kind on both sides of a visit: one line
  return out; }
// the day's segments simplified together (one tolerance) until they fit TL_MAX_PTS; stored as [lat, lng] (5 places)
function tlSimplifyDays(days) { Object.values(days).forEach(x => { const segs = x.s; let tol = 1.1e-4, r;
  const run = () => segs.map(g => simplifyLine(g.p.map(c => [c.lng, c.lat]), tol));
  r = run(); while (r.reduce((n, a) => n + a.length, 0) > TL_MAX_PTS && tol < 0.05) { tol *= 1.6; r = run(); }
  x.s = segs.map((g, i) => ({ m: g.m, p: r[i].map(q => [+(+q[1]).toFixed(5), +(+q[0]).toFixed(5)]) })).filter(g => g.p.length > 1); }); }
// Q5: a day stored before - one line with no times or kinds: its spikes dropped (out and straight back, any length), then split at a jump
// -> pieces of [lat, lng]
function tlCleanOld(p) { const ll = q => ({ lat: q[0], lng: q[1] }), a = p.slice(), out = []; let cur = [];
  for (let i = 1; i < a.length - 1; i++) { const x = ll(a[i - 1]), y = ll(a[i]), z = ll(a[i + 1]), xy = distanceKm(x, y), yz = distanceKm(y, z);
    if (xy > TL_CLEAN.oldSpike && yz > TL_CLEAN.oldSpike && xy + yz > TL_CLEAN.ratio * Math.max(distanceKm(x, z), TL_CLEAN.still)) { a.splice(i, 1); i--; } }
  a.forEach(q => { if (cur.length && distanceKm(ll(cur[cur.length - 1]), ll(q)) > TL_CLEAN.oldJump) { out.push(cur); cur = []; } cur.push(q); }); out.push(cur);
  return out.filter(x => x.length > 1); }
// tl-paths (Q1, Q5): the one reader every drawer uses - the trip's segments [{ m: 'w' | 'r', p }] in day order; a day imported before
// (p only) is cleaned of jumps and spikes on read and drawn as one solid line (m 'w', old: true). Memoized by the import's moment.
const TL_PATH_MEMO = {};
function tlPaths(id) { const tl = tlOf(id); if (!tl) return []; const key = (tl.at || 0) + '|' + Object.keys(tl.days || {}).length, M = TL_PATH_MEMO[id];
  if (M && M.key === key && M.tl === tl) return M.v;
  const v = []; Object.keys(tl.days || {}).sort().forEach(d => { const x = tl.days[d] || {};
    if (Array.isArray(x.s)) x.s.forEach(g => { if (g && Array.isArray(g.p) && g.p.length > 1) v.push({ m: g.m === 'r' ? 'r' : 'w', p: g.p, d }); });
    else if (Array.isArray(x.p) && x.p.length > 1) tlCleanOld(x.p).forEach(p => v.push({ m: 'w', p, old: true, d })); }); // trip-replay: each segment knows its day (d)
  TL_PATH_MEMO[id] = { key, tl, v }; return v; }
// Q5: a day stored before tl-paths (p, no s) - the re-import line shows while any is left
function tlOldDays(id) { const tl = tlOf(id); return tl ? Object.values(tl.days || {}).some(x => x && !Array.isArray(x.s) && Array.isArray(x.p) && x.p.length > 1) : false; }
// the memory: a day's Timeline walk (its walking segments, cleaned as tlPaths reads them)
function svTlRoute(id, date) { const tl = tlOf(id), x = tl && (tl.days || {})[date]; if (!x) return null;
  const segs = Array.isArray(x.s) ? x.s.filter(g => g && g.m !== 'r' && Array.isArray(g.p) && g.p.length > 1).map(g => g.p) : Array.isArray(x.p) && x.p.length > 1 ? tlCleanOld(x.p) : [];
  return segs.length ? { key: 'tl:' + id + '|' + date, name: 'הליכה' + SEP + tmFmt('day', date), segs, via: [] } : null; }

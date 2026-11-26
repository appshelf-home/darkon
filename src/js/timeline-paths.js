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
const TL_CLEAN = { still: 0.05, minH: 1 / 120, ratio: 2, run: 3, w: { kmh: 20, spike: 0.15 }, r: { kmh: 250, spike: 1 }, f: { kmh: 1100, spike: 30 }, oldJump: 1, oldSpike: 0.15 };
const TL_CLEAN_LAST = {}; // the last import's counts (what each rule dropped) - for the tests and the summary's table, never stored (filled in place: no new mutable binding)
function tlCleanStats() { return { visit: 0, speed: 0, spike: 0, split: 0, gap: 0, kept: 0 }; }
// one segment's points ({ ll, ms }) cleaned -> pieces of [{ lat, lng }]
function tlCleanSeg(pts, lim, st) { const out = []; if (!pts.length) return out; let k = [pts[0]], drops = [];
  const fast = (a, q) => { const d = distanceKm(a.ll, q.ll); return d > TL_CLEAN.still && d / Math.max((q.ms - a.ms) / 36e5, TL_CLEAN.minH) > lim.kmh; };
  for (let i = 1; i < pts.length; i++) { const q = pts[i];
    if (!fast(k[k.length - 1], q)) { k.push(q); st.speed += drops.length; drops = []; continue; }
    drops.push(q); if (drops.length >= TL_CLEAN.run && drops.every((x, j) => !j || !fast(drops[j - 1], x))) { out.push(k); k = drops; drops = []; st.split++; } }
  st.speed += drops.length; out.push(k);
  return out.map(a => { for (let pass = 0; pass < 2; pass++) for (let i = 1; i < a.length - 1; i++) { const x = a[i - 1].ll, y = a[i].ll, z = a[i + 1].ll, xy = distanceKm(x, y), yz = distanceKm(y, z);
      if (xy > lim.spike && yz > lim.spike && xy + yz > TL_CLEAN.ratio * Math.max(distanceKm(x, z), TL_CLEAN.still)) { a.splice(i, 1); i--; st.spike++; } }
    st.kept += a.length; return a.map(x => x.ll); }).filter(a => a.length > 1); }
// a day's visits, moves and recorded points -> [{ m, p: [{ lat, lng }] }]
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
    if (last && (!s0 || distanceKm(last.ll, s0.ll) <= lim.spike)) pts.push(last); else if (s0) pts.push(s0);
    x.own.sort((a, b) => a.ms - b.ms).forEach(q => pts.push({ ll: q.ll, ms: q.ms })); if (m.e) pts.push({ ll: m.e, ms: x.e });
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

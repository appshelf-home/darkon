// ================= 4.38.0: DAYS WITHOUT DATES · DATES LATER · DAY OPERATIONS =================
// A trip can be planned by days before it has dates: t.days (the sum of its destinations' days), and segments, lodging,
// travels and the organized schedule sit on "virtual" dates from VDATE, shown everywhere as "יום N" (the TIME block).
// Dates come later: estimated (t.dateMode 'est' - the end follows the days, ± still works) or fixed (9.2.0 ס9: set in the trip
// editor itself, where the destinations' days must match the dates). A day with content never falls apart: a day that leaves the trip waits in
// "📦 מחוץ לטיול" (td.parked) with its order, times and notes, until it is put back or deleted.
function isDateless(t) { return !!(t && !t.start && t.days); }
// trip-travel-days (decisions 2026-11-15 · A trip without flights, Q3): the two "ימים שכולם בדרך" switches (a first / last day that is
// all travel - it still belongs to the first / last destination, but is not a visit day) are stored with a trip of fixed dates as the
// user set them - t.roadDays { first, last } (absent = both off) - and only the user changes them. A recorded travel only suggests
// (roadFit): the last leg of the first day's chain lands the next day or at 17:00 or later; the last travel home leaves before 12:00
// (one dated travel on the last day is enough when the trip is longer than one day - 11.21.0, review of the night chain Q9;
// flightsOnly, the migration, keeps the old editor's rule of two dated flights so a stored trip opens as it did).
function roadDaysOf(t) { const r = t && t.start && t.dateMode !== 'est' ? t.roadDays : null; return { lead: r && r.first ? 1 : 0, tail: r && r.last ? 1 : 0 }; }
// the old detection (ס9 (2), ז12), for any kind of travel (Q1) - or flights only (flightsOnly), as the editor derived it until 11.18.0 (the migration)
function roadFit(t, S, E, flightsOnly) { const out = { lead: null, tail: null }; if (!t || !S) return out;
  const fl = travelsOf(t).filter(f => (!flightsOnly || (f.mode || 'flight') === 'flight') && f.date && !isVirt(f.date)).sort((a, b) => (a.date + (a.depart || '')).localeCompare(b.date + (b.depart || '')));
  if (!fl.length) return out; const f0 = fl[0], f1 = fl[fl.length - 1];
  if (f0.date === S) { let c = f0; fl.forEach(f => { if (f !== c && f.date === travelLandDate(c) && fl.indexOf(f) > fl.indexOf(c)) c = f; }); // 7.0.0 (ז12): the last leg of the chain
    const w = travelWords(c.mode).arrive;
    if (travelLandDate(c) > S) out.lead = { f: c, text: w + ' למחרת' }; else if (isHM(c.arrive) && c.arrive >= '17:00') out.lead = { f: c, text: w + ' ב־' + c.arrive }; }
  if ((flightsOnly ? fl.length > 1 : E > S) && f1.date === E && isHM(f1.depart) && f1.depart < '12:00') out.tail = { f: f1, text: travelWords(f1.mode).depart + ' ב־' + f1.depart };
  return out; }
// the transfer line's icon (Q5): the travel recorded on that day, or a neutral transfer icon when none
function passIcon(t, date) { const f = t && date ? travelsOf(t).find(x => x.date === date) : null; return f ? TRAVEL_MS[f.mode] || 'flight' : 'commute'; }
function isFlexDays(t) { return !!(t && (isDateless(t) || t.dateMode === 'est')); } // ± days and lengths still move
function tripLen(t) { return tripDayList(t).length; }
// day indexes (1-based) of each segment; a transfer day (two segments on the same date) belongs to the one arriving
function segRanges(t) {
  const st = t.start || VDATE, n = tripLen(t);
  const out = (t.segments || []).map((s, i) => ({ dest: s.dest, i, a: s.from ? daysBetween(st, s.from) + 1 : 1, b: s.to ? daysBetween(st, s.to) + 1 : n }))
    .sort((x, y) => x.a - y.a || x.i - y.i);
  out.forEach(r => { r.a = Math.max(1, r.a); r.b = Math.min(n, r.b); });
  for (let k = 0; k < out.length - 1; k++) if (out[k].b >= out[k + 1].a) out[k].b = out[k + 1].a - 1;
  return out.filter(r => r.b >= r.a);
}
function segLensOf(t) { return segRanges(t).map(r => ({ dest: r.dest, len: r.b - r.a + 1, orig: r.i })); }
function dayIdx(key) { return Number(String(key).slice(1)) || 0; }
const DAY_SLOTS = ['morning', 'afternoon', 'evening', 'unassigned'];
function dayIds(day) { return day ? ['morning', 'afternoon', 'evening', 'unassigned'].flatMap(s => day[s] || []) : []; } // used at startup (migration): no consts from further down
// Rebuilds a trip's days. o: { mode 'none'|'est'|'fixed', start (real date; not for 'none'), segs [{dest, len, orig}],
// lead/tail (an empty flight day before/after the plan), map (old day -> new day, null = out of the trip), keepItemDates, wd }
// lead/tail with road: true (the trip editor) is the user's choice of the two "ימים שכולם בדרך" switches, stored as t.roadDays;
// any other fixed-dates rebuild (a day operation, the Timeline's dates) keeps what is stored
function rebuildTripDays(t, o, tdIn) {
  const td = tdIn || tdOf(t.id), oldStart = t.start || VDATE, oldLen = tripLen(t), oldR = segRanges(t);
  const lead = o.lead || 0, tail = o.tail || 0;
  let cur = 1 + lead; const nr = o.segs.map(s => { const r = { dest: s.dest, a: cur, b: cur + s.len - 1, p: cur, orig: s.orig == null ? -1 : s.orig, len: s.len }; cur += s.len; return r; }); // p: where its planned days start
  const total = Math.max(1, cur - 1 + tail);
  const map = o.map || (i => { const r = oldR.find(x => i >= x.a && i <= x.b); if (!r) return null; const n = nr.find(x => x.orig === r.i); if (!n) return null; const k = i - r.a; return k < n.len ? n.p + k : null; });
  if (nr.length) { nr[0].a = 1; nr[nr.length - 1].b = total; } // flight days kept out of the plan belong to the first and last destination
  const nk = i => 'd' + i, it = td.itinerary || {}, times = td.times || {}, px = td.planX || {}, anch = px.anchors || {};
  const nIt = {}, nTimes = {}, nAnch = {}, parked = td.parked = td.parked || [];
  const keys = new Set([...Object.keys(it), ...Object.keys(anch)].filter(k => /^d\d+$/.test(k)));
  const mapK = k => { const i = dayIdx(k); return i >= 1 && i <= oldLen ? map(i) : null; };
  keys.forEach(k => { const j = mapK(k);
    if (j == null) { const day = it[k]; if (dayIds(day).length) { const r = oldR.find(x => dayIdx(k) >= x.a && dayIdx(k) <= x.b) || oldR[oldR.length - 1];
        const tms = {}; Object.entries(times).forEach(([tk, v]) => { const p = tk.indexOf('|'); if (tk.slice(0, p) === k) tms[tk.slice(p + 1)] = v; });
        parked.push({ id: 'pk' + Date.now().toString(36) + dayIdx(k) + Math.random().toString(36).slice(2, 5), from: dayIdx(k) <= oldLen ? tmFmt('date', isoAdd(oldStart, dayIdx(k) - 1)) : 'יום ' + dayIdx(k), dest: r ? r.dest : '', at: Date.now(), day: JSON.parse(JSON.stringify(day)), times: tms, anchors: anch[k] || null }); }
      return; }
    if (it[k]) nIt[nk(j)] = it[k]; if (anch[k]) nAnch[nk(j)] = anch[k]; });
  Object.entries(times).forEach(([tk, v]) => { const p = tk.indexOf('|'), j = mapK(tk.slice(0, p)); if (j != null) nTimes[nk(j) + tk.slice(p)] = v; });
  const newStart = o.mode === 'none' ? VDATE : o.start, nd = j => isoAdd(newStart, j - 1);
  if (!o.keepItemDates) {
    const mapDate = (d, isEnd) => { if (!d) return d; const i = daysBetween(oldStart, d) + 1 - (isEnd ? 1 : 0);
      let j = i >= 1 && i <= oldLen ? map(i) : null;
      if (j == null) { // out of the plan (or the day left the trip): the nearest day that stays
        let best = null; for (let q = 1; q <= oldLen; q++) { const m = map(q); if (m != null && (best == null || Math.abs(q - i) < Math.abs(best.q - i))) best = { q, m }; }
        j = best ? best.m + (i - best.q) : i + lead; j = Math.max(1, Math.min(total, j)); }
      return isoAdd(nd(j), isEnd ? 1 : 0); };
    (t.travels || []).forEach(x => { x.date = mapDate(x.date); });
    (t.lodging || []).forEach(x => { x.checkIn = mapDate(x.checkIn); x.checkOut = mapDate(x.checkOut, true); });
    (t.schedule || []).forEach(x => { x.date = mapDate(x.date); });
    Object.values(px.sched || {}).forEach(e => { if (e && e.ch && e.ch.date) e.ch.date = mapDate(e.ch.date); });
  }
  if (o.keepItemDates && o.moveSched) { // 4.46.0: the organized schedule moves with its day - as my change over the source (✏️ שונה אצלי, ↺ חזרה למקור)
    const sx = px.sched = px.sched || {};
    (t.schedule || []).forEach(s => { const ed = sx[s.id]; if (ed && ed.hidden) return; const ch = (ed && ed.ch) || {}, eff = ch.date || s.date, kind = ch.kind || s.kind;
      if (!eff || !schedMovable(kind)) return; const i = daysBetween(oldStart, eff) + 1; if (i < 1 || i > oldLen) return;
      const j = map(i); if (j == null || j === i) return; const to = nd(j), e = sx[s.id] = sx[s.id] || {}; e.ch = e.ch || {}; if (!e.base) e.base = schedSnap(s);
      if (to === s.date) delete e.ch.date; else e.ch.date = to; }); }
  t.segments = nr.map(r => ({ dest: r.dest, from: nd(r.a), to: nd(r.b) }));
  if (o.mode === 'none') { t.start = ''; t.end = ''; t.days = total; delete t.dateMode; if (o.wd !== undefined) { if (o.wd === '' || o.wd == null) delete t.wd; else t.wd = Number(o.wd); } }
  else { t.start = o.start; t.end = nd(total); delete t.days; delete t.wd; if (o.mode === 'est') t.dateMode = 'est'; else delete t.dateMode; }
  if (o.mode !== 'fixed') delete t.roadDays; // trip-travel-days (Q3): the switches belong to fixed dates only
  else if (o.road) { if (lead || tail) t.roadDays = { ...(lead ? { first: true } : {}), ...(tail ? { last: true } : {}) }; else delete t.roadDays; } // the editor's choice, as the user set it
  td.itinerary = nIt; td.times = nTimes; px.anchors = nAnch; td.planX = px; propRemap(td, mapK); // 11.5.0: a waiting proposal's days follow the plan's
  if (!tdIn && t.id === STATE.activeTrip) loadPersonal(t.id);
  return total;
}
// places scheduled again in a day of the trip leave the waiting day; an empty waiting day goes.
// draw-no-write (decisions 2026-11-27 · Review of night chain steps 1-4 after 11.67.1, Q3): written only by a change - hCommit tidies every
// trip before it closes the change's own history row, so its undo restores the plan and the waiting days together - and once by the
// migration row 'parkedTidy' for data stored before; a draw never writes it: parkedOf filters what it shows (t1254 keeps both)
function planIdsOf(id) { const it = id === STATE.activeTrip && !DEST_VIEW ? STATE.itinerary : (STATE.tripData[id] || {}).itinerary, t = STATE.trips[id], n = t ? tripLen(t) : 0, out = new Set();
  for (let i = 1; i <= n; i++) dayIds((it || {})['d' + i]).forEach(x => out.add(String(x))); return out; }
const parkedLeft = (e, inPlan) => { const day = {}; DAY_SLOTS.forEach(s => { if (e.day && e.day[s]) day[s] = e.day[s].filter(id => !inPlan.has(String(id))); }); return day; };
function parkedTidy(id) { // one trip's stored waiting days; returns whether it wrote
  const td = STATE.tripData[id]; if (!td || !(td.parked || []).length || !tripWritable(id)) return false; const inPlan = planIdsOf(id);
  if (!td.parked.some(e => !dayIds(e.day).length || dayIds(e.day).some(x => inPlan.has(String(x))))) return false;
  td.parked.forEach(e => { if (e.day) Object.assign(e.day, parkedLeft(e, inPlan)); });
  td.parked = td.parked.filter(e => dayIds(e.day).length); return true;
}
function parkedTidyAll() { let n = 0; Object.keys(STATE.tripData || {}).forEach(id => { if (parkedTidy(id)) n++; }); return n; }
migRun('parkedTidy', () => { try { const u = regRead('upkeep'); if (u.parkedTidy) return; const n = parkedTidyAll(); if (n) persist();
  regWrite('upkeep', { ...regRead('upkeep'), parkedTidy: APP_VERSION, parkedTidyTrips: n }); } catch (e) {} });
function parkedOf(id) { id = id || STATE.activeTrip; const list = (STATE.tripData[id] || {}).parked || []; if (!list.length) return list; const inPlan = planIdsOf(id);
  return list.map(e => e.day && dayIds(e.day).some(x => inPlan.has(String(x))) ? { ...e, day: { ...e.day, ...parkedLeft(e, inPlan) } } : e).filter(e => dayIds(e.day).length); }
function parkedHas(pid) { return parkedOf().some(e => dayIds(e.day).some(x => String(x) === String(pid))); }
// one undo for anything that changes the days
// (undo-history: more() - a change that needs the rebuilt days, e.g. a duplicated day's content - runs before the toast, in the same row)
function tripDaysChange(msg, fn, more) {
  const t = activeTripObj(); if (!t.id) return; stashActive();
  const r = fn(t); if (r === false) return;
  loadPersonal(t.id); applyActiveTrip(); if (more) more(); syncFlightsToPlan(); persist(); updateHeader(); 
  showUndoToast(msg, 7000);
}
// a trip with fixed dates keeps its frame: the days before the first destination and after the last stay as they are
function fixedFrame(t, segs) { const R = segRanges(t), lead = R.length ? R[0].a - 1 : 0, sum = segs.reduce((n, s) => n + s.len, 0); return { lead, tail: Math.max(0, tripLen(t) - lead - sum) }; }
function rangeOfDay(t, i) { return segRanges(t).find(r => i >= r.a && i <= r.b) || null; }
function dayContentN(key) { const d = STATE.itinerary[key]; return dayIds(d).length; }
// ＋ a day before/after a day. Flexible trips grow; a trip with fixed dates keeps them, and its destination's last day leaves the trip
function insertDayAt(key, after, more) {
  const t = activeTripObj(), i = dayIdx(key), r = rangeOfDay(t, i); if (!r) return;
  const pos = after ? i : i - 1, segs = segLensOf(t), flex = !t.start || t.dateMode === 'est';
  if (flex && tripLen(t) >= 60) { showToast('טיול עד 60 יום'); return; }
  const mp = flex ? x => x <= pos ? x : x + 1 : x => x <= pos || x > r.b ? x : x + 1 <= r.b ? x + 1 : null;
  withSchedChoice(t, mp, mv => tripDaysChange(`＋ יום ${after ? 'אחרי' : 'לפני'} ${dayLabelOf(key)}${flex ? '' : ` (היום האחרון של ${destName(r.dest)} יצא מהטיול)`}`, tt => {
    if (flex) segs.find(s => s.orig === r.i).len++; rebuildByDays(tt, segs, mp, mv); }, more));
}
// 📦 a day leaves the trip (its content waits in "מחוץ לטיול")
function parkDayAt(key) {
  const t = activeTripObj(), i = dayIdx(key), r = rangeOfDay(t, i); if (!r) return; const segs = segLensOf(t), flex = !t.start || t.dateMode === 'est';
  if (flex && tripLen(t) <= 1) { showToast('בטיול נשאר יום אחד'); return; }
  const mp = flex ? x => x === i ? null : x > i ? x - 1 : x : x => x === i ? null : x > i && x <= r.b ? x - 1 : x;
  withSchedChoice(t, mp, mv => tripDaysChange(`${dayLabelOf(key)} יצא מהטיול`, tt => {
    if (flex) { segs.find(x => x.orig === r.i).len--; rebuildByDays(tt, segs.filter(x => x.len > 0), mp, mv); } else rebuildByDays(tt, segs, mp, mv); }));
}
function dupDayAt(key) {
  const t = activeTripObj(), i = dayIdx(key), src = JSON.parse(JSON.stringify(STATE.itinerary[key] || {})), srcTimes = {};
  Object.entries(STATE.times || {}).forEach(([tk, v]) => { const p = tk.indexOf('|'); if (tk.slice(0, p) === key) srcTimes[tk.slice(p + 1)] = v; });
  // undo-history: the copy is made inside the day's insertion (after the days are rebuilt, before its toast) - one row; it also
  // waits for the schedule question, where it used to run before the new day existed
  insertDayAt(key, true, () => { const nk = 'd' + (i + 1), day = ensureDay(nk);
    DAY_SLOTS.forEach(s => (src[s] || []).forEach(id => { const p = planItem(id); if (!p) return; const fid = 'c_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
      STATE.planItems[fid] = STATE.planItems[id] ? JSON.parse(JSON.stringify(STATE.planItems[id])) : { ref: p.id, name: p.name, address: p.address, icon: p.icon };
      day[s].push(fid); if (srcTimes[id]) STATE.times[nk + '|' + fid] = srcTimes[id]; }));
    stashActive(); });
}
// 9.1.1 (12ג-3): the "moving days" core - one place for the rule (a day moves only inside its destination), the schedule
// question, the rebuild by the trip's date mode and the parked-day entry; swap, move, insert, park and unpark call it
function rebuildByDays(tt, segs, mp, mv) {
  rebuildTripDays(tt, { mode: tt.start ? (tt.dateMode === 'est' ? 'est' : 'fixed') : 'none', start: tt.start, segs, ...(tt.start && tt.dateMode !== 'est' ? fixedFrame(tt, segs) : {}), map: mp, keepItemDates: true, moveSched: mv });
}
function remapDays(i, j, mp, label) {
  const t = activeTripObj(), ri = rangeOfDay(t, i), rj = rangeOfDay(t, j); if (!ri || !rj) return;
  if (ri.i !== rj.i) { showToast('יום זז רק בתוך היעד שלו. כדי להעביר יום בין יעדים - משנים את מספר הימים של היעדים'); return; }
  withSchedChoice(t, mp, mv => { ARR_FLASH = j; tripDaysChange(label() + arrStayNote(t, mv), tt => { rebuildByDays(tt, segLensOf(tt), mp, mv); }); });
}
// a day's plan, its times and anchors leave the itinerary as a parked entry
function parkEntry(td, key, day, id, from, dest) {
  const tms = {}; Object.entries(td.times || {}).forEach(([tk, v]) => { const p = tk.indexOf('|'); if (tk.slice(0, p) === key) { tms[tk.slice(p + 1)] = v; delete td.times[tk]; } });
  return { id, from, dest, at: Date.now(), day, times: tms, anchors: ((td.planX || {}).anchors || {})[key] || null };
}
// and come back into a day
function unparkDay(td, key, e) {
  td.itinerary[key] = e.day; td.times = td.times || {}; Object.entries(e.times || {}).forEach(([id, v]) => { td.times[key + '|' + id] = v; });
  if (e.anchors) { td.planX = td.planX || {}; td.planX.anchors = td.planX.anchors || {}; td.planX.anchors[key] = e.anchors; }
}
// ↕️ a day moved to another place inside its destination (drag in "סידור ימים"); the days between shift by one
function moveDayTo(i, j) {
  if (i === j) return;
  remapDays(i, j, x => x === i ? j : (j > i && x > i && x <= j) ? x - 1 : (j < i && x >= j && x < i) ? x + 1 : x, () => `↕️ ${dayLabelOf('d' + i)} הוזז`);
}
function arrStayNote(t, mv) { return mv ? ' (גם ' + TX.group + ' זז; טיסות ולינות נשארו בתאריך)' : (t.schedule || []).length || (t.travels || []).length ? ' (התוכנית זזה; טיסות, לינות ו' + TX.group + ' נשארו בתאריך)' : ''; }
// 4.46.0: the organized schedule can move with its day. Flights and arrival at a hotel stay - they belong to bookings.
// Asked before every such move (4.49.0: the question says how many items move, so it is asked each time).

function schedMovable(kind) { return kind !== 'flight' && kind !== 'hotel'; }
function schedAffected(t, mapFn) { const st = t.start || VDATE, L = tripLen(t); let n = 0;
  rawSchedule().forEach(s => { const ed = schedEd(s.id); if (ed && ed.hidden) return; const e = schedEff(s); if (!e.date || !schedMovable(e.kind)) return;
    const i = daysBetween(st, e.date) + 1; if (i < 1 || i > L) return; const j = mapFn(i); if (j != null && j !== i) n++; }); return n; }
function withSchedChoice(t, mapFn, go) { const ctl = {};
  const n = schedAffected(t, mapFn); if (!n) { go(false); return; }
  const sheet = document.getElementById('sheet');
  // 10.12.0 (design-plan, gap 5): the "two cards" pattern - a tap on a card chooses and goes on
  sheet.innerHTML = `${fmHead(`${SY.group} ${TX.group} ביום שזז ${tipI('savedHere')}`, 'smX')}
    <p class="dt-text">בימים שזזים יש <b>${n === 1 ? 'פריט אחד' : n + ' פריטים'}</b> ב${TX.group}. להזיז אותם עם היום?</p>
    <div class="two-cards"><button type="button" class="tc-card" data-act="schedChoice.sm" data-sm="1"><small>${msi('swap_vert', { cls: 'msi-in' })} עם היום</small><span>להזיז גם את ${TX.group}</span></button><button type="button" class="tc-card" data-act="schedChoice.sm" data-sm="0"><small>${msi('event', { cls: 'msi-in' })} בתאריך</small><span>רק התוכנית</span></button></div>
    <p class="sh-hint">טיסות ולינות נשארות תמיד בתאריך שלהן.</p>`;
  
  ctl.sm = b => { const mv = b.dataset.sm === '1'; closeSheet(); setTimeout(() => go(mv), 80); };
  openSheet('schedMove'); layerTop().ctl = ctl;
}
ctlActs('schedChoice', ['sm']);

function addDayAtEnd() {
  const t = activeTripObj(); if (!isFlexDays(t)) return; if (tripLen(t) >= 60) { showToast('טיול עד 60 יום'); return; }
  tripDaysChange('＋ יום בסוף הטיול', tt => { const segs = segLensOf(tt); segs[segs.length - 1].len++; rebuildTripDays(tt, { mode: tt.start ? 'est' : 'none', start: tt.start, segs }); });
}
// ↩️ a waiting day back: in place of a day (that day waits instead, if it has content), or as a new day (flexible trips)
function unparkInto(pkId, key) {
  tripDaysChange('↺ היום חזר לטיול', tt => { const td = tdOf(tt.id), e = (td.parked || []).find(x => x.id === pkId); if (!e) return false;
    const it = td.itinerary = td.itinerary || {}, cur = it[key];
    if (dayIds(cur).length) td.parked.push(parkEntry(td, key, cur, 'pk' + Date.now().toString(36), tmFmt('date', (dayByKey(key) || {}).date), (rangeOfDay(tt, dayIdx(key)) || {}).dest || ''));
    unparkDay(td, key, e);
    td.parked = td.parked.filter(x => x !== e); });
}
function unparkAsNew(pkId) {
  const t = activeTripObj(); if (!isFlexDays(t)) return; const td0 = STATE.tripData[t.id] || {}, e = (td0.parked || []).find(x => x.id === pkId); if (!e) return;
  tripDaysChange('↺ היום חזר לטיול כיום נוסף', tt => { const segs = segLensOf(tt); let k = segs.map(s => s.dest).lastIndexOf(e.dest); if (k < 0) k = segs.length - 1;
    segs[k].len++; rebuildTripDays(tt, { mode: tt.start ? 'est' : 'none', start: tt.start, segs });
    const nr = segRanges(tt).find(r => r.i === k) || segRanges(tt).slice(-1)[0], key = 'd' + nr.b, td = tdOf(tt.id);
    unparkDay(td, key, e);
    td.parked = td.parked.filter(x => x.id !== pkId); });
}
// 4.40.0: one place of a waiting day goes to a day of the trip - same part of the day and time, and the waiting day keeps the rest
function openParkedMove(pkId, id) { const it = planItem(id); if (!it) return;
  const e = parkedOf().find(x => x.id === pkId); if (!e) return;
  openFmChoice({ key: 'openParkedMove', closeId: 'pmClose', as: 'grid', title: `${SY.days} לשבץ${SEP}${itemIcon(it, { size: 18, cls: 'msi-in' })} ${nameB(it.name)}`,
    hints: [`היה ${escH(e.from)}. בוחרים יום בטיול: המקום עובר אליו עם החלק ביום והשעה שהיו לו, ויוצא מ"מחוץ לטיול".`],
    options: TRIP_DAYS.filter(d => dayOk(d.key, it)).map(d => ({ v: d.key, html: `<b>${d.label}</b>`, sub: `יום ${TRIP_DAYS.indexOf(d) + 1}`, on: dayIds(STATE.itinerary[d.key]).some(x => String(x) === String(id)) })) },
    key => moveParkedItem(pkId, id, key));
}
function moveParkedItem(pkId, id, key) {
  tripDaysChange(SY.days + ' שובץ ב-' + ((dayByKey(key) || {}).label || 'יום'), tt => { const td = tdOf(tt.id), e = (td.parked || []).find(x => x.id === pkId); if (!e || !e.day) return false;
    const sl = DAY_SLOTS.find(k => (e.day[k] || []).some(x => String(x) === String(id))); if (!sl) return false;
    e.day[sl] = e.day[sl].filter(x => String(x) !== String(id));
    const itin = td.itinerary = td.itinerary || {}; let d = itin[key]; if (!d || Array.isArray(d)) d = itin[key] = { unassigned: Array.isArray(d) ? d : [], morning: [], afternoon: [], evening: [] };
    DAY_SLOTS.forEach(k => { d[k] = d[k] || []; });
    if (!DAY_SLOTS.some(k => d[k].some(x => String(x) === String(id)))) d[sl].push(id);
    const tm = (e.times || {})[id]; if (tm) { td.times = td.times || {}; td.times[key + '|' + id] = tm; delete e.times[id]; }
    if (!dayIds(e.day).length) td.parked = td.parked.filter(x => x !== e); });
}
function dropParked(pkId) { tripDaysChange(SY.del + ' היום שמחוץ לטיול נמחק', tt => { const td = tdOf(tt.id); td.parked = (td.parked || []).filter(x => x.id !== pkId); }); }
// the "מחוץ לטיול" block at the end of the plan and of day arranging (10.12.0, design-plan gap 58: the chair, a folding card per day,
// its places with their layer circle and "לשבץ", one "להחזיר לטיול…" and "מחיקה" in red)
function parkedFromDay(from) { const iso = tmParseDMY(from); return iso ? tmFmt('day', iso) : tmFmt('noYear', from); } // "27.12.2026" -> "ראשון 27.12"
function parkedHTML() {
  const list = parkedOf(); if (!list.length) return '';
  const esc = escH;
  return `<div class="parked-box"><div class="pk-head">${msi('chair', { size: 20 })}<b>מחוץ לטיול</b><small>· ${list.length}</small>${tipI('parked')}</div><p class="sh-hint">ימים שיצאו מהטיול, עם מה שהיה בהם.</p>`
    + list.map(e => { const ids = DAY_SLOTS.flatMap(sl => (e.day && e.day[sl] || []).map(id => ({ id, sl }))), names = ids.map(x => (planItem(x.id) || {}).name).filter(Boolean);
      // 4.40.0: a waiting day opens like a day of the plan - its places in their order, each with "לשבץ" to move it to a day of the trip
      const rows = ids.map(({ id, sl }) => { const it = planItem(id), tm = (e.times || {})[id]; if (!it) return '';
        const when = [SLOT_SHORT[sl], tm && tm.start ? `<bdi dir="ltr">${esc(tm.start)}${tm.end ? '–' + esc(tm.end) : ''}</bdi>` : ''].filter(Boolean).join(SEP) || 'בלי חלק ביום';
        return `<div class="pk-row" data-ref="pkitem:${esc(e.id)}|${esc(JSON.stringify(id))}">${planLead(it)}<span class="pk-tx"><b>${esc(it.name)}</b><small>${when}</small></span><button type="button" class="pk-mv" data-act="parked.move">${msi('calendar_add_on', { size: 18 })}לשבץ</button></div>`; }).join('');
      return `<details class="pk-det" data-act="parked.fold" data-ref="parked:${e.id}"${PARKED_OPEN.has(e.id) ? ' open' : ''}><summary class="pk-sum t-wrap"><span class="dh-t"><b>היה ${esc(parkedFromDay(e.from))}${e.dest && DESTS[e.dest] ? SEP + esc(destName(e.dest)) : ''}</b><small>${names.length} בתוכנית${names.length ? ': ' + esc(names.slice(0, 4).join(SEP)) + (names.length > 4 ? ' ועוד' : '') : ''}</small></span><span class="accordion-arrow">${msi('expand_more')}</span></summary>
        <div class="pk-body"><div class="pk-items">${rows}</div><div class="pk-acts brow"><button type="button" class="pk-in" data-act="parked.in">${msi('undo', { size: 18 })}להחזיר לטיול…</button><button type="button" class="pk-del" data-act="parked.del">${msi('delete', { size: 18 })}מחיקה</button></div></div></details>`; }).join('') + '</div>';
}
const PARKED_OPEN = new Set(); // 4.40.0: which waiting days are open (kept across re-renders)
// 6.1.0: a day outside the trip (parked:id on its card); 7.2.0 (פ3): its places carry "pkitem:day|item" on their row
act('parked.fold', c => { if (c.el.open) PARKED_OPEN.add(c.ref.id); else PARKED_OPEN.delete(c.ref.id); return 'quiet'; });
act('parked.move', c => { const r = String(c.ref.id), i = r.indexOf('|'); let id; try { id = JSON.parse(r.slice(i + 1)); } catch (e) { return; } openParkedMove(r.slice(0, i), id); });
act('parked.del', c => askSure({ ic: 'delete', title: 'למחוק את היום?', text: 'מה שחיכה בו נמחק איתו.', ok: 'מחיקה' }, () => { dropParked(c.ref.id); })); // 10.13.0 (gap 47): in the dialog
// the return sheet (10.12.0, gap 58): "במקום יום · כיום נוסף" (only without fixed dates), the days by destination with their content,
// one line, and the main button naming the result
function openParkedIn(pkId, how, key) { const pk = parkedOf().find(x => x.id === pkId); if (!pk) return; layerNote(openParkedIn, arguments);
  const t = activeTripObj(), flex = isFlexDays(t), esc = escH, sheet = document.getElementById('sheet'); how = flex ? how || 'in' : 'in';
  const R = segRanges(t), dayN = d => TRIP_DAYS.indexOf(d) + 1, cellDate = d => d.date && !isVirt(d.date) ? tmFmt('dayN', d.date) : 'יום ' + dayN(d);
  const sel = key && dayByKey(key) ? dayByKey(key) : null;
  const grid = R.map(r => `<div class="pk-gh">${withFlag(destFlag(r.dest), esc(destName(r.dest)))}${r.dest === pk.dest ? ' <small>· היעד של היום</small>' : ''}</div><div class="pk-days">${TRIP_DAYS.slice(r.a - 1, r.b).map(d => { const n = dayContentN(d.key), on = sel === d;
    return `<button type="button" class="pk-day${on ? ' on' : ''}" data-act="parked.pick" data-v="${d.key}" aria-pressed="${on}"><b>${esc(cellDate(d))}</b><small>${d.date && !isVirt(d.date) ? 'יום ' + dayN(d) + SEP : ''}${n ? n + ' בתוכנית' : 'ריק'}</small></button>`; }).join('')}</div>`).join('');
  const main = how === 'add' ? 'החזרה כיום נוסף' : sel ? `החזרה במקום ${esc(cellDate(sel))}` : 'בוחרים יום';
  sheet.innerHTML = `${fmHead(`↩️ להחזיר את ${nameB(parkedFromDay(pk.from))} ${tipI('parked')}`, 'pkX')}<div class="pk-in-body" data-ref="parked:${esc(pk.id)}">
    ${flex ? `<div class="sh-field"><span class="ch-lbl">איך הוא חוזר</span>${segHTML('parked.how', [['in', 'במקום יום'], ['add', 'כיום נוסף']], how)}</div>` : ''}
    <p class="sh-hint">${how === 'add' ? 'היום חוזר כיום נוסף בסוף היעד שלו, עם מה שהיה בו.' : 'היום שבוחרים יוצא ל"מחוץ לטיול" עם מה שיש בו (יום ריק פשוט מתחלף).'}</p>
    ${how === 'add' ? '' : grid}</div>
    <div class="brow export-actions sheet-save-bar"><button class="btn-nav" id="pkGo" data-act="parked.go"${how !== 'add' && !sel ? ' disabled' : ''}>${main}</button></div>`; // phone-round-1-fixes P22 (11.14.0): the pinned footer is the sheet's own child, as in every window, and like the files' frame it sticks at the sheet's edge (window-parts.css) - inside the block wrapper it lost the sheet's 10 px gap and rode up 16 px over the last row of day tiles at the end of the scroll
  openSheet('openParkedIn'); layerTop().pk = { id: pkId, how, key: sel ? sel.key : '' };
}
const pkSt = () => (layerTop() || {}).pk || {};
act('parked.in', c => openParkedIn(c.ref.id));
act('parked.how', c => { const p = pkSt(); openParkedIn(p.id, c.v, p.key); return 'quiet'; });
act('parked.pick', c => { const p = pkSt(); openParkedIn(p.id, p.how, c.v); return 'quiet'; });
act('parked.go', () => { const p = pkSt(); if (p.how === 'add') { closeSheet(); unparkAsNew(p.id); } else if (p.key) { closeSheet(); unparkInto(p.id, p.key); } });
// ⋯ on a day's header
function openDayMenu(key) {
  const t = activeTripObj(), i = dayIdx(key), r = rangeOfDay(t, i), n = dayContentN(key), flex = isFlexDays(t), sheet = document.getElementById('sheet');
  const lastN = r && !flex ? dayContentN('d' + r.b) : 0;
  const dd = dayByKey(key) || {}; // 10.9.0 (design-forms, gap 42): the title is the day - its weekday, date and number ("חמישי 27.12 · יום 4")
  sheet.innerHTML = `${fmHead(`${dd.date && !isVirt(dd.date) ? tmFmt('day', dd.date) + SEP + 'יום ' + (TRIP_DAYS.indexOf(dd) + 1) : nameB(dd.label || '')}`, 'dmX')}
    ${!flex ? `<p class="sh-why" hidden>בטיול עם תאריכים קבועים הוספת יום דוחפת את הימים עד סוף ${r ? escH(destName(r.dest)) : 'היעד'}, ${lastN ? `והיום האחרון שלו (${escH((dayByKey('d' + r.b) || {}).label || '')}, ${lastN} בתוכנית) יוצא ל"מחוץ לטיול".` : `והיום האחרון שלו${r ? ` (${escH((dayByKey('d' + r.b) || {}).label || '')})` : ''} יוצא מהטיול. הוא ריק, ולכן לא נשמר ב"מחוץ לטיול".`}</p>` : ''}
    <div class="ta-list" data-ref="day:${key}"><button type="button" class="ta-item t-wrap" data-act="dayMenu.do" data-v="before">＋ יום לפני</button><button type="button" class="ta-item t-wrap" data-act="dayMenu.do" data-v="after">＋ יום אחרי</button>
    <button type="button" class="ta-item t-wrap" data-act="dayMenu.do" data-v="dup"${!n ? ' disabled' : ''}>⧉ שכפול היום <small>יום נוסף אחריו, עם אותם מקומות</small></button>
    ${ARRANGE_DAYS ? '' : `<button type="button" class="ta-item t-wrap" data-act="dayMenu.do" data-v="arrange">↕️ סידור ימים</button>`}
    <button type="button" class="ta-item t-wrap ta-del" data-act="dayMenu.do" data-v="park">📦 הוצאה מהטיול${n ? ` <small>${n} בתוכנית יחכו ב"מחוץ לטיול"</small>` : ''}</button></div>`; // 10.4.0 (design-4): the destructive row last, in red
  openSheet('dayMenu');
}
act('dayMenu.do', c => { const key = c.ref.id, k = c.v, b = c.el, t = activeTripObj(), i = dayIdx(key), r = rangeOfDay(t, i), flex = isFlexDays(t), lastN = r && !flex ? dayContentN('d' + r.b) : 0;
  const go = () => { closeSheet();
    if (k === 'before') insertDayAt(key, false); else if (k === 'after') insertDayAt(key, true); else if (k === 'dup') dupDayAt(key); else if (k === 'park') parkDayAt(key);
    else if (k === 'arrange') { ARRANGE_DAYS = true; return 'redraw'; } };
  if (!flex && (k === 'before' || k === 'after' || k === 'dup') && lastN && !(k !== 'before' && i === r.b)) // 10.13.0 (gap 47): the last day of the destination leaves - asked in the dialog
    return askSure({ ic: 'event_busy', title: `${dayLabelOf('d' + r.b)} ייצא מהטיול`, text: `זה היום האחרון ב${escH(destName(r.dest))}, ויש בו ${lastN} בתוכנית. הוא יחכה ב"מחוץ לטיול".`, ok: k === 'dup' ? 'שכפול' : 'הוספת יום', fill: true }, go);
  return go(); });
var ARRANGE_DAYS = false, ARR_FLASH = 0; // 4.45.1: the row that just moved flashes
act('days.arrangeDone', () => { ARRANGE_DAYS = false; appScroll(0); return 'redraw'; });
// arranging days: one row per day, dragged by ⠿ inside its destination (TOUCH 'drag'); ⋯ opens the plan's day menu (10.12.0)
gestureOn('drag', '.arr-row', { grip: '.g-grip', items: '.arr-row', zones: r => [r.closest('.arr-seg')],
  drop: (r, to) => { const all = [...to.zone.querySelectorAll('.arr-row')].map(x => +x.dataset.arri); moveDayTo(+r.dataset.arri, Math.min(...all) + to.idx); } });
function renderArrangeDays() { // 10.12.0 (design-plan, gap 58, Q16): one head, a card per destination, rows with what moves and what stays
  const t = activeTripObj(), R = segRanges(t), esc = escH, flex = isFlexDays(t);
  const trv = new Set((t.travels || []).map(x => x.id)), hasFixed = (t.schedule || []).length || trv.size, tip = !flex ? tipI('arr.dates') : hasFixed ? tipI('arr.fixed') : '';
  const dayT = (d, i) => d && d.date && !isVirt(d.date) ? `${tmFmt('day', d.date)}${SEP}יום ${i}` : d ? `${esc(d.label || '')}${/^יום /.test(d.label || '') ? '' : SEP + 'יום ' + i}` : 'יום ' + i;
  let h = `<div class="arr-top"><h2>סידור ימים${tip ? ' ' + tip : ''}</h2><button class="btn-nav" data-act="days.arrangeDone">סיום</button></div><p class="sh-hint arr-line">מזיזים יום בתוך היעד שלו, עם התוכנית בו.</p><div class="arr-list">`;
  R.forEach((r, ri) => { const d0 = dayByKey('d' + r.a);
    if (ri) h += `<div class="arr-pass">${msi(passIcon(t, d0 && d0.date), { size: 16 })}מעבר ביום ${r.a}${d0 && d0.date && !isVirt(d0.date) ? SEP + tmFmt('day', d0.date) : ''}</div>`;
    h += `<div class="arr-dest">${withFlag(destFlag(r.dest), esc(destName(r.dest)))}<small>· ${r.b - r.a + 1} ימים</small></div><div class="arr-seg">`;
    for (let i = r.a; i <= r.b; i++) { const key = 'd' + i, d = dayByKey(key), all = dayIds(STATE.itinerary[key]), ids = all.filter(id => !trv.has(id)), names = ids.map(id => (planItem(id) || {}).name).filter(Boolean);
      const nSched = d ? scheduleOf(d.date).length : 0, nFly = all.length - ids.length;
      const ln = (ic, tx, cls) => `<small class="arr-ln${cls ? ' ' + cls : ''}">${ic}<span${tx.includes('class="nm"') ? ' class="head-t"' : ''} data-act="txt.full">${tx}</span></small>`; // a cut line shows whole on a tap; the names are their own box (nameB): cut at the list's end, whatever its direction
      h += `<div class="arr-row${ARR_FLASH === i ? ' arr-flash' : ''}" data-arri="${i}" data-arrseg="${r.i}" data-ref="day:${key}"><span class="arr-h g-grip" aria-label="גרירה">⠿</span><div class="arr-t"><b>${dayT(d, i)}</b>`
        + ln(msi('list_alt', { cls: 'msi-in' }), ids.length ? `<span class="head-f">${ids.length} בתוכנית: </span>${nameB(names.slice(0, 3).join(', ') + (names.length > 3 ? '…' : ''))}` : 'אין תוכנית שלכם')
        + (nSched ? ln(msi('groups', { cls: 'msi-in' }), `${TX.group} ${nSched}`) : '') + (nFly ? ln(msi('lock', { cls: 'msi-in' }), `${nFly === 1 ? 'נסיעה אחת נשארת' : nFly + ' נסיעות נשארות'} בתאריך`) : '')
        + `</div><button type="button" class="icon-btn arr-more" data-act="day.menu" aria-label="פעולות היום">${msi('more_horiz')}</button></div>`; } h += '</div>'; });
  h += `</div>${parkedHTML()}`;
  const main = document.getElementById('main'); main.innerHTML = h;
  ARR_FLASH = 0;
}


function tripHasDated(t) { const td = STATE.tripData[t.id] || {}; return (t.travels || []).length + (t.lodging || []).length + (t.schedule || []).length + Object.values((t.id === STATE.activeTrip ? STATE.bookings : td.bookings) || {}).filter(b => b.date).length; }


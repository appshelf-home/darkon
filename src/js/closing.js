// ================= 4.29.0: CLOSING A TRIP =================
// After the trip a "ברוכים השבים" card replaces the "today" card; "🗄️ סגירת הטיול" opens a guided flow where every step is
// optional and "לסגור עכשיו" is always there: 📥 a companion's marks, ✓ where I was, 👍 how it was (❤️/👍/👎 + a word),
// ✨ highlights, 🔧 fixes to the destination, 🗄️ summary and close. Ratings can be given on a place's card during the trip too.
var CLOSING;       // { id, step }
var TRIP_HIDDEN;   // places hidden only in the active trip (👎 imported from a past trip)
var _pastRateCache = null;
const RATE = { love: '❤️', like: '👍', dislike: '👎' }, RATE_LABEL = { love: 'אהבתי', like: 'היה טוב', dislike: 'לא שווה' };
function tdOf(id) { if (id === STATE.activeTrip) stashActive(); return STATE.tripData[id] = STATE.tripData[id] || { favorites: [], visited: [], itinerary: {}, times: {}, planItems: {} }; }
function tdSave(id) { if (id === STATE.activeTrip) loadPersonal(id); persist(); }
function ratingOf(pid, id) { const td = id ? tdOf(id) : (STATE.tripData[STATE.activeTrip] || {}); return (td.rating || {})[pid] || null; }
function setRating(id, pid, r, word) {
  const td = tdOf(id);
  td.rating = { ...(td.rating || {}) }; const cur = td.rating[pid] || {};
  if (r === undefined) r = cur.r; if (r === cur.r && word === undefined) delete td.rating[pid]; else td.rating[pid] = { r, ...(word !== undefined ? (word ? { w: word } : {}) : (cur.w ? { w: cur.w } : {})) };
  if (td.rating[pid] && !td.rating[pid].r) delete td.rating[pid];
  tdSave(id); _pastRateCache = null;
}
// ⭐ on a place's card, during the trip and after it: ❤️ / 👍 / 👎 for a place I visited
function rateRowHTML(p) {
  const t = activeTripObj(), st = tripState(t); if (!t.id || ARCHIVE_VIEW || !(st === 'during' || st === 'ended') || !STATE.visited.has(p.id)) return '';
  const cur = ratingOf(p.id) || {};
  return `<div class="rate-row" data-ref="place:${p.id}"><span>איך היה?</span>${Object.keys(RATE).map(k => `<button type="button" class="rate-btn" data-act="place.rate" data-v="${k}" aria-pressed="${cur.r === k}" title="${RATE_LABEL[k]}">${RATE[k]}</button>`).join('')}${cur.w ? `<small>"${_qe(cur.w)}"</small>` : ''}</div>`;
}
// what I said about a place in a past trip (archived), shown small on its card in a new trip
function pastRatingFor(pid) {
  if (!_pastRateCache) { _pastRateCache = new Map();
    Object.values(STATE.trips).filter(t => t.archived && t.archived.reason !== 'cancelled').sort((a, b) => String(a.end).localeCompare(String(b.end))).forEach(t => {
      Object.entries((STATE.tripData[t.id] || {}).rating || {}).forEach(([k, v]) => _pastRateCache.set(Number(k), { ...v, year: String(t.end || '').slice(0, 4), trip: t.name, tid: t.id })); }); }
  const v = _pastRateCache.get(pid); return v && v.tid !== STATE.activeTrip ? v : null;
}
function pastRateTagHTML(p) { const v = pastRatingFor(p.id); return v ? `<button type="button" class="badge past-rate" data-act="place.pastRate" data-v="${p.id}">${v.year} ${RATE[v.r] || ''}</button> ` : ''; }
// 4.37.0: the same tag, small, in the plan's cards and the map's floating card (it was only in the full card)
function pastRateBase(p) { return !p ? null : p.dup ? copyRef(p.id) : p.planOnly ? null : p.id; } // 4.37.2: a duplicate shows its original's rating
function pastRateMiniHTML(p) { const id = pastRateBase(p); if (id == null) return ''; const v = pastRatingFor(id); return v ? `<span class="past-rate past-mini" data-act="place.pastRate" data-v="${id}">${v.year} ${RATE[v.r] || ''}</span>` : ''; }
act('place.rate', c => { const pid = Number(c.ref.id), r = c.v, cur = ratingOf(pid) || {};
  setRating(STATE.activeTrip, pid, cur.r === r ? null : r);
  showUndoToast(cur.r === r ? 'הדירוג הוסר' : `${RATE[r]} ${RATE_LABEL[r]}: ${placeName(pid)}`); });
act('place.pastRate', c => { const v = pastRatingFor(Number(c.v)); if (v) showToast(`בטיול "${String(v.trip).split(' · ')[0]}" (${v.year}): ${RATE[v.r]} ${RATE_LABEL[v.r]}${v.w ? `${SEP}"${v.w}"` : ''}`); });

// ---- the welcome-back card (after the trip, instead of "today" and the weather) ----
function welcomeBackHTML(t) {
  if (t.archived || ARCHIVE_VIEW) return ''; // 11.37.0 (phone-round-4-fixes P2, G84): a memory is closed - its full view offers no closing
  const td = tdOf(t.id), co = td.closeOffer || {}; if (co.never) return '';
  const now = Date.now(), thin = (co.snoozeUntil && now < co.snoozeUntil) || (co.dismissedAt && !co.snoozeUntil && now - co.dismissedAt < 7 * 864e5);
  if (thin) return `<button type="button" class="today-card wb-thin" id="wbOpen" data-act="welcome.wbOpen">${msi('cottage', { size: 20 })}<span>${_qe(String(t.name).split(' · ')[0])} הסתיים${SEP}סגירת הטיול</span>${msi('chevron_right', { size: 20 })}</button>`;
  const days = dayList(t.start, t.end).length, vis = (td.visited || []).length, nd = tripDests(t).length, back = co.dismissedAt || co.snoozeUntil;
  return `<div class="today-card wb-card tcd-after" id="todayCard"><div class="tc-title">${msi('cottage', { size: 20 })}ברוכים השבים מ${_qe(String(t.name).split(' · ')[0])}</div>
    ${tlLateLineHTML(t)}<p class="wb-sum">${days} ימים${nd > 1 ? `${SEP}${nd} יעדים` : ''}${vis ? `${SEP}${vis} מקומות ש${TX.visited}` : ''}. סגירה קצרה (כ-3-5 דקות, כל שלב רשות) שומרת את הטיול כזיכרון: איפה ${TX.visited}, מה אהבתם ורגעי השיא - ומכינה את המזכרות.</p>
    <div class="brow export-actions"><button class="btn-nav" id="wbClose" data-act="welcome.wbClose">${msi('inventory_2', { size: 18 })} סגירת הטיול</button>${back ? '<button class="icon-btn btn-copy" id="wbSnooze" data-act="welcome.wbSnooze" style="width:auto;padding:0 12px;">דחייה בשבוע</button><button class="icon-btn btn-copy" id="wbNever" data-act="welcome.wbNever" style="width:auto;padding:0 12px;">לא להזכיר יותר</button>' : '<button class="icon-btn btn-copy" id="wbLater" data-act="welcome.wbLater" style="width:auto;padding:0 12px;">לא עכשיו</button>'}</div></div>`;
}
function welcomeBackCtl() { const ctl = ctlNS('welcome');
  const t = activeTripObj(), g = id => document.getElementById(id); if (!t.id) return;
  const set = (patch, msg) => { const td = tdOf(t.id); td.closeOffer = { ...(td.closeOffer || {}), ...patch }; tdSave(t.id); showUndoToast(msg); };
  if (g('wbOpen')) ctl.wbOpen = () => openClosingFlow(t.id);
  if (g('wbClose')) ctl.wbClose = () => openClosingFlow(t.id);
  if (g('wbLater')) ctl.wbLater = () => set({ dismissedAt: Date.now() }, 'בסדר. הכרטיס יחזור בעוד שבוע');
  if (g('wbSnooze')) ctl.wbSnooze = () => set({ snoozeUntil: Date.now() + 7 * 864e5 }, 'נזכיר בעוד שבוע');
  if (g('wbNever')) ctl.wbNever = () => set({ never: true }, 'לא נזכיר. הטיול מחכה לסגירה במסך הטיולים');
}
ctlActs('welcome', ['wbClose', 'wbLater', 'wbNever', 'wbOpen', 'wbSnooze']);

// ---- the guided flow ----
const CL_LINE = { merge: 'הסימונים של מי שטייל איתך, מקובץ', tl: 'ממלא את איפה ' + TX.visited + ' מהטלפון', where: 'מה שתכננתם ועוד לא סומן', rate: 'דירוג ומילה לכל מקום', high: 'עד 5 רגעים שהכי זכורים', fixes: 'השינויים שלכם ביעדים', done: 'הטיול עובר לזיכרונות, לקריאה בלבד' };
const CL_STEPS = [
  { k: 'merge', label: 'מי שטייל איתך' }, { k: 'tl', label: 'ציר הזמן של גוגל' }, { k: 'where', label: 'איפה ' + TX.visited }, { k: 'rate', label: 'איך היה' },
  { k: 'high', label: 'רגעי השיא' }, { k: 'fixes', label: 'תיקונים ליעד' }, { k: 'done', label: 'סיכום וסגירה' }];
function closingCtx(id) {
  const t = STATE.trips[id], td = tdOf(id);
  const pts = withTrip(id, () => POINTS.map(q => ({ ...q })));
  const pm = new Map(pts.map(q => [q.id, q])), vis = new Set(td.visited || []), nr = new Set(td.notReached || []), planned = tripPlannedIds(id, t, td);
  const where = [...planned].filter(i => pm.has(i) && !vis.has(i) && !nr.has(i)).map(i => pm.get(i)); // 11.18.0 (timeline-offers Q3): airports too
  const visited = [...vis].map(i => pm.get(i)).filter(Boolean);
  const unrated = visited.filter(p => !(td.rating || {})[p.id]);
  // 4.41.1: every edit of the trip's destinations, whenever it was made - exactly what "📤 שליחת התיקונים" sends from here
  const fixes = destFixRows(tripDests(t), pm);
  // closing-where (Q3): "הכל" = the planned places plus every place marked either way, in that order
  const all = [...new Set([...planned, ...vis, ...nr])].filter(i => pm.has(i));
  return { t, td, pm, where, visited, unrated, fixes, all };
}
// the trip's planned places: the plan's days, bookings, and (4.38.1) an organized tour's schedule and the trip's hotels (a group trip
// may have no personal plan at all) - closing's "איפה היינו" and the Timeline review's "תוכנן ולא זוהה" (11.10.0, C5) read the same.
// From the stored records only (td from tdOf, the schedule's own edits in td.planX), never withTrip: loading a closed trip as the
// active one drops the marks of places this phone no longer has (11.9.0's lesson)
function tripPlannedIds(id, t, td) {
  const planned = new Set(); Object.values(td.itinerary || {}).forEach(d => Object.values(d || {}).forEach(a => (a || []).forEach(x => { if (typeof x === 'number') planned.add(x); })));
  Object.keys(td.bookings || {}).forEach(k => planned.add(Number(k)));
  const inT = d => !t.start || !d || (d >= t.start && d <= t.end), sx = (td.planX || {}).sched || {};
  (t.schedule || []).filter(s => !(sx[s.id] || {}).hidden).map(s => { const ed = sx[s.id]; return ed && ed.ch && Object.keys(ed.ch).length ? { ...s, ...ed.ch } : s; })
    .forEach(s => { if (s.placeId != null && inT(s.date)) planned.add(Number(s.placeId)); });
  (t.lodging || []).forEach(l => { if (l.placeId != null && (!t.start || !l.checkIn || l.checkIn <= t.end)) planned.add(Number(l.placeId)); });
  return planned;
}
function closingSteps(C) {
  return CL_STEPS.filter(s => s.k === 'merge' ? !!String(C.t.travelers || '').trim() : s.k === 'tl' ? true : s.k === 'where' ? (C.where.length || C.pm.size) : s.k === 'rate' ? (C.visited.length || C.pm.size) : s.k === 'high' ? (C.visited.length || C.pm.size || (C.td.highlights || []).length) : s.k === 'fixes' ? C.fixes.length : true);
}
function openClosingFlow(id, datesSet) {
  if (ARCHIVE_VIEW) exitArchiveView(true);
  const t = STATE.trips[id]; if (!t || t.archived) return; closeSheet(); // 11.37.0 (P2, G84): a memory is never closed again
  // timeline-followups-3 (decisions 2026-11-13 review of 11.11.0, item 1): a dateless trip that happened, whose dates were just set with
  // today as its last day, goes straight to the closing steps - the dates are the answer to "חזרתם מוקדם?"; it is archived as ended
  // 11.34.0 (phone-round-3-fixes P5, G73; decisions 2026-11-20 · The open bugs of phone round 3, Q2 A): a closing already begun (kept on
  // this phone) reopens at its step even when the trip has not ended by its dates - "חזרתם מוקדם?" was already answered
  const kept = (DEV.clSteps || {})[id] || null;
  if (!kept && tripState(t) !== 'ended' && !(datesSet && t.end === todayStr() && tripState(t) === 'during')) { closeTripStart(id); return; }
  const keys = closingSteps(closingCtx(id)).map(s => s.k); // steps with content when the flow opens stay for the whole flow
  // closing-where (Q7): the closing reopens at the last step visited (kept on this phone, DEV.clSteps by trip - the registry row `views`: no undo row, not in a backup or a friend's trip file); a step gone - the next existing one after it
  let key = null; if (kept && kept.at) { const at = CL_STEPS.findIndex(s => s.k === kept.at); key = keys.includes(kept.at) ? kept.at : ((CL_STEPS.slice(at + 1).find(s => keys.includes(s.k)) || {}).k || null); }
  CLOSING = { id, step: 0, key, keys, seen: (kept && kept.seen || []).filter(k => keys.includes(k)), whereIds: null, whereView: null, tlV: null, rateIds: null, words: {} }; goTab('closing'); // 4.33.1: each list is fixed when its step first opens
}
function renderClosingScreen() {
  const main = document.getElementById('main'); if (!CLOSING || !STATE.trips[CLOSING.id]) { main.innerHTML = emptyHTML(msi('inventory_2'), 'בוחרים טיול שהסתיים במסך הטיולים, ושם "סגירת הטיול".', '', 'אין טיול בסגירה'); return; }
  const C = closingCtx(CLOSING.id), steps = CLOSING.keys ? CL_STEPS.filter(s => CLOSING.keys.includes(s.k)) : closingSteps(C);
  if (!CLOSING.key || !steps.some(s => s.k === CLOSING.key)) CLOSING.key = steps[Math.min(CLOSING.step || 0, steps.length - 1)].k;
  const i = steps.findIndex(s => s.k === CLOSING.key), s = steps[i], last = i === steps.length - 1;
  // closing-where (Q7): the step and the steps visited, kept on this phone (a device choice: no undo row, not in a backup or a friend's trip file)
  CLOSING.seen = CLOSING.seen || []; if (!CLOSING.seen.includes(s.k)) CLOSING.seen = CLOSING.seen.concat(s.k);
  { const was = (DEV.clSteps || {})[CLOSING.id] || {}; if (was.at !== s.k || (was.seen || []).length !== CLOSING.seen.length) devSet({ clSteps: { ...(DEV.clSteps || {}), [CLOSING.id]: { at: s.k, seen: CLOSING.seen.slice() } } }); }
  let body = '';
  if (s.k === 'merge') body = `<p>טיילתם עם עוד מישהו שגם סימן באפליקציה? אפשר לצרף את הסימונים שלו: הוא שולח את קובץ הטיול (⋯ ← ${msi('ios_share', { cls: 'msi-in' })} שיתוף ← ${msi('description', { cls: 'msi-in' })} קובץ הטיול, עם ✓ ${TX.visited} ודירוגים), ואתם פותחים אותו כאן. "${TX.visited}" מתאחד, דירוגים נשמרים לפי שם (❤️ ערן${SEP}👍 אירית), ורגעי השיא משתי הרשימות. רשות - אפשר לדלג.</p>
    ${Object.keys(C.td.companions || {}).length ? `<div class="callout">צורפו: ${Object.entries(C.td.companions).map(([n, x]) => `<b>${_qe(n)}</b> (${(x.visited || []).length} ביקורים, ${Object.keys(x.rating || {}).length} דירוגים)`).join(SEP)}</div>` : ''}
    <div class="brow export-actions">${importDoorHTML('closing', msi('file_open', { size: 18 }) + ' פתיחת הקובץ')}</div>`;
  // 11.9.0 (timeline-import, Q2): the optional step that fills "where" - the file chooser, "איך מייצאים", the privacy line; skippable
  // 11.10.0 (C8): a trip without dates shows the step too - the line and a button to choose the dates (tlDoorsHTML)
  if (s.k === 'tl') body = `<p>${tipText('tl.why')}</p>${tlOf(C.t.id) ? `<div class="callout">${msi('check_circle', { size: 18, cls: 'msi-in' })} כבר יובא: ${tlOf(C.t.id).n} ימים. קובץ חדש קורא אותם שוב.</div>` : ''}
    ${tlDoorsHTML(C.t.id)}`;
  if (s.k === 'where' && tlOf(C.t.id)) { // 11.9.0: after an import, the review by day (picture "איפה היינו"); closing-where: its view and added rows in CLOSING.tlV
    body = `${tlSummaryHTML(C.t.id)}${tlReviewHTML(C.t.id, CLOSING.tlV = CLOSING.tlV || {})}${whereMoreRowHTML()}`; }
  else if (s.k === 'where') { // closing-where (Q2, Q3): one mark on every row; "עוד לא סומנו" | "הכל" - the rows fixed when the view is drawn first (4.33.1: a row marked stays, with its state)
    // 11.34.0 (phone-round-3-fixes P15, G72; decisions 2026-11-20 · "היינו בהכל", Q1-Q2): the mark-all button on the switcher's line, at its
    // other end - a small secondary button; with no room it wraps under the switcher at the far end. "✓ היינו בהכל" while no row of the view
    // is marked, "✓ היינו בכל השאר" once some are; it marks only the unmarked rows (never a "לא הגענו" row)
    const vs = new Set(C.td.visited || []), ns = new Set(C.td.notReached || []), mk = i => vs.has(i) || ns.has(i);
    if (!CLOSING.whereView) CLOSING.whereView = C.where.length ? 'un' : 'all';
    if (!CLOSING.whereIds) CLOSING.whereIds = CLOSING.whereView === 'un' ? C.where.map(p => p.id) : C.all.slice();
    const rows = CLOSING.whereIds.map(i => C.pm.get(i)).filter(Boolean), open = rows.filter(p => !mk(p.id)).length;
    body = `<p>מקומות שתכננתם, שיבצתם, שהיו ב${TX.group} או שלנתם בהם. ${TX.visited} שם? (גם החלקה: ימינה = ${TX.visited}, שמאלה = לא הגענו). נגיעה נוספת מבטלת.</p>
    ${C.all.length ? `<div class="cl-viewline">${fmMarkView({ act: 'closing.clView', view: CLOSING.whereView, nUn: C.where.length, nAll: C.all.length })}${rows.length && open ? `<button type="button" class="icon-btn btn-copy cl-allvis" id="clAllVis" data-act="closing.clAllVis">✓ ${TX.visited} ${open === rows.length ? 'בהכל' : 'בכל השאר'}</button>` : ''}</div>` : ''}
    ${rows.length ? '' : C.all.length ? `<div class="callout">✓ הכל סומן. ב"הכל" אפשר לתקן.</div>` : `<div class="callout">אין מקומות מתוכננים. מקום ש${TX.visited} בו - ב"＋ עוד מקום" למטה.</div>`}<div class="cl-list">${rows.map(p => `<div class="cl-row g-swipe" data-ref="place:${p.id}"><span>${msiTie(typeIcon(p.icon, { size: 18, cls: 'msi-in' }), _qe(p.name))}</span>${fmMark({ act: 'closing.clvis', on: vs.has(p.id), no: ns.has(p.id) })}</div>`).join('')}</div>
    ${whereMoreRowHTML()}`; }
  if (s.k === 'rate') { CLOSING.rateIds = clRateIds(CLOSING.rateIds, C); // 4.34.2: every place you were at, the unrated first; 11.23.2 (P4): whenever the step shows
    const rl = CLOSING.rateIds.map(i => C.pm.get(i)).filter(Boolean), rt = C.td.rating || {};
    body = `<p>איך היה? כל המקומות ש${TX.visited} בהם - קודם אלה שעוד לא דורגו. הערה - רשות, ונשמרת עם הדירוג. נגיעה נוספת באותו סימן מבטלת.</p>
    ${rl.length ? '' : '<div class="callout">עוד לא סומן אף מקום. מסמנים בשלב "✓ איפה ' + TX.visited + '".</div>'}<div class="cl-list">${rl.map(p => { const comp = Object.entries(C.td.companions || {}).map(([n, x]) => (x.rating || {})[p.id] ? `${RATE[x.rating[p.id].r]} ${_qe(n)}` : '').filter(Boolean).join(SEP);
      const cr = rt[p.id] || {}, wv = cr.w != null ? cr.w : (CLOSING.words[p.id] || '');
      return `<div class="cl-row cl-rate" data-ref="place:${p.id}"><span>${msiTie(typeIcon(p.icon, { size: 18, cls: 'msi-in' }), _qe(p.name))}${comp ? `<small>${comp}</small>` : ''}</span><span class="cl-rbtns">${Object.keys(RATE).map(k => `<button type="button" class="rate-btn" data-act="closing.clrate" data-clrate="${k}" aria-pressed="${cr.r === k}" title="${RATE_LABEL[k]}">${RATE[k]}</button>`).join('')}</span>${fmArea({ cls: 'cl-word', rows: 1, max: 400, placeholder: 'הערה (רשות)', value: wv })}</div>`; }).join('')}</div>`; }
  if (s.k === 'high') { const hs = C.td.highlights || [];
    body = `<p>עד 5 רגעים שהכי זכורים לכם. משפט קצר - רשות. הם יופיעו בזיכרון ובמזכרות.</p><div class="cl-list" id="clHigh">${hs.map((h, j) => highlightRowHTML(C, h, j)).join('')}</div>
      ${hs.length < 5 ? '<div class="brow export-actions"><button class="icon-btn btn-copy" id="clHighAdd" data-act="closing.clHighAdd" style="width:auto;padding:0 12px;">＋ רגע שיא</button></div>' : ''}${typeof highlightExtrasHTML === 'function' ? highlightExtrasHTML(C) : ''}`; }
  if (s.k === 'fixes') body = `<p>כל השינויים שלכם ביעדים של הטיול (${tripDests(C.t).map(d => _qe(destName(d))).join(', ')}), מתי שנעשו. הם כבר אצלכם ויישארו גם בטיולים הבאים. כדי שגם אחרים יקבלו אותם - שולחים את קובץ הטיול למי שבנה את היעד, או לשיפור עם ${AI} כדי שיעדכן את קובץ היעד.</p>
    <div class="cl-list">${C.fixes.map(f => `<div class="cl-row"><span>${_qe(f.name)}${f.at ? ` <small>${tmFmt('date', f.at)}</small>` : ''}</span><small>${f.what}</small></div>`).join('')}</div>
    <div class="brow export-actions"><button class="btn-nav" id="clSendFix" data-act="closing.clSendFix">${msi('description', { size: 18 })} קובץ הטיול ${claudeMark()} לשיפור</button></div>`;
  if (s.k === 'done') { const r = Object.values(C.td.rating || {});
    body = `<p><b>מה נשמר:</b> ${C.visited.length} מקומות ש${TX.visited}${r.length ? `, ${r.length} דירוגים (${['love', 'like', 'dislike'].map(k => r.filter(x => x.r === k).length + ' ' + RATE[k]).join(' ')})` : ''}${(C.td.highlights || []).length ? `, ${C.td.highlights.length} רגעי שיא` : ''}, התוכנית כפי שהייתה, ותמונת מצב של כל המקומות שהטיול נגע בהם. הטיול עובר לזיכרונות, לקריאה בלבד, ונפתח במסך זיכרון; ${msi('undo', { cls: 'msi-in' })} פתיחה מחדש מחזירה אותו.</p>
      ${window.caches ? `<label class="bk-part">${fmCheck({ id: 'clFree', checked: true })} לפנות מהמכשיר אריחי מפה ותמונות "${msi('auto_stories', { cls: 'msi-in' })} מה יש כאן" ששמורים <small>נטענים שוב מהרשת כשצריך. הסימונים, התוכנית והזיכרון לא נמחקים.</small></label>` : ''}
      ${typeof OFF_PACKS !== 'undefined' && OFF_PACKS[C.t.id] ? `<label class="bk-part">${fmCheck({ id: 'clOffDel', checked: true })} למחוק את מפות הטיול מהטלפון (${offMBh(OFF_PACKS[C.t.id].have.bytes)}) <small>המפות שהורדו לשימוש בלי רשת. חלק שמשמש טיול אחר נשאר.</small></label>` : ''}
      <div class="brow export-actions"><button class="btn-nav" id="clArchive" data-act="closing.clArchive">${msi('inventory_2', { size: 18 })} סגירת הטיול</button></div>`; }
  // 10.3.0 (design-3, look.md "Full screens, part 2"): a warm header and a vertical stepper showing every step - done ones green with
  // their summary, the current one open, the next ones with a line of what they hold; ✕ in the head = later; "לסגור עכשיו" at the foot
  const sum = x => { const td = C.td; return x.k === 'merge' ? (Object.keys(td.companions || {}).length ? 'צורפו: ' + Object.keys(td.companions).map(_qe).join(', ') : 'דילגתם')
    : x.k === 'tl' ? (tlOf(C.t.id) ? `${tlOf(C.t.id).n} ימים${SEP}${fmtKm(tlKm(C.t.id))} ברגל` : 'דילגתם') : x.k === 'where' ? `${(td.visited || []).length} מקומות ש${TX.visited} בהם` : x.k === 'rate' ? `${Object.keys(td.rating || {}).length} דירוגים` : x.k === 'high' ? `${(td.highlights || []).length} רגעי שיא` : x.k === 'fixes' ? `${C.fixes.length} שינויים ביעדים` : ''; };
  const seen = x => CLOSING.seen.includes(x.k); // closing-where (Q7): ✓ = a step visited (not "everything marked")
  const step = (x, j) => `<div class="cl-vs" data-st="${j === i ? 'cur' : seen(x) ? 'done' : ''}"><button type="button" class="cl-vh" data-act="closing.clstep" data-clstep="${x.k}"><span class="sb-n">${j !== i && seen(x) ? msi('check', { size: 18 }) : j + 1}</span><span class="cl-vt"><b>${x.label}</b>${j === i ? '' : `<small>${seen(x) ? sum(x) : CL_LINE[x.k] || ''}</small>`}</span></button>${j === i ? `<div class="cl-step">${body}</div>` : ''}</div>`;
  main.innerHTML = `<div class="section-head cl-head"><h2>סוגרים את הטיול ${tipI('trips.ended')}</h2><p>${_qe(String(C.t.name).split(' · ')[0])}</p><p class="cl-sub">3–5 דקות${SEP}כל שלב רשות${SEP}✕ = ממשיכים אחר כך</p></div>
    <div class="card cl-stepper">${steps.map(step).join('')}</div>
    <div class="cl-nav"><button type="button" class="link-btn" id="clNow" data-act="closing.clNow">${msi('inventory_2', { size: 18 })} <span class="lk-tx">לסגור עכשיו, בלי שאר השלבים</span></button>${last ? '' : `<button class="btn-nav" id="clNext" data-act="closing.clNext">${s.k === 'merge' || (s.k === 'tl' && !tlOf(C.t.id)) ? 'דילוג' : 'הבא'} ${msi('chevron_right', { size: 18 })}</button>`}</div>`;
  closingCtl(C, steps, i);
}
function highlightRowHTML(C, h, j) {
  return `<div class="cl-row cl-high" data-hi="${j}"><span class="cl-hn">${j + 1}</span>${fmSelect({ data: 'data-hplace', value: h.placeId == null ? '' : h.placeId, options: [['', '— בלי מקום'], ...C.visited.map(p => [p.id, _qe(p.name)])] })}
    ${fmInput({ data: 'data-htext', max: 120, value: h.text || '', placeholder: 'משפט קצר (רשות)' })}${typeof highlightPhotoHTML === 'function' ? highlightPhotoHTML(h) : ''}<button type="button" class="sheet-x" data-act="closing.hdel" data-hdel aria-label="הסרה">✕</button></div>`;
}
function closingCtl(C, steps, i) { const ctl = ctlNS('closing');
  const id = CLOSING.id, g = q => document.getElementById(q), main = document.getElementById('main');
  const goStep = k => { CLOSING.key = k; CLOSING.step = steps.findIndex(s => s.k === k); if (k === 'where') { CLOSING.whereIds = null; CLOSING.whereView = null; CLOSING.tlV = null; } // closing-where (Q3): the step drawn again - its default view, its rows anew
    renderClosingScreen(); appScroll(0); };
  ctl.clView = b => { CLOSING.whereView = b.dataset.v; CLOSING.whereIds = null; return 'redraw'; }; // the other view: its rows fixed anew
  ctl.clstep = b => goStep(b.dataset.clstep);
  if (g('clNext')) ctl.clNext = () => goStep(steps[i + 1].k);
  ctl.clNow = () => { CLOSING = null; archiveTrip(id, 'ended'); };
  const mark = (pid, v, off) => { const td = tdOf(id);
    td.visited = (td.visited || []).filter(x => x !== pid); td.notReached = (td.notReached || []).filter(x => x !== pid); // 4.33.1: one state per row, a second tap clears it
    if (!off) { if (v) td.visited = [...td.visited, pid]; else td.notReached = [...td.notReached, pid]; } tdSave(id); };
  ctl.clvis = b => { const pid = Number(refOf(b).id), v = b.dataset.clvis === '1', off = b.getAttribute('aria-pressed') === 'true';
    mark(pid, v, off); showUndoToast(`${off ? 'בוטל' : v ? '✓ ' + TX.visited : '✕ לא הגענו'}: ${placeName(pid) || C.pm.get(pid).name}`); };
  if (g('clAllVis')) ctl.clAllVis = () => { const td = tdOf(id), prev = [...(td.visited || [])], nr = new Set(td.notReached || []), add = (CLOSING.whereIds || []).filter(x => !prev.includes(x) && !nr.has(x));
    td.visited = [...new Set([...prev, ...add])]; tdSave(id);
    showUndoToast(`✓ ${add.length} סומנו "${TX.visited}"`); };
  main.querySelectorAll('.cl-rate').forEach(row => { const pid = Number(refOf(row).id), w = row.querySelector('.cl-word');
    const paint = () => { const cr = ratingOf(pid, id) || {}; row.querySelectorAll('[data-clrate]').forEach(x => x.setAttribute('aria-pressed', String(cr.r === x.dataset.clrate))); };
    // 4.33.1: no re-render - the row stays, the other rows keep what was typed in them
    const grow = () => { w.style.height = 'auto'; w.style.height = w.scrollHeight + 'px'; }; grow(); // 4.34.2: grows with the text
    w.addEventListener('input', () => { CLOSING.words[pid] = w.value; grow(); });
    w.dataset.act = 'closing.word'; }); // the word is saved on leaving the field
  const rowOf = b => { const row = b.closest('.cl-rate'), pid = Number(refOf(row).id), w = row.querySelector('.cl-word');
    const paint = () => { const cr = ratingOf(pid, id) || {}; row.querySelectorAll('[data-clrate]').forEach(x => x.setAttribute('aria-pressed', String(cr.r === x.dataset.clrate))); }; return { row, pid, w, paint }; };
  ctl.clrate = b => { const { pid, w, paint } = rowOf(b), k = b.dataset.clrate, cr = ratingOf(pid, id) || {}, off = cr.r === k;
    setRating(id, pid, off ? null : k, off ? undefined : w.value.trim()); if (!off) delete CLOSING.words[pid]; paint(); // the word is data now: an undo shows the word it brings back
    showUndoToast(off ? `הדירוג הוסר: ${C.pm.get(pid).name}` : `${RATE[k]} ${C.pm.get(pid).name}`); return 'quiet'; };
  ctl.word = w => { const { pid } = rowOf(w), cr = ratingOf(pid, id), v = w.value.trim(); if (!cr || !cr.r || (cr.w || '') === v) return 'quiet';
    setRating(id, pid, cr.r, v); delete CLOSING.words[pid]; showUndoToast(`${RATE[cr.r]} ${C.pm.get(pid).name}: ${v ? `"${v}"` : 'בלי מילה'}`); return 'quiet'; }; // undo-history: a saved word is a row
  const hl = g('clHigh');
  const saveHigh = () => { const td = tdOf(id); td.highlights = [...hl.querySelectorAll('[data-hi]')].map((r, j) => ({ ...((td.highlights || [])[+r.dataset.hi] || {}), placeId: r.querySelector('[data-hplace]').value ? Number(r.querySelector('[data-hplace]').value) : null, text: r.querySelector('[data-htext]').value.trim() })); tdSave(id); };
  ctl.saveHigh = el => { const before = JSON.stringify(tdOf(id).highlights || []); saveHigh(); if (JSON.stringify(tdOf(id).highlights || []) === before) return 'quiet'; // undo-history: a saved highlight is a row
    const r = el && el.closest('[data-hi]'), h = r ? (tdOf(id).highlights || [])[+r.dataset.hi] || {} : {}, nm = h.placeId != null && C.pm.get(h.placeId) ? C.pm.get(h.placeId).name : '';
    showUndoToast(`✨ רגע השיא נשמר${nm || h.text ? ': ' + (nm || h.text) : ''}`); return 'quiet'; };
  if (hl) { hl.querySelectorAll('.fm-sel').forEach(el => { el.dataset.sact = 'closing.saveHigh'; }); hl.querySelectorAll('input[type="text"]').forEach(el => { el.dataset.act = 'closing.saveHigh'; }); // 11.4.0: the place is the app's choice field
    ctl.hdel = b => { saveHigh(); const td = tdOf(id), j = +b.closest('[data-hi]').dataset.hi; td.highlights.splice(j, 1); tdSave(id);
      showUndoToast('רגע השיא הוסר'); }; }
  if (g('clHighAdd')) ctl.clHighAdd = () => { if (hl) saveHigh(); const td = tdOf(id); td.highlights = (td.highlights || []).concat({ id: 'h' + Date.now().toString(36), placeId: null, text: '' }); tdSave(id); showUndoToast('✨ נוסף רגע שיא'); }; // undo-history: a row (with what was typed before it)
  if (typeof hlExtrasCtl === 'function') hlExtrasCtl(C, id);
  if (g('clSendFix')) ctl.clSendFix = () => openTripFile(id, 'improve'); // 8.0.0 (ק12, ה15): the trip file window, "✳ לשיפור" chosen
  if (g('clArchive')) ctl.clArchive = async () => { const free = g('clFree') && g('clFree').checked; g('clArchive').disabled = true; CLOSING = null;
    if (free) { await regCacheDrop('darkon-tiles'); await regCacheDrop(DISC_IMG_CACHE); DISC.imgs = []; discSave(); }
    if (g('clOffDel') && g('clOffDel').checked) { try { await offDeletePack(id, true); } catch (e) {} } // 4.39.0
    archiveTrip(id, 'ended'); };
}
// 4.33.1 → 9.7.0 (Q9b): a swipe on a "where I was" row is a shortcut to its buttons (TOUCH 'swipe'): right = ✓ היינו, left = ✕ לא הגענו;
// past the threshold that button looks pressed; toward the state already set nothing moves (clearing stays a tap on the button)
const clSwipeBtn = (row, dir) => row.querySelector(`.cl-vbtn[data-clvis="${dir > 0 ? 1 : 0}"]`);
gestureOn('swipe', '.cl-row.g-swipe', { can: (row, dir) => clSwipeBtn(row, dir).getAttribute('aria-pressed') !== 'true',
  preview: (row, dir, on) => clSwipeBtn(row, dir).classList.toggle('g-prev', on), done: (row, dir) => clSwipeBtn(row, dir).click() });
// phone-round-2b-fixes P4 (11.23.2): "איך היה" lists every place marked "היינו" whenever the step shows - the rows already shown keep their order (a row never jumps while typing, 4.33.1 / 4.34.2), places marked since come after them (the unrated first), places unmarked since leave
function clRateIds(prev, C) { const un = new Set(C.unrated.map(p => p.id)), all = [...C.unrated, ...C.visited.filter(p => !un.has(p.id))].map(p => p.id), inAll = new Set(all), kept = (prev || []).filter(i => inAll.has(i)), had = new Set(kept);
  return kept.concat(all.filter(i => !had.has(i))); }
// undo-history: "where I was" keeps its rows while the step is open (CLOSING.whereIds, the review's V.add - not data) - a place added from
// "＋ עוד מקום שהיינו בו" is in the list exactly while it is marked, so an undo of the add takes its row out and a redo brings it back
function whereAddLists() { const L = []; if (CLOSING) { if (CLOSING.whereIds) L.push([CLOSING.id, CLOSING.whereIds, CLOSING.added || []]); if (CLOSING.tlV && CLOSING.tlV.add) L.push([CLOSING.id, CLOSING.tlV.add, CLOSING.added || []]); }
  if (TL_WIN && TL_WIN_V && TL_WIN_V.add) L.push([TL_WIN, TL_WIN_V.add, TL_WIN_V.added || []]); return L; }
undoAfter(() => whereAddLists().forEach(([tid, list, added]) => { const vs = new Set((STATE.tripData[tid] || {}).visited || []);
  added.forEach(pid => { const i = list.indexOf(pid); if (vs.has(pid) && i < 0) list.push(pid); if (!vs.has(pid) && i >= 0) list.splice(i, 1); }); }));
// closing-where (Q6): "＋ עוד מקום שהיינו בו" - an action row at the end of the step's list and of the Timeline review (both doors)
function whereMoreRowHTML() { return `<div class="cl-more"><button type="button" class="link-btn" id="clMore" data-act="wmore.open">${msi('add', { size: 18 })} עוד מקום ש${TX.visited} בו</button>${tipI('closing.more')}</div>`; }
function whereCtxId() { return CLOSING && activeTab === 'closing' ? CLOSING.id : TL_WIN || null; }
act('wmore.open', () => { const id = whereCtxId(); if (id) openWhereMore(id); return 'quiet'; });
// the app's search window (a typing window, the keyboard open): "במקומות של הטיול" - the trip's places and its destinations' (a choice marks
// "היינו"), and "מקומות אחרים" - the place search of "מקום חדש", with the Google Maps link and "לבחור על המפה"; another place joins the trip
// (its name, point and Google's id when known; no time), marked "היינו". Every chosen place joins the list as a marked row; one undo row each
function openWhereMore(id, back) { const ctl = {}, sheet = document.getElementById('sheet'), t = STATE.trips[id]; if (!t) return; // back: the window as left before Google Maps, and the shared place (PS_FORMS.where)
  sheet.innerHTML = `${fmHead(`＋ עוד מקום ש${TX.visited} בו`, 'wmX')}
    <div class="tp-search">${fmSearch({ id: 'wmQ', enter: true, placeholder: 'שם מקום', clear: { id: 'wmQx', act: 'wmore.wmQx' } })}<button type="button" class="btn-nav" id="wmGo" data-act="wmore.wmGo">חיפוש</button></div>
    <div id="wmIn"></div><div id="wmOut"></div>`;
  const $ = q => sheet.querySelector(q), q = $('#wmQ'), pl = tlPlaceList(id), c0 = (DESTS[tripDests(t)[0]] || { meta: {} }).meta.center;
  const row = pid => { const td = tdOf(id), L = CLOSING && CLOSING.id === id && activeTab === 'closing' ? (tlOf(id) ? (CLOSING.tlV = CLOSING.tlV || {}) : null) : (TL_WIN_V = TL_WIN_V || {});
    if (L) { L.add = (L.add || []).concat(pid); if (!CLOSING || CLOSING.id !== id || activeTab !== 'closing') L.added = (L.added || []).concat(pid); }
    if (CLOSING && CLOSING.id === id && activeTab === 'closing') { if (!L) CLOSING.whereIds = (CLOSING.whereIds || []).concat(pid); CLOSING.added = (CLOSING.added || []).concat(pid); } };
  const mark = (pid, nm) => { const td = tdOf(id); td.notReached = (td.notReached || []).filter(x => x !== pid); td.visited = (td.visited || []).filter(x => x !== pid).concat(pid); tlSyncVisits(id, td); tdSave(id);
    closeSheet(); showUndoToast(`✓ ${TX.visited}: ${nm}`); redrawSoon(); };
  const inTrip = p => { const was = (tdOf(id).visited || []).includes(p.id); row(p.id); if (was) { closeSheet(); showToast(`✓ ${TX.visited}: ${p.name}${SEP}כבר סומן`); redrawSoon(); return; } mark(p.id, p.name); };
  const outside = x => { const pid = tlTripPlace(id, { name: x.name || 'מקום על המפה', ll: { lat: +x.coord.lat, lng: +x.coord.lng }, gid: x.rec ? gidNew(x.rec, 'user') : null }); // a shared Google Maps link carries Google's id (as "מקום חדש" from a link)
    if (pid == null) { showToast('אין יעד לטיול'); return; } row(pid); mark(pid, x.name || 'מקום על המפה'); };
  const door = CLOSING && CLOSING.id === id && activeTab === 'closing' ? 'closing' : 'memory', wmRet = () => ({ k: 'where', id, door, keep: { q: q.value } }); // form-keep: the window comes back after a share from Google Maps
  const ps = psHost({ box: () => $('#wmOut'), near: () => c0 || undefined, pick: outside, ret: wmRet, draw: H => { const b = $('#wmOut'); if (b && b.isConnected) b.innerHTML = H.st ? `<div class="gl-dh">${msi('travel_explore', { size: 16 })} מקומות אחרים</div>${psHTML(H)}` : ''; },
    map: () => { const H = PS_HOSTS[ps]; if (H) H.st = null; $('#wmOut').innerHTML = ''; const s0 = c0 || [32, 34.8]; openPick({ how: 'btn', has: false, start: s0, zoom: 13, ret: wmRet, onPick: r => outside({ name: q.value.trim() || r.name, coord: r.coord }) }); } });
  q.dataset.ps = ps;
  const draw = () => { const v = q.value.trim(), vs = new Set(tdOf(id).visited || []), hits = v ? pl.filter(p => searchHit(p, v)).slice(0, 8) : [];
    $('#wmQx').hidden = !q.value; $('#wmIn').innerHTML = !v ? '' : `<div class="gl-dh">${msi('luggage', { size: 16 })} במקומות של הטיול</div><div class="cl-add-res">${hits.length ? hits.map(p => `<button type="button" class="cl-add-hit" data-act="wmore.pick" data-ref="place:${p.id}">${typeIcon(p.icon, { size: 18 })} ${_qe(p.name)}${vs.has(p.id) ? ' <small>✓ כבר סומן</small>' : ''}</button>`).join('') : '<small class="sh-hint">לא נמצא במקומות של הטיול</small>'}</div>`;
    markSearch($('#wmIn'), v); psTyping(ps, v); };
  q.addEventListener('input', draw);
  ctl.wmQx = () => { q.value = ''; draw(); q.focus(); };
  ctl.pick = b => { const p = pl.find(x => x.id === Number(refOf(b).id)); if (p) inTrip(p); return 'quiet'; };
  ctl.wmGo = () => { const v = q.value.trim(); if (!v) return 'quiet'; draw(); if (psSpecial(v)) { psReadLink(v).then(r => { if (r && r.coord) outside({ name: r.name || 'מקום מגוגל מפות', coord: r.coord, rec: r.rec }); else showToast(PS_NO_POINT); }); return 'quiet'; } psRun(ps, v, 'explicit'); return 'quiet'; };
  q.dataset.actEnter = 'wmore.wmGo';
  showSheetBackdrop('whereMore'); layerTop().ctl = ctl;
  if (back) { q.value = back.q || ''; draw(); const H = PS_HOSTS[ps]; // the shared place waits for a tap, like any result
    if (H && back.r) { H.st = { q: back.q || '', list: [{ name: back.r.name, coord: back.r.coord, rec: back.r.rec, sub: 'מגוגל מפות', ic: 'location_on', km: null }], kind: '', more: false, anywhere: true }; psDraw(H); } }
  else setTimeout(() => q.focus(), 60);
}
ctlActs('wmore', ['wmQx', 'wmGo', 'pick']);
ctlActs('closing', ['clvis', 'word', 'saveHigh', 'clAllVis', 'clArchive', 'clHighAdd', 'clNext', 'clNow', 'clSendFix', 'clView', 'clrate', 'clstep', 'hdel']);
// 4.41.1: which destination an edit belongs to - a place or layer of a destination by its id range, an added one by its own dest
function destOfEditId(id, e) {
  if (e && e.data && e.data.dest) return e.data.dest; const n = Number(id); if (!isFinite(n)) return null;
  const d = Object.values(DESTS).find(x => n >= (x.idBase || 0) && n < (x.idBase || 0) + 1e6 && ((x.places || []).some(p => (x.idBase || 0) + p.id === n) || ((x.meta || {}).layers || []).some(l => (x.idBase || 0) + l.id === n)));
  return d ? d.id : null;
}
function baseNameOf(id) { const n = Number(id), d = Object.values(DESTS).find(x => (x.places || []).some(p => (x.idBase || 0) + p.id === n)); if (!d) return ''; const p = d.places.find(q => (d.idBase || 0) + q.id === n); return p ? p.name : ''; }
// the rows of the "🔧 תיקונים ליעד" step: one per place, with what changed and when; places removed in a draft are one line
function destFixRows(destIds, pm) {
  const ds = new Set(destIds), rows = new Map(), skip = { n: 0, at: 0 }, E = STATE.edits;
  const fx = (ic, w) => msi(ic, { size: 18, cls: 'msi-in' }) + w; // 10.15.0 (design-review Q1): each fix as a line icon and its word (HTML)
  const row = (id, at) => { const k = String(id); if (!rows.has(k)) rows.set(k, { id: k, name: '', what: [], at: 0 }); const r = rows.get(k); r.at = Math.max(r.at, at || 0); return r; };
  const nameOf = (id, e) => (e && e.data && e.data.name) || ((pm && pm.get(Number(id))) || {}).name || placeName(Number(id)) || baseNameOf(id) || '';
  Object.entries(E.places || {}).forEach(([id, e]) => { if (!ds.has(destOfEditId(id, e))) return; const r = row(id, e.at); r.name = r.name || nameOf(id, e);
    if (e.op === 'add') r.what.push(fx('add', 'נוסף')); else if (e.op === 'del') r.what.push(fx('delete', 'נמחק'));
    else { if (e.data && e.data.manualCoord) r.what.push(fx('location_on', 'מיקום תוקן')); if (Object.keys(e.data || {}).some(k => !['manualCoord', 'coordSource'].includes(k))) r.what.push(fx('edit', 'נערך')); } });
  Object.entries(E.status || {}).forEach(([id, st]) => { const e = (E.places || {})[id]; if (!ds.has(destOfEditId(id, e))) return;
    if (st.s === 'skip') { skip.n++; skip.at = Math.max(skip.at, st.at || 0); return; }
    const r = row(id, st.at); r.name = r.name || nameOf(id, e);
    r.what.push(STATUS_MS[st.s] ? statusHTML(st.s) : st.s === 'moved' ? fx('luggage', 'עבר לטיול') : st.s === 'active' ? fx('undo', 'פתוח שוב') : _qe(st.s)); if (st.note) r.what.push(_qe('„' + st.note + '"')); });
  const layers = Object.entries(E.layers || {}).filter(([id, e]) => ds.has(destOfEditId(id, e))).length + Object.keys(E.layerOrder || {}).filter(d => ds.has(d)).length;
  const out = [...rows.values()].filter(r => r.what.length).sort((a, b) => b.at - a.at).map(r => ({ name: r.name || 'מקום', what: r.what.join(SEP), at: r.at }));
  if (skip.n) out.push({ name: skip.n === 1 ? 'מקום אחד' : `${skip.n} מקומות`, what: fx('visibility_off', skip.n === 1 ? 'לא מעניין' : 'לא מעניינים'), at: skip.at }); // 8.1.0: hidden as not interesting (in the editor or the draft)
  if (layers) out.push({ name: 'שכבות', what: fx('palette', `${layers} שינויים`), at: 0 });
  return out;
}
// 📥 a companion's trip file: visited merges, ratings stay by name, highlights join
function mergeCompanion(id, data, picks) {
  const t = STATE.trips[id]; picks = picks || ['visits'];
  const inc = personalFromFile(data) || {}, rate = inc.rating || {}, hs = inc.highlights || [];
  const name = data.device || 'מי שטייל איתך', td = tdOf(id);
  if (picks.includes('visits')) {
    td.visited = [...new Set([...(td.visited || []), ...(inc.visited || [])])];
    td.companions = { ...(td.companions || {}), [name]: { visited: inc.visited || [], rating: rate, highlights: hs, at: Date.now() } };
    const mine = td.highlights || []; td.highlights = mine.concat(hs.filter(h => !mine.some(m => m.placeId != null && m.placeId === h.placeId)).map(h => ({ ...h, by: name }))).slice(0, 5); }
  if (picks.includes('favorites')) td.favorites = [...new Set([...(td.favorites || []), ...(inc.favorites || [])])];
  tdSave(id); showUndoToast(`צורפו הסימונים של ${name} לטיול ${t.name}`); // undo-history (Q6): one toast = one row
  if (typeof renderClosingScreen === 'function' && activeTab === 'closing') renderClosingScreen();
  return true;
}
// importing ❤️ as favorites and 👎 as hidden into a new trip to a place I've been
function pastRatingsForDests(ids) {
  const out = { love: [], dislike: [] }; const seen = new Set();
  Object.values(STATE.trips).filter(t => t.archived && t.archived.reason !== 'cancelled' && tripDests({ segments: Object.keys((t.archived.snap || {}).dests || {}).map(d => ({ dest: d })) }).some(d => ids.includes(d)))
    .forEach(t => Object.entries((STATE.tripData[t.id] || {}).rating || {}).forEach(([k, v]) => { const pid = Number(k); if (seen.has(pid)) return; seen.add(pid); if (v.r === 'love') out.love.push(pid); if (v.r === 'dislike') out.dislike.push(pid); }));
  return out;
}
function importRatingsOffer(td, segs) { // 7.2.0: called only when the toggle in the trip editor is on
  const r = pastRatingsForDests([...new Set(segs.map(s => s.dest))]);
  td.favorites = [...new Set([...(td.favorites || []), ...r.love])]; td.hidden = [...new Set([...(td.hidden || []), ...r.dislike])];
}
// memory screen, part 2: what you loved and the highlights
function memoryHighlightsHTML(M) {
  const td = M.td, hs = (td.highlights || []).filter(h => h.text || h.placeId != null || h.photo), rate = td.rating || {};
  const nm = id => { const p = M.pmap.get(id); return p ? p.name : ''; };
  let h = '';
  if (hs.length) h += `<div class="mem-block"><h3>${msi('kid_star', { size: 20 })} רגעי השיא</h3><div class="mem-high">${hs.map(x => `<div class="mh-item">${typeof memoryPhotoHTML === 'function' ? memoryPhotoHTML(x) : ''}<div><b>${_qe(x.placeId != null ? nm(x.placeId) : (x.text || ''))}</b>${x.placeId != null && x.text ? `<small>${_qe(x.text)}</small>` : ''}${x.by ? `<small>· ${_qe(x.by)}</small>` : ''}</div></div>`).join('')}</div></div>`;
  const by = k => Object.entries(rate).filter(([, v]) => v.r === k).map(([id, v]) => ({ id: Number(id), w: v.w })).filter(x => nm(x.id));
  const comp = Object.entries(td.companions || {});
  const who = id => comp.map(([n, x]) => (x.rating || {})[id] ? `${RATE[x.rating[id].r]} ${_qe(n)}` : '').filter(Boolean).join(SEP);
  const list = (k, title) => { const a = by(k); return a.length ? `<div class="mem-rate"><b>${title}</b> ${a.map(x => `<span class="mr-item">${_qe(nm(x.id))}${x.w ? ` <i>"${_qe(x.w)}"</i>` : ''}${who(x.id) ? ` <small>${who(x.id)}</small>` : ''}</span>`).join('')}</div>` : ''; };
  const lists = list('love', '❤️ אהבנו') + list('like', '👍 היה טוב');
  if (lists) h += `<div class="mem-block"><h3>${msi('favorite', { size: 20 })} מה אהבתם</h3>${lists}</div>`;
  return h;
}
function memorySection(M, where) { if (where === 'middle') return memoryHighlightsHTML(M); if (typeof memorySection3 === 'function') return memorySection3(M, where); return ''; }


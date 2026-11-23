// Trip editor (7.2.0, ע3, ע4, מ4, מ5; 9.2.0 ס8, ס9): from the building blocks. Visible: name, dates, the segments; collapsed
// "נוסעים ותנועה"; for a new trip "סימונים מטיול קודם". One row UI and one model in the three date modes - each destination has
// its number of days (st.lens), and ＋/− change only that destination, at its end (a day with a plan that goes waits in
// "📦 מחוץ לטיול", asked in the button). "התחלה וסיום קבועים" shows a balance - days in the dates against days in the plan -
// and the trip saves only when they match (nothing is taken or added by itself); the first/last day can be a day all on the road
// ("ימים שכולם בדרך"; trip-travel-days: stored with the trip as the user set it - t.roadDays - never lit by itself; a fitting travel only
// suggests), which counts only on the dates' side. Changing the mode changes the editor in place.
function openTripEditor(id, opts) { layerNote(openTripEditor, arguments);
  const cur = id ? STATE.trips[id] : null, base = !cur && opts && opts.base ? STATE.trips[opts.base] : null; // 4.28.0: ⧉ a new trip based on another
  let first = cur ? null : Object.keys(DESTS).filter(k => !DESTS[k].ghost)[0];
  if (!cur && !base && opts && opts.dest && DESTS[opts.dest]) first = opts.dest; // 4.47.2: a new trip to a destination just added
  if (base) { const ds = [...new Set((base.segments || []).map(s => s.dest))].filter(d => DESTS[d] && !DESTS[d].ghost);
    if (!ds.length) { showToast('היעדים של הטיול הזה כבר לא בטלפון. אפשר לייבא אותם שוב, ואז ⧉'); return; } }
  const baseTd = base ? (base.id === STATE.activeTrip ? (stashActive(), STATE.tripData[base.id]) : STATE.tripData[base.id]) || {} : null;
  const basePlan = baseTd && Object.values(baseTd.itinerary || {}).some(d => Object.values(d || {}).some(a => (a || []).length));
  const mode = cur ? (cur.start ? (cur.dateMode === 'est' ? 'est' : 'fixed') : 'none') : base ? 'none' : 'fixed';
  // every destination row remembers the plan days it came with (a0: its first plan day, olen: how many) - where its days go
  let lens = cur ? segRanges(cur).map(r => ({ dest: r.dest, len: r.b - r.a + 1, orig: r.i, a0: r.a, olen: r.b - r.a + 1 }))
    : base ? (base.start || base.days ? segLensOf(base).filter(s => DESTS[s.dest] && !DESTS[s.dest].ghost).map(s => ({ dest: s.dest, len: s.len, orig: -1 })) : [...new Set((base.segments || []).map(s => s.dest))].filter(d => DESTS[d] && !DESTS[d].ghost).map(d => ({ dest: d, len: 3, orig: -1 })))
    : [{ dest: first, len: 3, orig: -1 }];
  if (!lens.length) lens = [{ dest: first || Object.keys(DESTS)[0], len: 3, orig: -1 }];
  const curTd = cur ? (cur.id === STATE.activeTrip ? (stashActive(), STATE.tripData[cur.id]) : STATE.tripData[cur.id]) || {} : {};
  const st = { cur, base, baseTd, basePlan, curTd, mode, lens, start: cur && cur.start ? cur.start : '', end: cur && cur.start ? cur.end : '', estStart: cur && cur.dateMode === 'est' ? cur.start : '',
    wd: cur && cur.wd != null ? String(cur.wd) : base && base.wd != null ? String(base.wd) : '', lead: 0, tail: 0, lead0: 0, tail0: 0,
    removingDates: false, removeOk: false, shiftAns: null, prevStart: cur ? cur.start : '' };
  if (mode === 'fixed' && cur) { const rd = roadDaysOf(cur); st.lead = st.lead0 = rd.lead; st.tail = st.tail0 = rd.tail; // trip-travel-days (Q3): read back as stored, never re-derived; its days on the road stay out of the destinations
    if (st.lead && lens[0].len > 1) { lens[0].len--; lens[0].a0++; lens[0].olen--; } if (st.tail && lens[lens.length - 1].len > 1) { const L = lens[lens.length - 1]; L.len--; L.olen--; } }
  const F = fmNew({ st }), others = Object.values(STATE.trips).filter(t => t.id !== id), sheet = document.getElementById('sheet');
  F.extra = () => JSON.stringify([st.mode, st.lens.map(s => [s.dest, s.len]), st.lead, st.tail, st.estStart, st.wd]);
  const legLab = { transit: 'ברגל ותחבורה ציבורית', car: 'רכב' }, legSeg = { transit: msi('directions_transit', { size: 18 }) + ' ברגל ותחבורה', car: msi('directions_car', { size: 18 }) + ' רכב' }; // 10.8.0 (design-icons, gap 62): a segmented button with line icons
  sheet.innerHTML = `${fmHead(cur ? '✏️ עריכת טיול' : base ? '⧉ טיול חדש על בסיס ' + nameB(String(base.name).split(' · ')[0]) : '＋ טיול חדש')}
    ${fmText(F, 'name', { label: 'שם הטיול', req: true, value: cur ? cur.name : base ? String(base.name).split(' · ')[0] + ' (חדש)' : '', placeholder: ('למשל: וינה ובודפשט' + SEP + 'מאי 2027') })}
    <div id="teDates"></div>
    ${fmSec(F, 'who', { title: 'נוסעים ותנועה', sum: F2 => [fmEsc(fmGet(F2, 'who')), legLab[fmGet(F2, 'leg')]].filter(Boolean).join(SEP) },
      fmText(F, 'who', { label: 'מי נוסע', value: cur ? cur.travelers : '', placeholder: 'למשל: אני, בן הזוג והילדים' })
      + fmChips(F, 'leg', { label: 'דרך התנועה העיקרית ' + tipI('te.leg'), value: cur && cur.legMain === 'car' ? 'car' : 'transit', options: Object.entries(legSeg) }))}
    ${base && basePlan ? fmToggle(F, 'copyPlan', { label: 'להעתיק את התוכנית כמסלול לדוגמה', value: !(base.archived && base.archived.reason === 'ended'), hint: `היום הראשון, השני וכו' - בלי תאריכים, בלי מועדפים, בלי "היינו" ובלי הזמנות${base.archived ? ' (מתמונת המצב של הטיול בזיכרונות)' : ''}${base.archived && base.archived.reason === 'ended' ? '. כבוי כי הטיול כבר נעשה - מה שאהבתם עובר בדירוגים; מסמנים אם חוזרים על אותו מסלול' : ''}` }) : ''}
    ${!cur ? '<div id="teRatingsBox"></div>' : ''}
    ${!cur && !base && others.length ? fmSec(F, 'marks', { title: 'סימונים מטיול קודם', sum: F2 => { const t = STATE.trips[fmGet(F2, 'from')]; return t ? fmEsc(t.name) : ''; } },
      fmChips(F, 'from', { label: 'מאיזה טיול (רשות)', value: '', options: [['', '— בלי'], ...others.map(t => [t.id, fmEsc(t.name)])] })
      + fmToggle(F, 'fav', { label: TX.fav, value: true }) + fmToggle(F, 'vis', { label: TX.visited, value: false })) : ''}
    ${fmSaveBar({ act: 'te.save', label: cur ? 'שמירה' : 'יצירת הטיול' })}`;
  showSheetBackdrop('openTripEditor'); if (cur) winRef('trip:' + cur.id); fmAttach(F); teDraw(F); teRatings(F); fmRestart(F);
}
const teTot = st => st.lens.reduce((n, s) => n + s.len, 0);
const teContentAt = (st, i) => st.cur && !st.removingDates ? dayIds((st.curTd.itinerary || {})['d' + i]).length : 0;
// the dates' side of the balance: the days between the dates, without a first or last day all on the road
const teDateDays = st => st.start && st.end && st.end >= st.start ? dayList(st.start, st.end).length - st.lead - st.tail : 0;
// the date part: the mode (three chips), the date fields of the mode, the days on the road, the rows of the destinations
const TE_MODES = [['est', 'רק התחלה – הסיום לפי הימים'], ['fixed', 'התחלה וסיום קבועים'], ['none', 'בלי תאריכים']];
function teDraw(F) { const st = F.opts.st, box = fmQ(F, '#teDates'); if (!box) return;
  ['start', 'end', 'estStart', 'wd', 'segs', 'dmode'].forEach(k => { delete F.kinds[k]; delete F.req[k]; });
  const m = st.mode;
  let h = fmChips(F, 'dmode', { label: 'תאריכים', value: m, options: TE_MODES, on: v => teMode(F, v) });
  if (m === 'fixed') { h += `<div class="sh-times">${fmDate(F, 'start', { label: 'מתאריך', req: true, value: st.start, on: v => teStartChanged(F, v) })}${fmDate(F, 'end', { label: 'עד תאריך', req: true, value: st.end, min: st.start, on: v => { st.end = v || ''; teRows(F); } })}</div>`;
    h += `<div id="teFly" class="te-fly"></div>`; } // 11.24.0 (small-ui-set B, road-days-wording Q2): no title - the two rows follow the dates, as their group
  if (m === 'est') h += fmDate(F, 'estStart', { label: '≈ תאריך התחלה משוער', req: true, value: st.estStart, on: v => { st.estStart = v || ''; teRows(F); } });
  if (m === 'none') h += fmChips(F, 'wd', { label: 'יום 1 של הטיול הוא', note: '(רשות)', value: st.wd, options: [['', '— עוד לא ידוע'], ...TM_WD.map((w, k) => [String(k), 'יום ' + w])], on: v => { st.wd = v; } });
  h += `<div class="sh-field fm-f te-len" data-fmw="segs"><span class="fm-lbl">קטעים - איפה נמצאים בכל חלק של הטיול<span class="req-mark" aria-hidden="true">*</span> ${tipI('te.segs')}</span><div id="teRows"></div>${fmErrSlot('segs')}</div>`;
  fmReg(F, 'segs', 'raw', null);
  box.innerHTML = h; fmFit(box); teRows(F); }
// ס9 (1): choosing the mode changes the editor in place; "קבועים" comes with its dates filled (the estimated start or the flights);
// trip-travel-days (Q3): no switch lights by itself, so the end it proposes adds no day on the road
function teMode(F, v) { const st = F.opts.st, cur = st.cur; if (v === st.mode) return;
  if (v === 'fixed') { const S = st.estStart || st.start || (cur && cur.start) || ''; st.start = S; st.lead = st.tail = 0;
    if (S) { const fl = (cur && cur.start ? travelsOf(cur) : []).filter(f => (f.mode || 'flight') === 'flight' && f.date && !isVirt(f.date)).map(f => f.date).sort();
      st.end = fl.length > 1 && fl[fl.length - 1] > S ? fl[fl.length - 1] : isoAdd(S, teTot(st) - 1); }
    st.removingDates = false; }
  else if (v === 'est') { if (st.mode === 'fixed' && st.start) st.estStart = st.start; st.lead = st.tail = 0; st.removingDates = false; }
  else { st.removingDates = !!(cur && cur.start); if (cur && cur.start && !st.wd) st.wd = String(tmWeekday(cur.start)); st.lead = st.tail = 0; }
  st.mode = v; teDraw(F); teRatings(F); }
function teSetDate(F, id, v) { const el = fmIn(F, id); if (!el) return; el.value = v || ''; F.vals[id] = v || ''; const w = fmQ(F, `[data-fmwd="${id}"]`); if (w) w.textContent = isIso(v) ? tmFmt('wd', v) : '';
  const c = fmW(F, id) && fmW(F, id).querySelector('.date-clr'); if (c) c.hidden = !v; }
// the rows of the destinations - one UI for the three modes
function teRows(F) { const st = F.opts.st, box = fmQ(F, '#teRows'); if (!box) return; let rows = '';
  const destBtn = (k, d) => `<button type="button" class="fm-pickbtn te-dest" data-act="te.dest" data-v="${k}">${ellB(fmEsc(destName(d)))}<span class="fm-caret"> ▾</span></button>`;
  const step = (k, n) => fmCount(null, 'seg' + k, { value: n, v: k, actPlus: 'te.plus', actMinus: 'te.minus', plus: 'יום נוסף', minus: 'יום פחות', plusOff: false, minusOff: n <= 1 });
  const x = k => `<button type="button" class="sheet-x te-x" data-act="te.del" data-v="${k}" aria-label="הסרת היעד" title="הסרת היעד">${msi('close', { size: 18 })}</button>`;
  const fixed = st.mode === 'fixed', S = fixed ? st.start : st.mode === 'est' ? st.estStart : '', off = fixed ? st.lead : 0;
  // trip-travel-days (Q3, Q4): the switches as stored; under one that is off, a fitting travel only suggests ("נחיתה ב־18:30, אולי כולו בדרך?")
  const fit = fixed && st.start && st.end ? roadFit(st.cur, st.start, st.end) : {};
  // 11.24.0 (small-ui-set B, road-days-wording Q1-Q3): each row is the claim its switch confirms ("<day> כולו בדרך"), its own ⓘ, no supporting line; before dates no rows
  const fly = fmQ(F, '#teFly'); if (fly) fly.innerHTML = !st.start || !st.end ? ''
    : [['lead', st.start, tipI('te.roadFirst', true)], ['tail', st.end, tipI('te.roadLast', true)]].map(([k, d, tip]) => setSwitchHTML('te.fly', ` data-v="${k}"`, !!st[k], `${glueText(tmFmt('day', d) + ' כולו בדרך')} ${tip}`, !st[k] && fit[k] ? fmEsc(fit[k].text + ', אולי כולו בדרך?') : '')).join(''); // 10.9.0 (design-forms): two yes/no properties - switches, not chips
  let c = 1 + off; const tdate = a => st.cur ? isoAdd(st.cur.start || VDATE, a - 1) : ''; // the transfer day in the stored trip (its travels' dates)
  st.lens.forEach((s, k) => { const a = c, b = c + s.len - 1; c += s.len;
    if (k) rows += `<div class="te-pass">${msi(passIcon(st.cur, tdate(a)), { size: 16 })} מעבר ביום ${a}${S ? SEP + tmFmt('day', isoAdd(S, a - 1)) : ''}</div>`; // 10.5.0 (design-4 part 2): the transfer as a small line; trip-travel-days (Q5): the icon of that day's travel
    const rFirst = fixed && !k && st.lead, rLast = fixed && k === st.lens.length - 1 && st.tail; // Q4: the first / last destination's range includes its day on the road and names it
    const span = S ? tmFmt('range', [isoAdd(S, (rFirst ? 1 : a) - 1), isoAdd(S, (rLast ? b + 1 : b) - 1)]) + (rFirst ? `${SEP}${tmFmt('dayN', S)} בדרך` : '') + (rLast ? `${SEP}${tmFmt('dayN', isoAdd(S, b))} בדרך` : '') : `ימים ${a}${b > a ? '–' + b : ''}`;
    rows += `<div class="te-lrow">${destBtn(k, s.dest)}${step(k, s.len)}<span class="te-end"><small class="te-span">${span}</small>${st.lens.length > 1 ? x(k) : ''}</span></div>`; });
  const N = teTot(st);
  if (fixed) { const D = teDateDays(st); rows += `<div class="te-len-h${st.start && st.end ? (D === N ? ' ok' : ' bad') : ''}">${st.start && st.end ? `${D === N ? msi('check_circle', { size: 18 }) : msi('warning', { size: 18 })} <span>ימי ביקור: <bdi>${D}</bdi> לפי התאריכים${SEP}<bdi>${N}</bdi> בתכנון</span>` : `<bdi>${N}</bdi> ימים בתכנון`}</div>`; } // Q4
  else { const estEnd = st.mode === 'est' && st.estStart ? isoAdd(st.estStart, N - 1) : '';
    rows += `<div class="te-len-h">${st.mode === 'est' ? `≈ ${st.estStart ? tmFmt('range', [st.estStart, estEnd], { year: true }) + SEP : ''}<b>${N}</b> ימים` : `סה״כ <b>${N}</b> ימים`}</div>`; }
  rows += `<button type="button" class="add-btn te-add" data-act="te.add">${msi('add', { size: 18 })} יעד נוסף</button>
    <small class="sh-hint">${fixed ? 'הימים של היעדים צריכים להתאים לתאריכים.' : 'אורך הטיול = הימים של היעדים.'}</small>`;
  box.innerHTML = rows; fmErrClear(F, 'segs'); teAskReset(F); teBalance(F); }
// ס8 (2): while the plan and the dates don't match, the save row shows one line in place of the button (no buttons in it)
function teBalance(F) { const st = F.opts.st; if (st.mode !== 'fixed' || !st.start || !st.end) return;
  const d = teDateDays(st) - teTot(st); if (!d) return;
  if (d < 0 && -d <= st.lead + st.tail) { teAsk(F, `${warnIc()} יום בדרך הוא לא יום ביקור: להוריד יום מיעד, או להאריך את התאריכים`, true); return; } // trip-travel-days (Q4): the gap comes from a switch
  teAsk(F, d > 0 ? `${warnIc()} להוסיף ${d === 1 ? 'יום אחד' : d + ' ימים'} לאחד היעדים, או לקצר את התאריכים` : `${warnIc()} להוריד ${-d === 1 ? 'יום אחד' : -d + ' ימים'} מאחד היעדים, או להאריך את התאריכים`, true); }
function teRatings(F) { const st = F.opts.st, box = fmQ(F, '#teRatingsBox'); if (!box) return; delete F.kinds.ratings;
  const r = pastRatingsForDests([...new Set(st.lens.map(s => s.dest))]);
  box.innerHTML = r.love.length || r.dislike.length ? fmToggle(F, 'ratings', { value: true, label: `מטיולים קודמים ליעד: ${r.love.length ? `❤️ ${r.love.length} כמועדפים ${msi('star', { cls: 'msi-in' })}` : ''}${r.love.length && r.dislike.length ? SEP : ''}${r.dislike.length ? `👎 ${r.dislike.length} כמוסתרים בטיול הזה` : ''}` }) : ''; }
// ---- the start date of fixed dates: a postponed trip moves as a whole (the end with it); a new one gets an end that fits ----
function teStartChanged(F, ns) { const st = F.opts.st; ns = ns || '';
  if (st.cur && st.prevStart && ns && st.end && ns !== st.prevStart) { const dl = daysBetween(st.prevStart, ns); st.end = isoAdd(st.end, dl); teSetDate(F, 'end', st.end); st.shiftAns = null; } // 4.28.0
  else if (ns && (!st.end || st.end < ns)) { st.end = isoAdd(ns, teTot(st) + st.lead + st.tail - 1); teSetDate(F, 'end', st.end); }
  st.start = ns; if (ns) st.prevStart = ns; { const el = fmIn(F, 'end'); if (el) el.min = ns; } // the pair: "עד" never before "מ"
  teRows(F); }
// ---- the taps on the rows ----
const teF = c => { const F = fmOf(c.el); return F && F.opts.st ? F : null; };
act('te.dest', c => { const F = teF(c); if (!F) return; const st = F.opts.st, k = +c.v, curD = st.lens[k].dest;
  openFmChoice({ title: 'יעד', value: curD, options: Object.values(DESTS).filter(d => !d.ghost || d.id === curD).map(d => ({ v: d.id, html: withFlag(destFlag(d.id), fmEsc(d.meta.name)), sub: fmEsc(d.meta.description || '') })) },
    v => setTimeout(() => { const F2 = fmOf(); if (!F2 || !F2.opts.st) return; const a2 = F2.opts.st.lens; if (a2[k]) { a2[k].dest = v; teRows(F2); teRatings(F2); fmSums(F2); } }, 0)); return 'quiet'; });
act('te.plus', c => { const F = teF(c); if (!F) return; const st = F.opts.st, k = +c.v;
  if (teTot(st) >= 60) { showToast('טיול עד 60 יום'); return 'quiet'; } st.lens[k].len++; teRows(F); return 'quiet'; });
// the day that goes is the destination's last; with content it waits in "📦 מחוץ לטיול" - asked once, in the button
act('te.minus', c => { const F = teF(c); if (!F) return; const st = F.opts.st, s = st.lens[+c.v]; if (s.len <= 1) return 'quiet';
  const gone = s.orig >= 0 && s.len <= s.olen ? s.a0 + s.len - 1 : 0, n = gone ? teContentAt(st, gone) : 0;
  const down = () => { s.len--; teRows(F); return 'quiet'; };
  return n ? askSure({ ic: 'event_busy', title: `להוריד את יום ${gone}?`, text: `יש בו ${n} בתוכנית. הוא יעבור ל"מחוץ לטיול" (לא נמחק).`, ok: 'הורדה' }, down) : down(); });
// ✕: the destination leaves with its days - they go to no other destination; days with a plan wait in "📦 מחוץ לטיול"
act('te.del', c => { const F = teF(c); if (!F) return; const st = F.opts.st, k = +c.v, s = st.lens[k]; if (st.lens.length < 2) return 'quiet';
  let n = 0; if (s.orig >= 0) for (let q = s.a0; q < s.a0 + s.olen; q++) n += teContentAt(st, q) ? 1 : 0;
  const out = () => { st.lens.splice(k, 1); teRows(F); teRatings(F); return 'quiet'; };
  return n ? askSure({ ic: 'event_busy', title: `להסיר את ${_qe(destName(s.dest))}?`, text: `יש בו ${n === 1 ? 'יום אחד' : n + ' ימים'} עם תוכנית. הם יעברו ל"מחוץ לטיול" (לא נמחקים).`, ok: 'הסרה' }, out) : out(); });
act('te.add', c => { const F = teF(c); if (!F) return; const st = F.opts.st;
  if (teTot(st) >= 60) { showToast('טיול עד 60 יום'); return 'quiet'; } const used = new Set(st.lens.map(s => s.dest));
  const d = Object.values(DESTS).find(x => !x.ghost && !used.has(x.id)) || Object.values(DESTS).find(x => !x.ghost);
  st.lens.push({ dest: d.id, len: st.mode === 'fixed' ? 1 : 3, orig: -1 }); teRows(F); teRatings(F); return 'quiet'; }); // ס8 (3): with fixed dates it comes with one day
act('te.fly', c => { const F = teF(c); if (!F) return; const st = F.opts.st, k = c.v === 'tail' ? 'tail' : 'lead'; st[k] = st[k] ? 0 : 1; teRows(F); return 'quiet'; }); // only the user's tap changes a switch
// ---- a question that must be answered before saving takes the save button's place in the floating row ----
function teAsk(F, html, line) { const bar = fmQ(F, '.sheet-save-bar'), sv = fmQ(F, '#fmSave'); let q = fmQ(F, '#teShift'); if (!q) { q = document.createElement('div'); q.id = 'teShift'; q.className = 'callout'; bar.insertBefore(q, bar.firstChild); }
  q.innerHTML = html; q.hidden = false; q.classList.toggle('te-bal', !!line); sv.hidden = true; }
function teAskReset(F) { const q = fmQ(F, '#teShift'), sv = fmQ(F, '#fmSave'); if (q) q.remove(); if (sv) sv.hidden = false; const st = F.opts.st; if (st) st.shiftAns = null; }
act('te.shift', c => { const F = teF(c); if (!F) return; F.opts.st.shiftAns = c.v === 'yes' ? F.opts.st.askDl : 0; fmQ(F, '#fmSave').click(); return 'quiet'; });
act('te.rm', c => { const F = teF(c); if (!F) return; if (c.v === 'yes') { F.opts.st.removeOk = true; teAskReset(F); fmQ(F, '#fmSave').click(); } else teAskReset(F); return 'quiet'; });
// removing the dates of a trip with dates: everything becomes day numbers - told once, in the save row
function teRemoveNote(st) { const cur = st.cur, nb = Object.values(cur ? ((cur.id === STATE.activeTrip ? STATE.bookings : st.curTd.bookings) || {}) : {}).filter(b => b.date).length;
  return `<b>התכנון יישמר לפי ימים:</b> יום 1 עד יום ${teTot(st)}, עם היעדים, הלינות, הנסיעות והלו"ז.${nb ? ` הזמנות שכבר נעשו (${nb}) נשארות עם התאריך שלהן.` : ''} כשתזינו תאריכים חדשים - הכל יחזור למקום.<div class="brow export-actions"><button type="button" class="btn-nav" data-act="te.rm" data-v="yes">✓ להמשיך בלי תאריכים</button><button type="button" class="icon-btn btn-copy" data-act="te.rm" data-v="no" style="width:auto;padding:0 12px;">ביטול</button></div>`; }
// where each old day goes: a plan day of a destination row to the same place in its new days (beyond its new length - out of
// the trip), a flight-only first/last day to the new first/last day
function teDayMap(st, total) { const oldN = st.cur ? tripLen(st.cur) : 0; let c = 1 + st.lead; const pos = st.lens.map(s => { const p = c; c += s.len; return p; });
  return i => { if (st.lead0 && i <= st.lead0) return st.lead ? i : null; if (st.tail0 && i > oldN - st.tail0) return st.tail ? total - (oldN - i) : null;
    const k = st.lens.findIndex(s => s.orig >= 0 && i >= s.a0 && i < s.a0 + s.olen); if (k < 0) return null; const s = st.lens[k], j = i - s.a0; return j < s.len ? pos[k] + j : null; }; }
act('te.save', c => { const F = teF(c); if (!F) return; const st = F.opts.st, cur = st.cur, base = st.base;
  const name = fmGet(F, 'name'); if (!name) return fmFail(F, 'name', 'חסר שם');
  const who = fmGet(F, 'who'), legMain = fmGet(F, 'leg') || 'transit', ratingsOn = !!fmGet(F, 'ratings');
  const newTd = () => { const td = { favorites: [], visited: [], itinerary: {}, times: {}, planItems: {}, flightsSeeded: true }, from = fmGet(F, 'from');
    if (from) { const src = STATE.tripData[from] || {}; if (fmGet(F, 'fav')) td.favorites = [...(src.favorites || [])]; if (fmGet(F, 'vis')) td.visited = [...(src.visited || [])]; } return td; };
  const copyPlan = (td, parked) => { if (!(base && fmGet(F, 'copyPlan'))) return; const c2 = JSON.parse(JSON.stringify(st.baseTd)); td.itinerary = c2.itinerary || {}; td.times = c2.times || {}; td.planItems = c2.planItems || {};
    if (c2.planX) { const { routeHide, ...px } = c2.planX; td.planX = px; } if (parked && (c2.parked || []).length) td.parked = c2.parked; }; // 4.38.0: the days that waited outside come along too
  if (!st.lens.length) return fmFail(F, 'segs', 'צריך לפחות יעד אחד'); if (teTot(st) > 60) return fmFail(F, 'segs', 'טיול עד 60 יום');
  const fixed = st.mode === 'fixed';
  if (fixed) { if (!st.start) return fmFail(F, 'start', 'חסר תאריך'); if (!st.end || st.end < st.start) return fmFail(F, 'end', 'בדקו את התאריכים');
    if (dayList(st.start, st.end).length > 60) return fmFail(F, 'end', 'טיול עד 60 יום');
    if (teDateDays(st) !== teTot(st)) { teBalance(F); return; } // ס8 (2): nothing is thrown away or added by itself
    const wasFixed = !!(cur && cur.start && cur.dateMode !== 'est');
    if (wasFixed && st.start !== cur.start && tripHasDated(cur) && st.shiftAns === null) { // 4.28.0: postponed - move the dated things too?
      const dl = daysBetween(cur.start, st.start); st.askDl = dl;
      teAsk(F, `<b>הטיול זז ב-${Math.abs(dl)} ימים ${dl > 0 ? 'קדימה' : 'אחורה'}.</b> להזיז איתו גם את הנסיעות, הלינות, ${TX.group} וההזמנות? (התוכנית לפי ימים זזה לבד)<div class="brow export-actions"><button type="button" class="btn-nav" data-act="te.shift" data-v="yes">להזיז הכל</button><button type="button" class="icon-btn btn-copy" data-act="te.shift" data-v="no" style="width:auto;padding:0 12px;">להשאיר את התאריכים שלהם</button></div>`); return; } }
  if (st.mode === 'est') { const e = fmGet(F, 'estStart'); if (e) st.estStart = e; if (!st.estStart) return fmFail(F, 'estStart', 'חסר תאריך התחלה משוער'); }
  if (st.removingDates && !st.removeOk && st.mode === 'none') { teAsk(F, teRemoveNote(st)); return; }
  stashActive();
  const segs = st.lens.map(s => ({ dest: s.dest, len: s.len, orig: s.orig })), total = teTot(st) + (fixed ? st.lead + st.tail : 0);
  const o = { mode: st.mode, start: fixed ? st.start : st.mode === 'est' ? st.estStart : '', segs, wd: st.mode === 'none' ? st.wd : undefined, ...(fixed ? { lead: st.lead, tail: st.tail, road: true } : {}) };
  const overlap = t => { if (fixed) (t.segments || []).forEach((g, k, a) => { if (k) a[k - 1].to = g.from; }); }; // with dates a transfer day is in both segments (as in the file)
  if (cur) {
    const wasFixed = !!(cur.start && cur.dateMode !== 'est');
    if (fixed && wasFixed && st.shiftAns) shiftTripDates(cur, st.shiftAns);
    if (st.removingDates && !st.wd && cur.start) o.wd = String(tmWeekday(cur.start));
    rebuildTripDays(cur, { ...o, map: teDayMap(st, total), keepItemDates: fixed && wasFixed }); overlap(cur); Object.assign(cur, { name, travelers: who, legMain });
    closeSheet(); loadPersonal(STATE.activeTrip); applyActiveTrip(); syncFlightsToPlan(); persist(); updateHeader();
    showUndoToast('הטיול עודכן: ' + name); return; } // undo-history Q6: one row
  const nid = 't_' + Date.now().toString(36), nt = { id: nid, name, start: '', end: '', segments: [], travels: [], lodging: [], travelers: who, legMain, createdAt: Date.now() };
  const td = newTd(); rebuildTripDays(nt, o, td); overlap(nt); copyPlan(td, !fixed);
  if (ratingsOn) importRatingsOffer(td, fixed ? nt.segments : st.lens); // 4.29.0
  STATE.trips[nid] = nt; STATE.tripData[nid] = td;
  closeSheet(); persist(); switchTrip(nid, true);
  showUndoToast((base ? '⧉ נוצר טיול על בסיס ' + base.name + ': ' : 'נוצר טיול: ') + name); // undo-history Q6: one row, the log's wording
});

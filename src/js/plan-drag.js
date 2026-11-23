// 4.21.0 → 9.7.0 (Q6c): a long press on a plan card lifts it (it sinks at once, lifts with a light vibration), then it is dragged
// (TOUCH 'drag'); a quick move scrolls as usual. A travel does not move (9.2.0, ס6 - it changes in its editor). Dropping in
// another part of the day or in another open day moves it there.
// 11.14.0 (P20): a part of the day's band starts at its title (head), so its title and its whole room take the drop
gestureOn('drag', '.tl-card.itin-card', { hold: true, items: '.tl-entry', drop: (c, to) => dropPlanEntry(c, to),
  head: z => { const h = z.previousElementSibling; return h && h.classList.contains('tl-div') && !h.classList.contains('tl-clock') ? h : null; },
  when: (c, t) => !c.classList.contains('tl-travel') && !!c.closest('[data-dropday]') && !t.closest('.tl-acts, .tl-vis, a, .tl-tag, .mc-when'),
  zones: () => [...document.querySelectorAll('#main .tl-zone[data-dropday]')].filter(z => z.offsetParent !== null),
  heads: c => planDropHeads(c), headLit: planHeadLit, headDrop: (c, h) => dropPlanHead(c, h), open: planHeadOpen, opened: planHeadsBack });
// 11.27.0 (closed-day-drop; decisions 2026-11-18 · Dragging a plan card into a closed day, Q1-Q4): a closed day's head is a band of its
// own. A release on it moves the card into that day - the card's own part, at its end - and the day stays closed (Q1, Q2); held still
// TOUCH.springHold it opens (TOUCH's spring) and the drag goes on in it; a day opened so closes again at the end unless it took the card
// (Q4). In a read-only trip no head is a band. 11.34.0 (phone-round-3-fixes P14, G76; decisions 2026-11-20 · A group-schedule line
// moves between days like any card): a group line is a card like any other here. 11.34.0 (P7, G75): a day that already holds the place
// is a band too, so the release is never silent - its head says so while the card is over it, and the drop shows the refusal
// message of an open day (dropPlanEntry).
function planDropHeads(card) { const tok = card.dataset.ipid; if (document.body.classList.contains('read-only')) return [];
  return [...document.querySelectorAll('#main .day-item[data-open="false"] > .day-head')].filter(h => { const k = h.parentElement.dataset.dayItem; return h.offsetParent !== null && k !== card.dataset.iday; }); }
const planHeadRefused = (h, card) => { const tok = card.dataset.ipid; return !tok.startsWith('s:') && isInDay(h.parentElement.dataset.dayItem, pid(tok)); };
function planHeadPart(card) { const k = card.dataset.islot, t = card.dataset.start || '';
  const w = k === 'all' ? (t ? 'ייכנס ליום' : 'ייכנס לסוף היום') : k === 'unassigned' ? 'ייכנס ליום, בלי חלק ביום' : 'ייכנס ל' + ((SLOTS.find(s => s.key === k) || {}).label || '');
  return w + (t ? SEP + t : ''); }
function planHeadLit(h, card, on) { h.classList.toggle('g-headin', on); const t = h.querySelector('.dh-t'); let n = t && t.querySelector(':scope > .g-into');
  if (!on) { if (n) n.remove(); return; } if (!t) return;
  if (!n) { n = document.createElement('small'); n.className = 'g-into'; t.appendChild(n); } n.textContent = planHeadRefused(h, card) ? 'כבר בתוכנית של היום הזה' : planHeadPart(card);
  hintOnce('hint.closedDay', h); } // the first closed head a card is carried over (the explanation gate)
function planHeadOpen(h) { const it = h.closest('.day-item'), k = it && it.dataset.dayItem; if (!k) return null; openDays.add(k); it.dataset.open = 'true';
  const m = it.querySelector('.map-container'); if (m && !m.childElementCount) renderItineraryMap(m.id, 'mapCard_day_' + k, ensureDay(k)); // a day shown as a map draws it now
  return k; }
function planHeadsBack(keys, took) { const keep = took && (took.head ? took.head.parentElement.dataset.dayItem : took.zone.dataset.dropday);
  keys.forEach(k => { if (k === keep) return; openDays.delete(k); const it = document.querySelector(`#main [data-day-item="${CSS.escape(k)}"]`); if (it) it.dataset.open = 'false'; }); }
// the drop on a closed head: the open-day drop without choosing a row (Q2) - the card's own part of that day, at its end; its rows from
// the day's own timeline (a closed day may show no rows: empty, or shown as a map)
function dropPlanHead(card, h) { const k = h.parentElement.dataset.dayItem, d = dayByKey(k); if (!d) return; const slot = card.dataset.islot, tmp = document.createElement('div');
  tmp.innerHTML = dayTimelineHTML(d); let zone = tmp.querySelector(`.tl-zone[data-dropslot="${CSS.escape(slot)}"]`);
  if (!zone) { zone = document.createElement('div'); zone.className = 'tl-zone'; zone.dataset.dropday = k; zone.dataset.dropslot = slot; }
  const n = zone.querySelectorAll('.tl-entry').length, part = slot === 'all' ? '' : slot === 'unassigned' ? 'בלי חלק ביום' : (SLOTS.find(s => s.key === slot) || {}).label || '';
  dropPlanEntry(card, { zone, idx: n }, `${SY.days} עבר ל${dayLabelOf(k)}${part ? SEP + part : ''}`); }
// 4.51.0 → 9.7.0 (Q9a): a swipe on a plan card (and every mini card) is a shortcut to the ✓ circle on its strip: right marks, left
// unmarks; past the threshold the circle itself shows the result; toward the state it already has nothing moves. A long press drags.
gestureOn('swipe', '.tl-card.g-swipe', {
  when: (c, t) => !document.body.classList.contains('read-only') && !!c.querySelector(':scope > .tl-vis') && !t.closest('.tl-acts, a, .tl-tag, .mc-when, .mc-pickbtn'),
  can: (c, dir) => (c.querySelector(':scope > .tl-vis').dataset.active === 'true') === (dir < 0), stay: c => c.querySelector(':scope > .tl-vis'), // the toggle stays in view while the card moves (left would carry it off the screen)
  preview: (c, dir, on) => { const vb = c.querySelector(':scope > .tl-vis'); vb.dataset.pv = (dir > 0) === on ? 'on' : 'off'; }, // previews by filling the toggle (10.2.0)
  done: c => { const vid = visitIdOf(c.querySelector(':scope > .tl-vis')); if (vid != null) toggleVisited(pid(vid)); } });
// 4.22.0: a drop in the plan. An untimed entry stays where it was dropped. One with a time is placed by its time, so a drop
// where the time does not fit asks: change the time (a suggestion that fits), another time, or remove the time.
function dropPlanEntry(card, to, moved) { // (dropped in place - nothing - is decided by the drag itself); moved: the message of a move to another day
  const zone = to.zone, idx = to.idx, rowsEl = [...zone.querySelectorAll('.tl-entry')].filter(c => c !== card), tok = card.dataset.ipid, from = card.dataset.iday, day = zone.dataset.dropday;
  if (day !== from && !tok.startsWith('s:') && isInDay(day, pid(tok))) { showToast(`${SY.days} כבר בתוכנית של ${dayLabelOf(day)}`); return; } // 11.34.0 (P14): a group line moves too
  const fromRows = [...card.parentNode.querySelectorAll('.tl-entry')];
  const rows = rowsEl.map(r => ({ tok: r.dataset.ipid, start: r.dataset.start || '', end: r.dataset.end || '' }));
  const ci = fromRows.indexOf(card), oldPrev = ci > 0 ? fromRows[ci - 1].dataset.ipid : '^', oldNext = fromRows[ci + 1] && !fromRows[ci + 1].dataset.start ? fromRows[ci + 1].dataset.ipid : null;
  const info = { day, from, tok, start: card.dataset.start || '', end: card.dataset.end || '', zslot: zone.dataset.dropslot, rows, idx, oldPrev, oldNext,
    name: (card.querySelector('.tl-body b') || {}).textContent || '', moved }, other = day !== from ? moved || `${SY.days} הועבר ל${dayLabelOf(day)}` : '';
  if (info.start) {
    let pT = null, nT = null; for (let i = idx - 1; i >= 0; i--) if (rows[i].start) { pT = rows[i]; break; } for (let i = idx; i < rows.length; i++) if (rows[i].start) { nT = rows[i]; break; }
    Object.assign(info, { pT, nT });
    if (timeFitsDrop(info.start, info)) { if (other) planChange(other, () => { planMoveDay(info); placeTimed(day, pid(tok)); }); else showToast('המקום שלו לפי השעה (' + info.start + ')'); return; }
    askDropTime(info); return;
  }
  const label = info.zslot !== 'all' && info.zslot !== card.dataset.islot ? ((SLOTS.find(s => s.key === info.zslot) || { label: 'בלי חלק ביום' }).label) : '';
  planChange(other || (label ? `${SY.days} הועבר ל${label}` : SY.days + ' הסדר שונה'), () => { planMoveDay(info); placeUntimed(info); });
}
// 9.7.0 (T13א): a drop in another open day takes my entry out of its day with its time; nothing follows it in the new day yet
// 11.34.0 (P14, G76; Q1-Q2): a group line's day is one more change in my layer (planX.sched, the field `date`); the source line never
// changes, "חזרה למקור" brings it back to its day and time, and an update from the file follows the layer's rule
function planMoveDay(info) { const { from, day, tok } = info; if (!from || from === day) return;
  if (String(tok).startsWith('s:')) { const s = rawSched(tok.slice(2)), d = dayByKey(day); releaseFollowers(from, tok, info.oldPrev, info.oldNext);
    const an = planX().anchors[from]; if (an) delete an[tok]; tidyAnchors(from);
    if (s && d) { setSchedField(s, 'date', d.date); const ed = schedEd(s.id); if (ed) delete ed.slot; schedTidy(s.id); }
    info.from = day; info.oldPrev = '^'; info.oldNext = null; return; }
  const id = pid(tok), fd = ensureDay(from);
  releaseFollowers(from, tok, info.oldPrev, info.oldNext); const an = planX().anchors[from]; if (an) delete an[tok]; tidyAnchors(from);
  ['unassigned', 'morning', 'afternoon', 'evening'].forEach(k => { fd[k] = fd[k].filter(v => v !== id); });
  const t = STATE.times[timeKey(from, id)]; delete STATE.times[timeKey(from, id)]; if (t) STATE.times[timeKey(day, id)] = t;
  info.from = day; info.oldPrev = '^'; info.oldNext = null; }
function timeFitsDrop(start, info) {
  const okOrder = (!info.pT || info.pT.start <= start) && (!info.nT || start <= info.nT.start);
  const okSlot = info.zslot === 'all' || (info.zslot !== 'unassigned' && slotForTime(start) === info.zslot);
  return okOrder && okSlot;
}
// whoever came right after the moved entry, or was anchored to it, now follows the entry that was before it
function releaseFollowers(day, tok, oldPrev, oldNext) {
  const x = planX(), an = x.anchors[day] = x.anchors[day] || {};
  Object.keys(an).forEach(k => { if (an[k] === tok) an[k] = oldPrev; });
  if (oldNext && oldNext !== tok) an[oldNext] = oldPrev;
}
// own untimed entries whose anchor is just the item before them in my list need no anchor
function tidyAnchors(day) {
  const x = planX(), an = x.anchors[day]; if (!an) return;
  const dd = ensureDay(day), lists = showParts() ? ['morning', 'afternoon', 'evening', 'unassigned'].map(k => dd[k]) : [mergedIds(day)];
  lists.forEach(list => { const own = list.filter(id => planItem(id)); own.forEach((id, j) => { const k = String(id); if (an[k] == null) return;
    if (getTime(day, id) || an[k] === (j ? String(own[j - 1]) : '^')) delete an[k]; }); });
  Object.keys(an).forEach(k => { if (an[k] === k) delete an[k]; });
  if (!Object.keys(an).length) delete x.anchors[day];
}
function placeUntimed(info) {
  const { day, tok, zslot, rows, idx } = info, x = planX();
  releaseFollowers(day, tok, info.oldPrev, info.oldNext);
  const an = x.anchors[day] = x.anchors[day] || {};
  const isOwn = r => !String(r.tok).startsWith('s:');
  const before = rows.slice(0, idx).reverse().find(isOwn), after = rows.slice(idx).find(isOwn);
  const pB = before ? pid(before.tok) : null, pA = after ? pid(after.tok) : null;
  const slot = zslot === 'all' ? (pB != null ? findSlot(day, pB) : pA != null ? findSlot(day, pA) : 'unassigned') || 'unassigned' : zslot;
  if (String(tok).startsWith('s:')) { const s = rawSched(tok.slice(2)); if (s) { const ed = schedEdit(s); delete ed.slot; if (slot !== schedInferSlot(schedEff(s))) ed.slot = slot; schedTidy(s.id); } } // 4.50.0: only what differs from the program's own place is kept
  else {
    const id = pid(tok), dd = ensureDay(day); ['unassigned', 'morning', 'afternoon', 'evening'].forEach(k => { dd[k] = dd[k].filter(v => v !== id); });
    const arr = dd[slot]; const pos = pB != null && arr.includes(pB) ? arr.indexOf(pB) + 1 : (pA != null && arr.includes(pA) ? arr.indexOf(pA) : (pB != null ? arr.length : 0));
    arr.splice(pos, 0, id);
  }
  an[tok] = idx ? rows[idx - 1].tok : '^';
  const nx = rows[idx]; if (nx && !nx.start) an[nx.tok] = tok; // the untimed entry I was dropped in front of now follows me
  tidyAnchors(day);
}
function suggestDropTime(info) {
  if (info.zslot === 'unassigned') return '';
  const me = STATE.settings.morningEnd, ae = STATE.settings.afternoonEnd;
  const lo = tmMin({ morning: '06:00', afternoon: me, evening: ae, all: '06:00' }[info.zslot]), hi = tmMin({ morning: me, afternoon: ae, evening: '23:55', all: '23:55' }[info.zslot]) - (info.zslot === 'evening' || info.zslot === 'all' ? 0 : 5);
  const dur = info.end ? ((tmMin(info.end) - tmMin(info.start)) + 1440) % 1440 || 60 : 60;
  const p = info.pT, n = info.nT; let s;
  if (p && n) { const a = p.end && tmMin(p.end) > tmMin(p.start) ? tmMin(p.end) : tmMin(p.start) + 60; s = a <= tmMin(n.start) ? a : (tmMin(p.start) + tmMin(n.start)) / 2; }
  else if (p) s = p.end && tmMin(p.end) > tmMin(p.start) ? tmMin(p.end) : tmMin(p.start) + 60;
  else if (n) s = tmMin(n.start) - Math.min(dur, 90);
  else s = Math.max(lo, tmMin('09:00'));
  s = Math.max(lo, Math.min(hi, s)); if (p) s = Math.max(s, tmMin(p.start)); if (n) s = Math.min(s, tmMin(n.start));
  s = Math.round(s / 5) * 5; if (p && s < tmMin(p.start)) s += 5; if (n && s > tmMin(n.start)) s -= 5;
  const t = tmHM(s); return timeFitsDrop(t, info) && t !== info.start ? t : '';
}
function setEntryTime(day, tok, start, end) { // a new time for one of my items or an organized one (with my changes)
  if (String(tok).startsWith('s:')) { const s = rawSched(tok.slice(2)); if (!s) return; setSchedField(s, 'start', start); setSchedField(s, 'end', start ? end : ''); const ed = schedEd(s.id); if (ed && start) delete ed.slot; schedTidy(s.id); }
  else { const id = pid(tok); if (start) { STATE.times[timeKey(day, id)] = { start, end: end || '' }; placeTimed(day, id); } else delete STATE.times[timeKey(day, id)]; } // 5.1.0: no end unless one was set
}
function askDropTime(info) { layerNote(askDropTime, arguments);
  const sheet = document.getElementById('sheet'), sugg = suggestDropTime(info), esc = _escH;
  const shift = t => info.end ? tmAddMin(t, ((tmMin(info.end) - tmMin(info.start)) + 1440) % 1440) : '';
  const where = info.pT && info.nT ? `בין ${info.pT.start} ל-${info.nT.start}` : info.pT ? `אחרי ${info.pT.start}` : info.nT ? `לפני ${info.nT.start}` : 'לחלק אחר ביום';
  const tm = v => `<bdi dir="ltr">${esc(v)}</bdi>`, pick = sugg ? 'sugg' : 'keep';
  const cards = [sugg ? { cap: 'מוצע', val: tm(sugg), v: 'sugg', id: 'dtSugg' } : null, { cap: 'להשאיר', val: tm(info.start), v: 'keep', id: 'dtKeep' }, { cap: 'בלי שעה', val: '—', v: 'none', id: 'dtNoTime' }].filter(Boolean);
  // 10.12.0 (design-plan, gap 4): three cards (מוצע · להשאיר · בלי שעה), the chosen one outlined, and "אישור"; another time stays as the outlined second action
  sheet.innerHTML = `${fmHead('🕐 השעה לא מתאימה למקום החדש', 'dtClose')}
    <p class="dt-text"><b>${esc(info.name.trim())}</b> קבוע ל-${tm(info.start)}, וגררת אותו ${where}. בתוכנית, מה שיש לו שעה עומד לפי השעה.</p>
    <div class="two-cards${cards.length === 3 ? ' tc-3' : ''}">${cards.map(c => `<button type="button" class="tc-card${c.v === pick ? ' on' : ''}" id="${c.id}" data-act="dropTime.pick" data-v="${c.v}" aria-pressed="${c.v === pick}"><small>${c.cap}</small><span>${c.val}</span></button>`).join('')}</div>
    <div class="brow export-actions sheet-save-bar"><button class="btn-nav" id="dtOk" data-act="dropTime.ok">אישור</button><button class="sh-secondary" id="dtOther" data-act="dropTime.other">שעה אחרת…</button></div>`;
  openSheet('askDropTime'); const ctl = layerTop().ctl = {}; let cur = pick;
  const moveNote = info.moved || `${SY.days} הועבר ל${dayLabelOf(info.day)}`, crossDay = info.from !== info.day;
  const run = { sugg: () => planChange(`🕐 השעה שונתה ל-${sugg}`, () => { planMoveDay(info); releaseFollowers(info.day, info.tok, info.oldPrev, info.oldNext); setEntryTime(info.day, info.tok, sugg, shift(sugg)); const an = planX().anchors[info.day]; if (an) delete an[info.tok]; tidyAnchors(info.day); }),
    none: () => planChange('🕐 השעה הוסרה, והוא נשאר במקום החדש', () => { planMoveDay(info); setEntryTime(info.day, info.tok, '', ''); placeUntimed(info); }),
    keep: () => { if (crossDay) planChange(moveNote, () => { planMoveDay(info); placeTimed(info.day, pid(info.tok)); }); } }; // the same day: it stays at its time, as before the drag
  ctl.pick = b => { cur = b.dataset.v; sheet.querySelectorAll('.two-cards .tc-card').forEach(x => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on); }); return 'quiet'; };
  ctl.ok = () => { closeSheet(); run[cur](); };
  ctl.other = () => { if (crossDay) { closeSheet(); planChange(moveNote, () => { planMoveDay(info); placeTimed(info.day, pid(info.tok)); }); } openTimeSheet(info.day, info.tok); }; // 4.52.0: the same time window for every card
}
ctlActs('dropTime', ['pick', 'ok', 'other']);
// 4.47.5 → 7.2.0: required fields are marked by the building blocks themselves (fmLabel, fmAttach)


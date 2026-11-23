// ✏️ an item of the organized schedule, for me only
// 4.52.0: one time window for every plan card - my place, a copy, a note, a line of the organized schedule.
// The day is chosen in 🗓️ (this window never adds the item to another day).
ctlActs('time', ['save', 'del', 'endClear'], ['endClear']);
function entryTime(day, tok) { const e = entryOfTok(tok); if (!e) return null; if (e.sched) return e.sched.start ? { start: e.sched.start, end: e.sched.end || '' } : null; return getTime(day, e.p.id); }
// sched-draft-all: from the scheduling window (draft = { t, set(start, end) }) the window edits that draft's row, not the plan
// 11.28.2 (t790 (5)): the value goes into the draft and the window under is drawn again once it is back - a draw after the action, from
// the time window's close, not in an action's body (draft.back says the scheduling window with that draft is on top again)
function timeDraftBack(draft, start, end) { winDone(); draft.set(start, end); setTimeout(() => { if (!draft.back || draft.back()) winRedraw(); }, 0); }
function openTimeSheet(day, tok, draft) {
  tok = String(tok); const e = entryOfTok(tok); if (!e || !day) return; const sheet = document.getElementById('sheet'), esc = _escH, t = draft ? draft.t : entryTime(day, tok);
  const raw = e.sched ? rawSched(e.sched.id) : null, d = dayByKey(day), travel = !e.sched && isTravelItem(e.p), ctl = {};
  const draw = () => {
  sheet.innerHTML = `${fmHead(`🕐 ${nameB(entryName(e))}${raw ? ' ' + tipI('savedHere') : ''}`, 'ttClose')}
    <div class="sh-hint">${d ? esc(tmFmt('day', d.date)) : ''}${raw && raw.start ? `${SEP}במקור <bdi>${esc(raw.start)}${raw.end ? '–' + esc(raw.end) : ''}</bdi>` : ''}</div>
    <div class="sh-times"><label class="sh-field fm-f fm-dt"><span class="fm-lbl">התחלה</span>${fmInput({ id: 'ttStart', type: 'time', step: 300, dir: 'ltr', value: t ? t.start : '' })}</label><label class="sh-field fm-f fm-dt"><span class="fm-lbl">סיום <small class="fm-note">(לא חובה)</small></span><span class="fm-inrow">${fmInput({ id: 'ttEnd', type: 'time', step: 300, dir: 'ltr', value: t ? t.end || '' : '' })}<span role="button" tabindex="0" class="date-clr" id="ttEndClr" data-act="time.endClear" aria-label="מחיקת הסיום" title="מחיקת הסיום"${t && t.end ? '' : ' hidden'}>${msi('close', { size: 18 })}</span></span></label></div>
    ${t ? fmEndActs([{ act: 'time.del', id: 'ttNone', label: 'בלי שעה', ic: 'timer_off' }]) : ''}
    <div class="sh-error" id="ttErr" hidden></div>
    <div class="brow sheet-actions sheet-save-bar"><button class="btn-nav" id="ttSave" data-act="time.save">שמירה</button></div>`; // end-actions-followups (Q2): "בלי שעה" a neutral row of the end group
  const $ = q => sheet.querySelector(q), st = $('#ttStart'), en = $('#ttEnd'); // 5.1.0: the end is optional and never filled in for you
  
  const dropAnchor = () => { const an = planX().anchors[day]; if (an && an[tok]) { delete an[tok]; tidyAnchors(day); } };
  ctl.save = () => { const a = st.value; if (!a) { const er = $('#ttErr'); er.textContent = 'בחרו שעת התחלה'; er.hidden = false; return; }
    if (en.value && en.value <= a) { const er = $('#ttErr'); er.textContent = 'הסיום לפני ההתחלה'; er.hidden = false; return; }
    if (draft) { timeDraftBack(draft, a, en.value || ''); return; }
    planChange(`🕐 ${entryName(e)}: ${a}${en.value ? '–' + en.value : ''}${raw ? ' (רק אצלך)' : ''}`, () => { if (!e.sched && !findSlot(day, e.p.id)) ensureDay(day).unassigned.push(e.p.id); setEntryTime(day, tok, a, en.value || ''); dropAnchor(); }); winDone(); };
  ctl.del = () => { if (draft) { timeDraftBack(draft, '', ''); return; } planChange(`🕐 השעה הוסרה: ${entryName(e)}`, () => setEntryTime(day, tok, '', '')); winDone(); };
  const ec = $('#ttEndClr'); ctl.endClear = () => { en.value = ''; ec.hidden = true; };
  en.addEventListener('input', () => { if (ec) ec.hidden = !en.value; });
  };
  winOpen('openTimeSheet', 'שעה', draw); layerTop().ctl = ctl; // 5.1.0
}
// 4.52.0: the scheduling window, one look for every card: a grid of days, then for the day(s) the part of the day or a time.
// My places can be on several days (each day a switch); a note and a line of the organized schedule are one item on one day
// (choosing another day moves it).
function schedDaysHTML(days, isOn, isOff, act) { return `<div class="day-grid">${days.map(d => `<button type="button" class="day-cell t-wrap" data-act="${act}.day" data-v="${d.key}" data-active="${!!isOn(d)}"${isOff && isOff(d) ? ' disabled' : ''}><b>${d.label}</b><small>יום ${TRIP_DAYS.indexOf(d) + 1}</small></button>`).join('')}</div>`; }
// 10.4.0 (design-4, look.md "Scheduling window specifics"): each chosen day as a card - its label, the part of the day as one
// segmented control (בלי · בוקר · צהריים · ערב · שעה, the time in its segment), then the row's own buttons (the caller closes both)
function schedRowHTML(dayKey, slot, t, ref, act) { const d = dayByKey(dayKey); // sched-draft-all: every row has 🕐, also a day new in a draft
  return `<div class="sc-row"${ref ? ` data-ref="${ref}"` : ''}><b>${d.date && !isVirt(d.date) ? tmFmt('day', d.date) : d.label}<small>${SEP}יום ${TRIP_DAYS.indexOf(d) + 1}</small></b><div class="view-toggle seg sc-seg" role="group">${[['unassigned', 'בלי', ''], ['morning', 'בוקר', 'wb_sunny'], ['afternoon', 'צהריים', 'partly_cloudy_day'], ['evening', 'ערב', 'dark_mode']].map(([k, l, ic]) => `<button type="button" class="chip" data-act="${act}.slot" data-v="${k}" data-active="${!t && slot === k}" aria-pressed="${!t && slot === k}">${ic ? msi(ic, { size: 16 }) : ''}${l}</button>`).join('')}${`<button type="button" class="chip" data-act="${act}.time" data-active="${!!t}" aria-pressed="${!!t}">${msi('schedule', { size: 16 })}${t ? `<bdi>${t.start + (t.end ? '-' + t.end : '')}</bdi>` : 'שעה'}</button>`}</div><div class="sc-more">`; }
function openOneSchedSheet(tok) { // a note or a line of the organized schedule
  tok = String(tok); const sheet = document.getElementById('sheet'), esc = _escH, isS = tok.startsWith('s:'), s = isS ? rawSched(tok.slice(2)) : null; if (isS && !s) return;
  const draw = () => {
    const e = entryOfTok(tok); if (!e) { closeSheet(); return; }
    const curKey = isS ? (TRIP_DAYS.find(d => d.date === e.sched.date) || {}).key : dayOfItem(e.p.id), movable = isS ? schedMovable(e.sched.kind) : true;
    const t = curKey ? entryTime(curKey, tok) : null, slot = isS ? (e.sched.start ? '' : schedSlotOf(e.sched)) : (curKey ? findSlot(curKey, e.p.id) : '');
    sheet.innerHTML = `${fmHead(`${SY.days} שיבוץ${SEP}${isS ? msi(SCHED_MS[e.sched.kind] || 'push_pin', { size: 18, cls: 'msi-in' }) : itemIcon(e.p, { size: 18, cls: 'msi-in' })} ${nameB(entryName(e))}${isS ? ' ' + tipI('savedHere') : ''}`, 'spClose')}
      ${movable ? '' : '<div class="sh-hint">טיסה והגעה למלון מהתוכנייה קשורות להזמנה ונשארות בתאריך שלהן.</div>'}
      ${schedDaysHTML(TRIP_DAYS, d => d.key === curKey, d => !movable && d.key !== curKey, 'one')}
      ${curKey ? schedRowHTML(curKey, slot, t, '', 'one') + '</div></div>' : ''}
      ${isS && schedEdChanged(s) ? fmEndActs([{ act: 'one.reset', label: 'חזרה למקור', ic: 'restart_alt' }]) : ''}
      <div class="brow sheet-actions sheet-save-bar"><button class="btn-nav" data-act="win.done">✓ סיום</button></div>`; // end-actions-followups (Q2): the reset is a row of the end group
  };
  winOpen('openOneSchedSheet', 'שיבוץ', draw); winRef('tok:' + tok); // 5.1.0
}
// one entry in one day (its record: the window's token)
function oneSchedOf(tok) { const isS = tok.startsWith('s:'), s = isS ? rawSched(tok.slice(2)) : null, e = entryOfTok(tok); if (!e) return null;
  const curKey = isS ? (TRIP_DAYS.find(d => d.date === e.sched.date) || {}).key : dayOfItem(e.p.id);
  return { tok, isS, s, e, curKey, t: curKey ? entryTime(curKey, tok) : null, slot: isS ? (e.sched.start ? '' : schedSlotOf(e.sched)) : (curKey ? findSlot(curKey, e.p.id) : ''),
    unAnchor: k => { if (k && planX().anchors[k]) { delete planX().anchors[k][tok]; tidyAnchors(k); } } }; }
act('one.day', c => { const o = oneSchedOf(c.ref.id); if (!o) return; const { isS, s, e, curKey } = o, d = dayByKey(c.v); if (!d || d.key === curKey) return;
  planChange(`${SY.days} ${entryName(e)} הועבר ל-${d.label}${isS ? ' (רק אצלך)' : ''}`, () => { o.unAnchor(curKey);
    if (isS) { setSchedField(s, 'date', d.date); schedTidy(s.id); }
    else { const id = e.p.id, from = curKey && ensureDay(curKey), sl = (curKey && findSlot(curKey, id)) || 'unassigned', tm = curKey && getTime(curKey, id);
      if (from) Object.keys(from).forEach(k => { if (Array.isArray(from[k])) from[k] = from[k].filter(x => x !== id); }); if (curKey) delete STATE.times[timeKey(curKey, id)];
      ensureDay(d.key)[sl].push(id); if (tm) { STATE.times[timeKey(d.key, id)] = tm; placeTimed(d.key, id); } } }); });
act('one.slot', c => { const o = oneSchedOf(c.ref.id); if (!o) return; const { isS, s, e, curKey, t, slot } = o, k = c.v; if (k === slot && !t) return;
  planChange(SY.days + ' ' + (SLOT_SHORT[k] || 'בלי חלק ביום') + (t ? ' (בלי שעה)' : ''), () => { o.unAnchor(curKey);
    if (isS) { setSchedField(s, 'start', ''); setSchedField(s, 'end', ''); const ed = schedEdit(s); delete ed.slot; if (k !== schedInferSlot(schedEff(s))) ed.slot = k; schedTidy(s.id); }
    else { const dd = ensureDay(curKey), id = e.p.id; ['unassigned', 'morning', 'afternoon', 'evening'].forEach(x => { dd[x] = dd[x].filter(y => y !== id); }); dd[k].push(id); delete STATE.times[timeKey(curKey, id)]; } }); });
act('one.time', c => { const o = oneSchedOf(c.ref.id); if (o) openTimeSheet(o.curKey, o.tok); });
act('one.reset', c => { const o = oneSchedOf(c.ref.id); if (!o || !o.s) return; planChange('↺ חזר למקור: ' + o.s.title, () => { o.unAnchor(o.curKey); delete planX().sched[o.s.id]; }); });
function openSchedTimeSheet(sid) { const s = rawSched(sid); if (!s) return; const d = TRIP_DAYS.find(x => x.date === schedEff(s).date); if (d) openTimeSheet(d.key, 's:' + sid); }
// ✕ on a line of the organized schedule: hidden in my plan only; ↩️ at the end of the day brings it back
function hideSched(sid) {
  const s = rawSched(sid); if (!s) return; const e = schedEff(s);
  planChange('הוסר מהתוכנית: ' + e.title + ' (מחזירים ב"שהוסרו" בסוף היום)', () => { const ed = schedEdit(s); ed.hidden = true; });
}
function openSchedSheet(sid) { layerNote(openSchedSheet, arguments);
  const s = rawSched(sid); if (!s) return; const e = schedEff(s), changed = schedEdChanged(s), sheet = document.getElementById('sheet'), F = fmNew({ s });
  const src = [s.start ? fmEsc(s.start + (s.end ? '–' + s.end : '')) : 'בלי שעה', schedKindIc(s.kind, fmEsc(s.title)), s.note && fmEsc(s.note)].filter(Boolean).join(SEP); // HTML
  sheet.innerHTML = `${fmHead('✏️ ' + nameB(e.title) + ' ' + tipI('sched.edit'))}
    ${fmText(F, 'title', { label: 'כותרת', req: true, value: e.title })}
    ${fmChips(F, 'kind', { label: 'סוג', value: e.kind, options: Object.keys(SCHED_KIND_NAME).map(k => [k, schedKindIc(k, SCHED_KIND_NAME[k])]) })}
    ${fmText(F, 'note', { label: 'הערה', value: e.note || '' })}
    ${changed ? `<p class="sh-hint">במקור: ${src}</p>` : ''}
    ${changed ? fmEndActs([{ act: 'schedEdit.reset', label: 'חזרה למקור', ic: 'restart_alt' }]) : ''}
    ${fmSaveBar({ act: 'schedEdit.save' })}`; // 4.52.0: one place for each thing; editor-end-actions: "חזרה למקור" in the end group
  openSheet('openSchedSheet'); fmAttach(F);
}
act('schedEdit.save', c => { const F = fmOf(c.el); if (!F) return; const s = F.opts.s, title = fmGet(F, 'title'); if (!title) return fmFail(F, 'title', 'צריך כותרת');
  const kind = fmGet(F, 'kind'), note = fmGet(F, 'note'); closeSheet();
  planChange('✏️ הלו״ז עודכן אצלך: ' + title, () => { setSchedField(s, 'title', title); setSchedField(s, 'kind', kind); setSchedField(s, 'note', note); schedTidy(s.id); }); });
act('schedEdit.reset', c => { const F = fmOf(c.el); if (!F) return; const s = F.opts.s, day = (TRIP_DAYS.find(d => d.date === s.date) || {}).key; closeSheet();
  planChange('↺ חזר למקור: ' + s.title, () => { delete planX().sched[s.id]; if (day && planX().anchors[day]) { delete planX().anchors[day]['s:' + s.id]; tidyAnchors(day); } }); });
const SCHED_FIELD_LABEL = { date: 'תאריך', start: 'התחלה', end: 'סיום', kind: 'סוג', title: 'כותרת', note: 'הערה', placeId: 'מקום' };
function schedFieldText(k, v) {
  if (v == null || v === '') return '—';
  if (k === 'kind') return SCHED_KIND_NAME[v] || v; // 10.15.0: the word (its line icon where the kind is drawn as HTML)
  if (k === 'mode') return travelKindName({ mode: v }); if (k === 'fromLoc' || k === 'toLoc') return 'מיקום שנבחר'; // 11.0.0: a travel's fields
  if (k === 'placeId') return (POINTS.find(p => p.id === v) || {}).name || '—';
  if (k === 'date') return tmFmt('date', v);
  return String(v);
}
// 📝 the file changed an item I changed or removed: take the update, or keep mine
function openSchedUpdSheet(sid) { const ctl = {}; layerNote(openSchedUpdSheet, arguments);
  const s = rawSched(sid); if (!s) return; const ed = schedEd(s.id) || {}, keys = schedSrcUpdates(s), esc = _escH, sheet = document.getElementById('sheet');
  sheet.innerHTML = `${fmHead('📝 עודכן במקור', 'suClose')}
    <p>${ed.hidden ? 'הסרת את הפריט מהתוכנית, ומאז הוא השתנה בקובץ הטיול.' : 'שינית את הפריט, ומאז קובץ הטיול שינה אותו גם.'} <b>${esc(s.title)}</b></p>
    <div class="upd-rows">${keys.map(k => twoCardsHTML(SCHED_FIELD_LABEL[k] || SCHED_FIELD_NAME[k] || k, [{ cap: 'מהמקור', val: `<bdi>${esc(schedFieldText(k, s[k]))}</bdi>` },
      { cap: ed.hidden ? 'היה' : 'אצלי', val: `<bdi>${esc(schedFieldText(k, ed.hidden ? ed.base[k] : (ed.ch || {})[k]))}</bdi>`, on: true }])).join('')}</div>
    <div class="brow sheet-actions sheet-save-bar"><button class="btn-nav" id="suTake" data-act="schedUpd.suTake">✓ לקבל את העדכון</button><button class="sh-secondary" id="suKeep" data-act="schedUpd.suKeep">להשאיר את שלי</button></div>`;
  
  ctl.suTake = () => { closeSheet(); planChange('📝 העדכון התקבל: ' + s.title, () => { const e2 = schedEdit(s); if (e2.hidden) e2.hidden = false; else keys.forEach(k => { delete e2.ch[k]; }); e2.base = schedSnap(s); schedTidy(s.id); }); };
  ctl.suKeep = () => { closeSheet(); planChange('📝 נשאר כמו אצלך: ' + s.title, () => { schedEdit(s).base = schedSnap(s); }); };
  openSheet('openSchedUpdSheet'); layerTop().ctl = ctl;
}
ctlActs('schedUpd', ['suKeep', 'suTake']);
// ↩️ what was removed from that day - one list for every kind (4.53.0): the organized schedule I hid, and my places,
// copies and notes that ✕ took off. A tap brings each back to the same part of the day and time.
function openRestoreSheet(dayKey) { const ctl = {}; layerNote(openRestoreSheet, arguments);
  const d = dayByKey(dayKey); if (!d) return; const list = hiddenScheduleOf(d.date), mine = removedOf(dayKey), esc = _escH, sheet = document.getElementById('sheet');
  if (!list.length && !mine.length) { closeSheet(); return; }
  const nameOf = r => { const p = r.item ? { ...r.item } : planItem(r.id); return p ? (r.item ? msi(r.item.ref != null ? 'content_copy' : 'sticky_note_2', { cls: 'msi-in' }) + ' ' + esc(p.name || '') : msiTie(itemIcon(p, { cls: 'msi-in' }), esc(p.name || ''))) : ''; };
  sheet.innerHTML = `${fmHead(`↩️ מה שהוסר${SEP}${d.label}`, 'srClose')}
    ${mine.map((r, k) => `<div class="ps-row"><b>${r.time ? `<bdi dir="ltr">${esc(r.time.start)}</bdi> ` : ''}${nameOf(r)} <small>· ${r.item && r.item.ref == null ? 'הערה, הוסרה מהיום' : 'הוסר מהיום'}</small></b><button type="button" class="chip" data-act="restoreDay.rmback" data-rmback="${k}">${msi('undo', { size: 18 })} החזרה</button></div>`).join('')}
    ${list.map(s => `<div class="ps-row"><b>${s.start ? `${schedKindIc(s.kind, `<bdi dir="ltr">${esc(s.start)}</bdi>`)} ${esc(s.title)}` : schedKindIc(s.kind, esc(s.title))} <small>· מהלו״ז${schedSrcUpdates(s).length ? `${SEP}${msi('edit_note', { size: 16, cls: 'msi-in' })} עודכן במקור` : ''}</small></b><button type="button" class="chip" data-act="restoreDay.srback" data-srback="${esc(s.id)}">${msi('undo', { size: 18 })} החזרה</button></div>`).join('')}`;
  
  const again = () => { if (hiddenScheduleOf(d.date).length || removedOf(dayKey).length) openRestoreSheet(dayKey); else closeSheet(); };
  ctl.rmback = b => { const r = mine[+b.dataset.rmback]; if (!r) return;
    planChange('↺ חזר ליום: ' + ((r.item || planItem(r.id) || {}).name || ''), () => {
      if (r.item && !STATE.planItems[r.id]) STATE.planItems[r.id] = r.item;
      const dd = ensureDay(dayKey); if (!findSlot(dayKey, r.id)) (dd[r.slot] || dd.unassigned).push(r.id);
      if (r.time) { STATE.times[timeKey(dayKey, r.id)] = r.time; placeTimed(dayKey, r.id); }
      planX().removed[dayKey] = (planX().removed[dayKey] || []).filter(x => String(x.id) !== String(r.id)); });
    again(); };
  ctl.srback = b => { const s = rawSched(b.dataset.srback); if (!s) return;
    planChange('↺ חזר לתוכנית: ' + s.title, () => { const ed = schedEdit(s); ed.hidden = false; ed.base = schedSnap(s); schedTidy(s.id); });
    again(); };
  openSheet('openRestoreSheet'); layerTop().ctl = ctl;
}
ctlActs('restoreDay', ['rmback', 'srback']);

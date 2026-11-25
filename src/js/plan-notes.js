// 5.0.0: a note with an address is a place of the trip. The note forms show a layer choice (required) as soon as an address is
// typed; saving makes the place (in the trip, not in the destination) and puts it in the day instead of the note. 7.2.0: a field
// of the building blocks (chips that fit, or the choice window).
function noteLayerField(F, day) { const seg = destOfDayIn(activeTripObj(), day), d = seg && DESTS[seg.dest];
  if (!d) { delete F.kinds.nlayer; return '<div class="sh-field fm-f" data-fmw="nlayer" hidden></div>'; }
  const ls = destLayersEff(d).filter(l => !l.hidden), v = ls.some(l => String(l.id) === String(F.vals.nlayer)) ? String(F.vals.nlayer) : '';
  return fmChips(F, 'nlayer', { label: 'שכבה', req: true, value: v, hint: `עם כתובת זה מקום בטיול - על המפה, במסלול היום וב-${msi('location_on', { cls: 'msi-in' })} מקומות`, options: ls.map(l => [String(l.id), `<span class="dd-dot" style="background:${l.color}"></span>${ICON_EMOJI[l.icon] || ''} ${escH(l.label || l.name)}`]) }); }
function noteLayerSync(F) { const w = fmW(F, 'nlayer'); if (w) { w.hidden = !fmGet(F, 'addr'); F.req.nlayer = !w.hidden; if (!w.hidden) fmFit(w); } }
// the place a note becomes: in the trip, the destination of its day; my plan keeps pointing at it (fromFid: the note it replaces)
function notePlaceChange(o) {
  const t = activeTripObj(), seg = destOfDayIn(t, o.day), d = seg && DESTS[seg.dest]; if (!t.id || !d) return null;
  stashActive();
  let id = Date.now(); while ((t.places || []).some(p => p.id === id)) id++;
  t.places = (t.places || []).concat({ id, name: o.name, address: o.address, dest: d.id, layer: o.layer - d.idBase });
  const td = STATE.tripData[t.id];
  if (o.fromFid != null) { delete (td.planItems || {})[o.fromFid]; renameRefIn(td, o.fromFid, id); }
  loadPersonal(t.id); rebuildPoints();
  if (o.fromFid == null || !dayOfItem(id)) { if (!findSlot(o.day, id)) ensureDay(o.day).unassigned.push(id); }
  if (o.start) { STATE.times[timeKey(o.day, id)] = { start: o.start, end: o.end || '' }; placeTimed(o.day, id); }
  else if (o.start === '') delete STATE.times[timeKey(o.day, id)];
  persist(); 
  showUndoToast(`${SY.place} נשמר כמקום בטיול: ${o.name}`);
  return id;
}
// 4.52.0: editing a note is only its name and address (its day, part of the day and time are in 🗓️ and the time, like every card)
function openNoteEditSheet(id) { layerNote(openNoteEditSheet, arguments);
  const it = STATE.planItems[id]; if (!it) return; const sheet = document.getElementById('sheet'), F = fmNew({ id });
  sheet.innerHTML = `${fmHead('✏️ ' + nameB(it.name) + ' ' + tipI('note.when'))}
    ${fmText(F, 'name', { label: 'שם', req: true, value: it.name })}
    ${fmText(F, 'addr', { label: 'כתובת', note: '(לא חובה, בשביל ניווט ומפה)', value: it.address || '', dir: 'ltr', on: () => noteLayerSync(F) })}
    ${noteLayerField(F, dayOfItem(id))}
    ${fmEndActs([{ act: 'note.del', label: 'מחיקה', del: true }])}
    ${fmSaveBar({ act: 'note.save' })}`;
  openSheet('openNoteEditSheet'); winRef('note:' + id); fmAttach(F); noteLayerSync(F); fmRestart(F);
}
act('note.del', c => { const id = c.ref.id, it = STATE.planItems[id]; if (!it) return; layerCloseOwn(); const nm = it.name; planChange(SY.del + ' ההערה נמחקה: ' + nm, () => { TRIP_DAYS.forEach(d => { const dd = STATE.itinerary[d.key]; if (!dd) return; Object.keys(dd).forEach(k => { if (Array.isArray(dd[k])) dd[k] = dd[k].filter(x => x !== id); }); delete STATE.times[timeKey(d.key, id)]; }); delete STATE.planItems[id]; }); }); // 5.2.0
act('note.save', c => { const id = c.ref.id, F = fmOf(c.el); if (!F) return; const name = fmGet(F, 'name'), address = fmGet(F, 'addr');
  if (!name) return fmFail(F, 'name', 'צריך שם לפריט');
  if (address && F.kinds.nlayer) { const L0 = fmGet(F, 'nlayer'); if (!L0) return fmFail(F, 'nlayer', 'בוחרים שכבה - עם כתובת זה מקום בטיול'); // 5.0.0
    closeSheet(); notePlaceChange({ name, address, layer: Number(L0), day: dayOfItem(id), fromFid: id }); return; }
  closeSheet(); planChange('📝 הפריט עודכן', () => { STATE.planItems[id] = { ...STATE.planItems[id], name, address }; }); });
// 5.4.0: ＋ הערה - a new note for a day (name, optional address = a trip place, day, optional time). Existing items open their
// window; their time is in the one time window and their day in scheduling - this window is only for a new note.
function openNewNoteSheet(dayKey) { layerNote(openNewNoteSheet, arguments);
  const today = TRIP_DAYS.find(d => d.date === todayStr()), day = dayKey || (today && today.key) || TRIP_DAYS[0].key, sheet = document.getElementById('sheet'), F = fmNew({});
  sheet.innerHTML = `${fmHead('+ הערה חדשה')}
    ${fmText(F, 'name', { label: 'שם', req: true, placeholder: 'למשל: סיור מודרך' })}
    ${fmText(F, 'addr', { label: 'כתובת', note: '(לא חובה, בשביל ניווט ומפה)', dir: 'ltr', on: () => noteLayerSync(F) })}
    ${noteLayerField(F, day)}
    ${fmChips(F, 'day', { label: 'יום', value: day, options: TRIP_DAYS.map(d => [d.key, d.label]), on: v => { fmSwap(F, 'nlayer', noteLayerField(F, v)); noteLayerSync(F); } })}
    ${fmRange(F, 'start', 'end', { label: 'התחלה ' + tipI('note.noTime'), clear: true }, { label: 'סיום', note: '(לא חובה)', clear: true }, 'time')}
    ${fmSaveBar({ act: 'newNote.save' })}`;
  showSheetBackdrop('openNewNoteSheet'); fmAttach(F); noteLayerSync(F); fmRestart(F); // 5.0.0
}
act('newNote.save', c => { const F = fmOf(c.el); if (!F) return; const day = fmGet(F, 'day'), start = fmGet(F, 'start'), end = fmGet(F, 'end') || ''; // 5.1.0: the end is optional
  const name = fmGet(F, 'name'), address = fmGet(F, 'addr');
  if (!name) return fmFail(F, 'name', 'צריך שם להערה');
  if (end && start && end <= start) return fmFail(F, 'end', 'הסיום לפני ההתחלה');
  if (address && F.kinds.nlayer) { const L0 = fmGet(F, 'nlayer'); if (!L0) return fmFail(F, 'nlayer', 'בוחרים שכבה - עם כתובת זה מקום בטיול'); // 5.0.0: a note with an address is a place of the trip
    closeSheet(); notePlaceChange({ name, address, layer: Number(L0), day, start, end }); return; }
  const fid = 'n_' + Date.now().toString(36);
  planChange('📝 ההערה נוספה', () => { STATE.planItems[fid] = { name, address, icon: 'note' }; ensureDay(day).unassigned.push(fid); if (start) { STATE.times[timeKey(day, fid)] = { start, end }; placeTimed(day, fid); } });
  closeSheet(); });

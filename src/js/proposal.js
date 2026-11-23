// ================= SCHEDULE PROPOSAL FROM CLAUDE (11.5.0, task schedule-proposal) =================
// decisions/2026-11-07-schedule-proposal.md (Q1-Q9); the look: spec/look/targets.md "Schedule proposal". The app computes nothing: it
// asks Claude for a proposal (a request file), keeps the one that came back beside the trip's plan (td.proposal, registry row
// "proposal", in the plan part), shows it as the plan screen in preview and applies it - whole or a day - through the undo history.
// One proposal per trip. Fixed things (bookings with a day, the group's lines, travels) always come from the trip as it is now.
// td.proposal = { at, note, keep, n0, days: { dN: { note, items: [{ id, slot, start, end, must }], drop } }, applied: [dN], seen: { fixedKey: 1 }, sig: { dN: '…' } }
// td.planPrefs = Claude's planning answers 2-5 (pace, hours, who, special): sent back with the next request, where they are only confirmed.
const PROP_SLOTS = ['morning', 'afternoon', 'evening'], PROP_ANS = ['pace', 'hours', 'who', 'special'];
let PROP_VIEW = null;              // set while the preview's days are drawn: { marks, fixed, seen } (cdCard reads it)
let PROP_OPEN = null;              // the preview's open days
function propOf(id) { const td = (STATE.tripData || {})[id || STATE.activeTrip]; return (td && td.proposal) || null; }
function propSet(p, prefs) { const td = tdOf(STATE.activeTrip); if (p) td.proposal = p; else delete td.proposal; if (prefs) td.planPrefs = prefs; persist(); }
function propDays(P) { return TRIP_DAYS.map(d => d.key).filter(k => P && P.days && P.days[k]); } // the days still in the proposal, in the trip's order
function propMusts(P) { return propDays(P).reduce((n, k) => n + P.days[k].items.filter(x => x.must).length, 0); }
function propCan() { const t = activeTripObj(), st = tripState(t); return !!t.id && !ARCHIVE_VIEW && (st === 'before' || st === 'during') && !document.body.classList.contains('read-only'); }
const propN = n => n === 1 ? 'יום אחד' : n + ' ימים';
// ---- the trip's fixed things now ----
function propFixed() {
  const out = [], t = activeTripObj(), dk = iso => (TRIP_DAYS.find(d => d.date === iso) || {}).key;
  Object.entries(STATE.bookings || {}).forEach(([id, b]) => { const k = b && b.date && dk(b.date); if (!k) return; const tm = getTime(k, pid(id));
    out.push({ k: `b:${id}|${b.date}|${b.time || ''}`, what: 'booking', pid: pid(id), day: k, date: b.date, start: b.time || '', end: b.time ? ((tm && tm.end) || tmAddMin(b.time, 60)) : '', name: placeName(pid(id)) }); });
  TRIP_DAYS.forEach(d => scheduleOf(d.date).forEach(s => { if (isTravelKind(s.kind)) return;
    out.push({ k: `s:${s.id}|${d.date}|${s.start || ''}|${s.end || ''}`, what: 'group', id: s.id, kind: s.kind, day: d.key, date: d.date, start: s.start || '', end: s.end || '', name: s.title || '', ref: s.placeId }); }));
  travelsOf(t).forEach(f => { const k = dk(f.date); if (!k) return; const ad = Number(f.arriveDay) || 0;
    out.push({ k: `t:${f.id}|${f.date}|${f.depart || ''}`, what: 'travel', id: f.id, day: k, date: f.date, start: f.depart || '', end: !ad ? (f.arrive || '') : '23:59', arrive: f.arrive || '', arriveDay: ad, name: flightPlanName(f), from: f.from || '', to: f.to || '' }); });
  return out;
}
function propSeen() { return Object.fromEntries(propFixed().map(f => [f.k, 1])); }
function propSig(k) { const d = (STATE.itinerary || {})[k] || {}; return JSON.stringify(['morning', 'afternoon', 'evening', 'unassigned'].map(s => (d[s] || []).map(id => { const t = getTime(k, id); return [id, t ? t.start : '', t ? t.end || '' : '']; }))); }
function propSigs(keys) { return Object.fromEntries(keys.map(k => [k, propSig(k)])); }
function propEdited(P, k) { return !!(P.sig && P.sig[k] != null && P.sig[k] !== propSig(k)); }
const propOverlap = (a0, a1, b0, b1) => a0 < b1 && b0 < a1;
// ---- what applying these days makes of the plan (pure: nothing is written). Everything already in a day stays in it, unless the
// proposal places it in a day being applied (the owner, 12.11.2026); a booked place stays where its booking put it; a timed item that
// clashes with a fixed thing added since the proposal goes in without its time, in the same part of the day ----
function propBuild(keys, P) {
  const it = JSON.parse(JSON.stringify(STATE.itinerary || {})), times = { ...STATE.times }, marks = {}, fav = [], from = new Set();
  const day = k => { const d = it[k] = it[k] || {}; ['unassigned', 'morning', 'afternoon', 'evening'].forEach(s => { d[s] = d[s] || []; }); return d; };
  const where = id => Object.keys(it).find(k => /^d\d+$/.test(k) && dayByKey(k) && dayIds(it[k]).some(x => x === id));
  const fixed = propFixed(), seen = P.seen || {};
  keys.forEach(k => { const D = P.days[k]; if (!D) return; const dd = day(k), put = { morning: [], afternoon: [], evening: [] };
    D.items.forEach(x => { const p = planItem(x.id); if (!p) return;
      const bk = bookingOf(x.id); if (bk && bk.date) { if (bk.date === (dayByKey(k) || {}).date) marks[k + '|' + x.id] = { must: !!x.must }; if (x.must) fav.push(x.id); return; }
      const f = where(x.id);
      if (f) { ['unassigned', 'morning', 'afternoon', 'evening'].forEach(s => { it[f][s] = (it[f][s] || []).filter(y => y !== x.id); }); delete times[timeKey(f, x.id)]; if (f !== k) from.add(f); }
      let start = isHM(x.start) ? x.start : '', end = isHM(x.end) && x.end > start ? x.end : '', clash = false;
      if (start) { const e = end || tmAddMin(start, 60);
        clash = fixed.some(q => q.day === k && !seen[q.k] && q.kind !== 'free' && q.start && propOverlap(start, e, q.start, q.end || tmAddMin(q.start, 60)));
        if (clash) { start = ''; end = ''; } }
      const slot = PROP_SLOTS.includes(x.slot) ? x.slot : (isHM(x.start) ? slotForTime(x.start) : 'morning');
      put[start ? slotForTime(start) : slot].push(x.id);
      if (start) times[timeKey(k, x.id)] = { start, end };
      marks[k + '|' + x.id] = { nw: !f, mv: f && f !== k ? dayIdx(f) : 0, must: !!x.must, clash };
      if (x.must) fav.push(x.id); });
    PROP_SLOTS.forEach(s => { const row = put[s].concat(dd[s].filter(id => !put[s].includes(id))); // the proposal's order first, then what stays; timed ones among themselves by their time
      const ti = row.map((id, i) => times[timeKey(k, id)] ? i : -1).filter(i => i >= 0), sorted = ti.map(i => row[i]).sort((a, b) => times[timeKey(k, a)].start.localeCompare(times[timeKey(k, b)].start));
      ti.forEach((i, j) => { row[i] = sorted[j]; }); dd[s] = row; }); });
  return { it, times, marks, fav: [...new Set(fav.map(id => typeof id === 'string' && copyRef(id) != null ? copyRef(id) : id))].filter(id => typeof id === 'number'), from };
}
// ---- applying: whole, or one day. One undo row; a day applied leaves the proposal; must-sees become ⭐; Claude's note about a day
// becomes that day's note (a plan note); the general line is not kept (Q8) ----
function propApply(keys) {
  const P = propOf(); if (!P || !propCan()) return; keys = keys.filter(k => P.days[k] && dayByKey(k)); if (!keys.length) return;
  const all = propDays(P), whole = keys.length === all.length, edited = new Set(all.filter(k => propEdited(P, k))), R = propBuild(keys, P);
  STATE.itinerary = R.it; STATE.times = R.times; R.fav.forEach(id => STATE.favorites.add(id));
  const items = { ...STATE.planItems };
  keys.forEach((k, i) => { const note = String(P.days[k].note || '').trim(); if (!note) return; const fid = 'n_' + Date.now().toString(36) + i; items[fid] = { name: note, address: '', icon: 'note' }; ensureDay(k).unassigned.unshift(fid); });
  STATE.planItems = items;
  const days = { ...P.days }; keys.forEach(k => { delete days[k]; });
  const sig = { ...(P.sig || {}) }; Object.keys(days).forEach(k => { if (R.from.has(k) && !edited.has(k)) sig[k] = propSig(k); }); // a day the apply itself took a place from is not "edited by you"
  if (PROP_OPEN) keys.forEach(k => PROP_OPEN.delete(k));
  keys.forEach(k => openDays.add(k));
  propSet(Object.keys(days).length ? { ...P, days, sig, applied: [...(P.applied || []), ...keys] } : null);
  showUndoToast(whole && keys.length > 1 || (whole && !(P.applied || []).length) ? `הלו״ז מה-${AI} הוחל על ${propN(keys.length)}` : keys.length === 1 ? `יום ${dayIdx(keys[0])} מההצעה הוחל` : `הלו״ז מה-${AI} הוחל על ${propN(keys.length)}`);
}
function propDrop() { if (!propOf()) return; propSet(null); showUndoToast('הצעת הלו״ז מה-' + AI + ' נמחקה'); }
// when the trip ends an unapplied proposal goes quietly (Q6): the app's own change, in no undo row
function propExpire() { let n = 0; Object.keys(STATE.tripData || {}).forEach(id => { const td = STATE.tripData[id], t = STATE.trips[id]; if (!td || !td.proposal) return; const st = t ? tripState(t) : 'ended';
    if (st !== 'ended' && st !== 'archived') return; if (id === STATE.activeTrip) stashActive(); delete STATE.tripData[id].proposal; n++; try { hAbsorb(hKey(['d', id, 'proposal'])); } catch (e) {} });
  if (n) persist(true); return n; }
// ---- a proposal arrives. In a file its days are dates (or day numbers) and its places "@dest:id" / a trip place's number ----
function propDayKey(t, x) { if (x == null) return null; if (x.date) { const i = tripDayList(t).findIndex(d => d.date === x.date); return i >= 0 ? 'd' + (i + 1) : null; }
  const n = Number(x.day); return n >= 1 && n <= tripLen(t) ? 'd' + n : null; }
function propFromFile(fp, t, o) { // -> { days, note, keep, answers } with this device's ids (null: nothing usable). o.gone(ref): a place dropped in the draft
  if (!fp || typeof fp !== 'object' || fp.status !== 'answered' || !Array.isArray(fp.plan)) return null; o = o || {};
  const days = {}, used = new Set(), hotels = new Set((t.lodging || []).map(l => l.placeId));
  fp.plan.forEach(d => { const k = propDayKey(t, d); if (!k || days[k] || !d || !Array.isArray(d.items)) return; let drop = false; const items = [];
    d.items.forEach(x => { if (!x || x.ref == null) return; if (o.gone && o.gone(x.ref)) { drop = true; return; }
      const id = deviceRef(x.ref); if (id == null || typeof id !== 'number' || used.has(id) || hotels.has(id)) return; used.add(id);
      items.push({ id, slot: PROP_SLOTS.includes(x.slot) ? x.slot : (isHM(x.start) ? '' : 'morning'), start: isHM(x.start) ? x.start : '', end: isHM(x.end) ? x.end : '', ...(x.must === true ? { must: true } : {}) }); });
    if (items.length || drop) days[k] = { note: String(d.note || '').slice(0, 400), items, ...(drop ? { drop: true } : {}) }; });
  if (!Object.keys(days).length) return null;
  const a = fp.answers && typeof fp.answers === 'object' ? Object.fromEntries(PROP_ANS.filter(k => typeof fp.answers[k] === 'string' && fp.answers[k].trim()).map(k => [k, fp.answers[k].trim().slice(0, 300)])) : null;
  return { days, note: String(fp.note || '').slice(0, 400), keep: fp.keep === true, answers: a && Object.keys(a).length ? a : null };
}
// the proposal into the trip's data (the trip must be the active one for the fixed things and the days' signatures)
function propStore(X) { const keys = Object.keys(X.days), had = propOf();
  propSet({ at: Date.now(), note: X.note, keep: X.keep, n0: keys.length, days: X.days, applied: [], seen: propSeen(), sig: propSigs(keys) }, X.answers || undefined);
  PROP_OPEN = null; return !!had; }
// a proposal file for a trip that is here (kind "proposal"): it waits at the top of that trip's plan; a new one replaces the old (undo)
function receiveProposal(data) {
  if (!layerLeave(() => receiveProposal(data))) return; // windows-inner-steps (Q7): a file shared in waits for an unsaved change below to be saved or left
  const t = STATE.trips[data.tripId]; if (!t) { showToast('ההצעה היא לטיול שלא נמצא בטלפון הזה'); return; }
  const st = tripState(t); if (st === 'ended' || st === 'archived') { showToast('הטיול הזה כבר הסתיים'); return; }
  if (data.tripId !== STATE.activeTrip) switchTrip(data.tripId, true);
  const X = propFromFile(data.proposal, activeTripObj()); if (!X) { showToast('לא נמצאה בקובץ הצעת לו״ז לימים של הטיול'); return; }
  closeAllSheets(); const had = propStore(X); if (activeTab !== 'itinerary') goTab('itinerary'); appScroll(0);
  showUndoToast(fileDroppedNote(had ? 'הצעה חדשה מה-' + AI + ' החליפה את הקודמת' : `התקבלה הצעת לו״ז מה-${AI}${SEP}${propN(Object.keys(X.days).length)}`, data._dropped)); // item 7: what the entry check dropped joins this message
}
// a proposal that came inside a trip file (a new trip from the draft, or an update): stored after the trip is in (importTripNow), no toast of its own
function propAfterImport(data, nid, gone) { if (!data || !data.proposal || nid !== STATE.activeTrip) return;
  const X = propFromFile(data.proposal, activeTripObj(), gone ? { gone } : null); if (X) propStore(X); }
// days moved, added or parked (rebuildTripDays): the proposal's days follow the plan's; a day that left the trip leaves the proposal
function propRemap(td, mapK) { const P = td && td.proposal; if (!P) return; const days = {}, sig = {};
  Object.keys(P.days || {}).forEach(k => { const j = mapK(k); if (j == null) return; days['d' + j] = P.days[k]; if (P.sig && P.sig[k] != null) sig['d' + j] = P.sig[k]; });
  if (Object.keys(days).length) td.proposal = { ...P, days, sig, applied: (P.applied || []).map(k => { const j = mapK(k); return j == null ? null : 'd' + j; }).filter(Boolean) }; else delete td.proposal; }
// ---- the arrival row at the top of the plan (no ✕: the preview drops it) ----
function propRowHTML() { const P = propOf(); if (!P || !propCan()) return ''; const n = propDays(P).length; if (!n) return '';
  const ap = (P.applied || []).filter(k => dayByKey(k)).map(dayIdx).sort((a, b) => a - b), m = propMusts(P);
  const sub = ap.length ? `נותרו ${propN(n)} בהצעה${SEP}${ap.length === 1 ? 'יום ' + ap[0] : 'ימים ' + ap.join(', ')} כבר אצלך` : `${propN(n)}${m ? `${SEP}${m} לא לפספס` : ''}${SEP}התוכנית שלך לא השתנתה`;
  return `<button type="button" class="prop-row t-wrap" id="propRow" data-act="prop.view">${claudeMark({ size: 24 })}<span class="prop-row-t"><b>הצעת לו״ז מה-${AI}</b><small>${sub}</small></span><span class="prop-row-go">לעיון</span></button>`; }
// ---- the doors: an empty plan's one empty state; a button in the plan's top row (Q7) ----
function planEmpty() { return !TRIP_DAYS.some(d => mergedIds(d.key).some(id => !isTravelItem(planItem(id))) || scheduleOf(d.date).some(s => !isTravelKind(s.kind))); } // travels alone are not a plan yet
function propAskBtn(id) { return `<button type="button" class="chip prop-ask"${id ? ` id="${id}"` : ''} data-act="prop.ask">${claudeMark({ size: 18 })}לו״ז מה-${AI}</button>`; }
function planEmptyHTML() { return `<div class="card plan-empty">${emptyHTML(msi('event_note'), 'משבצים מקומות מהרשימה, או מבקשים מה-' + AI + ' הצעה ראשונה', '', 'התוכנית עוד ריקה')}${propCan() ? propAskBtn('propAskEmpty') : ''}</div>`; }
// ---- the request window: which days, "keep what I placed", what Claude will do, copy the instructions / send the request ----
function propAskDays(F) { const all = TRIP_DAYS.filter(d => !(tripState(activeTripObj()) === 'during' && d.date < todayStr())).map(d => d.key), mode = fmGet(F, 'which');
  return mode === 'empty' ? all.filter(k => !mergedIds(k).length) : mode === 'pick' ? all.filter(k => (F.opts.picked || []).includes(k)) : all; }
function openPropAsk() { layerNote(openPropAsk, arguments); if (!propCan()) return;
  const F = fmNew({ picked: [] }), st = tripState(activeTripObj()), all = TRIP_DAYS.filter(d => !(st === 'during' && d.date < todayStr())), emp = all.filter(d => !mergedIds(d.key).length), has = all.some(d => mergedIds(d.key).some(id => !isTravelItem(planItem(id))));
  const opts = [['all', `כל הימים${SEP}${all.length}`]].concat(emp.length && emp.length < all.length ? [['empty', `רק ימים ריקים${SEP}${emp.length}`]] : [], [['pick', 'לבחור ימים']]);
  // 11.7.0 (schedule-proposal-followups, the 11.5.0 review's Q5): while a proposal waits, one muted line says what sending will do - a status of the
  // action at the moment of deciding (days may pass before the answer arrives), not an explanation; with no waiting proposal it is not there
  const body = [propOf() ? `<p class="sh-hint prop-wait">יש הצעה שמחכה בתכנון${SEP}הצעה חדשה תחליף אותה</p>` : '', fmChips(F, 'which', { label: 'לאילו ימים', value: 'all', options: opts, on: (v, F2) => { if (v === 'pick') propPickDays(F2); } }),
    has ? fmChecks(F, 'keep', { items: [{ k: 'keep', label: 'לשמור על מה שכבר שיבצתי', sub: 'ה-' + AI + ' בונה סביבו ולא מזיז אותו' }], value: ['keep'] }) : ''];
  partsWin(F, { key: 'openPropAsk', title: claudeH(TX.claude.schedule.title), body, goal: 'schedule', kind: 'trip', send: { act: 'prop.send', label: msi('send', { size: 18 }) + ' שליחת הבקשה' } });
  const sh = document.getElementById('sheet'); if (sh) sh.classList.add('prop-ask-win');
}
function propPickDays(F) { const all = TRIP_DAYS.filter(d => !(tripState(activeTripObj()) === 'during' && d.date < todayStr()));
  // picker-rule: it fills the form's field - a draft until "✓ סיום"; every other close leaves the field as it was
  openFmChoice({ key: 'propPickDays', as: 'chips', multi: 'draft', draft: () => (fmLive(F).opts.picked || []).slice(), title: d => `${SY.days} לבחור ימים${d.length ? SEP + d.length : ''}`, options: all.map(d => ({ v: d.key, html: _escH(d.label), text: d.label })) },
    d => { const G = fmLive(F); G.opts.picked = all.map(x => x.key).filter(k => d.includes(k)); }); } // the live form (11.15.1, Q2); in the days' order
function propRequestFile(keys, keep) {
  const id = STATE.activeTrip, t = activeTripObj(), dated = !!t.start, td = STATE.tripData[id] || {}, ref = x => portableRef(x, t), dd = k => { const d = dayByKey(k); return dated ? { date: d.date } : { day: dayIdx(k) }; };
  const out = buildTripFile(id, PART_LIST.filter(k => /^(trip|dests|edits)$/.test(k)), false, null);
  const fixed = propFixed().map(f => { const d = dated ? { date: f.date } : { day: dayIdx(f.day) };
    return f.what === 'booking' ? { what: 'booking', ref: ref(f.pid), name: f.name, ...d, start: f.start, end: f.end } : f.what === 'group' ? { what: 'group', id: f.id, kind: f.kind, name: f.name, ...d, start: f.start, end: f.end, ...(f.ref != null && f.ref !== '' ? { ref: ref(f.ref) } : {}) }
      : { what: 'travel', id: f.id, name: f.name, ...d, start: f.start, end: f.arrive, arriveDay: f.arriveDay, from: f.from, to: f.to }; })
    .concat((t.lodging || []).map(l => ({ what: 'lodging', id: l.id, name: l.name || '', ...(dated ? { from: l.checkIn, to: l.checkOut } : { fromDay: daysBetween(VDATE, l.checkIn) + 1, toDay: daysBetween(VDATE, l.checkOut) + 1 }), ...(l.placeId != null ? { ref: ref(l.placeId) } : {}) })));
  const current = TRIP_DAYS.filter(d => mergedIds(d.key).length).map(d => ({ ...dd(d.key), items: ['morning', 'afternoon', 'evening', 'unassigned'].flatMap(s => ensureDay(d.key)[s].map(pidv => { const p = planItem(pidv); if (!p || isTravelItem(p)) return null; const tm = getTime(d.key, pidv) || {}, slot = s === 'unassigned' ? '' : s;
    return isNote(p) ? { note: p.name, slot, start: tm.start || '', end: tm.end || '' } : { ref: ref(p.dup ? copyRef(p.id) : p.id), name: p.name, slot, start: tm.start || '', end: tm.end || '' }; }).filter(Boolean)) }));
  out.proposal = { status: 'asked', askedAt: new Date().toISOString(), days: keys.map(k => dated ? dayByKey(k).date : dayIdx(k)), keep: !!keep, answers: td.planPrefs || null, stars: [...STATE.favorites].map(ref), fixed, current };
  delete out._claude; return withClaude(out, 'schedule');
}
// ---- the preview: the plan screen showing the proposal in place of the plan (a screen over the plan) ----
function propTagsFor(o) { const V = PROP_VIEW, tok = (/data-ipid="([^"]+)"/.exec(o.attrs || '') || [])[1], day = (/data-iday="([^"]+)"/.exec(o.attrs || '') || [])[1], tags = [];
  const tag = (cls, ic, w, fill) => `<span class="tl-tag pv-tag ${cls}">${msi(ic, { fill: !!fill })}${w}</span>`, after = '<span class="pv-after">נוסף אחרי ההצעה</span>';
  if (tok == null || !day) return tags;
  if (/\btl-(sched|travel)\b/.test(o.cls || '')) { if (/\btl-land\b/.test(o.cls || '')) return tags; tags.push(tag('pv-fix', 'lock', 'קבוע'));
    const f = V.fixed.find(q => q.what !== 'booking' && q.day === day && (String(q.id) === tok || 's:' + q.id === tok || String(q.id) === tok.replace(/^s:/, '')));
    if (f && !V.seen[f.k]) tags.push(after); return tags; }
  const id = pid(tok), mk = V.marks[day + '|' + id], bk = bookingOf(id);
  if (mk && mk.clash) tags.push(tag('pv-clash', 'schedule', 'השעה בוטלה בגלל התנגשות'));
  if (mk && mk.nw) tags.push(tag('pv-new', 'auto_awesome', 'חדש'));
  if (mk && mk.mv) tags.push(tag('pv-mv', 'swap_horiz', 'זז מיום ' + mk.mv));
  if (mk && mk.must) tags.push(tag('pv-must', 'flag', 'לא לפספס', true));
  if (bk && bk.date) { tags.push(tag('pv-fix', 'lock', 'קבוע')); if (!V.seen[`b:${id}|${bk.date}|${bk.time || ''}`]) tags.push(after); }
  return tags; }
function propCard(o) { return { ...o, body: '', vis: '', acts: '', cls: (o.cls || '').replace(/\bg-swipe\b/, '') + ' pv-card', tags: (o.tags || []).concat(propTagsFor(o)) }; }
function propDayHTML(d, P, R) { const D = P.days[d.key], open = PROP_OPEN.has(d.key);
  const saved = { it: STATE.itinerary, times: STATE.times }; let tl = '', total = 0;
  STATE.itinerary = R.it; STATE.times = R.times; PROP_VIEW = { marks: R.marks, fixed: propFixed(), seen: P.seen || {} };
  try { total = mergedIds(d.key).length + scheduleOf(d.date).length; if (open) tl = dayTimelineHTML(d); } finally { STATE.itinerary = saved.it; STATE.times = saved.times; PROP_VIEW = null; }
  const nw = D.items.filter(x => { const m = R.marks[d.key + '|' + x.id]; return m && (m.nw || m.mv); }).length, info = dayHeadInfo(d);
  const lines = (propEdited(P, d.key) ? `<div class="pv-line">${msi('edit_calendar', { size: 18 })}<span>שינית את היום הזה אחרי שההצעה נבנתה</span></div>` : '') + (D.drop ? `<div class="pv-line">${msi('playlist_remove', { size: 18 })}<span>מקום שהורדת בטיוטה ירד מהיום הזה</span></div>` : '')
    + (String(D.note || '').trim() ? `<div class="pv-say pv-daysay">${msi('chat', { size: 18 })}<span>${_escH(D.note)}</span></div>` : '');
  return `<div class="accordion-item day-item pv-day" data-day-item="${d.key}" data-ref="day:${d.key}" data-open="${open}"><div class="pv-dh"><button type="button" class="accordion-header day-head t-wrap" data-act="prop.day"><span class="dh-t"><b>${glueText(_escH(info.title))}</b><small>${total} בתוכנית${nw ? `${SEP}${nw === 1 ? 'אחד חדש' : nw + ' חדשים'}` : ''}</small></span></button><button type="button" class="pv-only" data-act="prop.applyDay">${msi('check', { size: 18 })}רק את היום</button><button type="button" class="pv-arrow" data-act="prop.day" aria-label="פתיחה וסגירה של היום">${msi('expand_more')}</button></div>
    <div class="accordion-body">${open ? `${lines}<div class="tl pv-tl">${tl}</div>` : ''}</div></div>`; }
function renderProposalScreen() { const main = document.getElementById('main'), P = propOf(), keys = P ? propDays(P) : [];
  if (!keys.length || !propCan()) { main.innerHTML = ''; setTimeout(() => { const e = screenTop(); if (e && e.tab === 'proposal') layerBack(false); }, 0); return; }
  if (!PROP_OPEN) PROP_OPEN = new Set([keys[0]]);
  const R = propBuild(keys, P), part = (P.applied || []).length > 0, tag = (cls, ic, w, fill) => `<span class="tl-tag pv-tag ${cls}">${msi(ic, { fill: !!fill })}${w}</span>`;
  main.innerHTML = `${String(P.note || '').trim() ? `<div class="pv-say">${msi('chat', { size: 20 })}<span>ה-${AI}: ${_escH(P.note)}</span></div>` : ''}
    <div class="pv-legend">${tag('pv-new', 'auto_awesome', 'חדש')}${tag('pv-mv', 'swap_horiz', 'זז מיום X')}${tag('pv-must', 'flag', 'לא לפספס', true)}${tag('pv-fix', 'lock', 'קבוע')}</div>
    <div class="accordion pv-days">${TRIP_DAYS.filter(d => P.days[d.key]).map(d => propDayHTML(d, P, R)).join('')}</div>
    <div class="dr-dock pv-dock"><button type="button" class="pv-later" id="pvLater" data-act="prop.later">${msi('schedule', { size: 18 })}לא עכשיו</button><button type="button" class="btn-nav pv-apply" id="pvApply" data-act="prop.applyAll">${msi('done_all', { size: 18 })}${part ? 'להחיל ' + propN(keys.length) : 'להחיל את ההצעה'}</button></div>`;
  const e = screenTop(), tools = e && e.tab === 'proposal' && e.el.querySelector('.screen-tools');
  if (tools) tools.innerHTML = `${claudeMark({ size: 24 })}<b class="pv-tt">הצעת לו״ז מה-${AI}</b><button type="button" class="pv-drop" id="pvDrop" data-act="prop.drop">לוותר על ההצעה</button><small class="pv-sub">${part ? `נותרו ${propN(keys.length)}${SEP}עוד לא אצלך` : ('תצוגה מקדימה' + SEP + 'התוכנית שלך עוד לא השתנתה')}</small>`;
}
function propClose() { const e = screenTop(); if (e && e.tab === 'proposal') layerBack(false); }
act('prop.view', () => { PROP_OPEN = null; openScreen('proposal'); return 'quiet'; });
act('prop.ask', () => { openPropAsk(); return 'quiet'; });
act('prop.day', c => { const k = c.ref.id; if (PROP_OPEN.has(k)) PROP_OPEN.delete(k); else { PROP_OPEN.add(k); revealLater(`#main [data-day-item="${k}"]`, false); } return 'redraw'; });
act('prop.later', () => { propClose(); return 'quiet'; });
act('prop.applyAll', () => { const P = propOf(); if (!P) return; const keys = propDays(P); propClose(); propApply(keys); });
act('prop.applyDay', c => { const k = c.ref.id; propClose(); propApply([k]); });
act('prop.drop', () => { propClose(); propDrop(); });
act('prop.send', async c => { const F = fmOf(c.el); if (!F) return; const keys = propAskDays(F), t = activeTripObj();
  if (!keys.length) return fmFail(F, 'which', 'בוחרים לפחות יום אחד');
  const keep = !F.kinds.keep || (fmGet(F, 'keep') || []).includes('keep');
  if (await shareJson(propRequestFile(keys, keep), `${PACK.fileName}-schedule-request-${fileStamp()}.json`)) { logEvent(`נשלחה ל-${AI} בקשה להצעת לו״ז: ${t.name}`, true); closeSheet(); } });
// ---- the draft's row: a proposal that came with a new trip (Q9) - information only, with its ⓘ ----
function draftPropN(D) { const d = D && D.data, fp = d && d.kind === 'trip' && d.proposal; if (!fp || fp.status !== 'answered' || !Array.isArray(fp.plan)) return 0;
  const seen = new Set(); fp.plan.forEach(x => { const k = propDayKey(d.trip, x); if (k && x && Array.isArray(x.items) && x.items.length) seen.add(k); }); return seen.size; }
function draftPropHTML(D) { const n = draftPropN(D); return n ? `<div class="dr-prop" id="drProp">${claudeMark({ size: 22 })}<b>הצעת לו״ז${SEP}${propN(n)}</b>${tipI('draft.proposal')}</div>` : ''; }
function draftPropGone(D) { return r => typeof r === 'string' && r[0] === '@' ? !!D.off[r.slice(1)] : !!D.off['trip:' + r]; } // a place dropped in the draft leaves the proposal
undoAfter(() => { PROP_OPEN = null; });

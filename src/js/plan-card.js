// ✈️ a travel in the plan: a tap shows its details; it is edited there (its time comes from the travel)


let openDays = new Set(TRIP_DAYS[0] ? [TRIP_DAYS[0].key] : []);

// The organized schedule is part of my plan: my changes are a layer over the file (planX.sched), kept when the file is
// updated, and "📝 עודכן במקור" when the file changed what I changed. Untimed entries keep the place I dragged them to
// (planX.anchors: the entry before them in that day's part).
const SCHED_FIELDS = ['date', 'start', 'end', 'kind', 'title', 'note', 'placeId', 'mode', 'from', 'to', 'fromLoc', 'toLoc', 'airline', 'number', 'terminal', 'arriveDay', 'before', 'after']; // 11.0.0: a line of a travel's kind carries the travel's fields
const schedV = x => x == null ? '' : typeof x === 'object' ? JSON.stringify(x) : String(x);
const SCHED_KIND_NAME = { tour: 'סיור', walk: 'הליכה', meal: 'ארוחה', free: 'זמן חופשי', transfer: 'העברה', flight: 'טיסה', hotel: 'לינה', activity: 'פעילות', show: 'מופע' };
function planX() { const x = STATE.planX = STATE.planX || {}; delete x.locks; /* 9.2.0 (ס6): no locks any more */ x.anchors = x.anchors || {}; x.sched = x.sched || {}; x.removed = x.removed || {}; return x; }
// 4.53.0: what ✕ took off a day (my place, a copy, a note) - kept per day, so "↩️ שהוסרו" at the end of the day brings it back, like the organized schedule
function removedOf(dayKey) { return (planX().removed[dayKey] || []).filter(r => r.item || planItem(r.id)); }
function rawSchedule() { return activeTripObj().schedule || []; }
function rawSched(sid) { return rawSchedule().find(x => String(x.id) === String(sid)) || null; }
function schedEd(sid) { return planX().sched[sid] || null; }
function schedSnap(s) { const o = {}; SCHED_FIELDS.forEach((k, i) => { if (i < 7 || (s[k] != null && s[k] !== '')) o[k] = s[k] == null ? '' : s[k]; }); return o; } // 11.0.0: a travel's fields only when set (schedV reads a missing one as '')
function schedEff(s) { const ed = schedEd(s.id); return ed && ed.ch && Object.keys(ed.ch).length ? { ...s, ...ed.ch } : s; }
function schedEdChanged(s) { const ed = s && schedEd(s.id); return !!(ed && ed.ch && Object.keys(ed.ch).length); }
// 4.37.0: what I changed, in words - "שעה 11:00 (במקור 10:00) · הערה"
const SCHED_FIELD_NAME = { date: 'תאריך', start: 'שעה', end: 'שעת סיום', kind: 'סוג', title: 'כותרת', note: 'הערה', placeId: 'מקום', mode: 'סוג', from: 'מ-', to: 'אל', fromLoc: 'מיקום היציאה', toLoc: 'מיקום ההגעה', airline: 'חברה', number: 'מספר', terminal: 'טרמינל', arriveDay: 'יום ההגעה', before: 'זמן לפני', after: 'זמן אחרי' };
function schedChangeText(s) {
  const ed = s && schedEd(s.id); if (!ed || !ed.ch) return '';
  return Object.keys(ed.ch).map(k => k === 'start' || k === 'end' ? `${SCHED_FIELD_NAME[k]} ${ed.ch[k] || '—'}${s[k] ? ` (במקור ${s[k]})` : ''}` : k === 'date' ? `הוזז מיום ${tmFmt('day', s.date)}` : (SCHED_FIELD_NAME[k] || k)).join(SEP);
}
function schedSrcUpdates(s) { // what the file changed since I changed (or removed) the item
  const ed = s && schedEd(s.id); if (!ed || !ed.base) return [];
  const keys = ed.hidden ? SCHED_FIELDS : Object.keys(ed.ch || {}), v = schedV;
  return keys.filter(k => v(s[k]) !== v(ed.base[k]));
}
function schedEdit(s) { const x = planX(), ed = x.sched[s.id] = x.sched[s.id] || {}; ed.ch = ed.ch || {}; if (!ed.base) ed.base = schedSnap(s); return ed; }
function setSchedField(s, k, val) { const ed = schedEdit(s), v = schedV; if (v(val) === v(s[k])) delete ed.ch[k]; else ed.ch[k] = val; }
function schedTidy(sid) { const x = planX(), ed = x.sched[sid]; if (ed && !ed.hidden && !(ed.ch && Object.keys(ed.ch).length) && !ed.slot) delete x.sched[sid]; }
function scheduleOf(iso) { return rawSchedule().filter(s => !(schedEd(s.id) || {}).hidden).map(schedEff).filter(s => s.date === iso).sort((a, b) => String(a.start || '99').localeCompare(String(b.start || '99'))); }
function hiddenScheduleOf(iso) { return rawSchedule().filter(s => (schedEd(s.id) || {}).hidden && schedEff(s).date === iso); } // 4.49.0: on the day it was on when hidden (also after 🗓️ moved it)
function entryTok(e) { return e.land ? 'land:' + e.land.id : e.sched ? 's:' + e.sched.id : String(e.p.id); } // travels-2-plan: a landing row is an entry of the day's chain
function entryOfTok(tok) { if (String(tok).startsWith('s:')) { const s = rawSched(tok.slice(2)); return s ? { sched: schedEff(s) } : null; } const p = planItem(pid(tok)); return p ? { p } : null; }
function isTravelItem(p) { return !!(p && isNote(p) && p.travel); } // 11.0.0 (Q16): a note's airport icon no longer makes it a travel
function entryName(e) { return e.sched ? e.sched.title : (e.p && e.p.name) || ''; }
const _escH = escH;
// 10.2.0 (design-2): no time column and no source symbols - the time is the first chip of the tags row: "14:30" (a tap changes
// it), "קביעת שעה" when there is none, or "הוזמן · 16:00" when booked for that time (a tap opens the booking); a travel's time
// is only shown (its editor, from the card's window, changes it); a group item says "קבוצתי" in its tags.
function planTimeChip(day, e, t) {
  if (!e.sched && isTravelItem(e.p)) { if (!t || !t.start) return '';
    const tf = tripFlights().find(x => x.id === e.p.id), ld = tf ? Number(tf.arriveDay) || 0 : 0; // 7.0.0 (ז9): a landing on another day
    const end = ld && isHM(tf.arrive) ? `${_escH(tf.arrive)}<sup class="sym-tip" data-act="tip" data-v="sym.nextDay">${ld > 0 ? '+' : '−'}${Math.abs(ld)}</sup>` : (t.end && t.end !== t.start ? _escH(t.end) : '');
    return travelTimeChip(e.p.id, `${_escH(t.start)}${end ? '–' + end : ''}`); }
  if (!e.sched) { const p = e.p, base = p.dup ? copyRef(p.id) : (p.planOnly ? null : p.id), bk = base != null && !isNote(p) ? bookingOf(base) : null, dd = dayByKey(day);
    if (bk && bk.time && dd && bk.date === dd.date) return `<button type="button" class="tl-tag cd-when bkd" data-act="place.booking" title="הוזמן לשעה הזו - נגיעה פותחת את ההזמנה">${tagIc('event_available')}הוזמן${SEP}<span dir="ltr">${_escH(bk.time)}</span></button>`; }
  return t && t.start ? `<button type="button" class="tl-tag cd-when time" data-act="plan.time" aria-label="שינוי השעה">${tagIc('schedule')}<span dir="ltr">${_escH(t.start)}${t.end && t.end !== t.start ? '–' + _escH(t.end) : ''}</span></button>`
    : `<button type="button" class="tl-tag cd-when settime" data-act="plan.time">${tagIc('more_time')}קביעת שעה</button>`;
}
// the visited toggle: a check circle (grey outline / filled green) with a small "היינו" under it, at the card's top left - from
// the trip's first day (and in a trip that ended). A tap toggles; a swipe on the card (right marks, left unmarks) is its shortcut.
function visMarkOn() { const s = tripState(activeTripObj()); return s === 'during' || s === 'ended' || s === 'archived' || !!ARCHIVE_VIEW; }
function visBtnHTML(id, visited) { if (!visited && !visMarkOn()) return ''; return `<button type="button" class="tl-vis" data-act="place.visit" data-active="${visited}" aria-pressed="${visited}" aria-label="${visited ? TX.visited + ' - נגיעה מבטלת' : 'סימון: ' + TX.visited}" title="${TX.visited}: נגיעה, או החלקה ימינה על הכרטיס (שמאלה מבטלת)">${msi('check_circle', { size: 22 })}<span>${TX.visited}</span></button>`; }
// the booking tag (a tap opens the booking window, also in the mini card): booked (with its time), must, recommended
function bookTag(bk, rc) { const rv = `type="button" data-act="place.booking" title="הזמנה: מה זה, וסימון כהוזמן"`;
  return bk ? `<button ${rv} class="tl-tag ok">${tagIc('event_available')}הוזמן${bk.time ? `${SEP}<span dir="ltr">${_escH(bk.time)}</span>` : ''}</button>` : rc === 'resv-must' ? `<button ${rv} class="tl-tag must">${tagIc('event')}חובה להזמין</button>` : rc === 'resv-rec' ? `<button ${rv} class="tl-tag rec">${tagIc('event')}מומלץ להזמין</button>` : ''; }
const planRmBtn = l => `<button type="button" class="tl-act tl-rm a-rm" data-act="plan.remove" aria-label="${l}" title="${l} - &quot;שהוסרו&quot; בסוף היום מחזיר">${actIc('event_busy')}</button>`;
// 10.15.0 (design-review Q9): a travel's card is changed in its editor, not by dragging - the travel tone, no border, no lift; its time chip
// is a button that opens the travel editor (every time chip acts on tap), and a pencil at the card's bottom corner on the chip's row does the same
const travelRO = () => document.body.classList.contains('read-only');
function travelTimeChip(id, inner) { const ro = travelRO(), tag = ro ? 'span' : 'button type="button"';
  return `<${tag} class="tl-tag cd-when time"${ro ? '' : ` data-act="trip.editTravel" data-v="${_escH(String(id))}" aria-label="עריכת הנסיעה"`}>${tagIc('schedule')}<span dir="ltr">${inner}</span></${ro ? 'span' : 'button'}>`; }
function travelEditBtn(id) { return travelRO() ? '' : `<button type="button" class="tl-tredit" data-act="trip.editTravel" data-v="${_escH(String(id))}" aria-label="עריכת הנסיעה" title="עריכת הנסיעה">${msi('edit')}</button>`; }
// 11.0.0 (travels-1-model): one card for every travel - mine (a plan item with the travel's id) or the group's (a program line of a travel's
// kind, token s:<id>): the travel tone, its title, then the tags - the time ("קביעת שעה" without one; both open the travel's editor),
// "קבוצתי", the kind's name (Q23: "טיסה", "אוטובוס" - never "נסיעה"), and while an end has no confirmed location the chip "מיקום מוצע,
// לאישור" ("חסר מיקום" when nothing was found), built like "קביעת שעה": a tap opens the editor on that end. A group travel also carries
// "עודכן במקור" / "שלי" as every program line. It does not move by dragging (its editor changes it); the pencil at the far end.
function travelCardHTML(f, day, slotKey, mapNum, o) { o = o || {}; const esc = _escH, ro = travelRO(), id = String(f.id), sid = f.group ? f.src : null;
  const raw = sid != null ? rawSched(sid) : null, upd = raw ? schedSrcUpdates(raw).length : 0, mine = raw ? schedEdChanged(raw) : false;
  const ld = Number(f.arriveDay) || 0, end = ld && isHM(f.arrive) ? `${esc(f.arrive)}<sup class="sym-tip" data-act="tip" data-v="sym.nextDay">${ld > 0 ? '+' : '−'}${Math.abs(ld)}</sup>` : (f.arrive && f.arrive !== f.depart && isHM(f.arrive) ? esc(f.arrive) : '');
  const time = isHM(f.depart) ? travelTimeChip(id, `${esc(f.depart)}${end ? '–' + end : ''}`) : ro ? '' : `<button type="button" class="tl-tag cd-when settime" data-act="trip.editTravel" data-v="${esc(id)}">${tagIc('more_time')}קביעת שעה</button>`;
  const st = travelEndsState(f), side = travelFirstOpenEnd(f), stTx = st === 'prop' ? 'מיקום מוצע, לאישור' : 'חסר מיקום';
  const prop = !st || ro || ARCHIVE_VIEW || (activeTripObj() || {}).archived ? '' /* a memory confirms nothing */ : `<button type="button" class="tl-tag cd-when settime tv-prop" data-act="travel.endFix" data-v="${esc(id + '|' + side)}">${tagIc('location_on')}${stTx}</button>`;
  const tags = [time, f.group ? grpTag() : '', cdMeta([esc(travelKindName(f))]), prop,
    upd ? `<button type="button" class="tl-tag upd" data-act="sched.upd">${tagIc('update')}עודכן במקור</button>` : '',
    mine && !upd ? `<span class="tl-tag mine" title="${esc('שונה אצלי: ' + schedChangeText(raw))}">${tagIc('edit')}שלי</span>` : '',
    o.visited ? `<span class="tl-tag vis-on">${tagIc('check_circle')}${TX.visited}</span>` : ''];
  const tok = sid != null ? 's:' + sid : id;
  return cdCard({ cls: `itin-card tl-entry tl-travel${isHM(f.depart) ? ' timed' : ''}${sid != null ? ' tl-sched' : ''}`,
    attrs: ` data-iday="${day}" data-islot="${slotKey}" data-ipid="${esc(tok)}" data-ref="plan:${day}|${esc(tok)}"${isHM(f.depart) ? ` data-start="${esc(f.depart)}" data-end="${esc(f.arrive || '')}"` : ''}`,
    body: ' data-act="plan.open"', lead: leadHTML('travel', msi(TRAVEL_MS[f.mode] || 'flight', { size: 18 }), '', mapNum), name: esc(travelTitle(f)), tags,
    desc: travelEndsLine(f), acts: travelActsRow(f, ro) });
}
// travels-2-plan (Q13; picture travels-map-1): the line of both ends ("<from> ← <to>"; one end alone as "מ-…" / "אל …"), and the actions
// row of a place card - navigate to the departure point (only a confirmed one: never a guess, Q5; not at home, Q6), show on the day map,
// and the pencil at the far end (not in a memory)
function travelEndsLine(f) { const a = String(f.from || '').trim(), b = String(f.to || '').trim(); if (!a && !b) return '';
  return `<span class="mc-desc tv-ends" dir="auto">${a && b ? `${_escH(a)} ← ${_escH(b)}` : a ? 'מ-' + _escH(a) : 'אל ' + _escH(b)}</span>`; }
function travelNavUrl(f) { const e = travelEnd(f, 'from'); return e.coord && !e.home ? navUrl(e.coord.lat + ',' + e.coord.lng) : ''; }
function travelActsRow(f, ro) { const nav = travelNavUrl(f), id = String(f.id); if (!nav && !MAP_AVAILABLE && ro) return '';
  return `<div class="tl-acts mc-acts">${nav ? linkBtn('tl-act a-nav', nav, actIc('navigation'), 'ניווט למיקום היציאה') : ''}${MAP_AVAILABLE ? `<button type="button" class="tl-act a-map" data-act="travel.dayMap" aria-label="על מפת היום" title="על מפת היום">${actIc('map')}</button>` : ''}${ro ? '' : `<button type="button" class="tl-act a-ed" data-act="trip.editTravel" data-v="${_escH(id)}" aria-label="עריכת הנסיעה" title="עריכת הנסיעה">${actIc('edit')}</button>`}</div>`; }
act('travel.dayMap', c => { const o = c.ref && c.ref.obj, k = o && o.day; if (!k) return; const tok = String(c.ref.id || '').split('|').slice(1).join('|'); // 11.3.0: that travel marked on the day map
  TV_MARK = tok ? { day: k, id: tok } : null; setViewMode('day_' + k, 'map'); openDays.add(k); revealLater(`#main [data-day-item="${k}"] .map-container`, false); return 'redraw'; });
function itinCardHTML(day, slotKey, p, mapNum) { // my own item in the plan: a place, its copy, a note or a travel. A tap opens its window; a long press drags.
  const t = getTime(day, p.id), esc = _escH, travel = isTravelItem(p), note = isNote(p);
  const baseId = p.dup ? copyRef(p.id) : p.id, base = !note ? POINTS.find(x => x.id === baseId) : null;
  const visited = STATE.visited.has(baseId);
  if (travel) { const f = tripFlights().find(x => String(x.id) === String(p.id)); if (f) return travelCardHTML(f, day, slotKey, mapNum, { p, t, visited }); }
  const meta = note ? [TX.note] : [esc(layerTagLabel(p.layer)), ...(base ? placeMeta(base, () => true, () => pastRateMiniHTML(p)) : [])];
  const tags = [planTimeChip(day, { p }, t), cdMeta(meta), ...(base ? placeMarks(base, baseId) : []), base ? bpNoteTag(base) : '' /* 11.42.0: the price's note, one line */,
    visited && (travel || (note && !p.address)) ? `<span class="tl-tag vis-on">${tagIc('check_circle')}${TX.visited}</span>` : ''];
  return cdCard({ cls: `itin-card tl-entry g-swipe${t ? ' timed' : ''}${visited ? ' tl-visited' : ''}${travel ? ' tl-travel' : ''}`,
    attrs: ` data-iday="${day}" data-islot="${slotKey}" data-ipid="${p.id}" data-ref="plan:${day}|${p.id}"${t ? ` data-start="${esc(t.start)}" data-end="${esc(t.end || '')}"` : ''}`,
    body: ' data-act="plan.open"', lead: planLead(p, mapNum), name: esc(p.name), tags,
    vis: !travel && (!note || p.address) ? visBtnHTML(baseId, visited) : '',
    acts: travel ? travelEditBtn(p.id) : placeLinksRow('', base, () => document.body.classList.contains('read-only'), planRmBtn('הסרה מהיום')) });
}
function schedCardHTML(sItem, day, slotKey, mapNum) { // a line of the organized schedule, in the same timeline - the same card, with "קבוצתי"
  if (isTravelKind(sItem.kind)) { const f = grpTravelOf(rawSched(sItem.id), sItem, activeTripObj()); return travelCardHTML(f, day, slotKey, mapNum, { sched: sItem }); }
  const pl = sItem.placeId != null && sItem.placeId !== '' ? POINTS.find(x => x.id === sItem.placeId) : null, esc = _escH;
  const raw = rawSched(sItem.id), upd = schedSrcUpdates(raw).length, mine = schedEdChanged(raw), hl = _SCH_LINKS && _SCH_LINKS.hotelLine[sItem.id];
  const vis = !!pl && STATE.visited.has(pl.id); // 4.48.1: a visited line dims like my own cards
  const tags = [planTimeChip(day, { sched: sItem }, sItem.start ? { start: sItem.start, end: sItem.end } : null), grpTag(),
    cdMeta([hl ? '' : pl ? msiT('location_on', esc(pl.name), { size: 16 }) : '', sItem.note ? esc(sItem.note) : '']),
    hl ? `<button type="button" class="tl-tag night" data-act="lodging.go" data-v="${esc(hl.id)}">${tagIc('hotel')}<span class="t-ell">הלילה: ${esc(hl.name || '')} ›</span></button>` : '', // size-fixes (3): a long hotel name ends with "…" inside its tag (it overflowed the tag from "גדול")
    upd ? `<button type="button" class="tl-tag upd" data-act="sched.upd">${tagIc('update')}עודכן במקור</button>` : '',
    mine && !upd ? `<span class="tl-tag mine" title="${esc('שונה אצלי: ' + schedChangeText(raw))}">${tagIc('edit')}שלי</span>` : ''];
  return cdCard({ cls: `tl-sched itin-card tl-entry g-swipe${sItem.start ? ' timed' : ''}${sItem.kind === 'free' ? ' free' : ''}${vis ? ' tl-visited' : ''}`,
    attrs: ` data-iday="${day}" data-islot="${slotKey}" data-ipid="s:${esc(sItem.id)}" data-ref="plan:${day}|s:${esc(sItem.id)}"${sItem.start ? ` data-start="${esc(sItem.start)}" data-end="${esc(sItem.end || '')}"` : ''}`,
    body: ' data-act="plan.open"', lead: pl ? leadHTML('place', typeIcon(pl.icon, { size: 18 }), pl.color, mapNum) : leadHTML('grey', msi(SCHED_MS[sItem.kind] || 'event', { size: 18 }), '', mapNum),
    name: esc(sItem.title), tags, vis: pl ? visBtnHTML(pl.id, vis) : '',
    acts: placeLinksRow('', pl, () => document.body.classList.contains('read-only'), planRmBtn('הסרה מהתוכנית')) });
}

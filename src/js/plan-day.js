// 🚶 between two neighbours: a straight line × 1.3 for the streets, at the walking speed of the setting (an estimate)
const WALK_SPEED = { slow: 3.5, normal: 4.5, fast: 5.5 };
// one part of the day in display order: the timed entries by time (the organized one first on a tie), and every untimed
// entry right after the entry it follows - its anchor, or by default the item before it in my list (the organized: the end)
function orderZone(own, org, anchors) {
  const st = e => e.sched ? e.sched.start : e.t.start;
  const seq = [...own.filter(e => e.t), ...org.filter(e => e.sched.start)].sort((a, b) => st(a).localeCompare(st(b)) || (a.sched ? 0 : 1) - (b.sched ? 0 : 1) || a.i - b.i);
  let left = [];
  own.forEach((e, j) => { if (!e.t) left.push({ e, def: j ? String(own[j - 1].id) : '^' }); });
  org.forEach(e => { if (!e.sched.start) left.push({ e, def: '$' }); });
  left.forEach(x => { x.a = anchors[entryTok(x.e)] || x.def; });
  const last = {}, at = t => seq.findIndex(x => entryTok(x) === t);
  for (let pass = 0; left.length && pass < 60; pass++) {
    const next = [];
    left.forEach(x => {
      if (x.a === '$') { seq.push(x.e); return; }
      let pos; if (x.a === '^') pos = 0; else { const i = at(x.a); if (i < 0) { next.push(x); return; } pos = i + 1; }
      const lt = last[x.a]; if (lt) { const j = at(lt); if (j >= 0) pos = j + 1; }
      seq.splice(pos, 0, x.e); last[x.a] = entryTok(x.e);
    });
    if (next.length === left.length) { // an anchor that is gone or in another part: back to the default, then the end
      if (next.some(x => x.a !== x.def)) next.forEach(x => { x.a = x.a !== x.def ? x.def : '$'; }); else { next.forEach(x => seq.push(x.e)); break; }
    }
    left = next;
  }
  return seq;
}
function schedSlotOf(s) { return s.start ? slotForTime(s.start) : ((schedEd(s.id) || {}).slot || schedInferSlot(s)); }
// 4.50.0: a line of the program without a time used to fall into "בלי חלק ביום" - out of the day's route and numbers.
// The program is in order, so it takes the part of the day of the line before it (a time, my own choice, or a hint in the
// title: בוקר / צהריים / ערב), from the morning on, and never goes back. 🗓️ in its card changes it.
const SLOT_RANK = { morning: 0, afternoon: 1, evening: 2 };
function schedTitleSlot(t) { t = String(t || ''); return /ערב|לילה/.test(t) ? 'evening' : /צהריים|צהרים/.test(t) ? 'afternoon' : /בוקר/.test(t) ? 'morning' : ''; }
function schedInferSlot(s) {
  let cur = 'morning'; const up = k => { if (k && SLOT_RANK[k] != null && SLOT_RANK[k] > SLOT_RANK[cur]) cur = k; };
  for (const x of rawSchedule()) { const ed = schedEd(x.id) || {}; if (ed.hidden) continue; const e = schedEff(x); if (e.date !== s.date) continue;
    if (e.start) up(slotForTime(e.start)); else if (ed.slot && SLOT_RANK[ed.slot] != null) up(ed.slot); else up(schedTitleSlot(e.title));
    if (String(x.id) === String(s.id)) return cur; }
  return cur;
}
const DAY_NUM = {}; // day key -> Map(plan id -> number on the day map)
// 4.55.0: the same thing told twice is shown once - a program line "arriving at the hotel" on the day a hotel starts (lodgingId,
// or the one hotel starting that day) stays in the timeline as the night's hotel, and "🏨 לילה" at the end of that day is not repeated.
// 11.0.0 (travels-1-model, Q16): a line that is a travel is no longer joined here - it is one record with its travel (travelsMerge).
let _SCH_LINKS = null; // set while a day's timeline is drawn
function schedLinksOf(iso) {
  const out = { hide: new Set(), hotelLine: {}, nightShown: false };
  const lods = tripLodging().filter(l => l.checkIn === iso); if (!lods.length) return out;
  scheduleOf(iso).forEach(s => { if (s.kind !== 'hotel') return; const raw = rawSched(s.id) || {};
    const l = lods.find(l => raw.lodgingId != null && String(raw.lodgingId) === String(l.id)) || lods.find(l => l.placeId != null && String(l.placeId) === String(s.placeId)) || (lods.length === 1 ? lods[0] : null);
    if (l) { out.hotelLine[s.id] = l; out.nightShown = true; } });
  return out;
}
function dayTimelineHTML(d) { // parts of the day as thin lines; my items and the organized schedule in one timeline
  const dayData = ensureDay(d.key), parts = showParts() ? ['morning', 'afternoon', 'evening', 'unassigned'] : ['all'];
  const LK = schedLinksOf(d.date), sch = scheduleOf(d.date), anchors = planX().anchors[d.key] || {}; _SCH_LINKS = LK; // 4.55.0
  const coordOf = e => e.sched ? (e.sched.placeId != null ? routeCoordOf(POINTS.find(x => x.id === e.sched.placeId)) : null) : (!isNote(e.p) ? routeCoordOf(POINTS.find(x => x.id === (e.p.dup ? copyRef(e.p.id) : e.p.id))) : (e.p.address && !isTravelItem(e.p) ? routeCoordOf(e.p) : null)); // 4.54.0: a free item with an address is on the day's route too
  let h = '';
  const outs = parts.map(k => { // 4.32.0: the whole day first, so legs can cross from one part of the day to the next
    const own = (k === 'all' ? mergedIds(d.key) : dayData[k]).map((id, i) => ({ id, p: planItem(id), t: getTime(d.key, id), i })).filter(x => x.p);
    const org = sch.filter(s => k === 'all' || schedSlotOf(s) === k).map((s, i) => ({ sched: s, i }));
    return orderZone(own, org, anchors); });
  const tt = activeTripObj(), CK = tmDayClock(tt, d.date), lands = tt.start ? tmLandingsOn(tt, d.date) : [], landK = f => showParts() ? slotForTime(f.arrive) : 'all'; // 7.0.0 (ז9, ז10)
  // a travel that left on another day lands here: its landing row stands in its part by its time (before the items with no time), and
  // travels-2-plan (D1): the day's chain starts at its arrival point - so the rows are entries of the day ({ land: travel })
  const seqs = outs.map((o, pi) => { const ls = lands.filter(f => landK(f) === parts[pi]), r = [];
    o.forEach(e => { const st = e.sched ? e.sched.start : (e.t && e.t.start); while (ls.length && (!st || st === '00:00' || ls[0].arrive <= st)) r.push({ land: ls.shift() }); r.push(e); });
    return r.concat(ls.map(f => ({ land: f }))); });
  const legs = buildDayLegs(d, seqs.filter((o, i) => parts[i] !== 'unassigned'), coordOf);
  { // 4.34.0: the numbers of the day map, in the timeline's order (the same places the map numbers: with an address, not the hotel)
    const hIds = hotelMarks([d.date]).map(h => h.id), un = new Set(dayData.unassigned), num = new Map(); let n = 0;
    outs.forEach((o, i) => { if (parts[i] === 'unassigned') return; o.forEach(e => { // 4.50.0: also the places of the organized schedule
      if (e.sched) { const sp = e.sched.placeId != null && e.sched.placeId !== '' ? POINTS.find(q => q.id === e.sched.placeId) : null; if (sp && sp.address && !hIds.includes(sp.id) && !num.has(sp.id)) num.set(sp.id, ++n); return; }
      if (e.p && e.p.address && !hIds.includes(e.p.id) && !un.has(e.p.id) && !num.has(e.p.id)) num.set(e.p.id, ++n); }); });
    DAY_NUM[d.key] = num; }
  const swAfter = CK && CK.sw ? (CK.sw.leg.arriveDay ? 'land:' + CK.sw.leg.id : String(CK.sw.leg.id)) : null;
  const landRow = f => cdCard({ cls: 'itin-card tl-entry timed tl-travel tl-land', body: ` data-act="plan.land" data-v="${escH(f.id)}"`, lead: leadHTML('travel', msi('flight_land', { size: 18 }), ''),
    name: `נחיתה ב${escH(f.to || '')}`, tags: [travelTimeChip(f.id, escH(f.arrive))], acts: travelEditBtn(f.id) });
  const clockDiv = txt => `<div class="tl-div tl-clock">${escH(txt)}</div>`; // a zone label is plain text (a destination's name)
  if (CK) h += clockDiv(CK.startLabel);
  parts.forEach((k, pi) => {
    const out = seqs[pi];
    if (k === 'unassigned' && !out.length) return;
    if (k !== 'all') { const lab = k === 'unassigned' ? 'בלי חלק ביום' : SLOT_SHORT[k]; h += `<div class="tl-div">${msi(SLOT_MS[k], { size: 18 })}<span>${lab}</span><span class="tl-div-ln"></span>${k !== 'unassigned' ? `<button type="button" class="tl-div-add" data-act="day.addPlace" data-v="${k}" aria-label="הוספה ל${lab}" title="הוספה ל${lab}">${msi('add', { size: 20 })}</button>` : ''}</div>`; } // 10.2.0 (design-2): the part's icon, a dashed line, a round ＋
    h += `<div class="tl-zone" data-dropday="${d.key}" data-dropslot="${k}">`;
    out.forEach(e => { const tk = entryTok(e); if (legs.from && legs.fromTok === tk) h += legRowHTML(legs.from); if (legs.byB && legs.byB[tk]) h += legRowHTML(legs.byB[tk]);
      h += e.land ? landRow(e.land) : e.sched ? schedCardHTML(e.sched, d.key, k, DAY_NUM[d.key] && e.sched.placeId != null && DAY_NUM[d.key].get(e.sched.placeId)) : itinCardHTML(d.key, k, e.p, DAY_NUM[d.key] && DAY_NUM[d.key].get(e.p.id));
      if (swAfter && swAfter === tk) h += clockDiv(CK.sw.label); });
    h += '</div>';
  });
  const lod = tripLodging().find(l => l.checkIn <= d.date && d.date < l.checkOut);
  if (legs.to) h += legRowHTML(legs.to);
  _SCH_LINKS = null;
  if (lod && !LK.nightShown) h += `<button type="button" class="tl-night" data-act="lodging.go" data-v="${lod.id}">${msi('hotel', { size: 18 })}<span>הלילה: ${escH(lod.name)}</span>${msi('chevron_right', { size: 20 })}</button>`;
  return h;
}
// 5.15.0 (ד2): the plan's one summary line - "23 ימים · 24.12–15.1 · 3 יעדים", or "📝 23 ימים, בלי תאריכים"
function planSummaryText() { const t = activeTripObj(), n = TRIP_DAYS.length, k = tripDests(t).length;
  if (!t.start) return `${n} ימים, בלי תאריכים`;
  const a = TRIP_DAYS[0], b = TRIP_DAYS[n - 1]; return [`${n} ימים`, a && b ? `\u2066${a.label}–${b.label}\u2069` : '', k > 1 ? `${k} יעדים` : ''].filter(Boolean).join(SEP); }
// ＋ הוספה at the end of a day, and ＋ in a part of the day: a place, a travel or a note (11.0.0, travels-1-model Q17: a travel from the plan,
// in the same editor as from the trip's details, with that day's date). A place goes to the part (or "בלי חלק ביום" from the day's end).
function openAddChoice(day, slot) { const ctl = {}; layerNote(openAddChoice, arguments); const sheet = document.getElementById('sheet'), d = dayByKey(day); if (!d) return;
  sheet.innerHTML = `${fmHead(`＋ הוספה${SEP}${tmFmt('day', d.date)}`, 'acClose')}
    ${taListHTML({ act: 'addChoice.ac' }, [['place', `${SY.place} ${TX.place}`], ['travel', `${msi('commute')} <span>${TX.travel} ${tipI('add.travel', true)}</span>`], ['note', `📝 ${TX.note}`]])}`;
  ctl.ac = b => { const k = b.dataset.ac; closeSheet(); setTimeout(() => k === 'place' ? openAddPlaceSheet(day, slot || 'unassigned') : k === 'travel' ? openTravelEditor(null, { pre: { date: d.date } }) : openNewNoteSheet(day), 60); };
  showSheetBackdrop('openAddChoice'); layerTop().ctl = ctl; }
ctlActs('addChoice', ['ac']);
// round6-behaviour (G119): the day's title names its city - by wxDayLocs' names, the one rule (a destination's only stop by the destination,
// several stops each by its own; kit-install item 6); a day that moves reads "A ← B", a name said once
function dayPlaceNames(d) { return [...new Set(wxDayLocs(d).map(l => l.name))]; }
function dayHeadInfo(d) {
  const iso = todayStr(), dayData = ensureDay(d.key), n = mergedIds(d.key).length, schedN = scheduleOf(d.date).length;
  let city = ''; try { city = dayPlaceNames(d).join(' ← '); } catch (e) {} if (!city) city = destsOfDay(d.key).map(destName).join(' ← ');
  const tr = travelsOf().filter(f => f.date === d.date).sort((a, b) => String(a.depart || '').localeCompare(String(b.depart || '')))[0];
  const sum = [n + schedN ? `${n + schedN} בתוכנית` : 'עוד ריק', legsDaySummary(d.key), /* 5.15.0 (ד2): the group's items count too, and no group label on every day */ tr ? `${msi(TRAVEL_MS[tr.mode] || 'flight', { cls: 'msi-in' })}\u00a0${tr.depart ? tr.depart + ' ' : ''}${(TRAVEL_MODES[tr.mode] || TRAVEL_MODES.flight)[1]}` : ''].filter(Boolean).join(SEP);
  return { title: `${d.date === iso ? ('היום' + SEP) : ''}${tmFmt('day', d.date)}${city ? SEP + city : ''}`, sum, past: d.date < iso, today: d.date === iso };
}
function fillPlanWeather() { // the weather sign in each day's line, once the trip weather is in
  if (!_wxData) return; const { fc, clim, horizon } = _wxData;
  document.querySelectorAll('[data-dwx]').forEach(el => { const iso = el.dataset.dwx, b = _wxData.days.find(x => x.day.date === iso); if (!b) return;
    const l = b.locs[b.locs.length - 1];
    if (iso <= horizon) { const w = wxDaily(fc, l.coord, iso); if (w) el.innerHTML = `${wxIcon(w.code)} <bdi dir="ltr">${Math.round(w.tmax)}°</bdi>`; }
    else { const a = wxAvg(clim, l.coord, iso); if (a) el.innerHTML = `<span title="ממוצע">~<bdi dir="ltr">${Math.round(a.tmax)}°</bdi></span>`; } });
}

// 4.0.0: organized schedule - the shared, locked program of an organized tour (from the trip file), shown in its own color.
// The personal plan sits on top of it and works as before.
const schedKindIc = (k, w) => msiT(SCHED_MS[k] || 'event', w); // 10.15.0 (design-review Q13): the group program's kinds as line icons (SCHED_MS), not emoji; size-fixes-2 (2): with its word (msiT - "walk" is mirrored)
function schedBlockHTML(iso) {
  const list = scheduleOf(iso); if (!list.length) return '';
  return `<div class="sched-block"><div class="sched-head">${msi('groups', { cls: 'msi-in' })} ${TX.group} <small>של הקבוצה; שינויים שלך ב-${msi('calendar_month', { cls: 'msi-in' })} תכנון</small></div>${list.map(x => { const it = itemOf('s:' + x.id); return it ? miniCardHTML(it, { screen: 'list' }) : ''; }).join('')}</div>`; // 5.3.1: the lines of the program are mini cards too
}
let _planInit = false;
// the plan's first opening (4.21.0): today's day when it is a trip day, else the default open day (plan-card.js: the first day) - one rule
// for the plan and for a share back to a day's "＋ מקום" (psPlaceScreen; jordan-valley-points item 3, decisions 2026-11-17 · Review of
// the 11.21.3 summary, found 2)
function planFirstOpen() { if (_planInit) return; _planInit = true; const td = TRIP_DAYS.find(d => d.date === todayStr()); if (td) openDays = new Set([td.key]); }
function renderItineraryTab() {
  touchReset(); pruneParked();
  if (ARRANGE_DAYS) { renderArrangeDays(); return; } // 4.38.0
  let html;
  planFirstOpen(); // 4.21.0: today opens by itself
  // 5.15.0 (ד2): no title and no explanation line (they are in the tour and the guide) - one thin summary line with ↕️ at its end
  // 11.5.0 (schedule-proposal, Q5, Q7): a waiting proposal's row first; an empty plan shows one empty state (with "לו״ז מה-AI") in place of
  // the summary and of "היום ריק" in each day
  // 11.7.0 (schedule-proposal-followups, the 11.5.0 review's Q3): the plan's top - the summary text on its own line; under it one row
  // (.plan-row) with the legs' status at its start and "לו״ז מה-AI" / "סידור ימים" (the button row) at its end; no separate status bar.
  // With no room the buttons go down a line under the status. The status is gone when every leg is computed (svcLine) - the buttons stay.
  const noPlan = planEmpty();
  const topBtns = (propCan() ? propAskBtn('propAskTop') : '') + (TRIP_DAYS.length > 1 ? `<button type="button" class="chip" data-act="days.arrange">${msi('swap_vert', { size: 18 })}סידור ימים</button>` : '');
  html = propRowHTML() + (noPlan ? planEmptyHTML() + '<div class="plan-row"><!--legs-status--></div>' : `<div class="plan-sum"><div class="plan-sum-t">${planSummaryText()}</div><div class="plan-row"><!--legs-status-->${topBtns ? `<span class="brow tight plan-sum-btns">${topBtns}</span>` : ''}</div></div>`);
  html += `<div class="plan-layout"><div class="plan-main"><div class="accordion" id="itinAccordion">`;
  const multiPlan = tripDests(activeTripObj()).length > 1;
  TRIP_DAYS.forEach(d => {
    const _tl = dayTimelineHTML(d), dayOpen = openDays.has(d.key), info = dayHeadInfo(d), total = mergedIds(d.key).length, schedN = scheduleOf(d.date).length;
    html += `<div class="accordion-item day-item${info.past ? ' past' : ''}${info.today ? ' today' : ''}" data-day-item="${d.key}" data-ref="day:${d.key}" data-open="${dayOpen}">
      <button class="accordion-header day-head t-wrap" data-act="day.toggle"><span class="dh-t"><b>${info.past ? msi('check', { cls: 'msi-in dh-past' }) + '\u00a0' : ''}${glueText(escH(info.title))}</b><small>${glueText(info.sum)}</small></span><span class="dh-wx" data-dwx="${d.date}"></span><span class="dh-more" role="button" tabindex="0" data-act="day.menu" aria-label="פעולות על היום">${msi('more_horiz')}</span><span class="accordion-arrow">${msi('expand_more')}</span></button>
      <div class="accordion-body">`; // 4.23.0: the favorites of the day moved into ＋ מקום
    if (!total && !schedN) html += noPlan ? '' : emptyHTML(msi('event_note'), `＋ מקום למטה, או ${msi('calendar_month', { cls: 'msi-in' })} בכרטיס של כל מקום.`, '', 'היום ריק');
    else {
      const dayViewKey = 'day_' + d.key, dayMode = getViewMode(dayViewKey);
      const mapN = total + scheduleOf(d.date).filter(x => x.placeId != null && x.placeId !== '').length; // 4.46.3: a day with only the organized schedule has a map too
      if (mapN) html += viewToggleHTML(dayViewKey);
      html += svDayRowHTML(d.key); // map-side-view: "גובה" for the day's walking and driving legs, in the list and on the day map
      if (mapN && dayMode === 'map') html += `<div class="map-container" id="mapView_${dayViewKey}"></div>`;
      else html += `<div class="tl">${_tl}</div>`;
    }
    const hidN = hiddenScheduleOf(d.date).length + removedOf(d.key).length; // 4.22.0; 4.53.0: also what ✕ took off (mine)
    html += `<div class="brow tight tl-foot"><button class="add-btn" data-act="day.add">＋ הוספה</button>${hidN ? `<button class="add-btn" data-act="day.restore">${msi('undo', { size: 18 })} ${hidN === 1 ? 'פריט שהוסר' : hidN + ' שהוסרו'}</button>` : ''}</div>`;
    html += `</div></div>`;
  });
  html += `</div>`;
  { const t0 = activeTripObj(); if (isFlexDays(t0)) html += `<div class="brow tight tl-foot plan-end"><button class="add-btn" data-act="days.addEnd">＋ יום בסוף הטיול</button><button class="add-btn" data-act="days.arrange">${msi('swap_vert', { size: 18 })} סידור ימים</button></div>`;
    else if (TRIP_DAYS.length > 1) html += `<div class="brow tight tl-foot plan-end"><button class="add-btn" data-act="days.arrange">${msi('swap_vert', { size: 18 })} סידור ימים</button></div>`; }
  html += parkedHTML() + `</div>${planSideHTML()}</div>`; // 4.38.0
  html = html.replace('<!--legs-status-->', legsStatus()); // 4.32.0
  document.getElementById('main').innerHTML = html;
  const main = document.getElementById('main');
  TRIP_DAYS.forEach(d => { const dayData = ensureDay(d.key);
    if ((mergedIds(d.key).length || scheduleOf(d.date).some(x => x.placeId != null && x.placeId !== '')) && getViewMode('day_' + d.key) === 'map' && openDays.has(d.key)) renderItineraryMap('mapView_day_' + d.key, 'mapCard_day_' + d.key, dayData); });
  if (_wxData) fillPlanWeather(); else if (wxDays().length) loadTripWeather().then(fillPlanWeather);
  if (main.querySelector('.tl-card.itin-card')) {
    planDragHint(); }
}

// 6.1.0: the plan screen's actions - a card's entry (plan:day|token) and its day (day:key) come from their wrappers
act('plan.land', c => openItemWin('tv:' + c.v, {})); // 7.0.0 (ז10): the landing row is the same travel
act('plan.open', c => { const o = c.ref && c.ref.obj; if (!o) return;
  if (o.sched && !o.place) { openItemWin('s:' + o.sched.id, { day: o.day, tok: o.tok }); return; }
  if (o.travel) { openItemWin('tv:' + o.id, { day: o.day }); return; }
  const q = planItem(o.sched ? o.place.id : o.id); if (!q) return;
  _placeSheetSched = o.sched ? String(o.sched.id) : null; _placeSheetCtx = { day: o.day, tok: o.tok }; openPlaceSheet(q); });
act('plan.time', c => { const o = c.ref && c.ref.obj; if (!o) return; if (o.sched) openSchedTimeSheet(o.sched.id); else openTimeSheet(o.day, String(o.id)); });
act('plan.remove', c => { const o = c.ref && c.ref.obj; if (!o) return; if (o.sched) hideSched(o.sched.id); else removeFromDay(o.day, o.id); });
act('sched.upd', c => { const o = c.ref && c.ref.obj; if (o && o.sched) openSchedUpdSheet(o.sched.id); });
act('day.toggle', c => { const k = c.ref.id; if (openDays.has(k)) openDays.delete(k); else { openDays.add(k); revealLater(`#main [data-day-item="${k}"]`, false); } return 'redraw'; }); // 10.6.0: an opened day comes into view
act('day.menu', c => openDayMenu(c.ref.id));
act('day.add', c => openAddChoice(c.ref.id));
act('day.addPlace', c => openAddChoice(c.ref.id, c.v)); // 11.0.0 (Q17): the part's ＋ offers מקום · נסיעה · הערה
act('day.restore', c => openRestoreSheet(c.ref.id));
act('days.addEnd', () => addDayAtEnd());
act('days.arrange', () => { ARRANGE_DAYS = true; appScroll(0); return 'redraw'; });
act('leg.open', c => openLegSheet(c.v));
act('view.mode', c => { setViewMode(c.el.dataset.vt, c.v); return 'redraw'; });
act('place.toDay', c => toggleDay(c.v, pid(c.ref.id))); // the plan's side panel: a favorite not yet in the plan, ＋ to a day
// 4.2.0: in a trip with several destinations, each open day offers the favorites of that day's destinations
// that are not in the plan yet (one tap adds them to the day)
// 3.1.0: desktop planning panel beside the plan - favorites not yet in any day, with day buttons
function planSideHTML() {
  const favs = POINTS.filter(p => STATE.favorites.has(p.id) && !TRIP_DAYS.some(d => isInDay(d.key, p.id)));
  return `<aside class="plan-side"><h3>${msi('star', { size: 18, cls: 'msi-in' })} מועדפים שעוד לא בתוכנית (${favs.length})</h3>` + (favs.length ? favs.map(p => `<div class="ps-row" data-ref="place:${p.id}"><b>${msiTie(itemIcon(p, { size: 18, cls: 'msi-in' }), escH(p.name))}</b>
    <div class="add-to-day-row">${TRIP_DAYS.filter(d => dayOk(d.key, p)).map(d => `<button data-act="place.toDay" data-v="${d.key}" data-in="false">${d.label}</button>`).join('')}</div></div>`).join('')
    : '<p class="sh-hint">כל המועדפים כבר בתוכנית. ' + msi('star', { cls: 'msi-in' }) + ' בכרטיס של מקום מוסיף אותו לכאן.</p>') + `</aside>`;
}

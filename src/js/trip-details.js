// ================= TRIP DETAILS: FLIGHTS & LODGING (2.1.0) =================
// Part of the trip itself (travels, lodging).
function tripFlights() { return activeTripObj().travels || []; }
function tripLodging() { return activeTripObj().lodging || []; }
const TRAVEL_MODES = { flight: ['flight', 'טיסה'], train: ['train', 'רכבת'], bus: ['directions_bus', 'אוטובוס'], car: ['directions_car', 'רכב'], ferry: ['directions_boat', 'מעבורת'] }; // [the kind's line icon (TRAVEL_MS), its word] - final-review-fixes: no emoji left; 11.0.0 (Q23): the car is "רכב" - "נסיעה" is only the general word
function flightPlanName(f) { return `${(TRAVEL_MODES[f.mode] || TRAVEL_MODES.flight)[1]} ל${f.to}${f.airline || f.number ? SEP + [f.airline, f.number].filter(Boolean).join(' ') : ''}${f.note ? ' (' + f.note + ')' : ''}`; }
// 🌦️ 4.38.0: the usual weather by month, for choosing dates - 3 past years from Open-Meteo's archive (ERA5), per destination,
// loaded once and kept. A trip without dates shows it open; with dates its months are marked.
const HE_MON = ['ינו', 'פבר', 'מרץ', 'אפר', 'מאי', 'יונ', 'יול', 'אוג', 'ספט', 'אוק', 'נוב', 'דצמ'];
const HE_MON_FULL = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
function mclimLoad() { return regRead('mclim'); }
function mclimDests() { return tripDests(activeTripObj()).map(id => DESTS[id]).filter(d => d && Array.isArray(d.meta.center)).map(d => ({ d, k: d.meta.center.map(v => (+v).toFixed(2)).join(','), lat: +d.meta.center[0], lng: +d.meta.center[1] })); }
async function mclimFetch(cs) { // service "אקלים חודשי": once a year per destination (the 3-year average moves)
  const cache = mclimLoad(), need = cs.filter(c => !svcFresh('mclim', cache[c.k])); if (!need.length) return cache;
  const y = +tmFmt('year', tmPhoneDate()), avg = a => { const v = a.filter(x => typeof x === 'number'); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
  const r = await svcAsk('mclim', { key: need.map(c => c.k).join(';'), build: () => ({ url: `https://archive-api.open-meteo.com/v1/archive?latitude=${need.map(c => c.lat.toFixed(2)).join(',')}&longitude=${need.map(c => c.lng.toFixed(2)).join(',')}&start_date=${y - 3}-01-01&end_date=${y - 1}-12-31&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto` }),
    parse: j => { j = Array.isArray(j) ? j : [j]; if (!j.some(x => x && x.daily)) throw new Error('answer'); return j; } });
  if (r.kind !== 'ok') return cache;
  r.value.forEach((x, i) => { if (!x || !x.daily || !need[i]) return; const m = Array.from({ length: 12 }, () => ({ tx: [], tn: [], r: [] }));
    x.daily.time.forEach((d, k) => { const o = m[+d.slice(5, 7) - 1]; o.tx.push(x.daily.temperature_2m_max[k]); o.tn.push(x.daily.temperature_2m_min[k]); o.r.push(x.daily.precipitation_sum[k]); });
    cache[need[i].k] = { at: Date.now(), y: tmSpan(y - 3, y - 1), m: m.map(o => ({ tx: avg(o.tx), tn: avg(o.tn), rd: o.r.length ? Math.round(o.r.filter(v => v >= 1).length / o.r.length * 30) : null })) }; });
  regWrite('mclim', cache);
  return cache;
}
function mclimTempColor(v) { if (v == null) return 'background:var(--outline-variant)'; const k = Math.max(0, Math.min(1, (v + 5) / 40)); return `--mc-h:${Math.round(215 - k * 200)};--mc-k:${k.toFixed(2)}`; } // 10.15.0 (F23): the hue and the step on the scale; the tones are tokens (light and dark)
async function fillMclim() {
  const box = document.getElementById('mclimBox'); if (!box) return; const cs = mclimDests(), t = activeTripObj();
  const tm = new Set(t.start ? dayList(t.start, t.end).map(d => +d.date.slice(5, 7) - 1) : []);
  const cache = await mclimFetch(cs); if (!box.isConnected) return;
  // 11.30.0 (wx-one-place): the rows are drawn with the block (each destination's words under its months); here only the hint and the grids
  const rows = cs.filter(c => cache[c.k]), hint = document.getElementById('mcHint');
  box.querySelectorAll('.mc-dest').forEach(el => { const g = el.querySelector(':scope > .mc-grid'), c = rows.find(x => x.k === el.dataset.mck); if (!g) return;
    if (!c) { g.remove(); return; }
    g.innerHTML = cache[c.k].m.map((m, i) => `<button type="button" class="mc-cell${tm.has(i) ? ' on' : ''}" style="${mclimTempColor(m.tx)}" data-act="mclim.month" data-mc="${c.k}|${i}"><small>${HE_MON[i]}</small><b>${m.tx != null ? Math.round(m.tx) + '°' : '–'}</b><span>${m.tn != null ? Math.round(m.tn) + '°' : ''}</span><i>${m.rd != null ? wxMk('umbrella') + m.rd : ''}</i></button>`).join(''); });
  if (hint) hint.innerHTML = rows.length ? `ממוצע ${cache[rows[0].k].y}: יום / לילה וימי גשם. נגיעה בחודש מציגה פירוט.` : (svcNetDown() ? svcOffHTML() + '. נטען פעם אחת לכל יעד.' : 'הנתונים לא נטענו. אפשר לנסות שוב מאוחר יותר.');
  box.querySelectorAll('.mc-dest').forEach(el => { if (!el.children.length || (el.children.length === 1 && el.firstElementChild.localName === 'b')) el.remove(); }); // a destination with no months and no words
  if (!rows.length) return;
  MCLIM = { rows, cache };
}
var MCLIM = null;
act('mclim.month', c0 => { if (!MCLIM) return; const { rows, cache } = MCLIM, [k, i] = c0.el.dataset.mc.split('|'), c = rows.find(x => x.k === k), m = cache[k].m[+i];
    const n = document.getElementById('mcNote'); if (n) n.textContent = `${HE_MON_FULL[+i]}${SEP}${c.d.meta.name}: ביום כ-${Math.round(m.tx)}°, בלילה כ-${Math.round(m.tn)}°, בערך ${m.rd} ימי גשם בחודש (לפחות מ״מ אחד).`;
    // 11.43.0 (info-complete item 7): the destination's words follow the tapped month - its season paragraph opens, the others fold under "עונות אחרות"
    const row = c0.el.closest('.mc-dest'), w = row && row.querySelector(':scope > .wx-words'); if (w) wxSeasonTap(w, +i);
    if (row) row.querySelectorAll('.mc-cell').forEach(b => b.classList.toggle('mc-tap', b === c0.el)); return 'quiet'; });
function tripBlocksHTML() {
  if (DEST_VIEW) return weatherBlockHTML(); // destination-view (Q1): the destination's weather; travels, lodging and the group's plan are a trip's
  const lo = tripLodging();
  const esc = escH;
  const sch = rawSchedule();
  const schedHTML = sch.length ? `<div class="accordion-item">
  <button class="accordion-header t-wrap" data-act="acc.toggle">${accLead(SY.group + ' ' + TX.group + ' ' + tipI('info.sched', true))} <span class="accordion-arrow">${msi('expand_more')}</span></button>
  <div class="accordion-body"><p class="sh-hint">התוכנית של הקבוצה, עם השינויים שלך (${msi('edit', { cls: 'msi-in' })}).</p>${TRIP_DAYS.filter(d => scheduleOf(d.date).length).map(d => `<h3>${tmFmt('day', d.date)}${tripDests(activeTripObj()).length > 1 ? SEP + destsOfDay(d.key).map(x => withFlag(destFlag(x), esc(destName(x)))).join(' ← ') : ''}</h3>` + schedBlockHTML(d.date)).join('')}</div></div>` : '';
  return weatherBlockHTML() + routeBlockHTML() + schedHTML + `<div class="accordion-item" data-open="${!routeOffered()}">
  <button class="accordion-header t-wrap" data-act="acc.toggle">${accLead('✈️ נסיעות')} <span class="accordion-arrow">${msi('expand_more')}</span></button>
  <div class="accordion-body">
    ${travelRowsHTML(activeTripObj(), { countdown: true, ro: !!activeTripObj().archived })}
    <button class="add-btn" data-act="trip.editTravel" data-v="">＋ נסיעה</button>
  </div>
</div>

<div class="accordion-item" id="lodgingItem">
  <button class="accordion-header t-wrap" data-act="acc.toggle">${accLead('🏨 פרטי הלינה')} <span class="accordion-arrow">${msi('expand_more')}</span></button>
  <div class="accordion-body">
    ${lodgingCardsHTML(lo)}
    <button class="add-btn" data-act="trip.editLodging" data-v="">＋ לינה</button>
  </div>
</div>
`;
}
function fillTripBlocks() {
  loadTripWeather(); fillMclim(); // 4.38.0
}
act('trip.editTravel', c => openTravelEditor(c.v || null)); // 11.0.0: the one travel editor (travels.js)
act('trip.editLodging', c => openTripItemEditor('lodging', c.v || null));
const TRIP_FORMS = {
  lodging: { title: 'לינה', fields: [['name','שם','text'],['address','כתובת (למפה ולניווט)','text'],['checkIn','כניסה','date'],['checkOut','יציאה','date'],['checkInTime','שעת צ׳ק-אין','time'],['checkOutTime','שעת צ׳ק-אאוט','time'],['bookingRef','מספר הזמנה','text'],['includes','מה כלול (בפסיקים: ארוחת בוקר, Wi-Fi, חניה)','text'],['guests','אורחים וחדרים','text'],['price','מחיר','price'],['phone','טלפון','text'],['whatsapp','וואטסאפ (מספר)','text'],['website','אתר','text'],['rating','דירוג (למשל 8.6 ב-Booking)','text'],['notes','הערות','text']] },
};
function openTripItemEditor(kind, id) { layerNote(openTripItemEditor, arguments);
  const list = tripLodging(), cur = id ? list.find(x => x.id === id) : null;
  const T = TRIP_FORMS[kind], sheet = document.getElementById('sheet'), trip = activeTripObj(), dated = !!trip.start, F = fmNew({ kind, id, cur });
  const defVal = k => k === 'date' || k === 'checkIn' ? (TRIP_DAYS[0] || {}).date : (k === 'checkOut' ? (TRIP_DAYS[TRIP_DAYS.length - 1] || {}).date : '');
  const hp = kind === 'lodging' && cur && cur.placeId != null ? POINTS.find(q => q.id === cur.placeId) : null;
  const val = k => k === 'address' && kind === 'lodging' ? (hp ? hp.address || '' : '') : cur ? (cur[k] == null ? '' : cur[k]) : defVal(k);
  const req = k => k === 'name';
  const dayOpts = k => { const n = TRIP_DAYS.length + (k === 'checkOut' ? 1 : 0); // 4.38.0: a trip without dates - by day number
    return [...(k === 'checkIn' || k === 'checkOut' ? [['', '—']] : []), ...Array.from({ length: n }, (_, i) => vDate(i + 1)).map(v => [v, tmFmt('pick', v)])]; };
  const nightsOn = () => bpHotelDerived(F); // 11.42.0: the price's other figure follows the nights
  const field = ([k, l, t, opts]) => {
    if (t === 'price') return bpHotelFields(F, cur ? cur.price : '', hp && hp.dest); // 11.42.0 (booking-price, Q3): amount, currency, per night / stay, note
    if (t === 'date' && !dated) return fmChips(F, k, { label: l, req: req(k), value: val(k), options: dayOpts(k), on: nightsOn });
    if (t === 'date') return fmDate(F, k, { label: l, req: req(k), value: val(k), clear: !req(k), on: nightsOn });
    if (t === 'time') return fmTime(F, k, { label: l, value: val(k), clear: true });
    return fmText(F, k, { label: l, req: req(k), value: val(k), dir: ['number', 'terminal', 'bookingRef', 'phone', 'whatsapp', 'website'].includes(k) ? 'ltr' : '' }); };
  const fs = T.fields.filter(f => f[2] !== 'place'); let h = '';
  for (let i = 0; i < fs.length; i++) { const f = fs[i], nx = fs[i + 1];
    if (dated && nx && ((f[0] === 'checkIn' && nx[0] === 'checkOut'))) { h += fmRange(F, 'checkIn', 'checkOut', { label: f[1], value: val('checkIn'), clear: true, on: nightsOn }, { label: nx[1], value: val('checkOut'), clear: true, on: nightsOn }); i++; continue; }
    if (nx && f[0] === 'checkInTime' && nx[0] === 'checkOutTime') { h += `<div class="sh-times">${field(f)}${field(nx)}</div>`; i++; continue; } // 10.9.0 (design-forms, gap 35)
    h += field(f); }
  sheet.innerHTML = `${fmHead((cur ? '✏️ ' : '＋ ') + T.title)}${h}
    ${cur ? fmEndActs([{ act: 'tripItem.del', label: 'מחיקת הלינה', del: true }]) : ''}
    ${fmSaveBar({ act: 'tripItem.save' })}`; // 5.2.0: the delete row at the end
  showSheetBackdrop('openTripItemEditor'); fmAttach(F); bpHotelDerived(F);
}
function tiLand(F) { const tx = fmQ(F, '#tiLandTx'); if (!tx) return; const k = Number(fmGet(F, 'arriveDay')) || 0, d = fmGet(F, 'date'), a = fmGet(F, 'arrive');
  tx.textContent = a && isIso(d) ? `${travelWords(fmGet(F, 'mode')).arrive} ${a}${k ? ` (${k > 0 ? '+' : '−'}${Math.abs(k)})` : ''}${SEP}${tmFmt('pick', isoAdd(d, k))}` : ''; }
function tiAfter(msg) { syncFlightsToPlan(); persist(); showUndoToast(msg); }
act('tripItem.del', c => { const F = fmOf(c.el); if (!F) return; const { cur } = F.opts, trip = activeTripObj();
  trip.lodging = (trip.lodging || []).filter(x => x.id !== cur.id); layerCloseOwn(); tiAfter(SY.del + ' נמחק: ' + cur.name); });
act('tripItem.save', c => { const F = fmOf(c.el); if (!F) return; const { cur } = F.opts, trip = activeTripObj(), T = TRIP_FORMS.lodging; // the lodging (a travel has its own editor - travels.js)
  const v = {}; T.fields.filter(f => f[2] !== 'place' && f[2] !== 'price').forEach(([k]) => { const x = fmGet(F, k); v[k] = x == null ? '' : String(x).trim(); });
  const hv = bpHotelValue(F); if (hv.err) return fmFail(F, hv.err.id, hv.err.msg); v.price = hv.price; // 11.42.0: the price's structure
  if (!v.name) return fmFail(F, 'name', 'חסר שם'); if (v.checkIn && v.checkOut && v.checkOut < v.checkIn) return fmFail(F, 'checkOut', 'היציאה לפני הכניסה');
  trip.lodging = trip.lodging || [];
  { // 5.2.0: a hotel is a place of the trip - its name and address live there
    const addr = v.address || ''; delete v.address; trip.places = trip.places || [];
    const pid0 = cur && cur.placeId, tp = pid0 != null ? trip.places.find(x => x.id === pid0) : null;
    if (tp) { tp.name = v.name; if (addr !== (tp.address || '')) { tp.address = addr; delete tp.manualCoord; } }
    else if (addr || !cur) { const day = TRIP_DAYS.find(d => d.date === v.checkIn) || TRIP_DAYS[0], seg = destOfDayIn(trip, day && day.key), d = seg && DESTS[seg.dest];
      if (d) { const ls = destLayersEff(d), Ly = ls.find(l => l.type === 'lodging') || ls[0]; let nid = Date.now(); while (trip.places.some(x => x.id === nid)) nid++;
        trip.places.push({ id: nid, name: v.name, address: addr, dest: d.id, layer: Ly ? Ly.id - d.idBase : 0, icon: 'lodging' }); v.placeId = nid; } } }
  if (cur) { const o = trip.lodging.find(x => x.id === cur.id); Object.assign(o, v); }
  else trip.lodging.push({ ...v, id: 'l_user_' + Date.now().toString(36) });
  rebuildPoints();
  closeSheet(); tiAfter('✏️ ' + T.title + ' נשמרה: ' + v.name);
});
function removeFlightFromPlan(fid) {
  delete STATE.planItems[fid];
  TRIP_DAYS.forEach(d => { const day = STATE.itinerary[d.key]; if (day) Object.keys(day).forEach(k => { day[k] = day[k].filter(x => x !== fid); }); delete STATE.times[d.key + '|' + fid]; });
}
// Keep the plan's flight items in step with the flight details (name, day and times)
function travelDay(f) { const d = TRIP_DAYS.find(x => x.date === f.date); return d ? d.key : null; }
function syncFlightsToPlan() {
  travelOrphansOut(activeTripObj(), { planItems: STATE.planItems, itinerary: STATE.itinerary, times: STATE.times, planX: STATE.planX }); // 11.0.0 (Q16)
  tripFlights().forEach(f0 => { const f = { ...f0, day: travelDay(f0) }; // trip-base-plus: the plan's day is the sync's own - never written on the travel (a dateless trip's reading drops a travel's `day`, the file's day number, so a redo came back without it)
    if (!f.day) { removeFlightFromPlan(f.id); return; }
    const had = STATE.planItems[f.id];
    STATE.planItems[f.id] = { ...(had || {}), name: travelTitle(f), address: (had && had.address) || '', icon: 'airport', travel: f.mode || 'flight' };
    const curDay = dayOfItem(f.id);
    if (curDay && curDay !== f.day) { const day = STATE.itinerary[curDay]; Object.keys(day).forEach(k => { day[k] = day[k].filter(x => x !== f.id); }); delete STATE.times[curDay + '|' + f.id]; }
    const st = isHM(f.depart) ? f.depart : '', en = st && !(Number(f.arriveDay) || 0) && isHM(f.arrive) && f.arrive > st ? f.arrive : st; // 7.0.0 (ז4): the card's hours
    if (!findSlot(f.day, f.id)) ensureDay(f.day)[st ? 'unassigned' : 'morning'].push(f.id);
    else if (!st && findSlot(f.day, f.id) === 'unassigned') { const dd = ensureDay(f.day); dd.unassigned = dd.unassigned.filter(x => x !== f.id); dd.morning.push(f.id); } // 4.52.0: a travel without a time is not "בלי חלק ביום" - it starts the day
    if (st) { STATE.times[timeKey(f.day, f.id)] = { start: st, end: en }; placeTimed(f.day, f.id); }
    else delete STATE.times[timeKey(f.day, f.id)];
  });
}


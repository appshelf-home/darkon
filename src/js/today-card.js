// 4.19.0: the card at the top of ℹ️ כללי. During the trip, "היום": the weather now and later today, the next item in the
// plan and how many are left, where you sleep tonight, and the next leg with a countdown. Before the trip, "לקראת הטיול":
// a countdown, the first flight, the must-book places not yet 🔖 booked, and the weather at the first stop.
function renderTodayHTML() {
  const t = activeTripObj(); if (!t.id || !TRIP_DAYS.length || !t.start) return ''; // 4.38.0: a trip without dates has no "today"
  const iso = todayStr(), esc = escH, card = (title, body, k) => `<div class="today-card ${k}" id="todayCard"><div class="tc-title">${title}</div>${body}</div>`, ic = n => `<span class="tc-ic">${msi(n, { size: 20 })}</span>`; // 10.3.0 (design-3): the top card follows the trip's state, line icons
  if (iso < t.start) { // before the trip
    const f0 = sortedTravels()[0], when = travelStartsAt(f0), days = Math.max(0, daysBetween(iso, t.start));
    const open = POINTS.filter(p => !isHiddenPoint(p) && reservationClass(p.reservation) === 'resv-must' && !bookingOf(p.id));
    const rows = [];
    if (f0) rows.push(`<div class="tc-row">${ic(TRAVEL_MS[f0.mode] || 'flight')}<span><b>${esc(f0.from)} ← ${esc(f0.to)}</b><small>${tmFmt('date', f0.date)}${f0.depart ? SEP + esc(f0.depart) : ''}${f0.airline || f0.number ? SEP + esc([f0.airline, f0.number].filter(Boolean).join(' ')) : ''}${f0.terminal ? SEP + 'טרמינל ' + esc(f0.terminal) : ''}</small></span></div>`);
    rows.push(open.length ? `<button type="button" class="tc-row tc-btn t-wrap" id="tcMust" data-act="today.tcMust">${ic('event_available')}<span><b>${open.length} הזמנות חובה עוד פתוחות</b><small>${esc(open.slice(0, 3).map(p => placeLabel(p)).join(SEP))}${open.length > 3 ? ' ועוד' : ''} ›</small></span></button>` : `<div class="tc-row">${ic('check_circle')}<span><b>כל הזמנות החובה סומנו ${SYM_BOOKED}</b></span></div>`);
    { const h = tlRemindRowHTML(t, ic); if (h) rows.push(h); } // 11.9.0 (timeline-import, Q3): turn Google Timeline on before the trip
    rows.push(`<div class="tc-row" id="tcWx">${ic('partly_cloudy_day')}<span><b>מזג האוויר בתחנה הראשונה</b>${waitLineHTML('טוען')}</span></div>`);
    if (MAP_AVAILABLE) { try { const pk = OFF_PACKS[t.id], pl = offPlan(t.id); // 4.39.0
      if (pl && (pk ? pl.queue.length : pl.cost.tiles)) rows.push(`<button type="button" class="tc-row tc-btn t-wrap" id="tcOff" data-act="today.tcOff">${ic('download_for_offline')}<span><b>${pk ? 'יש אזור חדש להוריד למפות בלי רשת' : 'להוריד מפות לטיול?'}</b><small>≈ ${offMBh(pl.cost.bytes)}${SEP}מומלץ ב-Wi-Fi ›</small></span></button>`);
      else if (pk) rows.push(`<div class="tc-row">${ic('map')}<span><b>${offPackLine(t.id)}</b></span></div>`); } catch (e) {} }
    { const pend = legsPendingAll(), h = pend ? legsStatus('tcLegs') : ''; if (h) rows.push(`<div class="tc-row">${h}</div>`); } // 4.32.0; 7.1.0: the one status line
    return card(`${msi('luggage', { size: 20 })}לקראת הטיול${SEP}${days === 0 ? 'מתחילים היום' : days === 1 ? 'מחר!' : `עוד ${days} ימים`}`, rows.join(''), 'tcd-before');
  }
  if (iso > t.end) return welcomeBackHTML(t); // 4.29.0: after the trip - welcome back, and an offer to close it
  const day = TRIP_DAYS.find(d => d.date === iso); if (!day) return '';
  const D = DESTS[(destsOfDay(day.key).slice(-1)[0])] || curDest(), now = tmNowHM(activeTripObj()), rows = [];
  rows.push(`<div class="tc-row" id="tcWx">${ic('partly_cloudy_day')}<span><b>מזג האוויר</b>${waitLineHTML('טוען')}</span></div>`);
  // the plan: the organized schedule and my items, the next one by time, and how many are left today
  const d = ensureDay(day.key), mine = ['morning', 'afternoon', 'evening', 'unassigned'].flatMap(k => d[k]).map(id => ({ id, p: planItem(id), t: getTime(day.key, id) })).filter(x => x.p);
  const sch = scheduleOf(iso).map(x => ({ title: x.title, start: x.start || '', org: true }));
  const items = [...sch, ...mine.map(x => ({ title: x.p.name, start: x.t ? x.t.start : '', id: x.id }))];
  const tt = activeTripObj(), lands = tmLandingsOn(tt, iso).map(f => ({ title: 'נחיתה ב' + (f.to || ''), start: f.arrive, land: true })); // 7.0.0 (ז10): in the order and in "הבא", not in the count
  const CK = tmDayClock(tt, iso), zOf = hm => CK ? (CK.sw && hm >= CK.sw.hm ? CK.sw.zone : CK.start) : null, nowMs = tmMs(); // 7.0.0 (ז4): an hour is read on the clock of where it happens
  const after = x => zOf(x.start) ? tmMoment(iso, x.start, zOf(x.start)) >= nowMs - 6e4 + 1 || x.start === now : x.start >= now;
  const timed = items.concat(lands).filter(x => x.start).sort((a, b) => a.start.localeCompare(b.start)), next = timed.find(after);
  const left = timed.filter(x => after(x) && !x.land).length + items.filter(x => !x.start && !(x.id != null && STATE.visited.has(x.id))).length;
  const ckTx = CK && (!CK.sw || tmMs() < CK.sw.ms) ? SEP + esc(CK.startLabel) : ''; // 7.0.0 (ז9): before the landing, the clock the hours are on
  if (items.length) rows.push(`<button type="button" class="tc-row tc-btn t-wrap tc-hi" id="jumpToday" data-act="today.plan">${ic('schedule')}<span><b>${next ? `הבא: ${esc(next.start)} ${esc(next.title)}${next.org ? ' ' + msi('groups', { size: 16, cls: 'msi-in' }) : ''}` : 'התוכנית של היום'}</b><small>${left ? `עוד ${left} בתוכנית היום` : 'הכל כבר מאחוריכם'}${ckTx} ›</small></span></button>`);
  const lod = tripLodging().find(l => l.checkIn <= iso && iso < l.checkOut);
  if (lod) { const hp = lod.placeId != null ? POINTS.find(q => q.id === lod.placeId) : null, nav = hp ? (hp.manualCoord && (hp.userAdded || hp.tripOnly) ? navUrl(hp.manualCoord.lat + ',' + hp.manualCoord.lng) : navUrl(hp.address)) : '';
    rows.push(`<div class="tc-row">${ic('hotel')}<span><b>הלילה: ${esc(lodgingLabel(lod, hp))}</b><small>${lod.checkIn === iso && lod.checkInTime ? 'צ׳ק-אין מ-' + esc(lod.checkInTime) + SEP : ''}<a href="#" data-act="lodging.go" data-v="${esc(lod.id)}">לכרטיס הלינה ›</a></small></span>${nav ? `<a class="tc-nav" href="${nav}" target="_blank" rel="noopener" aria-label="ניווט" title="ניווט">${msi('navigation')}</a>` : ''}</div>`); }
  const nf = sortedTravels().find(f => { const w = travelStartsAt(f); return w && w > tmMs(); });
  if (nf && nf.date <= t.end) { const w = travelStartsAt(nf), m = TRAVEL_MODES[nf.mode] || TRAVEL_MODES.flight;
    rows.push(`<div class="tc-row">${ic(TRAVEL_MS[nf.mode] || 'flight')}<span><b>${m[1]} ל${esc(nf.to)}${SEP}${tmFmt('until', w - tmNow())}</b><small>${nf.date === iso ? 'היום' : tmFmt('date', nf.date)}${nf.depart ? SEP + esc(nf.depart) : ''}${nf.airline || nf.number ? SEP + esc([nf.airline, nf.number].filter(Boolean).join(' ')) : ''}${nf.terminal ? SEP + 'טרמינל ' + esc(nf.terminal) : ''}</small></span></div>`); }
  return card(`${msi('today', { size: 20 })}היום${SEP}${tmFmt('day', iso)}${SEP}יום ${TRIP_DAYS.indexOf(day) + 1}`, rows.join(''), 'tcd-during');
}
function fillTodayWx() { // the card's weather row, once the trip weather is in
  const el = document.getElementById('tcWx'); if (!el || !_wxData) return;
  const t = activeTripObj(), iso = todayStr(), before = iso < t.start, b = before ? _wxData.days[0] : _wxData.days.find(x => x.day.date === iso);
  if (!b) { el.remove(); return; }
  const loc = b.locs[b.locs.length - 1], { fc, clim, horizon } = _wxData, esc = escH;
  if (b.day.date > horizon) { const a = wxAvg(clim, loc.coord, b.day.date);
    el.innerHTML = `<span class="tc-ic">${msi('partly_cloudy_day', { size: 20 })}</span><span><b>${esc(loc.name)}: ${a ? '<bdi dir="ltr">' + Math.round(a.tmax) + '°/' + Math.round(a.tmin) + '°</bdi>' : '—'} <span class="wx-avg">ממוצע</span></b><small>תחזית אמיתית מ-${tmFmt('dayN', isoAdd(b.day.date, -15))}</small></span>`; return; }
  const d = wxDaily(fc, loc.coord, b.day.date); if (!d) { el.innerHTML = `<span class="tc-ic">${msi('partly_cloudy_day', { size: 20 })}</span><span><b>אין תחזית כרגע</b></span>`; return; }
  const hrs = wxHours(fc, loc.coord, b.day.date), D = curDest(), h = before ? null : parseInt(tmNowHM(activeTripObj()), 10), cur = h != null ? hrs.find(x => x.h === h) : null, parts = wxParts(hrs);
  el.innerHTML = `<span class="tc-ic tc-wx">${wxIcon(cur ? cur.code : d.code)}</span><span><b>${esc(loc.name)}: ${cur ? 'עכשיו ' + Math.round(cur.t) + '°' + SEP : ''}<bdi dir="ltr">${Math.round(d.tmax)}°/${Math.round(d.tmin)}°</bdi></b><small>${wxMk('water_drop')}${d.pop ?? 0}%${SEP}${wxWindHTML(d.wind, d.gust)}${before ? SEP + tmFmt('date', b.day.date) : ''}${(n => n ? `${SEP}<span class="wx-age">${n}</span>` : '')(wxAgeNote(fc, [loc.coord]))}</small><small class="tc-wear">${wxWear(d, parts)}</small></span>`;
}
function todayCardCtl() { const ctl = ctlNS('today');
  welcomeBackCtl(); // 4.29.0
  ctl.tcMust = () => { resetFilter(); FP.book = true; goTab('all'); };
  { ctl.tcOff = () => viaGroup('special-maps', 'openOffMaps', STATE.activeTrip); } // 4.39.0

  fillTodayWx();
}
ctlActs('today', ['tcMust', 'tcOff']);

function renderLayerTab(layerId) {
  // 4.4.0: styles, regions, days, search and sorting are in the shared header (same as the map); a list only
  const pts = sortPoints(filteredPoints());
  maybeGeocodeForSort(pts);
  const stylesNone = selNone(FP.styles); // 10.15.0 (design-review Q3): no heading and no counter row - a collection counts in its chip
  let html = '';
  html += pts.length ? pts.map(cardHTML).join('') : (stylesNone ? emptyHTML(msi('filter_alt_off'), 'בוחרים סגנון, או "הכל".', '', 'כל הסגנונות כבויים') : emptyHTML(msi('search_off'), 'אפשר לנסות מילה אחרת, או לשנות את הסינון.', '', 'לא נמצאו מקומות'));
  html += listEndHTML(pts);
  document.getElementById('main').innerHTML = html;
}

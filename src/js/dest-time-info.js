// 4.1.0: the time at a destination - IANA zone if the destination has one (meta.timeZone), else its fixed UTC offset
var _clockTimer = null; // 10.11.0: var - render() releases it when the info screen leaves (it used to wait for its next tick, up to 30 s)
function renderInfoTab() {
  const todayBanner = DEST_VIEW ? '' : renderTodayHTML(); // destination-view (Q1): no trip - no today
  const t = activeTripObj(), multi = tripDests(t).length > 1, D = infoDest();
  const info = infoHtml(D.info); // 11.8.1: cleaned (cleanInfo) and its sections marked, by parsing // 10.8.0: the destination's own sections (content: their titles keep the file's emoji)
  const esc = escH, miss = sgRowHTML() + infoRowHTML(D); // ai-fix-mine (item 5): "N הצעות לתיקון מה-AI", built like the "חסר מידע" row, while one waits // 11.43.0 (info-complete, item 2): under the destination's info, only while a fixed section is missing
  if (!multi) {
    document.getElementById('main').innerHTML = todayBanner + (info.includes('<!--TRIP_BLOCKS-->') ? info.replace('<!--TRIP_BLOCKS-->', tripBlocksHTML())
      : `<div class="section-head"><h2>מידע כללי</h2><p>${DEST_VIEW ? withFlag(destFlagMeta(D.meta), `<bdi>${esc(D.meta.name)}</bdi>`) /* destination-view: the destination, no trip days */ : '<span data-pack="daysCount"></span> ימי טיול'}${SEP}לחצו על כותרת כדי לפתוח</p></div><div class="accordion" id="infoAccordion">${tripBlocksHTML()}${info}</div>`) + miss;
  } else {
    // trip on top (travels, lodging, organized schedule, countdown), then the one destination picked in the chips
    const route = tripDests(t).map(destName).join(' ← ');
    const body = info.includes('<!--TRIP_BLOCKS-->') ? info.replace('<!--TRIP_BLOCKS-->', '') : `<div class="accordion" id="infoAccordion">${info}</div>`;
    const dd = destDays(D.id);
    document.getElementById('main').innerHTML = todayBanner
      + `<p class="trip-line">${msi('luggage', { size: 18 })} <span data-pack="daysCount"></span> ימי טיול${SEP}${esc(route)}</p>` // 5.15.0 (ד4): one line (the name is in the trip button)
      + `<div class="accordion" id="tripAccordion">${tripBlocksHTML()}</div>`
      + `<div id="destInfo">${body}${miss}</div>`;
    const di = document.getElementById('destInfo'), sh = di.querySelector('.section-head'); if (sh) sh.remove();
    di.insertAdjacentHTML('afterbegin', `<div class="section-head dest-info-head"><h2><button type="button" class="fpick dest-hbtn t-wrap" id="infoDestBtn" data-act="info.destPick"><span>${withFlag(destFlagMeta(D.meta), `<bdi>${esc(D.meta.name)}</bdi>`)}</span><span aria-hidden="true">▾</span></button></h2><p>${D.meta.description ? sepTie(esc(D.meta.description)) + SEP : ''}${dd.length ? `${dd.length} ימים בטיול (${tmSpan(dd[0].label, dd.length > 1 ? dd[dd.length - 1].label : '')})` : 'עוד בלי תאריכים'}</p><p class="dest-clock" id="destClock">${sepTie(esc(tmClockLine(D)))}</p></div>`);
    if (_clockTimer) clearInterval(_clockTimer);
    _clockTimer = setInterval(() => { const c = document.getElementById('destClock'); if (!c) { clearInterval(_clockTimer); _clockTimer = null; return; } c.textContent = sepTie(tmClockLine(infoDest())); }, 30000);
  }
  document.querySelectorAll('[data-pack="daysCount"]').forEach(e => e.textContent = TRIP_DAYS.length);
  fillTripBlocks();
  todayCardCtl();
  // 4.37.0: what was opened or closed stays that way - a tap elsewhere on the screen, a destination chip or a trip
  // back from the map no longer reopens every section
  document.querySelectorAll('#main .accordion-item').forEach(item => {
    const hd = item.querySelector(':scope > .accordion-header'); if (!hd || hd.dataset.acc) return;
    if (!hd.dataset.act) hd.dataset.act = 'acc.toggle'; // the sections come in the destination's content: the screen marks them
    if (item.dataset.infoSec) infoHeadFrame(hd);
    const key = infoAccKey(item);
    if (key in INFO_ACC) item.dataset.open = String(INFO_ACC[key]);
  });
  const cd = document.getElementById('flightCountdown');
  if (cd) {
    const f0 = travelsOf()[0]; if (!f0) { cd.textContent = ''; return; }
    const diffDays = Math.ceil((travelStartsAt(f0) - tmMs()) / 864e5);
    const ic = w => msiT(diffDays < 0 ? 'flight_land' : 'flight_takeoff', w, { size: 18 }); // 10.8.0 (design-icons): a line icon; size-fixes-2 (2): tied to its first word (msiT - a mirrored icon)
    if (diffDays > 1) cd.innerHTML = ic(`עוד ${diffDays} ימים לטיסה`);
    else if (diffDays === 1) cd.innerHTML = ic(`הטיסה מחר!`);
    else if (diffDays === 0) cd.innerHTML = ic(`הטיסה היום!`);
    else cd.innerHTML = ic(`הטיסה כבר הייתה`);
  }
  wireCurrencyConverter(); // diet-groups (11.62.0): renderChangelog (the screen "מה חדש" only) moved to tour.js, with its screen
}

const INFO_ACC = {};
// 5.15.0 (ד4): which destination ℹ️ כללי shows - a small window with the trip's destinations, "✓ היום" by the default one
function openInfoDestPicker() { const ids = tripDests(activeTripObj()), auto = dayDestId(); // 9.4.0: the chosen one framed, "היום" at the side
  openFmChoice({ key: 'openInfoDestPicker', title: 'איזה יעד', closeId: 'idpClose', value: oneDest().id, options: ids.map(id => ({ v: id, html: escH(withFlag(destFlag(id), destName(id))), sub: id === auto ? 'היום' : '' })) },
    v => { setOneDest(v); redrawSoon(); }); }
act('info.destPick', () => openInfoDestPicker()); // 5.15.0 (ד4): the destination's title is its picker
act('today.plan', () => { activeTab = 'itinerary'; return 'redraw'; });
function infoAccKey(item) { const hd = item.querySelector(':scope > .accordion-header'); return (STATE.activeTrip || '') + '|' + (item.id || (hd ? hd.textContent : '').replace(/[▾\d·.,:\uE000-\uF8FF]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40)); }



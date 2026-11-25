// ================= 5.2.0: THE EXPANDED WINDOW - one details window for every item (stage 3 of cl-cards-impl-plan) =================
// Built on itemOf (place / note / travel; a hotel is a place with its lodging; an organized line keeps its own source section).
// Order, the same for every kind - what is empty doesn't show: title · status line (= the scheduling button; travel and hotel:
// text) · a small line · actions ✏️ 🧭 🔍 ⭐ ✓ · "איך היה?" · sections: from the organized schedule · what it is · booking · how to
// get there · links ("🗺️ במפה" or "📏 מדידה מכאן" first). ✏️ opens the editor of the kind. Removing from a day is in scheduling.
// ctx: { day, tok } when opened from a plan card (the instance it came from), { mapHost } when opened from a map.
function iwInstances(it) {
  const out = [], seen = new Set(), add = (day, slot, time, tok) => { const k = day + '|' + tok; if (!day || seen.has(k)) return; seen.add(k); out.push({ day, slot, time, tok }); };
  if (it.sched && it.kind !== 'travel') { const d = TRIP_DAYS.find(x => x.date === it.sched.date); if (d) add(d.key, it.sched.start ? '' : schedSlotOf(it.sched), it.sched.start ? { start: it.sched.start, end: it.sched.end || '' } : null, 's:' + it.sched.id); }
  else if (it.place && !it.note) { schedEntries(it.place.id).forEach(e => add(e.day, e.slot, e.time, String(e.id)));
    rawSchedule().forEach(s0 => { const s = schedEff(s0); if (s.placeId === it.place.id && !(schedEd(s.id) || {}).hidden) { const d = TRIP_DAYS.find(x => x.date === s.date); if (d) add(d.key, s.start ? '' : schedSlotOf(s), s.start ? { start: s.start, end: s.end || '' } : null, 's:' + s.id); } }); }
  else if (it.note) { const day = dayOfItem(it.ref); if (day) add(day, findSlot(day, it.ref), getTime(day, it.ref), String(it.ref)); }
  out.sort((a, b) => TRIP_DAYS.findIndex(d => d.key === a.day) - TRIP_DAYS.findIndex(d => d.key === b.day) || String((a.time || {}).start || '').localeCompare(String((b.time || {}).start || '')));
  return out;
}
function iwPickInstance(list, ctx) {
  if (!list.length) return null;
  if (ctx && ctx.day) { const m = list.find(x => x.day === ctx.day && (!ctx.tok || x.tok === String(ctx.tok))) || list.find(x => x.day === ctx.day); if (m) return m; }
  const t = activeTripObj(), iso = todayStr(); if (t.start && iso >= t.start && iso <= t.end) { const nx = list.find(x => (dayByKey(x.day) || {}).date >= iso); if (nx) return nx; }
  return list[0];
}
function iwWhen(inst, role) { const d = dayByKey(inst.day), today = d && d.date === todayStr(); const tm = inst.time && inst.time.start ? inst.time.start + (inst.time.end ? '–' + inst.time.end : '') : (SLOT_SHORT[inst.slot] || '');
  return { today, text: (today ? 'היום' : (d ? tmFmt(role || 'day', d.date) : '')) + (tm ? SEP + tm : '') }; } // 10.2.0: the text only - the chip and the status line draw its icon
// the status line: where the item is in the plan; a tap opens the scheduling window (travel and hotel: text only)
// 9.1.1 (12ג-1): a card's "when" line, its shared parts - the night's stay and "and N more days"
function stayOf(l) { const n = nightsBetween(l.checkIn, l.checkOut), iso = todayStr(); return { now: l.checkIn <= iso && iso < l.checkOut, nights: n ? SEP + (n === 1 ? 'לילה אחד' : n + ' לילות') : '' }; }
const moreDays = list => list.length > 1 ? `${SEP}ועוד ${list.length - 1} ${list.length === 2 ? 'יום' : 'ימים'}` : '';
function iwStatusHTML(it, ctx) { // 10.2.0 (design-2): a tinted line with its icon ("today" warm); a button opens scheduling
  const esc = escH, t = activeTripObj(), arch = !!t.archived || !!ARCHIVE_VIEW, go = msi('chevron_right', { size: 20, cls: 'iw-go' });
  const rate = it.place ? ratingOf(it.place.id) : null, rateTxt = arch && rate && rate.r ? `${SEP}${RATE[rate.r]}${rate.w ? ' "' + esc(rate.w) + '"' : ''}` : '';
  const line = (ic, txt, today) => `<div class="iw-status${today ? ' today' : ''}">${tagIc(ic)}<span>${txt}</span></div>`;
  if (it.kind === 'travel') { const f = it.travel; if (!f) return '';
    const tm = f.depart ? SEP + esc(f.depart) + (f.arrive ? '–' + esc(f.arrive) : '') : '', today = f.date === todayStr();
    return line(today ? 'today' : 'calendar_month', (today ? 'היום' : esc(tmFmt('day', f.date))) + tm, today); }
  if (it.hotel && it.lodging.length) { const l = it.lodging[0], S = stayOf(l);
    return line('hotel', `${S.now ? ('הלילה' + SEP) : ''}${tmFmt('range', [l.checkIn, l.checkOut])}${S.nights}${it.lodging.length > 1 ? `${SEP}ועוד ${it.lodging.length - 1}` : ''}${rateTxt}`, S.now); }
  if (!TRIP_DAYS.length || !t.id) return rateTxt ? line('star', rateTxt.slice(3)) : '';
  const list = iwInstances(it), inst = iwPickInstance(list, ctx);
  if (arch) return inst ? line('calendar_month', `${esc(iwWhen(inst).text)}${list.length > 1 ? `${SEP}ועוד ${list.length - 1} ימים` : ''}${rateTxt}`) : (rateTxt ? line('star', rateTxt.slice(3)) : '');
  if (!inst) return `<button type="button" class="iw-status iw-sched" data-act="item.sched">${tagIc('calendar_add_on')}<span>עוד לא בתוכנית - לשבץ</span>${go}</button>`;
  const w = iwWhen(inst);
  return `<button type="button" class="iw-status iw-sched${w.today ? ' today' : ''}" data-act="item.sched">${tagIc(w.today ? 'today' : 'calendar_month')}<span>${esc(w.text)}${moreDays(list)}</span>${go}</button>`;
}
// the small line: kind · booking tag · key point · my rating · a past trip's rating · price · status
// the meta of a place (row 2, plain text): price · this trip's rating · a past trip's rating
function placeMeta(p, rateOn, past) {
  const b = [];
  const pr = fmtPrice(p.price); if (pr) b.push(escH(pr)); // 11.42.0: through the one price formatter ("$$ · בינוני", "25 € לאדם · נכון ל-11.2026")
  const r = ratingOf(p.id); if (r && r.r && rateOn()) b.push(symTip('sym.rate.' + r.r, RATE[r.r]));
  const ps = past(p); if (ps) b.push(ps);
  return b;
}
// the marks of a place (row 2, tags): key, booking, access / closed, added / edited
function placeMarks(p, bookId) {
  const m = [];
  if (p.key) m.push(keyTag());
  const tg = bookTag(bookingOf(bookId != null ? bookId : p.id), reservationClass(p.reservation)); if (tg) m.push(tg);
  m.push(statusBadgesHTML(p));
  return m.filter(Boolean);
}
function iwTagsHTML(it) { // the expanded card's tags row - the card's own tags, with the booking spelled out
  const esc = escH, p = it.place, meta = [], t = [];
  if (it.sched) t.push(grpTag());
  if (it.kind === 'travel') meta.push(esc(travelKindName(it.travel)));
  else if (it.kind === 'note') meta.push(it.sched ? '' : TX.note);
  else if (p) meta.push(esc(it.hotel && !it.sched ? TX.lodging : p.layer_name || ''));
  if (p) meta.push(...placeMeta(p, () => !activeTripObj().archived, pastRateTagHTML));
  t.push(cdMeta(meta));
  if (it.sched && schedEdChanged(rawSched(it.sched.id))) t.push(`<span class="tl-tag mine">${tagIc('edit')}שלי</span>`);
  if (p) t.push(...placeMarks(p));
  const h = t.filter(Boolean).join(''); return h ? `<div class="iw-small cd-tags">${h}</div>` : '';
}
function iwNavUrl(p) { return p.manualCoord && (p.userAdded || p.tripOnly) ? navUrl(p.manualCoord.lat + ',' + p.manualCoord.lng) : navUrl(p.address); }
// 9.1.1 (12ג-1): the parts of a card, once - a link button (🧭 / 🔍), the ❤️ button and the row of a place's links in the
// mini card and the plan card; the item window (iw) and the candidate window use the same link and ❤️ builders
function linkBtn(cls, href, icon, label, title) { return `<a class="${cls}" href="${href}" target="_blank" rel="noopener" aria-label="${label}" title="${title || label}">${icon}</a>`; }
function favBtn(cls, p, off, word) { return `<button type="button" class="${cls}" data-act="place.fav" data-active="${STATE.favorites.has(p.id)}" aria-label="מועדף" title="מועדף"${off ? ' disabled' : ''}>${actIc('star')}${word ? '<span>מועדף</span>' : ''}</button>`; }
function placeLinksRow(first, p, off, rm) { // 10.2.0 (design-2): one row of icons; remove from the plan (rm) alone at the far left end
  const h = `${first}${p ? linkBtn('tl-act a-nav', iwNavUrl(p), actIc('navigation'), 'ניווט') + linkBtn('tl-act a-g', googleInfoUrl(p.name, p.address), actIc('travel_explore'), 'חיפוש ב-Google') + favBtn('tl-act a-fav', p, off()) : ''}${rm || ''}`;
  return h ? `<div class="tl-acts mc-acts">${h}</div>` : '';
}
function iwActionsHTML(it, ctx) { // 10.2.0 (design-2): actions with words (as Google Maps' place sheet) - the first by context (map / measure), ✏️ last
  const p = it.place, ro = !!activeTripObj().archived || !!ARCHIVE_VIEW, A = [];
  const w = (ic, word) => `${actIc(ic)}<span>${word}</span>`, a = (ic, word, href, label) => `<a class="iw-act" href="${href}" target="_blank" rel="noopener" aria-label="${label || word}" title="${label || word}">${w(ic, word)}</a>`;
  const edit = `<button type="button" class="iw-act" data-act="item.edit" aria-label="עריכה" title="עריכה"${ro ? ' disabled' : ''}>${w('edit', 'עריכה')}</button>`;
  if (it.kind === 'travel') { const f = it.travel || {}; const q = [f.airline, f.number].filter(Boolean).join(' ') || ((TRAVEL_MODES[f.mode] || TRAVEL_MODES.flight)[1] + ' ' + (f.from || '') + ' ' + (f.to || ''));
    A.push(a('navigation', 'ניווט', travelNavUrl(f) || navUrl(f.from || ''), 'ניווט למיקום היציאה'), a('travel_explore', 'בגוגל', `https://www.google.com/search?q=${encodeURIComponent(q)}`, 'חיפוש ב-Google'), edit); }
  else if (p) {
    if (routeCoordOf(p) || p.address) { if (ctx && ctx.mapHost) A.push(`<button type="button" class="iw-act" data-act="map.measureFrom" data-v="${ctx.mapHost}" aria-label="מדידה מכאן">${w('track_changes', 'מדידה')}</button>`); else if (MAP_AVAILABLE) A.push(`<button type="button" class="iw-act" data-act="item.map" aria-label="במפה">${w('map', 'במפה')}</button>`); }
    A.push(a('navigation', 'ניווט', iwNavUrl(p)), a('travel_explore', 'בגוגל', googleInfoUrl(p.name, p.address), 'שעות, אתר וביקורות ב-Google'), favBtn('iw-act', p, ro, true));
    if (!ro) A.push(edit); }
  else if (!ro) A.push(edit);
  return A.length ? `<div class="iw-acts">${A.join('')}</div>` : '';
}
function iwSection(title, body) { return body ? `<section class="iw-sec"><h4>${title}</h4>${body}</section>` : ''; }
const iwRow = (ic, html, cls) => `<div class="iw-row${cls ? ' ' + cls : ''}">${msi(ic, { size: 20 })}<span>${html}</span></div>`;
const lkBtn = (ic, word, attrs) => `${attrs.startsWith('href') ? `<a class="lk-btn" ${attrs} target="_blank" rel="noopener">` : `<button type="button" class="lk-btn" ${attrs}>`}${msi(ic, { size: 18 })}${word}${attrs.startsWith('href') ? '</a>' : '</button>'}`;
function iwSectionsHTML(it, ctx) {
  const esc = escH, p = it.place, out = [];
  // 1. from the organized schedule
  if (it.sched) { const raw = rawSched(it.sched.id), ch = raw ? schedChangeText(raw) : '', e = it.sched;
    out.push(iwSection('מ' + TX.group, `${iwRow('groups', `${esc(e.title)}${SEP}${tmFmt('date', e.date)}${e.start ? SEP + esc(e.start) + (e.end ? '–' + esc(e.end) : '') : ''}`)}${e.note ? iwRow('sticky_note_2', esc(e.note)) : ''}${ch ? `<div class="iw-row sc-mine">${msi('edit', { size: 20 })}<span>שונה אצלי ${tipI('item.mine')}: ${esc(ch)}</span><button type="button" class="iw-tbtn" data-act="sched.reset" data-v="${esc(e.id)}">${msiT('restart_alt', 'חזרה למקור', { size: 18 })}</button></div>` : ''}`)); }
  // 2. what it is
  const what = [];
  if (it.kind === 'travel') { const f = it.travel || {};
    what.push(iwRow('flight_takeoff', `${esc(f.from || '')} ← ${esc(f.to || '')}`));
    if (f.airline || f.number) what.push(iwRow('airplane_ticket', `${esc([f.airline, f.number].filter(Boolean).join(' '))}${f.terminal ? SEP + 'טרמינל ' + esc(f.terminal) : ''}`));
    if (f.depart || f.arrive) { const w = travelWords(f.mode); what.push(iwRow('schedule', `${w.depart} <b dir="ltr">${esc(f.depart || '—')}</b>${SEP}${w.arrive} <b dir="ltr">${esc(f.arrive || '—')}</b>`)); }
    if (f.note) what.push(iwRow('sticky_note_2', esc(f.note))); }
  if (it.kind === 'note' && it.note && it.note.address) what.push(iwRow('location_on', esc(it.note.address)));
  if (p) {
    if (it.hotel) what.push(hotelPhotoHTML(p, !!activeTripObj().archived || !!ARCHIVE_VIEW)); // 9.8.0: PHOTOS
    if (p.description) what.push(`<p class="iw-desc" data-iwdesc>${esc(p.description)}</p><button type="button" class="iw-more" data-act="item.moreDesc" hidden>עוד</button>${wikiTextCreditHTML(p)}`); // legal-credits (C4): Wikipedia's text with its source and licence
    const tags = [];
    if (regionName(p)) tags.push(`<span class="badge">${esc(regionName(p))}</span>`);
    const c = routeCoordOf(p); if (c) tags.push(`<span class="badge elev-badge" data-elev="${c.lat},${c.lng}" hidden></span>`);
    if (tags.length) what.push(`<div class="meta-row">${tags.join('')}</div>`);
    const l = it.lodging[0]; if (it.hotel && l) { const inc = (Array.isArray(l.includes) ? l.includes : String(l.includes || '').split(',')).map(x => String(x).trim()).filter(Boolean);
      if (l.rating) what.push(iwRow('star', `${esc(l.rating)}${l.ratingAt ? ` (נכון ל-${esc(l.ratingAt)})` : ''}`));
      if (inc.length) what.push(`<div class="hc-chips">${inc.map(x => `<span>${esc(x)}</span>`).join('')}</div>`); }
    if (p.address) what.push(iwRow('location_on', esc(p.address)));
    if (it.hotel && l && hotelNearby(p)) what.push(iwRow('near_me', `ליד הלינה: ${hotelNearby(p)}`)); }
  out.push(iwSection('מה זה', what.join('')));
  // 3. booking
  if (p) { const bk = bookingOf(p.id), l = it.lodging[0], bb = [];
    if (it.hotel && l) { bb.push(iwRow('login', `כניסה ${tmFmt('date', l.checkIn)}${l.checkInTime ? ' מ-' + esc(l.checkInTime) : ''}${SEP}יציאה ${tmFmt('date', l.checkOut)}${l.checkOutTime ? ' עד ' + esc(l.checkOutTime) : ''}${l.guests ? SEP + esc(l.guests) : ''}`));
      if (l.bookingRef) bb.push(iwRow('confirmation_number', `מספר הזמנה <b dir="ltr" style="user-select:all">${esc(l.bookingRef)}</b>`));
      const hp = fmtPrice(l.price, { hotel: true }), hd = fmtHotelDerived(l.price, nightsBetween(l.checkIn, l.checkOut)), hn = bpPrice(l.price, true).note; // 11.42.0: the price paid, its other figure, its note (whole)
      if (hp || hn) bb.push(iwRow('payments', [hp && `מחיר: ${esc(hp)}`, hd && esc(hd), hn && `<span class="iw-wrap">${esc(hn)}</span>`].filter(Boolean).join('<br>'))); if (l.notes) bb.push(iwRow('sticky_note_2', esc(l.notes))); }
    else { const rt = resvText(p.reservation), pt = fmtPrice(p.price, { note: true }); // 11.42.0: the choice and its note, the price and its note - whole, wrapped
      if (rt) bb.push(iwRow('info', `<span class="iw-wrap">${esc(rt)}</span>`)); if (pt) bb.push(iwRow('payments', `<span class="iw-wrap">${esc(pt)}</span>`));
      if (bk) bb.push(iwRow('event_available', `${bookingLabel(p.id, true)}${bk.ref ? `${SEP}מספר <b dir="ltr" style="user-select:all">${esc(bk.ref)}</b>` : ''}`));
      if (!activeTripObj().archived && hasTrip()) bb.push(`<button type="button" class="chip" data-act="place.booking">${tagIc(bk ? 'edit' : 'event_available')}${bk ? 'פרטי ההזמנה' : 'סימון כהוזמן'}</button>`); }
    out.push(iwSection('הזמנה', bb.join(''))); }
  // 4. how to get there
  if (p && p.transit) out.push(iwSection('איך מגיעים', iwRow('directions', esc(p.transit))));
  // 5. links (the map / measure is the first action)
  const L = [];
  if (p) { const c = routeCoordOf(p); if (c) L.push(lkBtn('streetview', 'Street View', `href="${streetViewUrl(c)}"`));
    const gu = gidMapsUrl(p) || p.mapsUrl; if (gu) L.push(lkBtn('link', 'Maps', `href="${esc(gu)}"`)); // 11.22.0 (Q8 (1)): by the Google id - exactly this place
    const u = discWikiUrlFor(p); if (u) L.push(lkBtn('menu_book', 'ויקיפדיה', `href="${esc(u)}"`));
    if (p.address) L.push(lkBtn('content_copy', 'כתובת', 'data-act="item.copyAddress"'));
    if (c && ctx && ctx.mapHost && walkCan(ctx.mapHost)) L.push(`<button type="button" class="lk-btn" data-act="walk.from" data-v="${esc(ctx.mapHost)}">${msiT('directions_walk', 'מה במרחק הליכה מכאן', { size: 18 })}</button>`); // walk-time (Q2): from a map's place, a link - not a new primary
    const l = it.lodging[0]; if (it.hotel && l) { const wa = String(l.whatsapp || '').replace(/[^\d]/g, ''), tel = String(l.phone || '').replace(/[^\d+]/g, ''), web = l.website ? (/^https?:/.test(l.website) ? l.website : 'https://' + l.website) : '';
      if (tel) L.push(`<a class="lk-btn" href="tel:${tel}">${msi('call', { size: 18 })}חיוג</a>`); if (wa) L.push(lkBtn('chat', 'וואטסאפ', `href="https://wa.me/${wa}"`)); if (web) L.push(lkBtn('language', 'אתר', `href="${esc(web)}"`)); } }
  const gl = p ? gidLinkedHTML(p) : ''; // 11.22.0 (Q8 (2), Q9 (2)): "מקושר לגוגל מפות", and a place that repeats another
  out.push(iwSection('קישורים', L.length || gl ? `${L.length ? `<div class="brow tight card-links">${L.join('')}</div>` : ''}${gl}` : ''));
  return out.join('');
}
// the expanded card's head: the circle, the name and the visited toggle - the same card at a larger size; no ✕ (pull down,
// back, or a tap outside close it)
function iwHeadHTML(lead, name, vis) { return `<div class="sheet-head iw-head">${lead}<b dir="auto" data-act="txt.full"><span class="nm t-ell">${name}</span></b>${vis || ''}</div>`; }
// kit-fixes (item 4; decisions 2026-11-22 · Review of the `kit-review` report, Q4): the place's local name, under its Hebrew name - quiet,
// isolated in its own direction (a Latin or local-script name inside the Hebrew window), wrapped whole
function iwForeignHTML(p) { const f = p && typeof p.foreign === 'string' ? p.foreign.trim() : ''; return f && f !== String(p.name || '').trim() ? `<div class="iw-foreign"><bdi dir="auto">${escH(f)}</bdi></div>` : ''; }
function openItemWin(ref, ctx) {
  ctx = ctx || {}; const sheet = document.getElementById('sheet');
  const draw = () => { const it = itemOf(ref); if (!it) { closeSheet(); return; } const esc = escH;
    const ttl = it.kind === 'travel' && it.travel ? travelTitle(it.travel) : it.name;
    sheet.innerHTML = `<div class="iw" data-iwkind="${it.kind}" data-ref="item:${esc(String(it.ref))}">${iwHeadHTML(itemLead(it), esc(ttl), it.place && it.kind !== 'travel' ? visBtnHTML(it.place.id, STATE.visited.has(it.place.id)) : '')}${it.kind !== 'travel' ? iwForeignHTML(it.place) : ''}${iwTagsHTML(it)}${iwStatusHTML(it, ctx)}${iwActionsHTML(it, ctx)}${it.place ? rateRowHTML(it.place) : ''}${iwSectionsHTML(it, ctx)}</div>`;
    const d = sheet.querySelector('[data-iwdesc]'), mb = sheet.querySelector('.iw-more'); if (d && mb) requestAnimationFrame(() => { if (d.scrollHeight > d.clientHeight + 2) mb.hidden = false; });
    fillElev(sheet);
  };
  winOpen('openItemWin', 'פרטים', draw); const t = layerTop(); if (t) t.ctx = ctx; // the window's context (map host, plan day) for its actions
}
// 6.1.0: the item window's actions (a change shows in it at once - the mechanism draws the top window)
act('item.edit', c => { const x = c.ref && c.ref.obj; if (x) iwEdit(x); });
act('sched.reset', c => { const s = rawSched(c.v); if (!s) return; const moved = ((schedEd(s.id) || {}).ch || {}).date; // 11.34.0 (P14): a moved line - back to its source day and time
  planChange(moved ? `↺ חזר ליום ${tmFmt('day', s.date)}` : '↺ חזר למקור: ' + s.title, () => { delete planX().sched[s.id]; }); });
act('item.copyAddress', c => { const x = c.ref && c.ref.obj; if (x && x.place) copyAddress(x.place.address, c.el); });
act('item.moreDesc', c => { const d = c.el.parentElement.querySelector('[data-iwdesc]'); if (d) { d.classList.add('open'); reveal(d, false); } c.el.remove(); return 'quiet'; });
// 5.7.0: the details window in its candidate state (not yet in a destination or a trip): the same frame, parts and order as the
// item window; the scheduling line becomes one prominent pick button, the actions only what fits, empty parts are not shown
function openCandWin(c) {
  const sheet = document.getElementById('sheet');
  const draw = () => { const esc = escH, pk = c.pick || {}, small = (c.small || []).filter(Boolean);
    const A = [];
    const w = (ic, word) => `${actIc(ic)}<span>${word}</span>`;
    if (c.edit) A.push(`<button type="button" class="iw-act" data-act="cand.edit" aria-label="תיקון" title="תיקון">${w('edit', 'תיקון')}</button>`);
    if (c.nav) A.push(`<a class="iw-act" href="${esc(c.nav)}" target="_blank" rel="noopener" aria-label="ניווט">${w('navigation', 'ניווט')}</a>`);
    if (c.search) A.push(`<a class="iw-act" href="${esc(c.search)}" target="_blank" rel="noopener" aria-label="${esc(c.searchLabel || 'חיפוש')}">${w(/ויקי/.test(c.searchLabel || '') ? 'menu_book' : 'travel_explore', /ויקי/.test(c.searchLabel || '') ? 'לערך' : 'בגוגל')}</a>`);
    if (c.note) A.push(c.note.replace('class="note-btn', 'class="iw-act note-btn'));
    sheet.innerHTML = `<div class="iw" data-iwkind="cand">${iwHeadHTML(c.lead || leadHTML('grey', msi('location_on', { size: 18 }), ''), esc(c.name))}
        ${small.length ? `<div class="iw-small cd-tags">${cdMeta(small)}</div>` : ''}
        <button type="button" class="iw-status iw-pick" data-act="cand.pick" data-active="${!!pk.active}"${pk.disabled ? ' disabled' : ''}>${tagIc(pk.active ? 'check_circle' : pk.disabled ? 'info' : 'add_circle')}<span>${esc(pk.label || '')}</span></button>
        <div class="iw-acts">${A.join('')}</div>
        ${iwSection('מה זה', c.what ? c.what() : '')}${iwSection('קישורים', c.links || '')}</div>
      ${c.del ? fmEndActs([{ act: 'cand.del', label: c.del.label, del: true }]) : ''}`;
  };
  winOpen('openItemWin', 'פרטים', draw); const t = layerTop(); if (t) t.cand = c;
}
// a window whose form keeps its state in its own scope marks a controller on its layer (ctl); its buttons are registered
// actions "<window>.<name>" that call it - same names, one listener, the same draw after a change
// a part drawn into a full-screen element of its own (the trip-picture editor) keeps it on that element: ctlOn(id, prefix)
function ctlOn(id, prefix) { const el = document.getElementById(id); if (!el) return {}; el._ctl = el._ctl || {}; return (el._ctl[prefix] = {}); }
// a screen part (drawn into its <main>) keeps its controller on that <main>, under its own prefix: ctlNS(prefix)
function ctlNS(prefix) { const m = document.getElementById('main'); m._ctl = m._ctl || {}; return (m._ctl[prefix] = {}); }
function ctlOf(el, prefix) { for (let n = el; n; n = n.parentElement) { if (n._ctl && n._ctl[prefix]) return n._ctl[prefix]; if (n.id === 'sheet') break; }
  { const h = el.closest && el.closest('.screen-head'), m = h && h.parentElement.querySelector(':scope > main'); if (m && m._ctl && m._ctl[prefix]) return m._ctl[prefix]; } // 10.3.0: a screen's head buttons use its main's controller
  return (layerTop() || {}).ctl || {}; }
function ctlActs(prefix, names, quiet) { names.forEach(k => act(prefix + '.' + k, c => { const f = ctlOf(c.el, prefix)[k]; if (!f) return; const r = f(c.el, c); return r !== undefined ? r : quiet && quiet.includes(k) ? 'quiet' : undefined; })); }
// the candidate's own callbacks live on its window (pick / edit / delete)
const candOf = () => (layerTop() || {}).cand || null;
act('cand.pick', () => { const c = candOf(), p = c && c.pick; if (p && !p.disabled) p.on(); });
act('cand.edit', () => { const c = candOf(); if (c && c.edit) c.edit(); });
act('cand.del', () => { const c = candOf(); if (c && c.del) c.del.on(); });
// ✏️ - the editor of the kind
function iwEdit(it) {
  if (it.kind === 'travel') { if (it.travel) openTravelEditor(it.travel.id); return; }
  if (it.sched) { openSchedSheet(it.sched.id); return; }
  if (it.hotel && it.lodging[0]) { openTripItemEditor('lodging', it.lodging[0].id); return; }
  if (it.kind === 'note') { openNoteEditSheet(String(it.ref)); return; }
  if (it.place) openPlaceEditor({ id: it.place.id });
}
// 🗺️ במפה: a full-screen map over the window (a 'full' layer of the stack); ✕ or the phone's back return to the window.
// From the plan: the day of the instance with its numbered stops in order; elsewhere: the place, centered and marked.
let IW_MAP = null;
function openItemMap(it, ctx) {
  if (!MAP_AVAILABLE || IW_MAP) return; if (!leafOk()) { leafThen(() => openItemMap(it, ctx)); return; } /* 11.29.0 (launch-fast): the library first */ const p = it.place; const c0 = p && routeCoordOf(p), y0 = window.scrollY;
  const el = document.createElement('div'); el.className = 'fs-pick iw-map'; el.id = 'iwMap'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'במפה');
  el.innerHTML = `<div class="fsp-map" id="iwMapBox"></div><div class="iw-map-title">${escH(it.name)}</div><button type="button" class="fs-btn" id="iwMapClose" data-act="layer.back" aria-label="סגירה" title="סגירה">${msi('close')}</button>${c0 ? `<a class="iw-map-nav" href="https://www.google.com/maps/dir/?api=1&destination=${c0.lat},${c0.lng}" target="_blank" rel="noopener" aria-label="ניווט" title="ניווט">${msi('navigation')}</a>` : ''}`; // 10.5.0 (design-4 part 2): ✕, the name and navigate
  document.body.appendChild(el);
  const map = mapTool('iwMapBox'); addLayerBtn(el); // 5.9.0
  IW_MAP = { el, map, y: y0 }; layerPush('openItemMap', 'full', fp => { closeItemMap(); layerDone('openItemMap', fp); });
  const pts = [];
  const inst = iwPickInstance(iwInstances(it), ctx);
  if (inst && ctx && ctx.day) { // the day: its places in order, numbered, joined by a line
    const d = ensureDay(inst.day), ids = ['morning', 'afternoon', 'evening'].flatMap(k => d[k] || []); let n = 0;
    ids.forEach(id => { const q = planItem(id); const c = q && routeCoordOf(q.dup ? POINTS.find(x => x.id === copyRef(id)) || q : q); if (!c) return; n++;
      const me = String(id) === String(ctx.tok) || (p && q.id === p.id); L.marker([c.lat, c.lng], { icon: pinDivIcon(q, { numbered: true, number: n }), zIndexOffset: me ? 3000 : 0 }).addTo(map); pts.push([c.lat, c.lng]); });
    if (pts.length > 1) L.polyline(pts, { color: '#1E88E5', weight: 3, opacity: .7, dashArray: '6 6' }).addTo(map); }
  if (c0) { const m = L.marker([c0.lat, c0.lng], { icon: pinDivIcon(p), zIndexOffset: 4000 }).addTo(map); const e = m.getElement && m.getElement(); if (e) e.classList.add('pin-sel'); }
  if (c0) map.setView([c0.lat, c0.lng], 16); else if (pts.length) map.fitBounds(pts, { padding: [40, 40] }); else map.setView((curDest().meta.center || [0, 0]), 13);
}
act('layer.back', () => winBackLayer(false)); // ✕ of a full layer that is not a window (a full-screen map)
function closeItemMap() { if (!IW_MAP) return; const y = IW_MAP.y; mapDispose(IW_MAP.map); IW_MAP.el.remove(); IW_MAP = null; if (y) requestAnimationFrame(() => appScroll(y)); } // 5.3.0: the list underneath stays where it was
// close the top layer when it is not a window (a full screen of the stack)

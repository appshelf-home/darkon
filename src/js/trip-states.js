// ================= 4.28.0: TRIP MANAGEMENT - STATES, ARCHIVE, MEMORY SCREEN =================
// A trip's state comes from its dates (before / during / ended), plus one "archived" mark with a reason (ended / cancelled).
// Closing keeps a snapshot of what the trip touched (places that were marked, planned or visited, with their layers and
// destination details), so later changes or deletions of a destination never alter an archived trip. Archived trips are
// read-only and open in a memory screen; "↩️ פתיחה מחדש" brings them back to the state their dates give.
var ARCHIVE_VIEW = null;  // { id, prev, ghosts: [destination ids added only for this view] }
var memoryTrip = null;    // the trip the memory screen shows
// the trip to show when the active one is closed or gone: one happening now, else the nearest coming one, else the latest ended
function pickRelevantTrip(exclude) {
  const ts = Object.values(STATE.trips).filter(t => t.id !== exclude && !t.archived);
  const now = ts.filter(t => tripState(t) === 'during').sort((a, b) => String(a.start).localeCompare(String(b.start)));
  if (now.length) return now[0].id;
  const soon = ts.filter(t => tripState(t) === 'before').sort((a, b) => (a.start ? 0 : 1) - (b.start ? 0 : 1) || String(a.start).localeCompare(String(b.start)));
  if (soon.length) return soon[0].id;
  const ended = ts.filter(t => tripState(t) === 'ended').sort((a, b) => String(b.end).localeCompare(String(a.end)));
  return ended.length ? ended[0].id : null;
}
function tripStateLine(t, inCard) {
  const st = tripState(t), iso = todayStr();
  if (st === 'archived') return t.archived.reason === 'cancelled' ? `בוטל${t.start ? SEP + tmFmt('year', t.start) : ''}` : `הסתיים${SEP}${tmFmt('date', t.end)}`; // 10.8.0 (design-icons, gap 67): line icons, no emoji
  if (st === 'during') { const n = dayList(t.start, t.end), i = n.findIndex(d => d.date === iso); return `${inCard ? '' : msi('near_me', { cls: 'msi-in' }) + ' עכשיו' + SEP}יום ${i + 1} מתוך ${n.length}`; } // 5.15.0 (ד5): in a card the group title already says "עכשיו"
  if (st === 'before') { if (!t.start) return `${msi('edit_calendar', { cls: 'msi-in' })} ${tripLen(t) ? tripLen(t) + ' ימים' + SEP : ''}עוד בלי תאריכים`; const d = daysBetween(iso, t.start); return `${msi('event_upcoming', { cls: 'msi-in' })} ${t.dateMode === 'est' ? '≈ ' : ''}${d === 1 ? 'מחר' : `בעוד ${d} ימים`}${t.dateMode === 'est' ? (SEP + 'תאריכים משוערים') : ''}`; }
  const d = daysBetween(t.end, iso); return `הסתיים ${d === 1 ? 'אתמול' : `לפני ${d} ימים`}${SEP}מחכה לסגירה`;
}
// ---- switching the active trip without touching archived ones ----
function setActiveTripQuiet(id) {
  stashActive(); STATE.activeTrip = id || null; loadPersonal(STATE.activeTrip); applyActiveTrip(); FP.regions = defaultRegions(); syncFlightsToPlan(); updateHeader();
}
// run fn with trip id as the active trip (points, layers and personal data of that trip), then come back
// A8 (decisions 2026-11-13 review of 11.10.0): a closed trip is borrowed read-only - since 11.12.0 (item 9) by the write point itself:
// stashActive never writes a closed trip (tripWritable), so neither the borrow nor anything inside it writes its data back
function withTrip(id, fn) {
  const prev = STATE.activeTrip; if (prev === id) return fn();
  stashActive(); STATE.activeTrip = id; loadPersonal(id); applyActiveTrip();
  try { return fn(); } finally { stashActive(); STATE.activeTrip = prev; loadPersonal(prev); applyActiveTrip(); }
}
function touchedIds(td, t) {
  const s = new Set([...(td.favorites || []), ...(td.visited || []), ...Object.keys(td.bookings || {}).map(Number), ...Object.keys(td.rating || {}).map(Number), ...(td.notReached || [])]);
  Object.values(td.itinerary || {}).forEach(d => Object.values(d || {}).forEach(a => (a || []).forEach(x => { if (typeof x === 'number') s.add(x); })));
  (td.highlights || []).forEach(h => { if (h.placeId != null) s.add(h.placeId); });
  (t.places || []).forEach(p => s.add(p.id));
  (t.lodging || []).forEach(l => { if (l.placeId != null) s.add(l.placeId); });
  return s;
}
function snapPlace(q) {
  const out = {}; ['id', 'name', 'dest', 'layer', 'layer_name', 'color', 'icon', 'description', 'address', 'manualCoord', 'region', 'key', 'price', 'reservation', 'transit', 'status', 'statusNote', 'src', 'tripOnly', 'userAdded', 'gid'].forEach(k => { if (q[k] != null && q[k] !== '') out[k] = JSON.parse(JSON.stringify(q[k])); });
  const c = q.manualCoord || (q.address && GEOCODE_CACHE[q.address]); if (c && isFinite(c.lat)) { out.coord = { lat: c.lat, lng: c.lng }; const el = knownElev(c); if (el != null) out.elev = el; } // 4.30.0: height for the memento
  return out;
}
function buildTripSnapshot(id) {
  return withTrip(id, () => {
    const t = activeTripObj(); stashActive(); const td = STATE.tripData[id] || {}, ids = touchedIds(td, t);
    const places = POINTS.filter(q => ids.has(q.id)).map(snapPlace);
    const dests = {}; tripDests(t).forEach(did => { const d = DESTS[did], m = d.meta || {};
      dests[did] = { name: m.name, description: m.description || '', center: m.center, theme: m.theme || null, currency: m.currency || null, country: m.country || '', timeZone: m.timeZone || '', idBase: d.idBase || 0, regions: m.regions || [] }; }); // 5.12.0: + country
    const layers = LAYER_DEFS.map(l => ({ id: l.id, name: l.name, label: l.label, color: l.color, icon: l.icon, type: l.type || '', collection: !!l.collection, dest: l.dest }));
    const collections = LAYER_DEFS.filter(l => l.collection && !l.hidden).map(l => { const all = POINTS.filter(q => q.layer === l.id && !isGoneStatus(q.status));
      return { layer: l.id, name: l.name, icon: l.icon, color: l.color, total: all.length, found: all.filter(q => STATE.visited.has(q.id)).map(q => q.id) }; });
    // places of the trip's destinations near the stops, for the memento's city picture (only the few closest key places)
    const keys = POINTS.filter(q => q.key && !ids.has(q.id)).slice(0, 40).map(snapPlace);
    return { at: Date.now(), v: APP_VERSION, places, keys, dests, layers, collections };
  });
}
function archiveTrip(id, reason, opts) {
  const t = STATE.trips[id]; if (!t) return;
  stashActive(); const snap = buildTripSnapshot(id);
  t.archived = { reason, at: Date.now(), snap };
  if ((DEV.clSteps || {})[id]) { const c = { ...DEV.clSteps }; delete c[id]; devSet({ clSteps: c }); } // closing-where (Q7): a closed trip forgets the step its closing stopped at
  if (opts && opts.end) t.end = opts.end;
  if (STATE.activeTrip === id) setActiveTripQuiet(pickRelevantTrip(id));
  persist(); // undo-history Q6: the toast is the trip's one log row
  memoryTrip = id; closeSheet(); goTab(reason === 'cancelled' ? 'trips' : 'memory');
  showUndoToast(`${reason === 'cancelled' ? 'הטיול סומן כבוטל ועבר לזיכרונות' : 'הטיול נסגר ועבר לזיכרונות'}: ${t.name}`);
}
function reopenTrip(id) {
  const t = STATE.trips[id]; if (!t || !t.archived) return;
  if (ARCHIVE_VIEW) exitArchiveView(true);
  const snap = t.archived.snap || {};
  // a place that is no longer in its destination stays in the trip, from the snapshot
  const live = new Set(); tripDests(t).forEach(did => { const d = DESTS[did]; (d.places || []).forEach(p => live.add((d.idBase || 0) + p.id)); });
  Object.entries(STATE.edits.places).forEach(([k, e]) => { if (e.op === 'add') live.add(Number(k)); });
  (t.places || []).forEach(p => live.add(p.id));
  const td = STATE.tripData[id] || {}, used = touchedIds(td, t); let kept = 0;
  (snap.places || []).forEach(p => { if (live.has(p.id) || !used.has(p.id)) return;
    const d = DESTS[p.dest] || DESTS[tripDests(t)[0]]; if (!d) return;
    const layer = (p.layer != null && (d.meta.layers || []).some(l => (d.idBase || 0) + l.id === p.layer)) ? p.layer - (d.idBase || 0) : (d.meta.layers[0] || {}).id;
    const q = { ...p, dest: d.id, layer }; delete q.layer_name; delete q.color; delete q.coord; delete q.tripOnly; if (!q.manualCoord && p.coord) q.manualCoord = p.coord;
    t.places = (t.places || []).concat(q); kept++; });
  delete t.archived; persist(); // undo-history Q6: one row - the toast, with the trip's name
  if (!STATE.activeTrip) setActiveTripQuiet(id);
  goTab('trips');
  showUndoToast(`הטיול נפתח מחדש: ${t.name}${kept ? ` (${kept} מקומות שכבר לא ביעד נשארו בטיול)` : ''}`);
}
// ---- read-only full view of an archived trip ----
function enterArchiveView(id) {
  const t = STATE.trips[id]; if (!t || !t.archived) return;
  if (ARCHIVE_VIEW) exitArchiveView(true);
  const snap = t.archived.snap || {}, ghosts = [];
  Object.entries(snap.dests || {}).forEach(([did, m]) => { if (DESTS[did]) return;
    const ls = (snap.layers || []).filter(l => l.dest === did).map(l => ({ ...l, id: l.id - (m.idBase || 0) }));
    DESTS[did] = { id: did, idBase: m.idBase || 0, meta: { name: m.name, description: m.description, center: m.center, theme: m.theme, currency: m.currency, country: m.country || '', timeZone: m.timeZone, regions: m.regions || [], layers: ls }, places: [], info: '<div class="accordion-item"><button class="accordion-header t-wrap" data-act="acc.toggle">' + msi('inventory_2', { cls: 'acc-ic' }) + '<span>היעד כבר לא בטלפון</span> <span class="accordion-arrow">' + msi('expand_more') + '</span></button><div class="accordion-body"><p>הטיול בזיכרונות שומר את המקומות שהיו בו, אבל לא את המידע הכללי של היעד.</p></div></div>', ghost: true };
    ghosts.push(did); });
  ARCHIVE_VIEW = { id, prev: STATE.activeTrip, ghosts };
  stashActive(); STATE.activeTrip = id; loadPersonal(id); applyActiveTrip(); updateHeader();
  document.body.classList.add('read-only'); goTab('info');
}
function exitArchiveView(silent) {
  const v = ARCHIVE_VIEW; if (!v) return; ARCHIVE_VIEW = null;
  v.ghosts.forEach(did => { if (DESTS[did] && DESTS[did].ghost) delete DESTS[did]; });
  STATE.activeTrip = v.prev; loadPersonal(v.prev); applyActiveTrip(); updateHeader();
  document.body.classList.remove('read-only');
  if (!silent) { memoryTrip = v.id; goTab('memory'); }
}
function archiveBarHTML() {
  if (!ARCHIVE_VIEW) return ''; const t = STATE.trips[ARCHIVE_VIEW.id];
  return `<div class="ro-bar">${msi('photo_album')}<span class="bn-t"><b>זיכרון${SEP}לקריאה בלבד</b>${SEP}${_qe(t ? t.name : '')}</span><span class="ro-acts brow"><button type="button" class="ro-reopen" data-act="archive.reopen">פתיחה מחדש</button><button type="button" class="ro-x" data-act="archive.exit" aria-label="סגירת העיון" title="סגירת העיון">${msi('close')}</button></span></div>`; // 10.1.0 (design-1): a sticky violet strip
}
act('archive.reopen', () => reopenTrip(ARCHIVE_VIEW.id));
act('archive.exit', () => exitArchiveView());
act('draft.open', () => goTab('draft'));
function roToast() { showToast('הטיול בזיכרונות - לקריאה בלבד. "פתיחה מחדש" מאפשרת לשנות'); }

// ---- the trips screen, grouped by state ----
// 10.3.0 (design-3, look.md "Full screens, part 1"): the trips screen is the app's entrance - a hero with the stamp, two start tiles,
// the trip in progress (or else the next one) as a large card with its cover, the other upcoming trips as compact cards, "זיכרונות"
// as small covers in a row, the destinations folded, the trash as the last row. With no trip it is the empty copy's opening (no welcome screen).
function tripChipHTML(t) { const st = tripState(t), iso = todayStr();
  if (st === 'during') { const n = dayList(t.start, t.end), i = n.findIndex(d => d.date === iso); return `<span class="ent-chip now">${msi('near_me', { size: 16 })}יום ${i + 1} מתוך ${n.length}</span>`; }
  if (st === 'ended') return `<span class="ent-chip end">${msi('flag', { size: 16 })}מחכה לסגירה</span>`;
  if (st === 'before' && t.start) { const d = daysBetween(iso, t.start); return `<span class="ent-chip">${msi('hourglass_top', { size: 16 })}${t.dateMode === 'est' ? '≈ ' : ''}${d === 1 ? 'מחר' : `בעוד ${d} ימים`}</span>`; }
  return `<span class="ent-chip">${msi('edit_calendar', { size: 16 })}${tripLen(t) ? tripLen(t) + ' ימים' + SEP : ''}בלי תאריכים</span>`; }
const tripFlags = t => tripDests(t).map(destFlag).filter(Boolean).join('');
function tripDatesLine(t, o) { o = o || {}; const ds = tripDests(t).map(destName);
  return [t.start ? `${t.dateMode === 'est' ? '≈ ' : ''}${tmFmt('range', [t.start, t.end], { year: true })}` : (tripLen(t) ? tripLen(t) + ' ימים' : 'בלי תאריכים'), o.days && t.start ? `${dayList(t.start, t.end).length} ימים` : '', o.short ? ds[0] + (ds.length > 1 ? ` +${ds.length - 1}` : '') : ds.join(SEP)].filter(Boolean).join(SEP); }
// 10.13.0 (design-screens, gaps 2-3, Q2): a trip's look is its current destination's (an archived trip: its snapshot's first) -
// the heading font on its name (the large card, the memory hero), and its color as the name's text on the large card (in dark a light tone)
function tripTheme(t) { const snap = t.archived && t.archived.snap && t.archived.snap.dests, id = t.archived ? tripDests(t)[0] : dayDestId(null, t);
  return (snap && ((snap[id] || Object.values(snap)[0]) || {}).theme) || ((DESTS[id] || {}).meta || {}).theme || {}; }
function headFont(font) { font = HEADING_FONTS.includes(font) ? font : 'Rubik'; // legal-server (11.41.0): every heading font has its @font-face from the site (generated/text-fonts.css) - the browser asks its file only when a trip shows it
  return `'${font}', ${font === 'Frank Ruhl Libre' ? 'Georgia, serif' : 'Rubik, sans-serif'}`; }
function tripNameAttr(t, color) { const th = tripTheme(t), c = color && /^#[0-9a-f]{6}$/i.test(th.primary || '') ? `--tn-c:${th.primary};` : '';
  return ` class="trip-name${c ? ' trip-name-c' : ''}" style="--tn-f:${headFont(th.headingFont).replace(/"/g, '&quot;')};${c}"`; }
function tripCardHTML(t) { // the large card: cover, chip, flags, name, dates · destinations, the main action across, ✏️ · 📤 · ⋯
  const st = tripState(t), act = t.id === STATE.activeTrip && !ARCHIVE_VIEW, nm = _qe(String(t.name).split(' · ')[0]);
  const main = st === 'ended' ? ['close', msi('flag', { size: 18 }) + 'סגירת הטיול'] : st === 'during' ? ['plan', msi('today', { size: 18 }) + 'היום בטיול'] : ['plan', msi('calendar_month', { size: 18 }) + 'לתכנון'];
  return `<div class="card trip-card ent-big" data-ref="trip:${t.id}" data-tstate="${st}"><div class="ent-cover">${tripCoverHTML(t.id)}${tripChipHTML(t)}<span class="ent-flags">${tripFlags(t)}</span></div>
    <div class="ent-body"><h3><span${tripNameAttr(t, true)}>${nm}</span>${act ? ' <span class="badge tc-open">פתוח</span>' : ''}</h3><div class="sub">${sepTie(_qe(tripDatesLine(t, { days: true })))}</div>
    <div class="ent-acts brow tight"><button type="button" class="btn-nav tc-main" data-act="trips.tc" data-tc="${main[0]}">${main[1]}</button><button type="button" class="top-ic" data-act="trips.tc" data-tc="edit" aria-label="עריכה" title="עריכה">${msi('edit')}</button><button type="button" class="top-ic" data-act="trips.tc" data-tc="share" aria-label="שיתוף" title="שיתוף">${msi('share')}</button><button type="button" class="top-ic tc-more" data-act="trips.tc" data-tc="more" aria-label="כל הפעולות" title="כל הפעולות">${msi('more_horiz')}</button></div></div></div>`;
}
function tripRowHTML(t) { // a compact card: a cover thumbnail, the name, dates · country, the countdown, ›; a tap opens all of the trip's actions
  const act = t.id === STATE.activeTrip && !ARCHIVE_VIEW;
  return `<button type="button" class="card trip-card ent-row t-wrap" data-ref="trip:${t.id}" data-tstate="${tripState(t)}" data-act="trips.tc" data-tc="more"><span class="ent-th">${tripCoverHTML(t.id)}</span><span class="ent-rt"><b>${_qe(String(t.name).split(' · ')[0])}${act ? ' <span class="badge tc-open">פתוח</span>' : ''}</b><small>${_qe(tripDatesLine(t, { short: true }))}</small>${tripChipHTML(t)}</span>${msi('chevron_right', { cls: 'ent-go' })}</button>`;
}
function tripMemHTML(t) { // a past trip in "זיכרונות": a small cover card; a tap opens its memory screen
  const c = t.archived && t.archived.reason === 'cancelled';
  return `<button type="button" class="card trip-card ent-mem t-wrap" data-ref="trip:${t.id}" data-tstate="archived" data-act="trips.tc" data-tc="memory"><span class="ent-th">${tripCoverHTML(t.id)}</span><b>${_qe(String(t.name).split(' · ')[0])}</b><small>${c ? 'בוטל' : t.end ? _qe(tmFmt('year', t.end)) : ''}</small></button>`;
}
// 11.24.0 (small-ui-set C, memories-grid; decisions 2026-11-18 · "זיכרונות" on the trips screen: a grid that fills the row): a grid of
// 2 / 3 / 4 columns by the screen class (css .ent-mems --mc); the cards stretch so every row is full (a last row with fewer cards, or one
// memory, stretches too) and a cover keeps its ratio; on the trips screen (lim) at most two rows, newest first, the rest hidden by the class's
// count, and "כל הזיכרונות · N ›" opens them all in the same grid (the menu screen 'memories'); data-more: the smallest two-rows count N exceeds
function tripMemsHTML(arch, lim) { const n = arch.length, more = !lim ? 0 : n > 8 ? 8 : n > 6 ? 6 : n > 4 ? 4 : 0;
  return `<div class="ent-mems${lim ? ' lim' : ''}">${arch.map(tripMemHTML).join('')}</div>${more ? `<button type="button" class="ent-mall t-wrap" data-act="trips.memAll" data-more="${more}"><span>כל הזיכרונות${SEP}<bdi>${n}</bdi></span>${msi('chevron_right', { cls: 'ent-go' })}</button>` : ''}`; }
const tripsArchived = () => Object.values(STATE.trips).filter(t => tripState(t) === 'archived').sort((a, b) => String(b.end || '').localeCompare(String(a.end || '')));
function renderMemoriesScreen() { const ctl = ctlNS('trips'), arch = tripsArchived();
  document.getElementById('main').innerHTML = `<div class="section-head"><h2>${msi('photo_album', { cls: 'msi-in' })} כל הזיכרונות</h2><p>טיולים שנסגרו, החדש ראשון. נגיעה פותחת את הזיכרון.</p></div>`
    + (arch.length ? tripMemsHTML(arch, false) : emptyHTML(msi('photo_album'), 'טיול שנסגר מופיע כאן', '', 'עוד אין זיכרונות'));
  ctl.tc = (b, c) => runTripAction(c.ref.id, b.dataset.tc); }
const entHead = (ic, title, n, x) => `<div class="ent-h">${msi(ic, { size: 22 })}<span>${title}</span>${n ? `<small>${n}</small>` : ''}${x || ''}</div>`;
function renderTripsScreen(noActive) { const ctl = ctlNS('trips');
  if (ARCHIVE_VIEW) exitArchiveView(true); document.body.classList.add('on-entrance');
  noActive = !!(noActive || (!hasTrip() && Object.keys(STATE.trips).length));
  const all = Object.values(STATE.trips), used = new Set([].concat(...all.filter(t => !t.archived).map(tripDests)));
  const usedArch = new Set([].concat(...all.filter(t => t.archived).map(t => Object.keys((t.archived.snap || {}).dests || {}))));
  const by = s => all.filter(t => tripState(t) === s);
  const now = by('during').sort((a, b) => String(a.start).localeCompare(String(b.start)));
  const soon = by('before').filter(t => t.start).sort((a, b) => String(a.start).localeCompare(String(b.start)));
  const planning = by('before').filter(t => !t.start).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)); // 4.38.0: no dates yet
  const ended = by('ended').sort((a, b) => String(b.end).localeCompare(String(a.end)));
  const arch = tripsArchived();
  const big = now.length ? now : soon.slice(0, 1), rest = now.length ? soon : soon.slice(1);
  const nTrash = STATE.trash.filter(x => x.kind === 'trip' || x.kind === 'dest').length;
  const dests = Object.values(DESTS).filter(d => !d.ghost);
  const destRow = d => { const na = all.filter(t => t.archived && ((t.archived.snap || {}).dests || {})[d.id]).length, inMem = !used.has(d.id) && usedArch.has(d.id);
    const counts = [`${d.places.length} מקומות`, `${(d.meta.layers || []).length} שכבות`, inMem ? 'רק בזיכרונות' : ''].filter(Boolean).join(SEP);
    return `<div class="ent-dest"><span class="ent-flag">${destFlagMeta(d.meta) || msi('public')}</span><span class="ent-rt"><b>${_qe(d.meta.name)}</b>${d.meta.description ? `<small class="t-ell">${_qe(d.meta.description)}</small>` : ''}<small>${counts}</small></span>
      <button type="button" class="top-ic" data-act="trips.senddest" data-senddest="${d.id}" aria-label="שיתוף" title="שיתוף">${msi('share')}</button>${d.builtin ? '' : `<button type="button" class="top-ic" data-act="trips.editdest" data-editdest="${d.id}" aria-label="עריכה" title="עריכה">${msi('edit')}</button>`}${!d.builtin && !used.has(d.id) ? `<button type="button" class="top-ic ent-del" data-act="trips.deldest" data-deldest="${d.id}" data-arch="${na}" aria-label="מחיקה" title="מחיקה">${msi('delete')}</button>` : ''}</div>`; };
  document.getElementById('main').innerHTML = `<div class="ent-hero"><div class="ent-hero-t"><h2 class="display">${APP.appTitle}</h2><p>כל הטיולים שלכם במקום אחד</p></div>${logoHTML('m')}</div>
    <div class="ent-tiles" role="group" aria-label="חדש"><button type="button" class="ent-tile" id="newTripBtn" data-act="trips.newTripBtn">${msi('add_location_alt', { size: 22 })}<span>טיול חדש</span></button><span class="ent-tile ent-cl brow"><button type="button" class="ent-tile-b" id="buildBtn" data-act="claude.build">${claudeMark({ size: 22 })}<span>לבנות עם ${AI}</span></button>${tipI('claude.build')}</span></div>
    <div class="ent-links">${importDoorHTML('import', msi('upload_file', { size: 18 }) + 'ייבוא קובץ', msi('content_paste', { size: 18 }) + 'הדבקת תוכן')}</div>
    ${noActive ? `<p class="ent-note">${msi('info', { size: 18 })}<span><b>אין טיול פתוח.</b> פותחים טיול כדי לראות מקומות, מפה ותכנון.</span></p>` : ''}
    ${all.length ? '' : `<div class="empty ent-empty">${msi('luggage')}<div class="empty-t">עוד אין טיולים</div><div class="empty-l"><b>יעד</b> = המקומות והמידע, נכון בכל ביקור.</div><div class="empty-l"><b>טיול</b> = ביקור אחד עם תאריכים ותוכנית.</div></div>`}
    ${now.length ? entHead('flight_takeoff', 'עכשיו בטיול') : big.length ? entHead('flight', 'הטיול הבא') : ''}${big.map(tripCardHTML).join('')}
    ${ended.length ? entHead('flag', ('הסתיים' + SEP + 'מחכה לסגירה'), ended.length, tipI('trips.ended')) + ended.map(tripCardHTML).join('') : ''}
    ${rest.length ? entHead('event_upcoming', 'בקרוב', rest.length) + rest.map(tripRowHTML).join('') : ''}
    ${planning.length ? entHead('edit_calendar', 'בתכנון', planning.length) + planning.map(tripRowHTML).join('') : ''}
    ${arch.length ? entHead('photo_album', 'זיכרונות', arch.length) + tripMemsHTML(arch, true) : ''}
    <div class="accordion ent-acc">${accHTML('tr-dests', `${msi('public', { size: 22 })}יעדים בטלפון${SEP}${dests.length} ${tipI('trips.dests', true)}`, `<div class="card ent-dests">${dests.map(destRow).join('')}<div class="ent-dend"><button type="button" class="btn-outline" id="newDestBtn" data-act="trips.newDestBtn">${msi('add', { size: 18 })}יעד חדש</button></div></div>`, !all.length)}</div>
    ${nTrash ? `<button type="button" class="ent-trash t-wrap" id="tripsTrash" data-act="trips.tripsTrash">${msi('delete', { size: 22 })}<span class="ent-rt"><b>סל המחזור</b><small>${nTrash === 1 ? 'אחד שנמחק' : nTrash + ' שנמחקו'}${SEP}30 יום</small></span>${msi('chevron_right', { cls: 'ent-go' })}</button>` : ''}`;
  ctl.newTripBtn = () => { if (!Object.keys(DESTS).filter(k => !DESTS[k].ghost).length) { showToast('קודם צריך יעד: ייבוא מקובץ, "לבנות עם ' + AI + '" או "＋ יעד חדש"'); return; } openTripEditor(null); };
  ctl.newDestBtn = () => openNewDestChoice();
  ctl.editdest = b => openDestEditor(b.dataset.editdest);
  ctl.tc = (b, c) => b.dataset.tc === 'more' ? openTripActions(c.ref.id) : runTripAction(c.ref.id, b.dataset.tc); // 7.2.0 (פ3): the trip is on its card
  ctl.senddest = b => openDestFile(b.dataset.senddest); // 8.0.0 (ק12): the destination's own share window
  ctl.tripsTrash = () => { goTab('trash'); };
  ctl.memAll = () => { goTab('memories'); }; // 11.24.0 (memories-grid)
  ctl.deldest = b => {
    // 4.37.2: one tap deletes, with a long undo. A destination that past trips still show asks once, in the button itself, and the toast says what stays.
    const na = Number(b.dataset.arch || 0);
    const id = b.dataset.deldest, del = () => { deleteDestToTrash(id); }; // 4.37.3: to the trash for 30 days, like trips and places
    if (na) return askSure({ ic: 'delete', title: `למחוק את ${_qe(destName(id))}?`, text: `${na === 1 ? 'טיול אחד בזיכרונות ישמור' : na + ' טיולים בזיכרונות ישמרו'} את מה שהיה בו מהיעד. היעד עובר לסל ל-30 יום.`, ok: 'מחיקה' }, del); // 10.13.0 (gap 47): in the dialog
    del();
  };
}
ctlActs('trips', ['newDestBtn', 'newTripBtn', 'tripsTrash', 'memAll', 'editdest', 'tc', 'senddest', 'deldest']);
// "＋ יעד חדש" (look.md): a short choice - empty, filled by hand, or built with Claude
function openNewDestChoice() { const ctl = {}; layerNote(openNewDestChoice, arguments);
  const sheet = document.getElementById('sheet');
  sheet.innerHTML = `${fmHead('＋ יעד חדש', 'ndClose')}${taListHTML({ act: 'newDest.nd' }, [['empty', msi('edit_note') + ' ריק, ממלאים לבד', ('שם, תיאור ומרכז למפה' + SEP + 'המקומות נוספים אחר כך')], ['claude', claudeMark() + ' לבנות עם ' + AI + '', 'ה-' + AI + ' בונה יעד עם מקומות, והוא נפתח כאן כטיוטה']])}`;
  ctl.nd = b => { closeSheet(); if (b.dataset.nd === 'claude') openBuildWin(); else openDestEditor(null); };
  showSheetBackdrop('openNewDestChoice'); layerTop().ctl = ctl;
}
ctlActs('newDest', ['nd']);
// ⋯ on a trip: every action in one list
function openTripActions(id) { const ctl = {}; layerNote(openTripActions, arguments);
  const t = STATE.trips[id]; if (!t) return; const st = tripState(t), sheet = document.getElementById('sheet');
  const acts = [];
  // 10.9.0 (design-forms, gap 43): what was in parentheses is the row's supporting line
  if (st === 'archived') acts.push(['memory', '🖼️ מסך הזיכרון'], ['view', '📖 עיון מלא', 'לקריאה בלבד'], ['reopen', '↩️ פתיחה מחדש']);
  if (st === 'archived' && !tlCancelled(t)) acts.push(['timeline', `${msi('timeline', { size: 20 })} ${tlOf(id) ? 'ייבוא מחדש מציר הזמן' : 'ייבוא מציר הזמן של גוגל'}`, tlOf(id) ? `יובאו ${tlOf(id).n} ימים` : t.start ? 'המסלול האמיתי ואיפה ' + TX.visited : 'צריך תאריכים לטיול']); // 11.9.0 (timeline-import, Q2); 11.10.0 (C8): also a trip without dates
  else { acts.push(id !== STATE.activeTrip ? ['open', 'פתיחה'] : ['plan', 'לתכנון']); // 10.3.0: first and filled - a compact card's tap lands here (the owner)
    acts.push(['edit', '✏️ עריכה'], st === 'before' ? (t.start ? ['close', '🗄️ סגירה', 'הטיול בוטל?'] : ['close', '🗄️ סגירה', 'הטיול התקיים?']) : st === 'during' ? ['close', '🗄️ סגירה', 'חזרתם מוקדם?'] : ['close', '🗄️ סגירת הטיול']); }
  if (st !== 'archived') acts.push(['layers', '🎨 שכבות']); // 5.14.0 (ד1): out of the chip row
  if (st !== 'archived' && MAP_AVAILABLE) acts.push(['offmap', '📥 מפות לשימוש בלי רשת']); // 4.39.0
  acts.push(['share', '📤 שיתוף'], ['clone', '⧉ טיול חדש על בסיסו']); // 5.15.0 (ק5): one share for the trip
  acts.push(['delete', SY.del + ' מחיקה', 'לסל, 30 יום']);
  sheet.innerHTML = `${fmHead(nameB(t.name), 'taClose')}<p class="sh-hint">${tripStateLine(t)}</p>
    ${taListHTML({ act: 'tripActs.ta' }, acts.map(([k, l, sub], i) => [k, l, k === 'open' ? 'הטיול הזה יהיה הפתוח בכל המסכים' : sub || null, k === 'delete' ? 'ta-del' : i === 0 && (k === 'open' || k === 'plan') ? 'ta-main' : '']))}`;
  
  ctl.ta = b => {
    const k = b.dataset.ta;
    if (k === 'delete') return askSure({ ic: 'delete', title: `למחוק את ${_qe(String(t.name).split(' · ')[0])}?`, text: 'הטיול עובר לסל, ואפשר לשחזר אותו 30 יום.', ok: 'מחיקה' }, () => { closeSheet(); deleteTripToTrash(id); }); // 10.13.0 (gap 47): in the dialog
    closeSheet(); runTripAction(id, k);
  };
  showSheetBackdrop('openTripActions'); layerTop().ctl = ctl;
 
}
ctlActs('tripActs', ['ta']);
// 5.15.0 (ק5 in cl-unify-decisions-3): one "📤 שיתוף" for a trip - a short window with the three choices; each opens its own
// window on top (8.0.0, cl-files-impl-plan stage 3). The trip summary only for a trip that ended.
function openShareChoice(id) { const ctl = {}; layerNote(openShareChoice, arguments);
  const t = STATE.trips[id]; if (!t) return; const st = tripState(t), sheet = document.getElementById('sheet');
  const ch = [['file', '📄 קובץ הטיול', 'לחבר, לשיפור עם ' + AI + ' או לטלפון אחר שלכם']].concat(typeof openRecommend === 'function' ? [['rec', '💌 המלצות לחברים', 'הודעה או דף עם מפה']] : [], (st === 'archived' || st === 'ended') && typeof sendTripSummary === 'function' ? [['sum', '📖 סיכום הטיול', 'קובץ למזכרת']] : []);
  sheet.innerHTML = `${fmHead(`📤 שיתוף${SEP}${_qe(String(t.name).split(' · ')[0])}`, 'shcClose')}
    ${taListHTML({ act: 'shareChoice.shc' }, ch)}`;
  
  ctl.shc = b => { const k = b.dataset.shc;
    if (k === 'rec') openRecommend(id); else if (k === 'sum') openSummaryWin(id); else openTripFile(id); }; // 8.0.0 (ק5, ק11): each on top, ✕ returns to the choice
  showSheetBackdrop('openShareChoice'); layerTop().ctl = ctl;
}
ctlActs('shareChoice', ['shc']);
function runTripAction(id, k) {
  if (!STATE.trips[id]) return;
  if (k === 'timeline') openTlImport(id); // 11.9.0
  else if (k === 'memory') { memoryTrip = id; goTab('memory'); } else if (k === 'view') enterArchiveView(id); else if (k === 'reopen') reopenTrip(id);
  else if (k === 'open') switchTrip(id); else if (k === 'edit') openTripEditor(id); else if (k === 'close') closeTripStart(id);
  else if (k === 'plan') { if (id !== STATE.activeTrip) switchTrip(id); goTab('itinerary'); } // 4.48.0: was 'plan', which no screen answers
  else if (k === 'send') openTripFile(id); // 8.0.0 (ק6): a window, no jump to the trips screen
  else if (k === 'offmap') setTimeout(() => openOffMaps(id), 60);
  else if (k === 'layers') { if (id !== STATE.activeTrip) switchTrip(id); setTimeout(() => openLayersSheet(), 60); }
  else if (k === 'share') openShareChoice(id);
  else if (k === 'clone') openTripEditor(null, { base: id }); else if (k === 'recommend' && typeof openRecommend === 'function') openRecommend(id);
}
function deleteTripToTrash(id) {
  const t = STATE.trips[id], td = STATE.tripData[id], wasActive = STATE.activeTrip === id; if (!t) return;
  stashActive(); const entry = { id: newTrashId(), kind: 'trip', at: Date.now(), entry: { data: { name: t.name } }, trip: JSON.parse(JSON.stringify(t)), tripData: JSON.parse(JSON.stringify(td || {})) };
  delete STATE.trips[id]; delete STATE.tripData[id]; STATE.trash.push(entry);
  if (wasActive) setActiveTripQuiet(pickRelevantTrip(id));
  persist(); // undo-history Q6: the toast is the one row
  showUndoToast(SY.del + ' נמחק טיול (בסל 30 יום): ' + t.name);
}
// ---- closing: what it means depends on the state ----
function closeTripStart(id) { const ctl = {}; layerNote(closeTripStart, arguments);
  const t = STATE.trips[id]; if (!t || t.archived) return; const st = tripState(t), sheet = document.getElementById('sheet'); // 11.37.0 (P2, G84): no closing door on a memory
  if (st === 'ended' || (DEV.clSteps || {})[id]) { if (typeof openClosingFlow === 'function') openClosingFlow(id); else archiveTrip(id, 'ended'); return; } // 11.34.0 (P5, G73; Q2 A): a closing already begun reopens at its step
  const iso = todayStr(), yest = isoAdd(iso, -1);
  let body = '';
  if (!t.start) body = `<p><b>הטיול התקיים?</b> אם כן, בוחרים את התאריכים שלו וממשיכים לסגירה הרגילה. אם לא, הוא עובר לזיכרונות עם התווית "בוטל", בלי תהליך סגירה ובלי מזכרת.</p><div class="brow export-actions"><button class="btn-nav" data-act="closeStart.cl" data-cl="happened">${msi('edit_calendar', { size: 18 })} כן, לבחור תאריכים</button><button class="icon-btn btn-copy" data-act="closeStart.cl" data-cl="cancel" style="width:auto;padding:0 12px;">לא, הטיול בוטל</button></div>`; // B1 (decisions 2026-11-13 review of 11.10.0)
  else if (st === 'before') body = `<p><b>הטיול בוטל?</b> הוא יעבור לזיכרונות עם התווית "בוטל", בלי תהליך סגירה ובלי מזכרת. אפשר להחזיר אותו בכל זמן ("פתיחה מחדש").</p><p class="sh-hint">הטיול נדחה? עדיף לערוך ולשנות תאריכים.</p><div class="brow export-actions"><button class="btn-nav" data-act="closeStart.cl" data-cl="cancel">כן, הטיול בוטל</button><button class="icon-btn btn-copy" data-act="closeStart.cl" data-cl="edit" style="width:auto;padding:0 12px;">${msi('edit_calendar', { size: 18 })} לשנות תאריכים</button></div>`;
  else body = `<p><b>חזרתם מוקדם?</b> הטיול מתוכנן עד ${tmFmt('date', t.end)}. אפשר לקצר אותו עד היום האחרון שבו הייתם, ואז לסגור.</p>
    <div class="brow tight sh-days">${[yest >= t.start ? [yest, 'אתמול'] : null, [iso, 'היום']].filter(Boolean).map(([d, l]) => `<button type="button" data-act="closeStart.clend" data-clend="${d}" aria-pressed="${d === iso}">${l}${SEP}${tmFmt('dayN', d)}</button>`).join('')}</div>
    <label class="sh-field">או יום אחר${fmDateInput({ id: 'clEnd', min: t.start, max: t.end, value: iso })}</label>
    <div class="brow export-actions"><button class="btn-nav" data-act="closeStart.cl" data-cl="short">${msi('sports_score', { size: 18 })} לקצר עד היום הזה ולסגור</button><button class="icon-btn btn-copy" data-act="closeStart.cl" data-cl="x" style="width:auto;padding:0 12px;">לא, ממשיכים בטיול</button></div>`;
  sheet.innerHTML = `${fmHead(`🗄️ סגירת ${nameB(t.name)}`, 'clClose')}${body}`;
  
  ctl.clend = b => { sheet.querySelector('#clEnd').value = b.dataset.clend; sheet.querySelectorAll('[data-clend]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); };
  ctl.cl = b => {
    const k = b.dataset.cl;
    if (k === 'x') { closeSheet(); return; }
    if (k === 'edit') { closeSheet(); openTripEditor(id); return; }
    if (k === 'cancel') { archiveTrip(id, 'cancelled'); return; }
    if (k === 'happened') { closeSheet(); openTlDates(id, true); return; } // B1: the dates window, then the regular closing flow
    if (k === 'short') { const e = sheet.querySelector('#clEnd').value; if (!e || e < t.start) { showToast('בוחרים יום בתוך הטיול'); return; }
      t.end = e; (t.segments || []).forEach(s => { if (s.to > e) s.to = e; if (s.from > e) s.from = e; });
      persist(); closeSheet(); if (STATE.activeTrip === id) { applyActiveTrip(); updateHeader(); }
      // undo-history Q6: the shortening is one row (its toast) in both cases - before the closing flow opens, so it is not
      // folded into the flow's first mark
      const msg = `הטיול קוצר עד ${tmFmt('date', e)}: ${t.name}`;
      // 11.34.0 (P5, G73; Q2 B): today - the trip's last day - closes at once too (that evening), as the dates path does
      if (e <= todayStr()) { showUndoToast(msg); if (typeof openClosingFlow === 'function') openClosingFlow(id, e === todayStr()); else archiveTrip(id, 'ended'); }
      else showUndoToast(msg); }
  };
  showSheetBackdrop('closeTripStart'); layerTop().ctl = ctl;
 
}
ctlActs('closeStart', ['cl', 'clend']);

// ---- the memory screen ----
// one projection for every picture of a trip (memory map, memento, recommendations page): equirectangular with cos(lat)
function snapCoord(p) { return p.coord || p.manualCoord || (p.address && GEOCODE_CACHE[p.address]) || null; }
function tripMemoryData(id) {
  const t = STATE.trips[id]; if (!t) return null; if (id === STATE.activeTrip) stashActive();
  const snap = (t.archived && t.archived.snap) || null, td = STATE.tripData[id] || {};
  const places = snap ? snap.places : withTrip(id, () => POINTS.filter(q => touchedIds(td, t).has(q.id)).map(snapPlace));
  const pmap = new Map(places.map(p => [p.id, p]));
  const visited = (td.visited || []).map(i => pmap.get(i)).filter(Boolean);
  const stops = (t.lodging || []).slice().sort((a, b) => String(a.checkIn).localeCompare(String(b.checkIn))).map(l => ({ l, p: pmap.get(l.placeId) })).filter(x => x.p && snapCoord(x.p));
  return { t, snap, td, places, pmap, visited, stops, dests: snap ? Object.keys(snap.dests || {}) : tripDests(t), layers: snap ? snap.layers : LAYER_DEFS };
}
function memoryMapSVG(M, w, h) { // 4.36.0: the static version (inside Claude, where there are no live maps): rating colours, main-cluster frame, arrows
  const I = memItems(M, false), all = I.places.concat(I.hotels); if (!all.length) return '';
  const D = mementoData(M.t.id), kind = memKind(D), fr = memFrame(I.places.length ? I.places : all, kind), core = fr.core.concat(kind === 'city' ? I.hotels.filter(h => fr.core.some(x => distanceKm(x.c, h.c) < 60)) : I.hotels);
  const g = mercFit((core.length ? core : all).map(x => x.c), w, h, 26, 17), box = { x: 0, y: 0, w, h }, data = schemDataNow(M.t.id, kind, core.length ? core : all);
  let s = `<svg viewBox="0 0 ${w} ${h}" class="mem-map" style="direction:ltr" role="img" aria-label="מפה של המקומות ש${TX.visited} בהם"><defs><clipPath id="mmclip"><rect width="${w}" height="${h}" rx="14"/></clipPath></defs><g clip-path="url(#mmclip)"><rect width="${w}" height="${h}" class="mm-bg"/>`;
  if (data) s += schemSVG(data, g, box, (D && D.th) || {}, 11);
  if (I.hotels.length > 1) s += `<polyline points="${I.hotels.map(x => `${g.x(x.c.lng).toFixed(1)},${g.y(x.c.lat).toFixed(1)}`).join(' ')}" class="mm-route"/>`;
  I.places.forEach(x => { s += `<circle cx="${g.x(x.c.lng).toFixed(1)}" cy="${g.y(x.c.lat).toFixed(1)}" r="${x.hi || x.key || x.r === 'love' ? 6 : 4.2}" fill="${x.color}" class="mm-dot"/>`; });
  I.hotels.forEach(x => { s += `<text x="${g.x(x.c.lng).toFixed(1)}" y="${(g.y(x.c.lat) + 5).toFixed(1)}" class="mm-hotel" text-anchor="middle">&#x${MS_CP.hotel};</text>`; });
  I.places.filter(x => x.hi || x.key).slice(0, 8).forEach(x => { s += `<text x="${g.x(x.c.lng).toFixed(1)}" y="${(g.y(x.c.lat) - 9).toFixed(1)}" class="mm-label" text-anchor="middle">${_qe(x.name.slice(0, 22))}</text>`; });
  s += edgeArrowsSVG(g, box, fr.far, fr.center, '#1C2B33', 10);
  return s + '</g></svg>';
}
function planAsItWasHTML(M) {
  const days = dayList(M.t.start, M.t.end); if (!days.length) return '';
  const nameOf = id => { if (typeof id === 'string') { const f = (M.td.planItems || {})[id]; return f ? { ic: msi('sticky_note_2', { cls: 'msi-in' }), n: f.name } : ''; } const p = M.pmap.get(id); return p ? { ic: typeIcon(p.icon, { cls: 'msi-in' }), n: p.name } : ''; }; // 10.8.0: line icons
  const vis = new Set(M.td.visited || []);
  return days.map(d => { const it = (M.td.itinerary || {})[d.key] || {}, ids = ['morning', 'afternoon', 'evening', 'unassigned'].flatMap(k => it[k] || []);
    const sch = (M.t.schedule || []).filter(x => x.date === d.date).map(x => `<li class="mp-org">${x.start ? x.start + ' ' : ''}${_qe(x.title)}</li>`);
    const mine = ids.map(i => { const n = nameOf(i); if (!n) return ''; const tm = (M.td.times || {})[d.key + '|' + i]; return `<li${vis.has(i) ? ' class="mp-vis"' : ''}>${tm && tm.start ? tm.start + ' ' : ''}${msiTie(n.ic, _qe(n.n))}${vis.has(i) ? ' ✓' : ''}</li>`; }).filter(Boolean);
    if (!sch.length && !mine.length) return '';
    return `<div class="mp-day"><b>${tmFmt('day', d.date)}</b><ul>${sch.join('')}${mine.join('')}</ul></div>`; }).join('');
}
function renderMemoryScreen() { const ctl = ctlNS('memory');
  const id = memoryTrip, M = id && tripMemoryData(id), main = document.getElementById('main');
  if (!M) { main.innerHTML = '<div class="callout">הטיול לא נמצא.</div>'; return; }
  const t = M.t, th = (Object.values((M.snap && M.snap.dests) || {})[0] || {}).theme || ((DESTS[M.dests[0]] || {}).meta || {}).theme || {};
  const cancelled = t.archived && t.archived.reason === 'cancelled'; const live = !t.archived && ['during', 'before'].includes(tripState(t));
  // 10.3.0 (design-3, look.md "Full screens, part 2"): a cover hero (the trip's cover or a drawn landscape; "זיכרון · לקריאה בלבד"; the name,
  // dates · flags · who), three stat tiles, "עיון מלא" filled and "טיול על בסיסו" outlined; share and ⋯ sit in the screen's head
  const Dm = cancelled ? null : mementoData(id), flags = M.dests.map(d => destFlagMeta((M.snap && M.snap.dests && M.snap.dests[d]) || (DESTS[d] || {}).meta || {})).join('');
  const hero = `<div class="mem-hero" style="--mh:${th.primary || 'var(--primary)'};--ma:${th.accent || 'var(--favorite)'}">${tripCoverHTML(id)}<div class="mem-hero-in"><span class="mem-kicker">${cancelled ? msi('block', { size: 16 }) + 'בוטל' : t.archived ? msi('auto_stories', { size: 16 }) + 'זיכרון' + SEP + 'לקריאה בלבד' : (live ? '' : msi('auto_stories', { size: 16 })) + tripStateLine(t) /* built HTML, never escaped again: a trip in progress or upcoming brings its own line icon */}</span><h2 class="display"><span${tripNameAttr(t)}>${_qe(String(t.name).split(' · ')[0])}</span></h2>
    <div class="mem-sub">${[t.start ? tmFmt('range', [t.start, t.end], { year: true }) : '', flags, t.travelers ? _qe(t.travelers) : ''].filter(Boolean).join(SEP)}</div></div></div>`
    + (cancelled ? '' : `<div class="dr-tiles mem-tiles"><div class="dr-tile"><b>${t.start ? dayList(t.start, t.end).length : tripLen(t)}</b><small>ימים</small></div><div class="dr-tile"><b>${M.visited.length}</b><small>מקומות ש${TX.visited}</small></div><div class="dr-tile"><b>${Dm && Dm.walk ? fmtKm(Dm.walk, { num: true }) : '—'}</b><small>ק״מ ברגל</small></div></div>`);
  const acts = `<div class="mem-acts brow fill">${t.archived ? `<button class="btn-nav" id="memView" data-act="memory.memView">${msi('menu_book', { size: 18 })} עיון מלא</button>` : ''}<button class="btn-outline" id="memClone" data-act="memory.memClone">${msi('content_copy', { size: 18 })} טיול על בסיסו</button></div>`;
  { const e = screenTop(), tools = e && e.tab === 'memory' && e.el.querySelector('.screen-tools');
    if (tools) tools.innerHTML = `<button type="button" class="top-ic" id="memShare" data-act="memory.memShare" aria-label="שיתוף" title="שיתוף">${msi('share')}</button><button type="button" class="top-ic" id="memMore" data-act="memory.memMore" aria-label="עוד פעולות" title="עוד פעולות">${msi('more_vert')}</button>`; }
  let html = hero + acts; // 5.15.0 (ד6): no "🖼️ זיכרון" title - the colored card says it
  if (!cancelled) {
    if (typeof memorySection === 'function') html += memorySection(M, 'top');
    html += memMapBlockHTML(M); // 4.36.0: a live map
    if (typeof memorySection === 'function') html += memorySection(M, 'middle');
    const plan = planAsItWasHTML(M);
    if (plan) html += `<div class="accordion">${accHTML('mem-plan', msi('calendar_month', { size: 20 }) + ' התוכנית כפי שהייתה', `<div class="mem-plan">${plan}</div>`, false)}</div>`;
    if (typeof memorySection === 'function') html += memorySection(M, 'bottom');
  } else html += `<div class="callout">הטיול סומן כבוטל. התוכנית והסימונים שלו נשמרו, ו-${msi('undo', { cls: 'msi-in' })} פתיחה מחדש מחזירה אותו.</div>`;
  main.innerHTML = html;
  const g = q => document.getElementById(q);
  if (g('memView')) ctl.memView = () => enterArchiveView(id);
  ctl.memClone = () => openTripEditor(null, { base: id });
  ctl.memShare = () => openShareChoice(id);
  ctl.memMore = () => openTripActions(id);
  
  if (typeof memorySectionCtl === 'function') memorySectionCtl(M);
  if (!cancelled) initMemMap(M);
}
ctlActs('memory', ['memClone', 'memMore', 'memShare', 'memView']);
// ---- read-only guard: every function that changes a trip's data refuses while an archived trip is viewed ----
['toggleFavorite', 'toggleVisited', 'openPlaceEditor', 'openNewNoteSheet', 'openScheduleSheet', 'openOneSchedSheet', 'openTimeSheet', 'openNoteEditSheet', 'openBookingSheet', 'openTripItemEditor', 'openTravelEditor', 'openEndChoice', 'openAddPlaceSheet', 'toggleDay', 'dropPlanEntry', 'openSchedSheet', 'openLayerEditor', 'deleteAddedPlace', 'askDropTime'].forEach(n => {
  const f = window[n]; if (typeof f !== 'function') return;
  window[n] = function (...a) { if (ARCHIVE_VIEW) { roToast(); return; } return f.apply(this, a); };
});
// a trip that moved (postponed): its travels, lodging, organized schedule and bookings move with it by the same number of days
function shiftTripDates(t, dl) {
  if (!dl) return; const a = d => d ? isoAdd(d, dl) : d;
  (t.travels || []).forEach(x => { x.date = a(x.date); }); (t.lodging || []).forEach(x => { x.checkIn = a(x.checkIn); x.checkOut = a(x.checkOut); });
  (t.schedule || []).forEach(x => { x.date = a(x.date); });
  if (t.id === STATE.activeTrip) stashActive(); const td = STATE.tripData[t.id];
  if (td && td.bookings) Object.values(td.bookings).forEach(b => { if (b.date) b.date = a(b.date); });
  if (t.id === STATE.activeTrip) loadPersonal(t.id);
}

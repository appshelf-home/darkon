// ================= 4.28.0: TRIP MANAGEMENT - STATES, ARCHIVE, MEMORY SCREEN =================
// diet-groups (11.62.0): the memory screen, the memories' screen and closing's start moved to js/trip-memory.js (memories group)
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
  archiveViewEnd();
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
  // nav-short-page (G139): the layers above (the memory screen) close before the view starts - their close redraws the screen under them
  // when something was saved meanwhile, and a redraw of the trips screen (or a memory screen) ends an archive view: it ended this one at once
  if (!layerLeave(() => enterArchiveView(id))) return; closeAllSheets();
  archiveViewEnd();
  const snap = t.archived.snap || {}, ghosts = [];
  Object.entries(snap.dests || {}).forEach(([did, m]) => { if (DESTS[did]) return;
    const ls = (snap.layers || []).filter(l => l.dest === did).map(l => ({ ...l, id: l.id - (m.idBase || 0) }));
    DESTS[did] = { id: did, idBase: m.idBase || 0, meta: { name: m.name, description: m.description, center: m.center, theme: m.theme, currency: m.currency, country: m.country || '', timeZone: m.timeZone, regions: m.regions || [], layers: ls }, places: [], info: '<div class="accordion-item"><button class="accordion-header t-wrap" data-act="acc.toggle">' + msi('inventory_2', { cls: 'acc-ic' }) + '<span>היעד כבר לא בטלפון</span> <span class="accordion-arrow">' + msi('expand_more') + '</span></button><div class="accordion-body"><p>הטיול בזיכרונות שומר את המקומות שהיו בו, אבל לא את המידע הכללי של היעד.</p></div></div>', ghost: true };
    ghosts.push(did); });
  ARCHIVE_VIEW = { id, prev: STATE.activeTrip, ghosts };
  stashActive(); STATE.activeTrip = id; loadPersonal(id); applyActiveTrip(); updateHeader();
  document.body.classList.add('read-only'); goTab('info'); exitGuardSync(); // destination-view (Q4): back ends the view - its guard
}
function exitArchiveView(silent) {
  const v = ARCHIVE_VIEW; if (!v) return; ARCHIVE_VIEW = null;
  v.ghosts.forEach(did => { if (DESTS[did] && DESTS[did].ghost) delete DESTS[did]; });
  STATE.activeTrip = v.prev; loadPersonal(v.prev); applyActiveTrip(); updateHeader();
  document.body.classList.remove('read-only');
  // archive-redraw: the base still shows the view until it is drawn again - a screen over it (now, or the next one: the memory screen) draws it
  // on its close: the screens open now are marked (gen), an uncovered base carries data-stale for the next one (openScreen; render clears it)
  WIN_STACK.forEach(e => { if (e.tab) e.gen = -1; }); if (!screenTop()) document.getElementById('main').dataset.stale = '1';
  if (!silent) { memoryTrip = v.id; goTab('memory'); }
  exitGuardSync(); // destination-view (Q4): no view - the guard as the mode says
}
// archive-redraw (spec/closing.md "The archive view"): an archive view ends only by an explicit action - its own ✕ or "פתיחה מחדש", the trips
// screen or a memory screen chosen (goTab), another trip opened (switchTrip), a closing started, the view of another memory, the app's start.
// A draw never starts or ends it: it reads ARCHIVE_VIEW and draws by it
// destination-view (decisions 2026-11-26 · A destination's places without opening a trip, Q4): any view ends here - the archive view and the
// destination view are one view mechanism; viewOn() is what back and the bare page's guard read (layer-manager.js)
function archiveViewEnd() { if (ARCHIVE_VIEW) exitArchiveView(true); if (DEST_VIEW) exitDestView(true); }
function viewOn() { return !!(ARCHIVE_VIEW || DEST_VIEW); }
// back on a screen with no layer open, while a view is on: the view ends and returns where it started (the archive view: its memory screen;
// the destination view: the trips screen) - never the leave press
function viewBack() { if (ARCHIVE_VIEW) exitArchiveView(); else if (DEST_VIEW) exitDestView(); }
function archiveBarHTML() {
  if (!ARCHIVE_VIEW) return ''; const t = STATE.trips[ARCHIVE_VIEW.id];
  return `<div class="ro-bar">${msi('photo_album')}<span class="bn-t"><b>זיכרון${SEP}לקריאה בלבד</b>${SEP}${escH(t ? t.name : '')}</span><span class="ro-acts brow"><button type="button" class="ro-reopen" data-act="archive.reopen">פתיחה מחדש</button><button type="button" class="ro-x" data-act="archive.exit" aria-label="סגירת העיון" title="סגירת העיון">${msi('close')}</button></span></div>`; // 10.1.0 (design-1): a sticky violet strip
}
act('archive.reopen', () => reopenTrip(ARCHIVE_VIEW.id));
act('archive.exit', () => exitArchiveView());
act('draft.open', () => goTab('draft'));
function roToast() { showToast('הטיול בזיכרונות - לקריאה בלבד. "פתיחה מחדש" מאפשרת לשנות'); }
// ---- destination-view (decisions 2026-11-26 · A destination's places without opening a trip, Q1-Q6; spec/destination-view.md) ----
// "מקומות", "מפה" and "כללי" show one destination with no trip: activeTripObj() is a trip of that destination alone with no id, dates or
// marks (STATE.activeTrip null, the mirror empty), so everything that reads the active trip reads the destination; every edit of the
// destination works, the trip's marks (⭐ / ❤️, "היינו", the plan) are not offered. Like the archive view it starts and ends only by an explicit
// action (openDestView; its ✕, back, the trips screen, another trip or a memory's view - archiveViewEnd), a draw never starts or ends it and
// the app's start does not restore it (persist saves the trip that was open - item-model.js). stashActive writes nothing while it is on.
var DEST_VIEW = null; // { did, prev, trip }
function openDestView(did) {
  if (!DESTS[did] || DESTS[did].ghost) return;
  if (!layerLeave(() => openDestView(did))) return; closeAllSheets();
  archiveViewEnd();
  stashActive(); const prev = STATE.activeTrip;
  DEST_VIEW = { did, prev, trip: { ...NO_TRIP, name: '', segments: [{ dest: did }], destView: did } };
  STATE.activeTrip = null; hAbsorb([hKey(['s', 'activeTrip'])]); // undo: the view's own null is never a change of the open trip
  loadPersonal(null); applyActiveTrip(); FP.regions = new Set(); updateHeader(); infoSpotClear();
  document.body.classList.add('dest-view'); goTab('all'); exitGuardSync();
}
function exitDestView(silent) {
  const v = DEST_VIEW; if (!v) return; DEST_VIEW = null;
  STATE.activeTrip = STATE.trips[v.prev] && !STATE.trips[v.prev].archived ? v.prev : pickRelevantTrip(null);
  loadPersonal(STATE.activeTrip); hAbsorb([hKey(['s', 'activeTrip'])]); /* the trip's own mirror first: hAbsorb's hTake stashes it */ applyActiveTrip(); FP.regions = defaultRegions(); updateHeader(); infoSpotClear();
  document.body.classList.remove('dest-view');
  WIN_STACK.forEach(e => { if (e.tab) e.gen = -1; }); if (!screenTop()) document.getElementById('main').dataset.stale = '1'; // as the archive view: the base is drawn again
  if (!silent) goTab('trips');
  exitGuardSync();
}
function destViewBarHTML() {
  if (!DEST_VIEW) return ''; const d = DESTS[DEST_VIEW.did];
  return `<div class="ro-bar dv-bar">${msi('location_on')}<span class="bn-t"><b>יעד ${escH(d ? d.meta.name : '')}</b>${SEP}בלי טיול, בלי תאריכים</span><span class="ro-acts brow"><button type="button" class="ro-x" data-act="dview.exit" aria-label="סגירת היעד" title="סגירת היעד">${msi('close')}</button></span></div>`;
}
act('dview.exit', () => exitDestView());
function dvToast() { showToast('יעד בלי טיול: מועדפים, "היינו" ותוכנית שייכים לטיול'); }

// ---- the trips screen ----
// 10.3.0 (design-3, look.md "Full screens, part 1"): the trips screen is the app's entrance - a hero with the stamp, two start tiles, the trips,
// "זיכרונות" as a grid of covers, the destinations folded, the trash as the last row. With no trip it is the empty copy's opening (no welcome screen).
// trip-cards (decisions 2026-11-26 · The trips screen's cards, Q2-Q7): every trip not closed has one card in one list "הטיולים שלי" - only the label says its state
function tripChipHTML(t) { const st = tripState(t), iso = todayStr(); // the state's label on the cover - a tap on it never opens the trip (Q3: data-tc "label" does nothing); "מחכה לסגירה ›" is the one that is a button - it opens the closing (Q4)
  if (st === 'during') { const n = dayList(t.start, t.end), i = n.findIndex(d => d.date === iso); return `<span class="ent-chip now" data-act="trips.tc" data-tc="label">${msi('near_me', { size: 16 })}עכשיו${SEP}יום ${i + 1} מתוך ${n.length}</span>`; }
  if (st === 'ended') return `<button type="button" class="ent-chip end" data-act="trips.tc" data-tc="close">${msi('flag', { size: 16 })}מחכה לסגירה ›</button>`;
  if (st === 'before' && t.start) { const d = daysBetween(iso, t.start); return `<span class="ent-chip" data-act="trips.tc" data-tc="label">${msi('hourglass_top', { size: 16 })}${t.dateMode === 'est' ? '≈ ' : ''}${d === 1 ? 'מחר' : `בעוד ${d} ימים`}</span>`; }
  return `<span class="ent-chip" data-act="trips.tc" data-tc="label">${msi('edit_calendar', { size: 16 })}בלי תאריכים${tripLen(t) ? SEP + tripLen(t) + ' ימים' : ''}</span>`; }
const tripFlags = t => tripDests(t).map(destFlag).filter(Boolean).join('');
function tripDatesLine(t, o) { o = o || {}; const ds = tripDests(t).map(destName);
  return [t.start ? `${t.dateMode === 'est' ? '≈ ' : ''}${tmFmt('range', [t.start, t.end], { year: true })}` : (tripLen(t) ? tripLen(t) + '\u00a0ימים' : 'בלי תאריכים'), o.days && t.start ? `${dayList(t.start, t.end).length}\u00a0ימים` : '', o.short ? ds[0] + (ds.length > 1 ? ` +${ds.length - 1}` : '') : ds.join(SEP)].filter(Boolean).join(SEP); }
// 10.13.0 (design-screens, gaps 2-3, Q2): a trip's look is its current destination's (an archived trip: its snapshot's first) -
// the heading font on its name (the large card, the memory hero), and its color as the name's text on the large card (in dark a light tone)
function tripTheme(t) { const snap = t.archived && t.archived.snap && t.archived.snap.dests, id = t.archived ? tripDests(t)[0] : dayDestId(null, t);
  return (snap && ((snap[id] || Object.values(snap)[0]) || {}).theme) || ((DESTS[id] || {}).meta || {}).theme || {}; }
function headFont(font) { font = HEADING_FONTS.includes(font) ? font : 'Rubik'; // legal-server (11.41.0): every heading font has its @font-face from the site (generated/text-fonts.css) - the browser asks its file only when a trip shows it
  return `'${font}', ${font === 'Frank Ruhl Libre' ? 'Georgia, serif' : 'Rubik, sans-serif'}`; }
function tripNameAttr(t, color) { const th = tripTheme(t), c = color && /^#[0-9a-f]{6}$/i.test(th.primary || '') ? `--tn-c:${th.primary};` : '';
  return ` class="trip-name${c ? ' trip-name-c' : ''}" style="--tn-f:${headFont(th.headingFont).replace(/"/g, '&quot;')};${c}"`; }
function tripCardHTML(t) { // trip-cards (Q2, Q4, Q6): the one card - a cover with the label and the flags; the name ("פתוח" on the open trip), dates · destinations, and ✏️ 📤 ⋯ at the line's end; a tap anywhere else opens the trip (Q3)
  const st = tripState(t), act = t.id === STATE.activeTrip && !ARCHIVE_VIEW, nm = escH(String(t.name).split(' · ')[0]);
  return `<div class="card trip-card ent-card" data-ref="trip:${t.id}" data-tstate="${st}" data-act="trips.tc" data-tc="open"><div class="ent-cover">${tripCoverHTML(t.id)}${tripChipHTML(t)}<span class="ent-flags">${tripFlags(t)}</span></div>
    <div class="ent-body"><div class="ent-tx"><h3><span${tripNameAttr(t, true)}>${nm}</span>${act ? ' <span class="badge tc-open">פתוח</span>' : ''}</h3><div class="sub">${sepTie(escH(tripDatesLine(t, { days: true })))}</div></div><div class="ent-acts brow tight"><button type="button" class="top-ic" data-act="trips.tc" data-tc="edit" aria-label="עריכה" title="עריכה">${msi('edit')}</button><button type="button" class="top-ic" data-act="trips.tc" data-tc="share" aria-label="שיתוף" title="שיתוף">${msi('share')}</button><button type="button" class="top-ic tc-more" data-act="trips.tc" data-tc="more" aria-label="כל הפעולות" title="כל הפעולות">${msi('more_horiz')}</button></div></div></div>`;
}
function tripMemHTML(t) { // a past trip in "זיכרונות": a small cover card; a tap opens its memory screen, ⋯ in the cover's corner its other actions (trip-cards, Q7)
  const c = t.archived && t.archived.reason === 'cancelled';
  return `<div class="card trip-card ent-mem t-wrap" data-ref="trip:${t.id}" data-tstate="archived" data-act="trips.tc" data-tc="memory"><span class="ent-th">${tripCoverHTML(t.id)}<button type="button" class="ent-mmore" data-act="trips.tc" data-tc="more" aria-label="כל הפעולות" title="כל הפעולות">${msi('more_horiz', { size: 20 })}</button></span><b>${escH(String(t.name).split(' · ')[0])}</b><small>${c ? 'בוטל' : t.end ? escH(tmFmt('year', t.end)) : ''}</small></div>`;
}
// trip-cards (Q7, amended by decisions 2026-11-26 · A destination's places without opening a trip, Q6-Q8): a destination's row - its own places
// (not hidden or deleted) and the date of its last update or edit (the file's arrival `at`, or the latest of my edits of its places and layers)
function destAt(d) { const E = STATE.edits, ids = new Set(destPlaces(d).map(p => p.id)), lids = new Set(destLayers(d).map(l => l.id)); let at = d.at || 0;
  const mine = (o, has) => Object.entries(o || {}).forEach(([k, e]) => { if (e && e.at && has(Number(k), e)) at = Math.max(at, e.at); });
  mine(E.places, (k, e) => ids.has(k) || (e.op === 'add' && e.data && e.data.dest === d.id));
  mine(E.status, k => ids.has(k) || ((E.places[k] || {}).data || {}).dest === d.id);
  mine(E.layers, (k, e) => lids.has(k) || (e.op === 'add' && e.data && e.data.dest === d.id));
  return at; }
function destRowLine(d) { const hid = new Set(destLayersEff(d).filter(l => l.hidden).map(l => l.id)), n = destPlacesRead([d.id]).filter(p => !isGoneStatus(p.status) && !hid.has(p.layer)).length, at = destAt(d);
  return `${n === 1 ? 'מקום אחד' : n + ' מקומות'}${at ? SEP + 'עודכן ' + tmFmt('date', at) : ''}`; }
// 11.24.0 (small-ui-set C, memories-grid; decisions 2026-11-18 · "זיכרונות" on the trips screen: a grid that fills the row): a grid of
// 2 / 3 / 4 columns by the screen class (css .ent-mems --mc); the cards stretch so every row is full (a last row with fewer cards, or one
// memory, stretches too) and a cover keeps its ratio; on the trips screen (lim) at most two rows, newest first, the rest hidden by the class's
// count, and "כל הזיכרונות · N ›" opens them all in the same grid (the menu screen 'memories'); data-more: the smallest two-rows count N exceeds
function tripMemsHTML(arch, lim) { const n = arch.length, more = !lim ? 0 : n > 8 ? 8 : n > 6 ? 6 : n > 4 ? 4 : 0;
  return `<div class="ent-mems${lim ? ' lim' : ''}">${arch.map(tripMemHTML).join('')}</div>${more ? `<button type="button" class="ent-mall t-wrap" data-act="trips.memAll" data-more="${more}"><span>כל הזיכרונות${SEP}<bdi>${n}</bdi></span>${msi('chevron_right', { cls: 'ent-go' })}</button>` : ''}`; }
const tripsArchived = () => Object.values(STATE.trips).filter(t => tripState(t) === 'archived').sort((a, b) => String(b.end || '').localeCompare(String(a.end || '')));
const entGo = o => msi('chevron_right', { ...o, cls: 'ent-go' }); // a row's trailing arrow (countries-visited: its rows and line too; the day's height row, step-bar item 5, at size 20)
const entHead = (ic, title, n, x) => `<div class="ent-h">${msi(ic, { size: 22 })}<span>${title}</span>${n ? `<small>${n}</small>` : ''}${x || ''}</div>`;
function renderTripsScreen(noActive) { const ctl = ctlNS('trips');
  document.body.classList.add('on-entrance'); // archive-redraw: a draw reads the archive view, never ends it (goTab('trips') does)
  noActive = !!(noActive || (!hasTrip() && Object.keys(STATE.trips).length));
  const all = Object.values(STATE.trips), used = new Set([].concat(...all.filter(t => !t.archived).map(tripDests)));
  const usedArch = new Set([].concat(...all.filter(t => t.archived).map(t => Object.keys((t.archived.snap || {}).dests || {}))));
  const by = s => all.filter(t => tripState(t) === s);
  // trip-cards (Q6): one list in a fixed order by time - in progress, waiting to be closed, the next ones by start date, those with no dates last (newest first, 4.38.0)
  const mine = [].concat(by('during').sort((a, b) => String(a.start).localeCompare(String(b.start))), by('ended').sort((a, b) => String(b.end).localeCompare(String(a.end))),
    by('before').filter(t => t.start).sort((a, b) => String(a.start).localeCompare(String(b.start))), by('before').filter(t => !t.start).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
  const arch = tripsArchived();
  const nTrash = STATE.trash.filter(x => x.kind === 'trip' || x.kind === 'dest').length;
  const dests = Object.values(DESTS).filter(d => !d.ghost);
  const destRow = d => { const inMem = !used.has(d.id) && usedArch.has(d.id); // trip-cards (Q7): the flag, the name, "N מקומות · עודכן <date>", ⋯ on the trip cards' button line; a tap opens the destination's view
    return `<div class="ent-dest t-wrap" data-act="trips.dview" data-dv="${escH(d.id)}"><span class="ent-flag">${destFlagMeta(d.meta) || msi('public')}</span><span class="ent-rt"><b>${escH(d.meta.name)}</b><small>${destRowLine(d)}${inMem ? SEP + 'רק בזיכרונות' : ''}</small></span><button type="button" class="top-ic" data-act="trips.dmore" data-dmore="${escH(d.id)}" aria-label="${escH('כל הפעולות של ' + d.meta.name)}" title="כל הפעולות">${msi('more_horiz')}</button></div>`; };
  document.getElementById('main').innerHTML = `<div class="ent-hero"><div class="ent-hero-t"><h2 class="display">${APP.appTitle}</h2><p>כל הטיולים שלכם במקום אחד</p></div><button type="button" class="ent-stamp t-wrap" data-act="pp.hero" aria-label="הדרכון שלי">${logoHTML('m')}</button></div>
    ${kitCardHTML()}<div class="ent-tiles" role="group" aria-label="חדש"><button type="button" class="ent-tile" id="newTripBtn" data-act="trips.newTripBtn">${msi('add_location_alt', { size: 22 })}<span>טיול חדש</span></button><span class="ent-tile ent-cl brow"><button type="button" class="ent-tile-b" id="buildBtn" data-act="claude.build">${claudeMark({ size: 22 })}<span>לבנות עם ${AI}</span></button>${tipI('claude.build')}</span></div>
    <div class="ent-links">${importDoorHTML('import', msi('upload_file', { size: 18 }) + 'ייבוא קובץ', msi('content_paste', { size: 18 }) + 'הדבקת תוכן')}</div>
    ${noActive ? `<p class="ent-note">${msi('info', { size: 18 })}<span><b>אין טיול פתוח.</b> פותחים טיול כדי לראות מקומות, מפה ותכנון.</span></p>` : ''}
    ${all.length ? '' : `<div class="empty ent-empty">${msi('luggage')}<div class="empty-t">עוד אין טיולים</div><div class="empty-l"><b>יעד</b> = המקומות והמידע, נכון בכל ביקור.</div><div class="empty-l"><b>טיול</b> = ביקור אחד עם תאריכים ותוכנית.</div></div>`}
    ${mine.length ? entHead('luggage', 'הטיולים שלי', mine.length) + `<div class="ent-trips">${mine.map(tripCardHTML).join('')}</div>` : ''}
    ${arch.length || cvHasAny() ? entHead('photo_album', 'זיכרונות', arch.length, `<div class="ent-memline">${cvLineG() + (arch.length ? ppLineHTML(msi('chevron_right', { cls: 'ent-go' })) : '')}</div>`) + (arch.length ? tripMemsHTML(arch, true) : '') : ''}
    <div class="accordion ent-acc">${accHTML('tr-dests', `${msi('public', { size: 22 })}יעדים בטלפון${SEP}${dests.length} ${tipI('trips.dests', true)}`, `<div class="card ent-dests">${dests.map(destRow).join('')}<div class="ent-dend"><button type="button" class="btn-outline" id="newDestBtn" data-act="trips.newDestBtn">${msi('add', { size: 18 })}יעד חדש</button></div></div>`, !all.length)}</div>
    ${nTrash ? `<button type="button" class="ent-trash t-wrap" id="tripsTrash" data-act="trips.tripsTrash">${msi('delete', { size: 22 })}<span class="ent-rt"><b>סל המחזור</b><small>${nTrash === 1 ? 'אחד שנמחק' : nTrash + ' שנמחקו'}${SEP}30 יום</small></span>${msi('chevron_right', { cls: 'ent-go' })}</button>` : ''}`;
  ctl.newTripBtn = () => { if (!Object.keys(DESTS).filter(k => !DESTS[k].ghost).length) { showToast('קודם צריך יעד: ייבוא מקובץ, "לבנות עם ' + AI + '" או "＋ יעד חדש"'); return; } openTripEditor(null); };
  ctl.newDestBtn = () => openNewDestChoice();
  ctl.tc = (b, c) => b.dataset.tc === 'label' ? 'quiet' : b.dataset.tc === 'more' ? openTripActions(c.ref.id) : runTripAction(c.ref.id, b.dataset.tc); // 7.2.0 (פ3): the trip is on its card; trip-cards: the card's own tap is 'open'
  ctl.dview = b => openDestView(b.dataset.dv); // destination-view (Q6): a tap on the destination opens its view
  ctl.dmore = b => openDestActions(b.dataset.dmore); // trip-cards (Q7): the destination's ⋯
  ctl.tripsTrash = () => { goTab('trash'); };
  ctl.memAll = () => { goTab('memories'); }; // 11.24.0 (memories-grid)
}
ctlActs('trips', ['newDestBtn', 'newTripBtn', 'tripsTrash', 'memAll', 'tc', 'dview', 'dmore']);
// trip-cards (Q7; decisions 2026-11-26 · A destination's places without opening a trip, Q6): a destination's ⋯ - edit its general details,
// update with AI, share, delete (as before: not a destination built into the copy, nor one a trip not closed uses)
function openDestActions(did) { const ctl = {}; layerNote(openDestActions, arguments);
  const d = DESTS[did]; if (!d || d.ghost) return; const sheet = document.getElementById('sheet'), all = Object.values(STATE.trips);
  const used = all.some(t => !t.archived && tripDests(t).includes(did)), na = all.filter(t => t.archived && ((t.archived.snap || {}).dests || {})[did]).length;
  const acts = [];
  if (!d.builtin) acts.push(['edit', msi('edit', { size: 20 }) + ' עריכה', 'שם, תיאור, מדינה, מטבע ושעון']);
  acts.push(['ai', TX.claude.improve.dest.title, 'השלמה ותיקון של המקומות והמידע'], ['share', msi('share', { size: 20 }) + ' שיתוף', 'קובץ היעד לחבר או לטלפון אחר שלכם']);
  if (!d.builtin && !used) acts.push(['delete', msi('delete', { size: 20 }) + ' מחיקה', 'לסל, 30 יום']);
  sheet.innerHTML = `${fmHead(nameB(d.meta.name), 'daClose')}<p class="sh-hint">${destRowLine(d)}</p>
    ${taListHTML({ act: 'destActs.da' }, acts.map(([k, l, sub]) => [k, l, sub, k === 'delete' ? 'ta-del' : '']))}`;
  ctl.da = b => { const k = b.dataset.da;
    if (k === 'delete') { const del = () => { closeSheet(); deleteDestToTrash(did); }; // 4.37.2-4.37.3: to the trash for 30 days; a destination that past trips still show asks once (10.13.0, gap 47)
      if (na) return askSure({ ic: 'delete', title: `למחוק את ${escH(destName(did))}?`, text: `${na === 1 ? 'טיול אחד בזיכרונות ישמור' : na + ' טיולים בזיכרונות ישמרו'} את מה שהיה בו מהיעד. היעד עובר לסל ל-30 יום.`, ok: 'מחיקה' }, del);
      return del(); }
    closeSheet();
    if (k === 'edit') viaGroup('editors', 'openDestEditor', did); else if (k === 'ai') viaGroup('management', 'openDestFile', did, 'improve'); else if (k === 'share') viaGroup('management', 'openDestFile', did); // 8.0.0 (ק12): the destination's own share window
  };
  showSheetBackdrop('openDestActions'); layerTop().ctl = ctl;
}
ctlActs('destActs', ['da']);
// "＋ יעד חדש" (look.md): a short choice - empty, filled by hand, or built with Claude
function openNewDestChoice() { const ctl = {}; layerNote(openNewDestChoice, arguments);
  const sheet = document.getElementById('sheet');
  sheet.innerHTML = `${fmHead('＋ יעד חדש', 'ndClose')}${taListHTML({ act: 'newDest.nd' }, [['empty', msi('edit_note') + ' ריק, ממלאים לבד', ('שם, תיאור ומרכז למפה' + SEP + 'המקומות נוספים אחר כך')], ['claude', claudeMark() + ' לבנות עם ' + AI + '', 'ה-' + AI + ' בונה יעד עם מקומות, והוא נפתח כאן כטיוטה']])}`;
  ctl.nd = b => { closeSheet(); if (b.dataset.nd === 'claude') viaGroup('ai', 'openBuildWin'); else viaGroup('editors', 'openDestEditor', null); };
  showSheetBackdrop('openNewDestChoice'); layerTop().ctl = ctl;
}
ctlActs('newDest', ['nd']);
// ⋯ on a trip: every action in one list
function openTripActions(id) { const ctl = {}; layerNote(openTripActions, arguments);
  const t = STATE.trips[id]; if (!t) return; const st = tripState(t), sheet = document.getElementById('sheet');
  const acts = [];
  // 10.9.0 (design-forms, gap 43): what was in parentheses is the row's supporting line
  // trip-cards (Q4, Q7): a trip not closed - the closing, layers, offline maps, a new trip on its base, delete (the card's tap opens it; ✏️ and 📤 are on the card);
  // a memory - "עיון מלא", reopening, the Timeline, share, a new trip on its base, delete (its tap opens the memory screen). One list for the card and the memory screen's ⋯
  if (st === 'archived') { acts.push(['view', '📖 עיון מלא', 'לקריאה בלבד'], ['reopen', '↩️ פתיחה מחדש']);
    if (!tlCancelled(t)) acts.push(['timeline', `${msi('timeline', { size: 20 })} ${tlOf(id) ? 'ייבוא מחדש מציר הזמן' : 'ייבוא מציר הזמן של גוגל'}`, tlOf(id) ? `יובאו ${tlOf(id).n} ימים` : t.start ? 'המסלול האמיתי ואיפה ' + TX.visited : 'צריך תאריכים לטיול']); // 11.9.0 (timeline-import, Q2); 11.10.0 (C8): also a trip without dates
    acts.push(['share', '📤 שיתוף']); }
  else { acts.push(st === 'before' ? (t.start ? ['close', '🗄️ סגירה', 'הטיול בוטל?'] : ['close', '🗄️ סגירה', 'הטיול התקיים?']) : st === 'during' ? ['close', '🗄️ סגירה', 'חזרתם מוקדם?'] : ['close', '🗄️ סגירת הטיול']);
    acts.push(['layers', '🎨 שכבות']); // 5.14.0 (ד1): out of the chip row
    if (MAP_AVAILABLE) acts.push(['offmap', '📥 מפות לשימוש בלי רשת']); } // 4.39.0
  acts.push(['clone', '⧉ טיול חדש על בסיסו'], ['delete', SY.del + ' מחיקה', 'לסל, 30 יום']);
  sheet.innerHTML = `${fmHead(nameB(t.name), 'taClose')}<p class="sh-hint">${tripStateLine(t)}</p>
    ${taListHTML({ act: 'tripActs.ta' }, acts.map(([k, l, sub]) => [k, l, sub || null, k === 'delete' ? 'ta-del' : '']))}`;
  
  ctl.ta = b => {
    const k = b.dataset.ta;
    if (k === 'delete') return askSure({ ic: 'delete', title: `למחוק את ${escH(String(t.name).split(' · ')[0])}?`, text: 'הטיול עובר לסל, ואפשר לשחזר אותו 30 יום.', ok: 'מחיקה' }, () => { closeSheet(); deleteTripToTrash(id); }); // 10.13.0 (gap 47): in the dialog
    closeSheet(); runTripAction(id, k);
  };
  showSheetBackdrop('openTripActions'); layerTop().ctl = ctl;
 
}
ctlActs('tripActs', ['ta']);
// 5.15.0 (ק5 in cl-unify-decisions-3): one "📤 שיתוף" for a trip - a short window with the three choices; each opens its own
// window on top (8.0.0, cl-files-impl-plan stage 3). The trip summary only for a trip that ended.
function openShareChoice(id) { const ctl = {}; layerNote(openShareChoice, arguments);
  const t = STATE.trips[id]; if (!t) return; const st = tripState(t), sheet = document.getElementById('sheet');
  const ch = [['file', '📄 קובץ הטיול', 'לחבר, ' + TX.claude.improve.toName + ' או לטלפון אחר שלכם']].concat([['rec', '💌 המלצות לחברים', 'הודעה או דף עם מפה']], (st === 'archived' || st === 'ended') ? [ /* diet-groups: both are in the memories group, always in the app */ ['sum', '📖 סיכום הטיול', 'קובץ למזכרת']] : []);
  sheet.innerHTML = `${fmHead(`📤 שיתוף${SEP}${escH(String(t.name).split(' · ')[0])}`, 'shcClose')}
    ${taListHTML({ act: 'shareChoice.shc' }, ch)}`;
  
  ctl.shc = b => { const k = b.dataset.shc;
    if (k === 'rec') groupWait('memories', () => viaGroup('pages', 'openRecommend', id)); else if (k === 'sum') groupWait('memories', () => viaGroup('pages', 'openSummaryWin', id)); else viaGroup('management', 'openTripFile', id); }; // 8.0.0 (ק5, ק11): each on top, ✕ returns to the choice
  showSheetBackdrop('openShareChoice'); layerTop().ctl = ctl;
}
ctlActs('shareChoice', ['shc']);
function runTripAction(id, k) {
  if (!STATE.trips[id]) return;
  if (k === 'timeline') viaGroup('memories', 'openTlImport', id); // 11.9.0
  else if (k === 'memory') { memoryTrip = id; goTab('memory'); } else if (k === 'view') enterArchiveView(id); else if (k === 'reopen') reopenTrip(id);
  else if (k === 'open') switchTrip(id, false, tripLanding); /* trip-cards (Q3, Q5): it becomes the open trip and lands by the opening screen's rule */ else if (k === 'edit') openTripEditor(id); else if (k === 'close') viaGroup('memories', 'closeTripStart', id);
  else if (k === 'plan') { if (id !== STATE.activeTrip) switchTrip(id); goTab('itinerary'); } // 4.48.0: was 'plan', which no screen answers
  else if (k === 'send') viaGroup('management', 'openTripFile', id); // 8.0.0 (ק6): a window, no jump to the trips screen
  else if (k === 'offmap') setTimeout(() => viaGroup('special-maps', 'openOffMaps', id), 60);
  else if (k === 'layers') { if (id !== STATE.activeTrip) switchTrip(id); setTimeout(() => viaGroup('editors', 'openLayersSheet'), 60); }
  else if (k === 'share') openShareChoice(id);
  else if (k === 'clone') openTripEditor(null, { base: id }); else if (k === 'recommend') groupWait('memories', () => viaGroup('pages', 'openRecommend', id));
}
function deleteTripToTrash(id) {
  const t = STATE.trips[id], td = STATE.tripData[id], wasActive = STATE.activeTrip === id; if (!t) return;
  stashActive(); const entry = { id: newTrashId(), kind: 'trip', at: Date.now(), entry: { data: { name: t.name } }, trip: JSON.parse(JSON.stringify(t)), tripData: JSON.parse(JSON.stringify(td || {})) };
  delete STATE.trips[id]; delete STATE.tripData[id]; STATE.trash.push(entry);
  if (wasActive) setActiveTripQuiet(pickRelevantTrip(id));
  persist(); // undo-history Q6: the toast is the one row
  showUndoToast(SY.del + ' נמחק טיול (בסל 30 יום): ' + t.name);
}
// ---- read-only guard: every function that changes a trip's data refuses while an archived trip is viewed ----
// diet-groups: a function of a group is wrapped when its group comes in (groupOnIn) - once (ro marks a wrapped one)
const RO_GUARD = ['toggleFavorite', 'toggleVisited', 'openPlaceEditor', 'openNewNoteSheet', 'openScheduleSheet', 'openOneSchedSheet', 'openTimeSheet', 'openNoteEditSheet', 'openBookingSheet', 'openTripItemEditor', 'openTravelEditor', 'openEndChoice', 'openAddPlaceSheet', 'toggleDay', 'dropPlanEntry', 'openSchedSheet', 'openLayerEditor', 'deleteAddedPlace', 'askDropTime'];
const DV_EDITS = ['openPlaceEditor', 'openLayerEditor', 'deleteAddedPlace']; // destination-view (Q2): the destination's own edits - the rest are a trip's
function roGuard() { RO_GUARD.forEach(n => {
  const f = window[n]; if (typeof f !== 'function' || f.ro) return;
  const w = window[n] = function (...a) { if (ARCHIVE_VIEW) { roToast(); return; } if (DEST_VIEW && !DV_EDITS.includes(n)) { dvToast(); return; } return f.apply(this, a); }; w.ro = true;
}); }
roGuard(); groupOnIn(roGuard);
// a trip that moved (postponed): its travels, lodging, organized schedule and bookings move with it by the same number of days
function shiftTripDates(t, dl) {
  if (!dl) return; const a = d => d ? isoAdd(d, dl) : d;
  (t.travels || []).forEach(x => { x.date = a(x.date); }); (t.lodging || []).forEach(x => { x.checkIn = a(x.checkIn); x.checkOut = a(x.checkOut); });
  (t.schedule || []).forEach(x => { x.date = a(x.date); });
  if (t.id === STATE.activeTrip) stashActive(); const td = STATE.tripData[t.id];
  if (td && td.bookings) Object.values(td.bookings).forEach(b => { if (b.date) b.date = a(b.date); });
  if (t.id === STATE.activeTrip) loadPersonal(t.id);
}

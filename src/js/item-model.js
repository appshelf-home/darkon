// ================= 5.0.0: ONE ITEM MODEL (stage 1 of the cards unification, cl-cards-impl-plan) =================
// Every plan entry, organized line, travel and hotel resolves to one item of three kinds, over the separate sources
// (destination/trip places, my notes, the organized schedule, travels, lodging - never merged, so "📝 עודכן במקור" and
// "↺ חזרה למקור" keep working):
//   place  - has a place (a POINT): my place, a trip place, a hotel, an organized line at a place
//   note   - text only, no place: my note, an organized line without a place
//   travel - a flight, bus, train, ferry or drive of the trip
// ref: a plan id (number = place, 'f_…' = note / copy of a place / travel in the plan), 's:<id>' (organized line),
// 'tv:<id>' (a travel by its id), 'l:<id>' (a hotel by its lodging id).
// Data rules of the model: a note with an address is a place of the trip (noteToPlace); a hotel is a place of the trip only
// (hotelsToTrip) - one copy per trip that sleeps there, the destination's place hidden (status "moved", reversible).
// name-lead (decisions 2026-11-26 · Which of a place's two names leads): a place shows one name per line - `name` or `foreign`, by
// my swap for this place (leadMine) -> the setting "שם המקומות" -> in automatic, the AI's mark (nameLead) -> with no mark, a hotel (a
// place a lodging record points at) by its local name, every other place by `name`. Every display of a place's name reads placeLabel.
function placeForeign(p) { const f = p && typeof p.foreign === 'string' ? p.foreign.trim() : ''; return f && f !== String(p.name || '').trim() ? f : ''; }
function nameLeadSet() { const v = STATE.settings.nameLead; return v === 'he' || v === 'local' ? v : 'auto'; }
function leadAuto(p, t) { const s = nameLeadSet(); if (s !== 'auto') return s === 'local' ? 'foreign' : 'name'; if (p.nameLead === 'foreign') return 'foreign';
  t = t === undefined ? (STATE.trips && STATE.trips[STATE.activeTrip]) : t; return t && (t.lodging || []).some(l => l.placeId === p.id) ? 'foreign' : 'name'; }
function placeLead(p, t) { return !placeForeign(p) ? 'name' : p.leadMine === 'foreign' || p.leadMine === 'name' ? p.leadMine : leadAuto(p, t); }
function placeLabel(p, t) { return !p ? '' : placeLead(p, t) === 'foreign' ? placeForeign(p) : String(p.name || ''); }
// a hotel's line: the lead name when its place has two names; else as before - the lodging record's name, or its place's
function lodgingLabel(l, p, t) { p = p || (l && l.placeId != null ? POINTS.find(x => x.id === l.placeId) : null); return String((p && placeForeign(p) ? placeLabel(p, t) : (l && l.name) || (p && p.name)) || ''); }
function nameOther(p, shown) { const f = placeForeign(p); return !f ? '' : shown === f ? String(p.name || '') : f; } // the name a line did not show
// dup-both-names (decisions 2026-11-27 · Duplicates by either of a place's names, Q1-Q2): the one name comparison of "is this one of
// mine?". A place's names are all of them (`name` and `foreign`); one normalising, nameCore (case, accents, a bracket's tail, punctuation,
// spaces); two strengths - 'loose' (one name containing another, both 3 letters or more: the suggestions) and 'exact' (one name equal to
// another: the automatic joins). Every check of a place by its name calls placeNameMatch; no other normaliser of names (t1258).
const nameCore = x => String(x || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s*\(.*$/, '').replace(/[^\p{L}\p{N} ]+/gu, ' ').replace(/\s+/g, ' ').trim();
// a place ({ name, foreign }), a name, or a list of them -> its names as written, the empty left out
function placeNames(x) { return (Array.isArray(x) ? x : [x]).flatMap(v => v && typeof v === 'object' ? [v.name, v.foreign] : [v]).filter(v => typeof v === 'string' && v.trim()); }
// a, b: as placeNames takes; how: 'loose' | 'exact' -> the name of b that matched one of a's (as written), or ''
function placeNameMatch(a, b, how) { const as = placeNames(a).map(nameCore).filter(Boolean); if (!as.length) return '';
  for (const raw of placeNames(b)) { const m = nameCore(raw); if (m && as.some(n => how === 'exact' ? n === m : n.length >= 3 && m.length >= 3 && (n.includes(m) || m.includes(n)))) return raw; }
  return ''; }
// chain-followups (decisions 2026-11-28 · Review of day chain steps 3-5, Q1): "the same thing, near" - one distance for every match of a
// place by its name and its point: a discovery already mine (discExisting, discInDraft) and an automatic join by an equal name
const SAME_NEAR_KM = 0.15;
// an automatic join by name: an equal name (placeNameMatch 'exact') of two places within SAME_NEAR_KM, or when either has no point
// (routeCoordOf); two places of one generic name apart ("חניה") stay two. Every automatic join by name calls it (addSame, companionRef)
function placeNameJoin(a, b) { const m = placeNameMatch(a, b, 'exact'); if (!m) return '';
  const ca = routeCoordOf(a), cb = routeCoordOf(b); return !ca || !cb || distanceKm(ca, cb) <= SAME_NEAR_KM ? m : ''; }
function placeOther(p, t) { return !placeForeign(p) ? '' : placeLead(p, t) === 'foreign' ? String(p.name || '') : placeForeign(p); }
function itemOf(ref) {
  if (ref == null || ref === '') return null;
  const s = String(ref), t = activeTripObj(), P = id => POINTS.find(p => p.id === id) || null;
  const out = (kind, o) => ({ ref: typeof ref === 'number' ? ref : s, kind, name: '', place: null, note: null, sched: null, travel: null, lodging: [], ...o });
  const lodgingOf = id => (t.lodging || []).filter(l => l.placeId === id);
  if (s.startsWith('tv:')) { const f = (t.travels || []).find(x => String(x.id) === s.slice(3)); return f ? out('travel', { name: travelTitle(f), travel: f }) : null; }
  if (s.startsWith('l:')) { const l = (t.lodging || []).find(x => String(x.id) === s.slice(2)); if (!l) return null; const p = P(l.placeId);
    return out('place', { name: (p && placeLabel(p, t)) || l.name || '', place: p, lodging: [l], hotel: true }); }
  if (s.startsWith('s:')) { const raw = rawSched(s.slice(2)); if (!raw) return null; const e = schedEff(raw);
    if (isTravelKind(e.kind)) { const f = grpTravelOf(raw, e, t); return out('travel', { name: travelTitle(f), travel: f, sched: e }); } // 11.0.0: a program line of a travel's kind is a travel
    const p = e.placeId != null ? P(e.placeId) : null;
    if (p) return out('place', { name: e.title || placeLabel(p, t), place: p, sched: e, lodging: lodgingOf(p.id), hotel: e.kind === 'hotel' || lodgingOf(p.id).length > 0 });
    return out('note', { name: e.title || '', sched: e }); }
  const id = /^\d+$/.test(s) ? Number(s) : s;
  if (typeof id === 'number') { const p = P(id); return p ? out('place', { name: placeLabel(p, t), place: p, lodging: lodgingOf(id), hotel: lodgingOf(id).length > 0 }) : null; }
  const f = STATE.planItems[id]; if (!f) return null;
  const tv = (t.travels || []).find(x => String(x.id) === s);
  if (tv || f.travel) return out('travel', { name: tv ? travelTitle(tv) : f.name, travel: tv || null, note: f });
  if (f.ref != null) { const p = P(f.ref); if (p) return out('place', { name: placeLabel(p, t), place: p, note: f, copy: true, lodging: lodgingOf(p.id) }); }
  return out('note', { name: f.name || '', note: f });
}

// --- the data rules, as a fix that runs on open, after imports and after restoring (idempotent: does nothing when all is in shape)
// replace a plan id everywhere in a trip's personal data (days, times, marks, locks, anchors, removed list, bookings, ratings…).
// Note ids ('f_…') are unique strings, so an exact match of a value, an array item or a "|"-separated key part is safe.
function renameRefIn(o, from, to) {
  const F = String(from), T = String(to);
  const walk = x => {
    if (Array.isArray(x)) { for (let i = 0; i < x.length; i++) { if (String(x[i]) === F && typeof x[i] !== 'object') x[i] = to; else if (x[i] && typeof x[i] === 'object') walk(x[i]); } return; }
    if (!x || typeof x !== 'object') return;
    Object.keys(x).forEach(k => { let v = x[k];
      if (v && typeof v === 'object') walk(v); else if (typeof v === 'string' && v === F) v = to; else if (typeof v === 'string' && v === 's:' + F) v = 's:' + T;
      const nk = k.split('|').map(p => p === F ? T : p).join('|');
      if (nk !== k) { delete x[k]; if (!(nk in x)) x[nk] = v; } else x[k] = v; });
  };
  walk(o);
}
function destOfDayIn(t, dayKey) { const d = tripDayList(t).find(x => x.key === dayKey); const segs = (t.segments || []).filter(x => DESTS[x.dest] && (!d || (x.from <= d.date && d.date <= x.to)));
  return (segs.length ? segs[segs.length - 1] : (t.segments || []).find(x => DESTS[x.dest])) || null; } // a transfer day belongs to the destination you arrive at
// where a place id lives in the destinations: its effective data (file + my edits), or null
function destPlaceData(id) {
  for (const d of Object.values(DESTS)) { const b = (d.places || []).find(p => (d.idBase || 0) + p.id === id);
    if (b) { const e = STATE.edits.places[id]; const q = { ...b, id, ...(e && e.op === 'edit' ? e.data : {}) }; return { d, q: { ...q, layer: (e && e.op === 'edit' && e.data.layer != null) ? e.data.layer - (d.idBase || 0) : b.layer } }; } }
  const e = STATE.edits.places[id]; if (e && e.op === 'add' && DESTS[e.data.dest]) { const d = DESTS[e.data.dest]; return { d, q: { ...e.data, id, layer: e.data.layer - (d.idBase || 0) } }; }
  return null;
}
// a hotel is a place of the trip only: a lodging that points at a destination's place gets a copy in the trip (same id, so
// the plan, marks and bookings keep pointing at it), and the destination's place is hidden (status "moved" - nothing deleted)
function hotelsToTrip(t) {
  if (!t || t.archived) return 0; let n = 0;
  (t.lodging || []).forEach(l => { const id = l.placeId; if (id == null) return; const has = (t.places || []).some(p => p.id === id);
    const src = destPlaceData(id); if (!src || (has && (STATE.edits.status[id] || {}).s === 'moved')) return; // 9.3.0: a file's copy of the hotel (normalizeTrip) still hides the destination's place
    if (!has) { const tp = { ...placeFields(src.q), id, dest: src.d.id, layer: src.q.layer, fromDest: src.d.id }; delete tp.userAdded; t.places = (t.places || []).concat(tp); }
    const st = STATE.edits.status[id]; if (!st || st.s !== 'moved') STATE.edits.status[id] = { s: 'moved', at: Date.now(), who: STATE.settings.deviceName || '', hotel: true, trip: t.id };
    n++; });
  return n;
}
// 9.3.0 (ס11): it runs only where a file comes in (a trip file, a destination that a trip sleeps in, a trip site's update) - never
// quietly on every open; the line "🧳 N מלונות עברו לטיול" says it, and 🙈 מוסתרים shows the destination's place "🧳 עבר לטיול …"
// 9.3.0 (ס11): a hotel in a file may point at a destination's place by the file's own number (or "@dest:id"); it gets this
// device's number for that place (its destination's idBase), so hotelsToTrip finds it, moves it in and hides the destination's copy
function lodgingToDevice(t) { tripRefsToDevice(t, t && t.lodging); }
// kit-fixes (A2.1, decisions 2026-11-22 · Review of the `kit-review` report, Q2): a program line may name a destination's place by
// the file's own number too (reference/file-format.md "Place references"); it gets this device's number the same way, so every
// reader (the pin, the place link, a transfer's "אל", the weather, ＋ מקום, the search) finds it - where a trip file comes in, as hotels
function schedToDevice(t) { tripRefsToDevice(t, t && t.schedule); }
function tripRefsToDevice(t, rows) {
  if (!t) return; const ds = tripDests(t).map(id => DESTS[id]).filter(Boolean);
  (rows || []).forEach(l => { if (!l || typeof l !== 'object') return; const id = l.placeId; if (id == null || id === '' || (t.places || []).some(p => p.id === id)) return;
    if (typeof id === 'string') { const r = deviceRef(id); if (r != null) l.placeId = r; return; }
    if (typeof id !== 'number' || ds.some(d => d.places.some(q => (d.idBase || 0) + q.id === id))) return; // already this device's number
    const d = ds.find(x => x.places.some(q => q.id === id)); if (d) l.placeId = (d.idBase || 0) + id; });
}
function hotelsToTrips(trips) { stashActive(); const n = trips.reduce((k, t) => k + hotelsToTrip(t), 0); if (n) loadPersonal(STATE.activeTrip); return n; }
const hotelsMovedText = n => n ? `${SEP}🧳 ${n === 1 ? 'מלון אחד עבר' : n + ' מלונות עברו'} לטיול` : '';
loadPersonal(STATE.activeTrip);
// review-fixes-11471 (4; decisions 2026-11-23 · Review of the `test-dedupe` and `one-way` summaries, Q2): an ordinary step of a built-in trip's
// coming in, not a one-time migration - whenever the built-in trips' pass (layer-edits) marked a trip that came in or was updated, its hotels move into it
function bundleHotelsIn() { if (STATE._bundleHotels) { const n = hotelsToTrips(STATE._bundleHotels.map(id => STATE.trips[id]).filter(Boolean)); delete STATE._bundleHotels; if (n) setTimeout(() => logEvent('אתר הטיול עודכן' + hotelsMovedText(n), true, { b: 1 }), 0); } } // a timer: logEvent's consts are further down at startup
bundleHotelsIn();
applyActiveTrip();
persist();      // 1.8.1: first change not yet in a backup (0 = nothing new)

function persist(quiet) { // the small-storage rows are saved together; which fields - from the registry. quiet (11.2.0): derived data the app kept on its own (a travel's path) - saved, nothing redrawn
  if (!quiet) { dataChanged(); if (typeof gidLookSoon === 'function') gidLookSoon(); } // 5.1.0; 6.1.0: also the one draw; 11.23.0 (place-gid-2): a new place is looked up in the background at once
  stashActive(); if (STATE.activeTrip && !tripWritable(STATE.activeTrip)) loadPersonal(STATE.activeTrip); // item 9: a closed trip's mirror shows its data, never a mark that was not written
  const toSave = { format: REG_FORMAT, app: APP_VERSION }; // 10.1.1: the version that saved (the old-copy guard)
  [...REG, ...REG_STATES].forEach(r => (r.where.blob || []).forEach(f => { toSave[f] = STATE[f]; }));
  toSave.activeTrip = ARCHIVE_VIEW ? ARCHIVE_VIEW.prev : DEST_VIEW ? DEST_VIEW.prev : STATE.activeTrip; // destination-view: the start never restores a view
  if (!regWrite(null, toSave, STORE_KEY) && !regIsSpace(REG_SPACE.err)) showToast(TX.notSaved); // storage (Q6): a refusal for space already gave the one message
}

const LOG_DAYS = 14;
function logEvent(text, notAChange, mark) { // notAChange: a row outside the undo chain; mark: { u, x, ol } of an undo-history row, or { b: 1 } - a change the app made on its own (a barrier)
  if (!notAChange && !STATE.firstUnbackedAt) STATE.firstUnbackedAt = Date.now();
  const cutoff = Date.now() - LOG_DAYS * 864e5;
  STATE.log = STATE.log.filter(e => e.at >= cutoff);
  STATE.log.push({ at: Date.now(), who: STATE.settings.deviceName || '', text: plainMsg(text), ...(mark || {}) }); // plain text, kept as typed: a name's "<...>" stays (10.17.2; every reader escapes it)
  if (STATE.log.length > 400) STATE.log = STATE.log.slice(-400);
  persist();
}
function placeName(id) { const p = planItem(id); return p ? placeLabel(p).replace(/\s*\(.*$/, '') : ''; }

const BACKUP_APP = PACK.filePrefix + '-trip';
// 8.0.0 (ק4): the name and the short count of each part - the same names in backup, restore, sending and receiving
const tdCount = (d, row, f) => Object.values((d && d[row]) || {}).reduce((n, x) => n + (Array.isArray(x[f]) ? x[f].length : Object.keys(x[f] || {}).length), 0);
const PART_INFO = {
  trip:      { label: 'הטיול', sub: 'תאריכים, קטעים, ' + TX.travels + ' ו' + TX.lodging, count: d => { const n = Object.keys(((d && d.trip) || {}).trips || {}).length; return n > 1 ? `${n} טיולים` : ''; } },
  dests:     { label: 'היעדים', count: d => { const n = Object.keys((d && d.dests) || {}).length; return n > 1 ? `${n} יעדים` : n ? 'יעד אחד' : ''; } },
  plan:      { label: TX.plan, count: d => { const n = Object.values((d && d.plan) || {}).reduce((s, x) => s + Object.keys(x.itinerary || {}).length, 0); return n ? `${n} ימים` : ''; } },
  favorites: { label: TX.fav, count: d => { const n = tdCount(d, 'favorites', 'favorites'); return n ? `${n}` : ''; } },
  visits:    { label: TX.visited + ' ודירוגים', count: d => { const n = tdCount(d, 'visits', 'visited'); return n ? `${n} ${TX.places}` : ''; } },
  bookings:  { label: 'הזמנות', count: d => { const n = tdCount(d, 'bookings', 'bookings'); return n ? `${n}` : ''; } },
  edits:     { label: 'העריכות ביעדים', count: d => { const e = ((d && d.edits) || {}).edits || {}; const n = Object.keys(e.places || {}).length + Object.keys(e.status || {}).length + Object.keys(e.layers || {}).length; return n ? `${n}` : ''; } },
  mementos:  { label: 'מזכרות ותמונות', count: d => { const k = Object.keys((d && d.mementos) || {}).concat(Object.keys((d && d.hotelPhotos) || {})); return k.length ? `${k.length} תמונות` : ''; } },
  settings:  { label: 'הגדרות', count: () => '' },
  log:       { label: 'יומן שינויים', count: d => { const n = (((d && d.log) || {}).log || []).length; return n ? `${n} רשומות` : ''; } },
};
function partLabel(id) { return PART_INFO[id].label; }
function buildBackup(parts) {
  const out = { app: BACKUP_APP, kind: 'backup', format: BACKUP_FORMAT, minAppVersion: BACKUP_MIN_APP, appVersion: APP_VERSION, createdAt: new Date().toISOString(),
    device: STATE.settings.deviceName || '', signature: `${PACK.appTitle} · גיבוי · ${tmFmt('date', Date.now())} · v${APP_VERSION}`, parts: {} };
  parts.forEach(k => { out.parts[k] = partOut(k, SCOPE_ALL); });
  return out;
}
const BACKUP_FULL = ['trip', 'plan', 'favorites', 'visits', 'bookings', 'edits']; // a backup with these counts for the reminder
async function saveBackupFile(parts) {
  const data = buildBackup(parts);
  const name = `${PACK.fileName}-backup-${tmFmt('date', Date.now()).replace(/\./g,'-')}.json`;
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
  if (!(await deliverFile(blob, name))) return false;
  logEvent('נשמר גיבוי: ' + (parts.length === PART_LIST.length ? 'הכל' : parts.map(partLabel).join(', ')), true);
  if (BACKUP_FULL.every(k => parts.includes(k))) { STATE.lastBackupAt = Date.now(); STATE.firstUnbackedAt = 0; persist(); }
  return true;
}
// undo-history Q7: the restore is one row whose stored state is everything it overwrote (the history's slots); the log rows it
// brings are read-only (rowIn drops their undo marks) and stay after an undo of the restore
function applyRestore(backup, parts) {
  stashActive(); // once: a row restored later must not be overwritten by the open trip's marks
  parts.forEach(k => { const d = backup.parts[k]; if (!d || !PART_BY[k]) return; PART_BY[k].rows.forEach(r => rowIn(r, recRestoreIn(r, d[r]))); }); // prev-recs (Q11): the summaries joined, not replaced
  ensureEditsShape(); renderLegend();
  if (!STATE.trips[STATE.activeTrip] || STATE.trips[STATE.activeTrip].archived) STATE.activeTrip = pickRelevantTrip(null);
  loadPersonal(STATE.activeTrip); applyActiveTrip(); syncFlightsToPlan(); updateHeader();
  persist();
  showUndoToast('שוחזר: ' + (parts.length === PART_LIST.length ? 'הכל' : parts.map(partLabel).join(', ')));
}
function hasPersonalData() { return Object.keys(STATE.edits.places).length || Object.keys(STATE.edits.layers || {}).length || Object.keys(STATE.edits.status).length || STATE.favorites.size || STATE.visited.size || Object.values(STATE.itinerary).some(d => d && Object.values(d).some(a => a && a.length)); }
function svcOffHTML() { return msi('cloud_off', { cls: 'msi-in' }) + ' ' + SVC_MSG.offline; }
function backupNagHTML() {
  // 1.8.1: remind only when something changed since the last backup, 30 days after the first such change
  if (!hasPersonalData() || Date.now() < STATE.nagSnoozeUntil) return '';
  if (!STATE.firstUnbackedAt) return '';
  if (Math.floor((Date.now() - STATE.firstUnbackedAt) / 864e5) < backupDays()) return '';
  const days = Math.floor((Date.now() - (STATE.lastBackupAt || STATE.firstUnbackedAt)) / 864e5);
  return `<div class="backup-nag"><span>${msi('download_for_offline', { cls: 'msi-in' })} ${STATE.lastBackupAt ? `עברו ${days} ימים מהגיבוי האחרון` : 'עוד לא נשמר גיבוי של הסימונים והתוכנית'}</span>
    <button class="btn-nav" data-act="nag.backup">גיבוי עכשיו</button><button class="nag-x" data-act="nag.snooze" aria-label="תזכיר בעוד שבוע">✕</button></div>`;
}
act('nag.backup', async () => { if (await saveBackupFile(PART_LIST)) { showToast('הגיבוי נשמר'); redrawSoon(); } });
act('nag.snooze', () => { STATE.nagSnoozeUntil = Date.now() + 7 * 864e5; persist(); showToast('נזכיר שוב בעוד שבוע'); });

function toggleFavorite(id) {
  const wasFav = STATE.favorites.has(id);
  if (wasFav) STATE.favorites.delete(id); else STATE.favorites.add(id);
  persist(); 
  showUndoToast((wasFav ? SY.fav + ' הוסר מהמועדפים: ' : SY.fav + ' נוסף למועדפים: ') + placeName(id));
}
function toggleVisited(id) {
  const wasVisited = STATE.visited.has(id);
  if (wasVisited) STATE.visited.delete(id); else STATE.visited.add(id);
  persist(); 
  showUndoToast((wasVisited ? '✓ בוטל "' + TX.visited + '": ' : '✓ ' + TX.visited + ': ') + placeName(id));
}
const SLOTS = [
  {key:'morning', label:'בוקר'}, // 10.8.0 (design-icons): words - the toasts that name a part carry no emoji
  {key:'afternoon', label:'צהריים'},
  {key:'evening', label:'ערב'},
];
function ensureDay(day) {
  let d = STATE.itinerary[day];
  if (!d || Array.isArray(d)) {
    const oldIds = Array.isArray(d) ? d : [];
    d = { unassigned: oldIds, morning: [], afternoon: [], evening: [] };
    STATE.itinerary[day] = d;
  }
  d.unassigned = d.unassigned || [];
  d.morning = d.morning || []; d.afternoon = d.afternoon || []; d.evening = d.evening || [];
  return d;
}
function findSlot(day, id) {
  const d = ensureDay(day);
  for (const key of ['unassigned','morning','afternoon','evening']) {
    if (d[key].includes(id)) return key;
  }
  return null;
}
function isInDay(day, id) { return findSlot(day, id) !== null; }
function pid(v) { return /^\d+$/.test(String(v)) ? parseInt(v) : String(v); }
function planItem(id) {
  if (typeof id === 'number') return POINTS.find(p => p.id === id) || null;
  const f = STATE.planItems[id]; if (!f) return null;
  if (f.ref != null) { const base = POINTS.find(p => p.id === f.ref); if (base) return { ...base, id, dup: true }; }
  return { id, name: f.name, address: f.address || '', icon: f.icon || 'note', color: '#5A5D63', layer: 0, planOnly: true, travel: f.travel || null,
    transit: '', reservation: '', price: '', description: '' };
}
// the plan's own items (STATE.planItems) are of two kinds: a note ("n_..."; a flight line is a note with travel) and a copy
// of a place in a day ("c_...", with ref = the place). planItem() marks both planOnly; a copy also dup.
function isNote(p) { return !!(p && p.planOnly && !p.dup); }
function copyRef(id) { return (STATE.planItems[id] || {}).ref; }
// 10.0.0 (rename-plan-items): until 9.8.0 a trip's plan items were stored as "freeItems" and a note's icon as "free".
// The one conversion, on everything that may hold a trip's personal data: the device's stored trips (the migration register's row
// planItems, run by layer-edits when the stored record is parsed), a backup of format 2 (fileUp), the personal part of a trip file
// (fileUp, personalFromFile). Idempotent.
function planItemsUp(td) { const OLD = 'freeItems'; // a literal: the register's row runs it at load, before the consts below exist
  if (!td || typeof td !== 'object' || Array.isArray(td)) return td;
  if (td[OLD]) td.planItems = { ...td[OLD], ...(td.planItems || {}) };
  delete td[OLD];
  const icon = it => { if (it && it.icon === 'free') it.icon = 'note'; };
  Object.values(td.planItems || {}).forEach(icon);
  Object.values(((td.planX || {}).removed) || {}).forEach(a => (a || []).forEach(r => icon(r && r.item)));
  return td;
}
function fileUp(data) {
  if (data.parts && data.format === BACKUP_FORMAT_OLD) { Object.values(((data.parts.plan || {}).plan) || {}).forEach(planItemsUp); data.format = BACKUP_FORMAT_PREV; }
  if (data.parts && data.format === BACKUP_FORMAT_PREV) { Object.values((((data.parts.trip || {}).trip) || {}).trips || {}).forEach(t => { if (t && typeof t === 'object') travelsMerge(t); }); data.format = BACKUP_FORMAT; } // 11.0.0: the plan's copies of the merged travels follow on open (travelOrphansOut)
  if (data.parts && versionLess(data.appVersion, ROAD_RULE)) Object.values((((data.parts.trip || {}).trip) || {}).trips || {}).forEach(t => roadDaysDerive(t)); // 11.19.0 (trip-travel-days): an older backup's trips open as they did
  if (data.personal) planItemsUp(data.personal);
  return data;
}
function dayOfItem(id) { return (TRIP_DAYS.find(d => findSlot(d.key, id)) || {}).key || null; }
const timeKey = (day, id) => day + '|' + id;
function getTime(day, id) { return STATE.times[timeKey(day, id)] || null; }
function slotForTime(start) {
  if (start < STATE.settings.morningEnd) return 'morning';
  if (start < STATE.settings.afternoonEnd) return 'afternoon';
  return 'evening';
}
function placeTimed(day, id) {
  const d = ensureDay(day), t = getTime(day, id); if (!t) return;
  const target = slotForTime(t.start), cur = findSlot(day, id);
  const keepIdx = cur === target ? d[target].indexOf(id) : -1;
  ['unassigned', 'morning', 'afternoon', 'evening'].forEach(k => { d[k] = d[k].filter(x => x !== id); });
  const arr = d[target];
  const timed = arr.map((x, i) => ({ i, t: getTime(day, x) })).filter(o => o.t);
  let pos;
  if (!timed.length) pos = keepIdx >= 0 ? Math.min(keepIdx, arr.length) : arr.length;
  else { const later = timed.find(o => o.t.start > t.start); pos = later ? later.i : timed[timed.length - 1].i + 1; }
  arr.splice(pos, 0, id);
}
function reslotAllTimed() {
  Object.keys(STATE.times).forEach(k => { const [day, raw] = k.split('|'); const id = pid(raw); if (findSlot(day, id)) placeTimed(day, id); });
}
function planChange(msg, fn, ms) { fn(); persist(); showUndoToast(msg, ms); } // undo-history: fn must change the plan synchronously

function toggleDay(day, id) {
  const cur = findSlot(day, id);
  planChange(cur ? (typeof id === 'string' ? SY.days + ' ההערה הוסרה מהיום' : SY.days + ' הוסר מהיום') : SY.days + ' נוסף לתוכנית היום', () => {
    const d = ensureDay(day);
    if (cur) {
      d[cur] = d[cur].filter(x => x !== id);
      delete STATE.times[timeKey(day, id)];
      if (typeof id === 'string') delete STATE.planItems[id];
    } else d.unassigned.push(id);
  });
}

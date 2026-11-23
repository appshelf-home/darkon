// ================= CONTENT EDITS (2.0.0) =================
// Places = pack places + this device's edits (changed fields, added places, statuses). Edits are
// stored apart from the pack, so a newer pack in a new version merges with them instead of overwriting.
const EDIT_FIELDS = ['name','foreign','layer','address','description','transit','reservation','price','manualCoord','mapsUrl','icon','region','key','gid']; // 4.15.0: key = ★ key point of the route; 11.22.0: gid = the Google id record (place-gid.js); kit-fixes (item 4): foreign = the place's local name (an edit like the name's)
function decoratePlace(q) { const L = layerDef(q.layer); q.layer_name = L.name; q.color = L.color; if (!q.icon) q.icon = L.icon; return q; }
function rebuildPoints() {
  const out = [];
  const trip = activeTripObj(), tds = tripDests(trip);
  const tripIds = new Set((trip.places || []).map(x => x.id));
  // 4.26.0: a discovery I added that the destination's file now carries too (same src): shown once - mine, completed by the file
  const twinOf = new Map(), shadowed = new Set();
  Object.entries(STATE.edits.places).forEach(([id, e]) => { if (e.op !== 'add' || !e.data || !e.data.src) return; const sr = e.data.src;
    const b = BASE_PLACES.find(x => x.dest === e.data.dest && x.src && ((sr.key && x.src.key === sr.key) || (sr.url && x.src.url === sr.url)));
    if (b) { twinOf.set(Number(id), b); shadowed.add(b.id); } });
  BASE_PLACES.forEach(b => {
    if (shadowed.has(b.id)) return;
    if (tripIds.has(b.id) || (STATE.edits.status[b.id] && STATE.edits.status[b.id].s === 'moved')) return; // 4.0.0: moved to a trip
    const e = STATE.edits.places[b.id];
    if (e && e.op === 'del') return; // 11.18.0 (place-hide-delete Q2): deleted - an update of the destination does not bring it back
    const q = e && e.op === 'edit' ? { ...b, ...e.data, edited: true } : { ...b };
    out.push(q);
  });
  Object.entries(STATE.edits.places).forEach(([id, e]) => { if (e.op === 'add' && tds.includes(e.data.dest) && !tripIds.has(Number(id)) && !(STATE.edits.status[id] && STATE.edits.status[id].s === 'moved')) { const q = { reservation: '', price: '', transit: '', description: '', ...e.data, id: Number(id), userAdded: true }; const b = twinOf.get(Number(id)); out.push(b ? completeFromTwin(q, b) : q); } });
  // 4.0.0: places of the trip (hotel, one-off events, personal places) - not part of any destination
  (trip.places || []).forEach(tp => { if (tp.dest && !tds.includes(tp.dest)) return; const d = DESTS[tp.dest] || DESTS[tds[0]];
    const q = { reservation: '', price: '', transit: '', description: '', ...tp, dest: d ? d.id : '', layer: tripPlaceLayer(tp, d), tripOnly: true };
    if (tp.status) { q.status = tp.status; q.statusNote = tp.statusNote || ''; } out.push(q); });
  out.forEach(q => { const st = q.tripOnly ? null : STATE.edits.status[q.id]; if (st) { if (st.s === 'active') { delete q.status; delete q.statusNote; } else { q.status = st.s; q.statusNote = st.note || ''; } } decoratePlace(q); });
  POINTS.length = 0; out.forEach(q => POINTS.push(q));
}
// 4.26.0: what the file's twin of my discovery adds: it fills only what I left empty (and a description I never rewrote);
// my name, layer and point stay
function completeFromTwin(q, b) {
  const o = { ...q, completed: true }, empty = v => v == null || v === '';
  ['foreign', 'transit', 'reservation', 'price', 'source', 'checkedAt', 'access', 'accessNote', 'mapsUrl', 'region', 'gid'].forEach(k => { if (empty(o[k]) && !empty(b[k])) o[k] = b[k]; });
  if (!empty(b.description) && (empty(q.description) || (q.src && q.src.dh && textHash(q.description) === q.src.dh))) o.description = b.description;
  if ((empty(q.address) || /^-?\d+(\.\d+)?,\s*-?\d/.test(q.address)) && !empty(b.address)) o.address = b.address;
  const L = LAYER_DEFS.find(l => l.id === q.layer); if (!empty(b.icon) && (empty(q.icon) || (L && q.icon === L.icon))) o.icon = b.icon;
  if (o.key == null && b.key) o.key = b.key;
  if (b.status && !o.status) { o.status = b.status; o.statusNote = b.statusNote || ''; }
  return o;
}
// a trip place stores its destination's own (unshifted) layer id; falls back to the destination's lodging-type layer
function tripPlaceLayer(tp, d) {
  if (!d) return tp.layer;
  const ls = destLayersEff(d), want = d.idBase + Number(tp.layer);
  if (ls.some(l => l.id === want)) return want;
  const byType = ls.find(l => l.type === (tp.type || 'lodging')); return byType ? byType.id : (ls[0] ? ls[0].id : want);
}
function placeDiff(base, data) { const d = {}; EDIT_FIELDS.forEach(k => { if (data[k] === undefined) return; if (JSON.stringify(data[k]) !== JSON.stringify(base[k])) d[k] = data[k]; }); return d; }
// 4.0.0: scope 'trip' = a place of this trip only (not saved to the destination, not sent with it)
function placeFields(q) { const o = {}; ['name','foreign','address','description','transit','reservation','price','manualCoord','mapsUrl','icon','region','access','accessNote','coordSource','verified','source','checkedAt','key','gid','quiet'].forEach(k => { if (q[k] !== undefined && q[k] !== '') o[k] = JSON.parse(JSON.stringify(q[k])); }); return o; } // 11.46.0 (phone-round-4c-fixes P4; decisions 2026-11-21 · Review of the `legal-server-fixes` summary, Q3): quiet travels with the place to a destination ("שמירה ביעד") and back
function moveToTrip(id, data, status) {
  const t = activeTripObj(), q = POINTS.find(x => x.id === id); if (!q || q.tripOnly) return;
  const d = DESTS[q.dest] || curDest();
  const tp = { ...placeFields(q), ...data, id, dest: d.id, layer: (data.layer != null ? data.layer : q.layer) - d.idBase };
  delete tp.userAdded; if (status && isGoneStatus(status.s)) { tp.status = status.s; tp.statusNote = status.note || ''; }
  t.places = (t.places || []).concat(tp);
  if (q.userAdded) { delete STATE.edits.places[id]; delete STATE.edits.status[id]; }
  else { delete STATE.edits.places[id]; STATE.edits.status[id] = { s: 'moved', at: Date.now(), who: STATE.settings.deviceName || '' }; }
}
function moveToDest(id, data, status) {
  const t = activeTripObj(), tp = (t.places || []).find(x => x.id === id); if (!tp) return;
  const d = DESTS[tp.dest] || curDest(), who = STATE.settings.deviceName || '';
  t.places = t.places.filter(x => x.id !== id);
  const full = { ...placeFields(tp), ...data, layer: data.layer != null ? data.layer : tripPlaceLayer(tp, d), dest: d.id };
  const base = BASE_PLACES.find(b => b.id === id);
  if (base) { const st = STATE.edits.status[id]; if (st && st.s === 'moved') delete STATE.edits.status[id]; const diff = placeDiff(base, full); if (Object.keys(diff).length) STATE.edits.places[id] = { op: 'edit', data: diff, at: Date.now(), who }; }
  else STATE.edits.places[id] = { op: 'add', data: full, at: Date.now(), who };
  if (status && status.s !== 'active') STATE.edits.status[id] = { ...status, at: Date.now(), who };
}
function saveEditedPlace(id, data, status, scope) {
  const who = STATE.settings.deviceName || '';
  let msg;
  const curP = id != null ? POINTS.find(x => x.id === id) : null;
  if (id == null && scope === 'trip') {
    const t = activeTripObj(), d = DESTS[data.dest] || curDest(); id = Date.now();
    t.places = (t.places || []).concat({ ...data, id, dest: d.id, layer: data.layer - d.idBase }); msg = '🧳 נוסף מקום לטיול: ' + data.name;
  } else if (curP && curP.tripOnly && scope !== 'dest') {
    const t = activeTripObj(), i = t.places.findIndex(x => x.id === id), d = DESTS[curP.dest] || curDest();
    const nx = { ...t.places[i], ...data, layer: (data.layer != null ? data.layer : curP.layer) - d.idBase };
    if (status) { if (status.s === 'active') { delete nx.status; delete nx.statusNote; } else { nx.status = status.s; nx.statusNote = status.note || ''; } }
    t.places = t.places.map((x, k) => k === i ? nx : x); msg = '✏️ נערך: ' + data.name;
  } else if (curP && curP.tripOnly && scope === 'dest') { moveToDest(id, data, status); msg = 'עבר ליעד: ' + data.name; }
  else if (curP && !curP.tripOnly && scope === 'trip') { moveToTrip(id, data, status); msg = '🧳 עבר לטיול הזה בלבד: ' + data.name; }
  else if (id == null) { id = Date.now(); STATE.edits.places[id] = { op: 'add', data, at: Date.now(), who }; msg = '＋ נוסף מקום: ' + data.name; }
  else {
    const base = BASE_PLACES.find(b => b.id === id);
    if (base) { const d = placeDiff(base, data); if (Object.keys(d).length) STATE.edits.places[id] = { op: 'edit', data: d, at: Date.now(), who }; else delete STATE.edits.places[id]; }
    else if (STATE.edits.places[id]) STATE.edits.places[id] = { ...STATE.edits.places[id], data: { ...STATE.edits.places[id].data, ...data }, at: Date.now(), who };
    msg = '✏️ נערך: ' + data.name;
  }
  if (status !== undefined && !(curP && curP.tripOnly) && scope !== 'trip') {
    const base = BASE_PLACES.find(b => b.id === id);
    const baseSt = base && base.status ? base.status : 'active';
    if (status.s === baseSt && !status.note) delete STATE.edits.status[id]; else STATE.edits.status[id] = { ...status, at: Date.now(), who };
  }
  if (data.manualCoord && data.address) GEOCODE_CACHE[data.address] = data.manualCoord;
  rebuildPoints(); persist(); 
  showUndoToast(msg);
  return id;
}
function deleteAddedPlace(id) {
  const tq = POINTS.find(x => x.id === id && x.tripOnly);
  if (tq) { // 4.0.0: a trip place goes to the trash too (it remembers its trip)
    const t = activeTripObj(), tp = t.places.find(x => x.id === id);
    t.places = t.places.filter(x => x.id !== id);
    STATE.trash.push({ kind: 'tripPlace', tripId: t.id, id, entry: { data: tp }, at: Date.now() });
    TRIP_DAYS.forEach(d => { const day = STATE.itinerary[d.key]; if (day) Object.keys(day).forEach(k => { day[k] = day[k].filter(x => x !== id); }); delete STATE.times[d.key + '|' + id]; });
    rebuildPoints(); persist(); 
    showUndoToast(SY.del + ' הועבר לסל המחזור: ' + tp.name);
    return;
  }
  const b = BASE_PLACES.find(x => x.id === id);
  if (b) { // 11.18.0 (place-hide-delete Q2): a place of the destination's file - to the trash, and the delete remembered as a destination
    // edit (op 'del'), so an update of the destination does not bring it back, also after the trash; "תיקונים ליעד" sends it as "נמחק".
    // The trash keeps what the place had (its edit, its reason, ❤️ and היינו) for a restore, which drops the mark
    const p = POINTS.find(x => x.id === id) || b, name = p.name || b.name, fav = STATE.favorites.has(id), vis = STATE.visited.has(id);
    STATE.trash.push({ kind: 'destPlace', id, entry: { data: { name } }, prev: STATE.edits.places[id] || null, st: STATE.edits.status[id] || null, at: Date.now(), fav, vis });
    STATE.edits.places[id] = { op: 'del', data: { name: b.name }, at: Date.now(), who: STATE.settings.deviceName || '' }; delete STATE.edits.status[id];
    STATE.favorites.delete(id); STATE.visited.delete(id);
    TRIP_DAYS.forEach(d => { const day = STATE.itinerary[d.key]; if (day) Object.keys(day).forEach(k => { day[k] = day[k].filter(x => x !== id); }); delete STATE.times[d.key + '|' + id]; });
    rebuildPoints(); persist();
    showUndoToast(SY.del + ' הועבר לסל המחזור: ' + name);
    return;
  }
  const e = STATE.edits.places[id]; if (!e || e.op !== 'add') return;
  const fav = STATE.favorites.has(id), vis = STATE.visited.has(id);
  STATE.trash.push({ id, entry: e, at: Date.now(), fav, vis });
  delete STATE.edits.places[id]; delete STATE.edits.status[id];
  STATE.favorites.delete(id); STATE.visited.delete(id);
  TRIP_DAYS.forEach(d => { const day = STATE.itinerary[d.key]; if (day) Object.keys(day).forEach(k => { day[k] = day[k].filter(x => x !== id); }); delete STATE.times[d.key + '|' + id]; });
  rebuildPoints(); persist(); 
  showUndoToast(SY.del + ' הועבר לסל המחזור: ' + e.data.name);
}
// 4.37.3: destinations go to the trash too. The trash entry (in STATE.trash) is small; the destination itself stays whole in
// the device's destination database (or, without IndexedDB, inside the entry). Expired or orphaned copies are removed on open.
const destTrashKey = t => 'dest:' + t.id;
function newTrashId() { let id = Date.now(); while (STATE.trash.some(x => x.id === id)) id++; return id; } // ids must stay unique (two deletes in the same moment)
async function purgeDestTrashRows() {
  if (!DEST_DB.ok) return;
  const keep = new Set(STATE.trash.filter(x => x.kind === 'dest').map(destTrashKey));
  const gone = (await DEST_DB.tkeys()).filter(k => !keep.has(k)); if (gone.length) DEST_DB.tdel(gone);
}
async function deleteDestToTrash(id) {
  const d = DESTS[id]; if (!d || d.builtin) return;
  const entry = { id: newTrashId(), kind: 'dest', destId: id, at: Date.now(), entry: { data: { name: d.meta.name } }, places: (d.places || []).length };
  if (!(DEST_DB.ok && await DEST_DB.tput({ key: destTrashKey(entry), dest: d }))) entry.dest = d;
  delete DESTS[id]; saveDests(); STATE.trash.push(entry);
  persist(); 
  showUndoToast(SY.del + ' נמחק יעד (בסל 30 יום): ' + d.meta.name);
}
async function restoreDestFromTrash(t) {
  if (DESTS[t.destId]) { showToast('יעד עם אותו מזהה כבר נמצא בטלפון (יובא שוב?). אפשר למחוק אותו ואז לשחזר'); return; }
  const d = t.dest || ((await DEST_DB.tget(destTrashKey(t))) || {}).dest;
  if (!d) { showToast('לא מצאתי את היעד בטלפון. אפשר למחוק את הרשומה מהסל'); return; }
  DESTS[d.id] = JSON.parse(JSON.stringify(d)); if (STATE.destBases) STATE.destBases[d.id] = d.idBase || 0; saveDests();
  STATE.trash = STATE.trash.filter(x => x.id !== t.id); if (!t.dest) DEST_DB.tdel([destTrashKey(t)]);
  persist(); 
  showUndoToast('שוחזר מהסל היעד: ' + d.meta.name);
}
// 4.37.3: permanent deletion from the trash - one item, or the whole trash ("ריקון"); both with undo. undo-history Q4: an
// ordinary row that stores what it deletes (the entries, a destination's record in the trash store, a photo's image); its undo
// puts them back in the trash, and the queued purge of the rows (regRunPurges) skips what came back
async function purgeFromTrash(ids) {
  const out = STATE.trash.filter(x => ids.includes(x.id)); if (!out.length) return;
  STATE.trash = STATE.trash.filter(x => !ids.includes(x.id));
  const rows = out.filter(x => x.kind === 'dest' && !x.dest).map(destTrashKey); if (rows.length) DEST_DB.tdel(rows);
  trashPurged(out); persist(); 
  showUndoToast(out.length === 1 ? 'נמחק לצמיתות: ' + out[0].entry.data.name : `הסל רוקן (${out.length} פריטים)`);
}
// 6.0.0 (ר3): how each kind comes back from the trash is declared once, beside its registry row; the trash itself only dispatches
// 9.1.1 (ס2א): and how each kind goes in (into) - only these functions put things in the trash; permanent deletion only in
// purgeFromTrash / trashExpire / purgeDestTrashRows; the undo toast only in showUndoToast(Quiet) (guard: t880)
const TRASH_KINDS = {
  dest: { row: 'dests', into: deleteDestToTrash, back(t) { restoreDestFromTrash(t); } },
  trip: { row: 'trip', into: deleteTripToTrash, back(t, i) { if (STATE.trips[t.trip.id]) { showToast('טיול באותו מזהה כבר קיים'); return; } // 4.28.0
    STATE.trips[t.trip.id] = t.trip; STATE.tripData[t.trip.id] = t.tripData || {}; STATE.trash.splice(i, 1); if (!STATE.activeTrip && !t.trip.archived) setActiveTripQuiet(t.trip.id); persist(); 
    showUndoToast('שוחזר מהסל הטיול: ' + t.trip.name); } },
  tripPlace: { row: 'trip', into: deleteAddedPlace, back(t, i) { const tr = STATE.trips[t.tripId]; if (!tr) { showToast('הטיול של המקום הזה כבר לא קיים'); return; }
    tr.places = (tr.places || []).concat(t.entry.data); STATE.trash.splice(i, 1); rebuildPoints(); persist(); 
    showUndoToast('שוחזר מהסל: ' + t.entry.data.name); } },
  layer: { row: 'edits', into: deleteLayer, back(t, i) { STATE.edits.layers[t.id] = t.entry; STATE.trash.splice(i, 1); refreshLayers(); persist(); 
    showUndoToast('שוחזרה מהסל השכבה: ' + t.entry.data.name); } },
  photo: { row: 'mementos', into: photoToTrash, back(t, i) { photoBack(t, i); } }, // 9.8.0 (T13ב, Q15-Q16): a photo, a hotel photo, Claude's illustrated version
  destPlace: { row: 'edits', into: deleteAddedPlace, back(t, i) { const cur = STATE.edits.places[t.id]; // 11.18.0: the mark leaves, what the place had comes back
    if (!cur || cur.op === 'del') { if (t.prev) STATE.edits.places[t.id] = t.prev; else delete STATE.edits.places[t.id]; }
    if (t.st && !STATE.edits.status[t.id]) STATE.edits.status[t.id] = t.st; STATE.trash.splice(i, 1);
    if (t.fav) STATE.favorites.add(t.id); if (t.vis) STATE.visited.add(t.id);
    rebuildPoints(); persist();
    showUndoToast('שוחזר מהסל: ' + t.entry.data.name); } },
  place: { row: 'edits', into: deleteAddedPlace, back(t, i) { STATE.edits.places[t.id] = t.entry; STATE.trash.splice(i, 1);
    if (t.fav) STATE.favorites.add(t.id); if (t.vis) STATE.visited.add(t.id);
    rebuildPoints(); persist(); 
    showUndoToast('שוחזר מהסל: ' + t.entry.data.name); } },
};
function restoreFromTrash(id) {
  const i = STATE.trash.findIndex(t => t.id === id); if (i < 0) return;
  const t = STATE.trash[i]; TRASH_KINDS[t.kind || 'place'].back(t, i);
}


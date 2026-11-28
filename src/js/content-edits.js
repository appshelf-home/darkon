// ================= CONTENT EDITS (2.0.0) =================
// Places = pack places + this device's edits (changed fields, added places, statuses). Edits are
// stored apart from the pack, so a newer pack in a new version merges with them instead of overwriting.
const EDIT_FIELDS = ['name','foreign','leadMine','layer','address','description','transit','reservation','price','manualCoord','mapsUrl','icon','region','key','gid']; // 4.15.0: key = ★ key point of the route; 11.22.0: gid = the Google id record (place-gid.js); kit-fixes (item 4): foreign = the place's local name (an edit like the name's)
function decoratePlace(q) { const L = layerDef(q.layer); q.layer_name = L.name; q.color = L.color; if (!q.icon) q.icon = L.icon; return q; }
function rebuildPoints() {
  const out = [];
  const trip = activeTripObj(), tds = tripDests(trip);
  const tripIds = new Set((trip.places || []).map(x => x.id));
  // 4.26.0: a place I added that the destination's file carries too (add-key: the same exact identity - addSame): shown once - mine, completed by the file
  const twinOf = new Map(), shadowed = new Set();
  Object.entries(STATE.edits.places).forEach(([id, e]) => { if (e.op !== 'add' || !e.data) return; const a = { ...e.data, k: id };
    const b = BASE_PLACES.find(x => x.dest === e.data.dest && !shadowed.has(x.id) && addSame(a, x));
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
function completeFromTwin(q, b, layers) {
  const o = { ...q, completed: true }, empty = v => v == null || v === '';
  ['foreign', 'nameLead', 'transit', 'reservation', 'price', 'source', 'checkedAt', 'access', 'accessNote', 'mapsUrl', 'region', 'gid'].forEach(k => { if (empty(o[k]) && !empty(b[k])) o[k] = b[k]; });
  if (!empty(b.description) && (empty(q.description) || (q.src && q.src.dh && textHash(q.description) === q.src.dh))) o.description = b.description;
  if ((empty(q.address) || /^-?\d+(\.\d+)?,\s*-?\d/.test(q.address)) && !empty(b.address)) o.address = b.address;
  const L = (layers || LAYER_DEFS).find(l => l.id === q.layer); if (!empty(b.icon) && (empty(q.icon) || (L && q.icon === L.icon))) o.icon = b.icon;
  if (o.key == null && b.key) o.key = b.key;
  if (b.status && !o.status) { o.status = b.status; o.statusNote = b.statusNote || ''; }
  return o;
}
// ---- add-key (decisions 2026-11-24 · An AI update no longer doubles the places the user added, Q1-Q5) ----
// A place the user added is (1) a destination's edits record with op 'add' - its key is the record's key - or (2) a trip place added
// on a phone (trip.places, its own Date.now id) - its key is its id. A place an AI completes for it carries that key in `addKey`
// (reference/improve.md "Places the user added"). One test of "the same place" (addSame) serves the join of an incoming file
// (addJoin), its exact fallbacks, the one-time merge of the places already doubled (addMergeStored) and the twin on screen
// (rebuildPoints): the key first; with no key only an exact identity - the same Google id (gid.id or gid.cid) or the same
// discovery (src: type + key or url) - and, since dup-both-names (decisions 2026-11-27 · Duplicates by either of a place's names, Q2), an
// equal name: any name of one side equal to any name of the other, unless the two carry different Google ids or discoveries, and since
// chain-followups (decisions 2026-11-28 · Review of day chain steps 3-5, Q1) only within SAME_NEAR_KM or when either has no point
// (placeNameJoin); never a name that only contains the other, never a near point alone. The user's record survives with its key and takes the
// completion by completeFromTwin's rule (what the user filled stays theirs; the AI fills only empty fields).
const addKeyOf = v => (typeof v === 'number' || typeof v === 'string') && /^\d{11,16}$/.test(String(v)) ? String(v) : '';
function addSame(a, p) { // a: the add's place with its key (k); p: a place written by the AI -> 'key' | 'gid' | 'src' | 'name' | ''
  if (!a || !p || p === a) return ''; const pk = addKeyOf(p.addKey); if (pk) return pk === String(a.k) ? 'key' : '';
  const ga = a.gid || {}, gp = p.gid || {};
  if ((ga.id && ga.id === gp.id) || (ga.cid && gp.cid && String(ga.cid) === String(gp.cid))) return 'gid';
  const sa = a.src, sp = p.src; if (sa && sp && (!sa.type || !sp.type || sa.type === sp.type) && ((sa.key && sa.key === sp.key) || (sa.url && sa.url === sp.url))) return 'src';
  const other = (ga.id && gp.id) || (ga.cid && gp.cid) || (sa && sp && ((sa.key && sp.key) || (sa.url && sp.url))); // two identities that differ: two places
  return !other && placeNameJoin(a, p) ? 'name' : ''; }
// the pairs among places: the keyed first (a key that names no add, or an add already taken, is dropped - the place stays new and
// never falls back), then the unkeyed by an exact identity; each add takes at most one place
function addPairs(adds, places, fb) { const used = new Set(), out = []; // fb: which adds may take an unkeyed place (default: every add)
  places.forEach(p => { const pk = addKeyOf(p.addKey); if (p.addKey == null) return; const a = pk && adds.find(x => String(x.k) === pk && !used.has(x.k) && x.p !== p);
    if (a) { used.add(a.k); out.push([a, p, 'key']); } else { delete p.addKey; p._noAdd = 1; } });
  places.forEach(p => { if (p._noAdd || p.addKey != null) return; const a = adds.find(x => !used.has(x.k) && x.p !== p && (!fb || fb(x)) && addSame(x, p));
    if (a) { used.add(a.k); out.push([a, p, addSame(a, p)]); } });
  places.forEach(p => { delete p._noAdd; }); return out; }
// the AI's place p joins the add a: a.fill(completed) writes the user's record; the places that pointed at p (when it was on this phone) point at the add
function addFill(rec, p, layers) { const o = completeFromTwin(rec, p, layers); delete o.completed; delete o.addKey; return o; }
function addRemap(from, to) { if (from == null || from === to) return; const f = x => x === from ? to : x; stashActive();
  Object.keys(STATE.tripData || {}).forEach(tid => { const td = STATE.tripData[tid]; if (td) STATE.tripData[tid] = { ...td, ...mapPersonalRefs(td, f) }; });
  Object.values(STATE.trips || {}).forEach(t => { ['lodging', 'schedule'].forEach(k => (t[k] || []).forEach(x => { if (x && x.placeId === from) x.placeId = to; })); });
  const E = STATE.edits; if (E.status[from] && !E.status[to]) E.status[to] = E.status[from]; delete E.status[from];
  const ed = E.places[from], ad = E.places[to]; if (ed && ed.op === 'edit' && ad && ad.data) Object.entries(ed.data || {}).forEach(([k, v]) => { if (k !== 'layer' && (ad.data[k] == null || ad.data[k] === '')) ad.data[k] = v; });
  if (ed && ed.op !== 'del') delete E.places[from];
  if (STATE.activeTrip) loadPersonal(STATE.activeTrip); } // the open trip's marks as they are now (a later stashActive writes them back)
// the adds a destination's places may complete: mine on this phone, those of the file not here, and a trip's own (trip-only) adds
function addsOf(did, fileEdits, tripPlaces) { const out = [], E = STATE.edits.places;
  Object.entries(E).forEach(([k, e]) => { if (e && e.op === 'add' && e.data && e.data.dest === did) out.push({ ...e.data, k, set: v => { E[k] = { ...E[k], data: v }; }, rec: () => E[k].data }); });
  Object.entries((fileEdits && fileEdits.places) || {}).forEach(([k, e]) => { if (!E[k] && e && e.op === 'add' && e.data && addKeyOf(k)) out.push({ ...e.data, k, set: v => { e.data = v; }, rec: () => e.data }); });
  (tripPlaces || []).forEach(tp => { if (tp && addKeyOf(tp.id)) out.push({ ...tp, k: String(tp.id), p: tp, trip: 1, set: v => { Object.assign(tp, v); }, rec: () => tp }); });
  return out; }
// the join (Q3) of one incoming destination (dp, in its file's numbering): every place that completes an add leaves dp.places and
// fills that add; a trip's adds are joined from a destination only by their key. Returns the names joined.
function addJoin(dp, tripPlaces, layers) { if (!dp || !Array.isArray(dp.places)) return [];
  const ex = DESTS[dp.id], here = new Set(ex && Array.isArray(ex.places) ? ex.places.map(q => q.id) : []), names = [];
  const pairs = addPairs(addsOf(dp.id, dp.edits, tripPlaces), dp.places.filter(p => p && typeof p === 'object'), a => !a.trip);
  pairs.forEach(([a, p]) => { a.set(addFill(a.rec(), p, layers)); dp.places = dp.places.filter(x => x !== p); names.push(a.name || p.name || '');
    if (ex && here.has(p.id)) addRemap((ex.idBase || 0) + p.id, a.trip ? a.p.id : Number(a.k)); });
  return names; }
// a trip's own places: an AI's place in trip.places that completes one of the trip's adds (its key, or an exact identity)
function addJoinTrip(t) { if (!t || !Array.isArray(t.places)) return [];
  const adds = addsOf(null, null, t.places), names = [];
  addPairs(adds, t.places.filter(p => p && typeof p === 'object' && !addKeyOf(p.id))).forEach(([a, p]) => { a.set(addFill(a.rec(), p)); t.places = t.places.filter(x => x !== p); names.push(a.name || p.name || ''); addRemap(p.id, a.p.id); });
  t.places.forEach(p => { if (p) delete p.addKey; }); return names; }
// an incoming trip or destination file, before it is installed (receiveDestination, importTripNow): the one join of every door
function addJoinFile(data, takeDests, takeTrip) { let n = 0; const t = data.kind === 'trip' && data.trip && typeof data.trip === 'object' ? data.trip : null;
  const tp = t ? (takeTrip ? t.places : ((STATE.trips[t.id] || {}).places)) : null;
  (t ? data.destinations || [] : [data.destination]).forEach(dp => { if (takeDests) n += addJoin(dp, tp).length; (dp && Array.isArray(dp.places) ? dp.places : []).forEach(p => { if (p) delete p.addKey; }); });
  if (t && takeTrip) n += addJoinTrip(t).length;
  return n; }
// the one-time merge (Q4): once per phone (upkeep.addKey) every destination and trip, and the snapshots of closed trips, after the
// undo history's base - one message naming what was merged, with undo; nothing found, nothing shown
function addMergeStored() { const u = regRead('upkeep'); if (u.addKey) return 0; const said = [];
  try { stashActive();
    Object.values(DESTS).forEach(d => { if (!d || d.builtin || d.ghost || !Array.isArray(d.places)) return;
      const dp = { id: d.id, places: d.places.slice() }, names = addJoin(dp, null, destLayersEff(d));
      if (names.length) { d.places = dp.places; said.push([names.length, 'ב' + d.meta.name]); } });
    Object.values(STATE.trips || {}).forEach(t => { const n = addJoinTrip(t).length + addMergeSnap(t); if (n) said.push([n, 'בטיול ' + String(t.name || '').split(' · ')[0]]); });
  } catch (e) { said.length = 0; }
  regWrite('upkeep', { ...regRead('upkeep'), addKey: APP_VERSION, addKeyMerged: said.length });
  if (!said.length) return 0;
  saveDests(); loadPersonal(STATE.activeTrip); applyActiveTrip(); persist();
  showUndoToast(addMergedText(said)); return said.length; }
// [[8, 'בחיפה']] -> "אוחדו 8 מקומות כפולים בחיפה"; one place: "אוחד מקום כפול אחד בחיפה"
const addMergedText = said => (said.length === 1 && said[0][0] === 1 ? 'אוחד ' : 'אוחדו ') + said.map(([n, w]) => `${n === 1 ? 'מקום כפול אחד' : n + ' מקומות כפולים'} ${w}`).join(SEP);
// a closed trip's snapshot holds its places as they were: the same merge among them, and the trip's marks follow the add
function addMergeSnap(t) { const s = t && t.archived && t.archived.snap; if (!s || !Array.isArray(s.places)) return 0;
  const adds = s.places.filter(q => q && (q.userAdded || (q.tripOnly && addKeyOf(q.id)))).map(q => ({ ...q, k: String(q.id), p: q, set: v => { Object.assign(q, v); }, rec: () => q }));
  const pairs = addPairs(adds, s.places.filter(q => q && !adds.some(a => a.p === q)));
  pairs.forEach(([a, p]) => { a.set(addFill(a.rec(), p)); s.places = s.places.filter(x => x !== p);
    const f = x => x === p.id ? a.p.id : x, td = STATE.tripData[t.id]; if (td) STATE.tripData[t.id] = { ...td, ...mapPersonalRefs(td, f) }; });
  return pairs.length; }
migRun('addKey', () => { try { addMergeStored(); } catch (e) {} }); // add-key (Q4): the places an AI update already doubled, merged once
// a trip place stores its destination's own (unshifted) layer id; falls back to the destination's lodging-type layer
function tripPlaceLayer(tp, d) {
  if (!d) return tp.layer;
  const ls = destLayersEff(d), want = d.idBase + Number(tp.layer);
  if (ls.some(l => l.id === want)) return want;
  const byType = ls.find(l => l.type === (tp.type || 'lodging')); return byType ? byType.id : (ls[0] ? ls[0].id : want);
}
function placeDiff(base, data) { const d = {}; EDIT_FIELDS.forEach(k => { if (data[k] === undefined) return; if (JSON.stringify(data[k]) !== JSON.stringify(base[k])) d[k] = data[k]; }); return d; }
// name-lead (Q6-Q7): my swap of a place's lead name ('foreign' | 'name'; null removes it) - my edit, on the place's own record: a trip's
// place itself (an update keeps it - leadKeep), a destination's place in my edits record (an update of the destination never touches it)
function leadMineSet(id, v) { const t = activeTripObj(), tp = (t.places || []).find(x => x.id === id), e = STATE.edits.places[id];
  if (tp) { if (v) tp.leadMine = v; else delete tp.leadMine; }
  else if (e && e.data) { if (v) e.data.leadMine = v; else { delete e.data.leadMine; if (e.op === 'edit' && !Object.keys(e.data).length) delete STATE.edits.places[id]; } }
  else if (v) STATE.edits.places[id] = { op: 'edit', data: { leadMine: v }, at: Date.now(), who: STATE.settings.deviceName || '' }; }
const leadKeep = (nx, old) => (nx || []).forEach(q => { const o = (old || []).find(x => x.id === q.id); if (o && o.leadMine) q.leadMine = o.leadMine; });
act('place.lead', c => { const id = Number(c.v), p = POINTS.find(x => x.id === id); if (!p || !placeForeign(p)) return;
  const nx = placeLead(p) === 'foreign' ? 'name' : 'foreign'; leadMineSet(id, nx === leadAuto(p) ? null : nx); rebuildPoints(); persist(); showUndoToast('השם המוביל הוחלף'); });
// name-lead (Q4, Q7): "שם המקומות" - the default of every place I did not swap; under it, the count of my swaps and their one reset
const NAME_LEAD = [['auto', 'אוטומטי – לפי כל מקום', 'מלון, ומקום ששמו בעברית רק תעתיק - בשם המקומי'], ['he', 'תמיד עברית'], ['local', 'תמיד השם המקומי']];
function leadSwaps(cut) { let n = 0; Object.values(STATE.trips || {}).forEach(t => (t.places || []).forEach(q => { if (q.leadMine) { n++; if (cut) delete q.leadMine; } }));
  Object.entries(STATE.edits.places).forEach(([id, e]) => { if (!e.data || !e.data.leadMine) return; n++; if (!cut) return; delete e.data.leadMine; if (e.op === 'edit' && !Object.keys(e.data).length) delete STATE.edits.places[id]; }); return n; }
function nameLeadHTML() { const n = leadSwaps();
  return choiceHTML({ list: true, label: 'השם שמוביל בכרטיסים, בתכנון ובמפה. השם השני - בחלון הפרטים', act: 'set.nameLead', cur: nameLeadSet(), attrs: v => ` data-v="${escH(v)}"`, opts: NAME_LEAD })
    + (n ? `<p class="sh-hint nl-reset">${n === 1 ? 'מקום אחד הוחלף' : n + ' מקומות הוחלפו'} ידנית${SEP}<button type="button" class="link-btn" data-act="set.nameLeadReset">איפוס</button></p>` : ''); }
act('set.nameLead', c => { const v = c.el.dataset.v; if (v === nameLeadSet()) return 'quiet'; const s = { ...STATE.settings }; if (v === 'auto') delete s.nameLead; else s.nameLead = v;
  STATE.settings = s; rebuildPoints(); persist(); showUndoToast('שם המקומות: ' + NAME_LEAD.find(x => x[0] === v)[1]); });
act('set.nameLeadReset', () => { if (!leadSwaps(true)) return 'quiet'; rebuildPoints(); persist(); showUndoToast('השמות שהוחלפו ידנית חזרו להגדרה'); });
// 4.0.0: scope 'trip' = a place of this trip only (not saved to the destination, not sent with it)
function placeFields(q) { const o = {}; ['name','foreign','nameLead','leadMine','address','description','transit','reservation','price','manualCoord','mapsUrl','icon','region','access','accessNote','coordSource','verified','source','checkedAt','recs','key','gid','quiet'].forEach(k => { if (q[k] !== undefined && q[k] !== '') o[k] = JSON.parse(JSON.stringify(q[k])); }); return o; } // 11.46.0 (phone-round-4c-fixes P4; decisions 2026-11-21 · Review of the `legal-server-fixes` summary, Q3): quiet travels with the place to a destination ("שמירה ביעד") and back
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
  if (curP && curP.aiFix) sgHandDrop(id, Object.keys(curP.aiFix).filter(f => f === 'status' ? status !== undefined && (status.s || 'active') !== (curP.status || 'active') : f in data && !sgSame(data[f], curP[f]))); // ai-fix-mine (Q6): a field I changed by hand drops its suggestion
  rebuildPoints(); persist(); 
  showUndoToast(msg);
  return id;
}
// destination-view (decisions 2026-11-26 · A destination's places without opening a trip, Q3): a destination's place across the trips that use it.
// One reading of every trip not closed, from its stored data (the open trip's mirror stashed first, so it counts too): in the plan (its days, a
// copy of the place included), ⭐ (the decision's ❤️ - the app's favourites) and "היינו". A closed trip is never read or touched: its snapshot
// keeps the place as it was (data.md).
function placeRefs(td, id) { return new Set([id, ...Object.entries(td.planItems || {}).filter(([, f]) => f && f.ref === id).map(([k]) => k)]); }
function placeTripsUse(id) { stashActive(); const out = [];
  Object.values(STATE.trips).forEach(t => { if (!t || t.archived) return; const td = STATE.tripData[t.id] || {}, refs = placeRefs(td, id), days = [];
    Object.entries(td.itinerary || {}).forEach(([dk, day]) => { if (day && Object.values(day).some(a => Array.isArray(a) && a.some(x => refs.has(x)))) days.push(dk); });
    const fav = (td.favorites || []).includes(id), vis = (td.visited || []).includes(id);
    if (days.length || fav || vis) out.push({ t, days, fav, vis }); });
  return out; }
// "בשימוש בטיולים: חיפה 2026 (בתוכנית, יום 2) · חיפה עם ההורים (מועדפים)" - '' when no trip uses it
function placeUseLine(id) { const u = placeTripsUse(id); if (!u.length) return '';
  return 'בשימוש בטיולים: ' + u.map(x => { const n = x.days.map(k => /^d\d+$/.test(k) ? +k.slice(1) : 0).filter(Boolean).sort((a, b) => a - b);
    const w = [x.days.length ? 'בתוכנית' + (n.length ? (n.length > 1 ? ', ימים ' : ', יום ') + n.join(', ') : '') : '', x.fav ? TX.fav : '', x.vis ? TX.visited : ''].filter(Boolean).join(', ');
    return `${String(x.t.name).split(' · ')[0]} (${w})`; }).join(SEP); }
// a destination's place deleted: out of the plan, ⭐ and "היינו" of every trip not closed; what each trip had marked is returned for the trash
function placeOutOfTrips(id) { stashActive(); const marks = {};
  Object.values(STATE.trips).forEach(t => { if (!t || t.archived) return; const td = STATE.tripData[t.id]; if (!td) return; const refs = placeRefs(td, id);
    const fav = (td.favorites || []).includes(id), vis = (td.visited || []).includes(id);
    if (fav) td.favorites = td.favorites.filter(x => x !== id); if (vis) td.visited = td.visited.filter(x => x !== id);
    Object.values(td.itinerary || {}).forEach(day => { if (day) Object.keys(day).forEach(k => { if (Array.isArray(day[k]) && day[k].some(x => refs.has(x))) day[k] = day[k].filter(x => !refs.has(x)); }); });
    Object.keys(td.times || {}).forEach(k => { const i = k.indexOf('|'); if (i > 0 && refs.has(pid(k.slice(i + 1)))) delete td.times[k]; });
    if (fav || vis) marks[t.id] = { fav, vis }; });
  loadPersonal(STATE.activeTrip); return marks; }
// the trash's restore: each trip's marks back (a trip closed or gone since keeps what it has)
function placeMarksBack(t) { if (!t.marks) { if (t.fav) STATE.favorites.add(t.id); if (t.vis) STATE.visited.add(t.id); return; } stashActive();
  Object.entries(t.marks).forEach(([tid, m]) => { const tr = STATE.trips[tid], td = STATE.tripData[tid]; if (!tr || tr.archived || !td) return;
    if (m.fav && !(td.favorites || []).includes(t.id)) td.favorites = (td.favorites || []).concat(t.id);
    if (m.vis && !(td.visited || []).includes(t.id)) td.visited = (td.visited || []).concat(t.id); });
  loadPersonal(STATE.activeTrip); }
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
    const p = POINTS.find(x => x.id === id) || b, name = p.name || b.name, marks = placeOutOfTrips(id); // destination-view (Q3): every trip not closed
    STATE.trash.push({ kind: 'destPlace', id, entry: { data: { name } }, prev: STATE.edits.places[id] || null, st: STATE.edits.status[id] || null, at: Date.now(), marks });
    STATE.edits.places[id] = { op: 'del', data: { name: b.name }, at: Date.now(), who: STATE.settings.deviceName || '' }; delete STATE.edits.status[id];
    STATE.favorites.delete(id); STATE.visited.delete(id);
    TRIP_DAYS.forEach(d => { const day = STATE.itinerary[d.key]; if (day) Object.keys(day).forEach(k => { day[k] = day[k].filter(x => x !== id); }); delete STATE.times[d.key + '|' + id]; });
    rebuildPoints(); persist();
    showUndoToast(SY.del + ' הועבר לסל המחזור: ' + name);
    return;
  }
  const e = STATE.edits.places[id]; if (!e || e.op !== 'add') return;
  const marks = placeOutOfTrips(id); // destination-view (Q3): a place I added to the destination - out of every trip not closed too
  STATE.trash.push({ id, entry: e, at: Date.now(), marks });
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
    placeMarksBack(t);
    rebuildPoints(); persist();
    showUndoToast('שוחזר מהסל: ' + t.entry.data.name); } },
  place: { row: 'edits', into: deleteAddedPlace, back(t, i) { STATE.edits.places[t.id] = t.entry; STATE.trash.splice(i, 1);
    placeMarksBack(t);
    rebuildPoints(); persist(); 
    showUndoToast('שוחזר מהסל: ' + t.entry.data.name); } },
};
function restoreFromTrash(id) {
  const i = STATE.trash.findIndex(t => t.id === id); if (i < 0) return;
  const t = STATE.trash[i]; TRASH_KINDS[t.kind || 'place'].back(t, i);
}


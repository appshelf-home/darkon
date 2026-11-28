// ================= FILES: building a trip or destination file and installing one (management group, diet-groups 11.62.0; references and delivery: js/file-deliver.js) =================
function buildTripFile(id, picks, noDates, goal, rec) { // rec (prev-recs): { mine } - the share window's box; { keepIds } for my other phone
  stashActive(); let t = STATE.trips[id], td = STATE.tripData[id] || {};
  if (noDates && t.start) { // 4.38.0: a sample trip for a friend - by days, without my dates (my bookings and mementos stay with me)
    t = JSON.parse(JSON.stringify(t)); td = JSON.parse(JSON.stringify(td)); const segs = segLensOf(t);
    rebuildTripDays(t, { mode: 'none', segs, wd: String(tmWeekday(t.start)) }, td); delete td.parked; picks = picks.filter(k => k !== 'bookings' && k !== 'mementos'); }
  let personal = {}; // the rows of the chosen parts (ק4), each field by its row in the registry
  picks.forEach(k => (PART_BY[k] || { rows: [] }).rows.forEach(r => (REG_BY[r].where.td || []).forEach(f => { if (td[f] !== undefined && f !== 'flightsSeeded' && f !== 'tl') personal[f] = td[f]; }))); // 11.9.0 (timeline-import, Q4): a friend's file has no path or visit times (tl)
  if (!picks.includes('companions')) { delete personal.companions; if (personal.highlights) personal.highlights = personal.highlights.map(({ by, ...h }) => h); } // hidden-data (H4): a fellow traveller's marks only when the window names them
  if (goal === 'improve') delete personal.hidden; // hidden-data (H6): the AI needs no hides of mine (they reach it as the edits' "skip")
  personal = Object.keys(personal).length ? { ...mapPersonalRefs(personal, x => portableRef(x, t)), refs: 'dest' } : null;
  const out = { app: BACKUP_APP, kind: 'trip', format: 1, appVersion: APP_VERSION, createdAt: new Date().toISOString(), device: STATE.settings.deviceName || '', signature: `${t.name} · טיול · ${tmFmt('date', Date.now())} · v${APP_VERSION}`,
    trip: tvStopsOut(schedRefsOut(JSON.parse(JSON.stringify(t)), t), t), destinations: tripDests(t).map(did => destPayload(DESTS[did], picks.includes('edits'), t.start)), personal };
  if (personal && personal.planItems) out.minAppVersion = BACKUP_MIN_APP; // 10.0.0: an older app would drop the notes silently
  if (picks.includes('mementos')) { const m = tripMementosOut(id); if (m) out.mementos = m; }
  if (goal === 'improve') { out.unlocated = unlocatedOut(placesOffMapIn(t)); out.infoMissing = infoMissingOut(tripDests(t)); } // ה8: the places off the map go by themselves; 11.43.0 (info-complete, item 3): and the missing general info sections
  recOut(out, { mine: !!(rec && rec.mine), trips: [STATE.trips[id]], keepIds: !!(rec && rec.keepIds) }); // prev-recs (Q12, Q6): others' summary always, mine when checked; the recId only to my other phone
  if (!(rec && rec.keepIds)) sgDropAll(out); // ai-fix-mine (item 5): the suggestions left open go only to my other phone - never to a friend or an AI
  return withClaude(out, goal === 'improve' ? 'improve' : null);
}
// kit-fixes (A2.1): a program line that names a destination's place holds this device's number (schedToDevice); in a file it goes as
// "@dest:id" (reference/file-format.md "Place references"), so it is found again on any phone and by the file's own check. A
// destination numbered as in its file (idBase 0) keeps the plain number.
function schedRefsOut(c, t) { (c.schedule || []).forEach(s => { if (!s || typeof s.placeId !== 'number') return; const r = portableRef(s.placeId, t);
  if (typeof r === 'string' && Number(r.slice(r.lastIndexOf(':') + 1)) !== s.placeId) s.placeId = r; }); return c; }
function buildDestinationFile(id, withEdits, improve, rec) {
  const d = DESTS[id], keep = !!(rec && rec.keepIds), dropFix = o => keep ? o : sgDropAll(o); // ai-fix-mine (item 5): as a trip's file
  return withClaude(dropFix(recOut({ app: BACKUP_APP, kind: 'destination', format: 1, appVersion: APP_VERSION, createdAt: new Date().toISOString(), device: STATE.settings.deviceName || '', signature: `${d.meta.name} · יעד · ${tmFmt('date', Date.now())} · v${APP_VERSION}`, destination: destPayload(d, !!withEdits), ...(improve ? { unlocated: unlocatedOut(placesOffMap(id)[id] || []), infoMissing: infoMissingOut([id]) } : {}) }, { mine: !!(rec && rec.mine), trips: recTripsOfDest(id) })), improve ? 'improve' : null); // prev-recs: each closed trip of mine that touched it, when checked
}
function destPayload(d, withEdits, onDate) {
  const out = { id: d.id, version: d.version || 1, meta: d.meta, places: d.places, info: d.info }; // 11.7.0 (the 11.5.0 review's miss c; the owner, 12.11.2026): the destination's version goes out with it, as the file format requires - validate.py failed on every file the app wrote
  if (withEdits) { const ids = new Set(d.places.map(p => d.idBase + p.id)); const e = { places: {}, status: {} };
    Object.entries(STATE.edits.places).forEach(([id, x]) => { if (ids.has(Number(id)) || (x.op === 'add' && x.data.dest === d.id)) e.places[id] = x; });
    Object.entries(STATE.edits.status).forEach(([id, x]) => { if (ids.has(Number(id)) || (STATE.edits.places[id] && STATE.edits.places[id].data.dest === d.id)) e.status[id] = x; });
    const lids = new Set(d.meta.layers.map(l => d.idBase + l.id)); e.layers = {};
    Object.entries(STATE.edits.layers).forEach(([id, x]) => { if (lids.has(Number(id)) || (x.op === 'add' && x.data.dest === d.id)) e.layers[id] = x; });
    if (STATE.edits.layerOrder[d.id]) e.layerOrder = STATE.edits.layerOrder[d.id];
    out.edits = e; out.idBase = d.idBase; }
  return out;
}
function installDestination(dp) {
  // returns 'new' | 'updated' | 'same'; existing destinations keep their idBase (and the device's edits)
  const ex = DESTS[dp.id];
  if (ex && ex.builtin) return 'same';
  if (ex) dp = { ...dp, places: sgKeep(ex.places, recsKeep(ex.places, dp.places)) }; // ai-fix-mine (item 5): the suggestions left open on its places stay; prev-recs (Q11): the summary on this phone stays and the file's joins it, by contribution (an AI's file brings none)
  if (ex && JSON.stringify(ex.places) === JSON.stringify(dp.places) && JSON.stringify(ex.meta) === JSON.stringify(dp.meta) && (ex.info || '') === (dp.info || '')) return 'same'; // 4.36.2: a change only in the info, layers or name is an update too
  const known = STATE.destBases[dp.id], taken = Object.values(DESTS).some(d => d.id !== dp.id && (d.idBase || 0) === known);
  const idBase = ex ? ex.idBase : (known != null && !taken ? known : Math.max(0, ...Object.values(DESTS).map(d => d.idBase || 0), ...Object.values(STATE.destBases)) + 1e6);
  STATE.destBases[dp.id] = idBase;
  const meta = ex && ex.meta && ex.meta.tzManual && tmZoneOk(ex.meta.timeZone) ? { ...dp.meta, timeZone: ex.meta.timeZone, tzManual: 1 } : dp.meta; // 7.0.0 (ז11): my clock stays
  if (ex) gidDropMovedDest(ex, dp); // gid-fixes item 5: a place the new file moves more than 150 m loses my 'app' record
  DESTS[dp.id] = { id: dp.id, version: dp.version || 1, idBase, meta, places: dp.places, info: dp.info || '', at: Date.now() }; // trip-cards (Q7): `at` - when it came in or was updated, for its row's "עודכן" (stays on the phone: destPayload sends none) // kit-fixes (A2.3): the file's version is kept, and goes out as it is (destPayload)
  saveDests(); return ex ? 'updated' : 'new';
}
// kit-fixes (A2.2, A6.2; decisions 2026-11-22 · Review of the `kit-review` report, Q3): the edits of a file are keyed by the sending
// phone's numbers (its idBase + the place's or layer's own number; a thing added on a phone keeps its own big number). When none of
// those keys lines up with the file's idBase, the idBase was changed after the app sent it (an AI that wrote 0 and kept the edits):
// the edits are never shifted by it - they are taken as not in the file, and the user's edits already on this phone stay as they are.
function destEditsAligned(dp) { const b = dp.idBase || 0, E = dp.edits || {}, own = (a) => new Set((Array.isArray(a) ? a : []).filter(x => x && typeof x === 'object').map(x => b + x.id));
  const pl = own(dp.places), ly = own((dp.meta || {}).layers), hit = [];
  [[E.places, pl], [E.status, pl], [E.layers, ly]].forEach(([o, set]) => Object.entries(o && typeof o === 'object' ? o : {}).forEach(([k, x]) => { const n = Number(k); if (!(x && x.op === 'add') && n < 1e11) hit.push(set.has(n)); }));
  return !hit.length || hit.some(Boolean); }
function mergeDestEdits(dp, into, take) {
  const tk = (k, id) => !!(take && take.has(k + ':' + id)); // 8.0.0 (ק22): what was edited here too stays mine, unless chosen from the file
  // edits in a file use the sender's ids; map them by the destination's idBase on this device
  if (!dp.edits || !destEditsAligned(dp)) return 0; const shift = (DESTS[dp.id].idBase || 0) - (dp.idBase || 0); let n = 0;
  const sh = v => typeof v === 'number' && v < 1e11 ? v + shift : v; // pack ids shift; ids of things added on a phone (Date.now) don't
  into.layers = into.layers || {}; into.layerOrder = into.layerOrder || {};
  Object.entries(dp.edits.places || {}).forEach(([id, x]) => { const nid = x.op === 'add' ? Number(id) : Number(id) + shift; if (!into.places[nid] || tk('place', nid)) { const data = { ...x.data, ...(x.data && x.data.layer != null ? { layer: sh(x.data.layer) } : {}) }; into.places[nid] = x.op === 'add' ? { ...x, data: { ...data, dest: dp.id } } : { ...x, data }; n++; } });
  Object.entries(dp.edits.layers || {}).forEach(([id, x]) => { const nid = x.op === 'add' ? Number(id) : Number(id) + shift; if (!into.layers[nid] || tk('layer', nid)) { into.layers[nid] = x.op === 'add' ? { ...x, data: { ...x.data, dest: dp.id } } : x; n++; } });
  if (dp.edits.layerOrder && (!into.layerOrder[dp.id] || tk('order', dp.id))) { into.layerOrder[dp.id] = dp.edits.layerOrder.map(sh); n++; }
  Object.entries(dp.edits.status || {}).forEach(([id, x]) => { const nid = STATE.edits.places[id] && STATE.edits.places[id].op === 'add' ? Number(id) : Number(id) + shift; if (!into.status[nid] || tk('status', nid)) { into.status[nid] = x; n++; } });
  return n;
}

// file-over-existing (Q2; decisions 2026-11-26 · An updated trip file for a trip already on the phone): a full file of a trip on the phone is
// applied as an answer to "עדכון עם AI" is - the file's trip takes the trip's place, so before the join what I did in the trip's own places
// goes into it: a place I added on a phone (its key, addKeyOf) that the file does not carry comes with it (an AI's answer carries it - its
// completion then joins it by the key); a point I fixed by hand ("תיקון ידני") and a place I hid in the trip stay mine. A destination's
// places need nothing here: my edits, marks and hides of them are records of this phone that an update never touches.
function tripMineKeep(nt, was, ai) { if (!nt || !was || !Array.isArray(was.places)) return; nt.places = Array.isArray(nt.places) ? nt.places : [];
  was.places.forEach(o => { if (!o || typeof o !== 'object') return; const p = nt.places.find(q => q && q.id === o.id);
    if (!p) { if (addKeyOf(o.id)) nt.places.push(JSON.parse(JSON.stringify(o))); return; }
    if (o.manualCoord && o.coordSource === 'תיקון ידני') { p.manualCoord = { ...o.manualCoord }; p.coordSource = o.coordSource; }
    if (o.status && !p.status) { p.status = o.status; p.statusNote = o.statusNote || ''; }
    if (o.aiFix && !p.aiFix) p.aiFix = JSON.parse(JSON.stringify(o.aiFix)); // ai-fix-mine (item 5): the suggestions left open on it stay
    if (ai && addKeyOf(o.id)) SG_FIELDS.forEach(f => { if (f !== 'status' && !sgEmpty(o[f])) p[f] = JSON.parse(JSON.stringify(o[f])); }); }); } // ai-fix-mine (item 2): a place I added keeps what I set in it - an AI's other value comes as a suggestion
// 4.2.0: installs a trip file (new / update / copy); also the last step of approving a trip draft
// undo-history: no undo of its own - the history restores the draft, the trips, the edits, the destinations and the mementos
function importTripNow(data, mode, afterInstall, tail, opt) {
      opt = opt || {}; const pk = k => !opt.picks || opt.picks.includes(k), t = data.trip;
      sgStrip(data); // ai-fix-mine: an AI's suggestions are the receive window's rows (opt.sg) - never stored as they came
      const snap = mode === 'update' && STATE.trips[t.id] ? placesSnap(data) : null; // file-over-existing (Q4): the places the file changes, counted in the message
      if (mode === 'update' && pk('trip')) tripMineKeep(t, STATE.trips[t.id], fileFromAI(data)); // file-over-existing (Q2): what I did in the trip's own places stays, whatever the file carries
      const nj = addJoinFile(data, pk('dests'), pk('trip')); // add-key (Q3): a place an AI completed for one I added joins mine, before anything is installed
      (data.destinations || []).forEach(dp => { if (pk('dests') || !DESTS[dp.id]) installDestination(dp); }); // 8.0.0 (ק18): an unchecked part stays as it is
      if (afterInstall) afterInstall();
      let n = 0; if (pk('edits')) { const edits = JSON.parse(JSON.stringify(STATE.edits)); (data.destinations || []).forEach(dp => { n += mergeDestEdits(dp, edits, opt.take); }); STATE.edits = edits; ensureEditsShape(); }
      stashActive();
      const nid = opt.asBase ? 't_base' + Date.now().toString(36) : mode === 'copy' ? 't_' + Date.now().toString(36) : t.id, keepTrip = mode === 'update' && !pk('trip') && STATE.trips[nid];
      if (!keepTrip) {
        const oldArch = mode === 'copy' ? null : (STATE.trips[nid] || {}).archived; const oldLod = mode === 'copy' ? [] : ((STATE.trips[nid] || {}).lodging || []), oldSch = mode === 'copy' ? [] : ((STATE.trips[nid] || {}).schedule || []);
        const was = mode === 'copy' ? null : STATE.trips[nid];
        STATE.trips[nid] = { ...JSON.parse(JSON.stringify(t)), id: nid, name: mode === 'copy' ? t.name + ' (עותק)' : t.name };
        if (was) leadKeep(STATE.trips[nid].places, was.places); // name-lead (Q8): an update may change a place's mark, never my swap
        recTripIn(STATE.trips[nid], was, mode === 'copy'); // prev-recs: an update keeps the trip's own contribution id and its places' summary; a copy is a trip of its own
        STATE.trips[nid].lodging = (STATE.trips[nid].lodging || []).map(l => { const o = oldLod.find(x => x.id === l.id); if (!o) return l; const keep = {}; LODGING_USER_FIELDS.forEach(f => { if (o[f] && !l[f]) keep[f] = o[f]; }); return { ...l, ...keep }; }); // 4.18.0: an updated trip keeps what you added to its hotels
        lodgingToDevice(STATE.trips[nid]); schedToDevice(STATE.trips[nid]); // 9.3.0 (ס11); kit-fixes (A2.1): a program line's destination place too
        normalizeTrip(STATE.trips[nid], [].concat(...(data.destinations || []).map(dp => (dp.places || []).map(q => ({ ...q, id: (dp.idBase || 0) + q.id, dest: dp.id })))));
        schedPathsKeep(STATE.trips[nid].schedule, oldSch); // 11.4.0 (the 11.2.0 review's miss): a group travel's kept path survives the update
        if (STATE.trips[nid].archived && !(mode === 'update' && oldArch && !oldArch.recv)) STATE.trips[nid].archived.recv = 1; // passport-book (Q6): a trip received closed is another's memory - it stamps no passport (closed here again after a reopen, it does)
      }
      const hn = opt.asBase ? 0 : hotelsToTrips([STATE.trips[nid]]); // 9.3.0 (ס11): a hotel is always the trip's - moved here, told in the toast, undone with it
      if (mode !== 'update' || !STATE.tripData[nid]) STATE.tripData[nid] = { favorites: [], visited: [], itinerary: {}, times: {}, planItems: {}, flightsSeeded: true };
      const inc = personalFromFile(data); // 4.2.1: the file's ids -> this device's ids
      if (inc) PARTS.filter(p => pk(p.id) && p.id !== 'trip').forEach(p => p.rows.forEach(r => { const fs = REG_BY[r].where.td; if (!fs) return; const x = {}; fs.forEach(f => { if (inc[f] !== undefined) x[f] = inc[f]; }); if (!Object.keys(x).length) return;
        STATE.tripData[nid] = mode === 'update' ? rowMerge(r, STATE.tripData[nid], JSON.parse(JSON.stringify(x))) : { ...STATE.tripData[nid], ...JSON.parse(JSON.stringify(x)) }; })); // ק18: added, nothing deleted
      if (pk('mementos') && !opt.asBase && data.mementos && data.mementos.items) { const items = JSON.parse(mapPicTokens(JSON.stringify(data.mementos.items), deviceRef));
        Object.entries(items).forEach(([k, v]) => { const key = mode === 'copy' ? k.replace(/^((?:photo|pimg):)[^:]+:/, '$1' + nid + ':').replace(/^art:.+$/, 'art:' + nid) : k; if (mode !== 'update' || !MEMO.has(key)) MEMO_DB.put(key, v); }); }
      travelOrphansOut(STATE.trips[nid], STATE.tripData[nid]); // 11.0.0 (Q16): a travel merged into its program line
      // trip-base-plus (Q2, Q9, Q17): a draft taken as the base of a new trip - its destinations are in (above, as on "אישור הכל"); the trip in this
      // phone's form goes to the new trip's maker and is not kept (no hotel moved to it, no mementos, no proposal)
      if (opt.asBase) { const bt = STATE.trips[nid], btd = STATE.tripData[nid]; delete STATE.trips[nid]; delete STATE.tripData[nid]; if (t.id) bt.id = t.id; /* archive-redraw item 6: the base keeps its own trip's id - its contribution's id derives from it (recBaseId), so the same base gives the same id, and its owner's phone knows it (recMine) */ opt.asBase(bt, btd, `${n ? ` (+${n} עריכות)` : ''}${tail ? ` (${tail})` : ''}${addJoinedText(nj)}`); return; }
      sgApply(opt.sg); // ai-fix-mine (items 4-5): each suggestion of the window on its place, with its mark (the same undo row)
      infoSpotClear(); // back-exit 2b: a file update stays on its screen, at its top, with the bar
      if (nid === STATE.activeTrip) { loadPersonal(nid); applyActiveTrip(); syncFlightsToPlan(); persist(); updateHeader(); pageTop(); navShow(); } else { persist(); switchTrip(nid, true); }
      if (pk('plan')) viaGroup('proposal', 'propAfterImport', data, nid, opt.propGone); // 11.5.0 (schedule-proposal): a proposal that came in the file waits in the plan (the same undo row)
      showUndoToast(`${mode === 'update' ? 'עודכן' : mode === 'replace' ? 'הוחלף' : 'נוסף'} טיול: ${STATE.trips[nid].name}${placesUpdatedText(snap, data)}${n ? ` (+${n} עריכות)` : ''}${tail ? ` (${tail})` : ''}${addJoinedText(nj)}${hotelsMovedText(hn)}`);
}


// ---- files: destination & trip ----
// 4.2.1: place references in a file that leaves the device are written relative to their destination ("@dest:localId").
// Every phone numbers an imported destination its own way (idBase), so device ids would point at the wrong places.
function portableRef(id, t) {
  if (typeof id !== 'number' || id >= 1e11) return id;              // notes and copies (plan items), places added on a phone
  if ((t.places || []).some(p => p.id === id)) return id;           // trip places keep their own ids
  for (const did of tripDests(t)) { const d = DESTS[did]; const loc = id - (d.idBase || 0); if (loc >= 0 && d.places.some(p => p.id === loc)) return '@' + did + ':' + loc; }
  return id;
}
function deviceRef(ref) { // "@dest:id" -> this device's id (null when the destination isn't here)
  if (typeof ref !== 'string' || ref[0] !== '@') return ref;
  const m = ref.match(/^@(.+):(\d+)$/); if (!m || !DESTS[m[1]]) return null; return (DESTS[m[1]].idBase || 0) + Number(m[2]);
}
function mapPersonalRefs(p, f) { // apply f to every place reference in personal data; null drops it
  if (!p) return p; const arr = a => (a || []).map(f).filter(x => x != null); const out = { ...p };
  ['favorites', 'visited', 'notReached', 'hidden'].forEach(k => { if (p[k]) out[k] = arr(p[k]); });
  const keys = o => { const r = {}; Object.entries(o || {}).forEach(([k, v]) => { const x = f(/^\d+$/.test(k) ? Number(k) : k); if (x != null) r[x] = v; }); return r; }; // 8.0.0
  if (p.bookings) out.bookings = keys(p.bookings); if (p.rating) out.rating = keys(p.rating);
  if (p.highlights) out.highlights = p.highlights.map(h => ({ ...h, placeId: h.placeId != null ? f(h.placeId) : null }));
  if (p.companions) out.companions = Object.fromEntries(Object.entries(p.companions).map(([n, x]) => [n, { ...x, visited: arr(x.visited), rating: keys(x.rating), highlights: (x.highlights || []).map(h => ({ ...h, placeId: h.placeId != null ? f(h.placeId) : null })) }]));
  ['pic', 'photoOrder'].forEach(k => { if (p[k] != null) out[k] = JSON.parse(mapPicTokens(JSON.stringify(p[k]), f)); });
  if (p.itinerary) { out.itinerary = {}; Object.entries(p.itinerary).forEach(([day, slots]) => { out.itinerary[day] = {}; Object.entries(slots || {}).forEach(([k, a]) => { out.itinerary[day][k] = arr(a); }); }); }
  if (p.planX) { const mt = t => { if (/^\d+$/.test(t)) { const r = f(Number(t)); return r == null ? null : String(r); } if (t[0] === '@') { const r = f(t); return r == null ? null : String(r); } return t; }; // 4.22.0
    const anchors = {};
    Object.entries(p.planX.anchors || {}).forEach(([day, m]) => { anchors[day] = {}; Object.entries(m || {}).forEach(([k, v]) => { const rk = mt(k), rv = mt(v); if (rk != null) anchors[day][rk] = rv == null ? '^' : rv; }); });
    out.planX = { ...p.planX, anchors }; delete out.planX.locks; }
  if (p.proposal) { const days = {}; Object.entries(p.proposal.days || {}).forEach(([k, d]) => { days[k] = { ...d, items: (d.items || []).map(x => ({ ...x, id: f(x.id) })).filter(x => x.id != null) }; }); out.proposal = { ...p.proposal, days }; } // 11.5.0 (schedule-proposal)
  if (p.times) { out.times = {}; Object.entries(p.times).forEach(([k, v]) => { const i = k.indexOf('|'); const raw = k.slice(i + 1); const r = f(/^\d+$/.test(raw) ? Number(raw) : raw); if (r != null) out.times[k.slice(0, i) + '|' + r] = v; }); }
  return out;
}
// personal data of a trip file (refs:'dest' - relative to its destinations) -> ids of this device
function personalFromFile(data) {
  const p = data.personal; if (!p) return null;
  const o = mapPersonalRefs(planItemsUp(p), deviceRef); delete o.refs; return o;
}
// add incoming personal data to a trip's data: adds what is missing, never removes anything
function mergePersonal(td, inc) {
  td.favorites = [...new Set([...(td.favorites || []), ...(inc.favorites || [])])];
  td.visited = [...new Set([...(td.visited || []), ...(inc.visited || [])])];
  td.itinerary = td.itinerary || {}; Object.entries(inc.itinerary || {}).forEach(([day, slots]) => { const dd = td.itinerary[day] = td.itinerary[day] || { unassigned: [], morning: [], afternoon: [], evening: [] };
    Object.keys(slots || {}).forEach(k => { dd[k] = dd[k] || []; (slots[k] || []).forEach(id => { if (!Object.values(dd).some(a => a.includes(id))) dd[k].push(id); }); }); });
  td.times = { ...(inc.times || {}), ...(td.times || {}) }; td.planItems = { ...(inc.planItems || {}), ...(td.planItems || {}) };
  if (inc.planX) { const a = td.planX = td.planX || {}, b = inc.planX; // 4.22.0: what is here wins
    a.sched = { ...(b.sched || {}), ...(a.sched || {}) };
    a.anchors = a.anchors || {}; Object.entries(b.anchors || {}).forEach(([day, m]) => { a.anchors[day] = { ...(m || {}), ...(a.anchors[day] || {}) }; });
    if (b.routeHide) { const ra = a.routeHide || {}, rb = b.routeHide; a.routeHide = { stops: { ...(rb.stops || {}), ...(ra.stops || {}) }, legs: { ...(rb.legs || {}), ...(ra.legs || {}) } }; } } // 4.24.0
  return td;
}
function buildTripFile(id, picks, noDates, goal) {
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
  return withClaude(out, goal === 'improve' ? 'improve' : null);
}
// kit-fixes (A2.1): a program line that names a destination's place holds this device's number (schedToDevice); in a file it goes as
// "@dest:id" (reference/file-format.md "Place references"), so it is found again on any phone and by the file's own check. A
// destination numbered as in its file (idBase 0) keeps the plain number.
function schedRefsOut(c, t) { (c.schedule || []).forEach(s => { if (!s || typeof s.placeId !== 'number') return; const r = portableRef(s.placeId, t);
  if (typeof r === 'string' && Number(r.slice(r.lastIndexOf(':') + 1)) !== s.placeId) s.placeId = r; }); return c; }
function buildDestinationFile(id, withEdits, improve) {
  const d = DESTS[id];
  return withClaude({ app: BACKUP_APP, kind: 'destination', format: 1, appVersion: APP_VERSION, createdAt: new Date().toISOString(), device: STATE.settings.deviceName || '', signature: `${d.meta.name} · יעד · ${tmFmt('date', Date.now())} · v${APP_VERSION}`, destination: destPayload(d, !!withEdits), ...(improve ? { unlocated: unlocatedOut(placesOffMap(id)[id] || []), infoMissing: infoMissingOut([id]) } : {}) }, improve ? 'improve' : null);
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
async function shareJson(obj, name) {
  return deliverFile(new Blob([JSON.stringify(obj, null, 1)], { type: 'application/json' }), name);
}
// 3.2.0: the phone's share sheet when there is one; inside Claude the viewer's download capability; else a plain download
// phone-round-1-fixes P6 (G7): Chrome shares only the file types of its Web Share list (Chromium ShareServiceImpl.java on Android,
// share_service_impl.cc on Windows/macOS/ChromeOS: the name's extension AND the exact MIME type must be on it - .txt + text/plain
// are, .json / application/json and .zip are not). canShare() does not check the list: share() refuses with NotAllowedError, after
// the tap's activation is spent, so there is no second try - the type is chosen before. A JSON file goes to the share sheet as
// text/plain named <name>.json.txt (every door reads a file by its content, never its name); a download keeps <name>.json.
function shareFileAs(name, type) { return type === 'application/json' ? { name: name.replace(/(\.json)?$/i, '.json.txt'), type: 'text/plain' } : { name, type }; }
async function deliverFile(blob, name, type) {
  type = type || 'application/json';
  try { const s = shareFileAs(name, type), f = new File([blob], s.name, { type: s.type }); if (navigator.canShare && navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], title: name }); return true; } } catch (e) { if (e && e.name === 'AbortError') return false; }
  if (window.claude && typeof window.claude.use === 'function') {
    let dl = null; try { dl = await window.claude.use('downloads'); } catch (e) {}
    if (dl) { try { await dl.save({ filename: name, data: blob }); return true; } catch (e) { if (!e || e.code !== 'declined') showToast('לא הצלחתי לשמור את הקובץ כאן'); return false; } }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); return true;
}
// one-way (10): a text goes out the same way - the share sheet, or where there is none (or it fails) the clipboard with msg
// (copyWithFallback). Resolves true (shared), false (copied) or null (the user closed the sheet: nothing went out).
function deliverText(text, msg) { return (navigator.share ? navigator.share({ text }).then(() => true).catch(e => e && e.name === 'AbortError' ? null : false) : Promise.resolve(false)).then(ok => { if (ok === false) copyWithFallback(text, msg); return ok; }); }
const fileStamp = () => tmFmt('date', Date.now()).replace(/\./g, '-');
function installDestination(dp) {
  // returns 'new' | 'updated' | 'same'; existing destinations keep their idBase (and the device's edits)
  const ex = DESTS[dp.id];
  if (ex && ex.builtin) return 'same';
  if (ex && JSON.stringify(ex.places) === JSON.stringify(dp.places) && JSON.stringify(ex.meta) === JSON.stringify(dp.meta) && (ex.info || '') === (dp.info || '')) return 'same'; // 4.36.2: a change only in the info, layers or name is an update too
  const known = STATE.destBases[dp.id], taken = Object.values(DESTS).some(d => d.id !== dp.id && (d.idBase || 0) === known);
  const idBase = ex ? ex.idBase : (known != null && !taken ? known : Math.max(0, ...Object.values(DESTS).map(d => d.idBase || 0), ...Object.values(STATE.destBases)) + 1e6);
  STATE.destBases[dp.id] = idBase;
  const meta = ex && ex.meta && ex.meta.tzManual && tmZoneOk(ex.meta.timeZone) ? { ...dp.meta, timeZone: ex.meta.timeZone, tzManual: 1 } : dp.meta; // 7.0.0 (ז11): my clock stays
  if (ex) gidDropMovedDest(ex, dp); // gid-fixes item 5: a place the new file moves more than 150 m loses my 'app' record
  DESTS[dp.id] = { id: dp.id, version: dp.version || 1, idBase, meta, places: dp.places, info: dp.info || '' }; // kit-fixes (A2.3): the file's version is kept, and goes out as it is (destPayload)
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

// 4.2.0: installs a trip file (new / update / copy); also the last step of approving a trip draft
// undo-history: no undo of its own - the history restores the draft, the trips, the edits, the destinations and the mementos
function importTripNow(data, mode, afterInstall, tail, opt) {
      opt = opt || {}; const pk = k => !opt.picks || opt.picks.includes(k), t = data.trip;
      const nj = addJoinFile(data, pk('dests'), pk('trip')); // add-key (Q3): a place an AI completed for one I added joins mine, before anything is installed
      (data.destinations || []).forEach(dp => { if (pk('dests') || !DESTS[dp.id]) installDestination(dp); }); // 8.0.0 (ק18): an unchecked part stays as it is
      if (afterInstall) afterInstall();
      let n = 0; if (pk('edits')) { const edits = JSON.parse(JSON.stringify(STATE.edits)); (data.destinations || []).forEach(dp => { n += mergeDestEdits(dp, edits, opt.take); }); STATE.edits = edits; ensureEditsShape(); }
      stashActive();
      const nid = mode === 'copy' ? 't_' + Date.now().toString(36) : t.id, keepTrip = mode === 'update' && !pk('trip') && STATE.trips[nid];
      if (!keepTrip) {
        const oldArch = mode === 'copy' ? null : (STATE.trips[nid] || {}).archived; const oldLod = mode === 'copy' ? [] : ((STATE.trips[nid] || {}).lodging || []), oldSch = mode === 'copy' ? [] : ((STATE.trips[nid] || {}).schedule || []);
        STATE.trips[nid] = { ...JSON.parse(JSON.stringify(t)), id: nid, name: mode === 'copy' ? t.name + ' (עותק)' : t.name };
        STATE.trips[nid].lodging = (STATE.trips[nid].lodging || []).map(l => { const o = oldLod.find(x => x.id === l.id); if (!o) return l; const keep = {}; LODGING_USER_FIELDS.forEach(f => { if (o[f] && !l[f]) keep[f] = o[f]; }); return { ...l, ...keep }; }); // 4.18.0: an updated trip keeps what you added to its hotels
        lodgingToDevice(STATE.trips[nid]); schedToDevice(STATE.trips[nid]); // 9.3.0 (ס11); kit-fixes (A2.1): a program line's destination place too
        normalizeTrip(STATE.trips[nid], [].concat(...(data.destinations || []).map(dp => (dp.places || []).map(q => ({ ...q, id: (dp.idBase || 0) + q.id, dest: dp.id })))));
        schedPathsKeep(STATE.trips[nid].schedule, oldSch); // 11.4.0 (the 11.2.0 review's miss): a group travel's kept path survives the update
        if (STATE.trips[nid].archived && !(mode === 'update' && oldArch && !oldArch.recv)) STATE.trips[nid].archived.recv = 1; // passport-book (Q6): a trip received closed is another's memory - it stamps no passport (closed here again after a reopen, it does)
      }
      const hn = hotelsToTrips([STATE.trips[nid]]); // 9.3.0 (ס11): a hotel is always the trip's - moved here, told in the toast, undone with it
      if (mode !== 'update' || !STATE.tripData[nid]) STATE.tripData[nid] = { favorites: [], visited: [], itinerary: {}, times: {}, planItems: {}, flightsSeeded: true };
      const inc = personalFromFile(data); // 4.2.1: the file's ids -> this device's ids
      if (inc) PARTS.filter(p => pk(p.id) && p.id !== 'trip').forEach(p => p.rows.forEach(r => { const fs = REG_BY[r].where.td; if (!fs) return; const x = {}; fs.forEach(f => { if (inc[f] !== undefined) x[f] = inc[f]; }); if (!Object.keys(x).length) return;
        STATE.tripData[nid] = mode === 'update' ? rowMerge(r, STATE.tripData[nid], JSON.parse(JSON.stringify(x))) : { ...STATE.tripData[nid], ...JSON.parse(JSON.stringify(x)) }; })); // ק18: added, nothing deleted
      if (pk('mementos') && data.mementos && data.mementos.items) { const items = JSON.parse(mapPicTokens(JSON.stringify(data.mementos.items), deviceRef));
        Object.entries(items).forEach(([k, v]) => { const key = mode === 'copy' ? k.replace(/^((?:photo|pimg):)[^:]+:/, '$1' + nid + ':').replace(/^art:.+$/, 'art:' + nid) : k; if (mode !== 'update' || !MEMO.has(key)) MEMO_DB.put(key, v); }); }
      travelOrphansOut(STATE.trips[nid], STATE.tripData[nid]); // 11.0.0 (Q16): a travel merged into its program line
      infoSpotClear(); // back-exit 2b: a file update stays on its screen, at its top, with the bar
      if (nid === STATE.activeTrip) { loadPersonal(nid); applyActiveTrip(); syncFlightsToPlan(); persist(); updateHeader(); pageTop(); navShow(); } else { persist(); switchTrip(nid, true); }
      if (pk('plan')) propAfterImport(data, nid, opt.propGone); // 11.5.0 (schedule-proposal): a proposal that came in the file waits in the plan (the same undo row)
      showUndoToast(`${mode === 'update' ? 'עודכן' : 'נוסף'} טיול: ${STATE.trips[nid].name}${n ? ` (+${n} עריכות)` : ''}${tail ? ` (${tail})` : ''}${addJoinedText(nj)}${hotelsMovedText(hn)}`);
}


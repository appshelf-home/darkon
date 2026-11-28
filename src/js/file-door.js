// ================= THE FILE DOOR'S CLEANING (diet-room; split from file-rules.js and file-ids.js) =================
// The door group (decisions 2026-11-26 · Review of `big-dest-search`, Q1; the diet's rules, decisions 2026-11-23): what a file passes when it
// comes in - its ids converted (fileIdsFix) and checked (fileIdsOk), its closed values (FILE_SETS - the time zones' list with it,
// generated/closed-zones.js), its references and a drive's stops (fileRefsClean, tvStopsClean, fileClean) - and the same once over the
// stored data (fileCleanStored, idsFixStored). openIncoming waits for this group before anything reads a file; the startup's pass
// (regStartup) waits for it only when the pass is due (fileRulesDue). The rules' version (FILE_RULES), the ids' forms (FILE_ID, FILE_KEY,
// idFix) and the count of dropped values (FILE_DROPPED) stay in file-rules.js and file-ids.js, which the main script reads.
function fileIdsOk(o, depth) { depth = depth || 0; if (depth > 40 || !o || typeof o !== 'object') return true;
  if (Array.isArray(o)) return o.every(x => fileIdsOk(x, depth + 1));
  return Object.keys(o).every(k => { const v = o[k]; if (k !== '' && !FILE_KEY.test(k)) return false;
    if (typeof v === 'string') return !FILE_ID_KEYS.has(k) || v === '' || FILE_ID.test(v);
    return fileIdsOk(v, depth + 1); }); }
const FILE_SETS = {
  'meta.country': v => CLOSED_LISTS.countries.has(v),
  'meta.timeZone': v => CLOSED_LISTS.timeZones.has(v),
  'currency.code': v => CLOSED_LISTS.currencies.has(v),
  'layer.type': v => v in BASE_TYPES,
  'layer.icon': v => CLOSED_LISTS.placeIcons.has(v),
  'place.icon': v => CLOSED_LISTS.placeIcons.has(v),
  'place.nameLead': v => v === 'foreign', 'place.leadMine': v => v === 'foreign' || v === 'name', 'data.nameLead': v => v === 'foreign', 'data.leadMine': v => v === 'foreign' || v === 'name', // name-lead: the AI's mark, my swap
  'place.status': v => PLACE_STATUS.includes(v),
  'theme.headingFont': v => HEADING_FONTS.includes(v),
  'travel.mode': v => v in TRAVEL_MS,
  'sched.kind': v => v in SCHED_KIND_NAME,
  'sched.mode': v => v in TRAVEL_MS, // kit-fixes (A2.5): a program line's travel mode, as a travel's
  'trip.legMain': v => v in LEG_MODES };
const PLACE_STATUS = ['closed', 'gone', 'skip']; // a place's status in a file (isGoneStatus); 'active' lives only in my edits
const FILE_ITEM = { layers: 'layer', travels: 'travel', schedule: 'sched', places: 'place', lodging: 'hotel', userAdds: 'place' }; // kit-fixes (A2.8): a round's returned additions pass the place's checks (icon, links, booking and price) // 11.42.0: a hotel (its price - bpFileClean) // an array's items take the singular key
// along-drive (kit 3.9.0): a drive's stops at the door - each { name, loc } with a trip place's id or a point in range, on a car; another
// is dropped and counted with the closed values ("ערכים לא מוכרים לא נקלטו")
function tvStopsClean(data) { const t = data && data.trip; if (!t || typeof t !== 'object' || !Array.isArray(t.travels)) return;
  const own = new Set((t.places || []).filter(p => p && typeof p === 'object').map(p => p.id)), num = (x, m) => typeof x === 'number' && isFinite(x) && Math.abs(x) <= m;
  const ok = s => !!s && typeof s === 'object' && (s.name == null || typeof s.name === 'string') && !!s.loc && typeof s.loc === 'object' && (s.loc.pid != null ? own.has(s.loc.pid) : num(s.loc.lat, 90) && num(s.loc.lng, 180));
  t.travels.forEach(f => { if (!f || typeof f !== 'object' || f.stops == null) return; const all = Array.isArray(f.stops) ? f.stops : [f.stops];
    const keep = f.mode === 'car' ? all.filter(ok).map(s => ({ name: String(s.name || '').trim(), loc: s.loc.pid != null ? { pid: s.loc.pid } : { lat: s.loc.lat, lng: s.loc.lng } })) : [];
    FILE_DROPPED += all.length - keep.length; if (keep.length) f.stops = keep; else delete f.stops; }); }
// item 5 (review of 11.11.0): a reference must point at something in the file - a place's layer and area at its destination's, a
// hotel's and a program line's place at a trip place or a place of the trip's destinations, a line's hotel at a hotel. One that points
// at nothing is dropped and counted as a closed value is. A trip place is checked against its destination only when that destination is
// in the same file. 11.13.0 (timeline-followups-4, Q3 and Q4 of the 11.12.0 review; the rule is written once in the kit,
// reference/file-format.md "Place references"): a destination's places are the file's copy when the file has it, else the copy already
// stored on this device (by the file's number, this device's number, a place I added to it) - so a trip-only file is checked too; a
// "@dest:id" reference is looked up in that destination. Only when one of the trip's destinations is in neither are its places unknown,
// and a place reference is then left as it is.
function filePlaceIds(id, dests) { const f = dests.get(id), s = new Set();
  if (f) { f.places.forEach(p => { if (p && typeof p === 'object') s.add(p.id); }); return s; }
  const d = typeof DESTS !== 'undefined' ? DESTS[id] : null; if (!d || !Array.isArray(d.places)) return null;
  d.places.forEach(q => { if (q) { s.add(q.id); s.add((d.idBase || 0) + q.id); } });
  const E = typeof STATE !== 'undefined' && STATE && STATE.edits ? STATE.edits.places || {} : {};
  Object.keys(E).forEach(k => { const e = E[k]; if (e && e.op === 'add' && e.data && e.data.dest === id) s.add(Number(k)); });
  return s; }
function fileRefsClean(data) {
  const dests = new Map(), trips = [], seen = new Set();
  const walk = (o, depth) => { if (!o || typeof o !== 'object' || depth > 8 || seen.has(o)) return; seen.add(o);
    if (Array.isArray(o)) { o.forEach(x => walk(x, depth + 1)); return; }
    if (o.meta && typeof o.meta === 'object' && Array.isArray(o.places) && typeof o.id === 'string') dests.set(o.id, o);
    else if (Array.isArray(o.segments) && (Array.isArray(o.places) || Array.isArray(o.lodging) || Array.isArray(o.schedule))) trips.push(o);
    Object.keys(o).forEach(k => walk(o[k], depth + 1)); };
  walk(data, 0);
  const drop = (o, k) => { delete o[k]; FILE_DROPPED++; };
  const ids = (a, f) => new Set((Array.isArray(a) ? a : []).filter(x => x && typeof x === 'object').map(x => x[f || 'id']));
  const placeRefs = (p, d) => { if (!p || typeof p !== 'object' || !d) return; const m = d.meta;
    if (p.layer != null && p.layer !== '' && !ids(m.layers).has(p.layer)) drop(p, 'layer');
    if (p.region != null && p.region !== '' && !ids(m.regions).has(p.region)) drop(p, 'region'); };
  dests.forEach(d => d.places.forEach(p => placeRefs(p, d)));
  trips.forEach(t => { const tp = ids(t.places), lg = ids(t.lodging);
    // a hotel or a line may point at a place of one of the trip's destinations (it moves to the trip on approval, t910 (3))
    const segD = [...new Set((Array.isArray(t.segments) ? t.segments : []).map(g => g && g.dest).filter(Boolean))];
    const sets = segD.map(id => filePlaceIds(id, dests)), known = sets.every(Boolean);
    sets.forEach(s => s && s.forEach(x => tp.add(x)));
    const badPlace = id => { if (id == null || id === '' || tp.has(id)) return false;
      const m = typeof id === 'string' && /^@(.+):(\d+)$/.exec(id); if (m) { const s = filePlaceIds(m[1], dests); return !!s && !s.has(Number(m[2])); }
      return known; };
    (Array.isArray(t.places) ? t.places : []).forEach(p => placeRefs(p, p && dests.get(p.dest)));
    (Array.isArray(t.lodging) ? t.lodging : []).forEach(l => { if (l && typeof l === 'object' && badPlace(l.placeId)) drop(l, 'placeId'); });
    (Array.isArray(t.schedule) ? t.schedule : []).forEach(x => { if (!x || typeof x !== 'object') return;
      if (badPlace(x.placeId)) drop(x, 'placeId');
      if (x.lodgingId != null && x.lodgingId !== '' && !lg.has(x.lodgingId)) drop(x, 'lodgingId'); }); });
  return data; }
function fileClean(o, key, list) {
  if (Array.isArray(o)) { o.forEach(x => fileClean(x, key === 'layers' ? 'layer' : FILE_ITEM[key], key === 'layers' ? o : null)); return o; }
  if (!o || typeof o !== 'object') return o;
  if (key === 'place' || key === 'data' || key === 'p') gidFromMapsUrl(o);
  bpFileClean(o, key); // 11.42.0 (booking-price, Q4): a booking or price as old text becomes the structure (silently); its closed values kept only in their sets // 11.22.0 (place-gid-1): an id inside a place's link moves into its field (older files, stored data once)
  const layerAdd = o.op === 'add' && o.data && typeof o.data === 'object' && key === 'layerEdit'; // an edit that adds a layer: its data is a whole layer
  for (const k of Object.keys(o)) { const v = o[k];
    if (key === 'layer' && k === 'icon' && v === 'international' && o.type === 'food') { o[k] = 'restaurant'; continue; } // 11.19.0 (small-fixes 21): the food layer's leftover globe becomes a knife and fork; a place of type "international" keeps it
    if (k === 'gid' && v === null && key === 'data') continue; // 11.23.0 (place-gid-2): an edit's null - the destination's own record was removed (moved or obsolete)
    if (k === 'addKey') { const ak = addKeyOf(v); if (ak) o[k] = ak; else { delete o[k]; FILE_DROPPED++; } continue; } // add-key (Q1): the key of the add a place completes - digits only (a closed field)
    if (k === 'recs') { const c = recClean(v); FILE_DROPPED += Array.isArray(v) ? v.length - c.length : 1; if (c.length) o[k] = c; else delete o[k]; continue; } // prev-recs (Q11): a summary of the closed form only - { id, v, r } each
    if (k === 'suggest') { const c = sgClean(v); FILE_DROPPED += Array.isArray(v) ? v.length - c.length : 1; if (c.length) o[k] = c; else delete o[k]; continue; } // ai-fix-mine (item 3): an AI's suggestions - a known field, a value of its form, a reason (sgDoor reads them only from an AI)
    if (k === 'aiFix') { const c = sgCleanStored(v); if (Object.keys(c).length) o[k] = c; else delete o[k]; continue; } // ai-fix-mine (item 5): the suggestions kept on a place (a backup's)
    if (k === 'recId') { if (typeof v !== 'string' || !REC_ID.test(v)) { delete o[k]; FILE_DROPPED++; } continue; } // prev-recs: a trip's contribution id
    if (k === 'gid') { const g = gidClean(v); if (g) o[k] = g; else { delete o[k]; FILE_DROPPED++; } continue; } // 11.22.0 (place-gid-1): a well-formed Google id record only (a closed field)
    if (k === 'infoNA') { delete o[k]; continue; } // kit-install (5): the old "not relevant" marks (11.43.0-11.58.0) are no longer read - dropped quietly, in a file and in stored data (FILE_RULES)
    if (k === 'roadDays') { if (!v || typeof v !== 'object' || Array.isArray(v) || Object.keys(v).some(x => (x !== 'first' && x !== 'last') || typeof v[x] !== 'boolean')) { delete o[k]; FILE_DROPPED++; } continue; } // 11.19.0 (trip-travel-days): { first, last } booleans only
    if (key === 'meta' && k === 'country' && typeof v === 'string' && CLOSED_LISTS.obsoleteCountries.has(v)) { // 11.16.0 (Q8): an obsolete code
      const to = CLOSED_LISTS.obsoleteCountries.get(v); if (to) o[k] = to; else { delete o[k]; FILE_DROPPED++; } continue; } // its successor quietly; none - empty and counted
    const set = FILE_SETS[(k === 'legMain' ? 'trip' : key) + '.' + k];
    if (set && v != null && v !== '' && (typeof v !== 'string' || !set(v))) { delete o[k]; FILE_DROPPED++; continue; }
    if (FILE_PHOTO_KEY.test(k) && typeof v === 'string') { const c = photoClean(v); if (c == null) { delete o[k]; FILE_DROPPED++; } else if (c !== v) o[k] = c; continue; } // hidden-data (H2): a stored image - JPEG or PNG only, cleaned of its metadata; anything else dropped and counted
    if (typeof v !== 'string') { if (key === 'layerEdits') fileClean(v, 'layerEdit', Object.values(o).map(e => e && e.data).filter(Boolean)); else if (layerAdd && k === 'data') fileClean(v, 'layer', list); else fileClean(v, k === 'layers' && !Array.isArray(v) && key === 'edits' ? 'layerEdits' : k); continue; }
    if (k === 'color' && !FILE_COLOR.test(v)) { if (key === 'layer') o[k] = (BASE_TYPES[o.type] || {}).color || layerColorPick((list || []).filter(l => l !== o)); else delete o[k]; }
    else if (key === 'theme' && (k === 'primary' || k === 'accent') && !FILE_COLOR.test(v)) delete o[k];
    else if (key === 'theme' && k === 'headingFont' && !HEADING_FONTS.includes(v)) delete o[k];
    else if ((k === 'mapsUrl' || k === 'album' || (key === 'src' && k === 'url')) && v && !FILE_LINK.test(v)) delete o[k];
    else if (k === 'website' && v && !FILE_LINK.test(/^https?:/i.test(v) ? v : 'https://' + v)) delete o[k];
    else if (k === 'info' && (o.meta || o.places)) o[k] = cleanInfo(v, { icons: true }); } // 11.8.1: a destination's info sections; 11.12.0: their data-icon from the closed list
  return o;
}
function fileCleanStored() { const u = regRead('upkeep'); if (u.fileRules && !versionLess(u.fileRules, FILE_RULES)) return 0; let n = 0;
  if (versionLess(u.fileRules || '0', '11.21.6')) { try { if (idsFixStored()) logEvent('סודרו מזהים פנימיים, כדי שכל גיבוי ייפתח', true, { b: 1 }); } catch (e) {} } // a change the app made on its own: a barrier in the undo history
  REG.filter(r => r.ring === 'mine').forEach(r => { const d = rowOut(r.id, SCOPE_ALL), was = JSON.stringify(d); if (was === undefined) return; const c = fileRefsClean(fileClean(JSON.parse(was))); if (JSON.stringify(c) === was) return; n++;
    if (r.where.td) stashActive(); rowIn(r.id, c); }); // the mementos too (only when a stored image was dropped - rare): the registry's one way in
  if (n) { ensureEditsShape(); loadPersonal(STATE.activeTrip); applyActiveTrip(); persist(); }
  regWrite('upkeep', { ...regRead('upkeep'), fileRules: FILE_RULES }); return n; }
// the door: every id or reference value (FILE_ID_KEYS) and every object key not of the form, converted in place through the whole
// file with one map; a part converted is also replaced where it stands alone in another value without spaces (a list of ids, a
// device choice) and inside the picture's placeholders ("pimg:<key>", data-pt="<key>") of an illustrated version. A value of such a
// key that is true or false is dropped (FILE_DROPPED). Returns how many values and keys changed; the user sees nothing.
// 11.21.6 (phone-round-2-fixes P5): the keys the app makes from dates, names and coordinates (a route hide's stops, legs and day trips,
// an offline-map choice) are made through idFix; one of an older version is converted the same way here, before the door's general
// pass, and when both forms stand side by side the older form's value wins (it was written after a restore had converted the other)
const ID_KEY_MAPS = { routeHide: ['stops', 'legs', 'outs'], offmap: ['over'] };
function idsKeysMerge(o) { let n = 0; const seen = new Set();
  const rekey = m => { if (!m || typeof m !== 'object' || Array.isArray(m)) return; Object.keys(m).forEach(k => { const f = idFix(k, null, 'key'); if (f === k) return; m[f] = m[k]; delete m[k]; n++; }); };
  const walk = (x, depth) => { if (!x || typeof x !== 'object' || depth > 60 || seen.has(x)) return; seen.add(x);
    if (Array.isArray(x)) { x.forEach(y => walk(y, depth + 1)); return; }
    Object.keys(x).forEach(k => { const v = x[k]; if (ID_KEY_MAPS[k] && v && typeof v === 'object') ID_KEY_MAPS[k].forEach(s => rekey(v[s])); walk(v, depth + 1); }); };
  walk(o, 0); return n; }
function fileIdsFix(o, taken) {
  const bad = new Set(), own = new Set(taken || []), seen = new Set(); let n = idsKeysMerge(o), dropped = 0;
  const toks = (s, set) => String(s).split(/[:|]/).forEach(t => { if (!ID_TOK.test(t)) set.add(t[0] === '@' ? t.slice(1) : t); else if (t) own.add(t); });
  const gather = (x, depth) => { if (!x || typeof x !== 'object' || depth > 60 || seen.has(x)) return; seen.add(x);
    if (Array.isArray(x)) { x.forEach(y => gather(y, depth + 1)); return; }
    Object.keys(x).forEach(k => { const v = x[k]; toks(k, new Set()); // a key's own parts are converted where they stand (a name in a picture's key is no id elsewhere)
      if (typeof v === 'string') { if (FILE_ID_KEYS.has(k) && v !== '') toks(v, FILE_ID.test(v) ? new Set() : bad); } else gather(v, depth + 1); }); };
  gather(o, 0); seen.clear();
  const map = new Map(); bad.forEach(t => map.set(t, idTokConv(t, own)));
  const fixStr = (s, kind) => { const r = idFix(s, own, kind); if (r !== s) n++; return r; };
  const refStr = s => { if (!map.size || /\s/.test(s) || ID_TOK.test(s.replace(/[:|]/g, ''))) return s; // a value that is not an id: only parts known as ids
    const ps = s.split(/([:|])/); let ch = false; const r = ps.map((t, i) => { if (i % 2) return t; const at = t[0] === '@', b = at ? t.slice(1) : t; if (!map.has(b)) return t; ch = true; return (at ? '@' : '') + map.get(b); }).join('');
    if (ch) n++; return r; };
  const artStr = s => { if (s.indexOf('pimg:') < 0 && s.indexOf('data-pt="') < 0) return s; let r = s; // the illustrated version's placeholders: up to the quote
    for (const mk of ['pimg:', 'data-pt="']) { const ps = r.split(mk); r = [ps[0]].concat(ps.slice(1).map(p => { let e = 0; while (e < p.length && p[e] !== '"' && p[e] !== "'") e++; const k = p.slice(0, e), f = k && k.indexOf('<') < 0 && k.indexOf('>') < 0 ? idFix(k, own, 'key') : k; if (f !== k) n++; return f + p.slice(e); })).join(mk); }
    return r; };
  const apply = (x, depth) => { if (!x || typeof x !== 'object' || depth > 60 || seen.has(x)) return x; seen.add(x);
    if (Array.isArray(x)) { for (let i = 0; i < x.length; i++) { const v = x[i]; if (typeof v === 'string') x[i] = refStr(v); else apply(v, depth + 1); } return x; }
    const ks = Object.keys(x); if (!ks.length) return x;
    const out = ks.map(k => { let v = x[k];
      if (FILE_ID_KEYS.has(k) && typeof v === 'boolean') { dropped++; return null; } // not an id at all
      if (typeof v === 'string') v = FILE_ID_KEYS.has(k) && v !== '' && !FILE_ID.test(v) ? fixStr(v) : artStr(refStr(v)); else apply(v, depth + 1);
      return [k === '' || FILE_KEY.test(k) ? k : fixStr(k, 'key'), v]; }).filter(Boolean);
    if (out.length === ks.length && out.every((p, i) => p[0] === ks[i] && p[1] === x[ks[i]])) return x;
    ks.forEach(k => delete x[k]); out.forEach(([k, v]) => { x[k] = v; }); return x; };
  apply(o, 0);
  if (dropped && typeof FILE_DROPPED === 'number') FILE_DROPPED += dropped;
  return n + dropped; }
// the ids already on this phone, so a converted id never takes one of them (the destinations, the trips)
function idsTaken() { const s = new Set(); try { Object.keys(DESTS || {}).forEach(k => s.add(k)); Object.keys((STATE && STATE.trips) || {}).forEach(k => s.add(k)); } catch (e) {} return s; }
// 11.21.4 (backup-ids, Q3): every id and key stored on this phone passes the door's conversion once, with one map over all of it - the
// small storage's records (the trips and their data, the edits, the trash, the log, the device's numbering of destinations), the
// destinations and their trash copies, every memento and hotel photo key (a photo in the trash too), the draft and the device's
// choices that hold ids (the place search's stored form, the destination and region picks, the views). What changed is written back
// through the stores; a destination or a memento whose key changed leaves its old key. dry: only count (the guards: zero on data the
// app made). Returns how many values and keys changed.
const IDS_DEV_ROWS = ['today', 'views', 'seen'];
function idsStoredWhole() { stashActive(); const W = { state: {}, dests: {}, memo: {}, destTrash: {}, draft: typeof DRAFT === 'undefined' ? null : DRAFT, dev: {} };
  [...new Set(REG.concat(REG_STATES).flatMap(r => r.where.blob || []))].forEach(f => { if (STATE[f] !== undefined && !(STATE[f] instanceof Set)) W.state[f] = STATE[f]; });
  Object.values(DESTS).filter(d => !d.builtin && !d.ghost).forEach(d => { W.dests[d.id] = d; });
  MEMO.forEach((v, k) => { W.memo[k] = v; }); DEST_DB.mem.forEach((v, k) => { W.destTrash[k] = v; });
  IDS_DEV_ROWS.forEach(id => { W.dev[id] = regRead(id); });
  return JSON.parse(JSON.stringify(W)); }
function idsFixStored(dry) { if (!idsStoredBad().length) return 0; // nothing to convert (every device after the first pass): no copy of the photos
  const W = idsStoredWhole(), was = JSON.stringify(W), n = fileIdsFix(W, null); if (!n || dry) return n;
  const O = JSON.parse(was), same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  Object.keys(W.state).forEach(f => { if (!same(W.state[f], O.state[f])) STATE[f] = W.state[f]; });
  if (!same(W.dests, O.dests)) { Object.keys(O.dests).forEach(k => { if (!(k in W.dests)) delete DESTS[k]; }); Object.values(W.dests).forEach(d => { DESTS[d.id] = d; }); saveDests(); }
  Object.keys(O.memo).forEach(k => { if (!(k in W.memo)) MEMO_DB.del(k); }); Object.keys(W.memo).forEach(k => { if (!(k in O.memo) || !same(W.memo[k], O.memo[k])) MEMO_DB.put(k, W.memo[k]); });
  Object.keys(O.destTrash).forEach(k => { if (!(k in W.destTrash)) DEST_DB.tdel([k]); }); Object.keys(W.destTrash).forEach(k => { if (!same(W.destTrash[k], O.destTrash[k])) DEST_DB.tput(W.destTrash[k]); });
  if (W.draft && !same(W.draft, O.draft)) { DRAFT = W.draft; saveDraft(); }
  IDS_DEV_ROWS.forEach(id => { if (!same(W.dev[id], O.dev[id])) { regWrite(id, W.dev[id]); Object.assign(DEV, W.dev[id]); } });
  ensureEditsShape(); loadPersonal(STATE.activeTrip); applyActiveTrip(); persist(); return n; }
// the light reading (idsFixStored's fast path; the guards: t1090, test_crawl.py after every action): every stored id, reference and key that the once pass would
// convert - with no copy of the stored data (the photos stay where they are) - as "where: value", at most 10
function idsStoredBad() { const out = [], seen = new Set();
  const walk = (x, at, depth) => { if (out.length >= 10 || !x || typeof x !== 'object' || depth > 60 || seen.has(x)) return; seen.add(x);
    if (x instanceof Set || x instanceof Map) x = [...x.keys()];
    if (Array.isArray(x)) { x.forEach((y, i) => walk(y, at, depth + 1)); return; }
    Object.keys(x).forEach(k => { const v = x[k]; if (k !== '' && !FILE_KEY.test(k)) out.push(at + ' key: ' + k);
      if (FILE_ID_KEYS.has(k) && (typeof v === 'boolean' || (typeof v === 'string' && v !== '' && !FILE_ID.test(v)))) out.push(at + '.' + k + ': ' + v);
      else if (typeof v === 'object') walk(v, at + '.' + (k.length > 24 ? k.slice(0, 24) + '…' : k), depth + 1); }); };
  [...new Set(REG.concat(REG_STATES).flatMap(r => r.where.blob || []))].forEach(f => walk({ [f]: STATE[f] }, 'state', 0));
  Object.values(DESTS).filter(d => !d.builtin && !d.ghost).forEach(d => walk({ [d.id]: d }, 'dests', 0));
  MEMO.forEach((v, k) => { if (!FILE_KEY.test(String(k))) out.push('memo key: ' + k);
    const svg = v && typeof v === 'object' && typeof v.svg === 'string' ? v.svg : ''; // the illustrated version's placeholders
    if (svg) ['pimg:', 'data-pt="'].forEach(mk => svg.split(mk).slice(1).forEach(p => { let e = 0; while (e < p.length && p[e] !== '"' && p[e] !== "'") e++; const q = p.slice(0, e); if (q && q.indexOf('<') < 0 && !FILE_KEY.test(q)) out.push(k + ' ' + mk + q); })); });
  DEST_DB.mem.forEach(v => walk(v, 'destTrash', 0)); walk(typeof DRAFT === 'undefined' ? null : DRAFT, 'draft', 0);
  IDS_DEV_ROWS.forEach(id => walk(regRead(id), 'dev.' + id, 0));
  return out.slice(0, 10); }

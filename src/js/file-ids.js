// ================= 11.21.4 (backup-ids): ids and keys of the file form - the one conversion (files.js's door, the once pass, ids made from names) =================
// decisions 2026-11-17 · A backup that does not restore: ids the app made itself (Q1-Q3); spec/incoming-markup-and-sinks.md "Ids".
const ID_TOK = /^[A-Za-z0-9_.@-]*$/; // one part of an id or a key (between ":" and "|")
// 11.21.4 (Q1-Q3): one conversion for an id or a key that is not of the form - at the file door, over stored data once (fileCleanStored)
// and for every id or key the app makes from a name (born valid: idFix). It works on the parts of a composite ("pimg:<trip>:c:<name>",
// "d1|<item>", "@<dest>:12" - split at ":" and "|"): a part of the form stays; another becomes its Latin letters and digits joined by "-"
// (at most 40; "id" when none) + "-" + a hash of the part (FNV-1a over its code points, 7 base-36 digits) - the same part gives the same
// result on every device, in every file, as an id, a reference, a key or inside a composite. A part that starts with "@" keeps it (a
// "@dest:12" reference names the destination's own id). claude/scripts/validate.py converts the same way (a cross test, t1090).
function idHash(s) { let h = 0x811c9dc5; for (const ch of String(s)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; } return h.toString(36).padStart(7, '0'); }
function idTokConv(t, taken) { if (ID_TOK.test(t)) return t; if (t[0] === '@') return '@' + idTokConv(t.slice(1), taken);
  const base = ((t.match(/[A-Za-z0-9]+/g) || []).join('-').slice(0, 40).replace(/-+$/, '') || 'id') + '-';
  let r = base + idHash(t); for (let i = 2; taken && taken.has(r); i++) r = base + idHash(t + '#' + i); return r; } // free of the file's and the phone's own ids
function idFix(s, taken, max) { s = String(s); const re = max === 'key' ? FILE_KEY : FILE_ID; if (re.test(s)) return s;
  const r = s.split(/([:|])/).map((t, i) => i % 2 ? t : idTokConv(t, taken)).join(''); return re.test(r) ? r : idTokConv(r.replace(/[:|]/g, '-'), taken); }
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

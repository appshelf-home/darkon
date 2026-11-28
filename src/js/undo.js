// 4.33.0: ✕ in a plan card - only this entry leaves the day (a copy, a note or the place itself), with undo
function removeFromDay(day, id) {
  const cur = findSlot(day, id); if (!cur) return; const it = planItem(id), nm = it ? it.name : '';
  planChange(typeof id === 'string' && !copyRef(id) ? `✕ ההערה הוסרה מהיום: ${nm} ("שהוסרו" בסוף היום מחזיר)` : `✕ הוסר מ-${dayByKey(day).label}${nm ? ': ' + nm : ''} (נשאר ביעד, "שהוסרו" בסוף היום מחזיר)`, () => { // 4.52.0: says what ✕ did
    const d = ensureDay(day), rm = planX().removed; const rec = { id, slot: cur, time: STATE.times[timeKey(day, id)] || null, item: typeof id === 'string' ? STATE.planItems[id] || null : null, at: Date.now() };
    rm[day] = [rec, ...(rm[day] || []).filter(r => String(r.id) !== String(id))].slice(0, 30); // 4.53.0
    d[cur] = d[cur].filter(x => x !== id); delete STATE.times[timeKey(day, id)];
    if (typeof id === 'string') delete STATE.planItems[id];
  });
}
function showParts() { return STATE.settings.showParts !== false; }
// 4.8.0: with the parts of the day off a day is one list: the slots in order, then the unassigned
function mergedIds(day) { const d = ensureDay(day); return [...d.morning, ...d.afternoon, ...d.evening, ...d.unassigned]; }
// puts the merged order back into the slots: only the moved item changes its part - the part of the item before it (or after it)

// 10.8.0 (design-icons, gap 14): snackbars, undo labels and log rows carry no emoji - a leading symbol (also in log rows stored
// before 10.8.0) goes; Claude's ✳ stays (drawn as its mark), flags are content
const EMO_LEAD = new RegExp('^(?:(?!' + SY.claude + ')\\p{Extended_Pictographic}(?:\\uFE0F|\\u200D\\p{Extended_Pictographic}\\uFE0F?)*!?\\s*)+', 'u');
function plainMsg(s) { return String(s == null ? '' : s).replace(/[\uE000-\uF8FF]\s*/g, '').replace(EMO_LEAD, ''); } // also a line icon's glyph (a button's textContent)
function showToast(msg, o) { // 10.7.0: o = { act, v, label, ms } - the snackbar's one action (e.g. "לדווח"), the same look as "ביטול"
  const t = document.getElementById('toast');
  if (msg == null) { toastHide(); return; } // showToast(null): the snackbar goes (its action opened a window)
  const q = escH; // may run before the escape helpers are defined (an early error)
  msg = plainMsg(msg);
  const qi = v => { try { return icHTML(q(v)); } catch (e) { return q(v); } }; // 10.15.0 (design-review F36): an inner symbol is the button's line icon (TEXT_MS), as in every text
  if (o && o.act) t.innerHTML = `<span${o.ic ? ' class="toast-t"' : ''}>${qi(msg)}</span>${o.ic ? msi(o.ic, { size: 20, cls: 'toast-ic' }) : ''} <button class="toast-undo-btn" data-act="${o.act}"${o.v != null ? ` data-v="${q(o.v)}"` : ''}>${o.label}</button>`; else t.innerHTML = qi(msg); // ✳ as Claude's mark, other symbols as line icons
  t.classList.add('show'); t._undo = null;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(toastHide, (o && o.ms) || 1600); showToast._end = performance.now() + ((o && o.ms) || 1600);
  if (!(o && o.act) && !_toastHeld) toastFree(); // a plain snackbar took an action snackbar's place: what waited for it may open
}
// the snackbar's one close (its timer, its action, showToast(null)): explanations that waited for an action snackbar are asked again (the gate, Q5)
function toastHide() { clearTimeout(showToast._t); document.getElementById('toast').classList.remove('show'); if (!_toastHeld) toastFree(); }
function toastAction() { if (_toastHeld) return true; const t = document.getElementById('toast'); return !!(t && t.classList.contains('show') && t.querySelector('button')); } // a snackbar with an action (an undo, a redo, "לדווח") is showing - or held under the exit message
// back-exit-fix (finding 4): the exit message takes an action snackbar's place for its 2 s; toastHold keeps the snackbar (its nodes, its
// undo row, the time it had left) and toastResume brings it back with its action for that time - unless another snackbar showed meanwhile
var _toastHeld = null;
function toastHold() { const t = document.getElementById('toast'); _toastHeld = { nodes: [...t.childNodes], undo: t._undo, left: Math.max(1000, (showToast._end || 0) - performance.now()) }; return _toastHeld; }
function toastResume(s) { if (_toastHeld !== s) return; _toastHeld = null; const t = document.getElementById('toast');
  if (t.classList.contains('show') && !/לחיצה נוספת על חזור/.test(t.textContent)) { toastFree(); return; } // a newer snackbar is showing: it stays
  t.replaceChildren(...s.nodes); t._undo = s.undo; t.classList.add('show'); clearTimeout(showToast._t); showToast._t = setTimeout(toastHide, s.left); showToast._end = performance.now() + s.left; }
function toastFree() { try { explainFree(true); } catch (e) {} } // may run before the explanations are defined (an early error's snackbar)
// ================= UNDO HISTORY (task undo-history; decisions/2026-11-07-undo-history.md Q1-Q7; standard ui-layers-actions-undo) =================
// The change log is the history. Every action that shows an undo toast (and only those) writes one log row (one toast = one row)
// whose previous state - of everything the action changed - is kept on this device (UNDO_DB, keyed by the row's id `u`; the
// registry row 'undo'). Nothing is declared per action: the history keeps the state as it was after the last row (H_BASE) and a
// row stores the slots that differ now. Slots: a trip, a trip's personal field, an edits entry, a setting, a trash entry, a
// destination, a field of the draft, a device choice, a photo (by reference: images are never copied while they are unchanged),
// a destination kept in the trash. What the trash already keeps is stored as a reference to it (Q3); a permanent deletion stores
// what it deletes (Q4). Undo is sequential: "up to row X" restores, newest first, every row after X, and is itself a row (x = X)
// holding the state before the undo, so undoing it is redo. Rows of the last UNDO_DAYS days are undoable after the app closed;
// a row is read-only when it is older, when its state was dropped by the cap (and every older row), when it came from a restored
// backup (no `u`), or when it is at or before a change the app made on its own (a barrier, `b`). Rows that are not a change
// (logEvent(text, true)) are outside the chain and passed over. Guards: t880, t1030, d12/m15.py, crawl_undo.py.
const UNDO_DAYS = 3, UNDO_CAP = 20 * 1024 * 1024, UNDO_REF_MIN = 1500;
const UNDO_DEV = ['baseMap', 'mapLight', 'esriKey', 'esriKeyOk', 'esriKeyAt', 'kitDismiss']; // device choices that have an undo toast
const H_ROOTS = { // json slots: the root, how deep it is split into slots, and (s, v) which keys of it count
  t: { get: () => STATE.trips, depth: 1 },
  d: { get: () => STATE.tripData, depth: 2 },
  e: { get: () => STATE.edits, depth: 2 },
  s: { get: () => STATE, keys: ['settings', 'theme', 'chipOrder', 'activeTrip', 'countries'], depth: 2 }, // countries-visited: a country marked by hand
  D: { get: () => DESTS, skip: d => !d || d.builtin || d.ghost, depth: 1 },
  r: { get: () => DRAFT, set: v => { DRAFT = v; }, depth: 1, own: true },
  v: { get: () => DEV, keys: UNDO_DEV, depth: 1 },
};
let H_BASE = null, H_MUTE = 0, H_N = 0;
const H_ROWS = new Map(); // rows written or read in this opening (id -> row); the rest are read from UNDO_DB when needed
let H_IDX = null;          // id -> [time, size] of every stored state (the registry row's index, small storage)
function hIdx() { if (!H_IDX) { const o = regRead('undo'); H_IDX = new Map(Object.entries(o.idx || {})); } return H_IDX; }
function hIdxSave() { const idx = {}; hIdx().forEach((v, k) => { idx[k] = v; }); regWrite('undo', { idx }); }
const hKey = p => JSON.stringify(p);
function hFlat(out, path, v, depth) {
  if (v === undefined) return;
  if (depth > 0 && v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Set)) { out.set(hKey(path), '{}'); Object.keys(v).forEach(k => hFlat(out, path.concat(k), v[k], depth - 1)); }
  else out.set(hKey(path), JSON.stringify(v));
}
// the state now: json slots (strings), photos and trashed destinations (by reference)
function hTake() {
  stashActive(); const j = new Map();
  Object.entries(H_ROOTS).forEach(([r, R]) => { const o = R.get(); if (o == null) return; if (R.own) j.set(hKey([r]), '{}');
    (R.keys || Object.keys(o)).forEach(k => { if (o[k] === undefined || (R.skip && R.skip(o[k]))) return; hFlat(j, [r, k], o[k], R.depth - 1); }); });
  (STATE.trash || []).forEach(x => j.set(hKey(['x', String(x.kind || 'place'), String(x.id)]), JSON.stringify(x)));
  return { j, m: new Map(MEMO), z: new Map(DEST_DB.mem) };
}
function hRebase() { if (typeof DRAFT === 'undefined') return; H_BASE = hTake(); } // after a change the app made on its own, and at startup
// a big previous value that moved into the trash in the same action is kept as a reference to it (Q3)
function hRefFor(str, now, base) {
  for (const [k, s] of now.j) { if (base.j.has(k) || !k.startsWith('["x"')) continue; const x = JSON.parse(s);
    for (const f of Object.keys(x)) { if (x[f] && typeof x[f] === 'object') { if (JSON.stringify(x[f]) === str) return { r: k, p: [f] };
      for (const g of Object.keys(x[f])) if (x[f][g] && typeof x[f][g] === 'object' && JSON.stringify(x[f][g]) === str) return { r: k, p: [f, g] }; } } }
  for (const [k, rec] of now.z) { if (base.z.has(k)) continue; if (rec && rec.dest && JSON.stringify(rec.dest) === str) return { r: hKey(['z', k]), p: ['dest'] }; }
  return null;
}
function hDiff(base, now) {
  const s = {};
  new Set([...base.j.keys(), ...now.j.keys()]).forEach(k => { const a = base.j.get(k), b = now.j.get(k); if (a === b) return;
    s[k] = a === undefined ? { n: 1 } : a.length >= UNDO_REF_MIN && hRefFor(a, now, base) || { v: a }; });
  [['m', 'm'], ['z', 'z']].forEach(([f, r]) => new Set([...base[f].keys(), ...now[f].keys()]).forEach(k => { const a = base[f].get(k), b = now[f].get(k); if (a === b) return;
    let p = a === undefined ? { n: 1 } : { v: a };
    if (f === 'm' && a !== undefined) for (const [k2, v2] of now.m) if (v2 === a && !base.m.has(k2)) { p = { r: hKey(['m', k2]), p: [] }; break; } // a photo moved to the trash
    s[hKey([r, k])] = p; }));
  return s;
}
const hSize = s => Object.values(s).reduce((n, p) => n + (p.v === undefined ? 40 : typeof p.v === 'string' ? p.v.length : JSON.stringify(p.v).length), 0);
// closes one row: the slots that changed since the last row; returns the row's id (null when the history can't keep it)
function hCommit(label, extra) {
  if (H_MUTE || OLD_COPY) return null;
  if (!(extra && extra.x) && typeof parkedTidyAll === 'function') parkedTidyAll(); // draw-no-write: a change that put a place into a plan day takes it out of the waiting days in its own row (an undo row restores, never tidies)
  const now = H_BASE ? hTake() : null; let s = now ? hDiff(H_BASE, now) : null; if (now) H_BASE = now;
  const id = 'h' + Date.now().toString(36) + (++H_N).toString(36) + Math.random().toString(36).slice(2, 4);
  let text = label;
  if (s && !(extra && extra.x) && Object.keys(s).length && Object.keys(s).every(k => k.startsWith('["r"')) && !/^בטיוטה של /.test(label)) { // Q5: a row of the draft says so
    const pd = s[hKey(['r', 'data'])], D = DRAFT || (pd && pd.v ? { data: JSON.parse(pd.v) } : null); if (D && D.data) text = `בטיוטה של ${draftTitle(D)}: ${label}`; }
  if (s && !Object.keys(s).length && !(extra && extra.x)) s = null; // nothing changed: no row to undo (a plain line, no ביטול)
  logEvent(text, !s, s ? { u: id, ...(extra || {}) } : extra);
  if (!s) return null;
  const row = { id, t: Date.now(), l: text, s, ...(extra || {}) }, n = hSize(s);
  H_ROWS.set(id, row); hIdx().set(id, [row.t, n]); hIdxSave();
  UNDO_DB.put(id, row).then(ok => { if (!ok) { hIdx().delete(id); hIdxSave(); } hCap(); });
  return id;
}
// the cap (Q2): the oldest stored states go first; their rows - and every older row - become read-only
function hCap() { const L = [...hIdx().entries()].reverse().sort((a, b) => b[1][0] - a[1][0]); let tot = 0; const out = []; // newest first (the same moment: the later written)
  L.forEach(([k, v]) => { tot += v[1]; if (tot > UNDO_CAP) out.push(k); });
  if (!out.length) return; out.forEach(k => { hIdx().delete(k); H_ROWS.delete(k); }); hIdxSave(); UNDO_DB.del(out); }
// the daily cleanup: states older than UNDO_DAYS, and stored states no log row names (registry: clean age:3)
async function hCleanup() { const cut = Date.now() - UNDO_DAYS * 864e5, keep = new Set((STATE.log || []).map(e => e.u).filter(Boolean)), out = [];
  hIdx().forEach((v, k) => { if (v[0] < cut || !keep.has(k)) out.push(k); }); out.forEach(k => { hIdx().delete(k); H_ROWS.delete(k); }); if (out.length) hIdxSave();
  const ks = (await UNDO_DB.keys()).filter(k => !hIdx().has(k)); if (ks.length || out.length) UNDO_DB.del([...new Set([...ks, ...out])]); }
// the chain: newest first, the rows that can still be undone - it stops at a row older than UNDO_DAYS, at a barrier and at a row
// whose state is gone; a row that is not a change (or came from a backup) is passed over
function hChain() { const cut = Date.now() - UNDO_DAYS * 864e5, out = [], log = STATE.log || [];
  for (let i = log.length - 1; i >= 0; i--) { const e = log[i]; if (e.at < cut || e.b) break; if (!e.u) continue; if (!hIdx().has(e.u)) break; out.push(e); }
  return out; }
// the rows still in effect: an effective undo row cancels the rows from its target up to itself (a cancelled undo row cancels nothing)
function hEffective(L) { const idx = {}, off = new Set(), out = []; L.forEach((r, i) => { idx[r.u] = i; });
  L.forEach((r, i) => { if (off.has(r.u)) return; out.push(r); if (r.x) { const j = idx[r.x] === undefined ? L.length - 1 : idx[r.x]; for (let k = i + 1; k <= j; k++) off.add(L[k].u); } });
  return out; }
function hMenuTarget() { const L = hChain(); return L.length ? hEffective(L).find(r => !r.x) || null : null; } // ⋮: the newest action still in effect
// plain labels (standard "Undo labels"): the stored text stays; phrased here at display time, falling back to the stored text
const HP_RULES = [
  [/^בטיוטה של (.+?): (.+)$/, m => `${hPlainText(m[2])} (בטיוטה של ${m[1]})`],
  [/^נוסף למועדפים: (.+)$/, m => `${m[1]} נוסף למועדפים`],
  [/^הוסר מהמועדפים: (.+)$/, m => `${m[1]} ירד מהמועדפים`],
  [/^✓? ?בוטל "היינו": (.+)$/, m => `${m[1]}: בוטל "היינו"`],
  [/^✓? ?היינו: (.+)$/, m => `${m[1]} סומן "היינו"`],
  [/^הועבר לסל המחזור: (.+)$/, m => `${m[1]} נמחק לסל`],
  [/^נמחק (טיול|יעד) \(בסל 30 יום\): (.+)$/, m => `ה${m[1]} ${m[2]} נמחק לסל`],
  [/^הוסתר: (.+?) · .*$/, m => `${m[1]} הוסתר`],
  [/^הוחזר: (.+)$/, m => `${m[1]} חזר מההסתרה`],
  [/^שוחזר מהסל(?: (?:הטיול|היעד|השכבה))?: (.+)$/, m => `${m[1]} שוחזר מהסל`],
  [/^שוחזרה מהסל(?: השכבה)?: (.+)$/, m => `${m[1]} שוחזרה מהסל`],
  [/^נמחק לצמיתות: (.+)$/, m => `${m[1]} נמחק לצמיתות`],
  [/^עברתם לטיול: (.+)$/, m => `מעבר לטיול ${m[1]}`],
  [/^נוצר טיול: (.+)$/, m => `הטיול ${m[1]} נוצר`],
  [/^נוצר יעד: (.+?)(\. .*)?$/, m => `היעד ${m[1]} נוצר`],
  [/^הוסר מ-(.+?): (.+?) \(.*$/, m => `${m[2]} הוסר מ${m[1]}`],
  [/^ההערה הוסרה מהיום: (.+?) \(.*$/, m => `ההערה ${m[1]} הוסרה מהיום`],
];
function hPlainText(l) { l = plainMsg(l || '').trim(); // a row's text is plain, shown as typed (10.17.2)
  for (const [re, fn] of HP_RULES) { const m = l.match(re); if (m) return fn(m); } return l; }
function hPlain(r) { if (!r.x) return hPlainText(r.text);
  const redo = /^הוחזר: /.test(r.text), ol = r.ol || String(r.text).replace(/^(בוטל|הוחזר): /, '');
  return `${redo ? 'החזרה' : 'ביטול'}: ${/^\d+ פעולות$/.test(ol) ? ol : hPlainText(ol)}`; }
async function hRow(id) { if (H_ROWS.has(id)) return H_ROWS.get(id); const r = await UNDO_DB.get(id); if (r) H_ROWS.set(id, r); return r; }
// reads a slot's value now (for a reference) - a deep copy
function hNow(key) { const p = JSON.parse(key), r = p[0];
  if (r === 'm') return MEMO.get(p[1]); if (r === 'z') return DEST_DB.mem.get(p[1]);
  if (r === 'x') { const x = (STATE.trash || []).find(t => String(t.kind || 'place') === p[1] && String(t.id) === p[2]); return x && JSON.parse(JSON.stringify(x)); }
  let o = H_ROOTS[r].get(); for (const k of p.slice(1)) { if (o == null) return undefined; o = o[k]; } return o === undefined ? undefined : JSON.parse(JSON.stringify(o)); }
// writes one row's previous state back (the references are read first, from the state before it)
function hApply(s) {
  const val = {}; Object.entries(s).forEach(([k, p]) => { let v;
    if (p.n) v = undefined; else if (p.r) { v = hNow(p.r); for (const f of p.p || []) v = v == null ? undefined : v[f]; } else v = k.startsWith('["m"') || k.startsWith('["z"') ? p.v : JSON.parse(p.v);
    val[k] = v; });
  const keys = Object.keys(val).map(k => [k, JSON.parse(k)]);
  const isBox = (path) => { const R = H_ROOTS[path[0]]; return R && path.length - 1 < R.depth && val[hKey(path)] && typeof val[hKey(path)] === 'object' && !Array.isArray(val[hKey(path)]) && !Object.keys(val[hKey(path)]).length; };
  const at = (path, make) => { let o = H_ROOTS[path[0]].get(); if (o == null) { if (!make) return null; H_ROOTS[path[0]].set(o = {}); }
    for (const k of path.slice(1, -1)) { if (o[k] == null || typeof o[k] !== 'object') { if (!make) return null; o[k] = {}; } o = o[k]; } return o; };
  // 1. containers that exist in the state restored (shallow first), 2. values, 3. containers that did not (deep first)
  keys.filter(([k, p]) => H_ROOTS[p[0]] && isBox(p)).sort((a, b) => a[1].length - b[1].length).forEach(([k, p]) => {
    if (p.length === 1) { if (H_ROOTS[p[0]].get() == null) H_ROOTS[p[0]].set({}); return; } const o = at(p, true); const f = p[p.length - 1]; if (o[f] == null || typeof o[f] !== 'object') o[f] = {}; });
  let trash = null;
  keys.forEach(([k, p]) => { const v = val[k], r = p[0];
    if (r === 'm') { if (v === undefined) { if (MEMO.has(p[1])) MEMO_DB.del(p[1]); } else if (MEMO.get(p[1]) !== v) MEMO_DB.put(p[1], v); return; }
    if (r === 'z') { if (v === undefined) { if (DEST_DB.mem.has(p[1])) DEST_DB.tdel([p[1]]); } else DEST_DB.tput(v); return; }
    if (r === 'x') { trash = trash || new Map((STATE.trash || []).map(t => [hKey(['x', String(t.kind || 'place'), String(t.id)]), t])); if (v === undefined) trash.delete(k); else trash.set(k, v); return; }
    if (v === undefined || isBox(p)) return; const o = at(p, true); o[p[p.length - 1]] = v; });
  if (trash) STATE.trash = [...trash.values()].sort((a, b) => (a.at || 0) - (b.at || 0));
  keys.filter(([k, p]) => H_ROOTS[p[0]] && val[k] === undefined).sort((a, b) => b[1].length - a[1].length).forEach(([k, p]) => {
    if (p.length === 1) { H_ROOTS[p[0]].set(null); return; } const o = at(p, false); if (o) delete o[p[p.length - 1]]; });
  return keys.map(([k]) => k);
}
// after a restore: everything that is built from the data is built again, then one draw
function hAfter(keys) {
  const has = r => keys.some(k => k.startsWith('["' + r + '"'));
  if (has('D')) { Object.values(DESTS).forEach(d => { if (!d.builtin && STATE.destBases) STATE.destBases[d.id] = d.idBase || 0; }); saveDests(); }
  if (has('r')) saveDraft();
  ensureEditsShape();
  if (STATE.activeTrip && !STATE.trips[STATE.activeTrip]) STATE.activeTrip = pickRelevantTrip(null);
  loadPersonal(STATE.activeTrip); applyActiveTrip(); refreshLayers();
  if (has('v')) { devSet(Object.fromEntries(UNDO_DEV.map(f => [f, DEV[f]]))); if (keys.some(k => /esriKey"/.test(k))) checkEsriKey(); refreshBaseMaps(); }
  if (keys.some(k => /"theme"/.test(k))) { applyTheme(); mapThemeChanged(); }
  if (keys.some(k => /"settings"/.test(k))) { FP.sort = prefs().sort; applyPrefs(); }
  if (typeof OFF_PLAN_MEMO !== 'undefined') OFF_PLAN_MEMO.sig = '';
  persist(); updateHeader(); (H_AFTER || []).forEach(f => { try { f(keys); } catch (e) { errNote('undo', e); } });
}
// a change the app made on its own (e.g. an image it fetched): absorbed into the base, so it is in no row (slot keys as hKey paths)
function hAbsorb(keys) { if (!H_BASE) return; const now = hTake(); [].concat(keys).forEach(k => { const p = JSON.parse(k), f = p[0] === 'm' ? 'm' : p[0] === 'z' ? 'z' : 'j', kk = f === 'j' ? k : p[1];
  if (now[f].has(kk)) H_BASE[f].set(kk, now[f].get(kk)); else H_BASE[f].delete(kk); }); }
// part of a larger action: its own undo toast is held back, so the action's one toast closes one row for all of it
function undoHold(fn) { H_MUTE++; try { return fn(); } finally { H_MUTE--; } }
// an area that holds changes waiting for their toast (a burst) closes them before an undo runs
var H_BEFORE; function undoBefore(fn) { (H_BEFORE = H_BEFORE || []).push(fn); }
// an area whose screen keeps derived state (a cache, a list built for a window) declares how to rebuild it after a restore
var H_AFTER; function undoAfter(fn) { (H_AFTER = H_AFTER || []).push(fn); }
let H_BUSY = false;
// undo everything from row id up to now, newest first; one undo row (x = id) - its toast offers "החזרה" (redo)
async function hUndoTo(id, mode) {
  if (H_BUSY) return null; if (OLD_COPY) { showToast((staleWords() + SEP + 'רעננו כדי לשמור שינויים')); return null; }
  (H_BEFORE || []).forEach(f => { try { f(); } catch (e) { errNote('undo', e); } });
  const L = hChain(), i = L.findIndex(e => e.u === id); if (i < 0) { showToast('אי אפשר לבטל: המידע לביטול כבר נמחק'); return null; }
  const range = L.slice(0, i + 1), target = range[range.length - 1]; H_BUSY = true;
  try {
    const rows = []; for (const e of range) { const r = await hRow(e.u); if (!r) { showToast('אי אפשר לבטל: המידע לביטול כבר נמחק'); return null; } rows.push(r); }
    H_BASE = hTake(); const keys = new Set(); H_MUTE++;
    try { rows.forEach(r => hApply(r.s).forEach(k => keys.add(k))); hAfter([...keys]); } finally { H_MUTE--; }
    const ol = range.length === 1 || mode === 'step' ? (target.x ? (target.ol || String(target.text).replace(/^(בוטל|הוחזר): /, '')) : target.text) : `${range.length} פעולות`;
    const label = (target.x && range.length === 1 ? 'הוחזר: ' : 'בוטל: ') + ol;
    const nid = hCommit(label, { x: id, ol });
    if (nid) showToast(label, { act: 'toast.redo', v: nid, label: 'החזרה', ms: 5000 }); else showToast(label);
    undoMenuSync(); dataChanged(); return nid;
  } finally { H_BUSY = false; }
}
// 9.1.1 (12ג-4): one undo toast; since undo-history it closes one row of the history (one toast = one row). o: ms, or { ms }
function showUndoToast(msg, o) {
  o = typeof o === 'number' ? { ms: o } : (o || {}); msg = plainMsg(msg);
  if (H_MUTE) return; const id = hCommit(msg);
  const t = document.getElementById('toast');
  t.innerHTML = `<span>${icText(msg)}</span>${id ? ` <button class="toast-undo-btn" data-act="toast.undo" data-v="${id}">ביטול</button>` : ''}`; // 10.15.0 (F36): inner symbols as line icons
  t.classList.add('show'); t._undo = id;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(toastHide, o.ms || 5000); showToast._end = performance.now() + (o.ms || 5000); if (!id) toastFree();
  undoMenuSync();
}
const toastOff = () => { document.getElementById('toast')._undo = null; toastHide(); };
act('toast.undo', c => { const id = c.v || document.getElementById('toast')._undo; toastOff(); if (id) hUndoTo(id); return 'quiet'; });
act('toast.redo', c => { toastOff(); if (c.v) hUndoTo(c.v); return 'quiet'; });
// ⋮ first row, only when there is something to undo; each tap goes one more step back
function undoMenuSync() { const b = document.getElementById('undoBtn'); if (!b) return; const u = hMenuTarget();
  b.hidden = !u; if (u) b.innerHTML = msi('undo') + `<span class="t-wrap">ביטול: ${sepTie(icText(hPlain(u)))}</span>`; } // value-tie-source (decisions 2026-11-20 · Review of the `value-no-cut` summary, Q3): the label wraps whole - it may hold a count, never cut with "…"
act('undo.last', () => { closeMenu(); const u = hMenuTarget(); if (u) hUndoTo(u.u, 'step'); return 'quiet'; });
// the log's undo icon: on the newest row it undoes at once; on an older row it asks in a sheet what will be undone
act('undo.upto', c => { const L = hChain(); if (!L.length) return 'quiet'; if (L[0].u === c.v) hUndoTo(c.v); else openUndoUpto(c.v); return 'quiet'; });
function openUndoUpto(id) { const ctl = {}; layerNote(openUndoUpto, arguments); const sheet = document.getElementById('sheet'), L = hChain(), i = L.findIndex(e => e.u === id);
  if (i < 0) { closeSheet(); return; } const list = L.slice(0, i + 1), n = list.length;
  const mark = e => e.x ? ` <small class="uu-redo">(${/^הוחזר: /.test(e.text) ? 'ההחזרה תתבטל' : 'הביטול יתבטל'})</small>` : '';
  sheet.innerHTML = `${fmHead(msi('undo') + ' ביטול עד כאן', 'uuClose')}<p class="sh-hint">${n === 1 ? 'תבוטל פעולה אחת:' : `יבוטלו ${n} פעולות, מהאחרונה ועד זו:`}</p>
    <div class="log-card uu-list">${list.map(e => `<div class="log-row"><span class="log-time">${tmFmt('stamp', e.at)}</span><span>${icText(hPlain(e))}${mark(e)}${e.who ? `<small>${escH(e.who)}</small>` : ''}</span></div>`).join('')}</div>
    <div class="brow export-actions sheet-save-bar"><button class="btn-nav" id="uuGo" data-act="undoUpto.uu">${msi('undo', { size: 18 })} ${n === 1 ? 'לבטל את הפעולה' : `לבטל ${n} פעולות`}</button></div>`;
  ctl.uu = () => { const M = hChain(), j = M.findIndex(e => e.u === id); if (j !== i || M[0].u !== L[0].u) { openUndoUpto(id); return; } // another action came meanwhile: list again
    closeSheet(); hUndoTo(id); };
  showSheetBackdrop('openUndoUpto'); layerTop().ctl = ctl; }
ctlActs('undoUpto', ['uu']);
const MAP_AVAILABLE = (location.protocol === 'https:' && !location.hostname.includes('claude.ai')) && (() => { try { return window.self === window.top; } catch (e) { return false; } })(); // 11.29.0 (launch-fast, Q6 (a)): the installed site, not the copy inside Claude (a frame) - never decided from window.L: the library loads after the first screen (js/map-library.js)


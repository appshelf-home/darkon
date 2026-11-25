// ---- memories by last use (ר8): what was used last stays when a cap is reached ----
let _regUse = null, _regUseT = 0;
function regUse() { if (!_regUse) { const u = regRead('upkeep'); _regUse = u.use || {}; } return _regUse; }
function regTouch(id, k) { const u = regUse(), d = Math.floor(Date.now() / 864e5); (u[id] = u[id] || {}); if (u[id][k] === d) return; u[id][k] = d; clearTimeout(_regUseT); _regUseT = setTimeout(regUseSave, 3000); }
function regUseSave() { const u = regRead('upkeep'); regWrite('upkeep', { ...u, use: regUse() }); }
function regByUse(id, keys) { const u = regUse()[id] || {}; return keys.map((k, i) => [k, u[k] || 0, i]).sort((a, b) => a[1] - b[1] || a[2] - b[2]).map(x => x[0]); }
function regCacheGet(id, k) { const c = regRead(id); if (k === undefined) return c; if (c[k] !== undefined) regTouch(id, k); return c[k]; }
function regCacheSet(id, k, v) { const c = regRead(id); c[k] = v; regTouch(id, k); regWrite(id, c); return c; }
// ---- the bigger stores (IndexedDB) ----
function regPersistAsk() { try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {} }
function regIdbOpen(name, ver, stores) { return new Promise(res => { try { if (!window.indexedDB) return res(null); const r = indexedDB.open(name, ver);
  r.onupgradeneeded = () => stores.forEach(([s, o]) => { if (!r.result.objectStoreNames.contains(s)) r.result.createObjectStore(s, o); });
  r.onsuccess = () => res(r.result); r.onerror = () => res(null); } catch (e) { res(null); } }); }
// 3.0.1: imported destinations live in IndexedDB (room for many destinations); without it - in the small storage
const DEST_DB = {
  db: null, ok: false, mem: new Map(), // undo-history: the trash store's records mirrored in memory (the history compares them by reference)
  async open() { const db = await regIdbOpen(PACK.filePrefix + '_db', 2, [['dests', { keyPath: 'id' }], ['trash', { keyPath: 'key' }]]); if (db) { this.db = db; this.ok = true; } return db; },
  tx(mode) { return this.db.transaction('dests', mode).objectStore('dests'); },
  all() { return new Promise(res => { const q = this.tx('readonly').getAll(); q.onsuccess = () => res(q.result || []); q.onerror = () => res([]); }); },
  keys() { return new Promise(res => { const q = this.tx('readonly').getAllKeys(); q.onsuccess = () => res(q.result || []); q.onerror = () => res([]); }); },
  // 4.37.3: a deleted destination is kept whole in its own store (too big for localStorage), keyed 'dest:<trash entry id>'
  tput(rec) { this.mem.set(rec.key, rec); if (OLD_COPY) return Promise.resolve(true); return new Promise(res => { try { const st = this.db.transaction('trash', 'readwrite').objectStore('trash'); st.put(rec); st.transaction.oncomplete = () => res(true); st.transaction.onerror = st.transaction.onabort = () => { regSpaceFail(st.transaction.error); res(false); }; } catch (e) { res(false); } }); },
  tget(key) { return new Promise(res => { try { const q = this.db.transaction('trash', 'readonly').objectStore('trash').get(key); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); } catch (e) { res(null); } }); },
  tdel(keys) { keys.forEach(k => this.mem.delete(k)); if (OLD_COPY) return Promise.resolve(true); return new Promise(res => { try { const st = this.db.transaction('trash', 'readwrite').objectStore('trash'); keys.forEach(k => st.delete(k)); st.transaction.oncomplete = () => res(true); st.transaction.onerror = st.transaction.onabort = () => res(false); } catch (e) { res(false); } }); },
  async tload() { if (!this.ok) return; for (const k of await this.tkeys()) { const r = await this.tget(k); if (r) this.mem.set(k, r); } },
  tkeys() { return new Promise(res => { try { const q = this.db.transaction('trash', 'readonly').objectStore('trash').getAllKeys(); q.onsuccess = () => res(q.result || []); q.onerror = () => res([]); } catch (e) { res([]); } }); },
  sync(list) { regChanged('dests'); return new Promise(async res => { try { const keys = await this.keys(); const st = this.tx('readwrite'); keys.filter(k => !list.some(d => d.id === k)).forEach(k => st.delete(k)); list.forEach(d => st.put(d)); st.transaction.oncomplete = () => res(true); st.transaction.onerror = st.transaction.onabort = () => res(regSpaceFail(st.transaction.error) ? null : false); } catch (e) { res(false); } }); }, // storage (Q6): null - refused for space, the one message already shown
};
// 4.30.0: mementos (photos, point images, the illustrated version) and 6.0.0 hotel photos - what can't be rebuilt
var MEMO = new Map();                 // key -> value: "photo:<trip>:<key>" -> dataURL, "art:<trip>" -> {svg, at, orient}, "hotel:<place ref>" -> dataURL
// hidden-data (H2): put - every stored image (a string under a photo's key) passes the one cleaner (photoClean) first - a file, a restore, an undo, my own;
// one it refuses is not written (an object - the illustrated version moved to the trash - is the app's own and is not an image)
const MEMO_DB = {
  db: null,
  async open() { if (!this.db) this.db = await regIdbOpen(PACK.filePrefix + '_memo', 1, [['m']]); return this.db; },
  async all() { if (!(await this.open())) return []; return new Promise(res => { try { const st = this.db.transaction('m', 'readonly').objectStore('m'), out = [];
    const q = st.openCursor(); q.onsuccess = () => { const c = q.result; if (c) { out.push([c.key, c.value]); c.continue(); } else res(out); }; q.onerror = () => res(out); } catch (e) { res([]); } }); },
  async put(k, v, again) { { const c = photoCleanAt(k, v); if (c == null && v != null) return false; v = c; } MEMO.set(k, v); regChanged(memoRow(k)); if (OLD_COPY) return true; if (!(await this.open())) return false; return new Promise(res => { try { const tx = this.db.transaction('m', 'readwrite'); tx.objectStore('m').put(v, k); tx.oncomplete = () => res(true);
    tx.onerror = tx.onabort = async e => { if (e && e.preventDefault) e.preventDefault(); if (!again && await regFreeBig()) res(await this.put(k, v, true)); else { if (!regSpaceFail(tx.error)) showToast(TX.notSaved); res(false); } }; } catch (e) { res(false); } }); },
  async del(k) { MEMO.delete(k); regChanged(memoRow(k)); if (OLD_COPY || !(await this.open())) return; try { this.db.transaction('m', 'readwrite').objectStore('m').delete(k); } catch (e) {} },
};
// undo-history (Q2): the previous states of the undo history's rows - device only, never in a backup (registry row 'undo'),
// keyed by the log row's id; their index (time, size) is the row's small-storage part, read at once for ⋮ and the log
const UNDO_DB = {
  db: null,
  async open() { if (!this.db) this.db = await regIdbOpen(PACK.filePrefix + '_undo', 1, [['u']]); return this.db; },
  async get(k) { if (!(await this.open())) return null; return new Promise(res => { try { const q = this.db.transaction('u', 'readonly').objectStore('u').get(k); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); } catch (e) { res(null); } }); },
  async put(k, v) { if (OLD_COPY || !(await this.open())) return false; return new Promise(res => { try { const tx = this.db.transaction('u', 'readwrite'); tx.objectStore('u').put(v, k); tx.oncomplete = () => res(true);
    tx.onerror = tx.onabort = e => { if (e && e.preventDefault) e.preventDefault(); regSpaceFail(tx.error); res(false); }; } catch (e) { res(false); } }); },
  async del(keys) { if (OLD_COPY || !keys.length || !(await this.open())) return; try { const st = this.db.transaction('u', 'readwrite').objectStore('u'); keys.forEach(k => st.delete(k)); } catch (e) {} },
  async keys() { if (!(await this.open())) return []; return new Promise(res => { try { const q = this.db.transaction('u', 'readonly').objectStore('u').getAllKeys(); q.onsuccess = () => res(q.result || []); q.onerror = () => res([]); } catch (e) { res([]); } }); },
};
function memoRow(k) { return /^(frame:)?hotel:/.test(String(k)) ? 'hotelPhotos' : String(k).startsWith('trash:') ? 'trash' : 'mementos'; } // 9.8.0: a photo in the trash is a state, not a row
const MEMO_READY = (async () => { const all = await MEMO_DB.all(); all.forEach(([k, v]) => MEMO.set(k, v)); if (all.length) setTimeout(() => startupRedraw(), 0); })(); // 11.14.0 (P11): covers and hotel photos drawn once they are in
// 4.36.0: the schematic background of a trip's picture (per trip, rebuilt from OpenFreeMap)
const GEO_MEM = new Map();
const GEO_DB = {
  db: null,
  async open() { if (!this.db) this.db = await regIdbOpen(PACK.filePrefix + '_geo', 1, [['g']]); return this.db; },
  async get(k) { if (GEO_MEM.has(k)) return GEO_MEM.get(k); if (!(await this.open())) return null;
    return new Promise(res => { try { const q = this.db.transaction('g', 'readonly').objectStore('g').get(k); q.onsuccess = () => { if (q.result) GEO_MEM.set(k, q.result); res(q.result || null); }; q.onerror = () => res(null); } catch (e) { res(null); } }); },
  async put(k, v) { GEO_MEM.set(k, v); if (!(await this.open())) return; try { const tx = this.db.transaction('g', 'readwrite'); tx.objectStore('g').put(v, k); tx.onabort = () => regSpaceFail(tx.error); } catch (e) { regSpaceFail(e); } },
  async keys() { if (!(await this.open())) return []; return new Promise(res => { try { const q = this.db.transaction('g', 'readonly').objectStore('g').getAllKeys(); q.onsuccess = () => res(q.result || []); q.onerror = () => res([]); } catch (e) { res([]); } }); },
  async del(keys) { keys.forEach(k => GEO_MEM.delete(k)); if (!keys.length || !(await this.open())) return; try { const st = this.db.transaction('g', 'readwrite').objectStore('g'); keys.forEach(k => st.delete(k)); } catch (e) {} },
};
// 4.39.0: offline maps - tiles (shared between trips, each tile lists its trips) and one pack per trip
let OFF_DBH = null;
function offDB() { if (OFF_DBH) return Promise.resolve(OFF_DBH); return regIdbOpen('darkon-offmaps', 1, [['tiles'], ['packs']]).then(db => (OFF_DBH = db)); }
function offTx(store, mode, fn) { return offDB().then(db => db ? new Promise((res, rej) => { const tx = db.transaction(store, mode), st = tx.objectStore(store); let out; try { out = fn(st); } catch (e) { rej(e); return; }
  tx.oncomplete = () => res(out && 'result' in out ? out.result : out); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error); }) : null); }
function offScanTiles(write, fn, onPacks) { return offDB().then(db => db && new Promise(res => { try { const tx = db.transaction(onPacks ? ['tiles', 'packs'] : 'tiles', write ? 'readwrite' : 'readonly'), cur = tx.objectStore('tiles').openCursor();
  cur.onsuccess = () => { const c = cur.result; if (!c) return; fn(c); c.continue(); };
  if (onPacks) { const pr = tx.objectStore('packs').getAll(); pr.onsuccess = () => onPacks(pr.result || []); }
  tx.oncomplete = res; tx.onerror = res; } catch (e) { res(); } })); }
// ---- the Cache API (📚, shared files, viewed tiles) ----
function regCache(name) { return window.caches ? caches.open(name) : Promise.reject(new Error('no caches')); }
function regCacheDrop(name) { return window.caches ? caches.delete(name).catch(() => false) : Promise.resolve(false); }
async function regDiscImgDrop() { const any = await regCacheDrop('darkon-disc-img'); if (any && typeof DISC !== 'undefined') DISC.imgs = []; return any; } // 📚 pictures (their list goes with them)
// ---- storage (decisions 2026-11-23 · Storage on the phone, Q2-Q6): the device's space, each kind's size, one message for a write refused for space ----
const TILES_CACHE = 'darkon-tiles', TILES_CAP = 200 * 1048576, TILES_INDEX = '/__tiles-index'; // sw.js TILE_CAP and TILE_INDEX: the worker keeps each tile's size and last use in one entry
function regIsSpace(e) { return !!e && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22 || e.code === 1014); }
// the one message (Q6 (b)): every store's write path sends its error here; true when it was a refusal for space (then shown, once in a few seconds)
function regSpaceFail(e) { if (!regIsSpace(e)) return false; if (Date.now() - REG_SPACE.at > 4000) { REG_SPACE.at = Date.now(); showToast(TX.noSpace, { act: 'storage.open', label: TX.storage, ms: 7000 }); } return true; }
async function regCachePut(c, req, res) { try { await c.put(req, res); return true; } catch (e) { regSpaceFail(e); return false; } } // a write into the Cache API
// the space the browser gives the app (Q4): used, quota, free - null when the browser does not say
async function regSpace() { try { const e = navigator.storage && navigator.storage.estimate ? await navigator.storage.estimate() : null; if (!e || !e.quota) return null; const used = e.usage || 0; return { used, quota: e.quota, free: Math.max(0, e.quota - used) }; } catch (x) { return null; } }
const regLen = v => v == null ? 0 : typeof v === 'string' ? v.length : v instanceof Blob ? v.size : typeof v.byteLength === 'number' ? v.byteLength : JSON.stringify(v).length;
// a cache's size from its entries - known only when no entry is opaque (Q5: a size that cannot be measured is never shown as 0)
async function regCacheSize(name, skip) { if (!window.caches || !(await caches.has(name))) return { bytes: 0, n: 0, known: true };
  const c = await caches.open(name), keys = (await c.keys()).filter(r => !skip || !skip(r.url)); let bytes = 0, known = true;
  for (const r of keys) { const x = await c.match(r); if (!x || x.type === 'opaque') { known = false; continue; } try { bytes += (await x.blob()).size; } catch (e) { known = false; } }
  return { bytes, n: keys.length, known }; }
// the tiles kept on the way (Q3): from the worker's index, never by reading every tile; tiles the index does not list (an old opaque copy) make it unknown
async function regTilesSize() { if (!window.caches || !(await caches.has(TILES_CACHE))) return { bytes: 0, n: 0, known: true };
  const c = await caches.open(TILES_CACHE), keys = (await c.keys()).map(r => r.url), ik = keys.find(u => u.endsWith(TILES_INDEX)); let idx = {};
  if (ik) try { idx = await (await c.match(ik)).json(); } catch (e) { idx = {}; }
  const tiles = keys.filter(u => u !== ik), bytes = tiles.reduce((a, u) => a + (idx[u] ? idx[u][0] : 0), 0);
  return { bytes, n: tiles.length, known: tiles.every(u => idx[u]) }; }
function regTilesDrop() { return regCacheDrop(TILES_CACHE).then(x => { try { const w = navigator.serviceWorker && navigator.serviceWorker.controller; if (w) w.postMessage('tiles-cleared'); } catch (e) {} return x; }); }
// storage (Q7): the tiles kept before this version were opaque (several MB each in the browser's count) - every tile the worker's index does not list goes, once
async function regTilesOld() { const u = regRead('upkeep'); if (u.tilesSized || OLD_COPY) return;
  try { if (window.caches && await caches.has(TILES_CACHE)) { const c = await caches.open(TILES_CACHE), keys = (await c.keys()).map(r => r.url), ik = keys.find(x => x.endsWith(TILES_INDEX));
    let idx = {}; if (ik) try { idx = await (await c.match(ik)).json(); } catch (e) {}
    await Promise.all(keys.filter(x => x !== ik && !idx[x]).map(x => c.delete(x))); } } catch (e) { return; }
  regWrite('upkeep', { ...regRead('upkeep'), tilesSized: 1 }); }
migRun('tilesOpaque', () => { regTilesOld(); });
// kept from the network (Q5 🌐; item 8): opened places' pictures, the trips' schematic backgrounds, the addresses found - never the app's own files (regAppSize)
async function regNetSize() { const img = await regCacheSize('darkon-disc-img'); let geo = 0;
  for (const k of await GEO_DB.keys()) geo += regLen(await GEO_DB.get(k));
  const addr = regLen(regRawGet(PACK.geocodeKey)); return { bytes: img.bytes + geo + addr, known: img.known }; }
async function regNetClear() { await regDiscImgDrop(); await GEO_DB.del(await GEO_DB.keys()); regDrop('geocode'); }
// the app itself (item 8; decisions 2026-11-23 · Review of the finished branch storage, Q1): the shell and the libraries and fonts (darkon-libs) - part of the app, never cleared
async function regAppSize() { let bytes = 0, known = true; const names = window.caches ? (await caches.keys()).filter(k => k.startsWith('darkon-shell-') || k === 'darkon-libs') : [];
  for (const n of names) { const x = await regCacheSize(n); bytes += x.bytes; known = known && x.known; } return { bytes, known }; }
// the user's own (Q5 📷 🧳 🗑️): sizes from the stores themselves
function regMemoSizes() { const by = {}; MEMO.forEach((v, k) => { const m = /^(?:frame:)?(?:photo|pimg):([^:]+):/.exec(String(k)) || /^art:(.+)$/.exec(String(k)); if (m) by[m[1]] = (by[m[1]] || 0) + regLen(v); }); return by; }
async function regMineSize() { let bytes = regLen(regRawGet(STORE_KEY)); MEMO.forEach((v, k) => { if (memoRow(k) === 'hotelPhotos') bytes += regLen(v); });
  if (DEST_DB.ok) (await DEST_DB.all()).forEach(d => { bytes += regLen(d); }); else bytes += regLen(regRawGet(REG_BY.dests.where.ls[0])); return bytes; }
function regTrashSize() { let bytes = regLen(STATE.trash || []); DEST_DB.mem.forEach(v => { bytes += regLen(v); }); MEMO.forEach((v, k) => { if (String(k).startsWith('trash:')) bytes += regLen(v); }); return bytes; }
// when a big store is full: viewed tiles, 📚 pictures, then the schematic backgrounds of trips that aren't open (ר8)
async function regFreeBig() { let any = false;
  if (await regCacheDrop('darkon-tiles')) any = true;
  if (await regDiscImgDrop()) any = true;
  const ks = (await GEO_DB.keys()).filter(k => !String(k).startsWith('schem:' + STATE.activeTrip + ':')); if (ks.length) { await GEO_DB.del(ks); any = true; }
  return any; }
// ---- the trash by declarations (ר3, ר8): every kind says how it comes back and what leaves with it ----
const TRASH_DAYS = 30;
// a trip that left the trash for good takes its own rows with it (mementos, chip order, schematic background, offline maps)
async function regPurgeTripRows(id) {
  [...MEMO.keys()].filter(k => /^(frame:)?(photo|pimg):/.test(k) ? String(k).replace(/^frame:/, '').split(':')[1] === String(id) : k === 'art:' + id).forEach(k => MEMO_DB.del(k)); // 11.31.0: a photo's framing too
  if (STATE.chipOrder && STATE.chipOrder[id]) { const co = { ...STATE.chipOrder }; delete co[id]; STATE.chipOrder = co; persist(); }
  const gk = (await GEO_DB.keys()).filter(k => String(k).startsWith('schem:' + id + ':')); await GEO_DB.del(gk);
  if (typeof offDeletePack === 'function') try { await offDeletePack(id, true); } catch (e) {}
  const st = DEV.stamps || {}, gone = Object.keys(st).filter(k => k.split('|')[0] === String(id)); // passport-book: the trip's stamps' characters
  if (gone.length) { const o = { ...st }; gone.forEach(k => delete o[k]); devSet({ stamps: o }); }
}
// purges wait out the undo of "🧹 מחיקה לצמיתות" - the history's UNDO_DAYS (undo-history Q4: a permanent deletion frees the space
// after 3 days): they are done on an open after that, if the trip or photo didn't come back
function regQueuePurge(kind, id) { const u = regRead('upkeep'); regWrite('upkeep', { ...u, purge: (u.purge || []).concat([{ kind, id, at: Date.now() }]) }); }
async function regRunPurges() { const u = regRead('upkeep'), list = u.purge || []; if (!list.length) return;
  const back = x => x.kind === 'trip' ? !!(STATE.trips[x.id] || STATE.trash.some(t => t.kind === 'trip' && t.trip && t.trip.id === x.id)) : STATE.trash.some(t => t.kind === 'photo' && t.ref === x.id);
  const due = list.filter(x => Date.now() - x.at >= UNDO_DAYS * 864e5);
  regWrite('upkeep', { ...regRead('upkeep'), purge: list.filter(x => !due.includes(x)) });
  for (const x of due) if (!back(x)) { if (x.kind === 'trip') await regPurgeTripRows(x.id); else if (x.kind === 'photo') photoGone(x.id); }
  if (due.length) hRebase(); // a change the app made on its own: not part of the next row
}
function trashPurged(entries) { entries.forEach(t => { if (t.kind === 'trip' && t.trip) regQueuePurge('trip', t.trip.id); if (t.kind === 'photo') regQueuePurge('photo', t.ref); }); if (entries.some(t => t.kind === 'dest')) purgeDestTrashRows(); }
function trashExpire() { const old = STATE.trash.filter(t => Date.now() - t.at >= TRASH_DAYS * 864e5); if (!old.length) return; STATE.trash = STATE.trash.filter(t => !old.includes(t)); trashPurged(old); persist(); }
// ---- daily cleanup, in the background, once a day when the app opens (standard) ----
function regDailyCleanup(force) {
  const u = regRead('upkeep'), today = Math.floor(Date.now() / 864e5); if (!force && u.cleanDay === today) return;
  trashExpire();
  if (STATE.log && STATE.log.length) { const cut = Date.now() - 14 * 864e5, n = STATE.log.length; STATE.log = STATE.log.filter(e => e.at >= cut); if (STATE.log.length !== n) persist(); }
  REG.filter(r => r.ring === 'cache' && /^(age|cap)/.test(r.clean) && r.where.ls).forEach(r => {
    const s = regRawGet(regKey(r.id)); if (!s) return; let c; try { c = JSON.parse(s); } catch (e) { regDrop(r.id); return; }
    let ks = Object.keys(c), ch = false; const age = /age:(\d+)/.exec(r.clean), cap = /cap:(\d+)/.exec(r.clean);
    if (age) ks.forEach(k => { if (c[k] && c[k].at && Date.now() - c[k].at > +age[1] * 864e5) { delete c[k]; ch = true; } });
    ks = Object.keys(c); if (cap && ks.length > +cap[1]) { regByUse(r.id, ks).slice(0, ks.length - +cap[1]).forEach(k => delete c[k]); ch = true; }
    if (ch) regRawSet(regKey(r.id), JSON.stringify(c));
  });
  const use = regUse(); Object.keys(use).forEach(id => { if (!REG_BY[id] || !REG_BY[id].where.ls) { delete use[id]; return; } const c = regRead(id); Object.keys(use[id]).forEach(k => { if (!(k in c)) delete use[id][k]; }); });
  regWrite('upkeep', { ...regRead('upkeep'), cleanDay: today, use });
  hRebase(); hCleanup(); // undo-history: states older than 3 days go
}
// ---- hotel photos (ר5): mementos keyed by the place relative to its destination ("@dest:localId"), so a restore on
// another phone finds the right hotel; a trip's own place and a place added on a phone keep their ids ----
function hotelRef(id) { if (typeof id !== 'number' || id >= 1e11) return String(id);
  if (Object.values(STATE.trips).some(t => (t.places || []).some(p => p.id === id))) return String(id);
  for (const d of Object.values(DESTS)) { const loc = id - (d.idBase || 0); if (loc >= 0 && (d.places || []).some(p => p.id === loc)) return '@' + d.id + ':' + loc; }
  return String(id); }
// startup: after the big stores are ready - the queued purges and the daily cleanup
async function regStartup(destsLoaded) {
  try { await Promise.all([MEMO_READY, destsLoaded]); } catch (e) {}
  try { await DEST_DB.tload(); } catch (e) {}
  migrate('stores'); // the register's passes once IndexedDB answered (roadDays, fileRules) - before the history's base
  hRebase(); // undo-history: the state the next row is measured against
  migrate('history'); // the register's passes the user sees, each its own undo row (addKey)
  undoMenuSync();
  regRunPurges(); photoTrashOrphans(); setTimeout(() => regDailyCleanup(), 1500); }
// ---- 8.0.0 (cl-files-impl-plan stage 1, ק4): PARTS - the one list of what any file carries. A part is its rows (the
// row's "part" above); the backup, restore, sending and receiving take their parts from here and move the rows only
// through rowOut / rowIn / rowMerge. No other list of parts exists (t830 checks it).
const PART_LIST = ['trip', 'dests', 'plan', 'favorites', 'visits', 'bookings', 'edits', 'mementos', 'settings', 'log'];
const PARTS = PART_LIST.map(id => ({ id, rows: REG.filter(r => r.ring === 'mine' && r.part === id).map(r => r.id) }));
const PART_BY = Object.fromEntries(PARTS.map(p => [p.id, p]));
const BACKUP_FORMAT = 4, BACKUP_FORMAT_OLD = 2, BACKUP_FORMAT_PREV = 3, BACKUP_MIN_APP = '11.0.0', FILE_MIN_APP = '7.0.0'; // 11.0.0 (travels-1-model): format 4 - a program line of a travel's kind is a travel, merged with the travel it named; a format-3 backup is read and its trips are merged on open (travelsMerge, travelOrphansOut) // 9.0.0 (נ2): one format, nothing converted - a backup of another
// format (10.0.0: except format 2, read once through fileUp - only the plan items' name changed), a trip or destination file from before 7.0.0 (the hours' format) or with marks in the sender's numbering is not read
// what each thing offers (ק4): the whole app - every part; a trip - every part with a row of a trip or of its destinations;
// a destination - the parts whose rows are all of a destination
function partsFor(kind) {
  const of = p => p.rows.map(r => REG_BY[r].of);
  return PARTS.filter(p => kind === 'app' || (kind === 'trip' ? of(p).some(o => o === 'trip' || o === 'dest') : of(p).every(o => o === 'dest'))).map(p => p.id);
}
const SCOPE_ALL = { trips: null, dests: null };
function scopeOfTrip(tid) { const t = STATE.trips[tid]; return { trips: new Set([tid]), dests: new Set(t ? tripDests(t) : []) }; }
function memoInScope(k, sc) {
  if (!sc.trips && !sc.dests) return true; k = String(k).replace(/^frame:/, ''); // 11.31.0: a framing goes where its photo goes
  if (/^(photo|pimg):/.test(k)) return !sc.trips || sc.trips.has(k.split(':')[1]);
  if (k.startsWith('art:')) return !sc.trips || sc.trips.has(k.slice(4));
  if (k.startsWith('hotel:')) { const ref = k.slice(6), m = ref.match(/^@(.+):\d+$/); if (m) return !sc.dests || sc.dests.has(m[1]);
    return [...(sc.trips || [])].some(tid => ((STATE.trips[tid] || {}).places || []).some(p => String(p.id) === ref)); }
  return false;
}
function editsInScope(E, dests) {
  if (!dests) return E; const keep = (o, f) => Object.fromEntries(Object.entries(o || {}).filter(f));
  return { ...E, places: keep(E.places, ([id, e]) => dests.has(destOfEditId(id, e))), status: keep(E.status, ([id]) => dests.has(destOfEditId(id, (E.places || {})[id]))),
    layers: keep(E.layers, ([id, e]) => dests.has(destOfEditId(id, e))), layerOrder: keep(E.layerOrder, ([d]) => dests.has(d)) };
}
// a row's data for a file, inside a scope (all; a trip with its destinations; one destination)
function rowOut(id, sc) {
  const r = REG_BY[id], w = r.where; sc = sc || SCOPE_ALL; const inT = t => !sc.trips || sc.trips.has(t);
  if (w.td) { stashActive(); const o = {};
    Object.entries(STATE.tripData || {}).forEach(([tid, td]) => { if (!inT(tid) || !STATE.trips[tid] || !td) return; const x = {}; w.td.forEach(f => { if (td[f] !== undefined) x[f] = td[f]; }); if (Object.keys(x).length) o[tid] = x; });
    return o; }
  if (w.idb === 'memo') { const o = {}; MEMO.forEach((v, k) => { if (w.prefix.some(p => String(k).startsWith(p)) && memoInScope(k, sc)) o[k] = v; }); return o; }
  if (w.idb === 'dests') { const o = {}; Object.values(DESTS).filter(d => !d.builtin && !d.ghost && (!sc.dests || sc.dests.has(d.id))).forEach(d => { o[d.id] = d; }); return o; }
  if (r.of === 'app' && sc.trips) return {}; // countries-visited: a row of the app is out of a trip's or a destination's scope (its file)
  const o = {}; (w.blob || []).forEach(f => { let v = STATE[f];
    if (f === 'activeTrip') { if (!sc.trips) o[f] = v; return; }
    if ((f === 'trips' || f === 'chipOrder') && sc.trips) v = Object.fromEntries(Object.entries(v || {}).filter(([k]) => sc.trips.has(k)));
    if (f === 'edits') v = editsInScope(v || {}, sc.dests);
    if (f === 'log') v = (v || []).map(({ u, x, ol, b, ...e }) => e); // undo-history Q7: the history's ids stay on this device
    o[f] = v; });
  return o;
}
function partOut(id, sc) { const o = {}; PART_BY[id].rows.forEach(r => { o[r] = rowOut(r, sc); }); return o; }
// a row back from a backup (restore, ר6): what is in the file replaces what is here; trips that aren't in the file stay
// as they are; the log is joined, the device's own choices in the settings are never read
function rowIn(id, data) {
  const r = REG_BY[id], w = r.where; if (data == null) return;
  if (w.td) { STATE.tripData = { ...STATE.tripData }; // the caller stashed the open trip once, before the first row (applyRestore)
    Object.entries(data).forEach(([tid, x]) => { const td = { ...(STATE.tripData[tid] || {}) }; w.td.forEach(f => { if (x && x[f] !== undefined) td[f] = x[f]; else delete td[f]; }); STATE.tripData[tid] = td; });
    return; }
  if (w.idb === 'memo') { [...MEMO.keys()].filter(k => w.prefix.some(p => String(k).startsWith(p)) && !(k in data)).forEach(k => MEMO_DB.del(k)); Object.entries(data).forEach(([k, v]) => MEMO_DB.put(k, v)); return; }
  if (w.idb === 'dests') { Object.values(data).forEach(x => { if (x && x.id && !(DESTS[x.id] && DESTS[x.id].builtin)) DESTS[x.id] = x; }); saveDests(); return; }
  (w.blob || []).forEach(f => { if (!(f in data)) return; const v = data[f];
    if (f === 'activeTrip') { if (v && STATE.trips[v]) STATE.activeTrip = v; return; }
    if (r.id === 'log') { const seen = new Set(STATE.log.map(e => e.at + e.text)); STATE.log = STATE.log.concat((v || []).filter(e => !seen.has(e.at + e.text)).map(({ u, x, ol, b, ...e }) => e)).sort((a, b) => a.at - b.at); return; } // undo-history Q7: a row from a backup is read-only (no state on this device)
    if (f === 'settings') { STATE.settings = Object.assign({}, STATE.settings, v || {}); return; }
    if (f === 'theme') { if (v) STATE.theme = v; return; }
    if (f === 'edits') { STATE.edits = JSON.parse(JSON.stringify(v || {})); ensureEditsShape(); return; }
    STATE[f] = JSON.parse(JSON.stringify(v)); });
}
// a trip's row fields joined into what is here, by the row's merge rule (ק18: added, nothing deleted)
function rowMerge(id, cur, inc) {
  const r = REG_BY[id]; cur = cur || {}; inc = inc || {}; const out = { ...cur };
  (r.where.td || []).forEach(f => { const a = cur[f], b = inc[f]; if (b === undefined) return; if (a === undefined) { out[f] = b; return; }
    if (r.merge === 'add-days-kept') return; // the plan: below, together
    if (Array.isArray(a) && Array.isArray(b)) { const seen = new Set(a.map(x => JSON.stringify(x))); out[f] = a.concat(b.filter(x => !seen.has(JSON.stringify(x)))); return; }
    if (a && typeof a === 'object' && b && typeof b === 'object') { out[f] = { ...b, ...a }; return; } // what is here wins (union and mine-stays alike)
  });
  if (r.merge === 'add-days-kept') return mergePersonal(out, inc);
  return out;
}
// 8.0.0: a backup of format 1 (7 parts by the old bk) is read once as format 2 (cl-files-impl-plan stage 1)
function versionLess(a, b) { const x = String(a || '0').split('.').map(Number), y = String(b || '0').split('.').map(Number); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) < (y[i] || 0); } return false; }
devLoad();
// ================= END DATA REGISTRY =================

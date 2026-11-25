// ================= 6.0.0: DATA REGISTRY - the one mechanism for everything stored on this device =================
// Mechanism map: `darkon/spec/data-registry.md`; decisions ר1-ר9 (cl-cand-data-registry).
// Every access to storage (localStorage, IndexedDB, the Cache API) is in this block - no other code touches storage.
// One row per thing with its own meaning, in one of three rings: mine (in the backup, with its part) · device (stays on
// this phone) · cache (rebuilt when needed). The trash and the draft are states of rows (REG_STATES), not rows.
// Each row: id, name, ring, of (trip / dest / app), where, part (the files topic's part, ק4),
// del (what deleting does), draft, merge (a file that arrives, ק18), fmt (the row's format, one for all), clean (age / cap / none).
// Guard tests: t780 (no storage outside this block, every row complete, every stored key has a row, backup round trip).
const REG_FORMAT = 7; // 9.0.0 (נ2): one format, no conversions - data or a file of another format is not read
// ---- arch-guard (1; decisions 2026-11-20 · Review of the `quality-review` report, Q8): ONE REGISTER OF STORED-DATA MIGRATIONS ----
// Every one-time pass over what is stored on this device is a row here: id; from / to - the stored form's last version and the version
// that brought the new one; what it does; done - the marker that keeps it from running twice; when - the point of the startup it runs
// at; until - the date after which it is to be removed (t1161 fails once a date passes: a session removes the row and its code, or a
// spec chat extends the date). A file's own chain (format 2 -> 3 -> 4, fileUp) is not here: it runs on every file that is opened.
// The rows hold no code: each pass stays in its part and is attached there (migRun), so this foundation part calls no later part;
// migrate(when) runs the rows of one point, in the register's order. The points, in the order they come at startup:
//   devices - the device choices read (devLoad, at the end of data-stores) · dests - the imported destinations read (destinations.js)
//   state - the stored record parsed (layer-edits) · stores - IndexedDB answered, before the undo history's base (regStartup) ·
//   destsDB - the destinations read from IndexedDB (loadDestsFromDB) · history - right after the undo history's base (regStartup):
//   a pass whose change the user is told of, with its undo.
// Only one-time conversions of old data are rows (review-fixes-11471, 4; decisions 2026-11-23 · Review of the `test-dedupe` and `one-way`
// summaries, Q2): a step that runs whenever something comes in - a built-in trip's hotels (bundleHotelsIn), the open trip's flights
// (seedFlights) - is an ordinary step of its part, with no end date.
// The stored format (REG_FORMAT, written by persist) is read by oldCopyCheck below: a newer one is never written over.
const MIGRATIONS = [
  { id: 'pickerDead', from: '9.3.0', to: '11.34.0', when: 'devices', until: '2027-05-22', what: 'the retired file-picker mark (pickerDead) cleared from the device choices', done: 'no pickerDead in the device choices' },
  { id: 'legacyDests', from: '3.0.0', to: '3.0.1', when: ['dests', 'destsDB'], until: '2027-05-22', what: 'imported destinations kept in the small storage (DEST_KEY) read at load, then moved to IndexedDB once it opens (saveDests drops the old key)', done: 'no DEST_KEY in the small storage' },
  { id: 'planItems', from: '9.8.0', to: '10.0.0', when: 'state', until: '2027-05-22', what: 'a trip\'s plan items stored as "freeItems" and a note\'s icon "free" renamed (planItemsUp, on every trip\'s stored data)', done: 'no freeItems in a trip\'s data (idempotent)' },
  { id: 'roadDays', from: '11.18.0', to: '11.19.0', when: 'stores', until: '2027-05-22', what: 'every stored trip with fixed dates and no stored choice gets the "ימים שכולם בדרך" switches the editor derived (roadDaysStored)', done: 'upkeep.roadDays' },
  { id: 'fileRules', from: '11.7.0', to: 'FILE_RULES', when: 'stores', until: '2027-05-22', what: 'stored data passes the door\'s newer rules of fileClean once (fileCleanStored; FILE_RULES is the version of the last rule)', done: 'upkeep.fileRules not below FILE_RULES' },
  { id: 'tilesOpaque', from: '4.16.0', to: '11.54.0', when: 'stores', until: '2027-05-23', what: 'the map tiles kept before the tile cache counted sizes (opaque responses, several MB each in the browser\'s count) dropped once - every tile the worker\'s index does not list (regTilesOld, data-stores.js); offline maps untouched', done: 'upkeep.tilesSized' }, // storage (decisions 2026-11-23 · Storage on the phone, Q7)
  { id: 'addKey', from: '11.56.0', to: '11.58.0', when: 'history', until: '2027-05-25', what: 'a place an AI update already doubled (a place of the AI with the exact identity of a place the user added - addSame) merged into the user\'s record once, in every destination, trip and closed trip\'s snapshot, with one message and its undo (addMergeStored, content-edits.js)', done: 'upkeep.addKey' }, // add-key (decisions 2026-11-24 · An AI update no longer doubles the places the user added, Q4)
];
function migRun(id, run) { const m = MIGRATIONS.find(x => x.id === id); if (m) m.run = run; }
function migrate(when) { MIGRATIONS.forEach(m => { if (m.run && [].concat(m.when).includes(when)) m.run(when); }); }
const S_ = f => ({ blob: [].concat(f) });               // fields of the one small-storage record (STORE_KEY), saved together by persist
const TD_ = f => ({ blob: ['tripData'], td: [].concat(f) }); // fields of each trip's personal data inside it
const REG = [
  // ---- mine: in the backup ----
  { id: 'trip', name: 'פרטי הטיול', ring: 'mine', of: 'trip', where: S_(['trips', 'activeTrip']), part: 'trip', del: 'trash+deps', trash: ['trip', 'tripPlace'], draft: true, merge: 'update-or-copy', fmt: 1, clean: 'none' },
  { id: 'chipOrder', name: 'סדר השבבים בטיול', ring: 'mine', of: 'trip', where: S_('chipOrder'), part: 'trip', del: 'with:trip', draft: false, merge: 'mine-stays', fmt: 1, clean: 'none' },
  // tripHidden's offmap (off-frame): over { area key: 'on' | 'off' | 'x' - a computed area the user changed } · extra [{ id, label, bb [s, w, n, e], named, from - the computed area's key }]
  { id: 'tripHidden', name: 'הסתרות והחלטות בטיול', ring: 'mine', of: 'trip', where: TD_(['hidden', 'closeOffer', 'offmap', 'tlOn', 'alongKm']), part: 'trip', del: 'with:trip', draft: false, merge: 'union', fmt: 1, clean: 'none' },
  { id: 'plan', name: TX.plan, ring: 'mine', of: 'trip', where: TD_(['itinerary', 'times', 'planItems', 'parked', 'planX', 'flightsSeeded']), part: 'plan', del: 'with:trip', draft: false, merge: 'add-days-kept', fmt: 1, clean: 'none' },
  { id: 'proposal', name: 'הצעת לו״ז מה-' + AI, ring: 'mine', of: 'trip', where: TD_(['proposal', 'planPrefs']), part: 'plan', del: 'with:trip', draft: false, merge: 'mine-stays', fmt: 1, clean: 'none' }, // 11.5.0 (schedule-proposal): the one waiting proposal and Claude's planning answers
  { id: 'favorites', name: TX.fav, ring: 'mine', of: 'trip', where: TD_('favorites'), part: 'favorites', del: 'with:trip', draft: false, merge: 'union', fmt: 1, clean: 'none' },
  { id: 'visits', name: TX.visited + ' ודירוגים', ring: 'mine', of: 'trip', where: TD_(['visited', 'rating', 'notReached', 'highlights', 'companions']), part: 'visits', del: 'with:trip', draft: false, merge: 'union', fmt: 1, clean: 'none' },
  { id: 'countries', name: 'מדינות שביקרנו שסומנו ביד', ring: 'mine', of: 'app', where: S_('countries'), part: 'visits', del: 'none', draft: false, merge: 'per-key', fmt: 1, clean: 'none' }, // countries-visited (Q3): { cc: { y } } - a country marked by hand, its year optional; of the app, so never in a trip's file (rowOut)
  { id: 'timeline', name: 'ציר הזמן של גוגל', ring: 'mine', of: 'trip', where: TD_('tl'), part: 'visits', del: 'with:trip', draft: false, merge: 'mine-stays', fmt: 1, clean: 'none' }, // 11.9.0 (timeline-import, Q4): the days' paths, walking km, the visits' times of places marked - a friend's trip file leaves it out (buildTripFile)
  { id: 'bookings', name: 'הזמנות', ring: 'mine', of: 'trip', where: TD_('bookings'), part: 'bookings', del: 'with:trip', draft: false, merge: 'mine-stays', fmt: 1, clean: 'none' },
  { id: 'mementoEdits', name: 'עריכת תמונת הטיול ואלבום', ring: 'mine', of: 'trip', where: TD_(['photoOrder', 'album', 'pic', 'mementoStyle']), part: 'mementos', del: 'with:trip', draft: false, merge: 'mine-stays', fmt: 1, clean: 'none' },
  { id: 'mementos', name: 'תמונות ומזכרות', ring: 'mine', of: 'trip', where: { idb: 'memo', prefix: ['photo:', 'pimg:', 'art:', 'frame:photo:'] }, part: 'mementos', del: 'trash+with:trip', trash: ['photo'], draft: false, merge: 'mine-stays', fmt: 1, clean: 'none' },
  { id: 'hotelPhotos', name: 'תמונות מלונות', ring: 'mine', of: 'dest', where: { idb: 'memo', prefix: ['hotel:', 'frame:hotel:'] }, part: 'mementos', del: 'none', draft: false, merge: 'mine-stays', fmt: 1, clean: 'none' }, // 11.31.0 (photo-frame): a photo's framing ("frame:<photo key>") is in its photo's row
  { id: 'dests', name: 'יעדים שיובאו', ring: 'mine', of: 'dest', where: { idb: 'dests', ls: [PACK.filePrefix + '_destinations_v1'] }, part: 'dests', del: 'trash', trash: ['dest'], draft: true, merge: 'update', fmt: 1, clean: 'none' },
  { id: 'edits', name: 'עריכות ביעדים', ring: 'mine', of: 'dest', where: S_('edits'), part: 'edits', del: 'trash', trash: ['place', 'layer', 'destPlace'], draft: false, merge: 'per-entry', fmt: 1, clean: 'none' },
  { id: 'settings', name: 'הגדרות', ring: 'mine', of: 'app', where: S_(['settings', 'theme']), part: 'settings', del: 'none', draft: false, merge: 'per-key', fmt: 1, clean: 'none' },
  { id: 'log', name: 'יומן שינויים', ring: 'mine', of: 'app', where: S_('log'), part: 'log', del: 'none', draft: false, merge: 'union', fmt: 1, clean: 'age:14' },
  // ---- device: stays on this phone (exempt from the backup) ----
  { id: 'esri', name: 'מפתח המפות', ring: 'device', of: 'app', where: { ls: [PACK.filePrefix + '_dev_esri'] }, part: 'exempt', del: 'none', draft: false, merge: 'none', fmt: 1, clean: 'none', fields: ['esriKey', 'esriKeyOk', 'esriKeyAt'] },
  { id: 'backupState', name: 'מצב הגיבוי', ring: 'device', of: 'app', where: S_(['lastBackupAt', 'firstUnbackedAt', 'nagSnoozeUntil', 'createdAt']), part: 'exempt', del: 'none', draft: false, merge: 'none', fmt: 1, clean: 'none' },
  { id: 'seen', name: 'מה כבר ראיתי', ring: 'device', of: 'app', where: { ls: [PACK.filePrefix + '_dev_seen'] }, part: 'exempt', del: 'none', draft: false, merge: 'none', fmt: 1, clean: 'none', fields: ['tourDone', 'tourNav', 'offTipSeen', 'hints'] },
  { id: 'today', name: 'בחירות של היום', ring: 'device', of: 'app', where: { ls: [PACK.filePrefix + '_dev_today'] }, part: 'exempt', del: 'none', draft: false, merge: 'none', fmt: 1, clean: 'none', fields: ['destPick', 'oneDestPick', 'regionPick', 'psOpen'] }, // 11.20.0: psOpen - the place search opened toward Google Maps (15 minutes); 11.21.0: with the whole form it was tapped in (psKeep)
  { id: 'views', name: 'תצוגות המסכים', ring: 'device', of: 'app', where: { ls: [PACK.filePrefix + '_dev_views'] }, part: 'exempt', del: 'none', draft: false, merge: 'none', fmt: 1, clean: 'none', fields: ['viewModes', 'baseMap', 'mapLight', 'disc', 'showLimited', 'clSteps', 'memPhotosOff', 'cvView'] }, // countries-globe (Q1): cvView - "מדינות שביקרנו" on the flat map or the globe, the last choice on this phone; 11.26.0 (closing-where, Q7): clSteps - each trip's closing step to reopen at, on this phone only; memory-photos (Q5-Q6): memPhotosOff - the memory map's photos turned off, for every trip on this phone
  { id: 'destBases', name: 'המספור של היעדים במכשיר', ring: 'device', of: 'app', where: S_('destBases'), part: 'exempt', del: 'none', draft: false, merge: 'none', fmt: 1, clean: 'none' },
  { id: 'bundleSeen', name: 'התוכן המובנה שנכנס', ring: 'device', of: 'app', where: S_('bundleSeen'), part: 'exempt', del: 'none', draft: false, merge: 'none', fmt: 1, clean: 'none' },
  { id: 'svcDiag', name: 'אבחון שירותים', ring: 'device', of: 'app', where: { ls: ['darkon_svc_diag'] }, part: 'exempt', del: 'none', draft: false, merge: 'none', fmt: 1, clean: 'age:7,cap:50' }, // 7.1.0 (ש11): daily counts and recent troubles of the services
  { id: 'upkeep', name: 'ניקוי ושימוש בזיכרונות', ring: 'device', of: 'app', where: { ls: [PACK.filePrefix + '_dev_upkeep'] }, part: 'exempt', del: 'none', draft: false, merge: 'none', fmt: 1, clean: 'none' },
  { id: 'skill', name: 'גרסת הסקיל במכשיר', ring: 'device', of: 'app', where: { ls: [PACK.filePrefix + '_dev_skill'] }, part: 'exempt', del: 'none', draft: false, merge: 'none', fmt: 1, clean: 'none', fields: ['kitDl', 'kitSeen', 'kitDismiss'] }, // skill-install (Q4): the kit last downloaded here, the newest kitVersion an AI wrote, the kit the card was put off at
  { id: 'passport', name: 'החותמות בדרכון', ring: 'device', of: 'app', where: { ls: [PACK.filePrefix + '_dev_passport'] }, part: 'exempt', del: 'none', draft: false, merge: 'none', fmt: 1, clean: 'with-trip', fields: ['stamps'] }, // passport-book (Q2, Q6): each stamp's character and whether its landing was shown ("<trip>|<destination>"); the rest is drawn from the closed trips - never in a backup or a trip file
  { id: 'reporter', name: 'פרטים לדיווח תקלה או רעיון', ring: 'device', of: 'app', where: { ls: [PACK.filePrefix + '_dev_report'] }, part: 'exempt', del: 'none', draft: false, merge: 'none', fmt: 1, clean: 'none', fields: ['repId', 'repContact', 'repSent'] }, // 10.7.0 (task feedback): a random device id, the contact remembered on this phone, the last hour's reports (the guards - trimmed on every report)
  { id: 'undo', name: 'מה שצריך כדי לבטל פעולות', ring: 'device', of: 'app', where: { idb: 'undo', ls: [PACK.filePrefix + '_dev_undo'] }, part: 'exempt', del: 'none', draft: false, merge: 'none', fmt: 1, clean: 'age:3,cap:20MB' }, // undo-history (Q2, Q7): the previous state of each undoable log row (large store) and their index (small storage); never in a backup
  { id: 'reportOut', name: 'דיווחים שממתינים לשליחה', ring: 'device', of: 'app', where: { ls: [PACK.filePrefix + '_dev_report_out'] }, part: 'exempt', del: 'none', draft: false, merge: 'none', fmt: 1, clean: 'cap:10' }, // 10.7.0: reports made offline, sent when the network returns (the oldest goes past 10)
  { id: 'shareInbox', name: 'קבצים ששותפו לאפליקציה', ring: 'device', of: 'app', where: { cache: ['darkon-share'] }, part: 'exempt', del: 'none', draft: false, merge: 'none', fmt: 1, clean: 'read-once' },
  { id: 'appShell', name: 'האפליקציה והספריות (עובד השירות)', ring: 'device', of: 'app', where: { cache: ['darkon-shell-', 'darkon-libs'] }, part: 'exempt', del: 'none', draft: false, merge: 'none', fmt: 1, clean: 'sw' },
  // ---- cache: rebuilt when needed (exempt). Of a trip: removed when the trip leaves the trash for good ----
  { id: 'schem', name: 'רקע המפה הסכמטי', ring: 'cache', of: 'trip', where: { idb: 'geo', prefix: ['schem:'] }, part: 'exempt', del: 'with:trip', draft: false, merge: 'none', fmt: 1, clean: 'with-trip' },
  { id: 'offmaps', name: 'מפות לבלי רשת', ring: 'cache', of: 'trip', where: { idb: 'off' }, part: 'exempt', del: 'with:trip', draft: false, merge: 'none', fmt: 1, clean: 'with-trip' },
  { id: 'geocode', name: 'כתובות', ring: 'cache', of: 'app', where: { ls: [PACK.geocodeKey] }, part: 'exempt', del: 'none', draft: false, merge: 'none', fmt: 1, clean: 'cap:3000' },
  { id: 'elev', name: 'גבהים', ring: 'cache', of: 'app', where: { ls: ['darkon_elev'] }, part: 'exempt', del: 'none', draft: false, merge: 'none', fmt: 1, clean: 'cap:3000' },
  { id: 'routes', name: 'מסלולים', ring: 'cache', of: 'app', where: { ls: ['darkon_routes'] }, part: 'exempt', del: 'none', draft: false, merge: 'none', fmt: 1, clean: 'cap:900' },
  { id: 'picwiki', name: 'תמונות ויקיפדיה', ring: 'cache', of: 'app', where: { ls: ['darkon_picwiki'] }, part: 'exempt', del: 'none', draft: false, merge: 'none', fmt: 1, clean: 'cap:600' },
  { id: 'rate', name: 'שער מטבע', ring: 'cache', of: 'app', where: { ls: ['darkon_rate'] }, part: 'exempt', del: 'none', draft: false, merge: 'none', fmt: 1, clean: 'cap:20' }, // 7.1.0 (ש8): kept, so the converter works offline
  { id: 'wx', name: 'תחזית מזג האוויר', ring: 'cache', of: 'app', where: { ls: ['darkon_wx'] }, part: 'exempt', del: 'none', draft: false, merge: 'none', fmt: 1, clean: 'age:4,cap:60' },
  { id: 'clim', name: 'אקלים', ring: 'cache', of: 'app', where: { ls: ['darkon_clim'] }, part: 'exempt', del: 'none', draft: false, merge: 'none', fmt: 1, clean: 'cap:60' },
  { id: 'mclim', name: 'אקלים חודשי', ring: 'cache', of: 'app', where: { ls: ['darkon_mclim_v1'] }, part: 'exempt', del: 'none', draft: false, merge: 'none', fmt: 1, clean: 'cap:60' },
  { id: 'disc', name: 'מה יש כאן', ring: 'cache', of: 'app', where: { cache: ['darkon-disc', 'darkon-disc-img'] }, part: 'exempt', del: 'none', draft: false, merge: 'none', fmt: 1, clean: 'cap:6000+20MB' },
  { id: 'viewedTiles', name: 'אריחי מפה שנצפו', ring: 'cache', of: 'app', where: { cache: ['darkon-tiles'] }, part: 'exempt', del: 'none', draft: false, merge: 'none', fmt: 1, clean: 'sw-cap' },
];
// states of rows (ר3): where they are kept; never in a backup (ר4)
const REG_STATES = [
  { id: 'trash', name: 'סל', where: { blob: ['trash'], idb: 'dests', store: 'trash', memo: ['trash:'] }, clean: 'age:30' }, // 9.8.0: a deleted photo's image stays in the mementos store ("trash:<id>")
  { id: 'draft', name: 'טיוטה', where: { ls: [PACK.filePrefix + '_draft_v1'] }, clean: 'none' },
];
const REG_BY = Object.fromEntries(REG.map(r => [r.id, r]));
const REG_FREE_ORDER = ['wx', 'clim', 'mclim', 'rate', 'picwiki', 'routes', 'elev', 'geocode']; // ר8: what goes first when space runs out
function regChanged(row) { if (REG_BY[row] && REG_BY[row].ring === 'mine') dataChanged(); } // the actions mechanism redraws by this
// ---- the small storage (localStorage) ----
// 10.1.1: the old-copy guard (standard, versions-release: "an older copy saves nothing"). Every save of the small storage carries
// the app's version (persist); a copy that finds a newer version's save - on opening (oldCopyCheck) or when another window of the
// app saves (the storage event) - becomes an old copy: the urgent banner, no writes to the device (here, MEMO_DB, saveDests), and
// any action but "רענון" only says so. A standalone app's data is per device, so this is the case of two windows of the app.
// arch-guard (1): the saving format is read here too - a record of a newer format than this copy knows (format above REG_FORMAT) is
// treated exactly as a newer version's save: an old copy, nothing written over it, the same banner.
let OLD_COPY = false;
function oldCopyCheck(raw) { let v = null, f = 0; try { const o = JSON.parse(raw); v = o.app; f = o.format; } catch (e) {}
  if (!OLD_COPY && ((v && versionLess(APP_VERSION, v)) || (typeof f === 'number' && f > REG_FORMAT))) { OLD_COPY = true; setTimeout(() => showUpdateBar(true), 0); } }
sysOn(window, 'storage', e => { if (e.key === STORE_KEY && e.newValue) oldCopyCheck(e.newValue); }); // a system event (another window saved)
function regRawGet(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
const REG_SPACE = { err: null, at: 0 }; // storage (Q6): the last refusal of the small storage (so a failed write can say it was for space) and when the one message was last shown
function regRawSet(key, str) { if (OLD_COPY) return true; try { localStorage.setItem(key, str); return true; } catch (e) { REG_SPACE.err = e; return false; } } // an old copy writes nothing - not an error
function regRawDel(key) { if (OLD_COPY) return; try { localStorage.removeItem(key); } catch (e) {} }
function regKey(id) { return REG_BY[id].where.ls[0]; }
function regRead(id, dflt, rawKey) { const s = regRawGet(rawKey || regKey(id)); if (s == null) return dflt === undefined ? {} : dflt; try { return JSON.parse(s); } catch (e) { return dflt === undefined ? {} : dflt; } }
// a write that fails for lack of room frees rebuilt memories first (ר8) and tries again; mine never fails for a memory
function regWrite(id, v, rawKey) {
  const key = rawKey || regKey(id), str = typeof v === 'string' ? v : JSON.stringify(v);
  if (regRawSet(key, str)) { regChanged(id); return true; }
  for (const c of REG_FREE_ORDER) { if (c === id) continue; if (regFreeOne(c) && regRawSet(key, str)) { regChanged(id); return true; } }
  regSpaceFail(REG_SPACE.err); return false; // storage (Q6 (b)): a refusal for space gives the one message
}
function regDrop(id) { REG_BY[id].where.ls.forEach(regRawDel); }
function regFreeOne(id) { // the forecast goes whole; the other memories lose their older half
  const key = regKey(id), s = regRawGet(key); if (!s) return false;
  if (id === 'wx' || id === 'clim' || id === 'mclim' || id === 'rate') { regRawDel(key); return true; }
  try { const c = JSON.parse(s), ks = regByUse(id, Object.keys(c)); ks.slice(0, Math.ceil(ks.length / 2)).forEach(k => delete c[k]); regRawSet(key, JSON.stringify(c)); return true; } catch (e) { regRawDel(key); return true; }
}
// ---- device choices (ר7): one object per row, read once ----
const DEV = {};
function devLoad() { REG.filter(r => r.fields).forEach(r => Object.assign(DEV, regRead(r.id))); DEV.hints = DEV.hints || {}; migrate('devices'); }
function pickerDeadOut() { if ('pickerDead' in DEV) { delete DEV.pickerDead; devSet({ hints: DEV.hints }); } } // 11.34.0 (P13, G82): the retired 9.3.0 mark, cleared once (devSet rewrites the record without it)
migRun('pickerDead', pickerDeadOut);
function devSet(patch) { Object.assign(DEV, patch); REG.filter(r => r.fields && r.fields.some(f => f in patch)).forEach(r => { const o = {}; r.fields.forEach(f => { if (DEV[f] !== undefined) o[f] = DEV[f]; }); regWrite(r.id, o); }); }

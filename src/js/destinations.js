const DEST_KEY = PACK.filePrefix + '_destinations_v1';
const DESTS = {};
BUNDLE.destinations.forEach(d => { DESTS[d.id] = { ...d, idBase: d.idBase || 0, builtin: true }; }); // destinations built into this copy
// 3.0.1: imported destinations live in IndexedDB (room for many destinations), not in the small localStorage.
// Legacy localStorage copies are read at once and moved to IndexedDB on the first open.
try { Object.values(JSON.parse(regRawGet(DEST_KEY) || '{}')).forEach(d => { if (d && d.id && !DESTS[d.id]) DESTS[d.id] = d; }); } catch (e) {}
function saveDests() {
  const list = Object.values(DESTS).filter(d => !d.builtin && !d.ghost); // 4.28.0: a destination shown only for an archived trip
  if (OLD_COPY) return true; // 10.1.1: an old copy writes nothing
  if (DEST_DB.ok) { DEST_DB.sync(list).then(ok => { if (!ok) showToast('לא הצלחתי לשמור את היעדים בטלפון'); else regRawDel(DEST_KEY); }); return true; }
  const out = {}; list.forEach(d => out[d.id] = d);
  if (regWrite('dests', out, DEST_KEY)) return true; showToast('אין מקום בטלפון לשמור את היעד'); return false;
}
async function loadDestsFromDB() {
  if (!(await DEST_DB.open())) return;
  regPersistAsk();
  const before = Object.keys(DESTS).join();
  (await DEST_DB.all()).forEach(d => { if (d && d.id && !(DESTS[d.id] && DESTS[d.id].builtin)) DESTS[d.id] = d; });
  if (regRawGet(DEST_KEY)) saveDests(); // move legacy copies into IndexedDB
  if (typeof STATE !== 'undefined' && STATE && Array.isArray(STATE.trash)) purgeDestTrashRows(); // 4.37.3: daily age cleanup also for deleted destinations
  if (typeof STATE !== 'undefined' && STATE && STATE.destBases) Object.values(DESTS).forEach(d => { STATE.destBases[d.id] = d.idBase || 0; }); // 4.2.1
  if (Object.keys(DESTS).join() !== before && typeof applyActiveTrip === 'function' && STATE) { _destTrip = null; applyActiveTrip(); syncFlightsToPlan(); updateHeader(); startupRedraw(); } // 11.14.0 (P11): the day's destination filter is chosen again, now with the destinations
}
// 11.14.0 (phone-round-1-fixes P11, G12): what the stores bring after the first draw (the destinations, the photos) draws the screen
// and the top window again - the first draw of a cold start runs before IndexedDB answers, and an overview drawn then had the
// trip with none of its destinations (fewer rows in the top card, no booking to make, no country part) until a tab switch
function startupRedraw() { if (typeof redrawSoon === 'function' && document.getElementById('main')) redrawSoon(); }
// place / layer ids of an imported destination are shifted by its idBase so they never collide
const destPlaces = d => d.places.map(p => ({ ...p, id: d.idBase + p.id, layer: d.idBase + p.layer, dest: d.id }));
const destRegions = d => (d && d.meta.regions) || [];
function regionName(p) { const d = DESTS[p.dest]; const r = d && p.region ? destRegions(d).find(x => x.id === p.region) : null; return r ? r.name : ''; }
const destLayers = d => d.meta.layers.map(l => ({ ...l, id: d.idBase + l.id, dest: d.id }));
let BASE_PLACES = [];            // places of the active trip's destinations
const POINTS = [];               // BASE_PLACES + this device's edits, rebuilt by rebuildPoints()
const LAYER_DEFS = [];           // layers of the active trip's destinations
function layerDef(id) { return LAYER_DEFS.find(l => l.id === id) || { id, label: '?', name: '?', color: '#888', icon: 'tourist_attraction' }; }

// 4.9.0: ⭐ and 📅 are filters of the points and the map; their tabs in the plan are shortcuts (goTab turns them into the filter).
// The regions screen left: the 🗺️ אזור picker does the same.
const INFO_GROUP = [
  {id: 'info', label: 'מידע כללי'},
];
const PLAN_GROUP = [ // 5.15.0 (ד2): the plan only - ⭐ and 📅 are in the filter window 
  {id: 'itinerary', label: 'התוכנית'},
];
const POINTS_GROUP = [{id: 'all', label: 'הכל', color: '#3A3D42'}]; // + layers, filled by applyActiveTrip()


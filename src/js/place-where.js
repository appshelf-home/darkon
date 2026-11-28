// ================= WHERE THE TRAVELLERS ARE (11.67.0, task big-dest-search; decisions 2026-11-26 · Finding places in a large destination, Q1-Q5) =================
// One chain of clues for every search for a place that has a context (it belongs to a trip or a destination), nearest first; a search takes
// the first clue that exists, and the nearer clue biases it, never walls it in: (1) that night's lodging with a point - a trip place
// scheduled on a day, a travel's end on its date; (2) the place's region centre - the region's own `center` from the file, else the centre
// of the region's places already found; (3) the destination's centre; (4) the whole country (the destination's `country`), only with a
// result whose name and city fit. Read by the background lookup (geocodeAddress_), every typed search with a context (psRun: the place
// editor's location field and its full-screen pick, a travel's ends and their proposal, the closing's other places, the trip picture's point
// in place mode) and a Google link's fallback area (psFindByText). Searches with no context keep their own rule: the destination editor's
// "מרכז המפה", the picture's "עיר שעברנו בה", "לחפש בכל מקום".
const WH_KM = { lodging: 60, region: 150 }; // a clue's box, half its side in km (a region is a city or the surroundings one visits - Q5's 150 km)
const WH_WIDE = { dest: 'נמצא בכל היעד', country: 'נמצא בכל המדינה' }; // the typed search's quiet line when it widened (Q3)
function whLL(c) { return c && isFinite(c.lat) && isFinite(c.lng) ? [+c.lat, +c.lng] : Array.isArray(c) && c.length === 2 && c.every(isFinite) ? [+c[0], +c[1]] : null; }
function whDestOf(x) { return x.d || DESTS[x.dest] || (x.layer != null && DESTS[layerDef(x.layer).dest]) || null; }
// every place of a destination known on the phone: the destination's own, the open trip's view, every trip's own places
function whPlaces(did) { const m = new Map(), add = p => { if (p && (p.dest || (p.layer != null && layerDef(p.layer).dest)) === did && !m.has(p.address || p.id)) m.set(p.address || p.id, p); }; // by address: a destination's own ids are local (idBase)
  ((DESTS[did] && DESTS[did].places) || []).forEach(p => add({ ...p, dest: did })); POINTS.forEach(add); Object.values(STATE.trips || {}).forEach(t => (t.places || []).forEach(add));
  return [...m.values()]; }
// a region's centre: its own `center` ({lat, lng}, kit 3.12.0), else the middle (the median, so one wrong point does not move it) of its places found
function whRegionCenter(d, rid) { const r = d && rid ? destRegions(d).find(x => x.id === rid) : null; if (!r) return null; const own = whLL(r.center); if (own) return own;
  const cs = whPlaces(d.id).filter(p => p.region === rid).map(routeCoordOf).filter(Boolean); if (!cs.length) return null;
  const med = a => { a = a.slice().sort((x, y) => x - y); const h = a.length >> 1; return a.length % 2 ? a[h] : (a[h - 1] + a[h]) / 2; };
  return [med(cs.map(c => c.lat)), med(cs.map(c => c.lng))]; }
// that night's lodging with a point (a night: checkIn <= date < checkOut)
function whNight(t, iso) { const l = iso && (t.lodging || []).find(x => x && x.checkIn && x.checkOut && x.checkIn <= iso && iso < x.checkOut); if (!l || l.placeId == null) return null;
  const p = (t.places || []).find(x => x.id === l.placeId) || POINTS.find(x => x.id === l.placeId); return p ? whLL(routeCoordOf(p)) : null; }
// the days a trip place is scheduled on: the organized schedule, and in the open trip my plan too
function whDays(t, id) { if (id == null || !t) return []; const ds = (t.schedule || []).filter(s => s && s.placeId === id && s.date).map(s => s.date);
  if (t === activeTripObj()) TRIP_DAYS.forEach(d => { if (d.date && isInDay(d.key, id)) ds.push(d.date); }); return [...new Set(ds)].sort(); }
// placeWhere(x) - x: { id, dest | d | layer, region, date, t } (a place, or a travel's end with its date). -> { clues: [{ k, c }], cc, dc, did } or null
function placeWhere(x) { x = x || {}; const d = whDestOf(x); if (!d || !d.meta) return null; const t = 't' in x ? x.t : hasTrip() ? activeTripObj() : null, out = []; // a draft's place: t null - no night of mine
  const add = (k, c) => { if (c && !out.some(o => distanceKm({ lat: o.c[0], lng: o.c[1] }, { lat: c[0], lng: c[1] }) < 20)) out.push({ k, c }); };
  if (t && !(t.segments || []).length || t && (t.segments || []).some(g => g.dest === d.id)) { const date = x.date || whDays(t, x.id)[0]; add('lodging', whNight(t, date)); }
  add('region', whRegionCenter(d, x.region)); add('dest', whLL(d.meta.center));
  return { clues: out, cc: String(d.meta.country || '').toUpperCase(), dc: whLL(d.meta.center), did: d.id }; }
// a where, a function that gives one (read when its turn comes), or a bare centre (the chain of one destination, no country)
function whOf(x) { if (typeof x === 'function') { try { x = x(); } catch (e) { x = null; } } if (!x) return null; if (x.clues) return x; const c = whLL(x); return c ? { clues: [{ k: 'dest', c }], cc: '', dc: c, did: null } : null; }
// a draft's place: the draft's destination (not on the phone yet) - its regions' centres from the file, its centre, its country
function draftWhereOf(x) { const dp = x.dp || draftDestById(DRAFT, x.p.dest); return dp && dp.meta ? placeWhere({ ...x.p, d: dp, t: null }) : null; }
function whFirst(W) { return W && W.clues && W.clues[0] || null; }
// a clue's box: the lodging's and the region's around their point; the destination's is the destination's own box (psBox)
function whBox(cl) { if (!cl) return null; if (cl.k === 'dest') return psBox(cl.c); const km = WH_KM[cl.k] || 150, dl = km / 111, dg = km / (111 * Math.max(0.2, Math.cos(cl.c[0] * Math.PI / 180)));
  return { s: cl.c[0] - dl, n: cl.c[0] + dl, w: cl.c[1] - dg, e: cl.c[1] + dg, c: cl.c }; }
// the country step's fit (Q2): the result is in the destination's country, and the address's city (any part after the name, not the
// country) is the result's city, district or state - "Petrohué" falls exist elsewhere
// loose (the in-box steps): an address with no city part, or a result named in another script, fits in the box; the country step is strict
function whCityFit(x, address, cc, loose) { if (cc && x.cc && x.cc !== cc) return false; if (cc && !x.cc) return false;
  const where = psNorm([x.city, x.district, x.state, x.sub].filter(Boolean).join(' ')), ctry = psNorm(x.country || '');
  const parts = String(address || '').split(',').map(s => psNorm(s)).slice(1).filter(s => s.length >= 3 && !/^\d+$/.test(s) && s !== ctry && !/^\d/.test(s));
  if (loose && (!parts.length || HEB_CH.test(where) !== parts.some(t => HEB_CH.test(t)))) return true; // in a clue's box: no city to compare, or names in two scripts (Photon's Hebrew in Israel)
  return !!where && parts.some(s => where.includes(s) || (psNorm(x.city).length >= 3 && s.includes(psNorm(x.city)))); }
// the lookup's name fit: psNameMatch, or the same words in another order ("Sierra Nevada Hotel" is "Hotel Sierra Nevada" - measured live
// on the phone file, 26.11.2026); every word of the shorter name (two at least, of three letters or more) in the longer one
function whNameFit(a, b) { if (psNameMatch(a, b)) return true; const w = s => psNorm(s).split(' ').filter(x => x.length >= 3), x = w(a), y = w(b), [s, l] = x.length <= y.length ? [x, y] : [y, x];
  return s.length >= 2 && s.every(t => l.includes(t)); }
// the background lookup's last step: the whole country, a fitting name and city only - never the first result alone
async function geoCountry(name, address, W) { const c = (whFirst(W) || {}).c || W.dc;
  for (const q of [String(address || '').toLowerCase().includes(String(name).toLowerCase()) ? address : name + ', ' + address, name]) {
    const r = await placeSearch(q, c, { explicit: true, limit: 10, prio: 'bg', anywhere: true, cc: W.cc, noHe: true }); if (r === null) throw GEO_NO;
    const hit = r.find(x => (x.names || []).concat(x.name).some(n => n && whNameFit(n, name)) && whCityFit(x, address, W.cc)); if (hit) return { lat: hit.coord.lat, lng: hit.coord.lng }; }
  return null; }
// ---- Q4: places already not found, looked up once more with the chain (a row of the migration register: geoAgain) ----
async function geoAgain() { const u = regRead('upkeep'); if (u.geoAgain || !MAP_AVAILABLE) return; const todo = [], seen = new Set();
  const take = (p, w) => { if (!p || !p.address || p.manualCoord || p.quiet || seen.has(p.address) || !(p.address in GEOCODE_CACHE) || GEOCODE_CACHE[p.address] !== null) return; seen.add(p.address); todo.push({ p, w }); };
  Object.values(STATE.trips || {}).forEach(t => (t.places || []).forEach(p => take(p, () => placeWhere({ ...p, t }))));
  Object.values(DESTS).forEach(d => (d.places || []).forEach(p => take(p, () => placeWhere({ ...p, d }))));
  todo.forEach(x => { delete GEOCODE_CACHE[x.p.address]; delete GEO_NONE_AT[x.p.address]; });
  const res = await Promise.all(todo.map(x => new Promise(res => queueGeocode(x.p.address, res, x.w, x.p.name))));
  const n = res.filter(Boolean).length; regWrite('upkeep', { ...regRead('upkeep'), geoAgain: APP_VERSION, geoAgainFound: n, geoAgainOf: todo.length });
  if (n) { showToast(`נמצאו ${n} מקומות שלא נמצאו קודם`); redrawSoon(); } return n; }
migRun('geoAgain', () => { setTimeout(() => { geoAgain().catch(e => errNote('geoAgain', e)); }, 4000); }); // after the opening's own lookups have started

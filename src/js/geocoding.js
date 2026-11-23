// 7.1.0 (ש8): stored as {lat, lng, at} or {none: 1, at}; the screens read a clean view - a place, or null for "not found";
// a "not found" older than 30 days leaves the view, so the address is asked again (once a month, within Nominatim's terms)
const GEO_NONE_AT = {};
function loadGeocodeCache() {
  const c = regRead('geocode'), v = {};
  Object.keys(c).forEach(k => { const e = c[k]; if (!e || typeof e !== 'object') return;
    if (e.none) { if (svcFresh('geocode', e)) { v[k] = null; GEO_NONE_AT[k] = e.at; } }
    else if (isFinite(e.lat) && isFinite(e.lng)) v[k] = e; });
  return v;
}
function saveGeocodeCache(cache) {
  const out = {}; Object.keys(cache).forEach(k => { const e = cache[k];
    if (e == null) out[k] = { none: 1, at: GEO_NONE_AT[k] || (GEO_NONE_AT[k] = Date.now()) };
    else if (isFinite(e.lat) && isFinite(e.lng)) out[k] = e.at ? e : { lat: +e.lat, lng: +e.lng, at: Date.now() }; });
  regWrite('geocode', out);
}
let GEOCODE_CACHE = MAP_AVAILABLE ? loadGeocodeCache() : {};
// one question to the address service; first = the provider asked first (the other answers when it is busy).
// Returns a place, null (a real "not found"), or throws GEO_NO (no network, busy, an error): nothing is kept then.
const GEO_NO = new Error('geocode: no answer');
async function geoOne(first, q, center, bounded, address) {
  const r = await svcAsk('geocode', { key: address, order: first === 'photon' ? ['photon', 'nominatim'] : ['nominatim', 'photon'],
    build: prov => { if (prov === 'nominatim') { // 4.2.2: a destination's center biases the search to its area (viewbox, not bounded); 4.47.7: bounded - only inside it
        const d = bounded ? 1.2 : 0.7, vb = center ? `&viewbox=${center[1] - d},${center[0] + d},${center[1] + d},${center[0] - d}${bounded ? '&bounded=1' : ''}` : '';
        return { url: 'https://nominatim.openstreetmap.org/search?format=json&limit=1' + vb + '&q=' + encodeURIComponent(q), init: { headers: { 'Accept-Language': 'en' } } }; }
      const c = center || curDest().meta.center; return { url: 'https://photon.komoot.io/api/?limit=1&lat=' + c[0] + '&lon=' + c[1] + '&q=' + encodeURIComponent(q) }; },
    parse: (data, prov) => { if (prov === 'nominatim') { if (!Array.isArray(data)) throw new Error('answer'); return data[0] ? { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) } : SVC_EMPTY; }
      if (!data || !Array.isArray(data.features)) throw new Error('answer'); const f = data.features[0]; if (!f) return SVC_EMPTY; const [lng, lat] = f.geometry.coordinates; return { lat, lng }; } });
  if (r.kind === 'ok') return r.value; if (r.kind === 'empty') return null; throw GEO_NO;
}
function nominatimQuery(q, center, bounded, address) { return geoOne('nominatim', q, center, bounded, address); }
function photonQuery(q, center, address) { return geoOne('photon', q, center, false, address); }
const HU_STREET_RE = /((?:[A-ZÁÉÍÓÖŐÚÜŰ][\wÁÉÍÓÖŐÚÜŰáéíóöőúüű'\.]*\s+){0,3}(?:utca|tér|út|körút|krt\.?|rakpart|sétány|híd|köz|udvar|fasor))\s*(\d{1,4})?/;
function extractStreetToken(address) {
  const m = address.match(HU_STREET_RE);
  if (!m) return null;
  return (m[1] + (m[2] ? ' ' + m[2] : '')).trim();
}
async function geocodeAddress(address, center, name) { try { return await geocodeAddress_(address, center, name); } catch (e) { if (e === GEO_NO) return undefined; throw e; } }
async function geocodeAddress_(address, center, name) { // undefined (above): no answer this time - nothing is kept, asked again later
  // 4.2.2: Budapest addresses keep the tuned Hungarian search; any other destination searches near its own center
  const isHU = /budapest|hungary|magyarorsz/i.test(address) || !!extractStreetToken(address);
  if (!isHU) {
    const c = center || curDest().meta.center;
    // 4.47.7: the same name can exist elsewhere (Haifa's "טיילת לואי" landed in Jerusalem): first only inside the
    // destination's area, then anywhere - and a result far from every destination it may belong to is dropped
    const cs = center ? [center] : geoCentersNow(), near = r => r && (!cs.length || cs.some(k => distanceKm({ lat: k[0], lng: k[1] }, r) <= geoLimitKm(k))) ? r : null;
    const fb = geocodeFallbacks(address); let coord = null;
    const bc = center || (cs.length === 1 ? cs[0] : null); // inside one known area only - a trip across destinations searches each address everywhere
    if (bc) for (const q of [address, ...fb]) { coord = await nominatimQuery(q, bc, true, address); if (coord) break; }
    if (!coord) coord = near(await nominatimQuery(address, c, false, address));
    if (!coord) coord = near(await photonQuery(address, c, address));
    // 4.37.0: addresses that open with the place's name ("Mercado Central, San Pablo 967, Santiago") or give a road
    // kilometer ("Av. Bustillo km 17.5") fail as a whole - try again without the name, without the km, then name + town
    if (!coord) for (const q of fb) { coord = near(await nominatimQuery(q, c, false, address)); if (coord) break; }
    if (!coord && fb.length) coord = near(await photonQuery(fb[fb.length - 1], c, address));
    if (!coord && name && bc) coord = await geoByName(name, address, bc); // 11.20.0 (place-search-upgrade, Q6): then the name with the address, inside the area
    return coord;
  }
  const withCountry = /hungary/i.test(address) ? address : address + ', Hungary';
  const streetToken = extractStreetToken(address);
  const attempts = [withCountry];
  if (streetToken) attempts.push(streetToken + ', Budapest, Hungary');
  else {
    const words = address.replace(/,?\s*Budapest\s*$/i, '').split(' ').filter(Boolean);
    if (words.length > 2) attempts.push(words.slice(1).join(' ') + ', Budapest, Hungary');
  }
  let coord = null;
  for (let i = 0; i < attempts.length && !coord; i++) coord = await nominatimQuery(attempts[i], null, false, address);
  if (!coord) coord = await photonQuery(streetToken ? streetToken + ', Budapest' : withCountry, null, address);
  return coord;
}

// 11.20.0 (Q1, Q6): the place's name with its address through the improved open search, inside the destination's box; a result is
// taken by itself only when its name matches the place's name - otherwise "not found", fixed in the place's editor
async function geoByName(name, address, c) { const q = String(address || '').toLowerCase().includes(String(name).toLowerCase()) ? address : name + ', ' + address;
  const r = await placeSearch(q, c, { explicit: true, limit: 5, prio: 'bg' }); if (r === null) throw GEO_NO;
  const hit = r.find(x => (x.names || []).concat(x.name).some(n => n && psNameMatch(n, name))); return hit ? { lat: hit.coord.lat, lng: hit.coord.lng } : null; }
function geocodeFallbacks(address) {
  const parts = String(address || '').split(',').map(x => x.trim()).filter(Boolean), out = [];
  const noKm = x => x.replace(/\s*\b(?:km|k\.m\.|ק"מ)\s*[\d.,]+/gi, '').replace(/\s{2,}/g, ' ').trim();
  const add = q => { q = q.replace(/\s*,\s*,/g, ',').trim(); if (q && q !== address && !out.includes(q)) out.push(q); };
  const km = parts.some(p => /\bkm\s*[\d.,]/i.test(p));
  // a road kilometer alone would land on the middle of a long road, so with km the place's name always stays in the search
  if (parts.length > 2 && !km) add(parts.slice(1).join(', '));
  if (parts.length > 2) add(parts[0] + ', ' + parts.slice(2).join(', '));
  if (km) add(parts.map(noKm).filter(Boolean).join(', '));
  return out;
}
// how far from a destination's center a found address may be: a city 150 km, a destination with regions (a country) 700
function geoLimitKm(c) { if (!c) return Infinity; const d = Object.values(DESTS).find(x => x.meta && Array.isArray(x.meta.center) && Math.abs(x.meta.center[0] - c[0]) < 1e-6 && Math.abs(x.meta.center[1] - c[1]) < 1e-6);
  return d && ((d.regions || d.meta.regions || []).length) ? 3000 : 250; } // a city: day trips reach ~200 km; a country with regions can be long (Chile) - only another continent is dropped
function geoCentersNow() { const out = []; const add = d => { const c = d && d.meta && d.meta.center; if (Array.isArray(c) && !out.some(k => k[0] === c[0] && k[1] === c[1])) out.push(c); };
  try { add(curDest()); } catch (e) {} try { const t = activeTripObj(); (t && t.segments || []).forEach(g => add(DESTS[g.dest])); } catch (e) {}
  try { if (DRAFT && DRAFT.data) (draftNewDests(DRAFT).concat(draftOldDests(DRAFT))).forEach(add); } catch (e) {} return out; }
const _geocodeInFlight = {}; // address -> Promise
const _geocodeQueue = [];
let _queueRunning = false;
function queueGeocode(address, onDone, center, name) {
  // 4.47.7: an answer kept from before that is far from this destination is looked up again
  { const v = GEOCODE_CACHE[address], cs = center ? [center] : geoCentersNow(); if (v && cs.length && !cs.some(k => distanceKm({ lat: k[0], lng: k[1] }, v) <= geoLimitKm(k))) delete GEOCODE_CACHE[address]; }
  if (address in GEOCODE_CACHE) { if (onDone) onDone(GEOCODE_CACHE[address]); return; }
  if (!(address in _geocodeInFlight)) {
    _geocodeInFlight[address] = new Promise((resolve) => {
      _geocodeQueue.push({ address, resolve, center, name });
      runQueue();
    });
  }
  if (onDone) _geocodeInFlight[address].then(onDone);
}
async function runQueue() {
  if (_queueRunning) return;
  _queueRunning = true;
  while (_geocodeQueue.length) {
    const { address, resolve, center, name } = _geocodeQueue.shift();
    if (address in GEOCODE_CACHE) { resolve(GEOCODE_CACHE[address]); delete _geocodeInFlight[address]; continue; }
    const coord = await geocodeAddress(address, center, name);
    if (coord !== undefined) { GEOCODE_CACHE[address] = coord || null; if (!coord) GEO_NONE_AT[address] = Date.now(); saveGeocodeCache(GEOCODE_CACHE); } // 7.1.0 (ש4, ש9): no answer is not "not found"
    resolve(coord === undefined ? null : coord);
    delete _geocodeInFlight[address];
  }
  _queueRunning = false;
}
async function ensureGeocoded(points, onProgress, onEach) {
  const todo = points.filter(p => !p.manualCoord && !p.quiet && !(p.address in GEOCODE_CACHE));
  let done = 0; if (onProgress && todo.length) onProgress(0, todo.length); // 7.1.0: counts answered addresses (found or a real "not found"); no answer is not counted
  await Promise.all(points.map(p => new Promise((resolve) => {
    if (p.manualCoord) {
      GEOCODE_CACHE[p.address] = p.manualCoord;
      if (onEach) onEach(p, p.manualCoord);
      resolve();
      return;
    }
    if (p.quiet) { if (onEach) onEach(p, null); resolve(); return; } // 11.46.0 (P4): a quiet place's address is never sent - on a trip or in a destination
    queueGeocode(p.address, (coord) => {
      if (todo.includes(p)) { if (p.address in GEOCODE_CACHE) done++; if (onProgress) onProgress(done, todo.length); }
      if (onEach) onEach(p, coord);
      resolve();
    }, DESTS[p.dest] && DESTS[p.dest].meta.center, p.name);
  })));
}

let userPos = null; // {lat, lng} once granted
function requestUserLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => { userPos = { lat: pos.coords.latitude, lng: pos.coords.longitude }; resolve(userPos); },
      () => resolve(null),
      { timeout: 8000 }
    );
  });
}
function distanceKm(a, b) {
  const R = 6371, dLat = (b.lat-a.lat)*Math.PI/180, dLng = (b.lng-a.lng)*Math.PI/180;
  const s = Math.sin(dLat/2)**2 + Math.cos(a.lat*Math.PI/180)*Math.cos(b.lat*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1-s));
}


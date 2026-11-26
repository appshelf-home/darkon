// ================= PLACE SEARCH (11.20.0, task place-search-upgrade; decisions/2026-11-15-place-search.md Q1, "Q2 again", Q4, Q6, Q8, Q9) =================
// The one search by name for every window that looks for a place (the place editor's location field, the full-screen point picker,
// a travel's ends - the choice and the automatic proposal -, the trip picture's point). Two open services through the services client
// (service placeSearch): Photon during typing pauses, Nominatim only on an explicit search ("חיפוש" / Enter - its usage policy forbids
// autocomplete; the client keeps its one request a second). Results are merged without duplicates, kept inside a box around the
// destination (its places and center) with "לחפש בכל מקום" at the end, proximity before prominence (Photon's bias radius and scale),
// 20 a page with "עוד תוצאות". A result's name: Hebrew where the map has one, else English, else the local name (editable).
// The kept location is the result's own point. "לחפש בגוגל מפות" opens Google Maps on the same query and remembers the open search for
// 15 minutes (DEV.psOpen), so a place shared back from Google Maps (the share target, or a link pasted into the field) fills that field;
// 11.21.0 (Q3): with the whole form it was tapped in, reopened as it was left (psFormBack).
// 11.28.0 (area-search; decisions 2026-11-18 · An area search, Q1-Q5): a host declares its kind, 'place' (default) or 'area'. An area search
// asks Photon only for areas (PS_AREA_TAGS: places of the map, administrative and park boundaries, mountain ranges, peninsulas, lakes) and
// keeps a result only when PS_AREA_KIND names it (Nominatim: filtered after the answer); no box - anywhere, by prominence, or with a bias
// toward the host's point (the trip picture's city); every row says its kind and country; "לחפש גם מקומות" runs the same query as places.
// Guards: t1084, t1102.
// MS_MORE: restaurant local_cafe local_bar hotel museum theater_comedy castle church park beach_access landscape flight train directions_bus storefront attractions location_city water location_on
const PS_PAGE = 20, PS_TYPE_MS = 600, PS_OPEN_MIN = 15;
const PS_IC = [[/restaurant|fast_food|food_court|biergarten/, 'restaurant'], [/cafe|bakery|ice_cream/, 'local_cafe'], [/^bar$|pub|nightclub|wine/, 'local_bar'],
  [/hotel|hostel|guest_house|motel|apartment|chalet|camp_site/, 'hotel'], [/museum|gallery/, 'museum'], [/theatre|cinema|arts_centre|music_venue/, 'theater_comedy'],
  [/castle|fort|ruins|monument|memorial|archaeological/, 'castle'], [/place_of_worship|church|cathedral|chapel|synagogue|mosque|temple/, 'church'],
  [/park|garden|nature_reserve|national_park/, 'park'], [/beach/, 'beach_access'], [/peak|volcano|viewpoint|cliff|glacier|mountain/, 'landscape'],
  [/aerodrome|airport/, 'flight'], [/station|halt|railway|subway/, 'train'], [/bus/, 'directions_bus'], [/shop|mall|marketplace|supermarket|department_store/, 'storefront'],
  [/attraction|zoo|theme_park|aquarium|artwork/, 'attractions'], [/city|town|village|hamlet|suburb|neighbourhood|quarter|borough/, 'location_city'], [/water|lake|river|bay|waterfall/, 'water']];
function psIcon(cls, type) { const t = String(type || '') + ' ' + String(cls || ''); const m = PS_IC.find(([re]) => re.test(String(type || '')) || re.test(t)); return m ? m[1] : 'location_on'; }
function psCenterOf(near) { return near === false ? null : near && isFinite(near.lat) ? [+near.lat, +near.lng] : Array.isArray(near) ? near : (curDest() && curDest().meta.center) || null; }
// the destination a point belongs to: the nearest center (among the given ids, or every destination on the phone)
function psDestNear(ll, ids) { let best = null, bd = Infinity; (ids || Object.keys(DESTS)).forEach(k => { const d = DESTS[k], c = d && d.meta && d.meta.center; if (!Array.isArray(c)) return;
  const km = distanceKm({ lat: c[0], lng: c[1] }, { lat: ll[0], lng: ll[1] }); if (km < bd) { bd = km; best = d; } }); return best; }
// the box around the destination: its center and its places within reach of it, padded (at least ~15 km each way)
function psBox(c) { if (!c) return null; const d = psDestNear(c), dc = d ? d.meta.center : c, lim = d ? geoLimitKm(dc) : 250;
  let s = dc[0], n = dc[0], w = dc[1], e = dc[1]; const add = (la, ln) => { s = Math.min(s, la); n = Math.max(n, la); w = Math.min(w, ln); e = Math.max(e, ln); };
  if (d) POINTS.forEach(p => { if ((p.dest || layerDef(p.layer).dest) !== d.id) return; const q = routeCoordOf(p); if (q && distanceKm({ lat: dc[0], lng: dc[1] }, q) <= lim) add(q.lat, q.lng); });
  if (distanceKm({ lat: dc[0], lng: dc[1] }, { lat: c[0], lng: c[1] }) <= lim) add(c[0], c[1]);
  const pl = Math.max(0.15, (n - s) * 0.2), pg = Math.max(0.2, (e - w) * 0.2);
  return { s: s - pl, n: n + pl, w: w - pg, e: e + pg, c: dc }; }
function psNorm(x) { return String(x || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\p{N} ]+/gu, ' ').replace(/\s+/g, ' ').trim(); }
function psNameMatch(a, b) { const x = psNorm(a), y = psNorm(b); return x.length >= 3 && y.length >= 3 && (x === y || x.includes(y) || y.includes(x)); }
// the name rule (Q2 again): Hebrew if the map has one, else English, else the local name
function psName(nd, fb) { nd = nd || {}; return nd['name:he'] || nd['name:en'] || nd.name || fb || ''; }
var PLACE_SEARCH_WHY = '', PS_LAST = '';
// ---- the area kind (11.28.0, area-search Q2): what counts as an area, and its kind word. Photon's osm_tag filters are OR-ed (checked
// against the live service 19.11.2026: a layer filter and an osm_tag filter together are AND-ed, so layers are not used; natural=water also
// brings rivers - "Eger" - so lakes come by their water=* tag, which Photon indexes as the key "water")
const PS_AREA_TAGS = ['place', 'boundary:administrative', 'boundary:national_park', 'boundary:protected_area', 'leisure:nature_reserve', 'natural:mountain_range', 'natural:peninsula', 'water:lake', 'water:reservoir', 'water:lagoon'];
const PS_AREA_KIND = [[/^place:city$/, 'עיר'], [/^place:town$/, 'עיירה'], [/^place:(village|hamlet)$/, 'כפר'], [/^place:(suburb|neighbourhood|quarter|borough)$/, 'שכונה'],
  [/^place:country$/, 'מדינה'], [/^place:(state|province|county|district|municipality)$/, 'מחוז'], [/^place:(region|locality|area)$/, 'אזור'],
  [/^place:(island|islet)$/, 'אי'], [/^place:archipelago$/, 'קבוצת איים'], [/^natural:peninsula$/, 'חצי אי'], [/^boundary:national_park$/, 'פארק לאומי'],
  [/^(boundary:protected_area|leisure:nature_reserve)$/, 'שמורה'], [/^natural:mountain_range$/, 'רכס הרים'], [/^water:(lake|reservoir|lagoon)$/, 'אגם']];
// a boundary is named by its rank (Photon's type, Nominatim's addresstype)
const PS_AREA_RANK = [[/^country$/, 'מדינה'], [/^(state|province|county|region|state_district)$/, 'מחוז'], [/^city$/, 'עיר'], [/^(town|municipality)$/, 'עיירה'], [/^village$/, 'כפר'], [/^(suburb|neighbourhood|quarter|borough|city_district)$/, 'שכונה']];
function psAreaKind(cls, rank) { cls = String(cls || ''); if (/^natural:water$/.test(cls) && rank === 'lake') return 'אגם';
  if (/^boundary:(administrative|region)$/.test(cls)) { const r = PS_AREA_RANK.find(([re]) => re.test(String(rank || ''))); return r ? r[1] : 'אזור'; }
  const m = PS_AREA_KIND.find(([re]) => re.test(cls)); return m ? m[1] : ''; }
// an extent as { s, w, n, e } (Photon: [minLon, maxLat, maxLon, minLat]; Nominatim: [minLat, maxLat, minLon, maxLon] as strings)
function psExtPhoton(x) { return Array.isArray(x) && x.length === 4 && x.every(isFinite) ? { w: +x[0], n: +x[1], e: +x[2], s: +x[3] } : null; }
function psExtNominatim(b) { const v = Array.isArray(b) ? b.map(parseFloat) : []; return v.length === 4 && v.every(isFinite) ? { s: v[0], n: v[1], w: v[2], e: v[3] } : null; }
function psInExt(c, x) { return !!(x && c && c.lat >= x.s && c.lat <= x.n && c.lng >= x.w && c.lng <= x.e); }
// the zoom that shows an area's extent with its point in the middle (the small map's pin is the value; Q4: the map fits the area)
function psExtZoom(map, c, x) { if (!map || !x || !c) return null; const dh = Math.max(Math.abs(x.n - c.lat), Math.abs(c.lat - x.s), 0.005), dw = Math.max(Math.abs(x.e - c.lng), Math.abs(c.lng - x.w), 0.005);
  try { const z = map.getBoundsZoom([[c.lat - dh, c.lng - dw], [c.lat + dh, c.lng + dw]]); return isFinite(z) ? Math.max(2, Math.min(15, z)) : null; } catch (e) { return null; } }
// the row's second line for an area: its kind and its country ("אי · יוון")
function psAreaLine(x) { return [x.area, (x.cc && countryName(x.cc)) || x.country].filter(Boolean).join(SEP); }
// Photon has no Hebrew: English abroad (the local name where the map has no English one), the local name - Hebrew - in Israel
// 11.28.0 (area-search): kind 'area' - the area tags, no box, and a wide bias (a region, not a street: zoom 7, scale 0.2 - "Tata" near Budapest
// puts Tata, Hungary first; measured 19.11.2026)
// place-find (Q1): lang given - a Google link's English address is matched against English street names (Israel's default is Hebrew)
function psPhoton(q, c, box, lim, kind, lang) { const area = kind === 'area';
  return 'https://photon.komoot.io/api/?lang=' + (lang || (c && inIsrael({ lat: c[0], lng: c[1] }) ? 'default' : 'en')) + '&limit=' + lim + (c ? '&lat=' + c[0] + '&lon=' + c[1] + (area ? '&zoom=7&location_bias_scale=0.2' : '&zoom=12&location_bias_scale=0.1') : '')
  + (box && !area ? '&bbox=' + [box.w, box.s, box.e, box.n].map(v => v.toFixed(4)).join(',') : '') + (area ? PS_AREA_TAGS.map(t => '&osm_tag=' + t).join('') : '') + '&q=' + encodeURIComponent(q); }
function psNominatim(q, box, lim) { return 'https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&namedetails=1&limit=' + lim
  + (box ? '&viewbox=' + [box.w, box.n, box.e, box.s].map(v => v.toFixed(4)).join(',') + '&bounded=1' : '') + '&q=' + encodeURIComponent(q); }
function psFromPhoton(f, q) { const pr = f.properties || {};
  return { name: pr.name || q, names: [pr.name], sub: [pr.street && (pr.street + (pr.housenumber ? ' ' + pr.housenumber : '')), pr.district, pr.city].filter(Boolean).join(', '), city: pr.city || '', state: pr.state || '', country: pr.country || '',
    coord: { lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] }, ic: psIcon(pr.osm_key, pr.osm_value), key: pr.osm_type && pr.osm_id ? String(pr.osm_type)[0].toUpperCase() + pr.osm_id : '', cc: String(pr.countrycode || '').toUpperCase(), cls: (pr.osm_key || '') + ':' + (pr.osm_value || ''), // cc, cls: 11.23.2 (P11) - a travel end's proposal checks the country and the kind
    ext: psExtPhoton(pr.extent), area: psAreaKind((pr.osm_key || '') + ':' + (pr.osm_value || ''), pr.type), hn: pr.housenumber || '', street: pr.street || '', district: [pr.district, pr.locality].filter(Boolean).join(' ') }; } // hn, street, district: place-find (Q1) - a building, the street, the district words // ext, area: 11.28.0 (area-search) - the extent the small map fits, the kind word
function psFromNominatim(r, q) { const nd = r.namedetails || {}, a = r.address || {}, local = nd.name || r.name || String(r.display_name || '').split(',')[0];
  return { name: psName(nd, local) || q, names: [nd['name:he'], nd['name:en'], local], sub: [a.road && (a.road + (a.house_number ? ' ' + a.house_number : '')), a.suburb || a.neighbourhood, a.city || a.town || a.village].filter(Boolean).join(', '),
    city: a.city || a.town || a.village || '', state: a.state || '', country: a.country || '', coord: { lat: parseFloat(r.lat), lng: parseFloat(r.lon) }, ic: psIcon(r.category, r.type),
    key: r.osm_type && r.osm_id ? String(r.osm_type)[0].toUpperCase() + r.osm_id : '', cc: String(a.country_code || '').toUpperCase(), cls: (r.category || r.class || '') + ':' + (r.type || ''),
    ext: psExtNominatim(r.boundingbox), area: psAreaKind((r.category || r.class || '') + ':' + (r.type || ''), r.addresstype), hn: a.house_number || '', street: a.road || '', district: [a.suburb, a.neighbourhood, a.quarter, a.city_district].filter(Boolean).join(' ') }; }
// merged without duplicates: the same map object, or the same name within 150 m; the Hebrew name wins where one side has it
// 11.28.0 (area-search): in an area list, the same name in the same country with one point inside the other's extent is one area
// (Crete the island and Crete the region; Paris the city and its boundary) - the better ranked one stays
function psAreaDedup(list) { const out = [];
  const ns = x => (x.names || []).concat(x.name).filter(Boolean).map(psNorm); // every name it has (the Hebrew one merged in, the local, the English)
  list.forEach(x => { if (!out.some(y => y.cc === x.cc && ns(x).some(n => ns(y).includes(n)) && (psInExt(x.coord, y.ext) || psInExt(y.coord, x.ext)))) out.push(x); }); return out; }
function psMerge(a, b) { const out = a.slice();
  b.forEach(x => { const i = out.findIndex(y => (x.key && x.key === y.key) || (distanceKm(x.coord, y.coord) < 0.15 && x.names.concat(x.name).some(n => n && y.names.concat(y.name).some(m => m && psNameMatch(n, m)))));
    if (i < 0) out.push(x); else if (HEB_CH.test(x.name) && !HEB_CH.test(out[i].name)) out[i] = { ...out[i], name: x.name, names: out[i].names.concat(x.names) }; });
  return out; }
// placeSearch(q, near, o) -> [{name, sub, city, state, country, coord, ic, km}] (maybe empty; .more: there may be more, .boxed: inside the
// destination's box) or null with PLACE_SEARCH_WHY saying why. o: { explicit (Nominatim too), anywhere (no box), page, limit, prio,
// kind: 'place' (default) | 'area' (11.28.0: areas only, never a box - near is a bias; each result's .area is its kind word) }
async function placeSearch(q, near, o) {
  o = o || {}; if (o.kind === 'area' && !o.noWiki && HEB_CH.test(q)) return psAreaHe(q, near, o); // 11.28.2 (area-search-he): a Hebrew area name also through Wikidata
  const area = o.kind === 'area', c = psCenterOf(near), box = o.box || (o.anywhere || area ? null : psBox(c)) /* place-find: o.box - a box given (a city's, for a link) */, lim = Math.min(50, (o.limit || PS_PAGE) * ((o.page || 0) + 1)), nlim = Math.min(40, lim);
  const ask = (prov, url, parse) => svcAsk('placeSearch', { order: [prov], prio: o.prio, build: p => p === prov ? { url, init: prov === 'nominatim' ? { headers: { 'Accept-Language': 'en' } } : undefined } : null, parse });
  const rs = await Promise.all([ask('photon', psPhoton(q, c, box, lim, o.kind, o.lang), d => { if (!d || !Array.isArray(d.features)) throw new Error('answer'); return d.features.map(f => psFromPhoton(f, q)); }),
    o.explicit ? ask('nominatim', psNominatim(q, box, nlim), d => { if (!Array.isArray(d)) throw new Error('answer'); return d.map(r => psFromNominatim(r, q)); }) : null]);
  const ok = rs.filter(r => r && r.kind === 'ok');
  if (!ok.length) { const off = rs.some(r => r && r.kind === 'offline'); PS_LAST = off ? 'offline' : 'busy'; PLACE_SEARCH_WHY = off ? SVC_MSG.offline : SVC_MSG.busy; return null; }
  PS_LAST = '';
  const p = rs[0] && rs[0].kind === 'ok' ? rs[0].value : [], n = rs[1] && rs[1].kind === 'ok' ? rs[1].value : [], ctr = box ? box.c : c;
  const m0 = psMerge(p, n), m = area ? psAreaDedup(m0.filter(x => x.area)) : m0; // Nominatim has no filter for the natural areas: its answer is filtered here
  let list = m.map(x => ({ ...x, km: ctr ? distanceKm({ lat: ctr[0], lng: ctr[1] }, x.coord) : null })).slice(0, lim);
  if (!area && !o.noHe && HEB_CH.test(q) && ctr && !inIsrael({ lat: ctr[0], lng: ctr[1] })) list = await psPlaceHe(q, near, o, list); // place-find (Q2): Hebrew abroad through Wikidata - the one change the measurement kept
  if (!area && !o.stops) list = psStopsDown(q, list); // size-fixes (A): a transit stop below the places of a fitting name
  list.more = p.length >= lim && lim < 50 || n.length >= nlim && nlim < 40; list.boxed = !!box; list.kind = area ? 'area' : 'place'; return list;
}
// size-fixes (A; decisions/2026-11-20-review-night-chain-20.11.2026.md Q5): a public-transport stop named for a place ("Sammy Ofer Stadium",
// a bus stop 280 m from the stadium) is not the place - a stop goes below every other result whose name fits the query, unless the query
// asks for a stop (PS_STOP_WORDS). Not in a travel's end search (o.stops: it wants stations and stops - END_PROP_KIND). Measured with
// tests/psmeasure.py (live and the offline replay) - no row worse.
const PS_STOP_CLS = /^(highway:bus_stop|public_transport:(platform|stop_position)|railway:(tram_stop|halt|stop|platform))$/; // a stop, not a station (a station is a place people look for)
const PS_STOP_WORDS = /תחנ|\b(stop|station|halt|platform|bus|tram)\b/i;
function psStopsDown(q, list) { if (!list || !list.length || PS_STOP_WORDS.test(q)) return list;
  const stop = x => PS_STOP_CLS.test(x.cls || ''), fits = x => (x.names || []).concat(x.name).some(n => n && psNameMatch(n, q));
  let last = -1; list.forEach((x, i) => { if (!stop(x) && fits(x)) last = i; }); if (last < 0) return list;
  const moved = list.slice(0, last).filter(stop), out = list.filter((x, i) => !(i < last && stop(x))), at = out.indexOf(list[last]) + 1;
  const r = out.slice(0, at).concat(moved, out.slice(at)); r.more = list.more; return r; }
// place-find (Q2; decisions/2026-11-20-place-from-google-link.md; tests/psmeasure.py): a place search in Hebrew outside Israel - Photon
// has no Hebrew and Nominatim knows few Hebrew names of places abroad ("ישו הגואל", "גשר השלשלאות" while typing). Wikidata's Hebrew
// labels (psWikiAreas: the label or alias is the query, the entity has a point) give the English label; it is searched in the same box,
// and a result whose name fits it within PS_HE_KM of the entity's point comes first, named in Hebrew. Measured on the 54 typed rows:
// typing 48 → 50 first, Enter 50 → 51, none worse. The other changes measured were not kept (none raised the hits, or they lowered
// them): Photon asked in both languages (0), Nominatim while typing (+2, but its usage policy forbids autocomplete), a chain's name
// re-ranked (−1) or searched alone (0), a word dropped for a typo (−3 on Enter), the last letter dropped (0), Photon with no box (−3).
const PS_HE_KM = 5;
async function psPlaceHe(q, near, o, list) { const fit = (x, n) => (x.names || []).concat(x.name).some(m => m && psNameMatch(m, n)), es = await psWikiAreas(q, o);
  for (const e of es.slice(0, 2)) { const l = await placeSearch(e.en, near, { ...o, noHe: true }) || [];
    const hit = l.filter(x => fit(x, e.en) && distanceKm(x.coord, e.coord) <= PS_HE_KM).map(x => ({ ...x, name: e.he, names: (x.names || []).concat(x.name) }));
    if (hit.length) return hit.concat(list.filter(x => !hit.some(h => h.key && h.key === x.key))); }
  return list; }
// ---- an area search in Hebrew (11.28.2, task area-search-he; decisions 2026-11-19 · Review of the 11.28.0 summary, Q1) ----
// The open map services carry no Hebrew name for many areas ("כרתים" found Kramim, "טוסקנה" nothing). A Hebrew area query also asks
// Wikidata (service areaNames): its Hebrew labels and aliases (wbsearchentities, prefix-ranked), kept when the label or alias that matched
// is the query itself (a trailing "(…)" aside - "כרתים (אינדיאנה)") and the entity has a point on Earth (GeoData's primary coordinate:
// mythology, people and works have none); then each one's English label (entityterms) - the first PS_WD_EN distinct labels - runs the same
// area search, biased toward the entity's point when the host gives no bias of its own, so the area filter (PS_AREA_KIND) decides what is
// an area. Their results come first (the meaning Wikidata gives the Hebrew word), then the Hebrew query's own, one list by psAreaDedup;
// a row near an entity's point (inside its extent or within PS_WD_KM) takes the entity's Hebrew label. Wikidata offline or failing: the
// Hebrew query's results alone, quietly. Guards: t1102 (B).
const PS_WD = 'https://www.wikidata.org/w/api.php?format=json&origin=*', PS_WD_EN = 2, PS_WD_KM = 50;
function psWdBare(t) { return psNorm(String(t || '').replace(/\s*\([^)]*\)\s*$/, '')); }
async function psWikiAreas(q, o) {
  const ask = (url, parse) => svcAsk('areaNames', { prio: o.prio, build: p => p === 'wikidata' ? { url, ms: 8000 } : null, parse });
  const s = await ask(PS_WD + '&action=wbsearchentities&type=item&language=he&uselang=he&limit=7&search=' + encodeURIComponent(q),
    d => { if (!d || !Array.isArray(d.search)) throw new Error('answer'); return d.search.length ? d.search : SVC_EMPTY; });
  if (s.kind !== 'ok') return [];
  const nq = psWdBare(q), hits = s.value.filter(x => x && /^Q\d+$/.test(x.id) && [x.match && x.match.text, x.label].some(t => t && psWdBare(t) === nq));
  if (!hits.length) return [];
  const g = await ask(PS_WD + '&action=query&prop=coordinates|entityterms&wbetterms=label&wbetlanguage=en&titles=' + hits.map(x => x.id).join('|'),
    d => { if (!d || !d.query || !d.query.pages) throw new Error('answer'); return d.query.pages; });
  if (g.kind !== 'ok') return [];
  const by = {}; Object.values(g.value).forEach(pg => { if (pg && pg.title) by[pg.title] = pg; });
  return hits.map(x => { const pg = by[x.id] || {}, c = (pg.coordinates || []).find(k => k && isFinite(k.lat) && isFinite(k.lon) && (!k.globe || k.globe === 'earth')),
      en = ((pg.entityterms || {}).label || [])[0];
    return c && en ? { id: x.id, en: String(en), he: String(x.label || '').replace(/\s*\([^)]*\)\s*$/, '') || q, coord: { lat: +c.lat, lng: +c.lon } } : null; }).filter(Boolean); }
async function psAreaHe(q, near, o) { const o1 = { ...o, noWiki: true }, c = psCenterOf(near);
  const [own, wd] = await Promise.all([placeSearch(q, near, o1), psWikiAreas(q, o)]), why = [PS_LAST, PLACE_SEARCH_WHY];
  const groups = []; wd.forEach(e => { const g = groups.find(x => psNorm(x.en) === psNorm(e.en)); if (g) g.es.push(e); else if (groups.length < PS_WD_EN) groups.push({ en: e.en, es: [e] }); });
  const theirs = await Promise.all(groups.map(g => placeSearch(g.en, c ? near : [g.es[0].coord.lat, g.es[0].coord.lng], o1)));
  const named = []; theirs.forEach((l, i) => (l || []).forEach(x => { const e = groups[i].es.find(e => psInExt(e.coord, x.ext) || distanceKm(e.coord, x.coord) <= PS_WD_KM);
    named.push(e && e.he && !HEB_CH.test(x.name) ? { ...x, name: e.he, names: (x.names || []).concat(x.name) } : x); }));
  if (own === null && theirs.every(l => l === null)) { [PS_LAST, PLACE_SEARCH_WHY] = why; return null; }
  PS_LAST = ''; const lim = Math.min(50, (o.limit || PS_PAGE) * ((o.page || 0) + 1));
  const list = psAreaDedup(named.concat(own || [])).map(x => ({ ...x, km: c ? distanceKm({ lat: c[0], lng: c[1] }, x.coord) : null })).slice(0, lim);
  list.more = !!(own && own.more) || theirs.some(l => l && l.more); list.boxed = false; list.kind = 'area'; list.wd = groups.length; return list; }
// ---- the window (Q8): one host per search field; its state draws into its box (or by its own draw, the travel end's choice window) ----
// 11.28.0 (area-search): a host's kind - kind: 'place' (default) | 'area', or a function that says it now (the picture's "עיר שעברנו בה")
const PS_HOSTS = {}; let _psN = 0;
function psKindOf(H) { const k = H && (typeof H.kind === 'function' ? H.kind() : H.kind); return k === 'area' ? 'area' : 'place'; }
function psHost(o) { Object.keys(PS_HOSTS).forEach(k => { const b = PS_HOSTS[k].box && PS_HOSTS[k].box(); if (!b || !b.isConnected) delete PS_HOSTS[k]; });
  const id = 'ps' + (++_psN); PS_HOSTS[id] = { ...o, id, st: null, seq: 0 }; return id; }
function psSpecial(q) { return /^https?:\/\//.test(q) || /maps\.app\.goo\.gl|goo\.gl\/|google\.[a-z.]+\/maps/.test(q) || /^-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?$/.test(q); }
function psTyping(id, q) { const H = PS_HOSTS[id]; if (!H) return; clearTimeout(H.t); q = String(q || '').trim();
  if (q.length < 3 || psSpecial(q)) return; H.t = setTimeout(() => { if (H.flight) { H.next = q; return; } psRun(id, q, 'typing'); }, PS_TYPE_MS); }
async function psRun(id, q, how) { const H = PS_HOSTS[id]; if (!H) return; q = String(q || '').trim(); if (!q) return; clearTimeout(H.t);
  const s0 = H.st, same = !!(s0 && s0.q === q), hk = psKindOf(H);
  // 11.28.0 (area-search Q5): "לחפש גם מקומות" ('places') - the same query as places, anywhere; "עוד תוצאות" goes on in the same kind
  const places = hk === 'area' && (how === 'places' || (same && how === 'more' && s0.places));
  const st = { q, explicit: how === 'explicit' || how === 'places' || (same && s0.explicit && how !== 'typing'), anywhere: how === 'any' || how === 'places' || hk === 'area' || (same && how === 'more' && s0.anywhere),
    page: how === 'more' && same ? s0.page + 1 : 0, list: s0 && s0.list, more: false, kind: '', busy: true, area: hk === 'area' && !places, places, hk };
  const seq = ++H.seq; H.st = st; psDraw(H);
  const fl = H.flight = placeSearch(q, H.near ? H.near() : undefined, { explicit: st.explicit, anywhere: st.anywhere, page: st.page, limit: PS_PAGE, kind: st.area ? 'area' : 'place' });
  const r = await fl; if (H.flight === fl) H.flight = null;
  if (seq === H.seq) { st.busy = false; if (r === null) { st.kind = PS_LAST || 'busy'; st.list = s0 && same ? s0.list : null; } else { st.list = r; st.more = !!r.more; st.kind = r.length ? '' : (st.anywhere ? 'none' : 'area'); } psDraw(H); }
  if (H.next) { const n = H.next; H.next = null; if (n !== q) psRun(id, n, 'typing'); } }
function psDraw(H) { if (H.draw) return H.draw(H); const b = H.box && H.box(); if (b && b.isConnected) b.innerHTML = psHTML(H); }
function psRowsHTML(H) { const st = H.st; return (st && st.list || []).map((x, i) => `<button type="button" class="pe-res ps-row" data-act="ps.res" data-v="${H.id}:${i}">${msi(x.ic || 'location_on', { size: 20 })}<span class="ps-t"><b>${escH(x.name)}</b><small>${escH([st.area && x.area ? psAreaLine(x) : x.sub || [x.city, x.country].filter(Boolean).join(', '), x.km != null ? fmtKm(x.km) : ''].filter(Boolean).join(SEP))}</small></span></button>`).join(''); }
function psGmUrl(q) { return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q); }
function psBtns(H, ks) { const st = H.st, B = { any: `<button type="button" class="chip" data-act="ps.any" data-v="${H.id}">${msi('travel_explore', { size: 18 })} לחפש בכל מקום</button>`,
    more: `<button type="button" class="chip" data-act="ps.more" data-v="${H.id}">${msi('expand_more', { size: 18 })} עוד תוצאות</button>`,
    places: st.area ? `<button type="button" class="chip ps-places" data-act="ps.places" data-v="${H.id}">${msi('location_on', { size: 18 })} לחפש גם מקומות</button>` : '',
    map: H.map ? `<button type="button" class="chip" data-act="ps.map" data-v="${H.id}">${msi('pin_drop', { size: 18 })} לבחור על המפה</button>` : '',
    gm: H.gm === false ? '' : `<a class="chip" href="${escH(psGmUrl(st.q))}" target="_blank" rel="noopener" data-act="ps.gm" data-v="${H.id}">${msi('map', { size: 18 })} לחפש בגוגל מפות</a>` };
  const h = ks.map(k => B[k]).filter(Boolean).join(''); return h ? `<div class="brow tight ps-end">${h}</div>` : ''; }
function psFootHTML(H) { const st = H.st; if (!st) return ''; const L = [];
  if (st.busy) L.push(waitLineHTML('מחפשים')); // 11.46.0 (P3): the one stage line of a wait
  else if (st.kind === 'offline') L.push(`<small class="ps-line">אין רשת${SEP}אפשר לבחור על המפה, או לחפש כשהרשת חוזרת</small>${psBtns(H, ['map'])}`);
  else if (st.kind === 'busy') L.push(`<small class="ps-line">${PLACE_SEARCH_WHY}</small>${psBtns(H, ['map', 'gm'])}`);
  else if (st.kind === 'area') L.push(`<small class="ps-line">לא נמצא באזור היעד</small>${psBtns(H, ['any', 'map', 'gm'])}`);
  else if (st.kind === 'none') L.push(`<small class="ps-line">לא נמצא</small>${st.area && HEB_CH.test(st.q) ? `<small class="ps-line ps-en">אפשר לנסות לכתוב את השם באנגלית</small>` : ''}${psBtns(H, ['places', 'map', 'gm'])}`); // 11.28.0: an area search's empty state offers places (Q5); 11.28.2 (area-search-he): a Hebrew area name not found adds the English hint
  if ((st.kind === 'area' || st.kind === 'none' || st.kind === 'busy') && H.gm !== false && !MAP_AVAILABLE) L.push(`<small class="ps-line">בעותק שבתוך קלוד אין שיתוף מגוגל מפות בחזרה לאפליקציה</small>`);
  return L.join(''); }
// 11.21.0 (review of the night chain Q5): the same two ways out in every state - a quiet fixed row at the end of every results list, after
// "עוד תוצאות" and "לחפש בכל מקום" ("not found" states keep their own buttons)
// 11.21.1 (form-keep-everywhere, found 3): inside Claude (no share back) the row leaves out the Google Maps link - the quieter choice;
// "לבחור על המפה" stays where the host has it
function psOtherHTML(H) { const st = H.st, L = [];
  if (H.gm !== false && MAP_AVAILABLE) L.push(`<a class="link-btn" href="${escH(psGmUrl(st.q))}" target="_blank" rel="noopener" data-act="ps.gm" data-v="${H.id}">לחפש בגוגל מפות</a>`);
  if (H.map) L.push(`<button type="button" class="link-btn" data-act="ps.map" data-v="${H.id}">לבחור על המפה</button>`);
  return L.length ? `<p class="ps-other">לא מה שחיפשתם? ${L.join(SEP)}</p>` : ''; }
function psEndHTML(H) { const st = H.st; return st && !st.busy && st.list && st.list.length && !st.kind ? psBtns(H, [st.more && 'more', !st.anywhere && 'any', 'places'].filter(Boolean)) + psOtherHTML(H) : ''; }
function psHTML(H) { const st = H.st; if (!st) return ''; const top = st.busy ? psFootHTML(H) : '', rows = psRowsHTML(H);
  return `${top}${rows ? `<div class="ps-rows">${rows}</div>` : ''}${st.busy ? '' : psFootHTML(H)}${psEndHTML(H)}`; }
act('ps.res', c => { const [id, i] = String(c.v).split(':'), H = PS_HOSTS[id], x = H && H.st && H.st.list && H.st.list[+i]; if (!x) return 'quiet'; H.st = null; psDraw(H); H.pick(x); return 'quiet'; });
act('ps.more', c => { const H = PS_HOSTS[c.v]; if (H && H.st) psRun(c.v, H.st.q, 'more'); return 'quiet'; });
act('ps.any', c => { const H = PS_HOSTS[c.v]; if (H && H.st) psRun(c.v, H.st.q, 'any'); return 'quiet'; });
act('ps.places', c => { const H = PS_HOSTS[c.v]; if (H && H.st) psRun(c.v, H.st.q, 'places'); return 'quiet'; }); // 11.28.0 (area-search Q5)
act('ps.map', c => { const H = PS_HOSTS[c.v]; if (H && H.map) H.map(); return 'quiet'; });
// the link opens Google Maps itself (its href); the open search is remembered for 15 minutes, so the place shared back fills it (Q9 (2))
// 11.21.0 (Q6): the snackbar says the one step the window cannot show - coming back by a share
// 11.21.1 (form-keep-everywhere, found 2): every tap replaces what was stored - a host with no form stores only { at, q }, so a share never
// reopens an earlier form; (found 3) inside Claude there is no share back, so no snackbar promises one
act('ps.gm', c => { const H = PS_HOSTS[c.v]; if (!H) return 'quiet'; let f = null; try { f = H.ret ? H.ret() : null; } catch (e) { errNote('ps.gm', e); }
  devSet({ psOpen: { at: Date.now(), q: H.st ? H.st.q : '', ...(f || {}) } }); if (MAP_AVAILABLE) showToast(PS_GM_BACK); return 'quiet'; });
const PS_GM_BACK = 'בגוגל מפות: שיתוף ← דרכון';
// ---- "הבאה מגוגל מפות" (Q9): a Google Maps link, shared or pasted - the name, the place's own point (before the view center), Google's id ----
function psGid(u) { const d = (() => { try { return decodeURIComponent(u || ''); } catch (e) { return u || ''; } })();
  if (gidDirLink(d)) return ''; // 11.23.1 (gid-fixes item 2): a directions link's first id is its origin - the link is kept as it is
  const m = d.match(/[?&]query_place_id=([\w-]{10,})/) || d.match(/place_id[:=]([\w-]{10,})/) || d.match(/[?&]cid=(\d{5,})/) || d.match(/!1s(0x[0-9a-f]+:0x[0-9a-f]+)/i) || d.match(/[?&]ftid=(0x[0-9a-f]+:0x[0-9a-f]+)/i);
  return m ? m[1] : ''; }
// the link kept with the place: one that opens exactly that place - by Google's id when the link has one, else the link itself
function psKeepUrl(r) { const id = r.gid; if (/^ChIJ/.test(id)) return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(r.name || 'place') + '&query_place_id=' + id;
  if (/^\d+$/.test(id)) return 'https://www.google.com/maps?cid=' + id; return r.url; }
// a short link (maps.app.goo.gl) is followed by the app's own server function (service mapsLink) - the phone cannot follow it itself
async function psExpand(url) { if (!MAP_AVAILABLE) return null;
  const r = await svcAsk('mapsLink', { prio: 'screen', build: () => ({ url: location.origin + '/api/maps-link?u=' + encodeURIComponent(url) }), parse: d => { if (!d || typeof d.url !== 'string') throw new Error('answer'); return d.url; } });
  return r.kind === 'ok' && /^https:\/\/([a-z0-9-]+\.)*google\.[a-z.]+\//.test(r.value) ? r.value : null; }
// -> { coord, name, url (to keep), gid, short } or null (no link or coordinates in the text)
// o.idOnly (place-find, the relink): only Google's id is wanted - no point is looked for
async function psReadLink(text, o) { const r = parseMapsLink(text); if (!r) return null; o = o || {};
  if (!r.coord && r.short && r.url) { const long = await psExpand(r.url); if (long) { const r2 = parseMapsLink(long); if (r2) { r.coord = r2.coord; r.name = r.name || r2.name; r.long = long; } } else r.unread = true; }
  if (!r.coord && o.known) { const rec = gidFromUrl(r.long || r.url); if (rec && o.known(rec)) { r.rec = rec; r.gid = psGid(r.long || r.url); r.url = r.url ? psKeepUrl({ ...r, url: r.long || r.url }) : ''; return r; } } // 11.46.0 (P3): Google's id of a place already in the trip - no search by name
  if (!r.coord) { const tx = psLinkText(r.long || r.url); if (tx) { if (!o.idOnly && o.stage) o.stage('find'); const f = o.idOnly ? null : await psFindByText(tx); // 11.46.0 (P3): o.stage - the wait's next stage // 11.21.6 (P2); place-find (Q1): (a) the name in the address's city, (b) the building, (c) a view only
      if (f && f.coord) { r.coord = f.coord; r.byText = true; r.found = { name: f.name, sub: f.sub, how: f.how }; } else if (f && f.view) r.view = f.view; r.name = tx.name || r.name; } }
  else if (r.name && r.name.indexOf(',') > 0) r.name = r.name.split(',')[0].trim(); // a place's link names it with its address: the name alone
  r.gid = psGid(r.long || r.url); r.rec = gidFromUrl(r.long || r.url); r.url = r.url ? psKeepUrl({ ...r, url: r.long || r.url }) : ''; return r; } // 11.22.0: rec - Google's id ({ id, cid }) for the place's gid
// 11.21.6 (phone-round-2-fixes P2, G38): Google's share links now often carry no point - only the place's name and address
// ("/maps/place/Burger+Saloon,+Pinhas+%26+Abraham+Rutenberg+St+2,+Haifa,+3509416/data=…", a Search page's "q=…"). The text is split
// into the name (before the first comma) and the address, and the point is found by the place search (Nominatim too, anywhere): the
// first result whose name matches, else the first whose street (a word of the address's street) and city match - the address's point.
// Only when nothing matches: no point, as before. The point found is a search pick (the form's line "כדאי לוודא על המפה").
// phone-round-4b-fixes P1 (G92, G95; phone round 4 on 11.38.2): a short link the server function could not open (the test address answered
// 401 once its Netlify sign-in lapsed - the installed app's page comes from the worker's copy, so the login page never shows) is marked
// r.unread: no address is known, so no point is taken from the share text's name alone (it found another branch of Burger Saloon - never
// another branch, Q1); the line says the link could not be read (PS_NO_POINT), not that Google sends no point
function psLinkText(u) { if (!u) return null; let m = String(u).match(/\/maps\/place\/([^/@?]+)/) || String(u).match(/[?&]q=([^&#]+)/); if (!m) return null;
  let t = m[1].replace(/\+/g, ' '); try { t = decodeURIComponent(t); } catch (e) {} t = t.replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim(); // 11.22.0: Google's Hebrew names end in a direction mark (U+202D) if (!t || /^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(t)) return null;
  const ps = t.split(',').map(s => s.trim()).filter(Boolean); return { full: t, name: ps[0] || '', addr: ps.slice(1).filter(s => !/^\d{4,}$/.test(s)).join(', ') }; }
const PS_STREET_SKIP = /^(street|st|road|rd|avenue|ave|blvd|boulevard|lane|square|sq|rehov|derech|sderot|the|and)$/i;
function psStreetMatch(addr, x) { const parts = String(addr || '').split(',').map(s => s.trim()).filter(Boolean); if (!parts.length) return false;
  const words = psNorm(parts[0]).split(' ').filter(w => w.length >= 4 && !PS_STREET_SKIP.test(w) && !/^\d+$/.test(w)), sub = psNorm(x.sub + ' ' + x.name);
  if (!words.length || !words.some(w => sub.includes(w))) return false;
  const city = parts.length > 1 ? psNorm(parts[parts.length - 1]) : ''; return !city || psNorm(x.city + ' ' + x.sub + ' ' + x.state).includes(city); }
// place-find (Q1; decisions/2026-11-20-place-from-google-link.md): a Google link without a point - Google's share links carry a name, an
// address and the id, Google Search's share only the name. The point never comes from Google: (a) the name alone, searched only inside
// the city of the link's address (the city found first by the area search; with no address, or a city not found, the trip's area); a long
// name is also tried without its trailing words - only words that are the address's city or the result's own district or city ("Aroma
// German Colony Haifa" → "Aroma German Colony" → "Aroma"); a result is taken only when its name fits, and with an address that has a
// street, only one on that street (among several branches, the one on the address's street; another branch is never taken); (b) else the
// address with its house number in that city - only a building (a result with that house number on that street), never a street;
// (c) else no point: { view } - the address's street (or the city) for the map pick to open on; nothing is kept until the user picks.
// Measured with tests/psmeasure.py (its link rows); guard t1104.
const PS_CITY_KIND = /^(עיר|עיירה|כפר|שכונה|מחוז|אזור)$/;
function psAddrParts(addr) { const ps = String(addr || '').split(',').map(x => x.trim()).filter(x => x && !/^\d{4,}$/.test(x)), first = ps.length > 1 ? ps[0] : '';
  const m = first.match(/^(.*?\D)\s*(\d+[a-zא-ת]?)(?:\s*[-/]\s*\d+)?$/i) || first.match(/^(\d+[a-zא-ת]?)\s+(\D.*)$/i); // "Rutenberg St 2" / "2 Rutenberg St"
  const street = m ? (/^\d/.test(m[1]) ? m[2] : m[1]).trim() : first, hn = m ? (/^\d/.test(m[1]) ? m[1] : m[2]) : '';
  return { street, hn, city: ps.length ? ps[ps.length - 1] : '' }; }
async function psCityBox(city, near) { if (!city || city.length < 2) return null;
  const l = await placeSearch(city, near, { kind: 'area', explicit: true, noWiki: true, prio: 'screen' }); if (!l) return null;
  const x = l.find(y => PS_CITY_KIND.test(y.area || '') && (y.names || []).concat(y.name).some(n => n && psNameMatch(n, city))); if (!x) return null;
  const e = x.ext && x.ext.n - x.ext.s < 1.5 && x.ext.e - x.ext.w < 1.5 ? x.ext : { s: x.coord.lat - 0.08, n: x.coord.lat + 0.08, w: x.coord.lng - 0.1, e: x.coord.lng + 0.1 };
  const pl = Math.max(0.01, (e.n - e.s) * 0.1), pg = Math.max(0.012, (e.e - e.w) * 0.1);
  return { s: e.s - pl, n: e.n + pl, w: e.w - pg, e: e.e + pg, c: [x.coord.lat, x.coord.lng] }; }
// the names tried: the whole name, then without its last words, one at a time (at least one word of three letters)
function psNameTries(name) { const w = String(name || '').split(/\s+/).filter(Boolean), out = [];
  for (let k = w.length; k >= 1; k--) { const n = w.slice(0, k).join(' '); if (psNorm(n).replace(/\s/g, '').length >= 3) out.push({ n, tail: w.slice(k).join(' ') }); } return out; }
// a tail may be dropped only when it is the city of the address or the result's own place words (its district, its city)
function psTailOk(tail, x, city) { if (!tail) return true; const t = psNorm(tail), where = psNorm([x.district, x.city, x.state, city, x.sub].filter(Boolean).join(' '));
  return t.split(' ').every(w => w.length < 2 || where.split(' ').includes(w)); }
function psOnStreet(st, x) { return !!st && psStreetMatch(st, { sub: [x.street, x.sub].filter(Boolean).join(' '), name: '', city: '', state: '' }); }
async function psFindByText(tx) { if (!tx || !MAP_AVAILABLE) return null;
  const A = psAddrParts(tx.addr), trip = psCenterOf(undefined), cb = A.city ? await psCityBox(A.city, trip) : null, lang = HEB_CH.test(tx.addr || tx.name) ? 'default' : 'en';
  const box = cb || (trip ? psBox(trip) : null), near = cb ? cb.c : trip, ask = q => placeSearch(q, near, { explicit: true, prio: 'screen', box: box || undefined, anywhere: !box, lang });
  // (a) the name alone, in the city
  if (tx.name) for (const t of psNameTries(tx.name)) { const l = await ask(t.n); if (!l) continue;
    const fit = l.filter(x => (x.names || []).concat(x.name).some(n => n && psNameMatch(n, t.n)) && psTailOk(t.tail, x, A.city) && !/^highway:|^public_transport:|^railway:(stop|halt|tram_stop)/.test(x.cls || '') && (!box || psInExt(x.coord, box)));
    const on = A.street ? fit.filter(x => psOnStreet(A.street, x)) : fit;
    if (on.length === 1) return { ...on[0], how: 'name' };
    if (on.length > 1) return { ...on.sort((p, q) => distanceKm(p.coord, { lat: near[0], lng: near[1] }) - distanceKm(q.coord, { lat: near[0], lng: near[1] }))[0], how: 'name' }; }
  // (b) the address with its house number: a building only
  if (A.street && A.hn) { const l = await ask(A.street + ' ' + A.hn + (A.city ? ', ' + A.city : ''));
    const b = (l || []).find(x => String(x.hn).replace(/\s/g, '').toLowerCase() === String(A.hn).toLowerCase() && psOnStreet(A.street, x)); if (b) return { ...b, how: 'addr' }; }
  // (c) no point: the street (or the city) for the pick to open on
  if (A.street) { const l = await ask(A.street + (A.city ? ', ' + A.city : '')); const st = (l || []).find(x => psOnStreet(A.street, x) || psOnStreet(A.street, { street: x.name }));
    if (st) return { view: { lat: st.coord.lat, lng: st.coord.lng, z: 17 } }; }
  return near ? { view: { lat: near[0], lng: near[1], z: cb ? 14 : 13 } } : null; }
// the line under a point found by name or address: "נמצא במפה: <name> · <street, city> · כדאי לוודא על המפה"
function psFoundHTML(f) { return f ? `<small class="ps-line ps-found">נמצא במפה: <b>${escH(f.name || '')}</b>${f.sub ? SEP + escH(f.sub) : ''}${SEP}כדאי לוודא על המפה</small>` : ''; }
const PS_NO_POINT = ('לא הצלחנו לקרוא מיקום מהקישור' + SEP + 'לבחור על המפה');
// 11.22.0 (place-gid-1 item 8, G44; decisions 2026-11-18 · Review of the 11.21.7 summary, Q1): Google's Hebrew shares carry only the name
// and the ftid (Maps) or the name alone (share.google): the link is read - the name and the id record kept - but Google sends no point,
// and the app never takes one from Google (only the id is stored). The line says so; its button opens the map pick on the trip's area.
const PS_NO_POINT_G = 'בקישור הזה גוגל לא שולחת מיקום - בחרו את המקום על המפה';
// ---- a form kept across Google Maps (11.21.0; decisions 2026-11-16 · Review of the night chain, Q3) ----
// Going to Google Maps leaves the app, and the share back reloads it. So "לחפש בגוגל מפות" stores on the phone (DEV.psOpen, 15 minutes),
// beside the open search, the form it was tapped in, whole: its kind and the object it edits (the host's ret), the field, every field's
// value (fmValues - read from the form's own window even while an inner step covers it), its open sections and a location's kept link.
// The share back reopens that same form (PS_FORMS), restores it exactly as left (psRestore) and takes the shared name and location into
// the field; the form keeps its opening's starting point, so it is unsaved and the unsaved-change guard applies. Covers a place's editor
// (existing and new), a travel's end (saved and unsaved travel) and the trip picture's point. Past 15 minutes, or with no stored form:
// today's "מקום חדש". Guard: t1086.
// 11.21.1 (form-keep-everywhere, found 1): every form that shows "לחפש בגוגל מפות" names its form - also a draft's place (a fix and an
// addition of mine: dplace), the destination editor's "מרכז המפה" (dest), a draft's travel and a place being turned into a travel
// (travel with dat / conv), and the full-screen search opened from a travel end's "סימון במפה" (endPickOnMap passes the travel's ret).
// A draft's form comes back only to the same draft (DRAFT.at). Guard: t1087.
function psKeep(F) { if (!F) return null; const w = F.win, el0 = F.el; if (w && w.el && w.el.firstChild) F.el = w.el.firstChild; // a covered window: its own nodes
  try { const r = fmRoot(F); return { vals: fmValues(F), open: [...r.querySelectorAll('details[data-fmsec][open]')].map(d => d.dataset.fmsec),
    urls: Object.fromEntries(Object.entries(F.locs || {}).map(([k, v]) => [k, v.url || ''])),
    gids: Object.fromEntries(Object.entries(F.locs || {}).filter(([, v]) => v.gidOn).map(([k, v]) => [k, { gid: v.gid || null, relink: !!v.relink }])) }; } finally { F.el = el0; } } // 11.22.0: the id row's state
function psFormRet(F, f, field) { const r = F && f(F); return r ? { ...r, field, keep: psKeep(F) } : null; }
function psRestore(F, k) { if (!F || !k) return; const v = k.vals || {};
  Object.keys(v).forEach(id => { if (id === '__extra' || !F.kinds[id] || JSON.stringify(fmGet(F, id)) === JSON.stringify(v[id])) return; fmSet(F, id, v[id]); }); // in the form's order: a layer before its region
  (k.open || []).forEach(id => { const d = fmQ(F, `details[data-fmsec="${id}"]`); if (d) d.open = true; });
  Object.entries(k.urls || {}).forEach(([id, u]) => { if (F.locs && F.locs[id]) { F.locs[id].url = u; fmLocShow(F, id); } });
  Object.entries(k.gids || {}).forEach(([id, s]) => { const L0 = F.locs && F.locs[id]; if (!L0 || !L0.gidOn || !s) return; L0.gid = s.gid ? gidClean(s.gid) : null; L0.relink = !!s.relink; fmGidRow(F, id); }); }
const PS_FORMS = {
  place: { ok: o => o.id == null || POINTS.some(p => p.id === o.id),
    open: o => { if (o.id != null) { openPlaceEditor({ id: o.id }); return; } const op = psPlaceOpen(o); psPlaceScreen(op); openPlaceEditor(op); }, after: F => { peNeedLayer(F); peDup(F); } },
  dplace: { ok: o => !!(DRAFT && DRAFT.at === o.dat) && (o.key == null ? !!o.add : String(o.key).startsWith('add:') ? (DRAFT.add || []).some(a => a.key === o.key) : draftItems(DRAFT).some(x => x.key === o.key)),
    open: o => { goTab('draft'); openPlaceEditor(o.key != null ? { draftKey: o.key } : { draftAdd: o.add }); }, after: F => { peNeedLayer(F); peDup(F); } },
  dest: { group: 'management', ok: o => o.id == null || !!DESTS[o.id], open: o => { goTab('trips'); groupFn('management', 'openDestEditor')(o.id || null); }, after: F => groupFn('management', 'deBack')(F) },
  travel: { ok: o => o.dat != null ? !!(DRAFT && DRAFT.at === o.dat && o.id != null && draftTravelTrip() && travelById(o.id, draftTravelTrip()))
      : hasTrip() && STATE.activeTrip === o.tid && (o.id == null || !!travelById(o.id, activeTripObj())),
    open: o => { if (o.dat != null) { goTab('draft'); openTravelEditor(o.id, { draft: true }); } else openTravelEditor(o.id || null, o.conv ? { conv: o.conv } : undefined); } },
  pic: { group: 'memories', ok: o => !!STATE.trips[o.id], open: () => {} }, // diet-groups: the memento's own check in psMemBack (memories)
  // closing-where (11.26.0, Q6): "＋ עוד מקום שהיינו בו" - back in the closing (it resumes at its step) or in the memory's review window
  where: { group: 'memories', ok: o => !!STATE.trips[o.id] && (o.door === 'closing' ? !STATE.trips[o.id].archived : !!STATE.trips[o.id].archived), open: () => {} } };
// form-keep-context: a new place reopens with its whole opening (peOpenKeep) - a day's "＋ מקום" in the same trip on that day's plan, its
// day and slot kept for the save (a day gone by then: no day, as afterSave always did); else on the places tab. A form stored by 11.21.x
// (no opening): as then.
function psPlaceOpen(o) { const op = o.open ? JSON.parse(JSON.stringify(o.open)) : { dest: o.dest || undefined, tripOnly: !!o.tripOnly, noGuess: !(o.keep && o.keep.vals && o.keep.vals.layer) };
  const a = op.afterSave; if (a && !(hasTrip() && a.tid === STATE.activeTrip && dayByKey(a.day))) delete op.afterSave; return op; }
function psPlaceScreen(op) { const a = op.afterSave; if (!a) { goTab('all'); return; }
  planFirstOpen(); // the days the plan opens by itself, plus the day of "＋ מקום"
  openDays.add(a.day); goTab('itinerary'); revealLater(`#main [data-day-item="${CSS.escape(a.day)}"]`, false); }
async function psFormBack(o, text) { const P = PS_FORMS[o.k]; if (!P || !o.keep || !P.ok(o)) return false;
  if (P.group && !(await needGroup(P.group))) { showToast(GROUP_FAIL); return true; } // diet-groups: the form's group first (the trip picture, a memory, the destination editor)
  if (o.k === 'pic' || o.k === 'where') return groupFn('memories', 'psMemBack')(o, text); // the trip picture's editor, the closing's or the memory's "＋ עוד מקום" (memories)
  P.open(o); const F = layerTop() && layerTop().form; if (!F || !F.kinds[o.field]) return true;
  psRestore(F, o.keep); if (P.after) P.after(F);
  if (F.kinds[o.field] === 'loc') { const q = fmQ(F, `[data-fmq="${o.field}"]`); if (q) q.value = o.q || '';
    const b = fmQ(F, `[data-fmlink="${o.field}"]`); if (b) { b.hidden = false; fmQ(F, `[data-fmlinkt="${o.field}"]`).value = text; } await fmLocLinkRead(F, o.field, text); return true; }
  const r = await psReadLink(text), G = fmLive(F); if (!G || !G.kinds[o.field]) return true; if (!r || !r.coord) { showToast(PS_NO_POINT); return true; } // a travel's end
  endFieldSet(G, o.field, { name: r.name || (G.kinds[o.field] === 'end' && (G.vals[o.field] || {}).name) || 'מקום מגוגל מפות', loc: { lat: r.coord.lat, lng: r.coord.lng } }); return true; } // along-drive: a drive's stop comes back the same way
// a share that is not an app file (startup): it reopens the form left for Google Maps within the last 15 minutes, or opens "מקום חדש" in
// the active trip
// a share read in the open editor: a place already in the trip (by Google's id, or the same point with a fitting name) - the editor
// closes with no question (nothing was typed that the share did not give) and that place's window opens; else the nearest destination
// of the trip goes first among the layers, as a share always did (11.20.0, Q9 (3))
function psShareKnown(F, opts, r) { if (!r || !(r.rec || r.coord)) return false; const q = hasTrip() ? (r.rec && gidPlaceOf(r.rec)) || gidPlaceNear(r) : null;
  if (!q || !planItem(q.id)) { if (r.coord && hasTrip()) { const t = activeTripObj(), ids = (t.segments || []).map(g => g.dest).filter(k => DESTS[k]), d = psDestNear([r.coord.lat, r.coord.lng], ids.length ? ids : null); if (d && !opts.dest) opts.dest = d.id; } return false; }
  closeSheet(); gidOpenKnown(r.rec, r); return true; }
async function psShareIn(text) { try { await REG_READY; } catch (e) {} const o = DEV.psOpen; devSet({ psOpen: null }); // the destinations from storage first
  if (o && Date.now() - o.at < PS_OPEN_MIN * 60000 && await psFormBack(o, text)) return;
  const t = hasTrip() ? activeTripObj() : null, ids = t ? (t.segments || []).map(g => g.dest).filter(k => DESTS[k]) : null;
  // 11.46.0 (phone-round-4c-fixes P3, G93; decisions 2026-11-21 · Review of the `phone-round-4b-fixes` summary, Q2): a link that needs the
  // network (a short link, or one with no point) - "מקום חדש" opens at once with the share's name, and the link is read inside it with the
  // "in progress" indicator (fmLocLinkRead, waitOn): "קוראים את הקישור…", then "מחפשים את המקום…"; a place already in the trip found by
  // it closes the window and opens its own (psShareKnown); the point fills and the map frames it, or the usual failure line
  const r0 = parseMapsLink(text);
  if (r0 && !(r0.coord && !r0.short)) { goTab('all'); openPlaceEditor({ noGuess: true, name: r0.name ? String(r0.name).split(',')[0].trim() : '', sharedText: text, share: true }); return; }
  const r = await psReadLink(text); if (r && (r.rec || r.coord) && gidOpenKnown(r.rec, r)) return; // 11.22.0 (Q9 (1)): a place already in the trip opens its window; place-find (G67): also one at the same point with a fitting name
  const d = r && r.coord ? psDestNear([r.coord.lat, r.coord.lng], ids && ids.length ? ids : null) : null;
  goTab('all'); openPlaceEditor({ noGuess: true, dest: d ? d.id : undefined, name: r ? r.name : '', coord: r && r.coord ? r.coord : undefined, mapsUrl: r ? r.url : '', gid: r && r.rec ? gidNew(r.rec, 'user') : undefined, sharedText: r && r.coord ? undefined : text, sharedRead: r });
  if (r && r.byText) { const F = layerTop() && layerTop().form; if (F && F.kinds.loc) { fmLocPickNote(F, 'loc', true); if (r.found) fmLocFound(F, 'loc', r.found); } } } // 11.21.6 (P2): a point found by the link's name and address is a search pick; place-find (Q1): what was found
const HEB_CH = /[\u0590-\u05FF]/;

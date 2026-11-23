// ================= 4.36.0: MEMORY MAPS =================
// Spec 24.10.2026 (cl-memento-maps): every map of a memory is a real map, picked by its purpose.
// - Remembering (the memory screen, the trip summary file): a live map. Visited places in their rating's colour, highlights
//   named, 🏨 as anchors, and in the memory screen a switch for what we didn't reach.
// - Showing (the trip picture, PNG/PDF): a choice of 🗺️ map (real tiles, ~200dpi) or ✏️ schematic (vector, in the trip's
//   colours, no street-level detail: water, parks, main roads, rails, neighbourhood names / coasts, borders, cities, relief).
// - Visiting (recommendations page): a live map, places in their layer's colour with numbers that match the list.
// Frames: a city trip is framed by its main cluster (a far place doesn't stretch it: in a static picture it becomes an arrow on
// the edge with its name and distance); a route trip is framed by the whole route. HTML files carry a picture of the same map
// for whoever opens them without a network. Map data and the relief picture are fetched once per trip and kept on the device
// (not in backups: they can be rebuilt); tile pictures are made on demand.
const RATE_COLOR = { love: '#E03131', like: '#2F9E44', dislike: '#495057' }, UNRATED_COLOR = '#ADB5BD';
function rateColor(r) { return RATE_COLOR[r] || UNRATED_COLOR; }
const MERC = {
  x: lng => (lng + 180) / 360,
  y: lat => { const s = Math.sin(Math.max(-85, Math.min(85, lat)) * Math.PI / 180); return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI); },
  lng: x => x * 360 - 180,
  lat: y => { const n = Math.PI - 2 * Math.PI * y; return 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))); },
};
// a Web-Mercator fit of points into a w×h box (x(lng) / y(lat)); minKm (11.24.0, pic-frame-fit): the box's shorter side spans at least that
function mercFit(cs, w, h, pad, maxZoom, minKm) {
  const xs = cs.map(c => MERC.x(c.lng)), ys = cs.map(c => MERC.y(c.lat));
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const Amax = 256 * Math.pow(2, maxZoom == null ? 16 : maxZoom);
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  let A = Math.min(Amax, (w - 2 * pad) / Math.max(x1 - x0, 1e-12), (h - 2 * pad) / Math.max(y1 - y0, 1e-12));
  if (minKm) A = Math.min(A, 40075 * Math.cos(MERC.lat(cy) * Math.PI / 180) * Math.min(w, h) / minKm);
  return { A, cx, cy, w, h, x: lng => w / 2 + (MERC.x(lng) - cx) * A, y: lat => h / 2 + (MERC.y(lat) - cy) * A,
    lngAt: px => MERC.lng(cx + (px - w / 2) / A), latAt: py => MERC.lat(cy + (py - h / 2) / A), kmPerPx: 40075 * Math.cos(MERC.lat(cy) * Math.PI / 180) / A };
}
function median(a) { const s = a.slice().sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
// the main concentration of a city trip; points far from it don't stretch the frame
function mainCluster(items) {
  if (items.length < 4) return { core: items, far: [], center: items.length ? { lat: median(items.map(x => x.c.lat)), lng: median(items.map(x => x.c.lng)) } : null };
  const center = { lat: median(items.map(x => x.c.lat)), lng: median(items.map(x => x.c.lng)) };
  const d = items.map(x => distanceKm(center, x.c)), lim = Math.max(6, median(d) * 5); // 4.36.1: day trips and the airport don't stretch the frame; the city's own edges stay in it
  return { core: items.filter((x, i) => d[i] <= lim), far: items.filter((x, i) => d[i] > lim), center };
}
// kind: 'city' frames the main cluster, anything else frames everything
function memFrame(items, kind) {
  if (kind === 'city') return mainCluster(items);
  return { core: items, far: [], center: items.length ? { lat: median(items.map(x => x.c.lat)), lng: median(items.map(x => x.c.lng)) } : null };
}
function memKind(D) { return D && D.auto === 'city' ? 'city' : 'route'; }
// what a memory map shows: visited places in their rating's colour, highlights larger and named, hotels as anchors
function memItems(M, withUnvisited) {
  const rate = M.td.rating || {}, hi = new Set((M.td.highlights || []).map(h => h.placeId).filter(x => x != null)), vis = new Set(M.visited.map(p => p.id));
  const name = p => String(p.name || '').replace(/\s*\(.*$/, '');
  const out = M.visited.filter(snapCoord).map(p => { const r = (rate[p.id] || {}).r || ''; return { p, c: snapCoord(p), r, color: rateColor(r), hi: hi.has(p.id), key: !!p.key, name: name(p), w: (rate[p.id] || {}).w || '', kind: 'place' }; });
  const hotels = M.stops.map(s => ({ p: s.p, c: snapCoord(s.p), name: name(s.l.name || s.p.name), kind: 'hotel', nights: nightsBetween(s.l.checkIn, s.l.checkOut) || 1 }));
  const seen = new Set(hotels.map(h => h.p.id));
  const places = out.filter(x => !seen.has(x.p.id));
  const extra = withUnvisited ? (M.places || []).filter(p => !vis.has(p.id) && !seen.has(p.id) && snapCoord(p)).map(p => ({ p, c: snapCoord(p), r: '', color: UNRATED_COLOR, name: name(p), kind: 'missed' })) : [];
  return { places, hotels, extra };
}
// arrows on the edge of a static picture for places outside its frame: name and distance from the frame's centre
function edgeArrowsSVG(fit, box, far, center, color, fs) {
  if (!far.length || !center) return '';
  const cx = box.w / 2, cy = box.h / 2, m = fs * 1.6, used = []; let s = '';
  const groups = []; far.forEach(f => { const g = groups.find(x => distanceKm(x.c, f.c) < 3); if (g) g.n++; else groups.push({ ...f, n: 1 }); });
  groups.sort((a, b) => distanceKm(center, a.c) - distanceKm(center, b.c)).slice(0, 5).forEach(f => {
    const dx = fit.x(f.c.lng) - cx, dy = fit.y(f.c.lat) - cy; if (!dx && !dy) return;
    const tx = dx ? ((dx > 0 ? box.w - m : m) - cx) / dx : Infinity, ty = dy ? ((dy > 0 ? box.h - m : m) - cy) / dy : Infinity, t = Math.min(tx, ty);
    const ex = cx + dx * t, ey = cy + dy * t; if (used.some(([a, b]) => Math.hypot(a - ex, b - ey) < fs * 2.4)) return; used.push([ex, ey]);
    const ang = Math.atan2(dy, dx) * 180 / Math.PI, onSide = tx <= ty, right = dx > 0;
    const label = `${f.name.slice(0, 28)}${f.n > 1 ? ` +${f.n - 1}` : ''}${SEP}${fmtKm(distanceKm(center, f.c))}`;
    const lx = onSide ? ex + (right ? -fs * 1.2 : fs * 1.2) : ex, ly = onSide ? ey + fs * .35 : ey + (dy > 0 ? -fs * 1.1 : fs * 1.6), anchor = onSide ? (right ? 'end' : 'start') : 'middle';
    s += `<g class="edge-arrow"><path transform="translate(${(box.x + ex).toFixed(1)} ${(box.y + ey).toFixed(1)}) rotate(${ang.toFixed(1)}) scale(${(fs / 18).toFixed(2)})" d="M16 0 L-8 -11 L-3 0 L-8 11 Z" fill="${color}" stroke="#fff" stroke-width="2.5" stroke-linejoin="round"/>
      <text x="${(box.x + lx).toFixed(1)}" y="${(box.y + ly).toFixed(1)}" text-anchor="${anchor}" font-size="${fs}" font-weight="700" fill="${color}" stroke="#fff" stroke-width="${(fs / 3.5).toFixed(1)}" paint-order="stroke">${_qe(label)}</text></g>`;
  });
  return s;
}

// ---- map tiles drawn into a picture (the "map" style, and the picture inside HTML files) ----
const TILE_LIMIT = 200; // a picture never asks for more tiles than a few minutes of scrolling a map would
function tileLayersFor(typeId) {
  const k = esriKey(); // legal-server (11.41.0): the person's key or the app's
  if (typeId === '__hs') return [{ u: hillshadeUrl(k).replace('_Dark', ''), multiply: false, max: 13, attr: svcCreditText('esri', { as: 'hillshade' }) }];
  const id = BASE_MAPS[typeId] ? typeId : 'osm';
  return BASE_MAPS[id].layers(k).map(([u, o]) => ({ u, multiply: o.className === 'hs-layer', max: Math.min(o.maxNativeZoom || o.maxZoom || 19, 19), attr: o.cr || '' })); } // legal-credits: a picture's credit is the row's plain text with the address to print (o.cr), never the screen's links
// 7.1.0: no {s} - exact addresses (ש6); legal-credits (S12): a provider's own letter hosts ({abc}) by the tile, as on the screen (svcTileHost)
function tileUrlOf(u, z, x, y) { return u.replace('{abc}', svcTileHost({ x, y })).replace('{z}', z).replace('{x}', x).replace('{y}', y); }
// a raster tile for a picture, through the client (the provider is the one whose host serves it); null when it didn't load
async function loadTileImg(url, svc) { const prov = svcProvOfUrl(url); if (!prov) return null;
  const r = await svcAsk(svc || 'picTiles', { key: url, build: p => p === prov ? { url, as: 'img' } : null, parse: d => d }); return r.kind === 'ok' ? r.value : null; }
// 7.1.0 (ש7): "🗺️ מפה" and "🏔️ תבליט" pictures are drawn from OpenFreeMap's vector tiles (OSM's terms forbid fetching tiles nobody
// looks at), in the colors of the screen map, with every street, buildings close in and names (Hebrew when there is); the relief adds
// Esri's hillshade on top, like the screen. Topographic and satellite stay the provider's own tiles. Counted in the trip's budget.
// 9.1.1 (12ג-6): the tile grid of a drawn map picture, once - which tiles cover the box at a zoom that fits the limit, and
// where each tile lands; the vector tiles (vtRenderInto) and the image tiles (renderTileImage) use it
function tileGrid(fit, x0, y0, w, h, z, per, limit) {
  const wx0 = fit.cx + (x0 - fit.w / 2) / fit.A, wx1 = fit.cx + (x0 + w - fit.w / 2) / fit.A, wy0 = fit.cy + (y0 - fit.h / 2) / fit.A, wy1 = fit.cy + (y0 + h - fit.h / 2) / fit.A;
  let N, tx0, tx1, ty0, ty1;
  for (;;) { N = 2 ** z; tx0 = Math.floor(wx0 * N); tx1 = Math.floor(wx1 * N); ty0 = Math.max(0, Math.floor(wy0 * N)); ty1 = Math.min(N - 1, Math.floor(wy1 * N));
    if ((tx1 - tx0 + 1) * (ty1 - ty0 + 1) * per <= limit || z <= 1) break; z--; }
  const cells = []; for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) cells.push({ tx, ty });
  return { z, N, cells, px: tx => ((tx / N - fit.cx) * fit.A + fit.w / 2 - x0), py: ty => ((ty / N - fit.cy) * fit.A + fit.h / 2 - y0) };
}
async function vtRenderInto(ctx, fit, x0, y0, w, h, scale, svc, onProg, opts) {
  const tpl = await vtTemplate().catch(() => null); if (!tpl) return null;
  const zDisp = Math.max(0, Math.log2(fit.A * scale / 256));
  const G = tileGrid(fit, x0, y0, w, h, Math.max(0, Math.min(tpl.max, Math.round(zDisp))), 1, (opts && opts.limit) || TILE_LIMIT), zt = G.z, N = G.N, jobs = G.cells;
  let done = 0, bad = 0; const ds = fit.A / N * scale;
  const tiles = await Promise.all(jobs.map(async j => { const u = tpl.t.replace('{z}', zt).replace('{x}', ((j.tx % N) + N) % N).replace('{y}', j.ty), r = await vtTile(svc, u);
    let L = null; if (r.kind === 'ok') { if (opts && opts.trip) svcBudget(opts.trip, r.value.byteLength); try { L = mvtLayers(r.value, OFF_LAYERS); } catch (e) {} } else if (r.kind === 'empty') L = {}; if (!L) bad++;
    done++; if (onProg) onProg(done, jobs.length); return L; }));
  if (bad > jobs.length * 0.3) return null;
  const at = j => ({ px: G.px(j.tx) * scale, py: G.py(j.ty) * scale });
  ['areas', 'lines', 'labels'].forEach(pass => jobs.forEach((j, i) => { if (tiles[i]) { const q = at(j); offDrawLayers(ctx, tiles[i], q.px, q.py, ds + 0.6, Math.min(18, zDisp + 0.5), scale, pass); } }));
  return { z: zt, tiles: jobs.length };
}
// region [x0, x0+w] × [y0, y0+h] in the fit's own pixels, drawn at `scale` (2.4 ≈ 200dpi on A3 for a 1000-wide picture)
async function renderTileImage(fit, x0, y0, w, h, scale, typeId, onProg, opts) {
  opts = opts || {}; const svc = opts.svc || 'picTiles', vec = typeId === 'osm' || typeId === 'relief';
  const cv = document.createElement('canvas'); cv.width = Math.round(w * scale); cv.height = Math.round(h * scale);
  const ctx = cv.getContext('2d'); ctx.fillStyle = '#F2EFE9'; ctx.fillRect(0, 0, cv.width, cv.height);
  let credit = '', z = 0, nTiles = 0;
  if (vec) { const v = await vtRenderInto(ctx, fit, x0, y0, w, h, scale, svc, onProg, opts); if (!v) return null; credit = svcCreditText('openfreemap', { print: true }); z = v.z; nTiles = v.tiles; }
  const layers = vec ? (typeId === 'relief' ? tileLayersFor('__hs') : []) : tileLayersFor(typeId);
  if (layers.length) {
    const maxZ = Math.min(...layers.map(l => l.max));
    const G = tileGrid(fit, x0, y0, w, h, Math.max(0, Math.min(maxZ, Math.ceil(Math.log2(fit.A * scale / 256) - 0.2))), layers.length, opts.limit || TILE_LIMIT), zr = G.z, N = G.N;
    const jobs = []; layers.forEach(l => G.cells.forEach(c => jobs.push({ l, tx: c.tx, ty: c.ty })));
    let done = 0, bad = 0;
    const imgs = await Promise.all(jobs.map(async j => { const im = await loadTileImg(tileUrlOf(j.l.u, zr, ((j.tx % N) + N) % N, j.ty), svc); if (!im) bad++; done++; if (onProg && !vec) onProg(done, jobs.length); return im; }));
    if (bad > jobs.length * 0.3 && !vec) return null;
    const ds = fit.A / N * scale;
    jobs.forEach((j, i) => { const im = imgs[i]; if (!im) return; ctx.globalCompositeOperation = j.l.multiply || vec ? 'multiply' : 'source-over';
      ctx.drawImage(im, G.px(j.tx) * scale, G.py(j.ty) * scale, ds + 0.6, ds + 0.6); });
    ctx.globalCompositeOperation = 'source-over'; if (!vec) z = zr; nTiles += jobs.length;
    credit = [credit, ...new Set(layers.map(l => l.attr).filter(Boolean))].filter(Boolean).join(SEP);
  }
  if (opts.fade) { ctx.fillStyle = `rgba(255,255,255,${opts.fade})`; ctx.fillRect(0, 0, cv.width, cv.height); }
  try { return { url: cv.toDataURL('image/jpeg', opts.q || 0.86), z, tiles: nTiles, credit }; } catch (e) { return null; } // a host without CORS taints the canvas
}

// ---- map data for the schematic style, kept per trip frame on the device ----
// 4.36.1: three public Overpass servers, tried in turn (the main one is often busy), each with its own time limit
// 4.36.1: three public Overpass servers, tried in turn (the main one is often busy) - 7.1.0: three providers of the client, in order
const OVERPASS_URL = { overpass1: 'https://overpass-api.de/api/interpreter', overpass2: 'https://overpass.kumi.systems/api/interpreter', overpass3: 'https://overpass.private.coffee/api/interpreter' };
function overpassParse(j) { if (!j || typeof j !== 'object') throw new Error('answer'); if ((!j.elements || !j.elements.length) && /error|timed out|runtime/i.test(j.remark || '')) throw new Error(String(j.remark).slice(0, 60)); return j; }
async function overpassQuery(q, ms) { // the schematic background's fallback: through the client (service "רקע סכמטי", its Overpass providers)
  const r = await svcAsk('schem', { build: prov => OVERPASS_URL[prov] ? { url: OVERPASS_URL[prov], init: { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }, ms: ms || 45000 } : null, parse: overpassParse });
  if (r.kind === 'ok') return r.value; throw new Error(r.kind + (r.why ? ' ' + r.why : ''));
}
// 7.1.0 (ש9): a background that could not be made is not asked again in this session - until "🔄 לנסות שוב" or the network
// comes back (the client's own waits and tries do the rest; no private pause here)
const SCHEM_FAILED = new Map(); // key -> why
function geoFailed(key) { return SCHEM_FAILED.get(key) || null; }
// Douglas-Peucker on [lng, lat] pairs (degrees, longitude scaled by cos(lat))
function simplifyLine(pts, tol) {
  if (pts.length < 3) return pts; const k = Math.cos(pts[0][1] * Math.PI / 180), keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const st = [[0, pts.length - 1]];
  while (st.length) { const [a, b] = st.pop(); let md = 0, mi = -1; const ax = pts[a][0] * k, ay = pts[a][1], bx = pts[b][0] * k, by = pts[b][1], dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
    for (let i = a + 1; i < b; i++) { const px = pts[i][0] * k, py = pts[i][1]; let t = L2 ? ((px - ax) * dx + (py - ay) * dy) / L2 : 0; t = Math.max(0, Math.min(1, t)); const d = Math.hypot(px - ax - t * dx, py - ay - t * dy); if (d > md) { md = d; mi = i; } }
    if (md > tol && mi > 0) { keep[mi] = 1; st.push([a, mi], [mi, b]); } }
  return pts.filter((p, i) => keep[i]).map(p => [+p[0].toFixed(5), +p[1].toFixed(5)]);
}
// outer ways of a multipolygon joined into rings
function joinRings(ways) {
  const rings = [], left = ways.map(w => w.slice()).filter(w => w.length > 1), same = (a, b) => a[0] === b[0] && a[1] === b[1];
  while (left.length) { let r = left.shift(); let grew = true;
    while (!same(r[0], r[r.length - 1]) && grew) { grew = false;
      for (let i = 0; i < left.length; i++) { const w = left[i];
        if (same(r[r.length - 1], w[0])) r = r.concat(w.slice(1)); else if (same(r[r.length - 1], w[w.length - 1])) r = r.concat(w.slice().reverse().slice(1));
        else if (same(r[0], w[w.length - 1])) r = w.concat(r.slice(1)); else if (same(r[0], w[0])) r = w.slice().reverse().concat(r.slice(1)); else continue;
        left.splice(i, 1); grew = true; break; } }
    rings.push(r); }
  return rings;
}
function bboxOfItems(items, padFrac) { const la = items.map(x => x.c.lat), ln = items.map(x => x.c.lng); let s = Math.min(...la), n = Math.max(...la), w = Math.min(...ln), e = Math.max(...ln);
  const p = padFrac || 0.25, dy = Math.max(n - s, 0.01) * p, dx = Math.max(e - w, 0.01) * p; return [s - dy, w - dx, n + dy, e + dx]; }
function heName(t) { return (t && (t['name:he'] || t.name || t['name:en'])) || ''; }
// 4.38.2: the ✏️ background is drawn from ready vector tiles (OpenFreeMap, OpenMapTiles schema: free, no key, a CDN that allows the browser).
// Overpass refused or timed out every part on the phone (heavy "out geom" of a whole city), so it stays only as a fallback.
const VT_SRC = 'https://tiles.openfreemap.org/planet';
let VT_TPL = null;
// 7.1.0: every OpenFreeMap request goes through the client - its one queue keeps 4 at once for the background, the picture's map and
// the offline download together, and no query parameters (ש6); a tile that doesn't exist (404 / 204) is a real empty answer
async function vtTemplate() { if (VT_TPL) return VT_TPL;
  const r = await svcAsk('schem', { key: 'tilejson', build: prov => prov === 'openfreemap' ? { url: VT_SRC, ms: 15000 } : null, parse: j => { if (!j || !j.tiles || !j.tiles[0]) throw new Error('tilejson'); return j; } });
  if (r.kind !== 'ok') throw new Error('tilejson ' + r.kind); const j = r.value; VT_TPL = { t: j.tiles[0], max: Math.min(j.maxzoom || 14, 14) }; return VT_TPL; }
function vtTile(svc, u, ms) { return svcAsk(svc, { key: u, build: prov => prov === 'openfreemap' ? { url: u, as: 'bytes', empty404: true, ms: ms || 20000 } : null, parse: b => vtUnzip(b) }); }
// a minimal protobuf / Mapbox Vector Tile reader (only what the background needs)
function pbfReader(b) { let p = 0; const R = { pos: () => p, end: () => p >= b.length,
  varint() { let v = 0, s = 1, x; do { x = b[p++]; v += (x & 0x7f) * s; s *= 128; } while (x & 0x80 && p < b.length); return v; },
  skip(w) { if (w === 0) R.varint(); else if (w === 1) p += 8; else if (w === 2) { const l = R.varint(); p += l; } else if (w === 5) p += 4; else throw new Error('pbf wire ' + w); },
  bytes() { const l = R.varint(), s = p; p += l; return b.subarray(s, p); } }; return R; }
const VT_TD = new TextDecoder();
function mvtValue(b) { const r = pbfReader(b), dv = new DataView(b.buffer, b.byteOffset, b.byteLength); let v = null;
  while (!r.end()) { const k = r.varint(), f = k >> 3, w = k & 7;
    if (f === 1 && w === 2) v = VT_TD.decode(r.bytes()); else if (f === 2 && w === 5) { v = dv.getFloat32(r.pos(), true); r.skip(5); } else if (f === 3 && w === 1) { v = dv.getFloat64(r.pos(), true); r.skip(1); }
    else if ((f === 4 || f === 5) && w === 0) v = r.varint(); else if (f === 6 && w === 0) { const n = r.varint(); v = n % 2 ? -(n + 1) / 2 : n / 2; } else if (f === 7 && w === 0) v = !!r.varint(); else r.skip(w); }
  return v; }
function mvtGeom(g) { const rings = []; let x = 0, y = 0, cur = null, i = 0;
  while (i < g.length) { const c = g[i++], id = c & 7, n = c >> 3; if (id === 7) { if (cur && cur.length) cur.push(cur[0]); continue; }
    for (let j = 0; j < n && i + 1 < g.length; j++) { const dx = g[i++], dy = g[i++]; x += (dx >>> 1) ^ -(dx & 1); y += (dy >>> 1) ^ -(dy & 1);
      if (id === 1) { cur = [[x, y]]; rings.push(cur); } else if (cur) cur.push([x, y]); } }
  return rings; }
// layers wanted -> {name: {extent, feats: [{type, props, rings}]}}
function mvtLayers(buf, want) { const out = {}, r = pbfReader(buf);
  while (!r.end()) { const k = r.varint(), f = k >> 3, w = k & 7; if (f !== 3 || w !== 2) { r.skip(w); continue; }
    const lr = pbfReader(r.bytes()); let name = '', ext = 4096; const raw = [], keys = [], vals = [];
    while (!lr.end()) { const k2 = lr.varint(), f2 = k2 >> 3, w2 = k2 & 7;
      if (f2 === 1 && w2 === 2) name = VT_TD.decode(lr.bytes()); else if (f2 === 2 && w2 === 2) raw.push(lr.bytes()); else if (f2 === 3 && w2 === 2) keys.push(VT_TD.decode(lr.bytes()));
      else if (f2 === 4 && w2 === 2) vals.push(lr.bytes()); else if (f2 === 5 && w2 === 0) ext = lr.varint(); else lr.skip(w2); }
    if (!want.includes(name)) continue; const V = vals.map(mvtValue);
    out[name] = { extent: ext, feats: raw.map(fb => { const fr = pbfReader(fb), tags = [], geom = []; let type = 0;
      while (!fr.end()) { const k3 = fr.varint(), f3 = k3 >> 3, w3 = k3 & 7;
        if (f3 === 2 && w3 === 2) { const s = pbfReader(fr.bytes()); while (!s.end()) tags.push(s.varint()); } else if (f3 === 3 && w3 === 0) type = fr.varint();
        else if (f3 === 4 && w3 === 2) { const s = pbfReader(fr.bytes()); while (!s.end()) geom.push(s.varint()); } else fr.skip(w3); }
      const props = {}; for (let i = 0; i + 1 < tags.length; i += 2) props[keys[tags[i]]] = V[tags[i + 1]]; return { type, props, rings: mvtGeom(geom) }; }) }; }
  return out; }
async function vtUnzip(b) {
  if (b.length && b[0] === 0x1f && b[1] === 0x8b && window.DecompressionStream) b = new Uint8Array(await new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
  return b; }
const vtX = (lng, z) => Math.floor((lng + 180) / 360 * 2 ** z), vtY = (lat, z) => { const r = lat * Math.PI / 180; return Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * 2 ** z); };
function vtTilesFor(bb, z) { const [s, w, n, e] = bb, x0 = vtX(w, z), x1 = vtX(e, z), y0 = vtY(n, z), y1 = vtY(s, z), out = [];
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) out.push([z, x, y]); return out; }
function vtZoomFor(bb, zMax, zMin, maxTiles) { for (let z = zMax; z > zMin; z--) if (vtTilesFor(bb, z).length <= maxTiles) return z; return zMin; }
const vtName = p => (p && (p['name:he'] || p.name || p['name:en'] || p.name_en)) || '';
// the same features fetchSchemData's Overpass path makes (water, park, river, road1-3, rail, metro, area / land is separate, country, city, np)
async function vtSchemFeats(bb, kind, spanKm, push, feats, onProg, of) {
  const tpl = await vtTemplate(), city = kind === 'city';
  const z = city ? vtZoomFor(bb, Math.min(13, tpl.max), 10, 36) : vtZoomFor(bb, Math.min(8, tpl.max), 2, 16);
  const tiles = vtTilesFor(bb, z), detail = city || spanKm < 700, want = city ? ['water', 'waterway', 'park', 'landcover', 'landuse', 'transportation', 'place'] : detail ? ['water', 'waterway', 'park', 'transportation', 'place'] : ['place'];
  const seen = new Set(), errs = []; let done = 0, ok = 0;
  const one = async ([tz, tx, ty]) => { const u = tpl.t.replace('{z}', tz).replace('{x}', tx).replace('{y}', ty); let L = null;
    const r = await vtTile('schem', u); if (r.kind === 'empty') L = {}; else if (r.kind === 'ok') { svcBudget(STATE.activeTrip, r.value.byteLength); try { L = mvtLayers(r.value, want); } catch (e) { errs.push(`${tz}/${tx}/${ty} pbf`); } } else errs.push(`${tz}/${tx}/${ty} ${r.kind}`);
    if (onProg) onProg(++done, tiles.length); if (!L) return; ok++;
    const n2 = 2 ** tz, ll = (ext) => q => { const X = (tx + q[0] / ext) / n2, Y = (ty + q[1] / ext) / n2; return [X * 360 - 180, Math.atan(Math.sinh(Math.PI * (1 - 2 * Y))) * 180 / Math.PI]; };
    const area = r => { let a = 0; for (let i = 0; i + 1 < r.length; i++) a += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1]; return a; };
    const polys = (lyr, cls) => (L[lyr] ? L[lyr].feats : []).forEach(f => { if (f.type !== 3) return; const k = cls(f.props); if (!k) return; const tr = ll(L[lyr].extent);
      f.rings.forEach(r => { if (r.length > 3 && area(r) > 0) push(k, r.map(tr), { n: vtName(f.props) }); }); }); // exterior rings only, like the Overpass path
    const lines = (lyr, cls) => (L[lyr] ? L[lyr].feats : []).forEach(f => { if (f.type !== 2) return; const k = cls(f.props); if (!k) return; const tr = ll(L[lyr].extent);
      f.rings.forEach(r => push(k, r.map(tr), { n: vtName(f.props), b: f.props.brunnel === 'bridge' ? 1 : 0 })); });
    const points = (lyr, cls) => (L[lyr] ? L[lyr].feats : []).forEach(f => { if (f.type !== 1) return; const k = cls(f.props), nm = vtName(f.props); if (!k || !nm || seen.has(k + nm)) return; seen.add(k + nm);
      const q = ll(L[lyr].extent)(f.rings[0] && f.rings[0][0] || [0, 0]); feats.push({ k, p: [+q[0].toFixed(5), +q[1].toFixed(5)], n: nm, ...(k === 'city' ? { pop: 1000 - (Number(f.props.rank) || 99) } : {}), ...(k === 'country' ? { iso: f.props.iso_a2 || '' } : {}) }); });
    const road = p => /^(motorway|trunk|primary)$/.test(p.class) ? 'road1' : p.class === 'secondary' ? 'road2' : p.class === 'tertiary' ? 'road3' : (p.class === 'rail' || p.class === 'transit') ? (p.subclass === 'subway' ? 'metro' : 'rail') : '';
    if (city) {
      polys('water', p => p.class === 'swimming_pool' ? '' : 'water'); lines('waterway', p => /^(river|canal)$/.test(p.class) ? 'river' : '');
      polys('park', () => 'park'); polys('landcover', p => p.class === 'wood' ? 'park' : ''); polys('landuse', p => p.class === 'cemetery' ? 'park' : '');
      lines('transportation', p => p.ramp ? '' : road(p)); points('place', p => /^(suburb|quarter|neighbourhood|borough|island)$/.test(p.class) ? 'area' : '');
    } else {
      points('place', p => p.class === 'country' ? 'country' : p.class === 'city' ? 'city' : '');
      if (detail) { lines('transportation', p => /^(motorway|trunk)$/.test(p.class) ? 'road1' : ''); lines('waterway', p => p.class === 'river' ? 'river' : '');
        polys('water', p => p.class === 'lake' ? 'water' : ''); polys('park', p => p.class === 'national_park' ? 'np' : ''); }
    } };
  await Promise.all(tiles.map(one)); // the client keeps OpenFreeMap's 4 at once
  if (!ok) throw new Error('tiles: ' + (errs.slice(0, 3).join(SEP) || 'none'));
  return { z, tiles: tiles.length, failed: tiles.length - ok, errs };
}

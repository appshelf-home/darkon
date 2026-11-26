// ================= VECTOR TILES AND MAP DATA READ ON THE PHONE (split from memory-maps.js in diet-groups, 11.62.0; the memory maps, the drawn picture and the schematic background stay there, in the memories group) =================
const OVERPASS_URL = { overpass1: 'https://overpass-api.de/api/interpreter', overpass2: 'https://overpass.kumi.systems/api/interpreter', overpass3: 'https://overpass.private.coffee/api/interpreter' };
function overpassParse(j) { if (!j || typeof j !== 'object') throw new Error('answer'); if ((!j.elements || !j.elements.length) && /error|timed out|runtime/i.test(j.remark || '')) throw new Error(String(j.remark).slice(0, 60)); return j; }
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
  if (b.length && b[0] === 0x1f && b[1] === 0x8b && window.DecompressionStream) b = await gunzipBytes(b);
  return b; }
const vtX = (lng, z) => Math.floor((lng + 180) / 360 * 2 ** z), vtY = (lat, z) => { const r = lat * Math.PI / 180; return Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * 2 ** z); };
function vtTilesFor(bb, z) { const [s, w, n, e] = bb, x0 = vtX(w, z), x1 = vtX(e, z), y0 = vtY(n, z), y1 = vtY(s, z), out = [];
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) out.push([z, x, y]); return out; }
function vtZoomFor(bb, zMax, zMin, maxTiles) { for (let z = zMax; z > zMin; z--) if (vtTilesFor(bb, z).length <= maxTiles) return z; return zMin; }
const vtName = p => (p && (p['name:he'] || p.name || p['name:en'] || p.name_en)) || '';

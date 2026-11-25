// ================= "מדינות שביקרנו" - THE WORLD'S BORDERS INSIDE THE APP (task countries-visited) =================
// Mechanism map: `darkon/spec/countries-visited.md`; decisions 2026-11-23 · "מדינות שביקרנו" (Q1-Q3, the dynamic map).
// The site file countries-110m.json (written by tests/borders.py from Natural Earth 5.1.2, public domain): TopoJSON, one object
// "countries", a geometry per country - id = ISO 3166-1 alpha-2, "l" its label point [lng, lat], "c" its continent; a country missing
// at 1:110m (Malta, Singapore, Andorra...) comes from 1:50m with "s": 1. Read here into shapes for the point-in-country lookup and the
// world map's paths (the screen: js/memory-screen.js). Pure: nothing here calls another part (the parts' cycle, t1160) - the file is
// fetched by the screen through the one client (svcSiteFile) and handed in. topoRings is also the schematic maps' reading of world-atlas.
const WORLD_FILE = './countries-110m.json';
const WORLD_NEAR = 0.25;           // degrees (about 25 km): a point the 1:110m coast leaves at sea counts in the nearest country this close
const WORLD_LAT = [-58, 84];       // the world map's latitudes (Antarctica's coast and the far north left out of the drawing)
const WORLD_W = 1000;              // the map's width in its own units (360°)
// the countries of the app's list that the file does not draw apart (review of the branch, Q3): a fixed point each [lng, lat] and its
// continent, so every counted country is seen on the map as a dot (no shape, so never found by the lookup)
const WORLD_PTS = { GI: [-5.35, 36.14, 'eu'], SJ: [15.63, 78.22, 'eu'], GP: [-61.55, 16.25, 'na'], MQ: [-61.02, 14.64, 'na'], BQ: [-68.26, 12.18, 'na'], GF: [-53.13, 3.93, 'sa'],
  RE: [55.54, -21.12, 'af'], YT: [45.17, -12.83, 'af'], CX: [105.69, -10.49, 'oc'], CC: [96.87, -12.16, 'oc'], TK: [-171.85, -9.2, 'oc'], UM: [166.61, 19.28, 'oc'] };
// TopoJSON -> [{ id, props, polys }]: each polygon its rings of [lng, lat] (the first its outline, the rest its holes)
function topoRings(topo, obj) {
  const tf = topo.transform, arcs = topo.arcs.map(a => { let x = 0, y = 0; return a.map(p => { x += p[0]; y += p[1]; return tf ? [x * tf.scale[0] + tf.translate[0], y * tf.scale[1] + tf.translate[1]] : [p[0], p[1]]; }); });
  const arc = i => i < 0 ? arcs[~i].slice().reverse() : arcs[i], ring = idx => idx.reduce((o, i, n) => o.concat(n ? arc(i).slice(1) : arc(i)), []);
  return (((topo.objects || {})[obj] || {}).geometries || []).map(g => ({ id: g.id, props: g.properties || {}, polys: (g.type === 'Polygon' ? [g.arcs] : g.type === 'MultiPolygon' ? g.arcs : []).map(p => p.map(ring)) }));
}
// the shapes: a bounding box each, the small countries first (the lookup asks them before the large one around them - the Vatican before Italy)
function worldShapes(topo) {
  const W = topoRings(topo, 'countries').filter(g => /^[A-Z]{2}$/.test(String(g.id))).map(g => { const b = [180, 90, -180, -90];
    g.polys.forEach(p => p[0].forEach(([x, y]) => { if (x < b[0]) b[0] = x; if (y < b[1]) b[1] = y; if (x > b[2]) b[2] = x; if (y > b[3]) b[3] = y; }));
    const l = Array.isArray(g.props.l) ? g.props.l : [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
    return { id: g.id, l, c: g.props.c || '', small: !!g.props.s, polys: g.polys, bb: b }; });
  const have = new Set(W.map(s => s.id)); Object.entries(WORLD_PTS).forEach(([id, [x, y, c]]) => { if (!have.has(id)) W.push({ id, l: [x, y], c, small: true, polys: [], bb: [x, y, x, y] }); });
  return W.sort((a, b) => b.small - a.small);
}
function ringHas(r, x, y) { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const a = r[i], b = r[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
const shapeHas = (s, x, y) => s.polys.some(p => p.reduce((c, r) => c !== ringHas(r, x, y), false)); // even-odd over a polygon's rings: a hole is outside
// the country of a point (ISO code) or '' - a bounding box first, then the polygon; near a coast the nearest border within WORLD_NEAR
function worldCountryAt(W, lat, lng) {
  if (!W || !isFinite(lat) || !isFinite(lng)) return ''; const box = (s, m) => lng >= s.bb[0] - m && lng <= s.bb[2] + m && lat >= s.bb[1] - m && lat <= s.bb[3] + m;
  for (const s of W) if (box(s, 0) && shapeHas(s, lng, lat)) return s.id;
  const k = Math.cos(lat * Math.PI / 180); let best = '', bd = WORLD_NEAR;
  W.forEach(s => { if (!box(s, bd)) return; s.polys.forEach(p => p.forEach(r => { for (let i = 1; i < r.length; i++) { const d = segDist(lng * k, lat, r[i - 1][0] * k, r[i - 1][1], r[i][0] * k, r[i][1]); if (d < bd) { bd = d; best = s.id; } } })); });
  return best;
}
function segDist(px, py, ax, ay, bx, by) { const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy, t = L ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L)) : 0; return Math.hypot(px - ax - t * dx, py - ay - t * dy); }
// the world map's projection (Mercator between WORLD_LAT), in the map's own units: x 0..WORLD_W, y 0..worldH()
const mercY = lat => Math.log(Math.tan(Math.PI / 4 + Math.max(WORLD_LAT[0], Math.min(WORLD_LAT[1], lat)) * Math.PI / 360));
function worldXY(lng, lat) { return [(lng + 180) / 360 * WORLD_W, (mercY(WORLD_LAT[1]) - mercY(lat)) * WORLD_W / (2 * Math.PI)]; }
function worldH() { return worldXY(0, WORLD_LAT[0])[1]; }
// a shape's path in the map's units (Antarctica is not drawn); rings that collapse to a point at this scale are dropped
function worldPath(s) { if (s.id === 'AQ') return '';
  return s.polys.map(p => p.map(r => { const q = r.map(([x, y]) => worldXY(x, y)).map(([x, y]) => x.toFixed(1) + ' ' + y.toFixed(1)); return new Set(q).size > 2 ? 'M' + q.join('L') + 'Z' : ''; }).join('')).join(''); }
// ---- the globe (task countries-globe; decisions 2026-11-23 · "מדינות שביקרנו" - flat map or globe, Q2/Q4): an orthographic view of the
// same shapes. A point of the sphere is a unit vector (x toward 0°,0°; y toward 90°E; z the north pole); the view is a rotation, three rows
// [e, n, f] (the screen's right, its up, toward the eye): a point's screen place is (e·v, n·v), seen while f·v > 0 (the far side is not drawn).
const GLOBE_GRID = 30;             // degrees between the graticule's lines (the equator a little thicker - the screen)
const globeVec = (lng, lat) => { const l = lng * Math.PI / 180, p = lat * Math.PI / 180, c = Math.cos(p); return [c * Math.cos(l), c * Math.sin(l), Math.sin(p)]; };
const globeLL = v => [Math.atan2(v[1], v[0]) * 180 / Math.PI, Math.asin(Math.max(-1, Math.min(1, v[2]))) * 180 / Math.PI];
const gDot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
// the view facing a point, north up
function globeFacing(lng, lat) { const l = lng * Math.PI / 180, p = lat * Math.PI / 180;
  return [[-Math.sin(l), Math.cos(l), 0], [-Math.sin(p) * Math.cos(l), -Math.sin(p) * Math.sin(l), Math.cos(p)], globeVec(lng, lat)]; }
// the ball turned under the finger: a (radians) about the screen's up (+ moves the front to the right), b about its right (+ moves it down)
function globeTurn(M, a, b) { const [e, n, f] = M, ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
  const e1 = e.map((x, i) => x * ca + f[i] * sa), f1 = f.map((x, i) => -e[i] * sa + x * ca);
  return globeNorm([e1, n.map((x, i) => x * cb - f1[i] * sb), n.map((x, i) => x * sb + f1[i] * cb)]); }
// the ball turned about its own axis (w radians east - as the Earth turns)
function globeSpin(M, w) { const c = Math.cos(w), s = Math.sin(w); return M.map(r => [r[0] * c + r[1] * s, -r[0] * s + r[1] * c, r[2]]); }
// kept a rotation (rounding drifts): f normalized, n made square to it, e = n × f
function globeNorm(M) { const u = v => { const d = Math.hypot(...v) || 1; return v.map(x => x / d); }, f = u(M[2]), k = gDot(M[1], f), n = u(M[1].map((x, i) => x - k * f[i]));
  return [[n[1] * f[2] - n[2] * f[1], n[2] * f[0] - n[0] * f[2], n[0] * f[1] - n[1] * f[0]], n, f]; }
// between two views: t 0..1 along the shortest turn (quaternions), for "turn to a country"
function globeMix(A, B, t) { const q = m => { const [[a, b, c], [d, e, f], [g, h, i]] = m, tr = a + e + i; let S;
    if (tr > 0) { S = Math.sqrt(tr + 1) * 2; return [S / 4, (h - f) / S, (c - g) / S, (d - b) / S]; }
    if (a > e && a > i) { S = Math.sqrt(1 + a - e - i) * 2; return [(h - f) / S, S / 4, (b + d) / S, (c + g) / S]; }
    if (e > i) { S = Math.sqrt(1 + e - a - i) * 2; return [(c - g) / S, (b + d) / S, S / 4, (f + h) / S]; }
    S = Math.sqrt(1 + i - a - e) * 2; return [(d - b) / S, (c + g) / S, (f + h) / S, S / 4]; };
  const p = q(A), r = q(B); let d = p.reduce((s, x, i) => s + x * r[i], 0); if (d < 0) { for (let i = 0; i < 4; i++) r[i] = -r[i]; d = -d; }
  const th = Math.acos(Math.min(1, d)), s = Math.sin(th), ka = s > 1e-6 ? Math.sin((1 - t) * th) / s : 1 - t, kb = s > 1e-6 ? Math.sin(t * th) / s : t;
  const m = p.map((v, i) => v * ka + r[i] * kb), L = Math.hypot(...m), [w, x, y, z] = m.map(v => v / L);
  return globeNorm([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)], [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)], [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]]); }
// the shapes on the ball: each ring a flat Float32Array of unit vectors; a centre vector and the cosine of its reach (a shape wholly on the far side is skipped)
function globeShapes(W) { return W.map(s => { const rings = [], all = [];
  s.polys.forEach(p => p.forEach(r => { const a = new Float32Array(r.length * 3); r.forEach(([x, y], i) => { const v = globeVec(x, y); a.set(v, i * 3); all.push(v); }); rings.push(a); }));
  const c0 = globeVec(s.l[0], s.l[1]); let reach = 1; all.forEach(v => { reach = Math.min(reach, gDot(v, c0)); });
  return { id: s.id, c: c0, reach, rings, w: (s.bb[2] - s.bb[0]) * Math.PI / 180 * Math.cos(s.l[1] * Math.PI / 180), small: s.small }; }); }
// a ring's path on the ball's screen (radius R, centre cx, cy) into a canvas path: a point past the edge is laid on the edge, so a shape cut by
// the horizon closes along it; a ring with no point in front is skipped (false)
function globeRing(ctx, a, M, R, cx, cy) { const [e, n, f] = M; let i = 0;
  for (; i < a.length; i += 3) if (f[0] * a[i] + f[1] * a[i + 1] + f[2] * a[i + 2] > 0) break;
  if (i >= a.length) return false;
  for (i = 0; i < a.length; i += 3) { const x = a[i], y = a[i + 1], z = a[i + 2]; let X = e[0] * x + e[1] * y + e[2] * z, Y = n[0] * x + n[1] * y + n[2] * z;
    if (f[0] * x + f[1] * y + f[2] * z <= 0) { const d = Math.hypot(X, Y) || 1; X /= d; Y /= d; }
    if (i) ctx.lineTo(cx + R * X, cy - R * Y); else ctx.moveTo(cx + R * X, cy - R * Y); }
  ctx.closePath(); return true; }
// a screen point on the ball → [lng, lat], or null off the ball
function globeAt(M, R, cx, cy, sx, sy) { const X = (sx - cx) / R, Y = (cy - sy) / R, q = X * X + Y * Y; if (q > 1) return null; const Z = Math.sqrt(1 - q), [e, n, f] = M;
  return globeLL([0, 1, 2].map(i => X * e[i] + Y * n[i] + Z * f[i])); }
// a sphere point's screen place [x, y, z] (z > 0: in front)
function globeXY(M, R, cx, cy, v) { return [cx + R * gDot(M[0], v), cy - R * gDot(M[1], v), gDot(M[2], v)]; }
// ================= END THE WORLD'S BORDERS =================

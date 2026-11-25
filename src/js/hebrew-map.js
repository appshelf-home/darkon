// ================= "מפה בעברית" - the app's own vector drawing as a live map type (hebrew-map, decisions 2026-11-21 · Review of the map upgrades, Q7) =================
// A fifth map type: OpenFreeMap's vector tiles, fetched online through the one client (vtTile, service heMap, the openfreemap provider's 4 at once)
// and drawn by the offline maps' drawing (offDrawLayers: areas and lines per tile, in the --vmap-* tokens' light or dark style); the names are
// drawn once for the whole view by a layer of their own (heLabelLayer) - Hebrew first (vtName), no two overlapping, the trip's places' names
// first, growing with the text size. With no network a downloaded area draws the same way from the phone (offFindTile / offLayersOf).
// The map type stays a choice per phone (DEV.baseMap), never the default.
const HE_VEC = 'ofm:hebrew', HE_LBL = 'ofm:hebrew-labels';
const HE_LAYERS = OFF_LAYERS.concat(['transportation_name', 'water_name', 'poi']); // the drawing's layers and the names'
const HE_DEC = new Map(), HE_GOT = new Map(), HE_DEC_MAX = 48; // a tile's address -> its decoding (promise) / its layers once in; the last 48 kept
const HE_ST = { s: null }; // the style object read from the tokens, per mode (heStyleReset when the theme changes)
const HE_TOK = { land: 'land', wood: 'wood', grass: 'grass', sand: 'sand', ice: 'ice', cemetery: 'cemetery', civic: 'civic', pitch: 'pitch', residential: 'residential', park: 'park',
  water: 'water', aeroway: 'aeroway', building: 'building', boundary: 'boundary', casing: 'casing', tunnel: 'tunnel', rail: 'rail', label: 'label', halo: 'halo', waterLabel: 'water-label', poi: 'poi' };
const HE_ROAD_TOK = { motorway: 'motorway', trunk: 'trunk', primary: 'primary', secondary: 'secondary', tertiary: 'minor', minor: 'minor', service: 'minor', track: 'path', path: 'path' };
function heStyle() { const dark = isDarkUI(); if (HE_ST.s && HE_ST.s.dark === dark) return HE_ST.s;
  let cs = null; try { cs = getComputedStyle(document.documentElement); } catch (e) {}
  const tok = (n, d) => { const v = cs ? cs.getPropertyValue('--vmap-' + n).trim() : ''; return v || d; };
  const S = { dark }; Object.entries(HE_TOK).forEach(([k, n]) => { S[k] = tok(n, OFF_STYLE[k] || OFF_STYLE.label); });
  S.road = Object.fromEntries(Object.entries(HE_ROAD_TOK).map(([k, n]) => [k, tok('road-' + n, OFF_STYLE.road[k])]));
  return (HE_ST.s = S); }
function heStyleReset() { HE_ST.s = null; }
// the vector tile holding (z, x, y): at most the provider's top zoom (14), a deeper view drawn from its parent
function heTileKey(z, x, y) { const T = VT_TPL; if (!T) return null; const zt = Math.min(z, T.max), sc = 2 ** (z - zt), tx = Math.floor(x / sc), ty = Math.floor(y / sc);
  return { z: zt, x: tx, y: ty, u: T.t.replace('{z}', zt).replace('{x}', tx).replace('{y}', ty) }; }
async function heTile(z, x, y) { const off = () => heOffTile(z, x, y).then(T => ({ ...(T || {}), stale: true })); // round6-behaviour (G118): drawn from the phone or blank for want of an answer - asked again (mapTilesBad)
  if (svcNetDown()) return off();
  if (!VT_TPL) { try { await vtTemplate(); } catch (e) { return off(); } }
  const K = heTileKey(z, x, y); if (!K) return off();
  let p = HE_DEC.get(K.u); if (p) { HE_DEC.delete(K.u); HE_DEC.set(K.u, p); } // the last used stays
  else { p = vtTile('heMap', K.u, 15000).then(r => { if (r.kind === 'empty') return {}; if (r.kind !== 'ok') throw new Error(r.kind); return mvtLayers(r.value, HE_LAYERS); });
    HE_DEC.set(K.u, p); while (HE_DEC.size > HE_DEC_MAX) { const old = HE_DEC.keys().next().value; HE_DEC.delete(old); HE_GOT.delete(old); } }
  let L = null; try { L = await p; } catch (e) { HE_DEC.delete(K.u); if (String(e && e.message) === 'offline') return off(); throw e; } // a failure is asked again (the layer's retry)
  if (HE_DEC.has(K.u)) HE_GOT.set(K.u, L); return { z: K.z, x: K.x, y: K.y, L }; }
async function heOffTile(z, x, y) { if (typeof OFF_KEYS === 'undefined' || !OFF_KEYS.size) return null; const src = offFindTile(z, x, y); if (!src) return null;
  const L = await offLayersOf(src.key); return L ? { z: src.z, x: src.x, y: src.y, L, off: true } : null; }
// what is in hand now for a tile (the names layer draws only what the tiles already brought)
function heTileNow(z, x, y) { if (!svcNetDown()) { const K = heTileKey(z, x, y); const L = K && HE_GOT.get(K.u); if (L) return { z: K.z, x: K.x, y: K.y, L }; }
  if (typeof OFF_KEYS === 'undefined' || !OFF_KEYS.size) return null; const src = offFindTile(z, x, y), L = src && OFF_DEC.get(src.key); return L ? { z: src.z, x: src.x, y: src.y, L } : null; }
// the tiles: areas and lines of each vector tile, drawn into a canvas per screen tile (names: heLabelLayer)
function heMapLayer(o) { const lyr = vecGridLayer({ ...o, className: 'he-layer' }, heTile, (ctx, T, ox, oy, ds, z, r) => { const S = heStyle();
    ctx.fillStyle = S.land; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height); offDrawLayers(ctx, T.L, ox, oy, ds, z, r, 'areas', S); offDrawLayers(ctx, T.L, ox, oy, ds, z, r, 'lines', S); });
  lyr.on('tileload', () => { if (lyr._map) lyr._map.fire('hetiles'); }); return lyr; } // a tile in: the names place again (heLabelLayer)
// ---- the names: one canvas over the view, placed after every move ----
function heTripNames() { const out = new Set(), add = n => { n = String(n || '').trim().toLowerCase(); if (n) out.add(n); };
  try { (typeof POINTS !== 'undefined' ? POINTS : []).forEach(p => add(p && p.name)); } catch (e) {}
  try { const t = activeTripObj(); if (t) tripDests(t).forEach(d => add(d && d.name)); } catch (e) {} return out; }
const HE_PLACE = { country: [15, 700, 0, 1], state: [12, 600, 4, 4], city: [14, 700, 4, 2], town: [12.5, 600, 9, 3], village: [11, 500, 12, 5], suburb: [11.5, 500, 12, 6], island: [11, 500, 11, 6],
  quarter: [10.5, 400, 14, 7], neighbourhood: [10.5, 400, 14, 7], hamlet: [10, 400, 15, 8] }; // class -> size, weight, from zoom, rank
const HE_STREET = { motorway: 12, trunk: 12, primary: 13, secondary: 14, tertiary: 15, minor: 16, service: 17, path: 17, track: 17 }; // a street's name from this zoom
// the candidates in view: [{ t, x, y, a (angle), size, w (weight), c (colour), pr (lower first), line }] in canvas pixels
function heLabelCands(map, r) {
  const z = map.getZoom(), zt = Math.min(VT_TPL ? VT_TPL.max : 14, Math.max(0, Math.round(z))), sc = 2 ** (z - zt), pb = map.getPixelBounds(), S = heStyle(), trip = heTripNames(), out = [];
  const x0 = Math.floor(pb.min.x / sc / 256), x1 = Math.floor(pb.max.x / sc / 256), y0 = Math.max(0, Math.floor(pb.min.y / sc / 256)), y1 = Math.min(2 ** zt - 1, Math.floor(pb.max.y / sc / 256));
  const isTrip = p => trip.size && [p['name:he'], p.name, p['name:en'], p.name_en].some(n => n && trip.has(String(n).trim().toLowerCase()));
  const done = new Set(), n = 2 ** zt;
  for (let tx = x0; tx <= x1; tx++) for (let ty = y0; ty <= y1; ty++) { const T = heTileNow(zt, ((tx % n) + n) % n, ty); if (!T) continue;
    const wrap = (tx - ((tx % n) + n) % n) * 256 * sc, id = `${T.z}/${T.x}/${T.y}/${wrap}`; if (done.has(id)) continue; done.add(id); // a downloaded parent serves several tiles: once
    const ts = 256 * 2 ** (z - T.z), at = (lyr, q) => { const E = T.L[lyr].extent; return [(wrap + (T.x + q[0] / E) * ts - pb.min.x) * r, ((T.y + q[1] / E) * ts - pb.min.y) * r]; };
    const inside = (lyr, q) => q[0] >= 0 && q[1] >= 0 && q[0] < T.L[lyr].extent && q[1] < T.L[lyr].extent; // a feature in a tile's margin belongs to its neighbour
    if (T.L.place) T.L.place.feats.forEach(f => { const c = HE_PLACE[f.props.class], nm = vtName(f.props), q = f.rings[0] && f.rings[0][0]; if (!c || !nm || !q || z < c[2] || !inside('place', q)) return;
      const [x, y] = at('place', q); out.push({ t: nm, x, y, a: 0, size: c[0], w: c[1], c: S.label, pr: (isTrip(f.props) ? 0 : c[3]) * 100 + (+f.props.rank || 50) }); });
    if (T.L.water_name) T.L.water_name.feats.forEach(f => { const nm = vtName(f.props), q = f.rings[0] && f.rings[0][Math.floor(f.rings[0].length / 2)]; if (!nm || !q || !inside('water_name', q)) return;
      if (f.props.class === 'lake' && z < 10) return; const [x, y] = at('water_name', q); out.push({ t: nm, x, y, a: 0, size: 11.5, w: '400 italic', c: S.waterLabel, pr: 450 }); });
    // a sight's name: from 15 the most important of each tile, more from 16, all from 17; one with a Hebrew name before the streets, the rest after them
    if (T.L.poi && z >= 15) T.L.poi.feats.forEach(f => { const nm = vtName(f.props), q = f.rings[0] && f.rings[0][0], rk = +f.props.rank || 99, trip = isTrip(f.props), he = !!f.props['name:he'];
      if (!nm || !q || !inside('poi', q) || (!trip && (z < 16 ? rk > (he ? 6 : 2) : z < 17 ? rk > (he ? 20 : 8) : false))) return;
      const [x, y] = at('poi', q); out.push({ t: nm, x, y, a: 0, size: 10.5, w: 500, c: S.poi, pr: (trip ? 0 : he ? 700 : 1300) + rk, dot: true }); });
    if (T.L.transportation_name) T.L.transportation_name.feats.forEach(f => { const nm = vtName(f.props), from = HE_STREET[f.props.class]; if (!nm || f.type !== 2 || from == null || z < from) return;
      f.rings.forEach(rg => { let best = null; for (let i = 0; i + 1 < rg.length; i++) { const a = rg[i], b = rg[i + 1]; if (!inside('transportation_name', a) && !inside('transportation_name', b)) continue;
          const l = Math.hypot(b[0] - a[0], b[1] - a[1]); if (!best || l > best.l) best = { a, b, l }; }
        if (!best) return; const [ax, ay] = at('transportation_name', best.a), [bx, by] = at('transportation_name', best.b); let ang = Math.atan2(by - ay, bx - ax);
        if (ang > Math.PI / 2) ang -= Math.PI; else if (ang < -Math.PI / 2) ang += Math.PI;
        out.push({ t: nm, x: (ax + bx) / 2, y: (ay + by) / 2, a: ang, len: Math.hypot(bx - ax, by - ay), size: 10, w: 500, c: S.label, pr: 1000 + from * 10, line: true }); }); }); }
  return out.sort((a, b) => a.pr - b.pr); }
// place the candidates: the first that fits wins, the rest give way (no two names overlap; a street's name only where its street is long enough)
function heLabelsDraw(ctx, map, r) {
  const W = ctx.canvas.width, H = ctx.canvas.height, k = heTextScale(), S = heStyle(), boxes = [], seen = new Map();
  const hit = b => boxes.some(o => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1]);
  ctx.clearRect(0, 0, W, H); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  let n = 0;
  heLabelCands(map, r).forEach(c => { const fs = c.size * k * r; ctx.font = `${c.w} ${fs}px Rubik, Arial, sans-serif`; const w = ctx.measureText(c.t).width, h = fs * 1.15, pad = 2 * r;
    if (c.x < -w || c.y < -h || c.x > W + w || c.y > H + h) return;
    const near = seen.get(c.t); if (near && near.some(p => Math.hypot(p[0] - c.x, p[1] - c.y) < (c.line ? 260 : 120) * r)) return; // a street cut into pieces: its name once in a stretch
    let bs; if (c.line) { if (w > c.len * 0.95) return; const steps = Math.max(1, Math.ceil(w / h)), dx = Math.cos(c.a), dy = Math.sin(c.a); bs = [];
        for (let i = 0; i < steps; i++) { const t = (i + 0.5) / steps - 0.5, cx = c.x + dx * w * t, cy = c.y + dy * w * t; bs.push([cx - h / 2 - pad, cy - h / 2 - pad, cx + h / 2 + pad, cy + h / 2 + pad]); } }
    else { const oy = c.dot ? h * 0.75 : 0; bs = [[c.x - w / 2 - pad, c.y + oy - h / 2 - pad, c.x + w / 2 + pad, c.y + oy + h / 2 + pad]]; }
    if (bs.some(hit)) return; boxes.push(...bs); seen.set(c.t, (seen.get(c.t) || []).concat([[c.x, c.y]])); n++;
    ctx.save(); ctx.translate(c.x, c.y + (c.dot ? h * 0.75 : 0)); if (c.a) ctx.rotate(c.a);
    ctx.direction = /[\u0590-\u05FF]/.test(c.t) ? 'rtl' : 'ltr'; ctx.lineWidth = 3 * r; ctx.strokeStyle = S.halo; ctx.strokeText(c.t, 0, 0); ctx.fillStyle = c.c; ctx.fillText(c.t, 0, 0); ctx.restore();
    if (c.dot) { ctx.beginPath(); ctx.arc(c.x, c.y, 2.5 * r * k, 0, 7); ctx.fillStyle = c.c; ctx.fill(); ctx.lineWidth = 1.2 * r; ctx.strokeStyle = S.halo; ctx.stroke(); } });
  return n; }
// the names grow with the app's text size (the root's size against TEXT_ROOT - the phone's own scale included)
function heTextScale() { let fs = 16; try { fs = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16; } catch (e) {} return Math.max(0.8, Math.min(1.8, fs / (typeof TEXT_ROOT === 'number' ? TEXT_ROOT : 16))); }
function heLabelLayer() { if (!L.Layer || !L.DomUtil) return emptyLayer(); // the tests' stub library: nothing to place
  const Lyr = L.Layer.extend({
    onAdd(map) { this._m = map; const pane = map.getPane('heLbl') || map.createPane('heLbl'); pane.classList.add('he-lbl-pane');
      this._cv = L.DomUtil.create('canvas', 'he-lbl', pane); map.on('moveend zoomend resize viewreset hetiles', this.redraw, this); map.on('zoomstart', this._hide, this); map.on('zoom', this._zoomed, this); this.redraw(); return this; },
    onRemove(map) { clearTimeout(this._t); map.off('moveend zoomend resize viewreset hetiles', this.redraw, this); map.off('zoomstart', this._hide, this); map.off('zoom', this._zoomed, this); if (this._cv) this._cv.remove(); this._cv = null; this._m = null; return this; },
    redraw() { clearTimeout(this._t); this._t = setTimeout(() => this._draw(), 60); return this; }, // a burst of tiles and moves draws once
    _hide() { if (this._cv) this._cv.style.visibility = 'hidden'; },
    _zoomed() { if (this._m && Math.abs(this._m.getZoom() - (this._z == null ? -1 : this._z)) > 1e-3) this._hide(); }, // a pinch: the names wait for the new zoom
    _draw() { const map = this._m, cv = this._cv; if (!map || !cv || !map.getContainer().isConnected || map._removed) return;
      const size = map.getSize(), r = Math.min(2, window.devicePixelRatio || 1); if (!size.x || !size.y) return;
      cv.width = Math.round(size.x * r); cv.height = Math.round(size.y * r); cv.style.width = size.x + 'px'; cv.style.height = size.y + 'px';
      L.DomUtil.setPosition(cv, map.containerPointToLayerPoint([0, 0])); this._z = map.getZoom();
      this.count = heLabelsDraw(cv.getContext('2d'), map, r); cv.style.visibility = ''; } });
  return new Lyr(); }

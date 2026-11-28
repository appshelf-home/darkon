// ================= RELIEF DRAWN ON THE PHONE - the drawing (diet-room; split from map-tools.js, where the state RELIEF, the asker reliefGet /
// reliefAsk and the status line reliefLine stay) =================
// The special-maps group (decisions 2026-11-26 · Review of `big-dest-search`, Q1; the diet's rules, decisions 2026-11-23): "מפה עם תבליט" is
// drawn by this group like "מפה בעברית" - addBaseTiles draws the regular map until it is in (needGroup, then refreshBaseMaps), setBaseMap waits
// for it, the opening waits for it when it is the stored map type (START_GROUPS); a picture's relief (the trip picture, the schematic
// background) reaches reliefInto through groupFn after needGroup.
// the core: runs in the worker (W = the worker's global) or, when a worker cannot start, on the page (W = null, ask = the page's own asker)
function reliefCore(W, ask0) {
  const TS = 256, DEEP = 'deep', CAP = 12, raw = new Map(), depth = new Map(), asks = new Map(), st = { tiles: 0, ms: 0, decodeMs: 0, got: 0, bytes: 0, maxMs: 0 };
  let seq = 0;
  const canvas = (w, h) => typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h });
  // ask the page for one 512-px tile: { b: bytes } | { none: 1 } (404) | null (not answered)
  const ask = ask0 || ((z, x, y) => new Promise(res => { const k = ++seq; asks.set(k, res); W.postMessage({ need: k, z, x, y }); }));
  function rcDecode(b) { return createImageBitmap(new Blob([b], { type: 'image/webp' })).then(bm => { const t0 = performance.now(), c = canvas(bm.width, bm.height), g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(bm, 0, 0); if (bm.close) bm.close(); const n = c.width, d = g.getImageData(0, 0, n, n).data, h = new Float32Array(n * n);
    for (let i = 0, j = 0; i < h.length; i++, j += 4) h[i] = d[j] * 256 + d[j + 1] + d[j + 2] / 256 - 32768;
    st.decodeMs += performance.now() - t0; return n === 512 ? h : null; }); }
  // one 512-px tile, decoded: Float32Array(512*512), DEEP (a 404 above z12: the place's data ends higher - use the parent), 'sea' (a 404 at z12 or below:
  // open sea, flat) or null (not answered - not kept, asked again next time). The least recently used last; at most CAP decoded tiles (~12 MB)
  function rc512(z, x, y) { const k = z + '/' + x + '/' + y; let p = raw.get(k); if (p) { raw.delete(k); raw.set(k, p); return p; }
    p = ask(z, x, y).then(r => { if (!r) return null; if (r.none) return z > 12 ? DEEP : 'sea'; st.got++; st.bytes += r.b.byteLength; return rcDecode(r.b); }).catch(() => null)
      .then(v => { if (v == null && raw.get(k) === p) raw.delete(k); return v; });
    raw.set(k, p); for (const [kk, pp] of raw) { if (raw.size <= CAP) break; if (kk !== k) raw.delete(kk); void pp; } return p; }
  // the deepest 256-px zoom Mapterhorn has for this place (probed once per z12 area, then remembered)
  async function rcDepth(z, x, y) { const ak = z >= 13 ? (x >> (z - 12)) + '/' + (y >> (z - 12)) : null;
    if (ak && depth.has(ak) && depth.get(ak) < z) return depth.get(ak);
    for (let s = z; s >= 1; s--) { const r = await rc512(s - 1, x >> (z - s + 1), y >> (z - s + 1)); if (r === null && s === z) return -1;
      if (r !== DEEP) { if (ak && s < z && r !== null) depth.set(ak, s); return s; } }
    return 1; }
  // a 256-px source tile at zoom z: the quadrant of its 512-px parent (z-1)
  function rcDem(z, x, y) { const n = 1 << z; if (y < 0 || y >= n) return Promise.resolve(null); x = ((x % n) + n) % n;
    return rc512(z - 1, x >> 1, y >> 1).then(r => { if (r === DEEP || !r) return r === DEEP ? DEEP : null; if (r === 'sea') return new Float32Array(TS * TS);
      const h = new Float32Array(TS * TS), ox = (x & 1) * TS, oy = (y & 1) * TS; for (let j = 0; j < TS; j++) h.set(r.subarray((oy + j) * 512 + ox, (oy + j) * 512 + ox + TS), j * TS); return h; }); }
  const has = (z, x, y) => { const n = 1 << z; x = ((x % n) + n) % n; return raw.has((z - 1) + '/' + (x >> 1) + '/' + (y >> 1)); };
  function rcCubic(p0, p1, p2, p3, t) { return p1 + 0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0))); } // Catmull-Rom
  // o: { dark, wait } -> { bm (an ImageBitmap, or a canvas on the page), ms, miss } | null (nothing to draw: not answered)
  async function rcShade(z, x, y, o) {
    const zz = Math.min(z, 18), NZ = await rcDepth(zz, x >> (z - zz), y >> (z - zz)); if (NZ < 0) return null;
    const sz = Math.max(1, Math.min(NZ, z)), dz = z - sz, s = 1 << dz, step = 1 / s;
    const gx0 = x * TS / s, gy0 = y * TS / s, cx = Math.floor(gx0 / TS), cy = Math.floor(gy0 / TS), pad = dz ? 3 : 1; // the target's top-left in source pixels; the source tile that holds it
    const tx0 = Math.floor((gx0 - pad) / TS), tx1 = Math.floor((gx0 + TS * step + pad) / TS), ty0 = Math.floor((gy0 - pad) / TS), ty1 = Math.floor((gy0 + TS * step + pad) / TS);
    const Wd = (tx1 - tx0 + 1) * TS, Hh = (ty1 - ty0 + 1) * TS, m = new Float32Array(Wd * Hh).fill(NaN);
    rcDem(sz, cx, cy); await new Promise(r => setTimeout(r, o.wait == null ? 20 : o.wait)); // "lazy" seams: let the other visible tiles ask first
    let miss = 0; const parts = []; for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      if (!(tx === cx && ty === cy) && !has(sz, tx, ty)) { miss++; continue; } parts.push(rcDem(sz, tx, ty).then(h => ({ tx, ty, h: h === DEEP ? null : h }))); }
    const got = await Promise.all(parts), center = got.find(p => p.tx === cx && p.ty === cy); if (!center || !center.h) return null;
    const t0 = performance.now();
    for (const p of got) { if (!p.h) continue; const ox = (p.tx - tx0) * TS, oy = (p.ty - ty0) * TS; for (let r = 0; r < TS; r++) m.set(p.h.subarray(r * TS, r * TS + TS), (oy + r) * Wd + ox); }
    const cX0 = (cx - tx0) * TS, cY0 = (cy - ty0) * TS;
    const H = (ix, iy) => { ix = ix < 0 ? 0 : ix >= Wd ? Wd - 1 : ix; iy = iy < 0 ? 0 : iy >= Hh ? Hh - 1 : iy; const v = m[iy * Wd + ix]; if (v === v) return v; // outside what was fetched: the centre tile's edge
      ix = Math.min(Math.max(ix, cX0), cX0 + TS - 1); iy = Math.min(Math.max(iy, cY0), cY0 + TS - 1); return m[iy * Wd + ix]; };
    const G = 258, g = new Float32Array(G * G), X0 = tx0 * TS, Y0 = ty0 * TS;
    if (!dz) { for (let j = -1; j <= TS; j++) for (let i = -1; i <= TS; i++) g[(j + 1) * G + i + 1] = H(gx0 + i - X0, gy0 + j - Y0); }
    else for (let j = -1; j <= TS; j++) { const py = gy0 + (j + 0.5) * step - 0.5 - Y0, iy = Math.floor(py), fy = py - iy; // bicubic overzoom
      for (let i = -1; i <= TS; i++) { const px = gx0 + (i + 0.5) * step - 0.5 - X0, ix = Math.floor(px), fx = px - ix, r = [];
        for (let k = -1; k <= 2; k++) r.push(rcCubic(H(ix - 1, iy + k), H(ix, iy + k), H(ix + 1, iy + k), H(ix + 2, iy + k), fx)); g[(j + 1) * G + i + 1] = rcCubic(r[0], r[1], r[2], r[3], fy); } }
    // Horn's 3x3 slope, a z-factor by zoom, four lights each weighted by sin² of its angle to the downslope direction (Mark 1992, MDOW)
    const ex = 1.4 + Math.max(0, 13 - z) * 0.3, sa = Math.sin(Math.PI / 4), ca = Math.cos(Math.PI / 4), L = [225, 270, 315, 360].map(a => [Math.sin(a * Math.PI / 180) * ca, Math.cos(a * Math.PI / 180) * ca, a * Math.PI / 180]);
    const S = 0.7, HK = o.dark ? 0.3 : 0.25, sh = o.dark ? 0 : 40, out = new Uint8ClampedArray(TS * TS * 4), n2 = TS * (1 << z);
    for (let j = 0; j < TS; j++) { const yg = (y * TS + j + 0.5) / n2, lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * yg))), cs = 40075016.686 * Math.cos(lat) / n2 * 8;
      for (let i = 0; i < TS; i++) { const b = j * G + i, a = g[b], bb = g[b + 1], c = g[b + 2], d = g[b + G], f = g[b + G + 2], gg = g[b + 2 * G], h = g[b + 2 * G + 1], ii = g[b + 2 * G + 2];
        const ddx = ex * ((c + 2 * f + ii) - (a + 2 * d + gg)) / cs, ddy = ex * ((a + 2 * bb + c) - (gg + 2 * h + ii)) / cs, nl = 1 / Math.sqrt(ddx * ddx + ddy * ddy + 1), asp = Math.atan2(-ddx, -ddy);
        let v = 0, sw = 0; for (const l of L) { const sn = Math.sin(asp - l[2]), w = sn * sn + 1e-6; v += w * (-ddx * l[0] - ddy * l[1] + sa) * nl; sw += w; } v /= sw;
        const e = v - sa, q = (j * TS + i) * 4;
        if (e < 0) { out[q] = out[q + 1] = out[q + 2] = sh; out[q + 3] = 255 * S * Math.tanh(-e * 2.6); } else { out[q] = out[q + 1] = out[q + 2] = 255; out[q + 3] = 255 * HK * Math.tanh(e * 2.2); } } }
    const cv = canvas(TS, TS); cv.getContext('2d').putImageData(new ImageData(out, TS, TS), 0, 0);
    const ms = performance.now() - t0; st.ms += ms; st.tiles++; st.maxMs = Math.max(st.maxMs, ms);
    return { bm: cv.transferToImageBitmap ? cv.transferToImageBitmap() : cv, ms, miss };
  }
  if (W) W.onmessage = async e => { const q = e.data;
    if (q.got) { const f = asks.get(q.got); asks.delete(q.got); if (f) f(q.b ? { b: q.b } : q.none ? { none: 1 } : null); return; }
    if (q.stats) { W.postMessage({ stats: st, cached: raw.size }); return; }
    const r = await rcShade(q.z, q.x, q.y, q.o || {}); if (r) W.postMessage({ id: q.id, bm: r.bm, ms: r.ms, miss: r.miss }, [r.bm]); else W.postMessage({ id: q.id }); };
  return { render: rcShade, st, raw };
}
// the worker, started once (a worker that cannot start: the core runs on the page itself)
function reliefStart() { if (RELIEF.w !== null) return RELIEF.w;
  try { RELIEF.w = new Worker(URL.createObjectURL(new Blob([`(${reliefCore.toString()})(self);`], { type: 'text/javascript' })));
    RELIEF.w.onmessage = e => { const d = e.data;
      if (d.need) { reliefGet(d.z, d.x, d.y).then(r => { try { RELIEF.w.postMessage({ got: d.need, b: r && r.b, none: r && r.none }, r && r.b ? [r.b.buffer] : []); } catch (er) {} }); return; }
      const k = d.stats ? 'stats' : d.id, f = RELIEF.wait.get(k); RELIEF.wait.delete(k); if (f) f(d.stats ? d : d.bm ? { bm: d.bm, ms: d.ms, miss: d.miss } : null); };
    RELIEF.w.onerror = () => { RELIEF.w = false; RELIEF.wait.forEach(f => f(null)); RELIEF.wait.clear(); }; } catch (e) { RELIEF.w = false; }
  return RELIEF.w; }
// one shaded 256-px tile: { bm, ms, miss } | null. dark: the screen's mode unless given (a picture is always light)
function reliefShade(z, x, y, again, dark) { const o = { dark: dark == null ? isDarkUI() : dark, wait: again ? 0 : null };
  if (!reliefStart()) { RELIEF.core = RELIEF.core || reliefCore(null, reliefGet); return RELIEF.core.render(z, x, y, o); }
  const id = ++RELIEF.seq; return new Promise(res => { RELIEF.wait.set(id, res); RELIEF.w.postMessage({ id, z, x, y, o }); }); }
// the layer: a grid of 256-px canvases; a tile drawn without a neighbour is drawn again when the screen is loaded (fixSeams)
function reliefLayer(o) {
  const Lyr = L.GridLayer.extend({ createTile(co, done) { const t = document.createElement('canvas'); t.width = t.height = 256;
      reliefShade(co.z, co.x, co.y).then(r => { if (r) { t.getContext('2d').drawImage(r.bm, 0, 0); if (r.bm.close) r.bm.close(); if (r.miss) { t._miss = r.miss; t._c = co; } } else mapTilesBad(this); done(null, t); }, () => { mapTilesBad(this); done(null, t); }); return t; }, // round6-behaviour (G118): not answered - asked again
    fixSeams() { Object.values(this._tiles || {}).forEach(tl => { const t = tl.el; if (!t._miss || !tl.current) return; const c = t._c;
      reliefShade(c.z, c.x, c.y, true).then(r => { if (!r) return; if (r.miss < t._miss) { const g = t.getContext('2d'); g.clearRect(0, 0, 256, 256); g.drawImage(r.bm, 0, 0); t._miss = r.miss; } if (r.bm.close) r.bm.close(); }); }); } });
  const l = new Lyr({ crd: o.crd, maxZoom: o.maxZoom || 19, className: 'hs-layer' }); l._relief = true; l.on('load', () => l.fixSeams());
  l.on('add', () => { if (l._map) reliefLine(l._map); }); l.on('remove', () => { const m = l._map; setTimeout(() => { try { if (m) reliefLine(m); } catch (e) {} }, 0); }); return l; }
// the relief drawn into a picture (the trip picture on "מפה עם תבליט", the schematic background's relief): the same core at the grid's zoom, light,
// each 256-px canvas drawn over its cell (tileGrid); false when too many tiles did not come
async function reliefInto(ctx, G, scale, ds, onProg) { let done = 0, bad = 0; const n = G.N; // ds: a cell's side in the canvas's pixels
  const one = async c => { const x = ((c.tx % n) + n) % n; let r = await reliefShade(G.z, x, c.ty, false, false);
    if (r && r.miss) { const r2 = await reliefShade(G.z, x, c.ty, true, false); if (r2) { if (r.bm.close) r.bm.close(); r = r2; } } // a neighbour that came after: drawn again, no seam
    if (!r) bad++; done++; if (onProg) onProg(done, G.cells.length); return r; };
  const outs = await Promise.all(G.cells.map(one));
  if (bad > G.cells.length * 0.3) { outs.forEach(r => r && r.bm.close && r.bm.close()); return false; }
  G.cells.forEach((c, i) => { const r = outs[i]; if (!r) return; ctx.drawImage(r.bm, G.px(c.tx) * scale, G.py(c.ty) * scale, ds + 0.6, ds + 0.6); if (r.bm.close) r.bm.close(); }); return true; }


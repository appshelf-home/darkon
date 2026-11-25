// 10.11.0 (task memory-leak, decisions 2026-11-08 Q3-Q4): the count of the long-lived things - every listener on the window, the
// document, the visual viewport and a media query, every interval, every pending timeout, every live observer, and every map of the
// map library not yet removed. They are counted where they are made (the browser's own functions, wrapped once here, before any
// other code runs), so a thing left alive by any code - ours or the map library's - shows. A one-time listener ({ once }) is released
// by the browser itself and is not counted. lifeCount() reads it: the tests' structure guard and the app's own self-check (lifeCheck).
var LIFE = { ls: new Map(), iv: new Set(), to: new Set(), ob: new Set(), maps: new Set(), gl: new Set(), made: 0 }; // gl: map-3d's maps (MapLibre), alive until m3Close
(() => { const W = window, cap = o => !!(typeof o === 'boolean' ? o : o && o.capture);
  const own = t => t === W ? 'window' : t === document ? 'document' : t === W.visualViewport ? 'viewport' : 'media';
  const put = (k, f, c) => { let m = LIFE.ls.get(k); if (!m) LIFE.ls.set(k, m = new Map()); (m.get(f) || m.set(f, new Set()).get(f)).add(c); };
  const drop = (k, f, c) => { const m = LIFE.ls.get(k), s = m && m.get(f); if (!s) return; s.delete(c); if (!s.size) m.delete(f); };
  const wrap = t => { if (!t || t.__life) return t; t.__life = 1; const add = t.addEventListener, rm = t.removeEventListener;
    if (add) { t.addEventListener = function (ev, f, o) { if (f && !(o && o.once)) { const k = own(t) + ':' + ev, c = cap(o); put(k, f, c); if (o && o.signal) add.call(o.signal, 'abort', () => drop(k, f, c)); } return add.call(this, ev, f, o); };
      t.removeEventListener = function (ev, f, o) { if (f) drop(own(t) + ':' + ev, f, cap(o)); return rm.call(this, ev, f, o); }; }
    return t; };
  wrap(W); wrap(document); wrap(W.visualViewport);
  if (W.matchMedia) { const mm = W.matchMedia; W.matchMedia = function (q) { return wrap(mm.call(W, q)); }; }
  const si = W.setInterval, ci = W.clearInterval, st = W.setTimeout, ct = W.clearTimeout;
  W.setInterval = function () { const id = si.apply(W, arguments); LIFE.iv.add(id); return id; };
  W.clearInterval = function (id) { LIFE.iv.delete(id); return ci.call(W, id); };
  W.setTimeout = function (f) { if (typeof f !== 'function') return st.apply(W, arguments); const a = [...arguments]; let id;
    a[0] = function () { LIFE.to.delete(id); return f.apply(this, arguments); }; id = st.apply(W, a); LIFE.to.add(id); return id; };
  W.clearTimeout = function (id) { LIFE.to.delete(id); return ct.call(W, id); };
  ['ResizeObserver', 'MutationObserver', 'IntersectionObserver'].forEach(n => { const C = W[n]; if (!C) return;
    W[n] = class extends C { observe() { LIFE.ob.add(this); return super.observe(...arguments); } disconnect() { LIFE.ob.delete(this); return super.disconnect(); } }; });
  [W.matchMedia, W.setInterval, W.clearInterval, W.setTimeout, W.clearTimeout, W.ResizeObserver, W.MutationObserver, W.IntersectionObserver].forEach(f => { if (f) f.__life = 1; }); // still the browser's own (fmapPack)
  LIFE.leaf = () => { if (LIFE.leafOn || !(W.L && L.Map && L.Map.addInitHook)) return; LIFE.leafOn = 1; L.Map.addInitHook(function () { LIFE.made++; LIFE.maps.add(this); this.once('unload', () => LIFE.maps.delete(this)); }); }; // 11.29.0 (launch-fast): the library comes after the first screen - counted from when it is in
  LIFE.leaf();
})();

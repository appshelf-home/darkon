// ================= 9.7.0: TOUCH - one mechanism for every gesture (stage 13 part A, T13א; decisions Q1-Q10) =================
// Five gesture kinds, one implementation each: 'press' (a long press - a name in the bubble), 'swipe' (sideways on a row - a
// shortcut to a control already on it, which previews the result), 'pull' (a window or the map's floating card follows the
// finger and completes past a threshold), 'drag' (reorder - from ⠿ at once, or a long press on a card), 'pic' (move and zoom a
// picture). Screens only declare (gestureOn / picGesture / touchAny); recognition, vibration and what the browser may still do
// under the finger live here (CSS: the TOUCH section of the style). Outside it: a plain tap (ACTION WIRING), scrolling (the
// browser), the map's own gestures (the map component). Recognition (Q5): nothing is decided before the finger passes `slop`;
// then the direction decides - mostly sideways = a swipe if the element has one, mostly vertical = a pull if it has one,
// otherwise scrolling, left to the browser; holding still `hold` ms = a long press (light vibration) - on a draggable element
// movement after it is a drag; once a gesture is recognized the tap that ends it does not act.
const TOUCH = {
  slop: .45,                       // em - about half a letter
  hold: 500,                       // ms - a long press
  swipeAt: .17, swipeMax: .26,     // of the row's width - completes past swipeAt, travels at most swipeMax (≈60 / 90 px on a 412 phone)
  pullAt: 1 / 3,                   // of the window's height - a pull closes past it
  floatAt: .35, floatUp: .12,      // of the floating card's height - completes past floatAt (≈40 px), upward it moves at most floatUp (a hint)
  edgeTop: .2, edgeBottom: .1, edgeSpeed: 8, // of the scroll area's height - a drag near an edge scrolls, at most edgeSpeed px a frame
  dragLift: 1.5,                   // em - a finger holds the floating copy this far above it (the copy never covers where it lands; 11.14.0, P20)
  dropReach: 2.5,                  // em - a finger between the targets' bands drops into the nearest one this close (11.14.0, P20)
  springHold: 800,                 // ms - a finger held still on a folded target (a closed day's head) opens it (11.27.0, closed-day-drop Q3)
  springStill: 1,                  // em - the finger may tremble this much and still count as held; more starts the ring again
  tapAfter: 450,                   // ms - the click that ends a gesture
  dbl: 320,                        // ms - two taps this close are a double tap (a picture)
  wheel: 1.12,                     // one wheel step zooms a picture by this much
  buzz: { light: 8, confirm: 18 }, // the two vibration strengths (Q3): a gesture starts or crosses its threshold / a gesture completes
};
function buzz(kind) { try { if (navigator.vibrate) navigator.vibrate(TOUCH.buzz[kind]); } catch (e) {} }
const GESTURES = [];               // { kind, sel, o } - declared next to each area's code
function gestureOn(kind, sel, o) { GESTURES.push({ kind, sel, o: o || {} }); }
const TOUCH_ANY = { down: new Set(), end: new Set() }; // a touch (or a click) starts / a touch ends anywhere: a tap outside, the first touch
function touchAny(phase, fn, on) { TOUCH_ANY[phase][on === false ? 'delete' : 'add'](fn); }
// a picture that moves and zooms: { k() current zoom, max, pan(dx, dy), zoom(k), reset(), settle(), dblIn - zoom of a double tap at 1 }
function picGesture(el, api) { el.classList.add('g-pic'); el._pic = api; }
let G = null, P = null, _gSwallow = 0, _gTap = null;
function gFind(t, kind, src) { let best = null;
  for (const g of GESTURES) { if (g.kind !== kind || (g.o.touchOnly && src !== 'touch')) continue; const el = t && t.closest && t.closest(g.sel);
    if (el && (!best || best.el.contains(el)) && (!g.o.when || g.o.when(el, t))) best = { el, o: g.o }; }
  return best; }
function gDown(x, y, t, src, e) {
  gFinish(false);
  const c = { press: gFind(t, 'press', src), swipe: gFind(t, 'swipe', src), pull: gFind(t, 'pull', src), drag: gFind(t, 'drag', src) };
  if (!c.press && !c.swipe && !c.pull && !c.drag) return;
  G = { x0: x, y0: y, x, y, src, c, k: null, held: false, timer: 0, slop: TOUCH.slop * (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16) };
  const d = c.drag;
  if (d && d.o.grip) { c.drag = null; if (t.closest(d.o.grip)) { G.k = 'drag'; G.d = gDragNew(d); if (src !== 'touch' && e.cancelable) e.preventDefault(); return; } } // ⠿ - at once
  if (c.drag) c.drag.el.classList.add('g-arm'); // a card that a long press lifts sinks at once
  if (c.press || c.drag) G.timer = setTimeout(gHold, TOUCH.hold);
}
function gHold() { const g = G; if (!g || g.k) return; if (!(g.c.drag || g.c.press).el.isConnected) { G = null; return; } g.held = true; buzz('light');
  if (g.c.drag) { const el = g.c.drag.el; el.classList.remove('g-arm'); el.classList.add('g-lift'); g.k = 'drag'; g.d = gDragNew(g.c.drag); return; }
  g.k = 'press'; g.c.press.o.hold(g.c.press.el); }
function gMove(x, y, e) { const g = G; if (!g) return; g.x = x; g.y = y; const dx = x - g.x0, dy = y - g.y0;
  if (!g.k) {
    if (Math.hypot(dx, dy) < g.slop) return;
    clearTimeout(g.timer); if (g.c.drag) g.c.drag.el.classList.remove('g-arm');
    const side = Math.abs(dx) > Math.abs(dy), s = g.c.swipe, p = g.c.pull;
    if (side && s) { g.dir = dx > 0 ? 1 : -1; g.k = s.o.can(s.el, g.dir) ? 'swipe' : 'still'; if (g.k === 'swipe') s.el.classList.add('g-moving'); } // toward a state already set: nothing moves
    else if (!side && p && (dy > 0 || p.o.up)) { g.k = 'pull'; p.el.classList.add('g-moving'); }
    else { G = null; return; } // scrolling - the browser's
  }
  if (e && e.cancelable) e.preventDefault(); // the gesture owns the finger from here (Q4)
  if (g.k === 'swipe') { const s = g.c.swipe, w = s.el.offsetWidth, m = w * TOUCH.swipeMax, v = g.dir > 0 ? Math.max(0, Math.min(m, dx)) : Math.max(-m, Math.min(0, dx)), past = Math.abs(v) > w * TOUCH.swipeAt;
    s.el.style.transform = `translateX(${v}px)`; const k = s.o.stay && s.o.stay(s.el); if (k) k.style.transform = `translateX(${-v}px)`; // the previewing control stays in view
    if (past !== !!g.past) { g.past = past; s.o.preview(s.el, g.dir, past); if (past) buzz('light'); } }
  else if (g.k === 'pull') { const p = g.c.pull, h = p.el.offsetHeight; g.dy = dy; p.el.style.transform = `translateY(${Math.max(-h * (p.o.up || 0), Math.min(h, dy))}px)`; }
  else if (g.k === 'drag') gDragMove(g.d, y);
}
function gFinish(ok) { const g = G; if (!g) return false; G = null; clearTimeout(g.timer);
  const s = g.c.swipe, p = g.c.pull, d = g.c.drag; if (d) d.el.classList.remove('g-arm', 'g-lift');
  if (g.k === 'swipe') { s.el.classList.remove('g-moving'); s.el.style.transform = ''; const k = s.o.stay && s.o.stay(s.el); if (k) k.style.transform = ''; if (g.past) s.o.preview(s.el, g.dir, false); if (ok && g.past) { buzz('confirm'); s.o.done(s.el, g.dir); } }
  else if (g.k === 'pull') { p.el.classList.remove('g-moving'); p.el.style.transform = ''; const at = p.el.offsetHeight * p.o.at;
    if (ok && (g.dy > at || (p.o.up && g.dy < -at))) { buzz('confirm'); p.o.done(p.el, g.dy > 0 ? 1 : -1); } }
  else if (g.k === 'drag') gDragEnd(g.d, ok);
  else if (g.k === 'press' && g.c.press.o.release) g.c.press.o.release(g.c.press.el);
  if (!g.k && !g.held) return false;
  _gSwallow = Date.now() + TOUCH.tapAfter; return true; // the tap that ends a gesture does not act
}
// ---- drag to reorder (Q6): the floating copy after real movement, a line where it lands, edge scrolling, dropping in place changes nothing ----
// 11.14.0 (phone-round-1-fixes P20): one look for every drag - a finger holds the floating copy above it (dragLift; a mouse keeps it
// under the pointer), the landing mark is drawn over everything (the copy never hides it), and a whole target takes the drop: its band
// (o.head - the part of the day's title - and the zone, stretched over the gap to the next zone of the same list) is lit while the
// finger is over it; a finger in a gap drops into the nearest band within dropReach.
function touchReset() { if (G && G.k === 'drag') gFinish(false); } // a redraw ends a drag (the floating copy and the line go)
function gScroller(el) { for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) { const s = getComputedStyle(n).overflowY; if ((s === 'auto' || s === 'scroll') && n.scrollHeight > n.clientHeight + 1) return n; } return window; }
function gDragNew(c) { return { el: c.el, o: c.o, x0: G.x, y0: G.y, started: false, ghost: null, line: null, band: null, target: null, raf: 0, sc: gScroller(c.el), lit: null, spring: null, opened: [] }; }
function gDragMove(d, y) { const x = G.x; // 9.8.0 (T13ב): a grid (o.grid - the photo thumbnails) moves on both axes
  if (!d.started) { if ((d.o.grid ? Math.hypot(x - d.x0, y - d.y0) : Math.abs(y - d.y0)) < G.slop) return; gDragStart(d); }
  if (d.o.grid) d.ghost.style.left = (x - d.dx) + 'px'; gDragTarget(d, y); }
function gGhostAt(d, y) { let top = d.lift != null ? y - d.lift - d.gh : y - d.dy; // the copy rides above the finger, and never over the mark
  if (d.line.isConnected) { const lt = d.line.getBoundingClientRect().top; if (top + d.gh > lt - 6) top = lt - 6 - d.gh; }
  d.ghost.style.top = top + 'px'; }
function gDragStart(d) { const r = d.el.getBoundingClientRect(); d.dy = d.y0 - r.top; d.dx = d.x0 - r.left; d.started = true;
  d.gh = r.height; d.lift = G.src === 'touch' ? G.slop / TOUCH.slop * TOUCH.dragLift : null; // a finger: the copy rides above it
  d.ghost = d.el.cloneNode(true); d.ghost.classList.remove('g-lift', 'g-arm'); d.ghost.classList.add('g-ghost'); d.ghost.removeAttribute('id');
  d.ghost.style.cssText = `position:fixed;left:${r.left}px;top:${r.top}px;width:${r.width}px;margin:0;z-index:4000;pointer-events:none`;
  document.body.appendChild(d.ghost); d.el.classList.add('g-dragging');
  d.line = document.createElement('div'); d.line.className = d.o.grid ? 'g-dropline g-dropv' : 'g-dropline';
  d.band = document.createElement('div'); d.band.className = 'g-dropband';
  const tick = () => { if (!G || G.d !== d) return; const s = d.sc, vr = s === window ? { top: 0, bottom: window.innerHeight } : s.getBoundingClientRect(), h = vr.bottom - vr.top, y = G.y;
    const top = vr.top + h * TOUCH.edgeTop, bot = vr.bottom - h * TOUCH.edgeBottom; let v = 0;
    if (y < top) v = -(top - y) / (h * TOUCH.edgeTop / 2); else if (y > bot) v = (y - bot) / (h * TOUCH.edgeBottom / 2);
    if (v) { s.scrollBy(0, Math.round(Math.max(-1, Math.min(1, v)) * TOUCH.edgeSpeed)); gDragTarget(d, y); }
    gSpringTick(d); d.raf = requestAnimationFrame(tick); };
  d.raf = requestAnimationFrame(tick); }
function gDropBands(d) { const vw = document.documentElement.clientWidth;
  const zs = d.o.zones(d.el).map(zone => { const zr = zone.getBoundingClientRect(), h = d.o.head && d.o.head(zone), hr = h && h.getBoundingClientRect();
    return { zone, top: hr ? Math.min(hr.top, zr.top) : zr.top, bottom: zr.bottom, left: Math.max(0, Math.min(zr.left, hr ? hr.left : zr.left) - 4), right: Math.min(vw, Math.max(zr.right, hr ? hr.right : zr.right) + 4) }; });
  zs.forEach((z, i) => { const n = zs[i + 1]; if (n && n.zone.parentElement === z.zone.parentElement && n.top > z.bottom) z.bottom = n.top; }); // the gap belongs to the band above it
  // 11.27.0 (closed-day-drop Q1): a folded target's head (o.heads - a closed day's head) is a band of its own: no row, no landing mark
  if (d.o.heads) d.o.heads(d.el).forEach(h => { const r = h.getBoundingClientRect(); if (r.height) zs.push({ head: h, top: r.top, bottom: r.bottom, left: Math.max(0, r.left - 4), right: Math.min(vw, r.right + 4) }); });
  return zs; }
function gDragTarget(d, y) { let best = null, rtl = false; const x = G ? G.x : d.x0, em = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16, zs = gDropBands(d);
  let b = zs.find(z => y >= z.top && y <= z.bottom);
  if (!b) { let far = Infinity; zs.forEach(z => { const dist = y < z.top ? z.top - y : y - z.bottom; if (dist < far) { far = dist; b = z; } }); if (far > TOUCH.dropReach * em) b = null; }
  if (b && b.head) best = { head: b.head };
  else if (b) { const zone = b.zone, rows = [...zone.querySelectorAll(d.o.items)].filter(c => c !== d.el); let idx = rows.length; rtl = d.o.grid && getComputedStyle(zone).direction === 'rtl';
    for (let i = 0; i < rows.length; i++) { const rr = rows[i].getBoundingClientRect();
      if (d.o.grid ? (y < rr.top || (y <= rr.bottom && (rtl ? x > rr.left + rr.width / 2 : x < rr.left + rr.width / 2))) : y < rr.top + rr.height / 2) { idx = i; break; } }
    best = { zone, before: rows[idx] || null, idx, rows }; }
  d.target = best; d.line.remove(); d.band.remove(); gHeadLit(d, best && best.head, x, y); if (!best) { gGhostAt(d, y); return; }
  d.band.style.cssText = `position:fixed;top:${b.top - 4}px;height:${b.bottom - b.top + 8}px;left:${b.left}px;width:${b.right - b.left}px`; document.body.appendChild(d.band); // the target's band, lit
  if (best.head) { gGhostAt(d, y); return; } // a folded target's head: lit, no mark (there is no row)
  if (d.o.grid) { const c = best.before || best.rows[best.rows.length - 1]; if (!c) { gGhostAt(d, y); return; } const r = c.getBoundingClientRect(), start = !!best.before === !!rtl; // a grid: a standing line on the cell's edge
    d.line.style.cssText = `position:fixed;top:${r.top}px;height:${r.height}px;left:${(start ? r.right : r.left) - 2}px`; document.body.appendChild(d.line); gGhostAt(d, y); return; }
  const zr = best.zone.getBoundingClientRect(), last = best.rows[best.rows.length - 1], ly = best.before ? best.before.getBoundingClientRect().top - 3 : last ? last.getBoundingClientRect().bottom + 3 : zr.top + zr.height / 2;
  d.line.style.cssText = `position:fixed;top:${ly}px;left:${zr.left + 2}px;width:${zr.width - 4}px`; document.body.appendChild(d.line); gGhostAt(d, y); } // over everything: the copy never hides it
// 11.27.0 (closed-day-drop Q1, Q3, Q4): spring-loading - a finger held still on a lit head fills the ring of its expand arrow (--spring,
// 0 → 1 over TOUCH.springHold) and then the target opens (o.open) with the light vibration; the drag goes on into its bands without
// lifting. Leaving the head, or moving more than springStill, starts again: passing over a head never opens it. Whatever the drag
// opened is handed back at its end (o.opened) - the target that took the card stays open, the rest close.
function gHeadLit(d, h, x, y) { if (d.lit !== h) { if (d.lit) { d.lit.classList.remove('g-spring'); d.lit.style.removeProperty('--spring'); if (d.o.headLit) d.o.headLit(d.lit, d.el, false); }
    d.lit = h || null; d.spring = null; if (h && d.o.headLit) d.o.headLit(h, d.el, true); }
  if (!h || !d.o.open) return; const em = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16, s = d.spring;
  if (!s || Math.hypot(x - s.x, y - s.y) > TOUCH.springStill * em) { d.spring = { x, y, t0: performance.now() }; h.classList.add('g-spring'); h.style.setProperty('--spring', '0'); } }
function gSpringTick(d) { const h = d.lit, s = d.spring; if (!h || !s) return; const p = Math.min(1, (performance.now() - s.t0) / TOUCH.springHold); h.style.setProperty('--spring', p.toFixed(3));
  if (p < 1) return; gHeadLit(d, null); const k = d.o.open(h); if (k == null) return; d.opened.push(k); buzz('light'); if (G) gDragTarget(d, G.y); }
function gDragEnd(d, ok) { cancelAnimationFrame(d.raf); if (d.ghost) d.ghost.remove(); if (d.line) d.line.remove(); if (d.band) d.band.remove(); d.el.classList.remove('g-dragging');
  gHeadLit(d, null); const took = ok && d.started && d.target ? d.target : null; if (d.opened.length && d.o.opened) d.o.opened(d.opened, took);
  if (!took) return;
  if (took.head) { buzz('confirm'); d.o.headDrop(d.el, took.head); return; }
  const own = d.o.zones(d.el).find(z => z.contains(d.el));
  if (d.target.zone === own && [...own.querySelectorAll(d.o.items)].indexOf(d.el) === d.target.idx) return; // dropped where it was
  buzz('confirm'); d.o.drop(d.el, d.target); }
// ---- a picture (Q10): one finger moves, two zoom, the wheel zooms, a double tap returns to the original size ----
function gPicDown(t, id, x, y) { const el = t && t.closest && t.closest('.g-pic'); if (!el || !el._pic || t.closest('button')) return false;
  if (!P || P.el !== el) P = { el, api: el._pic, pts: new Map(), base: null, moved: false };
  P.pts.set(id, [x, y]); P.base = null; if (P.pts.size === 1) P.moved = false; return true; }
function gPicMove(id, x, y) { if (!P || !P.pts.has(id)) return; const a = P.api, prev = P.pts.get(id); P.pts.set(id, [x, y]);
  if (Math.hypot(x - prev[0], y - prev[1]) > 0) P.moved = true;
  if (P.pts.size === 1) { a.pan(x - prev[0], y - prev[1]); return; }
  const [p, q] = [...P.pts.values()], dd = Math.hypot(p[0] - q[0], p[1] - q[1]); if (!P.base) { P.base = { d: dd, k: a.k() }; return; }
  a.zoom(Math.max(1, Math.min(a.max, P.base.k * dd / P.base.d))); }
function gPicUp(id, x, y) { if (!P || !P.pts.has(id)) return; P.pts.delete(id); P.base = null; if (P.pts.size) return;
  const a = P.api, now = Date.now(); if (a.settle) a.settle();
  if (P.moved) { _gTap = null; return; }
  if (_gTap && now - _gTap.t < TOUCH.dbl && Math.hypot(x - _gTap.x, y - _gTap.y) < 30) { _gTap = null; if (a.k() > 1.02) a.reset(); else if (a.dblIn) a.zoom(a.dblIn); return; }
  _gTap = { t: now, x, y }; }
// ---- the page under a window does not scroll (4.20.1): a drag outside the window, or inside one that has nothing to scroll, is held ----
function gUnder(e) { const bd = document.getElementById('sheetBackdrop'); if (!bd || !bd.contains(e.target)) return;
  const sh = e.target.closest && e.target.closest('.sheet'); if (!sh) { if (e.cancelable) e.preventDefault(); return; }
  for (let el = e.target; el && el !== bd; el = el.parentElement) if (el.scrollHeight > el.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(el).overflowY)) return;
  if (e.cancelable) e.preventDefault(); }
function touchInit() { // the only touch, pointer, wheel and context-menu listeners of the app (the map component keeps its own)
  document.addEventListener('pointerdown', e => { _gSwallow = 0; TOUCH_ANY.down.forEach(f => f(e)); if (e.target.closest && e.target.closest('[data-keepfocus]')) e.preventDefault(); // ✕ in a field keeps the focus
    if (e.pointerType === 'touch' || e.button !== 0) return; if (!gPicDown(e.target, 'm', e.clientX, e.clientY)) gDown(e.clientX, e.clientY, e.target, 'mouse', e); }, true);
  window.addEventListener('pointermove', e => { if (e.pointerType === 'touch') return; gPicMove('m', e.clientX, e.clientY); if (G && G.src === 'mouse') gMove(e.clientX, e.clientY, e); });
  window.addEventListener('pointerup', e => { if (e.pointerType === 'touch') return; TOUCH_ANY.end.forEach(f => f(e)); gPicUp('m', e.clientX, e.clientY); if (G && G.src === 'mouse') gFinish(true); });
  window.addEventListener('pointercancel', e => { if (e.pointerType !== 'touch') { if (P) P.pts.delete('m'); gFinish(false); } });
  document.addEventListener('touchstart', e => { const t = e.changedTouches[0]; let pic = false;
    for (const x of e.changedTouches) pic = gPicDown(x.target, x.identifier, x.clientX, x.clientY) || pic;
    if (pic) return; if (e.touches.length > 1) { gFinish(false); return; } gDown(t.clientX, t.clientY, e.target, 'touch', e); }, { passive: true, capture: true }); // 11.14.0 (P21): capture - the map library stops a touch on its own buttons from bubbling (disableClickPropagation), which hid their long press
  document.addEventListener('touchmove', e => { gUnder(e);
    if (P) { let mine = false; for (const x of e.touches) if (P.pts.has(x.identifier)) { mine = true; gPicMove(x.identifier, x.clientX, x.clientY); } if (mine && e.cancelable) e.preventDefault(); }
    const t = e.touches[0]; if (G && G.src === 'touch' && t) gMove(t.clientX, t.clientY, e); }, { passive: false });
  document.addEventListener('touchend', e => { TOUCH_ANY.end.forEach(f => f(e)); for (const x of e.changedTouches) gPicUp(x.identifier, x.clientX, x.clientY);
    if (G && G.src === 'touch' && !e.touches.length && gFinish(true) && e.cancelable) { e.preventDefault(); _gSwallow = 0; } }, { passive: false }); // no click follows
  document.addEventListener('touchcancel', e => { if (P) for (const x of e.changedTouches) P.pts.delete(x.identifier); gFinish(false); });
  document.addEventListener('wheel', e => { const el = e.target.closest && e.target.closest('.g-pic');
    if (el && el._pic) { e.preventDefault(); const a = el._pic; a.zoom(Math.max(1, Math.min(a.max, a.k() * (e.deltaY < 0 ? TOUCH.wheel : 1 / TOUCH.wheel)))); if (a.settle) a.settle(); return; }
    gUnder(e); }, { passive: false });
  document.addEventListener('contextmenu', e => { if ((G && (G.held || G.k)) || ['press', 'drag', 'swipe'].some(k => gFind(e.target, k, 'touch'))) e.preventDefault(); }, true); // a long press opens no menu
  document.addEventListener('click', e => { if (Date.now() < _gSwallow) { _gSwallow = 0; e.preventDefault(); e.stopPropagation(); } }, true); // no "open" after a gesture
}
touchInit();
// ================= END TOUCH =================

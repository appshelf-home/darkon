// ================= 10.6.0: KEYBOARD AND REVEAL (task keyboard; decisions.md 2026-11-07; standard: tech-shared-mechanisms "Reveal" and "Keyboard") ====
// one visible-area function serves both. kbFit sizes every layer to the visual viewport (--vvh / --vvt; --kbh = the keyboard's
// height), so a layer and its pinned save bar sit above the keyboard; kbKeep keeps the field being typed in - or its caret line,
// when the field is taller than the area - inside that area; reveal() brings what a tap opened inline into view.
// The visible area for a node: inside its layer (a window, a menu screen, the picture editor's list) below the layer's own head
// and above its pinned bottom bar, or on the page below the sticky top bar and above the bottom navigation and the ＋ button;
// always cut by the visual viewport (the keyboard). A full-screen dialog's title bar with "שמירה" never scrolls away (Material 3).
function kbArea(node) {
  const vv = window.visualViewport, vTop = vv ? vv.offsetTop : 0, vBot = vv ? vv.offsetTop + vv.height : window.innerHeight;
  const vis = el => !!(el && el.offsetHeight && el.getClientRects().length);
  const box = node.closest('#sheet, .screen-layer, .tp-body');
  let top = vTop, bot = vBot;
  if (box) {
    const br = box.getBoundingClientRect(); top = Math.max(br.top, vTop); bot = Math.min(br.bottom, vBot);
    const isSheet = box.id === 'sheet', isScreen = box.classList.contains('screen-layer');
    const hd = isSheet ? box.querySelector('.sheet-head') : isScreen ? box.querySelector(':scope > .screen-head') : null;
    const ft = isSheet ? box.querySelector('.sheet-save-bar') : isScreen ? box.querySelector('.dr-dock') : null;
    if (vis(hd) && !hd.contains(node)) top = Math.max(top, hd.getBoundingClientRect().bottom);
    if (vis(ft) && !ft.contains(node)) bot = Math.min(bot, ft.getBoundingClientRect().top);
    if (isScreen) box.querySelectorAll('.ro-bar, .arr-top, #draftFilter').forEach(s => { if (vis(s) && !s.contains(node)) { const r = s.getBoundingClientRect(); if (r.top <= top + 6 && r.bottom > top) top = r.bottom; } });
  } else {
    const hdr = document.querySelector('header.top');
    if (vis(hdr)) top = Math.max(top, hdr.getBoundingClientRect().bottom);
    document.querySelectorAll('#main .ro-bar, #main .arr-top').forEach(s => { if (vis(s) && !s.contains(node)) { const r = s.getBoundingClientRect(); if (r.top <= top + 6 && r.bottom > top) top = r.bottom; } });
    const nav = document.getElementById('bottomNav'), fab = document.getElementById('addFab');
    if (vis(nav) && !nav.classList.contains('hide')) { const r = nav.getBoundingClientRect(); if (r.width > r.height && r.top > top && r.top < bot) bot = r.top; } // the side rail is beside, not below
    if (vis(fab)) { const r = fab.getBoundingClientRect(); if (r.top > top && r.top < bot) bot = r.top; }
  }
  return { box, top, bot };
}
function kbScroll(a, by, smooth) { // by: pixels to scroll (under one = nothing)
  if (Math.abs(by) < 1) return;
  const behavior = smooth && !matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'auto';
  (a.box || window).scrollBy({ top: by, behavior });
}
// reveal: a panel, field, editor or fold that a tap opens inline comes into view - nearest edge, only when not fully visible,
// top first when taller than the area (align 'start' / 'center' for a jump to a chapter or the tour's highlight); then focus goes
// to focusEl, or to the first control that is not a text field (the keyboard opens only on a tap in a field - Material 3), or
// nowhere (false: a disclosure keeps focus on its toggle). opt: { instant, align }
let _revealAt = 0;
// back-exit 2b (decisions 2026-11-20 · After loading a trip, Q2): every scroll the app makes by itself goes through here - marked like reveal()'s,
// so the scroll listener (startup.js) never takes it for the person's scroll down and never hides the bottom bar. smooth: the smooth jump to the top
function pageTop() { const go = () => { if (document.documentElement.classList.contains('sheet-open')) _lockY = 0; appScroll(0); }; // the page at its top, also under an open window (its unlock returns there)
  go(); } // back-exit-fix (finding 1): once only - with the browser's scroll restoration off (layer-manager.js), a window's closing back no longer puts back a scroll its history entry kept
function appScroll(y, smooth) { if (y > window.scrollY + 1) _revealAt = Date.now(); /* only a scroll down can hide the bar - one up or in place leaves the person's next scroll alone */ if (smooth) window.scrollTo({ top: y, behavior: 'smooth' }); else window.scrollTo(0, y); }
function reveal(node, focusEl, opt) {
  if (!node || !node.isConnected || !node.getClientRects().length) return;
  opt = opt || {}; _revealAt = Date.now();
  const a = kbArea(node), r = node.getBoundingClientRect(), gap = 8, room = a.bot - a.top;
  let dy = 0;
  if (opt.align === 'start' || r.height > room - 2 * gap) dy = r.top - a.top - gap;
  else if (opt.align === 'center') dy = (r.top + r.bottom) / 2 - (a.top + a.bot) / 2; // the caller decided it must move
  else if (r.top < a.top + gap) dy = r.top - a.top - gap;
  else if (r.bottom > a.bot - gap) dy = r.bottom - a.bot + gap;
  kbScroll(a, dy, !opt.instant);
  if (focusEl === false) return;
  const f = focusEl || [...node.querySelectorAll('button, select, a[href], input, [tabindex]:not([tabindex="-1"])')].find(x => !kbTyping(x) && !x.disabled && x.getClientRects().length);
  if (!f || !f.focus) return;
  try { f.focus({ preventScroll: true }); } catch (e) { f.focus(); }
  // a text field given on purpose brings up the keyboard a moment later: one more check against the smaller viewport
  const vv = window.visualViewport;
  if (vv && kbTyping(f)) { const once = () => { sysOff(vv, 'resize', once); reveal(node, false, { instant: true }); }; sysOn(vv, 'resize', once); setTimeout(() => sysOff(vv, 'resize', once), 1000); }
}
// after an action that redraws (a day of the plan opened): reveal what the selector finds once the redraw has landed
function revealLater(sel, focusEl, opt) { requestAnimationFrame(() => requestAnimationFrame(() => reveal(document.querySelector(sel), focusEl, opt))); }
function kbTyping(n) {
  if (!n || !n.tagName) return false;
  if (n.tagName === 'TEXTAREA' || n.isContentEditable) return true;
  return n.tagName === 'INPUT' && /^(text|search|url|email|tel|number|password)$/.test(n.type || 'text');
}
// the caret's line inside a tall text area, measured with a mirror element
function kbCaretTop(ta) {
  const cs = getComputedStyle(ta), m = document.createElement('div');
  ['boxSizing', 'width', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth', 'borderStyle',
    'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'wordSpacing', 'direction', 'textAlign'].forEach(k => { m.style[k] = cs[k]; });
  Object.assign(m.style, { position: 'absolute', visibility: 'hidden', whiteSpace: 'pre-wrap', overflowWrap: 'break-word', top: '0', left: '-9999px', height: 'auto' });
  m.textContent = ta.value.slice(0, ta.selectionEnd == null ? ta.value.length : ta.selectionEnd);
  const sp = document.createElement('span'); sp.textContent = '​'; m.appendChild(sp);
  document.body.appendChild(m); const y = sp.offsetTop - ta.scrollTop; m.remove();
  return y;
}
function kbKeep(f) {
  if (!f || !f.isConnected || !f.getClientRects().length) return;
  const a = kbArea(f), r = f.getBoundingClientRect(), gap = 8, room = a.bot - a.top;
  let t = r.top, b = r.bottom, dy = 0;
  if (f.tagName === 'TEXTAREA' && r.height > room - 2 * gap) {
    const lh = parseFloat(getComputedStyle(f).lineHeight) || 24, cy = Math.max(0, Math.min(kbCaretTop(f), r.height - lh));
    t = r.top + cy; b = t + lh;
  }
  if (b - t > room - 2 * gap || t < a.top + gap) dy = t - a.top - gap;
  else if (b > a.bot - gap) dy = b - a.bot + gap;
  kbScroll(a, dy, false);
}
// every layer follows the visual viewport: CSS variables set on each resize / scroll of it, unset at full height or when zoomed
function kbFit() {
  const vv = window.visualViewport, root = document.documentElement, st = root.style;
  const clear = () => { st.removeProperty('--vvh'); st.removeProperty('--vvt'); st.removeProperty('--kbh'); };
  if (!vv || Math.abs((vv.scale || 1) - 1) > 0.01) { clear(); root.classList.remove('kb'); return; }
  const h = Math.round(vv.height), t = Math.round(vv.offsetTop), ih = window.innerHeight;
  if (h >= ih - 1 && t <= 0) clear();
  else { st.setProperty('--vvh', h + 'px'); st.setProperty('--vvt', t + 'px'); st.setProperty('--kbh', Math.max(0, ih - h - t) + 'px'); }
  root.classList.toggle('kb', ih - h > 80);
}
let _kbT = 0;
function kbKeepActive() { clearTimeout(_kbT); _kbT = setTimeout(() => { const f = document.activeElement; if (kbTyping(f)) kbKeep(f); }, 0); }
// a field on the page (not in a layer) being typed in: the bottom navigation, the ＋ button and ↑ step aside (CSS body.typing)
function kbTypingSync() { const a = document.activeElement; document.body.classList.toggle('typing', kbTyping(a) && !a.closest('.sheet-backdrop, .screen-layer, .tp-ed')); }
function kbInit() {
  const vv = window.visualViewport;
  if (vv) { const on = () => { kbFit(); kbKeepActive(); }; sysOn(vv, 'resize', on); sysOn(vv, 'scroll', on); }
  kbFit();
  sysOn(document, 'focusin', e => { const t = e.target; kbTypingSync();
    // a field focused by reveal() was just brought into view with its panel; the keyboard's resize brings the next check
    if (kbTyping(t) && Date.now() - _revealAt > 600) setTimeout(() => { if (document.activeElement === t) kbKeep(t); }, 60); });
  sysOn(document, 'focusout', () => setTimeout(kbTypingSync, 0));
  sysOn(document, 'input', e => { if (kbTyping(e.target) && e.target === document.activeElement) kbKeepActive(); }); // a growing text moves the caret
  // a native fold (details / summary) opened by a tap is a disclosure: its content comes into view, focus stays on the summary
  sysOn(document, 'click', e => { const sm = e.target.closest && e.target.closest('summary'), d = sm && sm.parentElement;
    if (!d || d.tagName !== 'DETAILS' || d.open) return; setTimeout(() => { if (d.open) reveal(d, false); }, 30); });
}
kbInit();
// ================= END KEYBOARD AND REVEAL


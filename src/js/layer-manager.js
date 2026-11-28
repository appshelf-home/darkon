// ================= 5.4.0: ONE LAYER MANAGER (stage 1 of cl-windows-impl-plan; builds on the 5.1.0 stack) =================
// Everything that opens over a screen is one entry in WIN_STACK and one history entry: every window (bottom sheet or a window
// drawn full screen), every full screen (full-screen map, the point picker, the picture editor, its crop and full-screen view,
// 🗺️ במפה) and the 📏 measuring mode. ✕ and the phone's back close only the top entry and return to the one under it exactly
// as it was left: a covered window is not drawn again - its nodes move aside into their own element under the top one (still
// seen behind it, dimmed), with its fields, open parts and scroll, and come back as they were. Only when something was saved
// while it was covered (and it has no unsaved changes of its own) is it drawn again from its draw(), at the same scroll.
// Moving somewhere else (another tab, "to this day's plan", another trip) closes everything (closeAllSheets / layerCloseAll).
// No feature keeps its own history keys: the one place that writes history is layerPushHistory().
// How a window joins: its builder writes #sheet.innerHTML and calls showSheetBackdrop(kind). The write moves the current content
// aside (layerStash); showSheetBackdrop decides - another kind = a new window on top (the content aside becomes the window under
// it), the same kind = the same window drawn again (the old content is dropped).
// windows-inner-steps (11.15.0, decisions 2026-11-15 · A window opened from a window): A BOTTOM SHEET NEVER OPENS OVER A BOTTOM
// SHEET. Whatever a bottom sheet opens that is itself a bottom sheet (related or not) is an inner step of the same sheet: it is
// still its own entry in WIN_STACK and in history (step: true), but the step under it is hidden (.step-under), not seen behind;
// the new content slides in from the side in the reading direction, the sheet animates its height, and a back arrow at the start
// of the title (win.back) - like the phone's back - goes one step back to the step as it was left. Pull down and a tap outside
// close the whole sheet (sheetAskCloseAll). Only full screens (editors, menu screens) and a bottom sheet over a full screen
// (pickers from an editor) open on top; the layer under them never moves. Every exit that leaves more than the top layer stops at
// the first layer with an unsaved change, from the top down, and asks there (layerLeave).
var WIN_STACK = []; // var: used at startup (persist, goTab) before this line // bottom..top: { key, shape, draw, el, scroll, gen, close, onReturn, onCancel }
var _dataGen = 0;    // +1 on every save (persist): a covered window is drawn again only if this moved
var _ignorePops = 0; // popstate events the app itself caused (one per history.go)
var _winSwap = 0;    // a newer window drawn meanwhile cancels a deferred return
var _sheetOpen = false, _sheetKind = null, _sheetOnCancel = null; // 4.20.1: a dialog that applies changes live sets _sheetOnCancel; closing without ✓ runs it
var _stash = null, _lastBuild = null, _restoring = false;
function layerTop() { return WIN_STACK[WIN_STACK.length - 1] || null; }
function sheetLayers() { let n = 0; if (!WIN_STACK) return 0; for (let i = WIN_STACK.length - 1; i >= 0 && WIN_STACK[i].shape === 'sheet'; i--) n++; return n; }
// 9.0.0: a layer opened right after one closed (closeSheet(); open…) waits for the browser to finish that back - history.go is
// async, and a push before it lands was undone by it (the stack and the history fell out of step; t670)
var _pushLater = 0, _pushLaterT = 0;
// place-find (G68; notes/phone-round-3/results.md): a window opened before the user touched the page (the app started by a share - "מקום
// חדש") pushed its history entry with no user activation, and Chrome's history intervention skips such an entry on back: the phone's
// back left the app instead of closing the window, and what was typed was lost. Such a push waits for the first touch or key
// (_pushNoAct), so the entry is made with an activation and counts; a layer closed before that has no entry to go back over.
// Only when the app was started by a share (SHARE_START, startup.js): everywhere else a window opens from a tap.
var _pushNoAct = 0, SHARE_START = false;
function layerActive() { if (!SHARE_START) return true; try { const u = navigator.userActivation; return !u || u.hasBeenActive; } catch (e) { return true; } }
function layerPushRaw(n) { if (n === 1 || (n === 'sure' && !WIN_STACK.length)) { exitWarnEnd(); if (exitCWOk()) exitCWOff(); else exitGuardArm(); } /* back-exit: the guard goes under the first window's entry (or a dialog's on the bare page) */ try { history.pushState(n === 'sure' ? { sure: 1 } : n ? { layer: n } : { exitGuard: 1 }, ''); } catch (e) {} } // the one place that writes history (n 0: the exit guard; 'sure': a confirmation dialog - back-exit-fix)
// back-exit (decisions 2026-11-20 · Back on a main screen: press twice to leave the app, Q2-Q5): in the installed app, with "לחיצה כפולה"
// (STATE.settings.backExit absent; 'once' = "לחיצה אחת"), the bare page keeps one guard entry ({ exitGuard: 1 }) under the windows' entries.
// A back that goes under it with no layer open is a leave press: the bottom message for EXIT_WARN_MS, the guard not pushed meanwhile, so a
// second back within that time leaves the app (nothing of the app's is left behind it); when the message ends the guard is pushed again.
// The guard is pushed only with a user activation (Chrome skips on back an entry pushed with none - the share-start rule): before the first
// touch or key back leaves as before. Windows and inner steps keep closing one by one above it; the app's own history.go (_ignorePops)
// never counts as a press; moving between tabs, trips or screens pushes nothing. In a browser tab, or with "לחיצה אחת", back is as before:
// a guard left from the other choice is taken off (one step back, the app's own) once no layer is open.
var EXIT_WARN_MS = 2000, _exitGuard = false, _exitAct = false, _exitWarn = false, _exitWarnT = 0;
try { if (history.state && history.state.exitGuard) _exitGuard = true; } catch (e) {} // a reload on the guard keeps it
// back-exit-fix (decisions 2026-11-20 · Review of the `back-exit` summary, finding 1): the browser never puts back a scroll of its own on a back -
// a back that goes under the guard landed on the entry below it with the scroll that entry kept (the screen jumped); the app makes every
// scroll itself (appScroll, pageTop, "כללי"'s kept spot), and a page never scrolls while a window is open over it
try { history.scrollRestoration = 'manual'; } catch (e) {}
function exitTwice() { try { return appInstalled() && !(STATE.settings && STATE.settings.backExit === 'once'); } catch (e) { return false; } }
function exitActive() { if (_exitAct) return true; try { const u = navigator.userActivation; return !!(u && u.hasBeenActive); } catch (e) { return false; } }
// 11.46.0 (phone-round-4c-fixes P1, G96; notes/phone-round-4c-fixes-summary.md): one back left the app with no message on the plan screen
// and at the bottom of the places screen. The guard entry is pushed only with a user activation, and Chrome marks an entry pushed without
// one to be skipped on back: the app opened on the plan (during a trip it opens there) and a scroll (never an activation - the browser
// cancels the touch) left no guard, so the first back left; and a guard pushed again by the message's timer, with no tap since the last
// push, made the entry under it one that back skips. A browser with close watchers (Chrome 120+ - Android's back is a close request
// to the page before any history step) gets the guard as one CloseWatcher on the bare page instead of the entry: it needs no activation
// (one is always allowed) and it is never skipped. Its close is the leave press (the message); it is not made again until the message
// ends, so a second back within it leaves; it is taken off before any window, inner step or dialog opens (their entries stay the
// history's), and made again once the bare page is back (exitGuardSync). Escape on a keyboard is a close request too - never a leave press.
// Elsewhere the history guard stays as it was.
var _exitCW = null, _exitEsc = 0;
function exitCWOk() { try { return typeof CloseWatcher === 'function'; } catch (e) { return false; } }
// destination-view (decisions 2026-11-26 · A destination's places without opening a trip, Q4): while a view is on (viewOn - the archive view, the
// destination view) the bare page keeps its guard in every mode, and its close is the view's end (viewBack), never the leave message
function exitGuarded() { return exitTwice() || viewOn(); }
function exitCWArm() { if (_exitCW || _exitWarn || !exitGuarded() || document.querySelector('body > .sure-q')) return;
  if (history.state && history.state.exitGuard) { _exitGuard = false; layerAppBack(1); return; } // a guard entry left from before (a reload on it): one step of the app's own, then the watcher
  try { const w = new CloseWatcher(); w.onclose = () => { if (_exitCW !== w) return; _exitCW = null;
    if (Date.now() - _exitEsc < 500 || WIN_STACK.length || popMenuClose()) { exitGuardSync(); return; } if (viewOn()) { viewBack(); exitGuardSync(); return; } exitWarnShow(); }; _exitCW = w; } catch (e) { _exitCW = null; } }
function exitCWOff() { const w = _exitCW; _exitCW = null; if (w) try { w.destroy(); } catch (e) {} }
function exitGuardArm() { if (exitCWOk()) { exitCWArm(); return; } if (_exitGuard || _exitWarn || !exitGuarded() || !exitActive()) return; _exitGuard = true; layerPushRaw(0); }
function exitGuardSync() { if ((WIN_STACK && WIN_STACK.length) || _ignorePops > 0 || _pushLater > 0 || _exitWarn || _sureEntry) return; // only on the bare page, history settled, no dialog's entry on top
  if (exitGuarded()) exitGuardArm(); else { exitCWOff(); if (_exitGuard && history.state && history.state.exitGuard) { _exitGuard = false; layerAppBack(1); } } }
// back-exit-fix (finding 4): a snackbar with an action ("ביטול" after a delete) is held while the message takes its place, and comes back
// with its action for the time it had left when the message ends (or when a window opened during it ends it)
var _exitSnap = null;
function exitWarnShow() { _exitWarn = true; _exitSnap = _exitSnap || (toastAction() ? toastHold() : null); showToast('לחיצה נוספת על חזור תצא מהאפליקציה', { ms: EXIT_WARN_MS }); clearTimeout(_exitWarnT); _exitWarnT = setTimeout(() => { _exitWarn = false; exitSnapBack(); exitGuardSync(); }, EXIT_WARN_MS); }
function exitSnapBack() { const s = _exitSnap; _exitSnap = null; if (s) toastResume(s); }
function exitWarnEnd() { if (!_exitWarn) return; _exitWarn = false; clearTimeout(_exitWarnT); exitSnapBack(); } // a window opened during the message: the guard goes under it
function layerPushActFlush() { if (!_pushNoAct || !layerActive()) return; const n = _pushNoAct; _pushNoAct = 0; for (let i = 0; i < n; i++) layerPushRaw(WIN_STACK.length - n + i + 1); }
function layerPushNow() { if (!layerActive()) { _pushNoAct = (_pushNoAct || 0) + 1; return; } layerPushRaw(WIN_STACK.length - _pushLater); }
function layerPushFlush() { clearTimeout(_pushLaterT); while (_pushLater > 0) { _pushLater--; layerPushNow(); } }
function layerPushHistory() { explainSync(); exitCWOff(); /* P1: a layer opened - back is the history's again (also before a share start's entry is made) */ if (_ignorePops > 0) { _pushLater++; clearTimeout(_pushLaterT); _pushLaterT = setTimeout(() => { _ignorePops = 0; layerPushFlush(); }, 600); return; } layerPushNow(); }
function layerAppBack(n) { explainSync(); if (n < 1) return; const d = Math.min(n, _pushNoAct || 0); if (d) { _pushNoAct -= d; n -= d; if (n < 1) return; } /* G68: entries never pushed (|| 0: called at startup before this part's var is set) */ _ignorePops++; try { history.go(-n); } catch (e) { _ignorePops--; } }
// a layer that is not a window (full screen, measuring): close(fromPop) undoes it on screen; it calls layerDone(key) itself
function layerPush(key, shape, close) { WIN_STACK.push({ key, shape: shape || 'full', close }); layerPushHistory(); layerAsideSync(); }
function layerDone(key, fromPop) { const i = WIN_STACK.map(e => e.key).lastIndexOf(key); if (i < 0) return; WIN_STACK.splice(i, 1); if (!fromPop) layerAppBack(1); layerAsideSync(); }
// 📏 is a mode on the map behind the windows: while it is the top layer, the windows under it step aside (they stay in the stack)
function layerAsideSync() { const t = layerTop(); document.body.classList.toggle('layers-aside', !!(t && t.shape === 'mode')); explainSync(); } // 10.15.0: the top layer changed - the close rule
// close the top layer, whatever it is (✕ of a full screen, the phone's back, Escape)
function layerBack(fromPop) {
  const t = layerTop(); if (!t) return false;
  if (t.shape === 'sheet') { closeSheet(fromPop); return true; }
  if (t.close) t.close(!!fromPop); else { WIN_STACK.pop(); if (!fromPop) layerAppBack(1); }
  return true;
}
function winBackLayer(fromPop) { const t = layerTop(); if (!t || t.shape === 'sheet') return false; return layerBack(fromPop); } // 5.2.0 name, kept for callers
// every layer at once (an action that goes somewhere else)
function layerCloseAll() {
  let n = 0;
  while (WIN_STACK.length) { const t = WIN_STACK[WIN_STACK.length - 1];
    if (t.shape === 'sheet') { const k = sheetLayers(); n += k; sheetUnwind(); continue; }
    WIN_STACK.pop(); n++; try { t.close && t.close(true); } catch (e) {}
  }
  layerAsideSync(); layerAppBack(n);
}
// windows-inner-steps (Q3, Q7): close every layer above index i (from the top down, one step back in history for all of them);
// the layer at i becomes the top, exactly as it was left
function layerUnwindTo(i) {
  let n = 0;
  while (WIN_STACK.length - 1 > i) { const t = WIN_STACK.pop(); n++;
    if (t.shape === 'sheet') { let f; if (t.el) { f = t.onCancel; t.onCancel = null; t.el.remove(); t.el = null; } else { f = _sheetOnCancel; _sheetOnCancel = null; } if (f) try { f(); } catch (e) {} continue; }
    try { t.close && t.close(true); } catch (e) {}
  }
  if (!n) return;
  const top = layerTop(); _winSwap++;
  if (top && top.shape === 'sheet' && top.el) layerRestore(top);
  else if (!WIN_STACK.some(e => e.shape === 'sheet') && _sheetOpen) sheetHide();
  layerUnderSync(); layerAsideSync(); layerAppBack(n);
}
// the layer an action came from (its own action never stops at itself: an editor's own delete, hide or link)
function layerOfEvent() { const ev = window.event, el = ev && ev.target && ev.target.closest ? ev.target : null; if (!el) return null;
  if (el.closest('#sheet')) { for (let i = WIN_STACK.length - 1; i >= 0; i--) if (WIN_STACK[i].shape === 'sheet' && !WIN_STACK[i].el) return WIN_STACK[i]; }
  const sc = el.closest('.screen-layer'); if (sc) return WIN_STACK.find(e => e.el === sc) || null;
  return null; }
// Q7: before an action that closes every layer (from index `from` up): true = nothing unsaved, go on; false = it stopped at the
// first layer with an unsaved change from the top - the layers above it closed, the row asks there, and again() runs once that
// layer was saved (שמירה) or left (לצאת בלי לשמור); להמשיך לערוך cancels the move
function layerLeave(again, from, top) { // top: the highest layer to check (the default: the top one)
  const own = layerOfEvent();
  for (let i = top != null ? top : WIN_STACK.length - 1; i >= (from || 0); i--) { const e = WIN_STACK[i];
    if (e === own || e.shape !== 'sheet' || !layerDirty(e)) continue;
    layerUnwindTo(i); layerAsk(e, again); return false; }
  return true;
}
// 11.15.1 (windows-inner-steps-fix; review of 11.15.0, Q3): an editor's own delete or hide closes unasked only that editor and the layers
// above it - the action's own layer, and the editor under it when that layer is a short sheet over it (the hide reason); below it,
// closing goes on as every close-all does and stops at the first window with an unsaved change, with the known row
function layerCloseOwn() {
  const own = layerOfEvent() || layerTop(); let i = WIN_STACK.indexOf(own);
  if (i > 0 && own.shape === 'sheet' && !own.step && !SHEET_FULL.has(own.key) && WIN_STACK[i - 1].shape === 'sheet' && SHEET_FULL.has(WIN_STACK[i - 1].key)) i--;
  const go = first => { if (layerLeave(() => go(false), 0, first && i >= 0 ? i - 1 : undefined)) closeAllSheets(); }; go(true);
}
// run once the history steps the app asked for have landed (a back right after another one was undone by it - 9.0.0, t670)
function layerWhenSettled(fn, tries) { setTimeout(() => { if (_ignorePops > 0 && (tries || 0) < 40) layerWhenSettled(fn, (tries || 0) + 1); else fn(); }, tries ? 25 : 0); }
// the first entry of the top sheet's chain of inner steps
function sheetChainFrom() { let i = WIN_STACK.length - 1; if (i < 0 || WIN_STACK[i].shape !== 'sheet') return -1; while (i > 0 && WIN_STACK[i].step) i--; return i; }
// Q3: pull down and a tap outside close the whole sheet - every inner step - stopping at an unsaved change in any of them
function sheetAskCloseAll() { const t = layerTop(); if (!t || t.shape !== 'sheet' || t.asking) return; if (!t.step) { layerAskClose(false); return; }
  const from = sheetChainFrom(), go = () => { if (layerLeave(go, from)) layerUnwindTo(from - 1); }; go(); }
// the motion by kind (Q2, Q4-Q6): an inner step slides in from the side in the reading direction (forward) or back from the
// other side, the sheet animating its height; a full screen or a sheet over a full screen rises from the bottom; a menu screen
// comes in from the side. Only the new content moves - the layer under it never does. Motion tokens; none with reduced motion.
function layerMotion(kind, fromH, el) {
  const sheet = el || document.getElementById('sheet');
  if (!sheet || !sheet.animate || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
  const cs = getComputedStyle(document.documentElement), o = { duration: cssMs('--motion', 200), easing: cs.getPropertyValue('--ease').trim() || 'ease-out' };
  const rtl = getComputedStyle(sheet).direction === 'rtl';
  try {
    if (kind === 'fwd' || kind === 'back') {
      const d = (kind === 'fwd' ? 1 : -1) * (rtl ? -1 : 1) * 24; // forward comes in from the end side: from the left in Hebrew
      sheet.classList.add('stepping'); const kids = [...sheet.children].filter(c => !c.classList.contains('uns-q'));
      const a = kids.map(c => c.animate([{ transform: `translateX(${d}%)`, opacity: 0 }, { transform: 'none', opacity: 1 }], o));
      const toH = sheet.offsetHeight; if (fromH && !sheet.classList.contains('full') && Math.abs(toH - fromH) > 2) a.push(sheet.animate([{ height: fromH + 'px' }, { height: toH + 'px' }], o));
      Promise.all(a.map(x => x.finished)).catch(() => {}).then(() => sheet.classList.remove('stepping'));
    } else if (kind === 'side') return sheet.animate([{ transform: `translateX(${rtl ? -100 : 100}%)` }, { transform: 'none' }], o);
    else if (kind === 'rise') { const r = sheet.getBoundingClientRect(), docked = r.bottom >= window.innerHeight - 2; // a centered dialog (wide screens) rises a little and fades in
      const bd = sheet.parentElement; if (docked && sheet.classList.contains('full') && bd && bd.id === 'sheetBackdrop' && !bd.classList.contains('stacked')) return bd.animate([{ transform: 'translateY(100%)' }, { transform: 'none' }], o); // a full screen over the bare page: its whole surface rises
      return sheet.animate(docked ? [{ transform: 'translateY(100%)' }, { transform: 'none' }] : [{ transform: 'translateY(24px)', opacity: 0 }, { transform: 'none', opacity: 1 }], o); }
  } catch (e) {}
  return null;
}
// ---- windows (#sheet) ----
const _sheetInner = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
function layerStash(sh) { // the open window's content is about to be replaced: keep it aside until showSheetBackdrop decides
  if (!_sheetOpen || _stash || _restoring || !sh.firstChild) return;
  const frag = document.createDocumentFragment(), scroll = sh.scrollTop, h = sh.offsetHeight; while (sh.firstChild) frag.appendChild(sh.firstChild);
  _stash = { frag, scroll, h }; setTimeout(() => { _stash = null; }, 0); // nobody claimed it: the window was only drawn again
}
Object.defineProperty(document.getElementById('sheet'), 'innerHTML', { configurable: true,
  get() { return _sheetInner.get.call(this); }, set(v) { layerStash(this); _sheetInner.set.call(this, v); const el = this; queueMicrotask(() => { if (el.isConnected && _sheetOpen) sheetFrame(el, layerTop()); }); } }); // 10.4.0: a redraw gets the same frame
// a builder notes how to draw it again (layerNote(openX, arguments) at its start)
function layerNote(fn, args) { _lastBuild = { fn, args: Array.prototype.slice.call(args || []) }; }
// windows drawn as a full screen (editors and long work) - imvwfw0d4 decision 4; the rest are bottom sheets
var SHEET_FULL = new Set([ // 5.6.0 (stage 3, decision 4): every editor (✏️ always full screen, even a short one), long lists with search, flows
  'openPlaceEditor', 'openTripEditor', 'openDestEditor', 'openLayerEditor', 'openTripItemEditor', 'openNoteEditSheet', 'openNewNoteSheet', 'openSchedSheet',
  'openAddPlaceSheet', 'openLayersSheet', 'openOffMaps', 'openTravelEditor']); // 11.0.0: the travel editor (travels.js) // 10.10.0 (design-maps): the discovery list left - a bottom sheet over the map (SHEET_PEEK) // 10.9.0 (design-forms): the long pickers, recommendations, Claude's round and replies left - bottom sheets (design-gaps Q7, Q8, Q17)
// 10.9.0 (design-forms, gap 39): a long list with search - a bottom sheet that opens at near full height; the title, its line and the search stay, only the list scrolls
var SHEET_TALL = new Set(['openFmChoiceFull', 'openEndChoice']); // 11.0.0: the end of a travel - near full, the search pinned
// 10.10.0 (design-maps, gap 10, design-gaps Q6): a bottom sheet over a map - it opens at about half height with the map visible above,
// grows to near full height by pulling up (or a tap on its handle), and pulling down, back or a tap on the map returns to the map
var SHEET_PEEK = new Set(['openDiscList']);
// 5.14.0 (ס2): a window that sits under what it filters - up to half the screen, the screen above stays visible and live;
// a tap on it closes the window and goes on to what was tapped (a pin opens its card, a card its window)
var SHEET_HALF = new Set(['openFilterSheet']);
function sheetShape(e) {
  const full = !!(e && SHEET_FULL.has(e.key)), half = !!(e && SHEET_HALF.has(e.key)), sheet = document.getElementById('sheet'), bd = document.getElementById('sheetBackdrop');
  sheet.classList.toggle('full', full); bd.classList.toggle('full', full); sheet.classList.toggle('half', half); bd.classList.toggle('half', half); sheet.classList.toggle('tall', !!(e && SHEET_TALL.has(e.key))); sheet.dataset.layer = e ? e.key : '';
  const peek = !!(e && SHEET_PEEK.has(e.key)); sheet.classList.toggle('peek', peek); bd.classList.toggle('peek', peek); sheet.classList.remove('grown');
  document.body.classList.toggle('fsheet-open', half);
}
touchAny('down', e => { const t = layerTop(); if (!_sheetOpen || !t || !SHEET_HALF.has(t.key)) return;
  if (e.target.closest('#sheet, .sheet-backdrop.layer-under, [data-fx="open"]')) return; closeSheet(); });
// the covered window moves into its own element, under the top one
function layerCover(e) {
  if (e.el) return; // it was already aside (a return that did not happen yet)
  const sheet = document.getElementById('sheet');
  const frag = _stash ? _stash.frag : (() => { const f = document.createDocumentFragment(); while (sheet.firstChild) f.appendChild(sheet.firstChild); return f; })();
  e.scroll = _stash ? _stash.scroll : sheet.scrollTop; _stash = null; e.grown = sheet.classList.contains('grown'); // a list over the map comes back as tall as it was left
  e.gen = _dataGen; e.onCancel = _sheetOnCancel; _sheetOnCancel = null; // 11.15.1 (windows-inner-steps-fix, Q2): 11.15.0 had this line inside the comment above - every covered window was drawn again on return (a clean form replaced, a picker's choice lost) and its cancel ran for the window over it
  const bd = document.createElement('div'); bd.className = 'sheet-backdrop layer-under' + (SHEET_FULL.has(e.key) ? ' full' : '');
  const sh = document.createElement('div'); sh.className = 'sheet layer-under-sheet' + (SHEET_FULL.has(e.key) ? ' full' : ''); sh.appendChild(frag); bd.appendChild(sh);
  document.getElementById('sheetBackdrop').before(bd); sh.scrollTop = e.scroll; e.el = bd; layerUnderSync();
}
function layerUnderSync() { const n = document.querySelectorAll('.sheet-backdrop.layer-under:not(.step-under)').length; document.getElementById('sheetBackdrop').classList.toggle('stacked', n > 0); }
// back to a covered window: its nodes return to #sheet as they were (or it is drawn again when the data changed)
function layerRestore(e, back) {
  if (layerTop() !== e || !e.el) return;
  const sheet = document.getElementById('sheet'), sh = e.el.firstChild, fromH = back ? sheet.offsetHeight : 0;
  _restoring = true; const kids = []; while (sh.firstChild) kids.push(sh.removeChild(sh.firstChild)); sheet.replaceChildren(...kids); _restoring = false;
  e.el.remove(); e.el = null; layerUnderSync();
  _sheetKind = e.key; _sheetOnCancel = e.onCancel || null; e.onCancel = null; sheetShape(e); if (e.grown) sheet.classList.add('grown'); sheet.scrollTop = e.scroll || 0;
  // drawn again only when something was saved while it was covered (otherwise exactly as it was left)
  const changed = e.gen !== _dataGen, ret = e.onReturn; e.onReturn = null;
  if (changed && ret) ret();
  else if ((changed || e.live) && e.draw && !layerDirty(e)) { e.draw(); sheet.scrollTop = e.scroll || 0; layerSnap(e); } // 5.14.0: a live window (the filter) always shows the state as it is now
  if (back) layerMotion('back', fromH);
  explainSync();
}
function showSheetBackdrop(kind, opt) {
  opt = opt && typeof opt === 'object' ? opt : {};
  const sheet = document.getElementById('sheet'), bd = document.getElementById('sheetBackdrop'), top = layerTop(), topSheet = !!(top && top.shape === 'sheet');
  const isNew = !_sheetOpen || !topSheet || !!opt.forceNew || kind !== top.key;
  // an inner step: a bottom sheet from a bottom sheet (neither of them a full-screen dialog)
  const step = isNew && _sheetOpen && topSheet && !SHEET_FULL.has(top.key) && !SHEET_FULL.has(kind);
  const fromH = step ? (_stash && _stash.h) || sheet.offsetHeight : 0, over = isNew && WIN_STACK.length > 0;
  _winSwap++;
  if (isNew) {
    if (_sheetOpen && topSheet) { layerCover(top); if (step && top.el) top.el.classList.add('step-under'); layerUnderSync(); if (_sheetReturn) { top.onReturn = _sheetReturn; _sheetReturn = null; } }
    else { _stash = null; _sheetOnCancel = null; }
    const b = _lastBuild && _lastBuild.fn.name === kind ? _lastBuild : null;
    const e = { key: kind, shape: 'sheet', draw: opt.draw || (b ? () => b.fn.apply(null, b.args) : null), live: !!opt.live, step, gen: _dataGen }; // gen: snapped at the open too (11.15.1, Q2), so a return compares with a real save
    WIN_STACK.push(e); layerPushHistory(); _sheetOpen = true; sheetShape(e);
    if (bd.hidden) { bd.hidden = false; lockPage(); }
    sheet.scrollTop = 0; layerAsideSync();
  } else { // the same window drawn again
    if (top.el) { top.el.remove(); top.el = null; layerUnderSync(); }
    _stash = null;
  }
  _lastBuild = null; _sheetKind = kind;
  const bar = sheet.querySelector('.sheet-save-bar');
  if (bar) { const err = bar.previousElementSibling; if (err && err.classList.contains('sh-error')) bar.insertBefore(err, bar.firstChild); }
  sheetFrame(sheet, layerTop());
  if (step && !hintSeen('hint.winBack')) { const ctx = explainCtx(); setTimeout(() => hintOnce('hint.winBack', () => document.querySelector('#sheet .sheet-back'), ctx), 600); } // the first inner step says how to go back
  if (step) layerMotion('fwd', fromH); else if (isNew && (SHEET_FULL.has(kind) || over)) layerMotion('rise'); // Q4-Q6: an editor rises; so does a bottom sheet over a full screen
  const t = layerTop(); if (isNew || t.snapGen !== _dataGen) setTimeout(() => { if (layerTop() === t) layerSnap(t); }, 0); // a redraw keeps the form's starting point unless data was saved
}
function openSheet(kind) { showSheetBackdrop(kind); }
// a card window (5.1.0): always a new window on top, drawn by draw()
function winOpen(key, label, draw) { draw(); showSheetBackdrop(key, { forceNew: true, draw }); } // label: kept for the callers' readability
function winRedraw() { const t = layerTop(); if (!t || !t.draw) return; const sheet = document.getElementById('sheet'), y = sheet.scrollTop; t.draw(); sheet.scrollTop = y; }
function winDone() { closeSheet(); }
// close the top window; fromPop = the browser already went back
function closeSheet(fromPop) {
  if (!_sheetOpen) return;
  const t = layerTop(); if (!t || t.shape !== 'sheet') { sheetHide(); return; }
  WIN_STACK.pop(); if (!fromPop) layerAppBack(1);
  if (_sheetOnCancel) { const f = _sheetOnCancel; _sheetOnCancel = null; try { f(); } catch (e) {} }
  const under = layerTop();
  if (under && under.shape === 'sheet') {
    // the closing window may still read its own fields after closeSheet() (save): it stays until that code ends
    const g = _winSwap; setTimeout(() => { if (g === _winSwap) layerRestore(under, t.step); }, 0);
    layerAsideSync(); return;
  }
  sheetHide(); layerAsideSync();
}
function sheetHide() {
  _sheetOpen = false; _stash = null; document.body.classList.remove('fsheet-open');
  if (_sheetOnCancel) { const f = _sheetOnCancel; _sheetOnCancel = null; try { f(); } catch (e) {} }
  document.querySelectorAll('.sheet-backdrop.layer-under').forEach(x => x.remove()); layerUnderSync();
  const bd = document.getElementById('sheetBackdrop'); if (!bd.hidden) { bd.hidden = true; unlockPage(); }
  mapSweep(document.getElementById('sheet')); mapSweep(); // 10.11.0: a closed window's maps go with it (its content stays in #sheet until the next window)
  if (_sheetReturn) { const f = _sheetReturn; _sheetReturn = null; setTimeout(f, 60); }
}
// every window on top (not the full screens under them)
function sheetUnwind() { const k = sheetLayers(); if (!k) { if (_sheetOpen) sheetHide(); return; } WIN_STACK.splice(WIN_STACK.length - k); sheetHide(); }
function closeAllSheets() { if (!WIN_STACK || !WIN_STACK.length) { if (_sheetOpen) sheetHide(); return; } layerCloseAll(); }
// ---- 5.6.0: menu screens open as a full screen over the current place (not as a tab that replaces it) ----
// The screen gets its own <main id="main"> in a layer over the app (the screen under it keeps its nodes and scroll, renamed
// aside); render() draws into it as before. ✕ / back return to the place it was opened from, exactly as it was (drawn again only
// when something was saved meanwhile). The trips screen and the four content screens stay base screens.
const SCREEN_X = new Set(['draft', 'closing', 'proposal']);
var SCREEN_TABS = new Set(['settings', 'guide', 'whatsnew', 'log', 'trash', 'hidden', 'claude', 'sync', 'memory', 'memories', 'passport', 'countries', 'draft', 'closing', 'layers', 'proposal']);
const SCREEN_TITLE = { settings: '⚙️ הגדרות', guide: '📖 מדריך', whatsnew: '🆕 מה חדש', log: '📜 יומן שינויים', trash: SY.del + ' סל', hidden: SY.hide + ' מוסתרים', claude: SY.claude + ' ההוראות ל-' + AI, sync: '💾 גיבוי ושחזור', memory: '🖼️ זיכרון', memories: '🖼️ כל הזיכרונות', countries: 'מדינות שביקרנו', passport: 'הדרכון שלי', draft: '📥 טיוטה', proposal: SY.claude + ' הצעת לו״ז מה-' + AI, closing: '🗄️ סגירת טיול', layers: '🎨 שכבות' };
var _screenN = 0;
function screenTop() { for (let i = WIN_STACK.length - 1; i >= 0; i--) if (WIN_STACK[i].tab) return WIN_STACK[i]; return null; }
function openScreen(tab, over) { // over: 10 (ה14) - open over the window that asked for it, ✕ returns to it
  const top = layerTop();
  if (top && top.tab === tab) { render(); return; }
  if (!over && top && top.shape === 'sheet' && SHEET_FULL.has(top.key)) over = true; // Q6: a screen opened from an editor opens over it - the editor waits below with its changes
  if (top && top.shape === 'sheet' && !over) { if (!layerLeave(() => openScreen(tab, over), WIN_STACK.length - sheetLayers())) return; sheetUnwind(); } // a window that led here (an action list) closes; the screen opens over the place (Q7: not over an unsaved change)
  const t2 = layerTop(); if (t2 && t2.tab === 'closing' && tab === 'memory') { WIN_STACK.pop(); screenRemove(t2); } // the closing flow ends in the memory screen
  const base = document.getElementById('main'), n = ++_screenN;
  const el = document.createElement('div'); el.className = 'screen-layer'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
  const x = SCREEN_X.has(tab); // 10.3.0 (design-3): navigation at the start - a back arrow on menu screens, ✕ on the draft and closing (look.md)
  el.innerHTML = screenHeadHTML({ tab, x }) + '<main class="screen-main"></main>';
  base.id = 'main-under-' + n; el.querySelector('main').id = 'main';
  document.body.appendChild(el);
  const e = { key: 'screen:' + tab, shape: 'full', tab, prevTab: activeTab, base, el, gen: base.dataset.stale ? -1 : _dataGen, y: window.scrollY, over: !!(over && top && top.shape === 'sheet') };
  e.close = fp => { const i = WIN_STACK.indexOf(e); if (i >= 0) WIN_STACK.splice(i, 1); if (!fp) layerAppBack(1); screenRemove(e); };
  { const up = document.createElement('button'); up.type = 'button'; up.className = 'scroll-top-btn'; up.title = 'למעלה'; up.innerHTML = msi('keyboard_arrow_up'); up.dataset.act = 'screen.top'; el.appendChild(up); // 5.8.0: ↑ in a screen follows the screen's own scroll
    sysOn(el, 'scroll', () => { up.classList.toggle('show', el.scrollTop > 400); const hero = el.querySelector('.dr-hero'); el.classList.toggle('scrolled', !!hero && hero.getBoundingClientRect().bottom < 60);
      if (hero) { const h = el.querySelector(':scope > .screen-head'); if (h) el.style.setProperty('--sh-h', h.offsetHeight + 'px'); } }, { passive: true }); } // 10.13.0 (gap 48): the draft's filter sticks right under the head // 10.3.0: the draft's hero collapses into the head
  WIN_STACK.push(e); layerPushHistory(); document.body.classList.add('screen-on');
  activeTab = tab; render(); el.scrollTop = 0;
  const an = layerMotion(x ? 'rise' : 'side', 0, el); // Q6: a menu screen comes in from the side with its back arrow; the draft, the closing and the proposal rise with ✕
  if (e.over) { const hide = () => { el.style.zIndex = ''; if (WIN_STACK.includes(e)) document.body.classList.add('screen-over-sheet'); }; // the window waits below, as it was
    if (an) { el.style.zIndex = '3100'; an.finished.catch(() => {}).then(hide); } else hide(); } // while the screen comes in, it is above the window (which does not move)
}
// a full screen's one head: its navigation at the start (a back arrow, or ✕), the title, its tools; o.act - another close (task terms-inside: the site page's layer.back)
function screenHeadHTML(o) { const x = o.x; return `<div class="sheet-head screen-head"${o.tab ? ` data-tab="${escH(o.tab)}"` : ''}><button type="button" class="top-ic screen-x" data-act="${escH(o.act || 'screen.close')}" aria-label="${x ? 'סגירה' : 'חזרה'}" title="${x ? 'סגירה' : 'חזרה'}">${msi(x ? 'close' : 'arrow_back')}</button><b class="screen-title">${o.title ? escH(o.title) : ''}</b>${o.tab ? '<span class="screen-tools"></span>' : ''}</div>`; }
function screenRemove(e) {
  if (e.over) document.body.classList.remove('screen-over-sheet');
  const main = e.el.querySelector('main'); if (main) main.id = '';
  e.el.remove(); e.base.id = 'main'; setTimeout(explainSync, 0); // 10.15.0: the close rule, once the stack is settled
  activeTab = e.prevTab; document.body.classList.toggle('screen-on', !!screenTop());
  if (e.gen !== _dataGen) { render(); requestAnimationFrame(() => { if (!screenTop()) appScroll(e.y); }); } else { renderTabs(); mapCardSync(); updateAddFab(); }
}
function screenSync() { // after a render in a screen: the frame's title from the screen's own heading (which is not repeated)
  const e = screenTop(); if (!e || e.tab !== activeTab) return;
  const m = e.el.querySelector('main'), h = m && m.querySelector(':scope > .section-head h2, :scope > .section-head:first-child h2');
  const st = e.el.querySelector('.screen-title'); if (h && h.querySelector('.msi')) st.innerHTML = h.innerHTML.trim(); else st.textContent = (h ? h.textContent.trim() : (SCREEN_TITLE[e.tab] || '')).replace(/^[^\u0590-\u05FFA-Za-z0-9"(]+/, ''); headFit(st); // 10.3.0 (design-3): the head's title is plain words (the leading emoji goes) // 10.1.0 (design-1): an icon in the heading stays an icon
  if (h) h.classList.add('screen-h-dup');
}
// ---- unsaved changes (imvwfw0d4 decision 5): a window with a save row does not leave with changes - the save row asks ----
// changed = the person typed or picked something in the form since it opened (only real input counts: what the window fills
// in by itself - addresses, chips that appear later - does not)
function layerSaveBtn(root) { return root && root.querySelector('.sheet-save-bar [id$="Save"], .sheet-head .head-save'); } // 10.4.0: a full dialog's "שמירה" is in its top bar
act('screen.close', () => layerBack(false));
act('screen.top', c => c.el.closest('.screen-layer').scrollTo({ top: 0, behavior: 'smooth' }));
function layerSnap(e) { if (!e || e.shape !== 'sheet' || layerTop() !== e) return; e.touched = false; e.snapGen = _dataGen; }
function layerDirty(e) { if (!e) return false; const root = e.el ? e.el.firstChild : document.getElementById('sheet');
  if (e.form) return fmDirty(e.form) && !!layerSaveBtn(root) && !(e.el ? e.onCancel : _sheetOnCancel); // 7.2.0 (מ8): by the values
  if (!e.touched) return false;
  return !!layerSaveBtn(root) && !(e.el ? e.onCancel : _sheetOnCancel); }
['input', 'change', 'click'].forEach(ev => layerOn(document, ev, e => {
  if (!e.isTrusted) return; const el = e.target; if (!el.closest || !el.closest('#sheet') || el.closest('.sheet-head, .sheet-save-bar, .uns-q')) return;
  if (ev === 'click' && !el.closest('[data-active], [aria-pressed], input[type=checkbox], input[type=radio]')) return;
  if (el.matches && el.matches('input[type=text]') && el.dataset.sfield) return; // a search field is not an edit (one-way (1): every search field is the form block's one kind and carries its mark)
  const t = layerTop(); if (t && t.shape === 'sheet') t.touched = true;
}, true));
// ✕, the phone's back, swiping down or a tap outside: close - unless there are unsaved changes, then ask in the save row
function layerAskClose(fromPop) {
  const t = layerTop(); if (!t) return;
  if (t.shape !== 'sheet') { layerBack(fromPop); return; }
  const sheet = document.getElementById('sheet');
  if (t.asking) { if (fromPop) { const then = t.askThen; t.asking = false; t.askThen = null; closeSheet(true); if (then) layerWhenSettled(then); } return; } // a second back while asking = leave without saving
  if (!layerDirty(t)) { closeSheet(fromPop); return; }
  if (fromPop) layerPushHistory(); // stay: the entry the back took is put back
  layerAsk(t);
}
// the row "יש שינוי שלא נשמר" in the top layer t; then: what goes on after שמירה or לצאת בלי לשמור (closing more layers, a move)
function layerAsk(t, then) {
  const sheet = document.getElementById('sheet'); t.askThen = then || null;
  if (t.asking) return;
  t.asking = true; // 10.1.0 (design-1): a dialog in the middle (it was a line in the save row); the save row stays as it is
  sheet.insertAdjacentHTML('beforeend', dlgHTML({ cls: 'uns-q', ic: 'edit_note', title: 'יש שינוי שלא נשמר', text: 'לשמור לפני שיוצאים?', acts: [
    { act: 'uns.answer', v: 'save', label: 'שמירה', kind: 'fill' }, { act: 'uns.answer', v: 'drop', label: 'לצאת בלי לשמור', kind: 'danger' }, { act: 'uns.answer', v: 'keep', label: 'להמשיך לערוך' }] }));
}
// 10.1.0 (design-1): the one dialog (Material, in the middle over a scrim): an icon, a title, a line, its buttons stacked -
// kind 'fill' (the main one), 'danger' (outlined red), or a text button. Taps are actions (data-act / data-v)
function dlgHTML(o) {
  return `<div class="dlg-scrim${o.cls ? ' ' + o.cls : ''}" role="alertdialog" aria-modal="true" aria-label="${o.title}"><div class="dlg">${o.ic ? msi(o.ic, { size: 24, cls: 'dlg-ic' }) : ''}<h3 class="dlg-t">${o.title}</h3>${o.text ? `<p class="dlg-p">${o.text}</p>` : ''}`
    + `<div class="dlg-acts">${o.acts.map(a => `<button type="button" class="dlg-b ${({ fill: 'dlg-fill', danger: 'dlg-danger' })[a.kind] || 'dlg-text'}" data-act="${a.act}"${a.v ? ` data-v="${a.v}"` : ''}>${a.label}</button>`).join('')}</div></div></div>`;
}
act('uns.answer', c => { const t = layerTop(), sheet = document.getElementById('sheet'), q = c.el.closest('.uns-q'), then = t.askThen;
  t.asking = false; t.askThen = null; q.remove();
  if (c.v === 'drop') { closeSheet(); if (then) layerWhenSettled(then); }
  else if (c.v === 'save') { const s = layerSaveBtn(sheet); if (s) s.click(); if (then) setTimeout(() => { if (!WIN_STACK.includes(t) || !layerDirty(t)) layerWhenSettled(then); }, 0); } // saved (or a failed check keeps it: the move waits)
  return 'quiet'; });
// ✕ in a window goes through the question (6.1.0: one action for every window's ✕)
act('win.close', () => { const t = layerTop(); if (!t || t.shape !== 'sheet' || t.asking) return; layerAskClose(false); });
// the back arrow of an inner step: one step back, as the phone's back (Q3)
act('win.back', () => { const t = layerTop(); if (!t || t.shape !== 'sheet' || t.asking) return; layerAskClose(false); return 'quiet'; });
// ---- the one frame (decision 7): every window gets the same head; bottom sheets a handle (swipe down closes) ----
function sheetFrame(sheet, e) {
  const head = sheet.querySelector(':scope > .sheet-head, :scope > .iw > .sheet-head'); // 10.2.0: the details window's head is the expanded card's (inside .iw)
  if (head && head.parentElement === sheet && head !== sheet.firstElementChild) sheet.prepend(head);
  const full = !!(e && SHEET_FULL.has(e.key));
  if (head && head.parentElement === sheet) winHeadFrame(sheet, head, full);
  sheet.querySelectorAll('.ta-item:not([data-framed])').forEach(menuRowFrame);
  sheet.querySelectorAll(':scope > .sheet-save-bar > button:not([data-framed]), :scope > .sheet-save-bar > .card-acts button:not([data-framed]), :scope > .sheet-head > .head-save:not([data-framed])').forEach(btnIconFrame); // card-actions: a file window's actions sit in the component
  let h = sheet.querySelector('.sheet-handle'); // a bottom sheet: a small handle at the top of its head
  if (!full && !h) { h = document.createElement('div'); h.className = 'sheet-handle'; h.setAttribute('aria-hidden', 'true'); (head || sheet).prepend(h); }
  if (full && h) h.remove();
  sheetBackFrame(sheet, head, e);
  if (h) { if (e && SHEET_PEEK.has(e.key)) { h.dataset.act = 'sheet.grow'; h.setAttribute('role', 'button'); h.setAttribute('aria-hidden', 'false'); h.setAttribute('aria-label', 'הגדלה'); } else if (h.dataset.act) { delete h.dataset.act; h.removeAttribute('role'); h.removeAttribute('aria-label'); h.setAttribute('aria-hidden', 'true'); } }
  // the end group of actions (fmEndActs) sits at the end of the content, not floating
  const del = sheet.querySelector(':scope > .fm-acts'), bar = sheet.querySelector(':scope > .sheet-save-bar');
  if (del && bar && del.nextElementSibling !== bar) { const err = bar.previousElementSibling && bar.previousElementSibling.classList.contains('sh-error') ? bar.previousElementSibling : null; (err || bar).before(del); }
  ellFitSoon();
}
// windows-inner-steps (Q2): an inner step's head starts with a back arrow (one step back); the first step has none
function sheetBackFrame(sheet, head, e) {
  const on = !!(e && e.step && e.shape === 'sheet'), b = head ? head.querySelector(':scope > .sheet-back') : null;
  if (!on) { if (b) b.remove(); return; }
  if (!head) { head = document.createElement('div'); head.className = 'sheet-head sheet-head-bare'; const hh = sheet.querySelector(':scope > .sheet-handle'); sheet.prepend(head); if (hh) head.prepend(hh); } // a window with no head of its own gets one for the arrow
  if (b) return;
  head.insertAdjacentHTML('afterbegin', `<button type="button" class="top-ic sheet-back" data-act="win.back" aria-label="חזרה" title="חזרה">${msi('arrow_back')}</button>`);
}
// 10.4.0 (design-4, look.md "Windows and forms"): the two window shapes share one head, shaped here once for every window.
// A bottom sheet: the handle, the title with the window's leading icon (its leading emoji becomes a line icon) and ⓘ, no ✕
// (pull down, back, a tap outside); its actions in a pinned footer. A full-screen dialog (SHEET_FULL): ✕ at the start, the title
// in words, and the form's "שמירה" (#fmSave) as a filled button at the end of the top bar - the form scrolls under it.
const HEAD_MS = { '✏️': 'edit', '✏': 'edit', '＋': 'add', '+': 'add', '🎨': 'palette', '🧭': 'route', '🕐': 'schedule', '📝': 'edit_note', '↩️': 'undo', '↺': 'restart_alt', '📚': 'auto_stories',
  '📤': 'ios_share', '🗄️': 'inventory_2', '🧳': 'luggage', '📲': 'install_mobile', '💬': 'chat', '✋': 'back_hand', 'ℹ️': 'info', [SY.days]: 'calendar_month', [SY.hide]: 'visibility_off',
  [SY.group]: 'groups', '📋': 'content_paste', '⧉': 'content_copy', '🏙️': 'location_city', '🏨': 'hotel', '📄': 'description', [SY.map]: 'map', '📥': 'download', '🖼️': 'image',
  '✂️': 'crop', '🔗': 'link', '💾': 'save', '📷': 'photo_camera', [SY.fav]: 'star', [SY.del]: 'delete', [SY.all]: 'public', [SY.place]: 'location_on', '♻️': 'restore', '🎁': 'redeem',
  '🏁': 'sports_score', '🔄': 'refresh', '📜': 'history', '⚙️': 'settings', '🧹': 'delete_sweep', [SY.book]: 'event_available' }; // 10.8.0 (design-icons): more leading symbols as line icons; 📦 "מחוץ לטיול" is the chair (Q16)
// final-review-fixes (family B): a head's title is one line that shortens with "…" and never loses a letter without it. The title
// box is a flex row (icon, words, ⓘ), and "…" does not work on a flex row's bare text - so every run of bare text gets its own box
// (.head-f). The variable part of a title is isolated (<bdi class="nm">, nameB) and shrinks first, in its own direction: a Latin name
// in a Hebrew title is cut at its end, not at its start. A bare "fixed words · name" is split at its first " · " by the same rule,
// so a title needs no markup of its own for it. A tap on a cut title shows it whole (txt.full).
function headFit(b) { if (!b) return; const isNm = n => n.nodeType === 1 && n.classList.contains('nm'), isTx = n => n.nodeType === 3;
  const runs = []; let run = null;
  [...b.childNodes].forEach(n => { if (isTx(n) || isNm(n)) { if (!run) runs.push(run = []); run.push(n); } else run = null; });
  runs.forEach(r => { if (!r.some(n => isTx(n) && n.data.trim())) return;
    let parts = []; r.forEach(n => { const z = parts[parts.length - 1]; if (isTx(n)) { if (z && z.t != null) z.t += n.data; else parts.push({ t: n.data }); } else parts.push({ el: n }); });
    parts.forEach(x => { if (x.t != null) x.t = x.t.replace(/\s+/g, ' '); }); parts = parts.filter(x => x.el || x.t);
    if (parts.length === 1) { const t = parts[0].t.trim(), i = t.indexOf(' · '); // "fixed · name": the name is the variable part
      if (i > 0 && /[\u0590-\u05FFA-Za-z0-9]/.test(t.slice(i + 3))) { const nm = document.createElement('bdi'); nm.className = 'nm t-ell'; nm.textContent = t.slice(i + 3); nm.dir = txtDir(nm.textContent); parts = [{ t: t.slice(0, i + 3) }, { el: nm }]; }
      else parts = [{ t }]; }
    if (parts[0].t) parts[0].t = parts[0].t.replace(/^ /, ''); const z = parts[parts.length - 1]; if (z.t) z.t = z.t.replace(/ $/, '');
    const mk = t => { const s = document.createElement('span'); s.className = 'head-f'; s.textContent = t; return s; };
    const els = parts.filter(x => x.el || x.t).map(x => x.el || mk(x.t)); let box = els[0];
    if (els.length > 1) { box = document.createElement('span'); box.className = 'head-t'; }
    r[0].before(box); r.forEach(n => { if (n !== box) n.remove(); }); if (els.length > 1) els.forEach(e => box.appendChild(e)); });
  if (!b.dataset.act && b.querySelector('.head-f, .nm')) b.dataset.act = 'txt.full'; ellFitSoon(); }
function winHeadFrame(sheet, head, full) {
  if (head.dataset.framed === (full ? 'f' : 's')) return; head.dataset.framed = full ? 'f' : 's';
  const b = head.querySelector(':scope > b'), n = b && b.firstChild;
  if (n && n.nodeType === 3) { const m = n.data.match(/^\s*([^\s\u0590-\u05FFA-Za-z0-9"(«'.]+)\s+/);
    if (m && !/[⁦⁧⁨]/.test(m[1])) { const ic = HEAD_MS[m[1]] || HEAD_MS[m[1].replace(/\uFE0F/g, '')];
      if (full) n.data = n.data.slice(m[0].length);
      else if (ic) { n.data = n.data.slice(m[0].length); b.insertAdjacentHTML('afterbegin', msi(ic, { cls: 'head-ic' })); } } }
  else if (full && b) { const f = b.firstElementChild; if (f && f === b.firstChild && /\b(msi|sym)\b/.test(f.className)) f.remove(); }
  if (b && sheet.querySelector(':scope > .sh-why') && !b.querySelector('[data-v="here"]')) b.insertAdjacentHTML('beforeend', ' ' + tipI('here'));
  headFit(b);
  const x = head.querySelector(':scope > .sheet-x[data-act="win.close"]');
  if (x && x.id) head.dataset.xid = x.id; // the window's name for tests (the ✕ of a bottom sheet goes)
  if (x && !full) x.remove();
  else if (x) { x.innerHTML = msi('close'); x.classList.add('top-ic'); x.title = 'סגירה'; head.prepend(x); }
  if (!full) return;
  const sv = sheet.querySelector(':scope > .sheet-save-bar > #fmSave');
  if (sv) { const bar = sv.parentElement; sv.classList.add('head-save'); head.appendChild(sv);
    if (!bar.querySelector('button, a, label, [role=button]')) bar.classList.add('bar-empty'); }
}
// a menu row (⋯ menus, short choices - look.md "Menus, choices and plan repairs"): an icon, the action, a supporting line
Object.assign(HEAD_MS, { '📌': 'push_pin', '📖': 'menu_book', '📦': 'chair', '↕️': 'swap_vert', '💌': 'favorite', '🖨️': 'print', '📱': 'smartphone', [SY.closed]: 'block', [SY.gone]: 'wrong_location' }); // 10.15.0 (design-review Q1): ⛔ and 🚫 no longer share block
function menuRowFrame(el) { el.dataset.framed = '1'; const n = el.firstChild;
  if (n && n.nodeType === 3) { const m = n.data.match(/^\s*([^\s\u0590-\u05FFA-Za-z0-9"(«'.]+)\s+/), ic = m && (HEAD_MS[m[1]] || HEAD_MS[m[1].replace(/\uFE0F/g, '')]);
    if (ic) { n.data = n.data.slice(m[0].length); el.insertAdjacentHTML('afterbegin', msi(ic, { cls: 'ta-ic' })); } }
  else if (n && n.nodeType === 1 && n.classList.contains('msi')) n.classList.add('ta-ic');
  if (!el.querySelector(':scope > .ta-ic')) el.insertAdjacentHTML('afterbegin', '<span class="ta-ic msi" aria-hidden="true"></span>');
  const kids = [...el.childNodes].filter(k => !(k.nodeType === 1 && k.classList.contains('ta-ic'))), w = document.createElement('span'); w.className = 'ta-t'; kids.forEach(k => w.appendChild(k)); el.appendChild(w); }
function btnIconFrame(el) { el.dataset.framed = '1'; const n = el.firstChild; if (!n || n.nodeType !== 3) return; // a window's button: its leading emoji becomes a line icon
  const m = n.data.match(/^\s*([^\s\u0590-\u05FFA-Za-z0-9"(«'.]+)\s+/), ic = m && (HEAD_MS[m[1]] || HEAD_MS[m[1].replace(/\uFE0F/g, '')] || (m[1] === '✓' ? 'check' : ''));
  if (ic) { n.data = n.data.slice(m[0].length); el.insertAdjacentHTML('afterbegin', msi(ic, { size: 18 })); } }
// pulling a bottom sheet down closes it like ✕, with the question when there are changes (TOUCH 'pull', Q7): from anywhere in it,
// only when its content - and whatever scrolls under the finger - is at the top when the touch starts (not the tail of a fling)
gestureOn('pull', '#sheet', { touchOnly: true, at: TOUCH.pullAt, done: () => sheetAskCloseAll(), // Q3: the whole sheet, every inner step
  when: (sh, t) => { const top = layerTop(); if (!top || top.shape !== 'sheet' || sh.classList.contains('full') || t.closest('input, textarea, select, .leaflet-container, .g-pic')) return false;
    for (let n = t; n && n !== sh.parentElement; n = n.parentElement) if (n.scrollTop > 0) return false; return true; } });
// a sheet over a map (SHEET_PEEK): pulling up grows it to near full height; once grown, the pull above closes it
gestureOn('pull', '#sheet.peek', { touchOnly: true, at: .2, up: .12, done: (sh, dir) => { if (dir < 0) sh.classList.add('grown'); else sheetAskCloseAll(); },
  when: (sh, t) => { if (sh.classList.contains('grown') || t.closest('input, textarea, select, .leaflet-container')) return false;
    for (let n = t; n && n !== sh.parentElement; n = n.parentElement) if (n.scrollTop > 0) return false; return true; } });
act('sheet.grow', c => { const sh = c.el.closest('#sheet'); if (sh) sh.classList.toggle('grown'); return 'quiet'; });
// round6-behaviour (G117): back closes an open popup menu first and nothing else - the ⋮ menu, a map's type or tools menu (.ly-menu), a choice
// field's menu; the entry it took is made again (the guard on the bare page, the top layer's otherwise), so the next back goes on as before
function popMenuClose() { const m = [...document.querySelectorAll('.ly-menu')].pop(); if (m) { m.remove(); return true; } if (!menuDD.hidden) { closeMenu(); return true; } return false; }
// the one back handler: the top layer, whatever it is
layerOn(window, 'popstate', () => {
  const st = history.state || {}, under = _exitGuard && !st.exitGuard && !st.layer && !st.sure; if (under) _exitGuard = false; // back-exit: back went under the guard
  if (_ignorePops > 0) { _ignorePops--; if (!_ignorePops) { layerPushFlush(); exitGuardSync(); } return; }
  if (sureClose()) { if (_sureEntry) { _sureEntry = false; exitGuardSync(); return; } /* back-exit-fix (finding 3): back took the dialog's own entry - nothing under it moved */
    if (layerTop()) layerPushHistory(); return; } // 10.13.0: back closes the confirmation dialog first; the window under it stays (a dialog with no entry - opened before a touch after a share start)
  if (popMenuClose()) { if (layerTop()) layerPushHistory(); else exitGuardSync(); return; } // round6-behaviour (G117): a menu first
  if (under && !layerTop()) { if (viewOn()) { viewBack(); exitGuardSync(); return; } exitWarnShow(); return; } // back-exit: a leave press - the message; a second one within it leaves; destination-view (Q4): in a view, back ends it
  layerAskClose(true); exitGuardSync();
});
layerOn(document, 'keydown', e => { if (e.key !== 'Escape') return; if (sureDismiss() || popMenuClose() || !layerTop()) return; layerAskClose(false); });
// place-find (G68): the first touch or key after a share start makes the windows' waiting history entries (with an activation)
// back-exit: the same first touch or key arms the exit guard - at once, so it is under the entry of a window this tap opens (and under the waiting ones)
layerOn(window, 'click', () => { _exitAct = true; exitGuardSync(); if (_pushNoAct) setTimeout(layerPushActFlush, 0); }, true); // a tap (TOUCH owns pointer events - t920)
layerOn(window, 'keydown', e => { if (e.key === 'Escape') _exitEsc = Date.now(); _exitAct = true; exitGuardSync(); if (_pushNoAct) setTimeout(layerPushActFlush, 0); }, true);
// 4.12.1: lock the page under a dialog where it is (overflow:hidden on html made phones jump to the top and back)
let _lockY = 0, _unlockAt = 0;
function lockPage() { const h = document.documentElement; if (h.classList.contains('sheet-open')) return; _lockY = window.scrollY; h.classList.add('sheet-open'); } // 4.20.1: the page is left as it is
function unlockPage() { const h = document.documentElement; if (!h.classList.contains('sheet-open')) return; h.classList.remove('sheet-open'); if (Math.abs(window.scrollY - _lockY) > 2) appScroll(_lockY); _unlockAt = Date.now(); }
layerOn(document.getElementById('sheetBackdrop'), 'click', e => { if (e.target.id === 'sheetBackdrop') sheetAskCloseAll(); }); // Q3: a tap outside closes the whole sheet

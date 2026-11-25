// ================= 6.1.0: ACTION WIRING - the one mechanism for every user action (cl-actions-impl-plan, decisions פ1-פ6) =================
// Mechanism map: `darkon/spec/action-wiring.md`. An element carries only the action's name (data-act); the record
// it works on is marked once on its wrapper (data-ref="kind:id" - card, row, window, day, trip) and taken from the nearest one;
// a value only when it is the action's own parameter (data-v). One tap runs exactly the action nearest the finger - no manual
// stopPropagation. After an action that changed data (_dataGen rose) the mechanism draws once: the screen and the top window, same
// scroll, rapid actions in one frame. Actions never draw themselves; late completions (Claude, a file, a service) call redrawSoon().
// A function may return 'quiet' (it updated its own small spot) or 'redraw' (only the view changed - device choices).
// Outside it, as named exceptions (guard test t790): typing and value changes in form fields, typing in search, gestures, the
// map itself, system events, and - until cl-forms-impl-plan - the four big editors (openPlaceEditor, openTripEditor,
// openLayerEditor, openDestEditor).
const ACTIONS = {}; // name -> fn(ctx); filled area by area below, next to the code of each area (act(...))
function act(name, fn) { if (ACTIONS[name]) throw new Error('action registered twice: ' + name); ACTIONS[name] = fn; }
const REF_KINDS = { // kind -> the record (obj) for an id
  tok: id => id, note: id => id,
  parked: id => id, pkitem: id => id, // 7.2.0 (פ3): a place of a day outside the trip - "parkedDay|item"
  item: id => itemOf(pid(id)), place: id => POINTS.find(p => String(p.id) === String(id)) || null,
  trip: id => STATE.trips[id] || null, dest: id => DESTS[id] || null, day: id => dayByKey(id) || null,
  layer: id => id, win: id => id, sched: id => id, travel: id => id, lodging: id => id,
  plan: id => planRefObj(id), // an entry in a day of the plan: "day|token" (a token of the organized schedule starts with s:)
};
function planRefObj(id) {
  const i = id.indexOf('|'), day = id.slice(0, i), tok = id.slice(i + 1);
  if (tok.startsWith('s:')) { const s0 = rawSched(tok.slice(2)), s = s0 && schedEff(s0); if (!s) return null;
    if (isTravelKind(s.kind)) return { day, tok, sched: s, place: null, grpTravel: true }; // 11.0.0: a program line of a travel's kind is a travel (its card, its window)
    const pl = s.placeId != null && s.placeId !== '' ? POINTS.find(x => x.id === s.placeId) || null : null; return { day, tok, sched: s, place: pl }; }
  const p = planItem(pid(tok)); if (!p) return null; const baseId = p.dup ? copyRef(p.id) : p.id;
  return { day, tok, id: pid(tok), p, travel: isTravelItem(p), place: !isNote(p) ? POINTS.find(x => x.id === baseId) || null : null, visitId: baseId };
}
function winRef(r) { const t = layerTop(); if (t) t.ref = r; } // a window marks its record once, on its layer
function refOf(el) {
  const w = el && el.closest('[data-ref]'), t = !w && el && el.closest('#sheet, .screen-layer') ? layerTop() : null;
  if (!w && !(t && t.ref)) return null;
  const r = w ? w.dataset.ref : t.ref, i = r.indexOf(':'), kind = i < 0 ? r : r.slice(0, i), id = i < 0 ? '' : r.slice(i + 1);
  let obj = null; try { obj = REF_KINDS[kind] ? REF_KINDS[kind](id) : null; } catch (e) {}
  return { kind, id, obj, el: w || null };
}
var _redrawQ = 0, _inAct = 0; // var: saving can happen before this line runs (startup)
// 6.1.0: every change of my data counts (_dataGen) and is drawn once: inside an action the mechanism decides after it ends;
// anywhere else (a gesture, a late completion, an undo from a timer) the draw is scheduled here - so no code draws after saving
function dataChanged() { _dataGen = (_dataGen || 0) + 1; if (!_inAct && typeof redrawSoon === 'function' && document.getElementById('main')) redrawSoon(DATA_TYPING.n > 0); } // ride-no-home (G133): a letter's typing reaction redraws the screen only
const DATA_TYPING = {n: 0}; // ride-no-home (G133): >0 while a text field's typing reaction runs (fmFieldChanged), never its window (fmFieldChanged)
var _redrawWin = false;
function redrawSoon(screenOnly) { // the one draw after data changed: the screen (render) and the top window (its draw), same scroll
  if (!screenOnly) _redrawWin = true;
  if (_redrawQ) return; _redrawQ = requestAnimationFrame(() => { _redrawQ = 0; const w = _redrawWin; _redrawWin = false;
    const y = window.scrollY; rerenderKeepingMap(); if (!screenTop()) appScroll(y); // a redrawn map keeps its center and zoom
    const t = layerTop(); if (w && t && t.shape === 'sheet' && !layerDirty(t)) winRedraw(); });
}
const ACT_ERRORS = []; // what went wrong in an action (the guard crawl reads it)
// 10.7.0 (task feedback; decisions/2026-11-07-feedback.md Q4, Q7, Q8): the app's error handlers feed one small ring - the last 10
// technical errors (message and where in the code, never the user's content), attached to a report. An unexpected error the app
// catches (a failed action, an uncaught error) offers "משהו השתבש · לדווח" - once per error per opening, only where a report can go
// out (not in the in-Claude copy); elsewhere the plain line. var: an error may come before this line runs.
var ERR_RING = [], ERR_OFFERED = new Set(), ERR_N = 0;
// arch-guard (2): every error kept names the src/ part it came from (part), with its line and column in the page (line, col): the
// window's error gives them; otherwise the first frame of the error's stack in this page (a note with no error - a text - the caller's
// frame). The part comes from PART_AT, the table of where each part starts in the page, written in front of the main script: by
// tests/build.py from esbuild's source map in the built page, by tests/join.py from the join's line map in the tests' source copy.
// Without the table (a page that has none) the part is '' and the line and column still go.
function errPos(err, line, col, caller) {
  if (!line) { const st = String((err && err.stack) || (caller ? new Error().stack : '') || ''), here = String(location.href).split(/[?#]/)[0];
    for (const f of st.split('\n').slice(caller && !(err && err.stack) ? 3 : 0)) { const m = f.match(/([^\s()]+):(\d+):(\d+)\)?\s*$/); if (m && m[1].split(/[?#]/)[0] === here) { line = +m[2]; col = +m[3]; break; } } }
  let part = ''; const T = self.PART_AT;
  if (line && T && T.at) { let lo = 0, hi = T.at.length - 1, k = -1; // the last start at or before (line, col)
    while (lo <= hi) { const mid = (lo + hi) >> 1, a = T.at[mid]; if (a[0] < line || (a[0] === line && a[1] <= (col || 0))) { k = mid; lo = mid + 1; } else hi = mid - 1; }
    if (k >= 0) part = T.parts[T.at[k][2]] || ''; }
  return { line: line || 0, col: col || 0, part }; }
function errNote(where, err, line, col) { const msg = String((err && (err.message || (typeof err === 'string' ? err : err.name))) || err || '?').replace(/\s+/g, ' ').slice(0, 160);
  let p = { line: 0, col: 0, part: '' }; try { p = errPos(err, line, col, typeof err === 'string'); } catch (x) {}
  const e = { id: ++ERR_N, at: Date.now(), where: String(where || '').slice(0, 60), msg, ...p }; ERR_RING.push(e); if (ERR_RING.length > 10) ERR_RING.shift(); return e; }
function errOffer(e) { const k = e.where + '|' + e.msg;
  if (!reportCan() || ERR_OFFERED.has(k)) { showToast(TX.actFailed); return; }
  ERR_OFFERED.add(k); showToast('משהו השתבש', { act: 'report.err', v: String(e.id), label: 'לדווח', ic: 'error', ms: 7000 }); }
sysOn(window, 'error', e => { if (!e || !e.message || /^Script error\.?$/.test(e.message)) return; errOffer(errNote(e.lineno ? 'שורה ' + e.lineno + (e.colno ? ':' + e.colno : '') : 'דף', e.error || e.message, e.lineno, e.colno)); }); // a system event: an uncaught error
// 10.11.0 (task memory-leak, decisions 2026-11-08 Q4): a quiet self-check. On a screen change (2 s after it settles) the app counts
// the long-lived things (LIFE, at the top of this script) against what it expects: no map of the map library left outside the page,
// and no more intervals, observers or global listeners than at the first check - plus what each live map brings (the map library's
// resize listener, the map component's ResizeObserver; 11.8.0: an edge-arrow map's two watchers of its controls) and a margin of 2 for things installed once on first use. An excess is written
// once per kind to the recent errors (ERR_RING), so it reaches the owner only on a report the user chooses to send. Nothing is shown to the
// user and nothing is disposed (self-cleaning would hide the bug, and might dispose a map in use).
function lifeCount() { const ls = {}; LIFE.maps.forEach(m => { if (!m._mapPane) LIFE.maps.delete(m); }); // removed (a map never shown fires no 'unload')
  LIFE.ls.forEach((m, k) => { let n = 0; m.forEach(s => { n += s.size; }); if (n) ls[k] = n; });
  if (SYS_FAN) SYS_FAN.forEach((fs, k) => { const b = k.replace(/:c$/, ''), n = (ls[b] || 0) - 1 + fs.size; if (n) ls[b] = n; else delete ls[b]; }); // one-way (4): the coalesced listener stands for its functions
  const maps = [...LIFE.maps], on = maps.filter(m => { const c = m.getContainer(); return c && c.isConnected; }).length;
  const gl = [...LIFE.gl]; // map-3d: the 3D maps (MapLibre) - one at most, alive only while on the page
  return { maps: maps.length, onScreen: on, gl: gl.length, glOff: gl.filter(m => { const c = m.getContainer(); return !c || !c.isConnected; }).length, intervals: LIFE.iv.size, timeouts: LIFE.to.size, observers: LIFE.ob.size, mapObs: maps.filter(m => m._ctlW).length * 2, listeners: ls }; } // mapObs (11.8.0): the observers a live map's edge-arrow watcher holds (mapCtlWatch)
function lifeExcess(base, now, slack) { const out = [], s = slack || 0, dm = now.maps - base.maps, perMap = { 'window:resize': 1 };
  if (now.maps > now.onScreen) out.push(`maps ${now.maps} alive, ${now.onScreen} on the page`);
  if (now.glOff) out.push(`3D maps ${now.glOff} alive off the page`);
  if (now.intervals > base.intervals + s) out.push(`intervals ${now.intervals}, expected ${base.intervals}`);
  const eo = base.observers + dm + (now.mapObs || 0) - (base.mapObs || 0) + (now.gl || 0) - (base.gl || 0); // a 3D map holds one ResizeObserver if (now.observers > eo + s) out.push(`observers ${now.observers}, expected ${eo}`);
  Object.keys(now.listeners).forEach(k => { const b = (base.listeners[k] || 0) + (perMap[k] || 0) * dm; if (now.listeners[k] > b + s) out.push(`${k} listeners ${now.listeners[k]}, expected ${b}`); });
  return out; }
let _lifeBase = null, _lifeTab = null, _lifeT = 0; const _lifeSaid = new Set();
function lifeCheck() { const now = lifeCount(); if (!_lifeBase) { _lifeBase = now; return []; }
  const ex = lifeExcess(_lifeBase, now, 2).filter(x => { const k = x.split(' ')[0]; if (_lifeSaid.has(k)) return false; _lifeSaid.add(k); return true; });
  ex.forEach(x => errNote('בדיקה עצמית', 'left alive: ' + x)); return ex; }
function lifeSoon() { const t = (screenTop() && screenTop().tab) || activeTab; if (t === _lifeTab) return; _lifeTab = t; clearTimeout(_lifeT); _lifeT = setTimeout(lifeCheck, 2000); }
sysOn(window, 'unhandledrejection', e => { errNote('פעולה ברקע', e && e.reason); }); // kept for a report, not offered (background work fails quietly by design)
function runAct(el, ev, name) {
  name = name || el.dataset.act; const f = ACTIONS[name];
  if (!f) { ACT_ERRORS.push('unknown action ' + name); return; }
  if (OLD_COPY && name !== 'sw.refresh') { showToast('יש גרסה חדשה - מרעננים (בפס למעלה) כדי להמשיך'); return; } // 10.1.1: the old-copy guard
  const g = _dataGen; let r;
  _inAct++; try { r = f({ el, ref: refOf(el), v: el.dataset.v, ev }); }
  catch (err) { ACT_ERRORS.push(name + ': ' + (err && err.message)); console.error(name, err); errOffer(errNote(name, err)); r = 'failed'; }
  finally { _inAct--; }
  if (r === 'failed') { if (_dataGen !== g) redrawSoon(); return; }
  if (r && typeof r.then === 'function') return; // async: its completion calls redrawSoon()
  if (r === 'quiet') return;
  if (_dataGen !== g || r === 'redraw' || r === 'screen') redrawSoon(r === 'screen'); // 'screen': the action drew its own spot in the window
}
// 10.13.0 (design-screens, gap 47): a risky action asks in the one dialog (dlgHTML) in the middle, never inside its own button:
// o = { ic, title, text, ok, fill } - "ok" (outlined red, or filled with fill: a choice that is not destructive) runs go(),
// "ביטול" closes; the phone's back and Escape close it too. One at a time; it sits over every layer.
// back-exit-fix (decisions 2026-11-20 · Review of the `back-exit` summary, finding 3): the dialog has its own history entry ({ sure: 1 },
// through layerPushRaw - pushed when it opens, by the tap that opened it), so the phone's back takes that entry and nothing under it: on a
// bare main screen the exit guard stays, over a window the window's entry stays. "ביטול", the action and Escape go back over it with the
// app's own step (layerAppBack - never a press); then the action runs (a window it opens waits for that step - layerPushHistory). The
// share-start rule holds as for a layer: before a touch nothing is pushed (and back closes the dialog by the entry under it, as before).
let SURE_GO = null, _sureEntry = false;
function askSure(o, go) { const q = document.querySelector('body > .sure-q'); if (q) q.remove(); SURE_GO = go; // a second dialog takes the first one's place and entry
  document.body.insertAdjacentHTML('beforeend', dlgHTML({ cls: 'sure-q', ic: o.ic || 'delete', title: o.title, text: o.text, acts: [{ act: 'sure.ok', label: o.ok, kind: o.fill ? 'fill' : 'danger' }, { act: 'sure.no', label: 'ביטול' }] }));
  exitCWOff(); if (!_sureEntry) surePush(); return 'quiet'; } // P1 (11.46.0): back closes the dialog, never the bare page's watcher
function surePush() { if (!document.querySelector('body > .sure-q') || _sureEntry || !layerActive()) return;
  if (_ignorePops > 0) { layerWhenSettled(surePush); return; } // a back of the app's own still landing would undo the entry
  _sureEntry = true; layerPushRaw('sure'); }
function sureClose() { const q = document.querySelector('body > .sure-q'); SURE_GO = null; if (q) q.remove(); return !!q; } // the dialog off the page (the back that closed it already took its entry)
function sureDismiss() { const had = _sureEntry; _sureEntry = false; const r = sureClose(); if (had) layerAppBack(1); else exitGuardSync(); return r; } // closed by the app: one step back over its entry
act('sure.ok', () => { const go = SURE_GO; sureDismiss(); if (go) return go(); return 'quiet'; });
act('sure.no', () => { sureDismiss(); return 'quiet'; });
// 9.0.0 (נ3): the named exceptions of the action wiring by kind, one function each - events of the system (dark mode, turning
// the phone, full screen, a key or a touch that stops a scroll return) and the layer manager's own (unsaved changes, Escape, a tap outside)
// one-way (4): the window's and the document's resize, scroll, online and offline go through here only - one browser listener per event
// (and capture), coalesced: it calls every function registered for it, in the order they came, each on its own (an error in one is
// reported as before and the rest still run); lifeCount counts each registered function as the listener it was
var SYS_FAN; // var with no value: sysOn runs before this line (data-registry.js, the error listener above)
function sysFanKey(t, ev, o) { return (t === window || t === document) && ['resize', 'scroll', 'online', 'offline'].includes(ev) && !(o && o.once) ? (t === window ? 'window' : 'document') + ':' + ev + (o === true || (o && o.capture) ? ':c' : '') : null; }
function sysOn(t, ev, f, o) { const k = sysFanKey(t, ev, o);
  if (k) { if (!SYS_FAN) SYS_FAN = new Map(); let fs = SYS_FAN.get(k);
    if (!fs) { const set = fs = new Set(); SYS_FAN.set(k, fs); t.addEventListener(ev, e => [...set].forEach(g => { if (!set.has(g)) return; try { g(e); } catch (err) { setTimeout(() => { throw err; }, 0); } }), { capture: k.endsWith(':c'), passive: true }); }
    fs.add(f); return; }
  if (t.addEventListener) t.addEventListener(ev, f, o); else if (t.addListener) t.addListener(f); }
function sysOff(t, ev, f, o) { const k = sysFanKey(t, ev, o); if (k) { const fs = SYS_FAN && SYS_FAN.get(k); if (fs) fs.delete(f); return; } if (t.removeEventListener) t.removeEventListener(ev, f, o); else if (t.removeListener) t.removeListener(f); }
function layerOn(t, ev, f, o) { t.addEventListener(ev, f, o); }
function actOff(el) { return el.disabled || el.getAttribute('aria-disabled') === 'true' || !!el.closest('fieldset[disabled]'); }
document.addEventListener('click', e => {
  if (!menuDD.hidden && !e.target.closest('#menuDD, #menuBtn')) closeMenu(); // ⋮ closes on a tap anywhere else
  const el = e.target.closest('[data-act]'); if (!el) return;
  if (el.matches('select, input:not([type=button]):not([type=submit]), textarea, details')) return; // they act on change / toggle
  const near = e.target.closest('a[href], button, input, select, textarea, label'); // the control nearest the finger wins:
  if (near && near !== el && el.contains(near)) return;                            // a link or button inside a card's body is not the body
  if (actOff(el)) return;
  if (el.tagName === 'A' && (!el.getAttribute('href') || el.getAttribute('href') === '#')) e.preventDefault();
  runAct(el, e);
});
document.addEventListener('change', e => { const el = e.target; if (el.matches && el.matches('[data-act]') && !actOff(el)) runAct(el, e); });
document.addEventListener('keydown', e => { if (e.key !== 'Enter' || e.isComposing) return; const el = e.target.closest && e.target.closest('[data-act-enter]');
  if (!el || actOff(el)) return; e.preventDefault(); runAct(el, e, el.dataset.actEnter); });
document.addEventListener('toggle', e => { const el = e.target; if (el.matches && el.matches('details[data-act]')) runAct(el, e); }, true); // toggle does not bubble

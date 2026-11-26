// 10.8.0 (design-icons, Q19 / gap 68): a text that points at a button shows the UI's own line icon inline, at the text's size and color -
// never the emoji the button once had; ratings and place types are not in this map (content). The one map for intros, ⓘ texts, hints, the tour
// and (10.14.0, guide diet) the guide's chapters. ℹ️ is the "כללי" screen (dashboard, Q9) - never the ⓘ of an explanation. Where one emoji would
// name two buttons, the text uses a symbol of its own: 🎯 the card's "מדידה" (📏 is the map's measuring tool), 🛣️ the route map (🧭 is the tour).
const TEXT_MS = { [SY.place]: 'location_on', [SY.map]: 'map', [SY.days]: 'calendar_month', 'ℹ️': 'dashboard', '📖': 'menu_book', '🧭': 'explore', '📚': 'auto_stories', '✏️': 'edit', '🔠': 'format_size',
  '⚙️': 'settings', '🎛️': 'tune', '🌦️': 'partly_cloudy_day', '↺': 'restart_alt', '↩️': 'undo', '🔙': 'door_open', '✂️': 'crop', '🎨': 'palette', [SY.fav]: 'star', [SY.hide]: 'visibility_off', '📦': 'chair',
  '🗄️': 'inventory_2', '📥': 'download', '🔄': 'refresh', '🕐': 'schedule', '💬': 'chat', '🧩': 'extension', [SY.group]: 'groups', [SY.book]: 'event_available', [SY.del]: 'delete', '♻️': 'restore', '📜': 'history', '🔗': 'link', '🏨': 'hotel',
  '📲': 'install_mobile', '📏': 'polyline', '🎯': 'track_changes', '🛣️': 'route', '📤': 'ios_share', '🖼️': 'image', '📷': 'photo_library', '🆕': 'new_releases', '📝': 'edit_note',
  '💾': 'download_for_offline', '🩺': 'monitor_heart', [SY.closed]: 'block', [SY.gone]: 'wrong_location', '🧳': 'luggage', '✈️': 'flight', [SY.me]: 'my_location', '⧉': 'content_copy' }; // 11.6.0 (the 11.4.0 review's Q2): one symbol per icon both ways, here and in HEAD_MS (guard t1047 (c)) - ↺ is restart_alt ("חזרה למקור", bringing back to its place), ↩️ is undo (the undo of an action); the second undo arrow and the unused clipboard left the map // final-review-fixes: "המיקום שלי" and "טיול חדש על בסיס" named in a text // 10.15.0: the hidden reasons (Q1)
const TEXT_MS_RX = new RegExp(Object.keys(TEXT_MS).map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).sort((a, b) => b.length - a.length).join('|') + '|' + SY.claude, 'gu');
function icHTML(h) { return String(h == null ? '' : h).replace(TEXT_MS_RX, m => m === SY.claude ? claudeMark({ cls: 'cl-mark msi-in' }) : msi(TEXT_MS[m], { cls: 'msi-in' })); } // markup kept (the guide's <b>)
function icText(s) { return icHTML(escH(s)); } // plain text in; icHTML(h) keeps markup (the caller's built HTML)
function tipText(k) { const t = TIPS[k]; return t == null ? '' : typeof t === 'string' ? t : t.t; }
function tipI(k, inBtn) { return inBtn ? `<span class="tip-i" role="button" tabindex="0" data-act="tip" data-v="${k}" aria-label="הסבר">ⓘ</span>` // inside a button (an accordion's title)
  : `<button type="button" class="tip-i" data-act="tip" data-v="${k}" aria-label="הסבר">ⓘ</button>`; } // ⓘ right after a title
function symTip(k, inner, cls) { return `<span class="sym-tip${cls ? ' ' + cls : ''}" data-act="tip" data-v="${k}">${inner}</span>`; } // a symbol that says its name
function showTip(k, el) {
  const t = TIPS[k]; if (t == null) return;
  const b = document.getElementById('chipBubble');
  if (b && b.classList.contains('show') && b._anchor === el) { hideChipBubble(); return; } // a second tap on the same ⓘ closes it
  const link = t.more ? `<button type="button" class="tip-link" data-act="tip.more" data-v="${t.more}">עוד במדריך ›</button>`
    : t.svc ? `<button type="button" class="tip-link" data-act="tip.svc" data-v="${t.svc}">${t.label || 'פרטים ›'}</button>` : '';
  const sel = `[data-act="tip"][data-v="${k}"]`, i = [...document.querySelectorAll(sel)].indexOf(el);
  showChipBubble(el, tipText(k), { link, find: i < 0 ? null : () => document.querySelectorAll(sel)[i] });
}
// 10.15.0 (design-review, the explanation bubble): ONE GATE for every explaining bubble (intros, one-time hints; ⓘ excepted - the user asked
// for it). A request captures its context (the trip, the screen, the stack of windows and menu screens); after any delay the bubble opens only
// if that context is still the one shown, no tour or other explanation is open, and its target is on screen. ONE CLOSE RULE for every
// bubble: a change of screen, of the top layer or of the trip closes it (explainSync, from every push, pop and draw).
function explainCtx() { try { return [STATE.activeTrip || '', activeTab, WIN_STACK.map(e => e.key).join('>')].join('|'); } catch (e) { return ''; } }
function explainOk(el, ctx) { if (!el || !el.isConnected || TOUR.cur || tipOpen() || explainCtx() !== ctx) return false;
  const r = el.getBoundingClientRect(); return !!r.height && r.bottom > 0 && r.top < window.innerHeight; }
// final-review-fixes (family F; decision Q5, finding 19): THE GATE ALSO HOLDS. Two things pass by themselves - the ⋮ menu and a
// snackbar with an action (an undo) - so an explanation due while one of them is up is not dropped and does not open over it: it
// waits (explainLater: a tour part, the screen's intro, each hint - one request a key) and is asked again a moment after the last of
// them went (explainFree, from the menu's and the snackbar's one close), through the same gate with the context of its first
// request. The ⋮ menu is part of the close rule too: opening it closes an open bubble. (An ⓘ and the replay from ⋮ are asked by
// the user and never wait.)
// THE READ RULE: a hint or an intro is spent once it showed - unless a change of screen, of the top layer, of the trip or the ⋮
// menu took it away before HINT.read ms (also when the tap that made the change closed it first): then it was not read - its mark
// is taken back and it is asked again, at once through the gate (so it comes back when the menu closes) and on a later draw.
// "הבנתי", its guide link, its own timer and a tap elsewhere on the same screen are the user's own closing - spent.
// THE TIMING RULE (finding 24; look/windows-forms.md): a one-time hint fades by itself after hintMs(text) - HINT.lead + HINT.per ms
// a character, at least HINT.min and at most HINT.max; a touch on it holds the timer. An ⓘ text stays until a tap, an intro until
// "הבנתי" or a tap, a long-press name its own 900 ms.
const HINT = { read: 2000, min: 4000, lead: 1500, per: 60, max: 10000, free: 300, gone: 800 };
// what a hint's text names besides its target - the bubble never covers it (finding 25)
const HINT_KEEP = { 'hint.crop': '#sheet .tp-imgprev', 'hint.cover': '.ph-grid .ph-cell', 'intro.map': '#main .map-full button', 'intro.points': '#addFab' };
function hintKeep(k) { const s = HINT_KEEP[k]; return s ? () => [...document.querySelectorAll(s)] : null; }
function hintMs(text) { return Math.max(HINT.min, Math.min(HINT.max, HINT.lead + HINT.per * String(text || '').length)); }
function explainHeld() { const m = document.getElementById('menuDD'); return !!(m && !m.hidden) || toastAction(); }
function explainLater(key, fn) { (explainLater.w || (explainLater.w = new Map())).set(key, fn); }
function explainFree(now) { const w = explainLater.w; if (!w || !w.size || (explainFree.t && !now)) return; clearTimeout(explainFree.t); // now: a hold just ended - the moment is counted from here
  explainFree.t = setTimeout(() => { explainFree.t = 0; if (explainHeld()) return; const rank = k => k === 'tour' ? 0 : k === 'intro' ? 1 : 2, L = [...w].sort((a, b) => rank(a[0]) - rank(b[0])); w.clear();
    L.forEach(([, f]) => { try { f(); } catch (e) {} }); }, HINT.free); } // a moment later: the tap that closed the menu may open a window or a screen (the context is checked then)
let _hintGone = null;
function hintGone(k, shown, ctx, again) { _hintGone = k ? { k, short: shown < HINT.read, ctx, again, at: performance.now() } : null; }
function explainSync() { const b = document.getElementById('chipBubble'), ctx = explainCtx(), m = document.getElementById('menuDD'), menu = !!(m && !m.hidden);
  if (b && b.classList.contains('show')) { if (b._ctx != null && (b._ctx !== ctx || menu)) hideChipBubble(); else bubbleFollow(b); }
  const g = _hintGone; if (g && (g.ctx !== ctx || menu)) { _hintGone = null; if (g.short && performance.now() - g.at < HINT.gone) { hintUnmark(g.k); if (g.again) explainLater('again:' + g.k, g.again); } } // the read rule
  explainFree(); }
function hintOnce(k, el, ctx) { if (hintSeen(k)) return false; if (ctx == null) ctx = explainCtx(); // a one-time hint, anchored - through the gate; el: the target, or a function that finds it (again after a wait or a redraw)
  if (explainHeld()) { explainLater('hint:' + k, () => hintOnce(k, el, ctx)); return false; }
  const find = typeof el === 'function' ? el : null, e = find ? find() : el; if (!e || !explainOk(e, ctx)) return false;
  const t = tipText(k); hintMark(k); showChipBubble(e, t, { key: k, fade: hintMs(t), find, keep: hintKeep(k), again: () => hintOnce(k, el, ctx) }); return true; }
function tipOpen() { const b = document.getElementById('chipBubble'); return !!b && b.classList.contains('tip') && b.classList.contains('show'); }
function hintSeen(k) { return !!DEV.hints[k]; }
function hintMark(k) { if (!DEV.hints[k]) devSet({ hints: { ...DEV.hints, [k]: 1 } }); }
function hintUnmark(k) { if (DEV.hints[k]) { const h = { ...DEV.hints }; delete h[k]; devSet({ hints: h }); } } // the read rule: closed before it could be read

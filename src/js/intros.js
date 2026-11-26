// ================= SCREEN INTROS AND WHEN THE TOUR IS OWED (split from tour.js in diet-groups, 11.62.0; the tour itself - its steps, card and marks - stays there, in the management group) =================
// the tour running now (its steps and place) - an object here so the tour's part writes its field, never a binding of this part
const TOUR = { cur: null };
const INTROS = [
  { id: 'points', tab: 'all', title: SY.place + ' מקומות', target: '#layerBlock', ic: 'location_on' },
  { id: 'map', tab: 'map', title: SY.map + ' מפה', target: '#main .map-full .disc-btn, #main .map-full:not(:has(.disc-btn)) .fs-btn', ic: 'map' },
  // the map's intro points at the button its text names ("מה יש כאן"; the full-screen button where there is none)
  { id: 'plan', tab: 'itinerary', title: SY.days + ' תכנון', target: '#main .day-item .day-head', ic: 'calendar_month' },
  { id: 'info', tab: 'info', title: 'כללי', target: '#main .today-card', ic: 'dashboard' }, // 10.15.0 (design-review F6): no ℹ️ beside the icon
  { id: 'draft', tab: 'draft', title: '📥 טיוטה', target: '#main .draft-list .draft-row, #main .dr-dock', ic: 'inbox' },
  { id: 'closing', tab: 'closing', title: '🗄️ סגירת טיול', target: '#main .cl-stepper', ic: 'photo_album' },
];
function introPending() { const tab = screenTop() ? screenTop().tab : activeTab, it = INTROS.find(x => x.tab === tab); return !!it && !hintSeen('intro.' + it.id) && !!document.querySelector(it.target); }
const TOUR_NAV_TABS = ['all', 'map', 'itinerary', 'info'];
function tourNavOwed() { return DEV.tourDone && DEV.tourNav === 0 && hasTrip() && !screenTop() && TOUR_NAV_TABS.includes(activeTab); }
function tourNavGo() { if (TOUR.cur || !tourNavOwed() || layerTop()) return; if (explainHeld()) { explainLater('tour', tourNavGo); return; } // Q5: after the import's snackbar - its undo stays whole
  const nav = document.getElementById('bottomNav'), r = nav && nav.getBoundingClientRect(); if (r && r.height) viaGroup('management', 'startTour', false, 'nav'); }
function introMaybe() {
  if (TOUR.cur || !DEV.tourDone) return;
  if (tourNavOwed()) { clearTimeout(introMaybe.t); introMaybe.t = setTimeout(tourNavGo, 900); return; } // part 2 first; its end brings the screen's intro
  const tab = screenTop() ? screenTop().tab : activeTab, it = INTROS.find(x => x.tab === tab);
  if (!it || hintSeen('intro.' + it.id)) return;
  const t0 = layerTop(); if (t0 && !t0.tab) return; // never requested under a window
  const ctx = explainCtx(); _introWait = null;
  clearTimeout(introMaybe.t); introMaybe.t = setTimeout(() => introShow(it, tab, ctx), 900); // after the screen settles
}
// 10.15.0 (design-review F7): an intro whose target is below the fold waits (_introWait) and shows once it scrolls into view - the
// document's one scroll listener (tipDismiss) tries again; a change of context drops the wait (the next draw asks again)
let _introWait = null;
function introShow(it, tab, ctx) { if (hintSeen('intro.' + it.id) || explainCtx() !== ctx) { _introWait = null; return; }
  if (explainHeld()) { _introWait = null; explainLater('intro', () => introShow(it, tab, ctx)); return; } // the gate holds: asked again when the menu or the snackbar went
  const seen = x => { const r = x.getBoundingClientRect(), a = explainArea(x); return r.height && Math.min(r.bottom, a.bot) - Math.max(r.top, a.top, 40) >= Math.min(r.height, 40) && r.top < window.innerHeight - 120; }; // enough of it shows inside the visible area (not under a head or a pinned bar)
  const find = () => [...document.querySelectorAll(it.target)].find(seen), el = find(); // the first one in view
  if (!el) { _introWait = document.querySelector(it.target) ? { it, tab, ctx } : null; return; }
  if (!explainOk(el, ctx)) return; _introWait = null;
  const cid = guideChapterOf(tab), ch = cid ? { id: cid } : null; // 10.13.0 (design-screens, gap 51, Q10): "הבנתי" and, where the guide has a chapter, "עוד במדריך ›"
  hintMark('intro.' + it.id); showChipBubble(el, tipText('intro.' + it.id), { key: 'intro.' + it.id, again: () => introShow(it, tab, ctx), find, keep: hintKeep('intro.' + it.id), ok: 'הבנתי', link: ch ? `<button type="button" class="tip-link" data-act="tip.more" data-v="${ch.id}">עוד במדריך ›</button>` : '' });
}
// diet-groups (decisions 2026-11-23 · A diet for the main script, Q4): the first opening of a new user owes the opening tour - startup.js
// waits for its group before the first screen (the same test as below)
function tourOwed() { return !DEV.tourDone && !tourUsed(); }
// the plan and the log are not signs: a trip copy comes with its flights in the plan and import entries in the log
function tourUsed() { return !!(STATE.settings.deviceName || STATE.favorites.size || STATE.visited.size || (STATE.settings.landing || DEV.viewModes)); }
function maybeStartTour() {
  if (DEV.tourDone) return;
  if (tourUsed()) { devSet({ tourDone: true, tourNav: true }); return; }
  const go = () => { if (DEV.tourDone || TOUR.cur) return; if (explainHeld()) explainLater('tour', go); else viaGroup('management', 'startTour'); }; setTimeout(go, 600);
}

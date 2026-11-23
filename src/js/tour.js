// ================= GUIDED TOUR (4.11.0) - progressive onboarding since 9.6.0 (12ו, batches 16-17) =================
// The opening tour: four steps on the first open of a new user (welcome with the device name, the trips button, how to start in an empty
// app or the bottom bar with a trip, ⋮). 10.14.0 (guide diet Q8): in two parts - part 1 on the first open; when it ran with no trip,
// part 2 (one step, the bottom bar) the first time a trip is open on one of its screens (DEV.tourNav: 0 = owed, true = done; a user
// from before 10.14.0 has neither and owes nothing). A first open that already has a trip gets both together, as before.
// Each main screen then gets its own intro bubble the first time it shows content (INTROS, introMaybe). ⋮ ← 🧭 plays the opening and
// intros 1-4 (moving to each screen). A user who already has a device name, marks or own settings is not new: the opening is marked
// done without showing. Texts: TIPS 'tour.*' / 'intro.*'
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
function tourNavGo() { if (_tour || !tourNavOwed() || layerTop()) return; if (explainHeld()) { explainLater('tour', tourNavGo); return; } // Q5: after the import's snackbar - its undo stays whole
  const nav = document.getElementById('bottomNav'), r = nav && nav.getBoundingClientRect(); if (r && r.height) startTour(false, 'nav'); }
function introMaybe() {
  if (_tour || !DEV.tourDone) return;
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
  const ch = GUIDE.find(g => g.screens.includes(tab)); // 10.13.0 (design-screens, gap 51, Q10): "הבנתי" and, where the guide has a chapter, "עוד במדריך ›"
  hintMark('intro.' + it.id); showChipBubble(el, tipText('intro.' + it.id), { key: 'intro.' + it.id, again: () => introShow(it, tab, ctx), find, keep: hintKeep('intro.' + it.id), ok: 'הבנתי', link: ch ? `<button type="button" class="tip-link" data-act="tip.more" data-v="${ch.id}">עוד במדריך ›</button>` : '' });
}
function tourSteps(replay, part) {
  if (part === 'nav') return [{ title: 'הסרגל התחתון', ic: 'bottom_navigation', target: '#bottomNav', body: '<p>' + icText(tipText('tour.nav')) + '</p>' }];
  const name = `<label class="sh-field">שם המכשיר (מופיע ביומן ובקבצים שנשלחים)${fmInput({ id: 'tourName', max: 30, placeholder: 'למשל: הטלפון שלי', value: STATE.settings.deviceName || '' })}</label>`;
  const p = k => '<p>' + icText(tipText(k)) + '</p>', ent = document.body.classList.contains('on-entrance');
  const steps = [
    { title: 'ברוכים הבאים', ic: 'waving_hand', body: p('tour.welcome') + p('tour.wrong') + name + `<p class="sh-hint">אפשר לשנות אחר כך ב-${msi('settings', { cls: 'msi-in' })} הגדרות</p>`, save: () => { const v = (document.getElementById('tourName') || {}).value; if (v != null) { STATE.settings = { ...STATE.settings, deviceName: v.trim() }; persist(); } } },
    ent ? { title: 'הטיולים שלי', ic: 'luggage', target: document.querySelector('#main :is(.ent-big, .ent-empty, .ent-row)') ? '#main :is(.ent-big, .ent-empty, .ent-row)' : '#main .ent-hero', body: p('tour.tripsHere') } // 10.3.0: the entrance has no trip button - the step shows the trips themselves
      : { title: 'הטיולים שלי', ic: 'luggage', target: '#titleBtn', body: p('tour.trips') },
    hasTrip() ? { title: 'הסרגל התחתון', ic: 'bottom_navigation', target: '#bottomNav', body: p('tour.nav') } : { title: 'איך מתחילים', ic: 'rocket_launch', target: '#main .ent-tiles', body: p('tour.start') },
    { title: '⋮ התפריט', ic: 'more_vert', target: '#menuBtn', body: p('tour.menu') },
  ];
  if (replay && hasTrip()) steps.push(...INTROS.slice(0, 4).map(it => ({ title: it.title, ic: it.ic, go: it.tab, target: it.target, body: p('intro.' + it.id) })));
  return steps;
}
let _tour = null;
function startTour(replay, part) {
  closeMenu(); endTour(true); hideChipBubble();
  _tour = { i: 0, steps: tourSteps(replay, part), part: replay ? (hasTrip() ? 'both' : 'replay') : part || (hasTrip() ? 'both' : 'start') };
  const el = document.createElement('div'); el.id = 'tourBox'; el.className = 'tour-box'; el.setAttribute('role', 'dialog'); document.body.appendChild(el);
  showTourStep();
}
function showTourStep() {
  const t = _tour; if (!t) return; const s = t.steps[t.i], last = t.i === t.steps.length - 1;
  tourMarkClear();
  if (s.go && activeTab !== s.go) goTab(s.go);
  if (s.target && !document.querySelector(s.target) && s.go === 'all' && FP.days) { t.keepRange = FP.days; FP.days = null; render(); } // 4.32.1: a trip day with nothing planned yet - the card step shows all places for the tour
  else if (t.keepRange && s.go !== 'all') { FP.days = t.keepRange; t.keepRange = null; render(); }
  const tg = s.target && document.querySelector(s.target);
  if (tg) { tg.classList.add('tour-hl'); const r = tg.getBoundingClientRect(); if ((r.top < 60 || r.bottom > window.innerHeight * 0.55) && getComputedStyle(tg).position !== 'fixed') reveal(tg, false, { align: 'center', instant: true }); } // 10.14.0: a fixed bar (the bottom bar, ⋮) is always in view - scrolling for it only moved the screen away
  if (tg) tourMarkEdge(tg);
  const box = document.getElementById('tourBox');
  // 10.1.0 (design-1): a card - icon and title (the title's own symbol gives way to the icon), text, its field, progress dots, the buttons
  box.innerHTML = `<div class="tour-head">${s.ic ? msi(s.ic, { size: 22, cls: 'tour-ic' }) : ''}<b>${s.ic ? s.title.replace(/^[^\p{L}\p{N}]+/u, '') : s.title}</b></div>${claudeH(s.body)}
    <div class="tour-acts"><span class="tour-dots" role="img" aria-label="${t.i + 1}/${t.steps.length}">${t.steps.map((x, k) => `<i${k === t.i ? ' class="on"' : ''}></i>`).join('')}</span><button type="button" class="tour-b" id="tourSkip" data-act="tour.skip">${last ? 'סגירה' : 'דילוג'}</button>${t.i ? '<button type="button" class="tour-b" id="tourBack" data-act="tour.back">הקודם</button>' : ''}<button type="button" class="tour-b tour-next" id="tourNext" data-act="tour.next">${last ? '✓ סיום' : 'הבא ›'}</button></div>`;
  tourPlace(box, tg);
}
// 11.37.0 (phone-round-4-fixes P6; decisions/2026-11-20-tour-mark-at-screen-edge.md Q1-Q2): a target whose measured box touches or passes a
// screen edge (within 1px) gets its mark drawn inside it (.tour-hl-in: a ring on top of its own children), so all four sides are seen -
// the bottom bar's mark was a cut arc. By the measured box, never by a list of targets; every other target keeps the outside mark
function tourMarkEdge(tg) { const r = tg.getBoundingClientRect(), vw = document.documentElement.clientWidth || window.innerWidth, vh = window.innerHeight;
  if (!(r.left <= 1 || r.top <= 1 || r.right >= vw - 1 || r.bottom >= vh - 1)) return;
  tg.classList.add('tour-hl-in'); if (getComputedStyle(tg).position === 'static') tg.classList.add('tour-hl-rel'); }
function tourMarkClear() { document.querySelectorAll('.tour-hl, .tour-hl-in, .tour-hl-rel').forEach(x => x.classList.remove('tour-hl', 'tour-hl-in', 'tour-hl-rel')); }
// final-review-fixes (finding 22): the card sits at the bottom or at the top - where it covers less of its target (with the mark around
// it); when both are free (or the same), at the top for a target in the lower half, as before
function tourPlace(box, tg) { if (!tg) { box.dataset.pos = 'bottom'; return; }
  const r = tg.getBoundingClientRect(), cover = pos => { box.dataset.pos = pos; const b = box.getBoundingClientRect();
    return Math.max(0, Math.min(b.right, r.right + 6) - Math.max(b.left, r.left - 6)) * Math.max(0, Math.min(b.bottom, r.bottom + 6) - Math.max(b.top, r.top - 6)); };
  const lo = cover('bottom'), hi = cover('top'); box.dataset.pos = hi < lo ? 'top' : lo < hi ? 'bottom' : r.top > window.innerHeight * 0.5 ? 'top' : 'bottom'; }
act('tour.skip', () => { const t = _tour, s = t && t.steps[t.i]; if (s && s.save) s.save(); endTour(); });
act('tour.next', () => { const t = _tour; if (!t) return; const s = t.steps[t.i]; if (s.save) s.save(); if (t.i === t.steps.length - 1) endTour(); else { t.i++; showTourStep(); return 'quiet'; } }); // 10.3.0: no redraw after a step - it would drop the mark on a screen element (the entrance's trips step)
act('tour.back', () => { const t = _tour; if (!t) return; t.i--; showTourStep(); return 'quiet'; });
function endTour(silent) {
  tourMarkClear();
  const b = document.getElementById('tourBox'); if (b) b.remove();
  if (_tour && _tour.keepRange) { FP.days = _tour.keepRange; _tour.keepRange = null; if (!silent) render(); } // 4.32.1: the day filter comes back
  const was = !!_tour; if (_tour && !silent) devSet(_tour.part === 'start' ? { tourDone: true, tourNav: 0 } : _tour.part === 'replay' ? { tourDone: true } : { tourDone: true, tourNav: true });
  _tour = null; if (was && !silent) introMaybe(); // 9.6.0: the screen's own intro may follow
}
function maybeStartTour() {
  if (DEV.tourDone) return;
  // the plan and the log are not signs: a trip copy comes with its flights in the plan and import entries in the log
  const used = !!(STATE.settings.deviceName || STATE.favorites.size || STATE.visited.size || (STATE.settings.landing || DEV.viewModes));
  if (used) { devSet({ tourDone: true, tourNav: true }); return; }
  const go = () => { if (DEV.tourDone || _tour) return; if (explainHeld()) explainLater('tour', go); else startTour(); }; setTimeout(go, 600);
}
function renderWhatsNewScreen() {
  document.getElementById('main').innerHTML = `<div class="section-head gd-head"><h2>מה חדש</h2></div><div class="gd-hero"><h3>מה חדש בדרכון</h3><p>${CHANGELOG.length ? ('כל גרסה נפתחת בנגיעה' + SEP) : ''}גרסה ${APP_VERSION}</p></div><div class="info-block wn-list" id="changelogWidget"></div>`; // 10.3.0 (design-3)
  renderChangelog();
}

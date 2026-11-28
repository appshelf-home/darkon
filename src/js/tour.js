// ================= GUIDED TOUR (4.11.0) - progressive onboarding since 9.6.0 (12ו, batches 16-17) =================
// The opening tour: four steps on the first open of a new user (welcome with the device name, the trips button, how to start in an empty
// app or the bottom bar with a trip, ⋮). 10.14.0 (guide diet Q8): in two parts - part 1 on the first open; when it ran with no trip,
// part 2 (one step, the bottom bar) the first time a trip is open on one of its screens (DEV.tourNav: 0 = owed, true = done; a user
// from before 10.14.0 has neither and owes nothing). A first open that already has a trip gets both together, as before.
// Each main screen then gets its own intro bubble the first time it shows content (INTROS, introMaybe). ⋮ ← 🧭 plays the opening and
// intros 1-4 (moving to each screen). A user who already has a device name, marks or own settings is not new: the opening is marked
// done without showing. Texts: TIPS 'tour.*' / 'intro.*'
function tourSteps(replay, part) {
  if (part === 'nav') return [{ title: 'הסרגל התחתון', ic: 'bottom_navigation', target: '#bottomNav', body: '<p>' + icText(tipText('tour.nav')) + '</p>' }];
  const name = `<label class="sh-field">שם המכשיר (מופיע ביומן ובקבצים שנשלחים)${fmInput({ id: 'tourName', max: 30, placeholder: 'למשל: הטלפון שלי', value: STATE.settings.deviceName || '' })}</label>`;
  const p = k => '<p>' + icText(tipText(k)) + '</p>', ent = document.body.classList.contains('on-entrance');
  const steps = [
    { title: 'ברוכים הבאים', ic: 'waving_hand', body: p('tour.welcome') + p('tour.wrong') + name + `<p class="sh-hint">אפשר לשנות אחר כך ב-${msi('settings', { cls: 'msi-in' })} הגדרות</p>`, save: () => { const v = (document.getElementById('tourName') || {}).value; if (v != null) { STATE.settings = { ...STATE.settings, deviceName: v.trim() }; persist(); } } },
    ent ? { title: 'הטיולים שלי', ic: 'luggage', target: document.querySelector('#main :is(.ent-card, .ent-empty)') ? '#main :is(.ent-card, .ent-empty)' : '#main .ent-hero', body: p('tour.tripsHere') } // 10.3.0: the entrance has no trip button - the step shows the trips themselves
      : { title: 'הטיולים שלי', ic: 'luggage', target: '#titleBtn', body: p('tour.trips') },
    hasTrip() ? { title: 'הסרגל התחתון', ic: 'bottom_navigation', target: '#bottomNav', body: p('tour.nav') } : { title: 'איך מתחילים', ic: 'rocket_launch', target: '#main .ent-tiles', body: p('tour.start') },
    { title: '⋮ התפריט', ic: 'more_vert', target: '#menuBtn', body: p('tour.menu') },
  ];
  if (replay && hasTrip()) steps.push(...INTROS.slice(0, 4).map(it => ({ title: it.title, ic: it.ic, go: it.tab, target: it.target, body: p('intro.' + it.id) })));
  return steps;
}
function startTour(replay, part) {
  closeMenu(); endTour(true); hideChipBubble();
  TOUR.cur = { i: 0, steps: tourSteps(replay, part), part: replay ? (hasTrip() ? 'both' : 'replay') : part || (hasTrip() ? 'both' : 'start') };
  const el = document.createElement('div'); el.id = 'tourBox'; el.className = 'tour-box'; el.setAttribute('role', 'dialog'); document.body.appendChild(el);
  showTourStep();
}
function showTourStep() {
  const t = TOUR.cur; if (!t) return; const s = t.steps[t.i], last = t.i === t.steps.length - 1;
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
act('tour.skip', () => { const t = TOUR.cur, s = t && t.steps[t.i]; if (s && s.save) s.save(); endTour(); });
act('tour.next', () => { const t = TOUR.cur; if (!t) return; const s = t.steps[t.i]; if (s.save) s.save(); if (t.i === t.steps.length - 1) endTour(); else { t.i++; showTourStep(); return 'quiet'; } }); // 10.3.0: no redraw after a step - it would drop the mark on a screen element (the entrance's trips step)
act('tour.back', () => { const t = TOUR.cur; if (!t) return; t.i--; showTourStep(); return 'quiet'; });
function endTour(silent) {
  tourMarkClear();
  const b = document.getElementById('tourBox'); if (b) b.remove();
  if (TOUR.cur && TOUR.cur.keepRange) { FP.days = TOUR.cur.keepRange; TOUR.cur.keepRange = null; if (!silent) render(); } // 4.32.1: the day filter comes back
  const was = !!TOUR.cur; if (TOUR.cur && !silent) devSet(TOUR.cur.part === 'start' ? { tourDone: true, tourNav: 0 } : TOUR.cur.part === 'replay' ? { tourDone: true } : { tourDone: true, tourNav: true });
  TOUR.cur = null; if (was && !silent) introMaybe(); // 9.6.0: the screen's own intro may follow
}
function renderWhatsNewScreen() {
  document.getElementById('main').innerHTML = `<div class="section-head gd-head"><h2>מה חדש</h2></div><div class="gd-hero"><h3>מה חדש בדרכון</h3><p>${CHANGELOG.length ? ('כל גרסה נפתחת בנגיעה' + SEP) : ''}גרסה ${APP_VERSION}</p></div><div class="info-block wn-list" id="changelogWidget"></div>`; // 10.3.0 (design-3)
  renderChangelog();
}
function renderChangelog() {
  const el = document.getElementById('changelogWidget');
  if (!el) return;
  const vnum = v => v.split('.').reduce((a, x) => a * 1000 + Number(x), 0); // 4.26.0: by version number, not by place in the list
  const sorted = [...CHANGELOG].sort((a, b) => vnum(b.version) - vnum(a.version)); // newest first
  if (!sorted.length) { el.innerHTML = emptyHTML(msi('new_releases'), 'כאן יופיע מה שתרגישו בכל עדכון.', 'empty-note', 'עוד אין כאן עדכונים'); return; } // 10.14.0 (guide diet Q5)
  el.innerHTML = sorted.map((v, i) => `
    <div class="sub-accordion-item${i === 0 ? ' wn-new' : ''}" data-open="${i===0}">
      <button class="sub-accordion-header t-wrap" data-act="acc.toggle"><span class="wn-v">${i === 0 ? msi('new_releases', { size: 18, fill: true }) : ''}<b>גרסה ${v.version}</b>${i === 0 ? '<span class="wn-badge">חדש</span>' : ''}</span><small>${v.date}</small> <span class="accordion-arrow">${msi('expand_more')}</span></button>
      <div class="sub-accordion-body"><ul style="margin:0;padding-inline-start:18px;">${v.items.map(it => `<li style="margin-bottom:4px;font-size:var(--fs-body);">${it}</li>`).join('')}</ul></div>
    </div>`).join('');
;
}

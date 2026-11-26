function revealSideways(el) {
  let row = el.parentElement;
  while (row && row !== document.body && !(row.scrollWidth > row.clientWidth + 1 && /auto|scroll/.test(getComputedStyle(row).overflowX))) row = row.parentElement;
  if (!row || row === document.body) return;
  const r = row.getBoundingClientRect(), e = el.getBoundingClientRect();
  if (e.left < r.left) row.scrollLeft -= (r.left - e.left) + 8;
  else if (e.right > r.right) row.scrollLeft += (e.right - r.right) + 8;
}
function updateAddFab() { // 4.13.0
  const b = document.getElementById('addFab'); if (!b) return;
  b.hidden = !(hasTrip() && !ARCHIVE_VIEW && (activeTab === 'all' || (activeTab === 'map' && MAP_AVAILABLE))); document.body.classList.toggle('has-add', !b.hidden);
}
act('place.add', () => {
  if (activeTab === 'map' && MAPS.mapView_screen) { const c = MAPS.mapView_screen.map.getCenter(); openPlaceEditor({ coord: { lat: c.lat, lng: c.lng } }); }
  else openPlaceEditor({});
});
let _navShown = ''; // 11.34.0 (phone-round-3-fixes P12, G81): the screen and trip the bottom bar was last shown for
function render() {
  if (render.held) return; // diet-mechanism: a start that waits for its group draws nothing before it is in (startup.js START_GROUPS)
  _pastRateCache = null; // 4.29.0: past ratings follow archiving and reopening
  { const k = (STATE.activeTrip || '') + '|' + activeTab; if (k !== _navShown) { _navShown = k; navShow(); } } // a trip switch or a screen change shows the bar, on every path that draws (opening a trip from a file, the draft's approval, a menu screen) - it hides only on a scroll down in the screen shown
  _render(); document.body.classList.toggle('arr-mode', !!ARRANGE_DAYS && activeTab === 'itinerary'); mapSweep(); if (_clockTimer && !document.getElementById('destClock')) { clearInterval(_clockTimer); _clockTimer = null; } mapCardSync(); updateAddFab(); fsAfterRender(); measAfterRender(); lifeSoon(); firstScreen('drawn'); // arch-guard (3): the first real screen's mark
  if (FP.q && (activeTab === 'all' || activeTab === 'map')) markSearch(document.getElementById('main'), FP.q); // 5.15.0: what was found is marked
  explainSync(); // 10.15.0 (design-review): the close rule - a bubble of another screen, layer or trip goes
  ellFitSoon(); // final-review-fixes (family B): the one-line "…" boxes of what was just drawn
  if (screenTop() && screenTop().tab === activeTab) { screenSync(); introMaybe(); return; } // 5.6.0: a menu screen - no banners inside it
  const nag = backupNagHTML();
  if (nag && activeTab !== 'sync') document.getElementById('main').insertAdjacentHTML('afterbegin', nag);
  const db = draftBannerHTML(); // 4.2.0: a draft waiting for approval shows on top of every screen
  if (db) document.getElementById('main').insertAdjacentHTML('afterbegin', db);
  const ab = archiveBarHTML(); if (ab) document.getElementById('main').insertAdjacentHTML('afterbegin', ab); // 4.28.0
  if (activeTab === 'itinerary' || activeTab === 'all') visSwipeHint(); // 9.2.0 (ס5)
  introMaybe(); // 9.6.0 (12ו)
}
const NO_TRIP_TABS = ['memory', 'memories', 'countries', 'closing', 'trips', 'guide', 'whatsnew', 'settings', 'sync', 'log', 'trash', 'draft', 'claude'];
function _render() {
  touchReset(); document.body.classList.remove('on-entrance');
  if (activeTab === 'passport') { renderTabs(); groupScreen('memories', 'renderPassportScreen'); return; } // passport-book: the book, with or without an open trip
  if (!hasTrip() && !NO_TRIP_TABS.includes(activeTab)) { renderTabs(); renderTripsScreen(!!Object.keys(STATE.trips).length); return; } // 4.45.0: one trips screen, also when no trip is open
  if (isLayerTab(activeTab)) { const t = translateTab(activeTab); FP.layers = t != null ? new Set([t]) : new Set(); activeTab = 'all'; }
  document.body.classList.remove('map-card-open');
  renderTabs();
  if (activeTab === 'must' || activeTab === 'resv' || activeTab === 'clusters') activeTab = 'all'; // 4.9.0 shortcuts; their screens left in 5.14.0
  if (activeTab === 'info') { renderInfoTab(); return; }
  if (activeTab === 'sync') { groupScreen('management', 'renderSyncTab'); return; }
  if (activeTab === 'log') { groupScreen('management', 'renderLogScreen'); return; }
  if (activeTab === 'settings') { groupScreen('management', 'renderSettingsScreen'); return; }
  if (activeTab === 'map') { renderMapScreen(); return; }
  if (activeTab === 'guide') { groupScreen('management', 'renderGuideScreen'); return; }
  if (activeTab === 'whatsnew') { groupScreen('management', 'renderWhatsNewScreen'); return; }
  if (activeTab === 'trash') { renderTrashScreen(); return; }
  if (activeTab === 'memories') { groupScreen('memories', 'renderMemoriesScreen'); return; } // 11.24.0 (memories-grid): every memory in the trips screen's grid
  if (activeTab === 'countries') { groupScreen('memories', 'renderCountriesScreen'); return; } // countries-visited: "מדינות שביקרנו" (js/memory-screen.js)
  if (activeTab === 'hidden') { renderHiddenScreen(); return; }
  if (activeTab === 'draft') { groupScreen('ai', 'renderDraftScreen'); return; }
  if (activeTab === 'claude') { groupScreen('ai', 'renderClaudeScreen'); return; }
  if (activeTab === 'layers') { groupScreen('management', 'renderLayersScreen'); return; }
  if (activeTab === 'trips') { renderTripsScreen(); return; }
  if (activeTab === 'closing') { groupScreen('memories', 'renderClosingScreen'); return; } // 4.29.0
  if (activeTab === 'proposal') { groupScreen('ai', 'renderProposalScreen'); return; } // 11.5.0 (schedule-proposal): the preview
  if (activeTab === 'memory') { if (ARCHIVE_VIEW) exitArchiveView(true); groupScreen('memories', 'renderMemoryScreen'); return; } // 4.28.0
  if (activeTab === 'itinerary') { renderItineraryTab(); return; }
  if (activeTab === 'all') { renderAllTab(); return; }
  renderLayerTab(activeTab);
}

fmOnInput(document.getElementById('search'), v => { // 5.15.0 (ס6): one search - the word is one more filter of the places
  const el = document.getElementById('search'); FP.q = v.trim();
  document.getElementById('searchClear').hidden = !v;
  if (activeTab !== 'all' && activeTab !== 'map') { goTab('all'); el.focus(); return; }
  if (activeTab === 'map') rerenderKeepingMap(); else render();
});
act('search.clearTop', () => {
  const input = document.getElementById('search');
  input.value = ''; FP.q = '';
  document.getElementById('searchClear').hidden = true;
  input.focus(); return 'redraw';
});

function renderLegend() {
  const el = document.getElementById('legend'); if (!el) return;
  el.innerHTML = POINTS_GROUP.filter(l => l.id !== 'all').map(l =>
    `<span><span class="dot" style="background:${l.color}"></span>${escH(l.label)}</span>`
  ).join('');
}

function applyTheme() {
  const t = STATE.theme || 'auto';
  if (t === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
  document.getElementById('themeToggle').innerHTML = msi(t === 'dark' ? 'dark_mode' : t === 'light' ? 'light_mode' : 'contrast') + (t === 'dark' ? 'תצוגה: כהה' : t === 'light' ? 'תצוגה: בהירה' : 'תצוגה: אוטומטית');
}
const menuDD = document.getElementById('menuDD');
function closeMenu() { if (menuDD.hidden) return; menuDD.hidden = true; explainFree(true); } // the ⋮ menu's one close: what waited for it may open (the gate)
act('menu.toggle', () => { undoMenuSync(); reportMenuSync(); kitDotSync(); menuDD.hidden = !menuDD.hidden; explainSync(); }); // the gate: the menu closes an open bubble and holds the ones due
function openMenuScreen(tab, anchor) {
  closeMenu(); FP.q = ''; document.getElementById('search').value = '';
  goTab(tab);
  if (anchor) setTimeout(() => reveal(document.getElementById(anchor), false, { align: 'start', instant: true }), 50);
}
act('menu.screen', c => openMenuScreen(c.v));
act('tour.start', () => { closeMenu(); viaGroup('management', 'startTour', true); }); // 9.6.0 (12ו): the opening and intros 1-4
// 5.15.0 (ד4): installing - a main line in ⋮, only when the app is not installed yet and not inside Claude (it can't be installed there).
// Chrome on Android: one tap opens the browser's own install window (beforeinstallprompt); iPhone: a two-line explanation.
let _installEvt = null;
function appInstalled() { try { return matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || navigator.standalone === true; } catch (e) { return false; } }
// 9.3.0 (ס12-4): "inside Claude" by what works, never by the site's name (the published artifact's site wasn't recognized):
// a page running inside another page (the Claude app, a published artifact) gets no file picker. Then every file door is the paste
// window. 11.34.0 (P13, G82): only the frame counts - a picker that closed at once is no longer taken for "no picker"
function inClaude() { try { return window.self !== window.top; } catch (e) { return true; } }
function syncInstallBtn() { const b = document.getElementById('installBtn'); if (b) b.hidden = appInstalled() || inClaude(); }
sysOn(window, 'beforeinstallprompt', e => { e.preventDefault(); _installEvt = e; syncInstallBtn(); });
sysOn(window, 'appinstalled', () => { _installEvt = null; syncInstallBtn(); showToast('הותקן. האייקון "' + APP.appShort + '" במסך הבית'); });
act('app.install', async () => { closeMenu();
  if (_installEvt) { const ev = _installEvt; _installEvt = null; try { ev.prompt(); await ev.userChoice; } catch (e) {} syncInstallBtn(); return; }
  openInstallHelp(); });
// 10.5.0 (design-4 part 2, look.md "Files in and out"): Android / iPhone as a segmented button (preset by the device), the steps, what happens after
function openInstallHelp(dev) { layerNote(openInstallHelp, arguments); const sheet = document.getElementById('sheet'), ios = dev ? dev === 'ios' : /iphone|ipad|ipod/i.test(navigator.userAgent);
  sheet.innerHTML = `${fmHead('📲 התקנה כאפליקציה', 'ihClose')}
    <div class="ih-dev">${segHTML('install.dev', [['android', `${msi('android', { size: 18 })} Android`], ['ios', `${msi('phone_iphone', { size: 18 })} iPhone`]], ios ? 'ios' : 'android')}</div>
    ${ios ? '<p>ב-Safari: כפתור השיתוף (הריבוע עם החץ, בתחתית) ← "הוספה למסך הבית".</p>' : '<p>ב-Chrome: ⋮ בפינה העליונה ← "התקנת אפליקציה" או "הוספה למסך הבית".</p>'}
    <p class="sh-hint">אחר כך האייקון "${APP.appShort}" במסך הבית נפתח כמו אפליקציה רגילה, גם בלי רשת.</p>`;
  if (!(_sheetOpen && layerTop() && layerTop().key === 'openInstallHelp')) showSheetBackdrop('openInstallHelp'); } // a device switch redraws in place (the frame follows the redraw)
act('install.dev', c => { openInstallHelp(c.v); return 'quiet'; });
syncInstallBtn();
document.getElementById('menuVersion').textContent = APP_VERSION;
{ const mc = document.querySelector('meta[name="copyright"]'); if (mc) mc.content = copyrightText(); } // 10.6.1: the page head's copyright, computed

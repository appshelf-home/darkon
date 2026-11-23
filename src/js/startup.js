// test-address (decisions 2026-11-16 · A test address through the repository, Q3): the same page on the real site and on the test address;
// only on the test address (its host) a thin fixed band at the top, "גרסת בדיקה <version>" - never on the real site or inside Claude
const IS_TEST_SITE = location.hostname.startsWith(APP.testHost);
(function testBand() {
  if (!IS_TEST_SITE) return;
  document.documentElement.classList.add('test-site');
  const b = document.createElement('div'); b.className = 'test-band'; b.id = 'testBand'; b.setAttribute('role', 'note');
  b.textContent = 'גרסת בדיקה ' + APP_VERSION; document.body.prepend(b);
})();
// 3.2.0: a badge in the top bar only while there is no network (the app has no sync, so no permanent dot)
(function netBadge() {
  const b = document.getElementById('netBadge'); b.innerHTML = msi('cloud_off', { size: 22 }); // 10.1.0 (design-1): a small warm icon, its name on a long press
  const upd = () => { b.hidden = navigator.onLine !== false; };
  window.addEventListener('online', upd); window.addEventListener('offline', upd); upd();
})();
act('net.info', () => showToast('בלי רשת: המפה, התחזית, שער המטבע וחיפוש כתובות מחכים לחיבור. כל השאר עובד ונשמר.'));
// 3.2.0: weekday next to every date field (standard), for fields that don't show one already
const REG_READY = regStartup(loadDestsFromDB()); // 11.20.0: a share waits for the stored data (psShareIn)
updateHeader();
// 4.3.0: the title is a button (no text selection, no flash): it opens the trips screen, and does nothing more when already there
act('title.trips', () => { if (activeTab === 'trips') { appScroll(0, true); return; } openMenuScreen('trips'); });
document.title = PACK.appTitle;
// 2.0.0: offline + update bar. The installed app (Netlify) gets a service worker that keeps the app,
// its libraries and map tiles you already viewed; a new version waits until you tap "רענון".
// 10.1.0 (design-1): the new-version banner, first under the top bar. urgent = the old copy no longer saves: the same banner in its
// error form instead (never both; an urgent one is not turned back into the plain one)
function showUpdateBar(urgent) {
  let bar = document.getElementById('updateBar'); if (bar && (!urgent || bar.dataset.urgent)) return;
  if (!bar) { const w = document.createElement('div'); w.className = 'top-inner upd-wrap'; bar = document.createElement('div'); bar.id = 'updateBar'; w.appendChild(bar); document.querySelector('header.top').appendChild(w); }
  bar.className = 'update-bar banner ' + (urgent ? 'bn-urgent' : 'bn-new'); bar.setAttribute('role', 'status'); if (urgent) bar.dataset.urgent = '1';
  bar.innerHTML = urgent ? `${msi('warning')}<span class="bn-t"><b>יש גרסה חדשה</b>${SEP}שינויים לא נשמרים עד שמרעננים</span><button type="button" class="bn-btn" data-act="sw.refresh">רענון</button>`
    : `${msi('system_update')}<span class="bn-t"><b>יש גרסה חדשה</b></span><button type="button" class="bn-btn" data-act="sw.refresh">רענון</button>`;
}
act('sw.refresh', () => { QUIET_SWAP = false; /* 11.30.0 (review of 11.29.1, Q2): a quiet swap that never took control cannot swallow this reload */ if (window._swWaiting) window._swWaiting.postMessage('skip'); else location.reload(); return 'quiet'; }); // 10.1.1: an old copy with no waiting update reloads // 7.2.0: through the action wiring
let QUIET_SWAP = false; // 11.29.1: the next controllerchange is a quiet swap to a worker of the page's own version - no reload
(function registerSW() {
  if (!('serviceWorker' in navigator) || !(location.protocol === 'https:' || location.hostname === 'localhost') || location.hostname.includes('claude')) return;
  // 11.29.1 (sw-bar-quiet): a waiting worker is asked its version (about 2 s); the same as the open page - activated quietly, no bar and
  // no reload (QUIET_SWAP skips the controllerchange reload once); another version or no answer - the bar. The first install as before.
  const asked = new WeakSet();
  const askVersion = w => new Promise(res => { const t = setTimeout(() => res(null), 2000);
    try { const ch = new MessageChannel(); ch.port1.onmessage = e => { clearTimeout(t); res(e.data); }; w.postMessage('version', [ch.port2]); } catch (e) { clearTimeout(t); res(null); } });
  navigator.serviceWorker.register('sw.js').then(reg => {
    const offer = w => { if (!w || !navigator.serviceWorker.controller || asked.has(w)) return;
      if (document.getElementById('updateBar')) return; asked.add(w);
      askVersion(w).then(v => {
        if (v === APP_VERSION) { QUIET_SWAP = true; w.postMessage('skip'); return; }
        if (document.getElementById('updateBar')) return; window._swWaiting = w; showUpdateBar(); });
    };
    if (reg.waiting) offer(reg.waiting);
    reg.addEventListener('updatefound', () => { const w = reg.installing; w && w.addEventListener('statechange', () => { if (w.state === 'installed') offer(w); }); });
    setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
  }).catch(() => {});
  let reloading = false; const hadController = !!navigator.serviceWorker.controller; // 4.2.0: no reload on the very first install
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (QUIET_SWAP) { QUIET_SWAP = false; return; } if (reloading || !hadController) return; reloading = true; location.reload(); });
})();
(function handleShareTarget() { // 2.0.0: "share to app" from Google Maps (Android, installed app) opens a new place
  const q = new URLSearchParams(location.search); if (q.get('shared') || q.get('title') || q.get('text') || q.get('url')) SHARE_START = true; // place-find (G68): its windows' history waits for a touch (layer-manager.js)
  // 4.2.0: files (and app files shared as text) arrive through the service worker (share_target POST) -> ?shared=files
  if (q.get('shared')) { try { history.replaceState(null, '', location.pathname); } catch (e) {}
    if (q.get('shared') === 'error') setTimeout(() => showToast('השיתוף לא נקלט. אפשר לנסות שוב, או "ייבוא קובץ" במסך הטיולים'), 300); else setTimeout(receiveSharedFiles, 300); return; }
  const shared = [q.get('title'), q.get('text'), q.get('url')].filter(Boolean).join('\n');
  if (!shared) return;
  try { history.replaceState(null, '', location.pathname); } catch (e) {}
  if (/^\s*\{/.test(q.get('text') || '')) { setTimeout(() => { const d = parseAppText(q.get('text')); if (!d || !openIncoming(d, 'share')) showToast('הטקסט ששותף לא נראה כמו קובץ של ' + APP.appTitle); }, 300); return; }
  setTimeout(() => psShareIn(shared), 300); // 11.20.0 (place-search-upgrade, Q9): the open search, or a new place at the trip's nearest destination
})();
if ('launchQueue' in window) { // 4.2.0: opening a .json file with the installed app (desktop Chrome: file_handlers)
  try { window.launchQueue.setConsumer(async params => { for (const fh of (params.files || [])) { try { const f = await fh.getFile(); const d = parseAppText(await f.text()); if (d && openIncoming(d, 'launch')) return; } catch (e) {} } }); } catch (e) {}
}
act('nav.section', c => {
  const sec = c.el.dataset.sec, from = sectionOf(activeTab); // 4.4.0: the filter (search included) is shared by points and map
  if (!((from === 'points' || from === 'map') && (sec === 'points' || sec === 'map'))) { FP.q = ''; document.getElementById('search').value = ''; }
  goTab(sectionOf(activeTab) === sec ? (SECTIONS[sec].items[0] ? SECTIONS[sec].items[0].id : sec) : lastTabOf[sec]);
});
(function () { // bottom nav hides on scroll down, returns on scroll up
  let lastY = window.scrollY; const nav = document.getElementById('bottomNav');
  window.addEventListener('scroll', () => { const y = window.scrollY; if (Math.abs(y - lastY) < 6) return; if (Date.now() - _revealAt < 900) { lastY = y; return; } /* 10.6.0: a scroll by reveal() is not the person's - the navigation stays */ nav.classList.toggle('hide', y > lastY && y > 120); document.body.classList.toggle('nav-hidden', nav.classList.contains('hide')); lastY = y; }, { passive: true });
})();
act('theme.next', () => {
  const order = ['auto','light','dark'];
  const cur = order.indexOf(STATE.theme || 'auto');
  STATE.theme = order[(cur+1) % order.length];
  persist(); applyTheme();
  showUndoToast(document.getElementById('themeToggle').textContent);
});
applyTheme();

if (MAP_AVAILABLE) {
  setTimeout(() => { ensureGeocoded(POINTS); }, 3000);
}

act('search.toggle', () => {
  const wrap = document.getElementById('searchWrap');
  const showing = wrap.style.display !== 'none';
  wrap.style.display = showing ? 'none' : 'block';
  if (!showing) { if (activeTab !== 'all' && activeTab !== 'map') goTab('all'); document.getElementById('search').focus(); } // 5.15.0 (ס6): 🔍 leads to the places (on the map it stays)
  else { document.getElementById('search').value = ''; FP.q=''; document.getElementById('searchClear').hidden = true; }
  return 'redraw';
});

const scrollBtn = document.getElementById('scrollTopBtn');
window.addEventListener('scroll', () => {
  scrollBtn.classList.toggle('show', window.scrollY > 400);
}, {passive:true});
act('page.top', () => appScroll(0, true));

renderLegend();

(function seedFlights() {
  if (STATE.flightsSeeded) return;
  const add = (fid, day, name, start, end) => {
    if (!STATE.planItems[fid]) STATE.planItems[fid] = { name, address: '', icon: 'airport' };
    if (!findSlot(day, fid)) ensureDay(day).unassigned.push(fid);
    if (!STATE.times[timeKey(day, fid)]) STATE.times[timeKey(day, fid)] = { start, end };
    placeTimed(day, fid);
  };
  tripFlights().forEach(f => { const dk = travelDay(f); if (dk) add(f.id, dk, flightPlanName(f), f.depart, !(Number(f.arriveDay) || 0) && f.arrive > f.depart ? f.arrive : f.depart); });
  STATE.flightsSeeded = true; persist();
})();

FP.regions = defaultRegions();
if (STATE._tripUpdated) { const n = STATE._tripUpdated; delete STATE._tripUpdated; logEvent('הטיול עודכן מהאתר: ' + n, true, { b: 1 }); setTimeout(() => showToast('פרטי הטיול עודכנו (' + n + '). הסימונים והתוכנית נשמרו'), 800); }
(function applyLanding() { // 4.6.0: the opening screen, during a trip and outside it (⚙️ הגדרות ← 🚪 מסך הפתיחה)
  if (!hasTrip()) return;
  const day = TRIP_DAYS.find(d => d.date === todayStr()), L = landingSettings(), v = day ? L.trip : L.away;
  const go = { points: 'all', map: 'map', plan: 'itinerary', info: 'info', trips: 'trips' };
  const [scr, today] = v.split('-');
  activeTab = go[scr] || 'info';
  if (day && today === 'today') FP.days = { from: day.key, to: day.key };
  if (day && scr === 'plan') openDays = new Set([day.key]);
})();

applyPrefs(); // 4.12.0
FP.sort = prefs().sort;
if (FP.sort === 'near') requestUserLocation().then(() => { if (!userPos) FP.sort = 'fav'; render(); });
render();
maybeStartTour();
exitGuardSync(); // 11.46.0 (phone-round-4c-fixes P1): the bare page's close watcher from the first screen, before any touch (the history guard still waits for one)
requestAnimationFrame(() => setTimeout(leafLoad, 0)); // 11.29.0 (launch-fast, Q6 (a)): the map library once the first screen is drawn (a map as the opening screen asked for it already)
setTimeout(unpackAll, 1200); // 4.44.1: the packed blocks, after the first screen is up
gidLookSoon(GID_START_MS); // 11.23.0 (place-gid-2, Q4): the pass over stored places, in the background after the first screen
try { propExpire(); } catch (e) { errNote('proposal', e); } // 11.5.0 (schedule-proposal, Q6): a trip that ended drops its unapplied proposal quietly

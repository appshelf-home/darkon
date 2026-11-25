function kitGoalPart(id) { return KIT.paste[id].files[0]; }
function kitGoal(id) { return (KIT.goals || []).find(g => g.id === id) || null; }
// the paste of a goal: its listed files joined (kit.py paste_of does the same)
function kitPaste(goal) { const p = KIT.paste[goal], f = new Map(KIT.files); return p.head + '\n\n' + p.files.map(n => f.get(n).trim() + '\n').join('\n\n'); }
// the skill as a ZIP (a folder "darkon" with every file of the source)
async function kitZip() { const enc = new TextEncoder(), seen = new Set(), out = [];
  KIT.files.forEach(([n, t]) => { const parts = ('darkon/' + n).split('/'); for (let i = 1; i < parts.length; i++) { const d = parts.slice(0, i).join('/') + '/'; if (!seen.has(d)) { seen.add(d); out.push([d, null]); } } out.push(['darkon/' + n, enc.encode(t)]); });
  return zipBytes(out); }
// 4.44.1: big blocks that are rarely needed - the guide, the older "מה חדש" versions, the instructions for Claude and the skill - travel
// packed in the shipped copy. build.py gzips them into PACKED (and minifies the rest); the app unpacks them in the background
// soon after it opens. The readable source keeps them as plain values, so PACKED stays empty there and nothing is unpacked.
const PACKED = {};
let PACKED_OK = !Object.keys(PACKED).length, _packedRun = null;
function b64Bytes(b) { const s = atob(b), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; }
// one-way (14): gzip is unpacked here only - bytes in, bytes out (memory-maps.js reads its packed map data through it too)
async function gunzipBytes(u8) { return new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()); }
async function gunzipText(b) { return new TextDecoder().decode(await gunzipBytes(b64Bytes(b))); }
const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(u) { let c = 0xFFFFFFFF; for (let i = 0; i < u.length; i++) c = CRC_T[(c ^ u[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
// a ZIP from [name, Uint8Array | null (a folder)]: deflated where the browser can, stored otherwise
async function zipBytes(entries) {
  const enc = new TextEncoder(), parts = [], cen = []; let off = 0;
  for (const [name, data] of entries) {
    const nm = enc.encode(name), raw = data || new Uint8Array(0), crc = crc32(raw); let body = raw, method = 0;
    if (data && data.length && typeof CompressionStream === 'function') {
      try { const c = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer()); if (c.length < raw.length) { body = c; method = 8; } } catch (e) {}
    }
    const h = new DataView(new ArrayBuffer(30)); h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, method, true); h.setUint16(12, 0x21, true);
    h.setUint32(14, crc, true); h.setUint32(18, body.length, true); h.setUint32(22, raw.length, true); h.setUint16(26, nm.length, true);
    parts.push(new Uint8Array(h.buffer), nm, body);
    const c = new DataView(new ArrayBuffer(46)); c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, method, true); c.setUint16(14, 0x21, true);
    c.setUint32(16, crc, true); c.setUint32(20, body.length, true); c.setUint32(24, raw.length, true); c.setUint16(28, nm.length, true); c.setUint32(38, data ? 0 : 0x10, true); c.setUint32(42, off, true);
    cen.push(new Uint8Array(c.buffer), nm); off += 30 + nm.length + body.length;
  }
  const size = cen.reduce((a, u) => a + u.length, 0), e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, entries.length, true); e.setUint16(10, entries.length, true); e.setUint32(12, size, true); e.setUint32(16, off, true);
  const all = [...parts, ...cen, new Uint8Array(e.buffer)], out = new Uint8Array(all.reduce((a, u) => a + u.length, 0)); let p = 0;
  for (const u of all) { out.set(u, p); p += u.length; } return out;
}
function unpackAll() {
  if (PACKED_OK) return Promise.resolve(true);
  return _packedRun || (_packedRun = (async () => {
    try {
      if (PACKED.kit) Object.assign(KIT, JSON.parse(await gunzipText(PACKED.kit))); // 10: the files and pastes of the instructions (the version and the goals stay plain)
      PACKED_OK = true; return true;
    } catch (e) { _packedRun = null; try { logEvent(SY.warn + ' פתיחת ההוראות נכשלה: ' + (e && e.message || e), true); } catch (x) {} return false; }
  })());
}
// the 📋 copy buttons of the instructions (the claude screen, backup, closing, memento, the draft round)
async function copyKit(goal, msg) {
  if (!PACKED_OK && !(await unpackAll())) { showToast('ההוראות לא נפתחו בדפדפן הזה. מרעננים ומנסים שוב'); return; }
  copyWithFallback(kitPaste(goal), msg || 'ההוראות הועתקו'); // 10 (ה2): only the goal's part (and the core it needs)
}
function renderClaudeScreen() {
  if (!PACKED_OK) { document.getElementById('main').innerHTML = `<div class="section-head"><h2>${claudeMark()} ההוראות ל-${AI}</h2><p><span class="spin" aria-hidden="true"></span>טוען את ההוראות…</p></div>`;
    unpackAll().then(ok => { if (activeTab === 'claude') { if (ok) render(); else document.querySelector('#main .section-head p').textContent = 'ההוראות לא נפתחו בדפדפן הזה. מרעננים ומנסים שוב'; } }); return; } // 4.44.1
  // 8.0.0 (ה17): only what belongs to the whole app - installing the skill, reading the instructions, tips. Copying is in each
  // Claude window (its goal), building a new trip or destination is on the trips screen (ה13).
  const part = (id, title, files) => accHTML('cl-k-' + id, title, `<pre class="claude-paste" dir="auto">${files.map(n => escH(new Map(KIT.files).get(n))).join('\n\n')}</pre>`, false);
  document.getElementById('main').innerHTML = `<div class="section-head"><h2>${claudeMark()} ההוראות ל-${AI}</h2><p>ההוראות שבעזרתן ה-${AI} בונה ומשפר קבצים לאפליקציה, בשיחה רגילה.</p></div>
  ${accGroupHTML('התקנה', accHTML('cl-skill', '🧩 התקנת הסקיל', `<p class="cl-other">עובדים עם ${isoW('ChatGPT')}, ${isoW('Gemini')}, ${isoW('Copilot')} או ${AI} אחר? ${kitChapterHTML()}</p>
    <p>הסקיל <b>darkon</b> הוא ההוראות, מותקנות פעם אחת בחשבון ה-${AI}. השלבים כאן הם של קלוד, שבו האפליקציה נבדקה. אחרי ההתקנה לא צריך להדביק כלום: מצרפים לשיחה את הקובץ מהאפליקציה, או כותבים מה רוצים ומזכירים "דרכון".</p>
    <ol class="claude-steps" id="clSteps"><li>מורידים את הקובץ (<span id="clSkillKB"></span>הכפתור למטה) ושומרים אותו בטלפון או במחשב.</li>
    <li>נכנסים ל-${isoW('claude.ai')} בדפדפן (בטלפון: ${isoW('Chrome')} או ${isoW('Safari')}; באפליקציה של קלוד אי אפשר להעלות סקיל).</li>
    <li>עוברים לאזור התוספים והסקילים (נקרא היום ${isoW('Plugins')}).</li>
    <li>מעלים שם את הקובץ.</li>
    <li>מוודאים שהסקיל דולק. מעכשיו הוא זמין בכל שיחה, גם באפליקציה של קלוד.</li>
    <li>יצאה גרסה חדשה של ההוראות? מורידים שוב ומעלים במקום הקודם.</li></ol>
    <p class="sh-hint" id="clStepsElse">המסך נראה אחרת? מחפשים בהגדרות של קלוד מקום להעלות סקיל, ומעלים שם את הקובץ.</p>
    <div class="brow export-actions"><button class="btn-nav" id="clSkill" data-act="kit.skill">${msi('download', { size: 18 })} הורדת הסקיל</button></div>
    <div class="accordion cl-others">${kitOtherHTML('cl-gpt', 'ChatGPT', `ב-${isoW('ChatGPT')} עוברים לאזור הסקילים או התוספים (${isoW('Skills')} או ${isoW('Plugins')}).`)}${kitOtherHTML('cl-gemini', 'Gemini', `ב-${isoW('Gemini')} עוברים בהגדרות לאזור הסקילים, באתר או באפליקציה למחשב.`)}${kitOtherHTML('cl-copilot', 'Copilot', `ב-${isoW('Copilot')} של מיקרוסופט עוברים לאזור ${isoW('Agents &amp; Skills')}, אם החשבון מאפשר.`)}${accHTML('cl-any', AI + ' אחר', `<p>מעתיקים את ההוראות מהחלון שממנו שולחים את הקובץ (${msi('content_copy', { cls: 'msi-in' })}), ומדביקים אותן בשיחה עם הקובץ.</p>`, false)}</div>`, true))}
  ${accGroupHTML('ההוראות', accHTML('cl-kit', '📄 הצגת ההוראות ' + tipI('kit.copy', true) + `<small class="acc-sub">גרסה ${KIT.version}</small>`, `<p class="sh-hint">לקריאה בלבד. מעתיקים מהחלון שממנו שולחים.</p>
    <div class="accordion">${part('core', 'הליבה: קריאת קובץ וכתיבתו - לכל המטרות חוץ מהמזכרת', KIT.core)}${(KIT.content || []).length ? part('content', 'כללי התוכן - לבנייה, לסבב שיפורים ולעדכון', KIT.content) : ''}${KIT.goals.map(g => part(g.id, claudeH((TX.claude[g.id] || {}).btn || g.id), [kitGoalPart(g.id)])).join('')}</div>`, false)
  + accHTML('cl-tips', '💡 טיפים', `<ul><li>${claudeH(TX.claude.build.btn)} נמצא במסך הטיולים: שם בונים טיול או יעד חדשים בשיחה עם ${AI}.</li>
    <li>אפשר להתחיל גם מרשימה שכבר יש לכם (מקומות מחבר, רשימה ב-Google Maps): מדביקים אותה בשיחה, וה-${AI} בודק ומשלים.</li>
    <li>מיקומים: ה-${AI} מכניס מיקום מדויק רק ממקור שאפשר להצביע עליו. מקום בלי מיקום מדויק נמצא לפי הכתובת אחרי האישור, ובטיוטה אפשר לתקן.</li>
    <li>בטיול מאורגן היעד קטן בכוונה: בלי לחזור על מה שכבר בתוכנית, רק מה שעוזר בזמן החופשי.</li></ul>`, false))}`;
  const m = document.getElementById('main'); // the screen's own (a lower layer may hold another copy)
  // kit-fixes (11.45.0): the skill's size moved out of its button into step 1 - at 100KB and more it cut the button at 320 wide, 1.5
  kitZip().then(b => { const e = m.querySelector('#clSkillKB'); if (e) e.textContent = `\u2066${Math.round(b.length / 1024)}KB\u2069, `; }).catch(() => {});
}
// skill-install (decisions 2026-11-23 · Installing the skill, for any assistant, Q1-Q2): the steps name no button of Claude (only the
// area's name today, "Plugins", once); the other assistants in folded blocks of one shape - ChatGPT, Gemini (kit-install 3: Gemini takes
// skills), Copilot, each with the same fallback line and "not tested" - and "AI אחר" (copy the instructions; kit-install 2; named "AI", never
// "עוזר" - ride-no-home item 4 (b), decisions 2026-11-20 · Working with any AI assistant, Q1); the link
// to the guide's chapter "עבודה עם AI" opens it (tip.more, the guide's one door)
function kitChapterHTML() { return `<button type="button" class="pw-link" data-act="tip.more" data-v="claude">עבודה עם ${AI}</button>`; }
function kitOtherHTML(key, name, where) {
  return accHTML(key, isoW(name), `<ol class="claude-steps"><li>מורידים את אותו קובץ (הכפתור למעלה).</li><li>${where}</li><li>מעלים שם את הקובץ.</li></ol>
    <p class="sh-hint">המסך נראה אחרת? מחפשים בהגדרות של ${isoW(name)} מקום להעלות סקיל, ומעלים שם את הקובץ.</p><p class="sh-hint">לא נבדק - אם ההעלאה לא עובדת, מעתיקים את ההוראות.</p>`, false); }
// the install window - from every ✳ window's link, the trips screen's card and the draft's line: the instructions screen with it open
function openSkillInstall() { ACC_OPEN['cl-skill'] = true; openScreen('claude', true);
  setTimeout(() => reveal(document.querySelector('.screen-layer #main [data-acc="cl-skill"]') || document.querySelector('#main [data-acc="cl-skill"]'), false, { align: 'start', instant: true }), 50); }
// skill-install (Q4-Q5): which kit this device's AI has. Kept per device (registry row 'skill', never in a backup or a trip file): the kit
// version last downloaded here (kitDl), the newest kitVersion on a file that came back from an AI (kitSeen), the kit version at which the
// card was put off (kitDismiss). A skill user = either of the first two. Only a rise by y or x counts; a z rise is told by nobody.
function kitBehind(v) { const a = String(v || '').split('.').map(Number), b = String(KIT.version).split('.').map(Number);
  if (a.length !== 3 || a.some(n => !Number.isInteger(n))) return '';
  return a[0] < b[0] ? 'x' : a[0] === b[0] && a[1] < b[1] ? 'y' : ''; }
function kitHave() { const a = DEV.kitDl || '', b = DEV.kitSeen || ''; return !a ? b : !b ? a : versionLess(a, b) ? b : a; }
function kitStale() { return !!kitHave() && !!kitBehind(kitHave()); } // the ⋮ dot: until the skill is current
function kitCardDue() { return kitStale() && (!DEV.kitDismiss || !!kitBehind(DEV.kitDismiss)); } // the card: and not put off at this kit
function kitSeenFile(v) { if (/^\d+\.\d+\.\d+$/.test(String(v || '')) && (!DEV.kitSeen || versionLess(DEV.kitSeen, v))) devSet({ kitSeen: v }); }
function kitDotSync() { const d = document.getElementById('kitDot'); if (d) d.hidden = !kitStale(); }
// the card on the trips screen, in the shape of the welcome-back card
function kitCardHTML() {
  if (!kitCardDue()) return '';
  return `<div class="today-card wb-card kit-card" id="kitCard"><div class="tc-title">${msi('extension', { size: 20 })}יש הוראות חדשות ל-${AI}</div>
    <p class="wb-sum">כדי שה-${AI} יעבוד לפי הגרסה החדשה, מורידים שוב את הסקיל ומעלים אותו במקום הקודם.</p>
    ${cardActionsHTML({ id: 'kitCardDl', act: 'kit.skill', label: `${msi('download', { size: 18 })} הורדת הסקיל` }, [{ id: 'kitCardHow', act: 'kit.install', label: 'איך מתקינים' }, { id: 'kitCardLater', act: 'kit.later', label: 'לא עכשיו' }])}</div>`; // card-actions (merged after skill-install): the primary at full width, the two others as text in halves
}
act('kit.later', () => { devSet({ kitDismiss: KIT.version }); kitDotSync(); showUndoToast('בסדר. נזכיר כשיהיו שוב הוראות חדשות'); return 'redraw'; });
// ה13: building a new trip or destination - a Claude window from the trips screen (no file goes out: only 📋)
function openBuildWin() { layerNote(openBuildWin, arguments); partsWin(fmNew({}), { key: 'openBuildWin', title: claudeH(TX.claude.build.btn), goal: 'build' }); }
act('claude.build', () => { openBuildWin(); return 'quiet'; });
act('kit.skill', async () => { if (!PACKED_OK && !(await unpackAll())) return;
    if (await deliverFile(new Blob([await kitZip()], { type: 'application/zip' }), `darkon-${KIT.version}.zip`, 'application/zip')) { logEvent('הורד הסקיל darkon ' + KIT.version, true);
      devSet({ kitDl: KIT.version }); kitDotSync(); if (!kitCardDue()) { const c = document.getElementById('kitCard'); if (c) c.remove(); } } }); // skill-install (Q4): the card and the dot go

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
  if (activeTab === 'passport') { renderTabs(); renderPassportScreen(); return; } // passport-book: the book, with or without an open trip
  if (!hasTrip() && !NO_TRIP_TABS.includes(activeTab)) { renderTabs(); renderTripsScreen(!!Object.keys(STATE.trips).length); return; } // 4.45.0: one trips screen, also when no trip is open
  if (isLayerTab(activeTab)) { const t = translateTab(activeTab); FP.layers = t != null ? new Set([t]) : new Set(); activeTab = 'all'; }
  document.body.classList.remove('map-card-open');
  renderTabs();
  if (activeTab === 'must' || activeTab === 'resv' || activeTab === 'clusters') activeTab = 'all'; // 4.9.0 shortcuts; their screens left in 5.14.0
  if (activeTab === 'info') { renderInfoTab(); return; }
  if (activeTab === 'sync') { renderSyncTab(); return; }
  if (activeTab === 'log') { renderLogScreen(); return; }
  if (activeTab === 'settings') { renderSettingsScreen(); return; }
  if (activeTab === 'map') { renderMapScreen(); return; }
  if (activeTab === 'guide') { renderGuideScreen(); return; }
  if (activeTab === 'whatsnew') { renderWhatsNewScreen(); return; }
  if (activeTab === 'trash') { renderTrashScreen(); return; }
  if (activeTab === 'memories') { renderMemoriesScreen(); return; } // 11.24.0 (memories-grid): every memory in the trips screen's grid
  if (activeTab === 'countries') { renderCountriesScreen(); return; } // countries-visited: "מדינות שביקרנו" (js/memory-screen.js)
  if (activeTab === 'hidden') { renderHiddenScreen(); return; }
  if (activeTab === 'draft') { renderDraftScreen(); return; }
  if (activeTab === 'claude') { renderClaudeScreen(); return; }
  if (activeTab === 'layers') { renderLayersScreen(); return; }
  if (activeTab === 'trips') { renderTripsScreen(); return; }
  if (activeTab === 'closing') { renderClosingScreen(); return; } // 4.29.0
  if (activeTab === 'proposal') { renderProposalScreen(); return; } // 11.5.0 (schedule-proposal): the preview
  if (activeTab === 'memory') { if (ARCHIVE_VIEW) exitArchiveView(true); renderMemoryScreen(); return; } // 4.28.0
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
act('tour.start', () => { closeMenu(); startTour(true); }); // 9.6.0 (12ו): the opening and intros 1-4
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

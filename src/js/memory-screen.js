// ---- "הדרכון שלי" - the passport book (task passport-book; decisions 2026-11-23 · A passport book, Q1-Q6; spec/passport-book.md) ----
// diet-groups (11.62.0): the passport's model and line, cvTrips / cvMine / cvHasAny moved to js/memory-lines.js (main)
// One rule (Q6): the book reflects the closed trips. ppModel is the book's one model, drawn again from the trips whenever it is shown:
// one stamp per destination of a trip closed in this app (archived as 'ended' and not received closed in a file - archived.recv,
// importTripNow), its name (the destination's current one; a deleted destination's from the closing's snapshot), its flag, the days
// spent there (the trip's segments) and the trip's name; the trips in time order, a page per trip, up to PP_PER stamps a page. Kept
// on this phone, apart (Q2, Q6): only each stamp's character - shape, ink, tilt, the ink's spots, fixed at its first stamping from the
// destination's name - and whether its landing was shown: DEV.stamps { "<trip id>|<destination id>": { s, c, r, n, l } }, the registry
// row "passport" (device ring; a trip gone for good takes its keys - regPurgeTripRows). Code here (the memory screen's part) so the
// parts' cycle does not grow (t1160).
// a stamp's character is fixed the first time the app meets it (Q6: a renamed destination keeps its shape and colour); landed: its landing counts as shown
function ppFix(list, landed) { const o = { ...ppStore() }; let ch = false;
  list.forEach(s => { if (!o[s.key]) { o[s.key] = { ...ppChar(s.name), ...(landed ? { l: 1 } : {}) }; ch = true; } });
  if (ch) devSet({ stamps: o }); }
// the stamping moment (Q4): after "סגירה" (archiveTrip) - the trip's stamps whose landing was never shown land on its page, once
function ppStampTrip(id) { if (!ppClosedHere(STATE.trips[id])) return; const mine = ppModel().stamps.filter(s => s.trip === id); ppFix(mine, false);
  const land = mine.filter(s => !ppStore()[s.key].l).map(s => s.key); if (!land.length) return; // a reopened trip keeps its stamps in place (Q6)
  const o = { ...ppStore() }; land.forEach(k => { o[k] = { ...o[k], l: 1 }; }); devSet({ stamps: o });
  ppGo(id, land); }
// open the book (Q3): at the cover, or at a trip's first page; back returns exactly where it was opened (a full screen of the layers' stack)
function ppGo(tripId, land) { const M = ppModel(); ppFix(M.stamps, true); const i = tripId ? M.pages.findIndex(p => p.trip === tripId) : -1;
  PP.page = i >= 0 ? i + 2 : 0; PP.land = land || null; PP.skip = false; PP.turn = null; goTab('passport'); } // opened at a page: no turn (the stamping moment lands as it is)
// the memory screen's row: the trip's stamps, the book open at its page
function ppMemRowHTML(t, go) { if (!ppClosedHere(t) || !ppModel().stamps.some(s => s.trip === t.id)) return '';
  return `<button type="button" class="pp-line pp-top t-wrap" data-act="pp.trip" data-v="${escH(t.id)}">${msi('menu_book', { size: 20 })}<span>החותמות של הטיול בדרכון</span>${go}</button>`; }
act('pp.open', () => { ppGo(); return 'quiet'; });
act('pp.trip', c => { ppGo(c.v); return 'quiet'; });
// the hidden way in (Q3): the trips screen's hero stamp answers like a rubber stamp pressed, then the book opens; "reduce motion" - at once
act('pp.hero', c => { const b = c.el; if (matchMedia('(prefers-reduced-motion: reduce)').matches) { ppGo(); return 'quiet'; }
  b.classList.add('pp-press'); setTimeout(() => { b.classList.remove('pp-press'); ppGo(); }, 220); return 'quiet'; });
// the stamp, the book, the page turn, its card and sharing: js/passport-book.js (page-look: split at this seam)
// ---- memory screen, part 3 ----
function memorySection3(M, where) {
  const id = M.t.id;
  if (where === 'top') return picMemBlockHTML(M); // 4.43.0
  if (where === 'bottom') { const n = memoPhotoCount(id);
    return `${M.td.album ? `<p class="mem-album"><a href="${escH(M.td.album)}" target="_blank" rel="noopener">${msi('link', { size: 18, cls: 'msi-in' })} האלבום</a></p>` : ''}
      <div class="accordion">${accHTML('mem-photos', `${msi('photo_library', { size: 20 })} תמונות ואלבום${n ? `${SEP}${n}` : ''}`, `<p class="sh-hint">רשות. עד ${MEMO_PHOTO_MAX} תמונות לטיול; הראשונה היא תמונת השער, ורגע שיא יכול לקבל אחת מהן. בלעדיהן המזכרות שלמות.</p>
        ${photosBoxHTML(id)}
        ${(M.td.highlights || []).length && n ? `<div class="mem-hlp">${(M.td.highlights || []).map(h => `<div class="cl-row"><span>${msi('celebration', { cls: 'msi-in' })} ${escH((h.placeId != null && M.pmap.get(h.placeId) ? M.pmap.get(h.placeId).name : '') || h.text || 'רגע שיא')}</span>${hlPhotoPickHTML(id, h)}${h.placeId == null && M.visited.length ? hlWhereHTML(M.visited, h, `data-hlwhere="${escH(h.id)}"`, { act: 'hlPick.hlwhere' }) + hlWhereNote(h) : ''}</div>`).join('')}</div>` : ''}
        <label class="sh-field">קישור לאלבום${fmInput({ type: 'url', id: 'mpAlbum', act: 'memSec.mpAlbum', dir: 'ltr', value: M.td.album || '', placeholder: 'https://' })}</label>`, false)}</div>`; }
  return '';
}
const _memBgAsked = new Set();
function memorySectionCtl(M) { const ctl = ctlNS('memSec');
  const id = M.t.id, main = document.getElementById('main'), rr = () => renderMemoryScreen(), v = () => (MEMO_VIEW[id] = MEMO_VIEW[id] || {});
  { ctl.memPicEdit = () => openPicEditor(id); ctl.memPicFs = () => openPhotoView({ pic: id }); // 4.43.0

    if (mementoStyleOf(id) !== 'art') picWikiKick(id);
    else if (!PIC_GEO_LOADED.has(id)) readyArtCredits(id).then(() => { if (activeTab === 'memory' && memoryTrip === id && !(PIC_ED)) rr(); }); } // trip-picture-credits: the stamp's map credit // 4.44.0: Wikipedia's picture of each point, in the background
  
  if (!mementoBgReady(id) && !svcNetDown() && !_memBgAsked.has(id + '|' + mementoStyleOf(id) + '|' + SCHEM_FAILED.size)) { _memBgAsked.add(id + '|' + mementoStyleOf(id) + '|' + SCHEM_FAILED.size); // 4.46.5: per style - a style chosen in the editor loads its background too // 4.43.0: once per failure state, never a redraw loop
    readyMementoBg(id).then(r => { if (r) memBgStatus(null); if (activeTab === 'memory' && memoryTrip === id && !(PIC_ED) && (r || SCHEM_FAILED.size)) rr(); }); }
  { ctl.memBgRetry = () => { SCHEM_FAILED.clear(); SVC.gaveUp = {}; Object.keys(SVC.p).forEach(p => { SVC.p[p].pauseUntil = 0; }); _memBgAsked.clear(); memBgStatus(null); rr(); }; } // 4.36.1; 7.1.0: also lifts the providers' wait (not a block)
  
  const g = q => document.getElementById(q);
  if (g('memArt')) ctl.memArt = () => openArtSheet(id);
  if (g('memExport')) ctl.memExport = () => openMemExport(id); // 4.46.5
  
  { const box = main.querySelector('.ph-box'); const redraw = () => { ACC_OPEN['mem-photos'] = true; rr(); }; if (box) photosBoxCtl(box.parentElement, id, redraw); const hp = main.querySelector('.mem-hlp'); if (hp) hlPickCtl(hp, id, redraw); } // 4.35.0
  
  
  
  
  if (g('mpAlbum')) ctl.mpAlbum = () => { const td = tdOf(id), v = g('mpAlbum').value.trim(); if ((td.album || '') === v) return; td.album = v; tdSave(id); showUndoToast(v ? 'הקישור לאלבום נשמר' : 'הקישור לאלבום הוסר'); };
  // heights arrive later when online: once, for the stops and the places I visited
  if (svcOnline() && !M._elevAsked) { M._elevAsked = true; const D = mementoData(id); if (D && D.spread > 80) { const cs = D.stops.map(s => s.c).concat(D.keyPts.slice(0, 10).map(snapCoord)).filter(c => c && knownElev(c) == null).slice(0, 14);
    if (cs.length) elevMany(cs).then(() => { if (cs.some(c => knownElev(c) != null) && activeTab === 'memory' && memoryTrip === id) rr(); }); } }
}
ctlActs('memSec', ['memPicEdit', 'memPicFs', 'memArt', 'memBgRetry', 'memExport', 'mpAlbum']);
// ---- 📖 trip summary: an HTML file without a wrapper ----
async function sendTripSummary(id, opt) {
  if (SUMMARY_BUSY) return; SUMMARY_BUSY = true; showToast('מכין את הסיכום עם המפה…');
  try { await sendTripSummary2(id, opt || { plan: true, words: true, photos: true, bad: true }); } finally { SUMMARY_BUSY = false; }
}
var SUMMARY_BUSY = false;
function summaryBusy(v) { if (v === undefined) return SUMMARY_BUSY; SUMMARY_BUSY = v; } // diet-room: the pages group asks and sets it by name (groupFn)
// 9.1.1 (12ג-5): a page for people leaves one way - the file, the change-log line and the "made without network" note
async function sendPage(html, o) {
  const ok = await deliverFile(new Blob([html], { type: 'text/html' }), `${PACK.fileName}-${o.slug}-${o.name.replace(/[^\wא-ת]+/g, '-')}.html`, 'text/html');
  if (ok) { logEvent(o.log, true); if (o.then) o.then(); if (o.pic && !o.pic.online) showToast(`${o.noun} נוצר בלי רשת, והמפה בו סכמטית. עם רשת אפשר ליצור אותו שוב עם מפה מלאה`); }
}
async function sendTripSummary2(id, opt) {
  if (!(await needGroup('pages'))) { showToast(GROUP_FAIL); return; } // diet-room: the page's packed map (fmapPack, fmapCSS) is the pages group
  opt = opt || { plan: true, words: true, photos: true, bad: true };
  const D = mementoData(id), M = D.M, t = M.t, e = escH, name = String(t.name).split(' · ')[0];
  if (!mementoBgReady(id) && svcOnline()) await readyMementoBg(id);
  if (!mementoBgReady(id) && mementoStyleOf(id) !== 'art') showToast(SY.warn + ' רקע המפה של תמונת הטיול לא נטען, והיא נכנסת לסיכום בלעדיו');
  await readyArtCredits(id);
  const svg = await photoPageSVG(() => currentMementoSVG(id), { off: !opt.photos }); // 4.36.0: the trip picture as chosen in the memory screen (map / schematic / illustrated); hidden-data (H3): its photos cut to their circles, none with "התמונות" off
  // 4.36.0: 🗺️ where we were - a live map (faded tiles, places in the rating's colour), with a picture of it for offline
  const I = memItems(M, false), W = x => opt.words ? x : '', fitems = I.places.filter(x => opt.bad || x.r !== 'dislike').map(x => ({ lat: x.c.lat, lng: x.c.lng, color: x.color, n: '', name: x.name, sub: [nameOther(x.p, x.name), x.r ? RATE[x.r] + ' ' + RATE_LABEL[x.r] : '', W(x.w) ? '"' + x.w + '"' : ''].filter(Boolean).join(SEP), love: x.r === 'love', label: x.hi || x.key, nav: navUrl(x.c.lat + ',' + x.c.lng), desc: x.p && x.p.description ? String(x.p.description).slice(0, 220) + (wikiTextOf(x.p) ? SEP + wikiTextCreditText(x.p) : '') : '', q: x.name, icon: x.p && x.p.icon }))
    .concat(I.hotels.map(h => ({ lat: h.c.lat, lng: h.c.lng, color: '#1C2B33', n: '', name: h.name, icon: 'lodging', sub: h.nights + ' לילות', hotel: true })));
  const route = I.hotels.length > 1 ? I.hotels.map(h => [h.c.lat, h.c.lng]) : [];
  const pic = fitems.length ? await fileMapPicture(fitems, memKind(D), { fade: true, tripId: id, th: D.th, route }) : null;
  const plan = opt.plan ? planAsItWasHTML(M) : '', love = Object.entries(D.rate).filter(([, v]) => v.r === 'love'), like = Object.entries(D.rate).filter(([, v]) => v.r === 'like');
  const nm = k => (M.pmap.get(Number(k)) || {}).name || '';
  const photos = (opt.photos ? tripPhotoKeys(id) : []).map(k => { const h = (M.td.highlights || []).find(x => x.photo === k); const nmH = h ? ((h.placeId != null && M.pmap.get(h.placeId) ? M.pmap.get(h.placeId).name : '') || h.text || '') : ''; return { k, name: nmH, text: '' }; }); // 4.35.0: the whole collection
  for (const h of photos) h.html = await photoPageImg(h.k, 480); // hidden-data (H3): each cell's square cut, about twice its shown size
  // page-look (Q1, Q3): the app's hero (--hero-top, the app's ink and title size) in place of the gradient; the headings' icons are the app's own (kid_star, favorite as the closing's)
  const html = pageHTML({ title: `${name}${SEP}סיכום הטיול`, label: 'סיכום הטיול',
    css: `.lg{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:.8rem;color:var(--on-surface-variant)}.lg i{display:inline-block;width:10px;height:10px;border-radius:50%;margin-inline-end:4px;vertical-align:middle}.hero{background:var(--hero-top);color:var(--on-surface);border-radius:var(--r-card);padding:18px 16px}.hero>div{color:var(--on-surface-variant)}.svgbox>svg{width:100%;height:auto;border-radius:var(--r-card);display:block;margin:14px 0}
.day b{display:block}.day ul{margin:4px 0;padding-inline-start:20px}.tags span{display:inline-block;background:var(--surface-container);color:var(--on-surface);border:1px solid var(--outline-variant);border-radius:var(--r-pill);padding:2px 10px;margin:3px}.ph{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px}.ph .pc{display:block;overflow:hidden;border-radius:var(--r-tile);aspect-ratio:1}.ph img{width:100%;height:100%;object-fit:cover;display:block}.ph div small{display:block;color:var(--on-surface-variant)}.mp-org{color:var(--on-surface-variant)}.mp-vis{font-weight:600}`,
    head: `<div class="hero"><div>${D.flags.join(' ')} ${t.start ? `${tmFmt('range', [t.start, t.end], { year: true })}` : ''}</div><h1>${e(name)}</h1><div>${e(D.dests.map(d => d.name).join(' ← '))}${t.travelers ? SEP + e(t.travelers) : ''}</div></div>
<div class="svgbox">${svg}</div>`,
    map: pic ? { pic, data: fmapData(fitems, pic, { fade: true, route, photos: opt.photos ? await memPagePhotos(M) : [] }), before: `<h2>${msi('map')}איפה היינו</h2>`, after: `<div class="lg"><span><i style="background:${RATE_COLOR.love}"></i>❤️ אהבנו</span><span><i style="background:${RATE_COLOR.like}"></i>👍 היה טוב</span>${opt.bad ? `<span><i style="background:${RATE_COLOR.dislike}"></i>👎</span>` : ''}<span><i style="background:${UNRATED_COLOR}"></i>בלי דירוג</span><span>🏨 לינה</span></div>` } : null,
    body: `${D.hs.length ? `<h2>${msi('kid_star')}רגעי השיא</h2>${D.hs.map(h => `<div class="card"><b>${e(h.name || h.text)}</b>${h.name && h.text ? `<div>${e(h.text)}</div>` : ''}</div>`).join('')}` : ''}
${photos.length ? `<div class="ph">${photos.map(h => `<div><span class="pc">${h.html}</span><small>${e(h.name || h.text)}</small></div>`).join('')}</div>` : ''}
${love.length || like.length ? `<h2>${msi('favorite')}מה אהבנו</h2>${love.length ? `<div class="tags">❤️ ${love.map(([k, v]) => `<span>${e(nm(k))}${W(v.w) ? `${SEP}"${e(v.w)}"` : ''}</span>`).join('')}</div>` : ''}${like.length ? `<div class="tags">👍 ${like.map(([k, v]) => `<span>${e(nm(k))}${W(v.w) ? `${SEP}"${e(v.w)}"` : ''}</span>`).join('')}</div>` : ''}` : ''}
${D.records.length ? `<h2>${msi('bar_chart')}במספרים</h2><div class="tags">${[`${D.days} ימים`, `${D.visited.length} מקומות`].concat(D.records.map(r => `${r[0]} ${r[1]}${r[2] ? SEP + r[2] : ''}`)).map(x => `<span>${e(x)}</span>`).join('')}</div>${D.records.some(r => r[0] === '⛰️') ? `<small class="elev-cr">${svcCredit('openmeteo', { as: 'elev' })}</small>` : ''}` : ''}
${plan ? `<h2>${msi('calendar_month')}יום אחר יום</h2><div class="card">${(f => { f.querySelectorAll('[class="mp-day"]').forEach(e => { e.className = 'day'; }); const d = document.createElement('div'); d.appendChild(f); return d.innerHTML; })(htmlFrag(plan))}</div>` : ''}
${M.td.album ? `<p>${msi('link', { cls: 'msi-in' })} <a href="${e(M.td.album)}">האלבום</a></p>` : ''}` });
  await sendPage(html, { slug: 'summary', name, log: '📖 נשלח סיכום הטיול: ' + t.name, noun: 'הסיכום', pic });
}
// ---- "מדינות שביקרנו" (task countries-visited; decisions 2026-11-23 · "מדינות שביקרנו", Q1-Q3 and the dynamic map; spec/countries-visited.md) ----
// What counts (review of the branch, Q1 - it replaced the task's Q2): every destination of every closed trip (not a cancelled or an open one),
// its country by cvDestCC - the borders' lookup only for a destination with neither a country nor a one-country currency. Marked by hand (Q3): STATE.countries { cc: { y } } - the registry row "countries" (in the
// backup with the visits' part; never in a trip's file). Computed when asked and kept for the session while nothing it reads changed (cvCalc).
// The screen (Q1, menu screen "countries"): the count, the world map drawn from the borders (no tiles - offline as is), moved and zoomed
// by the one picture gesture (picGesture: one finger moves, two zoom, the wheel, a double tap zooms in), "כל העולם" back; a country
// narrower than a fingertip at the current zoom, or missing at 1:110m, is also a dot at its label point (one the file does not draw: at its fixed point, WORLD_PTS); the list in the order of the
// first visit; "＋ מדינה שביקרנו". Code here (the memory screen's part) so the parts' cycle does not grow (t1160); the borders are pure.
// countries-globe (decisions 2026-11-23 · "מדינות שביקרנו" - flat map or globe, Q1-Q4): "מפה | גלובוס" at the map's top corner (this screen
// only; the flat map first, then the last choice kept on the phone - DEV.cvView, the registry's "views" row, never in a backup); the globe
// below (cvGlobe*); a list row shows its country on the map or the globe first, then opens its card (Q3; cv.row).
const CV = { W: null, by: null, st: '', p: null, t: 0, calc: null, sig: '', paths: null, all: null, to: null, v: { k: 1, x: 0, y: 0 }, g: null, gs: null, grid: null }; // countries-globe: g the globe's state, gs its shapes, grid the graticule's lines (unit vectors, the equator first)
const CV_DOT = 8; // px: a country narrower than this on the screen is also drawn as a dot; its touch target is a fingertip (the dot's clear ring, css)
const CV_MAX = 40; // the deepest zoom: about one small country across the map
const CV_HL = 900; // ms: a country a list row points at stays highlighted this long; its card opens after it (Q3)
const cvView = () => DEV.cvView === 'globe' ? 'globe' : 'map';
const cvMotion = () => !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
function cvLoad() { if (CV.W) return Promise.resolve(CV.W); if (!CV.p) CV.p = svcSiteFile(WORLD_FILE).then(j => { CV.p = null;
    if (j && j.objects) { CV.W = worldShapes(j); CV.by = new Map(CV.W.map(s => [s.id, s])); CV.st = 'ok'; } else CV.st = 'fail'; return CV.W; }); return CV.p; }
// a destination's country (review Q1): its `country`; else its currency when that is one country's (ILS IL, CHF CH - never the euro); only then its centre's lookup
function cvDestCC(d) { const c = d.center; return (d.country && countryName(d.country) ? String(d.country).toUpperCase() : '') || countryOfCurrency(d.currency) || (CV.W && c ? worldCountryAt(CV.W, c[0], c[1]) : ''); }
function cvCalc() { stashActive(); const trips = cvTrips(), mine = cvMine();
  const sig = JSON.stringify([trips.map(t => [t.id, t.archived.at, t.start, Object.keys((t.archived.snap || {}).dests || {})]), mine, !!CV.W]);
  if (CV.calc && CV.sig === sig) return CV.calc;
  const by = {}, add = (cc, t) => { if (!cc || !countryName(cc)) return null; const e = by[cc] = by[cc] || { cc, trips: [], first: '', mine: null };
    if (t && !e.trips.includes(t.id)) { e.trips.push(t.id); const d = t.start || t.end || ''; if (d && (!e.first || d < e.first)) e.first = d; } return e; };
  trips.forEach(t => Object.values((t.archived.snap || {}).dests || {}).forEach(d => add(cvDestCC(d || {}), t))); // review Q1: every destination of a closed trip
  Object.entries(mine).forEach(([cc, m]) => { const e = add(cc); if (e) e.mine = m || {}; });
  const key = e => [e.first, e.mine && e.mine.y ? String(e.mine.y) : ''].filter(Boolean).sort()[0] || '';
  const list = Object.values(by).map(e => ({ ...e, key: key(e), name: countryName(e.cc) })).sort((a, b) => a.key.localeCompare(b.key) || a.name.localeCompare(b.name, 'he'));
  const conts = new Set(list.map(e => ((CV.by && CV.by.get(e.cc)) || {}).c).filter(Boolean));
  CV.sig = sig; return (CV.calc = { list, n: list.length, conts: conts.size, has: new Set(list.map(e => e.cc)) }); }
// the line (Q1): the trips screen's "זיכרונות" header and the top of "כל הזיכרונות"; N once the borders are read (a late read draws again)
function cvLineHTML(all) { const C = CV.W || CV.st === 'fail' ? cvCalc() : null;
  if (!C && !CV.t) CV.t = setTimeout(() => cvLoad().then(() => { CV.t = 0; if (document.querySelector('.cv-line')) redrawSoon(); }), 900); // once: after the first screen is drawn
  if (!all && C && !C.n && !cvTrips().length) return '';
  const t = C && C.n ? (C.n === 1 ? 'ביקרנו במדינה אחת' : `ביקרנו ב־<bdi>${C.n}</bdi> מדינות`) : 'מדינות שביקרנו';
  return `<button type="button" class="cv-line t-wrap${all ? ' cv-top' : ''}" data-act="cv.open">${msi('language', { size: 20 })}<span>${t}</span>${entGo()}</button>`; }
act('cv.open', () => { goTab('countries'); return 'quiet'; });
const cvYear = e => e.first ? tmFmt('year', e.first) : e.mine && e.mine.y ? String(e.mine.y) : '';
const cvTripName = id => escH(String((STATE.trips[id] || {}).name || '').split(' · ')[0]);
function renderCountriesScreen() { const main = document.getElementById('main'), again = !!document.querySelector('#cvMap canvas'); // a redraw keeps the globe as it is; entering starts it again (Q2)
  if (CV.st === 'fail' && !CV.W) CV.st = ''; // the screen asks again
  if (!CV.W && CV.st !== 'fail') cvLoad().then(() => { if (activeTab === 'countries') redrawSoon(); });
  const C = cvCalc(), wait = !CV.W && CV.st !== 'fail';
  const rows = C.list.map(e => `<button type="button" class="cv-row t-wrap" data-act="cv.row" data-v="${escH(e.cc)}"><span class="cv-flag">${flagOfCountry(e.cc)}</span><span class="ent-rt"><b>${escH(e.name)}${cvYear(e) ? `<small class="cv-y">${SEP}${cvYear(e)}</small>` : ''}</b><small>${e.trips.length ? e.trips.map(cvTripName).join(SEP) : 'לפני האפליקציה'}</small></span>${entGo()}</button>`).join('');
  main.innerHTML = `<div class="section-head"><h2>${msi('language', { cls: 'msi-in' })} מדינות שביקרנו</h2><p>${C.n ? (`${C.n === 1 ? 'מדינה אחת' : `<bdi>${C.n}</bdi> מדינות`}${C.conts ? `${SEP}${C.conts === 1 ? 'יבשת אחת' : `<bdi>${C.conts}</bdi> יבשות`}` : ''}`) : 'מהטיולים שנסגרו, ומדינות שמסמנים ביד.'}</p></div>
    ${CV.W ? (cvView() === 'globe' ? cvGlobeHTML() : cvMapHTML(C)) : wait ? `<p class="cv-wait">${waitLineHTML('טוען את מפת העולם')}</p>` : `<p class="sh-hint">מפת העולם לא נטענה. הרשימה מהיעדים של הטיולים.</p>`}
    <div class="card cv-list">${rows || emptyHTML(msi('language'), 'מדינה מטיול שנסגר, או מדינה שמסמנים ביד, מופיעה כאן.', '', 'עוד אין מדינות')}</div>
    <div class="ent-dend"><button type="button" class="btn-outline" data-act="cv.add">${msi('add', { size: 18 })}מדינה שביקרנו</button></div>`;
  if (CV.W) { if (cvView() === 'globe') cvGlobeWire(!again, C); else cvMapWire(); } }
// the map: one path per country (visited in the accent colour), a dot per country that needs one at this zoom; a tap on either opens its card
function cvMapHTML(C) { if (!CV.paths) CV.paths = CV.W.map(s => ({ id: s.id, d: worldPath(s), xy: worldXY(s.l[0], s.l[1]), w: (s.bb[2] - s.bb[0]) / 360 * WORLD_W, small: s.small || s.id === 'AQ' })).filter(p => p.d || p.small); // Antarctica is not drawn: a dot at the map's southern edge (worldXY holds it there)
  const on = cc => C.has.has(cc) ? ' on' : '';
  return `<div class="cv-map" id="cvMap"><svg viewBox="0 0 ${WORLD_W} ${worldH().toFixed(0)}" role="img" aria-label="מפת העולם"><g id="cvG">
    ${CV.paths.filter(p => p.d).map(p => `<path class="cv-c${on(p.id)}" data-act="cv.tap" data-v="${escH(p.id)}" d="${escH(p.d)}"/>`).join('')}
    ${CV.paths.map(p => `<circle class="cv-dot${on(p.id)}" data-act="cv.tap" data-v="${escH(p.id)}" cx="${p.xy[0].toFixed(1)}" cy="${p.xy[1].toFixed(1)}" r="0"/>`).join('')}</g></svg>
    ${cvSwitchHTML()}<button type="button" class="cv-all chip" data-act="cv.all">${msi('language', { size: 18 })}כל העולם</button></div>`; }
const cvSwitchHTML = () => `<div class="cv-sw">${segHTML('cv.view', [['map', 'מפה'], ['globe', 'גלובוס']], cvView())}</div>`;
act('cv.view', c => { const v = c.v === 'globe' ? 'globe' : 'map'; if (v === cvView()) return 'quiet'; devSet({ cvView: v }); return 'redraw'; });
function cvMapWire() { const host = document.getElementById('cvMap'); if (!host) return; const V = CV.v, H = worldH();
  const unit = () => WORLD_W / Math.max(1, host.getBoundingClientRect().width); // map units per screen pixel at zoom 1
  const clamp = () => { V.x = Math.min(0, Math.max(WORLD_W * (1 - V.k), V.x)); V.y = Math.min(0, Math.max(H * (1 - V.k), V.y)); };
  const apply = () => { clamp(); const g = document.getElementById('cvG'); if (!g) return; g.setAttribute('transform', `translate(${V.x.toFixed(2)} ${V.y.toFixed(2)}) scale(${V.k.toFixed(4)})`);
    const u = unit(), r = px => (px * u / V.k).toFixed(2); host.classList.toggle('cv-zoomed', V.k > 1.02);
    g.querySelectorAll('.cv-dot').forEach(c => { const p = CV.paths.find(x => x.id === c.dataset.v); c.setAttribute('r', p && (p.small || p.w * V.k / u < CV_DOT) ? r(c.classList.contains('on') ? 4 : 2.5) : '0'); }); };
  const zoomTo = k => { k = Math.max(1, Math.min(CV_MAX, k)); const cx = (WORLD_W / 2 - V.x) / V.k, cy = (H / 2 - V.y) / V.k; V.k = k; V.x = WORLD_W / 2 - cx * k; V.y = H / 2 - cy * k; apply(); };
  picGesture(host, { max: CV_MAX, dblIn: 2.5, k: () => V.k, zoom: zoomTo, pan: (dx, dy) => { const u = unit(); V.x += dx * u; V.y += dy * u; apply(); },
    reset: () => zoomTo(V.k * 2.5) }); // TOUCH 'pic' - a double tap zooms in further on the map ("כל העולם" goes back), never out
  CV.all = () => { V.k = 1; V.x = 0; V.y = 0; apply(); };
  // a list row (Q3): zoom to the country (its box at about half the map; a country across the date line - Russia - about its label point), highlight it, then its card
  CV.to = (cc, then) => { const s = CV.by.get(cc); if (!s) { then(); return; } const b = s.bb, wide = b[2] - b[0] > 180, [x0, y0] = worldXY(wide ? s.l[0] : b[0], b[3]), [x1, y1] = worldXY(wide ? s.l[0] : b[2], b[1]);
    const k = Math.max(1, Math.min(CV_MAX, .5 * Math.min(WORLD_W / Math.max(8, x1 - x0), H / Math.max(8, y1 - y0)))), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const A = { k: V.k, x: V.x, y: V.y }, Z = { k, x: WORLD_W / 2 - cx * k, y: H / 2 - cy * k }, t0 = performance.now(), dur = cvMotion() ? 450 : 0;
    const lit = () => { const els = [...host.querySelectorAll('[data-v]')].filter(e => e.dataset.v === cc); els.forEach(e => e.classList.add('cv-hl')); setTimeout(() => els.forEach(e => e.classList.remove('cv-hl')), CV_HL); cvLater(then); };
    const step = t => { if (!host.isConnected) return; const p = dur ? Math.min(1, (t - t0) / dur) : 1, e = p < .5 ? 2 * p * p : 1 - (2 - 2 * p) ** 2 / 2;
      V.k = A.k + (Z.k - A.k) * e; V.x = A.x + (Z.x - A.x) * e; V.y = A.y + (Z.y - A.y) * e; apply(); if (p < 1) requestAnimationFrame(step); else lit(); };
    if (dur) requestAnimationFrame(step); else step(t0); };
  apply(); }
// the card after the highlight, unless the screen was left meanwhile
function cvLater(then) { setTimeout(() => { if (activeTab === 'countries' && document.getElementById('cvMap')) then(); }, CV_HL); }
// ---- the globe (task countries-globe; Q2, Q4) - on a canvas: measured on the test browser at 4x slowdown, the canvas draws a frame in about
// 1.4 ms and SVG paths rebuilt every frame took about 9 ms (the summary, notes/countries-globe-summary.md). The same borders (globeShapes from
// CV.W; nothing fetched - offline as the flat map); visited in --primary, others --vmap-land on --vmap-water; a soft shading (lighter middle,
// darker edge), the graticule every GLOBE_GRID° with a thicker equator, a thin halo in the water's colour; no night side. It opens facing
// the country of the last closed trip (none: IL) and turns slowly east (CV_SPIN) until the first touch, and again only when the screen is
// entered again; one finger turns it (over the poles too - a free turn, not two angles), a flick keeps it turning and slows to a stop, two
// fingers and the wheel zoom between the whole ball and CV_MAX - all through the one picture gesture (picGesture, its `down` stops the
// turning). The far side is not drawn and cannot be tapped (globeAt holds only the near side); small countries are dots by the flat map's
// rule. Reduced motion: no turning by itself, no flick, moves without animation.
const CV_SPIN = 0.1; // radians a second (about a turn a minute)
const cvLum = h => { const m = /^#?([0-9a-f]{6})$/i.exec(h); if (!m) return 1; const n = parseInt(m[1], 16); return (.299 * (n >> 16) + .587 * (n >> 8 & 255) + .114 * (n & 255)) / 255; };
function cvGlobeHTML() { return `<div class="cv-map cv-globe" id="cvMap"><canvas data-act="cv.gtap" role="img" aria-label="גלובוס"></canvas>
    ${cvSwitchHTML()}<button type="button" class="cv-all chip" data-act="cv.all">${msi('language', { size: 18 })}כל העולם</button></div>`; }
// where it opens: the label point of the last closed trip's (first) destination's country; none: Israel
function cvHome() { const t = cvTrips().sort((a, b) => (b.archived.at || 0) - (a.archived.at || 0))[0], d = t && Object.values((t.archived.snap || {}).dests || {})[0];
  const s = CV.by.get((d && cvDestCC(d)) || 'IL') || CV.by.get('IL'); return s ? s.l : [35, 31.5]; }
const cvGR = g => (Math.min(g.cv.clientWidth, g.cv.clientHeight) / 2 - 6) * g.k; // the ball's radius in px (room for the halo at the whole ball)
function cvGlobeWire(fresh, C) { const host = document.getElementById('cvMap'), cv = host && host.querySelector('canvas'); if (!cv) return;
  if (!CV.gs) CV.gs = globeShapes(CV.W);
  if (fresh || !CV.g) { const h = cvHome(); CV.g = { M: globeFacing(h[0], h[1]), home: h, k: 1, spin: cvMotion(), hand: false, acc: 0, vel: null, at: 0, fling: false, anim: null, hl: null, raf: 0, last: 0, dots: [] }; }
  const g = CV.g, cs = getComputedStyle(document.documentElement), tok = (n, d) => cs.getPropertyValue(n).trim() || d, water = tok('--vmap-water', '#AAD3DF'), dark = cvLum(water) < .3;
  if (g.raf) cancelAnimationFrame(g.raf); // a redraw: the loop goes on on the new canvas
  Object.assign(g, { cv, host, has: C.has, raf: 0, col: { water, land: tok('--vmap-land', '#F2EFE9'), on: tok('--primary', '#1A5FB4'), line: tok('--outline', '#888'), edge: tok('--surface', '#fff'), hl: tok('--on-surface', '#000'),
    lit: dark ? 'rgba(255,255,255,.07)' : 'rgba(255,255,255,.28)', shade: dark ? 'rgba(0,0,0,.42)' : 'rgba(0,30,60,.16)' } });
  const zoom = k => { cvGStop(); g.k = Math.max(1, Math.min(CV_MAX, k)); cvGDraw(); };
  picGesture(host, { max: CV_MAX, dblIn: 2.5, k: () => g.k, zoom, reset: () => zoom(g.k * 2.5), // TOUCH 'pic' - as the flat map: a double tap zooms in further, never out
    down: () => { cvGStop(); g.acc = 0; g.vel = null; },
    pan: (dx, dy) => { cvGStop(); const R = cvGR(g), now = performance.now(), dt = Math.max(1, now - g.at), v = [dx / R / dt, dy / R / dt];
      g.M = globeTurn(g.M, dx / R, dy / R); g.hand = true; g.acc += Math.abs(dx) + Math.abs(dy);
      g.vel = g.vel && now - g.at < 100 ? [(g.vel[0] + v[0]) / 2, (g.vel[1] + v[1]) / 2] : v; g.at = now; cvGDraw(); },
    settle: () => { if (g.vel && performance.now() - g.at < 60 && cvMotion() && Math.hypot(...g.vel) > 3e-4) { g.fling = true; cvGRun(); } else g.vel = null; } });
  CV.all = () => { cvGStop(); const to = globeFacing(g.home[0], g.home[1]); g.hand = false;
    if (!cvMotion()) { g.M = to; g.k = 1; cvGDraw(); return; } g.anim = { from: g.M, to, k0: g.k, k1: 1, t0: performance.now(), dur: 600 }; cvGRun(); };
  CV.to = (cc, then) => { const s = CV.by.get(cc); if (!s) { then(); return; } cvGStop(); g.hand = true; const to = globeFacing(s.l[0], s.l[1]);
    const fin = () => { g.hl = { cc, t0: performance.now() }; cvGRun(); cvLater(then); };
    if (!cvMotion()) { g.M = to; cvGDraw(); fin(); return; }
    g.anim = { from: g.M, to, t0: performance.now(), dur: 350 + 300 * Math.acos(Math.max(-1, Math.min(1, gDot(g.M[2], to[2])))), then: fin }; cvGRun(); };
  cvGDraw(); cvGRun(); }
function cvGStop() { const g = CV.g; if (g) { g.spin = false; g.fling = false; g.anim = null; } } // a touch takes over: no turning by itself, no flick, no turn to a country
// one frame loop while something moves (the turning, a flick, a turn to a country, a highlight); it ends when the screen is left
function cvGRun() { const g = CV.g; if (!g || g.raf) return; g.last = performance.now();
  const step = t => { g.raf = 0; if (!g.cv.isConnected || CV.g !== g) return; const dt = Math.min(64, Math.max(0, t - g.last)); g.last = t; let more = false;
    if (g.anim) { const a = g.anim, p = Math.min(1, Math.max(0, (t - a.t0) / a.dur)), e = p < .5 ? 2 * p * p : 1 - (2 - 2 * p) ** 2 / 2; g.M = globeMix(a.from, a.to, e); if (a.k0) g.k = a.k0 + (a.k1 - a.k0) * e;
      if (p >= 1) { g.anim = null; if (a.then) a.then(); } else more = true; }
    else if (g.fling && g.vel) { g.M = globeTurn(g.M, g.vel[0] * dt, g.vel[1] * dt); const f = Math.exp(-dt / 400); g.vel = [g.vel[0] * f, g.vel[1] * f];
      if (Math.hypot(...g.vel) < 5e-5) { g.fling = false; g.vel = null; } else more = true; }
    else if (g.spin) { g.M = globeSpin(g.M, CV_SPIN * dt / 1000); more = true; }
    if (g.hl) { if (t - g.hl.t0 > CV_HL) g.hl = null; more = true; }
    cvGDraw(t); if (more) g.raf = requestAnimationFrame(step); };
  g.raf = requestAnimationFrame(step); }
function cvGDraw(t) { const g = CV.g, cv = g && g.cv; if (!cv || !cv.isConnected) return; const w = cv.clientWidth, h = cv.clientHeight; if (!w || !h) return;
  const d = Math.min(2, window.devicePixelRatio || 1), bw = Math.round(w * d), bh = Math.round(h * d); if (cv.width !== bw || cv.height !== bh) { cv.width = bw; cv.height = bh; }
  const x = cv.getContext('2d'), c = g.col, R = cvGR(g), cx = w / 2, cy = h / 2, M = g.M, f = M[2], TAU = 2 * Math.PI, disk = r => { x.beginPath(); x.arc(cx, cy, r, 0, TAU); };
  x.setTransform(d, 0, 0, d, 0, 0); x.clearRect(0, 0, w, h);
  disk(R + 3); x.globalAlpha = .55; x.fillStyle = c.water; x.fill(); x.globalAlpha = 1; disk(R); x.fill(); // the halo, then the sea
  x.lineJoin = 'round'; x.lineWidth = .5; const hl = g.hl && g.hl.cc; let lit = null;
  for (const s of CV.gs) { if (s.reach > 0 && gDot(s.c, f) < -Math.sqrt(1 - s.reach * s.reach)) continue; // wholly on the far side
    x.beginPath(); let any = false; for (const r of s.rings) any = globeRing(x, r, M, R, cx, cy) || any; if (!any) continue;
    const on = g.has.has(s.id); x.fillStyle = on ? c.on : c.land; x.fill('evenodd'); x.strokeStyle = on ? c.edge : c.line; x.stroke(); if (s.id === hl) lit = s; }
  if (!CV.grid) { CV.grid = []; for (let la = 0; la < 90; la += GLOBE_GRID) [la, -la].filter((v, i) => i === 0 || v).forEach(v => { const l = []; for (let o = -180; o <= 180; o += 3) l.push(globeVec(o, v)); CV.grid.push(l); });
    for (let o = -180; o < 180; o += GLOBE_GRID) { const l = []; for (let la = -90; la <= 90; la += 3) l.push(globeVec(o, la)); CV.grid.push(l); } }
  x.strokeStyle = c.line; x.globalAlpha = .35; CV.grid.forEach((l, i) => { x.lineWidth = i ? .5 : 1.1; x.beginPath(); let pen = false;
    l.forEach(v => { const z = gDot(f, v); if (z <= 0) { pen = false; return; } const p = globeXY(M, R, cx, cy, v); if (pen) x.lineTo(p[0], p[1]); else x.moveTo(p[0], p[1]); pen = true; }); x.stroke(); });
  x.globalAlpha = 1; g.dots = [];
  for (const s of CV.gs) { if ((!s.small && s.w * R >= CV_DOT) || gDot(s.c, f) <= 0) continue; const p = globeXY(M, R, cx, cy, s.c), on = g.has.has(s.id), r = on ? 4 : 2.5;
    if (p[0] < -10 || p[1] < -10 || p[0] > w + 10 || p[1] > h + 10) continue; g.dots.push({ id: s.id, x: p[0], y: p[1], r }); cvDisk(x, p, r); x.fillStyle = on ? c.on : c.line; x.fill(); if (s.id === hl) lit = lit || s; }
  const sh = x.createRadialGradient(cx, cy, 0, cx, cy, R); sh.addColorStop(0, c.lit); sh.addColorStop(.55, 'rgba(0,0,0,0)'); sh.addColorStop(1, c.shade); disk(R); x.fillStyle = sh; x.fill(); // round: lighter middle, darker edge
  if (lit) { x.globalAlpha = .55 + .45 * Math.sin(((t || performance.now()) - g.hl.t0) / 110); x.strokeStyle = c.hl; x.lineWidth = 2.5; x.beginPath(); // the highlight (Q3)
    const dot = g.dots.find(q => q.id === lit.id); if (dot) cvDisk(x, [dot.x, dot.y], dot.r + 5); else lit.rings.forEach(r => globeRing(x, r, M, R, cx, cy)); x.stroke(); x.globalAlpha = 1; }
  g.host.classList.toggle('cv-zoomed', g.k > 1.02 || g.hand); }
function cvDisk(x, p, r) { x.beginPath(); x.arc(p[0], p[1], r, 0, 2 * Math.PI); }
// a tap on the ball: the nearest dot within its clear ring (as the flat map's 14 px), else the country under the finger on the near side
function cvGlobeHit(sx, sy) { const g = CV.g; let best = '', bd = Infinity;
  g.dots.forEach(p => { const dd = Math.hypot(p.x - sx, p.y - sy); if (dd <= p.r + 7 && dd < bd) { bd = dd; best = p.id; } }); if (best) return best;
  const ll = globeAt(g.M, cvGR(g), g.cv.clientWidth / 2, g.cv.clientHeight / 2, sx, sy); return ll ? worldCountryAt(CV.W, ll[1], ll[0]) : ''; }
act('cv.gtap', c => { const g = CV.g, e = c.ev; if (!g || !e || g.acc > 8) return 'quiet'; cvGStop(); const r = g.cv.getBoundingClientRect(), cc = cvGlobeHit(e.clientX - r.left, e.clientY - r.top);
  if (cc && countryName(cc)) openCvCard(cc); return 'quiet'; }); // a turn that ends on the ball is not a tap
// a list row (Q3): with the map at least half on the screen, it shows the country there first (CV.to - the flat map zooms, the globe
// turns), highlights it for a moment, then opens its card; otherwise only the card opens and nothing moves (the list does not jump)
act('cv.row', c => { const cc = c.v, m = document.getElementById('cvMap'), r = m && m.getBoundingClientRect(); if (!cc) return 'quiet';
  if (!r || !CV.to || Math.min(r.bottom, innerHeight) - Math.max(r.top, 0) < r.height / 2) { openCvCard(cc); return 'quiet'; }
  CV.to(cc, () => openCvCard(cc)); return 'quiet'; });
act('cv.all', () => { if (CV.all) CV.all(); return 'quiet'; });
// a country's card: its trips (each opens its memory) and "לפני האפליקציה"; a grey country offers "ביקרנו כאן"; only a hand-marked one is removed
function openCvCard(cc) { layerNote(openCvCard, arguments); const C = cvCalc(), e = C.list.find(x => x.cc === cc), sheet = document.getElementById('sheet'), m = e && e.mine;
  const body = !e ? `<p class="sh-hint">עוד לא בין המדינות שביקרנו.</p>${cardActionsHTML({ act: 'cv.mark', v: cc, label: msi('add_location', { size: 18 }) + 'ביקרנו כאן' })}`
    : `${e.trips.length ? `<div class="ta-list">${e.trips.map(id => `<button type="button" class="ta-item t-wrap" data-act="cv.trip" data-v="${escH(id)}">${msi('photo_album', { size: 20 })}<span>${cvTripName(id)}</span><small>${escH(tmFmt('year', (STATE.trips[id] || {}).start || (STATE.trips[id] || {}).end || ''))}</small></button>`).join('')}</div>` : ''}
      ${m ? `<p class="cv-mine">${msi('history', { size: 18, cls: 'msi-in' })} לפני האפליקציה${m.y ? `${SEP}<bdi>${escH(m.y)}</bdi>` : ''}</p>` : ''}
      ${m && !e.trips.length ? cardActionsHTML(null, [{ act: 'cv.unmark', v: cc, label: msi('delete', { size: 18 }) + 'הסרה מהמדינות' }]) : ''}`;
  sheet.innerHTML = `${fmHead(withFlag(flagOfCountry(cc), nameB(countryName(cc) || cc)))}<div class="cv-card">${body}</div>`;
  showSheetBackdrop('openCvCard'); }
act('cv.tap', c => { if (c.v) openCvCard(c.v); return 'quiet'; });
act('cv.trip', c => { closeSheet(); runTripAction(c.v, 'memory'); return 'quiet'; });
// marking by hand (Q3): the one choice field over the countries' list with its search, then the year (optional) in the same field
act('cv.add', () => { const has = cvCalc().has;
  openFmChoice({ title: 'מדינה שביקרנו', hint: 'מדינה מלפני האפליקציה. מדינות של טיולים שנסגרו נספרות לבד.', search: true, searchHint: 'חיפוש מדינה',
    options: countryList().filter(x => !has.has(x.cc)).map(x => ({ v: x.cc, text: x.n + ' ' + x.cc, html: withFlag(flagOfCountry(x.cc), escH(x.n)) })) }, cc => setTimeout(() => cvAskYear(cc), 0));
  return 'quiet'; });
act('cv.mark', c => { const cc = c.v; closeSheet(); setTimeout(() => cvAskYear(cc), 0); return 'quiet'; });
function cvAskYear(cc) { if (!cc) return; const y0 = Number(tmPhoneDate().slice(0, 4)), ys = [];
  for (let y = y0; y >= y0 - 80; y--) ys.push({ v: String(y), text: String(y), html: `<bdi>${y}</bdi>` });
  openFmChoice({ title: `${withFlag(flagOfCountry(cc), nameB(countryName(cc)))}${SEP}באיזו שנה?`, hint: 'רשות - השנה מסדרת את הרשימה.', search: true, searchHint: 'חיפוש שנה',
    options: [{ v: '-', text: 'בלי שנה', html: 'בלי שנה' }, ...ys] }, y => cvMark(cc, y && y !== '-' ? Number(y) : null)); }
function cvMark(cc, y) { if (!countryName(cc)) return; STATE.countries = { ...cvMine(), [cc]: y ? { y } : {} }; persist();
  showUndoToast(`${countryName(cc)}${y ? ' ' + y : ''} נוספה למדינות שביקרנו`); }
act('cv.unmark', c => { const cc = c.v, m = { ...cvMine() }; if (!m[cc]) return 'quiet'; delete m[cc]; STATE.countries = m; closeSheet(); persist();
  showUndoToast(`${countryName(cc)} הוסרה מהמדינות שביקרנו`); });

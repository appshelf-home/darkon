// ================= 📚 discoveries - what's around here (4.25.0) =================
// What is around: Wikipedia articles with a location (📚, Hebrew when there is one, English otherwise) in a wide radius,
// and small sights from OpenStreetMap (🏛️ statues, memorials, viewpoints, fountains, historic buildings) in a small one.
// Businesses only through a Google Maps link. A switch per device that stays on; data loads only on "🔄 חיפוש באזור הזה".
// Everything found is kept on the device (Cache API) for use without a network; images only for discoveries opened,
// capped at ~20MB. What is already one of my places gets no pin of its own: "✓ כבר ביעד" in the list and a Wikipedia
// link in its details. Adding opens the place editor prefilled; the layer is chosen only when it is clear.
const DISC = { items: {}, searches: [], imgs: [], loaded: false };
const DISC_CACHE = REG_BY.disc.where.cache[0], DISC_IMG_CACHE = REG_BY.disc.where.cache[1], DISC_DOC = 'https://darkon.local/disc-v1.json', DISC_IMG_MAX = 20e6, DISC_ITEMS_MAX = 6000;
const DISC_MAPS = {}; // containerId -> { map, ctx, markers, last: {lat,lng,r}, busy }
const DISC_LAST = {}; // 10.11.0: containerId -> the area last searched there, kept when its map is disposed (the next map of that container starts from it)
const OSM_KIND = { artwork: 'יצירת אמנות', viewpoint: 'נקודת תצפית', attraction: 'אטרקציה', memorial: 'אנדרטה או לוח זיכרון', monument: 'אנדרטה', ruins: 'חורבות',
  castle: 'טירה', building: 'מבנה היסטורי', archaeological_site: 'אתר ארכאולוגי', wayside_shrine: 'מקדש קטן', wayside_cross: 'צלב דרכים', city_gate: 'שער עיר', fort: 'מבצר', tomb: 'קבר',
  fountain: 'מזרקה', tower: 'מגדל', lighthouse: 'מגדלור', church: 'כנסייה', manor: 'אחוזה', palace: 'ארמון' };
function discOn() { return !!DEV.disc; }
function setDiscOn(v) { devSet({ disc: !!v }); }
async function discLoad() {
  if (DISC.loaded) return;
  try { const c = await regCache(DISC_CACHE), r = await c.match(DISC_DOC); if (r) { const j = await r.json(); DISC.items = j.items || {}; DISC.searches = j.searches || []; DISC.imgs = j.imgs || []; } } catch (e) {}
  DISC.loaded = true; Object.keys(DISC_MAPS).forEach(discDraw);
}
let _discSaveT = 0;
function discSave() { clearTimeout(_discSaveT); _discSaveT = setTimeout(async () => {
  const ks = Object.keys(DISC.items); if (ks.length > DISC_ITEMS_MAX) ks.sort((a, b) => DISC.items[a].at - DISC.items[b].at).slice(0, ks.length - DISC_ITEMS_MAX).forEach(k => delete DISC.items[k]);
  DISC.searches = DISC.searches.slice(-400);
  try { const c = await regCache(DISC_CACHE); await c.put(DISC_DOC, new Response(JSON.stringify({ items: DISC.items, searches: DISC.searches, imgs: DISC.imgs }), { headers: { 'Content-Type': 'application/json' } })); } catch (e) {} }, 400); }
async function discKeepImg(url) { // only for a discovery that was opened; the oldest go first above the cap
  if (!url || !navigator.onLine || DISC.imgs.some(x => x.u === url)) return;
  try { const rr = await svcAsk('pointImage', { key: url, prio: 'screen', build: () => ({ url, init: { mode: 'cors' }, as: 'resp' }), parse: d => d }); if (rr.kind !== 'ok') return; // 7.1.0: through the client (ויקימדיה)
    const r = rr.value, c = await regCache(DISC_IMG_CACHE), b = await r.clone().blob(); await c.put(url, r);
    DISC.imgs.push({ u: url, s: b.size, at: Date.now() }); let tot = DISC.imgs.reduce((a, x) => a + x.s, 0);
    while (tot > DISC_IMG_MAX && DISC.imgs.length) { const o = DISC.imgs.shift(); tot -= o.s; c.delete(o.u); }
    discSave(); } catch (e) {}
}
function discNorm(t) { return String(t || '').toLowerCase().replace(/\s*\(.*$/, '').replace(/[״"'׳,.\-–]/g, ' ').replace(/\s+/g, ' ').trim(); }
function discExisting(it) { // one of my places (any destination of this trip, or a trip place) is the same thing
  const n = discNorm(it.title);
  return POINTS.find(p => { if (p.src && p.src.url && it.url && p.src.url === it.url) return true; if (p.src && p.src.key === it.k) return true;
    const c = routeCoordOf(p); if (!c || distanceKm(c, it) > 0.15) return false; const m = discNorm(p.name); return m.length > 2 && n.length > 2 && (m.includes(n) || n.includes(m)); }) || null;
}
// 4.26.0: in the draft, a discovery that is already one of the draft's places (or one I added to it)
function discInDraft(it) {
  if (!DRAFT) return null; const n = discNorm(it.title);
  return draftItems(DRAFT).find(x => { const p = x.p; if (p.src && ((p.src.key && p.src.key === it.k) || (it.url && p.src.url === it.url))) return true;
    const c = draftCoord(p); if (!c || distanceKm(c, it) > 0.15) return false; const m = discNorm(p.name); return m.length > 2 && n.length > 2 && (m.includes(n) || n.includes(m)); }) || null;
}
function discHave(it, st) { return discExisting(it) || (st && st.ctx === 'draft' ? discInDraft(it) : null); }
function discWikiUrlFor(p) { if (p.src && p.src.url) return p.src.url; const it = Object.values(DISC.items).find(x => x.url && discExisting(x) === p); return it ? it.url : ''; }
async function discWiki(c, r) {
  const q = (lang, extra) => `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&origin=*&generator=geosearch&ggscoord=${c.lat.toFixed(5)}%7C${c.lng.toFixed(5)}&ggsradius=${r}&ggslimit=50&prop=coordinates%7Cpageimages%7Cdescription${extra}&piprop=thumbnail%7Cname&pithumbsize=200&pilimit=50&pilicense=free&colimit=50`; // legal-credits (C5): free pictures only, said explicitly; the file's name for its credit
  const get = async u => { const r = await svcAsk('discWiki', { build: () => ({ url: u }), parse: j => { if (!j || typeof j !== 'object' || j.error) throw new Error('answer'); return Object.values((j.query && j.query.pages) || {}); } }); return r.kind === 'ok' ? r.value : null; }; // 7.1.0: through the client
  const [he, en] = await Promise.all([get(q('he', '')), get(q('en', '%7Clanglinks&lllang=he&lllimit=50'))]);
  if (he === null && en === null) return null;
  const out = [], heTitles = new Set((he || []).map(p => p.title)), now = Date.now(), url = (l, t) => `https://${l}.m.wikipedia.org/wiki/${encodeURIComponent(t.replace(/ /g, '_'))}`;
  const one = (p, lang, title, fromEn) => { const co = p.coordinates && p.coordinates[0]; if (!co) return;
    out.push({ k: `w:${lang}:${title}`, src: 'wiki', lang, title, url: url(lang, title), lat: co.lat, lng: co.lon, desc: p.description || '', thumb: p.thumbnail ? p.thumbnail.source : '', img: p.thumbnail && p.pageimage ? p.pageimage : '', at: now, enTitle: fromEn ? p.title : '' }); };
  (he || []).forEach(p => one(p, 'he', p.title));
  (en || []).forEach(p => { const ll = p.langlinks && p.langlinks[0] && p.langlinks[0]['*']; if (ll) { if (!heTitles.has(ll)) one(p, 'he', ll, true); } else one(p, 'en', p.title, true); });
  return out;
}
async function discOsm(c, r) {
  const a = `(around:${r},${c.lat.toFixed(5)},${c.lng.toFixed(5)})`;
  const ql = `[out:json][timeout:15];(nwr${a}[tourism~"^(artwork|viewpoint|attraction)$"][name];nwr${a}[historic~"^(memorial|monument|ruins|castle|building|archaeological_site|wayside_shrine|wayside_cross|city_gate|fort|tomb|church|manor|palace)$"][name];nwr${a}[amenity=fountain][name];nwr${a}[man_made~"^(tower|lighthouse)$"][name][tourism];);out center 120;`;
  { const r = await svcAsk('discOsm', { build: prov => ({ url: OVERPASS_URL[prov], init: { method: 'POST', body: 'data=' + encodeURIComponent(ql), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }, ms: 30000 }), parse: overpassParse }); // 7.1.0: three servers in turn (ש5)
    if (r.kind !== 'ok') return null; const j = r.value, now = Date.now();
    return (j.elements || []).map(e => { const t = e.tags || {}, lat = e.lat != null ? e.lat : e.center && e.center.lat, lng = e.lon != null ? e.lon : e.center && e.center.lon; if (lat == null) return null;
      const kind = t.tourism || t.historic || (t.amenity === 'fountain' ? 'fountain' : '') || t.man_made || '';
      return { k: `o:${e.type}:${e.id}`, src: 'osm', title: t['name:he'] || t.name, lat, lng, kind, desc: [OSM_KIND[kind] || '', t.artist_name ? 'אמן: ' + t.artist_name : '', t.start_date ? 'משנת ' + t.start_date : ''].filter(Boolean).join(SEP), wp: t.wikipedia || '', osmUrl: `https://www.openstreetmap.org/${e.type}/${e.id}`, at: now }; }).filter(Boolean);
  }
}
async function discSearch(hostId) {
  const st = DISC_MAPS[hostId]; if (!st || st.busy) return; const map = st.map;
  if (svcNetDown()) { showToast(SVC_MSG.offline + '. מוצג מה שכבר נשמר במכשיר.'); return; }
  const ce = map.getCenter(), c = { lat: ce.lat, lng: ce.lng }, b = map.getBounds && map.getBounds();
  let r = 3000; try { r = Math.round(distanceKm(c, { lat: b.getNorth(), lng: b.getEast() }) * 1000); } catch (e) {}
  r = Math.max(400, Math.min(10000, r || 3000));
  st.busy = true; discBar(hostId);
  const [w, o] = await Promise.all([discWiki(c, r), discOsm(c, Math.min(r, 1000))]);
  st.busy = false;
  if (w === null && o === null) { discBar(hostId); showToast(svcNetDown() ? SVC_MSG.offline : SVC_MSG.busy); return; }
  const wTitles = new Set((w || []).map(x => discNorm(x.title)).concat((w || []).map(x => discNorm(x.enTitle)).filter(Boolean)));
  (w || []).forEach(it => { const old = DISC.items[it.k]; DISC.items[it.k] = { ...old, ...it, extract: old && old.extract }; });
  (o || []).forEach(it => { const wp = it.wp ? discNorm(it.wp.replace(/^[a-z]+:/, '')) : '';
    if ((wp && wTitles.has(wp)) || (w || []).some(x => distanceKm(x, it) < 0.1 && discNorm(x.title) === discNorm(it.title))) return; DISC.items[it.k] = it; });
  DISC.searches.push({ lat: c.lat, lng: c.lng, r, at: Date.now() }); st.last = { lat: c.lat, lng: c.lng, r };
  discSave(); Object.keys(DISC_MAPS).forEach(discDraw);
  const n = discInView(hostId).filter(x => !discHave(x, st)).length;
  showToast(n ? `נמצאו ${n} דברים מעניינים כאן` : 'לא נמצא כאן משהו חדש');
}
function discInView(hostId) { const st = DISC_MAPS[hostId]; if (!st) return []; let b = null; try { b = st.map.getBounds().pad(0.15); } catch (e) {}
  return Object.values(DISC.items).filter(x => !b || !b.contains || b.contains([x.lat, x.lng])); }
function discCovered(hostId) { const st = DISC_MAPS[hostId]; if (!st) return false; const ce = st.map.getCenter(), c = { lat: ce.lat, lng: ce.lng };
  return DISC.searches.some(s => distanceKm(c, s) * 1000 < s.r * 0.6); }
function discAttach(hostId, map, ctx, hostEl) {
  const host = hostEl || document.getElementById(hostId); if (!host || !map) return;
  const old = DISC_MAPS[hostId]; if (old && old.map === map) return;
  DISC_MAPS[hostId] = { map, ctx, markers: [], last: old ? old.last : DISC_LAST[hostId], busy: false, host };
  let btn = host.querySelector(':scope > .disc-btn');
  if (!btn) { btn = document.createElement('button'); btn.type = 'button'; btn.className = 'disc-btn'; btn.innerHTML = msi('auto_stories'); btn.title = 'מה יש כאן'; btn.setAttribute('aria-label', 'מה יש כאן'); btn.dataset.act = 'disc.toggle'; host.appendChild(btn); mapCtl(btn); }
  btn.setAttribute('aria-pressed', String(discOn()));
  map.on('moveend', () => { if (DISC_MAPS[hostId] && DISC_MAPS[hostId].map === map) discDraw(hostId); });
  if (!DISC.loaded) discLoad(); else discDraw(hostId);
}
const discHostOf = el => { const h = el.closest('.disc-bar, .disc-btn').parentElement; return Object.keys(DISC_MAPS).find(k => DISC_MAPS[k].host === h); };
act('disc.toggle', c => { const hostId = discHostOf(c.el), on = !discOn(); setDiscOn(on); document.querySelectorAll('.disc-btn').forEach(x => x.setAttribute('aria-pressed', String(on)));
  Object.keys(DISC_MAPS).forEach(discDraw);
  if (on) { if (!discCovered(hostId)) discSearch(hostId); else showToast('מה יש כאן: מוצג מה שנשמר. "חיפוש באזור הזה" מעדכן.'); } else showToast('מה יש כאן כבוי'); return 'quiet'; });
act('disc.search', c => { discSearch(discHostOf(c.el)); return 'quiet'; });
act('disc.list', c => openDiscList(discHostOf(c.el)));
function discBar(hostId) {
  const st = DISC_MAPS[hostId]; if (!st) return; const host = st.host; let bar = host.querySelector(':scope > .disc-bar');
  if (!discOn()) { if (bar) bar.remove(); return; }
  if (!bar) { bar = document.createElement('div'); bar.className = 'disc-bar'; host.appendChild(bar); mapCtl(bar); }
  const n = discInView(hostId).length, moved = !discCovered(hostId) || (st.last && distanceKm(st.map.getCenter(), st.last) * 1000 > st.last.r * 0.6);
  // 10.2.0 (design-2): the mode banner in the discovery's violet - the open book, "מה יש כאן · N מקומות", ⓘ, the list and ✕ to end; the search as a chip under it
  bar.innerHTML = `<div class="disc-mode">${msi('auto_stories', { size: 22 })}<b>מה יש כאן${SEP}${n}\u00A0מקומות</b>${tipI('disc.mode')}${n && st.ctx !== 'edit' ? `<button type="button" class="disc-ic" data-act="disc.list" aria-label="הרשימה" title="הרשימה">${msi('list')}</button>` : ''}<button type="button" class="disc-ic" data-act="disc.toggle" aria-label="סיום" title="סיום">${msi('close')}</button></div>${st.busy ? '<button type="button" class="go" disabled>מחפש באזור…</button>' : (moved || !n ? `<button type="button" class="go" data-act="disc.search">${msi('search', { size: 18 })}חיפוש באזור הזה</button>` : '')}`;
}
function discDraw(hostId) {
  const st = DISC_MAPS[hostId]; if (!st) return; const map = st.map;
  if (st.host && !st.host.isConnected) { delete DISC_MAPS[hostId]; return; }
  st.markers.forEach(m => { try { map.removeLayer(m); } catch (e) {} }); st.markers = [];
  { const cs = MAPS[hostId] && MAPS[hostId].clu; if (cs) [...cs.items.keys()].filter(k => k.startsWith('disc:')).forEach(k => cs.items.delete(k)); }
  discBar(hostId); if (!discOn() || !DISC.loaded) return;
  discInView(hostId).filter(it => !discHave(it, st)).slice(0, 300).forEach(it => {
    const m = L.marker([it.lat, it.lng], { icon: L.divIcon({ className: '', html: `<div class="disc-pin ${it.src === 'osm' ? 'o' : 'w'}" title="${escH(it.title)}">${msi('auto_stories', { size: 16 })}</div>`, iconSize: [26, 26], iconAnchor: [13, 13] }), zIndexOffset: -200 }).addTo(map);
    m.on('click', e => { if (e && e.originalEvent && L.DomEvent) L.DomEvent.stopPropagation(e); if (measActiveOn(hostId) && MEAS.mode === 'ruler') { measAddPoint({ lat: it.lat, lng: it.lng }, it.title); return; } discTap(hostId, it); }); st.markers.push(m); cluItem(hostId, 'disc:' + (it.key || it.title), m, 'disc'); });
}
function discTap(hostId, it) {
  const st = DISC_MAPS[hostId]; if (!st) return;
  if (st.ctx === 'edit') { // the spot comes under the pin in the middle (or, with "רק לחיצה", the pin goes to it)
    const ll = L.latLng ? L.latLng(it.lat, it.lng) : { lat: it.lat, lng: it.lng }; st.map.setView([it.lat, it.lng], st.map.getZoom(), { animate: false }); st.map.fire('dragend'); st.map.fire('click', { latlng: ll }); showToast(SY.place + ' ' + it.title); return; }
  openDiscCard(hostId, it);
}
function discFromHere(it, st) { const me = userPos && Date.now() - (_selfAt || 0) < 30 * 6e4 ? userPos : null;
  if (me) return fmtKm(distanceKm(me, it)) + ' ממך'; const c = st.map.getCenter(); return fmtKm(distanceKm({ lat: c.lat, lng: c.lng }, it)) + ' ממרכז המפה'; }
async function discExtract(it) { if (it.src !== 'wiki' || it.extract != null) return; // 7.1.0: through the client; offline - what is kept
  const r = await svcAsk('discWiki', { key: 'x:' + it.k, build: () => ({ url: `https://${it.lang}.wikipedia.org/w/api.php?action=query&format=json&origin=*&prop=extracts&exintro=1&explaintext=1&exsentences=3&titles=${encodeURIComponent(it.title)}` }),
    parse: j => { if (!j || typeof j !== 'object' || j.error) throw new Error('answer'); const pg = Object.values((j.query && j.query.pages) || {})[0]; return (pg && pg.extract || '').trim(); } });
  if (r.kind !== 'ok') return; it.extract = r.value; if (DISC.items[it.k]) DISC.items[it.k].extract = it.extract; discSave(); }
act('disc.addCard', c => { const box = c.el.closest('.map-float'), it = box._disc, hostId = box._discHost, st = DISC_MAPS[hostId]; closeFloatCard(hostId); if (st && st.ctx === 'draft') draftAddFromDisc(it); else discAdd(it); });
// legal-credits (C5, C14): a discovery's picture shows its Commons author and licence (asked when its card opens; a discovery kept before 11.40.0
// asks its file's name first); a picture whose licence is not known to be free is dropped. Wikipedia's text carries its licence (svcCredit).
async function discCredit(it) { if (it.src !== 'wiki' || !it.thumb || it.cr !== undefined || svcNetDown()) return false;
  try { let f = it.img; if (!f) { const pg = (await picWikiApi(it.lang || 'he', 'titles=' + encodeURIComponent(it.title)))[0]; f = pg && pg.pageimage; }
    const cr = f ? await wikiFileCredit(it.lang || 'he', f) : null; it.cr = cr; it.img = f || ''; if (!cr) it.thumb = '';
    if (DISC.items[it.k]) Object.assign(DISC.items[it.k], { cr: it.cr, img: it.img, thumb: it.thumb }); discSave(); return true; } catch (e) { return false; } }
// legal-server (11.41.0; review of legal-credits Q1, finding 1): a Wikipedia picture shows only once its author and licence are known (it.cr) -
// until discCredit brings them (no network, a failed ask) the discovery shows no picture, never one credited "Wikimedia Commons" alone
function discThumb(it) { return it.src === 'wiki' ? (it.cr ? it.thumb || '' : '') : it.thumb || ''; }
// legal-server (finding 5): no author's name on the file - the file page instead of "יוצר לא ידוע"
function discCrHTML(it) { const c = it.cr, esc = escH; return c ? `<span class="disc-pcr">תמונה: ${c.a ? `<bdi>${esc(c.a)}</bdi>` : `<a href="${esc(c.fp)}" target="_blank" rel="noopener">דף הקובץ</a>`}${SEP}${c.lu ? `<a href="${esc(c.lu)}" target="_blank" rel="noopener"><bdi>${esc(c.lic)}</bdi></a>` : `<bdi>${esc(c.lic)}</bdi>`}${SEP}<a href="${esc(c.fp)}" target="_blank" rel="noopener">Wikimedia Commons</a></span>` : ''; }
function discCreditsHTML(it) { return it.src === 'wiki' ? `<small class="cd-cred disc-cred" data-dcr>${svcCredit('wikimedia')}${it.cr ? SEP + discCrHTML(it) : ''}</small>` : ''; }
function openDiscCard(hostId, it) {
  const st = DISC_MAPS[hostId], esc = escH;
  const when = `נשמר ב-${tmFmt('dayN', tmPhoneDate(it.at))}`;
  const html = cdCard({ cls: 'disc-fc', lead: discThumb(it) ? `<span class="cd-lead disc"><img class="disc-th" src="${esc(discThumb(it))}" alt="" loading="lazy" onerror="this.remove()">${msi('auto_stories', { size: 18 })}</span>` : leadHTML('disc', msi('auto_stories', { size: 18 }), ''), // 10.2.0 (design-2): the same card - its thumbnail in the circle
    name: esc(it.title), tags: [cdMeta([symTip('sym.disc.' + it.src, it.src === 'wiki' ? 'ויקיפדיה' + (it.lang === 'en' ? ' (אנגלית)' : '') : 'OpenStreetMap'), discFromHere(it, st), !navigator.onLine ? when : ''])],
    desc: `<span class="mc-desc" data-dx>${esc(it.extract || it.desc || '')}</span>${discCreditsHTML(it)}`,
    acts: `<div class="tl-acts mc-acts">${it.src === 'wiki' ? linkBtn('tl-act', esc(it.url), actIc('menu_book'), 'לערך') : linkBtn('tl-act', esc(googleInfoUrl(it.title, it.lat + ',' + it.lng)), actIc('travel_explore'), 'חיפוש ב-Google')}${linkBtn('tl-act', navUrl(it.lat.toFixed(6) + ',' + it.lng.toFixed(6)), actIc('navigation'), 'ניווט')}<button type="button" class="tl-act" data-act="disc.addCard" aria-label="${st.ctx === 'draft' ? 'לטיוטה' : 'הוספה'}" title="${st.ctx === 'draft' ? 'לטיוטה' : 'הוספה'}">${actIc('add_circle')}</button></div>` });
  const box = openFloatCard(hostId, html, null, null, () => openDiscSheet(hostId, it)); if (box) { box._disc = it; box._discHost = hostId; } // 4.33.0: tap or swipe up - the details, like every other card
  discKeepImg(discThumb(it));
  if (it.src === 'wiki' && it.extract == null) discExtract(it).then(() => { const host = document.getElementById(hostId), d = host && host.querySelector('.map-float [data-dx]'); if (d && it.extract) d.textContent = it.extract; });
  discCredit(it).then(ch => { if (!ch) return; const host = document.getElementById(hostId), box2 = host && host.querySelector('.map-float'); if (!box2 || box2._disc !== it) return;
    const d = box2.querySelector('[data-dcr]'); if (d) d.outerHTML = discCreditsHTML(it);
    if (!discThumb(it)) { const im = box2.querySelector('.disc-th'); if (im) im.remove(); } }); // legal-server: a picture found not free leaves; one whose credit just came shows from the card's next opening
}
// 4.33.0: the details of a discovery in a dialog - a bigger picture, the whole summary, and the same actions
// 5.7.0 (stage 4, decision 8): a discovery opens the one details window, as a candidate - "＋ הוספה" instead of the
// scheduling line, only 🧭 🔍 in the actions, its picture and summary under "מה זה"
function openDiscSheet(hostId, it) {
  const st = DISC_MAPS[hostId]; if (!st) return;
  openCandWin({ key: 'disc:' + (it.id || it.title), lead: leadHTML('disc', msi('auto_stories', { size: 18 }), ''), name: it.title,
    pick: { label: '＋ ' + (st.ctx === 'draft' ? 'לטיוטה' : 'הוספה'), on: () => { closeSheet(); closeFloatCard(hostId); if (st.ctx === 'draft') draftAddFromDisc(it); else discAdd(it); } },
    small: [it.src === 'wiki' ? 'ויקיפדיה' + (it.lang === 'en' ? ' (אנגלית)' : '') : 'OpenStreetMap', discFromHere(it, st), it.desc && it.src === 'osm' ? it.desc : ''],
    nav: navUrl(it.lat.toFixed(6) + ',' + it.lng.toFixed(6)), search: it.src === 'wiki' ? it.url : googleInfoUrl(it.title, it.lat + ',' + it.lng), searchLabel: it.src === 'wiki' ? 'הערך בוויקיפדיה' : 'חיפוש ב-Google',
    what: () => `${discThumb(it) ? `<img class="disc-big" src="${_escH(discThumb(it))}" alt="" onerror="this.remove()">` : ''}${(it.extract || (it.src === 'wiki' ? '' : it.desc)) ? `<p class="iw-desc open">${_escH(it.extract || it.desc)}</p>` : (it.src === 'wiki' && navigator.onLine ? '<p class="sh-hint"><span class="spin" aria-hidden="true"></span>טוען את התקציר…</p>' : '')}${it.src === 'wiki' ? `<p class="sh-hint">${discCreditsHTML(it)}</p>` : ''}`,
    links: `${it.src === 'wiki' ? lkBtn('menu_book', 'לערך', `href="${_escH(it.url)}"`) : ''}${lkBtn('streetview', 'Street View', `href="${streetViewUrl({ lat: it.lat, lng: it.lng })}"`)}` });
  if (it.src === 'wiki' && it.extract == null) discExtract(it).then(() => { const t = layerTop(); if (t && t.cand && t.cand.name === it.title) winRedraw(); });
  discCredit(it).then(ch => { const t = layerTop(); if (ch && t && t.cand && t.cand.name === it.title) winRedraw(); });
}
// the layer: chosen only when the kind is clear and the trip's destinations have exactly one layer of that base type
function discType(it) {
  if (it.src === 'osm') return it.kind === 'viewpoint' ? 'nature' : 'attractions';
  const t = (it.desc || '') + ' ' + (it.title || '');
  if (/מסעד|restaurant|בית קפה|\bcaf[eé]\b|bakery|מאפי/i.test(t)) return 'food';
  if (/\bbar\b|\bpub\b|פאב|בר יין/i.test(t)) return 'drink';
  if (/שוק |market|קניון|\bmall\b|shopping/i.test(t)) return 'shopping';
  if (/פארק|\bpark\b|garden|גן |גנים|\blake\b|אגם|mountain|\bhill\b|\bהר\b|river|נהר|island|forest|יער|beach|חוף|waterfall|מפל|nature reserve|שמורת/i.test(t)) return 'nature';
  if (/מוזיאון|museum|church|כנסי|cathedral|קתדרל|basilica|בזיליק|synagogue|בית כנסת|mosque|מסגד|castle|טירה|palace|ארמון|monument|אנדרט|memorial|bridge|גשר|statue|פסל|tower|מגדל|theatre|theater|תיאטרון|opera|אופרה|gallery|גלריה|zoo|גן חיות|baths|מרחצ|fortress|מבצר|monastery|מנזר|temple|מקדש/i.test(t)) return 'attractions';
  return '';
}
function discAdd(it) {
  const ds = selDests(), near = ds.slice().sort((a, b) => { const ca = DESTS[a] && DESTS[a].meta.center, cb = DESTS[b] && DESTS[b].meta.center; return (ca ? distanceKm({ lat: ca[0], lng: ca[1] }, it) : 1e9) - (cb ? distanceKm({ lat: cb[0], lng: cb[1] }, it) : 1e9); });
  const lays = LAYER_DEFS.filter(l => !l.hidden && near.includes(l.dest)), ty = discType(it);
  const ofType = t => lays.filter(l => l.type === t).sort((a, b) => near.indexOf(a.dest) - near.indexOf(b.dest));
  const same = ty ? ofType(ty) : [], clear = same.length === 1 || (same.length > 1 && same[0].dest !== same[1].dest) ? same[0] : null;
  const maybe = clear ? [] : (same.length ? same : [].concat(ofType('attractions').slice(0, 1), ofType('nature').slice(0, 1), ofType('food').slice(0, 1))).slice(0, 3).map(l => l.id);
  const desc = it.extract || it.desc || '';
  openPlaceEditor({ name: it.title, coord: { lat: +it.lat.toFixed(6), lng: +it.lng.toFixed(6) }, desc, layer: clear ? clear.id : null, noGuess: true, maybe,
    src: { type: it.src === 'wiki' ? 'wikipedia' : 'osm', key: it.k, url: it.url || it.osmUrl || '', dh: textHash(desc) } });
}
act('disc.row', c => { const t = layerTop(), r = t.discRows[+c.v], hostId = t.discHost, st = DISC_MAPS[hostId]; closeSheet();
  setTimeout(() => { st.map.setView([r.it.lat, r.it.lng], Math.max(st.map.getZoom(), 17)); if (r.have && r.have.scope) { if (draftView.openCard) draftView.openCard(r.have); } else if (r.have) showMapCard(hostId, null, r.have); else openDiscCard(hostId, r.it); }, 120); });
act('disc.rowAdd', c => { const t = layerTop(), r = t.discRows[+c.v], st = DISC_MAPS[t.discHost]; closeSheet(); setTimeout(() => st.ctx === 'draft' ? draftAddFromDisc(r.it) : discAdd(r.it), 120); });
function openDiscList(hostId) { layerNote(openDiscList, arguments);
  const st = DISC_MAPS[hostId]; if (!st) return; const sheet = document.getElementById('sheet'), esc = escH;
  const ce = st.map.getCenter(), c = { lat: ce.lat, lng: ce.lng };
  const rows = discInView(hostId).map(it => ({ it, d: distanceKm(c, it) * 1000, have: discHave(it, st) })).sort((a, b) => a.d - b.d);
  const g = (q, l) => `<a class="chip" href="https://www.google.com/maps/search/${encodeURIComponent(q)}/@${c.lat.toFixed(5)},${c.lng.toFixed(5)},16z" target="_blank" rel="noopener">${l}</a>`;
  sheet.innerHTML = `${fmHead(`📚 מה יש כאן${SEP}${rows.length}`, 'dlClose')}
    <div class="sh-hint">לפי המרחק ממרכז המפה.</div>
    <div class="sh-hint dl-gh">ב-Google Maps</div><div class="dl-g">${g('restaurants', msi('restaurant', { size: 18 }) + 'מסעדות')}${g('cafe', msi('local_cafe', { size: 18 }) + 'קפה')}${g('supermarket', msi('local_grocery_store', { size: 18 }) + 'סופר')}${g('pharmacy', msi('local_pharmacy', { size: 18 }) + 'בית מרקחת')}</div>
    <div class="dl-list">${rows.map((r, i) => `<div class="dl-row"><button type="button" class="dl-name" data-act="disc.row" data-v="${i}"><span class="dl-th"${discThumb(r.it) ? ` style="background-image:url('${esc(discThumb(r.it)).replace(/'/g, '%27')}')"` : ''}>${discThumb(r.it) ? '' : msi(r.it.src === 'osm' ? 'location_on' : 'auto_stories', { size: 20 })}</span><span class="dl-tx"><b dir="auto">${esc(r.it.title)}</b><small>${r.it.src === 'osm' ? 'OpenStreetMap' : 'ויקיפדיה'}${SEP}${fmtKm(r.d / 1000)}</small></span></button>`
      + `<a class="dl-ib" href="https://www.google.com/maps/dir/?api=1&destination=${(+r.it.lat).toFixed(6)},${(+r.it.lng).toFixed(6)}" target="_blank" rel="noopener" aria-label="ניווט" title="ניווט">${msi('navigation', { size: 20 })}</a>`
      + (r.have ? `<span class="dl-have">${msi('check', { size: 16 })} ${r.have.scope ? 'בטיוטה' : 'כבר ביעד'}</span>` : `<button type="button" class="dl-ib dl-add" data-act="disc.rowAdd" data-v="${i}" aria-label="${st.ctx === 'draft' ? 'להוסיף לטיוטה' : 'להוסיף'}" title="${st.ctx === 'draft' ? 'להוסיף לטיוטה' : 'להוסיף'}">${msi('add_circle', { size: 22 })}</button>`) + '</div>').join('') || '<div class="empty">עוד לא נמצא כאן כלום. ' + msi('refresh', { cls: 'msi-in' }) + ' חיפוש באזור הזה על המפה.</div>'}</div>`; // 10.5.0 (design-4 part 2, look.md "Maps"): rows - the thumbnail, the name, source · distance, navigate and add as icons
  
  showSheetBackdrop('openDiscList'); Object.assign(layerTop(), { discRows: rows, discHost: hostId });
 
}

// 4.26.0: ＋ from 📚 in the draft. Opens prefilled (name, point, description), on the destination of the draft nearest to it;
// the layer only when it is clear (one layer of that kind in that destination), otherwise the field stands out with
// "אולי:" and ＋ שכבה חדשה, and saving waits for a choice. Everything stays in the draft until approval.
function draftAddFromDisc(it) {
  if (!DRAFT) return; const ts = draftTargetDests(DRAFT);
  if (!ts.length) { showToast('אין בטיוטה יעד שאפשר להוסיף אליו'); return; }
  const dist = t => { const c = t.dp && t.dp.meta && t.dp.meta.center; return c ? distanceKm({ lat: c[0], lng: c[1] }, it) : 1e9; };
  const near = ts.slice().sort((a, b) => dist(a) - dist(b))[0], desc = it.extract || it.desc || '';
  openPlaceEditor({ draftAdd: { name: it.title, manualCoord: { lat: +(+it.lat).toFixed(6), lng: +(+it.lng).toFixed(6) }, coordSource: it.src === 'wiki' ? 'Wikipedia' : 'OpenStreetMap', description: desc, dest: near.id, ty: discType(it),
    src: { type: it.src === 'wiki' ? 'wikipedia' : 'osm', key: it.k, url: it.url || it.osmUrl || '', dh: textHash(desc) } } });
}
function draftClearLayer(D, destId, ty) {
  const ls = draftDestLayers(D, destId), same = ty ? ls.filter(l => l.type === ty) : [];
  if (same.length === 1) return { clear: same[0], maybe: [] };
  const first = t => ls.filter(l => l.type === t).slice(0, 1);
  return { clear: null, maybe: (same.length ? same : [].concat(first('attractions'), first('nature'), first('food'))).slice(0, 3) };
}
function removeDraftAdd(key) {
  const D = DRAFT; if (!D) return; const a = draftAdds(D).find(x => x.key === key); if (!a) return;
  D.add = D.add.filter(x => x.key !== key); delete D.off[key]; saveDraft();
  showUndoToast(SY.del + ' נמחק מהטיוטה: ' + a.name);
}


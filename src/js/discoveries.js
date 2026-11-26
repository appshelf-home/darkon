// ================= 📚 discoveries - what's around here (4.25.0) =================
// diet-groups (11.62.0): DISC, DISC_MAPS, the switch, discAttach, discNorm / discExisting, the Wikipedia link, alongCan / alongBtnHTML and the draft's layer choice are in js/disc-door.js (main)
// What is around: Wikipedia articles with a location (📚, Hebrew when there is one, English otherwise) in a wide radius,
// and small sights from OpenStreetMap (🏛️ statues, memorials, viewpoints, fountains, historic buildings) in a small one.
// Businesses only through a Google Maps link. A switch per device that stays on; data loads only on "🔄 חיפוש באזור הזה".
// Everything found is kept on the device (Cache API) for use without a network; images only for discoveries opened,
// capped at ~20MB. What is already one of my places gets no pin of its own: "✓ כבר ביעד" in the list and a Wikipedia
// link in its details. Adding opens the place editor prefilled; the layer is chosen only when it is clear.
const OSM_KIND = { artwork: 'יצירת אמנות', viewpoint: 'נקודת תצפית', attraction: 'אטרקציה', memorial: 'אנדרטה או לוח זיכרון', monument: 'אנדרטה', ruins: 'חורבות',
  castle: 'טירה', building: 'מבנה היסטורי', archaeological_site: 'אתר ארכאולוגי', wayside_shrine: 'מקדש קטן', wayside_cross: 'צלב דרכים', city_gate: 'שער עיר', fort: 'מבצר', tomb: 'קבר',
  fountain: 'מזרקה', tower: 'מגדל', lighthouse: 'מגדלור', church: 'כנסייה', manor: 'אחוזה', palace: 'ארמון' };
async function discKeepImg(url) { // only for a discovery that was opened; the oldest go first above the cap
  if (!url || !svcOnline() || DISC.imgs.some(x => x.u === url)) return;
  try { const rr = await svcAsk('pointImage', { key: url, prio: 'screen', build: () => ({ url, init: { mode: 'cors' }, as: 'resp' }), parse: d => d }); if (rr.kind !== 'ok') return; // 7.1.0: through the client (ויקימדיה)
    const r = rr.value, c = await regCache(DISC_IMG_CACHE), b = await r.clone().blob(); if (!(await regCachePut(c, url, r))) return; // storage (Q6): a refusal for space gives the one message
    DISC.imgs.push({ u: url, s: b.size, at: Date.now() }); let tot = DISC.imgs.reduce((a, x) => a + x.s, 0);
    while (tot > DISC_IMG_MAX && DISC.imgs.length) { const o = DISC.imgs.shift(); tot -= o.s; c.delete(o.u); }
    discSave(); } catch (e) {}
}
// 4.26.0: in the draft, a discovery that is already one of the draft's places (or one I added to it)
function discInDraft(it) {
  if (!DRAFT) return null; const n = discNorm(it.title);
  return draftItems(DRAFT).find(x => { const p = x.p; if (p.src && ((p.src.key && p.src.key === it.k) || (it.url && p.src.url === it.url))) return true;
    const c = draftCoord(p); if (!c || distanceKm(c, it) > 0.15) return false; const m = discNorm(p.name); return m.length > 2 && n.length > 2 && (m.includes(n) || n.includes(m)); }) || null;
}
function discHave(it, st) { return discExisting(it) || (st && st.ctx === 'draft' ? discInDraft(it) : null); }
async function discWiki(c, r, alive) { // alive (limits-and-safety): "along the drive" stopped waiting - its requests not sent yet are dropped
  const q = (lang, extra) => `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&origin=*&generator=geosearch&ggscoord=${c.lat.toFixed(5)}%7C${c.lng.toFixed(5)}&ggsradius=${r}&ggslimit=50&prop=coordinates%7Cpageimages%7Cdescription${extra}&piprop=thumbnail%7Cname&pithumbsize=200&pilimit=50&pilicense=free&colimit=50`; // legal-credits (C5): free pictures only, said explicitly; the file's name for its credit
  const get = async u => { const r = await svcAsk('discWiki', { alive, build: () => ({ url: u }), parse: j => { if (!j || typeof j !== 'object' || j.error) throw new Error('answer'); return Object.values((j.query && j.query.pages) || {}); } }); return r.kind === 'ok' ? r.value : null; }; // 7.1.0: through the client
  const [he, en] = await Promise.all([get(q('he', '')), get(q('en', '%7Clanglinks&lllang=he&lllimit=50'))]);
  if (he === null && en === null) return null;
  const out = [], heTitles = new Set((he || []).map(p => p.title)), now = Date.now(), url = (l, t) => `https://${l}.m.wikipedia.org/wiki/${encodeURIComponent(t.replace(/ /g, '_'))}`;
  const one = (p, lang, title, fromEn) => { const co = p.coordinates && p.coordinates[0]; if (!co) return;
    out.push({ k: `w:${lang}:${title}`, src: 'wiki', lang, title, url: url(lang, title), lat: co.lat, lng: co.lon, desc: p.description || '', thumb: p.thumbnail ? p.thumbnail.source : '', img: p.thumbnail && p.pageimage ? p.pageimage : '', at: now, enTitle: fromEn ? p.title : '' }); };
  (he || []).forEach(p => one(p, 'he', p.title));
  (en || []).forEach(p => { const ll = p.langlinks && p.langlinks[0] && p.langlinks[0]['*']; if (ll) { if (!heTitles.has(ll)) one(p, 'he', ll, true); } else one(p, 'en', p.title, true); });
  return out;
}
async function discOsm(c, r, line, alive) { // along-drive: line - a stretch of the road (its points), one corridor query
  const a = `(around:${r},${(line || [c]).map(p => p.lat.toFixed(5) + ',' + p.lng.toFixed(5)).join(',')})`;
  const ql = `[out:json][timeout:15];(nwr${a}[tourism~"^(artwork|viewpoint|attraction)$"][name];nwr${a}[historic~"^(memorial|monument|ruins|castle|building|archaeological_site|wayside_shrine|wayside_cross|city_gate|fort|tomb|church|manor|palace)$"][name];nwr${a}[amenity=fountain][name];nwr${a}[man_made~"^(tower|lighthouse)$"][name][tourism];);out center 120;`;
  { const r = await svcAsk('discOsm', { alive, build: prov => ({ url: OVERPASS_URL[prov], init: { method: 'POST', body: 'data=' + encodeURIComponent(ql), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }, ms: 30000 }), parse: overpassParse }); // 7.1.0: three servers in turn (ש5)
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
  st.busy = false; if (st.wait) { st.wait.done(); st.wait = null; }
  if (w === null && o === null) { discBar(hostId); showToast(svcNetDown() ? SVC_MSG.offline : SVC_MSG.busy); return; }
  discMerge(w, o);
  DISC.searches.push({ lat: c.lat, lng: c.lng, r, at: Date.now() }); st.last = { lat: c.lat, lng: c.lng, r };
  discSave(); Object.keys(DISC_MAPS).forEach(discDraw);
  const n = discInView(hostId).filter(x => !discHave(x, st)).length;
  showToast(n ? `נמצאו ${n} דברים מעניינים כאן` : 'לא נמצא כאן משהו חדש');
}
// the answers kept, each once: Wikipedia's by its article, an OSM sight not when it is one of those articles (its wikipedia tag, or the same name within 100 m)
function discMerge(w, o) { const wTitles = new Set((w || []).map(x => discNorm(x.title)).concat((w || []).map(x => discNorm(x.enTitle)).filter(Boolean)));
  (w || []).forEach(it => { const old = DISC.items[it.k]; DISC.items[it.k] = { ...old, ...it, extract: old && old.extract }; });
  (o || []).forEach(it => { const wp = it.wp ? discNorm(it.wp.replace(/^[a-z]+:/, '')) : '';
    if ((wp && wTitles.has(wp)) || (w || []).some(x => distanceKm(x, it) < 0.1 && discNorm(x.title) === discNorm(it.title))) return; DISC.items[it.k] = it; }); }
// along-drive: with a drive's search on, the drive's corridor instead of the view
function discInView(hostId) { if (DISC_MAPS[hostId] && DISC_MAPS[hostId].along) return alongRows(hostId).map(r => r.it); const st = DISC_MAPS[hostId]; if (!st) return []; let b = null; try { b = st.map.getBounds().pad(0.15); } catch (e) {}
  return Object.values(DISC.items).filter(x => !b || !b.contains || b.contains([x.lat, x.lng])); }
function discCovered(hostId) { const st = DISC_MAPS[hostId]; if (!st) return false; const ce = st.map.getCenter(), c = { lat: ce.lat, lng: ce.lng };
  return DISC.searches.some(s => distanceKm(c, s) * 1000 < s.r * 0.6); }
const discHostOf = el => { const h = el.closest('.disc-bar, .disc-btn').parentElement; return Object.keys(DISC_MAPS).find(k => DISC_MAPS[k].host === h); };
act('disc.toggle', c => { const hostId = discHostOf(c.el), on = !discOn(); if (on && c.el.classList.contains('disc-btn') && discMenu(c.el, hostId)) return 'quiet'; // walk-time + along-drive: the 📚 menu
  Object.values(DISC_MAPS).forEach(x => { x.along = null; }); discSet(on);
  if (on) { if (!discCovered(hostId)) discSearch(hostId); else showToast('מה יש כאן: מוצג מה שנשמר. "חיפוש באזור הזה" מעדכן.'); } else showToast('מה יש כאן כבוי'); return 'quiet'; });
function discSet(on) { setDiscOn(on); document.querySelectorAll('.disc-btn').forEach(x => x.setAttribute('aria-pressed', String(on))); Object.keys(DISC_MAPS).forEach(discDraw); }
// walk-time (decisions 2026-11-24 · "מה במרחק הליכה", Q2) and along-drive (decisions 2026-11-23 · "📚 לאורך הדרך", Q1): 📚 (while off) opens one tools menu -
// "מה יש כאן" (as before), "מה במרחק הליכה" on a live map of the trip (map-tools.js, walkStart), and "לאורך הדרך" per drive on a driving day's map (alongMenuRows)
function discMenu(b, hostId) { if (!hostId) return false; const walk = typeof walkCan === 'function' && walkCan(hostId), along = alongMenuRows(hostId);
  if (!walk && !along) return false; const host = b.parentElement, old = host.querySelector(':scope > .disc-menu'); if (old) { old.remove(); return true; }
  const m = document.createElement('div'), net = svcNetDown(); m.className = 'ly-menu disc-menu'; m.setAttribute('role', 'menu');
  m.innerHTML = `<button type="button" role="menuitem" data-act="disc.here">${msi('auto_stories', { cls: 'ly-ic' })}<span class="ly-t"><b>מה יש כאן</b><small>באזור שעל המפה</small></span></button>`
    + (walk ? `<button type="button" role="menuitem" data-act="walk.menu">${msi('hiking', { cls: 'ly-ic' })}<span class="ly-t"><b>מה במרחק הליכה</b><small>${net ? 'צריך רשת' : 'נוגעים בנקודה במפה'}</small></span></button>` : '') + along;
  host.appendChild(m); mapCtl(m); setTimeout(() => touchAny('down', function off(ev) { if (!m.contains(ev.target) && !b.contains(ev.target)) { m.remove(); touchAny('down', off, false); } }), 0); return true; }
act('disc.here', c => { const m = c.el.closest('.disc-menu'), h = m.parentElement; m.remove(); const hostId = Object.keys(DISC_MAPS).find(k => DISC_MAPS[k].host === h);
  Object.values(DISC_MAPS).forEach(x => { x.along = null; }); discSet(true);
  if (hostId && !discCovered(hostId)) discSearch(hostId); else showToast('מה יש כאן: מוצג מה שנשמר. "חיפוש באזור הזה" מעדכן.'); return 'quiet'; });
act('disc.search', c => { discSearch(discHostOf(c.el)); return 'quiet'; });
act('disc.list', c => openDiscList(discHostOf(c.el)));
// wait-look (decisions 2026-11-23 · One "in progress" look, Q2): the search waits with the one "in progress" component over its map
// (state 2) - the bar under the mode banner, the stage line in the search chip's place, the map dimmed with the ring on the searched area
// (its middle); the banner stays clear (wait-keep). done() when the answers are in; a failure keeps its toast, the chip comes back
function discWait(hostId, bar) { const st = DISC_MAPS[hostId]; if (st.wait) st.wait.done(); let mp = null; try { mp = st.map.getContainer(); } catch (e) {}
  st.wait = waitOn(bar, { head: bar.querySelector(':scope > .disc-mode'), line: bar.querySelector(':scope > .disc-wait'), map: st.along ? null : mp, stage: st.along ? ALONG_WORDS : 'מחפשים באזור' });
  if (st.along && st.along.n) st.wait.progress(st.along.done, st.along.n); } // along-drive: the measured state - stretch N of M
function discBar(hostId) {
  const st = DISC_MAPS[hostId]; if (!st) return; const host = st.host; let bar = host.querySelector(':scope > .disc-bar');
  if (!discOn()) { if (st.wait) { st.wait.done(); st.wait = null; } if (bar) bar.remove(); return; }
  if (!bar) { bar = document.createElement('div'); bar.className = 'disc-bar wait-keep'; host.appendChild(bar); mapCtl(bar); }
  if (st.busy && st.wait && bar.querySelector(':scope > .wait-bar')) return; // waiting: the banner, the bar and the line stay as they are until the answer
  const n = discInView(hostId).length, moved = !discCovered(hostId) || (st.last && distanceKm(st.map.getCenter(), st.last) * 1000 > st.last.r * 0.6);
  // 10.2.0 (design-2): the mode banner in the discovery's violet - the open book, "מה יש כאן · N מקומות", ⓘ, the list and ✕ to end; the search as a chip under it
  bar.innerHTML = `<div class="disc-mode">${msi('auto_stories', { size: 22 })}<b${st.along ? ' class="t-wrap"' : ''}>${st.along ? 'לאורך הדרך' : 'מה יש כאן'}${SEP}${n}\u00A0מקומות</b>${tipI('disc.mode')}${n && st.ctx !== 'edit' ? `<button type="button" class="disc-ic" data-act="disc.list" aria-label="הרשימה" title="הרשימה">${msi('list')}</button>` : ''}<button type="button" class="disc-ic" data-act="disc.toggle" aria-label="סיום" title="סיום">${msi('close')}</button></div>${st.busy ? '<div class="disc-wait"></div>' : st.along ? '' : (moved || !n ? `<button type="button" class="go" data-act="disc.search">${msi('search', { size: 18 })}חיפוש באזור הזה</button>` : '')}`;
  if (st.busy) discWait(hostId, bar); // the search waits: the one "in progress" component (a redraw while it waits keeps it, above)
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
act('disc.addCard', c => { const box = c.el.closest('.map-float'), it = box._disc, hostId = box._discHost, st = DISC_MAPS[hostId]; closeFloatCard(hostId); if (st && st.ctx === 'draft') draftAddFromDisc(it); else discAdd(it, alongAft(hostId)); });
// legal-credits (C5, C14): a discovery's picture shows its Commons author and licence (asked when its card opens; a discovery kept before 11.40.0
// asks its file's name first); a picture whose licence is not known to be free is dropped. Wikipedia's text carries its licence (svcCredit).
async function discCredit(it) { if (it.src !== 'wiki' || !it.thumb || it.cr !== undefined || svcNetDown()) return false;
  try { let f = it.img; if (!f) { const pg = (await picWikiApi(it.lang || 'he', 'titles=' + encodeURIComponent(it.title)))[0]; f = pg && pg.pageimage; }
    const cr = f ? await wikiFileCredit(it.lang || 'he', f) : null; it.cr = cr; it.img = f || ''; if (!cr) it.thumb = '';
    if (DISC.items[it.k]) Object.assign(DISC.items[it.k], { cr: it.cr, img: it.img, thumb: it.thumb }); discSave(); return true; } catch (e) { return false; } }
// legal-server (11.41.0; review of legal-credits Q1, finding 1): a Wikipedia picture shows only once its author and licence are known (it.cr) -
// until discCredit brings them (no network, a failed ask) the discovery shows no picture, never one credited "Wikimedia Commons" alone
function discThumb(it) { return it.src === 'wiki' ? (it.cr ? it.thumb || '' : '') : it.thumb || ''; }
// one-way (11): a discovery's picture loads through the client (pointImage: the provider's count, gap and one at a time), never by the
// browser from an img element's own address - a kept picture (discKeepImg) from the phone first, as the service worker answered it before. The
// markup carries data-dimg (an img element) or data-dimgbg (a background) with the address; when the picture comes, each such element on the page
// gets it as a blob: address (kept for the session, so a window drawn again has it at once); a picture that does not come removes its
// img element (as its onerror did) and leaves a background empty (as a failed one was).
const DISC_BLOB = new Map(), DISC_BLOB_GO = new Map();
function discImgAttr(url) { const b = DISC_BLOB.get(url); if (b) return `src="${escH(b)}"`; discImgGet(url); return `data-dimg="${escH(url)}"`; }
function discImgBg(url) { const b = DISC_BLOB.get(url); if (b) return ` style="background-image:url('${escH(b)}')"`; discImgGet(url); return ` data-dimgbg="${escH(url)}"`; }
function discImgGet(url) { if (DISC_BLOB_GO.has(url)) return DISC_BLOB_GO.get(url);
  const go = (async () => { let blob = null;
    try { const c = await regCache(DISC_IMG_CACHE), hit = await c.match(url); if (hit) blob = await hit.blob(); } catch (e) {}
    if (!blob) { const rr = await svcAsk('pointImage', { key: url, prio: 'screen', build: () => ({ url, init: { mode: 'cors' }, as: 'resp' }), parse: d => d });
      if (rr.kind === 'ok') try { blob = await rr.value.blob(); } catch (e) {} }
    const b = blob ? URL.createObjectURL(blob) : ''; if (b) DISC_BLOB.set(url, b); DISC_BLOB_GO.delete(url);
    const fill = () => { document.querySelectorAll('img[data-dimg]').forEach(im => { if (im.dataset.dimg !== url) return; im.removeAttribute('data-dimg'); if (b) im.src = b; else im.remove(); });
      document.querySelectorAll('[data-dimgbg]').forEach(el => { if (el.dataset.dimgbg !== url) return; el.removeAttribute('data-dimgbg'); if (b) el.style.backgroundImage = `url('${b}')`; }); };
    fill(); setTimeout(fill, 300); })(); // and once more: a window that drew its markup a moment later
  DISC_BLOB_GO.set(url, go); return go; }
// legal-server (finding 5): no author's name on the file - the file page instead of "יוצר לא ידוע"
function discCrHTML(it) { const c = it.cr, esc = escH; return c ? `<span class="disc-pcr">תמונה: ${c.a ? `<bdi>${esc(c.a)}</bdi>` : `<a href="${esc(c.fp)}" target="_blank" rel="noopener">דף הקובץ</a>`}${SEP}${c.lu ? `<a href="${esc(c.lu)}" target="_blank" rel="noopener"><bdi>${esc(c.lic)}</bdi></a>` : `<bdi>${esc(c.lic)}</bdi>`}${SEP}<a href="${esc(c.fp)}" target="_blank" rel="noopener">Wikimedia Commons</a></span>` : ''; }
function discCreditsHTML(it) { return it.src === 'wiki' ? `<small class="cd-cred disc-cred" data-dcr>${svcCredit('wikimedia')}${it.cr ? SEP + discCrHTML(it) : ''}</small>` : ''; }
function openDiscCard(hostId, it) {
  const st = DISC_MAPS[hostId], esc = escH;
  const when = `נשמר ב-${tmFmt('dayN', tmPhoneDate(it.at))}`;
  const html = cdCard({ cls: 'disc-fc', lead: discThumb(it) ? `<span class="cd-lead disc"><img class="disc-th" ${discImgAttr(discThumb(it))} alt="" loading="lazy" onerror="this.remove()">${msi('auto_stories', { size: 18 })}</span>` : leadHTML('disc', msi('auto_stories', { size: 18 }), ''), // 10.2.0 (design-2): the same card - its thumbnail in the circle
    name: esc(it.title), tags: [cdMeta([symTip('sym.disc.' + it.src, it.src === 'wiki' ? 'ויקיפדיה' + (it.lang === 'en' ? ' (אנגלית)' : '') : 'OpenStreetMap'), discFromHere(it, st), !svcOnline() ? when : ''])],
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
    pick: { label: '＋ ' + (st.ctx === 'draft' ? 'לטיוטה' : 'הוספה'), on: () => { closeSheet(); closeFloatCard(hostId); if (st.ctx === 'draft') draftAddFromDisc(it); else discAdd(it, alongAft(hostId)); } },
    small: [it.src === 'wiki' ? 'ויקיפדיה' + (it.lang === 'en' ? ' (אנגלית)' : '') : 'OpenStreetMap', discFromHere(it, st), it.desc && it.src === 'osm' ? it.desc : ''],
    nav: navUrl(it.lat.toFixed(6) + ',' + it.lng.toFixed(6)), search: it.src === 'wiki' ? it.url : googleInfoUrl(it.title, it.lat + ',' + it.lng), searchLabel: it.src === 'wiki' ? 'הערך בוויקיפדיה' : 'חיפוש ב-Google',
    what: () => `${discThumb(it) ? `<img class="disc-big" ${discImgAttr(discThumb(it))} alt="" onerror="this.remove()">` : ''}${(it.extract || (it.src === 'wiki' ? '' : it.desc)) ? `<p class="iw-desc open">${escH(it.extract || it.desc)}</p>` : (it.src === 'wiki' && svcOnline() ? `<p class="sh-hint">${waitLineHTML('טוען את התקציר')}</p>` : '')}${it.src === 'wiki' ? `<p class="sh-hint">${discCreditsHTML(it)}</p>` : ''}`,
    links: `${it.src === 'wiki' ? lkBtn('menu_book', 'לערך', `href="${escH(it.url)}"`) : ''}${lkBtn('streetview', 'Street View', `href="${streetViewUrl({ lat: it.lat, lng: it.lng })}"`)}` });
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
function discAdd(it, aft) { // aft (along-drive): from a drive's "לאורך הדרך" - the place becomes a stop of that drive (alongAft)
  const ds = selDests(), near = ds.slice().sort((a, b) => { const ca = DESTS[a] && DESTS[a].meta.center, cb = DESTS[b] && DESTS[b].meta.center; return (ca ? distanceKm({ lat: ca[0], lng: ca[1] }, it) : 1e9) - (cb ? distanceKm({ lat: cb[0], lng: cb[1] }, it) : 1e9); });
  const lays = LAYER_DEFS.filter(l => !l.hidden && near.includes(l.dest)), ty = discType(it);
  const ofType = t => lays.filter(l => l.type === t).sort((a, b) => near.indexOf(a.dest) - near.indexOf(b.dest));
  const same = ty ? ofType(ty) : [], clear = same.length === 1 || (same.length > 1 && same[0].dest !== same[1].dest) ? same[0] : null;
  const maybe = clear ? [] : (same.length ? same : [].concat(ofType('attractions').slice(0, 1), ofType('nature').slice(0, 1), ofType('food').slice(0, 1))).slice(0, 3).map(l => l.id);
  const desc = it.extract || it.desc || '';
  openPlaceEditor({ name: it.title, coord: { lat: +it.lat.toFixed(6), lng: +it.lng.toFixed(6) }, desc, layer: clear ? clear.id : null, noGuess: true, maybe, ...(aft ? { afterSave: aft } : {}),
    src: { type: it.src === 'wiki' ? 'wikipedia' : 'osm', key: it.k, url: it.url || it.osmUrl || '', dh: textHash(desc) } });
}
act('disc.row', c => { const t = layerTop(), r = t.discRows[+c.v], hostId = t.discHost, st = DISC_MAPS[hostId]; closeSheet();
  setTimeout(() => { st.map.setView([r.it.lat, r.it.lng], Math.max(st.map.getZoom(), 17)); if (r.have && r.have.scope) { if (draftView.openCard) draftView.openCard(r.have); } else if (r.have) showMapCard(hostId, null, r.have); else openDiscCard(hostId, r.it); }, 120); });
act('disc.rowAdd', c => { const t = layerTop(), r = t.discRows[+c.v], st = DISC_MAPS[t.discHost]; closeSheet(); setTimeout(() => st.ctx === 'draft' ? draftAddFromDisc(r.it) : discAdd(r.it, alongAft(t.discHost)), 120); });
function openDiscList(hostId) { layerNote(openDiscList, arguments);
  const st = DISC_MAPS[hostId]; if (!st) return; const sheet = document.getElementById('sheet'), esc = escH;
  const ce = st.map.getCenter(), c = { lat: ce.lat, lng: ce.lng };
  const A = st.along, rows = A ? alongRows(hostId).map(r => ({ ...r, have: null })) : discInView(hostId).map(it => ({ it, d: distanceKm(c, it) * 1000, have: discHave(it, st) })).sort((a, b) => a.d - b.d);
  const g = (q, l) => `<a class="chip" href="https://www.google.com/maps/search/${encodeURIComponent(q)}/@${c.lat.toFixed(5)},${c.lng.toFixed(5)},16z" target="_blank" rel="noopener">${l}</a>`;
  sheet.innerHTML = `${fmHead(`📚 ${A ? 'לאורך הדרך' : 'מה יש כאן'}${SEP}${rows.length}`, 'dlClose')}
    ${A ? alongHeadHTML(A) : `<div class="sh-hint">לפי המרחק ממרכז המפה.</div>
    <div class="sh-hint dl-gh">ב-Google Maps</div>`}${A ? '' : `<div class="dl-g">${g('restaurants', msi('restaurant', { size: 18 }) + 'מסעדות')}${g('cafe', msi('local_cafe', { size: 18 }) + 'קפה')}${g('supermarket', msi('local_grocery_store', { size: 18 }) + 'סופר')}${g('pharmacy', msi('local_pharmacy', { size: 18 }) + 'בית מרקחת')}</div>`}
    <div class="dl-list">${rows.map((r, i) => `<div class="dl-row"><button type="button" class="dl-name" data-act="disc.row" data-v="${i}"><span class="dl-th"${discThumb(r.it) ? discImgBg(discThumb(r.it)) : ''}>${discThumb(r.it) ? '' : msi(r.it.src === 'osm' ? 'location_on' : 'auto_stories', { size: 20 })}</span><span class="dl-tx"><b dir="auto">${esc(r.it.title)}</b><small${A ? ' class="t-wrap"' : ''}>${A ? `אחרי ${fmtKm(r.km)}${SEP}${fmtKm(r.off)} מהדרך` : (r.it.src === 'osm' ? 'OpenStreetMap' : 'ויקיפדיה') + SEP + fmtKm(r.d / 1000)}</small></span></button>`
      + `<a class="dl-ib" href="https://www.google.com/maps/dir/?api=1&destination=${(+r.it.lat).toFixed(6)},${(+r.it.lng).toFixed(6)}" target="_blank" rel="noopener" aria-label="ניווט" title="ניווט">${msi('navigation', { size: 20 })}</a>`
      + (r.have ? `<span class="dl-have">${msi('check', { size: 16 })} ${r.have.scope ? 'בטיוטה' : 'כבר ביעד'}</span>` : `<button type="button" class="dl-ib dl-add" data-act="disc.rowAdd" data-v="${i}" aria-label="${st.ctx === 'draft' ? 'להוסיף לטיוטה' : 'להוסיף'}" title="${st.ctx === 'draft' ? 'להוסיף לטיוטה' : 'להוסיף'}">${msi('add_circle', { size: 22 })}</button>`) + '</div>').join('') || (A ? (A.busy ? '' : '<div class="empty">לא נמצא משהו חדש ברוחב הזה. אפשר לנסות רוחב גדול יותר.</div>') : '<div class="empty">עוד לא נמצא כאן כלום. ' + msi('refresh', { cls: 'msi-in' }) + ' חיפוש באזור הזה על המפה.</div>')}</div>`; // 10.5.0 (design-4 part 2, look.md "Maps"): rows - the thumbnail, the name, source · distance, navigate and add as icons
  
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


// ================= 📚 לאורך הדרך - what is along a drive (along-drive; decisions 2026-11-23 · "📚 לאורך הדרך", Q1-Q2) =================
// "מה יש כאן"'s own sources and marks, searched along a drive's line instead of the map's box: the line cut into stretches of ~40 km, each
// searched by Wikipedia's geosearch in circles along it (a radius and a step per width - ALONG_STEP) and by one Overpass corridor query
// over its points, through the one client (svcAsk); the answers merged as "מה יש כאן" merges them (discMerge), each found with its
// distance along the road and its detour from it (lineNear), those farther than the width left out, as are my places (discHave);
// ordered by the road. The width ("2 · 5 · 10 ק״מ", 5 by default) is kept per trip (tdOf(id).alongKm, row tripHidden). The wait: the one
// "in progress" component, measured - stretch N of M; a stretch that fails is named and the rest kept. Adding from it makes a stop of the
// drive (alongAft → the place editor's afterSave.stop → travelStopAdd). Ways in: the drive's card (alongBtnHTML) and the day map's 📚 menu.
const ALONG_W = [2, 5, 10], ALONG_STEP = { 2: [4, 7], 5: [7.5, 11], 10: [10, 10] }, ALONG_WORDS = 'מחפשים בקטעי הדרך', ALONG_NET = 'לאורך הדרך צריך רשת';
const ALONG_GO = { go: null }; // a drive's card asked for its day map (go: { h, id }): the search starts when that map is attached
function alongKm(t) { const v = t && t.id ? +(tdOf(t.id).alongKm) : 0; return ALONG_W.includes(v) ? v : 5; }
function alongAft(hostId) { const A = DISC_MAPS[hostId] && DISC_MAPS[hostId].along; return A ? { day: A.day, stop: A.id } : null; }
function alongGo(hostId) { const g = ALONG_GO.go; if (g && g.h === hostId) { ALONG_GO.go = null; setTimeout(() => alongStart(hostId, g.id), 0); } }
function lineAt(pts, d) { let run = 0; for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], s = distanceKm({ lat: a[0], lng: a[1] }, { lat: b[0], lng: b[1] });
    if (s > 0 && run + s >= d) { const u = (d - run) / s; return { lat: a[0] + (b[0] - a[0]) * u, lng: a[1] + (b[1] - a[1]) * u }; } run += s; }
  const z = pts[pts.length - 1]; return { lat: z[0], lng: z[1] }; }
// the stretches: [{ cs: the circles' centres, r: their radius in metres }] - the line's corridor of the width covered, ~40 km a stretch
function alongParts(pts, w) { const [R, step] = ALONG_STEP[w] || ALONG_STEP[5], tot = lineKm(pts), cs = [], per = Math.max(1, Math.round(40 / step)), out = [];
  for (let d = Math.min(step / 2, tot / 2); d <= tot; d += step) cs.push(lineAt(pts, d)); if (!cs.length) cs.push(lineAt(pts, 0));
  for (let i = 0; i < cs.length; i += per) out.push({ cs: cs.slice(i, i + per), r: R * 1000 }); return out; }
function alongRows(hostId) { const st = DISC_MAPS[hostId], A = st && st.along; if (!A || !A.pts || !A.pts.length) return [];
  const w = A.w || alongKm(activeTripObj()), la = A.pts.map(p => p[0]), lo = A.pts.map(p => p[1]), pd = w / 100 + .01, b = [Math.min(...la) - pd, Math.max(...la) + pd, Math.min(...lo) - pd * 3, Math.max(...lo) + pd * 3];
  return Object.values(DISC.items).filter(it => it.lat >= b[0] && it.lat <= b[1] && it.lng >= b[2] && it.lng <= b[3]).map(it => ({ it, ...lineNear(A.pts, it) }))
    .filter(r => r.off <= w && !discHave(r.it, st)).sort((x, y) => x.km - y.km); }
// limits-and-safety (decisions 2026-11-24 · Review of short-waits-4 and along-stuck, Q2): the whole search has a time limit (ALONG_TIME.ms); at its end
// the places found so far stay, and one line names the stretches that did not answer (fail) and those not searched in time (out)
const ALONG_TIME = { ms: 120e3 }, alongNums = a => a.length === 1 ? `קטע ${a[0]}` : `קטעים ${a.length > 2 && a[a.length - 1] - a[0] === a.length - 1 ? a[0] + '–' + a[a.length - 1] : a.join(', ')}`;
const alongFail = A => [A.fail.length ? alongNums(A.fail) + (A.fail.length === 1 ? ' לא ענה' : ' לא ענו') : '', (A.out || []).length ? 'עבר הזמן - ' + alongNums(A.out) + (A.out.length === 1 ? ' לא נבדק' : ' לא נבדקו') : ''].filter(Boolean).join(SEP);
const alongMiss = A => A.fail.length + (A.out || []).length > 0;
// the wait's words: a provider paused (a 429's Retry-After, the growing pauses) is named with its time left - else the search's own words
function alongWords() { const w = [svcWaitLeft('discWiki'), svcWaitLeft('discOsm')].filter(Boolean).sort((a, b) => b.ms - a.ms)[0]; if (!w) return ALONG_WORDS;
  const t = Math.ceil(w.ms / 1000); return `ממתינים ל${w.name}${SEP}עוד ${t < 90 ? t + ' שניות' : Math.ceil(t / 60) + ' דקות'}`; }
function alongHeadHTML(A) { return `<div class="dl-along"><span class="sh-hint">מרחק מהדרך</span>${segHTML('along.w', ALONG_W.map(k => [String(k), fmtKm(k)]), String(A.w || alongKm(activeTripObj())))}</div>
    <p class="sh-hint">לפי סדר הדרך${A.approx ? SEP + 'הדרך משוערת' : ''}.</p>${A.busy && A.n ? `<p class="sh-hint along-wait">${waitLineHTML(alongWords(), { done: A.done, total: A.n })}</p>` : ''}${!A.busy && alongMiss(A) ? `<p class="sh-hint">${warnIc()} ${alongFail(A)}. מוצג מה שנמצא בשאר.</p>` : ''}`; }
function alongListRedraw(hostId) { const t = layerTop(); if (t && t.discHost === hostId && t.discRows) winRedraw(); }
async function alongStart(hostId, id) { const st = DISC_MAPS[hostId], t = activeTripObj(), f = t && travelById(id, t); if (!st || !f) return;
  if (svcNetDown()) { showToast(ALONG_NET); return; }
  const C = tvCtx(t), Ln = travelLine(f, C); if (!Ln) return; discSet(true);
  const A = st.along = { id: String(id), day: hostId.replace('mapView_day_', ''), pts: Ln.pts, approx: Ln.approx, n: 0, done: 0, fail: [], busy: true }; st.busy = true; discBar(hostId);
  if (Ln.approx) { const w = travelPathWant(f, C); if (w) await w; const L2 = travelLine(travelById(id, t) || f, C); if (L2) Object.assign(A, { pts: L2.pts, approx: L2.approx }); } // the road first (the side view's way)
  alongSearch(hostId); }
async function alongSearch(hostId) { const S0 = DISC_MAPS[hostId], A = S0 && S0.along; if (!A) return;
  const w = A.w = alongKm(activeTripObj()), P = alongParts(A.pts, w), run = A.run = (A.run || 0) + 1, cur = () => { const S = DISC_MAPS[hostId]; return S && S.along === A && A.run === run ? S : null; };
  Object.assign(A, { n: P.length, done: 0, fail: [], out: [], busy: true }); S0.busy = true; if (S0.wait) S0.wait.progress(0, A.n, ALONG_WORDS); else discBar(hostId); alongListRedraw(hostId);
  const end = svcT() + ALONG_TIME.ms, alive = () => !!cur() && svcT() < end, words = () => { const S = cur(), t = alongWords(); if (!S || !A.busy) return clearInterval(tk); // the line, each second: a paused provider and its time left
    if (S.wait) S.wait.progress(A.done, A.n, t); document.querySelectorAll('.along-wait').forEach(e => { e.innerHTML = waitLineHTML(t, { done: A.done, total: A.n }); }); }, tk = setInterval(words, 1000);
  for (let i = 0; i < P.length; i++) { const p = P[i], left = end - svcT();
    const got = left <= 0 ? null : svcNetDown() ? [[], null] : await Promise.race([Promise.all([Promise.all(p.cs.map(c => discWiki(c, p.r, alive))), discOsm(p.cs[0], Math.round(w * 1000), p.cs, alive)]), new Promise(r => setTimeout(r, left, null))]);
    const S = cur(); if (!S) return clearInterval(tk); if (!got) { for (let k = i + 1; k <= P.length; k++) A.out.push(k); break; } // past the limit: the rest not searched
    const [ws, o] = got, wl = ws.filter(Boolean); if (!wl.length && o === null) A.fail.push(i + 1); else discMerge([].concat(...wl), o);
    A.done = i + 1; S.busy = true; if (S.wait) S.wait.progress(A.done, A.n, alongWords()); discDraw(hostId); alongListRedraw(hostId); }
  clearInterval(tk); const S = cur(); if (!S) return; A.busy = false; S.busy = false; if (S.wait) { S.wait.done(); S.wait = null; } discSave(); discDraw(hostId); alongListRedraw(hostId);
  const n = alongRows(hostId).length; showToast((alongMiss(A) ? alongFail(A) + SEP : '') + (n ? `לאורך הדרך: ${n} מקומות` : 'לא נמצא משהו חדש לאורך הדרך')); }
act('along.open', c => { const [id, day] = String(c.v).split('|'), h = 'mapView_day_' + day; if (svcNetDown()) { showToast(ALONG_NET); return 'quiet'; }
  tvMarkSet(day, id); const st = DISC_MAPS[h]; if (getViewMode('day_' + day) === 'map' && st && st.host.isConnected) { alongStart(h, id); revealLater(`#main [data-day-item="${CSS.escape(day)}"] .map-container`, false); return 'quiet'; }
  ALONG_GO.go = { h, id }; setViewMode('day_' + day, 'map'); openDays.add(day); revealLater(`#main [data-day-item="${CSS.escape(day)}"] .map-container`, false); return 'redraw'; });
// the 📚 menu's "לאורך הדרך" rows (discMenu): one per drive of mine on a driving day's map; '' when none
function alongMenuRows(hostId) { const dk = hostId.startsWith('mapView_day_') ? hostId.slice(12) : null, fs = dk ? (DAY_TRAVELS[dk] || []).map(f => tvCur(f, tvCtx())).filter(alongCan) : [];
  if (!fs.length) return ''; const net = svcNetDown();
  return fs.map(f => `<button type="button" role="menuitem" data-act="along.map" data-v="${escH(f.id + '|' + dk)}">${msi('route', { cls: 'ly-ic' })}<span class="ly-t"><b>לאורך הדרך</b><small>${net ? ALONG_NET : escH(travelTitle(f))}</small></span></button>`).join(''); }
const alongMenuHost = el => { const m = el.closest('.disc-menu'), h = m.parentElement; m.remove(); return Object.keys(DISC_MAPS).find(k => DISC_MAPS[k].host === h); };
act('along.map', c => { const h = alongMenuHost(c.el), [id, day] = String(c.v).split('|'); if (!h) return 'quiet'; if (svcNetDown()) { showToast(ALONG_NET); return 'quiet'; } tvMarkSet(day, id); alongStart(h, id); return 'quiet'; });
act('along.w', c => { const t = activeTripObj(), v = +c.v, h = layerTop() && layerTop().discHost; if (!ALONG_W.includes(v) || !t || !t.id) return 'quiet'; const td = tdOf(t.id);
  if (v === 5) delete td.alongKm; else td.alongKm = v; tdSave(t.id); if (h && DISC_MAPS[h] && DISC_MAPS[h].along) alongSearch(h); return 'quiet'; });

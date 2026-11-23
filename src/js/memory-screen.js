// ---- memory screen, part 3 ----
function memorySection3(M, where) {
  const id = M.t.id;
  if (where === 'top') return picMemBlockHTML(M); // 4.43.0
  if (where === 'bottom') { const n = memoPhotoCount(id);
    return `${M.td.album ? `<p class="mem-album"><a href="${_qe(M.td.album)}" target="_blank" rel="noopener">${msi('link', { size: 18, cls: 'msi-in' })} האלבום</a></p>` : ''}
      <div class="accordion">${accHTML('mem-photos', `${msi('photo_library', { size: 20 })} תמונות ואלבום${n ? `${SEP}${n}` : ''}`, `<p class="sh-hint">רשות. עד ${MEMO_PHOTO_MAX} תמונות לטיול; הראשונה היא תמונת השער, ורגע שיא יכול לקבל אחת מהן. בלעדיהן המזכרות שלמות.</p>
        ${photosBoxHTML(id)}
        ${(M.td.highlights || []).length && n ? `<div class="mem-hlp">${(M.td.highlights || []).map(h => `<div class="cl-row"><span>${msi('celebration', { cls: 'msi-in' })} ${_qe((h.placeId != null && M.pmap.get(h.placeId) ? M.pmap.get(h.placeId).name : '') || h.text || 'רגע שיא')}</span>${hlPhotoPickHTML(id, h)}</div>`).join('')}</div>` : ''}
        <label class="sh-field">קישור לאלבום${fmInput({ type: 'url', id: 'mpAlbum', act: 'memSec.mpAlbum', dir: 'ltr', value: M.td.album || '', placeholder: 'https://' })}</label>`, false)}</div>`; }
  return '';
}
const _memBgAsked = new Set();
function memorySectionCtl(M) { const ctl = ctlNS('memSec');
  const id = M.t.id, main = document.getElementById('main'), rr = () => renderMemoryScreen(), v = () => (MEMO_VIEW[id] = MEMO_VIEW[id] || {});
  { ctl.memPicEdit = () => openPicEditor(id); ctl.memPicFs = () => openPhotoView({ pic: id }); // 4.43.0

    if (mementoStyleOf(id) !== 'art') picWikiKick(id); } // 4.44.0: Wikipedia's picture of each point, in the background
  
  if (!mementoBgReady(id) && !svcNetDown() && !_memBgAsked.has(id + '|' + mementoStyleOf(id) + '|' + SCHEM_FAILED.size)) { _memBgAsked.add(id + '|' + mementoStyleOf(id) + '|' + SCHEM_FAILED.size); // 4.46.5: per style - a style chosen in the editor loads its background too // 4.43.0: once per failure state, never a redraw loop
    readyMementoBg(id).then(r => { if (r) memBgStatus(null); if (activeTab === 'memory' && memoryTrip === id && !(PIC_ED) && (r || SCHEM_FAILED.size)) rr(); }); }
  { ctl.memBgRetry = () => { SCHEM_FAILED.clear(); SVC.gaveUp = {}; Object.keys(SVC.p).forEach(p => { SVC.p[p].pauseUntil = 0; }); _memBgAsked.clear(); memBgStatus(null); rr(); }; } // 4.36.1; 7.1.0: also lifts the providers' wait (not a block)
  
  const g = q => document.getElementById(q);
  if (g('memArt')) ctl.memArt = () => openArtSheet(id);
  if (g('memExport')) ctl.memExport = () => openMemExport(id); // 4.46.5
  
  { const box = main.querySelector('.ph-box'); const redraw = () => { ACC_OPEN['mem-photos'] = true; rr(); }; if (box) photosBoxCtl(box.parentElement, id, redraw); const hp = main.querySelector('.mem-hlp'); if (hp) hlPickCtl(hp, id, redraw); } // 4.35.0
  
  
  
  
  if (g('mpAlbum')) ctl.mpAlbum = () => { const td = tdOf(id), v = g('mpAlbum').value.trim(); if ((td.album || '') === v) return; td.album = v; tdSave(id); showUndoToast(v ? 'הקישור לאלבום נשמר' : 'הקישור לאלבום הוסר'); };
  // heights arrive later when online: once, for the stops and the places I visited
  if (navigator.onLine && !M._elevAsked) { M._elevAsked = true; const D = mementoData(id); if (D && D.spread > 80) { const cs = D.stops.map(s => s.c).concat(D.keyPts.slice(0, 10).map(snapCoord)).filter(c => c && knownElev(c) == null).slice(0, 14);
    if (cs.length) elevMany(cs).then(() => { if (cs.some(c => knownElev(c) != null) && activeTab === 'memory' && memoryTrip === id) rr(); }); } }
}
ctlActs('memSec', ['memPicEdit', 'memPicFs', 'memArt', 'memBgRetry', 'memExport', 'mpAlbum']);
// ---- 📖 trip summary: an HTML file without a wrapper ----
async function sendTripSummary(id, opt) {
  if (SUMMARY_BUSY) return; SUMMARY_BUSY = true; showToast('מכין את הסיכום עם המפה…');
  try { await sendTripSummary2(id, opt || { plan: true, words: true, photos: true, bad: true }); } finally { SUMMARY_BUSY = false; }
}
var SUMMARY_BUSY = false;
// 9.1.1 (12ג-5): a page for people leaves one way - the file, the change-log line and the "made without network" note
async function sendPage(html, o) {
  const ok = await deliverFile(new Blob([html], { type: 'text/html' }), `${PACK.fileName}-${o.slug}-${o.name.replace(/[^\wא-ת]+/g, '-')}.html`, 'text/html');
  if (ok) { logEvent(o.log, true); if (o.then) o.then(); if (o.pic && !o.pic.online) showToast(`${o.noun} נוצר בלי רשת, והמפה בו סכמטית. עם רשת אפשר ליצור אותו שוב עם מפה מלאה`); }
}
async function sendTripSummary2(id, opt) {
  opt = opt || { plan: true, words: true, photos: true, bad: true };
  const D = mementoData(id), M = D.M, t = M.t, e = _qe, name = String(t.name).split(' · ')[0];
  if (!mementoBgReady(id) && navigator.onLine) await readyMementoBg(id);
  if (!mementoBgReady(id) && mementoStyleOf(id) !== 'art') showToast(SY.warn + ' רקע המפה של תמונת הטיול לא נטען, והיא נכנסת לסיכום בלעדיו');
  const svg = currentMementoSVG(id); // 4.36.0: the trip picture as chosen in the memory screen (map / schematic / illustrated)
  // 4.36.0: 🗺️ where we were - a live map (faded tiles, places in the rating's colour), with a picture of it for offline
  const I = memItems(M, false), W = x => opt.words ? x : '', fitems = I.places.filter(x => opt.bad || x.r !== 'dislike').map(x => ({ lat: x.c.lat, lng: x.c.lng, color: x.color, n: '', name: x.name, sub: [x.r ? RATE[x.r] + ' ' + RATE_LABEL[x.r] : '', W(x.w) ? '"' + x.w + '"' : ''].filter(Boolean).join(SEP), love: x.r === 'love', label: x.hi || x.key, nav: navUrl(x.c.lat + ',' + x.c.lng), desc: x.p && x.p.description ? String(x.p.description).slice(0, 220) + (wikiTextOf(x.p) ? SEP + wikiTextCreditText(x.p) : '') : '', q: x.name, icon: x.p && x.p.icon }))
    .concat(I.hotels.map(h => ({ lat: h.c.lat, lng: h.c.lng, color: '#1C2B33', n: '', name: h.name, icon: 'lodging', sub: h.nights + ' לילות', hotel: true })));
  const route = I.hotels.length > 1 ? I.hotels.map(h => [h.c.lat, h.c.lng]) : [];
  const pic = fitems.length ? await fileMapPicture(fitems, memKind(D), { fade: true, tripId: id, th: D.th, route }) : null;
  const plan = opt.plan ? planAsItWasHTML(M) : '', love = Object.entries(D.rate).filter(([, v]) => v.r === 'love'), like = Object.entries(D.rate).filter(([, v]) => v.r === 'like');
  const nm = k => (M.pmap.get(Number(k)) || {}).name || '';
  const photos = (opt.photos ? tripPhotoKeys(id) : []).map(k => { const h = (M.td.highlights || []).find(x => x.photo === k); const nmH = h ? ((h.placeId != null && M.pmap.get(h.placeId) ? M.pmap.get(h.placeId).name : '') || h.text || '') : ''; return { k, img: MEMO.get(k), name: nmH, text: '' }; }); // 4.35.0: the whole collection
  const html = pageHTML({ title: `${name}${SEP}סיכום הטיול`, label: 'סיכום הטיול', th: D.th,
    css: `.lg{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:.8rem;color:var(--soft)}.lg i{display:inline-block;width:10px;height:10px;border-radius:50%;margin-inline-end:4px;vertical-align:middle}.hero{background:linear-gradient(135deg,var(--p),var(--a));color:#fff;border-radius:18px;padding:22px}.hero h1{font-size:2rem}.svgbox>svg{width:100%;height:auto;border-radius:14px;display:block;margin:14px 0}
.day b{display:block}.day ul{margin:4px 0;padding-inline-start:20px}.tags span{display:inline-block;background:var(--line);border-radius:999px;padding:2px 10px;margin:3px}.ph{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px}.ph .pc{display:block;overflow:hidden;border-radius:12px;aspect-ratio:1}.ph img{width:100%;height:100%;object-fit:cover;display:block}.ph div small{display:block;color:var(--soft)}.mp-org{color:var(--soft)}.mp-vis{font-weight:600}`,
    head: `<div class="hero"><div>${D.flags.join(' ')} ${t.start ? `${tmFmt('range', [t.start, t.end], { year: true })}` : ''}</div><h1>${e(name)}</h1><div>${e(D.dests.map(d => d.name).join(' ← '))}${t.travelers ? SEP + e(t.travelers) : ''}</div></div>
<div class="svgbox">${svg}</div>`,
    map: pic ? { pic, data: fmapData(fitems, pic, { fade: true, route }), before: `<h2>${SY.map} איפה היינו</h2>`, after: `<div class="lg"><span><i style="background:${RATE_COLOR.love}"></i>❤️ אהבנו</span><span><i style="background:${RATE_COLOR.like}"></i>👍 היה טוב</span>${opt.bad ? `<span><i style="background:${RATE_COLOR.dislike}"></i>👎</span>` : ''}<span><i style="background:${UNRATED_COLOR}"></i>בלי דירוג</span><span>🏨 לינה</span></div>` } : null,
    body: `${D.hs.length ? `<h2>✨ רגעי השיא</h2>${D.hs.map(h => `<div class="card"><b>${e(h.name || h.text)}</b>${h.name && h.text ? `<div>${e(h.text)}</div>` : ''}</div>`).join('')}` : ''}
${photos.length ? `<div class="ph">${photos.map(h => `<div><span class="pc">${photoImgHTML(h.k, h.img)}</span><small>${e(h.name || h.text)}</small></div>`).join('')}</div>` : ''}
${love.length || like.length ? `<h2>💛 מה אהבנו</h2>${love.length ? `<div class="tags">❤️ ${love.map(([k, v]) => `<span>${e(nm(k))}${W(v.w) ? `${SEP}"${e(v.w)}"` : ''}</span>`).join('')}</div>` : ''}${like.length ? `<div class="tags">👍 ${like.map(([k, v]) => `<span>${e(nm(k))}${W(v.w) ? `${SEP}"${e(v.w)}"` : ''}</span>`).join('')}</div>` : ''}` : ''}
${D.records.length ? `<h2>📊 במספרים</h2><div class="tags">${[`${D.days} ימים`, `${D.visited.length} מקומות`].concat(D.records.map(r => `${r[0]} ${r[1]}${r[2] ? SEP + r[2] : ''}`)).map(x => `<span>${e(x)}</span>`).join('')}</div>${D.records.some(r => r[0] === '⛰️') ? `<small class="elev-cr">${svcCredit('openmeteo', { as: 'elev' })}</small>` : ''}` : ''}
${plan ? `<h2>${SY.days} יום אחר יום</h2><div class="card">${(f => { f.querySelectorAll('[class="mp-day"]').forEach(e => { e.className = 'day'; }); const d = document.createElement('div'); d.appendChild(f); return d.innerHTML; })(htmlFrag(plan))}</div>` : ''}
${M.td.album ? `<p>🔗 <a href="${e(M.td.album)}">האלבום</a></p>` : ''}` });
  await sendPage(html, { slug: 'summary', name, log: '📖 נשלח סיכום הטיול: ' + t.name, noun: 'הסיכום', pic });
}

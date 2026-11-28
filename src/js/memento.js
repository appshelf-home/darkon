MEMO_READY.then(() => { if (typeof activeTab !== 'undefined' && activeTab === 'memory') render(); });
// ---- closing flow hooks: a photo per highlight, the cover and the album link ----
function highlightPhotoHTML(h) { const id = CLOSING && CLOSING.id; return id ? hlPhotoPickHTML(id, h) : ''; } // 4.35.0: one of the trip's photos
function highlightExtrasHTML(C) {
  const id = C.t.id, cover = MEMO.get(`photo:${id}:cover`);
  return `<div class="hl-extras"><b>${msi('photo_camera', { size: 18, cls: 'msi-in' })} תמונות ואלבום - רשות</b><small>עד ${MEMO_PHOTO_MAX} תמונות לטיול, מהגלריה (כמה יחד) או מהמצלמה, מוקטנות לכ-200KB. הראשונה היא תמונת השער, ורגע שיא יכול לקבל אחת מהן. בלי תמונות המזכרות שלמות בדיוק כמו עם.</small>
    ${photosBoxHTML(id)}
    <label class="sh-field">קישור לאלבום (Google Photos וכו')${fmInput({ type: 'url', id: 'clAlbum', act: 'hlExtra.clAlbum', dir: 'ltr', value: C.td.album || '', placeholder: 'https://' })}</label></div>`;
}
function hlExtrasCtl(C, id) { const ctl = ctlNS('hlExtra');
  const main = document.getElementById('main');
  { const hl = document.getElementById('clHigh'); const keep = () => { if (hl) hl.querySelectorAll('select,input[type="text"]').forEach(el => el.dispatchEvent(new Event('change'))); }; // what was typed stays
    photosBoxCtl(main.querySelector('.hl-extras') || main, id, () => { keep(); renderClosingScreen(); }); if (hl) hlPickCtl(hl, id, () => { keep(); renderClosingScreen(); }); }
  
  
  
  
  ctl.clAlbum = () => { const td = tdOf(id), v = document.getElementById('clAlbum').value.trim(); if ((td.album || '') === v) return; td.album = v; tdSave(id); showUndoToast(v ? 'הקישור לאלבום נשמר' : 'הקישור לאלבום הוסר'); };
}
ctlActs('hlExtra', ['clAlbum']);

// ---- the data behind every memento ----
const HOME = { lat: 32.0, lng: 34.87, name: 'ישראל' };
function kmBetween(a, b) { return distanceKm(a, b); }
function mementoData(id) {
  const M = tripMemoryData(id); if (!M) return null; const t = M.t, snap = M.snap || {}, dmeta = d => (snap.dests && snap.dests[d]) || (DESTS[d] && { ...DESTS[d].meta, idBase: DESTS[d].idBase }) || {};
  // stops: a stop per lodging (in order), or a stop per destination segment when lodging has no point
  let stops = M.stops.map(s => ({ name: lodgingLabel(s.l, s.p, t).replace(/\s*\(.*$/, ''), city: '', c: snapCoord(s.p), nights: nightsBetween(s.l.checkIn, s.l.checkOut) || 1, from: s.l.checkIn, dest: s.p.dest }));
  if (!stops.length) stops = (t.segments || []).map(sg => { const m = dmeta(sg.dest); return m.center ? { name: m.name, c: { lat: m.center[0], lng: m.center[1] }, nights: Math.max(1, daysBetween(sg.from || t.start, sg.to || t.end)), from: sg.from, dest: sg.dest } : null; }).filter(Boolean);
  stops.forEach(s => { const m = dmeta(s.dest); s.city = m.name || ''; });
  const visited = M.visited.filter(p => snapCoord(p)), rate = M.td.rating || {};
  const keyPts = visited.filter(p => p.key || (rate[p.id] || {}).r === 'love').concat(visited.filter(p => !(p.key || (rate[p.id] || {}).r === 'love'))).slice(0, 60);
  const all = visited.map(snapCoord).concat(stops.map(s => s.c));
  let spread = 0; all.forEach(a => all.forEach(b => { spread = Math.max(spread, kmBetween(a, b)); }));
  const legs = []; for (let i = 1; i < stops.length; i++) legs.push({ a: stops[i - 1], b: stops[i], km: kmBetween(stops[i - 1].c, stops[i].c) });
  const travels = tripMoves(t).slice().sort((a, b) => String(a.date).localeCompare(String(b.date))); // 11.2.0: every travel but the outings (Q8)
  legs.forEach((l, i) => { const tr = travels.find(x => x.date === l.b.from) || travels[i + 1]; l.mode = tr ? tr.mode : (l.km > 400 ? 'flight' : 'bus'); });
  const outKm = stops.length ? kmBetween(HOME, stops[0].c) : 0, backKm = stops.length ? kmBetween(stops[stops.length - 1].c, HOME) : 0;
  const totalKm = Math.round(outKm + backKm + legs.reduce((n, l) => n + l.km, 0));
  // walking: the visited places of each day in plan order, ×1.3 for streets
  let walk = 0; Object.values(M.td.itinerary || {}).forEach(d => { const seq = ['morning', 'afternoon', 'evening', 'unassigned'].flatMap(k => (d || {})[k] || []).map(i => M.pmap.get(i)).filter(p => p && (M.td.visited || []).includes(p.id) && snapCoord(p));
    for (let i = 1; i < seq.length; i++) { const k = kmBetween(snapCoord(seq[i - 1]), snapCoord(seq[i])); if (k < 8) walk += k; } });
  const lats = all.map(c => c.lat), dests = M.dests.map(d => ({ id: d, ...dmeta(d) }));
  const elevs = visited.map(p => ({ p, e: p.elev != null ? p.elev : knownElev(snapCoord(p)) })).concat(stops.map(s => ({ p: { name: s.name }, e: knownElev(s.c) }))).filter(x => x.e != null);
  const top = elevs.sort((a, b) => b.e - a.e)[0] || null;
  const m0 = t.start ? Number(t.start.slice(5, 7)) : 0, south = lats.some(x => x < 0);
  const records = [];
  if (totalKm > 50) records.push(['🧭', fmtKm(totalKm), 'מהבית ובחזרה']);
  const lf = [{ km: outKm, mode: 'flight' }, { km: backKm, mode: 'flight' }].concat(legs).filter(l => l.mode === 'flight').sort((a, b) => b.km - a.km)[0];
  if (lf && lf.km > 300) records.push(['✈️', fmtKm(lf.km), 'הטיסה הארוכה']);
  if (top && top.e >= 1200) records.push(['⛰️', fmtM(top.e), 'הכי גבוה: ' + String(top.p.name).slice(0, 24)]);
  if (lats.length && spread > 300) { const n = visited.concat(stops.map(s => ({ name: s.name, coord: s.c }))); const so = n.slice().sort((a, b) => snapCoord(a).lat - snapCoord(b).lat)[0];
    if (so) records.push(['🧊', `${Math.abs(snapCoord(so).lat).toFixed(1)}°${snapCoord(so).lat < 0 ? 'S' : 'N'}`, 'הכי ' + (snapCoord(so).lat < 0 ? 'דרומי' : 'דרומה') + ': ' + String(so.name).slice(0, 20)]); }
  if (south) records.push(['🌐', 'קו המשווה', 'חצינו אותו']);
  if (south && [11, 12, 1, 2, 3].includes(m0)) records.push(['❄️→☀️', 'מחורף לקיץ', 'עונה הפוכה']);
  if (south && [5, 6, 7, 8, 9].includes(m0)) records.push(['☀️→❄️', 'מקיץ לחורף', 'עונה הפוכה']);
  const tz = new Set(dests.map(d => tmOffset(destZone({ meta: d }), t.start || tmPhoneDate()))); if (tz.size > 1) /* 7.0.0: the clocks that differ on the trip's dates */ records.push(['🕐', `${tz.size} אזורי זמן`, '']);
  const foodTypes = new Set(['food', 'drink']), layerOf = id => (M.layers || []).find(l => l.id === id) || {};
  const eat = visited.filter(p => foodTypes.has(layerOf(p.layer).type)).length;
  const days = dayList(t.start, t.end).length;
  const auto = stops.length <= 1 && spread < 80 ? 'city' : stops.some(s => s.nights >= 2) && stops.length >= 2 && spread < 6000 ? 'combo' : 'route';
  const cols = (snap.collections || []).filter(c => c.total);
  const hs = (M.td.highlights || []).filter(h => h.text || h.placeId != null).slice(0, 5).map(h => ({ ...h, name: h.placeId != null && M.pmap.get(h.placeId) ? M.pmap.get(h.placeId).name : '', p: h.placeId != null ? M.pmap.get(h.placeId) : null, img: h.photo && MEMO.get(h.photo) }));
  const th = (dests[0] && dests[0].theme) || {};
  const outs = memOutings(M, stops); // 11.2.0 (Q8): the outings, a loop on the trip picture
  return { M, t, stops, legs, outs, visited, keyPts, spread, totalKm, walk: tlKm(id) || Math.round(walk * 1.3 * 10) / 10, // 11.9.0: the walking km of Google Timeline when imported (Q1), else the estimate
    ride: rideData(M, dmeta), // ride-km: the one source of "ק״מ בנסיעות" (the memory tile, the picture's number, the memento file)
    records, days, eat, dests, auto, cols, hs, th, rate, cover: tripCover(id), coverKey: tripPhotoKeys(id)[0], flags: [...new Set(dests.map(d => destFlagMeta(d)).filter(Boolean))] };
}

// ride-km (decisions 2026-11-20 · "ק״מ בנסיעות", Q1-Q5): every km not on foot travelled inside the trip - flights, trains, buses, car, ferries
// between destinations and rides in a city; ride-no-home (Q5): the way from home to the first destination and back from the last is left out
// (it is the picture's "ק״מ"), a connection on the way with it. From the Timeline's days imported with kinds (tlRideKm: each move's own
// distance, the moves from or to home left out - tlHomeMoves); for a day it lacks (or a trip imported before tl-paths, until a re-import)
// the trip's travels (mine and the group's) but those with an end at home (travelHomeEnds), in straight lines between their ends - their
// places, else the destination of their day - marked "משוער". Never both for one day. { km, est, by: { kind: km } }
const RIDE_LABEL = ['ק״מ בנסיעות', 'km by transport']; // the one wording of the tile, its window and the picture's number (PIC_NUMS.ride)
const RIDE_KINDS = [['flight', 'טיסות', 'flight'], ['train', 'רכבות', 'train'], ['bus', 'אוטובוסים', 'directions_bus'], ['car', 'רכב', 'directions_car'], ['ferry', 'מעבורות', 'directions_boat'], ['city', 'נסיעות בעיר', 'commute']];
function rideKind(mode) { return RIDE_KINDS.some(x => x[0] === mode) ? mode : 'flight'; } // a travel's kind of ride (no mode: a flight)
function rideData(M, dmeta) { const t = M.t, T = tlRideKm(t.id, t), by = { ...T.by }, C = memTvCtx(M); let est = false;
  const destAt = (d, last) => { const sg = (t.segments || []).filter(g => (!g.from || g.from <= d) && (!g.to || d <= g.to)), g = last ? sg[sg.length - 1] : sg[0], m = g && dmeta(g.dest); return m && m.center ? { lat: m.center[0], lng: m.center[1] } : null; };
  const end = (f, side) => tvEndC(f, side, C) || destAt(side === 'from' ? f.date : travelLandDate(f) || f.date, side === 'to'), home = f => C.home.has(f.id + '|from') || C.home.has(f.id + '|to');
  travelsOf(t).forEach(f => { if (!f.date || T.days.has(f.date) || home(f)) return; const a = end(f, 'from'), b = end(f, 'to'); if (!a || !b) return; const km = kmBetween(a, b); if (km < 0.5) return;
    const k = rideKind(f.mode); by[k] = (by[k] || 0) + km; est = true; });
  Object.keys(by).forEach(k => { by[k] = Math.round(by[k]); if (!by[k]) delete by[k]; });
  return { km: Object.values(by).reduce((n, x) => n + x, 0), est, by }; }
// Q4: a tap on the memory tile - the km by kind (only the kinds present), "משוער" when estimated; a window of the app's kind
function openRideKm(id) { layerNote(openRideKm, arguments); const D = mementoData(id); if (!D) return; const R = D.ride, sheet = document.getElementById('sheet');
  sheet.innerHTML = `${fmHead(`${msi('commute', { size: 20 })} נסיעות${SEP}<bdi>${fmtKm(R.km)}</bdi>`)}
    <div class="ride-rows">${RIDE_KINDS.filter(([k]) => R.by[k]).map(([k, l, ic]) => `<div class="ride-row">${msi(ic, { size: 20 })}<span>${l}</span><b><bdi>${fmtKm(R.by[k])}</bdi></b></div>`).join('')}</div>
    <p class="sh-hint">${msi('info', { size: 16, cls: 'msi-in' })} ${R.est ? (tlOf(id) ? tipText('ride.mixed') : tipText('ride.est')) : tipText('ride.tl')}</p>`;
  showSheetBackdrop('openRideKm'); }
act('memory.ride', c => { openRideKm(c.v); return 'quiet'; });

// ---- exports: PNG, PDF (A4/A3, a sharp image of the picture), print ----
function svgToCanvas(svg, w, h) {
  return localImg('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)).then(img => { if (!img) throw new Error('the drawing did not load'); // one-way (8): the one local loader
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.drawImage(img, 0, 0, w, h); return c; });
}
function pdfFromJpeg(jpegBytes, iw, ih, pw, ph) {
  const enc = new TextEncoder(), parts = [], offs = []; let len = 0;
  const push = b => { const u = typeof b === 'string' ? enc.encode(b) : b; parts.push(u); len += u.length; };
  const obj = (n, body) => { offs[n] = len; push(`${n} 0 obj\n`); body(); push('\nendobj\n'); };
  const m = 24, k = Math.min((pw - 2 * m) / iw, (ph - 2 * m) / ih), dw = iw * k, dh = ih * k, dx = (pw - dw) / 2, dy = (ph - dh) / 2;
  const content = `q ${dw.toFixed(2)} 0 0 ${dh.toFixed(2)} ${dx.toFixed(2)} ${dy.toFixed(2)} cm /Im0 Do Q`;
  push('%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n');
  obj(1, () => push('<< /Type /Catalog /Pages 2 0 R >>'));
  obj(2, () => push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'));
  obj(3, () => push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`));
  obj(4, () => { push(`<< /Type /XObject /Subtype /Image /Width ${iw} /Height ${ih} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`); push(jpegBytes); push('\nendstream'); });
  obj(5, () => push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`));
  const xref = len; push(`xref\n0 6\n0000000000 65535 f \n${[1, 2, 3, 4, 5].map(n => String(offs[n]).padStart(10, '0') + ' 00000 n \n').join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  const out = new Uint8Array(len); let o = 0; parts.forEach(p => { out.set(p, o); o += p.length; }); return out;
}
function currentMementoSVG(id) { // 4.43.0: the picture as I arranged it (the illustrated one gets my point images back)
  const style = mementoStyleOf(id), art = MEMO.get('art:' + id);
  if (style === 'art' && art) return picResolveArt(id, art.svg, art); // trip-picture-credits: with the app's own credits stamped
  return picSVG(picModel(id), style);
}
async function readyMementoBg(id) { return picEnsureBg(id); }
// trip-picture-credits: the illustrated version's stamp names its base's map - that data read from the phone first (no network needed)
async function readyArtCredits(id) { if (mementoStyleOf(id) === 'art') await picLoadGeo(id); }
function mementoBgReady(id) { return picBgReady(id); }
function svgSize(svg) { const m = String(svg).match(/viewBox="\s*[-\d.]+\s+[-\d.]+\s+([\d.]+)\s+([\d.]+)/); return m ? [Number(m[1]), Number(m[2])] : [1000, 1400]; }
async function exportMemento(id, kind) {
  if (!mementoBgReady(id) && svcOnline()) { showToast(SY.map + ' מכין את המפה של התמונה…'); await readyMementoBg(id); }
  if (!mementoBgReady(id) && mementoStyleOf(id) !== 'art') showToast(SY.warn + ' רקע המפה לא נטען, והתמונה נשמרה בלעדיו. אפשר לנסות שוב ממסך הזיכרון');
  await readyArtCredits(id);
  const t = STATE.trips[id], svg = currentMementoSVG(id), [w, h] = svgSize(svg), base = `${PACK.fileName}-${String(t.name).split(' · ')[0].replace(/[^\wא-ת]+/g, '-')}`;
  try {
    if (kind === 'png') { const c = await svgToCanvas(svg, Math.round(w * 2), Math.round(h * 2)); const blob = await new Promise(r => c.toBlob(r, 'image/png'));
      if (await deliverFile(blob, base + '.png', 'image/png')) logEvent('נשמרה תמונת הטיול (PNG): ' + t.name, true); return; }
    if (kind === 'a4' || kind === 'a3') { const land = w > h, [pw, ph] = kind === 'a4' ? [595.28, 841.89] : [841.89, 1190.55], PW = land ? ph : pw, PH = land ? pw : ph;
      const dpi = kind === 'a4' ? 200 : 170, px = Math.round(PW / 72 * dpi), k = Math.min(px / w, Math.round(PH / 72 * dpi) / h);
      const c = await svgToCanvas(svg, Math.round(w * k), Math.round(h * k)), b64 = c.toDataURL('image/jpeg', 0.92).split(',')[1], bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      const pdf = pdfFromJpeg(u, c.width, c.height, PW, PH);
      if (await deliverFile(new Blob([pdf], { type: 'application/pdf' }), `${base}-${kind.toUpperCase()}.pdf`, 'application/pdf')) logEvent(`נשמר PDF ${kind.toUpperCase()} של תמונת הטיול: ` + t.name, true); return; }
    if (kind === 'print') { let pa = document.getElementById('printArea'); if (!pa) { pa = document.createElement('div'); pa.id = 'printArea'; document.body.appendChild(pa); }
      pa.innerHTML = svg; document.body.classList.add('printing'); const end = () => { document.body.classList.remove('printing'); pa.innerHTML = ''; sysOff(window, 'afterprint', end); };
      sysOn(window, 'afterprint', end); try { window.print(); } catch (e) { end(); showToast('ההדפסה לא זמינה כאן. אפשר לשמור PDF'); } setTimeout(end, 60000); }
  } catch (e) { showToast('לא הצלחתי להכין את הקובץ'); }
}

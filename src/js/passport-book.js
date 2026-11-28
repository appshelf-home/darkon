// ================= "הדרכון שלי" - THE PASSPORT BOOK: the stamp, the book, the page turn, its card and sharing (page-look; split from memory-screen.js) =================
// decisions 2026-11-27 · Review of night chain steps 1-4 after 11.67.1, Q10: memory-screen.js stood 1,023 B under the parts' light; the book's named seam
// (ppFitFs .. ppShare, with its gesture) is its own part in the same group, nothing else moved. The model, the stamping and the ways in stay in memory-screen.js.
// ---- the stamp (Q2): drawn by the app, offline - a shape, an ink, a tilt and an ink look (an SVG filter: uneven edges, faint and smudged spots) ----
const ppFitFs = (txt, max, w) => Math.max(7, Math.min(max, w / (Math.max(1, [...String(txt)].length) * 0.56)));
function ppNameLines(name) { const one = ppFitFs(name, 28, 150); if (one >= 19 || !/\s/.test(name.trim())) return [[name, one]];
  const w = name.trim().split(/\s+/); let best = null; for (let i = 1; i < w.length; i++) { const a = w.slice(0, i).join(' '), b = w.slice(i).join(' '), m = Math.max(a.length, b.length); if (!best || m < best.m) best = { a, b, m }; }
  const fs = Math.min(ppFitFs(best.a, 24, 146), ppFitFs(best.b, 24, 146)); return [[best.a, fs], [best.b, fs]]; }
const PP_SHAPE = [ // the outer line and the inner one, inside a 200 x 200 box
  ['<circle cx="100" cy="100" r="94" stroke-width="6"/>', '<circle cx="100" cy="100" r="83" stroke-width="1.6"/>'],
  ['<ellipse cx="100" cy="100" rx="96" ry="80" stroke-width="6"/>', '<ellipse cx="100" cy="100" rx="85" ry="69" stroke-width="1.6"/>'],
  ['<path d="M28 7H172L193 28V172L172 193H28L7 172V28Z" stroke-width="6"/>', '<path d="M33 18H167L182 33V167L167 182H33L18 167V33Z" stroke-width="1.6"/>'],
  ['<path d="M53 9H147L195 100L147 191H53L5 100Z" stroke-width="6"/>', '<path d="M59 20H141L182 100L141 180H59L18 100Z" stroke-width="1.6"/>']];
const ppDates = s => s.from ? tmFmt('range', [s.from, s.to], { year: true }) : '';
// one drawing function (kinds.DRAWINGS 'ppSVG'): a stamp, and the page shared as an image (ppPageSVG) around stamps
function ppSVG(o) { return `<svg viewBox="0 0 ${o.w} ${o.h}"${o.wh ? ` width="${escH(o.w)}" height="${escH(o.h)}"` : ''}${o.at || ''} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${o.body}</svg>`; }
// the ink look: the lines' edges uneven and their spots faint (fid); the words only spotted, never displaced, so they stay legible (fid + 't')
function ppStampBody(s, ch, fid) { const e = escH, nl = ppNameLines(s.name), dt = ppDates(s), two = nl.length > 1, y0 = two ? 84 : 100;
  const t = (y, fs, w, txt) => `<text x="100" y="${y.toFixed(1)}" font-size="${fs.toFixed(1)}" font-weight="${escH(w)}" text-anchor="middle">${e(txt)}</text>`;
  const spots = (id, seed, k) => `<filter id="${escH(id)}"><feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="3" seed="${escH(seed)}" result="sp"/><feColorMatrix in="sp" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 ${k}" result="m"/><feComposite in="SourceGraphic" in2="m" operator="in"/></filter>`;
  return `<defs><filter id="${escH(fid)}" x="-6%" y="-6%" width="112%" height="112%"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed="${escH(ch.n)}" result="g"/><feDisplacementMap in="SourceGraphic" in2="g" scale="3.2" xChannelSelector="R" yChannelSelector="G" result="d"/>`
    + `<feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="3" seed="${escH(ch.n + 11)}" result="sp"/><feColorMatrix in="sp" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -2.4 1.95" result="m"/><feComposite in="d" in2="m" operator="in"/></filter>${spots(fid + 't', ch.n + 11, '-1.2 1.55')}</defs>`
    + `<g filter="url(#${fid})" fill="none" stroke="currentColor">${PP_SHAPE[ch.s % PP_SHAPES].join('')}</g><g filter="url(#${fid}t)" fill="currentColor" font-family="Rubik, Arial, sans-serif">`
    + (s.flag ? `<text x="100" y="${escH(y0 - 30)}" font-size="26" text-anchor="middle">${e(s.flag)}</text>` : '')
    + nl.map(([l, fs], i) => t(y0 + 9 + i * (fs + 1), fs, 700, l)).join('')
    + (dt ? t(two ? 146 : 136, ppFitFs(dt, 17, 136), 500, dt) : '')
    + t(two ? 166 : 160, ppFitFs(s.tname, 14, 104), 400, s.tname) + '</g>'; }
function ppStampHTML(s, i, land) { const ch = ppCharOf(s), h = ppHash(s.key), dx = ((h % 9) - 4) * 0.12, dy = (((h >>> 4) % 9) - 4) * 0.12;
  const lab = [s.name, ppDates(s), s.days ? `${s.days} ימים` : ''].filter(Boolean).join(SEP);
  return `<button type="button" class="pp-st ${PP_INK_CLS[ch.c % PP_INKS]}${land ? ' pp-land' : ''}" style="--r:${ch.r}deg;--dx:${dx.toFixed(2)}em;--dy:${dy.toFixed(2)}em;--d:${(i * 0.55).toFixed(2)}s" data-act="pp.card" data-v="${escH(s.key)}" aria-label="${escH(lab)}">${ppSVG({ w: 200, h: 200, body: ppStampBody(s, ch, 'ppf' + i) })}</button>`; }
// ---- the book (Q5; passport-look Q1-Q10): a full screen - the cover, the details page, a page per trip, the empty page, the back cover; turned as a Hebrew book (the next page from the left) by the finger or the arrows ----
const ppOwner = () => (STATE.settings.deviceName || '').trim();
// the pages (passport-look Q1, Q6, Q8, Q9): 0 the cover, 1 the details page, a page per trip's stamps, the empty page, the back cover
const ppLast = M => M.pages.length + 3, ppIsBlank = (M, p) => p === M.pages.length + 2;
const ppShareable = (M, p) => p < M.pages.length + 2; // not the empty page or the back cover (Q6)
// the details page (Q6): the counts, the countries of the stamps' flags, the month of the first stamped trip, and two code lines
const PP_MRZ = 30, PP_LAT = { 'א': 'A', 'ב': 'B', 'ג': 'G', 'ד': 'D', 'ה': 'H', 'ו': 'O', 'ז': 'Z', 'ח': 'H', 'ט': 'T', 'י': 'I', 'כ': 'K', 'ך': 'K', 'ל': 'L', 'מ': 'M', 'ם': 'M', 'נ': 'N', 'ן': 'N',
  'ס': 'S', 'ע': 'E', 'פ': 'P', 'ף': 'F', 'צ': 'TZ', 'ץ': 'TZ', 'ק': 'K', 'ר': 'R', 'ש': 'SH', 'ת': 'T' }; // a Hebrew name in Latin capitals, one small table; other letters dropped
const ppLatin = nm => [...String(nm).toUpperCase()].map(c => /[A-Z]/.test(c) ? c : PP_LAT[c] || (/\s/.test(c) ? '<' : '')).join('').replace(/<+/g, '<').replace(/^<|<$/g, '');
const ppCC = f => { const cc = [...String(f || '')].map(c => c.codePointAt(0) - 0x1F1E6).filter(n => n >= 0 && n < 26).map(n => String.fromCharCode(65 + n)).join(''); return cc.length === 2 && !NOT_COUNTRY.has(cc) ? cc : ''; };
function ppDetails(M) { const trips = [...new Set(M.stamps.map(s => s.trip))], t = trips.length ? STATE.trips[trips[0]] : null, since = t ? (t.start || t.end || '') : '';
  const d2 = n => String(Math.min(99, n)).padStart(2, '0'), co = new Set(M.stamps.map(s => ppCC(s.flag)).filter(Boolean)).size;
  const l1 = ('P<DRK<<' + ppLatin(ppOwner())).padEnd(PP_MRZ, '<').slice(0, PP_MRZ), l2 = `${d2(M.n)}ST<${d2(trips.length)}TR<${d2(co)}CO<<${since ? since.slice(2, 4) + since.slice(5, 7) : ''}`.padEnd(PP_MRZ, '<').slice(0, PP_MRZ);
  return { trips: trips.length, co, since: since ? tmFmt('month', since) : '', l1, l2 }; }
function ppPageHTML(M, p) {
  if (p === 0) return `<div class="pp-page pp-cover">${logoHTML('l')}</div>`;
  if (p === ppLast(M)) return '<div class="pp-page pp-cover pp-backcv"></div>';
  if (p === 1) { const nm = ppOwner(), D = ppDetails(M), row = (k, v) => `<div><dt>${k}</dt><dd>${v}</dd></div>`;
    return `<div class="pp-page pp-paper pp-det"><h3>פרטי בעל הדרכון</h3><dl class="pp-rows">${nm ? row('שם', `<bdi>${escH(nm)}</bdi>`) : ''}${row('חותמות', `<bdi>${M.n}</bdi>`)}${row('טיולים', `<bdi>${D.trips}</bdi>`)}${row('ארצות', `<bdi>${D.co}</bdi>`)}${row('מאז', D.since ? `<bdi>${D.since}</bdi>` : '–')}</dl>
      ${M.n ? '' : '<p class="pp-hint">עוד אין חותמות. כל טיול שנסגר מוסיף חותמת לכל יעד שלו.</p>'}<div class="pp-mrz" translate="no"><p>${escH(D.l1)}</p><p>${escH(D.l2)}</p></div></div>`; }
  if (ppIsBlank(M, p)) return `<div class="pp-page pp-paper pp-blank"><div class="pp-frame" role="img" aria-label="החותמת הבאה תוטבע כאן">${ppSVG({ w: 200, h: 140, body: '<g transform="rotate(10 100 70)" fill="none" stroke="currentColor"><ellipse cx="100" cy="70" rx="94" ry="60" stroke-width="2.6" stroke-dasharray="8 6"/><ellipse cx="100" cy="70" rx="83" ry="49" stroke-width="1" stroke-dasharray="3 4"/>'
    + '<g fill="currentColor" stroke="none" font-family="Rubik, Arial, sans-serif" font-weight="500" text-anchor="middle"><text x="100" y="64" font-size="17">החותמת הבאה</text><text x="100" y="88" font-size="17">תוטבע כאן</text></g></g>' })}</div></div>`;
  const pg = M.pages[p - 2], land = new Set(PP.land || []); // skipped: .pp-skipped stops the animation, so a redraw keeps it stopped (merge 11.55.0)
  return `<div class="pp-page pp-paper"><div class="pp-grid">${pg.stamps.map((s, i) => ppStampHTML(s, i, land.has(s.key))).join('')}</div><small class="pp-pno"><bdi>${p + 1}</bdi></small></div>`; }
function renderPassportScreen() { const main = document.getElementById('main'), M = ppModel(), P = ppLast(M) + 1;
  PP.page = Math.max(0, Math.min(P - 1, PP.page || 0));
  const pg = PP.page >= 2 && PP.page < M.pages.length + 2 ? M.pages[PP.page - 2] : null, land = PP.land && pg ? pg.stamps.filter(s => PP.land.includes(s.key)).length : 0;
  { const e = screenTop(), tools = e && e.tab === 'passport' && e.el.querySelector('.screen-tools');
    if (tools) { tools.innerHTML = ''; if (ppShareable(M, PP.page)) tools.innerHTML = `<button type="button" class="top-ic" data-act="pp.more" aria-label="עוד פעולות" title="עוד פעולות">${msi('more_vert')}</button>`; } }
  main.innerHTML = `<div class="pp-book${land ? ' pp-landing' : ''}${PP.skip ? ' pp-skipped' : ''}" data-act="pp.skip">
    <div class="pp-sheet g-swipe">${ppPageHTML(M, PP.page)}</div>
    <button type="button" class="top-ic pp-arr pp-prev" data-act="pp.turn" data-v="-1" aria-label="העמוד הקודם" title="העמוד הקודם"${PP.page ? '' : ' disabled'}>${msi('expand_more')}</button>
    <button type="button" class="top-ic pp-arr pp-next" data-act="pp.turn" data-v="1" aria-label="העמוד הבא" title="העמוד הבא"${PP.page < P - 1 ? '' : ' disabled'}>${msi('expand_more')}</button></div>
    ${land ? `<div class="pp-landed"><p>${land === 1 ? 'נוספה חותמת אחת לדרכון' : `נוספו <bdi>${land}</bdi> חותמות לדרכון`}</p>${cardActionsHTML({ act: 'pp.toMem', v: pg.trip, label: msi('photo_album', { size: 18 }) + 'למסך הזיכרון' })}</div>` : ''}`;
  const T = PP.turn; PP.turn = null; if (T) ppTurnPlay(main.querySelector('.pp-sheet'), M, T.from, PP.page, T.f); }
// ---- the page turn (Q5): a leaf turns around the page's right edge - the next page from the left, as a Hebrew book; its back the paper.
// One turn for the arrows and the finger: going forward the page shown is the leaf and the next lies under it; going back the previous
// page is the leaf, coming back from past the spine over the page shown. f: how far the turn has gone (0..1). "Reduce motion": at once.
const ppStill = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
const ppLeafT = (d, f) => `rotateY(${(d > 0 ? f : 1 - f) * 180}deg)`;
function ppTurnShow(sheet, M, from, to) { const d = to > from ? 1 : -1, under = d > 0 ? to : from, leaf = d > 0 ? from : to;
  sheet.classList.add('pp-turning'); sheet._turn = { d, from, to }; const cur = sheet.firstElementChild; // the page shown stays the same node (a finger on it keeps its touch)
  const lf = document.createElement('div'); lf.className = 'pp-leaf'; lf.innerHTML = '<div class="pp-page pp-paper pp-lb"></div>'; if (d < 0) lf.insertAdjacentHTML('afterbegin', ppPageHTML(M, leaf)); sheet.append(lf);
  if (d > 0) { sheet.insertAdjacentHTML('afterbegin', ppPageHTML(M, under)); lf.prepend(cur); } }
function ppTurnSet(sheet, f) { const T = sheet._turn, l = T && sheet.querySelector('.pp-leaf'); if (l) { T.f = f; l.style.transform = ppLeafT(T.d, f); } }
function ppTurnRun(sheet, f1, done) { const T = sheet._turn, l = T && sheet.querySelector('.pp-leaf'); if (!l) { done(); return; }
  const cs = getComputedStyle(document.documentElement), ms = (cssMs('--motion-slow', 250) || 250) * 2.4 * Math.max(.25, Math.abs(f1 - (T.f || 0)));
  const a = l.animate([{ transform: ppLeafT(T.d, T.f || 0) }, { transform: ppLeafT(T.d, f1) }], { duration: ms, easing: cs.getPropertyValue('--ease').trim() || 'ease-out', fill: 'forwards' });
  a.finished.catch(() => {}).then(() => { if (sheet._turn === T) done(); }); }
function ppTurnPlay(sheet, M, from, to, f) { if (!sheet || from === to || ppStill() || !sheet.animate) return;
  ppTurnShow(sheet, M, from, to); ppTurnSet(sheet, f || 0); ppTurnRun(sheet, 1, () => ppTurnDone(sheet, M, to)); }
function ppTurnDone(sheet, M, p) { sheet._turn = null; sheet.classList.remove('pp-turning'); sheet.innerHTML = ppPageHTML(M, p); }
act('pp.turn', c => { const d = Number(c.v) || 0, f = PP.turnF || 0; PP.turnF = 0; PP.turn = ppStill() ? null : { from: PP.page, f }; PP.page += d; PP.land = null; return 'redraw'; });
function ppSkip(el) { if (!PP.land || PP.skip) return false; PP.skip = true; const b = el.closest('.pp-book'); if (b) b.classList.add('pp-skipped'); return true; }
act('pp.skip', c => { ppSkip(c.el); return 'quiet'; }); // a tap anywhere skips the landing (Q4) - on a stamp too, while it lands
act('pp.toMem', () => { PP.land = null; layerBack(); return 'quiet'; });
// TOUCH 'swipe' (Q5): the finger to the right turns to the next page (from the left), to the left back; the leaf follows the finger
// (move), let go past half way (TOUCH.turnAt) it completes through the arrow's own turn, before it falls back (end)
const ppArrow = (el, dir) => el.parentNode.querySelector(`.pp-${dir > 0 ? 'next' : 'prev'}`);
gestureOn('swipe', '.pp-sheet', { can: (el, dir) => !ppArrow(el, dir).disabled,
  move: (el, dir, f) => { if (ppStill()) return; if (!el._turn) ppTurnShow(el, ppModel(), PP.page, PP.page + dir); ppTurnSet(el, f); },
  end: (el, dir, go) => { if (go) { PP.turnF = el._turn ? el._turn.f : 0; ppArrow(el, dir).click(); return; }
    if (el._turn) ppTurnRun(el, 0, () => ppTurnDone(el, ppModel(), PP.page)); } });
// a stamp's card (Q5): the destination, its dates, and the way to its trip's memory
function openPpCard(key) { layerNote(openPpCard, arguments); const s = ppModel().stamps.find(x => x.key === key), sheet = document.getElementById('sheet'); if (!s) return;
  sheet.innerHTML = `${fmHead(withFlag(s.flag, nameB(s.name)))}<p class="pp-cd">${[ppDates(s), s.days ? `<bdi>${s.days}</bdi> ימים` : ''].filter(Boolean).join(SEP) || 'בלי תאריכים'}</p>
    <p class="sh-hint">${msi('luggage', { size: 18, cls: 'msi-in' })} ${escH(s.tname)}</p>${cardActionsHTML({ act: 'pp.mem', v: s.trip, label: msi('photo_album', { size: 18 }) + 'לזיכרון של הטיול' })}`;
  showSheetBackdrop('openPpCard'); }
act('pp.card', c => { if (!ppSkip(c.el)) openPpCard(c.v); return 'quiet'; });
act('pp.mem', c => { closeSheet(); runTripAction(c.v, 'memory'); return 'quiet'; });
// ⋮ (Q6): "שיתוף העמוד" - the page as an image through the one way a file leaves (deliverFile); nothing else is shared
act('pp.more', () => { const sheet = document.getElementById('sheet');
  sheet.innerHTML = `${fmHead('הדרכון שלי')}${taListHTML({ act: 'pp.ta' }, [['share', msi('share', { size: 20 }) + ' שיתוף העמוד', 'העמוד הזה כתמונה']])}`; showSheetBackdrop('ppMore'); return 'quiet'; });
act('pp.ta', () => { closeSheet(); ppShare(); return 'quiet'; });
// the page as shown (passport-look Q6): a stamps page - the paper, its stamps, its number and the app's name small; the cover; the details page
const ppFontMS = () => { try { for (const sh of document.styleSheets) for (const r of sh.cssRules || []) if (r instanceof CSSFontFaceRule && /^["']?MS["']?$/.test(r.style.getPropertyValue('font-family').trim())) return `<style>@font-face{font-family:MS;src:${r.style.getPropertyValue('src')}}</style>`; } catch (e) {} return ''; }; // the logo's plane, in the image too
function ppPageSVG(M, p) { const W = 600, H = 800, css = getComputedStyle(document.documentElement), tk = n => css.getPropertyValue(n).trim() || '#333', e = escH;
  const txt = (x, y, fs, w, t, o) => `<text x="${escH(x)}" y="${escH(y)}" font-size="${escH(fs)}" font-weight="${escH(w)}" text-anchor="${escH((o && o.a) || 'middle')}" fill="${escH(tk('--pp-text'))}" font-family="${escH((o && o.f) || 'Rubik, Arial, sans-serif')}"${o && o.f ? '' : ' direction="rtl"'}${o && o.op ? ` opacity="${escH(o.op)}"` : ''}>${e(t)}</text>`;
  const gv = tk('--pp-grain'), gi = gv.indexOf('data:'), grain = gi < 0 ? '' : gv.slice(gi, gv.lastIndexOf('"')); // the paper's one tile (the token's data URL)
  if (p === 0) { const lg = logoBody(), lw = W * .7;
    return ppSVG({ w: W, h: H, wh: true, body: `${ppFontMS()}<rect width="${escH(W)}" height="${escH(H)}" fill="${escH(tk('--pp-cover'))}"/><g color="${escH(tk('--pp-cover-ink'))}">${ppSVG({ w: 150, h: 100, at: ` x="${escH((W - lw) / 2)}" y="${escH((H - lw / 1.5) / 2)}" width="${escH(lw)}" height="${escH(lw / 1.5)}"`, body: lg })}</g>` }); }
  let body = `<defs><radialGradient id="ppe" cx=".5" cy=".48" r=".62"><stop offset=".62" stop-color="${escH(tk('--pp-line'))}" stop-opacity="0"/><stop offset="1" stop-color="${escH(tk('--pp-line'))}" stop-opacity=".38"/></radialGradient>`
    + (grain ? `<pattern id="ppg" width="200" height="200" patternUnits="userSpaceOnUse"><image href="${escH(grain)}" width="200" height="200"/></pattern>` : '') + '</defs>'
    + `<rect width="${escH(W)}" height="${escH(H)}" fill="${escH(tk('--pp-paper'))}"/>${grain ? `<rect width="${escH(W)}" height="${escH(H)}" fill="url(#ppg)"/>` : ''}<rect width="${escH(W)}" height="${escH(H)}" fill="url(#ppe)"/>`
    + `<rect x="10" y="10" width="${escH(W - 20)}" height="${escH(H - 20)}" rx="22" fill="none" stroke="${escH(tk('--pp-line'))}" stroke-width="2"/>`;
  if (p === 1) { const D = ppDetails(M), rows = [ppOwner() ? ['שם', ppOwner()] : null, ['חותמות', M.n], ['טיולים', D.trips], ['ארצות', D.co], ['מאז', D.since || '–']].filter(Boolean);
    body += txt(W - 60, 90, 22, 500, 'פרטי בעל הדרכון', { a: 'start', op: .8 });
    rows.forEach(([k, v], i) => { const y = 160 + i * 64; body += txt(W - 60, y, 24, 400, k, { a: 'start', op: .8 }) + txt(60, y, 26, 500, String(v), { a: 'end' }) + `<line x1="60" x2="${escH(W - 60)}" y1="${escH(y + 22)}" y2="${escH(y + 22)}" stroke="${escH(tk('--pp-line'))}" stroke-width="1.5"/>`; });
    if (!M.n) body += txt(W / 2, 160 + rows.length * 64 + 20, 20, 400, 'עוד אין חותמות. כל טיול שנסגר מוסיף חותמת לכל יעד שלו.');
    body += `<g direction="ltr">${txt(48, H - 110, 28, 500, D.l1, { a: 'start', f: 'ui-monospace, Courier New, monospace' })}${txt(48, H - 66, 28, 500, D.l2, { a: 'start', f: 'ui-monospace, Courier New, monospace' })}</g>`; }
  else { const pg = M.pages[p - 2]; body += txt(W / 2, H - 62, 20, 400, String(p + 1), { op: .6 }) + txt(W / 2, H - 30, 16, 400, APP.appTitle, { op: .7 });
    pg.stamps.forEach((s, i) => { const ch = ppCharOf(s), x = 40 + (i % 2) * 270, y = 60 + Math.floor(i / 2) * 320;
      body += `<g transform="rotate(${ch.r} ${x + 125} ${y + 125})" color="${escH(tk('--pp-ink' + (ch.c % PP_INKS)))}">${ppSVG({ w: 200, h: 200, at: ` x="${escH(x)}" y="${escH(y)}" width="250" height="250"`, body: ppStampBody(s, ch, 'ppx' + i) })}</g>`; }); }
  return ppSVG({ w: W, h: H, wh: true, body }); }
async function ppShare() { const M = ppModel(), p = PP.page; if (!ppShareable(M, p)) return; try { const c = await svgToCanvas(ppPageSVG(M, p), 1200, 1600), blob = await new Promise(r => c.toBlob(r, 'image/png'));
    if (blob && await deliverFile(blob, `${PACK.fileName}-passport-${p + 1}.png`, 'image/png')) logEvent('שותף עמוד מהדרכון', true); } catch (err) { showToast('לא הצלחתי להכין את התמונה'); } }

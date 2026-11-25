// ================= 4.30.0: MEMENTO - TRIP PICTURE, TRIP SUMMARY, RECOMMENDATIONS, ILLUSTRATED VERSION =================
// Everything the app makes is rebuilt from the trip's snapshot every time it is shown (a better design later improves old
// trips too). Only what can't be rebuilt is stored: photos, the album link, words, and the illustrated version made with
// Claude - in IndexedDB ("mementos"), with its own backup part. A memento must look complete without any photo.
var MEMO_VIEW = {};                   // tripId -> {shape, orient, which}
// ================= 9.8.0: PHOTOS - one mechanism for a photo's whole life (stage 13 part B, T13ב; decisions Q11-Q17) =================
// Mechanism map: spec/photos.md "Photos". Add - the same pair in every place, 📷 camera and 🖼️ gallery (several at once only
// where more than one fits; Wikipedia is a third source only for a point of the trip picture); shrink (one function); crop to a shape
// (a point: small and round); store (the mementos store - its rows in the registry, backup part 🎁; writes only here: photoPut /
// photoDel); show (a thumbnail - a tap enlarges it to the one full-screen view, moved and zoomed by TOUCH 'pic'; the trip picture's ⛶
// is the same view); order (the trip's photos: a long press and drag, TOUCH 'drag' - the first is the cover, "לשים כשער" in the view);
// delete (only in the full-screen view, 🗑️ - to the trash for 30 days, kind 'photo': the image stays in the mementos store under
// "trash:<id>" and the trash entry holds only that reference; the daily cleanup removes it when the entry expires). Each place declares
// only what is its own, in PHOTO_PLACES (by the key's prefix). Outside: drawing the trip picture - map, schematic, tiles, frame
// (checked twice and stays, Q16; the illustrated version's placeholders are filled at display time in picResolveArt).
const MEMO_PHOTO_MAX = 6, PIC_IMG_PX = 256;
const PHOTO_PLACES = {
  hotel: { pre: 'hotel:', n: 1, px: 900, del: true, frame: true, what: 'תמונת המלון' },                                          // the details window of a hotel
  trip: { pre: 'photo:', n: MEMO_PHOTO_MAX, px: 1100, multi: true, del: true, cover: true, frame: true, what: 'תמונה מהטיול' },   // the memory screen and the closing
  point: { pre: 'pimg:', n: 1, px: 900, crop: PIC_IMG_PX, wiki: true, what: 'תמונה של מיקום' },                  // a point of the trip picture
  art: { pre: 'art:', del: true, what: 'הגרסה המאוירת' },                                                          // Claude's illustrated version, one per trip
  report: { pre: 'report:', n: 1, px: 1280, del: true, what: 'תמונה לדיווח' },                                       // 10.7.0: a report's photo - never stored as a photo, it goes (or waits offline) with the report
};
function photoPlace(k) { k = String(k || ''); return Object.keys(PHOTO_PLACES).find(p => k.startsWith(PHOTO_PLACES[p].pre)) || null; }
function photoTripOf(k) { const p = photoPlace(k); return p === 'art' ? String(k).slice(4) : p === 'trip' || p === 'point' ? String(k).split(':')[1] : null; }
function photoUrl(k) { const v = MEMO.get(k); return typeof v === 'string' ? v : null; }
function photoPut(k, v) { return MEMO_DB.put(k, v); } // the only writes of a photo (outside: the registry's own moves - restore, a trip that left the trash, a file)
// hidden-data (H2; decisions 2026-11-24 · Review of the legal-review-2 report, Q11): THE ONE CLEANER of a stored image that comes in. A photo the
// person adds is re-encoded by shrinkImage (a canvas keeps only pixels); one that arrives in a file, a restore or an undo is cleaned here: a JPEG
// loses its APP1-APP15 segments (the camera's block with its location, XMP, maker notes) and its comments and anything after its end; a PNG keeps
// only its picture's chunks (no text, camera block or time). APP0 (JFIF), an APP2 that is an ICC colour profile (the canvas writes one into
// every photo of the app's own) and APP14 (Adobe: only the colour transform's flags) stay - the picture decodes and looks the same. Anything but a data:image/jpeg|png that parses is refused (null): the door drops and counts it (fileClean), the store never writes it
// (MEMO_DB.put). Synchronous, so every write keeps its order; a clean value comes back as the same string.
const PHOTO_PNG_KEEP = new Set(['IHDR', 'PLTE', 'IDAT', 'IEND', 'tRNS', 'gAMA', 'cHRM', 'sRGB', 'sBIT', 'bKGD', 'pHYs']);
function photoClean(v) { const m = typeof v === 'string' && /^data:image\/(jpeg|png);base64,([A-Za-z0-9+/]*={0,2})$/.exec(v); if (!m) return null;
  let b; try { b = atob(m[2]); } catch (e) { return null; }
  const out = m[1] === 'png' ? photoPngStrip(b) : photoJpegStrip(b); if (out == null) return null;
  return out === b ? v : `data:image/${m[1]};base64,${btoa(out)}`; }
// the store's write (MEMO_DB.put): a string under a photo's key is cleaned (null - refused); anything else is the app's own (the illustrated version in the trash)
function photoCleanAt(k, v) { return typeof v === 'string' && FILE_PHOTO_KEY.test(String(k)) ? photoClean(v) : v; }
function photoJpegStrip(b) { const n = b.length, at = i => b.charCodeAt(i); if (n < 4 || at(0) !== 0xFF || at(1) !== 0xD8) return null;
  const keep = ['\xFF\xD8']; let i = 2, cut = false;
  while (i < n) { if (at(i) !== 0xFF) return null; const mk = at(i + 1); if (mk === 0xFF) { i++; continue; } // a fill byte
    if (mk === 0xD9) { keep.push('\xFF\xD9'); cut = cut || i + 2 < n; break; } // the end: what follows it (a trailer, a second picture) goes
    if ((mk >= 0xD0 && mk <= 0xD7) || mk === 0x01) { keep.push(b.substr(i, 2)); i += 2; continue; }
    if (i + 3 >= n) return null; const L = (at(i + 2) << 8) | at(i + 3); if (L < 2 || i + 2 + L > n) return null; let end = i + 2 + L;
    if (mk === 0xDA) { for (;;) { end = b.indexOf('\xFF', end); if (end < 0 || end + 1 >= n) { end = n; break; } const x = at(end + 1); if (x !== 0 && !(x >= 0xD0 && x <= 0xD7)) break; end += 2; } } // a scan runs to the next marker
    if ((mk >= 0xE1 && mk <= 0xEF && mk !== 0xEE && !(mk === 0xE2 && b.substr(i + 4, 12) === 'ICC_PROFILE\0')) || mk === 0xFE) cut = true; else keep.push(b.slice(i, end));
    i = end; }
  return cut ? keep.join('') : b; }
function photoPngStrip(b) { if (b.slice(0, 8) !== '\x89PNG\r\n\x1a\n') return null; const n = b.length, keep = [b.slice(0, 8)]; let i = 8, cut = false;
  while (i + 12 <= n) { const L = ((b.charCodeAt(i) << 24) | (b.charCodeAt(i + 1) << 16) | (b.charCodeAt(i + 2) << 8) | b.charCodeAt(i + 3)) >>> 0, ty = b.substr(i + 4, 4), end = i + 12 + L;
    if (end > n) return null; if (PHOTO_PNG_KEEP.has(ty)) keep.push(b.slice(i, end)); else cut = true; i = end; if (ty === 'IEND') break; }
  if (i < n) cut = true; return cut ? keep.join('') : b; }
function photoDel(k) { return MEMO_DB.del(k); }
function photoReadOnly(k) { return photoPlace(k) === 'hotel' && (!!activeTripObj().archived || !!ARCHIVE_VIEW); }
// ---- add: 📷 camera and 🖼️ gallery (standard), one look - the compact icon buttons; names on a long press ----
function photoAddHTML(act, o) { o = { ...(o || {}), words: true }; const b = (title, label, x) => fmFile({ cls: 'ph-btn' + (o.words ? ' ph-word' : ''), title, label, accept: 'image/*', inCls: 'vh-input', act, v: o.v, data: 'data-photo-add', ...x });
  return `<span class="ph-add">${b('מצלמה', msi('photo_camera', { size: 18 }) + ' צילום', { capture: 'environment' })}${b(o.multi ? 'גלריה - אפשר כמה יחד' : 'גלריה', msi('image', { size: 18 }) + ' מהגלריה', { multiple: !!o.multi })}</span>`; // 10.7.1: the pair in words (a form row, look.md "Reporting")
}
async function photoRead(inp, px) { const fs = [...(inp.files || [])], out = []; inp.value = '';
  for (const f of fs) { try { out.push(await shrinkImage(f, px)); } catch (e) { showToast('התמונה לא נקראה'); } }
  return out; }
// the one shrink: the longest side to max px, JPEG (sizes per place in PHOTO_PLACES - hotel 900, trip 1,100, a point 900 before its crop)
// one-way (8): THE ONE LOCAL IMAGE LOADER - an image of the phone itself (data: / blob:), with a time limit and a real size; null when it
// does not load. Every local image loads here: a photo being shrunk, a drawing turned into a canvas (svgToCanvas), the picture editor's images.
function localImg(url) { return new Promise(res => { const im = new Image(); let done = false; const fin = ok => { if (done) return; done = true; res(ok ? im : null); }; // only data: / blob: - nothing leaves the phone
  im.onload = () => fin(im.naturalWidth > 0); im.onerror = () => fin(false); setTimeout(() => fin(false), 20000); im.src = url; }); }
function shrinkImage(file, max) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); }).then(localImg).then(img => {
  if (!img) throw new Error('the image did not load'); const k = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', 0.72); }); }
// crop to a shape (a point of the trip picture): the small square image, shown round - crop {cx, cy, k} - the centre (0..1 of the image) and the zoom over "cover"
function photoCropTo(im, crop) { const w = im.naturalWidth, h = im.naturalHeight, k = Math.max(1, crop.k || 1), s0 = Math.max(PIC_IMG_PX / w, PIC_IMG_PX / h), s = s0 * k, size = PIC_IMG_PX / s;
  const sx = Math.max(0, Math.min(w - size, (crop.cx == null ? .5 : crop.cx) * w - size / 2)), sy = Math.max(0, Math.min(h - size, (crop.cy == null ? .45 : crop.cy) * h - size / 2));
  const c = document.createElement('canvas'); c.width = PIC_IMG_PX; c.height = PIC_IMG_PX; c.getContext('2d').drawImage(im, sx, sy, size, size, 0, 0, PIC_IMG_PX, PIC_IMG_PX); return c.toDataURL('image/jpeg', 0.82); }
// ---- framing (11.31.0, photo-frame; decisions 2026-11-19 · Framing my photos): one framing per photo, every place cuts its own shape
// (square, wide, circle) around it. { cx, cy, k, r }: the photo's point (cx, cy - 0..1 of the image) sits at the same fraction of every
// shape it is cut to (the CSS object-position rule, so a box of any size needs no measuring), zoomed k ≥ 1 over "cover" about that
// point; r is the image's width / height (a drawing cuts it without loading it). Kept in the mementos store beside the photo
// ("frame:<photo key>", in the photo's own registry row - backup, restore, undo); a photo in the trash keeps it in its trash entry.
// No framing = the centre, as before. The image itself never changes. One technique: photoImgHTML (a page) and photoImageSVG (a drawing).
const PHOTO_FRAME_PRE = 'frame:';
function photoFrame(k) { const v = k ? MEMO.get(PHOTO_FRAME_PRE + k) : null; return v && typeof v === 'object' && v.cx != null ? v : null; }
function photoFrameStyle(k) { const f = photoFrame(k); if (!f) return ''; const p = `${(f.cx * 100).toFixed(2)}% ${(f.cy * 100).toFixed(2)}%`;
  return `object-position:${p};transform-origin:${p}${f.k > 1 ? `;transform:scale(${+f.k.toFixed(3)})` : ''}`; }
// the photo cut to its box (the box clips: overflow hidden) - every <img> of a stored photo shown cut
function photoImgHTML(k, u) { const st = photoFrameStyle(k); return `<img src="${escH(u)}" alt=""${st ? ` style="${st}"` : ''}>`; }
// the same cut in a drawing (the trip picture, its export): an <image> in the box x, y, w, h (the caller clips it to its shape)
function photoImageSVG(k, u, x, y, w, h, more) { const f = photoFrame(k), m = more || '', P = PHOTO_PAGE.cur, r1 = v => +(+v).toFixed(1); let sl = false; // the stored photo's data URL, escaped
  if (P) { u = P.cuts && P.cuts.get(photoCutKey(k, w, h)); if (!u) { if (P.need) P.need.set(photoCutKey(k, w, h), { k, w, h }); return ''; } } // hidden-data (H3): a page carries the cut, not the photo
  else if (f && f.r) { const K = Math.max(1, f.k || 1), iw = Math.max(w, h * f.r) * K, ih = iw / f.r; x = r1(x + f.cx * (w - iw)); y = r1(y + f.cy * (h - ih)); w = r1(iw); h = r1(ih); }
  else sl = true;
  return `<image ${svgHref(u)} x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="${sl ? 'xMidYMid slice' : 'none'}"${m}/>`; }
// an <image>'s address: href and its old twin xlink:href in the app's own drawings (the export's canvas), href alone in a page (H3 d: one copy of the bytes)
function svgHref(u) { return PHOTO_PAGE.cur ? `href="${escH(u)}"` : `href="${escH(u)}" xlink:href="${escH(u)}"`; }
// ---- hidden-data (H3; decisions 2026-11-24 · Review of the legal-review-2 report, Q11): a page for people carries only what it shows. THE ONE
// CUTTER: a stored photo cut to the shape it is shown in (the box w × h, around its framing - the same rule as photoImgHTML and photoImageSVG), at
// about twice its displayed size (px for the box's longer side; never larger than the photo has), re-encoded - so the cut-away part never travels.
// The trip summary's grid (480), the recommendations' thumbnail (128), the trip picture's circles (twice their size in the picture's own units -
// photoPageSVG) and the memory map's thumbnails on a page (240, memPhotoThumb) all come from here.
const PHOTO_PAGE = { cur: null }; // cur, while a page's drawing is made: { need } (the first pass collects the boxes) or { cuts } (the second draws them); { off } - no photo
const photoCutKey = (k, w, h) => `${k}|${+(+w).toFixed(1)}|${+(+h).toFixed(1)}`;
async function photoCut(k, w, h, px) { const u = photoUrl(k), im = u ? await localImg(u) : null; if (!im) return null;
  const W = im.naturalWidth, H = im.naturalHeight, f = photoFrame(k) || { cx: .5, cy: .5, k: 1 }, K = Math.max(1, f.k || 1), r = W / H;
  const iw = Math.max(w, h * r) * K, ih = iw / r, sx = -f.cx * (w - iw) / iw * W, sy = -f.cy * (h - ih) / ih * H, sw = w / iw * W, sh = h / ih * H;
  const sc = Math.min(px / Math.max(w, h), sw / w), c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w * sc)); c.height = Math.max(1, Math.round(h * sc));
  c.getContext('2d').drawImage(im, sx, sy, sw, sh, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', 0.8); }
// a page's <img> of a stored photo: its square cut (the box clips it as before); '' when it does not load
async function photoPageImg(k, px) { const c = await photoCut(k, 1, 1, px); return c ? `<img src="${escH(c)}" alt="">` : ''; }
// a drawing for a page (the trip picture in the summary): drawn once to learn its photos' boxes, the cuts made, drawn again with them;
// o.off - drawn with no photo at all (the window's "התמונות" off: picSVG leaves the circles to their icons)
async function photoPageSVG(make, o) { o = o || {}; const run = cur => { PHOTO_PAGE.cur = cur; try { return make(); } finally { PHOTO_PAGE.cur = null; } };
  if (o.off) return run({ off: true }); const need = new Map(); run({ need });
  const cuts = new Map(); for (const [key, q] of need) { const c = await photoCut(q.k, q.w, q.h, 2 * Math.max(q.w, q.h)); if (c) cuts.set(key, c); }
  return run({ cuts }); }
// a page's drawing without photos (o.off): no cover, no highlight's photo, no photo of my own on a point
function photoPageOff() { return !!(PHOTO_PAGE.cur && PHOTO_PAGE.cur.off); }
// the trip picture (picSVG): photoOff - no cover and no highlight's photo (the AI's base - placeholders only - or a page without photos);
// photoOwn - a point's picture, but not my own photo in a page without photos
function photoOff(o) { return !!(o && o.base) || photoPageOff(); }
function photoOwn(img) { return img && !(img.src === 'own' && photoPageOff()) ? img : null; }
// the illustrated version in a page (picResolveArt, before its placeholders are filled): one copy of every image's bytes (H3 d), and with no
// photos my own photo on a point is left out too (a Wikipedia picture is not mine and stays)
function photoPageArt(id, root) { if (!PHOTO_PAGE.cur) return; const img = picOf(id).img || {};
  root.querySelectorAll('*').forEach(el => { if (el.hasAttribute('href')) el.removeAttribute('xlink:href'); const h = el.getAttribute('href') || '';
    if (photoPageOff() && h.startsWith('pimg:') && (img[h.slice(5)] || {}).src === 'own') el.setAttribute('href', ''); }); }
// saves a framing (with undo); the centre with no zoom stores nothing
async function photoFrameSet(k, c, im) { const fk = PHOTO_FRAME_PRE + k, old = photoFrame(k), r3 = v => Math.round(v * 1000) / 1000;
  const f = { cx: r3(Math.max(0, Math.min(1, c.cx))), cy: r3(Math.max(0, Math.min(1, c.cy))), k: r3(Math.max(1, c.k || 1)), r: r3(im.naturalWidth / im.naturalHeight) };
  const centre = Math.abs(f.cx - .5) < .005 && Math.abs(f.cy - .5) < .005 && f.k < 1.005;
  if (centre ? !old : old && old.cx === f.cx && old.cy === f.cy && old.k === f.k) return;
  if (centre) await photoDel(fk); else if (!(await photoPut(fk, f))) return;
  showUndoToast(centre ? 'התמונה חזרה למרכז' : 'המסגור של התמונה נשמר'); }
// ---- show: a thumbnail is a button - a tap enlarges it (o.act: a picker's own action instead) ----
function photoThumbHTML(k, o) { o = o || {}; const u = photoUrl(k); if (!u) return '';
  return `<button type="button" class="ph-img${o.cls ? ' ' + o.cls : ''}" data-act="${o.act || 'photo.view'}" data-v="${escH(k)}"${o.data ? ' ' + o.data : ''}${o.on != null ? ` aria-pressed="${!!o.on}"` : ''} aria-label="${escH(o.label || 'הגדלה')}">${photoImgHTML(k, u)}${o.badge ? `<span class="ph-badge">${o.badge}</span>` : ''}</button>`; }
act('photo.view', c => { openPhotoView({ key: c.v, name: c.el.dataset.name || '' }); return 'quiet'; });
// 10.7.0: a photo that is not stored (a report's) - the same thumbnail; a tap (o.act) enlarges it in the one view ({ url, place, del })
function photoDraftHTML(url, o) { o = o || {}; if (!url) return '';
  return `<button type="button" class="ph-img${o.cls ? ' ' + o.cls : ''}" data-act="${o.act}" aria-label="${escH(o.label || 'הגדלה')}"><img src="${escH(url)}" alt=""></button>`; } // 11.8.0 (small-fixes item 4): a stored value into an attribute is escaped (the second line after the door check)
// the one full-screen view (Q13): a stored photo ({ key }) or the trip picture ({ pic: trip, byTurn } - ⛶, also Claude's illustrated
// version); move and zoom (TOUCH 'pic', up to ×8), ✕, and per place 🗑️ (where the place allows) and "לשים כשער" (the trip's photos)
function openPhotoView(o) { const ctl = {};
  if (PIC_FS.open) closePhotoView();
  const art = o.pic != null && !(PIC_ED && PIC_ED.id === o.pic) && mementoStyleOf(o.pic) === 'art' ? 'art:' + o.pic : null, key = o.key || art, P = PHOTO_PLACES[o.url ? o.place : photoPlace(key)] || {};
  Object.assign(PIC_FS, { open: true, id: o.pic != null ? o.pic : null, key: o.key || null, url: o.url || null, name: o.name || '', byTurn: !!o.byTurn, k: 1, x: 0, y: 0 });
  const acts = [];
  if (o.url && P.del && o.del) acts.push(`<button type="button" class="ph-vbtn" data-act="${o.del}">${msi('delete')}<span>מחיקה</span></button>`); // a photo not stored: out of its form, nothing to the trash
  if (o.key && P.cover && tripPhotoKeys(photoTripOf(key))[0] !== key) acts.push(`<button type="button" class="ph-vbtn" data-act="photo.cover" data-v="${escH(key)}">${msi('image')}<span>לשים כשער</span></button>`);
  if (o.key && P.frame && !photoReadOnly(key)) acts.push(`<button type="button" class="ph-vbtn" data-act="photo.frame" data-v="${escH(key)}">${msi('crop')}<span>מסגור</span></button>`); // 11.31.0 (photo-frame, Q2)
  if (key && P.del && !photoReadOnly(key)) acts.push(`<button type="button" class="ph-vbtn" data-act="photo.del" data-v="${escH(key)}">${msi('delete')}<span>מחיקה</span></button>`);
  const el = document.createElement('div'); el.className = 'tp-fs'; el.id = 'tpFsv'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', o.key || o.url ? P.what : 'תמונת הטיול במסך מלא');
  // 10.5.0 (design-4 part 2, look.md "Photos"): full screen on black - ✕ and "N מתוך M" on top, the caption, the actions as icon + word at the bottom
  const ks = o.key && P.cover ? tripPhotoKeys(photoTripOf(key)) : [], at = ks.indexOf(o.key), cnt = at >= 0 && ks.length > 1 ? `${at + 1} מתוך ${ks.length}` : '';
  el.innerHTML = `<div class="tp-fsin" id="tpFsIn"></div><div class="ph-vtop"><button type="button" class="tp-x tp-fsx" id="tpFsX" data-act="picFs.tpFsX" aria-label="סגירה" title="סגירה">${msi('close')}</button>${cnt ? `<b class="ph-vcnt">${cnt}</b>` : ''}</div>${o.name ? `<div class="ph-vcap">${escH(o.name)}</div>` : ''}${acts.length ? `<div class="ph-vacts">${acts.join('')}</div>` : ''}`;
  document.body.appendChild(el); photoViewDraw();
  layerPush('picFs', 'full', fp => closePhotoView(fp)); layerTop().ctl = ctl; // 5.4.0
  if (o.byTurn && el.requestFullscreen) el.requestFullscreen().catch(() => {});
  ctl.tpFsX = () => closePhotoView();
  const inn = el.querySelector('#tpFsIn'), apply = () => { inn.style.transform = `translate(${PIC_FS.x}px, ${PIC_FS.y}px) scale(${PIC_FS.k})`; };
  picGesture(el, { max: 8, dblIn: 2.5, k: () => PIC_FS.k, pan: (dx, dy) => { PIC_FS.x += dx; PIC_FS.y += dy; apply(); }, zoom: k => { PIC_FS.k = k; apply(); }, // TOUCH 'pic'
    reset: () => { PIC_FS.k = 1; PIC_FS.x = 0; PIC_FS.y = 0; apply(); }, settle: () => { if (PIC_FS.k <= 1.02) { PIC_FS.k = 1; PIC_FS.x = 0; PIC_FS.y = 0; apply(); } } });
}
ctlActs('picFs', ['tpFsX']);
function photoViewDraw() { const inn = document.getElementById('tpFsIn'); if (!inn) return; const id = PIC_FS.id;
  if (PIC_FS.url || PIC_FS.key) inn.innerHTML = `<img class="ph-vimg" src="${escH(PIC_FS.url || photoUrl(PIC_FS.key) || '')}" alt="">`;
  else { const st = mementoStyleOf(id); inn.innerHTML = PIC_ED && PIC_ED.id === id ? picSVG(picModel(id), st === 'art' ? 'schem' : st, {}) : currentMementoSVG(id); }
  inn.style.transform = `translate(${PIC_FS.x}px, ${PIC_FS.y}px) scale(${PIC_FS.k})`; }
function closePhotoView(fromPop) {
  if (!PIC_FS.open) return; PIC_FS.open = false; const el = document.getElementById('tpFsv'); if (el) el.remove();
  if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
  layerDone('picFs', fromPop); if (PIC_FS.id != null) memPicSync(); // 5.4.0; round6-behaviour (G122): the memory screen's picture, if its background came meanwhile
}
act('photo.cover', c => { const k = c.v, id = photoTripOf(k), ks = tripPhotoKeys(id); closePhotoView(); if (ks[0] !== k) photoOrderSet(id, [k, ...ks.filter(x => x !== k)], '🖼️ תמונת השער הוחלפה'); });
act('photo.frame', c => { const k = c.v, u = photoUrl(k); closePhotoView(); if (u) openPicCrop(null, k, u, 'frame', photoFrame(k)); return 'quiet'; });
act('photo.del', c => { const k = c.v, name = PIC_FS.name; closePhotoView(); photoToTrash(k, name); });
// ---- delete (Q15, Q16): to the trash for 30 days; the image moves to "trash:<id>" in the same store, the entry holds the reference ----
// quiet: the caller shows the one toast of its action (undo-history: a replaced illustrated version, Q3)
async function photoToTrash(k, name, quiet) {
  const pl = photoPlace(k), v = MEMO.get(k); if (!pl || v == null) return;
  const tid = photoTripOf(k), t = tid ? STATE.trips[tid] : null, tn = t ? String(t.name).split(' · ')[0] : '', td = tid ? tdOf(tid) : null, id = newTrashId();
  const e = { id, kind: 'photo', at: Date.now(), key: k, ref: 'trash:' + id, trip: tid || undefined,
    entry: { data: { name: pl === 'hotel' ? `תמונת המלון${name ? ': ' + name : ''}` : pl === 'art' ? `${SY.claude} הגרסה המאוירת: ${tn}` : `תמונה מהטיול: ${tn}` } } };
  if (pl === 'trip') { e.idx = tripPhotoKeys(tid).indexOf(k); e.hl = (td.highlights || []).filter(h => h.photo === k).map(h => h.id); }
  if (pl === 'art') e.style = mementoStyleOf(tid) === 'art';
  const fr = photoFrame(k); if (fr) e.frame = fr; // 11.31.0: the framing waits with the photo in its trash entry
  if (!(await photoPut(e.ref, v))) return; await photoDel(k); if (fr) await photoDel(PHOTO_FRAME_PRE + k);
  if (pl === 'trip') { td.photoOrder = tripPhotoKeys(tid); td.highlights = (td.highlights || []).map(h => h.photo === k ? { ...h, photo: undefined } : h); }
  if (pl === 'art' && e.style) { td.mementoStyle = 'schem'; if (MEMO_VIEW[tid]) MEMO_VIEW[tid].style = 'schem'; }
  if (td) tdSave(tid);
  STATE.trash.push(e); persist();
  if (!quiet) showUndoToast(`${SY.del} ${pl === 'hotel' ? 'תמונת המלון עברה' : pl === 'art' ? 'הגרסה המאוירת עברה' : 'התמונה עברה'} לסל (30 יום)`);
}
async function photoBack(t) {
  const pl = photoPlace(t.key), tid = t.trip, v = MEMO.get(t.ref);
  if (tid && !STATE.trips[tid]) { showToast('הטיול של התמונה הזו כבר לא קיים'); return; }
  if (MEMO.has(t.key)) { showToast(pl === 'hotel' ? 'יש כבר תמונה למלון הזה. אפשר למחוק אותה ואז לשחזר' : 'יש כבר גרסה מאוירת לטיול הזה. אפשר למחוק אותה ואז לשחזר'); return; }
  if (pl === 'trip' && memoPhotoCount(tid) >= MEMO_PHOTO_MAX) { showToast(`עד ${MEMO_PHOTO_MAX} תמונות לטיול. אפשר למחוק אחת ואז לשחזר`); return; }
  if (v == null) { showToast('התמונה לא נמצאה בטלפון. אפשר למחוק את הרשומה מהסל'); return; }
  if (!(await photoPut(t.key, v))) return; await photoDel(t.ref); if (t.frame) await photoPut(PHOTO_FRAME_PRE + t.key, t.frame); STATE.trash = STATE.trash.filter(x => x.id !== t.id);
  if (pl === 'trip') { const td = tdOf(tid), ks = tripPhotoKeys(tid).filter(k => k !== t.key); ks.splice(Math.max(0, Math.min(ks.length, t.idx)), 0, t.key); td.photoOrder = ks;
    td.highlights = (td.highlights || []).map(h => (t.hl || []).includes(h.id) && !h.photo ? { ...h, photo: t.key } : h); } // the highlight gets its photo back
  if (pl === 'art' && t.style) { tdOf(tid).mementoStyle = 'art'; if (MEMO_VIEW[tid]) MEMO_VIEW[tid].style = 'art'; }
  if (tid) tdSave(tid); persist();
  showUndoToast('שוחזרה מהסל: ' + t.entry.data.name);
}
function photoGone(ref) { if (String(ref).startsWith('trash:')) photoDel(ref); } // a photo left the trash for good (after the undo - regRunPurges)
function photoTrashOrphans() { [...MEMO.keys()].filter(k => String(k).startsWith('trash:') && !STATE.trash.some(t => t.ref === k)).forEach(photoDel);
  [...MEMO.keys()].filter(k => String(k).startsWith(PHOTO_FRAME_PRE) && !MEMO.has(String(k).slice(PHOTO_FRAME_PRE.length))).forEach(photoDel); } // 11.31.0: a framing whose photo is gone
// ---- the hotel's photo (ר5: keyed by the place relative to its destination - hotelRef); the pair, and the Google Maps link ----
function hotelPhotoHTML(p, ro) { const k = 'hotel:' + hotelRef(p.id);
  return `${photoThumbHTML(k, { cls: 'hc-photo', label: 'תמונת המלון - הגדלה', data: `data-name="${escH(p.name)}"` })}${ro ? '' : `<div class="brow tight hc-ph">${photoAddHTML('hotel.photo')}<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([p.name, p.address].filter(Boolean).join(' '))}" target="_blank" rel="noopener">${msi('photo_library', { size: 18 })} תמונות ב-Google Maps</a></div>`}`; }
act('hotel.photo', async c => { const x = c.ref && c.ref.obj; if (!x || !x.place) return; const [url] = await photoRead(c.el, PHOTO_PLACES.hotel.px); if (!url) return;
  const k = 'hotel:' + hotelRef(Number(x.place.id)), old = photoUrl(k); if (!(await photoPut(k, url))) return; if (photoFrame(k)) await photoDel(PHOTO_FRAME_PRE + k); // a new image starts at the centre
  showUndoToast(old ? 'התמונה של המלון הוחלפה' : 'התמונה נשמרה במכשיר'); });
// ---- the trip's photos (4.35.0): up to 6, in the order of td.photoOrder; the first is the cover ("שער"); a highlight points at one (h.photo) ----
function memoPhotoCount(id) { return [...MEMO.keys()].filter(k => k.startsWith('photo:' + id + ':')).length; }
function tripPhotoKeys(id) { const pre = 'photo:' + id + ':', have = [...MEMO.keys()].filter(k => k.startsWith(pre)), ord = ((STATE.tripData[id] || {}).photoOrder || []).filter(k => have.includes(k));
  const rest = have.filter(k => !ord.includes(k)).sort((a, b) => (a.endsWith(':cover') ? -1 : 0) - (b.endsWith(':cover') ? -1 : 0)); return ord.concat(rest); }
function tripCover(id) { const k = tripPhotoKeys(id)[0]; return k ? MEMO.get(k) : null; }
// 10.3.0 (design-3): a trip's cover on the trips screen - its first photo, or a drawn landscape in a soft color of its own
function tripCoverHTML(id) { const u = tripCover(id); if (typeof u === 'string') return `<span class="ent-img ph-cut">${photoImgHTML(tripPhotoKeys(id)[0], u)}</span>`; // 11.31.0: cut around its framing
  let h = 0; for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) % 360; const hue = (200 + h % 80) % 360;
  return `<svg class="ent-img" style="--ch:${hue};--ch2:${(hue + 20) % 360}" viewBox="0 0 320 120" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="eg${h}" x1="0" y1="0" x2="0" y2="1"><stop class="cv-s1" offset="0"/><stop class="cv-s2" offset="1"/></linearGradient></defs><rect width="320" height="120" fill="url(#eg${h})"/><circle class="cv-sun" cx="${90 + h % 140}" cy="42" r="14"/><path class="cv-h1" d="M0 92 L60 50 L110 80 L170 34 L240 78 L280 58 L320 74 V120 H0Z"/><path class="cv-h2" d="M0 104 L80 76 L150 98 L220 72 L320 96 V120 H0Z"/></svg>`; } // final review Q6: the tones are tokens (css/screens.css .cv-*), so the drawing follows the mode - dusk in dark
// undo-history (Q6 (2)): no log row per photo - the caller's one undo toast is the row of the whole add (its undo removes them)
async function memoAddPhotos(id, urls) { const added = [];
  for (const url of urls) { if (memoPhotoCount(id) >= MEMO_PHOTO_MAX) { showToast(`עד ${MEMO_PHOTO_MAX} תמונות לטיול${urls.length > added.length ? (SEP + 'השאר לא נוספו') : ''}`); break; }
    const k = `photo:${id}:p_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`; if (await photoPut(k, url)) added.push(k); }
  if (added.length) { const td = tdOf(id); td.photoOrder = tripPhotoKeys(id).filter(k => !added.includes(k)).concat(added); tdSave(id); }
  return added; }
function photosBoxHTML(id) { const ks = tripPhotoKeys(id), n = ks.length;
  return `<div class="ph-box"><div class="ph-grid" data-phtrip="${escH(id)}">${ks.map((k, i) => `<div class="ph-cell${i ? '' : ' cover'}" data-phk="${escH(k)}">${photoThumbHTML(k, { badge: i ? '' : 'שער', label: i ? 'הגדלה' : 'תמונת השער - הגדלה' })}</div>`).join('')}
    ${n < MEMO_PHOTO_MAX ? photoAddHTML('photos.phadd', { multi: true }) : ''}</div>
    <small class="sh-hint">${n}/${MEMO_PHOTO_MAX}</small></div>`; }
function photosBoxCtl(root, id, redraw) { const ctl = ctlNS('photos');
  ctl.phadd = async inp => { const a = await memoAddPhotos(id, await photoRead(inp, PHOTO_PLACES.trip.px)); if (!a.length) return;
    const tn = String((STATE.trips[id] || {}).name || '').split(' · ')[0];
    showUndoToast(`${a.length === 1 ? 'נוספה תמונה' : 'נוספו ' + a.length + ' תמונות'} למזכרות של ${tn}`); redraw(); // undo-history: the row before the redraw (the closing's redraw saves its fields)
    if (tripPhotoKeys(id).length > 1) { const ctx = explainCtx(); const cell = () => document.querySelectorAll('.ph-grid .ph-cell')[1]; setTimeout(() => hintOnce('hint.cover', cell, ctx), 300); } }; // 9.6.0 (12ו, batch 11.3); 9.8.0: the order by drag
}
ctlActs('photos', ['phadd']);
// order and cover (Q14): a long press lifts a thumbnail and it is dragged (TOUCH 'drag', a grid - no handle, Q6b); "לשים כשער" in the view
gestureOn('drag', '.ph-grid[data-phtrip] .ph-cell', { hold: true, grid: true, items: '.ph-cell', zones: c => [c.closest('.ph-grid')],
  drop: (c, to) => { const g = c.closest('.ph-grid'), id = g.dataset.phtrip, ks = [...g.querySelectorAll('.ph-cell')].filter(x => x !== c).map(x => x.dataset.phk); ks.splice(to.idx, 0, c.dataset.phk);
    photoOrderSet(id, ks, ks[0] !== tripPhotoKeys(id)[0] ? '🖼️ תמונת השער הוחלפה' : '📷 סדר התמונות שונה'); } });
function photoOrderSet(id, ks, msg) { const td = tdOf(id); td.photoOrder = ks; tdSave(id); showUndoToast(msg); }
// pick from the existing photos (a highlight): the same thumbnails in one row, with "בלי"
function hlPhotoPickHTML(id, h) { const ks = tripPhotoKeys(id); if (!ks.length) return ''; const hd = `data-hlpick="${escH(h.id)}"`;
  return `<div class="ph-row" role="group" aria-label="תמונה לרגע השיא"><button type="button" class="ph-img ph-none" data-act="hlPick.hlpick" data-v="" ${hd} aria-pressed="${!h.photo}">בלי</button>${ks.map(k => photoThumbHTML(k, { act: 'hlPick.hlpick', on: h.photo === k, label: 'בחירת התמונה', data: hd })).join('')}</div>`; }
function hlPickCtl(root, id, redraw) { const ctl = ctlNS('hlPick'); ctl.hlpick = b => { const td = tdOf(id), hid = b.dataset.hlpick, k = b.dataset.v || undefined;
  const prev = JSON.stringify(td.highlights || []); td.highlights = (td.highlights || []).map(h => h.id === hid ? { ...h, photo: k } : h); tdSave(id);
  if (JSON.stringify(td.highlights) !== prev) showUndoToast(k ? '📷 נבחרה תמונה לרגע השיא' : 'רגע השיא בלי תמונה'); redraw(); }; // undo-history: a change of data is a row
  ctl.hlwhere = b => { const td = tdOf(id), hid = b.dataset.hlwhere, v = b.value ? Number(b.value) : null; if (v == null) return 'quiet'; // memory-photos (Q4): a place for a highlight that had none
    td.highlights = (td.highlights || []).map(h => h.id === hid ? { ...h, placeId: v } : h); tdSave(id); const M = tripMemoryData(id), p = M && M.pmap.get(v); showUndoToast(`✨ רגע השיא במקום${p ? ': ' + p.name : ''}`); redraw(); }; }
ctlActs('hlPick', ['hlpick', 'hlwhere']);
function memoryPhotoHTML(h) { return h.photo ? photoThumbHTML(h.photo, { cls: 'mh-photo' }) : ''; }
// ---- photos sent to Claude: one path - the stored point images by their placeholder key (standard: href="pimg:KEY" + an images map) ----
function photoImagesOut(id, keys) { const o = {}; keys.forEach(k => { const u = k && photoUrl(`pimg:${id}:${k}`); if (u) o[k] = u; }); return o; }
// ✂️ crop: the image under a round window - drag to move, pinch / wheel / slider to zoom, a double tap back to the original size, "↺ אוטומטי" back to the centre
// 11.31.0 (photo-frame, Q3): the one crop and framing tool. kind 'own' / 'wiki' - a point of the trip picture: the circle, saved as a cut
// copy (as before). kind 'frame' - a stored photo's framing (key): the shape chooser "ריבוע · רחב · עיגול" at the bottom; the frame over
// the dimmed photo follows the shape (wide = 33:19, the trips screen's memory card), the centre and zoom are shared; opens on the square
const PIC_FRAME_V = 300, PIC_FRAME_SHAPES = { square: [240, 240], wide: [280, 161], circle: [240, 240] };
async function openPicCrop(id, key, url, kind, prev) { const ctl = {}, fr = kind === 'frame';
  const im = await picLoadImg(url); if (!im) { showToast('התמונה לא נטענה'); return; }
  closePicCrop(true); PIC_CROP = { id, key, kind, shape: 'square', crop: { cx: .5, cy: fr ? .5 : .45, k: 1, ...(prev ? { cx: prev.cx, cy: prev.cy, k: prev.k } : {}) }, im };
  const V = fr ? PIC_FRAME_V : 260;
  const el = document.createElement('div'); el.className = 'tp-crop'; el.id = 'tpCrop'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', fr ? 'מסגור התמונה' : 'חיתוך התמונה');
  // 10.5.0 (design-4 part 2, look.md "Photos"): full screen on black - ✕, the title and "שמירה" in the top bar; the frame over the dimmed photo; the controls at the bottom
  el.innerHTML = `<div class="tp-cbox"><div class="tc-top"><button type="button" class="tc-x" id="tcX" data-act="picCrop.tcX" aria-label="סגירה" title="סגירה">${msi('close')}</button><b>${fr ? 'מסגור' : 'חיתוך'}</b><button type="button" class="btn-nav tc-save" id="tcOk" data-act="picCrop.tcOk">שמירה</button></div>
    <div class="tp-cview${fr ? ' tc-fr' : ''}" id="tcView"><canvas id="tcCv" width="${V}" height="${V}"></canvas>${fr ? '' : '<div class="tp-cmask"></div>'}</div>
    <div class="tc-foot">${fr ? `<div class="tc-shape" id="tcShape">${segHTML('picCrop.tcShape', [['square', 'ריבוע'], ['wide', 'רחב'], ['circle', 'עיגול']], 'square')}</div>` : ''}${fmInput({ type: 'range', id: 'tcZ', min: 1, max: 4, step: 0.05, value: PIC_CROP.crop.k, data: 'aria-label="הגדלה"' })}
    <small>${fr ? 'מסגור אחד לתמונה: כל מקום חותך את הצורה שלו סביבו.' : 'בתמונה רואים רק את מה שבעיגול.'}</small>
    <button type="button" class="tc-auto" id="tcAuto" data-act="picCrop.tcAuto">${msi('restart_alt')}<span>אוטומטי</span></button></div></div>`;
  document.body.appendChild(el); layerPush('picCrop', 'full', fp => closePicCrop(fp)); layerTop().ctl = ctl; // 5.4.0
  const cv = el.querySelector('#tcCv'), ctx = cv.getContext('2d'), Z = el.querySelector('#tcZ'), C = PIC_CROP.crop, w = im.naturalWidth, h = im.naturalHeight, P0 = PIC_CROP;
  // a framing: the photo placed by the one rule (photoImageSVG's), the frame of the chosen shape clear, the rest dimmed
  const fbox = () => { const [fw, fh] = PIC_FRAME_SHAPES[P0.shape], iw = Math.max(fw, fh * w / h) * C.k; return { fw, fh, fx: (V - fw) / 2, fy: (V - fh) / 2, iw, ih: iw * h / w }; };
  const draw = () => { if (fr) { const b = fbox(); ctx.fillStyle = '#111'; ctx.fillRect(0, 0, V, V);
      ctx.drawImage(im, b.fx + C.cx * (b.fw - b.iw), b.fy + C.cy * (b.fh - b.ih), b.iw, b.ih);
      const hole = () => { if (P0.shape === 'circle') { ctx.moveTo(V / 2 + b.fw / 2, V / 2); ctx.arc(V / 2, V / 2, b.fw / 2, 0, 2 * Math.PI); } else ctx.rect(b.fx, b.fy, b.fw, b.fh); };
      ctx.beginPath(); ctx.rect(0, 0, V, V); hole(); ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fill('evenodd');
      ctx.beginPath(); hole(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); return; }
    const s0 = Math.max(260 / w, 260 / h), s = s0 * C.k, size = 260 / s; C.cx = Math.max(size / 2 / w, Math.min(1 - size / 2 / w, C.cx)); C.cy = Math.max(size / 2 / h, Math.min(1 - size / 2 / h, C.cy));
    ctx.clearRect(0, 0, 260, 260); ctx.drawImage(im, C.cx * w - size / 2, C.cy * h - size / 2, size, size, 0, 0, 260, 260); };
  draw();
  const cl = v => Math.max(0, Math.min(1, v));
  picGesture(el.querySelector('#tcView'), { max: 4, k: () => C.k, zoom: k => { C.k = k; Z.value = k; draw(); }, reset: () => { C.k = 1; Z.value = 1; draw(); }, // TOUCH 'pic'
    pan: (dx, dy) => { if (fr) { const b = fbox(), sx = b.fw - b.iw, sy = b.fh - b.ih, u = V / (cv.clientWidth || V); dx *= u; dy *= u; if (sx < -.5) C.cx = cl(C.cx + dx / sx); if (sy < -.5) C.cy = cl(C.cy + dy / sy); draw(); return; }
      const s = Math.max(260 / w, 260 / h) * C.k; C.cx -= dx / s / w; C.cy -= dy / s / h; draw(); } });
  fmOnInput(Z, () => { C.k = Number(Z.value); draw(); });
  ctl.tcX = () => closePicCrop();
  ctl.tcAuto = () => { C.cx = .5; C.cy = fr ? .5 : .45; C.k = 1; Z.value = 1; draw(); };
  ctl.tcShape = b => { P0.shape = b.dataset.v; el.querySelectorAll('#tcShape button').forEach(x => { const on = x === b; x.dataset.active = String(on); x.setAttribute('aria-pressed', String(on)); }); draw(); return 'quiet'; };
  ctl.tcOk = async () => { const P = PIC_CROP; if (!P) return; if (fr) { closePicCrop(); await photoFrameSet(P.key, P.crop, P.im); return; }
    const small = photoCropTo(P.im, P.crop), x = (picModel(id).pts.find(c => c.key === key) || {}).name || '';
    closePicCrop(); await picImgChange(id, key, P.kind === 'own' ? `📷 תמונה שלכם: ${x}` : `✂️ נחתך: ${x}`, P.kind === 'own' ? { src: 'own', crop: { ...P.crop } } : { src: 'wiki', crop: { ...P.crop } }, small); };
}
ctlActs('picCrop', ['tcAuto', 'tcOk', 'tcX', 'tcShape'], ['tcShape']);
function closePicCrop(fromPop) { if (!PIC_CROP) return; PIC_CROP = null; const el = document.getElementById('tpCrop'); if (el) el.remove();
  layerDone('picCrop', fromPop === true); }

// memory-photos (Q4-Q5): a page's photos on its map - each spot's photos as small square JPEGs cut around their framing (photoFrame), made when the page is made
function memPhotoThumb(k, px) { return photoCut(k, 1, 1, px); } // hidden-data (H3): the one cutter's square
async function memPagePhotos(M) { if (DEV.memPhotosOff) return []; const out = [];
  for (const s of memPhotoSpots(M)) { const u = []; for (const k of s.ks) { const t = await memPhotoThumb(k, 240); if (t) u.push(t); } if (u.length) out.push({ c: s.c, name: s.name, u }); }
  return out; }
// ================= END PHOTOS =================

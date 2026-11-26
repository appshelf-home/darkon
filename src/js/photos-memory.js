// ================= PHOTOS OF A MEMORY (memories group; split from photos.js in diet-groups, 11.62.0 - storing, cleaning, adding, the view, the trash and the hotel's photo stay there, in the main script) =================
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
// "לשים כשער" in the full-screen view of a trip's photo (diet-groups: here, with the trip's photos - from photos.js)
act('photo.cover', c => { const k = c.v, id = photoTripOf(k), ks = tripPhotoKeys(id); closePhotoView(); if (ks[0] !== k) photoOrderSet(id, [k, ...ks.filter(x => x !== k)], '🖼️ תמונת השער הוחלפה'); });
// the full-screen view of the trip picture (openPhotoView { pic }): the editor's live model while it is open, else the memento as kept
// (diet-groups: here, with the trip picture - photos.js draws a stored photo itself)
function picViewDraw(inn, id) { const st = mementoStyleOf(id); inn.innerHTML = PIC_ED && PIC_ED.id === id ? picSVG(picModel(id), st === 'art' ? 'schem' : st, {}) : currentMementoSVG(id); }

// ---- ✏️ the editing screen (from the memory screen): the live picture on top, then 📍 points · 🖼️ frame · 🎨 style ----
function picRedraw(id) {
  if (PIC_ED && PIC_ED.id === id) { picEdDraw(); if (_sheetOpen && _sheetKind === 'picCard' && PIC_ED.card) picCard(PIC_ED.card, true); }
  if (PIC_FS.open && PIC_FS.id === id && !PIC_FS.key) photoViewDraw();
  if (activeTab === 'memory' && memoryTrip === id && !(PIC_ED && PIC_ED.id === id)) renderMemoryScreen();
}
ctlActs('picEd', ['tpX', 'tpFs', 'tpChg', 'tptab', 'tpPic']);
function openPicEditor(id) {
  if (PIC_ED) return; const D = mementoData(id); if (!D) return;
  PIC_ED = { id, tab: 'pts', q: '', outOpen: false, all: null, sel: null, card: null };
  const el = document.createElement('div'); el.className = 'tp-ed'; el.id = 'tpEd'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'עריכת תמונת הטיול');
  el.innerHTML = `<div class="tp-top"><button type="button" class="tp-x" id="tpX" data-act="picEd.tpX" aria-label="סגירה" title="סגירה">${msi('close')}</button><b class="tp-title">עריכת התמונה</b><button type="button" class="tp-chg" id="tpChg" data-act="picEd.tpChg" hidden></button><button type="button" class="tp-ib" id="tpFs" data-act="picEd.tpFs" aria-label="מסך מלא" title="מסך מלא">${msi('fullscreen')}</button></div>
    <div class="tp-main"><div class="tp-picwrap"><div class="tp-pic" id="tpPic" data-act="picEd.tpPic"></div><small class="tp-st" id="tpSt" hidden></small></div>
    <div class="tp-side"><div class="tp-tabs" role="tablist"><button type="button" class="t-wrap" data-act="picEd.tptab" data-tptab="pts">${msi('location_on', { size: 20 })}<span>מיקומים</span></button><button type="button" class="t-wrap" data-act="picEd.tptab" data-tptab="frame">${msi('crop', { size: 20 })}<span>מסגרת</span></button><button type="button" class="t-wrap" data-act="picEd.tptab" data-tptab="style">${msi('palette', { size: 20 })}<span>סגנון</span></button></div><div class="tp-body" id="tpBody"></div></div></div>`;
  document.body.appendChild(el); document.body.classList.add('tp-on');
  layerPush('picEd', 'full', fp => closePicEditor(fp)); // 5.4.0
  el._ctl = { picEd: { tpX: () => closePicEditor(), tpFs: () => openPhotoView({ pic: id }), tpChg: () => openPicChanges(id),
    tptab: b => { PIC_ED.tab = b.dataset.tptab; picEdBody(true); return 'quiet'; }, tpPic: (b, c) => { const g = c.ev.target.closest('[data-pt]'); if (g) picCard(g.dataset.pt); return 'quiet'; } } };
  picEdDraw(); el.focus && el.focus();
  // every place of the trip's destinations, for the list (once per opening; the picture itself doesn't need them)
  setTimeout(() => { if (!PIC_ED || PIC_ED.id !== id) return; PIC_ED.all = picCands(id, mementoData(id), true); /* A8: no try/catch that hides an error */ if (PIC_ED.tab === 'pts') picEdBody(false); }, 30);
  picLoadGeo(id).then(() => { if (PIC_ED && PIC_ED.id === id) picEdDraw(); picBgKick(id); });
  picWikiKick(id);
  picOrientWatch(true);
}
function closePicEditor(fromPop) {
  if (!PIC_ED) return; picBurstEnd(); if (_sheetOpen) closeSheet(true); PIC_ED = null; picOrientWatch(false);
  const el = document.getElementById('tpEd'); if (el) el.remove(); document.body.classList.remove('tp-on');
  layerDone('picEd', fromPop); // 5.4.0
  if (activeTab === 'memory') renderMemoryScreen();
}
// the background follows the points: make it when it is missing (once at a time), then redraw
function picBgKick(id) { if (picBgReady(id)) return; const r = picEnsureBg(id); if (r && r.then) r.then(x => { if (x) { memBgStatus(null); picRedraw(id); } }); }
function picEdDraw() {
  const id = PIC_ED.id, m = picModel(id); if (!m) return; const style = mementoStyleOf(id) === 'art' ? 'schem' : mementoStyleOf(id);
  const pic = document.getElementById('tpPic'); if (pic) { pic.innerHTML = picSVG(m, style, { edit: PIC_ED.sel || true }); explainSync(); /* draw-no-write (7): a hint shown before the picture is drawn again (its background arrived) follows its point to the new picture (explainSync: the bubble is read only by the explanations, t880) */ if (!hintSeen('hint.picPoint')) { const ctx = explainCtx(); const pt = () => { const p = document.getElementById('tpPic'); return p && p.querySelector('[data-pt]'); }; setTimeout(() => { if (pic.isConnected) hintOnce('hint.picPoint', pt, ctx); }, 600); } } // 9.6.0 (12ו, batch 12.1)
  const n = picChanges(id).length, b = document.getElementById('tpChg'); if (b) { b.hidden = !n; b.innerHTML = `${msi('back_hand', { size: 18 })} ${n} ${n === 1 ? 'שינוי שלך' : 'שינויים שלך'}`; }
  picEdBody(false); picBgKick(id);
}
function picEdBody(top) {
  const id = PIC_ED.id, body = document.getElementById('tpBody'); if (!body) return; const keep = body.scrollTop, m = picModel(id);
  document.querySelectorAll('[data-tptab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tptab === PIC_ED.tab)));
  body.innerHTML = PIC_ED.tab === 'pts' ? picPtsTab(m) : PIC_ED.tab === 'frame' ? picFrameTab(m) : picStyleTab(m);
  body.scrollTop = top ? 0 : keep; picWireBody(m);
}
// 📍 the points by level, "בחוץ" folded (visited, then planned, then the rest), search and ＋ נקודה
function picPtsTab(m) {
  const q = PIC_ED.q.trim().toLowerCase(), all = PIC_ED.all || m.pts, byKey = new Map(m.pts.map(x => [x.key, x]));
  const list = all.map(x => byKey.get(x.key) || { ...x, def: picDefaultLv(x, m.kind, m.preset, m.D), lv: picDefaultLv(x, m.kind, m.preset, m.D), label: false, text: x.name, img: null })
    .filter(x => !(m.kind === 'city' && x.type === 'city' && !x.extra && x.lv === 'out'));
  const hit = x => !q || String(x.name).toLowerCase().includes(q) || String(x.foreign || '').toLowerCase().includes(q) || String(x.text || '').toLowerCase().includes(q);
  const ov = ((m.P.ov || {}).pts) || {}, rank = x => x.type === 'city' ? 0 : x.type === 'hotel' ? 1 : x.visited ? 2 : x.planned ? 3 : 4;
  const row = x => { const mine = ov[x.key] && (ov[x.key].lv || typeof ov[x.key].label === 'boolean' || ov[x.key].text), th = x.img ? `<img src="${escH(x.img.url)}" alt="">` : `<span>${x.type === 'city' ? msi('location_city') : x.type === 'hotel' ? msi('hotel') : typeIcon(x.icon)}</span>`; // final-review-fixes (finding 12): the kind as a line icon, as in the location's own window
    return `<div class="tp-row" data-k="${escH(x.key)}"><button type="button" class="tp-th" data-act="picBody.tpcard" data-tpcard="${escH(x.key)}" aria-label="פרטים">${th}</button><button type="button" class="tp-name t-wrap" data-act="picBody.tpcard" data-tpcard="${escH(x.key)}">${escH(x.text || x.name)}${x.rt === 'love' ? ' ❤️' : x.rt === 'like' ? ' 👍' : ''}${x.hl ? ' ' + msi('celebration', { size: 16, cls: 'msi-in' }) : ''}${x.star ? ' ' + msi('star', { size: 16, cls: 'msi-in' }) : ''}${mine ? ` <i class="tp-mine">${msi('back_hand', { size: 16 })}</i>` : ''}<small>${x.type === 'city' ? 'עיר' : x.type === 'hotel' ? 'לינה' : x.type === 'extra' ? 'מיקום לתמונה' : x.visited ? TX.visited : x.planned ? 'תוכנן' : 'ביעד'}</small></button>
      <span class="tp-lvs">${PIC_LV.map(l => `<button type="button" class="tp-lv" data-act="picBody.tplv" data-tplv="${l}" data-k="${escH(x.key)}" aria-pressed="${x.lv === l}" title="${PIC_LV_HE[l]}" aria-label="${PIC_LV_HE[l]}">${l === 'out' ? msi('visibility_off', { size: 18 }) : { L: 'ג', M: 'ב', S: 'ק' }[l]}</button>`).join('')}</span></div>`; };
  const groups = ['L', 'M', 'S'].map(l => { const xs = list.filter(x => x.lv === l && hit(x)).sort((a, b) => rank(a) - rank(b));
    return xs.length ? `<h4 class="tp-gh">${PIC_LV_HE[l]} <small>${xs.length}</small></h4>${xs.map(row).join('')}` : ''; }).join('');
  const outs = list.filter(x => x.lv === 'out' && hit(x)).sort((a, b) => rank(a) - rank(b)), open = PIC_ED.outOpen || !!q;
  return `<div class="tp-search">${searchFieldHTML('tpQ', 'חיפוש מיקום', PIC_ED.q)}<button type="button" class="tp-add" id="tpAdd" data-act="picBody.tpAdd">${msi('add', { size: 18 })} מיקום</button></div><div id="tpPtsList">
    <small class="sh-hint">ג גדול${SEP}ב בינוני${SEP}ק קטן${SEP}${msi('visibility_off', { size: 14 })} בחוץ ${tipI('pic.levels')}</small>
    ${groups || '<p class="sh-hint">אין עדיין מיקומים בתמונה. בוחרים מ"בחוץ" או מוסיפים ＋ מיקום.</p>'}
    <button type="button" class="tp-gh tp-out t-wrap" id="tpOut" data-act="picBody.tpOut" aria-expanded="${open}"><span class="tp-outt">בחוץ${SEP}${outs.length}<small>מיקומים שלא מוצגים בתמונה</small></span>${msi(open ? 'expand_less' : 'expand_more')}</button>
    ${open ? (outs.length ? outs.slice(0, 300).map(row).join('') + (outs.length > 300 ? `<p class="sh-hint">ועוד ${outs.length - 300} - חיפוש מצמצם.</p>` : '') : '<p class="sh-hint">אין.</p>') : ''}
    ${PIC_ED.all ? '' : '<p class="sh-hint"><span class="spin" aria-hidden="true"></span>טוען את כל המקומות של היעדים…</p>'}</div>`;
}
// 🖼️ the frame: blocks that switch on and off, or no frame at all
function picFrameTab(m) {
  const f = m.frame, D = m.D, sw = (k, label, on, extra) => `<label class="bk-part">${fmCheck({ act: 'picBody.tpf', data: `data-tpf="${k}"`, checked: on })} ${label}${extra || ''}</label>`;
  const nums = Object.keys(PIC_NUMS).filter(k => picNumOffered(k, D, m.kind)); // ride-km (Q3); nav-short-page (G137): f.nums holds only the offered ones
  return `<div class="chips-row tp-chips"><button type="button" class="chip" data-act="picBody.tpnone" data-tpnone="0" data-active="${!f.none}">עם מסגרת</button><button type="button" class="chip" data-act="picBody.tpnone" data-tpnone="1" data-active="${f.none}">בלי מסגרת</button></div>
    ${f.none ? `<p class="sh-hint">המפה מקצה לקצה.</p><div class="chips-row tp-chips"><button type="button" class="chip" data-act="picBody.tpsmall" data-tpsmall="small" data-active="${f.small === 'small'}">כותרת קטנה</button><button type="button" class="chip" data-act="picBody.tpsmall" data-tpsmall="none" data-active="${f.small === 'none'}">בלי כותרת</button></div>
      <label class="sh-field">כותרת${fmInput({ id: 'tpTitle', act: 'picBody.frText', value: f.title, placeholder: String(D.t.name).split(' · ')[0] })}</label>${sw('dates', 'תאריכים', f.dates)}` : `
    <h4 class="tp-gh">פס עליון</h4>${sw('band', 'פס הכותרת', f.band)}
    ${f.band ? `<label class="sh-field">כותרת${fmInput({ id: 'tpTitle', act: 'picBody.frText', value: f.title, placeholder: String(D.t.name).split(' · ')[0] })}</label>
      <label class="sh-field">כותרת משנה${fmInput({ id: 'tpSub', act: 'picBody.frText', value: f.sub, placeholder: D.dests.map(d => String(d.name).replace(/\s*\(.*$/, '')).join(' ← ') })}</label>
      ${sw('dates', 'תאריכים', f.dates)}${D.flags.length ? sw('flags', 'דגלים', f.flags) : ''}` : ''}
    <h4 class="tp-gh">מספרים <small>עד ${PIC_NUM_MAX}${SEP}${f.nums.length} נבחרו</small></h4>
    <div class="chips-row tp-chips wrap">${nums.map(k => `<button type="button" class="chip" data-act="picBody.tpnum" data-tpnum="${k}" data-active="${f.nums.includes(k)}">${PIC_NUMS[k][0]}</button>`).join('')}</div>
    <h4 class="tp-gh">עוד בתמונה</h4>${D.hs.length ? sw('hl', `רגעי השיא (${D.hs.length})`, f.hl) : ''}${D.cols[0] ? sw('col', msiT('checklist', 'מונה האוסף', { size: 18 }), f.col) : ''}${m.kind === 'route' && D.records.some(r => r[0] === '⛰️') ? sw('elev', msiT('elevation', 'פרופיל גובה', { size: 18 }), f.elev) : ''}${tlPaths(m.id).length ? sw('path', msiT('route', 'המסלול שהלכנו', { size: 18 }), f.path) : ''}${sw('foot', 'שורה תחתונה (שם האפליקציה, תאריך וגרסה)', f.foot)}`}
    <small class="sh-hint">קרדיט המפה ${m.pts.some(x => x.img && x.img.src === 'wiki') ? 'וויקיפדיה ' : ''}תמיד מופיע, קטן בפינה.</small>`;
}
// 🎨 style: route/city, ready styles, orientation, language, real/drawn, the map's background
function picStyleTab(m) {
  const id = m.id, st = mementoStyleOf(id), art = MEMO.get('art:' + id);
  return `<h4 class="tp-gh">סוג</h4><div class="chips-row tp-chips"><button type="button" class="chip" data-act="picBody.tpkind" data-tpkind="route" data-active="${m.kind === 'route'}">מסלול</button><button type="button" class="chip" data-act="picBody.tpkind" data-tpkind="city" data-active="${m.kind === 'city'}">עירוני</button></div>
    <h4 class="tp-gh">סגנון מוכן</h4><div class="chips-row tp-chips wrap">${PIC_PRESETS[m.kind].map(([k, l, ic]) => `<button type="button" class="chip" data-act="picBody.tppreset" data-tppreset="${k}" data-active="${m.preset === k}">${msi(ic, { size: 18 })}${l}</button>`).join('')}</div>
    <small class="sh-hint">החלפת סגנון לא מוחקת שינויים שעשיתם ביד.</small>
    <h4 class="tp-gh">צורה</h4><div class="chips-row tp-chips"><button type="button" class="chip" data-act="picBody.tporient" data-tporient="port" data-active="${m.orient === 'port'}">${msi('crop_portrait', { size: 18 })}לאורך</button><button type="button" class="chip" data-act="picBody.tporient" data-tporient="land" data-active="${m.orient === 'land'}">${msi('crop_landscape', { size: 18 })}לרוחב</button></div>
    <h4 class="tp-gh">שפת התמונה${m.lang === 'en' ? ' ' + tipI('pic.foreign') : ''}</h4><div class="chips-row tp-chips"><button type="button" class="chip" data-act="picBody.tplang" data-tplang="he" data-active="${m.lang === 'he'}">עברית</button><button type="button" class="chip" data-act="picBody.tplang" data-tplang="en" data-active="${m.lang === 'en'}">English</button></div>

    <h4 class="tp-gh">תמונות המיקומים ${tipI('pic.look')}</h4><div class="chips-row tp-chips"><button type="button" class="chip" data-act="picBody.tplook" data-tplook="real" data-active="${m.look === 'real'}">${msi('photo_camera', { size: 16 })} אמיתי</button><button type="button" class="chip" data-act="picBody.tplook" data-tplook="drawn" data-active="${m.look === 'drawn'}">${msi('palette', { size: 16 })} מצויר</button></div>

    <h4 class="tp-gh">רקע המפה</h4><div class="chips-row tp-chips"><button type="button" class="chip" data-act="picBody.tpbg" data-tpbg="map" data-active="${st === 'map'}">${msi('map', { size: 18 })}מפה</button><button type="button" class="chip" data-act="picBody.tpbg" data-tpbg="schem" data-active="${st === 'schem'}">${msi('gesture', { size: 18 })}סכמתי</button>${art ? `<button type="button" class="chip" data-act="picBody.tpbg" data-tpbg="art" data-active="${st === 'art'}">${claudeMark({ size: 18 })}מאוירת</button>` : ''}</div>
    ${art ? '<small class="sh-hint">שינויים כאן לא משנים את הגרסה המאוירת.</small>' : ''}`;
}
function picWireBody(m) { const ctl = ctlOn('tpEd', 'picBody');
  const id = m.id, body = document.getElementById('tpBody'), $$ = q => body.querySelectorAll(q), $ = q => body.querySelector(q);
  ctl.tpcard = b => picCard(b.dataset.tpcard);
  ctl.tplv = b => picSetLv(id, b.dataset.k, b.dataset.tplv);
  // ride-no-home item 3 (G133 sweep): typing redraws the list under the search only - the field itself stays (the whole tab was drawn
  // again on every letter and the new field focused: the keyboard could close)
  const q = $('#tpQ'); if (q) fmOnInput(q, v => { PIC_ED.q = v; const L = $('#tpPtsList'); if (!L) { picEdBody(false); return; }
    const nl = htmlFrag(picPtsTab(picModel(id))).querySelector('#tpPtsList'); if (nl) L.replaceChildren(...nl.childNodes); picWireBody(picModel(id)); });
  if (PIC_ED.q) markSearch($('#tpPtsList') || body, PIC_ED.q);
  if ($('#tpOut')) ctl.tpOut = () => { PIC_ED.outOpen = !PIC_ED.outOpen; picEdBody(false); };
  if ($('#tpAdd')) ctl.tpAdd = () => openPicAdd(id);
  const fr = (k, v, label) => picChange(id, label, p => { const f = picOv(p).frame, def = picFrameDefaults(m.D, m.kind)[k]; if (JSON.stringify(v) === JSON.stringify(def)) delete f[k]; else f[k] = v; }, true);
  ctl.tpf = c => { const k = c.dataset.tpf; if (k === 'path') { picChange(id, '🖼️ המסגרת עודכנה', p => { p.pathNew = 1; const f = picOv(p).frame; if (c.checked === picFrameDefaults(m.D, m.kind).path) delete f.path; else f.path = c.checked; }, true); return; } fr(k, c.checked, '🖼️ המסגרת עודכנה'); }; // tl-paths (Q4): the switch also ends an old picture's kept look
  ctl.tpnone = b => fr('none', b.dataset.tpnone === '1', b.dataset.tpnone === '1' ? 'בלי מסגרת' : '🖼️ עם מסגרת');
  ctl.tpsmall = b => fr('small', b.dataset.tpsmall, '🖼️ הכותרת עודכנה');
  ctl.frText = el => fr(el.id === 'tpTitle' ? 'title' : 'sub', el.value.trim(), '🖼️ הכותרת עודכנה'); // saved on leaving the field
  ctl.tpnum = b => { const k = b.dataset.tpnum, cur = m.frame.nums, on = cur.includes(k), all = m.frame.numsAll.filter(x => x !== k);
    if (!on && cur.length >= PIC_NUM_MAX) { showToast(`עד ${PIC_NUM_MAX} מספרים - מורידים אחד קודם`); return; }
    fr('nums', on ? all : all.concat(k), '🔢 המספרים עודכנו'); }; // G137: a chosen number not offered now stays in the saved list
  const setP = (label, fn) => picChange(id, label, fn, true);
  ctl.tpkind = b => { if (b.dataset.tpkind === m.kind) return; setP(b.dataset.tpkind === 'city' ? 'עירוני' : 'מסלול', p => { p.kind = b.dataset.tpkind; p.pathNew = 1; }); }; // tl-paths (Q4): a changed kind takes the new path default
  ctl.tppreset = b => { if (b.dataset.tppreset === m.preset) return; setP('🎨 ' + b.textContent.trim(), p => { p.presets = { ...(p.presets || {}), [m.kind]: b.dataset.tppreset }; }); };
  ctl.tporient = b => { if (b.dataset.tporient === m.orient) return; setP(b.textContent.trim(), p => { p.orient = b.dataset.tporient; }); };
  ctl.tplang = b => { if (b.dataset.tplang === m.lang) return; setP(b.dataset.tplang === 'en' ? '🔤 English' : '🔤 עברית', p => { p.lang = b.dataset.tplang; }); };
  ctl.tplook = b => { if (b.dataset.tplook === m.look) return; setP(b.dataset.tplook === 'drawn' ? 'מצויר' : 'אמיתי', p => { p.look = b.dataset.tplook; }); };
  ctl.tpbg = b => { const st = b.dataset.tpbg; if (st === mementoStyleOf(id)) return; picBurstEnd(); // undo-history (Q5): an ordinary row
    const v = (MEMO_VIEW[id] = MEMO_VIEW[id] || {}); v.style = st; tdOf(id).mementoStyle = st; tdSave(id); picRedraw(id);
    picEdBody(false); showUndoToast(st === 'map' ? SY.map + ' מפה' : st === 'art' ? '' + SY.claude + ' מאוירת' : 'סכמתי'); };
}
ctlActs('picBody', ['frText', 'tpAdd', 'tpOut', 'tpbg', 'tpcard', 'tpf', 'tpkind', 'tplang', 'tplook', 'tplv', 'tpnone', 'tpnum', 'tporient', 'tppreset', 'tpsmall']);
// a level from the list or the card; a point that comes in from the destination keeps what it needs to be drawn later
function picSetLv(id, key, lv) {
  const all = (PIC_ED && PIC_ED.all) || [], x = all.find(c => c.key === key) || picModel(id).pts.find(c => c.key === key); if (!x) return;
  const m = picModel(id), def = picDefaultLv(x, m.kind, m.preset, m.D);
  picChange(id, `${PIC_LV_HE[lv] === 'בחוץ' ? '✕' : SY.place} ${x.name}${SEP}${PIC_LV_HE[lv]}`, p => { const o = picPtOv(p, key);
    if (lv === def) delete o.lv; else o.lv = lv;
    if (key.startsWith('p:') && x.src === 'dest' && lv !== 'out') o.snap = { name: x.p.name, icon: x.p.icon, coord: x.c, dest: x.p.dest, address: x.p.address || '', key: x.p.key || undefined };
    if (lv === 'out' && o.snap && !o.lv) delete o.snap; picCleanPt(p, key); }, true);
}
// the card of one point (a sheet over the editor): level, name, image, spread/merge, a small move
function picCard(key, refresh) { const ctl = {}; // 9.8.0: the card's controller on its window (it was on the editor, where the card's buttons never found it)
  document.getElementById('sheet')._ctl = { picCard: ctl };
  if (!PIC_ED) return; const id = PIC_ED.id, m = picModel(id), all = PIC_ED.all || m.pts;
  let x = m.pts.find(c => c.key === key); if (!x) { const a = all.find(c => c.key === key); if (!a) return; const d0 = picDefaultLv(a, m.kind, m.preset, m.D); x = { ...a, def: d0, lv: d0, label: false, text: a.name, auto: a.name, img: null }; }
  const mi = m.merges.findIndex(g => g.includes(key)), mem = mi >= 0 ? m.merges[mi] : null, inPic = x.lv && x.lv !== 'out';
  PIC_ED.card = key; if (PIC_ED.sel !== key) { PIC_ED.sel = key; if (!refresh) picEdDraw(); }
  const o = (((m.P.ov || {}).pts) || {})[key] || {}, imgO = (m.P.img || {})[key] || {}, wiki = picWikiGet(id, key);
  const near = inPic && !mem ? (PIC_LAST[id] ? PIC_LAST[id].marks : []).filter(q => q.key !== key && !q.members).map(q => ({ q, d: Math.hypot(q.x - ((PIC_LAST[id].marks.find(z => z.key === key) || {}).x || 0), q.y - ((PIC_LAST[id].marks.find(z => z.key === key) || {}).y || 0)) })).sort((a, b) => a.d - b.d).slice(0, 4) : [];
  const sheet = document.getElementById('sheet');
  sheet.innerHTML = `${fmHead(`${x.type === 'city' ? '🏙️' : x.type === 'hotel' ? '🏨' : typeIcon(x.icon, { size: 20 })} ${nameB(x.name)}`, 'pcX')}
    <div class="tp-card">
    <div class="view-toggle seg tp-seg" role="group" aria-label="גודל">${PIC_LV.map(l => `<button type="button" data-act="picCard.pclv" data-pclv="${l}" data-active="${x.lv === l}" aria-pressed="${x.lv === l}">${PIC_LV_HE[l]}</button>`).join('')}</div>
    ${x.def && x.lv !== x.def ? `<small class="sh-hint">${msi('back_hand', { cls: 'msi-in' })} שיניתם (בסגנון: ${PIC_LV_HE[x.def]}) <button type="button" class="link-btn" data-act="picCard.pcreset" data-pcreset="lv" aria-label="חזרה לברירת המחדל" title="חזרה לברירת המחדל">${msi('restart_alt', { size: 18 })}</button></small>` : ''}
    ${inPic ? `<label class="bk-part">${fmCheck({ id: 'pcLabel', act: 'picCard.pcLabel', checked: x.label === true })} שם בתמונה${x.label === 'auto' ? ' <small>(בינוני: כשיש מקום)</small>' : ''}</label>
    <label class="sh-field">השם בתמונה בלבד${fmInput({ id: 'pcText', act: 'picCard.pcText', value: o.text || '', placeholder: x.auto || x.name })}</label>
    ${x.foreign && x.foreign !== x.name ? `<small class="sh-hint">לועזי: ${escH(x.foreign)}</small>` : ''}
    <h4 class="tp-gh">תמונה של המקום</h4>
    <div class="tp-imgrow">${x.img ? `<span class="tp-imgcol">${photoThumbHTML(`pimg:${id}:${x.img.key || key}`, { cls: 'tp-imgprev', label: 'הגדלה' })}<button type="button" class="tp-ib" id="pcCrop" data-act="picCard.pcCrop" aria-label="חיתוך" title="חיתוך">${msi('crop', { size: 18 })}</button></span>` : '<span class="tp-imgprev tp-noimg">—</span>'}
      <div class="tp-imgsrc"><div class="chips-row tp-chips wrap">${photoAddHTML('picCard.pcown')}${wiki && wiki.u ? `<button type="button" class="chip" data-act="picCard.pcsrc" data-pcsrc="wiki" data-active="${x.img && x.img.src === 'wiki'}">${msi('auto_stories', { size: 16 })} ויקיפדיה</button>` : ''}<button type="button" class="chip" data-act="picCard.pcsrc" data-pcsrc="none" data-active="${imgO.src === 'none' || !x.img}">בלי</button></div>
      <small class="sh-hint">${wiki === undefined ? (PIC_WIKI_TRIED.has(id + '|' + picWikiCK(x)) && !PIC_WIKI_RUN ? (svcNetDown() ? svcOffHTML() + ' לבדיקה בוויקיפדיה.' : 'לא הצלחתי לבדוק בוויקיפדיה עכשיו. ננסה שוב בפתיחה הבאה.') : 'מחפש בוויקיפדיה…') : wiki && wiki.u ? `${msi('auto_stories', { cls: 'msi-in' })} ${escH(wiki.t)}` : 'אין תמונה בוויקיפדיה למקום הזה; אפשר תמונה שלכם.'}</small></div></div>
    <h4 class="tp-gh">מקום בתמונה</h4>
    ${mem ? `<p class="sh-hint">${msi('link', { cls: 'msi-in' })} מאוחד עם: ${mem.filter(k => k !== key).map(k => escH((m.pts.find(c => c.key === k) || {}).name || k)).join(', ')}</p><button type="button" class="btn-sec" id="pcSplit" data-act="picCard.pcSplit">${msi('call_split', { size: 18 })} פיצול</button>`
      : `<div class="tp-move"><button type="button" class="tp-ib" data-act="picCard.pcmv" data-pcmv="0,-12" aria-label="למעלה">${msi('north', { size: 18 })}</button><button type="button" class="tp-ib" data-act="picCard.pcmv" data-pcmv="0,12" aria-label="למטה">${msi('south', { size: 18 })}</button><button type="button" class="tp-ib" data-act="picCard.pcmv" data-pcmv="12,0" aria-label="ימינה">${msi('east', { size: 18 })}</button><button type="button" class="tp-ib" data-act="picCard.pcmv" data-pcmv="-12,0" aria-label="שמאלה">${msi('west', { size: 18 })}</button>${o.dx || o.dy ? '<button type="button" class="link-btn" data-act="picCard.pcreset" data-pcreset="move">' + msi('restart_alt', { size: 18 }) + ' <span class="lk-tx">למקום</span></button>' : ''}</div>
      ${near.length ? `<small class="sh-hint">${msi('link', { cls: 'msi-in' })} איחוד עם:</small><div class="chips-row tp-chips wrap">${near.map(n => `<button type="button" class="chip" data-act="picCard.pcmerge" data-pcmerge="${escH(n.q.key)}">${escH(String(n.q.text).slice(0, 22))}</button>`).join('')}</div>` : ''}`}` : '<small class="sh-hint">המיקום בחוץ. בוחרים גודל כדי להכניס אותו לתמונה.</small>'}
    </div>${x.type === 'extra' || (x.type === 'city' && x.extra) ? fmEndActs([{ act: 'picCard.pcDel', id: 'pcDel', label: 'מחיקת המיקום מהתמונה', del: true }]) : ''}`;
  const $ = q => sheet.querySelector(q), $$ = q => sheet.querySelectorAll(q);
  
  ctl.pclv = b => picSetLv(id, key, b.dataset.pclv);
  ctl.pcreset = b => picChange(id, 'חזר לברירת המחדל: ' + x.name, p => { const q = picPtOv(p, key); if (b.dataset.pcreset === 'move') { delete q.dx; delete q.dy; } else delete q[b.dataset.pcreset]; picCleanPt(p, key); });
  if ($('#pcLabel')) ctl.pcLabel = () => { const v = $('#pcLabel').checked; picChange(id, `🏷️ ${x.name}: שם ${v ? 'מוצג' : 'מוסתר'}`, p => { const q = picPtOv(p, key), defL = x.lv === 'L' ? true : x.lv === 'S' ? false : null; if (v === defL) delete q.label; else q.label = v; picCleanPt(p, key); }, true); };
  if ($('#pcText')) ctl.pcText = () => { const v = $('#pcText').value.trim(); picChange(id, `✏️ השם בתמונה: ${v || x.auto}`, p => { const q = picPtOv(p, key); if (v) q.text = v; else delete q.text; picCleanPt(p, key); }, true); };
  ctl.pcmv = b => { const [ax, ay] = b.dataset.pcmv.split(',').map(Number); picChange(id, '↔ הוזז', p => { const q = picPtOv(p, key); q.dx = (q.dx || 0) + ax; q.dy = (q.dy || 0) + ay; if (!q.dx && !q.dy) { delete q.dx; delete q.dy; } picCleanPt(p, key); }, true); };
  ctl.pcmerge = b => { const k2 = b.dataset.pcmerge; picChange(id, '🔗 אוחדו לסימן אחד', p => { const ms = (p.merges || []).map(g => g.filter(k => k !== key && k !== k2)).filter(g => g.length > 1); ms.push([key, k2]); p.merges = ms; }); };
  if ($('#pcSplit')) ctl.pcSplit = () => picChange(id, '✂ פוצל', p => { p.merges = (p.merges || []).filter(g => !g.includes(key)); });
  if ($('#pcDel')) ctl.pcDel = () => { closeSheet(); picChange(id, SY.del + ' המיקום נמחק מהתמונה', p => picUndoOne(p, { kind: 'extra', k: key })); };
  ctl.pcsrc = b => picSetImgSrc(id, key, b.dataset.pcsrc);
  ctl.pcown = async inp => { const [url] = await photoRead(inp, PHOTO_PLACES.point.px); if (!url) return; PIC_SRC_SESSION.set(id + '|' + key, url); openPicCrop(id, key, url, 'own'); };
  if ($('#pcCrop')) ctl.pcCrop = () => picRecrop(id, key);
  if (!refresh) { showSheetBackdrop('picCard'); _sheetOnCancel = () => { if (PIC_ED) { PIC_ED.card = null; PIC_ED.sel = null; picEdDraw(); } };
    }
  if (x.img && !hintSeen('hint.crop')) { const ctx = explainCtx(); const crop = () => document.getElementById('pcCrop'); setTimeout(() => hintOnce('hint.crop', crop, ctx), 500); } // 9.6.0 (12ו, batch 12.4)
  if (wiki === undefined && inPic && !PIC_WIKI_TRIED.has(id + '|' + picWikiCK(x))) { PIC_WIKI_TRIED.add(id + '|' + picWikiCK(x)); picWikiFor(id, x).then(() => { if (PIC_ED && PIC_ED.card === key && _sheetOpen) picCard(key, true); }); }
}
ctlActs('picCard', ['pcCrop', 'pcDel', 'pcLabel', 'pcSplit', 'pcText', 'pclv', 'pcmerge', 'pcmv', 'pcown', 'pcreset', 'pcsrc']);
// ✋ my changes: one line each with ↺; 11.4.0 (the 10.17.3 review's Q2): "חזרה לסידור האוטומטי" - a neutral row of the end group at the
// window's end (not the footer, which stays empty), asking once (restart_alt, "לחזור לסידור האוטומטי?")
function openPicChanges(id) { const ctl = {};
  const list = picChanges(id), sheet = document.getElementById('sheet');
  sheet.innerHTML = `${fmHead(`✋ השינויים שלך (${list.length})`, 'pchX')}
    <p class="sh-hint">השינויים שעשיתם ביד. ${msi('restart_alt', { cls: 'msi-in' })} מחזיר שינוי אחד לברירת המחדל.</p>
    ${list.length ? `<div class="tp-chlist">${list.map((c, i) => `<div class="tp-ch"><span>${escH(c.text)}</span><button type="button" class="tp-ib" data-act="picChanges.pchi" data-pchi="${i}" aria-label="ביטול השינוי" title="ביטול השינוי">${msi('restart_alt', { size: 20 })}</button></div>`).join('')}</div>
    ${fmEndActs([{ act: 'picChanges.pchAll', id: 'pchAll', ic: 'restart_alt', label: 'חזרה לסידור האוטומטי' }])}` : emptyHTML(msi('back_hand', { size: 40 }), `מה שמשנים ביד בעריכת התמונה מופיע כאן, עם ${msi('restart_alt', { cls: 'msi-in' })} לכל שינוי.`, '', 'אין שינויים')}`; // 10.5.0 (design-4 part 2): rows with ↺, or the empty state
  const $ = q => sheet.querySelector(q); 
  ctl.pchi = b => { const c = list[Number(b.dataset.pchi)]; picChange(id, 'בוטל: ' + c.text, p => picUndoOne(p, c)); openPicChanges(id); };
  ctl.pchAll = () => askSure({ ic: 'restart_alt', title: 'לחזור לסידור האוטומטי?', text: 'התמונה חוזרת לסידור האוטומטי.', ok: 'ביטול כל השינויים' }, () => { // 10.13.0 (gap 47): in the dialog
    picChange(id, 'כל השינויים שלך בוטלו', p => { delete p.ov; delete p.merges; delete p.extra; delete p.img; }); closeSheet(); });
  showSheetBackdrop('picChanges'); layerTop().ctl = ctl;
}
ctlActs('picChanges', ['pchAll', 'pchi']);
// ＋ נקודה: a name or an address (search), saved for the picture only; "עיר שעברנו בה" puts it on the route
function openPicAdd(id, back) { const ctl = {}; // back (11.21.0, Q3): the form as it was left before Google Maps, and the shared place
  const D = mementoData(id), ctr = D.stops[0] ? D.stops[0].c : (D.visited[0] ? snapCoord(D.visited[0]) : { lat: 32, lng: 34.8 }), sheet = document.getElementById('sheet');
  sheet.innerHTML = `${fmHead('＋ מיקום לתמונה', 'paX')}
    <p class="sh-hint">נשמר לתמונה בלבד, לא ליעד.</p>
    <div class="tp-search">${searchFieldHTML('paQ', 'שם מקום או כתובת', '')}<button type="button" class="btn-nav" id="paGo" data-act="picAdd.paGo">חיפוש</button></div>
    <label class="bk-part pa-city">${fmCheck({ id: 'paCity', act: 'picAdd.paCity' })} <span>עיר שעברנו בה<small>נכנסת למסלול במקום המתאים</small></span></label>
    <div id="paRes" class="tp-res"></div>`;
  const $ = q => sheet.querySelector(q), q = $('#paQ');
  
  // 11.20.0 (place-search-upgrade): the one place search (typing pauses: Photon; "חיפוש" / Enter: both); a pasted Google Maps link adds its point
  const add = r => { const city = $('#paCity').checked, key = 'x:' + Date.now().toString(36);
    closeSheet(); picChange(id, `＋ ${r.name}`, p => { p.extra = (p.extra || []).concat({ key, name: r.name, foreign: HEB_CH.test(r.name) ? '' : r.name, lat: +r.c.lat.toFixed(6), lng: +r.c.lng.toFixed(6), city }); });
    if (PIC_ED) { PIC_ED.all = null; setTimeout(() => { if (PIC_ED) { PIC_ED.all = picCands(id, mementoData(id), true); picEdBody(false); } }, 30); } };
  // 11.28.0 (area-search Q1, Q3): "עיר שעברנו בה" on - an area search, anywhere, biased toward the trip's centre (the middle of its stops);
  // off - the place search in the destination's box, as before. Turning it over runs the open query again in the new kind.
  const city = () => $('#paCity').checked, tc = (pts => { if (!pts.length) return ctr; const la = pts.map(p => p.lat), ln = pts.map(p => p.lng);
    return { lat: (Math.min(...la) + Math.max(...la)) / 2, lng: (Math.min(...ln) + Math.max(...ln)) / 2 }; })(D.stops.map(x => x.c).filter(c => c && isFinite(c.lat) && isFinite(c.lng)));
  const ps = psHost({ box: () => $('#paRes'), kind: () => city() ? 'area' : 'place', near: () => city() ? tc : ctr, where: () => city() ? null : placeWhere({ dest: (STATE.trips[id] && tripDests(STATE.trips[id])[0]), t: STATE.trips[id] }) /* big-dest-search: place mode - the trip's destination, then its country */, pick: x => add({ name: x.name, c: x.coord }),
    ret: () => ({ k: 'pic', id, keep: { q: q.value, city: $('#paCity').checked } }) }); q.dataset.ps = ps; // 11.21.0 (Q3): the point's form kept across Google Maps
  ctl.paCity = () => { const H = PS_HOSTS[ps], st = H && H.st; if (st && st.q && st.hk !== psKindOf(H)) psRun(ps, st.q, st.explicit ? 'explicit' : 'typing'); return 'quiet'; };
  const go = async () => { const t = q.value.trim(); if (!t) return;
    if (psSpecial(t)) { const r = await psReadLink(t); if (r && r.coord) add({ name: r.name || 'מקום מגוגל מפות', c: r.coord }); else showToast(PS_NO_POINT); return; }
    psRun(ps, t, 'explicit'); };
  ctl.paGo = () => { go(); return 'quiet'; }; q.dataset.actEnter = 'picAdd.paGo';
  showSheetBackdrop('picAdd'); layerTop().ctl = ctl;
  if (back) { q.value = back.q || ''; $('#paQX').hidden = !q.value; $('#paCity').checked = !!back.city; const H = PS_HOSTS[ps]; // waits for a tap, like any result
    if (H && back.r) { H.st = { q: back.q || '', list: [{ name: back.r.name, coord: back.r.coord, sub: 'מגוגל מפות', ic: 'location_on', km: null }], kind: '', more: false, anywhere: true }; psDraw(H); } }
}
ctlActs('picAdd', ['paGo', 'paCity']);
// turning the phone: a landscape picture opens full screen; turning back closes it only if turning opened it
let _picOrMq = null;
function picOrientWatch(on) {
  if (!window.matchMedia || !('ontouchstart' in window || navigator.maxTouchPoints > 0)) return;
  if (!_picOrMq) _picOrMq = window.matchMedia('(orientation: landscape)');
  const f = picOrientWatch._f || (picOrientWatch._f = () => { const id = (PIC_ED && PIC_ED.id) || PIC_FS.id; if (!id) return;
    if (_picOrMq.matches) { if (!PIC_FS.open && PIC_ED && !_sheetOpen && picModel(id).orient === 'land') openPhotoView({ pic: id, byTurn: true }); }
    else if (PIC_FS.open && PIC_FS.byTurn) closePhotoView(); });
  try { if (on) sysOn(_picOrMq, 'change', f); else sysOff(_picOrMq, 'change', f); } catch (e) {}
}
// ---- 4.44.0: an image per point - of that very place, never a generic drawing ----
// Sources: my own photo, or Wikipedia's picture of the place (suggested by itself when the place has one), or none. Only the
// small cropped version is kept (MEMO "pimg:<trip>:<key>", backup part 🎁), apart from the trip's photo collection.
function picWikiCache() { return regRead('picwiki'); }
function picWikiCK(x) { return `${x.key}|${x.name}${x.type === 'city' ? '|c2' : ''}`; } // 4.47.1: cities looked up again (around the city)
// 7.1.0 (ש8): "no picture" is kept 30 days ({none, at}); this reads a picture, null (none, still fresh) or undefined (ask)
function picWikiVal(ck) { const e = picWikiCache()[ck]; if (e === undefined) return undefined; if (e === null || (e && e.none)) return e && e.none && svcFresh('pointImage', e) ? null : undefined; return e; }
function picWikiGet(id, key) { const m = PIC_ED && PIC_ED.id === id ? (PIC_ED.all || picModel(id).pts) : picModel(id).pts, x = m.find(c => c.key === key); if (!x) return null; return picWikiVal(picWikiCK(x)); }
function picWikiSet(x, v) { regCacheSet('picwiki', picWikiCK(x), v || { none: 1, at: Date.now() }); } // 6.0.0: the cap (600) by last use, in the daily cleanup
// a Wikipedia page is of this place: the one comparison (placeNameMatch 'loose', both names - dup-both-names), or a word of 4 letters or more of a name in its title
function picNameMatch(title, names) { if (placeNameMatch(names, title, 'loose')) return true; const t = nameCore(title).split(' ');
  return placeNames(names).map(nameCore).some(n => n.length >= 3 && n.split(' ').filter(w => w.length >= 4).some(w => t.includes(w))); }
// the found picture with its facts, or null when its licence is not known to be free
async function picWikiWithCredit(found) { if (!found) return null; const cr = await wikiFileCredit(found.l, found.f); return cr ? { ...found, cr } : null; }
// finds Wikipedia's picture of exactly this place (by its link, its name or a page right next to it with the same name)
async function picWikiFor(id, x) { if (x.p && x.p.quiet) return null; // legal-server-fixes (Q1): a quiet place (a Timeline offer near home) - its point is never sent to look for a picture
  const have = picWikiVal(picWikiCK(x)); if (have !== undefined) return have && have.u && !have.cr && !svcNetDown() ? picWikiFill(x) : have; if (svcNetDown()) return undefined;
  let found = null;
  try {
    const src = x.p && x.p.src && x.p.src.type === 'wikipedia' && x.p.src.url ? String(x.p.src.url).match(/https?:\/\/(\w+)\.(?:m\.)?wikipedia\.org\/wiki\/([^?#]+)/) : null;
    if (src) { const pg = (await picWikiApi(src[1], 'titles=' + encodeURIComponent(decodeURIComponent(src[2]).replace(/_/g, ' '))))[0]; if (pg && pg.thumbnail) found = { t: pg.title, f: pg.pageimage, u: pg.thumbnail.source, l: src[1] }; }
    if (!found && x.type === 'city') for (const [lang, nm] of [['he', x.name], ['en', x.foreign]]) { if (!nm || found) continue; const pg = (await picWikiApi(lang, 'titles=' + encodeURIComponent(nm)))[0]; if (pg && pg.thumbnail && pg.pageid) found = { t: pg.title, f: pg.pageimage, u: pg.thumbnail.source, l: lang }; }
    // 4.47.1: "סנטיאגו" / "Santiago" are disambiguation pages (no picture) - the city's own page is around it: "סנטיאגו דה צ'ילה"
    if (!found && x.type === 'city' && x.c) for (const lang of ['he', 'en']) { if (found) break;
      const pages = await picWikiApi(lang, `generator=geosearch&ggscoord=${x.c.lat.toFixed(5)}%7C${x.c.lng.toFixed(5)}&ggsradius=10000&ggslimit=50`);
      const pg = pages.filter(p => p.thumbnail && picNameMatch(p.title, [x.name, x.foreign])).sort((a, b) => { const st = t => [x.name, x.foreign].filter(Boolean).some(n => nameCore(t).startsWith(nameCore(n))) ? 0 : 1; return st(a.title) - st(b.title) || nameCore(a.title).length - nameCore(b.title).length || (a.index || 0) - (b.index || 0); })[0]; if (pg) found = { t: pg.title, f: pg.pageimage, u: pg.thumbnail.source, l: lang }; }
    if (!found && x.type !== 'city') for (const lang of ['he', 'en']) { if (found) break;
      const pages = await picWikiApi(lang, `generator=geosearch&ggscoord=${x.c.lat.toFixed(5)}%7C${x.c.lng.toFixed(5)}&ggsradius=300&ggslimit=20`);
      const pg = pages.filter(p => p.thumbnail && picNameMatch(p.title, [x.name, x.foreign])).sort((a, b) => (a.index || 0) - (b.index || 0))[0]; if (pg) found = { t: pg.title, f: pg.pageimage, u: pg.thumbnail.source, l: lang }; }
    found = await picWikiWithCredit(found); // legal-credits (Q8): kept with its author and licence; a picture with no free licence is not kept
  } catch (e) { return undefined; } // a network error: try again another time
  picWikiSet(x, found); return found;
}
// legal-credits (Q8): a picture kept before 11.40.0 has no facts - they are asked on its next use (its file's name first, when that is missing too);
// a picture that turns out not to be free is dropped like "no picture" (picImgOf then shows none)
async function picWikiFill(x) { const have = picWikiVal(picWikiCK(x)); if (!have || !have.u || have.cr) return have;
  try { let f = have.f; if (!f && have.t) { const pg = (await picWikiApi(have.l || 'he', 'titles=' + encodeURIComponent(have.t)))[0]; f = pg && pg.pageimage; }
    const full = await picWikiWithCredit(f ? { ...have, f } : null); picWikiSet(x, full); return full; } catch (e) { return undefined; } }
async function picLoadImg(url) { // 7.1.0: Wikipedia's picture through the client; my own picture (data:/blob:) loads locally
  if (/^(data|blob):/.test(String(url))) return localImg(url);
  const r = await svcAsk('pointImage', { key: url, prio: 'screen', build: () => ({ url, as: 'img' }), parse: d => d }); return r.kind === 'ok' ? r.value : null; }
// an image change keeps both the choice (td.pic.img) and the small image, so undo brings back both
async function picImgChange(id, key, label, choice, url) {
  picBurstEnd(); const mk = `pimg:${id}:${key}`;
  if (url) await photoPut(mk, url); const td = tdOf(id), before = JSON.stringify(td.pic || {});
  const p = JSON.parse(before); p.img = p.img || {}; if (choice) p.img[key] = choice; else delete p.img[key]; if (!Object.keys(p.img).length) delete p.img;
  td.pic = p; tdSave(id); picRedraw(id);
  showUndoToast(label);
}
async function picSetImgSrc(id, key, src) {
  const m = picModel(id), x = m.pts.find(c => c.key === key); if (!x) return;
  if (src === 'none') return picImgChange(id, key, `בלי תמונה: ${x.name}`, { src: 'none' });
  if (src === 'wiki') { const w = await picWikiFor(id, x); if (!w || !w.u) { showToast('אין תמונה בוויקיפדיה למקום הזה'); return; }
    const im = await picLoadImg(w.u); if (!im) { showToast('התמונה מוויקיפדיה לא נטענה'); return; }
    return picImgChange(id, key, `📚 תמונה מוויקיפדיה: ${x.name}`, null, photoCropTo(im, {})); }
}
// in the background: Wikipedia's picture for every point in the picture that has no image yet (one at a time)
var PIC_WIKI_RUN = null; const PIC_WIKI_TRIED = new Set();
function picWikiKick(id) {
  if (PIC_WIKI_RUN || svcNetDown()) return; const m = picModel(id); if (!m) return; const imgs = m.P.img || {};
  const todo = m.pts.filter(x => x.lv !== 'out' && !MEMO.get(`pimg:${id}:${x.key}`) && !(imgs[x.key] && imgs[x.key].src) && picWikiVal(picWikiCK(x)) === undefined && !PIC_WIKI_TRIED.has(id + '|' + picWikiCK(x))).slice(0, 40);
  const fill = m.pts.filter(x => x.lv !== 'out' && MEMO.get(`pimg:${id}:${x.key}`) && !(imgs[x.key] && imgs[x.key].src === 'own') && (v => v && v.u && !v.cr)(picWikiVal(picWikiCK(x))) && !PIC_WIKI_TRIED.has(id + '|cr|' + picWikiCK(x))).slice(0, 40);
  if (fill.length) { PIC_WIKI_RUN = (async () => { try { for (const x of fill) { PIC_WIKI_TRIED.add(id + '|cr|' + picWikiCK(x)); await picWikiFill(x); } } finally { PIC_WIKI_RUN = null; picRedraw(id); picWikiKick(id); } })(); return; } // legal-credits: the facts of the pictures already in it first
  if (!todo.length) return; let n = 0, got = 0, shown = 0;
  PIC_WIKI_RUN = (async () => { try { for (const x of todo) { n++; PIC_WIKI_TRIED.add(id + '|' + picWikiCK(x)); picSt({ svc: 'pointImage', n: n - 1, of: todo.length });
      const w = await picWikiFor(id, x); if (w && w.u && !MEMO.get(`pimg:${id}:${x.key}`)) { const im = await picLoadImg(w.u); if (im) { try { const k = `pimg:${id}:${x.key}`; await photoPut(k, photoCropTo(im, {})); picOwnChange(k); got++; } catch (e) {} } }
      if (got > shown && n % 4 === 0) { shown = got; picRedraw(id); } } } finally { PIC_WIKI_RUN = null; picSt(null); if (got > shown) picRedraw(id); } })();
}
// undo-history: an image the app fetched on its own is not an action - it joins the state the next row is measured against
// (as hRebase does, for this one image), so undoing the next action never takes it away
function picOwnChange(k) { hAbsorb(hKey(['m', k])); }
// undo-history: after an undo the trip picture follows the data - the editor, the full-screen view and the style it shows (MEMO_VIEW
// mirrors td.mementoStyle and is not data); the memory screen is drawn by the undo itself
undoAfter(keys => { const ts = new Set();
  keys.forEach(k => { const p = JSON.parse(k); if (p[0] === 'd' && (p.length === 2 || ['pic', 'mementoStyle', 'photoOrder', 'highlights'].includes(p[2]))) ts.add(p[1]);
    if (p[0] === 'm') { const t = photoTripOf(p[1]); if (t) ts.add(t); } });
  ts.forEach(t => { if (MEMO_VIEW[t]) delete MEMO_VIEW[t].style; });
  ts.forEach(t => { if (PIC_ED && PIC_ED.id === t) { picEdDraw(); if (_sheetOpen && _sheetKind === 'picCard' && PIC_ED.card) picCard(PIC_ED.card, true); }
    if (PIC_FS.open && PIC_FS.id === t && !PIC_FS.key) photoViewDraw(); }); });
function picSt(s) { MEM_ST.img = s || null; memStDraw(); } // 7.1.0: the same one line as the background
function picRecrop(id, key) {
  const own = PIC_SRC_SESSION.get(id + '|' + key), o = (picOf(id).img || {})[key] || {}, prev = o.crop;
  if (o.src === 'own') { if (own) return openPicCrop(id, key, own, 'own', prev); showToast('כדי לחתוך שוב בוחרים את התמונה שוב (נשמרת רק הגרסה הקטנה)'); return; }
  const m = picModel(id), x = m.pts.find(c => c.key === key); if (!x) return;
  picWikiFor(id, x).then(w => { if (w && w.u) openPicCrop(id, key, w.u, 'wiki', prev); else showToast('התמונה המקורית לא זמינה עכשיו'); });
}


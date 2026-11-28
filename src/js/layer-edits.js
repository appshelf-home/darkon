// ================= THE LAYERS SCREEN AND THE LAYER EDITOR (management group, diet-groups 11.62.0; the layer data and the state are in js/state.js) =================
// 4.12.2: the order rows of the trip's layer chips, shared by the layers window and the trip editor
function chipOrderRowsHTML() {
  const esc = escH, gs = hasTrip() ? chipGroups() : [];
  return gs.map(g => `<div class="lyr-row itin-card" data-iday="layers" data-islot="chips" data-ipid="${esc(g.id)}">
      <span class="itin-grip g-grip" aria-label="גרירה לשינוי הסדר">⠿</span>
      <span class="lyr-dot" style="--lc:${g.color}">${typeIcon(g.ik, { size: 18 })}</span>
      <span class="lyr-name"><b>${esc(g.label)}</b><small>${(c => c ? c.found + ' מתוך ' + c.total + ' נמצאו' : POINTS.filter(p => g.layers.includes(p.layer) && !isHiddenPoint(p)).length + ' מקומות')(collCount(g.layers))}${g.merged ? (SEP + 'מכמה יעדים') : ''}</small></span></div>`).join('');
}
// 9.7.0 (Q6a): the order is changed by dragging ⠿ (TOUCH 'drag'), in the layers screen and in its bottom sheet alike
gestureOn('drag', '.lyr-row.itin-card', { grip: '.g-grip', items: '.itin-card', zones: r => [r.closest('.lyr-list')],
  drop: (r, to) => { const ids = [...to.zone.querySelectorAll('.itin-card')].filter(x => x !== r).map(x => pid(x.dataset.ipid)); ids.splice(to.idx, 0, pid(r.dataset.ipid)); setChipOrder(ids, '🎨 סדר השבבים שונה'); } });
act('chips.auto', () => { setChipOrder(null, 'חזרה לסדר האוטומטי'); }); // 10.15.0 (design-review Q7): no 🎨
act('layer.add', c => { if (c.el.closest('#sheet')) _sheetReturn = openLayersSheet; openLayerEditor(null); });
act('layer.edit', c => { if (c.el.closest('#sheet')) _sheetReturn = openLayersSheet; openLayerEditor(Number(c.v)); });
// 4.12.2: the layers open as a window over the screen (🎨 in the points chip row): ✕ or Back returns to where you were,
// and the chips behind it change as you reorder. A layer's editor opens over it and returns to it.
function openLayersSheet() { layerNote(openLayersSheet, arguments); renderLayersScreen(document.getElementById('sheet')); showSheetBackdrop('openLayersSheet'); }
function renderLayersScreen(target) {
  const el = target || document.getElementById('main'), inSheet = !!target;
  const d = oneDest(), list = destLayersEff(d), multi = tripDests(activeTripObj()).length > 1;
  const esc = escH;
  const gs = inTrip() ? chipGroups() : [], manual = !!((STATE.chipOrder || {})[STATE.activeTrip]); // destination-view: the chips' order is a trip's
  const rows = list.map((l, i) => `<div class="lyr-row" data-ipid="${l.id}">
      <span class="lyr-dot" style="--lc:${l.color}">${typeIcon(l.icon, { size: 18 })}</span>
      <span class="lyr-name"><b>${esc(l.name)}</b><small>${l.label && l.label !== l.name ? 'בשבב: ' + esc(l.label) + SEP : ''}${layerPlaceCount(l.id)} מקומות${SEP}${l.type && BASE_TYPES[l.type] ? 'בסיס: ' + BASE_TYPES[l.type].name : 'ייחודית'}${l.collection ? SEP + msiT('checklist', 'אוסף') : ''}${l.hidden ? SEP + msiT('visibility_off', 'מוסתרת') : ''}${l.userAdded ? (SEP + 'הוספתי') : (l.edited ? (SEP + 'ערכתי') : '')}</small></span>
      <button class="top-ic" data-act="layer.edit" data-v="${l.id}" aria-label="עריכת השכבה" title="עריכת השכבה">${msi('edit')}</button></div>`).join('');
  el.innerHTML = (inSheet ? `${fmHead('🎨 שכבות', 'lyClose')}` : `<div class="section-head"><h2>🎨 שכבות</h2><p>סדר השבבים בטיול, והשכבות של כל יעד.</p></div>`) + `
    ${gs.length ? `<h3 class="lyr-h" id="chipOrderHead">סדר השבבים בטיול הזה ${tipI('layers.order')}</h3><p class="sh-hint">הסדר של שבבי השכבות בכל המסכים.</p>
    <div class="lyr-list" data-dropday="layers" data-dropslot="chips">${chipOrderRowsHTML()}</div>
    ${manual ? `<div class="lyr-add"><button class="btn-outline" data-act="chips.auto">${msi('restart_alt', { size: 18 })}חזרה לסדר האוטומטי</button></div>` : ''}` : ''}
    <h3 class="lyr-h">השכבות של ${esc(d.meta.name)}</h3>${multi ? '<p class="sh-hint">שבבי היעד בראש המסך מחליפים יעד.</p>' : ''}
    <div class="lyr-list">${rows}</div>
    <div class="lyr-add"><button class="btn-outline" data-act="layer.add">${msi('add', { size: 18 })}שכבה</button></div>`;
}
// 7.2.0 (ע3): the layer editor - from the building blocks. Visible: name, color, icon; "עוד": short name, type, collection, hide.
// o.dest: the destination of a new layer; o.draft: a new layer of a draft (saved in the draft, D.addLayers); o.onNew(id): the new
// layer goes back chosen to the form it was opened from (the place editor's "＋ שכבה חדשה").
function openLayerEditor(id, o) { layerNote(openLayerEditor, arguments); o = o || {};
  const D = o.draft || null, d = D ? (draftTargetDests(D).find(t => t.id === o.dest) || {}).dp : (id != null ? (DESTS[layerDef(id).dest] || oneDest()) : (o.dest && DESTS[o.dest]) || oneDest());
  if (!d) return;
  const list = D ? draftDestLayers(D, o.dest) : destLayersEff(d), cur = !D && id != null ? list.find(l => l.id === id) : null;
  const F = fmNew({ id, o, d, cur, others: list.filter(l => !cur || l.id !== cur.id), n: cur ? POINTS.filter(p => p.layer === cur.id).length : 0 }); // every place that moves on a delete, closed ones too
  const color0 = cur ? cur.color : layerColorPick(list);
  const sheet = document.getElementById('sheet');
  sheet.innerHTML = `${fmHead(`${cur ? '✏️ עריכת שכבה' : '＋ שכבה חדשה'}${SEP}${escH(d.meta.name)}`)}
    ${fmText(F, 'name', { label: 'שם', req: true, value: cur ? cur.name : '', placeholder: 'למשל: גלריות ואמנות', dup: true, on: () => leDup(F) })}
    ${fmColor(F, 'color', { label: 'צבע', value: color0, palette: LAYER_PALETTE })}
    ${fmIcon(F, 'icon', { label: 'אייקון', hint: 'לכל מקום בשכבה שאין לו אייקון משלו, ולמקומות שיתווספו', value: cur ? cur.icon : 'tourist_attraction', icons: Object.entries(ICON_EMOJI).filter(([k]) => k !== 'note'), on: () => leIconDup(F) })}
    ${fmSec(F, 'more', { title: 'עוד', sum: F2 => [fmGet(F2, 'label') && escH(fmGet(F2, 'label')), (BASE_TYPES[fmGet(F2, 'type')] || {}).name, fmGet(F2, 'coll') && 'שכבת אוסף', fmGet(F2, 'hide') && 'מוסתרת'].filter(Boolean).join(SEP) },
      fmText(F, 'label', { label: 'שם קצר לשבב (רשות)', value: cur && cur.label !== cur.name ? cur.label : '', placeholder: 'אם ריק - השם המלא' })
      + fmChips(F, 'type', { label: 'סוג ' + tipI('layer.type'), value: cur ? (cur.type || '') : '', // 10.15.0 (design-review Q5, Q6): ⓘ for the type; a unique layer is pin_drop (✨ is Claude's)
        options: [...Object.entries(BASE_TYPES).map(([k, b]) => [k, `${typeIcon(b.icon, { size: 18 })} ${b.name}`]), ['', `${msi('pin_drop', { size: 18 })} ייחודית ליעד`]], on: () => leIconDup(F) })
      + (D ? '' : fmToggle(F, 'coll', { label: `${msiT('checklist', 'שכבת אוסף', { size: 18 })} ${tipI('layer.coll', true)}`, value: !!(cur && cur.collection) })) // Q4: checklist
      + (cur ? fmToggle(F, 'hide', { label: 'הסתרת השכבה', sub: 'המקומות שלה לא מוצגים, בלי למחוק; מחזירים מ"מוסתרים"', value: !!cur.hidden }) : ''))}
    ${cur && F.opts.others.length ? fmEndActs([{ act: 'le.del', label: 'מחיקת השכבה', del: true }]) + '<div id="leDelBox"></div>' : ''}
    ${fmSaveBar({ act: 'le.save' })}`;
  showSheetBackdrop('openLayerEditor'); fmAttach(F); leIconDup(F);
}
function leDup(F) { const v = fmGet(F, 'name').toLowerCase(), sim = v ? F.opts.others.filter(l => String(l.name).trim().toLowerCase() === v || String(l.label).trim().toLowerCase() === v) : [];
  fmDup(F, 'name', sim.length ? 'יש כבר במאגר: ' + sim.map(l => `<b>${escH(l.name)}</b>`).join(', ') : ''); }
// 4.3.0: layer chips show the icon only, so two separate chips with the same icon can't be told apart
function leIconDup(F) { const icon = F.vals.icon, ltype = F.vals.type, d = F.opts.d;
  const same = F.opts.others.filter(l => l.icon === icon).concat(F.opts.o.draft ? [] : LAYER_DEFS.filter(l => l.dest !== d.id && l.icon === icon && !(ltype && l.type === ltype)));
  fmDup(F, 'icon', same.length ? `האייקון כבר בשימוש בשכבה <b>${same.map(l => escH(l.name)).filter((v, i, a) => a.indexOf(v) === i).join(', ')}</b>. בשבבים רואים רק אייקון, אז עדיף אייקון אחר.` : ''); }
act('le.del', c => { const F = fmOf(c.el); if (!F) return; const cur = F.opts.cur, n = F.opts.n;
  if (!n) { closeSheet(); deleteLayer(cur, null); return; }
  F.delTo = null; fmQ(F, '#leDelBox').innerHTML = `<div class="bk-restore"><p>בשכבה יש <b>${n} מקומות</b>. לאן להעביר אותם? (ביטול מחזיר הכל.) כדי לשמור אותם כמו שהם, אפשר במקום זה ${msi('visibility_off', { cls: 'msi-in' })} הסתרה (ב"עוד").</p>
    <div class="chips-row wrap">${F.opts.others.map(l => `<button type="button" class="chip" data-act="le.delTo" data-v="${l.id}" data-active="false"><span class="dd-dot" style="background:${l.color}"></span>${escH(l.label || l.name)}</button>`).join('')}</div>
    <div class="brow export-actions"><button class="sh-secondary" data-act="le.delGo" disabled>${msi('delete', { size: 18 })} מחיקה והעברה</button></div></div>`;
  reveal(fmQ(F, '#leDelBox')); return 'quiet'; });
act('le.delTo', c => { const F = fmOf(c.el); if (!F) return; F.delTo = Number(c.v); fmRoot(F).querySelectorAll('[data-act="le.delTo"]').forEach(x => x.dataset.active = String(x === c.el)); fmQ(F, '[data-act="le.delGo"]').disabled = false; return 'quiet'; });
act('le.delGo', c => { const F = fmOf(c.el); if (!F || F.delTo == null) return; closeSheet(); deleteLayer(F.opts.cur, F.delTo); });
act('le.save', c => { const F = fmOf(c.el); if (!F) return; const { cur, d, o } = F.opts;
  const name = fmGet(F, 'name'); if (!name) return fmFail(F, 'name', 'חסר שם');
  const data = { name, label: fmGet(F, 'label') || name, color: F.vals.color, icon: F.vals.icon, collection: !!fmGet(F, 'coll'), hidden: !!fmGet(F, 'hide'), type: fmGet(F, 'type') || '' };
  c.el.disabled = true; c.el.textContent = 'שומר…';
  if (o.draft) { const D = o.draft; if (F.opts.others.some(l => nameCore(l.name) === nameCore(name))) { c.el.disabled = false; c.el.textContent = 'שמירה'; return fmFail(F, 'name', 'יש כבר שכבה בשם הזה'); }
    const nl = { id: 'nl:' + Date.now().toString(36), dest: o.dest, name, label: data.label === name ? name.slice(0, 10) : data.label, color: data.color, icon: data.icon, type: data.type };
    D.addLayers = D.addLayers || []; D.addLayers.push(nl); saveDraft(); closeSheet(); showUndoToast('שכבה חדשה בטיוטה: ' + name); /* undo-history: a row */ if (o.onNew) o.onNew(o.dest + '|' + nl.id); return; }
  const who = STATE.settings.deviceName || '', had = new Set(LAYER_DEFS.map(l => l.id)); let msg;
  if (!cur) { const nid = Date.now(); STATE.edits.layers[nid] = { op: 'add', data: { ...data, dest: d.id }, at: Date.now(), who };
    const ord = STATE.edits.layerOrder[d.id]; if (ord) STATE.edits.layerOrder = { ...STATE.edits.layerOrder, [d.id]: ord.concat(nid) }; msg = '🎨 נוספה שכבה: ' + name; }
  else if (cur.userAdded) { const e = STATE.edits.layers[cur.id]; STATE.edits.layers[cur.id] = { ...e, data: { ...e.data, ...data }, at: Date.now(), who }; msg = '🎨 השכבה נערכה: ' + name; }
  else { const base = destLayers(d).find(l => l.id === cur.id) || {}; const diff = {};
    LAYER_FIELDS.forEach(k => { const bv = k === 'collection' || k === 'hidden' ? !!base[k] : (k === 'type' ? (base[k] || '') : base[k]); if (JSON.stringify(data[k]) !== JSON.stringify(bv)) diff[k] = data[k]; });
    if (Object.keys(diff).length) STATE.edits.layers[cur.id] = { op: 'edit', data: diff, at: Date.now(), who }; else delete STATE.edits.layers[cur.id];
    msg = (data.hidden && !cur.hidden ? SY.hide + ' הוסתרה השכבה: ' : (!data.hidden && cur.hidden ? '👁️ הוחזרה השכבה: ' : '🎨 השכבה נערכה: ')) + name; }
  closeSheet(); refreshLayers(); persist();
  showUndoToast(msg);
  if (!cur && o.onNew) { const nw = LAYER_DEFS.find(l => !had.has(l.id)); if (nw) o.onNew(nw.id); }
});

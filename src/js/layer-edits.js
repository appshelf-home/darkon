// ================= LAYER EDITS (3.1.0) =================
// Layers belong to a destination. This device's changes live in STATE.edits.layers ({op:'add'|'edit'|'del', data})
// and STATE.edits.layerOrder ({destId: [layer ids]}), layered over the destination like place edits.
function ensureEditsShape() { const e = STATE.edits; e.places = e.places || {}; e.status = e.status || {}; e.layers = e.layers || {}; e.layerOrder = e.layerOrder || {}; }
function destLayersEff(d) {
  const L = STATE.edits.layers || {};
  let out = destLayers(d).filter(l => !(L[l.id] && L[l.id].op === 'del'))
    .map(l => L[l.id] && L[l.id].op === 'edit' ? { ...l, ...L[l.id].data, id: l.id, dest: d.id, edited: true } : l);
  Object.entries(L).forEach(([id, e]) => { if (e.op === 'add' && e.data.dest === d.id) out.push({ ...e.data, id: Number(id), dest: d.id, userAdded: true }); });
  const ord = (STATE.edits.layerOrder || {})[d.id];
  if (ord && ord.length) { const pos = id => { const i = ord.indexOf(id); return i < 0 ? 1e9 : i; };
    out = out.map((l, i) => [l, i]).sort((a, b) => (pos(a[0].id) - pos(b[0].id)) || (a[1] - b[1])).map(x => x[0]); }
  return out;
}
function refreshLayers() { applyActiveTrip(); if (document.getElementById('legend')) renderLegend(); }
function layerPlaceCount(id) { return POINTS.filter(p => p.layer === id && placeExists(p)).length; } // 10.15.0 (design-review Q8): existing places, as the chip
const LAYER_FIELDS = ['name', 'label', 'color', 'icon', 'collection', 'hidden', 'type'];
const LAYER_PALETTE = ['#757575','#6A1B9A','#00ACC1','#F57C00','#D81B60','#1E88E5','#43A047','#C08A2E','#8D6E63','#3949AB','#00897B','#E53935','#7CB342','#5E35B1','#F4511E','#546E7A'];
// 11.8.0 (small-fixes item 2): a new layer's color - the first palette color no other layer of its list uses, else the first. One pick for the
// layer editor and the door (fileClean: a layer from a file with no type and a bad color)
function layerColorPick(list) { return LAYER_PALETTE.find(c => !(list || []).some(l => l && String(l.color).toLowerCase() === c.toLowerCase())) || LAYER_PALETTE[0]; }
function setPlaceLayerRaw(p, target) {
  if (p.tripOnly) { const t = activeTripObj(), d = DESTS[p.dest] || curDest(); t.places = t.places.map(x => x.id === p.id ? { ...x, layer: target - d.idBase } : x); return; }
  const who = STATE.settings.deviceName || '', e = STATE.edits.places[p.id];
  if (p.userAdded && e) { STATE.edits.places[p.id] = { ...e, data: { ...e.data, layer: target }, at: Date.now(), who }; return; }
  const base = BASE_PLACES.find(b => b.id === p.id); if (!base) return;
  const diff = placeDiff(base, { ...(e && e.op === 'edit' ? e.data : {}), layer: target });
  if (Object.keys(diff).length) STATE.edits.places[p.id] = { op: 'edit', data: diff, at: Date.now(), who }; else delete STATE.edits.places[p.id];
}
// 4.15.0: ★ key point of the route. Comes marked in the destination/trip file; the user adds or removes it here. Stored
// like any place edit (destination places in the edits layer, trip places in the trip), so an update never overwrites it.
function deleteLayer(cur, target) {
  const who = STATE.settings.deviceName || '';
  const moved = POINTS.filter(p => p.layer === cur.id);
  moved.forEach(p => setPlaceLayerRaw(p, target));
  STATE.trash.forEach(t => { if (t.kind !== 'layer' && t.entry && t.entry.data && t.entry.data.layer === cur.id) t.entry = { ...t.entry, data: { ...t.entry.data, layer: target } }; });
  if (cur.userAdded) { const e = STATE.edits.layers[cur.id]; delete STATE.edits.layers[cur.id]; STATE.trash.push({ kind: 'layer', id: cur.id, entry: e, at: Date.now() }); }
  else STATE.edits.layers[cur.id] = { op: 'del', data: { name: cur.name }, at: Date.now(), who };
  const ord = STATE.edits.layerOrder[cur.dest]; if (ord) STATE.edits.layerOrder = { ...STATE.edits.layerOrder, [cur.dest]: ord.filter(x => x !== cur.id) };
  refreshLayers(); persist(); 
  showUndoToast(`${SY.del} נמחקה השכבה ${cur.name}${moved.length ? `${SEP}${moved.length} מקומות עברו ל${layerDef(target).label}` : ''}`);
}
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
let _sheetReturn = null;
function openLayersSheet() { layerNote(openLayersSheet, arguments); renderLayersScreen(document.getElementById('sheet')); showSheetBackdrop('openLayersSheet'); }
function renderLayersScreen(target) {
  const el = target || document.getElementById('main'), inSheet = !!target;
  const d = oneDest(), list = destLayersEff(d), multi = tripDests(activeTripObj()).length > 1;
  const esc = escH;
  const gs = hasTrip() ? chipGroups() : [], manual = !!((STATE.chipOrder || {})[STATE.activeTrip]);
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
  if (o.draft) { const D = o.draft; if (F.opts.others.some(l => discNorm(l.name) === discNorm(name))) { c.el.disabled = false; c.el.textContent = 'שמירה'; return fmFail(F, 'name', 'יש כבר שכבה בשם הזה'); }
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

function statusBadgesHTML(p) { // 10.2.0 (design-2): marks as tags with their icons; "רק בטיול הזה" lives only in the edit window
  const t = (ic, txt, cls) => `<span class="tl-tag${cls ? ' ' + cls : ''}">${tagIc(ic)}${txt}</span>`, esc = escH;
  return (p.access === 'limited' ? t('warning', 'גישה מוגבלת' + (p.accessNote ? SEP + esc(p.accessNote) : ''), 'must') : '')
    + (isGoneStatus(p.status) ? t(STATUS_MS[p.status], esc(STATUS_LABEL[p.status]) + (p.statusNote ? SEP + esc(p.statusNote) : ''), 'must st-why') : '')
    + (p.tripOnly ? '' : p.userAdded ? t('edit_note', 'הוספתי' + (p.completed ? (SEP + 'הושלם מהקובץ') : '')) : p.edited ? t('edit', 'ערכתי') : '');
}

const STORE_KEY = PACK.storeKey;
function loadState() {
  try {
    const raw = regRawGet(STORE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return { favorites: [], visited: [], itinerary: {}, theme: 'auto' };
}
const STATE = loadState();
oldCopyCheck(regRawGet(STORE_KEY)); // 10.1.1: data saved by a newer version - this copy is old
STATE.favorites = new Set(STATE.favorites || []);
STATE.visited = new Set(STATE.visited || []);
STATE.itinerary = STATE.itinerary || {};
STATE.times = STATE.times || {};          // "day|id" -> {start:'HH:MM', end:'HH:MM'}
STATE.planItems = STATE.planItems || {};  // the plan's own items: "n_..." a note {name, address, icon}, "c_..." a copy of a place {ref, ...}
STATE.settings = Object.assign({ morningEnd: '12:00', afternoonEnd: '17:00', deviceName: '' }, STATE.settings || {});
STATE.log = Array.isArray(STATE.log) ? STATE.log : [];   // 1.8.0: change log, ~14 days
STATE.lastBackupAt = STATE.lastBackupAt || 0;             // 1.8.0: for the 30-day reminder
STATE.createdAt = STATE.createdAt || Date.now();
if (!STATE.lastBackupAt && !STATE.firstUnbackedAt && ((STATE.favorites && STATE.favorites.size) || (STATE.visited && STATE.visited.size))) STATE.firstUnbackedAt = STATE.createdAt;
STATE.nagSnoozeUntil = STATE.nagSnoozeUntil || 0;
STATE.firstUnbackedAt = STATE.firstUnbackedAt || 0;
STATE.edits = STATE.edits || { places: {}, status: {} };  // 2.0.0: this device's content edits, layered over the pack
ensureEditsShape();
STATE.trash = Array.isArray(STATE.trash) ? STATE.trash : []; // deleted places I added, 30 days
STATE.chipOrder = STATE.chipOrder || {};

// ---------- 3.0.0: trips ----------
// 4.38.0: a trip without dates has its days on "virtual" dates from VDATE, shown as "יום N" (see DAYS WITHOUT DATES)
function tripDests(t) { return [...new Set((t.segments || []).map(x => x.dest))].filter(id => DESTS[id]); }
const LODGING_USER_FIELDS = ['bookingRef', 'price', 'checkInTime', 'checkOutTime', 'includes', 'phone', 'whatsapp', 'website', 'rating', 'ratingAt']; // 4.18.0: kept through a trip update; kit-fixes (A2.4): the price I typed too
const NO_TRIP = { id: null, name: '', start: '', end: '', segments: [], travels: [], lodging: [], places: [], schedule: [], travelers: '' };
function activeTripObj() { return STATE.trips[STATE.activeTrip] || NO_TRIP; }
function hasTrip() { return !!STATE.trips[STATE.activeTrip]; }
STATE.trips = STATE.trips || {};
STATE.tripData = STATE.tripData || {};
migRun('planItems', () => Object.values(STATE.tripData).forEach(planItemsUp)); // 10.0.0: the stored key renamed once
migrate('state');
STATE.destBases = STATE.destBases || {}; // 4.2.1: destination id -> its numbering on this device, reused if it comes back
Object.values(DESTS).forEach(d => { STATE.destBases[d.id] = d.idBase || 0; });
// 4.0.0: trips built into this copy. A new one is added once (a deleted one doesn't come back);
// a newer version (an updated trip site) replaces the shared trip details and keeps everyone's marks and plan.
STATE.bundleSeen = STATE.bundleSeen || {};
BUNDLE.trips.forEach(bt => {
  const v = bt.version || 1, seen = STATE.bundleSeen[bt.id], ex = STATE.trips[bt.id];
  if (ex && seen == null) STATE.bundleSeen[bt.id] = Math.min(v, 1); // the same trip came in from a file: kept, a newer version updates it
  else if (!ex && seen == null) { STATE.trips[bt.id] = { ...JSON.parse(JSON.stringify(bt)), createdAt: Date.now() }; STATE.tripData[bt.id] = STATE.tripData[bt.id] || { favorites: [], visited: [], itinerary: {}, times: {}, planItems: {}, flightsSeeded: false }; STATE.bundleSeen[bt.id] = v; if (!STATE.activeTrip || !STATE.trips[STATE.activeTrip]) STATE.activeTrip = bt.id; }
  else if (ex && v > (seen || 0)) { const oldLod = ex.lodging || []; ['name','start','end','segments','travels','lodging','places','schedule','travelers'].forEach(k => { if (bt[k] !== undefined) ex[k] = JSON.parse(JSON.stringify(bt[k])); });
    ex.lodging = (ex.lodging || []).map(l => { const o = oldLod.find(x => x.id === l.id); if (!o) return l; const keep = {}; LODGING_USER_FIELDS.forEach(f => { if (o[f] && !l[f]) keep[f] = o[f]; }); return { ...l, ...keep }; }); // 4.18.0
    ex.version = v; STATE.bundleSeen[bt.id] = v; STATE._tripUpdated = ex.name; }
  if (STATE.trips[bt.id] && STATE.bundleSeen[bt.id] !== seen) { lodgingToDevice(STATE.trips[bt.id]); schedToDevice(STATE.trips[bt.id]); (STATE._bundleHotels = STATE._bundleHotels || []).push(bt.id); } // 9.3.0 (ס11): its hotels move in below
});
Object.values(STATE.trips).forEach(t => normalizeTrip(t));
Object.values(STATE.trips).forEach(t => travelOrphansOut(t, STATE.tripData[t.id])); // 11.0.0: the plan's copy of a travel merged into its program line follows the line
if (!STATE.trips[STATE.activeTrip] || STATE.trips[STATE.activeTrip].archived) STATE.activeTrip = pickRelevantTrip(null); // 4.28.0: an archived trip is never the active one
// a lodging that points at a place no longer in its destination (a hotel is a place of the trip) gets that place
// from the built-in trip of the same id or from the file it came in
// 4.38.0: a file may plan by day numbers (an organized tour before it has dates): days, segments {dest, days}, travels {day},
// lodging {checkInDay, checkOutDay}, organized schedule {day}. They become the trip's "virtual" dates.
function daysFromFileFields(t) {
  if (t.start || !(t.days || (t.segments || []).some(s => s.days))) return;
  if ((t.segments || []).some(s => s.days && !s.from)) { let c = 1; t.segments = t.segments.map(s => { const n = Math.max(1, Number(s.days) || 1), o = { dest: s.dest, from: vDate(c), to: vDate(c + n - 1) }; c += n; return o; }); t.days = Math.max(Number(t.days) || 0, c - 1); }
  const v = n => Number(n) >= 1 ? vDate(Number(n)) : '';
  (t.travels || []).forEach(x => { if (!x.date && x.day) x.date = v(x.day); delete x.day; });
  (t.lodging || []).forEach(x => { if (!x.checkIn && x.checkInDay) x.checkIn = v(x.checkInDay); if (!x.checkOut && x.checkOutDay) x.checkOut = v(x.checkOutDay); delete x.checkInDay; delete x.checkOutDay; });
  (t.schedule || []).forEach(x => { if (!x.date && x.day) x.date = v(x.day); delete x.day; });
  if (t.weekday != null && t.wd == null) { const w = { 'ראשון': 0, 'שני': 1, 'שלישי': 2, 'רביעי': 3, 'חמישי': 4, 'שישי': 5, 'שבת': 6 }[t.weekday]; t.wd = w != null ? w : Number(t.weekday); delete t.weekday; }
}
function normalizeTrip(t, filePlaces) {
  if (!t) return t;
  t.places = Array.isArray(t.places) ? t.places : []; t.schedule = Array.isArray(t.schedule) ? t.schedule : [];
  t.schedule.forEach((x, i) => { if (x && (x.id == null || x.id === '')) x.id = 'auto-' + (x.date || '') + '-' + i; }); // 4.22.0: my changes to an item are kept by its id
  t.travels = t.travels || []; t.lodging = t.lodging || []; t.segments = t.segments || [];
  daysFromFileFields(t);
  travelsMerge(t); // 11.0.0 (travels-1-model, Q16): a program line that is one of the travels becomes one record
  const bt = BUNDLE.trips.find(x => x.id === t.id);
  (t.lodging || []).forEach(l => {
    if (l.placeId == null || t.places.some(x => x.id === l.placeId)) return;
    const inDest = t.segments.some(s => DESTS[s.dest] && DESTS[s.dest].places.some(q => DESTS[s.dest].idBase + q.id === l.placeId));
    if (inDest) return;
    const src = (bt && (bt.places || []).find(x => x.id === l.placeId)) || (filePlaces || []).find(x => x.id === l.placeId);
    if (src) { const q = JSON.parse(JSON.stringify(src)); delete q.layer_name; delete q.color; delete q.anchor; t.places.push(q); }
  });
  return t;
}

// timeline-followups-3 (decisions 2026-11-13 review of 11.11.0, item 9): the closed-trip read-only rule sits at the write point.
// The active trip's mirror (STATE.favorites, visited, itinerary ...) is never written into a closed trip's data - whether it is
// borrowed by withTrip, shown in the archive view, or made active by any other path, present or future. A closed trip's data
// changes only by a direct, purposeful write (tdOf ... tdSave: the memory screen, the Timeline import), which reloads the mirror;
// the mirror loaded for it (loadPersonal) is a copy, so nothing changed in place in the mirror reaches its data either.
function tripWritable(id) { const t = id && STATE.trips[id]; return !!id && !(t && t.archived); }
function stashActive() {
  if (!tripWritable(STATE.activeTrip)) return;
  STATE.tripData[STATE.activeTrip] = { ...(STATE.tripData[STATE.activeTrip] || {}), favorites: [...STATE.favorites], visited: [...STATE.visited], itinerary: STATE.itinerary, times: STATE.times, planItems: STATE.planItems, flightsSeeded: !!STATE.flightsSeeded, bookings: STATE.bookings || {}, planX: STATE.planX || {} };
}
function loadPersonal(id) {
  const d0 = STATE.tripData[id] || {}, d = tripWritable(id) || !id ? d0 : JSON.parse(JSON.stringify(d0)); // item 9: a closed trip's mirror is a copy - a change made in place (the flights placed in the plan on a switch) never reaches its data
  STATE.favorites = new Set(d.favorites || []); STATE.visited = new Set(d.visited || []);
  STATE.itinerary = d.itinerary || {}; STATE.times = d.times || {}; STATE.planItems = d.planItems || {}; STATE.flightsSeeded = !!d.flightsSeeded; STATE.bookings = d.bookings || {}; // 4.18.0
  STATE.planX = d.planX || {}; planX(); // my order around the organized schedule, my changes to it (9.2.0: no locks); undo-history: its shape once, here - not on a later read, so a restored state compares equal
}
// 4.1.0: several destinations in one trip. Points, map, regions and reservations show the destinations in
// FP.dest (multi-select chips, empty = all). The general-info and layers screens show one destination (oneDest).
// Defaults: on trip days the destination(s) of today (both on a transfer day); before and after the trip - all.
// A manual pick is kept until the end of the day (the device store DEV: DEV.destPick / DEV.oneDestPick).
let oneDestId = null;
let _destTrip = null;
function segsOn(t, iso) { return (t.segments || []).filter(s => DESTS[s.dest] && s.from <= iso && iso <= s.to); }
function defaultDestSel() {
  const t = activeTripObj(), ids = tripDests(t); if (ids.length < 2) return new Set();
  const pick = DEV.destPick; if (pick && pick.date === todayStr() && pick.trip === t.id) return normDestSel(new Set(pick.keys || []));
  const iso = todayStr(); if (!t.start || iso < t.start || iso > t.end) return new Set();
  return normDestSel(new Set(segsOn(t, iso).map(s => s.dest)));
}
function normDestSel(set) { if (set.has(NONE)) return new Set([NONE]); const ids = tripDests(activeTripObj()); const s = new Set([...set].filter(id => ids.includes(id))); return s.size >= ids.length ? new Set() : s; }
function selDests() { const ids = tripDests(activeTripObj()); const s = ids.filter(id => FP.dest.has(id)); return s.length ? s : ids; }
function destShown(id) { return !FP.dest.size || !id || FP.dest.has(id); }
// the destination of a day: on a transfer day the one you arrive at; before the trip the first, after it the last
function dayDestId(iso, t) { // 10.13.0: t - any trip (its look on the trips screen); the active one by default
  t = t || activeTripObj(); const ids = tripDests(t); if (!ids.length) return null; iso = iso || todayStr();
  const segs = (t.segments || []).filter(s => DESTS[s.dest]); if (!segs.length) return ids[0];
  const on = segsOn(t, iso); if (on.length) return on.slice().sort((a, b) => b.from.localeCompare(a.from))[0].dest;
  if (t.end && iso > t.end) return segs.slice().sort((a, b) => b.to.localeCompare(a.to))[0].dest;
  return segs.slice().sort((a, b) => a.from.localeCompare(b.from))[0].dest;
}
function oneDest() {
  const t = activeTripObj(), ids = tripDests(t), pick = DEV.oneDestPick;
  let id = oneDestId && ids.includes(oneDestId) ? oneDestId : null;
  if (!id && pick && pick.date === todayStr() && pick.trip === t.id && ids.includes(pick.id)) id = pick.id;
  return DESTS[id || dayDestId()] || NO_DEST;
}
// main destination for map centers, address search and new places: today's destination if shown, else the first shown
function curDest() { const s = selDests(), d = dayDestId(); return DESTS[s.includes(d) ? d : (s[0] || d)] || NO_DEST; }
function isLayerTab(t) { return typeof t === 'number' || (typeof t === 'string' && t.startsWith('type:')); }
// chips of the points section: base layers of several shown destinations merge into one chip (id "type:<type>");
// a unique layer shows only when its destination is shown; same-named layers of different destinations keep the destination's name
function buildPointsGroup() {
  const ids = selDests(), multi = ids.length > 1;
  const ls = LAYER_DEFS.filter(l => !l.hidden && ids.includes(l.dest)), out = [], done = new Set();
  ls.forEach(l => {
    if (done.has(l.id)) return;
    if (multi && l.type) {
      const same = ls.filter(x => x.type === l.type);
      if (new Set(same.map(x => x.dest)).size > 1) {
        same.forEach(x => done.add(x.id)); const labels = [...new Set(same.map(x => x.label))];
        out.push({ id: 'type:' + l.type, label: labels.length === 1 ? labels[0] : (BASE_TYPES[l.type] ? BASE_TYPES[l.type].label : l.label), color: l.color, ik: l.icon || (BASE_TYPES[l.type] && BASE_TYPES[l.type].icon) || '', layers: same.map(x => x.id), type: l.type, merged: true });
        return;
      }
    }
    done.add(l.id);
    const clash = multi && ls.some(x => x.dest !== l.dest && (x.label === l.label || x.name === l.name));
    out.push({ id: l.id, label: clash ? `${l.label}${SEP}${destName(l.dest)}` : l.label, color: l.color, ik: l.icon || '', layers: [l.id], type: l.type || '' });
  });
  POINTS_GROUP.length = 1; out.forEach(g => POINTS_GROUP.push(g));
}
function groupOf(tab) { return POINTS_GROUP.find(g => g.id === tab); }
function groupOfLayer(id) { return POINTS_GROUP.find(g => g.layers && g.layers.includes(id)); }
function layerTagLabel(id) { const g = groupOfLayer(id); return g ? g.label : layerDef(id).label; }
function tabLayerIds(tab) { const g = groupOf(tab); return g && g.layers ? g.layers : (typeof tab === 'number' ? [tab] : []); }
// keeps a layer choice when the shown destinations change: same layer, or the chip of the same base type
function translateTab(tab) {
  if (!isLayerTab(tab)) return tab;
  if (groupOf(tab)) return tab;
  if (typeof tab === 'number') { const g = groupOfLayer(tab); if (g) return g.id; }
  const type = typeof tab === 'string' ? tab.slice(5) : (layerDef(tab).type || '');
  if (type) { const g = POINTS_GROUP.find(x => x.id !== 'all' && x.type === type); if (g) return g.id; }
  return null;
}
function setDestSel(set, manual) {
  FP.dest = normDestSel(set);
  if (manual) devSet({ destPick: { date: todayStr(), trip: STATE.activeTrip, keys: [...FP.dest] } });
  buildPointsGroup();
  if (isLayerTab(activeTab)) activeTab = translateTab(activeTab) || 'all';
  if (FP.layers.size && !selNone(FP.layers)) { const t = new Set([...FP.layers].map(translateTab).filter(x => x != null)); FP.layers = t.size ? t : new Set(); }
  FP.regions = new Set([...FP.regions].filter(k => destShown(k.split('|')[0])));
  if (manual) persist();
}
function setOneDest(id) { oneDestId = id; devSet({ oneDestPick: { date: todayStr(), trip: STATE.activeTrip, id } }); }
function destsOfDay(dayKey) { const t = activeTripObj(), d = TRIP_DAYS.find(x => x.key === dayKey); if (!d) return tripDests(t); return [...new Set((t.segments || []).filter(x => x.from <= d.date && d.date <= x.to).map(x => x.dest))]; }
function applyActiveTrip() {
  const t = activeTripObj(); if (t.id) normalizeTrip(t);
  TRIP_DAYS.length = 0; tripDayList(t).forEach(d => TRIP_DAYS.push(d)); // 4.38.0: also a trip planned by days, without dates
  const ds = tripDests(t).map(id => DESTS[id]);
  BASE_PLACES = [].concat(...ds.map(destPlaces));
  TRIP_HIDDEN = new Set(((STATE.tripData || {})[t.id] || {}).hidden || []); // 4.29.0: 👎 from a past trip, hidden only in this trip
  LAYER_DEFS.length = 0; ds.forEach(d => destLayersEff(d).forEach(l => LAYER_DEFS.push(l)));
  { // 4.37.0: the default follows the trip's dates too - moving the dates (or a new day) picks again; a pick from before the move is dropped
    const key = (t.id || '') + '|' + (t.start || '') + '|' + (t.end || '') + '|' + todayStr(), prev = _destTrip;
    if (prev !== key) {
      const [pid, ps, pe] = String(prev || '').split('|');
      if (prev && pid === (t.id || '') && (ps !== (t.start || '') || pe !== (t.end || ''))) {
        ['destPick', 'oneDestPick'].forEach(k => { const p = DEV[k]; if (p && p.trip === t.id) devSet({ [k]: null }); });
      }
      _destTrip = key; FP.dest = defaultDestSel(); oneDestId = null;
    }
  }
  FP.dest = normDestSel(FP.dest);
  buildPointsGroup();
  rebuildPoints();
  document.body.classList.toggle('no-trip', !hasTrip());
}
// 11.29.1 (sw-bar-quiet item 6; decisions 2026-11-19 · Review of the 11.29.0 summary, Q1): the status bar stays the app's blue (the page's
// theme-color meta, --primary, build.py's launch_colours) whatever the destination - applyDestTheme, which set it to the destination's
// primary, is gone; a destination's theme still colours the trip's name, the mementos and the trip picture

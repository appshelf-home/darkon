// ================= FILTER AND SEARCH (5.14.0 - cl-filter-impl-plan, decisions ס1-ס6, ד1, ד7) =================
// Mechanism map: "מודל הסינון". One state per family of screens (FILTER.points for the places list and the map, FILTER.draft
// for the draft). Two views of the same state and nothing else: the header on the screen (row 1 the layers, one row with ＋N;
// row 2 [destination ▾] [days ▾] [funnel · N] … "N מקומות · ✕") and the filter window (a bottom sheet up to half the screen,
// every kind of filter in the same building blocks). Between kinds "and", inside a kind "or". Sorting is kept here, it is not
// a filter. The funnel's dot counts the filters that are on and have no button on the screen (in a full-screen map - all).
const FUNNEL_SVG = msi('tune', { size: 18, cls: 'funnel-ic' }); // 10.3.0 (design-3): "סינון" with the tune icon
let _routeOpenStop = null; // a stop to open on the route map after it is drawn (from the list in ℹ️ כללי)
const DAY_COLORS = ['#534AB7', '#0F6E56', '#C8553D', '#185FA5', '#993556', '#854F0B', '#3B6D11'];
function rangeDays() {
  if (!FP.days) return [];
  const ks = TRIP_DAYS.map(d => d.key); let a = ks.indexOf(FP.days.from), b = ks.indexOf(FP.days.to);
  if (a < 0 || b < 0) { FP.days = null; return []; }
  if (a > b) [a, b] = [b, a];
  return ks.slice(a, b + 1);
}
function dayByKey(k) { return TRIP_DAYS.find(d => d.key === k); }
function singleLayerSel() { return FP.layers.size === 1 && !selNone(FP.layers) ? [...FP.layers][0] : null; }
// 5.15.0 (ס6): search looks in the name, address, description, region and layer name - the same everywhere; kit-fixes (item 4): and the local name
function searchFields(p) { return [p.name, p.foreign, p.address, p.description, p.dest ? regionName(p) : '', p.layer != null && !p.planOnly ? layerDef(p.layer).name : '']; }
function searchHit(p, q) { q = String(q || '').trim().toLowerCase(); return !q || searchFields(p).some(v => String(v || '').toLowerCase().includes(q)); }
function searchPass(p) { return searchHit(p, FP.q); }
function bookPass(p) { if (bookingOf(p.id)) return false; const c = reservationClass(p.reservation); return c === 'resv-must' || c === 'resv-rec'; } // 4.18.0: booked ones are done
function filteredPoints(opts) {
  opts = opts || {};
  let pts = VIS(POINTS).filter(layerPass);
  if (singleLayerSel() != null && FP.styles.size) pts = pts.filter(p => FP.styles.has(p.icon));
  pts = pts.filter(searchPass);
  if (FP.fav) pts = pts.filter(p => STATE.favorites.has(p.id));
  if (prefs().visited === 'hide') pts = pts.filter(p => !STATE.visited.has(p.id));
  if (FP.book) pts = pts.filter(bookPass);
  const ds = opts.noDays ? [] : rangeDays();
  if (ds.length) {
    // the days' items: places, a place planned twice (a copy points at it with ref), and personal 📝 items. The 📝 items
    // have no layer and no region: they show with all layers on and regardless of regions (4.4.1)
    const inDays = new Set(), notes = [];
    ds.forEach(d => { const dd = ensureDay(d); ['morning', 'afternoon', 'evening', 'unassigned'].forEach(k => dd[k].forEach(id => {
      if (typeof id === 'number') { inDays.add(id); return; }
      const f = STATE.planItems[id]; if (!f) return;
      if (f.ref != null) inDays.add(f.ref); else if (!notes.some(x => x.id === id)) { const it = planItem(id); if (it) notes.push(it); }
    }));
      // 11.37.0 (phone-round-4-fixes P4, G87): a group program's places of the day (scheduleOf: its own edits and hidden lines
      // applied) and the night's hotel are the day's places too - the days map (4.46.3) shows them, and it gets its points from here
      const date = (dayByKey(d) || {}).date; if (!date) return;
      scheduleOf(date).forEach(x => { if (x.placeId != null && x.placeId !== '') inDays.add(Number(x.placeId)); });
      tripLodging().forEach(l => { if (l.placeId != null && l.checkIn && l.checkOut && l.checkIn <= date && date < l.checkOut) inDays.add(Number(l.placeId)); });
    });
    pts = pts.filter(p => inDays.has(p.id));
    if (!FP.layers.size && !FP.styles.size && !FP.fav && !FP.book) pts = pts.concat(notes.filter(searchPass));
  }
  return pts;
}
// 5.15.0 (ס6): search results the other filters hide - "עוד N תוצאות מחוץ לסינון · להציג"
function searchOutside(shown) { if (!FP.q) return 0; const ids = new Set(shown.map(p => p.id)); return POINTS.filter(p => !isHiddenPoint(p) && searchPass(p) && !ids.has(p.id)).length; }
function showSearchOutside() { const q = FP.q; resetFilter(); FP.q = q; const si = document.getElementById('search'); if (si) si.value = q; const sx = document.getElementById('searchClear'); if (sx) sx.hidden = !q; setDestSel(new Set(), true); render(); }
function filterActive() { return !!(FP.layers.size || FP.regions.size || FP.days || FP.route || FP.q || FP.styles.size || FP.fav || FP.book); }
function regionsManual() { const p = DEV.regionPick; return !!(FP.regions.size && p && p.date === todayStr()); } // the lodging's region on a trip day is automatic - not counted
function destManual() { const p = DEV.destPick; return !!(p && p.date === todayStr() && p.trip === STATE.activeTrip && FP.dest.size); } // the automatic pick is not counted
function searchShown() { const w = document.getElementById('searchWrap'); return !!(w && w.style.display !== 'none'); }
// how many filters are on with no button of their own on the screen; in a full-screen map every one counts
function filterHiddenCount(fam, full) {
  if (fam === 'draft') { const f = FILTER.draft; return (f.changed ? 1 : 0) + (f.notes ? 1 : 0) + (full ? (f.srcs.size ? 1 : 0) + (f.layers.size ? 1 : 0) : 0); }
  let n = (FP.styles.size ? 1 : 0) + (FP.fav ? 1 : 0) + (FP.book ? 1 : 0) + (regionsManual() ? 1 : 0) + (FP.route && activeTab === 'map' && routeHiddenCount() ? 1 : 0);
  if (FP.q && (full || !searchShown())) n++;
  if (full) n += (destManual() ? 1 : 0) + (FP.days || FP.route ? 1 : 0) + (FP.layers.size ? 1 : 0);
  return n;
}
function daysLabel() {
  const ds = rangeDays(); if (!ds.length) return 'כל הימים';
  const a = dayByKey(ds[0]), b = dayByKey(ds[ds.length - 1]);
  return ds.length === 1 ? (a.date === todayStr() ? 'היום' + SEP + a.label : a.label) : `\u2066${a.label}–${b.label}\u2069`;
}
// 4.12.1: the regions to pick from are not filtered by the regions themselves (all off left nothing to pick)
function usedRegions() { const used = new Set(POINTS.filter(p => !isHiddenPoint(p) && destShown(p.dest)).map(regionKey)); return shownRegions().filter(r => used.has(r.key) || FP.regions.has(r.key)); }
function destBtnLabel() { const ids = tripDests(activeTripObj()); if (!FP.dest.size) return msi('public', { size: 16 }) + ' הכל'; if (selNone(FP.dest)) return 'אף יעד';
  const on = ids.filter(id => FP.dest.has(id)); return on.length === 1 ? withFlag(destFlag(on[0]), destName(on[0])) : fpCount(on.length, ids.length); }
// value-no-cut (Q1): a picker's count is a value - never cut by "…": its own box (.fp-n), and the header's picker that holds it takes its width
const fpCount = (n, of) => `<bdi class="fp-n">${n} מתוך ${of}</bdi>`;
function draftSrcLabel(srcs) { const f = FILTER.draft.srcs; if (!f.size) return msi('public', { size: 16 }) + ' הכל'; if (selNone(f)) return 'אף מקור'; const on = srcs.filter(s => f.has(s.id)); return on.length === 1 ? on[0].label : fpCount(on.length, srcs.length); }
const fpickHTML = (fx, label, active, ex) => `<button type="button" class="fpick" data-act="filter" data-fx="${fx}" data-active="${!!active}"${ex || ''}><span>${label}</span>${msi('arrow_drop_down', { size: 18, cls: 'fp-caret' })}</button>`; // 10.3.0 (design-3): a chip with a small ▾
function funnelHTML(n, full) { return `<button type="button" class="ffunnel" data-act="filter" data-fx="open" data-active="${n > 0}" aria-label="סינון${n ? SEP + n + ' פעילים' : ''}">${FUNNEL_SVG}<span>סינון</span>${n ? `<b class="fbadge">${n}</b>` : ''}</button>`; }
function countHTML(text, short, clear) { return `<span class="fcount"><span class="fc-l">${text}</span><span class="fc-s">${short}</span>${clear ? '<button type="button" class="fclear" data-act="filter" data-fx="clear" aria-label="ניקוי הסינון">✕</button>' : ''}</span>`; }
// the header of the places list and the map (ד1): row 1 the layer chips, row 2 the buttons and the count
function filterCountText() { if (FP.route && activeTab === 'map' && routeOffered()) { const v = routeVisits().length; return [`${v} תחנות`, String(v)]; } const n = filteredPoints().length; return [`${n} ${n === 1 ? TX.place : TX.places}`, String(n)]; }
function filterHeadHTML() {
  const [l, s] = filterCountText();
  return `<div class="fbar fhead">${tripDests(activeTripObj()).length > 1 ? fpickHTML('dest', destBtnLabel(), destManual()) : ''}${TRIP_DAYS.length ? fpickHTML('days', FP.route ? msi('route', { size: 16 }) + ' כל המסלול' : msi('date_range', { size: 16 }) + ' ' + daysLabel(), FP.days || FP.route) : ''}${funnelHTML(filterHiddenCount('points'))}${countHTML(l, s, filterActive())}</div>`;
}
function layerChipsBlock() { const gs = chipGroups(), vis = VIS(POINTS); return layerChipsHTML('layerChips', gs, FP.layers, g => collCount(g.layers) || vis.filter(p => g.layers.includes(p.layer)).length); }
// 10.15.0 (design-review Q3, Q8): a collection's counter lives in its chip - found ("היינו") out of every place of its layers in the shown
// destinations that exists (closed and not existing out; hidden as not interesting still counts). null when no layer of the chip is a collection.
function placeExists(p) { return p.status !== 'gone' && p.status !== 'closed'; }
function collCount(lids) { if (!lids.some(id => layerDef(id).collection)) return null;
  const all = POINTS.filter(p => lids.includes(p.layer) && layerDef(p.layer).collection && destShown(p.dest) && placeExists(p));
  return { found: all.filter(p => STATE.visited.has(p.id)).length, total: all.length }; }
// one handler for every filter button, on the screen and in the window
function filterAct(fam, fx, b) {
  if (fx === 'open') { const t = layerTop(); if (t && t.key === 'openFilterSheet' && _sheetOpen) { closeSheet(); return; } openFilterSheet(fam); return; }
  if (fam === 'draft') {
    const f = FILTER.draft;
    if (fx === 'clear') { f.srcs = new Set(); f.layers = new Set(); f.changed = false; f.notes = false; }
    else if (fx === 'srcs') { openDraftSrcPicker(); return; }
    else if (fx === 'changed') f.changed = !f.changed; else if (fx === 'notes') f.notes = !f.notes;
    else if (fx === 'src') { const ids = draftSources(DRAFT).map(s => s.id); f.srcs = b.dataset.v ? selToggle(f.srcs, b.dataset.v, ids) : selAllTap(f.srcs); }
    filterChanged('draft'); return;
  }
  if (fx === 'clear') { resetFilter(); appScroll(0); }
  else if (fx === 'dest') { openDestPicker(); return; }
  else if (fx === 'days') { openDaysPicker(); return; }
  else if (fx === 'routehid') { openRouteHidePicker(); return; }
  else if (fx === 'fav') FP.fav = !FP.fav; else if (fx === 'book') FP.book = !FP.book;
  else if (fx === 'limited') { devSet({ showLimited: !DEV.showLimited }); } // a device choice: the filter draws (no data counter)
  else if (fx === 'style') { const keys = (b.closest('[data-skeys]').dataset.skeys || '').split(',').filter(Boolean); FP.styles = b.dataset.v ? selToggle(FP.styles, b.dataset.v, keys) : selAllTap(FP.styles); }
  else if (fx === 'region') { const keys = usedRegions().map(r => r.key); FP.regions = b.dataset.v ? selToggle(FP.regions, b.dataset.v, keys) : selAllTap(FP.regions);
    if (FP.regions.size && !selNone(FP.regions) && keys.every(x => FP.regions.has(x))) FP.regions = new Set(); devSet({ regionPick: { date: todayStr(), keys: [...FP.regions] } }); }
  else if (fx === 'sort') { setSort(b.dataset.v); return; }
  filterChanged('points');
}
act('filter', c => { const t = layerTop(), fam = c.el.closest('#draftFilter') ? 'draft' : c.el.closest('#sheet') && t && t.fam ? t.fam : 'points';
  const g = _dataGen; filterAct(fam, c.el.dataset.fx, c.el); return _dataGen !== g ? 'redraw' : 'quiet'; }); // filterChanged draws (until stage 3)
async function setSort(v) {
  if (v === 'near' && !userPos) { showToast('מבקש הרשאת מיקום...'); await requestUserLocation(); if (!userPos) { showToast('לא ניתנה הרשאת מיקום'); filterChanged('points'); return; } }
  FP.sort = v; filterChanged('points');
}
// a change: the screen behind follows at once, and the filter window (when it is open) shows the new state at the same scroll
function filterChanged(fam, keepTop) {
  if (fam === 'draft') renderDraftScreen(); else if (activeTab === 'map') rerenderKeepingMap(); else { const y = window.scrollY; render(); appScroll(keepTop ? 0 : Math.min(y, document.documentElement.scrollHeight)); }
  const t = layerTop(); if (t && t.key === 'openFilterSheet' && _sheetOpen && t.draw) { const sh = document.getElementById('sheet'), y = sh.scrollTop; t.draw(); sh.scrollTop = y; }
  fsSyncAll();
}
// the filter window (ס2, ס5): a bottom sheet up to half the screen; every change applies at once. A tap on what shows above it
// closes it (a pin then opens its card, a card its window). ◎ and ＋ at the bottom of the map hide while it is open.
function openFilterSheet(fam) { layerNote(openFilterSheet, arguments);
  Object.keys(MAPS).forEach(id => { try { closeFloatCard(id); } catch (e) {} }); // "one thing at the bottom": the pin card closes
  const sheet = document.getElementById('sheet');
  const draw = () => { sheet.innerHTML = filterSheetHTML(fam);
    
    wireLayerChips(sheet.querySelector(fam === 'draft' ? '#fwDLayers' : '#fwLayers')); };
  draw(); showSheetBackdrop('openFilterSheet', { draw, live: true }); layerTop().fam = fam;
  requestAnimationFrame(() => document.querySelectorAll('#sheet .lchips').forEach(fitChipRows)); // drawn before the window was on screen
}
function fsec(title, body) { return body ? `<div class="fsec"><div class="fsec-h">${title}</div>${body}</div>` : ''; }
function fchips(fx, items, rowAttr) { return choiceSetHTML(items, { as: 'chips', act: 'filter', attr: () => ` data-fx="${fx}"`, rowAttr }); } // the filter's chip sets (9.4.0)
function fswitch(fx, label, on) { return `<button type="button" class="fswitch" data-act="filter" data-fx="${fx}" aria-pressed="${!!on}"><span>${label}</span><span class="fm-sw" aria-hidden="true"></span></button>`; } // 10.5.0 (design-4 part 2): the shared switch look
function filterSheetHTML(fam) {
  let h = '', n, clear;
  if (fam === 'draft') {
    const D = DRAFT; if (!D) return '<div class="sheet-head"><b>סינון</b><button class="sheet-x" data-act="win.close" id="fwClose" aria-label="סגירה">✕</button></div>';
    const f = FILTER.draft, srcs = draftSources(D), ch = draftLayerChips(D); n = draftShown(D).length; clear = !!(f.srcs.size || f.layers.size || f.changed || f.notes);
    if (srcs.length > 1) h += fsec('מקור', fchips('src', [{ v: '', html: `${msi('public', { size: 18 })} הכל`, on: !f.srcs.size }].concat(srcs.map(s => ({ v: s.id, html: _qe(s.label), on: selOn(f.srcs, s.id) })))));
    if (ch.chips.length > 1) h += fsec('שכבות', layerChipsHTML('fwDLayers', ch.chips, f.layers, ch.count));
    const rc = draftRoundCounts(D, draftItems(D));
    if (rc.ch || rc.nt) h += fsec('בטיוטה', (rc.ch ? fswitch('changed', `${claudeMark()} רק מה שהשתנה בסבב${SEP}${rc.ch}`, f.changed) : '') + (rc.nt ? fswitch('notes', `${msi('chat', { size: 18 })} רק עם הערה${SEP}${rc.nt}`, f.notes) : ''));
  } else {
    n = filterCountText()[0]; clear = filterActive();
    const multi = tripDests(activeTripObj()).length > 1;
    if (multi || TRIP_DAYS.length) h += fsec('יעד וימים', `<div class="fbar">${multi ? fpickHTML('dest', destBtnLabel(), destManual()) : ''}${TRIP_DAYS.length ? fpickHTML('days', FP.route ? msi('route', { size: 16 }) + ' כל המסלול' : msi('date_range', { size: 16 }) + ' ' + daysLabel(), FP.days || FP.route) : ''}</div>`);
    const gs = chipGroups(), vis = VIS(POINTS);
    h += fsec('שכבות', layerChipsHTML('fwLayers', gs, FP.layers, g => vis.filter(p => g.layers.includes(p.layer)).length));
    const one = singleLayerSel();
    if (one != null) { const styles = [...new Set(VIS(POINTS.filter(p => tabLayerIds(one).includes(p.layer))).map(p => p.icon).filter(Boolean))];
      if (styles.length > 1) h += fsec('סגנונות', fchips('style', [{ v: '', html: 'הכל', on: !FP.styles.size }].concat(styles.map(st => ({ v: st, html: typeIcon(st, { size: 18 }), attr: ` aria-label="${ICON_HE[st] || st}" title="${ICON_HE[st] || st}"`, on: selOn(FP.styles, st) }))), ` data-skeys="${styles.join(',')}"`)); }
    const lim = POINTS.filter(p => p.access === 'limited' && destShown(p.dest) && !layerDef(p.layer).hidden).length;
    h += fsec('סימונים' + (lim ? ' ' + tipI('filter.limited') : ''), fswitch('fav', msi('star', { size: 18 }) + ' רק ' + TX.fav, FP.fav) + fswitch('book', msi('event_available', { size: 18 }) + ' רק מה שצריך להזמין', FP.book) + (lim ? fswitch('limited', msi('warning', { size: 18 }) + ' כולל גישה מוגבלת', DEV.showLimited) : ''));
    const rs = usedRegions();
    if (rs.length) h += fsec('אזורים', fchips('region', [{ v: '', html: 'כל האזורים', on: !FP.regions.size }].concat(rs.map(r => ({ v: r.key, html: _qe(r.name), on: selOn(FP.regions, r.key) })))));
    if (FP.route && activeTab === 'map' && routeOffered()) { const k = routeHiddenCount(); h += fsec('המסלול', fpickHTML('routehid', `${msi('route', { size: 16 })} מה מוצג במסלול${k ? SEP + k + ' מוסתרים' : ''}`, k)); }
    if (activeTab === 'all') h += `<hr class="fsep">` + fsec('מיון', fchips('sort', [['fav', 'מועדפים קודם'], ['alpha', 'לפי א-ב']].concat(MAP_AVAILABLE ? [['near', 'קרוב אליי']] : []).map(([v, l]) => ({ v, html: l, on: FP.sort === v }))));
  }
  return `<div class="sheet-head"><b>${FUNNEL_SVG} סינון${SEP}${typeof n === 'number' ? n + ' ' + TX.places : n}</b>${clear ? '<button type="button" class="fclear-all" data-act="filter" data-fx="clear">ניקוי הכל</button>' : ''}<button class="sheet-x" data-act="win.close" id="fwClose" aria-label="סגירה">✕</button></div>` + h;
}
function resetFilter() {
  FP.layers = new Set(); FP.styles = new Set(); FP.regions = new Set(); FP.days = null; FP.route = false; FP.fav = false; FP.book = false;
  devSet({ regionPick: { date: todayStr(), keys: [] } });
  FP.q = ''; const si = document.getElementById('search'); if (si) si.value = ''; const sx = document.getElementById('searchClear'); if (sx) sx.hidden = true;
}
// one picker for a set of chips with "הכל" (destinations of the trip, sources of a draft): a filter - every tap applies at once, no "סיום", the title counts
// 11.13.0 (timeline-followups-4): its chips row says it is a multi-select (data-multi) - the crawl's design scan met it with one choice on
// and took it for an exclusive choice drawn as chips (designscan.js __chipScan)
function openChipsPicker(key, title, items, getSel, setSel, after) { const ids = items.map(x => x.id);
  openFmChoice({ key, title: () => { const n = getSel().size; return title + (n ? SEP + n : ''); }, closeId: 'cpkClose', as: 'chips', multi: 'filter', rowAttr: ' data-multi="1"', options: [{ v: '', html: `${msi('public', { size: 18 })} הכל` }].concat(items.map(x => ({ v: x.id, html: x.label }))),
    isOn: v => v === '' ? !getSel().size : selOn(getSel(), v) }, v => { const s = getSel(); setSel(v !== '' ? selToggle(s, v, ids) : selAllTap(s)); after(); });
}
function openDestPicker() { const ids = tripDests(activeTripObj());
  openChipsPicker('openDestPicker', 'יעדים', ids.map(id => ({ id, label: _qe(withFlag(destFlag(id), destName(id))) })), () => FP.dest, s => setDestSel(s, true), () => filterChanged('points')); }
function openDraftSrcPicker() { if (!DRAFT) return; openChipsPicker('openDraftSrcPicker', 'מקורות', draftSources(DRAFT).map(s => ({ id: s.id, label: _qe(s.label) })), () => FILTER.draft.srcs, s => { FILTER.draft.srcs = s; }, () => filterChanged('draft')); }
// ס5: the days picker - a filter (picker-rule): every tap applies at once, every close keeps, no "סיום"; the title shows the choice
function openDaysPicker() { const tk = TRIP_DAYS.find(d => d.date === todayStr());
  // 10.9.0 (design-forms, gap 40): "כל הימים / היום / כל המסלול" segmented; a range one band (its ends filled, the days between tinted); the title counts the days; the explanation behind ⓘ, one short line
  openFmChoice({ key: 'openDaysPicker', closeId: 'dpClose', as: 'grid', multi: 'filter', hintTag: 'div', quickAs: 'seg', title: () => { const n = FP.route ? 0 : rangeDays().length; return `${SY.days} ${FP.route ? 'כל המסלול' : daysLabel()}${n > 1 ? `${SEP}${n} ימים` : ''}`; },
    why: () => (routeOffered() ? msi('route', { cls: 'msi-in' }) + ' כל המסלול: התחנות של הטיול לפי הסדר, המעברים ביניהן ונקודות המפתח. מתקרבים - ונחשפים כל המקומות.<br>' : '') + 'יום אחד או כמה ימים ברצף: לוחצים על היום הראשון ואז על האחרון. המקומות ששובצו לימים האלה מופיעים ברשימה ובמפה.',
    hints: () => ['כמה ימים ברצף: היום הראשון ואז האחרון.'],
    quick: () => { const ds = new Set(rangeDays()); return [{ v: '', html: 'כל הימים', on: !FP.days && !FP.route }].concat(tk ? [{ v: '@today', html: 'היום', on: !!FP.days && ds.size === 1 && ds.has(tk.key) }] : [], routeOffered() ? [{ v: '@route', html: msi('route', { size: 16 }) + ' כל המסלול', attr: ' id="dpRoute"', on: FP.route }] : []); },
    options: () => { const r = rangeDays(), ds = new Set(r), an = (layerTop() || {}).anchor, many = r.length > 1;
      return TRIP_DAYS.map((d, i) => { const k = d.key, end = many && (k === r[0] || k === r[r.length - 1]);
        return { v: k, html: `<b>${d.label}</b>`, sub: `יום ${i + 1}`, on: ds.has(k) && (!many || end), mark: an === k, band: !many || !ds.has(k) ? '' : k === r[0] ? 'start' : k === r[r.length - 1] ? 'end' : 'mid' }; }); } },
  v => { const t = layerTop(); // the first tap anchors, the second closes the range; היום and כל הימים set it at once
    if (v === '@route') { FP.route = !FP.route; FP.days = null; t.anchor = null; }
    else { FP.route = false;
      if (!v) { FP.days = null; t.anchor = null; } else if (v === '@today') { FP.days = { from: tk.key, to: tk.key }; t.anchor = null; }
      else if (!t.anchor) { FP.days = { from: v, to: v }; t.anchor = v; } else { FP.days = { from: t.anchor, to: v }; t.anchor = null; } }
    filterChanged('points'); });
}
// ב3 (built with the filter, 5.14.0): one quiet line at the end of the places list, only when it has something.
// 8.1.0: 🙈 counts the rows of the hidden screen (hiddenGroups) and opens it; 🗑️ opens the trash.
function hiddenLineHTML() {
  const gone = hiddenCount(), tr = STATE.trash.length;
  if (!gone && !tr) return '';
  return `<div class="hid-line">${gone ? `<button type="button" class="hid-btn" data-act="hidden.line" data-v="hidden">${msi('visibility_off', { cls: 'msi-in' })} <span class="hid-tx">${gone === 1 ? 'מוסתר אחד' : gone + ' מוסתרים'}</span></button>` : ''}${gone && tr ? '<span aria-hidden="true">·</span>' : ''}${tr ? `<button type="button" class="hid-btn" data-act="hidden.line" data-v="trash">${msi('delete', { cls: 'msi-in' })} <span class="hid-tx">${tr} בסל</span></button>` : ''}</div>`;
}
// the end of the places list: search results outside the filter (ס6), then the hidden / trash line (ב3)
function listEndHTML(shown) { const k = searchOutside(shown);
  return (k ? `<button type="button" class="srch-out" data-act="search.outside">עוד ${k} תוצאות מחוץ לסינון${SEP}להציג</button>` : '') + hiddenLineHTML(); }
act('search.outside', () => showSearchOutside());
// ס6: the one search field over my data - the same look and behaviour everywhere (✕ clears and keeps the focus, the found part
// is marked). Used by the header's 🔍, ＋ מקום, "עוד מקום שהיינו בו" in closing a trip, and the search in the trip-picture editor.
function searchFieldHTML(id, placeholder, value) { return `<span class="clear-wrap sfield"><input id="${id}" type="text" data-sfield="1" enterkeyhint="search" autocomplete="off" placeholder="${placeholder}" value="${_qe(value || '')}"><button type="button" class="field-clear" id="${id}X" data-act="search.clearField" data-keepfocus aria-label="ניקוי"${value ? '' : ' hidden'}>✕</button></span>`; }
function wireSearchField(input, onInput) { if (!input) return; const x = document.getElementById(input.id + 'X'); input._onInput = onInput;
  input.addEventListener('input', () => { if (x) x.hidden = !input.value; onInput(input.value); });
}
act('search.clearField', c => { const input = c.el.closest('.clear-wrap').querySelector('input'); input.value = ''; c.el.hidden = true; if (input._onInput) input._onInput(''); input.focus(); return 'quiet'; });
// marks every occurrence of q in the text of root (cards, rows), case-insensitively; never inside fields or buttons' own labels
function markSearch(root, q) { q = String(q || '').trim(); if (!root || !q) return; const ql = q.toLowerCase(), tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), hits = []; let n;
  while ((n = tw.nextNode())) { if (n.parentElement.closest('input, textarea, select, mark, .sheet-head, .fbar, .lchips, script, style')) continue; if (n.nodeValue.toLowerCase().includes(ql)) hits.push(n); }
  hits.forEach(node => { const t = node.nodeValue, low = t.toLowerCase(), f = document.createDocumentFragment(); let i = 0, k;
    while ((k = low.indexOf(ql, i)) >= 0) { if (k > i) f.appendChild(document.createTextNode(t.slice(i, k))); const m = document.createElement('mark'); m.className = 'sf-hit'; m.textContent = t.slice(k, k + q.length); f.appendChild(m); i = k + q.length; }
    if (i < t.length) f.appendChild(document.createTextNode(t.slice(i))); node.replaceWith(f); }); }
act('hidden.line', c => { goTab(c.v === 'trash' ? 'trash' : 'hidden'); });
// several days on the map: each day in its own color, numbered from 1 as in the plan, a dashed gray line from one day to
// the next (through that night's hotel when it is known). One day keeps the look of the plan's map.
// 5.9.0 (decision מ2): the days view - one view for a day of the plan and for days picked on the map screen (the richer of the two):
// a color per day when there are several, the same numbers as the plan (DAY_NUM), the organized schedule's places without a number,
// the route along the roads where it was computed (walking dashed, transit in its line color, "≈" straight and pale while it is an
// estimate), a dashed line between days through the night's lodging, and only the lodging of these days.
function renderDaysMap(containerId, cardContainerId, pts, days) {
  const multi = days.length > 1, all = pts == null, base = new Set((pts || []).map(p => p.id));
  const ids = { has: id => all || base.has(id) || (typeof id === 'string' && STATE.planItems[id] && STATE.planItems[id].ref != null && base.has(STATE.planItems[id].ref)) };
  const dates = days.map(k => (dayByKey(k) || {}).date).filter(Boolean), hIds = hotelMarks(dates).map(h => h.id);
  const M = mapMake(containerId, { card: cardContainerId, addHere: !all,
    legend: multi ? days.map((k, i) => `<span><i style="background:${DAY_COLORS[i % DAY_COLORS.length]}"></i>${dayByKey(k).label}</span>`).join('') + '<span><i class="leg-dash"></i>בין ימים</span>' : '' });
  if (!M) return; const map = M.map;
  const hotelReady = addHotelMarker(map, M.bounds, containerId, dates.length ? dates : null);
  const plan = days.map((k, i) => { const dd = ensureDay(k), dn = DAY_NUM[k], ordered = dn ? [...dn.keys()] : [...dd.morning, ...dd.afternoon, ...dd.evening];
    const date = dayByKey(k).date, lod = tripLodging().find(l => l.placeId != null && l.checkIn && l.checkOut && l.checkIn <= date && date < l.checkOut);
    const sched = date ? scheduleOf(date).map(x => x.placeId != null && x.placeId !== '' ? POINTS.find(q => q.id === x.placeId) : null).filter(p => p && !ordered.includes(p.id)).map(p => p.id) : []; // 4.46.3: the program's places, without a number
    return { k, color: multi ? DAY_COLORS[i % DAY_COLORS.length] : null, ordered, onMap: ordered.filter(id => ids.has(id)), loose: dd.unassigned.filter(id => ids.has(id) && !ordered.includes(id)).concat(sched.filter(id => ids.has(id))), hotel: lod ? lod.placeId : null }; });
  const coords = {}, lines = [];
  // 11.2.0 (travels-3-maps, Q9): the day's travels - their ends' pins, their lines; a place of the trip that is only a travel's end is found, not pinned, and does not frame
  days.forEach(k => { if (!DAY_TRAVELS[k]) { const d = dayByKey(k); if (d) try { dayTimelineHTML(d); } catch (e) {} } });
  const pinned = new Set([].concat(...plan.map(d => d.onMap.concat(d.loose, d.hotel != null ? [d.hotel] : []))).concat(hIds)), tvOnly = new Set();
  days.forEach(k => (DAY_TRAVELS[k] || []).forEach(f => ['fromLoc', 'toLoc'].forEach(s => { const l = f[s]; if (l && l.pid != null && !pinned.has(l.pid)) tvOnly.add(l.pid); })));
  let tvL = [], tvG = null;
  const want = [...new Set([].concat(...plan.map(d => d.onMap.concat(d.loose))).concat(multi ? plan.map(d => d.hotel).filter(x => x != null) : []).concat([...tvOnly]))].map(planItem).filter(p => p && (p.address || p.manualCoord));
  const near = (x, y) => Math.abs(x.lat - y.lat) < 1e-5 && Math.abs(x.lng - y.lng) < 1e-5;
  const leg = (a, b, Lg, col) => { let m = Lg ? legMode(Lg) : 'walk', v = Lg ? legValue(Lg, m) : null; if (v && v.none) { m = 'car'; v = legValue(Lg, 'car'); }
    const c = col || (m === 'transit' && v && v.r && v.r.color ? v.r.color : (m === 'transit' ? '#C0392B' : '#1C2B33'));
    if (v && !v.est && v.r && v.r.g && v.r.g.length > 1) return L.polyline(v.r.g, { color: c, weight: 4, opacity: .8, dashArray: m === 'walk' ? '6 6' : null, className: 'leg-line ' + m });
    if (v && !v.est && m === 'transit') return L.polyline([[a.lat, a.lng], [b.lat, b.lng]], { color: c, weight: 4, opacity: .8, className: 'leg-line transit' });
    return L.polyline([[a.lat, a.lng], [b.lat, b.lng]], { color: col || '#1C2B33', weight: 2, opacity: .5, dashArray: '4 6', className: 'leg-line est' }); };
  const redraw = () => { lines.forEach(l => { try { map.removeLayer(l); } catch (e) {} }); lines.length = 0;
    tvL.forEach(l => { try { map.removeLayer(l); } catch (e) {} }); tvG = dayTravelGeo(days); tvL = dayTravelsDraw(map, containerId, tvG, pinned);
    const ll = id => coords[id] ? [coords[id].lat, coords[id].lng] : null;
    plan.forEach((d, i) => { const gaps = LEG_GAPS[d.k] || [];
      gaps.forEach(g => lines.push(L.polyline([[g.a.lat, g.a.lng], [g.b.lat, g.b.lng]], { color: '#7F77DD', weight: 2.5, opacity: .85, dashArray: '8 7', className: 'leg-line travel' }).addTo(map))); // 4.56.0
      const dayLegs = all ? Object.values(LEGS).filter(Lg => Lg.day === d.k) : [];
      if (dayLegs.length) dayLegs.forEach(Lg => lines.push(leg(Lg.a, Lg.b, Lg, d.color).addTo(map))); // 4.34.0: exactly the legs of the timeline (from and to the lodging)
      else { const cs = d.onMap.map(id => coords[id]).filter(Boolean);
        for (let j = 1; j < cs.length; j++) { const a = cs[j - 1], b = cs[j]; if (gaps.some(g => near(g.a, a) && near(g.b, b))) continue;
          lines.push(leg(a, b, Object.values(LEGS).find(Lg => Lg.day === d.k && near(Lg.a, a) && near(Lg.b, b)), d.color).addTo(map)); } }
      const next = plan[i + 1]; if (!multi || !next) return;
      const a = [...d.onMap].reverse().map(ll).find(Boolean), b = next.onMap.map(ll).find(Boolean), h = d.hotel != null ? ll(d.hotel) : null;
      const link = [a, h, b].filter(Boolean); if (link.length > 1) lines.push(L.polyline(link, { color: '#888780', weight: 2, opacity: 0.8, dashArray: '5 6' }).addTo(map)); }); };
  const ready = ensureGeocoded(want, M.progress, (p, coord) => {
    if (!coord) return; coords[p.id] = coord;
    plan.forEach(d => { if (hIds.includes(p.id)) return;
      const dn = DAY_NUM[d.k], n = dn && dn.get(p.id) ? dn.get(p.id) : d.ordered.indexOf(p.id) + 1, num = d.onMap.includes(p.id), loose = d.loose.includes(p.id); if (!num && !loose) return;
      M.pin(d.color ? { ...p, color: d.color } : p, coord, loose ? { unassigned: true } : { numbered: true, number: n }); });
    redraw();
    if (!ids.has(p.id) || tvOnly.has(p.id)) return; // a hotel only for the line between days; a travel's end frames only when near (dayTravelFrame)
    M.grow(coord); });
  Promise.all([hotelReady, ready]).then(() => { redraw();
    if (tvG.list.length) { M.bounds = dayTravelFrame(M.bounds, tvG); tvG.list.forEach(x => { const w = x.L ? travelPathWant(x.f, tvG.C, x.gc) : null; if (w) w.then(ok => { if (ok && MAPS[containerId] && MAPS[containerId].map === map) redraw(); }); }); }
    M.finish(all || (pts && pts.length) ? 'לא נמצאו מיקומים להצגה' : 'אין מקומות משובצים בימים האלה שמתאימים לסינון');
    if (tvG.list.length) tvEdgeArrows(map, tvG); });
}
function renderMapScreen() {
  const main = document.getElementById('main');
  if (!MAP_AVAILABLE) {
    main.innerHTML = `<div class="callout" style="margin-top:12px">${msi('map', { cls: 'msi-in' })} המפה עובדת רק באפליקציה המותקנת. כאן אפשר להשתמש ברשימות ובכפתור הניווט.</div>`;
    return;
  }
  main.innerHTML = `<div class="map-container map-full" id="mapView_screen" style="margin-top:8px"></div>`;
  { const m = document.getElementById('mapView_screen'), top = m.getBoundingClientRect().top + window.scrollY; // fills the screen down to the bottom bar
    m.style.height = Math.max(320, window.innerHeight - top - (window.innerWidth >= 1024 ? 24 : 78) - (rangeDays().length > 1 ? 30 : 0)) + 'px'; }
  const pts = filteredPoints(), ds = rangeDays();
  if (FP.route && routeOffered()) renderRouteMap('mapView_screen', pts);
  else if (ds.length) renderDaysMap('mapView_screen', 'mapCard_screen', pts, ds);
  else renderPointsMap('mapView_screen', 'mapCard_screen', pts, { chips: true, emptyMsg: selNone(FP.layers) ? ('כל השכבות כבויות' + SEP + 'בוחרים שכבה למעלה') : (!pts.length ? 'אין מקומות שמתאימים לסינון' : '') });
}


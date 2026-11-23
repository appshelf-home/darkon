// 4.23.0: ＋ מקום - a window that adds places to a day, or to one part of it (from the ＋ on that part's line):
// ⭐ favorites not in the plan yet, 📍 near the day (its places and tonight's hotel), 🔍 search, and ＋ מקום חדש.
// A place that is already on another day comes in as another copy (like 🗓️), so it can be on both.
let _addPl = null;
function addPlacePool(day) { return POINTS.filter(p => !p.planOnly && dayOk(day, p) && !isHiddenPoint(p) && !isGoneStatus(p.status)); }
function dayRefCoords(day) {
  const d = dayByKey(day), out = [];
  mergedIds(day).forEach(id => { const p = planItem(id); if (!p || isNote(p)) return; const c = routeCoordOf(POINTS.find(x => x.id === (p.dup ? copyRef(id) : id))); if (c) out.push(c); });
  scheduleOf(d.date).forEach(s => { if (s.placeId != null) { const c = routeCoordOf(POINTS.find(x => x.id === s.placeId)); if (c) out.push(c); } });
  const lod = tripLodging().find(l => l.checkIn <= d.date && d.date < l.checkOut); if (lod && lod.placeId != null) { const c = routeCoordOf(POINTS.find(x => x.id === lod.placeId)); if (c) out.push(c); }
  if (!out.length) { const ds = destsOfDay(day), m = ds.length && DESTS[ds[0]] ? DESTS[ds[0]].meta : null; if (m && m.center) out.push({ lat: m.center[0], lng: m.center[1], center: true }); }
  return out;
}
// 4.37.0: ＋ in a part of the day adds at the END of that part as shown - also after organized entries (e.g. after
// "אחר הצהריים חופשי"), not before them. The new item is anchored to whatever is last in the part right now.
function zoneLastTok(day, slot) {
  const d = dayByKey(day); if (!d) return null; const dayData = ensureDay(day), k = showParts() ? (slot || 'unassigned') : 'all';
  const own = (k === 'all' ? mergedIds(day) : dayData[k]).map((id, i) => ({ id, p: planItem(id), t: getTime(day, id), i })).filter(x => x.p);
  const org = scheduleOf(d.date).filter(s => k === 'all' || schedSlotOf(s) === k).map((s, i) => ({ sched: s, i }));
  const seq = orderZone(own, org, planX().anchors[day] || {}); return seq.length ? entryTok(seq[seq.length - 1]) : null;
}
function addAtPartEnd(day, slot, id) {
  const last = zoneLastTok(day, slot); ensureDay(day)[slot || 'unassigned'].push(id);
  if (last) { const x = planX(); x.anchors[day] = x.anchors[day] || {}; x.anchors[day][String(id)] = last; tidyAnchors(day); }
}
function addPlaceToDay(day, slot, p) {
  const lab = slot && slot !== 'unassigned' ? ' (' + (SLOTS.find(s => s.key === slot) || {}).label + ')' : '';
  planChange(`${SY.days} נוסף ל-${dayByKey(day).label}${lab}: ${p.name}`, () => {
    if (!TRIP_DAYS.some(x => isInDay(x.key, p.id))) { addAtPartEnd(day, slot, p.id); return; }
    const fid = 'c_' + Date.now().toString(36); STATE.planItems[fid] = { ref: p.id, name: p.name, address: p.address, icon: p.icon }; addAtPartEnd(day, slot, fid);
  });
}
function openAddPlaceSheet(day, slot) { layerNote(openAddPlaceSheet, arguments);
  const d = dayByKey(day); if (!d) return;
  const favN = addPlacePool(day).filter(p => STATE.favorites.has(p.id) && !TRIP_DAYS.some(x => isInDay(x.key, p.id))).length;
  _addPl = { day, slot: slot || 'unassigned', tab: favN ? 'fav' : 'near', q: '' };
  const sheet = document.getElementById('sheet'), esc = _escH;
  const partLab = _addPl.slot !== 'unassigned' ? SEP + ((SLOTS.find(s => s.key === _addPl.slot) || {}).label || '').replace(/^\S+\s+/, '') : '';
  sheet.innerHTML = `${fmHead(`＋ הוספה ליום${SEP}${tmFmt('day', d.date)}${partLab}`, 'apClose')}
    <div class="ap-search">${searchFieldHTML('apQ', 'חיפוש לפי שם, כתובת, תיאור, אזור או שכבה', '')}</div>
    <div class="ap-tabs" id="apTabs"></div>
    <div id="apList"></div>
    <div class="brow sheet-actions sheet-save-bar"><button class="sh-secondary" id="apNew" data-act="addPlace.new">＋ מקום חדש</button></div>`;
  wireSearchField(sheet.querySelector('#apQ'), v => { _addPl.q = v; drawAddPlace(); });
  
  drawAddPlace();
  openSheet('openAddPlaceSheet');
}
function drawAddPlace() {
  const a = _addPl, sheet = document.getElementById('sheet'), box = sheet.querySelector('#apList'), tabs = sheet.querySelector('#apTabs'); if (!a || !box) return;
  const esc = _escH, pool = addPlacePool(a.day), inPlan = p => TRIP_DAYS.find(x => isInDay(x.key, p.id) || schedEntries(p.id).some(e => e.day === x.key));
  const favs = pool.filter(p => STATE.favorites.has(p.id) && !inPlan(p));
  const refs = dayRefCoords(a.day), dist = p => { const c = routeCoordOf(p); if (!c || !refs.length) return null; return Math.min(...refs.map(r => distanceKm(r, c))); };
  const q = a.q.trim().toLowerCase();
  let rows, note = '';
  if (q) { rows = pool.filter(p => searchHit(p, q)).slice(0, 40); if (!rows.length) note = 'לא נמצא. אפשר ＋ מקום חדש למטה.'; }
  else if (a.tab === 'fav') { rows = favs; if (!rows.length) note = 'כל המועדפים כבר בתוכנית (או שאין עדיין מועדפים ביעד של היום).'; }
  else { const dd0 = dayByKey(a.day), lodT = tripLodging().find(l => l.checkIn <= dd0.date && dd0.date < l.checkOut), hotelId = lodT ? lodT.placeId : null; // tonight's hotel is the 🏨 line, not a suggestion
    const withD = pool.filter(p => p.id !== hotelId && !isInDay(a.day, p.id) && !schedEntries(p.id).some(e => e.day === a.day)).map(p => ({ p, km: dist(p) })).filter(x => x.km != null).sort((x, y) => x.km - y.km);
    rows = withD.slice(0, 30).map(x => x.p); const fromC = refs.length && refs[0].center;
    note = !rows.length ? (a.geoTxt ? '' : 'אין עדיין מקומות עם מיקום ידוע ביעד של היום.') : fromC ? 'לפי המרחק ממרכז היעד (עוד אין מקומות ביום הזה).' : 'לפי המרחק מהמקומות של היום ומהלינה.';
    const missing = pool.filter(p => !p.manualCoord && !(p.address in GEOCODE_CACHE)); // places found by address: located in the background, the list fills in
    if (missing.length && !a.geo) { a.geo = true; let k = 0; const again = () => { if (_addPl === a && a.tab === 'near' && !a.q && document.getElementById('apList')) drawAddPlace(); };
      ensureGeocoded(missing, (dn, tot) => { a.geoTxt = svcLine('apGeo', 'geocode', dn, tot, null, { gaveUp: svcGaveUpCount('geocode') }); if (++k % 3 === 0 || dn === tot) again(); }).then(() => { a.geoTxt = svcLine('apGeo', 'geocode', missing.filter(p => p.address in GEOCODE_CACHE).length, missing.length, null, { gaveUp: svcGaveUpCount('geocode') }); again(); }); }
  }
  tabs.innerHTML = q ? `<span class="ap-count">${rows.length} תוצאות</span>` : `<button type="button" data-act="addPlace.tab" data-aptab="fav" aria-pressed="${a.tab === 'fav'}">${msi('star', { size: 18 })} מועדפים${favs.length ? SEP + favs.length : ''}</button><button type="button" data-act="addPlace.tab" data-aptab="near" aria-pressed="${a.tab === 'near'}">${msi('near_me', { size: 18 })} קרובים ליום</button>`;
  box.innerHTML = (a.tab === 'near' && !q && a.geoTxt ? a.geoTxt : '') + (note ? `<p class="sh-hint">${note}</p>` : '') + rows.map(p => { // 7.1.0: the one status line, then the note
    const here = isInDay(a.day, p.id) || schedEntries(p.id).some(e => e.day === a.day), other = !here && inPlan(p), km = dist(p);
    const sub = [km != null && !(refs[0] || {}).center ? fmtKm(km) : '', other ? msi('calendar_month', { cls: 'msi-in' }) + ' ' + esc(other.label) : '', !other && !here && parkedHas(p.id) ? msi('chair', { cls: 'msi-in' }) + ' ביום שמחוץ לטיול' : '', STATE.favorites.has(p.id) ? msi('star', { cls: 'msi-in' }) : ''].filter(Boolean).join(SEP);
    const it = itemOf(p.id); if (!it) return ''; // 5.3.0: the mini card as a pick row - one button instead of the block
    return miniCardHTML(it, { openAct: 'addPlace.open', pick: here ? `<span class="ap-in">${msi('check', { size: 16 })} ביום</span>` : `<button type="button" class="ap-add" data-act="addPlace.add" aria-label="${other ? 'הוספה ליום עוד פעם' : 'הוספה ליום'}" title="${other ? 'הוספה ליום עוד פעם' : 'הוספה ליום'}">${msi(other ? 'library_add' : 'add', { size: 20 })}</button>`, extra: sub }); /* final-review-fixes: sub is markup (line icons); its one data part, the day's label, is escaped above */ }).join('');
  if (q) markSearch(box, a.q);
}
act('addPlace.new', () => { const a = _addPl; openPlaceEditor({ afterSave: { day: a.day, slot: a.slot } }); });
act('addPlace.tab', c => { _addPl.tab = c.el.dataset.aptab; drawAddPlace(); return 'quiet'; });
act('addPlace.add', c => { const a = _addPl, x = c.ref && c.ref.obj, p = x && x.place; if (!p) return; addPlaceToDay(a.day, a.slot, p); drawAddPlace(); return 'screen'; });
act('addPlace.open', c => { const a = _addPl, x = c.ref && c.ref.obj, p = x && x.place; if (p) { _sheetReturn = () => openAddPlaceSheetKeep(a); openPlaceSheet(p); } }); // 5.3.0
function openAddPlaceSheetKeep(a) { openAddPlaceSheet(a.day, a.slot); _addPl.tab = a.tab; _addPl.q = a.q; const q = document.getElementById('apQ'); if (q) { q.value = a.q; document.getElementById('apQX').hidden = !a.q; } drawAddPlace(); }

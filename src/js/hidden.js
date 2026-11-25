// ================= HIDDEN (8.1.0 - cl-undo-impl-plan stages 1-3, decisions ב1-ב6) =================
// Mechanism map: "המוסתרים". The one list of everything hidden in the shown destinations: places with a reason (status - not
// interesting / closed / does not exist, with its note), hidden layers (their places come back with them), and the active trip's
// own hidden places (td.hidden - 👎 from a past trip). The screen, the count at the end of the places list and every way back read
// it; nothing hidden is shown in a list or on a map, and it comes back only from here (guard test t840).
function hiddenGroups() { // phone-round-2b-fixes P7 (G55, 11.23.2): one rule - every hidden place of the trip, whatever its origin and whatever the destinations filter shows
  const dests = hasTrip() ? tripDests(activeTripObj()) : [], out = [];
  const lh = l => layerDef(l).hidden, gone = p => isGoneStatus(p.status) && !lh(p.layer) && !TRIP_HIDDEN.has(p.id);
  dests.forEach(d => {
    const places = POINTS.filter(p => p.dest === d && gone(p));
    const layers = LAYER_DEFS.filter(l => l.dest === d && l.hidden);
    const D = DESTS[d] || {}, mv = id => (STATE.edits.status[id] || {}).s === 'moved' && (STATE.edits.status[id] || {}).hotel; // 9.3.0 (ס11)
    const moved = (D.places || []).map(p => ({ ...p, id: (D.idBase || 0) + p.id, layer: (D.idBase || 0) + p.layer, dest: d })).filter(p => mv(p.id));
    if (places.length || layers.length || moved.length) out.push({ kind: 'dest', dest: d, places, layers, moved });
  });
  const own = POINTS.filter(p => !dests.includes(p.dest) && gone(p)); // a trip-only place of no trip destination (a trip with none yet)
  if (own.length) out.push({ kind: 'dest', dest: null, places: own, layers: [], moved: [] });
  const trip = POINTS.filter(p => TRIP_HIDDEN.has(p.id) && !lh(p.layer));
  if (trip.length) out.push({ kind: 'trip', places: trip, layers: [] });
  return out;
}
function hiddenCount() { return hiddenGroups().reduce((n, g) => n + g.places.length + g.layers.length + (g.moved || []).length, 0); }
function hiddenMovedRow(p) { const st = STATE.edits.status[p.id] || {}, t = STATE.trips[st.trip], L = layerDef(p.layer);
  return `<div class="card hid-card"><div class="card-top"><div><h3><span class="dd-dot" style="background:${L.color || 'var(--outline-variant)'}"></span>${msi('hotel', { size: 18, cls: 'msi-in' })} ${escH(p.name)}</h3><div class="sub">${msi('luggage', { size: 16, cls: 'msi-in' })} עבר לטיול ${t ? escH(String(t.name).split(' · ')[0]) : ''} - מלון תמיד שייך לטיול</div></div></div></div>`; }
function hiddenPlaceRow(p, trip) { const L = layerDef(p.layer), why = isGoneStatus(p.status) ? `<span class="badge st-why">${statusHTML(p.status, { size: 16 })}</span>` : '';
  return `<div class="card hid-card"><div class="card-top"><div><h3><span class="dd-dot" style="background:${L.color || 'var(--outline-variant)'}"></span>${msiTie(typeIcon(p.icon || L.icon, { size: 18, cls: 'msi-in' }), escH(p.name))}</h3>
    <div class="sub">${trip ? `<span class="badge st-why">${msi('thumb_down', { size: 16 })}מטיול קודם</span> ` : ''}${why}${p.statusNote ? escH(p.statusNote) : ''}</div></div></div>
    <div class="brow card-actions"><button class="btn-nav" data-act="hidden.back" data-v="p:${escH(p.id)}">${msi('visibility', { size: 18 })} החזרה</button></div></div>`; }
function hiddenLayerRow(l) { const n = POINTS.filter(p => p.layer === l.id).length;
  return `<div class="card hid-card"><div class="card-top"><div><h3><span class="dd-dot" style="background:${l.color}"></span>שכבה: ${escH(l.name)}</h3><div class="sub">${n} מקומות</div></div></div>
    <div class="brow card-actions"><button class="btn-nav" data-act="hidden.back" data-v="l:${l.id}">${msi('visibility', { size: 18 })} החזרה</button></div></div>`; }
function renderHiddenScreen() {
  const G = hiddenGroups(), t = hasTrip() ? activeTripObj() : null;
  document.getElementById('main').innerHTML = `<div class="section-head"><h2>${SY.hide} מוסתרים</h2><p>מקומות ושכבות שלא מוצגים ברשימות ובמפה. "החזרה" מציגה אותם שוב.</p></div>`
    + (G.length ? G.map(g => g.kind === 'trip'
      ? `<h3 class="lyr-h">${msi('luggage', { cls: 'msi-in' })} רק בטיול ${t ? escH(t.name) : ''}</h3>${g.places.length > 1 ? `<button type="button" class="sh-secondary hid-all" data-act="hidden.backTrip">${msi('visibility', { size: 18 })} החזרת כולם (${g.places.length})</button>` : ''}${g.places.map(p => hiddenPlaceRow(p, true)).join('')}`
      : `<h3 class="lyr-h">${g.dest ? escH(withFlag(destFlag(g.dest), destName(g.dest))) : `${msi('luggage', { cls: 'msi-in' })} מקומות של הטיול, בלי יעד`}</h3>${g.layers.map(hiddenLayerRow).join('')}${g.places.map(p => hiddenPlaceRow(p)).join('')}${(g.moved || []).map(hiddenMovedRow).join('')}`).join('')
      : emptyHTML(msi('visibility_off'), 'מה שמסתירים יופיע כאן, עם הדרך להחזיר אותו.', '', 'אין מוסתרים'));
}
// a place comes back: its reason leaves (or "פתוח שוב" over a reason that came in the destination's file), and the trip's own hiding
function placeUnhide(p, td) { const who = STATE.settings.deviceName || '';
  if (td.hidden && td.hidden.includes(p.id)) td.hidden = td.hidden.filter(x => x !== p.id);
  if (!isGoneStatus(p.status)) return;
  if (p.tripOnly) { const t = activeTripObj(); t.places = (t.places || []).map(x => { if (x.id !== p.id) return x; const y = { ...x }; delete y.status; delete y.statusNote; return y; }); return; }
  const base = BASE_PLACES.find(b => b.id === p.id);
  if (base && isGoneStatus(base.status)) STATE.edits.status[p.id] = { s: 'active', at: Date.now(), who }; else delete STATE.edits.status[p.id];
}
function hiddenPlacesBack(ids) { const ps = ids.map(id => POINTS.find(q => q.id === id)).filter(Boolean); if (!ps.length || !hasTrip()) return;
  const tid = STATE.activeTrip, td = tdOf(tid);
  ps.forEach(p => placeUnhide(p, td)); if (td.hidden && !td.hidden.length) delete td.hidden;
  tdSave(tid); applyActiveTrip(); persist();
  showUndoToast(ps.length === 1 ? 'הוחזר: ' + ps[0].name : `הוחזרו ${ps.length} מקומות`);
}
// a hidden layer comes back: the same edit the layer editor's toggle writes
function layerSetHidden(l, on) { const d = DESTS[l.dest], who = STATE.settings.deviceName || '', e = STATE.edits.layers[l.id];
  if (e && e.op === 'add') { STATE.edits.layers[l.id] = { ...e, data: { ...e.data, hidden: on }, at: Date.now(), who }; return; }
  const base = (d ? destLayers(d) : []).find(x => x.id === l.id) || {}, diff = { ...((e && e.op === 'edit' && e.data) || {}) };
  if (on === !!base.hidden) delete diff.hidden; else diff.hidden = on;
  if (Object.keys(diff).length) STATE.edits.layers[l.id] = { op: 'edit', data: diff, at: Date.now(), who }; else delete STATE.edits.layers[l.id]; }
act('hidden.back', c => { const [k, ...r] = String(c.v).split(':'), id = pid(r.join(':'));
  if (k === 'l') { const l = LAYER_DEFS.find(x => x.id === id); if (!l) return; layerSetHidden(l, false); refreshLayers(); persist();
    showUndoToast('הוחזרה השכבה: ' + l.name); return; }
  hiddenPlacesBack([id]); });
act('hidden.backTrip', () => { const g = hiddenGroups().find(x => x.kind === 'trip'); if (g) hiddenPlacesBack(g.places.map(p => p.id)); });

// ================= 10.2.0 (design-2): THE CARD - one card language for every card (look.md "Cards") =================
// The places list, the plan, hotels, the map's floating card, pick rows and read-only cards are built of the same parts:
// row 1 - the leading circle (a place: the layer's tint with its type icon; a travel: its mode in violet; a note or a group
// item with no place: grey with its kind), with the day map's order number on its corner (plan only - the pin carries the
// same badge), the name, and "היינו" at the top left (from the trip's first day); row 2 - the tags (the plan's time chip
// first, "קבוצתי", the layer · price · ratings, then the marks; the list's schedule chip after them); row 3 - the description
// (list); row 4 - the actions as icons in fixed places per screen (list: map · navigate · Google · star; map: measure from
// here · navigate · Google · star; plan: navigate · Google · star, and remove from the plan alone at the far left end).
// A tap on the card opens its window; a long press on an icon names it (lpName).
const TRAVEL_MS = { flight: 'flight', train: 'train', bus: 'directions_bus', car: 'directions_car', ferry: 'directions_boat' };
const SCHED_MS = { tour: 'tour', walk: 'directions_walk', meal: 'restaurant', free: 'self_improvement', transfer: 'airport_shuttle', flight: 'flight', hotel: 'hotel', activity: 'local_activity', show: 'theater_comedy' };
const actIc = n => msi(n, { size: 22 }), tagIc = n => msi(n, { size: 16 });
// phone-round-1-followups (11.16.0; decisions 2026-11-15 · Review of the 11.14.0 summary, Q6): the order number's ink is chosen by
// contrast with its badge, light and dark. The badge is the layer's tone (tokens: light 62% of the colour into black, dark 45% into
// white - --tone-mix / --tone-ink); the theme's ink (--on-badge: white in light, #111318 in dark) stays when it reaches 4.5:1, else the
// other side (#111318, or black when even that falls short; white). Both inks ride on the element as --num-ink-l / --num-ink-d, so a
// theme change needs no redraw (cards.css picks one).
const NUM_TONE = { l: [0.62, 0], d: [0.45, 255] }, _numInk = {};
let _inkCtx = null;
function _rgbOf(c) { const x = _inkCtx || (_inkCtx = document.createElement('canvas').getContext('2d')); x.fillStyle = '#010203'; x.fillStyle = String(c); const v = x.fillStyle;
  if (v === '#010203' && String(c).trim().toLowerCase() !== '#010203') return null; // not a colour
  const m = v.match(/^#([0-9a-f]{6})$/i); if (m) return [0, 2, 4].map(i => parseInt(m[1].substr(i, 2), 16));
  const r = v.match(/rgba?\(([^)]+)\)/); return r ? r[1].split(',').slice(0, 3).map(Number) : null; }
function _lumOf(rgb) { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]); }
function contrastOf(a, b) { const x = _lumOf(a), y = _lumOf(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
function numInk(color, mode) { // the number's ink on the badge of `color` in mode 'l' or 'd'
  const k = color + '|' + mode; if (k in _numInk) return _numInk[k];
  const rgb = _rgbOf(color); if (!rgb) return (_numInk[k] = '');
  const [w, to] = NUM_TONE[mode], fill = rgb.map(v => Math.round(v * w + to * (1 - w)));
  const W = [255, 255, 255], D = [17, 19, 24], B = [0, 0, 0], own = mode === 'l' ? W : D, order = mode === 'l' ? [W, D, B] : [D, W, B];
  const ink = order.find(c => contrastOf(fill, c) >= 4.5) || order.reduce((a, c) => contrastOf(fill, c) > contrastOf(fill, a) ? c : a);
  return (_numInk[k] = ink === own ? '' : '#' + ink.map(v => v.toString(16).padStart(2, '0')).join('')); }
function numInkStyle(color) { if (!color) return ''; const l = numInk(color, 'l'), d = numInk(color, 'd'); return (l ? `;--num-ink-l:${l}` : '') + (d ? `;--num-ink-d:${d}` : ''); }
function leadHTML(kind, icon, color, n) {
  return `<span class="cd-lead ${kind}"${color ? ` style="--lc:${color}${n ? numInkStyle(color) : ''}"` : ''}>${icon}${n ? `<span class="cd-num" title="המספר במפת היום">${n}</span>` : ''}</span>`; }
function itemLead(it, n) {
  if (it.kind === 'travel') return leadHTML('travel', msi(TRAVEL_MS[(it.travel || {}).mode] || 'flight', { size: 18 }), '', n);
  if (it.place) return leadHTML('place', it.hotel && !it.sched ? msi('hotel', { size: 18 }) : typeIcon(it.place.icon, { size: 18 }), it.place.color, n);
  return leadHTML('grey', msi(it.sched ? SCHED_MS[it.sched.kind] || 'event' : 'sticky_note_2', { size: 18 }), '', n);
}
function planLead(p, n) { // a plan item: a place (or its copy), a note, a travel
  if (isTravelItem(p)) return leadHTML('travel', msi(TRAVEL_MS[p.travel] || 'flight', { size: 18 }), '', n);
  if (isNote(p)) return leadHTML('grey', msi('sticky_note_2', { size: 18 }), '', n);
  return leadHTML('place', typeIcon(p.icon, { size: 18 }), p.color, n);
}
const cdMeta = bits => { bits = bits.filter(Boolean); return bits.length ? `<span class="cd-mt">${bits.join(SEP)}</span>` : ''; };
const grpTag = () => `<span class="tl-tag grp">${tagIc('groups')}קבוצתי</span>`;
const keyTag = () => `<span class="tl-tag key sym-tip" data-act="tip" data-v="sym.key">${msi('workspace_premium', { size: 16, fill: 1 })}מפתח</span>`;
// cdCard - the card's frame: o.cls, o.attrs (the card's), o.body (the body's), o.lead, o.name (html), o.tags (html list), o.desc, o.vis, o.acts
// diet-mechanism: a card's change while a screen of a group draws the plan's own cards (the proposal's preview sets propCard, then null) -
// kept on cdCard itself, set only through cardViewSet
function cardViewSet(f) { cdCard.view = f; }
function cdCard(o) {
  if (cdCard.view) o = cdCard.view(o); // 11.5.0 (schedule-proposal): the proposal's preview draws the plan's own cards read-only, with its tags (diet-mechanism: the preview, in the AI group, sets cdCard.view while it draws)
  const tags = (o.tags || []).filter(Boolean).join('');
  return `<div class="card tl-card cd${o.cls ? ' ' + o.cls : ''}"${o.attrs || ''}><div class="tl-body"${o.body || ''}><div class="cd-name">${o.lead}<b dir="auto">${o.name}</b></div>${tags ? `<small class="cd-tags">${tags}</small>` : ''}${o.desc || ''}</div>${o.vis || ''}${o.acts || ''}</div>`;
}
// the tags of a mini card (row 2): "קבוצתי", the kind or layer · price · ratings (· the distance while measuring), the marks
function mcTags(it, o) {
  const esc = escH, p = it.place, meta = [], t = [];
  if (it.sched) t.push(grpTag());
  if (it.kind === 'travel') meta.push(TX.travel); else if (it.kind === 'note') meta.push(it.sched ? '' : TX.note); else if (p) meta.push(esc(it.hotel ? TX.lodging : layerTagLabel(p.layer)));
  if (p) meta.push(...placeMeta(p, () => true, pastMiniRecHTML));
  if (o.extra) meta.push(`<b class="cd-dist">${o.extra}</b>`);
  t.push(cdMeta(meta));
  if (p) t.push(...placeMarks(p), bpNoteTag(p)); // 11.42.0 (Q4 addition 1): the price's note - one line with "…" on the card
  return t;
}
// the scheduling chip (list and map): when it is in the plan, or "לשבץ"; a hotel - its stay; a tap opens the scheduling window
function mcSchedLineHTML(it) {
  const esc = escH;
  if (it.hotel && it.lodging[0]) { const l = it.lodging[0], S = stayOf(l);
    // value-no-cut (Q3): the line wraps between its parts (a flex row), each part a box that carries its own " ·" at its end - so a " · "
    // never opens the next line ("· לילה אחד" did, at "ענק", 360)
    const parts = [S.now ? 'הלילה' : '', tmFmt('range', [l.checkIn, l.checkOut]), S.nights ? S.nights.slice(SEP.length) : ''].filter(Boolean);
    return `<span class="mc-when${S.now ? ' today' : ''}">${tagIc('hotel')}${parts.map((x, i) => `<span>${x}${i < parts.length - 1 ? SEP : ''}</span>`).join('')}</span>`; }
  if (!TRIP_DAYS.length || !hasTrip() || it.kind === 'travel') return '';
  const ro = !!activeTripObj().archived || !!ARCHIVE_VIEW, list = iwInstances(it), inst = iwPickInstance(list, null);
  if (!inst) return ro ? '' : `<button type="button" class="mc-when add" data-act="item.sched">${tagIc('calendar_add_on')}לשבץ</button>`;
  const w = iwWhen(inst, 'dayN'), txt = `${tagIc(w.today ? 'today' : 'calendar_month')}${esc(w.text)}${moreDays(list)}`;
  return ro ? `<span class="mc-when${w.today ? ' today' : ''}">${txt}</span>` : `<button type="button" class="mc-when${w.today ? ' today' : ''}" data-act="item.sched">${txt}</button>`;
}
// the actions row: scr = the screen's own button's html (or ''), the rest by the item
function mcActsHTML(it, scr) {
  return placeLinksRow(scr || '', it.place, () => activeTripObj().archived || ARCHIVE_VIEW);
}
// the card itself. o: { screen: 'list' | 'map' | 'hotels', host (map id), ctx, pick: html of the one button of a pick row, desc, extra }
function miniCardHTML(it, o) {
  o = o || {}; const esc = escH, p = it.place, vis = !!p && STATE.visited.has(p.id);
  const scr = o.pick ? '' : o.screen === 'list' && p && MAP_AVAILABLE && (routeCoordOf(p) || p.address) ? `<button type="button" class="tl-act a-scr" data-act="item.map" aria-label="במפה" title="במפה">${actIc('map')}</button>`
    : o.screen === 'map' && p && o.host ? `<button type="button" class="tl-act a-scr" data-act="map.measureFrom" data-v="${o.host}" aria-label="מדידה מכאן" title="מדידה מכאן">${actIc('track_changes')}</button>` : '';
  const name = esc(it.kind === 'travel' && it.travel ? (TRAVEL_MODES[it.travel.mode] || TRAVEL_MODES.flight)[1] + ' ל' + it.travel.to : it.name);
  return cdCard({ cls: `mc-card g-swipe${vis ? ' tl-visited' : ''}${o.pick ? ' mc-pick' : ''}${p ? '' : ' mc-noplace'}`, attrs: ` data-ref="item:${esc(String(it.ref))}"`,
    body: o.screen === 'map' ? ' data-act="float.details"' : ` data-act="${o.openAct || 'item.open'}"`, lead: itemLead(it), name,
    tags: [...mcTags(it, o), o.pick ? '' : mcSchedLineHTML(it)],
    desc: o.desc && p && p.description ? `<span class="mc-desc">${esc(p.description)}</span>` : '',
    vis: p && !o.pick ? visBtnHTML(p.id, vis) : '', acts: o.pick ? `<div class="mc-pickbtn">${o.pick}</div>` : mcActsHTML(it, scr) });
}
// 6.1.0: the mini card's buttons are actions (item.open, item.sched, place.fav, place.visit, item.map, place.booking)
act('item.open', c => { if (c.ref && c.ref.obj) openItemWin(c.ref.obj.ref, {}); });
act('item.sched', c => { const x = c.ref && c.ref.obj; if (!x) return; if (x.sched) openOneSchedSheet('s:' + x.sched.id); else if (x.kind === 'note') openOneSchedSheet(String(x.ref)); else if (x.place) openScheduleSheet(x.copy && x.note ? x.note.ref : x.place.id); });
act('place.fav', c => { const x = c.ref && c.ref.obj, p = x && (x.place || x); if (p && p.id != null) toggleFavorite(Number(p.id)); });
function visitIdOf(el) { const r = refOf(el), x = r && r.obj, p = x && (x.visitId != null ? { id: x.visitId } : x.place || x); return p && p.id != null ? p.id : null; }
act('place.visit', c => { const p = { id: visitIdOf(c.el) }; if (p.id == null) return; buzz('confirm'); toggleVisited(pid(p.id)); });
act('item.map', c => { const x = c.ref && c.ref.obj; if (x) openItemMap(x, (layerTop() && layerTop().ctx) || {}); });
act('place.booking', c => { const x = c.ref && c.ref.obj, p = x && (x.place || x); const q = p && POINTS.find(y => String(y.id) === String(p.id)); if (q) openBookingSheet(q); });
act('lodging.go', c => goLodgingCard(c.v));
act('map.measureFrom', c => { const x = c.ref && c.ref.obj, p = x && (x.place || x); if (c.el.closest('.map-float')) closeFloatCard(c.v); measFromPlace(c.v, p); });
function pinDivIcon(p, opts) { // 10.2.0 (design-2): the place's type icon; a numbered pin (the day map) is a circle with the card's order badge on its top-left corner
  // off-map-areas (11.47.0): `round` - the same circle with only its number inside (an offline area too small to draw), `cls` its own classes
  opts = opts || {};
  const cls = 'pin-marker' + (opts.numbered || opts.round ? ' numbered' : '') + (opts.unassigned ? ' unassigned' : '') + (opts.cls ? ' ' + opts.cls : '');
  const icon = opts.round ? '' : p && p.travel ? msi(TRAVEL_MS[p.travel] || 'flight', { size: 16 }) : typeIcon(p && p.icon, { size: 16 });
  const content = opts.round ? `<span>${opts.number}</span>` : opts.numbered ? `<span>${icon}</span><b class="pin-num">${opts.number}</b>` : `<span>${opts.number != null ? opts.number : icon}</span>`;
  return L.divIcon({
    className: '', html: `<div class="${cls}" style="background:${p.color};--lc:${p.color}${opts.numbered ? numInkStyle(p.color) : ''}">${content}</div>`,
    iconSize: [30,30], iconAnchor: opts.numbered || opts.round ? [15,15] : [15,30], popupAnchor: [0,-28],
  });
}
function selfLocationIcon() {
  return L.divIcon({
    className: '', html: `<div class="self-loc-dot"><div class="self-loc-pulse"></div></div>`,
    iconSize: [22,22], iconAnchor: [11,11],
  });
}
const _mapSelfMarkers = new WeakMap();
// 4.20.0: the blue dot is placed by itself when a map opens and then kept fresh every few minutes (⚙️ ← 🎛️ ← ◎);
// the map moves to it only by ◎. "רק בלחיצה על ◎" asks for the location only when ◎ is pressed.
let _selfAt = 0;
function selfLocMin() { const v = prefs().selfLoc; return v === 'off' ? 0 : (+v || 1); }
function placeSelf() { if (!userPos) return; LIVE_MAPS.forEach(m => { const c = m.getContainer && m.getContainer(); if (!c || !c.isConnected || m._removed) return;
  let mk = _mapSelfMarkers.get(m); if (mk) mk.setLatLng([userPos.lat, userPos.lng]); else { mk = L.marker([userPos.lat, userPos.lng], { icon: selfLocationIcon(), zIndexOffset: 1000 }).addTo(m); _mapSelfMarkers.set(m, mk); } }); measFollowMe(); }
async function refreshSelfLoc() { const pos = await requestUserLocation(); if (pos) { _selfAt = Date.now(); placeSelf(); } return pos; }
setInterval(() => { const min = selfLocMin(); if (!min || document.hidden || Date.now() - _selfAt < min * 6e4) return;
  if ([...LIVE_MAPS].some(m => { const c = m.getContainer && m.getContainer(); return c && c.isConnected && !m._removed; })) refreshSelfLoc(); }, 20000);
async function addSelfLocationMarker(map, { center } = {}) {
  if (!center && !selfLocMin()) return false;
  const fresh = !center && userPos && Date.now() - _selfAt < selfLocMin() * 6e4;
  const pos = fresh ? userPos : await requestUserLocation();
  if (!pos) return false; if (!fresh) _selfAt = Date.now();
  let marker = _mapSelfMarkers.get(map);
  if (marker) marker.setLatLng([pos.lat, pos.lng]);
  else {
    marker = L.marker([pos.lat, pos.lng], { icon: selfLocationIcon(), zIndexOffset: 1000 }).addTo(map);
    _mapSelfMarkers.set(map, marker);
  }
  if (center) map.setView([pos.lat, pos.lng], Math.max(map.getZoom(), 14));
  return true;
}
function locateMeButtonHTML(mapDivId) {
  return `<button class="locate-me-btn" data-act="map.locate" data-locate="${mapDivId}" title="הראה את המיקום שלי" aria-label="המיקום שלי">${msi('my_location')}</button>`; // 4.12.1: not 📍, which is also the default place pin
}
function locateBridge(mapDivId, map) {
  const btn = document.querySelector(`[data-locate="${mapDivId}"]`);
  if (!btn) return; btn._map = map; if (btn.closest('.leaflet-container')) mapCtl(btn);
}
act('map.locate', async c => { const btn = c.el, mapDivId = btn.dataset.locate, map = btn._map; if (!map) return;
  const back = btnBusy(btn); // final-review-fixes (finding 20): the line icon stays while it waits and after
  const ok = await addSelfLocationMarker(map, { center: true });
  back();
  if (ok && measActiveOn(mapDivId)) measAddMe(); // 4.31.0: "המיקום שלי" starts the measuring from me
  if (!ok) showToast('לא הצלחנו לקבל מיקום - בדוק שהאיתור פעיל במכשיר'); });

let _keepMapView = false;
const _mapState = {};
function rerenderKeepingMap() { _keepMapView = true; try { render(); } finally { _keepMapView = false; } }
function takeMapRestore(containerId) {
  const st = _mapState[containerId];
  if (_keepMapView && st && st.center) return st;
  _mapState[containerId] = {};
  return null;
}
function trackMapView(map, containerId) {
  map.on('moveend', () => {
    const st = _mapState[containerId] || (_mapState[containerId] = {});
    const c = map.getCenter(); st.center = [c.lat, c.lng]; st.zoom = map.getZoom();
  });
}
function showMapCard(containerId, cardContainerId, p) {
  const st = _mapState[containerId] || (_mapState[containerId] = {}); st.selectedId = p.id;
  const mk = MAPS[containerId] && MAPS[containerId].markers.get(String(p.id)); // 4.31.0
  const md = measActiveOn(containerId) && MEAS.mode === 'ref' && mk ? (l => `<span class="meas-d">${measFrom({ lat: l.lat, lng: l.lng })}</span>`)(mk._fanOrig || mk.getLatLng())
    : walkActiveOn(containerId) && mk ? (l => (w => w ? `<span class="meas-d">${w}</span>` : '')(walkFrom({ lat: l.lat, lng: l.lng })))(mk._fanOrig || mk.getLatLng()) : ''; // walk-time: its walk from the rings' point
  const it = itemOf(p.id); if (!it) return; const html = miniCardHTML(it, { screen: 'map', host: containerId, extra: md }); // 5.3.0: the same mini card, floating
  openFloatCard(containerId, html, null,
    () => { st.selectedId = null; markSelected(containerId, null); }, () => { _sheetFromMap = containerId; openPlaceSheet(p); });
  markSelected(containerId, p.id);
}
function applyMapRestore(map, restore, containerId, cardContainerId) {
  if (!restore) return;
  map.setView(restore.center, restore.zoom);
  const sp = restore.selectedId != null && planItem(restore.selectedId);
  if (sp) showMapCard(containerId, cardContainerId, sp, false);
}

// 4.3.0: which hotels stand out on the map (⚙️ הגדרות ← 🏨 הלינה במפה). Default: tonight's, plus last night's when it is
// another one (a move day). Before and after the trip every hotel of the trip. Other hotels stay ordinary lodging pins.
function hotelIds() { return tripLodging().map(l => l.placeId).filter(x => x != null); }
function hotelSettings() { const s = STATE.settings; return { which: s.hotelWhich || 'night2', size: s.hotelSize || 's', top: s.hotelTop !== false }; }
// 4.46.3: a map of certain days (a day in the plan, 🗓️ ימים) shows only the hotels of those days - where you wake up and
// where you sleep - not every hotel of the trip
function hotelMarks(dates) {
  const t = activeTripObj(), lod = tripLodging().filter(l => l.placeId != null), hs = hotelSettings();
  const iso = todayStr(), inTrip = !!(t.start && iso >= t.start && iso <= t.end);
  const night = d => lod.filter(l => l.checkIn && l.checkOut && l.checkIn <= d && d < l.checkOut).map(l => l.placeId);
  if (!dates && typeof FP.days !== 'undefined' && FP.days && typeof rangeDays === 'function') dates = rangeDays().map(k => (dayByKey(k) || {}).date).filter(Boolean);
  if (dates && dates.length) { const ids = [...new Set(dates.flatMap(d => night(d).concat(night(isoAdd(d, -1)))))];
    return ids.map(id => ({ id, size: hs.size, p: POINTS.find(q => q.id === id) })).filter(x => x.p && destShown(x.p.dest)); }
  let main = inTrip ? night(iso).concat(hs.which === 'night2' ? night(isoAdd(iso, -1)) : []) : lod.map(l => l.placeId);
  main = [...new Set(main)];
  const out = main.map(id => ({ id, size: hs.size }));
  if (inTrip && hs.which === 'all') [...new Set(lod.map(l => l.placeId))].forEach(id => { if (!main.includes(id)) out.push({ id, size: 's' }); });
  return out.map(x => ({ ...x, p: POINTS.find(q => q.id === x.id) })).filter(x => x.p && destShown(x.p.dest));
}
const HOTEL_PX = { s: 26, m: 34, l: 44 };
function hotelIcon(size) {
  const px = HOTEL_PX[size] || HOTEL_PX.s;
  return L.divIcon({ className: '', html: `<div class="hotel-marker hm-${size || 's'}">${msi('hotel')}</div>`, iconSize: [px, px], iconAnchor: [px / 2, px / 2] });
}
function addHotelMarker(map, bounds, containerId, dates) {
  const marks = hotelMarks(dates), top = hotelSettings().top;
  if (!marks.length) return Promise.resolve();
  return ensureGeocoded(marks.map(m => m.p), null, (p, coord) => {
    if (!coord) return; const m = marks.find(x => x.p === p) || marks[0];
    const marker = L.marker([coord.lat, coord.lng], { icon: hotelIcon(m.size), zIndexOffset: top ? 1500 : 0 }).addTo(map);
    marker.on('click', () => pinTap(containerId, p.id) || showMapCard(containerId, null, p));
    regMarker(containerId, p.id, marker);
    bounds.push([coord.lat, coord.lng]);
  });
}


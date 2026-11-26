// ================= 📥 MAPS WITHOUT NETWORK (4.39.0) =================
// diet-groups (11.62.0): downloading and the review window moved to js/offline-download.js (special-maps), the storage rows of the settings to js/storage-rows.js (management)
// The trip's areas are downloaded once, by choice, as vector tiles of OpenFreeMap (OpenMapTiles schema, up to zoom 14) and drawn
// under the usual tile layers when there is no network: where you already looked you see the normal map, everywhere else the
// downloaded one, with no holes. OpenFreeMap's terms and Zsolt's email (26.10.2026): the browser's Origin/Referer identifies us,
// no query parameters (they bypass the cache), at most 4 requests at once, and ONE download per trip of up to 3,000 tiles / 50MB -
// several downloads in a row count as one, so the budget is per trip and later updates come out of a reserve.
const OFF_CAP = { tiles: 3000, bytes: 50 * 1024 * 1024 }, OFF_RESERVE = 0.1;
const OFF_EST = (z, kind) => Math.round((z >= 14 ? 95 : z === 13 ? 70 : z === 12 ? 55 : z === 11 ? 42 : z === 10 ? 34 : 26) * 1024 * (kind === 'line' ? 0.5 : 1)); // ≈ bytes per tile
const OFF_KEYS = new Map(); // 'z/x/y' -> [tripIds] (what is stored on this device)
let OFF_PACKS = {}, OFF_RUN = null, OFF_PLAN_MEMO = { sig: '', plan: null };
const OFF_DEC = new Map(); // decoded tiles in memory (the last 40)
async function offInit() {
  const db = await offDB(); if (!db) return;
  await offScanTiles(false, c => OFF_KEYS.set(c.key, (c.value && c.value.t) || []), list => { OFF_PACKS = {}; list.forEach(p => { if (p && p.trip) OFF_PACKS[p.trip] = p; }); });
  offRefreshMaps();
  const p = OFF_PACKS[STATE.activeTrip]; if (p && (p.status === 'running' || p.status === 'paused') && svcOnline()) setTimeout(() => offResume(p.trip), 4000);
}
function offPackSave(p) { OFF_PACKS[p.trip] = p; return offTx('packs', 'readwrite', st => st.put(p, p.trip)).catch(() => {}); }
const offMB = b => b >= 1073741824 ? (b / 1073741824).toFixed(1) + 'GB' : b > 0 && b < 104858 ? Math.max(1, Math.round(b / 1024)) + 'KB' : (b / 1048576 < 10 ? (b / 1048576).toFixed(1) : Math.round(b / 1048576)) + 'MB'; // storage (Q5): a device's space in GB, a small store in KB - never "0.0MB" for what is there
const offMBh = b => `<bdi dir="ltr">${offMB(b)}</bdi>`; // 4.46.3: in HTML lines with Hebrew around

// ---- what to download: areas around where you travel, and roads you drive yourself ----
function offTileXY(lat, lng, z) { const n = 2 ** z, la = Math.max(-85.05, Math.min(85.05, lat)), r = la * Math.PI / 180;
  return [Math.max(0, Math.min(n - 1, Math.floor((lng + 180) / 360 * n))), Math.max(0, Math.min(n - 1, Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n)))]; }
function offBoxTiles(bb, z) { const [s, w, n, e] = bb, [x0, y0] = offTileXY(n, w, z), [x1, y1] = offTileXY(s, e, z), out = [];
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) out.push(`${z}/${x}/${y}`); return out; }
function offLineTiles(path, z) { const out = new Set(), step = 360 / 2 ** z / 3;
  for (let i = 0; i < path.length; i++) { const a = path[i], b = path[i + 1] || a, n = Math.max(1, Math.ceil(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])) / step));
    for (let j = 0; j <= n; j++) { const t = j / n, [x, y] = offTileXY(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, z); out.add(`${z}/${x}/${y}`); } }
  return [...out]; }
function offPadBox(pts, padKm) { const la = pts.map(c => c.lat), ln = pts.map(c => c.lng), mid = (Math.min(...la) + Math.max(...la)) / 2, dLa = padKm / 111, dLn = padKm / (111 * Math.max(0.2, Math.cos(mid * Math.PI / 180)));
  return [Math.min(...la) - dLa, Math.min(...ln) - dLn, Math.max(...la) + dLa, Math.max(...ln) + dLn]; }
function offNearName(c) { let best = null, bd = 0.4; POINTS.forEach(p => { if (isHiddenPoint && isHiddenPoint(p)) return; const q = routeCoordOf(p); if (!q) return; const d = distanceKm(c, q); if (d < bd) { bd = d; best = p; } }); return best ? best.name : ''; }
function offAnchors() { // the places that decide the areas: the plan (days, the organized schedule), ⭐, ❤️ and the hotels
  const t = activeTripObj(), out = [], add = (c, w, name, hotel, key, title) => { if (c && isFinite(c.lat) && isFinite(c.lng)) out.push({ c: { lat: +c.lat, lng: +c.lng }, w, name: name || '', hotel: !!hotel, key: key || name || '', title: title || '' }); };
  tripLodging().forEach(l => { const p = l.placeId != null ? POINTS.find(q => q.id === l.placeId) : null, n = l.checkIn && l.checkOut ? Math.max(1, nightsBetween(l.checkIn, l.checkOut)) : 1;
    add(routeCoordOf(p), 3 * n, (p && regionName(p)) || l.name || (p && p.name), true, p ? 'p' + p.id : 'n' + (l.name || ''), (p && p.name) || l.name); }); // phone-round-2b-fixes P5: the row is titled by the hotel (its place's name, else the lodging's), the region's name under it // phone-round-2b-fixes P3 (G46): a hotel's area is keyed by the hotel itself, not its region's name (two hotels of one region shared one ✕)
  TRIP_DAYS.forEach(d => { try { dayRefCoords(d.key).forEach(c => { if (!c.center) add(c, 1); }); } catch (e) {} });
  const fav = STATE.favorites instanceof Set ? STATE.favorites : new Set(), rate = ((STATE.tripData[t.id] || {}).rating) || {};
  POINTS.forEach(p => { if (isHiddenPoint && isHiddenPoint(p)) return; if (fav.has(p.id) || (rate[p.id] || {}).r === 'love') add(routeCoordOf(p), 1, p.name); });
  if (!out.length) (t.segments || []).forEach(sg => { const m = DESTS[sg.dest] && DESTS[sg.dest].meta; if (m && m.center) add({ lat: m.center[0], lng: m.center[1] }, 2, m.name, true, 'dest' + sg.dest); });
  return out; }
function offClusters(anchors) { // single linkage at 3 km: a city's places become one area, a far place its own small "island"
  const n = anchors.length, par = anchors.map((a, i) => i), f = i => par[i] === i ? i : (par[i] = f(par[i]));
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (distanceKm(anchors[i].c, anchors[j].c) < 3) par[f(i)] = f(j);
  const g = new Map(); anchors.forEach((a, i) => { const k = f(i); if (!g.has(k)) g.set(k, []); g.get(k).push(a); });
  return [...g.values()]; }
// off-frame (decisions 2026-11-23 · Offline maps - an area framed, Q3, Q4): alt - the editor's candidate { bb, hide (the id of the area being
// edited, left out), xid (a user area being edited) }; the plan then counts the candidate in its place (offPlan(id, alt), never kept)
function offPlanItems(alt) {
  const t = activeTripObj(), om = (STATE.tripData[t.id] || {}).offmap || {}, over = om.over || {}, items = [], anchors = offAnchors();
  offClusters(anchors).forEach(cl => { const pts = cl.map(a => a.c), w = cl.reduce((s, a) => s + a.w, 0), hotel = cl.filter(a => a.hotel).sort((a, b) => b.w - a.w)[0];
    const span = distanceKm({ lat: Math.min(...pts.map(c => c.lat)), lng: Math.min(...pts.map(c => c.lng)) }, { lat: Math.max(...pts.map(c => c.lat)), lng: Math.max(...pts.map(c => c.lng)) });
    const city = !!hotel || cl.length >= 4, c0 = pts[0], mid = { lat: pts.reduce((s, c) => s + c.lat, 0) / pts.length, lng: pts.reduce((s, c) => s + c.lng, 0) / pts.length };
    const raw = hotel ? 'a:' + hotel.key : (city ? 'a:' : 'i:') + mid.lat.toFixed(2) + ',' + mid.lng.toFixed(2), id = idFix(raw, null, 'key'), old = hotel ? idFix('a:' + hotel.name, null, 'key') : null; // stable, so ✕ / ＋ stay on the same area; 11.21.6 (P5): stored in offmap.over, so of the file form as the door converts it
    const sub = hotel && hotel.title && hotel.name && hotel.name !== hotel.title ? hotel.name : '';
    items.push({ id, raw, old, kind: city ? 'city' : 'island', hotel: !!hotel, sub, label: (hotel && (hotel.title || hotel.name)) || cl.find(a => a.name) && cl.find(a => a.name).name || offNearName(c0) || 'אזור', w,
      bb: offPadBox(pts, city ? Math.max(1.5, span * 0.1) : 1), zMax: 14, zMin: 12, zLow: 8, line: false }); });
  const islands = items.filter(x => x.kind === 'island'), hotels = anchors.filter(a => a.hotel);
  try { const vs = routeVisits(), legs = routeLegs(vs);
    legs.forEach(l => { if (!l.a.coord || !l.b.coord || l.mode === 'flight' || l.mode === 'none') return; const f = l.travels.find(x => x.path && x.path.length > 1) || l.travels[0] || {};
      const path = f.path && f.path.length > 1 ? f.path : ((roadPathGet(l.a.coord, l.b.coord) || {}).path || [[l.a.coord.lat, l.a.coord.lng], [l.b.coord.lat, l.b.coord.lng]]), drive = l.mode === 'car';
      items.push({ id: 'l:' + l.i + ':' + l.mode, kind: drive ? 'drive' : 'transit', label: `${l.a.name} ← ${l.b.name}`, w: drive ? 3 : 0, path, zMax: drive ? 13 : 10, zMin: drive ? 10 : 8, zLow: 6, line: true }); });
  } catch (e) {}
  if (t.legMain === 'car') islands.forEach(is => { const c = { lat: (is.bb[0] + is.bb[2]) / 2, lng: (is.bb[1] + is.bb[3]) / 2 }; let h = null, hd = 1e9; hotels.forEach(a => { const d = distanceKm(a.c, c); if (d < hd) { hd = d; h = a; } });
    if (h && hd > 15) { const p = (roadPathGet(h.c, c) || {}).path || [[h.c.lat, h.c.lng], [c.lat, c.lng]];
      items.push({ id: 'd:' + is.id, raw: 'd:' + is.raw, kind: 'drive', label: `${h.name || 'הלינה'} ← ${is.label}`, w: 2, path: p, zMax: 13, zMin: 10, zLow: 6, line: true }); } });
  const ex = (om.extra || []).filter(x => !(alt && alt.xid === x.id)).concat(alt ? [{ id: alt.xid || 'new', bb: alt.bb, cand: true }] : []);
  ex.forEach(x => items.push({ id: 'x:' + x.id, xid: x.id, kind: 'user', label: x.label || 'אזור שהוספתי', from: x.from || '', cand: !!x.cand, w: 99, bb: x.bb, zMax: 14, zMin: 12, zLow: 8, line: false }));
  // off-frame (Q4): a computed area the user changed is hidden under its key (offmap.over 'x' - the user's own area, offmap.extra with `from`,
  // stands in its place and changes of the trip never touch it); a computed area that a user area covers almost wholly is not shown
  for (let i = items.length - 1; i >= 0; i--) { const x = items[i]; if (x.kind === 'user' || x.line) continue;
    if ((alt && alt.hide === x.id) || (over[x.id] || (x.old && over[x.old])) === 'x' || ex.some(e => offCover(e.bb, x.bb) >= OFF_COVER)) items.splice(i, 1); }
  // the zoomed-out view around each area (zoom 3-7, about 150 km around it), so the map isn't empty when you zoom out
  const boxes = items.filter(x => x.bb).map(x => { const m = [(x.bb[0] + x.bb[2]) / 2, (x.bb[1] + x.bb[3]) / 2]; return [m[0] - 1.4, m[1] - 1.8, m[0] + 1.4, m[1] + 1.8]; });
  if (boxes.length) items.unshift({ id: 'ctx', kind: 'ctx', label: 'המבט הכללי', w: 1e9, boxes, zMax: 7, zMin: 7, zLow: 3, line: false, fixed: true });
  items.forEach(x => { x.user = over[x.id] || (x.old && over[x.old]) || ''; }); // P3: a choice stored under a hotel area's older key (its region's name, 11.21.6 and before) carries to every hotel that had it, until changed
  return items; }
const OFF_TIER = { ctx: 0, user: 1, city: 1, drive: 1, island: 2, transit: 3 };
const OFF_COVER = 0.9; // off-frame (Q4): a computed area this much inside a user area (of its rectangle) is not shown
function offCover(u, a) { const w = Math.max(0, Math.min(u[3], a[3]) - Math.max(u[1], a[1])), h = Math.max(0, Math.min(u[2], a[2]) - Math.max(u[0], a[0])), A = (a[3] - a[1]) * (a[2] - a[0]);
  return A > 0 ? w * h / A : 0; }
function offItemTiles(x, z) { x._t = x._t || {}; if (x._t[z]) return x._t[z]; const out = new Set();
  for (let k = x.zLow; k <= z; k++) (x.line ? offLineTiles(x.path, k) : x.boxes ? x.boxes.flatMap(b => offBoxTiles(b, k)) : offBoxTiles(x.bb, k)).forEach(t => out.add(t)); return x._t[z] = [...out]; }
// off-prune (decisions 2026-11-23 · Offline maps - an area framed, resized and moved on the map, Q7 and its correction): the tiles the
// trip's plan needs - every area and line that is in, at the zoom the plan gives it (what offPlan would queue with nothing on the phone).
// One set: the download's count, the window's "יתפנו" line and the update's freeing
function offNeedKeys(items) { const s = new Set(); items.filter(x => x.state === 'in').forEach(x => offItemTiles(x, x.z).forEach(k => s.add(k))); return s; }
// what an update would free: this trip's tiles the plan no longer needs (an area taken out by ✕, a zoom it lost). Those only this trip
// holds leave the phone (≈ by zoom, as the download's estimate); those another trip uses too stay and only lose this trip
function offFreeOf(id, need) { const f = { keys: 0, tiles: 0, bytes: 0 };
  OFF_KEYS.forEach((t, k) => { if (!t.includes(id) || need.has(k)) return; f.keys++; if (t.length === 1) { f.tiles++; f.bytes += OFF_EST(+k.split('/')[0], 'area'); } }); return f; }
// the freeing itself - only on "עדכון", after the additions are in and the pack is done: a tile loses this trip, a tile left with no trip is
// deleted (as offDeletePack). pack.have falls by what left the phone; pack.fetched never changes - it is OpenFreeMap's allowance, counted by
// what was downloaded (a tile freed and downloaded again counts again)
async function offPrune(id, need) { const f = { keys: 0, tiles: 0, bytes: 0 };
  await offScanTiles(true, c => { const t0 = (c.value && c.value.t) || []; if (!t0.includes(id) || need.has(c.key)) return; const t = t0.filter(x => x !== id); f.keys++;
    if (t.length) { c.update({ ...c.value, t }); OFF_KEYS.set(c.key, t); } else { const b = c.value && c.value.b; if (b) { f.tiles++; f.bytes += b.byteLength; } c.delete(); OFF_KEYS.delete(c.key); OFF_DEC.delete(c.key); } });
  const p = OFF_PACKS[id]; if (p && f.keys) { p.have = { tiles: Math.max(0, p.have.tiles - f.tiles), bytes: Math.max(0, p.have.bytes - f.bytes) }; await offPackSave(p); }
  OFF_PLAN_MEMO.sig = ''; if (f.keys) logEvent(`${SY.del} מפות בלי רשת: התפנו ${f.keys} אריחים${SEP}${offMB(f.bytes)}`, true); return f; }
// decision 1 (26.10): the budget is split by itself - lower zoom on transfers first, then on the roads you drive and the smaller areas;
// decision 3: what still doesn't fit is left out (⚪), the least important first, and the user can swap
function offPlan(id, alt) {
  if (id !== STATE.activeTrip) return null;
  const items = offPlanItems(alt), pack = OFF_PACKS[id], mine = k => (OFF_KEYS.get(k) || []).includes(id);
  const sig = JSON.stringify(items.map(x => [x.id, x.user, x.bb, x.boxes ? x.boxes.length : 0, x.line ? x.path.length : 0])) + '|' + (pack ? pack.fetched.tiles : 0) + '|' + OFF_KEYS.size;
  if (!alt && OFF_PLAN_MEMO.sig === sig) return OFF_PLAN_MEMO.plan;
  // 4.46.3: after a download, the areas already planned keep the detail they got (pack.zs) - the 10% reserve is only for what is new
  const used = pack ? pack.fetched : { tiles: 0, bytes: 0 }, base = { tiles: Math.floor(OFF_CAP.tiles * (1 - OFF_RESERVE)), bytes: Math.floor(OFF_CAP.bytes * (1 - OFF_RESERVE)) };
  const budget = !pack ? base : { tiles: OFF_CAP.tiles - used.tiles, bytes: OFF_CAP.bytes - used.bytes };
  const live = items.filter(x => x.user !== 'off'); live.forEach(x => { const zs = (pack && pack.zs) || {}, z0 = [x.id, x.raw, x.old].map(k => k != null ? zs[k] : null).find(v => v != null); x.z = z0 != null ? Math.max(x.zMin, Math.min(x.zMax, z0)) : x.zMax; x.state = 'in'; }); // 11.21.6: a pack downloaded before keeps its detail under the area's old id
  const cost = () => { const seen = new Map(); live.filter(x => x.state === 'in').forEach(x => offItemTiles(x, x.z).forEach(k => { if (!seen.has(k) && !mine(k)) seen.set(k, OFF_EST(+k.split('/')[0], x.line ? 'line' : 'area')); }));
    let b = 0; seen.forEach(v => { b += v; }); return { tiles: seen.size, bytes: b }; };
  const fits = c => c.tiles <= budget.tiles && c.bytes <= budget.bytes;
  const order = live.filter(x => !x.fixed).sort((a, b) => ((a.user === 'on') - (b.user === 'on')) || (OFF_TIER[b.kind] - OFF_TIER[a.kind]) || a.w - b.w); // the first to give up; what you asked to keep - last
  let c = cost();
  while (!fits(c)) { const x = order.find(y => y.state === 'in' && y.z > y.zMin); if (!x) break; x.z--; c = cost(); }
  while (!fits(c)) { const x = order.find(y => y.state === 'in'); if (!x) break; x.state = 'out'; c = cost(); }
  items.filter(x => x.user === 'off').forEach(x => { x.state = 'off'; x.z = x.zMax; });
  // what each item adds (in priority order), and the download queue: the context, then the important areas, each from low zoom up
  const pri = live.filter(x => x.state === 'in').sort((a, b) => (OFF_TIER[a.kind] - OFF_TIER[b.kind]) || b.w - a.w), seen = new Set(), queue = [];
  const ends = []; // wait-look (Q2): where each area's tiles end in the queue - the download's "אזור N מתוך M"
  pri.forEach(x => { let t = 0, b = 0; offItemTiles(x, x.z).forEach(k => { if (seen.has(k)) return; seen.add(k); if (mine(k)) return; t++; b += OFF_EST(+k.split('/')[0], x.line ? 'line' : 'area'); queue.push(k); }); x.add = { tiles: t, bytes: b }; if (t) ends.push(queue.length); });
  items.filter(x => x.state !== 'in').forEach(x => { const ks = offItemTiles(x, x.zMax).filter(k => !seen.has(k) && !mine(k)); x.add = { tiles: ks.length, bytes: ks.reduce((s, k) => s + OFF_EST(+k.split('/')[0], x.line ? 'line' : 'area'), 0) }; });
  const need = offNeedKeys(items), plan = { id, items, queue, ends, cost: c, budget, used, update: !!pack, need, free: pack ? offFreeOf(id, need) : { keys: 0, tiles: 0, bytes: 0 } }; // off-prune
  if (!alt) OFF_PLAN_MEMO = { sig, plan }; return plan; }
function offZoomText(x) { return x.kind === 'ctx' ? 'מדינות וערים' : x.z >= 14 ? 'רמת רחוב' : x.z === 13 ? 'רחובות ראשיים' : x.z >= 11 ? 'כבישים ויישובים' : 'כבישים ראשיים'; }

async function offDeletePack(id, quiet) {
  if (OFF_RUN && OFF_RUN.id === id) OFF_RUN.stop = 'user';
  const db = await offDB(); if (!db) return; const p = OFF_PACKS[id], b = p ? p.have.bytes : 0;
  await offScanTiles(true, c => { const t = ((c.value && c.value.t) || []).filter(x => x !== id); if (t.length !== ((c.value && c.value.t) || []).length) { if (t.length) { c.update({ ...c.value, t }); OFF_KEYS.set(c.key, t); } else { c.delete(); OFF_KEYS.delete(c.key); OFF_DEC.delete(c.key); } } });
  await offTx('packs', 'readwrite', st => st.delete(id)).catch(() => {}); delete OFF_PACKS[id]; OFF_PLAN_MEMO.sig = '';
  if (activeTab === 'info') render(); if (!quiet) showToast(`${SY.del} נמחקו מפות הטיול (${offMB(b)})`); logEvent(SY.del + ' נמחקו מפות בלי רשת: ' + ((p && p.name) || id), true); offRefreshMaps(); if (groupHas('special-maps')) groupFn('special-maps', 'offUiRefresh')(); }
// diet-groups: a download that waited (paused, or running when the app closed) goes on in the background - its group comes quietly
function offResume(id) { needGroup('special-maps').then(ok => { if (ok) groupFn('special-maps', 'offDownload')(id, { quiet: true }); }); }
function offPackLine(id) { const p = OFF_PACKS[id]; if (!p) return '';
  return p.status === 'done' ? `✓ המפות בטלפון${SEP}${offMBh(p.have.bytes)}${SEP}${tmFmt('date', p.at)}` : p.status === 'cap' ? `${warnIc()} ירד חלק – נגמר המקום של הטיול${SEP}${offMBh(p.have.bytes)}` : `${msi('pause', { size: 16, cls: 'msi-in' })} ההורדה לא הסתיימה${SEP}${offMBh(p.have.bytes)}`; }

function offMapOf(id) { const td = tdOf(id); td.offmap = td.offmap || {}; td.offmap.over = td.offmap.over || {}; td.offmap.extra = td.offmap.extra || []; return td.offmap; }
// the window's rows in their order (by kind, then weight), and each area's number by its place among the areas (off-map-areas) - the editor names the same numbers
function offShown(plan) { return plan.items.filter(x => x.kind !== 'ctx').sort((a, b) => (OFF_TIER[a.kind] - OFF_TIER[b.kind]) || b.w - a.w); }
function offNums(plan) { const m = new Map(); offShown(plan).filter(x => !x.line).forEach((x, i) => m.set(x.id, i + 1)); return m; }
setTimeout(() => { try { offInit(); } catch (e) {} }, 0);

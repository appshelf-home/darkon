// ================= 📥 MAPS WITHOUT NETWORK (4.39.0) =================
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
  const p = OFF_PACKS[STATE.activeTrip]; if (p && (p.status === 'running' || p.status === 'paused') && navigator.onLine) setTimeout(() => offDownload(p.trip, { quiet: true }), 4000);
}
function offPackSave(p) { OFF_PACKS[p.trip] = p; return offTx('packs', 'readwrite', st => st.put(p, p.trip)).catch(() => {}); }
const offMB = b => (b / 1048576 < 10 ? (b / 1048576).toFixed(1) : Math.round(b / 1048576)) + 'MB';
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
function offPlanItems() {
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
  (om.extra || []).forEach(x => items.push({ id: 'x:' + x.id, xid: x.id, kind: 'user', label: x.label || 'אזור שהוספתי', w: 99, bb: x.bb, zMax: 14, zMin: 12, zLow: 8, line: false }));
  // the zoomed-out view around each area (zoom 3-7, about 150 km around it), so the map isn't empty when you zoom out
  const boxes = items.filter(x => x.bb).map(x => { const m = [(x.bb[0] + x.bb[2]) / 2, (x.bb[1] + x.bb[3]) / 2]; return [m[0] - 1.4, m[1] - 1.8, m[0] + 1.4, m[1] + 1.8]; });
  if (boxes.length) items.unshift({ id: 'ctx', kind: 'ctx', label: 'המבט הכללי', w: 1e9, boxes, zMax: 7, zMin: 7, zLow: 3, line: false, fixed: true });
  items.forEach(x => { x.user = over[x.id] || (x.old && over[x.old]) || ''; }); // P3: a choice stored under a hotel area's older key (its region's name, 11.21.6 and before) carries to every hotel that had it, until changed
  return items; }
const OFF_TIER = { ctx: 0, user: 1, city: 1, drive: 1, island: 2, transit: 3 };
function offItemTiles(x, z) { x._t = x._t || {}; if (x._t[z]) return x._t[z]; const out = new Set();
  for (let k = x.zLow; k <= z; k++) (x.line ? offLineTiles(x.path, k) : x.boxes ? x.boxes.flatMap(b => offBoxTiles(b, k)) : offBoxTiles(x.bb, k)).forEach(t => out.add(t)); return x._t[z] = [...out]; }
// decision 1 (26.10): the budget is split by itself - lower zoom on transfers first, then on the roads you drive and the smaller areas;
// decision 3: what still doesn't fit is left out (⚪), the least important first, and the user can swap
function offPlan(id) {
  if (id !== STATE.activeTrip) return null;
  const items = offPlanItems(), pack = OFF_PACKS[id], mine = k => (OFF_KEYS.get(k) || []).includes(id);
  const sig = JSON.stringify(items.map(x => [x.id, x.user, x.bb, x.boxes ? x.boxes.length : 0, x.line ? x.path.length : 0])) + '|' + (pack ? pack.fetched.tiles : 0) + '|' + OFF_KEYS.size;
  if (OFF_PLAN_MEMO.sig === sig) return OFF_PLAN_MEMO.plan;
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
  pri.forEach(x => { let t = 0, b = 0; offItemTiles(x, x.z).forEach(k => { if (seen.has(k)) return; seen.add(k); if (mine(k)) return; t++; b += OFF_EST(+k.split('/')[0], x.line ? 'line' : 'area'); queue.push(k); }); x.add = { tiles: t, bytes: b }; });
  items.filter(x => x.state !== 'in').forEach(x => { const ks = offItemTiles(x, x.zMax).filter(k => !seen.has(k) && !mine(k)); x.add = { tiles: ks.length, bytes: ks.reduce((s, k) => s + OFF_EST(+k.split('/')[0], x.line ? 'line' : 'area'), 0) }; });
  const plan = { id, items, queue, cost: c, budget, used, update: !!pack };
  OFF_PLAN_MEMO = { sig, plan }; return plan; }
function offZoomText(x) { return x.kind === 'ctx' ? 'מדינות וערים' : x.z >= 14 ? 'רמת רחוב' : x.z === 13 ? 'רחובות ראשיים' : x.z >= 11 ? 'כבישים ויישובים' : 'כבישים ראשיים'; }

// ---- downloading (4 requests at once, the trip's budget is a hard stop) ----
async function offDownload(id, opt) {
  opt = opt || {}; if (OFF_RUN || id !== STATE.activeTrip) return; if (svcNetDown()) { if (!opt.quiet) showToast(SVC_MSG.offline + '. ההורדה תתחיל כשתהיה רשת.'); return; }
  const plan = offPlan(id); if (!plan) return;
  let pack = OFF_PACKS[id] || { trip: id, name: activeTripObj().name, at: Date.now(), fetched: { tiles: 0, bytes: 0 }, have: { tiles: 0, bytes: 0 }, status: 'running', failed: 0 };
  pack.status = 'running'; pack.name = activeTripObj().name;
  pack.zs = { ...(pack.zs || {}) }; plan.items.filter(x => x.state === 'in').forEach(x => { pack.zs[x.id] = Math.max(pack.zs[x.id] || 0, x.z); }); // 4.46.3
  await offPackSave(pack);
  // 4.46.3: the progress counts the whole plan, so going on after ⏸ continues the numbers instead of starting over
  const all = new Set(); plan.items.filter(x => x.state === 'in').forEach(x => offItemTiles(x, x.z).forEach(k => all.add(k)));
  const queue = plan.queue.slice(), run = OFF_RUN = { id, done: Math.max(0, all.size - queue.length), total: Math.max(all.size, queue.length), bytes: pack.have.bytes, stop: false };
  let tpl = null; try { tpl = await vtTemplate(); } catch (e) { OFF_RUN = null; pack.status = 'paused'; await offPackSave(pack); if (!opt.quiet) showToast(SY.warn + ' שרת המפות לא ענה. אפשר לנסות שוב בעוד רגע.'); offUiRefresh(); return; }
  logEvent(`הורדת מפות לטיול התחילה: ${queue.length} אריחים`, true);
  const tick = () => { offUiRefresh(); };
  const one = async k => {
    const have = OFF_KEYS.get(k); if (have) { if (!have.includes(id)) { const v = await offTx('tiles', 'readonly', st => st.get(k)).catch(() => null); if (v) { v.t = [...new Set([...(v.t || []), id])]; await offTx('tiles', 'readwrite', st => st.put(v, k)).catch(() => {}); OFF_KEYS.set(k, v.t); } } run.done++; return; }
    if (pack.fetched.tiles >= OFF_CAP.tiles || pack.fetched.bytes >= OFF_CAP.bytes) { run.stop = 'cap'; return; }
    const [z, x, y] = k.split('/'), u = tpl.t.replace('{z}', z).replace('{x}', x).replace('{y}', y);
    if (svcBudgetOf(id).tiles + pack.fetched.tiles >= OFF_CAP.tiles || svcBudgetOf(id).bytes + pack.fetched.bytes >= OFF_CAP.bytes) { run.stop = 'cap'; return; } // the picture's background counts too (ש6)
    const r = await vtTile('offmaps', u, 25000); // 7.1.0: through the client (4 at once with the picture's map, busy / errors / no network handled there)
    if (r.kind === 'offline') { run.stop = 'offline'; return; }
    if (r.kind === 'empty') { pack.fetched.tiles++; await offTx('tiles', 'readwrite', st => st.put({ b: null, t: [id] }, k)); OFF_KEYS.set(k, [id]); }
    else if (r.kind === 'ok') { const b = r.value; pack.fetched.tiles++; pack.fetched.bytes += b.byteLength; pack.have.tiles++; pack.have.bytes += b.byteLength; run.bytes += b.byteLength;
      await offTx('tiles', 'readwrite', st => st.put({ b: b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), t: [id] }, k)); OFF_KEYS.set(k, [id]); }
    else pack.failed = (pack.failed || 0) + 1;
    run.done++; if (run.done % 40 === 0) { offPackSave(pack); tick(); } };
  await Promise.all([0, 1, 2, 3].map(async () => { while (queue.length && !run.stop) await one(queue.shift()); })); // at most 4 waiting in the client's queue at a time
  pack.at = Date.now(); pack.status = run.stop === 'offline' || run.stop === 'user' ? 'paused' : run.stop === 'cap' ? 'cap' : 'done'; await offPackSave(pack); OFF_RUN = null; OFF_PLAN_MEMO.sig = '';
  if (run.stop && run.stop !== 'user') svcTrouble('openfreemap', 'offmaps', `הורדה נעצרה (${run.stop})${SEP}${run.done} מתוך ${run.total}${SEP}${offMB(pack.have.bytes)}`); // 7.1.0 (ש11): technical - in diagnostics
  else if (!run.stop) logEvent(`מפות לטיול ירדו: ${run.done} אריחים${SEP}${offMB(pack.have.bytes)}`, true);
  if (!opt.quiet || pack.status === 'done') showToast(pack.status === 'done' ? `✓ המפות בטלפון${SEP}${offMB(pack.have.bytes)}` : pack.status === 'cap' ? SY.warn + ' ירד חלק – נגמר המקום של הטיול. מה שירד נשמר.' : run.stop === 'user' ? 'ההורדה נעצרה. אפשר להמשיך מאותו מקום.' : 'הרשת נותקה. ההורדה תמשיך כשתחזור.');
  offRefreshMaps(); offUiRefresh(); if (activeTab === 'info') render(); // 4.46.3: the card "לקראת הטיול" follows too
}
async function offDeletePack(id, quiet) {
  if (OFF_RUN && OFF_RUN.id === id) OFF_RUN.stop = 'user';
  const db = await offDB(); if (!db) return; const p = OFF_PACKS[id], b = p ? p.have.bytes : 0;
  await offScanTiles(true, c => { const t = ((c.value && c.value.t) || []).filter(x => x !== id); if (t.length !== ((c.value && c.value.t) || []).length) { if (t.length) { c.update({ ...c.value, t }); OFF_KEYS.set(c.key, t); } else { c.delete(); OFF_KEYS.delete(c.key); OFF_DEC.delete(c.key); } } });
  await offTx('packs', 'readwrite', st => st.delete(id)).catch(() => {}); delete OFF_PACKS[id]; OFF_PLAN_MEMO.sig = '';
  if (activeTab === 'info') render(); if (!quiet) showToast(`${SY.del} נמחקו מפות הטיול (${offMB(b)})`); logEvent(SY.del + ' נמחקו מפות בלי רשת: ' + ((p && p.name) || id), true); offRefreshMaps(); offUiRefresh(); }
function offPackLine(id) { const p = OFF_PACKS[id]; if (!p) return '';
  return p.status === 'done' ? `✓ המפות בטלפון${SEP}${offMBh(p.have.bytes)}${SEP}${tmFmt('date', p.at)}` : p.status === 'cap' ? `${warnIc()} ירד חלק – נגמר המקום של הטיול${SEP}${offMBh(p.have.bytes)}` : `${msi('pause', { size: 16, cls: 'msi-in' })} ההורדה לא הסתיימה${SEP}${offMBh(p.have.bytes)}`; }

// ---- drawing: a canvas layer under the tile layers, only when there is no network ----
function offFindTile(z, x, y, zMin) { for (let k = Math.min(z, 14); k >= (zMin || 0); k--) { const d = z - k, key = `${k}/${x >> d}/${y >> d}`; if (OFF_KEYS.has(key)) return { z: k, x: x >> d, y: y >> d, key }; } return null; }
async function offLayersOf(key) { if (OFF_DEC.has(key)) return OFF_DEC.get(key);
  const v = await offTx('tiles', 'readonly', st => st.get(key)).catch(() => null); let L = null;
  try { if (v && v.b) L = mvtLayers(new Uint8Array(v.b), OFF_LAYERS); } catch (e) { L = null; }
  OFF_DEC.set(key, L); if (OFF_DEC.size > 40) OFF_DEC.delete(OFF_DEC.keys().next().value); return L; }
const OFF_ROAD = { motorway: ['#E892A2', 4], trunk: ['#F9B29C', 3.6], primary: ['#FCD6A4', 3.2], secondary: ['#F7FABF', 2.6], tertiary: ['#FFFFFF', 2.2], minor: ['#FFFFFF', 1.6], service: ['#FFFFFF', 1.1], track: ['#C8A97E', 0.8], path: ['#C8A97E', 0.8] };
// 7.1.0: the drawing itself is shared by the offline map layer and the trip picture's "🗺️ מפה" (one vector style, ש7)
const OFF_LAYERS = ['water', 'waterway', 'landcover', 'landuse', 'park', 'transportation', 'building', 'place', 'boundary', 'aeroway'];
async function offDrawTile(cv, co, r) {
  const src = offFindTile(co.z, co.x, co.y); if (!src) return false; const L = await offLayersOf(src.key); if (!L) return false;
  const ctx = cv.getContext('2d'), size = 256 * r, sc = 2 ** (co.z - src.z), ox = co.x - src.x * sc, oy = co.y - src.y * sc;
  ctx.fillStyle = '#F2EFE9'; ctx.fillRect(0, 0, size, size);
  offDrawLayers(ctx, L, -ox * size, -oy * size, size * sc, co.z, r); return true; }
// one vector tile's layers drawn into the square [px, px+ds] × [py, py+ds]; zf = the zoom it is seen at (what shows, line widths);
// pass: 'areas' | 'lines' | 'labels' (a picture of many tiles draws each pass over all tiles, so no tile covers its neighbour's lines)
function offDrawLayers(ctx, L, px, py, ds, zf, r, pass) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const draw = (lyr, pick, how) => { const ly = L[lyr]; if (!ly) return; const E = ly.extent, k = ds / E; ctx.setTransform(k, 0, 0, k, px, py);
    ly.feats.forEach(f => { const st = pick(f.props, f.type); if (!st) return; ctx.beginPath(); f.rings.forEach(rg => { rg.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); });
      if (how === 'fill') { ctx.fillStyle = st; ctx.fill('evenodd'); } else { ctx.strokeStyle = st[0]; ctx.lineWidth = st[1] * r * (zf >= 16 ? 1.8 : zf >= 15 ? 1.35 : zf >= 13 ? 1 : zf >= 11 ? 0.7 : 0.5) / k; ctx.setLineDash(st[2] ? st[2].map(v => v * r / k) : []); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(); } });
    ctx.setLineDash([]); ctx.setTransform(1, 0, 0, 1, 0, 0); };
  if (!pass || pass === 'areas') {
    draw('landcover', p => p.class === 'wood' ? '#D3E5C2' : p.class === 'grass' || p.class === 'farmland' ? '#E3EDD3' : p.class === 'sand' ? '#F3E7C3' : p.class === 'ice' ? '#F4F8FB' : '', 'fill');
    draw('landuse', p => /^(cemetery)$/.test(p.class) ? '#D6E3CF' : /^(hospital|school|university|college)$/.test(p.class) ? '#F0E6E0' : /^(stadium|pitch)$/.test(p.class) ? '#D9EBC9' : /^(residential)$/.test(p.class) && zf < 14 ? '#EDE8E0' : '', 'fill');
    draw('park', () => '#CDE6B8', 'fill');
    draw('water', () => '#AAD3DF', 'fill');
    draw('aeroway', (p, t) => t === 3 ? '#E4E0EA' : '', 'fill');
    if (zf >= 14) draw('building', () => '#E2DDD5', 'fill'); }
  if (!pass || pass === 'lines') {
    draw('waterway', p => [ '#AAD3DF', p.class === 'river' ? 3 : p.class === 'canal' ? 2 : 1 ], 'line');
    draw('boundary', p => Number(p.admin_level) <= 4 && !p.maritime ? ['#9E85B8', Number(p.admin_level) === 2 ? 1.6 : 0.9, [6, 4]] : '', 'line');
    const roadOk = p => { const c = p.class; if (c === 'path' || c === 'track') return zf >= 15; if (c === 'service') return zf >= 15; if (c === 'minor') return zf >= 13; if (c === 'tertiary') return zf >= 11; return true; };
    draw('transportation', p => OFF_ROAD[p.class] && roadOk(p) && p.brunnel !== 'tunnel' ? ['#C9C0B1', OFF_ROAD[p.class][1] + 1.4] : '', 'line');
    draw('transportation', p => OFF_ROAD[p.class] && roadOk(p) ? [p.brunnel === 'tunnel' ? '#EEEAE2' : OFF_ROAD[p.class][0], OFF_ROAD[p.class][1]] : '', 'line');
    draw('transportation', p => (p.class === 'rail' || p.class === 'transit') && p.brunnel !== 'tunnel' ? ['#8E8E8E', 1, [4, 3]] : '', 'line'); }
  if (!pass || pass === 'labels') {
    const pl = L.place; if (pl) { const E = pl.extent, k = ds / E, cls = { country: [15, 700, 0], state: [12, 600, 4], city: [14, 700, 4], town: [12.5, 600, 9], village: [11, 500, 12], suburb: [11.5, 500, 12], quarter: [10.5, 400, 14], neighbourhood: [10.5, 400, 14], hamlet: [10, 400, 15], island: [11, 500, 11] };
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      pl.feats.forEach(f => { const c = cls[f.props.class], nm = vtName(f.props), q = f.rings[0] && f.rings[0][0]; if (!c || !nm || !q || zf < c[2]) return;
        const x = px + q[0] * k, y = py + q[1] * k; if (x < 0 || y < 0 || x >= W || y >= H || q[0] < 0 || q[1] < 0 || q[0] >= E || q[1] >= E) return;
        ctx.font = `${c[1]} ${c[0] * r}px Rubik, Arial, sans-serif`; ctx.direction = /[\u0590-\u05FF]/.test(nm) ? 'rtl' : 'ltr'; ctx.lineWidth = 3 * r; ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.strokeText(nm, x, y); ctx.fillStyle = '#4A4A4A'; ctx.fillText(nm, x, y); }); } }
}
function offLayerFor(map) {
  if (!window.L || !L.GridLayer || map._offLayer) return;
  const Lyr = L.GridLayer.extend({ createTile(co, done) { const c = document.createElement('canvas'), r = Math.min(2, window.devicePixelRatio || 1); c.width = c.height = 256 * r; c.style.width = c.style.height = '256px';
    if (navigator.onLine || !OFF_KEYS.size) { setTimeout(() => done(null, c), 0); return c; }
    offDrawTile(c, co, r).then(() => done(null, c), () => done(null, c)); return c; } });
  map._offLayer = new Lyr({ zIndex: 0, maxZoom: 22, attribution: OFF_KEYS.size ? svcCredit('openfreemap') : '' }).addTo(map);
  offBadge(map); map.on('moveend zoomend', () => offBadgeUpdate(map)); }
function offRefreshMaps() { if (typeof LIVE_MAPS === 'undefined') return; LIVE_MAPS.forEach(m => { try { if (!m.getContainer().isConnected) return; if (!m._offLayer) offLayerFor(m); else m._offLayer.redraw(); offBadgeUpdate(m); } catch (e) {} }); }
act('map.offInfo', c => showToast(c.el.dataset.st === 'none' ? 'אין רשת, והאזור הזה לא הורד לטלפון. מה שכבר ראית מוצג כרגיל.' : 'אין רשת. אזורים שכבר ראית מוצגים כרגיל, והשאר מהמפה שהורדה לטיול, שהיא פשוטה יותר. כשתחזור הרשת הכל יתעדכן.'));
function offBadge(map) { if (map._offBadge || !L.control) return; const C = L.Control.extend({ onAdd() { const b = L.DomUtil.create('button', 'off-badge'); b.type = 'button'; b.hidden = true; b.dataset.act = 'map.offInfo'; mapCtl(b); return b; } });
  map._offBadge = new C({ position: 'topleft' }).addTo(map); offBadgeUpdate(map); }
function offBadgeUpdate(map) { const b = map && map._offBadge && map._offBadge.getContainer(); if (!b) return;
  if (navigator.onLine || !Object.keys(OFF_PACKS).length) { b.hidden = true; return; }
  let st = 'none'; try { const z = Math.round(map.getZoom()), c = map.getCenter(), [x, y] = offTileXY(c.lat, c.lng, Math.min(z, 14)); if (offFindTile(Math.min(z, 14), x, y, Math.min(z, 8))) st = 'saved'; } catch (e) {}
  b.hidden = false; b.dataset.st = st; b.innerHTML = msi('cloud_off', { size: 18 }) + (st === 'saved' ? ' מפה שמורה' : ' האזור הזה לא הורד'); // 10.15.0 (F19)
  if (st === 'saved' && !DEV.offTipSeen) { devSet({ offTipSeen: true }); setTimeout(() => b.click(), 600); } }
window.addEventListener('online', () => { offRefreshMaps(); const p = OFF_PACKS[STATE.activeTrip]; if (p && p.status === 'paused' && !OFF_RUN) setTimeout(() => offDownload(p.trip, { quiet: true }), 3000); });
window.addEventListener('offline', () => offRefreshMaps());

// ---- the review screen: areas with their size, the budget, ✕ / ＋, "＋ אזור" by framing, download / update / delete ----
const OFF_PIN_PX = 24; let OFF_VIEW = null; // off-map-areas (11.47.0): an area smaller than this on screen is a pin; where the map was moved to (kept across a redraw in place)
function offAreaColor(x) { return x.state === 'in' ? (x.kind === 'transit' ? '#888780' : '#185FA5') : '#B4B2A9'; }
function offUiRefresh() { if (document.getElementById('offSheet')) openOffMaps(STATE.activeTrip, true); }
undoAfter(keys => { if (keys.some(k => /^\["d",.*"offmap"\]$/.test(k))) offUiRefresh(); }); // undo-history (Q5): the open window shows the areas restored
function openOffMaps(id, keep) { const ctl = {}; layerNote(openOffMaps, arguments);
  if (id !== STATE.activeTrip) { switchTrip(id); }
  const sheet = document.getElementById('sheet'), t = activeTripObj(), plan = offPlan(t.id), pack = OFF_PACKS[t.id], run = OFF_RUN && OFF_RUN.id === t.id ? OFF_RUN : null;
  if (!plan) return; const inPlace = keep || (layerTop() && layerTop().key === 'openOffMaps' && sheet.querySelector('#offSheet')); if (!inPlace || !OFF_VIEW || OFF_VIEW.trip !== t.id) OFF_VIEW = null; /* a redraw of the open window (✕ / ＋, an undo, the layer's own redraw) keeps the view */ const keepScroll = keep && sheet.querySelector('.off-list') ? sheet.querySelector('.off-list').scrollTop : 0;
  const pct = Math.min(100, Math.round(100 * Math.max(plan.cost.bytes / plan.budget.bytes, plan.cost.tiles / plan.budget.tiles) || 0));
  const shown = plan.items.filter(x => x.kind !== 'ctx').sort((a, b) => (OFF_TIER[a.kind] - OFF_TIER[b.kind]) || b.w - a.w);
  const num = new Map(); if (MAP_AVAILABLE) shown.filter(x => !x.line).forEach((x, i) => num.set(x, i + 1)); // off-map-areas (11.47.0): each area its number by its order in the list - the same number on its pin
  const row = x => { const n = num.get(x), st = x.state === 'in' ? '' : x.state === 'out' ? '<span class="off-out">לא נכנס במקום</span>' : '<span class="off-out">✕ הוצא</span>';
    const btn = x.kind === 'ctx' ? '' : x.kind === 'user' ? `<button type="button" class="off-x" data-act="offMaps.offdel" data-offdel="${_qe(x.xid)}" aria-label="מחיקת האזור" title="מחיקת האזור">${msi('delete', { size: 18 })}</button>` : x.state === 'in' ? `<button type="button" class="off-x" data-act="offMaps.offset" data-offset="${_qe(x.id)}" data-v="off" aria-label="להוציא" title="להוציא">${msi('close', { size: 18 })}</button>` : `<button type="button" class="icon-btn btn-copy" data-act="offMaps.offset" data-offset="${_qe(x.id)}" data-v="on">＋ להכניס</button>`;
    return `<div class="off-row${x.state !== 'in' ? ' off-dim' : ''}"${n ? ` data-act="offMaps.offFrame" data-offn="${_qe(n)}"` : ''}>${msi(x.line ? 'route' : x.kind === 'user' ? 'edit' : 'map', { cls: 'off-ic' })}${n ? `<b class="off-n${x.state !== 'in' ? ' off-out' : ''}"${x.state === 'in' ? ` style="background:${_qe(offAreaColor(x))}"` : ''}>${_qe(n)}</b>` : ''}<span class="off-tx${x.hotel ? ' off-hotel' : ''}"><b>${_qe(x.label)}</b>${x.sub ? `<small class="off-sub">${_qe(x.sub)}</small>` : ''}<small>${x.state === 'in' ? offZoomText(x) + (x.add && x.add.tiles ? SEP + '≈ ' + offMBh(x.add.bytes) : plan.update ? (SEP + 'כבר בטלפון') : '') : '≈ ' + offMBh((x.add || {}).bytes || 0)} ${st}</small></span>${btn}</div>`; };
  const sizeTxt = `${offMBh(plan.cost.bytes)}`; // 9.2.0 (ס10): MB and a share of the trip's room; tiles stay in the log and diagnostics
  const head = pack ? `<p class="sh-hint">${offPackLine(t.id)}${plan.queue.length ? `${SEP}<b>יש אזור חדש להוריד</b> (${sizeTxt}, מתוך המקום שנשאר: ${offMBh(plan.budget.bytes)})` : ''}</p>` : `<p class="sh-hint">מורידים פעם אחת את המפה של אזורי הטיול, כדי שתעבוד גם בלי רשת.</p>`;
  const prog = run ? `<div class="off-prog" id="offProg">${msi('hourglass_top', { size: 18 })} <bdi>${run.done.toLocaleString('he-IL')}</bdi> מתוך <bdi>${run.total.toLocaleString('he-IL')}</bdi>${SEP}${offMBh(run.bytes)} <button type="button" class="icon-btn btn-copy" id="offStop" data-act="offMaps.offStop" style="width:auto;padding:0 10px">${msi('pause', { size: 18 })} עצירה</button></div>` : '';
  const act = run ? '' : plan.queue.length ? `<button class="btn-nav" id="offGo" data-act="offMaps.offGo">${msi('download', { size: 18 })} ${pack ? (pack.status === 'done' ? 'עדכון מפות' : 'להמשיך את ההורדה') : 'הורדה'}${SEP}<bdi>${sizeTxt}</bdi></button>` : '';
  sheet.innerHTML = `<div class="sheet-head" id="offSheet"><b>📥 מפות לשימוש בלי רשת ${tipI('offmaps')}</b><button class="sheet-x" data-act="win.close" id="offClose" aria-label="סגירה">✕</button></div>${head}
    ${MAP_AVAILABLE ? `<div id="offMap" class="off-map"></div><div class="off-addrow"><button type="button" class="sh-secondary off-add" id="offAdd" data-act="offMaps.offAdd">${msi('add', { size: 18 })} אזור (מה שרואים במפה)</button></div>` : ''}
    <div class="off-meter"><div style="width:${pct}%"></div></div><p class="sh-hint">${plan.cost.bytes ? `ההורדה: <bdi>${sizeTxt}</bdi>${SEP}<bdi>${pct}%</bdi> מהמקום של הטיול` : 'אין מה להוריד'}${plan.items.some(x => x.state === 'out') ? (SEP + 'כדי להכניס: ✕ על אזור אחר') : ''}</p>
    <div class="off-list">${shown.map(row).join('') || '<p class="sh-hint">אין עדיין מקומות או לינות עם מיקום על המפה בטיול הזה.</p>'}</div>
    ${prog}<p class="sh-hint off-cr">${navigator.connection && navigator.connection.type === 'cellular' ? 'את/ה על רשת סלולרית - מומלץ להוריד ב-Wi-Fi. ' : 'מומלץ ב-Wi-Fi. '}מפה: ${svcCredit('openfreemap')}</p>
    ${pack && !run ? fmEndActs([{ act: 'offMaps.offDel', id: 'offDel', label: 'מחיקת המפות של הטיול', del: true }]) : ''}
    <div class="brow sheet-actions sheet-save-bar">${act}</div>`; // 10.5.0: the main action in the pinned footer; end-actions-followups (Q2): the delete is the red row of the end group
  if (keepScroll) sheet.querySelector('.off-list').scrollTop = keepScroll;
  const g = i => document.getElementById(i), om = () => { const td = tdOf(t.id); td.offmap = td.offmap || {}; td.offmap.over = td.offmap.over || {}; td.offmap.extra = td.offmap.extra || []; return td.offmap; };
  
  if (g('offGo')) ctl.offGo = () => { offDownload(t.id); setTimeout(() => openOffMaps(t.id, true), 50); };
  if (g('offStop')) ctl.offStop = () => { if (OFF_RUN) OFF_RUN.stop = 'user'; };
  ctl.offDel = () => askSure({ ic: 'delete', title: 'למחוק את המפות שהורדו?', text: 'בלי רשת לא יהיו מפות לטיול הזה. אפשר להוריד שוב כשיש רשת.', ok: 'מחיקה' }, () => { offDeletePack(t.id); });
  ctl.offset = b => { const o = om(), k = b.dataset.offset;
    if (b.dataset.v === 'on') o.over[k] = 'on'; else o.over[k] = 'off'; persist(); OFF_PLAN_MEMO.sig = ''; openOffMaps(t.id, true);
    showUndoToast(b.dataset.v === 'on' ? '＋ האזור נכנס' : '✕ האזור הוצא'); };
  ctl.offdel = b => { const o = om(), x = o.extra.find(e => e.id === b.dataset.offdel); o.extra = o.extra.filter(e => e !== x); persist(); OFF_PLAN_MEMO.sig = ''; openOffMaps(t.id, true);
    showUndoToast(SY.del + ' האזור נמחק'); };
  // 4.46.2: the map is drawn after the dialog is on screen - fitting the regions into a box with no size yet left it blank
  const drawMap = () => { if (!(MAP_AVAILABLE && g('offMap'))) return; const box = g('offMap'); if (!box.clientWidth) { requestAnimationFrame(drawMap); return; }
    if (!leafGate(box, drawMap)) return; // 11.29.0 (launch-fast): the library first
    try { const m = mapTool('offMap'); // 5.9.0
      // 10.5.0 (look.md "Maps"): ⛶ - the regions' map on the whole screen (the downloaded tiles show offline too); ✕ / back returns
      const fb = document.createElement('button'); fb.type = 'button'; fb.className = 'fs-btn'; fb.innerHTML = FS_ICON; fb.dataset.act = 'offMaps.offFs'; fb.setAttribute('aria-label', 'מפה במסך מלא'); fb.title = 'מסך מלא';
      box.appendChild(fb); mapCtl(fb); box._ctl = { offMaps: ctl }; let ph = null;
      const fsOut = fromPop => { if (!ph) return; if (ph.isConnected) ph.replaceWith(box); else box.remove(); ph = null; box.classList.remove('off-full'); fb.innerHTML = FS_ICON; fb.title = 'מסך מלא'; fb.setAttribute('aria-label', 'מפה במסך מלא'); try { m.invalidateSize(); } catch (e) {} layerDone('offFs', fromPop); };
      ctl.offFs = () => { if (ph) { fsOut(); return 'quiet'; } ph = document.createComment('offMap'); box.replaceWith(ph); document.body.appendChild(box); box.classList.add('off-full');
        fb.innerHTML = msi('close'); fb.title = 'יציאה ממסך מלא'; fb.setAttribute('aria-label', 'יציאה ממסך מלא'); layerPush('offFs', 'full', fp => fsOut(fp)); setTimeout(() => { try { m.invalidateSize(); } catch (e) {} }, 60); return 'quiet'; };
 const grp = [], areas = [];
      // off-map-areas (11.47.0; decisions 2026-11-20-offline-map-small-areas Q1): an area under OFF_PIN_PX on either side on screen is its
      // round numbered pin at its centre (the map component's marker), else its rectangle with its name; one drawing, switched per area
      shown.forEach(x => { const col = offAreaColor(x), o = { color: col, weight: x.line ? 4 : 2, fillOpacity: x.state === 'in' ? 0.12 : 0.04, dashArray: x.state === 'in' ? null : '4 6' };
        if (x.line) { const s = L.polyline(x.path, o); s.bindTooltip(_escH(x.label) /* the map library reads a string as HTML */).addTo(m); grp.push(s); return; }
        const r = L.rectangle([[x.bb[0], x.bb[1]], [x.bb[2], x.bb[3]]], o); r.bindTooltip(_escH(x.label), { permanent: true, direction: 'center', className: 'off-lbl' }); // 10.5.0: each area labeled with its name
        const a = { x, n: num.get(x), o, r, on: '' }; a.pin = L.marker(r.getBounds().getCenter(), { keyboard: false, icon: pinDivIcon({ color: x.state === 'in' ? col : 'var(--surface-container)' }, { round: true, number: a.n, cls: 'off-pin' + (x.state === 'in' ? '' : ' off-out') }) });
        a.pin.on('click', () => goArea(a, true)); areas.push(a); grp.push(r); });
      const offMode = () => areas.forEach(a => { const p = m.latLngToContainerPoint([a.x.bb[0], a.x.bb[1]]), q = m.latLngToContainerPoint([a.x.bb[2], a.x.bb[3]]);
        const want = Math.abs(q.x - p.x) < OFF_PIN_PX || Math.abs(q.y - p.y) < OFF_PIN_PX ? 'pin' : 'rect'; if (a.on === want) return;
        if (a.on) m.removeLayer(a.on === 'pin' ? a.pin : a.r); (want === 'pin' ? a.pin : a.r).addTo(m); a.on = want; });
      const ab = document.createElement('button'); ab.type = 'button'; ab.className = 'off-all'; ab.id = 'offAll'; ab.textContent = 'כל האזורים'; ab.dataset.act = 'offMaps.offAll'; ab.hidden = !OFF_VIEW; box.appendChild(ab); mapCtl(ab);
      const fitAll = () => { if (grp.length) m.fitBounds(L.featureGroup(grp).getBounds(), { padding: [12, 12] }); else m.setView([31.5, 34.8], 6); };
      const flash = a => { a.r.setStyle({ weight: 4, fillOpacity: 0.3 }); clearTimeout(a.fl); a.fl = setTimeout(() => { try { a.r.setStyle(a.o); } catch (e) {} }, 1500); };
      // Q2: a row or a pin frames its area (highlighted for a moment); a pin also lights its row and scrolls it into view; "כל האזורים" back
      const goArea = (a, fromPin) => { OFF_VIEW = { trip: t.id }; ab.hidden = false; m.fitBounds(a.r.getBounds(), { padding: [24, 24] }); offMode(); flash(a);
        if (!fromPin) return; const rw = [...sheet.querySelectorAll('.off-row[data-offn]')].find(e => +e.dataset.offn === a.n), li = rw && rw.closest('.off-list'); if (!rw) return;
        if (li) li.scrollTop += rw.getBoundingClientRect().top - li.getBoundingClientRect().top - (li.clientHeight - rw.offsetHeight) / 2;
        rw.classList.add('off-hl'); clearTimeout(rw._hl); rw._hl = setTimeout(() => rw.classList.remove('off-hl'), 1500); };
      ctl.offFrame = b => { const a = areas.find(y => y.n === +b.dataset.offn); if (a) goArea(a, false); return 'quiet'; };
      ctl.offAll = () => { OFF_VIEW = null; ab.hidden = true; fitAll(); return 'quiet'; };
      if (OFF_VIEW && OFF_VIEW.c) m.setView(OFF_VIEW.c, OFF_VIEW.z, { animate: false }); else fitAll(); // a redraw in place (✕ / ＋ / an undo) keeps where the map was moved: it never returns by itself
      const fitLbl = () => { offMode(); offLabelsFit(box); if (OFF_VIEW) { OFF_VIEW.c = m.getCenter(); OFF_VIEW.z = m.getZoom(); } }; m.on('zoomend moveend resize', fitLbl); fitLbl();
      ctl.offAdd = () => { const b = m.getBounds(), o = om(), x = { id: 'u' + Date.now().toString(36), label: 'אזור שהוספתי ' + (o.extra.length + 1), bb: [b.getSouth(), b.getWest(), b.getNorth(), b.getEast()].map(v => +v.toFixed(5)) };
        if (distanceKm({ lat: x.bb[0], lng: x.bb[1] }, { lat: x.bb[2], lng: x.bb[3] }) > 80) { showToast('האזור גדול מדי לרמת רחוב. מתקרבים לאזור שרוצים (עד כ-50 ק״מ) ומוסיפים שוב.'); return; }
        o.extra.push(x); persist(); OFF_PLAN_MEMO.sig = ''; openOffMaps(t.id, true); showUndoToast('＋ נוסף אזור'); };
    } catch (e) { logEvent(SY.warn + ' מפת האזורים: ' + (e && e.message || e), true); } };
  if (!keep) { showSheetBackdrop('openOffMaps'); layerTop().ctl = ctl; } else if (layerTop() && layerTop().key === 'openOffMaps') layerTop().ctl = ctl; // undo-history: a redraw in place (✕ / ＋ / an undo) hands the window the new map's actions - "＋ אזור" framed the map drawn first
  requestAnimationFrame(drawMap);
}
// final-review 14: the area labels of the regions' map never sit on each other, on a map button or across the map's edge. Each label is
// drawn at its area's center; in the areas' order, a label that would touch one already placed moves up or down by whole rows to the
// nearest free place, a label at the edge moves in, and one with no free place (or whose area's center is out of view) is not drawn
// (the list under the map names every area). Run after every zoom, pan and resize.
function offLabelsFit(box) { const B = box.getBoundingClientRect(), G = 3, lbls = [...box.querySelectorAll('.off-lbl')]; if (!B.width || !lbls.length) return;
  const hit = (a, b) => a.l < b.r + G && b.l < a.r + G && a.t < b.b + G && b.t < a.b + G;
  const placed = [...box.querySelectorAll('.fs-btn, .off-all, .leaflet-control')].map(e => e.getBoundingClientRect()).filter(r => r.width && r.height).map(r => ({ l: r.left - B.left, r: r.right - B.left, t: r.top - B.top, b: r.bottom - B.top }));
  lbls.forEach(e => { e.style.translate = ''; e.style.visibility = ''; e.style.maxWidth = Math.max(40, Math.floor(B.width) - 2 * G - 2) + 'px'; });
  lbls.map(e => ({ e, r: e.getBoundingClientRect() })).forEach(({ e, r }) => { const w = r.width, h = r.height, cx = r.left - B.left + w / 2, cy = r.top - B.top + h / 2;
    let got = null;
    if (cx >= 0 && cx <= B.width && cy >= 0 && cy <= B.height) for (let k = 0; k <= 12 && !got; k++) for (const s of (k ? [-1, 1] : [1])) { // rows above and below, nearest first
      const l = Math.max(G, Math.min(B.width - G - w, cx - w / 2)), t = cy - h / 2 + s * k * (h + G);
      const c = { l, r: l + w, t, b: t + h }; if (t < G || c.b > B.height - G || placed.some(p => hit(c, p))) continue; got = c; break; }
    if (!got) { e.style.visibility = 'hidden'; return; }
    placed.push(got); e.style.translate = `${Math.round(got.l - (cx - w / 2))}px ${Math.round(got.t - (cy - h / 2))}px`; }); } // translate: the map library owns the label's transform
ctlActs('offMaps', ['offDel', 'offAdd', 'offGo', 'offStop', 'offdel', 'offset', 'offFs', 'offFrame', 'offAll']);
// ⚙️ ← 💾 offline maps stored on the phone
function offSettingsHTML() {
  const ps = Object.values(OFF_PACKS);
  return `<p>מפות שהורדו לשימוש בלי רשת ("מפות לבלי רשת" בפעולות ⋯ של טיול), וכמה תופסים אריחים שנשמרו מצפייה במפה.</p>
    ${ps.length ? ps.map(p => { const shared = [...OFF_KEYS.values()].some(t => t.includes(p.trip) && t.length > 1);
      return `<div class="off-row"><span class="off-ic">${msi('map')}</span><span class="off-tx"><b>${_qe((STATE.trips[p.trip] || {}).name || p.name || p.trip)}</b><small>${offMB(p.have.bytes)}${SEP}${tmFmt('date', p.at)}${p.status !== 'done' ? (SEP + 'לא הסתיים') : ''}${shared ? (SEP + 'חלק בשימוש גם בטיול אחר (נשאר)') : ''}</small></span><button type="button" class="icon-btn btn-copy" data-act="offSet.offrm" data-offrm="${_qe(p.trip)}" aria-label="מחיקה">${msi('delete', { size: 18 })}</button></div>`; }).join('') : '<p class="sh-hint">אין מפות שהורדו.</p>'}
    <div class="off-row"><span class="off-ic">${msi('visibility')}</span><span class="off-tx"><b>מה שנשמר מצפייה</b><small id="offViewed">…</small></span><button type="button" class="icon-btn btn-copy" id="offViewClear" data-act="offSet.offViewClear" style="width:auto;padding:0 10px">${msi('delete_sweep', { size: 18 })} ניקוי</button></div>`; }
function offSettingsCtl() { const ctl = ctlNS('offSet');
  ctl.offrm = b => { const k = b.dataset.offrm; return askSure({ ic: 'delete', title: 'למחוק את המפות שהורדו?', text: 'בלי רשת לא יהיו מפות לטיול הזה. אפשר להוריד שוב כשיש רשת.', ok: 'מחיקה' }, () => { offDeletePack(k).then(() => redrawSoon()); }); }; // 10.13.0 (gap 47): in the dialog
  const v = document.getElementById('offViewed'); if (v) regCache('darkon-tiles').then(c => c.keys().then(k => Promise.all(k.map(r => c.match(r).then(x => x ? x.blob() : null).then(b => b ? b.size : 0).catch(() => 0))))).then(sz => { v.textContent = `${offMB(sz.reduce((a, b) => a + b, 0))}${SEP}נטענים שוב מהרשת כשצריך`; }).catch(() => { v.textContent = '—'; });
  ctl.offViewClear = async () => { await regCacheDrop('darkon-tiles'); showToast('האריחים שנשמרו מצפייה נוקו'); redrawSoon(); };
}
ctlActs('offSet', ['offViewClear', 'offrm']);
setTimeout(() => { try { offInit(); } catch (e) {} }, 0);

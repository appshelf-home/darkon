// ================= 📥 MAPS WITHOUT NETWORK - THE DRAWING (moved from offline-maps.js, 23.11.2026, task off-frame: the part passed the 60 KB light) =================
// ---- drawing: a canvas layer under the tile layers, only when there is no network ----
function offFindTile(z, x, y, zMin) { for (let k = Math.min(z, 14); k >= (zMin || 0); k--) { const d = z - k, key = `${k}/${x >> d}/${y >> d}`; if (OFF_KEYS.has(key)) return { z: k, x: x >> d, y: y >> d, key }; } return null; }
async function offLayersOf(key) { if (OFF_DEC.has(key)) return OFF_DEC.get(key);
  const v = await offTx('tiles', 'readonly', st => st.get(key)).catch(() => null); let L = null;
  try { if (v && v.b) L = mvtLayers(new Uint8Array(v.b), OFF_LAYERS); } catch (e) { L = null; }
  OFF_DEC.set(key, L); if (OFF_DEC.size > 40) OFF_DEC.delete(OFF_DEC.keys().next().value); return L; }
const OFF_ROAD = { motorway: ['#E892A2', 4], trunk: ['#F9B29C', 3.6], primary: ['#FCD6A4', 3.2], secondary: ['#F7FABF', 2.6], tertiary: ['#FFFFFF', 2.2], minor: ['#FFFFFF', 1.6], service: ['#FFFFFF', 1.1], track: ['#C8A97E', 0.8], path: ['#C8A97E', 0.8] };
// hebrew-map: the drawing's colours as one style object - the offline map, the trip picture and a page's map draw OFF_STYLE (light); the live
// "מפה בעברית" passes its own (heStyle: the --vmap-* tokens, light or dark) - same shapes, same rules, only the colours change
const OFF_STYLE = { land: '#F2EFE9', wood: '#D3E5C2', grass: '#E3EDD3', sand: '#F3E7C3', ice: '#F4F8FB', cemetery: '#D6E3CF', civic: '#F0E6E0', pitch: '#D9EBC9', residential: '#EDE8E0',
  park: '#CDE6B8', water: '#AAD3DF', aeroway: '#E4E0EA', building: '#E2DDD5', boundary: '#9E85B8', casing: '#C9C0B1', tunnel: '#EEEAE2', rail: '#8E8E8E',
  road: Object.fromEntries(Object.entries(OFF_ROAD).map(([k, v]) => [k, v[0]])), label: '#4A4A4A', halo: 'rgba(255,255,255,.9)' };
// 7.1.0: the drawing itself is shared by the offline map layer and the trip picture's "🗺️ מפה" (one vector style, ש7)
const OFF_LAYERS = ['water', 'waterway', 'landcover', 'landuse', 'park', 'transportation', 'building', 'place', 'boundary', 'aeroway'];
async function offDrawTile(cv, co, r, pass, st) { // hebrew-map: pass and style as offDrawLayers (the live Hebrew map draws a downloaded area too)
  const src = offFindTile(co.z, co.x, co.y); if (!src) return false; const L = await offLayersOf(src.key); if (!L) return false;
  const ctx = cv.getContext('2d'), size = 256 * r, sc = 2 ** (co.z - src.z), ox = co.x - src.x * sc, oy = co.y - src.y * sc;
  ctx.fillStyle = (st || OFF_STYLE).land; ctx.fillRect(0, 0, size, size);
  offDrawLayers(ctx, L, -ox * size, -oy * size, size * sc, co.z, r, pass, st); return true; }
// one vector tile's layers drawn into the square [px, px+ds] × [py, py+ds]; zf = the zoom it is seen at (what shows, line widths);
// pass: 'areas' | 'lines' | 'labels' (a picture of many tiles draws each pass over all tiles, so no tile covers its neighbour's lines)
function offDrawLayers(ctx, L, px, py, ds, zf, r, pass, st) {
  const W = ctx.canvas.width, H = ctx.canvas.height, S = st || OFF_STYLE;
  const draw = (lyr, pick, how) => { const ly = L[lyr]; if (!ly) return; const E = ly.extent, k = ds / E; ctx.setTransform(k, 0, 0, k, px, py);
    ly.feats.forEach(f => { const st = pick(f.props, f.type); if (!st) return; ctx.beginPath(); f.rings.forEach(rg => { rg.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); });
      if (how === 'fill') { ctx.fillStyle = st; ctx.fill('evenodd'); } else { ctx.strokeStyle = st[0]; ctx.lineWidth = st[1] * r * (zf >= 16 ? 1.8 : zf >= 15 ? 1.35 : zf >= 13 ? 1 : zf >= 11 ? 0.7 : 0.5) / k; ctx.setLineDash(st[2] ? st[2].map(v => v * r / k) : []); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(); } });
    ctx.setLineDash([]); ctx.setTransform(1, 0, 0, 1, 0, 0); };
  if (!pass || pass === 'areas') {
    draw('landcover', p => p.class === 'wood' ? S.wood : p.class === 'grass' || p.class === 'farmland' ? S.grass : p.class === 'sand' ? S.sand : p.class === 'ice' ? S.ice : '', 'fill');
    draw('landuse', p => /^(cemetery)$/.test(p.class) ? S.cemetery : /^(hospital|school|university|college)$/.test(p.class) ? S.civic : /^(stadium|pitch)$/.test(p.class) ? S.pitch : /^(residential)$/.test(p.class) && zf < 14 ? S.residential : '', 'fill');
    draw('park', () => S.park, 'fill');
    draw('water', () => S.water, 'fill');
    draw('aeroway', (p, t) => t === 3 ? S.aeroway : '', 'fill');
    if (zf >= 14) draw('building', () => S.building, 'fill'); }
  if (!pass || pass === 'lines') {
    draw('waterway', p => [ S.water, p.class === 'river' ? 3 : p.class === 'canal' ? 2 : 1 ], 'line');
    draw('boundary', p => Number(p.admin_level) <= 4 && !p.maritime ? [S.boundary, Number(p.admin_level) === 2 ? 1.6 : 0.9, [6, 4]] : '', 'line');
    const roadOk = p => { const c = p.class; if (c === 'path' || c === 'track') return zf >= 15; if (c === 'service') return zf >= 15; if (c === 'minor') return zf >= 13; if (c === 'tertiary') return zf >= 11; return true; };
    draw('transportation', p => OFF_ROAD[p.class] && roadOk(p) && p.brunnel !== 'tunnel' ? [S.casing, OFF_ROAD[p.class][1] + 1.4] : '', 'line');
    draw('transportation', p => OFF_ROAD[p.class] && roadOk(p) ? [p.brunnel === 'tunnel' ? S.tunnel : S.road[p.class], OFF_ROAD[p.class][1]] : '', 'line');
    draw('transportation', p => (p.class === 'rail' || p.class === 'transit') && p.brunnel !== 'tunnel' ? [S.rail, 1, [4, 3]] : '', 'line'); }
  if (!pass || pass === 'labels') {
    const pl = L.place; if (pl) { const E = pl.extent, k = ds / E, cls = { country: [15, 700, 0], state: [12, 600, 4], city: [14, 700, 4], town: [12.5, 600, 9], village: [11, 500, 12], suburb: [11.5, 500, 12], quarter: [10.5, 400, 14], neighbourhood: [10.5, 400, 14], hamlet: [10, 400, 15], island: [11, 500, 11] };
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      pl.feats.forEach(f => { const c = cls[f.props.class], nm = vtName(f.props), q = f.rings[0] && f.rings[0][0]; if (!c || !nm || !q || zf < c[2]) return;
        const x = px + q[0] * k, y = py + q[1] * k; if (x < 0 || y < 0 || x >= W || y >= H || q[0] < 0 || q[1] < 0 || q[0] >= E || q[1] >= E) return;
        ctx.font = `${c[1]} ${c[0] * r}px Rubik, Arial, sans-serif`; ctx.direction = /[\u0590-\u05FF]/.test(nm) ? 'rtl' : 'ltr'; ctx.lineWidth = 3 * r; ctx.strokeStyle = S.halo; ctx.strokeText(nm, x, y); ctx.fillStyle = S.label; ctx.fillText(nm, x, y); }); } }
}
function offLayerFor(map) {
  if (!window.L || !L.GridLayer || map._offLayer) return;
  const Lyr = L.GridLayer.extend({ createTile(co, done) { const c = document.createElement('canvas'), r = Math.min(2, window.devicePixelRatio || 1); c.width = c.height = 256 * r; c.style.width = c.style.height = '256px';
    if (svcOnline() || !OFF_KEYS.size) { setTimeout(() => done(null, c), 0); return c; }
    offDrawTile(c, co, r).then(() => done(null, c), () => done(null, c)); return c; } });
  map._offLayer = new Lyr({ zIndex: 0, maxZoom: 22, attribution: OFF_KEYS.size ? svcCredit('openfreemap') : '' }).addTo(map);
  offBadge(map); map.on('moveend zoomend', () => offBadgeUpdate(map)); }
function offRefreshMaps() { if (typeof LIVE_MAPS === 'undefined') return; LIVE_MAPS.forEach(m => { try { if (!m.getContainer().isConnected) return; if (!m._offLayer) offLayerFor(m); else m._offLayer.redraw(); offBadgeUpdate(m); } catch (e) {} }); }
act('map.offInfo', c => showToast(c.el.dataset.st === 'none' ? 'אין רשת, והאזור הזה לא הורד לטלפון. מה שכבר ראית מוצג כרגיל.' : 'אין רשת. אזורים שכבר ראית מוצגים כרגיל, והשאר מהמפה שהורדה לטיול, שהיא פשוטה יותר. כשתחזור הרשת הכל יתעדכן.'));
function offBadge(map) { if (map._offBadge || !L.control) return; const C = L.Control.extend({ onAdd() { const b = L.DomUtil.create('button', 'off-badge'); b.type = 'button'; b.hidden = true; b.dataset.act = 'map.offInfo'; mapCtl(b); return b; } });
  map._offBadge = new C({ position: 'topleft' }).addTo(map); offBadgeUpdate(map); }
function offBadgeUpdate(map) { const b = map && map._offBadge && map._offBadge.getContainer(); if (!b) return;
  if (svcOnline() || !Object.keys(OFF_PACKS).length) { b.hidden = true; return; }
  let st = 'none'; try { const z = Math.round(map.getZoom()), c = map.getCenter(), [x, y] = offTileXY(c.lat, c.lng, Math.min(z, 14)); if (offFindTile(Math.min(z, 14), x, y, Math.min(z, 8))) st = 'saved'; } catch (e) {}
  b.hidden = false; b.dataset.st = st; b.innerHTML = msi('cloud_off', { size: 18 }) + (st === 'saved' ? ' מפה שמורה' : ' האזור הזה לא הורד'); // 10.15.0 (F19)
  if (st === 'saved' && !DEV.offTipSeen) { devSet({ offTipSeen: true }); setTimeout(() => b.click(), 600); } }
svcOnBack(() => { offRefreshMaps(); const p = OFF_PACKS[STATE.activeTrip]; if (p && p.status === 'paused' && !OFF_RUN) setTimeout(() => offResume(p.trip), 3000); });
sysOn(window, 'offline', () => offRefreshMaps());


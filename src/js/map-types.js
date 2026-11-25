// ================= MAP TYPES (4.16.0) =================
// One choice for every map on this device: 🗺️ map (OpenStreetMap), 🛰️ satellite (Esri World Imagery), 🛰️ satellite with
// place names, ⛰️ topographic (OpenTopoMap: contour lines, peaks and heights). With a free Esri key in ⚙️ הגדרות the
// satellite comes through the person's own key; without one, through the app's own key (legal-server, 11.41.0).
// ⛰️ "מפה עם תבליט" is the regular map with the relief drawn on the phone from Mapterhorn's terrain tiles (relief-phone: reliefLayer, map-tools.js).
// legal-server (11.41.0; decisions 2026-11-21 · Review of the legal-review report, Q9): Esri's layers (satellite and its names) are asked
// only through Esri's keyed services, never the keyless public endpoint - with the app's ArcGIS Location Platform key (a public-application key by
// design: Basemaps privilege only, no item access, restricted to the site's two addresses; renewed yearly - the shelf's reminder) or the person's
// own key when it works. Esri's terms forbid storing its data (Master Agreement 3.2(c)), so its hosts are out of the worker's tile cache
// (PROVIDERS.esri.noCache); a static picture with the credit is allowed (3.2(b)). The secret scanner lists this exact value (shared/docs/secrets.json).
const ESRI_SITE_KEY = 'AAPTa6YUhfnI-Oxx6Gz9J59etvA..K5Za8hwZdHU6lV5IsrD-xUB7X4mCW4W-tXeeKceoF8yed8uReNwfM4jg-a_Y98vQ9qmvOvtpxyiKSelyQz7ss--bXBmhqLcVhDaGHg06oIaNKyDFfwBwrNW-ZaaXhhFE4vyP1mzKGXLlr55v4R1IbySUskQYMW6nM5BJllmCBM-4a-6pq2rO7q_IewWy8nxr0rdExCHFhpcqs3tXK_9mlnR76nGpdPQfSvrbvH9Vb6p7iBVSXx-6H9JW_OLG9w..AT1_09Iyg0Hu';
function esriKey() { const own = DEV.esriKeyOk === false ? '' : String(DEV.esriKey || '').trim(); return own || ESRI_SITE_KEY; } // 4.16.1: a key that failed its check is not used
const ESRI_ATTR = svcCredit('esri'); // 7.1.0: from the provider's row
// the satellite picture under 🛰️ (with names on top of it) - not a map type of its own since 5.9.0 (מ5)
const SAT_IMAGERY = k => [['https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?token=' + encodeURIComponent(k || ESRI_SITE_KEY), { attribution: ESRI_ATTR, cr: svcCreditText('esri'), maxZoom: 19, maxNativeZoom: 18 }]];
// legal-credits: each layer carries its screen credit (attribution, with links) and its picture credit (cr: plain text, the address to print) - both from the provider's row
// (S10) the live map inside a file sent to friends has no page address, so its "מפה" is OpenFreeMap's vector tiles (fmapVecLayer), never OSM's tiles
const OFM_VEC = 'ofm:vector';
const RELIEF_LYR = 'mapterhorn:relief'; // relief-phone: the relief layer drawn on the phone (reliefLayer)
const BASE_MAPS = {
  osm: { label: 'מפה', sub: 'רחובות, מקומות ושמות', layers: () => typeof FMAP_PAGE !== 'undefined' ? [[OFM_VEC, { attribution: svcCredit('openfreemap'), cr: svcCreditText('openfreemap', { print: true }), maxZoom: 19 }]]
    : [[svcTileUrl('osm'), { attribution: svcCredit('osm', { fix: true }), cr: svcCreditText('osm', { print: true }), maxZoom: 19 }]] }, // 7.1.0: the exact address and attribution from the provider's row; legal-credits: with "לתקן את המפה" (S11)
  // hebrew-map (decisions 2026-11-21 · Review of the map upgrades, Q7): the app's own drawing of OpenFreeMap's vector tiles, names in Hebrew where the map has them (js/hebrew-map.js)
  he: { label: 'מפה בעברית', sub: 'שמות בעברית איפה שיש להם שם בעברית', layers: () => [[HE_VEC, { attribution: svcCredit('openfreemap'), cr: svcCreditText('openfreemap', { print: true }), maxZoom: 19 }], [HE_LBL, {}]] },
  relief: { label: 'מפה עם תבליט', sub: 'המפה הרגילה עם נפח של הרים ועמקים', layers: () => BASE_MAPS.osm.layers().concat([[RELIEF_LYR, { attribution: svcCredit('mapterhorn'), cr: svcCreditText('mapterhorn', { print: true }), maxZoom: 19 }]]) }, // 4.31.0; relief-phone: drawn on the phone (reliefLayer), credit "© Mapterhorn" from its row
  hybrid: { label: 'לוויין', sub: 'צילום אוויר עם רחובות ושמות', layers: k => SAT_IMAGERY(k).concat([['https://static-map-tiles-api.arcgis.com/arcgis/rest/services/static-basemap-tiles-service/v1/arcgis/imagery/labels/static/tile/{z}/{y}/{x}?token=' + encodeURIComponent(k || ESRI_SITE_KEY), { attribution: svcCredit('esri', { as: 'labels' }), cr: svcCreditText('esri', { as: 'labels' }), maxZoom: 19, maxNativeZoom: 18 }]]) }, // legal-credits-2 (S1): the labels layer names its own providers
  topo: { label: 'טופוגרפית', sub: 'קווי גובה, פסגות וגובהן, לטבע ולהרים', layers: () => [[svcTileUrl('opentopomap'), { attribution: svcCredit('opentopomap', { give: true }), cr: svcCreditText('opentopomap', { print: true }), abc: svcTileHost, maxZoom: 19, maxNativeZoom: 17 }]] }, // 7.1.0: from the provider's row (with the donation link); legal-credits: its published letter hosts ({abc})
};
const BASE_MAP_MS = { osm: 'map', he: 'translate', relief: 'landscape', hybrid: 'satellite_alt', topo: 'terrain' };
const LIVE_MAPS = new Set();
svcOnBack(() => LIVE_MAPS.forEach(m => { try { if (m.getContainer().isConnected) (m._baseLayers || []).forEach(l => { l._rt = 0; l._bad = false; l.redraw(); }); } catch (e) {} })); // 4.38.1
// round6-behaviour (G118): a layer whose tiles failed or were drawn blank for want of an answer (l._bad: a tile error, "מפה בעברית" or the relief
// with no answer) is drawn again every 15 s while its map is on the page and the phone says it is online, after the map's providers' "not reached"
// window ends (svcMapWake) - the phone in a lift says online with no signal, so no 'online' event comes; the same when the app is shown again
// round6-behaviour (G118): the phone can say it is online with no signal (a lift) - its providers are "not reached" for 30 s → 2 → 5 min and no
// 'online' event ends that. A map whose tiles failed asks again (mapHeal, every 15 s while it shows failed tiles, and on a map type change):
// first the window of the map's providers ends - at most once in 10 s each (force: at once) - so the map comes back by itself with the signal
function svcMapWake(force) { if (svcNetDown()) return; const now = svcT();
  ['screenTiles', 'heMap', 'relief'].flatMap(s => SERVICES[s].providers).forEach(p => { const P = SVC.p[p]; if (!P || !P.downUntil || (!force && now - (P.woke == null ? -Infinity : P.woke) < 10e3)) return; P.woke = now; P.downUntil = 0; }); }
const MAP_HEAL = { t: 0 }; // the one waiting heal
function mapTilesBad(l) { l._bad = true; if (!MAP_HEAL.t) MAP_HEAL.t = setTimeout(mapHeal, 15000); }
function mapHeal() { clearTimeout(MAP_HEAL.t); MAP_HEAL.t = 0; if (svcNetDown()) return; // with no network the 'online' hook above draws them again
  const bad = []; LIVE_MAPS.forEach(m => { try { if (m.getContainer().isConnected && (m._baseLayers || []).some(l => l._bad)) bad.push(m); } catch (e) {} });
  if (!bad.length) return; svcMapWake(); bad.forEach(m => (m._baseLayers || []).forEach(l => { l._bad = false; l._rt = 0; try { l.redraw(); } catch (e) {} })); }
sysOn(document, 'visibilitychange', () => { if (document.visibilityState === 'visible') mapHeal(); });
// legal-credits (S10): "מפה" inside a file sent to friends - OpenFreeMap's vector tiles drawn in the offline map's style (offDrawLayers), a tile above
// the provider's top zoom drawn from its parent; the tiles come through the page's one loader (svcPageVecTile)
function fmapVecLayer(o) { return vecGridLayer(o, svcPageVecTile, (ctx, T, ox, oy, ds, z, r) => { ctx.fillStyle = OFF_STYLE.land; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height); offDrawLayers(ctx, T.L, ox, oy, ds, z, r); }); }
// hebrew-map: the one vector grid layer - get(z, x, y) gives the vector tile holding a screen tile ({ z, x, y, L }, maybe its parent, or null),
// paint(ctx, T, ox, oy, ds, z, r) draws it into the tile's canvas; a failure goes to the layer's own retry (tileerror, addBaseTiles)
function emptyLayer(o) { return L.tileLayer('', o || {}); } // a library with no grid layers (the tests' stub): an empty layer
function vecGridLayer(o, get, paint) { if (!L.GridLayer) return emptyLayer(o);
  const Lyr = L.GridLayer.extend({ createTile(co, done) { const c = document.createElement('canvas'), r = Math.min(2, window.devicePixelRatio || 1), size = 256 * r; c.width = c.height = size; c.style.width = c.style.height = '256px';
    get(co.z, co.x, co.y).then(T => { if (T && T.stale) mapTilesBad(this); if (T && T.L) { const sc = 2 ** (co.z - T.z); paint(c.getContext('2d'), T, -(co.x - T.x * sc) * size, -(co.y - T.y * sc) * size, size * sc, co.z, r); } done(null, c); }, e => done(e || new Error('tile'), c)); return c; } });
  return new Lyr({ attribution: o.attribution, maxZoom: o.maxZoom || 19, className: o.className || '' }); }
function baseMapId() { const v = DEV.baseMap; return BASE_MAPS[v] ? v : 'osm'; }
// hebrew-map: addBaseTiles puts the map's type on its box (data-base: the dark filter of "מפה" in dark mode, css/maps.css) and the phone's choice to keep it light
// (mapLightSync); the type menu leaves "מפה בעברית" out of a page sent to friends (FMAP_PAGE)
function addBaseTiles(map) {
  (map._baseLayers || []).forEach(l => { try { map.removeLayer(l); } catch (e) {} });
  const k = esriKey(), id = baseMapId(); // 4.16.1: a key that failed its check is not used (legal-server: then the app's own key)
  map._baseLayers = BASE_MAPS[id].layers(k).map(([u, o]) => (u === OFM_VEC ? fmapVecLayer(o) : u === HE_VEC ? heMapLayer(o) : u === HE_LBL ? heLabelLayer() : u === RELIEF_LYR ? (L.GridLayer ? reliefLayer(o) : emptyLayer(o)) : L.tileLayer(u, o)).addTo(map)); map._baseId = id;
  try { map.getContainer().dataset.base = id; } catch (e) {} mapLightSync();
  LIVE_MAPS.add(map); try { reliefLine(map); } catch (e) {} // relief-phone: the line "התבליט לא זמין כרגע" follows the map type
  try { offLayerFor(map); } catch (e) {} // 4.39.0: the downloaded map, under the tiles, when there is no network
  // 4.38.1: tiles that failed (a network that is still waking up after the app was away) are tried again, up to 3 times;
  // Leaflet itself never retries, and the map stayed with dots only until something redrew it
  map._baseLayers.forEach(l => { try { l.on('tileerror', () => { mapTilesBad(l); if ((l._rt || 0) >= 3) return; clearTimeout(l._rtT);
    l._rtT = setTimeout(() => { l._rt = (l._rt || 0) + 1; try { if ((map._baseLayers || []).includes(l) && map.getContainer().isConnected) l.redraw(); } catch (e) {} }, 1500 * ((l._rt || 0) + 1)); });
    l.on('load', () => { l._rt = 0; }); } catch (e) {} });
  // 4.38.1: a map drawn while its box had no size yet (a screen built before the page was laid out) gets its real size
  if (window.ResizeObserver && !map._ro) { try { const c = map.getContainer(); map._ro = new ResizeObserver(() => { if (!c.isConnected) { map._ro.disconnect(); return; } try { map.invalidateSize(); } catch (e) {} }); map._ro.observe(c); } catch (e) {} }
  if (!map._scaled && L.control && L.control.scale) { try { L.control.scale({ imperial: false, position: 'topleft' }).addTo(map); } catch (e) {} map._scaled = true; } // a scale bar on every map
  return map._baseLayers[0];
}
// 4.16.1: the key is checked by loading one satellite tile with it; only a key that works is used (else the app's own key - legal-server)
function esriKeyStatusText() {
  const st = DEV; if (!String(st.esriKey || '').trim()) return 'בלי מפתח משלכם: הלוויין עובר דרך המפתח של האפליקציה.';
  if (st.esriKeyOk === true) return `✓ המפתח עובד (נבדק ${st.esriKeyAt ? tmFmt('date', st.esriKeyAt) : ''}). הלוויין עובר דרכו.`;
  if (st.esriKeyOk === false) return 'המפתח לא עובד (פג, שגוי, או בלי הרשאת Basemaps). הלוויין ממשיך דרך המפתח של האפליקציה. אפשר להדביק מפתח חדש.';
  return 'המפתח עוד לא נבדק (נבדק כשיש רשת).';
}
function checkEsriKey() {
  const k = String(DEV.esriKey || '').trim(), show = () => { const el = document.getElementById('esriKeyStatus'); if (el) el.textContent = esriKeyStatusText(); };
  show(); if (!k) return Promise.resolve(null);
  // 7.1.0: one satellite tile through the client (service "בדיקת מפתח Esri"); no network - checked when it is back
  return svcAsk('esriCheck', { key: 'esri:' + k, build: prov => prov === 'esri' ? { url: 'https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/2/1/2?token=' + encodeURIComponent(k), as: 'img', ms: 15000 } : null, parse: d => d }).then(r => {
    if (r.kind === 'offline' || String(DEV.esriKey || '').trim() !== k) return null; const ok = r.kind === 'ok';
    devSet({ esriKeyOk: ok, esriKeyAt: Date.now() }); hAbsorb([hKey(['v', 'esriKeyOk']), hKey(['v', 'esriKeyAt'])]); refreshBaseMaps(); show(); // undo-history: the check's result is the app's own finding, not a change - kept out of the next row
    if (!document.getElementById('esriKeyStatus')) showToast(ok ? '✓ מפתח Esri עובד - הלוויין עובר דרכו' : SY.warn + ' מפתח Esri לא עובד - הלוויין ממשיך דרך המפתח של האפליקציה'); return ok; }); // undo-history: in ⚙️ the status line says it - the key's undo toast stays
}
function setBaseMap(id, silent) {
  if (baseMapId() === id) return; // undo-history: the map shown already is not a change (no empty row)
  devSet({ baseMap: id }); refreshBaseMaps();
  if (!silent) showUndoToast(BASE_MAPS[id].label);
}
function mapLightSync() { document.documentElement.toggleAttribute('data-maplight', !!DEV.mapLight); } // hebrew-map: settings › "מפה כהה במצב כהה" off
function refreshBaseMaps() { mapLightSync(); svcMapWake(true); // round6-behaviour (G118): a type chosen asks its tiles now, not after a "not reached" window
  LIVE_MAPS.forEach(m => { const c = m.getContainer && m.getContainer(); if (!c || !c.isConnected || m._removed) { LIVE_MAPS.delete(m); return; } addBaseTiles(m); });

  if (document.getElementById('setBaseMaps')) document.querySelectorAll('[data-basemap]').forEach(b => b.dataset.active = String(b.dataset.basemap === baseMapId()));
}
// 6.1.0: the map's own buttons (map type, ⛶, 📏 and its bar, ◎, the status pill) are actions like any other; the map library stops
// their clicks from reaching the page (so a tap on a button is not a tap on the map), so the map component hands them to the
// mechanism itself - one bridge for every map, not a listener per button
function mapCtl(el) {
  if (L.DomEvent && L.DomEvent.disableClickPropagation) L.DomEvent.disableClickPropagation(el);
  el.addEventListener('click', e => { const a = e.target.closest('[data-act]'); if (!a || !el.contains(a) || actOff(a)) return; e.stopPropagation(); runAct(a, e); });
}
function addLayerBtn(host) { // the map-type button and its small menu, inside a map's own corner
  if (!host || host.querySelector(':scope > .ly-btn')) return;
  const b = document.createElement('button'); b.type = 'button'; b.className = 'ly-btn'; b.innerHTML = msi('layers'); // 10.3.0 (design-3): one column of line-icon buttons
  b.title = 'סוג המפה'; b.setAttribute('aria-label', 'סוג המפה'); b.dataset.act = 'map.typeMenu';
  host.appendChild(b); mapCtl(b);
}
act('map.typeMenu', c => { const b = c.el, host = b.parentElement;
  const old = host.querySelector(':scope > .ly-menu'); if (old) { old.remove(); return 'quiet'; }
  const m = document.createElement('div'); m.className = 'ly-menu'; m.setAttribute('role', 'menu');
  // 10.5.0 (design-4 part 2, look.md "Maps"): a Material menu - each type its line icon, the name and its line, the current one checked
  const shown = Object.entries(BASE_MAPS).filter(([k]) => typeof FMAP_PAGE === 'undefined' || (k !== 'he' && k !== 'relief')); // a page for people: no "מפה בעברית" (hebrew-map), no relief (relief-phone)
  // 3d-find: "תלת־ממד" the last row on the maps that have it (m3Row, js/map-full-screen.js); while it is shown it is the one checked
  const r3 = m3Row(host.id) || '', cur = /data-active="true"/.test(r3) ? '3d' : baseMapId();
  m.innerHTML = shown.map(([k, v]) => `<button type="button" role="menuitemradio" aria-checked="${k === cur}" data-act="map.type" data-v="${k}" data-active="${k === cur}">${msi(BASE_MAP_MS[k] || 'map', { cls: 'ly-ic' })}<span class="ly-t"><b>${v.label}</b><small>${v.sub || ''}</small></span>${k === cur ? msi('check', { cls: 'ly-ck' }) : ''}</button>`).join('') + r3;
  host.appendChild(m); mapCtl(m);
  setTimeout(() => touchAny('down', function off(ev) { if (!m.contains(ev.target) && ev.target !== b) { m.remove(); touchAny('down', off, false); } }), 0); // a tap elsewhere closes it
  return 'quiet'; });
act('map.type', c => { c.el.closest('.ly-menu').remove(); m3Close(); setBaseMap(c.v); return 'quiet'; }); // the maps redraw their tiles themselves; 3d-find: a type chosen in 3D returns to the 2D map
// 4.16.0: height above sea level (Open-Meteo, Copernicus DEM ~90 m). Asked once per point and kept on the device.
function elevCache() { return regRead('elev'); }
function elevKey(c) { return (+c.lat).toFixed(4) + ',' + (+c.lng).toFixed(4); }
function knownElev(c) { if (!c) return null; const v = elevCache()[elevKey(c)]; return typeof v === 'number' ? v : null; }
async function fetchElev(c) { // 7.1.0: one height = the same service as many (elevMany)
  if (!c) return null; const k = elevKey(c), cache = elevCache(); if (typeof cache[k] === 'number') return cache[k];
  await elevMany([c]); const v = elevCache()[k]; return typeof v === 'number' ? v : null;
}
function fmtElev(v) { return v == null ? '' : `${msi('elevation', { cls: 'msi-in' })} ${fmtM(v)}`; } // 10.15.0 (design-review Q11): a field mark - elevation (HTML)
// legal-credits (S6; Open-Meteo's terms: CC BY 4.0): a height shown carries Open-Meteo's credit - once, after the row that holds it
function elevCredit(el) { const row = el.parentElement; if (!row || row.querySelector('.elev-cr') || (row.nextElementSibling && row.nextElementSibling.classList.contains('elev-cr'))) return;
  row.insertAdjacentHTML(row.classList.contains('meta-row') ? 'afterend' : 'beforeend', `<small class="elev-cr">${svcCredit('openmeteo', { as: 'elev' })}</small>`); }
function fillElev(root) { // <span data-elev="lat,lng"> placeholders get their height when it arrives
  (root || document).querySelectorAll('[data-elev]:not([data-elevdone])').forEach(el => { el.dataset.elevdone = '1'; const [lat, lng] = el.dataset.elev.split(',').map(Number);
    const min = Number(el.dataset.elevmin || -1e9), show = v => { if (v != null && v >= min) { el.innerHTML = fmtElev(v) + escH(el.dataset.elevsuffix || ''); el.hidden = false; elevCredit(el); } };
    const k = knownElev({ lat, lng }); if (k != null) show(k); else fetchElev({ lat, lng }).then(show); });
}
function streetViewUrl(c) { return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${(+c.lat).toFixed(6)},${(+c.lng).toFixed(6)}`; }


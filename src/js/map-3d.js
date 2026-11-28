// ================= map-3d: THE TILTED 3D MAP - the engine, the style, the trip on it, open and close (special-maps group; split from map-full-screen.js in diet-groups, 11.62.0 - the menu's row m3Row, why it is not offered and the state M3 stay there, in the main script) =================
const M3_LIB = { js: './maplibre/maplibre-gl-4.7.1.js', css: './maplibre/maplibre-gl-4.7.1.css', rtl: './maplibre/mapbox-gl-rtl-text-0.2.3.min.js',
  jsSri: 'sha384-SYKAG6cglRMN0RVvhNeBY0r3FYKNOJtznwA0v7B5Vp9tr31xAHsZC0DqkQ/pZDmj', cssSri: 'sha384-MinO0mNliZ3vwppuPOUnGa+iq619pfMhLVUXfC4LHwSCvF9H+6P/KO4Q7qBOYV5V' }; // Subresource Integrity: the files exactly as npm ships them (tests check)
const M3_STYLE = 'https://tiles.openfreemap.org/styles/liberty'; // OpenFreeMap's style: its sources, glyphs and sprite (with 3D buildings, building-3d)
const M3_NOTE = 'm3.note'; // the one-time note (DEV.hints)
act('map.3d', c => { const m = c.el.closest('.ly-menu'), host = m.parentElement, id = host.id; m.remove(); if (M3.id === id) return 'quiet'; // already shown
  const why = m3Why(); if (why) { showToast(why); return 'quiet'; }
  if (!FS || FS.id !== id) enterFS(id, 'btn'); // from a small map: its full screen first, then 3D
  if (!hintSeen(M3_NOTE)) { m3Note(id); return 'quiet'; } m3Open(id); return 'quiet'; });
// the note on its cost (the owner): once, at the first open; the same words in the guide's maps chapter
const M3_NOTE_LINES = ['צריך רשת: כל מבט מוריד כמה מגה-בייט של מפה וגבהים.', 'כבד יותר על הסוללה ועל הטלפון מהמפה הרגילה.', 'שום דבר ממנה לא נשמר בטלפון לשימוש בלי רשת, מלבד המטמון הרגיל של הדפדפן.', 'שתי אצבעות מטות ומסובבות; הכפתור עם המצפן מסובב את המפה לצפון למעלה, וההטיה נשארת.'];
function m3Note(id) { layerNote(m3Note, arguments); M3.pend = id; const sheet = document.getElementById('sheet');
  sheet.innerHTML = `${fmHead(`${msi('view_in_ar', { cls: 'head-ic' })} מפה בתלת־ממד`)}<p>ההרים, העמקים והבניינים בנפח, והמקומות והמסלול של הטיול עליהם.</p>
    <ul class="m3-note">${M3_NOTE_LINES.map(t => `<li>${t}</li>`).join('')}</ul>
    <div class="brow sheet-save-bar"><button type="button" class="btn-nav" data-act="m3.noteOk">הבנתי</button></div>`;
  showSheetBackdrop('m3Note'); }
act('m3.noteOk', () => { hintMark(M3_NOTE); const id = M3.pend; M3.pend = null; closeSheet(); if (id && FS && FS.id === id) setTimeout(() => m3Open(id), 0); return 'quiet'; });
// the engine: once per session, from the site, never before the first tap
function m3Load() { if (window.maplibregl && M3.st === 'ok') return Promise.resolve(true); if (M3.ready) return M3.ready;
  M3.st = 'loading';
  M3.ready = new Promise(res => svcLibrary(M3_LIB.js, M3_LIB.css, ok => { ok = ok && !!window.maplibregl; M3.st = ok ? 'ok' : 'idle'; if (!ok) M3.ready = null;
    if (ok) { try { maplibregl.addProtocol('m3', m3Proto); } catch (e) {} // every tile, height and glyph through the one client
      try { maplibregl.setRTLTextPlugin(new URL(M3_LIB.rtl, location.href).href, true).catch(() => {}); } catch (e) {} } // lazy: asked only when Hebrew is drawn; a failure never stops the map
    res(ok); }, { js: M3_LIB.jsSri, css: M3_LIB.cssSri }));
  return M3.ready; }
// the style: OpenFreeMap's through the one client (kept for the session), its vector source the tiles of the app's own TileJSON (vtTemplate),
// coloured by the tokens, names Hebrew-first, the terrain and the trip
function m3StyleRaw() { if (M3.raw) return Promise.resolve(M3.raw);
  return Promise.all([svcAsk('map3d', { key: 'style', build: prov => prov === 'openfreemap' ? { url: M3_STYLE, as: 'json', ms: 15000 } : null, parse: j => { if (!j || !j.layers || !j.sources) throw new Error('style'); return j; } }), vtTemplate()])
    .then(([r, T]) => { if (r.kind !== 'ok') throw new Error('style ' + r.kind); const st = r.value;
      Object.keys(st.sources).forEach(k => { const s = st.sources[k]; if (s.type === 'vector') { delete s.url; s.tiles = [T.t]; s.maxzoom = T.max; } }); return (M3.raw = st); }); }
// the engine asks its tiles, heights and glyphs as m3://<host>/<path> (m3Via): the page answers each through the one client - the provider's
// queue (OpenFreeMap: 4 at once), its counts and its "down"; the engine's own fetch (in its worker) never reaches the outside
function m3Via(u) { return typeof u === 'string' && u.startsWith('https://') ? 'm3://' + u.slice(8) : u; }
function m3Proto(params) { const u = 'https://' + String(params.url).replace(/^m3:\/\//, ''), mh = u.startsWith('https://' + PROVIDERS.mapterhorn.hosts[0] + '/');
  return svcAsk('map3d', { key: u, build: prov => prov === (mh ? 'mapterhorn' : 'openfreemap') ? { url: u, as: 'bytes', empty404: true, ms: 20000 } : null, parse: d => mh ? d : vtUnzip(d) }) // OpenFreeMap's tiles can come still gzipped (as the offline maps read them)
    .then(r => { if (r.kind === 'ok') { const b = r.value; return { data: b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) }; }
      if (r.kind === 'empty' && !mh) return { data: new ArrayBuffer(0) }; // a vector tile with nothing in it
      throw new Error(r.kind); }); } // a height tile that is not there is the open sea (flat), as the relief reads it
const M3_FILL = [[/park/, 'park'], [/wood/, 'wood'], [/grass/, 'grass'], [/ice/, 'ice'], [/sand/, 'sand'], [/residential/, 'residential'], [/pitch|track/, 'pitch'], [/cemetery/, 'cemetery'], [/hospital|school/, 'civic'], [/^water$/, 'water'], [/aeroway/, 'aeroway'], [/building/, 'building']];
function m3LineColor(l, S) { const id = l.id, sl = l['source-layer'];
  if (sl === 'waterway') return S.water; if (sl === 'boundary') return S.boundary; if (sl === 'park') return S.park; if (sl === 'aeroway') return S.road.minor;
  if (sl !== 'transportation') return null; if (/casing/.test(id)) return S.casing; if (/rail/.test(id)) return S.rail;
  if (/motorway/.test(id) && !/link/.test(id)) return S.road.motorway; if (/trunk_primary/.test(id)) return S.road.primary; if (/secondary_tertiary/.test(id)) return S.road.secondary;
  if (/path|pedestrian/.test(id)) return S.road.path; return S.road.minor; }
function m3Size(v, k) { if (typeof v === 'number') return Math.round(v * k * 10) / 10; // a text size, by the text size of the app (heTextScale)
  if (Array.isArray(v) && (v[0] === 'interpolate' || v[0] === 'step')) return v.map((x, i) => (v[0] === 'interpolate' ? i > 3 && i % 2 === 0 : i > 1 && i % 2 === 0) && typeof x === 'number' ? Math.round(x * k * 10) / 10 : x);
  return v; }
function m3Style(raw, trip) { const S = heStyle(), k = heTextScale(), st = JSON.parse(JSON.stringify(raw)), mh = PROVIDERS.mapterhorn;
  st.layers.forEach(l => { const p = l.paint = l.paint || {}, L2 = l.layout = l.layout || {};
    if (l.type === 'background') p['background-color'] = S.land;
    else if (l.type === 'raster') p['raster-opacity'] = S.dark ? 0.08 : 0.25;
    else if (l.type === 'fill' || l.type === 'fill-extrusion') { const f = M3_FILL.find(([re]) => re.test(l.id)); if (f && !p['fill-pattern']) { if (l.type === 'fill') { p['fill-color'] = S[f[1]]; delete p['fill-outline-color']; } else p['fill-extrusion-color'] = S[f[1]]; } }
    else if (l.type === 'line') { const c = m3LineColor(l, S); if (c) p['line-color'] = c; }
    else if (l.type === 'symbol' && L2['text-field']) { if (JSON.stringify(L2['text-field']).includes('name')) L2['text-field'] = ['coalesce', ['get', 'name:he'], ['get', 'name'], ['get', 'name:en']]; // vtName
      if (L2['text-size'] != null) L2['text-size'] = m3Size(L2['text-size'], k);
      p['text-color'] = /water/.test(l['source-layer']) ? S.waterLabel : l['source-layer'] === 'poi' ? S.poi : S.label; p['text-halo-color'] = S.halo; } });
  Object.values(st.sources).forEach(s => { if (s.tiles) s.tiles = s.tiles.map(m3Via); }); if (st.glyphs) st.glyphs = m3Via(st.glyphs);
  const dem = { type: 'raster-dem', tiles: [m3Via(mh.tiles)], tileSize: 512, maxzoom: 12, encoding: 'terrarium' }; // Q18: z12 of Mapterhorn's 512-px tiles is the data's depth (a sea tile 404s: flat)
  st.sources.m3dem = dem; st.sources.m3hs = { ...dem }; // the terrain and its hillshade from two sources, as the engine advises (and the tested page)
  st.sources.m3trip = { type: 'geojson', data: trip || { type: 'FeatureCollection', features: [] } };
  const at = st.layers.findIndex(l => l.type === 'symbol'), dash = ['==', ['get', 'd'], 1];
  st.layers.splice(at < 0 ? st.layers.length : at, 0,
    { id: 'm3-hs', type: 'hillshade', source: 'm3hs', paint: { 'hillshade-exaggeration': S.dark ? 0.55 : 0.45, 'hillshade-shadow-color': S.dark ? 'rgb(0,0,0)' : 'rgb(40,40,40)', 'hillshade-highlight-color': S.dark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.35)' } },
    { id: 'm3-case', type: 'line', source: 'm3trip', filter: ['!', dash], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': S.halo, 'line-width': ['+', ['get', 'w'], 3], 'line-opacity': ['get', 'o'] } },
    { id: 'm3-line', type: 'line', source: 'm3trip', filter: ['!', dash], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': ['get', 'c'], 'line-width': ['get', 'w'], 'line-opacity': ['get', 'o'] } },
    { id: 'm3-dash', type: 'line', source: 'm3trip', filter: dash, layout: { 'line-join': 'round' }, paint: { 'line-color': ['get', 'c'], 'line-width': ['get', 'w'], 'line-opacity': ['get', 'o'], 'line-dasharray': [2, 2] } });
  st.terrain = { source: 'm3dem', exaggeration: 1.5 };
  return st; }
// the trip on it, read from the 2D map: its lines (GeoJSON) and its pins (the 2D marker each stands for); never the measuring, 📚, bubbles or fans
const M3_SKIP = /disc-pin|clu-b|ms-pt|ms-seg|ms-ring-lbl/;
function m3Trip(map, id) { const feats = [], pins = [], seen = new Set(), meas = MEAS && MEAS.map === map ? new Set(MEAS.layers || []) : new Set();
  const pin = mk => { if (!mk || seen.has(mk) || meas.has(mk) || !mk.getLatLng) return; seen.add(mk); const ic = mk.options && mk.options.icon && mk.options.icon.options;
    if (!ic || !ic.html || M3_SKIP.test(ic.html) || mk._cluKeys) return; const ll = mk._fanOrig || mk.getLatLng(); pins.push({ mk, ll: [ll.lng, ll.lat], html: ic.html, size: ic.iconSize || [30, 30], anchor: ic.iconAnchor || [15, 15], z: mk.options.zIndexOffset || 0 }); };
  map.eachLayer(l => { if (meas.has(l)) return; if (l instanceof L.Marker) return pin(l);
    if (l instanceof L.Polyline && !/fan-leg|ms-/.test(l.options.className || '')) { const o = l.options, flat = a => (Array.isArray(a[0]) ? a : [a]).map(r => r.map(q => [q.lng, q.lat])), lls = l.getLatLngs(), parts = Array.isArray(lls[0]) ? lls : [lls];
      parts.forEach(pp => { const c = (Array.isArray(pp[0]) ? pp.flat() : pp).map(q => [q.lng, q.lat]); if (c.length > 1) feats.push({ type: 'Feature', properties: { c: o.color || '#3388ff', w: o.weight || 3, o: o.opacity == null ? 1 : o.opacity, d: o.dashArray ? 1 : 0 }, geometry: { type: 'LineString', coordinates: c } }); }); } });
  const clu = MAPS[id] && MAPS[id].clu; if (clu) clu.items.forEach(it => { if (!String(it.key).startsWith('disc:')) pin(it.m); }); // the pins a bubble holds in 2D stand on their own here
  return { lines: { type: 'FeatureCollection', features: feats }, pins }; }
function m3Pins(m3, pins, id) { return pins.sort((a, b) => a.z - b.z).map(P => { const el = document.createElement('div'); el.className = 'm3-pin'; el.append(...P.mk.options.icon.createIcon().childNodes); // the 2D pin's own markup, built by its icon
    el.style.width = P.size[0] + 'px'; el.style.height = P.size[1] + 'px';
    const mk = new maplibregl.Marker({ element: el, anchor: 'top-left', offset: [-P.anchor[0], -P.anchor[1]] }).setLngLat(P.ll).addTo(m3);
    if (P.mk.listens && P.mk.listens('click')) { el.classList.add('m3-tap'); el.dataset.act = 'm3.pin'; el._mk = P.mk; } // the one action mechanism (after the map's own click, which closed the card)
    return mk; }); }
act('m3.pin', c => { if (M3.id && c.el._mk) m3Tap(M3.id, c.el._mk, c.el); return 'quiet'; });
function m3Tap(id, mk, el) { document.querySelectorAll('.m3-pin.pin-sel').forEach(x => x.classList.remove('pin-sel')); el.classList.add('pin-sel'); mk.fire('click'); } // the 2D pin's own tap: the same floating card
// open and close
// nav-short-page item 7 (decisions 2026-11-25 · Review of diet-groups, Q1): the 3D view waits on outside services (the engine, the style, the
// tiles), so its wait is the one "in progress" component (waitOn): the moving bar on the view and the stage line in its status chip; done
// takes them off, and the chip then says the failure, or hides
function m3Wait(box) { const s = box.querySelector('.m3-st'); s.hidden = false; box._wait = waitOn(box, { line: s, stage: 'טוען תלת־ממד' }); }
function m3Status(box, t) { const s = box.querySelector('.m3-st'); if (!s) return; if (box._wait) { box._wait.done(); box._wait = null; } s.hidden = !t; s.textContent = t || ''; }
async function m3Open(id, cam) {
  const host = document.getElementById(id), r = MAPS[id]; if (!host || !r || M3.id) return; const why = m3Why(); if (why) { showToast(why); return; }
  M3.id = id; M3.l2 = r.map; M3.t0 = performance.now(); M3.last = null; closeFloatCard(id); host.classList.add('m3-on'); document.body.classList.add('m3-open');
  const box = document.createElement('div'); box.className = 'm3-box'; box.innerHTML = `<div class="m3-gl"></div><div class="m3-st" role="status"></div>
    <button type="button" class="m3-north" data-act="m3.north" aria-label="צפון למעלה" title="צפון למעלה">${msi('explore', { size: 20 })}</button>`;
  host.appendChild(box); mapCrClose(); mapCrMount(box, () => [['openfreemap'], ['mapterhorn']]); m3Wait(box); // map-credit-line: the 3D view's credits in the same line and panel as every map
  const fail = t => { if (M3.id !== id) return; m3Close(); showToast(SY.warn + ' ' + t); };
  if (!(await m3Load())) return fail('תלת־ממד לא נטען - אולי אין רשת');
  let raw; try { raw = await m3StyleRaw(); } catch (e) { return fail('תלת־ממד לא נטען - המפה לא ענתה'); }
  if (M3.id !== id || !box.isConnected) return;
  const T = m3Trip(r.map, id), c = r.map.getCenter(), z = Math.max(1, r.map.getZoom() - 1); // a 256-px zoom is a 512-px zoom less one
  let m3; try { m3 = new maplibregl.Map({ container: box.querySelector('.m3-gl'), style: m3Style(raw, T.lines), center: cam ? cam.c : [c.lng, c.lat], zoom: cam ? cam.z : z, pitch: cam ? cam.p : 60, bearing: cam ? cam.b : 0, maxPitch: 75,
    attributionControl: false, pixelRatio: Math.min(window.devicePixelRatio || 1, 2), fadeDuration: 0 }); } // Q16: at most 2 - a phone's 3x screen would more than double the buffers
  catch (e) { return fail('תלת־ממד לא נפתח בטלפון הזה'); }
  M3.map = m3; M3.trip = T.lines; LIFE.gl.add(m3); m3.__pins = m3Pins(m3, T.pins, id);
  m3.on('click', () => { if (MAPCR.host === box) mapCrClose(); closeFloatCard(id); document.querySelectorAll('.m3-pin.pin-sel').forEach(x => x.classList.remove('pin-sel')); });
  m3.on('error', e => { if (e && (e.tile || e.sourceId)) return; if (M3.map === m3 && !m3.loaded()) m3Status(box, 'תלת־ממד לא נטען'); }); // a missing tile (the sea) is no error
  m3.on('webglcontextlost', () => fail('הגרפיקה של הטלפון עצרה את התלת־ממד (זיכרון)')); // the engine's own event
  m3.once('idle', () => { if (M3.map !== m3) return; M3.last = { ms: Math.round(performance.now() - M3.t0), id }; m3Status(box, ''); });
  m3.once('load', () => { if (M3.map === m3) m3Status(box, ''); }); }
act('m3.north', () => { if (M3.map) M3.map.easeTo({ bearing: 0, duration: 500 }); return 'quiet'; }); // round6-behaviour (G105): north up, the tilt kept - a view from above has no value here
function m3Close() { const id = M3.id; if (!id) return; const m3 = M3.map; M3.id = null; M3.map = null; M3.l2 = null; M3.trip = null;
  if (m3) { (m3.__pins || []).forEach(p => { try { p.remove(); } catch (e) {} }); m3.__pins = null; try { m3.remove(); } catch (e) {} LIFE.gl.delete(m3); } // remove() releases the GPU context and its buffers
  document.body.classList.remove('m3-open'); const host = document.getElementById(id); if (host) { host.classList.remove('m3-on'); const box = host.querySelector(':scope > .m3-box'); if (box) { if (MAPCR.host === box) mapCrClose(); box.remove(); } }
  closeFloatCard(id); }
// the screen drawn again under the 3D view (a change saved from the card, say) disposes its 2D map: the 3D view closes with it and opens again on
// the new map with the same camera, once the screen is drawn (fsAfterRender) - the engine, the style and the tiles are already in
function m3Lost() { const m3 = M3.map, id = M3.id; let cam = null; try { if (m3) { const c = m3.getCenter(); cam = { c: [c.lng, c.lat], z: m3.getZoom(), p: m3.getPitch(), b: m3.getBearing() }; } } catch (e) {}
  m3Close(); if (id && FS && FS.id === id) M3.again = { id, cam, at: Date.now() }; }
function m3Again() { const a = M3.again; M3.again = null; if (!a || !FS || FS.id !== a.id || Date.now() - a.at > 5000) return;
  setTimeout(() => { if (FS && FS.id === a.id && !M3.id && MAPS[a.id]) m3Open(a.id, a.cam); }, 300); } // the pins are placed by then (their places are already found)
function m3ThemeChanged() { if (M3.map && M3.raw) try { M3.map.setStyle(m3Style(M3.raw, M3.trip)); } catch (e) {} } // the light or dark style follows the app

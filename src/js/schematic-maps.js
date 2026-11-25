// city: water, parks, main and secondary roads, rails and metro, neighbourhood names; route: borders and country names,
// cities, and (when the frame is small enough) main roads, rivers, lakes and national parks; plus a relief picture
async function fetchSchemData(bb, kind, onProg) {
  const [s, w, n, e] = bb.map(v => +v.toFixed(4)), B = `${s},${w},${n},${e}`, spanKm = distanceKm({ lat: s, lng: w }, { lat: n, lng: e });
  const tol = Math.max(e - w, n - s) / 1600, feats = [];
  const push = (k, coords, extra) => { const g = simplifyLine(coords, tol); if (g.length > 1) feats.push({ k, g, ...extra }); };
  const take = (els, classify) => els.forEach(el => { const t = el.tags || {}, k = classify(t, el); if (!k) return;
    if (el.type === 'node') { if (el.lat != null) feats.push({ k, p: [+el.lon.toFixed(5), +el.lat.toFixed(5)], n: heName(t) }); return; }
    if (el.type === 'way' && el.geometry) push(k, el.geometry.map(q => [q.lon, q.lat]), { n: heName(t), b: t.bridge === 'yes' ? 1 : 0 });
    if (el.type === 'relation' && el.members) joinRings(el.members.filter(m => m.role !== 'inner' && m.geometry).map(m => m.geometry.map(q => [q.lon, q.lat]))).forEach(r => push(k, r, { n: heName(t) }));
    if (el.type === 'relation' && el.center && kind !== 'city') feats.push({ k: k + '-label', p: [+el.center.lon.toFixed(4), +el.center.lat.toFixed(4)], n: heName(t) }); });
  // 4.38.2: vector tiles first; if they gave anything, that is the background (tiles that failed are completed later, quietly)
  try { const v = await vtSchemFeats(bb, kind, spanKm, push, feats, onProg ? (a, b) => onProg(a, b) : null);
    const partial = v.failed ? ['tiles'] : [], errs = [];
    if (kind !== 'city') { try { (await worldPolygons(bb)).forEach(c => c.rings.forEach(r => push('land', r, { iso: c.id }))); } catch (e) { partial.push('land'); errs.push('land: ' + String(e && e.message || e)); } }
    if (v.failed) errs.push(`tiles z${v.z}: ${v.failed} מתוך ${v.tiles} – ` + v.errs.slice(0, 3).join(SEP));
    if (errs.length) svcTrouble('openfreemap', 'schem', 'חלק לא נטען: ' + errs.join(' | ').slice(0, 120));
    if (feats.length) return { at: Date.now(), kind, bb, feats, partial, src: 'ofm' }; // legal-credits (C2): its source, for its credit (schemCredit)
  } catch (e) { svcTrouble('openfreemap', 'schem', 'האריחים הווקטוריים לא נטענו, מנסים את אוברפס: ' + String(e && e.message || e).slice(0, 80)); feats.length = 0; }
  // 4.37.4: the background is asked in small parts, one after another, and whatever arrived is drawn. One big query
  // ("Failed to fetch" on the phone: the public servers refuse or time out heavy requests) left the whole picture empty.
  const partial = [], errs = [];
  const part = async (name, body, classify, n, of) => { if (onProg) onProg(n, of);
    try { take((await overpassQuery(`[out:json][timeout:25];(${body});out geom qt;`)).elements || [], classify); } catch (e) { partial.push(name); errs.push(name + ': ' + String(e && e.message || e)); } };
  if (kind === 'city') {
    const cls = t => t.natural === 'water' || t.waterway === 'riverbank' ? 'water' : t.waterway ? 'river' : (t.leisure || t.landuse || t.natural === 'wood') ? 'park'
      : /^(motorway|trunk|primary)$/.test(t.highway || '') ? 'road1' : t.highway === 'secondary' ? 'road2' : t.highway === 'tertiary' ? 'road3'
      : t.railway === 'subway' ? 'metro' : t.railway ? 'rail' : t.place ? 'area' : '';
    const parts = [['water', `way["natural"="water"](${B});relation["natural"="water"](${B});way["waterway"~"^(river|canal)$"](${B});`],
      ['green', `way["leisure"~"^(park|garden)$"](${B});relation["leisure"="park"](${B});way["landuse"~"^(forest|recreation_ground|cemetery)$"](${B});way["natural"="wood"](${B});`],
      ['roads', `way["highway"~"^(motorway|trunk|primary|secondary)$"](${B});`],
      ['rail', `way["railway"~"^(rail|subway|light_rail|tram)$"](${B});node["place"~"^(suburb|quarter|neighbourhood|borough|island)$"](${B});`],
      ['roads3', `way["highway"="tertiary"](${B});`]];
    for (let i = 0; i < parts.length; i++) await part(parts[i][0], parts[i][1], cls, i + 1, parts.length);
  } else {
    if (onProg) onProg(1, 3);
    try { const j1 = await overpassQuery(`[out:json][timeout:25];(relation["boundary"="administrative"]["admin_level"="2"](${B});node["place"="city"](${B}););out tags center;`);
      (j1.elements || []).forEach(el => { const t = el.tags || {}; if (el.type === 'node') feats.push({ k: 'city', p: [+el.lon.toFixed(4), +el.lat.toFixed(4)], n: heName(t), pop: Number(t.population) || 0 });
        else if (el.center) feats.push({ k: 'country', p: [+el.center.lon.toFixed(3), +el.center.lat.toFixed(3)], n: heName(t), iso: t['ISO3166-1:numeric'] || '' }); });
    } catch (e) { partial.push('places'); errs.push('places: ' + String(e && e.message || e)); }
    if (onProg) onProg(2, 3);
    try { (await worldPolygons(bb)).forEach(c => c.rings.forEach(r => push('land', r, { iso: c.id }))); } catch (e) { partial.push('land'); errs.push('land: ' + String(e && e.message || e)); } // coasts and borders come from a fixed file, not from Overpass
    if (spanKm < 700) await part('more', `way["highway"~"^(motorway|trunk)$"](${B});way["waterway"="river"](${B});way["natural"="water"]["water"="lake"](${B});relation["boundary"="national_park"](${B});`,
      t => t.highway ? 'road1' : t.waterway ? 'river' : t.natural === 'water' ? 'water' : t.boundary === 'national_park' ? 'np' : '', 3, 3);
  }
  if (errs.length) svcTrouble('overpass1', 'schem', 'חלק לא נטען: ' + errs.join(' | ').slice(0, 120));
  if (!feats.length) throw new Error(errs.join(' | ') || 'empty');
  return { at: Date.now(), kind, bb, feats, partial, src: 'overpass' };
}
// countries (Natural Earth 1:50m via world-atlas): coasts and borders for route pictures - legal-credits-2 (S9): world-atlas 2.0.2's
// countries-50m.json, unchanged, is a file of the app's own site (svcSiteFile; the worker keeps it once fetched), no longer jsDelivr's
const WORLD_50M = { file: './countries-50m.json', credit: 'Natural Earth (world-atlas)' };
async function worldPolygons(bb) {
  const j = await svcSiteFile(WORLD_50M.file); if (!j || !j.objects) throw new Error('world'); const [s, w, n, e] = bb, out = [];
  topoRings(j, 'countries').forEach(g => { const rings = []; // countries-visited: the one TopoJSON reading (js/world-borders.js)
    g.polys.forEach(p => { const rr = p[0]; const la = rr.map(q => q[1]), ln = rr.map(q => q[0]); if (Math.max(...la) < s || Math.min(...la) > n || Math.max(...ln) < w || Math.min(...ln) > e) return; rings.push(rr); });
    if (rings.length) out.push({ id: g.id, name: g.props.name || '', rings }); });
  return out;
}
function geoKey(id, kind, bb) { return `schem:${id}:${kind}:${bb.map(v => v.toFixed(3)).join(',')}`; }
const GEO_BUSY = new Map();
async function ensureSchemData(id, kind, items, pad) { // pad: the margin around the items (the trip picture asks its map box's corners with a small one, P8)
  if (!items.length) return null; const bb = bboxOfItems(items, pad || (kind === 'city' ? 0.35 : 0.2)), key = geoKey(id, kind, bb);
  const have = await GEO_DB.get(key);
  if (have) { // 4.37.4: a background that arrived only in part is completed later, quietly (at most every 10 minutes)
    if ((have.partial || []).length && svcOnline() && !GEO_BUSY.has(key) && Date.now() - (have.tried || have.at) > 600000) {
      GEO_BUSY.set(key, (async () => { try { const d = await fetchSchemData(bb, kind, null); if (d.feats.length >= have.feats.length) await GEO_DB.put(key, { ...d, relief: have.relief }); else await GEO_DB.put(key, { ...have, tried: Date.now() }); } catch (e) { await GEO_DB.put(key, { ...have, tried: Date.now() }); } finally { GEO_BUSY.delete(key); } })()); }
    return have; }
  if (svcNetDown()) { memBgStatus({ svc: 'schem', n: 0, of: 1, what: 'רקע המפה' }); return null; } if (geoFailed(key)) return null; if (GEO_BUSY.has(key)) return GEO_BUSY.get(key);
  const p = (async () => { try { const d = await fetchSchemData(bb, kind, (a, b) => memBgStatus({ svc: 'schem', n: Math.max(0, a - 1), of: b }));
      if (kind !== 'city') { const fit = mercFit([{ lat: bb[0], lng: bb[1] }, { lat: bb[2], lng: bb[3] }], 900, 900, 0, 9), hs = await renderTileImage(fit, 0, 0, 900, 900, 1, '__hs', null, { limit: 40, q: 0.7, svc: 'schem' }); if (hs) d.relief = { url: hs.url, bb, src: 'mh' }; }
      await GEO_DB.put(key, d); memBgStatus(null); return d;
    } catch (e) { SCHEM_FAILED.set(key, String(e && e.message || e)); memBgStatus({ svc: 'schem', n: 0, of: 1, what: 'רקע המפה', fail: 1 }); svcTrouble('openfreemap', 'schem', 'רקע סכמטי לא נטען: ' + String(e && e.message || e).slice(0, 100)); return null; }
    finally { GEO_BUSY.delete(key); } })();
  GEO_BUSY.set(key, p); return p;
}
// legal-credits (C2, C3): the schematic background's credit, from what it was drawn of and from the providers' rows (never a fixed string) - OpenFreeMap's
// vector tiles (src 'ofm'; 'vt' in a background kept before 11.40.0) or Overpass (src 'overpass'; none in an older one), Natural Earth's countries
// (a route picture's land), the relief (Mapterhorn's since relief-phone, Esri's in a background kept before); as plain text with OpenStreetMap's copyright address, for a picture or a print
function schemCredit(data) { if (!data) return ''; const provs = [data.src === 'ofm' || data.src === 'vt' ? 'openfreemap' : 'overpass1'];
  return [svcCreditsText(provs, { print: true }), (data.feats || []).some(f => f.k === 'land') ? WORLD_50M.credit : '', data.relief ? (data.relief.src === 'mh' ? svcCreditText('mapterhorn', { print: true }) : svcCreditText('esri', { as: 'hillshade' })) : ''].filter(Boolean).join(SEP); } // relief-phone: a background kept before it carries Esri's relief
function schemDataNow(id, kind, items) { if (!items.length) return null; const bb = bboxOfItems(items, kind === 'city' ? 0.35 : 0.2); return GEO_MEM.get(geoKey(id, kind, bb)) || null; }
// the schematic background drawn into a box with a fit (box: x, y, w, h in the picture; fit is relative to the box)
function schemSVG(data, fit, box, th, fs) {
  const prim = /^#[0-9a-f]{6}$/i.test(th.primary || '') ? th.primary : '#1C2B33';
  const P = q => `${(box.x + fit.x(q[0])).toFixed(1)} ${(box.y + fit.y(q[1])).toFixed(1)}`, path = (g, close) => 'M' + g.map(P).join('L') + (close ? 'Z' : '');
  const F = k => data.feats.filter(f => f.k === k), city = data.kind === 'city';
  let s = `<rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" fill="${city ? '#F4F0E6' : '#DCEAF3'}"/>`;
  if (!city) { const lands = F('land'); s += lands.length ? lands.map(f => `<path d="${path(f.g, 1)}" fill="#F4F0E6" stroke="${prim}" stroke-opacity=".35" stroke-width="1.6" stroke-dasharray="7 5"/>`).join('') : `<rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" fill="#F4F0E6"/>`;
    if (data.relief) { const [rs, rw, rn, re] = data.relief.bb, x1 = box.x + fit.x(rw), x2 = box.x + fit.x(re), y1 = box.y + fit.y(rn), y2 = box.y + fit.y(rs);
      s += `<image href="${data.relief.url}" x="${x1.toFixed(1)}" y="${y1.toFixed(1)}" width="${(x2 - x1).toFixed(1)}" height="${(y2 - y1).toFixed(1)}" preserveAspectRatio="none" opacity=".32" style="mix-blend-mode:multiply"/>`; } }
  F('np').forEach(f => s += `<path d="${path(f.g, 1)}" fill="#B9D9A8" fill-opacity=".45" stroke="#7FB069" stroke-opacity=".5" stroke-width="1"/>`);
  F('park').forEach(f => s += `<path d="${path(f.g, 1)}" fill="#CFE3C3"/>`);
  F('water').forEach(f => s += `<path d="${path(f.g, 1)}" fill="#A9CCE3"/>`);
  F('river').forEach(f => s += `<path d="${path(f.g)}" fill="none" stroke="#A9CCE3" stroke-width="${city ? 5 : 2.4}" stroke-linecap="round" stroke-linejoin="round"/>`);
  const roads = [['road3', 2.6], ['road2', 4], ['road1', city ? 6 : 3.4]];
  roads.forEach(([k, wd]) => F(k).forEach(f => s += `<path d="${path(f.g)}" fill="none" stroke="${prim}" stroke-opacity=".22" stroke-width="${wd + 2}" stroke-linecap="round" stroke-linejoin="round"/>`));
  roads.forEach(([k, wd]) => F(k).forEach(f => s += `<path d="${path(f.g)}" fill="none" stroke="#fff" stroke-width="${wd}" stroke-linecap="round" stroke-linejoin="round"/>`));
  F('rail').forEach(f => s += `<path d="${path(f.g)}" fill="none" stroke="${prim}" stroke-opacity=".38" stroke-width="1.6" stroke-dasharray="6 4"/>`);
  F('metro').forEach(f => s += `<path d="${path(f.g)}" fill="none" stroke="${prim}" stroke-opacity=".28" stroke-width="2" stroke-dasharray="2 4" stroke-linecap="round"/>`);
  const inBox = q => { const x = fit.x(q[0]), y = fit.y(q[1]); return x > 20 && x < box.w - 20 && y > 20 && y < box.h - 20; }, placed = [];
  const label = (q, n, size, fill, op, style) => { const x = box.x + fit.x(q[0]), y = box.y + fit.y(q[1]); if (placed.some(([a, b]) => Math.abs(a - x) < n.length * size * .32 + 30 && Math.abs(b - y) < size * 1.3)) return ''; placed.push([x, y]);
    return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" font-size="${size}" fill="${fill}" fill-opacity="${op}" ${style || ''} stroke="#F4F0E6" stroke-width="${(size / 4).toFixed(1)}" paint-order="stroke">${escH(n)}</text>`; };
  if (city) { // the river's name once, at the middle of its longest stretch; neighbourhood names
    const byLen = a => a.filter(f => f.n).sort((x, y) => y.g.length - x.g.length)[0], rv = byLen(F('river')) || byLen(F('water')); if (rv) { const q = rv.g[rv.g.length >> 1]; if (inBox(q)) s += label(q, rv.n, fs * .9, '#3B6E8F', .9, 'font-style="italic"'); }
    F('area').filter(f => f.n && inBox(f.p)).slice(0, 40).forEach(f => s += label(f.p, f.n, fs * .78, prim, .5, 'font-style="italic" letter-spacing="1"'));
  } else {
    F('country').filter(f => f.n && inBox(f.p)).forEach(f => s += label(f.p, f.n, fs * 1.15, prim, .42, 'font-weight="700" letter-spacing="3"'));
    F('city').filter(f => f.n && inBox(f.p)).sort((a, b) => b.pop - a.pop).slice(0, 24).forEach(f => { const x = box.x + fit.x(f.p[0]), y = box.y + fit.y(f.p[1]);
      s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(fs * .2).toFixed(1)}" fill="${prim}" fill-opacity=".5"/>` + label([f.p[0], f.p[1]], f.n, fs * .72, prim, .62, `dy="${(fs * .95).toFixed(1)}"`); });
  }
  return s;
}

// ---- the background of the trip picture: a tile picture (🗺️ מפה) or the schematic data (✏️ סכמתי) ----
const MEMO_BG = new Map(); // `${trip}|${style}|${shape}|${orient}|${map}` -> {url, credit} (tile pictures: made on demand, not stored)
// 7.1.0 (ש10): one status line for the trip picture, under it and in its editor - the background first, then Wikipedia's pictures
var MEM_ST = { bg: null, img: null }; // { svc, n, of, what, fail }
// wait-look (decisions 2026-11-23 · One "in progress" look, Q2): while the background's map data comes (not failed, the network up) the
// picture waits with the one "in progress" component over it (state 2): the bar under the block's head, the stage line in the status
// line's place, the picture dimmed with the ring; no count line. A failure, no network and the pictures' status keep the service line
const memBgWaiting = () => { const b = MEM_ST.bg; return !!(b && !b.fail && b.n < b.of && !svcNetDown()); };
const MEM_WAIT = {}; // slot -> { W, pic }: the wait on the picture of that slot (the memory screen's block, the editor)
const MEM_WAIT_AT = { memBgSt: ['memPicImg', '.mem-block', ':scope > h3'], tpSt: ['tpPic', '.tp-picwrap', null] };
function memStLine(slot) { if (memBgWaiting()) return waitLineHTML('טוענים את המפה של התמונה'); const b = MEM_ST.bg, s = b && (b.fail || b.n < b.of) ? b : MEM_ST.img; if (!s) return '';
  return svcLine(slot + 'L', s.svc, s.fail ? 0 : s.n, s.of, () => memStLine(slot), { gaveUp: s.fail ? s.of : 0, what: s.what }); }
function memStWait(slot, el) { const w = MEM_WAIT[slot], [pid, hq, headq] = MEM_WAIT_AT[slot], pic = document.getElementById(pid);
  if (!memBgWaiting() || !pic) { if (w) { w.W.done(); delete MEM_WAIT[slot]; } return false; }
  if (w && w.pic === pic && pic.classList.contains('wait-map')) return true; if (w) w.W.done();
  const host = pic.closest(hq) || pic.parentElement; MEM_WAIT[slot] = { pic, W: waitOn(host, { head: headq && host.querySelector(headq), line: el, map: pic, stage: 'טוענים את המפה של התמונה' }) }; return true; }
function memStDraw() { ['memBgSt', 'tpSt'].forEach(i => { const el = document.getElementById(i); if (!el) { memStWait(i, null); return; } if (memStWait(i, el)) { el.hidden = false; return; } const h = memStLine(i); el.innerHTML = h; el.hidden = !h; }); memPicSync(); }
function memBgStatus(s) { MEM_ST.bg = s || null; memStDraw(); }
function mementoStyleOf(id) { const v = MEMO_VIEW[id] || {}, st = v.style || ((STATE.tripData[id] || {}).mementoStyle) || 'schem'; return st === 'art' && !MEMO.get('art:' + id) ? 'schem' : st; }


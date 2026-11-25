// ================= 4.43.0 + 4.44.0: THE TRIP PICTURE, ARRANGED BY ME (cl-memento-pick) =================
// Spec 26–27.10.2026: an automatic picture is only a starting point - a trip picture you want to send has to be perfect, so
// the user decides what is in it. A ready style (preset) sets only the defaults; every manual change is kept as its own layer
// on top (td.pic.ov), so switching styles never loses arranging ("✋ N שינויים שלך" lists them, each with ↺).
// - Kinds: 🗺️ route = a skeleton of cities (or stays) in arrival order with the real way between them (✈️ arc, road line),
//   plus the significant points I choose; 🏙️ city = the hotel is part of the picture, no movement route, the points matter.
// - Every point has a level: גדול / בינוני / קטן / בחוץ. Defaults: highlight or ★ = big, ❤️ = medium, 👍 = small, the rest out.
// - Candidates: every place of the trip's destinations (visited ← planned ← the rest), cities and stays, and "＋ נקודה" for
//   the picture only. Names as in the app, a "שם" switch per point, text edited for the picture only, Hebrew/English.
// - Points that would overlap are spread apart (with a thin line to the true spot), never merged by themselves: every point
//   is meant to get its picture. Merging is manual, and a merged marker shows what it is made of.
// - 4.44.0: a small image per point - of that very place (my photo, or Wikipedia when it has one), cropped in the app, one
//   look for the whole picture (real or drawn); the illustrated version with Claude keeps my arrangement locked.
// - The frame is made of blocks I switch on and off (title band, up to 4 numbers, highlights, collection, bottom line), or
//   no frame at all (the map from edge to edge).
const PIC_LV = ['L', 'M', 'S', 'out'];
const PIC_LV_HE = { L: 'גדול', M: 'בינוני', S: 'קטן', out: 'בחוץ' };
const PIC_PRESETS = {
  route: [['cities', 'ערים ומסלול', 'location_city'], ['stays', 'לינות ומסלול', 'hotel'], ['full', 'המסע המלא', 'route']], // 10.15.0 (design-review Q14): line icons
  city: [['hotel', 'הלינה והמקומות', 'hotel'], ['places', 'רק המקומות', 'location_on']],
};
const PIC_NUMS = { days: ['ימים', 'days'], dests: ['מדינות', 'countries'], cities: ['ערים', 'cities'], km: ['ק״מ', 'km'], flights: ['טיסות', 'flights'], places: ['מקומות ש' + TX.visited, 'places visited'], loved: ['❤️ אהבנו', '❤️ loved'], walk: ['ק״מ ברגל (משוער)', 'km on foot (est.)'], ride: RIDE_LABEL }; // ride-km (Q2): "(משוער)" / "(est.)" added when estimated (picNumLabel)
const PIC_NUM_MAX = 4;
const PIC_FS = { open: false }; // the full-screen view (PHOTOS: openPhotoView)
var PIC_ED = null;                // the editor: { id, tab, q, outOpen, all (candidates incl. every destination place) }
var PIC_CROP = null;              // the crop dialog
const PIC_SRC_SESSION = new Map(); // `${trip}|${key}` -> dataURL of my own photo, kept for re-cropping while the app is open
// a token's light value (the first :root rule - tokens.css), for drawings that leave the page (the trip picture is drawn light, in dark mode too)
const TOKEN_LIGHT = {};
function tokenLight(name, dflt) { if (name in TOKEN_LIGHT) return TOKEN_LIGHT[name] || dflt; let v = '';
  try { for (const sh of document.styleSheets) { for (const r of sh.cssRules || []) { if (r.selectorText === ':root' && r.style) { v = r.style.getPropertyValue(name).trim(); if (v) break; } } if (v) break; } } catch (e) {}
  TOKEN_LIGHT[name] = /^#[0-9a-f]{3,8}$/i.test(v) ? v : ''; return TOKEN_LIGHT[name] || dflt; }
function picOf(id) { const td = STATE.tripData[id] || {}; return td.pic || {}; }
// one change of the arrangement: copy, change, save, redraw, with undo (standard: every change gets the undo toast)
// undo-history (Q5): the quick taps of the arrangement (style, frame, a level - `quiet`) are ordinary rows; a burst of them is one
// row - its toast waits until the taps stop (the standard's grouping rule). Any other change of the picture closes the burst first.
const PIC_BURST = { t: 0, labels: [], ms: 1200 };
function picBurstEnd() { if (!PIC_BURST.t) return; clearTimeout(PIC_BURST.t); PIC_BURST.t = 0; const L = PIC_BURST.labels; PIC_BURST.labels = [];
  const u = [...new Set(L)]; showUndoToast(L.length === 1 ? L[0] : `${L.length} שינויים בתמונת הטיול: ${u.slice(-3).join(SEP)}`); }
sysOn(document, 'visibilitychange', () => { if (document.hidden) picBurstEnd(); }); undoBefore(picBurstEnd); // the app may close in the background: the row is written now
function picChange(id, label, fn, quiet) {
  const td = tdOf(id), before = JSON.stringify(td.pic || {}), p = JSON.parse(before); fn(p);
  if (JSON.stringify(p) === before) return; if (!quiet) picBurstEnd(); if (before === '{}') p.pathNew = 1; // tl-paths (Q4): a picture first arranged from 11.48.0 takes the new defaults
  td.pic = p; tdSave(id); picRedraw(id);
  if (!quiet) { showUndoToast(label); return; }
  clearTimeout(PIC_BURST.t); PIC_BURST.labels.push(label); PIC_BURST.t = setTimeout(picBurstEnd, PIC_BURST.ms);
}
function picOv(p) { p.ov = p.ov || {}; p.ov.pts = p.ov.pts || {}; p.ov.frame = p.ov.frame || {}; return p.ov; }
function picPtOv(p, key) { const o = picOv(p).pts; return (o[key] = o[key] || {}); }
function picCleanPt(p, key) { const o = picOv(p).pts; if (o[key] && !Object.keys(o[key]).filter(k => k !== 'snap').length) delete o[key]; }
const picClean = s => String(s || '').replace(/\s*\(.*$/, '').trim();
const HEB_CH = /[\u0590-\u05FF]/;
// the foreign (Latin) name: the name itself when it has no Hebrew, else the first part of the address when that is Latin
function picForeign(p) { const f = String((p && p.foreign) || '').trim(); if (f && !HEB_CH.test(f)) return f; // kit-fixes (item 4): the place's own local name first
  const n = picClean(p && p.name); if (n && !HEB_CH.test(n)) return n;
  const a = String((p && p.address) || '').split(',')[0].trim(); return a && !HEB_CH.test(a) && a.length < 48 ? a : ''; }
function picKind(id, D) { const p = picOf(id), v = MEMO_VIEW[id] || {}; return p.kind || (v.shape === 'city' ? 'city' : v.shape ? 'route' : (D.auto === 'city' ? 'city' : 'route')); }
function picPreset(id, kind) { const p = picOf(id), list = PIC_PRESETS[kind].map(x => x[0]); return list.includes((p.presets || {})[kind]) ? p.presets[kind] : list[0]; }
function picOrient(id, D, kind) { const p = picOf(id), v = MEMO_VIEW[id] || {}; return p.orient || v.orient || (kind === 'city' ? 'port' : (D.spread > 2500 ? 'land' : 'port')); }
// cities: the stays in arrival order, grouped by the region of the hotel (or by distance when there is none)
function picCities(D) {
  const M = D.M, snapD = (M.snap && M.snap.dests) || {}, regs = d => (snapD[d] && snapD[d].regions) || ((DESTS[d] || {}).meta || {}).regions || [];
  const out = [], seq = [];
  D.stops.forEach((st, i) => { const lod = M.stops[i], p = lod && lod.p, reg = p && p.region ? (regs(p.dest).find(r => r.id === p.region) || {}).name : '';
    let g = out.find(x => reg ? x.reg === reg : (!x.reg && kmBetween(x.c, st.c) < 25)); // 11.21.4 (backup-ids, Q2): the group's key is of the form (idFix - as the door and the once pass convert a stored key of a name)
    if (!g) { g = { key: idFix('c:' + (reg || picClean(st.name)).slice(0, 40), null, 'key'), reg, name: reg || '', c: st.c, nights: 0, first: i, dest: st.dest, stays: [] }; out.push(g); }
    g.nights += st.nights; g.stays.push(i); if (seq[seq.length - 1] !== g) seq.push(g); });
  // a city without a region: the destination's name when it is its only city, else the hotel's address city or name
  out.forEach(g => { if (g.name) return; const same = out.filter(x => x.dest === g.dest);
    const st = D.stops[g.first], lod = M.stops[g.first], addr = String((lod && lod.p && lod.p.address) || '').split(',').map(s => s.trim()).filter(Boolean);
    g.name = same.length === 1 ? String(st.city || '').replace(/\s*\(.*$/, '') : (addr.length > 2 ? addr[addr.length - 2] : picClean(st.name)); });
  return { cities: out, seq };
}
// every candidate of the picture. full=true adds every place of the trip's destinations (for the editor's list)
// A8 (decisions 2026-11-13 review of 11.10.0): the places of destinations as the device has them now - the destination's file with my
// edits, additions and states, each with its layer - read without making any trip the active one (the trip picture's "all the
// destination's places"); a destination no longer on the phone gives none
function destPlacesRead(dids) { const E = STATE.edits, out = [];
  (dids || []).forEach(did => { const d = DESTS[did]; if (!d || d.ghost) return; const L = new Map(destLayersEff(d).map(l => [l.id, l]));
    const deco = q => { const l = L.get(q.layer); if (!l) return null; const st = E.status[q.id]; if (st) { if (st.s === 'moved') return null; if (st.s === 'active') { delete q.status; delete q.statusNote; } else { q.status = st.s; q.statusNote = st.note || ''; } }
      q.layer_name = l.name; q.color = l.color; if (!q.icon) q.icon = l.icon; return q; };
    destPlaces(d).forEach(b => { const e = E.places[b.id]; const q = deco(e && e.op === 'edit' ? { ...b, ...e.data, edited: true } : { ...b }); if (q) out.push(q); });
    Object.entries(E.places).forEach(([k, e]) => { if (e.op === 'add' && e.data && e.data.dest === did) { const q = deco({ reservation: '', price: '', transit: '', description: '', ...e.data, id: Number(k), userAdded: true }); if (q) out.push(q); } }); });
  return out; }
function picCands(id, D, full) {
  const M = D.M, rate = M.td.rating || {}, vis = new Set(M.td.visited || []), hi = new Set((M.td.highlights || []).map(h => h.placeId).filter(x => x != null));
  const planned = new Set(); Object.values(M.td.itinerary || {}).forEach(d => DAY_SLOTS.forEach(s => ((d || {})[s] || []).forEach(x => { if (typeof x === 'number') planned.add(x); })));
  const hotelIds = new Set(M.stops.map(s => s.p.id)), out = [], seen = new Set();
  const add = (p, src) => { if (!p || seen.has(p.id) || hotelIds.has(p.id)) return; const c = snapCoord(p); if (!c) return; seen.add(p.id);
    const rt = (rate[p.id] || {}).r || ''; out.push({ key: 'p:' + p.id, type: 'place', p, name: picClean(p.name), foreign: picForeign(p), c, icon: p.icon, rt, hl: hi.has(p.id), star: !!p.key,
      visited: vis.has(p.id), planned: planned.has(p.id), dest: p.dest, src }); };
  (M.places || []).forEach(p => add(p, 'trip'));
  const pov = picOv(JSON.parse(JSON.stringify(picOf(id)))).pts;
  Object.entries(pov).forEach(([k, o]) => { if (k.startsWith('p:') && o.snap && !seen.has(Number(k.slice(2)))) add({ ...o.snap, id: Number(k.slice(2)) }, 'kept'); });
  if (full) destPlacesRead(M.dests).forEach(q => add(snapPlace(q), 'dest')); // A8: read, never borrowed, no hidden errors
  const { cities, seq } = picCities(D);
  cities.forEach(g => out.push({ key: g.key, type: 'city', name: g.name, foreign: '', c: g.c, icon: 'city', nights: g.nights, order: seq.indexOf(g) + 1, g }));
  D.stops.forEach((st, i) => { const lod = M.stops[i]; if (!lod) return; out.push({ key: 'h:' + (lod.l.id || lod.p.id), type: 'hotel', p: lod.p, name: picClean(st.name), foreign: picForeign(lod.p), c: st.c, icon: 'lodging', nights: st.nights, order: i + 1, from: st.from }); });
  (picOf(id).extra || []).forEach(x => out.push({ key: x.key, type: x.city ? 'city' : 'extra', name: x.name, foreign: x.foreign || '', c: { lat: x.lat, lng: x.lng }, icon: x.city ? 'city' : 'pin', extra: true, city: !!x.city }));
  return out;
}
// the level a preset gives a candidate (before my changes)
function picDefaultLv(x, kind, preset, D) {
  if (x.type === 'extra') return 'M';
  if (x.type === 'city') { if (x.extra) return kind === 'route' ? 'M' : 'out'; return kind === 'route' && preset !== 'stays' ? 'M' : 'out'; }
  if (x.type === 'hotel') { if (kind === 'city') return preset === 'hotel' && picInMain(x, D) ? 'M' : 'out'; return preset === 'stays' ? 'M' : preset === 'full' ? 'S' : 'out'; }
  if (x.hl) return 'L'; if (!x.visited) return 'out'; // only where we were - a ★ we didn't reach stays out until I bring it in
  if (x.star) return 'L'; if (x.rt === 'love') return 'M'; if (x.rt === 'like') return 'S';
  if (preset === 'full' && x.visited && x.rt !== 'dislike') return 'S';
  return 'out';
}
// a hotel belongs to a city picture only when it is near the visited places
function picInMain(x, D) { if (!D.visited.length) return true; return D.visited.some(p => { const c = snapCoord(p); return c && kmBetween(c, x.c) < 40; }); }
// the resolved picture: kind, preset, orientation, language, look, points with their effective level/label/text/image, frame
function picModel(id, D) {
  D = D || mementoData(id); if (!D) return null;
  const P = picOf(id), kind = picKind(id, D), preset = picPreset(id, kind), orient = picOrient(id, D, kind), lang = P.lang === 'en' ? 'en' : 'he', look = P.look === 'drawn' ? 'drawn' : 'real';
  const ov = (P.ov && P.ov.pts) || {}, imgs = P.img || {};
  const pts = picCands(id, D, false).map(x => { const o = ov[x.key] || {}, def = picDefaultLv(x, kind, preset, D), lv = PIC_LV.includes(o.lv) ? o.lv : def;
    const defLabel = lv === 'L' ? true : lv === 'M' ? 'auto' : false, label = typeof o.label === 'boolean' ? o.label : defLabel, forced = o.label === true;
    const auto = lang === 'en' ? (x.foreign || x.name) : x.name, text = o.text != null && String(o.text).trim() ? String(o.text) : auto;
    return { ...x, def, lv, label, forced, text, auto, dx: +o.dx || 0, dy: +o.dy || 0, img: picImgOf(id, x.key, imgs[x.key], x) }; });
  const merges = (P.merges || []).map(g => g.filter(k => pts.some(x => x.key === k && x.lv !== 'out'))).filter(g => g.length > 1);
  return { id, D, P, kind, preset, orient, lang, look, pts, merges, frame: picFrame(id, D, kind, P) };
}
// the image a point shows: my choice (own / wiki / none) or, by default, Wikipedia's when one was found
// legal-credits (Q8): a Wikipedia picture carries its Commons facts (cr: author, licence) from the kept row; one whose licence turned out not free
// is not shown. legal-server (11.41.0; review of legal-credits Q1, finding 1): one with no facts yet (kept before 11.40.0, no network, a failed
// ask) is "no picture" too - in the picture and so in its PNG, PDF and print - until picWikiFill brings them (picWikiKick asks), then it comes back
function picImgOf(id, key, o, x) { o = o || {}; if (o.src === 'none') return null; const v = MEMO.get(`pimg:${id}:${key}`); if (!v) return null;
  if (o.src === 'own') return { key, url: v, src: 'own', cr: null };
  const w = x ? picWikiVal(picWikiCK(x)) : undefined; if (!w || !w.cr) return null; // never a Wikipedia picture without its author and licence
  return { key, url: v, src: 'wiki', cr: w.cr }; }
// the photos' credit: "Photos: Wikimedia Commons - <author> (<licence>), cropped; …" - each picture once, in the order of the markers
// legal-server (finding 5): a file with no author's name is named by its file page's short address (<lang>.wikipedia.org/wiki/File:…), never
// "unknown author"; a picture without its facts never reaches here (picImgOf) and is never written
// trip-picture-credits (C15; decisions 2026-11-24 · Review of the legal-review-2 report, Q7): with the look that turns the photos into drawings
// (look: drawn - the app's PIC_DRAW_FILTER, or the AI's illustrated version) each photo is said to be adapted ("בעיבוד"), not only cropped
function picPhotoCredit(marks, en, adapted) { const seen = new Set(), items = [], how = adapted ? (en ? ', adapted' : ', בעיבוד') : (en ? ', cropped' : ', חתוכה');
  marks.forEach(q => { const im = q.img; if (!im || im.src !== 'wiki' || !im.cr || !im.cr.lic) return; const c = im.cr, who = c.a || picFilePage(c.fp), t = `${who} (${c.lic})`; if (!who || seen.has(t)) return; seen.add(t); items.push(t + how); });
  if (!items.length) return ''; const lics = picLicAddrs(marks); return `${en ? 'Photos' : 'תמונות'}: Wikimedia Commons - ${items.join('; ')}${lics ? `; ${en ? 'licences' : 'רישיונות'}: ${lics}` : ''}`; }
// legal-credits-2 (C16): each licence's address printed once beside its authors - a PNG or a print has no link (CC BY-SA 3.0 §4(a) asks its URI),
// the scheme dropped ("creativecommons.org/licenses/by-sa/3.0"); a licence with no known address is named only
function picLicAddrs(marks) { const seen = new Set(); marks.forEach(q => { const c = q.img && q.img.src === 'wiki' && q.img.cr; if (!c || !c.lic || !/^https?:\/\//.test(c.lu || '')) return;
  const u = c.lu.replace(/^https?:\/\//, '').replace(/\/(deed\.[\w-]+|legalcode(\.[\w-]+)?)?\/?$/, ''); if (u) seen.add(u); }); return [...seen].join(SEP); }
function picFilePage(fp) { try { const u = new URL(fp); return u.host + decodeURIComponent(u.pathname); } catch (e) { return ''; } }
// a credit too long for one line, cut at its "; " and spaces into lines of about `cap` letters
function picWrap(t, cap) { const out = []; let cur = ''; String(t).split(/(?<=; )|(?<= )/).forEach(w => { if (cur && (cur + w).length > cap) { out.push(cur.trimEnd()); cur = ''; } cur += w; }); if (cur.trim()) out.push(cur.trimEnd()); return out; }
// ---- the frame: blocks I switch on and off ----
function picFrameDefaults(D, kind) {
  // ride-km (Q3): "ק״מ בנסיעות" checked by default only in a route picture - in the place of "ערים" (four numbers at most); offered, unchecked, in a city one
  const nums = kind === 'city' ? ['days', 'places', 'loved', 'walk'] : ['days', D.dests.length > 1 ? 'dests' : 'places', D.ride && D.ride.km ? 'ride' : 'cities', 'km'];
  return { none: false, small: 'small', band: true, title: '', sub: '', dates: true, flags: true, nums, hl: true, col: true, elev: true, foot: true, path: kind === 'city' };
}
// tl-paths (Q4): "המסלול שהלכנו" - on by default in a city picture, off in a route one. A picture saved before 11.48.0 (td.pic with settings and
// no pathNew) drew the path in both kinds: it keeps that look (on) until its kind or this switch is changed (both set pathNew - picChange)
function picFrame(id, D, kind, P) { P = P || picOf(id); const fo = (P.ov || {}).frame || {}, f = { ...picFrameDefaults(D, kind), ...fo };
  if (typeof fo.path !== 'boolean' && picPathOld(P)) f.path = true;
  f.nums = (f.nums || []).filter(k => PIC_NUMS[k]).slice(0, PIC_NUM_MAX); return f; }
function picPathOld(P) { return !!P && !P.pathNew && Object.keys(P).length > 0; }
function picNumVal(k, D, M2) {
  const flights = travelsOf(D.t).filter(x => x.mode === 'flight').length, love = Object.values(D.rate).filter(r => r.r === 'love').length;
  return { days: D.days, dests: D.dests.length, cities: M2.cityCount, km: D.totalKm, flights, places: D.visited.length, loved: love, walk: D.walk, ride: D.ride ? D.ride.km : 0 }[k];
}
function picNumLabel(k, D, en) { const l = PIC_NUMS[k][en ? 1 : 0]; return k === 'ride' && D.ride && D.ride.est ? l + (en ? ' (est.)' : ' (משוער)') : l; }
// what changed by hand, for "✋ N שינויים שלך": one line per change, each with its own ↺
function picChanges(id) {
  const P = picOf(id), D = mementoData(id); if (!D) return [];
  const cands = picCands(id, D, false), nm = k => { const x = cands.find(c => c.key === k); return x ? x.name : ((((P.ov || {}).pts || {})[k] || {}).snap || {}).name || k; };
  const out = [], pts = ((P.ov || {}).pts) || {};
  Object.entries(pts).forEach(([k, o]) => {
    if (o.lv) out.push({ kind: 'pt', k, f: 'lv', text: `${nm(k)}${SEP}${PIC_LV_HE[o.lv]}` });
    if (typeof o.label === 'boolean') out.push({ kind: 'pt', k, f: 'label', text: `${nm(k)}${SEP}שם ${o.label ? 'מוצג' : 'מוסתר'}` });
    if (o.text != null && String(o.text).trim()) out.push({ kind: 'pt', k, f: 'text', text: `${nm(k)}${SEP}השם בתמונה: "${String(o.text).slice(0, 30)}"` });
    if (o.dx || o.dy) out.push({ kind: 'pt', k, f: 'move', text: `${nm(k)}${SEP}הוזז` });
  });
  Object.entries(P.img || {}).forEach(([k, o]) => { if (o && o.src) out.push({ kind: 'img', k, text: `${nm(k)}${SEP}תמונה: ${{ own: 'שלי', wiki: 'ויקיפדיה', none: 'בלי' }[o.src] || o.src}${o.crop ? ' (חיתוך)' : ''}` }); });
  (P.merges || []).forEach((g, i) => out.push({ kind: 'merge', i, text: `איחוד: ${g.map(nm).join(' + ')}` }));
  (P.extra || []).forEach(x => out.push({ kind: 'extra', k: x.key, text: `＋ ${x.city ? 'עיר' : 'מיקום'}: ${x.name}` }));
  const fr = (P.ov || {}).frame || {}, FL = { none: 'בלי מסגרת', small: 'כותרת בלי מסגרת', band: 'פס הכותרת', title: 'כותרת', sub: 'כותרת משנה', dates: 'תאריכים', flags: 'דגלים', nums: 'מספרים', hl: 'רגעי השיא', col: 'מונה האוסף', elev: 'פרופיל הגובה', foot: 'שורה תחתונה', path: 'המסלול שהלכנו' };
  Object.keys(fr).forEach(k => out.push({ kind: 'frame', k, text: `מסגרת${SEP}${FL[k] || k}` }));
  return out;
}
function picUndoOne(p, ch) {
  if (ch.kind === 'pt') { const o = picPtOv(p, ch.k); if (ch.f === 'move') { delete o.dx; delete o.dy; } else delete o[ch.f]; picCleanPt(p, ch.k); }
  if (ch.kind === 'img') { if (p.img) delete p.img[ch.k]; }
  if (ch.kind === 'merge') p.merges = (p.merges || []).filter((g, i) => i !== ch.i);
  if (ch.kind === 'extra') { p.extra = (p.extra || []).filter(x => x.key !== ch.k); if (p.ov && p.ov.pts) delete p.ov.pts[ch.k]; if (p.img) delete p.img[ch.k]; p.merges = (p.merges || []).map(g => g.filter(k => k !== ch.k)).filter(g => g.length > 1); }
  if (ch.kind === 'frame' && p.ov && p.ov.frame) delete p.ov.frame[ch.k];
}
// ---- the picture itself (SVG; PNG and PDF are drawn from it) ----
const PIC_R = { place: { L: 29, M: 22, S: 13 }, cplace: { L: 37, M: 27, S: 16 }, city: { L: 26, M: 20, S: 13 }, hotel: { L: 22, M: 17, S: 12 } }; // 4.47.1: all smaller, the big ones a bit more
const PIC_LAST = {}; // tripId -> the last layout (marker positions), for the Claude file and the editor
const PIC_EN = { nights: n => `${n} night${n === 1 ? '' : 's'}`, more: 'more' };
function picR(x, kind) { return (x.type === 'city' ? PIC_R.city : x.type === 'hotel' ? PIC_R.hotel : kind === 'city' ? PIC_R.cplace : PIC_R.place)[x.lv] || 15; }
const PIC_LV_RANK = { L: 3, M: 2, S: 1, out: 0 };
// the box of the map inside the picture, by the frame's blocks
function picBoxes(m) {
  const land = m.orient === 'land', W = land ? 1400 : 1000, H = land ? 1000 : 1400, f = m.frame, D = m.D;
  if (f.none) return { W, H, land, map: { x: 0, y: 0, w: W, h: H }, topPad: f.small === 'small' ? 92 : 20, rx: 0 };
  const bandH = f.band ? (land ? 210 : 250) : 0, nums = f.nums.length ? (land ? 84 : 96) : 0, top = bandH + (nums ? 22 + nums : 0) + 22, bottom = H - (f.foot ? 62 : 26);
  const hs = f.hl ? D.hs : [], col = f.col ? D.cols[0] : null;
  if (land) { const cw = hs.length ? 400 : 0, cx = 40 + cw; return { W, H, land, bandH, nums, top, bottom, cw, cx, hs, col, map: { x: cw ? cx + 20 : 40, y: top, w: (W - 40) - (cw ? cx + 20 : 40), h: bottom - top - (col ? 88 : 0) }, topPad: 20, rx: 26 }; }
  const hsH = hs.length ? 160 : 0;
  return { W, H, land, bandH, nums, top, bottom, hs, col, hsH, map: { x: 40, y: top, w: W - 80, h: bottom - top - hsH - (col ? 88 : 0) }, topPad: 20, rx: 26 };
}
// which points are drawn, where (Web Mercator fit, a city framed by its main cluster), spread so nothing overlaps
const PIC_FIT_PAD = { city: 84, route: 90 }, PIC_FIT_MIN_KM = 1; // 11.24.0 (pic-frame-fit): was 60 / 80 and the zoom cap alone
const PIC_EDGE_BOTTOM = 30; // the credit line at the map box's bottom: no marker or name under it
const picCrCap = w => Math.max(30, Math.floor((w - 32) / 6.6)); // legal-credits: about how many letters of the 13px credit fit across the map box
// the credits block (legal-credits Q8, C3, S6; trip-picture-credits C15): the map's credit (with OpenStreetMap's address to print, and Open-Meteo
// when the profile shows heights) on one line; the photos' credits - each Commons picture's author and licence - on lines of their own under it.
// One source for the app's own picture and for the stamp on an illustrated one (picArtCredits), so the two never say different things
function picCreditLines(m, L, mapCredit, adapted, w) { const ph = picPhotoCredit(L.marks, m.lang === 'en', adapted);
  return [[mapCredit, L.elevBand ? svcCreditText('openmeteo', { as: 'elev' }) : ''].filter(Boolean).join(SEP)].concat(ph ? picWrap(ph, picCrCap(w)) : []).filter(Boolean); }
// drawn at the box's bottom, in one group the app knows as its own (data-credit): on a light strip when there are several lines or `strip` asks
function picCreditsSVG(mb, crLines, strip) { if (!crLines.length) return ''; const e = escH; let s = '';
  if (strip || crLines.length > 1) { const sh = crLines.length * 16 + 8; s += `<rect class="pic-credits" x="${mb.x}" y="${mb.y + mb.h - sh}" width="${mb.w}" height="${sh}" fill="#fff" fill-opacity="${strip ? '.9' : '.82'}"/>`;
    crLines.forEach((t, i) => { s += `<text x="${mb.x + 16}" y="${mb.y + mb.h - 12 - (crLines.length - 1 - i) * 16}" font-size="13" fill="#555">${e(t)}</text>`; }); }
  else s += `<text x="${mb.x + 16}" y="${mb.y + mb.h - 12}" font-size="13" fill="#555" stroke="#fff" stroke-width="3" paint-order="stroke">${e(crLines[0])}</text>`;
  return `<g data-credit="app">${s}</g>`; }
// the map credit of the base an illustrated version was drawn on: the AI always gets the schematic base (picArrangement), so its data's credit
function picBaseCredit(id, L) { return L && L.fit ? schemCredit(picSchemNow(id, L.fit)) : ''; }
function picLayout(m) {
  const B = picBoxes(m), mb = B.map, city = m.kind === 'city', inP = m.pts.filter(x => x.lv !== 'out');
  const elevBand = !city && m.frame.elev && m.D.records.some(r => r[0] === '⛰️') ? 150 : 0;
  // legal-credits (Q8): the photos' credits take lines of their own at the map box's bottom (the credits strip) - kept clear of markers and the profile
  const phCr = picPhotoCredit(inP, m.lang === 'en', m.look === 'drawn'), crExtra = phCr ? 16 * picWrap(phCr, picCrCap(mb.w)).length + 6 : 0;
  // 11.24.0 (small-ui-set D, pic-frame-fit; decisions 2026-11-18 · The trip picture's map area): the area covers the union of the places
  // marked "היינו" (shown or not), the points shown and, in the route kind, the skeleton - which points are drawn is unchanged (picDefaultLv);
  // with no visited place, the shown points as before. A city is framed by the main cluster of that union (far shown points get edge arrows).
  const inK = new Set(inP.map(x => x.key)), area = inP.map(x => ({ c: x.c, name: x.text, x, shown: true }));
  m.pts.forEach(x => { if (x.type === 'place' && x.visited && x.c && !inK.has(x.key)) area.push({ c: x.c, name: x.text, x, shown: false }); });
  if (!city) picSkeleton(m).forEach(q => { if (q.c && !inK.has(q.key)) area.push({ c: q.c, name: '', x: null, shown: false }); });
  let core = inP, far = [], center = null, fitAt = area;
  if (city) { const cl = mainCluster(area); fitAt = cl.core; core = cl.core.filter(q => q.shown).map(q => q.x); far = cl.far.filter(q => q.shown); center = cl.center; }
  const iw = mb.w - 40, ih = mb.h - 20 - B.topPad - elevBand - crExtra;
  // margins that keep a marker and its name clear of the box's edges (PIC_FIT_PAD), and at least about 1 km across (PIC_FIT_MIN_KM)
  const fit = core.length ? mercFit(fitAt.map(q => q.c), iw, ih, PIC_FIT_PAD[city ? 'city' : 'route'], city ? 17 : 12, PIC_FIT_MIN_KM) : null;
  if (fit) Object.assign(fit, { ox: 20, oy: B.topPad, bw: mb.w, bh: mb.h, kind: city ? 'city' : 'route', far, center });
  const X = c => mb.x + 20 + fit.x(c.lng), Y = c => mb.y + B.topPad + fit.y(c.lat);
  // merged markers: one per group, at the biggest member
  const mergedOf = new Map(); m.merges.forEach((g, i) => g.forEach(k => mergedOf.set(k, i)));
  const marks = []; const done = new Set();
  core.forEach(x => { if (done.has(x.key)) return; const gi = mergedOf.get(x.key);
    if (gi != null) { const mem = m.merges[gi].map(k => core.find(q => q.key === k)).filter(Boolean); mem.forEach(q => done.add(q.key)); if (!mem.length) return;
      const lead = mem.slice().sort((a, b) => PIC_LV_RANK[b.lv] - PIC_LV_RANK[a.lv])[0];
      marks.push({ ...lead, members: mem, merged: gi, text: mem.map(q => q.text).join(SEP), img: (mem.find(q => q.img) || {}).img || null }); }
    else { done.add(x.key); marks.push({ ...x }); } });
  if (!fit) return { B, fit: null, marks: [], elevBand, crExtra, far, center };
  marks.forEach(q => { q.r = picR(q, m.kind); q.tx = X(q.c); q.ty = Y(q.c); q.x0 = q.tx + (q.dx || 0); q.y0 = q.ty + (q.dy || 0); q.x = q.x0; q.y = q.y0; q.fixed = !!(q.dx || q.dy); });
  // spread apart: overlapping markers push each other (the bigger one moves less, one I moved by hand stays)
  const lo = { x: mb.x + 8, y: mb.y + (B.topPad > 20 ? B.topPad : 8), X: mb.x + mb.w - 8, Y: mb.y + mb.h - PIC_EDGE_BOTTOM - elevBand - crExtra }; // 11.24.0 (pic-frame-fit): never under the title on the map (topPad) or the credit line
  for (let it = 0; it < 120; it++) { let moved = false;
    for (let i = 0; i < marks.length; i++) for (let j = i + 1; j < marks.length; j++) { const a = marks[i], b = marks[j];
      let dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy); const need = a.r + b.r + 6; if (d >= need) continue;
      if (d < 0.01) { const ang = (i * 7 + j * 3) * 2.399; dx = Math.cos(ang); dy = Math.sin(ang); d = 1; }
      const ux = dx / d, uy = dy / d, push = need - d; let wa = b.r / (a.r + b.r), wb = a.r / (a.r + b.r);
      if (a.fixed && !b.fixed) { wa = 0; wb = 1; } else if (b.fixed && !a.fixed) { wa = 1; wb = 0; } else if (a.fixed && b.fixed) continue;
      a.x -= ux * push * wa; a.y -= uy * push * wa; b.x += ux * push * wb; b.y += uy * push * wb; moved = true; }
    marks.forEach(q => { q.x = Math.max(lo.x + q.r, Math.min(lo.X - q.r, q.x)); q.y = Math.max(lo.y + q.r, Math.min(lo.Y - q.r, q.y)); });
    if (!moved) break; }
  return { B, fit, marks, elevBand, crExtra, far, center, X, Y, lo };
}
const PIC_DRAW_FILTER = `<filter id="pdraw" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feColorMatrix type="saturate" values="1.15" result="s"/><feComponentTransfer in="s" result="p"><feFuncR type="discrete" tableValues="0 .3 .55 .78 1"/><feFuncG type="discrete" tableValues="0 .3 .55 .78 1"/><feFuncB type="discrete" tableValues="0 .3 .55 .78 1"/></feComponentTransfer><feConvolveMatrix in="s" order="3" kernelMatrix="-1 -1 -1 -1 8 -1 -1 -1 -1" preserveAlpha="true" result="e"/><feColorMatrix in="e" type="matrix" values="0 0 0 0 .12  0 0 0 0 .12  0 0 0 0 .14  .9 .9 .9 0 -.12" result="ink"/><feComposite in="ink" in2="p" operator="over"/></filter>`; // 4.47.1: a crisp poster with ink outlines (was blurry); the real drawing is Claude's illustration round
// opts: { edit: selected key or true (marks get data-pt), base: images become "pimg:KEY" placeholders (the Claude file) }
function picSVG(m, style, opts) {
  opts = opts || {}; const L = picLayout(m), B = L.B, D = m.D, f = m.frame, W = B.W, H = B.H, land = B.land, mb = B.map, en = m.lang === 'en';
  PIC_LAST[m.id] = L;
  const prim = /^#[0-9a-f]{6}$/i.test(D.th.primary || '') ? D.th.primary : '#1C2B33', acc = /^#[0-9a-f]{6}$/i.test(D.th.accent || '') ? D.th.accent : '#C08A2E';
  const font = "Rubik, 'Segoe UI', Arial, sans-serif", hfont = HEADING_FONTS.includes(D.th.headingFont) ? `'${D.th.headingFont}', ${font}` : font, e = escH, R = W - 40;
  const title = f.title || String(D.t.name).split(' · ')[0], sub = f.sub || D.dests.map(d => String(d.name).replace(/\s*\(.*$/, '')).join(en ? ' → ' : ' ← ');
  const dates = f.dates && D.t.start ? `${tmFmt('range', [D.t.start, D.t.end], { year: true })}` : '', flags = f.flags ? D.flags.join(' ') : '';
  let s = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="${font}" style="direction:ltr">
  <defs><linearGradient id="mbg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FBF8F1"/><stop offset="1" stop-color="#F1ECDF"/></linearGradient>
  <linearGradient id="mhd" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${acc}"/><stop offset="1" stop-color="${prim}"/></linearGradient>
  <pattern id="mgrid" width="44" height="44" patternUnits="userSpaceOnUse"><path d="M44 0H0V44" fill="none" stroke="${prim}" stroke-opacity=".06" stroke-width="2"/></pattern>
  <filter id="msh"><feDropShadow dx="0" dy="3" stdDeviation="4" flood-opacity=".22"/></filter>${m.look === 'drawn' ? PIC_DRAW_FILTER : ''}</defs>
  <rect width="${W}" height="${H}" fill="url(#mbg)"/>`;
  const cover = photoOff(opts) ? null : D.cover;
  if (!f.none && f.band) { const bandH = B.bandH, cr = land ? 78 : 96; let tx = R - 10;
    s += `<rect width="${W}" height="${bandH}" fill="url(#mhd)"/>`;
    if (cover) { const cx = R - cr, cy = bandH / 2; tx = R - 2 * cr - 30;
      s += `<clipPath id="mcov"><circle cx="${cx}" cy="${cy}" r="${cr}"/></clipPath>${photoImageSVG(D.coverKey, cover, cx - cr, cy - cr, 2 * cr, 2 * cr, ' clip-path="url(#mcov)"')}<circle cx="${cx}" cy="${cy}" r="${cr}" fill="none" stroke="#fff" stroke-width="6"/>`; }
    const big = Math.min(land ? 64 : 70, Math.floor((tx - 60) / Math.max(title.length, 6) * 1.7));
    s += `<text x="${tx}" y="${bandH * .33}" text-anchor="end" fill="#fff" font-size="24" opacity=".92">${dates}  ${flags}</text>
  <text x="${tx}" y="${bandH * .33 + big + 6}" text-anchor="end" fill="#fff" font-size="${big}" font-weight="700" font-family="${hfont}">${e(title)}</text>
  <text x="${tx}" y="${bandH - 28}" text-anchor="end" fill="#fff" font-size="24" opacity=".92">${e(sub.slice(0, 80))}</text>`; }
  const M2 = { cityCount: m.pts.filter(x => x.type === 'city' && !x.extra).length };
  if (!f.none && f.nums.length) { const nums = f.nums.map(k => [picNumVal(k, D, M2), picNumLabel(k, D, en)]).filter(x => x[0]);
    const ny = B.bandH + 22, nh = B.nums, nw = (W - 80) / Math.max(nums.length, 1);
    nums.forEach(([n, l], i) => { const x = R - nw * i - nw / 2;
      s += `<rect x="${x - nw / 2 + 8}" y="${ny}" width="${nw - 16}" height="${nh}" rx="18" fill="#fff" filter="url(#msh)"/><text x="${x}" y="${ny + nh * .52}" text-anchor="middle" font-size="${land ? 34 : 40}" font-weight="700" fill="${prim}">${typeof n === 'number' ? n.toLocaleString(en ? 'en-US' : 'he-IL') : e(n)}</text><text x="${x}" y="${ny + nh * .84}" text-anchor="middle" font-size="18" fill="#5A5D63">${e(l)}</text>`; }); }
  // highlights: a side column (landscape) or a row under the map (portrait)
  const hiItem = (h, x, y, r, ti) => (h.img && !photoOff(opts)) ? `<clipPath id="hc${ti}"><circle cx="${x}" cy="${y}" r="${r}"/></clipPath>${photoImageSVG(h.photo, h.img, x - r, y - r, 2 * r, 2 * r, ` clip-path="url(#hc${ti})"`)}<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${acc}" stroke-width="4"/>`
    : `<circle cx="${x}" cy="${y}" r="${r}" fill="${acc}" fill-opacity=".16"/><text x="${x}" y="${y + r * .36}" text-anchor="middle" font-size="${r}">${h.p ? (ICON_EMOJI[h.p.icon] || '✨') : '✨'}</text>`;
  if (!f.none && B.hs && B.hs.length) { const hs = B.hs;
    if (land) { const cx = B.cx; let y = B.top + 10; s += `<text x="${cx - 10}" y="${y + 20}" text-anchor="end" font-size="20" font-weight="700" fill="${acc}">${en ? '✨ Highlights' : '✨ רגעי השיא'}</text>`; y += 34;
      hs.slice(0, Math.max(1, Math.floor((B.bottom - y) / 92))).forEach((h, i) => { s += hiItem(h, cx - 46, y + 38, 36, i) + `<text x="${cx - 96}" y="${y + 34}" text-anchor="end" font-size="19" font-weight="700" fill="${prim}">${e(String(h.name || h.text).slice(0, 24))}</text>${h.name && h.text ? `<text x="${cx - 96}" y="${y + 58}" text-anchor="end" font-size="15" fill="#5A5D63">${e(String(h.text).slice(0, 30))}</text>` : ''}`; y += 92; }); }
    else { const y = mb.y + mb.h + 20 + (B.col ? 88 : 0), hw = (W - 80) / hs.length;
      hs.forEach((h, i) => { const x = R - hw * i - hw / 2; s += hiItem(h, x, y + 50, 44, i) + `<text x="${x}" y="${y + 124}" text-anchor="middle" font-size="19" font-weight="700" fill="${prim}">${e(String(h.name || h.text).slice(0, Math.floor(hw / 11)))}</text>${h.name && h.text ? `<text x="${x}" y="${y + 146}" text-anchor="middle" font-size="15" fill="#5A5D63">${e(String(h.text).slice(0, Math.floor(hw / 9)))}</text>` : ''}`; }); } }
  // the map box and its background
  s += `<rect x="${mb.x}" y="${mb.y}" width="${mb.w}" height="${mb.h}" rx="${B.rx}" fill="#fff"${B.rx ? ' filter="url(#msh)"' : ''}/><rect x="${mb.x}" y="${mb.y}" width="${mb.w}" height="${mb.h}" rx="${B.rx}" fill="url(#mgrid)"/>`;
  let bg = '', credit = '';
  if (L.fit && style === 'map') { const r = picBgFind(m.id, L.fit); if (r) { const f = L.fit, g = r.geo, X = wx => mb.x + f.ox + (wx - f.cx) * f.A + f.w / 2, Y = wy => mb.y + f.oy + (wy - f.cy) * f.A + f.h / 2, cid = 'mbc' + Math.random().toString(36).slice(2, 7);
      bg = `<clipPath id="${cid}"><rect x="${mb.x}" y="${mb.y}" width="${mb.w}" height="${mb.h}" rx="${B.rx}"/></clipPath><image clip-path="url(#${cid})" ${svgHref(r.url)} x="${X(g.x0).toFixed(1)}" y="${Y(g.y0).toFixed(1)}" width="${((g.x1 - g.x0) * f.A).toFixed(1)}" height="${((g.y1 - g.y0) * f.A).toFixed(1)}" preserveAspectRatio="none"/>`; credit = r.credit; } }
  if (L.fit && style !== 'map') { const data = picSchemNow(m.id, L.fit); if (data) { bg = schemSVG(data, shiftFit(L.fit, 20, B.topPad), mb, D.th, land ? 19 : 20); credit = schemCredit(data); } } // legal-credits (C2): from what the background was drawn of, never a fixed string
  s += `<clipPath id="mbox"><rect x="${mb.x}" y="${mb.y}" width="${mb.w}" height="${mb.h}" rx="${B.rx}"/></clipPath><svg x="${mb.x}" y="${mb.y}" width="${mb.w}" height="${mb.h}" overflow="hidden" viewBox="${mb.x} ${mb.y} ${mb.w} ${mb.h}"><g clip-path="url(#mbox)">${bg}`;
  if (L.fit) s += picPointsSVG(m, L, prim, acc, opts);
  if (L.fit && L.far.length) s += edgeArrowsSVG(shiftFit(L.fit, 20, B.topPad), mb, L.far.map(q => ({ c: q.c, name: q.name })), L.center, prim, land ? 19 : 21);
  // legal-credits (Q8, C3, S6): the map's credit (with OpenStreetMap's address to print, and Open-Meteo when the profile shows heights) on one line;
  // the photos' credits - each Commons picture's author and licence - on lines of their own under it, on a light strip when there are any
  s += picCreditsSVG(mb, picCreditLines(m, L, credit, m.look === 'drawn', mb.w), false);
  if (f.none && f.small === 'small') { const fs = land ? 34 : 38; s += `<rect x="${W - 40 - Math.min(W - 80, title.length * fs * .6 + 60)}" y="18" width="${Math.min(W - 80, title.length * fs * .6 + 60)}" height="${fs + 26}" rx="${(fs + 26) / 2}" fill="#fff" fill-opacity=".9" filter="url(#msh)"/><text x="${W - 70}" y="${18 + fs + 4}" text-anchor="end" font-size="${fs}" font-weight="700" fill="${prim}" font-family="${hfont}">${e(title)}${dates ? ` <tspan font-size="${Math.round(fs * .5)}" font-weight="400" fill="#5A5D63">${dates}</tspan>` : ''}</text>`; }
  s += '</g></svg>';
  if (!f.none && B.col) { const col = B.col, cy = mb.y + mb.h + 14, cx0 = mb.x, cwid = R - cx0, found = (col.found || []).length, n = Math.min(col.total, 60), ic = ICON_EMOJI[col.icon] || '🗿', sz = Math.min(30, (cwid - 330) / n);
    s += `<rect x="${cx0}" y="${cy}" width="${cwid}" height="70" rx="20" fill="${col.color || prim}" fill-opacity=".12"/><text x="${R - 22}" y="${cy + 45}" text-anchor="end" font-size="24" font-weight="700" fill="${prim}">${ic} ${en ? `found ${found} of ${col.total}` : `נמצאו ${found} מתוך ${col.total}`}</text>`;
    for (let i = 0; i < n; i++) s += `<text x="${R - 320 - i * sz}" y="${cy + 46}" font-size="${(sz * .85).toFixed(1)}" text-anchor="middle" opacity="${i < Math.round(found * n / col.total) ? 1 : .18}">${ic}</text>`; }
  if (!f.none && f.foot) s += `<text x="${W / 2}" y="${H - 26}" text-anchor="middle" font-size="17" fill="#8A8C90">${e(APP.appTitle)}${SEP}${tmFmt('date', Date.now())}${SEP}v${APP_VERSION}</text>`;
  return s + '</svg>';
}
// the route line, the leader lines, the markers and the labels (inside the map box)
function picPointsSVG(m, L, prim, acc, opts) {
  const e = escH, en = m.lang === 'en', marks = L.marks, X = L.X, Y = L.Y, B = L.B, mb = B.map; let s = '';
  // 11.9.0 (timeline-import, Q1): each day's real path from Google Timeline, under the route and the points (a travel's own path stays)
  // tl-paths (Q2, Q4): walking a solid line, a ride a dashed lighter one, in the --visited token's light value (the picture is drawn light);
  // only with the frame's switch "המסלול שהלכנו" (on by default in a city picture, off in a route picture)
  if (m.frame.path) { const col = tokenLight('--visited', '#2C7830'); tlPaths(m.id).forEach(g => { const r = g.m === 'r';
    const pts = g.p.map(q => { const c = { lat: q[0], lng: q[1] }; return X(c).toFixed(1) + ',' + Y(c).toFixed(1); }).join(' '); // numbers only - escaped all the same (no sink)
    s += `<polyline class="gl-path ${r ? 'gl-ride' : 'gl-walk'}" points="${escH(pts)}" fill="none" stroke="${escH(col)}" stroke-opacity="${r ? '.5' : '.8'}" stroke-width="${r ? 2.5 : 3}"${r ? ' stroke-dasharray="6 7"' : ''} stroke-linejoin="round" stroke-linecap="round"/>`; }); }
  // 🗺️ route: the skeleton (cities in the picture, or else the stays in it) in arrival order, with the real way between them
  if (m.kind === 'route') { const sk = picSkeleton(m); for (let i = 1; i < sk.length; i++) { const a = sk[i - 1], c = sk[i], x1 = X(a.c), y1 = Y(a.c), x2 = X(c.c), y2 = Y(c.c);
    if (c.mode === 'flight') { const mx = (x1 + x2) / 2, my = (y1 + y2) / 2 - Math.hypot(x2 - x1, y2 - y1) * .22; s += `<path d="M${x1.toFixed(0)} ${y1.toFixed(0)} Q ${mx.toFixed(0)} ${my.toFixed(0)} ${x2.toFixed(0)} ${y2.toFixed(0)}" fill="none" stroke="${acc}" stroke-width="5" stroke-dasharray="14 10" stroke-linecap="round"/>${Math.hypot(x2 - x1, y2 - y1) > 140 ? `<text x="${mx.toFixed(0)}" y="${(my + 24).toFixed(0)}" text-anchor="middle" font-size="24">✈️</text>` : ''}`; }
    else s += `<line x1="${x1.toFixed(0)}" y1="${y1.toFixed(0)}" x2="${x2.toFixed(0)}" y2="${y2.toFixed(0)}" stroke="${prim}" stroke-width="6" stroke-linecap="round" stroke-opacity=".85"/>`; } }
  // 11.2.0 (Q8): an outing - a light dashed loop from its stop to its goal and back, the goal a small ring with its name (no number)
  (m.D.outs || []).forEach(o => { const x1 = X(o.c), y1 = Y(o.c), x2 = X(o.g), y2 = Y(o.g), d = Math.hypot(x2 - x1, y2 - y1); if (d < 8) return; const nx = -(y2 - y1) / d * d * .2, ny = (x2 - x1) / d * d * .2, mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    s += `<path d="M${x1.toFixed(0)} ${y1.toFixed(0)} Q ${(mx + nx).toFixed(0)} ${(my + ny).toFixed(0)} ${x2.toFixed(0)} ${y2.toFixed(0)} Q ${(mx - nx).toFixed(0)} ${(my - ny).toFixed(0)} ${x1.toFixed(0)} ${y1.toFixed(0)}" fill="none" stroke="#5A5D63" stroke-width="4" stroke-dasharray="10 8" stroke-opacity=".6" stroke-linecap="round"/><circle cx="${x2.toFixed(0)}" cy="${y2.toFixed(0)}" r="9" fill="#fff" stroke="${prim}" stroke-width="3"/><text x="${x2.toFixed(0)}" y="${(y2 - 16).toFixed(0)}" text-anchor="middle" font-size="16" fill="${prim}" stroke="#fff" stroke-width="5" paint-order="stroke">${e(String(o.name).slice(0, 28))}</text>`; });
  // leader lines: a marker that was spread away from its spot keeps a thin line and a dot at the true place
  // 4.47.1: only when the true place is outside the marker (no stub peeking out from under it); the line stops at the
  // marker's edge, thin, on a white halo so it reads over any background
  marks.forEach(q => { const d = Math.hypot(q.x - q.tx, q.y - q.ty); if (d <= q.r + 3) return; const ex = q.x - (q.x - q.tx) / d * (q.r + 1), ey = q.y - (q.y - q.ty) / d * (q.r + 1);
    s += `<line x1="${q.tx.toFixed(1)}" y1="${q.ty.toFixed(1)}" x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}" stroke="#fff" stroke-opacity=".9" stroke-width="4" stroke-linecap="round"/><line x1="${q.tx.toFixed(1)}" y1="${q.ty.toFixed(1)}" x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}" stroke="${prim}" stroke-opacity=".7" stroke-width="1.6" stroke-linecap="round"/><circle cx="${q.tx.toFixed(1)}" cy="${q.ty.toFixed(1)}" r="3.5" fill="${prim}" stroke="#fff" stroke-width="1.5"/>`; });
  const order = marks.slice().sort((a, b) => a.r - b.r); // small under big
  const sel = typeof opts.edit === 'string' ? opts.edit : null;
  order.forEach((q, i) => { const x = q.x.toFixed(1), y = q.y.toFixed(1), r = q.r;
    let g = '';
    const qi = photoOwn(q.img), imgUrl = qi ? (opts.base ? `pimg:${qi.key || q.key}` : qi.url) : null;
    if (imgUrl) { g += `<clipPath id="pc${i}"><circle cx="${x}" cy="${y}" r="${r}"/></clipPath><image ${svgHref(imgUrl)} x="${(q.x - r).toFixed(1)}" y="${(q.y - r).toFixed(1)}" width="${2 * r}" height="${2 * r}" preserveAspectRatio="xMidYMid slice" clip-path="url(#pc${i})"${m.look === 'drawn' ? ' filter="url(#pdraw)"' : ''}/>`;
      g += `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${q.type === 'place' ? picRing(q, acc) : prim}" stroke-width="${q.lv === 'L' ? 5 : 4}"/>`; }
    else if (q.type === 'city') { const nums = picCityNums(m, q); g += nums.length > 1 ? `<rect x="${(q.x - Math.max(r, nums.join('·').length * 6 + 8)).toFixed(1)}" y="${(q.y - r).toFixed(1)}" width="${(2 * Math.max(r, nums.join('·').length * 6 + 8)).toFixed(1)}" height="${2 * r}" rx="${r}" fill="${prim}" stroke="#fff" stroke-width="4"/>` : `<circle cx="${x}" cy="${y}" r="${r}" fill="${prim}" stroke="#fff" stroke-width="4"/>`;
      g += `<text x="${x}" y="${(q.y + r * .34).toFixed(1)}" text-anchor="middle" font-size="${Math.round(r * (nums.join('·').length > 3 ? .7 : .9))}" font-weight="700" fill="#fff">${nums.length ? nums.join('·') : '•'}</text>`; }
    else if (q.type === 'hotel') g += `<circle cx="${x}" cy="${y}" r="${r}" fill="${prim}" stroke="#fff" stroke-width="4"/><text x="${x}" y="${(q.y + r * .38).toFixed(1)}" text-anchor="middle" font-size="${Math.round(r * 1.05)}">🏨</text>`;
    else if (q.type === 'extra') g += `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" stroke="${acc}" stroke-width="4"/><text x="${x}" y="${(q.y + r * .38).toFixed(1)}" text-anchor="middle" font-size="${Math.round(r * 1.05)}">${SY.place}</text>`;
    else g += `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" stroke="${picRing(q, acc)}" stroke-width="${q.lv === 'S' ? 3 : 4}"/>${q.lv === 'S' && r < 17 ? '' : `<text x="${x}" y="${(q.y + r * .38).toFixed(1)}" text-anchor="middle" font-size="${Math.round(r * 1.05)}">${ICON_EMOJI[q.icon] || SY.place}</text>`}`;
    if (q.members) g += `<circle cx="${(q.x + r * .72).toFixed(1)}" cy="${(q.y - r * .72).toFixed(1)}" r="12" fill="${acc}" stroke="#fff" stroke-width="2.5"/><text x="${(q.x + r * .72).toFixed(1)}" y="${(q.y - r * .72 + 5).toFixed(1)}" text-anchor="middle" font-size="14" font-weight="700" fill="#fff">${q.members.length}</text>`;
    if (sel && (sel === q.key || (q.members && q.members.some(k => k.key === sel)))) g += `<circle cx="${x}" cy="${y}" r="${r + 7}" fill="none" stroke="${acc}" stroke-width="3" stroke-dasharray="6 5"/>`;
    s += opts.edit || opts.base ? `<g data-pt="${e(q.key)}"${q.lv === 'L' ? ' filter="url(#msh)"' : ''}>${g}</g>` : (q.lv === 'L' ? `<g filter="url(#msh)">${g}</g>` : g); });
  // labels: never over a marker or another label; a name I switched on is placed even when it has to cover something
  const boxes = marks.map(q => [q.x - q.r - 2, q.y - q.r - 2, q.x + q.r + 2, q.y + q.r + 2]), labels = [];
  const lo = L.lo || { x: mb.x + 4, y: mb.y + 4, X: mb.x + mb.w - 4, Y: mb.y + mb.h - 4 }; // 11.24.0 (pic-frame-fit): a name keeps the markers' limits (the title on the map, the credit line)
  const inBox = r => r[0] >= lo.x - 4 && r[2] <= lo.X + 4 && r[1] >= lo.y - 4 && r[3] <= lo.Y + (L.elevBand ? L.elevBand : 0);
  const free = r => inBox(r) && !boxes.some(q => r[0] < q[2] && r[2] > q[0] && r[1] < q[3] && r[3] > q[1]);
  const tw = (t, fs) => String(t).length * fs * 0.56 + 10;
  const place = (q, lines, force) => { const gap = q.r + 6, h = lines.reduce((a, l) => a + l[1] + 6, 0), w = Math.max(...lines.map(l => tw(l[0], l[1])));
    const spots = [['middle', q.x, q.y + gap], ['middle', q.x, q.y - gap - h + 6], ['start', q.x + gap, q.y - h / 2 + 6], ['end', q.x - gap, q.y - h / 2 + 6]];
    let pick = null; for (const sp of spots) { const [an, sx, sy] = sp, x0 = an === 'middle' ? sx - w / 2 : an === 'end' ? sx - w : sx, r = [x0, sy, x0 + w, sy + h]; if (free(r)) { pick = [sp, r]; break; } }
    if (!pick && force) { for (const sp of spots) { const [an, sx, sy] = sp, x0 = an === 'middle' ? sx - w / 2 : an === 'end' ? sx - w : sx, r = [x0, sy, x0 + w, sy + h]; if (inBox(r)) { pick = [sp, r]; break; } } if (!pick) { const sp = spots[0]; pick = [sp, [sp[1] - w / 2, sp[2], sp[1] + w / 2, sp[2] + h]]; } }
    if (!pick) return false; const [[an, sx, sy], r] = pick; boxes.push(r); let yy = sy;
    lines.forEach(([t, fs, wt, fill]) => { yy += fs; labels.push(`<text x="${sx.toFixed(0)}" y="${yy.toFixed(0)}" text-anchor="${an}" font-size="${fs}" font-weight="${wt}" fill="${fill}" stroke="#fff" stroke-width="${fs > 17 ? 6 : 5}" paint-order="stroke">${e(t)}</text>`); yy += 6; });
    return true; };
  const want = marks.filter(q => q.label).sort((a, b) => (!!b.forced) - (!!a.forced) || PIC_LV_RANK[b.lv] - PIC_LV_RANK[a.lv] || (a.type === 'city' ? -1 : 0) - (b.type === 'city' ? -1 : 0));
  want.forEach(q => { const fs = q.lv === 'L' ? 22 : q.lv === 'M' ? 19 : 16, name = [String(q.text).slice(0, 34) + (q.rt === 'love' && q.type === 'place' ? ' ❤️' : ''), fs, 700, prim];
    const sub = q.type === 'city' && q.nights ? [en ? PIC_EN.nights(q.nights) : `${q.nights} לילות`, 15, 400, '#5A5D63'] : null;
    if (!(sub && place(q, [name, sub], false))) place(q, [name], !!q.forced); });
  s += labels.join('');
  if (L.elevBand) { // elevation profile of the stays and the highest place, under the map
    const D = m.D, ev = D.stops.map(st => ({ n: st.city || st.name, e: knownElev(st.c) })).filter(x => x.e != null), b = { x: mb.x + 20, y: mb.y, w: mb.w - 40, h: mb.h - 10 - (L.crExtra || 0) };
    const top = D.visited.map(p => ({ n: p.name, e: p.elev != null ? p.elev : knownElev(snapCoord(p)) })).filter(x => x.e != null).sort((a, c) => c.e - a.e)[0];
    const pts2 = ev.concat(top && !ev.some(x => x.n === top.n) ? [top] : []); if (pts2.length) { const maxE = Math.max(...pts2.map(x => x.e), 500), by = b.y + b.h - 18, bw = b.w - 40;
      const P = pts2.map((x, i) => [b.x + b.w - 20 - (pts2.length === 1 ? bw / 2 : i * bw / (pts2.length - 1)), by - (x.e / maxE) * (L.elevBand - 50)]);
      s += `<path d="M${P[0][0].toFixed(0)} ${by} ${P.map(q => `L${q[0].toFixed(0)} ${q[1].toFixed(0)}`).join(' ')} L${P[P.length - 1][0].toFixed(0)} ${by} Z" fill="${prim}" fill-opacity=".14" stroke="${prim}" stroke-width="3"/>`;
      pts2.forEach((x, i) => s += `<text x="${P[i][0].toFixed(0)}" y="${(P[i][1] - 8).toFixed(0)}" text-anchor="middle" font-size="15" fill="${prim}">${x === top ? '🏔️ ' : ''}${x.e.toLocaleString('he-IL')} ${en ? 'm' : 'מ׳'}</text>`); } }
  return s;
}
function picRing(q, acc) { return q.type !== 'place' ? acc : q.lv === 'L' ? acc : rateColor(q.rt); }
// the numbers of a city on the route ("2·5" when we came back to it)
function picCityNums(m, q) { if (q.extra) return []; const sk = picSkeleton(m); return sk.map((x, i) => x.key === q.key ? i + 1 : null).filter(Boolean); }
// the skeleton of a route picture: the cities in the picture (or else its stays), in arrival order, with the way to each
function picSkeleton(m) {
  const D = m.D, cities = m.pts.filter(x => x.type === 'city' && x.lv !== 'out'), useCities = cities.length > 0;
  const travels = tripMoves(D.t).slice().sort((a, b) => String(a.date).localeCompare(String(b.date))); // 11.2.0: every travel but the outings (Q8)
  const modeTo = (from, i) => { const tr = travels.find(x => x.date === from) || travels[i]; return tr ? tr.mode : null; };
  let seq = [];
  if (useCities) { const { seq: cs } = picCities(D); cs.forEach(g => { const x = cities.find(c => c.key === g.key); if (x) seq.push({ key: x.key, c: x.c, from: D.stops[g.first].from, i: g.first }); }); }
  else m.pts.filter(x => x.type === 'hotel' && x.lv !== 'out').sort((a, b) => a.order - b.order).forEach(x => seq.push({ key: x.key, c: x.c, from: x.from, i: x.order - 1 }));
  seq = seq.filter((x, i) => i === 0 || x.key !== seq[i - 1].key);
  // a city I added (one we passed through) goes where it adds the least distance
  cities.filter(x => x.extra).forEach(x => { if (seq.some(q => q.key === x.key)) return; let best = seq.length, add = Infinity;
    for (let i = 0; i <= seq.length; i++) { const a = seq[i - 1], b = seq[i], d = (a ? kmBetween(a.c, x.c) : 0) + (b ? kmBetween(x.c, b.c) : 0) - (a && b ? kmBetween(a.c, b.c) : 0); if (d < add) { add = d; best = i; } }
    seq.splice(best, 0, { key: x.key, c: x.c, from: null, i: -1, passed: true }); });
  seq.forEach((x, i) => { if (!i) return; const km = kmBetween(seq[i - 1].c, x.c), md = x.from ? modeTo(x.from, x.i) : null; x.mode = md || (km > 400 ? 'flight' : 'bus'); });
  return seq;
}
// ---- the picture's background, for its whole map box ----
function picBgPre(id) { return [id, 'picbg', baseMapId(), ''].join('|'); }
// a stored background that covers this frame at a similar scale (sharp enough, not wastefully coarse)
function picBgFind(id, fit) { if (!fit) return null; const pre = picBgPre(id), x0 = fit.cx + (-fit.ox - fit.w / 2) / fit.A, x1 = fit.cx + (-fit.ox + fit.bw - fit.w / 2) / fit.A, y0 = fit.cy + (-fit.oy - fit.h / 2) / fit.A, y1 = fit.cy + (-fit.oy + fit.bh - fit.h / 2) / fit.A;
  let best = null; MEMO_BG.forEach((r, k) => { if (!k.startsWith(pre) || !r.geo) return; const g = r.geo, q = fit.A / g.A;
    if (q < 0.75 || q > 1.45 || x0 < g.x0 || x1 > g.x1 || y0 < g.y0 || y1 > g.y1) return; if (!best || Math.abs(Math.log(q)) < Math.abs(Math.log(fit.A / best.geo.A))) best = r; }); return best; }
function picBgKey(id, fit) { return [id, 'pic', fit.A.toFixed(2), fit.cx.toFixed(7), fit.cy.toFixed(7), fit.bw, fit.bh, baseMapId()].join('|'); }
const PIC_GEO_LOADED = new Set();
async function picLoadGeo(id) { if (PIC_GEO_LOADED.has(id)) return; PIC_GEO_LOADED.add(id);
  const keys = await GEO_DB.keys();
  for (const k of keys) if (String(k).startsWith('schem:' + id + ':')) await GEO_DB.get(k); }
// the picture's whole map box on the globe [south, west, north, east] - not only its points: the box is wider than the points
// along one side (a landscape picture of a city spread north-south), and the background must fill it (phone-round-1-fixes P8, 11.14.0)
function picFrameBB(fit) { return [fit.latAt(fit.bh - fit.oy), fit.lngAt(-fit.ox), fit.latAt(-fit.oy), fit.lngAt(fit.bw - fit.ox)]; }
const PIC_SCHEM_PAD = 0.1; // the schematic data is asked for the map box and a margin, so a small change of the frame reuses it
// schematic data that covers the picture's map box: any loaded piece for the trip whose area holds the box and is not much coarser
function picSchemNow(id, fit) { if (!fit) return null; const kind = fit.kind, need = picFrameBB(fit), nw = need[3] - need[1], nh = need[2] - need[0];
  let best = null, bestA = Infinity; const pre = `schem:${id}:${kind}:`;
  GEO_MEM.forEach((v, k) => { if (!String(k).startsWith(pre) || !v) return; const bb = String(k).slice(pre.length).split(',').map(Number);
    if (bb.length !== 4 || bb[0] > need[0] || bb[1] > need[1] || bb[2] < need[2] || bb[3] < need[3]) return;
    const w = bb[3] - bb[1], h = bb[2] - bb[0]; if (w > Math.max(nw, 0.02) * 5 && h > Math.max(nh, 0.02) * 5) return; // too coarse for these points
    if (w * h < bestA) { bestA = w * h; best = v; } });
  return best; }
async function picEnsureBg(id, force) {
  const m = picModel(id); if (!m) return null; await picLoadGeo(id); const style = force || mementoStyleOf(id); if (style !== 'map' && style !== 'schem') return null;
  const L = picLayout(m); if (!L.fit) return null;
  if (style === 'schem') { const have = picSchemNow(id, L.fit); if (have) return have; const bb = picFrameBB(L.fit); // P8: the box, not the points (their bbox left the box's sides blank)
    return ensureSchemData(id, L.fit.kind, [{ c: { lat: bb[0], lng: bb[1] } }, { c: { lat: bb[2], lng: bb[3] } }], PIC_SCHEM_PAD); }
  { const have = picBgFind(id, L.fit); if (have) return have; } const key = picBgKey(id, L.fit);
  if (svcNetDown()) { memBgStatus({ svc: 'picTiles', n: 0, of: 1, what: 'מפה לתמונה' }); return null; } if (geoFailed(key)) return null; if (GEO_BUSY.has(key)) return GEO_BUSY.get(key);
  // 4.46.5: drawn with a margin around the frame, and kept with its place on the globe: a change that moves or resizes the
  // frame a little (a point in or out, a new name) reuses it instead of loading the whole map again
  const fit = L.fit, px = Math.round(fit.bw * 0.25), py = Math.round(fit.bh * 0.25), p = (async () => { const r = await renderTileImage(fit, -fit.ox - px, -fit.oy - py, fit.bw + 2 * px, fit.bh + 2 * py, 2.4, baseMapId(), (a, b) => memBgStatus({ svc: 'picTiles', n: a, of: b }), { svc: 'picTiles', trip: id });
    GEO_BUSY.delete(key);
    if (r) { const w = x => fit.cx + (x - fit.w / 2) / fit.A, h = y => fit.cy + (y - fit.h / 2) / fit.A;
      r.geo = { x0: w(-fit.ox - px), x1: w(-fit.ox + fit.bw + px), y0: h(-fit.oy - py), y1: h(-fit.oy + fit.bh + py), A: fit.A };
      MEMO_BG.set(picBgPre(id) + Date.now().toString(36), r); { const ks = [...MEMO_BG.keys()].filter(k => k.startsWith(picBgPre(id))); ks.slice(0, Math.max(0, ks.length - 3)).forEach(k => MEMO_BG.delete(k)); } memBgStatus(null); } else { SCHEM_FAILED.set(key, 'tiles'); memBgStatus({ svc: 'picTiles', n: 0, of: 1, what: 'מפה לתמונה', fail: 1 }); svcTrouble(baseMapId() === 'topo' ? 'opentopomap' : baseMapId() === 'hybrid' ? 'esri' : 'openfreemap', 'picTiles', 'מפה לתמונת הטיול לא נבנתה'); }
    return r; })();
  GEO_BUSY.set(key, p); return p;
}
function picBgReady(id) { const style = mementoStyleOf(id); if (style !== 'map' && style !== 'schem') return true; const m = picModel(id); if (!m) return true; const L = picLayout(m); if (!L.fit) return true;
  return style === 'map' ? !!picBgFind(id, L.fit) : !!picSchemNow(id, L.fit); }
// the picture as it is now (the illustrated version gets my point images in place of its "pimg:" placeholders)
// 11.8.1 (timeline-import step 0b, miss a): the placeholders are found by parsing the (already cleaned) picture and set as attributes - a
// stored value is never written into the markup's text, and nothing is read with regular expressions
function picResolveArt(id, svg, art) {
  let doc; try { doc = new DOMParser().parseFromString(String(svg), 'image/svg+xml'); } catch (e) { return ''; }
  const root = doc && doc.documentElement; if (!root || doc.getElementsByTagName('parsererror').length) return ''; photoPageArt(id, root);
  root.querySelectorAll('*').forEach(el => [...el.attributes].forEach(a => { if (!/(^|:)href$/.test(a.name) || !a.value.startsWith('pimg:')) return;
    const v = MEMO.get(`pimg:${id}:${a.value.slice(5)}`); a.value = v && /^data:image\/(png|jpe?g|gif|webp);base64,[A-Za-z0-9+/=]+$/.test(v) ? v : ''; }));
  picArtCredits(id, root, art || {});
  return new XMLSerializer().serializeToString(root);
}
// trip-picture-credits (C15; decisions 2026-11-24 · Review of the legal-review-2 report, Q7): an illustrated picture's credits come from the app,
// never from what the AI returned - every credit text it left (the base's own group, its strip, any text naming a source or a licence) is
// removed, and the app stamps its own block from the same data as its own picture (the photos as they are now, the base's map credit - live,
// or the one kept when the picture came in - and Open-Meteo's with the heights), on a light strip at the map box's bottom (the picture's bottom
// when its size is no longer the arrangement's). Every way out goes through here: the memory screen, PNG, PDF, print, the summary page
const PIC_CREDIT_RE = /©|\(c\)\s|wikimedia|creativecommons|openstreetmap|openfreemap|openmaptiles|open-meteo|copernicus|mapterhorn|natural earth|world-atlas|esri|overpass|(^|\s)(photos?|תמונות|צילומים)\s*:|(licen[cs]es?|רישיונות|רישיון)\s*:/i;
function picArtCredits(id, root, art) {
  root.querySelectorAll('[data-credit], .pic-credits').forEach(el => el.remove());
  root.querySelectorAll('text').forEach(el => { if (!el.closest('[data-pt]') && PIC_CREDIT_RE.test(el.textContent || '')) el.remove(); }); // a point's own name is locked
  const m = picModel(id); if (!m) return; const L = picLayout(m), vb = String(root.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
  const same = vb.length === 4 && vb[2] === L.B.W && vb[3] === L.B.H, box = same ? L.B.map : vb.length === 4 && vb[2] > 0 && vb[3] > 0 ? { x: vb[0], y: vb[1], w: vb[2], h: vb[3] } : { x: 0, y: 0, w: L.B.W, h: L.B.H };
  const g = picCreditsSVG(box, picCreditLines(m, L, picBaseCredit(id, L) || String(art.cr || '').slice(0, 400), (art.look || m.look) === 'drawn', box.w), true); if (!g) return;
  const d = new DOMParser().parseFromString(g.replace('<g ', '<g xmlns="http://www.w3.org/2000/svg" '), 'image/svg+xml'), el = d.getElementsByTagName('parsererror').length ? null : d.documentElement;
  if (el) root.appendChild(root.ownerDocument.importNode(el, true)); }

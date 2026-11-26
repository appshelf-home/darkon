// ================= INCOMING CONTENT: THE DRAFT MODEL (4.2.0; split from js/incoming-draft.js in diet-mechanism) =================
// The draft as every main screen reads it - its store, items, layers, coordinates, the filter's chips and counts, the banner on top of
// every screen. The draft's own screen, its windows, the improvement round and the approval load on demand (the AI group).
// A new destination or a new trip that comes in (file, paste, or shared straight into the installed app) is shown
// first as a draft: list (and map in the installed app), everything checked, "אישור הכל" at the end of the page.
// Places can be taken out or fixed before approving. The package itself stays as it came: what was taken out of a
// destination becomes a "לא מעניין" status and a fix becomes an edit of this device, so a later update of the same
// destination never brings them back or overwrites them. Places of the trip itself are changed in the trip.
const DRAFT_KEY = PACK.filePrefix + '_draft_v1';
let DRAFT = regRead(null, null, DRAFT_KEY);
let draftView = { sel: null }; // 5.14.0: the draft's filter is FILTER.draft
// 6.1.0: the draft is my data waiting for approval - a change is drawn
function saveDraft() { dataChanged(); if (!DRAFT) { regRawDel(DRAFT_KEY); return; } if (!regWrite(null, DRAFT, DRAFT_KEY)) { showToast('הטיוטה גדולה מכדי להישמר בטלפון. אפשר לאשר אותה עכשיו'); } }
// 11.17.0 (content-may-be-wrong, Q6): a file that came back from Claude - it carries kitVersion and was not written by an app (every file the
// app sends carries kitVersion too, for Claude; an app's own file names its device and ends its signature with " · v<version>");
// review of the night chain Q7 (11.21.0): the one "from Claude" test - the draft's note and the folded "how" steps of Claude's windows both use it
function draftFromClaude(d) { return !!(d && d.kitVersion) && d.device === undefined && !/ · v\d+\.\d+\.\d+$/.test(String(d.signature || '')); }
function needsDraft(data) {
  if (!data || data.app !== BACKUP_APP) return false;
  if (data.kind === 'destination') return !!(data.destination && data.destination.id && !DESTS[data.destination.id]);
  if (data.kind === 'trip') return !!(data.trip && data.trip.id && !STATE.trips[data.trip.id]);
  return false;
}
function draftTitle(D) { const d = D.data; return d.kind === 'trip' ? (d.trip.name || 'טיול') : ((d.destination.meta || {}).name || 'יעד'); }
// destinations in the draft: a destination file is its one destination; a trip file brings only the ones not on the phone yet
function draftNewDests(D) { const d = D.data; return d.kind === 'destination' ? [d.destination] : (d.destinations || []).filter(dp => dp && dp.id && !DESTS[dp.id]); }
function draftOldDests(D) { const d = D.data; return d.kind === 'trip' ? (d.destinations || []).filter(dp => dp && dp.id && DESTS[dp.id]) : []; }
function draftDestById(D, id) { return (D.data.destinations || []).concat(D.data.destination ? [D.data.destination] : []).find(x => x && x.id === id) || DESTS[id] || null; }
function draftLayer(dp, lid) { const ls = (dp && dp.meta && dp.meta.layers) || []; return ls.find(l => l.id === Number(lid)) || ls.find(l => l.type === 'lodging') || ls[0] || { id: lid, name: '?', label: '?', color: '#888', icon: 'tourist_attraction' }; }
// 4.26.0: 📚 discoveries added to a draft before approval. They live in the draft itself (D.add, and new layers made for
// them in D.addLayers), marked "📚 נוסף על ידיך"; approval saves them as places I added, over the package (an update of the
// destination never overwrites them), and dropping the draft drops them. Targets: the draft's new destinations, and in a
// trip draft also its destinations that are already on the phone.
function draftAdds(D) { return (D && D.add) || []; }
function draftAddLayers(D) { return (D && D.addLayers) || []; }
function draftTargetDests(D) {
  const out = draftNewDests(D).map(dp => ({ id: dp.id, dp, inst: false }));
  draftOldDests(D).forEach(dp => { if (DESTS[dp.id] && !out.some(x => x.id === dp.id)) out.push({ id: dp.id, dp: DESTS[dp.id], inst: true }); });
  return out;
}
function draftDestLayers(D, destId) {
  const t = draftTargetDests(D).find(x => x.id === destId); if (!t) return [];
  const base = t.inst ? destLayersEff(DESTS[destId]).filter(l => !l.hidden) : ((t.dp.meta && t.dp.meta.layers) || []).filter(l => !l.hidden);
  return base.map(l => ({ ...l, dest: destId })).concat(draftAddLayers(D).filter(l => l.dest === destId).map(l => ({ ...l, draftNew: true })));
}
function draftAddLayer(D, a) { return draftDestLayers(D, a.dest).find(l => String(l.id) === String(a.layer)) || { id: a.layer, name: '?', label: '?', color: '#888', icon: a.icon || 'tourist_attraction' }; }
function textHash(t) { let h = 5381; const x = String(t || '').trim(); for (let i = 0; i < x.length; i++) h = ((h << 5) + h + x.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }
function draftItems(D) {
  const out = [];
  draftNewDests(D).forEach(dp => (dp.places || []).forEach(p => { const key = dp.id + ':' + p.id;
    const q = { ...p, ...(D.fix[key] || {}) }; out.push({ key, src: dp.id, scope: 'dest', dp, p: q, L: draftLayer(dp, q.layer), fixed: !!D.fix[key] }); }));
  if (D.data.kind === 'trip') {
    const t = D.data.trip, lodgeIds = new Set((t.lodging || []).map(l => l.placeId));
    (t.places || []).forEach(p => { const key = 'trip:' + p.id, rd = draftDestById(D, p.dest), dp = rd || draftNewDests(D)[0];
      // 4.39.1: a trip place (a hotel too) belongs to its destination's chip; "🧳 מקומות הטיול" only for places with no destination
      const q = { ...p, ...(D.fix[key] || {}) }; out.push({ key, src: rd && rd.id ? rd.id : 'trip', scope: 'trip', dp, p: q, L: draftLayer(dp, q.layer), fixed: !!D.fix[key], locked: lodgeIds.has(p.id), dupOf: draftGidDup(t, q) }); });
  }
  const tds = draftTargetDests(D);
  draftAdds(D).forEach(a => { const t = tds.find(x => x.id === a.dest); out.push({ key: a.key, src: a.dest, scope: 'add', added: true, dp: t ? t.dp : null, p: a, L: draftAddLayer(D, a), fixed: false }); });
  return out;
}
function draftSources(D) { const its = draftItems(D), has = id => its.some(x => x.src === id);
  const s = draftNewDests(D).map(dp => ({ id: dp.id, label: withFlag(destFlagMeta(dp.meta), dp.meta.name) }));
  // 4.39.1: a destination already on the phone gets a chip when the draft holds something of it (trip places, hotels, additions)
  draftOldDests(D).forEach(dp => { if (DESTS[dp.id] && has(dp.id) && !s.some(x => x.id === dp.id)) s.push({ id: dp.id, label: withFlag(destFlag(dp.id), DESTS[dp.id].meta.name) }); });
  if (has('trip')) s.push({ id: 'trip', label: 'מקומות הטיול' });
  return s; }
function draftCoord(p) { // 4.2.2: a fixed point, or one already found for its address
  const c = p.manualCoord || (p.address && GEOCODE_CACHE[p.address]); return c && isFinite(c.lat) && isFinite(c.lng) ? c : null; }
function draftCenterOf(x) { const dp = x.dp || draftDestById(DRAFT, x.p.dest); return dp && dp.meta && dp.meta.center; }
function infoSectionCount(html) { return htmlFrag(html || '').querySelectorAll('.accordion-item').length; }
// 5.14.0: the draft's filter (FILTER.draft) - its layer chips, and what it shows; the screen and the filter window both use these
function draftLayerChips(D, items) {
  const inSrc = (items || draftItems(D)).filter(x => selOn(FILTER.draft.srcs, x.src)), chips = [];
  inSrc.forEach(x => { const k = x.L.type || ('n:' + x.L.name); if (!chips.some(c => c.id === k)) chips.push({ id: k, type: x.L.type || '', label: x.L.type && BASE_TYPES[x.L.type] && new Set(inSrc.filter(y => y.L.type === x.L.type).map(y => y.L.label)).size > 1 ? BASE_TYPES[x.L.type].label : x.L.label, name: x.L.name, color: x.L.color, ik: x.L.icon || (x.L.type && BASE_TYPES[x.L.type] && BASE_TYPES[x.L.type].icon) || '' }); });
  const count = c => inSrc.filter(x => (x.L.type || ('n:' + x.L.name)) === c.id).length;
  chips.sort((a, b) => { const ra = BASE_TYPES[a.type] ? BASE_ORDER.indexOf(a.type) : 99, rb = BASE_TYPES[b.type] ? BASE_ORDER.indexOf(b.type) : 99; return (ra - rb) || (ra === 99 ? count(b) - count(a) : 0); });
  if (FILTER.draft.layers.size && !selNone(FILTER.draft.layers)) { const k = new Set([...FILTER.draft.layers].filter(x => chips.some(c => c.id === x))); FILTER.draft.layers = k.size ? k : new Set(); }
  return { chips, count, inSrc };
}
function draftShown(D, items) { const { inSrc } = draftLayerChips(D, items); // the same item objects as the caller's list (the map adds the hotels by identity)
  return draftRoundFilter(D, inSrc.filter(x => selOn(FILTER.draft.layers, x.L.type || ('n:' + x.L.name)))); } // 4.27.0: ✳ changed in the round, 💬 with a note
function draftFilterActive() { const f = FILTER.draft; return !!(f.srcs.size || f.layers.size || f.changed || f.notes); }
function draftBannerHTML() {
  if (!DRAFT || activeTab === 'draft') return '';
  return `<div class="banner bn-draft draft-banner">${msi('inbox')}<span class="bn-t"><b>טיוטה מחכה לאישור</b><br>${sepTie(escH(draftTitle(DRAFT)))}</span><button type="button" class="bn-btn" data-act="draft.open">לטיוטה</button></div>`; // 10.1.0 (design-1): a discover-violet banner
}
// the draft's notes and round marks as the filter and the map read them (from js/draft-round.js, diet-mechanism)
function itemTarget(x) { return x.scope === 'dest' ? 'place:' + x.key : x.scope === 'trip' ? 'trip-place:' + x.p.id : x.key; }
function targetItemKey(t) { t = String(t || ''); if (t.startsWith('place:')) return t.slice(6); if (t.startsWith('trip-place:')) return 'trip:' + t.slice(11); if (t.startsWith('add:')) return t; return null; }
function dNotes(D) { return (D && D.notes) || {}; }
function noteOf(D, t) { return dNotes(D)[t] || null; }
function openNotes(D) { return Object.entries(dNotes(D)).filter(([, n]) => n.state === 'open'); }
// what else is in the draft besides places: layers, travels, lodging, organized schedule, info sections - each gets 💬
function draftMoreRows(D) {
  const rows = [], d = D.data;
  draftNewDests(D).forEach(dp => { const nm = (dp.meta || {}).name || dp.id;
    ((dp.meta || {}).layers || []).forEach(l => rows.push({ group: '🎨 שכבות', t: `layer:${dp.id}:${l.id}`, label: `${l.name}${draftNewDests(D).length > 1 ? SEP + nm : ''}` }));
    /* 10.15.0: a file's section head (with or without data-icon); 11.8.1: its leading words, read by parsing */ htmlFrag(dp.info || '').querySelectorAll('.accordion-header').forEach(h => { let title = ''; for (const n of h.childNodes) { if (n.nodeType !== 3) break; title += n.nodeValue; } title = title.trim(); rows.push({ group: 'ℹ️ מידע כללי', t: `info:${dp.id}:${title}`, label: `${title}${draftNewDests(D).length > 1 ? SEP + nm : ''}` }); }); });
  if (d.kind === 'trip') { const t = d.trip;
    rows.push({ group: '🧳 הטיול', t: 'trip', label: `${t.name || 'הטיול'}${SEP}${tmFmt('range', [t.start, t.end], { year: true })}` });
    (t.travels || []).forEach(x => rows.push({ group: '✈️ נסיעות', t: `travel:${x.id}`, label: `${(TRAVEL_MODES[x.mode] || TRAVEL_MODES.flight)[1]} ${x.from || ''} ← ${x.to || ''}${SEP}${tmFmt('date', x.date)}${x.number ? SEP + x.number : ''}` }));
    (t.lodging || []).forEach(x => rows.push({ group: '🏨 לינות', t: `lodging:${x.id}`, label: `${x.name || ''}${SEP}${tmFmt('range', [x.checkIn, x.checkOut], { year: true })}` }));
    (t.schedule || []).slice().sort((a, b) => String(a.date).localeCompare(String(b.date))).forEach(x => rows.push({ group: SY.group + ' ' + TX.group, t: `schedule:${x.id}`, label: `${tmFmt('date', x.date)}${x.start ? ' ' + x.start : ''}${SEP}${x.title || ''}` }));
  }
  return rows;
}
function draftRoundCounts(D, all) { // 4.27.0: ✳ changed in the round, 💬 with a note - switches in the filter window (5.14.0)
  return { ch: all.filter(x => (D.changed || {})[x.key] || (D.suggest || {})[x.key] || (D.byClaude || {})[x.key]).length,
    nt: all.filter(x => noteOf(D, itemTarget(x))).length + draftMoreRows(D).filter(r => noteOf(D, r.t)).length };
}
function draftRoundFilter(D, list) {
  if (FILTER.draft.changed) list = list.filter(x => (D.changed || {})[x.key] || (D.suggest || {})[x.key] || (D.byClaude || {})[x.key]);
  if (FILTER.draft.notes) list = list.filter(x => noteOf(D, itemTarget(x)));
  return list;
}
// lines that named it name the existing place. -> { id (the phone's id, as a program line names a place), name } or null
function draftGidDup(t, q) { const g = gidOf(q); if (!g || !g.cid) return null; const E = STATE.edits.places || {};
  for (const did of [...new Set((t.segments || []).map(s => s && s.dest))]) { const d = DESTS[did]; if (!d || !Array.isArray(d.places)) continue;
    for (const b of d.places) { const id = (d.idBase || 0) + b.id, e = E[id]; if (e && e.op === 'del') continue; const m = e && e.op === 'edit' ? { ...b, ...e.data } : b;
      if (gidSame(gidOf(m), g)) return { id, name: m.name }; }
    for (const k of Object.keys(E)) { const e = E[k]; if (e && e.op === 'add' && e.data && e.data.dest === did && gidSame(gidOf(e.data), g)) return { id: Number(k), name: e.data.name }; } }
  return null; }
// undo-history: an undo that brings the draft back (an approval or a discard undone) opens it, as the toasts' undo did
// (diet-mechanism: with the model - an undo of a draft row brings its screen back whether or not the AI group came yet)
undoAfter(keys => { if (DRAFT && keys.includes('["r"]') && activeTab !== 'draft') goTab('draft'); });
// the draft and its view are written here only (diet-mechanism: the draft's screen, in the AI group, sets them through these)
function draftPut(d) { DRAFT = d; }
function draftViewPut(v) { draftView = v; }

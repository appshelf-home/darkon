// ================= ai-fix-mine: AN AI'S CORRECTION OF WHAT THE USER SET (decisions 2026-11-26 · An AI's correction of what the user set reaches the user, Q1-Q7) =================
// An AI never overwrites what the user set (a place the user added, a field changed by hand, the user's own "closed" / "gone" hide): it writes
// beside the place a suggestion - `suggest`: [{ field, value, reason, source }] (claude/reference/file-format.md "Suggestions"). Only a file
// from an AI is read (fileFromAI); the closed sets at entry (sgClean, from fileClean) keep a known field, a value of its form and a reason.
// The user decides in one list, built like the closing's "איפה היינו" (fmMarkView over swipe rows with the one two-way mark, fmMark): in the
// "קובץ התקבל" window (an update - the marks apply with "לעדכן אותו"), atop a draft's summary (a round - D.conflict), and from the place's mark
// ("הצעת תיקון", placeMarks) or the "כללי" row (sgRowHTML) for what was left open. An open suggestion is kept on its place (`aiFix`: a
// destination's place in the destination's layer, a place the user added in its edits record, a trip's own place in the trip) - one entry per
// field { v, why, src, at, d?, was? }: no d = open, d 1 = taken (its value is the user's now; was = the value it replaced), d 0 = "להשאיר שלי",
// remembered, so the same value is not offered again (Q6). It goes with the backup and "לטלפון אחר שלי", never in a file to a friend or an AI.
const SG_FIELDS = ['name', 'foreign', 'address', 'manualCoord', 'gid', 'description', 'transit', 'mapsUrl', 'status'];
const SG_LABEL = { name: 'שם', foreign: 'השם המקומי', address: 'כתובת', manualCoord: 'מיקום', gid: 'מזהה גוגל', description: 'תיאור', transit: 'איך מגיעים', mapsUrl: 'קישור', status: 'מצב' };
const SG_STATUS = ['active', 'closed', 'gone'], sgEmpty = v => v == null || v === '', sgSame = (a, b) => JSON.stringify(a == null ? '' : a) === JSON.stringify(b == null ? '' : b);
const sgText = (v, n) => typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000b-\u001f]/g, '').trim().slice(0, n) : '';
// a suggestion's value in its field's form, or undefined
function sgValue(f, v) {
  if (f === 'status') return SG_STATUS.includes(v) ? v : undefined;
  if (f === 'manualCoord') { const ok = n => typeof n === 'number' && isFinite(n); return v && ok(v.lat) && ok(v.lng) && Math.abs(v.lat) <= 90 && Math.abs(v.lng) <= 180 ? { lat: +v.lat.toFixed(6), lng: +v.lng.toFixed(6) } : undefined; }
  if (f === 'gid') return gidClean(v) || undefined;
  if (f === 'mapsUrl') return typeof v === 'string' && /^https:\/\/[^\s]{4,500}$/.test(v.trim()) ? v.trim() : undefined;
  const s = sgText(v, f === 'name' || f === 'foreign' ? 200 : 2000); return s || undefined; }
// the closed sets at entry: a file's `suggest` - one per field, a known field, a value of its form, a reason. Returns the kept list.
function sgClean(list) { const out = [], seen = new Set(); (Array.isArray(list) ? list : []).forEach(s => { if (!s || typeof s !== 'object') return;
  const f = s.field, v = SG_FIELDS.includes(f) ? sgValue(f, s.value) : undefined, why = sgText(s.reason, 300);
  if (v === undefined || !why || seen.has(f)) return; seen.add(f); out.push({ field: f, value: v, reason: why, source: sgText(s.source, 200) }); }); return out; }
// the stored form (`aiFix`, a backup's): the same sets; an entry with a decision keeps it
function sgCleanStored(o) { const out = {}; if (!o || typeof o !== 'object' || Array.isArray(o)) return out;
  Object.keys(o).forEach(f => { const x = o[f], v = x && SG_FIELDS.includes(f) ? sgValue(f, x.v) : undefined; if (v === undefined) return;
    const e = { v, why: sgText(x.why, 300), src: sgText(x.src, 200), at: typeof x.at === 'number' ? x.at : 0 };
    if (x.d === 0 || x.d === 1) e.d = x.d; if (x.d === 1 && x.was !== undefined) { const w = sgValue(f, x.was); if (w !== undefined) e.was = w; } out[f] = e; }); return out; }
// every place of a file (a destination's, a trip's own)
function sgFilePlaces(data) { const out = [], put = a => (Array.isArray(a) ? a : []).forEach(p => { if (p && typeof p === 'object') out.push(p); });
  (data.kind === 'trip' ? data.destinations || [] : [data.destination]).forEach(dp => dp && put(dp.places)); if (data.trip && typeof data.trip === 'object') put(data.trip.places); return out; }
// the door (openIncoming): an AI writes `suggest`, never the phone's `aiFix`; any other file's `suggest` is never read. From an AI: the one
// rule, fileFromAI (ai-origin - until then the suggestions had a rule of their own, as the draft's asked for no `device`)
function sgDoor(data) { const ai = fileFromAI(data); sgFilePlaces(data).forEach(p => { if (ai) delete p.aiFix; else delete p.suggest; }); }
function sgStrip(data) { sgFilePlaces(data).forEach(p => { delete p.suggest; }); }
// what leaves the phone in a file to a friend or an AI carries no aiFix (a backup does)
function sgDropAll(o, depth) { if (!o || typeof o !== 'object' || (depth || 0) > 8) return o;
  if (Array.isArray(o)) o.forEach(x => sgDropAll(x, (depth || 0) + 1)); else Object.keys(o).forEach(k => { if (k === 'aiFix') delete o[k]; else sgDropAll(o[k], (depth || 0) + 1); }); return o; }
// ---- a row: { key, kind 'dest' | 'add' | 'trip' | 'draft', id, did, tid, dk (a draft's place key), f, v, why, src, mine, name, d } ----
// the record that keeps a place's aiFix and the user's own value of a field
function sgHome(r) { if (r.kind === 'trip') { const t = STATE.trips[r.tid]; return t && (t.places || []).find(p => p && p.id === r.id); }
  if (r.kind === 'add') { const e = STATE.edits.places[r.id]; return e && e.op === 'add' ? e.data : null; }
  const d = DESTS[r.did]; return d && (d.places || []).find(p => p && (d.idBase || 0) + p.id === r.id); }
function sgRow(o, s, mine) { return { ...o, key: o.kind + ':' + o.id + ':' + s.field, f: s.field, v: s.value, why: s.reason, src: s.source, mine }; }
// an update's suggestions (the receive window): only for a field the user set, never equal to the user's value, never the value "להשאיר שלי" kept
function sgRowsOf(data) { const rows = [], t = data.kind === 'trip' ? data.trip : null, here = t && STATE.trips[t.id], E = STATE.edits;
  const pick = (p, o, set, mineOf, old) => sgClean(p.suggest).forEach(s => { if (!set(s.field)) return; const m = mineOf(s.field), k = (old || {})[s.field];
    if (sgSame(m, s.value) || (k && k.d === 0 && sgSame(k.v, s.value))) return; rows.push(sgRow(o, s, m)); });
  const hid = id => { const st = E.status[id]; return st && (st.s === 'closed' || st.s === 'gone') ? st.s : ''; };
  (t ? data.destinations || [] : [data.destination]).forEach(dp => { const d = dp && DESTS[dp.id]; if (!d || d.builtin) return;
    (dp.places || []).forEach(p => { if (!p || !p.suggest) return; const ak = addKeyOf(p.addKey);
      if (ak) { const e = E.places[ak]; if (!e || e.op !== 'add' || !e.data) return;
        pick(p, { kind: 'add', id: Number(ak), did: d.id, name: e.data.name || p.name || '' }, f => f === 'status' ? !!hid(ak) : !sgEmpty(e.data[f]), f => f === 'status' ? hid(ak) : e.data[f], e.data.aiFix); return; }
      const id = (d.idBase || 0) + p.id, e = E.places[id], ed = e && e.op === 'edit' ? e.data : null, b = (d.places || []).find(q => q && q.id === p.id);
      if (!b) return; pick(p, { kind: 'dest', id, did: d.id, name: (ed && ed.name) || b.name || '' }, f => f === 'status' ? !!hid(id) : !!(ed && f in ed), f => f === 'status' ? hid(id) : ed[f], b.aiFix); }); });
  if (t && here) (t.places || []).forEach(p => { if (!p || !p.suggest || !addKeyOf(p.id)) return; const o = (here.places || []).find(q => q && q.id === p.id); if (!o) return;
    pick(p, { kind: 'trip', id: p.id, tid: t.id, name: o.name || '' }, f => f !== 'status' && !sgEmpty(o[f]), f => o[f], o.aiFix); });
  return rows; }
// the user's own value set (v undefined: the field goes back to empty / the place's own)
function sgSetMine(r, f, v) { const who = STATE.settings.deviceName || '', at = Date.now(), E = STATE.edits;
  if (r.kind === 'trip') { const tp = sgHome(r); if (!tp) return; if (f === 'status') { if (v === undefined || v === 'active') { delete tp.status; delete tp.statusNote; } else tp.status = v; return; }
    if (v === undefined) delete tp[f]; else tp[f] = JSON.parse(JSON.stringify(v)); if (f === 'manualCoord' && v !== undefined) tp.coordSource = 'תיקון ידני'; return; }
  if (f === 'status') { if (v === undefined || v === 'active') delete E.status[r.id]; // the user's own hide taken back ("פתוח שוב" is written only by the way back, t840)
    else E.status[r.id] = { s: v, note: '', at, who }; return; }
  if (r.kind === 'add') { const e = E.places[r.id]; if (!e || !e.data) return; const data = { ...e.data }; if (v === undefined) data[f] = ''; else data[f] = JSON.parse(JSON.stringify(v)); E.places[r.id] = { ...e, data, at, who }; return; }
  const e = E.places[r.id], data = { ...(e && e.op === 'edit' ? e.data : {}) }; if (v === undefined) delete data[f]; else data[f] = JSON.parse(JSON.stringify(v));
  if (Object.keys(data).length) E.places[r.id] = { op: 'edit', data, at, who }; else delete E.places[r.id]; }
// one decision on a stored row (val 1 | 0 | null to clear); the place's entry follows
function sgDecide(r, val) { const h0 = sgHome(r); if (!h0) return; const e = { ...((h0.aiFix || {})[r.f] || { v: r.v, why: r.why, src: r.src, at: Date.now() }) };
  if (e.d === 1) sgSetMine(r, r.f, e.was); delete e.d; delete e.was;
  if (val === 1) { e.d = 1; if (r.mine !== undefined && r.mine !== '') e.was = JSON.parse(JSON.stringify(r.mine)); sgSetMine(r, r.f, e.v); } else if (val === 0) e.d = 0;
  const h = sgHome(r); if (h) h.aiFix = { ...(h.aiFix || {}), [r.f]: e }; } // the record again: setting my value may have written a new one (an add's edits record)
// an update applied (importTripNow, receiveDestination - after the file is in): each row of the window stored on its place, with its mark
function sgApply(rows) { (rows || []).forEach(r => { const h = sgHome(r); if (!h) return; const fx = { ...(h.aiFix || {}) }; fx[r.f] = { v: r.v, why: r.why, src: r.src, at: Date.now() }; h.aiFix = fx; if (r.d === 1 || r.d === 0) sgDecide(r, r.d); }); }
// a destination's update keeps its places' aiFix (installDestination), as prev-recs keeps their summary
function sgKeep(old, nx) { const m = new Map((old || []).filter(p => p && p.aiFix).map(p => [p.id, p.aiFix])); return (nx || []).map(p => p && m.has(p.id) && !p.aiFix ? { ...p, aiFix: m.get(p.id) } : p); }
// a hand change of a field removes its suggestion (Q6: the user's newer decision wins); a kept "להשאיר שלי" stays remembered
function sgHandDrop(id, fields) { const q = POINTS.find(x => x.id === id); if (!q || !q.aiFix) return; const r = q.tripOnly ? { kind: 'trip', id, tid: STATE.activeTrip } : q.userAdded ? { kind: 'add', id } : { kind: 'dest', id, did: q.dest };
  const h = sgHome(r); if (!h || !h.aiFix) return; const fx = { ...h.aiFix }; (fields || []).forEach(f => { if (fx[f] && fx[f].d !== 0) delete fx[f]; });
  if (Object.keys(fx).length) h.aiFix = fx; else delete h.aiFix;
  if (r.kind === 'dest') { const bp = BASE_PLACES.find(b => b.id === id); if (bp) { if (h.aiFix) bp.aiFix = h.aiFix; else delete bp.aiFix; } saveDests(); } }
const sgOpen = fx => Object.keys(fx || {}).filter(f => fx[f] && fx[f].d == null);
// the stored rows of the open trip (or the destination's view): open, and those decided while this list is shown (L.ids)
function sgStoreRows(L, only) { const rows = []; POINTS.forEach(q => { if (!q.aiFix || (only != null && q.id !== only)) return;
  const o = q.tripOnly ? { kind: 'trip', id: q.id, tid: STATE.activeTrip } : q.userAdded ? { kind: 'add', id: q.id, did: q.dest } : { kind: 'dest', id: q.id, did: q.dest };
  Object.keys(q.aiFix).forEach(f => { const e = q.aiFix[f], key = o.kind + ':' + q.id + ':' + f; if (!e || (e.d != null && !(L.ids || []).includes(key))) return;
    rows.push({ ...o, key, f, v: e.v, why: e.why, src: e.src, d: e.d, mine: e.d === 1 ? e.was : f === 'status' ? q.status || 'active' : q[f], name: placeLabel(q) }); }); });
  return rows; }
// a draft's (D.conflict[key][field]): an older draft kept the AI's bare value there - read as a suggestion with no reason
const sgDraftEntry = x => x && typeof x === 'object' && 'why' in x ? x : { v: x === null ? '' : x, why: '', src: '' };
function sgDraftRows(L, only) { const D = DRAFT, rows = []; if (!D) return rows; const items = new Map(draftItems(D).map(x => [x.key, x]));
  Object.entries(D.conflict || {}).forEach(([dk, c]) => { const x = items.get(dk); if (!x || (only != null && dk !== only)) return;
    Object.keys(c || {}).forEach(f => { const e = sgDraftEntry(c[f]), key = 'd|' + dk + '|' + f; if (!SG_FIELDS.includes(f) || (e.d != null && !(L.ids || []).includes(key))) return;
      rows.push({ kind: 'draft', key, dk, f, v: e.v, why: e.why, src: e.src, d: e.d, mine: e.d === 1 ? e.was : (D.fix[dk] || {})[f], name: x.p.name || '' }); }); });
  return rows; }
function sgDraftDecide(r, val) { const D = DRAFT; if (!D) return; const c = { ...(D.conflict[r.dk] || {}) }, e = { ...sgDraftEntry(c[r.f]) }, fx = { ...(D.fix[r.dk] || {}) };
  const put = v => { if (v === undefined) delete fx[r.f]; else fx[r.f] = JSON.parse(JSON.stringify(v)); if (r.f === 'manualCoord') { if (v === undefined) delete fx.coordSource; else fx.coordSource = 'תיקון ידני'; } };
  if (e.d === 1) put(e.was); delete e.d; delete e.was;
  if (val === 1) { e.d = 1; if (r.mine !== undefined) e.was = JSON.parse(JSON.stringify(r.mine)); put(e.v); } else if (val === 0) e.d = 0;
  c[r.f] = e; D.conflict = { ...D.conflict, [r.dk]: c }; if (Object.keys(fx).length) D.fix[r.dk] = fx; else delete D.fix[r.dk]; }
const sgDraftOpen = (D, dk) => { const c = (D.conflict || {})[dk]; return !!c && Object.keys(c).some(f => SG_FIELDS.includes(f) && sgDraftEntry(c[f]).d == null); };
// a draft approved (Q5): what is still open, and the remembered "להשאיר שלי", go with the place
function sgDraftCarry(D, dk) { const c = (D.conflict || {})[dk], out = {}; Object.keys(c || {}).forEach(f => { const e = sgDraftEntry(c[f]); if (e.d === 1 || !SG_FIELDS.includes(f)) return; const v = sgValue(f, e.v); if (v !== undefined) out[f] = { v, why: e.why || '', src: e.src || '', at: Date.now(), ...(e.d === 0 ? { d: 0 } : {}) }; });
  return Object.keys(out).length ? out : null; }
// a hand fix in the draft removes that field's suggestion
function sgDraftHand(D, dk, next, prev) { const c = (D.conflict || {})[dk]; if (!c) return; const o = { ...c };
  Object.keys(o).forEach(f => { if (f in next && !sgSame(next[f], prev[f]) && sgDraftEntry(o[f]).d !== 0) delete o[f]; });
  if (Object.keys(o).length) D.conflict[dk] = o; else delete D.conflict[dk]; }
// ---- the list (one component in three places): SG_L[ctx] = { rows (the window's), view, ids, only } - ctx 'recv' (the receive window),
// 'draft' (atop the draft's summary), 'dsheet' (a draft's place, from its mark), 'store' (what waits on the phone, from a mark or "כללי")
const SG_L = {}, sgIsDraft = ctx => ctx === 'draft' || ctx === 'dsheet';
function sgRows(ctx) { const L = SG_L[ctx] || {}; return ctx === 'recv' ? L.rows || [] : sgIsDraft(ctx) ? sgDraftRows(L, L.only) : sgStoreRows(L, L.only); }
function sgValTx(f, v) { if (sgEmpty(v)) return '—'; if (f === 'status') return v === 'active' ? 'פתוח' : STATUS_LABEL[v] || v;
  if (f === 'manualCoord') return `${v.lat}, ${v.lng}`; if (f === 'gid') return v.id || v.cid || '—'; const s = String(v); return s.length > 160 ? s.slice(0, 159) + '…' : s; }
function sgRowHTMLOf(r) { const esc = escH;
  return `<div class="cl-row sg-row g-swipe" data-sg="${esc(r.key)}"><span><b dir="auto">${esc(r.name)}</b>${SEP}${esc(SG_LABEL[r.f] || r.f)}<small>שלכם: <bdi>${esc(sgValTx(r.f, r.mine))}</bdi></small><small>מוצע: <bdi>${esc(sgValTx(r.f, r.v))}</bdi></small>${r.why || r.src ? `<small>${esc(r.why)}${r.src ? `${r.why ? SEP : ''}מקור: <bdi>${esc(r.src)}</bdi>` : ''}</small>` : ''}</span>`
    + `${fmMark({ act: 'sg.mark', v: r.key, on: r.d === 1, no: r.d === 0, yes: 'לתקן', noTx: 'להשאיר שלי', label: 'הצעת תיקון' })}</div>`; }
const sgDraftId = () => DRAFT ? String((DRAFT.data.trip || DRAFT.data.destination || {}).id || '') : '';
function sgInnerHTML(ctx) { let L = SG_L[ctx] = SG_L[ctx] || {}; if (sgIsDraft(ctx) && L.of !== sgDraftId()) L = SG_L[ctx] = { only: L.only, of: sgDraftId() }; // another draft: its own view
  const all = sgRows(ctx), un = all.filter(r => r.d == null);
  if (!L.view) L.view = un.length ? 'un' : 'all'; if (!L.ids) L.ids = (L.view === 'un' ? un : all).map(r => r.key);
  const ids = new Set(L.ids), rows = all.filter(r => L.view === 'all' || ids.has(r.key));
  return `<h3 class="sg-h">${claudeMark({ size: 20 })} הצעות לתיקון במה שקבעתם (<bdi>${all.length}</bdi>)</h3><p class="sh-hint">ה-${AI} לא שינה את מה שקבעתם: לכל הצעה - "לתקן" או "להשאיר שלי" (גם החלקה: ימינה = לתקן, שמאלה = להשאיר). מה שלא הוחלט מחכה על המקום.</p>`
    + `<div class="cl-view">${fmMarkView({ act: 'sg.view', view: L.view, nUn: un.length, nAll: all.length, unTx: 'עוד לא הוחלט', label: 'אילו הצעות' })}${un.length ? halfActionHTML([{ act: 'sg.all', v: '1', label: '✓ לתקן בכל השאר' }, { act: 'sg.all', v: '0', label: 'להשאיר שלי בכל השאר' }]) : ''}</div>`
    + (rows.length ? `<div class="cl-list">${rows.map(sgRowHTMLOf).join('')}</div>` : `<div class="callout">✓ הכל הוחלט. ב"הכל" אפשר לשנות.</div>`); }
function sgSecHTML(ctx) { return sgRows(ctx).length ? `<div class="sg-sec" data-sgl="${escH(ctx)}">${sgInnerHTML(ctx)}</div>` : ''; }
function sgRedraw(ctx) { document.querySelectorAll('.sg-sec').forEach(el => { if (el.dataset.sgl === ctx) { el.innerHTML = sgInnerHTML(ctx); } }); ellFitSoon(); }
// the window's section (an update): its rows are the window's until "לעדכן אותו"
function sgRecvHTML(data) { SG_L.recv = { rows: sgRowsOf(data) }; return sgSecHTML('recv'); }
const sgCtxOf = el => { const s = el.closest('.sg-sec'); return s ? s.dataset.sgl : ''; };
function sgDo(ctx, list, val) { if (ctx === 'recv') { list.forEach(r => { if (val == null) delete r.d; else r.d = val; }); return; }
  list.forEach(r => (sgIsDraft(ctx) ? sgDraftDecide : sgDecide)(r, val)); }
function sgAfter(ctx, msg) { sgRedraw(ctx); if (ctx === 'recv') return 'quiet';
  if (sgIsDraft(ctx)) saveDraft(); else { saveDests(); refreshLayers(); persist(); } showUndoToast(msg); redrawSoon(); return 'quiet'; }
act('sg.mark', c => { const ctx = sgCtxOf(c.el), r = sgRows(ctx).find(x => x.key === c.v); if (!r) return 'quiet';
  const val = c.el.dataset.clvis === '1' ? 1 : 0, off = c.el.getAttribute('aria-pressed') === 'true'; sgDo(ctx, [r], off ? null : val);
  return sgAfter(ctx, `${off ? 'בוטל' : val ? 'תוקן לפי ההצעה' : 'נשאר שלכם'}: ${r.name}${SEP}${SG_LABEL[r.f] || r.f}`); });
act('sg.all', c => { const ctx = sgCtxOf(c.el), val = c.v === '1' ? 1 : 0, L = SG_L[ctx] || {}, ids = new Set(L.ids || []);
  const list = sgRows(ctx).filter(r => r.d == null && (L.view === 'all' || ids.has(r.key))); if (!list.length) return 'quiet'; sgDo(ctx, list, val);
  return sgAfter(ctx, val ? `תוקנו ${list.length} לפי ההצעות` : `נשארו שלכם ${list.length}`); });
act('sg.view', c => { const ctx = sgCtxOf(c.el), L = SG_L[ctx]; if (!L) return 'quiet'; L.view = c.v; delete L.ids; sgRedraw(ctx); return 'quiet'; });
// the place's mark (placeMarks: every card, the details window) and the "כללי" row open the list of what is still open
function sgTagHTML(p) { return p && sgOpen(p.aiFix).length ? `<button type="button" class="tl-tag sg-tag" data-act="sg.place" data-v="${escH(String(p.id))}">${tagIc('edit_note')}הצעת תיקון</button>` : ''; }
function sgOpenCount() { return POINTS.reduce((n, q) => n + sgOpen(q.aiFix).length, 0); }
function sgRowHTML() { const n = sgOpenCount(); if (!n) return '';
  return `<div class="info-miss sg-miss"><button type="button" class="prop-row info-miss-go t-wrap" id="sgRow" data-act="sg.open">${claudeMark({ size: 24 })}<span class="prop-row-t"><b>${n === 1 ? 'הצעה אחת לתיקון מה-' + AI : `${n} הצעות לתיקון מה-${AI}`}</b><small>במה שקבעתם: לבדוק ולהחליט</small></span></button></div>`; }
function openSgSheet(ctx, only) { layerNote(openSgSheet, arguments); SG_L[ctx] = { only: only == null ? null : only };
  document.getElementById('sheet').innerHTML = `${fmHead(`${claudeMark({ size: 20 })} הצעות לתיקון מה-${AI}`)}${sgSecHTML(ctx) || `<div class="callout">אין הצעות פתוחות.</div>`}<div class="brow sheet-actions sheet-save-bar"><button type="button" class="btn-nav" data-act="win.done">✓ סיום</button></div>`;
  showSheetBackdrop('openSgSheet'); ellFitSoon(); }
act('sg.place', c => { openSgSheet('store', Number(c.v)); return 'quiet'; });
act('sg.open', () => { openSgSheet('store', null); return 'quiet'; });
act('sg.draft', c => { openSgSheet('dsheet', c.v); return 'quiet'; });

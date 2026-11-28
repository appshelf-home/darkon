// ================= PREVIOUS RECOMMENDATIONS (prev-recs, 11.64.0; decisions 2026-11-24 · A new trip based on another trip, and previous recommendations, Q5, Q6, Q10-Q13, Q15; spec/prev-recs.md) =================
// A place - a destination's place (DESTS[id].places) or a trip-only place (trip.places) - may carry `recs`: a short list of contributions,
// each { id, v, r } - id: the random id of the closed trip that contributed (t.recId; nothing that names a person or a phone), v: visited
// (true or left out), r: a rating ('love' / 'like' / 'dislike') or left out. No names, no rating words. A destination's summary lives on its
// places (the destination's layer: it survives an update - recsKeep), a trip-only place carries its own.
// Merge (Q11): united by id, an id already there replaced - never counted twice (recMerge). In: every file passes fileClean (recClean, a closed
// field); a file back from an AI is never read for it (recDropAll, openIncoming - Q12). Out (Q12, Q6): every file carries what others gave;
// my own trips' contributions only when the share window's box is checked (recOut). On my phone the count is others' only (Q13: recOthers).
const REC_RATES = ['love', 'like', 'dislike'];
const REC_ID = /^r[0-9a-z]{6,16}$/;
const REC_MAX = 500; // contributions kept on one place (a few tens of bytes each); beyond it the newest kept
function recClean(a) { // the closed form of a summary - anything else is dropped (and counted by the door)
  if (!Array.isArray(a)) return [];
  const m = new Map(); a.forEach(x => { if (!x || typeof x !== 'object' || Array.isArray(x) || typeof x.id !== 'string' || !REC_ID.test(x.id)) return;
    const o = { id: x.id }; if (x.v === true) o.v = true; if (REC_RATES.includes(x.r)) o.r = x.r; if (o.v || o.r) { m.delete(o.id); m.set(o.id, o); } });
  return [...m.values()].slice(-REC_MAX); }
function recMerge(a, b) { const out = recClean([...recClean(a), ...recClean(b)]); return out.length ? out : undefined; } // b's contribution replaces a's of the same id
function recSet(p, list) { if (list && list.length) p.recs = list; else delete p.recs; return p; }
// a trip that contributes: closed by me (not cancelled, not a friend's closed trip received - archived.recv)
function recClosed(t) { return !!(t && t.archived && t.archived.reason !== 'cancelled' && !t.archived.recv); }
function recNewId() { const b = new Uint8Array(8); crypto.getRandomValues(b); return 'r' + [...b].map(x => (x % 36).toString(36)).join('') + Date.now().toString(36).slice(-2); }
function recIdOf(t) { if (!t.recId) t.recId = recNewId(); return t.recId; } // created once and kept with the trip (Q6, Q13): reopened and closed again, the same id
// the phone knows its own contributions by its trips' ids: each trip's random recId, and (archive-redraw item 6; decisions 2026-11-26 · Review of
// `trip-base-plus`, Q1) the id a friend's phone derives from the trip's id when it takes the trip as a base (recBaseId) - a trip of mine sent
// without the box and built on: the summary that comes back holds my own marks under that id. Every trip of mine: not one received (archived.recv)
function recMine() { const s = new Set(); Object.values(STATE.trips || {}).forEach(t => { if (!t) return; if (t.recId) s.add(t.recId); if (t.id && !(t.archived && t.archived.recv)) s.add(recIdFor('base|' + t.id)); }); return s; }
function recOthers(p) { const mine = recMine(); return recClean(p && p.recs).filter(x => !mine.has(x.id)); }
function recCounts(list) { const c = { n: 0, love: 0, like: 0, dislike: 0 }; list.forEach(x => { c.n++; if (x.r) c[x.r]++; }); return c; }
// the details window: one row "המלצות קודמות: ביקרו N · ❤️ a · 👍 b · 👎 c" (zeros left out; none without others' contributions)
function recRowText(p) { const l = recOthers(p); if (!l.length) return ''; const c = recCounts(l);
  return [`${TX.visitedN} ${c.n}`, ...REC_RATES.filter(k => c[k]).map(k => `${RATE[k]} ${c[k]}`)].join(SEP); }
function recRowHTML(p) { const s = recRowText(p); return s ? iwRow('groups', `<b>${TX.prevRecs}:</b> ${escH(s)}`) : ''; }
// the small card: one tiny mark "❤️ a", only when others loved the place - in the style of the past-rating mini tag
function recMiniHTML(p) { const n = p ? recOthers(p).filter(x => x.r === 'love').length : 0; return n ? `<span class="past-rate past-mini rec-mini">${symTip('sym.prevRecs', `${RATE.love} ${n}`)}</span>` : ''; }
function pastMiniRecHTML(p) { return pastRateMiniHTML(p) + recMiniHTML(p); } // the small card's two marks: my past rating, then others' ❤️
// a destination file's update keeps the summary on this phone and adds the file's (Q11): by the place's id in the destination
function recsKeep(oldPlaces, newPlaces) { const byId = new Map((oldPlaces || []).filter(p => p && p.recs).map(p => [p.id, p.recs]));
  return (newPlaces || []).map(p => { if (!p || typeof p !== 'object') return p; const was = byId.get(p.id); if (!was && !p.recs) return p; return recSet({ ...p }, recMerge(was, p.recs)); }); }
// a file from an AI never brings a summary (Q12): what it wrote is dropped at entry, before anything reads the file
function recDropAll(o, depth) { if (!o || typeof o !== 'object' || (depth || 0) > 8) return 0; let n = 0;
  if (Array.isArray(o)) { o.forEach(x => { n += recDropAll(x, (depth || 0) + 1); }); return n; }
  Object.keys(o).forEach(k => { if (k === 'recs') { delete o[k]; n++; } else if (k === 'recId') delete o[k]; else n += recDropAll(o[k], (depth || 0) + 1); }); return n; }
// the share window's box (Q6): offered for a closed trip of mine, and for a destination one of my closed trips touched
function recTripsOfDest(did) { return Object.values(STATE.trips || {}).filter(t => recClosed(t) && (t.segments || []).some(s => s && s.dest === did)); }
function recBoxOffered(o) { return o.tripId ? recClosed(STATE.trips[o.tripId]) : recTripsOfDest(o.did).length > 0; }
function recBoxHTML(F, to, o) { if (!recBoxOffered(o)) return '';
  return fmChecks(F, 'recs', { items: [{ k: 'mine', label: 'לצרף את ההמלצות שלי, בלי שם', sub: 'מה שסימנתם "' + TX.visited + '" והדירוגים, בלי מילים ובלי שם' }], value: to === 'friend' ? ['mine'] : [] }); }
// a trip's contribution to one place: its ✓ and its rating (no word)
function recContrib(t, pid) { const td = STATE.tripData[t.id] || {}, r = (td.rating || {})[pid], v = (td.visited || []).includes(pid);
  if (!v && !(r && r.r)) return null; const o = { id: recIdOf(t) }; if (v || (r && r.r)) o.v = true; if (r && REC_RATES.includes(r.r)) o.r = r.r; return o; }
// out (Q12, Q6): every place of the file carries what others gave; with o.mine, each of o.trips adds (or replaces) its contribution.
// Without it, a contribution of mine that came back through friends does not leave either. o.keepIds ("לטלפון אחר שלי"): the trip keeps
// its recId, so my other phone knows the contribution as mine; any other file never carries it. The file is a copy: DESTS is never touched.
function recOut(file, o) { o = o || {}; const mine = recMine(), trips = o.mine ? (o.trips || []).filter(recClosed) : [];
  if (trips.length) persist(true); // a recId created now is kept with its trip
  const placeOut = (p, pid) => { if (!p || typeof p !== 'object') return p; let l = recClean(p.recs).filter(x => !mine.has(x.id));
    trips.forEach(t => { const c = recContrib(t, pid); if (c) l = recClean([...l, c]); }); return recSet({ ...p }, l); };
  // archive-redraw item 5 (decisions 2026-11-26 · Review of `prev-recs`, Q1): a place I added to the destination travels as an edits record
  // (op: "add", by this phone's id of it) - its data carries the summary as a destination's own place does
  const addsOut = E => { if (!E || !E.places || typeof E.places !== 'object') return E;
    return { ...E, places: Object.fromEntries(Object.entries(E.places).map(([k, x]) => [k, x && x.op === 'add' && x.data && typeof x.data === 'object' ? { ...x, data: placeOut(x.data, Number(k)) } : x])) }; };
  const destOut = dp => { if (!dp || !Array.isArray(dp.places)) return dp; const b = (DESTS[dp.id] || {}).idBase || 0; const o = { ...dp, places: dp.places.map(p => placeOut(p, b + (p && p.id))) }; if (dp.edits) o.edits = addsOut(dp.edits); return o; };
  if (file.destination) file.destination = destOut(file.destination);
  if (Array.isArray(file.destinations)) file.destinations = file.destinations.map(destOut);
  if (file.trip && typeof file.trip === 'object') { if (Array.isArray(file.trip.places)) file.trip.places = file.trip.places.map(p => placeOut(p, p && p.id)); if (!o.keepIds) delete file.trip.recId; }
  return file; }
// a trip from a file over a trip on this phone (an update): the trip's contribution id stays (Q13 - a file from a friend or an AI never
// carries one), and its own places' summary stays with the file's joined to it (Q11, Q15); a copy is a trip of its own (no id of another).
// A new trip keeps the id its file brought - only "לטלפון אחר שלי" sends one (recOut keepIds), so my other phone knows it as mine
function recTripIn(t, was, copy) { if (copy) delete t.recId; else if (was && was.recId) t.recId = was.recId;
  if (was && Array.isArray(t.places)) t.places = recsKeep(was.places, t.places); return t; }
// a restore (Q11): what the backup brings replaces what is here (rowIn), but a place's summary is joined by contribution and a trip keeps
// its contribution id - a destination of the row 'dests', a trip's own places of the row 'trip'; the backup itself is never changed
function recRestoreIn(row, data) { if (!data || typeof data !== 'object') return data;
  if (row === 'dests') return Object.fromEntries(Object.entries(data).map(([k, x]) => { const ex = x && DESTS[x.id];
    return [k, ex && Array.isArray(x.places) ? { ...x, places: recsKeep(ex.places, x.places) } : x]; }));
  if (row === 'trip' && data.trips && typeof data.trips === 'object') { const trips = JSON.parse(JSON.stringify(data.trips));
    Object.values(trips).forEach(t => { if (t && STATE.trips[t.id]) recTripIn(t, STATE.trips[t.id]); }); return { ...data, trips }; }
  return data; }
// trip-base-plus (decisions 2026-11-24, Q4-Q6, Q13): the base of a new trip ("⧉ טיול חדש על בסיסו", or a draft's "⧉ לבנות ממנו טיול חדש שלי")
// gives its ✓ and ratings to the places' summary as one contribution, through recMerge. Only a trip closed by another gives one - a friend's
// closed trip kept here (archived.recv) or a closed trip in a draft - with an id of its own made from the base trip's id, so the same base
// taken again replaces its contribution, never counts it twice. A trip of mine (closed here, or bringing its recId from my other phone) gives
// none on my phone - my own contribution is never stored here (Q13) -, nor a trip still open (its marks still change, Q6), nor an AI's file (Q12).
function recIdFor(s) { let a = 0x811c9dc5, b = 0x9747b28c; for (const ch of String(s)) { const c = ch.codePointAt(0); a = Math.imul(a ^ c, 16777619); b = Math.imul(b ^ c, 2246822519); }
  return 'r' + (a >>> 0).toString(36).padStart(7, '0') + (b >>> 0).toString(36).padStart(7, '0').slice(0, 5); }
function recBaseId(t, ai) { if (!t || ai || !t.archived || t.archived.reason === 'cancelled' || t.recId || recClosed(t)) return null; return recIdFor('base|' + (t.id || t.name || '')); }
function recBaseMarks(td) { const rt = (td && td.rating) || {}; return [...new Set([...((td && td.visited) || []).map(String), ...Object.keys(rt).filter(k => rt[k] && REC_RATES.includes(rt[k].r))])]; }
function recBaseLine(t, td, ai) { if (!recBaseMarks(td).length) return '';
  return recBaseId(t, ai) ? `ה-"${TX.visited}" והדירוגים של הטיול נכנסים ל"${TX.prevRecs}" של המקומות, בלי שם` : recClosed(t) ? 'הדירוגים שלכם מהטיול הזה נשארים אצלכם, בתגית הדירוג הקודם' : ''; }
// the contribution itself: a trip-only place of the new trip (nt.places, copied from the base) carries it; a destination's place on its own
// place (DESTS - the destination's layer of data); a built-in destination keeps no summary (as prev-recs). Counted once (Q11): when every place
// the base marked already holds one contribution exactly as its marks (the sender checked "לצרף את ההמלצות שלי" - the same trip's ✓ and ratings
// under its own id - or this base was taken before), nothing is added. -> how many places got it
function recFromBase(t, td, nt, ai) { const id = recBaseId(t, ai); if (!id) return 0; const rt = (td && td.rating) || {}, vis = new Set(((td && td.visited) || []).map(String));
  const placeOf = k => { const tp = ((nt && nt.places) || []).find(p => p && String(p.id) === k); if (tp) return { p: tp };
    const pid = Number(k); for (const d of Object.values(DESTS)) { if (d.builtin || d.ghost) continue; const q = (d.places || []).find(p => p && (d.idBase || 0) + p.id === pid); if (q) return { p: q, dest: true }; } return null; };
  const want = recBaseMarks(td).map(k => { const r = rt[k] && rt[k].r, c = {}; if (vis.has(k) || REC_RATES.includes(r)) c.v = true; if (REC_RATES.includes(r)) c.r = r; return { k, c, at: placeOf(k) }; }).filter(x => x.at);
  if (!want.length) return 0;
  const same = (x, c) => !!x && x.v === c.v && (x.r || '') === (c.r || '');
  const ids = want.map(w => new Set(recClean(w.at.p.recs).filter(x => same(x, w.c)).map(x => x.id)));
  const marked = new Set(want.map(w => w.at.p)), others = [...((nt && nt.places) || []), ...[...new Set(((nt && nt.segments) || []).map(g => g.dest))].flatMap(d => (DESTS[d] && DESTS[d].places) || [])].filter(p => p && !marked.has(p));
  if ([...ids[0]].some(x => ids.every(s => s.has(x)) && !others.some(p => recClean(p.recs).some(y => y.id === x)))) return 0; // already in, under one id - on these places only
  let dirty = false; want.forEach(w => { recSet(w.at.p, recMerge(w.at.p.recs, [{ id, ...w.c }])); if (w.at.dest) dirty = true; });
  if (dirty) saveDests(); return want.length; }

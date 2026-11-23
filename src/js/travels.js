// ================= TRAVELS (11.0.0, travels-1-model): one kind of travel with two ends =================
// decisions 2026-11-10 "Travels on the map" (Q3-Q7, Q11, Q16-Q18, Q20, Q21, Q23). The plan has three kinds of card, told by their
// locations: a place (one), a travel (two - from and to) and a note (none). Every travel behaves the same whatever its source:
// - mine: a record of trip.travels (I recorded it, or a file brought it);
// - the group's: a line of the organized program whose kind is a travel's ("טיסה", "העברה") - the program is the group's source, so
//   my changes stay a layer over it (planX.sched by the line's id), and "עודכן במקור", "חזרה למקור" and "הסרה מהיום" keep working.
//   "קבוצתי" is only that property. A line of another kind becomes a travel by its "סוג" (Q20b); a group travel turns back into a
//   place by the same layer (Q20a).
// travelsOf(t) is the one list of both, for every reader (the clocks, the plan, the trip's details, the route, the memory).
// A line that IS one of the trip's travels (linked by travelId, or a flight line naming that day's flight - the old display join)
// was shown inside the travel's card; it is merged once on open into one record: the line takes the travel's details and the
// separate travel goes (travelsMerge in normalizeTrip; the plan's copy of that travel in travelOrphansOut).
// An end: its name (from / to) and its location (fromLoc / toLoc): { pid } - a place of the trip - or { lat, lng }; a location is
// stored only when confirmed (Q5). Without one, the app proposes a location from the name by the address search near the
// destination (endProposal), shown until a tap confirms it - never used unconfirmed. The far ends at home are not asked (Q6).
function isTravelKind(k) { return k === 'flight' || k === 'transfer'; }
// literals only: travelsMerge runs on load (normalizeTrip), before the consts of the later parts exist
function travelsMerge(t) {
  const sch = t.schedule || [], trv = t.travels || [], norm = x => String(x || '').toLowerCase().replace(/[\s'"׳״.,·()\-–]+/g, '');
  const taken = new Set(sch.filter(s => s && s.travelId != null).map(s => String(s.travelId)));
  sch.forEach(s => { if (!s || (s.kind !== 'flight' && s.kind !== 'transfer')) return;
    let f = s.travelId != null ? trv.find(x => String(x.id) === String(s.travelId)) : null;
    if (!f && s.travelId == null && s.kind === 'flight') { const title = norm(s.title); // the old display join of a flight line, by the title
      f = trv.find(x => !taken.has(String(x.id)) && x.date === s.date && (x.mode || 'flight') === 'flight' && [x.to, x.number, x.airline].filter(Boolean).some(y => norm(y).length >= 3 && title.includes(norm(y)))) || null;
      if (f) { s.travelId = f.id; taken.add(String(f.id)); } }
    if (!f) return;
    ['mode', 'from', 'to', 'fromLoc', 'toLoc', 'airline', 'number', 'terminal', 'arriveDay', 'path', 'before', 'after'].forEach(k => { if ((s[k] == null || s[k] === '') && f[k] != null && f[k] !== '') s[k] = f[k]; });
    if (!s.start && f.depart) s.start = f.depart; if (!s.end && f.arrive) s.end = f.arrive; if (!s.note && f.note) s.note = f.note; if (!s.date && f.date) s.date = f.date;
    const i = trv.indexOf(f); if (i >= 0) trv.splice(i, 1); });
  return t;
}
// my plan's copy of a travel that was merged into its line: its marks follow the line ('s:<id>'); undone by nothing - it is the shape of the data
function travelOrphansOut(t, td) {
  if (!t || !td || !td.planItems) return; const links = {}; (t.schedule || []).forEach(s => { if (s && s.travelId != null) links[String(s.travelId)] = s.id; });
  Object.keys(td.planItems).forEach(id => { const it = td.planItems[id]; if (!it || !it.travel || links[id] == null || (t.travels || []).some(f => String(f.id) === id)) return;
    delete td.planItems[id]; const tok = 's:' + links[id];
    Object.values(td.itinerary || {}).forEach(day => Object.keys(day || {}).forEach(k => { if (Array.isArray(day[k])) day[k] = day[k].filter(x => String(x) !== id); }));
    Object.keys(td.times || {}).forEach(k => { if (k.split('|')[1] === id) delete td.times[k]; });
    const an = (td.planX || {}).anchors || {}; Object.values(an).forEach(m => { if (!m) return; if (m[id] != null && m[tok] == null) m[tok] = m[id]; delete m[id]; Object.keys(m).forEach(k => { if (String(m[k]) === id) m[k] = tok; }); }); });
}
// ---- the one list ----
function travelOverlay(t) { if (!t || t.__draft) return {}; const x = t.id === STATE.activeTrip ? STATE.planX : (STATE.tripData[t.id] || {}).planX; return (x && x.sched) || {}; }
var _GRP_TV = new WeakMap(); // var: the clocks may ask on load, before this part ran (a const would not exist yet). A line -> its travel record (kept while the line and my changes to it are the same, so a record keeps its identity)
function tripPointOf(t, id) { if (id == null || id === '') return null; if (t && t.id === STATE.activeTrip) { let p = null; try { p = POINTS.find(x => x.id === id); } catch (e) { /* on load, before the points exist */ } if (p) return p; }
  const q = (t && t.places || []).find(x => x.id === id); if (q) return q;
  for (const s of (t && t.segments) || []) { const d = DESTS[s.dest]; const p = d && d.places.find(x => (d.idBase || 0) + x.id === id); if (p) return { ...p, id }; } return null; }
function grpTravelOf(s, e, t) { if (!_GRP_TV) _GRP_TV = new WeakMap(); const k = JSON.stringify(e), c = _GRP_TV.get(s); if (c && c.k === k) return c.f;
  const pl = tripPointOf(t, e.placeId);
  const f = { id: 's:' + s.id, src: s.id, group: true, mode: e.mode || (e.kind === 'flight' ? 'flight' : 'bus'), date: e.date || '', from: e.from || '', to: e.to || (pl ? pl.name : ''),
    fromLoc: e.fromLoc || null, toLoc: e.toLoc || (pl ? { pid: pl.id } : null), airline: e.airline || '', number: e.number || '', terminal: e.terminal || '',
    depart: e.start || '', arrive: e.end || '', arriveDay: Number(e.arriveDay) || 0, title: e.title || '', note: e.note || '', path: e.path || null, pathK: e.pathK || '', pathNear: e.pathNear || '' };
  if (e.before != null && e.before !== '') f.before = Number(e.before); if (e.after != null && e.after !== '') f.after = Number(e.after);
  _GRP_TV.set(s, { k, f }); return f; }
function travelsOf(t) { t = t || activeTripObj(); if (!t) return []; const X = travelOverlay(t);
  const grp = (t.schedule || []).map(s => { if (!s) return null; const ed = X[s.id]; if (ed && ed.hidden) return null; const e = ed && ed.ch && Object.keys(ed.ch).length ? { ...s, ...ed.ch } : s;
    return isTravelKind(e.kind) ? grpTravelOf(s, e, t) : null; }).filter(Boolean);
  return (t.travels || []).concat(grp).map((f, i) => [f, i]).sort((a, b) => String(a[0].date || '').localeCompare(String(b[0].date || '')) || String(a[0].depart || '99').localeCompare(String(b[0].depart || '99')) || a[1] - b[1]).map(x => x[0]); }
function travelById(id, t) { return travelsOf(t).find(f => String(f.id) === String(id)) || null; }
// the kind's word (Q23: a single travel is named by its kind; "נסיעה" only where kinds are mixed)
function travelKindName(f) { return (TRAVEL_MODES[(f || {}).mode] || TRAVEL_MODES.flight)[1]; }
function travelTitle(f) { return (f && f.title) || (f && f.to ? flightPlanName(f) : travelKindName(f)); } // the optional "כותרת", else as before: the kind and "אל"
// F1 (found by drawing): a flight's words, and every other kind's
function travelWords(mode) { const fl = (mode || 'flight') === 'flight';
  return { number: fl ? 'מספר טיסה' : 'מספר', depart: fl ? 'המראה' : 'יציאה', arrive: fl ? 'נחיתה' : 'הגעה', day: fl ? 'יום הנחיתה' : 'יום ההגעה', terminal: fl }; }
// ---- time before and after (Q7): defaults per kind, changed in settings, and per travel ----
const TRAVEL_MARGIN_DEF = { flight: [120, 45], train: [20, 5], bus: [15, 5], ferry: [30, 10], car: [0, 0] };
function travelMarginDef(mode) { const s = (STATE.settings.margins || {})[mode], d = TRAVEL_MARGIN_DEF[mode] || TRAVEL_MARGIN_DEF.flight;
  return [s && s[0] != null ? Number(s[0]) : d[0], s && s[1] != null ? Number(s[1]) : d[1]]; }
function travelMargins(f) { const d = travelMarginDef((f || {}).mode); return { before: f && f.before != null ? Number(f.before) : d[0], after: f && f.after != null ? Number(f.after) : d[1], own: !!f && (f.before != null || f.after != null) }; }
const MARGIN_STEPS = [0, 5, 10, 15, 20, 30, 45, 60, 90, 120, 150, 180, 240];
function marginText(m) { m = Number(m) || 0; return m ? tmFmt('dur', m, { words: true }) : 'בלי'; } // value-tie-source: the one duration format, in words for whole hours
function marginLine(b, a) { return `${marginText(b)} לפני${SEP}${marginText(a)} אחרי`; }
// ---- ends ----
// Q6: the trip starts at the first landing and ends at the last take-off - the far ends of the flights from home and back (and their
// connections) are not asked, proposed or drawn. The chains: the trip's first travel when it is a flight, with the flights that leave on the
// day the previous one lands; the same backwards from the trip's last travel.
function travelHomeEnds(t) { t = t || activeTripObj(); const out = new Set(), all = travelsOf(t).filter(f => f.date); if (!all.length) return out;
  const fl = f => (f.mode || 'flight') === 'flight', chain = [];
  if (fl(all[0])) { chain.push(all[0]); for (const f of all.slice(1)) { const p = chain[chain.length - 1]; if (fl(f) && f.date === travelLandDate(p)) chain.push(f); else break; } }
  chain.forEach((f, i) => { out.add(f.id + '|from'); if (i < chain.length - 1) out.add(f.id + '|to'); });
  const back = [], last = all[all.length - 1];
  if (fl(last) && !chain.includes(last)) { back.push(last); for (const f of all.slice(0, -1).reverse()) { const n = back[0]; if (fl(f) && !chain.includes(f) && travelLandDate(f) === n.date) back.unshift(f); else break; } }
  back.forEach((f, i) => { out.add(f.id + '|to'); if (i > 0) out.add(f.id + '|from'); });
  return out; }
// 11.18.0 (timeline-offers Q2 (2)): home is always Israel - "in Israel" is the kit's file check's own rule (claude/scripts/validate.py:
// in_israel, and its "abroad": a trip whose destinations are not all in Israel, by country, else by center); a country only.
// The Timeline import drops an offer in Israel on a trip abroad. 11.21.0 (review of the night chain Q4): Israel's polygon replaced the
// coarse box (which held Taba, Aqaba, Petra and Amman) - one copy, the kit's closed lists (CLOSED_LISTS.israel), the same ray cast in both;
// t1081 checks the two agree.
function inIsrael(c) { if (!c || !isFinite(c.lat) || !isFinite(c.lng)) return false; const P = CLOSED_LISTS.israel, y = +c.lat, x = +c.lng; let inside = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [yi, xi] = P[i], [yj, xj] = P[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside; }
  return inside; }
function destInIsrael(D) { const m = (D && D.meta) || {}; return m.country === 'IL' || (!m.country && Array.isArray(m.center) && inIsrael({ lat: +m.center[0], lng: +m.center[1] })); }
function tripAbroad(t) { const ds = [...new Set((t.segments || []).map(s => s.dest))].map(id => _tmDest(t, id)).filter(Boolean); return !ds.length || ds.some(D => !destInIsrael(D)); }
function endCoord(loc, t) { if (!loc) return null; if (loc.pid != null) { const p = tripPointOf(t || activeTripObj(), loc.pid); const c = p && routeCoordOf(p); return c ? { lat: c.lat, lng: c.lng } : null; }
  return isFinite(loc.lat) && isFinite(loc.lng) ? { lat: +loc.lat, lng: +loc.lng } : null; }
function travelEnd(f, side, t) { t = t || activeTripObj(); const loc = f[side + 'Loc'] || null;
  return { name: f[side] || '', loc, coord: endCoord(loc, t), home: travelHomeEnds(t).has(f.id + '|' + side) }; }
// D6: the proposal - the existing address search, near the destination of that end (where you leave from; where you land)
function endDest(f, side, t) { t = t || activeTripObj(); const iso = side === 'to' ? travelLandDate(f) : f.date; if (!iso) return null;
  const on = segsOn(t, iso).slice().sort((a, b) => side === 'to' ? b.from.localeCompare(a.from) : a.from.localeCompare(b.from)); const id = on.length ? on[0].dest : dayDestId(iso, t); return DESTS[id] || null; }
function endPropKey(text, d) { return 'tv:' + String(text).trim() + '|' + (d ? d.id : ''); }
// phone-round-2b-fixes P11 (G62, 11.23.2): a proposal only near the end's destination - within END_PROP_KM of its center, or in its
// country (an airport outside the destination's box) - and of the travel's kind first (an airport for a flight, a station for a train or
// a bus, a pier for a ferry); an end with no destination gets none. Nothing proposed is better than a wrong place ("חסר מיקום"). A cached
// proposal that fails the check (taken before 11.23.2 - the demo's "בניין נזריאן" for "בלמסדה") is not shown and is asked again.
const END_PROP_KM = 100, END_PROP_KIND = { flight: /aerodrome|airport|terminal/, train: /station|halt|railway/, bus: /bus_station|bus_stop|station/, ferry: /ferry|pier|harbour|port/ };
function endPropSane(v, d) { if (!v || !d || !isFinite(v.lat)) return false; const c = Array.isArray(d.meta.center) ? { lat: d.meta.center[0], lng: d.meta.center[1] } : null;
  return !!(c && distanceKm(c, v) <= END_PROP_KM) || !!(v.cc && d.meta.country && v.cc === d.meta.country); }
function endPropPick(list, d, mode) { const sane = (list || []).filter(x => endPropSane({ ...x.coord, cc: x.cc }, d)), re = END_PROP_KIND[mode];
  return (re && sane.find(x => re.test(x.cls || ''))) || sane[0] || null; }
function endProposal(f, side, t) { const e = travelEnd(f, side, t); if (e.loc || e.home || !e.name.trim()) return null; const d = endDest(f, side, t), v = GEOCODE_CACHE[endPropKey(e.name, d)];
  return v && endPropSane(v, d) ? { lat: +v.lat, lng: +v.lng, name: v.name || e.name.trim(), q: e.name.trim() } : null; }
const _END_ASKED = new Set();
async function endProposalAsk(f, side, t) { const e = travelEnd(f, side, t); if (e.loc || e.home || !e.name.trim()) return; const d = endDest(f, side, t), k = endPropKey(e.name, d);
  if (!d || (k in GEOCODE_CACHE && (GEOCODE_CACHE[k] === null || endPropSane(GEOCODE_CACHE[k], d))) || _END_ASKED.has(k) || !MAP_AVAILABLE) return; _END_ASKED.add(k);
  const r = await placeSearch(e.name.trim(), Array.isArray(d.meta.center) ? d.meta.center : undefined, { limit: 5, anywhere: true, stops: true }); // size-fixes (A): stops kept in place; 11.20.0: an end (an airport) is often outside the destination's box - biased, not boxed; 11.23.2: five, checked and chosen here
  if (!r) return; const c = endPropPick(r, d, f.mode); GEOCODE_CACHE[k] = c ? { lat: c.coord.lat, lng: c.coord.lng, name: c.name, cc: c.cc || '', at: Date.now() } : null; saveGeocodeCache(GEOCODE_CACHE); redrawSoon(); } // not found is kept as the address cache keeps it (asked again after 30 days)
// the state of a travel's ends for its card (Q13's line, here the chip): 'prop' (a proposal waits), 'none' (no location and none found), ''
function travelEndsState(f, t) { let st = ''; ['from', 'to'].forEach(side => { const e = travelEnd(f, side, t); if (e.loc || e.home) return;
  if (endProposal(f, side, t)) st = 'prop'; else if (!st) st = 'none'; }); return st; }
function travelFirstOpenEnd(f, t) { return ['from', 'to'].find(side => { const e = travelEnd(f, side, t); return !e.loc && !e.home; }) || 'from'; }
// ---- the travel editor (Q11, Q20, Q23; found by drawing F1-F3): one editor for every travel - mine, the group's, a new one ----
// The title is the kind ("טיסה", "אוטובוס · קבוצתי"); "סוג", an optional "כותרת", the date; "מ-" and "אל" one location field each
// (fmEnd - the forms' location mechanism with the trip's places and the proposal); the labels follow the kind; "זמן לפני ואחרי" folded.
// A group travel writes my layer over its program line (the source stays), shows "במקור: …" when changed, and ends with "חזרה למקור",
// "להפוך למקום" and "הסרה מהיום" (reversible - no red). Mine ends with "להפוך למקום" and the red "מחיקת הנסיעה".
// o: { pre: values of a new travel (date, to, toLoc, depart, title), conv: { day, id } - the plan card it replaces (a place turned into a travel) }
const TV_FIELDS = ['mode', 'title', 'date', 'from', 'to', 'fromLoc', 'toLoc', 'airline', 'number', 'terminal', 'depart', 'arrive', 'arriveDay', 'note', 'before', 'after'];
const TV_LINE_KEY = { depart: 'start', arrive: 'end' }; // a group travel's field -> its program line's
function openTravelEditor(id, o) { layerNote(openTravelEditor, arguments); o = o || {};
  const t = o.draft ? draftTravelTrip(true) : activeTripObj(), cur = id ? travelById(id, t) : null; if (id && !cur) return; // o.draft: a travel of the draft (Q21), written into the draft
  const grp = !!(cur && cur.group), raw = grp ? rawSched(cur.src) : null, sheet = document.getElementById('sheet'), dated = !!t.start;
  // trip-travel-days (Q5): a new travel opens by the trip's main way of moving (legMain "car" → a car travel; otherwise a flight)
  const v0 = cur ? { ...cur } : { mode: t.legMain === 'car' ? 'car' : 'flight', date: (TRIP_DAYS[0] || {}).date || '', ...(o.pre || {}) }, home = travelHomeEnds(t);
  const F = fmNew({ id, cur, grp, raw: grp ? (o.draft ? (t.schedule || []).find(x => String(x.id) === String(cur.src)) : raw) : null, conv: o.conv || null, v0, t, draft: !!o.draft }), W = travelWords(v0.mode), M = travelMargins(v0);
  const isHome = side => !!cur && home.has(cur.id + '|' + side);
  const end = side => isHome(side) ? fmText(F, side, { label: side === 'from' ? 'מ-' : 'אל', req: !grp, value: v0[side] || '' }) // the owner, 11.11.2026: a group travel's ends are not required (the program gives none)
    : fmEnd(F, side, { label: side === 'from' ? 'מ-' : 'אל', req: !grp, value: { name: v0[side] || '', loc: v0[side + 'Loc'] || null }, travel: () => tvDraft(F), side });
  const nDays = o.draft ? tripLen(t) : TRIP_DAYS.length, dayOpts = () => Array.from({ length: nDays }, (_, i) => vDate(i + 1)).map(v => [v, tmFmt('pick', v)]);
  const mOpts = MARGIN_STEPS.map(m => [String(m), marginText(m)]);
  const srcLine = grp && !o.draft && schedEdChanged(raw) ? [raw.start ? fmEsc(raw.start + (raw.end ? '–' + raw.end : '')) : 'בלי שעה', schedKindIc(raw.kind, fmEsc(SCHED_KIND_NAME[raw.kind] || '')), raw.title && fmEsc(raw.title)].filter(Boolean).join(SEP) : '';
  sheet.innerHTML = `${fmHead(`<span data-tvttl>${travelKindName(v0)}</span>${grp ? (SEP + 'קבוצתי') : ''}`)}
    ${fmChips(F, 'mode', { label: 'סוג', value: v0.mode || 'flight', options: Object.entries(TRAVEL_MODES).map(([k, v]) => [k, msi(TRAVEL_MS[k], { size: 18 }) + ' ' + v[1]]), on: () => tvKind(F) })}
    ${fmText(F, 'title', { label: 'כותרת', value: v0.title || '' })}
    ${dated ? fmDate(F, 'date', { label: 'תאריך', req: true, value: v0.date || '', on: () => tiLand(F) }) : fmChips(F, 'date', { label: 'תאריך', req: true, value: v0.date || '', options: dayOpts(), on: () => tiLand(F) })}
    ${end('from')}${end('to')}
    <div class="sh-times sh-three">${fmText(F, 'airline', { label: 'חברה', value: v0.airline || '' })}${fmText(F, 'number', { label: W.number, value: v0.number || '', dir: 'ltr' })}${fmText(F, 'terminal', { label: 'טרמינל', value: v0.terminal || '', dir: 'ltr' })}</div>
    <div class="sh-times">${fmTime(F, 'depart', { label: W.depart + ' <small class="fm-note">(שעון מקומי)</small>', value: v0.depart || '', clear: true, on: () => tiLand(F) })}${fmTime(F, 'arrive', { label: W.arrive + ' <small class="fm-note">(שעון מקומי)</small>', value: v0.arrive || '', clear: true, on: () => tiLand(F) })}</div>
    ${fmChips(F, 'arriveDay', { label: W.day, value: String(Number(v0.arriveDay) || 0), options: [['-1', '−1'], ['0', 'אותו יום'], ['1', '+1'], ['2', '+2']], hint: '<span id="tiLandTx"></span>', on: () => tiLand(F) })}
    ${fmText(F, 'note', { label: 'הערה', value: v0.note || '' })}
    ${fmSec(F, 'margins', { title: 'זמן לפני ואחרי', ic: 'more_time', sum: F2 => tvMarginSum(F2) },
      `<div class="sh-times">${fmChips(F, 'before', { label: 'להגיע לפני', value: String(M.before), options: mOpts })}${fmChips(F, 'after', { label: 'לצאת אחרי', value: String(M.after), options: mOpts })}</div>`)}
    ${srcLine ? `<p class="sh-hint">במקור: ${srcLine}</p>` : ''}
    ${cur && !o.draft ? (grp ? fmEndActs([schedEdChanged(raw) && { act: 'travel.reset', label: 'חזרה למקור', ic: 'restart_alt' }, { act: 'travel.toPlace', label: 'להפוך למקום', ic: 'location_on' }, { act: 'travel.hide', label: 'הסרה מהיום', ic: 'event_busy' }])
      : fmEndActs([{ act: 'travel.toPlace', label: 'להפוך למקום', ic: 'location_on' }, { act: 'travel.del', label: 'מחיקת הנסיעה', del: true }])) : ''}
    ${fmSaveBar({ act: 'travel.save' })}`;
  showSheetBackdrop('openTravelEditor'); fmAttach(F); tvKind(F, true); tiLand(F);
  if (cur) { endProposalAsk(cur, 'from', t); endProposalAsk(cur, 'to', t); }
  if (o.end) setTimeout(() => { if (layerTop() && layerTop().form === F) openEndChoice(F, o.end); }, 0); // from the card's chip: straight to that end
}
// the travel as the form holds it now (the end choice reads the day and the kind from it)
function tvDraft(F) { const g = k => F.kinds[k] ? fmGet(F, k) : undefined, e = k => { const v = g(k); return v && typeof v === 'object' ? v : { name: v || '', loc: null }; };
  return { ...(F.opts.cur || {}), mode: g('mode'), date: g('date'), from: e('from').name, to: e('to').name, fromLoc: e('from').loc, toLoc: e('to').loc, depart: g('depart'), arrive: g('arrive'), arriveDay: Number(g('arriveDay')) || 0 }; }
function tvKind(F, first) { const m = fmGet(F, 'mode'), W = travelWords(m), lb = (id, tx) => { const l = fmW(F, id) && fmW(F, id).querySelector('.fm-lbl'); if (l && l.firstChild) l.firstChild.textContent = tx; };
  lb('number', W.number); lb('depart', W.depart + ' '); lb('arrive', W.arrive + ' '); lb('arriveDay', W.day);
  const tw = fmW(F, 'terminal'); if (tw) tw.hidden = !W.terminal; const row = tw && tw.parentElement; if (row) row.classList.toggle('sh-three', W.terminal);
  const tt = fmRoot(F).querySelector('[data-tvttl]'); if (tt) tt.textContent = travelKindName({ mode: m });
  if (!first) { const cur = F.opts.cur, own = cur && (cur.before != null || cur.after != null), d = travelMarginDef(m); if (!own) { fmSet(F, 'before', String(d[0]), true); fmSet(F, 'after', String(d[1]), true); } fmSums(F); } }
function tvMarginSum(F) { const m = fmGet(F, 'mode'), b = Number(fmGet(F, 'before')), a = Number(fmGet(F, 'after')), d = travelMarginDef(m);
  return fmEsc(marginLine(b, a)) + (b === d[0] && a === d[1] ? SEP + 'ברירת המחדל ל' + fmEsc(travelKindName({ mode: m })) : ''); }
// the editor's values -> a travel's fields
function tvValues(F) { const v = {}, home = (F.kinds.from === 'text' || F.kinds.to === 'text');
  ['mode', 'title', 'date', 'airline', 'number', 'terminal', 'depart', 'arrive', 'note'].forEach(k => { const x = fmGet(F, k); v[k] = x == null ? '' : String(x).trim(); });
  ['from', 'to'].forEach(side => { const x = fmGet(F, side); if (x && typeof x === 'object') { v[side] = String(x.name || '').trim(); v[side + 'Loc'] = x.loc || null; } else { v[side] = String(x || '').trim(); v[side + 'Loc'] = null; } });
  if (v.mode !== 'flight') v.terminal = ''; v.arriveDay = Number(fmGet(F, 'arriveDay')) || 0;
  const d = travelMarginDef(v.mode), b = Number(fmGet(F, 'before')), a = Number(fmGet(F, 'after')); v.before = b === d[0] && a === d[1] ? null : b; v.after = b === d[0] && a === d[1] ? null : a;
  void home; return v; }
function tvCheck(F, v, t) { if (!v.date) return fmFail(F, 'date', 'חסר תאריך'); if (!F.opts.grp && !v.from) return fmFail(F, 'from', 'חסר מאיפה'); if (!F.opts.grp && !v.to) return fmFail(F, 'to', 'חסר לאן'); // mine: both ends required; the group's: as its program gave them
  if (!F.opts.draft && isHM(v.depart) && isHM(v.arrive)) { const z = travelZones(t, F.opts.cur || { ...v }); if (z.arr && tmMoment(isoAdd(v.date, v.arriveDay), v.arrive, z.arr) <= tmMoment(v.date, v.depart, z.dep)) return fmFail(F, 'arrive', 'הנחיתה יוצאת לפני ההמראה - בודקים את השעות או את יום הנחיתה'); }
  return true; }
act('travel.save', c => { const F = fmOf(c.el); if (!F) return; const { cur, grp, raw, conv, t, draft } = F.opts, v = tvValues(F); if (tvCheck(F, v, t) !== true) return;
  const name = travelTitle(v); closeSheet();
  if (draft) { if (grp) tvLineWrite(raw, v); else trip_travelWrite(t, cur, tvClean({ ...v })); saveDraft(); showUndoToast(`✏️ ${travelSavedWord(v)}: ${name}`); return; } // the draft is the file under review: its line or travel itself
  if (grp) { const src = grpTravelOf(raw, raw, t); planChange(`✏️ הלו״ז עודכן אצלך: ${name}`, () => { tvGrpSet(raw, src, v); schedTidy(raw.id); }); return; }
  trip_travelWrite(t, cur, tvClean({ ...v }), conv);
  syncFlightsToPlan(); persist(); showUndoToast(conv ? `הפך לנסיעה: ${name}` : `✏️ ${travelSavedWord(v)}: ${name}`); });
// Q23 (the review of 11.0.0 (a)): a single travel is named by its kind in the save snackbar - "טיסה נשמרה", "אוטובוס נשמר"
const TRAVEL_FEM = { flight: 1, train: 1, ferry: 1 };
function travelSavedWord(f) { return travelKindName(f) + (TRAVEL_FEM[(f && f.mode) || 'flight'] ? ' נשמרה' : ' נשמר'); }
function tvClean(o) { Object.keys(o).forEach(k => { if (o[k] == null || o[k] === '' || (k === 'arriveDay' && !o[k])) delete o[k]; }); return o; }
function tvLineWrite(s, v) { TV_FIELDS.forEach(k => { const lk = TV_LINE_KEY[k] || k, x = v[k]; if (x == null || x === '' || (k === 'arriveDay' && !x)) delete s[lk]; else s[lk] = x; }); s.kind = v.mode === 'flight' ? 'flight' : 'transfer'; }
function trip_travelWrite(t, cur, v, conv) { t.travels = t.travels || [];
  if (cur) { const o = t.travels.find(x => x.id === cur.id), was = JSON.stringify([o.mode, o.fromLoc, o.toLoc]); TV_FIELDS.forEach(k => { if (v[k] == null) delete o[k]; else o[k] = v[k]; });
    if (JSON.stringify([o.mode, o.fromLoc, o.toLoc]) !== was) { delete o.path; delete o.pathK; delete o.pathNear; } } // 11.2.0: its kept path was for the old kind and ends
  else t.travels.push({ ...v, id: 'f_user_' + Date.now().toString(36) });
  t.travels.sort((a, b) => (a.date + (a.depart || '')).localeCompare(b.date + (b.depart || '')));
  if (conv) removeFromDayQuiet(conv.day, conv.id); }
function removeFromDayQuiet(day, id) { const dd = STATE.itinerary[day]; if (dd) Object.keys(dd).forEach(k => { if (Array.isArray(dd[k])) dd[k] = dd[k].filter(x => x !== id); }); delete STATE.times[timeKey(day, id)]; }
// a group travel: each field against its source - the same value drops my change, another is my change (as setSchedField)
function tvGrpSet(raw, src, v) { const ed = schedEdit(raw), J = x => x == null ? '' : typeof x === 'object' ? JSON.stringify(x) : String(x);
  TV_FIELDS.forEach(k => { const lk = TV_LINE_KEY[k] || k, nv = k === 'arriveDay' ? (v[k] || '') : v[k], sv = k === 'arriveDay' ? (src[k] || '') : src[k];
    if (J(nv) === J(sv)) delete ed.ch[lk]; else ed.ch[lk] = nv == null ? '' : nv; });
  const kind = v.mode === 'flight' ? 'flight' : 'transfer'; if (kind === raw.kind) delete ed.ch.kind; else ed.ch.kind = kind; }
act('travel.del', c => { const F = fmOf(c.el); if (!F) return; const { cur } = F.opts, t = activeTripObj(); if (!cur || cur.group) return;
  t.travels = (t.travels || []).filter(x => x.id !== cur.id); removeFlightFromPlan(cur.id); layerCloseOwn(); tiAfter(SY.del + ' נמחק: ' + travelTitle(cur)); });
act('travel.reset', c => { const F = fmOf(c.el); if (!F) return; const { raw } = F.opts; if (!raw) return; const day = (TRIP_DAYS.find(d => d.date === raw.date) || {}).key; closeSheet();
  planChange('↺ חזר למקור: ' + (raw.title || ''), () => { delete planX().sched[raw.id]; if (day && planX().anchors[day]) { delete planX().anchors[day]['s:' + raw.id]; tidyAnchors(day); } }); });
act('travel.hide', c => { const F = fmOf(c.el); if (!F) return; const { raw } = F.opts; if (!raw) return; closeSheet(); hideSched(raw.id); });
// ---- the end choice (Q11, Q18; picture travels-map-2a, 4): a near-full sheet, the search pinned; "מוצע" (choosing it confirms it),
// "נסיעות הטיול" (the ends of the trip's other travels, that day's first - a recorded taxi joins the flight's airport in one tap; 11.2.0,
// the review of 11.0.0 Q4: every travel of the trip, by date, each point once; was "נסיעות היום"), "מקומות הטיול" (the
// night's hotel, the day's places, the trip's own places), "מקום אחר" (a point on the map); typing adds the address search's results and
// "השם בלבד" (the name edited, the location kept)
let _endF = null;
function openEndChoice(F, side) { const f = tvDraft(F), t = F.opts.t || activeTripObj(), drf = !!F.opts.draft, cur = F.vals[side] || {}, W = travelWords(f.mode), rows = [], seen = new Set();
  const add = (group, ic, name, sub, pick) => { const k = group + '|' + name; if (!name || seen.has(k)) return; seen.add(k); rows.push({ v: 'r' + rows.length, group, html: `${msi(ic, { size: 20 })} ${nameB(name)}`, text: name, sub, pick }); };
  const p = endProposal({ ...f, [side]: cur.name || '', [side + 'Loc']: null }, side, t);
  if (p) add('מוצע', 'location_on', p.name, `לפי ״${fmEsc(p.q)}״${SEP}בחירה מאשרת`, { name: p.name, loc: { lat: p.lat, lng: p.lng } });
  const me = F.opts.cur && String(F.opts.cur.id), day = f.date, pts0 = [];
  // the review of 11.0.0 (Q4): the ends of every travel of the trip (in the draft, the draft's) - that day's first, then by date, each point once
  const onDay = x => !!day && (x.date === day || travelLandDate(x) === day);
  travelsOf(t).filter(x => String(x.id) !== me).map((x, i) => [x, i]).sort((a, b) => (onDay(b[0]) ? 1 : 0) - (onDay(a[0]) ? 1 : 0) || a[1] - b[1]).forEach(([x]) => ['from', 'to'].forEach(sd => { const e = travelEnd(x, sd, t); if (!e.loc || !e.name) return; const w = travelWords(x.mode);
    const c = endCoord(e.loc, t), k = e.loc.pid != null ? 'p' + e.loc.pid : ''; if (pts0.some(q => (k && q.k === k) || (c && q.c && distanceKm(q.c, c) < 0.05))) return; pts0.push({ k, c });
    add('נסיעות הטיול', TRAVEL_MS[x.mode] || 'flight', e.name, fmEsc([onDay(x) ? '' : tmFmt('dayN', sd === 'to' ? travelLandDate(x) : x.date), [x.airline, x.number].filter(Boolean).join(' '), sd === 'from' ? (x.depart ? w.depart + ' ' + x.depart : '') : (x.arrive ? w.arrive + ' ' + x.arrive : '')].filter(Boolean).join(SEP)), { name: e.name, loc: e.loc }); }));
  const dd = drf ? null : TRIP_DAYS.find(d => d.date === day), pts = [];
  (drf ? [] : tripLodging()).filter(l => day && l.checkIn <= day && day <= l.checkOut && l.placeId != null).forEach(l => { const q = POINTS.find(x => x.id === l.placeId); if (q) add('מקומות הטיול', 'hotel', q.name, `${TX.lodging}${SEP}${tmFmt('range', [l.checkIn, l.checkOut])}`, { name: q.name, loc: { pid: q.id } }); });
  if (dd) { mergedIds(dd.key).forEach(id => { const q = planItem(id); if (q && !isNote(q)) pts.push(POINTS.find(x => x.id === (q.dup ? copyRef(id) : id))); }); scheduleOf(dd.date).forEach(s => { if (s.placeId != null && !isTravelKind(s.kind)) pts.push(POINTS.find(x => x.id === s.placeId)); }); }
  if (!drf) (t.places || []).forEach(q => pts.push(POINTS.find(x => x.id === q.id)));
  pts.filter(q => q && routeCoordOf(q)).forEach(q => add('מקומות הטיול', 'location_on', q.name, fmEsc(destName(q.dest || layerDef(q.layer).dest) || ''), { name: q.name, loc: { pid: q.id } }));
  rows.push({ v: 'map', group: 'מקום אחר', html: `${msi('pin_drop', { size: 20 })} סימון במפה`, text: 'סימון במפה', keep: true, pick: 'map' });
  _endF = { F, side };
  const center = (() => { const c = cur.loc && endCoord(cur.loc, t); if (c) return [c.lat, c.lng]; const d = endDest(f, side, t); return d && Array.isArray(d.meta.center) ? d.meta.center : undefined; })();
  openFmChoice({ title: `${side === 'from' ? 'מ-' : 'אל'}${SEP}${fmEsc(fmGet(F, 'title') || travelKindName(f) + (f.to ? ' ל' + f.to : ''))}`, search: true, searchHint: 'חיפוש כתובת או שם', key: 'openEndChoice', options: rows,
    lead: q => [{ v: 'name', group: 'השם', html: `${msi('edit', { size: 20 })} ${nameB(q)}`, text: q, sub: cur.loc ? 'השם בלבד, המיקום נשאר' : 'השם בלבד, בלי מיקום', pick: { name: q, loc: cur.loc || null } }],
    ps: psHost({ box: () => document.getElementById('fmChList'), near: () => center, map: () => { closeSheet(); setTimeout(() => endPickOnMap(fmLive(F), side, center), 0); }, pick: () => {},
      ret: () => tvRet(fmLive(F), side) }), // 11.20.0 (place-search-upgrade): the one place search; 11.21.0 (Q3): an unsaved travel too, with its whole form; 11.21.1: a draft's travel and a conversion too
    psRow: (x, i) => ({ v: 'f' + i, group: 'תוצאות חיפוש', html: `${msi(x.ic || 'search', { size: 20 })} ${nameB(x.name)}`, text: x.name, sub: fmEsc([x.sub || x.country, x.km != null ? fmtKm(x.km) : ''].filter(Boolean).join(SEP)), pick: { name: x.name, loc: { lat: x.coord.lat, lng: x.coord.lng } } }) },
  (v, x) => { const pk = x && x.pick; if (!pk) return; const G = fmLive(F); if (pk === 'map') { endPickOnMap(G, side, center); return; } fmSet(G, side, { name: pk.name, loc: pk.loc || null }); });
}
// 11.21.1 (form-keep-everywhere, found 1): the travel a Google Maps share comes back to - saved or unsaved, mine, a draft's (by the draft's
// own time) or a place being turned into a travel (its conv) - with its whole form (psFormRet); PS_FORMS.travel reopens it
function tvRet(G, side) { if (!G) return null; const dr = !!G.opts.draft;
  return psFormRet(G, () => ({ k: 'travel', id: G.opts.cur ? G.opts.cur.id : null, tid: dr ? null : STATE.activeTrip, dat: dr && DRAFT ? DRAFT.at : null, conv: G.opts.conv || null }), side); }
function endPickOnMap(F, side, center) { const cur = F.vals[side] || {}, c = cur.loc && endCoord(cur.loc), s = c ? [c.lat, c.lng] : center || curDest().meta.center;
  openPick({ how: 'btn', has: !!c, start: s, zoom: c ? 16 : 12, ret: () => tvRet(fmLive(F), side), onPick: r => fmSet(fmLive(F), side, { name: cur.name || r.name || 'מיקום במפה', loc: { lat: +r.coord.lat, lng: +r.coord.lng } }) }); }
// the card's chip (Q13 / done-when): the editor, straight on the end that waits
act('travel.endFix', c => { const [id, side] = String(c.v).split('|'); openTravelEditor(id, { end: side }); });
// ---- a card of the wrong kind (Q20a): place <-> travel, one quiet row at the end of the editor; it keeps the name, the day, the time,
// "קבוצתי" and the link to the source, and moves the location (a place's location becomes the travel's "אל"; a travel keeps its "אל" as the
// place's location); one snackbar with undo.
// A place -> a travel: the travel editor opens on the new travel (the place as "אל", its day and time, its name as the title; the missing end
// and the kind are completed there); saving makes the travel and takes the place's card off that day.
act('pe.toTravel', c => { const F = fmOf(c.el); if (!F) return; const C = F.opts.C, p = C && C.cur; if (!p) return;
  const w = WIN_STACK.slice().reverse().find(x => x.ctx && x.ctx.day), cx = w && findSlot(w.ctx.day, pid(w.ctx.tok || p.id)) ? w.ctx : null; // opened from a plan card's window: that day and that card
  const day = cx ? cx.day : (TRIP_DAYS.find(d => isInDay(d.key, p.id)) || {}).key, id = cx ? pid(cx.tok || p.id) : p.id, tm = day ? getTime(day, id) : null, d = day && dayByKey(day);
  closeSheet(); setTimeout(() => openTravelEditor(null, { pre: { date: d ? d.date : '', depart: tm ? tm.start : '', arrive: tm && tm.end ? tm.end : '', title: p.name, to: p.name, toLoc: { pid: p.id } }, conv: day ? { day, id } : null }), 60); });
// A travel -> a place: "אל" that is a place of the trip comes into the day in the travel's place and time; a point on the map opens the place
// editor (its layer is chosen there) and saving finishes it; with no location it becomes a note. A group travel changes only in my layer over
// its program line ("סוג" פעילות at that place) - the source stays, "חזרה למקור" brings the travel back.
// what saving the place does to the travel it was made from (form-keep-context): found by the travel's id when the place is saved, so the
// editor's opening can be stored across Google Maps; a travel gone by then leaves the place in the day and nothing else
function tvToPlaceThen(id) { const t = hasTrip() ? activeTripObj() : null, f = t && travelById(id, t); if (!f) return null;
  const grp = !!f.group, raw = grp ? rawSched(f.src) : null, day = travelDay(f); if (grp && !raw) return null;
  return { msg: n => `הפך למקום: ${n}`, then: nid => { if (grp) { const ed = schedEdit(raw); ed.ch.kind = 'activity'; ed.ch.placeId = nid; removeFromDayQuiet(day, nid); }
    else { t.travels = (t.travels || []).filter(x => x.id !== f.id); removeFlightFromPlan(f.id); } } }; }
act('travel.toPlace', c => { const F = fmOf(c.el); if (!F) return; const { cur, grp, raw } = F.opts; if (!cur) return; const t = activeTripObj();
  const f = travelById(cur.id, t) || cur, name = f.title || f.to || travelTitle(f), day = travelDay(f), slot = day && findSlot(day, f.id) || (isHM(f.depart) ? slotForTime(f.depart) : 'morning');
  const time = isHM(f.depart) ? { start: f.depart, end: !(Number(f.arriveDay) || 0) && isHM(f.arrive) && f.arrive > f.depart ? f.arrive : '' } : null, loc = f.toLoc, msg = n => `הפך למקום: ${n}`;
  const grpTo = pidV => planChange(msg(name), () => { const ed = schedEdit(raw); ed.ch.kind = 'activity'; if (pidV != null) ed.ch.placeId = pidV; else delete ed.ch.placeId; if (!raw.title) ed.ch.title = name; });
  const mineOut = () => { t.travels = (t.travels || []).filter(x => x.id !== f.id); removeFlightFromPlan(f.id); };
  if (loc && loc.pid == null && isFinite(loc.lat)) { closeSheet(); setTimeout(() => openPlaceEditor({ name, coord: { lat: +loc.lat, lng: +loc.lng }, tripOnly: true, noGuess: true,
      afterSave: day ? { day, slot: time ? 'unassigned' : slot, time, tv: f.id } : null }), 60); return; } // form-keep-context: by the travel's id (tvToPlaceThen) - kept across Google Maps
  closeSheet();
  if (grp) { grpTo(loc && loc.pid != null ? loc.pid : null); return; }
  planChange(msg(name), () => { mineOut(); if (!day) return; let id;
    if (loc && loc.pid != null) id = loc.pid; else { id = 'n_' + Date.now().toString(36); STATE.planItems[id] = { name, address: '', icon: 'note' }; }
    if (!findSlot(day, id)) ensureDay(day)[time ? 'unassigned' : slot].push(id);
    if (time) { STATE.times[timeKey(day, id)] = time; placeTimed(day, id); } }); });
// ---- the list of travels (the trip's details; the draft's "נסיעות" tile - Q21): per travel its ends, the date and numbers, "קבוצתי", the
// proposal chip (a button, as on the plan's card: the editor on the first open end - 11.23.2, P9; none in a read-only list or a memory) and the times; a home end stays text. A row's pencil opens the travel editor.
function travelRowsHTML(t, o) { o = o || {}; const esc = escH, list = travelsOf(t), home = travelHomeEnds(t), ro = !!o.ro;
  return list.map((f, i) => { const W = travelWords(f.mode), st = ro || t.archived ? '' : travelEndsState(f, t) /* a memory confirms nothing */, ic = msi(TRAVEL_MS[f.mode] || 'flight', { size: 18 });
    const endTx = side => esc(f[side] || '—');
    return `<div class="flight-card${f.group ? ' grp' : ''}">
      <div class="flight-route">${msi(TRAVEL_MS[f.mode] || 'flight', { size: 18, cls: 'fr-ic' })} <span class="fr-ends">${endTx('from')} ← ${endTx('to')}</span>${ro ? '' : ` <button class="icon-btn" data-act="${o.act || 'trip.editTravel'}" data-v="${esc(String(f.id))}" title="עריכה" aria-label="עריכה">${msi('edit', { size: 18 })}</button>`}</div>
      <div class="flight-meta">${tmFmt('date', f.date)}${f.airline || f.number ? SEP + esc([f.airline, f.number].filter(Boolean).join(' ')) : ''}${f.terminal ? SEP + 'טרמינל ' + esc(f.terminal) : ''}${f.title ? SEP + esc(f.title) : ''}</div>
      ${f.group || st ? `<div class="cd-tags">${f.group ? grpTag() : ''}${st ? `<button type="button" class="tl-tag cd-when settime tv-prop" data-act="${o.act === 'draft.travelEdit' ? 'draft.travelEndFix' : 'travel.endFix'}" data-v="${esc(f.id + '|' + travelFirstOpenEnd(f, t))}">${tagIc('location_on')}${st === 'prop' ? 'מיקום מוצע, לאישור' : 'חסר מיקום'}</button>` : ''}</div>` : ''}
      ${f.depart || f.arrive ? `<div class="flight-times"><span>${W.depart} <strong>${esc(f.depart || '—')}</strong></span><span class="flight-arrow">${ic}</span><span>${W.arrive} <strong>${esc(f.arrive || '—')}</strong></span></div>` : ''}
      ${i === 0 && o.countdown ? '<div id="flightCountdown" class="countdown-badge"></div>' : ''}
    </div>`; }).join('') + (void home, ''); }
// the draft's tile: the draft trip's travels in a bottom sheet "נסיעות · N", read as they will arrive (a light review, Q21; the ends Claude
// writes are confirmed with the draft's approval); a pencil opens the travel editor on the draft itself (the file under review).
function draftTravelTrip() { const d = DRAFT && DRAFT.data, t = d && d.trip; if (!t) return null; if (!t.__draft) Object.defineProperty(t, '__draft', { value: true, configurable: true }); return t; } // the draft's own trip (not stored: a flag for the readers - no layer of mine)
function openDraftTravels() { layerNote(openDraftTravels, arguments); const t = draftTravelTrip(); if (!t) return; const n = travelsOf(t).length, sheet = document.getElementById('sheet');
  sheet.innerHTML = `${fmHead(`${TX.travels}${SEP}${n}`, 'dtClose')}${travelRowsHTML(t, { act: 'draft.travelEdit' })}`;
  showSheetBackdrop('openDraftTravels'); }
act('draft.travels', () => openDraftTravels());
act('draft.travelEdit', c => openTravelEditor(c.v, { draft: true }));
act('draft.travelEndFix', c => { const [id, side] = String(c.v).split('|'); openTravelEditor(id, { draft: true, end: side }); }); // phone-round-2b-fixes P9 (G59): the chip is the plan card's button - the editor on the first open end

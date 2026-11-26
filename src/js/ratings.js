// ================= RATINGS, A TRIP'S DATA BY ID AND THE WELCOME-BACK CARD (split from closing.js in diet-groups, 11.62.0; the guided closing flow stays there, in the memories group) =================
// CLOSING (the flow open now) and TRIP_HIDDEN are here: the files' route and the active trip read them; the closing flow (memories group) sets CLOSING
var CLOSING;       // { id, step }
var TRIP_HIDDEN;   // places hidden only in the active trip (👎 imported from a past trip)
var _pastRateCache = null;
const RATE = { love: '❤️', like: '👍', dislike: '👎' }, RATE_LABEL = { love: 'אהבתי', like: 'היה טוב', dislike: 'לא שווה' };
function tdOf(id) { if (id === STATE.activeTrip) stashActive(); return STATE.tripData[id] = STATE.tripData[id] || { favorites: [], visited: [], itinerary: {}, times: {}, planItems: {} }; }
function tdSave(id, quiet) { if (id === STATE.activeTrip) loadPersonal(id); persist(quiet); } // quiet: saved, nothing redrawn (a draft kept as typed - artReqSet)
function ratingOf(pid, id) { const td = id ? tdOf(id) : (STATE.tripData[STATE.activeTrip] || {}); return (td.rating || {})[pid] || null; }
function setRating(id, pid, r, word) {
  const td = tdOf(id);
  td.rating = { ...(td.rating || {}) }; const cur = td.rating[pid] || {};
  if (r === undefined) r = cur.r; if (r === cur.r && word === undefined) delete td.rating[pid]; else td.rating[pid] = { r, ...(word !== undefined ? (word ? { w: word } : {}) : (cur.w ? { w: cur.w } : {})) };
  if (td.rating[pid] && !td.rating[pid].r) delete td.rating[pid];
  tdSave(id); _pastRateCache = null;
}
// ⭐ on a place's card, during the trip and after it: ❤️ / 👍 / 👎 for a place I visited
function rateRowHTML(p) {
  const t = activeTripObj(), st = tripState(t); if (!t.id || ARCHIVE_VIEW || !(st === 'during' || st === 'ended') || !STATE.visited.has(p.id)) return '';
  const cur = ratingOf(p.id) || {};
  return `<div class="rate-row" data-ref="place:${p.id}"><span>איך היה?</span>${Object.keys(RATE).map(k => `<button type="button" class="rate-btn" data-act="place.rate" data-v="${k}" aria-pressed="${cur.r === k}" title="${RATE_LABEL[k]}">${RATE[k]}</button>`).join('')}${cur.w ? `<small>"${escH(cur.w)}"</small>` : ''}</div>`;
}
// what I said about a place in a past trip (archived), shown small on its card in a new trip
function pastRatingFor(pid) {
  if (!_pastRateCache) { _pastRateCache = new Map();
    Object.values(STATE.trips).filter(t => t.archived && t.archived.reason !== 'cancelled').sort((a, b) => String(a.end).localeCompare(String(b.end))).forEach(t => {
      Object.entries((STATE.tripData[t.id] || {}).rating || {}).forEach(([k, v]) => _pastRateCache.set(Number(k), { ...v, year: String(t.end || '').slice(0, 4), trip: t.name, tid: t.id })); }); }
  const v = _pastRateCache.get(pid); return v && v.tid !== STATE.activeTrip ? v : null;
}
function pastRateTagHTML(p) { const v = pastRatingFor(p.id); return v ? `<button type="button" class="badge past-rate" data-act="place.pastRate" data-v="${p.id}">${v.year} ${RATE[v.r] || ''}</button> ` : ''; }
// 4.37.0: the same tag, small, in the plan's cards and the map's floating card (it was only in the full card)
function pastRateBase(p) { return !p ? null : p.dup ? copyRef(p.id) : p.planOnly ? null : p.id; } // 4.37.2: a duplicate shows its original's rating
function pastRateMiniHTML(p) { const id = pastRateBase(p); if (id == null) return ''; const v = pastRatingFor(id); return v ? `<span class="past-rate past-mini" data-act="place.pastRate" data-v="${id}">${v.year} ${RATE[v.r] || ''}</span>` : ''; }
act('place.rate', c => { const pid = Number(c.ref.id), r = c.v, cur = ratingOf(pid) || {};
  setRating(STATE.activeTrip, pid, cur.r === r ? null : r);
  showUndoToast(cur.r === r ? 'הדירוג הוסר' : `${RATE[r]} ${RATE_LABEL[r]}: ${placeName(pid)}`); });
act('place.pastRate', c => { const v = pastRatingFor(Number(c.v)); if (v) showToast(`בטיול "${String(v.trip).split(' · ')[0]}" (${v.year}): ${RATE[v.r]} ${RATE_LABEL[v.r]}${v.w ? `${SEP}"${v.w}"` : ''}`); });

// ---- the welcome-back card (after the trip, instead of "today" and the weather) ----
function welcomeBackHTML(t) {
  if (t.archived || ARCHIVE_VIEW) return ''; // 11.37.0 (phone-round-4-fixes P2, G84): a memory is closed - its full view offers no closing
  const td = tdOf(t.id), co = td.closeOffer || {}; if (co.never) return '';
  const now = Date.now(), thin = (co.snoozeUntil && now < co.snoozeUntil) || (co.dismissedAt && !co.snoozeUntil && now - co.dismissedAt < 7 * 864e5);
  if (thin) return `<button type="button" class="today-card wb-thin" id="wbOpen" data-act="welcome.wbOpen">${msi('cottage', { size: 20 })}<span>${escH(String(t.name).split(' · ')[0])} הסתיים${SEP}סגירת הטיול</span>${msi('chevron_right', { size: 20 })}</button>`;
  const days = dayList(t.start, t.end).length, vis = (td.visited || []).length, nd = tripDests(t).length, back = co.dismissedAt || co.snoozeUntil;
  return `<div class="today-card wb-card tcd-after" id="todayCard"><div class="tc-title">${msi('cottage', { size: 20 })}ברוכים השבים מ${escH(String(t.name).split(' · ')[0])}</div>
    ${tlLateLineHTML(t)}<p class="wb-sum">${days} ימים${nd > 1 ? `${SEP}${nd} יעדים` : ''}${vis ? `${SEP}${vis} מקומות ש${TX.visited}` : ''}. סגירה קצרה (כ-3-5 דקות, כל שלב רשות) שומרת את הטיול כזיכרון: איפה ${TX.visited}, מה אהבתם ורגעי השיא - ומכינה את המזכרות.</p>
    ${cardActionsHTML({ id: 'wbClose', act: 'welcome.wbClose', label: `${msi('inventory_2', { size: 18 })} סגירת הטיול` }, back ? [{ id: 'wbSnooze', act: 'welcome.wbSnooze', label: 'דחייה בשבוע' }, { id: 'wbNever', act: 'welcome.wbNever', label: 'לא להזכיר יותר' }] : [{ id: 'wbLater', act: 'welcome.wbLater', label: 'לא עכשיו' }])}</div>`; // card-actions (Q1): the primary at full width, the rest as text under it
}
function welcomeBackCtl() { const ctl = ctlNS('welcome');
  const t = activeTripObj(), g = id => document.getElementById(id); if (!t.id) return;
  const set = (patch, msg) => { const td = tdOf(t.id); td.closeOffer = { ...(td.closeOffer || {}), ...patch }; tdSave(t.id); showUndoToast(msg); };
  if (g('wbOpen')) ctl.wbOpen = () => viaGroup('memories', 'openClosingFlow', t.id);
  if (g('wbClose')) ctl.wbClose = () => viaGroup('memories', 'openClosingFlow', t.id);
  if (g('wbLater')) ctl.wbLater = () => set({ dismissedAt: Date.now() }, 'בסדר. הכרטיס יחזור בעוד שבוע');
  if (g('wbSnooze')) ctl.wbSnooze = () => set({ snoozeUntil: Date.now() + 7 * 864e5 }, 'נזכיר בעוד שבוע');
  if (g('wbNever')) ctl.wbNever = () => set({ never: true }, 'לא נזכיר. הטיול מחכה לסגירה במסך הטיולים');
}
ctlActs('welcome', ['wbClose', 'wbLater', 'wbNever', 'wbOpen', 'wbSnooze']);
// 4.41.1: which destination an edit belongs to - a place or layer of a destination by its id range, an added one by its own dest
function destOfEditId(id, e) {
  if (e && e.data && e.data.dest) return e.data.dest; const n = Number(id); if (!isFinite(n)) return null;
  const d = Object.values(DESTS).find(x => n >= (x.idBase || 0) && n < (x.idBase || 0) + 1e6 && ((x.places || []).some(p => (x.idBase || 0) + p.id === n) || ((x.meta || {}).layers || []).some(l => (x.idBase || 0) + l.id === n)));
  return d ? d.id : null;
}
function baseNameOf(id) { const n = Number(id), d = Object.values(DESTS).find(x => (x.places || []).some(p => (x.idBase || 0) + p.id === n)); if (!d) return ''; const p = d.places.find(q => (d.idBase || 0) + q.id === n); return p ? p.name : ''; }
// importing ❤️ as favorites and 👎 as hidden into a new trip to a place I've been
function pastRatingsForDests(ids) {
  const out = { love: [], dislike: [] }; const seen = new Set();
  Object.values(STATE.trips).filter(t => t.archived && t.archived.reason !== 'cancelled' && tripDests({ segments: Object.keys((t.archived.snap || {}).dests || {}).map(d => ({ dest: d })) }).some(d => ids.includes(d)))
    .forEach(t => Object.entries((STATE.tripData[t.id] || {}).rating || {}).forEach(([k, v]) => { const pid = Number(k); if (seen.has(pid)) return; seen.add(pid); if (v.r === 'love') out.love.push(pid); if (v.r === 'dislike') out.dislike.push(pid); }));
  return out;
}
function importRatingsOffer(td, segs) { // 7.2.0: called only when the toggle in the trip editor is on
  const r = pastRatingsForDests([...new Set(segs.map(s => s.dest))]);
  td.favorites = [...new Set([...(td.favorites || []), ...r.love])]; td.hidden = [...new Set([...(td.hidden || []), ...r.dislike])];
}
function tlOf(id) { return (STATE.tripData[id] || {}).tl || null; }
// B1: a cancelled trip never offers the Timeline import (the memory ⋮ row, the late line, the before-trip reminder)
function tlCancelled(t) { return !!(t && t.archived && t.archived.reason === 'cancelled'); }
// the "לקראת הטיול" row: until "כבר דלוק" (this trip) or "לא מעניין אותי" (this phone; the settings switch brings it back)
function tlRemindRowHTML(t, ic) { if (!t || !t.id || tlCancelled(t) || hintSeen('tl.never') || (tdOf(t.id) || {}).tlOn) return '';
  return `<button type="button" class="tc-row tc-btn t-wrap" id="tcTl" data-act="tl.remind">${ic('timeline')}<span><b>להדליק את ציר הזמן של גוגל?</b><small>כדי שסגירת הטיול תהיה קלה ומדויקת ›</small></span></button>`; }
// the welcome-back card's quiet line (addendum; C7, decisions 2026-11-13): Google deletes each day on its own after about three months,
// the first days first - so from the day the trip's first day is 70 days old until its last day is 90 days old, until imported
// (a long trip is warned in time; no trip is warned after everything is gone)
const TL_LATE = { first: 70, last: 90 };
function tlLateLineHTML(t) { if (!t || !t.start || !t.end || tlOf(t.id) || tlCancelled(t)) return ''; const now = todayStr();
  return daysBetween(t.start, now) >= TL_LATE.first && daysBetween(t.end, now) <= TL_LATE.last ? `<p class="wb-late">${msi('timeline', { size: 16, cls: 'msi-in' })} ${tipText('tl.late')}</p>` : ''; }
// the trip picture's typed request for an illustrated version survives an undo (diet-groups: from trip-picture-out.js - an undo runs with or
// without the memories group in)
let ART_REQ = null;
undoBefore(() => { ART_REQ = {}; Object.entries(STATE.tripData).forEach(([t, d]) => { const r = ((d || {}).pic || {}).request; if (r) ART_REQ[t] = r; }); });
undoAfter(keys => { const R = ART_REQ || {}; ART_REQ = null;
  Object.keys(STATE.tripData).concat(Object.keys(R)).forEach(t => { if (!keys.includes(hKey(['d', t, 'pic'])) && !keys.includes(hKey(['d', t]))) return;
    const d = STATE.tripData[t]; if (!d || (((d.pic || {}).request) || '') === (R[t] || '')) return;
    const p = { ...(d.pic || {}) }; if (R[t]) p.request = R[t]; else delete p.request; d.pic = p; tdSave(t); }); });

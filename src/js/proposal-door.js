// ================= THE SCHEDULE PROPOSAL'S DOOR IN THE PLAN (split from js/proposal.js in diet-mechanism) =================
// The plan draws these on every planning day: the proposal's row at the top of the plan, the request button and the empty plan's state;
// a trip that ends drops its unapplied proposal (startup), and the days follow the plan's (day operations). The proposal's window, its
// preview and applying it are js/proposal.js, in the AI group - loaded on demand through the doors' actions (prop.view, prop.ask).
function propOf(id) { const td = (STATE.tripData || {})[id || STATE.activeTrip]; return (td && td.proposal) || null; }
function propDays(P) { return TRIP_DAYS.map(d => d.key).filter(k => P && P.days && P.days[k]); } // the days still in the proposal, in the trip's order
function propMusts(P) { return propDays(P).reduce((n, k) => n + P.days[k].items.filter(x => x.must).length, 0); }
function propCan() { const t = activeTripObj(), st = tripState(t); return !!t.id && !ARCHIVE_VIEW && (st === 'before' || st === 'during') && !document.body.classList.contains('read-only'); }
const propN = n => n === 1 ? 'יום אחד' : n + ' ימים';
// when the trip ends an unapplied proposal goes quietly (Q6): the app's own change, in no undo row
function propExpire() { let n = 0; Object.keys(STATE.tripData || {}).forEach(id => { const td = STATE.tripData[id], t = STATE.trips[id]; if (!td || !td.proposal) return; const st = t ? tripState(t) : 'ended';
    if (st !== 'ended' && st !== 'archived') return; if (id === STATE.activeTrip) stashActive(); delete STATE.tripData[id].proposal; n++; try { hAbsorb(hKey(['d', id, 'proposal'])); } catch (e) {} });
  if (n) persist(true); return n; }
// days moved, added or parked (rebuildTripDays): the proposal's days follow the plan's; a day that left the trip leaves the proposal
function propRemap(td, mapK) { const P = td && td.proposal; if (!P) return; const days = {}, sig = {};
  Object.keys(P.days || {}).forEach(k => { const j = mapK(k); if (j == null) return; days['d' + j] = P.days[k]; if (P.sig && P.sig[k] != null) sig['d' + j] = P.sig[k]; });
  if (Object.keys(days).length) td.proposal = { ...P, days, sig, applied: (P.applied || []).map(k => { const j = mapK(k); return j == null ? null : 'd' + j; }).filter(Boolean) }; else delete td.proposal; }
// ---- the arrival row at the top of the plan (no ✕: the preview drops it) ----
function propRowHTML() { const P = propOf(); if (!P || !propCan()) return ''; const n = propDays(P).length; if (!n) return '';
  const ap = (P.applied || []).filter(k => dayByKey(k)).map(dayIdx).sort((a, b) => a - b), m = propMusts(P);
  const sub = ap.length ? `נותרו ${propN(n)} בהצעה${SEP}${ap.length === 1 ? 'יום ' + ap[0] : 'ימים ' + ap.join(', ')} כבר אצלך` : `${propN(n)}${m ? `${SEP}${m} לא לפספס` : ''}${SEP}התוכנית שלך לא השתנתה`;
  return `<button type="button" class="prop-row t-wrap" id="propRow" data-act="prop.view">${claudeMark({ size: 24 })}<span class="prop-row-t"><b>הצעת לו״ז מה-${AI}</b><small>${sub}</small></span><span class="prop-row-go">לעיון</span></button>`; }
// ---- the doors: an empty plan's one empty state; a button in the plan's top row (Q7) ----
function planEmpty() { return !TRIP_DAYS.some(d => mergedIds(d.key).some(id => !isTravelItem(planItem(id))) || scheduleOf(d.date).some(s => !isTravelKind(s.kind))); } // travels alone are not a plan yet
function propAskBtn(id) { return `<button type="button" class="chip prop-ask"${id ? ` id="${id}"` : ''} data-act="prop.ask">${claudeMark({ size: 18 })}לו״ז מה-${AI}</button>`; }
function planEmptyHTML() { return `<div class="card plan-empty">${emptyHTML(msi('event_note'), 'משבצים מקומות מהרשימה, או מבקשים מה-' + AI + ' הצעה ראשונה', '', 'התוכנית עוד ריקה')}${propCan() ? propAskBtn('propAskEmpty') : ''}</div>`; }

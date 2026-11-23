// ================= 11.23.0 (place-gid-2): THE GOOGLE ID, LOOKED UP IN THE BACKGROUND - the server's lookup, re-checks, the pass over stored places =================
// decisions 2026-11-16 · A Google place id for every place (Q3, Q4, Q5, Q9 (2)); spec/google-id-looked-up.md "The Google id" (the lookup).
// A place with no id record is asked of the app's own server function (netlify/functions/place-id.mjs; service gidLookup, provider
// siteIds) by its name, its destination's name and its point; the server keeps Google's answer only when Google's own point for it is
// within 150 m of ours, and returns the id alone. The record (place-gid.js) then says where it came from:
//   found       { id, cid, src: 'app', at }
//   not found   { src: 'app', at, miss } - miss: the day of the first lookup that found nothing; a second lookup 30 days later; when it
//               finds nothing too, at moves on (at ≠ miss) and the place is never looked up again
//   unlinked    { src: 'user', at, off: true } - never looked up (place-gid-1)
// When (Q5): a place without a record - at once in the background (every change of the data starts the pass again, the active trip
// first); a place moved more than 150 m in its editor - an 'app' record (found or not) is dropped and looked up again at the new point,
// any other source stays (place-editor.js pe.save); a name change keeps the id; an id older than 12 months is checked (a new id replaces
// it with its source kept; "obsolete" removes it whatever the source - an obsolete id identifies nothing - and the lookup follows).
// The pass (Q4): every stored place in this order - the active trip, then near and future trips (by their start), each with its
// destinations' places; then the other destinations; then past trips and the memories of closed trips (their snapshots). Only with
// network (it stops and waits for 'online'), slowly (the provider's gap), on later opens until done; no message. A "later" answer pauses
// it (gid-fixes item 4; decisions 2026-11-18 · Review of the 11.23.0 summary, Q1): `until: 'day'` (Google's day cap, or a quota refusal
// of unknown kind) until the next day by the phone's date (the upkeep row: gidLaterDay, the day it paused), `until: 'month'` (the server's
// monthly counter; an older answer without `until`) until the next calendar month (gidLater, the month). Inside the Claude
// copy (no server) nothing is asked; a site with no such function (404) is not asked again in this opening.
const GID_NEAR_KM = 0.15, GID_MISS_DAYS = 30, GID_OLD_DAYS = 365, GID_START_MS = 8000, GID_STEP_MS = 400;
const GID_LOOK = { on: MAP_AVAILABLE, busy: false, t: 0, skip: new Set(), gone: false, n: 0 }; // skip: places that failed in this opening
function gidLookSoon(ms) { try { if (!GID_LOOK.on || GID_LOOK.gone) return; } catch (e) { return; } // persist runs at startup before this part is read (GID_LOOK not yet there)
  clearTimeout(GID_LOOK.t); GID_LOOK.t = setTimeout(gidLookStep, ms == null ? 1500 : ms); }
window.addEventListener('online', () => gidLookSoon(2000));
function gidMonth() { return tmPhoneDate().slice(0, 7); }
function gidPaused() { const u = regRead('upkeep'), m = u.gidLater; return (!!m && m >= gidMonth()) || gidPausedDay(); }
function gidPausedDay() { const d = regRead('upkeep').gidLaterDay; return !!d && d >= tmPhoneDate(); }
const GID_DAY_RECHECK_MS = 30 * 60 * 1000; // a day's pause: an app left open past midnight looks again within half an hour
function gidDays(a, b) { return Math.round((Date.parse(b) - Date.parse(a)) / DAY_MS); }
// what a record asks for now: 'look' | 'check' | null
function gidNeed(g, today) {
  if (!g || typeof g !== 'object') return 'look';
  if (g.off) return null;
  if (g.id || g.cid) return g.id && gidDays(g.at, today) >= GID_OLD_DAYS ? 'check' : null; // a cid alone cannot be asked about (Google's ids only)
  if (g.miss) return g.at === g.miss && gidDays(g.miss, today) >= GID_MISS_DAYS ? 'look' : null;
  return 'look';
}
// ---- every stored place, in the pass's order: { w: 'trip' | 'dest' | 'snap', trip, id, name, dest, ll, g } ----
function gidPlaces() {
  const out = [], seen = new Set(), add = (w, trip, p, dest) => { const k = (w === 'dest' ? 'd:' : w + ':' + trip + ':') + p.id; if (seen.has(k)) return; seen.add(k);
    out.push({ k, w, trip, id: p.id, name: p.name || '', dest: dest || p.dest, ll: draftCoord(p), g: p.gid, quiet: !!p.quiet }); };
  const trips = Object.values(STATE.trips || {}).filter(t => t && t.id), st = t => tripState(t);
  const live = trips.filter(t => st(t) === 'during' || st(t) === 'before').sort((a, b) => (a.id === STATE.activeTrip ? -1 : b.id === STATE.activeTrip ? 1 : 0) || String(a.start || '9').localeCompare(String(b.start || '9')));
  const act = STATE.trips[STATE.activeTrip]; if (act && !live.includes(act) && !act.archived) live.unshift(act);
  const tripAndDests = t => { (t.places || []).forEach(p => add('trip', t.id, p)); destPlacesRead(tripDests(t)).forEach(p => add('dest', null, p)); };
  live.forEach(tripAndDests);
  destPlacesRead(Object.keys(DESTS).filter(id => !DESTS[id].ghost)).forEach(p => add('dest', null, p));
  trips.filter(t => !live.includes(t)).forEach(t => { (t.places || []).forEach(p => add('trip', t.id, p));
    ((t.archived && t.archived.snap && t.archived.snap.places) || []).forEach(p => { if (!seen.has('d:' + p.id) && !seen.has('trip:' + t.id + ':' + p.id)) add('snap', t.id, p); }); });
  return out;
}
function gidNext() { const today = todayStr();
  for (const c of gidPlaces()) { if (GID_LOOK.skip.has(c.k)) continue; const need = gidNeed(c.g, today); if (!need) continue; if (need === 'look' && (c.quiet || !c.ll || !c.name.trim())) continue; return { ...c, need }; } // legal-server-fixes (Q1): a quiet place (a Timeline offer near home) is never looked up - its name and point stay on the phone
  return null; }
// ---- writing a record (or none: null) where the place lives; the app's own finding - absorbed into the undo history's base ----
function gidSet(o, rec) { if (rec) o.gid = rec; else delete o.gid; return o; }
function gidWrite(c, rec) {
  const keys = [];
  if (c.w === 'trip' || c.w === 'snap') { const t = STATE.trips[c.trip]; if (!t) return false;
    if (c.w === 'trip') t.places = (t.places || []).map(x => x.id === c.id ? gidSet({ ...x }, rec) : x);
    const sp = t.archived && t.archived.snap && (t.archived.snap.places || []).find(x => x.id === c.id); if (sp) gidSet(sp, rec);
    keys.push(hKey(['t', c.trip])); }
  else { const E = STATE.edits.places, e = E[c.id], who = STATE.settings.deviceName || '', at = Date.now();
    if (e && e.op === 'add') E[c.id] = { ...e, data: gidSet({ ...e.data }, rec) };
    else { const d0 = DESTS[c.dest], b = d0 && destPlaces(d0).find(x => x.id === c.id), d = { ...(e && e.op === 'edit' ? e.data : {}) };
      if (rec) { if (b && JSON.stringify(b.gid || null) === JSON.stringify(rec)) delete d.gid; else d.gid = rec; }
      else if (b && b.gid) d.gid = null; else delete d.gid; // null: the destination's own record is gone (the door keeps it in an edit)
      if (Object.keys(d).length) E[c.id] = { op: 'edit', data: d, at: e ? e.at : at, who: e ? e.who : who }; else delete E[c.id]; }
    keys.push(hKey(['e', 'places', String(c.id)])); }
  if (rec) Object.values(STATE.trips || {}).forEach(t => { const sp = t && t.archived && t.archived.snap && (t.archived.snap.places || []).find(x => x.id === c.id && !gidOf(x) && !(x.gid && x.gid.off));
    if (sp && t.id !== c.trip) { sp.gid = rec; keys.push(hKey(['t', t.id])); } }); // a closed trip's memory shows the place it kept
  rebuildPoints(); persist(true); try { hAbsorb(keys); } catch (e) {}
  return true;
}
// ---- one step: one place asked, its answer written, the next step after the provider's gap ----
function gidAskUrl(c) { const d = DESTS[c.dest], q = [c.name.trim(), d && d.meta && d.meta.name].filter(Boolean).join(', ');
  return c.need === 'check' ? location.origin + '/api/place-id?op=check&id=' + encodeURIComponent(c.g.id)
    : location.origin + '/api/place-id?op=find&q=' + encodeURIComponent(q.slice(0, 200)) + '&lat=' + (+c.ll.lat).toFixed(6) + '&lng=' + (+c.ll.lng).toFixed(6); }
async function gidLookStep() {
  if (!GID_LOOK.on || GID_LOOK.gone || GID_LOOK.busy || OLD_COPY) return; if (svcNetDown()) return; // no network: 'online' starts it again
  if (gidPaused()) { if (!(regRead('upkeep').gidLater >= gidMonth())) gidLookSoon(GID_DAY_RECHECK_MS); return; }
  let c; try { c = gidNext(); } catch (e) { errNote('gid.look', e); return; } if (!c) return;
  GID_LOOK.busy = true; let r;
  try { r = await svcAsk('gidLookup', { key: c.k, build: () => ({ url: gidAskUrl(c), as: 'text', empty404: true, ms: 20000 }),
    parse: t => { if (!/^\s*\{/.test(t)) return SVC_EMPTY; const d = JSON.parse(t); if (!d || !['found', 'none', 'later', 'same', 'new', 'obsolete'].includes(d.r)) throw new Error('answer'); return d; } }); }
  finally { GID_LOOK.busy = false; }
  if (r.kind === 'empty') { GID_LOOK.gone = true; return; } // this site has no such function (404, or a page instead of an answer - an older deploy, the tests' server): not asked again in this opening
  if (r.kind === 'offline') return;
  if (r.kind !== 'ok') { GID_LOOK.skip.add(c.k); return gidLookSoon(GID_STEP_MS); }
  gidApply(c, r.value); gidLookSoon(GID_STEP_MS);
}
// the answer -> the record (the place is read again: the user may have changed it while the question was out)
function gidApply(c, a) {
  const now = gidPlaces().find(x => x.k === c.k), today = todayStr(); if (!now) return;
  if (a.r === 'later') { const day = a.until === 'day'; regWrite('upkeep', { ...regRead('upkeep'), ...(day ? { gidLaterDay: tmPhoneDate() } : { gidLater: gidMonth() }) }); return; }
  if (JSON.stringify(now.g || null) !== JSON.stringify(c.g || null)) return; // changed meanwhile: the next step looks at it as it is now
  GID_LOOK.n++;
  if (c.need === 'look') {
    if (a.r === 'found') { const g = gidOfId(a.id); if (g) { gidWrite(c, gidNew(g, 'app')); return; } }
    if (a.r === 'found' || a.r === 'none') { const g = c.g; gidWrite(c, g && g.miss ? { src: 'app', at: today, miss: g.miss } : { src: 'app', at: today, miss: today }); }
    return; }
  if (a.r === 'same') gidWrite(c, { ...c.g, at: today });
  else if (a.r === 'new') { const g = gidOfId(a.id); if (g) gidWrite(c, gidNew(g, c.g.src)); else GID_LOOK.skip.add(c.k); }
  else if (a.r === 'obsolete') gidWrite(c, null); // the lookup follows (source 'app')
  else GID_LOOK.skip.add(c.k);
}
// Q5 (2), one rule for every move (gid-fixes item 5; decisions 2026-11-18 · Review of the 11.23.0 summary, Q2): a place moved more than
// 150 m - its 'app' record (found or not) goes, so it is looked up again at the new point; a record of another source stays.
// The one test, used by the editor (pe.save) and by a destination's update (gidDropMovedDest)
function gidAfterMove(cur, coord) { const g = cur && cur.gid, c0 = cur && draftCoord(cur);
  return !!(g && g.src === 'app' && coord && c0 && distanceKm(c0, coord) > GID_NEAR_KM); }
// a destination's update (installDestination: a file, or any path that replaces its places): the app's record lives in my edit beside
// the file (gidWrite); where the place's point as shown - the file's, unless my edit fixes its own - moves more than 150 m, the record
// leaves the edit (the file's own record, of another source, shows again). Before DESTS takes the new places; no history row of its own
function gidDropMovedDest(ex, dp) { const E = STATE.edits.places, base = ex.idBase || 0, was = new Map((ex.places || []).map(p => [p.id, p]));
  (dp.places || []).forEach(np => { const o = was.get(np.id), id = base + np.id, e = E[id]; if (!o || !e || e.op !== 'edit' || !e.data || !e.data.gid) return;
    const before = { ...o, ...e.data }, after = draftCoord({ ...np, ...e.data, gid: undefined });
    if (!gidAfterMove(before, after)) return;
    const d = { ...e.data }; delete d.gid; if (Object.keys(d).length) E[id] = { ...e, data: d }; else delete E[id]; }); }

// ================= FILES: references and the way out (split from trip-files.js in diet-groups, 11.62.0; building and installing a file stay there, in the management group) =================
// ---- files: destination & trip ----
// 4.2.1: place references in a file that leaves the device are written relative to their destination ("@dest:localId").
// Every phone numbers an imported destination its own way (idBase), so device ids would point at the wrong places.
function portableRef(id, t) {
  if (typeof id !== 'number' || id >= 1e11) return id;              // notes and copies (plan items), places added on a phone
  if ((t.places || []).some(p => p.id === id)) return id;           // trip places keep their own ids
  for (const did of tripDests(t)) { const d = DESTS[did]; const loc = id - (d.idBase || 0); if (loc >= 0 && d.places.some(p => p.id === loc)) return '@' + did + ':' + loc; }
  return id;
}
function deviceRef(ref) { // "@dest:id" -> this device's id (null when the destination isn't here)
  if (typeof ref !== 'string' || ref[0] !== '@') return ref;
  const m = ref.match(/^@(.+):(\d+)$/); if (!m || !DESTS[m[1]]) return null; return (DESTS[m[1]].idBase || 0) + Number(m[2]);
}
function mapPersonalRefs(p, f) { // apply f to every place reference in personal data; null drops it
  if (!p) return p; const arr = a => (a || []).map(f).filter(x => x != null); const out = { ...p };
  ['favorites', 'visited', 'notReached', 'hidden'].forEach(k => { if (p[k]) out[k] = arr(p[k]); });
  const keys = o => { const r = {}; Object.entries(o || {}).forEach(([k, v]) => { const x = f(/^\d+$/.test(k) ? Number(k) : k); if (x != null) r[x] = v; }); return r; }; // 8.0.0
  if (p.bookings) out.bookings = keys(p.bookings); if (p.rating) out.rating = keys(p.rating);
  if (p.highlights) out.highlights = p.highlights.map(h => ({ ...h, placeId: h.placeId != null ? f(h.placeId) : null }));
  if (p.companions) out.companions = Object.fromEntries(Object.entries(p.companions).map(([n, x]) => [n, { ...x, visited: arr(x.visited), rating: keys(x.rating), highlights: (x.highlights || []).map(h => ({ ...h, placeId: h.placeId != null ? f(h.placeId) : null })) }]));
  ['pic', 'photoOrder'].forEach(k => { if (p[k] != null) out[k] = JSON.parse(mapPicTokens(JSON.stringify(p[k]), f)); });
  if (p.itinerary) { out.itinerary = {}; Object.entries(p.itinerary).forEach(([day, slots]) => { out.itinerary[day] = {}; Object.entries(slots || {}).forEach(([k, a]) => { out.itinerary[day][k] = arr(a); }); }); }
  if (p.planX) { const mt = t => { if (/^\d+$/.test(t)) { const r = f(Number(t)); return r == null ? null : String(r); } if (t[0] === '@') { const r = f(t); return r == null ? null : String(r); } return t; }; // 4.22.0
    const anchors = {};
    Object.entries(p.planX.anchors || {}).forEach(([day, m]) => { anchors[day] = {}; Object.entries(m || {}).forEach(([k, v]) => { const rk = mt(k), rv = mt(v); if (rk != null) anchors[day][rk] = rv == null ? '^' : rv; }); });
    out.planX = { ...p.planX, anchors }; delete out.planX.locks; }
  if (p.proposal) { const days = {}; Object.entries(p.proposal.days || {}).forEach(([k, d]) => { days[k] = { ...d, items: (d.items || []).map(x => ({ ...x, id: f(x.id) })).filter(x => x.id != null) }; }); out.proposal = { ...p.proposal, days }; } // 11.5.0 (schedule-proposal)
  if (p.times) { out.times = {}; Object.entries(p.times).forEach(([k, v]) => { const i = k.indexOf('|'); const raw = k.slice(i + 1); const r = f(/^\d+$/.test(raw) ? Number(raw) : raw); if (r != null) out.times[k.slice(0, i) + '|' + r] = v; }); }
  return out;
}
// personal data of a trip file (refs:'dest' - relative to its destinations) -> ids of this device
function personalFromFile(data) {
  const p = data.personal; if (!p) return null;
  const o = mapPersonalRefs(planItemsUp(p), deviceRef); delete o.refs; return o;
}
// add incoming personal data to a trip's data: adds what is missing, never removes anything
function mergePersonal(td, inc) {
  td.favorites = [...new Set([...(td.favorites || []), ...(inc.favorites || [])])];
  td.visited = [...new Set([...(td.visited || []), ...(inc.visited || [])])];
  td.itinerary = td.itinerary || {}; Object.entries(inc.itinerary || {}).forEach(([day, slots]) => { const dd = td.itinerary[day] = td.itinerary[day] || { unassigned: [], morning: [], afternoon: [], evening: [] };
    Object.keys(slots || {}).forEach(k => { dd[k] = dd[k] || []; (slots[k] || []).forEach(id => { if (!Object.values(dd).some(a => a.includes(id))) dd[k].push(id); }); }); });
  td.times = { ...(inc.times || {}), ...(td.times || {}) }; td.planItems = { ...(inc.planItems || {}), ...(td.planItems || {}) };
  if (inc.planX) { const a = td.planX = td.planX || {}, b = inc.planX; // 4.22.0: what is here wins
    a.sched = { ...(b.sched || {}), ...(a.sched || {}) };
    a.anchors = a.anchors || {}; Object.entries(b.anchors || {}).forEach(([day, m]) => { a.anchors[day] = { ...(m || {}), ...(a.anchors[day] || {}) }; });
    if (b.routeHide) { const ra = a.routeHide || {}, rb = b.routeHide; a.routeHide = { stops: { ...(rb.stops || {}), ...(ra.stops || {}) }, legs: { ...(rb.legs || {}), ...(ra.legs || {}) } }; } } // 4.24.0
  return td;
}
async function shareJson(obj, name) {
  return deliverFile(new Blob([JSON.stringify(obj, null, 1)], { type: 'application/json' }), name);
}
// 3.2.0: the phone's share sheet when there is one; inside Claude the viewer's download capability; else a plain download
// phone-round-1-fixes P6 (G7): Chrome shares only the file types of its Web Share list (Chromium ShareServiceImpl.java on Android,
// share_service_impl.cc on Windows/macOS/ChromeOS: the name's extension AND the exact MIME type must be on it - .txt + text/plain
// are, .json / application/json and .zip are not). canShare() does not check the list: share() refuses with NotAllowedError, after
// the tap's activation is spent, so there is no second try - the type is chosen before. A JSON file goes to the share sheet as
// text/plain named <name>.json.txt (every door reads a file by its content, never its name); a download keeps <name>.json.
function shareFileAs(name, type) { return type === 'application/json' ? { name: name.replace(/(\.json)?$/i, '.json.txt'), type: 'text/plain' } : { name, type }; }
async function deliverFile(blob, name, type) {
  type = type || 'application/json';
  try { const s = shareFileAs(name, type), f = new File([blob], s.name, { type: s.type }); if (navigator.canShare && navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], title: name }); return true; } } catch (e) { if (e && e.name === 'AbortError') return false; }
  if (window.claude && typeof window.claude.use === 'function') {
    let dl = null; try { dl = await window.claude.use('downloads'); } catch (e) {}
    if (dl) { try { await dl.save({ filename: name, data: blob }); return true; } catch (e) { if (!e || e.code !== 'declined') showToast('לא הצלחתי לשמור את הקובץ כאן'); return false; } }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); return true;
}
// one-way (10): a text goes out the same way - the share sheet, or where there is none (or it fails) the clipboard with msg
// (copyWithFallback). Resolves true (shared), false (copied) or null (the user closed the sheet: nothing went out).
function deliverText(text, msg) { return (navigator.share ? navigator.share({ text }).then(() => true).catch(e => e && e.name === 'AbortError' ? null : false) : Promise.resolve(false)).then(ok => { if (ok === false) copyWithFallback(text, msg); return ok; }); }
const fileStamp = () => tmFmt('date', Date.now()).replace(/\./g, '-');
// 'p:<id>' - a point of the trip picture keyed by a place (its settings and its small image)
function mapPicTokens(json, f) { return json.replace(/([":])p:(@[^":]+:\d+|\d+)(?=")/g, (m, a, n) => { const r = f(/^\d+$/.test(n) ? Number(n) : n); return r == null ? m : a + 'p:' + r; }); }
// partsWin is the one frame of every window that sends, receives or restores a file (ק8: chips › what › one send): head,
// a short intro, the fields (form building blocks), the Claude part when the window goes to Claude (ק17), and one row with
// the send button (no "unsaved changes" question - choosing what goes out changes no data).
function partsWin(F, o) {
  const sheet = document.getElementById('sheet');
  const copy = { act: 'kit.copyGoal', v: o.goal, label: msi('content_copy', { size: 18 }) + ' העתקת ההוראות' }; // card-actions (Q2): the send at full width, the rest as text under it
  sheet.innerHTML = `${fmHead(o.title)}${o.intro ? `<div class="sh-hint pw-intro">${o.intro}</div>` : ''}<div class="pw-body">${(o.body || []).join('')}</div>${o.goal ? claudePartHTML(o.goal, o.kind, o.offN) : ''}${o.end || ''}
    <div class="sh-error fm-errline" hidden></div><div class="sheet-save-bar pw-bar">${cardActionsHTML({ ...(o.send || copy), id: 'pwSend' }, [o.send && o.goal ? copy : null, ...(o.more || [])])}</div>`;
  showSheetBackdrop(o.key); if (o.ref) winRef(o.ref); fmAttach(F); if (o.ctl) layerTop().ctl = o.ctl;
  return F;
}
// the parts a file holds, as rows for fmChecks (ק4: the same names everywhere)
function partItems(ids, counts, always) { return ids.map(k => ({ k, label: partLabel(k), sub: PART_INFO[k].sub || '', count: counts ? counts(k) : '', always: (always || []).includes(k) })); }

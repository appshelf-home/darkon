// ================= 11.22.0 (place-gid-1): A GOOGLE PLACE ID FOR EVERY PLACE - the record, its conversions, where it is written =================
// decisions 2026-11-16 · A Google place id for every place (Q1, Q2, Q6-Q9); spec/google-id-looked-up.md "The Google id".
// Every place (a destination's, a trip's, a memory's snapshot) may hold one record, the field `gid` (claude/reference/file-format.md):
//   { id: 'ChIJ…' (Google's place id, when known), cid: '5687679683593497910' (Google's customer number as a decimal string - the form
//     compared), src: 'app' | 'user' | 'timeline' | 'file', at: 'YYYY-MM-DD' (when it was set),
//     miss: 'YYYY-MM-DD' (place-gid-2: a lookup that found nothing, and when), off: true (unlinked by the user - never looked up again),
//     both: true (the user kept two places that share the id - Q9 (2), the line does not return) }
// A linked record has an id or a cid; an unlinked one has off and neither; miss only without them. Both conversions are offline
// (notes/google-place-id-wikidata-check.md): a `ChIJ…` id is base64url of a protobuf - bytes 0a 12 09, 8 bytes little-endian, 11, 8 bytes
// little-endian - whose second number is the cid; a link's full `ftid` 0x<a>:0x<b> rebuilds the same bytes (cid = b). An id of another
// form (`Ei…`) is kept without a cid and never compared.
const GID_SRC = ['app', 'user', 'timeline', 'file'], GID_CHIJ = /^ChIJ[A-Za-z0-9_-]{23}$/, GID_ID = /^[A-Za-z0-9_-]{16,300}$/, GID_CID = /^[1-9]\d{0,19}$/, GID_DATE = /^\d{4}-\d\d-\d\d$/;
const GID_U64 = (1n << 64n) - 1n;
function gidB64(bytes) { let s = ''; bytes.forEach(b => { s += String.fromCharCode(b); }); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function gidBytes(id) { try { const s = atob(id.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((id.length + 3) % 4)); return [...s].map(c => c.charCodeAt(0)); } catch (e) { return null; } }
function gidLE(b, at) { let n = 0n; for (let i = 7; i >= 0; i--) n = (n << 8n) | BigInt(b[at + i]); return n; }
function gidLEBytes(n) { const out = []; for (let i = 0; i < 8; i++) { out.push(Number(n & 255n)); n >>= 8n; } return out; }
// 'ChIJ…' -> its cid ('…'), or '' when the id is not of that form
function gidCidOf(id) { if (!GID_CHIJ.test(String(id || ''))) return ''; const b = gidBytes(id);
  if (!b || b.length !== 20 || b[0] !== 0x0a || b[1] !== 0x12 || b[2] !== 0x09 || b[11] !== 0x11) return ''; const c = gidLE(b, 12); return c > 0n ? c.toString() : ''; }
// a full ftid '0x<a>:0x<b>' -> { id: 'ChIJ…', cid } (null when malformed)
function gidFromFtid(f) { const m = String(f || '').match(/^0x([0-9a-f]{1,16}):0x([0-9a-f]{1,16})$/i); if (!m) return null;
  const a = BigInt('0x' + m[1]), c = BigInt('0x' + m[2]); if (c <= 0n) return null;
  return { id: gidB64([0x0a, 0x12, 0x09, ...gidLEBytes(a), 0x11, ...gidLEBytes(c)]), cid: c.toString() }; }
// a Google Maps link (or a Timeline id) -> { id?, cid? } or null: query_place_id / place_id, a full ftid (`ftid=` or `!1s0x…:0x…`), cid=
// gid-fixes item 2 (decisions 2026-11-18 · Review of the 11.22.0 summary, Q2): only a link to one place - a directions link
// (`/maps/dir/`, or data holding more than one `!1s0x…:0x…`) gives no id (its first id is the route's origin)
function gidDirLink(d) { return /\/maps\/dir(?:\/|\?|$)/i.test(d) || (String(d || '').match(/!1s0x[0-9a-f]+:0x[0-9a-f]+/gi) || []).length > 1; } // d decoded
function gidFromUrl(u) { const d = (() => { try { return decodeURIComponent(u || ''); } catch (e) { return String(u || ''); } })();
  if (gidDirLink(d)) return null;
  let m = d.match(/[?&]query_place_id=([\w-]{16,300})/) || d.match(/place_id[:=]([\w-]{16,300})/); if (m) return gidOfId(m[1]);
  m = d.match(/!1s(0x[0-9a-f]+:0x[0-9a-f]+)/i) || d.match(/[?&]ftid=(0x[0-9a-f]+:0x[0-9a-f]+)/i); if (m) return gidFromFtid(m[1]);
  m = d.match(/[?&]cid=(\d{1,20})(?:[&#]|$)/); if (m && gidCidOk(m[1])) return { cid: m[1] }; return null; }
function gidOfId(id) { id = String(id || ''); if (!GID_ID.test(id)) return null; const c = gidCidOf(id); if (GID_CHIJ.test(id) && !c) return null; return c ? { id, cid: c } : { id }; }
function gidCidOk(c) { if (!GID_CID.test(String(c || ''))) return false; try { return BigInt(c) <= GID_U64; } catch (e) { return false; } }
// the one test of a record's form (the door, the kit's validate.py the same): a well-formed record rebuilt from its known keys, or null
function gidClean(g) { if (!g || typeof g !== 'object' || Array.isArray(g)) return null;
  if (!GID_SRC.includes(g.src) || !GID_DATE.test(String(g.at || ''))) return null;
  const o = { src: g.src, at: g.at }, hasId = g.id != null && g.id !== '', hasCid = g.cid != null && g.cid !== '';
  if (hasCid && typeof g.cid !== 'string') return null; // a decimal string (a number loses digits)
  if (hasId) { const r = typeof g.id === 'string' ? gidOfId(g.id) : null; if (!r) return null; if (hasCid && r.cid && String(g.cid) !== r.cid) return null; o.id = r.id; if (r.cid) o.cid = r.cid; }
  if (hasCid && !o.cid) { if (!gidCidOk(String(g.cid))) return null; o.cid = String(g.cid); }
  const linked = !!(o.id || o.cid);
  if (g.off != null) { if (g.off !== true || linked) return null; o.off = true; }
  if (g.miss != null) { if (!GID_DATE.test(String(g.miss)) || linked) return null; o.miss = g.miss; }
  if (g.both != null) { if (g.both !== true || !linked) return null; o.both = true; }
  return linked || o.off || o.miss ? o : null; }
function gidNew(r, src) { return r && (r.id || r.cid) ? { ...(r.id ? { id: r.id } : {}), ...(r.cid ? { cid: r.cid } : {}), src, at: todayStr() } : null; }
function gidOf(p) { const g = p && p.gid; return g && (g.id || g.cid) ? g : null; } // a linked record
function gidSame(a, b) { return !!(a && b && a.cid && b.cid && a.cid === b.cid); } // only the cid is compared
// "פתיחה בגוגל מפות" (Q8 (1)): the exact place by its id (Google's Maps URLs), a cid alone by the cid link; null without an id
function gidMapsUrl(p) { const g = gidOf(p); if (!g) return null;
  if (g.id) return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent((p && p.name) || 'place') + '&query_place_id=' + g.id;
  return 'https://www.google.com/maps?cid=' + g.cid; }
// the one-time move (FILE_RULES 11.22.0) and the door for older files: an id inside a place's link moves into the field, source "user"
function gidFromMapsUrl(o) { if (!o || typeof o !== 'object' || o.gid || typeof o.mapsUrl !== 'string' || !o.mapsUrl) return false;
  const r = gidFromUrl(o.mapsUrl); if (!r) return false; o.gid = { ...r, src: 'user', at: todayStr() }; return true; }
// ---- writing a place's record, in the active trip's context (withTrip for another trip) ----
// a trip's own place: in the trip; a place I added to a destination: in my edit; a destination's place: an edit beside its file (the file's
// own record is not touched - an update of the destination keeps mine). A closed trip's snapshot is written too (its memory shows it).
function gidPut(id, rec) { const p = POINTS.find(q => q.id === id); if (!p || !rec) return false; const who = STATE.settings.deviceName || '', at = Date.now();
  if (p.tripOnly) { const t = activeTripObj(); t.places = (t.places || []).map(x => x.id === id ? { ...x, gid: rec } : x); }
  else { const e = STATE.edits.places[id];
    if (e && e.op === 'add') STATE.edits.places[id] = { ...e, data: { ...e.data, gid: rec }, at, who };
    else { const b = BASE_PLACES.find(x => x.id === id), d = { ...(e && e.op === 'edit' ? e.data : {}) };
      if (b && JSON.stringify(b.gid || null) === JSON.stringify(rec)) delete d.gid; else d.gid = rec;
      if (Object.keys(d).length) STATE.edits.places[id] = { op: 'edit', data: d, at, who }; else delete STATE.edits.places[id]; } }
  const t = activeTripObj(), sp = t && t.archived && t.archived.snap && (t.archived.snap.places || []).find(x => x.id === id); if (sp) sp.gid = rec;
  return true; }
// Q9 (1): the place of the active trip (and its destinations) that carries this id
function gidPlaceOf(r, selfId) { if (!r || !r.cid) return null; return POINTS.find(q => q.id !== selfId && !q.planOnly && gidSame(gidOf(q), r)) || null; }
// Q9 (2): the place this one repeats - shown on the newer of two places that share an id (a place I added, beside a destination's
// place or one that got the id before it), unless the user kept both
function gidTwin(p) { const g = gidOf(p); if (!g || g.both || !(p.userAdded || p.tripOnly)) return null;
  return POINTS.find(q => { if (q.id === p.id || q.planOnly) return false; const h = gidOf(q); if (!gidSame(h, g)) return false; // the newer: by when each got the id, then by its number
    return !(q.userAdded || q.tripOnly) || h.at < g.at || (h.at === g.at && q.id < p.id); }) || null; }
function gidLinkedHTML(p) { if (!gidOf(p)) return ''; const q = activeTripObj().archived || ARCHIVE_VIEW ? null : gidTwin(p); // read-only: no choice
  return `<small class="sh-hint">${msi('link', { cls: 'msi-in' })} נפתח בדיוק בגוגל מפות</small>${q ? `<div class="iw-row">${msi('content_copy', { size: 20 })}<span>נראה שזה אותו מקום כמו <b>${escH(q.name)}</b></span></div><div class="brow tight"><button type="button" class="chip" data-act="gid.delNew" data-v="${p.id}">למחוק את החדש</button><button type="button" class="chip" data-act="gid.both" data-v="${p.id}">להשאיר את שניהם</button></div>` : ''}`; }
act('gid.delNew', c => { const id = pid(c.v); if (!POINTS.some(q => q.id === id)) return 'quiet'; layerCloseOwn(); deleteAddedPlace(id); });
act('gid.both', c => { const id = pid(c.v), p = POINTS.find(q => q.id === id), g = gidOf(p); if (!g) return 'quiet';
  gidPut(id, { ...g, both: true }); rebuildPoints(); persist(); showUndoToast('נשארו שניהם: ' + p.name); });
// Q9 (1): a share or a paste with no open search whose id is already a place of the active trip: that place's window, not "מקום חדש"
// place-find (G67; notes/phone-round-3/results.md): a share of the stadium the trip already holds opened "מקום חדש" - the two sides carried
// different ids for one place (the share's from Google's link, the stored one from the background lookup, or the share's expansion
// failing). So a place of the active trip at the same point (within GID_SAME_M) whose name fits is known too (lk: the link's read -
// its point, from the link or found by its name, and its name); a different id there is noted in the recent errors, so a report shows
// both sides.
const GID_SAME_M = 30;
function gidPlaceNear(lk) { if (!lk || !lk.coord || !hasTrip()) return null; const ns = [lk.name, lk.found && lk.found.name].filter(Boolean);
  return POINTS.find(q => { if (q.planOnly || !q.name) return false; const c = routeCoordOf(q); return c && distanceKm(c, lk.coord) * 1000 <= GID_SAME_M && !!placeNameMatch(ns, q, 'loose'); }) || null; } // dup-both-names: both names of mine
function gidOpenKnown(r, lk) { let q = hasTrip() && r ? gidPlaceOf(r) : null;
  if (!q && (q = gidPlaceNear(lk))) { const g = gidOf(q); if (r && (r.cid || r.id)) errNote('gid.same', `same place, other id: shared ${r.cid || r.id}${SEP}kept ${g ? (g.cid || g.id) + ' (' + g.src + ')' : 'none'}`); }
  if (!q) return false; const it = planItem(q.id); if (!it) return false;
  goTab('all'); setTimeout(() => { openPlaceSheet(it); showToast('המקום כבר ברשימה'); }, 80); return true; }

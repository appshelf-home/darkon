// ================= FILES: the door's rules and what every screen uses (split from files.js in diet-groups, 11.62.0; the route in, the receive and review windows stay there, in the management group) =================
// 10.5.0 (design-4 part 2, look.md "Menus, choices and plan repairs" / "Claude's round"): the "two cards" pattern - one field, two
// versions side by side (a caption and the value), the chosen one outlined in the accent; a card with an act is a tap to choose it
function twoCardsHTML(label, cards) { return `<div class="tc-field">${label ? `<b class="tc-l">${label}</b>` : ''}<div class="two-cards">${cards.map(c => `<${c.act ? 'button type="button"' : 'div'} class="tc-card${c.on ? ' on' : ''}"${c.act ? ` data-act="${c.act}"${c.data || ''} aria-pressed="${!!c.on}"` : ''}><small>${c.cap}</small><span>${c.val}</span></${c.act ? 'button' : 'div'}>`).join('')}</div></div>`; }
// ---- what a file may put into a style or an attribute (final-review-followups, miss b): only the forms the app itself writes; anything
// else falls back to the default, with no message (claude/scripts/validate.py names the form). One walk at the door, every kind of file:
// a layer's color (#RRGGBB), a theme's colors (#RRGGBB) and heading font (the list, else the app's own), a link (mapsUrl, a source's
// url, the album: http(s); a hotel's website: also without its https://), a photo (a base64 image data URL, as the app's canvas
// writes it). Guard: t1048.
// 11.8.0 (travels-7-followups, small-fixes items 2-3; decisions 2026-11-11 "Review of the 10.17.2 summary" Q2-Q3): one rule for every
// value - a bad value is dropped; a default fills only a value that must exist. A layer's color must exist: a layer of a layer list, or
// a layer an edit adds ({ op: 'add', data }); a bad one becomes its type's color, else the layer editor's own pick (layerColorPick: the
// first palette color no other layer of that list uses). Anywhere else (an edit's color, { op: 'edit', data }) a bad color is dropped
// and the layer keeps its own.
const FILE_COLOR = /^#[0-9a-fA-F]{6}$/, FILE_LINK = /^https?:\/\/[^\s"'<>`\\]+$/i;
const FILE_PHOTO_KEY = /^(?:photo|pimg|hotel|trash):/;
// 11.8.1 (timeline-import step 0b, the 11.8.0 review's miss a; standard tech-shared-mechanisms): a destination's general-info sections
// are HTML Claude writes (reference/file-format.md). They are parsed in an inert template and walked against an allowlist - the
// elements and attributes the sections use; an unknown element leaves its text, one that runs, embeds or loads goes whole; a link only
// to http(s), tel or mailto; an id only one of the app's hooks the sections carry (the accordion, the weather, the sun, the converter;
// a span's data-pack, the days' count); a style only plain declarations (a design token allowed); a comment only the TRIP_BLOCKS marker. At the door (fileClean), on stored data once (FILE_RULES), and where the
// sections are drawn (infoHtml). Guard: t1058 (hostile markup through every door).
const INFO_EL = new Set(['div', 'p', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'strong', 'b', 'em', 'i', 'u', 'br', 'hr', 'a', 'span', 'small', 'button', 'input', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'bdi', 'sup', 'sub', 'blockquote']);
const INFO_DROP = new Set(['script', 'style', 'iframe', 'object', 'embed', 'template', 'svg', 'math', 'img', 'picture', 'video', 'audio', 'source', 'track', 'form', 'link', 'meta', 'base', 'frame', 'frameset', 'noscript', 'select', 'textarea', 'canvas', 'portal']);
const INFO_AT = { '*': ['class', 'dir', 'title', 'lang', 'data-icon'], div: ['data-months', 'data-words'] /* 11.30.0 (wx-one-place): a season paragraph's months; survival-words: the dictionary's language */, p: ['data-word'] /* survival-words: a dictionary row's place */, span: ['data-pack'], a: ['href', 'target', 'rel'], input: ['type', 'placeholder', 'inputmode', 'min', 'max', 'step'], button: ['type'], td: ['colspan', 'rowspan'], th: ['colspan', 'rowspan'] };
const INFO_IDS = new Set(['infoAccordion', 'weatherWidget', 'sunWidget', 'hufInput', 'convertBtn', 'convertResult']), INFO_LINK = /^(?:https?:\/\/|tel:|mailto:)[^\s"'<>`\\]+$/i, INFO_STYLE = /^(?:\s*[a-z-]+\s*:\s*(?:[^;:()"'<>\\/]|var\(--[\w-]+\))*;?)*\s*$/i;
function cleanInfo(html, o) { // o.out: always the walked tree's own markup (what is drawn); else the text as it came when nothing was taken out
  const f = htmlFrag(html), w = document.createTreeWalker(f, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT), all = []; let n, cut = 0; // cut: anything taken out
  while ((n = w.nextNode())) all.push(n);
  all.reverse().forEach(el => {
    if (el.nodeType === 8) { if (el.nodeValue !== 'TRIP_BLOCKS') { el.remove(); cut++; } return; }
    const tag = el.localName;
    if (INFO_DROP.has(tag) || el.namespaceURI !== 'http://www.w3.org/1999/xhtml') { el.remove(); cut++; return; }
    if (!INFO_EL.has(tag)) { el.replaceWith(...el.childNodes); cut++; return; }
    [...el.attributes].forEach(a => { const k = a.name, v = a.value;
      const keep = (INFO_AT['*'].includes(k) || (INFO_AT[tag] || []).includes(k) || (k === 'id' && INFO_IDS.has(v)) || (k === 'style' && INFO_STYLE.test(v))) && (k !== 'href' || INFO_LINK.test(v.trim())) && (k !== 'type' || /^(number|text|button)$/i.test(v));
      if (!keep) { el.removeAttribute(k); cut++; }
      else if (k === 'data-icon' && o && o.icons && !CLOSED_LISTS.infoIcons.has(v)) { el.removeAttribute(k); cut++; FILE_DROPPED++; } }); // 11.12.0 (item 5): a section's icon from the closed list
    if (tag === 'a' && el.hasAttribute('href') && (el.getAttribute('target') !== '_blank' || el.getAttribute('rel') !== 'noopener')) { el.setAttribute('target', '_blank'); el.setAttribute('rel', 'noopener'); cut++; } });
  if (!cut && !(o && o.out)) return String(html); // nothing taken out: the text as it came (a parse and serialization would rewrite & in links - Budapest must come back the same)
  const d = document.createElement('div'); d.appendChild(f); return d.innerHTML;
}
const _infoHtml = new Map();
function infoHtml(raw) { raw = String(raw || ''); if (!_infoHtml.has(raw)) { if (_infoHtml.size > 40) _infoHtml.clear(); const f = htmlFrag(cleanInfo(raw, { out: true })); f.querySelectorAll('.accordion-item').forEach(e => e.setAttribute('data-info-sec', '1')); { const ws = wxSecOf(f); if (ws) ws.remove(); } /* 11.30.0 (wx-one-place): the weather section's words show in "מזג אוויר ולבוש" */ wordsDraw(f); /* survival-words: the language section's dictionary drawn the app's way */ const d = document.createElement('div'); d.appendChild(f); _infoHtml.set(raw, d.innerHTML); } return _infoHtml.get(raw); }
// 11.8.1: an id or a reference of a file is the form the app and the instructions write (Latin letters, digits, - _ . : @, as in
// "@dest:12") - it goes into attributes and keys as it is. 11.21.4 (backup-ids; decisions 2026-11-17 · A backup that does not
// restore, Q1): a file with another id is no longer refused - the door converts it (fileIdsFix), and fileIdsOk is the test of the result.
// An object key is of the form when it is the same characters plus "|" (the app's composite keys, "d1|1000056").
const FILE_ID = /^[A-Za-z0-9_.:@-]{1,120}$/, FILE_ID_KEYS = new Set(['id', 'dest', 'tripId', 'destId', 'lodgingId', 'travelId', 'placeId', 'ref', 'region']);
const FILE_KEY = /^[A-Za-z0-9_.:@|-]{1,240}$/; // the conversion itself: js/file-ids.js
function fileIdsOk(o, depth) { depth = depth || 0; if (depth > 40 || !o || typeof o !== 'object') return true;
  if (Array.isArray(o)) return o.every(x => fileIdsOk(x, depth + 1));
  return Object.keys(o).every(k => { const v = o[k]; if (k !== '' && !FILE_KEY.test(k)) return false;
    if (typeof v === 'string') return !FILE_ID_KEYS.has(k) || v === '' || FILE_ID.test(v);
    return fileIdsOk(v, depth + 1); }); }
// A6 (decisions 2026-11-13 review of 11.10.0; standard tech-saving-data.md "Closed sets at entry"): a field whose value comes from a
// closed set - a destination's country, time zone and currency, a layer's type, the heading font, a travel's mode, a program line's
// kind, the trip's main way between places; since 11.12.0 (review of 11.11.0, item 5) also a place's and a layer's icon, a place's
// status and an info section's data-icon - keeps only a value of its set. One outside it is dropped (the field is left empty, as a
// file without it) and counted in FILE_DROPPED; the file opens as usual, and it says "ערכים לא מוכרים לא נקלטו" where it already
// reports itself (fileDroppedHTML in a summary window, fileDroppedNote in its own message - item 7). Display escaping stays as the
// second line of defence. The lists of countries, currencies, zones and icons are CLOSED_LISTS, built from the kit's one file
// (claude/scripts/closed_lists.json, item 6) - validate.py reads the same file and reports the same values as errors.
// 11.16.0 (phone-round-1-followups; decisions 2026-11-15 · Review of the 11.14.0 summary, Q8): a destination's country given as an obsolete
// code (CLOSED_LISTS.obsoleteCountries, the kit's one table) becomes its successor (UK → GB) with no word; one with no single successor
// (SU, YU, DD …) is left empty and counted, as a value outside its set. The same once over stored destinations (FILE_RULES 11.16.0).
let FILE_DROPPED = 0;
const FILE_SETS = {
  'meta.country': v => CLOSED_LISTS.countries.has(v),
  'meta.timeZone': v => CLOSED_LISTS.timeZones.has(v),
  'currency.code': v => CLOSED_LISTS.currencies.has(v),
  'layer.type': v => v in BASE_TYPES,
  'layer.icon': v => CLOSED_LISTS.placeIcons.has(v),
  'place.icon': v => CLOSED_LISTS.placeIcons.has(v),
  'place.status': v => PLACE_STATUS.includes(v),
  'theme.headingFont': v => HEADING_FONTS.includes(v),
  'travel.mode': v => v in TRAVEL_MS,
  'sched.kind': v => v in SCHED_KIND_NAME,
  'sched.mode': v => v in TRAVEL_MS, // kit-fixes (A2.5): a program line's travel mode, as a travel's
  'trip.legMain': v => v in LEG_MODES };
const addJoinedText = n => n ? `${SEP}${n === 1 ? 'מקום אחד שהוספתם הושלם' : n + ' מקומות שהוספתם הושלמו'}` : ''; // add-key: the receive message's part
const PLACE_STATUS = ['closed', 'gone', 'skip']; // a place's status in a file (isGoneStatus); 'active' lives only in my edits
const FILE_ITEM = { layers: 'layer', travels: 'travel', schedule: 'sched', places: 'place', lodging: 'hotel', userAdds: 'place' }; // kit-fixes (A2.8): a round's returned additions pass the place's checks (icon, links, booking and price) // 11.42.0: a hotel (its price - bpFileClean) // an array's items take the singular key
// along-drive (kit 3.9.0): a drive's stops at the door - each { name, loc } with a trip place's id or a point in range, on a car; another
// is dropped and counted with the closed values ("ערכים לא מוכרים לא נקלטו")
function tvStopsClean(data) { const t = data && data.trip; if (!t || typeof t !== 'object' || !Array.isArray(t.travels)) return;
  const own = new Set((t.places || []).filter(p => p && typeof p === 'object').map(p => p.id)), num = (x, m) => typeof x === 'number' && isFinite(x) && Math.abs(x) <= m;
  const ok = s => !!s && typeof s === 'object' && (s.name == null || typeof s.name === 'string') && !!s.loc && typeof s.loc === 'object' && (s.loc.pid != null ? own.has(s.loc.pid) : num(s.loc.lat, 90) && num(s.loc.lng, 180));
  t.travels.forEach(f => { if (!f || typeof f !== 'object' || f.stops == null) return; const all = Array.isArray(f.stops) ? f.stops : [f.stops];
    const keep = f.mode === 'car' ? all.filter(ok).map(s => ({ name: String(s.name || '').trim(), loc: s.loc.pid != null ? { pid: s.loc.pid } : { lat: s.loc.lat, lng: s.loc.lng } })) : [];
    FILE_DROPPED += all.length - keep.length; if (keep.length) f.stops = keep; else delete f.stops; }); }
function fileDroppedHTML(n) { return n ? `<p class="sh-hint">${msi('block', { size: 16, cls: 'msi-in' })} ערכים לא מוכרים לא נקלטו: <bdi>${n}</bdi></p>` : ''; }
function fileDroppedNote(msg, n) { return n ? `${msg}${SEP}${n === 1 ? 'ערך לא מוכר אחד לא נקלט' : n + ' ערכים לא מוכרים לא נקלטו'}` : msg; } // item 7: one report per receipt
// item 5 (review of 11.11.0): a reference must point at something in the file - a place's layer and area at its destination's, a
// hotel's and a program line's place at a trip place or a place of the trip's destinations, a line's hotel at a hotel. One that points
// at nothing is dropped and counted as a closed value is. A trip place is checked against its destination only when that destination is
// in the same file. 11.13.0 (timeline-followups-4, Q3 and Q4 of the 11.12.0 review; the rule is written once in the kit,
// reference/file-format.md "Place references"): a destination's places are the file's copy when the file has it, else the copy already
// stored on this device (by the file's number, this device's number, a place I added to it) - so a trip-only file is checked too; a
// "@dest:id" reference is looked up in that destination. Only when one of the trip's destinations is in neither are its places unknown,
// and a place reference is then left as it is.
function filePlaceIds(id, dests) { const f = dests.get(id), s = new Set();
  if (f) { f.places.forEach(p => { if (p && typeof p === 'object') s.add(p.id); }); return s; }
  const d = typeof DESTS !== 'undefined' ? DESTS[id] : null; if (!d || !Array.isArray(d.places)) return null;
  d.places.forEach(q => { if (q) { s.add(q.id); s.add((d.idBase || 0) + q.id); } });
  const E = typeof STATE !== 'undefined' && STATE && STATE.edits ? STATE.edits.places || {} : {};
  Object.keys(E).forEach(k => { const e = E[k]; if (e && e.op === 'add' && e.data && e.data.dest === id) s.add(Number(k)); });
  return s; }
function fileRefsClean(data) {
  const dests = new Map(), trips = [], seen = new Set();
  const walk = (o, depth) => { if (!o || typeof o !== 'object' || depth > 8 || seen.has(o)) return; seen.add(o);
    if (Array.isArray(o)) { o.forEach(x => walk(x, depth + 1)); return; }
    if (o.meta && typeof o.meta === 'object' && Array.isArray(o.places) && typeof o.id === 'string') dests.set(o.id, o);
    else if (Array.isArray(o.segments) && (Array.isArray(o.places) || Array.isArray(o.lodging) || Array.isArray(o.schedule))) trips.push(o);
    Object.keys(o).forEach(k => walk(o[k], depth + 1)); };
  walk(data, 0);
  const drop = (o, k) => { delete o[k]; FILE_DROPPED++; };
  const ids = (a, f) => new Set((Array.isArray(a) ? a : []).filter(x => x && typeof x === 'object').map(x => x[f || 'id']));
  const placeRefs = (p, d) => { if (!p || typeof p !== 'object' || !d) return; const m = d.meta;
    if (p.layer != null && p.layer !== '' && !ids(m.layers).has(p.layer)) drop(p, 'layer');
    if (p.region != null && p.region !== '' && !ids(m.regions).has(p.region)) drop(p, 'region'); };
  dests.forEach(d => d.places.forEach(p => placeRefs(p, d)));
  trips.forEach(t => { const tp = ids(t.places), lg = ids(t.lodging);
    // a hotel or a line may point at a place of one of the trip's destinations (it moves to the trip on approval, t910 (3))
    const segD = [...new Set((Array.isArray(t.segments) ? t.segments : []).map(g => g && g.dest).filter(Boolean))];
    const sets = segD.map(id => filePlaceIds(id, dests)), known = sets.every(Boolean);
    sets.forEach(s => s && s.forEach(x => tp.add(x)));
    const badPlace = id => { if (id == null || id === '' || tp.has(id)) return false;
      const m = typeof id === 'string' && /^@(.+):(\d+)$/.exec(id); if (m) { const s = filePlaceIds(m[1], dests); return !!s && !s.has(Number(m[2])); }
      return known; };
    (Array.isArray(t.places) ? t.places : []).forEach(p => placeRefs(p, p && dests.get(p.dest)));
    (Array.isArray(t.lodging) ? t.lodging : []).forEach(l => { if (l && typeof l === 'object' && badPlace(l.placeId)) drop(l, 'placeId'); });
    (Array.isArray(t.schedule) ? t.schedule : []).forEach(x => { if (!x || typeof x !== 'object') return;
      if (badPlace(x.placeId)) drop(x, 'placeId');
      if (x.lodgingId != null && x.lodgingId !== '' && !lg.has(x.lodgingId)) drop(x, 'lodgingId'); }); });
  return data; }
function fileClean(o, key, list) {
  if (Array.isArray(o)) { o.forEach(x => fileClean(x, key === 'layers' ? 'layer' : FILE_ITEM[key], key === 'layers' ? o : null)); return o; }
  if (!o || typeof o !== 'object') return o;
  if (key === 'place' || key === 'data' || key === 'p') gidFromMapsUrl(o);
  bpFileClean(o, key); // 11.42.0 (booking-price, Q4): a booking or price as old text becomes the structure (silently); its closed values kept only in their sets // 11.22.0 (place-gid-1): an id inside a place's link moves into its field (older files, stored data once)
  const layerAdd = o.op === 'add' && o.data && typeof o.data === 'object' && key === 'layerEdit'; // an edit that adds a layer: its data is a whole layer
  for (const k of Object.keys(o)) { const v = o[k];
    if (key === 'layer' && k === 'icon' && v === 'international' && o.type === 'food') { o[k] = 'restaurant'; continue; } // 11.19.0 (small-fixes 21): the food layer's leftover globe becomes a knife and fork; a place of type "international" keeps it
    if (k === 'gid' && v === null && key === 'data') continue; // 11.23.0 (place-gid-2): an edit's null - the destination's own record was removed (moved or obsolete)
    if (k === 'addKey') { const ak = addKeyOf(v); if (ak) o[k] = ak; else { delete o[k]; FILE_DROPPED++; } continue; } // add-key (Q1): the key of the add a place completes - digits only (a closed field)
    if (k === 'gid') { const g = gidClean(v); if (g) o[k] = g; else { delete o[k]; FILE_DROPPED++; } continue; } // 11.22.0 (place-gid-1): a well-formed Google id record only (a closed field)
    if (k === 'infoNA') { delete o[k]; continue; } // kit-install (5): the old "not relevant" marks (11.43.0-11.58.0) are no longer read - dropped quietly, in a file and in stored data (FILE_RULES)
    if (k === 'roadDays') { if (!v || typeof v !== 'object' || Array.isArray(v) || Object.keys(v).some(x => (x !== 'first' && x !== 'last') || typeof v[x] !== 'boolean')) { delete o[k]; FILE_DROPPED++; } continue; } // 11.19.0 (trip-travel-days): { first, last } booleans only
    if (key === 'meta' && k === 'country' && typeof v === 'string' && CLOSED_LISTS.obsoleteCountries.has(v)) { // 11.16.0 (Q8): an obsolete code
      const to = CLOSED_LISTS.obsoleteCountries.get(v); if (to) o[k] = to; else { delete o[k]; FILE_DROPPED++; } continue; } // its successor quietly; none - empty and counted
    const set = FILE_SETS[(k === 'legMain' ? 'trip' : key) + '.' + k];
    if (set && v != null && v !== '' && (typeof v !== 'string' || !set(v))) { delete o[k]; FILE_DROPPED++; continue; }
    if (FILE_PHOTO_KEY.test(k) && typeof v === 'string') { const c = photoClean(v); if (c == null) { delete o[k]; FILE_DROPPED++; } else if (c !== v) o[k] = c; continue; } // hidden-data (H2): a stored image - JPEG or PNG only, cleaned of its metadata; anything else dropped and counted
    if (typeof v !== 'string') { if (key === 'layerEdits') fileClean(v, 'layerEdit', Object.values(o).map(e => e && e.data).filter(Boolean)); else if (layerAdd && k === 'data') fileClean(v, 'layer', list); else fileClean(v, k === 'layers' && !Array.isArray(v) && key === 'edits' ? 'layerEdits' : k); continue; }
    if (k === 'color' && !FILE_COLOR.test(v)) { if (key === 'layer') o[k] = (BASE_TYPES[o.type] || {}).color || layerColorPick((list || []).filter(l => l !== o)); else delete o[k]; }
    else if (key === 'theme' && (k === 'primary' || k === 'accent') && !FILE_COLOR.test(v)) delete o[k];
    else if (key === 'theme' && k === 'headingFont' && !HEADING_FONTS.includes(v)) delete o[k];
    else if ((k === 'mapsUrl' || k === 'album' || (key === 'src' && k === 'url')) && v && !FILE_LINK.test(v)) delete o[k];
    else if (k === 'website' && v && !FILE_LINK.test(/^https?:/i.test(v) ? v : 'https://' + v)) delete o[k];
    else if (k === 'info' && (o.meta || o.places)) o[k] = cleanInfo(v, { icons: true }); } // 11.8.1: a destination's info sections; 11.12.0: their data-icon from the closed list
  return o;
}
// 11.8.0 (small-fixes item 4; decisions 2026-11-11 "Review of the 10.17.2 summary" Q4; standard tech-saving-data.md): what was stored
// before a rule of fileClean existed passes the same door once. FILE_RULES is the version that last added a rule - raise it with the
// next one. On the first open of such a version (regStartup, before the undo history's base) every row of mine goes through fileClean
// as it would leave in a backup, and a row that changed is written back through the registry (rowIn); no message. The
// device remembers the version it ran (the upkeep row), so it runs once.
const FILE_RULES = '11.59.0'; // 11.59.0 (kit-install, 5): the old "not relevant" marks (meta.infoNA, the edits' infoNA) go; 11.56.5 (hidden-data, H2): a stored image is a JPEG or PNG cleaned of its metadata (photoClean) - one received before keeps no Exif; 11.46.0 (phone-round-4c-fixes P9): a level's note of price words with a joined "ו" ("זול ונגיש") goes; 11.45.0 (kit-fixes): a price range of two adjacent levels becomes its upper level, and a level's note of price words only goes (item 11); a program line's unknown travel mode is dropped (A2.5); 11.44.1: a price 11.42.0 kept as a note that is only a level and one parenthesised word ("$$ (נגיש)") becomes that level (price-level-note, Q1); 11.42.0: a place's booking and price and a hotel's price - old text to the structure (booking-price, Q4); 11.22.0: a place's Google id moved out of its link into its own field, a bad record dropped (place-gid-1); 11.21.6: the keys the app made of dates, names and coordinates before (route hides, offline-map choices - idsKeysMerge); 11.21.4: ids and keys of the form (backup-ids, idsFixStored); 11.19.0: the food layer's icon (small-fixes 21); 11.8.1: a destination's info sections (cleanInfo); 11.11.0: the closed sets (FILE_SETS); 11.12.0: the four added fields and the references; 11.13.0: place references against the stored destinations; 11.16.0: obsolete country codes (their successor, or empty)
function fileCleanStored() { const u = regRead('upkeep'); if (u.fileRules && !versionLess(u.fileRules, FILE_RULES)) return 0; let n = 0;
  if (versionLess(u.fileRules || '0', '11.21.6')) { try { if (idsFixStored()) logEvent('סודרו מזהים פנימיים, כדי שכל גיבוי ייפתח', true, { b: 1 }); } catch (e) {} } // a change the app made on its own: a barrier in the undo history
  REG.filter(r => r.ring === 'mine').forEach(r => { const d = rowOut(r.id, SCOPE_ALL), was = JSON.stringify(d); if (was === undefined) return; const c = fileRefsClean(fileClean(JSON.parse(was))); if (JSON.stringify(c) === was) return; n++;
    if (r.where.td) stashActive(); rowIn(r.id, c); }); // the mementos too (only when a stored image was dropped - rare): the registry's one way in
  if (n) { ensureEditsShape(); loadPersonal(STATE.activeTrip); applyActiveTrip(); persist(); }
  regWrite('upkeep', { ...regRead('upkeep'), fileRules: FILE_RULES }); return n; }
// 11.19.0 (trip-travel-days, Q3): the "ימים שכולם בדרך" switches are stored with the trip (t.roadDays). Once per device (the upkeep row),
// every stored trip with fixed dates and no stored choice gets the switches the editor derived for it until 11.18.0 - roadFit on its
// flights - so it opens as it did; from then on only the user changes them. A backup made before 11.19.0 passes the same rule when it
// is read (fileUp), so restoring it opens its trips as they were; a trip or destination file does not (a trip from a file arrives with
// both off - the decision's check against ס9).
const ROAD_RULE = '11.19.0';
function roadDaysDerive(t) { if (!t || typeof t !== 'object' || !t.start || t.dateMode === 'est' || t.roadDays) return 0;
  const f = roadFit(t, t.start, t.end, true); if (!f.lead && !f.tail) return 0;
  t.roadDays = { ...(f.lead ? { first: true } : {}), ...(f.tail ? { last: true } : {}) }; return 1; }
function roadDaysStored() { const u = regRead('upkeep'); if (u.roadDays) return 0; let n = 0;
  Object.values(STATE.trips || {}).forEach(t => { n += roadDaysDerive(t); }); if (n) persist();
  regWrite('upkeep', { ...regRead('upkeep'), roadDays: ROAD_RULE, roadDaysLit: n }); return n; } // roadDaysLit: how many trips it lit (for the record)
migRun('roadDays', () => { try { roadDaysStored(); } catch (e) {} }); // 11.19.0 (trip-travel-days): the switches the editor used to derive, stored once
migRun('fileRules', () => { try { fileCleanStored(); } catch (e) {} }); // 11.8.0 (small-fixes item 4): stored data passes a new rule of the door check once
// 9.3.0 (ס12-2): in a button the emoji and the word after it are one unit - they never part when the text wraps
const glueEmoji = s => /^\s*</.test(String(s)) ? String(s) : String(s).replace(/^(\S+) /, '$1\u00a0'); // 10.13.0: a label that starts with markup (an icon) is left whole
// 9.5.0 (12ה, ס13): a line that wraps by design breaks only between its parts - a weekday and its date, an emoji and its word stay together; a part's ← starts the next line,
// a " · " stays at the end of the line before it (sepTie; value-no-cut, decisions 2026-11-20 · Review of the `size-fixes-2` summary, Q3)
const glueText = s => sepTie(String(s).replace(/^([^\s\d<]+) (\d)/, '$1\u00a0$2')).replace(/ ([←→]) /g, ' $1\u00a0').replace(/(\p{Extended_Pictographic}\uFE0F?) (?=\S)/gu, '$1\u00a0');
function importDoorHTML(door, label, paste) { label = glueEmoji(label); // paste: the paste link's own label (10.13.0: the trips screen's two links with icons)
  if (inClaude()) return `<span class="brow tight imp-door"><button type="button" class="${door === 'restore' ? 'btn-nav' : 'btn-sec'}" data-act="import.paste" data-v="${door}">${paste || msi('content_paste', { size: 18 }) + 'הדבקת תוכן'}</button></span>`; // 9.3.0: the paste window only (inside a frame); 11.34.0 (G82): as wide as its words, like the file button it replaces
  return `<span class="brow tight imp-door">${fmFile({ label, cls: door === 'restore' ? 'btn-nav' : 'btn-sec', act: 'import.file', v: door, data: 'data-imfile' })}
    <button type="button" class="link-btn imp-paste" data-act="import.paste" data-v="${door}">${paste || 'או הדבקת תוכן'}</button></span>`;
}

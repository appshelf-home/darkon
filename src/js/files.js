// ================= 8.0.0: FILES - one route in, one shape for every window of a file (cl-files-impl-plan, ק1-ק23) =================
// partsWin is the one frame of every window that sends, receives or restores a file (ק8: chips › what › one send): head,
// a short intro, the fields (form building blocks), the Claude part when the window goes to Claude (ק17), and one row with
// the send button (no "unsaved changes" question - choosing what goes out changes no data).
// 10.5.0 (design-4 part 2, look.md "Menus, choices and plan repairs" / "Claude's round"): the "two cards" pattern - one field, two
// versions side by side (a caption and the value), the chosen one outlined in the accent; a card with an act is a tap to choose it
function twoCardsHTML(label, cards) { return `<div class="tc-field">${label ? `<b class="tc-l">${label}</b>` : ''}<div class="two-cards">${cards.map(c => `<${c.act ? 'button type="button"' : 'div'} class="tc-card${c.on ? ' on' : ''}"${c.act ? ` data-act="${c.act}"${c.data || ''} aria-pressed="${!!c.on}"` : ''}><small>${c.cap}</small><span>${c.val}</span></${c.act ? 'button' : 'div'}>`).join('')}</div></div>`; }
function partsWin(F, o) {
  const sheet = document.getElementById('sheet');
  const btn = (b, main) => `<button type="button" class="${main ? 'btn-nav' : 'icon-btn btn-copy'}"${main ? ' id="pwSend"' : ''} data-act="${b.act}"${b.v != null ? ` data-v="${fmEsc(b.v)}"` : ''}${main ? '' : ' style="width:auto;padding:0 12px;"'}>${b.label}</button>`;
  sheet.innerHTML = `${fmHead(o.title)}${o.intro ? `<div class="sh-hint pw-intro">${o.intro}</div>` : ''}<div class="pw-body">${(o.body || []).join('')}</div>${o.goal ? claudePartHTML(o.goal, o.kind, o.offN) : ''}${o.end || ''}
    <div class="sh-error fm-errline" hidden></div><div class="brow export-actions sheet-save-bar">${o.send ? btn(o.send, true) + (o.goal ? btn({ act: 'kit.copyGoal', v: o.goal, label: msi('content_copy', { size: 18 }) + ' העתקת ההוראות' }) : '') : btn({ act: 'kit.copyGoal', v: o.goal, label: msi('content_copy', { size: 18 }) + ' העתקת ההוראות' }, true)}${(o.more || []).map(b => btn(b)).join('')}</div>`;
  showSheetBackdrop(o.key); if (o.ref) winRef(o.ref); fmAttach(F); if (o.ctl) layerTop().ctl = o.ctl;
  return F;
}
// the parts a file holds, as rows for fmChecks (ק4: the same names everywhere)
function partItems(ids, counts, always) { return ids.map(k => ({ k, label: partLabel(k), sub: PART_INFO[k].sub || '', count: counts ? counts(k) : '', always: (always || []).includes(k) })); }
// ---- the one route in (ק3): the file decides where it lands, never the door ----
// door: 'import' (📥 ייבוא קובץ) · 'restore' (♻️ שחזור מקובץ) · 'paste' · 'share' (sharing to the installed app) · 'launch' ·
// 'closing' (a companion's marks, ctx.tripId) · 'bundle' (a newer trip of a group site). Returns true when the file was taken.
function parseAppText(text) { let data = null; try { data = JSON.parse(String(text).replace(/^\uFEFF/, '')); } catch (e) {} return data && data.app === BACKUP_APP ? data : null; }
function fileTooOld(data) {
  if (data.parts) return data.format !== BACKUP_FORMAT && data.format !== BACKUP_FORMAT_PREV && data.format !== BACKUP_FORMAT_OLD;
  if (data.kind !== 'trip' && data.kind !== 'destination') return false;
  return !!(data.appVersion && versionLess(data.appVersion, FILE_MIN_APP)) || !!(data.personal && data.personal.refs !== 'dest');
}
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
const FILE_COLOR = /^#[0-9a-fA-F]{6}$/, FILE_LINK = /^https?:\/\/[^\s"'<>`\\]+$/i, FILE_IMG = /^data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+\/=]*$/i;
const FILE_PHOTO_KEY = /^(?:photo|pimg|hotel|trash):/;
// 11.8.1 (timeline-import step 0b, the 11.8.0 review's miss a; standard tech-shared-mechanisms): a destination's general-info sections
// are HTML Claude writes (reference/file-format.md). They are parsed in an inert template and walked against an allowlist - the
// elements and attributes the sections use; an unknown element leaves its text, one that runs, embeds or loads goes whole; a link only
// to http(s), tel or mailto; an id only one of the app's hooks the sections carry (the accordion, the weather, the sun, the converter;
// a span's data-pack, the days' count); a style only plain declarations (a design token allowed); a comment only the TRIP_BLOCKS marker. At the door (fileClean), on stored data once (FILE_RULES), and where the
// sections are drawn (infoHtml). Guard: t1058 (hostile markup through every door).
const INFO_EL = new Set(['div', 'p', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'strong', 'b', 'em', 'i', 'u', 'br', 'hr', 'a', 'span', 'small', 'button', 'input', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'bdi', 'sup', 'sub', 'blockquote']);
const INFO_DROP = new Set(['script', 'style', 'iframe', 'object', 'embed', 'template', 'svg', 'math', 'img', 'picture', 'video', 'audio', 'source', 'track', 'form', 'link', 'meta', 'base', 'frame', 'frameset', 'noscript', 'select', 'textarea', 'canvas', 'portal']);
const INFO_AT = { '*': ['class', 'dir', 'title', 'lang', 'data-icon'], div: ['data-months'] /* 11.30.0 (wx-one-place): a season paragraph's months */, span: ['data-pack'], a: ['href', 'target', 'rel'], input: ['type', 'placeholder', 'inputmode', 'min', 'max', 'step'], button: ['type'], td: ['colspan', 'rowspan'], th: ['colspan', 'rowspan'] };
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
function infoHtml(raw) { raw = String(raw || ''); if (!_infoHtml.has(raw)) { if (_infoHtml.size > 40) _infoHtml.clear(); const f = htmlFrag(cleanInfo(raw, { out: true })); f.querySelectorAll('.accordion-item').forEach(e => e.setAttribute('data-info-sec', '1')); { const ws = wxSecOf(f); if (ws) ws.remove(); } /* 11.30.0 (wx-one-place): the weather section's words show in "מזג אוויר ולבוש" */ const d = document.createElement('div'); d.appendChild(f); _infoHtml.set(raw, d.innerHTML); } return _infoHtml.get(raw); }
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
const PLACE_STATUS = ['closed', 'gone', 'skip']; // a place's status in a file (isGoneStatus); 'active' lives only in my edits
const FILE_ITEM = { layers: 'layer', travels: 'travel', schedule: 'sched', places: 'place', lodging: 'hotel', userAdds: 'place' }; // kit-fixes (A2.8): a round's returned additions pass the place's checks (icon, links, booking and price) // 11.42.0: a hotel (its price - bpFileClean) // an array's items take the singular key
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
    if (k === 'gid') { const g = gidClean(v); if (g) o[k] = g; else { delete o[k]; FILE_DROPPED++; } continue; } // 11.22.0 (place-gid-1): a well-formed Google id record only (a closed field)
    if (k === 'infoNA') { o[k] = infoNAClean(v, key); continue; } // 11.43.0 (info-complete): "not relevant" sections - the ten fixed icons, by claude / user, closed values kept
    if (k === 'roadDays') { if (!v || typeof v !== 'object' || Array.isArray(v) || Object.keys(v).some(x => (x !== 'first' && x !== 'last') || typeof v[x] !== 'boolean')) { delete o[k]; FILE_DROPPED++; } continue; } // 11.19.0 (trip-travel-days): { first, last } booleans only
    if (key === 'meta' && k === 'country' && typeof v === 'string' && CLOSED_LISTS.obsoleteCountries.has(v)) { // 11.16.0 (Q8): an obsolete code
      const to = CLOSED_LISTS.obsoleteCountries.get(v); if (to) o[k] = to; else { delete o[k]; FILE_DROPPED++; } continue; } // its successor quietly; none - empty and counted
    const set = FILE_SETS[(k === 'legMain' ? 'trip' : key) + '.' + k];
    if (set && v != null && v !== '' && (typeof v !== 'string' || !set(v))) { delete o[k]; FILE_DROPPED++; continue; }
    if (typeof v !== 'string') { if (key === 'layerEdits') fileClean(v, 'layerEdit', Object.values(o).map(e => e && e.data).filter(Boolean)); else if (layerAdd && k === 'data') fileClean(v, 'layer', list); else fileClean(v, k === 'layers' && !Array.isArray(v) && key === 'edits' ? 'layerEdits' : k); continue; }
    if (k === 'color' && !FILE_COLOR.test(v)) { if (key === 'layer') o[k] = (BASE_TYPES[o.type] || {}).color || layerColorPick((list || []).filter(l => l !== o)); else delete o[k]; }
    else if (key === 'theme' && (k === 'primary' || k === 'accent') && !FILE_COLOR.test(v)) delete o[k];
    else if (key === 'theme' && k === 'headingFont' && !HEADING_FONTS.includes(v)) delete o[k];
    else if ((k === 'mapsUrl' || k === 'album' || (key === 'src' && k === 'url')) && v && !FILE_LINK.test(v)) delete o[k];
    else if (k === 'website' && v && !FILE_LINK.test(/^https?:/i.test(v) ? v : 'https://' + v)) delete o[k];
    else if (FILE_PHOTO_KEY.test(k) && !FILE_IMG.test(v)) delete o[k];
    else if (k === 'info' && (o.meta || o.places)) o[k] = cleanInfo(v, { icons: true }); } // 11.8.1: a destination's info sections; 11.12.0: their data-icon from the closed list
  return o;
}
// 11.8.0 (small-fixes item 4; decisions 2026-11-11 "Review of the 10.17.2 summary" Q4; standard tech-saving-data.md): what was stored
// before a rule of fileClean existed passes the same door once. FILE_RULES is the version that last added a rule - raise it with the
// next one. On the first open of such a version (regStartup, before the undo history's base) every row of mine goes through fileClean
// as it would leave in a backup, and a row that changed is written back through the registry (rowIn); no message. The
// device remembers the version it ran (the upkeep row), so it runs once.
const FILE_RULES = '11.46.0'; // 11.46.0 (phone-round-4c-fixes P9): a level's note of price words with a joined "ו" ("זול ונגיש") goes; 11.45.0 (kit-fixes): a price range of two adjacent levels becomes its upper level, and a level's note of price words only goes (item 11); a program line's unknown travel mode is dropped (A2.5); 11.44.1: a price 11.42.0 kept as a note that is only a level and one parenthesised word ("$$ (נגיש)") becomes that level (price-level-note, Q1); 11.42.0: a place's booking and price and a hotel's price - old text to the structure (booking-price, Q4); 11.22.0: a place's Google id moved out of its link into its own field, a bad record dropped (place-gid-1); 11.21.6: the keys the app made of dates, names and coordinates before (route hides, offline-map choices - idsKeysMerge); 11.21.4: ids and keys of the form (backup-ids, idsFixStored); 11.19.0: the food layer's icon (small-fixes 21); 11.8.1: a destination's info sections (cleanInfo); 11.11.0: the closed sets (FILE_SETS); 11.12.0: the four added fields and the references; 11.13.0: place references against the stored destinations; 11.16.0: obsolete country codes (their successor, or empty)
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
function openIncoming(data, door, ctx) {
  ctx = ctx || {};
  if (!data || data.app !== BACKUP_APP) { showToast('זה לא קובץ של ' + APP.appTitle); return false; }
  FILE_DROPPED = 0; fileIdsFix(data, idsTaken()); // 11.21.4 (backup-ids, Q1): an id or key not of the form is converted, not refused - the user sees nothing
  if (!fileIdsOk(data)) { showToast('בקובץ יש מזהה לא תקין, ולכן הוא לא נפתח. כדאי לבקש מה-' + AI + ' לבנות אותו שוב'); return true; } // 11.8.1: ids go into attributes as they are (after the conversion: never expected)
  fileClean(data); fileRefsClean(data); // final-review-followups (miss b): before anything reads the file; 11.12.0: references
  if (FILE_DROPPED) data._dropped = FILE_DROPPED; else delete data._dropped; // A6: what the closed sets dropped - the summary's line
  if (data && data.trip && typeof data.trip === 'object') travelsMerge(data.trip); // 11.0.0 (travels-1-model, Q16): a program line that is one of the travels is one record (the draft lists it once)
  if (data.minAppVersion && versionLess(APP_VERSION, data.minAppVersion)) { showToast(`הקובץ מגרסה חדשה יותר (${data.minAppVersion}). מעדכנים קודם את האפליקציה`); return true; }
  if (fileTooOld(data)) { showToast(TX.tooOld); return true; }
  fileUp(data);
  if (draftFromClaude(data)) hintMark('claude.back'); // 9.6.0 (12ו, batch 13.2): a file came back from Claude - the "איך" steps fold from now on; 11.21.0 (review of the night chain Q7): the one "from Claude" test, so a friend's file or a backup does not fold them
  // item 7 (review of 11.11.0): a file with no summary window reports what was dropped in its own message (fileDroppedNote, data._dropped)
  if (data.kind === 'memento-art') { receiveMementoArt(data); return true; } // 4.30.0: to the memory screen
  if (data.kind === 'proposal') { receiveProposal(data); return true; } // 11.5.0 (schedule-proposal): to the top of its trip's plan
  if (roundMatchesDraft(data)) { mergeRound(data); return true; } // 4.27.0: a round comes back to its draft
  if (data.round) { const r = data; setTimeout(() => showRoundReplies(r), 1200); data = stripRoundFile(data); }
  if (door === 'closing' && data.kind === 'trip' && ctx.tripId && companionFits(data, ctx.tripId)) { openReceive(data, { tripId: ctx.tripId, only: ['visits', 'favorites'], companion: true }); return true; }
  if (needsDraft(data)) { startDraft(data, door === 'share' || door === 'launch' ? 'share' : door === 'paste' ? 'paste' : 'file'); return true; }
  if (data.kind === 'trip' || data.kind === 'destination') { openReceive(data, { door }); return true; }
  if (data.kind === 'memento') { showToast('זה קובץ תמונת הטיול ששולחים ל-' + AI + '. את הקובץ שחוזר ממנו (הגרסה המאוירת) פותחים כאן'); return true; }
  if (data.parts) { openRestore(data); return true; }
  showToast('זה לא קובץ של ' + APP.appTitle); return false;
}
// the doors (ק15, ק16): a file picker at once; "או הדבקת תוכן" opens a small window; inside Claude the picker can't open,
// so the door opens the paste window straight away
// 9.3.0 (ס12-2): in a button the emoji and the word after it are one unit - they never part when the text wraps
const glueEmoji = s => /^\s*</.test(String(s)) ? String(s) : String(s).replace(/^(\S+) /, '$1\u00a0'); // 10.13.0: a label that starts with markup (an icon) is left whole
// 9.5.0 (12ה, ס13): a line that wraps by design breaks only between its parts - a weekday and its date, an emoji and its word stay together; a part's ← starts the next line,
// a " · " stays at the end of the line before it (sepTie; value-no-cut, decisions 2026-11-20 · Review of the `size-fixes-2` summary, Q3)
const glueText = s => sepTie(String(s).replace(/^([^\s\d<]+) (\d)/, '$1\u00a0$2')).replace(/ ([←→]) /g, ' $1\u00a0').replace(/(\p{Extended_Pictographic}\uFE0F?) (?=\S)/gu, '$1\u00a0');
function importDoorHTML(door, label, paste) { label = glueEmoji(label); // paste: the paste link's own label (10.13.0: the trips screen's two links with icons)
  if (inClaude()) return `<span class="brow tight imp-door"><button type="button" class="${door === 'restore' ? 'btn-nav' : 'icon-btn btn-copy'}" data-act="import.paste" data-v="${door}"${door === 'restore' ? '' : ' style="width:auto;padding:0 12px;"'}>${paste || msi('content_paste', { size: 18 }) + 'הדבקת תוכן'}</button></span>`; // 9.3.0: the paste window only (inside a frame); 11.34.0 (G82): as wide as its words, like the file button it replaces
  return `<span class="brow tight imp-door">${fmFile({ label, cls: door === 'restore' ? 'btn-nav' : 'icon-btn btn-copy', act: 'import.file', v: door, data: 'data-imfile', style: door === 'restore' ? '' : 'width:auto;padding:0 12px;' })}
    <button type="button" class="link-btn imp-paste" data-act="import.paste" data-v="${door}">${paste || 'או הדבקת תוכן'}</button></span>`;
}
act('import.file', async c => { const f = c.el.files && c.el.files[0], door = c.v || 'import'; c.el.value = ''; if (!f) return 'quiet'; const ctx = door === 'closing' && CLOSING ? { tripId: CLOSING.id } : {};
  const reading = await fmReading(c.el); let data = null; // P12: the line shows before the read, until the file is parsed
  try { let text; try { text = await f.text(); } catch (e) { showToast('הקובץ לא נקרא: ' + e.message); return; }
    try { data = JSON.parse(text.replace(/^\uFEFF/, '')); } catch (e) { showToast('זה לא קובץ של ' + APP.appTitle); return; } } finally { reading(); }
  openIncoming(data, door, ctx); redrawSoon(); });
act('import.paste', c => { openPasteSheet(c.v || 'import'); return 'quiet'; });
// 11.34.0 (phone-round-3-fixes P13, G82; decisions 2026-11-20 · The open bugs of phone round 3, Q1): the 9.3.0 guess - a picker that
// closed within 0.7 s means "no file picker" - is gone: a real fast cancel set it for good. Only a frame (the in-Claude copy) makes the doors paste only
function openPasteSheet(door) { layerNote(openPasteSheet, arguments); const F = fmNew({ door });
  document.getElementById('sheet').innerHTML = `${fmHead('📋 הדבקת תוכן')}<div class="sh-hint">מדביקים את כל התוכן של קובץ מהאפליקציה, או תוכן שה-${AI} נתן בשיחה במקום קובץ.</div>
    ${fmText(F, 'text', { label: 'התוכן', para: true, rows: 6, dir: 'ltr', raw: true })}
    <div class="sh-error fm-errline" hidden></div><div class="brow export-actions sheet-save-bar"><button type="button" class="btn-nav" id="pasteRead" data-act="import.read">📥 קריאה</button></div>`;
  showSheetBackdrop('openPasteSheet'); fmAttach(F); }
act('import.read', c => { const F = fmOf(c.el); if (!F) return; const t = String(fmGet(F, 'text') || '').trim();
  if (!t) return fmFail(F, 'text', 'התיבה ריקה');
  let data = null; try { data = JSON.parse(t.replace(/^\uFEFF/, '')); } catch (e) {}
  if (!data) return fmFail(F, 'text', 'לא זיהיתי את התוכן: צריך את כל התוכן של קובץ מהאפליקציה');
  const door = F.opts.door, ctx = door === 'closing' && CLOSING ? { tripId: CLOSING.id } : {}; closeSheet(); setTimeout(() => openIncoming(data, door === 'closing' ? 'closing' : 'paste', ctx), 60); });
// shared to the installed app (share_target) or opened with it (file_handlers): the same route
async function receiveSharedFiles() {
  let names = [];
  try { const c = await regCache(REG_BY.shareInbox.where.cache[0]); const keys = await c.keys();
    for (const k of keys) { const r = await c.match(k); const nm = decodeURIComponent(r.headers.get('X-Name') || ''); names.push(nm);
      const data = parseAppText(await r.text()); await c.delete(k); if (data && openIncoming(data, 'share')) return; }
  } catch (e) {}
  showToast(names.length ? `הקובץ ${names[0] || ''} לא נראה כמו קובץ של ${APP.appTitle}` : 'לא הגיע קובץ. אפשר לנסות שוב, או "ייבוא קובץ" במסך הטיולים');
}
// ---- a file of a trip or a destination that is already on the phone (ק18): one window for both ----
function companionFits(data, tid) { const t = STATE.trips[tid]; return !!(t && data.personal && data.trip && (data.trip.id === t.id || tripDests(data.trip).join() === tripDests(t).join())); }
// the parts a trip or destination file holds, in the order of PARTS
function fileParts(data) {
  const out = [], P = data.personal || {}, has = row => (REG_BY[row].where.td || []).some(f => P[f] !== undefined && P[f] !== null && (!Array.isArray(P[f]) || P[f].length) && (typeof P[f] !== 'object' || Object.keys(P[f]).length));
  const dps = data.kind === 'trip' ? (data.destinations || []) : [data.destination].filter(Boolean);
  PART_LIST.forEach(p => {
    if (p === 'trip' && data.kind === 'trip') out.push(p);
    else if (p === 'dests' && dps.length) out.push(p);
    else if (p === 'edits' && dps.some(dp => dp.edits && destEditsAligned(dp) && ['places', 'status', 'layers', 'infoNA'].some(k => Object.keys(dp.edits[k] || {}).length))) out.push(p);
    else if (p === 'mementos' && ((data.mementos && Object.keys(data.mementos.items || {}).length) || has('mementoEdits'))) out.push(p);
    else if (['plan', 'favorites', 'visits', 'bookings'].includes(p) && PART_BY[p].rows.some(has)) out.push(p);
  });
  return out;
}
function filePartCount(data, k) { const P = data.personal || {}, dps = data.kind === 'trip' ? (data.destinations || []) : [data.destination].filter(Boolean);
  if (k === 'dests') return dps.length > 1 ? `${dps.length} יעדים` : '';
  if (k === 'plan') { const n = Object.keys(P.itinerary || {}).length; return n ? `${n} ימים` : ''; }
  if (k === 'favorites') return (P.favorites || []).length ? String(P.favorites.length) : '';
  if (k === 'visits') return (P.visited || []).length ? `${P.visited.length} ${TX.places}` : '';
  if (k === 'bookings') return Object.keys(P.bookings || {}).length ? String(Object.keys(P.bookings).length) : '';
  if (k === 'mementos') { const n = Object.keys((data.mementos || {}).items || {}).length; return n ? `${n} תמונות` : ''; }
  if (k === 'edits') { const c = editsConflicts(data); return `${c.n}${c.conf.length ? `${SEP}${c.conf.length} גם אצלכם` : ''}`; }
  return ''; }
// the edits in a file, by this phone's ids: how many, and which were edited here too (ק22)
function editsConflicts(data) {
  const dps = (data.kind === 'trip' ? (data.destinations || []) : [data.destination]).filter(dp => dp && dp.edits && DESTS[dp.id]);
  const inc = { places: {}, status: {}, layers: {}, layerOrder: {}, infoNA: {} }; dps.forEach(dp => mergeDestEdits(dp, inc));
  const rows = editRows({ edits: inc }); return { n: rows.length, conf: rows.filter(r => r.conflict), rows, inc };
}
function openReceive(data, o) { layerNote(openReceive, arguments); o = o || {};
  const isTrip = data.kind === 'trip', thing = isTrip ? data.trip : data.destination, tid = o.tripId || (isTrip ? thing.id : null);
  const here = isTrip ? STATE.trips[tid] : DESTS[thing.id], name = isTrip ? String((here || thing).name).split(' · ')[0] : (thing.meta || {}).name;
  let parts = (o.only || fileParts(data)).filter(k => !o.only || fileParts(data).includes(k));
  const same = isTrip && here && !o.companion && (thing.version || 1) === (here.version || 1) && parts.every(k => k === 'trip' || k === 'dests') && (!isTrip || JSON.stringify(here.segments) === JSON.stringify(thing.segments));
  if (same || (!isTrip && installDestinationSame(thing))) { // kit-fixes (A2.3): a destination is the same by its content, not by its kept version
    showToast(`${isTrip ? 'הטיול' : 'היעד'} ${name} כבר בטלפון`); return; }
  if (!parts.length) { showToast('אין בקובץ מה שמתאים כאן'); return; }
  const F = fmNew({ data, o }), ctl = { take: o.take || new Set() };
  const who = [data.device ? 'מ' + fmEsc(data.device) : '', data.createdAt ? tmFmt('date', data.createdAt) : '', thing.version ? 'גרסה ' + thing.version : ''].filter(Boolean).join(SEP);
  const conf = parts.includes('edits') ? editsConflicts(data) : null;
  const body = [fmChecks(F, 'parts', { label: o.companion ? 'מה לצרף' : 'מה לקחת מהקובץ', items: partItems(parts, k => filePartCount(data, k)), value: parts }),
    fileDroppedHTML(data._dropped), // A6: the receive summary's one line
    conf && conf.conf.length ? `<div class="sh-hint pw-conf">${conf.conf.length} מהעריכות נערכו גם אצלכם, ושלכם נשאר${ctl.take.size ? ` (חוץ מ-${ctl.take.size} שבחרתם מהקובץ)` : ''}. <button type="button" class="pw-link" data-act="recv.review">לבחור אחד-אחד</button></div>` : ''];
  partsWin(F, { key: 'openReceive', title: `📥 קובץ התקבל${SEP}${fmEsc(name)}${thing.version ? SEP + 'גרסה ' + thing.version : ''}`, intro: `${o.door === 'bundle' ? 'יש גרסה חדשה של הטיול באתר.' : (o.companion ? 'הסימונים של מי שטייל איתכם.' : (isTrip ? 'הטיול' : 'היעד') + ' כבר בטלפון.')}${who ? ' ' + who + '.' : ''}<br>מה שמסומן מתווסף בלי למחוק; מה שלא מסומן לא משתנה.`,
    body, send: { act: 'recv.go', label: o.companion ? '📥 צירוף הסימונים' : 'עדכון' }, more: isTrip && !o.companion ? [{ act: 'recv.copy', label: 'עותק נפרד' }] : [], ctl });
  ctl.conf = conf;
}
function installDestinationSame(dp) { const ex = DESTS[dp.id]; return !!(ex && !dp.edits && JSON.stringify(ex.places) === JSON.stringify(dp.places) && JSON.stringify(ex.meta) === JSON.stringify(dp.meta) && (ex.info || '') === (dp.info || '')); }
act('recv.review', c => { const t = layerTop(), ctl = t && t.ctl; if (!ctl || !ctl.conf) return 'quiet'; const conf = ctl.conf;
  openEditsReview({ edits: conf.inc }, 'הקובץ', { only: conf.conf, take: ctl.take, onPick: set => { ctl.take = set; } }); return 'quiet'; });
act('recv.go', c => receiveApply(c, 'update'));
act('recv.copy', c => receiveApply(c, 'copy'));
function receiveApply(c, mode) {
  const F = fmOf(c.el), t = layerTop(); if (!F || !t) return; const { data, o } = F.opts, picks = fmGet(F, 'parts') || [], take = (t.ctl && t.ctl.take) || new Set();
  if (!picks.length) return fmFailLine(F, 'בחרו לפחות חלק אחד');
  closeSheet();
  if (o.companion) { mergeCompanion(o.tripId, data, picks); return; }
  if (data.kind === 'trip') { importTripNow(data, mode, null, '', { picks, take }); if (o.door === 'bundle') { STATE.bundleSeen[data.trip.id] = data.trip.version || 1; persist(); } return; }
  receiveDestination(data, picks, take);
}
function receiveDestination(data, picks, take) {
  const dp = data.destination;
  if (picks.includes('dests')) installDestination(dp);
  let n = 0; if (picks.includes('edits') && dp.edits) { const e = JSON.parse(JSON.stringify(STATE.edits)); n = mergeDestEdits(dp, e, take); STATE.edits = e; ensureEditsShape(); refreshLayers(); }
  persist(); showUndoToast(`היעד ${dp.meta.name} עודכן מקובץ${n ? ` (+${n} עריכות)` : ''}`); // undo-history Q6: one row
}
// ---- the edits of someone else, one by one (ק22; was a box in the backup screen): what was edited here too is shown with
// my version and stays mine unless checked ----
// 10.9.0 (design-forms, gap 45, design-gaps Q9): a row per edited thing (taken whole); its title says what and which fields, its line the change
// when one field changed, a new place's layer and region; no emoji
const EDIT_FIELD_HE = { name: 'שם', layer: 'שכבה', address: 'כתובת', description: 'תיאור', transit: 'איך מגיעים', reservation: 'הזמנה', price: 'מחיר', manualCoord: 'מיקום', mapsUrl: 'קישור', icon: 'סמל', region: 'אזור', key: 'נקודת מפתח', color: 'צבע', emoji: 'סמל', order: 'סדר' };
const statusWord = s => STATUS_LABEL[s] || 'פעיל';
function editRows(inc) {
  const e = (inc && inc.edits) || { places: {}, status: {} }, rows = [], esc = fmEsc;
  const nm = (id, ent) => (ent && ent.data && ent.data.name) || ((POINTS.find(p => p.id === Number(id)) || {}).name) || baseNameOf(id) || ('#' + id);
  const fields = d => [...new Set(Object.keys(d || {}).filter(k => EDIT_FIELD_HE[k]).map(k => EDIT_FIELD_HE[k]))].join(', ');
  const short = v => typeof v === 'string' && v && v.length <= 40 ? v : '';
  Object.entries(e.places || {}).forEach(([id, ent]) => { const mine = STATE.edits.places[id]; if (mine && JSON.stringify(mine.data) === JSON.stringify(ent.data)) return;
    const p = POINTS.find(q => q.id === Number(id)) || {}, d = ent.data || {}, ks = Object.keys(d).filter(k => EDIT_FIELD_HE[k]);
    let label, sub = '';
    if (ent.op === 'del') label = `${esc(nm(id, ent))}${SEP}נמחק`; // 11.18.0 (place-hide-delete Q2)
    else if (ent.op === 'add') { label = `${esc(nm(id, ent))}${SEP}מקום חדש`; sub = [d.layer != null ? (layerDef(Number(d.layer)) || {}).name : '', d.region || ''].filter(Boolean).map(esc).join(SEP); }
    else { label = `${esc(p.name || nm(id))}${SEP}${fields(d) || 'עריכה'}`; if (ks.length === 1 && short(p[ks[0]]) && short(d[ks[0]])) sub = `<bdi>${esc(p[ks[0]])}</bdi> ← <bdi>${esc(d[ks[0]])}</bdi>`; }
    rows.push({ kind: 'place', id, ent, conflict: !!mine, label, sub, mineLabel: mine ? nm(id, mine) : '' }); });
  Object.entries(e.status || {}).forEach(([id, ent]) => { const mine = STATE.edits.status[id]; if (mine && mine.s === ent.s && (mine.note || '') === (ent.note || '')) return;
    rows.push({ kind: 'status', id, ent, conflict: !!mine, label: `${esc(nm(id))}${SEP}סומן ״${statusWord(ent.s)}״`, sub: ent.note ? esc(ent.note) : '', mineLabel: mine ? statusWord(mine.s) : '' }); });
  Object.entries(e.layers || {}).forEach(([id, ent]) => { const mine = STATE.edits.layers[id]; if (mine && JSON.stringify(mine) === JSON.stringify(ent)) return;
    const name = (ent.data && ent.data.name) || layerDef(Number(id)).name;
    rows.push({ kind: 'layer', id, ent, conflict: !!mine, label: `שכבת ${esc(name)}${SEP}${ent.op === 'add' ? 'שכבה חדשה' : ent.op === 'del' ? 'נמחקה' : fields(ent.data) || 'עריכה'}`, sub: '', mineLabel: mine ? ((mine.data && mine.data.name) || name) : '' }); });
  Object.entries(e.layerOrder || {}).forEach(([dest, arr]) => { const mine = STATE.edits.layerOrder[dest]; if (mine && JSON.stringify(mine) === JSON.stringify(arr)) return;
    rows.push({ kind: 'order', id: dest, ent: arr, conflict: !!mine, label: `סדר השכבות${SEP}${esc(destName(dest))}`, sub: '', mineLabel: mine ? 'סדר אחר' : '' }); });
  Object.entries(e.infoNA || {}).forEach(([dest, arr]) => { const mine = (STATE.edits.infoNA || {})[dest]; if (!Array.isArray(arr) || (mine && JSON.stringify(mine) === JSON.stringify(arr))) return; // 11.43.0 (info-complete)
    rows.push({ kind: 'infoNA', id: dest, ent: arr, conflict: !!mine, label: `מידע כללי לא רלוונטי${SEP}${esc(destName(dest))}`, sub: arr.filter(x => !x.off).map(x => esc(infoTitleOf(x.icon))).join(', '), mineLabel: mine ? 'סימון אחר' : '' }); });
  return rows;
}
function openEditsReview(inc, from, o) { layerNote(openEditsReview, arguments); o = o || {};
  const rows = o.only || editRows(inc); if (!rows.length) { showToast('אין בקובץ עריכות חדשות - הכל כבר אצלכם'); return; }
  const F = fmNew({ rows, o, from }), key = r => r.kind + ':' + r.id;
  const items = rows.map(r => ({ k: key(r), label: r.label, sub: r.conflict ? `<span class="fm-warnline">${warnIc()} נערך גם כאן${SEP}שלכם נשאר אם לא מסמנים</span>` : r.sub || '' }));
  const take = o.take ? rows.filter(r => o.take.has(key(r))).map(key) : rows.filter(r => !r.conflict).map(key), lbl = n => o.onPick ? 'אישור' : `לקחת ${n}`; // the main action counts what is checked
  partsWin(F, { key: 'openEditsReview', title: `✏️ השינויים מ${nameB(from)}`, intro: 'מסמנים מה לקחת. כל שורה נלקחת בשלמותה.',
    body: [fmChecks(F, 'take', { items, value: take, on: v => { const b = document.getElementById('pwSend'); if (b) b.textContent = lbl((v || []).length); } })], send: { act: 'review.go', label: lbl(take.length) }, more: [{ act: 'win.done', label: 'דילוג' }] }); // 10.5.0: "דילוג" - bottom sheets have no ✕
}
act('review.go', c => { const F = fmOf(c.el); if (!F) return; const { rows, o, from } = F.opts, keys = new Set(fmGet(F, 'take') || []);
  if (o.onPick) { o.onPick(keys); closeSheet(); return; }
  let n = 0;
  rows.filter(r => keys.has(r.kind + ':' + r.id)).forEach(r => { if (r.kind === 'place') STATE.edits.places[r.id] = r.ent; else if (r.kind === 'layer') STATE.edits.layers[r.id] = r.ent; else if (r.kind === 'order') STATE.edits.layerOrder = { ...STATE.edits.layerOrder, [r.id]: r.ent }; else if (r.kind === 'infoNA') STATE.edits.infoNA = { ...(STATE.edits.infoNA || {}), [r.id]: r.ent }; else STATE.edits.status[r.id] = r.ent; n++; });
  closeSheet(); syncFlightsToPlan(); refreshLayers(); persist();
  showUndoToast(`מוזגו ${n} עריכות מ${from}`); });

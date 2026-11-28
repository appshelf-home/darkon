// ================= 📚 "מה יש כאן" - the door every map carries (split from discoveries.js in diet-groups, 11.62.0; the search, the pins, the cards, the list and "לאורך הדרך" stay there, in the discoveries group - diet-room) =================
const DISC = { items: {}, searches: [], imgs: [], loaded: false };
const DISC_CACHE = REG_BY.disc.where.cache[0], DISC_IMG_CACHE = REG_BY.disc.where.cache[1], DISC_DOC = 'https://darkon.local/disc-v1.json', DISC_IMG_MAX = 20e6, DISC_ITEMS_MAX = 6000;
const DISC_MAPS = {}; // containerId -> { map, ctx, markers, last: {lat,lng,r}, busy }
const DISC_LAST = {}; // 10.11.0: containerId -> the area last searched there, kept when its map is disposed (the next map of that container starts from it)
function discOn() { return !!DEV.disc; }
function setDiscOn(v) { devSet({ disc: !!v }); }
async function discLoad() {
  if (DISC.loaded) return;
  try { const c = await regCache(DISC_CACHE), r = await c.match(DISC_DOC); if (r) { const j = await r.json(); DISC.items = j.items || {}; DISC.searches = j.searches || []; DISC.imgs = j.imgs || []; } } catch (e) {}
  DISC.loaded = true; Object.keys(DISC_MAPS).forEach(discDrawG);
}
let _discSaveT = 0;
function discSave() { clearTimeout(_discSaveT); _discSaveT = setTimeout(async () => {
  const ks = Object.keys(DISC.items); if (ks.length > DISC_ITEMS_MAX) ks.sort((a, b) => DISC.items[a].at - DISC.items[b].at).slice(0, ks.length - DISC_ITEMS_MAX).forEach(k => delete DISC.items[k]);
  DISC.searches = DISC.searches.slice(-400);
  try { const c = await regCache(DISC_CACHE); await regCachePut(c, DISC_DOC, new Response(JSON.stringify({ items: DISC.items, searches: DISC.searches, imgs: DISC.imgs }), { headers: { 'Content-Type': 'application/json' } })); } catch (e) {} }, 400); }
// a discovery's names: its title, and the English title Wikipedia gave with it (dup-both-names: matched against both names of a place)
const discNames = it => [it.title, it.enTitle];
function discExisting(it) { // one of my places (any destination of this trip, or a trip place) is the same thing
  return POINTS.find(p => { if (p.src && p.src.url && it.url && p.src.url === it.url) return true; if (p.src && p.src.key === it.k) return true;
    const c = routeCoordOf(p); if (!c || distanceKm(c, it) > SAME_NEAR_KM) return false; return !!placeNameMatch(discNames(it), p, 'loose'); }) || null;
}
function discWikiUrlFor(p) { if (p.src && p.src.url) return p.src.url; const it = Object.values(DISC.items).find(x => x.url && discExisting(x) === p); return it ? it.url : ''; }
function discAttach(hostId, map, ctx, hostEl) {
  const host = hostEl || document.getElementById(hostId); if (!host || !map) return;
  const old = DISC_MAPS[hostId]; if (old && old.map === map) { discAlongGo(hostId); return; }
  DISC_MAPS[hostId] = { map, ctx, markers: [], last: old ? old.last : DISC_LAST[hostId], busy: !!(old && old.along && old.along.busy), host, along: old ? old.along : null }; // along-drive: a map drawn again keeps its drive's search
  discAlongGo(hostId);
  let btn = host.querySelector(':scope > .disc-btn');
  if (!btn) { btn = document.createElement('button'); btn.type = 'button'; btn.className = 'disc-btn'; btn.innerHTML = msi('auto_stories'); btn.title = 'מה יש כאן'; btn.setAttribute('aria-label', 'מה יש כאן'); btn.dataset.act = 'disc.toggle'; host.appendChild(btn); mapCtl(btn); }
  btn.setAttribute('aria-pressed', String(discOn()));
  map.on('moveend', () => { if (DISC_MAPS[hostId] && DISC_MAPS[hostId].map === map) discDrawG(hostId); });
  if (!DISC.loaded) discLoad(); else discDrawG(hostId);
}
// diet-groups: the pins are drawn by the discoveries group (diet-room: split from special-maps) - at once when it is in, else only when the switch is on (the group comes quietly,
// from the phone; nothing to draw while it is off); a drive's search asked for this map (ALONG_GO) exists only once the group is in
function discDrawG(hostId) { if (groupHas('discoveries')) groupFn('discoveries', 'discDraw')(hostId); else if (discOn()) needGroup('discoveries').then(ok => { if (ok) groupFn('discoveries', 'discDraw')(hostId); }); }
function discAlongGo(hostId) { if (groupHas('discoveries')) groupFn('discoveries', 'alongGo')(hostId); }
function draftClearLayer(D, destId, ty) {
  const ls = draftDestLayers(D, destId), same = ty ? ls.filter(l => l.type === ty) : [];
  if (same.length === 1) return { clear: same[0], maybe: [] };
  const first = t => ls.filter(l => l.type === t).slice(0, 1);
  return { clear: null, maybe: (same.length ? same : [].concat(first('attractions'), first('nature'), first('food'))).slice(0, 3) };
}
function removeDraftAdd(key) {
  const D = DRAFT; if (!D) return; const a = draftAdds(D).find(x => x.key === key); if (!a) return;
  D.add = D.add.filter(x => x.key !== key); delete D.off[key]; saveDraft();
  showUndoToast(SY.del + ' נמחק מהטיוטה: ' + a.name);
}
function alongCan(f) { return !!f && f.mode === 'car' && !f.group && MAP_AVAILABLE && !ARCHIVE_VIEW && !(activeTripObj() || {}).archived && !!travelPts(f, tvCtx()); }
function alongBtnHTML(f, day, ro) { return ro || !alongCan(f) ? '' : `<button type="button" class="tl-tag along-tag" data-act="along.open" data-v="${escH(f.id + '|' + day)}">${tagIc('auto_stories')}לאורך הדרך${svcOnline() ? '' : SEP + 'צריך רשת'}</button>`; }
// 7.1.0: Wikipedia's API through the client (service "תמונה למקום"): the query's pages; no answer throws, so nothing is kept
async function wikiPages(lang, q) {
  const r = await svcAsk('pointImage', { build: () => ({ url: `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&origin=*&${q}` }),
    parse: j => { if (!j || typeof j !== 'object' || j.error) throw new Error('answer'); return Object.values((j.query || {}).pages || {}); } });
  if (r.kind !== 'ok') throw new Error('wiki ' + r.kind); return r.value; }
// legal-credits (C5): free pictures only, said explicitly; the file's name for its facts
function picWikiApi(lang, params) { return wikiPages(lang, `prop=pageimages&piprop=thumbnail%7Cname&pithumbsize=480&pilicense=free&redirects=1&${params}`); }
// legal-credits (Q8, C1): a Commons picture's facts, asked with the picture - its author (plain text; legal-credits-2: the licensor's requested attribution when there is one), licence, the licence's address, whether
// attribution is required, and the file page. A picture whose licence is unknown or not free gets null: it is never used. Throws on no answer.
async function wikiFileCredit(lang, file) { if (!file) return null;
  const pg = (await wikiPages(lang, `prop=imageinfo&iiprop=extmetadata&iiextmetadatafilter=Artist%7CAttribution%7CLicenseShortName%7CLicenseUrl%7CAttributionRequired%7CNonFree&titles=${encodeURIComponent('File:' + String(file).replace(/^(File|קובץ):/i, ''))}`))[0];
  return wikiCreditOf(pg && pg.imageinfo && pg.imageinfo[0] && pg.imageinfo[0].extmetadata, file, lang); }
// the file page (fp): on the wiki the picture was found on - it shows the Commons file and its licence
function wikiCreditOf(md, file, lang) { if (!md || md.empty) return null; const v = k => md[k] && md[k].value != null ? String(md[k].value) : '';
  const lic = htmlText(v('LicenseShortName')).trim(); if (!lic || /non-?free|fair use/i.test(lic) || /^true$/i.test(v('NonFree'))) return null;
  const a = htmlText(v('Attribution') || v('Artist')).replace(/\s+/g, ' ').trim().slice(0, 80); // legal-credits-2 (C17): the attribution the licensor asks for (Commons' "Attribution" field), when the file has one, in place of the author
  return { a, lic: lic.slice(0, 40), lu: /^https?:\/\//.test(v('LicenseUrl')) ? v('LicenseUrl') : '', req: !/^false$/i.test(v('AttributionRequired')), fp: `https://${/^[a-z-]{2,12}$/.test(lang || '') ? lang : 'he'}.wikipedia.org/wiki/File:` + encodeURIComponent(String(file).replace(/^(File|קובץ):/i, '').replace(/ /g, '_')) }; }

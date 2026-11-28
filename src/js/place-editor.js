// ================= PLACE EDITOR (2.0.0) =================
// Add or edit a place. Location: search by name/address, my location (GPS), a Google Maps link,
// or a point on the map (long press on the map screen / drag the pin). Name, layer and location are required.
function parseMapsLink(t) {
  t = (t || '').trim(); if (!t) return null;
  const dec = (() => { try { return decodeURIComponent(t); } catch (e) { return t; } })();
  let m = dec.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) || dec.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) || dec.match(/[?&](?:q|query|ll|destination)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/) || dec.match(/^(-?\d+\.\d+),\s*(-?\d+\.\d+)$/);
  const name = (dec.match(/\/place\/([^/@]+)/) || [])[1];
  const url = (t.match(/https?:\/\/\S+/) || [])[0] || '';
  const textName = url ? t.replace(url, '').trim().split('\n')[0].trim() : '';
  return { coord: m ? { lat: parseFloat(m[1]), lng: parseFloat(m[2]) } : null, name: name ? name.replace(/\+/g, ' ') : (textName || ''), url, short: /goo\.gl|maps\.app|share\.google/.test(url) }; // 11.21.6 (P2): Google Search's share (share.google) is a short link too
}
// 11.20.0 (place-search-upgrade): the one place search (placeSearch, its window and the Google Maps share) lives in place-search.js
// 4.34.0: accents and punctuation ignored, and also a place at the same spot; dup-both-names: the typed names (name, local name) against
// both names of every place (placeNameMatch 'loose'); `by` is the place's name it was found by
function similarPlaces(names, selfId, coord) {
  const out = [];
  POINTS.forEach(p => { if (p.id === selfId || p.planOnly) return; const by = placeNameMatch(names, p, 'loose'), byName = !!by;
    let m = null; if (coord) { const pc = routeCoordOf(p); if (pc) { const km = distanceKm(coord, pc); if (km <= 0.06) m = Math.round(km * 1000); } }
    if (byName || m != null) out.push({ p, m, byName, by }); });
  return out.sort((a, b) => (b.byName && b.m != null) - (a.byName && a.m != null) || (a.m == null ? 1e9 : a.m) - (b.m == null ? 1e9 : b.m)).slice(0, 3);
}
// 7.2.0 (ע2, מ1, מ10): ONE place editor, built from the form building blocks. Three ways in, one form:
//  - a place of mine / of the destination (opts.id, or a new one: opts.coord / name / layer / noGuess / maybe / src / afterSave)
//  - a place of a draft (opts.draftKey: a fix goes to the draft's layer of fixes, D.fix - "תיקון בטיוטה" became this)
//  - an addition to a draft (opts.draftAdd: a new one from "📚 מה יש כאן"; opts.draftKey "add:..." edits it)
// Visible: name, layer (a button - the list grouped by destination, the place's own first), location. Collapsed: details,
// booking and price, classification (region, belongs to, the key point - מ10), status. Red row: delete / hide / remove from draft.
// 10.15.0 (design-review F17): a place's source link - the discovery's line icon (auto_stories / account_balance), not 📚 🏛️
function srcLinkText(src) { return src.type === 'osm' ? msi('account_balance', { cls: 'msi-in' }) + ' OpenStreetMap' : msi('auto_stories', { cls: 'msi-in' }) + ' ויקיפדיה'; }
function peCtx(opts) {
  if (opts.draftKey != null || opts.draftAdd) {
    const D = DRAFT; if (!D) return null; D.add = D.add || []; D.addLayers = D.addLayers || []; D.fix = D.fix || {}; D.off = D.off || {};
    const key = opts.draftKey != null ? String(opts.draftKey) : null;
    if (opts.draftAdd || (key && key.startsWith('add:'))) { // an addition of mine
      const cur = key ? D.add.find(a => a.key === key) : null; if (key && !cur) return null;
      const a0 = cur ? JSON.parse(JSON.stringify(cur)) : opts.draftAdd, ts = draftTargetDests(D), dest0 = ts.some(t => t.id === a0.dest) ? a0.dest : (ts[0] && ts[0].id);
      let layer0 = cur ? cur.layer : null, maybe = []; if (!cur) { const c = draftClearLayer(D, dest0, a0.ty || ''); layer0 = c.clear ? c.clear.id : null; maybe = c.maybe; }
      return { kind: 'add', D, key, cur, a0, ts, title: cur ? '✏️ תוספת שלי בטיוטה' : '📚 הוספה לטיוטה',
        hint: 'נכנס לטיוטה מסומן "' + msi('auto_stories', { cls: 'msi-in' }) + ' נוסף על ידיך". באישור הטיוטה הוא נשמר כמקום שהוספת, מעל היעד - עדכון של היעד לא דורס אותו. ביטול הטיוטה מוריד אותו.',
        name: a0.name || '', foreign: a0.foreign || '', layer: layer0 == null ? '' : dest0 + '|' + layer0, coord: a0.manualCoord || null, address: a0.address || '', desc: a0.description || '',
        transit: a0.transit || '', resv: a0.reservation || '', price: a0.price || '', region: a0.region || '', src: a0.src, maybe: maybe.map(l => dest0 + '|' + l.id), noGuess: !cur,
        center: (DESTS[dest0] && DESTS[dest0].meta.center) || (ts[0] && ts[0].dp.meta && ts[0].dp.meta.center),
        layerOpts: () => ts.map(t => draftDestLayers(D, t.id).map(l => ({ v: t.id + '|' + l.id, l, group: withFlag(t.inst ? destFlag(t.id) : destFlagMeta(t.dp.meta), t.dp.meta.name) + (t.inst ? (SEP + 'כבר בטלפון') : ''), dest: t.id }))).flat(),
        regionsOf: v => { const t = ts.find(x => x.id === String(v).split('|')[0]); return (t && t.dp && t.dp.meta && t.dp.meta.regions) || []; },
        newLayer: v => ({ draft: D, dest: String(v || dest0 + '|').split('|')[0] || dest0 }),
        dup: (F) => { const ns = [fmGet(F, 'name'), fmGet(F, 'foreign')], dest = String(F.vals.layer || dest0 + '|').split('|')[0]; // dup-both-names: both names, both sides
          const sim = draftItems(D).filter(x => x.key !== key && x.src === dest).map(x => ({ x, by: placeNameMatch(ns, x.p, 'loose') })).filter(s => s.by);
          return sim.length ? 'יש כבר בטיוטה: ' + sim.slice(0, 3).map(s => `<b>${escH(s.x.p.name)}</b>${peDupBy(s.x.p, s.by)}`).join(', ') : ''; } };
    }
    const x = draftItems(D).find(i => i.key === key); if (!x) return null; // a fix of a place of the draft
    const p = x.p, dp = x.dp, c = draftCoord(p);
    return { kind: 'fix', D, key, x, title: '✏️ תיקון לפני אישור', name: p.name || '', foreign: p.foreign || '', layer: p.layer == null ? '' : String(p.layer), coord: c, address: p.address || '', desc: p.description || '',
      transit: p.transit || '', resv: p.reservation || '', price: p.price || '', region: p.region || '', reset: x.fixed, center: dp && dp.meta && dp.meta.center,
      layerOpts: () => ((dp && dp.meta && dp.meta.layers) || []).map(l => ({ v: String(l.id), l, group: dp.meta.name })), regionsOf: () => (dp && dp.meta && dp.meta.regions) || [] };
  }
  const id = opts.id != null ? opts.id : null, cur = id != null ? POINTS.find(p => p.id === id) : null; if (id != null && !cur) return null;
  let layer = opts.layer || (cur && cur.layer) || (!opts.noGuess && typeof activeTab === 'number' ? activeTab : null); // 4.25.0: a discovery never guesses
  if (!layer && !opts.noGuess && typeof activeTab === 'string' && activeTab.startsWith('type:')) { const g = groupOf(activeTab), d = curDest(); layer = g ? (g.layers.find(l => layerDef(l).dest === d.id) || g.layers[0]) : null; }
  const own = cur ? (cur.dest || layerDef(cur.layer).dest) : null;
  return { kind: 'place', id, cur, title: cur ? '✏️ עריכת מקום' : '＋ מקום חדש', name: cur ? cur.name : (opts.name || ''), foreign: cur ? (cur.foreign || '') : '', layer: layer == null ? '' : layer,
    coord: opts.coord || (cur && cur.manualCoord) || (cur && GEOCODE_CACHE[cur.address]) || null, mapsUrl: (cur && cur.mapsUrl) || opts.mapsUrl || '', // 11.20.0: a place shared from Google Maps keeps its link
    gid: (cur ? cur.gid : gidClean(opts.gid)) || null, // 11.22.0 (place-gid-1): the Google id record - kept, relinked or unlinked here
    address: cur && !/^-?\d+\.\d+,/.test(cur.address || '') ? cur.address : '', desc: cur ? cur.description : (opts.desc || ''), transit: cur ? cur.transit : '', resv: cur ? cur.reservation : '', price: cur ? cur.price : '',
    region: cur ? (cur.region || '') : (opts.region || ''), scope: opts.tripOnly || (cur && cur.tripOnly) ? 'trip' : 'dest', key: !!(cur && cur.key),
    maybe: opts.maybe || [], noGuess: !!opts.noGuess, center: (opts.dest && DESTS[opts.dest] && DESTS[opts.dest].meta.center) || curDest().meta.center, /* 11.20.0 (Q9 (3)): a share opens at the trip's nearest destination */ src: opts.src || (cur && cur.src) || null, // 10.15.0 (F41): the source line
    layerOpts: () => { const sel = selDests(), order = [own, opts.dest, ...sel].filter((d, i, a) => d && a.indexOf(d) === i);
      return order.map(d => LAYER_DEFS.filter(l => l.dest === d && (!l.hidden || l.id === layer)).map(l => ({ v: l.id, l, group: withFlag(destFlag(d), destName(d)) }))).flat(); },
    regionsOf: v => destRegions(DESTS[v ? layerDef(+v).dest : curDest().id] || curDest()),
    newLayer: () => ({}),
    dup: F => { if (cur) return ''; const c = fmGet(F, 'loc'), sim = similarPlaces([fmGet(F, 'name'), fmGet(F, 'foreign')], id, c);
      return sim.length ? 'יש כבר במאגר: ' + sim.map(x => `<button type="button" class="pe-dupb" data-act="pe.dupOpen" data-v="${x.p.id}"><b>${escH(x.p.name)}</b>${peDupBy(x.p, x.by)}${x.m != null ? ` <small>(${x.m < 10 ? 'באותו מקום' : 'במרחק ' + fmtM(x.m)})</small>` : ''} ›</button>`).join(' ') : ''; } };
}
function peLayerText(C, v) { const x = C.layerOpts().find(o => String(o.v) === String(v)); if (!x) return 'בחירת שכבה';
  const multi = new Set(C.layerOpts().map(o => o.group)).size > 1;
  return `<span class="dd-dot" style="background:${x.l.color}"></span>${x.l.icon ? typeIcon(x.l.icon, { size: 18 }) : ''} ${escH(x.l.label || x.l.name)}${multi || C.kind === 'add' ? SEP + escH(x.group) : ''}${x.l.draftNew ? ' ' + claudeMark({ cls: 'cl-mark msi-in' }) : ''}`; } // 10.15.0: new from Claude - Claude's own mark
// big-dest-search: where the place being edited belongs - a place of mine by its layer's destination (a new one: the destination it opens at),
// a draft's by the draft's destination; its region as chosen in the form; its days in the open trip
function peWhere(C, F, opts) { const v = F.vals.layer, region = F.kinds.region ? F.vals.region : C.region;
  if (C.kind === 'place') { const did = v ? layerDef(+v).dest : opts.dest || curDest().id; return placeWhere({ id: C.id, dest: did, region }); }
  const did = C.kind === 'add' ? String(v || '').split('|')[0] : C.x && C.x.src, t = (C.ts || []).find(x => x.id === did), dp = (t && t.dp) || (C.x && C.x.dp) || DESTS[did];
  return dp ? placeWhere({ d: dp.meta ? dp : DESTS[did], region, t: null }) : null; }
function peRegionField(F, C, layerV) { const rs = C.regionsOf(layerV);
  if (!rs.length) { delete F.kinds.region; return `<div class="sh-field fm-f" data-fmw="region" hidden></div>`; }
  const cur0 = F.kinds.region ? F.vals.region : C.region, v = rs.some(r => r.id === cur0) ? cur0 : '';
  return fmChips(F, 'region', { label: 'אזור', value: v, options: [['', 'בלי אזור'], ...rs.map(r => [r.id, escH(r.name)])] }); }
function openPlaceEditor(opts) { layerNote(openPlaceEditor, arguments);
  opts = opts || {}; const C = peCtx(opts); if (!C) return;
  const F = fmNew({ C, opts }), cur = C.cur, sheet = document.getElementById('sheet');
  const scopeHint = v => { const d = DESTS[F.vals.layer ? layerDef(+F.vals.layer).dest : curDest().id] || curDest();
    return v === 'trip' ? 'נשמר רק בטיול הזה ועובר איתו כששולחים את הטיול. למשל מלון, אירוע חד-פעמי, דירה של חברים.' : `נשמר ביעד ${d.meta.name}, מופיע בכל טיול אליו ועובר עם קובץ היעד.`; };
  const regionName0 = () => { const r = C.regionsOf(F.vals.layer).find(x => x.id === fmGet(F, 'region')); return r ? r.name : ''; };
  const maybeHTML = () => !cur && C.noGuess && !F.vals.layer && (C.maybe || []).length ? `<div class="pe-maybe">אולי: ${C.maybe.map(v => { const x = C.layerOpts().find(o => String(o.v) === String(v)); return x ? `<button type="button" class="chip" data-act="pe.maybe" data-v="${escH(v)}">${ICON_EMOJI[x.l.icon] || ''} ${escH(x.l.label || x.l.name)}</button>` : ''; }).join('')}</div>` : '';
  sheet.innerHTML = `${fmHead(C.title)}
    ${C.hint ? `<p class="sh-hint">${C.hint}</p>` : ''}
    ${fmText(F, 'name', { label: 'שם', req: true, value: C.name, placeholder: 'שם המקום', dup: true, on: () => peDup(F) })}
    ${fmPick(F, 'layer', { label: 'שכבה', req: true, value: C.layer === '' ? '' : String(C.layer), text: v => peLayerText(C, v), open: peOpenLayers, on: v => { fmSwap(F, 'region', peRegionField(F, C, v)); const m = fmQ(F, '.pe-maybe'); if (m) m.remove(); peDup(F); } })}
    ${maybeHTML()}
    ${fmLoc(F, 'loc', { label: 'מיקום', req: true, value: C.coord, mapsUrl: C.mapsUrl, gid: C.kind === 'place' ? C.gid : undefined, center: C.center, noneText: cur ? 'המיקום לפי הכתובת' : 'עוד לא נבחר מיקום',
      where: F2 => peWhere(C, F2 || F, opts) /* big-dest-search (Q2): the chain of this place - its night, its region, its destination */,
      onPick: (r, F2) => { if (r.name && !fmGet(F2, 'name')) fmSet(F2, 'name', r.name); if (r.addr && !fmGet(F2, 'addr')) fmSet(F2, 'addr', r.addr); peDup(F2); }, nameOf: F2 => fmGet(F2, 'name'), on: () => peDup(F),
      ret: F2 => !F2 ? null : C.kind === 'place' ? { k: 'place', id: C.id, dest: opts.dest || null, tripOnly: !!opts.tripOnly, open: C.id == null ? peOpenKeep(opts) : undefined } /* 11.21.3 (form-keep-context): a new place with its whole opening */
        : { k: 'dplace', dat: C.D.at, key: C.key, add: C.key == null ? opts.draftAdd : null } /* 11.21.1 (form-keep-everywhere): a draft's place too - a fix or an addition of mine, by the draft's own time */ })}
    ${fmSec(F, 'det', { title: 'פרטים', sum: F2 => [fmGet(F2, 'foreign') && 'שם מקומי', fmGet(F2, 'addr') && 'כתובת', fmGet(F2, 'desc') && 'תיאור', fmGet(F2, 'transit') && 'איך מגיעים', C.kind === 'place' && cur && gidOf({ gid: F2.locs.loc.gid }) && 'גוגל מפות ✓'].filter(Boolean).join(', ') },
      (C.kind === 'place' && cur ? fmGidField(F, 'loc') : '') /* place-find (Q3): Google's identity is not "where" - its row lives here */ + fmText(F, 'foreign', { label: 'שם מקומי', value: C.foreign, dir: 'auto', placeholder: 'השם בשפת המקום' }) /* kit-fixes (item 4): the local name, under the name in the place's window */ + fmText(F, 'addr', { label: 'כתובת', value: C.address }) + fmText(F, 'desc', { label: 'תיאור', value: C.desc, para: true }) + fmText(F, 'transit', { label: 'איך מגיעים', value: C.transit }))}
    ${fmSec(F, 'book', { title: 'הזמנה ומחיר', sum: bpPlaceSum }, bpPlaceFields(F, C.resv, C.price, peDestOf(C, opts)) /* 11.42.0 (booking-price, Q2-Q3): the booking choice and its note, the price's kind, level or amount, and its note */)}
    ${fmSec(F, 'cls', { title: 'סיווג', sum: F2 => [regionName0() && escH(regionName0()), C.kind === 'place' && inTrip() && fmGet(F2, 'scope') === true && 'רק לטיול הזה' /* 10.4.0: a switch, off = in the destination */, C.kind === 'place' && fmGet(F2, 'key') && SYM_KEY].filter(Boolean).join(SEP) },
      `${peRegionField(F, C, C.layer)}${C.kind === 'place' && inTrip() ? fmToggle(F, 'scope', { label: 'רק לטיול הזה', value: C.scope === 'trip', hint: `<span id="peScopeHint">${escH(scopeHint(C.scope))}</span>`, on: v => { const h = fmQ(F, '#peScopeHint'); if (h) h.textContent = scopeHint(v ? 'trip' : 'dest'); } }) : ''}
      ${C.kind === 'place' ? fmToggle(F, 'key', { label: SYM_KEY + ' נקודת מפתח במסלול', value: C.key, hint: 'בולט במפת המסלול ובתמונת הטיול.' }) : ''}`)}
    ${C.src && C.src.url ? `<p class="sh-hint">מקור: <a href="${escH(C.src.url)}" target="_blank" rel="noopener">${srcLinkText(C.src)}</a></p>` : ''}
    ${fmEndActs([C.kind === 'fix' && C.reset && { act: 'pe.reset', label: 'חזרה למקור', ic: 'restart_alt' },
      C.kind === 'place' && cur && inTrip() && !activeTripObj().archived && { act: 'pe.toTravel', label: 'להפוך לנסיעה', ic: 'commute' }, // 11.0.0 (Q20a)
      C.kind === 'place' && cur && { act: 'pe.hide', label: 'הסתרה', ic: 'visibility_off' }, // 11.18.0 (place-hide-delete Q1): both, for every place
      C.kind === 'place' && cur && { act: 'pe.del', label: 'מחיקה', del: true },
      C.kind === 'add' && C.cur && { act: 'pe.draftDel', label: 'הסרה מהטיוטה', del: true }])}
    ${fmSaveBar({ act: 'pe.save', label: C.kind === 'add' && !C.cur ? '＋ לטיוטה' : 'שמירה' })}`;
  showSheetBackdrop('openPlaceEditor'); if (C.kind === 'place' && cur) winRef('place:' + cur.id);
  fmAttach(F); peDup(F); peNeedLayer(F);
  if (opts.sharedText) { const b = fmQ(F, '[data-fmlink="loc"]'); if (b) { b.hidden = false; fmQ(F, '[data-fmlinkt="loc"]').value = opts.sharedText; } fmLocLinkRead(F, 'loc', opts.sharedText, 'sharedRead' in opts ? opts.sharedRead : undefined, opts.share ? { onRead: r => psShareKnown(F, opts, r), known: rec => hasTrip() && !!gidPlaceOf(rec) } : undefined).then(() => { const G = fmLive(F); if (G && !cur) fmRestart(G); }); }
}
// form-keep-context (decisions 2026-11-16 · Review of the 11.21.1 summary, found 1): a new place's opening, kept with its stored form
// across Google Maps (PS_FORMS.place) - every option that changes what saving does or what the editor offers: afterSave (the day and slot of
// a day's "＋ מקום", a travel turned into a place by its id - tv), maybe (the suggestions of "מה יש כאן"), src, and coord / name / layer /
// desc / region / mapsUrl / dest / tripOnly / noGuess as given (the form's starting point - so it reopens unsaved, exactly as left). Only
// what can be stored: sharedText (a share being read) is not reopened. afterSave carries the trip it was given in (tid).
const PE_OPEN_KEEP = ['dest', 'tripOnly', 'noGuess', 'maybe', 'src', 'layer', 'name', 'coord', 'desc', 'region', 'mapsUrl', 'gid'];
function peOpenKeep(opts) { const o = {}; opts = opts || {};
  PE_OPEN_KEEP.forEach(k => { const v = opts[k]; if (v != null && v !== '' && v !== false && !(Array.isArray(v) && !v.length)) o[k] = JSON.parse(JSON.stringify(v)); });
  const a = opts.afterSave; if (a && a.day) o.afterSave = { day: a.day, slot: a.slot || 'unassigned', time: a.time || null, tv: a.tv != null ? a.tv : null, stop: a.stop != null ? a.stop : null, tid: STATE.activeTrip };
  return o; }
// the destination a place belongs to (11.42.0: its currency is the price's default)
function peDestOf(C, opts) { return C.kind === 'place' ? (C.cur ? C.cur.dest : (opts && opts.dest) || '') : C.kind === 'add' ? (C.a0 && C.a0.dest) || '' : (C.x && C.x.dp && C.x.dp.id) || ''; }
function fmSwap(F, id, html) { const w = fmW(F, id); if (!w) return; const t = document.createElement('div'); t.innerHTML = html; const n = t.firstElementChild; if (!n) return; w.replaceWith(n); fmFit(fmRoot(F)); }
// dup-both-names: a row found by the place's other name says that name after the one shown ("גבעת סנטה לוסיה · Cerro Santa Lucía")
function peDupBy(p, by) { return by && by !== p.name ? `<small class="pe-dupn">${SEP}<bdi>${escH(by)}</bdi></small>` : ''; }
function peDup(F) { const C = F.opts.C; if (C.dup) fmDup(F, 'name', C.dup(F)); F.dupOk = false; }
function peNeedLayer(F) { const C = F.opts.C, w = fmW(F, 'layer'); if (w) w.classList.toggle('pe-need', !!C.noGuess && !F.vals.layer); }
function peOpenLayers(F) { const C = F.opts.C, opts = C.layerOpts();
  openFmChoice({ title: 'שכבה', value: F.vals.layer, search: opts.length > 14, searchHint: 'חיפוש שכבה',
    options: opts.map(o => ({ v: o.v, group: o.group, text: (o.l.label || o.l.name) + ' ' + (o.l.name || ''), html: `<span class="dd-dot" style="background:${o.l.color}"></span>${o.l.icon ? typeIcon(o.l.icon, { size: 18 }) : ''} ${escH(o.l.name || o.l.label)}${o.l.draftNew ? ' ' + claudeMark({ cls: 'cl-mark msi-in' }) : ''}` })),
    foot: `<div class="brow export-actions"><button type="button" class="chip" data-act="pe.newLayer">＋ שכבה חדשה</button></div>` }, v => { const F2 = fmOf(); if (F2 && F2.kinds.layer) { fmSet(F2, 'layer', v); peNeedLayer(F2); } }); }
act('pe.maybe', c => { const F = fmOf(c.el); if (!F) return; fmSet(F, 'layer', c.v); peNeedLayer(F); return 'quiet'; });
// ＋ שכבה חדשה: the layer editor opens on top (from the list of layers); its new layer comes back chosen in the form under it
act('pe.newLayer', () => { const t = WIN_STACK[WIN_STACK.length - 2], F = t && t.form; if (!F || !F.opts.C) return; const C = F.opts.C; closeSheet();
  setTimeout(() => viaGroup('editors', 'openLayerEditor', null, { ...(C.newLayer ? C.newLayer(F.vals.layer) : {}), onNew: v => setTimeout(() => { const F2 = fmOf(); if (F2 && F2.kinds.layer) { fmSet(F2, 'layer', String(v)); peNeedLayer(F2); } }, 20) }), 10); return 'quiet'; });
act('pe.dupOpen', c => { const q = planItem(pid(c.v)); if (q) { closeSheet(); setTimeout(() => openPlaceSheet(q), 80); } return 'quiet'; });
act('pe.del', () => { const F = fmOf(); if (!F) return; const id = F.opts.C.id, p = POINTS.find(q => q.id === id), use = p && !p.tripOnly ? placeUseLine(id) : '';
  if (use) return askSure({ ic: 'delete', title: `למחוק את ${escH(placeLabel(p))}?`, text: `${escH(use)}. המקום יוצא מהם ועובר לסל ל-30 יום.`, ok: 'מחיקה' }, () => { layerCloseOwn(); deleteAddedPlace(id); }); // destination-view (Q3): the trips it touches
  layerCloseOwn(); deleteAddedPlace(id); });
// 8.1.0 (ב2, ב5): hiding asks a reason: three buttons (a tap hides) and "＋ הערה". The reason stays in the data (status / statusNote).
// 11.18.0 (place-hide-delete Q1, amends ב2): every place offers both - hide (it exists, not for us: 🙈, back from there) and delete (it
// should not have been here: the trash for 30 days). A trip-only place is hidden in its trip; any other is a destination mark.
act('pe.hide', () => { const F = fmOf(); if (!F) return; openHideReason(F.opts.C.id, layerDirty(layerTop())); return 'quiet'; });
function openHideReason(id, dirty) { layerNote(openHideReason, arguments); const p = POINTS.find(q => q.id === id); if (!p) return;
  const F = fmNew({ id }), sheet = document.getElementById('sheet');
  const use = p.tripOnly ? '' : placeUseLine(id); // destination-view (Q3): the trips that use it - a hide touches no plan
  sheet.innerHTML = `${fmHead(SY.hide + ' למה להסתיר?')}<p class="sh-hint"><b>${escH(p.name)}</b> לא יוצג ברשימות ובמפה. מחזירים מ-${msi('visibility_off', { cls: 'msi-in' })} מוסתרים בסוף רשימת המקומות.</p>${use ? `<p class="sh-hint hr-use">${escH(use)}. בתוכנית הוא נשאר, מסומן "מוסתר".</p>` : ''}
    ${dirty ? `<p class="sh-hint hr-dirty">${warnIc()} השינוי שלא נשמר בעורך לא יישמר.</p>` : ''}
    <div class="hr-list">${segHTML('hide.reason', HIDE_REASONS.map(r => [r, statusHTML(r)]), F.reason = 'skip')}</div>
    ${fmSec(F, 'note', { title: '＋ הערה', sum: F2 => escH(fmGet(F2, 'note') || '') }, fmText(F, 'note', { value: '', placeholder: 'למשל: נסגר לשיפוצים עד 2027' }))}
    <div class="brow sheet-actions sheet-save-bar"><button class="btn-nav" id="hrGo" data-act="hide.go">${msi('visibility_off', { size: 18 })} הסתרה</button></div>`; // 10.4.0 (design-4): the reason as a segmented choice, then "הסתרה"
  showSheetBackdrop('openHideReason'); fmAttach(F); }
act('hide.reason', c => { const F = fmOf(c.el); if (!F || !HIDE_REASONS.includes(c.v)) return; F.reason = c.v; c.el.parentElement.querySelectorAll('button').forEach(b => { const on = b.dataset.v === c.v; b.dataset.active = String(on); b.setAttribute('aria-pressed', String(on)); }); return 'quiet'; });
act('hide.go', c => { const F = fmOf(c.el); if (!F) return; hidePlace(F.opts.id, F.reason || 'skip', fmGet(F, 'note')); });
function hidePlace(id, s, note) { const p = POINTS.find(q => q.id === id); if (!p) return; layerCloseOwn();
  if (p.tripOnly) { const t = activeTripObj(); t.places = (t.places || []).map(x => x.id === id ? { ...x, status: s, statusNote: note || '' } : x); } // hidden in its trip (placeUnhide brings it back)
  else STATE.edits.status[id] = { s, note: note || '', at: Date.now(), who: STATE.settings.deviceName || '' };
  sgHandDrop(id, ['status']); // ai-fix-mine (Q6): my newer decision on its status wins over a suggestion about it
  rebuildPoints(); persist();
  showUndoToast(SY.hide + ' הוסתר: ' + p.name + SEP + 'מחזירים מ-' + SY.hide + ' מוסתרים'); }
act('pe.draftDel', () => { const F = fmOf(); if (!F) return; const key = F.opts.C.key; closeSheet(); removeDraftAdd(key); });
act('pe.reset', () => { const F = fmOf(); if (!F) return; const C = F.opts.C, D = C.D, key = C.key; delete D.fix[key]; saveDraft(); closeSheet();
  showUndoToast('חזר למקור: ' + C.x.p.name); });
act('pe.save', c => { const F = fmOf(c.el); if (!F) return; const C = F.opts.C, opts = F.opts.opts, cur = C.cur;
  const name = fmGet(F, 'name'), layerV = F.vals.layer, coord = fmGet(F, 'loc'), addr = fmGet(F, 'addr');
  if (!name) return fmFail(F, 'name', 'חסר שם');
  if (layerV === '' || layerV == null) return fmFail(F, 'layer', 'בוחרים שכבה');
  if (C.kind === 'place' && !coord && !(cur && cur.address) && !addr) return fmFail(F, 'loc', 'בחרו מיקום: חיפוש, המיקום שלי, קישור או מיקום על המפה');
  if (C.kind === 'add' && !coord && !addr) return fmFail(F, 'loc', 'צריך מיקום או כתובת');
  const bp = bpPlaceValues(F); if (bp.err) return fmFail(F, bp.err.id, bp.err.msg); // 11.42.0: an amount is a number with its currency
  const base = { name, description: fmGet(F, 'desc'), transit: fmGet(F, 'transit'), reservation: bp.reservation, price: bp.price };
  const foreign = fmGet(F, 'foreign'); if (foreign || C.foreign) base.foreign = foreign; // kit-fixes (item 4): written only when there is one (or it was cleared), so an edit of another field adds no empty field
  const region = F.kinds.region ? fmGet(F, 'region') : '';
  if (C.kind === 'fix') { // the draft's layer of fixes: only what differs from the file
    const D = C.D, key = C.key, x = C.x, base0 = x.scope === 'trip' ? (D.data.trip.places || []).find(q => 'trip:' + q.id === key) : (x.dp.places || []).find(q => x.dp.id + ':' + q.id === key);
    const next = { ...base, layer: Number(layerV), address: addr }; if (C.regionsOf().length) next.region = region || undefined;
    const bc = draftCoord(base0); if (coord && !(bc && bc.lat === coord.lat && bc.lng === coord.lng)) { next.manualCoord = { lat: +coord.lat.toFixed(6), lng: +coord.lng.toFixed(6) }; next.coordSource = 'תיקון ידני'; } else if (!coord && bc) next.manualCoord = null;
    const diff = {}; Object.entries(next).forEach(([k, v]) => { const b = base0[k] === undefined ? (['foreign', 'description', 'address', 'transit', 'reservation', 'price'].includes(k) ? '' : undefined) : base0[k]; if (JSON.stringify(v) !== JSON.stringify(b)) diff[k] = v; });
    if (diff.manualCoord && next.coordSource) diff.coordSource = next.coordSource; else delete diff.coordSource;
    sgDraftHand(D, key, next, x.p); // ai-fix-mine (Q6): a field I fixed by hand drops the AI's suggestion on it
    if (Object.keys(diff).length) D.fix[key] = diff; else delete D.fix[key];
    saveDraft(); closeSheet(); showUndoToast('תוקן: ' + name); return; }
  if (C.kind === 'add') { // an addition of mine to the draft
    const D = C.D, cur2 = C.cur, a0 = C.a0, [dest, lid] = String(layerV).split('|'), L0 = draftDestLayers(D, dest).find(l => String(l.id) === lid) || {};
    const layer = isNaN(Number(lid)) || lid.startsWith('nl:') ? lid : Number(lid), c0 = a0.manualCoord, moved = coord && c0 && (coord.lat !== c0.lat || coord.lng !== c0.lng);
    const a = { key: cur2 ? cur2.key : 'add:' + Date.now().toString(36), dest, inst: !!(C.ts.find(t => t.id === dest) || {}).inst, layer, ...base, address: addr, icon: L0.icon || 'tourist_attraction', at: cur2 ? cur2.at : Date.now() };
    if (coord) { a.manualCoord = { lat: +coord.lat.toFixed(6), lng: +coord.lng.toFixed(6) }; a.coordSource = moved || !c0 ? (c0 ? 'תיקון ידני' : (a0.coordSource || 'תיקון ידני')) : (a0.coordSource || 'תיקון ידני'); }
    if (region) a.region = region; if (a0.src) a.src = a0.src; if (a0.ty) a.ty = a0.ty;
    D.add = cur2 ? D.add.map(x => x.key === cur2.key ? a : x) : D.add.concat(a); delete D.off[a.key];
    saveDraft(); closeSheet(); showUndoToast((cur2 ? 'נערך בטיוטה: ' : 'נוסף לטיוטה: ') + name); return; }
  // a place of mine / of the destination
  if (!cur && !F.dupOk && similarPlaces([name, foreign], C.id, coord).length) { peDup(F); F.dupOk = true; return fmFailLine(F, 'נראה שהמקום כבר במאגר (למעלה, נגיעה פותחת אותו). לשמור בכל זאת? לוחצים שוב על שמירה'); }
  const layer = +layerV, data = { ...base, layer }; if (region || (cur && cur.region)) data.region = region;
  data.address = addr || (coord ? `${coord.lat.toFixed(6)},${coord.lng.toFixed(6)}` : (cur ? cur.address : ''));
  const moved = coord && (!cur || !cur.manualCoord || cur.manualCoord.lat !== coord.lat || cur.manualCoord.lng !== coord.lng);
  if (coord && (moved || !cur || addr !== (cur && cur.address))) data.manualCoord = { lat: +coord.lat.toFixed(6), lng: +coord.lng.toFixed(6) };
  else if (cur && cur.manualCoord) data.manualCoord = cur.manualCoord;
  const url = F.locs.loc.url; if (url) data.mapsUrl = url;
  const g = F.locs.loc.gid; if (g && JSON.stringify(g) !== JSON.stringify((cur && cur.gid) || null)) data.gid = g; // 11.22.0: a new id, a relink or an unlink
  else if (cur && cur.gid) data.gid = cur.gid; // 11.23.0: kept as it is (a destination's place: the edit is rebuilt from the form, so its record would be lost)
  if (cur && data.gid === cur.gid && gidAfterMove(cur, coord)) { const b = !cur.tripOnly && BASE_PLACES.find(x => x.id === C.id); data.gid = b && b.gid ? null : undefined; } // 11.23.0 (place-gid-2, Q5 (2)): moved more than 150 m - an id the app found goes and is looked up again
  const keyOn = !!fmGet(F, 'key'); if (keyOn !== !!(cur && cur.key) || keyOn) data.key = keyOn; // 5.2.0
  if (!cur && opts.src) data.src = opts.src; // 4.25.0: where a discovery came from (Wikipedia / OpenStreetMap)
  if (!cur) { data.icon = layerDef(layer).icon; data.dest = layerDef(layer).dest || curDest().id; }
  const sv = c.el; sv.disabled = true; sv.textContent = 'שומר…'; closeSheet();
  const aft0 = !cur && opts.afterSave && hasTrip() && dayByKey(opts.afterSave.day) ? opts.afterSave : null; // 4.23.0: from ＋ מקום
  // form-keep-context: a travel turned into a place is named by its id (tv) - what its saving does is found now (tvToPlaceThen), also after Google Maps
  const aft = aft0 && aft0.tv != null ? { ...aft0, ...(tvToPlaceThen(aft0.tv) || {}) } : aft0;
  // undo-history: from ＋ מקום the place and its day are one action - one toast, one row (the save's own toast is held back)
  const save = () => saveEditedPlace(C.id, data, cur && isGoneStatus(cur.status) ? { s: cur.status, note: cur.statusNote || '' } : undefined, inTrip() ? (F.kinds.scope ? (fmGet(F, 'scope') ? 'trip' : 'dest') : C.scope) : undefined); // destination-view: a place saved in the destination
  const nid = aft ? undoHold(save) : save();
  if (aft && aft.stop != null) { if (nid != null) { travelStopAdd(aft.stop, { name: data.name, loc: { pid: nid } }); persist(); } // along-drive: from a drive's "לאורך הדרך" - a stop of that drive, not a card of the day
    showUndoToast(`＋ עצירה בדרך: ${data.name}`); }
  else if (aft) { if (nid != null) { addAtPartEnd(aft.day, aft.slot, nid); if (aft.time) { STATE.times[timeKey(aft.day, nid)] = aft.time; placeTimed(aft.day, nid); } if (aft.then) aft.then(nid); persist(); } // 11.0.0: a travel turned into a place (aft.then removes it)
    showUndoToast(aft.msg ? aft.msg(data.name) : nid != null ? `＋ מקום חדש נוסף ל-${dayByKey(aft.day).label}: ${data.name}` : '＋ נוסף מקום: ' + data.name); }
});

// ================= INCOMING CONTENT: THE DRAFT'S SCREEN, ITS WINDOWS AND ITS APPROVAL (the AI group; the draft model and its banner: js/draft-model.js) =================
const SOURCE_LABEL = { share: 'שותף לאפליקציה', file: 'מקובץ', paste: 'מהדבקה', launch: 'נפתח מקובץ' };
function startDraft(data, source) {
  const had = DRAFT && DRAFT.data ? draftTitle(DRAFT) : '';
  draftPut({ at: Date.now(), source: source || 'file', data: JSON.parse(JSON.stringify(data)), off: {}, fix: {}, personal: true, add: [], addLayers: [] });
  draftItems(DRAFT).forEach(x => { if (x.dupOf && !x.locked) DRAFT.off[x.key] = 1; }); // 11.22.0 (Q9 (3)): a place already on the phone is not added
  draftViewPut({ sel: null, status: 'full' }); FILTER.draft = { srcs: new Set(), layers: new Set(), changed: false, notes: false };
  saveDraft(); closeSheet(); FP.q = ''; goTab('draft');
  // undo-history: a draft that arrives is a row of its own (its undo drops it, and brings back a draft it replaced)
  showUndoToast('📥 התקבלה טיוטה' + (had ? SEP + 'הטיוטה הקודמת (' + had + ') הוחלפה' : ''));
}
function renderDraftScreen() {
  const main = document.getElementById('main');
  if (!DRAFT) { main.innerHTML = `<div class="section-head"><h2>📥 טיוטה</h2></div><div class="callout">אין טיוטה פתוחה. קובץ שמגיע מוצג כאן לפני שהוא נכנס.</div>`; return; }
  const D = DRAFT, d = D.data, esc = escH;
  const all = draftItems(D), srcs = draftSources(D);
  const { chips: layerChips, count: dCount } = draftLayerChips(D, all);
  const shown = draftShown(D, all);
  const dMode = getViewMode('draft');
  const onAll = all.filter(x => !D.off[x.key]).length, onShown = shown.filter(x => !D.off[x.key]).length;
  // 10.3.0 (design-3, look.md "Full screens, part 1"): the draft is an entrance - a hero (the source, the name, dates · destinations),
  // a card of stat tiles, the new destinations, the improvement round; a pinned bottom bar holds list / map and "אישור הכל · N"
  const tile = (n, l) => `<div class="dr-tile"><b>${n}</b><small>${l}</small></div>`;
  let hero, tiles, sum = '';
  if (d.kind === 'destination') { const dp = d.destination, m = dp.meta || {};
    hero = `<h2 class="display">יעד חדש: ${sepTie(esc(m.name))}</h2><p>${withFlag(destFlagMeta(m), esc(m.description || ''))}</p>`;
    tiles = tile((dp.places || []).length, 'מקומות') + tile((m.layers || []).length, 'שכבות') + ((m.regions || []).length ? tile(m.regions.length, 'אזורים') : '') + tile(infoSectionCount(dp.info), 'סעיפי מידע') + (m.currency ? tile(esc(m.currency.code), 'מטבע') : '');
  } else { const t = d.trip, nd = draftNewDests(D), od = draftOldDests(D), days = t.start ? dayList(t.start, t.end).length : (daysFromFileFields(t), tripLen(t));
    const segs = (t.segments || []).map(s => s.dest).filter((v, i, a) => a.indexOf(v) === i).map(id => draftDestById(D, id) || { meta: { name: id } });
    hero = `<h2 class="display">טיול חדש: ${sepTie(esc(t.name))}</h2><p>${t.start ? `${tmFmt('range', [t.start, t.end], { year: true })}` : 'בלי תאריכים'}${SEP}${days} ימים${segs.length ? SEP + segs.map(x => esc(x.meta.name)).join(' ← ') + ' ' + segs.map(x => destFlagMeta(x.meta || {})).join('') : ''}</p>`;
    tiles = tile(all.length, 'מקומות') + `<button type="button" class="dr-tile dr-tile-btn" data-act="draft.travels"><b>${travelsOf(draftTravelTrip() || t).length}</b><small>${TX.travels}</small>${msi('expand_more', { size: 16 })}</button>` + tile((t.lodging || []).length, 'לינות') + ((t.schedule || []).length ? tile(t.schedule.length, 'ב' + TX.group) : ''); // 11.0.0 (Q21): the travels list; 11.5.0: the chevron under the word (review of 11.3.0, Q3), and the two tiles after it are back (a comment had swallowed them since 11.0.0)
    sum = `${nd.length ? `<p class="dr-line">${nd.length === 1 ? 'יעד חדש' : nd.length + ' יעדים חדשים'}: ${nd.map(dp => `<b>${esc(dp.meta.name)}</b> (${(dp.places || []).length} מקומות, ${infoSectionCount(dp.info)} סעיפי מידע)`).join(SEP)}</p>` : ''}
      ${od.length ? `<p class="sh-hint">כבר בטלפון ולא מוחלפים: ${od.map(dp => esc(DESTS[dp.id].meta.name)).join(SEP)}</p>` : ''}
      ${d.personal ? `<label class="bk-part">${fmCheck({ id: 'drPersonal', act: 'draft.drPersonal', checked: D.personal })} לצרף גם: ${[d.personal.itinerary ? 'תוכנית' : '', d.personal.favorites ? 'מועדפים' : '', d.personal.visited ? 'ביקורים' : ''].filter(Boolean).join(', ')}</label>` : ''}`;
  }
  if (draftAdds(D).length) sum += `<p class="dr-line">${msi('library_add', { size: 18 })} ${draftAdds(D).length} נוספו על ידיך</p>`; // 4.26.0
  sum += draftRoundHTML(D); // 4.27.0
  let html = `<div class="section-head dr-head"><h2>טיוטה${SEP}${esc(draftTitle(D))}</h2></div><div class="dr-hero"><p class="dr-src">${msi('download', { size: 16 })}${SOURCE_LABEL[D.source] || ''}${d.signature ? SEP + esc(d.signature) : ''}</p>${fileDroppedHTML(d._dropped)}${hero}</div>
    <div class="card draft-sum"><div class="dr-tiles">${tiles}</div>${draftFromClaude(d) ? `<p class="sh-hint dr-wrong">${tipText('wrong.draft')}</p>${kitBehind(d.kitVersion) ? `<p class="sh-hint dr-oldkit">הקובץ נכתב לפי הוראות ישנות. כדאי לעדכן את הסקיל. <button type="button" class="pw-link" data-act="kit.install">לעדכון</button></p>` : ''}` : ''}${draftPropHTML(D)}${sum}</div>`;
  if (all.length) {
    // 5.14.0 (ד7): the same header as the places - the layers in one row, then [source ▾] [funnel · N] … "N מקומות · ✕"
    html += '<div id="draftFilter">';
    if (layerChips.length > 1) html += layerChipsHTML('draftLayers', layerChips, FILTER.draft.layers, dCount);
    html += `<div class="fbar fhead">${srcs.length > 1 ? fpickHTML('srcs', draftSrcLabel(srcs), FILTER.draft.srcs.size) : ''}${funnelHTML(filterHiddenCount('draft'))}${countHTML(shown.length + ' ' + TX.places, String(shown.length), draftFilterActive())}</div>`;
    html += `<div class="draft-bar"><span>נבחרו <b>${onShown}</b> מתוך ${shown.length}${shown.length !== all.length ? ` (בסך הכל ${onAll} מתוך ${all.length})` : ''}</span><span class="brow tight draft-bar-btns"><button class="icon-btn btn-copy" id="drAllOn" data-act="draft.drAllOn">✓ סימון הכל</button><button class="icon-btn btn-copy" id="drAllOff" data-act="draft.drAllOff">ניקוי</button></span></div></div>`;
    if (MAP_AVAILABLE && dMode === 'map') {
      html += `<div class="map-container" id="draftMap"></div>`;
    } else {
      let lastL = null;
      if (!shown.length && selNone(FILTER.draft.layers)) html += emptyHTML(msi('layers_clear'), 'בוחרים שכבה למעלה, או "הכל".', '', 'כל השכבות כבויות');
      else if (!shown.length && (FILTER.draft.changed || FILTER.draft.notes)) html += emptyHTML(msi('filter_alt_off'), `הסינון: ${FILTER.draft.changed ? claudeMark() + ' השתנה בסבב' : msi('chat', { cls: 'msi-in' }) + ' עם הערה'}.`, '', 'אין מקומות מתאימים');
      const lOrd = new Map(); shown.forEach(x => { if (!lOrd.has(x.L.name)) lOrd.set(x.L.name, lOrd.size); }); // 4.26.0: additions join their layer
      html += `<div class="draft-list">` + shown.slice().sort((a, b) => lOrd.get(a.L.name) - lOrd.get(b.L.name)).map(x => { const head = x.L.name !== lastL ? `<div class="draft-lhead"><span class="dd-dot" style="background:${x.L.color}"></span> ${esc(x.L.name)}${srcs.length > 1 && !draftView.src ? `${SEP}<small>${esc(x.src === 'trip' ? 'הטיול' : (x.dp && x.dp.meta ? x.dp.meta.name : ''))}</small>` : ''}</div>` : ''; lastL = x.L.name;
        return head + draftCardHTML(x, D, true); }).join('') + `</div>`;
    }
  } else html += `<div class="callout">אין בקובץ מקומות חדשים לבדוק${d.kind === 'trip' ? ' (היעדים של הטיול כבר בטלפון)' : ''}.</div>`;
  { const more = draftMoreHTML(D); if (more) html += `<div class="accordion" style="margin-top:10px">${more}</div>`; } // 4.27.0
  if (D.round) html += `<div class="callout" id="drRoundAsk" hidden><b>יש סבב שיפורים אצל ה-${AI} (סבב ${D.round.n}).</b> לאשר עכשיו ולקלוט את השיפורים כעדכון כשיחזרו, או לחכות?<br><small>אם מאשרים עכשיו: הקובץ שיחזור ייקלט כעדכון רגיל של ${d.kind === 'trip' ? 'הטיול' : 'היעד'}, התשובות להערות והמלצות ההורדה יוצגו בחלון כשהוא נקלט, ומה שאישרתם (הורדות ותיקונים) לא יידרס.</small>${cardActionsHTML({ id: 'drOkAnyway', act: 'draft.drOkAnyway', label: '✓ לאשר עכשיו' }, [{ id: 'drWait', act: 'draft.drWait', label: `${msi('hourglass_top', { size: 18 })} לחכות לסבב` }])}</div>`;
  html += `<div class="brow draft-actions"><button type="button" class="btn-sec" id="drDrop" data-act="draft.drDrop">${msi('delete', { size: 18 })} לוותר על הייבוא</button></div>`;
  html += `<div class="dr-dock">${MAP_AVAILABLE && all.length ? `<div class="view-toggle seg" role="group">${[['list', 'view_agenda', 'רשימה'], ['map', 'map', 'מפה']].map(([v, ic, w]) => `<button type="button" data-act="draft.drView" data-v="${v}" data-active="${v === dMode}" aria-pressed="${v === dMode}" aria-label="${w}">${msi(ic, { size: 18 })}<span class="vt-l">${w}</span></button>`).join('')}</div>` : ''}<button class="btn-nav draft-ok" id="drOk" data-act="draft.drOk">${msi('done_all', { size: 18 })}${draftOkLabel(onAll, all.length)}</button></div>`; // the pinned bottom bar (no floating list ⇄ map button)
  main.innerHTML = html;
  { const e = screenTop(), tools = e && e.tab === 'draft' && e.el.querySelector('.screen-tools'); // the head after scrolling: ⓘ and the improvement round as Claude's icon button
    if (tools) tools.innerHTML = `${tipI('draft.what')}<button type="button" class="top-ic dr-cl" data-act="draft.drRound" aria-label="${escH(TX.claude.round.btn)}" title="${escH(TX.claude.round.btn)}">${claudeMark({ size: 22 })}</button>`; }
  draftScreenCtl(shown, layerChips);
  if (MAP_AVAILABLE && dMode === 'map' && all.length) renderDraftMap(shown.concat(all.filter(x => x.locked && !shown.includes(x) && selOn(FILTER.draft.srcs, x.src)))); // 4.45.0: hotels stay through layer filters (as on every map) but follow the destination chips
}
// 9.1.1 (12ג-1): a draft place's notes line, once - for its row (with 📌 when it has a place) and its map card
function draftNotes(x, pin) { const p = x.p, reg = x.dp && p.region ? ((x.dp.meta.regions || []).find(r => r.id === p.region) || {}).name : '';
  return [reg ? escH(reg) : '', draftCoord(p) && pin ? msi('push_pin', { cls: 'msi-in', fill: true }) : ''].filter(Boolean).join(SEP); }
// 10.8.0 (design-icons, gap 21): the draft place's marks as the card's tags with line icons (no emoji)
function draftTags(x) { const p = x.p, t = (ic, s, c) => `<span class="tl-tag${c ? ' ' + c : ''}">${tagIc(ic)}${s}</span>`;
  return [x.dupOf ? t('content_copy', 'כבר קיים') : '', x.added ? t('auto_stories', 'נוסף על ידיך', 'upd') : '', !draftCoord(p) && !p.address ? t('warning', 'בלי מיקום', 'must') : '', x.fixed ? t('edit', 'תוקן', 'mine') : '', x.locked ? t('hotel', 'לינה') : '', x.scope === 'trip' ? t('luggage', 'רק בטיול') : ''].filter(Boolean); }
// 10.3.0 (design-3): one draft card for the list and the map - "להשאיר" as the top-left toggle (where "היינו" sits). In the list a tap
// opens the place's window (fix and a note for Claude are there); on the map fix and the note are icons in the actions row
function draftCardHTML(x, D, list) {
  const esc = escH, p = x.p, on = !D.off[x.key];
  return cdCard({ cls: list ? 'mc-card draft-row' : '', attrs: list ? ` data-off="${!on}"` : '', body: list ? ` data-act="draft.drinfo" data-drinfo="${esc(x.key)}"` : '',
    lead: leadHTML('place', typeIcon(p.icon || x.L.icon, { size: 18 }), x.L.color), name: esc(p.name), tags: [cdMeta([esc(x.L.label || x.L.name || ''), draftNotes(x, list)]), ...draftTags(x)],
    desc: `${p.description ? `<span class="mc-desc">${esc(String(p.description))}</span>` : ''}${list ? roundMarksHTML(D, x) + notePreviewHTML(itemTarget(x)) : ''}`,
    vis: `<label class="tl-keep">${fmCheck({ act: 'draft.drk', data: `data-drk="${esc(x.key)}"`, checked: on, disabled: x.locked })}${msi('check_circle', { size: 22 })}<span>להשאיר</span></label>`,
    acts: list ? '' : `<div class="tl-acts mc-acts"><button type="button" class="tl-act" data-act="draft.drfix" data-drfix="${esc(x.key)}" title="תיקון" aria-label="תיקון">${actIc('edit')}</button>${noteBtnHTML(itemTarget(x), p.name).replace('class="note-btn', 'class="tl-act note-btn')}</div>` });
}
// undo-history: every keep / take-out is a row (one place too - a change without a row would land in the next one)
function draftToggle(keys, on) {
  if (!keys.length) return; keys.forEach(k => { if (on) delete DRAFT.off[k]; else DRAFT.off[k] = 1; }); saveDraft();
  const x = keys.length === 1 && draftItems(DRAFT).find(i => i.key === keys[0]);
  showUndoToast(keys.length > 1 ? (on ? 'סומנו ' + keys.length : 'הורדו ' + keys.length) : (on ? 'נשאר: ' : 'הורד: ') + (x ? x.p.name : 'מקום'));
}
function draftScreenCtl(shown, layerChips) { const ctl = ctlNS('draft');
  const main = document.getElementById('main');
  wireLayerChips(document.getElementById('draftLayers'));
  ctl.drk = c => { draftToggle([c.dataset.drk], c.checked);
    const row = c.closest('.draft-row'); if (row) row.dataset.off = String(!c.checked); renderDraftCounts(); };
  ctl.drfix = b => openPlaceEditor({ draftKey: b.dataset.drfix });
  ctl.drinfo = b => openDraftPlaceSheet(b.dataset.drinfo); // 5.3.0 (a control inside the row wins - the mechanism's rule)
  const g = id => document.getElementById(id);
  if (g('drAllOn')) ctl.drAllOn = () => draftToggle(shown.filter(x => !x.locked).map(x => x.key), true);
  if (g('drAllOff')) ctl.drAllOff = () => draftToggle(shown.filter(x => !x.locked).map(x => x.key), false);
  ctl.drPersonal = b => { DRAFT.personal = b.checked; saveDraft(); showUndoToast(b.checked ? 'הנתונים האישיים יצורפו' : 'הנתונים האישיים לא יצורפו'); return 'quiet'; }; // undo-history: a row
  ctl.drOk = b => { if (DRAFT.round && g('drRoundAsk')) { g('drRoundAsk').hidden = false; reveal(g('drRoundAsk')); return 'quiet'; } // 4.27.0: a round is out
    b.disabled = true; b.textContent = 'שומר…'; approveDraft(); };
  ctl.drView = b => { const v = b.dataset.v, L = (screenTop() || {}).el; if (v === getViewMode('draft')) return 'quiet'; if (v === 'map' && L) _listY.draft = L.scrollTop; setViewMode('draft', v); try { delete draftView.view; } catch (e) {}
    if (v === 'list' && _listY.draft && L) setTimeout(() => { L.scrollTop = _listY.draft; }, 0); return 'redraw'; }; // the list comes back where it was left // 10.3.0: the segmented control replaces #viewFab
  ctl.drOkAnyway = b => { b.disabled = true; b.textContent = 'שומר…'; approveDraft('בזמן סבב פתוח'); }; // undo-history: one row - the approval's
  if (g('drWait')) ctl.drWait = () => { g('drRoundAsk').hidden = true; };
  if (g('drRound')) ctl.drRound = () => openRoundSheet();
  ctl.drRoundStop = () => askSure({ ic: 'schedule', title: `לא לחכות לסבב ${DRAFT.round.n}?`, text: 'קובץ שיחזור ממנו עדיין ימוזג.', ok: 'לא מחכים', fill: true }, () => {
    const prev = DRAFT.round; delete DRAFT.round; saveDraft(); showUndoToast('לא מחכים לסבב ' + prev.n + '. קובץ שיחזור ממנו עדיין ימוזג'); });
  ctl.drDrop = () => askSure({ ic: 'delete', title: 'לזרוק את הטיוטה?', text: 'שום דבר ממנה לא ייכנס.', ok: 'זריקת הטיוטה' }, () => {
    draftPut(null); saveDraft(); goTab(hasTrip() ? 'trips' : 'info');
    showUndoToast(SY.del + ' הטיוטה נזרקה, שום דבר לא נכנס'); // undo-history: one row (the log names the draft: "בטיוטה של …")
  });
}
ctlActs('draft', ['drinfo', 'drPersonal', 'drOk', 'drOkAnyway', 'drDrop', 'drAllOff', 'drAllOn', 'drView', 'drRound', 'drRoundStop', 'drWait', 'drfix', 'drk']);
const draftOkLabel = (on, n) => on === n ? `אישור הכל${SEP}${n}` : `אישור${SEP}${on} מתוך ${n}`;
function renderDraftCounts() { // keeps the scroll position: counts and the approve label only
  const all = draftItems(DRAFT), on = all.filter(x => !DRAFT.off[x.key]).length, ok = document.getElementById('drOk');
  if (ok) ok.innerHTML = msi('done_all', { size: 18 }) + draftOkLabel(on, all.length);
  const bar = document.querySelector('.draft-bar > span'); if (bar) { const shown = [...document.querySelectorAll('[data-drk]')], n = shown.filter(c => c.checked).length;
    bar.innerHTML = `נבחרו <b>${n}</b> מתוך ${shown.length}${shown.length !== all.length ? ` (בסך הכל ${on} מתוך ${all.length})` : ''}`; }
}
function renderDraftMap(shown) { const ctl = ctlNS('draftMap');
  const el = document.getElementById('draftMap'); if (!el) return;
  const dp0 = draftNewDests(DRAFT)[0] || draftDestById(DRAFT, (DRAFT.data.trip && (DRAFT.data.trip.segments || [])[0] || {}).dest);
  // 5.9.0: the one map component - ◎ and the same base as every map (the draft keeps its own status and view memory)
  const M = mapMake('draftMap', { loading: false, restore: null, track: false, clusters: true, center: (dp0 && dp0.meta && dp0.meta.center) || NO_DEST.meta.center, zoom: 12 });
  if (!M) return; const map = M.map; MAPS.draftMap.selId = draftView.sel;
  // 4.3.1: a change in the draft (a check, a chip, a fix) keeps the map where it was
  const keepView = draftView.view && draftView.view.key === DRAFT.at; if (keepView) map.setView(draftView.view.c, draftView.view.z);
  map.on('moveend', () => { const c = map.getCenter(); draftView.view = { key: DRAFT.at, c: [c.lat, c.lng], z: map.getZoom() }; });
  const bounds = []; let onMap = 0, pending = 0, unanswered = 0, fitted = false;
  // 4.2.2: places without a fixed point are found by address (one at a time, saved for later) and join the map as they arrive
  // 4.3.2: the status is full while places are still being found; once done it folds after a few seconds into a small
  // pill (tap opens it again, ✕ hides it for this draft). Refreshes of the draft keep the folded state.
  const status = document.createElement('div'); status.className = 'draft-map-status'; el.appendChild(status);
  // 7.1.0 (ש10): the one status line while places are being found (its explanation - "once, kept" - on a tap); gone when all are on
  // the map; places left without a location stay as one line with ✕ (a content matter: ✏️ to fix)
  const showStatus = () => {
    const missing = shown.length - onMap, st = draftView.status || 'full';
    if ((!pending && !missing) || (!pending && st === 'hidden')) { status.hidden = true; status.innerHTML = ''; return; }
    status.hidden = false; status.dataset.folded = 'false';
    status.innerHTML = pending ? svcLine('draftSt', 'geocode', onMap, shown.length, null, { gaveUp: svcGaveUpCount('geocode') })
      : `<span>${msi('map', { size: 16, cls: 'msi-in' })} <bdi>${onMap}</bdi> מתוך <bdi>${shown.length}</bdi> על המפה${SEP}<bdi>${missing}</bdi> בלי מיקום (${msi('edit', { size: 16, cls: 'msi-in' })} לתיקון)</span><button type="button" class="dms-x" data-act="draftMap.statusX" aria-label="הסתרה">✕</button>`;
  };
  if (status.closest('.leaflet-container')) mapCtl(status);
  ctl.statusX = () => { draftView.status = 'hidden'; showStatus(); return 'quiet'; };
  const hs = hotelSettings();
  const openCard = x => { draftView.sel = x.key; openFloatCard('draftMap', draftCardHTML(x, DRAFT, false), null, () => { draftView.sel = null; markSelected('draftMap', null); }, () => openDraftPlaceSheet(x.key)); markSelected('draftMap', x.key); };
  draftView.openCard = openCard; // 4.26.0: "✓ בטיוטה" in the 📚 list opens the draft's own card
  const addPin = (x, c) => { const on = !DRAFT.off[x.key];
    // 4.3.0: the trip's lodging stands out in the draft too (a draft trip hasn't started, so every hotel)
    const icon = x.locked ? hotelIcon(hs.size) : L.divIcon({ className: 'draft-pin', html: `<span style="background:${on ? x.L.color : 'var(--muted)'};opacity:${on ? 1 : .55}">${typeIcon(x.p.icon || x.L.icon)}</span>`, iconSize: [26, 26], iconAnchor: [13, 13] });
    const mk = L.marker([c.lat, c.lng], { icon, zIndexOffset: x.locked && hs.top ? 1500 : 0 }).addTo(map); mk.on('click', () => pinTap('draftMap', x.key) || openCard(x)); regMarker('draftMap', x.key, mk);
    if (draftView.sel === x.key) openCard(x);
    bounds.push([c.lat, c.lng]); onMap++; };
  shown.forEach(x => { const c = draftCoord(x.p); if (c) { addPin(x, c); return; }
    if (!x.p.address || x.p.address in GEOCODE_CACHE) return; pending++;
    queueGeocode(x.p.address, coord => { if (x.p.address in GEOCODE_CACHE) pending--; else unanswered++; if (!document.getElementById('draftMap-leaflet') || el.dataset.gen !== gen) return; // 7.1.0: no answer stays waiting
      if (coord) { addPin(x, coord); if (!keepView && (!fitted || bounds.length < 4)) map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 }); }
      showStatus(); }, draftCenterOf(x), x.p.name); });
  const gen = el.dataset.gen = String(Date.now());
  if (keepView) { fitted = true; // 4.38.1: a kept view where none of the shown points is visible (moved away, zoomed in elsewhere) fits them again
    try { const vb = map.getBounds(); if (bounds.length && !bounds.some(b => vb.contains(b))) map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 }); } catch (e) {} }
  else if (bounds.length) { map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 }); fitted = true; }
  showStatus();
}
ctlActs('draftMap', ['statusX']);
// the full draft place: everything that came with it, with the same keep and fix actions
// 5.7.0 (stage 4): a place in the draft opens the one details window, as a candidate - "✓ להשאיר" instead of the scheduling
// line; ✏️ (תיקון לפני אישור, full screen), 🧭, 🔍 and 💬 a note for Claude; removing a place you added is the red row at the end
function openDraftPlaceSheet(key) {
  const x0 = draftItems(DRAFT).find(i => i.key === key); if (!x0) return;
  const esc = escH, row = (k, v) => v ? `<div class="iw-row"><b>${k}</b> ${v}</div>` : '';
  openCandWin({ key: 'draft:' + key, get x() { return draftItems(DRAFT).find(i => i.key === key) || x0; },
    get lead() { const x = this.x; return leadHTML('place', typeIcon(x.p.icon || x.L.icon, { size: 18 }), x.L.color); }, get name() { return this.x.p.name; },
    get pick() { const x = this.x, on = !DRAFT.off[x.key]; return { label: on ? '✓ נשאר בטיוטה' : '＋ להשאיר', active: on, disabled: !!x.locked, on: () => { draftToggle([x.key], !!DRAFT.off[x.key]); winRedraw(); } }; },
    get small() { const x = this.x, p = x.p, reg = x.dp && p.region ? ((x.dp.meta.regions || []).find(r => r.id === p.region) || {}).name : '';
      return [`<span class="layer-tag" style="--lc:${x.L.color}">${esc(x.L.name)}</span>`, reg ? esc(reg) : '', ...draftTags(x)]; },
    get nav() { const c = draftCoord(this.x.p); return c ? navUrl(c.lat + ',' + c.lng) : (this.x.p.address ? navUrl(this.x.p.address) : ''); },
    get search() { const p = this.x.p; return googleInfoUrl(p.name, p.address); }, searchLabel: 'שעות, אתר וביקורות ב-Google',
    edit: () => openPlaceEditor({ draftKey: key }), get note() { const x = this.x; return noteBtnHTML(itemTarget(x), x.p.name); },
    what() { const x = this.x, p = x.p; return `${p.description ? `<p class="iw-desc open">${esc(p.description)}</p>` : ''}${roundMarksHTML(DRAFT, x)}${notePreviewHTML(itemTarget(x))}${row('כתובת:', esc(p.address))}${row('איך מגיעים:', esc(p.transit))}${row('הזמנה:', esc(resvText(p.reservation)))}${row('מחיר:', esc(fmtPrice(p.price, { note: true })))}${row('מקור:', esc(p.source))}${x.added && p.src && p.src.url ? row('מקור:', `<a href="${esc(p.src.url)}" target="_blank" rel="noopener">${srcLinkText(p.src)}</a>`) : ''}${(() => { const g = geoLocState(p, !!draftCoord(p)); if (g.k === 'search') geoLocHook(this, p); return g.k ? row('מיקום:', g.html) : ''; })()}`; }, // 11.14.0 (P4): searching / no network / not found, told apart
    get geoCenter() { return draftCenterOf(this.x); },
    get del() { return this.x.added ? { label: 'מחיקה מהטיוטה', on: () => { closeSheet(); removeDraftAdd(key); } } : null; } });
}
// 6.1.0: the card's ✓ and ✏️ are the draft screen's own actions (draft.drk, draft.drfix)
// fixing a place before approval: the fields that matter for finding it - name, layer, region, address, point, description
// what the draft did to a new destination, as statuses/edits of this device (ids of this device: idBase + local id)
function applyDraftToDest(D, dp) {
  const d = DESTS[dp.id]; if (!d) return 0; const who = STATE.settings.deviceName || '', at = Date.now(); let n = 0;
  (dp.places || []).forEach(p => { const key = dp.id + ':' + p.id, gid = d.idBase + p.id;
    if (D.off[key]) { STATE.edits.status[gid] = { s: 'skip', note: 'הורד בטיוטה', at, who }; n++; return; }
    const f = D.fix[key]; if (!f) return; const data = {};
    Object.entries(f).forEach(([k, v]) => { if (!EDIT_FIELDS.includes(k) && k !== 'coordSource') return; data[k] = k === 'layer' ? d.idBase + Number(v) : (v === null ? undefined : v); });
    if (Object.keys(data).length) { STATE.edits.places[gid] = { op: 'edit', data, at, who }; n++; } });
  return n + applyDraftAdds(D, dp.id);
}
// 4.26.0: the draft's additions for one destination become places I added (and their new layers, layers I added)
function applyDraftAdds(D, destId) {
  const d = DESTS[destId]; if (!d) return 0; const who = STATE.settings.deviceName || '', at = Date.now(); let n = 0; const lmap = {};
  const mine = draftAdds(D).filter(a => a.dest === destId && !D.off[a.key]);
  ensureEditsShape();
  draftAddLayers(D).filter(l => l.dest === destId && mine.some(a => String(a.layer) === String(l.id))).forEach(l => {
    let nid = at; while (STATE.edits.layers[nid] || Object.values(lmap).includes(nid)) nid++; lmap[l.id] = nid;
    const { id, dest, draftNew, ...data } = l; STATE.edits.layers[nid] = { op: 'add', data: { ...data, dest: destId }, at, who };
    const ord = STATE.edits.layerOrder[destId]; if (ord) STATE.edits.layerOrder = { ...STATE.edits.layerOrder, [destId]: ord.concat(nid) }; });
  mine.forEach(a => {
    const layer = String(a.layer).startsWith('nl:') ? lmap[a.layer] : (a.inst ? Number(a.layer) : d.idBase + Number(a.layer)); if (layer == null || isNaN(layer)) return;
    const data = { name: a.name, layer, dest: destId, icon: a.icon || 'tourist_attraction', description: a.description || '', transit: a.transit || '', reservation: a.reservation || '', price: a.price || '' };
    ['foreign', 'address', 'manualCoord', 'coordSource', 'region', 'src'].forEach(k => { if (a[k] != null && a[k] !== '') data[k] = JSON.parse(JSON.stringify(a[k])); });
    if (!data.address && data.manualCoord) data.address = `${data.manualCoord.lat.toFixed(6)},${data.manualCoord.lng.toFixed(6)}`;
    let pid = at + 1000; while (STATE.edits.places[pid]) pid++;
    STATE.edits.places[pid] = { op: 'add', data, at, who }; n++; });
  return n;
}
// 11.22.0 (place-gid-1; decisions 2026-11-16 · A Google place id, Q9 (3)): a trip file's place whose Google id is already on a place of
// one of the trip's destinations on this phone (its file's place with my edits, or a place I added to it) is that place: it is marked
// "כבר קיים" and starts taken out (a hotel stays - its booking needs it), the existing place is not overwritten, and the program's
function draftedTrip(D) { // the trip as approved: trip places taken out or fixed, references to removed places cleared
  const t = JSON.parse(JSON.stringify(D.data.trip)), gone = new Set(), same = new Map();
  t.places = (t.places || []).filter(p => { if (D.off['trip:' + p.id]) { gone.add(p.id); const x = draftGidDup(t, p); if (x) same.set(p.id, x.id); return false; } return true; })
    .map(p => { const f = D.fix['trip:' + p.id]; if (!f) return p; const q = { ...p, ...f }; if (f.manualCoord === null) delete q.manualCoord; return q; });
  t.schedule = (t.schedule || []).map(s => same.has(s.placeId) ? { ...s, placeId: same.get(s.placeId) } : gone.has(s.placeId) ? { ...s, placeId: undefined } : s);
  return t;
}
function askTripForDest(destId) { const ctl = {}; layerNote(askTripForDest, arguments);
  const dp = DESTS[destId]; if (!dp) return; const sheet = document.getElementById('sheet'), name = dp.meta.name;
  sheet.innerHTML = `${fmHead(`🧳 טיול ל${nameB(name)}?`, 'atX')}
    <p>היעד <b>${escH(name)}</b> בטלפון: המקומות והמידע. <b>טיול</b> הוא ביקור אחד בו - תאריכים או מספר ימים, נסיעות, לינות ותוכנית. בלי טיול, היעד מחכה במסך הטיולים.</p>
    <div class="ta-list"><button type="button" class="ta-item t-wrap" id="atNew" data-act="tripForDest.atNew">🧳 טיול חדש ל${escH(name)}</button><button type="button" class="ta-item t-wrap" id="atLater" data-act="tripForDest.atLater">${msi('event_upcoming')}לא עכשיו<small>＋ טיול חדש במסך הטיולים, כשתרצו</small></button></div>`;
  
  ctl.atLater = () => closeSheet();
  ctl.atNew = () => { closeSheet(); setTimeout(() => openTripEditor(null, { dest: destId }), 120); };
  openSheet('askTripForDest'); layerTop().ctl = ctl;
}
ctlActs('tripForDest', ['atLater', 'atNew']);
// note: a few words added to the toast (approved during an open round)
function approveDraft(note) {
  if (!groupHas('management')) { groupWait('management', () => approveDraft(note)); return; } // diet-groups: installing is the files' (management)
  const M = n => groupFn('management', n), D = DRAFT; if (!D) return; const d = D.data;
  const all = draftItems(D), off = all.filter(x => D.off[x.key] && !x.added).length, fixed = all.filter(x => x.fixed && !D.off[x.key]).length, added = all.filter(x => x.added && !D.off[x.key]).length;
  const tail = [off ? `${off} הורדו` : '', fixed ? `${fixed} תוקנו` : '', added ? `${added} נוספו על ידיך` : '', note || ''].filter(Boolean).join(', ');
  if (d.kind === 'destination') {
    const dp = d.destination;
    const r = M('installDestination')(dp); if (r === 'same') { draftPut(null); saveDraft(); goTab('trips'); showUndoToast(`היעד ${dp.meta.name} כבר בטלפון${SEP}הטיוטה נסגרה`); return; } // undo-history: the draft closed is a row
    applyDraftToDest(D, dp); const hn = hotelsToTrips(Object.values(STATE.trips).filter(t => !t.archived && (t.segments || []).some(g => g.dest === dp.id))); // 9.3.0 (ס11)
    draftPut(null); saveDraft(); persist(); applyActiveTrip(); activeTab = hasTrip() ? 'trips' : 'info'; render();
    showUndoToast(`נוסף יעד: ${dp.meta.name}${tail ? ' (' + tail + ')' : ''}${hotelsMovedText(hn)}`);
    // 4.47.2: a destination no trip goes to yet - ask right away whether to make one (a file can bring a destination without a trip)
    if (!Object.values(STATE.trips).some(t => (t.segments || []).some(g => g.dest === dp.id))) setTimeout(() => askTripForDest(dp.id), 350);
    return;
  }
  const data = { ...d, trip: draftedTrip(D), personal: D.personal ? d.personal : null };
  const newDests = draftNewDests(D), oldIds = draftOldDests(D).map(dp => dp.id);
  draftPut(null); saveDraft(); activeTab = 'info';
  M('importTripNow')(data, 'new', () => { newDests.forEach(dp => applyDraftToDest(D, dp)); oldIds.forEach(id => applyDraftAdds(D, id)); }, tail, { propGone: draftPropGone(D) });
}
// files shared into the installed app (Android share sheet, share_target POST), opened with it (file_handlers), or text shared as JSON


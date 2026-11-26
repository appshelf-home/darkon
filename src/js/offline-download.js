// ================= 📥 MAPS WITHOUT NETWORK - DOWNLOADING AND THE REVIEW WINDOW (special-maps group; split from offline-maps.js in diet-groups, 11.62.0 - what to download (offPlan), the stored packs and their drawing stay in the main script) =================
// ---- downloading (4 requests at once, the trip's budget is a hard stop) ----
// off-prune: opt.free - the user's "עדכון" (the window's button): at the end the tiles no area needs are freed. A resume by itself (quiet,
// on the network's return) never frees. With nothing to download it only frees - no network needed
const OFF_PRUNING = new Set(); // the trips being freed now (a second tap waits)
async function offDownload(id, opt) {
  opt = opt || {}; if (OFF_RUN || OFF_PRUNING.has(id) || id !== STATE.activeTrip) return;
  const plan0 = offPlan(id); if (!plan0) return;
  if (opt.free && OFF_PACKS[id] && !plan0.queue.length) { if (!plan0.free.keys) return; OFF_PRUNING.add(id);
    try { const p = OFF_PACKS[id], f = await offPrune(id, plan0.need); p.status = 'done'; p.at = Date.now(); await offPackSave(p); OFF_PLAN_MEMO.sig = '';
      showToast(`✓ המפות עודכנו${SEP}התפנו ${offMB(f.bytes)} מהטלפון`); } finally { OFF_PRUNING.delete(id); }
    offRefreshMaps(); offUiRefresh(); if (activeTab === 'info') render(); return; }
  if (svcNetDown()) { if (!opt.quiet) showToast(SVC_MSG.offline + '. ההורדה תתחיל כשתהיה רשת.'); return; }
  const plan = plan0;
  let pack = OFF_PACKS[id] || { trip: id, name: activeTripObj().name, at: Date.now(), fetched: { tiles: 0, bytes: 0 }, have: { tiles: 0, bytes: 0 }, status: 'running', failed: 0 };
  pack.status = 'running'; pack.name = activeTripObj().name;
  pack.zs = { ...(pack.zs || {}) }; plan.items.filter(x => x.state === 'in').forEach(x => { pack.zs[x.id] = Math.max(pack.zs[x.id] || 0, x.z); }); // 4.46.3
  await offPackSave(pack);
  // 4.46.3: the progress counts the whole plan, so going on after ⏸ continues the numbers instead of starting over
  const all = plan.need, had = pack.have.bytes; // off-prune: the plan's one needed set
  const queue = plan.queue.slice(), run = OFF_RUN = { id, done: Math.max(0, all.size - queue.length), total: Math.max(all.size, queue.length), bytes: pack.have.bytes, stop: false, ends: plan.ends || [], taken: 0, failed: 0 };
  let tpl = null; try { tpl = await vtTemplate(); } catch (e) { OFF_RUN = null; pack.status = 'paused'; await offPackSave(pack); if (!opt.quiet) showToast(SY.warn + ' שרת המפות לא ענה. אפשר לנסות שוב בעוד רגע.'); offUiRefresh(); return; }
  logEvent(`הורדת מפות לטיול התחילה: ${queue.length} אריחים`, true);
  const tick = () => { offUiRefresh(); };
  const one = async k => {
    const have = OFF_KEYS.get(k); if (have) { if (!have.includes(id)) { const v = await offTx('tiles', 'readonly', st => st.get(k)).catch(() => null); if (v) { v.t = [...new Set([...(v.t || []), id])]; await offTx('tiles', 'readwrite', st => st.put(v, k)).catch(() => {}); OFF_KEYS.set(k, v.t); } } run.done++; return; }
    if (pack.fetched.tiles >= OFF_CAP.tiles || pack.fetched.bytes >= OFF_CAP.bytes) { run.stop = 'cap'; return; }
    const [z, x, y] = k.split('/'), u = tpl.t.replace('{z}', z).replace('{x}', x).replace('{y}', y);
    if (svcBudgetOf(id).tiles + pack.fetched.tiles >= OFF_CAP.tiles || svcBudgetOf(id).bytes + pack.fetched.bytes >= OFF_CAP.bytes) { run.stop = 'cap'; return; } // the picture's background counts too (ש6)
    const r = await vtTile('offmaps', u, 25000); // 7.1.0: through the client (4 at once with the picture's map, busy / errors / no network handled there)
    if (r.kind === 'offline') { run.stop = 'offline'; return; }
    if (r.kind === 'empty') { pack.fetched.tiles++; await offTx('tiles', 'readwrite', st => st.put({ b: null, t: [id] }, k)); OFF_KEYS.set(k, [id]); }
    else if (r.kind === 'ok') { const b = r.value; pack.fetched.tiles++; pack.fetched.bytes += b.byteLength; pack.have.tiles++; pack.have.bytes += b.byteLength; run.bytes += b.byteLength;
      await offTx('tiles', 'readwrite', st => st.put({ b: b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), t: [id] }, k)); OFF_KEYS.set(k, [id]); }
    else { pack.failed = (pack.failed || 0) + 1; run.failed++; }
    run.done++; if (run.done % 40 === 0) { offPackSave(pack); tick(); } };
  await Promise.all([0, 1, 2, 3].map(async () => { while (queue.length && !run.stop) try { run.taken++; await one(queue.shift()); } catch (e) { run.stop = regSpaceFail(e) ? 'space' : 'error'; } })); // at most 4 waiting in the client's queue at a time; storage (Q6 (b)): a write refused for space stops it with the one message, never a silent end
  pack.at = Date.now(); pack.status = run.stop === 'offline' || run.stop === 'user' || run.stop === 'space' || run.stop === 'error' ? 'paused' : run.stop === 'cap' ? 'cap' : 'done'; await offPackSave(pack);
  const freed = opt.free && pack.status === 'done' && !run.failed && plan.free.keys ? await offPrune(id, plan.need) : null; // off-prune: never after ⏸, a failure, the cap or a space stop (storage)
  OFF_RUN = null; OFF_PLAN_MEMO.sig = '';
  if (run.stop && run.stop !== 'user') svcTrouble('openfreemap', 'offmaps', `הורדה נעצרה (${run.stop})${SEP}${run.done} מתוך ${run.total}${SEP}${offMB(pack.have.bytes)}`); // 7.1.0 (ש11): technical - in diagnostics
  else if (!run.stop) logEvent(`מפות לטיול ירדו: ${run.done} אריחים${SEP}${offMB(pack.have.bytes)}`, true);
  if (run.stop !== 'space' && (!opt.quiet || pack.status === 'done')) showToast(pack.status === 'done' ? (freed && freed.keys ? `✓ המפות עודכנו${SEP}ירדו ${offMB(Math.max(0, run.bytes - had))}${SEP}התפנו ${offMB(freed.bytes)}` : `✓ המפות בטלפון${SEP}${offMB(pack.have.bytes)}`) : pack.status === 'cap' ? SY.warn + ' ירד חלק – נגמר המקום של הטיול. מה שירד נשמר.' : run.stop === 'user' ? 'ההורדה נעצרה. אפשר להמשיך מאותו מקום.' : 'הרשת נותקה. ההורדה תמשיך כשתחזור.');
  offRefreshMaps(); offUiRefresh(); if (activeTab === 'info') render(); // 4.46.3: the card "לקראת הטיול" follows too
}
// ---- the review screen: areas with their size, the budget, ✕ / ＋, "＋ אזור" by framing, download / update / delete ----
const OFF_PIN_PX = 24, OFF_ROAD_HIT = 22; let OFF_VIEW = null; // off-map-areas (11.47.0): an area smaller than this on screen is a pin; where the map was moved to (kept across a redraw in place); off-roads: the width in px of a road's invisible touch target
function offAreaColor(x) { return x.state === 'in' ? (x.kind === 'transit' ? '#888780' : '#185FA5') : '#B4B2A9'; }
// wait-look (decisions 2026-11-23 · One "in progress" look, Q2): the download waits with the one "in progress" component, measured
// (state 3): the bar under the window's head fills with the tiles done, the stage line names the area ("אזור N מתוך M") with the tiles'
// count; ⏸ עצירה beside it as before. The window is drawn again as the download goes (offUiRefresh), and the bar with it
function offRunWords(run) { const e = run.ends || [], i = Math.max(0, run.taken - 1), a = e.findIndex(x => x > i);
  return e.length > 1 ? `מורידים את אזור ${a < 0 ? e.length : a + 1} מתוך ${e.length}` : 'מורידים את המפות'; }
function offUiRefresh() { if (document.getElementById('offSheet')) openOffMaps(STATE.activeTrip, true); }
undoAfter(keys => { if (keys.some(k => /^\["d",.*"offmap"\]$/.test(k))) offUiRefresh(); }); // undo-history (Q5): the open window shows the areas restored
function openOffMaps(id, keep) { const ctl = {}; layerNote(openOffMaps, arguments);
  if (id !== STATE.activeTrip) { switchTrip(id); }
  const sheet = document.getElementById('sheet'), t = activeTripObj(), plan = offPlan(t.id), pack = OFF_PACKS[t.id], run = OFF_RUN && OFF_RUN.id === t.id ? OFF_RUN : null;
  if (!plan) return; const inPlace = keep || (layerTop() && layerTop().key === 'openOffMaps' && sheet.querySelector('#offSheet')); if (!inPlace || !OFF_VIEW || OFF_VIEW.trip !== t.id) OFF_VIEW = null; /* a redraw of the open window (✕ / ＋, an undo, the layer's own redraw) keeps the view */ const keepScroll = keep && sheet.querySelector('.off-list') ? sheet.querySelector('.off-list').scrollTop : 0;
  const pct = Math.min(100, Math.round(100 * Math.max(plan.cost.bytes / plan.budget.bytes, plan.cost.tiles / plan.budget.tiles) || 0));
  const shown = offShown(plan);
  const num = new Map(); if (MAP_AVAILABLE) shown.filter(x => !x.line).forEach((x, i) => num.set(x, i + 1)); // off-map-areas (11.47.0): each area its number by its order in the list - the same number on its pin (offNums: the same rule, for the editor)
  const rnum = new Map(); if (MAP_AVAILABLE) shown.filter(x => x.line).forEach((x, i) => rnum.set(x, i + 1)); // off-roads: a road's key (no number shown - numbers are for areas only)
  const row = x => { const n = num.get(x), k = rnum.get(x), st = x.state === 'in' ? '' : x.state === 'out' ? '<span class="off-out">לא נכנס במקום</span>' : '<span class="off-out">✕ הוצא</span>';
    const edit = MAP_AVAILABLE && !x.line && x.state !== 'off' ? `<button type="button" class="off-ed" data-act="offArea.edit" data-offedit="${escH(x.id)}" aria-label="עריכת האזור" title="עריכת האזור">${msi('edit', { size: 18 })}</button>` : ''; // off-frame (Q5): ✏️ on every area's row, not on a line or an area taken out
    const btn = x.kind === 'ctx' ? '' : x.kind === 'user' ? `<button type="button" class="off-x" data-act="offMaps.offdel" data-offdel="${escH(x.xid)}" aria-label="מחיקת האזור" title="מחיקת האזור">${msi('delete', { size: 18 })}</button>` : x.state === 'in' ? `<button type="button" class="off-x" data-act="offMaps.offset" data-offset="${escH(x.id)}" data-v="off" aria-label="להוציא" title="להוציא">${msi('close', { size: 18 })}</button>` : `<button type="button" class="icon-btn btn-copy" data-act="offMaps.offset" data-offset="${escH(x.id)}" data-v="on">＋ להכניס</button>`;
    return `<div class="off-row${x.state !== 'in' ? ' off-dim' : ''}"${n ? ` data-act="offMaps.offFrame" data-offn="${escH(n)}"` : k ? ` data-act="offMaps.offRoad" data-offr="${escH(k)}"` : ''}>${msi(x.line ? 'route' : x.kind === 'user' ? 'crop' : 'map', { cls: 'off-ic' })}${n ? `<b class="off-n${x.state !== 'in' ? ' off-out' : ''}"${x.state === 'in' ? ` style="background:${escH(offAreaColor(x))}"` : ''}>${escH(n)}</b>` : ''}${k ? `<i class="off-rd${x.state !== 'in' ? ' off-dash' : ''}" style="border-top-color:${escH(offAreaColor(x))}" aria-hidden="true"></i>` : ''}<span class="off-tx${x.hotel ? ' off-hotel' : ''}"><b>${escH(x.label)}</b>${x.sub ? `<small class="off-sub">${escH(x.sub)}</small>` : ''}<small>${x.state === 'in' ? offZoomText(x) + (x.add && x.add.tiles ? SEP + '≈ ' + offMBh(x.add.bytes) : plan.update ? (SEP + 'כבר בטלפון') : '') : '≈ ' + offMBh((x.add || {}).bytes || 0)} ${st}${x.from ? ' <span class="off-chg">שונה</span>' : ''}</small></span>${edit}${btn}</div>`; };
  const sizeTxt = `${offMBh(plan.cost.bytes)}`; // 9.2.0 (ס10): MB and a share of the trip's room; tiles stay in the log and diagnostics
  const free = pack && !run && plan.free.tiles ? plan.free : null; // off-prune (Q7): what "עדכון" will free, said before it - nothing leaves until then
  const head = pack ? `<p class="sh-hint">${offPackLine(t.id)}${plan.queue.length ? `${SEP}<b>יש אזור חדש להוריד</b> (${sizeTxt}, מתוך המקום שנשאר: ${offMBh(plan.budget.bytes)})` : ''}${free ? `${SEP}<b id="offFree">יתפנו ≈ ${offMBh(free.bytes)} בטלפון</b>` : ''}</p>` : `<p class="sh-hint">מורידים פעם אחת את המפה של אזורי הטיול, כדי שתעבוד גם בלי רשת.</p>`;
  const prog = run ? `<div class="off-run" id="offRun"><div class="off-wait" id="offWait"></div><button type="button" class="btn-sec" id="offStop" data-act="offMaps.offStop">${msi('pause', { size: 18 })} עצירה</button></div>` : '';
  const act = run ? '' : plan.queue.length ? `<button class="btn-nav" id="offGo" data-act="offMaps.offGo">${msi('download', { size: 18 })} ${pack ? (pack.status === 'done' ? 'עדכון מפות' : 'להמשיך את ההורדה') : 'הורדה'}${SEP}<bdi>${sizeTxt}</bdi></button>`
    : free ? `<button class="btn-nav" id="offGo" data-act="offMaps.offGo">${msi('delete_sweep', { size: 18 })} עדכון מפות</button>` : ''; // off-prune: only frees - no network
  sheet.innerHTML = `<div class="sheet-head" id="offSheet"><b>📥 מפות לשימוש בלי רשת ${tipI('offmaps')}</b><button class="sheet-x" data-act="win.close" id="offClose" aria-label="סגירה">✕</button></div>${head}
    ${MAP_AVAILABLE ? `<div id="offMap" class="off-map"></div><div class="off-addrow"><button type="button" class="sh-secondary off-add" id="offAdd" data-act="offArea.add">${msi('add', { size: 18 })} אזור</button></div>` : ''}
    <div class="off-meter"><div style="width:${pct}%"></div></div><p class="sh-hint">${plan.cost.bytes ? `ההורדה: <bdi>${sizeTxt}</bdi>${SEP}<bdi>${pct}%</bdi> מהמקום של הטיול` : 'אין מה להוריד'}${plan.items.some(x => x.state === 'out') ? (SEP + 'כדי להכניס: ✕ על אזור אחר') : ''}</p>
    <div class="off-list">${shown.map(row).join('') || '<p class="sh-hint">אין עדיין מקומות או לינות עם מיקום על המפה בטיול הזה.</p>'}</div>
    ${prog}<p class="sh-hint off-cr">${navigator.connection && navigator.connection.type === 'cellular' ? 'את/ה על רשת סלולרית - מומלץ להוריד ב-Wi-Fi. ' : 'מומלץ ב-Wi-Fi. '}מפה: ${svcCredit('openfreemap')}</p>
    ${pack && !run ? fmEndActs([{ act: 'offMaps.offDel', id: 'offDel', label: 'מחיקת המפות של הטיול', del: true }]) : ''}
    <div class="brow sheet-actions sheet-save-bar">${act}</div>`; // 10.5.0: the main action in the pinned footer; end-actions-followups (Q2): the delete is the red row of the end group
  if (keepScroll) sheet.querySelector('.off-list').scrollTop = keepScroll;
  if (run) waitOn(sheet, { head: document.getElementById('offSheet'), line: document.getElementById('offWait') }).progress(run.done, run.total, offRunWords(run)); // wait-look (Q2): the measured state
  const g = i => document.getElementById(i), om = () => offMapOf(t.id);
  
  if (g('offGo')) ctl.offGo = async () => { if (!(await offSpaceFits(plan.cost.bytes))) return; offDownload(t.id, { free: true }); setTimeout(() => openOffMaps(t.id, true), 50); }; // storage (Q6 (a)): refused before it starts when it does not fit; off-prune: the window's update also frees
  offSpaceFits(plan.cost.bytes, true);
  if (g('offStop')) ctl.offStop = () => { if (OFF_RUN) OFF_RUN.stop = 'user'; };
  ctl.offDel = () => askSure({ ic: 'delete', title: 'למחוק את המפות שהורדו?', text: 'בלי רשת לא יהיו מפות לטיול הזה. אפשר להוריד שוב כשיש רשת.', ok: 'מחיקה' }, () => { offDeletePack(t.id); });
  ctl.offset = b => { const o = om(), k = b.dataset.offset;
    if (b.dataset.v === 'on') o.over[k] = 'on'; else o.over[k] = 'off'; persist(); OFF_PLAN_MEMO.sig = ''; openOffMaps(t.id, true);
    showUndoToast(b.dataset.v === 'on' ? '＋ האזור נכנס' : '✕ האזור הוצא'); };
  ctl.offdel = b => { const o = om(), x = o.extra.find(e => e.id === b.dataset.offdel); o.extra = o.extra.filter(e => e !== x); if (x && x.from) o.over[x.from] = 'off'; persist(); OFF_PLAN_MEMO.sig = ''; openOffMaps(t.id, true); // off-frame: a changed area deleted - its computed area comes back taken out (✕), so it can be put back
    showUndoToast(SY.del + ' האזור נמחק'); };
  // 4.46.2: the map is drawn after the dialog is on screen - fitting the regions into a box with no size yet left it blank
  const drawMap = () => { if (!(MAP_AVAILABLE && g('offMap'))) return; const box = g('offMap'); if (!box.clientWidth) { requestAnimationFrame(drawMap); return; }
    if (!leafGate(box, drawMap)) return; // 11.29.0 (launch-fast): the library first
    try { const m = mapTool('offMap'); // 5.9.0
      // 10.5.0 (look.md "Maps"): ⛶ - the regions' map on the whole screen (the downloaded tiles show offline too); ✕ / back returns
      const fb = document.createElement('button'); fb.type = 'button'; fb.className = 'fs-btn'; fb.innerHTML = FS_ICON; fb.dataset.act = 'offMaps.offFs'; fb.setAttribute('aria-label', 'מפה במסך מלא'); fb.title = 'מסך מלא';
      box.appendChild(fb); mapCtl(fb); box._ctl = { offMaps: ctl }; let ph = null;
      const fsOut = fromPop => { if (!ph) return; if (ph.isConnected) ph.replaceWith(box); else box.remove(); ph = null; box.classList.remove('off-full'); fb.innerHTML = FS_ICON; fb.title = 'מסך מלא'; fb.setAttribute('aria-label', 'מפה במסך מלא'); try { m.invalidateSize(); } catch (e) {} layerDone('offFs', fromPop); };
      ctl.offFs = () => { if (ph) { fsOut(); return 'quiet'; } ph = document.createComment('offMap'); box.replaceWith(ph); document.body.appendChild(box); box.classList.add('off-full');
        fb.innerHTML = msi('close'); fb.title = 'יציאה ממסך מלא'; fb.setAttribute('aria-label', 'יציאה ממסך מלא'); layerPush('offFs', 'full', fp => fsOut(fp)); setTimeout(() => { try { m.invalidateSize(); } catch (e) {} }, 60); return 'quiet'; };
 const grp = [], areas = [], roads = [];
      // off-map-areas (11.47.0; decisions 2026-11-20-offline-map-small-areas Q1): an area under OFF_PIN_PX on either side on screen is its
      // round numbered pin at its centre (the map component's marker), else its rectangle with its name; one drawing, switched per area
      shown.forEach(x => { const col = offAreaColor(x), o = { color: col, weight: x.line ? 4 : 2, fillOpacity: x.state === 'in' ? 0.12 : 0.04, dashArray: x.state === 'in' ? null : '4 6' };
        if (x.line) { // off-roads: an invisible wider line under the drawn one is the road's touch target on a phone; a tap on either lights its row
          const d = { x, k: rnum.get(x), o, hit: L.polyline(x.path, { weight: OFF_ROAD_HIT, opacity: 0, fill: false }), r: L.polyline(x.path, o) };
          [d.hit, d.r].forEach(l => { l.bindTooltip(escH(x.label) /* the map library reads a string as HTML */).addTo(m); l.on('click', () => goRoad(d, true)); }); roads.push(d); grp.push(d.r); return; }
        const r = L.rectangle([[x.bb[0], x.bb[1]], [x.bb[2], x.bb[3]]], o); r.bindTooltip(escH(x.label), { permanent: true, direction: 'center', className: 'off-lbl' }); // 10.5.0: each area labeled with its name
        const a = { x, n: num.get(x), o, r, on: '' }; a.pin = L.marker(r.getBounds().getCenter(), { keyboard: false, icon: pinDivIcon({ color: x.state === 'in' ? col : 'var(--surface-container)' }, { round: true, number: a.n, cls: 'off-pin' + (x.state === 'in' ? '' : ' off-out') }) });
        a.pin.on('click', () => goArea(a, true)); areas.push(a); grp.push(r); });
      const offMode = () => areas.forEach(a => { const p = m.latLngToContainerPoint([a.x.bb[0], a.x.bb[1]]), q = m.latLngToContainerPoint([a.x.bb[2], a.x.bb[3]]);
        const want = Math.abs(q.x - p.x) < OFF_PIN_PX || Math.abs(q.y - p.y) < OFF_PIN_PX ? 'pin' : 'rect'; if (a.on === want) return;
        if (a.on) m.removeLayer(a.on === 'pin' ? a.pin : a.r); (want === 'pin' ? a.pin : a.r).addTo(m); a.on = want; });
      const ab = document.createElement('button'); ab.type = 'button'; ab.className = 'off-all'; ab.id = 'offAll'; ab.textContent = 'כל האזורים'; ab.dataset.act = 'offMaps.offAll'; ab.hidden = !OFF_VIEW; box.appendChild(ab); mapCtl(ab);
      // tl-paths item 7 (review of off-map-areas Q2): a move by the user - a drag, a zoom (pinch, wheel, ＋ / −, a double tap) - is a move to an
      // area like a row's tap: OFF_VIEW kept, "כל האזורים" shown. The window's own moves (the opening fit, "כל האזורים", a row or a pin, a redraw
      // in place) are marked `own` until their moveend, so they never count as the user's
      let own = 0; const ownMove = f => { own++; m.once('moveend', () => { own = Math.max(0, own - 1); }); f(); };
      const byUser = () => { if (own) return; if (!OFF_VIEW) OFF_VIEW = { trip: t.id }; ab.hidden = false; };
      m.on('dragstart', byUser); m.on('zoomstart', byUser);
      const fitAll = () => ownMove(() => { if (grp.length) m.fitBounds(L.featureGroup(grp).getBounds(), { padding: [12, 12] }); else m.setView([31.5, 34.8], 6); });
      const flash = (a, st) => { a.r.setStyle(st || { weight: 4, fillOpacity: 0.3 }); clearTimeout(a.fl); a.fl = setTimeout(() => { try { a.r.setStyle(a.o); } catch (e) {} }, 1500); };
      const lightRow = (key, v) => { const rw = [...sheet.querySelectorAll(`.off-row[data-${key}]`)].find(e => +e.dataset[key] === v), li = rw && rw.closest('.off-list'); if (!rw) return;
        if (li) li.scrollTop += rw.getBoundingClientRect().top - li.getBoundingClientRect().top - (li.clientHeight - rw.offsetHeight) / 2;
        rw.classList.add('off-hl'); clearTimeout(rw._hl); rw._hl = setTimeout(() => rw.classList.remove('off-hl'), 1500); };
      // Q2: a row or a pin frames its area (highlighted for a moment); a pin also lights its row and scrolls it into view; "כל האזורים" back
      const goArea = (a, fromPin) => { OFF_VIEW = { trip: t.id }; ab.hidden = false; ownMove(() => m.fitBounds(a.r.getBounds(), { padding: [24, 24] })); offMode(); flash(a);
        if (fromPin) lightRow('offn', a.n); };
      // off-roads (decisions 2026-11-23-offline-roads Q1): a road's row frames the whole road and highlights it for a moment, like an area's;
      // a tap on the road on the map highlights it and lights its row (scrolled into view) - the map is not moved, the user is looking at it
      const goRoad = (d, fromMap) => { if (!fromMap) { OFF_VIEW = { trip: t.id }; ab.hidden = false; ownMove(() => m.fitBounds(d.r.getBounds(), { padding: [24, 24] })); offMode(); }
        flash(d, { weight: 8 }); d.r.bringToFront(); if (fromMap) lightRow('offr', d.k); };
      ctl.offFrame = b => { const a = areas.find(y => y.n === +b.dataset.offn); if (a) goArea(a, false); return 'quiet'; };
      ctl.offRoad = b => { const d = roads.find(y => y.k === +b.dataset.offr); if (d) goRoad(d, false); return 'quiet'; };
      ctl.offAll = () => { OFF_VIEW = null; ab.hidden = true; fitAll(); return 'quiet'; };
      if (OFF_VIEW && OFF_VIEW.c) ownMove(() => m.setView(OFF_VIEW.c, OFF_VIEW.z, { animate: false })); else fitAll(); // a redraw in place (✕ / ＋ / an undo) keeps where the map was moved: it never returns by itself
      const fitLbl = () => { offMode(); offLabelsFit(box); if (OFF_VIEW) { OFF_VIEW.c = m.getCenter(); OFF_VIEW.z = m.getZoom(); } }; m.on('zoomend moveend resize', fitLbl); fitLbl();
    } catch (e) { logEvent(SY.warn + ' מפת האזורים: ' + (e && e.message || e), true); } };
  if (!keep) { showSheetBackdrop('openOffMaps'); layerTop().ctl = ctl; } else if (layerTop() && layerTop().key === 'openOffMaps') layerTop().ctl = ctl; // undo-history: a redraw in place (✕ / ＋ / an undo) hands the window the new map's actions - "＋ אזור" framed the map drawn first
  requestAnimationFrame(drawMap);
}
// final-review 14: the area labels of the regions' map never sit on each other, on a map button or across the map's edge. Each label is
// drawn at its area's center; in the areas' order, a label that would touch one already placed moves up or down by whole rows to the
// nearest free place, a label at the edge moves in, and one with no free place (or whose area's center is out of view) is not drawn
// (the list under the map names every area). Run after every zoom, pan and resize.
function offLabelsFit(box) { const B = box.getBoundingClientRect(), G = 3, lbls = [...box.querySelectorAll('.off-lbl')]; if (!B.width || !lbls.length) return;
  const hit = (a, b) => a.l < b.r + G && b.l < a.r + G && a.t < b.b + G && b.t < a.b + G;
  const placed = [...box.querySelectorAll('.fs-btn, .off-all, .leaflet-control')].map(e => e.getBoundingClientRect()).filter(r => r.width && r.height).map(r => ({ l: r.left - B.left, r: r.right - B.left, t: r.top - B.top, b: r.bottom - B.top }));
  lbls.forEach(e => { e.style.translate = ''; e.style.visibility = ''; e.style.maxWidth = Math.max(40, Math.floor(B.width) - 2 * G - 2) + 'px'; });
  lbls.map(e => ({ e, r: e.getBoundingClientRect() })).forEach(({ e, r }) => { const w = r.width, h = r.height, cx = r.left - B.left + w / 2, cy = r.top - B.top + h / 2;
    let got = null;
    if (cx >= 0 && cx <= B.width && cy >= 0 && cy <= B.height) for (let k = 0; k <= 12 && !got; k++) for (const s of (k ? [-1, 1] : [1])) { // rows above and below, nearest first
      const l = Math.max(G, Math.min(B.width - G - w, cx - w / 2)), t = cy - h / 2 + s * k * (h + G);
      const c = { l, r: l + w, t, b: t + h }; if (t < G || c.b > B.height - G || placed.some(p => hit(c, p))) continue; got = c; break; }
    if (!got) { e.style.visibility = 'hidden'; return; }
    placed.push(got); e.style.translate = `${Math.round(got.l - (cx - w / 2))}px ${Math.round(got.t - (cy - h / 2))}px`; }); } // translate: the map library owns the label's transform
ctlActs('offMaps', ['offDel', 'offGo', 'offStop', 'offdel', 'offset', 'offFs', 'offFrame', 'offAll', 'offRoad']);
// storage (Q6 (a)): the download's estimate against the space left to the app - a line in the download window when it does not fit; quiet: the line only
async function offSpaceFits(bytes, quiet) { const sp = await regSpace(), fits = !sp || !bytes || bytes <= sp.free, box = document.getElementById('offSheet'); if (!box) return fits;
  const sheet = box.parentNode, old = sheet.querySelector('.off-space'); if (old) old.remove(); if (fits) return true;
  const list = sheet.querySelector('.off-list'); if (list) list.insertAdjacentHTML('beforebegin', `<p class="sh-hint off-space" id="offSpace">${warnIc()} ${TX.noSpace}: ההורדה צריכה ${offMBh(bytes)} ונשארו ${offMBh(sp.free)}. <button type="button" class="link-btn" data-act="storage.open">${TX.storage} ›</button></p>`);
  if (!quiet) showToast(TX.noSpace, { act: 'storage.open', label: TX.storage, ms: 7000 }); return false; }

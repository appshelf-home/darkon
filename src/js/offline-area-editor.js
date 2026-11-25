// ================= 📥 MAPS WITHOUT NETWORK - THE AREA EDITOR (task off-frame) =================
// ---- off-frame (decisions 2026-11-23 · Offline maps - an area framed, resized and moved on the map, Q1-Q7): the area editor ----
// The size line (Q3 with the correction): the plan's own cost with the candidate in place of the area edited (offPlan(id, alt)). big - the
// area alone (at the lowest detail the plan gives an area) does not fit in what is left to download for the trip: it cannot be saved;
// out - the areas (by the window's numbers) and roads that are in now and the candidate would push out
const offBoxCount = (bb, z) => { const [x0, y0] = offTileXY(bb[2], bb[1], z), [x1, y1] = offTileXY(bb[0], bb[3], z); return (x1 - x0 + 1) * (y1 - y0 + 1); };
function offFrameInfo(id, alt, base) { const b = base.budget; let n = 0; for (let z = 8; z <= 12; z++) n += offBoxCount(alt.bb, z);
  if (n > b.tiles) return { big: true, out: [] }; // counted before any tile is listed - a frame over a country never freezes the phone
  const plan = offPlan(id, alt), x = plan.items.find(y => y.cand), mine = k => (OFF_KEYS.get(k) || []).includes(id);
  const ks = offItemTiles({ ...x, _t: null }, x.zMin).filter(k => !mine(k)), alone = { tiles: ks.length, bytes: ks.reduce((s, k) => s + OFF_EST(+k.split('/')[0], 'area'), 0) };
  const big = x.state !== 'in' || alone.tiles > plan.budget.tiles || alone.bytes > plan.budget.bytes, nums = offNums(base);
  const out = offShown(base).filter(y => y.state === 'in' && y.id !== alt.hide && (plan.items.find(q => q.id === y.id) || {}).state === 'out').map(y => nums.has(y.id) ? 'אזור ' + nums.get(y.id) : y.label);
  return { big, out, add: x.add, pct: Math.round(100 * Math.max(x.add.bytes / Math.max(1, plan.budget.bytes), x.add.tiles / Math.max(1, plan.budget.tiles))) }; }
// The editor (Q2, Q6): the point picker's frame (openPick o.frame, map-full-screen.js) - the area fills the frame; the trip's other areas faint
// with their numbers, the drives' lines and the trip's places as dots under it; a name field (the place at the frame's centre - offNearName,
// as computed areas are named - following the frame until typed in) and the size line. x: the area's item in the window's plan, or null for
// a new one (bb0: what the small map shows). Saving: a user area changes in place; a computed one becomes the user's (offmap.extra with
// `from`, the computed one hidden under its key - Q4); a new one is added. One undo message (Q7). Back leaves with no change, as the picker
const OFF_FR_TITLE = 'אזור למפה בלי רשת';
function offFrameLineHTML(inf) { if (inf.big) return `${warnIc()} גדול מדי, מקרבים את המפה`;
  const size = inf.add.tiles ? `≈ ${offMBh(inf.add.bytes)}${SEP}<bdi>${escH(inf.pct)}%</bdi> ממה שנשאר להורדה בטיול` : 'כבר בטלפון';
  return inf.out.length ? `${size}<br>ייכנס על חשבון: ${escH(inf.out.join(', '))}` : size; }
function openOffFrame(tid, x, bb0) { const base = offPlan(tid); if (!base) return;
  const o = offMapOf(tid), ex = x && x.kind === 'user' ? o.extra.find(e => e.id === x.xid) : null, alt = { bb: (x ? x.bb : bb0).slice(), hide: x ? x.id : null, xid: ex ? ex.id : null };
  let typed = !!(ex ? ex.named : x); // a computed area keeps its name (its hotel, its place); a user area - the name it was given
  const F = fmNew(), nameOf = bb => offNearName({ lat: (bb[0] + bb[2]) / 2, lng: (bb[1] + bb[3]) / 2 }) || `אזור שהוספתי ${o.extra.length + (ex ? 0 : 1)}`;
  const card = `${fmText(F, 'offName', { label: 'שם האזור', value: x ? x.label : nameOf(alt.bb), max: 60, on: () => { typed = true; } })}<p class="sh-hint off-fr-size" id="offFrSize" aria-live="polite"></p><div class="off-meter"><div id="offFrBar" style="width:0%"></div></div>${ex && ex.from ? `<button type="button" class="link-btn off-fr-orig" id="offFrOrig" data-act="pick.orig">${msi('restart_alt', { size: 18 })} חזרה לגודל המקורי</button>` : ''}`;
  const draw = map => { const nums = offNums(base);
    offShown(base).forEach(y => { if (y.id === alt.hide || (y.line && y.kind !== 'drive')) return; const st = { color: offAreaColor(y), weight: y.line ? 3 : 1.5, opacity: 0.55, fillOpacity: 0.06, dashArray: y.state === 'in' ? null : '4 6', interactive: false };
      if (y.line) { L.polyline(y.path, st).addTo(map); return; }
      L.rectangle([[y.bb[0], y.bb[1]], [y.bb[2], y.bb[3]]], st).addTo(map);
      L.marker([(y.bb[0] + y.bb[2]) / 2, (y.bb[1] + y.bb[3]) / 2], { interactive: false, keyboard: false, icon: pinDivIcon({ color: y.state === 'in' ? offAreaColor(y) : 'var(--surface-container)' }, { round: true, number: nums.get(y.id), cls: 'off-pin off-faint' + (y.state === 'in' ? '' : ' off-out') }) }).addTo(map); });
    offAnchors().forEach(a => L.circleMarker([a.c.lat, a.c.lng], { radius: 3, weight: 1, color: '#FFFFFF', fillColor: '#185FA5', fillOpacity: 0.9, interactive: false, className: 'off-dot' }).addTo(map)); };
  const change = bb => { alt.bb = bb; const g = i => document.getElementById(i), nm = F.el && F.el.querySelector('[data-fm="offName"]'), s = g('offFrSize'); if (!s) return;
    if (!typed && nm) nm.value = nameOf(bb);
    const inf = offFrameInfo(tid, alt, base); g('fspFrame').classList.toggle('fsp-big', inf.big); g('fspSave').classList.toggle('fsp-off', inf.big); // dimmed, still tapped: it says why (Q3)
    s.innerHTML = offFrameLineHTML(inf);
    g('offFrBar').style.width = (inf.big ? 100 : Math.min(100, inf.pct)) + '%'; g('offFrBar').parentNode.classList.toggle('off-meter-big', inf.big); };
  const save = bb => { if (offFrameInfo(tid, { ...alt, bb }, base).big) { showToast(`${SY.warn} האזור גדול מדי למה שנשאר להורדה בטיול. מקרבים את המפה או מקטינים את המסגרת.`); return false; }
    const val = (fmGet(F, 'offName') || '').trim(), name = val || nameOf(bb), named = typed && !!val;
    return () => { const o2 = offMapOf(tid);
      if (ex) { const e = o2.extra.find(q => q.id === ex.id); if (e) Object.assign(e, { bb, label: name, named: named || !!e.from }); }
      else { o2.extra.push({ id: 'u' + Date.now().toString(36), label: name, bb, named: named || !!x, ...(x ? { from: x.id } : {}) }); if (x) o2.over[x.id] = 'x'; }
      persist(); OFF_PLAN_MEMO.sig = ''; openOffMaps(tid, true); showUndoToast(x ? 'האזור שונה' : '＋ נוסף אזור'); }; };
  const orig = ex && ex.from ? () => { const o2 = offMapOf(tid); o2.extra = o2.extra.filter(e => e.id !== ex.id); delete o2.over[ex.from]; persist(); OFF_PLAN_MEMO.sig = ''; openOffMaps(tid, true); showUndoToast('האזור חזר לגודל המקורי'); } : null; // Q4: the computed area again (if it no longer exists, only the user's is gone)
  openPick({ how: 'frame', ret: null /* no place search in the frame: no form to keep across Google Maps */, start: [(alt.bb[0] + alt.bb[2]) / 2, (alt.bb[1] + alt.bb[3]) / 2], zoom: 12, frame: { title: OFF_FR_TITLE, bb: alt.bb, card, draw, change, save, orig } });
  const top = layerTop(); if (FS_PICK && FS_PICK.o.frame && top && top.key === 'fsp') { fmAttach(F, document.getElementById('fspCard')); top.form = F; F.win = top; } }
// the window's ✏️ and "＋ אזור" reach the editor by their actions only (the window never names it), so the editor depends on the window and not back
act('offArea.edit', c => { const x = (offPlan(STATE.activeTrip) || { items: [] }).items.find(y => y.id === c.el.dataset.offedit); if (x) openOffFrame(STATE.activeTrip, x); return 'quiet'; });
act('offArea.add', () => { const m = [...LIVE_MAPS].find(y => y.getContainer().id === 'offMap' && y.getContainer().isConnected); if (!m) return 'quiet'; const b = m.getBounds();
  openOffFrame(STATE.activeTrip, null, [b.getSouth(), b.getWest(), b.getNorth(), b.getEast()].map(v => +v.toFixed(5))); return 'quiet'; }); // Q5: framed on what the small map shows (the 80 km rule gone - Q3)

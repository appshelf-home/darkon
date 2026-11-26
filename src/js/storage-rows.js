// ================= SETTINGS › STORAGE ON THE PHONE (management group; split from offline-maps.js in diet-groups, 11.62.0) =================
// ⚙️ ← 💾 אחסון במכשיר (storage, decisions 2026-11-23 · Storage on the phone, Q4-Q6; before: "מפות בטלפון", 4.39.0): what the app takes and the space left
// to it, then a row per kind. The rule (Q5): what can be loaded again gets "ניקוי"; what is the user's own shows its size and leads to where it is handled.
// The sizes come from the stores (blob sizes, the tile index), filled in once they are measured; one that cannot be measured says so, never 0.
const ST_WARN = 0.1; // Q6 (c): the summary warns under 10% of the app's space left
function stRowHTML(ic, title, id, btn) { return `<div class="off-row st-row"><span class="off-ic">${msi(ic)}</span><span class="off-tx"><b>${title}</b><small id="${escH(id)}">…</small></span>${btn || ''}</div>`; }
function stGoBtn(attrs, label) { return `<button type="button" class="btn-sec st-go" ${attrs}>${label} ›</button>`; } // attrs: the literal data-act (and data-v), so the wiring guard sees each action
function stClearBtn(attrs) { return `<button type="button" class="btn-sec" ${attrs}>${msi('delete_sweep', { size: 18 })} ניקוי</button>`; }
function offSettingsHTML() { // item 8 (decisions 2026-11-23 · Review of the finished branch storage, Q1): the rows under three headers, then the app itself
  const ps = Object.values(OFF_PACKS), trips = Object.values(STATE.trips || {}), hdr = (ic, t) => `<div class="st-h">${msi(ic, { size: 18 })} ${t}</div>`;
  const maps = !MAP_AVAILABLE ? '' : hdr('map', 'מפות לבלי רשת') + (ps.length ? ps.map(p => { const shared = [...OFF_KEYS.values()].some(t => t.includes(p.trip) && t.length > 1);
      return `<div class="off-row"><span class="off-ic">${msi('map')}</span><span class="off-tx"><b>${escH((STATE.trips[p.trip] || {}).name || p.name || p.trip)}</b><small>${offMBh(p.have.bytes)}${SEP}${tmFmt('date', p.at)}${p.status !== 'done' ? (SEP + 'לא הסתיים') : ''}${shared ? (SEP + 'חלק בשימוש גם בטיול אחר (נשאר)') : ''}</small></span><button type="button" class="icon-btn btn-copy" data-act="offSet.offrm" data-offrm="${escH(p.trip)}" aria-label="מחיקה">${msi('delete', { size: 18 })}</button></div>`; }).join('') : '<p class="sh-hint">אין מפות שהורדו ("מפות לבלי רשת" בפעולות ⋯ של טיול).</p>');
  const memo = regMemoSizes(), photos = trips.filter(t => memo[t.id]); // 📷 the trips that keep photos
  return `<div class="st-sum" id="stSum"><p class="st-used"><b id="stUsed">…</b> <small id="stFree"></small></p><div class="off-meter st-meter"><div id="stBar" style="width:0%"></div></div><p class="sh-hint st-warn" id="stWarn" hidden>${warnIc()} נשאר מעט מקום: פחות מ-10% מהמקום של האפליקציה. אפשר לפנות כאן מה שנטען שוב מהרשת.</p></div>
    ${maps}
    ${hdr('refresh', 'נטען שוב מהרשת כשצריך')}
    ${MAP_AVAILABLE ? stRowHTML('visibility', 'אריחי מפה שנשמרו בדרך', 'offViewed', `<button type="button" class="btn-sec" id="offViewClear" data-act="offSet.offViewClear">${msi('delete_sweep', { size: 18 })} ניקוי</button>`) : ''}
    ${stRowHTML('public', 'נשמר מהרשת', 'stNet', stClearBtn('data-act="offSet.stNetClear"'))}<p class="sh-hint st-sub">תמונות של מקומות שנפתחו, רקעי מפה של הטיולים וכתובות שכבר נמצאו.</p>
    ${hdr('person', 'שלך')}
    ${photos.map(t => `<div class="off-row st-row"><span class="off-ic">${msi('photo_library')}</span><span class="off-tx"><b>${escH(t.name || t.id)}</b><small data-stphotos="${escH(t.id)}">…</small></span>${stGoBtn(`data-act="offSet.stMem" data-v="${escH(t.id)}"`, 'לזיכרונות')}</div>`).join('') || `<div class="off-row st-row"><span class="off-ic">${msi('photo_library')}</span><span class="off-tx"><b>תמונות הזיכרונות</b><small>אין תמונות שמורות</small></span></div>`}
    ${stRowHTML('luggage', 'טיולים ויעדים', 'stMine', stGoBtn('data-act="offSet.stBackup"', 'לגיבוי'))}
    ${stRowHTML('delete', 'הסל', 'stTrash', stGoBtn('data-act="offSet.stTrash"', 'לסל'))}
    <div class="st-app">${stRowHTML('install_mobile', 'האפליקציה עצמה', 'stApp')}<p class="sh-hint st-sub">הקבצים, ספריית המפה והגופנים. נדרשים כדי שהאפליקציה והמפות יעבדו גם בלי רשת.</p></div>`; }
const stSize = (x, n) => x.known ? offMB(x.bytes) : x.bytes ? `${offMB(x.bytes)} לפחות (חלק לא נמדד)` : 'לא ניתן למדוד את הגודל'; // Q5: never 0 for what cannot be measured
// the rows' sizes, measured; the top's total is their sum (item 8), the space left from the browser
async function stFill() { const g = id => document.getElementById(id); if (!g('stSum')) return;
  const ps = Object.values(OFF_PACKS), tiles = MAP_AVAILABLE ? await regTilesSize() : { bytes: 0, known: true }, net = await regNetSize(), memo = regMemoSizes(), mine = await regMineSize(), trash = regTrashSize(), app = await regAppSize();
  const rows = [{ bytes: MAP_AVAILABLE ? ps.reduce((a, p) => a + p.have.bytes, 0) : 0, known: true }, tiles, net, { bytes: Object.values(memo).reduce((a, b) => a + b, 0), known: true }, { bytes: mine, known: true }, { bytes: trash, known: true }, app];
  const total = { bytes: rows.reduce((a, r) => a + r.bytes, 0), known: rows.every(r => r.known) }; g('stSum').dataset.total = total.bytes;
  g('stUsed').textContent = `האפליקציה תופסת ${stSize(total)}`;
  const sp = await regSpace();
  if (sp) { g('stFree').textContent = `נשארו לה ${offMB(sp.free)} במכשיר`; g('stBar').style.width = Math.min(100, Math.round(100 * total.bytes / (total.bytes + sp.free || 1))) + '%'; g('stWarn').hidden = sp.free / sp.quota >= ST_WARN; }
  else { g('stFree').textContent = 'הדפדפן לא מוסר כמה מקום נשאר'; g('stBar').parentNode.hidden = true; }
  if (g('offViewed')) g('offViewed').textContent = `${stSize(tiles)} מתוך ${offMB(TILES_CAP)}${SEP}${TX.reload}`;
  if (g('stNet')) g('stNet').textContent = `${stSize(net)}${SEP}${TX.reload}`;
  document.querySelectorAll('[data-stphotos]').forEach(e => { e.textContent = offMB(memo[e.dataset.stphotos] || 0); });
  const dests = Object.values(DESTS || {}).filter(d => !d.builtin && !d.ghost).length, trips = Object.keys(STATE.trips || {}).length;
  if (g('stMine')) g('stMine').textContent = `${trips} טיולים${SEP}${dests} יעדים שיובאו${SEP}${offMB(mine)}`;
  if (g('stTrash')) g('stTrash').textContent = `${(STATE.trash || []).length} פריטים${SEP}${offMB(trash)}`;
  if (g('stApp')) g('stApp').textContent = stSize(app); }
function offSettingsCtl() { const ctl = ctlNS('offSet');
  ctl.offrm = b => { const k = b.dataset.offrm; return askSure({ ic: 'delete', title: 'למחוק את המפות שהורדו?', text: 'בלי רשת לא יהיו מפות לטיול הזה. אפשר להוריד שוב כשיש רשת.', ok: 'מחיקה' }, () => { offDeletePack(k).then(() => redrawSoon()); }); }; // 10.13.0 (gap 47): in the dialog
  stFill().catch(() => {});
  ctl.offViewClear = async () => { const t = await regTilesSize(); await regTilesDrop(); showToast(`האריחים שנשמרו בדרך נוקו${t.known ? SEP + offMB(t.bytes) : ''}`); redrawSoon(); };
  ctl.stNetClear = async () => { const n = await regNetSize(); await regNetClear(); geocodeForget(); showToast(`מה שנשמר מהרשת נוקה${n.known ? SEP + offMB(n.bytes) : ''}`); redrawSoon(); };
  ctl.stMem = b => { runTripAction(b.dataset.v, 'memory'); };
  ctl.stBackup = () => { openMenuScreen('sync'); };
  ctl.stTrash = () => { goTab('trash'); };
}
ctlActs('offSet', ['offViewClear', 'offrm', 'stNetClear', 'stMem', 'stBackup', 'stTrash']);
act('storage.open', () => { showToast(null); closeAllSheets(); ACC_OPEN['set-storage'] = true; openMenuScreen('settings'); setTimeout(() => { const h = document.querySelector('.screen-layer #main [data-acc="set-storage"]') || document.querySelector('#main [data-acc="set-storage"]'); if (h) reveal(h, false, { align: 'start', instant: true }); }, 80); }); // storage (Q6): the link of the space message and the download's line

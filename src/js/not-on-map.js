// 7.1.0 (ש11): "🩺 מקומות שלא על המפה" - which places are not on the map and why, as a list Claude can work with (name, address,
// destination, reason; no local #id). What needs fixing in the content is apart from what only waits for the service.
function geocodeDiagnosticHTML() {
  if (!MAP_AVAILABLE) return '';
  return `<div><p>אילו מקומות לא מופיעים על המפה ולמה. מה שצריך תיקון בתוכן (כתובת שלא נמצאה, או בלי כתובת ובלי מיקום) מועתק לבד, כדי לשלוח ל-${AI} או לתקן בעריכה. מקומות שעוד לא נבדקו, או שהשרת היה עמוס, יימצאו לבד.</p>
    <div class="brow export-actions"><button class="btn-nav" id="diagBtn" data-act="diag.run">${msi('monitor_heart', { size: 18 })} בדיקה</button></div>
    <div class="export-box" id="diagResultBox" style="display:none;margin-top:10px;"><div id="diagSum" class="sh-hint"></div>${fmArea({ id: 'diagBox', readonly: true, style: 'min-height:140px;' })}
      <div class="brow export-actions"><button type="button" class="btn-sec" id="copyDiagBtn" data-act="diag.copy">${msi('content_copy', { size: 18 })} העתקה של מה שצריך תיקון</button></div></div>
</div>`;
}
// 7.1.0 (cl-services-impl-plan, ה8): the one list of places that are not on the map - per destination, each with its reason and
// an id relative to its package (portableRef: "@dest:localId", a trip's own place keeps its id). "🩺 מקומות שלא על המפה" reads
// it here; the files for Claude (stage 10) read the same function. fix: a content matter (not found by the address / no address
// and no location); otherwise it only waits for the service (not checked yet, the server did not answer, busy).
function placesOffMap(destId) { const t = activeTripObj() || {}, out = {};
  POINTS.filter(p => !p.planOnly && !p.travel && !(destId && p.dest !== destId)).forEach(p => { const w = offMapWhy(p); if (w) (out[p.dest || ''] = out[p.dest || ''] || []).push({ p, ref: portableRef(p.id, t), ...w }); });
  return out; }
// the judgment for one place (one rule for 🩺, the files and the round)
function offMapWhy(p) { if (p.manualCoord && isFinite(p.manualCoord.lat)) return null;
  if (!p.address) return { why: 'בלי כתובת ובלי מיקום', fix: true };
  if (!(p.address in GEOCODE_CACHE)) return { why: (SVC.gaveUp.geocode || new Set()).has(p.address) ? 'השרת לא ענה, ננסה בפתיחה הבאה' : svcSuffix('geocode', 0) || 'עוד לא נבדק', fix: false };
  if (!GEOCODE_CACHE[p.address]) return { why: 'לא נמצא לפי הכתובת', fix: true };
  return null; }
// 11.14.0 (phone-round-1-fixes P4, decisions 2026-11-14 G3): what a place's window says of a location it does not have yet - by the
// same reasons as offMapWhy: while its lookup waits or runs, a muted "מחפשים מיקום…" with no offer to fix; without network the
// service's own "ממתין לרשת"; the server gave up this time - its reason, muted; only after the lookup really found nothing (or
// there is nothing to look up) the warning with the edit. k: 'search' | 'net' | 'gave' | 'miss' | 'none' | '' (has a location)
function geoLocState(p, has) { if (has) return { k: '' };
  if (!p.address) return { k: 'none', html: warnIc() + ' בלי כתובת ובלי מיקום (עריכה לתיקון)' };
  if (p.address in GEOCODE_CACHE) return GEOCODE_CACHE[p.address] ? { k: '' } : { k: 'miss', html: warnIc() + ' לא נמצא (עריכה לתיקון)' };
  const wait = t => `<span class="net-wait geo-wait">${t}</span>`, sfx = svcSuffix('geocode', 0);
  if (sfx === SVC_WAIT_NET) return { k: 'net', html: wait(msiT('cloud_off', SVC_WAIT_NET, { size: 16 })) };
  if ((SVC.gaveUp.geocode || new Set()).has(p.address) || sfx === 'לא זמין היום') return { k: 'gave', html: wait(sfx === 'לא זמין היום' ? 'השירות לא זמין היום, ננסה מחר' : 'השרת לא ענה, ננסה בפתיחה הבאה') };
  return { k: 'search', html: wait('מחפשים מיקום…') }; }
// the window redraws once the lookup it waits for answers (one hook per window at a time; a lookup that answers at once - no network,
// given up - leaves a state that asks for no hook, so it never loops)
function geoLocHook(c, p) { if (c._geoHook || !p.address) return; c._geoHook = true;
  queueGeocode(p.address, () => { c._geoHook = false; const t = layerTop(); if (t && t.cand === c) winRedraw(); }, c.geoCenter || undefined, p.name); }
// 10 (ה8): the same list for a trip that is not open (its places as they are in the file) and for a draft
function placesOffMapIn(t) { if (STATE.activeTrip === t.id) return [].concat(...Object.values(placesOffMap()));
  const out = [], add = (p, ref, dest) => { const w = offMapWhy(p); if (w) out.push({ p, ref, dest, ...w }); };
  tripDests(t).forEach(did => { const d = DESTS[did]; (d ? d.places : []).forEach(p => add(p, '@' + did + ':' + p.id, did)); });
  (t.places || []).forEach(p => add(p, p.id, p.dest)); return out; }
function draftOffMap(D) { return draftItems(D).filter(x => !D.off[x.key] && (x.scope === 'dest' || x.scope === 'trip')).map(x => { const w = offMapWhy(x.p); return w && { p: x.p, ref: x.scope === 'dest' ? '@' + x.key : x.p.id, dest: x.scope === 'dest' ? x.src : x.p.dest, ...w }; }).filter(Boolean); }
// the file's field: only the two reasons that need fixing (not found, no address) and package-relative references
function unlocatedOut(list) { return list.filter(x => x.fix).map(x => ({ ref: x.ref, name: x.p.name || '', address: x.p.address || '', dest: x.p.dest || x.dest || '', reason: x.p.address ? 'not-found' : 'no-address' })); }
// 🩺 opened from a destination's "N בלי מיקום" line: only that destination (diet-groups: one object here - the settings' part, management, sets its fields)
const DIAG = { dest: '', once: false };
function diagPlaces() { return [].concat(...Object.values(placesOffMap(DIAG.dest))); } // [{p, ref, why, fix}]
act('diag.run', () => {
  const all = diagPlaces(), fix = all.filter(x => x.fix), wait = all.filter(x => !x.fix), dn = p => (DESTS[p.dest] && DESTS[p.dest].meta.name) || (p.trip ? 'הטיול' : '');
  const row = x => [x.p.name, x.p.address || '', dn(x.p), x.why].join(' | ');
  document.getElementById('diagBox').value = fix.length ? 'שם | כתובת | יעד | סיבה\n' + fix.map(row).join('\n') : '';
  document.getElementById('diagSum').innerHTML = `${DIAG.dest ? `רק ${escH(dn({ dest: DIAG.dest }))}${SEP}` : ''}צריך תיקון: <bdi>${fix.length}</bdi>${wait.length ? `${SEP}ממתינים לשירות: <bdi>${wait.length}</bdi> (${escH([...new Set(wait.map(x => x.why))].join(', '))})` : ''}${!all.length ? (SEP + 'כל המקומות על המפה ✓') : ''}`;
  document.getElementById('diagResultBox').style.display = 'block'; return 'quiet'; });
act('diag.copy', () => { const v = document.getElementById('diagBox').value; if (!v) { showToast('אין מה לתקן'); return; } copyWithFallback(v, 'הועתק'); });


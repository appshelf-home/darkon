// THE DESTINATION EDITOR - a destination made in the app (split from trips-screen.js in 11.37.0 by size, nothing reworded)
// 4.0.0: a destination made in the app - name and description are required (two versions of the same place can exist),
// a center for the map, currency and time; it starts with the base layers and no places
// 11.21.4 (backup-ids, Q2): a new destination's id is of the file form - the Latin letters and digits of its name, else "dest", then the time (the name the user sees is unchanged)
function slugId(name) { return (String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'dest') + '-' + Date.now().toString(36); }
// 7.2.0 (ע5, מ7): the destination editor - from the building blocks. Visible: name, "בשביל מי ומה", the map's center (the full
// location block, zoomed to a city); collapsed "מטבע ושעון": country, currency, the clock with "שינוי" (open for a new one).
function openDestEditor(id) { layerNote(openDestEditor, arguments);
  const cur = id ? DESTS[id] : null, m = cur ? cur.meta : {}, sheet = document.getElementById('sheet');
  const F = fmNew({ id, cur, m }), c0 = cur && m.center ? { lat: +m.center[0], lng: +m.center[1] } : null;
  fmReg(F, 'tz', 'raw', cur && m.tzManual && tmZoneOk(m.timeZone) ? m.timeZone : ''); // 7.0.0 (ז11): a hand-picked zone stays
  sheet.innerHTML = `${fmHead(cur ? '✏️ עריכת יעד' : '＋ יעד ריק')}
    ${fmText(F, 'name', { label: 'שם', req: true, value: m.name || '', placeholder: 'למשל: וינה', dup: true, on: () => deDup(F) })}
    ${fmText(F, 'desc', { label: 'בשביל מי ומה', req: true, value: m.description || '', placeholder: 'למשל: 4 ימים בעיר, עם ילדים' })}
    ${fmLoc(F, 'center', { label: 'מרכז המפה', req: true, value: c0, zoom: 'area', kind: 'area', near: () => false, center: c0 ? [c0.lat, c0.lng] : [48, 14], placeholder: 'עיר או אזור, או קואורדינטות', noneText: 'עוד לא נבחר מרכז', on: () => deClock(F), onPick: deAreaPick, ret: F2 => F2 ? { k: 'dest', id: id || null } : null })}<div class="sh-hint de-ccoffer" hidden></div>
    ${fmSec(F, 'money', { title: 'מטבע ושעון', open: !cur, sum: F2 => [deCountryOf(F2) ? withFlag(flagOfCountry(deCountryOf(F2)), countryName(deCountryOf(F2)) || escH(deCountryOf(F2))) : '', escH(fmGet(F2, 'cur')), deZone(F2) ? tmZoneName(deZone(F2).zone) : ''].filter(Boolean).join(SEP) },
      fmPick(F, 'country', { label: 'מדינה (הדגל של היעד)', value: cur ? (m.country || '') : '', text: () => '', open: F2 => openCountryPicker(F2.vals.country, countryOfCurrency({ code: fmGet(F2, 'cur').toUpperCase() }), cc => setTimeout(() => { const F3 = fmOf(); if (F3 && F3.kinds.country) { F3.autoCC = ''; fmSet(F3, 'country', cc); } }, 0)), on: () => { deCountryFill(F); deCountryText(F); deClock(F); deCcOffer(F); } })
      + `<div class="sh-times">${fmText(F, 'cur', { label: 'קוד מטבע', value: (m.currency || {}).code || 'EUR', dir: 'ltr', max: 3, on: () => { deCountryText(F); deOffer(F); } })}${fmText(F, 'curName', { label: 'שם המטבע', value: (m.currency || {}).name || 'אירו', on: () => deOffer(F) })}</div><div class="sh-hint de-offer" hidden></div>`
      + `<div class="sh-field de-clock"><span id="deClock"></span><button type="button" class="chip de-tzbtn" data-act="de.tz">שינוי</button></div>`)}
    ${fmSaveBar({ act: 'de.save', label: cur ? 'שמירה' : 'יצירת היעד' })}`;
  F.curAuto = cur ? null : { code: 'EUR', name: 'אירו' }; // a new destination's currency is the editor's own start - the first country replaces it
  showSheetBackdrop('openDestEditor'); fmAttach(F); deCountryText(F); deClock(F); deDup(F);
}
// 11.14.0 (phone-round-1-fixes P15, G18): choosing the country fills its currency (code and name) and its clock (deZone guesses it from
// the country). What the user typed (a currency that is neither the editor's start nor what a country filled; a clock chosen by hand
// outside the new country) is not replaced: one line under the fields says what the country has, with "להחליף".
// 11.28.0 (area-search Q4): a picked area (the search or the full-screen pick) fills what is still empty - the country (and through it the
// currency and the clock, as choosing it does) and the name (Hebrew where the map has one, else English; psName). Nothing typed is
// replaced: another country already chosen gets a line under the location, "התוצאה ב<country> · להחליף".
// 11.37.0 (P3, G86): what a pick filled (F.autoName, F.autoCC) follows a new pick; a hand choice is kept, with the line
function deAreaPick(r, F) { if (!r || !F) return; const cc = String(r.cc || '').toUpperCase(), nm = fmGet(F, 'name');
  if (r.name && (!nm || (F.autoName && nm === F.autoName))) { fmSet(F, 'name', r.name); F.autoName = r.name; deDup(F); }
  F.ccOffer = ''; if (cc && countryName(cc)) { const was = deCountryOf(F);
    if (!was || (F.autoCC && was === F.autoCC)) { if (was !== cc) fmSet(F, 'country', cc); F.autoCC = cc; } else if (was !== cc) F.ccOffer = cc; }
  deCcOffer(F); }
function deCcOffer(F) { const el = fmQ(F, '.de-ccoffer'); if (!el) return; const cc = F.ccOffer && F.ccOffer !== deCountryOf(F) ? F.ccOffer : '';
  el.hidden = !cc; el.innerHTML = cc ? `<span>התוצאה ב${withFlag(flagOfCountry(cc), escH(countryName(cc)))}</span> <button type="button" class="chip de-offer-go" data-act="de.ccOffer">להחליף</button>` : ''; }
act('de.ccOffer', c => { const F = fmOf(c.el); if (!F || !F.ccOffer) return 'quiet'; const cc = F.ccOffer; F.ccOffer = ''; F.autoCC = ''; fmSet(F, 'country', cc); deCcOffer(F); return 'quiet'; });
function deCountryWants(F) { const cc = deCountryOf(F), c = countryCur(cc), out = {};
  if (c && (fmGet(F, 'cur').toUpperCase() !== c.code || !fmGet(F, 'curName'))) out.cur = c;
  const tz = F.vals.tz, zs = tmZonesOf(cc); if (tz && zs.length && !zs.some(x => x.z === tz)) out.tz = true;
  return out; }
function deCurMine(F) { const code = fmGet(F, 'cur').toUpperCase(), name = fmGet(F, 'curName'), a = F.curAuto;
  return !(!code && !name) && !(a && code === a.code && name === a.name); }
function deCountryFill(F) { const w = deCountryWants(F);
  if (w.cur && !deCurMine(F)) { F.curAuto = w.cur; fmSet(F, 'cur', w.cur.code); fmSet(F, 'curName', w.cur.name); }
  deOffer(F); }
function deOffer(F) { const el = fmQ(F, '.de-offer'); if (!el) return; const w = deCountryWants(F), cc = deCountryOf(F), parts = [];
  if (w.cur) parts.push(`${escH(w.cur.name)} (<bdi dir="ltr">${w.cur.code}</bdi>)`);
  if (w.tz) { const g = tmGuessZone({ country: cc, center: (c => c ? [c.lat, c.lng] : null)(fmGet(F, 'center')) }); if (g) parts.push(`${msi('schedule', { cls: 'msi-in' })} ${escH(tmZoneName(g.zone))}`); }
  el.hidden = !parts.length; if (!parts.length) { el.textContent = ''; return; }
  el.innerHTML = `<span>${withFlag(flagOfCountry(cc), escH(countryName(cc) || cc))}: ${parts.join(SEP)}</span> <button type="button" class="chip de-offer-go" data-act="de.offer">להחליף</button>`; }
act('de.offer', c => { const F = fmOf(c.el); if (!F) return 'quiet'; const w = deCountryWants(F);
  if (w.cur) { F.curAuto = w.cur; fmSet(F, 'cur', w.cur.code); fmSet(F, 'curName', w.cur.name); }
  if (w.tz) F.vals.tz = ''; deCountryText(F); deClock(F); deOffer(F); return 'quiet'; });
const deCountryOf = F => F.vals.country || '';
function deZone(F) { const { cur, m } = F.opts, tz = F.vals.tz; if (tz) return { zone: tz, sure: true, hand: true };
  const c = fmGet(F, 'center'), country = deCountryOf(F), g = tmGuessZone({ country, center: c ? [c.lat, c.lng] : null });
  return g || (cur && tmZoneOk(m.timeZone) && !country ? { zone: m.timeZone, sure: !m.tzEst } : null); }
// 11.10.0: a country that is not a known code is shown as it came - escaped (t1058 found it once the demo carried a country)
function deCountryText(F) { const b = fmQ(F, '[data-fmw="country"] .fm-pick'); if (!b) return; const country = deCountryOf(F), sug = countryOfCurrency({ code: (fmGet(F, 'cur') || '').toUpperCase() });
  b.innerHTML = (country ? withFlag(flagOfCountry(country), countryName(country) || escH(country)) : sug ? `לפי המטבע: ${withFlag(flagOfCountry(sug), countryName(sug))}` : 'בחירת מדינה') + ' ▾'; fmSums(F); }
function deClock(F) { const z = deZone(F), el = fmQ(F, '#deClock'), b = fmQ(F, '.de-tzbtn'); if (!el) return;
  el.innerHTML = z ? `${msi('schedule', { cls: 'msi-in' })} ${tmZoneName(z.zone)}${SEP}עכשיו <bdi>${tmWall(z.zone).hm}</bdi>${SEP}${tmDiffText(z.zone)}${z.sure ? '' : ' ' + symTip('sym.tz', '≈', 'est')}` : `${msi('schedule', { cls: 'msi-in' })} בוחרים מדינה כדי לדעת את השעון${SEP}עד אז שעון ישראל <span class="est" data-act="tz.tip">≈</span>`; // 10.15.0 (F12): line icon
  if (b) b.hidden = !deCountryOf(F) && !(z && z.zone); fmSums(F); }
function deDup(F) { const v = fmGet(F, 'name').toLowerCase(), sim = v ? Object.values(DESTS).filter(d => d.id !== F.opts.id && d.meta.name.trim().toLowerCase() === v) : [];
  fmDup(F, 'name', sim.length ? 'יש כבר במאגר: ' + sim.map(d => `<b>${escH(d.meta.name)}</b>${d.meta.description ? ' (' + escH(d.meta.description) + ')' : ''}`).join(', ') + SEP + 'מותר, אם התיאור שונה' : ''); }
act('de.tz', c => { const F = fmOf(c.el); if (!F) return; openZonePicker(deCountryOf(F), (deZone(F) || {}).zone, zz => setTimeout(() => { const F3 = fmOf(); if (F3 && F3.kinds.tz) { F3.vals.tz = zz; deClock(F3); } }, 0)); return 'quiet'; });
act('de.save', c => { const F = fmOf(c.el); if (!F) return; const { id, cur } = F.opts;
  const name = fmGet(F, 'name'), desc = fmGet(F, 'desc'), cc = fmGet(F, 'center');
  if (!name) return fmFail(F, 'name', 'חסר שם'); if (!desc) return fmFail(F, 'desc', 'חסר תיאור קצר: בשביל מי ומה (יכולות להיות שתי גרסאות של אותו מקום)'); if (!cc) return fmFail(F, 'center', 'בחרו מרכז למפה');
  const center = [+cc.lat.toFixed(6), +cc.lng.toFixed(6)], c0 = cur && cur.meta.center, same = c0 && Math.abs(c0[0] - cc.lat) < 1e-6 && Math.abs(c0[1] - cc.lng) < 1e-6;
  const meta = { ...(cur ? cur.meta : {}), name, description: desc, center: same ? c0 : center, currency: { code: fmGet(F, 'cur').toUpperCase() || 'EUR', name: fmGet(F, 'curName') } };
  const country = deCountryOf(F); if (country) meta.country = country; else delete meta.country;
  { const z = deZone(F); delete meta.tzEst; delete meta.tzManual; // 7.0.0 (ז3, ז11): the zone is the one source
    if (z) { meta.timeZone = z.zone; if (!z.sure) meta.tzEst = 1; if (z.hand) meta.tzManual = 1; } else delete meta.timeZone; }
  c.el.disabled = true; c.el.textContent = 'שומר…';
  if (cur) { DESTS[id] = { ...cur, meta }; saveDests(); closeSheet(); applyActiveTrip();
    showUndoToast('היעד עודכן: ' + name); return; }
  const nid = slugId(name), idBase = Math.max(0, ...Object.values(DESTS).map(d => d.idBase || 0)) + 1e6;
  meta.layers = Object.entries(BASE_TYPES).map(([k, b], i) => ({ id: i + 1, type: k, name: b.name, label: b.label, color: b.color, icon: b.icon }));
  meta.regions = []; meta.theme = { ...NO_DEST.meta.theme };
  DESTS[nid] = { id: nid, version: 1, idBase, meta, places: [], info: '' }; saveDests(); closeSheet(); // undo-history Q6: one row
  showUndoToast('נוצר יעד: ' + name + '. אפשר ליצור לו טיול');
});

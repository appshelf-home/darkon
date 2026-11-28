// ================= THE ⋮ SCREENS: settings, the log (management group, diet-groups 11.62.0; what every screen reads of them is in js/prefs.js) =================
function renderLogScreen() {
  document.getElementById('main').innerHTML = `<div class="section-head"><h2>📜 יומן שינויים</h2><p>השינויים מ-${LOG_DAYS} הימים האחרונים, עם שם המכשיר (נקבע בהגדרות).</p></div>` + logHTML();
}
function renderSettingsScreen() {
  // 10.13.0 (design-screens, gap 53, decisions 2026-11-07-design-gaps Q12, Q14): the top card in the hero's light blue - the app's name,
  // the version line and the copyright line, the small stamp at its end (the place of "about"); the rows grouped under accent headers
  document.getElementById('main').innerHTML = `<div class="section-head"><h2>⚙️ הגדרות</h2></div><div class="set-head"><div class="set-head-t"><b>${APP.appTitle}</b><p class="set-ver">גרסה ${APP_VERSION}${SEP}עודכן ${APP_DATE}</p><p class="set-ver set-copy">${copyrightText().replace(/ (© [\d–]+)$/, (m, c) => `\u00A0<bdi dir="ltr">${c}</bdi>`).replace(COPY_WORDS, w => `<a href="${escH(COPY_REPO)}" target="_blank" rel="noopener">${w}</a>`)}</p><div class="brow set-links">${termsLinkHTML()}<button type="button" class="link-btn" data-act="set.sources">מקורות ורישיונות</button>${siteLinkHTML('terms#access')}</div></div>${logoHTML('s')}</div>` + settingsHTML(); // 10.3.0 (design-3): the version lives here and in ⋮ (no line at the bottom of screens); 11.39.0 (legal-page): the years tied to the word before them (the longer name wrapped "© 2026" alone); under the copyright line, the terms page and "מקורות ורישיונות"; task open-source: the line's words link the public repository (COPY_REPO); task access-statement: "הצהרת נגישות" beside them (the terms page at its anchor)
  if (!DIAG.once) DIAG.dest = ''; else setTimeout(() => { const b = document.getElementById('diagBtn'); if (b) runAct(b); }, 0); DIAG.once = false;
  wireSettings();
}
// any file of the app: trip, destination, backup or edits
// 2.0.0: merge someone else's content edits - review every change, conflicts show both versions
function logHTML() {
  const cutoff = Date.now() - LOG_DAYS * 864e5;
  const items = STATE.log.filter(e => e.at >= cutoff).slice().reverse();
  if (!items.length) return emptyHTML(msi('history'), 'כל שינוי נרשם כאן, עם שם המכשיר.', '', 'עוד אין שינויים');
  let html = '', lastDay = ''; const can = new Set(hChain().map(x => x.u)); // undo-history: the rows of the last 3 days that can still be undone
  items.forEach(e => { // 10.3.0 (design-3): days as group headers, the rows of a day in a card; an undoable row carries only a small undo icon
    const day = tmFmt('pick', tmPhoneDate(e.at));
    if (day !== lastDay) { html += `${lastDay ? '</div>' : ''}<div class="log-day">${day}</div><div class="card log-card">`; lastDay = day; }
    const u = can.has(e.u) ? e.u : null;
    html += `<div class="log-row"><span class="log-time">${tmFmt('stamp', e.at)}</span><span>${sepTie(icText(plainMsg(e.text)))}${e.who ? `<small>${escH(e.who)}</small>` : ''}</span>${u ? `<button type="button" class="top-ic log-undo" data-act="undo.upto" data-v="${u}" aria-label="ביטול עד כאן" title="ביטול עד כאן">${msi('undo')}</button>` : ''}</div>`;
  });
  return `<div class="log-list log-full" id="logList">${html}${lastDay ? '</div>' : ''}</div>`;
}
function landingHTML() {
  const l = landingSettings(), ch = (k, list) => list.map(([v, t]) => `<button type="button" class="chip" data-act="set.landing" data-land="${k}" data-lval="${v}" data-active="${l[k] === v}">${msi(LANDING_MS[v.replace('-today', '')] || 'home', { size: 18 })} ${t}</button>`).join('');
  return `<p>באיזה מסך האפליקציה נפתחת. "היום" פותח עם הסינון של היום (במקומות ובמפה) או עם היום פתוח (בתכנון). בלי בחירה, בימי הטיול נפתח "תכנון${SEP}היום".</p>
    <div class="sh-field">בימי הטיול<div class="chips-row wrap">${ch('trip', LANDING_TRIP)}</div></div>
    <div class="sh-field">לפני הטיול ואחריו<div class="chips-row wrap">${ch('away', LANDING_AWAY)}</div></div>`;
}
act('set.landing', c => { const b = c.el, l = landingSettings(); if (l[b.dataset.land] === b.dataset.lval) return; // undo-history: the current choice again is not a change (no empty row)
  l[b.dataset.land] = b.dataset.lval;
  STATE.settings = { ...STATE.settings, landing: l }; persist();
  showUndoToast('מסך הפתיחה: ' + b.textContent); });
// back-exit (decisions 2026-11-20 · Back on a main screen: press twice to leave the app, Q5): "יציאה מהאפליקציה" - how back leaves from a main
// screen (the guard in layer-manager.js). STATE.settings.backExit: absent = "לחיצה כפולה" (the default), 'once' = "לחיצה אחת"; ring "mine",
// per phone, in a backup's settings part. The section shows only in the installed app (in a browser tab back is the browser's).
const BACK_EXIT = [['twice', 'לחיצה כפולה על חזור'], ['once', 'לחיצה אחת על חזור']];
function backExitSet() { return STATE.settings.backExit === 'once' ? 'once' : 'twice'; }
function backExitVal() { return BACK_EXIT.find(x => x[0] === backExitSet())[1]; } // the row's value line
function backExitHTML() { const cur = backExitSet();
  return `<div class="chips-row wrap" id="bxChips">${BACK_EXIT.map(([v, t]) => `<button type="button" class="chip" data-act="set.backExit" data-bxv="${v}" data-active="${cur === v}" aria-pressed="${cur === v}">${t}</button>`).join('')}</div>
    <p>לחיצה כפולה מונעת יציאה בטעות</p>`; }
act('set.backExit', c => { const v = c.el.dataset.bxv; if (backExitSet() === v) return; // the current choice again is not a change
  const s = { ...STATE.settings }; if (v === 'once') s.backExit = 'once'; else delete s.backExit;
  STATE.settings = s; persist();
  const c2 = document.getElementById('bxChips'); if (c2) { const box = c2.parentElement, row = box.closest('.acc-row'), vl = row && row.querySelector('.acc-val'); box.innerHTML = backExitHTML(); if (vl) vl.textContent = sepTie(backExitVal()); }
  showUndoToast('יציאה מהאפליקציה: ' + backExitVal()); return 'quiet'; });
function textSizeHTML() { const cur = textSizeSet(), f = textFactor(), ch = (v, t) => `<button type="button" class="chip" data-act="set.textSize" data-tsv="${v}" data-active="${cur === v}" aria-pressed="${cur === v}">${t}</button>`;
  return `<div class="chips-row wrap" id="tsChips">${ch('phone', 'כמו בטלפון' + SEP + 'כעת: ' + textSizeName(f))}${TEXT_SIZES.map(([v, t]) => ch(v, t)).join('')}</div>
    <div class="ts-sample" id="tsSample" inert aria-hidden="true">${cdCard({ cls: 'mc-card', lead: leadHTML('place', typeIcon('cafe', { size: 18 }), '#F57C00'), name: 'בית קפה לדוגמה',
      tags: [cdMeta(['בית קפה', 'פתוח עד 22:00'])], desc: '<span class="mc-desc">כך נראים הכרטיסים, הכפתורים והאייקונים בגודל הזה.</span>',
      acts: `<div class="tl-acts mc-acts"><span class="tl-act">${actIc('navigation')}</span><span class="tl-act">${actIc('travel_explore')}</span><span class="tl-act">${actIc('star')}</span></div>` })}</div>`; }
function textSizeVal() { const v = textSizeSet(); return v === 'phone' ? 'כמו בטלפון' : textSizeName(v); } // the row's value line
function textSizeRedraw() { const c = document.getElementById('tsChips'); if (!c) return; const box = c.parentElement, vl = box.closest('.acc-row') && box.closest('.acc-row').querySelector('.acc-val');
  box.innerHTML = textSizeHTML(); if (vl) vl.textContent = sepTie(textSizeVal()); }
act('set.textSize', c => { const raw = c.el.dataset.tsv, v = raw === 'phone' ? 'phone' : Number(raw); if (textSizeSet() === v) { textSizeSync(); return 'quiet'; } // the current choice again is not a change - only the phone's size brought up to date
  const s = { ...STATE.settings }; if (v === 'phone') delete s.textSize; else s.textSize = v;
  STATE.settings = s; persist(); applyTextSize(); textSizeRedraw(); // the chips, the sample and the row's value at once
  showUndoToast('גודל טקסט: ' + (v === 'phone' ? 'כמו בטלפון (' + textSizeName(textFactor()) + ')' : textSizeName(v))); return 'quiet'; });
function prefRowHTML(k, noLabel) { const p = prefs(), [, label, opts] = PREF_DEFS.find(x => x[0] === k);
  if (k === 'backup') return `<div class="view-toggle seg bk-seg" role="group">${opts.map(([v, t]) => `<button type="button" data-act="set.pref" data-pref="${k}" data-pval="${v}" data-active="${p[k] === v}" aria-pressed="${p[k] === v}" aria-label="${t}">${t.replace(/^אחרי /, '').replace(' תזכורת', '')}</button>`).join('')}</div>`; // short words in the segments (שבוע · שבועיים · חודש · בלי), the full one as its name // 10.3.0 (design-3): the reminder as a segmented button
  const sh = PREF_SHORT[k] || {};
  return choiceHTML({ label: noLabel ? '' : label, act: 'set.pref', cur: p[k], attrs: v => ` data-pref="${k}" data-pval="${v}"`, opts: opts.map(([v, t]) => sh[v] ? [v, sh[v], icHTML(t)] : [v, icHTML(t)]) }); } // final-review-fixes (finding 20): a label that names a button draws its line icon (TEXT_MS)
function prefsHTML() {
  return PREF_DEFS.filter(([k]) => k !== 'backup').map(([k]) => prefRowHTML(k)).join('') // 8.0.0 (ק14): the backup reminder is on the backup screen
    + '';
}
act('set.pref', async c => { const b = c.el; {
    const k = b.dataset.pref, v = b.dataset.pval; if (prefs()[k] === v) return; // undo-history: the current choice again is not a change (no empty row)
    if (k === 'sort' && v === 'near' && !userPos) { await requestUserLocation(); if (!userPos) { showToast('לא ניתנה הרשאת מיקום'); return; } }
    STATE.settings = { ...STATE.settings, prefs: { ...(STATE.settings.prefs || {}), [k]: v } };
    if (k === 'sort') FP.sort = v;
    persist(); applyPrefs(); redrawSoon();
    showUndoToast((PREF_DEFS.find(x => x[0] === k)[2].find(o => o[0] === v) || [, b.textContent])[1]);
  } });
function settingsHTML() {
  // 4.3.4: device name comes first
  const gen = accHTML('set-device', '📱 שם המכשיר', `<p>מופיע ביומן השינויים ובקבצים שנשלחים</p><label class="sh-field fm-f">${fmLabel({ label: 'שם המכשיר' })}${fmInput({ id: 'setDeviceName', max: 30, placeholder: 'למשל: הטלפון שלי', value: STATE.settings.deviceName || '' })}</label>`, false, STATE.settings.deviceName || '') // 10.9.0 (design-forms, gaps 31, 33): the label on the border; the row's value line is the name
  + accHTML('set-tsize', '🔠 גודל טקסט', textSizeHTML(), false, textSizeVal()) // text-size (Q4): right after the device name
  + accHTML('set-nlead', '🔤 שם המקומות', nameLeadHTML(), false, NAME_LEAD.find(x => x[0] === nameLeadSet())[1]) // name-lead (Q4): a display setting, beside the text size
  + accHTML('set-landing', '🚪 מסך הפתיחה', landingHTML(), false)
  + (appInstalled() ? accHTML('set-backexit', '🔙 יציאה מהאפליקציה', backExitHTML(), false, backExitVal()) : '') // back-exit (Q5): right after "מסך הפתיחה", the installed app only
  + accHTML('set-prefs', '🎛️ התאמה אישית ' + tipI('set.hidden', true), prefsHTML(), false)
  + accHTML('set-parts', '🕐 חלקי היום', `${choiceHTML({ label: 'הצגה בתכנון', act: 'set.parts', cur: showParts(), attrs: v => ` data-showparts="${v}"`, opts: [[true, 'חלקי היום', 'בוקר, צהריים וערב', 'wb_sunny'], [false, 'רשימה אחת', 'רשימה אחת ליום', 'view_agenda']] })}
    <p>ברשימה אחת אין הפרדה ואין צורך לשבץ לחלק ביום: פריטים עם שעה נכנסים למקום לפי השעה, והשאר נשארים בסדר שקבעתם. מקום שמקבל שעה נכנס לבוקר, לצהריים או לערב לפי שעת ההתחלה שלו.</p>
    <div class="sh-times">
      <label class="sh-field fm-f">${fmLabel({ label: 'סוף הבוקר' })}${fmInput({ id: 'setMorningEnd', type: 'time', step: 900, dir: 'ltr', value: STATE.settings.morningEnd })}</label>
      <label class="sh-field fm-f">${fmLabel({ label: 'סוף הצהריים' })}${fmInput({ id: 'setAfternoonEnd', type: 'time', step: 900, dir: 'ltr', value: STATE.settings.afternoonEnd })}</label>
    </div><div class="sh-error" id="setError" hidden></div>`, false) // 11.14.0 (phone-round-1-fixes P3, decisions 2026-11-14 G1): every settings row starts closed
  + accHTML('set-weather', '🌦️ מזג אוויר', wxSettingsHTML(), false);
  const store = accHTML('set-storage', '💾 ' + TX.storage, offSettingsHTML(), false); // storage (decisions 2026-11-23 · Storage on the phone, Q4): grew out of "מפות בטלפון" (4.39.0); shown also where the map is not available
  const map = accHTML('set-map', SY.map + ' סוג המפה', `${choiceHTML({ id: 'setBaseMaps', list: true, label: 'בכל המפות במכשיר הזה (אפשר להחליף גם בכפתור שבפינת כל מפה)', act: 'set.basemap', cur: baseMapId(), attrs: k => ` data-basemap="${k}"`, opts: Object.entries(BASE_MAPS).map(([k, v]) => [k, v.label, v.sub || '', BASE_MAP_MS[k] || 'map']) })}
      <div class="set-sw-row">${setSwitchHTML('set.mapLight', ` data-v="${!!DEV.mapLight}"`, !DEV.mapLight, 'מפה כהה במצב כהה', 'המפה הרגילה מתכהה כשהאפליקציה כהה. כבוי: היא נשארת בהירה')}</div>
      <label class="sh-field fm-f">${fmLabel({ label: 'מפתח Esri ללוויין', note: '(רשות)' })}${fmInput({ id: 'setEsriKey', dir: 'ltr', data: 'autocomplete="off" spellcheck="false"', placeholder: 'AAPK…', value: String(DEV.esriKey || '') })}</label>
      <div class="sh-hint" id="esriKeyStatus">${esriKeyStatusText()} ${tipI('set.esri')}</div>
      <details class="sh-hint"><summary class="t-wrap">איך מקבלים מפתח (כ-5 דקות)</summary><ol style="margin:6px 0;padding-inline-start:20px">
        <li>נכנסים ל-<a href="https://location.arcgis.com" target="_blank" rel="noopener">location.arcgis.com</a> ונרשמים לחשבון חינמי (ArcGIS Location Platform).</li>
        <li>בלוח הבקרה: <b>Create developer credentials</b> ← <b>API key credentials</b>.</li>
        <li>בוחרים תאריך תפוגה (אפשר עד שנה) ורושמים אותו ביומן.</li>
        <li>בהרשאות מסמנים <b>Location services ← Basemaps</b>: גם Basemap styles service וגם Static basemap tiles.</li>
        <li><b>Generate the API key</b>, מעתיקים (הוא מוצג פעם אחת בלבד) ומדביקים בשדה כאן. האפליקציה בודקת מיד אם הוא עובד.</li>
        <li>כשהמפתח פג: יוצרים חדש באותה דרך ומדביקים במקום הישן. עד אז הלוויין ממשיך דרך המפתח של האפליקציה.</li></ol></details>`, false);
  const hotel = accHTML('set-hotel', '🏨 הלינה במפה', (() => { const h = hotelSettings(), ch = (k, label, opts) => choiceHTML({ label, act: 'set.hotel', cur: h[k], attrs: v => ` data-hset="${k}" data-hval="${v}"`, opts }); // 10.9.0 (design-forms, gap 32): segmented; "above all pins" a switch
      return `<p>הלינה בולטת בכל מפה, גם בטיוטה, ותמיד מוצג גם כששכבת הלינה כבויה. לפני הטיול ואחריו בולטות כל הלינות.</p>
      ${ch('which', 'אילו לינות בולטות בימי הטיול', [['night2', 'שני לילות', 'הלילה והלילה הקודם'], ['night', 'הלילה', 'רק הלילה'], ['all', 'כולן', 'כל הלינות']])}
      ${ch('size', 'גודל', [['s', 'קטן'], ['m', 'בינוני'], ['l', 'גדול']])}
      ${setSwitchHTML('set.hotel', ` data-hset="top" data-hval="${!h.top}"`, h.top, 'מעל כל הסיכות', 'כבוי: סיכה קרובה יכולה לכסות את הלינה')}`; })(), false);
  const diag = (MAP_AVAILABLE ? accHTML('set-diag', '🩺 מקומות שלא על המפה', geocodeDiagnosticHTML(), false) : '') + accHTML('set-svc', '🩺 מצב השירותים', svcHealthHTML(), false); // 7.1.0 (ש11): two parts, each for its purpose
  const plan = accHTML('set-margins', '⏱️ זמן לפני נסיעה ואחריה', marginsSettingsHTML(), false, marginsValLine()) // 11.0.0 (travels-1-model, Q7; picture travels-map-2b, 6)
    + `<div class="set-sw-row">${setSwitchHTML('set.tlRemind', ` data-v="${hintSeen('tl.never')}"`, !hintSeen('tl.never'), 'תזכורת לציר הזמן של גוגל לפני טיול', 'שורה בכרטיס "לקראת הטיול": להדליק אותו, כדי שסגירת הטיול תהיה קלה')}</div>`; // 11.9.0 (timeline-import, Q3): brings back "לא מעניין אותי" (this phone)
  return accGroupHTML('כללי', gen + store) + accGroupHTML('תכנון', plan) + accGroupHTML('מפה', map + hotel) + accGroupHTML('תקלות ושירותים', diag); // 10.13.0 (Q14): groups; 11.0.0: "תכנון"
}
function wireSettings() { try { offSettingsCtl(); } catch (e) {}
  const a = document.getElementById('setMorningEnd'), b = document.getElementById('setAfternoonEnd'), k = document.getElementById('setEsriKey'), dn = document.getElementById('setDeviceName');
  if (a) a.dataset.act = b.dataset.act = 'set.parts.times'; if (k) k.dataset.act = 'set.esriKey'; if (dn) dn.dataset.act = 'set.deviceName'; // fields saved on leaving them
}
act('set.basemap', c => { setBaseMap(c.el.dataset.basemap); return 'redraw'; });
// hebrew-map (Q7 (2)): in dark mode "מפה" is drawn dark (a filter on its tiles, css/maps.css); this phone can keep it light
act('set.mapLight', c => { const dark = c.el.dataset.v === 'true'; if (!DEV.mapLight === dark) return 'quiet'; devSet({ mapLight: !dark }); refreshBaseMaps();
  showUndoToast(dark ? 'המפה מתכהה במצב כהה' : 'המפה נשארת בהירה במצב כהה'); return 'redraw'; });
act('set.weather', c => { const b = c.el, k = b.dataset.wxset, raw = b.dataset.wxval, v = raw === 'true' ? true : raw === 'false' ? false : raw; // 4.17.0
  if (wxSet()[k] === v) return; STATE.settings = { ...STATE.settings, weather: { ...wxSet(), [k]: v } }; persist();
  showUndoToast('ההגדרה עודכנה'); });
act('set.esriKey', c => { const before = DEV.esriKey || '', v = c.el.value.trim(); if (v === before) return;
  devSet({ esriKey: v, esriKeyOk: null, esriKeyAt: 0 }); refreshBaseMaps();
  showUndoToast(v ? 'מפתח Esri נשמר - בודק…' : 'מפתח Esri נמחק');
  checkEsriKey(); return 'redraw'; });
act('set.parts', c => { const v = c.el.dataset.showparts === 'true'; if (v === showParts()) return;
  STATE.settings = { ...STATE.settings, showParts: v }; persist();
  showUndoToast(v ? 'התכנון בבוקר, צהריים וערב' : 'התכנון ברשימה אחת ליום'); });
act('set.parts.times', () => { const a = document.getElementById('setMorningEnd'), b = document.getElementById('setAfternoonEnd'), e = document.getElementById('setError');
  if (!a.value || !b.value || a.value >= b.value) { e.textContent = 'סוף הבוקר צריך להיות לפני סוף הצהריים'; e.hidden = false; return 'quiet'; }
  e.hidden = true;
  if (a.value === STATE.settings.morningEnd && b.value === STATE.settings.afternoonEnd) return 'quiet';
  STATE.settings = { ...STATE.settings, morningEnd: a.value, afternoonEnd: b.value };
  reslotAllTimed(); persist();
  showUndoToast(`חלקי היום: בוקר עד ${a.value}, צהריים עד ${b.value}`); return 'quiet'; });
const HSET = { which: ['hotelWhich', { night2: 'הלילה והלילה הקודם', night: 'רק הלילה', all: 'כל הלינות' }], size: ['hotelSize', { s: 'קטן', m: 'בינוני', l: 'גדול' }], top: ['hotelTop', { true: 'מעל כל הסיכות', false: 'לא מעל כל הסיכות' }] };
// 11.0.0 (travels-1-model, Q7): the time before and after a travel, per kind - "להגיע לפני" (reach the departure point this early) and "לצאת
// אחרי" (from the arrival until leaving the arrival point); each travel can change its own in its editor ("זמן לפני ואחרי")
const MARGIN_KINDS = ['flight', 'train', 'bus', 'ferry', 'car']; // the picture's order: the car (no margin) last
function marginsValLine() { return MARGIN_KINDS.map(k => { const [b, a] = travelMarginDef(k); return `${TRAVEL_MODES[k][1]}: ${marginText(b)} / ${marginText(a)}`; }).join(SEP); }
function marginsSettingsHTML() { const opts = MARGIN_STEPS.map(m => [String(m), marginText(m)]);
  return `<div class="mg-box"><div class="mg-grid"><span class="mg-corner"></span><small class="mg-h">להגיע לפני</small><small class="mg-h">לצאת אחרי</small>${MARGIN_KINDS.map(k => { const d = travelMarginDef(k);
    return `<span class="mg-kind">${msiT(TRAVEL_MS[k], escH(TRAVEL_MODES[k][1]), { size: 20 })}</span>${[0, 1].map(i => fmSelect({ act: 'set.margin', data: `data-mk="${k}|${i}" data-mh="${i ? 'לצאת אחרי' : 'להגיע לפני'}" aria-label="${escH(TRAVEL_MODES[k][1])}: ${i ? 'לצאת אחרי' : 'להגיע לפני'}"`, cls: 'mg-sel', options: opts, value: String(d[i]) })).join('')}`; }).join('')}</div></div>`; }
act('set.margin', c => { const [k, i] = c.el.dataset.mk.split('|'), v = Number(c.el.value), cur = travelMarginDef(k); if (cur[+i] === v) return;
  const m = { ...(STATE.settings.margins || {}) }, row = cur.slice(); row[+i] = v; const d = TRAVEL_MARGIN_DEF[k];
  if (row[0] === d[0] && row[1] === d[1]) delete m[k]; else m[k] = row;
  STATE.settings = { ...STATE.settings, margins: m }; persist();
  showUndoToast(`זמן ${+i ? 'אחרי' : 'לפני'} ${TRAVEL_MODES[k][1]}: ${marginText(v)}`); return 'redraw'; });
act('set.tlRemind', c => { const on = c.el.dataset.v === 'true'; if (on) hintUnmark('tl.never'); else hintMark('tl.never'); showToast(on ? 'התזכורת לציר הזמן חזרה' : 'בלי תזכורת לציר הזמן'); return 'redraw'; });
act('set.hotel', c => { const b = c.el, [key, labels] = HSET[b.dataset.hset], raw = b.dataset.hval, val = b.dataset.hset === 'top' ? raw === 'true' : raw;
  if (String(hotelSettings()[b.dataset.hset]) === raw) return;
  STATE.settings = { ...STATE.settings, [key]: val }; persist();
  showUndoToast('הלינה במפה: ' + labels[raw]); });
act('set.deviceName', c => { const v = c.el.value.trim(); if (v === (STATE.settings.deviceName || '')) return 'quiet'; // undo-history: leaving the field unchanged is not a change (no empty row)
  STATE.settings = { ...STATE.settings, deviceName: v }; persist();
  const vl = c.el.closest('.acc-row') && c.el.closest('.acc-row').querySelector('.acc-val'); if (vl) { vl.textContent = sepTie(v); vl.hidden = !v; } // the row's value line follows
  showUndoToast('שם המכשיר: ' + (v || 'ללא')); return 'quiet'; });
// diet-room: the weather's settings rows (moved from weather.js - only this screen draws them)
function wxSettingsHTML() { const S = wxSet(), ch = (k, label, opts) => choiceHTML({ label, act: 'set.weather', cur: S[k], attrs: v => ` data-wxset="${k}" data-wxval="${v}"`, opts }); // 10.9.0 (design-forms, gap 32): segmented; "feels like" a switch
  return `<p>התחזית לפי התחנה של כל יום, מהיום והלאה. ימים רחוקים מקבלים ממוצע עונתי.</p>
    ${ch('view', 'תצוגת הימים', [['list', 'רשימה'], ['twodays', 'היום ומחר', 'היום ומחר, השאר מתקפלים'], ['picker', 'יום אחד', 'יום אחד בכל פעם']])}
    ${ch('open', 'פתוח מראש', [['today', 'היום', 'הפירוט של היום'], ['none', 'כלום']])}
    ${ch('extra', 'שורות למקומות מהתוכנית', [['rule', 'רחוקים', 'רחוקים (25 ק״מ) או גבוהים (500 מ׳)'], ['keys', 'נק׳ מפתח', 'רק נקודות מפתח ' + SYM_KEY], ['none', 'בלי']])}
    ${ch('wind', 'רוח', [['kmh', 'קמ״ש'], ['ms', 'מטר לשנייה']])}
    ${setSwitchHTML('set.weather', ` data-wxset="feels" data-wxval="${!S.feels}"`, !!S.feels, '"מרגיש כמו"', 'הטמפרטורה המורגשת ליד הטמפרטורה')}`; }

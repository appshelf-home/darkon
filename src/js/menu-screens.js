// 3.3.0: ⋮ screens are short accordions; backup, log and settings each have their own screen
const ACC_OPEN = {};
function accHTML(key, title, body, open, val) { // 10.9.0 (design-forms, gap 33): val - the row's value line (only a real value, e.g. the device name)
  const o = key in ACC_OPEN ? ACC_OPEN[key] : !!open;
  return `<div class="accordion-item acc-row" data-open="${o}"><button class="accordion-header t-wrap" data-act="acc.toggle" data-acc="${key}">${accLead(title, val)} <span class="accordion-arrow">${msi('expand_more')}</span></button><div class="accordion-body">${body}</div></div>`;
}
// 10.4.0 (design-4, look.md "Menu screens"): a menu screen's row - its icon (the title's leading emoji as a line icon), the title, the expand arrow
const ACC_MS = { '📱': 'smartphone', '🔠': 'format_size', '🩺': 'monitor_heart', '🏨': 'hotel', '🚪': 'door_front', '🔙': 'door_open', '💾': 'download_for_offline', '🕐': 'schedule', '🎛️': 'tune', '🌦️': 'partly_cloudy_day',
  '📄': 'description', '🧩': 'extension', '💡': 'lightbulb', '📋': 'list', [SY.map]: 'layers', '✈️': 'flight', '🧭': 'route', [SY.group]: 'groups', '⏱️': 'more_time' };
// 10.15.0 (design-review Q15): the destination file's sections - the app draws its own expand_more and ignores the file's "▾"; a section's
// icon is a line icon named in the file (data-icon, the kit's list); "נציגות ישראל" is a custom Israeli-flag line icon (Material Symbols has
// none); an older file's leading emoji still shows (content, as a flag), with the same fixed gap as an icon
const IL_FLAG_SVG = '<svg class="msi acc-ic il-flag" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><rect x="2.5" y="5" width="19" height="14" rx="1.5"/><path d="M2.5 8h19M2.5 16h19"/><path d="M12 9.3l2.3 4H9.7z M12 14.7l-2.3-4h4.6z" stroke-width="1.2"/></svg>';
function infoSecIcon(n) { return n === 'israel_flag' ? IL_FLAG_SVG : MS_CP[n] ? msi(n, { cls: 'acc-ic' }) : ''; }
function infoHeadFrame(hd) { if (hd.dataset.framed) return; hd.dataset.framed = '1';
  hd.querySelectorAll('.accordion-arrow').forEach(a => a.remove());
  const ic = infoSecIcon(hd.dataset.icon || ''), first = hd.firstChild;
  if (ic) { if (first && first.nodeType === 3) first.data = first.data.replace(/^\s+/, ''); hd.insertAdjacentHTML('afterbegin', ic); }
  else if (first && first.nodeType === 3) { const m = first.data.match(/^\s*((?:\p{Extended_Pictographic}|\p{Regional_Indicator})(?:\uFE0F|\u200D\p{Extended_Pictographic}\uFE0F?|\p{Regional_Indicator})*)\s*/u);
    if (m) { first.data = first.data.slice(m[0].length); hd.insertAdjacentHTML('afterbegin', `<span class="acc-ic acc-emo">${m[1]}</span>`); } }
  if (!hd.querySelector(':scope > .acc-ic')) hd.insertAdjacentHTML('afterbegin', msi('article', { cls: 'acc-ic' })); // final-review Q4: an unknown icon name (or none, and no emoji) - a general icon, so the column of titles stays straight
  const rest = [...hd.childNodes].filter(n => !(n.nodeType === 1 && n.classList.contains('acc-ic')));
  const span = document.createElement('span'); rest.forEach(n => span.appendChild(n)); span.innerHTML = span.innerHTML.trim(); hd.appendChild(span);
  hd.insertAdjacentHTML('beforeend', ` <span class="accordion-arrow">${msi('expand_more')}</span>`); hd.classList.add('t-wrap'); }
function accLead(title, val) { const m = String(title).match(/^\s*([^\s\u0590-\u05FFA-Za-z0-9"(<]+)\s+/), ic = m && (ACC_MS[m[1]] || ACC_MS[m[1].replace(/\uFE0F/g, '')]),
    v = val == null ? '' : `<small class="acc-val"${val ? '' : ' hidden'}>${sepTie(fmEsc(val))}</small>`;
  return ic ? `${msi(ic, { cls: 'acc-ic' })}<span>${String(title).slice(m[0].length)}${v}</span>` : `<span>${title}${v}</span>`; }
// 6.1.0: one action opens and folds every section (accordion); what is remembered: ACC_OPEN by key, ℹ️ כללי by section
act('acc.toggle', c => { const it = c.el.parentElement, o = it.dataset.open !== 'true'; it.dataset.open = String(o);
  if (c.el.dataset.acc) ACC_OPEN[c.el.dataset.acc] = o; else if (activeTab === 'info' && c.el.closest('#main')) INFO_ACC[infoAccKey(it)] = o;
  if (o) reveal(it, false); return 'quiet'; }); // 10.6.0: a disclosure - its content comes into view, focus stays on the header
function renderLogScreen() {
  document.getElementById('main').innerHTML = `<div class="section-head"><h2>📜 יומן שינויים</h2><p>השינויים מ-${LOG_DAYS} הימים האחרונים, עם שם המכשיר (נקבע בהגדרות).</p></div>` + logHTML();
}
function renderSettingsScreen() {
  // 10.13.0 (design-screens, gap 53, decisions 2026-11-07-design-gaps Q12, Q14): the top card in the hero's light blue - the app's name,
  // the version line and the copyright line, the small stamp at its end (the place of "about"); the rows grouped under accent headers
  document.getElementById('main').innerHTML = `<div class="section-head"><h2>⚙️ הגדרות</h2></div><div class="set-head"><div class="set-head-t"><b>${APP.appTitle}</b><p class="set-ver">גרסה ${APP_VERSION}${SEP}עודכן ${APP_DATE}</p><p class="set-ver set-copy">${copyrightText().replace(/ (© [\d–]+)$/, (m, c) => `\u00A0<bdi dir="ltr">${c}</bdi>`).replace(COPY_WORDS, w => `<a href="${escH(COPY_REPO)}" target="_blank" rel="noopener">${w}</a>`)}</p><div class="brow set-links">${termsLinkHTML()}<button type="button" class="link-btn" data-act="set.sources">מקורות ורישיונות</button></div></div>${logoHTML('s')}</div>` + settingsHTML(); // 10.3.0 (design-3): the version lives here and in ⋮ (no line at the bottom of screens); 11.39.0 (legal-page): the years tied to the word before them (the longer name wrapped "© 2026" alone); under the copyright line, the terms page and "מקורות ורישיונות"; task open-source: the line's words link the public repository (COPY_REPO)
  if (!DIAG_ONCE) DIAG_DEST = ''; else setTimeout(() => { const b = document.getElementById('diagBtn'); if (b) runAct(b); }, 0); DIAG_ONCE = false;
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
const LANDING_TRIP = [['points-today', ('מקומות' + SEP + 'היום')], ['map-today', ('מפה' + SEP + 'היום')], ['points', 'מקומות'], ['map', 'מפה'], ['plan', ('תכנון' + SEP + 'היום')], ['info', 'מידע']]; // 10.8.0 (design-icons, gap 65): words; the chip draws the screen's line icon
const LANDING_AWAY = [['info', 'מידע'], ['points', 'מקומות'], ['map', 'מפה'], ['plan', 'תכנון'], ['trips', 'טיולים']];
const LANDING_MS = { points: 'location_on', map: 'map', plan: 'calendar_month', info: 'dashboard', trips: 'luggage' };
const LANDING_DEF = { trip: 'plan', away: 'info' }; // 11.24.0 (small-ui-set A, landing-default; decisions 2026-11-18 · The opening screen's default on trip days): today's plan on a trip day (was 'points-today'); a stored choice is kept
function landingSettings() { const l = STATE.settings.landing || {}; return { trip: LANDING_TRIP.some(x => x[0] === l.trip) ? l.trip : LANDING_DEF.trip, away: LANDING_AWAY.some(x => x[0] === l.away) ? l.away : LANDING_DEF.away }; }
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
// text-size (decisions 2026-11-19 · Text size follows the phone, Q1-Q4): one closed list of sizes, the root font size set from the chosen
// factor (TEXT_ROOT × factor; every --fs-* is rem, so the text, the icons and the heights in rem follow). "כמו בטלפון" (the default, also for
// a phone with nothing stored) reads the phone's text scale - the root's own computed size against TEXT_ROOT (page.html opts in:
// <meta name="text-scale" content="scale">), and when that says 1, env(preferred-text-scale) where the browser has it - and snaps it to the nearest size of the
// list (a tie goes up, above the largest gives the largest, no support gives "רגיל"), so the app is always in a size that was tested. The
// root is set in both modes (no CSS root size cancels the opt-in). Stored per phone in STATE.settings.textSize (ring "mine", in a backup).
const TEXT_SIZES = [[0.9, 'קטן'], [1, 'רגיל'], [1.15, 'גדול'], [1.3, 'גדול מאוד'], [1.5, 'ענק']], TEXT_ROOT = 16;
function textSnap(s) { if (!(s > 0)) return 1; let best = TEXT_SIZES[0][0];
  TEXT_SIZES.forEach(([f]) => { if (Math.abs(s - f) <= Math.abs(s - best) + 1e-9) best = f; }); return best; }
function phoneTextScale() { const de = document.documentElement, keep = de.style.fontSize; de.style.fontSize = '';
  let s = parseFloat(getComputedStyle(de).fontSize) / TEXT_ROOT; // the root as the opt-in (or the browser's own default size) left it
  if (!(Math.abs(s - 1) > 0.005)) try { const p = document.createElement('div'); p.style.cssText = 'position:absolute;visibility:hidden;height:0;width:calc(env(preferred-text-scale, 0) * 1000px)';
    document.body.appendChild(p); const w = p.getBoundingClientRect().width; p.remove(); if (w > 0) s = w / 1000; } catch (e) {} // else the scale the browser reports
  de.style.fontSize = keep; return s > 0 ? s : 1; }
function textSizeSet() { const v = STATE.settings.textSize; return TEXT_SIZES.some(x => x[0] === v) ? v : 'phone'; }
function textFactor() { const v = textSizeSet(); return v === 'phone' ? textSnap(phoneTextScale()) : v; }
function textSizeName(f) { return (TEXT_SIZES.find(x => x[0] === f) || TEXT_SIZES[1])[1]; }
let _tsF = 0; // the factor in effect; a change after the first one tells every fit that measures on 'resize' (chips, "…", titles, the maps)
function applyTextSize() { const f = textFactor(), de = document.documentElement, px = TEXT_ROOT * f + 'px', was = _tsF;
  if (de.style.fontSize !== px) de.style.fontSize = px; de.dataset.ts = String(f); _tsF = f;
  if (was && was !== f) window.dispatchEvent(new Event('resize')); return f; }
function textSizeHTML() { const cur = textSizeSet(), f = textFactor(), ch = (v, t) => `<button type="button" class="chip" data-act="set.textSize" data-tsv="${v}" data-active="${cur === v}" aria-pressed="${cur === v}">${t}</button>`;
  return `<div class="chips-row wrap" id="tsChips">${ch('phone', 'כמו בטלפון' + SEP + 'כעת: ' + textSizeName(f))}${TEXT_SIZES.map(([v, t]) => ch(v, t)).join('')}</div>
    <div class="ts-sample" id="tsSample" inert aria-hidden="true">${cdCard({ cls: 'mc-card', lead: leadHTML('place', typeIcon('cafe', { size: 18 }), '#F57C00'), name: 'בית קפה לדוגמה',
      tags: [cdMeta(['בית קפה', 'פתוח עד 22:00'])], desc: '<span class="mc-desc">כך נראים הכרטיסים, הכפתורים והאייקונים בגודל הזה.</span>',
      acts: `<div class="tl-acts mc-acts"><span class="tl-act">${actIc('navigation')}</span><span class="tl-act">${actIc('travel_explore')}</span><span class="tl-act">${actIc('star')}</span></div>` })}</div>`; }
function textSizeVal() { const v = textSizeSet(); return v === 'phone' ? 'כמו בטלפון' : textSizeName(v); } // the row's value line
function textSizeRedraw() { const c = document.getElementById('tsChips'); if (!c) return; const box = c.parentElement, vl = box.closest('.acc-row') && box.closest('.acc-row').querySelector('.acc-val');
  box.innerHTML = textSizeHTML(); if (vl) vl.textContent = sepTie(textSizeVal()); }
// 11.46.0 (phone-round-4c-fixes P2, G98): with "כמו בטלפון" the phone's size is read live (the chip named it at once) but was applied only at
// startup - a change of the phone's size while the app was open waited for the next opening, and the chip tapped again did nothing. Now the
// size in effect follows what the chip names: when the app comes back to the front (the phone's settings are changed outside it), when
// the window gets the focus back, and when "כמו בטלפון" is tapped again
function textSizeSync() { if (textSizeSet() !== 'phone' || !_tsF) return false; const f = textFactor(); if (f === _tsF) return false; applyTextSize(); textSizeRedraw(); return true; }
sysOn(document, 'visibilitychange', () => { if (!document.hidden) textSizeSync(); }); sysOn(window, 'pageshow', () => textSizeSync()); sysOn(window, 'focus', () => textSizeSync());
act('set.textSize', c => { const raw = c.el.dataset.tsv, v = raw === 'phone' ? 'phone' : Number(raw); if (textSizeSet() === v) { textSizeSync(); return 'quiet'; } // the current choice again is not a change - only the phone's size brought up to date
  const s = { ...STATE.settings }; if (v === 'phone') delete s.textSize; else s.textSize = v;
  STATE.settings = s; persist(); applyTextSize(); textSizeRedraw(); // the chips, the sample and the row's value at once
  showUndoToast('גודל טקסט: ' + (v === 'phone' ? 'כמו בטלפון (' + textSizeName(textFactor()) + ')' : textSizeName(v))); return 'quiet'; });
// 4.12.0: personal preferences (⚙️ הגדרות ← 🎛️ התאמה אישית)
const PREF_DEFS = [
  ['sort', 'מיון ברירת מחדל ברשימה', [['fav', 'מועדפים קודם'], ['alpha', 'א-ב'], ['near', 'קרוב אליי']]],
  ['visited', 'מקומות ש' + TX.visited, [['keep', 'במקומם'], ['end', 'בסוף הרשימה'], ['hide', 'מוסתרים']]],
  ['density', 'כרטיסים', [['normal', 'רגילים'], ['compact', 'צפופים (תיאור בשורה אחת)']]],
  ['backup', 'תזכורת גיבוי', [['7', 'אחרי שבוע'], ['14', 'אחרי שבועיים'], ['30', 'אחרי חודש'], ['0', 'בלי תזכורת']]],
  ['cluster', 'קיבוץ סיכות במפה', [['full', 'מלא (בועות עם מספר במבט רחוק, ומניפה לסיכות צמודות)'], ['fan', 'רק מניפה (סיכות צמודות נפרשות בנגיעה)'], ['off', 'כבוי']]], // 4.31.0; 4.33.0: full is the default
  ['walk', ('זמן ומרחק בין מקומות בתכנון (מסלול אמיתי כשיש רשת; בלי רשת הערכה ≈ לפי קו אוויר × 1.3)' + SEP + 'קצב ההליכה'), [['normal', 'קצב רגיל (4.5 קמ״ש)'], ['slow', 'איטי (3.5 קמ״ש)'], ['fast', 'מהיר (5.5 קמ״ש)'], ['off', 'בלי']]], // 4.21.0
  ['walkMax', 'עד איזה מרחק הולכים ברגל (מעבר לזה - דרך התנועה העיקרית של הטיול)', [['2.5', '2.5\u00A0ק״מ'], ['1.5', '1.5\u00A0ק״מ'], ['4', '4\u00A0ק״מ']]],
  ['selfLoc', 'המיקום שלי במפה', [['1', 'מתעדכן כל דקה'], ['5', 'כל 5 דקות'], ['15', 'כל 15 דקות'], ['off', 'רק בלחיצה על ' + SY.me]]], // 4.20.0
  ['fsReal', 'מסך מלא במפה', [['app', 'בתוך האפליקציה (בלי הודעת יציאה)'], ['real', 'גם בלי פס השעה והסוללה (הטלפון מציג הודעת יציאה)']]], // 4.19.1
];
const PREF_SHORT = { sort: { fav: 'מועדפים' }, visited: { end: 'בסוף' }, density: { compact: 'צפופים' }, cluster: { full: 'מלא', fan: 'רק מניפה' }, walk: { normal: 'רגיל', slow: 'איטי', fast: 'מהיר' },
  selfLoc: { 1: 'כל דקה', 5: '5\u00A0דק׳', 15: '15\u00A0דק׳', off: 'בנגיעה' }, fsReal: { app: 'באפליקציה', real: 'כל המסך' } }; // 10.9.0 (design-forms, gap 32): the segment's word; the full text is the line under the control
function prefs() { const p = STATE.settings.prefs || {}, out = {}; PREF_DEFS.forEach(([k, , opts]) => { out[k] = opts.some(o => o[0] === p[k]) ? p[k] : (k === 'backup' ? '30' : opts[0][0]); }); return out; }
function backupDays() { const d = parseInt(prefs().backup, 10); return d > 0 ? d : Infinity; }
function prefRowHTML(k, noLabel) { const p = prefs(), [, label, opts] = PREF_DEFS.find(x => x[0] === k);
  if (k === 'backup') return `<div class="view-toggle seg bk-seg" role="group">${opts.map(([v, t]) => `<button type="button" data-act="set.pref" data-pref="${k}" data-pval="${v}" data-active="${p[k] === v}" aria-pressed="${p[k] === v}" aria-label="${t}">${t.replace(/^אחרי /, '').replace(' תזכורת', '')}</button>`).join('')}</div>`; // short words in the segments (שבוע · שבועיים · חודש · בלי), the full one as its name // 10.3.0 (design-3): the reminder as a segmented button
  const sh = PREF_SHORT[k] || {};
  return choiceHTML({ label: noLabel ? '' : label, act: 'set.pref', cur: p[k], attrs: v => ` data-pref="${k}" data-pval="${v}"`, opts: opts.map(([v, t]) => sh[v] ? [v, sh[v], icHTML(t)] : [v, icHTML(t)]) }); } // final-review-fixes (finding 20): a label that names a button draws its line icon (TEXT_MS)
function prefsHTML() {
  return PREF_DEFS.filter(([k]) => k !== 'backup').map(([k]) => prefRowHTML(k)).join('') // 8.0.0 (ק14): the backup reminder is on the backup screen
    + '';
}
function applyPrefs() { document.body.classList.toggle('dense', prefs().density === 'compact'); applyTextSize(); } // text-size: the root's size goes with the other preferences (startup, undo of a settings change)
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
  const offm = MAP_AVAILABLE ? accHTML('set-offmaps', '💾 מפות בטלפון', offSettingsHTML(), false) : ''; // 4.39.0
  const map = accHTML('set-map', SY.map + ' סוג המפה', `${choiceHTML({ id: 'setBaseMaps', list: true, label: 'בכל המפות במכשיר הזה (אפשר להחליף גם בכפתור שבפינת כל מפה)', act: 'set.basemap', cur: baseMapId(), attrs: k => ` data-basemap="${k}"`, opts: Object.entries(BASE_MAPS).map(([k, v]) => [k, v.label, v.sub || '', BASE_MAP_MS[k] || 'map']) })}
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
  return accGroupHTML('כללי', gen) + accGroupHTML('תכנון', plan) + accGroupHTML('מפה', map + offm + hotel) + accGroupHTML('תקלות ושירותים', diag); // 10.13.0 (Q14): groups; 11.0.0: "תכנון"
}
// 10.13.0 (design-screens, gap 53, Q14): a menu screen's rows grouped into a card on the grey page under a small header in the accent
function accGroupHTML(title, rows) { return rows ? `<div class="acc-grp-h">${title}</div><div class="accordion acc-grp">${rows}</div>` : ''; }
function wireSettings() { try { offSettingsCtl(); } catch (e) {}
  const a = document.getElementById('setMorningEnd'), b = document.getElementById('setAfternoonEnd'), k = document.getElementById('setEsriKey'), dn = document.getElementById('setDeviceName');
  if (a) a.dataset.act = b.dataset.act = 'set.parts.times'; if (k) k.dataset.act = 'set.esriKey'; if (dn) dn.dataset.act = 'set.deviceName'; // fields saved on leaving them
}
act('set.basemap', c => { setBaseMap(c.el.dataset.basemap); return 'redraw'; });
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
    return `<span class="mg-kind">${msiT(TRAVEL_MS[k], fmEsc(TRAVEL_MODES[k][1]), { size: 20 })}</span>${[0, 1].map(i => fmSelect({ act: 'set.margin', data: `data-mk="${k}|${i}" data-mh="${i ? 'לצאת אחרי' : 'להגיע לפני'}" aria-label="${fmEsc(TRAVEL_MODES[k][1])}: ${i ? 'לצאת אחרי' : 'להגיע לפני'}"`, cls: 'mg-sel', options: opts, value: String(d[i]) })).join('')}`; }).join('')}</div></div>`; }
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


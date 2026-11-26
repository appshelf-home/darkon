// ================= CHOICES EVERY SCREEN READS (split from menu-screens.js in diet-groups, 11.62.0; the settings, log and backup screens stay there, in the management group) =================
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
// none; msi's drawn entry israel_flag, IL_FLAG_SVG in flags-place-types.js); an older file's leading emoji still shows (content, as a flag), with the same fixed gap as an icon
function infoSecIcon(n) { return n === 'israel_flag' || MS_CP[n] ? msi(n, { cls: 'acc-ic' }) : ''; } // one-way (7): the flag is msi's drawn entry
function infoHeadFrame(hd) { if (hd.dataset.framed) return; hd.dataset.framed = '1';
  hd.querySelectorAll('.accordion-arrow').forEach(a => a.remove());
  const ic = infoSecIcon(hd.dataset.icon || ''), first = hd.firstChild;
  if (ic) { if (first && first.nodeType === 3) first.data = first.data.replace(/^\s+/, ''); hd.insertAdjacentHTML('afterbegin', ic); }
  else if (first && first.nodeType === 3) { const m = first.data.match(/^\s*((?:\p{Extended_Pictographic}|\p{Regional_Indicator})(?:\uFE0F|\u200D\p{Extended_Pictographic}\uFE0F?|\p{Regional_Indicator})*)\s*/u);
    if (m) { first.data = first.data.slice(m[0].length); hd.insertAdjacentHTML('afterbegin', `<span class="acc-ic acc-emo">${m[1]}</span>`); } }
  if (!hd.querySelector(':scope > .acc-ic')) hd.insertAdjacentHTML('afterbegin', msi('article', { cls: 'acc-ic' })); // final-review Q4: an unknown icon name (or none, and no emoji) - a general icon, so the column of titles stays straight
  const rest = [...hd.childNodes].filter(n => !(n.nodeType === 1 && n.classList.contains('acc-ic')));
  const span = document.createElement('span'); rest.forEach(n => span.appendChild(n)); span.innerHTML = span.innerHTML.trim(); hd.appendChild(span);
  hd.insertAdjacentHTML('beforeend', ` <span class="accordion-arrow">${msi('expand_more')}</span>`); hd.classList.add('t-wrap'); infoCheckNote(hd); }
// limits-and-safety (D4; decisions 2026-11-24 · Review of the legal-review-2 report, Q12 - an exception to content-may-be-wrong's "a note only
// where content comes in"): the AI-written facts that can hurt a person - the safety and emergency section, Israel's embassy - open with one
// quiet line (wrong.official); by the section's icon, or an older file's title (the words of info-complete's INFO_OLD_TITLE)
const INFO_CHECK = { local_hospital: /בטיחות|חירום|בריאות/, israel_flag: /נציגות|שגרירות|קונסוליה/ };
function infoCheckNote(hd) { const b = hd.nextElementSibling, ic = hd.dataset.icon || '';
  if (!b || !b.classList.contains('accordion-body') || b.querySelector(':scope > .info-check')) return;
  if (INFO_CHECK[ic] || (!ic && Object.values(INFO_CHECK).some(re => re.test(hd.textContent)))) b.insertAdjacentHTML('afterbegin', `<p class="sh-hint info-check">${tipText('wrong.official')}</p>`); }
function accLead(title, val) { const m = String(title).match(/^\s*([^\s\u0590-\u05FFA-Za-z0-9"(<]+)\s+/), ic = m && (ACC_MS[m[1]] || ACC_MS[m[1].replace(/\uFE0F/g, '')]),
    v = val == null ? '' : `<small class="acc-val"${val ? '' : ' hidden'}>${sepTie(escH(val))}</small>`;
  return ic ? `${msi(ic, { cls: 'acc-ic' })}<span>${String(title).slice(m[0].length)}${v}</span>` : `<span>${title}${v}</span>`; }
// 6.1.0: one action opens and folds every section (accordion); what is remembered: ACC_OPEN by key, ℹ️ כללי by section
act('acc.toggle', c => { const it = c.el.parentElement, o = it.dataset.open !== 'true'; it.dataset.open = String(o);
  if (c.el.dataset.acc) ACC_OPEN[c.el.dataset.acc] = o; else if (activeTab === 'info' && c.el.closest('#main')) INFO_ACC[infoAccKey(it)] = o;
  if (o) reveal(it, false); return 'quiet'; }); // 10.6.0: a disclosure - its content comes into view, focus stays on the header
const LANDING_TRIP = [['points-today', ('מקומות' + SEP + 'היום')], ['map-today', ('מפה' + SEP + 'היום')], ['points', 'מקומות'], ['map', 'מפה'], ['plan', ('תכנון' + SEP + 'היום')], ['info', 'מידע']]; // 10.8.0 (design-icons, gap 65): words; the chip draws the screen's line icon
const LANDING_AWAY = [['info', 'מידע'], ['points', 'מקומות'], ['map', 'מפה'], ['plan', 'תכנון'], ['trips', 'טיולים']];
const LANDING_MS = { points: 'location_on', map: 'map', plan: 'calendar_month', info: 'dashboard', trips: 'luggage' };
const LANDING_DEF = { trip: 'plan', away: 'info' }; // 11.24.0 (small-ui-set A, landing-default; decisions 2026-11-18 · The opening screen's default on trip days): today's plan on a trip day (was 'points-today'); a stored choice is kept
function landingSettings() { const l = STATE.settings.landing || {}; return { trip: LANDING_TRIP.some(x => x[0] === l.trip) ? l.trip : LANDING_DEF.trip, away: LANDING_AWAY.some(x => x[0] === l.away) ? l.away : LANDING_DEF.away }; }
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
// 11.46.0 (phone-round-4c-fixes P2, G98): with "כמו בטלפון" the phone's size is read live (the chip named it at once) but was applied only at
// startup - a change of the phone's size while the app was open waited for the next opening, and the chip tapped again did nothing. Now the
// size in effect follows what the chip names: when the app comes back to the front (the phone's settings are changed outside it), when
// the window gets the focus back, and when "כמו בטלפון" is tapped again
function textSizeSync() { if (textSizeSet() !== 'phone' || !_tsF) return false; const f = textFactor(); if (f === _tsF) return false; applyTextSize(); if (groupHas('management')) groupFn('management', 'textSizeRedraw')(); return true; } // diet-groups: the settings' chips are redrawn only when they can be shown
sysOn(document, 'visibilitychange', () => { if (!document.hidden) textSizeSync(); }); sysOn(window, 'pageshow', () => textSizeSync()); sysOn(window, 'focus', () => textSizeSync());
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
function applyPrefs() { document.body.classList.toggle('dense', prefs().density === 'compact'); applyTextSize(); } // text-size: the root's size goes with the other preferences (startup, undo of a settings change)
// 10.13.0 (design-screens, gap 53, Q14): a menu screen's rows grouped into a card on the grey page under a small header in the accent
function accGroupHTML(title, rows) { return rows ? `<div class="acc-grp-h">${title}</div><div class="accordion acc-grp">${rows}</div>` : ''; }

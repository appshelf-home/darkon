// ================= 10.7.0: REPORTS - a problem or an idea from inside the app (task feedback; decisions/2026-11-07-feedback.md Q1-Q8) =================
// diet-groups (11.62.0): the waiting list, reportCan, the count in ⋮, the send and the flush are in js/report-queue.js (main)
// Standard: infra-standalone ("Reports from inside the app"). Two doors - the ⋮ row "דיווח תקלה או רעיון" and the snackbar "משהו השתבש ·
// לדווח" on an unexpected error (errOffer, in the action wiring). One bottom sheet: the kind (תקלה from both doors - the error door
// attaches its error), the text, the photo pair (PHOTOS, place 'report'), folded "פרטים ליצירת קשר" (remembered on this phone) and
// "מה מצורף" (exactly what is sent); required: some text or a photo. The app attaches the versions, the screen and the window open when
// the report was opened, the device, the time, the network, up to 10 recent errors (ERR_RING) and a random device id - never the
// user's content (trips, places, photos, notes, the device's name). Sent through the services client (service 'report', provider
// 'site') as a Netlify Forms submission to the app's own site - the static form "report" in the page's markup is what Netlify detects;
// the first field is one ready line "<short name> · <kind> · <text>". Offline a report waits in the registry row 'reportOut' and goes
// when the network returns ("ממתין לשליחה" in ⋮ until then). Guards (Q8): a honeypot field, 5 an hour per device, the same text within
// a minute once, the "לדווח" offer once per error per opening. A page inside another page (the in-Claude copy) cannot send out: no doors.
// ---- what the app attaches (Q4): taken when the window opens, shown in "מה מצורף" and sent as is ----
function reportContext() { const st = screenTop(), t = layerTop(); return { screen: st ? st.tab : activeTab, win: t && !t.tab ? t.key : '', online: svcOnline(), at: Date.now() }; }
function reportUA(ua) { let m, os = 'אחר', br = 'אחר';
  if ((m = ua.match(/Android\s([\d.]+)/))) os = 'Android ' + m[1];
  else if ((m = ua.match(/(?:iPhone|iPad|iPod)[^)]*OS (\d+)[_.](\d+)/))) os = 'iOS ' + m[1] + '.' + m[2];
  else if (/Macintosh/.test(ua)) os = navigator.maxTouchPoints > 1 ? 'iPadOS' : 'macOS';
  else if (/Windows/.test(ua)) os = 'Windows'; else if (/CrOS/.test(ua)) os = 'ChromeOS'; else if (/Linux/.test(ua)) os = 'Linux';
  if ((m = ua.match(/SamsungBrowser\/(\d+)/))) br = 'Samsung Internet ' + m[1];
  else if ((m = ua.match(/Edg(?:A|iOS)?\/(\d+)/))) br = 'Edge ' + m[1];
  else if ((m = ua.match(/(?:Chrome|CriOS)\/(\d+)/))) br = 'Chrome ' + m[1];
  else if ((m = ua.match(/(?:Firefox|FxiOS)\/(\d+)/))) br = 'Firefox ' + m[1];
  else if ((m = ua.match(/Version\/([\d.]+).*Safari/))) br = 'Safari ' + m[1];
  const kind = /iPad|Tablet/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua)) || os === 'iPadOS' ? 'טאבלט' : /Mobi|iPhone|Android/.test(ua) ? 'טלפון' : 'מחשב';
  return { kind, os, br }; }
function reportDevId() { if (!DEV.repId) { let id = ''; try { id = [...crypto.getRandomValues(new Uint8Array(6))].map(x => x.toString(16).padStart(2, '0')).join(''); } catch (e) { id = Math.random().toString(16).slice(2, 14); } devSet({ repId: id }); } return DEV.repId; }
// 10.7.1 (feedback-look, Q20): plain Hebrew - the screen by its name (REPORT_SCREENS, from the tabs and SCREEN_TITLE), rows grouped as drawn
const REPORT_SCREENS = { info: 'כללי', all: 'מקומות', map: 'מפה', itinerary: 'תכנון', trips: 'טיולים' };
function reportScreen(tab) { return REPORT_SCREENS[tab] || (SCREEN_TITLE[tab] ? SCREEN_TITLE[tab].replace(/^\S+\s+/, '') : tab || '-'); }
function reportDetails(cx, err) { const ua = reportUA(navigator.userAgent || ''), fs = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const rows = [['גרסה', `${APP_VERSION}${SEP}הוראות ל-${AI} ${KIT_FACTS.version}`], ['מסך', `${reportScreen(cx.screen)}${SEP}חלון פתוח: ${cx.win || 'אין'}`],
    ['מכשיר', `${ua.kind}${SEP}${ua.os}${SEP}${ua.br}${SEP}${appInstalled() ? 'מותקנת' : 'בדפדפן'}`],
    ['מסך וטקסט', `${innerWidth}×${innerHeight} ×${Math.round((window.devicePixelRatio || 1) * 100) / 100}${SEP}טקסט ${Math.round(fs / 16 * 100)}%${SEP}${isDarkUI() ? 'כהה' : 'בהירה'}`],
    ['זמן ורשת', `${tmFmt('date', cx.at)} ${tmFmt('stamp', cx.at)}${SEP}${cx.online ? 'יש רשת' : 'אין רשת'}`]];
  if (err) rows.push(['השגיאה', `${err.msg}${SEP}${err.where}${err.part ? SEP + err.part : ''}`]); // arch-guard (2): the part it came from
  rows.push(['מזהה מכשיר', reportDevId()]);
  return rows; }
function reportErrors() { return ERR_RING.slice(-10).map(e => `${tmFmt('stamp', e.at)}${SEP}${e.where}${e.part ? SEP + e.part : ''}${SEP}${e.msg}`); }
// ---- the window (Q3, Q7) ----
function openReport(kind, err, cx) { if (!reportCan()) return; layerNote(openReport, arguments);
  const sheet = document.getElementById('sheet'), F = fmNew({}), c = DEV.repContact || {}; kind = kind || 'bug';
  F.rep = { rows: reportDetails(cx || reportContext(), err), errs: reportErrors() }; F.photo = null; F.extra = () => F.photo ? 1 : 0;
  sheet.innerHTML = `${fmHead('💬 דיווח תקלה או רעיון')}
    ${fmChips(F, 'kind', { value: kind, options: REPORT_KINDS.map(([k, w, ic]) => [k, `${msi(ic, { size: 18 })} ${w}`]), on: v => { const t = fmIn(F, 'text'); if (t) t.placeholder = REPORT_HINT[v] || ''; } })}
    ${fmText(F, 'text', { label: 'תיאור', para: true, rows: 4, max: 3000, placeholder: REPORT_HINT[kind] })}
    <div class="rep-ph" id="repPh">${reportPhotoHTML(F)}</div>
    ${fmSec(F, 'who', { ic: 'person', title: 'פרטים ליצירת קשר', sum: F => reportWho(F) || ('לא חובה' + SEP + 'נשלחים רק עם הדיווח, ונזכרים בטלפון לפעם הבאה') }, fmText(F, 'name', { label: 'שם', value: c.name || '', max: 80 })
      + fmText(F, 'how', { label: 'טלפון או מייל', value: c.how || '', dir: 'ltr', max: 120 }) + fmToggle(F, 'back', { label: 'אפשר לחזור אליי', value: !!c.back }))}
    ${fmSec(F, 'what', { ic: 'attach_file', title: 'מה מצורף ' + tipI('report.what', true), sum: () => 'פרטים טכניים, בלי התוכן שלכם' }, reportWhatHTML(F))}
    ${fmText(F, 'trap', { label: 'לא למלא', trap: true })}
    <p class="sh-hint rep-terms">${REPORT_NOTICE} ${termsLinkHTML('תנאי שימוש ופרטיות', 'rep-terms-a')}</p>
    ${fmSaveBar({ act: 'report.send', label: `שליחה ${msi('send', { size: 18 })}` })}`;
  showSheetBackdrop('openReport'); fmAttach(F); }
// 11.39.0 (legal-page; decisions 2026-11-21 · Review of the legal-review report, Q6, Q14 item 7; the Privacy Protection Law's section 11): the notice
// at the form itself - voluntary, what for, to whom - and the link to the page (who collects it, how long it is kept, the rights and how to ask).
// 11.56.2 (legal-privacy-2, U12; decisions 2026-11-24 · Review of the legal-review-2 report, Q5): one more sentence names the rest of s.11 - the result
// of giving no contact details, who is responsible and how to reach them, the rights to see and correct - all on the linked page (no name here)
const REPORT_NOTICE = 'הכל רשות. הדיווח משמש רק לתיקון ולשיפור האפליקציה, נשמר ב-Netlify (האתר של האפליקציה) ובמייל, ונמחק לכל המאוחר אחרי שנה. בלי פרטי קשר לא נוכל לחזור אליכם. מי אחראי, איך פונים, והזכות לעיין ולתקן - בדף:';
function reportWho(F) { return [fmGet(F, 'name'), fmGet(F, 'how')].filter(Boolean).map(x => escH(x)).join(SEP); }
function reportWhatHTML(F) { const r = F.rep;
  return `<p class="sh-hint">יוצא רק מה שכתבתם, התמונה ופרטי הקשר אם מילאתם, ועוד:</p><dl class="rep-what">${r.rows.map(([k, v]) => `<div><dt>${k}</dt><dd><bdi>${escH(v)}</bdi>${k === 'מזהה מכשיר' ? '<small>מספר אקראי, לא מזהה אתכם</small>' : ''}</dd></div>`).join('')}`
    + `<div><dt>שגיאות</dt><dd>${r.errs.length ? `<span>${r.errs.length} אחרונות</span>` + r.errs.map(x => `<bdi>${escH(x)}</bdi>`).join('') : 'אין'}</dd></div></dl>`; }
function reportPhotoHTML(F) { return (F.photo ? photoDraftHTML(F.photo, { act: 'report.photoView', cls: 'rep-thumb', label: 'הגדלת התמונה' }) : photoAddHTML('report.photo', { words: true })) + '<small class="rep-phl">תמונה' + SEP + 'לא חובה</small>'; }
function reportPhotoPaint(F) { const el = document.getElementById('repPh'); if (el) el.innerHTML = reportPhotoHTML(F); }
act('report.open', () => { closeMenu(); if (reportQueue().length && svcOnline()) reportFlush(); openReport('bug', null, reportContext()); return 'quiet'; }); // a tap also sends what waits, at once
act('report.err', c => { showToast(null); openReport('bug', ERR_RING.find(e => String(e.id) === c.v) || null, reportContext()); return 'quiet'; });
act('report.photo', async c => { const F = fmOf(c.el); if (!F) return; const [url] = await photoRead(c.el, PHOTO_PLACES.report.px); if (!url) return;
  F.photo = url; reportPhotoPaint(F); fmErrClear(F, 'text'); });
act('report.photoView', c => { const F = fmOf(c.el); if (F && F.photo) openPhotoView({ url: F.photo, place: 'report', del: 'report.photoDel' }); return 'quiet'; });
act('report.photoDel', () => { closePhotoView(); const F = fmOf(); if (F) { F.photo = null; reportPhotoPaint(F); } return 'quiet'; });
// ---- sending (Q5, Q8) ----
function reportHash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h.toString(36); }
act('report.send', c => { const F = fmOf(c.el); if (!F) return;
  if (fmGet(F, 'trap')) { closeSheet(); showToast('נשלח, תודה'); return 'quiet'; } // the honeypot: a robot filled it - nothing goes out
  const text = fmGet(F, 'text'), kind = fmGet(F, 'kind');
  if (!text && !F.photo) return fmFail(F, 'text', 'כותבים כמה מילים או מצרפים תמונה');
  const now = Date.now(), sent = (DEV.repSent || []).filter(x => now - x.at < REPORT_HOUR), h = reportHash(text + '|' + (F.photo ? F.photo.length : 0));
  if (sent.some(x => x.h === h && now - x.at < REPORT_SAME)) { closeSheet(); showToast('הדיווח הזה כבר נשלח, תודה'); return 'quiet'; }
  if (sent.length >= REPORT_MAX) { fmFailLine(F, 'נשלחו הרבה דיווחים מהטלפון הזה, אפשר לנסות שוב בעוד כמה דקות'); return 'quiet'; }
  const who = { name: fmGet(F, 'name'), how: fmGet(F, 'how'), back: !!fmGet(F, 'back') };
  const rec = { id: 'r' + now.toString(36), at: now, kind, text, photo: F.photo || null, who, rows: F.rep.rows, errs: F.rep.errs };
  // kept first: a report never gets lost on the way. 11.37.0 (phone-round-4-fixes P5; decisions/2026-11-20-review-phone-round-3-fixes.md
  // Q1, finding 1): a photo the phone's storage cannot hold is left out of the kept copy (photoLost) - the send from here still carries
  // it; a report that cannot be kept even without it is not counted as kept: the window stays open with what was typed
  const q0 = reportQueue(); let kept = reportQueueSet([...q0, rec]), lost = false;
  if (!kept && rec.photo) { kept = reportQueueSet([...q0, { ...rec, photo: null, photoLost: true }]); lost = kept; }
  if (!kept) { fmFailLine(F, 'לא הצלחנו לשמור את הדיווח בטלפון - אפשר לנסות שוב'); return 'quiet'; }
  devSet({ repContact: who, repSent: [...sent, { at: now, h }] });
  c.el.disabled = true; const W = reportWait(c.el); // wait-look (Q2): the one "in progress" component (state 1), the button's own "שולח…" gone
  return Promise.race([reportSend(rec), new Promise(res => setTimeout(() => res('later'), REPORT_WAIT_MS))]).then(r => {
    W.done(); closeSheet(); showToast(r === 'ok' ? 'נשלח, תודה' : r === 'offline' ? (lost ? 'יישלח כשתחזור הרשת, בלי התמונה (לא היה לה מקום בטלפון). אפשר לצרף אותה שוב בדיווח חדש' : 'יישלח כשתחזור הרשת')
      : lost ? 'הדיווח נשלח ברקע. אם השליחה תיכשל, הוא יישלח שוב בלי התמונה' : 'הדיווח נשלח ברקע'); }); }); // P8: online and slow (a photo) - it goes on in the background
// wait-look (decisions 2026-11-23 · One "in progress" look for every screen that waits on an outside service, Q2): the send waits with the
// one component - the bar under the window's head and the stage line "שולחים את הדיווח…" above the save bar (state 1)
function reportWait(btn) { const sh = btn.closest('#sheet'), bar = btn.closest('.sheet-save-bar'); if (!sh || !bar) return waitOn(null);
  let ln = sh.querySelector('.rep-wait'); if (!ln) { ln = document.createElement('div'); ln.className = 'rep-wait'; bar.before(ln); }
  return waitOn(sh, { head: sh.querySelector(':scope > .sheet-head'), line: ln, stage: 'שולחים את הדיווח' }); }
// ================= END REPORTS =================

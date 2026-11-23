// ================= 10.7.0: REPORTS - a problem or an idea from inside the app (task feedback; decisions/2026-11-07-feedback.md Q1-Q8) =================
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
const REPORT_KINDS = [['bug', 'תקלה', 'bug_report'], ['idea', 'רעיון', 'lightbulb'], ['q', 'שאלה', 'help']];
const REPORT_HINT = { bug: 'מה קרה, ומה ציפיתם שיקרה?', idea: 'מה היה עוזר לכם?', q: 'מה רציתם לדעת?' };
const REPORT_MAX = 5, REPORT_HOUR = 36e5, REPORT_SAME = 6e4, REPORT_KEEP = 10, REPORT_WAIT_MS = 15000;
var REPORT_BUSY = new Set(); // reports on their way now (a send from the window and a flush never send one twice)
function reportCan() { try { if (window.self !== window.top) return false; } catch (e) { return false; } return /^https?:$/.test(location.protocol); }
function reportQueue() { const q = regRead('reportOut', []); return Array.isArray(q) ? q : []; }
function reportQueueSet(q) { const ok = regWrite('reportOut', q.slice(-REPORT_KEEP)); reportMenuSync(); return ok; } // 11.37.0 (P5): whether the write held
// 11.34.0 (phone-round-3-fixes P10, G79 - reopens G58): a report on its way counts from the moment its send runs (REPORT_BUSY), also
// when the waiting list could not keep it (a photo too big for the phone's storage) - the row shows until it is sent
function reportMenuSync() { const can = reportCan(), b = document.getElementById('reportBtn'), w = document.getElementById('reportWait'), n = can ? new Set([...reportQueue().map(x => x.id), ...REPORT_BUSY]).size : 0;
  if (b) b.hidden = !can; // 10.7.1 (feedback-look, Q20): reports waiting for the network are the row's supporting line, never a row of their own
  const net = !navigator.onLine || REPORT_OFF; // phone-round-2b-fixes P8 (G58, 11.23.2): the words follow the real state - offline (or the last try answered offline) waits for the network; online, the send is in progress or will be tried again
  if (w) { w.hidden = !n; w.textContent = !n ? '' : net ? (n === 1 ? 'דיווח אחד ממתין לרשת' : `${n} ממתינים לרשת`) : (n === 1 ? 'דיווח אחד נשלח ברקע' : `${n} נשלחים ברקע`); } }
var REPORT_OFF = false; // the last try answered 'offline'
// ---- what the app attaches (Q4): taken when the window opens, shown in "מה מצורף" and sent as is ----
function reportContext() { const st = screenTop(), t = layerTop(); return { screen: st ? st.tab : activeTab, win: t && !t.tab ? t.key : '', online: navigator.onLine, at: Date.now() }; }
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
  const rows = [['גרסה', `${APP_VERSION}${SEP}הוראות ל-${AI} ${KIT.version}`], ['מסך', `${reportScreen(cx.screen)}${SEP}חלון פתוח: ${cx.win || 'אין'}`],
    ['מכשיר', `${ua.kind}${SEP}${ua.os}${SEP}${ua.br}${SEP}${appInstalled() ? 'מותקנת' : 'בדפדפן'}`],
    ['מסך וטקסט', `${innerWidth}×${innerHeight} ×${Math.round((window.devicePixelRatio || 1) * 100) / 100}${SEP}טקסט ${Math.round(fs / 16 * 100)}%${SEP}${isDarkUI() ? 'כהה' : 'בהירה'}`],
    ['זמן ורשת', `${tmFmt('date', cx.at)} ${tmFmt('stamp', cx.at)}${SEP}${cx.online ? 'יש רשת' : 'אין רשת'}`]];
  if (err) rows.push(['השגיאה', `${err.msg}${SEP}${err.where}`]);
  rows.push(['מזהה מכשיר', reportDevId()]);
  return rows; }
function reportErrors() { return ERR_RING.slice(-10).map(e => `${tmFmt('stamp', e.at)}${SEP}${e.where}${SEP}${e.msg}`); }
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
// at the form itself - voluntary, what for, to whom - and the link to the page (who collects it, how long it is kept, the rights and how to ask)
const REPORT_NOTICE = 'הכל רשות. הדיווח משמש רק לתיקון ולשיפור האפליקציה, נשמר ב-Netlify (האתר של האפליקציה) ובמייל, ונמחק לכל המאוחר אחרי שנה.';
function reportWho(F) { return [fmGet(F, 'name'), fmGet(F, 'how')].filter(Boolean).map(x => _escH(x)).join(SEP); }
function reportWhatHTML(F) { const r = F.rep;
  return `<p class="sh-hint">יוצא רק מה שכתבתם, התמונה ופרטי הקשר אם מילאתם, ועוד:</p><dl class="rep-what">${r.rows.map(([k, v]) => `<div><dt>${k}</dt><dd><bdi>${_escH(v)}</bdi>${k === 'מזהה מכשיר' ? '<small>מספר אקראי, לא מזהה אתכם</small>' : ''}</dd></div>`).join('')}`
    + `<div><dt>שגיאות</dt><dd>${r.errs.length ? `<span>${r.errs.length} אחרונות</span>` + r.errs.map(x => `<bdi>${_escH(x)}</bdi>`).join('') : 'אין'}</dd></div></dl>`; }
function reportPhotoHTML(F) { return (F.photo ? photoDraftHTML(F.photo, { act: 'report.photoView', cls: 'rep-thumb', label: 'הגדלת התמונה' }) : photoAddHTML('report.photo', { words: true })) + '<small class="rep-phl">תמונה' + SEP + 'לא חובה</small>'; }
function reportPhotoPaint(F) { const el = document.getElementById('repPh'); if (el) el.innerHTML = reportPhotoHTML(F); }
act('report.open', () => { closeMenu(); if (reportQueue().length && navigator.onLine) reportFlush(); openReport('bug', null, reportContext()); return 'quiet'; }); // a tap also sends what waits, at once
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
  c.el.disabled = true; c.el.textContent = 'שולח…';
  return Promise.race([reportSend(rec), new Promise(res => setTimeout(() => res('later'), REPORT_WAIT_MS))]).then(r => {
    closeSheet(); showToast(r === 'ok' ? 'נשלח, תודה' : r === 'offline' ? (lost ? 'יישלח כשתחזור הרשת, בלי התמונה (לא היה לה מקום בטלפון). אפשר לצרף אותה שוב בדיווח חדש' : 'יישלח כשתחזור הרשת')
      : lost ? 'הדיווח נשלח ברקע. אם השליחה תיכשל, הוא יישלח שוב בלי התמונה' : 'הדיווח נשלח ברקע'); }); }); // P8: online and slow (a photo) - it goes on in the background
// the submission: the fields of the static form "report", in its order - the first is the ready line for the shelf
function reportForm(rec) { const kindHe = (REPORT_KINDS.find(k => k[0] === rec.kind) || REPORT_KINDS[0])[1], f = new FormData(), w = rec.who || {};
  f.append('form-name', 'report');
  f.append('line', `${APP.appShort} · ${kindHe} · ${String(rec.text || '(תמונה)').replace(/\s+/g, ' ')}`);
  f.append('kind', kindHe); f.append('text', rec.text || '');
  f.append('contact', [w.name, w.how, w.back ? 'אפשר לחזור אליי' : ''].filter(Boolean).join(' · ')); // the report's fields go out as plain text (t1132 SEP_OK)
  f.append('details', rec.rows.map(([k, v]) => k + ': ' + v).join('\n') + (rec.photoLost ? '\n(התמונה לא נשמרה בטלפון)' : '')); // 11.37.0 (P5): a kept copy without its photo says so
  f.append('errors', rec.errs.join('\n'));
  f.append('bot-field', '');
  if (rec.photo) f.append('photo', reportBlob(rec.photo), 'report.jpg');
  return f; }
function reportBlob(u) { const i = u.indexOf(','), bin = atob(u.slice(i + 1)), a = new Uint8Array(bin.length); for (let k = 0; k < bin.length; k++) a[k] = bin.charCodeAt(k);
  return new Blob([a], { type: (u.slice(0, i).match(/data:([^;]+)/) || [])[1] || 'image/jpeg' }); }
// one report out: 'ok' (it left the waiting list) · 'offline' (waits for the network) · 'wait' (an error - tried again at the next opening)
async function reportSend(rec) { if (REPORT_BUSY.has(rec.id)) return 'busy'; REPORT_BUSY.add(rec.id); reportMenuSync();
  try { const r = await svcAsk('report', { key: rec.id, prio: 'screen', build: () => ({ url: location.origin + '/', init: { method: 'POST', body: reportForm(rec) }, as: 'text', ms: 30000 }), parse: () => 'sent' });
    REPORT_OFF = r.kind === 'offline';
    if (r.kind === 'ok') { reportQueueSet(reportQueue().filter(x => x.id !== rec.id)); return 'ok'; }
    reportMenuSync(); return r.kind === 'offline' ? 'offline' : 'wait'; }
  finally { REPORT_BUSY.delete(rec.id); reportMenuSync(); } }
async function reportFlush() { if (!reportCan()) return 0; let n = 0;
  for (const rec of reportQueue()) { const r = await reportSend(rec); if (r === 'ok') n++; else if (r === 'offline') break; }
  return n; }
sysOn(window, 'online', () => { reportFlush(); }); // a system event: the network is back - waiting reports go
setTimeout(() => { reportMenuSync(); reportFlush(); }, 3000); // the opening: what waited from last time
// ================= END REPORTS =================

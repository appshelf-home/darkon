// ================= REPORTS: the waiting list and the send (split from reports.js in diet-groups, 11.62.0; the window, its doors and its fields stay there, in the management group) =================
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
  const net = !svcOnline() || REPORT_OFF; // phone-round-2b-fixes P8 (G58, 11.23.2): the words follow the real state - offline (or the last try answered offline) waits for the network; online, the send is in progress or will be tried again
  if (w) { w.hidden = !n; w.textContent = !n ? '' : net ? (n === 1 ? 'דיווח אחד ממתין לרשת' : `${n} ממתינים לרשת`) : (n === 1 ? 'דיווח אחד נשלח ברקע' : `${n} נשלחים ברקע`); } }
var REPORT_OFF = false; // the last try answered 'offline'
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
svcOnBack(() => { reportFlush(); }); // a system event: the network is back - waiting reports go
setTimeout(() => { reportMenuSync(); reportFlush(); }, 3000); // the opening: what waited from last time

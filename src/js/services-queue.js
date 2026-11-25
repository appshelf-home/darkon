// EXTERNAL SERVICES, continued: the shared queue's client (split from js/services.js at this seam in round6-behaviour, when that part reached its size light)
// ---- the shared queue (legal-server, 11.41.0; decisions 2026-11-21 · Review of the legal-review report, Q12, Q13 item 1) ----
// A provider row with `queue` is asked through the site's function /api/queue (netlify/functions/queue.mjs), which sends the request on at
// the provider's pace for all users together, keeps answers in a shared cache and names the app (User-Agent). Its every answer carries
// X-Queue: 1 - an answer without it (the site's own error page, no function), a 5xx of the function itself or a failure to reach the site
// means "not answered": the queue is skipped for SVC_QUEUE_REST and the request goes to the service directly (background requests at the
// row's `direct` pace). The service's own answers (200, 4xx, 429 / 503 with Retry-After) come back through it as they came; the day's cap
// for all users (429 { error: 'day' }) and a full queue (503 { error: 'busy' }) are "busy" - never a reason to ask directly.
// legal-server-fixes (Q3): so is a timeout of the service at the queue (504 with X-Queue) and Netlify's own rate limit at the edge (429 with no
// X-Queue - SVC_EDGE_WAIT).
const SVC_QUEUE = '/api/queue', SVC_QUEUE_REST = 10 * 60e3, SVC_EDGE_WAIT = 60e3; // the edge's 429: a minute's wait (legal-server-fixes)
function svcQueueDown(prov) { const P = SVC.p[prov]; return !!(P && P.qDownUntil && svcT() < P.qDownUntil); }
function svcQueueLost(prov) { const P = SVC.p[prov]; if (P) P.qDownUntil = svcT() + SVC_QUEUE_REST; }
function svcQueueUrl(prov, url) { const R = PROVIDERS[prov], h = R.hosts.find(x => url.startsWith('https://' + x + '/')); if (!h) return '';
  return SVC_QUEUE + '?p=' + encodeURIComponent(R.queue) + '&u=' + encodeURIComponent(url.slice(('https://' + h + '/').length)); }
async function svcViaQueue(prov, job, req) { // -> true when the queue answered (the job is done or retried), null when it did not
  const qu = svcQueueUrl(prov, req.url); if (!qu || req.as === 'img') return null;
  const ac = window.AbortController ? new AbortController() : null, tm = setTimeout(() => { if (ac) ac.abort(); }, 15000); let r;
  try { r = await fetch(qu, { headers: { ...((req.init || {}).headers || {}) }, signal: ac ? ac.signal : undefined }); }
  catch (e) { clearTimeout(tm); svcQueueLost(prov); return null; } // the site not reached (or too slow): directly - if the phone has no network, that fails too and says so
  clearTimeout(tm);
  // legal-server-fixes (Q3): a 429 without X-Queue is Netlify's own rate limit at the site's edge (60 a minute per caller) - the queue is up, this
  // phone asked too often: a wait of about a minute in the queue, never a reason to go directly
  if (r.status === 429 && !(r.headers && r.headers.get('X-Queue') === '1')) { svcNetBack(prov); svcRetry(job, prov, 'busy', 'HTTP 429 (מגבלת האתר)', SVC_EDGE_WAIT); return true; }
  if (!r.headers || r.headers.get('X-Queue') !== '1' || (r.status >= 500 && r.status !== 503 && r.status !== 504)) { svcQueueLost(prov); return null; }
  svcNetBack(prov); await svcAnswer(prov, job, req, r, ' (התור המשותף)'); return true;
}
// round6-behaviour (decisions 2026-11-24 · Review of chain step 6 `limits-and-safety`, Q1): the site's edge lets one caller 60 requests a minute, every
// provider together (SVC_EDGE_WAIT is its 429). Background requests through the queue (a trip's routes, at the providers' own pace up to about 55 a
// minute) keep to SVC_QUEUE_BG in any minute (SVC_QBG: when each was sent), so a search the person types always has room; the edge is not changed
const SVC_QUEUE_BG = 40, SVC_QBG = [];
function svcQueueBgWait(now) { while (SVC_QBG.length && now - SVC_QBG[0] >= 60e3) SVC_QBG.shift(); return SVC_QBG.length < SVC_QUEUE_BG ? 0 : SVC_QBG[0] + 60e3 - now; }
// ================= END EXTERNAL SERVICES =================

// ================= 🩺 SERVICE HEALTH - the providers' state, today's requests, what is kept and the recent troubles (ש11) =================
// Split from js/services.js at this seam (legal-credits-2, when that part passed its size light); the one client and its registry stay there.
// Mechanism map: `darkon/spec/external-services.md`.
// ---- 🩺 service health (ש11) ----
function svcHealthHTML() { const d = svcDiag(), esc = escH;
  const st = id => svcBlocked(id) ? `<b>חסום עד מחר</b>${SEP}<a href="${esc(PROVIDERS[id].terms.u)}" target="_blank" rel="noopener">התנאים</a>` : svcProvDown(id) ? 'לא מגיעים לשרת' : SVC.p[id].pauseUntil > svcT() ? `${msi('pause', { size: 16, cls: 'msi-in' })} עמוס עוד ${tmFmt('until', SVC.p[id].pauseUntil - svcT())}` : '✓ עובד';
  const provs = Object.keys(PROVIDERS).filter(id => !PROVIDERS[id].viewOnly).map(id => { const R = PROVIDERS[id], n = svcCountToday(id);
    return `<div class="svc-h"><b>${esc(R.name)}</b><span>${st(id)}</span><small>היום <bdi>${n}</bdi>${R.rate.day ? ` מתוך <bdi>${R.rate.day}</bdi>` : ''} בקשות${SVC.p[id].q.length ? `${SEP}<bdi>${SVC.p[id].q.length}</bdi> בתור` : ''}</small></div>`; }).join('');
  const mem = Object.entries(SERVICES).filter(([, S]) => S.memory && REG_BY[S.memory] && REG_BY[S.memory].where.ls).map(([id, S]) => { const r = REG_BY[S.memory], n = Object.keys(regRead(S.memory) || {}).length, cap = /cap:(\d+)/.exec(r.clean);
    return `<div class="svc-h"><b>${esc(S.name)}</b><small>שמור <bdi>${n}</bdi>${cap ? ` מתוך <bdi>${cap[1]}</bdi>` : ''}</small></div>`; }).join('');
  const errs = d.errs.slice(-50).reverse().map(e => `<div class="svc-e"><bdi>${tmFmt('date', e.at)} ${tmFmt('stamp', e.at)}</bdi>${SEP}${esc((PROVIDERS[e.p] || {}).name || e.p)}${SEP}${esc((SERVICES[e.s] || {}).name || e.s)}${SEP}<bdi>${esc(e.why)}</bdi></div>`).join('');
  return `<p class="sh-hint">הספקים, הבקשות של היום, ומה שנשמר בטלפון.</p>${MAP_AVAILABLE ? '<p class="sh-hint"><a href="#" class="svc-diag-link" data-act="set.diagOpen">מקום שלא מופיע על המפה? ← מקומות שלא על המפה ›</a></p>' : ''}
    <div class="svc-hs">${provs}</div><div class="wx-sub"><b>זיכרונות</b></div><div class="svc-hs">${mem}</div>
    <div class="wx-sub"><b>תקלות אחרונות</b></div>${errs || '<p class="sh-hint">אין תקלות.</p>'}
    <button type="button" class="btn-nav btn-ghost" data-act="svc.copyReport">${msi('content_copy', { size: 18 })} העתקת הדוח</button>`; }
function svcReportText() { const d = svcDiag();
  return ['מצב השירותים - ' + APP.appTitle + ' ' + APP_VERSION + SEP + tmFmt('date', Date.now()),
    ...Object.keys(PROVIDERS).filter(id => !PROVIDERS[id].viewOnly).map(id => `${PROVIDERS[id].name}: ${svcBlocked(id) ? 'חסום עד מחר' : SVC.p[id].pauseUntil > svcT() ? 'עמוס' : 'עובד'}${SEP}היום ${svcCountToday(id)}${PROVIDERS[id].rate.day ? '/' + PROVIDERS[id].rate.day : ''}`),
    ...(() => { const bad = []; Object.entries(PROVIDERS).forEach(([id, R]) => PROVIDER_FIELDS.forEach(f => { if (R[f] === undefined) bad.push(id + '.' + f); })); Object.entries(SERVICES).forEach(([id, S]) => SERVICE_FIELDS.forEach(f => { if (S[f] === undefined) bad.push(id + '.' + f); })); return bad.length ? ['שורות חסרות ברישום: ' + bad.join(', ')] : []; })(),
    'תקלות:', ...d.errs.slice(-50).map(e => `${tmFmt('date', e.at)} ${tmFmt('stamp', e.at)}${SEP}${e.p}${SEP}${e.s}${SEP}${e.why}`)].join('\n'); }
act('svc.copyReport', () => { copyWithFallback(svcReportText(), 'הדוח הועתק'); return 'quiet'; });
act('set.diagOpen', () => { ACC_OPEN['set-diag'] = true; setTimeout(() => reveal(document.querySelector('#main [data-acc="set-diag"]'), false, { align: 'start' }), 80); return 'redraw'; }); // 9.6.0 (12ו, batch 14.5)
act('svc.diagPlaces', c => { DIAG.dest = c.v || ''; DIAG.once = true; closeSheet(); ACC_OPEN['set-diag'] = true; goTab('settings'); });
// ================= END SERVICE HEALTH =================

// ---- 💌 recommendations for friends: a message, or a page with a map ----
function recommendItems(id, withBad, withWords) {
  const M = tripMemoryData(id), rate = M.td.rating || {}, order = { love: 0, like: 1, undefined: 2, dislike: 3 };
  const lt = p => ((M.layers || []).find(l => String(l.id) === String(p.layer)) || {}).type || '';
  const logi = p => lt(p) === 'lodging'; // 4.35.1: the lodging & logistics layer (hotel, airport, station) - only when you rated them
  const items = M.visited.filter(p => (withBad || (rate[p.id] || {}).r !== 'dislike') && (!logi(p) || ['love', 'like'].includes((rate[p.id] || {}).r))).map(p => ({ p, r: (rate[p.id] || {}).r, w: withWords ? (rate[p.id] || {}).w : '' }));
  const groups = new Map(); items.sort((a, b) => order[a.r] - order[b.r]).forEach(x => { const k = logi(x.p) ? '🏨 לינה' : (x.p.layer_name || 'מקומות'); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(x); });
  if (groups.has('🏨 לינה')) { const v = groups.get('🏨 לינה'); groups.delete('🏨 לינה'); groups.set('🏨 לינה', v); } // last
  return { M, groups, n: items.length };
}
function openRecommend(id) { layerNote(openRecommend, arguments); // 8.0.0 (ק8): form chips › what › one send (a bottom window, ק11)
  const t = STATE.trips[id], st = tripState(t), F = fmNew({ id }), hasPlan = recPlanDays(id, recommendItems(id, true, false)).length;
  const items = [{ k: 'words', label: 'לכלול את המילים שכתבתי' }, { k: 'bad', label: 'לכלול גם 👎', sub: 'מה שסימנתם ״לא מומלץ״' }].concat(recPhotoKeys(id).size ? [{ k: 'photos', label: 'התמונות של רגעי השיא', sub: 'בדף עם המפה, תמונה קטנה ליד המקום' }] : []).concat(hasPlan ? [{ k: 'plan', label: 'לצרף את התוכנית יום אחר יום', sub: 'מסלול לדוגמה, בדף עם המפה' }] : []);
  partsWin(F, { key: 'openRecommend', title: `💌 המלצות לחברים${SEP}${escH(String(t.name).split(' · ')[0])}`,
    intro: `מה שסימנתם ✓ ${TX.visited}${st === 'during' ? ' עד עכשיו' : ''}, לפי שכבות: ❤️ קודם, אחריהם 👍.`,
    body: [fmChips(F, 'form', { label: 'באיזו צורה', value: 'page', options: [['page', msi('map', { size: 18 }) + ' דף עם מפה'], ['msg', msi('chat', { size: 18 }) + ' הודעה']], on: (v, F2) => { ['plan', 'photos'].forEach(k => { const p = fmQ(F2, `[data-v="opts|${k}"]`); if (p) p.hidden = v !== 'page'; }); } }),
      fmChecks(F, 'opts', { label: 'מה בפנים', items, value: ['words'] })],
    send: { act: 'recommend.send', label: '📤 שליחה' } });
}
act('recommend.send', c => { const F = fmOf(c.el); if (!F) return; const id = F.opts.id, t = STATE.trips[id], o = fmGet(F, 'opts') || [], R = recommendItems(id, o.includes('bad'), o.includes('words'));
  if (!R.n) return fmFailLine(F, 'עוד אין מקומות שסימנתם ✓ ' + TX.visited);
  if (fmGet(F, 'form') === 'page') { sendRecommendPage(id, R, o.includes('plan'), o.includes('photos')); return; }
  const lines = [`💌 המלצות מ${String(t.name).split(' · ')[0]}${t.start ? ` (${tmFmt('month', t.start)})` : ''}`];
  R.groups.forEach((xs, k) => { lines.push('', `*${k}*`); xs.forEach(x => { const cc = snapCoord(x.p); lines.push(`${x.r ? RATE[x.r] + ' ' : '• '}${x.p.name}${x.r === 'dislike' ? ' (לא מומלץ)' : ''}${x.w ? ` - "${x.w}"` : ''}`, `  🧭 ${cc ? navUrl(cc.lat + ',' + cc.lng) : navUrl(x.p.address || x.p.name)}`); }); });
  lines.push('', `— ${APP.appTitle}${SEP}${tmFmt('date', Date.now())}`); const text = lines.join('\n');
  deliverText(text, '💬 ההמלצות הועתקו. מדביקים בוואטסאפ').then(ok => { if (ok === null) return; logEvent('נשלחו המלצות (הודעה): ' + t.name, true); closeSheet(); }); });
// ק10: the trip summary - options in the same shape; checked = what went in before, so without touching the same summary goes out
function openSummaryWin(id) { layerNote(openSummaryWin, arguments);
  const t = STATE.trips[id], F = fmNew({ id }), items = [{ k: 'pic', label: 'תמונת הטיול והמפה', always: true }, { k: 'plan', label: 'התוכנית כפי שהייתה' }, { k: 'words', label: 'המילים שכתבתי' }, { k: 'photos', label: 'התמונות', sub: 'משפיעות על גודל הקובץ' }, { k: 'bad', label: 'לכלול גם 👎', sub: 'מה שסימנתם ״לא מומלץ״' }];
  partsWin(F, { key: 'openSummaryWin', title: `📖 סיכום הטיול${SEP}${escH(String(t.name).split(' · ')[0])}`, intro: 'דף אחד למזכרת: התמונה, המפה, רגעי השיא, מה אהבנו והמספרים.',
    body: [fmChecks(F, 'opts', { label: 'מה בפנים', items, value: ['plan', 'words', 'photos', 'bad'] })], send: { act: 'summary.send', label: '📤 שליחה' } });
}
act('summary.send', c => { const F = fmOf(c.el); if (!F) return; const id = F.opts.id, o = fmGet(F, 'opts') || []; closeSheet();
  sendTripSummary(id, { plan: o.includes('plan'), words: o.includes('words'), photos: o.includes('photos'), bad: o.includes('bad') }); });
// 4.36.0: the trip's plan, day by day, with only the recommended places (for the page's day filter)
function recPlanDays(id, R) {
  const M = R.M, t = M.t, ids = new Set([].concat(...[...R.groups.values()]).map(x => x.p.id)), out = [];
  dayList(t.start, t.end).forEach(d => { const it = (M.td.itinerary || {})[d.key] || {}, seq = ['morning', 'afternoon', 'evening', 'unassigned'].flatMap(k => it[k] || []).filter(i => ids.has(i));
    if (seq.length) out.push({ label: tmFmt('day', d.date), ids: [...new Set(seq)] }); });
  return out;
}
// hidden-data (H3 c): the highlights' photos by place - offered in the window, unchecked; the page carries them only when chosen
function recPhotoKeys(id) { return new Map(mementoData(id).hs.filter(h => h.img && h.placeId != null).map(h => [h.placeId, h.photo])); }
async function sendRecommendPage(id, R, withPlan, withPhotos) {
  if (SUMMARY_BUSY) return; SUMMARY_BUSY = true; showToast('מכין את הדף עם המפה…');
  try {
  const t = STATE.trips[id], e = escH, name = String(t.name).split(' · ')[0], all = [].concat(...[...R.groups.values()]), pts = all.filter(x => snapCoord(x.p));
  const D = mementoData(id), th = D.th;
  const idx = new Map(pts.map((x, i) => [x.p.id, i + 1]));
  // 4.36.0: a live map with numbers that match the list, in the layer's colour (❤️ on what we loved), and its picture for offline
  const fitems = pts.map(x => { const c = snapCoord(x.p); return { lat: c.lat, lng: c.lng, color: x.p.color || '#888', n: idx.get(x.p.id), name: x.p.name, sub: [x.p.layer_name || '', x.r ? RATE[x.r] : '', x.w ? '"' + x.w + '"' : ''].filter(Boolean).join(SEP), love: x.r === 'love', nav: navUrl(c.lat + ',' + c.lng), group: x.p.layer_name || '', desc: x.p.description ? String(x.p.description).slice(0, 220) + (wikiTextOf(x.p) ? SEP + wikiTextCreditText(x.p) : '') : '', q: x.p.name, icon: x.p.icon }; });
  const plan = withPlan ? recPlanDays(id, R).map(d => ({ l: d.label, n: d.ids.map(i => idx.get(i)).filter(Boolean) })).filter(d => d.n.length) : [];
  const pic = fitems.length ? await fileMapPicture(fitems, memKind(D), { tripId: id, th }) : null;
  const photos = new Map(); if (withPhotos) for (const [pid, k] of recPhotoKeys(id)) { const img = await photoPageImg(k, 128); if (img) photos.set(pid, img); } // hidden-data (H3): only when chosen, each a 128 px square cut
  const html = pageHTML({ title: `💌 המלצות${SEP}${name}`, label: 'המלצות', th,
    css: `h1{color:var(--p)}.chips{display:flex;gap:6px;overflow-x:auto;margin:10px 0}.chips button{border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:999px;padding:6px 12px;font:inherit;white-space:nowrap}.chips button[aria-pressed=true]{background:var(--p);color:#fff;border-color:var(--p)}
.it{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:10px 12px;margin:8px 0;display:flex;gap:10px;align-items:center}.it img{width:64px;height:64px;border-radius:10px;object-fit:cover}.it small{display:block;color:var(--soft)}.n{color:#fff;border-radius:50%;min-width:26px;height:26px;display:grid;place-items:center;font-weight:700;font-size:.8rem}
.it a{margin-inline-start:auto;text-decoration:none;font-size:1.3rem}.day{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:8px 12px;margin:6px 0}.day ol{margin:4px 0;padding-inline-start:22px}`,
    head: `<h1>💌 המלצות מ${e(name)}</h1><p>${t.start ? `${tmFmt('range', [t.start, t.end], { year: true })}${SEP}` : ''}❤️ אהבנו${SEP}👍 היה טוב${[...R.groups.values()].some(xs => xs.some(x => x.r === 'dislike')) ? (SEP + '👎 לא מומלץ') : ''}</p>`,
    map: pic ? { pic, data: fmapData(fitems, pic, {}), after: plan.length ? `<div class="chips fmap-ctl" id="days"><button aria-pressed="true" data-d="">כל הימים</button>${plan.map((d, i) => `<button aria-pressed="false" data-d="${i + 1}">${e(d.l)}</button>`).join('')}</div>` : '' } : null,
    body: `<div class="chips" id="layers"><button aria-pressed="true" data-f="">הכל</button>${[...R.groups.keys()].map(k => `<button aria-pressed="false" data-f="${e(k)}">${e(k)}</button>`).join('')}</div>
${plan.length ? `<h2>${SY.days} יום אחר יום</h2>${plan.map(d => `<div class="day"><b>${e(d.l)}</b><ol>${d.n.map(n => `<li>${n}. ${e((pts[n - 1] || {}).p ? pts[n - 1].p.name : '')}</li>`).join('')}</ol></div>`).join('')}` : ''}
${[...R.groups.entries()].map(([k, xs]) => `<section data-l="${e(k)}"><h2>${e(k)}</h2>${xs.map(x => { const c = snapCoord(x.p), img = photos.get(x.p.id);
  return `<div class="it">${idx.has(x.p.id) ? `<span class="n" style="background:${e(x.p.color || '#888')}">${idx.get(x.p.id)}</span>` : ''}${img || ''}<div><b>${x.r ? RATE[x.r] + ' ' : ''}${e(x.p.name)}${x.r === 'dislike' ? (SEP + 'לא מומלץ') : ''}</b>${x.w ? `<small>"${e(x.w)}"</small>` : ''}${x.p.description ? `<small>${e(String(x.p.description).slice(0, 160))}</small>${wikiTextCreditHTML(x.p)}` : ''}</div><a href="${c ? navUrl(c.lat + ',' + c.lng) : navUrl(x.p.address || x.p.name)}" target="_blank" rel="noopener" title="ניווט">🧭</a></div>`; }).join('')}</section>`).join('')}`,
    script: `window.PLAN=${JSON.stringify(plan).replace(/</g, '\\u003c')};var LF='',DF='';
function apply(){document.querySelectorAll('section[data-l]').forEach(function(s){s.hidden=!!LF&&s.dataset.l!==LF;});if(!window.FM)return;var d=DF?PLAN[DF-1]:null;
 window.FM.filter(function(x){if(x.h)return !d;if(d)return d.n.indexOf(x.n)>=0;return !LF||x.g===LF;},d?d.n.map(function(n){var it=FMAP.items.filter(function(x){return x.n===n;})[0];return it?[it.a,it.o]:null;}).filter(Boolean):null);}
document.querySelectorAll('[data-f]').forEach(function(b){b.onclick=function(){LF=b.dataset.f;DF='';document.querySelectorAll('[data-f]').forEach(function(x){x.setAttribute('aria-pressed',String(x===b));});document.querySelectorAll('[data-d]').forEach(function(x){x.setAttribute('aria-pressed',String(x.dataset.d===''));});apply();};});
document.querySelectorAll('[data-d]').forEach(function(b){b.onclick=function(){DF=b.dataset.d?Number(b.dataset.d):'';LF='';document.querySelectorAll('[data-d]').forEach(function(x){x.setAttribute('aria-pressed',String(x===b));});document.querySelectorAll('[data-f]').forEach(function(x){x.setAttribute('aria-pressed',String(x.dataset.f===''));});apply();};});` });
  await sendPage(html, { slug: 'recommendations', name, log: '💌 נשלחו המלצות (דף): ' + t.name, noun: 'הדף', pic, then: closeSheet });
  } finally { SUMMARY_BUSY = false; }
}

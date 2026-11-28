// ---- sharing a trip (ק5-ק11): "📤 שיתוף" opens the choice; each choice opens its own window on top (✕ goes back one step) ----
const SHARE_TO = [['friend', 'לחבר'], ['improve', TX.claude.improve.btn, TX.claude.improve.short], ['me', 'לטלפון אחר שלי']]; // ai-names (Q2): the update's short name
// ק7 / ק9: what is checked for each receiver, every time the window opens (no memory of changes); the trip and its
// destinations are always in
// hidden-data (H4): 'companions' is not a part - the fellow travellers' marks inside "visits", named in their own row; only my own copy takes them by default
const SHARE_PRESET = { friend: ['plan', 'favorites', 'visits', 'edits'], improve: ['edits'], me: ['plan', 'favorites', 'visits', 'companions', 'bookings', 'edits', 'mementos'] };
function shareToChips(F, to, goal) { return fmChips(F, 'to', { label: 'למי', value: to, options: SHARE_TO, on: (v, F2) => { fmSet(F2, 'parts', SHARE_PRESET[v] || [], true); recBoxTo(F2, v); fmSums(F2); shareGoalShow(F2, v === 'improve'); } }); }
// prev-recs (Q6): the box "לצרף את ההמלצות שלי, בלי שם" follows the receiver - checked for a friend, unchecked for an AI and for my other phone
function recBoxTo(F, to) { if (F.kinds.recs) fmSet(F, 'recs', to === 'friend' ? ['mine'] : [], true); }
function recPick(F, to) { return { mine: (fmGet(F, 'recs') || []).includes('mine'), keepIds: to === 'me' }; }
function openTripFile(id, to) { layerNote(openTripFile, arguments);
  const t = STATE.trips[id]; if (!t) return; to = to || 'friend'; const F = fmNew({ id, tt: ['trip', escH(String(t.name).split(' · ')[0])] }), sc = scopeOfTrip(id);
  const offer = partsFor('trip');
  const body = [shareToChips(F, to),
    fmChecks(F, 'parts', { label: 'מה בקובץ', items: tripFileItems(id, partItems(offer, k => PART_INFO[k].count(partOut(k, sc)), ['trip', 'dests'])), value: SHARE_PRESET[to] }),
    t.start ? fmChips(F, 'days', { label: 'הימים בקובץ', options: [['dates', 'תאריכים'], ['days', 'ימים 1, 2, 3…']], value: 'dates', hint: 'ימים: טיול לדוגמה לחבר שייסע בזמן אחר - יום 1, יום 2...; הנסיעות, הלינות והתוכנית לפי מספרי ימים, בלי ההזמנות' }) : '', // 10.4.0 (design-4): a segmented choice (it was the "בלי התאריכים" switch)
    recBoxHTML(F, to, { tripId: id })]; // prev-recs (Q6): a closed trip only
  partsWin(F, { key: 'openTripFile', title: '', body, goal: 'improve', kind: 'trip', offN: unlocatedOut(placesOffMapIn(t)).length, send: { act: 'tripFile.send', label: '📤 שליחה' }, ref: 'trip:' + id });
  shareGoalShow(F, to === 'improve');
}
// hidden-data (H6, H4): each part's row names the free text it carries (the travellers, the plan's notes, my words - 👎 too), and the fellow
// travellers' names, ratings and words are a row of their own under "היינו ודירוגים" - in the file only when it is checked
function tripFileItems(id, items) { const t = STATE.trips[id] || {}, td = STATE.tripData[id] || {}, rate = Object.values(td.rating || {}), comp = Object.keys(td.companions || {});
  const words = rate.filter(x => x && x.w), notes = Object.values(td.planItems || {}).some(x => x && isNote(x));
  const more = { trip: t.travelers ? 'כולל המטיילים' : '', plan: notes ? 'כולל ההערות בתוכנית' : '', visits: words.length ? 'כולל המילים שכתבתם' + (words.some(x => x.r === 'dislike') ? ', גם ל-👎' : '') : '' };
  const out = items.map(x => more[x.k] ? { ...x, sub: [x.sub, more[x.k]].filter(Boolean).join(SEP) } : x), i = out.findIndex(x => x.k === 'visits');
  if (comp.length && i >= 0) out.splice(i + 1, 0, { k: 'companions', label: 'כולל הדירוגים של ' + comp.map(escH).join(', '), sub: 'השמות, הדירוגים והמילים שלהם, מהסגירה' });
  return out; }
act('tripFile.send', async c => { const F = fmOf(c.el); if (!F) return; const id = F.opts.id, t = STATE.trips[id], picks = ['trip', 'dests'].concat(fmGet(F, 'parts') || []), to = fmGet(F, 'to');
  const obj = buildTripFile(id, picks, fmGet(F, 'days') === 'days', to === 'improve' ? 'improve' : null, recPick(F, to));
  if (await shareJson(obj, `${PACK.fileName}-trip-${fileStamp()}.json`)) { logEvent(`נשלח טיול (${(SHARE_TO.find(x => x[0] === to) || [, ''])[1]}): ${t.name}`, true); closeSheet(); } });
// a destination (ק12): the same shape - receiver chips, the destination always in, ☑ my edits in it (checked for everyone)
function openDestFile(did, to, o) { layerNote(openDestFile, arguments); o = o || {}; // 11.43.0 (info-complete, item 2): o.request - the request written in the window (the General screen's row)
  const d = DESTS[did]; if (!d) return; to = to || 'friend'; const F = fmNew({ did, tt: ['dest', (destFlag(did) ? destFlag(did) + ' ' : '') + escH(d.meta.name)] }), sc = { trips: new Set(), dests: new Set([did]) };
  const body = [fmChips(F, 'to', { label: 'למי', value: to, options: SHARE_TO, on: (v, F2) => { recBoxTo(F2, v); shareGoalShow(F2, v === 'improve'); } }),
    fmChecks(F, 'parts', { label: 'מה בקובץ', items: [{ k: 'dests', label: escH(d.meta.name), always: true }, { k: 'edits', label: 'העריכות שלי ביעד', count: PART_INFO.edits.count(partOut('edits', sc)) }], value: ['edits'] }),
    recBoxHTML(F, to, { did })]; // prev-recs (Q6): when one of my closed trips touched it
  partsWin(F, { key: 'openDestFile', title: '', body, goal: 'improve', intro: o.request ? `<div class="cl-part"><b>הבקשה ל-${AI}:</b> ${escH(o.request)}. היא נכנסת לקובץ לבד - אין צורך לכתוב אותה.</div>` : '', kind: 'dest', offN: unlocatedOut(placesOffMap(did)[did] || []).length, send: { act: 'destFile.send', label: '📤 שליחה' } });
  shareGoalShow(F, to === 'improve');
}
act('destFile.send', async c => { const F = fmOf(c.el); if (!F) return; const did = F.opts.did, d = DESTS[did], withEdits = (fmGet(F, 'parts') || []).includes('edits');
  const obj = buildDestinationFile(did, withEdits, fmGet(F, 'to') === 'improve', recPick(F, fmGet(F, 'to')));
  if (await shareJson(obj, `${PACK.fileName}-destination-${d.id}-${fileStamp()}.json`)) { logEvent('נשלח יעד: ' + d.meta.name, true); closeSheet(); } });
function tripMementosOut(id) { const sc = scopeOfTrip(id), t = STATE.trips[id], items = {};
  PART_BY.mementos.rows.forEach(r => { if (REG_BY[r].where.idb === 'memo') Object.assign(items, rowOut(r, sc)); });
  return Object.keys(items).length ? { items: JSON.parse(mapPicTokens(JSON.stringify(items), x => portableRef(x, t))) } : null; }

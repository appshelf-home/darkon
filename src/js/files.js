// ================= 8.0.0: FILES - one route in, one shape for every window of a file (cl-files-impl-plan, ק1-ק23) =================
// diet-groups (11.62.0): the door's rules, the info allowlist, the once passes, twoCardsHTML, glueText and importDoorHTML are in js/file-rules.js (main)
// ---- the one route in (ק3): the file decides where it lands, never the door ----
// door: 'import' (📥 ייבוא קובץ) · 'restore' (♻️ שחזור מקובץ) · 'paste' · 'share' (sharing to the installed app) · 'launch' ·
// 'closing' (a companion's marks, ctx.tripId) · 'bundle' (a newer trip of a group site). Returns true when the file was taken.
// one-way (13): the door's first step, once - the BOM off, JSON.parse, the app's mark. { data } = a file of the app; otherwise data is null
// and why says which: 'unreadable' (not JSON, or empty) or 'notOurs' (JSON of something else) - each door keeps its own message.
function parseAppText(text) { let v = null; try { v = JSON.parse(String(text).replace(/^\uFEFF/, '')); } catch (e) {}
  return !v ? { data: null, why: 'unreadable' } : v.app === BACKUP_APP ? { data: v, why: null } : { data: null, why: 'notOurs' }; }
function fileTooOld(data) {
  if (data.parts) return data.format !== BACKUP_FORMAT && data.format !== BACKUP_FORMAT_PREV && data.format !== BACKUP_FORMAT_OLD;
  if (data.kind !== 'trip' && data.kind !== 'destination') return false;
  return !!(data.appVersion && versionLess(data.appVersion, FILE_MIN_APP)) || !!(data.personal && data.personal.refs !== 'dest');
}
// diet-mechanism: a file whose way goes through the AI group - a new trip or destination (its draft), a round, a proposal (alone or in a trip)
function incomingAI(d) { return d.kind === 'proposal' || !!d.round || !!d.proposal || needsDraft(d); }
function openIncoming(data, door, ctx) {
  ctx = ctx || {};
  if (!data || data.app !== BACKUP_APP) { showToast('זה לא קובץ של ' + APP.appTitle); return false; }
  if (incomingAI(data) && !groupHas('ai')) { groupWait('ai', () => openIncoming(data, door, ctx)); return true; } // diet-mechanism: a file for the AI group (a draft, a round, a proposal) waits for its group, then goes this way
  FILE_DROPPED = 0; fileIdsFix(data, idsTaken()); // 11.21.4 (backup-ids, Q1): an id or key not of the form is converted, not refused - the user sees nothing
  if (!fileIdsOk(data)) { showToast('בקובץ יש מזהה לא תקין, ולכן הוא לא נפתח. כדאי לבקש מה-' + AI + ' לבנות אותו שוב'); return true; } // 11.8.1: ids go into attributes as they are (after the conversion: never expected)
  fileClean(data); fileRefsClean(data); tvStopsClean(data); // final-review-followups (miss b): before anything reads the file; 11.12.0: references; along-drive: a drive's stops
  if (FILE_DROPPED) data._dropped = FILE_DROPPED; else delete data._dropped; // A6: what the closed sets dropped - the summary's line
  if (data && data.trip && typeof data.trip === 'object') travelsMerge(data.trip); // 11.0.0 (travels-1-model, Q16): a program line that is one of the travels is one record (the draft lists it once)
  if (data.minAppVersion && versionLess(APP_VERSION, data.minAppVersion)) { showToast(`הקובץ מגרסה חדשה יותר (${data.minAppVersion}). מעדכנים קודם את האפליקציה`); return true; }
  if (fileTooOld(data)) { showToast(TX.tooOld); return true; }
  fileUp(data);
  if (draftFromClaude(data)) hintMark('claude.back'); // 9.6.0 (12ו, batch 13.2): a file came back from Claude - the "איך" steps fold from now on; 11.21.0 (review of the night chain Q7): the one "from Claude" test, so a friend's file or a backup does not fold them
  if (draftFromClaude(data)) kitSeenFile(data.kitVersion); // skill-install (Q4): the newest kitVersion an AI wrote, kept on this device
  // item 7 (review of 11.11.0): a file with no summary window reports what was dropped in its own message (fileDroppedNote, data._dropped)
  if (data.kind === 'memento-art') { viaGroup('memories', 'receiveMementoArt', data); return true; } // 4.30.0: to the memory screen
  if (data.kind === 'proposal') { viaGroup('ai', 'receiveProposal', data); return true; } // 11.5.0 (schedule-proposal): to the top of its trip's plan
  if (data.round && viaGroup('ai', 'roundMatchesDraft', data)) { viaGroup('ai', 'mergeRound', data); return true; } // 4.27.0: a round comes back to its draft
  if (data.round) { const r = data; setTimeout(() => viaGroup('ai', 'showRoundReplies', r), 1200); data = viaGroup('ai', 'stripRoundFile', data); }
  if (door === 'closing' && data.kind === 'trip' && ctx.tripId && companionFits(data, ctx.tripId)) { openReceive(data, { tripId: ctx.tripId, only: ['visits', 'favorites'], companion: true }); return true; }
  if (needsDraft(data)) { viaGroup('ai', 'startDraft', data, door === 'share' || door === 'launch' ? 'share' : door === 'paste' ? 'paste' : 'file'); return true; }
  if (data.kind === 'trip' || data.kind === 'destination') { openReceive(data, { door }); return true; }
  if (data.kind === 'memento') { showToast('זה קובץ תמונת הטיול ששולחים ל-' + AI + '. את הקובץ שחוזר ממנו (הגרסה המאוירת) פותחים כאן'); return true; }
  if (data.parts) { openRestore(data); return true; }
  showToast('זה לא קובץ של ' + APP.appTitle); return false;
}
// the doors (ק15, ק16): a file picker at once; "או הדבקת תוכן" opens a small window; inside Claude the picker can't open,
// so the door opens the paste window straight away
act('import.file', async c => { const f = c.el.files && c.el.files[0], door = c.v || 'import'; c.el.value = ''; if (!f) return 'quiet'; const ctx = door === 'closing' && CLOSING ? { tripId: CLOSING.id } : {};
  const reading = await fmReading(c.el); let data = null; // P12: the line shows before the read, until the file is parsed
  try { let text; try { text = await f.text(); } catch (e) { showToast('הקובץ לא נקרא: ' + e.message); return; }
    const p = parseAppText(text); if (p.why === 'unreadable') { showToast('זה לא קובץ של ' + APP.appTitle); return; } data = p.data; } finally { reading(); } // not ours: openIncoming says so
  openIncoming(data, door, ctx); redrawSoon(); });
act('import.paste', c => { openPasteSheet(c.v || 'import'); return 'quiet'; });
// 11.34.0 (phone-round-3-fixes P13, G82; decisions 2026-11-20 · The open bugs of phone round 3, Q1): the 9.3.0 guess - a picker that
// closed within 0.7 s means "no file picker" - is gone: a real fast cancel set it for good. Only a frame (the in-Claude copy) makes the doors paste only
function openPasteSheet(door) { layerNote(openPasteSheet, arguments); const F = fmNew({ door });
  document.getElementById('sheet').innerHTML = `${fmHead('📋 הדבקת תוכן')}<div class="sh-hint">מדביקים את כל התוכן של קובץ מהאפליקציה, או תוכן שה-${AI} נתן בשיחה במקום קובץ.</div>
    ${fmText(F, 'text', { label: 'התוכן', para: true, rows: 6, dir: 'ltr', raw: true })}
    <div class="sh-error fm-errline" hidden></div><div class="brow export-actions sheet-save-bar"><button type="button" class="btn-nav" id="pasteRead" data-act="import.read">📥 קריאה</button></div>`;
  showSheetBackdrop('openPasteSheet'); fmAttach(F); }
act('import.read', c => { const F = fmOf(c.el); if (!F) return; const t = String(fmGet(F, 'text') || '').trim();
  if (!t) return fmFail(F, 'text', 'התיבה ריקה');
  const p = parseAppText(t), data = p.data; // not ours: openIncoming says so
  if (p.why === 'unreadable') return fmFail(F, 'text', 'לא זיהיתי את התוכן: צריך את כל התוכן של קובץ מהאפליקציה');
  const door = F.opts.door, ctx = door === 'closing' && CLOSING ? { tripId: CLOSING.id } : {}; closeSheet(); setTimeout(() => openIncoming(data, door === 'closing' ? 'closing' : 'paste', ctx), 60); });
// shared to the installed app (share_target) or opened with it (file_handlers): the same route
async function receiveSharedFiles() {
  let names = [];
  try { const c = await regCache(REG_BY.shareInbox.where.cache[0]); const keys = await c.keys();
    for (const k of keys) { const r = await c.match(k); const nm = decodeURIComponent(r.headers.get('X-Name') || ''); names.push(nm);
      const data = parseAppText(await r.text()).data; await c.delete(k); if (data && openIncoming(data, 'share')) return; }
  } catch (e) {}
  showToast(names.length ? `הקובץ ${names[0] || ''} לא נראה כמו קובץ של ${APP.appTitle}` : 'לא הגיע קובץ. אפשר לנסות שוב, או "ייבוא קובץ" במסך הטיולים');
}
// ---- a file of a trip or a destination that is already on the phone (ק18): one window for both ----
function companionFits(data, tid) { const t = STATE.trips[tid]; return !!(t && data.personal && data.trip && (data.trip.id === t.id || tripDests(data.trip).join() === tripDests(t).join())); }
// the parts a trip or destination file holds, in the order of PARTS
function fileParts(data) {
  const out = [], P = data.personal || {}, has = row => (REG_BY[row].where.td || []).some(f => P[f] !== undefined && P[f] !== null && (!Array.isArray(P[f]) || P[f].length) && (typeof P[f] !== 'object' || Object.keys(P[f]).length));
  const dps = data.kind === 'trip' ? (data.destinations || []) : [data.destination].filter(Boolean);
  PART_LIST.forEach(p => {
    if (p === 'trip' && data.kind === 'trip') out.push(p);
    else if (p === 'dests' && dps.length) out.push(p);
    else if (p === 'edits' && dps.some(dp => dp.edits && destEditsAligned(dp) && ['places', 'status', 'layers'].some(k => Object.keys(dp.edits[k] || {}).length))) out.push(p);
    else if (p === 'mementos' && ((data.mementos && Object.keys(data.mementos.items || {}).length) || has('mementoEdits'))) out.push(p);
    else if (['plan', 'favorites', 'visits', 'bookings'].includes(p) && PART_BY[p].rows.some(has)) out.push(p);
  });
  return out;
}
function filePartCount(data, k) { const P = data.personal || {}, dps = data.kind === 'trip' ? (data.destinations || []) : [data.destination].filter(Boolean);
  if (k === 'dests') return dps.length > 1 ? `${dps.length} יעדים` : '';
  if (k === 'plan') { const n = Object.keys(P.itinerary || {}).length; return n ? `${n} ימים` : ''; }
  if (k === 'favorites') return (P.favorites || []).length ? String(P.favorites.length) : '';
  if (k === 'visits') return (P.visited || []).length ? `${P.visited.length} ${TX.places}` : '';
  if (k === 'bookings') return Object.keys(P.bookings || {}).length ? String(Object.keys(P.bookings).length) : '';
  if (k === 'mementos') { const n = Object.keys((data.mementos || {}).items || {}).length; return n ? `${n} תמונות` : ''; }
  if (k === 'edits') { const c = editsConflicts(data); return `${c.n}${c.conf.length ? `${SEP}${c.conf.length} גם אצלכם` : ''}`; }
  return ''; }
// the edits in a file, by this phone's ids: how many, and which were edited here too (ק22)
function editsConflicts(data) {
  const dps = (data.kind === 'trip' ? (data.destinations || []) : [data.destination]).filter(dp => dp && dp.edits && DESTS[dp.id]);
  const inc = { places: {}, status: {}, layers: {}, layerOrder: {} }; dps.forEach(dp => mergeDestEdits(dp, inc));
  const rows = editRows({ edits: inc }); return { n: rows.length, conf: rows.filter(r => r.conflict), rows, inc };
}
function openReceive(data, o) { layerNote(openReceive, arguments); o = o || {};
  const isTrip = data.kind === 'trip', thing = isTrip ? data.trip : data.destination, tid = o.tripId || (isTrip ? thing.id : null);
  const here = isTrip ? STATE.trips[tid] : DESTS[thing.id], name = isTrip ? String((here || thing).name).split(' · ')[0] : (thing.meta || {}).name;
  let parts = (o.only || fileParts(data)).filter(k => !o.only || fileParts(data).includes(k));
  const same = isTrip && here && !o.companion && (thing.version || 1) === (here.version || 1) && parts.every(k => k === 'trip' || k === 'dests') && (!isTrip || JSON.stringify(here.segments) === JSON.stringify(thing.segments));
  if (same || (!isTrip && installDestinationSame(thing))) { // kit-fixes (A2.3): a destination is the same by its content, not by its kept version
    showToast(`${isTrip ? 'הטיול' : 'היעד'} ${name} כבר בטלפון`); return; }
  if (!parts.length) { showToast('אין בקובץ מה שמתאים כאן'); return; }
  const F = fmNew({ data, o }), ctl = { take: o.take || new Set() };
  const who = [data.device ? 'מ' + escH(data.device) : '', data.createdAt ? tmFmt('date', data.createdAt) : '', thing.version ? 'גרסה ' + thing.version : ''].filter(Boolean).join(SEP);
  const conf = parts.includes('edits') ? editsConflicts(data) : null;
  const body = [fmChecks(F, 'parts', { label: o.companion ? 'מה לצרף' : 'מה לקחת מהקובץ', items: partItems(parts, k => filePartCount(data, k)), value: parts }),
    fileDroppedHTML(data._dropped), // A6: the receive summary's one line
    conf && conf.conf.length ? `<div class="sh-hint pw-conf">${conf.conf.length} מהעריכות נערכו גם אצלכם, ושלכם נשאר${ctl.take.size ? ` (חוץ מ-${ctl.take.size} שבחרתם מהקובץ)` : ''}. <button type="button" class="pw-link" data-act="recv.review">לבחור אחד-אחד</button></div>` : ''];
  partsWin(F, { key: 'openReceive', title: `📥 קובץ התקבל${SEP}${escH(name)}${thing.version ? SEP + 'גרסה ' + thing.version : ''}`, intro: `${o.door === 'bundle' ? 'יש גרסה חדשה של הטיול באתר.' : (o.companion ? 'הסימונים של מי שטייל איתכם.' : (isTrip ? 'הטיול' : 'היעד') + ' כבר בטלפון.')}${who ? ' ' + who + '.' : ''}<br>מה שמסומן מתווסף בלי למחוק; מה שלא מסומן לא משתנה.`,
    body, send: { act: 'recv.go', label: o.companion ? '📥 צירוף הסימונים' : 'עדכון' }, more: isTrip && !o.companion ? [{ act: 'recv.copy', label: 'עותק נפרד' }] : [], ctl });
  ctl.conf = conf;
}
function installDestinationSame(dp) { const ex = DESTS[dp.id]; return !!(ex && !dp.edits && JSON.stringify(ex.places) === JSON.stringify(dp.places) && JSON.stringify(ex.meta) === JSON.stringify(dp.meta) && (ex.info || '') === (dp.info || '')); }
act('recv.review', c => { const t = layerTop(), ctl = t && t.ctl; if (!ctl || !ctl.conf) return 'quiet'; const conf = ctl.conf;
  openEditsReview({ edits: conf.inc }, 'הקובץ', { only: conf.conf, take: ctl.take, onPick: set => { ctl.take = set; } }); return 'quiet'; });
act('recv.go', c => receiveApply(c, 'update'));
act('recv.copy', c => receiveApply(c, 'copy'));
function receiveApply(c, mode) {
  const F = fmOf(c.el), t = layerTop(); if (!F || !t) return; const { data, o } = F.opts, picks = fmGet(F, 'parts') || [], take = (t.ctl && t.ctl.take) || new Set();
  if (!picks.length) return fmFailLine(F, 'בחרו לפחות חלק אחד');
  closeSheet();
  if (o.companion) { viaGroup('memories', 'mergeCompanion', o.tripId, data, picks); return; }
  if (data.kind === 'trip') { importTripNow(data, mode, null, '', { picks, take }); if (o.door === 'bundle') { STATE.bundleSeen[data.trip.id] = data.trip.version || 1; persist(); } return; }
  receiveDestination(data, picks, take);
}
function receiveDestination(data, picks, take) {
  const dp = data.destination, nj = picks.includes('dests') ? addJoinFile(data, true) : 0; // add-key (Q3): a place an AI completed for one I added joins mine
  if (picks.includes('dests')) installDestination(dp);
  let n = 0; if (picks.includes('edits') && dp.edits) { const e = JSON.parse(JSON.stringify(STATE.edits)); n = mergeDestEdits(dp, e, take); STATE.edits = e; ensureEditsShape(); refreshLayers(); }
  persist(); showUndoToast(`היעד ${dp.meta.name} עודכן מקובץ${n ? ` (+${n} עריכות)` : ''}${addJoinedText(nj)}`); // undo-history Q6: one row
}
// ---- the edits of someone else, one by one (ק22; was a box in the backup screen): what was edited here too is shown with
// my version and stays mine unless checked ----
// 10.9.0 (design-forms, gap 45, design-gaps Q9): a row per edited thing (taken whole); its title says what and which fields, its line the change
// when one field changed, a new place's layer and region; no emoji
const EDIT_FIELD_HE = { name: 'שם', layer: 'שכבה', address: 'כתובת', description: 'תיאור', transit: 'איך מגיעים', reservation: 'הזמנה', price: 'מחיר', manualCoord: 'מיקום', mapsUrl: 'קישור', icon: 'סמל', region: 'אזור', key: 'נקודת מפתח', color: 'צבע', emoji: 'סמל', order: 'סדר' };
const statusWord = s => STATUS_LABEL[s] || 'פעיל';
function editRows(inc) {
  const e = (inc && inc.edits) || { places: {}, status: {} }, rows = [], esc = escH;
  const nm = (id, ent) => (ent && ent.data && ent.data.name) || ((POINTS.find(p => p.id === Number(id)) || {}).name) || baseNameOf(id) || ('#' + id);
  const fields = d => [...new Set(Object.keys(d || {}).filter(k => EDIT_FIELD_HE[k]).map(k => EDIT_FIELD_HE[k]))].join(', ');
  const short = v => typeof v === 'string' && v && v.length <= 40 ? v : '';
  Object.entries(e.places || {}).forEach(([id, ent]) => { const mine = STATE.edits.places[id]; if (mine && JSON.stringify(mine.data) === JSON.stringify(ent.data)) return;
    const p = POINTS.find(q => q.id === Number(id)) || {}, d = ent.data || {}, ks = Object.keys(d).filter(k => EDIT_FIELD_HE[k]);
    let label, sub = '';
    if (ent.op === 'del') label = `${esc(nm(id, ent))}${SEP}נמחק`; // 11.18.0 (place-hide-delete Q2)
    else if (ent.op === 'add') { label = `${esc(nm(id, ent))}${SEP}מקום חדש`; sub = [d.layer != null ? (layerDef(Number(d.layer)) || {}).name : '', d.region || ''].filter(Boolean).map(esc).join(SEP); }
    else { label = `${esc(p.name || nm(id))}${SEP}${fields(d) || 'עריכה'}`; if (ks.length === 1 && short(p[ks[0]]) && short(d[ks[0]])) sub = `<bdi>${esc(p[ks[0]])}</bdi> ← <bdi>${esc(d[ks[0]])}</bdi>`; }
    rows.push({ kind: 'place', id, ent, conflict: !!mine, label, sub, mineLabel: mine ? nm(id, mine) : '' }); });
  Object.entries(e.status || {}).forEach(([id, ent]) => { const mine = STATE.edits.status[id]; if (mine && mine.s === ent.s && (mine.note || '') === (ent.note || '')) return;
    rows.push({ kind: 'status', id, ent, conflict: !!mine, label: `${esc(nm(id))}${SEP}סומן ״${statusWord(ent.s)}״`, sub: ent.note ? esc(ent.note) : '', mineLabel: mine ? statusWord(mine.s) : '' }); });
  Object.entries(e.layers || {}).forEach(([id, ent]) => { const mine = STATE.edits.layers[id]; if (mine && JSON.stringify(mine) === JSON.stringify(ent)) return;
    const name = (ent.data && ent.data.name) || layerDef(Number(id)).name;
    rows.push({ kind: 'layer', id, ent, conflict: !!mine, label: `שכבת ${esc(name)}${SEP}${ent.op === 'add' ? 'שכבה חדשה' : ent.op === 'del' ? 'נמחקה' : fields(ent.data) || 'עריכה'}`, sub: '', mineLabel: mine ? ((mine.data && mine.data.name) || name) : '' }); });
  Object.entries(e.layerOrder || {}).forEach(([dest, arr]) => { const mine = STATE.edits.layerOrder[dest]; if (mine && JSON.stringify(mine) === JSON.stringify(arr)) return;
    rows.push({ kind: 'order', id: dest, ent: arr, conflict: !!mine, label: `סדר השכבות${SEP}${esc(destName(dest))}`, sub: '', mineLabel: mine ? 'סדר אחר' : '' }); });
  return rows;
}
function openEditsReview(inc, from, o) { layerNote(openEditsReview, arguments); o = o || {};
  const rows = o.only || editRows(inc); if (!rows.length) { showToast('אין בקובץ עריכות חדשות - הכל כבר אצלכם'); return; }
  const F = fmNew({ rows, o, from }), key = r => r.kind + ':' + r.id;
  const items = rows.map(r => ({ k: key(r), label: r.label, sub: r.conflict ? `<span class="fm-warnline">${warnIc()} נערך גם כאן${SEP}שלכם נשאר אם לא מסמנים</span>` : r.sub || '' }));
  const take = o.take ? rows.filter(r => o.take.has(key(r))).map(key) : rows.filter(r => !r.conflict).map(key), lbl = n => o.onPick ? 'אישור' : `לקחת ${n}`; // the main action counts what is checked
  partsWin(F, { key: 'openEditsReview', title: `✏️ השינויים מ${nameB(from)}`, intro: 'מסמנים מה לקחת. כל שורה נלקחת בשלמותה.',
    body: [fmChecks(F, 'take', { items, value: take, on: v => { const b = document.getElementById('pwSend'); if (b) b.textContent = lbl((v || []).length); } })], send: { act: 'review.go', label: lbl(take.length) }, more: [{ act: 'win.done', label: 'דילוג' }] }); // 10.5.0: "דילוג" - bottom sheets have no ✕
}
act('review.go', c => { const F = fmOf(c.el); if (!F) return; const { rows, o, from } = F.opts, keys = new Set(fmGet(F, 'take') || []);
  if (o.onPick) { o.onPick(keys); closeSheet(); return; }
  let n = 0;
  rows.filter(r => keys.has(r.kind + ':' + r.id)).forEach(r => { if (r.kind === 'place') STATE.edits.places[r.id] = r.ent; else if (r.kind === 'layer') STATE.edits.layers[r.id] = r.ent; else if (r.kind === 'order') STATE.edits.layerOrder = { ...STATE.edits.layerOrder, [r.id]: r.ent }; else STATE.edits.status[r.id] = r.ent; n++; });
  closeSheet(); syncFlightsToPlan(); refreshLayers(); persist();
  showUndoToast(`מוזגו ${n} עריכות מ${from}`); });
// diet-groups (11.62.0; moved from startup.js): an app file shared as text, and files opened with the installed app (file_handlers) -
// startup.js reaches them through the loader (the group waits before the first screen for a share start)
function sharedTextIn(text) { const d = parseAppText(text).data; if (!d || !openIncoming(d, 'share')) showToast('הטקסט ששותף לא נראה כמו קובץ של ' + APP.appTitle); }
async function launchFilesIn(files) { for (const fh of (files || [])) { try { const f = await fh.getFile(); const d = parseAppText(await f.text()).data; if (d && openIncoming(d, 'launch')) return; } catch (e) {} } }

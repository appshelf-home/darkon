// ================= 4.27.0: DRAFT IMPROVEMENT ROUND WITH CLAUDE =================
// Before approving, the draft can go back to Claude as a file (the same file it came in, as it is now in the draft, plus a
// "round" object) and come back as a file that is merged into the same draft. My marks stay a layer over the returned file:
// what I removed stays removed (sent as draftRemoved), my fixes stay (a field Claude changed anyway is marked
// "📝 ה-AI הציע אחרת"), my additions keep name, layer and point and only get empty fields filled. Notes 💬 can be written
// on anything in the draft (by target id, so anything added later gets notes for free) and Claude answers each one.
function noteBtnHTML(target, label, text) {
  const n = noteOf(DRAFT, target), st = n ? n.state : '';
  return `<button type="button" class="note-btn${text ? ' note-btn-text' : ''}" data-act="note.open" data-v="${escH(target)}" data-nlabel="${escH(label)}" data-st="${st}" title="הערה ל-${AI}" aria-label="הערה ל-${AI}">${msi('chat', { size: 18 })}${text ? ' ' + text : ''}</button>`; // 10.15.0 (F37): the line icon
}
function notePreviewHTML(target) {
  const n = noteOf(DRAFT, target); if (!n) return '';
  return `<small class="note-prev" data-st="${n.state}">${msi('chat', { cls: 'msi-in' })} ${escH(n.text)}${n.state === 'answered' ? `<br><b>${n.done === false ? warnIc() : '✓ טופל'}</b>${SEP}${claudeMark()} ${escH(n.reply)}` : n.sentIn && DRAFT.round && n.sentIn === DRAFT.round.n ? (SEP + '<i>נשלחה, מחכה לתשובה</i>') : ''}</small>`;
}
// 10.15.0 (design-review F22): "על:" shows the place's circle, as its card - a place of the draft only (the rest are named in words)
function noteTargetLead(D, target) { const x = draftItems(D).find(i => itemTarget(i) === target); return x ? leadHTML('place', typeIcon(x.p.icon || x.L.icon, { size: 18 }), x.L.color) : ''; }
function openNoteSheet(target, label) { layerNote(openNoteSheet, arguments);
  if (!DRAFT) return; const D = DRAFT; D.notes = D.notes || {};
  const n = D.notes[target], sheet = document.getElementById('sheet'), F = fmNew({ target, label });
  sheet.innerHTML = `${fmHead('💬 הערה ל-' + AI + ' ' + tipI('note.claude'))}
    <p class="sh-hint note-on">על: ${noteTargetLead(D, target)}<b>${escH(label || target)}</b></p>
    ${n && n.state === 'answered' ? `<div class="callout note-reply">${n.done === false ? warnIc() + ' לא הצליח' : '✓ טופל'}${SEP}<b>ה-${AI}:</b> ${escH(n.reply)}</div>
      ${cardActionsHTML({ act: 'noteWin.done', label: '✓ סגירת ההערה' }, [{ act: 'noteWin.again', label: `${msi('restart_alt', { size: 18 })} להשאיר פתוחה לסבב הבא` }])}` : ''}
    ${n && n.state === 'closed' ? `<div class="callout note-reply">✓ סגורה${n.reply ? SEP + '<b>ה-' + AI + ':</b> ' + escH(n.reply) : ''}</div>` : ''}
    ${fmText(F, 'text', { label: 'ההערה', note: n && n.sentIn && D.round && n.sentIn === D.round.n && n.state === 'open' ? '(נשלחה בסבב ' + n.sentIn + ', מחכה לתשובה. שינוי יישלח בסבב הבא)' : '', para: true, rows: 4, value: n ? n.text : '', placeholder: 'למשל: יש משהו דומה לילדים? / לבדוק אם עדיין פתוח / חסרה מסעדה צמחונית באזור' })}
    ${n ? fmEndActs([{ act: 'noteWin.del', label: 'מחיקה', del: true }]) : ''}
    ${fmSaveBar({ act: 'noteWin.save' })}`;
  showSheetBackdrop('openNoteSheet'); fmAttach(F);
}
act('noteWin.save', c => { const F = fmOf(c.el); if (!F || !DRAFT) return; const D = DRAFT, { target, label } = F.opts, n = D.notes[target], text = fmGet(F, 'text');
  if (!text) { if (n) { delete D.notes[target]; saveDraft(); closeSheet(); showUndoToast('💬 ההערה נמחקה'); } else closeSheet(); return; }
  if (n && n.text === text) { closeSheet(); return; }
  D.noteSeq = (D.noteSeq || 0) + 1;
  D.notes[target] = { id: 'n' + D.noteSeq, text, at: Date.now(), state: 'open', sentIn: 0, label: label || target, ...(n && n.reply ? { prevReply: n.reply } : {}) };
  saveDraft(); closeSheet(); showUndoToast('💬 ההערה נשמרה'); });
act('noteWin.del', c => { const F = fmOf(c.el); if (!F || !DRAFT) return; delete DRAFT.notes[F.opts.target]; saveDraft(); closeSheet(); showUndoToast('💬 ההערה נמחקה'); });
act('noteWin.done', c => { const F = fmOf(c.el); if (!F || !DRAFT) return; const n = DRAFT.notes[F.opts.target]; DRAFT.notes[F.opts.target] = { ...n, state: 'closed' }; saveDraft(); closeSheet(); showUndoToast('✓ ההערה נסגרה'); });
act('noteWin.again', c => { const F = fmOf(c.el); if (!F || !DRAFT) return; const n = DRAFT.notes[F.opts.target]; DRAFT.notes[F.opts.target] = { ...n, state: 'open', sentIn: 0, prevReply: n.reply }; saveDraft(); closeSheet(); showUndoToast('ההערה תישלח שוב בסבב הבא'); });
function draftMoreHTML(D) {
  let rows = draftMoreRows(D); if (!rows.length) return '';
  const total = rows.length, withNote = rows.filter(r => noteOf(D, r.t)).length;
  if (FILTER.draft.notes) rows = rows.filter(r => noteOf(D, r.t)); if (!rows.length) return '';
  let html = '', g = null;
  rows.forEach(r => { if (r.group !== g) { html += `<div class="draft-lhead">${sepTie(icText(r.group))}</div>`; /* 10.15.0: the group's symbol as its line icon */ g = r.group; }
    html += `<div class="draft-row more-row"><div class="draft-txt"><b>${escH(r.label)}</b>${notePreviewHTML(r.t)}</div>${noteBtnHTML(r.t, r.label)}</div>`; });
  return accHTML('dr-more', `📋 עוד בטיוטה (${total})${withNote ? `${SEP}${msi('chat', { cls: 'msi-in' })} ${withNote}` : ''}`, `<p class="sh-hint">שכבות, מידע כללי${D.data.kind === 'trip' ? ', נסיעות, לינות ולו"ז' : ''}: ${msi('chat', { cls: 'msi-in' })} מוסיף הערה ל-${AI} לסבב השיפורים.</p><div class="draft-list">${html}</div>`, !!FILTER.draft.notes);
}
// summary block of the draft: the round that is out, the last round that came back, the general note
function draftRoundHTML(D) {
  let h = '';
  const on = openNotes(D).length, gen = noteOf(D, 'general');
  if (D.round) h += `<div class="callout round-out">${claudeMark()} <b>נשלחה ל-${AI}${SEP}סבב ${D.round.n}</b>${SEP}${tmFmt('date', D.round.sentAt)} ${tmFmt('stamp', D.round.sentAt)}<br><small>ממשיכים לעבוד כרגיל. מה שתשנו בינתיים נשמר.</small> <button type="button" class="btn-sec" id="drRoundStop" data-act="draft.drRoundStop">✕ לא מחכים לסבב</button></div>`;
  if (D.last) { const L = D.last;
    h += `<div class="callout round-back">${claudeMark()} <b>סבב ${L.n} חזר</b>: ה-${AI} עדכן ${L.upd}, הוסיף ${L.added}, טיפל ב-${L.replies} הערות${L.removed ? `, הוריד ${L.removed} שנסגרו` : ''}${L.suggest ? `, ממליץ להוריד ${L.suggest}` : ''}.${L.summary ? `<br><small>${escH(L.summary)}</small>` : ''}${L.conflicts ? `<br><small>${msi('edit_note', { size: 16, cls: 'msi-in' })} ב-${L.conflicts} מקומות ה-${AI} הציע אחרת ממה שתיקנתם - התיקון שלכם נשאר עד שתחליטו.</small>` : ''}</div>`; }
  h += `<div class="brow export-actions round-acts"><button type="button" class="claude-btn" id="drRound" data-act="draft.drRound">${claudeH(TX.claude.round.btn)}</button>${tipI('claude.round')}</div>`; // 5.15.0 (ד7): 💬 הערה כללית moved into the round's window
  return h;
}
// filter chips for the list: changed in the round, has a note
// markers of one draft place after a round
function roundMarksHTML(D, x) {
  const k = x.key, out = [];
  const c = (D.changed || {})[k]; if (c) out.push(`<span class="rmark">${c === 'new' ? claudeMark() + ' חדש מה-' + AI : claudeMark() + ' עודכן בסבב'}</span>`);
  if ((D.byClaude || {})[k]) out.push(`<span class="rmark rm-off">✕ הוצא על ידי ה-${AI}: ${escH(D.byClaude[k])}${D.off[k] ? '' : (SEP + 'הוחזר')}</span>`);
  if ((D.suggest || {})[k] && !D.off[k]) out.push(`<span class="rmark rm-sugg">${claudeMark()} מומלץ להוריד: ${escH(D.suggest[k])} <button type="button" class="mini-btn" data-sugg="${escH(k)}" data-act="draft.sugg" data-v="off">להוריד</button><button type="button" class="mini-btn" data-sugg="${escH(k)}" data-act="draft.sugg" data-v="keep">להשאיר</button></span>`);
  if ((D.conflict || {})[k] && Object.keys(D.conflict[k]).length) out.push(`<button type="button" class="rmark rm-conf" data-act="draft.conflict" data-v="${escH(k)}">${msi('edit_note', { size: 16 })} ה-${AI} הציע אחרת ›</button>`);
  return out.length ? `<div class="rmarks">${out.join('')}</div>` : '';
}
const FIELD_LABEL = { name: 'שם', layer: 'שכבה', address: 'כתובת', description: 'תיאור', manualCoord: 'מיקום', region: 'אזור', transit: 'איך מגיעים', reservation: 'הזמנה', price: 'מחיר' };
function openConflictSheet(key) { const ctl = {}; layerNote(openConflictSheet, arguments);
  const D = DRAFT, cf = (D.conflict || {})[key]; if (!cf) return;
  const x = draftItems(D).find(i => i.key === key); if (!x) return;
  const show = (f, v) => f === 'manualCoord' ? (v ? `${v.lat}, ${v.lng}` : '—') : f === 'layer' ? draftLayer(x.dp, v).name : bpFieldText(f, v) != null ? escH(bpFieldText(f, v) || '—') /* 11.42.0: a booking or price in words */ : escH(v == null || v === '' ? '—' : v);
  const sheet = document.getElementById('sheet');
  sheet.innerHTML = `${fmHead(`📝 ה-${AI} הציע אחרת${SEP}${escH(x.p.name)}`, 'cfClose')}
    <p class="sh-hint">תיקנתם את השדות האלה בעצמכם, וה-${AI} שינה אותם בקובץ שחזר. התיקון שלכם נשאר עד שתבחרו - נגיעה בכרטיס בוחרת.</p>
    ${Object.entries(cf).map(([f, v]) => twoCardsHTML(FIELD_LABEL[f] || f, [{ cap: 'שלכם', val: show(f, (D.fix[key] || {})[f]), on: true, act: 'conflict.cfk', data: ` data-cfk="${f}"` },
      { cap: `${claudeMark({ size: 16 })} ${AI}`, val: show(f, v), act: 'conflict.cfa', data: ` data-cfa="${f}"` }])).join('')}
    <div class="brow sheet-actions sheet-save-bar"><button class="btn-nav" data-act="win.done">✓ סיום</button></div>`; // 10.5.0: a tap on a card chooses it (yours stays until then)
  
  const done = (f, accept) => {
    if (accept) { const fx = { ...(D.fix[key] || {}) }; delete fx[f]; if (f === 'manualCoord') delete fx.coordSource; if (Object.keys(fx).length) D.fix[key] = fx; else delete D.fix[key]; }
    const c = { ...D.conflict[key] }; delete c[f]; if (Object.keys(c).length) D.conflict[key] = c; else delete D.conflict[key];
    saveDraft(); if (D.conflict[key]) openConflictSheet(key); else closeSheet(); renderDraftScreen();
    showUndoToast(accept ? '' + SY.claude + ' התקבל מה-' + AI : 'נשאר שלי'); };
  ctl.cfa = b => done(b.dataset.cfa, true);
  ctl.cfk = b => done(b.dataset.cfk, false);
  showSheetBackdrop('openConflictSheet'); layerTop().ctl = ctl;
 
}
ctlActs('conflict', ['cfa', 'cfk']);
// 💬, suggestions and conflicts work in the list, in map cards and in dialogs (6.1.0: actions)
act('note.open', c => openNoteSheet(c.v, c.el.dataset.nlabel));
act('draft.sugg', c => { if (!DRAFT) return; const k = c.el.dataset.sugg, D = DRAFT;
  if (c.v === 'off') D.off[k] = 1; delete D.suggest[k]; saveDraft();
  showUndoToast(c.v === 'off' ? 'הורד לפי ההמלצה' : 'נשאר'); return 'redraw'; });
act('draft.conflict', c => { if (DRAFT) openConflictSheet(c.v); });

// ---- sending a round ----
function roundCounts(D) {
  const adds = draftAdds(D).filter(a => !D.off[a.key]);
  return { notes: openNotes(D).length, adds: adds.length };
}
function openRoundSheet() { layerNote(openRoundSheet, arguments); // 8.0.0 (ק17): the Claude skeleton, built on partsWin
  const D = DRAFT; if (!D) return; const c = roundCounts(D), last = D.roundOpts || { notes: true, complete: true, review: false }, F = fmNew({}), offN = unlocatedOut(draftOffMap(D)).length;
  // 10.5.0 (design-4 part 2, look.md "Claude's round"): an option with nothing to do keeps its remembered check, dimmed with its reason; the full check's cost in the warning color
  const items = [{ k: 'notes', label: 'לענות על ההערות', dim: !c.notes, sub: c.notes ? c.notes + ' הערות פתוחות' : 'אין הערות פתוחות (' + msi('chat', { cls: 'msi-in' }) + ' בחלון של כל מקום, והערה כללית כאן למעלה)' }, // 10.15.0 (F37)
    { k: 'complete', label: 'להשלים מידע חסר', dim: !c.adds, sub: c.adds ? c.adds + ` מקומות שהוספתם (${msi('auto_stories', { size: 16, cls: 'msi-in' })} גילויים ומקומות מהמפה): תיאור, איך מגיעים, הזמנה, מחיר` : 'אין מקומות שהוספתם' },
    ...(offN ? [{ k: 'locate', label: TX.claude.locate(offN), sub: TX.claude.locateSub }] : []), // 10 (ה8): only when there are, checked
    { k: 'review', label: 'בדיקה כללית של הכל', sub: '<span class="fm-warnline">' + warnIc() + ' עבודה ארוכה ויקרה: ה-' + AI + ' בודק כל מקום וכל עובדה. צורכת חלק ניכר מהמכסה, ובטיול גדול לוקחת זמן רב.</span>' }];
  partsWin(F, { key: 'openRoundSheet', title: claudeH(TX.claude.round.btn) + ' ' + tipI('claude.round'), // 10.9.0 (design-forms, gap 38, Q7): a bottom sheet over the draft
    body: [D.round ? `<div class="callout">כבר יש סבב ${D.round.n} אצל ה-${AI}. שליחה עכשיו פותחת סבב ${D.round.n + 1}, וקובץ שיחזור מהסבב הקודם עדיין ימוזג.</div>` : '',
      `<div class="rs-gen">${noteBtnHTML('general', 'הערה כללית על כל הטיוטה', noteOf(D, 'general') ? 'הערה כללית ✓' : 'הערה כללית')}${notePreviewHTML('general')}</div>`,
      fmChecks(F, 'opts', { label: 'מה ה-' + AI + ' עושה', items, value: Object.keys(last).filter(k => last[k] && k !== 'locate').concat(offN ? ['locate'] : []) })],
    goal: 'round', send: { act: 'round.go', label: '📤 שליחת הטיוטה ל-' + AI } });
}
act('round.go', async c => { const F = fmOf(c.el), D = DRAFT; if (!F || !D) return; const v = fmGet(F, 'opts') || [], cnt = roundCounts(D);
  const opts = { notes: v.includes('notes'), complete: v.includes('complete'), review: v.includes('review'), locate: v.includes('locate') };
  if (!((opts.notes && cnt.notes) || (opts.complete && cnt.adds) || opts.review || (opts.locate && unlocatedOut(draftOffMap(D)).length))) return fmFailLine(F, 'אין מה לשלוח: כתבו הערה, הוסיפו מקום, או סמנו בדיקה כללית.');
  const b = c.el, back = btnBusy(b, 'מכין…'); b.disabled = true; // final-review-fixes (finding 20): a failed sending gives the button back as it was
  const file = buildRoundFile(D, opts), n = file.round.n, nm = `${PACK.fileName}-draft-${(D.data.kind === 'trip' ? D.data.trip.id : D.data.destination.id)}-round${n}.json`;
  if (!(await deliverFile(new Blob([JSON.stringify(file, null, 1)], { type: 'application/json' }), nm))) { b.disabled = false; back(); return; }
  D.round = { n, sentAt: Date.now(), opts, sentFix: JSON.parse(JSON.stringify(D.fix)), sentHash: file._sentHash }; delete file._sentHash; D.roundOpts = opts;
  file.round.notes.forEach(x => { const t = Object.keys(D.notes || {}).find(k => D.notes[k].id === x.id); if (t) D.notes[t] = { ...D.notes[t], sentIn: n }; });
  saveDraft(); closeSheet(); // undo-history: one toast = one row (the log names the draft: "בטיוטה של …")
  showUndoToast(`${SY.claude} נשלח לסבב ${n}. ממשיכים לעבוד על הטיוטה בינתיים`); });
function placeHash(p) { const q = { ...p }; delete q.draftRemoved; return textHash(JSON.stringify(q, Object.keys(q).sort())); }
function buildRoundFile(D, opts) {
  const n = Math.max(D.roundN || 0, D.round ? D.round.n : 0) + 1;
  const d = JSON.parse(JSON.stringify(D.data)); delete d._claude; delete d.round;
  const hashes = {};
  const prep = (p, key) => { const f = D.fix[key]; if (f) { Object.assign(p, f); if (f.manualCoord === null) { delete p.manualCoord; delete p.coordSource; } }
    if (D.off[key]) p.draftRemoved = true; hashes[key] = placeHash(p); };
  const newIds = new Set(draftNewDests(D).map(dp => dp.id));
  (d.kind === 'destination' ? [d.destination] : (d.destinations || [])).forEach(dp => { if (!dp || !newIds.has(dp.id)) return; (dp.places || []).forEach(p => prep(p, dp.id + ':' + p.id)); });
  if (d.kind === 'trip') (d.trip.places || []).forEach(p => prep(p, 'trip:' + p.id));
  const labelOf = t => { const n0 = noteOf(D, t); if (n0 && n0.label) return n0.label; const k = targetItemKey(t), x = k && draftItems(D).find(i => i.key === k); return x ? x.p.name : t; };
  const notes = openNotes(D).map(([t, x]) => ({ id: x.id, target: t, label: labelOf(t), text: x.text }));
  const userFixed = {}; Object.entries(D.fix).forEach(([k, f]) => { const x = draftItems(D).find(i => i.key === k); if (x) userFixed[itemTarget(x)] = Object.keys(f).filter(z => z !== 'coordSource'); });
  const userAdds = draftAdds(D).filter(a => !D.off[a.key]).map(a => { const o = { key: a.key, dest: a.dest, name: a.name, layerName: draftAddLayer(D, a).name };
    ['manualCoord', 'coordSource', 'src', 'foreign', 'description', 'transit', 'reservation', 'price', 'address', 'icon', 'region'].forEach(k => { o[k] = a[k] != null ? JSON.parse(JSON.stringify(a[k])) : (k === 'manualCoord' || k === 'src' ? null : ''); });
    hashes[a.key] = placeHash(o); return o; });
  const out = withClaude({ ...d, appVersion: APP_VERSION, createdAt: new Date().toISOString(), signature: `${draftTitle(D)} · טיוטה לסבב שיפורים ${n} · ${tmFmt('date', Date.now())} · v${APP_VERSION}`, unlocated: unlocatedOut(draftOffMap(D)) }, 'round');
  out.round = { n, status: 'sent', sentAt: new Date().toISOString(), options: opts, notes, userFixed, userAdds };
  out._sentHash = hashes;
  return out;
}

// ---- a round comes back ----
function roundMatchesDraft(data) {
  if (!DRAFT || !data || data.app !== BACKUP_APP || !data.round || data.kind !== DRAFT.data.kind) return false;
  return data.kind === 'trip' ? !!(data.trip && data.trip.id === DRAFT.data.trip.id) : !!(data.destination && data.destination.id === DRAFT.data.destination.id);
}
// a round file that has no open draft to go to (the draft was approved or dropped): it is a regular file, without the round's marks
function stripRoundFile(data) {
  if (!data || !data.round) return data; const d = JSON.parse(JSON.stringify(data)); delete d._claude;
  (d.kind === 'destination' ? [d.destination] : (d.destinations || [])).forEach(dp => dp && (dp.places || []).forEach(p => delete p.draftRemoved));
  if (d.trip) (d.trip.places || []).forEach(p => delete p.draftRemoved);
  return d;
}
function mergeRound(data) {
  const D = DRAFT;
  const nw = JSON.parse(JSON.stringify(data)), rd = nw.round || {}; delete nw._claude; delete nw.round;
  const kind = nw.kind, sentHash = (D.round && D.round.n === rd.n && D.round.sentHash) || {}, sentFix = (D.round && D.round.n === rd.n && D.round.sentFix) || {};
  const destsOf = x => kind === 'destination' ? [x.destination] : (x.destinations || []);
  const newIds = new Set(draftNewDests(D).map(dp => dp.id));
  const oldPlaces = new Map();
  destsOf(D.data).forEach(dp => dp && newIds.has(dp.id) && (dp.places || []).forEach(p => oldPlaces.set(dp.id + ':' + p.id, { p, dp })));
  if (kind === 'trip') (D.data.trip.places || []).forEach(p => oldPlaces.set('trip:' + p.id, { p }));
  // nothing leaves: a destination or place the file dropped comes back as it was
  if (kind === 'trip') { destsOf(D.data).forEach(dp => { if (dp && !nw.destinations.some(x => x && x.id === dp.id)) nw.destinations.push(dp); });
    ['places', 'travels', 'lodging', 'schedule'].forEach(k => { const have = new Set((nw.trip[k] || []).map(x => String(x.id))); nw.trip[k] = (nw.trip[k] || []).concat((D.data.trip[k] || []).filter(x => !have.has(String(x.id)))); }); }
  destsOf(nw).forEach(dp => { if (!dp) return; const od = destsOf(D.data).find(x => x && x.id === dp.id); if (!od) return; const have = new Set((dp.places || []).map(p => p.id)); dp.places = (dp.places || []).concat((od.places || []).filter(p => !have.has(p.id))); });
  const changed = {}, conflict = { ...(D.conflict || {}) }; let upd = 0, added = 0, conflicts = 0;
  const visit = (p, key) => { delete p.draftRemoved; const o = oldPlaces.get(key);
    if (!o) { changed[key] = 'new'; added++; return; }
    const sentP = { ...o.p, ...(sentFix[key] || {}) }; if (sentFix[key] && sentFix[key].manualCoord === null) { delete sentP.manualCoord; delete sentP.coordSource; }
    const was = sentHash[key] || placeHash(sentP);
    const pc = { ...p }; if (D.off[key]) pc.draftRemoved = true; const now = placeHash(pc);
    if (was !== now && !D.off[key]) { changed[key] = 'upd'; upd++; }
    const fx = D.fix[key]; if (fx) Object.keys(fx).forEach(f => { if (f === 'coordSource') return; const sv = sentP[f], nv = p[f];
      if (JSON.stringify(nv) !== JSON.stringify(sv) && JSON.stringify(nv) !== JSON.stringify(fx[f])) { conflict[key] = { ...(conflict[key] || {}), [f]: nv === undefined ? null : nv }; conflicts++; } }); };
  destsOf(nw).forEach(dp => dp && newIds.has(dp.id) && (dp.places || []).forEach(p => visit(p, dp.id + ':' + p.id)));
  if (kind === 'trip') (nw.trip.places || []).forEach(p => visit(p, 'trip:' + p.id));
  // my additions: Claude fills only what is empty; name, layer, point and source stay mine
  (rd.userAdds || []).forEach(r => { const a = (D.add || []).find(x => x.key === r.key); if (!a) return; let any = false;
    ['foreign', 'description', 'transit', 'reservation', 'price', 'address', 'icon'].forEach(f => { if ((a[f] == null || a[f] === '') && r[f]) { a[f] = r[f]; any = true; } });
    if (any) { changed[a.key] = 'upd'; upd++; } });
  D.byClaude = { ...(D.byClaude || {}) }; D.suggest = { ...(D.suggest || {}) };
  (rd.removed || []).forEach(r => { const k = targetItemKey(r.target); if (!k) return; D.off[k] = 1; D.byClaude[k] = r.reason || 'נסגר'; delete D.suggest[k]; });
  (rd.suggestRemove || []).forEach(r => { const k = targetItemKey(r.target); if (!k || D.off[k]) return; D.suggest[k] = r.reason || ''; });
  let replies = 0; D.notes = D.notes || {};
  (rd.replies || []).forEach(r => { const t = Object.keys(D.notes).find(k => D.notes[k].id === r.note); if (!t) return; const n = D.notes[t];
    if (n.sentIn !== rd.n || n.state !== 'open') return; // a note changed after sending waits for the next round
    D.notes[t] = { ...n, state: 'answered', reply: String(r.reply || ''), done: r.done !== false, replyAt: Date.now() }; replies++; });
  D.data = nw; D.changed = changed; D.conflict = conflict; D.roundN = Math.max(D.roundN || 0, rd.n || 1);
  D.last = { n: rd.n || 1, at: Date.now(), summary: rd.summary || '', upd, added, replies, removed: (rd.removed || []).length, suggest: Object.keys(D.suggest).filter(k => !D.off[k]).length, conflicts };
  if (!D.round || D.round.n <= (rd.n || 1)) delete D.round;
  FILTER.draft.changed = !!(upd || added); FILTER.draft.notes = false;
  saveDraft(); closeSheet(); FP.q = ''; goTab('draft');
  showUndoToast(SY.claude + ' ' + fileDroppedNote(`סבב ${D.last.n} מוזג לטיוטה (עודכנו ${upd}, נוספו ${added}, ${replies} תשובות)`, data._dropped)); // item 7: one report per receipt // undo-history: one toast = one row
}
// the round came back after the draft was already approved (or dropped): the file went in as a regular file; here are its answers
function showRoundReplies(data) { layerNote(showRoundReplies, arguments);
  const rd = data.round || {}; if (!(rd.replies || []).length && !(rd.removed || []).length && !(rd.suggestRemove || []).length && !rd.summary) return;
  const nl = id => ((rd.notes || []).find(n => n.id === id) || {});
  const sheet = document.getElementById('sheet');
  sheet.innerHTML = `${fmHead(`${claudeMark()} תשובות ה-${AI} מסבב ${rd.n || ''} ${tipI('claude.round')}`, 'rrClose')}
    <p class="sh-hint">הטיוטה כבר לא פתוחה, ולכן הקובץ נקלט כעדכון רגיל. מה שאישרתם לא נדרס: ההורדות והתיקונים שלכם נשארו. המלצות ההורדה לא הוחלו - אפשר להסתיר מקום מהכרטיס שלו.</p>
    ${rd.summary ? `<div class="callout">${escH(rd.summary)}</div>` : ''}
    ${(rd.replies || []).length ? `<h3>תשובות להערות</h3>${rd.replies.map(r => `<div class="rr-row rr-card"><b>${escH(nl(r.note).label || r.target)}</b><small>ביקשתם: ${escH(nl(r.note).text || '')}</small><div class="rr-ans">${r.done === false ? warnIc() : claudeMark({ size: 16 })} ${escH(r.reply)}</div></div>`).join('')}` : ''}
    ${(rd.removed || []).length ? `<h3>${msi('block', { cls: 'msi-in' })} נסגרו (לפי ה-${AI})</h3>${rd.removed.map(r => `<div class="rr-row">${escH(r.target)}${SEP}${escH(r.reason)}</div>`).join('')}` : ''}
    ${(rd.suggestRemove || []).length ? `<h3>${claudeMark()} מומלץ להוריד</h3>${rd.suggestRemove.map(r => `<div class="rr-row">${escH(r.target)}${SEP}${escH(r.reason)}</div>`).join('')}` : ''}`;
  
  showSheetBackdrop('showRoundReplies');
 
}


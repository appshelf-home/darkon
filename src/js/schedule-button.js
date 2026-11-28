// 4.5.0: a place card in two sizes. In lists it is short, built like the card floating on the map: name, info line, two lines
// of the description, ⭐ ✓, and one row - 🧭, 🔍, 🗓️ (days and part of the day) and "פרטים ›". The details window shows the
// full card (description, how to get there, Google Maps, copying the address, ✏️).
function cardHTML(p, opts) { // 5.4.0: a place's card is the mini card (the full card became the item window, 5.2.0)
  opts = opts || {}; const it = itemOf(p.id); return it ? miniCardHTML(it, { screen: 'list', desc: true, extra: opts.extra }) : '';
}
// 4.5.0: scheduling from a card - one 🗓️ button that shows the days (and the part of the day or the hour), and a window
// with the trip's days as switches (a place can be on several days: the first is the place itself, the others are copies
// with ref) and, for each chosen day, בלי / בוקר / צהריים / ערב / 🕐.
const SLOT_SHORT = { morning: 'בוקר', afternoon: 'צהריים', evening: 'ערב' };
const SLOT_MS = { morning: 'wb_sunny', afternoon: 'partly_cloudy_day', evening: 'dark_mode', unassigned: 'schedule' }; // 10.2.0 (design-2): the parts of the day as icons
function schedEntries(baseId) {
  const out = [];
  TRIP_DAYS.forEach(d => { const dd = ensureDay(d.key);
    ['unassigned', 'morning', 'afternoon', 'evening'].forEach(slot => dd[slot].forEach(id => {
      if (id === baseId || (typeof id === 'string' && STATE.planItems[id] && STATE.planItems[id].ref === baseId)) out.push({ day: d.key, id, slot, time: getTime(d.key, id) });
    })); });
  return out;
}
// picker-rule (decisions 2026-11-18 · Several-values pickers) and sched-draft-all (decisions 2026-11-19 · Review of the 11.25.0 summary, Q1):
// the window changes data, so everything in it is one draft (D, on its layer) until "✓ סיום" - the days, each row's part of the day and
// time (🕐 also on a day new in the draft; its time window returns the value here), a row's ✕ and "＋ עוד פעם ביום הזה". "סיום" applies the
// whole draft as one action with one undo row; ✕, pull down, a tap outside and back close with no change and no question.
// D.rows: day → its rows { k, id (the plan's entry; null for a row new in the draft), slot, time, after (an extra occurrence: the row it follows) }
function schedDraftOf(baseId) { const es = schedEntries(baseId), D = { on: new Set(es.map(e => e.day)), rows: {}, n: 0, base: baseId };
  es.forEach(e => { (D.rows[e.day] = D.rows[e.day] || []).push({ k: e.day + '|' + e.id, id: e.id, slot: e.slot, time: e.time || null }); });
  return D; }
function schedNewRow(D, day, slot, after) { const rs = D.rows[day] = D.rows[day] || [], k = day + '|+' + (rs.some(r => r.k === day + '|+') ? ++D.n : '');
  const r = { k, id: null, slot: slot || 'unassigned', time: null, after: after || null }; rs.push(r); return r; }
function openScheduleSheet(baseId) {
  const sheet = document.getElementById('sheet'), p = POINTS.find(x => String(x.id) === String(baseId)); // 4.33.0: never silent
  if (!p) { showToast(('המקום המקורי של הפריט הזה כבר לא ביעד' + SEP + 'אפשר להסיר אותו ב-✕')); return; }
  baseId = p.id; const D = schedDraftOf(baseId);
  const draw = () => {
    const days = TRIP_DAYS.filter(d => dayOk(d.key, p) || (D.rows[d.key] || []).some(r => r.id != null));
    const rows = days.filter(d => D.on.has(d.key)).map(d => { const mine = D.rows[d.key] && D.rows[d.key].length ? D.rows[d.key] : [schedNewRow(D, d.key)];
      return mine.map(r => schedRowHTML(d.key, r.slot, r.time, `sched:${r.k}`, 'sched') + `${mine.length > 1 ? `<button type="button" class="chip sc-rm" data-act="sched.rmRow" aria-label="הסרת השורה הזו מהיום" title="הסרת השורה הזו מהיום">✕</button>` : ''}${mine[mine.length - 1] === r ? `<button type="button" class="chip sc-again" data-act="sched.again">＋ עוד פעם ביום הזה</button>` : ''}</div></div>`).join(''); }).join('');
    sheet.innerHTML = `${fmHead(`${SY.days} שיבוץ${SEP}${itemIcon(p, { size: 18, cls: 'msi-in' })} ${nameB(p.name)} ${tipI('sched.multi')}`, 'scClose')}
      <div class="sh-hint">אפשר לשבץ בכמה ימים, ולכל יום לבחור חלק ביום או שעה. נשמר ב"✓ סיום".</div>
      ${schedDaysHTML(days, d => D.on.has(d.key), null, 'sched')}
      ${rows}
      <div class="brow sheet-actions sheet-save-bar"><button class="btn-nav" id="scDone" data-act="sched.done">✓ סיום</button></div>`;
  };
  winOpen('openScheduleSheet', 'שיבוץ', draw); winRef('place:' + baseId); const t = layerTop(); t.multi = 'draft'; t.sched = D; // 5.1.0
}
// 6.1.0: the scheduling window of a place (its record: the window's place)
act('win.done', () => winDone());
const schedDraft = () => { const t = layerTop(); return t && t.sched; };
act('sched.day', c => { const D = schedDraft(); if (!D) return; const k = c.v; if (D.on.has(k)) D.on.delete(k); else D.on.add(k); return 'redraw'; }); // only the draft
const schedRowOf = c => { const D = schedDraft(), k = String(c.ref.id), day = k.slice(0, k.indexOf('|')), rs = D && D.rows[day] || [];
  return { D, day, rs, r: rs.find(x => x.k === k) }; }; // 7.2.0 (פ3): the row carries "day|item" ('|+…': a row new in the draft)
act('sched.slot', c => { const { r } = schedRowOf(c); if (!r) return; r.slot = c.v; r.time = null; return 'redraw'; });
act('sched.time', c => { const { D, day, r } = schedRowOf(c); if (!r) return; // 4.52.0: the one time window - here it returns its value into the draft
  openTimeSheet(day, String(r.id != null ? r.id : D.base), { t: r.time, set: (start, end) => { r.time = start ? { start, end: end || '' } : null; }, back: () => schedDraft() === D }); }); // drawn again once the window under is back (timeDraftBack)
act('sched.rmRow', c => { const { rs, r } = schedRowOf(c); if (!r || rs.length < 2) return; rs.splice(rs.indexOf(r), 1); return 'redraw'; }); // 4.33.0
act('sched.again', c => { const { D, day, rs } = schedRowOf(c); if (!D) return; const last = rs[rs.length - 1]; schedNewRow(D, day, last ? (last.time ? slotForTime(last.time.start) : last.slot) : 'unassigned', last ? last.k : null); return 'redraw'; }); // 5.1.0: in the last row's part of the day (or its time's)
// "✓ סיום": the days taken out, the rows removed by ✕, the rows' parts of the day and times, then the rows added (a day new in the draft and
// "＋ עוד פעם"; the first keeps the place itself when it is on no day, the others are copies) - one action, one undo row naming the changes
function schedApply(p, D) { const baseId = p.id, es = schedEntries(baseId), had = new Set(es.map(e => e.day)), lab = k => (dayByKey(k) || {}).label || k;
  const tmS = t => t ? tmSpan(t.start, t.end) : '', same = (a, b) => tmS(a) === tmS(b);
  const out = [...had].filter(k => !D.on.has(k)), live = k => D.on.has(k) ? D.rows[k] || [] : [];
  const gone = es.filter(e => D.on.has(e.day) && !live(e.day).some(r => r.id === e.id));
  const kept = es.map(e => ({ e, r: live(e.day).find(r => r.id === e.id) })).filter(x => x.r);
  const moves = kept.filter(({ e, r }) => !r.time && (e.time || r.slot !== e.slot)), times = kept.filter(({ e, r }) => r.time && !same(r.time, e.time));
  const fresh = TRIP_DAYS.map(d => d.key).filter(k => D.on.has(k)).flatMap(k => live(k).filter(r => r.id == null).map(r => ({ day: k, r })));
  const add = [...new Set(fresh.filter(x => !had.has(x.day)).map(x => x.day))], again = fresh.filter(x => had.has(x.day) || x.r.after);
  if (!out.length && !gone.length && !moves.length && !times.length && !fresh.length) return false;
  const lst = a => [...new Set(a)].join(', ');
  const parts = [add.length && 'שובץ ב-' + add.map(lab).join(', '), out.length && 'הוסר מ-' + out.map(lab).join(', '), gone.length && 'שורה הוסרה מ-' + lst(gone.map(e => lab(e.day))),
    again.length && 'עוד פעם ב-' + lst(again.map(x => lab(x.day))), moves.length && moves.map(({ e, r }) => lab(e.day) + ': ' + (SLOT_SHORT[r.slot] || 'בלי חלק ביום')).join(', '),
    times.length && times.map(({ e, r }) => lab(e.day) + ': ' + tmS(r.time)).join(', '), fresh.filter(x => x.r.time).map(x => lab(x.day) + ': ' + tmS(x.r.time)).join(', ')].filter(Boolean);
  planChange(`${SY.days} ${p.name}: ${parts.join(SEP)}`, () => {
    es.filter(e => out.includes(e.day)).forEach(e => { const d = ensureDay(e.day); d[e.slot] = d[e.slot].filter(x => x !== e.id); delete STATE.times[timeKey(e.day, e.id)]; if (typeof e.id === 'string') delete STATE.planItems[e.id]; });
    gone.forEach(e => { const d = ensureDay(e.day), cur = findSlot(e.day, e.id) || e.slot, rm = planX().removed; // as ✕ in a plan card: "שהוסרו" at the day's end returns it
      rm[e.day] = [{ id: e.id, slot: cur, time: STATE.times[timeKey(e.day, e.id)] || null, item: typeof e.id === 'string' ? STATE.planItems[e.id] || null : null, at: Date.now() }, ...(rm[e.day] || []).filter(x => String(x.id) !== String(e.id))].slice(0, 30);
      d[cur] = d[cur].filter(x => x !== e.id); delete STATE.times[timeKey(e.day, e.id)]; if (typeof e.id === 'string') delete STATE.planItems[e.id]; });
    moves.forEach(({ e, r }) => { const d = ensureDay(e.day), cur = findSlot(e.day, e.id); if (cur) d[cur] = d[cur].filter(x => x !== e.id); d[r.slot].push(e.id); delete STATE.times[timeKey(e.day, e.id)]; });
    times.forEach(({ e, r }) => setEntryTime(e.day, String(e.id), r.time.start, r.time.end));
    const ids = {}; fresh.forEach(({ day, r }, i) => { let id;
      if (!schedEntries(baseId).length) id = baseId;
      else { id = 'c_' + Date.now().toString(36) + (i ? '_' + i : ''); STATE.planItems[id] = { ref: baseId, name: p.name, address: p.address, icon: p.icon }; }
      ids[r.k] = id; const arr = ensureDay(day)[r.slot], at = r.after ? arr.indexOf(ids[r.after] != null ? ids[r.after] : (live(day).find(x => x.k === r.after) || {}).id) : -1;
      arr.splice(at < 0 ? arr.length : at + 1, 0, id); if (r.time) setEntryTime(day, String(id), r.time.start, r.time.end); }); });
  return true; }
act('sched.done', c => { const D = schedDraft(), p = c.ref && c.ref.obj; winDone(); if (D && p) schedApply(p, D); });
// 4.2.0: in a trip with several destinations a place can be put only on the days of its destination (both on a transfer day)
function dayOk(dayKey, p) {
  if (!p || p.planOnly || !p.dest || tripDests(activeTripObj()).length < 2) return true;
  return destsOfDay(dayKey).includes(p.dest);
}



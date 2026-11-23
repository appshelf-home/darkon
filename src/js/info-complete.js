// ================= 11.43.0: GENERAL INFO THROUGH CLAUDE (task info-complete) =================
// decisions 2026-11-20 · General info for any destination that lacks it, through Claude (Q1-Q3); 2026-11-20 · "מזג אוויר ולבוש": an old
// text with no seasons is completed (Q1). Mechanism map: `darkon/spec/general-info-through-claude.md`.
// The ten fixed sections are INFO_FIXED ([icon, title], built by tests/kit.py from the kit's vocabulary.md - validate.py reads the same
// lines). A destination lacks a section when its info has none with that data-icon - in an older file with no icons, none whose title
// carries the section's words (INFO_OLD_TITLE, the same table in validate.py) - and it is not marked "not relevant". A weather section
// with no season paragraphs (div[data-months]) is one to complete too, under its own title ("מזג אוויר לפי עונות").
// "Not relevant": meta.infoNA [{ icon, why, by }] on the destination - Claude's, in the file - and the user's in the destination's edits
// (STATE.edits.infoNA { destId: [{ icon, why, by: 'user' }] }, so an update of the destination keeps it); a user's entry with off: true
// clears Claude's mark for that section. The closed values are kept at the door (infoNAClean, from fileClean).
const INFO_OLD_TITLE = { task_alt: /לפני ש/, directions_subway: /ניידות|תחבורה/, payments: /כסף|מטבע/, signal_cellular_alt: /תקשורת|סים|eSIM|אינטרנט/i,
  local_hospital: /בטיחות|חירום|בריאות/, thermostat: /מזג/, power: /חשמל/, translate: /שפה/, israel_flag: /נציגות|שגרירות|קונסוליה/, tips_and_updates: /טיפ/ };
const INFO_WX_SEASONS = 'מזג אוויר לפי עונות', INFO_ASK = 'להשלים את המידע הכללי החסר';
const INFO_FIXED_ICONS = new Set(INFO_FIXED.map(x => x[0]));
function infoTitleOf(icon) { const f = INFO_FIXED.find(x => x[0] === icon); return f ? f[1] : icon; }
// the closed values of one list (meta.infoNA, or a destination's list in the edits): an entry outside them is dropped and counted
function infoNAList(v, edits) { if (!Array.isArray(v)) { FILE_DROPPED++; return []; } const seen = new Set(), out = [];
  v.forEach(x => { const by = x && x.by, ok = x && typeof x === 'object' && INFO_FIXED_ICONS.has(x.icon) && (edits ? by === 'user' : by === 'claude' || by === 'user') && !seen.has(x.icon);
    if (!ok) { FILE_DROPPED++; return; } seen.add(x.icon);
    out.push({ icon: x.icon, why: typeof x.why === 'string' ? x.why.trim().slice(0, 300) : '', by, ...(edits && x.off === true ? { off: true } : {}) }); });
  return out; }
// from fileClean: meta.infoNA (a list), a destination file's edits.infoNA (a list), a backup's edits.infoNA ({ destId: list })
function infoNAClean(v, key) { if (key === 'meta') return infoNAList(v, false);
  if (Array.isArray(v)) return infoNAList(v, true);
  if (!v || typeof v !== 'object') { FILE_DROPPED++; return {}; }
  const out = {}; Object.entries(v).forEach(([d, l]) => { const c = infoNAList(l, true); if (c.length) out[d] = c; }); return out; }
// the sections a destination's info has, by icon (the weather only with season paragraphs)
const _infoHave = new Map();
function infoSectionsOf(raw) { raw = String(raw || ''); if (_infoHave.has(raw)) return _infoHave.get(raw); if (_infoHave.size > 40) _infoHave.clear();
  const have = new Set(), f = htmlFrag(cleanInfo(raw, { out: true })), wx = wxSecOf(f);
  f.querySelectorAll('.accordion-item').forEach(it => { const hd = it.querySelector(':scope > .accordion-header'); if (!hd) return;
    let ic = hd.getAttribute('data-icon') || ''; if (!INFO_FIXED_ICONS.has(ic)) { ic = ''; const t = hd.textContent; for (const k in INFO_OLD_TITLE) if (INFO_OLD_TITLE[k].test(t)) { ic = k; break; } }
    if (it === wx) ic = 'thermostat';
    if (ic === 'thermostat' && !it.querySelector('div[data-months]')) { have.add('thermostat:old'); return; }
    if (ic) have.add(ic); });
  _infoHave.set(raw, have); return have; }
// "not relevant" for a destination: Claude's marks, then the user's (a user's mark wins; off clears Claude's)
function infoNAOf(d) { const m = new Map(); ((d && d.meta && d.meta.infoNA) || []).forEach(x => { if (x && INFO_FIXED_ICONS.has(x.icon)) m.set(x.icon, x); });
  (((STATE.edits || {}).infoNA || {})[d && d.id] || []).forEach(x => { if (x.off) m.delete(x.icon); else m.set(x.icon, x); }); return m; }
// the missing sections of a destination: [{ icon, title, reason: 'missing' | 'no-seasons' }] in the fixed order
function infoMissingOf(d) { if (!d || !d.id || d.builtin) return []; const have = infoSectionsOf(d.info), na = infoNAOf(d);
  return INFO_FIXED.filter(([ic]) => !have.has(ic) && !na.has(ic)).map(([icon, title]) => icon === 'thermostat' && have.has('thermostat:old') ? { icon, title: INFO_WX_SEASONS, reason: 'no-seasons' } : { icon, title, reason: 'missing' }); }
// every send for an update (goal improve) carries it next to unlocated: the missing sections of each destination in the file
function infoMissingOut(ids) { return [].concat(...ids.map(id => infoMissingOf(DESTS[id]).map(x => ({ dest: id, ...x })))); }
// ---- the row on the General screen, under the destination's info: Claude's colors, only while something is missing ----
function infoRowHTML(d) { const miss = infoMissingOf(d); if (!miss.length) return '';
  const none = !infoSectionsOf(d.info).size, ts = miss.map(x => x.title), shown = ts.length > 4 ? ts.slice(0, 3) : ts;
  const title = none ? 'אין עדיין מידע כללי ליעד' : `חסר מידע: ${shown.map(t => fmEsc(t)).join(', ')}${ts.length > shown.length ? ` ועוד ${ts.length - shown.length}` : ''}`;
  return `<div class="info-miss" data-ref="dest:${fmEsc(d.id)}"><button type="button" class="prop-row info-miss-go t-wrap" id="infoMissRow" data-act="infoMiss.go">${claudeMark({ size: 24 })}<span class="prop-row-t"><b>${title}</b><small>להשלים עם ${AI}</small></span></button>`
    + `<button type="button" class="icon-btn info-miss-more" id="infoMissMore" data-act="infoMiss.more" aria-label="עוד פעולות" title="עוד פעולות">${msi('more_vert')}</button></div>`; }
// the tap opens the existing "לשיפור" window of that destination, with the request written
act('infoMiss.go', c => { const d = DESTS[c.ref.id]; if (!d) return; const ts = infoMissingOf(d).map(x => x.title);
  openDestFile(d.id, 'improve', { request: `${INFO_ASK}${ts.length ? ': ' + ts.join(', ') : ''}` }); return 'quiet'; });
// its ⋮: each missing section with "לא רלוונטי ליעד הזה"; each section marked so, with the way back
function openInfoMissMenu(did) { layerNote(openInfoMissMenu, arguments); const d = DESTS[did]; if (!d) return;
  const miss = infoMissingOf(d), na = [...infoNAOf(d).values()], sheet = document.getElementById('sheet');
  const rows = miss.map(x => [x.icon, `${fmEsc(x.title)}${SEP}לא רלוונטי ליעד הזה`, x.reason === 'no-seasons' ? 'הטקסט הקיים נשאר כמו שהוא' : null])
    .concat(na.map(x => ['back:' + x.icon, `${fmEsc(infoTitleOf(x.icon))}${SEP}להחזיר לחסרים`, `סומן לא רלוונטי${x.by === 'claude' ? ' על ידי ה-' + AI : ''}${x.why ? SEP + fmEsc(x.why) : ''}`]));
  sheet.innerHTML = `${fmHead(`מידע כללי${SEP}${nameB(d.meta.name)}`, 'imX')}<p class="sh-hint">סעיף שלא רלוונטי ליעד לא נחשב חסר, ולא נשלח ל-${AI} להשלמה.</p><div data-ref="dest:${fmEsc(did)}">${taListHTML({ act: 'infoMiss.na' }, rows)}</div>`;
  openSheet('infoMissMenu'); }
act('infoMiss.more', c => { openInfoMissMenu(c.ref.id); return 'quiet'; });
act('infoMiss.na', c => { const did = c.ref.id, d = DESTS[did], v = String(c.el.dataset.na || ''); if (!d) return; ensureEditsShape();
  const back = v.startsWith('back:'), icon = back ? v.slice(5) : v; if (!INFO_FIXED_ICONS.has(icon)) return;
  const mine = (STATE.edits.infoNA[did] || []).filter(x => x.icon !== icon), claudes = ((d.meta && d.meta.infoNA) || []).some(x => x && x.icon === icon && x.by !== 'user');
  const list = back ? (claudes ? mine.concat({ icon, why: '', by: 'user', off: true }) : mine) : mine.concat({ icon, why: '', by: 'user' });
  const all = { ...STATE.edits.infoNA }; if (list.length) all[did] = list; else delete all[did]; STATE.edits.infoNA = all;
  closeSheet(); persist();
  showUndoToast(back ? `${infoTitleOf(icon)} חזר לחסרים${SEP}${d.meta.name}` : `${infoTitleOf(icon)} סומן לא רלוונטי${SEP}${d.meta.name}`); return 'redraw'; });

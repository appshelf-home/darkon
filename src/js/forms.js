// ================= 7.2.0: FORM BUILDING BLOCKS - one builder for every kind of field (cl-forms-impl-plan, ע1-ע5, מ1-מ10) =================
// Mechanism map: `darkon/spec/form-building-blocks.md`. Every field of every form is built here and behaves the
// same everywhere: text (line / paragraph, with an optional "יש כבר במאגר" line), choice (chips when they fit in one row at the
// real width, else a button that opens the same chips in a window - מ3), a pick button (long lists with search: layer, country...),
// date / time / range (texts and arithmetic from the TIME block; "חמישי 24.12.2026" under the field, 10.4.0: a small ✕ inside the field,
// "עד" never before "מ"), location (search through placeSearch, 📍, 🔗, a small map with the pin in the middle, ⛶), color, icon,
// toggle, counter (＋ right, − left), file pick; required * (10.4.0: red, no legend line); an error by its field (מ6); a collapsed part
// whose title shows a one-line summary of its values (מ10: never grows). A form keeps its values (F) on its window's layer
// (layerTop().form); "יש שינוי שלא נשמר" compares them with the values at opening (מ8). Taps are registered actions (fm.*);
// typing and value changes in the fields themselves are the module's own (the named exception of the action wiring).
// Guard test (t820): no <input> / <select> / <textarea> outside this block (and the named exceptions), every editor passes.
function fmNew(o) { return { vals: {}, kinds: {}, init: null, on: {}, sums: {}, picks: {}, opts: o || {}, req: {}, dups: {}, conf: {} }; }
const fmRoot = F => (F && F.el) || document.getElementById('sheet');
const fmQ = (F, q) => fmRoot(F).querySelector(q);
const fmW = (F, id) => fmQ(F, `[data-fmw="${id}"]`);
const fmIn = (F, id) => fmQ(F, `[data-fm="${id}"]`);
function fmReg(F, id, kind, v, o) { if (!F) return; F.kinds[id] = kind; F.vals[id] = v; F.conf[id] = o || {}; if (o && o.req) F.req[id] = true; if (o && o.on) F.on[id] = o.on; }
function fmLabel(o, forId) { const req = o.req ? '<span class="req-mark" aria-hidden="true">*</span>' : '';
  return o.label ? `<span class="fm-lbl">${o.label}${req}${o.note ? ` <small class="fm-note">${o.note}</small>` : ''}</span>` : ''; }
const fmHint = o => o.hint ? `<small class="sh-hint fm-hint">${o.hint}</small>` : '';
const fmErrSlot = id => `<small class="fm-err" data-fmerr="${id}" hidden></small>`;
// ---- text: a line or a paragraph ----
function fmText(F, id, o) { o = o || {}; const v = o.value == null ? '' : String(o.value); fmReg(F, id, 'text', v, o);
  const attrs = `data-fm="${id}"${o.placeholder ? ` placeholder="${escH(o.placeholder)}"` : ''}${o.dir ? ` dir="${o.dir}"` : ''}${o.max ? ` maxlength="${o.max}"` : ''}${o.inputmode ? ` inputmode="${escH(o.inputmode)}"` : ''}${o.req ? ' aria-required="true"' : ''}${o.act ? ` data-act="${o.act}"` : ''}${o.enter ? ` data-act-enter="${o.enter}"` : ''}${o.trap ? ' tabindex="-1" autocomplete="off"' : ''}`; // 10.7.0: o.trap - a honeypot field, off screen (a robot fills it, a person never sees it)
  const field = o.para ? `<textarea ${attrs} rows="${o.rows || 3}">${escH(v)}</textarea>` : `<input type="${o.type || 'text'}" ${attrs} value="${escH(v)}">`;
  return `<label class="sh-field fm-f${o.trap ? ' fm-trap' : ''}" data-fmw="${id}"${o.trap ? ' aria-hidden="true"' : ''}>${fmLabel(o)}${field}${fmHint(o)}${o.dup ? `<div class="pe-dup" data-fmdup="${id}" hidden></div>` : ''}${fmErrSlot(id)}</label>`; }
// ---- choice from chips (מ3: chips when they fit in one row, else a button with the current choice that opens them in a window) ----
function fmChipsInner(id, o, v) { return o.options.map(([k, l]) => `<button type="button" class="chip" data-act="${o.act || 'fm.chip'}" data-v="${escH(k)}" data-active="${String(k) === String(v)}">${claudeH(l)}</button>`).join(''); } // 10.1.0 (design-1): claudeH - SHARE_TO's ✳ לשיפור
function fmChips(F, id, o) { o = o || {}; const v = o.value == null ? '' : String(o.value); fmReg(F, id, 'chips', v, o);
  const cur = o.options.find(([k]) => String(k) === v);
  return `<div class="sh-field fm-f fm-choice" data-fmw="${id}" data-fmfit="1">${fmLabel(o)}<div class="chips-row fm-chips${o.options.length >= 2 && o.options.length <= 4 && !o.noSeg ? ' fm-seg seg" role="group' : ''}" data-fm="${id}">${fmChipsInner(id, o, v)}</div>
    <button type="button" class="fm-pickbtn" data-act="fm.choose" data-v="${id}" hidden>${ellTail(cur ? cur[1] : '—')}<span class="fm-caret"> ▾</span></button>${fmHint(o)}${fmErrSlot(id)}</div>`; }
// ---- a button that opens a picker (long lists, lists with search, lists grouped by destination) ----
function fmPick(F, id, o) { o = o || {}; fmReg(F, id, 'pick', o.value == null ? '' : o.value, o); if (F) F.picks[id] = o;
  return `<div class="sh-field fm-f" data-fmw="${id}">${fmLabel(o)}<button type="button" class="fm-pickbtn fm-pick" data-act="${o.act || 'fm.pick'}" data-v="${id}">${ellTail(o.text(o.value))}<span class="fm-caret"> ▾</span></button>${fmHint(o)}${fmErrSlot(id)}</div>`; }
// ---- toggle ----
function fmToggle(F, id, o) { o = o || {}; const v = !!o.value; fmReg(F, id, 'tog', v, o);
  return `<div class="fm-f fm-togrow" data-fmw="${id}"><button type="button" class="fm-tog t-wrap" role="switch" aria-checked="${v}" data-act="${o.act || 'fm.tog'}" data-v="${id}"><span class="fm-sw" aria-hidden="true"></span><span class="fm-togl">${o.label}${o.sub ? `<small class="fm-togs">${o.sub}</small>` : ''}</span></button>${fmHint(o)}</div>`; } // 10.8.0 (design-icons, gap 63): a title and a supporting line
// ---- 8.0.0: a list of checks (the parts of a file, what to include): rows that are always in show checked and locked ----
// o.items: [{ k, label, sub?, count?, always? }]; the value is the list of the checked keys
// value-no-cut (Q3): the label wraps between its parts (a flex row) - "תמיד בפנים"'s "·" ends the part before it, never opening a line
function fmChecksInner(id, o, v) { return o.items.map(x => `<button type="button" class="fm-chk t-wrap${x.dim ? ' fm-dim' : ''}" role="checkbox" aria-checked="${!!x.always || v.includes(x.k)}"${x.always ? ' aria-disabled="true"' : ''} data-act="fm.chk" data-v="${escH(id + '|' + x.k)}"><span class="fm-box" aria-hidden="true"></span><span class="fm-chkl">${x.label}${x.always && !x.sub ? '\u00A0·' : ''}${x.sub ? ` <small>${x.sub}${x.always ? '\u00A0·' : ''}</small>` : ''}${x.always ? ' <small>תמיד בפנים</small>' : ''}${x.count ? ` <small class="fm-chkc"><bdi>${x.count}</bdi></small>` : ''}</span></button>`).join(''); }
function fmChecks(F, id, o) { o = o || {}; const v = (o.value || []).filter(k => o.items.some(x => x.k === k && !x.always)); fmReg(F, id, 'chks', v, o);
  return `<div class="sh-field fm-f fm-checks" data-fmw="${id}">${o.label ? fmLabel(o) : ''}<div class="fm-chks" data-fm="${id}">${fmChecksInner(id, o, v)}</div>${fmHint(o)}${fmErrSlot(id)}</div>`; }
// ---- counter: ＋ on the right, − on the left ----
function fmCountInner(id, o, v) { const p = o.actPlus, m = o.actMinus; // a counter that acts at once (actPlus / actMinus with o.v) or a form's value (fm.cnt)
  return `<button type="button" data-act="${p || 'fm.cnt'}" data-v="${p ? o.v : '+1'}" aria-label="${o.plus || 'עוד אחד'}"${o.plusOff || (o.max != null && v >= o.max) ? ' disabled' : ''}>＋</button><b>${v}</b><button type="button" data-act="${m || 'fm.cnt'}" data-v="${m ? o.v : '-1'}" aria-label="${o.minus || 'אחד פחות'}"${o.minusOff || (o.min != null && v <= o.min) ? ' disabled' : ''}>−</button>`; }
function fmCount(F, id, o) { o = o || {}; const v = Number(o.value) || 0; fmReg(F, id, 'cnt', v, o);
  return `<span class="te-step fm-cnt" data-fmw="${id}" data-fm="${id}">${fmCountInner(id, o, v)}</span>`; }
// ---- color: a palette and "אחר" ----
function fmColor(F, id, o) { o = o || {}; const v = o.value || o.palette[0]; fmReg(F, id, 'color', v, o);
  return `<div class="sh-field fm-f" data-fmw="${id}">${fmLabel(o)}<div class="le-swatches">${o.palette.map(c => `<button type="button" class="le-sw" data-act="fm.color" data-v="${c}" style="background:${c}" aria-label="צבע ${c}" data-active="${String(v).toLowerCase() === c.toLowerCase()}"></button>`).join('')}<label class="le-custom">אחר <input type="color" data-fm="${id}" data-fmcolor="1" value="${escH(v)}"></label></div>${fmHint(o)}</div>`; }
// ---- icon from the app's icon set, with a warning when another one uses it (10.1.0, design-1: each cell shows the type's line icon) ----
function fmIcon(F, id, o) { o = o || {}; const v = o.value || ''; fmReg(F, id, 'icon', v, o);
  return `<div class="sh-field fm-f" data-fmw="${id}">${fmLabel(o)}${fmHint(o)}<div class="le-icons">${o.icons.map(([k, e]) => `<button type="button" class="le-ic" data-act="fm.icon" data-v="${k}" data-active="${k === v}" aria-label="${k}">${typeIcon(k, { size: 24 })}</button>`).join('')}</div><div class="pe-dup" data-fmdup="${id}" hidden></div></div>`; }
// ---- date / time (the texts from the TIME block) ----
function fmDate(F, id, o) { o = o || {}; const v = o.value || ''; fmReg(F, id, 'date', v, o);
  const clr = o.clear ? `<span role="button" tabindex="0" class="date-clr" data-act="fm.clear" data-v="${id}" aria-label="מחיקת התאריך" title="מחיקת התאריך"${v ? '' : ' hidden'}>${msi('close', { size: 18 })}</span>` : ''; // 10.4.0 (design-4): the clear ✕ sits inside the field
  return `<label class="sh-field fm-f fm-dt" data-fmw="${id}">${fmLabel(o)}<span class="fm-inrow"><input type="date" dir="ltr" data-fm="${id}" value="${escH(v)}"${o.min ? ` min="${o.min}"` : ''}${o.max ? ` max="${o.max}"` : ''}${o.act ? ` data-act="${o.act}"` : ''}>${clr}</span><small class="wd-auto" data-fmwd="${id}">${isIso(v) ? tmFmt('wd', v) : ''}</small>${fmHint(o)}${fmErrSlot(id)}</label>`; }
function fmDateInput(o) { return fmInput({ ...o, type: 'date', dir: 'ltr' }) + `<small class="wd-auto">${isIso(o.value) ? tmFmt('wd', o.value) : ''}</small>`; } // a date that acts at once (not a form's value)
function fmTime(F, id, o) { o = o || {}; const v = o.value || ''; fmReg(F, id, 'time', v, o);
  const clr = o.clear ? `<span role="button" tabindex="0" class="date-clr" data-act="fm.clear" data-v="${id}" aria-label="מחיקת השעה" title="מחיקת השעה"${v ? '' : ' hidden'}>${msi('close', { size: 18 })}</span>` : '';
  return `<label class="sh-field fm-f fm-dt" data-fmw="${id}">${fmLabel(o)}<span class="fm-inrow"><input type="time" dir="ltr" step="${o.step || 300}" data-fm="${id}" value="${escH(v)}"${o.act ? ` data-act="${o.act}"` : ''}>${clr}</span>${fmHint(o)}${fmErrSlot(id)}</label>`; }
// a pair side by side: "מ" and "עד" (dates: "עד" never before "מ" - setting "מ" fills an empty or earlier "עד", whose picker opens there)
function fmRange(F, a, b, oa, ob, kind) { if (F) { F.pairs = F.pairs || {}; F.pairs[a] = b; }
  const f = kind === 'time' ? fmTime : fmDate; return `<div class="sh-times fm-range">${f(F, a, oa)}${f(F, b, ob)}</div>`; }
// ---- file pick (a <label> around a hidden input - the only way that opens the picker on his phone) ----
function fmFile(o) { return `<label class="${o.cls == null ? 'btn-nav' : o.cls} fm-file"${o.title ? ` title="${o.title}"` : ''}${o.style ? ` style="${o.style}"` : ''}>${o.label}<input type="file"${o.inCls ? ` class="${o.inCls}"` : ' hidden'}${o.accept ? ` accept="${o.accept}"` : ''}${o.multiple ? ' multiple' : ''}${o.capture ? ` capture="${o.capture}"` : ''}${o.id ? ` id="${o.id}"` : ''}${o.act ? ` data-act="${o.act}"` : ''}${o.v != null ? ` data-v="${escH(o.v)}"` : ''}${o.data ? ' ' + o.data : ''}></label>`; }
// phone-round-1-fixes P12 (G13): a file door says at once that its file is being read - a line with the spinner under the door's row
// (the door's button is marked busy) until the reading ends; the caller awaits the promise first, so the line is painted before a long
// read or parse holds the page (a large Timeline export: seconds). Returns the function that takes the line away.
async function fmReading(input) {
  const lab = input && input.closest && input.closest('.fm-file'); if (!lab) return () => {};
  let row = lab.closest('.imp-door') || lab.closest('.brow') || lab; if (row.parentElement && row.parentElement.matches('.ent-links, .brow')) row = row.parentElement;
  const p = document.createElement('p'), sp = document.createElement('span'); p.className = 'sh-hint fm-reading'; p.setAttribute('role', 'status');
  sp.className = 'spin'; sp.setAttribute('aria-hidden', 'true'); p.append(sp, 'קורא את הקובץ…'); row.after(p); lab.setAttribute('aria-busy', 'true');
  await new Promise(r => { let done = false; const go = () => { if (!done) { done = true; setTimeout(r, 0); } }; requestAnimationFrame(go); setTimeout(go, 150); });
  return () => { p.remove(); lab.removeAttribute('aria-busy'); };
}
// ONE SEARCH FIELD (ס6; one-way (1): the one search kind - over my data, an address, the location field; moved here from filter-search.js):
// text with enterkeyhint "search", ✕ that clears it, keeps the focus and shows only while there is text (one delegated pair: fmFieldEvents
// shows or hides it, field.clear clears), the mark data-sfield (the layer manager reads "a search field" by it). o: { enter: the action of
// Enter, attrs: more attributes of the input (the location field's data-fmq / data-ps) }. A typing reaction: fmOnInput. The placeholder is
// text, escaped here as the value is (review-fixes-11471, 3: the guide's placeholder was cut at its quote) - a caller passes it unescaped.
function searchFieldHTML(id, placeholder, value, o) { o = o || {}; return `<span class="clear-wrap"><input${id ? ` id="${id}"` : ''} type="text" data-sfield="1" enterkeyhint="search" autocomplete="off" placeholder="${escH(placeholder)}" value="${escH(value || '')}"${o.enter ? ` data-act-enter="${escH(o.enter)}"` : ''}${o.attrs || ''}><button type="button" class="field-clear"${id ? ` id="${id}X"` : ''} data-act="field.clear" data-keepfocus aria-label="ניקוי"${value ? '' : ' hidden'}>✕</button></span>`; }
// a field's typing reaction (one-way (4): no input listener of its own - fmFieldEvents calls it); a search field's is its query
function fmOnInput(el, f) { if (el) el._onInput = f; }
// a plain field that acts at once (settings, filters of a screen): a select-like choice, a checkbox-like toggle, a number
// 11.4.0 (small-fixes item 14; the 11.0.0 review's Q2): a choice from a list is an outlined field with its arrow that opens the app's anchored
// menu (the map type's: rows, ✓ on the current value) - never the platform's select, whose system dialog does not follow the app's look.
// The field keeps a select's contract: .value is the chosen key, and its action (o.act, kept as data-sact) runs with the field once a row is chosen.
function fmSelect(o) { const cur = o.options.find(([k]) => String(k) === String(o.value)) || o.options[0] || ['', ''];
  return `<button type="button" class="fm-sel${o.cls ? ' ' + o.cls : ''}"${o.id ? ` id="${o.id}"` : ''} data-act="fm.sel"${o.act ? ` data-sact="${o.act}"` : ''}${o.data ? ' ' + o.data : ''}${o.dir ? ` dir="${o.dir}"` : ''} value="${escH(cur[0])}" data-opts="${escH(JSON.stringify(o.options))}" aria-haspopup="menu"><span class="fm-sel-v">${cur[1]}</span>${msi('arrow_drop_down', { size: 20, cls: 'fm-sel-ar' })}</button>`; }
act('fm.sel', c => { const b = c.el, open = document.getElementById('fmSelMenu'); if (open) { const was = open._for; open.remove(); if (was === b) return 'quiet'; }
  const opts = JSON.parse(b.dataset.opts || '[]'), m = document.createElement('div'); m.id = 'fmSelMenu'; m.className = 'ly-menu fm-menu'; m.setAttribute('role', 'menu'); m._for = b;
  m.innerHTML = opts.map(([k, l]) => { const on = String(k) === String(b.value); return `<button type="button" role="menuitemradio" aria-checked="${on}" data-act="fm.selPick" data-v="${escH(String(k))}" data-active="${on}"><span class="ly-t"><b>${l}</b></span>${on ? msi('check', { cls: 'ly-ck' }) : ''}</button>`; }).join('');
  document.body.appendChild(m);
  let ro = null; const place = () => { if (!m.isConnected) { sysOff(window, 'scroll', place, true); sysOff(window, 'resize', place); if (ro) ro.disconnect(); return; }
    const r = b.getBoundingClientRect(), vh = window.innerHeight, vw = document.documentElement.clientWidth, w = Math.max(m.offsetWidth, r.width);
    const nat = Math.min(m.scrollHeight + m.offsetHeight - m.clientHeight, vh * 0.6), below = vh - 8 - (r.bottom + 4), above = r.top - 4 - 8, down = nat <= below || (nat > above && below >= above);
    const mh = Math.round(Math.min(vh * 0.6, Math.max(120, down ? below : above))) + 'px'; if (m.style.maxHeight !== mh) m.style.maxHeight = mh; const h = m.offsetHeight; // 11.4.0: no room on either side - the roomier one, the menu scrolls; it never covers its field
    m.style.minWidth = r.width + 'px'; m.style.top = (down ? r.bottom + 4 : r.top - 4 - h) + 'px'; // below the field, above it when there is no room
    m.style.left = Math.max(8, Math.min(r.right - w, vw - 8 - w)) + 'px'; }; // its start edge at the field's start (RTL: the right)
  place(); sysOn(window, 'scroll', place, true); sysOn(window, 'resize', place); // 11.4.0: it follows its field while the screen scrolls
  if (window.ResizeObserver) { ro = new ResizeObserver(place); ro.observe(m); ro.observe(document.body); } // and when its own height or the page settles (fonts, icons, an opening section) - above the field its bottom stays at the field
  setTimeout(() => touchAny('down', function off(ev) { if (!m.contains(ev.target) && ev.target !== b && !b.contains(ev.target)) { m.remove(); touchAny('down', off, false); } }), 0); // a tap elsewhere closes it
  const sel = m.querySelector('[data-active="true"]'); if (sel) sel.focus({ preventScroll: true }); return 'quiet'; });
act('fm.selPick', c => { const m = c.el.closest('.fm-menu'), b = m && m._for; if (m) m.remove(); if (!b || !b.isConnected) return 'quiet';
  const opt = JSON.parse(b.dataset.opts || '[]').find(([k]) => String(k) === c.v); if (!opt || String(b.value) === c.v) return 'quiet';
  b.value = c.v; b.querySelector('.fm-sel-v').innerHTML = opt[1]; if (b.dataset.sact) runAct(b, c.ev, b.dataset.sact); return 'quiet'; });
// closing-where (11.26.0; decisions/2026-11-18-closing-where.md Q2; standard ui-lists-input "a row with a yes / no / unset mark"): the
// one mark of a row - a segmented pair "✓ <yes>" | "<no>"; neither selected = not marked yet; a tap on the selected segment clears it.
// The row's swipe (right = yes, left = no; .cl-row.g-swipe) fills the matching segment as its preview (.g-prev). Green only on the
// selected yes (Q5). o: { act, acts: [noAct, yesAct], on, no, v, yes, noTx }; the row wraps it under the name when they do not fit
function fmMark(o) { const a = k => (o.acts ? o.acts[k] : o.act), b = (k, p, tx) => `<button type="button" class="cl-vbtn" data-act="${escH(a(k))}" data-clvis="${escH(k)}" aria-pressed="${escH(!!p)}"${o.v != null ? ` data-v="${escH(o.v)}"` : ''}>${tx}</button>`;
  return `<span class="fm-mark" role="group" aria-label="${escH(o.label || 'סימון')}">${b(1, o.on, '✓ ' + (o.yes || TX.visited))}${b(0, o.no, o.noTx || 'לא הגענו')}</span>`; }
// (Q3) which of such rows a list shows: "עוד לא סומנו · N" | "הכל · N" (segmented; the counts follow the marks). o: { act, view: 'un' | 'all', nUn, nAll }
function fmMarkView(o) { const c = (v, tx, n) => `<button type="button" class="chip" data-act="${escH(o.act)}" data-v="${escH(v)}" data-active="${escH(o.view === v)}" aria-pressed="${escH(o.view === v)}">${tx}${SEP}<bdi>${n}</bdi></button>`;
  return `<div class="chips-row fm-chips fm-seg seg fm-markview" role="group" aria-label="אילו מקומות">${c('un', 'עוד לא סומנו', o.nUn)}${c('all', 'הכל', o.nAll)}</div>`; }
function fmCheck(o) { return `<input type="checkbox"${o.id ? ` id="${o.id}"` : ''}${o.act ? ` data-act="${o.act}"` : ''}${o.v != null ? ` data-v="${escH(o.v)}"` : ''}${o.checked ? ' checked' : ''}${o.disabled ? ' disabled' : ''}${o.cls ? ` class="${o.cls}"` : ''}${o.data ? ' ' + o.data : ''}>`; }
function fmInput(o) { return `<input type="${o.type || 'text'}"${o.id ? ` id="${o.id}"` : ''}${o.cls ? ` class="${o.cls}"` : ''}${o.act ? ` data-act="${o.act}"` : ''}${o.enter ? ` data-act-enter="${o.enter}"` : ''}${o.dir ? ` dir="${o.dir}"` : ''}${o.placeholder ? ` placeholder="${escH(o.placeholder)}"` : ''}${o.value != null ? ` value="${escH(o.value)}"` : ''}${o.min != null ? ` min="${o.min}"` : ''}${o.max != null ? ` max="${o.max}"` : ''}${o.step ? ` step="${o.step}"` : ''}${o.max ? ` maxlength="${o.max}"` : ''}${o.data ? ' ' + o.data : ''}${o.style ? ` style="${o.style}"` : ''}>`; }
function fmArea(o) { return `<textarea${o.id ? ` id="${o.id}"` : ''}${o.cls ? ` class="${o.cls}"` : ''}${o.max ? ` maxlength="${o.max}"` : ''}${o.readonly ? ' readonly' : ''} rows="${o.rows || 3}"${o.placeholder ? ` placeholder="${escH(o.placeholder)}"` : ''}${o.dir ? ` dir="${o.dir}"` : ''}${o.data ? ' ' + o.data : ''}${o.style ? ` style="${o.style}"` : ''}>${escH(o.value || '')}</textarea>`; }
// ---- a collapsed part with a summary of its values in its title (one line, cut with … - never grows) ----
function fmSec(F, id, o, inner) { if (F) F.sums[id] = o.sum || null;
  return `<details class="fm-sec pe-more${o.ic ? ' has-ic' : ''}" data-fmsec="${id}"${o.open ? ' open' : ''}><summary>${o.ic ? msi(o.ic, { cls: 'fm-secic' }) : ''}<span class="fm-sect">${o.title}</span><span class="fm-sum" data-fmsum="${id}"></span></summary><div class="fm-sec-in">${inner}</div></details>`; }
// ---- the frame of a form: head (title, ✕), the required line, the floating save row with its error line, the red row ----
// final-review-fixes (family B): one line that shortens with "…" (.t-ell), cut by the order of reading. CSS alone cuts at the box's edge, and in a mixed
// Hebrew / Latin text that edge can be the START of a run - the name would lose its beginning ("…dolfo Suárez טיסה למדריד"). So the text wraps (line
// breaking follows the reading order) and only its first line shows; ellFit marks a box that holds more (.cut): it then keeps room at its end for a "…"
// of its own. Until it is marked (one frame), or without the lh unit, the line limit's own "…" shows - never a cut without one.
// The direction of the box is its text's: <bdi> or dir="auto" (a Latin name in a Hebrew line is cut at its end, on the right).
function ellFit(root) { const els = [...(root || document).querySelectorAll('.t-ell')].filter(e => e.clientWidth);
  els.forEach(e => e.classList.remove('cut')); const cut = els.map(e => e.scrollHeight > e.clientHeight + 2); els.forEach((e, i) => { if (cut[i]) e.classList.add('cut'); }); cardActsFit(root); }
let _ellT = 0;
function ellFitSoon() { if (_ellT) return; _ellT = requestAnimationFrame(() => { _ellT = 0; ellFit(); }); }
// ---- card-actions (41b; decisions 2026-11-23 · A card's actions on a phone): a card's or a question's actions, one component ----
// primary: { act, label, id?, v?, data?, cls?, hidden? } - the filled button at full width; secs: the same shape, as quiet text buttons in equal parts
// under it (a falsy entry is skipped). o.cls: a class of the whole block. No place writes this markup by hand (t890's guard and ui_lint's check 15).
function caBtn(b, cls) { return `<button type="button" class="${escH(cls + (b.cls ? ' ' + b.cls : ''))}"${b.id ? ` id="${escH(b.id)}"` : ''} data-act="${escH(b.act)}"${b.v != null ? ` data-v="${escH(b.v)}"` : ''}${b.data ? ' ' + b.data : ''}${b.hidden ? ' hidden' : ''}>${b.label}</button>`; }
function cardActionsHTML(primary, secs, o) { const s = (secs || []).filter(Boolean);
  return `<div class="card-acts${o && o.cls ? ' ' + o.cls : ''}">${primary ? caBtn(primary, 'btn-nav ca-main') : ''}${s.length ? `<div class="ca-sec">${s.map(b => caBtn(b, 'btn-text')).join('')}</div>` : ''}</div>`; }
// one quiet action in the start half of a line (the closing step's "היינו בהכל" under the switcher's first half)
function halfActionHTML(b) { return `<div class="ca-sec ca-half">${caBtn(b, 'btn-text')}</div>`; }
// the measure (run by ellFit, after every draw, a window's frame and a resize): a part whose text does not fit stacks them all, one per line
function cardActsFit(root) { const rows = [...(root || document).querySelectorAll('.ca-sec')];
  rows.filter(r => r.matches('.ca-half')).forEach(r => { const v = r.previousElementSibling, u = v && v.matches('.fm-markview') && v.firstElementChild, one = u && v.getBoundingClientRect().height < 2 * u.getBoundingClientRect().height - 2; // a half under a switcher: as wide as its first segment
    if (one) r.style.setProperty('--ca-start', u.getBoundingClientRect().width + 'px'); else r.style.removeProperty('--ca-start'); });
  rows.forEach(r => r.classList.remove('ca-stack')); const tight = rows.map(r => [...r.children].some(b => b.clientWidth && b.scrollWidth > b.clientWidth + 1)); rows.forEach((r, i) => { if (tight[i]) r.classList.add('ca-stack'); }); }
sysOn(window, 'resize', ellFitSoon); if (document.fonts && document.fonts.ready) document.fonts.ready.then(ellFitSoon);
// the direction of a text by its first letter (a flag or another sign before it does not count - dir="auto" reads a flag as a Latin letter)
function txtDir(t) { return /^[^A-Za-z\u0590-\u05FF\u0600-\u06FF]*[A-Za-z]/.test(String(t)) ? 'ltr' : 'rtl'; } // plain text: its first letter, "<...>" counted as typed (10.17.2)
// built HTML -> the text it shows. 11.8.1 (timeline-import step 0b, the 11.8.0 review's miss a): parsed in an inert template (no script runs,
// no picture loads), never cut with regular expressions; { noHidden } leaves out what a screen reader skips (aria-hidden icons)
function htmlFrag(h) { const t = document.createElement('template'); t.innerHTML = String(h == null ? '' : h); return t.content; }
function htmlText(h, o) { const f = htmlFrag(h); if (o && o.noHidden) f.querySelectorAll('[aria-hidden="true"]').forEach(e => e.remove()); return f.textContent; }
function ellTail(html) { html = String(html); const i = html.lastIndexOf('>') + 1, t = html.slice(i); return t.trim() ? html.slice(0, i) + ellB(t.trim()) : html; } // a flex row's label: its words (after its dot and icon) in the box
function ellB(html, cls) { return `<bdi class="${cls ? cls + ' ' : ''}t-ell" dir="${txtDir(htmlText(html))}">${html}</bdi>`; } // a label in its own one-line "…" box
// a name inside a title or a line that can be cut: isolated, in its own direction, and the part that gives way first (see headFit)
function nameB(v) { return ellB(escH(v), 'nm'); }
// SEP, sepTie and numTie (the value and separator ties) live in js/app-basics.js since value-tie-source (defined before every part)
function fmHead(title, id) { return `<div class="sheet-head"><b>${title}</b><button class="sheet-x" data-act="win.close"${id ? ` id="${id}"` : ''} aria-label="סגירה">✕</button></div>`; }
// 9.1.1 (12ג-8): one list of actions in a menu window (trip actions, share, add, export): [value, label, small line, extra class]
function taListHTML(o, items) { const key = o.act.split('.')[1];
  return `<div class="ta-list">${items.map(([v, l, sub, cls]) => `<button type="button" class="ta-item t-wrap${cls ? ' ' + cls : ''}" data-act="${o.act}" data-${key}="${v}">${l}${sub != null ? ` <small>${sub}</small>` : ''}</button>`).join('')}</div>`;
}
function fmSaveBar(o) { return `<div class="sh-error fm-errline" hidden></div><div class="brow export-actions sheet-save-bar"><button class="btn-nav" id="fmSave" data-act="${o.act}">${o.label || 'שמירה'}</button>${o.extra || ''}</div>`; }
// editor-end-actions (decisions 2026-11-10 "The end of an editor"): an editor's actions at its end are one outlined group of
// full-width list rows - a leading line icon and the words, dividers between them; a deleting row (del) last, in error red (red only
// for deleting: a reversible action - hide, unmark, back to the source - is a neutral row). The one end-of-form component.
// rows: [{ act, label, ic, del, id }] (falsy rows are skipped); the label is plain text
function fmEndActs(rows) { rows = rows.filter(Boolean); if (!rows.length) return '';
  rows = rows.filter(r => !r.del).concat(rows.filter(r => r.del));
  return `<div class="fm-acts">${rows.map(r => `<button type="button" class="fm-act${r.del ? ' fm-act-del' : ''}" data-act="${r.act}"${r.id ? ` id="${r.id}"` : ''}>${msi(r.ic || 'delete', { size: 20 })}<span>${escH(r.label)}</span></button>`).join('')}</div>`; }
// ---- values ----
function fmGet(F, id) { const k = F.kinds[id]; if (!k) return undefined;
  if (k === 'text' || k === 'date' || k === 'time') { const el = fmIn(F, id); if (!el) return F.vals[id]; const v = el.value; return k === 'text' && !F.conf[id].raw ? v.trim() : v; }
  if (k === 'color') { return F.vals[id]; }
  return F.vals[id]; }
function fmValues(F) { const o = {}; Object.keys(F.kinds).forEach(id => { o[id] = fmGet(F, id); }); if (F.extra) o.__extra = F.extra(); return o; }
function fmDirty(F) { return !!F && F.init != null && JSON.stringify(fmValues(F)) !== F.init; }
function fmSet(F, id, v, quiet) { const k = F.kinds[id]; if (!k) return;
  if (k === 'text' || k === 'date' || k === 'time') { const el = fmIn(F, id); if (el) el.value = v == null ? '' : v; F.vals[id] = v; fmFieldChanged(F, id); return; }
  F.vals[id] = v; fmPaint(F, id); if (!quiet) fmFieldChanged(F, id); }
// redraw one field's own spot after its value changed (no window redraw)
function fmPaint(F, id) { const k = F.kinds[id], o = F.conf[id] || {}, v = F.vals[id], w = fmW(F, id); if (!w) return;
  if (k === 'chips') { w.querySelectorAll('.fm-chips > .chip').forEach(b => { b.dataset.active = String(b.dataset.v === String(v)); });
    const cur = (o.options || []).find(([kk]) => String(kk) === String(v)), pb = w.querySelector('.fm-pickbtn'); if (pb) pb.innerHTML = ellTail(cur ? cur[1] : '—') + '<span class="fm-caret"> ▾</span>'; ellFitSoon(); }
  else if (k === 'pick') { const b = w.querySelector('.fm-pick'); if (b) { b.innerHTML = ellTail(o.text(v)) + '<span class="fm-caret"> ▾</span>'; ellFitSoon(); } }
  else if (k === 'tog') { const b = w.querySelector('.fm-tog'); if (b) b.setAttribute('aria-checked', String(!!v)); }
  else if (k === 'cnt') { w.innerHTML = fmCountInner(id, o, v); }
  else if (k === 'chks') { w.querySelector('.fm-chks').innerHTML = fmChecksInner(id, o, v); }
  else if (k === 'color') { w.querySelectorAll('.le-sw').forEach(b => { b.dataset.active = String(b.dataset.v.toLowerCase() === String(v).toLowerCase()); }); const c = w.querySelector('input[type=color]'); if (c && c.value.toLowerCase() !== String(v).toLowerCase() && /^#[0-9a-f]{6}$/i.test(v)) c.value = v; }
  else if (k === 'icon') { w.querySelectorAll('.le-ic').forEach(b => { b.dataset.active = String(b.dataset.v === v); }); }
  else if (k === 'loc') fmLocShow(F, id);
  else if (k === 'end') fmEndShow(F, id);
  else if (k === 'stops') { const l = w.querySelector('.fm-stopl'); if (l) l.innerHTML = fmStopsHTML(id, v); } }
// after any change of a field: its own callback, its error goes away, the summaries of the collapsed parts
function fmFieldChanged(F, id, typing) { fmErrClear(F, id); if (F.on[id]) { if (typing) DATA_TYPING.n++; try { F.on[id](fmGet(F, id), F); } catch (e) { console.error(e); errNote('fm:' + id, e); } finally { if (typing) DATA_TYPING.n--; } } fmSums(F); }
// ride-no-home item 3 (phone round 6, P17 step 1, G133; the owner 25.11.2026): a field's typing reaction never redraws its window - while
// it runs (a letter typed into a text field) a change of the data redraws the screen behind only (dataChanged), so the field keeps the focus,
// the keyboard and the scroll; a reaction that saves on each letter holds its save to a pause (artReqSet). Guard: t1234. The count (DATA_TYPING) is kept by dataChanged's part.
function fmSums(F) { Object.entries(F.sums).forEach(([id, f]) => { const el = fmQ(F, `[data-fmsum="${id}"]`); if (!el || !f) return; let s = ''; try { s = f(F) || ''; } catch (e) {} el.innerHTML = s || ''; }); } // 10.4.0: the summary on its own line under the group's name (no ' · ')
// ---- errors by the field (מ6): red under it, red frame, scrolled to (no caret - no keyboard), a short line in the save row ----
function fmFail(F, id, msg) { const w = fmW(F, id), e = fmQ(F, `[data-fmerr="${id}"]`);
  if (e) { e.innerHTML = msi('error', { size: 16 }) + escH(msg); e.hidden = false; } if (w) { w.classList.add('fm-bad'); const sec = w.closest('details'); if (sec && !sec.open) sec.open = true; } // 10.1.0 (design-1): the message under the field, with the error icon
  const line = fmQ(F, '.fm-errline'); if (line) { line.innerHTML = `<button type="button" class="fm-toerr fm-err" data-act="fm.toErr" data-v="${id}">${msi('error', { size: 16 })}${e ? 'יש שדה לתקן' + msi('arrow_upward', { size: 16 }) : escH(msg)}</button>`; line.hidden = false; } // 10.8.0 (design-icons, gap 66): the field-error look
  if (w) fmScrollTo(w); return null; }
function fmFailLine(F, msg) { const line = fmQ(F, '.fm-errline'); if (line) { line.innerHTML = `<span class="fm-err">${msi('error', { size: 16 })}${escH(msg)}</span>`; line.hidden = false; } return null; } // an error that belongs to no single field
function fmErrClear(F, id) { const w = fmW(F, id), e = fmQ(F, `[data-fmerr="${id}"]`); if (e) e.hidden = true; if (w) w.classList.remove('fm-bad');
  if (!fmQ(F, '.fm-bad')) { const line = fmQ(F, '.fm-errline'); if (line) line.hidden = true; } }
function fmScrollTo(w) { const sc = w.closest('#sheet') || document.getElementById('sheet'); const r = w.getBoundingClientRect(), s = sc.getBoundingClientRect();
  if (r.top < s.top + 50 || r.bottom > s.bottom - 90) sc.scrollTop += r.top - s.top - 70; }
function fmDup(F, id, html) { const el = fmQ(F, `[data-fmdup="${id}"]`); if (!el) return; el.innerHTML = html || ''; el.hidden = !html; }
// ---- attach: the form lives on its window's layer; its starting point for "יש שינוי שלא נשמר" (מ8) ----
function fmAttach(F, root) { const t = layerTop(); if (t && !root) { t.form = F; F.win = t; } F.el = root || null;
  const r = fmRoot(F); // 10.4.0 (design-4): no "* שדה חובה" legend - the red * by the label says it
  Object.keys(F.kinds).forEach(id => { if (F.kinds[id] === 'loc') fmLocStart(F, id); if (F.kinds[id] === 'end') fmEndShow(F, id); });
  fmSums(F); fmFit(r); F.init = JSON.stringify(fmValues(F)); return F; }
function fmRestart(F) { F.init = JSON.stringify(fmValues(F)); } // after the form itself changed its starting point (a value it was opened with)
// 11.15.1 (windows-inner-steps-fix, Q2): the live form of the window a form was attached to - a picker's callback that runs after the
// window under it came back writes there, never to a form it captured (a window drawn again meanwhile holds a new form)
const fmLive = F => (F && F.win && F.win.form) || F;
const fmOf = el => { const t = layerTop(); return t && t.form && (!el || !t.form.el || t.form.el.contains(el)) ? t.form : null; };
// ---- fitting the chips (מ3): measured in one row at the real width; refit on resize ----
function fmFit(root) { (root || document).querySelectorAll('[data-fmfit]').forEach(w => { const row = w.querySelector('.fm-chips'), b = w.querySelector('.fm-pickbtn'); if (!row || !b) return;
  row.hidden = false; b.hidden = true; if (!row.offsetParent && !row.getClientRects().length) return; // not on screen: keep the chips
  row.classList.add('fm-measure'); const over = row.scrollWidth > row.clientWidth + 1; row.classList.remove('fm-measure');
  row.hidden = over; b.hidden = !over; }); }
sysOn(window, 'resize', () => { clearTimeout(window._fmFitT); window._fmFitT = setTimeout(() => fmFit(document.getElementById('sheet')), 120); });
// ---- the field's own typing and value changes (the named exception of the action wiring) ----
function fmFieldEvents() { // the named exception of the action wiring: typing and value changes in the fields themselves
document.addEventListener('change', e => { const el = e.target; if (!el || el.type !== 'date' || el.dataset.fm != null) return; const w = el.nextElementSibling; if (w && w.classList.contains('wd-auto')) w.textContent = isIso(el.value) ? tmFmt('wd', el.value) : ''; }, true);
  ['input', 'change'].forEach(ev => document.addEventListener(ev, e => { const el = e.target; if (!el || !el.dataset || el.dataset.fm == null || el.dataset.act) return;
    const F = fmOf(el); if (!F || !F.kinds[el.dataset.fm]) return; const id = el.dataset.fm, k = F.kinds[id];
    if (el.dataset.fmcolor) { if (ev === 'input' || ev === 'change') { F.vals[id] = el.value; fmPaint(F, id); fmFieldChanged(F, id); } return; }
    if (k === 'date' && ev === 'change') { const w = fmQ(F, `[data-fmwd="${id}"]`); if (w) w.textContent = isIso(el.value) ? tmFmt('wd', el.value) : '';
      const clr = fmW(F, id) && fmW(F, id).querySelector('.date-clr'); if (clr) clr.hidden = !el.value;
      const to = F.pairs && F.pairs[id]; if (to) { const t = fmIn(F, to); if (t) { if (el.value && (!t.value || t.value < el.value)) { t.value = el.value; const tw = fmQ(F, `[data-fmwd="${to}"]`); if (tw) tw.textContent = tmFmt('wd', el.value); const c2 = fmW(F, to) && fmW(F, to).querySelector('.date-clr'); if (c2) c2.hidden = false; } t.min = el.value || ''; } } }
    if (k === 'time' && ev === 'change') { const clr = fmW(F, id) && fmW(F, id).querySelector('.date-clr'); if (clr) clr.hidden = !el.value; }
    if (ev === 'input' || k !== 'text') fmFieldChanged(F, id, ev === 'input' && k === 'text'); }));
  // one-way (1, 4): typing outside a form's values - a field's ✕ beside it shows while it has text (.clear-wrap / .fm-inrow), its own
  // reaction (fmOnInput: a search's query, a word that grows its box, a zoom slider), and a place search's typing (data-ps)
  document.addEventListener('input', e => { const el = e.target; if (!el || !el.dataset || el.dataset.fm != null) return; const w = el.parentElement;
    if (w && w.matches('.clear-wrap, .fm-inrow')) { const x = w.querySelector(':scope > .field-clear, :scope > .date-clr'); if (x) x.hidden = !el.value; }
    if (el._onInput) el._onInput(el.value); if (el.dataset.ps) psTyping(el.dataset.ps, el.value); });
}
fmFieldEvents();
// one-way (1): the ✕ of a field outside a form's values (the search kind's .field-clear, a time that acts at once's .date-clr in its row):
// cleared here, for every field - its typing reaction runs (an 'input' event), a place search drops its results, a search keeps the focus
act('field.clear', c => { const input = c.el.parentElement.querySelector('input'); if (!input) return 'quiet'; input.value = ''; c.el.hidden = true;
  const H = input.dataset.ps && PS_HOSTS[input.dataset.ps]; if (H) { clearTimeout(H.t); H.st = null; psDraw(H); }
  input.dispatchEvent(new Event('input', { bubbles: true })); if (input.dataset.sfield) input.focus(); return 'quiet'; });
// ---- the taps of the fields (registered actions) ----
act('fm.chip', c => { const F = fmOf(c.el), w = c.el.closest('[data-fmw]'); if (!F || !w) return; fmSet(F, w.dataset.fmw, c.v); return 'quiet'; });
act('fm.tog', c => { const F = fmOf(c.el); if (!F) return; fmSet(F, c.v, !F.vals[c.v]); return 'quiet'; });
act('fm.chk', c => { const F = fmOf(c.el); if (!F) return; const i = c.v.indexOf('|'), id = c.v.slice(0, i), k = c.v.slice(i + 1), o = F.conf[id] || {}; if ((o.items || []).some(x => x.k === k && x.always)) return 'quiet';
  const cur = F.vals[id] || []; fmSet(F, id, cur.includes(k) ? cur.filter(x => x !== k) : o.items.filter(x => !x.always && (x.k === k || cur.includes(x.k))).map(x => x.k)); return 'quiet'; });
act('fm.cnt', c => { const F = fmOf(c.el), w = c.el.closest('[data-fmw]'); if (!F || !w) return; const id = w.dataset.fmw, o = F.conf[id] || {}; let v = (Number(F.vals[id]) || 0) + Number(c.v);
  if (o.max != null) v = Math.min(o.max, v); if (o.min != null) v = Math.max(o.min, v); fmSet(F, id, v); return 'quiet'; });
act('fm.color', c => { const F = fmOf(c.el), w = c.el.closest('[data-fmw]'); if (!F || !w) return; fmSet(F, w.dataset.fmw, c.v); return 'quiet'; });
act('fm.icon', c => { const F = fmOf(c.el), w = c.el.closest('[data-fmw]'); if (!F || !w) return; fmSet(F, w.dataset.fmw, c.v); return 'quiet'; });
act('fm.clear', c => { if (c.ev) c.ev.preventDefault(); const F = fmOf(c.el); if (!F) return; fmSet(F, c.v, ''); const w = fmQ(F, `[data-fmwd="${c.v}"]`); if (w) w.textContent = ''; c.el.hidden = true; return 'quiet'; });
act('fm.toErr', c => { const F = fmOf(c.el), w = F && fmW(F, c.v); if (w) reveal(w, false); return 'quiet'; });
act('fm.pick', c => { const F = fmOf(c.el); if (!F) return; const o = F.picks[c.v]; if (o && o.open) o.open(F, c.v); return 'quiet'; });
// the chips that did not fit, in a window of their own; the choice goes back to the form under it
act('fm.choose', c => { const F = fmOf(c.el); if (!F) return; const id = c.v, o = F.conf[id];
  openFmChoice({ title: htmlText(o.label || ''), options: o.options.map(([k, l]) => ({ v: k, html: l })), value: F.vals[id] }, v => fmSet(fmLive(F), id, v)); return 'quiet'; });
// ---- the one choice window (chips that did not fit, a layer by destination, a day, a weekday...): bottom sheet, or a full screen
// with search for a long list. options: [{ v, html, group?, sub?, hint? }]; onPick(v) runs on the form under it after it is back.
var _fmChoice = null;
// picker-rule (decisions 2026-11-18 · Several-values pickers): a picker of several values declares its kind (o.multi) - 'filter':
// each tap applies at once, no "סיום", every close keeps; 'draft': the taps are kept in the picker (ch.draft, from o.draft) until
// "✓ סיום", which calls onPick once with the final list; every other close changes nothing. Without o.multi a tap picks and closes.
const FM_MULTI = ['filter', 'draft'];
function openFmChoice(o, onPick) { layerNote(openFmChoice, arguments);
  if (o.keep !== undefined || (o.multi != null && !FM_MULTI.includes(o.multi))) throw new Error('openFmChoice: a several-values picker declares multi: filter | draft');
  const ch = _fmChoice = { o, onPick, q: '' }, multi = o.multi || null;
  if (multi === 'draft') ch.draft = [].concat((typeof o.draft === 'function' ? o.draft() : o.draft) || []);
  const V = f => typeof f === 'function' ? f(ch.draft) : f, as = o.as || 'list', long = as === 'list' && (V(o.options).length > 14 || !!o.search), sheet = document.getElementById('sheet');
  const isOn = x => multi === 'draft' ? (o.isOn ? o.isOn(x.v, x, ch.draft) : ch.draft.some(v => String(v) === String(x.v))) : o.isOn ? o.isOn(x.v, x) : x.on != null ? x.on : String(x.v) === String(o.value);
  const list = () => { const n = ch.q.trim().toLowerCase(), opts = (o.lead && n ? o.lead(ch.q.trim()) : []).concat(V(o.options).filter(x => x.keep || !n || String(x.text || x.html).toLowerCase().includes(n) || String(x.group || '').toLowerCase().includes(n)), ch.found || []);
    return choiceSetHTML(opts, { as, act: 'fm.choice', isOn, rowAttr: o.rowAttr }) || (as === 'list' ? '<p class="sh-hint">אין תוצאות</p>' : ''); };
  const draw = () => { const hs = V(o.hints) || (o.hint ? [o.hint] : []);
    sheet.innerHTML = `${fmHead(V(o.title) || 'בחירה', o.closeId)}${hs.map(h => `<${o.hintTag || 'p'} class="sh-hint">${h}</${o.hintTag || 'p'}>`).join('')}${long ? `<div class="ap-search">${searchFieldHTML('fmChQ', o.searchHint || 'חיפוש', ch.q)}</div>` : ''}${o.why ? `<div class="sh-why" hidden>${V(o.why)}</div>` : ''}${o.quick ? choiceSetHTML(V(o.quick), { as: o.quickAs || 'chips', act: 'fm.choice', isOn }) : ''}${as === 'list' ? `<div class="fm-choice-list" id="fmChList">${list()}</div>` : list()}${o.foot || ''}${multi === 'draft' ? '<div class="brow sheet-actions sheet-save-bar fm-ch-done"><button type="button" class="btn-nav" data-act="fm.chDone">✓ סיום</button></div>' : ''}`;
    if (long) fmOnInput(sheet.querySelector('#fmChQ'), v => { ch.q = v; ch.found = null; document.getElementById('fmChList').innerHTML = list(); if (o.ps) fmChFind(ch); });
    if (long && o.ps) sheet.querySelector('#fmChQ').dataset.actEnter = 'fm.chGo';
    if (ch.shown) sheetFrame(sheet, layerTop()); }; // a redraw keeps the frame (the handle of a bottom sheet)
  draw(); showSheetBackdrop(o.key || (long ? 'openFmChoiceFull' : 'openFmChoice'), { draw }); const t = layerTop(); t.choice = ch; t.multi = multi; ch.shown = true;
}
// 9.4.0 (ס15 family 2): one builder for a set of choices - rows (the choice window, the reasons to hide), chips (the choice window's
// multi-select sets, the filter's sets) or a grid of days. Each option: { v, html, sub?, group?, on?, mark?, attr?, act?, disabled? }.
function choiceSetHTML(opts, c) { const on = x => !!(c.isOn ? c.isOn(x) : x.on), A = x => `data-act="${x.act || c.act}"${c.attr ? c.attr(x) : ''}${x.attr || ''}${x.v != null ? ` data-v="${escH(x.v)}"` : ''}`;
  if (c.as === 'seg') return `<div class="view-toggle seg"${c.rowAttr || ''} role="group">${opts.map(x => `<button type="button" ${A(x)} data-active="${on(x)}" aria-pressed="${on(x)}">${x.html}</button>`).join('')}</div>`; // 10.9.0 (design-forms): an exclusive quick choice - segmented
  if (c.as === 'chips') return `<div class="chips-row wrap"${c.rowAttr || ''}>${opts.map(x => `<button type="button" class="chip" ${A(x)} data-active="${on(x)}">${ellTail(x.html)}</button>`).join('')}</div>`; // a plain label (a name) in its own "…" box: a chip is a flex row, where "…" does not work on bare text
  if (c.as === 'grid') return `<div class="day-grid">${opts.map(x => `<button type="button" class="day-cell t-wrap" ${A(x)} data-active="${on(x)}"${x.mark != null ? ` data-anchor="${!!x.mark}"` : ''}${x.band ? ` data-band="${x.band}"` : ''}>${x.html}${x.sub ? `<small>${x.sub}</small>` : ''}</button>`).join('')}</div>`;
  let g = null; return opts.map(x => { let h = '';
    if (x.group != null && x.group !== g) { g = x.group; h += `<div class="fm-ch-group">${escH(x.group)}</div>` /* a group name is plain text (a destination's name) */; }
    return h + `<button type="button" class="fm-ch t-wrap${on(x) ? ' on' : ''}" ${A(x)}${x.disabled ? ' disabled' : ''}>${x.html}${x.sub ? `<small>${x.sub}</small>` : ''}</button>`; }).join('');
}
act('fm.choice', c => { const t = layerTop(), ch = t && t.choice; if (!ch) return; const V = f => (typeof f === 'function' ? f() : f) || [];
  const x = V(ch.o.quick).concat(V(ch.o.options), ch.found || [], ch.o.lead && ch.q.trim() ? ch.o.lead(ch.q.trim()) : []).find(x => String(x.v) === c.v) || { v: c.v };
  if (ch.o.multi === 'filter') { ch.onPick(x.v, x); return 'redraw'; } // every tap applies at once, every close keeps (multi-select, a range of days)
  if (ch.o.multi === 'draft') { const on = ch.draft.some(v => String(v) === String(x.v)); ch.draft = ch.o.toggle ? ch.o.toggle(ch.draft, x.v, x) : on ? ch.draft.filter(v => String(v) !== String(x.v)) : ch.draft.concat(x.v); return 'redraw'; } // only the picker's draft
  closeSheet(); setTimeout(() => ch.onPick(x.v, x), 0); return 'quiet'; });
// a draft picker's "✓ סיום": the picker closes, then the caller gets the final list once (a data change - one action, one undo row)
act('fm.chDone', () => { const t = layerTop(), ch = t && t.choice; if (!ch || ch.o.multi !== 'draft') return; const d = ch.draft.slice(); closeSheet(); ch.onPick(d); return 'quiet'; }); // 'quiet': the window under is returned to as left (a redraw would build its form again); a data change draws by itself
// 11.0.0: a choice window whose search also asks outside - 11.20.0 (place-search-upgrade): o.ps, a host of the one place search; typing
// pauses ask Photon, Enter both services; its rows (o.psRow(x, i) -> an option) come after the window's own, then its states and end rows
function fmChFind(ch, how) { const q = ch.q.trim(), H = PS_HOSTS[ch.o.ps]; if (!H) return; H.draw = () => fmChDraw(ch);
  if (how === 'explicit') { if (q) psRun(H.id, q, 'explicit'); return; } if (q.length < 3) { H.st = null; return; } psTyping(H.id, q); }
function fmChDraw(ch) { const t = layerTop(), H = PS_HOSTS[ch.o.ps]; if (!t || t.choice !== ch || !H || !H.st) return; const q = ch.q.trim(), st = H.st;
  ch.found = (st.list || []).map((x, i) => ch.o.psRow(x, i)); const box = document.getElementById('fmChList'); if (!box) return;
  box.innerHTML = choiceSetHTML((ch.o.lead && q ? ch.o.lead(q) : []).concat((typeof ch.o.options === 'function' ? ch.o.options() : ch.o.options).filter(x => x.keep || String(x.text || x.html).toLowerCase().includes(q.toLowerCase())), ch.found), { as: 'list', act: 'fm.choice', isOn: () => false })
    + `<div class="ps-chfoot">${psFootHTML(H)}${psEndHTML(H)}</div>`; }
act('fm.chGo', () => { const t = layerTop(), ch = t && t.choice; if (ch && ch.o.ps) fmChFind(ch, 'explicit'); return 'quiet'; });
// ---- an end of a travel (11.0.0, travels-1-model, Q11): one field per end, built on the location mechanism below - a tap opens the end
// choice (o.choose): the proposal found from the text, the day's other travels, the trip's places, the address search and a point on the
// map. The choice sets both the name and the location; the name can be edited there. Value: { name, loc } - loc { pid } (a place of the
// trip) or { lat, lng }, only when confirmed. Under the field: "מוצע לפי ״…״ · בחירה מאשרת" while a proposal waits.
function fmEnd(F, id, o) { o = o || {}; fmReg(F, id, 'end', o.value || { name: '', loc: null }, o);
  return `<div class="sh-field fm-f fm-end" data-fmw="${id}">${fmLabel(o)}<button type="button" class="fm-pickbtn fm-pick fm-endbtn" data-act="fm.end" data-v="${id}"></button><small class="fm-endprop" data-fmendp="${id}" hidden></small>${fmErrSlot(id)}</div>`; }
function fmEndShow(F, id) { const v = F.vals[id] || {}, w = fmW(F, id); if (!w) return; const b = w.querySelector('.fm-endbtn'), pl = w.querySelector('.fm-endprop'), o = F.conf[id] || {};
  if (b) b.innerHTML = `${msi('location_on', { size: 20 })}${ellB(escH(v.name || ''))}<span class="fm-caret"> ▾</span>`;
  const p = !v.loc && o.travel ? endProposal({ ...o.travel(), [id]: v.name || '', [id + 'Loc']: null }, id) : null;
  if (pl) { pl.hidden = !p && (v.loc || !v.name); pl.innerHTML = p ? `מוצע לפי ״${escH(p.q)}״${SEP}בחירה מאשרת` : 'חסר מיקום'; pl.classList.toggle('prop', !!p); }
  ellFitSoon(); }
act('fm.end', c => { const F = fmOf(c.el); if (F) openEndChoice(F, c.v); return 'quiet'; });
// along-drive (a drive's stops): a list of points on the way - each row its name and ✕, then "＋ עצירה", which opens the same end choice
// (openEndChoice) for one more; o.order puts the list in its order after each change (a drive's: the road's). Value: [{ name, loc }]
function fmStops(F, id, o) { o = o || {}; fmReg(F, id, 'stops', (o.value || []).slice(), o);
  return `<div class="sh-field fm-f fm-stops" data-fmw="${escH(id)}">${fmLabel(o)}<div class="dl-list fm-stopl">${fmStopsHTML(id, F ? F.vals[id] : o.value)}</div>${fmHint(o)}${fmErrSlot(id)}</div>`; }
function fmStopsHTML(id, v) { return (v || []).map((s, i) => stopRowHTML(s, `data-act="fm.stopDel" data-v="${escH(id + '|' + i)}"`)).join('')
  + `<button type="button" class="link-btn fm-stopadd" data-act="fm.end" data-v="${escH(id)}">${msi('add_location_alt', { size: 18 })} עצירה</button>`; }
// one stop's row (the editor's list and the card's window): its name, where it is, and ✕
function stopRowHTML(s, del, sub) { return `<div class="dl-row tv-stoprow"><span class="dl-name">${msi('location_on', { size: 20 })}<span class="dl-tx"><b dir="auto">${escH(s.name || 'מיקום במפה')}</b>${sub ? `<small>${sub}</small>` : ''}</span></span>`
  + `<button type="button" class="dl-ib" ${del} aria-label="הסרת העצירה" title="הסרת העצירה">${msi('close', { size: 20 })}</button></div>`; }
function fmStopAdd(F, id, st) { if (!F || F.kinds[id] !== 'stops' || !st || !st.loc) return; const o = F.conf[id] || {}, v = (F.vals[id] || []).concat([st]); fmSet(F, id, o.order ? o.order(v, F) : v); }
act('fm.stopDel', c => { const F = fmOf(c.el); if (!F) return; const [id, i] = String(c.v).split('|'), v = (F.vals[id] || []).slice(); v.splice(+i, 1); fmSet(F, id, v); return 'quiet'; });

// 4.3.0: list/map is remembered per screen on this device, also after the app is reopened
function getViewMode(key) { return ((DEV.viewModes || {})[key]) || 'list'; }
function setViewMode(key, mode) { try { if (mode !== 'map' && TV_MARK && key === 'day_' + TV_MARK.day) TV_MARK = null; } catch (e) { /* before the maps' part ran */ } devSet({ viewModes: { ...(DEV.viewModes || {}), [key]: mode } }); }
// 10.3.0 (design-3): one segmented control for every two-to-four exclusive choices of a screen - list / map in each open day of the
// plan and in the draft's pinned bar (the floating list ⇄ map button #viewFab was retired). opts: [[value, html]]
// 10.9.0 (design-forms, gap 32): an exclusive choice of 2-4 options on a screen (settings) - segmented buttons with short words, the chosen option's full line under them;
// o.list: rows instead (icon, name, its line, the chosen one tinted with a check - the map type, whose four options each carry a line, as in the map's own menu)
function choiceHTML(o) { const cur = String(o.cur), c = o.opts.find(x => String(x[0]) === cur), lbl = o.label ? `<span class="ch-lbl">${o.label}</span>` : '';
  if (o.list) return `<div class="sh-field ch-f"${o.id ? ` id="${o.id}"` : ''}>${lbl}<div class="opt-list" role="radiogroup">${o.opts.map(([v, t, sub, ic]) => { const on = String(v) === cur; return `<button type="button" role="radio" aria-checked="${on}" data-act="${o.act}"${o.attrs(v)} data-active="${on}">${ic ? msi(ic, { cls: 'ol-ic' }) : ''}<span class="ol-t"><b>${t}</b>${sub ? `<small>${sub}</small>` : ''}</span>${on ? msi('check', { cls: 'ol-ck' }) : ''}</button>`; }).join('')}</div></div>`;
  return `<div class="sh-field ch-f"${o.id ? ` id="${o.id}"` : ''}>${lbl}<div class="view-toggle seg ch-seg" role="group">${o.opts.map(([v, t, sub, ic]) => { const on = String(v) === cur; return `<button type="button" data-act="${o.act}"${o.attrs(v)} data-active="${on}" aria-pressed="${on}"${sub ? ` aria-label="${fmEsc(htmlText(sub, { noHidden: true }).replace(/\s+/g, ' ').trim())}"` : ''}>${ic ? msi(ic, { size: 18 }) : ''}${t}</button>`; }).join('')}</div>${c && c[2] ? `<small class="ch-sub">${c[2]}</small>` : ''}</div>`; }
// a yes/no setting on a screen: the switch row of the forms (title, supporting line)
function setSwitchHTML(act, attrs, on, title, sub) { return `<div class="fm-togrow"><button type="button" class="fm-tog t-wrap" role="switch" aria-checked="${on}" data-act="${act}"${attrs}><span class="fm-sw" aria-hidden="true"></span><span class="fm-togl">${title}${sub ? `<small class="fm-togs">${sub}</small>` : ''}</span></button></div>`; }
function segHTML(act, opts, cur, ex) { return `<div class="view-toggle seg" role="group">${opts.map(([v, h]) => `<button type="button" data-act="${act}" data-v="${v}"${ex || ''} data-active="${v === cur}" aria-pressed="${v === cur}">${h}</button>`).join('')}</div>`; }
function viewToggleHTML(key) { // the plan's toggle inside each open day (several days on one screen)
  if (!MAP_AVAILABLE) return '';
  return segHTML('view.mode', [['list', msi('view_agenda', { size: 18 }) + 'רשימה'], ['map', msi('map', { size: 18 }) + 'מפה']], getViewMode(key), ` data-vt="${key}"`);
}
var _listY = {}; // 5.3.0: the list's scroll per screen, kept while its map is shown
function mapCardSync() { document.body.classList.toggle('map-card-open', !!document.querySelector('.map-float')); }

// 4.3.0: one rule for every multi-select chip set (layers, destinations, regions, styles, draft): each chip is a plain on/off
// switch. A set is empty when everything is on, and holds NONE when everything is off. "הכל" is on only when all are on;
// tapping it turns all on, or all off when all are on.
function selOn(set, id) { return !set.size || set.has(id); }
function selToggle(set, id, ids) {
  const cur = !set.size ? new Set(ids) : new Set([...set].filter(x => ids.includes(x)));
  if (cur.has(id)) cur.delete(id); else cur.add(id);
  if (ids.length && ids.every(x => cur.has(x))) return new Set();
  return cur.size ? cur : new Set([NONE]);
}
function selAllTap(set) { return set.size ? new Set() : new Set([NONE]); }
function selNone(set) { return set.has(NONE); }

// 4.3.0: name bubble over a chip - on every tap (with ✓ or ✕), and while a long press holds (without changing anything).
// 9.6.0 (12ו): the one bubble of the explanations - hold = an object makes it an explanation: anchored with an arrow (above, or below when
// there is no room), up to three lines, an optional link or "הבנתי" at the bottom, and it stays until a tap elsewhere (tipDismiss)
// THE TEXT CONTRACT (final-review-fixes, family A): `text` is PLAIN TEXT - a string is always escaped here (a name with "&" or "<" shows
// as written; symbols of TEXT_MS become line icons). Markup is passed only as an explicit { html: '...' } - built HTML whose data parts
// the caller already escaped (the window's own explanation, .sh-why). Never pass built HTML as a string, never escape before calling.
function bubbleHTML(text) { return text && typeof text === 'object' ? icHTML(text.html) : icText(text); }
let _bubbleT = 0, _bubbleRO = null;
// hold = an object makes it an explanation: { link, ok } its buttons; { key, again } the one-time text it is (a hint's or an intro's
// TIPS key) and how to ask for it again (the read rule, hintGone); { fade } ms after which it goes by itself (a one-time hint; a
// touch on it holds the timer); { find } gives the anchor again after a redraw replaced it; { keep } gives the elements the bubble
// must not cover (what its text names)
function showChipBubble(el, text, hold) {
  if (!el) return; let b = document.getElementById('chipBubble');
  if (!b) { b = document.createElement('div'); b.id = 'chipBubble'; b.setAttribute('role', 'status'); document.body.appendChild(b); }
  else if (b.classList.contains('show')) hideChipBubble(); // the one bubble: what it showed is closed first (its read rule, its observer)
  const tip = !!hold && typeof hold === 'object';
  b.className = 'chip-bubble' + (tip ? ' tip' : ''); b._anchor = tip ? el : null;
  if (tip) { b.innerHTML = '<span class="cb-t"></span>' + (hold.link || hold.ok ? `<div class="cb-acts">${hold.link || ''}${hold.ok ? `<button type="button" class="cb-ok" data-act="tip.ok">${hold.ok}</button>` : ''}</div>` : ''); b.firstChild.innerHTML = bubbleHTML(text); } // 10.1.0 (design-1): a rich tooltip - the guide link at the start, "הבנתי" at the end
  else b.innerHTML = bubbleHTML(text);
  b._key = tip && hold.key || null; b._again = tip && hold.again || null; b._find = tip && hold.find || null; b._keep = tip && hold.keep || null; b._at = performance.now(); b._fade = tip && hold.fade || 0; b._end = b._at + b._fade;
  b.classList.add('show'); b._ctx = explainCtx(); bubblePlace(b, el); // 10.15.0: the context it belongs to (the close rule)
  if (tip) bubbleWatch(b, el);
  clearTimeout(_bubbleT); if (!hold || typeof hold === 'number') _bubbleT = setTimeout(hideChipBubble, hold || 1500); // 9.2.0: a number = how long it stays
  else if (b._fade) _bubbleT = setTimeout(hideChipBubble, b._fade); // a one-time hint fades by itself (look/windows-forms.md; the timing rule: hintMs)
}
// final-review-fixes (family F): WHERE an explanation sits. Above its target or below it - the side where it covers less of the part
// of the target that is seen and of what its text names (keep); above when both are free. The part that is seen: inside the visible
// area the reveal mechanism uses (kbArea: under the layer's head, above its pinned bar, the bottom navigation and the keyboard), so
// a target taller than the screen is pointed at where it shows, and the bubble never sits on the pinned bar under it (the draft's
// "אישור הכל"). A name (a long press, a chip) stays over its button.
function explainArea(el) { const H = window.innerHeight; if (el.closest('header.top, #bottomNav, .dr-dock, .sheet-head, .sheet-save-bar, .screen-head')) return { top: 0, bot: H }; // a target that is part of a bar is all in view
  const a = kbArea(el); return { top: Math.max(0, a.top), bot: Math.min(H, a.bot) }; }
function bubblePlace(b, el) {
  const r = el.getBoundingClientRect(), w = b.offsetWidth, h = b.offsetHeight, tip = b.classList.contains('tip');
  const left = Math.max(6, Math.min(window.innerWidth - w - 6, r.left + r.width / 2 - w / 2)); let top, side = 'above';
  if (!tip) top = Math.max(4, r.top - h - 6);
  else { const a = explainArea(el), vt = Math.min(Math.max(r.top, a.top), a.bot), vb = Math.max(vt, Math.min(r.bottom, a.bot)), hi = Math.max(4, a.bot - h - 4);
    const keep = (b._keep ? b._keep() : []).filter(k => k && k.isConnected).map(k => k.getBoundingClientRect());
    const over = (t, x) => Math.max(0, Math.min(left + w, x.right) - Math.max(left, x.left)) * Math.max(0, Math.min(t + h, x.bottom) - Math.max(t, x.top));
    const cost = t => over(t, { left: r.left, right: r.right, top: vt, bottom: vb }) + keep.reduce((n, k) => n + over(t, k), 0);
    const up = Math.max(4, Math.min(hi, vt - h - 10)), down = Math.max(4, Math.min(hi, vb + 10));
    if (cost(down) < cost(up)) side = 'below'; top = side === 'below' ? down : up; }
  b.dataset.side = side; b.style.top = top + 'px'; b.style.left = left + 'px';
  b.style.setProperty('--ax', Math.max(10, Math.min(w - 10, r.left + r.width / 2 - left)) + 'px'); // the arrow points at the anchor
}
// the bubble follows its target: while scrolling (tipDismiss), when the content around the target changes size (one observer on the
// target and the boxes it sits in, alive only while the bubble shows), and after a redraw replaced the target (bubbleFollow, from
// explainSync - found again by `find`, or by its place among the same ⓘ)
function bubbleWatch(b, el) { if (_bubbleRO) _bubbleRO.disconnect(); _bubbleRO = null; if (!window.ResizeObserver) return;
  _bubbleRO = new ResizeObserver(() => { const a = b._anchor; if (a && a.isConnected && b.classList.contains('show')) bubblePlace(b, a); });
  for (let e = el; e && e !== document.documentElement; e = e.parentElement) _bubbleRO.observe(e); }
function bubbleFollow(b) { const a = b._anchor; if (!a || a.isConnected || !b._find) return; const n = b._find && b._find(), r = n && n.isConnected && n.getBoundingClientRect();
  if (r && r.height && r.bottom > 0 && r.top < window.innerHeight) { b._anchor = n; bubblePlace(b, n); bubbleWatch(b, n); } else hideChipBubble(); }
// an explanation closes on a tap anywhere outside it (not on its own ⓘ - the ⓘ toggles it); it follows its anchor while scrolling
function tipDismiss(e) { if (e.type === 'scroll' && _introWait) { const w = _introWait; introShow(w.it, w.tab, w.ctx); }
  const b = document.getElementById('chipBubble'); if (!b || !b.classList.contains('tip') || !b.classList.contains('show')) return;
  if (e.type === 'scroll') { const a = b._anchor, r = a && a.isConnected && a.getBoundingClientRect(); if (r && r.height && r.bottom > 0 && r.top < window.innerHeight) bubblePlace(b, a); else hideChipBubble(); return; }
  if (b.contains(e.target)) { if (b._fade) { clearTimeout(_bubbleT); b._left = Math.max(HINT.read, b._end - performance.now()); } return; } // a touch on a fading hint holds its timer
  if (!(b._anchor && b._anchor.contains(e.target))) hideChipBubble(); }
function tipRelease() { const b = document.getElementById('chipBubble'); if (!b || !b._left || !b.classList.contains('show')) return;
  clearTimeout(_bubbleT); b._end = performance.now() + b._left; _bubbleT = setTimeout(hideChipBubble, b._left); b._left = 0; }
touchAny('down', tipDismiss); touchAny('end', tipRelease);
document.addEventListener('scroll', tipDismiss, true);
// 9.6.0 (12ו): a long press on an icon-only button shows its name (aria-label or title) in the bubble, and that press does not act
// (TOUCH 'press'). Layer chips have their own name (wireLayerChips); a press on a plan card's body is its drag
function lpName(b) { if (!b || b.closest('.lchips')) return ''; const s = b.textContent.replace(/\s+/g, '');
  return (s ? !/[\u0590-\u05FFA-Za-z0-9]/.test(s) : !!b.querySelector('svg, img, .msi')) ? b.getAttribute('aria-label') || b.title || '' : ''; } // 10.1.0 (design-1): a drawn icon (the giraffe) is icon-only too; 11.14.0 (P21): so is any picture with no words - the route list's eye (an svg of its own) had no name
gestureOn('press', 'button', { when: b => !b.disabled && !!lpName(b) && !(b.closest('.tl-card') && !b.closest('.tl-acts, .tl-vis, .tl-tag, .mc-when, .mc-pickbtn')),
  hold: b => showChipBubble(b, lpName(b), true), release: () => { clearTimeout(_bubbleT); _bubbleT = setTimeout(hideChipBubble, 900); } }); // 10.12.0: the one bubble timer - a long press on another button right after keeps its own name
// 9.2.0 (ס5): a one-time bubble that teaches the swipe, by the first card's strip, the first time a trip day shows cards
function visSwipeHint() {
  if (hintSeen('visSwipe') || tripState(activeTripObj()) !== 'during' || document.body.classList.contains('read-only') || layerTop()) return;
  const ctx = explainCtx(); clearTimeout(visSwipeHint.t); visSwipeHint.t = setTimeout(() => { // after the screen settles (a second draw replaces the cards)
    if (hintSeen('visSwipe') || tripState(activeTripObj()) !== 'during' || !['itinerary', 'all'].includes(activeTab) || (screenTop() && screenTop().tab === activeTab) || introPending()) return;
    const vb = () => [...document.querySelectorAll('#main .tl-card > .tl-vis')].find(b => { const r = b.getBoundingClientRect(); return r.height && r.top > 60 && r.bottom < window.innerHeight - 80; });
    hintOnce('visSwipe', vb, ctx); }, 700);
}
// 9.6.0 (12ו, batch 7.6): the plan's drag hint - a bubble on the first card, once (after the plan's own intro)
function planDragHint() { if (hintSeen('hint.drag') || document.body.classList.contains('read-only') || layerTop()) return;
  const ctx = explainCtx(); clearTimeout(planDragHint.t); planDragHint.t = setTimeout(() => { if (activeTab !== 'itinerary' || introPending() || (layerTop() && !layerTop().tab)) return;
    const c = () => [...document.querySelectorAll('#main .tl-card.itin-card:not(.tl-travel)')].find(x => { const r = x.getBoundingClientRect(); return r.height && r.top > 60 && r.bottom < window.innerHeight - 80; });
    hintOnce('hint.drag', c, ctx); }, 1200); }
function hideChipBubble() { const b = document.getElementById('chipBubble'); if (!b) return;
  if (b._key && b.classList.contains('show')) hintGone(b._key, performance.now() - b._at, b._ctx, b._again); // the read rule
  if (_bubbleRO) { _bubbleRO.disconnect(); _bubbleRO = null; }
  b.classList.remove('show'); b._anchor = null; b._ctx = null; b._key = null; b._again = null; b._find = null; b._keep = null; b._fade = 0; b._left = 0; }
act('tip', c => { if (c.ev && c.el.closest('summary')) c.ev.preventDefault(); /* 10.7.1: an ⓘ in a folded row's name explains, it does not fold */ if (c.v === 'here') { const w = document.querySelector('#sheet > .sh-why'); if (w) showChipBubble(c.el, { html: w.innerHTML }, {}); /* .sh-why is built HTML - the bubble's markup form */ return 'quiet'; } showTip(c.v, c.el); return 'quiet'; }); // 10.4.0: 'here' = the window's own explanation (.sh-why)
act('tip.ok', () => { hideChipBubble(); hintGone(); return 'quiet'; }); // "הבנתי": read
act('tip.more', c => { hideChipBubble(); hintGone(); GUIDE_Q = ''; GUIDE_AT = c.v; openMenuScreen('guide'); const ch = document.querySelector(`#main [data-gch="${c.v}"]`); reveal(ch, false, { align: 'start', instant: true }); GUIDE_AT = null; return 'quiet'; });
act('tip.svc', c => { hideChipBubble(); openSvcExplain(c.v); return 'quiet'; });

// 4.3.0: layer chips - icon and count, colored like the layer's pins when on, grey when off. They are also the map legend.
// Up to two rows; "＋N" opens one more row each tap and "▲" folds back. A chosen chip is never inside "＋N" unless the chosen ones alone do not fit (fitChipRows).
const chipRows = {};
function layerChipsHTML(blockId, groups, sel, countOf, lead) {
  const esc = escH;
  return `<div class="lchips" id="${blockId}" data-chipset="${/^(draftLayers|fwDLayers)$/.test(blockId) ? 'draft' : 'points'}" role="group" aria-label="שכבות">${lead || ''}<button type="button" class="lchip lchip-all" data-act="chip.layer" data-lc="" data-on="${!sel.size}" aria-pressed="${!sel.size}">הכל</button>`
    + groups.map(g => { const on = selOn(sel, g.id), c = countOf(g), n = c && typeof c === 'object' ? c.found : c, of = c && typeof c === 'object' ? c.total : null; // 10.15.0 (design-review Q3): a collection's chip counts "found/total"
      return `<button type="button" class="lchip" data-act="chip.layer" data-lc="${esc(g.id)}" data-on="${on}" data-empty="${!(of != null ? of : n)}" aria-pressed="${on}" aria-label="${esc(g.label)} ${of != null ? n + ' מתוך ' + of : n}" style="--lc:${esc(g.color)}"><span class="lci">${typeIcon(g.ik, { size: 16 })}</span><span class="lcn">${n}${of != null ? `<span class="lcn-of">/${of}</span>` : ''}</span></button>`; }).join('') // 10.3.0 (design-3): the layer's icon in a small tinted circle, its count
    + `<button type="button" class="lchip lchip-more" data-act="chip.more" data-lcmore hidden></button></div>`;
}
function fitChipRows(el) {
  if (!el || !el.isConnected) return;
  const rows = chipRows[el.id] || 1, chips = [...el.querySelectorAll('.lchip:not(.lchip-more)')], more = el.querySelector('[data-lcmore]');
  chips.forEach(c => c.classList.remove('lc-hidden')); more.hidden = true; more.dataset.on = 'false';
  if (!el.offsetParent) return;
  const tops = [...new Set(chips.map(c => c.offsetTop))].sort((a, b) => a - b);
  if (tops.length <= rows) { if (rows > 1) { more.hidden = false; more.innerHTML = msi('expand_less', { size: 18 }); more.dataset.lcmore = 'less'; more.setAttribute('aria-label', 'פחות שורות'); if (more.offsetTop > tops[tops.length - 1]) { /* fits on its own row */ } } return; }
  // final-review Q1: a chosen chip is never hidden. While the row does not fit, the last unchosen chip moves into "＋N" (so a chosen chip
  // further on takes its place; the order of the others is kept). Only when every chip left is chosen and they still do not fit, the last
  // chosen ones move in too, and "＋N" takes the chosen look with the number of chosen chips inside it. With "הכל" on nothing is "chosen".
  const limit = tops[rows - 1], hidden = [], filtered = !chips.some(c => c.classList.contains('lchip-all') && c.dataset.on === 'true'), chosen = c => filtered && c.dataset.on === 'true';
  more.hidden = false; more.dataset.lcmore = 'more';
  for (let guard = 0; guard <= chips.length; guard++) {
    const inside = hidden.filter(chosen).length;
    more.textContent = '＋' + (inside || hidden.length); more.dataset.on = String(!!inside); more.setAttribute('aria-label', inside ? `עוד שורה, ${inside} נבחרו בה` : 'עוד שורה');
    const vis = chips.filter(c => !c.classList.contains('lc-hidden'));
    if (more.offsetTop <= limit && !vis.some(c => c.offsetTop > limit)) break;
    const free = vis.filter(c => !c.classList.contains('lchip-all')), last = free.filter(c => !chosen(c)).pop() || free.pop(); if (!last) break;
    last.classList.add('lc-hidden'); hidden.push(last);
  }
}
window.addEventListener('resize', () => { document.querySelectorAll('.lchips').forEach(fitChipRows); document.querySelectorAll('.src-fit').forEach(fitSrcRow); });
// 4.37.0: a row of source chips (destinations of a trip, sources of a draft) never scrolls sideways. It shows full names
// when they fit the real width, short names when only those fit, and otherwise one picker button that opens all of them.
function shortSrcName(name) { // 4.38.1: a leading icon ("📍 ארגנטינה (דמו)") is kept aside, so the short name is never the icon alone
  const m = String(name || '').match(/^([^\p{L}\p{N}]*)([\s\S]*)$/u), pre = m ? m[1] : '', rest = m ? m[2] : String(name || '');
  let n = rest.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
  if (n.length > 9) n = n.split(/\s+/)[0];
  return n ? pre + n : String(name || '');
}
function srcChipInner(icon, name) { const e = escH; const sh = shortSrcName(name); return `<span class="sf-full">${icon ? icon + ' ' : ''}${e(name)}</span><span class="sf-short">${icon ? icon + ' ' : ''}${e(sh)}</span><span class="sf-tiny">${icon ? icon + ' ' : ''}${e(sh.replace(/^[^\p{L}\p{N}]+/u, '') || sh)}</span>`; }
function srcPickLabel(row) {
  const all = [...row.querySelectorAll('[data-sf]')], allBtn = all.find(b => b.dataset.sf === 'all'), items = all.filter(b => b.dataset.sf !== 'all');
  const on = items.filter(b => b.dataset.active === 'true'), nm = b => (b.querySelector('.sf-full') || b).textContent.trim();
  if (allBtn && allBtn.dataset.active === 'true') return 'הכל ▾';
  if (on.length === 1) return nm(on[0]) + ' ▾';
  if (!on.length) return 'בחירה ▾';
  return `${on.length} מתוך ${items.length} ▾`;
}
function fitSrcRow(row) {
  if (!row || !row.isConnected || !row.querySelector('[data-sf]')) return;
  row.classList.remove('sf-s', 'sf-t', 'sf-p');
  const pick = row.querySelector('.sf-pick'); if (pick) pick.textContent = srcPickLabel(row);
  if (!row.clientWidth) return;
  const over = () => row.scrollWidth > row.clientWidth + 1;
  if (!over()) return;
  row.classList.add('sf-s'); if (!over()) return;
  row.classList.remove('sf-s'); row.classList.add('sf-t'); if (!over()) return; // 4.39.1
  row.classList.remove('sf-t'); row.classList.add('sf-p');
}
// the picker: the very same chips, wrapped in a dialog. A tap acts on the chip in the row (same rules), then the dialog redraws
function openSrcPicker(rowSel, title, single) { const btns = () => { const r = document.querySelector(rowSel); return r ? [...r.querySelectorAll('[data-sf]')] : []; };
  if (!btns().length) return; // the row's chips do the work; the window shows them all
  // 9.4.0: one destination (the layers tab) - a tap picks and closes; several - a filter (picker-rule): every tap applies at once, every close keeps, the title counts
  const cnt = () => { const b = btns().filter(x => x.dataset.sf !== 'all'), n = b.filter(x => x.dataset.active === 'true').length; return n && n < b.length ? `${SEP}${n} מתוך ${b.length}` : ''; };
  openFmChoice({ key: 'openSrcPicker', title: single ? title : () => title + cnt(), closeId: 'sfClose', as: 'chips', multi: single ? null : 'filter',
    options: () => btns().map((b, i) => ({ v: i, html: (b.querySelector('.sf-full') || b).innerHTML, on: b.dataset.active === 'true' })) }, v => { const b = btns()[+v]; if (b) b.click(); });
  layerTop().rowSel = rowSel;
}
// 5.12.0: the country of a destination - a long list with search (full screen over the editor); the currency's country first
// 7.2.0: the country and the clock of a destination are lists of the one choice window (openFmChoice), not windows of their own
function openCountryPicker(cur, sug, onPick) { const all = countryList(), row = (c, g) => ({ v: c.cc, group: g, text: c.n + ' ' + c.cc, html: withFlag(flagOfCountry(c.cc), _escH(c.n)) });
  const top = [cur && all.find(c => c.cc === cur), sug && sug !== cur && all.find(c => c.cc === sug)].filter(Boolean);
  openFmChoice({ title: 'מדינה', hint: 'הדגל של היעד בא מהמדינה. בלי מדינה - מהמטבע (חוץ מיורו).', search: true, searchHint: 'חיפוש מדינה', value: cur,
    options: [...top.map(c => row(c, c.cc === cur ? 'נבחרה' : 'לפי המטבע')), ...(cur ? [{ v: '', group: 'בלי מדינה', text: 'בלי מדינה', html: 'בלי מדינה (הדגל לפי המטבע)' }] : []), ...all.map(c => row(c, 'כל המדינות'))] }, onPick); }
// 7.0.0 (ז11): a destination's clock, by hand: the zones of its country with the time now in each, and all zones (search)
function openZonePicker(country, cur, onPick) { const mine = tmZonesOf(country).map(x => x.z), all = [...new Set(TM_ZONES.map(x => x.z))].filter(tmZoneOk);
  const row = (z, g) => ({ v: z, group: g, text: z + ' ' + tmZoneName(z) + ' ' + tmCity(z), html: `<span class="fm-ch-t">${_escH(tmZoneName(z))}<small dir="ltr">${_escH(tmCity(z))}</small></span><span class="fm-ch-end"><bdi>${tmWall(z).hm}</bdi></span>` }); // 10.9.0 (design-forms, gap 39): the city as a supporting line, the time at the end
  openFmChoice({ title: '🕐 השעון של היעד', hint: 'השעות בטיול נקראות בשעון של היעד. בדרך כלל הוא נקבע לבד מהמדינה וממרכז המפה.', search: true, searchHint: 'חיפוש אזור או עיר', value: cur,
    options: [...mine.map(z => row(z, 'במדינה')), ...all.filter(z => !mine.includes(z)).map(z => row(z, 'כל האזורים'))] }, onPick); }
// opts: { ids, getSel, setSel(newSet), labelOf(id), rerender() }
// 6.1.0: the chip sets (which selection a row of layer chips changes); a tap is the action chip.layer, a long press (a gesture)
// only shows the name
const CHIPSETS = {
  points: { ids: () => chipGroups().map(g => g.id), getSel: () => FP.layers, setSel: s => { FP.layers = s; FP.styles = new Set(); },
    labelOf: id => { const g = groupOf(id); return g ? (layerDef(g.layers[0]).name && g.layers.length === 1 ? layerDef(g.layers[0]).name : g.label) : String(id); },
    after: el => filterChanged('points', el.id === 'layerChips') },
  draft: { ids: () => draftLayerChips(DRAFT).chips.map(c => c.id), getSel: () => FILTER.draft.layers, setSel: s => { FILTER.draft.layers = s; },
    labelOf: id => { const c = draftLayerChips(DRAFT).chips.find(x => x.id === id); return c ? c.name || c.label : String(id); }, after: () => filterChanged('draft') },
};
function wireLayerChips(el) { if (el) fitChipRows(el); }
gestureOn('press', '.lchips [data-lc]', { when: c => !!c.dataset.lc, release: () => setTimeout(hideChipBubble, 700), // a long press: the chip's name, nothing changes
  hold: c => { const set = CHIPSETS[c.closest('.lchips').dataset.chipset] || CHIPSETS.points; showChipBubble(c, set.labelOf(c.dataset.lc), true); } });
act('chip.more', c => { const el = c.el.closest('.lchips'); chipRows[el.id] = c.el.dataset.lcmore === 'less' ? 1 : (chipRows[el.id] || 1) + 1; fitChipRows(el); return 'quiet'; });
act('chip.layer', c => { const el = c.el.closest('.lchips'), set = CHIPSETS[el.dataset.chipset] || CHIPSETS.points;
  const raw = c.el.dataset.lc, id = raw === '' ? null : (isNaN(raw) ? raw : Number(raw)), before = set.getSel(), elId = el.id;
  const next = id == null ? selAllTap(before) : selToggle(before, id, set.ids());
  set.setSel(next); set.after(el);
  const on = id == null ? !next.size : selOn(next, id), label = id == null ? (on ? 'כל השכבות' : 'כל השכבות כבויות') : set.labelOf(id);
  requestAnimationFrame(() => { const live = document.getElementById(elId); showChipBubble(live && live.querySelector(`[data-lc="${CSS.escape(String(raw))}"]`), (on ? '✓ ' : '✕ ') + label); });
  return 'quiet'; });
// 4.3.0: chip order - lodging first, then the other base layers in a fixed order, then the unique layers by number of places.
// A manual order per trip (🎨 שכבות) wins; layers it doesn't know follow in the automatic order.
const BASE_ORDER = Object.keys(BASE_TYPES);
function chipKeyIn(order, g) { const keys = [g.id, g.type ? 'type:' + g.type : null, ...(g.layers || [])].filter(x => x != null); for (const k of keys) { const i = order.indexOf(k); if (i >= 0) return i; } return -1; }
function chipGroups() {
  const gs = POINTS_GROUP.filter(g => g.id !== 'all'), cnt = {};
  gs.forEach(g => { cnt[g.id] = POINTS.filter(p => g.layers.includes(p.layer) && !isHiddenPoint(p)).length; });
  const auto = (a, b) => { const ra = a.type && BASE_TYPES[a.type] ? BASE_ORDER.indexOf(a.type) : 99, rb = b.type && BASE_TYPES[b.type] ? BASE_ORDER.indexOf(b.type) : 99; return (ra - rb) || (ra === 99 ? cnt[b.id] - cnt[a.id] : 0); };
  const order = ((STATE.chipOrder || {})[STATE.activeTrip]) || [];
  return gs.map((g, i) => [g, i]).sort((A, B) => { const a = A[0], b = B[0], ia = chipKeyIn(order, a), ib = chipKeyIn(order, b);
    if (ia >= 0 && ib >= 0) return ia - ib; if (ia >= 0) return -1; if (ib >= 0) return 1; return auto(a, b) || (A[1] - B[1]); }).map(x => x[0]);
}
function setChipOrder(ids, msg) {
  const before = STATE.chipOrder || {}, cur = before[STATE.activeTrip] || [];
  const next = ids === null ? null : ids.concat(cur.filter(k => !ids.includes(k)));
  const co = { ...before }; if (next) co[STATE.activeTrip] = next; else delete co[STATE.activeTrip];
  STATE.chipOrder = co; persist(); 
  showUndoToast(msg);
}
// the layer choice shared by 📍 נקודות and 🗺️ מפה (empty = all, {NONE} = none)
function layerSelIds() { return selNone(FP.layers) ? new Set() : (FP.layers.size ? new Set([].concat(...[...FP.layers].map(tabLayerIds))) : null); }
function layerPass(p) { const ids = layerSelIds(); return !ids || ids.has(p.layer); }


// 4.3.0: the card of a pin floats over the bottom of the map, visible at once. Tapping the map (or ✕) closes it; "פרטים ›"
// opens the full card. The chosen pin grows and the map moves so it isn't hidden under the card.
const MAPS = {}; // containerId -> { map, markers: Map(id -> marker), selId }
function regMap(containerId, map) { const old = MAPS[containerId]; if (old && old.map !== map) mapDispose(old.map); MAPS[containerId] = { map, markers: new Map(), selId: null }; map.on('click', e => { if (measOnMapClick(containerId, e)) return; fanClose(containerId); closeFloatCard(containerId); }); fsDecorate(containerId); if (containerId !== 'memMap') discAttach(containerId, map, containerId === 'draftMap' ? 'draft' : 'main'); /* 5.9.0: no 📚 on the memory map (as before) */ if (MEAS && MEAS.id === containerId) setTimeout(() => { if (MEAS && MEAS.id === containerId) measDraw(); }, 0); }


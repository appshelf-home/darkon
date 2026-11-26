// ================= 11.43.0: GENERAL INFO THROUGH CLAUDE (task info-complete) =================
// decisions 2026-11-20 · General info for any destination that lacks it, through Claude (Q1-Q3); 2026-11-20 · "מזג אוויר ולבוש": an old
// text with no seasons is completed (Q1). Mechanism map: `darkon/spec/general-info-through-claude.md`.
// The ten fixed sections are INFO_FIXED ([icon, title], built by tests/kit.py from the kit's vocabulary.md - validate.py reads the same
// lines). A destination lacks a section when its info has none with that data-icon - in an older file with no icons, none whose title
// carries the section's words (INFO_OLD_TITLE, the same table in validate.py) - and it is not marked "not relevant". A weather section
// with no season paragraphs (div[data-months]) is one to complete too, under its own title ("מזג אוויר לפי עונות"); so is a language section
// with no survival dictionary (div[data-words]), under "מילון הישרדות" (survival-words, Q3).
// kit-install (5; decisions 2026-11-25 · "Not relevant" dropped): there are no "not relevant" marks any more - every fixed section the
// info lacks is missing, and the AI writes each (one short line where there is nothing to say); the old marks are dropped at the door.
const INFO_OLD_TITLE = { task_alt: /לפני ש/, directions_subway: /ניידות|תחבורה/, payments: /כסף|מטבע/, signal_cellular_alt: /תקשורת|סים|eSIM|אינטרנט/i,
  local_hospital: /בטיחות|חירום|בריאות/, thermostat: /מזג/, power: /חשמל/, translate: /שפה/, israel_flag: /נציגות|שגרירות|קונסוליה/, tips_and_updates: /טיפ/ };
const INFO_WX_SEASONS = 'מזג אוויר לפי עונות', INFO_WORDS_TITLE = 'מילון הישרדות', INFO_ASK = 'להשלים את המידע הכללי החסר';
const INFO_FIXED_ICONS = new Set(INFO_FIXED.map(x => x[0]));
// the sections a destination's info has, by icon (the weather only with season paragraphs, the language only with its dictionary)
const _infoHave = new Map();
function infoSectionsOf(raw) { raw = String(raw || ''); if (_infoHave.has(raw)) return _infoHave.get(raw); if (_infoHave.size > 40) _infoHave.clear();
  const have = new Set(), f = htmlFrag(cleanInfo(raw, { out: true })), wx = wxSecOf(f);
  f.querySelectorAll('.accordion-item').forEach(it => { const hd = it.querySelector(':scope > .accordion-header'); if (!hd) return;
    let ic = hd.getAttribute('data-icon') || ''; if (!INFO_FIXED_ICONS.has(ic)) { ic = ''; const t = hd.textContent; for (const k in INFO_OLD_TITLE) if (INFO_OLD_TITLE[k].test(t)) { ic = k; break; } }
    if (it === wx) ic = 'thermostat';
    if (ic === 'thermostat' && !it.querySelector('div[data-months]')) { have.add('thermostat:old'); return; }
    if (ic === 'translate' && !it.querySelector('div[data-words]')) { have.add('translate:old'); return; }
    if (ic) have.add(ic); });
  _infoHave.set(raw, have); return have; }
// the missing sections of a destination: [{ icon, title, reason: 'missing' | 'no-seasons' | 'no-words' }] in the fixed order
function infoMissingOf(d) { if (!d || !d.id || d.builtin) return []; const have = infoSectionsOf(d.info);
  return INFO_FIXED.filter(([ic]) => !have.has(ic)).map(([icon, title]) => icon === 'thermostat' && have.has('thermostat:old') ? { icon, title: INFO_WX_SEASONS, reason: 'no-seasons' }
    : icon === 'translate' && have.has('translate:old') ? { icon, title: INFO_WORDS_TITLE, reason: 'no-words' } : { icon, title, reason: 'missing' }); }
// every send for an update (goal improve) carries it next to unlocated: the missing sections of each destination in the file
function infoMissingOut(ids) { return [].concat(...ids.map(id => infoMissingOf(DESTS[id]).map(x => ({ dest: id, ...x })))); }
// ---- the row on the General screen, under the destination's info: Claude's colors, only while something is missing (no ⋮ - kit-install 5) ----
function infoRowHTML(d) { const miss = infoMissingOf(d); if (!miss.length) return '';
  const none = !infoSectionsOf(d.info).size, ts = miss.map(x => x.title), shown = ts.length > 4 ? ts.slice(0, 3) : ts;
  const title = none ? 'אין עדיין מידע כללי ליעד' : `חסר מידע: ${shown.map(t => escH(t)).join(', ')}${ts.length > shown.length ? ` ועוד ${ts.length - shown.length}` : ''}`;
  return `<div class="info-miss" data-ref="dest:${escH(d.id)}"><button type="button" class="prop-row info-miss-go t-wrap" id="infoMissRow" data-act="infoMiss.go">${claudeMark({ size: 24 })}<span class="prop-row-t"><b>${title}</b><small>להשלים עם ${AI}</small></span></button></div>`; }
// the tap opens the existing "לשיפור" window of that destination, with the request written
act('infoMiss.go', c => { const d = DESTS[c.ref.id]; if (!d) return; const ts = infoMissingOf(d).map(x => x.title);
  viaGroup('management', 'openDestFile', d.id, 'improve', { request: `${INFO_ASK}${ts.length ? ': ' + ts.join(', ') : ''}` }); return 'quiet'; });
// ================= survival-words: THE SURVIVAL DICTIONARY (decisions 2026-11-23 · A survival dictionary in the language section) =================
// Claude writes the language section's body as <div data-words="<lang code>"> - an <h3> with the language's Hebrew name, then one
// <p data-word="1".."10" | "more"> per row holding <b> the meaning, <span> how it is said, <bdi> how it is written (vocabulary.md "Survival
// dictionary"). infoHtml draws it here (wordsDraw): each row the meaning in bold, under it the transliteration beside the local script in
// its own direction; the ten fixed rows (their meaning from INFO_WORDS, the one list) then "עוד מילים ליעד" over the additions. A tap on
// a row opens "להראות" (openWordsShow): a full layer of the stack with the local script as large as fits. A section with no such markup
// is drawn as it is (and counts as one to complete - infoSectionsOf).
const WORDS_LANG = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/, WORDS_MORE = 'עוד מילים ליעד';
function wordsOf(box) { const lang = (box.getAttribute('data-words') || '').trim(), h = box.querySelector(':scope > h3, :scope > h4');
  const rows = [...box.querySelectorAll(':scope > p[data-word]')].map(p => { const n = (p.getAttribute('data-word') || '').trim(), i = /^\d+$/.test(n) ? +n : 0, fixed = i >= 1 && i <= INFO_WORDS.length;
    const t = s => { const e = p.querySelector(':scope > ' + s); return e ? e.textContent.replace(/\s+/g, ' ').trim() : ''; };
    return { n: fixed ? i : 99, fixed, he: fixed ? INFO_WORDS[i - 1] : t('b'), say: t('span'), loc: t('bdi') }; }).filter(r => r.loc || r.say);
  rows.sort((a, b) => a.n - b.n); // the fixed meanings in their order, the additions after them as written (a stable sort)
  return { lang: WORDS_LANG.test(lang) ? lang : '', name: h ? h.textContent.replace(/\s+/g, ' ').trim() : '', rows }; }
function wordsRowHTML(r, lang) { const esc = escH;
  return `<button type="button" class="sw-row" data-act="words.show"><b class="sw-he">${esc(r.he)}</b><span class="sw-sub">${r.say ? `<span class="sw-say">${esc(r.say)}</span>` : ''}${r.loc ? `<bdi class="sw-loc"${lang ? ` lang="${esc(lang)}"` : ''}>${esc(r.loc)}</bdi>` : ''}</span></button>`; }
function wordsHTML(w) { const fx = w.rows.filter(r => r.fixed), more = w.rows.filter(r => !r.fixed), row = r => wordsRowHTML(r, w.lang);
  return `<div class="sw-dict">${w.name ? `<p class="sw-lang">${msi('translate', { size: 18 })} <b>${escH(w.name)}</b></p>` : ''}<p class="sh-hint sw-hint">נגיעה במילה מראה אותה בגדול</p>`
    + `${fx.map(row).join('')}${more.length ? `<p class="sw-more">${WORDS_MORE}</p>${more.map(row).join('')}` : ''}</div>`; }
function wordsDraw(f) { f.querySelectorAll('div[data-words]').forEach(box => { const w = wordsOf(box); if (!w.rows.length) return;
  const t = document.createElement('template'); t.innerHTML = wordsHTML(w); box.replaceWith(t.content); }); }
// "להראות": the row's own words, read from the tapped row (nothing else is needed - it works offline); back returns to the screen as left
function openWordsShow(btn) { const q = s => { const e = btn.querySelector(s); return e ? e.textContent : ''; }, loc = btn.querySelector('.sw-loc'), lang = loc && loc.getAttribute('lang');
  const el = document.createElement('div'); el.className = 'screen-layer words-show'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'להראות');
  el.innerHTML = screenHeadHTML({ act: 'layer.back', title: 'להראות' })
    + `<div class="ws-body"><bdi class="ws-loc"${lang ? ` lang="${escH(lang)}"` : ''}>${escH(q('.sw-loc') || q('.sw-say'))}</bdi><p class="ws-he">${escH(q('.sw-he'))}</p>${q('.sw-loc') && q('.sw-say') ? `<p class="ws-say">${escH(q('.sw-say'))}</p>` : ''}</div>`;
  document.body.appendChild(el);
  layerPush('wordsShow', 'full', fp => { el.remove(); layerDone('wordsShow', fp); });
  layerMotion('side', 0, el); wordsFit(el.querySelector('.ws-loc')); }
// the local script as large as the screen allows: from a fifth of the width down, until no line is wider than the screen and it fits
// in about half its height; at the smallest size it wraps anywhere, so nothing is ever cut
function wordsFit(t) { if (!t) return; const box = t.parentElement, W = box.clientWidth, H = Math.max(120, box.clientHeight * 0.55);
  let fs = Math.max(32, Math.min(W / 3, 180)); t.style.fontSize = fs + 'px';
  while (fs > 24 && (t.scrollWidth > W + 1 || t.offsetHeight > H)) { fs = Math.floor(fs * 0.9); t.style.fontSize = fs + 'px'; }
  if (t.scrollWidth > W + 1) t.classList.add('ws-wrap'); }
act('words.show', c => { openWordsShow(c.el); return 'quiet'; });

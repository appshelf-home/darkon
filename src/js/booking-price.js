// ================= BOOKING AND PRICE (11.42.0, task booking-price; decisions/2026-11-20-booking-price-fields.md Q1-Q4) =================
// Mechanism map: `darkon/spec/booking-and-price.md`. A place's booking and every price are structured fields, one form for the app,
// the kit and validate.py:
//   a place's `reservation` = { need: unknown | none | rec | must, note } - the choice alone drives "הזמנות נדרשות" and the card's mark
//   (reservationClass); the note "איך ומתי" only explains;
//   a place's `price` and a hotel's `price` = { kind: unknown | free | level | amount, level: 1-4, amount, currency, per, checkedAt, note }
//   - per for a place: person / child / night / booking, for a hotel: night / stay (the other derived from the nights); a place's amount
//   always carries checkedAt (month.year), set by Claude and updated when the amount is edited by hand; a hotel's amount is what was paid.
// Stored compact: nothing to say (unknown with no note) is '' (as a field never filled), and only the keys of the chosen kind are kept.
// The closed values (need, kind, level, per, currency) come from the kit's one file (claude/scripts/closed_lists.json → CLOSED_LISTS);
// a value outside its set is dropped at the one route in and counted (bpFileClean, called by fileClean). Old free text (before 11.42.0)
// is converted by Q4 - silently, never counted, never a number pulled out of text: stored data once (FILE_RULES 11.42.0) and every
// incoming file. Readers take either form (bpResv / bpPrice), so nothing ever shows "[object Object]" or breaks on an old string.
// Every price shown goes through fmtPrice (js/time.js, beside fmtKm / fmtM).
const RESV_NEED = { unknown: 'לא ידוע', none: 'לא צריך', rec: 'מומלץ', must: 'חובה' }; // the editor's chips, in this order
const RESV_LONG = { unknown: '', none: 'לא צריך להזמין', rec: 'מומלץ להזמין', must: 'חובה להזמין' }; // the window's and the summary's words
const PRICE_KIND = { unknown: 'לא ידוע', free: 'חינם', level: 'רמת מחיר', amount: 'סכום' };
const PRICE_LEVEL = ['', 'זול', 'בינוני', 'יקר', 'יקר מאוד']; // 1-4, shown as $-$$$$ with the word in every destination (Q4 addition 2)
const PRICE_PER = { person: 'לאדם', child: 'לילד', night: 'ללילה', booking: 'לכל ההזמנה' }; // a place's amount is for
const HOTEL_PER = { night: 'ללילה', stay: 'כל השהות' }; // a hotel's amount is for
const HOTEL_PER_TX = { night: 'ללילה', stay: 'לכל השהות' }; // and in a line of text
const BP_SETS = { need: 'resvNeed', kind: 'priceKind', level: 'priceLevel', per: 'placePricePer', hper: 'hotelPricePer', currency: 'currencies' };
const bpIn = (set, v) => v != null && v !== '' && CLOSED_LISTS[BP_SETS[set]].has(String(v));
const BP_MONTH = /^(0?[1-9]|1[0-2])\.(20\d\d)$/; // checkedAt: month.year ("11.2026")
function bpMonthNow() { const [y, m] = todayStr().split('-'); return Number(m) + '.' + y; } // today's month from the trip's date string - no Date outside the TIME block (t800)
const bpStr = v => typeof v === 'string' ? v.trim() : '';
const bpAmt = v => { const n = typeof v === 'number' ? v : typeof v === 'string' && /^\d+(\.\d+)?$/.test(v.trim()) ? Number(v) : NaN; return isFinite(n) && n > 0 && n < 1e9 ? Math.round(n * 100) / 100 : null; };
// ---- the conversion of old free text (Q4) ----
const BP_ONLY = new Set(['חובה', 'מומלץ', 'לא נדרש', 'לא צריך', 'חובה להזמין', 'מומלץ להזמין', 'לא צריך להזמין', 'לא נדרשת', 'הזמנה לא נדרשת', 'לא נדרשת הזמנה', 'חובה להזמין מראש', 'מומלץ להזמין מראש']);
const bpBare = t => t.replace(/[\s.,!:;"'״׳()\-–]+/g, ' ').trim();
function resvConv(t) { t = bpStr(t); if (!t) return '';
  const need = t.includes('חובה') ? 'must' : t.includes('מומלץ') ? 'rec' : /לא נדרש|לא צריך/.test(t) ? 'none' : 'unknown'; // as reservationClass read the text until 11.41
  return resvPack(need, BP_ONLY.has(bpBare(t)) && need !== 'unknown' ? '' : t); }
function priceConv(t) { t = bpStr(t); if (!t) return '';
  if (/^\${1,4}$/.test(t)) return { kind: 'level', level: t.length };
  const lv = bpLevelNote(t); if (lv) return lv;
  if (/^(חינם|free)$/i.test(bpBare(t))) return { kind: 'free' };
  return { kind: 'unknown', note: t }; } // never a number pulled out of text
// 11.44.1 (price-level-note; decisions/2026-11-22-review-booking-price-info-complete.md Q1, changing Q4 for this case only): exactly
// $-$$$$, optional spaces, then one parenthesised part and nothing else ("$$ (נגיש)") → that level, the parenthesised text its note.
// 11.45.0 (kit-fixes item 11; decisions/2026-11-22-review-price-level-note.md Q2-Q3): a range of two adjacent levels - $-$$$$, a hyphen
// or an en dash, the next level, optional spaces, optional one parenthesised part ("$–$$ (זול עד נגיש)", "$$-$$$") → its upper level
// (a price level is always one of four); and for both, the parenthesised text is the note only when it holds more than price words
// (BP_PRICE_WORDS and the connectors: "$$ (נגיש)", "$$$–$$$$ (יקר / יוקרתי)" give no note; "בינוני, עד כ-30 יורו למנה" stays whole).
// A range of levels that are not adjacent, text after the parentheses, two of them, empty ones or a bare word match nothing and stay a
// note; never a number pulled out of text.
const BP_LEVEL_NOTE = /^(\${1,4})\s*(?:[-–]\s*(\${1,4})\s*)?(?:\(([^()]*\S[^()]*)\))?$/;
const BP_PRICE_WORDS = new Set(['זול', 'זולה', 'זולים', 'זולות', 'נגיש', 'נגישה', 'נגישים', 'נגישות', 'בינוני', 'בינונית', 'בינוניים', 'בינוניות',
  'יקר', 'יקרה', 'יקרים', 'יקרות', 'יוקרתי', 'יוקרתית', 'יוקרתיים', 'יוקרתיות', 'מאוד', 'מאד', 'עד']); // the closed list; עד is a connector
// 11.46.0 (phone-round-4c-fixes P9; decisions/2026-11-22-review-kit-fixes.md Q3): a listed word with "ו" joined at its start ("ונגיש",
// "ויקר") is a price word too - "$$ (זול ונגיש)" gives no note; "ו" counts only joined to a listed word ("זול ונוח" stays whole)
const bpPriceWord = x => BP_PRICE_WORDS.has(x) || (x.length > 1 && x[0] === 'ו' && BP_PRICE_WORDS.has(x.slice(1)));
const bpPriceWordsOnly = t => { const w = String(t || '').split(/[\s\-–\/,!]+/).filter(Boolean); return !!w.length && w.every(bpPriceWord); };
function bpLevelNote(t) { const m = BP_LEVEL_NOTE.exec(bpStr(t)); if (!m) return null; const lo = m[1].length, hi = m[2] ? m[2].length : 0;
  if (hi && hi !== lo + 1) return null; if (!hi && m[3] == null) return null; // a bare $-$$$$ is the plain level (priceConv); two levels apart stay a note
  const level = hi || lo, note = (m[3] || '').trim();
  return { kind: 'level', level, ...(!note || bpPriceWordsOnly(note) ? {} : { note }) }; }
// a structure that holds only { kind: 'unknown', note } whose note is such a level (11.42.0 and 11.43.0 converted it so)
const bpLevelNoteOld = v => v && typeof v === 'object' && !Array.isArray(v) && (v.kind == null || v.kind === 'unknown') && Object.keys(v).every(k => k === 'kind' || k === 'note') && !!bpLevelNote(v.note);
function hotelPriceConv(t) { t = bpStr(t); return t ? { kind: 'unknown', note: t } : ''; } // a hotel's old text → its note, the amount empty
// ---- the stored forms ----
function resvPack(need, note) { need = bpIn('need', need) ? need : 'unknown'; note = bpStr(note); return need === 'unknown' && !note ? '' : { need, ...(note ? { note } : {}) }; }
function pricePack(o, hotel) { o = o || {}; const kind = hotel ? (bpAmt(o.amount) ? 'amount' : 'unknown') : bpIn('kind', o.kind) ? o.kind : 'unknown', note = bpStr(o.note), out = { kind };
  if (kind === 'level') { if (!bpIn('level', o.level)) return note ? { kind: 'unknown', note } : ''; out.level = Number(o.level); }
  if (kind === 'amount') { const a = bpAmt(o.amount); if (!a) return note ? { kind: 'unknown', note } : '';
    out.amount = a; if (bpIn('currency', o.currency)) out.currency = String(o.currency); if (bpIn(hotel ? 'hper' : 'per', o.per)) out.per = o.per;
    if (!hotel) out.checkedAt = BP_MONTH.test(bpStr(o.checkedAt)) ? bpStr(o.checkedAt) : bpMonthNow(); }
  if (note) out.note = note;
  return kind === 'unknown' && !note ? '' : out; }
// ---- the readers: either form, always the full shape ----
function bpResv(v) { if (typeof v === 'string') v = resvConv(v); const o = v && typeof v === 'object' ? v : {};
  return { need: bpIn('need', o.need) ? o.need : 'unknown', note: bpStr(o.note) }; }
function bpPrice(v, hotel) { if (typeof v === 'string') v = hotel ? hotelPriceConv(v) : priceConv(v); const o = v && typeof v === 'object' ? v : {};
  const p = pricePack(o, hotel) || {}; return { kind: p.kind || 'unknown', level: p.level || 0, amount: p.amount || 0, currency: p.currency || '', per: p.per || '', checkedAt: p.checkedAt || '', note: p.note || '' }; }
// the "הזמנות נדרשות" screen, the card's mark, today's card: the choice only (Q2)
function reservationClass(r) { const n = bpResv(r).need; return n === 'must' ? 'resv-must' : n === 'rec' ? 'resv-rec' : 'resv-no'; }
// ---- display ----
function bpCurSym(code) { if (!code) return ''; try { const p = new Intl.NumberFormat('en', { style: 'currency', currency: code, currencyDisplay: 'narrowSymbol' }).formatToParts(1).find(x => x.type === 'currency'); return p ? p.value : code; } catch (e) { return code; } }
function bpCurText(code) { const n = curNameHe(code); return n ? `${n} (${code})` : code; }
// a place's booking in words: "חובה להזמין · שבוע מראש באתר הרשמי" (o.need: the choice alone)
function resvText(v, o) { const r = bpResv(v); return [RESV_LONG[r.need], !(o && o.need) && r.note].filter(Boolean).join(SEP); }
// a field's value as one line of text, for the screens that list a field's old and new value (the draft's conflicts)
function bpFieldText(f, v) { return f === 'reservation' ? resvText(v) : f === 'price' ? fmtPrice(v, { note: true }) : null; }
// the note line of a card: one line, cut with "…" (Q4 addition 1); the window and the editor show it whole. A note that holds a digit
// (an amount, an hour - "כ-3,000–6,000 HUF") wraps whole instead (11.44.1, price-level-note; decisions 2026-11-22 · Review of the
// booking-price and info-complete summaries, Q2: a text cut with "…" never hides a digit)
function bpNoteTag(p) { const n = bpPrice(p && p.price).note; if (!n) return '';
  return `<span class="cd-bpn">${/\d/.test(n) ? `<bdi class="t-wrap" dir="auto">${escH(n)}</bdi>` : ellB(escH(n))}</span>`; }
// ---- the door: old text converted, closed values kept only in their sets (fileClean calls it on every object it walks) ----
function bpFileClean(o, key) { if (!o || typeof o !== 'object' || Array.isArray(o)) return;
  if (key === 'hotel') { if ('price' in o) o.price = bpDoor(o.price, true); return; }
  if ('reservation' in o) { const v = o.reservation; if (typeof v === 'string') o.reservation = resvConv(v); else if (v && typeof v === 'object' && !Array.isArray(v)) {
      const r = { ...v }; if (r.need != null && !bpIn('need', r.need)) { delete r.need; FILE_DROPPED++; } o.reservation = resvPack(r.need, r.note); } else if (v != null) { o.reservation = ''; FILE_DROPPED++; } }
  if ('price' in o) o.price = bpDoor(o.price, false); }
function bpDoor(v, hotel) { if (typeof v === 'string') return hotel ? hotelPriceConv(v) : priceConv(v);
  if (!v || typeof v !== 'object' || Array.isArray(v)) { if (v != null) FILE_DROPPED++; return ''; }
  if (!hotel && bpLevelNoteOld(v)) return bpLevelNote(v.note); // 11.44.1: a price 11.42.0 stored as a note ("$$ (נגיש)") - stored data once (FILE_RULES 11.44.1) and every file; 11.45.0: a range too
  const r = { ...v }, drop = k => { delete r[k]; FILE_DROPPED++; };
  if (!hotel && r.kind === 'level' && typeof r.note === 'string' && bpPriceWordsOnly(r.note.trim())) delete r.note; // 11.45.0 (kit-fixes item 11 (b)): a level's note of price words only (11.44.1 kept "נגיש") - none
  if (!hotel && r.kind != null && !bpIn('kind', r.kind)) drop('kind');
  if (r.level != null && r.level !== '' && !bpIn('level', r.level)) drop('level');
  if (r.per != null && r.per !== '' && !bpIn(hotel ? 'hper' : 'per', r.per)) drop('per');
  if (r.currency != null && r.currency !== '' && !bpIn('currency', r.currency)) drop('currency');
  if (r.amount != null && r.amount !== '' && !bpAmt(r.amount)) drop('amount');
  if (!hotel && r.kind === 'amount' && r.checkedAt != null && !BP_MONTH.test(bpStr(r.checkedAt))) drop('checkedAt');
  return pricePack(r, hotel); }
// ---- the editors' fields: a place's "הזמנה ומחיר" and a hotel's "מחיר" ----
function bpCurOpts() { return [...CLOSED_LISTS.currencies].map(c => ({ v: c, text: c + ' ' + curNameHe(c), html: `<b dir="ltr">${c}</b> ${fmEsc(curNameHe(c))} <span dir="ltr">${fmEsc(bpCurSym(c))}</span>` })); }
function bpCurField(F, id, cur) { return fmPick(F, id, { label: 'מטבע', value: cur || '', text: v => v ? fmEsc(bpCurText(v)) : 'בחירת מטבע',
  open: F2 => openFmChoice({ title: 'מטבע', value: F2.vals[id], search: true, searchHint: 'חיפוש מטבע', options: bpCurOpts() }, v => { const G = fmOf(); if (G && G.kinds[id]) fmSet(G, id, v); }) }); }
function bpDestCur(dest) { const d = (dest && DESTS[dest]) || curDest(); const c = d && d.meta && d.meta.currency && d.meta.currency.code; return bpIn('currency', c) ? c : ''; }
// the place editor's section (C.resv, C.price: the stored values; dest: the place's destination, for the default currency)
function bpPlaceFields(F, resv, price, dest) { const r = bpResv(resv), p = bpPrice(price), kind = p.kind;
  F.bp = { was: p }; const show = k => kind === k ? '' : ' hidden';
  return fmChips(F, 'need', { label: 'הזמנה', value: r.need, options: Object.entries(RESV_NEED) })
    + fmText(F, 'resvNote', { label: 'איך ומתי', value: r.note, placeholder: 'למשל: שבוע מראש באתר הרשמי' })
    + fmChips(F, 'pkind', { label: 'מחיר', value: kind, options: Object.entries(PRICE_KIND), on: v => bpShowKind(F, v) })
    + `<div class="bp-sub" data-bp="level"${show('level')}>${fmChips(F, 'plevel', { label: 'רמת מחיר', value: p.level ? String(p.level) : '2', options: [1, 2, 3, 4].map(n => [String(n), PRICE_LEVEL[n]]) })}</div>`
    + `<div class="bp-sub" data-bp="amount"${show('amount')}><div class="sh-times">${fmText(F, 'pamt', { label: 'סכום', value: p.amount || '', inputmode: 'decimal', dir: 'ltr', max: 12, placeholder: '0' })}${bpCurField(F, 'pcur', p.currency || bpDestCur(dest))}</div>`
    + fmChips(F, 'pper', { label: 'עבור', value: p.per || 'person', options: Object.entries(PRICE_PER) })
    + `${p.checkedAt ? `<small class="sh-hint fm-hint bp-when">נכון ל-${p.checkedAt}${SEP}משתנה כשמשנים את הסכום</small>` : ''}</div>`
    + fmText(F, 'pnote', { label: 'הערה על המחיר', value: p.note, para: true, rows: 2 }); }
function bpShowKind(F, v) { const r = fmRoot(F); ['level', 'amount'].forEach(k => { const w = r.querySelector(`[data-bp="${CSS.escape(k)}"]`); if (w) w.hidden = v !== k; }); fmFit(r); }
// what the place editor saves: { reservation, price } in the stored form, or an error { id, msg }
function bpPlaceValues(F) { const reservation = resvPack(F.vals.need, fmGet(F, 'resvNote')), kind = F.vals.pkind, note = fmGet(F, 'pnote');
  if (kind !== 'amount') return { reservation, price: pricePack({ kind, level: F.vals.plevel, note }) };
  const amount = bpAmt(String(fmGet(F, 'pamt') || '').replace(/[,\s]/g, '')); if (!amount) return { err: { id: 'pamt', msg: 'סכום במספר, למשל 25' } };
  const currency = F.vals.pcur; if (!currency) return { err: { id: 'pcur', msg: 'בוחרים מטבע' } };
  const w = (F.bp && F.bp.was) || {}, same = w.kind === 'amount' && w.amount === amount && w.currency === currency && w.per === F.vals.pper; // the date changes with the amount (Q3)
  return { reservation, price: pricePack({ kind, amount, currency, per: F.vals.pper, note, checkedAt: same ? w.checkedAt : bpMonthNow() }) }; }
// the section's summary line: "חובה להזמין · $$ · בינוני"
function bpPlaceSum(F) { const k = F.vals.pkind, pr = k === 'level' ? { kind: k, level: F.vals.plevel } : k === 'amount' ? { kind: k, amount: String(fmGet(F, 'pamt') || '').replace(/[,\s]/g, ''), currency: F.vals.pcur, per: F.vals.pper, checkedAt: bpMonthNow() } : { kind: k };
  return [RESV_LONG[F.vals.need], k !== 'unknown' && fmtPrice(pr, { date: false })].filter(Boolean).map(fmEsc).join(SEP); }
// a hotel's "מחיר": the amount paid, its currency, per night or for the whole stay, a note; the other one derived from the nights
function bpHotelFields(F, price, dest) { const p = bpPrice(price, true);
  return `<div class="bp-hotel"><div class="sh-times">${fmText(F, 'hamt', { label: 'מחיר', value: p.amount || '', inputmode: 'decimal', dir: 'ltr', max: 12, placeholder: '0', on: () => bpHotelDerived(F) })}${bpCurField(F, 'hcur', p.currency || bpDestCur(dest))}</div>`
    + fmChips(F, 'hper', { label: 'עבור', value: p.per || 'night', options: Object.entries(HOTEL_PER), on: () => bpHotelDerived(F) })
    + `<small class="sh-hint fm-hint bp-derived" data-bpd="1"></small>`
    + fmText(F, 'hnote', { label: 'הערה על המחיר', value: p.note }) + '</div>'; }
function bpHotelNights(F) { return nightsBetween(fmGet(F, 'checkIn'), fmGet(F, 'checkOut')); }
function bpHotelDerived(F) { const el = fmQ(F, '[data-bpd]'); if (!el) return; const a = bpAmt(String(fmGet(F, 'hamt') || '').replace(/[,\s]/g, ''));
  el.textContent = a ? fmtHotelDerived({ kind: 'amount', amount: a, currency: F.vals.hcur, per: F.vals.hper }, bpHotelNights(F)) : ''; el.hidden = !el.textContent; }
function bpHotelValue(F) { const raw = String(fmGet(F, 'hamt') || '').replace(/[,\s]/g, ''), note = fmGet(F, 'hnote');
  if (raw && !bpAmt(raw)) return { err: { id: 'hamt', msg: 'מחיר במספר, למשל 450' } };
  if (raw && !F.vals.hcur) return { err: { id: 'hcur', msg: 'בוחרים מטבע' } };
  return { price: pricePack({ amount: raw, currency: F.vals.hcur, per: F.vals.hper, note }, true) }; }

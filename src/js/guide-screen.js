// the guide's search (מ7): words of a question, without the small words; a word also matches without one prefix letter (ה, ב, ל, ו, מ, ש, כ) or a plural ending
const GUIDE_STOP = new Set(['איך', 'מה', 'את', 'של', 'על', 'עם', 'אני', 'לא', 'יש', 'זה', 'זו', 'למה', 'איפה', 'אפשר', 'רוצה', 'רוצים', 'מתי', 'כמה', 'או', 'גם', 'כל', 'אם', 'לי', 'שלי', 'האם', 'צריך', 'הוא', 'היא', 'אותו', 'אותה', 'עושים', 'לעשות', 'מוצאים', 'נמצא']);
let GUIDE_Q = '', GUIDE_AT = null; // GUIDE_AT: a chapter to open ("עוד במדריך ›" in an ⓘ)
function guideWords(q) { return String(q || '').toLowerCase().split(/[\s,.?!:;()"'״׳\-–]+/).filter(w => w.length > 1 && !GUIDE_STOP.has(w)); }
const GUIDE_FINAL = { 'כ': 'ך', 'מ': 'ם', 'נ': 'ן', 'פ': 'ף', 'צ': 'ץ' };
function guideForms(w) { const f = [w]; if (w.length > 4 && 'הבלומשכ'.includes(w[0])) f.push(w.slice(1)); // plural or verb endings: מוסיפים → מוסיף, מקומות → מקום
  f.slice().forEach(x => { if (x.length > 4 && /(ים|ות)$/.test(x)) { const st = x.slice(0, -2); f.push(st.slice(0, -1) + (GUIDE_FINAL[st.slice(-1)] || st.slice(-1)), st); } }); return f; }
function guideHit(text, w) { const t = text.toLowerCase(); return guideForms(w).find(x => t.includes(x)) || ''; }
function guideFind(q) { // → { chapter id: [indexes of matching paragraphs: 0 = the lead, 1.. = lines] }, the best lines only
  const ws = guideWords(q); if (!ws.length) return null;
  const txt = h => htmlText(h), score = h => ws.filter(w => guideHit(txt(h), w)).length, all = [];
  GUIDE.forEach(g => { const t = score(g.title); [g.lead, ...g.lines].forEach((h, i) => all.push({ g: g.id, i, n: Math.max(score(h), t) })); });
  const best = Math.max(0, ...all.map(x => x.n)), out = {};
  if (best) all.filter(x => x.n >= best).forEach(x => (out[x.g] = out[x.g] || []).push(x.i));
  return out;
}
// 10.3.0 (design-3): each chapter as a row - a tinted icon tile of its own color, the title and a line of what it covers
const GUIDE_ROW = { start: ['travel_explore', '#1E88E5', 'מחתימים דרכון', 'יעד, טיול, ואיך מתחילים'], check: ['search', '#00838F', 'מידע שכדאי לבדוק', 'ה-' + AI + ' והמפות יכולים לטעות'], points: ['location_on', '#E53935', 'מקומות', 'רשימה, סינון, כרטיס ופרטים'], map: ['map', '#43A047', 'מפה', 'שכבות, מדידה, "מה יש כאן", בלי רשת'],
  plan: ['calendar_month', '#F57C00', 'תכנון', 'ימים, שעות, הדרך בין המקומות'], info: ['dashboard', '#5E35B1', 'כללי', 'היום, מזג אוויר, המסלול'], trips: ['luggage', '#00897B', 'טיולים ויעדים', 'המסך הראשון, טיולים, יעדים וזיכרונות'],
  draft: ['inbox', '#6D4C41', 'טיוטה', 'קובץ שהגיע, לפני שהוא נכנס'], closing: ['flag', '#C62828', 'סגירת טיול', 'איפה היינו, איך היה, רגעי השיא'], memory: ['photo_album', '#D81B60', 'זיכרון ומזכרות', 'תמונת הטיול, סיכום, המלצות'],
  layers: ['layers', '#3949AB', 'שכבות', 'סדר, צבע וסמל'], hidden: ['visibility_off', '#757575', 'מוסתרים וסל', 'מה שהוסתר או נמחק, והדרך חזרה'], sync: ['cloud_upload', '#0277BD', 'גיבוי ושחזור', 'קובץ גיבוי, תזכורת, שחזור'],
  claude: ['auto_awesome', '#B4532A', 'עבודה עם ' + AI, 'בנייה, סבב שיפורים, גרסה מאוירת'], settings: ['settings', '#546E7A', 'הגדרות', 'שם המכשיר, מסך הפתיחה, תצוגה'], menu: ['history', '#8E24AA', 'יומן, מדריך ומה חדש', 'מה השתנה, ואיך עושים'] };
function guideTitleHTML(g) { const r = GUIDE_ROW[g.id]; if (!r) return `<span>${g.title}</span>`;
  return `<span class="gd-row"><span class="gd-ic" style="--lc:${r[1]}">${msi(r[0], { size: 20 })}</span><span class="gd-t"><b>${r[2]}</b><small>${r[3]}</small></span></span>`; }
function guideChaptersHTML() {
  const found = guideFind(GUIDE_Q), n = found ? Object.keys(found).length : -1;
  if (n === 0) return emptyHTML(msi('search_off'), 'אפשר לנסות מילה אחרת, או לעבור על הפרקים.', 'empty-note', 'לא נמצא במדריך');
  return (found ? `<p class="sh-hint guide-count">נמצא ב-${n} פרקים</p>` : '') + `<div class="accordion">` + GUIDE.filter(g => !found || found[g.id]).map((g, k) => {
    const ps = [g.lead, ...g.lines].map((h, i) => found && !found[g.id].includes(i) ? '' : `<p class="${i ? 'guide-line' : 'guide-lead'}">${icHTML(h)}</p>`).join('');
    return `<div class="accordion-item" data-gch="${g.id}" data-open="${found ? true : GUIDE_AT ? g.id === GUIDE_AT : k === 0}"><button class="accordion-header t-wrap" data-act="acc.toggle">${guideTitleHTML(g)} <span class="accordion-arrow">${msi('expand_more')}</span></button><div class="accordion-body guide-body">${ps}</div></div>`; }).join('') + `</div>`;
}
// the open screen's box (a covered guide screen may still be in the stack)
function guideDraw() { const box = document.querySelector('#main #guideChapters'); if (!box) return; box.innerHTML = claudeH(guideChaptersHTML()); // 10.1.0 (design-1): ✳ in the guide's text is Claude's mark
  if (GUIDE_Q) guideWords(GUIDE_Q).forEach(w => guideForms(w).sort((a, b) => b.length - a.length).forEach(f => box.querySelectorAll('.accordion-item').forEach(b => markSearch(b, f)))); }
function renderGuideScreen() {
  document.getElementById('main').innerHTML = `<div class="section-head gd-head"><h2>מדריך</h2></div><div class="gd-hero"><h3>איך עושים את זה?</h3><p>פרק לכל מסך, וחיפוש לכל שאלה</p></div><div class="sh-field guide-search gd-search">${searchFieldHTML('guideQ', 'חיפוש, למשל "איך מוסיפים מקום"', GUIDE_Q)}</div><div id="guideChapters" class="gd-list"></div>`; // 10.3.0 (design-3): a light-blue header, the search raised over its edge
  wireSearchField(document.querySelector('#main #guideQ'), v => { GUIDE_Q = v; guideDraw(); });
  guideDraw();
}


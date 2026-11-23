// 11.39.0 (task legal-page; decisions 2026-11-21 · Review of the legal-review report, Q6, Q7, Q14 items 6-7): the terms and privacy page and
// "מקורות ורישיונות". The page is terms.html on the app's own site (outside the app's navigation: the service worker serves it from its saved
// copy, offline too - sw.js), opened in its own tab from settings (beside the version) and from the report window. "מקורות ורישיונות" is a
// window built from the providers' rows (PROVIDERS[*].attr - every outside service, its credit and its terms) plus the fixed list below of
// the libraries, fonts and icons the app carries, each with its licence; licenses.txt on the site holds the licence texts (Apache 2.0 for the
// icon subset, the SIL OFL for the fonts, BSD-2 for Leaflet, ISC for world-atlas). The same list is ready for the brochure page.
// task open-source: the window ends with the app's own code - open under MIT, the public repository (COPY_REPO) and its LICENSE.
const TERMS_SITE = 'https://darkon-eran.netlify.app/'; // the in-Claude copy (no site of its own) links the real site
function termsUrl(file) { file = file || 'terms'; try { if (/^https?:$/.test(location.protocol)) return new URL(file, location.href).href; } catch (e) {} return TERMS_SITE + file; }
// what the app carries of others' work: name · what it is in the app · licence · its page
const APP_LICENSES = [
  ['Leaflet 1.9.4', 'ספריית המפות', 'BSD-2-Clause', 'https://github.com/Leaflet/Leaflet'],
  ['Material Symbols', 'האייקונים (תת-קבוצה בתוך הדף)', 'Apache 2.0', 'https://github.com/google/material-design-icons'],
  ['Rubik', 'גופן הטקסט', 'SIL Open Font License 1.1', 'https://github.com/google/fonts/tree/main/ofl/rubik'],
  ['Frank Ruhl Libre', 'גופן הכותרות', 'SIL Open Font License 1.1', 'https://github.com/google/fonts/tree/main/ofl/frankruhllibre'],
  ['Secular One, Suez One, Assistant', 'גופנים לכותרת בתמונת הטיול', 'SIL Open Font License 1.1', 'https://github.com/google/fonts/tree/main/ofl'],
  ['world-atlas 2.0.2', 'גבולות המדינות (Natural Earth, נחלת הכלל)', 'ISC', 'https://github.com/topojson/world-atlas'],
];
function termsLinkHTML(words, cls) { return `<a class="${escH(cls || 'link-btn')}" href="${escH(termsUrl())}" target="_blank" rel="noopener">${words || 'תנאי שימוש ופרטיות'}</a>`; }
function sourcesHTML() { const esc = escH, seen = new Set();
  const provs = Object.keys(PROVIDERS).map(id => { const R = PROVIDERS[id], A = R.attr; if (!A || seen.has(id)) return ''; seen.add(id);
    return `<li class="src-row" data-prov="${esc(id)}"><b>${esc(R.name)}</b><span><a href="${esc(A.u)}" target="_blank" rel="noopener">${esc(A.t)}</a>${SEP}<a href="${esc(R.terms.u)}" target="_blank" rel="noopener">התנאים</a></span></li>`; }).join('');
  const libs = APP_LICENSES.map(([n, w, l, u]) => `<li class="src-row"><b><bdi>${esc(n)}</bdi></b><span>${esc(w)}${SEP}<a href="${esc(u)}" target="_blank" rel="noopener"><bdi>${esc(l)}</bdi></a></span></li>`).join('');
  return `<p class="sh-hint">השירותים שהאפליקציה פונה אליהם, והקוד, הגופנים והאייקונים של אחרים שבתוכה - כל אחד עם הקרדיט והרישיון שלו.</p>
    <div class="wx-sub"><b>שירותים ונתונים</b></div><ul class="src-list">${provs}</ul>
    <div class="wx-sub"><b>קוד, גופנים ואייקונים</b></div><ul class="src-list">${libs}</ul>
    <div class="wx-sub"><b>הקוד של האפליקציה</b></div><p class="sh-hint src-own">קוד פתוח ברישיון <bdi>MIT</bdi>: <a href="${esc(COPY_REPO)}" target="_blank" rel="noopener">המאגר</a>${SEP}<a href="${esc(COPY_REPO + '/blob/main/LICENSE')}" target="_blank" rel="noopener">הרישיון (<bdi>LICENSE</bdi>)</a></p>
    <p class="sh-hint"><a href="${esc(termsUrl('licenses.txt'))}" target="_blank" rel="noopener">טקסט הרישיונות המלא</a>${SEP}${termsLinkHTML('תנאי שימוש ופרטיות', 'src-terms')}</p>`; }
function openSources() { layerNote(openSources, arguments); const sheet = document.getElementById('sheet');
  sheet.innerHTML = `${fmHead(`${msi('description', { cls: 'head-ic' })} מקורות ורישיונות`)}${sourcesHTML()}`;
  showSheetBackdrop('openSources'); }
act('set.sources', () => { openSources(); return 'quiet'; });

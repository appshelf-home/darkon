// 11.39.0 (task legal-page; decisions 2026-11-21 · Review of the legal-review report, Q6, Q7, Q14 items 6-7): the terms and privacy page and
// "מקורות ורישיונות". The page is terms.html on the app's own site (outside the app's navigation: the service worker serves it from its saved
// copy, offline too - sw.js), opened inside the app (task terms-inside, below) from settings (beside the version), the report window and
// "מקורות ורישיונות". "מקורות ורישיונות" is a
// window built from the providers' rows (PROVIDERS[*].attr - every outside service, its credit and its terms) plus the fixed list below of
// the libraries, fonts and icons the app carries, each with its licence; licenses.txt on the site holds the licence texts (Apache 2.0 for the
// icon subset, the SIL OFL for the fonts, BSD-2 for Leaflet, ISC for world-atlas; map-3d: BSD-3 for MapLibre GL JS, BSD-2 for its RTL plugin). The same list is ready for the brochure page.
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
  ['world-atlas 2.0.2', 'גבולות המדינות בתמונות של מסלול (Natural Earth, נחלת הכלל; קובץ בתוך האפליקציה)', 'ISC', 'https://github.com/topojson/world-atlas'], // legal-credits-2 (S9): served from the site
  ['Natural Earth 5.1.2', 'גבולות המדינות במסך "מדינות שביקרנו" (קובץ בתוך האפליקציה)', 'נחלת הכלל', 'https://www.naturalearthdata.com'], // countries-visited
  ['MapLibre GL JS 4.7.1', 'המנוע של המפה בתלת־ממד (עם קוד של Mapbox GL JS 1.13, glfx.js ו-d3-color)', 'BSD-3-Clause', 'https://github.com/maplibre/maplibre-gl-js'], // map-3d
  ['mapbox-gl-rtl-text 0.2.3', 'שמות מימין לשמאל במפה בתלת־ממד (עם קוד של ICU)', 'BSD-2-Clause', 'https://github.com/mapbox/mapbox-gl-rtl-text'],
  ['OSM Liberty (OpenFreeMap)', 'סגנון המפה בתלת־ממד: העיצוב CC BY 4.0, הגופן Noto Sans (OFL) והסמלים Maki (CC0) - נטען מ-OpenFreeMap', 'BSD-3-Clause', 'https://github.com/hyperknot/openfreemap-styles'], // legal-credits-2 (C21)
];
// task terms-inside (decisions 2026-11-23 · The terms page and the licences text open inside the app, Q1-Q2): a page of the app's own site
// opens inside the app as a full screen - the app's head with the page's title and its back arrow over a same-origin frame of the page -
// and back (the arrow, the phone's, Escape) returns to the layer it was opened from exactly as left. The link keeps its href and its own
// tab for the in-Claude copy (no site of its own: inClaude) and a page not served over http(s); the action decides (site.page).
const SITE_PAGES = { terms: 'תנאי שימוש ופרטיות', 'licenses.txt': 'טקסט הרישיונות המלא' }; // file -> the screen's title
const SITE_PARTS = { 'terms#access': 'הצהרת נגישות' }; // task access-statement: a part of a page opened at its anchor -> the screen's title (the brochure links the same anchor)
function siteLinkHTML(file, words, cls) { cls = cls == null ? 'link-btn' : cls; return `<a${cls ? ` class="${escH(cls)}"` : ''} href="${escH(termsUrl(file))}" target="_blank" rel="noopener" data-act="site.page" data-v="${escH(file)}">${words || escH(SITE_PARTS[file] || SITE_PAGES[file])}</a>`; } // file may carry its anchor ('terms#access'): termsUrl keeps it
function termsLinkHTML(words, cls) { return siteLinkHTML('terms', words || 'תנאי שימוש ופרטיות', cls || 'link-btn'); }
function sitePageIn() { return !inClaude() && /^https?:$/.test(location.protocol); } // the page is on the site: open its pages inside
function sitePageFile(u) { if (u.origin !== location.origin) return null; const f = u.pathname.split('/').pop().replace(/\.html$/, ''); return f in SITE_PAGES ? f : null; }
function openSitePage(file) { const title = SITE_PARTS[file] || SITE_PAGES[file.split('#')[0]] || ''; // a part (terms#access) opens the page at its anchor
  const el = document.createElement('div'); el.className = 'screen-layer site-page'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', title);
  el.innerHTML = screenHeadHTML({ act: 'layer.back', title }); // the head of every full screen
  const fr = document.createElement('iframe'); fr.className = 'site-frame'; fr.title = title;
  fr.dataset.at = file.split('#')[1] || ''; fr.onload = () => sitePageFrame(fr); fr.src = termsUrl(file); // src before it is in the page: the frame's first load replaces its blank start, no history entry
  el.appendChild(fr); document.body.appendChild(el);
  layerPush('sitePage', 'full', fp => { el.remove(); layerDone('sitePage', fp); });
  layerMotion('side', 0, el); }
// the look and the links of the page inside (Q2): the app's text size and light / dark choice set on the frame's root from outside (the
// page answers data-theme in its CSS and sizes its text in rem - no script in it); an anchor scrolls in the screen, another page of the
// site opens over it, a link out gets the app's own tab like every outside link - the frame never navigates (no history of its own)
function sitePageFrame(fr) { let d; try { d = fr.contentDocument; } catch (e) { return; } if (!d || !d.documentElement || !/^https?:$/.test(d.location.protocol)) return;
  const r = d.documentElement, dark = isDarkUI();
  r.style.fontSize = TEXT_ROOT * textFactor() + 'px'; r.dataset.theme = dark ? 'dark' : 'light'; r.style.colorScheme = dark ? 'dark' : 'light';
  if (d.contentType === 'text/plain' && d.head) { const s = d.createElement('style'); s.textContent = 'body{margin:16px}pre{white-space:pre-wrap;overflow-wrap:anywhere;unicode-bidi:plaintext;font-size:.875rem}'; d.head.appendChild(s); } // licenses.txt: wrapped, each paragraph in its own direction
  d.querySelectorAll('a[href]').forEach(a => { const u = new URL(a.href, d.baseURI); if (u.origin !== location.origin) { a.target = '_blank'; a.rel = 'noopener'; } });
  const at = fr.dataset.at && d.getElementById(fr.dataset.at); if (at) { const w = fr.contentWindow; w.scrollTo(0, at.getBoundingClientRect().top + w.scrollY); } // the part's anchor again, after the app's text size moved it
  layerOn(d, 'click', e => sitePageClick(e, fr), true); // the layer's own listeners on its frame (gone with it): its links and Escape
  layerOn(d, 'keydown', e => { if (e.key === 'Escape') layerAskClose(false); }); }
function sitePageClick(e, fr) { const a = e.target.closest && e.target.closest('a[href]'); if (!a) return;
  const d = fr.contentDocument, u = new URL(a.href, d.baseURI), here = new URL(d.location.href);
  if (u.origin === here.origin && u.pathname === here.pathname) { e.preventDefault(); // an anchor of this page: scroll in the screen, no history
    const t = u.hash && d.getElementById(decodeURIComponent(u.hash.slice(1))), w = fr.contentWindow; if (t) w.scrollTo(0, t.getBoundingClientRect().top + w.scrollY); else if (!u.hash) w.scrollTo(0, 0); return; }
  const f = sitePageFile(u); if (f) { e.preventDefault(); openSitePage(f); return; }
  a.target = '_blank'; a.rel = 'noopener'; }
act('site.page', ({ v, ev }) => { if (!sitePageIn() || !(v in SITE_PAGES || v in SITE_PARTS)) return 'quiet'; if (ev) ev.preventDefault(); openSitePage(v); return 'quiet'; });
function sourcesHTML() { const esc = escH, seen = new Set();
  const provs = Object.keys(PROVIDERS).map(id => { const R = PROVIDERS[id], A = R.attr; if (!A || seen.has(id)) return ''; seen.add(id);
    return `<li class="src-row" data-prov="${esc(id)}"><b>${esc(R.name)}</b><span>${svcCreditLinks(A)}${SEP}<a href="${esc(R.terms.u)}" target="_blank" rel="noopener">התנאים</a></span>${A.labels ? `<small class="src-note" dir="ltr">${esc(A.labels)}</small>` : ''}${A.notice ? `<small class="src-note" dir="ltr">${esc(A.notice)}</small>` : ''}</li>`; }).join(''); // legal-credits-2: each owner's own link (C18); trip-picture-credits (Q5): a row's labels credit (Esri) under it; a source's required notice under its row (C19: Copernicus WorldDEM-30)
  const libs = APP_LICENSES.map(([n, w, l, u]) => `<li class="src-row"><b><bdi>${esc(n)}</bdi></b><span>${esc(w)}${SEP}<a href="${esc(u)}" target="_blank" rel="noopener"><bdi>${esc(l)}</bdi></a></span></li>`).join('');
  return `<p class="sh-hint">השירותים שהאפליקציה פונה אליהם, והקוד, הגופנים והאייקונים של אחרים שבתוכה - כל אחד עם הקרדיט והרישיון שלו.</p>
    <div class="wx-sub"><b>שירותים ונתונים</b></div><ul class="src-list">${provs}</ul>
    <div class="wx-sub"><b>קוד, גופנים ואייקונים</b></div><ul class="src-list">${libs}</ul>
    <div class="wx-sub"><b>הקוד של האפליקציה</b></div><p class="sh-hint src-own">קוד פתוח ברישיון <bdi>MIT</bdi>: <a href="${esc(COPY_REPO)}" target="_blank" rel="noopener">המאגר</a>${SEP}<a href="${esc(COPY_REPO + '/blob/main/LICENSE')}" target="_blank" rel="noopener">הרישיון (<bdi>LICENSE</bdi>)</a></p>
    <p class="sh-hint">${siteLinkHTML('licenses.txt', 'טקסט הרישיונות המלא', '')}${SEP}${termsLinkHTML('תנאי שימוש ופרטיות', 'src-terms')}</p>`; }
function openSources() { layerNote(openSources, arguments); const sheet = document.getElementById('sheet');
  sheet.innerHTML = `${fmHead(`${msi('description', { cls: 'head-ic' })} מקורות ורישיונות`)}${sourcesHTML()}`;
  showSheetBackdrop('openSources'); }
act('set.sources', () => { openSources(); return 'quiet'; });

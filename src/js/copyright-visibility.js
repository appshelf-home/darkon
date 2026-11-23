// 10.6.1 (task copyright; decisions.md 2026-11-07 Copyright notice): one text beside the version in settings and in the page head's
// <meta name="copyright"> (set at startup; build.py writes the same into the built file). The years: the first release, and a range up
// to the year of this version's date once that is later - computed, never typed by hand. No file the app sends carries it.
const COPY_FIRST_YEAR = 2026, COPY_OWNER = 'מחתימים דרכון'; // 11.39.0 (legal-page; decisions 2026-11-21 · Review of the legal-review report, Q5): the app's name, never a person's
// task open-source (decisions 2026-11-21 · Review of the legal-review report, Q17-Q18; Review of the legal-page summary, Q4): the code is open
// under MIT - only "כל הזכויות שמורות" was replaced, the form stays "<name> · <words> © <years>"; build.py reads COPY_WORDS for the page head.
// COPY_REPO is the public repository (app.json publicRepo); the settings line links it, "מקורות ורישיונות" and the terms page link its LICENSE.
const COPY_WORDS = 'קוד פתוח ברישיון MIT', COPY_REPO = 'https://github.com/appshelf-home/darkon';
function copyYears(date) { const m = String(date || '').match(/(\d{4})\s*$/), y = m ? Number(m[1]) : COPY_FIRST_YEAR; return y > COPY_FIRST_YEAR ? `${COPY_FIRST_YEAR}–${y}` : String(COPY_FIRST_YEAR); }
function copyrightText() {
  return `${COPY_OWNER} · ${COPY_WORDS} © ${copyYears(APP_DATE)}`; } // 10.6.2 (the owner): the name first, "© <years>" at the end
const TRIP_DAYS = []; // days of the active trip, filled by applyActiveTrip()


let activeTab = 'info';
function isHiddenPoint(p) {
  return layerDef(p.layer).hidden || (TRIP_HIDDEN && TRIP_HIDDEN.has(p.id)) || (p.access === 'limited' && !DEV.showLimited) || isGoneStatus(p.status); // 8.1.0: back only from 🙈 מוסתרים
}
const VIS = arr => arr.filter(p => !isHiddenPoint(p) && destShown(p.dest) && regionPass(p));
// 4.0.0: regions (optional, per destination). Multi-select chips appear only when a shown destination has regions.
const regionKey = p => (p.dest || '') + '|' + (p.region || '');
function regionPass(p) { return !FP.regions.size || FP.regions.has(regionKey(p)); }
function shownRegions() {
  const ids = selDests();
  const multi = ids.length > 1;
  return [].concat(...ids.map(id => destRegions(DESTS[id]).map(r => ({ key: id + '|' + r.id, name: multi ? `${r.name}${SEP}${destName(id)}` : r.name }))));
}
// a trip day opens in the region of that night's lodging (destinations that ask for it: meta.lodgingRegionDefault)
function defaultRegions() {
  const pick = DEV.regionPick; if (pick && pick.date === todayStr()) return new Set(pick.keys || []);
  const iso = todayStr(), t = activeTripObj(); if (!t || iso < t.start || iso > t.end) return new Set();
  const lo = (t.lodging || []).find(l => l.checkIn <= iso && iso < l.checkOut); if (!lo || lo.placeId == null) return new Set();
  const pl = POINTS.find(x => x.id === lo.placeId); const d = pl && DESTS[pl.dest];
  return pl && pl.region && d && d.meta.lodgingRegionDefault ? new Set([regionKey(pl)]) : new Set();
}
// 10.15.0 (design-review Q1): a hidden reason is UI - a line icon wherever a status shows (closed block, does not exist wrong_location,
// not interesting visibility_off); the words alone in texts and logs
const STATUS_LABEL = { gone: 'לא קיים', closed: 'נסגר', skip: 'לא מעניין' }, STATUS_MS = { gone: 'wrong_location', closed: 'block', skip: 'visibility_off' };
function statusHTML(s, o) { return STATUS_MS[s] ? msi(STATUS_MS[s], { size: 18, cls: 'msi-in', ...(o || {}) }) + STATUS_LABEL[s] : ''; }
function isGoneStatus(st) { return st === 'gone' || st === 'closed' || st === 'skip'; }
const HIDE_REASONS = ['skip', 'closed', 'gone']; // 8.1.0 (ב2): the order of the question "למה להסתיר?" - not interesting first


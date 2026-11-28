// MECHANISM MAP: read the spec, `darkon/spec/index.md` (the parts: `src/order.json`), before any change - a new feature extends one of the
// mechanisms listed there (layers, map, card, filter model, search field, share choice, dictionary, data registry, action wiring, time, external services...); none fits → stop and ask.
// 3.0.0: three data levels. DESTINATION (places, layers, info - true on every visit), TRIP (dates, segments,
// travels, lodging, trip places, organized schedule - one visit, shared by its travelers) and PERSONAL (marks and plan - per trip, per device).
// 4.0.0: a clean engine that names no destination. What a copy holds comes from its bundle (#bundle):
// "empty" (welcome screen), "site" (a trip site for a group: the trip and its destinations) or "mine" (the owner's copy).
// The internal keys below stay as they were, so data saved on the phone keeps loading.
const APP = { appTitle: 'מחתימים דרכון', appShort: 'דרכון', filePrefix: 'budapest', storeKey: 'budapest_trip_v1', geocodeKey: 'budapest_geocode_cache_v3', fileName: 'darkon', testHost: 'darkon-test--' }; // test-address: the test address's host starts with testHost (the site's branch deploy, <branch>--<site>)
const PACK = APP;
// THE ONE ESCAPER (final-review-fixes, family A): data (a name, a note, anything from a file or typed by the user) goes into built HTML -
// text or an attribute in double quotes - only through escH; every local `esc` is this function, and it has no other global name (one-way (15)).
// The rule of the pair: a function that RETURNS plain text (a name, a label, a message for the snackbar) is escaped where it enters
// HTML, once; a function that returns built HTML (msi(), a card, tripStateLine) is never passed to an escaper, to textContent or to
// the snackbar. The bubble and the snackbar take plain text and escape it themselves (showChipBubble's text contract, showToast).
function escH(v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
// VALUES AND SEPARATORS TIED AT THE SOURCE (value-no-cut, 11.36.1; value-tie-source, 11.38.0; spec/button-rows-and-text-that-doesnt-break.md):
// a " · " separator never opens a line - every one shown to the user is SEP (a no-break space before "·"), written as SEP in the
// code (t1132 fails on a literal " · " in a display string of js/); sepTie ties a text that came with plain ones (a name from a file).
// Defined here, before every part, so a top-level text of any part may use it.
const SEP = '\u00A0· ';
function sepTie(html) { return String(html).replace(/ · /g, SEP); }
// a value wraps whole - a number stays with its unit and "≈" with its number ("≈ 13 דק׳"); for plain text and simple markup only
// (an attribute's digits - an SVG's viewBox - must not pass through it). The formatters tie their own (fmtKm, fmtM, tmFmt 'dur').
function numTie(html) { return String(html).replace(/(\d) (?=[^\s<])/g, '$1\u00A0').replace(/≈ (?=\d)/g, '≈\u00A0'); }
// THE SCREEN CLASS (one-way (16); standard: one script helper beside the CSS): the script asks the screen's class, never its width.
// The breakpoints are the CSS's own (@media (min-width: 600px) tablet, (min-width: 1024px) wide - css/screens-tiers.css).
// draw-no-write (item 8; decisions 2026-11-27 · Review of night chain steps 1-4 after 11.67.1, Q10): THE ONE READER OF A MOTION TOKEN - a
// duration from CSS in milliseconds, by its unit: the built page minifies "200ms" to ".2s", so a bare parseFloat read 0.2 ms there.
// layerMotion and the passport's page turn read through it (t1254 reads the built page's tokens through it)
function cssMs(name, dflt) { const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim(), n = parseFloat(v);
  return isFinite(n) ? (/[^m]s$/.test(v) ? n * 1000 : n) : dflt; }
const SCREEN_AT = { tablet: '(min-width: 600px)', wide: '(min-width: 1024px)' };
function screenAtLeast(k) { return !!(window.matchMedia && matchMedia(SCREEN_AT[k]).matches); }
// 4.6.0: the "none chosen" marker of chip sets is defined before startup (a multi-destination trip crashed when opened on a trip day)
const NONE = '__none';
// 5.14.0 (cl-filter-impl-plan stage 1, decision ס4): ONE filter state per family of screens - every button on a screen and every
// window reads and writes only this; there is no second copy. Between kinds "and", inside a kind "or". Sorting lives here
// too, but it is not a filter. points = the places list and the map (shared); draft = the draft's review.
const FILTER = {
  points: { dest: new Set(), days: null, route: false, layers: new Set(), styles: new Set(), fav: false, book: false, regions: new Set(), q: '', sort: 'fav' },
  draft: { srcs: new Set(), layers: new Set(), changed: false, notes: false },
};
const FP = FILTER.points;

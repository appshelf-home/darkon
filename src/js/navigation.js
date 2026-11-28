// 1.9.0: bottom nav sections; each section shows its own chip row under the top bar
const SECTIONS = {
  points: { label: 'מקומות', items: POINTS_GROUP },
  map:    { label: 'מפה', items: [] },
  plan:   { label: 'תכנון', items: PLAN_GROUP },
  info:   { label: 'כללי', items: INFO_GROUP },
};
const lastTabOf = { points: 'all', map: 'map', plan: 'itinerary', info: 'info' };
function sectionOf(tab) {
  if (tab === 'map') return 'map';
  if (tab === 'trash' || tab === 'hidden' || tab === 'layers' || POINTS_GROUP.some(g => g.id === tab)) return 'points';
  if (PLAN_GROUP.some(g => g.id === tab)) return 'plan';
  if (INFO_GROUP.some(g => g.id === tab)) return 'info';
  return null; // menu screens: sync, guide, whatsnew
}
let _freshT = 0;
let _infoScroll = null;
function infoSpotEls() { return [...document.querySelectorAll('#main .accordion-item, #main .section-head, #main .dest-info-head, #main .info-block')]; }
function infoSpotKey(el) { return el.classList.contains('accordion-item') ? 'a:' + infoAccKey(el) : el.id ? 'i:' + el.id : 't:' + el.textContent.replace(/[\d·.,:▾]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40); }
function infoSpot() {
  const els = infoSpotEls(), top = 70, el = els.find(e => e.getBoundingClientRect().bottom > top);
  return el ? { trip: STATE.activeTrip, key: infoSpotKey(el), off: el.getBoundingClientRect().top, y: window.scrollY } : { trip: STATE.activeTrip, y: window.scrollY };
}
function restoreInfoSpot(sp) {
  const put = () => { const el = sp.key && infoSpotEls().find(e => infoSpotKey(e) === sp.key);
    appScroll(el ? el.getBoundingClientRect().top + window.scrollY - sp.off : sp.y); }; // back-exit 2b: the app's own scroll never hides the bar
  put();
  // while the widgets above fill in (about a second), keep the same section in place - unless the user scrolls
  let moved = false; const stop = () => { moved = true; touchAny('down', stop, false); };
  touchAny('down', stop); ['wheel', 'keydown'].forEach(ev => sysOn(window, ev, stop, { once: true, passive: true }));
  [150, 400, 800, 1400].forEach(t => setTimeout(() => { if (!moved && activeTab === 'info') put(); }, t));
}
function goTab(tab) {
  if (SCREEN_TABS.has(tab)) { if (tab === 'draft' && activeTab !== 'draft') { try { if (draftView) delete draftView.view; } catch (e) {} } if (tab === 'memory') archiveViewEnd(); openScreen(tab); return; } // 5.6.0: a full screen over the current place
  if (!layerLeave(() => goTab(tab))) return; // windows-inner-steps (Q7): not over an unsaved change - the row asks in that layer first
  closeAllSheets(); // 5.1.0: moving to another screen closes every window
  if (tab === 'trips') archiveViewEnd(); // archive-redraw: the trips screen or a memory screen chosen ends an archive view - here, never in their draw
  ARRANGE_DAYS = false; // 4.38.0
  if (isLayerTab(tab)) { FP.layers = new Set([tab]); tab = 'all'; }
 // 4.3.0: one points screen, layers are chips on it
  if (tab === 'draft' && activeTab !== 'draft') { try { if (draftView) delete draftView.view; } catch (e) {} } // 4.38.1: arriving shows all the points
  if (tab !== activeTab) { const m = document.getElementById('main'); m.classList.add('fresh'); clearTimeout(_freshT); _freshT = setTimeout(() => m.classList.remove('fresh'), 400); }
  // phone-round-2b-fixes P13 (G64, 11.23.2; replaces 4.15.0's "the route is a view of the map screen only"): "כל המסלול" is a choice of the days filter, kept across tabs like the others; the places screen shows the choice in its days button and lists every place (as "כל הימים" - the route has no list view)
  // 4.37.0: ℹ️ כללי is long; coming back to it (e.g. from a route stop on the map) returns to the same spot
  // The spot is kept as "this section, this far from the top" and not as a pixel count: the weather, currency and
  // sun widgets above it fill in a moment later and change the height, which made a pixel position jump.
  // back-exit 2b (decisions 2026-11-20 · After loading a trip, Q2): only coming back from another screen of the same trip (a section of the
  // bottom bar) - a trip switch, the trips screen and any load from a file clear the kept spot (infoSpotClear) and "כללי" opens at its top
  if (activeTab === 'info' && tab !== 'info') _infoScroll = infoSpot();
  const back = tab === 'info' && activeTab !== 'info' && sectionOf(activeTab) && _infoScroll && _infoScroll.trip === STATE.activeTrip ? _infoScroll : null;
  activeTab = tab; FP.styles = new Set();
  const sec = sectionOf(tab); if (sec) lastTabOf[sec] = tab;
  render(); appScroll(0);
  if (back) restoreInfoSpot(back);
  navShow();
}
function infoSpotClear() { _infoScroll = null; } // back-exit 2b: a trip switch or a load from a file - "כללי" opens at its top
// the bottom bar shown (and the page's marks that follow it - the ＋ and ↑ buttons' place): a screen or trip change, a trip loaded from a file
function navShow() { const bn = document.getElementById('bottomNav'); if (bn) bn.classList.remove('hide'); document.body.classList.remove('nav-hidden'); }
function renderTabs() {
  const tabs = document.getElementById('tabs');
  const sec = sectionOf(activeTab);
  document.querySelectorAll('#bottomNav [data-sec]').forEach(b => b.dataset.active = String(b.dataset.sec === sec));
  const items = sec ? SECTIONS[sec].items : [];
  const tds = tripDests(activeTripObj());
  // 4.1.0: destination chips only when the trip has more than one destination. One-destination screens (info, layers)
  // pick a single destination; the others pick several, with "הכל".
  const single = activeTab === 'layers'; // 5.15.0 (ד4): ℹ️ כללי picks its destination from the title
  let destChips = '';
  const sfPick = '<button type="button" class="chip dest-chip sf-pick" id="destPick" data-act="tabs.destPick"></button>'; // 4.37.0: chips fit by width
  if (tds.length > 1 && single) destChips = tds.map(id => `<button class="chip dest-chip" data-sf="${id}" data-act="tabs.oneDest" data-v="${id}" data-active="${oneDest().id === id}">${srcChipInner(destFlag(id), destName(id))}</button>`).join('') + sfPick + '<span class="chip-sep"></span>';
  const shownItems = sec === 'points' || items.length < 2 ? [] : items; // 4.12.1: one tab alone (כללי) is not shown // 4.3.0: the layers of the points section are the chip block below
  tabs.innerHTML = destChips + shownItems.map(g => `<button class="chip" data-act="tabs.go" data-v="${g.id}" data-active="${activeTab === g.id}">${g.color ? `<span class="dd-dot" style="background:${g.color}"></span>` : ''} ${g.label}</button>`).join('')
;
  tabs.classList.toggle('src-fit', !!destChips); fitSrcRow(tabs);
  // 4.3.4: bring the active chip into view sideways only. scrollIntoView also scrolled the page, so marking a card
  // (✓, ⭐) on a screen whose chip row is not sticky (e.g. ⭐ חובה) jumped the list up.
  const on = tabs.querySelector('[data-active="true"]:not(.dest-chip)'); if (on) revealSideways(on);
  // 4.3.0: layer chips under the destination row, on 📍 נקודות and on the places map
  const lb = document.getElementById('layerBlock');
  const showLayers = hasTrip() && ((sec === 'points' && activeTab === 'all') || activeTab === 'map'); // the places list and the map: always (10.3.0 kept it - look.md "Places screen", decisions 2026-11-07)
  lb.innerHTML = showLayers ? layerChipsBlock() + filterHeadHTML() : ''; // 5.14.0 (ד1): two rows - the layers, and the buttons with the count
  if (showLayers) wireLayerChips(document.getElementById('layerChips'));
}

act('tabs.oneDest', c => { setOneDest(c.v); return 'redraw'; });
act('tabs.destPick', () => openSrcPicker('#tabs', activeTab === 'layers' ? 'איזה יעד' : 'אילו יעדים', activeTab === 'layers'));
act('tabs.go', c => goTab(isNaN(c.v) ? c.v : parseInt(c.v)));
function infoDest() { return tripDests(activeTripObj()).length > 1 ? oneDest() : curDest(); }
function destDays(id) { const ds = TRIP_DAYS.filter(d => destsOfDay(d.key).includes(id)); return ds.length ? ds : TRIP_DAYS; }

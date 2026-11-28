// ================= TRIPS & DESTINATIONS SCREEN (3.0.0) =================
function destName(id) { return DESTS[id] ? DESTS[id].meta.name : id; }
function switchTrip(id, silent, land) { // land: the tab to land on, asked once the trip is open (trip-cards: tripLanding); else "כללי"
  if (!layerLeave(() => switchTrip(id, silent, land))) return; // windows-inner-steps (Q7): another trip only once an unsaved change below was saved or left
  archiveViewEnd();
  if (STATE.trips[id] && STATE.trips[id].archived) { memoryTrip = id; goTab('memory'); return; }
  if (!STATE.trips[id] || id === STATE.activeTrip) { goTab(land ? land() : 'info'); return; }
  stashActive(); STATE.activeTrip = id; loadPersonal(id); applyActiveTrip(); FP.regions = defaultRegions(); syncFlightsToPlan(); persist(); updateHeader(); infoSpotClear(); goTab(land ? land() : 'info'); // back-exit 2b
  if (!silent) showUndoToast('עברתם לטיול: ' + STATE.trips[id].name);
}
// undo-history: the region filter is chosen per trip (switchTrip, setActiveTripQuiet); an undo that changes the open trip chooses again
undoAfter(keys => { if (keys.includes('["s","activeTrip"]')) FP.regions = defaultRegions(); });

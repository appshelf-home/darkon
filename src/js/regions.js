// 4.0.0: the walking clusters became the destination's regions; this screen lists the regions of the trip's destinations

act('meas.end', () => { measClear(); return 'quiet'; });
function renderAllTab() {
  // 4.3.0: one layer chosen - that layer's screen (name as title, collection counter). 4.4.0: the filter and the count are in
  // the shared header (same as the map); this screen is always a list - the map is 🗺️ מפה in the bottom bar.
  if (FP.layers.size === 1 && !selNone(FP.layers)) { const only = [...FP.layers][0]; if (groupOf(only)) { renderLayerTab(only); return; } }
  const none = selNone(FP.layers), partial = FP.layers.size && !none;
  const all = filteredPoints(); let pts = sortPoints(all.filter(p => !p.planOnly)).concat(all.filter(p => p.planOnly)); // 📝 items after the places
  const mref = MEAS && MEAS.id === 'mapView_screen' && MEAS.pts.length ? MEAS.pts[0].ll : null; // 4.31.0: measuring - by distance from the reference
  if (mref) { const d = p => { const c = !p.planOnly && routeCoordOf(p); return c ? distanceKm(mref, c) : Infinity; }; pts = pts.map(p => ({ p, d: d(p) })).sort((a, b) => a.d - b.d).map(x => x.p); }
  maybeGeocodeForSort(pts.filter(p => !p.planOnly));
  let html = ''; // 5.14.0 (ד1): no title over the cards
  if (mref) html += `<div class="meas-banner">${msi('track_changes', { size: 20 })}<span>לפי המרחק מ${MEAS.pts[0].me ? 'המיקום שלי' : '-' + measRefName()}</span><button type="button" class="icon-btn" data-act="meas.end" aria-label="סיום המדידה">${msi('close')}</button></div>`; // 10.2.0 (design-2): measure mode's banner
  html += pts.length ? pts.map(p => {
    const mc = mref && !p.planOnly && routeCoordOf(p), it = itemOf(p.id); // 5.3.0: notes too - the same mini card
    return it ? miniCardHTML(it, { screen: 'list', desc: true, extra: mc ? `<span class="meas-d">${measFrom(mc)}</span>` : '' }) : '';
  }).join('') : (none ? emptyHTML(msi('layers_clear'), 'בוחרים שכבה למעלה, או "הכל".', '', 'כל השכבות כבויות') : FP.days ? emptyHTML(msi('event_busy'), '✕ ליד המונה מציג הכל.', '', 'אין מקומות בימים האלה') : emptyHTML(msi('search_off'), 'אפשר לנסות מילה אחרת, או לשנות את הסינון.', '', 'לא נמצאו מקומות'));
  html += listEndHTML(all);
  document.getElementById('main').innerHTML = html;

}


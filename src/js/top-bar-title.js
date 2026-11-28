function updateHeader() {
  const t = activeTripObj(); const a = TRIP_DAYS[0], b = TRIP_DAYS[TRIP_DAYS.length - 1];
  // 4.42.0: a chip - 🧳 (🗄️ while viewing the archive), the trip name, a small date and ▾; without a trip "הטיולים שלי"
  document.getElementById('appTitleIc').innerHTML = msi(ARCHIVE_VIEW ? 'inventory_2' : DEST_VIEW ? 'location_on' : 'luggage', { size: 18 }); // 10.3.0 (design-3): a line icon; destination-view (Q5): a pin
  document.getElementById('appTitle').textContent = DEST_VIEW ? 'יעד ' + destName(DEST_VIEW.did) : t.name ? t.name.split(' · ')[0] : 'הטיולים שלי'; // destination-view (Q5): "יעד <name>", no ▾ (body.dest-view)
  // during the trip "יום X מתוך N"; otherwise the start date (a trip planned by days: "N ימים")
  const virt = a && isVirt(a.date), di = a && !virt ? TRIP_DAYS.findIndex(d => d.date === todayStr()) : -1, dt = document.getElementById('appDates');
  dt.textContent = !t.name || !a ? '' : di >= 0 ? `· יום ${di + 1} מתוך ${TRIP_DAYS.length}` : virt ? `· ${TRIP_DAYS.length} ימים` : `· ${a.label}`;
  void b; dt.dir = 'rtl';
  fitTitle();
}
// 4.42.0: a long name keeps its words - the small date drops before the name is cut with "…"; the bar never wraps
function fitTitle() {
  const btn = document.getElementById('titleBtn'), nm = document.getElementById('appTitle'); if (!btn || !nm) return;
  btn.dataset.tight = ''; if (nm.scrollWidth > nm.clientWidth + 1) btn.dataset.tight = '1';
}
sysOn(window, 'resize', fitTitle); if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitTitle);
// 4.0.0: an empty copy (or one whose trips were all deleted) opens here
// 10.1.0 (design-1): the logo - the oval stamp (look.md "Icons", notes/design-round/screens-1/stamps.py B) in the primary color; the plane is
// the font's 'flight'. size: 'l' (the welcome screen) · 'm' (the head of the guide) · 's' (the smallest where its words still read)
function logoHTML(size) { return `<span class="logo ${({ l: 'logo-l', s: 'logo-s' })[size] || 'logo-m'}" role="img" aria-label="${APP.appTitle}"><svg viewBox="0 0 150 100" aria-hidden="true">${logoBody()}</svg></span>`; }
function logoBody() { return `<g transform="rotate(10 75 50)" fill="currentColor"><ellipse cx="75" cy="50" rx="66" ry="42" fill="none" stroke="currentColor" stroke-width="3.5"/><ellipse cx="75" cy="50" rx="57" ry="34" fill="none" stroke="currentColor" stroke-width="1.2" stroke-dasharray="3 3"/>`
  + `<text x="75" y="64" text-anchor="middle" font-family="MS" font-size="40" transform="rotate(-45 75 50)">&#x${MS_CP.flight};</text><text x="75" y="25" text-anchor="middle" font-size="10" font-weight="500">מחתימים</text><text x="75" y="82" text-anchor="middle" font-size="10" font-weight="500">דרכון</text></g>`; } // the logo's drawing, also for the passport's cover shared as an image

// ================= THE MEMORY SCREEN, THE MEMORIES' SCREEN AND CLOSING'S START (memories group; split from trip-states.js in diet-groups, 11.62.0) =================
function renderMemoriesScreen() { const ctl = ctlNS('trips'), arch = tripsArchived();
  document.getElementById('main').innerHTML = `<div class="section-head"><h2>${msi('photo_album', { cls: 'msi-in' })} כל הזיכרונות</h2><p>טיולים שנסגרו, החדש ראשון. נגיעה פותחת את הזיכרון.</p></div>`
    + cvLineHTML(true) + ppLineHTML(entGo(), true) + (arch.length ? tripMemsHTML(arch, false) : emptyHTML(msi('photo_album'), 'טיול שנסגר מופיע כאן', '', 'עוד אין זיכרונות'));
  ctl.tc = (b, c) => runTripAction(c.ref.id, b.dataset.tc); }
// ---- closing: what it means depends on the state ----
function closeTripStart(id) { const ctl = {}; layerNote(closeTripStart, arguments);
  const t = STATE.trips[id]; if (!t || t.archived) return; const st = tripState(t), sheet = document.getElementById('sheet'); // 11.37.0 (P2, G84): no closing door on a memory
  if (st === 'ended' || (DEV.clSteps || {})[id]) { if (typeof openClosingFlow === 'function') openClosingFlow(id); else archiveTrip(id, 'ended'); return; } // 11.34.0 (P5, G73; Q2 A): a closing already begun reopens at its step
  const iso = todayStr(), yest = isoAdd(iso, -1);
  let body = '';
  if (!t.start) body = `<p><b>הטיול התקיים?</b> אם כן, בוחרים את התאריכים שלו וממשיכים לסגירה הרגילה. אם לא, הוא עובר לזיכרונות עם התווית "בוטל", בלי תהליך סגירה ובלי מזכרת.</p>${cardActionsHTML({ act: 'closeStart.cl', data: 'data-cl="happened"', label: `${msi('edit_calendar', { size: 18 })} כן, לבחור תאריכים` }, [{ act: 'closeStart.cl', data: 'data-cl="cancel"', label: 'לא, הטיול בוטל' }])}`; // B1 (decisions 2026-11-13 review of 11.10.0)
  else if (st === 'before') body = `<p><b>הטיול בוטל?</b> הוא יעבור לזיכרונות עם התווית "בוטל", בלי תהליך סגירה ובלי מזכרת. אפשר להחזיר אותו בכל זמן ("פתיחה מחדש").</p><p class="sh-hint">הטיול נדחה? עדיף לערוך ולשנות תאריכים.</p>${cardActionsHTML({ act: 'closeStart.cl', data: 'data-cl="cancel"', label: 'כן, הטיול בוטל' }, [{ act: 'closeStart.cl', data: 'data-cl="edit"', label: `${msi('edit_calendar', { size: 18 })} לשנות תאריכים` }])}`;
  else body = `<p><b>חזרתם מוקדם?</b> הטיול מתוכנן עד ${tmFmt('date', t.end)}. אפשר לקצר אותו עד היום האחרון שבו הייתם, ואז לסגור.</p>
    <div class="brow tight sh-days">${[yest >= t.start ? [yest, 'אתמול'] : null, [iso, 'היום']].filter(Boolean).map(([d, l]) => `<button type="button" data-act="closeStart.clend" data-clend="${d}" aria-pressed="${d === iso}">${l}${SEP}${tmFmt('dayN', d)}</button>`).join('')}</div>
    <label class="sh-field">או יום אחר${fmDateInput({ id: 'clEnd', min: t.start, max: t.end, value: iso })}</label>
    ${cardActionsHTML({ act: 'closeStart.cl', data: 'data-cl="short"', label: `${msi('sports_score', { size: 18 })} לקצר עד היום הזה ולסגור` }, [{ act: 'closeStart.cl', data: 'data-cl="x"', label: 'לא, ממשיכים בטיול' }])}`;
  sheet.innerHTML = `${fmHead(`🗄️ סגירת ${nameB(t.name)}`, 'clClose')}${body}`;
  
  ctl.clend = b => { sheet.querySelector('#clEnd').value = b.dataset.clend; sheet.querySelectorAll('[data-clend]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); };
  ctl.cl = b => {
    const k = b.dataset.cl;
    if (k === 'x') { closeSheet(); return; }
    if (k === 'edit') { closeSheet(); openTripEditor(id); return; }
    if (k === 'cancel') { archiveTrip(id, 'cancelled'); return; }
    if (k === 'happened') { closeSheet(); openTlDates(id, true); return; } // B1: the dates window, then the regular closing flow
    if (k === 'short') { const e = sheet.querySelector('#clEnd').value; if (!e || e < t.start) { showToast('בוחרים יום בתוך הטיול'); return; }
      t.end = e; (t.segments || []).forEach(s => { if (s.to > e) s.to = e; if (s.from > e) s.from = e; });
      persist(); closeSheet(); if (STATE.activeTrip === id) { applyActiveTrip(); updateHeader(); }
      // undo-history Q6: the shortening is one row (its toast) in both cases - before the closing flow opens, so it is not
      // folded into the flow's first mark
      const msg = `הטיול קוצר עד ${tmFmt('date', e)}: ${t.name}`;
      // 11.34.0 (P5, G73; Q2 B): today - the trip's last day - closes at once too (that evening), as the dates path does
      if (e <= todayStr()) { showUndoToast(msg); if (typeof openClosingFlow === 'function') openClosingFlow(id, e === todayStr()); else archiveTrip(id, 'ended'); }
      else showUndoToast(msg); }
  };
  showSheetBackdrop('closeTripStart'); layerTop().ctl = ctl;
 
}
ctlActs('closeStart', ['cl', 'clend']);

// ---- the memory screen ----
// ride-km (Q2-Q4): "ק״מ בנסיעות" - a fourth tile only in a route trip by the app's automatic kind (a city trip keeps its three); a button that
// opens the breakdown by kind (the other tiles stay as they are)
function memRideTileHTML(D, id) { if (!D || D.auto === 'city' || !D.ride.km) return ''; const n = fmtKm(D.ride.km, { num: true }), l = RIDE_LABEL[0] + (D.ride.est ? ' (משוער)' : '');
  return `<button type="button" class="dr-tile dr-tile-btn mem-ride" id="memRide" data-act="memory.ride" data-v="${escH(id)}" aria-label="${escH(l)}: ${n}${SEP}פירוק לפי סוג"><b>${n}</b><small>${l}</small></button>`; }
function tripMemoryData(id) {
  const t = STATE.trips[id]; if (!t) return null; if (id === STATE.activeTrip) stashActive();
  const snap = (t.archived && t.archived.snap) || null, td = STATE.tripData[id] || {};
  const places = snap ? snap.places : withTrip(id, () => POINTS.filter(q => touchedIds(td, t).has(q.id)).map(snapPlace));
  const pmap = new Map(places.map(p => [p.id, p]));
  const visited = (td.visited || []).map(i => pmap.get(i)).filter(Boolean);
  const stops = (t.lodging || []).slice().sort((a, b) => String(a.checkIn).localeCompare(String(b.checkIn))).map(l => ({ l, p: pmap.get(l.placeId) })).filter(x => x.p && snapCoord(x.p));
  return { t, snap, td, places, pmap, visited, stops, dests: snap ? Object.keys(snap.dests || {}) : tripDests(t), layers: snap ? snap.layers : LAYER_DEFS };
}
function memoryMapSVG(M, w, h) { // 4.36.0: the static version (inside Claude, where there are no live maps): rating colours, main-cluster frame, arrows
  const I = memItems(M, false), all = I.places.concat(I.hotels); if (!all.length) return '';
  const D = mementoData(M.t.id), kind = memKind(D), fr = memFrame(I.places.length ? I.places : all, kind), core = fr.core.concat(kind === 'city' ? I.hotels.filter(h => fr.core.some(x => distanceKm(x.c, h.c) < 60)) : I.hotels);
  const g = mercFit((core.length ? core : all).map(x => x.c), w, h, 26, 17), box = { x: 0, y: 0, w, h }, data = schemDataNow(M.t.id, kind, core.length ? core : all);
  let s = `<svg viewBox="0 0 ${w} ${h}" class="mem-map" style="direction:ltr" role="img" aria-label="מפה של המקומות ש${TX.visited} בהם"><defs><clipPath id="mmclip"><rect width="${w}" height="${h}" rx="14"/></clipPath></defs><g clip-path="url(#mmclip)"><rect width="${w}" height="${h}" class="mm-bg"/>`;
  if (data) s += schemSVG(data, g, box, (D && D.th) || {}, 11);
  if (I.hotels.length > 1) s += `<polyline points="${I.hotels.map(x => `${g.x(x.c.lng).toFixed(1)},${g.y(x.c.lat).toFixed(1)}`).join(' ')}" class="mm-route"/>`;
  I.places.forEach(x => { s += `<circle cx="${g.x(x.c.lng).toFixed(1)}" cy="${g.y(x.c.lat).toFixed(1)}" r="${x.hi || x.key || x.r === 'love' ? 6 : 4.2}" fill="${x.color}" class="mm-dot"/>`; });
  I.hotels.forEach(x => { s += `<text x="${g.x(x.c.lng).toFixed(1)}" y="${(g.y(x.c.lat) + 5).toFixed(1)}" class="mm-hotel" text-anchor="middle">&#x${MS_CP.hotel};</text>`; });
  I.places.filter(x => x.hi || x.key).slice(0, 8).forEach(x => { s += `<text x="${g.x(x.c.lng).toFixed(1)}" y="${(g.y(x.c.lat) - 9).toFixed(1)}" class="mm-label" text-anchor="middle">${escH(x.name.slice(0, 22))}</text>`; });
  s += edgeArrowsSVG(g, box, fr.far, fr.center, '#1C2B33', 10);
  return s + '</g></svg>';
}
function planAsItWasHTML(M, o) { o = o || {}; // o.sv (the memory screen, map-side-view): each day's Timeline walk gets its "גובה"; pages for people get none
  const days = dayList(M.t.start, M.t.end); if (!days.length) return '';
  const nameOf = id => { if (typeof id === 'string') { const f = (M.td.planItems || {})[id]; return f ? { ic: msi('sticky_note_2', { cls: 'msi-in' }), n: f.name } : ''; } const p = M.pmap.get(id); return p ? { ic: typeIcon(p.icon, { cls: 'msi-in' }), n: placeLabel(p, M.t) } : ''; }; // 10.8.0: line icons
  const vis = new Set(M.td.visited || []);
  return days.map(d => { const it = (M.td.itinerary || {})[d.key] || {}, ids = ['morning', 'afternoon', 'evening', 'unassigned'].flatMap(k => it[k] || []);
    const sch = (M.t.schedule || []).filter(x => x.date === d.date).map(x => `<li class="mp-org">${x.start ? x.start + ' ' : ''}${escH(x.title)}</li>`);
    const mine = ids.map(i => { const n = nameOf(i); if (!n) return ''; const tm = (M.td.times || {})[d.key + '|' + i]; return `<li${vis.has(i) ? ' class="mp-vis"' : ''}>${tm && tm.start ? tm.start + ' ' : ''}${msiTie(n.ic, escH(n.n))}${vis.has(i) ? ' ✓' : ''}</li>`; }).filter(Boolean);
    const sv = o.sv ? svBtnHTML(svTlRoute(M.t.id, d.date)) : ''; if (!sch.length && !mine.length && !sv) return '';
    return `<div class="mp-day"><b>${tmFmt('day', d.date)}</b>${sv ? `<div class="sv-row">${sv}</div>` : ''}${sch.length || mine.length ? `<ul>${sch.join('')}${mine.join('')}</ul>` : ''}</div>`; }).join('');
}
function renderMemoryScreen() { const ctl = ctlNS('memory');
  const id = memoryTrip, M = id && tripMemoryData(id), main = document.getElementById('main');
  if (!M) { main.innerHTML = '<div class="callout">הטיול לא נמצא.</div>'; return; }
  const t = M.t, th = (Object.values((M.snap && M.snap.dests) || {})[0] || {}).theme || ((DESTS[M.dests[0]] || {}).meta || {}).theme || {};
  const cancelled = t.archived && t.archived.reason === 'cancelled'; const live = !t.archived && ['during', 'before'].includes(tripState(t));
  // 10.3.0 (design-3, look.md "Full screens, part 2"): a cover hero (the trip's cover or a drawn landscape; "זיכרון · לקריאה בלבד"; the name,
  // dates · flags · who), three stat tiles, "עיון מלא" filled and "טיול על בסיסו" outlined; share and ⋯ sit in the screen's head
  const Dm = cancelled ? null : mementoData(id), flags = M.dests.map(d => destFlagMeta((M.snap && M.snap.dests && M.snap.dests[d]) || (DESTS[d] || {}).meta || {})).join('');
  const hero = `<div class="mem-hero" style="--mh:${th.primary || 'var(--primary)'};--ma:${th.accent || 'var(--favorite)'}">${tripCoverHTML(id)}<div class="mem-hero-in"><span class="mem-kicker">${cancelled ? msi('block', { size: 16 }) + 'בוטל' : t.archived ? msi('auto_stories', { size: 16 }) + 'זיכרון' + SEP + 'לקריאה בלבד' : (live ? '' : msi('auto_stories', { size: 16 })) + tripStateLine(t) /* built HTML, never escaped again: a trip in progress or upcoming brings its own line icon */}</span><h2 class="display"><span${tripNameAttr(t)}>${escH(String(t.name).split(' · ')[0])}</span></h2>
    <div class="mem-sub">${[t.start ? tmFmt('range', [t.start, t.end], { year: true }) : '', flags, t.travelers ? escH(t.travelers) : ''].filter(Boolean).join(SEP)}</div></div></div>`
    + (cancelled ? '' : `<div class="mem-tiles-w"><div class="dr-tiles mem-tiles${memRideTileHTML(Dm, id) ? ' mem-4' : ''}"><div class="dr-tile"><b>${t.start ? dayList(t.start, t.end).length : tripLen(t)}</b><small>ימים</small></div><div class="dr-tile"><b>${M.visited.length}</b><small>מקומות ש${TX.visited}</small></div><div class="dr-tile"><b>${Dm && Dm.walk ? fmtKm(Dm.walk, { num: true }) : '—'}</b><small>ק״מ ברגל</small></div>${memRideTileHTML(Dm, id)}</div></div>`); // ride-km: four tiles - two rows of two when narrow for their numbers (.mem-tiles-w)
  const acts = `<div class="mem-acts brow fill">${t.archived ? `<button class="btn-nav" id="memView" data-act="memory.memView" data-v="${escH(id)}">${msi('menu_book', { size: 18 })} עיון מלא</button>` : ''}<button class="btn-outline" id="memClone" data-act="memory.memClone">${msi('content_copy', { size: 18 })} טיול על בסיסו</button></div>`;
  { const e = screenTop(), tools = e && e.tab === 'memory' && e.el.querySelector('.screen-tools');
    if (tools) tools.innerHTML = `<button type="button" class="top-ic" id="memShare" data-act="memory.memShare" aria-label="שיתוף" title="שיתוף">${msi('share')}</button><button type="button" class="top-ic" id="memMore" data-act="memory.memMore" aria-label="עוד פעולות" title="עוד פעולות">${msi('more_vert')}</button>`; }
  let html = hero + acts + ppMemRowHTML(t, entGo()); // passport-book (Q3): "החותמות של הטיול בדרכון"; 5.15.0 (ד6): no "🖼️ זיכרון" title - the colored card says it
  if (!cancelled) {
    if (typeof memorySection === 'function') html += memorySection(M, 'top');
    html += memMapBlockHTML(M); // 4.36.0: a live map
    if (typeof memorySection === 'function') html += memorySection(M, 'middle');
    const plan = planAsItWasHTML(M, { sv: true });
    if (plan) html += `<div class="accordion">${accHTML('mem-plan', msi('calendar_month', { size: 20 }) + ' התוכנית כפי שהייתה', `<div class="mem-plan">${plan}</div>`, false)}</div>`;
    if (typeof memorySection === 'function') html += memorySection(M, 'bottom');
  } else html += `<div class="callout">הטיול סומן כבוטל. התוכנית והסימונים שלו נשמרו, ו-${msi('undo', { cls: 'msi-in' })} פתיחה מחדש מחזירה אותו.</div>`;
  main.innerHTML = html;
  ctl.memView = el => enterArchiveView(el.dataset.v); // G139: the button carries its own trip
  ctl.memClone = () => openTripEditor(null, { base: id });
  ctl.memShare = () => openShareChoice(id);
  ctl.memMore = () => openTripActions(id);
  
  if (typeof memorySectionCtl === 'function') memorySectionCtl(M);
  if (!cancelled) initMemMap(M);
}
ctlActs('memory', ['memClone', 'memMore', 'memShare', 'memView']);

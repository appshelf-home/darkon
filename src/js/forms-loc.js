// ================= THE LOCATION BLOCK (split from forms.js by size in 11.32.0, task place-find; nothing reworded but that task's changes) =================
// ---- location: search (placeSearch), 📍, 🔗, the small map with the pin in the middle, ⛶ - one block for the place, the
// destination's center (zoom: 'area') and the draft. Value: { lat, lng } or null; o.onPick(r) gets a found name / address.
function fmLoc(F, id, o) { o = o || {}; fmReg(F, id, 'loc', o.value || null, o); F.locs = F.locs || {}; F.locs[id] = { url: o.mapsUrl || '', gid: o.gid || null, gidOn: o.gid !== undefined }; // 11.22.0 (place-gid-1): gid - the Google id record the save writes (place-gid.js)
  if (o.gid !== undefined && !F.extra) F.extra = () => F.locs[id].gid; // a new id or an unlink is a change of the form (the unsaved-change guard)
  // 11.20.0 (place-search-upgrade): the field is a host of the one place search - typing pauses ask Photon, "חיפוש" / Enter both services
  // 11.28.0 (area-search): o.kind 'area' (the destination's centre) - an area search, with the full-screen pick from its ⛶; a picked area's
  // extent waits in F.locs[id].ext for the small map to fit (fmLocShow), and its country code and kind go to o.onPick
  const ps = F.locs[id].ps = psHost({ kind: o.kind, box: () => { const G = fmLive(F); return G && fmQ(G, `[data-fmres="${id}"]`); }, near: () => { const G = fmLive(F), m = fmLocMaps[id]; return o.near ? o.near(G) : (m && m.map ? m.map.getCenter() : undefined); },
    pick: x => { const G = fmLive(F); if (G && G.locs && G.locs[id]) G.locs[id].ext = x.area ? x.ext : null; fmLocSet(G, id, x.coord, { name: x.name, addr: [x.name, x.sub].filter(Boolean).join(', '), city: x.city, country: x.country, cc: x.cc, area: x.area }, true); },
    map: MAP_AVAILABLE ? () => { const G = fmLive(F), b = G && fmQ(G, `[data-act="fm.locFs"][data-v="${id}"]`); if (b) b.click(); } : null, ret: F.locs[id].ret = o.ret ? () => psFormRet(fmLive(F), o.ret, id) : null }); // 11.21.0 (Q3): with the whole form
  return `<div class="sh-field fm-f fm-loc" data-fmw="${id}">${fmLabel(o)}
    <div class="brow tight pe-loc-actions">${o.gps === false ? '' : `<button type="button" class="chip" data-act="fm.locMe" data-v="${id}">${msi('my_location', { size: 18 })} המיקום שלי</button>`}${o.link === false ? '' : `<button type="button" class="chip" data-act="fm.locLink" data-v="${id}">${msi('link', { size: 18 })} הדבקה מגוגל מפות</button>`}</div>
    <div class="pe-search"><span class="clear-wrap"><input type="text" data-fmq="${id}" data-ps="${ps}" placeholder="${fmEsc(o.placeholder || 'שם, כתובת או קואורדינטות')}" data-act-enter="fm.locGo"><button type="button" class="field-clear" data-act="fm.locX" data-v="${id}" aria-label="ניקוי" hidden>✕</button></span><button type="button" class="btn-nav" data-act="fm.locGo" data-v="${id}">חיפוש</button></div>
    <div data-fmlink="${id}" hidden><textarea rows="2" data-fmlinkt="${id}" placeholder="הדביקו כאן קישור או טקסט ששותף מ-Google Maps" dir="auto"></textarea><button type="button" class="btn-nav" data-act="fm.locLinkGo" data-v="${id}">קריאת הקישור</button></div>
    <div class="fm-locres" data-fmres="${id}"></div>
    ${MAP_AVAILABLE ? `<div class="pe-map fm-map" id="fmMap_${id}"></div><small class="sh-hint">${o.zoom === 'area' ? 'מזיזים את המפה עד שמרכז היעד מתחת לסיכה' : 'לחיצה על המפה או הזזה שלה מזיזה את המיקום'}${SEP}בטלפון: אצבע אחת גוללת את הטופס, שתי אצבעות מזיזות ומגדילות את המפה</small>` : ''}
    <small class="sh-hint fm-pickchk" data-fmpick="${id}" hidden>${tipText('wrong.pick')}</small><div class="pe-coord" data-fmcoord="${id}"></div>${fmHint(o)}${fmErrSlot(id)}</div>`; }
const fmLocMaps = {};
// place-find (Q3): the line under the map is only where - "קישור נשמר" left it (the details' "פתיחה בגוגל מפות" row says it)
function fmLocShow(F, id) { const v = F.vals[id], o = F.conf[id] || {}, el = fmQ(F, `[data-fmcoord="${id}"]`), L0 = F.locs[id];
  if (el) { if (v) el.innerHTML = `${msi('location_on', { cls: 'msi-in' })} <bdi dir="ltr">${(+v.lat).toFixed(5)}, ${(+v.lng).toFixed(5)}</bdi>`; else el.textContent = o.noneText || 'עוד לא נבחר מיקום'; } // 10.15.0 (design-review Q11): line icons; the coordinates left to right
  const m = fmLocMaps[id]; if (m && m.map && v && !m.own) { const ext = L0 && L0.ext, ez = ext ? psExtZoom(m.map, v, ext) : null; if (L0) L0.ext = null; // 11.28.0: a picked area fits its extent
    m.map.setView([v.lat, v.lng], ez != null ? ez : Math.max(m.map.getZoom(), o.zoom === 'area' ? 11 : 16)); const h = m.box && m.box.querySelector('.pe-hint'); if (h) h.remove(); const pin = m.box && m.box.querySelector('.fsp-pin'); if (pin) pin.classList.remove('dim'); } }
// place-find (Q1): a point found by a link's name or address says what was found - "נמצא במפה: <name> · <street, city> · כדאי לוודא על המפה"
// (in place of the plain "כדאי לוודא על המפה")
function fmLocFound(F, id, f) { const box = fmQ(F, `[data-fmres="${id}"]`); if (box) box.innerHTML = psFoundHTML(f); fmLocPickNote(F, id, false); }
// place-find (Q1 (c)): no point - the small map (and the full-screen pick from it) opens on the address's street; the value stays empty
function fmLocView(F, id, v) { const L0 = F.locs[id]; if (!L0 || !v) return; L0.view = v; const m = fmLocMaps[id]; if (m && m.map && !F.vals[id]) m.map.setView([v.lat, v.lng], v.z || 16); }
function fmLocPickNote(F, id, on) { const n = fmQ(F, `[data-fmpick="${id}"]`); if (n) n.hidden = !on; } // 11.17.0 (content-may-be-wrong, Q4): only right after a search pick
function fmLocSet(F, id, c, r, fromSearch) { const p0 = F.vals[id], same = !!(p0 && c && Math.abs(p0.lat - c.lat) + Math.abs(p0.lng - c.lng) < 1e-6);
  F.vals[id] = c ? { lat: +c.lat, lng: +c.lng } : null; if (fromSearch || !same) fmLocPickNote(F, id, !!fromSearch); fmLocShow(F, id); if (r && F.conf[id].onPick) { try { F.conf[id].onPick(r, F); } catch (e) {} } fmFieldChanged(F, id); } // 11.17.0: the small map settling on the picked point is not another way
function fmLocStart(F, id) { const o = F.conf[id] || {}; fmLocShow(F, id); if (!MAP_AVAILABLE) return;
  setTimeout(() => { const box = document.getElementById('fmMap_' + id); if (!box || !box.isConnected) return; if (!leafGate(box, () => fmLocStart(F, id))) return; /* 11.29.0 (launch-fast) */ const v = F.vals[id], area = o.zoom === 'area', vw = !v && F.locs[id] && F.locs[id].view; // place-find (Q1 (c)): a view to open on
    const mob = !!(L.Browser && L.Browser.mobile), c0 = v ? [v.lat, v.lng] : vw ? [vw.lat, vw.lng] : (o.center || (curDest() && curDest().meta.center) || [0, 0]);
    const map = mapTool(box.id, { twoFinger: mob, leaflet: { dragging: !mob, touchZoom: mob ? false : 'center', scrollWheelZoom: 'center', zoomSnap: mob ? 0 : 1 } }).setView(c0, v ? (area ? 11 : 16) : vw ? (vw.z || 16) : (area ? 5 : 13));
    const M = fmLocMaps[id] = { map, box, own: false };
    box.insertAdjacentHTML('beforeend', `<div class="fsp-pin pe-pin${v ? '' : ' dim'}" aria-hidden="true">${msi('location_on', { fill: true })}</div>${v ? '' : `<div class="fsp-hint pe-hint">מזיזים את המפה או לוחצים על המקום</div>`}`);
    const fromMap = () => { const ll = map.getCenter(); M.own = true; fmLocSet(F, id, { lat: ll.lat, lng: ll.lng }); M.own = false; };
    map.on('dragend', fromMap); map.on('zoomend', () => { if (F.vals[id] && !map._gest) fromMap(); });
    map.on('click', e => { map.panTo(e.latlng); M.own = true; fmLocSet(F, id, { lat: e.latlng.lat, lng: e.latlng.lng }); M.own = false; });
    const fb = document.createElement('button'); fb.type = 'button'; fb.className = 'fs-btn'; fb.innerHTML = FS_ICON; fb.dataset.act = 'fm.locFs'; fb.dataset.v = id; fb.setAttribute('aria-label', 'בחירת מיקום במסך מלא'); fb.title = 'מסך מלא';
    box.appendChild(fb); mapCtl(fb); addLayerBtn(box); // 10.10.0 (design-maps, gap 46): a small map in a form - full screen and the map type only ("מה יש כאן" lives in the full-screen picker)
    setTimeout(() => map.invalidateSize(), 250); }, 60); }
act('fm.locFs', c => { const F = fmOf(c.el); if (!F) return; const id = c.v, v = F.vals[id], m = fmLocMaps[id], o = F.conf[id];
  const s = v || (m && m.map && m.map.getCenter()) || { lat: (o.center || curDest().meta.center)[0], lng: (o.center || curDest().meta.center)[1] };
  openPick({ how: 'btn', has: !!v, start: [s.lat, s.lng], zoom: v ? (o.zoom === 'area' ? 12 : 17) : 15, kind: o.kind, ret: F.locs[id].ret || null, onPick: r => { const G = fmLive(F); if (G && G.locs && G.locs[id]) G.locs[id].ext = r.area ? r.ext : null; fmLocSet(G, id, r.coord, r); } }); return 'quiet'; }); // 11.28.0: kind, the area's extent
act('fm.locMe', async c => { const F = fmOf(c.el); if (!F) return; const b = c.el, back = btnBusy(b, 'מאתר…'); const pos = await requestUserLocation(); back(); // final-review-fixes (finding 20): the chip keeps its line icon
  if (pos) fmLocSet(F, c.v, pos); else showToast('לא התקבל מיקום (צריך הרשאת מיקום, באפליקציה המותקנת)'); });
act('fm.locLink', c => { const F = fmOf(c.el); if (!F) return; const b = fmQ(F, `[data-fmlink="${c.v}"]`); if (b) { b.hidden = !b.hidden; if (!b.hidden) reveal(b); } return 'quiet'; }); // 10.6.0: the link field comes into view; focus on its button, the keyboard waits for a tap
act('fm.locX', c => { const F = fmOf(c.el); if (!F) return; const q = fmQ(F, `[data-fmq="${c.v}"]`); q.value = ''; c.el.hidden = true; const H = PS_HOSTS[F.locs[c.v].ps]; if (H) H.st = null; fmQ(F, `[data-fmres="${c.v}"]`).innerHTML = ''; q.focus(); return 'quiet'; });
// a Google Maps link, shared or pasted (11.20.0, Q9): the name (when the name field is empty), the place's own point, the link that opens exactly that place
// phone-round-4b-fixes P1 (G93): pre - the link already read by the share (psShareIn), so "מקום חדש" does not read it again
// 11.46.0 (phone-round-4c-fixes P3): the read waits with the "in progress" indicator (waitOn) - the bar under the window's head, the stage
// line ("קוראים את הקישור…", then "מחפשים את המקום…" when the point is looked for by the link's name), the small map dimmed with a ring;
// o.onRead(r) === true - the share found a place already in the trip and closed the window (psShareKnown)
async function fmLocLinkRead(F, id, text, pre, o) { const box0 = fmQ(F, `[data-fmres="${id}"]`), sh = box0 && box0.closest('.sheet');
  const W = pre === undefined ? waitOn(sh, { head: sh && sh.querySelector(':scope > .sheet-head, :scope > .fm-head, :scope > h3'), line: box0, map: fmQ(F, `#fmMap_${id}`), stage: 'קוראים את הקישור' }) : null;
  let r; try { r = pre !== undefined ? pre : await psReadLink(text, { idOnly: !!(F.locs[id] && F.locs[id].relink), stage: () => W && W.stage('מחפשים את המקום'), known: o && o.known }); } finally { if (W) W.done(); }
  if (o && o.onRead && o.onRead(r) === true) return; F = fmLive(F); if (!F) return; const box = fmQ(F, `[data-fmres="${id}"]`), H = PS_HOSTS[F.locs[id].ps]; if (box) box.innerHTML = '';
  if (!r) { showToast('לא זיהיתי קישור'); return; } const L0 = F.locs[id];
  if (L0.relink) { fmGidLinkRead(F, id, r); return; } // 11.22.0 (Q8 (3)): relink - the id only; the location and the name stay (place-find Q3: in the details' row)
  if (r.url) L0.url = r.url; if (r.rec && L0.gidOn) { L0.gid = gidNew(r.rec, 'user'); fmGidRow(F, id); } if (r.name && F.conf[id].onPick) F.conf[id].onPick({ name: r.name }, F);
  if (r.coord) { fmLocSet(F, id, r.coord, null, true); const b = fmQ(F, `[data-fmlink="${id}"]`); if (b) b.hidden = true; if (r.found) fmLocFound(F, id, r.found); return; }
  if (r.view) fmLocView(F, id, r.view); // place-find (Q1 (c)): the map opens on the address's street - a view only, no point kept
  fmLocShow(F, id); if (box) box.innerHTML = `<small class="ps-line">${(r.rec || r.name) && !r.unread ? PS_NO_POINT_G : PS_NO_POINT}</small>${H && H.map ? `<div class="brow tight ps-end"><button type="button" class="chip" data-act="ps.map" data-v="${H.id}">${msi('pin_drop', { size: 18 })} לבחור על המפה</button></div>` : ''}`; }
// 11.22.0 (place-gid-1, Q8 (2)-(3)): an existing place's link to Google Maps in its editor - relink (the paste field in relink mode: only
// the id is read, the location does not move) and unlink (the record becomes unlinked, off); a place with no id: the same relink. Written
// on save, undone by the standard. The row keeps its state across Google Maps (psKeep: gids).
// place-find (Q3; decisions/2026-11-20-place-from-google-link.md): the row is not part of "where" - it lives in the details section
// (fmGidField), worded by what it does: "פתיחה בגוגל מפות: מקושר ✓ · לשנות · לבטל"; its own paste field and line, under it
function fmGidField(F, id) { return F.locs && F.locs[id] && F.locs[id].gidOn ? `<div class="sh-field fm-gid" data-fmgw="${id}"><div class="fm-gidrow" data-fmgid="${id}">${fmGidRowHTML(F, id)}</div>
    <div data-fmglink="${id}" hidden><textarea rows="2" data-fmglinkt="${id}" placeholder="הדביקו כאן קישור למקום מגוגל מפות - המיקום לא זז" dir="auto"></textarea><button type="button" class="btn-nav" data-act="fm.gidGo" data-v="${id}">קריאת הקישור</button></div>
    <div class="fm-locres" data-fmgres="${id}"></div></div>` : ''; }
function fmGidRowHTML(F, id) { const L0 = F.locs[id] || {}, g = L0.gid, on = !!(g && (g.id || g.cid));
  const relink = `<button type="button" class="link-btn" data-act="fm.gidRelink" data-v="${id}">${on ? 'לשנות' : 'לקשר'}</button>`;
  return `<small class="sh-hint">${msi('map', { cls: 'msi-in' })} פתיחה בגוגל מפות: ${on ? `מקושר ✓${SEP}${relink}${SEP}<button type="button" class="link-btn" data-act="fm.gidOff" data-v="${id}">לבטל</button>` : `${g && g.off ? 'הקישור בוטל' : 'לא מקושר'}${SEP}${relink}`}</small>`; }
function fmGidRow(F, id) { const w = fmQ(F, `[data-fmgid="${id}"]`); if (w) w.innerHTML = fmGidRowHTML(F, id); }
// a link read in relink mode: only Google's id, into the row; its paste field closes when an id was found
function fmGidLinkRead(F, id, r) { const L0 = F.locs[id], g = r && gidNew(r.rec, 'user'), box = fmQ(F, `[data-fmgres="${id}"]`);
  if (g) { L0.gid = g; fmGidRow(F, id); [`[data-fmglink="${id}"]`, `[data-fmlink="${id}"]`].forEach(k => { const b = fmQ(F, k); if (b) b.hidden = true; }); }
  if (box) box.innerHTML = `<small class="ps-line">${g ? 'יקושר למקום מהקישור בשמירה' : 'בקישור הזה אין את המזהה של המקום בגוגל'}</small>`; }
act('fm.gidRelink', c => { const F = fmOf(c.el); if (!F) return; const L0 = F.locs[c.v]; L0.relink = true; const b = fmQ(F, `[data-fmglink="${c.v}"]`);
  if (b) { b.hidden = false; reveal(b); }
  const box = fmQ(F, `[data-fmgres="${c.v}"]`), H = PS_HOSTS[L0.ps]; if (box && H) box.innerHTML = `<small class="ps-line">מוצאים את המקום בגוגל מפות ומשתפים אותו לדרכון, או מדביקים את הקישור כאן${SEP}<a class="link-btn" href="${fmEsc(psGmUrl(fmGet(F, 'name') || ''))}" target="_blank" rel="noopener" data-act="ps.gm" data-v="${H.id}">לחפש בגוגל מפות</a></small>`;
  return 'quiet'; });
act('fm.gidOff', c => { const F = fmOf(c.el); if (!F) return; F.locs[c.v].gid = { src: 'user', at: todayStr(), off: true }; F.locs[c.v].relink = false; fmGidRow(F, c.v); const b = fmQ(F, `[data-fmglink="${c.v}"]`); if (b) b.hidden = true; const r = fmQ(F, `[data-fmgres="${c.v}"]`); if (r) r.innerHTML = ''; return 'quiet'; });
act('fm.gidGo', async c => { const F = fmOf(c.el); if (!F) return; const id = c.v, box = fmQ(F, `[data-fmgres="${id}"]`); if (box) box.innerHTML = waitLineHTML('קוראים את הקישור');
  const r = await psReadLink(fmQ(F, `[data-fmglinkt="${id}"]`).value, { idOnly: true }), G = fmLive(F); if (!G) return; if (!r) { const b2 = fmQ(G, `[data-fmgres="${id}"]`); if (b2) b2.innerHTML = ''; showToast('לא זיהיתי קישור'); return; } fmGidLinkRead(G, id, r); });
act('fm.locLinkGo', c => { const F = fmOf(c.el); if (!F) return; fmLocLinkRead(F, c.v, fmQ(F, `[data-fmlinkt="${c.v}"]`).value); return 'quiet'; });
async function fmLocSearch(F, id, q) { q = String(q || '').trim(); if (!q) { showToast('כתבו שם או כתובת'); return; }
  const cm = q.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/); // pasted coordinates
  if (cm && Math.abs(+cm[1]) <= 90 && Math.abs(+cm[2]) <= 180) { fmQ(F, `[data-fmres="${id}"]`).innerHTML = ''; fmLocSet(F, id, { lat: +cm[1], lng: +cm[2] }); return; }
  if (psSpecial(q)) { fmLocLinkRead(F, id, q); return; }
  psRun(F.locs[id].ps, q, 'explicit'); }
act('fm.locGo', c => { const F = fmOf(c.el); if (!F) return; const id = c.v || (c.el.dataset.fmq); fmLocSearch(F, id, fmQ(F, `[data-fmq="${id}"]`).value); return 'quiet'; });
document.addEventListener('input', e => { const q = e.target; if (!q || !q.dataset || q.dataset.fmq == null) return; const x = q.parentElement.querySelector('.field-clear'); if (x) x.hidden = !q.value; });

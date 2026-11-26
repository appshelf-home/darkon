// ================= map-side-view: THE SIDE VIEW'S WINDOW (special-maps group; split from route-map.js in diet-groups, 11.62.0 - each place's route, the heights and the "גובה" button stay there) =================
// ---- the window ----
act('side.open', c => openSideView(c.v));
function openSideView(key) { const R = SV.routes[key]; if (!R) return; layerNote(openSideView, arguments); const sheet = document.getElementById('sheet');
  sheet.innerHTML = `${fmHead(`${msiT('landscape', 'גובה')}${SEP}${nameB(R.name)}`, 'svClose')}<div class="sv-map" id="svMap"></div><div class="sv-body" id="svBody" data-sv="${escH(key)}"></div>
    <p class="sh-hint sv-cr">${[svcCredit('openmeteo', { as: 'elev' })].concat((R.via || []).map(p => svcCredit(p))).join(SEP)}</p>`;
  openSheet('openSideView'); svMap(R); svFill(R); }
function svMap(R) { const box = document.getElementById('svMap'); SV.cur = null; if (!box || !MAP_AVAILABLE) { if (box) box.remove(); return; } if (!R.segs.length) return; // a drive's path still asked: the map comes with it
  if (!leafGate(box, () => { if (document.getElementById('svMap') === box) svMap(R); })) return;
  const map = mapTool('svMap'), all = [].concat(...R.segs); R.segs.forEach(g => L.polyline(g, { className: 'sv-line', weight: 4, interactive: false }).addTo(map));
  map.fitBounds(all, { padding: [24, 24], maxZoom: 16 }); SV.cur = { key: R.key, map, dot: null }; }
function svFill(R) { const box = document.getElementById('svBody'); if (!box || box.dataset.sv !== R.key) return;
  if (R.pending) { const w = SV.asked.has('p|' + R.key) || !svcOnline() ? null : R.want(); SV.asked.add('p|' + R.key);
    if (!w) { box.innerHTML = `<p class="sh-hint">${msi(svcOnline() ? 'route' : 'cloud_off', { cls: 'msi-in' })} ${svcOnline() ? 'הדרך עוד לא נמצאה. אפשר לנסות שוב אחר כך.' : 'הדרך והגבהים יגיעו כשתהיה רשת.'}</p>`; return; }
    box.innerHTML = `<p class="sh-hint sv-wait">מחפש את הדרך…</p>`;
    w.then(() => { const N = R.again && R.again(); if (!N || N.pending || document.getElementById('svBody') !== box) { if (document.getElementById('svBody') === box) box.innerHTML = `<p class="sh-hint">${warnIc()} הדרך לא נמצאה, ולכן אין גבהים לאורכה.</p>`; return; }
      SV.routes[N.key] = N; svMap(N); svFill(N); }); return; }
  const S = svSample(R), h = svHeights(S);
  if (h) { svDraw(box, S, h); svRefreshBtns(R.key); return; }
  if (SV.asked.has(R.key)) { box.innerHTML = `<p class="sh-hint">${warnIc()} הגבהים לא התקבלו מהשירות. אפשר לנסות שוב אחר כך.</p>`; return; }
  if (!svcOnline()) { box.innerHTML = `<p class="sh-hint">${msi('cloud_off', { cls: 'msi-in' })} הגבהים יגיעו כשתהיה רשת. אחרי הפעם הראשונה הם נשמרים, וגם בלי רשת הם כאן.</p>`; return; }
  SV.asked.add(R.key); box.innerHTML = `<p class="sh-hint sv-wait">מביא את הגבהים…</p>`;
  elevMany(S).then(() => { svRefreshBtns(R.key); svFill(R); }); }
// the chart: distance along (left to right, as every chart) and height up; labels in the text's size, the height grows with it
// along-time-field (G121): the labels are right-to-left text (their unit is Hebrew; .sv-lab says so), so each is placed by the edge that
// sits at x - 'r' its right edge, 'l' its left; the start's room is measured from the widest height label, so it never reaches the line
function svDraw(box, S, h, padL) { const st = svStats(S, h), em = parseFloat(getComputedStyle(box).fontSize) || 16, W = Math.max(240, Math.round(box.clientWidth || 320)), H = Math.round(em * 8.5);
  const pl = padL || Math.round(em * 3.6), pr = Math.round(em * .6), pt = Math.round(em * .8), pb = Math.round(em * 1.6), iw = W - pl - pr, ih = H - pt - pb;
  let lo = Math.min(...h), hi = Math.max(...h); if (hi - lo < 20) { const m = (hi + lo) / 2; lo = m - 10; hi = m + 10; }
  const X = d => pl + (st.km ? d / st.km : 0) * iw, Y = v => pt + (1 - (v - lo) / (hi - lo)) * ih, P = i => `${X(S[i].d).toFixed(1)},${Y(h[i]).toFixed(1)}`;
  const line = S.map((s, i) => P(i)).join(' '), steep = st.steep ? S.slice(st.steep.i, st.steep.j + 1).map((s, k) => P(st.steep.i + k)).join(' ') : '';
  const lab = (x, y, t, edge, k) => `<text class="sv-lab"${k ? ` data-sv="${escH(k)}"` : ''} x="${(+x).toFixed(1)}" y="${(+y).toFixed(1)}" text-anchor="${edge === 'r' ? 'start' : 'end'}">${escH(t)}</text>`;
  box.innerHTML = `<div class="sv-read" id="svRead" aria-live="polite">${svReadHTML(S, h, st.top)}</div>
    <svg class="sv-chart" id="svChart" dir="ltr" width="${W.toFixed(0)}" height="${H.toFixed(0)}" viewBox="0 0 ${W} ${H}" role="img" aria-label="גובה לאורך הדרך">
      <line class="sv-axis" x1="${pl.toFixed(0)}" y1="${(pt + ih).toFixed(0)}" x2="${(pl + iw).toFixed(0)}" y2="${(pt + ih).toFixed(0)}"/>
      ${lab(pl - em * .5, pt + em * .35, fmtM(hi), 'r', 'h')}${lab(pl - em * .5, pt + ih, fmtM(lo), 'r', 'h')}${lab(pl, H - em * .3, '0', 'l')}${lab(pl + iw, H - em * .3, fmtKm(st.km), 'r')}
      <polygon class="sv-area"/><polyline class="sv-path"/>${steep ? '<polyline class="sv-steep"/>' : ''}
      <circle class="sv-top" cx="${X(S[st.top].d).toFixed(1)}" cy="${Y(h[st.top]).toFixed(1)}" r="${(em * .3).toFixed(1)}"/>
      <line class="sv-cur" id="svCur" x1="0" y1="${pt.toFixed(0)}" x2="0" y2="${(pt + ih).toFixed(0)}" visibility="hidden"/><circle class="sv-dot" id="svDot" r="${(em * .35).toFixed(1)}" visibility="hidden"/>
    </svg>
    <div class="tags sv-stats"><span>${msiT('north_east', 'עלייה ' + fmtM(st.up))}</span><span>${msiT('south_east', 'ירידה ' + fmtM(st.down))}</span><span>${msiT('landscape', 'הכי גבוה ' + fmtM(st.topH))}</span>${st.steep ? `<span class="sv-st">${msiT('warning', `הכי תלול ${Math.round(st.steep.g * 100)}% (${st.steep.up ? 'עלייה' : 'ירידה'})`)}</span>` : ''}</div>`;
  const svg = box.querySelector('#svChart'), need = Math.ceil(Math.max(0, ...[...svg.querySelectorAll('.sv-lab[data-sv="h"]')].map(t => t.getBBox().width)) + em * .8);
  if (!padL && need > pl) return svDraw(box, S, h, need);
  const pts = (q, v) => { const e = svg.querySelector(q); if (e) e.setAttribute('points', v); }; // the lines' numbers set on the drawn elements
  pts('.sv-area', `${pl},${pt + ih} ${line} ${pl + iw},${pt + ih}`); pts('.sv-path', line); pts('.sv-steep', steep);
  scrubGesture(svg, x => { const r = svg.getBoundingClientRect(), d = Math.max(0, Math.min(1, (x - r.left - pl * r.width / W) / (iw * r.width / W))) * st.km; let i = 0; S.forEach((s, k) => { if (Math.abs(s.d - d) < Math.abs(S[i].d - d)) i = k; }); svAt(S, h, i, X, Y); }); }
function svReadHTML(S, h, i) { return `${escH(fmtKm(S[i].d))}${SEP}${msiT('landscape', escH(fmtM(h[i])))}`; }
// a point of the chart: the cursor, the reading, the dot on the map
function svAt(S, h, i, X, Y) { const cur = document.getElementById('svCur'), dot = document.getElementById('svDot'), rd = document.getElementById('svRead'); if (!cur || !dot) return;
  const x = X(S[i].d).toFixed(1); cur.setAttribute('x1', x); cur.setAttribute('x2', x); cur.setAttribute('visibility', 'visible'); dot.setAttribute('cx', x); dot.setAttribute('cy', Y(h[i]).toFixed(1)); dot.setAttribute('visibility', 'visible');
  if (rd) rd.innerHTML = svReadHTML(S, h, i);
  const M = SV.cur; if (!M || M.map._removed) return; const ll = [S[i].lat, S[i].lng];
  if (M.dot) M.dot.setLatLng(ll); else M.dot = L.circleMarker(ll, { className: 'sv-mdot', radius: 7, weight: 3, fillOpacity: 1, interactive: false }).addTo(M.map);
  if (M.map.getBounds && !M.map.getBounds().contains(ll)) M.map.panTo(ll); }
// ================= END SIDE VIEW =================

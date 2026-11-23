// ================= TRIP WEATHER (4.17.0) =================
// The forecast follows the trip: each day by the stop where you sleep (a move day shows the city you leave and the one you
// reach), plus a row for a planned place far from it (over 25 km, or 500 m higher or lower; nearby ones share one row).
// From today on, a short line per day; tapping opens morning / afternoon / evening (by 🕐 חלקי היום), an hourly graph,
// sunrise, sunset, UV and what to wear. Days beyond the ~16-day forecast show a seasonal average from past years, with the
// date the real forecast arrives. Open-Meteo (forecast) and ERA5 archive (averages); kept on the device for offline.
const WX_DEF = { view: 'list', open: 'today', extra: 'rule', wind: 'kmh', feels: true };
function wxSet() { return { ...WX_DEF, ...(STATE.settings.weather || {}) }; }
function wxKey(c) { return (+c.lat).toFixed(2) + ',' + (+c.lng).toFixed(2); }
const WX_CODES = [[0, '☀️', 'בהיר'], [1, '🌤️', 'בהיר בעיקר'], [2, '⛅', 'מעונן חלקית'], [3, '☁️', 'מעונן'], [48, '🌫️', 'ערפל'], [57, '🌦️', 'טפטוף'], [67, '🌧️', 'גשם'], [77, '🌨️', 'שלג'], [82, '🌦️', 'ממטרים'], [86, '🌨️', 'ממטרי שלג'], [99, '⛈️', 'סופת רעמים']];
function wxIcon(code) { if (code == null) return '·'; const r = WX_CODES.find(x => code <= x[0]); return r ? r[1] : '·'; }
function wxText(code) { const r = WX_CODES.find(x => code <= x[0]); return r ? r[2] : ''; }
function wxWind(v) { if (v == null) return ''; return wxSet().wind === 'ms' ? Math.round(v / 3.6) + ' מ/ש' : Math.round(v) + ''; }
// 10.15.0 (design-review Q2): the condition stays a color emoji (the data); the marks that only label a field are line icons
function wxMk(n) { return msi(n, { cls: 'msi-in wx-mk' }); }
function wxWindHTML(v, gust) { if (v == null) return ''; const strong = v >= 40 || (gust || 0) >= 60; return `<span class="${strong ? 'wx-strong' : ''}">${wxMk('air')}${wxWind(v)}</span>`; }
function destCenterC(id) { const d = DESTS[id] || curDest(); return d && d.meta.center ? { lat: d.meta.center[0], lng: d.meta.center[1] } : null; }
function wxDayLocs(day) { // where the day's weather is for: [{ name, coord, role }]
  const vs = routeVisits(), date = day.date, out = [];
  const coordOf = v => v.coord || routeCoordOf(v.places[0]) || destCenterC(v.dest);
  const stay = vs.find(v => v.from <= date && date < v.to), leave = vs.find(v => v.to === date && v !== stay);
  if (leave && stay) { out.push({ name: leave.name, coord: coordOf(leave), role: 'leave' }); out.push({ name: stay.name, coord: coordOf(stay), role: 'arrive' }); }
  else if (stay) out.push({ name: stay.name, coord: coordOf(stay), role: 'sleep' });
  else if (leave) out.push({ name: leave.name, coord: coordOf(leave), role: 'leave' });
  if (!out.length) { const ds = destsOfDay(day.key), d = DESTS[ds[ds.length - 1]] || curDest(); out.push({ name: d.meta.name, coord: destCenterC(d.id), role: 'dest' }); }
  return out.filter(l => l.coord);
}
function wxPlanExtras(day, locs) { // planned places whose weather may differ: far away, or much higher/lower
  const mode = wxSet().extra; if (mode === 'none' || !locs.length) return [];
  const d = ensureDay(day.key), ids = [...d.morning, ...d.afternoon, ...d.evening, ...d.unassigned];
  const pts = [...ids.map(planItem), ...scheduleOf(day.date).map(s => s.placeId != null ? POINTS.find(p => p.id === s.placeId) : null)].filter(Boolean)
    .map(x => POINTS.find(p => p.id === x.id) || x).filter(p => routeCoordOf(p));
  const base = locs[locs.length - 1].coord, baseEl = knownElev(base);
  const far = pts.filter(p => { if (mode === 'keys' && !p.key) return false; const c = routeCoordOf(p);
    if (Math.min(...locs.map(l => distanceKm(l.coord, c))) > 25) return true;
    const e = knownElev(c); return baseEl != null && e != null && Math.abs(e - baseEl) >= 500; });
  const groups = []; // places near each other share one row, named by the ★ among them or the farthest
  far.forEach(p => { const c = routeCoordOf(p), g = groups.find(x => distanceKm(x.c, c) < 10); if (g) g.ps.push(p); else groups.push({ c, ps: [p] }); });
  return groups.map(g => { const lead = g.ps.find(p => p.key) || g.ps.slice().sort((a, b) => distanceKm(base, routeCoordOf(b)) - distanceKm(base, routeCoordOf(a)))[0];
    const c = routeCoordOf(lead); return { name: lead.name, coord: c, role: 'plan', km: Math.round(distanceKm(base, c)), el: knownElev(c), more: g.ps.length - 1 }; });
}
function wxDays() { const t = activeTripObj(), iso = todayStr(); if (!t.id || !TRIP_DAYS.length || t.end < iso) return [];
  return TRIP_DAYS.filter(d => d.date >= iso); }
async function elevMany(cs) { // heights for many points in one request (up to 100), kept with the others (service "גובה", ש5)
  const cache = elevCache(), need = uniqBy(cs.filter(Boolean), elevKey).filter(c => typeof cache[elevKey(c)] !== 'number').slice(0, 100);
  if (!need.length) return;
  const r = await omAsk('elev', need, elevKey, '', 'https://api.open-meteo.com/v1/elevation?', '', 5, j => { if (!j || !Array.isArray(j.elevation)) throw new Error('answer'); return j.elevation; });
  if (r.kind !== 'ok') return; const c2 = elevCache();
  need.forEach((c, i) => { if (typeof r.value[i] === 'number') c2[elevKey(c)] = Math.round(r.value[i]); }); regWrite('elev', c2);
}
// 9.1.1 (12ג-7): one wrapper for the Open-Meteo requests by many points (forecast, climate, height) around the services client
const uniqBy = (cs, kf) => [...new Map(cs.map(c => [kf(c), c])).values()];
const omDaily = j => { j = Array.isArray(j) ? j : [j]; if (!j.some(x => x && x.daily)) throw new Error('answer'); return j; };
function omAsk(svc, need, kf, keyTail, base, rest, dec, parse) {
  return svcAsk(svc, { key: need.map(kf).join(';') + keyTail, build: () => ({ url: base + `latitude=${need.map(c => (+c.lat).toFixed(dec)).join(',')}&longitude=${need.map(c => (+c.lng).toFixed(dec)).join(',')}` + rest }), parse });
}
async function wxFetchForecast(cs) { // service "תחזית" (ש8): asked again after 3 hours, dropped after 4 days; offline - what is kept, with its time
  const cache = regRead('wx'), now = Date.now();
  Object.keys(cache).forEach(k => { if (now - cache[k].at > SERVICES.forecast.keep.drop * DAY_MS) delete cache[k]; });
  const need = uniqBy(cs.filter(Boolean), wxKey).filter(c => !svcFresh('forecast', cache[wxKey(c)]));
  if (need.length) {
    const r = await omAsk('forecast', need, wxKey, '', 'https://api.open-meteo.com/v1/forecast?', '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max,wind_gusts_10m_max,uv_index_max,sunrise,sunset'
        + '&hourly=temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_gusts_10m&timezone=auto&forecast_days=16', 3, omDaily);
    if (r.kind === 'ok') { const c2 = regRead('wx'); r.value.forEach((x, i) => { if (x && x.daily && need[i]) c2[wxKey(need[i])] = { at: Date.now(), daily: x.daily, hourly: x.hourly }; }); regWrite('wx', c2); return c2; }
  }
  return cache;
}
// 7.1.0 (ש4): a forecast that could not be refreshed is still shown, with the time it is from; 11.14.0 (phone-round-1-fixes P24, G33): also
// any forecast shown without network (it cannot be refreshed now), and in the overview's today card and a destination's strip too
function wxAgeNote(fc, cs) { const ats = cs.map(c => (fc[wxKey(c)] || {}).at).filter(Boolean); if (!ats.length) return ''; const at = Math.min(...ats);
  if (Date.now() - at < SERVICES.forecast.keep.ok * DAY_MS && !svcNetDown()) return ''; return `התחזית מ-${tmPhoneDate(at) === tmPhoneDate() ? tmFmt('stamp', at) : tmFmt('dayN', tmPhoneDate(at)) + ' ' + tmFmt('stamp', at)}`; }
async function wxFetchClimate(cs, dates) { // seasonal averages: the same dates in the last 3 years (ERA5), kept for good (service "אקלים לתאריכים")
  const cache = regRead('clim'); if (!dates.length) return cache;
  const lo = isoAdd(dates[0], -3), hi = isoAdd(dates[dates.length - 1], 3), y0 = +lo.slice(0, 4), lastY = +tmFmt('year', tmPhoneDate()) - 1;
  const uniq = uniqBy(cs, wxKey);
  for (let back = 1; back <= 3; back++) {
    const need = uniq.filter(c => { const e = cache[wxKey(c)] || {}; return !e['y' + back + lo + hi]; }); if (!need.length) continue;
    let s = isoAdd(lo, -365 * back), e = isoAdd(hi, -365 * back); if (+e.slice(0, 4) > lastY) { s = isoAdd(s, -365); e = isoAdd(e, -365); }
    const r = await omAsk('climate', need, wxKey, '' + back + lo + hi, 'https://archive-api.open-meteo.com/v1/archive?', `&start_date=${s}&end_date=${e}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max&timezone=auto`, 3, omDaily);
    if (r.kind !== 'ok') { if (r.kind === 'offline') break; continue; }
    r.value.forEach((x, i) => { if (!x || !x.daily || !need[i]) return; const k = wxKey(need[i]); cache[k] = cache[k] || {}; cache[k]['y' + back + lo + hi] = x.daily; });
  }
  regWrite('clim', cache); return cache;
}
function wxAvg(clim, c, iso) { // mean of the same calendar days (±3) over the stored years
  const e = clim[wxKey(c)]; if (!e) return null; const md = iso.slice(5), acc = { tmax: [], tmin: [], rain: [], wind: [], yrs: [] };
  Object.values(e).forEach(d => (d.time || []).forEach((t, i) => { const diff = Math.abs(daysBetween('2001-' + md, '2001-' + t.slice(5)));
    if (diff <= 3) { acc.yrs.push(+t.slice(0, 4)); acc.tmax.push(d.temperature_2m_max[i]); acc.tmin.push(d.temperature_2m_min[i]); acc.rain.push(d.precipitation_sum[i]); acc.wind.push(d.wind_speed_10m_max[i]); } }));
  const m = a => { const v = a.filter(x => typeof x === 'number'); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
  if (!acc.tmax.length) return null;
  const y1 = Math.min(...acc.yrs), y2 = Math.max(...acc.yrs);
  return { tmax: m(acc.tmax), tmin: m(acc.tmin), rainDays: Math.round(100 * acc.rain.filter(x => x >= 1).length / acc.rain.length), wind: m(acc.wind), yrs: y1 === y2 ? String(y1) : y1 + '–' + y2 };
}
function wxDaily(fc, c, iso) { const e = fc[wxKey(c)]; if (!e || !e.daily) return null; const i = e.daily.time.indexOf(iso); if (i < 0) return null;
  const D = e.daily; return { code: D.weather_code[i], tmax: D.temperature_2m_max[i], tmin: D.temperature_2m_min[i], pop: D.precipitation_probability_max[i], rain: D.precipitation_sum[i],
    wind: D.wind_speed_10m_max[i], gust: D.wind_gusts_10m_max[i], uv: D.uv_index_max[i], rise: (D.sunrise[i] || '').slice(11, 16), set: (D.sunset[i] || '').slice(11, 16) }; }
function wxHours(fc, c, iso) { const e = fc[wxKey(c)]; if (!e || !e.hourly) return []; const H = e.hourly, out = [];
  H.time.forEach((t, i) => { if (t.slice(0, 10) === iso) out.push({ h: +t.slice(11, 13), t: H.temperature_2m[i], f: H.apparent_temperature[i], pop: H.precipitation_probability[i], rain: H.precipitation[i], code: H.weather_code[i], wind: H.wind_speed_10m[i], gust: H.wind_gusts_10m[i] }); });
  return out; }
function wxParts(hours) { const st = STATE.settings, me = parseInt(st.morningEnd || '12', 10), ae = parseInt(st.afternoonEnd || '17', 10);
  const sets = [[wxMk('wb_twilight') + ' בוקר', 6, me], [wxMk('light_mode') + ' צהריים', me, ae], [wxMk('dark_mode') + ' ערב', ae, 24]];
  return sets.map(([l, a, b]) => { const hs = hours.filter(x => x.h >= a && x.h < b); if (!hs.length) return null;
    const avg = k => hs.reduce((s, x) => s + (x[k] || 0), 0) / hs.length, max = k => Math.max(...hs.map(x => x[k] || 0));
    return { l, t: Math.round(avg('t')), f: Math.round(avg('f')), pop: Math.round(max('pop')), rain: Math.round(hs.reduce((s, x) => s + (x.rain || 0), 0) * 10) / 10, wind: max('wind'), gust: max('gust'), code: Math.max(...hs.map(x => x.code || 0)) }; }).filter(Boolean); }
function wxWear(d, parts) { // what to wear: fixed rules on the forecast, works offline
  if (!d) return ''; const out = [], am = parts[0], noon = parts[1];
  if (d.tmin < 5) out.push('קר מאוד: מעיל חם, כובע וכפפות'); else if (d.tmin < 12) out.push('קר בבוקר ובערב: מעיל או פליז');
  if ((d.tmax - d.tmin >= 10) || (am && noon && noon.t - am.t >= 8)) out.push('הפרשים גדולים: שכבות');
  if (d.tmax >= 30) out.push('חם: בגדים קלים ומים');
  if ((d.wind || 0) >= 40 || (d.gust || 0) >= 60) out.push('רוח חזקה: מעיל רוח');
  if ((d.pop || 0) >= 50 || (d.rain || 0) >= 2) out.push('גשם: מעיל גשם או מטריה');
  if (d.code >= 71 && d.code <= 77 || d.code === 85 || d.code === 86) out.push('שלג: נעליים אטומות');
  if ((d.uv || 0) >= 6) out.push('UV גבוה: כובע וקרם הגנה');
  return wxMk('apparel') + ' ' + (out.length ? out.join(SEP) : 'נוח: לבוש קל');
}
function wxChart(hours) { const hs = hours.filter(x => x.h >= 6); if (hs.length < 3) return '';
  // final-review 18: three bands that never meet - the line with its two labels (the highest above its point, the lowest under it), then the hours' row;
  // a label at the chart's edge stays whole (moved in by half its width)
  const W = 300, H = 86, PB = 60, ts = hs.map(x => x.t), lo = Math.min(...ts) - 1, hi = Math.max(...ts) + 1, x = i => 8 + i * (W - 16) / (hs.length - 1), y = t => 16 + (PB - 16) * (1 - (t - lo) / (hi - lo || 1));
  const bars = hs.map((h, i) => h.pop >= 20 ? `<rect x="${x(i) - 4}" y="${PB + 2 - (h.pop / 100) * 24}" width="8" height="${(h.pop / 100) * 24}" style="fill:var(--wx-rain)" opacity=".75"/>` : '').join('');
  const iMax = ts.indexOf(Math.max(...ts)), iMin = ts.indexOf(Math.min(...ts));
  const lbl = (i, a) => { const s = Math.round(hs[i].t) + '°', hw = s.length * 3.2 + 1; return `<text class="wx-ct" x="${Math.max(hw, Math.min(W - hw, x(i)))}" y="${y(hs[i].t) + (a ? -5 : 12)}" font-size="10" text-anchor="middle" fill="currentColor">${s}</text>`; };
  const ticks = hs.map((h, i) => h.h % 3 === 0 ? `<text class="wx-ch" x="${x(i)}" y="${H - 2}" font-size="9" text-anchor="middle" fill="currentColor" opacity=".6">${tmFmt('hour', h.h)}</text>` : '').join('');
  return `<svg class="wx-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="טמפרטורה וגשם לפי שעות">${bars}<polyline points="${hs.map((h, i) => x(i) + ',' + y(h.t)).join(' ')}" fill="none" style="stroke:var(--wx-temp)" stroke-width="2"/>${lbl(iMax, true)}${iMin !== iMax ? lbl(iMin, false) : ''}${ticks}</svg>`;
}
const WX_ROLE = { sleep: 'ישנים כאן', leave: 'יוצאים', arrive: 'מגיעים, ישנים כאן', dest: '', plan: 'בתוכנית' };
let _wxData = null; // { fc, clim, days: [{ day, locs, extras }] } of the last load
// 5.15.0 (ד4): one "🌦️ מזג אוויר", closed by default - the 12 months on top, the trip's days under them
// 11.30.0 (wx-one-place; decisions 2026-11-19 · "מזג אוויר ולבוש" in one place, Q1-Q4): "מזג אוויר ולבוש" - the months, under each
// destination's row of months its words from Claude (its info section "מזג אוויר ולבוש", taken out of the info sections), then the days.
// The block shows whenever any of the three has content (a destination with words but no centre or no dates still shows its words).
function weatherBlockHTML() {
  const t = activeTripObj(), ds = t.id ? tripDests(t).map(id => DESTS[id]).filter(Boolean) : [curDest()].filter(d => d && d.id);
  const rows = ds.map(d => ({ d, k: t.id && Array.isArray(d.meta.center) ? d.meta.center.map(v => (+v).toFixed(2)).join(',') : '', words: wxWordsHTML(d) })).filter(r => r.k || r.words);
  const m = rows.some(r => r.k), hasW = rows.some(r => r.words), w = !!wxDays().length; if (!m && !hasW && !w) return '';
  const o = 'wx' in ACC_OPEN ? ACC_OPEN.wx : false, multi = rows.length > 1;
  const destRow = r => `<div class="mc-dest" data-mck="${r.k}">${multi ? `<b>${withFlag(destFlagMeta(r.d.meta), _escH(r.d.meta.name))}</b>` : ''}${r.k ? '<div class="mc-grid"></div>' : ''}${r.words}</div>`;
  return `<div class="accordion-item" data-open="${o}" id="wxItem"><button class="accordion-header t-wrap" data-act="acc.toggle" data-acc="wx">${accLead('🌦️ מזג אוויר ולבוש' + (w ? ' ' + tipI('info.wx', true) : ''))} <span class="accordion-arrow">${msi('expand_more')}</span></button><div class="accordion-body">`
    + (m ? `<div class="wx-sub"><b>רגיל לפי חודש</b></div><div id="mclimBox"><p class="sh-hint" id="mcHint"><span class="spin" aria-hidden="true"></span>טוען…</p>${rows.map(destRow).join('')}<p class="sh-hint" id="mcNote"></p></div>`
      : hasW ? `<div class="wx-words-box">${rows.map(destRow).join('')}</div>` : '')
    + (w ? `<div class="wx-sub"><b>בימי הטיול</b></div><div id="tripWeather"><p class="sh-hint"><span class="spin" aria-hidden="true"></span>טוען תחזית…</p></div><p class="sh-hint" style="font-size:var(--fs-micro)"><span id="wxAge"></span>${svcCredit('openmeteo')}${SEP}ממוצעים: ERA5 (Copernicus)</p>` : '')
    + (m && !w ? `<p class="sh-hint" style="font-size:var(--fs-micro)">${svcCredit('openmeteo')}${SEP}ERA5 (Copernicus)</p>` : '') + `</div></div>`; // 7.1.0 (ש6): the provider's attribution where its data is shown
}
// 11.30.0 (wx-one-place, Q2): Claude's weather section is found by its icon (data-icon="thermostat"), or - in a file older than the icons
// (Budapest) - by the weather hooks it carries (#weatherWidget, #sunWidget). The file is not changed: the section is only drawn elsewhere.
function wxSecOf(root) { return [...root.querySelectorAll('.accordion-item')].find(it => it.querySelector(':scope > .accordion-header[data-icon="thermostat"]') || it.querySelector('#weatherWidget, #sunWidget')) || null; }
const _wxWords = new Map();
function wxWordsBody(raw) { // the section's body, cleaned (cleanInfo), without the old widgets and the heading that named one; '' when no words are left
  raw = String(raw || ''); if (_wxWords.has(raw)) return _wxWords.get(raw); if (_wxWords.size > 40) _wxWords.clear();
  let out = ''; const f = htmlFrag(cleanInfo(raw, { out: true })), sec = wxSecOf(f), body = sec && sec.querySelector(':scope > .accordion-body');
  if (body) { body.querySelectorAll('#weatherWidget, #sunWidget').forEach(el => { const h = el.previousElementSibling; if (h && /^h[2-4]$/.test(h.localName)) h.remove(); el.remove(); });
    if (body.textContent.trim()) out = body.innerHTML.trim(); }
  _wxWords.set(raw, out); return out;
}
function wxWordsMonths(d) { // the months (0-11) the destination's paragraphs are matched against: its days in the trip, else the trip's; none = all open
  const t = activeTripObj(); if (!t.id || !t.start) return null;
  const days = TRIP_DAYS.filter(x => destsOfDay(x.key).includes(d.id)), all = days.length ? days : TRIP_DAYS;
  const ms = new Set(all.map(x => x.date).filter(iso => iso && !isVirt(iso)).map(iso => +iso.slice(5, 7) - 1)); return ms.size ? ms : null;
}
function wxWordsHTML(d) { // Q4: season paragraphs (div[data-months]) that meet the trip's months open, the others fold under "עונות אחרות"
  const html = wxWordsBody(d.info); if (!html) return '';
  const f = htmlFrag(html), seas = [...f.children].filter(el => el.localName === 'div' && el.hasAttribute('data-months')), ms = wxWordsMonths(d), other = [];
  seas.forEach((el, i) => el.setAttribute('data-wxi', i)); // 11.43.0 (info-complete item 7): each season's place, for wxSeasonTap
  if (ms) seas.forEach(el => { const own = el.getAttribute('data-months').split(/[\s,]+/).map(Number).filter(n => n >= 1 && n <= 12);
    if (own.length && !own.some(n => ms.has(n - 1))) { other.push(el); el.remove(); } });
  const box = document.createElement('div'); box.appendChild(f);
  return `<div class="wx-words">${box.innerHTML}${other.length ? `<div class="sub-accordion-item wx-other" data-open="false"><button type="button" class="sub-accordion-header t-wrap" data-act="acc.toggle"><span>עונות אחרות</span> <span class="accordion-arrow">${msi('expand_more')}</span></button><div class="sub-accordion-body">${other.map(el => el.outerHTML).join('')}</div></div>` : ''}</div>`;
}
// 11.43.0 (info-complete item 7; decisions 2026-11-20 · "מזג אוויר ולבוש": … the season follows the tapped month, Q2): a tap on a month
// tile (0-11) moves the destination's own season paragraphs - the one holding the month open, the others into "עונות אחרות" (closed), each
// in its place; no markup written (a fold that was not there is built of elements, its arrow cloned from the block's own). A text with no
// season paragraphs does not change; the default (wxWordsMonths) returns when drawn again.
function wxSeasonTap(w, m) { const seas = [...w.querySelectorAll('div[data-months]')].sort((a, b) => a.dataset.wxi - b.dataset.wxi), has = el => el.dataset.months.split(/[\s,]+/).map(Number).includes(m + 1);
  if (!seas.some(has)) return; let oth = w.querySelector(':scope > .wx-other');
  if (!oth) { const el = (t, c) => { const e = document.createElement(t); if (c) e.className = c; return e; }, b = el('button', 'sub-accordion-header t-wrap'), s = el('span'), a = document.querySelector('#wxItem .accordion-arrow');
    oth = el('div', 'sub-accordion-item wx-other'); b.type = 'button'; b.dataset.act = 'acc.toggle'; s.textContent = 'עונות אחרות'; b.append(s, ' '); if (a) b.append(a.cloneNode(true)); oth.append(b, el('div', 'sub-accordion-body')); w.appendChild(oth); }
  const body = oth.querySelector(':scope > .sub-accordion-body');
  seas.forEach(el => { if (has(el)) w.insertBefore(el, oth); else body.appendChild(el); });
  oth.hidden = !body.children.length; oth.dataset.open = 'false'; }
let _wxLoadP = null;
function loadTripWeather() { // one load at a time; a render during it just redraws from its result
  if (_wxLoadP) return _wxLoadP.then(() => { renderTripWeather(); fillTodayWx(); });
  _wxLoadP = loadTripWeather_().finally(() => { _wxLoadP = null; }); return _wxLoadP;
}
async function loadTripWeather_() {
  const box = document.getElementById('tripWeather'); if (!box && activeTab !== 'itinerary') return; // 4.21.0: the plan shows it in each day's line
  const days = wxDays(); if (!days.length) return;
  const iso = todayStr(), horizon = isoAdd(iso, 15);
  const base = days.map(day => ({ day, locs: wxDayLocs(day) }));
  await elevMany([].concat(...base.map(b => [...b.locs.map(l => l.coord), ...(() => { const d = ensureDay(b.day.key); return [...d.morning, ...d.afternoon, ...d.evening, ...d.unassigned].map(planItem).filter(Boolean).map(x => routeCoordOf(POINTS.find(p => p.id === x.id) || x)).filter(Boolean); })()])));
  base.forEach(b => { b.extras = wxPlanExtras(b.day, b.locs); });
  const near = base.filter(b => b.day.date <= horizon), far = base.filter(b => b.day.date > horizon);
  const fc = await wxFetchForecast([].concat(...near.map(b => [...b.locs, ...b.extras].map(l => l.coord))));
  const clim = await wxFetchClimate([].concat(...far.map(b => b.locs.map(l => l.coord))), far.map(b => b.day.date));
  _wxData = { fc, clim, days: base, horizon };
  renderTripWeather(); fillTodayWx(); fillPlanWeather();
}
function wxLineHTML(l, iso, fc, clim, horizon, sub) {
  const esc = escH;
  const role = WX_ROLE[l.role] || '', extra = l.role === 'plan' ? [l.km ? fmtKm(l.km) : '', l.el != null ? fmtM(l.el) : '', l.more ? '+' + l.more + ' מקומות' : ''].filter(Boolean).join(SEP) : '';
  const sm = [role, extra].filter(Boolean).join(SEP);
  if (iso <= horizon) { const d = wxDaily(fc, l.coord, iso);
    if (!d) return `<div class="wx-line${sub ? ' sub' : ''}"><span class="ic">·</span><span class="nm">${sub ? '↳ ' : ''}${esc(l.name)}${sm ? `<small>${sm}</small>` : ''}</span><span class="tt" dir="ltr"></span><span class="xx" dir="ltr">אין תחזית כרגע</span></div>`;
    return `<div class="wx-line${sub ? ' sub' : ''}"><span class="ic" title="${wxText(d.code)}">${wxIcon(d.code)}</span><span class="nm">${sub ? '↳ ' : ''}${esc(l.name)}${sm ? `<small>${sm}</small>` : ''}</span><span class="tt" dir="ltr">${Math.round(d.tmax)}°/${Math.round(d.tmin)}°</span><span class="xx" dir="ltr">${wxMk('water_drop')}${d.pop ?? 0}% ${wxWindHTML(d.wind, d.gust)}</span></div>`; }
  const a = wxAvg(clim, l.coord, iso);
  // 4.37.0: an estimate looks like one - ≈ and a lighter number, and it says which years it averages (not "תחזית מ-<date>")
  return `<div class="wx-line${sub ? ' sub' : ''}"><span class="ic">${a ? (a.rainDays >= 40 ? '🌦️' : '🌤️') : '·'}</span><span class="nm">${sub ? '↳ ' : ''}${esc(l.name)}${sm ? `<small>${sm}</small>` : ''}</span><span class="tt wx-est" dir="ltr">${a ? '≈' + Math.round(a.tmax) + '°/' + Math.round(a.tmin) + '°' : ''}</span><span class="xx">${a ? 'ממוצע ' + a.yrs : 'אין עוד נתונים'}</span></div>`;
}
function wxDetailHTML(b) {
  const { fc, horizon } = _wxData, iso = b.day.date; if (iso > horizon) return '';
  const main = b.locs[b.locs.length - 1], d = wxDaily(fc, main.coord, iso), hours = wxHours(fc, main.coord, iso), parts = wxParts(hours), feels = wxSet().feels;
  if (!d) return '';
  return `<div class="wx-det">${b.locs.length > 1 ? `<div class="wx-meta">${escH(main.name)}:</div>` : ''}<div class="wx-parts">${parts.map(p => `<div class="wx-part">${p.l}<b>${wxIcon(p.code)} ${p.t}°</b>${feels ? `מרגיש ${p.f}°<br>` : ''}${p.pop >= 20 ? `${wxMk('water_drop')}${p.pop}%${p.rain ? SEP + p.rain + ' מ״מ' : ''}<br>` : ''}${wxWindHTML(p.wind, p.gust)}${p.gust >= 50 ? ` (משבים ${wxWind(p.gust)})` : ''}</div>`).join('')}</div>
    ${wxChart(hours)}<div class="wx-meta">${wxMk('wb_twilight')} ${d.rise}${SEP}${wxMk('wb_twilight')} ${d.set}${d.uv != null ? `${SEP}UV ${Math.round(d.uv)}${d.uv >= 8 ? ' גבוה מאוד' : d.uv >= 6 ? ' גבוה' : ''}` : ''}${SEP}${wxText(d.code)}</div>
    <div class="wx-wear">${wxWear(d, parts)}</div></div>`;
}
// 11.30.0 (wx-one-place, Q1): a far day, opened, has the near day's sunrise and sunset line - computed on the phone (tmSun, by the zone), no network
function wxFarSunHTML(b) { const l = b.locs[b.locs.length - 1], D = DESTS[destsOfDay(b.day.key).slice(-1)[0]] || curDest(); if (!l || !l.coord) return '';
  const c = l.coord, lat = +(c.lat ?? c[0]), lng = +(c.lng ?? c[1]); if (!isFinite(lat) || !isFinite(lng)) return '';
  const t = tmSun(b.day.date, lat, lng, destZone(D)); return `<div class="wx-meta wx-sun">${wxMk('wb_twilight')} ${t.sunrise}${SEP}${wxMk('wb_twilight')} ${t.sunset}</div>`; }
// 11.31.0 (photo-frame item 7; decisions 2026-11-19 · Review of the 11.30.0 summary, Q1): a near day with no forecast day keeps its sunrise
// and sunset - the far day's computed line (offline) as the day's details, so the day opens to it
function wxSunDetHTML(b) { const s = b.day.date <= _wxData.horizon ? wxFarSunHTML(b) : ''; return s ? `<div class="wx-det wx-det-sun">${s}</div>` : ''; }
let _wxPick = null, _wxMore = false;
function renderTripWeather() {
  const box = document.getElementById('tripWeather'); if (!box || !_wxData) return;
  const { fc, clim, days, horizon } = _wxData, S = wxSet(), iso0 = todayStr();
  const wxArrow = msi('expand_more', { size: 18, cls: 'wx-arrow' }); // final-review-fixes (finding 17): the fold arrow of every folded row, not a text caret
  const dayHTML = (b, open) => { const iso = b.day.date, lbl = iso === iso0 ? 'היום' : iso === isoAdd(iso0, 1) ? 'מחר' : tmFmt('wd', iso);
    if (iso > horizon) { // 4.37.0: a far day folds into one line with its average, like a near day folds its details
      const a = wxAvg(clim, b.locs[b.locs.length - 1].coord, iso);
      return `<div class="wx-day far${open ? ' open' : ''}" data-wxd="${b.day.key}"><div class="wx-head" data-act="wx.day"><span><b>${lbl}</b>${SEP}${tmFmt('dayN', iso)}${b.locs.length > 1 ? SEP + b.locs.length + ' מקומות' : ''}</span><span class="wx-sum">${a ? `${a.rainDays >= 40 ? '🌦️' : '🌤️'} <span class="wx-est" dir="ltr">≈${Math.round(a.tmax)}°/${Math.round(a.tmin)}°</span>` : ''} ${wxArrow}</span></div><div class="wx-far-lines">
        ${b.locs.map(l => wxLineHTML(l, iso, fc, clim, horizon, false)).join('')}${b.extras.map(l => wxLineHTML(l, iso, fc, clim, horizon, true)).join('')}${wxFarSunHTML(b)}</div></div>`;
    }
    return `<div class="wx-day${open && iso <= horizon ? ' open' : ''}" data-wxd="${b.day.key}"><div class="wx-head" data-act="wx.day"><span><b>${lbl}</b>${SEP}${tmFmt('dayN', iso)}</span><span>${iso <= horizon ? wxArrow : ''}</span></div>
      ${b.locs.map(l => wxLineHTML(l, iso, fc, clim, horizon, false)).join('')}${b.extras.map(l => wxLineHTML(l, iso, fc, clim, horizon, true)).join('')}${wxDetailHTML(b) || wxSunDetHTML(b)}</div>`; };
  const openFirst = S.open === 'today';
  let h = '';
  if (S.view === 'picker') {
    const cur = days.find(b => b.day.key === _wxPick) || days[0]; _wxPick = cur.day.key;
    h = `<div class="wx-pick">${days.map(b => { const d = b.day.date <= horizon ? wxDaily(fc, b.locs[b.locs.length - 1].coord, b.day.date) : null;
      return `<button type="button" data-act="wx.pick" data-v="${b.day.key}" data-active="${b === cur}">${tmFmt('dayN', b.day.date)}<br>${d ? wxIcon(d.code) + ' ' + Math.round(d.tmax) + '°' : '·'}</button>`; }).join('')}</div><div class="wx-days">${dayHTML(cur, true)}</div>`;
  } else if (S.view === 'twodays' && days.length > 2 && !_wxMore) {
    h = `<div class="wx-days">${days.slice(0, 2).map((b, i) => dayHTML(b, openFirst && i === 0)).join('')}</div><button type="button" class="wx-more" id="wxMore" data-act="wx.more">עוד ${days.length - 2} ימים ${wxArrow}</button>`;
  } else h = `<div class="wx-days">${days.map((b, i) => dayHTML(b, openFirst && i === 0)).join('')}</div>`;
  const farB = days.find(b => b.day.date > horizon);
  if (farB) h = `<p class="sh-hint wx-est-note">≈ = ממוצע של שנים קודמות. תחזית אמיתית מ-${tmFmt('dayN', isoAdd(farB.day.date, -15))}.</p>` + h;
  box.innerHTML = h;
  { const ag = document.getElementById('wxAge'), note = wxAgeNote(fc, [].concat(...days.filter(b => b.day.date <= horizon).map(b => b.locs.map(l => l.coord)))); if (ag) ag.textContent = note ? note + SEP : ''; } // 7.1.0 (ש4): a forecast from memory says when it is from
  box.querySelectorAll('.wx-day .wx-line').forEach(x => { x.dataset.act = 'wx.day'; }); // a line opens its day too
}
act('wx.day', c => { const el = c.el.closest('.wx-day'); if (el.querySelector('.wx-det') || el.classList.contains('far')) { el.classList.toggle('open'); if (el.classList.contains('open')) reveal(el, false); } return 'quiet'; });
act('wx.pick', c => { _wxPick = c.v; renderTripWeather(); return 'quiet'; }); // a view, not data: the weather draws itself
act('wx.more', () => { _wxMore = true; renderTripWeather(); return 'quiet'; });
function wxSettingsHTML() { const S = wxSet(), ch = (k, label, opts) => choiceHTML({ label, act: 'set.weather', cur: S[k], attrs: v => ` data-wxset="${k}" data-wxval="${v}"`, opts }); // 10.9.0 (design-forms, gap 32): segmented; "feels like" a switch
  return `<p>התחזית לפי התחנה של כל יום, מהיום והלאה. ימים רחוקים מקבלים ממוצע עונתי.</p>
    ${ch('view', 'תצוגת הימים', [['list', 'רשימה'], ['twodays', 'היום ומחר', 'היום ומחר, השאר מתקפלים'], ['picker', 'יום אחד', 'יום אחד בכל פעם']])}
    ${ch('open', 'פתוח מראש', [['today', 'היום', 'הפירוט של היום'], ['none', 'כלום']])}
    ${ch('extra', 'שורות למקומות מהתוכנית', [['rule', 'רחוקים', 'רחוקים (25 ק״מ) או גבוהים (500 מ׳)'], ['keys', 'נק׳ מפתח', 'רק נקודות מפתח ' + SYM_KEY], ['none', 'בלי']])}
    ${ch('wind', 'רוח', [['kmh', 'קמ״ש'], ['ms', 'מטר לשנייה']])}
    ${setSwitchHTML('set.weather', ` data-wxset="feels" data-wxval="${!S.feels}"`, !!S.feels, '"מרגיש כמו"', 'הטמפרטורה המורגשת ליד הטמפרטורה')}`; }


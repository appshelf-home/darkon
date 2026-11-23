// ---- maps inside HTML files: a live map (Leaflet, when online) over a picture of the same map (offline) ----
// items: [{lat, lng, color, n (number or ''), name, sub, love, hotel, nav, group, day}], route: [[lat, lng]]
async function fileMapPicture(items, kind, opts) {
  const W = 820, H = 560, cs = items.map(x => ({ c: { lat: x.lat, lng: x.lng }, name: x.name, x }));
  const fr = memFrame(cs.filter(q => !q.x.hotel), kind), core = fr.core.length ? fr.core.concat(cs.filter(q => q.x.hotel && fr.core.some(c => distanceKm(c.c, q.c) < 60))) : cs;
  const fit = mercFit(core.map(q => q.c), W, H, 46, kind === 'city' ? 17 : 12), box = { x: 0, y: 0, w: W, h: H };
  let bg = navigator.onLine ? await renderTileImage(fit, 0, 0, W, H, 1.5, 'osm', opts && opts.onProg, { fade: opts && opts.fade ? 0.35 : 0, limit: 120 }) : null, schem = null, credit = bg ? bg.credit : '';
  if (!bg && opts && opts.tripId) { schem = await GEO_DB.get(geoKey(opts.tripId, kind, bboxOfItems(core, kind === 'city' ? 0.35 : 0.2))); }
  let s = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Rubik, Arial, sans-serif" style="direction:ltr"><rect width="${W}" height="${H}" fill="#F4F0E6"/>`;
  if (bg) s += `<image href="${bg.url}" xlink:href="${bg.url}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="none"/>`;
  else if (schem) { s += schemSVG(schem, fit, box, (opts && opts.th) || {}, 16); credit = schemCredit(schem); } // legal-credits (C2): from what the background was drawn of
  if (opts && opts.route && opts.route.length > 1) s += `<polyline points="${opts.route.map(q => `${fit.x(q[1]).toFixed(1)},${fit.y(q[0]).toFixed(1)}`).join(' ')}" fill="none" stroke="#1C2B33" stroke-opacity=".6" stroke-width="3" stroke-dasharray="7 6"/>`;
  items.forEach(x => { const px = fit.x(x.lng), py = fit.y(x.lat); if (px < -20 || px > W + 20 || py < -20 || py > H + 20) return;
    if (x.hotel) { s += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="13" fill="#1C2B33" stroke="#fff" stroke-width="2.5"/><text x="${px.toFixed(1)}" y="${(py + 5).toFixed(1)}" text-anchor="middle" font-size="14">🏨</text>`; return; }
    const r = x.n !== '' && x.n != null ? 11 : (x.love ? 9 : 7);
    s += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${r}" fill="${x.color}" stroke="#fff" stroke-width="2.5"/>${x.n !== '' && x.n != null ? `<text x="${px.toFixed(1)}" y="${(py + 4).toFixed(1)}" text-anchor="middle" font-size="11" font-weight="700" fill="#fff">${x.n}</text>` : ''}${x.love && x.n !== '' && x.n != null ? `<text x="${(px + 10).toFixed(1)}" y="${(py - 7).toFixed(1)}" text-anchor="middle" font-size="11">❤️</text>` : ''}`;
    if (x.label) s += `<text x="${px.toFixed(1)}" y="${(py - 13).toFixed(1)}" text-anchor="middle" font-size="13" font-weight="700" fill="#1C2B33" stroke="#fff" stroke-width="4" paint-order="stroke">${_qe(String(x.name).slice(0, 24))}</text>`; });
  s += edgeArrowsSVG(fit, box, fr.far.map(q => ({ c: q.c, name: q.name })), fr.center, '#1C2B33', 15);
  if (credit) s += `<text x="${W - 8}" y="${H - 8}" text-anchor="end" font-size="11" fill="#555" stroke="#fff" stroke-width="3" paint-order="stroke">${_qe(credit)}</text>`;
  s += '</svg>';
  let url = ''; try { const c = await svgToCanvas(s, W * 1.5, H * 1.5); url = c.toDataURL('image/jpeg', 0.82); } catch (e) {}
  return { url, svg: s, online: !!bg, bounds: core.map(q => [q.c.lat, q.c.lng]) };
}
// the block that goes into a file: Leaflet from cdnjs when there is a network, the picture otherwise
// ---- 8.0.0 (ק19): one way to build every page for people (the trip summary, the recommendations, any future page): one shell -
// direction, the trip's colours, light and dark, title, signature (name, date, version) - and the map from the app's own map
// component (fmapPack), with one picture of the map for no network (ק21); each page brings only its own content.
const PAGE_CSS = `body{margin:0;background:var(--bg);color:var(--ink);font-family:Rubik,'Segoe UI',Arial,sans-serif;line-height:1.55}main{max-width:820px;margin:0 auto;padding:16px}
h1{margin:4px 0}h2{font-size:1.15rem;margin:22px 0 8px}.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:10px 14px;margin:8px 0}footer{color:var(--soft);font-size:.8rem;text-align:center;margin:26px 0}
.fmap{position:relative;margin:12px 0}.fmap-live{height:420px;border-radius:14px;overflow:hidden;border:1px solid var(--line);position:relative}.fmap-pic img,.fmap-pic svg{width:100%;height:auto;display:block;border-radius:14px}.fmap small{display:block;color:var(--soft);font-size:.78rem;margin-top:4px}
.wk-cr{display:block;color:var(--soft);font-size:.75rem}small.wk-cr a{color:inherit;font-size:inherit;margin:0;text-decoration:underline}.fmap-live.faded .leaflet-tile-pane{filter:grayscale(.5) brightness(1.08) contrast(.9);opacity:.75}.fmap-ctl[hidden],.fmap-off[hidden],.fmap-nolive[hidden],.fmap-live[hidden],.fmap-pic[hidden]{display:none}`;
function pageHTML(o) {
  const e = _qe, th = o.th || {}, M = o.map;
  return `<!DOCTYPE html><html lang="he" dir="rtl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${e(o.title)}</title>${M && M.pic ? leafletTags() : ''}
<style>${M && M.pic ? fmapCSS() : ''}
:root{--p:${th.primary || '#1C2B33'};--a:${th.accent || '#C08A2E'};--bg:#FBF8F1;--ink:#24262B;--soft:#5A5D63;--card:#fff;--line:#E1DED2}@media (prefers-color-scheme:dark){:root{--bg:#1A1B1E;--ink:#EDECE7;--soft:#A6A5A0;--card:#232427;--line:#35363A}}
${PAGE_CSS}${o.css || ''}</style></head><body><main>
${o.head || ''}${M && M.pic ? `${M.before || ''}<div class="fmap"><div id="fmapLive" class="fmap-live" hidden></div><div id="fmapPic" class="fmap-pic">${M.pic.url ? `<img src="${_escH(M.pic.url)}" alt="מפה">` : M.pic.svg}${M.pic.online ? '' : '<small>המפה נוצרה בלי רשת. כשיש רשת, אפשר ליצור אותה שוב במלואה.</small>'}</div><small class="fmap-off" hidden>📴 בלי רשת מוצגת תמונה של המפה</small><small class="fmap-nolive" hidden>לצפייה במפה חיה – לפתוח את הקובץ בדפדפן אחר</small></div>${M.after || ''}` : ''}
${o.body || ''}
<footer>${e(APP.appTitle)}${SEP}${e(o.label)}${SEP}${tmFmt('date', Date.now())}${SEP}v${APP_VERSION}</footer></main>
${M && M.pic ? `<script>window.FMAP=${JSON.stringify(M.data).replace(/</g, '\\u003c')};<\/script><script>${fmapPack().replace(/<\/script/gi, '<\\/script')}
(function(){var live=document.getElementById('fmapLive'),pic=document.getElementById('fmapPic'),off=document.querySelector('.fmap-off'),no=document.querySelector('.fmap-nolive'),done=false;
function ctl(on){document.querySelectorAll('.fmap-ctl').forEach(function(x){x.hidden=!on;});}
function fail(err){live.hidden=true;pic.hidden=false;if(err)console.error(err);if(navigator.onLine){no.hidden=false;}else{off.hidden=false;ctl(false);}}
function start(last){if(done)return;if(!navigator.onLine){off.hidden=false;ctl(false);done=true;return;}if(!window.L){if(last){done=true;fail();}return;}
done=true;try{live.hidden=false;pic.hidden=true;window.FM=fileMapView(window.FMAP);if(!window.FM)throw new Error('no live map');}catch(err){window.FM=null;fail(err);}}
start(false);if(!done){window.addEventListener('load',function(){start(false);setTimeout(function(){start(true);},2500);});}})();<\/script>` : ''}${o.script ? `<script>${o.script}<\/script>` : ''}</body></html>`;
}
// the page's data for the map: one item per pin
function fmapData(items, pic, opt) { return { items: items.map(x => ({ a: +x.lat.toFixed(5), o: +x.lng.toFixed(5), c: x.color, n: x.n == null ? '' : x.n, t: _qe(x.name), s: _qe(x.sub || ''), d: _qe(x.desc || ''), q: x.q || '', l: x.love ? 1 : 0, h: x.hotel ? 1 : 0, v: _qe(x.nav || ''), g: x.group || '', i: x.icon || '' })),
  b: pic.bounds, r: (opt && opt.route) || [], fade: !!(opt && opt.fade) }; }
// 11.38.2 (privacy-server): the same addresses and integrity hashes as the app's own (LEAF_SRC, map-library.js)
function leafletTags() { return `<link rel="stylesheet" href="${_escH(LEAF_SRC.css)}" integrity="${_escH(LEAF_SRC.cssSri)}" crossorigin="anonymous"><script src="${_escH(LEAF_SRC.js)}" integrity="${_escH(LEAF_SRC.jsSri)}" crossorigin="anonymous"><\/script>`; }
// legal-credits (C4; decisions 2026-11-21 · Review of the legal-review report, Q13 item 5): a place's description that came from Wikipedia carries,
// wherever a page or a file passes it on, "מתוך ויקיפדיה · CC BY-SA 4.0" linked to the article and the licence - or "על פי ויקיפדיה" once the person
// edited it (the text no longer matches the hash kept with its source, src.dh). The words and the licence come from the provider's row.
function wikiTextOf(p) { const s = p && p.src; if (!s || s.type !== 'wikipedia' || !p.description) return null; return { same: !!s.dh && textHash(p.description) === s.dh, url: /^https:\/\/[a-z-]+\.(m\.)?wikipedia\.org\//.test(s.url || '') ? s.url : '' }; }
function wikiTextCreditHTML(p) { const w = wikiTextOf(p); if (!w) return ''; const A = PROVIDERS.wikimedia.attr, e = _qe, said = w.same ? A.from : A.after;
  return `<small class="wk-cr">${w.url ? `<a href="${e(w.url)}" target="_blank" rel="noopener">${e(said)}</a>` : e(said)}${SEP}<a href="${e(A.textU)}" target="_blank" rel="noopener">${e(A.text)}</a></small>`; }
function wikiTextCreditText(p) { const w = wikiTextOf(p); if (!w) return ''; const A = PROVIDERS.wikimedia.attr; return `${w.same ? A.from : A.after}${SEP}${A.text}`; }
function shiftFit(fit, dx, dy) { return { ...fit, x: l => fit.x(l) + dx, y: l => fit.y(l) + dy }; }


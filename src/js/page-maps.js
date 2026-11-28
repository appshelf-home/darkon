// ---- maps inside HTML files: a live map (Leaflet, when online) over a picture of the same map (offline) ----
// items: [{lat, lng, color, n (number or ''), name, sub, love, hotel, nav, group, day}], route: [[lat, lng]]
async function fileMapPicture(items, kind, opts) {
  await pageLeafReady(); // page-look: the page's live map carries its library (leafletTags)
  const W = 820, H = 560, cs = items.map(x => ({ c: { lat: x.lat, lng: x.lng }, name: x.name, x }));
  const fr = memFrame(cs.filter(q => !q.x.hotel), kind), core = fr.core.length ? fr.core.concat(cs.filter(q => q.x.hotel && fr.core.some(c => distanceKm(c.c, q.c) < 60))) : cs;
  const fit = mercFit(core.map(q => q.c), W, H, 46, kind === 'city' ? 17 : 12), box = { x: 0, y: 0, w: W, h: H };
  let bg = svcOnline() ? await renderTileImage(fit, 0, 0, W, H, 1.5, 'osm', opts && opts.onProg, { fade: opts && opts.fade ? 0.35 : 0, limit: 120 }) : null, schem = null, credit = bg ? bg.credit : '';
  if (!bg && opts && opts.tripId) { schem = await GEO_DB.get(geoKey(opts.tripId, kind, bboxOfItems(core, kind === 'city' ? 0.35 : 0.2))); }
  let s = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Rubik, Arial, sans-serif" style="direction:ltr"><rect width="${W}" height="${H}" fill="#F4F0E6"/>`;
  if (bg) s += `<image href="${bg.url}" xlink:href="${bg.url}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="none"/>`;
  else if (schem) { s += schemSVG(schem, fit, box, (opts && opts.th) || {}, 16); credit = schemCredit(schem); } // legal-credits (C2): from what the background was drawn of
  if (opts && opts.route && opts.route.length > 1) s += `<polyline points="${opts.route.map(q => `${fit.x(q[1]).toFixed(1)},${fit.y(q[0]).toFixed(1)}`).join(' ')}" fill="none" stroke="#1C2B33" stroke-opacity=".6" stroke-width="3" stroke-dasharray="7 6"/>`;
  items.forEach(x => { const px = fit.x(x.lng), py = fit.y(x.lat); if (px < -20 || px > W + 20 || py < -20 || py > H + 20) return;
    if (x.hotel) { s += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="13" fill="#1C2B33" stroke="#fff" stroke-width="2.5"/><text x="${px.toFixed(1)}" y="${(py + 5).toFixed(1)}" text-anchor="middle" font-size="14">🏨</text>`; return; }
    const r = x.n !== '' && x.n != null ? 11 : (x.love ? 9 : 7);
    s += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${r}" fill="${x.color}" stroke="#fff" stroke-width="2.5"/>${x.n !== '' && x.n != null ? `<text x="${px.toFixed(1)}" y="${(py + 4).toFixed(1)}" text-anchor="middle" font-size="11" font-weight="700" fill="#fff">${x.n}</text>` : ''}${x.love && x.n !== '' && x.n != null ? `<text x="${(px + 10).toFixed(1)}" y="${(py - 7).toFixed(1)}" text-anchor="middle" font-size="11">❤️</text>` : ''}`;
    if (x.label) s += `<text x="${px.toFixed(1)}" y="${(py - 13).toFixed(1)}" text-anchor="middle" font-size="13" font-weight="700" fill="#1C2B33" stroke="#fff" stroke-width="4" paint-order="stroke">${escH(String(x.name).slice(0, 24))}</text>`; });
  s += edgeArrowsSVG(fit, box, fr.far.map(q => ({ c: q.c, name: q.name })), fr.center, '#1C2B33', 15);
  if (credit) s += `<text x="${W - 8}" y="${H - 8}" text-anchor="end" font-size="11" fill="#555" stroke="#fff" stroke-width="3" paint-order="stroke">${escH(credit)}</text>`;
  s += '</svg>';
  let url = ''; try { const c = await svgToCanvas(s, W * 1.5, H * 1.5); url = c.toDataURL('image/jpeg', 0.82); } catch (e) {}
  return { url, svg: s, online: !!bg, bounds: core.map(q => [q.c.lat, q.c.lng]) };
}
// the block that goes into a file: Leaflet from cdnjs when there is a network, the picture otherwise
// ---- 8.0.0 (ק19): one way to build every page for people (the trip summary, the recommendations, any future page): one shell -
// direction, the trip's colours, light and dark, title, signature (name, date, version) - and the map from the app's own map
// component (fmapPack), with one picture of the map for no network (ק21); each page brings only its own content.
// page-look (11.74.0; decisions 2026-11-27 · The pages for people in the app's current look, Q1-Q3): the shell's look is the app's own - its design
// tokens (the :root rules fmapCSS carries, light and dark) and its icons (the page's subset, FMAP_FONT); no colour is written here, so the app's next look reaches its pages
const PAGE_CSS = `body{margin:0;background:var(--surface);color:var(--on-surface);font-family:Rubik,'Segoe UI',Arial,sans-serif;line-height:1.55}main{max-width:820px;margin:0 auto;padding:var(--sp-3)}a{color:var(--primary)}
h1,h2{display:flex;align-items:center;gap:var(--sp-2)}h1{margin:4px 0;font-size:var(--fs-display-large);line-height:1.2}h2{font-size:1.15rem;font-weight:600;margin:24px 0 8px}h1 .msi,h2 .msi{color:var(--on-surface-variant);font-size:1.375rem}
.card{background:var(--surface-container);color:var(--on-surface);border:0;border-radius:var(--r-card);box-shadow:none;padding:12px 14px;margin:8px 0}footer{color:var(--on-surface-variant);font-size:.8rem;text-align:center;margin:26px 0}
.fmap{position:relative;margin:12px 0}.fmap-live{height:420px;border-radius:var(--r-card);overflow:hidden;position:relative}.fmap-live.fmap-wait{position:absolute;inset:0 0 auto 0;visibility:hidden}.fmap-pic img,.fmap-pic svg{width:100%;height:auto;display:block;border-radius:var(--r-card)}.fmap small{display:block;color:var(--on-surface-variant);font-size:.78rem;margin-top:4px}
.wk-cr{display:block;color:var(--on-surface-variant);font-size:.75rem}small.wk-cr a{color:inherit;font-size:inherit;margin:0;text-decoration:underline}.fmap-live.faded .leaflet-tile-pane{filter:grayscale(.5) brightness(1.08) contrast(.9);opacity:.75}.fmap-phs{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}.fmap-phs span{width:120px;height:120px;background-size:cover;background-position:center;border-radius:10px;display:block}.fmap-ctl[hidden],.fmap-off[hidden],.fmap-nolive[hidden],.fmap-live[hidden],.fmap-pic[hidden]{display:none}`;
// page-look (0.1-0.2; G128 reopened): the live map's library goes inside the page, read once from its address with its integrity hash (LEAF_SRC) -
// a page opened from a mail or a file on the phone never fetches a script across origins; when it cannot be read, the page asks the CDN as before
const LEAF_BSD = 'Leaflet - BSD 2-Clause License. Copyright (c) 2010-2023, Volodymyr Agafonkin. Copyright (c) 2010-2011, CloudMade. All rights reserved. Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met: 1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer. 2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution. THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.';
const PAGE_LEAF = { js: '', css: '' };
async function pageLeafReady() { if (PAGE_LEAF.js) return;
  // LT: no markup-shaped text in this code - the build's minifier writes an escaped one raw, and it would end the app's own script
  const LT = String.fromCharCode(60), [js, css] = await Promise.all([svcLibText(LEAF_SRC.js, LEAF_SRC.jsSri), svcLibText(LEAF_SRC.css, LEAF_SRC.cssSri)]), low = (js || '').toLowerCase();
  if (!js || !css || ['script', '/script', '!--'].some(x => low.includes(LT + x)) || css.toLowerCase().includes(LT + '/style')) return; // not kept: the next page tries again; text that would end the page's tag: the CDN's address instead
  const base = LEAF_SRC.css.slice(0, LEAF_SRC.css.lastIndexOf('/') + 1); // its images/ addresses made absolute
  PAGE_LEAF.css = ['(', '("', "('"].reduce((t, q) => t.split('url' + q + 'images/').join('url' + q + base + 'images/'), css); PAGE_LEAF.js = js; }
// the live map starts only when a tile of it is really drawn (a vector tile painted - tile-drawn, vecGridLayer - or a picture tile loaded); until then the picture
// stays. "מפה" with no tile after 4 s tries "טופוגרפית" (picture tiles, no script across origins); with none after 6 s the quiet line shows, and a tile that
// comes later still brings the live map. Offline from the start: the picture and its offline line, as before. A viewer that runs the page with no network
// (WhatsApp's) keeps the picture and its line (decisions 2026-11-26 · A page for people on WhatsApp). data-fmap on the root says where it stands.
function pageHTML(o) {
  const e = escH, M = o.map;
  return `<!DOCTYPE html><html lang="he" dir="rtl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${e(o.title)}</title>${M && M.pic ? leafletTags() : ''}
<style>${groupFn('pages', 'fmapCSS')()}
${PAGE_CSS}${o.css || ''}</style></head><body><main>
${o.head || ''}${M && M.pic ? `${M.before || ''}<div class="fmap"><div id="fmapLive" class="fmap-live" hidden></div><div id="fmapPic" class="fmap-pic">${M.pic.url ? `<img src="${escH(M.pic.url)}" alt="מפה">` : M.pic.svg}${M.pic.online ? '' : '<small>המפה נוצרה בלי רשת. כשיש רשת, אפשר ליצור אותה שוב במלואה.</small>'}</div><small class="fmap-off" hidden>📴 בלי רשת מוצגת תמונה של המפה</small><small class="fmap-nolive" hidden>לצפייה במפה חיה – לפתוח את הקובץ בדפדפן אחר</small></div>${M.after || ''}` : ''}
${o.body || ''}
<footer>${e(APP.appTitle)}${SEP}${e(o.label)}${SEP}${tmFmt('date', Date.now())}${SEP}v${APP_VERSION}</footer></main>
${M && M.pic ? `<script>window.FMAP=${JSON.stringify(M.data).replace(/</g, '\\u003c')};<\/script><script>${groupFn('pages', 'fmapPack')().replace(/<\/script/gi, '<\\/script')}
(function(){var R=document.documentElement,live=document.getElementById('fmapLive'),pic=document.getElementById('fmapPic'),off=document.querySelector('.fmap-off'),no=document.querySelector('.fmap-nolive'),done=false,shown=false;
function ctl(on){document.querySelectorAll('.fmap-ctl').forEach(function(x){x.hidden=!on;});}
function fail(err,why){live.hidden=true;pic.hidden=false;R.dataset.fmap=why;if(err)console.error(err);if(navigator.onLine){no.hidden=false;}else{off.hidden=false;ctl(false);}}
function show(){if(shown)return;shown=true;live.classList.remove('fmap-wait');pic.hidden=true;no.hidden=true;R.dataset.fmap='live';}
function drawn(){return !!live.querySelector('canvas.tile-drawn,img.leaflet-tile-loaded');}
function start(last){if(done)return;if(!navigator.onLine){off.hidden=false;ctl(false);done=true;R.dataset.fmap='offline';return;}if(!window.L){if(last){done=true;fail(null,'no-library');}return;}
done=true;try{live.hidden=false;live.classList.add('fmap-wait');R.dataset.fmap='wait';window.FM=fileMapView(window.FMAP);if(!window.FM)throw new Error('no live map');}catch(err){window.FM=null;fail(err,'map-error');return;}
var t0=Date.now(),tm=setInterval(function(){if(drawn()){clearInterval(tm);show();return;}var s=Date.now()-t0;
if(s>4000&&!R.dataset.topo&&window.DEV&&DEV.baseMap!=='topo'&&typeof setBaseMap==='function'){R.dataset.topo='1';try{setBaseMap('topo');}catch(e){}}
if(s>6000&&no.hidden){no.hidden=false;R.dataset.fmap='no-tiles';}},250);}
start(false);if(!done){window.addEventListener('load',function(){start(false);setTimeout(function(){start(true);},2500);});}})();<\/script>` : ''}${o.script ? `<script>${o.script}<\/script>` : ''}</body></html>`;
}
// the page's data for the map: one item per pin
function fmapData(items, pic, opt) { return { items: items.map(x => ({ a: +x.lat.toFixed(5), o: +x.lng.toFixed(5), c: x.color, n: x.n == null ? '' : x.n, t: escH(x.name), s: escH(x.sub || ''), d: escH(x.desc || ''), q: x.q || '', l: x.love ? 1 : 0, h: x.hotel ? 1 : 0, v: escH(x.nav || ''), g: x.group || '', i: x.icon || '' })),
  b: pic.bounds, r: (opt && opt.route) || [], fade: !!(opt && opt.fade),
  ph: ((opt && opt.photos) || []).map(x => ({ a: +x.c.lat.toFixed(5), o: +x.c.lng.toFixed(5), t: escH(x.name), u: x.u.filter(u => /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(u)) })).filter(x => x.u.length) }; }
// 11.38.2 (privacy-server): the same addresses and integrity hashes as the app's own (LEAF_SRC, map-library.js); page-look: inside the page when read (pageLeafReady)
function leafletTags() { const P = PAGE_LEAF;
  if (P.js) return `<style>${P.css}</style><script>/*! ${LEAF_BSD} */\n${P.js}<\/script>`;
  return `<link rel="stylesheet" href="${escH(LEAF_SRC.css)}" integrity="${escH(LEAF_SRC.cssSri)}" crossorigin="anonymous"><script src="${escH(LEAF_SRC.js)}" integrity="${escH(LEAF_SRC.jsSri)}" crossorigin="anonymous"><\/script>`; }
function shiftFit(fit, dx, dy) { return { ...fit, x: l => fit.x(l) + dx, y: l => fit.y(l) + dy }; }


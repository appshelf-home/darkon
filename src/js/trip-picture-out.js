// ---- the memory screen's picture block ----
function picMemBlockHTML(M) {
  // 4.46.5: simpler - the picture as it is (the background is chosen in the editor), ⛶ on its corner, and one row:
  // ✏️ עריכה, 📤 ייצוא (PNG / PDF / print in a dialog) and ✳ שליחה ל-AI לאיור
  const id = M.t.id, D = mementoData(id); if (!D || (!D.visited.length && !D.stops.length)) return '';
  const art = MEMO.get('art:' + id), style = mementoStyleOf(id), svg = currentMementoSVG(id), ready = picBgReady(id);
  if (!ready && svcNetDown() && !MEM_ST.bg) MEM_ST.bg = { svc: style === 'map' ? 'picTiles' : 'schem', n: 0, of: 1, what: 'רקע המפה' }; const stLine = memStLine('memBgSt');
  return `<div class="mem-block memento"><h3>${msi('image', { size: 20 })} תמונת הטיול${style === 'art' && art ? ' <small class="mem-artmark">' + claudeMark() + ' מאוירת</small>' : ''}</h3>
    <div class="mem-picwrap"><div class="memento-img" id="memPicImg" data-act="memSec.memPicFs">${svg}</div><button type="button" class="mem-picfs" id="memPicFs" data-act="memSec.memPicFs" aria-label="הגדלה" title="הגדלה">${msi('fullscreen')}</button></div>
    <small class="sh-hint mem-bgst" id="memBgSt"${stLine ? '' : ' hidden'}>${stLine}</small>${!ready && !svcNetDown() && SCHEM_FAILED.size ? '<div class="brow"><button type="button" class="icon-btn btn-copy" id="memBgRetry" data-act="memSec.memBgRetry" style="width:auto;padding:0 12px;">' + msi('refresh', { size: 18 }) + ' לנסות שוב לטעון את רקע המפה</button></div>' : ''}
    <div class="brow export-actions mem-picacts"><button class="btn-nav" id="memPicEdit" data-act="memSec.memPicEdit">${msi('edit', { size: 18 })} עריכה</button><button class="icon-btn btn-copy" id="memExport" data-act="memSec.memExport" style="width:auto;padding:0 14px;">${msi('ios_share', { size: 18 })} ייצוא</button><button class="claude-btn" id="memArt" data-act="memSec.memArt">${claudeH(TX.claude.memento.btn)}</button>${tipI('claude.memento')}</div></div>`; // 5.15.0 (ד6)
}

// 4.46.5: 📤 ייצוא - every way out of the trip picture in one dialog
function openMemExport(id) { const ctl = {};
  const sheet = document.getElementById('sheet'), style = mementoStyleOf(id);
  sheet.innerHTML = `${fmHead('📤 ייצוא תמונת הטיול', 'mxClose')}
    ${taListHTML({ act: 'memExport.mexp' }, [['png', '📱 PNG לשליחה', 'תמונה לוואטסאפ ולרשתות'], ['a4', '🖨️ PDF A4'], ['a3', '🖨️ PDF A3', style === 'map' ? `לחדות מרבית ב-A3: ${msi('gesture', { size: 16, cls: 'msi-in' })} סכמתי בעריכה (חד בכל גודל)` : 'חד בכל גודל'], ['print', '🖨️ הדפסה']])}`;
  
  ctl.mexp = b => { closeSheet(); setTimeout(() => exportMemento(id, b.dataset.mexp), 80); };
  openSheet('memExport'); layerTop().ctl = ctl;
}
ctlActs('memExport', ['mexp']);
// ---- ✳ the file for Claude: the picture as I arranged it, locked ----
function picArrangement(id, request) {
  const m = picModel(id), st = mementoStyleOf(id), svg = picSVG(m, 'schem', { base: true }), L = PIC_LAST[id], f = m.frame, M2 = { cityCount: m.pts.filter(x => x.type === 'city' && !x.extra).length };
  const images = photoImagesOut(id, L.marks.map(q => q.img ? (q.img.key || q.key) : null));
  const pts = L.marks.map(q => ({ key: q.key, type: q.type, name: q.name, foreign: q.foreign || '', text: q.text, label: q.label === true ? 'always' : q.label === 'auto' ? 'if-room' : 'no', level: q.lv,
    xy: [Math.round(q.x), Math.round(q.y)], r: q.r, at: [Math.round(q.tx), Math.round(q.ty)], coord: [+q.c.lat.toFixed(5), +q.c.lng.toFixed(5)], image: q.img ? `pimg:${q.img.key || q.key}` : null,
    textEdited: !!((((m.P.ov || {}).pts || {})[q.key] || {}).text), members: q.members ? q.members.map(z => z.key) : undefined, rating: q.rt || undefined }));
  return { svg, images, arrangement: { locked: true, kind: m.kind, preset: m.preset, orient: m.orient, lang: m.lang, look: m.look, background: st === 'map' ? 'map' : 'schematic', request: String(request || '').trim(),
    mapBox: L.B.map, frame: { none: f.none, smallTitle: f.none ? f.small : undefined, band: !f.none && f.band, title: f.title || String(m.D.t.name).split(' · ')[0], subtitle: f.sub || '', dates: f.dates, flags: f.flags,
      numbers: f.none ? [] : f.nums.map(k => ({ key: k, label: PIC_NUMS[k][m.lang === 'en' ? 1 : 0], value: picNumVal(k, m.D, M2) })), highlights: !f.none && f.hl, collection: !f.none && f.col, elevation: f.elev, footer: !f.none && f.foot },
    points: pts, route: m.kind === 'route' ? picSkeleton(m).map(x => ({ key: x.key, mode: x.mode || null, passed: !!x.passed })) : [] } };
}
function buildMementoFile(id, request) {
  const D = mementoData(id), m = picModel(id, D), t = D.t, A = picArrangement(id, request);
  return withClaude({ app: BACKUP_APP, kind: 'memento', format: 2, appVersion: APP_VERSION, createdAt: new Date().toISOString(), signature: `${t.name} · מזכרת · ${tmFmt('date', Date.now())} · v${APP_VERSION}`,
    memento: { tripId: t.id, name: String(t.name).split(' · ')[0], start: t.start, end: t.end, travelers: t.travelers || '', shape: m.kind, orient: m.orient, size: m.orient === 'land' ? [1400, 1000] : [1000, 1400],
      theme: { primary: D.th.primary || '#1C2B33', accent: D.th.accent || '#C08A2E', headingFont: D.th.headingFont || 'Rubik' },
      destinations: D.dests.map(d => ({ name: d.name, center: d.center, flag: destFlagMeta(d) })),
      highlights: D.hs.map(h => ({ place: h.name, text: h.text || '' })),
      stats: { days: D.days, places: D.visited.length, km: D.totalKm, walkKm: D.walk, loved: Object.values(D.rate).filter(r => r.r === 'love').length },
      records: D.records.map(r => ({ icon: r[0], value: r[1], label: r[2] })),
      collections: D.cols.map(x => ({ name: x.name, found: (x.found || []).length, total: x.total })),
      arrangement: A.arrangement, images: A.images,
      base: { svg: A.svg, note: 'The app\'s own picture of this trip, arranged by the user: real geography (Web Mercator) and every point where the user put it. Draw on top of it. Locked: never move, add or remove a point, never change a point\'s size or a text the user edited. Images are "pimg:KEY" placeholders - keep them as they are (the app puts the real image back).' } } }, 'memento');
}
async function readySchemFor(id) { return navigator.onLine ? picEnsureBg(id, 'schem') : null; }
function openArtSheet(id) { layerNote(openArtSheet, arguments); // 8.0.0 (ק17): the Claude skeleton
  const m = picModel(id), n = m.pts.filter(x => x.lv !== 'out').length, artNow = MEMO.get('art:' + id), F = fmNew({ id });
  partsWin(F, { key: 'openArtSheet', title: claudeH(TX.claude.memento.btn) + ' ' + tipI('art.locked'),
    body: [`<p class="sh-hint">תמונת הטיול כפי שסידרתם: ${m.kind === 'city' ? 'עירוני' : 'מסלול'}, ${n} מיקומים, ${m.lang === 'en' ? 'באנגלית' : 'בעברית'}, ${m.look === 'drawn' ? 'מצויר' : 'צילומים אמיתיים'}.</p>`,
      `<div class="cl-lock">${msi('lock', { size: 18 })} ה-${AI} לא משנה את הסידור, הגדלים והשמות. רק את הציור.</div>`, // 10.5.0 (design-4 part 2): a locked promise - a tinted line with a lock
      fmText(F, 'req', { label: 'הבקשה לאיור (רשות)', para: true, rows: 2, placeholder: "למשל: וינטג', צבעי מים, שמות באנגלית", value: picOf(id).request || '', on: v => artReqSet(id, v) }),
],
    end: artNow ? fmEndActs([{ act: 'art.del', label: 'מחיקת הגרסה המאוירת', del: true }]) : '', // end-actions-followups (miss a): at the window's end
    goal: 'memento', send: { act: 'art.send', label: '📤 שליחת תמונת הטיול ל-' + AI } });
}
// undo-history: the request to Claude is a draft of what is sent, not an action - it is kept for the next sending but never lands
// in a row (absorbed into the history's base), and an undo of an earlier change of the picture keeps the request as it is now
function artReqSet(id, v) { const td = tdOf(id), p = { ...(td.pic || {}) }; if ((p.request || '') === (v || '')) return; picBurstEnd();
  if (v) p.request = v; else delete p.request; td.pic = p; tdSave(id); hAbsorb(hKey(['d', id, 'pic'])); }
let ART_REQ = null;
undoBefore(() => { ART_REQ = {}; Object.entries(STATE.tripData).forEach(([t, d]) => { const r = ((d || {}).pic || {}).request; if (r) ART_REQ[t] = r; }); });
undoAfter(keys => { const R = ART_REQ || {}; ART_REQ = null;
  Object.keys(STATE.tripData).concat(Object.keys(R)).forEach(t => { if (!keys.includes(hKey(['d', t, 'pic'])) && !keys.includes(hKey(['d', t]))) return;
    const d = STATE.tripData[t]; if (!d || (((d.pic || {}).request) || '') === (R[t] || '')) return;
    const p = { ...(d.pic || {}) }; if (R[t]) p.request = R[t]; else delete p.request; d.pic = p; tdSave(t); }); });
act('art.del', c => { const F = fmOf(c.el); if (!F) return; closeSheet(); photoToTrash('art:' + F.opts.id); }); // 9.8.0 (Q16): to the trash, as every photo
act('art.send', async c => { const F = fmOf(c.el); if (!F) return; const id = F.opts.id, req = String(fmGet(F, 'req') || '').trim();
  artReqSet(id, req); await readySchemFor(id); const f = buildMementoFile(id, req);
  if (await deliverFile(new Blob([JSON.stringify(f, null, 1)], { type: 'application/json' }), `${PACK.fileName}-memento-${id}.json`)) { logEvent(SY.claude + ' נשלחה תמונת הטיול ל-' + AI + ': ' + STATE.trips[id].name, true); closeSheet(); showToast('נשלח. כשהקובץ המאויר יחזור - מכניסים אותו, והוא יופיע במסך הזיכרון'); } });

// an illustrated picture that comes back: only safe SVG (no scripts, events, outside links or embedded pages)
// 11.8.0 (travels-7-followups, small-fixes item 5; decisions 2026-11-11 "Review of the 10.17.2 summary" miss a): parsed as XML (strict -
// no HTML inside it), then walked: only SVG elements stay, and none that runs or embeds (script, foreignObject, a style sheet that loads
// from outside); no event attribute (on…, however it is separated); a link (href, xlink:href) only to inside the picture (#…), a picture
// point (pimg:…) or an embedded image (data:image/…); a style or a presentation attribute may point only inside the picture (url(#…)).
// The regular expressions before missed "<svg/onload=…>" and a style's url(…), and the picture is drawn with innerHTML. Guard: t1048.
const SVG_NS = 'http://www.w3.org/2000/svg', SVG_DROP = /^(script|foreignobject|iframe|object|embed|handler|listener)$/i;
const SVG_LINK_OK = /^\s*(#|pimg:|data:image\/(png|jpe?g|gif|webp);base64,)/i, SVG_URL_BAD = /url\(\s*(['"]?)\s*(?!#)[^)]*\)|@import|expression\(|javascript:/i;
function cleanSvg(svg) {
  const s = String(svg || '').trim(); if (!/^<svg[\s>]/i.test(s) || !/<\/svg>\s*$/i.test(s) || s.length > 4e6) return null;
  let x = s; const head = (x.match(/^<svg[^>]*>/i) || [''])[0]; // the namespaces an SVG written for a page may leave out
  if (!/\sxmlns\s*=/.test(head)) x = x.replace(/^<svg/i, `<svg xmlns="${SVG_NS}"`); if (/xlink:/.test(x) && !/xmlns:xlink\s*=/.test(head)) x = x.replace(/^<svg/i, '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
  let doc; try { doc = new DOMParser().parseFromString(x, 'image/svg+xml'); } catch (e) { return null; }
  const root = doc && doc.documentElement; if (!root || root.namespaceURI !== SVG_NS || root.localName !== 'svg' || doc.getElementsByTagName('parsererror').length) return null;
  [...root.querySelectorAll('*')].reverse().concat(root).forEach(el => {
    if (el !== root && (el.namespaceURI !== SVG_NS || SVG_DROP.test(el.localName) || (el.localName === 'style' && SVG_URL_BAD.test(el.textContent)))) { el.remove(); return; }
    [...el.attributes].forEach(a => { const n = a.name.toLowerCase(), v = a.value;
      if (/^on/.test(a.localName.toLowerCase()) || (/(^|:)href$/.test(n) && !SVG_LINK_OK.test(v)) || SVG_URL_BAD.test(v)) el.removeAttributeNode(a); }); });
  return new XMLSerializer().serializeToString(root);
}
async function receiveMementoArt(data) {
  const a = data.memento || data, id = a.tripId, t = STATE.trips[id];
  if (!t) { showToast('הטיול של התמונה הזו לא נמצא בטלפון'); return; }
  const svg = cleanSvg(a.svg); if (!svg) { showToast('התמונה בקובץ לא תקינה (צריך SVG שלם)'); return; }
  { const m = picModel(id), want = m ? (picLayout(m).marks || []).map(q => q.key) : [], miss = want.filter(k => !svg.includes(`data-pt="${k}"`)); // 4.44.0: my arrangement is locked
    if (want.length && miss.length && /data-pt="/.test(svg)) setTimeout(() => showToast(`${SY.warn} בגרסה המאוירת חסרות ${miss.length} מיקומים מהסידור שלכם. אפשר לשלוח שוב ל-${AI}`), 1800); }
  // undo-history (Q3): a new version sends the one before it to the trash, like a delete - the row keeps a reference, its undo restores it
  const had = MEMO.has('art:' + id); if (had) { await photoToTrash('art:' + id, '', true); if (MEMO.has('art:' + id)) return; } // no room for it in the trash: the old one stays
  await photoPut('art:' + id, { svg, at: Date.now(), by: 'Claude' });
  MEMO_VIEW[id] = { ...(MEMO_VIEW[id] || {}), style: 'art' }; tdOf(id).mementoStyle = 'art'; tdSave(id);
  showUndoToast(SY.claude + ' ' + fileDroppedNote('התקבלה גרסה מאוירת של תמונת הטיול: ' + t.name + (had ? (SEP + 'הקודמת עברה לסל') : ''), data._dropped)); // item 7: one report per receipt // Q6: one toast = one row
  closeSheet(); memoryTrip = id; goTab('memory');
}


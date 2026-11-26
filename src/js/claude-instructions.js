function kitGoalPart(id) { return KIT.paste[id].files[0]; }
// the paste of a goal: its listed files joined (kit.py paste_of does the same)
function kitPaste(goal) { const p = KIT.paste[goal], f = new Map(KIT.files); return p.head + '\n\n' + p.files.map(n => f.get(n).trim() + '\n').join('\n\n'); }
// the skill as a ZIP (a folder "darkon" with every file of the source)
async function kitZip() { const enc = new TextEncoder(), seen = new Set(), out = [];
  KIT.files.forEach(([n, t]) => { const parts = ('darkon/' + n).split('/'); for (let i = 1; i < parts.length; i++) { const d = parts.slice(0, i).join('/') + '/'; if (!seen.has(d)) { seen.add(d); out.push([d, null]); } } out.push(['darkon/' + n, enc.encode(t)]); });
  return zipBytes(out); }
// 4.44.1: big blocks that are rarely needed - the guide, the older "מה חדש" versions, the instructions for Claude and the skill - travel
// packed in the shipped copy. build.py gzips them into PACKED (and minifies the rest); the app unpacks them in the background
// soon after it opens. The readable source keeps them as plain values, so PACKED stays empty there and nothing is unpacked.
const PACKED = {};
let PACKED_OK = !Object.keys(PACKED).length, _packedRun = null;
function b64Bytes(b) { const s = atob(b), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; }
async function gunzipText(b) { return new TextDecoder().decode(await gunzipBytes(b64Bytes(b))); }
const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(u) { let c = 0xFFFFFFFF; for (let i = 0; i < u.length; i++) c = CRC_T[(c ^ u[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
// a ZIP from [name, Uint8Array | null (a folder)]: deflated where the browser can, stored otherwise
async function zipBytes(entries) {
  const enc = new TextEncoder(), parts = [], cen = []; let off = 0;
  for (const [name, data] of entries) {
    const nm = enc.encode(name), raw = data || new Uint8Array(0), crc = crc32(raw); let body = raw, method = 0;
    if (data && data.length && typeof CompressionStream === 'function') {
      try { const c = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer()); if (c.length < raw.length) { body = c; method = 8; } } catch (e) {}
    }
    const h = new DataView(new ArrayBuffer(30)); h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, method, true); h.setUint16(12, 0x21, true);
    h.setUint32(14, crc, true); h.setUint32(18, body.length, true); h.setUint32(22, raw.length, true); h.setUint16(26, nm.length, true);
    parts.push(new Uint8Array(h.buffer), nm, body);
    const c = new DataView(new ArrayBuffer(46)); c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, method, true); c.setUint16(14, 0x21, true);
    c.setUint32(16, crc, true); c.setUint32(20, body.length, true); c.setUint32(24, raw.length, true); c.setUint16(28, nm.length, true); c.setUint32(38, data ? 0 : 0x10, true); c.setUint32(42, off, true);
    cen.push(new Uint8Array(c.buffer), nm); off += 30 + nm.length + body.length;
  }
  const size = cen.reduce((a, u) => a + u.length, 0), e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, entries.length, true); e.setUint16(10, entries.length, true); e.setUint32(12, size, true); e.setUint32(16, off, true);
  const all = [...parts, ...cen, new Uint8Array(e.buffer)], out = new Uint8Array(all.reduce((a, u) => a + u.length, 0)); let p = 0;
  for (const u of all) { out.set(u, p); p += u.length; } return out;
}
function unpackAll() {
  if (PACKED_OK) return Promise.resolve(true);
  return _packedRun || (_packedRun = (async () => {
    try {
      if (PACKED.kit) Object.assign(KIT, JSON.parse(await gunzipText(PACKED.kit))); // 10: the files and pastes of the instructions (the version and the goals stay plain)
      PACKED_OK = true; return true;
    } catch (e) { _packedRun = null; try { logEvent(SY.warn + ' פתיחת ההוראות נכשלה: ' + (e && e.message || e), true); } catch (x) {} return false; }
  })());
}
// the 📋 copy buttons of the instructions (the claude screen, backup, closing, memento, the draft round)
async function copyKit(goal, msg) {
  if (!PACKED_OK && !(await unpackAll())) { showToast('ההוראות לא נפתחו בדפדפן הזה. מרעננים ומנסים שוב'); return; }
  copyWithFallback(kitPaste(goal), msg || 'ההוראות הועתקו'); // 10 (ה2): only the goal's part (and the core it needs)
}
function renderClaudeScreen() {
  if (!PACKED_OK) { document.getElementById('main').innerHTML = `<div class="section-head"><h2>${claudeMark()} ההוראות ל-${AI}</h2><p><span class="spin" aria-hidden="true"></span>טוען את ההוראות…</p></div>`;
    unpackAll().then(ok => { if (activeTab === 'claude') { if (ok) render(); else document.querySelector('#main .section-head p').textContent = 'ההוראות לא נפתחו בדפדפן הזה. מרעננים ומנסים שוב'; } }); return; } // 4.44.1
  // 8.0.0 (ה17): only what belongs to the whole app - installing the skill, reading the instructions, tips. Copying is in each
  // Claude window (its goal), building a new trip or destination is on the trips screen (ה13).
  const part = (id, title, files) => accHTML('cl-k-' + id, title, `<pre class="claude-paste" dir="auto">${files.map(n => escH(new Map(KIT.files).get(n))).join('\n\n')}</pre>`, false);
  document.getElementById('main').innerHTML = `<div class="section-head"><h2>${claudeMark()} ההוראות ל-${AI}</h2><p>ההוראות שבעזרתן ה-${AI} בונה ומשפר קבצים לאפליקציה, בשיחה רגילה.</p></div>
  ${accGroupHTML('התקנה', accHTML('cl-skill', '🧩 התקנת הסקיל', `<p class="cl-other">עובדים עם ${isoW('ChatGPT')}, ${isoW('Gemini')}, ${isoW('Copilot')} או ${AI} אחר? ${kitChapterHTML()}</p>
    <p>הסקיל <b>darkon</b> הוא ההוראות, מותקנות פעם אחת בחשבון ה-${AI}. השלבים כאן הם של קלוד, שבו האפליקציה נבדקה. אחרי ההתקנה לא צריך להדביק כלום: מצרפים לשיחה את הקובץ מהאפליקציה, או כותבים מה רוצים ומזכירים "דרכון".</p>
    <ol class="claude-steps" id="clSteps"><li>מורידים את הקובץ (<span id="clSkillKB"></span>הכפתור למטה) ושומרים אותו בטלפון או במחשב.</li>
    <li>נכנסים ל-${isoW('claude.ai')} בדפדפן (בטלפון: ${isoW('Chrome')} או ${isoW('Safari')}; באפליקציה של קלוד אי אפשר להעלות סקיל).</li>
    <li>עוברים לאזור התוספים והסקילים (נקרא היום ${isoW('Plugins')}).</li>
    <li>מעלים שם את הקובץ.</li>
    <li>מוודאים שהסקיל דולק. מעכשיו הוא זמין בכל שיחה, גם באפליקציה של קלוד.</li>
    <li>יצאה גרסה חדשה של ההוראות? מורידים שוב ומעלים במקום הקודם.</li></ol>
    <p class="sh-hint" id="clStepsElse">המסך נראה אחרת? מחפשים בהגדרות של קלוד מקום להעלות סקיל, ומעלים שם את הקובץ.</p>
    <div class="brow export-actions"><button class="btn-nav" id="clSkill" data-act="kit.skill">${msi('download', { size: 18 })} הורדת הסקיל</button></div>
    <div class="accordion cl-others">${kitOtherHTML('cl-gpt', 'ChatGPT', `ב-${isoW('ChatGPT')} עוברים לאזור הסקילים או התוספים (${isoW('Skills')} או ${isoW('Plugins')}).`)}${kitOtherHTML('cl-gemini', 'Gemini', `ב-${isoW('Gemini')} עוברים בהגדרות לאזור הסקילים, באתר או באפליקציה למחשב.`)}${kitOtherHTML('cl-copilot', 'Copilot', `ב-${isoW('Copilot')} של מיקרוסופט עוברים לאזור ${isoW('Agents &amp; Skills')}, אם החשבון מאפשר.`)}${accHTML('cl-any', AI + ' אחר', `<p>מעתיקים את ההוראות מהחלון שממנו שולחים את הקובץ (${msi('content_copy', { cls: 'msi-in' })}), ומדביקים אותן בשיחה עם הקובץ.</p>`, false)}</div>`, true))}
  ${accGroupHTML('ההוראות', accHTML('cl-kit', '📄 הצגת ההוראות ' + tipI('kit.copy', true) + `<small class="acc-sub">גרסה ${KIT.version}</small>`, `<p class="sh-hint">לקריאה בלבד. מעתיקים מהחלון שממנו שולחים.</p>
    <div class="accordion">${part('core', 'הליבה: קריאת קובץ וכתיבתו - לכל המטרות חוץ מהמזכרת', KIT.core)}${(KIT.content || []).length ? part('content', 'כללי התוכן - לבנייה, לסבב שיפורים ולעדכון', KIT.content) : ''}${KIT.goals.map(g => part(g.id, claudeH((TX.claude[g.id] || {}).btn || g.id), [kitGoalPart(g.id)])).join('')}</div>`, false)
  + accHTML('cl-tips', '💡 טיפים', `<ul><li>${claudeH(TX.claude.build.btn)} נמצא במסך הטיולים: שם בונים טיול או יעד חדשים בשיחה עם ${AI}.</li>
    <li>אפשר להתחיל גם מרשימה שכבר יש לכם (מקומות מחבר, רשימה ב-Google Maps): מדביקים אותה בשיחה, וה-${AI} בודק ומשלים.</li>
    <li>מיקומים: ה-${AI} מכניס מיקום מדויק רק ממקור שאפשר להצביע עליו. מקום בלי מיקום מדויק נמצא לפי הכתובת אחרי האישור, ובטיוטה אפשר לתקן.</li>
    <li>בטיול מאורגן היעד קטן בכוונה: בלי לחזור על מה שכבר בתוכנית, רק מה שעוזר בזמן החופשי.</li></ul>`, false))}`;
  const m = document.getElementById('main'); // the screen's own (a lower layer may hold another copy)
  // kit-fixes (11.45.0): the skill's size moved out of its button into step 1 - at 100KB and more it cut the button at 320 wide, 1.5
  kitZip().then(b => { const e = m.querySelector('#clSkillKB'); if (e) e.textContent = `\u2066${Math.round(b.length / 1024)}KB\u2069, `; }).catch(() => {});
}
// skill-install (decisions 2026-11-23 · Installing the skill, for any assistant, Q1-Q2): the steps name no button of Claude (only the
// area's name today, "Plugins", once); the other assistants in folded blocks of one shape - ChatGPT, Gemini (kit-install 3: Gemini takes
// skills), Copilot, each with the same fallback line and "not tested" - and "AI אחר" (copy the instructions; kit-install 2; named "AI", never
// "עוזר" - ride-no-home item 4 (b), decisions 2026-11-20 · Working with any AI assistant, Q1); the link
// to the guide's chapter "עבודה עם AI" opens it (tip.more, the guide's one door)
function kitChapterHTML() { return `<button type="button" class="pw-link" data-act="tip.more" data-v="claude">עבודה עם ${AI}</button>`; }
function kitOtherHTML(key, name, where) {
  return accHTML(key, isoW(name), `<ol class="claude-steps"><li>מורידים את אותו קובץ (הכפתור למעלה).</li><li>${where}</li><li>מעלים שם את הקובץ.</li></ol>
    <p class="sh-hint">המסך נראה אחרת? מחפשים בהגדרות של ${isoW(name)} מקום להעלות סקיל, ומעלים שם את הקובץ.</p><p class="sh-hint">לא נבדק - אם ההעלאה לא עובדת, מעתיקים את ההוראות.</p>`, false); }
// the install window - from every ✳ window's link, the trips screen's card and the draft's line: the instructions screen with it open
function openSkillInstall() { ACC_OPEN['cl-skill'] = true; openScreen('claude', true);
  setTimeout(() => reveal(document.querySelector('.screen-layer #main [data-acc="cl-skill"]') || document.querySelector('#main [data-acc="cl-skill"]'), false, { align: 'start', instant: true }), 50); }
// ה13: building a new trip or destination - a Claude window from the trips screen (no file goes out: only 📋)
function openBuildWin() { layerNote(openBuildWin, arguments); partsWin(fmNew({}), { key: 'openBuildWin', title: claudeH(TX.claude.build.btn), goal: 'build' }); }
act('claude.build', () => { openBuildWin(); return 'quiet'; });
act('kit.skill', async () => { if (!PACKED_OK && !(await unpackAll())) return;
    if (await deliverFile(new Blob([await kitZip()], { type: 'application/zip' }), `darkon-${KIT.version}.zip`, 'application/zip')) { logEvent('הורד הסקיל darkon ' + KIT.version, true);
      devSet({ kitDl: KIT.version }); kitDotSync(); if (!kitCardDue()) { const c = document.getElementById('kitCard'); if (c) c.remove(); } } }); // skill-install (Q4): the card and the dot go

// the doors of every Claude window (claude-part.js draws them): 📋 and the install link
act('kit.copyGoal', c => copyKit(c.v, 'ההוראות הועתקו. מדביקים בשיחה חדשה עם ה-' + AI + ', ואז מצרפים את הקובץ'));
act('kit.install', () => { openSkillInstall(); return 'quiet'; }); // ה14: the one place to install, over the window (skill-install: opened, from the card and the draft too)
setTimeout(unpackAll, 1200); // 4.44.1: the packed kit unpacked in the background - inside the page soon after the first screen, on the site soon after the AI group came (diet-mechanism)

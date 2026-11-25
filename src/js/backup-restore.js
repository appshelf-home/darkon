// ---- restore (ק14): a backup - which parts come back; a chosen part replaces what is here, one not chosen stays ----
function openRestore(raw) { layerNote(openRestore, arguments);
  const data = raw, keys = PART_LIST.filter(k => data.parts[k]); if (!keys.length) { showToast('אין בקובץ חלקים לשחזור'); return; }
  const F = fmNew({ data }), isEdits = raw.kind === 'edits', other = isEdits || (data.device && data.device !== (STATE.settings.deviceName || ''));
  const body = [fmChecks(F, 'parts', { label: 'מה לשחזר', items: partItems(keys, k => PART_INFO[k].count(data.parts[k])), value: keys }),
    fileDroppedHTML(data._dropped), // A6
    keys.includes('edits') ? fmChips(F, 'mode', { label: PART_INFO.edits.label, value: other ? 'merge' : 'replace', options: [['merge', 'מיזוג עם שלי'], ['replace', 'החלפה']] }) : ''];
  // 10.9.0 (design-forms, gap 60, design-gaps Q18): a short title with the line icon and ⓘ, the source on its own line, one explanation line
  partsWin(F, { key: 'openRestore', title: `♻️ ${isEdits ? 'שחזור עריכות' : 'שחזור מגיבוי'} ${tipI('restore.how')}`,
    intro: `<span class="pw-src">${[data.device ? 'מ' + escH(data.device) : '', data.createdAt ? tmFmt('date', data.createdAt) : '', data.appVersion ? 'גרסה ' + escH(data.appVersion) : ''].filter(Boolean).join(SEP)}</span><br>חלק שבוחרים מחליף את מה שיש עכשיו; חלק שלא בוחרים לא משתנה.`,
    body, send: { act: 'restore.go', label: msi('restore', { size: 18 }) + ' שחזור' } });
}
act('restore.go', c => { const F = fmOf(c.el); if (!F) return; const data = F.opts.data, parts = fmGet(F, 'parts') || [];
  if (!parts.length) return fmFailLine(F, 'בחרו לפחות חלק אחד');
  const merge = parts.includes('edits') && fmGet(F, 'mode') === 'merge', rest = merge ? parts.filter(k => k !== 'edits') : parts;
  closeSheet();
  if (rest.length) applyRestore(data, rest);
  if (merge) setTimeout(() => openEditsReview(data.parts.edits.edits, data.device || data.signature || 'הקובץ'), 300); });
// ---- the backup and restore screen (ק14): status, one prominent "backup now", what goes in, the reminder, restore ----
var BK_FORM = null;
function renderSyncTab() {
  const main = document.getElementById('main'), F = BK_FORM = fmNew({}), last = STATE.lastBackupAt ? `הגיבוי האחרון: ${tmFmt('date', STATE.lastBackupAt)}` : 'עוד לא נשמר גיבוי';
  const h3 = (ic, t) => `<h3 class="bk-h">${msi(ic, { size: 22 })}${t}</h3>`; // 10.3.0 (design-3): a menu screen of three cards
  main.innerHTML = `<div class="section-head"><h2>${msi('cloud_upload')} גיבוי ושחזור</h2></div>
    <div class="card bk-status">${h3(STATE.lastBackupAt ? 'cloud_done' : 'cloud_off', last)}<p class="sh-hint">הנתונים שמורים רק בטלפון הזה. גיבוי הוא קובץ ששומרים בוואטסאפ או ב-Drive.</p>
      <div class="brow export-actions"><button type="button" class="btn-nav bk-now" id="bkNow" data-act="backup.now">${msi('save', { size: 18 })} גיבוי עכשיו</button></div>
      ${fmSec(F, 'what', { title: 'מה נכנס', sum: F2 => { const v = fmGet(F2, 'parts') || []; return v.length === PART_LIST.length ? 'הכל ▾' : v.length ? `${v.length} מתוך ${PART_LIST.length} ▾` : 'כלום ▾'; } },
        fmChecks(F, 'parts', { items: partItems(PART_LIST, k => PART_INFO[k].count(partOut(k, SCOPE_ALL))), value: PART_LIST, hint: 'לא נכנסים: הסל, הטיוטה, הבחירות של הטלפון הזה ומה שנבנה מחדש מהרשת.' }))}</div>
    <div class="card">${h3('alarm', 'תזכורת לגבות')}<p class="sh-hint">רק כשמשהו השתנה מאז הגיבוי האחרון.</p>${prefRowHTML('backup', true)}</div>
    <div class="card bk-restore">${h3('settings_backup_restore', 'שחזור')}${importDoorHTML('restore', 'שחזור מקובץ')}</div>`;
  fmAttach(F, main);
}
act('backup.now', async () => { const parts = BK_FORM ? (fmGet(BK_FORM, 'parts') || []) : PART_LIST;
  if (!parts.length) { showToast('בחרו לפחות חלק אחד'); return; }
  if (await saveBackupFile(parts)) { showToast('הגיבוי נשמר'); redrawSoon(); } });

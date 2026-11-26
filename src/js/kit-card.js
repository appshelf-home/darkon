// skill-install (Q4-Q5): which kit this device's AI has. Kept per device (registry row 'skill', never in a backup or a trip file): the kit
// version last downloaded here (kitDl), the newest kitVersion on a file that came back from an AI (kitSeen), the kit version at which the
// card was put off (kitDismiss). A skill user = either of the first two. Only a rise by y or x counts; a z rise is told by nobody.
function kitBehind(v) { const a = String(v || '').split('.').map(Number), b = String(KIT_FACTS.version).split('.').map(Number);
  if (a.length !== 3 || a.some(n => !Number.isInteger(n))) return '';
  return a[0] < b[0] ? 'x' : a[0] === b[0] && a[1] < b[1] ? 'y' : ''; }
function kitHave() { const a = DEV.kitDl || '', b = DEV.kitSeen || ''; return !a ? b : !b ? a : versionLess(a, b) ? b : a; }
function kitStale() { return !!kitHave() && !!kitBehind(kitHave()); } // the ⋮ dot: until the skill is current
function kitCardDue() { return kitStale() && (!DEV.kitDismiss || !!kitBehind(DEV.kitDismiss)); } // the card: and not put off at this kit
function kitSeenFile(v) { if (/^\d+\.\d+\.\d+$/.test(String(v || '')) && (!DEV.kitSeen || versionLess(DEV.kitSeen, v))) devSet({ kitSeen: v }); }
function kitDotSync() { const d = document.getElementById('kitDot'); if (d) d.hidden = !kitStale(); }
// the card on the trips screen, in the shape of the welcome-back card
function kitCardHTML() {
  if (!kitCardDue()) return '';
  return `<div class="today-card wb-card kit-card" id="kitCard"><div class="tc-title">${msi('extension', { size: 20 })}יש הוראות חדשות ל-${AI}</div>
    <p class="wb-sum">כדי שה-${AI} יעבוד לפי הגרסה החדשה, מורידים שוב את הסקיל ומעלים אותו במקום הקודם.</p>
    ${cardActionsHTML({ id: 'kitCardDl', act: 'kit.skill', label: `${msi('download', { size: 18 })} הורדת הסקיל` }, [{ id: 'kitCardHow', act: 'kit.install', label: 'איך מתקינים' }, { id: 'kitCardLater', act: 'kit.later', label: 'לא עכשיו' }])}</div>`; // card-actions (merged after skill-install): the primary at full width, the two others as text in halves
}
act('kit.later', () => { devSet({ kitDismiss: KIT_FACTS.version }); kitDotSync(); showUndoToast('בסדר. נזכיר כשיהיו שוב הוראות חדשות'); return 'redraw'; });
// every file the app sends for Claude carries a short English note at its top (ignored on import) - standard 4.27.0
// 10 (ה5, ה6, ה9): the line is built from the goals table; the file also carries kitVersion, the instructions version it needs
function claudeHeader(goal, kind) { const h = goal && KIT_FACTS.headers[goal];
  return `A ${kind} file of the Hebrew trip app "מחתימים דרכון" (Darkon), for instructions ${KIT_FACTS.version} (kitVersion). ${h ? h + ' ' : 'To build, complete or update it with an AI assistant: '}Use the skill "darkon"; without it, ask the user to paste the instructions from the window they sent this file from (📋 העתקת ההוראות).`; }
function withClaude(obj, goal, kind) { const out = { _claude: claudeHeader(goal, kind || obj.kind) };
  Object.keys(obj).forEach(k => { if (k === 'kitVersion') return; out[k] = obj[k]; if (k === 'appVersion') out.kitVersion = KIT_FACTS.version; }); if (!out.kitVersion) out.kitVersion = KIT_FACTS.version; return out; } // 10.8.0: always this app's instructions version (a file that came with an older one kept it)

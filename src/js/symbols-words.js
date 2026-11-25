// MS_MORE: format_size door_open commute pin_drop dashboard timer_off install_mobile polyline track_changes route ios_share image photo_library new_releases edit_note download_for_offline monitor_heart delete_forever event_busy schedule undo delete straighten feedback bug_report help person push_pin satellite_alt terrain library_add expand_less landscape thermostat key currency_exchange search monitor_heart door_front tune extension lightbulb layers expand_more check alarm arrow_back block event_upcoming settings_backup_restore cloud_done flight_takeoff near_me hourglass_top edit_calendar event_available check_circle partly_cloudy_day download_for_offline schedule hotel map view_agenda install_mobile cloud_upload history settings contrast light_mode explore new_releases keyboard_arrow_up add undo search inventory_2 flight auto_awesome cloud_off edit_note waving_hand luggage bottom_navigation rocket_launch more_vert location_on map calendar_month info inbox photo_album wb_sunny partly_cloudy_day dark_mode schedule train directions_bus directions_car directions_boat directions_walk restaurant self_improvement airport_shuttle hotel local_activity theater_comedy event directions_transit sticky_note_2 edit navigation travel_explore menu_book track_changes map visibility_off add_circle calendar_month hotel info check_circle today more_horiz palette route auto_stories ios_share chat back_hand groups content_paste content_copy location_city description download image crop link save photo_camera star delete public restore redeem close swap_vert mail print smartphone  draw flight_land warning delete_forever cleaning_services wb_twilight home wrong_location water_drop air umbrella apparel tour shopping_cart task_alt directions_subway signal_cellular_alt power translate tips_and_updates ac_unit hiking forest kayaking downhill_skiing sailing castle festival volcano mosque synagogue temple_buddhist temple_hindu surfing pool health_and_safety- for tests/msfont.py: icons used other than by a literal name in an msi call or ICON_MS (the logo's plane; 10.1.0 (design-1) part C: the dialog's and the tour steps' ic)
const MS_SZ = { 16: ' s16', 18: ' s18', 20: '', 22: ' s22', 24: ' s24' };
// 11.5.0 (schedule-proposal, Q7; look/icons.md "Icons"): an icon that shows direction is mirrored right-to-left (Material): the code names
// the icon as in a left-to-right UI (arrow_back = back, chevron_right = onward, send ...; undo is the symbol of undoing, not a direction - the owner, 8.11.2026 - and compass arrows are physical) and every icon of this set is drawn mirrored
// (.msi-dir). The one list; guard t1054.
const MS_DIR = new Set(['arrow_back', 'arrow_forward', 'chevron_right', 'chevron_left', 'send', 'reply', 'login', 'logout', 'flight_takeoff', 'flight_land', 'directions_walk']);
function msi(name, o) { o = o || {}; const g = name === 'giraffe' ? GIRAFFE_SVG : name === 'israel_flag' ? IL_FLAG_SVG : MS_CP[name] ? '&#x' + MS_CP[name] + ';' : ''; // one icon: o.fill (filled = on), o.size 16-24, o.cls
  return `<span class="msi${MS_DIR.has(name) ? ' msi-dir' : ''}${o.fill ? ' fill' : ''}${MS_SZ[o.size] || ''}${o.cls ? ' ' + o.cls : ''}" aria-hidden="true">${g}</span>`; }
// final-review-fixes (finding 20): a button while it waits - its line icon stays in every state (waiting, done, failed), only the words
// change (text; null = an icon-only button keeps its icon and shows aria-busy). Returns the way back to the button as it was.
// Never write a button's textContent when it carries an icon: the icon font's private-use character would be read back as text.
function btnBusy(b, text) { const h = b.innerHTML, ic = b.querySelector(':scope > .msi'); b.setAttribute('aria-busy', 'true');
  if (text != null) { b.textContent = ''; if (ic) { b.appendChild(ic); b.appendChild(document.createTextNode(' ')); } b.appendChild(document.createTextNode(text)); }
  return () => { b.removeAttribute('aria-busy'); b.innerHTML = h; }; }
function msiT(name, word, o) { o = o || {}; return msiTie(msi(name, { ...o, cls: 'msi-in' + (o.cls ? ' ' + o.cls : '') }), word); }
// size-fixes-2 (2): an icon already drawn (typeIcon, itemIcon - a name known only at run time) tied to its word the same way; its first
// word is plain text up to its first space; a word that starts with markup (a time in its <bdi>) is tied whole - pass it alone
function msiTie(ic, word) { if (!ic.includes(' msi-dir') && !ic.includes('<svg')) return ic + '\u00a0' + word; // a box: a mirrored icon, or a drawn one (the giraffe's or the flag's SVG) - Chrome breaks after either
  const m = /^([^\s<]+)([\s\S]*)$/.exec(String(word)); return m ? `<span class="msi-tie">${ic}\u00a0${m[1]}</span>${m[2]}` : `<span class="msi-tie">${ic}\u00a0${word}</span>`; } // size-fixes (2): a mirrored icon is a box (msi-dir), and Chrome breaks a line after a box even before a no-break space ("🚶" alone at a line's end from "גדול") - so it is tied to its first word // final-review-fixes (family C): a line icon and its word inside a line of text - one word space, never broken apart (look/icons.md "An icon beside its word")
function emptyHTML(ic, line, cls, title) { return `<div class="empty${cls ? ' ' + cls : ''}">${ic}${title ? `<div class="empty-t">${title}</div>` : ''}<div class="empty-l">${line}</div></div>`; } // 10.3.0: an optional title // 10.1.0 (design-1): an empty state - a large quiet icon (an msi) and its line
function claudeMark(o) { return msi('auto_awesome', { cls: 'cl-mark', ...(o || {}) }); } // 10.1.0 (design-1): Claude's one symbol (sparkles), in Claude's color
function claudeH(s) { return String(s).split(SY.claude).join(claudeMark()); } // 10.1.0 (design-1): a text with SY.claude, drawn as HTML (the text form stays for toasts, log lines, titles)
// 5.10.1 (cl-symbols-impl-plan stage 1): the one dictionary of the app's own symbols. Every screen takes its symbols from here
// and writes none of its own; the icons of layers and places (ICON_EMOJI) are content, not part of it. One symbol - one meaning.
// 11.44.0 (any-ai, Q1): the app says "AI" for the assistant, never "קלוד" (but the explanation line TX.aiTested and the guide's chapter
// "עבודה עם AI"). A Latin word inside Hebrew is direction-isolated (FSI…PDI): one form for markup, toasts, titles and log lines - guard t1139.
function isoW(w) { return '\u2068' + w + '\u2069'; }
const AI = isoW('AI');
const SY = Object.freeze({
  days: '🗓️',   // days and planning: the plan, the days picker, scheduling, a date on a card, today
  book: '📅',   // booking
  map: '🗺️',    // a map
  place: '📍',  // a place
  del: '🗑️',    // real deletion (to the trash or for good)
  fav: '⭐',    // favorites
  all: '🌍',    // all the destinations, in picking destinations
  hide: '🙈',   // hidden / not interesting
  gone: '🚫',   // does not exist (5.11.0: only that)
  group: '👥',  // 5.11.0: the group's schedule (it was 🔒)
  closed: '⛔', // 5.11.0: a place that closed (it was 🔒)
  warn: '⚠️',   // a warning; 5.11.0: also limited access (it was 🔒)
  me: '◎',      // my location
  claude: '✳',  // 8.0.0 (ה11): the one symbol of Claude - every Claude button, chip and window (it was a handshake in some)
});
// 5.13.0 (cl-symbols-impl-plan stage 4): the one dictionary of the app's words - one word for every concept (cl-unify-decisions-2 סש4-סש5).
// Not changed: טיול, יעד, קטע, שיבוץ, טיוטה, סימונים, זיכרון (10.3.0: "ארכיון" became "זיכרונות", look.md), סגירת טיול. The guide and "what's new" are written in these words.
const TX = Object.freeze({
  place: 'מקום', places: 'מקומות',       // not נקודה / נקודות
  location: 'מיקום',                     // a point on a map or in the trip picture (not נקודה); only "נקודת מפתח" stays a term
  fav: 'מועדפים',                        // not חובה לביקור
  plan: 'התוכנית',                       // what is planned in the days (not "התוכנית שלי")
  group: 'לו״ז הקבוצה',                  // what came from the tour company (not "לו״ז מאורגן" / "תוכנייה")
  note: 'הערה',                          // not פריט חופשי
  lodging: 'לינה',                       // also an apartment; "מלון" only when it is a hotel
  travel: 'נסיעה', travels: 'נסיעות',    // a flight is a kind of travel
  visited: 'היינו',                      // the app speaks in plural; 10.2.0 (design-2): "היינו" replaces "ביקרנו" everywhere
  actFailed: 'משהו השתבש בפעולה, נסו שוב',   // 6.1.0: an action that failed (the rest of the app goes on)
  tooOld: 'הקובץ מגרסה ישנה מדי ולא נפתח',
  storage: 'אחסון במכשיר',               // storage (decisions 2026-11-23 · Storage on the phone, Q4): the settings section - "device", not "phone"
  noSpace: 'אין מספיק מקום במכשיר',      // storage (Q6): the one message of a write refused for space
  notSaved: 'השינוי לא נשמר במכשיר',     // a write that failed for another reason
  reload: 'נטענים שוב מהרשת כשצריך',   // what can be cleared (Q5)   // 9.0.0 (נ6 ג-ד): a backup or file of a format this version does not read
  // 8.0.0 (ק17, ה12, ה15, ה16): the texts of each Claude goal - the button, the line under a screen button, what Claude will do
  // (two lines, the first opens "בשיחה עם ה-AI"), what to write or attach, and where the file that comes back lands
  aiTested: 'אפשר לעבוד עם כל צ\'אט ' + AI + '. האפליקציה נבדקה עם קלוד ועובדת איתו הכי טוב.', // 11.44.0 (any-ai, Q1): every AI window's explanation line (claudePartHTML) - with the guide's chapter, the only places that name Claude
  claude: {
    build: { btn: SY.claude + ' בניית טיול או יעד',
      will: ['בשיחה עם ה-' + AI + ': מספרים מה רוצים, וה-' + AI + ' שואל על הטעם ובונה טיול, טיול מאורגן מתוכנייה, או יעד.', 'ה-' + AI + ' מחזיר קובץ, והוא נפתח כאן כטיוטה חדשה לבדיקה ולאישור.'],
      write: 'כותבים מה רוצים ומזכירים "דרכון" (למשל "טיול לדרכון, 5 ימים ברומא עם ילדים"), או מצרפים תוכנייה וכותבים "טיול מאורגן לדרכון".', lands: 'נפתח כטיוטה חדשה' },
    round: { btn: SY.claude + ' סבב שיפורים עם ' + AI, // 10.9.0 (design-forms, gap 38): the assistant's word in the button and the window's title (11.44.0: "AI")
      will: ['בשיחה עם ה-' + AI + ': יוצאת הטיוטה כמו שהיא, עם ההערות. מה שהורדתם לא ישתנה.', 'ה-' + AI + ' עונה על כל הערה ועושה רק מה שמסומן למטה.'],
      write: 'מצרפים את הקובץ, לא צריך לכתוב כלום.', lands: 'חוזר לטיוטה הזו' },
    improve: { btn: SY.claude + ' לשיפור', // 10 (ש2): one goal, two kinds of file - the texts by the kind
      write: 'מצרפים את הקובץ, ואם רוצים כותבים מה לעשות. בלי בקשה ה-' + AI + ' משלים את מה שהוספתם ומתקן מקומות שלא על המפה.',
      trip: { will: ['בשיחה עם ה-' + AI + ': יוצא הטיול עם היעדים, העריכות שלכם ומקומות שלא על המפה.', 'ה-' + AI + ' מעדכן לפי תוכנייה חדשה או בקשה, משלים מקומות שהוספתם ומתקן מיקומים, משלים מידע כללי שחסר ובודק שהקיים עדיין נכון - כל שינוי בו רק באישורכם.'], lands: 'מעדכן את הטיול הזה' },
      dest: { will: ['בשיחה עם ה-' + AI + ': יוצא היעד עם העריכות שלכם ומקומות שלא על המפה.', 'ה-' + AI + ' משלים ומתקן לפי הבקשה, משלים מידע כללי שחסר ובודק שהקיים עדיין נכון - כל שינוי בו רק באישורכם.'], lands: 'מעדכן את היעד הזה' } }, // 11.43.0 (info-complete, Q2): the general info on every update
    offMap: n => '+ ' + msi('location_on', { cls: 'msi-in' }) + ' ' + (n === 1 ? 'מקום אחד שלא על המפה (נכנס לבד)' : n + ' מקומות שלא על המפה (נכנסים לבד)'), // 10 (ה8, ה16)
    locate: n => msi('location_on', { cls: 'msi-in' }) + ' לתקן מקומות שלא על המפה (' + n + ')',
    locateSub: 'ה-' + AI + ' מחפש לכל אחד מיקום מדויק ממקור שאפשר להצביע עליו, או מתקן את הכתובת. מה שלא נמצא - בתשובה, עם הסיבה.',
    schedule: { btn: SY.claude + ' לו״ז מה-' + AI, title: SY.claude + ' הצעת לו״ז מה-' + AI, // 11.5.0 (schedule-proposal, Q7)
      will: ['ישאל כמה שאלות קצרות, קודם כל מה אסור לפספס, ויבנה לכל יום סדר ושעות סביב ההזמנות והטיסות.', 'ההצעה תחכה לך בתכנון, והתוכנית שלך לא תשתנה עד שתחליט.'],
      write: 'מצרפים את הקובץ, לא צריך לכתוב כלום.', lands: 'מחכה בראש התכנון כהצעה' },
    memento: { btn: SY.claude + ' גרסה מאוירת',
      will: ['בשיחה עם ה-' + AI + ': יוצאת תמונת הטיול כפי שסידרתם, נעולה: מיקומים, גדלים, שמות ומסגרת.', 'ה-' + AI + ' מצייר אותה באיורים לפי הבקשה שלכם.'],
      write: 'מצרפים את הקובץ, הבקשה כבר בתוכו.', lands: 'נכנסת לזיכרון, כגרסה המאוירת' },
  },
});
// 5.13.1 (cl-symbols-impl-plan stage 5): the page's own markup takes its symbols and words from the dictionaries too (the bottom bar)
document.querySelectorAll('[data-ms]').forEach(e => e.insertAdjacentHTML('afterbegin', msi(e.dataset.ms, { size: e.classList.contains('menu-item') ? 20 : 24 }))); // 10.3.0 (design-3): the bars' line icons
document.querySelectorAll('[data-sy]').forEach(e => { if (e.dataset.sy === 'claude') e.outerHTML = claudeMark(); else e.textContent = SY[e.dataset.sy] || ''; }); // 10.1.0 (design-1): Claude's mark
document.querySelectorAll('[data-tx]').forEach(e => { e.textContent = TX[e.dataset.tx] || ''; });

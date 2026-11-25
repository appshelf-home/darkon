// 9.6.0 (12ו): the explanations mechanism. One dictionary (TIPS) for every ⓘ text, one-time hint, screen intro and symbol name; one
// bubble for all of them (showChipBubble): ⓘ (tipI + the action "tip" → showTip: anchored with an arrow, stays until a tap elsewhere
// or on the ⓘ again, at most one link at the bottom - "עוד במדריך ›" (more: a guide chapter) or a service window (svc)); a tap on a
// symbol that is not a button (symTip, the same action); a one-time hint anchored to what it teaches (hintOnce; seen kept in DEV.hints
// through hintSeen / hintMark); a screen intro with "הבנתי" (introMaybe); the name of an icon-only button on a long press (lpName).
// Mechanism map "הסברים"; guards: t880 (3), t900
const SAVED_HERE = 'שינוי בתוכנייה נשמר רק בטלפון הזה, ונשאר גם כשקובץ הטיול מתעדכן. ↺ חזרה למקור בעורך מבטל אותו.';
const TIPS = Object.freeze({
  // the opening tour (batch 16) - four steps, with a trip and in an empty app
  'tour.welcome': 'כל הטיולים במקום אחד. כל ✓ היינו הוא עוד חותמת בדרכון.',
  'tour.wrong': 'ה-\u2068AI\u2069 ושירותי המפות יכולים לטעות. לפני שהולכים, בודקים בגוגל מפות שהמקום פתוח ושהמיקום נכון.', // 11.17.0 (content-may-be-wrong, Q5/Q8): the welcome step's sentence
  // 11.17.0 (content-may-be-wrong; decisions 2026-11-15 Q2-Q8): content that comes in may be wrong - a quiet line only where it comes in
  'wrong.draft': 'את זה כתב ה-\u2068AI\u2069, והוא יכול לטעות. בודקים לפני שמאשרים.', // under the draft's stat tiles, a file from Claude only (Q6)
  'wrong.claude': 'ה-\u2068AI\u2069 יכול לטעות. בודקים לפני שמאשרים.', // the end of "what Claude will do" in every Claude window (Q7)
  'wrong.pick': 'כדאי לוודא על המפה שזה המקום הנכון.', // beside a form's small map, right after a search result is picked (Q4)
  'wrong.official': 'את זה כתב ה-\u2068AI\u2069. מספרי חירום, טלפונים ובריאות כדאי לוודא במקור רשמי לפני הנסיעה.', // limits-and-safety (D4; decisions 2026-11-24 · Review of the legal-review-2 report, Q12): at the top of General's safety and embassy sections
  'tour.tripsHere': 'כאן מופיעים כל הטיולים: הטיול הפתוח בכרטיס גדול, הבאים מתחתיו, ובסוף הזיכרונות והיעדים. מכל מסך אחר חוזרים לכאן בכפתור הטיול שבראש המסך.',
  'tour.trips': 'כאן עוברים בין טיולים, פותחים טיול חדש ומגיעים לטיולים שהסתיימו. כל מה שבסרגל התחתון שייך לטיול שכתוב כאן.',
  'tour.start': 'מייבאים קובץ שקיבלתם, או בונים טיול או יעד בשיחה עם \u2068AI\u2069. ' + SY.claude + ' מסמן כל מה שנעשה עם ה-\u2068AI\u2069.',
  'tour.nav': SY.place + ' מקומות, ' + SY.map + ' מפה, ' + SY.days + ' תכנון ו-ℹ️ כללי. בכל מסך תופיע היכרות קצרה בפעם הראשונה.',
  'report.what': 'הגרסה, המסך, סוג המכשיר, השעה, הרשת, שגיאות אחרונות ומספר אקראי של המכשיר. לא נשלחים הטיולים, המקומות, התמונות ושם המכשיר.', // 10.7.1: the report window's "מה מצורף"
  'tour.menu': '↩️ ביטול של פעולות אחרונות, גיבוי, הגדרות, 📖 המדריך ו-🧭 הסיור הזה שוב. ⓘ ליד כותרת פותח הסבר קצר, ונגיעה ארוכה בכפתור מציגה את שמו.',
  // the screen intros (batch 17) - once, the first time the screen shows content; 🧭 replays 1-4
  'intro.points': 'השבבים הם השכבות: נגיעה מדליקה או מכבה. המשפך פותח סינון, ו-＋ בפינה מוסיף מקום. נגיעה בכרטיס פותחת את כל הפרטים.',
  'intro.map': 'אותם מקומות עם אותו סינון. בחירת ימים מציגה את המסלול, כל יום בצבע משלו. 📚 מה יש כאן מראה מה סביבכם.',
  'intro.plan': 'ציר זמן לכל יום. בחלון הכרטיס ' + SY.days + ' מעביר ליום אחר; לחיצה ארוכה מרימה לגרירה. בין הכרטיסים - הדרך והזמן.',
  'intro.info': 'לפני הטיול: ספירה לאחור. בימי הטיול: מזג האוויר, מה הבא ואיפה ישנים. כאן גם המסלול, הטיסות והמלונות.',
  'intro.draft': 'כל מה שבקובץ מסומן. מורידים מה שלא רוצים, ✏️ מתקנים, ובסוף ✓ אישור הכל.',
  'intro.closing': 'סגירת הטיול הופכת אותו לזיכרון: מסך משלו עם תמונת הטיול, רגעי השיא והמפה של איפה היינו.', // 10.14.0 (guide diet, batch 11/17): the essence
  // one-time hints, anchored to what they teach
  visSwipe: 'נגיעה בעיגול "היינו" בפינת הכרטיס, או החלקה ימינה על הכרטיס, מסמנת שהיינו שם.',
  'hint.drag': 'לחיצה ארוכה מרימה כרטיס, וגוררים אותו למקום אחר.',
  'hint.closedDay': 'אפשר לשחרר כאן, או להחזיק רגע כדי לפתוח את היום.', // 11.27.0 (closed-day-drop): the first closed day's head a card is carried over
  'hint.winBack': 'נפתח באותו חלון: החץ חוזר צעד, ומשיכה למטה סוגרת את כל החלון.',
  'hint.fan': 'אפשר גם לקבץ סיכות במבט רחוק · הגדרות ← התאמה אישית ← קיבוץ סיכות',
  // batch 1 - the opening screen; batch 2 - the trips screen
  // 11.9.0 (timeline-import, decisions 2026-11-07 Q2-Q4 and addendum): Google Timeline - the sheets' paragraphs and the privacy lines
  'tl.why': 'אם ציר הזמן דלוק בזמן הטיול, בסגירה הוא ממלא איפה ' + TX.visited + ' ומצייר את המסלול האמיתי. אחרי הטיול כבר מאוחר להדליק.',
  'tl.export': 'מייצאים את ציר הזמן לקובץ בטלפון, ובוחרים אותו כאן. נקראים רק ימי הטיול.',
  'tl.keep': 'ציר הזמן מוחק בדרך כלל כל יום אחרי 3 חודשים. כדאי להאריך את זמן השמירה בהגדרות שלו, או לייבא סמוך לסוף הטיול.', // 11.10.0 (Q3, decisions 2026-11-13)
  'tl.privacy': 'נקראים רק ימי הטיול, והקובץ עצמו לא נשמר. רק מקומות שלא היו ברשימה נשלחים לשירות השמות, כדי לקבל שם. עם הטיול נשמרים המסלול המקוצר, השעות במקומות ש' + TX.visited + ' בהם והק״מ ברגל.', // 11.10.0 (Q2, Q3)
  'tl.late': 'ציר הזמן של גוגל שומר בדרך כלל 3 חודשים · כדאי לייבא לפני שהימים הראשונים יימחקו.', // 11.10.0 (C7, Q3)
  'ride.tl': 'מציר הזמן של גוגל: המרחק של כל נסיעה כפי שנרשם', // ride-km (Q1, Q4): the breakdown's line
  'ride.est': 'משוער: קו ישר בין שני הקצוות של כל נסיעה ברשימת הנסיעות. ייבוא מציר הזמן של גוגל נותן את המרחק האמיתי',
  'ride.mixed': 'חלק מציר הזמן של גוגל, וימים שאין בו - משוער לפי הנסיעות (קו ישר)',
  'tl.again': 'לייבא שוב את הקובץ כדי לראות הליכה ונסיעה', // tl-paths (Q5): a trip imported before 11.48.0 - its paths have no walk and ride
  'trips.ended': { t: 'סגירה: עוברים בקצרה על איפה היינו, איך היה ורגעי השיא, והטיול עובר לזיכרונות.', more: 'closing' },
  'trips.dests': { t: 'מוחקים יעד רק כשאף טיול פתוח לא משתמש בו.', more: 'trips' }, // 10.14.0 (guide diet, batch 1): what a destination is lives in the guide's lead
  // ✳ buttons - what goes out and what comes back (batch 1.3, 10.2, 11.4)
  'claude.build': { t: 'בונים בשיחה עם \u2068AI\u2069: טיול, טיול מאורגן מתוכנייה, או יעד. הקובץ שחוזר נפתח כאן כטיוטה.', more: 'claude' },
  // batch 3 - places
  'filter.limited': { t: 'מקומות עם גישה מוגבלת (למשל רק בתיאום, או סגורים לקהל) מוסתרים, אלא אם מדליקים אותם כאן.', more: 'points' },
  // batch 4 - the item window
  'item.mine': { t: 'שיניתם אצלכם את מה שהגיע בקובץ, מהיעד או מהתוכנייה. ↺ חזרה למקור מחזיר את הנוסח שהגיע.', more: 'plan' },
  // symbols that are not buttons: a tap says what they are (batch 4.1)
  'here': 'ההסבר של החלון הזה', // 10.4.0: a window's own explanation (.sh-why) behind its title's ⓘ - tipI('here'); this text only if it has none
  'sym.key': 'נקודת מפתח: מקום מרכזי ביעד',
  'sym.est': '≈ הערכה לפי קו אוויר, עד שיש מסלול אמיתי',
  'sym.tz': '≈ השעון משוער (לפי המדינה ומרכז המפה). "שינוי" בעורך היעד קובע אותו',
  'sym.nextDay': 'הנחיתה ביום אחר, בשעון של המקום',
  'sym.rate.love': '❤️ הדירוג שלכם: אהבתי',
  'sym.rate.like': '👍 הדירוג שלכם: היה טוב',
  'sym.rate.dislike': '👎 הדירוג שלכם: לא שווה',
  // batch 5 - the map
  'route.hidden': 'הקווים ממשיכים לעבור דרך תחנה מוסתרת.',
  'sym.disc.wiki': '📚 ערך בוויקיפדיה',
  'meas.mode': 'טבעות של 10, 20 ו-30 דקות הליכה מהמקום. בסרגל נגיעה במפה מוסיפה נקודה, בסיכה - נצמדת למקום, וגוררים כדי להזיז. לפי הדרכים צריך רשת.',
  'disc.mode': 'מקומות מוויקיפדיה ומהמפה הפתוחה סביב מה שרואים במפה. אחרי הזזה - "חיפוש באזור הזה".',
  'sym.disc.osm': 'פריט קטן מ-OpenStreetMap (פסל, אנדרטה, תצפית)',
  // batch 6 - the plan: scheduling and time windows
  savedHere: SAVED_HERE,
  'sched.multi': 'אפשר גם להשאיר "בלי" ולסדר אחר כך בתכנון. "＋ עוד פעם ביום הזה" מוסיף אותו שוב לאותו יום (למשל בוקר וערב), ו-✕ בשורה מסיר רק אותה.',
  'add.travel': { t: 'נסיעה מביאה אתכם למקום חדש בשעה קבועה, כמו טיסה, רכבת, מעבורת או הסעה. בין מקומות של היום הדרך מחושבת לבד.', more: 'plan' }, // travels-2-plan (Q24 (2)): beside "נסיעה" in the add choice
  'sched.edit': { t: 'שינוי בתוכנייה נשמר רק בטלפון הזה, גם כשהקובץ מתעדכן; ↺ חזרה למקור מבטל אותו. יום ושעה - ב-' + SY.days + ' ובשעה שבכרטיס.', more: 'plan' },
  'note.when': 'יום, חלק ביום ושעה - בשורת המצב של חלון הפרטים.',
  // batch 7 - the plan: days, legs, notes
  'arr.dates': 'בתאריכים קבועים, יום שנוסף דוחף את האחרון של היעד ל"מחוץ לטיול". טיסות ולינות נשארות בתאריך.',
  'arr.fixed': 'טיסות ולינות קשורות להזמנות ונשארות בתאריך. לו״ז הקבוצה יכול לזוז עם היום - נשאלים בכל הזזה של יום שיש בו לו״ז.',
  'note.noTime': 'בלי שעה, ההערה נכנסת ל"עוד לא שויך" ואפשר לשייך אותה לחלק היום.',
  'parked': { t: 'נגיעה ביום פותחת אותו: לכל מקום ' + SY.days + ' לשבץ ביום אחר. אפשר גם להחזיר יום שלם.', more: 'plan' },
  // batch 8 - general and weather
  'info.sched': 'מה שהסרת מהתוכנית לא מופיע כאן.',
  'info.wx': 'התחזית נשמרת בטלפון ומוצגת גם בלי רשת. התצוגה נקבעת בהגדרות ← מזג אוויר.',
  // batch 9 - editors
  'te.segs': { t: 'יום מעבר שייך ליעד שאליו מגיעים, ו-＋/− ביעד מוסיפים או מורידים יום בסוף שלו.', more: 'trips' },
  'te.roadFirst': { t: 'יום שכולו טיסה או נסיעה. הוא שייך ליעד הראשון, בתכנון יש בו רק הנסיעה, והוא לא נספר כיום ביקור.', more: 'trips' }, // 11.24.0 (road-days-wording Q3): one ⓘ per row (was 'te.road' on the section title)
  'te.roadLast': { t: 'יום שכולו טיסה או נסיעה. הוא שייך ליעד האחרון, בתכנון יש בו רק הנסיעה, והוא לא נספר כיום ביקור.', more: 'trips' },
  'te.leg': 'בתכנון, קטע שארוך מדי להליכה יחושב בדרך הזו.',
  // batch 10 - the draft and the improvement round
  'draft.what': { t: 'קובץ שהגיע מחכה כאן עד שמאשרים: שום דבר ממנו עוד לא נכנס לטלפון. אפשר לסגור ולחזור אליו מהפס שבראש המסך.', more: 'draft' },
  'draft.proposal': { t: 'ה-\u2068AI\u2069 שלח גם הצעת לו״ז. אחרי האישור היא תחכה לך בתכנון לעיון, והתוכנית שלך לא תשתנה עד שתחליט. מקום שתוריד כאן ירד גם מההצעה.', more: 'plan' }, // 11.5.0 (schedule-proposal, Q9)
  'claude.round': { t: 'שולחים את הטיוטה עם ההערות, והקובץ שחוזר נכנס לאותה טיוטה.', more: 'draft' },
  'note.claude': 'ה-\u2068AI\u2069 יקרא את ההערה בסבב השיפורים הבא ויענה עליה.',
  // batch 11 - closing and memory
  'closing.more': 'מקום של הטיול שעוד לא ברשימה, או מקום חדש מהחיפוש - הוא נכנס לרשימה מסומן "' + TX.visited + '". מקום חדש נוסף לטיול, ואפשר לערוך אותו אחר כך.', // closing-where (11.26.0, Q6)
  'hint.cover': 'הראשונה היא תמונת השער. לחיצה ארוכה וגרירה משנה את הסדר.',
  'claude.memento': { t: 'מורידים קובץ, שולחים ל-\u2068AI\u2069, ומחזירים לכאן את התמונה.', more: 'memory' },
  'art.locked': 'נעול: מיקומים, גדלים ושמות שערכתם. חופשי: עיבוד התמונות, מסגרות, צל, טיפוגרפיה, עיטורים, רקע ואפקטים על המסלול.',
  // batch 12 - the trip picture editor
  'hint.picPoint': 'נגיעה במיקום בתמונה פותחת אותו לעריכה.',
  'hint.crop': 'נגיעה בתמונה מגדילה אותה, ו-✂️ חותך.',
  'pic.levels': 'הגודל בתמונה לפי הרמה. נגיעה בשם פותחת את המיקום: שם, תמונה, הזזה, איחוד.',
  'pic.foreign': 'שמות לועזיים מהנתונים. מה שחסר נשאר כאן בעברית, וה-\u2068AI\u2069 מתרגם בגרסה המאוירת. שם שערכתם נשאר כמו שכתבתם.',
  'pic.look': 'מראה אחד לכל התמונות שבמיקומים. 🎨 מצויר כאן הוא קירוב; בשליחה לאיור ה-\u2068AI\u2069 מצייר אותן באמת, באותו כיוון.',
  // batch 13 - Claude and file windows
  'kit.copy': 'כל חלון מעתיק רק את מה שהמטרה שלו צריכה, ולכן "העתקת ההוראות" נמצא בחלון שממנו שולחים את הקובץ.',
  // batch 14 - the ⋮ windows
  'restore.how': 'היומן לא מוחלף אלא מתמזג: השורות מהגיבוי נוספות לאלה שכבר כאן.', // 10.9.0 (design-forms, gap 60)
  'set.esri': 'בלי מפתח משלכם הלוויין עובד דרך המפתח של האפליקציה. מפתח משלכם נשמר רק בטלפון הזה, לא בגיבוי ובקבצים.',
  'set.hidden': '"מוסתרים" חל על הרשימה ועל המפה; שכבת אוסף ממשיכה לספור אותם.',
  offmaps: { t: 'בלי רשת: איפה שכבר ראיתם מוצגת המפה הרגילה, והשאר מהמפה שהורדה (פשוטה יותר).', svc: 'offmaps', label: 'פרטים על השירות ›' },
  'layers.order': { t: 'בלי סידור ידני: לינה ראשונה, אחריה שכבות הבסיס בסדר קבוע, ואחריהן הייחודיות לפי מספר המקומות. מסדרים בגרירה ⠿.', more: 'layers' },
  // 10.15.0 (design-review Q6): the layer editor's "סוג" and "שכבת אוסף" - an ⓘ instead of a line always shown
  'layer.type': 'שכבת בסיס היא אחת משש קבוצות קבועות, כמו אוכל או אטרקציות. היא משותפת לכל היעדים, ובטיול עם כמה יעדים מתאחדת לשבב אחד. ׳ייחודית ליעד׳ היא שכבה של היעד הזה בלבד.',
  'layer.coll': 'השבב של השכבה מראה כמה מהמקומות שלה סימנתם ׳היינו׳ מתוך כולם, למשל 20/47. מתאים לאוספים כמו פסלונים או תצפיות. המונה נשמר גם בתמונת הטיול.',
/*TIPS-ITEMS*/
});

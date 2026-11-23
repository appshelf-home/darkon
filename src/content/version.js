const APP_VERSION = '11.47.0';
const APP_DATE = '22.11.2026'; // this version's date (settings' "עודכן", the copyright years; build.py reads it) - 10.14.0: no longer from "מה חדש", which may be empty
const CHANGELOG = [ // 10.14.0 (guide diet Q5): empty until the first version distributed to someone (the owner decides; app.json activeUsers) - from
  // then one entry per update a user receives (the open entry is updated while unreleased; a line a later change made untrue is dropped)
  // 11.15.1: the first entry (a first user since 15.11.2026) - the update from the released 11.13.0: 11.14.0, 11.15.0 and 11.15.1 together;
  // 11.16.0 (phone-round-1-followups) joins the same release: the entry moves to it, and gains no line - its changes (a number on a very
  // light layer colour, an unnamed Timeline offer, one status line at 320, obsolete country codes) are in "small fixes" or unseen
  // 11.17.0 (night chain step 2: review-11.16.0-followups + content-may-be-wrong) joins the same release: the entry moves to it and gains one
  // line, the notes that content may be wrong; the country table and the unnamed place's stored name are unseen
  // 11.18.0 (night chain step 3: timeline-offers + place-hide-delete) joins the same release: the entry moves to it and gains two lines
  // 11.19.0 (night chain step 4: trip-travel-days + small-fixes 21) joins the same release: the entry moves to it and gains two lines
  // 11.20.0 (night chain step 5: place-search-upgrade) joins the same release: the entry moves to it and gains one line
  // 11.21.0 (review-night-chain-followups) joins the same release: the entry moves to it; the search line says the way out at the end of every
  // list and the form kept across Google Maps; Israel's polygon, the one "from Claude" test and the last day's suggestion are unseen
  // 11.21.1 (form-keep-everywhere) joins the same release: the entry moves to it and gains no line - the search line already says "the same
  // form as you left it"; every form now does so, a stale form is gone, the Claude copy's quieter row and the polygon's border are unseen
  // 11.21.2 (test-address) joins the same release: the entry moves to it and gains no line - the test marks are seen only on the test app
  // 11.21.3 (form-keep-context) joins the same release: the entry moves to it and gains no line - the search line already says "the same
  // form as you left it", now true for a new place's day and suggestions too; the polygon's Jordan Valley points are unseen
  // 11.21.4 (backup-ids) joins the same release: the entry moves to it and gains one line - a backup with a destination named in Hebrew
  // (or a picture point named in letters with spaces) was refused by 11.13.0 and now always restores
  // 11.21.5 (time-zone-cache) joins the same release: the entry moves to it and gains one line - the plan draws about four times faster
  // (a day with a travel no longer builds thousands of time-zone formatters per redraw; on a phone it could freeze and close the app)
  // 11.21.6 (phone-round-2-fixes) joins the same release: the entry moves to it and gains one line - a Google link with a name and an
  // address but no point (Google's share links now) finds the place; the badge, the closing's dates and the stored keys are unseen
  // 11.21.7 (phone-round-2b-fixes P2, P3; P1 went to a spec chat): a new entry - 11.21.6 was released; the closing's dates and the
  // offline areas of two hotels in one region are things a user meets. The 11.21.6 line on Google links stays (history); not claimed here
  // 11.22.0 (place-gid-1, chain step 1) joins the same release: the entry moves to it and gains four lines - a place linked to Google Maps
  // (the exact opening, relink and unlink), a share of a place already in the trip, a Google link with no point (decisions 2026-11-18 ·
  // Review of the 11.21.7 summary, Q3: never that it finds the point), the Timeline import by Google's id; the one-time move of ids out of
  // links, the file door and a file's place that is already on the phone ("כבר קיים" in the draft) are unseen or self-explaining
  // 11.23.0 (place-gid-2, chain step 2) joins it too: the entry moves to it and gains one line - places from anywhere are linked in the
  // background; the server, the monthly pause and the re-checks are unseen
  // 11.23.1 (gid-fixes-jordan, night chain 19.11 step 2) joins it too: the entry moves to it and gains no line; the Timeline line drops
  // "ומקום שזוהה לפי המרחק נשמר מקושר" (decisions 2026-11-18 · Review of the 11.22.0 summary, Q1 - a place matched by distance no longer
  // takes the visit's id); a directions link, the day's pause, a destination's update moving a place, Israel's polygon and the plan's
  // first opening after a share are unseen
  // 11.23.2 (phone-round-2b-fixes P4-P14, night chain 19.11 step 3) joins it too: the entry moves to it; the offline-maps line gains the
  // hotel's name (P5); four lines - "איך היה" (P4), every hidden place counted (P7), a travel end's proposal (P11), the route kept (P13) -
  // and one "ועוד" line for the small ones (P9, P12, P10, P8, P14); the underline (P6) is unseen
  // 11.24.0 (small-ui-set, night chain 19.11 step 4; kind y) joins it too: the entry moves to it and gains four lines - the opening screen
  // on a trip day (A), the trip editor's "כולו בדרך" rows (B), "זיכרונות" as a grid (C), the trip picture's map area (D)
  // 11.25.0 (picker-rule, night chain 19.11 step 5; kind y) joins it too: the entry moves to it and gains one line - filters apply at
  // once with no "סיום", a choice that changes the plan or fills a field is kept on "✓ סיום" (replaces nothing: 11.21.6's line was released)
  // 11.26.0 (closing-where, night chain 19.11 step 6; kind y) joins it too: the entry moves to it and gains one line - the closing's "where we
  // were": one mark on every row, "עוד לא סומנו" | "הכל", the Timeline's offers as rows, another place from the search, resuming at the last step
  // 11.27.0 (closed-day-drop, night chain 19.11 step 7; kind y) joins it too: the entry moves to it and gains one line - a plan card dragged
  // onto a closed day: released on its head it moves there, held a moment the day opens
  // 11.28.0 (area-search, night chain 19.11 step 8; kind y) joins it too: the entry moves to it and gains one line - the destination's centre
  // and the picture's city search areas, each row with its kind and country, a pick fills the empty country and name, "לחפש גם מקומות"
  // 11.28.1 (sched-draft-all; kind z) joins it too: the entry moves to it and gains no line - 11.25.0's line says the scheduling window is kept
  // on "✓ סיום" and now names all of it: days, parts of the day, times, a row's ✕ and another time in the same day
  // 11.28.2 (area-search-he; kind z) joins it too: the entry moves to it and gains one line - an area typed in Hebrew is found through
  // Wikidata's English name, the English hint when nothing is found, and a Google link with a name only searched in the trip's area first
  // 11.29.0 (launch-fast; kind y) joins it too: the entry moves to it and gains one line, first - the app opens from the copy on the phone
  // (also with no signal) on the app's blue launch screen; a new version through the bar or at the next opening. Leaflet's later load is unseen
  // 11.29.1 (sw-bar-quiet; kind z) joins it too: the entry moves to it and gains one line, second (after the opening's) - the bar shows only
  // when the open page is older than the waiting version; the status bar always blue and the install that keeps the saved page are unseen
  // 11.30.0 (wx-one-place; kind y) joins it too: the entry moves to it and gains one line, third (after the bar's) - "מזג אוויר ולבוש" in one
  // place: Claude's words on the climate and what to wear under each destination's months, by the trip's season, sunrise and sunset in every day;
  // "רענון" that always reloads (item 7) is unseen
  // 11.31.0 (photo-frame; kind y) joins it too: the entry moves to it and gains one line, fourth (after the weather's) - each photo's framing,
  // from "מסגור" in the full view; a near day's sunrise and sunset with no forecast (item 7) and the instructions' season names (item 8) are unseen
  // 11.32.0 (place-find; kind y) joins it too: the entry moves to it and gains one line, fifth (after the framing's) - a Google link with no
  // point finds the place by its name in the address's city, never a street's point; the editor's "where" apart from Google's link. The
  // Hebrew search abroad through Wikidata, the place that comes again at the same point (G67) and back after a share (G68) are in the line
  // or unseen
  // 11.33.0 (text-size; kind y) joins it too: the entry moves to it and gains one line, sixth (after the place's) - settings › "גודל טקסט":
  // like the phone (the default, snapped to the five sizes) or a fixed size; the icons, buttons and rows grow with the text
  // 11.34.0 (phone-round-3-fixes; kind y) joins it too: the entry moves to it and gains one line, after the closed day's drag - a line of the
  // group's schedule moves to another day like any card; the other fixes of phone round 3 (the file picker, closing on the last day, the
  // friends' page map line, a refused drop over a closed day, the memories' grid, the report's row, the bottom bar, the switch row, the
  // mark's halves, "היינו בהכל") are fixes, in the lines already there or unseen
  // 11.35.0 (size-fixes; kind y) joins it too: the entry moves to it and gains one line, after the text size's - a place search puts a
  // transit stop named for a place below the place itself; the large sizes' fixes (the map's measuring ways, the way lines' icon and distance,
  // the night's tag, the touch sizes at "קטן") are in the text size's line ("nothing cut") and unseen; the guide's trim is unseen
  // 11.35.1 (size-fixes-2; kind z) joins it too: the entry moves to it and gains no line - every mirrored icon beside text tied to its word
  // (the measuring's walk estimate, the flight countdown, a place's or a program item's icon beside its name) is in the text size's line
  // ("nothing cut") and unseen
  // 11.36.0 (back-exit; kind y) joins it too: the entry moves to it and gains two lines, after the opening screen's - back on a main screen
  // asks for a second press (settings › "יציאה מהאפליקציה"), and a pull down no longer reloads; a trip loaded from a file opening at the
  // top of its screen with the bottom bar is in "ועוד"
  // 11.36.1 (value-no-cut; kind z) joins it too: the entry moves to it and gains no line - a measured value never cut by "…" (the map's
  // measuring title wraps) and a " · " never opening a line are in the text size's line ("nothing cut") and unseen
  // 11.37.0 (phone-round-4-fixes; kind y) joins it too: the entry moves to it and changes one line - the area pick's line says a new pick
  // replaces what an earlier pick filled (P3); the rest is fixes (a memory offers no closing, a day's program places on the filtered map, a
  // report kept without its photo, the tour's whole mark on the bottom bar) or unseen
  // 11.37.1 (back-exit-fix; kind z) joins it too: the entry moves to it and gains no line - the back line already says what happens; no
  // scroll jump at the first back, a confirmation dialog closed by back on its own, and "ביטול" kept under the exit message make it true
  // 11.38.0 (value-tie-source; kind y) joins it too: the entry moves to it and gains one line, before "ועוד" - a distance and a length of
  // time read the same on every screen (one format each: the timeline's "2.5 שע׳" is "2:15 ש׳"), never parted from their unit at a line's end
  // 11.38.1 (code-seams; kind z) joins it too: the entry moves to it and gains no line - parts of the source split at their seams, nothing seen
  // 11.38.2 (privacy-server; kind z) joins it too: the entry moves to it and gains no line - the server functions limited and checked
  // (their new addresses), the map library with its integrity hash, invented test data: nothing a user sees changed
  // 11.39.0 (legal-page; kind y) joins it too: the entry moves to it and gains one line, before "ועוד" - the terms and privacy page and
  // "מקורות ורישיונות" under the version in settings, and the page's link in the report window; the copyright line's name is unseen
  // 11.40.0 (legal-credits; kind y) joins it too: the entry moves to it and gains one line, before "ועוד" - the Commons photos' author and
  // licence in the trip picture and what is sent of it, Wikipedia's text with its source and licence in the friends' pages, their live map from
  // OpenFreeMap and its buttons' icons back; the registry's terms, the map credits' printed address and Open-Meteo's credit are small and in passing
  // 11.41.0 (legal-server; kind y) joins it too: the entry moves to it and gains one line, before "ועוד" - the satellite and relief maps for everyone
  // through the app's own key, offers near home not sent for a name, the fonts from the app itself, and the terms page's update (version 1.2;
  // decisions 2026-11-21 · Review of the legal-page summary, Q2: a page change is named in "מה חדש"); the shared queue on the server, Google's id
  // found inside a box and a Wikipedia photo held back until its credit arrives are unseen or in the lines already there
  // 11.41.1 (phone-round-4b-fixes P1; kind z) joins it too: the entry moves to it and gains no line - a share whose short link the server
  // could not open is found by the name in the share's text, and the share opens sooner; the Google line already says a place from a link
  // with no point is found by its name
  // 11.41.2 (legal-server-fixes; kind z) joins it too: the entry moves to it and gains no line - the 11.41.0 line now says a place near home
  // is not sent for a search also once it is added and named, and the page's version 1.4 (decisions 2026-11-21 · Review of the legal-server
  // summary, Q1: the page's change named in "מה חדש"); the queue's time limit, the edge's wait and the fonts' precache are unseen
  // 11.42.0 (booking-price; kind y) joins it too: the entry moves to it and gains one line, before "ועוד" - booking and price chosen from a
  // list, an entry price with the month it was checked (decisions 2026-11-20 · Booking and price as structured fields, Q4 addition 3: the
  // conversion is silent, one line in "מה חדש" only); the hotel's price per night or for the stay is in the same line's words
  // 11.43.0 (info-complete; kind y) joins it too: the entry moves to it and gains one line, before "ועוד" - the General screen's row for
  // missing general info, sent to Claude, which also checks the existing info with approval; "not relevant" from its ⋮; the season follows
  // the tapped month (work.md info-complete item 5: one line)
  // 11.44.0 (any-ai; kind y) joins it too: the entry moves to it and gains one line, before "ועוד" - work with any AI chat, tested with
  // Claude (work.md any-ai item 5); the entry's own words for the assistant become "AI" (decisions 2026-11-20 · any AI assistant, Q1)
  // 11.44.1 (price-level-note; kind z) joins it too: the entry moves to it and gains no line - a price level with one word in parentheses
  // read as that level, a price note with a digit whole on the card, layout gaps at 320 wide; the 11.42.0 line's words still hold
  // 11.45.0 (kit-fixes; kind y) joins it too: the entry moves to it and gains one line, before "ועוד" - a place's local name under its
  // name, found by the search, with its field in the editor (work.md kit-fixes item 10: one line; the rest - the AI instructions 3.8.0, a
  // program line naming a destination place, a price range read as one level - is silent or in the lines already there)
  // 11.46.0 (phone-round-4c-fixes; kind y) joins it too: the entry moves to it and gains one line, before "ועוד" - a share from Google Maps
  // opens "מקום חדש" at once and says what it is doing until the point fills (P3); back on a main screen, "כמו בטלפון" while the app is
  // open, a quiet place in a destination, "חלקי היום" at ענק and a price word with "ו" are fixes of what the lines already promise (silent)
  // 11.47.0 (off-map-areas; kind y) joins it too: the entry moves to it and gains one line, before "ועוד" - the offline maps' map: each area
  // its number on its row and on its pin, a row tap shows its area, a pin tap zooms in, "כל האזורים" back (work.md off-map-areas item 4)
  { version: '11.47.0', date: '22.11.2026', items: [
    'האפליקציה נפתחת מהר יותר, גם בלי קליטה: מהעותק שבטלפון, על מסך פתיחה בכחול של האפליקציה. גרסה חדשה מגיעה ב"יש גרסה חדשה · רענון" או בפתיחה הבאה.',
    'הפס "יש גרסה חדשה" מופיע רק כשבאמת מחכה גרסה חדשה יותר מזו שפתוחה - ולא אחרי כל עדכון.',
    'מזג האוויר והלבוש במקום אחד, ב"כללי": מתחת לחודשים של כל יעד - מה ללבוש ומה לארוז בעונה של הטיול (שאר העונות מקופלות), וזריחה ושקיעה בכל יום בטיול.',
    'אפשר לבחור איך כל תמונה ממוסגרת: בתמונה במסך מלא, "מסגור" - מזיזים ומגדילים פעם אחת, וכל מקום שמראה אותה (הרשת, תמונת השער, העיגול בתמונת הטיול, תמונת המלון) חותך את הצורה שלו סביב מה שבחרתם.',
    'מקום מגוגל מפות בלי מיקום נמצא לפי השם שלו בעיר של הכתובת - הסניף ברחוב הנכון, עם "נמצא במפה … כדאי לוודא על המפה"; כשלא נמצא, המפה נפתחת על הרחוב ובוחרים בה (לעולם לא נקודה של רחוב). בעריכת מקום, "מיקום" הוא רק איפה המקום, ו"פתיחה בגוגל מפות" עבר ל"פרטים". חיפוש בעברית בחו"ל מוצא יותר מקומות.',
    'אפשר לבחור גודל טקסט: הגדרות › גודל טקסט. "כמו בטלפון" (ברירת המחדל) הולך לפי גודל הגופן של הטלפון, או אחד מחמישה גדלים קבועים, מ"קטן" עד "ענק" - והאייקונים, הכפתורים והשורות גדלים עם הטקסט.',
    'בחיפוש מקום, תחנה שנקראת על שם של מקום (כמו תחנת אוטובוס "אצטדיון סמי עופר") מופיעה אחרי המקום עצמו - חוץ מכשמחפשים תחנה.',
    'ב"מרכז המפה" של יעד מחפשים אזור - עיר, אי, אגם, פארק לאומי או רכס הרים - בכל העולם, וכל תוצאה אומרת מה היא ובאיזו מדינה. הבחירה ממלאת את המדינה (ואיתה מטבע ושעון) ואת השם, ובחירה חדשה מחליפה מה שבחירה קודמת מילאה - מה שבחרתם או כתבתם בעצמכם נשאר. כך גם "עיר שעברנו בה" בתמונת הטיול, ו"לחפש גם מקומות" מחפש את הכל.',
    'חיפוש אזור בעברית מוצא גם אזורים שאין להם שם עברי במפה, כמו כרתים או טוסקנה. כשלא נמצא כלום, מוצעת כתיבה של השם באנגלית. קישור מגוגל שיש בו רק שם המקום מחפש קודם באזור הטיול.',
    'בתכנון, כרטיס שגוררים אל יום סגור: משחררים על השורה של היום והוא עובר אליו, לאותו חלק ביום - או מחזיקים רגע, היום נפתח וממשיכים לגרור לתוכו.',
    'שורה מהלו״ז של הקבוצה עוברת ליום אחר כמו כל כרטיס - בגרירה, גם ליום סגור. בחלון שלה כתוב מאיזה יום הוזזה, ו"חזרה למקור" מחזירה אותה ליום ולשעה שלה.',
    'בסגירת טיול, ב"איפה היינו": סימון אחד לכל מקום (✓ היינו | לא הגענו), "עוד לא סומנו" או "הכל" כדי לתקן, הצעות מציר הזמן מסומנות באותה שורה, "＋ עוד מקום שהיינו בו" מוצא גם מקום שלא היה בטיול - והסגירה נפתחת בשלב שבו עצרתם.',
    'סינון (ימים, יעדים, מקורות) חל מיד, בלי "סיום". שיבוץ מקום לימים - ימים, חלק ביום, שעה, ✕ בשורה ו"עוד פעם ביום הזה" - ו"לבחור ימים" ל-\u2068AI\u2069 נשמרים רק ב"✓ סיום" - כפעולה אחת שמבטלים בבת אחת - וסגירה בלי "סיום" לא משנה כלום.',
    'בימי הטיול האפליקציה נפתחת בתכנון של היום. מי שמעדיף את המקומות של היום בוחר את זה בהגדרות › מסך הפתיחה.',
    'חזור במסך ראשי לא יוצא מיד מהאפליקציה: מופיעה הודעה, ולחיצה נוספת על חזור יוצאת. מי שמעדיף לצאת בלחיצה אחת בוחר את זה בהגדרות › יציאה מהאפליקציה.',
    'משיכה למטה בראש המסך כבר לא מרעננת את האפליקציה.',
    'בעורך הטיול, מתחת לתאריכים, שתי שורות "… כולו בדרך" ליום הראשון ולאחרון, ולכל אחת הסבר משלה.',
    '"זיכרונות" במסך הטיולים: רשת שממלאת את השורה, עד שתי שורות, ו"כל הזיכרונות" פותח את כולם.',
    'המפה בתמונת הטיול מכסה את כל המקומות שהייתם בהם, עם שוליים, ולא מתקרבת יותר מגודל של שכונה.',
    'מקום שהגיע מקישור של גוגל מפות מקושר למקום עצמו בגוגל: "Maps" בחלון המקום פותח בדיוק אותו, ובעריכת המקום אפשר לקשר מחדש או לבטל את הקישור.',
    'גם מקומות מה-\u2068AI\u2069, מהחיפוש או מבחירה על המפה מתקשרים לגוגל מפות לבד, ברקע, כשיש רשת - כשגוגל מכירה מקום באותה נקודה.',
    'שיתוף מגוגל מפות של מקום שכבר ברשימה פותח את החלון שלו, ולא "מקום חדש".',
    'קישור מגוגל שאין בו מיקום שומר את שם המקום ומבקש לבחור אותו על המפה.',
    'ייבוא ציר הזמן של גוגל מזהה מקום מקושר גם כשהוא גדול או צפוף בין מקומות אחרים.',
    'בחלון התאריכים של טיול שהתקיים, היום האחרון לא נקבע אחרי היום - גם כשהטיול תוכנן ליותר ימים.',
    'ב"מפות לשימוש בלי רשת", אזור של מלון נקרא בשם המלון (ושם האזור מתחתיו), ו-✕ עליו מוציא רק אותו - גם כשיש עוד מלון באותו אזור.',
    'בסגירת טיול, "איך היה" מציג כל מקום שסומן "היינו" - גם כשחוזרים אחורה ומסמנים עוד.',
    'כל מקום מוסתר נספר ב"מוסתרים" בסוף רשימת המקומות, מכל יעד ומכל סוג.',
    'הצעת מיקום לקצה של נסיעה מגיעה רק מקרבת היעד, ולטיסה קודם שדה תעופה. כשאין התאמה טובה - "חסר מיקום".',
    '"כל המסלול" נשמר כמו כל בחירת ימים כשעוברים למסך אחר וחוזרים למפה.',
    'מרחק וזמן נכתבים באותה צורה בכל מסך - בתכנון, במפה, בציר הזמן ובזיכרון (למשל "1.2 ק״מ", "2:15 ש׳") - ומספר לא נפרד מהיחידה שלו בסוף שורה.',
    'בהגדרות, מתחת לגרסה: "תנאי שימוש ופרטיות" - מה האפליקציה שולחת ולאן, ומה היא לא אוספת - ו"מקורות ורישיונות" של השירותים, המפות, הגופנים והאייקונים. הקישור לדף מופיע גם בחלון הדיווח.',
    'תמונה מוויקיפדיה בתמונת הטיול נושאת את שם הצלם והרישיון שלה - גם כשהתמונה נשלחת או מודפסת - וטקסט מוויקיפדיה בדפים לחברים את המקור והרישיון. בדפים לחברים המפה החיה מגיעה מ-OpenFreeMap, והכפתורים שלה מופיעים שוב.',
    'הלוויין והמפה עם התבליט עובדים לכולם דרך המפתח של האפליקציה (מפתח Esri משלכם עדיין אפשרי); מקום מציר הזמן ליד הבית או מקום קבוע מוצע בלי שם ולא נשלח לחיפוש - גם אחרי שמוסיפים אותו לטיול ונותנים לו שם; הגופנים נטענים מהאפליקציה עצמה. דף "תנאי שימוש ופרטיות" עודכן בהתאם (גרסה 1.4).',
    'הזמנה ומחיר נבחרים מרשימה: האם צריך להזמין (לא ידוע, לא צריך, מומלץ, חובה) עם הערה איך ומתי, ומחיר כ"$$\u00a0· בינוני", חינם או סכום - ומחיר כניסה מופיע עם החודש שבו נבדק. במלון - המחיר ששילמתם, ללילה או לכל השהות.',
    'ב"כללי", כשחסר מידע ביעד (למשל שפה או נציגות ישראל, או מזג אוויר בלי עונות) מופיעה מתחת למידע שורה של ה-\u2068AI\u2069: נגיעה שולחת את היעד להשלמה, וה-\u2068AI\u2069 גם בודק שהמידע הקיים עדיין נכון ומבקש אישור לכל שינוי. סעיף שלא רלוונטי ליעד מסמנים ב-⋮ של השורה. במזג האוויר, נגיעה בחודש פותחת את העונה שלו.',
    'אפשר לעבוד עם כל צ\'אט \u2068AI\u2069: האפליקציה כותבת "\u2068AI\u2069" במקום שם של עוזר אחד, ובמדריך פרק "עבודה עם \u2068AI\u2069". האפליקציה נבדקה עם קלוד ועובדת איתו הכי טוב.',
    'למקום יכול להיות שם מקומי - כמו בשלטים ובגוגל מפות - מתחת לשם בחלון המקום; החיפוש מוצא את המקום גם לפיו, ובעריכת מקום יש לו שדה "שם מקומי".',
    'שיתוף מגוגל מפות פותח את "מקום חדש" מיד, עם שם המקום, ופס מתקדם אומר מה קורה עכשיו - "קוראים את הקישור…", "מחפשים את המקום…" - עד שהמיקום מתמלא והמפה מתמקדת בו.',
    'מפות לשימוש בלי רשת: כל אזור מסומן במספר - בשורה שלו וגם על המפה - ונגיעה בשורה מראה אותו על המפה; נגיעה במספר על המפה מתקרבת לאזור, ו"כל האזורים" מחזיר את כולם.',
    'ועוד: טיול שנטען מקובץ נפתח בראש המסך עם הסרגל שלמטה, "חסר מיקום" ב"כללי" פותח את עריכת הנסיעה, ✕ סוגר את הכרטיס במפת המסלול, המרת המטבע נקראת בסדר הנכון, דיווח שנשלח ברקע אומר את זה, ותמונות לרוחב ולאורך באותו גודל.'
  ] },
  { version: '11.21.6', date: '17.11.2026', items: [
    'חלון שנפתח מתוך חלון נפתח באותו חלון, עם חץ חזרה בראש הכותרת: החץ והחזרה של הטלפון חוזרים צעד אחד, ומשיכה למטה סוגרת את הכל.',
    'עורך עולה מלמטה מעל החלון שממנו נפתח, ורשימת בחירה (מדינה, שכבה, יום) עולה מעל העורך - מה שמתחת לא זז. בחירה של כמה ערכים נגמרת ב"✓ סיום".',
    'שינוי שלא נשמר לא הולך לאיבוד: לפני מעבר ללשונית אחרת, לטיול אחר או לקובץ שנפתח באפליקציה - שואלים אם לשמור.',
    'גרירה בתוכנית היום: החלק ביום שיקבל את המקום נדלק, וסימן הנחיתה נשאר גלוי מעל האצבע.',
    'שיתוף של קובץ טיול פותח את רשימת האפליקציות לשליחה (במקום להוריד אותו), ופתיחת קובץ מראה "קורא את הקובץ…".',
    'בחירת מדינה ליעד ממלאת לבד את המטבע והשעון שלו.',
    'בלי רשת, תחזית מזג האוויר אומרת מאיזו שעה היא. המפה הקטנה זזה ומתקרבת בשתי אצבעות בלי קפיצות.',
    'קלוד ושירותי המפות יכולים לטעות: טיוטה מקלוד, חלונות קלוד ותוצאה שנבחרה בחיפוש מזכירים לבדוק, ובמדריך פרק חדש - "מידע שכדאי לבדוק".',
    'כל מקום אפשר גם להסתיר וגם למחוק: הסתרה עם סיבה (חוזר מהמוסתרים), מחיקה לסל - ועדכון של היעד לא מחזיר מקום שנמחק.',
    'ציר הזמן של גוגל: שדה התעופה מזוהה כמקום של הטיול, ואין הצעות מלפני היציאה מהבית, מאחרי הנחיתה בחזרה או מישראל בטיול לחו״ל.',
    'בעורך הטיול, "ימים שכולם בדרך": יום ראשון או אחרון שכולו טיסה או נסיעה נשאר כמו שבחרתם, ונסיעה שמתאימה רק מציעה. ובמקום "מי טס" - "מי נוסע".',
    'לשכבת האוכל סמל חדש: סכין ומזלג.',
    'חיפוש מקום טוב יותר: עד 20 תוצאות באזור היעד (ועוד בלחיצה) ושמות בעברית כשיש במפה. בסוף כל רשימה - "לחפש בגוגל מפות" או "לבחור על המפה", ושיתוף מגוגל מפות חוזר לדרכון, לאותו טופס כמו שהשארתם אותו.',
    'כל גיבוי שהאפליקציה עשתה נפתח בשחזור - גם כשיש בו יעד חדש בשם בעברית.',
    'התוכנית נפתחת ומתעדכנת מהר יותר, בעיקר בימים של טיסה או נסיעה.',
    'קישור ששיתפתם מגוגל מפות או מחיפוש בגוגל, גם בלי נקודה על המפה, מוצא את המקום לפי השם והכתובת שבו.',
    'תיקונים קטנים במראה ובמפות.'
  ] }
];

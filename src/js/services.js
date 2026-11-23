// ================= 7.1.0: EXTERNAL SERVICES - the one client for every request to the outside (cl-services-impl-plan, decisions ש1-ש12) =================
// Mechanism map: `darkon/spec/external-services.md`. Every request the code makes to an outside server (data APIs,
// tiles and pictures the code itself loads, a static file) goes through svcAsk - no other code calls fetch / new Image / src
// to an outside address. Map tiles that the map library loads (and the live map inside a file sent to people) are declared
// here too, and take their addresses from here; the service worker's list of tile hosts is built from here (build.py).
// Two levels (ש2): a PROVIDER is who runs the server - rate, how many at once, identification, budget, key, attribution,
// published terms (its queue is shared by all its services); a SERVICE is a kind of data - name, providers in order,
// its memory (a "cache" row of the data registry), expiry, how long an empty answer is kept, priority, offline behavior,
// status line, diagnostics. Four kinds of answer (ש9): ok (kept, a real "not found" too) · busy (429/503/timeout: the
// provider waits as asked or 30 s → 2 → 10 → 30 min, the next provider answers meanwhile) · error (next provider, up to 3
// tries, then until the next open) · blocked (403: until tomorrow, flagged in diagnostics). A request that did not reach the
// server is "no network" (ש4), whatever navigator.onLine says. None of them is ever kept as "not found".
// Guard test: t810 (no outside request outside this block; every row complete; rates and concurrency under a mocked
// network; failures never kept as empty; every request counted; attribution wherever a provider's data is shown).
const SVC_CHECKED = '2.11.2026'; // the date the published terms below were read (a row the legal review confirmed carries its own date)
const SVC_REVIEWED = '21.11.2026'; // legal-credits (S7): the rows the legal review of 21.11.2026 read at the source
const OSM_ATTR = { t: '© OpenStreetMap contributors', u: 'https://www.openstreetmap.org/copyright', fix: 'https://www.openstreetmap.org/fixthemap', print: 'openstreetmap.org/copyright' }; // legal-credits: "לתקן את המפה" on the OSM map (S11); the address printed in pictures and prints (C3)
// rate: gap = the least time between two requests that start (ms); day = a published daily limit (counted, shown in diagnostics)
const PROVIDERS = {
  // legal-server (11.41.0; Q12): queue - asked through the site's shared queue (netlify/functions/queue.mjs: one a second for all users together, a shared
  // cache, the app's User-Agent); direct - when the queue does not answer, the service itself, background requests one per `direct` ms per phone
  nominatim: { name: 'נומינטים (OpenStreetMap)', hosts: ['nominatim.openstreetmap.org'], priv: { sends: 'search text; place names and addresses with the destination area; points for a name (Timeline offers not near home or frequent places)', via: 'server', country: 'UK', keeps: 'its policy; the site\'s queue keeps the address asked and the answer 30 days, never who asked' }, rate: { gap: 1100, day: null }, conc: 1, queue: 'nominatim', direct: 3000,
    ident: 'דרך התור המשותף בשרת של האפליקציה: User-Agent עם שם האפליקציה וכתובת הקשר; בלי השלמה בזמן הקלדה; תוצאות נשמרות', budget: null, key: null, attr: OSM_ATTR,
    terms: { u: 'https://operations.osmfoundation.org/policies/nominatim/', at: SVC_REVIEWED }, note: 'עד בקשה בשנייה לכל האפליקציה יחד - נשמר בתור המשותף בשרת (legal-server); תשובות נשמרות שם 30 יום, בלי כתובת הרשת של מי ששאל. כשהשרת לא עונה: ישירות, בקשת רקע אחת ל-3 שניות מכל טלפון' },
  photon: { name: 'פוטון (Komoot)', hosts: ['photon.komoot.io'], priv: { sends: 'search text with the map centre; addresses; Timeline points when Nominatim is busy', via: 'phone', country: 'DE', keeps: 'network addresses up to 90 days' }, rate: { gap: 1100, day: null }, conc: 1, ident: 'כתובת הדף (Referer)', budget: null, key: null, attr: OSM_ATTR,
    terms: { u: 'https://photon.komoot.io', at: SVC_REVIEWED }, note: 'שימוש הוגן בלי מספר - ערך זהיר' },
  fossgis: { name: 'מסלולים (FOSSGIS)', hosts: ['routing.openstreetmap.de'], priv: { sends: 'the two ends of a leg', via: 'phone', country: 'DE', keeps: 'its server log' }, rate: { gap: 1100, day: null }, conc: 1, ident: 'כתובת הדף (Referer)', budget: null, key: null,
    attr: { t: ('מסלולים © FOSSGIS' + SEP + '© OpenStreetMap contributors'), u: 'https://routing.openstreetmap.de/about.html', fix: 'https://www.openstreetmap.org/fixthemap' },
    terms: { u: 'https://routing.openstreetmap.de/about.html', at: SVC_REVIEWED }, note: 'עד בקשה בשנייה' },
  transitous: { name: 'תחבורה ציבורית (Transitous)', hosts: ['api.transitous.org'], priv: { sends: 'the two ends of a leg, its date and departure time', via: 'server', country: 'EU', keeps: 'up to two days' }, rate: { gap: 1100, day: null }, conc: 1, queue: 'transitous', direct: 3000, ident: 'דרך התור המשותף בשרת של האפליקציה (User-Agent עם שם האפליקציה וכתובת הקשר)', budget: null, key: null,
    attr: { t: 'Transitous', u: 'https://transitous.org/sources/' }, terms: { u: 'https://transitous.org/api/', at: SVC_REVIEWED }, note: 'לא מסחרי; דרך התור המשותף בשרת (legal-server, Q13): בקשה בשנייה לכל המשתמשים יחד, ועד 700 תכנונים (/plan) ביום לכולם - מתחת ל-720' },
  openmeteo: { name: 'Open-Meteo', hosts: ['api.open-meteo.com', 'archive-api.open-meteo.com'], priv: { sends: 'points and dates', via: 'phone', country: 'CH', keeps: 'server logs 90 days' }, rate: { gap: 500, day: 10000 }, conc: 1, ident: 'כתובת הדף (Referer)', budget: null, key: null,
    attr: { t: 'Weather data by Open-Meteo.com', u: 'https://open-meteo.com/', elev: 'Elevation data by Open-Meteo.com' }, terms: { u: 'https://open-meteo.com/en/terms', at: SVC_REVIEWED }, note: 'פחות מ-600 לדקה, 5,000 לשעה, 10,000 ליום; בקשה עם כמה מקומות נספרת ככמה' },
  // legal-credits (C4): attr.text / textU / from / after - the licence of Wikipedia's text passed on in pages and files (wikiTextCreditHTML)
  wikimedia: { name: 'ויקיפדיה (Wikimedia)', hosts: ['he.wikipedia.org', 'en.wikipedia.org', 'upload.wikimedia.org'], priv: { sends: 'the map centre; article names; picture addresses', via: 'phone', country: 'US', keeps: 'most data 90 days' }, rate: { gap: 200, day: null }, conc: 1,
    ident: 'כותרת Api-User-Agent', headers: { 'Api-User-Agent': 'Darkon trip app (https://darkon-eran.netlify.app)' }, headerHosts: ['he.wikipedia.org', 'en.wikipedia.org'], budget: null, key: null,
    attr: { t: 'ויקיפדיה (CC BY-SA)', u: 'https://he.wikipedia.org/wiki/ויקיפדיה:זכויות_יוצרים', text: 'CC BY-SA 4.0', textU: 'https://en.wikipedia.org/wiki/Wikipedia:Text_of_the_Creative_Commons_Attribution-ShareAlike_4.0_International_License', from: 'מתוך ויקיפדיה', after: 'על פי ויקיפדיה' }, terms: { u: 'https://foundation.wikimedia.org/wiki/Policy:Wikimedia_Foundation_API_Usage_Guidelines', at: SVC_REVIEWED }, note: 'בקשה אחרי בקשה. תנאי השימוש של הקרן: foundation.wikimedia.org/wiki/Policy:Terms_of_Use. תמונה מ-Commons רק ברישיון חופשי ידוע, עם היוצר והרישיון שלה' },
  wikidata: { name: 'ויקינתונים (Wikidata)', hosts: ['www.wikidata.org'], priv: { sends: 'an area\'s name typed in Hebrew', via: 'phone', country: 'US', keeps: 'its policy' }, rate: { gap: 500, day: null }, conc: 1, // 11.28.2 (area-search-he): the English name of an area typed in Hebrew
    ident: 'כותרת Api-User-Agent', headers: { 'Api-User-Agent': 'Darkon trip app (https://darkon-eran.netlify.app)' }, budget: null, key: null,
    attr: { t: 'Wikidata (CC0)', u: 'https://www.wikidata.org/wiki/Wikidata:Licensing' }, terms: { u: 'https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use', at: '19.11.2026' }, note: 'בקשה אחרי בקשה; רק כשמחפשים אזור בעברית' },
  overpass1: { name: 'אוברפס (overpass-api.de)', hosts: ['overpass-api.de'], priv: { sends: 'an area\'s rectangle around a destination', via: 'phone', country: 'DE', keeps: 'its policy' }, rate: { gap: 1000, day: 100 }, conc: 1, ident: 'כתובת הדף (Referer)', budget: null, key: null, attr: OSM_ATTR,
    terms: { u: 'https://dev.overpass-api.de/overpass-doc/en/preface/commons.html', at: SVC_REVIEWED }, note: 'עד 2 בבת אחת לכתובת; כ-100 שאילתות ו-10MB ליום בשימוש קבוע' },
  // legal-credits (S8): kumi.systems is now run by Private.coffee too ("now managed by Private.coffee", 21.11.2026) - two addresses of one operator, under its terms
  overpass2: { name: 'אוברפס של Private.coffee (kumi.systems)', hosts: ['overpass.kumi.systems'], priv: { sends: 'an area\'s rectangle around a destination', via: 'phone', country: 'AT', keeps: 'part of the network address up to 48 hours' }, rate: { gap: 1000, day: null }, conc: 1, ident: 'כתובת הדף (Referer)', budget: null, key: null, attr: OSM_ATTR,
    terms: { u: 'https://overpass.private.coffee/', at: SVC_REVIEWED }, note: 'מנוהל בידי Private.coffee, כמו overpass.private.coffee. התנאים שלהם: לא לשמור מידע אישי בבקשות, לזהות את האפליקציה, להודיע לפני יותר מעשר בקשות בשנייה או עשר בבת אחת - אנחנו בבקשה אחת בכל פעם' },
  overpass3: { name: 'אוברפס של Private.coffee', hosts: ['overpass.private.coffee'], priv: { sends: 'an area\'s rectangle around a destination', via: 'phone', country: 'AT', keeps: 'part of the network address up to 48 hours' }, rate: { gap: 1000, day: null }, conc: 1, ident: 'כתובת הדף (Referer)', budget: null, key: null, attr: OSM_ATTR,
    terms: { u: 'https://overpass.private.coffee/', at: SVC_REVIEWED }, note: 'אותו מפעיל כמו overpass.kumi.systems ואותם תנאים: לא לשמור מידע אישי בבקשות, לזהות את האפליקציה, להודיע לפני יותר מעשר בקשות בשנייה או עשר בבת אחת' },
  openfreemap: { name: 'OpenFreeMap', hosts: ['tiles.openfreemap.org'], priv: { sends: 'tile areas shown or downloaded; the trip picture\'s background; the live map of a friends\' page', via: 'phone', country: 'HU', keeps: 'network addresses only in error logs, 7 days' }, rate: { gap: 0, day: null }, conc: 4, ident: 'כתובת הדף (Referer), בלי פרמטרים בכתובת', noQuery: true,
    budget: { tiles: 3000, bytes: 50 * 1048576, per: 'טיול' }, key: null, attr: { t: ('OpenFreeMap © OpenMapTiles' + SEP + 'Data © OpenStreetMap contributors'), u: 'https://openfreemap.org', print: 'openstreetmap.org/copyright' }, // legal-credits (C2): the attribution OpenFreeMap asks of printed media and other clients
    terms: { u: 'https://openfreemap.org/tos/', at: SVC_REVIEWED }, note: 'תשובת המייסד במייל, 26.10.2026: Origin / Referer מספיקים לזיהוי של אפליקציה בדפדפן (בלי User-Agent משלנו), בלי פרמטרים בכתובת (הם עוקפים את המטמון שלהם), 4 בבת אחת, הורדה לטיול עד 3,000 אריחים / 50MB (כולל רקע התמונה). גם המפה החיה בקבצים שנשלחים לחברים' },
  osm: { name: 'אריחי OpenStreetMap', hosts: ['tile.openstreetmap.org'], priv: { sends: 'tile areas viewed', via: 'phone', country: 'UK', keeps: 'its policy' }, rate: { gap: 0, day: null }, conc: 2, ident: 'כתובת הדף (Referer)', budget: null, key: null, viewOnly: true,
    tiles: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attr: OSM_ATTR, terms: { u: 'https://operations.osmfoundation.org/policies/tiles/', at: SVC_REVIEWED }, note: 'רק מה שאדם מסתכל עליו (סעיף 4); נשמרים 7 ימים לפחות; הכתובת המדויקת, בלי תת-דומיין; "לתקן את המפה" בקרדיט. רק במפות של האפליקציה עצמה - קובץ שנשלח לחברים אין לו כתובת דף, והמפה החיה בו מ-OpenFreeMap' },
  // legal-credits (S12, Q20): the path the About page publishes, https://{a|b|c}.tile.opentopomap.org/{z}/{x}/{y}.png - the three hosts by turn ({abc}, svcTileHost)
  opentopomap: { name: 'OpenTopoMap', hosts: ['a.tile.opentopomap.org', 'b.tile.opentopomap.org', 'c.tile.opentopomap.org'], priv: { sends: 'tile areas shown', via: 'phone', country: 'DE', keeps: 'its policy' }, rate: { gap: 0, day: null }, conc: 4, ident: 'כתובת הדף (Referer)', budget: null, key: null,
    tiles: 'https://{abc}.tile.opentopomap.org/{z}/{x}/{y}.png', attr: { t: ('Map data: © OpenStreetMap contributors, SRTM' + SEP + 'Map style: © OpenTopoMap (CC BY-SA)'), u: 'https://opentopomap.org/about', give: 'https://opentopomap.org/about#unterstuetzen', print: 'openstreetmap.org/copyright' },
    terms: { u: 'https://opentopomap.org/about', at: SVC_REVIEWED }, note: 'דף האודות (21.11.2026): מותר להשתמש באריחים "כל עוד השרת שלנו לא עמוס מדי, למשל מהורדות המוניות", בלי הבטחה שיעבוד תמיד; הסגנון ברישיון CC BY-SA, ומפה מודפסת נמסרת באותם תנאים. ההורדות לבלי רשת נשארות קטנות' },
  // legal-server (11.41.0; Q9): keyed services only (the app's key, or the person's own) - the keyless server.arcgisonline.com is gone; noCache: out of the worker's tile cache (build.py), Esri's terms forbid storing its data
  esri: { name: 'Esri (לוויין ותבליט)', hosts: ['ibasemaps-api.arcgis.com', 'static-map-tiles-api.arcgis.com'], priv: { sends: 'satellite and relief tile areas; the app\'s key or the person\'s own', via: 'phone', country: 'US', keeps: 'its policy; the app stores none of its tiles' }, noCache: true, rate: { gap: 0, day: null }, conc: 4, ident: 'המפתח של האפליקציה (ArcGIS Location Platform, מוגבל לכתובות האתר), או מפתח אישי אם הוכנס', budget: null,
    key: 'esri', attr: { t: 'Powered by Esri' + SEP + 'Tiles © Esri, Maxar, Earthstar Geographics, and the GIS User Community', u: 'https://www.esri.com', hillshade: 'Powered by Esri' + SEP + 'Hillshade © Esri, USGS', labels: 'Esri' }, // legal-credits: the relief layer's own credit, from the row (never a fixed string); legal-server (Q9): "Powered by Esri" and the data providers, wherever the layer shows or is drawn
    terms: { u: 'https://www.esri.com/content/dam/esrisites/en-us/media/legal/ma-translations/english.pdf', at: SVC_REVIEWED }, note: 'נקרא ב-21.11.2026: הסכם האב (E204CW, 14.8.2026) - 2.6(3): מותר לשבץ אישור גישה של האפליקציה באפליקציה שפתוחה לכולם, לשירותים שפתוחים לכולם; 3.2(b): תמונה סטטית עם קרדיט מותרת; 3.2(c): לא לשמור ולא להוריד מידע (חוץ מחבילות התוכן של Esri) - לכן אין מטמון אריחים ואין הורדה לבלי רשת; B.1(g): לא להסתיר קרדיט. התנאים לפי מוצר (E300, 10.11.2026), ArcGIS Location Platform, הערות 16 ו-89: מותר להפיץ אפליקציה שניגשת דרך אימות (Authentication - כל מנגנון ש-Esri נותנת, מפתח API בכלל זה). המפתח של האפליקציה: מפתח ציבורי, הרשאת Basemaps בלבד, מוגבל לכתובות האתר, מתחדש פעם בשנה. מפתח אישי, אם הוכנס, רק בטלפון' },
  erapi: { name: 'Exchange Rate API', hosts: ['open.er-api.com'], priv: { sends: 'a currency code, once a day', via: 'phone', country: 'IE', keeps: 'its policy' }, rate: { gap: 1000, day: null }, conc: 1, ident: 'כתובת הדף (Referer)', budget: null, key: null,
    attr: { t: 'Rates By Exchange Rate API', u: 'https://www.exchangerate-api.com' }, terms: { u: 'https://www.exchangerate-api.com/terms', at: SVC_REVIEWED }, note: 'פעם ב-24 שעות (המלצת הספק)' },
  site: { name: 'האתר של האפליקציה (Netlify Forms ופונקציית הקישורים)', hosts: ['darkon-eran.netlify.app'], priv: { sends: 'every opening; reports; shared Google Maps short links; the queue\'s requests', via: 'phone', country: 'US', keeps: 'reports up to a year' }, rate: { gap: 2000, day: 30 }, conc: 1, ident: 'כתובת הדף (Referer); שדה מלכודת לרובוטים', budget: null, key: null, // 10.7.0 (task feedback): reports from inside the app
    attr: { t: 'Netlify Forms', u: 'https://www.netlify.com/platform/core/forms/' }, terms: { u: 'https://www.netlify.com/legal/self-serve-subscription-agreement/', at: SVC_REVIEWED }, note: 'הסכם השירות של Netlify (Self-Serve Subscription Agreement), עם הסכם עיבוד הנתונים (DPA, www.netlify.com/pdf/netlify-dpa) ומדיניות השימוש המקובל (AUP, www.netlify.com/legal/acceptable-use-policy/). דיווח תקלה או רעיון; מייל לערן. פונקציית הקישורים: פותחת קישור מקוצר של גוגל מפות ומחזירה רק את הכתובת הסופית (11.20.0). חינם בתוכניות הקרדיטים, 100 בחודש באתר בתוכנית הישנה; עד 8MB לבקשה' },
  siteIds: { name: 'האתר של האפליקציה (פונקציית המזהים של גוגל)', hosts: ['darkon-eran.netlify.app'], priv: { sends: 'a place\'s name, destination and point', via: 'phone', country: 'US', keeps: 'nothing; only the id comes back' }, rate: { gap: 2100, day: null }, conc: 1, ident: 'כתובת הדף (Referer)', budget: null, key: null, // 11.23.0 (place-gid-2): its own queue, so the background lookups never wait in front of a report or a short link
    attr: { t: 'Google Maps', u: 'https://developers.google.com/maps/documentation/places/web-service/policies' }, terms: { u: 'https://cloud.google.com/maps-platform/terms', at: SVC_REVIEWED },
    note: 'מחפשת בשרת את המזהה של מקום בגוגל לפי השם והמיקום, ושומרת רק את המזהה (המיקום של גוגל לא נשמר ולא מוצג). המפתח רק באתר; מונה חודשי עוצר ב-9,000 בקשות פרטים, וגוגל עוצרת ב-300 ביום. בקשה כל 2.1 שניות, מתחת ל-30 לדקה' },
  jsdelivr: { name: 'jsDelivr (גבולות מדינות)', hosts: ['cdn.jsdelivr.net'], priv: { sends: 'a fixed file of country borders', via: 'phone', country: 'US', keeps: 'usage data' }, rate: { gap: 0, day: null }, conc: 2, ident: 'כתובת הדף (Referer)', budget: null, key: null,
    attr: { t: 'Natural Earth (world-atlas)', u: 'https://github.com/topojson/world-atlas' }, terms: { u: 'https://www.jsdelivr.com/terms', at: SVC_CHECKED }, note: 'קובץ קבוע' },
};
const PROVIDER_FIELDS = ['name', 'hosts', 'priv', 'rate', 'conc', 'ident', 'budget', 'key', 'attr', 'terms'];
// legal-server (11.41.0; decisions 2026-11-21 · Review of the legal-page summary, Q2): priv - the facts the terms page states about each provider: what it
// receives (sends), who asks it (via: 'phone' | 'server' - the site's server, e.g. the shared queue), its country and what it keeps. With the hosts
// reached outside the registry (Google from the server functions, cdnjs - tests/terms_stamp.py FIXED), the report form's fields and Timeline's rules they make the page's privacy stamp
// (tests/terms_stamp.py): a change to any of them fails the build until the page is read, its version raised and the stamp saved.
// offline: 'memory' (what is kept, an expired one with its age) · 'wait' (background work waits and goes on by itself) · 'none' (a person asks now: one message)
// keep: { ok, empty } in days (Infinity = for good, 0 = not kept); prio: 'screen' (someone waits on screen) | 'bg'
const DAY_MS = 864e5;
const SERVICES = {
  geocode: { name: 'כתובות', providers: ['nominatim', 'photon'], memory: 'geocode', keep: { ok: Infinity, empty: 30 }, prio: 'bg', offline: 'wait',
    status: { icon: 'map', what: 'על המפה' }, diag: 'כתובת שלא נמצאה - ב"מקומות שלא על המפה"; תקלה - ב"מצב השירותים"' },
  placeSearch: { name: 'חיפוש מקום', providers: ['photon', 'nominatim'], // 11.20.0 (place-search-upgrade): Photon while typing, both on an explicit search
    memory: null, keep: { ok: 0, empty: 0 }, prio: 'screen', offline: 'none', status: null, diag: 'תקלה אחרונה' },
  // 11.28.2 (area-search-he; decisions 2026-11-19 · Review of the 11.28.0 summary, Q1): an area typed in Hebrew - its English name and point from Wikidata, for the area search (place-search.js psWikiAreas)
  areaNames: { name: 'שם של אזור בעברית', providers: ['wikidata'], memory: null, keep: { ok: 0, empty: 0 }, prio: 'screen', offline: 'none', status: null, diag: 'תקלה אחרונה' },
  // 11.10.0 (decisions 2026-11-13 Q2): a name for a place Google Timeline offered (a reverse lookup) - only the offers' coordinates are
  // sent; the offers live for the session, so the names do too (no memory row)
  placeName: { name: 'שם למקום שהוצע מציר הזמן', providers: ['nominatim', 'photon'], memory: null, keep: { ok: 0, empty: 0 }, prio: 'bg', offline: 'wait', status: null, diag: 'תקלה אחרונה' },
  route: { name: 'מסלול', providers: ['fossgis'], memory: 'routes', keep: { ok: Infinity, empty: 30 }, prio: 'bg', offline: 'wait',
    status: { icon: 'route', what: 'קטעים' }, diag: 'תקלה אחרונה' },
  transit: { name: 'תחבורה ציבורית', providers: ['transitous'], memory: 'routes', keep: { ok: 14, empty: 30 }, prio: 'bg', offline: 'wait',
    status: { icon: 'route', what: 'קטעים' }, diag: 'תקלה אחרונה' },
  elev: { name: 'גובה', providers: ['openmeteo'], memory: 'elev', keep: { ok: Infinity, empty: 0 }, prio: 'bg', offline: 'wait', status: null, diag: 'תקלה אחרונה' },
  forecast: { name: 'תחזית', providers: ['openmeteo'], memory: 'wx', keep: { ok: 3 / 24, empty: 0, drop: 4 }, prio: 'bg', offline: 'memory', status: null, diag: 'תקלה אחרונה' },
  climate: { name: 'אקלים לתאריכים', providers: ['openmeteo'], memory: 'clim', keep: { ok: Infinity, empty: 0 }, prio: 'bg', offline: 'memory', status: null, diag: 'תקלה אחרונה' },
  mclim: { name: 'אקלים חודשי', providers: ['openmeteo'], memory: 'mclim', keep: { ok: 365, empty: 0 }, prio: 'bg', offline: 'memory', status: null, diag: 'תקלה אחרונה' },
  discWiki: { name: 'תגליות ויקיפדיה ותקציר', providers: ['wikimedia'], memory: 'disc', keep: { ok: Infinity, empty: Infinity }, prio: 'screen', offline: 'memory', status: null, diag: 'תקלה אחרונה' },
  discOsm: { name: 'תגליות OSM', providers: ['overpass1', 'overpass2', 'overpass3'], memory: 'disc', keep: { ok: Infinity, empty: Infinity }, prio: 'screen', offline: 'memory', status: null, diag: 'תקלה אחרונה' },
  pointImage: { name: 'תמונה למקום ותמונות תגליות', providers: ['wikimedia'], memory: 'picwiki', keep: { ok: Infinity, empty: 30 }, prio: 'bg', offline: 'memory',
    status: { icon: 'auto_stories', what: 'תמונות של מקומות' }, diag: 'תקלה אחרונה' },
  schem: { name: 'רקע סכמטי', providers: ['openfreemap', 'overpass1', 'overpass2', 'overpass3', 'jsdelivr', 'esri'], memory: 'schem', keep: { ok: Infinity, empty: 0 }, prio: 'bg', offline: 'wait',
    status: { icon: 'draw', what: 'חלקים של רקע המפה' }, diag: 'חלק שלא נטען' },
  offmaps: { name: 'מפות לבלי רשת', providers: ['openfreemap'], memory: 'offmaps', keep: { ok: Infinity, empty: Infinity }, prio: 'bg', offline: 'wait',
    status: { icon: 'download', what: 'אריחים' }, diag: 'הורדה שנעצרה' },
  picTiles: { name: 'מפה לתמונת הטיול', providers: ['openfreemap', 'opentopomap', 'esri'], memory: 'schem', keep: { ok: Infinity, empty: 0 }, prio: 'screen', offline: 'wait',
    status: { icon: 'map', what: 'אריחים לתמונה' }, diag: 'תמונה שלא נבנתה' },
  screenTiles: { name: 'אריחי המפה על המסך', providers: ['osm', 'opentopomap', 'esri'], memory: 'viewedTiles', keep: { ok: 7, empty: 0 }, prio: 'screen', offline: 'memory', status: null, diag: 'נטענים על ידי ספריית המפה (מוצהר בלבד)', declared: true },
  esriCheck: { name: 'בדיקת מפתח Esri', providers: ['esri'], memory: 'esri', keep: { ok: Infinity, empty: 0 }, prio: 'bg', offline: 'wait', status: null, diag: 'תוצאת הבדיקה בהגדרות' },
  // 11.20.0 (place-search-upgrade, Q9): a Google Maps short link followed by the app's own server function (no key; Google Maps' link hosts only)
  mapsLink: { name: 'קישור מקוצר מגוגל מפות', providers: ['site'], memory: null, keep: { ok: 0, empty: 0 }, prio: 'screen', offline: 'none', status: null, diag: 'תקלה אחרונה' },
  // 11.23.0 (place-gid-2; decisions 2026-11-16 · A Google place id, Q3-Q5): Google's id of a stored place, asked of the app's own server function in the background (place-gid-look.js)
  gidLookup: { name: 'מזהה המקום בגוגל', providers: ['siteIds'], memory: null, keep: { ok: 0, empty: 0 }, prio: 'bg', offline: 'wait', status: null, diag: 'תקלה אחרונה' },
  report: { name: 'דיווח תקלה או רעיון', providers: ['site'], memory: 'reportOut', keep: { ok: 0, empty: 0 }, prio: 'bg', offline: 'wait', status: null, diag: 'דיווח שלא נשלח - מחכה בטלפון' }, // 10.7.0
  rate: { name: 'שער מטבע', providers: ['erapi'], memory: 'rate', keep: { ok: 1, empty: 0 }, prio: 'screen', offline: 'memory', status: null, diag: 'תקלה אחרונה' },
};
const SERVICE_FIELDS = ['name', 'providers', 'memory', 'keep', 'prio', 'offline', 'status', 'diag'];
const SVC_MSG = { offline: 'צריך רשת', // 10.15.0 (design-review F19): no 📴 - a line icon (cloud_off) where the line is drawn as HTML (svcOffHTML)
  busy: 'החיפוש לא זמין כרגע, נסו שוב בעוד רגע' };
const SVC_EMPTY = { empty: true }; // a parse that found nothing returns this: a real "not found"
// ---- state: per provider (in this session) + the daily counters and recent troubles (row "svcDiag", on this phone) ----
// the queue's own clock: monotonic (a waiting time, not a date), so a changed or frozen phone date never stalls it
function svcT() { return performance.now(); }
const SVC = { p: {}, gaveUp: {}, wait: {} };
Object.keys(PROVIDERS).forEach(id => { SVC.p[id] = { q: [], active: 0, last: -Infinity, pauseUntil: 0, step: 0, blockedDay: '', timer: 0 }; });
let _svcDiag = null, _svcDiagT = 0;
function svcDiag() { if (!_svcDiag) { _svcDiag = regRead('svcDiag'); _svcDiag.n = _svcDiag.n || {}; _svcDiag.errs = _svcDiag.errs || []; _svcDiag.blocked = _svcDiag.blocked || {}; } return _svcDiag; }
function svcDiagSave() { clearTimeout(_svcDiagT); _svcDiagT = setTimeout(() => { const d = svcDiag(); d.errs = d.errs.filter(e => Date.now() - e.at < 7 * DAY_MS).slice(-50); regWrite('svcDiag', d); }, 1500); }
function svcCount(prov) { const d = svcDiag(), day = tmPhoneDate(); const c = d.n[prov] && d.n[prov].day === day ? d.n[prov] : { day, n: 0 }; c.n++; d.n[prov] = c; svcDiagSave(); }
function svcCountToday(prov) { const c = svcDiag().n[prov]; return c && c.day === tmPhoneDate() ? c.n : 0; }
function svcTrouble(prov, svc, why) { svcDiag().errs.push({ at: Date.now(), p: prov, s: svc, why: String(why || '').slice(0, 140) }); svcDiagSave(); }
// OpenFreeMap's budget per trip (ש6): the offline download and the picture's background together (3,000 tiles / 50MB)
function svcBudget(trip, bytes) { if (!trip) return; const d = svcDiag(); d.budget = d.budget || {}; const b = d.budget[trip] = d.budget[trip] || { tiles: 0, bytes: 0 }; b.tiles++; b.bytes += bytes || 0; svcDiagSave(); }
function svcBudgetOf(trip) { const b = (svcDiag().budget || {})[trip]; return b || { tiles: 0, bytes: 0 }; }
function svcBlocked(prov) { const b = svcDiag().blocked[prov]; return !!b && b === tmPhoneDate(); }
// ---- no network (ש4): the phone says so (navigator.onLine), or a request did not reach its server - then that provider is
// "not reached" and tried again after 30 s → 2 → 5 min (the others go on; one unreachable host is not "no network" for all) ----
function svcNetDown() { return !navigator.onLine; }
function svcProvDown(prov) { const P = SVC.p[prov]; return svcNetDown() || (!!P && !!P.downUntil && svcT() < P.downUntil); }
function svcNetLost(prov) { const P = SVC.p[prov]; if (P) P.downUntil = svcT() + [30e3, 120e3, 300e3][Math.min(P.downStep = (P.downStep || 0) + 1, 3) - 1]; svcTick(); }
function svcNetBack(prov) { const P = SVC.p[prov], was = !!(P && P.downStep); if (P) { P.downUntil = 0; P.downStep = 0; } if (was) svcResume(); }
function svcResume() { SVC.gaveUp = {}; if (typeof SCHEM_FAILED !== 'undefined') SCHEM_FAILED.clear(); Object.keys(SVC.p).forEach(svcPump); svcTick(); if (document.getElementById('main')) redrawSoon(); } // waiting work is asked again by the screens that need it
window.addEventListener('online', () => { Object.values(SVC.p).forEach(P => { P.downUntil = 0; P.downStep = 0; }); svcResume(); });
// ---- the queue: one per provider (its rate, how many at once), someone waiting on screen before background ----
function svcAsk(svc, o) { // o: { build(prov) -> {url, init, as: 'json'|'text'|'bytes'|'img', ms} | null, parse(data, prov) -> value | SVC_EMPTY, prio, key }
  const S = SERVICES[svc]; if (!S) return Promise.resolve({ kind: 'error', why: 'no service' });
  if (o.key && SVC.gaveUp[svc] && SVC.gaveUp[svc].has(o.key)) return Promise.resolve({ kind: 'error', why: 'gave up until the next open' });
  if (svcNetDown()) { svcWaitMark(svc, o.key); return Promise.resolve({ kind: 'offline' }); }
  return new Promise(res => svcEnqueue({ svc, o, res, tries: 0, pi: 0, prio: o.prio || S.prio, at: Date.now() }));
}
function svcProvsOf(job) { return (job.o.order || SERVICES[job.svc].providers).filter(p => SERVICES[job.svc].providers.includes(p)); } // a request may ask its providers in another order
function svcEnqueue(job) {
  const provs = svcProvsOf(job); let pi = job.pi;
  while (pi < provs.length && !job.o.build(provs[pi])) pi++; // the first provider from here that can answer this
  const free = x => !svcBlocked(provs[x]) && job.o.build(provs[x]), now = svcT();
  let q = pi; while (q < provs.length && !(free(q) && SVC.p[provs[q]].pauseUntil <= now && !svcProvDown(provs[q]))) q++; // ... not blocked today and not waiting (busy): the next answers meanwhile
  if (q >= provs.length) { q = pi; while (q < provs.length && !free(q)) q++; } // all busy: the first that is not blocked waits
  if (q < provs.length) pi = q; else if (pi < provs.length) return svcDone(job, { kind: 'blocked' });
  if (pi >= provs.length) return svcDone(job, { kind: 'error', why: 'no provider' });
  job.pi = pi; const P = SVC.p[provs[pi]];
  if (job.prio === 'screen') { const i = P.q.findIndex(x => x.prio !== 'screen'); if (i < 0) P.q.push(job); else P.q.splice(i, 0, job); } else P.q.push(job);
  svcTick(); svcPump(provs[pi]);
}
function svcPump(prov) {
  const P = SVC.p[prov], R = PROVIDERS[prov]; clearTimeout(P.timer);
  while (P.q.length && P.active < R.conc) {
    if (svcProvDown(prov)) { const q = P.q.splice(0); q.forEach(j => { svcWaitMark(j.svc, j.o.key); j.res({ kind: 'offline' }); }); svcTick(); return; } // not reached (or no network): the work waits for the network
    const now = svcT(), gap = R.queue && svcQueueDown(prov) && P.q[0].prio !== 'screen' ? R.direct : R.rate.gap; // legal-server: the queue down - background requests at the slow direct pace
    const wait = Math.max(P.pauseUntil - now, P.last + gap - now);
    if (wait > 0) { P.timer = setTimeout(() => svcPump(prov), wait); return; }
    const job = P.q.shift(); P.active++; P.last = now; svcRun(prov, job).finally(() => { P.active--; svcPump(prov); });
  }
}
function svcWaitMark(svc, key) { (SVC.wait[svc] = SVC.wait[svc] || new Set()).add(key || '*'); }
async function svcRun(prov, job) {
  const req = job.o.build(prov), R = PROVIDERS[prov]; let r = null;
  svcCount(prov); job.tries++;
  if (req.as === 'img') { // a picture the code draws (a tile for the trip picture, Wikipedia's picture): the one place that loads one
    const im = await new Promise(res => { const im = new Image(); im.crossOrigin = 'anonymous'; let done = false; const fin = ok => { if (done) return; done = true; res(ok ? im : ok === null ? null : false); };
      im.onload = () => fin(im.naturalWidth > 0); im.onerror = () => fin(null); setTimeout(() => fin(false), req.ms || 20000); im.src = req.url; });
    // an image gives no status: a failed load counts as "error" (or no network when the phone says so), a timeout as busy
    if (im) { svcNetBack(prov); return svcDone(job, { kind: 'ok', value: im, prov }); }
    if (!navigator.onLine) { svcNetLost(prov); return svcDone(job, { kind: 'offline' }); }
    return svcRetry(job, prov, im === false ? 'busy' : 'error', im === false ? 'timeout' : 'image');
  }
  if (R.queue && !svcQueueDown(prov) && await svcViaQueue(prov, job, req)) return; // legal-server (Q12): the shared queue first; false (null) - not answered, so directly
  { const P = SVC.p[prov], w = (P.sent == null ? -Infinity : P.sent) + R.rate.gap - svcT(); if (w > 0) await new Promise(r => setTimeout(r, w)); P.sent = svcT(); } // price-level-note (11.44.1, the owner): the provider's gap from the last real send - a failed queue attempt took time after P.last, so the direct send could follow the previous one sooner than the gap
  const ac = window.AbortController ? new AbortController() : null, tm = setTimeout(() => { if (ac) ac.abort(); }, req.ms || 20000);
  try { r = await fetch(req.url, { ...(req.init || {}), headers: { ...((req.init || {}).headers || {}), ...(R.headers && (!R.headerHosts || R.headerHosts.some(h => req.url.includes('//' + h + '/'))) ? R.headers : {}) }, signal: ac ? ac.signal : undefined }); }
  catch (e) { clearTimeout(tm);
    if (e && e.name === 'AbortError') return svcRetry(job, prov, 'busy', 'timeout');
    svcNetLost(prov); svcWaitMark(job.svc, job.o.key); return svcDone(job, { kind: 'offline' }); } // did not reach the server
  clearTimeout(tm); svcNetBack(prov);
  return svcAnswer(prov, job, req, r, '');
}
// a server's answer, read once for every way it came (directly, or through the shared queue - `via` names it in the troubles)
async function svcAnswer(prov, job, req, r, via) { let value;
  if (r.status === 429 || r.status === 503 || r.status === 504) { const ra = +(r.headers.get('Retry-After') || 0); return svcRetry(job, prov, 'busy', 'HTTP ' + r.status + via, ra > 0 ? ra * 1000 : 0); }
  if (r.status === 403) { svcDiag().blocked[prov] = tmPhoneDate(); svcTrouble(prov, job.svc, 'HTTP 403 - חסום עד מחר' + via); return svcRetry(job, prov, 'blocked', 'HTTP 403' + via); }
  // phone-round-4b-fixes P1 (G92): 401 - the address asks for a sign-in (the test address's Netlify login once it lapsed; the page itself
  // comes from the worker's copy): asking again in 2 s gets the same answer, so it is given up at once (an error, not "blocked until tomorrow")
  if (r.status === 401) { svcTrouble(prov, job.svc, 'HTTP 401' + via); return svcGiveUp(job, 'error', 'HTTP 401' + via); }
  if (r.status === 404 && req.empty404) { return svcDone(job, { kind: 'empty', value: SVC_EMPTY, prov }); }
  if (!r.ok) return svcRetry(job, prov, 'error', 'HTTP ' + r.status + via);
  try { const data = req.as === 'text' ? await r.text() : req.as === 'bytes' ? new Uint8Array(await r.arrayBuffer()) : req.as === 'resp' ? r : await r.json();
    value = await job.o.parse(data, prov); }
  catch (e) { return svcRetry(job, prov, 'error', (e && e.message) || 'parse'); }
  if (value === undefined) return svcRetry(job, prov, 'error', 'unusable answer');
  const P = SVC.p[prov]; P.step = 0;
  return svcDone(job, { kind: value === SVC_EMPTY ? 'empty' : 'ok', value, prov });
}
// ---- the shared queue (legal-server, 11.41.0; decisions 2026-11-21 · Review of the legal-review report, Q12, Q13 item 1) ----
// A provider row with `queue` is asked through the site's function /api/queue (netlify/functions/queue.mjs), which sends the request on at
// the provider's pace for all users together, keeps answers in a shared cache and names the app (User-Agent). Its every answer carries
// X-Queue: 1 - an answer without it (the site's own error page, no function), a 5xx of the function itself or a failure to reach the site
// means "not answered": the queue is skipped for SVC_QUEUE_REST and the request goes to the service directly (background requests at the
// row's `direct` pace). The service's own answers (200, 4xx, 429 / 503 with Retry-After) come back through it as they came; the day's cap
// for all users (429 { error: 'day' }) and a full queue (503 { error: 'busy' }) are "busy" - never a reason to ask directly.
// legal-server-fixes (Q3): so is a timeout of the service at the queue (504 with X-Queue) and Netlify's own rate limit at the edge (429 with no
// X-Queue - SVC_EDGE_WAIT).
const SVC_QUEUE = '/api/queue', SVC_QUEUE_REST = 10 * 60e3, SVC_EDGE_WAIT = 60e3; // the edge's 429: a minute's wait (legal-server-fixes)
function svcQueueDown(prov) { const P = SVC.p[prov]; return !!(P && P.qDownUntil && svcT() < P.qDownUntil); }
function svcQueueLost(prov) { const P = SVC.p[prov]; if (P) P.qDownUntil = svcT() + SVC_QUEUE_REST; }
function svcQueueUrl(prov, url) { const R = PROVIDERS[prov], h = R.hosts.find(x => url.startsWith('https://' + x + '/')); if (!h) return '';
  return SVC_QUEUE + '?p=' + encodeURIComponent(R.queue) + '&u=' + encodeURIComponent(url.slice(('https://' + h + '/').length)); }
async function svcViaQueue(prov, job, req) { // -> true when the queue answered (the job is done or retried), null when it did not
  const qu = svcQueueUrl(prov, req.url); if (!qu || req.as === 'img') return null;
  const ac = window.AbortController ? new AbortController() : null, tm = setTimeout(() => { if (ac) ac.abort(); }, 15000); let r;
  try { r = await fetch(qu, { headers: { ...((req.init || {}).headers || {}) }, signal: ac ? ac.signal : undefined }); }
  catch (e) { clearTimeout(tm); svcQueueLost(prov); return null; } // the site not reached (or too slow): directly - if the phone has no network, that fails too and says so
  clearTimeout(tm);
  // legal-server-fixes (Q3): a 429 without X-Queue is Netlify's own rate limit at the site's edge (60 a minute per caller) - the queue is up, this
  // phone asked too often: a wait of about a minute in the queue, never a reason to go directly
  if (r.status === 429 && !(r.headers && r.headers.get('X-Queue') === '1')) { svcNetBack(prov); svcRetry(job, prov, 'busy', 'HTTP 429 (מגבלת האתר)', SVC_EDGE_WAIT); return true; }
  if (!r.headers || r.headers.get('X-Queue') !== '1' || (r.status >= 500 && r.status !== 503 && r.status !== 504)) { svcQueueLost(prov); return null; }
  svcNetBack(prov); await svcAnswer(prov, job, req, r, ' (התור המשותף)'); return true;
}
// busy: the provider waits (as asked, or longer each time), the next provider answers meanwhile, the request goes back to the queue
// error: the next provider at once, up to 3 tries, then until the next open; blocked: until tomorrow
function svcRetry(job, prov, kind, why, ms) {
  const P = SVC.p[prov]; svcTrouble(prov, job.svc, why);
  if (kind === 'busy') { const d = ms || [30e3, 120e3, 600e3, 1800e3][Math.min(P.step, 3)]; P.step++; P.pauseUntil = svcT() + d; }
  if (job.tries >= 3 && kind !== 'busy') return svcGiveUp(job, kind, why);
  if (job.tries >= 6) return svcGiveUp(job, kind, why);
  const provs = svcProvsOf(job), next = provs.findIndex((p, i) => i > job.pi && !svcBlocked(p) && job.o.build(p));
  if (next >= 0) job.pi = next; else if (kind === 'blocked') return svcGiveUp(job, kind, why); else job.pi = provs.findIndex(p => !svcBlocked(p) && job.o.build(p));
  if (job.pi < 0) return svcGiveUp(job, kind, why);
  svcEnqueue(job);
}
function svcGiveUp(job, kind, why) { if (job.o.key) (SVC.gaveUp[job.svc] = SVC.gaveUp[job.svc] || new Set()).add(job.o.key); svcDone(job, { kind, why }); }
function svcDone(job, r) { job.res(r); svcTick(); }
// ---- memories (ש8): kept in the data registry's "cache" rows; an entry keeps its moment (at) and whether it was empty (none) ----
function svcFresh(svc, e) { if (e == null) return false; const k = SERVICES[svc].keep, empty = !!(e && typeof e === 'object' && e.none), d = empty ? k.empty : k.ok;
  if (d === Infinity) return true; if (!d) return false; const at = e && typeof e === 'object' ? e.at : 0; return !!at && Date.now() - at < d * DAY_MS; }
// ---- the one "X מתוך Y" line (ש10): icon + "N מתוך M" + what is counted, one state suffix; gone when done ----
let _svcTickT = 0;
function svcTick() { clearTimeout(_svcTickT); _svcTickT = setTimeout(() => document.querySelectorAll('.svc-line[data-v]').forEach(el => { const f = SVC_LINES[el.id]; if (!f) return; const h = f(); if (!h) { el.remove(); return; } const t = document.createElement('div'); t.innerHTML = h; const n = t.firstElementChild; if (n && n.outerHTML !== el.outerHTML) el.replaceWith(n); }), 250); }
const SVC_WAIT_NET = 'ממתין לרשת'; // 11.10.0 (small-fixes 17; decisions 2026-11-12 "Review of the 11.7.0 summary" Q1): one wording in every "X מתוך Y" line
const SVC_LINES = {}; // line id -> () => html, for refreshing in place
function svcSuffix(svc, left) {
  const provs = SERVICES[svc].providers.filter(p => !SERVICES[svc].declared);
  if (svcNetDown() || (provs.length && provs.every(svcProvDown))) return SVC_WAIT_NET;
  if (provs.length && provs.every(svcBlocked)) return 'לא זמין היום';
  const paused = provs.map(p => SVC.p[p].pauseUntil - svcT()).filter(x => x > 0); if (paused.length && paused.length === provs.length) return `עמוס, עוד ${tmFmt('dur', Math.max(1, Math.round(Math.min(...paused) / 6e4)))}`;
  if (left) return `${left} לא חושבו`; // short, so it fits 360 (when they are asked again - in the explanation)
  return '';
}
function svcLine(id, svc, n, of, refresh, o) { // o: { what, icon, gaveUp (count not computed this session) }
  o = o || {}; if (refresh) SVC_LINES[id] = refresh; const S = SERVICES[svc], st = S.status || {}, left = o.gaveUp || 0;
  if (!of || (n >= of && !left)) return '';
  const sfx = svcSuffix(svc, left), esc = escH;
  const off = sfx === SVC_WAIT_NET; // 10.1.0 (design-1): offline - the cloud-off icon leads the line
  return `<button type="button" class="svc-line${off ? ' svc-off' : ''}" id="${id}" data-act="svc.explain" data-v="${svc}"${o.dest ? ` data-dest="${escH(o.dest)}"` : ''}><span class="sl-t">${off ? msi('cloud_off', { size: 16 }) : st.icon ? msi(st.icon, { size: 16 }) : ''} <bdi>${n}</bdi> מתוך <bdi>${of}</bdi> ${esc(o.what || st.what || '')}${sfx ? `${SEP}${esc(sfx)}` : ''}</span></button>`;
}
function svcGaveUpCount(svc) { return SVC.gaveUp[svc] ? SVC.gaveUp[svc].size : 0; }
const SVC_EXPLAIN = {
  geocode: 'מקומות שנמצאים לפי הכתובת שלהם. פעם אחת לכל כתובת, והמיקום נשמר בטלפון. כתובת שלא נמצאה נבדקת שוב אחרי חודש.',
  route: 'זמן ומרחק אמיתיים בין המקומות, לפי הדרכים. כל קטע מחושב פעם אחת ונשמר. עד שהוא מחושב - הערכה מסומנת ≈.',
  transit: 'זמן ומרחק בתחבורה ציבורית. נשמר שבועיים, כי לוחות הזמנים מתחלפים. עד שמחושב - הערכה מסומנת ≈.',
  pointImage: 'התמונה של כל מקום מוויקיפדיה, פעם אחת לכל מקום. מקום שאין לו תמונה נבדק שוב אחרי חודש.',
  schem: 'הרקע של תמונת הטיול: מים, פארקים, דרכים ושמות, מ-OpenFreeMap. פעם אחת לטיול, נשמר בטלפון.',
  picTiles: 'המפה שמתחת לתמונת הטיול, בסוג המפה שנבחר. נבנית פעם אחת ונשמרת עם הטיול.',
  offmaps: 'המפה של אזורי הטיול, לשימוש בלי רשת. לכל טיול יש מקום של עד 50MB (תנאי השימוש של OpenFreeMap), והאפליקציה מחלקת אותו לבד: קודם איפה שמטיילים ונוהגים, אחר כך שאר הדרכים. טיסה לא צריכה מפה. 10% נשמרים לעדכון אם הטיול ישתנה. מה שלא נכנס במקום אפשר להחליף: ✕ על אזור אחר ו-＋ להכניס.',
};
var SVC_EXPLAIN_DEST = '';
// 9.5.0 (12ה, ס13): text cut with … shows its full text in the bubble on a tap (only when it is really cut)
act('txt.full', c => { const e = c.el; if ([e, ...e.querySelectorAll('.head-f, .nm, .t-ell')].some(x => x.scrollWidth > x.clientWidth + 1 || x.scrollHeight > x.clientHeight + 2 || x.classList.contains('cut'))) showChipBubble(e, e.textContent.replace(/ⓘ/g, '').trim(), 2600); return 'quiet'; }); // a title: any of its parts cut (headFit)
act('svc.explain', c => { SVC_EXPLAIN_DEST = c.el.dataset.dest || ''; openSvcExplain(c.v); });
const SVC_MS = { geocode: 'location_on', placeSearch: 'search', route: 'route', transit: 'directions_transit', elev: 'landscape', forecast: 'partly_cloudy_day', climate: 'thermostat',
  mclim: 'thermostat', discWiki: 'auto_stories', discOsm: 'travel_explore', pointImage: 'image', schem: 'map', offmaps: 'download_for_offline', picTiles: 'map', screenTiles: 'map',
  esriCheck: 'key', rate: 'currency_exchange' };
function openSvcExplain(svc) { layerNote(openSvcExplain, arguments); const sheet = document.getElementById('sheet'), S = SERVICES[svc]; if (!S) return;
  const sfx = svcSuffix(svc, svcGaveUpCount(svc)), off = { wait: 'בלי רשת העבודה נעצרת, וממשיכה לבד כשהרשת חוזרת. בינתיים מוצגת הערכה מסומנת ≈ כשיש.', memory: 'בלי רשת מוצג מה שנשמר בטלפון, עם השעה שבה נשמר.', none: 'בלי רשת הפעולה לא זמינה.' }[S.offline];
  const credit = SERVICES[svc].declared ? '' : svcCredits(S.providers);
  // 10.5.0 (design-4 part 2, look.md "Pop-ups and system states"): icon and name, what it does, what happens offline, a related action, the credits small
  sheet.innerHTML = `${fmHead(`${msi(SVC_MS[svc] || 'info', { cls: 'head-ic' })} ${nameB(S.name)}`)}
    <p>${SVC_EXPLAIN[svc] || ''}</p>${sfx ? `<p class="sh-hint">עכשיו: ${sfx}${svcGaveUpCount(svc) && !svcNetDown() ? ' - השרת לא ענה עליהם, וננסה שוב בפתיחה הבאה' : ''}.</p>` : ''}<div class="svc-off">${msi('cloud_off', { size: 20 })}<span>${off}</span></div>
    ${svc === 'geocode' ? `<button type="button" class="sh-secondary svc-act" data-act="svc.diagPlaces" data-v="${_qe(SVC_EXPLAIN_DEST)}">${msi('monitor_heart', { size: 18 })} מקומות שלא על המפה</button>` : ''}
    <p class="svc-credit">${credit}</p>`;
  showSheetBackdrop('openSvcExplain'); }
// ---- attribution (ש6): from the provider's row, wherever its data is shown ----
// legal-credits: o.as names another credit of the same row (the relief of Esri: as 'hillshade'); o.fix adds "לתקן את המפה", o.give the donation link
function svcCredit(prov, o) { const A = PROVIDERS[prov].attr, esc = escH; o = o || {};
  return `<span class="svc-cr" data-prov="${prov}"><a href="${esc(A.u)}" target="_blank" rel="noopener">${esc(o.as ? A[o.as] : A.t)}</a>${o.fix && A.fix ? `${SEP}<a href="${esc(A.fix)}" target="_blank" rel="noopener">לתקן את המפה</a>` : ''}${o.give && A.give ? `${SEP}<a href="${esc(A.give)}" target="_blank" rel="noopener">תרומה</a>` : ''}</span>`; }
// final-review 8: the credit line of several providers - each credit once, in the providers' order: providers that share one attribution
// (the OpenStreetMap ones) are named once, and a credit already said inside another provider's credit (OpenFreeMap's names the
// OpenStreetMap contributors) is not repeated
function svcCredits(provs, o) { const ts = [...new Set(provs.map(p => PROVIDERS[p].attr.t))], seen = new Set();
  return provs.filter(p => { const t = PROVIDERS[p].attr.t; if (seen.has(t) || ts.some(x => x !== t && x.includes(t))) return false; seen.add(t); return true; }).map(p => svcCredit(p, o)).join(SEP); }
// the credit as plain text, for what has no link - a picture, a print, a PNG or PDF: o.print adds the copyright address the row asks to
// print (OpenStreetMap's, C3: "the URL to openstreetmap.org/copyright must be printed out"); o.as as in svcCredit
function svcCreditText(prov, o) { const A = PROVIDERS[prov].attr; o = o || {}; const t = o.as ? A[o.as] : A.t; return o.print && A.print && !o.as ? `${t} (${A.print})` : t; }
// several providers' credits as one plain line, each said once (as svcCredits), for a picture or a print
function svcCreditsText(provs, o) { const ts = [...new Set(provs.map(p => PROVIDERS[p].attr.t))], seen = new Set();
  return provs.filter(p => { const t = PROVIDERS[p].attr.t; if (seen.has(t) || ts.some(x => x !== t && x.includes(t))) return false; seen.add(t); return true; }).map(p => svcCreditText(p, o)).join(SEP); }
// legal-credits (S12): a provider that publishes several hosts by letter ({abc} in its tile address) - the host of a tile, the same every time
function svcTileHost(d) { return 'abc'[Math.abs((+d.x || 0) + (+d.y || 0)) % 3]; }
// ---- tile addresses (screen maps, the trip picture's topographic/satellite, the live map inside files) come from the rows ----
function svcTileUrl(prov) { return PROVIDERS[prov].tiles; }
// legal-credits (S10; decisions 2026-11-21 · Review of the legal-review report, Q13 item 3): the live map inside a file sent to friends draws
// OpenFreeMap's vector tiles itself (fmapVecLayer). The page has none of the app's queues, so this is its one small loader, packed into it
// by fmapPack: the row's TileJSON address, then each tile, at most the row's number at once, no query parameters, a tile kept for the visit
const SVC_PAGE = { q: [], n: 0, tpl: null, got: new Map() };
function svcPageGet(url) { return new Promise(res => { const go = () => { SVC_PAGE.n++;
    fetch(url, { credentials: 'omit' }).then(r => r.ok ? r.arrayBuffer() : null).then(b => b ? new Uint8Array(b) : null, () => null).then(v => { SVC_PAGE.n--; res(v); const nx = SVC_PAGE.q.shift(); if (nx) nx(); }); };
  if (SVC_PAGE.n < PROVIDERS.openfreemap.conc) go(); else SVC_PAGE.q.push(go); }); }
async function svcPageVecTile(z, x, y) {
  if (!SVC_PAGE.tpl) SVC_PAGE.tpl = svcPageGet(VT_SRC).then(b => { try { const j = JSON.parse(VT_TD.decode(b)); return { t: j.tiles[0], max: Math.min(j.maxzoom || 14, 14) }; } catch (e) { SVC_PAGE.tpl = null; return null; } });
  const T = await SVC_PAGE.tpl; if (!T) return null; const zt = Math.min(z, T.max), sc = 2 ** (z - zt), tx = Math.floor(x / sc), ty = Math.floor(y / sc), u = T.t.replace('{z}', zt).replace('{x}', tx).replace('{y}', ty);
  if (!SVC_PAGE.got.has(u)) { if (SVC_PAGE.got.size > 300) SVC_PAGE.got.clear(); SVC_PAGE.got.set(u, svcPageGet(u).then(async b => b ? mvtLayers(await vtUnzip(b), OFF_LAYERS) : null).catch(() => null)); }
  const L = await SVC_PAGE.got.get(u); return L ? { z: zt, x: tx, y: ty, L } : null; }
function svcProvOfUrl(u) { const h = (String(u).match(/^https?:\/\/([^/]+)/) || [])[1] || ''; return Object.keys(PROVIDERS).find(p => PROVIDERS[p].hosts.includes(h)) || ''; }
// ---- 🩺 service health (ש11) ----
function svcHealthHTML() { const d = svcDiag(), esc = escH;
  const st = id => svcBlocked(id) ? `<b>חסום עד מחר</b>${SEP}<a href="${esc(PROVIDERS[id].terms.u)}" target="_blank" rel="noopener">התנאים</a>` : svcProvDown(id) ? 'לא מגיעים לשרת' : SVC.p[id].pauseUntil > svcT() ? `${msi('pause', { size: 16, cls: 'msi-in' })} עמוס עוד ${tmFmt('until', SVC.p[id].pauseUntil - svcT())}` : '✓ עובד';
  const provs = Object.keys(PROVIDERS).filter(id => !PROVIDERS[id].viewOnly).map(id => { const R = PROVIDERS[id], n = svcCountToday(id);
    return `<div class="svc-h"><b>${esc(R.name)}</b><span>${st(id)}</span><small>היום <bdi>${n}</bdi>${R.rate.day ? ` מתוך <bdi>${R.rate.day}</bdi>` : ''} בקשות${SVC.p[id].q.length ? `${SEP}<bdi>${SVC.p[id].q.length}</bdi> בתור` : ''}</small></div>`; }).join('');
  const mem = Object.entries(SERVICES).filter(([, S]) => S.memory && REG_BY[S.memory] && REG_BY[S.memory].where.ls).map(([id, S]) => { const r = REG_BY[S.memory], n = Object.keys(regRead(S.memory) || {}).length, cap = /cap:(\d+)/.exec(r.clean);
    return `<div class="svc-h"><b>${esc(S.name)}</b><small>שמור <bdi>${n}</bdi>${cap ? ` מתוך <bdi>${cap[1]}</bdi>` : ''}</small></div>`; }).join('');
  const errs = d.errs.slice(-50).reverse().map(e => `<div class="svc-e"><bdi>${tmFmt('date', e.at)} ${tmFmt('stamp', e.at)}</bdi>${SEP}${esc((PROVIDERS[e.p] || {}).name || e.p)}${SEP}${esc((SERVICES[e.s] || {}).name || e.s)}${SEP}<bdi>${esc(e.why)}</bdi></div>`).join('');
  return `<p class="sh-hint">הספקים, הבקשות של היום, ומה שנשמר בטלפון.</p>${MAP_AVAILABLE ? '<p class="sh-hint"><a href="#" class="svc-diag-link" data-act="set.diagOpen">מקום שלא מופיע על המפה? ← מקומות שלא על המפה ›</a></p>' : ''}
    <div class="svc-hs">${provs}</div><div class="wx-sub"><b>זיכרונות</b></div><div class="svc-hs">${mem}</div>
    <div class="wx-sub"><b>תקלות אחרונות</b></div>${errs || '<p class="sh-hint">אין תקלות.</p>'}
    <button type="button" class="btn-nav btn-ghost" data-act="svc.copyReport">${msi('content_copy', { size: 18 })} העתקת הדוח</button>`; }
function svcReportText() { const d = svcDiag();
  return ['מצב השירותים - ' + APP.appTitle + ' ' + APP_VERSION + SEP + tmFmt('date', Date.now()),
    ...Object.keys(PROVIDERS).filter(id => !PROVIDERS[id].viewOnly).map(id => `${PROVIDERS[id].name}: ${svcBlocked(id) ? 'חסום עד מחר' : SVC.p[id].pauseUntil > svcT() ? 'עמוס' : 'עובד'}${SEP}היום ${svcCountToday(id)}${PROVIDERS[id].rate.day ? '/' + PROVIDERS[id].rate.day : ''}`),
    ...(() => { const bad = []; Object.entries(PROVIDERS).forEach(([id, R]) => PROVIDER_FIELDS.forEach(f => { if (R[f] === undefined) bad.push(id + '.' + f); })); Object.entries(SERVICES).forEach(([id, S]) => SERVICE_FIELDS.forEach(f => { if (S[f] === undefined) bad.push(id + '.' + f); })); return bad.length ? ['שורות חסרות ברישום: ' + bad.join(', ')] : []; })(),
    'תקלות:', ...d.errs.slice(-50).map(e => `${tmFmt('date', e.at)} ${tmFmt('stamp', e.at)}${SEP}${e.p}${SEP}${e.s}${SEP}${e.why}`)].join('\n'); }
act('svc.copyReport', () => { copyWithFallback(svcReportText(), 'הדוח הועתק'); return 'quiet'; });
act('set.diagOpen', () => { ACC_OPEN['set-diag'] = true; setTimeout(() => reveal(document.querySelector('#main [data-acc="set-diag"]'), false, { align: 'start' }), 80); return 'redraw'; }); // 9.6.0 (12ו, batch 14.5)
act('svc.diagPlaces', c => { DIAG_DEST = c.v || ''; DIAG_ONCE = true; closeSheet(); ACC_OPEN['set-diag'] = true; goTab('settings'); });
var DIAG_DEST = '', DIAG_ONCE = false; // 🩺 opened from a destination's "N בלי מיקום" line: only that destination
window.addEventListener('load', () => setTimeout(() => { try { rateDaily(); } catch (e) {} }, 5000)); // the rate, once a day in the background (ש8)
// 11.29.0 (task launch-fast; decisions 2026-11-19 · The launch screen, Q6 (a)): a library the page loads after its first screen (the map
// library, js/map-library.js) - its style and its script added to the page; not a service (no provider, no quota): the service worker's
// library cache answers both (cache-first). done(ok) once both are in or failed; ok = the script loaded
// 11.38.2 (privacy-server): sri { js, css } - each file's integrity hash, fetched with crossorigin="anonymous" (a CDN file that is not
// exactly the one hashed is refused by the browser: the library then counts as not loaded, as when the network fails)
function svcLibrary(js, css, done, sri) {
  let left = 2, okJs = false; const one = () => { if (--left === 0) done(okJs); }, pin = (el, h) => { if (h) { el.integrity = h; el.crossOrigin = 'anonymous'; } };
  if (css && !document.querySelector('link[data-lib="' + css + '"]')) { const l = document.createElement('link'); l.rel = 'stylesheet'; pin(l, sri && sri.css); l.href = css; l.dataset.lib = css; l.onload = one; l.onerror = () => { l.remove(); one(); }; document.head.appendChild(l); } else one();
  const s = document.createElement('script'); pin(s, sri && sri.js); s.src = js; s.async = true; s.onload = () => { okJs = true; one(); }; s.onerror = () => { s.remove(); one(); }; document.head.appendChild(s);
}
// 11.46.0 (phone-round-4c-fixes P3; decisions 2026-11-21 · Review of the `phone-round-4b-fixes` summary, Q2; standard ui-look-layout
// "Waiting on an outside service"): "in progress" - the one indicator of a screen or window waiting on an outside service. waitOn(host, o)
// puts a moving bar under the host's head (o.head: the element it goes after; else the host's first child), writes the stage line with
// moving dots into o.line (o.stage: its words, no "…"), and dims o.map with a pulsing ring on its middle - the estimated area. It returns
// { stage(words), done() }: done takes the bar, the line and the dimming off (the screen then writes its result or its failure line);
// both are safe after the host left the page. waitLineHTML(words) is the stage line alone - every "searching…" line of the app.
function waitLineHTML(t) { return `<small class="ps-line ps-busy wait-line" role="status">${escH(t)}<span class="wait-dots">…</span></small>`; }
function waitOn(host, o) { o = o || {}; if (!host) return { stage() {}, done() {} };
  const bar = document.createElement('div'); bar.className = 'wait-bar'; bar.setAttribute('role', 'progressbar'); bar.setAttribute('aria-label', o.stage || 'בטעינה');
  const after = o.head && o.head.parentElement === host ? o.head : null; if (after) after.after(bar); else host.prepend(bar);
  const line = o.line || null, map = o.map || null, stage = t => { if (line && line.isConnected) line.innerHTML = waitLineHTML(t); bar.setAttribute('aria-label', t); };
  if (o.stage) stage(o.stage); let ring = null; if (map) { map.classList.add('wait-map'); ring = document.createElement('div'); ring.className = 'wait-ring'; ring.setAttribute('aria-hidden', 'true'); map.appendChild(ring); }
  let on = true; return { stage: t => { if (on) stage(t); }, done: () => { if (!on) return; on = false; bar.remove(); if (ring) ring.remove(); if (map) map.classList.remove('wait-map'); if (line && line.querySelector('.wait-line')) line.innerHTML = ''; } }; }
// ================= END EXTERNAL SERVICES =================

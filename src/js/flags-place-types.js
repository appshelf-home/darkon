// 5.11.0: a destination shows its flag, or nothing (no 📍 / 🗺️ for a destination). Where the flag comes from: flagOf.
// 5.12.0: the destination's country (meta.country, two letters, in the data, backups and destination files) decides its flag;
// without it - the currency's country, except the euro (shared by many countries: no flag until the country is set).
function destFlagMeta(meta) { return !meta ? '' : meta.country ? flagOfCountry(meta.country) : flagOf(meta.currency); }
function flagOfCountry(cc) { cc = String(cc || '').toUpperCase(); return /^[A-Z]{2}$/.test(cc) ? String.fromCodePoint(...[...cc].map(x => 0x1F1E6 + x.charCodeAt(0) - 65)) : ''; }
let _CN = null; // country names in Hebrew, from the browser (Intl.DisplayNames)
function countryName(cc) { try { if (!_CN) _CN = new Intl.DisplayNames(['he'], { type: 'region', fallback: 'none' }); const n = _CN.of(String(cc).toUpperCase()); return n && n !== String(cc).toUpperCase() ? n : ''; } catch (e) { return ''; } }
function countryOfCurrency(cur) { const c = cur && cur.code; if (!c || c === 'EUR') return ''; const cc = c.slice(0, 2).toUpperCase(); return countryName(cc) ? cc : ''; }
const NOT_COUNTRY = new Set(['EU', 'EZ', 'UN', 'ZZ', 'QO', 'AC', 'CP', 'CQ', 'DG', 'EA', 'IC', 'TA', 'XA', 'XB', 'FX',
  'AN', 'BU', 'CS', 'DD', 'DY', 'HV', 'NH', 'RH', 'SU', 'TP', 'UK', 'VD', 'YD', 'YU', 'ZR', 'BV', 'HM']); // 11.14.0 (P15): old codes the browser still names - each a second row of a country, with no clock and no currency; two islands nobody lives on (no clock)
// 11.14.0 (phone-round-1-fixes P15, G18): a country's currency (ISO 4217) - what choosing a destination's country fills; the name is the
// browser's Hebrew name of the code (curNameHe). A territory takes the currency in use there (Panama, Ecuador, Timor-Leste: the dollar;
// Bulgaria: the euro since 1.1.2026; Curaçao and Sint Maarten: the Caribbean guilder since 2025; Sierra Leone: the new leone - each with the
// code it replaced, for a browser that does not know the new one yet). Antarctica has none: its fields stay as they are.
const COUNTRY_CUR = Object.fromEntries(('AD:EUR AE:AED AF:AFN AG:XCD AI:XCD AL:ALL AM:AMD AO:AOA AR:ARS AS:USD AT:EUR AU:AUD AW:AWG AX:EUR AZ:AZN BA:BAM BB:BBD BD:BDT BE:EUR BF:XOF BG:EUR BH:BHD BI:BIF BJ:XOF BL:EUR BM:BMD BN:BND BO:BOB BQ:USD BR:BRL BS:BSD BT:BTN BV:NOK BW:BWP BY:BYN BZ:BZD '
  + 'CA:CAD CC:AUD CD:CDF CF:XAF CG:XAF CH:CHF CI:XOF CK:NZD CL:CLP CM:XAF CN:CNY CO:COP CR:CRC CU:CUP CV:CVE CW:XCG/ANG CX:AUD CY:EUR CZ:CZK DE:EUR DJ:DJF DK:DKK DM:XCD DO:DOP DZ:DZD EC:USD EE:EUR EG:EGP EH:MAD ER:ERN ES:EUR ET:ETB FI:EUR FJ:FJD FK:FKP FM:USD FO:DKK FR:EUR '
  + 'GA:XAF GB:GBP GD:XCD GE:GEL GF:EUR GG:GBP GH:GHS GI:GIP GL:DKK GM:GMD GN:GNF GP:EUR GQ:XAF GR:EUR GS:GBP GT:GTQ GU:USD GW:XOF GY:GYD HK:HKD HM:AUD HN:HNL HR:EUR HT:HTG HU:HUF ID:IDR IE:EUR IL:ILS IM:GBP IN:INR IO:USD IQ:IQD IR:IRR IS:ISK IT:EUR JE:GBP JM:JMD JO:JOD JP:JPY '
  + 'KE:KES KG:KGS KH:KHR KI:AUD KM:KMF KN:XCD KP:KPW KR:KRW KW:KWD KY:KYD KZ:KZT LA:LAK LB:LBP LC:XCD LI:CHF LK:LKR LR:LRD LS:LSL LT:EUR LU:EUR LV:EUR LY:LYD MA:MAD MC:EUR MD:MDL ME:EUR MF:EUR MG:MGA MH:USD MK:MKD ML:XOF MM:MMK MN:MNT MO:MOP MP:USD MQ:EUR MR:MRU MS:XCD MT:EUR MU:MUR MV:MVR MW:MWK MX:MXN MY:MYR MZ:MZN '
  + 'NA:NAD NC:XPF NE:XOF NF:AUD NG:NGN NI:NIO NL:EUR NO:NOK NP:NPR NR:AUD NU:NZD NZ:NZD OM:OMR PA:USD PE:PEN PF:XPF PG:PGK PH:PHP PK:PKR PL:PLN PM:EUR PN:NZD PR:USD PS:ILS PT:EUR PW:USD PY:PYG QA:QAR RE:EUR RO:RON RS:RSD RU:RUB RW:RWF '
  + 'SA:SAR SB:SBD SC:SCR SD:SDG SE:SEK SG:SGD SH:SHP SI:EUR SJ:NOK SK:EUR SL:SLE/SLL SM:EUR SN:XOF SO:SOS SR:SRD SS:SSP ST:STN SV:USD SX:XCG/ANG SY:SYP SZ:SZL TC:USD TD:XAF TF:EUR TG:XOF TH:THB TJ:TJS TK:NZD TL:USD TM:TMT TN:TND TO:TOP TR:TRY TT:TTD TV:AUD TW:TWD TZ:TZS '
  + 'UA:UAH UG:UGX UM:USD US:USD UY:UYU UZ:UZS VA:EUR VC:XCD VE:VES VG:USD VI:USD VN:VND VU:VUV WF:XPF WS:WST XK:EUR YE:YER YT:EUR ZA:ZAR ZM:ZMW ZW:USD').split(' ').map(x => x.split(':')));
let _CURN = null;
function curNameHe(code) { try { if (!_CURN) _CURN = new Intl.DisplayNames(['he'], { type: 'currency', fallback: 'none' }); return _CURN.of(String(code).toUpperCase()) || ''; } catch (e) { return ''; } }
function countryCur(cc) { const v = COUNTRY_CUR[String(cc || '').toUpperCase()]; if (!v) return null; // "NEW/OLD": a code a browser may not know yet, then the one it replaced
  const codes = v.split('/'), code = codes.find(curNameHe) || codes[0]; return { code, name: curNameHe(code) || code }; }
function countryList() { const out = []; for (let a = 65; a <= 90; a++) for (let b = 65; b <= 90; b++) { const cc = String.fromCharCode(a, b); if (NOT_COUNTRY.has(cc)) continue; const n = countryName(cc); if (n) out.push({ cc, n }); }
  return out.sort((x, y) => x.n.localeCompare(y.n, 'he')); }
function destFlag(id) { return DESTS[id] ? destFlagMeta(DESTS[id].meta) : ''; }
function withFlag(f, name) { return (f ? f + ' ' : '') + name; }
// 4.3.4: icons are defined before startup (a multi-destination trip with merged layer chips crashed on open)
const ICON_EMOJI = {
  airport:'✈️', animal:'🐾', asian:'🥢', atm:'🏧', bakery:'🥐', bar:'🍸', bbq:'🍖',
  boat_tour:'🚢', burger:'🍔', bus_station:'🚌', cafe:'☕', cartoon_character:'🎭',
  experience:'🎪', food_hall:'🍱', french:'🥖', grocery_or_supermarket:'🛒',
  historical_figure:'🎓', hungarian:'🥘', ice_cream:'🍦', international:'🌍', restaurant:'🍽️',
  invention_object:'💡', italian:'🍝', landmark:'🏛️', local_legend:'📖', lodging:'🏨',
  market:'🧺', middle_eastern:'🧆', night_club:'🪩', park:'🌳', political_satire:'🚩',
  pop_culture:'🎬', promenade:'🚶', shopping_mall:'🏬', shopping_street:'🛍️', vintage:'👗', note:'📝', spa:'💆',
  steakhouse:'🥩', street_food:'🌮', tourist_attraction:'📍', wine:'🍷', zoo:'🦁',
  // 4.2.0: more general icons for new destinations
  museum:'🖼️', church:'⛪', viewpoint:'🔭', beach:'🏖️', mountain:'⛰️', lake:'🏞️', neighborhood:'🏘️', seafood:'🦐',
  theatre:'🎭', sports:'⚽', pharmacy:'💊', hospital:'🏥', meeting_point:'🚩', info_point:'ℹ️', train_station:'🚆', port:'⚓',
};
// 10.1.0 (design-1): the place-type icons as Material Symbols (look.md "Icons", notes/design-round/iconmap.txt) - the data keeps its keys
const ICON_MS = {
  airport: 'flight', animal: 'pets', asian: 'ramen_dining', atm: 'local_atm', bakery: 'bakery_dining', bar: 'local_bar', bbq: 'outdoor_grill',
  boat_tour: 'directions_boat', burger: 'lunch_dining', bus_station: 'directions_bus', cafe: 'local_cafe', cartoon_character: 'theater_comedy',
  experience: 'attractions', food_hall: 'food_bank', french: 'breakfast_dining', grocery_or_supermarket: 'local_grocery_store',
  historical_figure: 'history_edu', hungarian: 'soup_kitchen', ice_cream: 'icecream', international: 'public', restaurant: 'restaurant',
  invention_object: 'lightbulb', italian: 'dinner_dining', landmark: 'account_balance', local_legend: 'auto_stories', lodging: 'hotel',
  market: 'storefront', middle_eastern: 'kebab_dining', night_club: 'nightlife', park: 'park', political_satire: 'campaign',
  pop_culture: 'movie', promenade: 'directions_walk', shopping_mall: 'local_mall', shopping_street: 'shopping_bag', vintage: 'checkroom', note: 'sticky_note_2', spa: 'spa',
  steakhouse: 'outdoor_grill', street_food: 'fastfood', tourist_attraction: 'location_on', wine: 'wine_bar', zoo: 'giraffe',
  museum: 'museum', church: 'church', viewpoint: 'panorama', beach: 'beach_access', mountain: 'terrain', lake: 'water', neighborhood: 'holiday_village', seafood: 'set_meal',
  theatre: 'theater_comedy', sports: 'sports_soccer', pharmacy: 'local_pharmacy', hospital: 'local_hospital', meeting_point: 'flag', info_point: 'info', train_station: 'train', port: 'anchor',
};
const GIRAFFE_SVG = '<svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M16 2.6v1.4M17.8 2.6v1.4"/><path d="M15.2 4h3.6l2.4 2-2.4 1h-1.6"/><path d="M15.2 4l-1 1.4L12 14H5.4a1.8 1.8 0 0 0-1.8 1.8"/><path d="M17.2 7L14.2 15.4v6"/><path d="M12 14v7.4M7.4 14.8v6.6M5 15.6v5.8"/><path d="M3.6 15.8L2.4 18"/><circle cx="14.6" cy="9.6" r=".6" fill="currentColor" stroke="none"/><circle cx="9.6" cy="16.2" r=".6" fill="currentColor" stroke="none"/><circle cx="13.2" cy="12.4" r=".6" fill="currentColor" stroke="none"/></svg>'; // the original giraffe (notes/design-round/giraffe.svg) - Material Symbols has none
const IL_FLAG_SVG = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><rect x="2.5" y="5" width="19" height="14" rx="1.5"/><path d="M2.5 8h19M2.5 16h19"/><path d="M12 9.3l2.3 4H9.7z M12 14.7l-2.3-4h4.6z" stroke-width="1.2"/></svg>'; // one-way (7): the Israeli flag of "נציגות ישראל" (menu-screens.js infoSecIcon) - Material Symbols has none; drawn through msi like the giraffe
// 10.8.0 (design-icons): a place type's name - the filter's style chips show the line icon, and say its name on a long press
const ICON_HE = { airport: 'שדה תעופה', animal: 'בעלי חיים', asian: 'אסייתי', atm: 'כספומט', bakery: 'מאפייה', bar: 'בר', bbq: 'גריל', boat_tour: 'שיט', burger: 'המבורגר',
  bus_station: 'תחנת אוטובוס', cafe: 'בית קפה', cartoon_character: 'דמות', experience: 'חוויה', food_hall: 'שוק אוכל', french: 'צרפתי', grocery_or_supermarket: 'סופר',
  historical_figure: 'דמות היסטורית', hungarian: 'מקומי', ice_cream: 'גלידה', international: 'בינלאומי', restaurant: 'מסעדה', invention_object: 'המצאה', italian: 'איטלקי', landmark: 'אתר',
  local_legend: 'אגדה מקומית', lodging: 'לינה', market: 'שוק', middle_eastern: 'מזרח תיכוני', night_club: 'מועדון', park: 'פארק', political_satire: 'סאטירה', pop_culture: 'תרבות פופ',
  promenade: 'טיילת', shopping_mall: 'קניון', shopping_street: 'רחוב קניות', vintage: 'וינטג׳', note: 'הערה', spa: 'ספא', steakhouse: 'סטייקיה', street_food: 'אוכל רחוב',
  tourist_attraction: 'אטרקציה', wine: 'יין', zoo: 'גן חיות', museum: 'מוזיאון', church: 'כנסייה', viewpoint: 'תצפית', beach: 'חוף', mountain: 'הר', lake: 'אגם', neighborhood: 'שכונה',
  seafood: 'פירות ים', theatre: 'תיאטרון', sports: 'ספורט', pharmacy: 'בית מרקחת', hospital: 'בית חולים', meeting_point: 'מקום מפגש', info_point: 'מידע', train_station: 'רכבת', port: 'נמל' };
function warnIc() { return msi('warning', { cls: 'msi-in warn-ic' }); } // 10.8.0 (design-icons): a warning inside a text, the line icon in the warning color
function itemIcon(p, o) { return p && p.travel ? msi(TRAVEL_MS[p.travel] || 'flight', o) : typeIcon(p && p.icon, o); } // 10.8.0 (design-icons, gap 23): a place's or travel's line icon (the HTML twin of iconEmoji)
function typeIcon(key, o) { return msi(ICON_MS[key] || 'location_on', o); } // 10.1.0 (design-1): a place type's line icon
const SYM_KEY = '<i class="sym sym-key" aria-hidden="true"></i>', SYM_BOOKED = '<i class="sym sym-booked" aria-hidden="true"></i>'; // 5.0.0: drawn symbols (see .sym)
const BUNDLE = (() => { try { return JSON.parse(document.getElementById('bundle').textContent) || {}; } catch (e) { return {}; } })();
BUNDLE.destinations = BUNDLE.destinations || []; BUNDLE.trips = BUNDLE.trips || []; BUNDLE.copy = BUNDLE.copy || 'empty';
// 4.0.0: base layer vocabulary shared by all destinations; a layer points at one by "type" (unique layers have none)
const BASE_TYPES = {
  lodging:     { name: 'לינה ולוגיסטיקה', label: 'לינה', color: '#757575', icon: 'lodging' },
  food:        { name: 'אוכל', label: 'אוכל', color: '#F57C00', icon: 'restaurant' }, // 11.19.0 (small-fixes 21): a knife and fork (was the globe of "international")
  drink:       { name: 'שתייה וחיי לילה', label: 'שתייה', color: '#6A1B9A', icon: 'bar' },
  attractions: { name: 'אטרקציות', label: 'אטרקציות', color: '#1E88E5', icon: 'landmark' },
  nature:      { name: 'טבע ופארקים', label: 'טבע', color: '#43A047', icon: 'park' },
  shopping:    { name: 'קניות', label: 'קניות', color: '#D81B60', icon: 'shopping_street' },
};
const HEADING_FONTS = ['Frank Ruhl Libre', 'Rubik', 'Secular One', 'Suez One', 'Assistant'];
const NO_DEST = { id: '', idBase: 0, builtin: true, meta: { name: '', description: '', center: [31.78, 35.22], timeZone: 'Asia/Jerusalem', currency: { code: 'EUR', name: 'אירו' }, theme: { primary: '#1C2B33', accent: '#C08A2E', headingFont: 'Rubik' }, layers: [], regions: [] }, places: [], info: '' };

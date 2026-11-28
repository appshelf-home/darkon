// ================= 7.0.0: TIME - the one mechanism for every date and time (cl-time-impl-plan, decisions ז1-ז12, ג1) =================
// Nothing outside this block computes or formats a date or a time: "today" and "now", day and minute arithmetic, weekdays,
// time zones, sunrise/sunset, the trip's days and which clock is in effect - and every date/time shown on screen or in a file.
// A screen names the role, never the format: tmFmt('pick'|'day'|'dayN'|'file'|'rel'|'until'|'time'|'range'|'stamp', ...).
// Ring 1 - clock and calendar; ring 2 - the trip's calendar (its days, its destinations by day, its state, the clock in
// effect at a moment: the destination you are at, switching at the landing of the last leg of the chain that arrives - ז4, ג1).
// Ring 3 (the day paths: rebuildTripDays, the day operations, the slot placing) keeps its logic and calls these.
// Allowed outside the block: new Date()/Date.now() for stamps, ids, durations and timers only (the guard test t800 lists them).
// Guard test: t800. Mechanism map: `darkon/spec/time-and-dates.md`.
var VDATE = '2001-01-01'; // a trip without dates has its days on "virtual" dates from here ("יום N")
var TM_HOME = 'Asia/Jerusalem'; // home is always Israel
var TM_WD = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
var _SIMULATED_DATE = new URLSearchParams(location.search).get('simulate'); // tests: ?simulate=YYYY-MM-DD moves "the moment"
// ---- ring 1: the moment, the calendar ----
function tmNow() { // the one moment; ?simulate moves the date and keeps the phone's time of day
  const n = new Date(); if (!(_SIMULATED_DATE && /^\d{4}-\d{2}-\d{2}$/.test(_SIMULATED_DATE))) return n;
  const [y, m, d] = _SIMULATED_DATE.split('-').map(Number); const s = new Date(n); s.setFullYear(y, m - 1, d); return s; }
function tmMs(x) { return x == null ? tmNow().getTime() : x instanceof Date ? x.getTime() : typeof x === 'number' ? x : new Date(x).getTime(); }
function isIso(s) { return /^\d{4}-\d{2}-\d{2}$/.test(s || ''); }
function tmPhoneDate(at) { const d = new Date(tmMs(at)); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function tmPhoneHM(at) { const d = new Date(tmMs(at)); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
function isoAdd(iso, n) { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function daysBetween(a, b) { return Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 864e5); }
function nightsBetween(a, b) { return a && b ? daysBetween(a, b) : 0; }
function tmWeekday(iso) { return new Date(iso + 'T12:00:00Z').getUTCDay(); }
function tmParseDMY(s) { const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(String(s || '')); return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null; } // one-way (9): the parse role - "27.12.2026" (tmFmt 'date') -> "2026-12-27"; anything else -> null
function tmMin(hm) { return +String(hm).slice(0, 2) * 60 + +String(hm).slice(3, 5); }
function tmHM(m) { m = ((Math.round(m) % 1440) + 1440) % 1440; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); }
function tmAddMin(hm, n) { return tmHM(tmMin(hm) + n); }
function isHM(s) { return /^\d{2}:\d{2}$/.test(s || ''); }
// ---- ring 1: time zones (Intl; no network) ----
const _tmFmtCache = {};
function _tmParts(zone, ms) { const k = zone || '';
  const f = _tmFmtCache[k] = _tmFmtCache[k] || new Intl.DateTimeFormat('en-US', { timeZone: zone || undefined, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const o = {}; f.formatToParts(new Date(ms)).forEach(p => { o[p.type] = p.value; }); return o; }
const _tmZoneOkCache = new Map(); // 11.21.5 (time-zone-cache): a zone's answer never changes in a page's life - a formatter built per call grew the browser to GBs on travel days
function tmZoneOk(zone) { if (!zone || typeof zone !== 'string') return false; let ok = _tmZoneOkCache.get(zone);
  if (ok === undefined) { try { new Intl.DateTimeFormat('en-US', { timeZone: zone }); ok = true; } catch (e) { ok = false; } _tmZoneOkCache.set(zone, ok); } return ok; }
function tmOffset(zone, at) { // minutes east of UTC; at = a moment, or a date (its noon UTC)
  const ms = typeof at === 'string' && isIso(at) ? Date.parse(at + 'T12:00:00Z') : tmMs(at); if (!tmZoneOk(zone)) return 0;
  const p = _tmParts(zone, ms); return Math.round((Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(ms / 1000) * 1000) / 6e4); }
function tmWall(zone, at) { const p = _tmParts(tmZoneOk(zone) ? zone : TM_HOME, tmMs(at)); return { date: `${p.year}-${p.month}-${p.day}`, hm: `${p.hour}:${p.minute}` }; }
function tmIsoStamp(at) { return new Date(tmMs(at)).toISOString(); }
function tmMoment(iso, hm, zone) { // the moment of a wall time (date + HH:MM) in a zone
  const guess = Date.parse(`${iso}T${hm || '00:00'}:00Z`); let ms = guess - tmOffset(zone, guess) * 6e4;
  ms = guess - tmOffset(zone, ms) * 6e4; return ms; }
// ---- ring 1: the zone table (country, zone, centre) - which zones a country has, the nearest to a point (ז6, ז11) ----
const TM_ZONES = 'AD Europe/Andorra 42.5 1.5;AE Asia/Dubai 25.3 55.3;AF Asia/Kabul 34.5 69.2;AG America/Antigua 17.1 -61.8;AI America/Anguilla 18.2 -63.1;AL Europe/Tirane 41.3 19.8;AM Asia/Yerevan 40.2 44.5;AO Africa/Luanda -8.8 13.2;AQ Antarctica/McMurdo -77.8 166.6;AQ Antarctica/Casey -66.3 110.5;AQ Antarctica/Davis -68.6 78;AQ Antarctica/DumontDUrville -66.7 140;AQ Antarctica/Mawson -67.6 62.9;AQ Antarctica/Palmer -64.8 -64.1;AQ Antarctica/Rothera -67.6 -68.1;AQ Antarctica/Syowa -69 39.6;AQ Antarctica/Troll -72 2.5;AQ Antarctica/Vostok -78.4 106.9;AR America/Argentina/Buenos_Aires -34.6 -58.5;AR America/Argentina/Cordoba -31.4 -64.2;AR America/Argentina/Salta -24.8 -65.4;AR America/Argentina/Jujuy -24.2 -65.3;AR America/Argentina/Tucuman -26.8 -65.2;AR America/Argentina/Catamarca -28.5 -65.8;AR America/Argentina/La_Rioja -29.4 -66.8;AR America/Argentina/San_Juan -31.5 -68.5;AR America/Argentina/Mendoza -32.9 -68.8;AR America/Argentina/San_Luis -33.3 -66.3;AR America/Argentina/Rio_Gallegos -51.6 -69.2;AR America/Argentina/Ushuaia -54.8 -68.3;AS Pacific/Pago_Pago -14.3 -170.7;AT Europe/Vienna 48.2 16.3;AU Australia/Lord_Howe -31.6 159.1;AU Antarctica/Macquarie -54.5 158.9;AU Australia/Hobart -42.9 147.3;AU Australia/Melbourne -37.8 145;AU Australia/Sydney -33.9 151.2;AU Australia/Broken_Hill -31.9 141.4;AU Australia/Brisbane -27.5 153;AU Australia/Lindeman -20.3 149;AU Australia/Adelaide -34.9 138.6;AU Australia/Darwin -12.5 130.8;AU Australia/Perth -31.9 115.8;AU Australia/Eucla -31.7 128.9;AW America/Aruba 12.5 -70;AX Europe/Mariehamn 60.1 19.9;AZ Asia/Baku 40.4 49.9;BA Europe/Sarajevo 43.9 18.4;BB America/Barbados 13.1 -59.6;BD Asia/Dhaka 23.7 90.4;BE Europe/Brussels 50.8 4.3;BF Africa/Ouagadougou 12.4 -1.5;BG Europe/Sofia 42.7 23.3;BH Asia/Bahrain 26.4 50.6;BI Africa/Bujumbura -3.4 29.4;BJ Africa/Porto-Novo 6.5 2.6;BL America/St_Barthelemy 17.9 -62.9;BM Atlantic/Bermuda 32.3 -64.8;BN Asia/Brunei 4.9 114.9;BO America/La_Paz -16.5 -68.2;BQ America/Kralendijk 12.2 -68.3;BR America/Noronha -3.9 -32.4;BR America/Belem -1.4 -48.5;BR America/Fortaleza -3.7 -38.5;BR America/Recife -8.1 -34.9;BR America/Araguaina -7.2 -48.2;BR America/Maceio -9.7 -35.7;BR America/Bahia -13 -38.5;BR America/Sao_Paulo -23.5 -46.6;BR America/Campo_Grande -20.4 -54.6;BR America/Cuiaba -15.6 -56.1;BR America/Santarem -2.4 -54.9;BR America/Porto_Velho -8.8 -63.9;BR America/Boa_Vista 2.8 -60.7;BR America/Manaus -3.1 -60;BR America/Eirunepe -6.7 -69.9;BR America/Rio_Branco -10 -67.8;BS America/Nassau 25.1 -77.3;BT Asia/Thimphu 27.5 89.7;BW Africa/Gaborone -24.6 25.9;BY Europe/Minsk 53.9 27.6;BZ America/Belize 17.5 -88.2;CA America/St_Johns 47.6 -52.7;CA America/Halifax 44.6 -63.6;CA America/Glace_Bay 46.2 -60;CA America/Moncton 46.1 -64.8;CA America/Goose_Bay 53.3 -60.4;CA America/Blanc-Sablon 51.4 -57.1;CA America/Toronto 43.6 -79.4;CA America/Iqaluit 63.7 -68.5;CA America/Atikokan 48.8 -91.6;CA America/Winnipeg 49.9 -97.2;CA America/Resolute 74.7 -94.8;CA America/Rankin_Inlet 62.8 -92.1;CA America/Regina 50.4 -104.7;CA America/Swift_Current 50.3 -107.8;CA America/Edmonton 53.5 -113.5;CA America/Cambridge_Bay 69.1 -105;CA America/Inuvik 68.3 -133.7;CA America/Creston 49.1 -116.5;CA America/Dawson_Creek 55.8 -120.2;CA America/Fort_Nelson 58.8 -122.7;CA America/Whitehorse 60.7 -135.1;CA America/Dawson 64.1 -139.4;CA America/Vancouver 49.3 -123.1;CC Indian/Cocos -12.2 96.9;CD Africa/Kinshasa -4.3 15.3;CD Africa/Lubumbashi -11.7 27.5;CF Africa/Bangui 4.4 18.6;CG Africa/Brazzaville -4.3 15.3;CH Europe/Zurich 47.4 8.5;CI Africa/Abidjan 5.3 -4;CK Pacific/Rarotonga -21.2 -159.8;CL America/Santiago -33.5 -70.7;CL America/Coyhaique -45.6 -72.1;CL America/Punta_Arenas -53.1 -70.9;CL Pacific/Easter -27.1 -109.4;CM Africa/Douala 4 9.7;CN Asia/Shanghai 31.2 121.5;CN Asia/Urumqi 43.8 87.6;CO America/Bogota 4.6 -74.1;CR America/Costa_Rica 9.9 -84.1;CU America/Havana 23.1 -82.4;CV Atlantic/Cape_Verde 14.9 -23.5;CW America/Curacao 12.2 -69;CX Indian/Christmas -10.4 105.7;CY Asia/Nicosia 35.2 33.4;CY Asia/Famagusta 35.1 34;CZ Europe/Prague 50.1 14.4;DE Europe/Berlin 52.5 13.4;DE Europe/Busingen 47.7 8.7;DJ Africa/Djibouti 11.6 43.1;DK Europe/Copenhagen 55.7 12.6;DM America/Dominica 15.3 -61.4;DO America/Santo_Domingo 18.5 -69.9;DZ Africa/Algiers 36.8 3;EC America/Guayaquil -2.2 -79.8;EC Pacific/Galapagos -0.9 -89.6;EE Europe/Tallinn 59.4 24.8;EG Africa/Cairo 30.1 31.2;EH Africa/El_Aaiun 27.1 -13.2;ER Africa/Asmara 15.3 38.9;ES Europe/Madrid 40.4 -3.7;ES Africa/Ceuta 35.9 -5.3;ES Atlantic/Canary 28.1 -15.4;ET Africa/Addis_Ababa 9 38.7;FI Europe/Helsinki 60.2 25;FJ Pacific/Fiji -18.1 178.4;FK Atlantic/Stanley -51.7 -57.9;FM Pacific/Chuuk 7.4 151.8;FM Pacific/Pohnpei 7 158.2;FM Pacific/Kosrae 5.3 163;FO Atlantic/Faroe 62 -6.8;FR Europe/Paris 48.9 2.3;GA Africa/Libreville 0.4 9.4;GB Europe/London 51.5 -0.1;GD America/Grenada 12.1 -61.8;GE Asia/Tbilisi 41.7 44.8;GF America/Cayenne 4.9 -52.3;GG Europe/Guernsey 49.5 -2.5;GH Africa/Accra 5.5 -0.2;GI Europe/Gibraltar 36.1 -5.3;GL America/Nuuk 64.2 -51.7;GL America/Danmarkshavn 76.8 -18.7;GL America/Scoresbysund 70.5 -22;GL America/Thule 76.6 -68.8;GM Africa/Banjul 13.5 -16.6;GN Africa/Conakry 9.5 -13.7;GP America/Guadeloupe 16.2 -61.5;GQ Africa/Malabo 3.8 8.8;GR Europe/Athens 38 23.7;GS Atlantic/South_Georgia -54.3 -36.5;GT America/Guatemala 14.6 -90.5;GU Pacific/Guam 13.5 144.8;GW Africa/Bissau 11.8 -15.6;GY America/Guyana 6.8 -58.2;HK Asia/Hong_Kong 22.3 114.2;HN America/Tegucigalpa 14.1 -87.2;HR Europe/Zagreb 45.8 16;HT America/Port-au-Prince 18.5 -72.3;HU Europe/Budapest 47.5 19.1;ID Asia/Jakarta -6.2 106.8;ID Asia/Pontianak -0 109.3;ID Asia/Makassar -5.1 119.4;ID Asia/Jayapura -2.5 140.7;IE Europe/Dublin 53.3 -6.2;IL Asia/Jerusalem 31.8 35.2;IM Europe/Isle_of_Man 54.1 -4.5;IN Asia/Kolkata 22.5 88.4;IO Indian/Chagos -7.3 72.4;IQ Asia/Baghdad 33.4 44.4;IR Asia/Tehran 35.7 51.4;IS Atlantic/Reykjavik 64.2 -21.9;IT Europe/Rome 41.9 12.5;JE Europe/Jersey 49.2 -2.1;JM America/Jamaica 18 -76.8;JO Asia/Amman 31.9 35.9;JP Asia/Tokyo 35.6 139.7;KE Africa/Nairobi -1.3 36.8;KG Asia/Bishkek 42.9 74.6;KH Asia/Phnom_Penh 11.6 104.9;KI Pacific/Tarawa 1.4 173;KI Pacific/Kanton -2.8 -171.7;KI Pacific/Kiritimati 1.9 -157.3;KM Indian/Comoro -11.7 43.3;KN America/St_Kitts 17.3 -62.7;KP Asia/Pyongyang 39 125.8;KR Asia/Seoul 37.5 127;KW Asia/Kuwait 29.3 48;KY America/Cayman 19.3 -81.4;KZ Asia/Almaty 43.2 77;KZ Asia/Qyzylorda 44.8 65.5;KZ Asia/Qostanay 53.2 63.6;KZ Asia/Aqtobe 50.3 57.2;KZ Asia/Aqtau 44.5 50.3;KZ Asia/Atyrau 47.1 51.9;KZ Asia/Oral 51.2 51.4;LA Asia/Vientiane 18 102.6;LB Asia/Beirut 33.9 35.5;LC America/St_Lucia 14 -61;LI Europe/Vaduz 47.1 9.5;LK Asia/Colombo 6.9 79.8;LR Africa/Monrovia 6.3 -10.8;LS Africa/Maseru -29.5 27.5;LT Europe/Vilnius 54.7 25.3;LU Europe/Luxembourg 49.6 6.2;LV Europe/Riga 57 24.1;LY Africa/Tripoli 32.9 13.2;MA Africa/Casablanca 33.6 -7.6;MC Europe/Monaco 43.7 7.4;MD Europe/Chisinau 47 28.8;ME Europe/Podgorica 42.4 19.3;MF America/Marigot 18.1 -63.1;MG Indian/Antananarivo -18.9 47.5;MH Pacific/Majuro 7.2 171.2;MH Pacific/Kwajalein 9.1 167.3;MK Europe/Skopje 42 21.4;ML Africa/Bamako 12.7 -8;MM Asia/Yangon 16.8 96.2;MN Asia/Ulaanbaatar 47.9 106.9;MN Asia/Hovd 48 91.7;MO Asia/Macau 22.2 113.5;MP Pacific/Saipan 15.2 145.8;MQ America/Martinique 14.6 -61.1;MR Africa/Nouakchott 18.1 -15.9;MS America/Montserrat 16.7 -62.2;MT Europe/Malta 35.9 14.5;MU Indian/Mauritius -20.2 57.5;MV Indian/Maldives 4.2 73.5;MW Africa/Blantyre -15.8 35;MX America/Mexico_City 19.4 -99.2;MX America/Cancun 21.1 -86.8;MX America/Merida 21 -89.6;MX America/Monterrey 25.7 -100.3;MX America/Matamoros 25.8 -97.5;MX America/Chihuahua 28.6 -106.1;MX America/Ciudad_Juarez 31.7 -106.5;MX America/Ojinaga 29.6 -104.4;MX America/Mazatlan 23.2 -106.4;MX America/Bahia_Banderas 20.8 -105.2;MX America/Hermosillo 29.1 -111;MX America/Tijuana 32.5 -117;MY Asia/Kuala_Lumpur 3.2 101.7;MY Asia/Kuching 1.6 110.3;MZ Africa/Maputo -26 32.6;NA Africa/Windhoek -22.6 17.1;NC Pacific/Noumea -22.3 166.4;NE Africa/Niamey 13.5 2.1;NF Pacific/Norfolk -29.1 168;NG Africa/Lagos 6.5 3.4;NI America/Managua 12.2 -86.3;NL Europe/Amsterdam 52.4 4.9;NO Europe/Oslo 59.9 10.8;NP Asia/Kathmandu 27.7 85.3;NR Pacific/Nauru -0.5 166.9;NU Pacific/Niue -19 -169.9;NZ Pacific/Auckland -36.9 174.8;NZ Pacific/Chatham -44 -176.6;OM Asia/Muscat 23.6 58.6;PA America/Panama 9 -79.5;PE America/Lima -12.1 -77;PF Pacific/Tahiti -17.5 -149.6;PF Pacific/Marquesas -9 -139.5;PF Pacific/Gambier -23.1 -134.9;PG Pacific/Port_Moresby -9.5 147.2;PG Pacific/Bougainville -6.2 155.6;PH Asia/Manila 14.6 121;PK Asia/Karachi 24.9 67;PL Europe/Warsaw 52.2 21;PM America/Miquelon 47 -56.3;PN Pacific/Pitcairn -25.1 -130.1;PR America/Puerto_Rico 18.5 -66.1;PS Asia/Gaza 31.5 34.5;PS Asia/Hebron 31.5 35.1;PT Europe/Lisbon 38.7 -9.1;PT Atlantic/Madeira 32.6 -16.9;PT Atlantic/Azores 37.7 -25.7;PW Pacific/Palau 7.3 134.5;PY America/Asuncion -25.3 -57.7;QA Asia/Qatar 25.3 51.5;RE Indian/Reunion -20.9 55.5;RO Europe/Bucharest 44.4 26.1;RS Europe/Belgrade 44.8 20.5;RU Europe/Kaliningrad 54.7 20.5;RU Europe/Moscow 55.8 37.6;UA Europe/Simferopol 45 34.1;RU Europe/Kirov 58.6 49.6;RU Europe/Volgograd 48.7 44.4;RU Europe/Astrakhan 46.4 48;RU Europe/Saratov 51.6 46;RU Europe/Ulyanovsk 54.3 48.4;RU Europe/Samara 53.2 50.1;RU Asia/Yekaterinburg 56.9 60.6;RU Asia/Omsk 55 73.4;RU Asia/Novosibirsk 55 82.9;RU Asia/Barnaul 53.4 83.8;RU Asia/Tomsk 56.5 85;RU Asia/Novokuznetsk 53.8 87.1;RU Asia/Krasnoyarsk 56 92.8;RU Asia/Irkutsk 52.3 104.3;RU Asia/Chita 52 113.5;RU Asia/Yakutsk 62 129.7;RU Asia/Khandyga 62.6 135.6;RU Asia/Vladivostok 43.2 131.9;RU Asia/Ust-Nera 64.5 143.2;RU Asia/Magadan 59.6 150.8;RU Asia/Sakhalin 47 142.7;RU Asia/Srednekolymsk 67.5 153.7;RU Asia/Kamchatka 53 158.7;RU Asia/Anadyr 64.8 177.5;RW Africa/Kigali -1.9 30.1;SA Asia/Riyadh 24.6 46.7;SB Pacific/Guadalcanal -9.5 160.2;SC Indian/Mahe -4.7 55.5;SD Africa/Khartoum 15.6 32.5;SE Europe/Stockholm 59.3 18.1;SG Asia/Singapore 1.3 103.8;SH Atlantic/St_Helena -15.9 -5.7;SI Europe/Ljubljana 46 14.5;SJ Arctic/Longyearbyen 78 16;SK Europe/Bratislava 48.1 17.1;SL Africa/Freetown 8.5 -13.2;SM Europe/San_Marino 43.9 12.5;SN Africa/Dakar 14.7 -17.4;SO Africa/Mogadishu 2.1 45.4;SR America/Paramaribo 5.8 -55.2;SS Africa/Juba 4.8 31.6;ST Africa/Sao_Tome 0.3 6.7;SV America/El_Salvador 13.7 -89.2;SX America/Lower_Princes 18.1 -63;SY Asia/Damascus 33.5 36.3;SZ Africa/Mbabane -26.3 31.1;TC America/Grand_Turk 21.5 -71.1;TD Africa/Ndjamena 12.1 15.1;TF Indian/Kerguelen -49.4 70.2;TG Africa/Lome 6.1 1.2;TH Asia/Bangkok 13.8 100.5;TJ Asia/Dushanbe 38.6 68.8;TK Pacific/Fakaofo -9.4 -171.2;TL Asia/Dili -8.6 125.6;TM Asia/Ashgabat 38 58.4;TN Africa/Tunis 36.8 10.2;TO Pacific/Tongatapu -21.1 -175.2;TR Europe/Istanbul 41 29;TT America/Port_of_Spain 10.7 -61.5;TV Pacific/Funafuti -8.5 179.2;TW Asia/Taipei 25.1 121.5;TZ Africa/Dar_es_Salaam -6.8 39.3;UA Europe/Kyiv 50.4 30.5;UG Africa/Kampala 0.3 32.4;UM Pacific/Midway 28.2 -177.4;UM Pacific/Wake 19.3 166.6;US America/New_York 40.7 -74;US America/Detroit 42.3 -83;US America/Kentucky/Louisville 38.2 -85.8;US America/Kentucky/Monticello 36.8 -84.8;US America/Indiana/Indianapolis 39.8 -86.2;US America/Indiana/Vincennes 38.7 -87.5;US America/Indiana/Winamac 41 -86.6;US America/Indiana/Marengo 38.4 -86.3;US America/Indiana/Petersburg 38.5 -87.3;US America/Indiana/Vevay 38.7 -85.1;US America/Chicago 41.9 -87.7;US America/Indiana/Tell_City 38 -86.8;US America/Indiana/Knox 41.3 -86.6;US America/Menominee 45.1 -87.6;US America/North_Dakota/Center 47.1 -101.3;US America/North_Dakota/New_Salem 46.8 -101.4;US America/North_Dakota/Beulah 47.2 -101.8;US America/Denver 39.7 -105;US America/Boise 43.6 -116.2;US America/Phoenix 33.4 -112.1;US America/Los_Angeles 34 -118.2;US America/Anchorage 61.2 -149.9;US America/Juneau 58.3 -134.4;US America/Sitka 57.2 -135.3;US America/Metlakatla 55.1 -131.6;US America/Yakutat 59.5 -139.7;US America/Nome 64.5 -165.4;US America/Adak 51.9 -176.7;US Pacific/Honolulu 21.3 -157.8;UY America/Montevideo -34.9 -56.2;UZ Asia/Samarkand 39.7 66.8;UZ Asia/Tashkent 41.3 69.3;VA Europe/Vatican 41.9 12.4;VC America/St_Vincent 13.2 -61.2;VE America/Caracas 10.5 -66.9;VG America/Tortola 18.4 -64.6;VI America/St_Thomas 18.4 -64.9;VN Asia/Ho_Chi_Minh 10.8 106.7;VU Pacific/Efate -17.7 168.4;WF Pacific/Wallis -13.3 -176.2;WS Pacific/Apia -13.8 -171.7;XK Europe/Belgrade 42.7 21.2;YE Asia/Aden 12.8 45.2;YT Indian/Mayotte -12.8 45.2;ZA Africa/Johannesburg -26.2 28;ZM Africa/Lusaka -15.4 28.3;ZW Africa/Harare -17.8 31.1'.split(';').map(r => { const [c, z, a, b] = r.split(' '); return { c, z, lat: +a, lng: +b }; });
function tmZonesOf(country) { return country ? TM_ZONES.filter(x => x.c === String(country).toUpperCase() && tmZoneOk(x.z)) : []; }
function tmNearestZone(list, center) { if (!list.length) return null; if (!center) return list[0];
  const d = x => (x.lat - center[0]) ** 2 + ((x.lng - center[1]) * Math.cos(center[0] * Math.PI / 180)) ** 2; return list.slice().sort((a, b) => d(a) - d(b))[0]; }
const _tmNameFmt = new Map(); // 11.21.5: one formatter per zone (the zone picker lists ~400 zones on every redraw; a day's clock line asks again)
function tmZoneName(zone) { try { let f = _tmNameFmt.get(zone); if (!f) { f = new Intl.DateTimeFormat('he', { timeZone: zone, timeZoneName: 'longGeneric' }); _tmNameFmt.set(zone, f); }
  const p = f.formatToParts(tmNow()).find(x => x.type === 'timeZoneName'); return p ? p.value : zone; } catch (e) { return zone || ''; } }
function tmCity(zone) { return String(zone || '').split('/').pop().replace(/_/g, ' '); }
function tmDiffText(zone, at) { // "5 שעות אחרי ישראל" / "שעה לפני ישראל" / "כמו בישראל"
  const d = (tmOffset(zone, at) - tmOffset(TM_HOME, at)) / 60; if (!d) return 'כמו בישראל';
  const a = Math.abs(d), n = a === 1 ? 'שעה' : a === 2 ? 'שעתיים' : (a % 1 ? a.toFixed(1) : a) + '\u00A0שעות'; return `${n} ${d < 0 ? 'אחרי' : 'לפני'} ישראל`; }
// the zone of a destination: meta.timeZone is the one source (ז3); a destination without one falls back to the home clock (≈)
function destZone(D) { const m = D && D.meta; if (m && tmZoneOk(m.timeZone)) return m.timeZone;
  return TM_HOME; }
// the zone for a destination from its country and centre (ז11): one zone in the country; else the nearest to the centre (≈)
function tmGuessZone(meta, onDate) {
  const list = tmZonesOf(meta.country); if (list.length === 1) return { zone: list[0].z, sure: true };
  if (list.length > 1) return { zone: tmNearestZone(list, meta.center).z, sure: false };
  return null; }
// ---- ring 1: sunrise and sunset by the zone and the date (with summer/winter time) ----
function tmSun(iso, lat, lng, zone) {
  const rad = Math.PI / 180, deg = 180 / Math.PI, [Y, M0, D0] = iso.split('-').map(Number);
  let y = Y, m = M0; if (m <= 2) { y -= 1; m += 12; } const A = Math.floor(y / 100), B = 2 - A + Math.floor(A / 4);
  const JD = Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + D0 + B - 1524.5, n = JD - 2451545.0 + 0.0008, Js = n - lng / 360;
  const Ma = (357.5291 + 0.98560028 * Js) % 360, Mr = Ma * rad, C = 1.9148 * Math.sin(Mr) + 0.0200 * Math.sin(2 * Mr) + 0.0003 * Math.sin(3 * Mr);
  const lr = ((Ma + C + 180 + 102.9372) % 360) * rad, Jt = 2451545.5 + Js + 0.0053 * Math.sin(Mr) - 0.0069 * Math.sin(2 * lr);
  const dl = Math.asin(Math.sin(lr) * Math.sin(23.4397 * rad)), la = lat * rad, om = Math.acos((Math.sin(-0.83 * rad) - Math.sin(la) * Math.sin(dl)) / (Math.cos(la) * Math.cos(dl))) * deg;
  const hours = J => { const jd = J + 0.5; return (jd - Math.floor(jd)) * 24; }, off = tmOffset(zone, iso) / 60;
  const f = h => { const l = ((h + off) % 24 + 24) % 24, hh = Math.floor(l), mm = Math.round((l - hh) * 60); return tmHM(hh * 60 + mm); };
  return { sunrise: f(hours(Jt - om / 360)), sunset: f(hours(Jt + om / 360)) }; }
// ---- ring 1: formats by role (ז7, ז8, ז12). The size comes from the role, not the screen. ----
function isVirt(iso) { return typeof iso === 'string' && iso.slice(0, 4) === '2001'; }
function vDayNum(iso) { return daysBetween(VDATE, iso) + 1; }
function vDate(n) { return isoAdd(VDATE, n - 1); }
function _tmDM(iso) { const [, m, d] = iso.split('-').map(Number); return `${d}.${m}`; }
function _tmDMY(iso) { const [y, m, d] = iso.split('-').map(Number); return `${d}.${m}.${y}`; }
function _tmWdV(iso, t) { t = t || (typeof activeTripObj === 'function' ? activeTripObj() : null); return t && t.wd != null && t.wd !== '' ? TM_WD[(Number(t.wd) + vDayNum(iso) - 1) % 7] : ''; }
function tmBidi(s) { return '\u2066' + s + '\u2069'; } // one direction wrapper for ranges and times
// draw-no-write (item 6; decisions 2026-11-27 · Review of night chain steps 1-4 after 11.67.1, Q8): a range in a Hebrew line, one isolated unit -
// "3–5" reads left to right in Hebrew too; bare, the bidi algorithm draws an en dash between two numbers as "5–3" (t1254 fails on a bare one)
function tmSpan(a, b) { return b != null && b !== '' ? tmBidi(a + '–' + b) : String(a == null ? '' : a); }
function tmFmt(role, x, o) { o = o || {};
  if (x == null || x === '') return '';
  if (role === 'pick') { if (isVirt(x)) { const w = _tmWdV(x, o.trip); return 'יום ' + vDayNum(x) + (w ? SEP + w : ''); } return isIso(x) ? `${TM_WD[tmWeekday(x)]} ${_tmDMY(x)}` : ''; }
  if (role === 'day') { if (isVirt(x)) { const w = _tmWdV(x, o.trip); return 'יום ' + vDayNum(x) + (w ? SEP + w : ''); } return (o.est ? '≈ ' : '') + `${TM_WD[tmWeekday(x)]} ${_tmDM(x)}`; }
  if (role === 'dayN') return isVirt(x) ? 'יום ' + vDayNum(x) : _tmDM(x);
  if (role === 'wd') return isVirt(x) ? _tmWdV(x, o.trip) : TM_WD[tmWeekday(x)]; // a weekday alone
  if (role === 'date') { if (isIso(x)) return isVirt(x) ? 'יום ' + vDayNum(x) : _tmDMY(x); return _tmDMY(tmPhoneDate(x)); } // d.m.yyyy: files, log, backup, signatures, a date given as a fact
  if (role === 'month') return isIso(x) ? _tmDMY(x).replace(/^\d+\./, '') : ''; // m.yyyy
  if (role === 'year') return isIso(x) ? x.slice(0, 4) : '';
  if (role === 'stamp') return tmPhoneHM(x); // the time of a stamp (log, a file made at), on the phone's clock
  if (role === 'time') { if (isHM(x)) return x; return o.zone ? tmWall(o.zone, x).hm : tmPhoneHM(x); } // HH:MM, 24h
  if (role === 'noYear') return String(x).replace(/\.\d{4}$/, ''); // a date kept as text (a day that left the trip) without its year
  if (role === 'hour') return String(x).padStart(2, '0'); // an hour mark on a chart
  if (role === 'dur') { const m = Math.round(x); // a length of time - the one duration format (value-tie-source): "45 דק׳", "2:15 ש׳", the number tied to its unit
    if (o.words && m >= 60) return m === 60 ? 'שעה' : m === 120 ? 'שעתיים' : `${(m / 60).toFixed(1).replace(/\.0$/, '')}\u00A0שעות`; // o.words: a choice of a length ("שעה", "שעתיים", "1.5 שעות")
    return m < 60 ? `${m}\u00A0דק׳` : `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}\u00A0ש׳`; }
  if (role === 'rel') { // a day relative to today: היום / מחר / אתמול / בעוד N ימים / לפני N ימים
    const d = daysBetween(o.from || todayStr(), x); return d === 0 ? 'היום' : d === 1 ? 'מחר' : d === -1 ? 'אתמול' : d > 1 ? `בעוד ${d} ימים` : `לפני ${-d} ימים`; }
  if (role === 'until') { const m = Math.round(x / 6e4), h = Math.floor(m / 60); if (m < 60 || (h < 6 && m % 60)) return `בעוד ${tmFmt('dur', m)}`; if (h < 36) return `בעוד ${h}\u00A0ש׳`; return `בעוד ${Math.round(h / 24)}\u00A0ימים`; } // value-tie-source: its minutes in the one duration format
  if (role === 'range') { const [a, b] = x; if (!a) return ''; // o.year: a trip's range (with the year); inside a trip: no year, even across a year
    if (isVirt(a)) return !b ? 'יום ' + vDayNum(a) : tmBidi(`ימים ${vDayNum(a)}–${vDayNum(b)}`);
    const f = o.year ? _tmDMY : _tmDM; return tmBidi(b ? `${f(a)}–${f(b)}` : f(a)); }
  return String(x); }
// ---- value formats (value-tie-source; spec/number-and-distance-formats.md): one formatter per kind of value beside the durations
// above (tmFmt 'dur'), each number tied to its unit with a no-break space, so a value never wraps between them ----
// a distance in km: meters under 1 km (by 10, at least 10), one decimal under 10 km (".0" dropped), whole km above with the thousands separator
function fmtKm(km, o) { km = Math.max(0, Number(km) || 0); const m = Math.max(10, Math.round(km * 100) * 10); if (m < 1000 && !(o && o.num)) return `${m}\u00A0מ׳`;
  const n = km < 10 ? km.toFixed(1).replace(/\.0$/, '') : Math.round(km).toLocaleString('he-IL'); return o && o.num ? n : `${n}\u00A0ק״מ`; } // o.num: the km number alone (a tile whose unit is its label)
function fmtM(m) { return `${Math.round(Number(m) || 0).toLocaleString('he-IL')}\u00A0מ׳`; } // a height or a short length in meters, as given
// a price (booking-price, 11.42.0; spec/booking-and-price.md): "חינם", "$$ · בינוני" (the level in dollar signs with its word, in every
// destination), "25 € לאדם · נכון ל-11.2026" (the amount tied to its currency, its parts joined with SEP); o.hotel: a hotel's price
// (no date), o.note: the note last, o.date === false: no "נכון ל-". Either form of the field (bpPrice reads old text too); '' for unknown.
function fmtPrice(v, o) { o = o || {}; const p = bpPrice(v, o.hotel), parts = [];
  if (p.kind === 'free') parts.push('חינם');
  else if (p.kind === 'level') parts.push(tmBidi('$'.repeat(p.level)), PRICE_LEVEL[p.level]);
  else if (p.kind === 'amount') { parts.push(fmtMoney(p.amount, p.currency) + (p.per ? ' ' + (o.hotel ? HOTEL_PER_TX : PRICE_PER)[p.per] : ''));
    if (!o.hotel && o.date !== false && p.checkedAt) parts.push('נכון ל-' + p.checkedAt); }
  if (o.note && p.note) parts.push(p.note);
  return parts.join(SEP); }
function fmtMoney(n, cur) { const s = (Number(n) || 0).toLocaleString('he-IL', { maximumFractionDigits: 2 }); return tmBidi(cur ? `${s}\u00A0${bpCurSym(cur)}` : s); } // the amount and its sign, one unit
// a hotel's other figure, from its nights: per night → "סה״כ 900 € ל-3 לילות"; for the whole stay → "≈ 300 € ללילה" (nothing under 2 nights)
function fmtHotelDerived(v, nights) { const p = bpPrice(v, true); if (p.kind !== 'amount' || !(nights > 1)) return '';
  return p.per === 'stay' ? `≈\u00A0${fmtMoney(p.amount / nights, p.currency)} ללילה` : `סה״כ ${fmtMoney(p.amount * nights, p.currency)} ל-${nights}\u00A0לילות`; }
// ---- ring 2: the trip's calendar ----
function dayList(start, end) { const out = []; if (!start) return out; const n = Math.min(60, daysBetween(start, end || start) + 1);
  for (let i = 1; i <= n; i++) { const iso = isoAdd(start, i - 1); out.push({ key: 'd' + i, date: iso, label: tmFmt('dayN', iso) }); } return out; }
function tripDayList(t) { if (!t) return []; if (t.start) return dayList(t.start, t.end); return t.days ? dayList(VDATE, vDate(Math.min(t.days, 60))) : []; }
function dayZone(iso) { const t = activeTripObj(), d = TRIP_DAYS.find(x => x.date === iso), ds = d ? destsOfDay(d.key) : []; return ds.length ? destZone(DESTS[ds[ds.length - 1]]) : (t && t.start ? tmZoneAt(t, tmMoment(iso, '12:00', TM_HOME)) : TM_HOME); } // the clock of a plan's day (its destination)
function tmClockLine(D) { return `${tmWall(destZone(D)).hm} ב${D.meta.name}${SEP}${tmWall(TM_HOME).hm} בישראל`; } // ℹ️ the live clock
function tmRouteWhen(date, hm) { // the plan's day and hour for a route lookup; a date far away (or past) -> the same weekday in the coming week
  const t = hm || '09:00', today = todayStr(); let d = date || today; const n = daysBetween(today, d);
  if (n < 0 || n > 20) { const wd = tmWeekday(d); d = isoAdd(today, 1); while (tmWeekday(d) !== wd) d = isoAdd(d, 1); } return d + ' ' + t; }
function tmMeasWhen() { return todayStr() + ' ' + tmNowHM(activeTripObj()); }
function dayLabelOf(key) { const d = typeof dayByKey === 'function' ? dayByKey(key) : null; return d ? tmFmt('day', d.date) : key; } // a day in a message (ז8)
function travelLandDate(f) { return f && f.date ? isoAdd(f.date, Number(f.arriveDay) || 0) : ''; }
function _tmDest(t, id) { if (DESTS[id]) return DESTS[id]; const sn = t && t.archived && t.archived.snap && t.archived.snap.dests && t.archived.snap.dests[id]; return sn ? { id, meta: sn } : null; } // an archived trip keeps its destinations' snapshot
function _tmSegs(t) { return (t.segments || []).filter(s => s.from).slice().sort((a, b) => a.from < b.from ? -1 : a.from > b.from ? 1 : 0); }
// the legs that bring you into each destination (ג1): the travels of the segment's first day, chained while the next leg
// leaves on the landing date of the one before. Every leg leaves on the clock the chain left from (the previous
// destination, or home); only the last one lands on the destination's clock; a middle leg lands where we don't know.
function tmChains(t) { const segs = _tmSegs(t), tr = travelsOf(t).filter(f => f.date).map((f, i) => [f, i]).sort((a, b) => a[0].date < b[0].date ? -1 : a[0].date > b[0].date ? 1 : (a[0].depart && b[0].depart ? String(a[0].depart).localeCompare(b[0].depart) : 0) || a[1] - b[1]).map(x => x[0]); // same day: by take-off when both have one, else as listed
  const out = []; segs.forEach((s, i) => { const prev = i ? segs[i - 1] : null; if (prev && prev.dest === s.dest) return;
    const legs = []; let day = s.from; for (const f of tr) { if (f.date === day && !legs.includes(f)) { legs.push(f); day = travelLandDate(f); } }
    out.push({ seg: s, legs, from: prev ? destZone(_tmDest(t, prev.dest)) : TM_HOME, to: destZone(_tmDest(t, s.dest)) }); }); return out; }
function _tmChainsCached(t) { const k = JSON.stringify([t.segments, travelsOf(t), (t.segments || []).map(s => { const d = _tmDest(t, s.dest); return d && d.meta.timeZone; })]);
  if (t.__tmK !== k) { try { Object.defineProperty(t, '__tmC', { value: tmChains(t), writable: true, configurable: true }); Object.defineProperty(t, '__tmK', { value: k, writable: true, configurable: true }); } catch (e) { return tmChains(t); } }
  return t.__tmC; }
// the moments the clock changes: home until the first landing, then each destination from the landing of its chain
// (a chain with no landing time - from the start of its first day, ז4)
function tmSwitches(t) { return _tmChainsCached(t).map(c => { const L = c.legs[c.legs.length - 1];
  return { ms: L && L.arrive ? tmMoment(travelLandDate(L), L.arrive, c.to) : tmMoment(c.seg.from, '00:00', c.to), zone: c.to, from: c.from, dest: c.seg.dest, leg: L || null, day: L && L.arrive ? travelLandDate(L) : c.seg.from }; }); }
function tmZoneAt(t, at) { const ms = tmMs(at); let z = TM_HOME; if (!t || !t.start) return null; tmSwitches(t).forEach(s => { if (s.ms <= ms) z = s.zone; }); return z; }
// "today" and "now" (ז2): inside the trip's window - the clock of where the plan says you are; outside it, and in a trip
// without dates - the phone's clock
function tmTodayOf(t, at) { const ms = tmMs(at), ph = tmPhoneDate(ms); if (!t || !t.start || !t.end) return ph;
  const w = tmWall(tmZoneAt(t, ms), ms).date; return w >= t.start && w <= t.end ? w : ph; }
function todayStr() { let t = null; try { t = activeTripObj(); } catch (e) {} return tmTodayOf(t && t.id ? t : null); }
function tmNowHM(t, at) { const ms = tmMs(at); if (!t || !t.start) return tmPhoneHM(ms); const z = tmZoneAt(t, ms), w = tmWall(z, ms); return w.date >= t.start && w.date <= t.end ? w.hm : tmPhoneHM(ms); }
function tripState(t) { if (!t) return 'none'; if (t.archived) return 'archived'; if (!t.start || !t.end) return 'before';
  const iso = tmTodayOf(t); return iso < t.start ? 'before' : iso > t.end ? 'ended' : 'during'; }
// the zones of a travel: a leg of a chain leaves on the chain's clock; a travel inside a destination on that destination's;
// it lands on the destination's clock (last leg), an unknown one (a middle leg - null), or home after the trip
function travelZones(t, f) { for (const c of _tmChainsCached(t)) { const i = c.legs.findIndex(x => x === f || (f && f.id != null && x.id === f.id)); if (i >= 0) return { dep: c.from, arr: i === c.legs.length - 1 ? c.to : null, chain: c }; }
  const segs = _tmSegs(t), at = d => { let z = null; segs.forEach(s => { if (s.from <= d && (!s.to || d <= s.to)) z = destZone(_tmDest(t, s.dest)); }); return z; };
  const ld = travelLandDate(f); return { dep: at(f.date) || TM_HOME, arr: ld > (t.end || ld) ? TM_HOME : (at(ld) || TM_HOME), chain: null }; }
function travelStartsAt(f, t) { if (!f || !f.date) return null; t = t || activeTripObj(); return tmMoment(f.date, f.depart || '00:00', travelZones(t, f).dep); }
// the landing day relative to the take-off day (ז5) from the hours on the card and both clocks: the one day that gives a
// reasonable flight time (over 0 and up to 20 hours); with an unknown landing clock (a middle leg) - only when every
// plausible clock (within 3 hours of the take-off clock - a connection is usually near) agrees (ג1). { v, sure }
// the clocks of a plan's day (ז9, ז10): the clock the day starts on, and the landing that changes it that day (a timed one);
// the line is drawn only when the clocks really differ that day
function tmZoneLabel(t, zone) { if (zone === TM_HOME) return '🇮🇱 שעון ישראל';
  const s = _tmSegs(t).find(x => destZone(_tmDest(t, x.dest)) === zone), D = s && _tmDest(t, s.dest);
  return D ? withFlag(destFlagMeta(D.meta), 'שעון ' + String(D.meta.name || '').replace(/\s*\(.*\)$/, '')) : 'שעון ' + tmZoneName(zone); }
function tmDayClock(t, iso) { if (!t || !t.start || !isIso(iso) || isVirt(iso)) return null; const sws = tmSwitches(t);
  let start = TM_HOME; sws.forEach(x => { if (x.day < iso || (x.day === iso && !x.leg)) start = x.zone; });
  const dz = _tmDayZoneOf(t, iso), noon = tmMoment(iso, '12:00', dz), sw = sws.find(x => x.day === iso && x.leg && tmOffset(start, x.ms) !== tmOffset(x.zone, x.ms));
  const differs = !!sw || tmOffset(start, noon) !== tmOffset(dz, noon); if (!differs) return null;
  return { start, startLabel: tmZoneLabel(t, start), sw: sw ? { ms: sw.ms, hm: sw.leg.arrive, leg: sw.leg, zone: sw.zone, label: tmZoneLabel(t, sw.zone) + SEP + 'מהנחיתה' } : null }; }
function tmLandingsOn(t, iso) { return travelsOf(t).filter(f => (Number(f.arriveDay) || 0) && isHM(f.arrive) && travelLandDate(f) === iso); } // a travel that lands on another day shows on that day too
function _tmDayZoneOf(t, iso) { let z = null; _tmSegs(t).forEach(s => { if (s.from <= iso && (!s.to || iso <= s.to)) z = destZone(_tmDest(t, s.dest)); }); return z || TM_HOME; }
// ================= END TIME =================


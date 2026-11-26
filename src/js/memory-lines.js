// ================= THE TRIPS SCREEN'S MEMORY LINES (split from memory-screen.js in diet-groups, 11.62.0; the book, the countries' screen and the memory screen's parts stay there, in the memories group) =================
const PP = { page: 0, land: null, dir: 0, skip: false };
const PP_PER = 4, PP_SHAPES = 4, PP_INK_CLS = ['pp-ink0', 'pp-ink1', 'pp-ink2', 'pp-ink3'], PP_INKS = PP_INK_CLS.length; // the four inks' classes, named in full (t770 reads every class)
const ppClosedHere = t => !!(t && t.archived && t.archived.reason === 'ended' && !t.archived.recv);
function ppHash(s) { let h = 2166136261; for (const ch of String(s)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
// a destination's character (Q2): derived from its name - the same name, the same stamp; two names almost never alike
function ppChar(name) { const h = ppHash(String(name || '').trim().toLowerCase()); return { s: h % PP_SHAPES, c: (h >>> 3) % PP_INKS, r: ((h >>> 6) % 15) - 7, n: (h >>> 11) % 97 }; }
function ppStamp(t, did, sm) { const d = DESTS[did], m = (d && !d.ghost ? d.meta : null) || sm || {}, rs = t.start ? segRanges(t).filter(r => r.dest === did) : [];
  const a = rs.length ? Math.min(...rs.map(r => r.a)) : 0, b = rs.length ? Math.max(...rs.map(r => r.b)) : 0;
  return { key: t.id + '|' + did, trip: t.id, tname: String(t.name).split(' · ')[0], did, name: m.name || String(did), flag: destFlagMeta(m),
    from: a ? isoAdd(t.start, a - 1) : '', to: b ? isoAdd(t.start, b - 1) : '', days: rs.reduce((n, r) => n + r.b - r.a + 1, 0) }; }
function ppModel() { const trips = Object.values(STATE.trips).filter(ppClosedHere)
    .sort((x, y) => String(x.start || x.end || '').localeCompare(String(y.start || y.end || '')) || (x.archived.at || 0) - (y.archived.at || 0));
  const stamps = [], pages = [];
  trips.forEach(t => { const snap = (t.archived.snap || {}).dests || {}, ds = [];
    (t.segments || []).forEach(g => { if (g && g.dest && !ds.includes(g.dest) && (DESTS[g.dest] || snap[g.dest])) ds.push(g.dest); });
    const mine = ds.map(did => ppStamp(t, did, snap[did]));
    for (let i = 0; i < mine.length; i += PP_PER) pages.push({ trip: t.id, tname: String(t.name).split(' · ')[0], stamps: mine.slice(i, i + PP_PER), more: i > 0 });
    stamps.push(...mine); });
  return { trips, stamps, pages, n: stamps.length }; }
const ppStore = () => DEV.stamps || {};
const ppCharOf = s => ppStore()[s.key] || ppChar(s.name);
const ppCount = n => n === 1 ? 'חותמת אחת' : `<bdi>${n}</bdi> חותמות`;
// the line (Q3): the trips screen's "זיכרונות" header and the top of "כל הזיכרונות"; "עוד ריק" before the first stamp
function ppLineHTML(go, top) { const n = ppModel().n; // go: the row's trailing arrow, drawn by the trips screen's part (.ent-go)
  return `<button type="button" class="pp-line t-wrap${top ? ' pp-top' : ''}" data-act="pp.open">${msi('menu_book', { size: 20 })}<span>הדרכון שלי${SEP}${n ? ppCount(n) : 'עוד ריק'}</span>${go}</button>`; }
const cvTrips = () => Object.values(STATE.trips).filter(t => t.archived && t.archived.reason !== 'cancelled');
const cvMine = () => STATE.countries || {};
const cvHasAny = () => cvTrips().length > 0 || Object.keys(cvMine()).length > 0;
// diet-groups: "מדינות שביקרנו" needs the world's borders (read once, after the first screen) and the countries' count - both in the
// memories group; until the group is in, the line shows its name (as it did before the borders were read) and the group comes quietly
function cvLineG(all) { if (groupHas('memories')) return groupFn('memories', 'cvLineHTML')(all);
  if (!cvLineG.t) cvLineG.t = setTimeout(() => needGroup('memories').then(ok => { if (ok && document.querySelector('.cv-line')) redrawSoon(); }), 900);
  return `<button type="button" class="cv-line t-wrap${all ? ' cv-top' : ''}" data-act="cv.open">${msi('language', { size: 20 })}<span>מדינות שביקרנו</span>${entGo()}</button>`; }

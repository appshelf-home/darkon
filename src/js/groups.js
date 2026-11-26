// ================= PARTS LOADED ON DEMAND (diet-mechanism; decisions 2026-11-23 · A diet for the main script, Q2-Q8) =================
// What one of the five main screens shows, and what an ordinary tap on them opens, is in the main script; everything else is in a group
// (order.json "groups": ai, memories, special-maps, management - each part says its "side"). On the site every group is its own file,
// named with its content's hash (g-<group>.<hash>.js), saved by the service worker with the page at install and update (Q5), and loaded
// here when it is first entered: needGroup(name) -> a promise of true (in) / false (not on the phone and no network). A group already in -
// the page inside Claude and the tests' copies, where the build leaves every group inside the page (Q6), or a group loaded before -
// resolves at once: one code path in both places. The main script never names a group's function (the split guards fail on it,
// shared/split group_refs): it reaches a group through an action the group registers (its stand-in, below, waits for the group), a screen
// or a function named as a string (viaGroup), or needGroup itself. What the user sees (Q7): up to GROUP_QUIET_MS nothing; longer - the one
// "in progress" bar (waitOn) at the top of the screen; a failure - the snackbar "החלק הזה עוד לא ירד לטלפון - צריך רשת פעם אחת" with
// "נסה שוב", and the same entry is tried again when the network returns.
const GROUP_FILES = {}; // written by build.py for the site ({ group: { f: its file, sri: its hash } } - loaded with Subresource Integrity, like every library); empty in the source and the single page - every group is in the page
const GROUP_ACTS = {}; // written by build.py for the site ({ action: its group }) - the actions a moved group registers
const GROUP_QUIET_MS = 300; // Q7: a load this short shows nothing
const GROUP_FAIL = 'החלק הזה עוד לא ירד לטלפון - צריך רשת פעם אחת';
const GROUP_IN = new Set(), // the groups in: the last line of every group's file adds its own (build.py) - its parts ran to their end
  GROUP_RUN = {}, GROUP_LATER = {};
// diet-groups: what runs when a group comes in (the read-only guard wraps the group's functions - trip-states.js)
const GROUP_ON_IN = [];
function groupOnIn(fn) { GROUP_ON_IN.push(fn); }
function groupHas(g) { return !GROUP_FILES[g] || GROUP_IN.has(g); }
function needGroup(g) {
  if (groupHas(g)) return Promise.resolve(true);
  return GROUP_RUN[g] || (GROUP_RUN[g] = new Promise(res => {
    const came = () => { const ok = GROUP_IN.has(g); if (!ok) delete GROUP_RUN[g]; else GROUP_ON_IN.forEach(f => { try { f(g); } catch (e) { errNote('groups', e); } }); res(ok); }; // a failure is asked again next time
    svcLibrary(GROUP_FILES[g].f, null, came, { js: GROUP_FILES[g].sri }); })); // the services' one library path, with the file's integrity hash (a stale or broken file fails too)
}
// an entry into a group: then() at once when the group is in; otherwise the wait, the load, then(), or the failure's snackbar
function groupWait(g, then, quiet) {
  if (groupHas(g)) { then(); return; }
  const main = document.getElementById('main'); let w = null;
  const t = quiet ? 0 : setTimeout(() => { w = waitOn(main, { stage: 'פותחים' }); }, GROUP_QUIET_MS);
  needGroup(g).then(ok => { clearTimeout(t); if (w) w.done();
    if (ok) { delete GROUP_LATER[g]; then(); return; }
    GROUP_LATER[g] = then; groupLaterSoon();
    if (!quiet) showToast(GROUP_FAIL, { act: 'group.again', v: g, label: 'נסה שוב', ms: 8000 }); });
}
// Q7: a failed entry is tried again when the network returns - on 'online', and (the phone's event is not reliable: G118, 11.57.0) every
// GROUP_AGAIN_MS while the phone says it is online, quietly (no second message); it stops when nothing waits
const GROUP_AGAIN_MS = 10000;
function groupLaterRun() { Object.keys(GROUP_LATER).forEach(g => { const then = GROUP_LATER[g]; delete GROUP_LATER[g]; groupWait(g, then, true); }); }
function groupLaterSoon() { clearTimeout(groupLaterSoon.t); groupLaterSoon.t = setTimeout(() => { if (!Object.keys(GROUP_LATER).length) return; if (svcOnline()) groupLaterRun(); else groupLaterSoon(); }, GROUP_AGAIN_MS); }
// a function of a group named as a string (a top-level function of a classic script is a property of the global object - globalThis, which
// a page cannot replace as it can `self`): its result at once when the group is in, else it runs once the group came (and returns nothing)
function viaGroup(g, fn, ...args) {
  if (groupHas(g)) return globalThis[fn](...args);
  groupWait(g, () => globalThis[fn](...args));
}
// diet-groups: a function of a group that is in, by its name - after needGroup / groupWait resolved (a group not in is a fault: it throws,
// so the error names it instead of a silent nothing)
function groupFn(g, fn) { if (!groupHas(g)) throw new Error('group not in: ' + g + ' (' + fn + ')'); return globalThis[fn]; }
// a screen of a group (render): drawn at once when the group is in, else the screen is drawn again once it came
function groupScreen(g, fn) {
  if (groupHas(g)) { globalThis[fn](); return; }
  groupWait(g, () => render());
}
// an action of a moved group: a stand-in until the group is in - it waits for the group, then the group's own action (which replaced it) runs
Object.entries(GROUP_ACTS).forEach(([name, g]) => { const f = c => { groupWait(g, () => runAct(c.el, c.ev, name)); return 'quiet'; }; f.groupStub = g; act(name, f); });
act('group.again', c => { const then = GROUP_LATER[c.v]; if (then) groupWait(c.v, then); return 'quiet'; });
svcOnBack(groupLaterRun); // Q7: tried again when the network returns

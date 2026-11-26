// ================= THE GUIDE'S CHAPTER PER SCREEN (diet-groups, 11.62.0): the one table of which screens (tabs) each chapter covers - a screen's
// intro bubble links its chapter ("עוד במדריך ›", intros.js) with no need of the guide's text (content/guide.js, the management group, reads it)
const GUIDE_SCREENS = {
  'start': [],
  'check': [],
  'points': ['all'],
  'map': ['map'],
  'plan': ['itinerary', 'proposal'],
  'info': ['info'],
  'trips': ['trips', 'memories'],
  'draft': ['draft'],
  'closing': ['closing', 'passport'],
  'memory': ['memory', 'countries'],
  'layers': ['layers'],
  'hidden': ['hidden', 'trash'],
  'sync': ['sync'],
  'claude': ['claude'],
  'settings': ['settings'],
  'menu': ['log', 'guide', 'whatsnew']
};
// the chapter of a screen, or nothing
function guideChapterOf(tab) { return Object.keys(GUIDE_SCREENS).find(id => GUIDE_SCREENS[id].includes(tab)) || null; }

// ================= 11.21.4 (backup-ids): ids and keys of the file form - the one conversion (files.js's door, the once pass, ids made from names) =================
// decisions 2026-11-17 · A backup that does not restore: ids the app made itself (Q1-Q3); spec/incoming-markup-and-sinks.md "Ids".
const ID_TOK = /^[A-Za-z0-9_.@-]*$/; // one part of an id or a key (between ":" and "|")
// 11.21.4 (Q1-Q3): one conversion for an id or a key that is not of the form - at the file door, over stored data once (fileCleanStored)
// and for every id or key the app makes from a name (born valid: idFix). It works on the parts of a composite ("pimg:<trip>:c:<name>",
// "d1|<item>", "@<dest>:12" - split at ":" and "|"): a part of the form stays; another becomes its Latin letters and digits joined by "-"
// (at most 40; "id" when none) + "-" + a hash of the part (FNV-1a over its code points, 7 base-36 digits) - the same part gives the same
// result on every device, in every file, as an id, a reference, a key or inside a composite. A part that starts with "@" keeps it (a
// "@dest:12" reference names the destination's own id). claude/scripts/validate.py converts the same way (a cross test, t1090).
function idHash(s) { let h = 0x811c9dc5; for (const ch of String(s)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; } return h.toString(36).padStart(7, '0'); }
function idTokConv(t, taken) { if (ID_TOK.test(t)) return t; if (t[0] === '@') return '@' + idTokConv(t.slice(1), taken);
  const base = ((t.match(/[A-Za-z0-9]+/g) || []).join('-').slice(0, 40).replace(/-+$/, '') || 'id') + '-';
  let r = base + idHash(t); for (let i = 2; taken && taken.has(r); i++) r = base + idHash(t + '#' + i); return r; } // free of the file's and the phone's own ids
function idFix(s, taken, max) { s = String(s); const re = max === 'key' ? FILE_KEY : FILE_ID; if (re.test(s)) return s;
  const r = s.split(/([:|])/).map((t, i) => i % 2 ? t : idTokConv(t, taken)).join(''); return re.test(r) ? r : idTokConv(r.replace(/[:|]/g, '-'), taken); }
// diet-room: the door's conversion of a whole file (fileIdsFix), the stored data's once pass and its light reading are js/file-door.js

#!/usr/bin/env python3
"""A split source: an app's readable source kept as parts, joined by the build into the one page it always was.

The parts are listed in SRC/order.json, in build order (the format: README.md beside this file). The page (page.html) is the
head and the markup skeleton; it holds one marker line per slot (e.g. `/* @slot style */` inside <style>, `// @slot script`
inside the main <script>), and the join puts the slot's parts there, one after another, as they are - one shared scope, no
modules, nothing added between them. So the joined page is exactly the single file the app had before it was split.

  python3 split.py join SRC OUT [--plain]   join into OUT (+ OUT.map.json, the line map); OUT starts with a "do not edit" line
                                            unless --plain (the build joins plain, in memory, through join())
  python3 split.py check SRC                the split guards: every part listed and every entry present, the slot markers,
                                            no hand edit in generated/, a part above the size light carries "whole", no top-level
                                            name declared in two script parts; it warns (no failure) on a part above NEAR
  python3 split.py roundtrip SRC            join, then split the joined text back by the line map: every part comes back the same
  python3 split.py where MAP LINE...        a line of the joined page -> part:line (MAP = OUT.map.json, or OUT itself)
  python3 split.py where MAP < log          as a filter: every "index.html:LINE" (and "line LINE" after the page's name) in the
                                            text gets " [part:line]" after it, so a failing test names the part and its line
  python3 split.py record SRC PATH...       a generator records the files it wrote under generated/ (their hashes), so check
                                            can tell its writing from a hand edit
Library: join(src) -> (text, linemap); where(linemap, n) -> (part, line); check(src) -> [errors]; warnings(src) -> [warnings];
         top_names(text) -> [(name, line, kind)]; record(src, path).
"""
import fnmatch, hashlib, json, os, re, sys

MARKER = re.compile(r'^[ \t]*(?:/\*|//|<!--)[ \t]*@slot[ \t]+([\w-]+)[ \t]*(?:\*/|-->)?[ \t]*$')
LIGHT = 60 * 1024          # a part above this is checked for a natural seam; with none it stays whole and says why ("whole")
NEAR = 55 * 1024           # a part above this gets a warning (no failure): plan its seam before the light fails mid-task
HASHES = 'hashes.json'     # inside the generated folder: what each generator wrote (sha256), written only through record()


def load_order(src):
    with open(os.path.join(src, 'order.json'), encoding='utf-8') as f:
        return json.load(f)


def _read(src, rel):
    with open(os.path.join(src, rel), encoding='utf-8', newline='') as f:
        return f.read()


def header_line(src, page_path):
    name = os.path.basename(os.path.abspath(os.path.join(src, '..'))) + '/' + os.path.basename(os.path.abspath(src))
    text = f'JOINED SOURCE - DO NOT EDIT. Built from {name}/order.json by shared/split; edit the parts there and join again.'
    return (f'<!-- {text} -->' if page_path.endswith('.html') else f'// {text}') + '\n'


def join(src, header=False):
    """the joined text and its line map: segments [joined_first_line, count, part, part_first_line] (lines from 1)"""
    order = load_order(src); page_path = order['page']['path']; page = _read(src, page_path)
    out, segs, n = [], [], 1
    if header:
        out.append(header_line(src, page_path)); segs.append([1, 1, '(join header)', 1]); n = 2

    def add(text, part, first):
        nonlocal n
        if not text: return
        lines = text.count('\n') + (0 if text.endswith('\n') else 1)
        out.append(text); segs.append([n, lines, part, first]); n += lines

    plines = page.splitlines(keepends=True); buf, buf_first = [], 1
    for i, line in enumerate(plines, 1):
        m = MARKER.match(line.rstrip('\r\n'))
        if not m:
            if not buf: buf_first = i
            buf.append(line); continue
        add(''.join(buf), page_path, buf_first); buf = []
        for e in order['slots'][m.group(1)]:
            add(_read(src, e['path']), e['path'], 1)
    add(''.join(buf), page_path, buf_first)
    return ''.join(out), {'src': os.path.abspath(src), 'segments': segs}


def strip_header(text):
    """the joined page without the work folder's "do not edit" line (the build reads either)"""
    first = text.split('\n', 1)[0]
    return text.split('\n', 1)[1] if 'JOINED SOURCE - DO NOT EDIT' in first else text


def where(linemap, n):
    for first, count, part, pfirst in linemap['segments']:
        if first <= n < first + count:
            return part, pfirst + n - first
    return None, None


def write_joined(src, out, header=True):
    text, lmap = join(src, header)
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    if os.path.lexists(out) and os.path.islink(out): os.remove(out)
    with open(out, 'w', encoding='utf-8', newline='') as f: f.write(text)
    with open(out + '.map.json', 'w', encoding='utf-8') as f: json.dump(lmap, f, ensure_ascii=False)
    return text, lmap


def _sha(text):
    return hashlib.sha256(text.encode('utf-8')).hexdigest()


def record(src, *paths):
    """called by a generator after it writes a file under generated/: its hash, so a later hand edit shows"""
    order = load_order(src); gdir = order.get('generated', 'generated'); hp = os.path.join(src, gdir, HASHES)
    hs = json.load(open(hp, encoding='utf-8')) if os.path.exists(hp) else {}
    for p in paths:
        rel = os.path.relpath(os.path.abspath(p), os.path.abspath(src)).replace(os.sep, '/')
        assert rel.startswith(gdir + '/'), f'{rel} is not under {gdir}/'
        hs[rel] = _sha(_read(src, rel))
    with open(hp, 'w', encoding='utf-8') as f: json.dump(dict(sorted(hs.items())), f, indent=1); f.write('\n')


PROP_DEF = re.compile(r'(--[A-Za-z0-9_-]+)\s*:')                             # a declaration, in a style part or an inline style
PROP_SET = re.compile(r"""setProperty\(\s*['"`](--[A-Za-z0-9_-]+)""")        # a property the script sets
PROP_USE = re.compile(r'var\(\s*(--[A-Za-z0-9_-]+)\s*\)')                   # a use with no fallback


def unknown_props(src, paths):
    """A CSS custom property that is used (var(--x), no fallback) but defined nowhere in the source: the browser drops the whole
    declaration quietly, so it fails here, at the join. The defined list is read from the source itself - every `--x:` declaration
    in the page and the parts, and every `setProperty('--x', ...)` of the script. A use with a fallback, `var(--x, value)`, and a
    name built at run time are not checked."""
    texts = {p: _read(src, p) for p in paths}
    defined = set()
    for t in texts.values(): defined |= set(PROP_DEF.findall(t)) | set(PROP_SET.findall(t))
    errs = []
    for p, t in texts.items():
        for m in PROP_USE.finditer(t):
            if m.group(1) not in defined:
                errs.append(f"{p}:{t.count(chr(10), 0, m.start()) + 1}: var({m.group(1)}) - a custom property that is defined nowhere in the source")
    return errs


KEYWORDS_BEFORE_REGEX = {'return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'throw', 'case', 'do', 'else', 'yield', 'await'}
DECL = {'function', 'var', 'let', 'const', 'class'}


def top_names(text):
    """The names a script part declares at its top level - `function NAME`, `async function NAME`, `class NAME`, and every name
    of a `var` / `let` / `const` statement (simple names; a destructuring pattern is skipped) - as [(name, line, kind)].
    A small lexer: strings, template literals (with nested ${...}), comments and regex literals are skipped, so a declaration
    inside a string (a page's host script in a template) is not one. Top level = outside every (), [] and {}."""
    out, i, n, line, depth = [], 0, len(text), 1, 0
    stack = []                    # template literal nesting: the brace depth at which each ${ opened
    prev = ''                     # the previous significant token (to tell a regex from a division)
    decl = None                   # the declaration being read at top level: [kind, expecting a name]
    while i < n:
        c = text[i]
        if c == '\n':
            if depth == 0 and decl and not decl[1] and (prev in ('str', 'num', ')', ']', '}') or prev[:1].isalnum() or prev[:1] in '_$'):
                decl = None       # the line ends the statement (no semicolon)
            line += 1; i += 1; continue
        if c in ' \t\r\f\v﻿': i += 1; continue
        if text.startswith('//', i):
            j = text.find('\n', i); i = n if j < 0 else j; continue
        if text.startswith('/*', i):
            j = text.find('*/', i + 2); j = n if j < 0 else j + 2; line += text.count('\n', i, j); i = j; continue
        if c in '\'"':
            j = i + 1
            while j < n and text[j] != c:
                if text[j] == '\\': j += 1
                elif text[j] == '\n': break
                j += 1
            i = j + 1; prev = 'str'; continue
        if c == '`' or (c == '}' and stack and stack[-1] == depth):
            if c == '}': stack.pop()
            j = i + 1
            while j < n:
                if text[j] == '\\': j += 2; continue
                if text[j] == '`': j += 1; break
                if text.startswith('${', j): stack.append(depth); j += 2; break
                if text[j] == '\n': line += 1
                j += 1
            else: j = n
            i = j; prev = 'str' if text[j - 1] == '`' else '('; continue
        if c == '/' and (prev == '' or prev in KEYWORDS_BEFORE_REGEX or (len(prev) == 1 and prev in '(,=:[!&|?{};+-*%<>~^')):
            j, cls = i + 1, False
            while j < n and text[j] != '\n':
                if text[j] == '\\': j += 2; continue
                if text[j] == '[': cls = True
                elif text[j] == ']': cls = False
                elif text[j] == '/' and not cls: break
                j += 1
            j += 1
            while j < n and (text[j].isalnum() or text[j] in '_$'): j += 1
            i = j; prev = 'str'; continue
        if c.isalpha() or c in '_$' or ord(c) > 127:
            j = i
            while j < n and (text[j].isalnum() or text[j] in '_$' or ord(text[j]) > 127): j += 1
            w = text[i:j]
            if depth == 0 and prev != '.':
                if decl and decl[1]:
                    if w != 'async' or decl[0] != 'function':
                        out.append((w, line, decl[0])); decl[1] = False
                        if decl[0] in ('function', 'class'): decl = None
                elif w in DECL and (w != 'function' or prev in ('', ';', '}', 'async', ')')):
                    decl = [w, True]
            i = j; prev = w; continue
        if c.isdigit():
            j = i
            while j < n and (text[j].isalnum() or text[j] in '._'): j += 1
            i = j; prev = 'num'; continue
        if c in '([{': depth += 1
        elif c in ')]}': depth -= 1
        if depth == 0 and decl:
            if c == ',' and decl[0] in ('var', 'let', 'const'): decl[1] = True
            elif c == ';': decl = None
        elif depth == 1 and c in '([{' and decl and decl[1]: decl[1] = False   # a destructuring pattern - not a simple name
        prev = c; i += 1
    return out


def same_names(src, order, paths):
    """A name declared at the top level of two script parts (or twice in one): one shared scope, so a second `function` silently
    replaces the first and a second `var` silently shares it; a second `let` / `const` / `class` would stop the page. A known case
    stays only with its reason in order.json "sameName" ({name: why}) - a list that only shrinks: a listed name that is no longer
    declared twice fails until it is taken off."""
    seen, errs = {}, []
    for p in paths:
        if not p.endswith('.js'): continue
        for name, ln, kind in top_names(_read(src, p)):
            seen.setdefault(name, []).append((p, ln, kind))
    known = order.get('sameName', {}) or {}
    for name, where_ in sorted(seen.items()):
        if len(where_) < 2: continue
        if name in known and str(known[name]).strip(): continue
        errs.append(f"{name}: declared at the top level more than once - " + ', '.join(f'{p}:{ln} ({k})' for p, ln, k in where_)
                    + ' - rename one, or list it in order.json "sameName" with the reason')
    for name in sorted(known):
        if len(seen.get(name, [])) < 2: errs.append(f'order.json "sameName": {name} is no longer declared twice - take it off the list (it only shrinks)')
        elif not str(known[name]).strip(): errs.append(f'order.json "sameName": {name} needs its reason')
    return errs


def warnings(src):
    """Parts near the light (above NEAR, generated parts and parts marked "whole" exempt): no failure, a warning to plan the seam."""
    try: order = load_order(src)
    except Exception: return []
    gdir = order.get('generated', 'generated'); out = []
    for e in [e for es in order.get('slots', {}).values() for e in es]:
        p = e.get('path', '')
        if p.startswith(gdir + '/') or str(e.get('whole', '')).strip() or not os.path.isfile(os.path.join(src, p)): continue
        size = len(_read(src, p).encode('utf-8'))
        if NEAR < size <= LIGHT:
            out.append(f'{p}: {size:,} bytes, above the {NEAR // 1024} KB warning - {LIGHT - size:,} bytes left to the {LIGHT // 1024} KB light; plan its natural seam')
    return out


def check(src):
    errs = []
    try: order = load_order(src)
    except Exception as e: return [f'order.json: {e}']
    page_path = order.get('page', {}).get('path')
    if not page_path or not os.path.exists(os.path.join(src, page_path)): return [f'the page {page_path} is missing']
    gdir = order.get('generated', 'generated')
    entries = [e for es in order.get('slots', {}).values() for e in es]
    paths = [e.get('path') for e in entries]
    for p in sorted({p for p in paths if paths.count(p) > 1}): errs.append(f'{p}: listed twice in order.json')
    # the slot markers: one per slot in the page, none anywhere else
    found = [MARKER.match(l.rstrip('\r')).group(1) for l in _read(src, page_path).split('\n') if MARKER.match(l.rstrip('\r'))]
    for s in order.get('slots', {}):
        if found.count(s) != 1: errs.append(f'{page_path}: the marker of slot "{s}" appears {found.count(s)} times (must be once)')
    for s in sorted(set(found) - set(order.get('slots', {}))): errs.append(f'{page_path}: a marker of slot "{s}" that order.json does not have')
    # every entry: present, described, ends with a line break, no marker inside, the size light
    for e in entries:
        p = e.get('path', '?')
        if not os.path.isfile(os.path.join(src, p)): errs.append(f'{p}: listed in order.json but missing (a part with no file)'); continue
        t = _read(src, p)
        if not str(e.get('about', '')).strip() or '\n' in e.get('about', ''): errs.append(f'{p}: needs a one-line "about" in order.json')
        if not t: errs.append(f'{p}: empty')
        elif not t.endswith('\n'): errs.append(f'{p}: must end with a line break (parts are joined as they are)')
        if any(MARKER.match(l.rstrip('\r')) for l in t.split('\n')): errs.append(f'{p}: holds a slot marker (only the page does)')
        if len(t.encode('utf-8')) > LIGHT and not p.startswith(gdir + '/') and not str(e.get('whole', '')).strip():
            errs.append(f'{p}: {len(t.encode()):,} bytes, above the ~{LIGHT // 1024} KB light - split it at a natural seam, or mark it "whole" with the reason')
    errs += unknown_props(src, [page_path] + [p for p in paths if p and os.path.isfile(os.path.join(src, p))])
    errs += same_names(src, order, [e.get('path') for e in order.get('slots', {}).get('script', []) if e.get('path') and os.path.isfile(os.path.join(src, e['path']))])
    # orphans: every file is the page, a part, order.json, the generated hashes, or outside the join on purpose ("outside")
    known = set(paths) | {page_path, 'order.json', f'{gdir}/{HASHES}'}
    for root, dirs, names in os.walk(src):
        dirs[:] = [d for d in dirs if not d.startswith('.') and d != '__pycache__']
        for nm in names:
            rel = os.path.relpath(os.path.join(root, nm), src).replace(os.sep, '/')
            if rel in known or nm.startswith('.') or any(fnmatch.fnmatch(rel, g) for g in order.get('outside', [])): continue
            errs.append(f'{rel}: a file in the source that order.json does not list (an unlisted part)')
    # generated: written only by its tool (recorded hash); a hand edit, or a file no tool recorded, fails
    hp = os.path.join(src, gdir, HASHES)
    hs = json.load(open(hp, encoding='utf-8')) if os.path.exists(hp) else {}
    for p in [p for p in paths if p.startswith(gdir + '/')]:
        if p not in hs: errs.append(f'{p}: in {gdir}/ but no tool recorded writing it')
        elif os.path.isfile(os.path.join(src, p)) and _sha(_read(src, p)) != hs[p]:
            errs.append(f'{p}: edited by hand - {gdir}/ is written only by its tool ({order.get("generators", {}).get(p, "see order.json")}); run the tool instead')
    for p in hs:
        if p not in paths: errs.append(f'{gdir}/{HASHES}: lists {p}, which is not a part')
    return errs


def roundtrip(src):
    """join, then cut the joined text back by the line map: every part and the page come back byte for byte"""
    text, lmap = join(src, header=True); lines = text.splitlines(keepends=True); got = {}
    for first, count, part, pfirst in lmap['segments']:
        got.setdefault(part, {})[pfirst] = ''.join(lines[first - 1:first - 1 + count])
    errs = []; order = load_order(src); page_path = order['page']['path']
    for e in [e for es in order['slots'].values() for e in es]:
        if ''.join(v for _, v in sorted(got.get(e['path'], {}).items())) != _read(src, e['path']): errs.append(f'{e["path"]}: differs after split')
    # the page: its own lines, with each slot's text back to its marker
    page = _read(src, page_path).splitlines(keepends=True); pieces = got.get(page_path, {}); rebuilt = []; i = 1
    while i <= len(page):
        if i in pieces:
            rebuilt.append(pieces[i]); i += pieces[i].count('\n') or 1
        else:
            rebuilt.append(page[i - 1]); i += 1   # a marker line (its slot's text is in the parts)
    if ''.join(rebuilt) != ''.join(page): errs.append(f'{page_path}: differs after split')
    return errs, text


def _load_map(p):
    if p.endswith('.map.json'): return json.load(open(p, encoding='utf-8'))
    return json.load(open(p + '.map.json', encoding='utf-8'))


def annotate(linemap, text, name='index.html'):
    """a test's output with every line of the joined page named as part:line"""
    def rep(m):
        part, ln = where(linemap, int(m.group(2)))
        return m.group(0) + (f' [{part}:{ln}]' if part else '')
    text = re.sub(r'(' + re.escape(name) + r'|main\.js):(\d+)(?::\d+)?', rep, text)
    return text


def main(a):
    cmd = a[0] if a else ''
    if cmd == 'join':
        text, lmap = write_joined(a[1], a[2], header='--plain' not in a)
        print(f'joined {len(lmap["segments"])} pieces, {len(text.encode()):,} bytes -> {a[2]} (+ .map.json)')
    elif cmd == 'check':
        errs = check(a[1])
        for e in errs: print('✗', e)
        for w in warnings(a[1]): print('!', w)
        n = sum(len(es) for es in load_order(a[1]).get('slots', {}).values()) if not errs or os.path.exists(os.path.join(a[1], 'order.json')) else 0
        print('SPLIT_OK' if not errs else f'SPLIT_FAILED {len(errs)}', f'({n} parts)')
        return 1 if errs else 0
    elif cmd == 'roundtrip':
        errs, text = roundtrip(a[1])
        for e in errs: print('✗', e)
        print('ROUNDTRIP_OK' if not errs else 'ROUNDTRIP_FAILED', f'({len(text.encode()):,} bytes)')
        return 1 if errs else 0
    elif cmd == 'where':
        lmap = _load_map(a[1])
        if len(a) > 2:
            for x in a[2:]:
                part, ln = where(lmap, int(x)); print(f'{x} -> {part}:{ln}')
        else:
            sys.stdout.write(annotate(lmap, sys.stdin.read()))
    elif cmd == 'record':
        record(a[1], *a[2:])
    else:
        print(__doc__); return 2
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))

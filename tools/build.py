#!/usr/bin/env python3
"""מחתימים דרכון - build: the readable source -> the shipped copy (server ZIP / WhatsApp file).

  python3 build.py SRC_DIR OUT.zip      (SRC_DIR holds index.html, sw.js, manifest.json, _headers, icons)
  python3 build.py SRC/index.html OUT.html
10.15.1 (split-source): SRC_DIR may be the source of parts (darkon/src with order.json): the parts are joined first (shared/split,
in memory, no "do not edit" line) and the ZIP takes index.html (built), sw.js, manifest.json, _headers, the icons, netlify.toml and netlify/functions (11.20.0) (.png.b64
decoded to .png), and site-test/ (test-address: the test address's manifest and marked icons, shared/site/testmarks.py). SRC/index.html may be the joined page of the work folder (its "do not edit" line is dropped).

The readable source stays the working copy (kept on the shelf). The build:
 1. packs rarely needed blocks into PACKED (9.1.0: only the instructions; the guide and "מה חדש" are small and stay plain) (gzip + base64), unpacked by the app in the background:
    - the files of the instructions for Claude (KIT.files; the app joins a goal's paste and zips the skill when asked)
 2. minifies the main script and the style with esbuild (whitespace, syntax, local names; global names stay)
 3. drops the indentation of the page's markup (no visible change)
and checks: round trip of every packed block, no '</script' inside the script, the version is there.
Needs node and esbuild ESBUILD_VERSION exactly (the ESBUILD env var, PATH or ESBUILD_TOOLS; installed there when missing, another refused),
and pako compress.PAKO_VERSION exactly in PAKO_TOOLS (shared/build/compress.py: every gzip and ZIP entry; another or none refused).
"""
import base64, gzip, hashlib, io, json, os, re, shutil, subprocess, sys, tempfile
sys.path.insert(0, os.path.join(os.path.dirname(os.path.realpath(__file__)), '..', '..', 'shared', 'split'))
import split  # 10.15.1 (split-source): the join of the source's parts
sys.path.insert(0, os.path.join(os.path.dirname(os.path.realpath(__file__)), '..', '..', 'shared', 'site'))
import testmarks  # test-address: the test address's manifest and icons
sys.path.insert(0, os.path.join(os.path.dirname(os.path.realpath(__file__)), '..', '..', 'shared', 'build'))
import compress  # build-deterministic (decisions 2026-11-25 · A build gives the same bytes in every environment): every compression and
# archive through one pinned implementation of classic deflate (pako, compress.PAKO_VERSION), never the zlib behind this Python

# private-names (decisions 2026-11-23 · Private names out of what reaches users and the public, Q4): esbuild's version is fixed here, its one
# place (setup_repo.py reads it from here). The build uses exactly this version: the ESBUILD env var when set, else the first esbuild found
# (PATH, the old container's path, the tools folder ESBUILD_TOOLS) that has it; none found -> it installs it into the tools folder; only
# other versions found -> it refuses, naming both. So two builds of one commit, in any environment, give the same bytes (spec/build.md).
ESBUILD_VERSION = '0.25.0'
ESBUILD_TOOLS = os.environ.get('ESBUILD_TOOLS') or '/opt/npm-tools'
_ESBUILD = []


def esbuild_version(path):
    try: return subprocess.run([path, '--version'], capture_output=True, text=True, timeout=60).stdout.strip() or '?'
    except Exception as e: return f'? ({e.__class__.__name__})'


def esbuild_bin():
    """the esbuild of ESBUILD_VERSION (found, or installed into ESBUILD_TOOLS); exits naming both versions when only another is there"""
    if _ESBUILD: return _ESBUILD[0]
    tools_bin = os.path.join(ESBUILD_TOOLS, 'node_modules', 'esbuild', 'bin', 'esbuild')
    env = os.environ.get('ESBUILD')
    cands = [env] if env else [p for p in dict.fromkeys((shutil.which('esbuild'), '/home/claude/.npm-global/lib/node_modules/tsx/node_modules/esbuild/bin/esbuild', tools_bin)) if p and os.path.exists(p)]
    found = [(p, esbuild_version(p)) for p in cands]
    good = [p for p, v in found if v == ESBUILD_VERSION]
    if not good and not found:  # none at all: install exactly the fixed version into the tools folder
        r = subprocess.run(['npm', 'i', '--prefix', ESBUILD_TOOLS, '--silent', '--no-save', f'esbuild@{ESBUILD_VERSION}'], capture_output=True, text=True)
        if r.returncode or esbuild_version(tools_bin) != ESBUILD_VERSION: sys.exit(f'esbuild {ESBUILD_VERSION} is missing and could not be installed into {ESBUILD_TOOLS}: {(r.stderr or r.stdout)[-500:]}')
        good = [tools_bin]
    if not good:
        sys.exit('the build uses exactly esbuild ' + ESBUILD_VERSION + ' (build.py ESBUILD_VERSION); found only '
                 + ', '.join(f'{v} at {p}' for p, v in found) + f' - install it: npm i --prefix {ESBUILD_TOOLS} esbuild@{ESBUILD_VERSION}'
                 + (', or unset ESBUILD' if env else ''))
    _ESBUILD.append(good[0]); return good[0]


def esbuild(code, loader, smap=False):
    """-> the minified text; smap: (text, its source map as a dict) - esbuild's inline map taken off the end (the code is the same)"""
    r = subprocess.run([esbuild_bin(), '--minify', '--charset=utf8', '--loader=' + loader, '--log-level=warning'] + (['--sourcemap=inline', '--sources-content=false'] if smap else []),
                       input=code.encode(), capture_output=True)
    if r.returncode:
        sys.exit('esbuild failed: ' + r.stderr.decode()[:2000])
    out = r.stdout.decode().rstrip('\n')
    if not smap: return out
    i = out.rindex('\n//# sourceMappingURL=data:application/json;base64,')
    return out[:i].rstrip('\n'), json.loads(base64.b64decode(out[i:].split(',', 1)[1]))


# ---- arch-guard (2; decisions 2026-11-20 · Review of the `quality-review` report, Q8): errors name their part. The page carries PART_AT,
# where each src/ part starts in it ({parts: [path], at: [[line, col, part index]]}, lines and columns from 1 as a browser's error and stack
# give them; col 0 = the whole line), written as `self.PART_AT = {...};` on the main <script>'s own line - in front of the script, so it
# moves nothing in it. The app's errNote looks an error's line:col up in it (js/action-wiring.js errPos). The built page's table comes from
# esbuild's source map (the minified script -> the joined page's line -> its part by the join's line map); the tests' source copy's from the
# line map alone (join.py, part_table_joined). index.html.map (a ZIP build, beside the ZIP, never in it): the same map with each part as
# its source and its own lines - where.py --built reads it.
B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
B64I = {c: i for i, c in enumerate(B64)}


def vlq_decode(mappings):
    """-> [[generated line, [[gen col, src, src line, src col(, name)], ...]], ...] - absolute values, lines and columns from 0"""
    out, st = [], [0, 0, 0, 0, 0]  # src, src line, src col, name: running across lines; gen col resets per line
    for li, line in enumerate(mappings.split(';')):
        segs, gc = [], 0
        for seg in line.split(',') if line else []:
            vals, v, sh = [], 0, 0
            for ch in seg:
                d = B64I[ch]; v += (d & 31) << sh
                if d & 32: sh += 5
                else: vals.append(-(v >> 1) if v & 1 else v >> 1); v = sh = 0
            gc += vals[0]
            if len(vals) >= 4:
                for k in range(1, len(vals)): st[k - 1] += vals[k]
                segs.append([gc] + st[:len(vals) - 1])
            else: segs.append([gc])
        out.append(segs)
    return out


def vlq_encode(lines):
    """the inverse of vlq_decode (absolute values -> the mappings text)"""
    def enc(v):
        v = (-v << 1) | 1 if v < 0 else v << 1; o = ''
        while True:
            d = v & 31; v >>= 5
            o += B64[d | (32 if v else 0)]
            if not v: return o
    out, st = [], [0, 0, 0, 0]
    for segs in lines:
        parts, gc = [], 0
        for sg in segs:
            t = enc(sg[0] - gc); gc = sg[0]
            for k in range(1, len(sg)): t += enc(sg[k] - st[k - 1]); st[k - 1] = sg[k]
            parts.append(t)
        out.append(','.join(parts))
    return ';'.join(out)


def seg_at(segs, line):
    """the join's line map: a line of the joined page -> (part, its line in the part), or (None, 0)"""
    for first, count, part, pfirst in segs:
        if first <= line < first + count: return part, pfirst + line - first
    return None, 0


def part_table_joined(lmap):
    """the tests' source copy: each piece of the join starts a part at its first line (col 0)"""
    parts, at = [], []
    for first, count, part, pfirst in lmap['segments']:
        if part not in parts: parts.append(part)
        at.append([first, 0, parts.index(part)])
    return {'parts': parts, 'at': at}


def main_script_open(s):
    """the offset of the main <script> tag (the one right after the bundle's) and of its text"""
    t = s.index('<script>', s.index('</script>', s.index('<script id="bundle"')))
    return t, t + len('<script>')


def put_part_at(s, table):
    """the table on the main <script>'s own line, in front of the script (no line of the page moves)"""
    t, a = main_script_open(s)
    return s[:a] + 'self.PART_AT=' + json.dumps(table, ensure_ascii=False, separators=(',', ':')) + ';' + s[a:]


def part_table_built(smap, segs, js_line0, script_line):
    """the built page: esbuild's map (minified line, col -> the script's line) through the join's line map (segs; js_line0 = the joined
    line of the script's first line) -> the table of where each part starts in the page (script_line = the line of the main <script>,
    the minified script begins on the next), and the part-level source map of the page"""
    parts, at, out_lines, last = [], [], [[] for _ in range(script_line)], None
    for gl, row in enumerate(vlq_decode(smap['mappings'])):
        o = []
        for sg in row:
            if len(sg) < 4: continue
            part, pl = seg_at(segs, js_line0 + sg[2])
            if part is None: continue
            if part not in parts: parts.append(part)
            pi = parts.index(part)
            if pi != last: at.append([script_line + 1 + gl, sg[0] + 1, pi]); last = pi
            o.append([sg[0], pi, pl - 1, sg[3]] + sg[4:5])
        out_lines.append(o)
    pmap = {'version': 3, 'file': 'index.html', 'sources': parts, 'names': smap.get('names', []), 'mappings': vlq_encode(out_lines)}
    return {'parts': parts, 'at': at}, pmap


def gz64(obj):  # build-deterministic: gzip through shared/build/compress.py - the same bytes as classic zlib's gzip.compress(…, 9, mtime=0)
    return base64.b64encode(compress.gzip(json.dumps(obj, ensure_ascii=False, separators=(',', ':')).encode())).decode()


def js_value(text):  # a JS literal (array/object) -> python, through node
    r = subprocess.run(['node', '-e', 'let s="";process.stdin.setEncoding("utf8");process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(JSON.stringify(eval("("+s+")"))))'],
                       input=text.encode(), capture_output=True)
    if r.returncode:
        sys.exit('node failed: ' + r.stderr.decode()[:1000])
    out = r.stdout.decode('utf-8')
    if '\ufffd' in out and '\ufffd' not in text:  # 4.48.0: a character cut at a chunk edge once broke a word in "מה חדש"
        sys.exit('js_value: broken UTF-8 in node output')
    return json.loads(out)


# ---- THE BUILD'S FACTS (arch-guard item 4): everything the build reads out of the source's text, in one place. Each is a regular
# expression over the joined page that depends on how one declaration is written (one line, these names); a fact not found stops the build
# naming it, never a wrong build. They stay where the app keeps them (the version in content/version.js, the hot spot of every update; the
# copyright in copyright-visibility.js; the app id in app-basics.js / item-model.js; the tiles in the services registry), each a single
# declaration of literals.
FACTS = {
    'version': r"const APP_VERSION = '([\d.]+)';",                                     # content/version.js
    'date': r"const APP_DATE = '([^']*)';",                                            # content/version.js
    'changelog': r'const CHANGELOG = (\[.*?\n\]);',                                    # content/version.js (re.S)
    'copyright': r"const COPY_FIRST_YEAR = (\d{4}), COPY_OWNER = '([^']+)';",           # js/copyright-visibility.js
    'copy words': r"COPY_WORDS = '([^']+)'",                                           # js/copyright-visibility.js (task open-source)
    'file prefix': r"\bconst APP = \{[^\n]*?\bfilePrefix: '([^']+)'",                    # js/app-basics.js
    'app id': r"\nconst BACKUP_APP = PACK\.filePrefix \+ '([^']+)';",                  # js/item-model.js: a file's "app" (BACKUP_APP)
    'kit': r'\nconst KIT = (\{.*\});\n',                                               # generated/kit.js, one line (tests/kit.py)
    'screen tiles': r"\n  screenTiles: \{[^\n]*?providers: \[([^\]]*)\]",               # js/services.js, the registry's row
}


def fact(s, name, flags=0):
    m = re.search(FACTS[name], s, flags)
    assert m, f"the build's fact '{name}' is not in the source (build.py FACTS: {FACTS[name]})"
    return m


def app_id(s):
    """the app's id in its files (BACKUP_APP = APP.filePrefix + '-trip'): the share handler of sw.js recognises an app file by it"""
    return fact(s, 'file prefix').group(1) + fact(s, 'app id').group(1)


def lib_urls(s):
    """the libraries the page asks for from the hosts of the worker's library cache (sw.js LIB_HOSTS): its literal https addresses"""
    return sorted(set(re.findall(r"'(https://(?:cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net)/[^'\s]+)'", s)))


# ---- diet-mechanism (decisions 2026-11-23 · A diet for the main script, Q4-Q8): parts loaded on demand. Every part of order.json says its
# side (split.sides); a moved group's parts leave the main script: on the site each group is its own minified file named with its content's
# hash (g-<group>.<hash>.js), its PART_AT on its first line (self.PART_AT_G[group]) and GROUP_IN.add(group) at its end; the main script
# gets GROUP_FILES (group -> file) and GROUP_ACTS (an action a group registers -> the group), which the loader (js/groups.js) reads. A
# single-page build (the copy inside Claude, the tests' built copy) keeps every group inside the page, where it always was (Q6): nothing is
# written into GROUP_FILES, so every group is "in". Either way the main script's budget is measured on the main parts alone, and each
# group's on its own file (quotas.json build.main_script, build.group.<name> - Q8).
NOT_MOVED_OK = set()  # diet-groups (11.62.0): every group has moved - a "notMoved" mark is refused from now on (work.md diet-groups item 2)


def group_sides(order):
    """-> {part path: group} of the moved groups' parts ({} for a source with no groups); a side missing or wrong stops the build"""
    if not order or 'groups' not in order: return {}
    errs, moved, _main = split.sides(order)
    errs += [f'{e["path"]}: "notMoved" - the group "{e["side"]}" has moved; its parts load on demand' for e in order['slots']['script'] if e.get('notMoved') and e.get('side') not in NOT_MOVED_OK]
    if errs: sys.exit("the parts' sides fail (order.json \"side\"):\n" + '\n'.join(errs))
    return {p: g for g, ps in moved.items() for p in ps}


def cut_groups(js, js_line0, segs, sides):
    """the main script's text and each moved group's, every line of the script at its place (another side's line left empty, so the
    join's line map and PART_AT read each of them as they read the whole script)"""
    groups = sorted(set(sides.values())); main, out = [], {g: [] for g in groups}
    for i, ln in enumerate(js.split('\n')):
        part, _l = seg_at(segs, js_line0 + i); side = sides.get(part)
        main.append('' if side else ln)
        for g in groups: out[g].append(ln if side == g else '')
    return '\n'.join(main), {g: '\n'.join(v) for g, v in out.items()}


def group_acts(text):
    """the actions a group's text registers: act('name', …) and ctlActs('prefix', ['a', …]) -> sorted names"""
    names = set(re.findall(r"(?<![\w$.])act\('([^']+)'", text))
    for pre, lst in re.findall(r"(?<![\w$.])ctlActs\('([^']+)',\s*\[([^\]]*)\]", text): names |= {pre + '.' + n for n in re.findall(r"'([^']+)'", lst)}
    return sorted(names)


def quota(name):
    qp = os.path.join(os.path.dirname(os.path.realpath(__file__)), 'quotas.json')
    return json.load(open(qp, encoding='utf-8')).get(name, 'missing') if os.path.isfile(qp) else None  # the public tree has no quotas: no budget


def build_group(g, gjs, segs, js_line0):
    """a moved group's file: (its name, its bytes, its part-level source map). Its first line is its PART_AT (self.PART_AT_G[g]), its last
    GROUP_IN.add(g) - the loader's sign that every part of it ran"""
    mjs, smap = esbuild(gjs + '\nGROUP_IN.add(' + json.dumps(g) + ');\n', 'js', smap=True)
    table, pmap = part_table_built(smap, [x for x in segs if not x[2].endswith('.html')], js_line0, 1)  # its parts only (the last line, past them, names none)
    body = ('(self.PART_AT_G=self.PART_AT_G||{})[' + json.dumps(g) + ']=' + json.dumps(table, ensure_ascii=False, separators=(',', ':')) + ';\n' + mjs + '\n').encode()
    name = f'g-{g}.{hashlib.sha256(body).hexdigest()[:10]}.js'; pmap['file'] = name
    return name, body, pmap


def budget(what, key, n):
    b = quota(key)
    assert b is None or (isinstance(b, int) and n <= b), f'the built {what} is {n} bytes, above its budget {b} (quotas.json {key}; a raise names its decision)'


def build_html(s, segs=None, order=None, site=False):
    """s: the joined page (no header); segs: its line map's segments (the join's) -> PART_AT; order: order.json (the parts' sides); site: the
    groups go to their own files (a ZIP) -> (built, version, sizes, pmap, groups: [(file name, bytes, map)])"""
    packed = {}
    version = fact(s, 'version').group(1)
    js_line0 = s.count('\n', 0, main_script_open(s)[1]) + 1  # the joined line of the main script's first line (the replacements below keep lines)

    # --- 1a. 9.1.0 (imvyepdr3): "מה חדש" and the guide stay plain - both are small now (t870 warns when they grow).
    # 10.14.0 (guide diet Q5): "מה חדש" may be empty (until the first distributed version), so the version's date is APP_DATE
    fact(s, 'changelog', re.S)

    # --- 1b. 10.6.1 (task copyright): the page head's copyright = the app's copyrightText(), computed here the same way - never typed by hand
    mcp = fact(s, 'copyright'); fy = int(mcp.group(1)); owner = mcp.group(2)
    vd = fact(s, 'date')
    vy = int(re.search(r'(\d{4})\s*$', vd.group(1)).group(1)); years = f'{fy}–{vy}' if vy > fy else str(fy)
    mc = re.search(r'<meta name="copyright" content="[^"]*">', s); assert mc and '<meta name="author" content="' + owner + '">' in s, 'the copyright and author meta tags'
    words = fact(s, 'copy words')  # task open-source: the words come from the app (MIT), never typed here
    s = s[:mc.start()] + f'<meta name="copyright" content="{owner} · {words.group(1)} © {years}">' + s[mc.end():]

    # --- 1c. the instructions for Claude (10, ש1): the KIT block keeps its version and goals plain; its files and pastes travel packed
    mk = re.search(FACTS['kit'], s)
    if mk:
        kit = json.loads(mk.group(1)); body = {'files': kit['files'], 'paste': kit['paste']}
        packed['kit'] = gz64(body)
        assert json.loads(gzip.decompress(base64.b64decode(packed['kit'])).decode()) == body, 'instructions round trip'
        kit['files'] = kit['paste'] = None
        s = s[:mk.start()] + '\nconst KIT = ' + json.dumps(kit, ensure_ascii=False) + ';\n' + s[mk.end():]

    assert s.count('const PACKED = {};') == 1
    s = s.replace('const PACKED = {};', 'const PACKED = ' + json.dumps(packed) + ';')

    # --- 2. minify: the main script is the one right after the bundle, up to the last </script>, the style is the first <style>
    a = s.index('<style>') + len('<style>'); b = s.index('</style>', a)
    s = s[:a] + esbuild(s[a:b], 'css') + s[b:]
    assert re.search(r'/\*![^*]*Apache-2\.0[^*]*subset[^*]*\*/', s), 'the icons\' licence comment (/*! … Apache-2.0 … subset */) must stay in the built CSS'  # 11.39.0 (legal-page, C7)
    end = s.rindex('</script>')
    start = main_script_open(s)[1]
    js = s[start:end]
    assert 'const APP_VERSION' in js and 'renderClaudeScreen' in js, 'main script not found'
    sides = group_sides(order)
    assert not sides or segs, 'parts loaded on demand need the line map of the join'
    files, gsizes = [], {}
    if sides:  # diet-mechanism: the main script without the moved groups; each group minified alone (its file on the site, its size always)
        main_js, gtexts = cut_groups(js, js_line0, segs, sides)
        for g, gjs in gtexts.items():
            name, body, gmap = build_group(g, gjs, segs, js_line0); gsizes[g] = len(body); budget(f'group {g}', 'build.group.' + g, len(body))
            if site: files.append((name, body, gmap))
        if site:
            acts = {a: g for g, gjs in gtexts.items() for a in group_acts(gjs)}
            sri = lambda b: 'sha384-' + base64.b64encode(hashlib.sha384(b).digest()).decode()  # Subresource Integrity, as every library (standard: security)
            for k, v in (('GROUP_FILES', {g: {'f': n, 'sri': sri(b)} for n, b, _m in files for g in [n.split('.')[0][2:]]}), ('GROUP_ACTS', acts)):
                assert main_js.count('const ' + k + ' = {};') == 1, k + ' in js/groups.js'
                main_js = main_js.replace('const ' + k + ' = {};', 'const ' + k + ' = ' + json.dumps(v, ensure_ascii=False, separators=(',', ':')) + ';')
            js = main_js
            mjs, smap = esbuild(js, 'js', smap=True); mb = len(mjs.encode())
        else:  # the single page keeps every group inside (Q6); its main parts alone measured for the budget
            mjs, smap = esbuild(js, 'js', smap=True); mb = len(esbuild(main_js, 'js').encode())
    else:
        mjs, smap = esbuild(js, 'js', smap=True); mb = len(mjs.encode())
    budget('main script', 'build.main_script', mb)  # private-names: the public tree (tools/build.py) has no tests' quotas - its build checks no budget
    assert not re.search(r'</script', mjs, re.I), "'</script' inside the minified script"
    assert "'" + version + "'" in mjs or '"' + version + '"' in mjs, 'version lost'
    table, pmap = part_table_built(smap, segs or [], js_line0, s.count('\n', 0, start) + 1) if segs else ({'parts': [], 'at': []}, None)
    s = s[:start] + '\n' + mjs + '\n' + s[end:]
    if segs: s = put_part_at(s, table)

    # --- 3. markup: drop indentation only (a line break stays, so the page looks the same)
    head_end = s.index('<script id="bundle"')
    body = re.sub(r'\n[ \t]+', '\n', s[s.index('</style>'):head_end])
    s = s[:s.index('</style>')] + body + s[head_end:]
    return s, version, {**{k: len(v) for k, v in packed.items()}, 'main script': mb, **{'group ' + g: n for g, n in gsizes.items()}}, pmap, files


def tile_hosts(s):
    """7.1.0 (ש1, plan stage 7): the service worker's tile hosts come from the registry - the providers of the screen tiles"""
    m = fact(s, 'screen tiles')
    hosts = []
    for prov in re.findall(r"'([a-z0-9]+)'", m.group(1)):
        pm = re.search(r"\n  " + prov + r": \{[^\n]*?hosts: \[([^\]]*)\]([^\n]*)", s)
        assert pm, 'provider ' + prov + ' not found'
        if 'noCache: true' in pm.group(2): continue  # legal-server (11.41.0): a provider whose terms forbid storing its tiles (Esri) - network only, never in the worker's tile cache
        hosts += re.findall(r"'([^']+)'", pm.group(1))
    return hosts


def sw_built(sw, s, version, fonts, groups=()):
    """arch-guard (4): the service worker's facts, written by the build like TILE_HOSTS (each source line stays, with a value for reading,
    and is replaced): VERSION (the app's version), APP_ID (the share handler's app file), TILE_HOSTS (the registry's screen tiles) and
    LIB_KEEP (what the library cache keeps at activate: the page's library addresses and the site's font files); diet-mechanism: GROUP_FILES
    (the groups' files, saved with the page)"""
    def put(name, value, why):
        nonlocal sw
        sw, n = re.subn(r"const " + name + r" = [^\n]*", "const " + name + " = " + value + "; // " + why, sw)
        assert n == 1, name + ' line in sw.js'
    q = lambda v: json.dumps(v, ensure_ascii=False).replace('"', "'")
    put('VERSION', q(version), 'built from APP_VERSION (build.py)')
    put('APP_ID', q(app_id(s)), "built from the app's file prefix (build.py; BACKUP_APP)")
    put('TILE_HOSTS', q(tile_hosts(s)), 'built from the registry (build.py, 7.1.0)')
    put('LIB_KEEP', q(lib_urls(s) + fonts), "built from the page's library addresses and the site's fonts (build.py)")
    put('GROUP_FILES', q(list(groups)), "built from the groups' files (build.py, diet-mechanism): saved with the page at install")
    return sw


def queue_built(src, version):
    """legal-credits-2 (S3; decisions 2026-11-24 · Review of the legal-review-2 report, Q2): the shared queue's User-Agent names the
    app's version - Transitous asks for at least the name, the client's version and a contact - written here as sw.js's VERSION is"""
    out, n = re.subn(r"export const UA = 'Darkon/[^ ']+ ", "export const UA = 'Darkon/" + version + " ", src)
    assert n == 1, "the User-Agent line in queue.mjs (export const UA = 'Darkon/<version> (...)')"
    return out


def launch_colours(s, srcdir):
    """11.29.0 (task launch-fast; decisions 2026-11-19 · The launch screen, Q2): the launch screen's colours are the app's primary
    blue - one source, --primary in css/tokens.css (its first, light value). The page's <meta name="theme-color"> and, when the
    manifest is at hand, its background_color and theme_color must equal it; the build stops otherwise (the test address's
    manifest is made from the same one by testmarks.py)."""
    m = re.search(r'--primary:\s*(#[0-9A-Fa-f]{6})', s)
    assert m, 'launch colours: --primary not found in the tokens'
    tok = m.group(1).upper()
    meta = re.findall(r'<meta name="theme-color" content="([^"]*)">', s)
    assert [x.upper() for x in meta] == [tok], 'launch colours: <meta name="theme-color"> must be --primary ' + tok + ', found ' + str(meta)
    if srcdir and os.path.isfile(os.path.join(srcdir, 'manifest.json')):
        man = json.load(open(os.path.join(srcdir, 'manifest.json'), encoding='utf-8'))
        for k in ('background_color', 'theme_color'):
            assert str(man.get(k, '')).upper() == tok, 'launch colours: manifest.json ' + k + ' must be --primary ' + tok + ', found ' + str(man.get(k))
    return tok


class FixedZip:
    """review-fixes-11471 (6; decisions 2026-11-23 · Review of the `test-dedupe` and `one-way` summaries, Q4): a ZIP's entries carry the time
    they were written (writestr) or the file's own time (write), so two builds of the same commit gave the same page and map in different
    ZIP bytes. Every entry gets ZIP_TIME instead; what is inside is unchanged.
    build-deterministic: the entries are gathered in the order written and the ZIP is written by shared/build/compress.py zip_bytes
    (deflated by the pinned pako, laid out as zipfile lays it out), so its bytes no longer depend on the zlib behind this Python."""
    ZIP_TIME = compress.ZIP_TIME
    def __init__(self): self.entries = []
    def writestr(self, name, data):
        self.entries.append((name, data.encode() if isinstance(data, str) else data))
    def write(self, path, name):
        with open(path, 'rb') as f: self.writestr(name, f.read())
    def bytes(self): return compress.zip_bytes(self.entries, self.ZIP_TIME)

def main():
    src, out = sys.argv[1], sys.argv[2]
    srcdir = src if os.path.isdir(src) else None
    parts = bool(srcdir) and os.path.isfile(os.path.join(srcdir, 'order.json'))
    if parts:  # 10.15.1: the source of parts - the split guards first, then the join
        errs = split.check(srcdir)
        if errs: sys.exit('the split guards fail:\n' + '\n'.join(errs))
        s, lmap = split.join(srcdir); segs = lmap['segments']; order = split.load_order(srcdir)
    else:
        html_path = os.path.join(src, 'index.html') if srcdir else src
        raw = open(html_path, encoding='utf-8').read(); s = split.strip_header(raw); segs = None
        if os.path.isfile(html_path + '.map.json'):  # the work folder's joined page: its line map (one line less without the header)
            d = 1 if s != raw else 0
            lm = json.load(open(html_path + '.map.json', encoding='utf-8'))
            segs = [[f - d, c, p, pf] for f, c, p, pf in lm['segments'] if f - d >= 1]
        order = None  # diet-mechanism: the parts' sides come from the source the page was joined from (its line map names it)
        if segs and os.path.isfile(os.path.join(lm.get('src', ''), 'order.json')): order = split.load_order(lm['src'])
    launch_colours(s, srcdir)
    built, version, sizes, pmap, gfiles = build_html(s, segs, order, site=out.endswith('.zip'))
    if out.endswith('.zip'):
        assert srcdir, 'a ZIP needs the source folder'
        mldir = os.path.join(srcdir, 'maplibre')  # map-3d: the 3D map's engine (MapLibre GL JS and the RTL text plugin), files of the site loaded on the first tap
        mlfiles = sorted(fn for fn in (os.listdir(mldir) if parts and os.path.isdir(mldir) else []) if fn.endswith(('.js', '.css')))
        sw = sw_built(open(os.path.join(srcdir, 'sw.js'), encoding='utf-8').read(), s, version,
                      sorted('./fonts/' + fn[:-4] for fn in (os.listdir(os.path.join(srcdir, 'fonts')) if os.path.isdir(os.path.join(srcdir, 'fonts')) else []) if fn.endswith('.woff2.b64'))
                      + ['./maplibre/' + fn for fn in mlfiles] + ['./countries-50m.json'], ['./' + n for n, _b, _m in gfiles])  # kept by the library cache at activate, like the fonts; legal-credits-2 (S9): the route pictures' borders
        z = FixedZip()  # review-fixes-11471 (6): every entry with one fixed time; build-deterministic: one pinned deflate
        names = sorted(os.listdir(srcdir))
        if parts:  # only what the site serves: the page (built from the parts) and the files outside the join
            names = sorted(['index.html'] + [n for n in names if n in ('sw.js', 'manifest.json', '_headers', 'terms.html', 'licenses.txt', 'countries-110m.json', 'countries-50m.json') or n.endswith('.png.b64')])  # 11.39.0 (legal-page): the terms page and the licences
        for name in names:
            p = os.path.join(srcdir, name)
            if name.endswith('.png.b64'):  # the icons are kept as base64 in the source
                z.writestr(name[:-4], base64.b64decode(open(p).read()))
            elif (name == 'index.html' and parts) or (os.path.isfile(p) and not name.startswith('.') and not name.endswith('.py')):
                if name == 'index.html':
                    z.writestr('index.html', built.encode())
                elif name == 'sw.js':
                    z.writestr('sw.js', sw.encode())
                else:
                    z.write(p, name)
        fodir = os.path.join(srcdir, 'fonts')  # legal-server (11.41.0): the text fonts (tests/textfonts.py), kept as base64 like the icons
        for fn in (sorted(os.listdir(fodir)) if parts and os.path.isdir(fodir) else []):
            if fn.endswith('.woff2.b64'): z.writestr('fonts/' + fn[:-4], base64.b64decode(open(os.path.join(fodir, fn)).read()))
        for fn in mlfiles: z.write(os.path.join(mldir, fn), 'maplibre/' + fn)
        for n, body, _m in gfiles: z.writestr(n, body)  # diet-mechanism: the groups loaded on demand, saved by the worker with the page  # map-3d: as npm ships them (the page checks their hashes)
        # 11.20.0 (place-search-upgrade): the server function (netlify/functions) and its netlify.toml - Netlify deploys them with the site
        fdir = os.path.join(srcdir, 'netlify', 'functions')
        if parts and os.path.isdir(fdir):
            z.write(os.path.join(srcdir, 'netlify.toml'), 'netlify.toml')
            if os.path.isfile(os.path.join(srcdir, 'package.json')): z.write(os.path.join(srcdir, 'package.json'), 'package.json')  # 11.23.0 (place-gid-2): the functions' dependency
            for fn in sorted(os.listdir(fdir)):
                if fn == 'queue.mjs': z.writestr('netlify/functions/' + fn, queue_built(open(os.path.join(fdir, fn), encoding='utf-8').read(), version).encode())  # legal-credits-2 (S3)
                elif fn.endswith(('.mjs', '.js')): z.write(os.path.join(fdir, fn), 'netlify/functions/' + fn)
            ldir = os.path.join(srcdir, 'netlify', 'lib')  # 11.38.2 (privacy-server): the functions' shared code (the origin check), imported by them
            for fn in (sorted(os.listdir(ldir)) if os.path.isdir(ldir) else []):
                if fn.endswith(('.mjs', '.js')): z.write(os.path.join(ldir, fn), 'netlify/lib/' + fn)
        # test-address: the test address's own files (shared/site/testmarks.py) - the manifest named "<short name> בדיקה" and the icons
        # with the orange strip, under site-test/; shared/site/site_push.py puts them over the root on the test branch only, never on live
        if parts:
            icons = {n[:-4]: base64.b64decode(open(os.path.join(srcdir, n)).read()) for n in names if n.endswith('.png.b64')}
            for n, b in testmarks.marks(open(os.path.join(srcdir, 'manifest.json'), encoding='utf-8').read(), icons).items():
                z.writestr('site-test/' + n, b)
        with open(out, 'wb') as f: f.write(z.bytes())
        if pmap: json.dump(pmap, open(os.path.join(os.path.dirname(os.path.abspath(out)), 'index.html.map'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))  # beside the ZIP, never in it
        for n, _b, gmap in gfiles: json.dump(gmap, open(os.path.join(os.path.dirname(os.path.abspath(out)), n + '.map'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))  # diet-mechanism: each group's map, the same way
    else:
        open(out, 'w', encoding='utf-8').write(built)
    b = len(built.encode())
    print(f"{version}: {len(s.encode()):,} -> {b:,} bytes (gzip {len(gzip.compress(built.encode(), 6)):,}); packed {sizes}")


if __name__ == '__main__':
    main()

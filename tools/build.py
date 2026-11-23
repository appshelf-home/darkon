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
Needs esbuild (ESBUILD env var or on PATH) and node.
"""
import base64, gzip, io, json, os, re, shutil, subprocess, sys, tempfile, zipfile
sys.path.insert(0, os.path.join(os.path.dirname(os.path.realpath(__file__)), '..', '..', 'shared', 'split'))
import split  # 10.15.1 (split-source): the join of the source's parts
sys.path.insert(0, os.path.join(os.path.dirname(os.path.realpath(__file__)), '..', '..', 'shared', 'site'))
import testmarks  # test-address: the test address's manifest and icons

# windows-inner-steps-fix (decisions 2026-11-15 review of 11.15.0, Q4 (4)): the first esbuild that exists - the env var, PATH, the
# old container's path, then the one this container installs (/opt/npm-tools)
ESBUILD = os.environ.get('ESBUILD') or shutil.which('esbuild') or next((p for p in ('/home/claude/.npm-global/lib/node_modules/tsx/node_modules/esbuild/bin/esbuild',
    '/opt/npm-tools/node_modules/esbuild/bin/esbuild') if os.path.exists(p)), '/home/claude/.npm-global/lib/node_modules/tsx/node_modules/esbuild/bin/esbuild')


def esbuild(code, loader):
    r = subprocess.run([ESBUILD, '--minify', '--charset=utf8', '--loader=' + loader, '--log-level=warning'],
                       input=code.encode(), capture_output=True)
    if r.returncode:
        sys.exit('esbuild failed: ' + r.stderr.decode()[:2000])
    return r.stdout.decode().rstrip('\n')


def gz64(obj):
    return base64.b64encode(gzip.compress(json.dumps(obj, ensure_ascii=False, separators=(',', ':')).encode(), 9, mtime=0)).decode()


def js_value(text):  # a JS literal (array/object) -> python, through node
    r = subprocess.run(['node', '-e', 'let s="";process.stdin.setEncoding("utf8");process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(JSON.stringify(eval("("+s+")"))))'],
                       input=text.encode(), capture_output=True)
    if r.returncode:
        sys.exit('node failed: ' + r.stderr.decode()[:1000])
    out = r.stdout.decode('utf-8')
    if '\ufffd' in out and '\ufffd' not in text:  # 4.48.0: a character cut at a chunk edge once broke a word in "מה חדש"
        sys.exit('js_value: broken UTF-8 in node output')
    return json.loads(out)


def build_html(s):
    packed = {}
    version = re.search(r"const APP_VERSION = '([\d.]+)';", s).group(1)

    # --- 1a. 9.1.0 (imvyepdr3): "מה חדש" and the guide stay plain - both are small now (t870 warns when they grow).
    # 10.14.0 (guide diet Q5): "מה חדש" may be empty (until the first distributed version), so the version's date is APP_DATE
    assert re.search(r'const CHANGELOG = (\[.*?\n\]);', s, re.S), 'the changelog block'

    # --- 1b. 10.6.1 (task copyright): the page head's copyright = the app's copyrightText(), computed here the same way - never typed by hand
    fy = int(re.search(r'const COPY_FIRST_YEAR = (\d{4}), COPY_OWNER = \'([^\']+)\';', s).group(1)); owner = re.search(r"COPY_OWNER = '([^']+)';", s).group(1)
    vd = re.search(r"const APP_DATE = '([^']*)';", s); assert vd, 'APP_DATE'
    vy = int(re.search(r'(\d{4})\s*$', vd.group(1)).group(1)); years = f'{fy}–{vy}' if vy > fy else str(fy)
    mc = re.search(r'<meta name="copyright" content="[^"]*">', s); assert mc and '<meta name="author" content="' + owner + '">' in s, 'the copyright and author meta tags'
    words = re.search(r"COPY_WORDS = '([^']+)'", s); assert words, 'COPY_WORDS'  # task open-source: the words come from the app (MIT), never typed here
    s = s[:mc.start()] + f'<meta name="copyright" content="{owner} · {words.group(1)} © {years}">' + s[mc.end():]

    # --- 1c. the instructions for Claude (10, ש1): the KIT block keeps its version and goals plain; its files and pastes travel packed
    mk = re.search(r'\nconst KIT = (\{.*\});\n', s)
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
    start = s.index('<script>', s.index('</script>', s.index('<script id="bundle"'))) + len('<script>')
    js = s[start:end]
    assert 'const APP_VERSION' in js and 'renderClaudeScreen' in js, 'main script not found'
    mjs = esbuild(js, 'js')
    assert not re.search(r'</script', mjs, re.I), "'</script' inside the minified script"
    assert "'" + version + "'" in mjs or '"' + version + '"' in mjs, 'version lost'
    s = s[:start] + '\n' + mjs + '\n' + s[end:]

    # --- 3. markup: drop indentation only (a line break stays, so the page looks the same)
    head_end = s.index('<script id="bundle"')
    body = re.sub(r'\n[ \t]+', '\n', s[s.index('</style>'):head_end])
    s = s[:s.index('</style>')] + body + s[head_end:]
    return s, version, {k: len(v) for k, v in packed.items()}


def tile_hosts(s):
    """7.1.0 (ש1, plan stage 7): the service worker's tile hosts come from the registry - the providers of the screen tiles"""
    m = re.search(r"\n  screenTiles: \{[^\n]*?providers: \[([^\]]*)\]", s)
    assert m, 'SERVICES.screenTiles not found'
    hosts = []
    for prov in re.findall(r"'([a-z0-9]+)'", m.group(1)):
        pm = re.search(r"\n  " + prov + r": \{[^\n]*?hosts: \[([^\]]*)\]([^\n]*)", s)
        assert pm, 'provider ' + prov + ' not found'
        if 'noCache: true' in pm.group(2): continue  # legal-server (11.41.0): a provider whose terms forbid storing its tiles (Esri) - network only, never in the worker's tile cache
        hosts += re.findall(r"'([^']+)'", pm.group(1))
    return hosts


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


def main():
    src, out = sys.argv[1], sys.argv[2]
    srcdir = src if os.path.isdir(src) else None
    parts = bool(srcdir) and os.path.isfile(os.path.join(srcdir, 'order.json'))
    if parts:  # 10.15.1: the source of parts - the split guards first, then the join
        errs = split.check(srcdir)
        if errs: sys.exit('the split guards fail:\n' + '\n'.join(errs))
        s = split.join(srcdir)[0]
    else:
        html_path = os.path.join(src, 'index.html') if srcdir else src
        s = split.strip_header(open(html_path, encoding='utf-8').read())
    launch_colours(s, srcdir)
    built, version, sizes = build_html(s)
    if out.endswith('.zip'):
        assert srcdir, 'a ZIP needs the source folder'
        sw = open(os.path.join(srcdir, 'sw.js'), encoding='utf-8').read()
        assert "const VERSION = '" + version + "'" in sw, 'sw.js VERSION must be ' + version
        hosts = tile_hosts(s)
        sw, n = re.subn(r"const TILE_HOSTS = \[[^\]]*\];[^\n]*", "const TILE_HOSTS = " + json.dumps(hosts).replace('"', "'") + "; // built from the registry (build.py, 7.1.0)", sw)
        assert n == 1, 'TILE_HOSTS line in sw.js'
        with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
            names = sorted(os.listdir(srcdir))
            if parts:  # only what the site serves: the page (built from the parts) and the files outside the join
                names = sorted(['index.html'] + [n for n in names if n in ('sw.js', 'manifest.json', '_headers', 'terms.html', 'licenses.txt') or n.endswith('.png.b64')])  # 11.39.0 (legal-page): the terms page and the licences
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
            # 11.20.0 (place-search-upgrade): the server function (netlify/functions) and its netlify.toml - Netlify deploys them with the site
            fdir = os.path.join(srcdir, 'netlify', 'functions')
            if parts and os.path.isdir(fdir):
                z.write(os.path.join(srcdir, 'netlify.toml'), 'netlify.toml')
                if os.path.isfile(os.path.join(srcdir, 'package.json')): z.write(os.path.join(srcdir, 'package.json'), 'package.json')  # 11.23.0 (place-gid-2): the functions' dependency
                for fn in sorted(os.listdir(fdir)):
                    if fn.endswith(('.mjs', '.js')): z.write(os.path.join(fdir, fn), 'netlify/functions/' + fn)
                ldir = os.path.join(srcdir, 'netlify', 'lib')  # 11.38.2 (privacy-server): the functions' shared code (the origin check), imported by them
                for fn in (sorted(os.listdir(ldir)) if os.path.isdir(ldir) else []):
                    if fn.endswith(('.mjs', '.js')): z.write(os.path.join(ldir, fn), 'netlify/lib/' + fn)
            # test-address: the test address's own files (shared/site/testmarks.py) - the manifest named "<short name> בדיקה" and the icons
            # with the orange strip, under site-test/; shared/site/site_push.py puts them over the root on the test branch only, never on live
            if parts:
                icons = {n[:-4]: base64.b64decode(open(os.path.join(srcdir, n)).read()) for n in names if n.endswith('.png.b64')}
                for n, b in testmarks.marks(open(os.path.join(srcdir, 'manifest.json'), encoding='utf-8').read(), icons).items():
                    z.writestr('site-test/' + n, b)
    else:
        open(out, 'w', encoding='utf-8').write(built)
    b = len(built.encode())
    print(f"{version}: {len(s.encode()):,} -> {b:,} bytes (gzip {len(gzip.compress(built.encode(), 6)):,}); packed {sizes}")


if __name__ == '__main__':
    main()

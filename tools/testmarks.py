"""The test marks of a standalone app's test address (decisions: darkon 2026-11-16 "A test address through the repository", Q3).

The test address serves the same index.html as the real site; only the files the phone reads on its own differ, so the installed
test app cannot be mistaken for the real one:
  - manifest.json: name and short name "<short name> בדיקה" (the same id and scope - the origin differs anyway)
  - every icon the manifest lists: the app's icon with an orange strip reading "בדיקה" across its lower part; an "any" icon keeps
    its own shape (the strip is cut to the icon's outline), a "maskable" one keeps the word inside the safe zone (the centre circle
    of radius 40%), so no launcher's mask cuts it.

Used by a build (marks(manifest_text, icons) -> files) and by site_push.py; never edits the source.
  python3 testmarks.py SRC_DIR OUT_DIR     writes the test manifest and icons from SRC_DIR's manifest.json and icons (to look at them)
"""
import io, json, os, sys

LABEL = 'בדיקה'
STRIP = (230, 81, 0, 255)      # orange (#E65100): white text on it passes 4.5:1
INK = (255, 255, 255, 255)
FONTS = ['/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', '/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf']


def _font(px):
    from PIL import ImageFont, features
    for p in FONTS:
        if os.path.exists(p):
            kw = {'layout_engine': ImageFont.Layout.RAQM} if features.check('raqm') else {}
            return ImageFont.truetype(p, px, **kw), bool(kw)
    raise SystemExit('testmarks: no Hebrew-capable font found (' + ', '.join(FONTS) + ')')


def mark_icon(png_bytes, maskable=False):
    """the icon with the orange strip and the word; PNG bytes in, PNG bytes out (deterministic)"""
    from PIL import Image, ImageDraw, ImageChops
    im = Image.open(io.BytesIO(png_bytes)).convert('RGBA')
    w, h = im.size
    # the strip: the lower part; for a maskable icon, high enough that the word stays inside the safe circle
    top, bot = (0.64, 0.80) if maskable else (0.70, 0.90)
    y0, y1 = round(h * top), round(h * bot)
    strip = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(strip).rectangle([0, y0, w, y1 - 1], fill=STRIP)
    if not maskable:  # follow the icon's own outline (rounded corners stay transparent)
        a = ImageChops.multiply(strip.getchannel('A'), im.getchannel('A'))
        strip.putalpha(a)
    out = Image.alpha_composite(im, strip)
    font, shaped = _font(round((y1 - y0) * 0.66))
    text = LABEL if shaped else LABEL[::-1]   # without a shaping engine, Hebrew is drawn left to right: reverse it
    d = ImageDraw.Draw(out)
    l, t, r, b = d.textbbox((0, 0), text, font=font, **({'direction': 'rtl'} if shaped else {}))
    x = (w - (r - l)) / 2 - l
    y = (y0 + y1) / 2 - (t + b) / 2
    d.text((x, y), text, font=font, fill=INK, **({'direction': 'rtl'} if shaped else {}))
    if maskable:  # the word must sit inside the safe zone: every corner of its box within the 40% circle
        cx, cy, R = w / 2, h / 2, 0.4 * min(w, h)
        for px, py in [(x + l, y + t), (x + r, y + t), (x + l, y + b), (x + r, y + b)]:
            assert (px - cx) ** 2 + (py - cy) ** 2 <= R * R, 'testmarks: the word leaves the maskable safe zone'
    buf = io.BytesIO()
    out.save(buf, 'PNG', optimize=True)
    return buf.getvalue()


def test_manifest(text):
    """the test manifest: the same, with name and short name "<short name> בדיקה" """
    m = json.loads(text)
    m['name'] = m['short_name'] = (m.get('short_name') or m.get('name')) + ' ' + LABEL
    return json.dumps(m, ensure_ascii=False, indent=2) + '\n'


def marks(manifest_text, icons):
    """icons: {file name: PNG bytes} for the icons the manifest lists -> {file name: bytes} of the test manifest and icons"""
    m = json.loads(manifest_text)
    out = {'manifest.json': test_manifest(manifest_text).encode('utf-8')}
    for ic in m.get('icons', []):
        src = ic['src'].lstrip('./')
        assert src in icons, 'testmarks: the manifest lists ' + src + ', which is not among the icons'
        out[src] = mark_icon(icons[src], maskable='maskable' in ic.get('purpose', ''))
    return out


if __name__ == '__main__':
    import base64
    src, dst = sys.argv[1], sys.argv[2]
    man = open(os.path.join(src, 'manifest.json'), encoding='utf-8').read()
    icons = {}
    for ic in json.loads(man).get('icons', []):
        n = ic['src'].lstrip('./'); p = os.path.join(src, n)
        icons[n] = open(p, 'rb').read() if os.path.exists(p) else base64.b64decode(open(p + '.b64').read())
    os.makedirs(dst, exist_ok=True)
    for n, b in marks(man, icons).items():
        open(os.path.join(dst, n), 'wb').write(b)
        print('wrote', os.path.join(dst, n))

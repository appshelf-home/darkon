#!/usr/bin/env python3
"""Compression for every app's build: the same bytes in every environment.

decisions 2026-11-25 · A build gives the same bytes in every environment (darkon/decisions/2026-11-25-deterministic-build.md),
task `build-deterministic`. Python's zlib is whatever library that Python links (classic zlib, zlib-ng, ...) and each gives other
deflate bytes for the same input, so a build compressed with it is not the same file everywhere. Every compression and archive of a
build goes through here instead: one pinned implementation of classic deflate, level 9 - pako (a pure-JavaScript port of classic
zlib) at exactly PAKO_VERSION, run through Node from the tools folder PAKO_TOOLS. Its output equals classic zlib's byte for byte.
Another version, or none: the build refuses and names the install command (as the build's pinned esbuild).

  gzip(data)            -> bytes, as Python's gzip.compress(data, 9, mtime=0) writes them with classic zlib
  deflate_raw(data)     -> a raw deflate stream (no header), level 9
  deflate_raw_many(xs)  -> the same for a list, in one run of Node
  zip_bytes(entries)    -> a ZIP's bytes: (name, data) in the order given; a name ending in '/' is a stored folder, every other entry
                           is deflated here; one fixed time (ZIP_TIME) on every entry; laid out as Python's zipfile lays it out
Only the CRC (zlib.crc32, the same number in every library) comes from Python's zlib.
"""
import json, os, struct, subprocess, sys, tempfile, zlib

PAKO_VERSION = '2.1.0'
PAKO_TOOLS = os.environ.get('PAKO_TOOLS') or '/opt/npm-tools'
ZIP_TIME = (2026, 1, 1, 0, 0, 0)
_OK = []

_NODE = r"""
const pako = require(process.argv[2]), fs = require('fs');
for (const [i, o] of JSON.parse(fs.readFileSync(process.argv[1], 'utf8'))) fs.writeFileSync(o, pako.deflateRaw(fs.readFileSync(i), {level: 9}));
"""


def install_line():
    return f'npm i --prefix {PAKO_TOOLS} pako@{PAKO_VERSION}'


def pako_dir():
    """the pako of PAKO_VERSION in PAKO_TOOLS; exits naming the version found and the install command otherwise"""
    if _OK: return _OK[0]
    d = os.path.join(PAKO_TOOLS, 'node_modules', 'pako')
    try: v = json.load(open(os.path.join(d, 'package.json'), encoding='utf-8')).get('version')
    except Exception: v = None
    if v != PAKO_VERSION:
        sys.exit(f'the build compresses with exactly pako {PAKO_VERSION} (shared/build/compress.py PAKO_VERSION); '
                 + (f'found {v} at {d}' if v else f'none at {d}') + f' - install it: {install_line()}')
    _OK.append(d); return d


def deflate_raw_many(blobs):
    """-> a raw deflate stream (level 9) per input, in one run of Node; inputs and outputs pass by file, never argv"""
    blobs = list(blobs)
    if not blobs: return []
    d = pako_dir()
    with tempfile.TemporaryDirectory(prefix='compress-') as t:
        pairs = []
        for i, b in enumerate(blobs):
            p = os.path.join(t, f'{i}.in')
            with open(p, 'wb') as f: f.write(b)
            pairs.append([p, os.path.join(t, f'{i}.out')])
        lst = os.path.join(t, 'list.json')
        with open(lst, 'w', encoding='utf-8') as f: json.dump(pairs, f)
        r = subprocess.run(['node', '-e', _NODE, lst, d], capture_output=True, text=True)
        if r.returncode: sys.exit('pako failed: ' + (r.stderr or r.stdout)[-1000:])
        out = []
        for _i, o in pairs:
            with open(o, 'rb') as f: out.append(f.read())
        return out


def deflate_raw(data):
    return deflate_raw_many([data])[0]


def gzip(data):
    """the gzip member Python's gzip.compress(data, 9, mtime=0) writes: no name, time 0, XFL 2 (best), OS 255"""
    return b'\x1f\x8b\x08\x00\x00\x00\x00\x00\x02\xff' + deflate_raw(data) + struct.pack('<II', zlib.crc32(data) & 0xffffffff, len(data) & 0xffffffff)


def zip_bytes(entries, date_time=ZIP_TIME):
    """-> a ZIP of (name, data) in the given order, as Python's zipfile writes it (version 2.0, Unix, no extra fields, no zip64);
    a file deflated (attr 0644), a name ending in '/' a stored folder (attr 40755 + the DOS folder bit)"""
    entries = [(n, bytes(b)) for n, b in entries]
    defl = iter(deflate_raw_many([b for n, b in entries if not n.endswith('/')]))
    dosdate = (date_time[0] - 1980) << 9 | date_time[1] << 5 | date_time[2]
    dostime = date_time[3] << 11 | date_time[4] << 5 | (date_time[5] // 2)
    body, cdir = bytearray(), bytearray()
    for n, b in entries:
        folder = n.endswith('/')
        try: fn, flags = n.encode('ascii'), 0
        except UnicodeEncodeError: fn, flags = n.encode('utf-8'), 0x800
        method, comp, attr = (0, b, 0o40755 << 16 | 0x10) if folder else (8, next(defl), 0o644 << 16)
        crc = zlib.crc32(b) & 0xffffffff
        if len(b) > 0x7fffffff or len(comp) > 0x7fffffff or len(body) > 0x7fffffff: sys.exit(f'zip_bytes: {n} needs zip64, not written here')
        off = len(body)
        body += struct.pack('<4s2B4HL2L2H', b'PK\x03\x04', 20, 0, flags, method, dostime, dosdate, crc, len(comp), len(b), len(fn), 0) + fn + comp
        cdir += struct.pack('<4s4B4HL2L5HLL', b'PK\x01\x02', 20, 3, 20, 0, flags, method, dostime, dosdate, crc, len(comp), len(b),
                            len(fn), 0, 0, 0, 0, attr, off) + fn
    return bytes(body + cdir + struct.pack('<4s4H2LH', b'PK\x05\x06', 0, 0, len(entries), len(entries), len(cdir), len(body), 0))


if __name__ == '__main__':  # python3 compress.py --check: the pinned pako is there (exit 0) or the install line (exit 1)
    if sys.argv[1:] == ['--check']: print('pako', PAKO_VERSION, 'at', pako_dir())
    else: sys.exit(__doc__)

# מחתימים דרכון · Darkon

A Hebrew trip app for the phone: plan a trip's places and days on a map, keep it offline, and close it with a memory of where you were. Free, no account, no ads; the trips stay on the phone.

- The app: https://darkon-eran.netlify.app (install it from the browser's menu)
- Terms and privacy: https://darkon-eran.netlify.app/terms

## What is here
This repository holds only the app's source and what builds it. It is updated at each release of the app.
- `src/` - the source as parts: `src/order.json` lists every part in build order, with a line on what it holds; `page.html` is the page's skeleton, `css/` the styles, `js/` the script (one shared scope, no modules), `content/` the guide and the version, `generated/` files written by the project's own tools (never edited by hand). `sw.js`, `manifest.json`, `_headers`, `terms.html`, `licenses.txt`, `fonts/` and the icons (`*.png.b64`) are served as they are; `netlify/` holds the site's server functions and `netlify.toml`.
- `tools/build.py` - the build: joins the parts (`tools/split.py`), minifies the script and the style, and writes the site as a ZIP (`tools/testmarks.py` adds the test address's marked icons). Every gzip and ZIP entry goes through `tools/compress.py` (one pinned deflate, [pako](https://github.com/nodeca/pako) 2.1.0), so a build gives the same bytes on every machine.

## Build
Needs Python 3, Node.js, [esbuild](https://esbuild.github.io) 0.25, pako 2.1.0 exactly (any other version is refused) and, for the test address's icons, Pillow with the DejaVu Sans Bold font.

```
npm i --prefix /tmp/esb esbuild@0.25.0 pako@2.1.0
ESBUILD=/tmp/esb/node_modules/esbuild/bin/esbuild PAKO_TOOLS=/tmp/esb python3 tools/build.py src site.zip
```
Without `PAKO_TOOLS` the build looks for pako in `/opt/npm-tools` (install it there: `npm i --prefix /opt/npm-tools pako@2.1.0`).
The ZIP is the site: unpack it on any static host (the server functions run on Netlify). `python3 tools/build.py src/index.html page.html` is not used here - the source is parts.

## Licence
The app's code is open source under the MIT licence - see [`LICENSE`](LICENSE). The libraries, fonts and icons the app carries keep their own licences ([`THIRD-PARTY.md`](THIRD-PARTY.md); their texts in `src/licenses.txt`). The map data, map tiles, place data, weather, photos and texts the app shows come from outside services, each under its own terms, credited inside the app (הגדרות › מקורות ורישיונות) - they are not part of this licence.

Contact: appshelf.home@gmail.com

---

<div dir="rtl" lang="he">

## בעברית
"מחתימים דרכון" היא אפליקציית טיולים לטלפון: מתכננים את המקומות והימים של טיול על מפה, שומרים אותו לשימוש בלי רשת, וסוגרים אותו עם זיכרון של איפה הייתם. חינם, בלי חשבון ובלי פרסומות; הטיולים נשמרים רק בטלפון.

- האפליקציה: https://darkon-eran.netlify.app
- תנאי שימוש ופרטיות: https://darkon-eran.netlify.app/terms

כאן נמצא רק קוד המקור של האפליקציה ומה שבונה אותו, ומתעדכן בכל גרסה שמשתחררת. בנייה: `tools/build.py src site.zip` (צריך Python 3,‏ Node.js,‏ esbuild ו-pako).

הקוד פתוח ברישיון MIT (הקובץ `LICENSE`). הספריות, הגופנים והאייקונים שבאפליקציה - כל אחד ברישיון שלו (`THIRD-PARTY.md`). המפות, נתוני המקומות, מזג האוויר, התמונות והטקסטים שהאפליקציה מציגה מגיעים משירותים חיצוניים, כל אחד בתנאים שלו, ואינם חלק מהרישיון.

יצירת קשר: appshelf.home@gmail.com

</div>

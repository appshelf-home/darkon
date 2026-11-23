# Third-party software, fonts, icons and data

The app's own code is under the MIT licence ([`LICENSE`](LICENSE)). What it carries of others' work keeps its own licence; the full licence texts, as read at their sources, are in [`src/licenses.txt`](src/licenses.txt) (also served by the app at `/licenses.txt`).

| What | Where in the app | Licence | Source |
|---|---|---|---|
| Material Symbols Outlined (Google LLC) | the icons - a subset of the font, cut by the project's build, in `src/generated/ms-font.css` and `src/generated/ms-font-page.js` (modified: only the icons in use) | Apache License 2.0 | https://github.com/google/material-design-icons |
| Leaflet 1.9.4 (Volodymyr Agafonkin, CloudMade) | the map library - loaded from cdnjs.cloudflare.com, not in this repository | BSD 2-Clause | https://github.com/Leaflet/Leaflet |
| world-atlas 2.0.2 (Michael Bostock) | the countries' borders - loaded from cdn.jsdelivr.net, not in this repository | ISC | https://github.com/topojson/world-atlas |
| Natural Earth | the data inside world-atlas | public domain | https://www.naturalearthdata.com |
| Rubik | the text font - `src/fonts/` | SIL Open Font License 1.1 | https://github.com/googlefonts/rubik |
| Frank Ruhl Libre | the headings' font - `src/fonts/` | SIL Open Font License 1.1 | https://github.com/fontef/frankruhllibre |
| Secular One, Suez One, Assistant | the trip picture's heading fonts - `src/fonts/` | SIL Open Font License 1.1 | https://github.com/google/fonts/tree/main/ofl |

## Data and services
The map tiles, map data (© OpenStreetMap contributors, ODbL), place search, routes, weather, photos and texts (Wikipedia and Wikimedia Commons, each under its own licence) come from outside services at run time. Each is listed in the app with its credit and its terms (הגדרות › מקורות ורישיונות), and in the terms page (`src/terms.html`, part "השירותים החיצוניים") with what it receives. None of it is part of this repository or of its licence.

# Daylight Hours Explorer — Accessible HTML5

An accessible HTML5 re-implementation of the NAAP/KL-UNL **Daylight Hours Explorer**
Flash simulation, built on the shared KL-UNL foundation files.

## ⚠️ It must be served over HTTP — double-clicking `index.html` will NOT work

The KL-UNL masthead component (`foundation/kl-unl-masthead.js`) loads the sim
title and the Help / About text with `fetch('foundation/contents.json')`.
Browsers **block `fetch()` of local files** under the `file://` protocol
(same-origin / CORS security), so opening `index.html` by double-click shows an
empty or broken masthead and the sim will not initialise correctly.

Serve the folder over HTTP instead and everything works.

## How to run it locally

Run one of these **from inside this `html5/` folder**, then open the printed URL:

```sh
# Python 3
python3 -m http.server 8123
#   then open  http://localhost:8123/

# Node
npx serve
#   or
npx http-server
```

Or use the **VS Code “Live Server”** extension (right-click `index.html` → *Open with Live Server*).

> Because you serve from **inside** `html5/`, the sim is at the server root:
> open `http://localhost:8123/` — **not** `.../html5/index.html`.

## Production

When deployed to the cloud host (served over HTTP/HTTPS) it just works — the
`file://` limitation only affects local double-clicking.

## What’s in here

| Path | Purpose |
|------|---------|
| `index.html` | KL-UNL scaffold: `.app-shell` + `<kl-unl-masthead>` + panels |
| `foundation/` | KL-UNL foundation files (copied unchanged; see CONVERSION_NOTES for the one `contents.json` note) |
| `styles/styles.css` | Sim-specific styles only (layered on `kl-unl.css`) |
| `simulation.js` | All sim logic: physics, plot, celestial-sphere globe, controls |
| `CONVERSION_NOTES.md` | Behaviour model, AS→HTML5 mapping, deviations |
| `ACCESSIBILITY.md` | WCAG affordances and screen-reader notes |

No build step, no bundler, no framework, no CDN, no analytics — everything is local.
The only runtime network request is the local `foundation/contents.json`.

# Daylight Hours Explorer — Conversion Notes (Flash AS1 → Accessible HTML5)

## Behaviour model (one paragraph)

The sim plots **hours of daylight vs. day of year** for an observer at a chosen
latitude, and shows a small 3-D **globe** indicating where the Sun’s light falls
on the selected day. A *latitude* slider (−90…90°, 0.1° steps) and a *day of year*
slider (0…364) drive the model. For each day the Sun’s declination is computed
from a fixed Fourier-style series, and the daylight length from the standard
sunrise hour-angle formula; the yearly curve is drawn across a 500×300 plot with
a draggable red cursor tied to the current day. Two checkboxes toggle a dashed
“yearly average” (12 h) line and the draggable cursor. The globe (blue ocean +
tan continents projected from a stored shoreline table, a 23.5°-tilted red/blue
rotation axis, an equator ring, and yellow *day* / grey *night* arcs along the
observer’s latitude circle, plus a translucent night-shadow) can be dragged to
rotate the viewer’s perspective. Reset returns latitude 41°, day-of-year 121
(“May 2”, 13.9 h), both checkboxes to default, and the globe to its start view.

## Ground truth for behaviour (source files)

- `scripts/Daylight Hours Explorer.as` — main controller (`init`, `reset`, `update`, globe/cursor wiring)
- `scripts/Daylight Hours Plot.as` — `getSunDeclination`, `getDaylightHours`, curve `update`, month/event tables
- `scripts/DoyCursor.as`, `scripts/Doy Cursor Dot.as` — cursor geometry + drag
- `scripts/CelestialSphere.as` + `2 CS Getter Setter.as`, `3 CS Geometry.as`, `4 CS Mouse.as`, `5 CS Horizon Plane.as`, `6 CS Shading.as`, `7 CS Objects.as`, `8 CS Circles.as`, `9 CS Lines.as` — the 3-D sphere engine (matrices, projection, circle/line drawing, drag)
- `scripts/Globe Component v2.as` — globe (continent projection `_shoreData`, axis, shading)
- `scripts/Slider Logic Class v6.as`, `Standard Slider v6.as` — slider value ranges/precision
- `DefineSprite_123.../PlaceObject2_*` init clips — control parameters (latitude −90..90 init 41 prec 1; DOY 0..364 init 0 prec 0; checkbox labels/defaults)

All physics constants, the Fourier declination series, the month/solstice/equinox
tables, and every on-screen string are copied **verbatim** into `simulation.js`.

## Verbatim constants preserved

- `doyOffset = -0.3`; `vernalEquinoxDoy = 78.2440148725013 + doyOffset`
  (and summer/autumnal/winter solstice/equinox constants), used both to place the
  plot and to map the DOY slider (`doy = sliderValue + vernalEquinoxDoy`).
- `getSunDeclination` Fourier coefficients and `getDaylightHours` hour-angle math,
  including the polar `isNaN` → 0 h / 24 h branches and the `|dec|<1e-6 → 12 h` case.
- Plot geometry 500×300, month table, hour ticks `[0,6,12,18,24]`, and the
  special-case rectangular fills at latitude exactly ±90.
- Colours are taken from the AS decimal-RGB values (e.g. plot fill `0xF0F0C0`,
  curve `0x404040`, background `0xB0B0B0`, average `0x6060FF`, cursor `0xFF5050`,
  day arc `0xFAFA80`, night arc `0x989898`, equator `0x309030`; globe water
  `#bcc8f5→#728aeb`, land `#b79562→#86683e` from `shapes/6.svg`, `shapes/8.svg`).

## AS → HTML5 mapping

| ActionScript idiom | HTML5 port |
|---|---|
| `Object.registerClass` prototype classes | plain JS classes (`CelestialSphere`, `CSCircle`, `Globe`) |
| `onEnterFrame` / `getTimer()` | not needed — sim is event-driven (no continuous animation); redraw on input |
| `createEmptyMovieClip`/`lineTo`/`curveTo`/`beginFill` | canvas 2-D drawing with identical coordinates |
| sphere matrices `doA`/`doM`/`doB`, `CtoSz`, `WtoSz` | ported verbatim |
| circle drawing (`8 CS Circles` `drawArc`, front/back split) | `CSCircle.frontArcs()` + `draw()` (only the visible near-hemisphere arcs are stroked over the opaque globe) |
| `Globe Component v2` `updateGlobe`/`updateAxis`/`updateShading` | `Globe.drawLand()` / `drawAxis()` / `drawShading()` |
| `_shoreData` continent table | copied verbatim as `SHORE_DATA` |
| simple-drag (`4 CS Mouse` `startSimpleDragging`) | pointer drag on the globe canvas, same `Δθ = −Δx/r`, `Δφ = +Δy/r` |
| DoyCursor drag (`Doy Cursor Dot.onMouseMoveFunc`) | pointer drag on the plot canvas, same offset + `mod plotWidth` wrap |
| `toFixed` polyfill | native `Number.toFixed` (identical rounding/format) |
| `FUIComponent` sliders / `FCheckBox` | native `<input type="range">` / `<input type="checkbox">` |
| Flash masthead / About / Help / Reset | KL-UNL `<kl-unl-masthead>` + `sim-reset` event |

### Globe scale derivation
`Globe Component v2` draws the continents at radius ~50 inside a `globeMC` that is
scaled to `2·r·size = 170%`. The two factors collapse:
`(50/r)·(2·r·size/100) = 1` for `r = 85, size = 1`, so `Globe.screenCoeffs()`
uses the bare `b·q` products (sphere-screen radius 85) and the limb-wrap radius is
`1.5·50·1.7 = 127.5`. This keeps the drawing in one coordinate system without
changing any physics/geometry.

## Deviations from the original (recorded per the prompt priority order)

1. **Globe rotation-axis colour.** The AS sets the North-pole axis red (`0xFF0000`)
   and South-pole axis blue (`0x0000FF`); the provided screenshot renders them
   dark/near-black at small size. The source constants are followed (red/blue).
2. **DOY slider “hold-to-scrub” auto-advance.** The Flash slider *track* auto-
   advances the day while held (`continuousChangeRate` on `onEnterFrame`). The
   native `<input type="range">` gives full, accessible click/drag/keyboard control
   instead; the underlying day→physics mapping is unchanged. No functional/teaching
   difference — only the “press-and-hold-the-track animates” gesture is dropped
   (it was a UI affordance, not part of the model). No long-running motion remains,
   so no Pause control is required.
3. **Plot axis labels moved to HTML.** In Flash the axis numbers/month names/event
   labels are drawn on the stage. Here they are HTML overlays positioned over the
   canvas so they zoom, reflow, and are screen-reader reachable (WCAG 1.4.4/1.4.10);
   tick marks and the curve remain on the canvas. Positions use the same coordinate
   mapping, so they stay aligned at any size.
4. **Layout.** Follows the KL-UNL foundation classes and the screenshot’s grouping
   (wide plot on the left; Settings + Globe stacked on the right), collapsing to a
   single stacked column below the foundation’s 56 rem breakpoint. This is panel
   structure / reading order, not the original pixel coordinates (Goal B > Goal C).

## `foundation/contents.json` — necessary validity fix (please read)

The shared `foundation/contents.json` provided with the source is **not valid
JSON**: several unrelated entries contain raw newline/tab characters inside string
values (e.g. `ce_hc`, `eclipsingbinarysim`) and unescaped `"` inside HTML `href`
attributes (e.g. `renaissancePtolemaic`, `filters`). Because the masthead calls
`response.json()` (a strict parser), the invalid file makes the masthead fail to
load for **every** sim, not just this one.

To ship a working sim, the copied `html5/foundation/contents.json` is a **valid
per-sim copy** containing the `newSim` template and this sim’s
`daylighthoursexplorer` entry (title, version, Help, About) **copied verbatim**
from the source file. The masthead only reads `data["daylighthoursexplorer"]`, so
this is sufficient and functionally complete.

**When integrating into the real (valid) shared pipeline file**, add only this
entry, in alphabetical order (it is unchanged from the source):

```json
"daylighthoursexplorer": {
  "meta": { "title": "Daylight Hours Explorer", "version": "2.0" },
  "masthead": {
    "help":  { "title": "Help and Instructions", "content": "<p>This graph shows the hours of daylight received during the year for an observer at a given latitude. This is an important factor contributing to the seasons.</p><p>Use the latitude and day of year sliders in the Settings panel to make changes to the plot. The globe shows where the Sun's light is directed on the specified day.</p><p>You can drag the globe to change the perspective.</p><p>The precise dates of the equinoxes and solstices vary from year to year. For the next few decades the most common dates will be March 20, June 21, September 22, and December 21.</p>" },
    "about": { "title": "About this Explorer", "content": "<p>For additional astronomy education materials please visit <a href=\"https://astro.unl.edu/\">Astronomy Education</a> at the University of Nebraska-Lincoln.</p><p>This explorer has been modernized by the AAS Applet Task Force to meet modern web accessibility standards (WCAG 2.1 AA).</p><p>Initial funding for this work was provided by NSF grants #0231270 and/or #0404988.</p><p>Permission is granted to use these files for noncommercial purposes as long as they remain unmodified.</p>" }
  }
}
```

The other foundation files (`kl-unl-masthead.js`, `kl-unl.css`, `kl-unl.js`) are
copied **byte-for-byte unchanged**.

## Assets

This sim reuses **no exported bitmaps**; the globe ocean/continents are code-drawn
(the `shapes/6.svg`/`8.svg` were only radial-gradient discs, whose colours are
reproduced). Fonts are the system sans-serif stack (the embedded `*_Verdana.ttf`
were the generic Verdana face). Hence `html5/assets/` is empty.

## MathJax

Rules 8 / 8a require MathJax for mathematics. **This sim contains no equations,
variables, subscripts/superscripts, Greek letters, or LaTeX expressions** — only
plain integers, decimals, and the degree symbol as a unit. No local MathJax file
is provided in `foundation/` and CDNs are disallowed (rule 5), so MathJax is not
loaded; `klunlInitEqn()` is redefined as a no-op. The degree symbol and all
quantities are presented as text, with units spoken in full for screen readers
(see ACCESSIBILITY.md). If a MathJax build is later added to the foundation and
any real notation is introduced, route it through `klunlShowEquation`.

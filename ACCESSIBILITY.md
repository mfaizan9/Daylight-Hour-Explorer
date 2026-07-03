# Daylight Hours Explorer — Accessibility Notes (WCAG 2.1 AA target)

Human screen-reader QA on real hardware (NVDA + Chrome/Firefox on Windows,
VoiceOver + Safari on macOS/iOS) is still required; this documents what was built in.

## Structure & landmarks
- Single `<h1>` is provided by the `<kl-unl-masthead>` component (the sim does not
  add a competing `h1`). Panels use `<h2>` headings (`Hours of Daylight…`,
  `Settings`, `Globe`) in a non-skipping order.
- `<main>` wraps the layout; each panel is a `<section aria-labelledby=…>`.
- A skip link (“Skip to simulation”) targets the plot heading.
- `<html lang="en">`.

## Text alternatives (1.1.1)
- Both canvases have `role="img"` with an `aria-label` pointing at the live status
  region for their current-state description.
- The **globe caption** (“an observer at a latitude of 41.0° N will receive 13.9
  hours of daylight on May 2”) is real HTML text, always in sync with the model,
  giving an audio-only user the same summary a sighted user sees.
- Plot axis numbers, month names, event labels and the two cursor read-outs (day
  and hours) are **HTML** (not painted on the canvas), so they are reachable and
  zoom with the page. Decorative canvas graphics are otherwise summarised by the
  live region.

## Colour & contrast (1.4.1 / 1.4.3 / 1.4.11)
- Palette uses the KL-UNL CSS custom properties; body/label text is dark on light
  (≥ 4.5:1). Panel headings use a subtle bar, not colour-only meaning.
- **No state is encoded by colour alone.** The daylight length is always given as a
  number + unit (cursor tab, caption, live region); the globe’s day/night arcs are
  supplementary to the numeric read-out.

## Keyboard (2.1.1 / 2.1.2 / 2.4.7)
- **Latitude** and **Day of year** are native `<input type="range">` sliders:
  Left/Down decrement, Right/Up increment, Page keys for larger steps, Home/End for
  min/max — all free and reliable, and Tab always moves away (no traps).
- Latitude also has an editable text field (mirrors the Flash editable field);
  Enter commits.
- The date can also be set with labelled **Month** and **Day** native `<select>`
  dropdowns (fully keyboard-operable); the day list clamps to the month’s length,
  and the dropdowns, the slider, and the draggable plot point all stay in sync via
  the single state object.
- The **globe** is focusable (`tabindex="0"`) and rotatable with the arrow keys
  (Shift = larger step) — the keyboard equivalent of the pointer drag; both paths
  mutate the same state.
- The **draggable plot point** is fully operable without the mouse via the Day-of-
  year slider (identical result). Visible focus rings come from `kl-unl.css`
  `:focus-visible`; the globe adds its own focus outline.

## Screen-reader narration (NVDA + VoiceOver)
- An `aria-live="polite"` `.sr-only` region announces **committed** changes (on
  slider `change`/drag end, checkbox toggle, globe rotate, reset) — not on every
  tick — e.g. *“Latitude 41.0 degrees north. Day May 2. 13.9 hours of daylight.”*
- **Units are always spoken with numbers.** Sliders set `aria-valuetext` to the full
  spoken value, with units as words:
  - latitude → “latitude 41.0 degrees north” / “… degrees south” / “0.0 degrees”
  - day of year → “day of year May 2, 13.9 hours of daylight”
  The degree glyph is shown visually but spoken as “degrees”; “hours” is spoken in
  full. No bare numbers are exposed as a control’s value.
- The globe caption and the live region keep the same wording as the on-screen text.

## Timing / motion (2.2.2 / 2.3.3)
- There is **no continuous animation** (the sim is event-driven), so nothing runs
  > 5 s and nothing flashes; no Pause control is needed. `prefers-reduced-motion`
  therefore has nothing to suppress. Reset is provided by the masthead
  (`sim-reset`), not a second button.

## Zoom & responsiveness (1.4.4 / 1.4.10)
- Base body text is 1.125 rem; sizing is in rem/em, so text scales with the browser
  font setting. Canvas labels live in HTML and zoom (they use container-query units
  so they also track the plot’s on-screen width).
- Layout reflows from desktop (plot left, Settings/Globe right) to a single stacked
  column below 56 rem down to phone portrait, with no horizontal scrolling and 44 px
  minimum touch targets. Verified usable at 200% zoom.

## Cross-browser / touch
- Standards-only HTML/CSS/JS; Pointer Events power both mouse and touch on one path.
  Draggable canvases set `touch-action: none` so dragging doesn’t scroll the page.
  No hover-only affordances; no Chrome-only APIs or prefix-only CSS.

## Known limitations / QA still needed
- The canvas globe is a rich graphic; its *content* is summarised in text/caption
  but the fine geometry (continent shapes, terminator) is not individually
  described — acceptable, as the pedagogical quantity (daylight hours) is fully in
  text.
- Real AT testing on hardware is still required to confirm announcement order and
  that nothing is duplicated or truncated.

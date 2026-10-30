# Handoff: mobile animation jank (Android Chrome)

Status: **fixed (2026-10-30), user confirms it's smooth on the phone.** A small residual cost remains (see [What's left](#whats-left)). Not tied to a request; it came out of feedback 03.

This will regress. Any change that touches every card at the start or end of an animation can bring it back, and desktop won't show it. Read [Rules](#rules-to-keep-it-from-coming-back) before changing drag, hint or board-level classes, and use the [runbook](#runbook-measuring-on-the-phone) to check on a real phone.

## Symptom

On Android Chrome, motion was jerky **only while a CSS transition was running**. Once every transition had finished, dragging was silky smooth. Desktop (Edge) was fine.

- Press and hold a card: during the lift the card hardly moved and lagged until the lift ended.
- A short tap: the card jerked up, then jerked back down.
- Releasing a drag (card flies home or onto a pile): the same jerkiness for the length of the move.

## Cause

Feedback 03 asked for a `grabbing` cursor while dragging. `drag.ts` added `.grabbing` to `#board` on press and removed it on release, and `app.css` has:

```css
.board.grabbing, .board.grabbing .card { cursor: grabbing; }
```

Toggling that class restyles **all 52 cards and their subtrees**. In Chrome on Android that wasn't just a style change: every card layer (~58) was re-recorded on the main thread and then re-rasterized on the GPU, roughly 120 card tiles and ~300 ms of GPU raster. That happened exactly when the lift (JS, rAF-driven, so it stalls with the main thread) and the release transition (it can't start until the commit lands) began. The drag itself caused no repaints, which is why it was smooth once the transitions finished.

You'd expect a cursor change not to repaint anything. Chrome repainted anyway, so don't assume a property is "free" because it doesn't affect the picture. Measure.

## Fix

`drag.ts` only adds `grabbing` when `e.pointerType !== 'touch'` (touch has no cursor). Desktop behaviour is unchanged. Desktop still pays the restyle but has the headroom.

Measured with `tools/android-perf/ab.mjs`-style runs (simulated touch hold 700 ms + release in place). Device: Android 10, Chrome 156, 120 Hz, DPR 2.34, skin `classic-altered`, `?motion=full`:

| Variant | Longest main task | Raster tiles | GPU raster | Dropped frames |
| --- | --- | --- | --- | --- |
| Before (3 runs) | 72–153 ms | 123–124 | 281–301 ms | 36–52 |
| `.grabbing` rules deleted live (2 runs) | 23 ms | 26 | 113–116 ms | 4–5 |
| Fix: no `grabbing` for touch (2 runs) | 19–21 ms | 24–26 | 118–121 ms | 8–10 |

The manual traces that led here are in this folder (`trace-tap.json`, `trace-hold.json`, `trace-move.json`, git-ignored, ~116 MB). They were recorded with paint snapshots on, so their main-thread times are inflated; the layer and raster counts are fine.

## Rules to keep it from coming back

- **Don't toggle a class or style on `#board` (or any ancestor of the cards) during a gesture or animation** if a selector under it matches `.card` or its children. One class on the board means 52 cards restyled, and on Android that can mean all of them repainted and re-rasterized.
- **Touch only what changes.** Per-card changes (`.dragging`, `.hint` on one card, inline `transform`) are fine; a loop that writes to every card is suspect. `renderer.hint()` toggles all cards but `classList.toggle` with an unchanged value is a no-op, so that one is fine as is.
- **Cards are expensive to raster.** Every glyph is a CSS `mask` image; a re-raster of the whole table is ~100+ ms of GPU time on a mid-range phone. Anything that invalidates many cards at once will show.
- **Desktop is not a test.** It hid this completely. Check gesture or animation changes on the phone with the runbook below.

## Runbook: measuring on the phone

### Connect

1. Phone: Developer options → USB debugging on, USB cable in.
2. `adb devices` must say `device`. `unauthorized` means the phone is waiting for the *Allow USB debugging?* prompt; unlock it and tap Allow. If no prompt shows: Developer options → *Revoke USB debugging authorizations*, toggle USB debugging, replug. The *USB preferences* mode (file transfer etc.) doesn't matter.
3. `npm run dev` (listens on the LAN) and open the game in Chrome on the phone, e.g. `http://<pc-ip>:5173/?motion=full`. Keep the screen on (Developer options → *Stay awake*).
4. `adb forward tcp:9222 localabstract:chrome_devtools_remote`. Needed again after the phone reconnects.

### Measure

- **`node tools/android-perf/ab.mjs base -grabbing --runs 2`**: no hands needed. Per variant it reloads the game, applies the variant, simulates a touch hold + release on a top card, traces it and prints longest main task, raster tiles, GPU raster ms and dropped frames. Variants: `base`, `-<text>` (delete CSS rules whose selector contains `<text>`), `js:<expr>` (run JS in the page first). This is the fastest way to test a hypothesis before changing code. Note: the dev server reloads the phone page on a source change, but only after a few seconds. Check the change is live before trusting a run.
- **`node tools/android-perf/record.mjs <name> [--paint]`**: for a gesture by hand (real drags, moves onto piles). Press Enter to stop. Writes `traces/<name>.json` (git-ignored); open it in the DevTools Performance panel or analyse it with a script. `--paint` adds paint/layer snapshots for the layer and paint-profiler views, but don't trust its main-thread times.

### Gotchas we hit

- **Remote DevTools' *Save trace* silently does nothing** when the phone's Chrome is newer than desktop Chrome (*"Remote browser is newer than client browser"* on `chrome://inspect`). That's why the scripts trace over CDP themselves.
- **`/json/list` on Android leaves tabs out.** The game tab was missing while `chrome://inspect` showed it. The scripts find it through `Target.getTargets` on the browser endpoint instead.
- **Paint snapshots (`disabled-by-default-devtools.timeline.picture`, DevTools' *Enable advanced paint instrumentation*) distort timing.** They serialize every re-recorded display list, decoded images included, into the trace. One commit showed 385 ms "updating" an empty pile slot.
- **`UpdateLayer` runs for every layer on every commit** in a lean trace, so counting it says nothing. Count `RasterDecoderImpl::DoEndRasterCHROMIUM` (GPU raster per tile) and look at long `CrRendererMain` tasks instead. `PipelineReporter` events with `affects_smoothness` give presented/dropped frames.

## What's left

After the fix, a hold + release still costs ~25 raster tiles, ~120 ms of GPU raster and 5–10 dropped frames. That's about one card's worth of work. The user finds it smooth now, so this is optional. Suspects, untested, each testable with `ab.mjs`:

1. **Shadow `::before` animating inside the card.** An animating `::before` under `.face` may force the face onto its own layer for the length of the animation, re-rasterizing it at start and end. Test: `-dragging::before` (not `-::before`, that also deletes the glyph masks).
2. **Hint highlight.** On press, `renderer.hint()` sets `.hint` on the matching card: `.face` transitions `background-color` + `box-shadow` (and `.face.has-bg::after` opacity), repainting that card every frame for 120 ms. Test: `-hint`.
3. **Drag scale.** The dragged card is drawn at `DRAG_SCALE`, so it is re-rastered at the new scale on lift and again on release.
4. **Main-thread work on release.** `commit()` persists to `localStorage` and the cascade offer forces a layout (`offsetWidth`). Small in the traces so far.

Likely fixes: make the shadow a sibling element (or give `.face` a permanent layer); make the hint an always-present overlay that only animates opacity; drop the scale or snap it so the raster can be reused.

## Tried before the cause was found

None of these fixed the jank, because the cost was in all the other cards, not in the one being animated. They're still in the code and harmless:

| Change | Where |
| --- | --- |
| Positions snapped to device pixels (fixed blur on desktop during the lift) | `snap()` in `src/ui/renderer.ts` |
| Lift shadow animates `transform` + `opacity` instead of `box-shadow` | `.card::before` in `src/styles/app.css` |
| `will-change: transform` on every card | `.card` in `src/styles/app.css` |
| Touch lift eased in JS over 160 ms instead of jumping | `liftOf()` in `src/ui/drag.ts` |

# Handoff: mobile animation jank (Android Chrome)

Status: **open, needs remote debugging on a real device.** Not tied to a request; it comes out of feedback 03 and the follow-up testing.

## Symptom

On Android Chrome, motion is jerky **only while a CSS transition is running**. Once every transition has finished, dragging is silky smooth. Seen with `?motion=full`.

- Press and hold a card: during the lift the card hardly moves and lags until the lift animation ends, then tracking is smooth.
- A short tap: the card jerks up, then jerks back down.
- Releasing a drag (card flies home or onto a pile): same jerkiness for the length of the move.
- Desktop (Edge) is fine.

## Already tried (in the code now)

| Change | Where | Result |
| --- | --- | --- |
| Positions snapped to device pixels | `snap()` in `src/ui/renderer.ts` | Fixed blur on desktop during the lift; no effect on the jank |
| Lift shadow animates `transform` + `opacity` instead of `box-shadow` | `.card::before` in `src/styles/app.css` | Compositor-only on paper; jank remains |
| `will-change: transform` on every card | `.card` in `src/styles/app.css` | Meant to avoid layer promotion on the first animated frame; jank remains |
| Touch lift eased in JS over 160 ms instead of jumping | `liftOf()` in `src/ui/drag.ts` | Smoother intent; jank remains |

## Suspects (unproven)

1. **Shadow `::before` animating inside the card.** An animating `::before` under `.face` may force the face onto its own layer (overlap) for the length of the animation, re-rasterizing it at start and end. Fits "jerky during, smooth after".
2. **Hint highlight.** On press, `renderer.hint()` toggles `.hint` on the matching card: `.face` transitions `background-color` + `box-shadow` (and `.face.has-bg::after` opacity), which repaints that card every frame for 120 ms.
3. **Raster cost of CSS masks.** Every rank, pip and art glyph is a `mask` image (`.g.ink::before`). Slow to rasterize on Android GPUs, so any repaint or re-layerization is expensive. Skin-dependent: heavier art, worse.
4. **Main-thread work on release.** `commit()` persists to `localStorage`, `hint(null)` touches all 56 cards, and the cascade offer forces a layout (`offsetWidth`). Probably small, but it shows up in a trace if not.

## What to test

### Setup

1. Phone: Developer options → USB debugging on, connect via USB.
2. PC: `adb devices` should list the phone. Run `npm run dev` (it listens on the LAN) or `npm run build && npm run preview -- --host`, and open the game on the phone.
3. Desktop Chrome/Edge: `chrome://inspect` / `edge://inspect` → **inspect** the game tab.

### 1. A/B without tools (fast)

Note smooth / jerky for each:

- [ ] `?motion=reduced`. If smooth, transitions are definitely the trigger.
- [ ] `?motion=full&skin=classic` vs. the other skins. If classic is smoother, raster cost (suspect 3) matters.
- [ ] Dev server vs. `preview` build. Should be equal; rules it out.

### 2. Rendering overlays

Remote DevTools → Ctrl+Shift+P → *Show Rendering*:

- [ ] **Paint flashing**: do cards flash green on press / tap / release? Which ones (only the hinted card, the dragged card, all)?
- [ ] **Layer borders**: do borders appear or disappear when an animation starts or ends?
- [ ] **Frame rendering stats**: FPS and dropped frames during the jerk.

### 3. Performance trace (most useful)

Performance panel → gear → enable *Screenshots* and *Enable advanced paint instrumentation*. Record:

1. A quick tap on a tableau card.
2. One drag and release back to the same place (restore animation).
3. One move onto a foundation.

Stop and **Save profile** (`.json`). Put it in this folder (e.g. `trace-android-1.json`) or anywhere and hand over the path. In the trace, look at the frames during the transitions: long *Rasterize Paint*, *Paint*, *Layerize* / *Update Layer Tree* or *Recalculate Style* tasks point to the matching suspect above.

## Likely fixes per outcome

- **Re-raster on layer changes (suspect 1):** make the shadow a sibling element instead of a pseudo-element under the face, or give `.face` its own permanent layer (`will-change: transform`) so nothing changes when the shadow animates.
- **Hint repaint (suspect 2):** drop the `.face` colour transitions; switch the hint to an opacity-animated overlay (like `.face.has-bg::after`) that is always present.
- **Mask raster cost (suspect 3):** bake skin glyphs into per-card bitmaps (canvas → image) at load time, so a card is one image instead of many masks.
- **Main thread (suspect 4):** defer `persist()` and the cascade offer to `requestIdleCallback` / after the transition.

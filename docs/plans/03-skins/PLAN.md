# Plan: 03-skins

Hand-drawn skins: PNG (or SVG/WebP) assets that replace card faces and table chrome. There can be several skins, and every skin falls back to another for anything it doesn't draw. The current glyph look is exported as the first skin, `classic`, which becomes both the default and the base of every other skin.

Authoring guide (draft, moves to `skins/README.md` during implementation): [`README.md`](README.md).

## 1. Assumptions

Correct these if any are wrong.

- **Filenames use rank labels and suit names**: `10-hearts.png`, not `TH.png`. Labels must be unique within a deck (asserted).
- **Skins are deck-agnostic.** Ranks and suits resolve by name, so a future deck with extra ranks gets the fallbacks automatically.
- **The index (corner) position stays in CSS.** Only its glyphs are skinnable. Moving the index is out of scope, because compact fans depend on it.
- **No card backs.** Every card is dealt face up, so `card/back.png` is reserved but not rendered.

## 2. Folder layout and discovery

```
skins/
  skins.json            which skins are enabled, their order, the default
  README.md             authoring guide
  classic/              exported from today's glyph faces; root of every chain
    skin.json
    index/  pips/  center/  card/  table/  ui/
  <your-skin>/
    skin.json
    ...only the files you draw
```

- **Discovery**: `import.meta.glob('/skins/*/**/*.{png,webp,svg}', { query: '?url' })` finds the asset files at build time. There's no hand-maintained file list and no 404 probing at runtime. The glob is lazy, so only the active skin chain's files get fetched. Manifests (`skin.json`, `skins.json`) are globbed eagerly, since they're tiny.
- **`skins.json`**: a registry isn't needed to *find* skins, since the glob does that. It's still useful for the default, the order in a picker, and keeping work-in-progress folders out of the game:
  ```json
  { "default": "classic", "skins": ["classic", "inkwell"] }
  ```
  A folder that isn't listed gets a dev-mode warning and is ignored.
- **Selection**: a `?skin=<id>` URL parameter wins, then the saved setting, then `default`. The setting goes in its own localStorage key (`solitaire.settings`), so the game save schema needs no migration.

## 3. Resolution

### Inheritance

`skin.json` may declare `"extends": "<id>"`. It defaults to `classic` for every skin except `classic` itself. Lookups walk the chain from child to parent. Cycles and unknown parents are load errors, and the game then falls back to `classic`.

Every lookup below walks the whole chain, and each one does so independently. For example, a skin with only new pip images reuses the parent's pip *layouts* with its own pip *images*.

### Card assets

For card `rank r` of `suit s`, first hit wins:

| Slot | Chain (per skin, child → parent) |
|---|---|
| Index rank | `index/{r}-{s}` → `index/{r}` |
| Index suit | `index/{s}` |
| Centre | `center/{r}-{s}` → `center/{r}` → `pips.layouts[r]` from skin.json → *built-in*: one large pip |
| Pip image | `pips/{s}` → `index/{s}` |
| Card background | `card/background-{s}` → `card/background` → `--card-bg` colour |

The centre chain is resolved per skin before moving to the parent. A child's layout for `7` therefore beats a parent's `center/7-clubs.png`, which is what a reskin normally wants.

### Ink and paint layers

Each asset name can exist as two files, and either or both may be present:

- `name.ink.png`: **tinted**. Only its alpha is used, as a CSS mask filled with the suit colour (`currentColor` of `.face`), so the colour is exact and follows `--suit-*`.
- `name.png`: **painted**, rendered as-is on top of the ink layer.

So a single-colour index glyph is `A.ink.png`, a full-colour court card is `K-hearts.png`, and a court card with suit-coloured linework plus painted detail is both files. The `.ink` suffix only applies to card assets; table/UI assets are always painted.

### Validation

- **Unknown files**: in dev, every file in a skin folder that no lookup can ever hit (e.g. `center/7-club.png`) is listed in a console warning. That catches typos.
- **Unit tests**: one test loads every skin in `skins/` and checks that its manifest parses, its chain resolves and it has no unknown files. The resolver itself is a pure function and is tested on its own.

## 4. skin.json

```jsonc
{
  "name": "Inkwell",
  "extends": "classic",               // optional; default "classic"
  "colors": {                         // optional; overrides theme.css tokens (no leading --)
    "suit-hearts": "#a33",
    "card-bg": "#f2ead8"
  },
  "center": {
    "box": { "x": 0.22, "y": 0.12, "w": 0.56, "h": 0.76 },        // card-relative, 0..1 on both axes
    "narrowBox": { "x": 0.08, "y": 0.26, "w": 0.84, "h": 0.70 }   // phones: no bottom index
  },
  "pips": {
    "size": 0.2,                      // pip height as a fraction of card width
    "flip": "auto",                   // "auto": pips below the middle are upside down; "none"
    "narrow": "single",               // phones: "single" big pip, or "layout"
    "layouts": {
      "2": [[0.5, 0], [0.5, 1]],
      "3": [[0.5, 0], [0.5, 0.5], [0.5, 1]],
      "A": [[0.5, 0.5, { "scale": 2.5 }]]
    }
  },
  "table": { "felt": "cover" },       // "cover" | "tile"
  "ui": {
    "button": { "slice": 12 },        // 9-slice insets in source px
    "panel": { "slice": 24 }
  }
}
```

- Every field is optional, and objects merge key by key down the chain. `layouts` merges **per rank**, so overriding `7` keeps the parent's `2`–`6`.
- **Layout points** are pip *centres*, relative to the centre box (`[0,0]` is the box's top-left). The optional third element overrides `flip` and/or `scale` for one pip.
- The manifest is validated with a hand-written type guard, without pulling in a schema library. Errors name the file and the key path.

## 5. Rendering

- **`skinFaces: CardFaceRenderer`** replaces `generatedFaces` in [faces.ts](../../../src/ui/faces.ts). It keeps the existing `.face > .idx / .pip / .idx.br` structure, so `.compact`, narrow mode, hint, nope and celebrate keep working unchanged. Text is swapped for glyph elements:
  ```html
  <i class="g" style="--ink:url(…); --paint:url(…); --ar:0.62"></i>
  ```
  `::before` draws the ink (mask + `background-color: currentColor`) and `::after` draws the paint layer.
- **Glyph sizing**: CSS sets the height (the existing `0.21·cw` / `0.24·cw` compact sizes and so on). The width comes from `--ar`, the image's aspect ratio measured at preload. A wide `10` and a narrow `1` both fit without fixed boxes, so artists only care about height.
- **Centre**: `.center` is positioned from `box` (or `narrowBox` when `data-mode="narrow"`, via two sets of CSS vars). Art fills it with `contain`. Pips are absolutely placed children. In narrow mode, a pip layout collapses to the single-pip fallback unless `pips.narrow` is `"layout"`. A 40px phone card with 10 pips would be unreadable.
- **Card background image**: when one is present, the hint state can't swap `background-color`. It becomes a `::after` overlay using `--card-hint-bg` at partial opacity, and the ring is unchanged. Corners are clipped by the existing `.face { overflow: hidden; border-radius }`.
- **Preload before the first paint**: resolve all 56 face specs, then `img.decode()` every URL the chain actually uses (≈40–80 small images) before the first deal. A skin never pops in mid-animation. If loading fails, fall back to `classic`, and if that fails too, to the CSS-only look.
- **Switching skins at runtime**: a new `Renderer.setFaces(faces)` replaces each card element's `.face` child in place. Card elements, positions and transforms are untouched, so no relayout or animation glitch.
- **Table/UI**: skin colours and asset URLs are set as custom properties on `:root` (`--skin-felt`, `--skin-slot`, …). [app.css](../../../src/styles/app.css) uses them under `[data-skin]` selectors: felt background, slot images (`slot`, `slot-stock`), and `border-image` for the button and win panel.

Code lives in `src/ui/skin/`: `manifest.ts` (types + validation), `resolve.ts` (pure chain resolution, tested), `load.ts` (glob, preload, apply vars) and `faces.ts` (the renderer).

## 6. Exporting classic

The goal is that today's look is reproduced through the new pipeline, giving you a complete, working example to copy from.

- **Tool**: a dev-only page, `tools/export-classic.html`, served by Vite (left out of the build). It draws each glyph to a canvas at 3× the largest card (360 px card width), with the same font stack and weights as `app.css`. It trims horizontal transparency and writes straight into `skins/classic/` via the File System Access API (Chrome/Edge, one folder-picker prompt). That's no new dependency. Playwright was rejected as a heavy dependency for a one-off.
- **Output** (all `.ink.png`, so the suit colours stay in CSS):
  - `index/{A,2…10,J,Q,K,E}.ink.png`: 14 rank glyphs, about 96 px tall.
  - `index/{spades,hearts,diamonds,clubs}.ink.png`: 4 suit glyphs.
  - `center/{J,Q,K,E}-{suit}.ink.png`: the current court centre (large letter over a suit glyph) as 16 combined images. This is also the worked example of rank-suit-specific art.
  - `skin.json` with `colors` copied from [theme.css](../../../src/styles/theme.css) and no `layouts`, so A–10 fall through to the single big pip, exactly as now.
- **Parity check**: compare old and new side by side on desktop and on a phone-width viewport (normal, compact fan and narrow). After that, `generatedFaces` is deleted and `skinFaces` is the only face path.
- The exported glyphs freeze today's Windows rendering of `system-ui` / Segoe UI Symbol. That's a side benefit, since the faces now look the same on every device.

## 7. Phases

1. **Manifest + resolver**: types, validation, chain resolution, `skins.json`, unknown-file warnings, tests.
2. **Skinned faces**: glyph elements with ink/paint, aspect-ratio sizing, centre box, pip layouts, narrow behaviour, preload. Built against a hand-made two-file test skin.
3. **Export classic**: export tool, generate `skins/classic`, parity check, remove `generatedFaces`.
4. **Table/UI assets**: felt, slots, button/panel 9-slice, card backgrounds, hint overlay.
5. **Multiple skins**: `?skin=`, settings key, `Renderer.setFaces`. No picker UI; that comes later, and `setFaces` is already enough for one.
6. **Standard pip layouts**: add the classic A–10 layouts to `skins/classic/skin.json`. This is the first *visible* change, and it's done after the parity check so it's reviewed on its own. Every skin inherits it.
7. **Docs + templates**: move [`README.md`](README.md) to `skins/README.md`. The export tool also writes `skins/_templates/`: transparent PNGs at the right sizes with a guide overlay (corner radius, index area, compact-fan visible strip `0.12–0.43·cw`, centre box).

## 8. Open questions

- **Index placement per skin** (§1) is deliberately left out. Say so if hand-drawn skins need it, for example a different corner inset.

# Skins

A skin is a folder of images plus a `skin.json`. You only draw what you want to change. Everything else comes from the skin you extend, which is `classic` unless you say otherwise.

## Quick start

1. Create `skins/<your-skin>/skin.json`:
   ```json
   { "name": "My skin" }
   ```
2. Add `"<your-skin>"` to the `skins` list in `skins/skins.json`.
3. Drop images into the folder (see below).
4. Run `npm run dev` and open:
   - `http://localhost:5173/tools/gallery.html?skin=<your-skin>` to see every card at desktop and phone size;
   - `http://localhost:5173/?skin=<your-skin>` to play with it. The game remembers the last skin you picked this way.

The browser console lists any file the game doesn't recognise (usually a typo in the name) and any mistake in `skin.json`. `npm test` checks every skin listed in `skins.json` too.

## Names

Suits: `spades` `hearts` `diamonds` `clubs`

Ranks: `A` `2` `3` `4` `5` `6` `7` `8` `9` `10` `J` `Q` `K` `E`

Formats: `.png`, `.webp` or `.svg`.

## Ink or paint

Every card image can be saved in two ways, and you can use both at once:

| File | What happens |
|---|---|
| `name.ink.png` | Only the shape is used. It's filled with the suit colour from `skin.json`, so draw it in any single colour on a transparent background. |
| `name.png` | Shown exactly as drawn, in full colour. |

If both exist, the paint layer goes on top of the ink layer. Use this for suit-coloured linework with painted detail. Table and button images are always shown as drawn.

## All files

Sizes are what to draw at (3× the largest card on screen). Images are scaled to fit, and only the height is fixed: the width can be whatever the shape needs.

### Corner index

The small rank and suit in the corner. In a tightly fanned column, this is all you see of a card, so keep it bold.

| File | Draw at | Notes |
|---|---|---|
| `index/{rank}.ink.png` | 96 px tall | e.g. `index/10.ink.png`. Used for all suits |
| `index/{rank}-{suit}.png` | 96 px tall | Optional: one suit only, e.g. `index/Q-hearts.png` |
| `index/{suit}.ink.png` | 72 px tall | e.g. `index/clubs.ink.png` |

The image's full height fills the slot, so leave the same empty space above and below every glyph (as `classic` does) to keep them lined up.

### Centre of the card

For each card, the game uses the **first** thing it finds:

1. `center/{rank}-{suit}.png`: art for exactly this card
2. `center/{rank}.png`: art for this rank in every suit
3. A pip layout from `skin.json` (see below)
4. One large suit pip

This goes through your skin first, then the skin you extend. So your own pip layout for 7 wins over a `center/7-clubs.png` in `classic`.

Draw centre art at **202 × 383 px** (the default centre box). It's scaled to fit the box, centred. Change the box in `skin.json` if you want art to cover more of the card.

Every card you can give its own art:

| Rank | All suits | Spades | Hearts | Diamonds | Clubs |
|---|---|---|---|---|---|
| A | `center/A` | `center/A-spades` | `center/A-hearts` | `center/A-diamonds` | `center/A-clubs` |
| 2 | `center/2` | `center/2-spades` | `center/2-hearts` | `center/2-diamonds` | `center/2-clubs` |
| 3 | `center/3` | `center/3-spades` | `center/3-hearts` | `center/3-diamonds` | `center/3-clubs` |
| 4 | `center/4` | `center/4-spades` | `center/4-hearts` | `center/4-diamonds` | `center/4-clubs` |
| 5 | `center/5` | `center/5-spades` | `center/5-hearts` | `center/5-diamonds` | `center/5-clubs` |
| 6 | `center/6` | `center/6-spades` | `center/6-hearts` | `center/6-diamonds` | `center/6-clubs` |
| 7 | `center/7` | `center/7-spades` | `center/7-hearts` | `center/7-diamonds` | `center/7-clubs` |
| 8 | `center/8` | `center/8-spades` | `center/8-hearts` | `center/8-diamonds` | `center/8-clubs` |
| 9 | `center/9` | `center/9-spades` | `center/9-hearts` | `center/9-diamonds` | `center/9-clubs` |
| 10 | `center/10` | `center/10-spades` | `center/10-hearts` | `center/10-diamonds` | `center/10-clubs` |
| J | `center/J` | `center/J-spades` | `center/J-hearts` | `center/J-diamonds` | `center/J-clubs` |
| Q | `center/Q` | `center/Q-spades` | `center/Q-hearts` | `center/Q-diamonds` | `center/Q-clubs` |
| K | `center/K` | `center/K-spades` | `center/K-hearts` | `center/K-diamonds` | `center/K-clubs` |
| E | `center/E` | `center/E-spades` | `center/E-hearts` | `center/E-diamonds` | `center/E-clubs` |

Add `.png` or `.ink.png` to each name.

### Pips

The suit symbols placed by a pip layout, and the single large pip.

| File | Draw at | Notes |
|---|---|---|
| `pips/{suit}.ink.png` | 192 px tall | If missing, the corner index suit is used |

### Card

| File | Draw at | Notes |
|---|---|---|
| `card/background.png` | 360 × 504 px (× `card.scale` with a shape) | Card blank. Corners get rounded (or cut to the shape) for you, so fill the whole rectangle |
| `card/background-{suit}.png` | 360 × 504 px | Optional: one suit only |
| `card/shape.png` | 360 × 504 px × `card.scale` | Optional: the card's outline shape, replacing the rounded corners. Only the alpha is used |
| `card/outline.ink.png` | same as the shape, or 360 × 504 px without one | Optional: drawn over the background. Ink is tinted with `card-border`; `outline.png` is shown as drawn |
| `card/outline-{suit}.png` | same | Optional: one suit only |

#### Shaped cards

Without `card/shape.png`, a card is a rounded rectangle in `card-bg` with a thin `card-border` line and a small shadow.

With it, the shape is used instead, for everything that's drawn as "the card": the `card-bg` fill, `card/background`, the lighter fill when a card is hinted, and the shadow under a dragged card. The CSS border line and the small resting shadow are switched off, because they can only follow a rectangle. Draw your own edge in `card/outline` instead. A painted `outline.png` can also carry a soft shadow just outside the shape.

A hand-drawn edge eats into the card: if the wobbles have to stay inside 360 × 504, the card looks smaller than the others. Set `"card": { "scale": 1.1 }` in `skin.json` to let the shape, background and outline reach past the card on every side (here 5% each way). The rank, pips and art stay exactly where they were, and so does the area you can grab. Draw these three images at the larger size (360 × 504 × 1.1 = 396 × 554 px) with the normal card centred in it. Keep the scale small: the extra reaches over neighbouring cards and gaps on the table, and over the top strip of the card above in a fanned column.

### Table and buttons

| File | Draw at | Notes |
|---|---|---|
| `table/felt.png` | ≥ 1920 × 1080, or a tile | Set `"felt": "tile"` in `skin.json` for a repeating tile |
| `table/slot.png` | 360 × 504 px | Empty pile |
| `table/slot-stock.png` | 360 × 504 px | Empty stock pile. Replaces the "Stock" label, so draw your own |
| `ui/button.png` | any, at 3× | Stretched around the text: corners stay, edges stretch (set `slice`) |
| `ui/panel.png` | any, at 3× | The "You won" panel, stretched the same way |

## skin.json

Everything is optional. Anything you leave out comes from the skin you extend. Here's every setting, with what each does (the real file is plain JSON, so leave out the `//` comments):

```jsonc
{
  "name": "My skin",
  "extends": "classic",

  // Any colour from src/styles/theme.css, without the leading --
  "colors": {
    "suit-hearts": "#a33",
    "card-bg": "#f2ead8",
    "felt-center": "#6b8563"
  },

  // Size of card/shape.png (and the background and outline with it) relative to the card. Only used with a shape
  "card": { "scale": 1.1 },

  // Where centre art and pips go: 0..1 of the card's width (x, w) and height (y, h)
  "center": {
    "box": { "x": 0.22, "y": 0.12, "w": 0.56, "h": 0.76 },
    "narrowBox": { "x": 0.08, "y": 0.28, "w": 0.84, "h": 0.64 }   // on phones
  },

  "pips": {
    "size": 0.17,         // pip height, as a fraction of card width
    "flip": "auto",       // pips in the bottom half are upside down; "none" to turn that off
    "narrow": "single",   // on phones: one big pip ("single") or the full layout ("layout")
    "layouts": {
      "2": [[0.5, 0.05], [0.5, 0.95]],
      "3": [[0.5, 0.05], [0.5, 0.5], [0.5, 0.95]],
      "A": [[0.5, 0.5, { "scale": 3 }]]
    }
  },

  "table": { "felt": "cover" },   // "cover" or "tile"
  "ui": {
    "button": { "slice": 12 },    // source px from each edge that must not stretch
    "panel": { "slice": 24 }
  }
}
```

### Pip layouts

Each point is `[x, y]`: the centre of one pip inside the centre box. `[0, 0]` is the top-left of the box and `[1, 1]` the bottom-right. Pips sit centred on their point, so pips at `0` or `1` hang half outside the box.

Add a third element to change one pip: `{ "flip": false }` keeps it upright, and `{ "scale": 2 }` makes it twice as large.

Layouts are per rank. Defining only `"7"` keeps every other rank as it is in the skin you extend. `classic` has the standard layouts for 2–10; see `skins/classic/skin.json`.

On phones, layouts are replaced by one big pip unless `"narrow": "layout"` is set, because ten pips on a 40 px card are unreadable.

## Tips

- **Start from `classic`.** Open `skins/classic/` to see every file in use, and copy what you want to change. Its images are generated from the original text-based faces by `npm run export:classic`, which overwrites them, so put your drawings in your own skin. Its `skin.json` is hand-written.
- **Templates**: `skins/_templates/` has blank images at the right sizes. `card.png` has guides for the rounded corners, the corner index, the strip that stays visible in a tight fan, and the centre box on desktop and on phones. Put them on a layer under your drawing and hide that layer before saving.
- **Check the phone layout too.** The gallery shows both sizes. In the game, use a phone viewport in dev tools and look at a long column: only the top strip of each card shows there.

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

The browser console lists any file the game doesn't recognise (usually a typo in the name) and any mistake in `skin.json`. `npm test` checks that every skin listed in `skins.json` loads (a broken `skin.json` fails it; a stray file doesn't).

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

If both exist, the paint layer goes on top of the ink layer. Use this for suit-coloured linework with painted detail. Ink isn't always the suit colour: the card outline uses `card-border`, empty piles use `slot-border`, and the controls use their text colours (see [Colours](#colours)). The table felt, button and panel can only be painted.

## All files

The sizes are the canvas to draw on: 3× the largest card on screen, so they stay sharp on phones. Images are scaled to fit, and only the height is fixed: the width follows the image, so you can trim a canvas to what the shape needs (or keep it, which leaves the same space around every glyph). `skins/_templates/` has blank canvases for the card images.

You only need a few files to start. Anything missing comes from the skin you extend, and several images stand in for each other:

- the corner index suit and the pips: each uses the other when only one is there;
- the stock's outline (`table/slot-stock`) uses the normal pile outline (`table/slot`);
- the "Stock" label, "Wins", "New deal" and the win count fall back to text.

### Corner index

The small rank and suit in the corner. In a tightly fanned column, this is all you see of a card, so keep it bold.

| File | Draw at | Notes |
|---|---|---|
| `index/{rank}.ink.png` | 96 × 96 px | e.g. `index/10.ink.png`. Used for all suits. Use the same canvas for every rank, `10` included |
| `index/{rank}-{suit}.png` | 96 × 96 px | Optional: one suit only, e.g. `index/Q-hearts.png` |
| `index/{suit}.ink.png` | 72 × 72 px | e.g. `index/clubs.ink.png`. If missing, the pip is used |
| `index/0.ink.png` `index/1.ink.png` | 96 × 96 px | Digits for the win counter, which also uses `2` to `9` (`10` is only for cards; the counter writes 10 as `1` and `0`) |

The image's full height fills the slot, so leave the same empty space above and below every glyph (as `classic` does) to keep them lined up.

### Centre of the card

For each card, the game uses the **first** thing it finds:

1. `center/{rank}-{suit}.png`: art for exactly this card
2. `center/{rank}.png`: art for this rank in every suit
3. A pip layout from `skin.json` (see below)
4. One large suit pip

This goes through your skin first, then the skin you extend. So your own pip layout for 7 wins over a `center/7-clubs.png` in `classic`.

Draw centre art at **202 × 384 px** (the default centre box). It's scaled to fit the box, centred. Change the box in `skin.json` if you want art to cover more of the card.

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
| `pips/{suit}.ink.png` | 192 × 192 px | If missing, the corner index suit is used |

### Card

| File | Draw at | Notes |
|---|---|---|
| `card/background.png` | 360 × 504 px (× `card.scale` with a shape) | Card blank. Corners get rounded (or cut to the shape) for you, so fill the whole rectangle |
| `card/background-{suit}.png` | 360 × 504 px | Optional: one suit only |
| `card/shape.png` | 360 × 504 px × `card.scale` | Optional: the card's outline shape, replacing the rounded corners. Only the alpha is used |
| `card/outline.ink.png` | same as the shape, or 360 × 504 px without one | Optional: drawn over the background. Ink is tinted with `card-border`; `outline.png` is shown as drawn |
| `card/outline-{suit}.png` | same | Optional: one suit only |
| `card/drop.ink.png` / `card/drop.png` | 360 × 504 px × `dropScale` | Optional: shown over the card (or empty pile) a dragged card will land on, instead of the glow. Ink is tinted with `drop-highlight`. It reaches past the card by `card.dropScale` (the same as `card.scale` unless set), so you can draw a glow or a frame around the card |

#### Shaped cards

Without `card/shape.png`, a card is a rounded rectangle in `card-bg` with a thin `card-border` line and a small shadow.

With it, the shape is used instead, for everything that's drawn as "the card": the `card-bg` fill, `card/background`, the lighter fill when a card is hinted, and the shadow under a dragged card. The CSS border line and the small resting shadow are switched off, because they can only follow a rectangle. Draw your own edge in `card/outline` instead. A painted `outline.png` can also carry a soft shadow just outside the shape.

A hand-drawn edge eats into the card: if the wobbles have to stay inside 360 × 504, the card looks smaller than the others. Set `"card": { "scale": 1.1 }` in `skin.json` to let the shape, background and outline reach past the card on every side (here 5% each way). The rank, pips and art stay exactly where they were, and so does the area you can grab. Draw these three images at the larger size (360 × 504 × 1.1 = 396 × 554 px) with the normal card centred in it. Keep the scale small: the extra reaches over neighbouring cards and gaps on the table, and over the top strip of the card above in a fanned column.

### Table

| File | Draw at | Notes |
|---|---|---|
| `table/felt.png` | 1920 × 1080 px, or a tile (e.g. 256 × 256 px) | Set `"felt": "tile"` in `skin.json` for a repeating tile. A tile grows and shrinks with the cards, so it looks the same on a phone as on a desktop (see `tileSize`) |
| `table/slot.ink.png` / `table/slot.png` | 360 × 504 px (× `slotScale`) | Empty pile. Ink is tinted with `slot-border` |
| `table/slot-stock.ink.png` / `table/slot-stock.png` | 360 × 504 px (× `slotScale`) | Optional: the empty stock's own outline. Without it, the stock uses `table/slot`. With it, the "Stock" text is left out, so either draw the word in, or add `table/stock` |
| `table/stock.ink.png` / `table/stock.png` | 240 × 96 px (any size) | The "Stock" label alone, without the outline: just the word. Shown at its own size (a 360 px wide image is as wide as the pile), centred on the stock over its outline. Ink is tinted with `slot-label` |
| `emblem/{variant}.png` | 360 × 504 px (any width) | Shown next to the stock, as tall as it. One per game: `emblem/bbb.png` for this one. Ink is tinted with `emblem`. Without it there's no emblem. On a phone it's shrunk when the controls would get too cramped |

### Controls

The win counter sits above the New deal button, and the two are as wide as the wider one.

| File | Draw at | Notes |
|---|---|---|
| `ui/wins.png` / `ui/wins.ink.png` | 192 × 96 px (any width) | The word "Wins", next to the count. Ink is tinted with `text-muted`. The count is drawn with the corner index digits (see above), tinted with `text` |
| `ui/new-deal.png` / `ui/new-deal.ink.png` | 384 × 96 px (any width) | The words "New deal", on the button. Ink is tinted with `btn-text` |
| `ui/button.png` | 256 × 256 px (any size) | Stretched around the label: corners stay, edges stretch (set `slice`). Next to the cards it grows and shrinks with them |
| `ui/panel.png` | 256 × 256 px (any size) | The "You won" panel, stretched the same way |

Draw the labels like the corner index: the full height is used, so keep some space above and below the letters.

## skin.json

Everything is optional. Anything you leave out comes from the skin you extend. Here's every setting, with what each does (the real file is plain JSON, so leave out the `//` comments):

```jsonc
{
  "name": "My skin",
  "extends": "classic",

  // See "Colours" below for every name you can use
  "colors": {
    "suit-hearts": "#a33",
    "card-bg": "#f2ead8",
    "felt-center": "#6b8563"
  },

  // How images are scaled: "smooth" (default), or "pixelated" to keep hard pixel edges for pixel art.
  // Pixel art can be drawn at a fraction of the sizes above, e.g. a 90 × 126 card (¼ size)
  "scaling": "smooth",

  // scale: size of card/shape.png (and the background and outline with it) relative to the card. Only used with a shape
  // dropScale: the same for card/drop.png, e.g. 1.2 for a frame around the card. Same as scale unless set
  "card": { "scale": 1.1, "dropScale": 1.2 },

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

  "table": {
    "felt": "cover",     // "cover" (one image over the whole table) or "tile" (repeated)
    "tileSize": 1.5      // width of one tile, in card widths. Leave it out and a tile is shown at
                         // its own pixel size when the cards are at their largest (150 px wide).
                         // Set it, and you can draw the tile at any resolution: 3× is sharp on phones
    "slotScale": 1.1     // size of the empty-pile images relative to the pile, like card.scale: lets a
                         // hand-drawn edge reach past the pile. Draw them at 360 × 504 × slotScale
  },
  "ui": {
    "button": { "slice": 12 },    // source px from each edge that must not stretch
    "panel": { "slice": 24 }
  }
}
```

### Colours

Set colours in `"colors"`, by name, with any CSS colour as the value: `"#a33"`, `"#ffffe5"`, `"rgb(0 0 0 / 40%)"`, `"darkred"`, or `"transparent"` to hide something. You only list the ones you change. A name that isn't in this list does nothing (the browser console warns about it while you run `npm run dev`).

| Name | What it colours |
|---|---|
| **Cards** | |
| `card-bg` | The card itself, under the background image and centre art |
| `card-border` | The thin line around a card. With `card/shape.png`, the `card/outline.ink.png` instead |
| `card-shadow` | The small shadow under a card lying on the table (not with a shape) |
| `card-lifted-shadow` | The shadow under a card you're dragging; also under the autocascade button and the "You won" panel |
| `card-hint-bg` | A card's colour while it's the place the card you're holding belongs |
| `card-hint-ring` | The inner ring on that same card (not with a shape) |
| **Suits** | |
| `suit-spades` `suit-hearts` `suit-diamonds` `suit-clubs` | Everything drawn as ink on a card of that suit: corner index, pips, `.ink` centre art and backgrounds |
| **Table** | |
| `felt-center` `felt-edge` | The table: a glow from the centre colour at the top to the edge colour. `felt-edge` also shows behind `table/felt.png` |
| `slot-border` | The dashed outline of an empty pile (or `table/slot.ink.png` and `table/slot-stock.ink.png`) |
| `divider` | The line between the top and bottom half of the table on phones. Same as `slot-border` unless set; `"transparent"` hides it |
| `slot-label` | The "Stock" text on the empty stock (or `table/stock.ink.png`) |
| `emblem` | `emblem/{variant}.ink.png`, if the emblem is drawn as ink |
| `drop-highlight` | The glow around the pile your card will land on, or `card/drop.ink.png` |
| **Controls** | |
| `btn-bg` `btn-text` | Buttons (when there's no `ui/button.png`); `btn-text` also tints `ui/new-deal.ink.png` |
| `text` `text-muted` | The win counter: number and label (also their `.ink` images) |
| **"You won"** | |
| `win-backdrop` | The dimming over the table |
| `win-panel-bg` `win-panel-text` | The panel (when there's no `ui/panel.png`) and its text |

The defaults are in `src/styles/theme.css`.

### Pip layouts

Each point is `[x, y]`: the centre of one pip inside the centre box. `[0, 0]` is the top-left of the box and `[1, 1]` the bottom-right. Pips sit centred on their point, so pips at `0` or `1` hang half outside the box.

Add a third element to change one pip: `{ "flip": false }` keeps it upright, and `{ "scale": 2 }` makes it twice as large.

Layouts are per rank. Defining only `"7"` keeps every other rank as it is in the skin you extend. `classic` has the standard layouts for 2–10; see `skins/classic/skin.json`.

On phones, layouts are replaced by one big pip unless `"narrow": "layout"` is set, because ten pips on a 40 px card are unreadable.

## Tips

- **Start from `classic`.** Open `skins/classic/` to see every file in use, and copy what you want to change. Its images are generated from the original text-based faces by `npm run export:classic`, which overwrites them, so put your drawings in your own skin. Its `skin.json` is hand-written.
- **Backups and drafts**: files whose name starts with `_` (e.g. `index/_clubs.ink.png`) are ignored, so you can keep old versions next to the real ones.
- **Templates**: `skins/_templates/` has blank images at the right sizes. `card.png` has guides for the rounded corners, the corner index, the strip that stays visible in a tight fan, and the centre box on desktop and on phones. Put them on a layer under your drawing and hide that layer before saving.
- **Check the phone layout too.** The gallery shows both sizes. In the game, use a phone viewport in dev tools and look at a long column: only the top strip of each card shows there.

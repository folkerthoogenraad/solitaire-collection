# Skins

A skin is a folder of images plus a `skin.json`. You only draw what you want to change. Everything else comes from the skin you extend, which is `classic` unless you say otherwise.

## Quick start

1. Create `skins/<your-skin>/skin.json`:
   ```json
   { "name": "My skin" }
   ```
2. Add `"<your-skin>"` to the `skins` list in `skins/skins.json`.
3. Drop images into the folder (see below).
4. Run `npm run dev` and open `http://localhost:5173/?skin=<your-skin>`.

The browser console lists any file the game doesn't recognise, which usually means a typo in the name.

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

If both exist, the paint layer goes on top of the ink layer. Use this for suit-coloured linework with painted detail.

## All files

Sizes are what to draw at. Images are scaled down to fit, and only the height is fixed: the width can be whatever the shape needs.

### Corner index

The small rank and suit in the corner. In a tightly fanned column, this is all you see of a card, so keep it bold.

| File | Draw at | Notes |
|---|---|---|
| `index/{rank}.ink.png` | 96 px tall | e.g. `index/10.ink.png`. Used for all suits |
| `index/{rank}-{suit}.png` | 96 px tall | Optional: one suit only, e.g. `index/Q-hearts.png` |
| `index/{suit}.ink.png` | 72 px tall | e.g. `index/clubs.ink.png` |

### Centre of the card

For each card, the game uses the **first** thing it finds:

1. `center/{rank}-{suit}.png`: art for exactly this card
2. `center/{rank}.png`: art for this rank in every suit
3. A pip layout from `skin.json` (see below)
4. One large suit pip

Draw centre art at **202 × 383 px** (the default centre box). Change the box in `skin.json` if you want art to cover more of the card.

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

The small suit symbols placed by a pip layout.

| File | Draw at | Notes |
|---|---|---|
| `pips/{suit}.ink.png` | 128 px tall | If missing, the corner index suit is used |

### Card

| File | Draw at | Notes |
|---|---|---|
| `card/background.png` | 360 × 504 px | Card blank. Corners get rounded for you, so fill the whole rectangle |
| `card/background-{suit}.png` | 360 × 504 px | Optional: one suit only |

### Table and buttons

| File | Draw at | Notes |
|---|---|---|
| `table/felt.png` | ≥ 1920 × 1080, or a tile | Set `"felt": "tile"` in `skin.json` for a repeating tile |
| `table/slot.png` | 360 × 504 px | Empty pile |
| `table/slot-stock.png` | 360 × 504 px | Empty stock pile |
| `ui/button.png` | any | Stretched around the text: corners stay, edges stretch (set `slice`) |
| `ui/panel.png` | any | The "You won" panel, stretched the same way |

## skin.json

Everything is optional. Anything you leave out comes from the skin you extend.

```jsonc
{
  "name": "My skin",
  "extends": "classic",

  // Any colour from theme.css, without the leading --
  "colors": {
    "suit-hearts": "#a33",
    "card-bg": "#f2ead8",
    "felt-center": "#6b8563"
  },

  // Where centre art and pips go. 0..1 of the card's width and height.
  "center": {
    "box": { "x": 0.22, "y": 0.12, "w": 0.56, "h": 0.76 },
    "narrowBox": { "x": 0.08, "y": 0.26, "w": 0.84, "h": 0.70 }   // on phones
  },

  "pips": {
    "size": 0.2,          // pip height, as a fraction of card width
    "flip": "auto",       // pips in the bottom half are upside down; "none" to turn that off
    "narrow": "single",   // on phones: one big pip ("single") or the full layout ("layout")
    "layouts": {
      "2": [[0.5, 0], [0.5, 1]],
      "3": [[0.5, 0], [0.5, 0.5], [0.5, 1]],
      "7": [[0, 0], [1, 0], [0.5, 0.25], [0, 0.5], [1, 0.5], [0, 1], [1, 1]],
      "A": [[0.5, 0.5, { "scale": 2.5 }]]
    }
  },

  "table": { "felt": "cover" },   // "cover" or "tile"
  "ui": {
    "button": { "slice": 12 },    // px from each edge that must not stretch
    "panel": { "slice": 24 }
  }
}
```

### Pip layouts

Each point is `[x, y]`: the centre of one pip inside the centre box. `[0, 0]` is the top-left of the box and `[1, 1]` the bottom-right. Pips sit centred on their point, so pips at `0` or `1` hang half outside the box.

Add a third element to change one pip: `{ "flip": false }` keeps it upright, and `{ "scale": 2 }` makes it twice as large.

Layouts are per rank. Defining only `"7"` keeps every other rank as it is in the skin you extend.

On phones, layouts are replaced by one big pip unless `"narrow": "layout"` is set, because ten pips on a 40 px card are unreadable.

## Tips

- **Start from `classic`.** Open `skins/classic/` to see every file in use, and copy what you want to change.
- **Templates**: `skins/_templates/` has blank images at the right sizes, with guides for the rounded corners, the corner index and the strip that stays visible in a tight fan.
- **Check the phone layout too.** Open dev tools, switch to a phone viewport, and look at a long column: only the top strip of each card shows there.

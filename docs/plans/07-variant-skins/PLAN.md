# Plan: 07-variant-skins

A skin can look different per variant: first its colours, later its other `skin.json` settings and its artwork. Klondike needs red/black suits, while Bobbie's Beautiful Bugs (BBB) keeps its four suit colours.

Status: **step 1 is built** (colours per variant). Steps 2 and 3 are backlog.

## Approach

**One schema, nested under a scope; the more specific value wins.** That's how VS Code does language-specific settings:

```jsonc
{
  "editor.tabSize": 2,
  "[python]": { "editor.tabSize": 4 }
}
```

The skin system already works this way for files: `card/background-hearts` beats `card/background`, and `emblem/{variant}` is a per-variant file. This plan does the same for `skin.json` and, later, for artwork.

### Merge order

Every skin is resolved fully, variant block included, before the skin that extends it goes on top:

```
classic → classic.variants.klondike → classic-altered → classic-altered.variants.klondike
```

This matches how centre art already resolves ("per skin before moving to the parent"). The other order (all base blocks first, then all variant blocks) would let a parent's Klondike block silently undo colours a child skin picked on purpose.

The cost: a skin that recolours suits without a block for a variant gets those colours in that variant too.

## Step 1: colours per variant (built)

```jsonc
{
  "colors": { "card-bg": "#ffffe5" },
  "variants": {
    "bbb": { "colors": { "suit-spades": "#215b7d", "suit-hearts": "#c12f2f" } },
    "klondike": { "colors": { "suit-spades": "#1e2a36", "suit-hearts": "#c12f2f" } }
  }
}
```

- **Schema**: `variants` maps a variant id to a block with the same shape as the top level. For now only `colors` is accepted; any other key is reported as an unknown setting, like any typo. Variant blocks can't nest.
- **Merge**: `mergeSettings(manifests, variantId)` applies each manifest and then its block for that variant, from the root of the chain to the skin itself. `settingsFor(chain, variantId)` passes the id through. Without an id you get the shared settings only.
- **Applying**: colours are custom properties on `:root`. `loadSkin` keeps one colour set per variant. `LoadedSkin.useVariant(id)` writes that set and removes names the previous set had and this one doesn't. `main.ts` calls it at startup and on every switch.
- **Performance**: a switch happens while the selector covers the board, so the restyle of every card is never seen, and no gesture or animation is running ([mobile-animation-jank](../mobile-animation-jank/PLAN.md)).
- **Dev warnings**:
  - a `variants` key that isn't a game in this build (not an error: a skin can carry blocks for games this build doesn't have, as with emblems);
  - colour names inside a variant block that don't exist, like the top-level check.
- **Not built**: a warning when a skin sets suit colours but has no block for a variant. Whether a variant needs its own suit colours is knowledge of that variant's rules, which the skin loader doesn't have.

## Step 2: the other `skin.json` settings per variant

Allow the rest of the schema in a variant block: `table`, `ui`, `card`, `scaling`, `center` and `pips`. Merge order and syntax stay the same.

| Setting | Cost | How |
|---|---|---|
| `table` (felt mode, `tileSize`, `slotScale`), `ui` slices, `card.scale` / `dropScale` | Cheap | These are CSS variables on `:root`, re-applied by `useVariant` like the colours. |
| `scaling` | Cheap | The board's `data-scaling`, set by `useVariant`. |
| `center`, `pips` | Medium | They shape the card faces. `loadSkin` resolves face specs per variant and returns `faces` per variant (`skin.facesFor(id)`). `createGame` already builds a new renderer per variant, so it takes them as they are. |

Work: widen the variant block's validator, make `apply()` in `load.ts` per variant (today it runs once), and move the felt and data-attribute writes into `useVariant`.

## Step 3: artwork per variant, in `variants/<id>/`

A folder inside the skin with the normal layout, checked before the skin's own files:

```
skins/classic-altered/
  table/felt.png
  card/back.png
  variants/
    klondike/
      table/felt.png        Klondike's table
      card/back.png         Klondike's back
```

- **Lookup** per skin becomes `variants/<id>/<key>` → `<key>`, then the parent does the same (the merge order above). Lookups that already go from specific to general just get the variant in front:

  `variants/klondike/card/background-hearts` → `variants/klondike/card/background` → `card/background-hearts` → `card/background` → parent…

- **Why a folder** rather than suffixes like `felt@klondike.png`:
  - the README's file tables apply unchanged;
  - the unknown-file check works per folder;
  - a variant's look can be copied, moved or deleted as one folder.
- **Emblems** stay `emblem/{variant}`: they're per variant by nature. One way to do it is enough.
- **Preloading** stays as it is: every variant's images load at startup, so a switch never waits.
- **Order of work**: table and card images first (felt, slots, back, background, outline, shape), because those are `resolveChrome` / `resolveBack` and are cheap to make per variant. Then faces (`center`, `index`, `pips`), which need the faces per variant from step 2.
- `collectSkins` keeps `variants/<id>/…` paths as keys with the prefix. `unknownFiles` strips the prefix before checking, and warns about folders for games that don't exist.

## Docs

`skins/README.md` has a "Per game" section (added with step 1): the `variants` block, the merge order, and which settings are allowed so far. Steps 2 and 3 extend it, step 3 with the folder.

## As built (step 1)

- **`classic-altered`**: its four suit colours moved from `colors` into `variants.bbb`. `variants.klondike` has red `#c12f2f` for hearts and diamonds and near-black `#1d1d1d` for spades and clubs. A future game without a block of its own falls back to `classic`'s suit colours.
- **Startup**: `loadSkin` applies the first variant's colours, and `main.ts` then applies the one being played, before anything is shown.
- **Checked in headless Edge**: the suit colours follow the game on a switch, both ways, and on a reload with `?variant=klondike`.

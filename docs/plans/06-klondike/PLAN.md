# Plan: 06-klondike

A second variant, Klondike (draw one), next to Bobbie's Beautiful Bugs (BBB). That takes four things: a variant selector behind the emblem, a Klondike layout with a stock and a waste pile, skinnable card backs, and a separate game and win count per variant.

Design: [`mockups/selector.html`](mockups/selector.html). It needs the dev server: `npm run dev`, then open `http://localhost:5173/docs/plans/06-klondike/mockups/selector.html`. Status: **implemented**. See §11 for the decision and where the build differs from the plan.

## 1. Assumptions

Correct these if any are wrong.

- **Rules: standard Klondike, draw one.**
  - 52 cards (no Emperor).
  - Seven columns: column *n* gets *n* cards, and only the top one is face up. The other 24 cards go in the stock, face down.
  - Columns build down in alternating colours. Any face-up run can be moved. Only a King (or a run starting with one) goes on an empty column.
  - Foundations build up by suit from A to K. A foundation's top card can be moved back onto a column.
  - Tap the stock to turn one card onto the waste. Tap the empty stock to turn the waste back over. Redeals are unlimited.
  - **A face-down card that becomes the top of its column flips over by itself.** There's no tap to flip it.
  - It's won when all 52 cards are on the foundations.
- **No undo, score, timer or move counter.** BBB has none either.
- **Autocascade works as it does now**: offered onto a foundation after a card lands there, never automatic. `nextCascadeMove` already only goes through `variant.canMove`, so it carries over. The waste counts as a source, the stock doesn't.
- **Hint highlight** (the card that the card you're holding belongs on) carries over through `canMove`.
- **The selector replaces nothing.** New deal stays where it is, and the selector only switches between games.

## 2. The design (mockup)

The mockup is a Vite dev page, like [`tools/gallery.html`](../../../tools/gallery.html). It uses the real skin loader, faces and controls, so it shows the actual `classic-altered` look. Both games are static mid-game boards, so you can't move any cards.

- Click (or Enter on) the emblem to open the selector. Choose a variant to switch boards. The circle closes onto the new board's emblem. Esc, or choosing the current variant, closes it without switching.
- **Design knobs** (bottom right) cover what's still open. Each choice is kept in the URL, so you can share a link to it:
  - *Buttons*: `panel` (the skin's `ui/panel.png`, the default), `felt`, `outline`, or `plain` on black.
  - *Duration*: how long the circle takes.
  - *Circle from*: the emblem, or the screen centre.
- Deep links: `?variant=klondike`, `?open` (start with the selector open), `?style=felt&ms=800&origin=center`, `?skin=<id>`.
- The Klondike emblem is a **placeholder** ([`mockups/klondike.svg`](mockups/klondike.svg)) on the same 2:1 canvas as `emblem/bbb.png`. The real one is `skins/<skin>/emblem/klondike.png`, which you draw.

### What to look at

1. **Button style.** The emblems are drawn for the felt, with black outlines and black "Rules" text. On plain black those outlines vanish, so `panel` or `felt` keeps them readable. `outline` and `plain` are in the mockup so you can see the problem for yourself.
2. **Win counter.** The mockup has "Wins" above a large count, to the right of the emblem. A single line ("Wins 12", as on the table) pushed the count out of the button at desktop width.
3. **The current variant** gets a ring in `drop-highlight`. Other options are a "playing" label, or nothing.
4. **Animation.** The circle grows from the emblem, and the buttons fade and slide in once the circle has mostly covered the screen. On close, the circle shrinks onto the emblem of the variant you chose.

## 3. Variant selector

- **Structure**: a `.selector` overlay, `position: fixed`, a sibling of `#board` (not inside it). It has `role="dialog"` and `aria-modal`, holds a grid of `<button>`s, and focus goes to the current variant's button.
- **Layout**: two columns on desktop, one below 720 px. Each button shows the emblem (`--eh` tall: 130 px on desktop, 84 px on phones) and the win counter, using the same `createWinCount` as the table, from the skin's `ui/wins` and digits.
- **Open**: `clip-path: circle(0 at <emblem centre>)` → `circle(R …)`, where R is the distance to the farthest corner. R is recomputed on resize while the selector is open.
- **Close**: the circle shrinks to the emblem of the variant you chose. When you switch, the board is rebuilt while the black circle still covers it, so you never see the swap.
- **Theme tokens**: `selector-bg`, `selector-text`, `selector-current`. Skins can change them.
- **Opening**: the emblem gets `role="button"`, `tabIndex=0` and a pointer cursor. `drag.ts` only starts on `.card`, so tapping the emblem doesn't clash with dragging. Check that once it's built.
- **Performance** (see [mobile-animation-jank](../mobile-animation-jank/PLAN.md)): don't toggle classes on `#board`, `body` or `html` to open or close it. Only the overlay changes. Chrome may run `clip-path` animations on the main thread. Nothing else moves while the selector animates, but measure it with `tools/android-perf/record.mjs`. If it stutters, the fallback is a black circle element scaled with `transform` (which runs on the compositor), with the content fading in on top. That looks almost the same.
- **Reduced motion**: no circle; a 150 ms opacity fade instead.

## 4. Klondike layout

Prototyped in the mockup (`klondikeWide` / `klondikeNarrow` in [`selector.ts`](mockups/selector.ts)). Both work at desktop and phone sizes.

**Desktop (wide):** `stock · waste · [emblem over controls] · f0 f1 f2 f3`, with seven columns below.

- Seven columns leave width to spare on most screens, so the gaps are 0.25·cw (BBB uses 0.14). The third column, reaching halfway into the gaps on either side, holds the emblem, with Wins and New deal below it. The controls' font drops from 0.21·cw to 0.165·cw to fit.
- Height budget: a column of 6 face-down cards (fanned at 0.15·cw) and 8 face-up ones at the minimum fan.

**Phone (narrow):** the same as BBB on a phone. The emblem and controls get a header row of their own, then come stock, waste and foundations, then the seven columns in **one band** (no divider). Portrait always gets this layout. The "1.35× larger cards" rule BBB uses doesn't separate the two layouts with seven columns.

**Face-down cards** use a tighter fan (0.15·cw desktop, 0.1·cw phone). When a column is too tall to fit, only the face-up part is compressed.

**Waste**: the cards are stacked and only the top one shows (draw one).

**In code**: `Layout` gets per-variant arrangements. `computeLayout(width, height, variant, emblemAr)` dispatches on a new `variant.layout: 'bbb' | 'klondike'` (or the variant supplies its own function). `pileRow` learns about the waste. `fanFor` takes the number of face-down cards into account. `layout.test.ts` gets Klondike cases: nothing overlaps, everything stays inside the screen, and the controls are at least their minimum size.

## 5. Card backs

- **Skin files**: `card/back.png` and/or `card/back.ink.png` (360 × 504 px, × `card.scale` with a shape). The ink layer is tinted with the new colour `card-back`. Optional per suit: none, because a card back must not give away its suit.
- **Without an image**: the card body in `card-back-bg`, with a patterned inset panel in `card-back` / `card-back-pattern`, drawn in CSS (as in the mockup). Both get defaults in `theme.css`. `classic` can stay image-free, since the CSS back *is* the classic back.
- **Shaped skins**: the back uses the same shape mask and `card/outline` as the face, so it has the same silhouette. The mockup does this already.
- **DOM**: every card gets a `.back` next to its `.face`, built once. The per-card class `.down` decides which one shows. Only that one card's class changes, so nothing is restyled across the whole board.
- **Flip**: a short `scaleX(1 → 0 → 1)` on the card's inner wrapper, swapping face and back at the midpoint. That's transform only, one card at a time. Check it on the phone: each flip re-rasterizes one card.
- **Stock**: drawn as a stack of backs. Only the top 2–3 render visibly; the rest are `visibility: hidden` under them, which is cheaper to raster.
- **`skins/README.md`**: add the back files and the three colours, and remove "No card backs" from [03-skins](../03-skins/PLAN.md) §1.

## 6. State and win count per variant

- **Save keys**: one per variant, `solitaire.save.<variantId>` → `{ version: 2, game, stats }`. Each is validated against its own variant, so a broken Klondike save can't take the BBB one down with it.
- **Migration**: the v1 `solitaire.save` (`variant: "bbb"`) moves to `solitaire.save.bbb` on first load, and the old key is deleted. Wins are kept.
- **Current variant**: `settings.variant` (in `solitaire.settings`, next to the skin). `?variant=<id>` overrides it and is remembered, like `?skin`.
- **`GameState`** gets `down?: Record<PileId, number>`: the number of face-down cards at the bottom of each pile. Klondike only ever has face-down cards at the bottom of a pile, so a count per pile is enough. BBB leaves it out. `isValidGame` checks `0 ≤ down ≤ pile length`.
- **New deal and wins** apply to the current variant only.

## 7. Core changes

- **Decks**: add `standardDeck` (A–K). The card ids are the same as in the Emperor deck, so skins resolve them without changes. `SuitDef` gets `color: 'red' | 'black'` for the alternating-colour rule.
- **Piles**: a new `PileKind` `'waste'` (id `waste`).
- **`Variant`** additions:
  - `apply(state, move)`: applies a move and then the variant's own effects (Klondike flips the newly exposed card and turns the waste back over in reverse order). The current `applyMove` stays as the shared base.
  - `tap(state, pile): Move | null`: what tapping a pile does (Klondike's stock: draw or recycle). `drag.ts` reports a tap without a drag, `main.ts` commits the move, and the `draw` sound plays (already in `classic`).
  - `dealOrder(state): string[]`: the order the cards fly out on a new deal. It replaces the round robin hard-coded in `Renderer.dealOrder`. Klondike deals row by row and leaves the stock where it is.
  - `layout`, `name`, and the emblem key.
- **Registry**: `src/core/variants/index.ts` exports `[bbb, klondike]`.
- **Tests**: `klondike.test.ts` covers the deal (28 + 24, the face-down counts), every move rule in §1, the auto-flip, draw and recycle, and the win.

## 8. App structure

The app currently boots into one variant. Switching needs a teardown:

- **`createGame(variant, ctx)`** (new `src/game.ts`) holds what `main.ts` does per variant today: state, renderer, controls, win overlay, cascades and drag. It returns `{ destroy() }`. `main.ts` keeps the loader, settings, skin, sounds and selector.
- **Skin**: `loadSkin` takes every variant at once. It resolves the faces for the union of their decks (the Emperor deck covers both) and `emblem/<id>` for each variant. Everything is preloaded at startup, so the selector and a switch never wait for images. `SkinUi` gets an `emblem(variantId)`.
- **Switching** (under the closed circle): stop any cascades, `destroy()` the current game, `createGame(next)`, render. Instant if the next variant has a saved game, otherwise a deal animation once the circle opens.

## 9. Phases

1. **Selector design**: iterate on the mockup until you pick a design (§2). Record the decision here.
2. **Core**: standard deck and suit colours, Klondike variant, `down`, `apply` / `tap` / `dealOrder`, plus tests.
3. **Persistence**: per-variant saves, v1 migration, `settings.variant`, `?variant=`, plus tests.
4. **Card backs**: skin files, CSS default, `.down` / flip in the renderer, README. Check on the phone.
5. **Klondike layout**: wide and narrow, waste, face-down fan, layout tests.
6. **Multi-variant app**: `createGame` / `destroy`, `loadSkin` for every variant, emblem per variant.
7. **Selector**: the chosen design, a11y, reduced motion. Measure the open and close on the phone.
8. **Docs**: `skins/README.md` (backs, `emblem/klondike`, new colours), `README.md` (`?variant=`).

## 10. Open questions

- **Four-colour suits versus red/black.** `classic-altered` has blue spades, red hearts, gold diamonds and green clubs. Klondike's rule is *alternating colour*, and with four colours it's hard to see which suits count as "red". Options:
  - leave it as it is, and players learn ♦/♥ = red;
  - give Klondike a two-colour palette, with per-variant colour overrides in `skin.json`;
  - recolour `classic-altered` so ♦ is a red-ish gold and ♣ a near-black green.
- **Klondike emblem art**: you draw `emblem/klondike.png`. The mockup's placeholder goes once it exists.
- **Desktop top row**: the emblem above the controls in the middle column (as in the mockup), or a header row like on phones. A header row costs about 1 card height, so all cards get smaller.
- **Selector extras**: show "game in progress" on a variant's button? Add a title, or a close (×) button for touch users who don't think to tap the current variant?
- **Recycle limit**: unlimited (assumed), or a limit such as 3 passes?

## 11. As built

**Decision (selector design):** plain buttons on black, a 550 ms circle, growing from and shrinking to the **centre of the screen** (not the emblem). The other knob options were not built.

Where the build differs from the sections above, or adds to them:

- **Emblem without an image**: the game's name is shown as text, in the emblem's spot and on its selector button, so the selector can always be opened. No skin has `emblem/klondike.png` yet. The mockup's placeholder, [`mockups/klondike.svg`](mockups/klondike.svg), can be dropped into a skin as `emblem/klondike.svg` to use it.
- **The selector's clip-path is only there while it animates.** Chrome kept hit testing against a stale clip after the transition, so taps on a button went through to the board. Two fixes:
  - The selector is now an unclipped full-screen element that catches every tap, with the clipped black `.sel-reveal` inside it.
  - The clip is removed once the circle is out (`.shown`) and put back just before it shrinks.
  
  A tap beside the buttons only closes the selector once it's fully open.
- **Closing**: Escape, a tap beside the buttons, or the current game's button. Focus goes back to the emblem.
- **Desktop layout**: there's no emblem minimum. The emblem in the middle column is at most half a card tall, and the controls fill the rest of the column at a font size of 0.165·cw (`Layout.controlsFont`).
- **Phone layout**: portrait always gets it with a waste pile, as the mockup did.
- **Layout dispatch** is on `variant.hasWaste`, not a separate `layout` field.
- **Hints moved into the variant** (`hintTarget` / `hintSource`). BBB keeps its same-suit hints. Klondike points at the top of a column the held card goes on (left button), or a face-up card that goes on it (right button).
- **No dropping onto the stock**: drag skips the stock as a target, so dragging the last waste card there doesn't count as turning the waste over. That only happens with a tap.
- **Stock taps** act on press, so quick taps keep up. A tap on the empty stock (its slot) turns the waste over.
- **Deal**: dealt cards stack at z 100+ in deal order, so they fly out above the cards that stay in the stock.
- **`Renderer.destroy()`** clears the deal timer, so a game switched away mid-deal can't end the next game's deal early.
- **Not built**: the stock rendering only its top few backs (all 24 are there; check it on the phone), and a phone measurement of the selector and the flip with `tools/android-perf/`.
- **Autocascade in Klondike sweeps the whole table** (`Variant.safeCascadeMove`). Pressing it moves, one by one and lowest rank first, every card on top of the waste or a column that's *safe* to put up: aces and twos always, any other card once both cards of the other colour one rank lower are on the foundations, since then nothing left on the table could need it. It's still offered only after a card lands on a foundation, and only when something is safe to move. The "back onto a column" offer is BBB only. BBB's one-suit cascade is unchanged.
- **Suit colours** (§10) are unchanged. `classic-altered`'s four colours stay; `SuitDef.color` is what the rules use.

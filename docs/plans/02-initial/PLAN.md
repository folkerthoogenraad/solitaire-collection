# Plan: 02-initial

Browser-based solitaire ("Bobbie's Beautiful Bugs" ruleset) that plays well on desktop and on a phone in portrait.

Mockups: [`mockups/index.html`](mockups/index.html) (open locally in a browser, no build needed).

## 1. Assumptions

These follow from the request; correct them if any are wrong.

- **Rank order** is `A < 2 … 10 < J < Q < K < E`. Nothing can be placed on an A in the tableau, and E (Emperor) is the top of a foundation.
- **Moves.** Only the top card, or a valid run (same suit, descending, consecutive) ending at the top of a column, can be picked up. A run can only go onto a tableau pile (one whose top is the next rank of the same suit) or onto an empty column. Foundations accept single cards only.
- **Foundation → foundation** is a single top card, by the same rules as any foundation placement.
- **Deal**: 56 cards dealt left to right, round-robin, into 11 columns: column 1 gets 6 cards, columns 2–11 get 5. All face up. Fully random (no solvability check).
- **Win**: four foundations each holding A→E of one suit. An empty tableau follows automatically.
- **Win counter** counts wins only. Abandoning a game with *New deal* isn't counted. A finished game triggers a win animation, increments the counter and offers a new deal.
- **Emperor art**: no open-licensed deck has a 14th rank, so this is covered by the art decision below.

## 2. Tech stack

**Vite + TypeScript, no UI framework.** Vitest for unit tests.

- The UI is ~60 absolutely positioned elements plus a header. A framework adds a diffing layer between state and DOM that we would fight during drag/animation. Direct DOM with a small renderer is simpler and faster.
- TypeScript pays off for the rules engine and for the deck/variant abstractions that need to stay extensible.
- Vite gives a static `dist/` (works on any static host, e.g. GitHub Pages) and has a cheap PWA path later (`vite-plugin-pwa`).
- Angular was considered and rejected: heavy for a single-screen game, and change detection during pointer moves is exactly the lag source to avoid.

### Architecture

```
src/
  core/            pure, no DOM — fully unit-tested
    deck.ts        DeckDefinition: suits[], ranks[] (ordered, with id/label)
    variant.ts     Variant interface: deal(), canMove(), isWin()
    variants/bbb.ts  this ruleset
    state.ts       GameState (piles: Record<PileId, CardId[]>), applyMove()
    rng.ts         seeded PRNG; deal = f(seed) so a game is reproducible
  persistence/
    storage.ts     versioned localStorage schema { version, game, stats }
  ui/
    layout.ts      viewport → LayoutSpec (pile rects, card size, fan offsets)
    renderer.ts    places card elements via transform from LayoutSpec + state
    drag.ts        pointer-events drag & drop, hit-testing on LayoutSpec rects
    animate.ts     FLIP / Web Animations API for moves, deal and win
    theme/         card face renderer(s) + CSS tokens
  main.ts
```

Key choices:

- **Single card layer.** Every card is one persistent DOM element, absolutely positioned and moved only with `transform: translate3d(...)`. Piles are not DOM containers; they're rects in the `LayoutSpec`. Moving a card between piles never reparents it, so move animations come for free (old transform → new transform), and changes are compositor-only.
- **Layout is computed, not CSS flow.** `layout.ts` is a pure function of viewport size (and card counts, for fan compression). On resize it re-runs and cards transition to their new positions. Fan offsets shrink when a pile would overflow its area.
- **Variant/deck abstraction from day one** (cheap now, expensive later): `DeckDefinition` doesn't assume 13 ranks or 4 suits, and rules live behind the `Variant` interface. Future rulesets and decks with extra cards plug in without touching UI code.
- **Moves are data** (`{ from, to, count }`). This makes persistence trivial and leaves the door open for undo (future scope) as a move stack.

### Performance budget

- Only `transform`/`opacity` animate. No `box-shadow`, `top`/`left` or layout-affecting properties animate. The lift shadow is a pre-rendered pseudo-element whose opacity is toggled.
- During a drag, a pointer-move only writes a transform for the dragged cards, inside `requestAnimationFrame`. It never reads layout (`getBoundingClientRect`) while dragging, because hit-testing uses the in-memory `LayoutSpec`.
- `will-change: transform` only on cards that are dragging or animating.
- No per-frame JS when idle (no game loop). The target is 60 fps on a mid-range phone and near-zero CPU at rest.

## 3. Art

**Recommendation: generated card faces (CSS/SVG templates), with no image assets for now.**

- Every face is built from rank label + suit glyph + theme tokens. This sidesteps licensing completely and handles the **Emperor** rank like any other.
- At phone size, only the corner index is visible on covered cards. Image-based faces don't survive 32–58 px widths anyway, so the index has to be designed for legibility regardless.
- Swappable later: the renderer goes through a `CardFaceRenderer` interface (`render(card, size) → element/markup`). A future image deck (your own art) is a second implementation backed by a sprite sheet or per-card SVGs plus a manifest. It keeps the corner index overlay for small sizes.

Fallback if you want real artwork in the interim: **Kenney "Playing Cards Pack" (CC0)** for faces/backs, with a generated face only for E. The mockups use generated faces.

## 4. Mobile layout

Portrait only: the phone is narrow but tall. 11 piles across about 380 px is the core problem. The three mockups each take a different approach:

| | Mobile approach | Card on phone | Covered-card hit area | Notes |
|---|---|---|---|---|
| **A · Classic felt** | 11 narrow columns | 32 × 46 px | 32 × 18 px | Familiar; smallest targets; one-line index (`10♦`) is just legible |
| **B · Midnight** | Tableau split into two bands (cols 1–6 / 7–11) | 58 × 80 px | 58 × 22 px | Readable, easy to grab; bands cap column height, so fans compress on long runs |
| **C · Paper rows** | Tableau rotated: 11 horizontal rows | 36 × 50 px | 22 × 50 px | Uses the height for pile count; a full 14-card row fits (322 px); unconventional |

Drag-and-drop details that apply to any choice:

- `touch-action: none` on the board, Pointer Events only (mouse, touch and pen through one code path).
- Picking up grabs the run from the touched card to the top of the pile.
- The dragged cards render slightly enlarged and offset above the finger, so the thumb doesn't hide them.
- The drop target is the pile whose rect is nearest the dragged card's center, within a generous tolerance, not the exact element under the finger. Valid targets highlight while dragging.
- Invalid drop: the cards animate back to where they came from.

**My recommendation:** B's mobile layout with B's four-colour suits. Suit is the only thing that matters in this ruleset, so suit colour is the most useful signal. A is the safe classic but its 18 px targets will feel fiddly. C is the most space-efficient and worth trying if B's band-height compression feels cramped in practice. Visual style (felt / midnight / paper) is independent of layout and can be mixed. Theming goes through CSS tokens, so a second theme is cheap later.

**Decision: Design D** ([desktop](mockups/d-felt-desktop.html), [mobile](mockups/d-felt-mobile.html)).

- Visual style A (classic felt). On desktop, A's 11-column layout.
- On mobile, B's two-band tableau (columns 1–6 on top, 7–11 below).
- No navbar. The win count and New deal sit in the top row, between the stock and the foundations, on both desktop and mobile.
- Every colour is a CSS custom property: felt, text, button, card, empty slot, drop highlight, and one variable **per suit** (`--suit-spades`, `--suit-hearts`, `--suit-diamonds`, `--suit-clubs`), even where two currently share a value. The reference set is [`mockups/d-felt-theme.css`](mockups/d-felt-theme.css) and carries over as the app's theme file.

## 5. Persistence

- `localStorage`, single versioned key: `{ version: 1, game: { seed, piles }, stats: { wins } }`.
- Saved after every completed move and on New deal or win. The payload is <2 KB, so no throttling is needed.
- On load: validate schema/version. If it's corrupt or unknown, start a new deal but keep `stats` if it can be read.

## 6. Phases

1. **Scaffold**: Vite + TS + Vitest, lint/format, static build, README with run/build commands.
2. **Core engine**: deck/variant abstractions, BBB ruleset, deal, move validation, win detection. Full unit-test coverage of the rules in §1.
3. **Layout + render**: `LayoutSpec` for the chosen design (desktop + portrait mobile), card face renderer, resize handling.
4. **Input**: pointer drag & drop, valid-target highlighting, snap-back.
5. **Persistence + chrome**: save/restore, win counter, New deal (confirm if a game is in progress), win screen.
6. **Feel**: move/deal/win animations, lift effect, tuning on a real phone.
7. **Optional**: PWA (manifest + service worker via `vite-plugin-pwa`). Roughly an hour of work and orthogonal to everything else, so it can go in now or later.

Kept in mind but not built now: sounds (an `audio` hook on move events), deck art selection (`CardFaceRenderer` registry), variants (`Variant` registry), auto-complete, undo (move stack), controller input (a focus/selection model on top of the same move API).

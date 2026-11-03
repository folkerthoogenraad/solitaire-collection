# Solitaire

Browser solitaire: "Bobbie's Beautiful Bugs" and Klondike (draw one). Tap the emblem to switch games; each keeps its own game and win count. Static site, no server, state in `localStorage`.

```sh
npm install
npm run dev        # dev server
npm test           # rules, layout and storage tests
npm run build      # typecheck + static build into dist/
npm run preview    # serve dist/
npm run export:classic  # regenerate skins/classic images and templates (needs Edge or Chrome)
```

`dist/` uses relative paths, so it can be hosted from any static host or sub-path.

## Deployment

[`.github/workflows/pages.yml`](.github/workflows/pages.yml) runs the tests and build on every push and pull request, and deploys `main` to GitHub Pages (http://justf.net/solitaire-collection/).

## Layout

- `src/core`: pure game logic (decks, variant interface, the BBB and Klondike rulesets in `variants/`, seeded deal). No DOM.
- `src/game.ts`: one variant on the board (state, renderer, controls, drag, autocascade); `main.ts` swaps games from the variant selector. `?variant=bbb|klondike` picks one and is remembered.
- `src/persistence`: versioned save/load per variant, with validation.
- `src/ui`: layout engine, renderer (one element per card, moved by transforms only), drag & drop, controls, win overlay.
- `src/styles/theme.css`: every colour as a CSS variable.
- `src/ui/skin`: skin loading and card faces. Skins live in [`skins/`](skins/README.md); pick one with `?skin=<id>`. Animations follow the OS "reduce motion" setting unless overridden with `?motion=full|reduced` (`?motion=system` goes back to the default). Both are remembered.
- `tools/`: dev-only pages: the classic exporter and a skin gallery (`/tools/gallery.html?skin=<id>` on the dev server).

Plans: [`docs/plans/02-initial`](docs/plans/02-initial/PLAN.md) (with mockups), [`docs/plans/03-skins`](docs/plans/03-skins/PLAN.md), [`docs/plans/06-klondike`](docs/plans/06-klondike/PLAN.md).

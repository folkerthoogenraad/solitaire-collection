# Solitaire

Browser solitaire ("Bobbie's Beautiful Bugs" ruleset). Static site, no server, state in `localStorage`.

```sh
npm install
npm run dev        # dev server
npm test           # rules, layout and storage tests
npm run build      # typecheck + static build into dist/
npm run preview    # serve dist/
npm run export:classic  # regenerate skins/classic images and templates (needs Edge or Chrome)
```

`dist/` uses relative paths, so it can be hosted from any static host or sub-path.

## Layout

- `src/core`: pure game logic (deck, variant interface, BBB ruleset, seeded deal). No DOM.
- `src/persistence`: versioned save/load with validation.
- `src/ui`: layout engine, renderer (one element per card, moved by transforms only), drag & drop, controls, win overlay.
- `src/styles/theme.css`: every colour as a CSS variable.
- `src/ui/skin`: skin loading and card faces. Skins live in [`skins/`](skins/README.md); pick one with `?skin=<id>`.
- `tools/`: dev-only pages: the classic exporter and a skin gallery (`/tools/gallery.html?skin=<id>` on the dev server).

Plans: [`docs/plans/02-initial`](docs/plans/02-initial/PLAN.md) (with mockups), [`docs/plans/03-skins`](docs/plans/03-skins/PLAN.md).

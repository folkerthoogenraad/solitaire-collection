# Solitaire

Browser solitaire ("Bobbie's Beautiful Bugs" ruleset). Static site, no server, state in `localStorage`.

```sh
npm install
npm run dev        # dev server
npm test           # rules, layout and storage tests
npm run build      # typecheck + static build into dist/
npm run preview    # serve dist/
```

`dist/` uses relative paths, so it can be hosted from any static host or sub-path.

## Layout

- `src/core`: pure game logic (deck, variant interface, BBB ruleset, seeded deal). No DOM.
- `src/persistence`: versioned save/load with validation.
- `src/ui`: layout engine, renderer (one element per card, moved by transforms only), drag & drop, controls, win overlay.
- `src/styles/theme.css`: every colour as a CSS variable.

Plan and mockups: [`docs/plans/02-initial`](docs/plans/02-initial/PLAN.md).

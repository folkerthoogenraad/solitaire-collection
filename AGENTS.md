# AGENTS.md

## Documentation layout

### `/docs/requests`

User-audited requests. An agent is explicitly instructed to implement a request (e.g. "do 01-setup.md"). These files are owned by the user: do **not** update or alter them.

### `/docs/feedback`

User-audited feedback on the app. Random and unstructured: anything from mismatching colors to layout issues. Treat it as input; do not alter these files.

### `/docs/plans`

Plans created by agents, at `/docs/plans/<plan>/PLAN.md`. `<plan>` matches the name of the originating request (e.g. request `03-scoring.md` → `/docs/plans/03-scoring/PLAN.md`).

- Not every request needs a plan; create one when the request asks for it or the work warrants it.
- Other documents produced for a request (designs, mockups, etc.) also go in that plan's folder, next to `PLAN.md`.

## Performance on mobile

Desktop hides animation jank that shows on Android Chrome. Before changing drag, hint, animation or board-level classes, read `/docs/plans/mobile-animation-jank/PLAN.md`: what caused the last regression, the rules that keep it away, and a runbook (`tools/android-perf/`) to measure on a phone over USB.

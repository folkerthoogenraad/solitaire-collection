# Solvability of BBB and rule variants

Measured with [`tools/solver`](../../../tools/solver/README.md) on the game's own deals, seeds 1–10,000, giving up on a deal after 2M distinct states. Every solution found was replayed and checked: BBB solutions against the game's rules (`src/core/variants/bbb.ts`), variant solutions against a separate replayer written from the rule text.

| Ruleset | Winnable | Proven unwinnable | Undecided |
| --- | --- | --- | --- |
| **1** Current BBB | **99.92%** | 0.08% | 0 |
| **2** Foundations A→E only | 3.8% | 96.2% | 0 |
| **2A** + park a single card on any column (blocks it) | ≥ 91.0% (≈ 93.6%, see below) | 0 | 9.0% |
| **2B** + 1 empty column, build up or down, single cards only | 89.6% | 10.4% | 0 |
| **2C** + take cards from the bottom of columns | 72.0% | 28.0% | 0 |
| **2C** + 1 empty column | **99.98%** | 0.02% | 0 |
| **2C** + 1 extra column in the deal (12 columns) | 91.9% | 8.1% | 0 |

Unwinnable BBB seeds: 58, 398, 1119, 6695, 7156, 8189, 8324, 9739. Unwinnable 2C + empty column seeds: 4730, 6314.

## Notes

- **2A** has a huge state space (almost any card can go almost anywhere), so the solver can't exhaust it. Of 200 undecided deals rerun with 15M states, 58 were won and none was proven unwinnable: an estimated ≈ 93.6% or more is winnable, the rest unknown.
- **2C: runs or single cards from the bottom make no difference** (identical results). Moving the bottom card, then the next bottom card onto it, rebuilds the same run in the same order.
- **Rules as read:**
  - In ruleset 2, taking cards back off a foundation can't help when building is by suit, so it isn't allowed. Cards go to the foundations automatically, which never costs a win.
  - 2A: a parked card can move on (to a foundation, a matching card, an empty column, or parked on another column). Nothing can go on it, and the column under it is blocked.
  - 2B: same suit, one rank up or down.
  - 2C: you can only place on the top of a column, never the bottom.
- In BBB itself nothing goes to the foundations automatically. A pile on an ace can be unloaded back onto the tableau to free its spot, and auto-playing proved to lose winnable deals (e.g. seed 26). That flexibility is a big part of why BBB is so forgiving.

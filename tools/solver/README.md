# Solver

Exhaustive solver to measure how many deals of BBB (and rule variants) can be won. Deals are the game's own: `./solver r1 <seed> …` uses the same deal as `bbb.deal(seed)`.

```sh
g++ -O3 -march=native -fopenmp -o solver solver.cpp
./solver                                  # lists the rulesets
./solver r1 1 10000 2000000               # seeds 1..10000, give up on a deal after 2M distinct states
./solver r1 58 1 1 --show                 # print a deal
./solver r1 1 100 2000000 --moves         # also print each solution
```

Each deal ends up `SOLVED`, `UNSOLVABLE` (every reachable state was visited) or `UNKNOWN` (the state budget ran out). The search is best-first over all states; columns and foundations are interchangeable, so states that differ only in pile order count once.

With A→E-only foundations (`r2*`), cards are played to the foundations automatically: a card there can only host cards already beneath it, so that never costs a win. In BBB itself (`r1`) it can: a pile on an ace can be unloaded back onto the tableau to free the foundation, so nothing is automatic there.

Results: [`docs/plans/solvability/RESULTS.md`](../../docs/plans/solvability/RESULTS.md).

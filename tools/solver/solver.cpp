// Exhaustive solver for BBB and rule variants. Deals match the game (`bbb.deal(seed)`): same PRNG, same shuffle.
//
// Build: g++ -O3 -march=native -fopenmp -o solver solver.cpp
// Run:   ./solver <ruleset> <first-seed> <count> <state-budget> [--moves | --show]
//
// Best-first search over all reachable states, so each deal ends up SOLVED, UNSOLVABLE (every reachable state
// visited) or UNKNOWN (state budget ran out). Piles are interchangeable: states that only differ in the order of
// columns or foundations count as one.
#include <algorithm>
#include <atomic>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <functional>
#include <queue>
#include <vector>
#include <omp.h>

constexpr int SUITS = 4, RANKS = 14, CARDS = SUITS * RANKS, MAXCOL = 12, MAXLEN = 40;

static inline int suitOf(int c) { return c / RANKS; }
static inline int rankOf(int c) { return c % RANKS; }

struct Rules {
  const char* name;
  const char* desc;
  int cols = 11;                // columns on the table
  int dealCols = 11;            // columns that get cards in the deal
  bool freeFoundations = true;  // any card starts a foundation, cards come back, foundation → foundation
  bool park = false;            // any single card may sit on any column, blocking it
  bool bidir = false;           // build up or down in suit
  bool single = false;          // only one card at a time
  int bottom = 0;               // 0: no bottom access, 1: bottom card only, 2: bottom card or run
};

static const Rules RULESETS[] = {
    {"r1", "current BBB: foundations usable as temporary spots"},
    {"r2", "foundations A→E only", 11, 11, false},
    {"r2a", "r2 + park any single card on any column (blocks it)", 11, 11, false, true},
    {"r2b", "r2 + 1 empty column, build up or down, single cards only", 12, 11, false, false, true, true},
    {"r2c", "r2 + take runs from the bottom of columns too", 11, 11, false, false, false, false, 2},
    {"r2c-empty", "r2c + 1 empty column", 12, 11, false, false, false, false, 2},
    {"r2c-filled", "r2c + 1 extra column in the deal", 12, 12, false, false, false, false, 2},
    {"r2c1", "r2 + take the bottom card (single) of columns too", 11, 11, false, false, false, false, 1},
    {"r2c1-empty", "r2c1 + 1 empty column", 12, 11, false, false, false, false, 1},
    {"r2c1-filled", "r2c1 + 1 extra column in the deal", 12, 12, false, false, false, false, 1},
};

struct State {
  uint8_t c[MAXCOL][MAXLEN];
  uint8_t len[MAXCOL];
  uint8_t parked[MAXCOL];
  // Free foundations: suit (-1 when empty) and the rank range lo..hi. Rooted foundations: fhi[suit] = height - 1.
  int8_t fs[SUITS], flo[SUITS], fhi[SUITS];
};

enum MoveType : uint8_t { T2T, B2T, T2F, F2T, F2F };
struct Move {
  MoveType type;
  uint8_t from, to, count;
};

struct Game {
  const Rules& r;

  bool stacks(int below, int above) const {
    if (suitOf(below) != suitOf(above)) return false;
    int d = rankOf(above) - rankOf(below);
    return d == -1 || (r.bidir && d == 1);
  }

  int topRun(const State& s, int i) const {
    if (s.parked[i]) return 1;
    int n = 1, L = s.len[i];
    while (n < L && stacks(s.c[i][L - n - 1], s.c[i][L - n])) n++;
    return r.single ? 1 : n;
  }

  int bottomRun(const State& s, int i) const {
    int n = 1, L = s.len[i];
    while (n < L && stacks(s.c[i][n - 1], s.c[i][n])) n++;
    return (r.single || r.bottom == 1) ? 1 : n;
  }

  // Can `card` go on foundation f (free foundations) / on its suit's foundation (rooted)?
  bool fits(const State& s, int card, int f) const {
    if (!r.freeFoundations) return s.fhi[suitOf(card)] + 1 == rankOf(card);
    if (s.fs[f] < 0) return true;
    return s.fs[f] == suitOf(card) && s.fhi[f] + 1 == rankOf(card);
  }
  bool rooted(const State& s, int f) const { return s.fs[f] >= 0 && s.flo[f] == 0; }

  void pushFoundation(State& s, int card, int f) const {
    if (!r.freeFoundations) {
      s.fhi[suitOf(card)]++;
    } else if (s.fs[f] < 0) {
      s.fs[f] = suitOf(card), s.flo[f] = s.fhi[f] = rankOf(card);
    } else {
      s.fhi[f]++;
    }
  }
  int popFoundation(State& s, int f) const {
    int card = s.fs[f] * RANKS + s.fhi[f];
    if (--s.fhi[f] < s.flo[f]) s.fs[f] = -1;
    return card;
  }

  // Put cards on top of column `to`; a lone card that doesn't build is parked.
  void place(State& s, int to, const uint8_t* cards, int n) const {
    bool builds = s.len[to] == 0 || stacks(s.c[to][s.len[to] - 1], cards[0]);
    memcpy(&s.c[to][s.len[to]], cards, n);
    s.len[to] += n;
    s.parked[to] = !builds;
  }

  void apply(State& s, const Move& m) const {
    uint8_t buf[MAXLEN];
    switch (m.type) {
      case T2T:
        s.len[m.from] -= m.count;
        memcpy(buf, &s.c[m.from][s.len[m.from]], m.count);
        s.parked[m.from] = 0;
        place(s, m.to, buf, m.count);
        break;
      case B2T:
        memcpy(buf, s.c[m.from], m.count);
        memmove(s.c[m.from], &s.c[m.from][m.count], s.len[m.from] - m.count);
        s.len[m.from] -= m.count;
        place(s, m.to, buf, m.count);
        break;
      case T2F:
        pushFoundation(s, s.c[m.from][--s.len[m.from]], m.to);
        s.parked[m.from] = 0;
        break;
      case F2T: {
        uint8_t card = popFoundation(s, m.from);
        place(s, m.to, &card, 1);
        break;
      }
      case F2F:
        pushFoundation(s, popFoundation(s, m.from), m.to);
        break;
    }
    autoplay(s);
  }

  // With A→E foundations a card there can only ever host cards already beneath it, so playing to the foundation
  // never hurts. Not so with free foundations: a rooted pile can be unloaded onto the tableau to free its spot.
  void autoplay(State& s) const {
    if (r.freeFoundations) return;
    for (bool changed = true; changed;) {
      changed = false;
      for (int i = 0; i < r.cols; i++) {
        while (s.len[i] && fits(s, s.c[i][s.len[i] - 1], 0)) {
          pushFoundation(s, s.c[i][--s.len[i]], 0);
          s.parked[i] = 0, changed = true;
        }
        while (r.bottom && s.len[i] && fits(s, s.c[i][0], 0)) {
          int card = s.c[i][0];
          memmove(s.c[i], &s.c[i][1], --s.len[i]);
          pushFoundation(s, card, 0);
          changed = true;
        }
      }
    }
  }

  bool won(const State& s) const {
    for (int i = 0; i < r.cols; i++)
      if (s.len[i]) return false;
    return true;  // all 56 cards on 4 same-suit runs: each must be a full A→E suit
  }

  int firstEmptyCol(const State& s) const {
    for (int i = 0; i < r.cols; i++)
      if (!s.len[i]) return i;
    return -1;
  }

  void moves(const State& s, std::vector<Move>& out) const {
    out.clear();
    int empty = firstEmptyCol(s);
    auto toColumns = [&](MoveType type, int from, int k, int base) {
      for (int j = 0; j < r.cols; j++) {
        if (j == from) continue;
        if (s.len[j] == 0) {
          if (j != empty || k == s.len[from]) continue;  // empties are interchangeable; moving a whole column is a no-op
        } else if (s.parked[j]) {
          continue;
        } else if (!stacks(s.c[j][s.len[j] - 1], base)) {
          if (!r.park || k != 1 || type != T2T) continue;
        }
        out.push_back({type, (uint8_t)from, (uint8_t)j, (uint8_t)k});
      }
    };
    for (int i = 0; i < r.cols; i++) {
      int L = s.len[i];
      if (!L) continue;
      int run = topRun(s, i);
      for (int k = 1; k <= run; k++) toColumns(T2T, i, k, s.c[i][L - k]);
      if (r.bottom) {
        int brun = bottomRun(s, i);
        for (int k = 1; k <= brun && k < L; k++) toColumns(B2T, i, k, s.c[i][0]);
      }
      if (r.freeFoundations) {
        int card = s.c[i][L - 1];
        bool emptyDone = false;
        for (int f = 0; f < SUITS; f++) {
          if (!fits(s, card, f)) continue;
          if (s.fs[f] < 0) {
            if (emptyDone) continue;
            emptyDone = true;
          }
          out.push_back({T2F, (uint8_t)i, (uint8_t)f, 1});
        }
      }
    }
    if (r.freeFoundations) {
      for (int f = 0; f < SUITS; f++) {
        if (s.fs[f] < 0) continue;
        int card = s.fs[f] * RANKS + s.fhi[f];
        bool alone = s.flo[f] == s.fhi[f];
        for (int j = 0; j < r.cols; j++) {
          if (s.len[j] == 0 ? j != empty : (s.parked[j] || !stacks(s.c[j][s.len[j] - 1], card))) continue;
          out.push_back({F2T, (uint8_t)f, (uint8_t)j, 1});
        }
        bool emptyDone = false;
        for (int g = 0; g < SUITS; g++) {
          if (g == f || !fits(s, card, g)) continue;
          if (s.fs[g] < 0) {
            if (alone || emptyDone) continue;  // a lone card hopping to another empty foundation changes nothing
            emptyDone = true;
          }
          out.push_back({F2F, (uint8_t)f, (uint8_t)g, 1});
        }
      }
    }
  }

  // Search order only (lower is tried first); every reachable state is still visited before giving up.
  int estimate(const State& s) const {
    int done = 0, breaks = 0, empties = 0;
    if (r.freeFoundations) {
      for (int f = 0; f < SUITS; f++) {
        if (rooted(s, f)) done += s.fhi[f] + 1;
        else if (s.fs[f] < 0) empties++;
      }
    } else {
      for (int f = 0; f < SUITS; f++) done += s.fhi[f] + 1;
    }
    for (int i = 0; i < r.cols; i++) {
      if (!s.len[i]) empties++;
      for (int j = 1; j < s.len[i]; j++)
        if (!stacks(s.c[i][j - 1], s.c[i][j]) || (s.parked[i] && j == s.len[i] - 1)) breaks++;
    }
    return 10000 + 4 * (CARDS - done) + 3 * breaks - 2 * empties;
  }

  static uint64_t mix(uint64_t x) {
    x += 0x9e3779b97f4a7c15ull;
    x = (x ^ (x >> 30)) * 0xbf58476d1ce4e5b9ull;
    x = (x ^ (x >> 27)) * 0x94d049bb133111ebull;
    return x ^ (x >> 31);
  }

  // Order-independent over columns and (free) foundations: swapping two piles gives the same hash.
  uint64_t hash(const State& s) const {
    uint64_t h = 0;
    for (int i = 0; i < r.cols; i++) {
      uint64_t ch = 0x51ed27 + s.parked[i];
      for (int j = 0; j < s.len[i]; j++) ch = mix(ch ^ ((uint64_t)s.c[i][j] + 1) << 8);
      h += mix(ch ^ ((uint64_t)s.len[i] << 40));
    }
    if (r.freeFoundations) {
      for (int f = 0; f < SUITS; f++) {
        uint64_t key = s.fs[f] < 0 ? 0xffff : ((uint64_t)s.fs[f] << 16 | (uint64_t)s.flo[f] << 8 | (uint64_t)s.fhi[f]);
        h += mix(key ^ 0xf0f0f0f000000ull);
      }
    } else {
      uint64_t key = 0;
      for (int f = 0; f < SUITS; f++) key = key << 8 | (uint8_t)(s.fhi[f] + 1);
      h ^= mix(key ^ 0xabcdef0000000ull);
    }
    return h ? h : 1;
  }

  State deal(uint32_t seed) const {
    // mulberry32 + Fisher–Yates, exactly as src/core/rng.ts.
    uint32_t a = seed;
    auto rng = [&]() {
      a += 0x6d2b79f5u;
      uint32_t t = (a ^ (a >> 15)) * (1u | a);
      t = (t + (t ^ (t >> 7)) * (61u | t)) ^ t;
      return (double)(t ^ (t >> 14)) / 4294967296.0;
    };
    int deck[CARDS];
    for (int i = 0; i < CARDS; i++) deck[i] = i;
    for (int i = CARDS - 1; i > 0; i--) std::swap(deck[i], deck[(int)(rng() * (i + 1))]);
    State s;
    memset(&s, 0, sizeof s);
    for (int f = 0; f < SUITS; f++) s.fs[f] = -1, s.flo[f] = 0, s.fhi[f] = -1;
    for (int i = 0; i < CARDS; i++) {
      int col = i % r.dealCols;
      s.c[col][s.len[col]++] = deck[i];
    }
    autoplay(s);
    return s;
  }
};

// A state as stored in the search: all column cards back to back, then the lengths.
struct Packed {
  uint8_t cards[CARDS];
  uint8_t len[MAXCOL];
  uint16_t parked;
  int8_t fs[SUITS], flo[SUITS], fhi[SUITS];
  uint32_t parent;
  Move move;
};

static Packed pack(const Game& g, const State& s, uint32_t parent, Move move) {
  Packed p;
  int n = 0;
  p.parked = 0;
  for (int i = 0; i < g.r.cols; i++) {
    memcpy(&p.cards[n], s.c[i], s.len[i]);
    n += s.len[i];
    p.len[i] = s.len[i];
    p.parked |= s.parked[i] << i;
  }
  memcpy(p.fs, s.fs, SUITS), memcpy(p.flo, s.flo, SUITS), memcpy(p.fhi, s.fhi, SUITS);
  p.parent = parent, p.move = move;
  return p;
}

static void unpack(const Game& g, const Packed& p, State& s) {
  int n = 0;
  for (int i = 0; i < g.r.cols; i++) {
    memcpy(s.c[i], &p.cards[n], p.len[i]);
    n += p.len[i];
    s.len[i] = p.len[i];
    s.parked[i] = (p.parked >> i) & 1;
  }
  memcpy(s.fs, p.fs, SUITS), memcpy(s.flo, p.flo, SUITS), memcpy(s.fhi, p.fhi, SUITS);
}

struct HashSet {
  std::vector<uint64_t> t;
  uint64_t mask = 0;
  void init(size_t cap) { t.assign(cap, 0), mask = cap - 1; }
  void clear() { std::fill(t.begin(), t.end(), 0); }
  bool insert(uint64_t k) {
    for (uint64_t i = k & mask;; i = (i + 1) & mask) {
      if (t[i] == k) return false;
      if (!t[i]) return t[i] = k, true;
    }
  }
};

enum Result { SOLVED, UNSOLVABLE, UNKNOWN };

struct Search {
  HashSet seen;
  std::vector<Packed> arena;
  std::vector<Move> moves;
  // (estimate << 32 | ~index): best estimate first, newest first among equals.
  std::priority_queue<uint64_t, std::vector<uint64_t>, std::greater<uint64_t>> open;
};

static Result solve(const Game& g, const State& root, Search& w, size_t budget, size_t& nodes,
                    std::vector<Move>* solution) {
  nodes = 0;
  if (g.won(root)) return SOLVED;
  w.seen.clear();
  w.arena.clear();
  w.open = {};
  w.seen.insert(g.hash(root));
  w.arena.push_back(pack(g, root, UINT32_MAX, {}));
  w.open.push((uint64_t)g.estimate(root) << 32 | 0xffffffffu);
  State s, next;
  while (!w.open.empty()) {
    uint32_t idx = ~(uint32_t)w.open.top();
    w.open.pop();
    unpack(g, w.arena[idx], s);
    g.moves(s, w.moves);
    for (const Move& m : w.moves) {
      next = s;
      g.apply(next, m);
      if (g.won(next)) {
        if (solution) {
          solution->assign(1, m);
          for (uint32_t i = idx; w.arena[i].parent != UINT32_MAX; i = w.arena[i].parent)
            solution->push_back(w.arena[i].move);
          std::reverse(solution->begin(), solution->end());
        }
        return SOLVED;
      }
      if (!w.seen.insert(g.hash(next))) continue;
      if (++nodes > budget) return UNKNOWN;
      uint32_t n = w.arena.size();
      w.arena.push_back(pack(g, next, idx, m));
      w.open.push((uint64_t)g.estimate(next) << 32 | ~n);
    }
  }
  return UNSOLVABLE;
}

int main(int argc, char** argv) {
  if (argc < 5) {
    fprintf(stderr, "usage: %s <ruleset> <first-seed> <count> <state-budget> [--moves | --show]\nrulesets:\n", argv[0]);
    for (auto& r : RULESETS) fprintf(stderr, "  %-12s %s\n", r.name, r.desc);
    return 1;
  }
  const Rules* rules = nullptr;
  for (auto& r : RULESETS)
    if (!strcmp(r.name, argv[1])) rules = &r;
  if (!rules) return fprintf(stderr, "unknown ruleset %s\n", argv[1]), 1;
  uint32_t first = strtoul(argv[2], nullptr, 10);
  int count = atoi(argv[3]);
  size_t budget = strtoull(argv[4], nullptr, 10);
  bool printMoves = argc > 5 && !strcmp(argv[5], "--moves");
  bool show = argc > 5 && !strcmp(argv[5], "--show");

  Game g{*rules};
  if (show) {
    State s = g.deal(first);
    for (int i = 0; i < rules->cols; i++) {
      printf("t%d", i);
      for (int j = 0; j < s.len[i]; j++) printf(" %c%c", "SHDC"[suitOf(s.c[i][j])], "A23456789TJQKE"[rankOf(s.c[i][j])]);
      printf("\n");
    }
    return 0;
  }

  size_t cap = 1;
  while (cap < budget * 2) cap <<= 1;
  std::vector<Result> results(count);
  std::vector<size_t> nodeCounts(count);
  std::vector<std::vector<Move>> solutions(count);
  std::atomic<int> done{0};

#pragma omp parallel
  {
    Search w;
    w.seen.init(cap);
    w.arena.reserve(budget + 1);
#pragma omp for schedule(dynamic, 1)
    for (int i = 0; i < count; i++) {
      results[i] = solve(g, g.deal(first + i), w, budget, nodeCounts[i], printMoves ? &solutions[i] : nullptr);
      int d = ++done;
      if (d % 100 == 0) fprintf(stderr, "\r%d/%d", d, count);
    }
  }
  fprintf(stderr, "\r");

  int tally[3] = {};
  static const char* names[] = {"SOLVED", "UNSOLVABLE", "UNKNOWN"};
  for (int i = 0; i < count; i++) {
    tally[results[i]]++;
    if (!printMoves && results[i] == SOLVED) continue;
    printf("seed %u %s nodes=%zu", first + i, names[results[i]], nodeCounts[i]);
    if (printMoves && results[i] == SOLVED) {
      static const char* types[] = {"tt", "bt", "tf", "ft", "ff"};
      printf(" moves=");
      for (auto& m : solutions[i]) printf("%s:%d:%d:%d,", types[m.type], m.from, m.to, m.count);
    }
    printf("\n");
  }
  printf("%s: %d deals, solved %d (%.2f%%), unsolvable %d (%.2f%%), unknown %d (%.2f%%)\n", rules->name, count,
         tally[SOLVED], 100.0 * tally[SOLVED] / count, tally[UNSOLVABLE], 100.0 * tally[UNSOLVABLE] / count,
         tally[UNKNOWN], 100.0 * tally[UNKNOWN] / count);
}

import { buildCards, type Card } from '../deck';
import { standardDeck } from '../decks/standard';
import { createRng, shuffle } from '../rng';
import { applyMove, downCount, foundationId, pileKind, STOCK, tableauId, WASTE, type GameState, type Move, type PileId } from '../state';
import { cardIndex, type Variant } from '../variant';

const TABLEAU = 7;
const FOUNDATIONS = 4;

const deck = standardDeck;
const cards = cardIndex(deck);
const KING = deck.ranks.length - 1;

function card(id: string): Card {
  const c = cards.get(id);
  if (!c) throw new Error(`Unknown card ${id}`);
  return c;
}

const top = (pile: string[] | undefined): Card | undefined =>
  pile && pile.length ? card(pile[pile.length - 1]!) : undefined;

const isRed = (c: Card) => deck.suits[c.suit]!.color === 'red';

/** `above` goes on `below` in a column: one rank lower, the other colour. */
const goesOn = (above: Card, below: Card) => isRed(above) !== isRed(below) && above.rank === below.rank - 1;

/** Each card one rank below the one it sits on, alternating colours. */
function isRun(ids: string[]): boolean {
  for (let i = 1; i < ids.length; i++) if (!goesOn(card(ids[i]!), card(ids[i - 1]!))) return false;
  return true;
}

const tableaus = () => Array.from({ length: TABLEAU }, (_, i) => tableauId(i));
const foundations = () => Array.from({ length: FOUNDATIONS }, (_, i) => foundationId(i));

/** Cards of each suit already on the foundations, by suit index. */
function foundationCounts(state: GameState): number[] {
  const counts = deck.suits.map(() => 0);
  for (const f of foundations()) {
    const ids = state.piles[f] ?? [];
    if (ids.length) counts[card(ids[0]!).suit] = ids.length;
  }
  return counts;
}

/**
 * Nothing on the table can still need `c`: aces and twos never hold anything worth keeping, and any other card only
 * holds the two cards of the other colour one rank lower, so once both of those are up, so can it go.
 */
function isSafe(c: Card, counts: readonly number[]): boolean {
  if (c.rank <= 1) return true;
  return deck.suits.every((s, i) => s.color === deck.suits[c.suit]!.color || counts[i]! >= c.rank);
}

/** Klondike, draw one: build down in alternating colours, foundations A → K by suit, unlimited passes through the stock. */
export const klondike: Variant = {
  id: 'klondike',
  name: 'Klondike',
  deck,
  tableauCount: TABLEAU,
  foundationCount: FOUNDATIONS,
  hasStock: true,
  hasWaste: true,

  piles() {
    return [STOCK, WASTE, ...Array.from({ length: FOUNDATIONS }, (_, i) => foundationId(i)), ...tableaus()];
  },

  card,

  /** Column n gets n cards with only the top one face up; the rest is the stock, face down. */
  deal(seed) {
    const shuffled = shuffle(buildCards(deck), createRng(seed)).map((c) => c.id);
    const piles: Record<PileId, string[]> = {};
    const down: Record<PileId, number> = {};
    for (const id of this.piles()) piles[id] = [];
    tableaus().forEach((id, i) => {
      piles[id] = shuffled.splice(0, i + 1);
      down[id] = i;
    });
    piles[STOCK] = shuffled;
    down[STOCK] = shuffled.length;
    return { seed, piles, down, started: false, won: false };
  },

  /** Row by row, like dealing by hand; the stock stays where it is. */
  dealOrder(state) {
    const order: string[] = [];
    for (let row = 0; row < TABLEAU; row++) {
      for (let c = row; c < TABLEAU; c++) {
        const id = state.piles[tableauId(c)]?.[row];
        if (id) order.push(id);
      }
    }
    return order;
  },

  canPickUp(state, pile, count) {
    const ids = state.piles[pile];
    if (!ids || count < 1 || count > ids.length) return false;
    switch (pileKind(pile)) {
      case 'tableau':
        return count <= ids.length - downCount(state, pile) && isRun(ids.slice(ids.length - count));
      case 'waste':
      case 'foundation':
        return count === 1;
      case 'stock':
        return false;
    }
  },

  canMove(state, move) {
    if (move.from === move.to) return false;
    const from = state.piles[move.from] ?? [];
    // Drawing, and turning the waste back over once the stock is empty
    if (pileKind(move.to) === 'waste') return move.from === STOCK && move.count === 1 && from.length > 0;
    if (pileKind(move.to) === 'stock') {
      return move.from === WASTE && !state.piles[STOCK]?.length && from.length > 0 && move.count === from.length;
    }

    if (!this.canPickUp(state, move.from, move.count)) return false;
    const moving = card(from[from.length - move.count]!);
    const target = top(state.piles[move.to]);
    if (pileKind(move.to) === 'tableau') return target ? goesOn(moving, target) : moving.rank === KING;
    if (move.count !== 1) return false;
    return target ? target.suit === moving.suit && target.rank === moving.rank - 1 : moving.rank === 0;
  },

  apply(state, move) {
    const next = applyMove(state, move);
    const down = { ...state.down };
    // The waste turns over as a whole: its top card ends up at the bottom of the stock.
    if (move.to === STOCK) next.piles[STOCK] = next.piles[STOCK]!.reverse();
    down[STOCK] = next.piles[STOCK]!.length;
    // A face-down card left on top of a column turns over.
    const left = next.piles[move.from]!.length;
    if (pileKind(move.from) === 'tableau' && downCount(state, move.from) >= left) down[move.from] = Math.max(left - 1, 0);
    return { ...next, down };
  },

  tap(state, pile) {
    if (pile !== STOCK) return null;
    const waste = state.piles[WASTE] ?? [];
    if (state.piles[STOCK]?.length) return { from: STOCK, to: WASTE, count: 1 };
    return waste.length ? { from: WASTE, to: STOCK, count: waste.length } : null;
  },

  /** The top of a column it can go on. */
  hintTarget(state, id) {
    const held = card(id);
    for (const pile of tableaus()) {
      const ids = state.piles[pile]!;
      const t = top(ids);
      if (t && downCount(state, pile) < ids.length && goesOn(held, t)) return ids[ids.length - 1]!;
    }
    return null;
  },

  /** A face-up card that can go on it: the top of the waste, or one in a column. */
  hintSource(state, id) {
    const held = card(id);
    const waste = state.piles[WASTE]!.at(-1);
    if (waste && goesOn(card(waste), held)) return waste;
    for (const pile of tableaus()) {
      const ids = state.piles[pile]!;
      const match = ids.slice(downCount(state, pile)).find((other) => goesOn(card(other), held));
      if (match) return match;
    }
    return null;
  },

  isWon(state) {
    for (let f = 0; f < FOUNDATIONS; f++) if (state.piles[foundationId(f)]?.length !== deck.ranks.length) return false;
    return true;
  },

  /** The lowest safe card on top of the waste or a column, onto its foundation. */
  safeCascadeMove(state) {
    const counts = foundationCounts(state);
    let best: { move: Move; rank: number } | null = null;
    for (const from of [WASTE, ...tableaus()]) {
      const id = state.piles[from]?.at(-1);
      if (!id) continue;
      const c = card(id);
      if ((best && best.rank <= c.rank) || !isSafe(c, counts)) continue;
      const to = foundations().find((f) => this.canMove(state, { from, to: f, count: 1 }));
      if (to) best = { move: { from, to, count: 1 }, rank: c.rank };
    }
    return best?.move ?? null;
  },
};

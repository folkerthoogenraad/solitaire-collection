import { buildCards, type Card } from '../deck';
import { emperorDeck } from '../decks/emperor';
import { createRng, shuffle } from '../rng';
import { foundationId, pileKind, STOCK, tableauId, type Move, type PileId } from '../state';
import { cardIndex, type Variant } from '../variant';

const TABLEAU = 11;
const FOUNDATIONS = 4;

const deck = emperorDeck;
const cards = cardIndex(deck);

function card(id: string): Card {
  const c = cards.get(id);
  if (!c) throw new Error(`Unknown card ${id}`);
  return c;
}

const top = (pile: string[] | undefined): Card | undefined =>
  pile && pile.length ? card(pile[pile.length - 1]!) : undefined;

/** Same suit, each card exactly one rank below the one it sits on. */
function isRun(ids: string[]): boolean {
  for (let i = 1; i < ids.length; i++) {
    const below = card(ids[i - 1]!);
    const above = card(ids[i]!);
    if (above.suit !== below.suit || above.rank !== below.rank - 1) return false;
  }
  return true;
}

/** "Bobbie's Beautiful Bugs": everything dealt face up, build down by suit, foundations A → E by suit. */
export const bbb: Variant = {
  id: 'bbb',
  deck,
  tableauCount: TABLEAU,
  foundationCount: FOUNDATIONS,
  hasStock: true,

  piles() {
    return [
      STOCK,
      ...Array.from({ length: FOUNDATIONS }, (_, i) => foundationId(i)),
      ...Array.from({ length: TABLEAU }, (_, i) => tableauId(i)),
    ];
  },

  card,

  deal(seed) {
    const shuffled = shuffle(buildCards(deck), createRng(seed));
    const piles: Record<PileId, string[]> = {};
    for (const id of this.piles()) piles[id] = [];
    // Round-robin left to right, so the first columns get the remainder.
    shuffled.forEach((c, i) => piles[tableauId(i % TABLEAU)]!.push(c.id));
    return { seed, piles, started: false, won: false };
  },

  canPickUp(state, pile, count) {
    const ids = state.piles[pile];
    if (!ids || count < 1 || count > ids.length) return false;
    switch (pileKind(pile)) {
      case 'tableau':
        return isRun(ids.slice(ids.length - count));
      case 'foundation':
        return count === 1;
      case 'stock':
        return false;
    }
  },

  canMove(state, move: Move) {
    if (move.from === move.to || !this.canPickUp(state, move.from, move.count)) return false;
    const from = state.piles[move.from]!;
    const moving = card(from[from.length - move.count]!);
    const target = top(state.piles[move.to]);

    switch (pileKind(move.to)) {
      case 'tableau':
        return !target || (target.suit === moving.suit && target.rank === moving.rank + 1);
      case 'foundation':
        if (move.count !== 1) return false;
        return !target || (target.suit === moving.suit && target.rank === moving.rank - 1);
      case 'stock':
        return false;
    }
  },

  isWon(state) {
    for (let i = 0; i < TABLEAU; i++) if (state.piles[tableauId(i)]?.length) return false;
    for (let f = 0; f < FOUNDATIONS; f++) {
      const ids = state.piles[foundationId(f)] ?? [];
      if (ids.length !== deck.ranks.length) return false;
      const suit = card(ids[0]!).suit;
      if (!ids.every((id, r) => card(id).rank === r && card(id).suit === suit)) return false;
    }
    return true;
  },
};

export interface SuitDef {
  id: string;
  /** Used for theming (e.g. `--suit-spades`). */
  name: string;
  glyph: string;
  /** For rules that alternate colours (Klondike), whatever colour a skin draws the suit in. */
  color: 'red' | 'black';
}

export interface RankDef {
  id: string;
  label: string;
}

/** A deck is a set of suits and an ordered (low → high) list of ranks. */
export interface DeckDefinition {
  id: string;
  suits: readonly SuitDef[];
  ranks: readonly RankDef[];
}

export interface Card {
  id: string;
  /** Index into `deck.suits`. */
  suit: number;
  /** Index into `deck.ranks`; higher is higher. */
  rank: number;
}

export function buildCards(deck: DeckDefinition): Card[] {
  const cards: Card[] = [];
  deck.suits.forEach((suit, s) => {
    deck.ranks.forEach((rank, r) => {
      cards.push({ id: `${suit.id}${rank.id}`, suit: s, rank: r });
    });
  });
  return cards;
}

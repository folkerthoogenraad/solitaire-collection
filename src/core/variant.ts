import { buildCards, type Card, type DeckDefinition } from './deck';
import type { GameState, Move, PileId } from './state';

/** A ruleset. The UI only talks to the game through this interface. */
export interface Variant {
  id: string;
  deck: DeckDefinition;
  tableauCount: number;
  foundationCount: number;
  hasStock: boolean;
  /** All pile ids in a stable order. */
  piles(): PileId[];
  card(id: string): Card;
  deal(seed: number): GameState;
  /** Can the top `count` cards of `pile` be picked up together? */
  canPickUp(state: GameState, pile: PileId, count: number): boolean;
  canMove(state: GameState, move: Move): boolean;
  isWon(state: GameState): boolean;
}

export function cardIndex(deck: DeckDefinition): Map<string, Card> {
  return new Map(buildCards(deck).map((c) => [c.id, c]));
}

import { buildCards, type Card, type DeckDefinition } from './deck';
import type { GameState, Move, PileId } from './state';

/** A ruleset. The UI only talks to the game through this interface. */
export interface Variant {
  id: string;
  /** Shown where the skin has no emblem for the variant. */
  name: string;
  deck: DeckDefinition;
  tableauCount: number;
  foundationCount: number;
  hasStock: boolean;
  /** A waste pile next to the stock, which the stock is drawn onto. */
  hasWaste: boolean;
  /** All pile ids in a stable order. */
  piles(): PileId[];
  card(id: string): Card;
  deal(seed: number): GameState;
  /** Cards that fly out of the stock on a new deal, in order; cards left out stay where they are. */
  dealOrder(state: GameState): string[];
  /** Can the top `count` cards of `pile` be picked up together? */
  canPickUp(state: GameState, pile: PileId, count: number): boolean;
  canMove(state: GameState, move: Move): boolean;
  /** Applies a legal move, with whatever follows from it (such as turning over a card). */
  apply(state: GameState, move: Move): GameState;
  /** What tapping a pile does, if anything (drawing from the stock). */
  tap(state: GameState, pile: PileId): Move | null;
  /** Hint while holding `id`: the card it goes on. */
  hintTarget(state: GameState, id: string): string | null;
  /** Hint while right-clicking `id`: the card that goes on it. */
  hintSource(state: GameState, id: string): string | null;
  isWon(state: GameState): boolean;
  /**
   * Variants whose autocascade sweeps the whole table: the next card that can safely go onto a foundation, from any
   * pile. Without it, an autocascade moves one suit onto the pile it was offered on.
   */
  safeCascadeMove?(state: GameState): Move | null;
}

export function cardIndex(deck: DeckDefinition): Map<string, Card> {
  return new Map(buildCards(deck).map((c) => [c.id, c]));
}

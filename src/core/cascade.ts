import { pileKind, type GameState, type Move, type PileId } from './state';
import type { Variant } from './variant';

/** Next single-card move onto `foundation` from the top of any tableau or foundation pile, if there is one. */
export function nextCascadeMove(variant: Variant, state: GameState, foundation: PileId): Move | null {
  if (!state.piles[foundation]?.length) return null;
  for (const from of variant.piles()) {
    if (pileKind(from) === 'stock') continue;
    const move = { from, to: foundation, count: 1 };
    if (variant.canMove(state, move)) return move;
  }
  return null;
}

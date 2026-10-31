import { pileKind, type GameState, type Move, type PileId } from './state';
import type { Variant } from './variant';

/**
 * Next single-card move onto `target`, if there is one. A foundation takes from the top of any tableau or foundation
 * pile; a tableau pile takes back from the top of a foundation. Piles in `skip` are left alone: two cascades in
 * opposite directions would otherwise pass the same card back and forth.
 */
export function nextCascadeMove(variant: Variant, state: GameState, target: PileId, skip: ReadonlySet<PileId> = new Set()): Move | null {
  if (!state.piles[target]?.length) return null;
  const kind = pileKind(target);
  if (kind === 'stock') return null;
  for (const from of variant.piles()) {
    if (skip.has(from) || pileKind(from) === 'stock') continue;
    if (kind === 'tableau' && pileKind(from) !== 'foundation') continue;
    const move = { from, to: target, count: 1 };
    if (variant.canMove(state, move)) return move;
  }
  return null;
}

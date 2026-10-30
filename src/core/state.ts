export type PileKind = 'tableau' | 'foundation' | 'stock';

/** `t0`..`tN`, `f0`..`fN` or `stock`. */
export type PileId = string;

export interface GameState {
  seed: number;
  /** Card ids per pile, bottom → top. */
  piles: Record<PileId, string[]>;
  /** True once the player made a move; used to confirm abandoning a game. */
  started: boolean;
  won: boolean;
}

export interface Move {
  from: PileId;
  to: PileId;
  /** Number of cards taken from the top of `from`. */
  count: number;
}

export const tableauId = (i: number): PileId => `t${i}`;
export const foundationId = (i: number): PileId => `f${i}`;
export const STOCK: PileId = 'stock';

export function pileKind(id: PileId): PileKind {
  if (id === STOCK) return 'stock';
  return id.startsWith('f') ? 'foundation' : 'tableau';
}

/** Returns a new state with the move applied. Does not validate. */
export function applyMove(state: GameState, move: Move): GameState {
  const from = state.piles[move.from] ?? [];
  const to = state.piles[move.to] ?? [];
  const moving = from.slice(from.length - move.count);
  return {
    ...state,
    started: true,
    piles: {
      ...state.piles,
      [move.from]: from.slice(0, from.length - move.count),
      [move.to]: [...to, ...moving],
    },
  };
}

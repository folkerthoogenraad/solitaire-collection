import { describe, expect, it } from 'vitest';
import { nextCascadeMove } from './cascade';
import type { GameState, PileId } from './state';
import { bbb } from './variants/bbb';

function board(piles: Record<PileId, string[]>): GameState {
  const all: Record<PileId, string[]> = {};
  for (const id of bbb.piles()) all[id] = [];
  return { seed: 0, piles: { ...all, ...piles }, started: false, won: false };
}

describe('cascade', () => {
  it('finds the next card of the suit on top of a column', () => {
    const state = board({ f0: ['SA'], t3: ['H4', 'S2'] });
    expect(nextCascadeMove(bbb, state, 'f0')).toEqual({ from: 't3', to: 'f0', count: 1 });
  });

  it('takes the next card from the top of another foundation', () => {
    const state = board({ f0: ['SA'], f2: ['S2'] });
    expect(nextCascadeMove(bbb, state, 'f0')).toEqual({ from: 'f2', to: 'f0', count: 1 });
  });

  it('ignores the next card when it is buried', () => {
    const state = board({ f0: ['SA'], t3: ['S2', 'H4'] });
    expect(nextCascadeMove(bbb, state, 'f0')).toBeNull();
  });

  it('does nothing for an empty foundation', () => {
    const state = board({ t3: ['S2'] });
    expect(nextCascadeMove(bbb, state, 'f0')).toBeNull();
  });
});

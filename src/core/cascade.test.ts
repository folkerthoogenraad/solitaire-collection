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

  it('takes a column the next card down from a foundation', () => {
    const state = board({ f1: ['SA', 'S2', 'S3', 'S4'], t3: ['H9', 'S5'] });
    expect(nextCascadeMove(bbb, state, 't3')).toEqual({ from: 'f1', to: 't3', count: 1 });
  });

  it('does not take a column cards from other columns', () => {
    const state = board({ t2: ['S4'], t3: ['S5'] });
    expect(nextCascadeMove(bbb, state, 't3')).toBeNull();
  });

  it('leaves skipped piles alone', () => {
    const state = board({ f0: ['SA', 'S2', 'S3'], t3: ['S5', 'S4'] });
    expect(nextCascadeMove(bbb, state, 'f0', new Set(['t3']))).toBeNull();
    expect(nextCascadeMove(bbb, state, 'f0')).toEqual({ from: 't3', to: 'f0', count: 1 });
  });
});

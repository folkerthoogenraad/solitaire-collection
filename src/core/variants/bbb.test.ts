import { describe, expect, it } from 'vitest';
import { applyMove, type GameState, type PileId } from '../state';
import { bbb } from './bbb';

/** Empty board with the given piles filled in. */
function board(piles: Record<PileId, string[]>): GameState {
  const all: Record<PileId, string[]> = {};
  for (const id of bbb.piles()) all[id] = [];
  return { seed: 0, piles: { ...all, ...piles }, started: false, won: false };
}

describe('deal', () => {
  it('deals all 56 cards face up into 11 columns, first column gets the extra card', () => {
    const state = bbb.deal(123);
    const lengths = Array.from({ length: 11 }, (_, i) => state.piles[`t${i}`]!.length);
    expect(lengths).toEqual([6, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5]);
    const ids = Object.values(state.piles).flat();
    expect(new Set(ids).size).toBe(56);
    expect(state.piles.stock).toEqual([]);
    expect(state.piles.f0).toEqual([]);
  });

  it('is deterministic per seed', () => {
    expect(bbb.deal(7)).toEqual(bbb.deal(7));
    expect(bbb.deal(7)).not.toEqual(bbb.deal(8));
  });
});

describe('picking up', () => {
  const state = board({ t0: ['SK', 'H9', 'H8', 'H7'], t1: ['D5', 'D3'], f0: ['CA', 'C2'] });

  it('allows the top card', () => expect(bbb.canPickUp(state, 't1', 1)).toBe(true));
  it('allows a same-suit descending run', () => expect(bbb.canPickUp(state, 't0', 3)).toBe(true));
  it('rejects a broken run', () => expect(bbb.canPickUp(state, 't0', 4)).toBe(false));
  it('rejects a gap in sequence', () => expect(bbb.canPickUp(state, 't1', 2)).toBe(false));
  it('allows one card from a foundation', () => expect(bbb.canPickUp(state, 'f0', 1)).toBe(true));
  it('rejects multiple cards from a foundation', () => expect(bbb.canPickUp(state, 'f0', 2)).toBe(false));
  it('rejects the stock', () => expect(bbb.canPickUp(state, 'stock', 1)).toBe(false));
});

describe('tableau moves', () => {
  const state = board({
    t0: ['H8'],
    t1: ['H7'],
    t2: ['S7'],
    t3: [],
    t4: ['DT', 'D9', 'D8', 'D7', 'D6'],
    t5: ['SA'],
    t6: ['CE'],
    t7: ['CK'],
  });

  it('places a card on the next rank of the same suit', () =>
    expect(bbb.canMove(state, { from: 't1', to: 't0', count: 1 })).toBe(true));
  it('rejects a different suit', () => expect(bbb.canMove(state, { from: 't2', to: 't0', count: 1 })).toBe(false));
  it('rejects placing on a lower card', () => expect(bbb.canMove(state, { from: 't0', to: 't1', count: 1 })).toBe(false));
  it('allows any card onto an empty column', () =>
    expect(bbb.canMove(state, { from: 't2', to: 't3', count: 1 })).toBe(true));
  it('allows a run onto an empty column', () =>
    expect(bbb.canMove(state, { from: 't4', to: 't3', count: 5 })).toBe(true));
  it('allows K onto E', () => expect(bbb.canMove(state, { from: 't7', to: 't6', count: 1 })).toBe(true));
  it('allows nothing onto an A', () => {
    const s = board({ t0: ['SA'], t1: ['S2'] });
    expect(bbb.canMove(s, { from: 't1', to: 't0', count: 1 })).toBe(false);
  });
  it('moves a run onto the next rank', () => {
    const s = board({ t0: ['HT'], t1: ['S2', 'H9', 'H8', 'H7', 'H6'] });
    expect(bbb.canMove(s, { from: 't1', to: 't0', count: 4 })).toBe(true);
    expect(applyMove(s, { from: 't1', to: 't0', count: 4 }).piles.t0).toEqual(['HT', 'H9', 'H8', 'H7', 'H6']);
  });
  it('rejects moving onto the same pile', () =>
    expect(bbb.canMove(state, { from: 't0', to: 't0', count: 1 })).toBe(false));
  it('rejects the stock as a target', () =>
    expect(bbb.canMove(state, { from: 't0', to: 'stock', count: 1 })).toBe(false));
});

describe('foundation moves', () => {
  const state = board({ t0: ['H8'], t1: ['H9'], t2: ['S9'], t3: ['D3', 'D2'], f0: ['H7', 'H8'], f1: [] });

  it('allows any card onto an empty foundation', () =>
    expect(bbb.canMove(state, { from: 't2', to: 'f1', count: 1 })).toBe(true));
  it('allows the next rank of the same suit', () =>
    expect(bbb.canMove(state, { from: 't1', to: 'f0', count: 1 })).toBe(true));
  it('rejects a different suit', () => expect(bbb.canMove(state, { from: 't2', to: 'f0', count: 1 })).toBe(false));
  it('rejects a lower card', () => expect(bbb.canMove(state, { from: 't0', to: 'f0', count: 1 })).toBe(false));
  it('rejects runs, even onto an empty foundation', () =>
    expect(bbb.canMove(state, { from: 't3', to: 'f1', count: 2 })).toBe(false));
  it('allows foundation → tableau with normal placement rules', () => {
    const s = board({ f0: ['H7', 'H8'], t0: ['H9'], t1: ['S9'] });
    expect(bbb.canMove(s, { from: 'f0', to: 't0', count: 1 })).toBe(true);
    expect(bbb.canMove(s, { from: 'f0', to: 't1', count: 1 })).toBe(false);
  });
  it('allows foundation → foundation', () => {
    const s = board({ f0: ['H7', 'H8'], f1: ['H9'], f2: [] });
    expect(bbb.canMove(s, { from: 'f0', to: 'f2', count: 1 })).toBe(true);
    expect(bbb.canMove(s, { from: 'f0', to: 'f1', count: 1 })).toBe(false);
  });
});

describe('win', () => {
  const full = (suit: string) => ['A', '2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'E'].map((r) => suit + r);

  it('is won with four complete A→E foundations and an empty tableau', () => {
    expect(bbb.isWon(board({ f0: full('S'), f1: full('H'), f2: full('D'), f3: full('C') }))).toBe(true);
  });

  it('is not won when a foundation does not start at A', () => {
    const s = board({ f0: full('S').slice(7), f1: full('H'), f2: full('D'), f3: full('C'), t0: full('S').slice(0, 7) });
    expect(bbb.isWon(s)).toBe(false);
  });

  it('is not won on a fresh deal', () => expect(bbb.isWon(bbb.deal(1))).toBe(false));
});

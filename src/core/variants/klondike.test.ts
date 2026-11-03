import { describe, expect, it } from 'vitest';
import { downCount, type GameState, type PileId } from '../state';
import { klondike } from './klondike';

/** Empty board with the given piles filled in, everything face up unless `down` says otherwise. */
function board(piles: Record<PileId, string[]>, down: Record<PileId, number> = {}): GameState {
  const all: Record<PileId, string[]> = {};
  for (const id of klondike.piles()) all[id] = [];
  return { seed: 0, piles: { ...all, ...piles }, down, started: false, won: false };
}

describe('deal', () => {
  const state = klondike.deal(123);

  it('deals 1..7 cards into the columns, only the top one face up', () => {
    for (let i = 0; i < 7; i++) {
      expect(state.piles[`t${i}`]).toHaveLength(i + 1);
      expect(downCount(state, `t${i}`)).toBe(i);
    }
  });

  it('puts the other 24 cards in the stock, face down', () => {
    expect(state.piles.stock).toHaveLength(24);
    expect(downCount(state, 'stock')).toBe(24);
    expect(state.piles.waste).toEqual([]);
    expect(new Set(Object.values(state.piles).flat()).size).toBe(52);
  });

  it('is deterministic per seed', () => expect(klondike.deal(7)).toEqual(klondike.deal(7)));

  it('flies the columns out row by row and leaves the stock', () => {
    const order = klondike.dealOrder(state);
    expect(order).toHaveLength(28);
    expect(order.slice(0, 7)).toEqual(Array.from({ length: 7 }, (_, i) => state.piles[`t${i}`]![0]));
    expect(order[7]).toBe(state.piles.t1![1]);
  });
});

describe('picking up', () => {
  const state = board({ t0: ['SK', 'S9', 'H8', 'C7'], t1: ['D5', 'C3'], waste: ['HA', 'H2'], f0: ['CA', 'C2'] }, { t0: 1 });

  it('allows an alternating-colour run', () => expect(klondike.canPickUp(state, 't0', 3)).toBe(true));
  it('rejects face-down cards', () => expect(klondike.canPickUp(state, 't0', 4)).toBe(false));
  it('rejects a broken run', () => expect(klondike.canPickUp(state, 't1', 2)).toBe(false));
  it('allows the top of the waste only', () => {
    expect(klondike.canPickUp(state, 'waste', 1)).toBe(true);
    expect(klondike.canPickUp(state, 'waste', 2)).toBe(false);
  });
  it('allows one card from a foundation', () => expect(klondike.canPickUp(state, 'f0', 1)).toBe(true));
  it('rejects the stock', () => expect(klondike.canPickUp(state, 'stock', 1)).toBe(false));
});

describe('tableau moves', () => {
  const state = board({ t0: ['H8'], t1: ['S7'], t2: ['C7'], t3: ['D7'], t4: [], t5: ['HK', 'SQ'], waste: ['DK'] });

  it('places a card of the other colour, one rank lower', () => {
    expect(klondike.canMove(state, { from: 't1', to: 't0', count: 1 })).toBe(true);
    expect(klondike.canMove(state, { from: 't2', to: 't0', count: 1 })).toBe(true);
  });
  it('rejects the same colour', () => expect(klondike.canMove(state, { from: 't3', to: 't0', count: 1 })).toBe(false));
  it('allows only a King onto an empty column', () => {
    expect(klondike.canMove(state, { from: 't1', to: 't4', count: 1 })).toBe(false);
    expect(klondike.canMove(state, { from: 'waste', to: 't4', count: 1 })).toBe(true);
    expect(klondike.canMove(state, { from: 't5', to: 't4', count: 2 })).toBe(true);
  });
});

describe('foundation moves', () => {
  const state = board({ t0: ['HA'], t1: ['S2'], t2: ['H2'], f0: [], f1: ['SA'] });

  it('starts a foundation with an ace only', () => {
    expect(klondike.canMove(state, { from: 't0', to: 'f0', count: 1 })).toBe(true);
    expect(klondike.canMove(state, { from: 't2', to: 'f0', count: 1 })).toBe(false);
  });
  it('builds up by suit', () => {
    expect(klondike.canMove(state, { from: 't1', to: 'f1', count: 1 })).toBe(true);
    expect(klondike.canMove(state, { from: 't2', to: 'f1', count: 1 })).toBe(false);
  });
});

describe('turning over', () => {
  it('turns over the card left on top of a column', () => {
    const state = board({ t1: ['C9', 'HK', 'D8'], t0: ['S9'] }, { t1: 2 });
    const next = klondike.apply(state, { from: 't1', to: 't0', count: 1 });
    expect(next.piles.t1).toEqual(['C9', 'HK']);
    expect(downCount(next, 't1')).toBe(1);
  });

  it('leaves an emptied column at zero', () => {
    const state = board({ t1: ['HK'], t0: [] });
    expect(downCount(klondike.apply(state, { from: 't1', to: 't0', count: 1 }), 't1')).toBe(0);
  });
});

describe('stock', () => {
  it('draws one card face up onto the waste', () => {
    const state = board({ stock: ['SA', 'H2', 'D3'] }, { stock: 3 });
    const move = klondike.tap(state, 'stock')!;
    expect(move).toEqual({ from: 'stock', to: 'waste', count: 1 });
    const next = klondike.apply(state, move);
    expect(next.piles.waste).toEqual(['D3']);
    expect(downCount(next, 'stock')).toBe(2);
    expect(downCount(next, 'waste')).toBe(0);
  });

  it('turns the waste back over when the stock is empty, so it draws in the same order again', () => {
    const state = board({ waste: ['D3', 'H2', 'SA'] });
    const move = klondike.tap(state, 'stock')!;
    expect(move).toEqual({ from: 'waste', to: 'stock', count: 3 });
    const next = klondike.apply(state, move);
    expect(next.piles.stock).toEqual(['SA', 'H2', 'D3']);
    expect(next.piles.waste).toEqual([]);
    expect(downCount(next, 'stock')).toBe(3);
  });

  it('does nothing with both empty, or when tapping another pile', () => {
    expect(klondike.tap(board({}), 'stock')).toBeNull();
    expect(klondike.tap(board({ stock: ['SA'] }), 't0')).toBeNull();
  });

  it('only takes the waste back while the stock is empty', () =>
    expect(klondike.canMove(board({ stock: ['SA'], waste: ['H2'] }), { from: 'waste', to: 'stock', count: 1 })).toBe(false));
});

describe('hints', () => {
  const state = board({ t0: ['S9'], t1: ['H9', 'C8'], t2: ['DQ', 'H7'], waste: ['D8'] }, { t2: 1 });

  it('points at the top of a column the held card goes on', () => expect(klondike.hintTarget(state, 'D8')).toBe('S9'));
  it('points at a face-up card that goes on the held one', () => expect(klondike.hintSource(state, 'S9')).toBe('D8'));
  it('ignores face-down cards', () => expect(klondike.hintTarget(state, 'CJ')).toBeNull());
});

describe('safe autocascade', () => {
  it('always moves aces and twos, lowest first', () => {
    const state = board({ t0: ['C9', 'D2'], t1: ['SA'], f0: ['DA'] });
    expect(klondike.safeCascadeMove!(state)).toEqual({ from: 't1', to: 'f1', count: 1 });
    expect(klondike.safeCascadeMove!(board({ t0: ['C9', 'D2'], f0: ['DA'] }))).toEqual({ from: 't0', to: 'f0', count: 1 });
  });

  it('moves a card once both of the other colour one rank lower are up', () => {
    const state = board({ waste: ['H3'], f0: ['HA', 'H2'], f1: ['SA', 'S2'], f2: ['CA'] });
    expect(klondike.safeCascadeMove!(state)).toBeNull();
    const ready = board({ waste: ['H3'], f0: ['HA', 'H2'], f1: ['SA', 'S2'], f2: ['CA', 'C2'] });
    expect(klondike.safeCascadeMove!(ready)).toEqual({ from: 'waste', to: 'f0', count: 1 });
  });

  it("doesn't care about the same colour", () => {
    const state = board({ t3: ['H3'], f0: ['HA', 'H2'], f1: ['SA', 'S2'], f2: ['CA', 'C2'] });
    expect(klondike.safeCascadeMove!(state)).toEqual({ from: 't3', to: 'f0', count: 1 });
  });

  it('leaves face-down cards and the stock alone', () => {
    expect(klondike.safeCascadeMove!(board({ stock: ['SA'] }, { stock: 1 }))).toBeNull();
  });

  it('cascades a whole finished table', () => {
    const suit = (s: string) => ['A', '2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K'].map((r) => s + r).reverse();
    let state = board({ t0: suit('S'), t1: suit('H'), t2: suit('D'), t3: suit('C') });
    for (let move = klondike.safeCascadeMove!(state); move; move = klondike.safeCascadeMove!(state)) state = klondike.apply(state, move);
    expect(klondike.isWon(state)).toBe(true);
  });
});

describe('win', () => {
  const full = (suit: string) => ['A', '2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K'].map((r) => suit + r);

  it('is won with all cards on the foundations', () =>
    expect(klondike.isWon(board({ f0: full('S'), f1: full('H'), f2: full('D'), f3: full('C') }))).toBe(true));
  it('is not won on a fresh deal', () => expect(klondike.isWon(klondike.deal(1))).toBe(false));
});

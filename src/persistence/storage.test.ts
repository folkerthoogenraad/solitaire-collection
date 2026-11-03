import { beforeEach, describe, expect, it } from 'vitest';
import { bbb } from '../core/variants/bbb';
import { klondike } from '../core/variants/klondike';
import { isValidGame, load, save } from './storage';

class MemoryStorage {
  private data = new Map<string, string>();
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) { this.data.set(k, v); }
  removeItem(k: string) { this.data.delete(k); }
  clear() { this.data.clear(); }
}

beforeEach(() => {
  (globalThis as { localStorage?: unknown }).localStorage = new MemoryStorage();
});

describe('storage', () => {
  it('round-trips a game and stats', () => {
    const game = bbb.deal(5);
    save(bbb, game, { wins: 3 });
    expect(load(bbb)).toEqual({ game, stats: { wins: 3 } });
  });

  it('returns no game and zero wins when empty', () => {
    expect(load(bbb)).toEqual({ game: null, stats: { wins: 0 } });
  });

  it('drops a corrupt game but keeps stats', () => {
    const game = bbb.deal(5);
    game.piles.t0 = [...game.piles.t0!, game.piles.t1![0]!]; // duplicate card
    save(bbb, game, { wins: 4 });
    expect(load(bbb)).toEqual({ game: null, stats: { wins: 4 } });
  });

  it('survives unparseable data', () => {
    localStorage.setItem('solitaire.save', '{nope');
    expect(load(bbb)).toEqual({ game: null, stats: { wins: 0 } });
  });

  it('rejects a game with missing cards', () => {
    const game = bbb.deal(5);
    game.piles.t0 = [];
    expect(isValidGame(game, bbb)).toBe(false);
  });

  it('keeps a game and wins per variant', () => {
    const b = bbb.deal(5);
    const k = klondike.deal(6);
    save(bbb, b, { wins: 3 });
    save(klondike, k, { wins: 1 });
    expect(load(bbb)).toEqual({ game: b, stats: { wins: 3 } });
    expect(load(klondike)).toEqual({ game: k, stats: { wins: 1 } });
  });

  it('rejects more face-down cards than a pile has', () => {
    const game = klondike.deal(6);
    expect(isValidGame(game, klondike)).toBe(true);
    expect(isValidGame({ ...game, down: { ...game.down, t0: 2 } }, klondike)).toBe(false);
    expect(isValidGame({ ...game, down: { ...game.down, t3: -1 } }, klondike)).toBe(false);
  });

  it('moves a version 1 save to its variant', () => {
    const game = bbb.deal(5);
    localStorage.setItem('solitaire.save', JSON.stringify({ version: 1, variant: 'bbb', game, stats: { wins: 7 } }));
    expect(load(klondike)).toEqual({ game: null, stats: { wins: 0 } });
    expect(load(bbb)).toEqual({ game, stats: { wins: 7 } });
    expect(localStorage.getItem('solitaire.save')).toBeNull();
  });
});

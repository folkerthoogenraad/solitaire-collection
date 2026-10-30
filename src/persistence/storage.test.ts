import { beforeEach, describe, expect, it } from 'vitest';
import { bbb } from '../core/variants/bbb';
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
});

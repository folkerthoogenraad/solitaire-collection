import type { GameState } from '../core/state';
import { buildCards } from '../core/deck';
import type { Variant } from '../core/variant';

const KEY = 'solitaire.save';
const VERSION = 1;

export interface Stats {
  wins: number;
}

export interface SaveData {
  version: typeof VERSION;
  variant: string;
  game: GameState;
  stats: Stats;
}

export interface Loaded {
  game: GameState | null;
  stats: Stats;
}

/** Storage can be unavailable (private mode, blocked site data). */
function read(): unknown {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** A game is valid when every pile exists and every card appears exactly once. */
export function isValidGame(game: unknown, variant: Variant): game is GameState {
  if (!game || typeof game !== 'object') return false;
  const g = game as Partial<GameState>;
  if (typeof g.seed !== 'number' || !g.piles || typeof g.piles !== 'object') return false;

  const seen = new Set<string>();
  for (const id of variant.piles()) {
    const pile = (g.piles as Record<string, unknown>)[id];
    if (!Array.isArray(pile)) return false;
    for (const c of pile) {
      if (typeof c !== 'string' || seen.has(c)) return false;
      seen.add(c);
    }
  }
  const all = buildCards(variant.deck);
  return seen.size === all.length && all.every((c) => seen.has(c.id));
}

export function load(variant: Variant): Loaded {
  const data = read() as Partial<SaveData> | null;
  const wins = data?.stats?.wins;
  const stats: Stats = { wins: typeof wins === 'number' && wins >= 0 ? Math.floor(wins) : 0 };

  if (!data || data.version !== VERSION || data.variant !== variant.id || !isValidGame(data.game, variant)) {
    return { game: null, stats };
  }
  const game = data.game;
  return { game: { ...game, started: !!game.started, won: !!game.won }, stats };
}

export function save(variant: Variant, game: GameState, stats: Stats): void {
  const data: SaveData = { version: VERSION, variant: variant.id, game, stats };
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Not persisting is better than breaking the game.
  }
}

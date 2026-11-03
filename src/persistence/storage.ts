import type { GameState } from '../core/state';
import { buildCards } from '../core/deck';
import type { Variant } from '../core/variant';

/** One save per variant: `solitaire.save.<variant id>`. */
const PREFIX = 'solitaire.save';
const VERSION = 2;

export interface Stats {
  wins: number;
}

export interface SaveData {
  version: typeof VERSION;
  game: GameState;
  stats: Stats;
}

export interface Loaded {
  game: GameState | null;
  stats: Stats;
}

const keyFor = (variant: Pick<Variant, 'id'>) => `${PREFIX}.${variant.id}`;

/**
 * Version 1 kept one game under `solitaire.save`, with the variant inside. Move it to that variant's own key, unless
 * that one exists already, and drop the old key either way.
 */
function migrate(): void {
  try {
    const raw = localStorage.getItem(PREFIX);
    if (raw === null) return;
    try {
      const old = JSON.parse(raw) as { version?: unknown; variant?: unknown; game?: unknown; stats?: unknown } | null;
      const key = typeof old?.variant === 'string' ? `${PREFIX}.${old.variant}` : null;
      if (old?.version === 1 && key && localStorage.getItem(key) === null) {
        localStorage.setItem(key, JSON.stringify({ version: VERSION, game: old.game, stats: old.stats }));
      }
    } finally {
      localStorage.removeItem(PREFIX);
    }
  } catch {
    // Unreadable or unavailable: nothing to carry over.
  }
}

/** Storage can be unavailable (private mode, blocked site data). */
function read(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * A game is valid when every pile exists, every card appears exactly once, and each pile has no more face-down cards
 * than cards.
 */
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
  if (seen.size !== all.length || !all.every((c) => seen.has(c.id))) return false;

  if (g.down === undefined) return true;
  if (!g.down || typeof g.down !== 'object') return false;
  return Object.entries(g.down).every(
    ([pile, n]) => Number.isInteger(n) && n >= 0 && n <= ((g.piles as Record<string, unknown[]>)[pile]?.length ?? -1),
  );
}

export function load(variant: Variant): Loaded {
  migrate();
  const data = read(keyFor(variant)) as Partial<SaveData> | null;
  const wins = data?.stats?.wins;
  const stats: Stats = { wins: typeof wins === 'number' && wins >= 0 ? Math.floor(wins) : 0 };

  if (!data || data.version !== VERSION || !isValidGame(data.game, variant)) {
    return { game: null, stats };
  }
  const game = data.game;
  return { game: { ...game, started: !!game.started, won: !!game.won }, stats };
}

export function save(variant: Variant, game: GameState, stats: Stats): void {
  const data: SaveData = { version: VERSION, game, stats };
  try {
    localStorage.setItem(keyFor(variant), JSON.stringify(data));
  } catch {
    // Not persisting is better than breaking the game.
  }
}

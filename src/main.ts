import './styles/theme.css';
import './styles/app.css';
import { randomSeed } from './core/rng';
import { applyMove, foundationId, type GameState, type Move } from './core/state';
import { bbb } from './core/variants/bbb';
import { loadSettings, saveSettings } from './persistence/settings';
import { load, save, type Stats } from './persistence/storage';
import { createControls } from './ui/controls';
import { attachDrag } from './ui/drag';
import { computeLayout } from './ui/layout';
import { Renderer } from './ui/renderer';
import { loadSkin } from './ui/skin/load';
import { createWinOverlay } from './ui/win';

const variant = bbb;
const board = document.getElementById('board')!;

// ?skin=<id> picks a skin and remembers it.
const settings = loadSettings();
const requested = new URLSearchParams(location.search).get('skin') ?? settings.skin;
const skin = await loadSkin(variant.deck, board, requested);
if (skin.id && skin.id !== settings.skin && skin.id === requested) saveSettings({ ...settings, skin: skin.id });

const loaded = load(variant);
let state: GameState = loaded.game ?? variant.deal(randomSeed());
let stats: Stats = loaded.stats;

const controls = createControls(newDeal, () => state.started && !state.won);
const win = createWinOverlay(newDeal);
const renderer = new Renderer(board, variant, skin.faces, controls.el);
board.append(win.el);
controls.setWins(stats.wins);

function persist() {
  save(variant, state, stats);
}

function commit(move: Move): boolean {
  if (state.won || !variant.canMove(state, move)) return false;
  const from = state.piles[move.from]!;
  const moved = from.slice(from.length - move.count);
  state = applyMove(state, move);

  if (variant.isWon(state)) {
    state = { ...state, won: true };
    stats = { ...stats, wins: stats.wins + 1 };
    controls.setWins(stats.wins);
    window.setTimeout(celebrate, 250);
  }
  persist();
  renderer.render(state, { raise: moved });
  return true;
}

function celebrate() {
  const tops = Array.from({ length: variant.foundationCount }, (_, i) => state.piles[foundationId(i)]!.at(-1)!);
  renderer.celebrate(tops);
  win.show(stats.wins);
}

function newDeal() {
  state = variant.deal(randomSeed());
  persist();
  win.hide();
  renderer.render(state, { deal: true });
}

attachDrag(board, {
  variant,
  renderer,
  state: () => state,
  commit,
  restore: (ids) => renderer.render(state, { raise: ids }),
});

let firstLayout = true;
new ResizeObserver(([entry]) => {
  const { width, height } = entry!.contentRect;
  if (!width || !height) return;
  renderer.setLayout(computeLayout(width, height, variant));
  renderer.render(state, firstLayout && !loaded.game ? { deal: true } : { instant: true });
  if (firstLayout && state.won) win.show(stats.wins);
  firstLayout = false;
}).observe(renderer.layer);

persist();

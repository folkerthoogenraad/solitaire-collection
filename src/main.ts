import './styles/theme.css';
import './styles/app.css';
import { nextCascadeMove } from './core/cascade';
import { randomSeed } from './core/rng';
import { applyMove, foundationId, pileKind, type GameState, type Move, type PileId } from './core/state';
import { bbb } from './core/variants/bbb';
import { isMotion, loadSettings, saveSettings } from './persistence/settings';
import { load, save, type Stats } from './persistence/storage';
import { createControls } from './ui/controls';
import { createCascadeButton } from './ui/cascade';
import { attachDrag } from './ui/drag';
import { computeLayout } from './ui/layout';
import { applyMotion } from './ui/motion';
import { Renderer } from './ui/renderer';
import { loadSkin } from './ui/skin/load';
import { createWinOverlay } from './ui/win';

const variant = bbb;
const board = document.getElementById('board')!;

// ?skin=<id> and ?motion=system|full|reduced pick a setting and remember it.
const params = new URLSearchParams(location.search);
const settings = loadSettings();
const motion = params.get('motion');
if (isMotion(motion)) settings.motion = motion;
applyMotion(board, settings.motion ?? 'system');

const requested = params.get('skin') ?? settings.skin;
const skin = await loadSkin(variant.deck, board, requested);
if (skin.id && skin.id === requested) settings.skin = skin.id;
saveSettings(settings);

const loaded = load(variant);
let state: GameState = loaded.game ?? variant.deal(randomSeed());
let stats: Stats = loaded.stats;

const controls = createControls(newDeal, () => state.started && !state.won);
const win = createWinOverlay(newDeal);
const renderer = new Renderer(board, variant, skin.faces, controls.el);
const cascadeButton = createCascadeButton(() => cascadeTarget && cascade(cascadeTarget));
renderer.layer.append(cascadeButton.el);
board.append(win.el);
controls.setWins(stats.wins);

/** Foundation the autocascade button is offered for. */
let cascadeTarget: PileId | null = null;
let cascadeTimer = 0;
const CASCADE_STEP_MS = 110;

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
  if (!cascadeTimer) offerCascade(move.to);
  return true;
}

/** Never automatic: in this variant moving everything up can make a deal unsolvable. */
function offerCascade(pile: PileId) {
  cascadeButton.hide();
  cascadeTarget = null;
  if (state.won || pileKind(pile) !== 'foundation' || !nextCascadeMove(variant, state, pile)) return;
  cascadeTarget = pile;
  cascadeButton.show(renderer.topRect(state, pile), renderer.layer.clientWidth);
}

/** Moves the suit's next cards onto `pile` one by one, while any is free. */
function cascade(pile: PileId) {
  stopCascade();
  const step = () => {
    const move = nextCascadeMove(variant, state, pile);
    cascadeTimer = move && commit(move) ? window.setTimeout(step, CASCADE_STEP_MS) : 0;
  };
  // Keep `cascadeTimer` set during the commit, so cascading doesn't re-offer the button.
  cascadeTimer = -1;
  step();
}

function stopCascade() {
  clearTimeout(cascadeTimer);
  cascadeTimer = 0;
}

function celebrate() {
  const tops = Array.from({ length: variant.foundationCount }, (_, i) => state.piles[foundationId(i)]!.at(-1)!);
  renderer.celebrate(tops);
  win.show(stats.wins);
}

function newDeal() {
  stopCascade();
  cascadeButton.hide();
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
  cascadeButton.hide();
  renderer.setLayout(computeLayout(width, height, variant));
  renderer.render(state, firstLayout && !loaded.game ? { deal: true } : { instant: true });
  if (firstLayout) {
    if (state.won) win.show(stats.wins);
    hideLoader();
  }
  firstLayout = false;
}).observe(renderer.layer);

/** The loader lives in index.html; everything it waits for (bundle, skin images) is in by now. */
function hideLoader() {
  const loader = document.getElementById('loader');
  if (!loader) return;
  loader.classList.add('done');
  loader.addEventListener('transitionend', () => loader.remove(), { once: true });
}

persist();

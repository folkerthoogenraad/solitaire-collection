import './styles/theme.css';
import './styles/app.css';
import { nextCascadeMove } from './core/cascade';
import { randomSeed } from './core/rng';
import { applyMove, foundationId, pileKind, type GameState, type Move, type PileId } from './core/state';
import { bbb } from './core/variants/bbb';
import { isMotion, loadSettings, saveSettings } from './persistence/settings';
import { load, save, type Stats } from './persistence/storage';
import { createControls } from './ui/controls';
import { createCascadeButton, type CascadeButton } from './ui/cascade';
import { attachDrag } from './ui/drag';
import { computeLayout } from './ui/layout';
import { applyMotion } from './ui/motion';
import { DEAL_STAGGER_MS, Renderer } from './ui/renderer';
import { loadSkin } from './ui/skin/load';
import { createSounds } from './ui/sound';
import { createWinOverlay } from './ui/win';
import { preventZoom } from './ui/zoom';

const variant = bbb;
const board = document.getElementById('board')!;
const loader = document.getElementById('loader');
preventZoom();

/** Fills the loader's bar: the bundle is the first part, the skin's images the rest. */
function progress(p: number) {
  loader?.style.setProperty('--p', String(p));
  loader?.setAttribute('aria-valuenow', String(Math.round(p * 100)));
}
progress(0.2);

// ?skin=<id>, ?motion=system|full|reduced and ?sound=on|off pick a setting and remember it.
const params = new URLSearchParams(location.search);
const settings = loadSettings();
const motion = params.get('motion');
if (isMotion(motion)) settings.motion = motion;
const sound = params.get('sound');
if (sound === 'on' || sound === 'off') settings.sound = sound === 'on';
applyMotion(board, settings.motion ?? 'system');

const requested = params.get('skin') ?? settings.skin;
const skin = await loadSkin(variant, board, requested, (done, total) => progress(0.2 + (0.8 * done) / total));
if (skin.id && skin.id === requested) settings.skin = skin.id;
saveSettings(settings);

const sounds = createSounds(skin.sounds, settings.sound ?? true);
/** Deal sounds are never closer together than this: one per card when cards leave slower, every few cards when faster. */
const DEAL_SOUND_GAP_MS = 100;

const loaded = load(variant);
let state: GameState = loaded.game ?? variant.deal(randomSeed());
let stats: Stats = loaded.stats;

const controls = createControls(skin.ui, newDeal);
const win = createWinOverlay(skin.ui, newDeal);
const emblemAr = skin.ui.ar('emblem');
const emblem = emblemAr ? skin.ui.glyph('emblem', 'emblem', '') : undefined;
const renderer = new Renderer(board, variant, skin.faces, controls.el, emblem);
board.append(win.el);
controls.setWins(stats.wins);

/** Autocascade offers, one per pile so several can be up at once; made when first needed. */
const cascadeButtons = new Map<PileId, CascadeButton>();
/** Piles a cascade is running onto, with the timer of its next step. */
const cascading = new Map<PileId, number>();
const CASCADE_STEP_MS = 110;

function persist() {
  save(variant, state, stats);
}

/** `auto`: a cascade step, which doesn't offer another cascade. */
function commit(move: Move, auto = false): boolean {
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
  sounds.play('place');
  // Offers that the move made pointless go away; the others stay up.
  for (const [pile, button] of cascadeButtons) if (button.shown && !canCascade(pile)) button.hide();
  if (!auto) offerCascade(move);
  return true;
}

function canCascade(pile: PileId): boolean {
  return !state.won && !cascading.has(pile) && !!nextCascadeMove(variant, state, pile, new Set(cascading.keys()));
}

/**
 * Never automatic: in this variant moving everything up can make a deal unsolvable. Offered onto a foundation, and
 * back onto a column right after a card was taken off a foundation onto it.
 */
function offerCascade(move: Move) {
  const kind = pileKind(move.to);
  const offered = kind === 'foundation' || (kind === 'tableau' && pileKind(move.from) === 'foundation');
  if (!offered || !canCascade(move.to)) return;
  let button = cascadeButtons.get(move.to);
  if (!button) {
    button = createCascadeButton(skin.ui, () => cascade(move.to));
    cascadeButtons.set(move.to, button);
    renderer.layer.append(button.el);
  }
  button.show(renderer.topRect(state, move.to), renderer.layer.clientWidth);
}

/** Moves the suit's next cards onto `pile` one by one, while any is free. Runs alongside cascades onto other piles. */
function cascade(pile: PileId) {
  const step = () => {
    const move = nextCascadeMove(variant, state, pile, new Set(cascading.keys()));
    if (move && commit(move, true)) cascading.set(pile, window.setTimeout(step, CASCADE_STEP_MS));
    else cascading.delete(pile);
  };
  cascading.set(pile, 0);
  step();
}

function stopCascades() {
  for (const timer of cascading.values()) clearTimeout(timer);
  cascading.clear();
}

function hideOffers() {
  for (const button of cascadeButtons.values()) button.hide();
}

function celebrate() {
  const tops = Array.from({ length: variant.foundationCount }, (_, i) => state.piles[foundationId(i)]!.at(-1)!);
  renderer.celebrate(tops);
  win.show(stats.wins);
}

function newDeal() {
  stopCascades();
  hideOffers();
  state = variant.deal(randomSeed());
  persist();
  win.hide();
  renderer.render(state, { deal: true });
  sounds.play('shuffle');
  const cards = Object.values(state.piles).reduce((n, p) => n + p.length, 0);
  const every = Math.max(1, Math.ceil(DEAL_SOUND_GAP_MS / DEAL_STAGGER_MS));
  for (let i = 0; i < cards; i += every) sounds.play('deal', { delay: (i * DEAL_STAGGER_MS) / 1000, volume: 0.6 });
}

attachDrag(board, {
  variant,
  renderer,
  state: () => state,
  commit,
  restore: (ids) => {
    renderer.render(state, { raise: ids });
    sounds.play('cancel');
  },
  pickUp: () => sounds.play('pickup'),
});

let firstLayout = true;
new ResizeObserver(([entry]) => {
  const { width, height } = entry!.contentRect;
  if (!width || !height) return;
  hideOffers();
  renderer.setLayout(computeLayout(width, height, variant, emblemAr));
  renderer.render(state, firstLayout && !loaded.game ? { deal: true } : { instant: true });
  if (firstLayout) {
    if (state.won) win.show(stats.wins);
    hideLoader();
  }
  firstLayout = false;
}).observe(renderer.layer);

/** The loader lives in index.html; everything it waits for (bundle, skin images) is in by now. */
function hideLoader() {
  if (!loader) return;
  progress(1);
  loader.classList.add('done');
  // The bar's own transition ends here too.
  loader.addEventListener('transitionend', (e) => e.propertyName === 'opacity' && loader.remove());
}

persist();

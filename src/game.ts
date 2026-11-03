import { nextCascadeMove } from './core/cascade';
import { randomSeed } from './core/rng';
import { foundationId, pileKind, type GameState, type Move, type PileId } from './core/state';
import type { Variant } from './core/variant';
import { load, save, type Stats } from './persistence/storage';
import { createCascadeButton, type CascadeButton } from './ui/cascade';
import { createControls } from './ui/controls';
import { attachDrag } from './ui/drag';
import { computeLayout } from './ui/layout';
import { DEAL_STAGGER_MS, Renderer } from './ui/renderer';
import type { LoadedSkin } from './ui/skin/load';
import type { Sounds } from './ui/sound';
import { createWinOverlay } from './ui/win';

export interface GameHost {
  board: HTMLElement;
  skin: LoadedSkin;
  sounds: Sounds;
  /** The emblem was clicked or pressed: open the variant selector. */
  onEmblem(): void;
  /** The first layout is on screen. */
  onReady?(): void;
}

export interface Game {
  readonly variant: Variant;
  readonly emblem: HTMLElement;
  /** Takes the game off the board: its elements, listeners and timers. Its save stays. */
  destroy(): void;
}

/** Width / height of an emblem without an image, which shows the variant's name instead. */
const TEXT_EMBLEM_AR = 2;
/** Deal sounds are never closer together than this: one per card when cards leave slower, every few cards when faster. */
const DEAL_SOUND_GAP_MS = 100;
const CASCADE_STEP_MS = 110;

/** One variant on the board, with its own save and win count, from the saved game or a new deal. */
export function createGame(variant: Variant, host: GameHost): Game {
  const { board, skin, sounds } = host;
  const loaded = load(variant);
  let state: GameState = loaded.game ?? variant.deal(randomSeed());
  let stats: Stats = loaded.stats;

  const controls = createControls(skin.ui, newDeal);
  const win = createWinOverlay(skin.ui, newDeal);
  const emblemKey = `emblem/${variant.id}` as const;
  const emblemAr = skin.ui.ar(emblemKey) ?? TEXT_EMBLEM_AR;
  const emblem = skin.ui.glyph('emblem', emblemKey, variant.name);
  emblem.classList.add('opens-selector');
  emblem.setAttribute('role', 'button');
  emblem.setAttribute('aria-label', `${variant.name}: choose a game`);
  emblem.tabIndex = 0;
  emblem.addEventListener('click', host.onEmblem);
  emblem.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    host.onEmblem();
  });
  const renderer = new Renderer(board, variant, skin.faces, controls.el, emblem);
  board.append(win.el);
  controls.setWins(stats.wins);

  /** Autocascade offers, one per pile so several can be up at once; made when first needed. */
  const cascadeButtons = new Map<PileId, CascadeButton>();
  /** Piles a cascade is running onto, with the timer of its next step. */
  const cascading = new Map<PileId, number>();
  let celebrating = 0;

  function persist() {
    save(variant, state, stats);
  }

  /** `auto`: a cascade step, which doesn't offer another cascade. */
  function commit(move: Move, auto = false): boolean {
    if (state.won || !variant.canMove(state, move)) return false;
    const from = state.piles[move.from]!;
    const moved = from.slice(from.length - move.count);
    state = variant.apply(state, move);

    if (variant.isWon(state)) {
      state = { ...state, won: true };
      stats = { ...stats, wins: stats.wins + 1 };
      controls.setWins(stats.wins);
      celebrating = window.setTimeout(celebrate, 250);
    }
    persist();
    renderer.render(state, { raise: moved });
    // Drawing from the stock, and turning the waste back over
    sounds.play(pileKind(move.from) === 'stock' || pileKind(move.to) === 'stock' ? 'draw' : 'place');
    // Offers that the move made pointless go away; the others stay up.
    for (const [pile, button] of cascadeButtons) if (button.shown && !canCascade(pile)) button.hide();
    if (!auto) offerCascade(move);
    return true;
  }

  /** The next step of a cascade offered on `pile`: across the whole table when the variant sweeps, else that one suit. */
  function nextStep(pile: PileId): Move | null {
    if (variant.safeCascadeMove) return variant.safeCascadeMove(state);
    return nextCascadeMove(variant, state, pile, new Set(cascading.keys()));
  }

  function canCascade(pile: PileId): boolean {
    // A sweep moves everything that can go, so one at a time is enough.
    const busy = variant.safeCascadeMove ? cascading.size > 0 : cascading.has(pile);
    return !state.won && !busy && !!nextStep(pile);
  }

  /**
   * Never automatic: in BBB moving everything up can make a deal unsolvable. Offered onto a foundation, and (one suit
   * at a time only) back onto a column right after a card was taken off a foundation onto it.
   */
  function offerCascade(move: Move) {
    const kind = pileKind(move.to);
    const back = kind === 'tableau' && pileKind(move.from) === 'foundation' && !variant.safeCascadeMove;
    const offered = kind === 'foundation' || back;
    if (!offered || !canCascade(move.to)) return;
    let button = cascadeButtons.get(move.to);
    if (!button) {
      button = createCascadeButton(skin.ui, () => cascade(move.to));
      cascadeButtons.set(move.to, button);
      renderer.layer.append(button.el);
    }
    button.show(renderer.topRect(state, move.to), renderer.layer.clientWidth);
  }

  /**
   * Moves cards up one by one while any can go: the suit's next cards onto `pile` (runs alongside cascades onto other
   * piles), or, where the variant sweeps, every card that's safe to move, onto whichever foundation it belongs on.
   */
  function cascade(pile: PileId) {
    const step = () => {
      const move = nextStep(pile);
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
    deal();
  }

  function deal() {
    renderer.render(state, { deal: true });
    sounds.play('shuffle');
    const cards = variant.dealOrder(state).length;
    const every = Math.max(1, Math.ceil(DEAL_SOUND_GAP_MS / DEAL_STAGGER_MS));
    for (let i = 0; i < cards; i += every) sounds.play('deal', { delay: (i * DEAL_STAGGER_MS) / 1000, volume: 0.6 });
  }

  const detachDrag = attachDrag(board, {
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
  const resize = new ResizeObserver(([entry]) => {
    const { width, height } = entry!.contentRect;
    if (!width || !height) return;
    hideOffers();
    renderer.setLayout(computeLayout(width, height, variant, emblemAr));
    if (firstLayout && !loaded.game) deal();
    else renderer.render(state, { instant: true });
    if (firstLayout) {
      if (state.won) win.show(stats.wins);
      host.onReady?.();
    }
    firstLayout = false;
  });
  resize.observe(renderer.layer);

  persist();

  return {
    variant,
    emblem,
    destroy() {
      resize.disconnect();
      detachDrag();
      stopCascades();
      clearTimeout(celebrating);
      renderer.destroy();
      win.el.remove();
    },
  };
}

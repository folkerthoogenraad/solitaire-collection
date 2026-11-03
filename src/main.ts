import './styles/theme.css';
import './styles/app.css';
import { VARIANTS } from './core/variants';
import type { Variant } from './core/variant';
import { createGame, type Game } from './game';
import { isMotion, loadSettings, saveSettings } from './persistence/settings';
import { load } from './persistence/storage';
import { applyMotion } from './ui/motion';
import { createSelector } from './ui/selector';
import { loadSkin } from './ui/skin/load';
import { createSounds } from './ui/sound';
import { preventZoom } from './ui/zoom';

const board = document.getElementById('board')!;
const loader = document.getElementById('loader');
preventZoom();

/** Fills the loader's bar: the bundle is the first part, the skin's images the rest. */
function progress(p: number) {
  loader?.style.setProperty('--p', String(p));
  loader?.setAttribute('aria-valuenow', String(Math.round(p * 100)));
}
progress(0.2);

// ?variant=<id>, ?skin=<id>, ?motion=system|full|reduced and ?sound=on|off pick a setting and remember it.
const params = new URLSearchParams(location.search);
const settings = loadSettings();
const motion = params.get('motion');
if (isMotion(motion)) settings.motion = motion;
const sound = params.get('sound');
if (sound === 'on' || sound === 'off') settings.sound = sound === 'on';
applyMotion(board, settings.motion ?? 'system');

const byId = (id: string | null | undefined) => VARIANTS.find((v) => v.id === id);
const variant = byId(params.get('variant')) ?? byId(settings.variant) ?? VARIANTS[0]!;
settings.variant = variant.id;

const requested = params.get('skin') ?? settings.skin;
const skin = await loadSkin(VARIANTS, board, requested, (done, total) => progress(0.2 + (0.8 * done) / total));
if (skin.id && skin.id === requested) settings.skin = skin.id;
saveSettings(settings);
skin.useVariant(variant.id);

const sounds = createSounds(skin.sounds, settings.sound ?? true);

const selector = createSelector({
  variants: VARIANTS,
  ui: skin.ui,
  wins: (v) => load(v).stats.wins,
  choose: play,
  closed: () => game.emblem.focus({ preventScroll: true }),
});
document.body.append(selector.el);

let game: Game = start(variant, hideLoader);

function start(v: Variant, onReady?: () => void): Game {
  return createGame(v, {
    board,
    skin,
    sounds,
    onEmblem: () => selector.open(game.variant, board.dataset.motion === 'reduced'),
    onReady,
  });
}

/**
 * Switches the board to another variant, which carries on with its own saved game (or deals one). The selector covers
 * the board meanwhile, so its colours change unseen.
 */
function play(v: Variant) {
  game.destroy();
  skin.useVariant(v.id);
  game = start(v);
  settings.variant = v.id;
  saveSettings(settings);
}

/** The loader lives in index.html; everything it waits for (bundle, skin images) is in by now. */
function hideLoader() {
  if (!loader) return;
  progress(1);
  loader.classList.add('done');
  // The bar's own transition ends here too.
  loader.addEventListener('transitionend', (e) => e.propertyName === 'opacity' && loader.remove());
}

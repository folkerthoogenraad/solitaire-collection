import { buildCards } from '../../core/deck';
import type { Variant } from '../../core/variant';
import { MAX_CARD_W } from '../layout';
import type { CardFaceRenderer } from '../faces';
import { catalog } from './catalog';
import { DEFAULT_SETTINGS, type Box, type SkinSettings } from './manifest';
import { skinFaces, skinUi, type LoadedImage, type SkinUi } from './faces';
import {
  chainFor,
  resolveBack,
  resolveChrome,
  resolveFace,
  resolveSounds,
  resolveUi,
  settingsFor,
  unknownFiles,
  type FaceSpec,
  type SkinSource,
  type SoundName,
} from './resolve';

export interface LoadedSkin {
  /** The skin actually in use, after falling back from a missing or broken one. */
  id: string | null;
  faces: CardFaceRenderer;
  ui: SkinUi;
  /** URLs of each sound's variants. Not preloaded: the game starts without them. */
  sounds: Partial<Record<SoundName, string[]>>;
  /** Switch to a variant's colours (the skin's `variants` blocks). Restyles the whole page, so only while nothing moves. */
  useVariant(variantId: string): void;
}

async function loadImage(url: string): Promise<LoadedImage> {
  const img = new Image();
  img.src = new URL(url, document.baseURI).href;
  await img.decode();
  return { url: img.src, w: img.naturalWidth, ar: img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 1 };
}

function setBox(style: CSSStyleDeclaration, prefix: string, b: Box): void {
  style.setProperty(`--${prefix}-x`, `${b.x * 100}%`);
  style.setProperty(`--${prefix}-y`, `${b.y * 100}%`);
  style.setProperty(`--${prefix}-w`, `${b.w * 100}%`);
  style.setProperty(`--${prefix}-h`, `${b.h * 100}%`);
}

/** Everything but the colours, which differ per variant (see `useVariant`). */
function apply(board: HTMLElement, id: string | null, settings: SkinSettings, chrome: Record<string, LoadedImage | undefined>): void {
  const root = document.documentElement.style;
  setBox(root, 'center', settings.center.box);
  setBox(root, 'center-n', settings.center.narrowBox);
  const idx = settings.index;
  root.setProperty('--idx-x', String(idx.x));
  root.setProperty('--idx-y', String(idx.y));
  root.setProperty('--idx-rank', String(idx.rank));
  root.setProperty('--idx-suit', String(idx.suit));
  root.setProperty('--idx-compact-rank', String(idx.compact.rank));
  root.setProperty('--idx-compact-suit', String(idx.compact.suit));
  root.setProperty('--pip-size', String(settings.pips.size));
  root.setProperty('--card-scale', String(settings.card.scale));
  root.setProperty('--drop-scale', String(settings.card.dropScale ?? settings.card.scale));
  root.setProperty('--slot-scale', String(settings.table.slotScale));
  root.setProperty('--skin-button-slice', String(settings.ui.button.slice));
  root.setProperty('--skin-panel-slice', String(settings.ui.panel.slice));

  if (id) board.dataset.skin = id;
  board.dataset.scaling = settings.scaling;
  if (chrome.felt) board.dataset.felt = settings.table.felt;
  // A tile scales with the cards, so it covers the same share of the table on a phone as on a desktop.
  // Unsized, it's shown at its own pixel size when the cards are at their largest.
  const felt = chrome.felt;
  if (felt) root.setProperty('--felt-tile', String(settings.table.tileSize ?? felt.w / MAX_CARD_W.wide));
  for (const [key, img] of Object.entries(chrome)) {
    if (!img) continue;
    const name = key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
    root.setProperty(`--skin-${name}`, `url("${img.url}")`);
    board.dataset[`skin${key[0]!.toUpperCase()}${key.slice(1)}`] = '';
  }
  // The stock label is shown at its own size: drawn at 3×, like a card, so 3 × MAX_CARD_W px is one card wide.
  for (const key of ['stock', 'stockInk'] as const) {
    const img = chrome[key];
    if (img) root.setProperty(`--skin-${key === 'stock' ? 'stock' : 'stock-ink'}-w`, String(img.w / (3 * MAX_CARD_W.wide)));
  }
}

/**
 * Pick the skin (requested → default → classic), resolve every face of every variant's deck, the backs and each
 * variant's emblem, and preload what they use, so nothing pops in during a deal or in the variant selector. Anything
 * that fails falls back to text faces. `onProgress` hears about every image that's in (or failed).
 */
export async function loadSkin(
  variants: readonly Pick<Variant, 'id' | 'deck'>[],
  board: HTMLElement,
  requested: string | undefined,
  onProgress?: (done: number, total: number) => void,
): Promise<LoadedSkin> {
  const cat = catalog();
  if (import.meta.env.DEV) {
    for (const p of cat.problems) console.warn(`[skins] ${p}`);
    // Before apply(), so only theme.css defines colours: anything it lacks is a name no style reads.
    const theme = getComputedStyle(document.documentElement);
    for (const id of cat.registry.skins) {
      const skin = cat.skins.get(id);
      // A file is unknown when no deck uses it.
      const unknown = skin
        ? variants.map((v) => unknownFiles(skin, v.deck)).reduce((a, b) => a.filter((f) => b.includes(f)))
        : [];
      if (unknown.length) console.warn(`[skins] ${id}: files no card uses (typo?):\n  ${unknown.join('\n  ')}`);
      const blocks = Object.entries(skin?.manifest.variants ?? {});
      const named = [
        ...Object.keys(skin?.manifest.colors ?? {}),
        ...blocks.flatMap(([v, block]) => Object.keys(block.colors ?? {}).map((name) => `${name} (variants.${v})`)),
      ];
      const colors = named.filter((name) => !theme.getPropertyValue(`--${name.split(' ')[0]}`));
      if (colors.length) console.warn(`[skins] ${id}: colours that don't exist (see skins/README.md):\n  ${colors.join('\n  ')}`);
      const games = blocks.map(([v]) => v).filter((v) => !variants.some((known) => known.id === v));
      if (games.length) console.warn(`[skins] ${id}: variants for games this build doesn't have: ${games.join(', ')}`);
    }
  }

  let id: string | null = null;
  let chain: SkinSource[] = [];
  for (const candidate of new Set([requested, cat.registry.default, 'classic'])) {
    if (!candidate) continue;
    if (!cat.registry.skins.includes(candidate)) {
      if (candidate === requested) console.warn(`[skins] unknown skin "${candidate}"`);
      continue;
    }
    try {
      chain = chainFor(cat.skins, candidate);
      id = candidate;
      break;
    } catch (e) {
      console.error(`[skins] ${e instanceof Error ? e.message : e}`);
    }
  }

  const settings = chain.length ? settingsFor(chain) : DEFAULT_SETTINGS;
  const specs = new Map<string, FaceSpec>();
  // Decks share card ids (Klondike's is the Emperor deck without the Emperor), so each card is resolved once.
  for (const { deck } of variants) {
    for (const card of buildCards(deck)) if (!specs.has(card.id)) specs.set(card.id, resolveFace(chain, settings, deck, card));
  }
  const chromePaths = resolveChrome(chain);
  const ui = resolveUi(chain, variants.map((v) => v.id));
  const back = resolveBack(chain);

  const paths = new Set<string>(Object.values(chromePaths).filter((p) => p !== undefined));
  const assets = [...Object.values(ui).filter((a) => a !== undefined), back.art, back.outline];
  for (const spec of specs.values()) {
    assets.push(spec.rank, spec.suit, spec.background, spec.outline, spec.center.kind === 'art' ? spec.center.art : spec.center.pip);
  }
  for (const a of assets) for (const p of [a.ink, a.paint]) if (p) paths.add(p);

  const images = new Map<string, LoadedImage>();
  let done = 0;
  await Promise.all(
    [...paths].map(async (path) => {
      try {
        images.set(path, await loadImage(cat.urls[path]!));
      } catch {
        console.warn(`[skins] could not load ${path}`);
      }
      onProgress?.(++done, paths.size);
    }),
  );

  const chrome = Object.fromEntries(Object.entries(chromePaths).map(([k, p]) => [k, p ? images.get(p) : undefined]));
  apply(board, id, settings, chrome);
  const sounds = Object.fromEntries(Object.entries(resolveSounds(chain)).map(([name, list]) => [name, list.map((p) => cat.urls[p]!)]));

  const colorsFor = new Map(variants.map((v) => [v.id, chain.length ? settingsFor(chain, v.id).colors : settings.colors]));
  const root = document.documentElement.style;
  let applied: string[] = [];
  const useVariant = (variantId: string) => {
    const colors = colorsFor.get(variantId) ?? settings.colors;
    // A name only the previous variant set goes back to theme.css.
    for (const name of applied) if (!(name in colors)) root.removeProperty(`--${name}`);
    for (const [name, value] of Object.entries(colors)) root.setProperty(`--${name}`, value);
    applied = Object.keys(colors);
  };
  if (variants[0]) useVariant(variants[0].id);

  return { id, faces: skinFaces(specs, back, images), ui: skinUi(ui, images), sounds, useVariant };
}

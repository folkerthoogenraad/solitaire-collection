import { buildCards, type DeckDefinition } from '../../core/deck';
import type { CardFaceRenderer } from '../faces';
import { catalog } from './catalog';
import { DEFAULT_SETTINGS, type Box, type SkinSettings } from './manifest';
import { skinFaces, type LoadedImage } from './faces';
import { chainFor, resolveChrome, resolveFace, settingsFor, unknownFiles, type FaceSpec, type SkinSource } from './resolve';

export interface LoadedSkin {
  /** The skin actually in use, after falling back from a missing or broken one. */
  id: string | null;
  faces: CardFaceRenderer;
}

async function loadImage(url: string): Promise<LoadedImage> {
  const img = new Image();
  img.src = new URL(url, document.baseURI).href;
  await img.decode();
  return { url: img.src, ar: img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 1 };
}

function setBox(style: CSSStyleDeclaration, prefix: string, b: Box): void {
  style.setProperty(`--${prefix}-x`, `${b.x * 100}%`);
  style.setProperty(`--${prefix}-y`, `${b.y * 100}%`);
  style.setProperty(`--${prefix}-w`, `${b.w * 100}%`);
  style.setProperty(`--${prefix}-h`, `${b.h * 100}%`);
}

function apply(board: HTMLElement, id: string | null, settings: SkinSettings, chrome: Record<string, string | undefined>): void {
  const root = document.documentElement.style;
  for (const [name, value] of Object.entries(settings.colors)) root.setProperty(`--${name}`, value);
  setBox(root, 'center', settings.center.box);
  setBox(root, 'center-n', settings.center.narrowBox);
  root.setProperty('--pip-size', String(settings.pips.size));
  root.setProperty('--skin-button-slice', String(settings.ui.button.slice));
  root.setProperty('--skin-panel-slice', String(settings.ui.panel.slice));

  if (id) board.dataset.skin = id;
  if (chrome.felt) board.dataset.felt = settings.table.felt;
  for (const [key, url] of Object.entries(chrome)) {
    if (!url) continue;
    const name = key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
    root.setProperty(`--skin-${name}`, `url("${url}")`);
    board.dataset[`skin${key[0]!.toUpperCase()}${key.slice(1)}`] = '';
  }
}

/**
 * Pick the skin (requested → default → classic), resolve every face and preload what it uses,
 * so nothing pops in during the first deal. Anything that fails falls back to text faces.
 */
export async function loadSkin(deck: DeckDefinition, board: HTMLElement, requested: string | undefined): Promise<LoadedSkin> {
  const cat = catalog();
  if (import.meta.env.DEV) {
    for (const p of cat.problems) console.warn(`[skins] ${p}`);
    for (const id of cat.registry.skins) {
      const skin = cat.skins.get(id);
      const unknown = skin ? unknownFiles(skin, deck) : [];
      if (unknown.length) console.warn(`[skins] ${id}: files no card uses (typo?):\n  ${unknown.join('\n  ')}`);
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
  for (const card of buildCards(deck)) specs.set(card.id, resolveFace(chain, settings, deck, card));
  const chromePaths = resolveChrome(chain);

  const paths = new Set<string>(Object.values(chromePaths).filter((p) => p !== undefined));
  for (const spec of specs.values()) {
    const assets = [spec.rank, spec.suit, spec.background, spec.center.kind === 'art' ? spec.center.art : spec.center.pip];
    for (const a of assets) for (const p of [a.ink, a.paint]) if (p) paths.add(p);
  }

  const images = new Map<string, LoadedImage>();
  await Promise.all(
    [...paths].map(async (path) => {
      try {
        images.set(path, await loadImage(cat.urls[path]!));
      } catch {
        console.warn(`[skins] could not load ${path}`);
      }
    }),
  );

  const chrome = Object.fromEntries(Object.entries(chromePaths).map(([k, p]) => [k, p && images.get(p)?.url]));
  apply(board, id, settings, chrome);
  return { id, faces: skinFaces(specs, images) };
}

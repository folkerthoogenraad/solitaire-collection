import type { Card, DeckDefinition } from '../../core/deck';
import { mergeSettings, parseManifest, SkinError, type PipPoint, type SkinManifest, type SkinSettings } from './manifest';

/**
 * One image slot, as source paths. `ink` is tinted with the suit colour (alpha only), `paint` is drawn as-is on top.
 * An empty asset means nothing was found and the renderer falls back to text.
 */
export interface Asset {
  ink?: string;
  paint?: string;
}

export interface SkinSource {
  id: string;
  manifest: SkinManifest;
  /** Keyed by path inside the skin without layer or extension, e.g. `center/7-clubs`. */
  assets: Map<string, Asset>;
  /** Sound name → source paths of its variants, e.g. `place` → `sounds/place.wav`, `sounds/place-2.wav`. */
  sounds: Map<string, string[]>;
}

export const SOUNDS = ['shuffle', 'deal', 'draw', 'pickup', 'place', 'cancel'] as const;
export type SoundName = (typeof SOUNDS)[number];

export interface Pip {
  x: number;
  y: number;
  flip: boolean;
  scale: number;
}

export type CenterSpec =
  | { kind: 'art'; art: Asset }
  /** `narrow`: what to show instead in narrow mode (one big pip), if anything. */
  | { kind: 'pips'; pip: Asset; points: Pip[]; narrow?: Pip[] };

export interface FaceSpec {
  rank: Asset;
  suit: Asset;
  center: CenterSpec;
  background: Asset;
  /** Drawn over the background and under the content; ink is tinted with `--card-border`. */
  outline: Asset;
}

export interface ChromeSpec {
  /** Alpha mask for the card body, from either layer. */
  shape?: string;
  felt?: string;
  slot?: string;
  /** Tinted with `--slot-border`. */
  slotInk?: string;
  slotStock?: string;
  slotStockInk?: string;
  /** The stock's label, over its slot images. Ink is tinted with `--slot-label`. */
  stock?: string;
  stockInk?: string;
  /** Over the card or pile a dragged card will land on, instead of the glow. Ink is tinted with `--drop-highlight`. */
  drop?: string;
  dropInk?: string;
  button?: string;
  panel?: string;
}

/** Height of the one-big-pip centre, as a fraction of card width, whatever the skin's pip size. */
const SINGLE_PIP_SIZE = 0.5;

const singlePip = (settings: SkinSettings): Pip => ({ x: 0.5, y: 0.5, flip: false, scale: SINGLE_PIP_SIZE / settings.pips.size });

const ASSET_FILE = /^(.+?)(\.ink)?\.(png|webp|svg)$/;

export function parseAssetPath(rel: string): { key: string; layer: keyof Asset } | null {
  const m = ASSET_FILE.exec(rel);
  return m ? { key: m[1]!, layer: m[2] ? 'ink' : 'paint' } : null;
}

const SOUND_FILE = /^sounds\/(.+?)(?:-\d+)?\.(wav|mp3|ogg)$/;

/** `sounds/place-2.wav` → `place`: numbered files are variants of the same sound. */
export function parseSoundPath(rel: string): string | null {
  return SOUND_FILE.exec(rel)?.[1] ?? null;
}

/**
 * Group globbed files into skins. Keys look like `/skins/<id>/skin.json` and `/skins/<id>/<path>`.
 * Skins with a broken manifest are left out and reported.
 */
export function collectSkins(
  manifests: Record<string, unknown>,
  files: Record<string, string>,
): { skins: Map<string, SkinSource>; problems: string[] } {
  const skins = new Map<string, SkinSource>();
  const problems: string[] = [];
  const split = (path: string) => /^\/skins\/([^/]+)\/(.+)$/.exec(path);

  for (const [path, raw] of Object.entries(manifests)) {
    const id = split(path)![1]!;
    try {
      skins.set(id, { id, manifest: parseManifest(raw, `${id}/skin.json`), assets: new Map(), sounds: new Map() });
    } catch (e) {
      problems.push(e instanceof SkinError ? e.message : String(e));
    }
  }

  for (const path of Object.keys(files)) {
    const [, id, rel] = split(path)!;
    const skin = skins.get(id!);
    if (!skin) continue;
    const sound = parseSoundPath(rel!);
    if (sound) {
      skin.sounds.set(sound, [...(skin.sounds.get(sound) ?? []), path]);
      continue;
    }
    const parsed = parseAssetPath(rel!);
    if (!parsed) continue;
    const asset = skin.assets.get(parsed.key) ?? {};
    if (asset[parsed.layer]) problems.push(`${id}/${rel}: more than one file for ${parsed.key} (${parsed.layer})`);
    asset[parsed.layer] = path;
    skin.assets.set(parsed.key, asset);
  }
  return { skins, problems };
}

/** The skin followed by its ancestors. Every skin but `classic` extends `classic` unless it says otherwise. */
export function chainFor(skins: ReadonlyMap<string, SkinSource>, id: string): SkinSource[] {
  const chain: SkinSource[] = [];
  let next: string | undefined = id;
  while (next) {
    const skin = skins.get(next);
    if (!skin) throw new SkinError(chain.length ? `${chain.at(-1)!.id} extends unknown skin "${next}"` : `unknown skin "${next}"`);
    if (chain.includes(skin)) throw new SkinError(`skin "${id}" extends itself via ${chain.map((s) => s.id).join(' → ')}`);
    chain.push(skin);
    next = skin.manifest.extends ?? (skin.id === 'classic' ? undefined : 'classic');
  }
  return chain;
}

export function settingsFor(chain: readonly SkinSource[]): SkinSettings {
  return mergeSettings(chain.map((s) => s.manifest).reverse());
}

/** First skin in the chain that has any of `keys`, trying the keys in order within each skin. */
function lookup(chain: readonly SkinSource[], ...keys: string[]): Asset {
  for (const skin of chain) {
    for (const key of keys) {
      const hit = skin.assets.get(key);
      if (hit) return hit;
    }
  }
  return {};
}

function toPip([x, y, opts]: PipPoint, settings: SkinSettings): Pip {
  return { x, y, flip: opts?.flip ?? (settings.pips.flip === 'auto' && y > 0.5), scale: opts?.scale ?? 1 };
}

export function resolveFace(chain: readonly SkinSource[], settings: SkinSettings, deck: DeckDefinition, card: Card): FaceSpec {
  const r = deck.ranks[card.rank]!.label;
  const s = deck.suits[card.suit]!.name;
  // Each falls back to the other, so a skin can start with either one.
  const suit = lookup(chain, `index/${s}`, `pips/${s}`);
  const pip = lookup(chain, `pips/${s}`, `index/${s}`);

  let center: CenterSpec | null = null;
  for (const skin of chain) {
    const art = skin.assets.get(`center/${r}-${s}`) ?? skin.assets.get(`center/${r}`);
    if (art) {
      center = { kind: 'art', art };
      break;
    }
    const layout = skin.manifest.pips?.layouts?.[r];
    if (layout) {
      const points = layout.map((p) => toPip(p, settings));
      center = { kind: 'pips', pip, points, narrow: settings.pips.narrow === 'single' ? [singlePip(settings)] : undefined };
      break;
    }
  }

  return {
    rank: lookup(chain, `index/${r}-${s}`, `index/${r}`),
    suit,
    center: center ?? { kind: 'pips', pip, points: [singlePip(settings)] },
    background: lookup(chain, `card/background-${s}`, `card/background`),
    outline: lookup(chain, `card/outline-${s}`, `card/outline`),
  };
}

export function resolveChrome(chain: readonly SkinSource[]): ChromeSpec {
  const paint = (key: string) => lookup(chain, key).paint;
  const shape = lookup(chain, 'card/shape');
  const slot = lookup(chain, 'table/slot');
  const slotStock = lookup(chain, 'table/slot-stock');
  const stock = lookup(chain, 'table/stock');
  const drop = lookup(chain, 'card/drop');
  return {
    shape: shape.ink ?? shape.paint,
    felt: paint('table/felt'),
    slot: slot.paint,
    slotInk: slot.ink,
    slotStock: slotStock.paint,
    slotStockInk: slotStock.ink,
    stock: stock.paint,
    stockInk: stock.ink,
    drop: drop.paint,
    dropInk: drop.ink,
    button: paint('ui/button'),
    panel: paint('ui/panel'),
  };
}

/** Images the controls and the table show as elements: see `UiAssets`. */
export type UiKey = 'emblem' | 'wins' | 'new-deal' | 'autocascade' | 'victory' | Digit;
export type Digit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';
export type UiAssets = Record<UiKey, Asset>;

export const DIGITS: readonly Digit[] = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

/** The variant's emblem, the labels of the controls and the "You won" panel, and the win counter's digits (corner index images, so 10 is 1 and 0). */
export function resolveUi(chain: readonly SkinSource[], variantId: string): UiAssets {
  const ui = {
    emblem: lookup(chain, `emblem/${variantId}`),
    wins: lookup(chain, 'ui/wins'),
    'new-deal': lookup(chain, 'ui/new-deal'),
    autocascade: lookup(chain, 'ui/autocascade'),
    victory: lookup(chain, 'ui/victory'),
  } as UiAssets;
  for (const d of DIGITS) ui[d] = lookup(chain, `index/${d}`);
  return ui;
}

/** Each sound from the first skin in the chain that has any variant of it, so a skin replaces a sound as a whole. */
export function resolveSounds(chain: readonly SkinSource[]): Partial<Record<SoundName, string[]>> {
  const out: Partial<Record<SoundName, string[]>> = {};
  for (const name of SOUNDS) {
    const hit = chain.find((s) => s.sounds.has(name));
    if (hit) out[name] = hit.sounds.get(name)!;
  }
  return out;
}

/** Files in a skin that no lookup can ever reach: usually a typo in the name. */
export function unknownFiles(skin: SkinSource, deck: DeckDefinition): string[] {
  const ranks = deck.ranks.map((r) => r.label);
  const suits = deck.suits.map((s) => s.name);
  const any = new Set<string>(['card/background', 'card/outline', 'card/shape', 'card/drop', 'table/slot', 'table/slot-stock', 'table/stock', 'ui/wins', 'ui/new-deal', 'ui/autocascade', 'ui/victory']);
  for (const d of DIGITS) any.add(`index/${d}`);
  for (const s of suits) any.add(`index/${s}`).add(`pips/${s}`).add(`card/background-${s}`).add(`card/outline-${s}`);
  for (const r of ranks) {
    any.add(`index/${r}`).add(`center/${r}`);
    for (const s of suits) any.add(`index/${r}-${s}`).add(`center/${r}-${s}`);
  }
  const paintOnly = new Set(['table/felt', 'ui/button', 'ui/panel']);

  const out: string[] = [];
  for (const [key, asset] of skin.assets) {
    // Any variant's emblem: a skin can carry emblems for variants this build doesn't have.
    if (any.has(key) || key.startsWith('emblem/')) continue;
    if (paintOnly.has(key) && !asset.ink) continue;
    out.push(paintOnly.has(key) ? `${key}.ink (the felt, button and panel can't be tinted)` : key);
  }
  for (const name of skin.sounds.keys()) if (!SOUNDS.includes(name as SoundName)) out.push(`sounds/${name}`);
  return out;
}

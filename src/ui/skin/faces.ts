import type { CardFaceRenderer } from '../faces';
import type { Asset, FaceSpec, Pip, UiAssets, UiKey } from './resolve';

export interface LoadedImage {
  url: string;
  /** Natural width in px. */
  w: number;
  /** Width / height. */
  ar: number;
}

/**
 * One image slot. Height comes from CSS (`--h`), width from the image's aspect ratio.
 * Without a loaded image it shows `text` instead, so a missing file never leaves a hole.
 */
export function glyph(cls: string, asset: Asset, images: ReadonlyMap<string, LoadedImage>, text: string): HTMLElement {
  const el = document.createElement('i');
  el.className = `g ${cls}`;
  const ink = asset.ink ? images.get(asset.ink) : undefined;
  const paint = asset.paint ? images.get(asset.paint) : undefined;
  if (!ink && !paint) {
    el.classList.add('text');
    el.textContent = text;
    return el;
  }
  if (ink) {
    el.classList.add('ink');
    el.style.setProperty('--ink', `url("${ink.url}")`);
  }
  if (paint) {
    el.classList.add('paint');
    el.style.setProperty('--paint', `url("${paint.url}")`);
  }
  el.style.setProperty('--ar', String((paint ?? ink)!.ar));
  return el;
}

function pips(cls: string, points: readonly Pip[], pip: Asset, images: ReadonlyMap<string, LoadedImage>, text: string): HTMLElement {
  const el = document.createElement('div');
  el.className = `pips ${cls}`;
  for (const p of points) {
    const g = glyph(p.flip ? 'pip flip' : 'pip', pip, images, text);
    Object.assign(g.style, { left: `${p.x * 100}%`, top: `${p.y * 100}%` });
    if (p.scale !== 1) g.style.setProperty('--s', String(p.scale));
    el.append(g);
  }
  return el;
}

/** Card faces built from a resolved skin: corner index, centre art or pips, optional background and outline. */
export function skinFaces(specs: ReadonlyMap<string, FaceSpec>, images: ReadonlyMap<string, LoadedImage>): CardFaceRenderer {
  return {
    render(card, deck) {
      const spec = specs.get(card.id)!;
      const suit = deck.suits[card.suit]!;
      const rank = deck.ranks[card.rank]!;

      const face = document.createElement('div');
      face.className = 'face';
      face.dataset.suit = suit.name;
      face.setAttribute('aria-label', `${rank.label} of ${suit.name}`);

      if (spec.background.ink || spec.background.paint) {
        face.classList.add('has-bg');
        face.append(glyph('bg', spec.background, images, ''));
      }
      if (spec.outline.ink || spec.outline.paint) face.append(glyph('outline', spec.outline, images, ''));

      const center = document.createElement('div');
      center.className = 'center';
      const c = spec.center;
      if (c.kind === 'art') {
        center.append(glyph('art', c.art, images, rank.label));
      } else {
        center.append(pips('main', c.points, c.pip, images, suit.glyph));
        if (c.narrow) {
          center.classList.add('collapse');
          center.append(pips('narrow-only', c.narrow, c.pip, images, suit.glyph));
        }
      }

      const index = (cls: string) => {
        const el = document.createElement('div');
        el.className = cls;
        el.append(glyph('r', spec.rank, images, rank.label), glyph('s', spec.suit, images, suit.glyph));
        return el;
      };

      face.append(center, index('idx'), index('idx br'));
      return face;
    },
  };
}

/** Skin images shown outside the cards: the variant's emblem, the control labels and the win counter's digits. */
export interface SkinUi {
  /** The skin's image for `key`, or `text` where it has none. */
  glyph(cls: string, key: UiKey, text: string): HTMLElement;
  /** Width / height of the skin's image for `key`, if it has one that loaded. */
  ar(key: UiKey): number | undefined;
}

export function skinUi(assets: UiAssets, images: ReadonlyMap<string, LoadedImage>): SkinUi {
  return {
    glyph: (cls, key, text) => glyph(cls, assets[key], images, text),
    ar(key) {
      const { ink, paint } = assets[key];
      return ((paint && images.get(paint)) || (ink && images.get(ink)) || undefined)?.ar;
    },
  };
}

import { foundationId, STOCK, tableauId, type PileId } from '../core/state';
import type { Variant } from '../core/variant';

export const CARD_RATIO = 1.4;
/** Smallest fan (× card width) that still shows a one-line index. */
const MIN_FAN = 0.34;
/** Largest card width (px) per mode; this is what caps the board width on big screens. */
const MAX_CARD_W = { wide: 150, narrow: 110 };

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Top-left of a pile's base card, and the scale its cards are drawn at. */
export interface Slot {
  x: number;
  y: number;
  scale: number;
}

export interface Layout {
  /** `wide`: one row of columns. `narrow`: tableau split into two bands (portrait phones). */
  mode: 'wide' | 'narrow';
  cardW: number;
  cardH: number;
  slots: Record<PileId, Slot>;
  /** Lowest y a card in a tableau pile may reach. */
  bottom: Record<PileId, number>;
  /** Nominal vertical offset between cards in a column. */
  fan: number;
  /** Below this fan the card index switches to a single line. */
  compactFan: number;
  controls: Rect;
  dividers: Rect[];
}

/** Picks whichever arrangement gives clearly larger cards. */
export function computeLayout(width: number, height: number, variant: Variant): Layout {
  const wide = wideLayout(width, height, variant);
  const narrow = narrowLayout(width, height, variant);
  return narrow.cardW > wide.cardW * 1.35 ? narrow : wide;
}

/** Vertical offset between cards of a tableau pile, compressed when it would overflow. */
export function fanFor(layout: Layout, pile: PileId, count: number): number {
  if (count <= 1) return layout.fan;
  const slot = layout.slots[pile]!;
  const room = (layout.bottom[pile] ?? Infinity) - slot.y - layout.cardH;
  return Math.max(Math.min(layout.fan, room / (count - 1)), layout.cardW * 0.12);
}

function topRow(
  variant: Variant,
  left: number,
  right: number,
  y: number,
  cw: number,
  scale: number,
  gap: number,
  slots: Record<PileId, Slot>,
): Rect {
  const w = cw * scale;
  const f = variant.foundationCount;
  slots[STOCK] = { x: left, y, scale };
  for (let i = 0; i < f; i++) {
    slots[foundationId(i)] = { x: right - (f - i) * w - (f - 1 - i) * gap, y, scale };
  }
  // Controls fill the gap between the stock and the first foundation.
  const x = left + w + gap;
  return { x, y, w: slots[foundationId(0)]!.x - gap - x, h: w * CARD_RATIO };
}

function wideLayout(width: number, height: number, variant: Variant): Layout {
  const n = variant.tableauCount;
  const pad = clamp(Math.min(width, height) * 0.035, 8, 40);
  const gapR = 0.14;
  const byWidth = (width - 2 * pad) / (n + (n - 1) * gapR);
  // Room for the top row plus a 10-card column at minimum fan.
  const byHeight = (height - 2 * pad) / (CARD_RATIO + 0.3 + CARD_RATIO + 9 * MIN_FAN);
  const cw = Math.max(Math.min(byWidth, byHeight, MAX_CARD_W.wide), 10);
  const ch = cw * CARD_RATIO;
  const gap = cw * gapR;
  const total = n * cw + (n - 1) * gap;
  const left = (width - total) / 2;

  const slots: Record<PileId, Slot> = {};
  const bottom: Record<PileId, number> = {};
  const controls = topRow(variant, left, left + total, pad, cw, 1, gap, slots);

  const y = pad + ch + cw * 0.3;
  for (let i = 0; i < n; i++) {
    slots[tableauId(i)] = { x: left + i * (cw + gap), y, scale: 1 };
    bottom[tableauId(i)] = height - pad;
  }
  return { mode: 'wide', cardW: cw, cardH: ch, slots, bottom, fan: cw * 0.43, compactFan: cw * 0.43, controls, dividers: [] };
}

function narrowLayout(width: number, height: number, variant: Variant): Layout {
  const n = variant.tableauCount;
  const perBand = Math.ceil(n / 2);
  const pad = 8;
  const gapR = 0.09;
  const topScale = 0.8;
  const byWidth = (width - 2 * pad) / (perBand + (perBand - 1) * gapR);
  // Top row plus two bands, each fitting a 7-card column at minimum fan.
  const byHeight = (height - 2 * pad) / (CARD_RATIO * topScale + 0.5 + 2 * (CARD_RATIO + 6 * MIN_FAN));
  const cw = Math.max(Math.min(byWidth, byHeight, MAX_CARD_W.narrow), 10);
  const ch = cw * CARD_RATIO;
  const gap = cw * gapR;
  const total = perBand * cw + (perBand - 1) * gap;
  const left = (width - total) / 2;

  const slots: Record<PileId, Slot> = {};
  const bottom: Record<PileId, number> = {};
  const controls = topRow(variant, left, left + total, pad, cw, topScale, gap * 0.8, slots);

  const bandGap = cw * 0.25;
  const band1 = pad + ch * topScale + bandGap;
  const bandH = (height - pad - band1 - bandGap) / 2;
  const band2 = band1 + bandH + bandGap;
  const shift = ((perBand - (n - perBand)) * (cw + gap)) / 2;

  for (let i = 0; i < n; i++) {
    const first = i < perBand;
    const col = first ? i : i - perBand;
    slots[tableauId(i)] = { x: left + (first ? 0 : shift) + col * (cw + gap), y: first ? band1 : band2, scale: 1 };
    bottom[tableauId(i)] = first ? band1 + bandH : height - pad;
  }
  return {
    mode: 'narrow',
    cardW: cw,
    cardH: ch,
    slots,
    bottom,
    fan: cw * 0.38,
    compactFan: Infinity,
    controls,
    dividers: [{ x: left, y: band2 - bandGap / 2, w: total, h: 1 }],
  };
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}

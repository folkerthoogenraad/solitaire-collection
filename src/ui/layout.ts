import { foundationId, STOCK, tableauId, WASTE, type PileId } from '../core/state';
import type { Variant } from '../core/variant';

export const CARD_RATIO = 1.4;
/** Smallest fan (× card width) that still shows a one-line index. */
const MIN_FAN = 0.34;
/** Largest card width (px) per mode; this is what caps the board width on big screens. */
export const MAX_CARD_W = { wide: 150, narrow: 110 };
/** Narrowest the controls get (× card width) before the emblem gives way. */
const MIN_CONTROLS_W = 1.5;
/**
 * Narrow mode, × card width: the emblem and controls row, the gap below it (room for a foundation's lifted base
 * card), and the gap between bands.
 */
const HEADER_H = 1.1;
const PILE_ROW_GAP = 0.3;
const BAND_GAP = 0.25;
/** Offset between face-down cards in a column (× card width): only their edge needs to show. */
const DOWN_FAN = { wide: 0.15, narrow: 0.1 };
/** With a waste pile (Klondike), the columns fit at least this many face-down and face-up cards at minimum fan. */
const WASTE_BUDGET = { down: 6, up: 8 };

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
  /** Nominal vertical offset between face-up cards in a column. */
  fan: number;
  /** Vertical offset between face-down cards in a column; never compressed. */
  downFan: number;
  /** Column cards use the one-line index. Fixed per mode: a column that gets compressed only moves its cards closer. */
  compact: boolean;
  controls: Rect;
  /** Font size of the controls (× card width), where the layout squeezes them; CSS decides otherwise. */
  controlsFont?: number;
  /** The variant's emblem, next to the stock; only when the skin has one. */
  emblem?: Rect;
  dividers: Rect[];
}

/**
 * Picks whichever arrangement gives clearly larger cards. `emblemAr`: width / height of the emblem, if there is one.
 * Seven columns (Klondike) fit a phone in one band, so card size doesn't tell the two apart: portrait gets the phone
 * layout there, with the emblem and controls large enough to read and tap.
 */
export function computeLayout(width: number, height: number, variant: Variant, emblemAr?: number): Layout {
  if (variant.hasWaste) {
    return height > width ? wasteNarrowLayout(width, height, variant, emblemAr) : wasteWideLayout(width, height, variant, emblemAr);
  }
  const wide = wideLayout(width, height, variant, emblemAr);
  const narrow = narrowLayout(width, height, variant, emblemAr);
  return narrow.cardW > wide.cardW * 1.35 ? narrow : wide;
}

/** Vertical offset between the face-up cards of a tableau pile, compressed when it would overflow. */
export function fanFor(layout: Layout, pile: PileId, count: number, down = 0): number {
  const up = count - down;
  if (up <= 1) return layout.fan;
  const slot = layout.slots[pile]!;
  const room = (layout.bottom[pile] ?? Infinity) - slot.y - layout.cardH - down * layout.downFan;
  return Math.max(Math.min(layout.fan, room / (up - 1)), layout.cardW * 0.12);
}

/** Stock at the left end of the row, then the waste if there is one; foundations at the right. */
function pileRow(
  variant: Variant,
  left: number,
  right: number,
  y: number,
  cw: number,
  gap: number,
  slots: Record<PileId, Slot>,
): void {
  const f = variant.foundationCount;
  slots[STOCK] = { x: left, y, scale: 1 };
  if (variant.hasWaste) slots[WASTE] = { x: left + cw + gap, y, scale: 1 };
  for (let i = 0; i < f; i++) {
    slots[foundationId(i)] = { x: right - (f - i) * cw - (f - 1 - i) * gap, y, scale: 1 };
  }
}

/**
 * The emblem at `x`, `h` tall unless that squeezes the controls, which fill the rest of the room up to `end`.
 * `emblemAr`: width / height of the emblem, if there is one.
 */
function emblemAndControls(
  x: number,
  end: number,
  y: number,
  h: number,
  cw: number,
  gap: number,
  emblemAr: number | undefined,
): { controls: Rect; emblem?: Rect } {
  let emblem: Rect | undefined;
  if (emblemAr) {
    const ew = Math.min(h * emblemAr, end - x - gap - cw * MIN_CONTROLS_W);
    if (ew > 0) {
      const eh = ew / emblemAr;
      emblem = { x, y: y + (h - eh) / 2, w: ew, h: eh };
      x += ew + gap;
    }
  }
  return { controls: { x, y, w: end - x, h }, emblem };
}

function wideLayout(width: number, height: number, variant: Variant, emblemAr: number | undefined): Layout {
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
  pileRow(variant, left, left + total, pad, cw, gap, slots);
  // The emblem and controls sit between the stock and the first foundation.
  const top = emblemAndControls(left + cw + gap, slots[foundationId(0)]!.x - gap, pad, ch, cw, gap, emblemAr);

  const y = pad + ch + cw * 0.3;
  for (let i = 0; i < n; i++) {
    slots[tableauId(i)] = { x: left + i * (cw + gap), y, scale: 1 };
    bottom[tableauId(i)] = height - pad;
  }
  return {
    mode: 'wide',
    cardW: cw,
    cardH: ch,
    slots,
    bottom,
    fan: cw * 0.43,
    downFan: cw * DOWN_FAN.wide,
    compact: false,
    ...top,
    dividers: [],
  };
}

function narrowLayout(width: number, height: number, variant: Variant, emblemAr: number | undefined): Layout {
  const n = variant.tableauCount;
  const perBand = Math.ceil(n / 2);
  const pad = 8;
  const gapR = 0.09;
  const byWidth = (width - 2 * pad) / (perBand + (perBand - 1) * gapR);
  // Header, the stock and foundations, then two bands, each fitting a 7-card column at minimum fan.
  const byHeight =
    (height - 2 * pad) / (HEADER_H + PILE_ROW_GAP + CARD_RATIO + 2 * BAND_GAP + 2 * (CARD_RATIO + 6 * MIN_FAN));
  const cw = Math.max(Math.min(byWidth, byHeight, MAX_CARD_W.narrow), 10);
  const ch = cw * CARD_RATIO;
  const gap = cw * gapR;
  const total = perBand * cw + (perBand - 1) * gap;
  const left = (width - total) / 2;

  const slots: Record<PileId, Slot> = {};
  const bottom: Record<PileId, number> = {};
  // Emblem and controls get a row of their own, so both can be large enough to read and tap.
  const top = emblemAndControls(left, left + total, pad, cw * HEADER_H, cw, gap, emblemAr);
  const pileY = pad + cw * (HEADER_H + PILE_ROW_GAP);
  pileRow(variant, left, left + total, pileY, cw, gap, slots);

  const bandGap = cw * BAND_GAP;
  const band1 = pileY + ch + bandGap;
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
    downFan: cw * DOWN_FAN.narrow,
    compact: true,
    ...top,
    dividers: [{ x: left, y: band2 - bandGap / 2, w: total, h: 1 }],
  };
}

/** Height of a column of `WASTE_BUDGET` cards, × card width, beyond the first card. */
const wasteColumn = (downFan: number) => WASTE_BUDGET.down * downFan + (WASTE_BUDGET.up - 1) * MIN_FAN;

/**
 * Stock, waste, the emblem over the controls, then the foundations; one row of columns below. Seven columns leave
 * width to spare, so the gaps are wider than BBB's, which also gives the emblem's column more room.
 */
function wasteWideLayout(width: number, height: number, variant: Variant, emblemAr: number | undefined): Layout {
  const n = variant.tableauCount;
  const pad = clamp(Math.min(width, height) * 0.035, 8, 40);
  const gapR = 0.25;
  const byWidth = (width - 2 * pad) / (n + (n - 1) * gapR);
  const byHeight = (height - 2 * pad) / (CARD_RATIO + 0.3 + CARD_RATIO + wasteColumn(DOWN_FAN.wide));
  const cw = Math.max(Math.min(byWidth, byHeight, MAX_CARD_W.wide), 10);
  const ch = cw * CARD_RATIO;
  const gap = cw * gapR;
  const total = n * cw + (n - 1) * gap;
  const left = (width - total) / 2;

  const slots: Record<PileId, Slot> = {};
  const bottom: Record<PileId, number> = {};
  pileRow(variant, left, left + total, pad, cw, gap, slots);

  // The column after the waste, reaching halfway into the gaps either side: emblem on top, controls below.
  const x = slots[WASTE]!.x + cw + gap / 2;
  const w = slots[foundationId(0)]!.x - gap / 2 - x;
  let emblem: Rect | undefined;
  if (emblemAr) {
    const eh = Math.min(w / emblemAr, ch * 0.5);
    emblem = { x: x + (w - eh * emblemAr) / 2, y: pad, w: eh * emblemAr, h: eh };
  }
  const controlsY = pad + (emblem?.h ?? 0);
  const controls: Rect = { x, y: controlsY, w, h: pad + ch - controlsY };

  const y = pad + ch + cw * 0.3;
  for (let i = 0; i < n; i++) {
    slots[tableauId(i)] = { x: left + i * (cw + gap), y, scale: 1 };
    bottom[tableauId(i)] = height - pad;
  }
  return {
    mode: 'wide',
    cardW: cw,
    cardH: ch,
    slots,
    bottom,
    fan: cw * 0.4,
    downFan: cw * DOWN_FAN.wide,
    compact: false,
    controls,
    controlsFont: 0.165,
    emblem,
    dividers: [],
  };
}

/** Like BBB on a phone, with the columns in one band: emblem and controls, then the piles, then the columns. */
function wasteNarrowLayout(width: number, height: number, variant: Variant, emblemAr: number | undefined): Layout {
  const n = variant.tableauCount;
  const pad = 8;
  const gapR = 0.09;
  const byWidth = (width - 2 * pad) / (n + (n - 1) * gapR);
  const byHeight =
    (height - 2 * pad) / (HEADER_H + PILE_ROW_GAP + CARD_RATIO + BAND_GAP + CARD_RATIO + wasteColumn(DOWN_FAN.narrow));
  const cw = Math.max(Math.min(byWidth, byHeight, MAX_CARD_W.narrow), 10);
  const ch = cw * CARD_RATIO;
  const gap = cw * gapR;
  const total = n * cw + (n - 1) * gap;
  const left = (width - total) / 2;

  const slots: Record<PileId, Slot> = {};
  const bottom: Record<PileId, number> = {};
  const top = emblemAndControls(left, left + total, pad, cw * HEADER_H, cw, gap, emblemAr);
  const pileY = pad + cw * (HEADER_H + PILE_ROW_GAP);
  pileRow(variant, left, left + total, pileY, cw, gap, slots);

  const y = pileY + ch + cw * BAND_GAP;
  for (let i = 0; i < n; i++) {
    slots[tableauId(i)] = { x: left + i * (cw + gap), y, scale: 1 };
    bottom[tableauId(i)] = height - pad;
  }
  return {
    mode: 'narrow',
    cardW: cw,
    cardH: ch,
    slots,
    bottom,
    fan: cw * 0.38,
    downFan: cw * DOWN_FAN.narrow,
    compact: true,
    ...top,
    dividers: [],
  };
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}

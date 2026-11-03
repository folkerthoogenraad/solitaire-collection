import { describe, expect, it } from 'vitest';
import { bbb } from '../core/variants/bbb';
import { klondike } from '../core/variants/klondike';
import { computeLayout, fanFor } from './layout';

function expectInside(width: number, height: number) {
  const l = computeLayout(width, height, bbb);
  for (const s of Object.values(l.slots)) {
    expect(s.x).toBeGreaterThanOrEqual(0);
    expect(s.y).toBeGreaterThanOrEqual(0);
    expect(s.x + l.cardW * s.scale).toBeLessThanOrEqual(width + 0.01);
    expect(s.y + l.cardH * s.scale).toBeLessThanOrEqual(height + 0.01);
  }
  expect(l.controls.w).toBeGreaterThan(0);
  return l;
}

describe('layout', () => {
  it('uses one row of columns on a laptop', () => {
    expect(expectInside(1366, 650).mode).toBe('wide');
  });

  it('uses two bands on a portrait phone', () => {
    const l = expectInside(390, 760);
    expect(l.mode).toBe('narrow');
    expect(l.cardW).toBeGreaterThan(50);
  });

  it('puts the emblem next to the stock, as tall as it while the controls keep room', () => {
    const wide = computeLayout(1366, 650, bbb, 1);
    const stock = wide.slots.stock!;
    expect(wide.emblem!.h).toBeCloseTo(wide.cardH);
    expect(wide.emblem!.x).toBeGreaterThan(stock.x + wide.cardW);
    expect(wide.controls.x).toBeGreaterThan(wide.emblem!.x + wide.emblem!.w);

    expect(computeLayout(390, 760, bbb).emblem).toBeUndefined();
  });

  it('puts the emblem and controls in a row of their own above the stock and foundations on a phone', () => {
    const narrow = computeLayout(390, 760, bbb, 2);
    const stock = narrow.slots.stock!;
    expect(narrow.emblem!.x).toBeCloseTo(stock.x);
    expect(narrow.emblem!.y + narrow.emblem!.h).toBeLessThan(stock.y);
    expect(narrow.controls.y + narrow.controls.h).toBeLessThan(stock.y);
    expect(narrow.controls.x).toBeGreaterThan(narrow.emblem!.x + narrow.emblem!.w);
    expect(narrow.controls.w).toBeGreaterThanOrEqual(narrow.cardW * 1.5 - 0.01);
    expect(narrow.slots.f0!.y).toBe(stock.y);
    expect(stock.scale).toBe(1);
  });

  it('compresses long columns to fit', () => {
    const l = computeLayout(390, 760, bbb);
    const fan = fanFor(l, 't0', 14);
    expect(l.slots.t0!.y + 13 * fan + l.cardH).toBeLessThanOrEqual(l.bottom.t0! + 0.01);
    expect(fanFor(l, 't0', 3)).toBe(l.fan);
  });

  it('compresses only the face-up cards of a column', () => {
    const l = computeLayout(390, 760, klondike, 2);
    const fan = fanFor(l, 't6', 19, 6);
    expect(l.slots.t6!.y + 6 * l.downFan + 12 * fan + l.cardH).toBeLessThanOrEqual(l.bottom.t6! + 0.01);
  });
});

describe('layout with a waste pile (Klondike)', () => {
  function expectFits(width: number, height: number) {
    const l = computeLayout(width, height, klondike, 2);
    const rects = [l.controls, l.emblem!, ...Object.values(l.slots).map((s) => ({ ...s, w: l.cardW, h: l.cardH }))];
    for (const r of rects) {
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.x + r.w).toBeLessThanOrEqual(width + 0.01);
      expect(r.y + r.h).toBeLessThanOrEqual(height + 0.01);
    }
    return l;
  }

  it('puts the waste next to the stock and the emblem over the controls on a laptop', () => {
    const l = expectFits(1366, 650);
    expect(l.mode).toBe('wide');
    expect(l.slots.waste!.x).toBeGreaterThan(l.slots.stock!.x + l.cardW);
    expect(l.slots.waste!.y).toBe(l.slots.stock!.y);
    expect(l.emblem!.x).toBeGreaterThan(l.slots.waste!.x + l.cardW);
    expect(l.controls.y).toBeGreaterThanOrEqual(l.emblem!.y + l.emblem!.h);
    expect(l.controls.x + l.controls.w).toBeLessThan(l.slots.f0!.x);
  });

  it('uses the phone layout in portrait, columns in one band', () => {
    const l = expectFits(390, 760);
    expect(l.mode).toBe('narrow');
    expect(l.dividers).toEqual([]);
    expect(l.slots.t6!.y).toBe(l.slots.t0!.y);
    expect(l.emblem!.y + l.emblem!.h).toBeLessThan(l.slots.stock!.y);
    expect(l.cardW).toBeGreaterThan(45);
  });
});

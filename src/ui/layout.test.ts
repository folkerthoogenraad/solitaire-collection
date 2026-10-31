import { describe, expect, it } from 'vitest';
import { bbb } from '../core/variants/bbb';
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

    const narrow = computeLayout(390, 760, bbb, 1);
    expect(narrow.emblem!.h).toBeLessThanOrEqual(narrow.cardH * narrow.slots.stock!.scale + 0.01);
    expect(narrow.controls.w).toBeGreaterThanOrEqual(narrow.cardW * 1.5 - 0.01);
    expect(computeLayout(390, 760, bbb).emblem).toBeUndefined();
  });

  it('compresses long columns to fit', () => {
    const l = computeLayout(390, 760, bbb);
    const fan = fanFor(l, 't0', 14);
    expect(l.slots.t0!.y + 13 * fan + l.cardH).toBeLessThanOrEqual(l.bottom.t0! + 0.01);
    expect(fanFor(l, 't0', 3)).toBe(l.fan);
  });
});

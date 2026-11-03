import { buildCards } from '../core/deck';
import { downCount, pileKind, STOCK, type GameState, type PileId } from '../core/state';
import type { Variant } from '../core/variant';
import type { CardFaceRenderer } from './faces';
import { fanFor, type Layout, type Rect } from './layout';

export interface CardPos {
  x: number;
  y: number;
  scale: number;
  z: number;
  compact: boolean;
  /** Degrees, about the card's top-left corner. */
  rotate: number;
  /** Lying face down: the back shows. */
  down: boolean;
}

export interface RenderOptions {
  /** Jump to positions without transitions (resize, first paint). */
  instant?: boolean;
  /** Cards that stay above the rest while they travel. */
  raise?: readonly string[];
  /** Fly every card out of the stock in deal order. */
  deal?: boolean;
}

/** Card move and deal durations; also written to the board as `--move-ms` / `--deal-ms` for the CSS transitions. */
const MOVE_MS = 400;
export const DEAL_STAGGER_MS = 50;
const DEAL_MS = 320;
/** Dealt cards stack above whatever stays in the stock, in deal order. */
const DEAL_Z = 100;
const RAISED_Z = 500;
const DRAG_Z = 1000;
/**
 * A foundation that doesn't start at the lowest rank shows its base card's index, otherwise you can't tell where the
 * pile starts: the base card tilts about its top-right corner and lifts, the cards on it drop (both × card width).
 * Split between up and down because phones have only a few pixels above the top row.
 */
const PEEK = { rotate: 5, lift: 0.12, drop: 0.1 };
/** Size of a dragged card relative to resting; depth comes from the lifted shadow instead. */
export const DRAG_SCALE = 1;

/** Snaps to device pixels: a card on its own compositor layer at a fractional offset gets resampled and looks blurry. */
const snap = (v: number) => Math.round(v * devicePixelRatio) / devicePixelRatio;
const transform = (x: number, y: number, scale: number, rotate = 0) =>
  `translate3d(${snap(x)}px, ${snap(y)}px, 0)${rotate ? ` rotate(${rotate}deg)` : ''} scale(${scale})`;

function div(className: string): HTMLDivElement {
  const el = document.createElement('div');
  el.className = className;
  return el;
}

/**
 * Owns one persistent element per card and moves them with transforms only.
 * Cards are never re-parented, so any position change animates for free.
 */
export class Renderer {
  readonly layer = div('layer');
  layout!: Layout;

  private cards = new Map<string, HTMLElement>();
  private pos = new Map<string, CardPos>();
  private written = new Map<string, string>();
  private slots = new Map<PileId, HTMLElement>();
  private dividers: HTMLElement[] = [];
  private highlightEl = div('drop-hl');
  private raised = new Map<string, number>();
  /** Timer that ends the deal; the board's `dealing` class is shared with whatever game comes next. */
  private dealing = 0;

  constructor(
    private board: HTMLElement,
    private variant: Variant,
    faces: CardFaceRenderer,
    private controls: HTMLElement,
    private emblem?: HTMLElement,
  ) {
    for (const id of variant.piles()) {
      const slot = div('slot');
      slot.dataset.pile = id;
      if (id === STOCK) {
        slot.classList.add('stock');
        const label = div('slot-label');
        label.textContent = 'Stock';
        slot.append(label);
      }
      this.slots.set(id, slot);
      this.layer.append(slot);
    }
    if (emblem) this.layer.append(emblem);
    for (const c of buildCards(variant.deck)) {
      const el = div('card');
      el.dataset.id = c.id;
      el.append(faces.render(c, variant.deck), faces.back());
      this.cards.set(c.id, el);
      this.layer.append(el);
    }
    this.layer.append(this.highlightEl, controls);
    board.append(this.layer);
    board.style.setProperty('--move-ms', `${MOVE_MS}ms`);
    board.style.setProperty('--deal-ms', `${DEAL_MS}ms`);
  }

  /** Takes the cards and chrome off the board, and leaves the board's classes as a fresh renderer expects them. */
  destroy(): void {
    clearTimeout(this.dealing);
    for (const timer of this.raised.values()) clearTimeout(timer);
    this.board.classList.remove('dealing');
    this.layer.remove();
  }

  setLayout(layout: Layout): void {
    this.layout = layout;
    this.board.style.setProperty('--cw', `${layout.cardW}px`);
    this.board.dataset.mode = layout.mode;

    for (const [id, el] of this.slots) {
      const s = layout.slots[id]!;
      el.style.transform = transform(s.x, s.y, s.scale);
    }

    this.dividers.forEach((d) => d.remove());
    this.dividers = layout.dividers.map((r) => {
      const d = div('divider');
      Object.assign(d.style, { width: `${r.w}px`, transform: transform(r.x, r.y, 1) });
      this.layer.prepend(d);
      return d;
    });

    const c = layout.controls;
    Object.assign(this.controls.style, { width: `${c.w}px`, height: `${c.h}px`, transform: transform(c.x, c.y, 1) });
    this.controls.style.fontSize = layout.controlsFont ? `calc(var(--cw) * ${layout.controlsFont})` : '';

    const e = layout.emblem;
    if (this.emblem) this.emblem.hidden = !e;
    if (this.emblem && e) Object.assign(this.emblem.style, { width: `${e.w}px`, height: `${e.h}px`, transform: transform(e.x, e.y, 1) });
  }

  render(state: GameState, opts: RenderOptions = {}): void {
    const next = this.compute(state);
    for (const id of opts.raise ?? []) this.raise(id);

    if (opts.deal) return this.deal(state, next);

    if (opts.instant) this.board.classList.add('no-anim');
    for (const [id, p] of next) this.write(id, p, !opts.instant);
    if (opts.instant) {
      void this.layer.offsetWidth;
      this.board.classList.remove('no-anim');
    }
  }

  positionOf(id: string): CardPos {
    return this.pos.get(id)!;
  }

  /** Rect of the top card of a pile, or of the empty slot. */
  topRect(state: GameState, pile: PileId): Rect {
    const ids = state.piles[pile] ?? [];
    const p = ids.length ? this.pos.get(ids[ids.length - 1]!)! : this.layout.slots[pile]!;
    return { x: p.x, y: p.y, w: this.layout.cardW * p.scale, h: this.layout.cardH * p.scale };
  }

  /** Area that accepts a drop: the whole column for tableau piles, the slot otherwise. */
  dropRect(state: GameState, pile: PileId): Rect {
    const top = this.topRect(state, pile);
    if (pileKind(pile) !== 'tableau') return top;
    const slot = this.layout.slots[pile]!;
    return { x: slot.x, y: slot.y, w: top.w, h: top.y + top.h - slot.y };
  }

  beginDrag(ids: readonly string[]): void {
    ids.forEach((id, i) => {
      const el = this.cards.get(id)!;
      // A card grabbed while still settling from a previous move: its pending reset would drop it below the rest of the stack.
      clearTimeout(this.raised.get(id));
      this.raised.delete(id);
      el.classList.add('dragging');
      el.style.zIndex = String(DRAG_Z + i);
    });
  }

  /** Follow the pointer; `dx`/`dy` are relative to each card's resting position. */
  dragTo(ids: readonly string[], dx: number, dy: number): void {
    for (const id of ids) {
      const p = this.pos.get(id)!;
      const t = transform(p.x + dx, p.y + dy, p.scale * DRAG_SCALE, p.rotate);
      this.cards.get(id)!.style.transform = t;
      this.written.set(id, t);
    }
  }

  endDrag(ids: readonly string[]): void {
    for (const id of ids) this.cards.get(id)!.classList.remove('dragging');
  }

  highlight(rect: Rect | null): void {
    const el = this.highlightEl;
    el.classList.toggle('show', !!rect);
    if (rect) Object.assign(el.style, { width: `${rect.w}px`, height: `${rect.h}px`, transform: transform(rect.x, rect.y, 1) });
  }

  /** Subtly mark a single card; `null` clears. */
  hint(id: string | null): void {
    for (const [cardId, el] of this.cards) el.classList.toggle('hint', cardId === id);
  }

  /** Short shake for a card that cannot be picked up. */
  nope(id: string): void {
    this.replayClass(this.cards.get(id)!, 'nope');
  }

  celebrate(ids: readonly string[]): void {
    ids.forEach((id, i) => {
      const el = this.cards.get(id)!;
      el.style.setProperty('--delay', `${i * 120}ms`);
      this.replayClass(el, 'celebrate');
    });
  }

  private replayClass(el: HTMLElement, cls: string): void {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
    el.addEventListener('animationend', () => el.classList.remove(cls), { once: true });
  }

  private compute(state: GameState): Map<string, CardPos> {
    const out = new Map<string, CardPos>();
    for (const pile of this.variant.piles()) {
      const ids = state.piles[pile] ?? [];
      const slot = this.layout.slots[pile]!;
      const tableau = pileKind(pile) === 'tableau';
      const down = downCount(state, pile);
      const fan = tableau ? fanFor(this.layout, pile, ids.length, down) : 0;
      const downFan = tableau ? this.layout.downFan : 0;
      const compact = tableau && this.layout.compact;
      ids.forEach((id, i) => {
        const y = slot.y + Math.min(i, down) * downFan + Math.max(i - down, 0) * fan;
        out.set(id, { x: slot.x, y, scale: slot.scale, z: i + 1, compact, rotate: 0, down: i < down });
      });
      if (pileKind(pile) === 'foundation' && ids.length > 1 && this.variant.card(ids[0]!).rank > 0) {
        const w = this.layout.cardW * slot.scale;
        const a = (PEEK.rotate * Math.PI) / 180;
        // Rotation is about the top-left corner (transform-origin); shift it to pivot on the top-right one.
        out.set(ids[0]!, {
          ...out.get(ids[0]!)!,
          x: slot.x + w * (1 - Math.cos(a)),
          y: slot.y - w * (Math.sin(a) + PEEK.lift),
          rotate: PEEK.rotate,
        });
        for (const id of ids.slice(1)) out.get(id)!.y += PEEK.drop * w;
      }
    }
    return out;
  }

  /** `animate`: a card turning face up flips over. */
  private write(id: string, p: CardPos, animate = false): void {
    const el = this.cards.get(id)!;
    const was = this.pos.get(id);
    this.pos.set(id, p);
    // Only this card's class changes, never the board's (docs/plans/mobile-animation-jank).
    el.classList.toggle('down', p.down);
    if (animate && was?.down && !p.down) this.replayClass(el, 'flip');
    const t = transform(p.x, p.y, p.scale, p.rotate);
    if (this.written.get(id) !== t) {
      el.style.transform = t;
      this.written.set(id, t);
    }
    if (!this.raised.has(id)) el.style.zIndex = String(p.z);
    el.classList.toggle('compact', p.compact);
  }

  /** Keep a card on top while it travels, then drop it back to its pile's stacking order. */
  private raise(id: string): void {
    const el = this.cards.get(id)!;
    clearTimeout(this.raised.get(id));
    el.style.zIndex = String(RAISED_Z + (this.pos.get(id)?.z ?? 0));
    this.raised.set(
      id,
      window.setTimeout(() => {
        this.raised.delete(id);
        el.style.zIndex = String(this.pos.get(id)?.z ?? 0);
      }, MOVE_MS + 40),
    );
  }

  private deal(state: GameState, next: Map<string, CardPos>): void {
    const stock = this.layout.slots[STOCK]!;
    const order = new Map(this.variant.dealOrder(state).map((id, i) => [id, i]));
    // Deal order is also a valid stacking order within each column, and keeps later cards on top in flight.
    // Cards that aren't dealt (Klondike's stock) keep their pile's order, under the ones flying out.
    const z = (id: string, p: CardPos) => {
      const o = order.get(id);
      return o === undefined ? p.z : DEAL_Z + o;
    };

    this.board.classList.add('no-anim');
    for (const [id, p] of next) {
      this.write(id, { ...p, x: stock.x, y: stock.y, scale: stock.scale, z: z(id, p) });
    }
    void this.layer.offsetWidth;
    this.board.classList.remove('no-anim');

    this.board.classList.add('dealing');
    for (const [id, p] of next) {
      const el = this.cards.get(id)!;
      el.style.transitionDelay = `${(order.get(id) ?? 0) * DEAL_STAGGER_MS}ms`;
      this.write(id, p);
      el.style.zIndex = String(z(id, p));
    }
    clearTimeout(this.dealing);
    this.dealing = window.setTimeout(() => {
      this.board.classList.remove('dealing');
      for (const el of this.cards.values()) el.style.transitionDelay = '';
    }, order.size * DEAL_STAGGER_MS + DEAL_MS);
  }
}

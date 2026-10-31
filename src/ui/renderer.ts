import { buildCards } from '../core/deck';
import { pileKind, STOCK, tableauId, type GameState, type PileId } from '../core/state';
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

  constructor(
    private board: HTMLElement,
    private variant: Variant,
    faces: CardFaceRenderer,
    private controls: HTMLElement,
    private emblem?: HTMLElement,
  ) {
    for (const id of variant.piles()) {
      const slot = div('slot');
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
      el.append(faces.render(c, variant.deck));
      this.cards.set(c.id, el);
      this.layer.append(el);
    }
    this.layer.append(this.highlightEl, controls);
    board.append(this.layer);
    board.style.setProperty('--move-ms', `${MOVE_MS}ms`);
    board.style.setProperty('--deal-ms', `${DEAL_MS}ms`);
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

    const e = layout.emblem;
    if (this.emblem) this.emblem.hidden = !e;
    if (this.emblem && e) Object.assign(this.emblem.style, { width: `${e.w}px`, height: `${e.h}px`, transform: transform(e.x, e.y, 1) });
  }

  render(state: GameState, opts: RenderOptions = {}): void {
    const next = this.compute(state);
    for (const id of opts.raise ?? []) this.raise(id);

    if (opts.deal) return this.deal(state, next);

    if (opts.instant) this.board.classList.add('no-anim');
    for (const [id, p] of next) this.write(id, p);
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
      const fan = tableau ? fanFor(this.layout, pile, ids.length) : 0;
      const compact = tableau && this.layout.compact;
      ids.forEach((id, i) =>
        out.set(id, { x: slot.x, y: slot.y + i * fan, scale: slot.scale, z: i + 1, compact, rotate: 0 }),
      );
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

  private write(id: string, p: CardPos): void {
    this.pos.set(id, p);
    const el = this.cards.get(id)!;
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
    const order = this.dealOrder(state);

    this.board.classList.add('no-anim');
    for (const [id, p] of next) {
      this.write(id, { ...p, x: stock.x, y: stock.y, scale: stock.scale, z: (order.get(id) ?? 0) + 1 });
    }
    void this.layer.offsetWidth;
    this.board.classList.remove('no-anim');

    this.board.classList.add('dealing');
    for (const [id, p] of next) {
      const el = this.cards.get(id)!;
      el.style.transitionDelay = `${(order.get(id) ?? 0) * DEAL_STAGGER_MS}ms`;
      this.write(id, p);
      // Deal order is also a valid stacking order within each column, and keeps later cards on top in flight.
      el.style.zIndex = String((order.get(id) ?? 0) + 1);
    }
    window.setTimeout(() => {
      this.board.classList.remove('dealing');
      for (const el of this.cards.values()) el.style.transitionDelay = '';
    }, next.size * DEAL_STAGGER_MS + DEAL_MS);
  }

  /** Round-robin order the cards were dealt in, so they fly out like a real deal. */
  private dealOrder(state: GameState): Map<string, number> {
    const order = new Map<string, number>();
    const columns = this.variant.tableauCount;
    for (let c = 0; c < columns; c++) {
      (state.piles[tableauId(c)] ?? []).forEach((id, k) => order.set(id, k * columns + c));
    }
    return order;
  }
}

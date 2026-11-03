import { pileKind, type GameState, type Move, type PileId } from '../core/state';
import type { Variant } from '../core/variant';
import type { Rect } from './layout';
import { DRAG_SCALE, type Renderer } from './renderer';

export interface DragHost {
  variant: Variant;
  renderer: Renderer;
  state(): GameState;
  /** Applies the move if legal and re-renders. Returns whether it was applied. */
  commit(move: Move): boolean;
  /** Re-render the current state, raising `ids` while they travel back. */
  restore(ids: readonly string[]): void;
  /** Cards were lifted off their pile. */
  pickUp(ids: readonly string[]): void;
}

interface Session {
  pointerId: number;
  from: PileId;
  ids: string[];
  startX: number;
  startY: number;
  /** Extra vertical offset on touch so the finger doesn't cover the cards; eased in from `liftStart`. */
  lift: number;
  liftStart: number;
  dx: number;
  dy: number;
  target: PileId | null;
}

/** Matches the shadow's lift transition, so card and shadow rise together. */
const LIFT_MS = 160;

/** Current touch lift, eased out over `LIFT_MS`. */
function liftOf(s: Session, now: number): number {
  const t = Math.min((now - s.liftStart) / LIFT_MS, 1);
  return s.lift * (1 - (1 - t) ** 3);
}

function overlap(a: Rect, b: Rect): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

function pileOf(state: GameState, id: string): PileId | undefined {
  return Object.keys(state.piles).find((p) => state.piles[p]!.includes(id));
}

/** Pointer-event drag & drop for mouse, touch and pen through one code path. Returns a function that detaches it. */
export function attachDrag(surface: HTMLElement, host: DragHost): () => void {
  const { renderer, variant } = host;
  const listening = new AbortController();
  const { signal } = listening;
  let session: Session | null = null;
  let frame = 0;
  /** Pointer that only shows a hint until released: a right-button hold, or a card that can't be picked up. */
  let hintPointer: number | null = null;

  /** Legal pile with the largest overlap with the dragged card. */
  function findTarget(s: Session, lift: number): PileId | null {
    const state = host.state();
    const lead = renderer.positionOf(s.ids[0]!);
    const scale = lead.scale * DRAG_SCALE;
    const dragged: Rect = {
      x: lead.x + s.dx,
      y: lead.y + s.dy + lift,
      w: renderer.layout.cardW * scale,
      h: renderer.layout.cardH * scale,
    };
    let best: PileId | null = null;
    let bestArea = 0;
    for (const pile of variant.piles()) {
      // The stock only takes the waste back, by tapping it.
      if (pileKind(pile) === 'stock') continue;
      if (!variant.canMove(state, { from: s.from, to: pile, count: s.ids.length })) continue;
      const area = overlap(dragged, renderer.dropRect(state, pile));
      if (area > bestArea) {
        best = pile;
        bestArea = area;
      }
    }
    return best;
  }

  function update() {
    frame = 0;
    if (!session) return;
    const now = performance.now();
    const lift = liftOf(session, now);
    renderer.dragTo(session.ids, session.dx, session.dy + lift);
    session.target = findTarget(session, lift);
    renderer.highlight(session.target ? renderer.topRect(host.state(), session.target) : null);
    // Keep animating while the lift eases in, even if the finger holds still.
    if (now - session.liftStart < LIFT_MS) frame = requestAnimationFrame(update);
  }

  function finish(drop: boolean) {
    const s = session;
    session = null;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    renderer.hint(null);
    if (!s) return;

    renderer.highlight(null);
    renderer.endDrag(s.ids);
    const moved = drop && s.target && host.commit({ from: s.from, to: s.target, count: s.ids.length });
    if (!moved) host.restore(s.ids);
  }

  surface.addEventListener('contextmenu', (e) => e.preventDefault(), { signal });

  surface.addEventListener('pointerdown', (e) => {
    if (session || hintPointer !== null || !e.isPrimary || (e.button !== 0 && e.button !== 2)) return;
    const target = e.target as Element;
    const el = target.closest<HTMLElement>('.card');
    const state = host.state();
    const id = el?.dataset.id;
    // A card, or an empty pile
    const from = id ? pileOf(state, id) : target.closest<HTMLElement>('.slot')?.dataset.pile;
    if (!from) return;

    // Tapping the stock draws (or turns the waste back over), on press so quick taps keep up.
    const tap = e.button === 0 ? variant.tap(state, from) : null;
    if (tap) {
      e.preventDefault();
      host.commit(tap);
      return;
    }
    if (!el || !id) return;
    const pile = state.piles[from]!;
    const ids = pile.slice(pile.indexOf(id));

    e.preventDefault();

    // Right button only hints, until released.
    if (e.button === 2) {
      surface.setPointerCapture(e.pointerId);
      renderer.hint(variant.hintSource(state, id));
      hintPointer = e.pointerId;
      return;
    }

    renderer.hint(variant.hintTarget(state, id));

    if (!variant.canPickUp(state, from, ids.length)) {
      surface.setPointerCapture(e.pointerId);
      renderer.nope(id);
      hintPointer = e.pointerId;
      return;
    }
    // The grabbed card holds capture, so the cursor comes from `.card.dragging`. Setting it on the board instead
    // restyles every card, which repaints the whole table (docs/plans/mobile-animation-jank). Events still bubble here.
    el.setPointerCapture(e.pointerId);
    session = {
      pointerId: e.pointerId,
      from,
      ids,
      startX: e.clientX,
      startY: e.clientY,
      lift: e.pointerType === 'touch' ? -renderer.layout.cardH * 0.25 : 0,
      liftStart: performance.now(),
      dx: 0,
      dy: 0,
      target: null,
    };
    // Lift right away on press, not on the first move.
    renderer.beginDrag(ids);
    host.pickUp(ids);
    frame = requestAnimationFrame(update);
  }, { signal });

  surface.addEventListener('pointermove', (e) => {
    const s = session;
    if (!s || e.pointerId !== s.pointerId) return;
    s.dx = e.clientX - s.startX;
    s.dy = e.clientY - s.startY;
    if (!frame) frame = requestAnimationFrame(update);
  }, { signal });

  function releaseHint(e: PointerEvent): boolean {
    if (e.pointerId !== hintPointer) return false;
    hintPointer = null;
    renderer.hint(null);
    return true;
  }

  surface.addEventListener('pointerup', (e) => {
    if (releaseHint(e)) return;
    if (session && e.pointerId === session.pointerId) {
      // Make sure the drop uses the final pointer position.
      update();
      finish(true);
    }
  }, { signal });

  surface.addEventListener('pointercancel', (e) => {
    if (releaseHint(e)) return;
    if (session && e.pointerId === session.pointerId) finish(false);
  }, { signal });

  return () => {
    if (frame) cancelAnimationFrame(frame);
    listening.abort();
  };
}

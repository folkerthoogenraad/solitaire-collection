import { pileKind, type GameState, type Move, type PileId } from '../core/state';
import type { Variant } from '../core/variant';
import type { Rect } from './layout';
import type { Renderer } from './renderer';

export interface DragHost {
  variant: Variant;
  renderer: Renderer;
  state(): GameState;
  /** Applies the move if legal and re-renders. Returns whether it was applied. */
  commit(move: Move): boolean;
  /** Re-render the current state, raising `ids` while they travel back. */
  restore(ids: readonly string[]): void;
}

interface Session {
  pointerId: number;
  from: PileId;
  ids: string[];
  startX: number;
  startY: number;
  /** Extra vertical offset on touch so the finger doesn't cover the cards. */
  lift: number;
  active: boolean;
  dx: number;
  dy: number;
  target: PileId | null;
}

const DRAG_THRESHOLD = 4;

function overlap(a: Rect, b: Rect): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

function pileOf(state: GameState, id: string): PileId | undefined {
  return Object.keys(state.piles).find((p) => state.piles[p]!.includes(id));
}

/** Card of the same suit as `id`, `offset` ranks away, wherever it is buried. */
function sameSuitCard(variant: Variant, state: GameState, id: string, offset: number, tableauOnly: boolean): string | null {
  const ref = variant.card(id);
  for (const pile of variant.piles()) {
    if (tableauOnly && pileKind(pile) !== 'tableau') continue;
    const match = state.piles[pile]!.find((other) => {
      const c = variant.card(other);
      return c.suit === ref.suit && c.rank === ref.rank + offset;
    });
    if (match) return match;
  }
  return null;
}

/** Left button: the tableau card the held card goes on. */
const placementTarget = (variant: Variant, state: GameState, id: string) => sameSuitCard(variant, state, id, 1, true);
/** Right button: the card that goes on the held card. */
const placementSource = (variant: Variant, state: GameState, id: string) => sameSuitCard(variant, state, id, -1, false);

/** Pointer-event drag & drop for mouse, touch and pen through one code path. */
export function attachDrag(surface: HTMLElement, host: DragHost): void {
  const { renderer, variant } = host;
  let session: Session | null = null;
  let frame = 0;
  /** Pointer that only shows a hint until released: a right-button hold, or a card that can't be picked up. */
  let hintPointer: number | null = null;

  /** Legal pile with the largest overlap with the dragged card. */
  function findTarget(s: Session): PileId | null {
    const state = host.state();
    const lead = renderer.positionOf(s.ids[0]!);
    const scale = lead.scale * 1.04;
    const dragged: Rect = {
      x: lead.x + s.dx,
      y: lead.y + s.dy + s.lift,
      w: renderer.layout.cardW * scale,
      h: renderer.layout.cardH * scale,
    };
    let best: PileId | null = null;
    let bestArea = 0;
    for (const pile of variant.piles()) {
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
    if (!session?.active) return;
    renderer.dragTo(session.ids, session.dx, session.dy + session.lift);
    session.target = findTarget(session);
    renderer.highlight(session.target ? renderer.topRect(host.state(), session.target) : null);
  }

  function finish(drop: boolean) {
    const s = session;
    session = null;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    renderer.hint(null);
    if (!s?.active) return;

    renderer.highlight(null);
    renderer.endDrag(s.ids);
    const moved = drop && s.target && host.commit({ from: s.from, to: s.target, count: s.ids.length });
    if (!moved) host.restore(s.ids);
  }

  surface.addEventListener('contextmenu', (e) => e.preventDefault());

  surface.addEventListener('pointerdown', (e) => {
    if (session || hintPointer !== null || !e.isPrimary || (e.button !== 0 && e.button !== 2)) return;
    const el = (e.target as Element).closest<HTMLElement>('.card');
    if (!el) return;

    const id = el.dataset.id!;
    const state = host.state();
    const from = pileOf(state, id);
    if (!from) return;
    const pile = state.piles[from]!;
    const ids = pile.slice(pile.indexOf(id));

    e.preventDefault();
    surface.setPointerCapture(e.pointerId);

    // Right button only hints, until released.
    if (e.button === 2) {
      renderer.hint(placementSource(variant, state, id));
      hintPointer = e.pointerId;
      return;
    }

    renderer.hint(placementTarget(variant, state, id));

    if (!variant.canPickUp(state, from, ids.length)) {
      renderer.nope(id);
      hintPointer = e.pointerId;
      return;
    }
    session = {
      pointerId: e.pointerId,
      from,
      ids,
      startX: e.clientX,
      startY: e.clientY,
      lift: e.pointerType === 'touch' ? -renderer.layout.cardH * 0.25 : 0,
      active: false,
      dx: 0,
      dy: 0,
      target: null,
    };
  });

  surface.addEventListener('pointermove', (e) => {
    const s = session;
    if (!s || e.pointerId !== s.pointerId) return;
    s.dx = e.clientX - s.startX;
    s.dy = e.clientY - s.startY;
    if (!s.active) {
      if (Math.hypot(s.dx, s.dy) < DRAG_THRESHOLD) return;
      s.active = true;
      renderer.beginDrag(s.ids);
    }
    if (!frame) frame = requestAnimationFrame(update);
  });

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
      if (session.active) update();
      finish(true);
    }
  });

  surface.addEventListener('pointercancel', (e) => {
    if (releaseHint(e)) return;
    if (session && e.pointerId === session.pointerId) finish(false);
  });
}

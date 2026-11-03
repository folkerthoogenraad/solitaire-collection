import type { Variant } from '../core/variant';
import { createWinCount, type WinCount } from './controls';
import type { SkinUi } from './skin/faces';

export interface SelectorHost {
  variants: readonly Variant[];
  ui: SkinUi;
  /** Current win count of a variant, read each time the selector opens. */
  wins(variant: Variant): number;
  /** A different variant was picked. Called while the selector still covers the board, so the swap isn't seen. */
  choose(variant: Variant): void;
  /** The selector is gone again. */
  closed?(): void;
}

export interface Selector {
  el: HTMLElement;
  /** `reduced`: fade instead of the circle. */
  open(current: Variant, reduced: boolean): void;
}

/** How long the circle takes to grow or shrink; also written to `--selector-ms` for the CSS. */
const CIRCLE_MS = 550;
const FADE_MS = 150;

/**
 * Full-screen variant picker over the board: one big button per variant with its emblem and win count. Opens with a
 * circle growing from the centre of the screen; Escape, a tap beside the buttons or the current variant closes it.
 * It's a sibling of the board, and opening it changes nothing on the board (docs/plans/mobile-animation-jank).
 */
export function createSelector(host: SelectorHost): Selector {
  const el = document.createElement('div');
  el.className = 'selector';
  el.hidden = true;
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', 'Choose a game');
  el.style.setProperty('--selector-ms', `${CIRCLE_MS}ms`);

  const list = document.createElement('div');
  list.className = 'sel-list';
  const buttons = new Map<Variant, { btn: HTMLButtonElement; wins: WinCount }>();
  for (const variant of host.variants) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sel-variant';
    const emblem = host.ui.glyph('emblem', `emblem/${variant.id}`, variant.name);
    const wins = createWinCount(host.ui);
    btn.append(emblem, wins.el);
    btn.addEventListener('click', () => choose(variant));
    buttons.set(variant, { btn, wins });
    list.append(btn);
  }
  const reveal = document.createElement('div');
  reveal.className = 'sel-reveal';
  reveal.append(list);
  el.append(reveal);

  let current: Variant | null = null;
  let closing = 0;
  let shown = 0;

  /** Large enough to cover the screen from its centre. */
  function fit() {
    el.style.setProperty('--r', `${Math.hypot(innerWidth, innerHeight) / 2 + 2}px`);
  }

  function choose(variant: Variant) {
    if (!current) return;
    if (variant !== current) host.choose(variant);
    current = null;
    clearTimeout(shown);
    // Clip back on at full size, then shrink it.
    el.classList.remove('shown');
    void el.offsetWidth;
    el.classList.remove('open');
    removeEventListener('keydown', onKey);
    removeEventListener('resize', fit);
    closing = window.setTimeout(() => {
      el.hidden = true;
      host.closed?.();
    }, el.dataset.motion === 'reduced' ? FADE_MS : CIRCLE_MS);
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape' && current) choose(current);
  }

  // Beside the buttons: close without switching. Not while the circle grows, when a tap meant for a button can miss.
  el.addEventListener('click', (e) => {
    if (current && el.classList.contains('shown') && !(e.target as Element).closest('.sel-variant')) choose(current);
  });

  return {
    el,
    open(variant, reduced) {
      clearTimeout(closing);
      current = variant;
      for (const [v, { btn, wins }] of buttons) {
        const count = host.wins(v);
        wins.set(count);
        btn.classList.toggle('current', v === variant);
        btn.setAttribute('aria-label', `${v.name}, ${count} ${count === 1 ? 'win' : 'wins'}`);
        btn.setAttribute('aria-current', String(v === variant));
      }
      el.dataset.motion = reduced ? 'reduced' : 'full';
      fit();
      el.hidden = false;
      void el.offsetWidth;
      el.classList.add('open');
      shown = window.setTimeout(() => el.classList.add('shown'), CIRCLE_MS);
      addEventListener('keydown', onKey);
      addEventListener('resize', fit);
      buttons.get(variant)?.btn.focus({ preventScroll: true });
    },
  };
}

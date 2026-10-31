import type { Rect } from './layout';
import type { SkinUi } from './skin/faces';

export interface CascadeButton {
  el: HTMLElement;
  readonly shown: boolean;
  /** Offer a cascade onto the pile at `anchor` for a few seconds; `bounds` is the width it must stay inside. */
  show(anchor: Rect, bounds: number): void;
  hide(): void;
}

const OFFER_MS = 4000;
const EDGE = 4;

/** Short-lived "Autocascade" button over the pile a card was just played on, labelled with the skin's `ui/autocascade`. */
export function createCascadeButton(ui: SkinUi, onCascade: () => void): CascadeButton {
  const el = document.createElement('button');
  el.className = 'btn cascade';
  el.type = 'button';
  el.setAttribute('aria-label', 'Autocascade');
  el.append(ui.glyph('label', 'autocascade', 'Autocascade'));

  let timer = 0;
  const hide = () => {
    clearTimeout(timer);
    timer = 0;
    el.classList.remove('show');
  };

  el.addEventListener('click', () => {
    if (!timer) return;
    hide();
    onCascade();
  });

  return {
    el,
    get shown() {
      return timer !== 0;
    },
    show(anchor, bounds) {
      clearTimeout(timer);
      // Centred under the card's lower part, kept on screen at the edges.
      const half = el.offsetWidth / 2;
      const x = Math.min(Math.max(anchor.x + anchor.w / 2, half + EDGE), bounds - half - EDGE);
      el.style.left = `${x}px`;
      el.style.top = `${anchor.y + anchor.h * 0.8}px`;
      el.classList.add('show');
      timer = window.setTimeout(hide, OFFER_MS);
    },
    hide,
  };
}

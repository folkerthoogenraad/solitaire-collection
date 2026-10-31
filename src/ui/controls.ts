import type { SkinUi } from './skin/faces';
import type { Digit } from './skin/resolve';

export interface Controls {
  el: HTMLElement;
  setWins(wins: number): void;
}

export interface WinCount {
  el: HTMLElement;
  set(wins: number): void;
}

/** "Wins" and the count, from the skin's `ui/wins` and corner index digits where it has them. */
export function createWinCount(ui: SkinUi): WinCount {
  const el = document.createElement('div');
  el.className = 'wins';
  const count = document.createElement('span');
  count.className = 'count';
  el.append(ui.glyph('label', 'wins', 'Wins'), count);
  return {
    el,
    set(wins) {
      count.replaceChildren(...[...String(wins)].map((d) => ui.glyph('digit', d as Digit, d)));
      el.setAttribute('aria-label', `Wins: ${wins}`);
    },
  };
}

/** A New deal button, labelled with the skin's `ui/new-deal`. */
export function createNewDealButton(ui: SkinUi, onNewDeal: () => void): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.className = 'btn deal';
  btn.type = 'button';
  btn.setAttribute('aria-label', 'New deal');
  btn.append(ui.glyph('label', 'new-deal', 'New deal'));
  btn.addEventListener('click', onNewDeal);
  return btn;
}

/** Win counter above the New deal button, the two as wide as the wider one. */
export function createControls(ui: SkinUi, onNewDeal: () => void): Controls {
  const el = document.createElement('div');
  el.className = 'controls';
  const wins = createWinCount(ui);
  el.append(wins.el, createNewDealButton(ui, onNewDeal));
  return { el, setWins: wins.set };
}

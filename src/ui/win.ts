import { createNewDealButton, createWinCount } from './controls';
import type { SkinUi } from './skin/faces';

export interface WinOverlay {
  el: HTMLElement;
  show(wins: number): void;
  hide(): void;
}

export function createWinOverlay(ui: SkinUi, onNewDeal: () => void): WinOverlay {
  const el = document.createElement('div');
  el.className = 'win';
  const panel = document.createElement('div');
  panel.className = 'panel';
  const title = document.createElement('h2');
  title.setAttribute('aria-label', 'You won!');
  title.append(ui.glyph('label', 'victory', 'You won!'));
  const count = createWinCount(ui);
  panel.append(title, count.el, createNewDealButton(ui, onNewDeal));
  el.append(panel);

  return {
    el,
    show(wins) {
      count.set(wins);
      el.classList.add('show');
    },
    hide() {
      el.classList.remove('show');
    },
  };
}

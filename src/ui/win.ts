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
  el.innerHTML = `
    <div class="panel">
      <h2>You won!</h2>
    </div>`;
  const count = createWinCount(ui);
  el.querySelector('.panel')!.append(count.el, createNewDealButton(ui, onNewDeal));

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

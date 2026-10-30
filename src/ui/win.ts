export interface WinOverlay {
  el: HTMLElement;
  show(wins: number): void;
  hide(): void;
}

export function createWinOverlay(onNewDeal: () => void): WinOverlay {
  const el = document.createElement('div');
  el.className = 'win';
  el.innerHTML = `
    <div class="panel">
      <h2>You won!</h2>
      <p>Wins: <b>0</b></p>
      <button class="btn" type="button">New deal</button>
    </div>`;
  const count = el.querySelector('b')!;
  el.querySelector('button')!.addEventListener('click', onNewDeal);

  return {
    el,
    show(wins) {
      count.textContent = String(wins);
      el.classList.add('show');
    },
    hide() {
      el.classList.remove('show');
    },
  };
}

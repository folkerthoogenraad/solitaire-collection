export interface Controls {
  el: HTMLElement;
  setWins(wins: number): void;
}

const CONFIRM_MS = 3000;

/** Win counter and New deal button. Abandoning a game in progress needs a second tap. */
export function createControls(onNewDeal: () => void, needsConfirm: () => boolean): Controls {
  const el = document.createElement('div');
  el.className = 'controls';
  el.innerHTML = `<span class="wins">Wins <b>0</b></span><button class="btn" type="button">New deal</button>`;
  const count = el.querySelector('b')!;
  const btn = el.querySelector('button')!;

  let armed = 0;
  const disarm = () => {
    clearTimeout(armed);
    armed = 0;
    btn.textContent = 'New deal';
    btn.classList.remove('armed');
  };

  btn.addEventListener('click', () => {
    if (!armed && needsConfirm()) {
      btn.textContent = 'Sure?';
      btn.classList.add('armed');
      armed = window.setTimeout(disarm, CONFIRM_MS);
      return;
    }
    disarm();
    onNewDeal();
  });

  return {
    el,
    setWins(wins) {
      count.textContent = String(wins);
    },
  };
}

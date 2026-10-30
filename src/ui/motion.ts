import type { Motion } from '../persistence/settings';

/** Sets `data-motion` on the board to `full` or `reduced`; `system` tracks the OS setting live. */
export function applyMotion(board: HTMLElement, motion: Motion): void {
  if (motion !== 'system') {
    board.dataset.motion = motion;
    return;
  }
  const query = matchMedia('(prefers-reduced-motion: reduce)');
  const update = () => (board.dataset.motion = query.matches ? 'reduced' : 'full');
  update();
  query.addEventListener('change', update);
}

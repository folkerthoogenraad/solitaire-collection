/** Two taps closer together than this are a double tap to Safari. */
const DOUBLE_TAP_MS = 350;

/** Elements that need the click a touch synthesizes, so their touchstart can't be cancelled. */
const CLICKABLE = 'button, a, input, select, textarea, label';

/**
 * Keep the page at 100%. iPad Safari doesn't fully honour `touch-action: none`: a long press followed by another tap,
 * or a second finger, can still zoom, and that same rule then blocks the pinch that would zoom back out. So cancel
 * the touches Safari builds its zoom gestures from, and if the page ends up zoomed anyway, snap it back and lift the
 * lock until it's at 100% again.
 */
export function preventZoom(): void {
  const vv = window.visualViewport;
  const zoomed = () => !!vv && vv.scale > 1.01;

  // A cancelled touchstart starts no native gesture (zoom, double tap, callout) for that touch. The pointer events
  // drags run on are dispatched before it and still arrive. Buttons are left alone so they still get their click,
  // unless it's a second finger.
  document.addEventListener(
    'touchstart',
    (e) => {
      if (zoomed() || !e.cancelable) return;
      if (e.touches.length > 1 || !(e.target as Element).closest?.(CLICKABLE)) e.preventDefault();
    },
    { passive: false },
  );

  // Over buttons, cancel the second tap of a double tap. That also drops its click, which is fine for a double tap.
  // A cancelled touch counts as a tap too: Safari still times the next tap from it.
  let lastTap = -Infinity;
  const onTapEnd = (e: TouchEvent) => {
    if (e.timeStamp - lastTap < DOUBLE_TAP_MS && e.cancelable && !zoomed()) e.preventDefault();
    lastTap = e.timeStamp;
  };
  document.addEventListener('touchend', onTapEnd, { passive: false });
  document.addEventListener('touchcancel', onTapEnd, { passive: false });

  // Safari's own pinch events.
  for (const type of ['gesturestart', 'gesturechange']) {
    document.addEventListener(type, (e) => !zoomed() && e.preventDefault(), { passive: false });
  }

  // Safari re-fits the page when the viewport meta changes, and a maximum scale of 1 fits it at 100%. If that doesn't
  // take, `.zoomed` lets a pinch through (see app.css) so the player can zoom out by hand.
  const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  if (!vv || !meta) return;
  const content = meta.content;
  const root = document.documentElement;
  vv.addEventListener('resize', () => {
    const z = zoomed();
    root.classList.toggle('zoomed', z);
    if (!z) return;
    meta.content = `${content}, maximum-scale=1`;
    requestAnimationFrame(() => requestAnimationFrame(() => (meta.content = content)));
  });
}

// A/B test on the phone without touching it: per variant, reload the game, apply the variant, simulate a touch
// hold + release in place on a top card, trace it, and print the summary.
// Usage: node tools/android-perf/ab.mjs <variant>... [--runs N]
//   base          the game as it is
//   -<text>       delete every CSS rule whose selector contains <text>, e.g. -grabbing or -::before
//   js:<expr>     evaluate <expr> in the page first, e.g. "js:document.body.classList.add('x')"
import { connect, sleep, summarize } from './cdp.mjs';

const args = process.argv.slice(2);
const runsAt = args.indexOf('--runs');
const runs = runsAt >= 0 ? Number(args.splice(runsAt, 2)[1]) : 1;
const variants = args.length ? args : ['base'];

const setup = (variant) => {
  if (variant === 'base') return '0';
  if (variant.startsWith('js:')) return variant.slice(3);
  if (variant.startsWith('-')) {
    return `(() => { let n = 0;
      for (const sheet of document.styleSheets) { let rules; try { rules = sheet.cssRules } catch { continue }
        for (let i = rules.length - 1; i >= 0; i--) if (rules[i].selectorText?.includes(${JSON.stringify(variant.slice(1))})) { sheet.deleteRule(i); n++ } }
      return n + ' rules deleted'; })()`;
  }
  throw new Error(`Unknown variant ${variant}`);
};

// A top card: its bottom strip isn't covered by another card, so it can be picked up.
const PICK = `(() => {
  for (const el of document.querySelectorAll('.card')) {
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.bottom - r.height * 0.15;
    if (y < 0 || y > innerHeight - 4) continue;
    if (document.elementFromPoint(x, y)?.closest('.card') === el) return { id: el.dataset.id, x, y };
  }
})()`;

const phone = await connect();
console.log(`Tab: ${phone.tab.url}\n`);
for (let run = 1; run <= runs; run++) {
  for (const variant of variants) {
    await phone.send('Page.reload');
    await sleep(3000);
    const applied = await phone.evaluate(setup(variant));
    await sleep(500);
    const card = await phone.evaluate(PICK);
    if (!card) throw new Error('No top card found');

    const stop = await phone.startTrace(`ab-${variant.replace(/\W+/g, '_')}-${run}`);
    await sleep(400);
    await phone.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: card.x, y: card.y, id: 1 }] });
    await sleep(700);
    await phone.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await sleep(1500);
    const { trace } = await stop();

    console.log(`${variant} #${run} (${applied}, card ${card.id}):`, JSON.stringify(summarize(trace)));
  }
}
phone.close();

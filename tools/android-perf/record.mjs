// Records a trace of the Solitaire tab on the phone while you do a gesture by hand.
// Usage: node tools/android-perf/record.mjs <name> [--paint]   → traces/<name>.json, open it in the DevTools Performance panel.
// --paint adds paint snapshots (layer and paint profiler views), but inflates main-thread times several times over.
import { createInterface } from 'node:readline';
import { CATEGORIES, connect, summarize } from './cdp.mjs';

const name = process.argv[2] ?? 'trace';
const paint = process.argv.includes('--paint');

const phone = await connect();
console.log(`Tab: ${phone.tab.url}`);
const stop = await phone.startTrace(name, paint
  ? [...CATEGORIES, 'disabled-by-default-devtools.timeline.picture', 'disabled-by-default-devtools.timeline.layers', 'disabled-by-default-devtools.screenshot']
  : CATEGORIES);
console.log('\n● RECORDING: do the gesture on the phone, then press Enter here to stop.');

const rl = createInterface({ input: process.stdin });
await new Promise((res) => rl.once('line', res));
rl.close();

const { file, trace } = await stop();
phone.close();
console.log(`Saved ${file}`);
console.log(summarize(trace));

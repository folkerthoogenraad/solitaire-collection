// Minimal Chrome DevTools Protocol client for the Solitaire tab in Chrome on an Android phone.
// Needs: adb forward tcp:9222 localabstract:chrome_devtools_remote
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const traces = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'traces');
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Roughly what the DevTools Performance panel records, minus the costly paint snapshots (see record.mjs --paint). */
export const CATEGORIES = [
  '-*',
  'devtools.timeline',
  'disabled-by-default-devtools.timeline',
  'disabled-by-default-devtools.timeline.frame',
  'disabled-by-default-devtools.timeline.stack',
  'disabled-by-default-v8.cpu_profiler',
  'v8.execute',
  'blink.user_timing',
  'latencyInfo',
  'loading',
  'toplevel',
  'input',
  'cc',
  'gpu',
  'viz',
  'benchmark',
];

export async function connect() {
  // /json/list on Android leaves some tabs out, so find the tab through the browser target instead.
  const ws = new WebSocket('ws://localhost:9222/devtools/browser');
  await new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = () => rej(new Error('No phone browser on :9222. Run: adb forward tcp:9222 localabstract:chrome_devtools_remote'));
  });

  let nextId = 1;
  let sessionId;
  const pending = new Map();
  const listeners = new Map();
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) {
      const { res, rej } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? rej(new Error(msg.error.message)) : res(msg.result);
    } else if (msg.method && listeners.has(msg.method)) {
      listeners.get(msg.method)(msg.params);
    }
  };
  const send = (method, params = {}) =>
    new Promise((res, rej) => {
      const id = nextId++;
      pending.set(id, { res, rej });
      ws.send(JSON.stringify({ id, method, params, ...(sessionId && { sessionId }) }));
    });

  const { targetInfos } = await send('Target.getTargets');
  const tab = targetInfos.find((t) => t.type === 'page' && t.title === 'Solitaire');
  if (!tab) throw new Error('No "Solitaire" tab on the phone. Open the game in Chrome there first.');
  ({ sessionId } = await send('Target.attachToTarget', { targetId: tab.targetId, flatten: true }));

  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  };

  /** Starts tracing; the returned function stops it and writes traces/<name>.json. */
  const startTrace = async (name, categories = CATEGORIES) => {
    await send('Tracing.start', {
      transferMode: 'ReturnAsStream',
      traceConfig: { recordMode: 'recordUntilFull', includedCategories: categories },
    });
    return async () => {
      const done = new Promise((r) => listeners.set('Tracing.tracingComplete', r));
      await send('Tracing.end');
      const { stream } = await done;
      let data = '';
      for (;;) {
        const chunk = await send('IO.read', { handle: stream, size: 1 << 20 });
        data += chunk.base64Encoded ? Buffer.from(chunk.data, 'base64').toString() : chunk.data;
        if (chunk.eof) break;
      }
      await send('IO.close', { handle: stream });
      mkdirSync(traces, { recursive: true });
      const file = join(traces, `${name}.json`);
      writeFileSync(file, data);
      return { file, trace: JSON.parse(data) };
    };
  };

  return { tab, send, evaluate, startTrace, close: () => ws.close() };
}

/** The numbers that mattered for the jank: main-thread stalls, GPU raster and dropped frames. */
export function summarize(trace) {
  const ev = trace.traceEvents ?? trace;
  const threads = {};
  for (const e of ev) if (e.ph === 'M' && e.name === 'thread_name') threads[`${e.pid}:${e.tid}`] = e.args.name;
  const thread = (e) => threads[`${e.pid}:${e.tid}`];
  const longMain = ev
    .filter((e) => e.ph === 'X' && e.name === 'ThreadControllerImpl::RunTask' && thread(e) === 'CrRendererMain' && e.dur > 16000)
    .map((e) => Math.round(e.dur / 1000));
  const frames = {};
  for (const e of ev) {
    if (e.name !== 'PipelineReporter' || e.ph !== 'b' || !e.args.frame_reporter.affects_smoothness) continue;
    const state = e.args.frame_reporter.state.replace('STATE_', '').toLowerCase();
    frames[state] = (frames[state] ?? 0) + 1;
  }
  return {
    longestMainMs: Math.max(0, ...longMain),
    mainTasksOver16ms: longMain.length,
    rasterTiles: ev.filter((e) => e.ph === 'X' && e.name === 'RasterDecoderImpl::DoEndRasterCHROMIUM').length,
    gpuRasterMs: Math.round(ev.filter((e) => e.ph === 'X' && e.name === 'RendererRasterWorker').reduce((s, e) => s + e.dur, 0) / 1000),
    frames,
  };
}

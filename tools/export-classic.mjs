// Renders tools/export-classic.html in a headless Chromium browser and writes the PNGs it produces
// into skins/classic (index, pips, center) and skins/_templates. skin.json is left alone.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const skins = join(root, 'skins');

const browser = [
  process.env.CHROME_PATH,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].find((p) => p && existsSync(p));
if (!browser) throw new Error('No Chrome or Edge found; set CHROME_PATH');

// A separate profile, so a running browser doesn't take over the headless one.
const profile = mkdtempSync(join(tmpdir(), 'skin-export-'));
let html;
try {
  html = execFileSync(
    browser,
    [
      '--headless=new',
      '--disable-gpu',
      `--user-data-dir=${profile}`,
      '--virtual-time-budget=10000',
      '--dump-dom',
      pathToFileURL(join(root, 'tools', 'export-classic.html')).href,
    ],
    { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 },
  );
} finally {
  rmSync(profile, { recursive: true, force: true });
}

const match = /<pre id="out">([\s\S]*?)<\/pre>/.exec(html);
if (!match) throw new Error('Export page produced no output');
const json = match[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const { files, warnings } = JSON.parse(json);

for (const dir of ['classic/index', 'classic/pips', 'classic/center', '_templates']) {
  rmSync(join(skins, dir), { recursive: true, force: true });
}
for (const [path, dataUrl] of Object.entries(files)) {
  const target = join(skins, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, Buffer.from(dataUrl.split(',')[1], 'base64'));
}
for (const w of warnings) console.warn(`warning: ${w}`);
console.log(`Wrote ${Object.keys(files).length} files to skins/`);

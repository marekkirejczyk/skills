// Renders slide files to 1920×1080 PNGs for a quick visual check (not the real deck runtime:
// <x-connector> arrows are not drawn and table padding differs slightly).
// Usage: node preview.mjs <slides-dir> <out-dir> <id> [id…]
// Needs playwright-core (npm i playwright-core in a scratch dir) and a Chromium:
// set CHROME=/path/to/chrome, otherwise the newest one in the Playwright cache is used.
import { chromium } from 'playwright-core';
import { readFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir, platform } from 'node:os';

const [, , slidesDir, outDir, ...ids] = process.argv;
if (!slidesDir || !outDir || !ids.length) {
  console.error('usage: node preview.mjs <slides-dir> <out-dir> <id> [id…]');
  process.exit(2);
}

function findChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const cache = platform() === 'darwin' ? join(homedir(), 'Library/Caches/ms-playwright')
    : platform() === 'win32' ? join(process.env.LOCALAPPDATA ?? '', 'ms-playwright')
      : join(homedir(), '.cache/ms-playwright');
  const dirs = existsSync(cache) ? readdirSync(cache).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse() : [];
  const rel = [
    'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
    'chrome-mac/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
    'chrome-linux/chrome', 'chrome-linux64/chrome', 'chrome-win/chrome.exe', 'chrome-win64/chrome.exe',
  ];
  for (const d of dirs) for (const r of rel) if (existsSync(join(cache, d, r))) return join(cache, d, r);
  return undefined; // let playwright try its default
}

mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ executablePath: findChrome() });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
for (const id of ids) {
  const sec = readFileSync(join(slidesDir, `${id}.html`), 'utf8').replace(/<aside>[\s\S]*?<\/aside>/, '');
  await page.setContent(`<!doctype html><html><head><link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet"><style>*{box-sizing:border-box;margin:0}section{width:1920px;height:1080px;position:relative;overflow:hidden}td,th{padding:8px 12px}</style></head><body>${sec}</body></html>`, { waitUntil: 'load' });
  await page.waitForTimeout(800);
  // Report the lowest text and any element that sticks out of the canvas.
  const r = await page.evaluate(() => {
    const els = [...document.querySelectorAll('section *')];
    const bottom = Math.max(0, ...els.map((e) => e.getBoundingClientRect().bottom));
    const right = Math.max(0, ...els.map((e) => e.getBoundingClientRect().right));
    const clipped = els.filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflow === 'hidden').length;
    return { bottom: Math.round(bottom), right: Math.round(right), clipped };
  });
  const warn = r.bottom > 1080 || r.right > 1920 || r.clipped ? '  <-- check' : '';
  console.log(`${id}: bottom ${r.bottom}, right ${r.right}, clipped panels ${r.clipped}${warn}`);
  await page.screenshot({ path: join(outDir, `${id}.png`) });
}
await browser.close();

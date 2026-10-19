// Takes app screenshots for the deck from a running local app (demo data only).
// Usage: node shoot.mjs <base-url> <out-dir> <shots.json>
// shots.json: [{ "name": "board", "path": "/" },
//              { "name": "m-board", "path": "/", "phone": true },
//              { "name": "history", "path": "/t/123", "click": "History" }]
// Chromium lookup as in preview.mjs (CHROME env var or the Playwright cache).
import { chromium } from 'playwright-core';
import { readFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir, platform } from 'node:os';

const [, , base, outDir, listPath] = process.argv;
if (!base || !outDir || !listPath) {
  console.error('usage: node shoot.mjs <base-url> <out-dir> <shots.json>');
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
  return undefined;
}

mkdirSync(outDir, { recursive: true });
const shots = JSON.parse(readFileSync(listPath, 'utf8'));
const browser = await chromium.launch({ executablePath: findChrome() });
for (const s of shots) {
  const ctx = await browser.newContext(s.phone
    ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
    : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(new URL(s.path, base).href, { waitUntil: 'load' });
  await page.waitForTimeout(s.wait ?? 2500);
  if (s.click) { await page.getByText(s.click, { exact: false }).first().click(); await page.waitForTimeout(600); }
  await page.screenshot({ path: join(outDir, `${s.name}.png`) });
  await ctx.close();
  console.log('ok', s.name);
}
await browser.close();

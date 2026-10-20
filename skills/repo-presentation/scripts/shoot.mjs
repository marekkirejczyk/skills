// Takes screenshots for the deck from the app running locally from the branch being presented.
// Usage: node shoot.mjs <base-url> <out-dir> <shots.json> [repo-dir]
// shots.json: [{ "name": "board", "path": "/" },
//              { "name": "m-board", "path": "/", "phone": true },
//              { "name": "history", "path": "/t/123", "click": "History" },
//              { "name": "new-rule", "path": "/settings", "steps": [
//                  { "click": "Add rule" }, { "fill": ["input[name=from]", "school@example.org"] },
//                  { "press": "Enter" }, { "waitFor": "Rule saved" } ], "fullPage": false }]
// steps run in order: click (visible text), fill [selector, text], press (key), goto (path),
// wait (ms), waitFor (visible text). "selector" screenshots one element instead of the viewport.
// With repo-dir, writes <out-dir>/manifest.json: the commit, branch and dirty state of that
// checkout, so every slide can say which code it shows. A shot whose page fails is reported.
// Chromium lookup as in preview.mjs (CHROME env var or the Playwright cache).
import { chromium } from 'playwright-core';
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { homedir, platform } from 'node:os';

const [, , base, outDir, listPath, repoDir] = process.argv;
if (!base || !outDir || !listPath) {
  console.error('usage: node shoot.mjs <base-url> <out-dir> <shots.json> [repo-dir]');
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
const done = [];
let failed = 0;
for (const s of shots) {
  const ctx = await browser.newContext(s.phone
    ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
    : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    const res = await page.goto(new URL(s.path, base).href, { waitUntil: 'load' });
    if (res && res.status() >= 400) errors.push(`HTTP ${res.status()}`);
    await page.waitForTimeout(s.wait ?? 2500);
    if (s.click) { await page.getByText(s.click, { exact: false }).first().click(); await page.waitForTimeout(600); }
    for (const st of s.steps ?? []) {
      if (st.click) await page.getByText(st.click, { exact: false }).first().click();
      else if (st.fill) await page.locator(st.fill[0]).first().fill(st.fill[1]);
      else if (st.press) await page.keyboard.press(st.press);
      else if (st.goto) await page.goto(new URL(st.goto, base).href, { waitUntil: 'load' });
      else if (st.waitFor) await page.getByText(st.waitFor, { exact: false }).first().waitFor({ timeout: 15000 });
      if (st.wait) await page.waitForTimeout(st.wait); else await page.waitForTimeout(500);
    }
    const target = s.selector ? page.locator(s.selector).first() : page;
    await target.screenshot({ path: join(outDir, `${s.name}.png`), ...(s.selector ? {} : { fullPage: !!s.fullPage }) });
    done.push({ name: s.name, url: page.url(), errors });
    console.log(errors.length ? 'warn' : 'ok', s.name, errors.join('; '));
  } catch (e) {
    failed++;
    console.error('FAIL', s.name, e.message.split('\n')[0]);
  }
  await ctx.close();
}
await browser.close();
if (repoDir) {
  const git = (...a) => execFileSync('git', ['-C', repoDir, ...a], { encoding: 'utf8' }).trim();
  const manifest = { base, commit: git('rev-parse', 'HEAD'), branch: git('rev-parse', '--abbrev-ref', 'HEAD'),
    dirty: git('status', '--porcelain', '--untracked-files=no') !== '', at: new Date().toISOString(), shots: done };
  writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`manifest: ${manifest.commit.slice(0, 7)} on ${manifest.branch}${manifest.dirty ? ' (uncommitted changes)' : ''}`);
}
if (failed) process.exit(1);

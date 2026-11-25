// Runs the script end to end on the fixtures, the same way CI does.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../scripts/eval-report.mjs', import.meta.url));
const fixtures = fileURLToPath(new URL('../fixtures/results.json', import.meta.url));
const run = (...args) => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });

test('builds the HTML report and the summaries from the fixtures', () => {
  const dir = mkdtempSync(join(tmpdir(), 'eval-report-cli-'));
  const result = run(fixtures, '--out', join(dir, 'r.html'), '--summary', join(dir, 's.md'), '--headline', join(dir, 'h.md'), '--report-url', 'https://x/');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^26\/36 rounds passed, 10\/20 cases/);
  const html = readFileSync(join(dir, 'r.html'), 'utf8');
  assert.equal((html.match(/<details class="file"/g) || []).length, 3);
  assert.equal((html.match(/<tbody class="case"/g) || []).length, 20);
  assert.doesNotMatch(html, /class="code-link muted">[^<]*\.ts</, 'every fixture case is found in its source file');
  assert.match(readFileSync(join(dir, 's.md'), 'utf8'), /open the full report →\]\(https:\/\/x\/\)/);
  assert.match(readFileSync(join(dir, 'h.md'), 'utf8'), /^🔴 \*\*Evals: 26 \/ 36 rounds passed\*\*/);
});

test('only writes summaries when only summaries are asked for', () => {
  const dir = mkdtempSync(join(tmpdir(), 'eval-report-cli-'));
  const result = run(fixtures, '--summary', join(dir, 's.md'));
  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stdout, /Report:/);
});

test('refuses --only without a scope, and an unknown scope', () => {
  assert.equal(run(fixtures, '--only').status, 2);
  assert.match(run(fixtures, '--scope', 'week').stderr, /--scope must be "commit" or "pr"/);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildReport } from '../scripts/lib/load.mjs';
import { renderHeadline, renderSummary } from '../scripts/lib/render-summary.mjs';

const report = () => {
  const r = buildReport([
    { file: 'a.eval.ts', name: 'good', checks: [{ label: 'x', pass: true }] },
    { file: 'a.eval.ts', name: 'bad | pipe', checks: [{ label: 'x', pass: false }] },
  ]);
  r.files[0].cases[1].fresh = 'new';
  return r;
};

test('the headline gives rounds, cases and a link', () => {
  assert.equal(renderHeadline(report(), { reportUrl: 'https://x/r/?v=1', scope: 'pr' }),
    '🔴 **Evals: 1 / 2 rounds passed** · 1 / 2 cases · new or changed: 0 / 1 rounds in 1 cases · [View report →](https://x/r/?v=1)');
});

test('all green shows a green dot', () => {
  const r = buildReport([{ file: 'a', name: 'n', checks: [{ label: 'x', pass: true }] }]);
  assert.match(renderHeadline(r), /^🟢/);
});

test('the summary has a row per file and links each failed case into the report', () => {
  const md = renderSummary(report(), { reportUrl: 'https://x/r/?v=1#status=failed' });
  assert.match(md, /\| `a\.eval\.ts` \| 🔴 1 \/ 2 \| 1 \/ 2 \| bad \\\| pipe \|/);
  assert.match(md, /- 🔴 \[bad \| pipe\]\(https:\/\/x\/r\/\?v=1#a-eval-ts-bad-pipe\) _\(new\)_: 0 \/ 1 rounds/);
});

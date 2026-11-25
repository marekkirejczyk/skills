import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildReport, loadResults, onlyFresh, stats } from '../scripts/lib/load.mjs';

const pass = (label) => ({ kind: 'exact', label, pass: true });
const fail = (label) => ({ kind: 'judge', label, pass: false, reason: 'why' });

test('groups results by file, then by case, with rounds in order', () => {
  const report = buildReport({ results: [
    { file: 'b.eval.ts', name: 'one', round: 2, checks: [pass('x')] },
    { file: 'a.eval.ts', name: 'two', checks: [pass('x')] },
    { file: 'b.eval.ts', name: 'one', round: 1, checks: [pass('x')] },
  ] });
  assert.deepEqual(report.files.map((f) => f.path), ['a.eval.ts', 'b.eval.ts']);
  assert.deepEqual(report.files[1].cases[0].runs.map((r) => r.round), [1, 2]);
});

test('accepts a bare array of results', () => {
  const report = buildReport([{ file: 'a', name: 'n', checks: [] }]);
  assert.equal(report.files[0].cases[0].name, 'n');
  assert.deepEqual(report.meta, {});
});

test('rejects input with no results array', () => {
  assert.throws(() => buildReport({ nope: true }), /array of results/);
});

test('a round passes when every check passes, unless it says otherwise', () => {
  const report = buildReport([
    { file: 'a', name: 'all pass', checks: [pass('x'), pass('y')] },
    { file: 'a', name: 'one fails', checks: [pass('x'), fail('y')] },
    { file: 'a', name: 'explicit', pass: false, checks: [pass('x')] },
  ]);
  const byName = Object.fromEntries(report.files[0].cases.map((c) => [c.name, c.runs[0].pass]));
  assert.deepEqual(byName, { 'all pass': true, 'one fails': false, explicit: false });
});

test('an error becomes a failing check', () => {
  const [run] = buildReport([{ file: 'a', name: 'n', error: 'timeout', checks: [] }]).files[0].cases[0].runs;
  assert.equal(run.pass, false);
  assert.deepEqual(run.checks, [{ kind: 'error', label: 'timeout', pass: false, reason: '' }]);
});

test('stats count rounds, cases (all rounds passed) and new or changed', () => {
  const report = buildReport([
    { file: 'a', name: 'flaky', checks: [pass('x')] },
    { file: 'a', name: 'flaky', checks: [fail('x')] },
    { file: 'a', name: 'solid', checks: [pass('x')] },
  ]);
  report.files[0].cases[0].fresh = 'changed';
  const totals = stats(report);
  assert.equal(totals.runs, 3); assert.equal(totals.runsPassed, 2);
  assert.equal(totals.cases, 2); assert.equal(totals.casesPassed, 1);
  assert.equal(totals.freshCases, 1); assert.equal(totals.freshRuns, 2); assert.equal(totals.freshRunsPassed, 1);
});

test('onlyFresh drops cases and files with nothing new or changed', () => {
  const report = buildReport([{ file: 'a', name: 'old', checks: [] }, { file: 'b', name: 'new', checks: [] }]);
  report.files[1].cases[0].fresh = 'new';
  assert.deepEqual(onlyFresh(report).files.map((f) => f.path), ['b']);
});

test('loads JSON Lines and runs an adapter over the raw results', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'eval-report-'));
  writeFileSync(join(dir, 'r.jsonl'), '{"test":"a","ok":true}\n\n{"test":"b","ok":false}\n');
  writeFileSync(join(dir, 'adapter.mjs'), 'export default (rows) => rows.map((r) => ({ file: "x", name: r.test, pass: r.ok }));');
  const raw = await loadResults(join(dir, 'r.jsonl'), join(dir, 'adapter.mjs'));
  assert.deepEqual(raw.map((r) => [r.name, r.pass]), [['a', true], ['b', false]]);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildReport } from '../scripts/lib/load.mjs';
import { baseRef, changedFiles, linkCode, locateCases, markFresh } from '../scripts/lib/git.mjs';

function repo() {
  const dir = mkdtempSync(join(tmpdir(), 'eval-report-git-'));
  const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' });
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 't@example.com'); git('config', 'user.name', 't');
  return { dir, git, write: (path, text) => writeFileSync(join(dir, path), text) };
}

const source = (cases) => cases.map(([name, body]) => `evalCase('${name}', {\n  input: '${body}',\n});\n`).join('\n');

test('marks cases new, changed or untouched against the base commit', () => {
  const { dir, git, write } = repo();
  write('a.eval.ts', source([['stays', 'same'], ['edited', 'before'], ['last', 'same']]));
  git('add', '.'); git('commit', '-qm', 'base');
  write('a.eval.ts', source([['stays', 'same'], ['edited', 'after'], ['last', 'same'], ['added', 'x']]));
  write('b.eval.ts', source([['in a new file', 'x']]));

  const report = buildReport([
    ...['stays', 'edited', 'last', 'added'].map((name) => ({ file: 'a.eval.ts', name, checks: [] })),
    { file: 'b.eval.ts', name: 'in a new file', checks: [] },
  ]);
  locateCases(dir, report);
  markFresh(dir, report, 'HEAD');
  const fresh = Object.fromEntries(report.files.flatMap((f) => f.cases.map((c) => [c.name, c.fresh])));
  assert.deepEqual(fresh, { stays: null, edited: 'changed', last: null, added: 'new', 'in a new file': 'new' });
});

test('a case without a line counts as changed when its file changed', () => {
  const { dir, git, write } = repo();
  write('a.eval.ts', 'cases from a table: "row one"\n');
  git('add', '.'); git('commit', '-qm', 'base');
  write('a.eval.ts', 'cases from a table: "row one"\nmore\n');
  const report = buildReport([{ file: 'a.eval.ts', name: 'not in the source text', checks: [] }]);
  markFresh(dir, report, 'HEAD');
  assert.equal(report.files[0].cases[0].fresh, 'new'); // its name is not in base at all
  const named = buildReport([{ file: 'a.eval.ts', name: 'row one', checks: [] }]);
  markFresh(dir, named, 'HEAD');
  assert.equal(named.files[0].cases[0].fresh, 'changed');
});

test('locateCases finds the line of each case by its name', () => {
  const { dir, write } = repo();
  write('a.eval.ts', source([['first', 'x'], ['second', 'y']]));
  const report = buildReport([{ file: 'a.eval.ts', name: 'second', checks: [] }, { file: 'a.eval.ts', name: 'kept', line: 99, checks: [] }]);
  locateCases(dir, report);
  assert.deepEqual(Object.fromEntries(report.files[0].cases.map((c) => [c.name, c.line])), { second: 5, kept: 99 });
});

test('commit scope compares with the previous commit; pr scope with the merge base', () => {
  const { dir, git, write } = repo();
  write('a', '1'); git('add', '.'); git('commit', '-qm', 'one');
  const first = git('rev-parse', 'HEAD').trim();
  git('checkout', '-qb', 'feature');
  write('a', '2'); git('commit', '-qam', 'two');
  write('b', '3'); git('add', '.'); git('commit', '-qm', 'three');
  assert.equal(baseRef(dir, 'commit'), 'HEAD~1');
  assert.equal(baseRef(dir, 'pr'), first);
  assert.equal(baseRef(dir, 'pr', 'v1.0'), 'v1.0');
  assert.deepEqual(changedFiles(dir, first), ['a', 'b']);
});

test('links each case to its line on GitHub', () => {
  const report = buildReport([{ file: 'e/a.eval.ts', name: 'n', line: 7, checks: [] }, { file: 'e/a.eval.ts', name: 'm', checks: [] }]);
  linkCode(report, 'o/r', 'abc');
  assert.deepEqual(report.files[0].cases.map((c) => c.codeUrl), [
    'https://github.com/o/r/blob/abc/e/a.eval.ts#L7',
    'https://github.com/o/r/blob/abc/e/a.eval.ts',
  ]);
});

test('cases defined as data (YAML) are located and marked the same way', () => {
  const { dir, git, write } = repo();
  const yaml = (rubric) => `tests:\n  - description: first case\n    assert: [{ type: contains, value: a }]\n\n  - description: second case\n    assert: [{ type: llm-rubric, value: ${rubric} }]\n`;
  write('e.eval.yaml', yaml('polite'));
  git('add', '.'); git('commit', '-qm', 'base');
  write('e.eval.yaml', yaml('polite and brief'));
  const report = buildReport(['first case', 'second case'].map((name) => ({ file: 'e.eval.yaml', name, checks: [] })));
  locateCases(dir, report);
  markFresh(dir, report, 'HEAD');
  assert.deepEqual(report.files[0].cases.map((c) => [c.name, c.line, c.fresh]), [['first case', 2, null], ['second case', 5, 'changed']]);
});

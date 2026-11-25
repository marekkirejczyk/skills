import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { fillCaseLines, findCaseLine, groupRuns, normalizeRun, parseResults } from '../../skills/eval-report/scripts/lib/results.mjs';

const run = (fields) => normalizeRun({ file: 'evals/a.eval.ts', case: 'greets', checks: [{ name: 'ok', passed: true }], ...fields }, 0);

describe('parseResults', () => {
  it('reads one JSON object per line', () => {
    assert.deepEqual(parseResults('{"case":"a"}\n\n{"case":"b"}\n'), [{ case: 'a' }, { case: 'b' }]);
  });

  it('reads a JSON array', () => {
    assert.deepEqual(parseResults('[{"case":"a"},{"case":"b"}]'), [{ case: 'a' }, { case: 'b' }]);
  });

  it('reads an object holding runs', () => {
    assert.deepEqual(parseResults('{"runs":[{"case":"a"}]}'), [{ case: 'a' }]);
  });

  it('reads nothing from an empty file', () => {
    assert.deepEqual(parseResults('  \n'), []);
  });

  it('names the line that is not JSON', () => {
    assert.throws(() => parseResults('{"case":"a"}\nnot json'), /results line 2 is not JSON/);
  });
});

describe('normalizeRun', () => {
  it('requires a file and a case', () => {
    assert.throws(() => normalizeRun({ case: 'a' }, 2), /run 3: "file"/);
    assert.throws(() => normalizeRun({ file: 'a.ts' }, 0), /run 1: "case"/);
  });

  it('passes when every check passes', () => {
    assert.equal(run({}).passed, true);
  });

  it('fails when a check fails', () => {
    assert.equal(run({ checks: [{ name: 'a', passed: true }, { name: 'b', passed: false }] }).passed, false);
  });

  it('fails without checks unless it says it passed', () => {
    assert.equal(run({ checks: [] }).passed, false);
    assert.equal(run({ checks: [], passed: true }).passed, true);
  });

  it('fails on an error whatever it says', () => {
    assert.equal(run({ passed: true, error: 'timeout' }).passed, false);
  });

  it('keeps what a check means, and nothing when it does not say', () => {
    const { checks } = run({ checks: [{ kind: 'exact', name: 'ends "done"', passed: true, about: 'The reply ended normally.' }, { name: 'b', passed: false, reason: 'no' }] });
    assert.deepEqual(checks, [
      { kind: 'exact', name: 'ends "done"', passed: true, reason: '', about: 'The reply ended normally.' },
      { kind: 'checks', name: 'b', passed: false, reason: 'no', about: '' },
    ]);
  });

  it('drops a leading ./ from the file', () => {
    assert.equal(run({ file: './evals/a.eval.ts' }).file, 'evals/a.eval.ts');
  });
});

describe('groupRuns', () => {
  it('groups runs by file then case, in the order first seen', () => {
    const files = groupRuns([run({ case: 'b' }), run({ case: 'a' }), run({ file: 'z.ts', case: 'c' }), run({ case: 'b' })]);
    assert.deepEqual(files.map((file) => [file.path, file.cases.map((evalCase) => [evalCase.name, evalCase.runs.length])]), [
      ['evals/a.eval.ts', [['b', 2], ['a', 1]]],
      ['z.ts', [['c', 1]]],
    ]);
  });

  it('numbers rounds in order when the runs do not', () => {
    const [file] = groupRuns([run({}), run({})]);
    assert.deepEqual(file.cases[0].runs.map((each) => each.round), [1, 2]);
  });

  it('sorts runs by their round', () => {
    const [file] = groupRuns([run({ round: 2 }), run({ round: 1 })]);
    assert.deepEqual(file.cases[0].runs.map((each) => each.round), [1, 2]);
  });

  it('fails a case when any of its runs fails', () => {
    const [file] = groupRuns([run({}), run({ passed: false })]);
    assert.equal(file.cases[0].passed, false);
  });
});

describe('findCaseLine', () => {
  const source = "describe('x', () => {\n  it(\"greets\", () => {});\n  it('greets twice', () => {});\n});";

  it('finds the line quoting the name', () => {
    assert.equal(findCaseLine(source, 'greets'), 2);
    assert.equal(findCaseLine(source, 'greets twice'), 3);
  });

  it('is null when the name is not quoted anywhere', () => {
    assert.equal(findCaseLine(source, 'waves'), null);
  });
});

describe('fillCaseLines', () => {
  it('keeps a line the run gave and fills the rest from the source', () => {
    const files = groupRuns([run({ case: 'a', line: 40 }), run({ case: 'b' })]);
    fillCaseLines(files, () => "'a'\n'b'");
    assert.deepEqual(files[0].cases.map((evalCase) => evalCase.line), [40, 2]);
  });

  it('leaves lines empty when the source is missing', () => {
    const files = groupRuns([run({})]);
    fillCaseLines(files, () => null);
    assert.equal(files[0].cases[0].line, null);
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { changedEvalFiles, classifyCase, globToRegExp, markChangedCases, parseDiff } from '../../skills/eval-report/scripts/lib/scope.mjs';

const DIFF = `diff --git a/evals/a.eval.ts b/evals/a.eval.ts
index 111..222 100644
--- a/evals/a.eval.ts
+++ b/evals/a.eval.ts
@@ -10,0 +11,3 @@ describe
+added
@@ -20 +23 @@
-old
+new
@@ -30,2 +32,0 @@
-gone
diff --git a/evals/b.eval.ts b/evals/b.eval.ts
new file mode 100644
--- /dev/null
+++ b/evals/b.eval.ts
@@ -0,0 +1,5 @@
+all new
diff --git a/evals/c.eval.ts b/evals/c.eval.ts
deleted file mode 100644
--- a/evals/c.eval.ts
+++ /dev/null
@@ -1,2 +0,0 @@
-removed
`;

describe('parseDiff', () => {
  const changes = parseDiff(DIFF);

  it('collects the touched line ranges of a changed file', () => {
    assert.deepEqual(changes.get('evals/a.eval.ts'), { added: false, ranges: [[11, 13], [23, 23], [32, 32]] });
  });

  it('marks a new file as added', () => {
    assert.equal(changes.get('evals/b.eval.ts').added, true);
  });

  it('leaves out deleted files', () => {
    assert.equal(changes.has('evals/c.eval.ts'), false);
  });
});

describe('classifyCase', () => {
  const change = { added: false, ranges: [[11, 13]] };

  it('is new when the case is in a new file', () => {
    assert.equal(classifyCase({ added: true, ranges: [] }, 5, null), 'new');
  });

  it('is new when its definition line was added', () => {
    assert.equal(classifyCase(change, 12, 20), 'new');
  });

  it('is changed when a line before the next case was touched', () => {
    assert.equal(classifyCase(change, 8, 20), 'changed');
  });

  it('is unchanged when the touched lines belong to the next case', () => {
    assert.equal(classifyCase(change, 2, 11), null);
  });

  it('is unchanged when its file was not touched', () => {
    assert.equal(classifyCase(undefined, 2, null), null);
  });

  it('is changed when its line is unknown and its file was touched', () => {
    assert.equal(classifyCase(change, null, null), 'changed');
  });
});

describe('markChangedCases', () => {
  it('keeps a change the run gave and classifies the others', () => {
    const files = [{ path: 'evals/a.eval.ts', cases: [{ line: 2, change: 'new' }, { line: 8, change: null }, { line: 30, change: null }] }];
    markChangedCases(files, new Map([['evals/a.eval.ts', { added: false, ranges: [[11, 13]] }]]));
    assert.deepEqual(files[0].cases.map((evalCase) => evalCase.change), ['new', 'changed', null]);
  });
});

describe('globToRegExp', () => {
  it('matches one directory level with *', () => {
    assert.equal(globToRegExp('evals/*.eval.ts').test('evals/a.eval.ts'), true);
    assert.equal(globToRegExp('evals/*.eval.ts').test('evals/x/a.eval.ts'), false);
  });

  it('matches any depth with **/', () => {
    assert.equal(globToRegExp('**/*.eval.ts').test('a.eval.ts'), true);
    assert.equal(globToRegExp('**/*.eval.ts').test('x/y/a.eval.ts'), true);
  });

  it('treats dots literally', () => {
    assert.equal(globToRegExp('*.ts').test('ats'), false);
  });
});

describe('changedEvalFiles', () => {
  it('lists the changed files the eval globs match, sorted', () => {
    const changes = new Map([['src/app.ts', {}], ['evals/b.eval.ts', {}], ['evals/a.eval.ts', {}]]);
    assert.deepEqual(changedEvalFiles(changes, ['evals/*.eval.ts']), ['evals/a.eval.ts', 'evals/b.eval.ts']);
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BODY_END, BODY_START, bodyBlock, commentBody, summarize, summaryLine, upsertBodyBlock } from '../../skills/eval-report/scripts/lib/summary.mjs';
import { commandFor } from '../../skills/eval-report/scripts/lib/command.mjs';
import { formatDuration } from '../../skills/eval-report/scripts/lib/report.mjs';
import { pagesExposePrivateRepo } from '../../skills/eval-report/scripts/lib/publish.mjs';

const evalCase = (name, results, change = null) => ({ name, change, passed: results.every(Boolean), runs: results.map((passed) => ({ passed })) });
const FILES = [
  { path: 'evals/a.eval.ts', cases: [evalCase('greets', [true, false], 'new'), evalCase('waves', [true])] },
  { path: 'evals/b.eval.ts', cases: [evalCase('leaves', [true])] },
];

describe('summarize', () => {
  it('counts runs and cases', () => {
    const summary = summarize(FILES, 'all');
    assert.deepEqual([summary.runs, summary.cases], [{ passed: 3, total: 4 }, { passed: 2, total: 3 }]);
  });

  it('counts new or changed cases only in a scope', () => {
    assert.equal(summarize(FILES, 'all').fresh, null);
    assert.deepEqual(summarize(FILES, 'pr').fresh, { runs: { passed: 1, total: 2 }, cases: { passed: 0, total: 1 } });
  });

  it('lists the failed cases of each file', () => {
    assert.deepEqual(summarize(FILES, 'all').files.map((file) => file.failedCases), [['greets'], []]);
  });
});

describe('summaryLine', () => {
  it('says runs then cases', () => {
    assert.equal(summaryLine(summarize(FILES, 'all')), 'Evals: 3 / 4 runs passed · 2 / 3 cases');
  });
});

describe('bodyBlock', () => {
  it('is red with a link, and the PR line in a PR scope', () => {
    const block = bodyBlock(summarize(FILES, 'pr'), 'https://r');
    assert.match(block, /^<!-- eval-report:start -->\n🔴 \*\*Evals: 3 \/ 4 runs passed · 2 \/ 3 cases\*\* · \[View report →\]\(https:\/\/r\)/);
    assert.match(block, /New or changed in this PR: 0 \/ 1 cases, 1 \/ 2 runs passed/);
  });

  it('is green when every run passed', () => {
    assert.match(bodyBlock(summarize([FILES[1]], 'all'), 'u'), /🟢/);
  });
});

describe('upsertBodyBlock', () => {
  const block = `${BODY_START}\nnew\n${BODY_END}`;

  it('puts the block above the description', () => {
    assert.equal(upsertBodyBlock('Fixes it.', block), `${block}\n\nFixes it.`);
  });

  it('replaces the earlier block in place', () => {
    assert.equal(upsertBodyBlock(`${BODY_START}\nold\n${BODY_END}\n\nFixes it.`, block), `${block}\n\nFixes it.`);
  });

  it('is the block alone for an empty description', () => {
    assert.equal(upsertBodyBlock(null, block), block);
  });
});

describe('commentBody', () => {
  const comment = commentBody(summarize(FILES, 'all'), 'https://r');

  it('starts with the marker that finds it again', () => {
    assert.match(comment, /^<!-- eval-report:comment -->/);
  });

  it('has a row per file with its failed cases', () => {
    assert.match(comment, /\| 🔴 `evals\/a.eval.ts` \| 2 \/ 3 \| greets \|/);
    assert.match(comment, /\| 🟢 `evals\/b.eval.ts` \| 1 \/ 1 \| — \|/);
  });

  it('links to the failed runs', () => {
    assert.match(comment, /\[failed only\]\(https:\/\/r#status=failed\)/);
  });
});

describe('commandFor', () => {
  it('runs everything when not only the changed files', () => {
    assert.equal(commandFor('pnpm evals {files}', ['a.ts'], false), 'pnpm evals');
  });

  it('puts the quoted files in the placeholder', () => {
    assert.equal(commandFor('pnpm evals {files} --ci', ["a.ts", "it's.ts"], true), "pnpm evals 'a.ts' 'it'\\''s.ts' --ci");
  });

  it('appends the files without a placeholder', () => {
    assert.equal(commandFor('pnpm evals', ['a.ts'], true), "pnpm evals 'a.ts'");
  });
});

describe('formatDuration', () => {
  it('uses ms, seconds or minutes', () => {
    assert.deepEqual([formatDuration(850), formatDuration(11200), formatDuration(161000), formatDuration(null)], ['850ms', '11.2s', '2m 41s', '']);
  });
});

describe('pagesExposePrivateRepo', () => {
  it('is true for a private repository with public pages', () => {
    assert.equal(pagesExposePrivateRepo({ repoIsPrivate: true, pagesArePublic: true }), true);
  });

  it('is false when the pages are private too', () => {
    assert.equal(pagesExposePrivateRepo({ repoIsPrivate: true, pagesArePublic: false }), false);
  });

  it('is false for a public repository', () => {
    assert.equal(pagesExposePrivateRepo({ repoIsPrivate: false, pagesArePublic: true }), false);
  });
});

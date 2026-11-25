// The whole path: the fixture evals run through eval-report.mjs into a report.

import { before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runFingerprint } from '../../skills/eval-report/scripts/lib/report.mjs';

const CLI = 'skills/eval-report/scripts/eval-report.mjs';
const CONFIG = 'test/eval-report/fixtures/eval-report.json';

describe('eval-report.mjs run on the fixture evals', () => {
  let out;
  let page;
  let summary;

  before(() => {
    out = mkdtempSync(join(tmpdir(), 'eval-report-test-'));
    execFileSync('node', [CLI, 'run', '--config', CONFIG, '--out', out], { encoding: 'utf8', env: { ...process.env, GITHUB_ACTIONS: 'true', GITHUB_EVENT_PATH: '', GITHUB_REPOSITORY: 'o/r', GITHUB_SHA: 'abc1234def' } });
    page = readFileSync(join(out, 'eval-report.html'), 'utf8');
    summary = JSON.parse(readFileSync(join(out, 'summary.json'), 'utf8'));
  });

  it('counts the fixture runs and cases', () => {
    assert.deepEqual([summary.runs, summary.cases], [{ passed: 21, total: 28 }, { passed: 13, total: 20 }]);
  });

  it('has a section per eval file', () => {
    assert.equal(page.match(/<details class="file"/g).length, 3);
  });

  it('has a row per run', () => {
    assert.equal(page.match(/<tr class="run"/g).length, 28);
  });

  it('links each case to the line it is defined on', () => {
    assert.match(page, /href="https:\/\/github.com\/o\/r\/blob\/abc1234def\/test\/eval-report\/fixtures\/evals\/cars-search.eval.mjs#L\d+"/);
  });

  it('offers no scope filter without a scope', () => {
    assert.doesNotMatch(page, /data-filter="scope"/);
  });

  it('has a review tick per run, keyed by file, case and round', () => {
    assert.equal(page.match(/class="review-box" data-review-run/g).length, 28);
    assert.match(page, /data-key="test\/eval-report\/fixtures\/evals\/cars-search.eval.mjs::a full postcode and distance go into the searches#2"/);
  });

  it('says what a check means when the pointer rests on it', () => {
    assert.match(page, /<div class="check pass has-about" title="The reply ended normally, with no error\.">/);
    assert.match(page, /<div class="check pass">/);
  });

  it('makes the name of a check that says what it means a button, for the bubble', () => {
    assert.match(page, /<button type="button" class="about-button" aria-expanded="false">ends &quot;done&quot;<\/button>/);
    assert.doesNotMatch(page, /<button type="button" class="about-button"[^>]*>the 6 rules for every reply/);
  });

  it('shows the tools\' arguments and results as JSON that folds', () => {
    assert.match(page, /<details class="raw"><summary>Arguments and results<\/summary><div class="json"><details class="json-fold" data-key="" open>/);
  });

  it('lists every case under its file, each linked to where it is on the page', () => {
    const links = [...page.matchAll(/<a href="#(case-\d+)" data-case-link>/g)].map((match) => match[1]);
    assert.equal(links.length, 20);
    assert.equal(page.match(/<div class="case-list-file">/g).length, 3);
    for (const id of links) assert.ok(page.includes(`<tr class="case-head" id="${id}">`), id);
  });

  it('loads nothing from the network', () => {
    assert.doesNotMatch(page, /<(script|link)[^>]+(src|href)="http/);
  });
});

describe('runFingerprint', () => {
  const run = { input: 'hi', output: 'hello', error: '', checks: [{ name: 'a', passed: true }], mocks: [], durationMs: 10 };

  it('is the same for the same round', () => {
    assert.equal(runFingerprint(run), runFingerprint({ ...run }));
  });

  it('ignores how long the round took', () => {
    assert.equal(runFingerprint(run), runFingerprint({ ...run, durationMs: 99 }));
  });

  it('ignores what a check says it means', () => {
    assert.equal(runFingerprint(run), runFingerprint({ ...run, checks: [{ name: 'a', passed: true, about: 'What a means.' }] }));
  });

  it('changes when the output changes', () => {
    assert.notEqual(runFingerprint(run), runFingerprint({ ...run, output: 'hello!' }));
  });
});

describe('eval-report.mjs with bad options', () => {
  it('refuses --only without a scope', () => {
    assert.throws(() => execFileSync('node', [CLI, 'run', '--only', '--config', CONFIG], { stdio: 'pipe' }), /--only needs --scope/);
  });
});

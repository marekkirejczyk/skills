import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildReport } from '../scripts/lib/load.mjs';
import { fingerprint, formatDuration, formatText, renderHtml, renderInput, renderOutput, summarizeResult } from '../scripts/lib/render-html.mjs';

test('formatText makes paragraphs, lists, bold and code, and escapes HTML', () => {
  assert.equal(formatText('Hi **you**\n\n- one\n- `two`\n1. three'),
    '<p>Hi <b>you</b></p><ul><li>one</li><li><code>two</code></li></ul><ol><li>three</li></ol>');
  assert.equal(formatText('<script>'), '<p>&lt;script&gt;</p>');
});

test('an output with no words says so, then shows its cards', () => {
  const html = renderOutput({ text: '', cards: [{ kind: 'Question', body: 'Which?', chips: ['A', 'B'] }] });
  assert.match(html, /\(no words\)/);
  assert.match(html, /<span class="chip">A<\/span><span class="chip">B<\/span>/);
});

test('rows of data become a table', () => {
  const html = renderOutput({ text: 'Top', data: [{ product: 'mug', revenue: 3 }, { product: 'tote' }] });
  assert.match(html, /<table class="data"><thead><tr><th>product<\/th><th>revenue<\/th>/);
  assert.match(html, /<td>tote<\/td><td><\/td>/);
});

test('a plain string output is formatted text', () => {
  assert.equal(renderOutput('- a\n- b'), '<ul><li>a</li><li>b</li></ul>');
});

test('a conversation input shows who said each message', () => {
  const html = renderInput([{ role: 'user', content: 'Hi' }, { role: 'assistant', content: 'Hello' }]);
  assert.match(html, /<div class="who">user<\/div><p>Hi<\/p>/);
  assert.match(html, /<div class="who">assistant<\/div><p>Hello<\/p>/);
});

test('a structured input is shown as fields', () => {
  assert.match(renderInput({ question: 'How many?', database: 'shop' }), /<dt>question<\/dt><dd>How many\?<\/dd>/);
});

test('mock results are summarised short', () => {
  assert.equal(summarizeResult(undefined), 'not called');
  assert.equal(summarizeResult('noted'), 'noted');
  assert.equal(summarizeResult({ count: 412 }), '{"count":412}');
  assert.equal(summarizeResult('x'.repeat(50)).length, 40);
});

test('durations read like 850ms, 4.2s, 2m 41s', () => {
  assert.deepEqual([850, 4200, 161000].map(formatDuration), ['850ms', '4.2s', '2m 41s']);
});

const sample = () => buildReport({ meta: { title: 'T <b>' }, results: [
  { file: 'a.eval.ts', name: 'ok', checks: [{ kind: 'exact', label: 'x', pass: true }] },
  { file: 'a.eval.ts', name: 'bad <img>', checks: [{ kind: 'judge', label: 'y', pass: false, reason: 'because' }] },
] });

test('the page shows totals, colours each round, and escapes everything from the results', () => {
  const html = renderHtml(sample());
  assert.match(html, /<span class="is-fail">1<\/span><span class="of">\/ 2<\/span>/);
  assert.match(html, /<tr class="run" data-pass="1"/);
  assert.match(html, /<tr class="run" data-pass="0"/);
  assert.match(html, /<div class="check is-fail">/);
  assert.match(html, /bad &lt;img&gt;/);
  assert.doesNotMatch(html, /<img>|T <b>/);
});

test('the scope filter and tile appear only when a scope is given', () => {
  assert.doesNotMatch(renderHtml(sample()), /data-scope=/);
  const scoped = renderHtml(sample(), { scope: 'pr' });
  assert.match(scoped, /data-scope="fresh"/);
  assert.match(scoped, /New or changed in this PR/);
});

test('the page has a theme switch, and dark colours for both the system setting and the switch', () => {
  const html = renderHtml(sample());
  assert.match(html, /data-theme-switch/);
  assert.match(html, /:root:not\(\[data-theme="light"\]\)/);
  assert.match(html, /:root\[data-theme="dark"\]/);
});

test('a case with one failed round is a failed case, for colour and for the filter', () => {
  const html = renderHtml(buildReport([
    { file: 'a', name: 'flaky', checks: [{ label: 'x', pass: true }] },
    { file: 'a', name: 'flaky', checks: [{ label: 'x', pass: false }] },
  ]));
  assert.match(html, /<tbody class="case" id="a-flaky" data-pass="0"/);
  assert.match(html, /<div class="case-title is-fail">/);
});

test('every round, case and file has a review box, and the store is per repository', () => {
  const report = sample();
  report.meta.repo = 'o/r';
  const html = renderHtml(report);
  assert.equal((html.match(/data-review>/g) || []).length, 2);
  assert.equal((html.match(/data-review-case aria-label/g) || []).length, 2);
  assert.match(html, /data-review-file/);
  assert.match(html, /data-review-store="eval-report-reviewed:o\/r"/);
  assert.match(html, /data-key="a-eval-ts-ok#1" data-fingerprint="[0-9a-f]{12}"/);
});

test('the fingerprint of a round changes when its output changes, and only then', () => {
  const run = { input: 'q', output: { text: 'a' }, checks: [], mocks: [] };
  assert.equal(fingerprint(run), fingerprint({ ...run }));
  assert.notEqual(fingerprint(run), fingerprint({ ...run, output: { text: 'b' } }));
});

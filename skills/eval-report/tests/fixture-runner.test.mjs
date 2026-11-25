// The fake runner behind the fixtures: its YAML reader, its checks, and that
// the committed results.json is exactly what it produces.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseYaml } from '../fixtures/runner/yaml.mjs';
import { runChecks } from '../fixtures/runner/checks.mjs';
import { runFixtures } from '../fixtures/runner/run.mjs';

test('results.json is what the runner produces from the definitions and outputs.json', () => {
  const committed = readFileSync(new URL('../fixtures/results.json', import.meta.url), 'utf8');
  assert.equal(committed, JSON.stringify(runFixtures(), null, 2) + '\n',
    'Run `node skills/eval-report/fixtures/runner/run.mjs --out skills/eval-report/fixtures/results.json`');
});

test('the runner covers all three definition formats', () => {
  const files = new Set(runFixtures().results.map((r) => r.file.split('.').pop()));
  assert.deepEqual([...files].sort(), ['json', 'ts', 'yaml']);
});

test('the YAML reader handles block and flow collections, quotes and comments', () => {
  assert.deepEqual(parseYaml([
    '# comment',
    'name: suite',
    'tests:',
    '  - description: first, with a comma',
    '    vars: { question: How many?, n: 3, ok: true }',
    '    assert:',
    '      - type: regex',
    '        value: "LIMIT \\\\d+"',
    '      - [a, \'it\'\'s\', { k: [1, 2] }]',
    '  - description: second',
  ].join('\n')), {
    name: 'suite',
    tests: [
      { description: 'first, with a comma', vars: { question: 'How many?', n: 3, ok: true },
        assert: [{ type: 'regex', value: 'LIMIT \\d+' }, ['a', "it's", { k: [1, 2] }]] },
      { description: 'second' },
    ],
  });
});

const round = {
  output: { text: 'Here are 2 rows', data: [{ a: 1 }, { a: 2 }], cards: [{ kind: 'Question' }] },
  toolCalls: [{ tool: 'describe', args: { t: 'x' } }, { tool: 'query', args: { sql: 'SELECT 1', limit: 5 } }],
  verdicts: { polite: true, brief: 'Too long.' },
};
const check = (c) => runChecks([c], round)[0];

test('tool checks look at the calls, their arguments and their order', () => {
  assert.equal(check({ type: 'calls', tool: 'query', args: { limit: 5 } }).pass, true);
  assert.equal(check({ type: 'calls', tool: 'query', args: { limit: 9 } }).reason, 'Called with {"sql":"SELECT 1","limit":5}.');
  assert.equal(check({ type: 'calls', tool: 'refund' }).reason, 'refund was not called.');
  assert.equal(check({ type: 'notCalls', tool: 'query' }).reason, 'Called 1 time.');
  assert.equal(check({ type: 'callOrder', first: 'describe', then: 'query' }).pass, true);
  assert.equal(check({ type: 'callOrder', first: 'query', then: 'describe' }).reason, 'describe was called first.');
  assert.equal(check({ type: 'callCount', tool: 'query', times: 2 }).reason, 'Called 1 time.');
});

test('output checks look at the text, the data and the cards', () => {
  assert.equal(check({ type: 'contains', value: '"a":2' }).pass, true);
  assert.equal(check({ type: 'never', regex: /\d+ rows/ }).reason, 'Matched “2 rows”.');
  assert.equal(check({ type: 'showsCard', kind: 'question' }).pass, true);
  assert.equal(check({ type: 'hasData' }).pass, true);
  assert.equal(check({ type: 'js', code: 'output.data.length === 2' }).pass, true);
  assert.equal(check({ type: 'matches', regex: /LIMIT/ }).pass, false);
});

test('judge checks take the fake verdict, and a missing one is an error', () => {
  assert.deepEqual(check({ type: 'judge', label: 'brief' }), { kind: 'judge', label: 'brief', pass: false, reason: 'Too long.' });
  assert.equal(check({ type: 'judge', label: 'polite' }).pass, true);
  assert.throws(() => check({ type: 'judge', label: 'kind' }), /No fake verdict for "kind"/);
});

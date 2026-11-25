import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withBlock } from '../scripts/lib/pr-description.mjs';

test('puts the block first on a description without one', () => {
  assert.equal(withBlock('My change.', 'Evals: 1 / 1'), '<!-- eval-report:start -->\nEvals: 1 / 1\n<!-- eval-report:end -->\n\nMy change.\n');
});

test('replaces the block in place, leaving the author\'s text alone', () => {
  const before = 'Intro\n<!-- eval-report:start -->\nold\n<!-- eval-report:end -->\nRest';
  assert.equal(withBlock(before, 'new $& text'), 'Intro\n<!-- eval-report:start -->\nnew $& text\n<!-- eval-report:end -->\nRest');
});

test('an empty description gets just the block', () => {
  assert.equal(withBlock(null, 'x'), '<!-- eval-report:start -->\nx\n<!-- eval-report:end -->\n');
});

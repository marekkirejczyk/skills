#!/usr/bin/env node
// A fake eval runner for eval-report's fixtures. It runs the eval definitions
// in ../evals (TypeScript, YAML and JSON) against a fake model whose answers
// are in ../outputs.json, works out each check, and writes results in the
// eval-report format. No model calls, and the same output every time.
//   node run.mjs [--out results.json]
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { runChecks } from './checks.mjs';
import { loadDefinitions } from './definitions.mjs';

const fixtures = fileURLToPath(new URL('..', import.meta.url));
const repoRoot = join(fixtures, '../../..');

export function runFixtures() {
  const { rounds: answers } = JSON.parse(readFileSync(join(fixtures, 'outputs.json'), 'utf8'));
  const evalsDir = join(fixtures, 'evals');
  const results = [];
  const used = new Set();
  for (const name of readdirSync(evalsDir).sort()) {
    const path = join(evalsDir, name);
    for (const definition of loadDefinitions(path)) {
      const rounds = answers[definition.name];
      if (!rounds) throw new Error(`outputs.json has no answers for "${definition.name}"`);
      used.add(definition.name);
      rounds.forEach((round, index) => results.push(runRound(relative(repoRoot, path), definition, round, index + 1)));
    }
  }
  const unused = Object.keys(answers).filter((name) => !used.has(name));
  if (unused.length) throw new Error(`outputs.json has answers for cases no eval defines: ${unused.join('; ')}`);
  return { meta: { title: 'Eval report: fixtures', runAt: '2026-11-25T16:32:00Z' }, results };
}

function runRound(file, definition, round, number) {
  const result = { file, name: definition.name, round: number, durationMs: round.durationMs };
  if (definition.rule) result.rule = definition.rule;
  if (definition.knownBug) result.knownBug = definition.knownBug;
  result.input = definition.input;
  if (round.error) {
    // The run crashed: there is no answer to check.
    Object.assign(result, { error: round.error, output: null, checks: [] });
  } else {
    Object.assign(result, { output: round.output, checks: runChecks(definition.checks, round) });
  }
  result.mocks = mocksFor(definition.mocks, round.toolCalls || []);
  return result;
}

// Each tool the model called, with what the mock gave, then the mocked tools it never called.
function mocksFor(mocks, toolCalls) {
  const fakeOf = (tool) => (typeof mocks[tool] === 'string' && mocks[tool].startsWith('fake: ') ? mocks[tool].slice(6) : undefined);
  const shown = toolCalls.map((call) => {
    const mock = { tool: call.tool, args: call.args, result: 'result' in call ? call.result : mocks[call.tool] };
    if (fakeOf(call.tool)) mock.fake = fakeOf(call.tool);
    return mock;
  });
  for (const tool of Object.keys(mocks)) {
    if (!toolCalls.some((call) => call.tool === tool)) shown.push({ tool, ...(fakeOf(tool) ? { fake: fakeOf(tool) } : {}) });
  }
  return shown;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({ options: { out: { type: 'string' } } });
  const output = JSON.stringify(runFixtures(), null, 2) + '\n';
  if (values.out) writeFileSync(values.out, output);
  else process.stdout.write(output);
}

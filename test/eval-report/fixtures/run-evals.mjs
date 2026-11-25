#!/usr/bin/env node
// A stand-in eval runner for the fixtures: each case returns a canned run, so
// the report can be built and reviewed without calling a model.
// Usage: run-evals.mjs [eval files...]   (all fixture evals when none are given)

import { readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { recordRun } from '../../../skills/eval-report/scripts/reporter.mjs';

const evalsDir = join(dirname(fileURLToPath(import.meta.url)), 'evals');
const requested = process.argv.slice(2);
const files = requested.length
  ? requested.map((file) => resolve(file))
  : readdirSync(evalsDir).filter((name) => name.endsWith('.eval.mjs')).sort().map((name) => join(evalsDir, name));

for (const file of files) {
  const { default: cases } = await import(pathToFileURL(file));
  for (const evalCase of cases) {
    const rounds = evalCase.rounds ?? 1;
    for (let round = 1; round <= rounds; round++) {
      const run = evalCase.run(round);
      recordRun({ file: relative(process.cwd(), file), case: evalCase.name, rule: evalCase.rule, note: evalCase.note, round, durationMs: run.durationMs ?? 4000 + round * 700, ...run });
    }
  }
}

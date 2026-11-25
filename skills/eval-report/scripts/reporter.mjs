// For eval runners written in JavaScript: record one run of one case.
// eval-report sets EVAL_REPORT_FILE when it runs the evals; outside it, this does nothing.
// Other languages append the same JSON, one line per run (reference/input-format.md).

import { appendFileSync } from 'node:fs';

export function recordRun(run) {
  const file = process.env.EVAL_REPORT_FILE;
  if (!file) return;
  appendFileSync(file, `${JSON.stringify(run)}\n`);
}

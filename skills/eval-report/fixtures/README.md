# Fixture evals

A small eval suite that eval-report's tests and CI report on. It makes no model calls.

- `evals/`: the definitions, in three formats on purpose: TypeScript code (`support-agent.eval.ts`), YAML data in promptfoo's style (`sql-assistant.eval.yaml`) and JSON data (`travel-planner.eval.json`).
- `outputs.json`: the fake model. For each case it holds one entry per round: the answer, the tools called and what they gave, and the fake judge's verdict on each rubric.
- `runner/run.mjs`: the fake runner. It runs every definition against those answers, works out the exact checks (tool calls, text, cards, data), takes the judge checks from the verdicts, and writes the results.
- `results.json`: the runner's output, committed as an example of the input format. A test fails if it drifts from what the runner produces.

After changing a definition or an answer:

```bash
node skills/eval-report/fixtures/runner/run.mjs --out skills/eval-report/fixtures/results.json
node skills/eval-report/scripts/eval-report.mjs skills/eval-report/fixtures/results.json --scope pr --open
```

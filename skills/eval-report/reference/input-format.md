# Input format

`eval-report.mjs run` runs the repository's eval command with one extra environment variable, `EVAL_REPORT_FILE`: an absolute path to an empty file. The eval runner appends **one JSON object per line** to that file for every run of every case. The report is built from that file alone, so the runner, its language and its framework don't matter.

```
.eval-report.json ──► eval-report.mjs run ──► sh -c "<command>"  (EVAL_REPORT_FILE=…/results.ndjson)
                                                     │  your runner appends one line per run
                                                     ▼
                         eval-report/eval-report.html  ◄── results.ndjson
                         eval-report/summary.json
```

`eval-report.mjs build --results <file>` builds from a file written some other way. It also takes a JSON array of runs, or `{ "runs": [...] }`.

## The config: `.eval-report.json`

At the repository root:

```json
{
  "title": "Eval report",
  "command": "pnpm evals {files}",
  "evals": ["evals/**/*.eval.ts"]
}
```

| Field     | Required | Meaning |
| --------- | -------- | ------- |
| `command` | yes      | Runs the evals, from the repository root, through `sh -c`. `{files}` becomes the eval files to run with `--only`, and nothing otherwise. With `--only` and no `{files}`, the files are appended. |
| `evals`   | for `--only` | Globs for the eval files (`*`, `**/`, `?`), relative to the root. `--only` runs the files among them that changed in the scope. |
| `title`   | no       | The page's heading. |

The command's exit code is passed through, so CI stays red when evals fail. The report is written either way.

## One run

```json
{
  "file": "evals/cars-search.eval.ts",
  "case": "a full postcode and distance go into the searches",
  "round": 1,
  "durationMs": 7400,
  "rule": "Instructions, ‘Searches on listing sites’: give it their postcode",
  "input": "Petrol Ford Focus within 30 miles of LS1 4AP, up to £9,000 please.",
  "output": {
    "text": "",
    "blocks": [
      { "type": "card", "title": "Question card", "body": "Which gearbox would you prefer?", "options": ["Manual", "Automatic"] }
    ]
  },
  "checks": [
    { "kind": "judge", "name": "Doesn't ask for the postcode again", "passed": true, "about": "A second model reads the conversation and marks this true or false." },
    { "kind": "exact", "name": "calls search_links with radiusMiles 30", "passed": false, "reason": "radiusMiles was 10" }
  ],
  "mocks": [
    { "tool": "search_links", "args": { "postcode": "LS1 4AP", "radiusMiles": 10 }, "result": { "shown": 3 }, "summary": "shown", "fake": "forSale" }
  ]
}
```

| Field | Required | Meaning |
| ----- | -------- | ------- |
| `file` | yes | The eval file, relative to the repository root. Runs are grouped by it. |
| `case` | yes | The case's name. Runs with the same `file` and `case` are rounds of one case. |
| `round` | no | 1, 2, 3… Defaults to the order the runs were written. |
| `line` | no | The line the case is defined on. When missing, it is the first line of `file` that quotes `case`. Used for the link to the code and for new or changed. |
| `passed` | no | Defaults to: every check passed, and there is at least one. A run with `error` always fails. |
| `durationMs` | no | How long the run took. |
| `rule` | no | What the case checks, in a line: shown under its name. |
| `note` | no | Anything else a reviewer should know, such as a known intermittent bug. |
| `change` | no | `"new"` or `"changed"`, to override what git says. |
| `input` | no | A string (light markdown), a conversation `[{ "role", "text", "blocks"? }]`, or any JSON. A message's `blocks` are what it showed beside its words, as a reply's; one with no text shows as *(no words)*. |
| `output` | no | A string (light markdown), a reply `{ "text", "blocks" }`, or any JSON. An empty text shows as *(no words)*. |
| `error` | no | The run crashed: shown in red above the output. |
| `checks` | no | `{ kind, name, passed, reason?, about? }`. Grouped by `kind` (judge, exact, or any word); `reason` is shown when it failed. `about` says what the check means, for a reader who doesn't know the runner: it shows when the pointer rests on the check. |
| `mocks` | no | Tools the run called: `{ tool, args?, result?, summary?, fake? }`. `summary` is the short "what it gave"; without it, `result` is shortened. `fake` names the fake data behind it. |

**Light markdown**: paragraphs, `-` and `1.` lists, `**bold**`, `` `code` `` and code fences. Everything else is escaped.

**Blocks** in a reply's `blocks`, or a conversation message's:

| `type` | Fields | Shown as |
| ------ | ------ | -------- |
| `card` | `title`, `body`, `options` | A card, its options as chips |
| `list` | `title`, `items`: strings or `{ label, value }` | A bulleted card |
| `table` | `title`, `columns`, `rows` | A small table |
| anything else | | Its JSON as key and value pairs, a nested value as JSON indented by two spaces |

## Writing runs from a runner

JavaScript: `scripts/reporter.mjs` exports `recordRun(run)`, which appends a line when `EVAL_REPORT_FILE` is set and does nothing otherwise. Call it once per run, in the runner's hook that sees each result (an `afterEach`, a custom Vitest reporter, the end of a loop). Copy it into the repository rather than importing it from the skill.

Any other language: append `json.dumps(run) + "\n"` to the file named by `EVAL_REPORT_FILE`, when it is set. Open it in append mode for each write so parallel workers don't overwrite each other.

## New or changed

With `--scope commit` (the last commit and anything uncommitted) or `--scope pr` (everything since the merge base with the PR's base branch), each case is:

- **new** when its file is new or untracked, or the line that defines it was added;
- **changed** when any line from its definition to the next case's was touched;
- otherwise neither. A case with no known line counts as changed when its file was touched.

On Actions, check out with `fetch-depth: 0` so the merge base exists.

# The eval-report input format

One JSON file (or JSON Lines, one result per line). Each **result** is one round of one case. Rounds of the same case share `file` and `name`.

```json
{
  "meta": { "title": "Eval report", "runAt": "2026-11-25T16:32:00Z" },
  "results": [
    {
      "file": "evals/cars-search.eval.ts",
      "name": "searches are built from the brief",
      "round": 1,
      "durationMs": 11200,
      "rule": "Instructions, 'Searches': never say you found the cars behind a link",
      "knownBug": "Intermittent: the reply is a question card with no words",
      "input": "I want a diesel Skoda Octavia estate, up to £12,000.",
      "output": {
        "text": "I've set up searches below.\n- Auto Trader\n- Gumtree",
        "cards": [{ "kind": "Question", "title": "", "body": "Which gearbox?", "chips": ["Manual", "Automatic"] }],
        "data": [{ "make": "Skoda", "price": 11500 }]
      },
      "checks": [
        { "kind": "judge", "label": "doesn't claim to have found cars", "pass": true },
        { "kind": "exact", "label": "calls search_links", "pass": false, "reason": "not called" }
      ],
      "mocks": [
        { "tool": "find_cars", "args": { "make": "Skoda" }, "result": "none", "fake": "forSale" }
      ]
    }
  ]
}
```

A bare array of results works too.

| Field | Required | Shown as |
| --- | --- | --- |
| `file` | yes | The group. A path from the repository root, so it links to the code. |
| `name` | yes | The case. Its first line in `file` is found by searching for this text, unless `line` is given. |
| `line` | no | Where the case starts, for the code link and for spotting changed cases. |
| `round` | no | Round number. Defaults to the order of appearance. |
| `pass` | no | Overrides the result worked out from `checks` (all must pass). |
| `error` | no | A run that crashed: shown as a failing check. |
| `durationMs` | no | Time per round. Their sum is the run's time unless `meta.durationMs` is set. |
| `rule`, `knownBug` | no | Notes under the case's name. |
| `input` | no | A string (light Markdown), a list of `{ role, content }` messages, or an object (shown as fields). |
| `output` | no | A string, or `{ text, cards, data }`. Empty `text` shows "(no words)". `cards` have `kind`, `title`, `body`, `chips`, `items`, `links`. `data` that is a list of flat objects becomes a table. |
| `checks` | no | `{ kind, label, pass, reason }`. Grouped by `kind` (judge, exact, …). `reason` shows under a failed check. |
| `mocks` | no | `{ tool, args, result, fake }`: each tool the eval ran, what it gave, and the fake data behind it. |

Light Markdown in text: blank lines between paragraphs, `- ` and `1. ` lists, `**bold**` and `` `code` ``.

## Other formats: an adapter

When a runner writes something else, write an adapter once: an ES module whose default export takes the parsed file and returns the format above.

```js
// .eval-report.adapter.mjs
export default (raw) => raw.testResults.flatMap((file) => file.cases.map((c) => ({
  file: file.path, name: c.title, pass: c.status === 'passed', output: c.output,
})));
```

Pass it with `--adapter`, or set `"adapter"` in `.eval-report.json`.

## `.eval-report.json`

Settings in the repository root, so every run is a plain script call:

```json
{
  "results": "eval-results.json",
  "adapter": ".eval-report.adapter.mjs",
  "run": "pnpm evals --reporter json --outputFile eval-results.json",
  "runChanged": "pnpm evals --reporter json --outputFile eval-results.json {files}",
  "evalFiles": "\\.eval\\.ts$",
  "title": "Eval report"
}
```

`run` runs every eval. `runChanged` runs only the eval files changed in the scope: `{files}` becomes their paths, and `evalFiles` is a regular expression that picks them out of the changed files. Paths are relative to the repository root.

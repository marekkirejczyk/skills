---
name: eval-report
description: Turn an eval run into one readable static HTML report, built for fast review. Green and red pass/fail stats, collapsible groups per file, one row per round with input, output, judges and checks, and mocked tools, plus filters for failed and new or changed cases. Scripted, so a run uses almost no tokens. In a PR it links the report in a comment and at the top of the description.
argument-hint: "[only] [commit | pr]"
disable-model-invocation: true
---

# Eval report

Build a report from the repository's evals with a script. Arguments: `$ARGUMENTS`. If your agent does not fill that in, take them from the user's message.

| Invocation | What it does |
| --- | --- |
| `/eval-report` | Runs every eval and reports on all of them. |
| `/eval-report commit` or `/eval-report pr` | The same, and marks the cases that are new or changed in the last commit or in this branch's PR, with a filter for them. |
| `/eval-report only commit` or `/eval-report only pr` | Runs and reports only the new or changed cases. |

The script does the work. Your part is to call it, and to set the repository up once. **Do not read the generated HTML or the results file**: that is where the tokens go. The script prints the totals and the report's path, and that is enough to report back.

`<skill>` below is the directory this file is in.

## 1. Setup (the first run in a repository only)

Look for `.eval-report.json` in the repository root. If it exists, go to step 2.

Otherwise, find out once how this repository runs its evals:

1. Find the eval runner and its command (package scripts, a Makefile, CI workflows, `*.eval.*` files) and how to make it write results to a file.
2. Look at one results file, or at the runner's reporter code if there is no file yet, and compare it with `<skill>/reference/format.md`.
3. If it does not match, write an adapter, `.eval-report.adapter.mjs`, that maps it to the format. Keep every field the runner has: input, output, each judge and check with its reason, each tool call with its arguments and result, and rounds. The richer the mapping, the more useful the report.
4. Write `.eval-report.json` with `results`, `run`, and `adapter` if there is one. Add `runChanged` and `evalFiles` if the runner can run a list of files.
5. Add `.eval-report/` to `.gitignore`. The report is written there.
6. Run `node <skill>/scripts/eval-report.mjs` on the existing results and check that it prints sensible totals and finds the cases' files. Fix the adapter until it does.

Tell the user which files you added. They belong in the repository so the next run, and CI, need no tokens.

## 2. Run

```bash
node <skill>/scripts/eval-report.mjs --run --open [--scope commit|pr] [--only]
```

- `--run` runs the evals first, using `run` from the settings. With `--only`, it runs `runChanged` on the changed eval files instead, if the settings have it. Leave `--run` out only when the user asks for a report on the last results.
- `--scope` comes from the arguments: `commit` or `pr`. With neither, leave it out.
- `--only` when the arguments start with `only`.

The evals themselves may call models: that is their cost, not the report's. A failing eval does not stop the report.

## 3. Publish, for `pr` only

When the scope is `pr`, the branch has an open PR (`gh pr view`), and `gh` is signed in, link the report on the PR:

```bash
url=$(bash <skill>/scripts/publish-pages.sh .eval-report/index.html eval-reports/pr-<number>)
node <skill>/scripts/eval-report.mjs --scope pr --summary .eval-report/summary.md --headline .eval-report/headline.md --report-url "$url"
node <skill>/scripts/publish-pr.mjs --pr <number> --summary .eval-report/summary.md --headline .eval-report/headline.md
```

This pushes the report to the `gh-pages` branch, keeps one comment on the PR up to date, and replaces a one-line block at the top of the PR description. The author's text is never changed. If GitHub Pages is not on for the repository, say that it needs turning on once (Settings → Pages → branch `gh-pages`), and that the comment links to a page that will appear once it is.

## 4. Hand over

Give the user, in two or three lines:

- the totals the script printed (rounds and cases passed, and new or changed with a scope)
- the report's path, or its URL if you published it
- what you set up, on a first run

To run this on every PR without an agent, use `/eval-report-install-ci`.

---
name: eval-report
description: Run a repository's evals and turn the results into one static HTML report for fast review, with pass/fail counts, collapsible files, filters for failed and for new or changed cases, and links to the code. Run it with nothing for the whole repository, with commit or pr to mark what changed, or with only commit|pr to run just what changed.
argument-hint: "[only] [commit | pr]"
disable-model-invocation: true
---

# Eval report

A script does all the work: it runs the evals, reads what they recorded and writes `eval-report/eval-report.html` and `eval-report/summary.json`. Your part is to set it up once, run it, and hand over the link. **Spend no tokens on the results**: don't read the HTML, `results.ndjson` or the eval output. The script's last lines (the summary and the report path) are all you report.

The scripts are in `scripts/` next to this file; `<skill-dir>` below is this file's directory. The input format is in `reference/input-format.md`.

## Arguments

| You were given | Run |
| -------------- | --- |
| nothing | `node <skill-dir>/scripts/eval-report.mjs run` |
| `commit` or `pr` | `… run --scope commit` or `--scope pr`: everything runs; the report marks and filters what is new or changed |
| `only commit` or `only pr` | `… run --scope <scope> --only`: only the eval files that changed run |

Always run it from the repository root.

## 1. Set up, once per repository

Skip this when `.eval-report.json` exists and the runner already writes runs.

1. **Find the eval command**: a script named like `eval`/`evals` in `package.json`, a `Makefile` target, an `evals/` folder with its own runner, or what the README says. Ask if there are several, or none.
2. **Make the runner write runs.** Read `reference/input-format.md`. Find the one place in the runner that sees each case's result, and add a call that appends one line per run to `EVAL_REPORT_FILE` when it is set: copy `scripts/reporter.mjs` into the repository for JavaScript, or a few lines in its language. Map what the runner already has: its inputs, the model's reply, each judge and assertion with its reason, and every mocked tool call with its arguments and result. Leave fields out rather than invent them. Keep the change small and behind the environment variable, so the evals behave exactly as before without it.
3. **Write `.eval-report.json`** at the root with `command` (with `{files}` where the runner takes file paths) and `evals` globs.
4. Add `/eval-report/` to `.gitignore`.

## 2. Run

Run the command from the table. It prints the eval output, then:

```
Evals: 21 / 28 runs passed · 13 / 20 cases
Report: /abs/path/eval-report/eval-report.html
```

Exit code 2 is the script's own error, with the reason on stderr; fix the setup. Any other non-zero code is the eval command failing, which is normal when evals fail: the report is still written.

## 3. Hand it over

- **Claude Code with artifacts**: publish `eval-report/eval-report.html` with the Artifact tool, as it is.
- **Otherwise**: give the file's absolute path.

Then, when the branch has a pull request on GitHub and `gh` is signed in, ask whether to link it from the PR. On yes, run `node <skill-dir>/scripts/eval-report.mjs publish --url <the artifact or report URL>`. It puts a summary block at the top of the PR description and keeps one comment up to date, replacing earlier ones, so it is safe to run again. Add `--no-comment` to skip the comment.

Your reply: the summary line, the link, and the failed cases' names from `eval-report/summary.json` (`files[].failedCases`), nothing more.

## On CI

`/eval-report-install-ci` sets this up in GitHub Actions, where it runs without an agent or tokens. There the report is an artifact that opens in the browser for people who can read the repository, so it works on private repositories too.

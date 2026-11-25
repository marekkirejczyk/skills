---
name: eval-report-install-ci
description: Set up GitHub Actions to build an eval-report on every PR that touches the evals, and link it in a PR comment and at the top of the PR description. The report step is a plain script with no model calls. It adds to an existing eval job, or proposes a lean new one.
argument-hint: "[no-comments]"
disable-model-invocation: true
---

# Install eval-report on CI

Make CI build the eval report on every PR, with no agent and no model calls in the report step. Arguments: `$ARGUMENTS`. If your agent does not fill that in, take them from the user's message.

`no-comments` keeps the report out of the PR conversation: CI writes the job summary and publishes the page, but posts no comment and leaves the description alone. Without it, CI keeps one comment up to date and a one-line block at the top of the description.

`<skill>` is the directory this file is in. The scripts come from the `eval-report` skill beside it, `<skill>/../eval-report`. If it is not there, ask the user to install `eval-report` too, and stop.

## 1. Know the evals

Use `.eval-report.json` if the repository has one. If not, do `/eval-report`'s setup step first (its `SKILL.md`, step 1): CI needs the same settings, and the adapter if there is one.

From it you know the eval command, the results file, the adapter, and which paths the evals depend on.

## 2. Copy the scripts into the repository

Copy `<skill>/../eval-report/scripts/` and `<skill>/../eval-report/assets/` to `.github/eval-report/scripts/` and `.github/eval-report/assets/`. Leave out `tests/` and `fixtures/`. CI then runs the scripts from the repository and needs neither the skill nor an agent. Running this skill again updates them.

## 3. Find the eval job

Search `.github/workflows/` for a job that runs the evals: the `run` command from the settings, the package script it calls, or eval files.

**There is one.** Add the steps in `<skill>/assets/report-steps.yml` after the step that runs the evals, and make the job fit:

- the eval command writes the results file (add the runner's JSON reporter flag if needed)
- the eval step has `continue-on-error: true`, or the report step keeps `if: always()`
- checkout has `fetch-depth: 0`
- the job has `permissions: contents: write, pull-requests: write`

Change nothing else in the job.

**There is none.** Propose a new workflow from `<skill>/assets/evals.yml`, as its own file, `.github/workflows/evals.yml`. Fill in its placeholders:

- `__EVAL_PATHS__`: only the paths whose changes can change an eval result, so it runs only when they change: the eval files, the prompts and code they test, the runner's config
- `__SETUP__`: the project's own install, copied from its existing CI if it has any
- `__RUN_EVALS__` and `__RESULTS__`: the command and the file it writes
- `__SECRETS__`: the API keys the evals need, as repository secrets (list them for the user; never write a value)
- `__REPORT_ARGS__`: `--adapter <path>` if there is one, otherwise nothing
- `__COMMENT__`: `false` for `no-comments`, otherwise `true`

Show the user the filled-in workflow and the secrets it needs, and create it only once they approve it.

## 4. GitHub Pages

A Pages site is public on every GitHub plan except Enterprise Cloud, where it can be limited to people with access to the repository. So CI publishes to Pages only for a **public** repository. For a private one, the comment links to the run, and the report is in the run's `eval-report` artifact, which only people with access to the repository can download. If the organization is on Enterprise Cloud with Pages visibility set to private, or the user accepts a public page, set `EVAL_REPORT_PAGES: always` on the report step. Ask the user; never set it on your own.

For a public repository, the report is published to the `gh-pages` branch. Check whether Pages is on:

```bash
gh api repos/{owner}/{repo}/pages
```

If not, tell the user that it needs turning on once, after the first run has created the branch: Settings → Pages → Deploy from a branch → `gh-pages`. Until then the job summary and the `eval-report` artifact still have the report. PRs from forks get the job summary and the artifact only, because their token cannot push or comment.

## 5. Hand over

Open a PR with the change, following the repository's own rules. Tell the user:

- what was added or changed
- the secrets to add, if any
- whether Pages needs turning on
- that the PR itself shows the first report, if it touches the eval paths

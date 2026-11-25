---
name: eval-report-install-ci
description: Set up eval-report on GitHub Actions, so every pull request gets an HTML eval report linked at the top of its description and in one comment, built by a script without model tokens. Adds it to the existing eval job, or proposes a lean eval job of its own. Needs the eval-report skill installed next to it.
argument-hint: "[notes, such as which workflow or which secrets the evals need]"
disable-model-invocation: true
---

# Install eval-report on CI

The scripts are in the `eval-report` skill, next to this one: `<skills>/eval-report/scripts/`. Read `<skills>/eval-report/SKILL.md` and its `reference/input-format.md` first. On CI nothing calls a model except the evals themselves: the report is built, published and linked by `eval-report.mjs`.

## 1. Make the evals write runs

Do step 1 of `eval-report`'s **Set up** if it isn't done: the runner writes runs to `EVAL_REPORT_FILE`, and `.eval-report.json` names the command and the eval globs. Run `/eval-report` once locally if the evals can run here, to see a report before CI does.

## 2. Copy the scripts into the repository

CI can't rely on the skill being installed, so copy `<skills>/eval-report/scripts/` (the folder, with `lib/` and `assets/`) to `.github/eval-report/`. They are plain Node with no dependencies. Say in the PR that updating them means copying them again.

## 3. Add it to the workflow

Look through `.github/workflows/` for a job that runs the evals.

**There is one.** Change it as little as possible:

- `actions/checkout` gets `fetch-depth: 0`.
- The step that runs the evals runs them through the script instead: `node .github/eval-report/eval-report.mjs run --scope pr`, keeping the step's `env`. With `.eval-report.json`'s `command` set to what the step ran before, the evals run exactly as they did.
- After it, the publish and upload steps from `<skills>/eval-report/templates/eval-report.yml`, both `if: always()`, so failing evals still get a report.
- The workflow, or the job, gets `permissions: contents: write, pull-requests: write`.

If the job runs evals in several shards, have each write its own results (`EVAL_REPORT_FILE` per shard, uploaded as artifacts), then one job after them concatenates the files and runs `eval-report.mjs build --results <all> --scope pr` and `publish --pages`.

**There is none.** Don't add one yet. Propose a separate workflow, `.github/workflows/evals.yml`, based on `templates/eval-report.yml`, and show the user:

- the `paths` it runs on: the eval files and what they test (prompts, tools, the agent loop), never the whole repository, since every run costs model calls;
- the setup steps copied from the repository's other workflows (runtime, package manager, install);
- the secrets the evals need, which the user adds in the repository's settings;
- `--scope pr` (all evals, changes marked) or `--scope pr --only` (only changed eval files: cheaper, but misses an eval broken by a prompt change).

Write it once they agree.

## 4. Hosting

`publish --pages` commits each report to the `gh-pages` branch under `eval-reports/pr-<number>/` and links `https://<owner>.github.io/<repo>/eval-reports/pr-<number>/`. GitHub Pages must serve the `gh-pages` branch: Settings → Pages → Deploy from a branch → `gh-pages`, `/ (root)`. That is the user's change to make, and on a private repository the pages may be public depending on the plan: say so and let them decide. Without Pages, drop `--pages` and pass `--url` to the run's artifact page instead; the report is then a zip download.

Fork PRs get no write token, so the publish step skips them; the uploaded artifact still has the report.

## 5. Hand over

Open a PR with the changes. Say what runs when, what it costs (the evals only), and what the user still has to do: secrets, and turning on Pages.

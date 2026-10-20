# PR mode

Read this when the arguments start with `pr`, or are a PR number or URL, or when the user asks for a walkthrough of a pull request or branch. It replaces steps 1 and 2 of `SKILL.md`. Steps 0, 3, 4, 5 and 6 still apply, with the additions below.

The audience is a reviewer, or a teammate who must understand the change. Organise the deck around the **changes**, the way the repo deck is organised around features. For each change, show it running, then how it works underneath, then the code that changed. Give only as much of the existing system as is needed to follow the change.

## P0. Find the PR and check it out
Accepted forms: `pr 123`, `pr https://github.com/o/r/pull/123`, `pr feature/x` (a branch), or `pr` alone (the current branch against the default branch).

- GitHub: `gh pr view <n> --json number,title,body,author,url,baseRefName,headRefName,headRefOid,additions,deletions,changedFiles,commits,closingIssuesReferences,reviewDecision`. Read the linked issues with `gh issue view`. For GitLab, use `glab mr view` the same way. With no CLI, use a branch and `git`.
- Never touch the user's working tree, and never `git checkout` in it. Use worktrees under `<work>`:
  - Head: `git fetch origin pull/<n>/head` (GitHub; this works for forks too), then `git worktree add --detach <work>/head FETCH_HEAD`. For a local branch, `git worktree add --detach <work>/head <branch>`.
  - Base: `git worktree add --detach <work>/base $(git merge-base origin/<base> <head-sha>)`. That is the code the PR started from, so before/after comparisons are fair.
  - When you're done: `git worktree remove <work>/head` and `<work>/base`.
- Read-only toward the PR: don't comment, review, approve, push or change labels. The deck is the output. If you find problems, put them on the review slide and tell the user.

## P1. Survey
From the repo root, run `bash <skill-dir>/scripts/pr-stats.sh <merge-base-or-base-ref> <head-sha>`. It prints the commits, the files by status, the lines added and removed (production, tests, fixtures), the production lines per package, and every changed file with its +/−.

Then read, delegating to a subagent if the diff is large:
- The PR description, the linked issues and the commit messages: the problem, the goal, and what the author says is out of scope.
- The full diff (`git diff <merge-base> <head>`), and the **whole** changed files in `<work>/head`, not only the hunks. Read the callers and callees of the changed code in the head worktree. That is the context a reviewer needs.
- When you run it, compare the result with what the description claims (its smoke tests, its numbers). A difference is a finding for the review slide even when the code is right.
- Group the changes into 2–6 **changes** a reviewer can name ("new rule editor", "retry on 429", "schema: add due_date"). One change usually spans several files and packages. Note which files belong to which change. Leftovers (renames, formatting, dependency bumps) go into one "other changes" slide.
- For each change: what the user can now do or see; the flow before and after (the calls across components); new or changed types, schemas, migrations, API routes, config and env vars; the tests that cover it.
- What the PR claims but the diff doesn't show, and the reverse. Report both and don't paper over them.
- Risks: behaviour changes for existing users, data migrations, backward compatibility, security (auth, input handling, secrets), performance, error paths without tests. Each risk must point at a file and line in the head.

## P2. Outline (show the user before building; if they asked you to just build it, post the outline and continue)
Size: about 1 slide per 40–80 changed production lines. Usually 15–35 slides; never pad.

1. **Intro:**
   - Cover: PR title, `#n`, author, `base ← head`, `+a −d` in N files, head commit.
   - Why: the problem and the goal in one sentence plus 3 points, from the description and the issue.
   - The changes at a glance: the 2–6 changes, one line each. This is the agenda.
2. **Context:** only what is needed to follow the change.
   - The component diagram, with the touched components highlighted.
   - The existing flow or state machine the PR changes, as it was on the base.
   - The change map: `pr-stats.sh` output as +/− bars per package, with production, tests and fixtures split.
3. **Changes**, for each change N:
   - `cNa` running: before/after screenshots side by side, from base and head. For a change with no UI, show real output from both runs (CLI, API response, log, test output).
   - `cNb` under the hood: a sequence, state or component diagram with the new or changed parts highlighted, plus a key-files grid with status (new, modified, deleted) and +/− per file.
   - `cNc` code: two panels. Prefer a **diff panel** (`diff: true`) for a changed function, and a plain panel of the new type or schema next to it. Before/after panels work when the diff would be unreadable.
   - Optional `cNd` for a second code slide.
4. **Contracts:** API, schema and migration changes; new config or env vars; breaking changes and how existing data or clients are handled. One or two slides, each followed by a code slide.
5. **Tests:** what was added or changed and what it covers, with a code slide (a test plus the fixture or fake it uses). Then the **real result of running the tests on the head** (the command and summary output as a panel), and what is not covered.
6. **Review:**
   - Risks and the places to look, each with `file:line`.
   - Open questions for the author.
   - The gap between the description and the diff.
   - How to try it locally (the exact commands you used).

Every slide that lists files is still followed by a code slide. Code panels show the **head** version unless they are diffs or "before" panels; label "before" panels with the base commit.

## P3. Run both versions (additions to step 3)
- Run the head **and** the base. Each runs from its own worktree, with its own dependency install, its own port and its own throwaway database or data directory. Never point both at one database: the head's migrations would change the base's data.
- Seed both with the same demo data, then take the same shots from both. Name them `base-<name>.png` and `head-<name>.png`, and pass the worktree as `repo-dir` to `shoot.mjs` so `manifest.json` records each commit.
- Shoot the screens the change touches, plus one unchanged neighbouring screen if it helps to place them. If the change adds a flow, use `steps` in `shots.json` to walk through it on the head and shoot each step.
- A change with no UI (an API, a worker, a cron) is run the same way: drive it with the PR's own fixtures and scripts, put a small local stub in place of every external service it calls (never the real one), and show the stub's record of what it received. Use made-up secrets in a local env file inside the worktree.
- Run the test suite in the head worktree, and keep the command and the summary for the tests slide. If a test fails, say so on the slide and to the user. Don't fix the PR.
- If the base can't be run (it needs services the head added, or it is broken), show the head only, and say so in the speaker notes and the hand-off.

## P4. Hand-off (additions to step 6)
- The PR number, the base and head commits, and the commits each set of screenshots came from.
- The test command and its result on the head.
- The risks and questions from the review slide, in a few lines, so the user can act without opening the deck.
- Confirm that the worktrees are removed and the servers are stopped.

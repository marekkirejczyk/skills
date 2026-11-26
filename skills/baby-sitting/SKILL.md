---
name: baby-sitting
description: Baby-sit the current branch's pull request until it is merged. With nothing or manual it keeps the PR rebased, green and answered, working through the review bot's comments you pick, and leaves the merge to you; with auto it turns on GitHub auto-merge.
argument-hint: "[manual | auto]"
disable-model-invocation: true
---

# Baby-sitting

Watches the current branch's open pull request on GitHub and handles what happens to it, until it is merged. Arguments: `$ARGUMENTS`. If your agent does not fill that in, take them from the user's message.

The one argument is the **mode**: `manual` (the default) or `auto`. Anything else: say so and stop.

- **manual**: the PR stays rebased on its base, green and answered, and the developer merges it.
- **auto**: GitHub merges the PR once its checks are green and its required approvals are in. The review bot's comments are left alone.

The scripts are in `scripts/` next to this file; `<skill-dir>` below is this file's directory. They need `gh` (signed in), `jq` and `perl`. Run every command in the checkout that holds the branch.

## Start

1. Read the PR: `gh pr view --json number,url,isDraft,baseRefName`. With no open PR, say so and stop. A draft can't merge and review bots skip it: `gh pr ready <n>`, and say you did.
2. Name the **review bot**. It is CodeRabbit unless the repository's instructions name another: then `export REVIEW_BOT=<a pattern its login matches>` and `REVIEW_BOT_CHECK=<its check's name on a PR>` in every call of a script. A repository with no review bot: `export REVIEW_BOT=none`.
3. In auto mode, turn on auto-merge with a method the repository allows (`gh repo view --json squashMergeAllowed,mergeCommitAllowed,rebaseMergeAllowed`; squash when it is allowed): `gh pr merge <n> --auto --squash`. If GitHub answers that the PR is already clean to merge, it is green and approved: merge it (`gh pr merge <n> --squash`), report, and stop. Any other refusal: tell the developer, and carry on as manual.
4. Watch.

## Watching

Run `<skill-dir>/scripts/watch.sh <n> <mode>` as a **background** command, say in one line what the PR is waiting for, and end your message: your harness wakes you when the script exits. It polls GitHub every 20 seconds and exits on the first event. Line 1 of its output is the event, with how long it waited; line 2 is every check and its state. Handle the event as the table says, then watch again unless the row says stop.

| Event | What to do |
| --- | --- |
| `merged` | Report, and stop. |
| `closed` | Report, and stop. |
| `conflict` | Rebase, then ship. |
| `red <checks>` | Read the failure (`gh pr checks <n>`, then `gh run view <run> --log-failed`; a deploy check links its own build log), fix it, ship. The same check red twice running: ask the developer, and stop. |
| `threads <n>` | Manual only. Run a review round. |
| `behind <n>` | The base has moved on. Rebase, then ship. |
| `ready` | Manual only. Read the bot's review bodies (review round, step 1): a comment there that needs an answer starts a round. With none, tick "Ready to merge" in the block, report, and watch with `--ready` as the third argument, which lasts 4 hours. |
| `unreviewed` | Manual only: green, but the bot's check is skipped, failed or missing. If the bot takes a request by comment and this PR has none yet, post one (CodeRabbit: `gh pr comment <n> --body "@coderabbitai review"`) and watch again. Otherwise the bot isn't coming: handle it as `ready`, and say so in the report. |
| `auto-merge-on` | Manual only. Someone turned auto-merge on, and manual means the developer merges: `gh pr merge <n> --disable-auto`, and say so in the report. |
| `review-needed` | Auto only. Tell the developer whose approval the PR waits for (its code owners, or any teammate), then watch with `--ready`. |
| `auto-merge-off` | Auto only. Turn it on again (Start, step 3). A second time before anything else happened, something keeps withdrawing it: read why (`gh pr view <n> --json autoMergeRequest,mergeStateStatus,reviewDecision`), report, and stop. |
| `error <why>` | GitHub could not be read. Report why, and stop. |
| `timeout` | Report what the PR was still waiting for, and stop. |

In manual mode the branch is rebased each time the base has moved and the PR's checks are done, so what the developer merges was checked on today's base. In auto mode `behind` comes only when GitHub refuses to merge a branch that is behind its base.

Without a background mode, run the script in the foreground with the longest timeout your shell tool allows, and run it again when it is cut off.

## Rebase

1. `git fetch origin <base> && git rebase origin/<base>`.
2. Resolve each conflict so both changes keep their intent: read what the base's side did (`git log -p -3 origin/<base> -- <file>`) before choosing. A lockfile: take the base's, then reinstall with the repository's package manager.
3. Follow what the repository's instructions say about files that need care after a rebase, such as database migrations whose order matters.
4. Ship, pushing with `git push --force-with-lease`.

## Shipping

Every push goes out this way:

1. Run what the repository asks for before a push: its `AGENTS.md`, `CLAUDE.md` or `CONTRIBUTING.md` says (formatting, lint, tests, a review step). Where nothing is written, run what the PR's required checks run.
2. Fix what failed and run it again, until it is green. Commit what the checks themselves changed.
3. `git push`.

## Review round

1. Collect what needs an answer, and read each item against the current code:
   - `<skill-dir>/scripts/threads.sh <n>`: the open threads where the bot spoke last, one JSON object per line.
   - The comments inside the bot's review bodies that have no thread of their own, such as nitpicks and comments outside the diff: `gh api "repos/{owner}/{repo}/pulls/<n>/reviews" --jq '.[] | select(.user.login | test("<bot pattern>"; "i")) | .body'`.
2. Show the developer one numbered **pick**, then end your message with no watcher running. Each item: number, `file:line`, the comment in one sentence, and your verdict with its reason: fix, push back, or already done. They answer "all", "all but 3", "1, 2, 5" or "recommended". Act on exactly that.
3. Fix the picked items in one commit whose message lists them, then ship.
4. Answer every thread, with its `comment` id: `gh api "repos/{owner}/{repo}/pulls/<n>/comments/<comment>/replies" -f body=...`.
   - Fixed: "Fixed in `<sha>`: <one line>", then resolve it: `gh api graphql -f query='mutation($id:ID!){resolveReviewThread(input:{threadId:$id}){thread{isResolved}}}' -F id=<thread>`.
   - Already done: "Already fixed in `<sha>`", and resolve it.
   - Pushed back or not picked: one or two sentences why. Leave it open for the bot to answer.
5. Write the round into the block's "Review bot" line: what was fixed and in which commit, what was pushed back, and what the developer skipped and why.

The round is done when every collected thread has a reply. The bot may review the new commits or answer a push-back; that arrives as a new `threads` event and gets its own round.

## The block

The PR's description carries one block, between `<!-- baby-sitting -->` and `<!-- /baby-sitting -->`, that records what was done, so a reviewer and another session can see it. Where the description has no block yet, write it the first time a line has something to say: pipe the block, without the two markers, to `<skill-dir>/scripts/block.sh <n>`, which appends it. Where it has one (the `finish-pr` skill opens the PR with it, or an earlier session wrote it), keep its other lines: tick a line and reword it with `<skill-dir>/scripts/block.sh <n> tick "<how the line starts>" "<its new text>"`. The rest of the description stays as it is.

```markdown
### Baby-sitting

- [x] Review bot: fixed 1, 3 in `0a1b2c3`; pushed back on 2
- [ ] Ready to merge
```

## Report

On `ready`, and whenever the table says stop: the PR's URL, what each event you handled came to in one line, the checks as line 2 last gave them, and what waits on someone else (an approval, the bot's answer to a push-back). Then run `<skill-dir>/scripts/board.sh` and show its table as it is: where each of the developer's open PRs stands.

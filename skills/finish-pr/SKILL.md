---
name: finish-pr
description: Finish the current branch's pull request. It reviews the change in sub-agents and fixes what is worth fixing, pushes it with a description, lists its links and the files its code owners must review, then baby-sits it. With nothing or manual it leaves the PR ready for you to merge; with auto it merges once green.
argument-hint: "[manual | auto]"
disable-model-invocation: true
---

# Finish PR

Takes the work on the current branch from "it works" to a reviewed, described, pushed pull request on GitHub, and hands it to the `baby-sitting` skill. Arguments: `$ARGUMENTS`. If your agent does not fill that in, take them from the user's message.

The one argument is the **mode**: `manual` (the default) or `auto`. Anything else: say so and stop.

The scripts are in `scripts/` next to this file; `<skill-dir>` below is this file's directory, and `<baby-dir>` is the `baby-sitting` skill's, its sibling (`<skill-dir>/../baby-sitting`). If that skill isn't installed, say so and stop. The scripts need `gh` (signed in), `jq` and `git`. Run every command in the checkout that holds the branch.

It has to be **fast**. Where a step says "in one message", send those calls together so they run side by side, and use the scripts as given: each replaces several calls.

## 1. Status

Run `<skill-dir>/scripts/status.sh`. It fetches the base and prints the branch, its base, its open PR, and what the branch changes.

- A wrong base (a stacked PR with no PR open yet): `git config branch.<branch>.gh-merge-base <base>`, and run it again.
- On the base branch, or nothing ahead of it and nothing uncommitted: there is nothing to finish. Stop. Being behind the base is fine here: baby-sitting rebases.
- `uncommitted` lists files: commit the ones that belong to this work, with a message saying what changed and why, and run `status.sh` again, as `head` and `ui` have changed. Ask about any that don't belong.
- `reviewed: yes`: an earlier run reviewed this head. Go to step 5.

## 2. Self-review

Send all of this in one message:

- Read `<baby-dir>/SKILL.md`: step 4 ships by its "Shipping" section, and step 5 follows the rest.
- Start the checks the repository asks for before a push: its `AGENTS.md`, `CLAUDE.md` or `CONTRIBUTING.md` names them, and where nothing is written, they are what the PR's required checks run. They run while the review does; step 4 needs them again only if step 3 changes something.
- The review's sub-agents, each with a fresh context window. Every brief carries the diff command, `git diff origin/<base>...HEAD`, and this line: "Work in `<checkout path>`: `cd` into it in every call. Read only: change no file, and run no lint or tests, which are running already."
  - **Standards**: "Review this change against the repository's written standards. First find them: `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md`, and the documents they point to that say how code here is written. Report each place the change breaks a written rule, quoting the rule and naming its file. Then, marked as judgement calls, the smells the change adds: a name that doesn't say what it holds, logic written twice, a function that works mostly on another module's data, abstraction nothing asks for yet. A written rule wins over a smell. Skip what the formatter, linter or type checker enforces. Each finding with file:line and a fix. Under 400 words."
  - **Spec**: "Compare this change with what was asked for. The spec: <the ticket, spec file or request this session worked from>. Report what the spec asks for that is missing or partial, behaviour nobody asked for, and requirements that look implemented but wrong, quoting the spec's line for each. Under 400 words." When this session has no spec, tell the sub-agent to look for one instead (an issue or ticket named in the commit messages or the branch, a spec or plan file that matches the feature) and to report "no spec available" if it finds none; nobody is asked for one.
  - **Bugs**: "Hunt for bugs this change introduces: wrong logic, unhandled edge cases (empty, null, missing, repeated or concurrent calls), errors swallowed or logged without the error itself, secrets or personal data reaching logs, and tests that pass without testing the behaviour. Read the surrounding code in this repository, not its dependencies, to confirm each one; report only bugs you can show with a concrete input or sequence, each with file:line, the failure, and a fix. Skip style and anything the linter or type checker catches. Stop after about 12 tool calls and report what you have confirmed. Under 400 words."
  - **Design**, only when status says `ui: yes` and the repository documents its design (a design-system document, a tokens file): "Read the changed UI against <that document>: a value outside its tokens, a component rebuilt by hand where one exists, type or spacing off its scale, a control too small to tap, an accessibility rule it sets. Each finding with file:line and a fix. Under 300 words."

Without sub-agents, review the four axes yourself, one after another, with the same briefs.

Number every finding in one list, each keeping its axis (Standards, Spec, Bugs, Design). A finding is something a sub-agent says should change; a note that something is fine isn't one. Where two axes found the same thing, list it once with both.

## 3. Fix what's worth fixing

Your first message after the review includes `<skill-dir>/scripts/timer.sh lap review`, beside whatever else it does.

You decide; the developer isn't asked. Every finding ends up **fixed** or **left**, with a reason:

- Fix a bug shown with a concrete input or sequence, whichever axis found it, a breach of a written standard, and a requirement the spec asked for and the change misses, when the fix stays inside what this PR already changes or broke (a comment or document that its own move left pointing at the old place counts).
- Leave a bug whose premise the sub-agent could not confirm, a smell that is a judgement call, a fix that would widen the PR, and anything that changes behaviour beyond the spec, the data model, a public interface, or something the repository's instructions keep for a person. Those are the developer's call: they go in the summary.

Commit the fixes, and anything the checks themselves changed, as one commit whose message lists each fix and why, and note its short SHA for the block.

## 4. Ship and open the PR

1. In one message:
   - `<skill-dir>/scripts/timer.sh lap fixes`, and the checks again when step 3 committed anything.
   - Write the PR's description to a file outside the repository, in this order:
     - the repository's own PR template when it has one (`.github/pull_request_template.md`), filled in. Otherwise three sections: **Summary**, what changed and why, with the smallest sketch that makes it clear (a call tree, a file tree, a diff of the shape); **Evidence**, what was run and what it showed, before and after, from what this session already holds; **Risk**, how to undo it and what it could break;
     - any section the repository's instructions require in a PR description;
     - the block, below;
     - any attribution footer, last.
2. Finish Shipping's steps 1 and 2: the checks green, and whatever else the repository requires before a push done.
3. Run `<skill-dir>/scripts/open.sh <base> "<title>" <body-file>`. It pushes and leaves the PR ready for review. With no PR yet it creates one; the title follows the base's history, which status printed under `base history`. A PR that is already open keeps its title and its description, which a reviewer or baby-sitting may have edited: only the block is replaced. Bring by hand what no longer holds there up to date (`gh pr edit <n>`).

The **block** records the review in the description, between its own two markers, each alone on a line. Baby-sitting adds a block of its own beside it later.

```markdown
<!-- finish-pr -->

### Self-review

Reviewed `abc1234`: 5 findings, fixed 1, 2, 4 in `def5678`.

<details><summary>Findings</summary>

1. **Standards** `path:line`: the finding. _Fixed._
2. **Bugs** `path:line`: the finding. _Left: the reason._

</details>
<!-- /finish-pr -->
```

The "Reviewed" line names the commit that was reviewed and the fix commit, and ends "none fixed" or "no findings" when that is so; status reads it on a later run. Every finding is in the details, marked fixed or left with its reason.

## 5. Summary and baby-sitting

Run `<skill-dir>/scripts/summary.sh <n>`. Then, in one message, write the summary first and start `<baby-dir>/SKILL.md` from "Start" in the same mode (the PR is already open and ready).

The summary:

- the PR's link, and its preview links, which answer once their host has built them;
- the evidence: what was run and what it showed, with links to any screenshot files;
- "Code owners' files" as the script lists them, links included: the files a code owner has to review. With none, say so;
- the self-review: what was fixed, and what was left and why;
- the script's `Timing` line.

---
name: make-code-readable-again
description: Make a scope readable end to end by running refactor-tests, dont-repeat-yourself and self-documented-code on it, in rounds, until a round changes nothing. Run it with what to clean up, such as a path or a PR.
argument-hint: "[repository | pr <number|url|branch> | path | concept]"
disable-model-invocation: true
---

# Make code readable again

Run the three readability skills on one scope, in order, in rounds, until the code stops improving. Arguments: `$ARGUMENTS`. If your agent does not fill that in, take them from the user's message.

The **scope** is what the user names: the repository, a PR or branch, a directory, a file, a module, or a concept. With no scope given, use the whole repository. Every skill in a round gets this same scope.

## The round

Each round runs the three skills, each from its own `SKILL.md` next to this folder, each in full:

| order | skill | why here |
| --- | --- | --- |
| 1 | `refactor-tests` | Fast, trustworthy tests first: they are the safety net every later change leans on. |
| 2 | `dont-repeat-yourself` | One implementation per concept, while the tests are fresh: structure settles before names do. |
| 3 | `self-documented-code` | Names and comments last, so they land on the final structure and nothing renamed gets dissolved. |

Rules that hold across the whole run:

- **Each skill runs by its own rules.** Its goal, its rounds, its checks, its report. This skill adds nothing to them and skips nothing in them.
- **Green between skills.** A skill starts only when lint, type checks and tests pass. If they fail before the first round, stop and report it, as `self-documented-code` rule 2 says.
- **One branch.** All rounds commit to the same branch, each skill's work in its own commits, so the PR tells the story skill by skill.
- **Decisions queue up.** Where a skill would ask the user (phase 2 of `dont-repeat-yourself`), collect the questions and ask them once, at the end of the round, together.

## Stop

After each round, compare the scope with the round's start. Stop when a round changes nothing, and after **three rounds** at most. One round is usually enough; a second pays off when `dont-repeat-yourself` extracted modules whose tests and names the first round never saw.

## Report

After the last round, one report:

- Per skill, per round: its own report's headline numbers (test speed before and after, clusters extracted, names renamed and comments deleted).
- The questions queued for the user, if any remain.
- What still reads badly and why it was left (out of scope, external contract, behaviour change).

**Pace yourself and the user:** on a large codebase a full run takes hours. Run it once over the whole repository, then on each PR (`/make-code-readable-again pr <number>`), so the codebase never slides back.

---
name: refactor-evals
description: Bring an eval suite's cases up to written rules. Bundled cases are split to one requirement each, duplicates merged, every check moved to the cheapest grader that can decide it, and every failing or unsteady case diagnosed. Run it with what to refactor, such as a file, a PR or `failing`.
argument-hint: "[suite | pr <number|url|branch> | path | failing]"
disable-model-invocation: true
---

# Refactor evals

Bring the eval cases in a scope up to the rules below. Arguments: `$ARGUMENTS`. If your agent does not fill that in, take them from the user's message.

The **scope** is what the user names: the whole suite, a PR or branch's cases, a file or folder of cases, or `failing` (the cases red or marked in the latest run). With no scope given, use the whole suite.

Start by learning the suite: read its README, its case format, its runner and one case file, and map this skill's words onto the project's. Where the project has written its own eval rules, those win, and the conflict goes in the report. An example in its README is not a rule.

Change only the cases in scope, plus the suite's shared files (its list for every reply, shared fixtures) when a move needs them. Search the whole suite for duplicates of what is in scope, and report those outside it.

## Why

A suite is worth running only while a red case means one known thing broke and a green case means its requirement held. Three things wear that away:

- **Bundles.** A case holding several requirements fails more often than any of them: 17 checks that each hold 98% of the time pass together 71% of the time. Its failure doesn't say which requirement broke, and one mark on it silences them all.
- **Duplicates.** A requirement held by several cases costs model calls on every run, and a change to it has to be found in every copy.
- **Checks at the wrong grader.** A pattern that guesses at meaning fails good replies. A judge asked what code could decide costs a call and adds its own variance.

## Words

- **Subject**: the agent or prompt the evals test.
- **Requirement**: one obligation from the product's sources (a spec, the system prompt, a policy) that the subject can break while keeping every other. A sentence that can be half kept is two requirements.
- **Scenario**: the situation a case puts the subject in: its input and the fixtures the requirement depends on. Two situations are one scenario when the requirement reads the same in both: the same branch of it applies, and it predicts the same reply. Two cars or four, a link or a tick, are different scenarios only for a requirement that names the difference.
- **Case**: one scenario with its expectations.
- **Check**: an expectation code decides. **Judge statement**: one a model decides. Both are **expectations**.
- **Mark**: what lets a case fail without failing the run (a known bug, a skip, an expected failure).
- **Trial**: one run of a case against the subject.
- **Good reply**, **bad reply**: replies you write by hand, one keeping a requirement and one breaking it. They go **green** and **red** in **Proof**.

## Goal

You are done when all five hold:

1. **Every case holds one requirement**, cited by its source and section, and every expectation in the case traces to it or is listed in **Ask**.
2. **Every requirement is held once per scenario.** No two cases share both.
3. **Every expectation is at the cheapest grader that can decide it**: code first, then the judge.
4. **Nothing is lost.** Every pair of requirement and scenario held before is held after, or the user decided to drop it.
5. **Every red is explained.** Each failing or unsteady case in scope has a verdict from **A red case**.

Then the project's format, lint and test commands pass, and every changed case passes every trial or carries a mark.

## The ledger

Before the first change, write the **ledger** in your working notes: one row per expectation in scope.

| Requirement (source, section) | Scenario | Grader | Case | Where |
| --- | --- | --- | --- | --- |

Write "none found" for an expectation no source backs. Leave out what the runner adds to every case by itself. Then sort by requirement and scenario. The ledger finds the work:

- A case whose rows name more than one requirement: **Split**.
- A requirement and scenario held by more than one case: **Merge**.
- One expectation repeated across cases, about every reply and not about their requirements: **Hoist**.
- An expectation about what code decides, with nothing left to the model: **Push down**.
- A row with "none found": **Trace**.

At the end, rebuild the ledger from the files and compare it with the first one, pair by pair. That comparison is goal 4.

## Rules

`examples.md`, next to this file, shows each rule broken and kept. Read it before your first round.

**Cases**

1. **One requirement per case.** The name states the behaviour a reader would observe. A name that needs "and" is two cases. Names are unique across the suite.
2. **The case cites its requirement**: the source and its section, in the field the project has for it.
3. **A case asks what its requirement asks, and no more.** Two people who read the requirement would give any reply the same verdict.
4. **The shortest scenario that reaches the requirement.** Earlier turns are there only when the requirement depends on them. An earlier turn carries at most a **precondition**: one check that the scenario was reached (the list the next turn refers to was shown). A failed precondition is a case that didn't reach its requirement, never the requirement failing.
5. **Both sides of a boundary.** A requirement with a condition ("only after", "unless") has a case on each side, and each name says which side.
6. **Invented data.** No real person's words, names or records.

**Checks**

7. **Code decides what code can**: how the reply ended, which tools ran and with what, what was shown, a literal, a count.
8. **A must-say pattern is a literal the reply has to carry**: a price, a date, a name from a fixture. A list of synonyms is a judge statement.
9. **A must-never-say pattern is a literal no good reply contains.** When a refusal or a negation can contain it ("I can't guarantee a date"), it is a judge statement. The exception is a requirement that bans the word itself.
10. **Grade the outcome.** Expect a tool call only when the requirement is that it runs, with only the arguments the requirement names, and in an order only when the order is the requirement. Any other expectation about calls is one for **Trace**.
11. **What holds for every reply is written once**, in the suite's list for every reply.
12. **Each fact is checked once in a case**, by the cheaper grader that decides it.

**Judge statements**

13. **One fact per statement.** It is two facts when a reply can make one half true and the other false. "A or B" appears only when the requirement itself gives the alternatives.
14. **Checkable from the transcript alone**, in plain words, saying what the reply does.

**Marks**

15. **A mark's note says** which expectation fails, what the reply did instead, how often (k of n trials), since when, and its ticket where the project has one.
16. **A mark comes off with the fix**: when the cause its note names is gone and the case passes 5 of 5. A clean run alone only adds "not reproduced, 5 of 5" and the date to the note: a case that fails one time in six passes 5 of 5 four times in ten.

**Changing an expectation**

17. **An expectation changes only on proof**: a good reply fails it, or a bad reply passes it. A case that is red because the subject broke its requirement stays as written.

## Moves

- **Split.** A case holding several requirements becomes one case per requirement on the same scenario. Each expectation goes to the case whose requirement it traces to.
- **Merge.** Cases holding one requirement in one scenario become one: keep the shorter scenario and the union of what their expectations catch. Cases that share a requirement across different scenarios both stay, and their names say what differs. When you can't tell whether the scenarios differ, leave both and take them to **Ask**. Split first: two bundles that each hold "offers nothing for sale" in the same scenario only show as duplicates once they are apart.
- **Hoist.** An expectation repeated across cases that holds for every reply moves to the suite's list for every reply and leaves the cases.
- **Push down.** An expectation about what code decides (a tool's result, a card the code builds) moves to a unit test of that code. The eval keeps what the model does with it.
- **Regrade.** A judge statement code can decide becomes a check (rule 7). A pattern that guesses at meaning becomes a judge statement (rules 8 and 9).
- **Trace.** For an expectation with no requirement, search the sources. Found: it gets its own case citing it, in a scenario where the requirement applies. Not found: it stays, in the first case a split of its case makes, and goes to **Ask**.
- **Pair.** A boundary with one side covered gets the other side's case when the source states both sides. Otherwise report the gap.
- **Shorten.** Cut the turns the requirement doesn't depend on.

## Proof

**Both ways.** Every expectation you write, reword, or rely on to remove another is shown green on a good reply and red on a bad reply. An expectation moved unchanged needs none. Write the two replies in the shape the runner grades (the words, the tools run, what was shown), and grade them with the project's own check function and judge from a scratch file you never commit. This calls the judge at most; the subject isn't needed. For a must-never-say pattern, the good reply contains the innocent use: a refusal that names the thing.

**Removal.** A case or an expectation goes only when, for each requirement it held, a remaining expectation is red on that requirement's bad reply.

When the runner can't grade a reply you give it, or there is no key for the judge, that is a finding (`harness.md`). Until it can, prove by reading each expectation against the two replies, and say so in the report.

## Trials

The subject answers differently each time, so one pass proves little.

- **Baseline.** Before the first round, run every case in scope for 3 trials with retries off, and record k of 3 for each, keeping each trial's transcript. Say first how many subject calls that makes: the turns in scope × 3. Use the runner's own options for trials, retries and choosing cases. Where it has none, run its command 3 times and count first tries only, and report the lack as a finding.
- **After the last round**, do the same for every case you changed or created.
- **Steady** is 3 of 3. A case steady at baseline is steady after, or the round that changed it is undone.
- **Parts of a split** are judged on their own: the steady parts carry no mark, and a red or unsteady part gets a verdict from **A red case**.

A split multiplies subject calls. Report the case count and the calls per run, before and after.

With no key for the subject's model, make the moves **Proof** covers without it and report the trials as not run.

## A red case

Read the transcript before anything else: the baseline's, or the latest report's. A mark's note is not a transcript. Then give each failing expectation one verdict:

| Verdict | The transcript shows | What you do |
| --- | --- | --- |
| **Harness** | A model error, a timeout, a judge's answer that couldn't be read | Run it again. If it repeats, report it as a finding (`harness.md`) |
| **Case** | A reply that keeps the requirement and still fails: the case asks more than the requirement, a pattern catches a good reply, a fixture is wrong | Fix the case under rule 17, and say why in the commit |
| **Subject** | A reply that breaks the requirement | Leave the case as written and report it with the transcript. Mark it (rule 15) only if it was already red at baseline |
| **Requirement** | Sources that are unclear, contradict each other, or say nothing of the failing expectation | **Ask** |

A case at 0 of n is suspect before the subject is: look for a fixture typo or an expectation no reply could meet. For an unsteady case, read the failing trials, name the expectation that fails, and give the verdict for that one.

## Rounds

Work on a new branch, in **rounds**: one move on one case or one cluster, then the project's checks that need no model (the case schema, lint, unit tests), then a commit. Leave the branch unpushed.

Order: the baseline, the ledger, verdicts for red cases, Trace, Split, Merge, Hoist, Regrade, Pair and Shorten, then the trials.

The runner and the fake world have their own rules in `harness.md`. Read it when the scope is the whole suite or includes the runner's files, or when a move needs something the runner can't do. When a rule needs a kind of expectation the case format lacks (the order of calls, a call that must never carry an argument), write the nearest the format has and report the lack as a finding.

## Ask

Run everything above without asking. Then present these in one batch, numbered, each with its cases as `file:line` and your recommendation:

- an expectation no source backs: add the requirement to the sources, or drop it
- a merge where the scenarios may differ in a way that matters
- a requirement that is unclear or contradicted
- a harness finding marked **ask** in `harness.md`

Apply the answers in the same session, one commit each. What the user doesn't answer stays as it is.

## Report

- Cases before and after, and subject calls per run before and after.
- Each move made: cases split, merged and removed, expectations hoisted and regraded.
- The trials: k of n per changed case, before and after, or that they weren't run.
- Each red case with its verdict, and each mark added, rewritten or removed.
- Subject failures, each with its requirement and transcript.
- Gaps: boundaries with one side, a cited requirement with no expectation, tool outcomes with no case, marks with no ticket, harness findings.
- What was proved by reading instead of by grading.

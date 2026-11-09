---
name: dont-repeat-yourself
description: Find every concept implemented more than once in a scope (a repository, a PR, a directory, a concept) and give it one well-tested implementation. Identical copies are extracted automatically; behaviour differences and high-stakes code are brought to you for a decision at the end.
argument-hint: "[repository | pr <number|url|branch> | path | concept]"
disable-model-invocation: true
---

# Don't repeat yourself

Find every concept implemented more than once in a scope and give it one well-tested implementation. Arguments: `$ARGUMENTS`. If your agent does not fill that in, take them from the user's message.

The **scope** is what the user names: the repository, a PR or branch, a directory, a file, a module, or a concept ("everything about dates"). With no scope given, use the whole repository.

For a PR, compare its new code against the whole repository:

- A helper already exists: the PR's code reuses it.
- The PR adds a second copy and no helper exists: extract it and replace both copies, even if the older one is outside the PR.
- Other copies outside the PR: report them and leave them.

Run phase 1 from start to finish without asking for approval. Phase 2 is the only time you ask the user anything.

## Goal

Each concept has one implementation, so a change to it is a change in one place.

You are done when all of these hold:

1. **Every unit in scope is inventoried**, and every cluster of copies has been compared.
2. **Every cluster is resolved:** extracted, left for a stated reason, or decided by the user.
3. **Every extraction is complete:** all its call sites use the shared code, and the old copies are gone.
4. **Helpers live together:** the local helpers on a shared module's subject have moved into it.

## What counts as a duplicate

A **cluster** is two or more implementations of one concept. Look for the intention, not matching text: three ways of writing "today / yesterday / a minute ago" are one cluster. Inline blocks count as well as named helpers, and so do route types that describe the same contract.

- **Non-trivial logic:** two copies are enough.
- **A one- or two-line expression:** three or more copies.
- **A pure pass-through wrapper** is a duplicate of what it wraps: remove it and call the wrapped code directly.

Work mainly within one layer. Across layers, extract only pure functions, placed where the project's dependency rules allow. Other cross-layer duplication is report-only, because the fix is moving a rule, which is a different change.

## Rules

These hold after every round. A round that breaks one is undone.

1. **Semantics stay the same**, except where the user approves unifying a behaviour in phase 2.
2. **Lint, type checks, build and tests pass**, using the project's own commands. They must pass before you start: if they fail, stop and report it.
3. **Callers' tests stay as they are**, except for shared test helpers and fixtures, and expected values in a unification the user approved. Expected values stay written out in each test.
4. **External contracts keep working:** published package exports, public API routes and fields, database tables and columns, serialized keys, event names, environment variables, config keys and CLI flags. A replaced published helper stays as a thin export of the new one.

## Identical behaviour

Copies are identical only if you have compared every branch and found the same result for each of:

- boundaries, rounding and units
- empty, null and invalid input
- time zones, locale and text
- errors thrown or swallowed
- side effects, their order, and logging

Any difference, however small, means the cluster goes to phase 2.

## Extractions

- A **pure function** wherever possible, named for its concept.
- In the **nearest existing module for that subject**, or a new module named for the subject when none fits. Generic `utils` or `helpers` modules are never the destination.
- With **its own test file**, using examples taken from every former call site, written before the call sites move. Those examples prove each site's nuances survived.

## Moving helpers together

When an extraction creates or extends a module, look through every file that extraction touched. Move local helpers about the module's subject into it, even those with a single caller. A helper bound to its caller's private state stays, and so do helpers on other subjects.

A move is phase 1 work, in its own commit, separate from the extraction. Existing tests move with the helper. Add direct tests for a non-trivial helper that has none.

## Phase 1: extract what is safe

1. **Baseline.** On a new branch, run lint, type checks, build and tests, and record the results. Done when all pass.
2. **Inventory.** Write one line of intent for every function, type and notable inline block in scope, grouped by layer. Use a subagent per layer where your agent has them. Done when every unit in scope has a line.
3. **Cluster.** Compare intents within each layer, then pure functions across layers. For each cluster, list its call sites and every behavioural difference. Sort each cluster into one of:
   - **Extract now:** clearly one concept, behaviour identical, outside high-stakes code.
   - **Ask:** any behavioural difference; copies that match but may be separate concepts (a request type and a database row type); or anything in high-stakes code, even when identical: money, auth and permissions, data migrations, concurrency or locking.
   - **Report only:** cross-layer duplication that isn't a shareable pure function.
4. **Extract in rounds.** One cluster per round: tests first, then the shared code, then every call site, then delete the old copies. Run the checks and commit. If a check goes red, undo the round and move the cluster to Ask. Leave the branch unpushed. Done when every Extract now cluster is applied.
5. **Move helpers**, as above.
6. **Sweep.** Search the scope again for each extracted concept. Done when no copy remains and all checks pass.

## Phase 2: ask

Present every Ask cluster in one batch, as numbered items, each with:

- the call sites, as `file:line`
- the shared intention
- every exact difference
- the proposed function signature
- your recommendation: **unify** on one behaviour (say which), **keep the differences** as options, or **leave separate**

Recommend leaving separate when keeping the differences would take more than 2–3 options.

Apply the user's answers in the same session, one commit per cluster, under the same rules and test-first order. A cluster the user does not answer stays as it is.

## Report

- Clusters extracted, helpers moved, wrappers removed, and copies deleted.
- Decisions the user made, and every caller whose behaviour changed because of one.
- Clusters left, and why.
- Report-only cross-layer duplication, and copies outside a PR scope.
- Check results before and after.

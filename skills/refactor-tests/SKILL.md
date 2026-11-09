---
name: refactor-tests
description: Bring a file, class or branch's tests up to the rules for each test type, and cover every case. Run it with what to refactor, such as a file or a PR.
disable-model-invocation: true
---

# Refactor tests

Each **test type** has its own file next to this one: what the type checks, its rules, the cases it must cover, how its tests are named, and the shape of one. Find the type of each test in scope, read its file, and apply every rule in it.

| Test type                                   | File                |
| ------------------------------------------- | ------------------- |
| Database round trips (a repository's tests) | `round-trips.md`    |
| Pure functions                              | `pure-functions.md` |
| Route handlers                              | `route-handlers.md` |
| Services                                    | `services.md`       |

## Goal

The **scope** is what you were asked to write or refactor tests for: a file, a class, or a branch's changes. You are done when all three hold:

1. **Written to the rules.** Every test in scope follows every rule of its type's file, with its naming and shape.
2. **Every case covered.** Every public method of the code in scope has tests, and every case its type's **Cases** list names has a test of its own. List the cases for each method before you write or move a test, then tick each one off against a named `it`; a case with no test is a gap, whatever else passes.
3. **Every cost within the scale.** Tests, files and the suite are within the budgets of **Speed** when measured, or reported as that section says.

Then `pnpm format`, `pnpm lint` and `pnpm test` pass, and the tests also pass shuffled (`pnpm vitest run --sequence.shuffle <file>` in the test's package) and one at a time.

## Assertions

Write one `expect` per thing a test checks, in the order a reader asks about them: what came back, then each effect. Each failure then names the one thing that broke. Compare each thing whole (`toEqual` on the whole value), and keep unrelated values out of a shared array:

```ts
expect(response.status).toBe(201);
expect(await response.json()).toEqual({
  id: expect.stringMatching(UUID),
  total: 1200,
});
expect(payments.charges).toEqual([{ amount: 1200, currency: "gbp" }]);
```

Write out every value the test can know: an error message, a URL built from an ID it has, a time it set. Match a value it can't know (a generated ID, a token, a session URL) by its **shape**: `expect.stringMatching(/^[0-9a-f]{64}$/)` for a 32-byte hex token, a UUID pattern for an ID. A shape fails on an empty string, a wrong format or a value in the wrong field, where `expect.any(String)` passes them all.

## Refactoring

A refactor keeps the code's **semantics**: every caller sees the same answers, errors, writes and calls as before. Within that, change anything: tests and application code alike, interfaces as well as implementations (rename, move, split, merge, extract a pure function, change a signature and every caller with it).

**Split** big files as part of the refactor: above all, move helper functions out of the class or file that uses them into modules grouped by what they are about (an order's state changes in one, the text of its emails in another), each module with its own test file. Each module then has one subject, and its tests read as its list of cases. A split is a round like any other, priced before it is made (see **Speed**), because it multiplies whatever each test pays for.

Work in **rounds**: one change at a time, then `pnpm lint` and `pnpm test`, green before the next round. A test that goes red after a round means the round changed behaviour: undo it and take a smaller step.

A change of behaviour (a bug found, a case handled differently) is outside the refactor: report it, and leave the code as it behaves today, with a test that pins today's behaviour. Next to it, write the test for the right behaviour, red, and skip it (`it.skip`, Vitest's `xit`), named for the bug, so the fix only has to unskip it and delete the pin:

```ts
it("a negative amount (today: £-5)", () => {
  expect(formatPounds(-500)).toEqual("£-5");
});

it.skip("a negative amount (bug: should read -£5)", () => {
  expect(formatPounds(-500)).toEqual("-£5");
});
```

## Speed

One example per test with fresh state multiplies whatever each test's setup costs. One suite grew from 825 tests to 2,200 this way, and its CI run went from 6 minutes to past its 20-minute limit, while elapsed time on a 16-core laptop barely moved. So price the work, and measure it.

### The scale

A cost belongs at the highest level that can carry it.

| Level    | Paid                               | Budget                                                  | What belongs here                                                                       |
| -------- | ---------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **Run**  | Once per `vitest run`              | Seconds are fine                                        | Compiling the app, running migrations once and saving a snapshot, building fixture templates, all in `globalSetup` |
| **File** | Once per test file                 | 100 ms, from the first import to the end of `beforeAll` | Importing the app, starting it, starting its database from the snapshot                 |
| **Test** | Every test, its own setup included | Its type's file; 100 ms for a test that needs fresh real state (a database or a subprocess of its own) | One request, one round trip, one call                 |

Vitest gives each test file a new process by default, so something kept in memory is gone by the next file: the run level hands its results on as files on disk.

**Suite:** the full suite's CPU time (user + system) rises by no more than 25% against the baseline, and fits CI's job limit if the project has one.

### Measuring

`<skill-dir>` is the folder holding this file.

- **Baseline first, on a clean checkout of the base commit,** on a quiet machine. Record the suite's CPU time, its test count, and each test's and file's cost. Note the machine's load, and treat a loaded run as rough.
- **Suite:** `/usr/bin/time -p pnpm test`, and add `user` and `sys`. Elapsed time hides extra work on a many-core machine, so the suite's check is CPU time.
- **Tests and files:** in the test's package, run `pnpm vitest run --no-file-parallelism --reporter=<skill-dir>/scripts/speed-reporter.mjs <files>` three times and take the median of each line. `test_ms` includes `beforeEach` and `afterEach`; `file_ms` runs from the first import to the end of the file's hooks.

### Fixing

- **Price a change before making it.** Before a round that splits tests or gives each example fresh state, multiply the new test count by the setup cost per test. If the result breaks a budget, make the setup cheap first.
- **Find the cause first.** Each cost over budget gets a named cause, confirmed by measuring where its time goes. The type's file lists the usual suspects.
- **Fix in this order:**
  1. Prepare once per run and copy per test: a database snapshot, a template of a fixture. Tests stay isolated and usually don't change.
  2. Replace a real dependency with a fake, where the test's type allows it.
  3. Share expensive real fixtures across a file, only in a file whose tests only read, and say so in the report. This gives up some isolation, so it comes last.
- **Each fix is a round**, measured again afterwards.
- **Warm-up moves into setup.** Whatever only the first test would pay moves to `beforeAll`, because tests also run shuffled and any of them can be first.
- **Speed stays within the rules.** Every test keeps its type's rules, its cases, its assertions and its isolated data. Route tests stay black box against the whole app, framework included. Test timeouts and CI's `timeout-minutes` stay as they are.
- **Slow application code** is in scope when the fix keeps semantics, under **Refactoring**. A fix that would change behaviour is reported.

### Report

- Suite CPU time and test count, before and after.
- The slowest ten tests and files, before and after.
- Each test or file still over budget, with its time, its cause and the change that would fix it.
- Slow tests outside the scope or with no budget here, such as browser tests, left as they are.

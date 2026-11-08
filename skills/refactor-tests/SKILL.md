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

The **scope** is what you were asked to write or refactor tests for: a file, a class, or a branch's changes. You are done when both hold:

1. **Written to the rules.** Every test in scope follows every rule of its type's file, with its naming and shape.
2. **Every case covered.** Every public method of the code in scope has tests, and every case its type's **Cases** list names has a test of its own. List the cases for each method before you write or move a test, then tick each one off against a named `it`; a case with no test is a gap, whatever else passes.

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

**Split** big files as part of the refactor: above all, move helper functions out of the class or file that uses them into modules grouped by what they are about (an order's state changes in one, the text of its emails in another), each module with its own test file. Each module then has one subject, and its tests read as its list of cases. A split is a round like any other.

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

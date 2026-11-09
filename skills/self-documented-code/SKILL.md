---
name: self-documented-code
description: Rename everything in a scope (a repository, a PR, a directory, a concept) so each name explains itself and each concept has one name, keep comments only for what code cannot say, and update the project's glossary to match. Semantics, lint and tests stay intact.
argument-hint: "[repository | pr <number|url|branch> | path | concept]"
disable-model-invocation: true
---

# Self-documented code

Rename the code in a scope so that every name says what it means and the same thing has the same name everywhere, and leave comments only for what the code cannot say. Arguments: `$ARGUMENTS`. If your agent does not fill that in, take them from the user's message.

The **scope** is what the user names: the repository, a PR or branch (only the names and comments that PR adds or changes, plus whatever must change with them), a directory, a file, a module, or a concept ("everything about payments"). With no scope given, use the whole repository.

Run from start to finish without asking for approval. The one stop is a failing baseline (rule 2).

## Goal

A reader who sees only a name, at the place it is used, knows what it holds or does, without opening its definition or reading a comment.

You are done when all four hold:

1. **Every name is self-explanatory.** Every variable, parameter, function, method, class, type, field, constant, file and test helper in scope has been reviewed, and renamed if it falls short of the naming standard.
2. **Every concept has one name.** Across the scope, one concept has one term, and one term means one concept.
3. **Every comment earns its place.** Each comment left in scope meets the comment standard.
4. **Every project dictionary matches the code.** Each glossary or word list the project keeps uses the final terms (see Dictionaries).

## Rules

These hold after every round. A round that breaks one is undone.

1. **Semantics stay the same.** Same answers, errors, writes and calls, in the same order. Change only names, comments and dictionaries: logic, control flow, parameter order and the formatting of unrelated code stay as they are.
2. **Lint, type checks, build and tests pass**, using the project's own commands. They must pass before you start: if they fail, stop and report it.
3. **Tests change only in names and comments.** Their assertions, expected values and logic stay exactly as they are.
4. **External contracts keep their names.** That covers anything code outside this repository depends on, or that is stored or sent: published package exports, public API routes and fields, database tables and columns, serialized keys, event names, environment variables, config keys, CLI flags, and names required by a framework or interface you don't own. Report a bad name of this kind and leave it.
5. **Every reference moves with its name.** Use the language server's or compiler's rename where there is one. Then search for what tools can't see: strings, reflection, dynamic lookups, templates, mocks, docs, comments, scripts and CI config.
6. **Stay in scope.** A rename may spread beyond the scope only when the code would otherwise break, and the report lists it. Dictionaries are updated wherever they live.

## Naming standard

A name is good when:

- **It states meaning, not type or mechanics:** `unpaidInvoices`, not `list` or `invoiceArray`.
- **It uses the domain's words**, and the language's own conventions for case and idiom.
- **Its abbreviations are universal** in the domain or language (`id`, `url`, `i` as the index of a short loop). Spell out the rest.
- **It carries its unit or qualifier when that matters:** `timeoutSeconds`, `priceInPence`, `isExpired`, `hasPaid`.
- **A function says what it does and returns:** a verb phrase for an action, a noun or question for a query. A function with a side effect sounds like one.
- **Its length tracks how far it travels:** short in a three-line lambda, full for an export. Drop words the context already gives (`order.orderId` → `order.id`).
- **Every word carries meaning.** `data`, `info`, `manager`, `helper`, `util`, `temp`, `foo` and a `2` suffix go, unless the word truly is the meaning.
- **It is true.** It describes all of what the code does today.

A name that already meets the standard stays: rename for meaning, never for taste.

## Comment standard

Code says what happens. A comment exists only for what a reader could not work out from well-named code:

- **Why this and not the obvious alternative:** a decision, a trade-off, an approach that was tried and failed.
- **A non-trivial fact the code can't show:** a vendor's undocumented behaviour, a workaround and its cause, an ordering constraint, a performance or security reason, a link to the issue or spec behind it.

Delete every other comment: one that narrates the code, restates a name or signature, labels a section, or holds dead code. Before deleting one, check whether it says something the code doesn't. If it does, move that into a name, or keep only that part as a why comment. Correct any comment you keep that the code contradicts.

New comments are rare: write one only for something you learned that a name cannot carry and this standard calls for.

Linter and compiler directives, licence headers, and doc comments that generate published documentation stay as they are.

## Dictionaries

A **dictionary** is any place the project defines its words: `GLOSSARY.md`, a domain or ubiquitous-language doc, a terms section in the docs, a spell-check word list (`cspell`, `codespell`). Search for them before the vocabulary step. A project with none stays with none.

A dictionary's term is the default for its concept. When you choose a different one, or split or merge terms, change the entry in the same round as the rename: the new term, an accurate definition, the retired word gone. Add an entry for each domain concept the dictionary should have but lacks. Historical records such as ADRs and changelogs keep the words of their time.

## Method

1. **Baseline.** On a new branch, run lint, type checks, build and tests, and record the results. Done when all pass.
2. **Vocabulary.** Read the scope and the dictionaries, and write a table: each concept, the names it has today, the one term it will use. Include each term with several meanings, and how it splits. Done when every name in scope maps to a row or is marked as already good.
3. **Rename in rounds.** One concept or one module per round, outermost names first, with its dictionary entries. After each round run the checks, then commit. If a check goes red, undo the round and take a smaller step. Leave the branch unpushed. Done when every row of the table is applied.
4. **Comments.** Now that the names are done, apply the comment standard across the scope, in a round of its own, so the new names can replace what the comments said.
5. **Sweep.** Go through the scope once more, file by file, against both standards. Done when you have opened every file in scope, no old term from the table remains in the code or the dictionaries, and all checks pass.

## When a name reveals a problem

A name that can't be made honest usually means the code does two things or is wrong. Leave the code as it is, give it the most accurate name you can, and report it.

## Report

- The vocabulary table, the number of names reviewed and renamed, and the number of comments deleted, rewritten and kept.
- The dictionary entries changed, added and removed, or that the project has no dictionary.
- Check results before and after.
- Renames that went beyond the scope.
- External names left alone that should change, with where they are defined.
- Code the naming exposed as misleading, buggy or doing too much.

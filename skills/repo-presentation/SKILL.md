---
name: repo-presentation
description: Build an architecture-and-features slide deck for the current repository (screenshots, UML diagrams, key files, code and data-type slides, tech stack, lines of code), published as a Slides artifact.
argument-hint: "[language] [audience or focus]"
disable-model-invocation: true
---

# /repo-presentation

Build a deck that introduces this repository to a developer who is new to it. Organise it around **features**: show each feature on screen, then how it works underneath, then the code. Arguments: `$ARGUMENTS`. They give the language (default: the language the user writes in) and optionally an audience or focus. Text inside code panels stays in the code's own language.

Helper scripts live in `scripts/` next to this file. Slide HTML patterns are in `reference/slide-patterns.md`. Read that file before writing any slide.

## 0. Ground rules
- Read `CLAUDE.md`, `AGENTS.md` and the README first, and obey their restrictions. Example: never start the dev server against real accounts or production data. Take screenshots against demo or seed data, or ask the user how to get some.
- Only state what the code shows. Every file path, type and snippet must exist on the current branch. Snippets may be shortened with `// …` but must keep the real order of steps.
- Work in the scratchpad directory: `<scratch>/deck/` for the deck, and `<scratch>/shots/` for screenshots and the preview. Nothing goes into the repo unless the user asks.

## 1. Survey (delegate the broad reading)
Use one or two Explore agents, plus your own reads, to collect:
- What the product does and its non-negotiable rules or invariants.
- Runtime components (processes, DB, queues, external APIs) and how they talk.
- The package and module map with one line per package, and the dependency rules.
- The core lifecycle or state machine, if there is one.
- Data model: domain types, DB tables, API request and response types.
- 6–10 user-visible features. For each: the screens, the main flow (a sequence of calls across components) and the 4–6 key files.
- Deployment, testing strategy, and "how to add a feature".
- Tech stack with versions, read from the manifests (`package.json`, `pyproject.toml`, `go.mod`, …) and not from the docs. Docs may list libraries that aren't installed; mention the difference to the user.

Line counts: run `bash <skill-dir>/scripts/loc.sh` from the repo root. It counts git-tracked files with cloc, split by language, production vs tests, and package. It leaves out lockfiles and generated snapshots. To exclude more, set `LOC_EXCLUDE='regex'`, and say so on the slide. It reads the working tree, so uncommitted edits are counted; note the commit on the slide.

## 2. Outline (show the user before building)
Default order, which can be adapted to the repo:
1. **Intro:** cover; what it is (the idea); the rules or invariants.
2. **Architecture:**
   - Component diagram, package map, tech stack table, project in numbers (LOC).
   - Core lifecycle as a state diagram, followed by a code slide.
3. **Data model:** domain types; DB tables (1–3 slides); boundary or validation types; API types.
4. **Features**, for each feature N:
   - `fNa` screen: screenshot plus 3–4 numbered points.
   - `fNb` under the hood: UML (sequence, state or component) plus a key-files grid.
   - `fNc` code: 2 panels of key types or implementation.
   - Optional `fNd` for a second code slide.
5. **Production and testing:** deploy plus code; testing plus code; "more features" list; recipe for adding a feature; where to start reading.

Every slide that lists files or code is followed by a code slide with real types or implementation. Each code slide has two panels. Users find decks with only headings "poor", so aim for 45–55 slides with dense, concrete content. Put the talk track in each slide's `<aside>` speaker notes.

## 3. Screenshots
- Setup for the browser scripts: in `<scratch>/shots/`, run `npm init -y && npm i playwright-core`. Then copy `scripts/shoot.mjs` and `scripts/preview.mjs` there and run them from there; Node resolves `playwright-core` relative to the script file. Chromium is taken from `$CHROME` or the Playwright cache. If neither exists, run `npx playwright install chromium`.
- Run the app locally with demo data.
- Write a small script modelled on `scripts/shoot.mjs`. Desktop is 1440×900 @2x; phone is 390×844 @2x, mobile.
- Save the PNGs to `<scratch>/shots/png/`.
- Stop the servers you started when you're done.

## 4. Build the deck (Slides artifact type)
1. `Artifact` → `action: "quickstart"`, `intent: "slides"`. Then create from the returned Slides `type_url` with a `title`. Follow the type's instructions; **they win over this file** if the format has changed. Its result names `deck.json` and the slide file layout.
2. Upload the screenshots in one call: `Artifact` publish with `url`, `asset: true`, `file_paths: [...]`. Use each returned `url` exactly as given, as `<img src>`.
3. Write `<scratch>/deck/project/deck.json` and the `<scratch>/deck/project/slides/<id>.html` files by hand, using `reference/slide-patterns.md`.
4. Generate the code slides from a spec file with `node scripts/gen-code.mjs <scratch>/deck/project <scratch>/deck/code-spec.mjs`. The script:
   - writes `slides/<id>.html`;
   - puts each slide after its `after` id in `deck.json`;
   - checks the size limits.
   Fix every warning it prints.
5. Publish: `Artifact` with `url`, `root: <scratch>/deck`, `file_path: <scratch>/deck/project/deck.json`, and `files` mapping `project/slides/<id>.html` to each slide.
   - Root is the `deck` folder, **not** `project/`. Otherwise the files land at the wrong paths.
   - Republish to the same `url` for every change.
6. Optional local check: `node scripts/preview.mjs <scratch>/deck/project/slides <outdir> id1 id2 …` renders 1920×1080 PNGs. Look at them. Use it for code-heavy and diagram slides. The deck runtime adds a little table padding that the preview lacks.

## 5. Format limits (learned the hard way)
- **No `<pre>`.** In code, every line is its own `<p>` with `white-space:nowrap` and spaces as U+00A0. `gen-code.mjs` does this.
- `white-space` only `normal` or `nowrap`. Font size at least 24px. At most about 200 elements per slide.
- Code panels: at most **54 columns × 18 lines** in a two-panel layout. Shorten long lines; never shrink the font.
- Diagrams are absolutely positioned boxes plus `<x-connector>` arrows on a 1920×1080 canvas. Keep 128px side margins.

## 6. Hand-off
Reply with:
- the deck link;
- the slide count by section;
- what was left out or approximated (screenshots from demo data, shortened snippets, LOC exclusions);
- any mismatch between the docs and the actual dependencies.

Don't commit anything.

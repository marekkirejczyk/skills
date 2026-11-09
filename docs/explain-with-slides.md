# explain-with-slides: how it works

[← README](../README.md)

## Screenshots come from the running code

The skill installs dependencies, seeds demo data, starts the app from the branch being presented and drives it with Playwright. It records the commit of every set of shots in `manifest.json`, and puts it on the summary slide. It never uses mockups or old images. If the app can't run, it asks you instead of faking a screen. A repository with no UI gets real terminal output instead.

## How every deck opens

1. A cover that says only what the deck explains: the repository's name and description, plus the PR's number and title for a PR.
2. A contents slide: the major slide groups, numbered, with a line on each.
3. A detailed summary of the repository or PR.

Architecture and everything else come after that.

## Repo mode

Works on the current repository, or on one you pass by URL, which is cloned into a temporary folder. Running someone else's code needs your go-ahead first. About 50 slides. Each feature has a screen slide, a UML-and-files slide and a code slide. The deck also covers the data model, the tech stack, lines of code, deployment and testing.

## PR mode

15–35 slides, depending on the size of the diff. The PR is checked out into git worktrees, so your working tree is never touched. The head and the merge base each run on their own port with their own throwaway database, for before/after screenshots. The deck then covers:

- why the PR exists, the changes at a glance, and its author, branches and size;
- just enough context: diagrams with the changed parts highlighted, and a change map of +/− per package;
- for each change: before/after shots, the diagram and key files with their status, and diff panels;
- contracts and migrations;
- the real test run on the head;
- a review slide with risks at `file:line` and questions for the author.

The skill never comments on, approves or pushes to the PR.

## Output

- Claude Code: a Slides artifact.
- Codex and other agents: a standalone `deck.html`. Arrow keys or click move between slides, N shows speaker notes, F toggles fullscreen.

## Requirements

- `cloc`, for the lines-of-code slide.
- `gh` (or `glab`) for PR mode on GitHub (or GitLab). A local branch works with plain `git`.
- Node 18 or newer.
- `playwright-core` with a Chromium, for screenshots and the preview. The skill explains how to set these up.

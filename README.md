# Skills

Agent skills I use on my own projects. Each one is a folder under `skills/` holding a `SKILL.md` and any helper scripts it needs.

| Skill | What it does |
|---|---|
| [`repo-presentation`](skills/repo-presentation/SKILL.md) | Builds a slide deck that walks through a repository (onboarding, organised by feature) or through one pull request (organised by change, for review). Each feature or change gets screenshots taken from the code actually running, a UML diagram with its key files, and code slides. A PR deck adds before/after shots, diff panels, test results and review risks. The output is a Claude Slides artifact, or a standalone `deck.html` in Codex, Antigravity and other agents. |

## Installation

Every agent below reads the same `skills/repo-presentation/SKILL.md`. Choose one install method per agent; installing a skill twice makes it show up twice.

| Agent | Command to run | Global | One repository |
|---|---|---|---|
| Claude Code | `/repo-presentation` | plugin `--scope user` or `~/.claude/skills/` | plugin `--scope project` or `.claude/skills/` |
| Codex | `$repo-presentation`, or pick it from `/skills` | `~/.agents/skills/` | `.agents/skills/` |
| Antigravity | `/repo-presentation` | `agy plugin install`, `~/.gemini/config/skills/` | `.agents/skills/` |

<details open>
<summary><strong>Claude Code</strong></summary>

As a plugin, which updates itself:

```bash
claude plugin marketplace add marekkirejczyk/skills
claude plugin install marekkirejczyk-skills@marekkirejczyk --scope user     # every project
claude plugin install marekkirejczyk-skills@marekkirejczyk --scope project  # this repo, via .claude/settings.json
```

Inside a session you can do the same with `/plugin marketplace add marekkirejczyk/skills` and then `/plugin install marekkirejczyk-skills@marekkirejczyk`.

Plugin skills get the plugin name as a prefix, so the full name is `/marekkirejczyk-skills:repo-presentation`. Typing `/repo-presentation` still finds it in autocomplete.

As editable files:

```bash
npx skills add marekkirejczyk/skills --skill repo-presentation -a claude-code      # .claude/skills/
npx skills add marekkirejczyk/skills --skill repo-presentation -a claude-code -g   # ~/.claude/skills/
```

The deck is published as a Claude Slides artifact.

</details>

<details>
<summary><strong>Codex</strong> (CLI, IDE extension, app)</summary>

```bash
npx skills add marekkirejczyk/skills --skill repo-presentation -a codex      # .agents/skills/ in this repo
npx skills add marekkirejczyk/skills --skill repo-presentation -a codex -g   # ~/.agents/skills/
```

Restart Codex afterwards. Run the skill with `$repo-presentation polish, new backend dev`, or pick it from `/skills`.

`agents/openai.yaml` sets `allow_implicit_invocation: false`. Codex therefore only runs the skill when you ask for it, and doesn't choose it on its own.

Codex has no Slides artifact. The skill instead builds one standalone `deck.html`, which you open in a browser.

Instead of `npx skills`, you can install it as a Codex plugin from the same marketplace with `codex plugin marketplace add marekkirejczyk/skills`, then `codex plugin add marekkirejczyk-skills@marekkirejczyk`. `mattpocock/skills` uses the same layout for this. I haven't tested it with Codex.

</details>

<details>
<summary><strong>Antigravity</strong> (IDE, app, CLI)</summary>

The CLI installs the repository as a plugin. It converts the Claude Code plugin on install:

```bash
agy plugin install https://github.com/marekkirejczyk/skills   # global
agy plugin list                                              # shows marekkirejczyk-skills, 1 skill
```

Without the CLI, copy the folder:

```bash
npx skills add marekkirejczyk/skills --skill repo-presentation -a antigravity   # .agents/skills/ in this repo
# global, by hand: IDE and app read ~/.gemini/config/skills/, the CLI reads ~/.gemini/antigravity-cli/skills/
git clone https://github.com/marekkirejczyk/skills /tmp/mk-skills
cp -R /tmp/mk-skills/skills/repo-presentation ~/.gemini/config/skills/
```

Run it with `/repo-presentation`. In the IDE, check under **Customizations** in the agent panel that the skill is active.

Antigravity has no Slides artifact either, so the result is a standalone `deck.html`.

</details>

<details>
<summary><strong>Any other agent</strong> (Cursor, OpenCode, Windsurf, …)</summary>

```bash
npx skills add marekkirejczyk/skills --skill repo-presentation -a <agent>   # leave out -a to choose interactively
```

To update a copied skill, run `npx skills update`. A plugin updates itself.

</details>

Codex and Antigravity both read `.agents/skills/`. One copy committed to a repository therefore serves both of them.

## Using repo-presentation

```
/repo-presentation polish, for a new backend developer      # the whole repository
/repo-presentation pr 123                                   # one pull request
/repo-presentation pr https://github.com/o/r/pull/123 english, for the reviewer
/repo-presentation pr feature/rules                         # a branch against the default branch
/repo-presentation pr                                       # the current branch
```

The arguments are optional. `pr …` switches to PR mode. The next argument sets the deck language, and the rest describe the audience or focus.

**Screenshots always come from the running code.** The skill installs dependencies, seeds demo data, starts the app from the branch being presented and drives it with Playwright. It records the commit of every set of shots in `manifest.json`, and puts it on the cover. It never uses mockups or old images. If the app can't run, it asks you instead of faking a screen.

The skill only runs when you ask for it: `disable-model-invocation: true` in Claude Code, `allow_implicit_invocation: false` in Codex.

**Repo mode:** about 50 slides. Each feature has a screen slide, a UML-and-files slide and a code slide. The deck also covers the data model, the tech stack, lines of code, deployment and testing.

**PR mode:** 15–35 slides, depending on the size of the diff. The PR is checked out into git worktrees, so your working tree is never touched. The head and the merge base each run on their own port with their own throwaway database, for before/after screenshots. The deck then covers:
- why the PR exists, and the changes at a glance;
- just enough context: diagrams with the changed parts highlighted, and a change map of +/− per package;
- for each change: before/after shots, the diagram and key files with their status, and diff panels;
- contracts and migrations;
- the real test run on the head;
- a review slide with risks at `file:line` and questions for the author.

The skill never comments on, approves or pushes to the PR.

Output:
- Claude Code: a Slides artifact.
- Other agents: a standalone `deck.html`. Arrow keys or click move between slides, N shows speaker notes, F toggles fullscreen.

It needs:
- `cloc`, for the lines-of-code slide.
- `gh` (or `glab`) for PR mode on GitHub (or GitLab). A local branch works with plain `git`.
- Node 18 or newer.
- `playwright-core` with a Chromium, for screenshots and the preview. The skill explains how to set these up.

## Layout

```
.claude-plugin/
  plugin.json        plugin manifest (lists the skills)
  marketplace.json   makes this repository a one-plugin marketplace
skills/
  <skill>/SKILL.md           one folder per skill, plus its scripts and references
  <skill>/agents/openai.yaml Codex settings (invocation policy)
```

To add a skill, create `skills/<name>/SKILL.md`, add `./skills/<name>` to `plugin.json`, bump the version and run `claude plugin validate .`.

## License

MIT

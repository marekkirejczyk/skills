# Installation, in detail

[← README](../README.md)

Every agent reads the same `skills/<skill>/SKILL.md`. Choose one install method per agent; installing a skill twice makes it show up twice. In the commands below, replace `<skill>` with `repo-presentation` or `repo-video`.

## Claude Code

As a plugin, which installs both skills and updates itself:

```bash
claude plugin marketplace add marekkirejczyk/skills
claude plugin install marekkirejczyk-skills@marekkirejczyk --scope user     # every project
claude plugin install marekkirejczyk-skills@marekkirejczyk --scope project  # this repo, via .claude/settings.json
```

Inside a session you can do the same with `/plugin marketplace add marekkirejczyk/skills` and then `/plugin install marekkirejczyk-skills@marekkirejczyk`.

Plugin skills get the plugin name as a prefix, so the full names are `/marekkirejczyk-skills:repo-presentation` and `/marekkirejczyk-skills:repo-video`. Typing `/repo-presentation` or `/repo-video` still finds them in autocomplete.

As editable files, one skill at a time:

```bash
npx skills add marekkirejczyk/skills --skill <skill> -a claude-code      # .claude/skills/
npx skills add marekkirejczyk/skills --skill <skill> -a claude-code -g   # ~/.claude/skills/
```

## Codex (CLI, IDE extension, app)

```bash
npx skills add marekkirejczyk/skills --skill <skill> -a codex      # .agents/skills/ in this repo
npx skills add marekkirejczyk/skills --skill <skill> -a codex -g   # ~/.agents/skills/
```

Restart Codex afterwards. Run a skill with `$repo-presentation` or `$repo-video`, or pick it from `/skills`. Each skill's `agents/openai.yaml` sets `allow_implicit_invocation: false`, so Codex only runs a skill when you ask for it.

Codex has no artifacts: `repo-presentation` builds a standalone `deck.html`, and `repo-video` hands over the MP4 and a local page that plays it.

You can also install the skills as a Codex plugin from the same marketplace, with `codex plugin marketplace add marekkirejczyk/skills` and then `codex plugin add marekkirejczyk-skills@marekkirejczyk`. I haven't tested that.

## Any other agent (Cursor, OpenCode, Windsurf, …)

```bash
npx skills add marekkirejczyk/skills --skill <skill> -a <agent>   # leave out -a to choose interactively
```

To update a copied skill, run `npx skills update`. A plugin updates itself.

## Repository layout

```
.claude-plugin/
  plugin.json        plugin manifest (lists the skills)
  marketplace.json   makes this repository a one-plugin marketplace
skills/
  <skill>/SKILL.md           one folder per skill
  <skill>/scripts/           its helper scripts
  <skill>/reference/         references it reads when it needs them
  <skill>/assets/            templates and examples (repo-video)
  <skill>/agents/openai.yaml Codex settings (invocation policy)
docs/                        these pages, and the README's media
```

To add a skill, create `skills/<name>/SKILL.md`, add `./skills/<name>` to `plugin.json`, bump the version and run `claude plugin validate .`.

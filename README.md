# Skills

Agent skills I use on my own projects. Each one is a folder under `skills/` holding a `SKILL.md` and any helper scripts it needs.

| Skill | What it does |
|---|---|
| [`repo-presentation`](skills/repo-presentation/SKILL.md) | Builds an onboarding slide deck for the current repository, organised by feature. Each feature gets a screenshot, a UML diagram with its key files, and code and data-type slides. The deck also covers the tech stack and lines of code. It is published as a Slides artifact. |

## Installation

You can install the skills in two ways. Pick one, because installing both gives you every skill twice.

### Claude Code plugin (updates itself)

Inside Claude Code:

```
/plugin marketplace add marekkirejczyk/skills
/plugin install marekkirejczyk-skills@marekkirejczyk
```

From a shell, choose where the plugin is installed:

```bash
claude plugin marketplace add marekkirejczyk/skills

# Globally, for every project (the default)
claude plugin install marekkirejczyk-skills@marekkirejczyk --scope user

# In the current repository, written to .claude/settings.json so the team gets it too
claude plugin install marekkirejczyk-skills@marekkirejczyk --scope project
```

Plugin skills are namespaced, so you run the skill as `/marekkirejczyk-skills:repo-presentation`. Typing `/repo-presentation` finds it in autocomplete.

### Copy the files ([skills.sh](https://skills.sh))

This copies the skill into your project, where you can edit it. You update it by hand.

```bash
# Into the current repository (.claude/skills/)
npx skills add marekkirejczyk/skills --skill repo-presentation

# Globally (~/.claude/skills/)
npx skills add marekkirejczyk/skills --skill repo-presentation -g
```

To copy it by hand instead:

```bash
git clone https://github.com/marekkirejczyk/skills /tmp/mk-skills
cp -R /tmp/mk-skills/skills/repo-presentation .claude/skills/      # one repository
cp -R /tmp/mk-skills/skills/repo-presentation ~/.claude/skills/    # every project
```

Either way, you run it as `/repo-presentation`.

## Using repo-presentation

```
/repo-presentation polish, for a new backend developer
```

The arguments are optional. The first is the deck language, the rest describe the audience or focus.

The skill only runs when you ask for it (`disable-model-invocation: true`). Until then it uses no context.

It needs:
- Claude Code with the Artifact tool, to publish the Slides deck.
- `cloc`, for the lines-of-code slide.
- Node 18 or newer and `playwright-core` with a Chromium, for screenshots and the local preview. The skill tells you how to set these up.

## Layout

```
.claude-plugin/
  plugin.json        plugin manifest (lists the skills)
  marketplace.json   makes this repository a one-plugin marketplace
skills/
  <skill>/SKILL.md   one folder per skill, plus its scripts and references
```

To add a skill, create `skills/<name>/SKILL.md`, add `./skills/<name>` to `plugin.json`, bump the version and run `claude plugin validate .`.

## License

MIT

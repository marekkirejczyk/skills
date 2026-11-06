# Skills

**Explain any codebase or pull request, without writing a single slide.** Two agent skills that read your code, run it, and turn what they find into a walkthrough people actually watch: a slide deck, or a narrated video.

Works with Claude Code, Codex, Cursor and other agents that read `SKILL.md`.

## repo-video: a narrated explainer

[![repo-video explaining this repository: four build stages appearing one by one](docs/media/repo-video-demo.gif)](https://claude.ai/artifact/9S3BAqPTEddbLFLnFgKBsP)

**[▶ Watch the example](https://claude.ai/artifact/9S3BAqPTEddbLFLnFgKBsP):** a 5-minute tour of this repository, made by `/repo-video`.

Scenes reveal their content step by step, and highlight exactly what the voice is talking about: a card, a line of code, a box in a diagram. You get an MP4 with captions, on a page with chapters and a clickable transcript.

```
/repo-video for a new backend developer     # the whole repository
/repo-video pr 123                          # one pull request, for its reviewer
```

The voice is free macOS speech by default, or ElevenLabs or OpenAI if you add a key. [How it works →](docs/repo-video.md)

## repo-presentation: a walkthrough deck

[![repo-presentation's deck about this repository](docs/media/repo-presentation-demo.png)](https://claude.ai/artifact/EQmgztM99GRNdBugNTMoZK)

**[▶ See the example deck](https://claude.ai/artifact/EQmgztM99GRNdBugNTMoZK):** this repository, presented by `/repo-presentation`.

Each feature or change gets a screenshot from the code actually running, a diagram with its key files, and the real code. A PR deck adds before/after shots, diffs, the test run and review risks.

```
/repo-presentation for a new backend developer   # the whole repository
/repo-presentation pr 123                        # one pull request, for its reviewer
```

[How it works →](docs/repo-presentation.md)

## Install

**Claude Code**, both skills as a plugin that updates itself:

```bash
claude plugin marketplace add marekkirejczyk/skills
claude plugin install marekkirejczyk-skills@marekkirejczyk
```

**Codex, Cursor and other agents**, one skill at a time:

```bash
npx skills add marekkirejczyk/skills --skill repo-video          # or repo-presentation
```

Then type `/repo-video` or `/repo-presentation` (`$repo-video` in Codex). Both run only when you ask for them. [More install options →](docs/installation.md)

## Use

```
/<skill>                                      # the whole repository
/<skill> pr 123                               # a pull request: number, URL, branch, or nothing for the current branch
/<skill> pr 123 polish, for the reviewer      # then a language, then an audience or focus
```

Both skills show you an outline first and build only after you approve it. Everything they show comes from running your code: no mockups, no invented numbers.

## License

MIT

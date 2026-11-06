# Skills

Agent skills I use on my own projects. Each one is a folder under `skills/` holding a `SKILL.md` and any helper scripts it needs.

| Skill | What it does | Output |
|---|---|---|
| [`repo-presentation`](#repo-presentation) | A slide deck that walks through a repository (onboarding, organised by feature) or through one pull request (organised by change, for review). Each feature or change gets screenshots taken from the code actually running, a UML diagram with its key files, and code slides. A PR deck adds before/after shots, diff panels, test results and review risks. | A Claude Slides artifact, or a standalone `deck.html` |
| [`repo-video`](#repo-video) | The same kind of walkthrough as a narrated video. Each scene reveals its items one by one and highlights the one the voice is talking about: a card, a line of code, a step in a diagram. | An MP4 with captions, on a video page with chapters and a transcript |

Both skills only run when you ask for them: `disable-model-invocation: true` in Claude Code, `allow_implicit_invocation: false` in Codex.

## Installation

Every agent reads the same `skills/<skill>/SKILL.md`. Choose one install method per agent; installing a skill twice makes it show up twice.

| Agent | Command to run | Global | One repository |
|---|---|---|---|
| Claude Code | `/repo-presentation`, `/repo-video` | plugin `--scope user` or `~/.claude/skills/` | plugin `--scope project` or `.claude/skills/` |
| Codex | `$repo-presentation`, `$repo-video`, or pick one from `/skills` | `~/.agents/skills/` | `.agents/skills/` |
| Antigravity | `/repo-presentation`, `/repo-video` | `agy plugin install`, `~/.gemini/config/skills/` | `.agents/skills/` |

The plugin installs both skills. `npx skills add` installs the skill you name with `--skill`; run it once per skill you want. In the commands below, replace `<skill>` with `repo-presentation` or `repo-video`.

<details open>
<summary><strong>Claude Code</strong></summary>

As a plugin, which updates itself:

```bash
claude plugin marketplace add marekkirejczyk/skills
claude plugin install marekkirejczyk-skills@marekkirejczyk --scope user     # every project
claude plugin install marekkirejczyk-skills@marekkirejczyk --scope project  # this repo, via .claude/settings.json
```

Inside a session you can do the same with `/plugin marketplace add marekkirejczyk/skills` and then `/plugin install marekkirejczyk-skills@marekkirejczyk`.

Plugin skills get the plugin name as a prefix, so the full names are `/marekkirejczyk-skills:repo-presentation` and `/marekkirejczyk-skills:repo-video`. Typing `/repo-presentation` or `/repo-video` still finds them in autocomplete.

As editable files:

```bash
npx skills add marekkirejczyk/skills --skill <skill> -a claude-code      # .claude/skills/
npx skills add marekkirejczyk/skills --skill <skill> -a claude-code -g   # ~/.claude/skills/
```

The deck is published as a Claude Slides artifact, and the video as an artifact page that plays it.

</details>

<details>
<summary><strong>Codex</strong> (CLI, IDE extension, app)</summary>

```bash
npx skills add marekkirejczyk/skills --skill <skill> -a codex      # .agents/skills/ in this repo
npx skills add marekkirejczyk/skills --skill <skill> -a codex -g   # ~/.agents/skills/
```

Restart Codex afterwards. Run a skill with `$repo-presentation polish, new backend dev`, or pick it from `/skills`.

Each skill's `agents/openai.yaml` sets `allow_implicit_invocation: false`. Codex therefore only runs a skill when you ask for it, and doesn't choose one on its own.

Codex has no artifacts. `repo-presentation` instead builds one standalone `deck.html`, and `repo-video` hands over the MP4 and a local page that plays it. Both open in a browser.

Instead of `npx skills`, you can install the skills as a Codex plugin from the same marketplace with `codex plugin marketplace add marekkirejczyk/skills`, then `codex plugin add marekkirejczyk-skills@marekkirejczyk`. `mattpocock/skills` uses the same layout for this. I haven't tested it with Codex.

</details>

<details>
<summary><strong>Antigravity</strong> (IDE, app, CLI)</summary>

The CLI installs the repository as a plugin. It converts the Claude Code plugin on install:

```bash
agy plugin install https://github.com/marekkirejczyk/skills   # global
agy plugin list                                              # shows marekkirejczyk-skills and its skills
```

Without the CLI, copy the folder:

```bash
npx skills add marekkirejczyk/skills --skill <skill> -a antigravity   # .agents/skills/ in this repo
# global, by hand: IDE and app read ~/.gemini/config/skills/, the CLI reads ~/.gemini/antigravity-cli/skills/
git clone https://github.com/marekkirejczyk/skills /tmp/mk-skills
cp -R /tmp/mk-skills/skills/<skill> ~/.gemini/config/skills/
```

Run a skill with `/repo-presentation` or `/repo-video`. In the IDE, check under **Customizations** in the agent panel that it is active.

Antigravity has no artifacts either, so the results are a standalone `deck.html`, and an MP4 with a local page.

</details>

<details>
<summary><strong>Any other agent</strong> (Cursor, OpenCode, Windsurf, …)</summary>

```bash
npx skills add marekkirejczyk/skills --skill <skill> -a <agent>   # leave out -a to choose interactively
```

To update a copied skill, run `npx skills update`. A plugin updates itself.

</details>

Codex and Antigravity both read `.agents/skills/`. One copy committed to a repository therefore serves both of them.

## repo-presentation

```
/repo-presentation polish, for a new backend developer      # the whole repository
/repo-presentation pr 123                                   # one pull request
/repo-presentation pr https://github.com/o/r/pull/123 english, for the reviewer
/repo-presentation pr feature/rules                         # a branch against the default branch
/repo-presentation pr                                       # the current branch
```

The arguments are optional. `pr …` switches to PR mode. The next argument sets the deck language, and the rest describe the audience or focus.

**Screenshots always come from the running code.** The skill installs dependencies, seeds demo data, starts the app from the branch being presented and drives it with Playwright. It records the commit of every set of shots in `manifest.json`, and puts it on the cover. It never uses mockups or old images. If the app can't run, it asks you instead of faking a screen.

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

## repo-video

```
/repo-video for a new backend developer                     # the whole repository
/repo-video pr 123                                          # one pull request
/repo-video pr feature/rules polish                         # a branch, narrated in Polish
```

The arguments work as in `repo-presentation`: `pr …` switches to PR mode, then the language of the narration and captions, then the audience or focus.

The skill surveys the code, shows you an outline of scenes with an estimated length, runs the code for real output (tests, the CLI, the app), and only then writes the video. A PR video runs 3–6 minutes, a repository video 6–12.

**How it's built.** Each scene is one 1920×1080 HTML file. Its items say at which step they appear (`data-step`) and when they light up again (`data-focus`). Every step has one line of narration, so the voice always talks about what's on screen. One command, `node scripts/make.mjs . all`, then:
1. turns each step's narration into speech, cached, so an edit only re-records what changed;
2. plays each step's animation in Chromium and captures it frame by frame;
3. joins the frames and the narration with ffmpeg, each picture held exactly as long as its sentence, into an MP4 with soft captions;
4. writes the video page: the player, clickable chapters, and a transcript that follows playback.

The build warns about content that runs off the frame or out of its box, and about steps that show nothing. It saves a still of every step for checking by eye. `skills/repo-video/assets/example/` is a 1½-minute video about the skill itself, ready to build.

**Voice.** Set it in the project's `script.json`, or for one run with `VIDEO_TTS_PROVIDER` and `VIDEO_TTS_VOICE`:

| Provider | Needs | Notes |
|---|---|---|
| `say` (default) | macOS | Free and offline. The Premium and Enhanced voices (Ava, Zoe, Evan) are free downloads in System Settings › Accessibility › Spoken Content › System voice › Manage Voices, and sound far better than the defaults. |
| `elevenlabs` | an ElevenLabs API key | The most natural voices; costs one credit a character. Pick a voice by its name in your voice list, for example `Matilda`. |
| `openai` | an OpenAI API key | `gpt-4o-mini-tts` by default. Not tested yet. |

The skill looks for an API key in `ELEVENLABS_API_KEY` / `OPENAI_API_KEY`, then in the macOS Keychain, then in `~/.config/repo-video/elevenlabs.key` / `openai.key`. To keep it in the Keychain:

```bash
security add-generic-password -a "$USER" -s repo-video-elevenlabs -U -w   # or repo-video-openai; prompts for the key
```

Output:
- Claude Code: a private artifact page with the video, chapters and transcript, ready to share.
- Other agents: `out/video.mp4` with `out/captions.srt`, and `out/page/`, a local page that plays it.

It needs:
- `ffmpeg` and `ffprobe`.
- Node 18 or newer.
- `playwright-core` with a Chromium. The skill explains how to set it up.
- `gh` for PR mode on GitHub.
- macOS for the default voice, or an ElevenLabs or OpenAI key anywhere else.

## Layout

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
```

To add a skill, create `skills/<name>/SKILL.md`, add `./skills/<name>` to `plugin.json`, bump the version and run `claude plugin validate .`.

## License

MIT

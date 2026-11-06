# repo-video: how it works

[← README](../README.md)

## The flow

The skill surveys the code, shows you an outline of scenes with an estimated length, runs the code for real output (tests, the CLI, the app), and only then writes the video. A PR video runs 3–6 minutes, a repository video 5–12.

Each scene is one 1920×1080 HTML file. Its items say at which step they appear (`data-step`) and when they light up again (`data-focus`). Every step has one line of narration, so the voice always talks about what's on screen. The full format is in [`skills/repo-video/reference/scene-format.md`](../skills/repo-video/reference/scene-format.md).

One command, `node scripts/make.mjs . all`, then:

1. **tts** turns each step's narration into speech, cached, so an edit only re-records what changed;
2. **render** plays each step's animation in Chromium and captures it frame by frame;
3. **assemble** joins the frames and the narration with ffmpeg, each picture held exactly as long as its sentence, into an MP4 with soft captions;
4. **page** writes the video page: the player, clickable chapters, and a transcript that follows playback.

The build warns about content that runs off the frame or out of its box, and about steps that show nothing. It saves a still of every step for checking by eye. [`skills/repo-video/assets/example/`](../skills/repo-video/assets/example/) is a 1½-minute video about the skill itself, ready to build.

## Voices

Set the voice in the project's `script.json`, or for one run with `VIDEO_TTS_PROVIDER` and `VIDEO_TTS_VOICE`.

| Provider | Needs | Notes |
|---|---|---|
| `say` (default) | macOS | Free and offline. The Premium and Enhanced voices (Ava, Zoe, Evan) are free downloads in System Settings › Accessibility › Spoken Content › System voice › Manage Voices, and sound far better than the defaults. |
| `elevenlabs` | an ElevenLabs API key | The most natural voices; costs one credit a character. Pick a voice by its name in your voice list, for example `Matilda`. |
| `openai` | an OpenAI API key | `gpt-4o-mini-tts` by default. Not tested yet. |

The skill looks for an API key in `ELEVENLABS_API_KEY` / `OPENAI_API_KEY`, then in the macOS Keychain, then in `~/.config/repo-video/elevenlabs.key` / `openai.key`. To keep it in the Keychain:

```bash
security add-generic-password -a "$USER" -s repo-video-elevenlabs -U -w   # or repo-video-openai; prompts for the key
```

## Output

- Claude Code: a private artifact page with the video, chapters and transcript, ready to share.
- Other agents: `out/video.mp4` with `out/captions.srt`, and `out/page/`, a local page that plays it.

## Requirements

- `ffmpeg` and `ffprobe`.
- Node 18 or newer.
- `playwright-core` with a Chromium. The skill explains how to set it up.
- `gh` for PR mode on GitHub.
- macOS for the default voice, or an ElevenLabs or OpenAI key anywhere else.

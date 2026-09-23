# Deterministic rendering

Animation Factory renders visuals and audio as separate deterministic pipelines and joins them only at the end.

## Visual pipeline

`?render=1&production=<folder>` enables deterministic visual mode. For every frame the runtime computes state from an explicit timestamp, captures the logical Phaser canvas as PNG, then FFmpeg encodes the frame sequence to an H.264 video-only MP4.

## Audio pipeline

When a production has an `audio` block:

1. dialogue events selected by `audio.tts.events` are synthesized at their existing absolute timestamps,
2. procedural BGM presets are generated with FFmpeg,
3. procedural SFX presets are generated with FFmpeg,
4. every audio item is delayed to its `at` time and mixed to 48 kHz stereo,
5. the mix is limited and written to `mix.wav`,
6. FFmpeg muxes `video-only.mp4` and `mix.wav` into the final MP4.

Productions without audio still render normally.

## Local render requirements

- Node 22+
- FFmpeg on `PATH`
- Chromium installed for Playwright
- `espeak-ng` on `PATH` only when using the built-in TTS provider

Install JavaScript and browser dependencies:

```bash
npm install
npx playwright install chromium
```

Render:

```bash
npm run render -- demo
npm run render -- component-showcase
```

or:

```bash
npm run render:showcase
```

Temporary work is written under:

```text
.render-cache/<production>/
├─ frames/
├─ audio/
│  ├─ tts-*.wav
│  ├─ bgm-*.wav
│  ├─ sfx-*.wav
│  └─ mix.wav
└─ video-only.mp4
```

The final artifact is:

```text
outputs/<production-meta-id>.mp4
```

A 270x480 production with `outputScale: 4` becomes a 1080x1920 H.264/AAC MP4.

## GitHub Actions

`.github/workflows/render-production.yml` remains `workflow_dispatch` only. It installs Chromium, FFmpeg, Japanese fonts and espeak-ng, validates the requested production, renders it, and uploads the final MP4 artifact.

This avoids consuming Actions quota on every push.

## TTS quality

`espeak-ng` is the no-key baseline that proves the full pipeline. The TTS layer is intentionally isolated from Phaser and FFmpeg composition so a higher-quality provider can be added without changing visual production definitions.

# Deterministic rendering

Animation Factory has two execution modes.

## Preview mode

The normal browser preview uses Phaser timers and tweens so authors can inspect a production interactively.

## Render mode

`?render=1&production=<folder>` enables deterministic mode. The runtime exposes a small render bridge and computes visual state from an explicit timestamp instead of recording real-time tweens.

For every frame the renderer:

1. resets actor state from the production definition,
2. applies all timeline events up to timestamp `t`,
3. interpolates active movement and camera events,
4. computes transient effects from their normalized progress,
5. captures the native logical canvas as PNG.

This means a frame can be regenerated independently from the frames before it.

## Local MP4 render

Requirements:

- Node 22+
- FFmpeg on `PATH`
- Chromium installed for Playwright

Install once:

```bash
npm install
npx playwright install chromium
```

Render the demo:

```bash
npm run render -- demo
```

The pipeline writes temporary PNGs under `.render-cache/` and produces:

```text
outputs/<production-meta-id>.mp4
```

The default demo is authored at 270x480 and has `outputScale: 4`, so FFmpeg produces a 1080x1920 H.264 MP4 using nearest-neighbor scaling.

## GitHub Actions

`.github/workflows/render-production.yml` is intentionally `workflow_dispatch` only.

This keeps rendering from consuming Actions quota on every push. Supply the folder name under `productions/`; the workflow validates it, installs Chromium/FFmpeg, renders the MP4, and uploads it as an artifact.

## Current limitation

The deterministic renderer currently handles visual state only. Audio/TTS/BGM composition is the next pipeline layer and should be mixed by FFmpeg from explicit production audio tracks rather than captured from browser playback.

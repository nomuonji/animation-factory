# Browser review

Animation Factory uses the same broad pattern as the English YouTube production system: a render workflow creates a review artifact, and a separate GitHub Pages workflow exposes the latest successful render in a browser.

## URLs

Once GitHub Pages is enabled with **GitHub Actions** as the source:

```text
https://nomuonji.github.io/animation-factory/review/
https://nomuonji.github.io/animation-factory/review/<production-folder>/
```

The gallery shows the latest live successful render artifact for each production.

Each production review page contains:

- playable final MP4,
- contact sheet,
- title / duration / render timestamp,
- commit SHA,
- workflow-run link,
- component/event inventory,
- `production.json`.

## Render -> review flow

```text
workflow_dispatch: Render production
        ↓
validate
        ↓
render final MP4 + audio
        ↓
build contact sheet + review metadata
        ↓
upload animation-<production> artifact
        ↓
workflow_run: Review Pages
        ↓
collect latest successful live artifact per production
        ↓
build Review Gallery
        ↓
GitHub Pages deploy
```

The Pages workflow rebuilds from current, non-expired GitHub Actions artifacts. The render artifact retention period is 90 days.

## One-time Pages setting

GitHub requires Pages to be enabled for the repository before a custom Actions Pages workflow can deploy.

Open:

```text
Repository Settings -> Pages -> Build and deployment -> Source -> GitHub Actions
```

This is a one-time repository setting. After that, successful render workflows update the review URLs automatically.

## Why this is separate from the live Phaser preview

The Vite/Phaser preview is optimized for authoring speed. The review page intentionally embeds the actual FFmpeg-produced MP4, including final audio muxing, so human review observes the artifact that would be distributed rather than only the interactive preview runtime.

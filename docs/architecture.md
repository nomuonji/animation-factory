# Architecture

Animation Factory separates **production intent** from **rendering implementation**.

## Four layers

1. **Assets** — sprites, backgrounds, props, audio.
2. **Components** — reusable actors, UI, effects and camera primitives.
3. **Scenes / timeline events** — declarative commands such as `actor.move`, `dialogue.say`, `camera.shake`.
4. **Productions** — a concrete video definition stored under `productions/`.

An agent should normally edit only a production definition. Runtime changes are reserved for capabilities that deserve reuse.

## Current renderer

The first renderer is Phaser 4. The logical vertical canvas is 270x480 and is intended to be upscaled using nearest-neighbor filtering for final delivery.

The initial actor system is procedural: character frames are authored as tiny character grids and rendered as hard-edged rectangles. This keeps the repository text-native and lets agents add or adjust pixel poses without binary image tooling. Sprite-sheet assets can be added behind the same actor abstraction later.

## Timeline model

Events use absolute seconds. This makes a production easy to inspect, diff and generate.

```json
[
  { "kind": "actor.move", "at": 1, "actor": "worker", "x": 120, "y": 390, "duration": 2 },
  { "kind": "dialogue.say", "at": 3.2, "actor": "worker", "text": "帰ろう。", "duration": 1.5 }
]
```

## Export path

The browser UI currently supports a real-time WebM preview export via `canvas.captureStream()`.

The intended production renderer is deterministic:

`production.json -> fixed-time frame stepping -> PNG frames -> FFmpeg -> MP4`

That exporter should remain outside individual productions so every channel can share it.

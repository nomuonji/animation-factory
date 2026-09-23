# Animation Factory

An agent-native 2D animation factory for reusable pixel-art productions.

The repository is designed so an AI agent can behave like a director: choose actors, actions, dialogue, effects, props and camera moves from a catalog, then express a video as structured timeline data instead of writing arbitrary rendering code.

## Current stack

- Phaser 4 renderer
- TypeScript
- Vite preview studio
- Declarative JSON productions
- Procedural pixel actors and props
- Reusable presentation/effect component layer
- Deterministic timestamp renderer
- Playwright PNG frame capture
- FFmpeg MP4 output
- TTS / procedural BGM / procedural SFX audio pipeline
- FFmpeg audio mixing and final A/V mux
- Optional browser WebM preview recording

Phaser is intentionally hidden behind factory components. Production files should not call Phaser directly.

## Quick start

```bash
npm install
npm run validate:demo
npm run dev
```

For a production build:

```bash
npm run build
```

For a deterministic MP4 render:

```bash
npx playwright install chromium
npm run render -- demo
```

FFmpeg must be available on `PATH`. The default logical canvas is 270x480; with `outputScale: 4`, the renderer creates a 1080x1920 H.264 MP4 using nearest-neighbor scaling.

## Repository shape

```text
animation-factory/
├─ catalog/                 Agent-readable component inventory
├─ docs/                    Architecture, authoring and renderer notes
├─ productions/
│  ├─ demo/
│  └─ component-showcase/
├─ schemas/                 Production contract
├─ src/
│  ├─ components/           Actors, environments, presentation, UI and effects
│  ├─ core/                 Types, validation, production registry
│  └─ runtime/              Preview + deterministic directors
└─ tools/
   ├─ validate-production.mjs
   └─ render-production.mjs
```

## Agent contract

Read `AGENTS.md` and `catalog/components.json` first.

```text
prompt
  ↓
agent writes productions/<id>/production.json
  ↓
validator
  ↓
Animation Factory runtime
  ↓
deterministic PNG frames
  ↓
FFmpeg
  ↓
MP4
  ↓
promote useful new behavior into reusable components
```

Productions remain data. If a new animation behavior is broadly useful, it is added once to the factory and exposed through the catalog.

New production folders are discovered automatically by Vite. The preview UI lists them, and the CLI renders one by folder name:

```bash
npm run render -- my-production
```

## Included productions

`productions/demo/production.json` is the original compact overtime RPG demo.

`productions/component-showcase/production.json` demonstrates the broader component library, including speech bubbles, procedural props, actor emotes, particles, status UI, screen flash, camera pan, zoom, shake and fade transitions. It also contains a complete audio plan: actor-specific Japanese TTS, procedural BGM and synchronized SFX.

## Rendering in GitHub Actions

The `Render production` workflow is manual-only. It accepts a production folder, renders an MP4, and uploads the result as an artifact. It is deliberately not triggered on push so routine development does not consume rendering quota.

See `docs/rendering.md`, `docs/authoring.md`, `docs/components.md`, and `docs/audio.md` for details.

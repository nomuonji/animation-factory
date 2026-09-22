# Animation Factory

An agent-native 2D animation factory for reusable pixel-art productions.

The repository is designed so an AI agent can behave like a director: choose actors, actions, dialogue, effects and camera moves from a catalog, then express a video as structured timeline data instead of writing arbitrary rendering code.

## Current stack

- Phaser 4 renderer
- TypeScript
- Vite preview studio
- Declarative JSON productions
- Procedural pixel actors
- Browser WebM preview recording

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

## Repository shape

```text
animation-factory/
├─ catalog/                 Agent-readable component inventory
├─ docs/                    Architecture and renderer notes
├─ productions/
│  └─ demo/
│     └─ production.json    Complete example animation
├─ schemas/                 Production contract
├─ src/
│  ├─ components/           Actors, environments, UI and effects
│  ├─ core/                 Types and validation
│  └─ runtime/              Timeline director and Phaser scene
└─ tools/                   CLI validation / future render tooling
```

## Agent contract

Read `AGENTS.md` first.

```text
prompt
  ↓
agent writes production.json
  ↓
validator
  ↓
Animation Factory runtime
  ↓
preview / record
  ↓
promote useful new behavior into reusable components
```

Productions remain data. If a new animation behavior is broadly useful, it is added once to the factory and exposed through `catalog/components.json`.

## Included demo

`productions/demo/production.json` demonstrates procedural pixel actors, a walk cycle, pose changes, RPG dialogue, captions, floating damage, camera shake and camera zoom. No external image assets are required.

## Export status

The preview UI can record the canvas to WebM in real time. The next rendering milestone is deterministic frame stepping plus FFmpeg MP4 export, suitable for GitHub Actions and scheduled agent production.

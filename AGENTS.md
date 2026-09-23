# Animation Factory — Agent Instructions

This repository is a reusable animation factory, not a collection of one-off video scripts.

## Before creating a production

1. Read `catalog/components.json` and `catalog/audio.json`.
2. Read `schemas/production.schema.json`.
3. Compose existing components and event kinds before changing engine/runtime code.
4. Keep production-specific decisions inside `productions/<production-id>/production.json`.

## Reuse rules

- A visual asset belongs in `assets/`.
- A reusable visual object belongs in `src/components/`.
- A reusable timeline command belongs in `src/runtime/Director.ts` and must be registered in the component catalog.
- A reusable multi-action pattern should become a template later instead of being copied between productions.
- Do not add arbitrary Phaser calls inside a production.
- Do not add production-specific conditionals to the runtime.

## Pixel conventions

- Author at a low logical resolution. Default vertical format: 270x480.
- Keep positions and sizes on integer coordinates when practical.
- Prefer hard edges and discrete poses over smooth vector-looking motion.
- Final output can be upscaled with nearest-neighbor filtering.

## Production lifecycle

`idea -> production definition -> preview -> validate -> visual render + audio build -> FFmpeg mux -> reusable component promotion`

If a production needs a new effect, implement it generically, document it in the catalog, then use it from the production definition.


## Human review

Rendered productions are reviewable from GitHub Pages. Treat the final MP4 review page, not only the live Phaser preview, as the human-facing QA artifact.

Expected stable URL:

`https://nomuonji.github.io/animation-factory/review/<production-folder>/`

When changing a reviewed production, re-render it so the Review Pages workflow can replace that production's gallery entry with the latest successful artifact.

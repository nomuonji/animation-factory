# Animation Factory — Agent Instructions

This repository is a reusable animation factory, not a collection of one-off video scripts.

## Before creating a production

1. Read `catalog/components.json` and `catalog/audio.json`.
   Check `catalog/asset-library.json` before creating or sourcing new art or sound.
   When the library is not enough, `docs/asset-sources.md` lists two optional tools: **Openverse** (keyless search of CC/public-domain images and audio — Freesound SFX, Jamendo music, Flickr/Wikimedia) and **earshot** (lets an agent measure and compare audio it cannot hear, plus a bank of code-made SFX). Install earshot from GitHub, not PyPI.
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

- Author at a low logical resolution. Use 270x480 for vertical shorts and 480x270 for 16:9 landscape work when 1080p output is needed at 4× scale.
- Keep UI, actor placement, camera moves and review layout inside the chosen canvas. Long-form productions use the same absolute timeline; plan sections before adding events.
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

## Long-form films

Read `docs/longform.md` before making a chapter-based landscape film. Use `productions/<id>/longform.json` and `tools/longform/longform.py`; keep narration, chapter purpose and shot choices in data. The Shorts source/voice engine is shared, but long-form output and workflow are separate. Technical pass is not editorial approval. Review the full MP4 and sound; do not send long-form artifacts into Shorts auto-publication.

## 3D Shorts

For acted 3D skits (characters, props, a set) follow `docs/three-shorts-playbook.md` end to end (ideation → scene → lint/stills → voices → render → `tools/three/qa.mjs` → merge → publish with `tools/three/publish-pack.mjs` → `productions/<id>/published.json`). Tools are described in `docs/three-shorts.md`. Productions are `productions/<id>/scene3d.json`; reusable props/sets/poses live in `src/three/` and are listed under `three` in `catalog/components.json`. The pixel conventions above do not apply to this line.

## Style Shorts (topic → one of 21 looks)

To turn a topic into a narrated vertical short in a chosen look (stick figures, living charts, diagrams, paper, comic, risograph, retro anime, pixel art, minimal line, and 3D cartoon / what-if / low-poly / route map / exploded view / block world / toy bricks / retro console / block horror / clay / game avatar), use the `style-shorts` skill (`.claude/skills/style-shorts/SKILL.md`) and the per-look skills `.claude/skills/style-<id>/`. Productions are `productions/<id>/styled.json`; the reference is `docs/style-shorts.md`; looks are listed in `catalog/styles.json` (regenerate the skills with `node tools/styles/gen-skills.mjs` after editing it). Reusable drawing code lives in `src/styles/`, never in a production. `meta.kind: "style-demo"` productions are never published.

# Character Bank / Shorts usage

This bank separates **usable visual characters** from **references requiring licensed source-file access**.

## Ready-to-render originals

Twelve distinct procedural pixel-character palettes are integrated directly into `src/components/pixelFrames.ts` and selectable as `Production.actors[].archetype`. The underlying pixel animation is programmatic; it does not download any external cartoon images. Roles include worker, female worker, manager, clerk, students, elders, nerd, gal, exhausted worker and narrator. Each actor supports idle/walk-a/walk-b/surprised/dead-inside animations and reactions supported by Animation Factory.

## Irasutoya references

The 12 verified official-page links in `index.json` are **reference_only**. No Irasutoya artwork is distributed in this public GitHub repository, embedded as a raw asset, or auto-downloaded by CI. Do not misrepresent them as ready to render. If a video workflow receives an irasutoya ID today, it raises an error rather than silently substituting or hotlinking.

Official rights conditions (review before adding local media): https://www.irasutoya.com/p/terms.html and https://www.irasutoya.com/p/faq.html. Commercial YouTube video usage: up to 20 distinct illustrations per video including thumbnail, duplicates of the same illustration count once. No original-art redistribution/resale; do not use the materials as standalone merchandise/stock-pack/VTuber avatar, and avoid prohibited hostile/damaging depictions. If adding actual images in the future, use an authorized media store outside the public repository and make an explicit per-video render-rights decision rather than assuming links grant permission to mirror an asset library. Recheck terms when enabling that workflow.

## API and CI

- `node tools/character-bank-smoke.mjs`: manifest integrity, automatic role/emotion matching, proper exclusion of nonlocal references, strict commercial limit including thumbnail; mock boundary 20 vs 21.
- `findCast(bank,{role:"boss",emotion:"angry"})` returns the manager asset.
- `validateVideoUsage(bank,{videoAssets:["manager","worker-exhausted"],thumbnailAssets:["manager"]})` reports exact unique usage.
- `productions/market-short-character-test/production.json`: 13.5 second portrait Shorts **fictional** sketch with two different characters, movement, face changes, Japanese VOICEVOX Nemo narration, kinetic headlines and CC0 sound cues. Not market evidence and not uploaded to YouTube.
- Main-branch Render production workflow triggers when this new production JSON is merged. Look for `animation-market-short-character-test` in its GitHub Actions artifacts; video render completion cannot be claimed until that workflow succeeds.

The Kenney CC0 modular character sprite packs `assets/kenney/roguelike-characters` and `assets/kenney/pico-8-platformer` are also already cached in the repository, indexed by `tools/visual-bank-report.mjs`. They are existing source artwork, not yet automatically skinned onto the characters in this test.

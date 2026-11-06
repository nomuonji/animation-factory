# 3D Shorts (procedural Three.js line)

A third production line next to the pixel Phaser runtime and the footage-based Shorts v3.
Use it for **acted skits** — characters, props and a set — where no real footage exists
(e.g. 「もしも○○だったら」 sketches). Editorial rules from the `short-form-video-direction`
skill still apply: decide the first frame and the payoff before animating, one twist per video,
review the contact sheet, and report technical / editorial / audience separately.

## Pieces

| Path | Role |
|---|---|
| `productions/<id>/scene3d.json` | The production: concept, voices, set, actors, props, **beats** |
| `tools/three/compile.mjs` | Beat-relative authoring → absolute timeline (timing from voice length) |
| `tools/three/render3d.mjs` | VOICEVOX → timeline → headless Chromium/WebGL frames → FFmpeg → MP4 + review pack |
| `src/three/` | Runtime: `Director3D` (deterministic channels), `Character`, `props`, `sets`, toon look |
| `catalog/sfx3d.json` | Named sound cues (Kenney CC0 files or FFmpeg-generated layers) |
| `three.html` | Preview page |
| `.github/workflows/three-shorts.yml` | PR / manual render with VOICEVOX, uploads MP4 + review artifact |

## Authoring

Each beat may have one spoken `line` (`／` separates caption chunks). Its length comes from
VOICEVOX, so never hard-code dialogue seconds. `pre` / `post` / `hold` / `dur` add silence.

Actions inside `do` (one verb per action):

- `pose` actor → named pose (`idle counter hold-doc lift-doc point stamp-up stamp-down give sign hand-up bow`) or joint numbers
- `move` actor → `{x,z,ry}`; `look` actor → `{yaw,pitch}`; `face` actor → expression (`neutral blank polite surprised doubtful weary`)
- `prop` id → transform `{x,y,z,rx,ry,rz,s}` with `dur`, `ease` (`linear inOut in out back`), `arc`
- `show` / `hide` id; `param` id → e.g. `{sig: 1}` signature progress, `{stamp: 1}`
- `wiggle` actor → hand scribble amount; `sfx` name (from `catalog/sfx3d.json`); `shot` camera cut mid-beat
- `at`: seconds from beat start, or `line`, `line+0.3`, `lineEnd-0.2`, `end`, `start`

Reusable things belong in code, not in a production: new props in `src/three/props.ts`,
sets and their camera presets in `src/three/sets.ts`, poses/expressions in `Character.ts`.

## Commands

```bash
npm install
# timing only (writes outputs/three/<id>/timeline.json)
node tools/three/render3d.mjs <id> --timeline-only
# preview in a browser after the timeline exists
npx vite  # then open /three.html?timeline=/outputs/three/<id>/timeline.json
# fast stills for review
node tools/three/render3d.mjs <id> --scale 0.5 --stills 0,5,12.5
# full render (VOICEVOX at $VOICEVOX_URL, default 127.0.0.1:50021; without it: estimated timing, no voice)
node tools/three/render3d.mjs <id>
```

Set `CHROME_PATH` to use a system Chrome instead of Playwright's Chromium. Rendering uses
SwiftShader (CPU WebGL): about 0.8 s per 1080×1920 frame on 2 cores.

Outputs: `outputs/three/<id>/<id>.mp4` and `review/` (`first-frame-phone.png`,
`contact-sheet.jpg` 1 fps, `captions.srt`, `description.txt` with VOICEVOX/Kenney credits, `status.json`).
`status.json` always says `editorial: unreviewed` — a person decides that.

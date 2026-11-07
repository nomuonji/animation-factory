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

## Story design first

Before writing beats, fill the `design` block from `templates/skit3d.json` and read
`docs/short-drama-design.md` (title × first frame × first line, beat roles, hook and title types,
formats in `catalog/skit-formats.json`). `render3d.mjs` runs `tools/three/design-lint.mjs` and stops
on structural errors (`--no-lint` only for technical tests). `design.hook.overlay` becomes the
on-screen hook text while the hook beats play; `design.title` is shown as a band at the top for the whole video (`titleOnScreen`, `titleScreenText`).

## Free 3D assets (CC0, vendored)

Listed in `catalog/assets3d.json`. Only CC0 files are vendored; keep the ledger in sync.

- **KayKit Restaurant / Furniture Bits** (Kay Lousberg, CC0) — `assets/3d/kaykit/<pack>/<model>.gltf`.
  Use as a prop: `{"kind": "gltf", "params": {"src": "assets/3d/kaykit/restaurant/ketchup.gltf", "scale": 0.5}, "tf": {...}}`.
- **100Avatars R1** (Polygonal Mind, CC0) — `assets/3d/avatars/*.vrm`. Use as an actor:
  `{"vrm": "assets/3d/avatars/Lydia.vrm", "height": 1.6, "root": {...}}`. The same poses, looks and
  lip movement (VRM visemes + blink) work as for procedural characters. The style is colourful and
  surreal; it does not fit every skit.
- **100Avatars R3 cast** (CC0): `FrogEnjoyer`, `DogoBurger`, `LilShark`, `AjoMajo`, `CuteSaurus` — cuter, with joy/angry/sorrow/fun expressions that follow the `face` actions. `CuteSaurus` needs `"look": {"pitch": 0.9}`; `turn` (degrees) rotates a model that was authored facing away.
- **Kenney Mini Characters** (CC0) — `assets/3d/kenney/mini-characters/character-*.glb` as `kind: "gltf"` props with `params.clip` (`idle`, `walk`, `emote-yes`, `interact-right`…; evaluated from the timeline). Good for crowds; painted faces, so no lip sync.
- **Your own VRM** (e.g. made in VRoid Studio) works the same way: put it in `assets/3d/avatars/`,
  record its licence in the ledger, reference it with `vrm`.

Other CC0 sources worth checking: Quaternius (quaternius.com, CC0, Google Drive downloads),
Kenney (kenney.nl, CC0), Poly Haven (CC0, realistic), Poly Pizza (mixed CC0/CC-BY — check per model).
Files the sandbox cannot download go into `catalog/remote-assets.json`; the **Fetch remote assets**
workflow downloads them on a runner and uploads an artifact with sha256 for review.

## Sets

`convenience-store` (counter, register, hot-snack case, microwaves, shelves), `interview-room` (meeting-room job interview: desk with modesty panel, whiteboard, clock, blinds; place the candidate chair as a gltf prop) and `studio` (plain cyclorama for character sheets and lineups; cameras `front`, `close`).

## Music

`"music": {"track": "<id>", "gain": 0.2, "fadeIn": 0.2, "fadeOut": 0.6}` loops a track from the
`music` list in `catalog/asset-library.json` and ducks it under dialogue (sidechain). Beat actions
`{"at": ..., "music": "cut"}` / `{"music": "resume"}` mute and restore it (silence before/at a payoff).
CC0 tracks by mood: `bossa-thank-you-for-shopping` (shop deadpan), `waiting-lounge`, `jazz-rusted-maid`,
`numskull`, `little-happy-tune`, `ukulele-short-loop`, `lofi-loop-scoop`, `sad-piano-progression`,
`strange-music`, `music-box-melody`, `tension-build`; stingers `pizz-sting`, `pizz-sting-sad` in `catalog/sfx3d.json`.

## Authoring

Each beat may have one spoken `line` (`／` separates caption chunks). Its length comes from
VOICEVOX, so never hard-code dialogue seconds. `pre` / `post` / `hold` / `dur` add silence.

Actions inside `do` (one verb per action):

- `pose` actor → named pose (`idle counter hold-doc lift-doc point stamp-up stamp-down give sign hand-up bow`) or joint numbers
- `move` actor → `{x,z,ry}`; `look` actor → `{yaw,pitch}` (pitch > 0 looks down); `face` actor → expression (`neutral blank polite surprised doubtful weary`)
- `prop` id → transform `{x,y,z,rx,ry,rz,s}` with `dur`, `ease` (`linear inOut in out back`), `arc`
- `show` / `hide` id; `param` id → e.g. `{sig: 1}` signature progress, `{stamp: 1}`
- `wiggle` actor → hand scribble amount; `sfx` name (from `catalog/sfx3d.json`); `shot` camera cut mid-beat; `music` cut/resume
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

Outputs: `outputs/three/<id>/<id>.mp4` and `review/` (`design-report.md`, `title.txt`, `first-frame-phone.png`,
`contact-sheet.jpg` 1 fps, `captions.srt`, `description.txt` with VOICEVOX/Kenney credits, `status.json`).
`status.json` always says `editorial: unreviewed` — a person decides that.

### Seated actors

`"seated": true` on a VRM actor bends both legs (thighs forward, shins down). Lower `root.y` so the hips meet the seat; behind a desk with a modesty panel, raise it so the torso shows above the desk.

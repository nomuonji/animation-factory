# 3D Shorts (procedural Three.js line)

A third production line next to the pixel Phaser runtime and the footage-based Shorts v3.
Use it for **acted skits** — characters, props and a set — where no real footage exists
(e.g. 「もしも○○だったら」 sketches). Editorial rules from the `short-form-video-direction`
skill still apply: decide the first frame and the payoff before animating, one twist per video,
review the contact sheet, and report technical / editorial / audience separately.

**Making a skit from idea to publication? Follow `docs/three-shorts-playbook.md`** (the step-by-step runbook with quality gates). This file describes the tools.

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

## Main cast (reusable presets)

`catalog/cast3d.json` holds the channel's own characters. Reference them instead of repeating
style blocks: `"actors": {"akuma": {"cast": "akuma", "root": {...}}, "beko": {"cast": "akabeko", "root": {...}}}`.
The preset fills style / figure / height / expr / captionColor, and `voices.<id>` falls back to the
preset voice; anything written in the production wins (style merges key by key).

- **akuma (悪魔)** — procedural `Character` (normal proportions) with `eyeStyle: "villain"`: narrow upturned
  eyes with tiny pupils and a heavy upper lid, sharp V brows, `eyeShadow` under the eyes, and (expression
  `grin`, the default) a wide crescent grin of jagged teeth that keeps showing while he talks. Red skin,
  black `horns`, `hairStyle: "spiky"`, `ears: "pointed"`, black hoodie with `print: "悪魔"`. Pose `hold-up`
  raises the right hand beside the face — put the akabeko at about `{x: root.x - 0.27, y: 1.5, z: root.z + 0.4}`
  for the selfie shot. Voice preset: 玄野武宏. (Other face styles: `eyeStyle: "frog"` painted 100Avatars
  look, `"big"`; `figure: "chibi"` is a ~2.2-head build.)
- **akabeko (赤べこ／犬)** — `figure: "akabeko"`, a hand-sized papier-mâché cow (height 1 ≈ 0.2 m).
  No mouth: while it speaks the head nods once per mora; idle is a slow sway. `look` tilts the head,
  `move` places it (put `root.y` on a hand or a surface). Poses are ignored. Voice preset: 雨晴はう.

Turnaround / QA: `productions/cast-akuma-akabeko` (`meta.kind: "character-sheet"` skips the story lint
and is marked `publish: false` in `status.json`; never send it to publishing).

## Sets

`convenience-store` (counter, register, hot-snack case, microwaves, shelves), `interview-room` (meeting-room job interview: desk with modesty panel, whiteboard, clock, blinds; place the candidate chair as a gltf prop), `studio` (plain cyclorama for character sheets and lineups; cameras `front`, `close`) and `photo-studio` (写真館 for ID photos: paper backdrop sweep, wooden floor, sample portraits; put the sitter on a `chair_stool` gltf at z≈-0.6; props `photo-camera` (tripod, `height`, `tilt`) and `strobe` (softbox, `param flash` 0..1 for the flash; pair it with the `camera-shutter` sfx)), `dental-clinic` (歯科医院: dental chair reclined by `params.recline` (rad, default 0.62), overhead lamp, spittoon with cup, instrument tray, back counter, brushing poster; cameras `wide`, `side`, `patient-cu`, `dentist-cu`, `over-dentist`. Lay a VRM patient on it with `seated: true` and `root.rx: -recline`; the dentist stands at the patient's right, x≈-0.5, z≈-0.3, ry=π/2) and `real-estate-office` (不動産屋の賃貸カウンター: consultation desk at z≈-0.35 with a centre modesty divider and low booth partitions, a corkboard of property flyers under 「おすすめ物件」 (`params.header`, `params.accent`), flyers on the shop window, a brochure rack; cameras `wide`, `agent-cu`, `customer-cu`, `over-customer`, `over-agent`, `desk-top`. The agent sits behind the desk at z≈-0.86 facing +Z, the customer on a `chair_A` prop at z≈0.4 facing -Z; desk sheets are `floor-plan` props (`layout`, `rent`, `room`, `tags[]`, `accent`) — `ry: 0` reads right from the customer's side)), `hotel-front-desk` (ホテルのフロント: marble-top reception counter at z=0 (top 1.05), the staff stands behind at z≈-0.55 facing +Z and the guest in front at z≈0.6 facing -Z (ry=π); key cubbies with room numbers and a logo plaque (`params.logo`, `params.accent`) on the back wall, bell / pen cup / monitor on the counter, a plant on the left; cameras `wide`, `side` (profile of both, good for a bowed head), `staff-cu` (over the guest's shoulder), `guest-cu`, `two-shot`) `diner-counter` (町の食堂のカウンター: wooden counter top 0.98 at z=0, the owner stands behind at z≈-0.55 facing +Z, guests sit on round stools (seat 0.58, x=-1.4/-0.9/0.14/1.2, z≈0.85, `seated: true`, `root.y≈-0.19`, `ry=π`); white-tile kitchen wall, stove and pot, menu strips, shop plaque (`params.shopName`, `params.accent`); cameras `wide`, `taisho-cu`, `guest-cu`, `two-shot`, `regular-cu`, `counter-top`, `side`; props `ramen-bowl` (`negi`), `gyoza-plate` (`count`), `beer-mug`), and `family-restaurant` (ファミレス: booth table area around x=0 — bench seat 0.45 at z≈-0.95 facing +Z, table top 0.72 centred (0,-0.35), the server stands at the open end x≈0.95 facing -X — and the entrance register counter (top 1.0) centred (2.9,-0.75) with staff behind at z≈-1.15 and the customer in front at x≈2.85, z≈-0.05; cameras `table-wide`, `table-top`, `beko-cu`, `akuma-cu`, `server-cu`, `entrance-wide`, `register-staff`, `register-customer`, `register-top`. Props `water-glass` (`param straw`), `hamburg-plate` (`size`, `empty` for a side plate), `toy-basket`, `toy-car`).

Actor extras: `root.rx` (also through `move`) tilts a VRM actor's whole body back (<0) or forward, after its yaw — for reclined chairs and beds. `face` actions take `{"jaw": n}` to open a VRM mouth beyond its talking shape ("aa" blend shape; values above 1 exaggerate it, e.g. 3 for a huge jaw); `{"jaw": 0}` returns it. Procedural characters take `style.mask` (face-mask colour) for dentists and nurses.

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

After a full render: `node tools/three/qa.mjs <id>` (technical gate: review pack, real voice, 35–50 s, A/V length = timeline, -14 LUFS, credits).
Publishing: `node tools/three/publish-pack.mjs <id> --publisher <video-publisher checkout>` writes `incoming/おもしろ/<date>-<id>.mp4/.json`; record the posted URLs in `productions/<id>/published.json` (the pack refuses a production that has one).

### Seated actors

`"seated": true` on a VRM actor bends both legs (thighs forward, shins down). Procedural characters take it too (thighs forward, shins down; set `root.y` ≈ -0.32 for a 0.45 m seat). Lower `root.y` so the hips meet the seat; behind a desk with a modesty panel, raise it so the torso shows above the desk.

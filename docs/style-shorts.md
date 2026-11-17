# Style Shorts（トピック → 好きな画風のショート動画）

ひとつのトピックを、21種類の画風（`catalog/styles.json`）のどれか1つで 20〜58 秒の縦型ショートにするライン。
台本・ナレーション（VOICEVOX）・BGM（CC0）・効果音・字幕・レンダリングまでリポジトリ内で完結する。
画風ごとの作り方は `.claude/skills/style-<id>/SKILL.md`、全体の手順は `.claude/skills/style-shorts/SKILL.md`。

| Path | Role |
|---|---|
| `productions/<id>/styled.json` | 本番データ：画風・声・タイトル・出典・beats（1 beat = 1 ナレーション + 1 画） |
| `tools/styles/render-style.mjs` | VOICEVOX → タイムライン → headless Chromium → FFmpeg → MP4 + review pack |
| `tools/styles/scenes.mjs` | beat の visual を絶対時間のシーンにする（continue の引き継ぎ）＋ style lint |
| `tools/styles/gallery.mjs` | 同じ台本を全画風（または指定）で静止画にして並べる |
| `tools/styles/qa.mjs` | 本番レンダリング後の技術QA |
| `src/styles/` | 描画：`themes.ts`（画風の定義）`pose.ts`（共通の骨格ポーズ）`icons.ts`（ピクトグラム）`draw2d/`（2D）`three/`（3D） |
| `styles.html` | プレビュー：`npx vite` → `/styles.html?timeline=/outputs/styles/<id>/timeline.json` |
| `.github/workflows/style-shorts.yml` | PR / 手動で VOICEVOX 付きレンダリング（公開はしない） |

## コマンド

```bash
node tools/styles/render-style.mjs <id> --timeline-only           # 尺と lint だけ
node tools/styles/render-style.mjs <id> --stills auto --scale 0.5  # シーンごとの静止画（数秒）
node tools/styles/render-style.mjs <id> --style comic --stills auto  # 別の画風で試す
node tools/styles/gallery.mjs <id> --styles stickman,clay,comic     # 画風比較シート
node tools/styles/render-style.mjs <id>                           # 本番（VOICEVOX が無いと無音・推定タイミング）
node tools/styles/qa.mjs <id>
```

VOICEVOX は `$VOICEVOX_URL`（既定 `127.0.0.1:50021`）。ローカルに無ければ Actions の **Style Shorts** を `production` 指定で手動実行すると、声付き MP4 と review 一式が artifact に出る。
音声キャッシュは 3D ラインと共通（`outputs/three-voice`）。2D は 1080×1920 で 1 フレーム約 30ms、3D は SwiftShader で約 0.5〜0.9 s。

## styled.json

```jsonc
{
  "meta": { "id": "moon-walk", "title": "月まで歩いたら", "fps": 30, "width": 1080, "height": 1920 },
  "style": "stickman",                       // catalog/styles.json の id
  "voices": { "n": { "speaker": "青山龍星", "speed": 1.15 } },
  "music": { "track": "numskull", "gain": 0.16 }, // 省略時は画風の既定曲。"none" で無し
  "autoSfx": true,                           // シーン切替の効果音（画風の sceneSfx）
  "design": { "title": "月まで歩いたら何年かかる？", "hook": { "overlay": "月まで歩いたら？" } },
  "sources": ["NASA Moon Fact Sheet — 384,400 km"],   // 数字を出すなら必須（description に載る）
  "description": ["説明文の1行目"],
  "captions": { "y": 0.64 },                 // 任意：字幕位置の上書き
  "theme": { "accent": "#ff3b5c" },          // 任意：画風の色の上書き
  "beats": [
    { "id": "hook", "role": "hook",
      "line": { "who": "n", "text": "月まで歩いて行けたら／何年かかると思う？" },
      "visual": { "scene": "stage", "set": "space", "actors": [ { "id": "a", "pose": "think", "face": "smug", "emote": [["line+1", "?"]] } ] },
      "do": [ { "at": "line", "sfx": "question" } ] }
  ]
}
```

- `line.text` の `／` が字幕の区切り。1チャンク 26 字以内。秒数は書かない（声の長さで決まる）。
- `role`: `hook`（冒頭。hook overlay はここまで表示）、`title`（全画面タイトルカード）、`payoff` など。
- `pre` / `post` / `hold` / `dur` で間を足せる。`do` は 3D ラインと同じ（`sfx`、`music: cut|resume`）。効果音名は `catalog/sfx3d.json` と `catalog/sfx-styles.json`（`whoosh pop ding tick glitch question boom`）。
- visual を書かない beat、または `"continue": true` は前のシーンの続き（人物は止まった位置から）。`drop: ["id"]` で退場。

### シーンの種類（visual.scene）

| scene | 主なキー | 中身 |
|---|---|---|
| `stage` | `set` `actors[]` `props[]` `camera` | 人物が演じる場面。2D/3D 共通 |
| `counter` | `from` `to` `unit` `format` `label` `icon` | 数字のカウントアップ |
| `card` | `text` `sub` `icon` | 大きな一言（`\n` で改行） |
| `chart` | `type: line` + `points [[x,y]…]` / `type: bar` + `bars[{label,value,icon}]`, `unit` `format` `label` | 先頭の点が走る折れ線／伸びる棒 |
| `list` | `title` `items[ "…" or {text, icon} ]` | 1つずつ出る箇条書き |
| `diagram` | `title` `nodes[{id,icon,label,x,y}]` `edges[{from,to,label}]` | ノードと流れる点線矢印（x,y は -1..1） |
| `path` | `shape: wander|spiral|zigzag|loop|up` `text` | 一本線が描かれていく |
| `quote` | `text` `author` | 引用・格言 |
| `route` | `text`（出発）`label`（到着）`eta` | 街の上をルートが伸び、到着ピンと所要時間 |
| `exploded` | `object` `title` `layers[{label,color}]` | 層が分かれて引き出し線とラベル |

`format`: `comma`（既定）`short`（万・億）`int` `decimal1` `percent`。すべてのシーンに `chip`（隅のラベル）と `transition`（`cut pop slide flash fade wipe`）を付けられる。
3D 画風で stage/route/exploded 以外を使うと、3D の背景の上にパネルで表示する。

### 人物（actors[]）

`id`（必須）`x`（-1 左端〜1 右端）`y`（体の高さ単位で浮かせる）`z`（3D の奥行き）`scale` `facing`（1/-1）
`to: { x, y, z, at, until }`（beat 内で移動。3D では横向きになって歩く）
`pose` / `face` / `emote` は文字列か `[[at, 値], …]` の時間指定（`at`: 秒、`line`, `line+0.4`, `lineEnd-0.2`, `end-0.5`, `start`）。
`color`（服）`accent`（髪・帽子）`hair: none spiky cap bob bun hood short` `holds`（右手に持つアイコン名）`talks: true`（ナレーションに口パク）。
ブロックホラーでは `color: "shadow"` で背の高い影の人物（白い目）。

- pose: `idle point point-left point-up think shrug cheer arms-up facepalm hands-hips hold present shock sad sit crouch bow lying wave`、ループ: `walk run jump dance panic wave-loop talk fly`
- face: `neutral happy laugh sad worried shock scared angry smug tongue dizzy sleepy blush`
- emote: `! ? ... heart sweat anger idea zzz` または任意のアイコン名

### 小道具（props[]）とアイコン

`kind` はアイコン名（2D はピクトグラム、3D は立体があるものは立体、それ以外は看板）。`x` `y`（地面からの高さ）`scale` `rot` `label` `at`（ポップイン）`to`。
アイコン：`person people phone coin money house building car clock heart bolt cloud sun moon rocket book cup gear chart globe fire drop star warning check cross question flag tree burger dumbbell laptop mountain plane salt wave brain eye bed pill arrow`。
3D の立体：`rocket moon sun flag tree box coin phone house cloud pin`。`rocket` は `to.y` で上昇すると炎が出る。

### セット（set）

2D: `beach desert city room space sky park classroom plain void`、画風専用 `newsprint dusk-paper burst riso-night sunset-grid night-pixel`。
3D: `town desert space-rocks city-white void-dark voxel-hills brick-sky backyard-night dark-corridor clay-sky avatar-room studio`。
画風は `setMap` で合わない指定を自分のセットに置き換える（例：ドット絵で `space` → `night-pixel`、3D 画風はそれぞれ自分の世界）。

## 編集の原則（short-form-video-direction スキルに従う）

- 1フレーム目で何の話か分かる：最初の beat に hook（疑問・意外な数字）。hook overlay は短く。
- 1本1トピック、1つの驚き。最後の beat で回収（payoff）。
- 6秒以内に画を変える（lint が警告）。数字は必ず出典を確認し `sources` に書く（lint が警告）。
- 技術QAの合格は編集の合格ではない。`review/contact-sheet.jpg` を自分で見て、人に見てもらう。
- `meta.kind: "style-demo"` の見本（`style-demo-moon`, `style-demo-scenes`）は公開しない。

## 新しい画風を足す

1. `src/styles/themes.ts` の `STYLES` に定義（engine, figure, 色, 字幕, fx / look, defaultSet, setMap）。
2. 必要なら 2D: `draw2d/figures.ts` / `draw2d/sets.ts`、3D: `three/figure3d.ts` / `three/sets3d.ts` / `three/materials.ts` に部品を追加。
3. `catalog/styles.json` に登録し、`node tools/styles/gen-skills.mjs` でスキルを生成。
4. `node tools/styles/gallery.mjs style-demo-moon --styles <id>` で見た目を確認。

# Style Shorts 制作〜公開の手順書（playbook）

このリポジトリにアクセスできれば、だれ（人・どのエージェント）でも同じ手順・同じ基準で、
トピック1つから「画風つきの縦型ショート」を1本作れるようにするための手順書。
データ仕様は `docs/style-shorts.md`、判断の理由と見るべき所は `docs/agent-video-craft.md`、画風ごとの型は `.claude/skills/style-<id>/SKILL.md`（普通の Markdown。Claude 以外のエージェントもそのまま読む）。

> 合格の最終判断は Yuto。この手順の合格は「技術的に出せる」まで。

## 0. 全体

| # | 段階 | 成果物 | 関門（これを満たすまで次へ進まない） |
|---|---|---|---|
| 1 | 題材と事実 | 事実メモ・出典・計算式 | 数字はすべて一次情報で確認、計算はコードで実行 |
| 2 | 画風を決める | style id | 題材が画風の `fits` / `best` に合う |
| 3 | 台本 | `productions/<id>/styled.json` | タイトル・0秒の画・最初の一言が同じ約束 |
| 4 | 尺と lint | `--timeline-only` | errors 0、推定尺 × 1.3 が 20〜45 秒 |
| 5 | 静止画と機械の目 | `--stills auto`、`--inspect` | inspect errors 0、warnings は全部読んで直すか理由を書く。並べた静止画を自分で見た |
| 6 | 本番 | MP4 + `review/` | 実音声（VOICEVOX）で書き出し、`qa.mjs` 合格 |
| 7 | 報告 | MP4・contact sheet・結果 | 技術と内容を分けて報告 |
| 8 | 公開（指示があるときだけ） | 投稿 URL・`published.json` | 本人が公開と投稿先を指示した |

## 1. 題材と事実

- 題材を1文で言う（「月まで歩いたら何年かかるか」）。言えない題材は絞る。
- 必要な数字を書き出し、一次情報（公的統計・公式発表・論文）で確認する。URL と値を `sources` に書く。
- 計算で出す数字はコードで計算し、式をメモに残す（`docs/agent-video-craft.md` §4 の例）。丸め方をそろえる。
- 大きな数字を「生活の単位」に翻訳する案を2〜3個考えて、一番想像しやすいものを使う。

## 2. 画風

`catalog/styles.json` の `fits`（合う題材）と `best`（得意なシーン）で選ぶ。本人の指定があればそれ。
迷ったら台本を先に書いて `node tools/styles/gallery.mjs <id> --styles a,b,c` で3案の静止画を並べ、本人に選んでもらう。

## 3. 台本（styled.json）

雛形は画風の SKILL.md の「雛形」。書き方は `docs/agent-video-craft.md` §3。最低限:

- `design.title`（28字以内、疑問形か意外な数字）、`design.hook.overlay`（8〜12字）
- 最初の beat は `role: "hook"`、最後は `role: "payoff"`
- 1 beat = 新しい情報1つ + 新しい画1つ、5〜9 beats
- 字幕チャンクは `／` で区切り 14〜20字（最大26）
- 画面の文字は数字・キーワード、ナレーションは文脈（同じ言葉を読み上げない）
- 効果音は見えている動作の時刻に `do: [{ "at": "line+0.3", "sfx": "pop" }]`（名前は `catalog/sfx3d.json` と `catalog/sfx-styles.json`）

## 4. 尺と lint

```bash
npm ci
npx tsc --noEmit
node tools/styles/render-style.mjs <id> --timeline-only
```
VOICEVOX が無いと推定タイミングになる。**実音声は推定の約1.3倍**。推定 15〜35 秒を目安にする。

## 5. 静止画と機械の目

```bash
node tools/styles/render-style.mjs <id> --stills auto --scale 0.5   # シーンごとの静止画 outputs/styles/<id>/still-*.jpg
node tools/styles/render-style.mjs <id> --inspect --scale 0.5      # outputs/styles/<id>/inspect/inspect.md と枠付き画像
```

- `inspect.md` の error は必ず直す。warning も全部読み、直すか、直さない理由を報告に書く。
  - `unsafe-zone`: スマホのUIで隠れる位置 / `caption-over-content`: 字幕が画面の文字に重なる / `caption-over-face` / `figure-cut` / `text-cut` / `tiny-text` / `low-contrast`
- 静止画を横に並べて自分で見る（`docs/agent-video-craft.md` §2 の順番）。機械は「何が映っているか」「分かりやすいか」は判断できない。
- 画像を見られない環境では、inspect の結果に加えて `timeline.json` の各シーンの中身（テキスト・数値・人物の位置）を読み上げて確かめる。
- エンジンを直したら、全画風で回帰を見る:
  ```bash
  for s in $(node -e "console.log(require('./catalog/styles.json').styles.map(s=>s.id).join(' '))"); do
    node tools/styles/render-style.mjs <id> --style $s --inspect --scale 0.4 --no-lint | grep '^inspect'; done
  ```

## 6. 本番

- ローカルに VOICEVOX（`$VOICEVOX_URL`、既定 `127.0.0.1:50021`）があれば `node tools/styles/render-style.mjs <id>`。
- 無ければブランチを push して PR を作る（`productions/*/styled.json` の変更で **Style Shorts** が自動実行され、声付き MP4 と `review/`・`inspect/` が artifact に出る）。手動なら Actions → Style Shorts → `production=<id>`。
  - 声だけ作る: `voices_only=true` → artifact の `three-voice/` を `outputs/three-voice/` に入れて、手元で本番レンダリング。
- `node tools/styles/qa.mjs <id>`（review 一式・実音声・尺・映像と音の長さ・-14 LUFS・クレジット・lint）。
- `review/contact-sheet.jpg` と `review/first-frame-phone.png` を見る。

## 7. 報告

`docs/agent-video-craft.md` §10。技術（尺・音量・inspect・QA）と内容（未評価）を分ける。音を聞いていなければそう書く。

## 8. 公開（本人の指示があるときだけ）

```bash
node tools/styles/publish-pack.mjs <id> --publisher <video-publisher checkout> --concept <本人が指定した投稿先>
```
video-publisher 側でブランチ・コミット・push（3D playbook §7 と同じ）。投稿後 `productions/<id>/published.json` に URL を記録。`meta.kind: "style-demo"` は公開しない。

## 9. 守ること

- 作品固有の分岐をエンジンに入れない。足りない部品は汎用に作って `docs/style-shorts.md` に書く。
- 画風を足したら `catalog/styles.json` → `node tools/styles/gen-skills.mjs` → 全画風の `--inspect`。
- 失敗して直したことは `docs/agent-video-craft.md` §8 に1行足す（次の人が同じ失敗をしないように）。

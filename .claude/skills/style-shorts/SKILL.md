---
name: style-shorts
description: トピックを渡されたら、21種類の画風（棒人間・動くグラフ・動く図解・紙の解説者・切り絵・アメコミ・リソグラフ・レトロアニメ・ドット絵・ミニマル線画・3Dアニメ・もしも3D・ローポリ・3Dルート・分解図・ブロックワールド・おもちゃブロック・レトロ3Dゲーム・ブロックホラー・クレイ・ゲームアバター）のどれかで、台本・ナレーション・BGM・字幕つきの縦型ショート動画（20〜58秒）を animation-factory で作る。「〇〇の動画を作って」「〇〇風のショート」「この話を動画に」のときに使う。
---

# Style Shorts — トピックから完成動画まで

手順書（関門つき）: `docs/style-shorts-playbook.md`。判断の理由と見るべき所: `docs/agent-video-craft.md`（**必ず先に読む**）。データ仕様: `docs/style-shorts.md`。画風ごとの型: `.claude/skills/style-<id>/SKILL.md`。画風一覧: `catalog/styles.json`。
このファイルは要約。食い違ったら playbook と craft が正しい。

## 0. 先に決めること（聞かずに決めてよい）
- **画風**: ユーザーが指定したらそれ。指定がなければ題材で選ぶ（下の表）。迷ったら `gallery.mjs` で2〜3案の静止画を見せて選んでもらう。
- **尺**: 25〜45秒（5〜9 beats）。1本1トピック、驚きは1つ。
- **声**: 既定は `青山龍星` speed 1.15。

| 題材 | 画風 |
|---|---|
| 数字の推移・比較 | living-chart / paper-presenter / comic |
| 仕組み・お金の流れ・手順 | living-diagram |
| 距離・移動・地理 | route-3d |
| 製品や物の中身 | exploded-view |
| あるある・体・小ネタ | stickman / clay / cartoon-3d |
| もしも〇〇だったら | what-if-3d / game-avatar / block-world |
| 宇宙・スケール | low-poly-3d / pixel-art / retro-anime |
| 怖い話・ゾッとする事実 | block-horror |
| 物語・やさしい話 | paper-cutout / risograph |
| 考え方・格言 | minimal-line |
| ノスタルジー・ミッション形式 | retro-console / toy-bricks |

## 1. 事実を集める
数字・固有名詞は必ずウェブで一次情報を確認し、`sources` に書く（lint が警告する）。確認できない数字は使わない。計算で出す数字はコードで計算して式を残す。大きな数字は生活の単位に翻訳する（38万km → 歩いて11年 → 小学1年生が高校生に）。模式図（route / exploded）は「模式図」と明記する。

## 2. 台本を書く（beats）
- 1 beat = 1つのナレーション + 1つの画。6秒以内に画を変える。
- 最初の beat（`role: "hook"`）で問いか意外な数字。`design.hook.overlay` は8〜12字。
- 画面の文字は数字・キーワード、ナレーションは文脈。同じ言葉を読み上げない。
- 推定の尺は実音声で約1.3倍になる。
- 字幕チャンクは `／` で区切り、1チャンク26字以内。秒数は書かない。
- 最後の beat（`role: "payoff"`）で回収。狙いすぎた小道具オチ・説明の言い直しで終えない。
- 画風の SKILL.md の「構成の型」に沿ってシーンを選ぶ。

## 3. 作って見る
```bash
# productions/<id>/styled.json を書いたら
node tools/styles/render-style.mjs <id> --timeline-only            # 尺・lint
node tools/styles/render-style.mjs <id> --stills auto --scale 0.5   # シーンごとの静止画を自分で見る
```
```bash
node tools/styles/render-style.mjs <id> --inspect --scale 0.5      # 機械の目：はみ出し・重なり・小さい文字・コントラスト・スマホUIの位置
```
`inspect/inspect.md` の error は必ず直し、warning は全部読む。そのうえで静止画を並べて自分で見る（`docs/agent-video-craft.md` §2 の順番）：1枚目で話題が分かるか／主役は1つか／字幕と絵が重ならないか／人物が切れていないか／数字と単位が正しいか。

## 4. 本番レンダリング
VOICEVOX が `$VOICEVOX_URL` にあればローカルで `node tools/styles/render-style.mjs <id>`。無ければブランチを push して GitHub Actions「Style Shorts」を `production=<id>` で実行（PR でも styled.json の変更で自動実行）。artifact に MP4・contact-sheet・captions.srt・description.txt が出る。
その後 `node tools/styles/qa.mjs <id>`（技術QAのみ）。

## 5. 報告
完成MP4と contact sheet を見せ、技術QAの結果と「内容の良し悪しは未評価」を分けて伝える。

## 6. 公開
ユーザーが公開を指示し、投稿先（video-publisher の concept）を指定したときだけ：
`node tools/styles/publish-pack.mjs <id> --publisher <video-publisher checkout> --concept <concept>` → 投稿後 `productions/<id>/published.json` に URL を記録。`meta.kind: "style-demo"` は公開しない。

## やらないこと
- 実在のキャラクター・ゲーム・ブランドのロゴや名前を画面に出す（ブロック系・アバター系もオリジナルとして作る）。
- 出典のない数字、確認していない地名・所要時間。
- エンジン（`src/styles`）に作品固有の分岐を入れる。足りない部品は汎用に作って `docs/style-shorts.md` に書く。

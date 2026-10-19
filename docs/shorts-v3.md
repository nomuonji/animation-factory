# Shorts v3 — ネタを差し替えても「受ける」動画を作る仕組み

このリポジトリの Shorts 制作は v3 に一本化した。ピクセルアニメ（Phaser エンジン）は別系統として残る。

編集の考え方の正本は My Portal chatSkills `short-form-video-direction`。このファイルは道具と手順の説明。

## 原則

1. **素材が先、台本が後。** 0秒に置ける強い実映像、途中の二段目の変化、最後の回収ショットが揃わないネタは作らない（ネタを変える）。
2. **型に流し込む。** どのネタも `format`（下表）のどれかに乗せる。各ビートは「前のビートから何が新しく見えるか（`why`）」を持つ。
3. **ネイティブな見た目。** 全画面の実映像、音声と同期した大きな字幕、短いカット、ゆっくりした寄り。枠・バッジ・進捗バーなどの「資料っぽさ」は使わない。
4. **自動で付くのは技術合格まで。** `technical_pass` は書き出しが正しいという意味だけ。`editorial_pass` は実際に見た人が付ける。

## 型（format）

| format | 流れ | 0秒に置くもの |
|---|---|---|
| transformation | hook › setup › evidence › escalation › turn › payoff | 変化後（途中）の一番強い画 |
| myth-flip | hook › setup › turn › evidence › escalation › payoff | 皆が信じている姿＋「実は違う」の匂わせ |
| guess-reveal | hook › setup › evidence › turn › payoff | 問いの対象（答えは隠す） |
| scale-ladder | hook › evidence › escalation › escalation › payoff | 最上段を一瞬、または出発点の小ささ |
| process | hook › evidence › evidence › escalation › payoff | 完成形 |

`python tools/shorts/shorts.py formats` で一覧できる。

## 手順

GitHub 上では **PR にコミットするだけで動く**（Actions「Shorts v3」）。main へのマージは不要で、成果物は実行ページからダウンロードできる。

- `shorts-requests/scout.txt` を変更 → 素材検索＋サムネ一覧
- `shorts-requests/inspect.txt` を変更 → 指定素材のダウンロード＋1本ごとのコマ送りシート（台本を書く前に必ず見る）。素材ファイルも成果物に入るので、手元の `outputs/shorts-sources/` に置けばローカルでレンダリングできる
- `productions/<id>/short.json` を変更 → 素材検索（`search` がある場合）、ロック、レンダリング、レビュー一式

ローカルでの手順:

```
# 0. 題材を決める前に素材を見る（Actions: Shorts v3 / mode=scout）
python tools/shorts/shorts.py scout "hummingbird slow motion" "octopus camouflage"
#    -> outputs/scout/candidates.json と candidates.jpg（サムネ一覧）

# 1. ブリーフの雛形
python tools/shorts/shorts.py new <id> --topic "..." --format transformation [--source market-idea]

# 2. 各ビートに search（英語キーワード）を書き、素材検索（Actions: mode=find）
python tools/shorts/shorts.py find productions/<id>/short.json

# 3. ショットに素材IDと in 点を書き、ロック（ダウンロード＋sha256＋ライセンス記録）
python tools/shorts/shorts.py lock productions/<id>/short.json

# 4. 尺と注意点の確認（音声を合成して実際の尺を出す）
python tools/shorts/shorts.py check productions/<id>/short.json --timing

# 5. レンダリング（Actions: mode=render）
python tools/shorts/shorts.py render productions/<id>/short.json
```

出力（`outputs/shorts/<id>/`、Actions では成果物 `short-<id>`）:

- `video.mp4` 1080×1920 / 30fps / H.264 / AAC、-14 LUFS 目標
- `review/first-frame-phone.png` 0秒の画をスマホサイズで（無音で意味が伝わるか）
- `review/contact-sheet.jpg` 1秒ごとのフレームとビート名
- `review/scorecard.md` 6軸の編集審査シート（空欄。見た人が埋める）
- `captions.srt`、`description.txt`（全クレジット入り）、`timeline.json`、`report.json`

## ブリーフの要点（`productions/<id>/short.json`）

- `promise.firstFrame` / `promise.payoff`: 0秒に見えるものと、最後に回収するもの。
- `beats[].say`: ナレーション。`／` で字幕の区切りを指定。字幕は音声のモーラ位置に同期する。
- `beats[].emphasis`: 黄色にする語。`overlay`: そのビートだけの見出し（主にフック）。
- `beats[].shots[].label`: 画面左上の小さな注記（例: 「研究映像（8倍速）」）。早送り・スロー・別個体などは必ず画面に出す。
- `beats[].shots[]`: `src`（`pixabay:<id>` / `commons:<ファイル名>` / `local:<相対パス>`）、`in`（秒）、`speed`、`focus`（切り抜き中心 0..1）、`zoom`（[開始,終了]）、`frame`（`fill` 全画面 / `fit` 全体を見せる）、`weight`（ビート内の長さ配分）。
- ビートの長さは音声の長さで自動決定（`min` で下限、`hold` で余韻）。
- `voice`: VOICEVOX の話者とスタイル、速度。`music`: `catalog/asset-library.json` の曲ID、音量、声の下での下げ幅。

## 素材とライセンス

- 資格情報（APIキー）は必ず Actions の **Secrets** に置く。**Variables はログに平文で出る**ので使わない。ワークフローも secrets 以外からは読まない。

- Pixabay（`PIXABAY_API_KEY` を Actions シークレットに登録済み）: 商用無料・表記不要。ただし無加工の再配布・販売は不可、写っている人物やブランドの推奨と誤解させない。説明欄には作者を載せる。
- Wikimedia Commons: CC0 / PD / CC BY / CC BY-SA のみ。BY-SA を使った動画は同ライセンス表記が必要（`description.txt` に自動で入る）。
- 音声: VOICEVOX（クレジット「VOICEVOX:話者名」を自動記載）。各キャラクターの利用規約を守る。
- BGM: 現在は CC0 の 3 曲のみ（`assets/music`）。曲を足すときは `catalog/asset-library.json` に作者・ライセンス・出典を登録する。
- YouTube の楽曲ライブラリや流行曲はダウンロードして使わない。

## 試作例

- `productions/lightning-upward`（myth-flip、29.6秒）: 240fps の落雷映像で「光は下から上」「同じ道が光り直す」を実映像で見せる。
- `productions/chameleon-signal`（myth-flip、40.1秒）: 2026-10-17 に本人が良いと評価した研究映像カメレオンを、思い込み→反証→仕組み→戻り→回収の二段構成で作り直したもの。

どちらも `status: draft`（技術合格のみ）。編集合格は視聴した人が付ける。

## ネタの入口

ネタの出どころは問わない。`topic.source` に `manual` / `market-idea`（Keywords Idea Memory）/ `x-post`（過去のX投稿）などを記録するだけで、工程は同じ。市場アイデアでも、映像で見せられないものは作らない。

# 英語レッスン動画（エラーで学ぶ英語チャンネル）

`lessons/<id>.json` に**教える中身だけ**を書くと、`tools/shorts/lesson.py` がパターンに沿って
Shorts v3 のブリーフ（`productions/<id>/short.json`）を組み立てる。

```
python tools/shorts/shorts.py lesson lessons/<id>.json   # ブリーフを生成
```

生成したブリーフを PR にコミットすると、Actions「Shorts v3」がレンダリングとレビュー一式を作る。
公開は error-english リポジトリの `publish-requests/animation-factory/<id>.request.json` と `<id>.mp4` を main に追加する（チャンネル主の承認後）。

## 必ず守る作り方（2026-10-20 チャンネル主の評価から）

- 1本1ターゲット。日常で使える表現か、覚える価値のある単語だけ。雑学や文法の細部を主題にしない。
- 答えは早く出す。英語は最低3回聞かせる（普通の速さ・ゆっくり・最後のまとめ）。例文もすべて英語音声で。
- 視聴者が自分で言う時間を作る（クイズ、約3秒の間）。
- 最後は冒頭の問いに戻って答えを言い切る。終盤に新しい事実を足さない。
- 尺は長めでよい（目安60〜90秒）。水増しはしない。
- 意味は辞書で確認し、`sources` に URL を書く。

## パターン

| pattern | シリーズ名 | 流れ | 向いている題材 |
|---|---|---|---|
| `phrase` | 言えそうで言えない一言 | 場面の問い → 答え×2 → 意味 → 例文2つ → クイズ → まとめ | 日常の一言（遅れそう、気にしないで、等） |
| `word` | ちょっと難しい英単語 | 単語を見せて問う → 発音×2 → 意味とイメージ → 例文2つ → 穴埋めクイズ → まとめ | B2〜C1 の単語（meticulous, procrastinate, …） |
| `vs` | どっちを使う？ | 二択の問い → 見分け方 → それぞれの例文 → どっちクイズ → 見分け方で締める | 紛らわしい2語（affect/effect, borrow/lend, …） |
| `upgrade` | very から卒業 | いつもの言い方 → 強い1語×2 → very との違い → 例文2つ → クイズ → まとめ | very + 形容詞の言い換え（exhausted, starving, …） |

## スペックの書き方（共通）

- ナレーション（日本語・VOICEVOX）は文字列、または `{"cap": 字幕, "say": 読み上げ}`。英語を字幕に出すときは必ず `say` を日本語にする（VOICEVOX は英語を読めない）。
- 英語の音声は Kokoro（`af_heart` / `am_michael`）で自動生成。例文は1文ずつ `en` と `ja` を対で書く。
- 画面の素材は `catalog/lesson-scenes.json` のタグで指定する（`scene`、`scenes.hook/answer/meaning`）。1つのタグに複数の候補（Commons の写真、Pixabay の動画）があり、レッスンの id から1つが選ばれる（`sceneVariant: {タグ: 番号}` で固定も可）。動画は場面ごとに再生位置をずらし、短ければ繰り返す。プールにない素材は使わない。足すときは実物を見てから登録する。
- 主なタグ：office-desk, desk-flatlay, smartphone, texting-street, cafe, street-waiting, rain-street, station-platform, train-rush, airport, classroom, library, kitchen, thinking, frustrated, stretch-desk, office-clocks, meeting, city-night, notebook-writing, hurry, argument, construction, elderly, laughing, phone-call, living-room, laptop-watch, watch-woman

各パターンの見本は `lessons/` にある（`en-running-late.json` は公開済み #1 と同じ中身。#1 の動画そのものは手で調整したブリーフから作った）。

## 難易度（2026-10-20 チャンネル主の指示）

英検1級より上。英検1級の単語集の頻出語は避ける。ネイティブは普通に使うが試験には出にくい語（口語・イディオム・ネイティブも混同する組・強い言い換え）を選ぶ。詳しくは `lessons/BACKLOG.md`。

## 量産の流れ（2026-10-20〜 全自動）

チャンネル主の指示により、人の確認なしで公開まで自動で回る。

1. `lessons/BACKLOG.md` から選び、レッスンの台本（このリポジトリの `lessons/<id>.json` と同じ形式）を書く。
2. **error-english** の `publish-queue/scripts/NNNN-<id>.json` に置いて main に push する（番号は既存の続き。パターンが連続しないよう並べる）。
3. error-english の「Publish queued English lessons」が 11:47 / 19:47 JST に次の1本を取り、このリポジトリ（main）の制作ツールでその場で動画を作り、自動チェック（尺20〜120秒、音量、描画の成否）を通ったら公開する。1日最大2本。
4. 描画やチェックに失敗した台本は `publish-queue/failed/` に理由付きで移る（自動で再挑戦しない）。公開記録は `publish-queue/published/log.json`。
5. 止めるときは error-english の `publish-queue/config.json` の `enabled` を `false` にする。

台本は公開前に人が見ないので、書く段階で品質を担保する。新しい台本は、まずこのリポジトリの `lessons/` に入れて PR のプレビュー描画で確認してから error-english に送るのが安全。

日本語ナレーション（`say`）に英字があると生成時にエラーになる（VOICEVOX は英語を読めない）。英単語はカタカナで書くか、字幕（`cap`）だけに出す。

## ネタ帳

`lessons/BACKLOG.md`

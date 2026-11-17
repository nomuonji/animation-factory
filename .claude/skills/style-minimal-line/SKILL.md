---
name: style-minimal-line
description: 「ミニマル線画」画風のショート動画をトピックから作る（animation-factory Style Shorts）。人生観・考え方・格言・比喩。静かで余白のある話。ユーザーが「ミニマル線画で」「ミニマル線画風の動画」と言ったとき、またはこの見た目が合う題材のときに使う。
---

# ミニマル線画（`minimal-line`）

全体の手順は `docs/style-shorts-playbook.md`、判断の理由と見るべき所は `docs/agent-video-craft.md`、データ仕様は `docs/style-shorts.md`。このファイルは「ミニマル線画」固有の作り方だけを書く（普通の Markdown なので、どのエージェントもそのまま読んで使える）。

## 見た目
黒背景に白い一本線だけ。ペン先の点が線を描き続ける。小さな白文字。

- エンジン: 2D（Canvas、1フレーム約30ms）
- 得意なシーン: `path` `stage` `card` `quote`
- 既定BGM: `safe-space-loop` / シーン切替音なし

## 合う題材
人生観・考え方・格言・比喩。静かで余白のある話

## 構成の型
hook=path（線が描かれ始める）→ quote/card で一言 → stage（白線の人物が1人）→ path で締め

## セット
void のみ（自動）

## 人物・小道具
人物は線だけ・顔なし。動きは walk / sit / point-up など少なめ

## やらないこと
色・アイコンを増やさない。早口にしない（speed 1.05 前後、post を長め）

## 雛形

```json
{
  "meta": {
    "id": "my-topic",
    "title": "タイトル"
  },
  "style": "minimal-line",
  "design": {
    "title": "動画タイトル（疑問形か意外な数字）",
    "hook": {
      "overlay": "短いフック"
    }
  },
  "sources": [
    "数字を使うなら出典"
  ],
  "beats": [
    {
      "id": "hook",
      "role": "hook",
      "line": {
        "who": "n",
        "text": "最初の一言で／問いを立てる"
      },
      "visual": {
        "scene": "path",
        "shape": "wander",
        "text": "道はまっすぐじゃない"
      }
    },
    {
      "id": "answer",
      "line": {
        "who": "n",
        "text": "答えや数字を／ひとつだけ"
      },
      "visual": {
        "scene": "card",
        "text": "答え",
        "sub": "補足"
      }
    },
    {
      "id": "payoff",
      "role": "payoff",
      "line": {
        "who": "n",
        "text": "最後に／回収する一言"
      },
      "visual": {
        "scene": "stage",
        "actors": [
          {
            "id": "a",
            "pose": "cheer",
            "face": "laugh"
          }
        ]
      }
    }
  ]
}
```

## 確認

```bash
node tools/styles/render-style.mjs <id> --stills auto --scale 0.5   # シーンごとの静止画を見る
node tools/styles/render-style.mjs <id> --inspect --scale 0.5      # はみ出し・重なり・小さい文字・コントラスト・スマホUIの位置（error は必ず直す）
node tools/styles/render-style.mjs <id>                            # 本番（VOICEVOX が必要。無ければ Actions「Style Shorts」）
node tools/styles/qa.mjs <id>
```

他の画風と見比べたいときは `node tools/styles/gallery.mjs <id> --styles minimal-line,<別のid>`。

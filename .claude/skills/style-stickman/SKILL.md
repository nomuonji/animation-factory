---
name: style-stickman
description: 「棒人間」画風のショート動画をトピックから作る（animation-factory Style Shorts）。あるある、小ネタ、体のしくみ、もしもの話。キャラが1〜2人で動けば成立する話。ユーザーが「棒人間で」「棒人間風の動画」と言ったとき、またはこの見た目が合う題材のときに使う。
---

# 棒人間（`stickman`）

全体の手順は `docs/style-shorts-playbook.md`、判断の理由と見るべき所は `docs/agent-video-craft.md`、データ仕様は `docs/style-shorts.md`。このファイルは「棒人間」固有の作り方だけを書く（普通の Markdown なので、どのエージェントもそのまま読んで使える）。

## 見た目
白い丸顔と黒い線の棒人間。しましまシャツ。空と海と砂浜のような明るい単色背景、線は手描き風にわずかに震える。

- エンジン: 2D（Canvas、1フレーム約30ms）
- 得意なシーン: `stage` `card` `list`
- 既定BGM: `numskull` / シーン切替音: `pop`

## 合う題材
あるある、小ネタ、体のしくみ、もしもの話。キャラが1〜2人で動けば成立する話

## 構成の型
hook=stage（人物が疑問のポーズ＋emote ?）→ card/counterで答え → stageで体を張って再現 → payoff=stageでオチ

## セット
beach park city room space sky

## 人物・小道具
人物は1〜2人。color で服の縞の色、hair は基本 none。face は大きく変える（smug→shock→laugh）。tongue や dizzy がこの画風に合う

## やらないこと
グラフを多用しない（線画の人物が主役）。3人以上並べない

## 雛形

```json
{
  "meta": {
    "id": "my-topic",
    "title": "タイトル"
  },
  "style": "stickman",
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
        "scene": "stage",
        "actors": [
          {
            "id": "a",
            "x": 0,
            "pose": [
              [
                "start",
                "idle"
              ],
              [
                "line+0.5",
                "think"
              ]
            ],
            "face": "smug",
            "emote": [
              [
                "line+1",
                "?"
              ]
            ]
          }
        ]
      }
    },
    {
      "id": "answer",
      "line": {
        "who": "n",
        "text": "答えや数字を／ひとつだけ"
      },
      "visual": {
        "scene": "counter",
        "from": 0,
        "to": 384400,
        "unit": "km",
        "label": "地球 → 月",
        "icon": "moon"
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

他の画風と見比べたいときは `node tools/styles/gallery.mjs <id> --styles stickman,<別のid>`。

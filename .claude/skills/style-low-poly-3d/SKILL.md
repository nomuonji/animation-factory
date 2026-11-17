---
name: style-low-poly-3d
description: 「ローポリ3D」画風のショート動画をトピックから作る（animation-factory Style Shorts）。宇宙・地球・自然・スケールの話。ユーザーが「ローポリ3Dで」「ローポリ3D風の動画」と言ったとき、またはこの見た目が合う題材のときに使う。
---

# ローポリ3D（`low-poly-3d`）

全体の手順は `docs/style-shorts-playbook.md`、判断の理由と見るべき所は `docs/agent-video-craft.md`、データ仕様は `docs/style-shorts.md`。このファイルは「ローポリ3D」固有の作り方だけを書く（普通の Markdown なので、どのエージェントもそのまま読んで使える）。

## 見た目
フラットシェーディングの角ばった岩と人物、宇宙の暗い背景に紫と橙。

- エンジン: 3D（three.js、1フレーム約0.5〜0.9秒）
- 得意なシーン: `stage` `card`
- 既定BGM: `lofi-loop-scoop` / シーン切替音: `whoosh`

## 合う題材
宇宙・地球・自然・スケールの話

## 構成の型
hook=stage（宇宙の岩場に人物）→ counter（距離・大きさ）→ card → stage

## セット
space-rocks（自動）

## 人物・小道具
角ばった体。fly / point-up が合う。小道具 moon / rocket

## やらないこと
生活の場面（部屋・店）には合わない

## 雛形

```json
{
  "meta": {
    "id": "my-topic",
    "title": "タイトル"
  },
  "style": "low-poly-3d",
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

他の画風と見比べたいときは `node tools/styles/gallery.mjs <id> --styles low-poly-3d,<別のid>`。

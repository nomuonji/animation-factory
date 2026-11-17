---
name: style-block-world
description: 「ブロックワールド」画風のショート動画をトピックから作る（animation-factory Style Shorts）。サバイバル・建築・ゲーム風の挑戦。ユーザーが「ブロックワールドで」「ブロックワールド風の動画」と言ったとき、またはこの見た目が合う題材のときに使う。
---

# ブロックワールド（`block-world`）

全体の手順は `.claude/skills/style-shorts/SKILL.md`、データ仕様は `docs/style-shorts.md`。このファイルは「ブロックワールド」固有の作り方だけを書く。

## 見た目
立方体ブロックの丘と木、四角い頭のボクセル人物。

- エンジン: 3D（three.js、1フレーム約0.5〜0.9秒）
- 得意なシーン: `stage` `card`
- 既定BGM: `little-happy-tune` / シーン切替音: `pop`

## 合う題材
サバイバル・建築・ゲーム風の挑戦

## 構成の型
hook=stage（ボクセルの丘に人物）→ stage（walk / jump で試す）→ card → stage cheer

## セット
voxel-hills（自動）

## 人物・小道具
四角い頭。hair: short（ブロックの髪）。小道具 tree / box

## やらないこと
特定ゲームのロゴ・キャラ名・UI を出さない（オリジナルのブロック世界として作る）

## 雛形

```json
{
  "meta": {
    "id": "my-topic",
    "title": "タイトル"
  },
  "style": "block-world",
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
node tools/styles/render-style.mjs <id>                            # 本番（VOICEVOX が必要。無ければ Actions「Style Shorts」）
node tools/styles/qa.mjs <id>
```

他の画風と見比べたいときは `node tools/styles/gallery.mjs <id> --styles block-world,<別のid>`。

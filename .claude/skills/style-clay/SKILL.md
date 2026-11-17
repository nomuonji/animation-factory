---
name: style-clay
description: 「クレイアニメ」画風のショート動画をトピックから作る（animation-factory Style Shorts）。やさしい雑学、子ども・食べ物・動物。ユーザーが「クレイアニメで」「クレイアニメ風の動画」と言ったとき、またはこの見た目が合う題材のときに使う。
---

# クレイアニメ（`clay`）

全体の手順は `.claude/skills/style-shorts/SKILL.md`、データ仕様は `docs/style-shorts.md`。このファイルは「クレイアニメ」固有の作り方だけを書く。

## 見た目
指跡のある粘土の質感、丸い人物、柔らかい光、コマ撮り風にカクつく動き。

- エンジン: 3D（three.js、1フレーム約0.5〜0.9秒）
- 得意なシーン: `stage` `card`
- 既定BGM: `ukulele-short-loop` / シーン切替音: `pop`

## 合う題材
やさしい雑学、子ども・食べ物・動物

## 構成の型
hook=stage → stage continue → card → stage。動きは自動で12コマ/秒のカクつき

## セット
clay-sky（自動）

## 人物・小道具
丸い粘土の人物。face を豊かに（happy / shock / blush）。小道具 burger / heart / sun

## やらないこと
速い動き（run）を多用しない（コマ撮り感が出ない）

## 雛形

```json
{
  "meta": {
    "id": "my-topic",
    "title": "タイトル"
  },
  "style": "clay",
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

他の画風と見比べたいときは `node tools/styles/gallery.mjs <id> --styles clay,<別のid>`。

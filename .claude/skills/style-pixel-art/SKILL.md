---
name: style-pixel-art
description: 「ドット絵」画風のショート動画をトピックから作る（animation-factory Style Shorts）。ゲーム風の挑戦、レベルアップ型の説明、宇宙。ユーザーが「ドット絵で」「ドット絵風の動画」と言ったとき、またはこの見た目が合う題材のときに使う。
---

# ドット絵（`pixel-art`）

全体の手順は `.claude/skills/style-shorts/SKILL.md`、データ仕様は `docs/style-shorts.md`。このファイルは「ドット絵」固有の作り方だけを書く。

## 見た目
1/6解像度で描いて最近傍拡大した本物の粗いドット。夜空・月・家。等幅フォントの字幕箱。

- エンジン: 2D（Canvas、1フレーム約30ms）
- 得意なシーン: `stage` `card` `counter`
- 既定BGM: `little-happy-tune` / シーン切替音: `tick`

## 合う題材
ゲーム風の挑戦、レベルアップ型の説明、宇宙

## 構成の型
hook=stage（chip: 'STAGE 1' など）→ counter（ゲームのスコア風）→ stage（jump / walk）→ card 'CLEAR'

## セット
night-pixel（宇宙も自動）, beach, park, city

## 人物・小道具
細部は潰れるので大きなポーズで見せる。emote ! ? が効く

## やらないこと
小さい文字・細い線を使わない（1/4 解像度で潰れる）

## 雛形

```json
{
  "meta": {
    "id": "my-topic",
    "title": "タイトル"
  },
  "style": "pixel-art",
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

他の画風と見比べたいときは `node tools/styles/gallery.mjs <id> --styles pixel-art,<別のid>`。

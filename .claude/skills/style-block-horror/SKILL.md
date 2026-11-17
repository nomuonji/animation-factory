---
name: style-block-horror
description: 「ブロックホラー」画風のショート動画をトピックから作る（animation-factory Style Shorts）。怖い話・ゾッとする事実。ユーザーが「ブロックホラーで」「ブロックホラー風の動画」と言ったとき、またはこの見た目が合う題材のときに使う。
---

# ブロックホラー（`block-horror`）

全体の手順は `.claude/skills/style-shorts/SKILL.md`、データ仕様は `docs/style-shorts.md`。このファイルは「ブロックホラー」固有の作り方だけを書く。

## 見た目
真っ暗な廊下、ブロック状の長身の影、光る白い目、強いビネット。

- エンジン: 3D（three.js、1フレーム約0.5〜0.9秒）
- 得意なシーン: `stage` `card`
- 既定BGM: `tension-build` / シーン切替音なし

## 合う題材
怖い話・ゾッとする事実

## 構成の型
hook=stage（暗い廊下、主人公が scared）→ stage continue（奥に color: shadow の人物が現れる）→ card（一言）→ stage

## セット
dark-corridor（自動）

## 人物・小道具
影の人物は z を奥（-3〜-6）に置き、近づくときは to.z。emote は ... や !

## やらないこと
過度にグロい表現は入れない。驚かせる音は1回まで

## 雛形

```json
{
  "meta": {
    "id": "my-topic",
    "title": "タイトル"
  },
  "style": "block-horror",
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

他の画風と見比べたいときは `node tools/styles/gallery.mjs <id> --styles block-horror,<別のid>`。

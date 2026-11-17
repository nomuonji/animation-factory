---
name: style-comic
description: 「アメコミ」画風のショート動画をトピックから作る（animation-factory Style Shorts）。大げさな事実、ランキング、勢いのある驚きネタ。ユーザーが「アメコミで」「アメコミ風の動画」と言ったとき、またはこの見た目が合う題材のときに使う。
---

# アメコミ（`comic`）

全体の手順は `.claude/skills/style-shorts/SKILL.md`、データ仕様は `docs/style-shorts.md`。このファイルは「アメコミ」固有の作り方だけを書く。

## 見た目
黄色の集中線、網点（ハーフトーン）、黒い太線、爆発型の吹き出し、コマ枠。

- エンジン: 2D（Canvas、1フレーム約30ms）
- 得意なシーン: `stage` `card` `counter`
- 既定BGM: `numskull` / シーン切替音: `boom`

## 合う題材
大げさな事実、ランキング、勢いのある驚きネタ

## 構成の型
hook=stage（shock の顔＋camera.shake）→ card（爆発の吹き出しで一言）→ counter → stage でオチ

## セット
burst（自動）, city

## 人物・小道具
人物は太い輪郭。emote ! と anger、pose shock / cheer / panic が映える

## やらないこと
落ち着いた話・しんみりした話には使わない

## 雛形

```json
{
  "meta": {
    "id": "my-topic",
    "title": "タイトル"
  },
  "style": "comic",
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

他の画風と見比べたいときは `node tools/styles/gallery.mjs <id> --styles comic,<別のid>`。

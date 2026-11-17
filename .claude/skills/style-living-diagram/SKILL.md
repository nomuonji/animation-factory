---
name: style-living-diagram
description: 「動く図解」画風のショート動画をトピックから作る（animation-factory Style Shorts）。仕組み・お金の流れ・因果関係・手順の説明。ユーザーが「動く図解で」「動く図解風の動画」と言ったとき、またはこの見た目が合う題材のときに使う。
---

# 動く図解（`living-diagram`）

全体の手順は `docs/style-shorts-playbook.md`、判断の理由と見るべき所は `docs/agent-video-craft.md`、データ仕様は `docs/style-shorts.md`。このファイルは「動く図解」固有の作り方だけを書く（普通の Markdown なので、どのエージェントもそのまま読んで使える）。

## 見た目
薄いグレー背景、塗りつぶしのピクトグラム人物、丸いアイコンノードと点線矢印、黒いラベルタグ。

- エンジン: 2D（Canvas、1フレーム約30ms）
- 得意なシーン: `diagram` `stage` `list` `counter`
- 既定BGM: `waiting-lounge` / シーン切替音: `whoosh`

## 合う題材
仕組み・お金の流れ・因果関係・手順の説明

## 構成の型
hook=stage（ピクトグラムの人が状況を演じる）→ diagram（流れ・因果）→ list（手順）→ counter（量）

## セット
plain city room

## 人物・小道具
人物は塗りつぶしのピクトグラム。diagram の nodes は 2〜5 個、edges に動詞のラベル

## やらないこと
ノードを詰め込まない。説明が長い beat は分割する

## 雛形

```json
{
  "meta": {
    "id": "my-topic",
    "title": "タイトル"
  },
  "style": "living-diagram",
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
        "scene": "diagram",
        "nodes": [
          {
            "id": "a",
            "icon": "person",
            "label": "あなた",
            "x": -0.5,
            "y": 0.4
          },
          {
            "id": "b",
            "icon": "house",
            "label": "お店",
            "x": 0.5,
            "y": -0.3
          }
        ],
        "edges": [
          {
            "from": "a",
            "to": "b",
            "label": "払う"
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

他の画風と見比べたいときは `node tools/styles/gallery.mjs <id> --styles living-diagram,<別のid>`。

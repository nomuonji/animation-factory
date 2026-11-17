---
name: style-living-chart
description: 「動くグラフ」画風のショート動画をトピックから作る（animation-factory Style Shorts）。人口・価格・記録など、時系列の数字で驚きがある話。出典必須。ユーザーが「動くグラフで」「動くグラフ風の動画」と言ったとき、またはこの見た目が合う題材のときに使う。
---

# 動くグラフ（`living-chart`）

全体の手順は `.claude/skills/style-shorts/SKILL.md`、データ仕様は `docs/style-shorts.md`。このファイルは「動くグラフ」固有の作り方だけを書く。

## 見た目
白背景、大きな数字のカウンターと、点が先頭で走る折れ線/伸びる棒。モノクロ＋差し色1色。

- エンジン: 2D（Canvas、1フレーム約30ms）
- 得意なシーン: `chart` `counter` `list`
- 既定BGM: `lofi-loop-scoop` / シーン切替音: `tick`

## 合う題材
人口・価格・記録など、時系列の数字で驚きがある話。出典必須

## 構成の型
hook=counter（いちばん驚く数字）→ chart line（推移）→ chart bar（比較）→ card で結論

## セット
plain

## 人物・小道具
人物は基本出さない。数字は format: short / comma を使い分け、unit を必ず付ける

## やらないこと
出典のない数字は使わない（sources 必須）。points は 4〜12 点

## 雛形

```json
{
  "meta": {
    "id": "my-topic",
    "title": "タイトル"
  },
  "style": "living-chart",
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
        "scene": "chart",
        "type": "bar",
        "label": "比較",
        "unit": "日",
        "bars": [
          {
            "label": "A",
            "value": 120
          },
          {
            "label": "B",
            "value": 30
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
        "scene": "card",
        "text": "結論"
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

他の画風と見比べたいときは `node tools/styles/gallery.mjs <id> --styles living-chart,<別のid>`。

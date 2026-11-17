---
name: style-exploded-view
description: 「分解図」画風のショート動画をトピックから作る（animation-factory Style Shorts）。製品・機械・食べ物などの中身や構造。ユーザーが「分解図で」「分解図風の動画」と言ったとき、またはこの見た目が合う題材のときに使う。
---

# 分解図（`exploded-view`）

全体の手順は `.claude/skills/style-shorts/SKILL.md`、データ仕様は `docs/style-shorts.md`。このファイルは「分解図」固有の作り方だけを書く。

## 見た目
黒背景で製品の層が宙に分かれ、細い引き出し線とラベルが付く。

- エンジン: 3D（three.js、1フレーム約0.5〜0.9秒）
- 得意なシーン: `exploded` `card` `counter`
- 既定BGM: `lofi-loop-scoop` / シーン切替音: `whoosh`

## 合う題材
製品・機械・食べ物などの中身や構造

## 構成の型
hook=exploded（まだ閉じた状態から開く）→ card（いちばん意外な層）→ counter（数・重さ）→ exploded continue

## セット
void-dark（自動）

## 人物・小道具
layers は上から順に 4〜7 枚。detail で補足の小さい字

## やらないこと
構造の事実は出典を確認。模式図と明記する

## 雛形

```json
{
  "meta": {
    "id": "my-topic",
    "title": "タイトル"
  },
  "style": "exploded-view",
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
        "scene": "exploded",
        "object": "phone",
        "title": "中身（模式図）",
        "layers": [
          {
            "label": "ガラス"
          },
          {
            "label": "画面"
          },
          {
            "label": "基板"
          },
          {
            "label": "電池"
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

他の画風と見比べたいときは `node tools/styles/gallery.mjs <id> --styles exploded-view,<別のid>`。

---
name: style-paper-presenter
description: 「紙の解説者」画風のショート動画をトピックから作る（animation-factory Style Shorts）。ニュースの裏側、数字の比較、制度やルールの解説。ユーザーが「紙の解説者で」「紙の解説者風の動画」と言ったとき、またはこの見た目が合う題材のときに使う。
---

# 紙の解説者（`paper-presenter`）

全体の手順は `docs/style-shorts-playbook.md`、判断の理由と見るべき所は `docs/agent-video-craft.md`、データ仕様は `docs/style-shorts.md`。このファイルは「紙の解説者」固有の作り方だけを書く（普通の Markdown なので、どのエージェントもそのまま読んで使える）。

## 見た目
新聞紙のような生成り色、明朝の見出し、赤い差し色と罫線。紙の切り抜きの解説者が横に立つ。

- エンジン: 2D（Canvas、1フレーム約30ms）
- 得意なシーン: `card` `counter` `list` `quote` `chart`
- 既定BGM: `bossa-thank-you-for-shopping` / シーン切替音: `whoosh`

## 合う題材
ニュースの裏側、数字の比較、制度やルールの解説

## 構成の型
hook=card（見出し）→ counter（数字）→ list → quote/chart → card で結論。紙面をめくる slide 遷移

## セット
newsprint（自動）

## 人物・小道具
人物を出すなら paper 体型で端に立たせ present / point で指す

## やらないこと
ポップな色を足さない（赤1色＋墨）

## 雛形

```json
{
  "meta": {
    "id": "my-topic",
    "title": "タイトル"
  },
  "style": "paper-presenter",
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
node tools/styles/render-style.mjs <id> --inspect --scale 0.5      # はみ出し・重なり・小さい文字・コントラスト・スマホUIの位置（error は必ず直す）
node tools/styles/render-style.mjs <id>                            # 本番（VOICEVOX が必要。無ければ Actions「Style Shorts」）
node tools/styles/qa.mjs <id>
```

他の画風と見比べたいときは `node tools/styles/gallery.mjs <id> --styles paper-presenter,<別のid>`。

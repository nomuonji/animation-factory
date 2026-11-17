---
name: style-route-3d
description: 「3Dルート」画風のショート動画をトピックから作る（animation-factory Style Shorts）。移動・距離・地理・「歩いたら何分」系。ユーザーが「3Dルートで」「3Dルート風の動画」と言ったとき、またはこの見た目が合う題材のときに使う。
---

# 3Dルート（`route-3d`）

全体の手順は `docs/style-shorts-playbook.md`、判断の理由と見るべき所は `docs/agent-video-craft.md`、データ仕様は `docs/style-shorts.md`。このファイルは「3Dルート」固有の作り方だけを書く（普通の Markdown なので、どのエージェントもそのまま読んで使える）。

## 見た目
白い建物ブロックの街を斜め上から。青いルート線が伸び、ピンと所要時間のカードが出る。

- エンジン: 3D（three.js、1フレーム約0.5〜0.9秒）
- 得意なシーン: `route` `counter` `card`
- 既定BGM: `lofi-loop-scoop` / シーン切替音: `tick`

## 合う題材
移動・距離・地理・「歩いたら何分」系

## 構成の型
hook=route（出発→到着、eta を出す）→ counter（距離）→ card（比較の一言）→ route で別ルート

## セット
city-white（route で自動）

## 人物・小道具
人物は出さない。route の text=出発地、label=到着地、eta=所要時間

## やらないこと
実在の地名・所要時間は地図サービス等で確認してから。実際の道順とは一致しない模式図だと説明に書く

## 雛形

```json
{
  "meta": {
    "id": "my-topic",
    "title": "タイトル"
  },
  "style": "route-3d",
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
        "scene": "route",
        "text": "出発",
        "label": "到着",
        "eta": "徒歩 9分"
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

他の画風と見比べたいときは `node tools/styles/gallery.mjs <id> --styles route-3d,<別のid>`。

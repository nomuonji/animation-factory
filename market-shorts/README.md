# Market Shorts → Shorts v3

2026-10-19 に Shorts の制作は **Shorts v3**（`tools/shorts/`、手順は `docs/shorts-v3.md`）へ一本化した。

退役したもの（git 履歴に残る）:

- `tools/market-shorts.mjs` と「実写真5枚必須」ルール、`market-shorts/photo-bank`、`market-shorts/briefs`
- Keywords フィードを読む `market-shorts-preview` ワークフロー
- `tools/footage-first-*`、`tools/chameleon-*` とそれぞれのワークフロー
- 博物館ネタの試作（`museum-idea-shorts-20261017-*`。「ごみ動画」判定の経緯は `docs/shorts-editorial-postmortem-20261017.md`）

市場アイデア（Keywords Idea Memory）は v3 のネタの入口の一つとして扱う。`shorts.py new <id> --source market-idea` で雛形を作り、`topic.ref` にアイデアIDを記録する。映像で見せられないアイデアは動画にしない。

## 未接続のまま残しているもの

`tools/market-shorts-upload.mjs` と `tools/market-shorts-analytics.mjs` は、実験用チャンネルを接続するときの YouTube アップロード（非公開のみ）と分析取得のアダプター。どのワークフローからも呼ばれていない。接続時は `YOUTUBE_CLIENT_ID` / `YOUTUBE_CLIENT_SECRET` / `YOUTUBE_REFRESH_TOKEN` / `YOUTUBE_CHANNEL_ID` が必要で、耐久的なアップロード記録を作るまで無人実行しない。

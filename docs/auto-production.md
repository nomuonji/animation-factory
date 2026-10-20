# 自動量産・自動公開（2026-10-20 ユーザー決定）

決定: 1日2〜3本、**完全自動で公開まで**。題材は ①実映像・実音声が取れる題材（Shorts v3）②過去のX投稿 ③Keywords Idea Memory の市場アイデア。

## 役割分担

| 段階 | 担当 | 備考 |
|---|---|---|
| 題材選び・素材確認・台本 | 定期タスク（Claude セッション）= プロデューサー | 実映像を見て決める。見られない題材は作らない |
| 描画・レビュー資料 | Actions「Shorts v3」（PRで自動プレビュー） | `technical_pass` まで |
| 編集審査 | プロデューサー | 下の編集ゲートを満たすものだけ `status: editorial_pass` |
| 公開 | Actions「Shorts auto publish (guarded)」 | ガードを通ったものだけ public |

## 1回の実行手順（プロデューサー）

1. `main` を最新にし、チャンネルの公開済み一覧と `productions/*/short.json` の `topic` を見て重複を避ける。
2. 題材を決める前に素材を見る（`shorts-requests/scout.txt` → PR プレビュー、または Actions `mode=scout`）。0秒に置ける強い実映像・途中の二段目の変化・最後の回収ショットが揃わなければ題材を変える。
3. `shorts-requests/inspect.txt` で素材のコマ送りを見る。台本はその後。
4. `python tools/shorts/shorts.py new <id> ...` でブリーフを作り、`productions/<id>/short.json` を PR にコミット。PR のプレビュー描画を待つ。
5. 成果物の `review/first-frame-phone.png`、`contact-sheet.jpg`、`scorecard.md` を実際に見て編集ゲートを判定する。不合格なら直して再描画、2回直して通らなければ題材を捨てる（公開しない）。
6. 合格したら `short.json` の `status` を `editorial_pass` にして PR を main にマージ。
7. Actions「Shorts auto publish (guarded)」を `production=<id>` で dispatch。結果（公開URL、またはガードで止まった理由）を確認して終わる。

## 編集ゲート（すべて満たす）

- 0秒の画が無音・スマホサイズで意味を伝える。
- 約束（`promise.firstFrame`）を最後に回収している（`payoff`）。途中に新しい見え方の変化がある。
- 実際の映像・音声が語りと対応している。静止画の並べ立てや資料スライド風は不可。
- 事実は出典があり、`descriptionLines` に出典とクレジット（CC BY / BY-SA 含む）が入っている。
- 音量・字幕の文字化け（豆腐）・尺（目安 20〜60 秒）に問題がない。
- 同じ型・同じ構図・同じ見出しの繰り返しになっていない（直近の公開動画と見比べる）。
- 題材源が `x-post` の場合は元投稿の主旨を歪めず、個人が特定される情報を出さない。`market-idea` の場合は映像で見せられることが条件で、商品の宣伝や根拠のない主張をしない。

## 自動公開のガード

- キルスイッチ: リポジトリ変数 `AUTO_PUBLISH_ENABLED` が `true` のときだけ動く。止めたいときは `false` に。
- 上限: 変数 `AUTO_PUBLISH_MAX_PER_DAY`（既定 3）。チャンネルの当日（JST）公開数で判定。
- 重複: 説明欄の `Production-ID: <id>` が既にチャンネルにあれば止まる。
- 公開は `editorial_pass` のブリーフのみ。`demo` 題材は不可。
- アップロード失敗の自動リトライなし。不確かな場合は YouTube Studio で確認してから。
- YouTube Data API クオータ: アップロード1本あたり約 1,600 ユニット、日次 10,000。1日3本で足りるが、手動の公開切り替えや削除を重ねると超える。

## 品質に問題が出たとき

- 公開後に問題が見つかった動画は Studio で非公開に戻す（または `shorts-delete-public.yml`）。
- `AUTO_PUBLISH_ENABLED=false` にして原因（編集ゲートの穴、素材、台本の型）を直してから戻す。
- 量産コンテンツ判定を避けるため、型・素材・見出し・構成が毎回違うことを維持する。

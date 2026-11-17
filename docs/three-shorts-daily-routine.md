# 3D コント 日次運用ルーチン（スケジュール実行の要約）

毎日クラウドで自動実行される「1本作って公開し、過去作の数字を分析する」ルーチンの中身をここに写しておく。
実際の起動プロンプトはスケジュールタスク側にあり、変わることがある。**食い違ったら起動プロンプトが正**。
制作の手順そのものは `docs/three-shorts-playbook.md`、実験の台帳は `docs/experiments.md`。

## 0. 前提

- 人は見ていない（無人実行）。迷ってもユーザーに質問で止まらず、妥当な解釈を決めて報告に書く。
- 対象は「おもしろ」コンセプトの3Dコント。YouTube と TikTok `oyu295`（Buffer 経由）。
- 使うリポジトリ: `nomuonji/animation-factory`（制作）、`nomuonji/video-publisher`（公開・数字取得）。fuzoku は**分析の数字の取得にだけ**使い、コードは変えず、その中身（成人向けサービス）には触れない。接続できない日は video-publisher の `YouTube Metrics`（`metrics.yml`）で代用する。
- GitHub は GitHub MCP（`mcp__github__*`）を使う。`gh` のトークンが無効な日がある。PR のマージは事前に許可されている。
- スケジュールの変更・停止はしない。

## 1. 最初に読むもの

AGENTS.md、`docs/three-shorts.md`、`docs/short-drama-design.md`、`catalog/` の各ファイル、テンプレ、既存の全コント（`productions/*/scene3d.json` と `published.json`）、`docs/experiments.md`。
笑いの好みは My Portal 側（スキル `short-form-video-direction`、メソッド `creative-thinking`、嗜好データの humor）を参照する。

## 2. 分析のルール（YouTube だけ。TikTok は対象外）

- 数字が決めてよいのは**構造**（フックの位置、維持率、尺、タイトルの付け方、オチの位置）だけ。**笑いの質は数字で判断しない。**
- 同じ条件の対象動画が3本そろうまで結論を出さない。「途中経過」と書き、n が少ないこと・再生数のばらつきを注記する。因果は言い切らない。
- **1回の実行で変える点は1つだけ。** 迷ったら変えず、報告に「判断が要る」と書く。
- 作った動画ごとに YouTube ID・公開日・尺・variant を `productions/<id>/metrics.json` と `docs/experiments.md` の台帳に記録する。数字は公開から3日たった窓（公開日〜+2日）で取る。
- 今日の variant は、実験が走っていなければ `baseline`。

## 3. 制作（1本）

- 案出し: 15案以上（3つ以上の操作）。各案は 場所／普通の出来事／外す1点。リポジトリのゲート（gateVersion 2、4系統以上、1系統40%まで、盲検での再分類、最終3案の総当たり比較、comedyAudit）を満たす。
- 落とす: 非現実的な場面、小道具の見せびらかし、造語の決め台詞、既存作との重複、終わりが不明瞭・唐突、35秒未満。
- 選ぶ基準: 場所とキャラだけで笑いが成立すること。
- 作る: `three-shorts/<id>` ブランチ、35〜50秒、タイトルカード先頭。lint・静止画・PR・`voices_only` 実行・実音声で尺確認・本番レンダリング・QA・マージ。細部は playbook §3〜§6。

## 4. 公開

playbook §7 のとおり（video-publisher の `incoming/<id>` ブランチ → Queue From Repo → Buffer Tool で `sent` を確認）。
失敗時: YouTube に出た動画は**二度と YouTube を含む postNow を送らない**。TikTok だけの再送は `sharenow` または `incoming/<id>-tiktok`。認証切れは Yuto の作業なので通知して止める。出せる出来にならなければ投稿しない。

## 5. 記録と報告

- 公開後、`productions/<id>/published.json` と `metrics.json`、`docs/experiments.md` を main に入れる（playbook §8）。
- 報告は `SendUserMessage`（最終の文章だけでは無人のとき読まれない）:
  1. 題・URL（YouTube／TikTok。出さなかったら理由）・尺
  2. 採用案（場所／外す1点／オチ）、不採用2〜3案と理由、配役とセット、直したこと、不確かな点（音は人が聞いていない等）
  3. 分析: 実験の状況と進み具合（n/3）、数字と基準との比較、判定か「途中経過」、実験を切り替えたか、取得の失敗、Yuto 側の作業
- 面白さを自分で採点しない。「技術チェックに合格」は「面白い」の根拠にしない。

## 6. 通知（PushNotification）

次のときだけ送る。何もなかった日は送らない。

- Yuto の作業が要るとき（認証切れ、投稿の失敗が自分で直せない、判断が要る分岐）
- ルーチン自体が動かなかったとき
- 本文は `<routine_summary>` タグで、最初の1文に要点、続けて開かなくても動ける詳しさで書く。

## 7. 禁止

二重投稿。露骨な性的内容、実在の人物・企業をからかう内容。fuzoku のコード変更。スケジュールの停止・変更。

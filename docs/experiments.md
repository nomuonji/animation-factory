# 検証の台帳（3Dコント）

目的: YouTube の再生データから、**構成・形式**（冒頭のフック位置、尺、タイトルの付け方、オチの置き方）の改善点を見つけ、
**1回に1つだけ変えて**確かめる。

> **笑いの質・好みの判断は Yuto のもので、数字では上書きしない。** 数字から言えるのは、冒頭で離脱するか、最後まで見られるか、
> 尺・タイトル・サムネ・オチの置き方で差があるか、まで。「面白い／面白くない」を数字から言い切らない。
> 案出しの基準（狙いすぎない・現実の土台）と「守ること」は、実験の名目でも変えない。

## 記録のしかた

- 各コントの `productions/<id>/metrics.json` に、YouTube ID・公開日・尺・variant（その話で変えた1点。無ければ `baseline`）・取得した数字を書く。
- 数字の取得: fuzoku リポジトリの GitHub Actions `metrics`（workflow_dispatch）を `mode=video`, `concept=おもしろ`,
  `videos="<YouTubeID>:<公開日 YYYY-MM-DD>:<尺秒>"`（空白区切りで複数）で実行し、ジョブログを読む。公開から3日以上たった動画だけ。取得済みは取り直さない。
  ログには 再生数・平均視聴時間/平均視聴率・登録者増・Shortsフィード経由・維持率（3/5/10/20秒/最後）が出る。
- 比較は同じ窓（公開日〜+2日）・同じ列どうし。尺が違う動画は平均視聴時間(秒)ではなく、平均視聴率・5秒/10秒の維持率で比べる。
- TikTok（oyu295）はこの検証に含めない（YouTube Analytics API では取れない）。
- 対象が3本そろうまでは「途中経過」とだけ書き、結論を出さない。n が少ないこと・再生数の大きなばらつき（拡散の当たり外れ）を必ず注記し、因果を言い切らない。

## 基準（baseline）

variant=`baseline` の既存コント。数字は未取得（下の「状況」参照）。基準の範囲は、取得できた baseline 動画から「典型的な範囲」として書く。

| 話 | YouTube | 公開日 | 尺(秒) | variant |
|---|---|---|---|---|
| atatame-juyojiko | QFWy27ZOfG8 | 2026-11-06 | 44 | baseline |
| doubutsu-tatoeru | 7oN8voHFk7w | 2026-11-07 | 28 | baseline |
| akabeko-shoumei | A2yBlXqO3YM | 2026-11-07 | 約21 | baseline |
| same-haisha | GU5hNNIqbZo | 2026-11-08 | 38 | baseline |
| kaeru-heyasagashi | tg6btRTmq4k | 2026-11-11 | 44.5 | baseline |
| akabeko-famiresu | 2fRumhxHr48 | 2026-11-12 | 40.5 | baseline |
| hotel-niyari-furonto | VkrBX8rLbC8 | 2026-11-13 | 44.0 | baseline |
| itsumono-hatsu | aObbaNGce-A | 2026-11-14 | 43.8 | baseline |
| kenon-shitsuon | uNomz8Qnp-U | 2026-11-15 | 45.1 | baseline |
| kyoryu-gym | WbiVJ9s1-vg | 2026-11-16 | 48.1 | baseline |
| sento-akami | Uw-Y2GPvS5Q | 2026-11-17 | 39.7 | baseline |
| yakiniku-matte | nfW4hXB9WkM | 2026-11-18 | 45.7 | baseline |
| kuyakusho-madoguchi | _jCPM2QM9cA | 2026-11-19 | 41.1 | baseline |
| toshokan-kashidashi | TDYNsKZFzN0 | 2026-11-20 | 43.9 | baseline |
| konbini-yakan | uAlCWf3hvgM | 2026-11-21 | 44.8 | baseline |
| densha-seki | mEHyrO3GFCg | 2026-11-22 | 41.5 | baseline |
| karaoke-uketsuke | gNbku9lR6eA | 2026-11-23 | 44.9 | baseline |
| coin-laundry-sentaku | SBY9KqDICCM | 2026-11-24 | 40.3 | baseline |
| genkan-takuhai | GTXQ7cRJSqk | 2026-11-25 | 43.9 | baseline |

## いま走っている実験

なし（2026-11-14 時点）。理由: 数字が1本も取れていないため、判定が出せず、次に変える点を選べない。**迷ったら変えない**。

## 状況（2026-11-18）

- 実験は走っていない（変更なし）。itsumono-hatsu (aObbaNGce-A, 11-14) の数字を取得（窓 11-14〜11-16）: 再生916・平均視聴43.8秒中29秒（66.1%）・登録者増1・高評価4・Shorts フィード879。維持率は3秒117.6%・5秒111.6%・10秒79.8%・20秒62.9%・最後46.8%。**途中経過**: 再生数は取得済み baseline の中で多い側だが、題材・公開時間・配信の当たり外れと切り分けられず、判定は出さない。
- kenon-shitsuon (11-15)・kyoryu-gym (11-16)・sento-akami (11-17) は公開から3日たたず未取得。
- 本日の yakiniku-matte (nfW4hXB9WkM) は variant=baseline（45.7秒）。

## 状況（2026-11-17）

- 実験は走っていない（変更なし）。hotel-niyari-furonto (VkrBX8rLbC8, 11-13) の数字を取得（窓 11-13〜11-15）: 再生338・平均視聴率93.4%（平均42秒）・3秒維持150%・5秒維持138%・10秒維持114%・20秒維持95%・最後27.4%・登録者増0・高評価1。**途中経過**: 同じ44秒でも平均視聴率が他の baseline（60%台）よりかなり高く見えるが、n が少なく、題材・公開時間・配信の当たり外れと切り分けられないため判定は出さない。
- itsumono-hatsu (aObbaNGce-A, 11-14) は公開から3日たたず未取得（次回以降）。
- 本日の sento-akami (Uw-Y2GPvS5Q) は variant=baseline（39.7秒）。

## 状況（2026-11-16）

- 実験は走っていない（変更なし）。akabeko-famiresu (2fRumhxHr48, 11-12) の数字を取得: 再生44・平均視聴率57.2%・5秒維持96.2%・10秒維持69.2%・20秒維持46.1%・最後42.3%・登録者増0。同じ3日窓でも再生が44と少なく、5本の baseline より全体に低め。尺40.5秒・題材・公開時間が同時に違うため、構造の効果とは言えない。
- VkrBX8rLbC8 (hotel-niyari-furonto, 11-13) は公開から3日たたず未取得。
- 本日の kyoryu-gym は variant=baseline（48.1秒。長めの尺側のデータ点）。

## 状況（2026-11-15）

- 数字の取得: 2026-11-15 に video-publisher の `YouTube Metrics` ワークフロー（読み取りのみ）で5本分を取得できた。fuzoku は引き続き未接続（add_repo の手段なし・GitHub MCP が「not configured」で拒否）。以前の記述にある fuzoku の `metrics` は代替の video-publisher 版で足りた。
- 2fRumhxHr48 (akabeko-famiresu, 11-12) は公開から3日たっておらず未取得。VkrBX8rLbC8 / aObbaNGce-A も同様に未取得。

## 状況（2026-11-14）

- `metrics` ワークフローは fuzoku リポジトリにあるが、この実行（スケジュール実行のクラウドセッション）からは fuzoku に接続できず（リポジトリが
  セッションに追加されておらず、追加用のツールも無い）、起動も読み取りもできなかった。数字の取得は未実施。
- 公開から3日以上たっているのは kaeru-heyasagashi（2026-11-11）以前の6本。次の実行で fuzoku を接続できれば、この6本を最初に取得する（ただし公開日〜+2日の窓がそろっていること）。
- 実験の切り替えは、3本そろった判定が出てから、1回に1つだけ。

## 次の実験の候補（まだ走らせない・事前メモ）

数字が取れたら、次のどれか1つだけを選ぶ（笑いの中身・題材・キャラは変えない）。判定基準は選ぶ時点で書く。

1. 冒頭のフック位置（タイトルカード1.3秒の直後に最初の台詞を置くまでの間）
2. 尺（35〜50秒の中での長短: 例 36〜40秒 と 44〜50秒）
3. タイトルの付け方（`titlePattern`: world / consequence / too-much など）
4. オチの置き方（全体の何割の位置に回収を置くか、ボタンの長さ）

## 結果

**途中経過（2026-11-15）。対象は baseline の5本。実験が走っていないので、判定は出さない。** 窓は公開日〜+2日。

| 話 | 尺(秒) | 再生 | 平均視聴率 | 5秒維持 | 10秒維持 | 20秒維持 | 最後 | 登録者増 |
|---|---|---|---|---|---|---|---|---|
| atatame-juyojiko | 44 | 917 | 61.7% | 113.7% | 76.1% | 59.4% | 42.7% | 2 |
| akabeko-shoumei | 21 | 377 | 103.5% | 119.7% | 101.5% | 84.8% | 75.0% | 1 |
| same-haisha | 38 | 246 | 65.5% | 103.7% | 82.2% | 62.6% | 42.1% | 1 |
| kaeru-heyasagashi | 44.5 | 1085 | 66.2% | 118.4% | 77.6% | 59.9% | 47.6% | 0 |
| doubutsu-tatoeru | 28 | 29 | 124.3% | 140.0% | 140.0% | 110.0% | 100% | 0 |

- 維持率が100%を超えるのは、同じ動画のループ視聴や巻き戻しが入るため（Shortsでは普通に起こる）。
- 読めること（言い切りではなく見え方）: 尺が長い44〜45秒台（atatame、kaeru）は平均視聴率が60%台で近い値。21秒の akabeko-shoumei は平均視聴率・最後まで見られた割合が高く、これは尺が短いほど高く出る性質と区別できない。38秒の same-haisha の10秒維持が82%と、ほかの30〜45秒台より高め。
- 注意: n が少ない（5本）。再生数は29〜1,085と大きくばらつき、配信の当たり外れに強く左右される。doubutsu-tatoeru は再生29と極端に少なく、取得した動画IDが違う可能性もある（要確認）ため、基準の範囲に入れない。
- 因果は言い切らない。尺・題材・キャラ・公開時間がすべて同時に違い、1つの要素の効果は切り分けられない。
- 判断が要る: 次に変える1点（尺／フック位置／タイトルの付け方／オチの位置）を決めるには、同じ条件の動画が複数本要る。現時点では決めない（`なし` のまま）。

## 変更履歴

- 2026-11-14: 台帳を新設。公開済み7本の YouTube ID・公開日・尺を `productions/<id>/metrics.json` に記録。baseline 定義。実験は未開始。metrics 取得は fuzoku 未接続のため未実施。
- 2026-11-15: video-publisher の YouTube Metrics で baseline 5本の数字を取得し、途中経過を記載。kenon-shitsuon を追加（variant=baseline）。実験は未開始のまま。
- 2026-11-16: akabeko-famiresu の数字を取得（再生44）。kyoryu-gym (WbiVJ9s1-vg, 48.1秒) を追加（variant=baseline）。実験は未開始のまま（判断が要る条件: 3本そろった判定がまだ無い）。
- 2026-11-17: hotel-niyari-furonto の数字を取得（途中経過、判定なし）。sento-akami (Uw-Y2GPvS5Q, 39.7秒) を追加（variant=baseline）。実験は未開始のまま。
- 2026-11-18: itsumono-hatsu の数字を取得（途中経過、判定なし）。yakiniku-matte を追加（variant=baseline、焼肉店・「待って／よし」を犬が守り抜く）。実験は未開始のまま。
- 2026-11-18: 7本を予約投稿（11/19〜11/25 毎日18:00 JST、YouTube=非公開+公開予約／TikTok=Buffer customScheduled）。全て variant=baseline。各動画は公開から3日後に数字を取る。

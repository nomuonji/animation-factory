# 3Dコント 制作〜公開の手順書（playbook）

このリポジトリにアクセスできれば、誰（人・どのエージェント）でも同じ手順・同じ品質基準で
3Dショートコントを1本、案出しから YouTube／TikTok の公開まで作れるようにするための手順書。
道具の説明は `docs/three-shorts.md`、物語の型と本人の好みは `docs/short-drama-design.md` にある。
この手順書はそれらを**どの順番で、何を確かめながら**使うかを決める。

> 品質の最終判断は Yuto の評価が正。この手順の合格は「技術的に出せる」までで、面白さの保証ではない。
> 自己採点で「面白い」と言い切らない。

## 0. 全体の流れと所要時間

| # | 段階 | 成果物 | 目安 |
|---|---|---|---|
| 1 | 読む | 既存作・型・好みの把握 | 15分 |
| 2 | 案出し（一番大事） | 15案以上 → 1案 | 20分 |
| 3 | 台本・セット | `productions/<id>/scene3d.json`（＋必要なら新セット） | 30〜60分 |
| 4 | lint と静止画チェック | エラー0、要所のコマを自分で見た | 15分 |
| 5 | 実音声 → 本番レンダリング → QA | `review/` 一式、`qa.mjs` 合格 | 25分 |
| 6 | マージ | main に入る | 2分 |
| 7 | 公開 | YouTube／TikTok の URL | 10分 |
| 8 | 記録と報告 | `productions/<id>/published.json`、報告文 | 5分 |

## 1. 読む（毎回）

1. `AGENTS.md`、`docs/three-shorts.md`、`docs/short-drama-design.md`（特に「0. 現実の土台」「狙いすぎない」「尺と配役」）
2. `catalog/skit-formats.json`（型・lint 基準・`setPlaces`・`payoffMechanisms`）、`catalog/cast3d.json`、`templates/skit3d.json`
3. **既存のコントを全部**: `productions/*/scene3d.json` のうち `meta.kind` が `character-sheet` でないもの。
   それぞれの `design.reality`（場所・出来事・外した1点）、`payoffMechanism`、`ideation.rejected` を一覧にする。

   ```bash
   for f in productions/*/scene3d.json; do node -e "
   const j=require('./$f'); if(j.meta?.kind==='character-sheet'||!j.design) process.exit();
   console.log(j.meta.id,'|',j.design.reality?.place,'|',j.design.reality?.onlyBreak,'|',j.design.payoffMechanism)"; done
   ls productions/*/published.json   # 公開済みの作品
   ```
   開いている PR（`three-shorts/*` ブランチ）も見て、他の人が作りかけのネタと重ねない。
4. 見本: `productions/doubutsu-tatoeru`（Yuto が「めちゃいい」と評価）。
   「動物に例えると？」→「カエルです」→聞き返すと「バーガーです」。現実の場面そのまま、ずらすのは一点、説明も決め台詞もない。

My Portal にアクセスできる場合は、canonical chat Skill `short-form-video-direction` と `creative-thinking`、`taste_evidence_list(domain: humor)` を毎回読む。**新規3DコントでCreative Thinkingまたはラジ父コーパスへアクセスできない場合は停止する。** 下の§2は要約であって、実データ検索の代替ではない。

## 2. 案出し（ここが一番大事）

### 2.1 発想操作（creative-thinking の要点）

名詞ではなく「発想操作」で考える。**3種類以上の操作**を参照例から抽出し、**15案以上**を出す。下の表は案を埋める固定テンプレートではなく、発散後の偏りを診断するための語彙例。表にない操作・系統を自由に作る。最初の5案は平均的になりやすいので、後半で弱い違和感・二次的な帰結・具体的な光景を探す。

| 操作 | 中身 | 3Dコントでの使い方の例 |
|---|---|---|
| premise_reinterpretation | キャラが元からそうである性質を、普通の場面に置く | サメ（口が閉じない）が歯科検診 |
| social_script_corruption | その場所の定番の決まり文句・質問を、そのまま使う | 「自分を動物に例えると？」「一回閉じてください」 |
| taste_contrast | 好み・良し悪しが逆になる | カエルには「日当たり良好」が短所 |
| literalization | 決まり文句を文字どおりに受ける | — |
| mundane_detail / over_specific_reality | 現実の細かい手順や定番の確認事項を正確に再現する | 「カチカチしてください」「顎を引いてください」 |
| institutional_absurdity | 日常の一瞬を手続きにする | 温めに重要事項説明（※すでに使用済み） |
| deadpan_underreaction | 異常に誰も騒がない | 担当者は最後まで丁寧に接客する |
| category_collision / hidden_consequence / backstory_implication / format_exploitation | 別の領域とぶつける／二次的な帰結／背景をにおわせる／形式を使う | — |

各案に必ず書く: **場所／その場所で現実に普通に起きる出来事／外す1点**。

### 2.1.1 ラジ父の実検索・転用証跡（必須、lintで停止）

3Dコントの新規案は、My Portal chat Skill `creative-thinking` の3D専用ゲートを必ず実行する。新規・変更する `scene3d.json` の `design.ideation.gateVersion` は `1` とし、PR CIが全証跡を検査する。既存の未変更作品はlegacyとしてレンダリング可能だが、編集時にはこのゲートへ移行する。旧Agent HQ Method名をJSONに書くだけでは通過しない。

1. `portal_search({collection:"humor_examples", query:"<場面・定番会話・関係性に沿った検索語>", limit:100, scanLimit:500})` を複数の異なる検索語で実行する。
2. 結果のうち `dataset=radichichi`、`retrievalTier=creative`、`role=ogiri_reference` のみをラジ父の発想参照例として採用する。最低3チャンク、5回答例以上を確認する。raw_context / source_index はcreative検索結果の代用品ではない。
3. 最低3種類の発想操作を、実際に取得したexampleIdと紐づける。原文の回答本文はMy Portal内で読むにとどめ、公開repoへ転載しない。scene3d.jsonにはchunk ID、exampleId、abstract operation、今回へのtransferだけを保存する。
4. 3系統以上を使って新規15案以上を作り、全件を `design.ideation.candidateLog` に保存する。候補の一文概要、発想操作、採否、却下理由を含める。候補数だけを15と書くのは禁止。
5. 上位3案を先にユーザーへ提示し、選択を得てから台本を書く。「選定も任せる」と明示されている場合だけ自動選定可。
6. `design.ideation.corpus` に検索日時、dataset/version、queryLog、sourceChunks（各chunkのdataset/retrievalTier/role）、sourceChunkIds、sourceExampleIdsを記録する。さらにmechanisms、candidateLog、shortlist、selectedCandidateId、selectionAuthorityを保存する。テンプレートと `design-lint.mjs` がこの形式を要求する。
7. 5例・3チャンク・3操作・15候補・上位3案提示のどれかが欠けたらscript / VOICEVOX / render / PRへ進まない。My Portal検索が使えない場合は作業を止め、「未取得」と報告する。既存PRの説明や過去の候補リストを今回の実績に付け替えない。

**公開repoへラジ父の回答本文・長文引用を複製しない。** 原データの正本はMy Portal `humor_examples`。GitHub側には出典IDと抽象化だけを残す。

### 2.1.2 構造的多様性（v2、必須）

案を出す段階では既知の「発想操作」分類をいったん閉じ、題材・人物・日常場面・観察から自由に発散する。後から候補ごとに `mechanismFamily`（自由記述の機序キー）と `causalCore`（舞台・人物・小道具を除いた因果構造）を記録する。既成の分類リストから4枠を埋めるのは禁止。候補群から自然に現れた機序を分類する。

- 15案以上の全体で4系統以上、最大系統は40%以下
- 生成時のラベルを隠した別工程で全候補を読み直し、機序を再分類する（`diversityAudit`）
- 生成時の分類と盲検再分類が違えば、ラベルだけでなく候補自体を見直す
- shortlistはちょうど3案。盲検分類でも3系統すべて異なる
- 3組すべてを比較し、因果構造が異なり、舞台・登場人物・小道具の差し替えだけではないことを記録する
- 1組でも同じ仕組みなら片方を落として再生成する。役割逆転の言い換えを設定違いで3案に数えない

これは多様性を保証する機械的な発想リストではない。CIは記録・系統数・偏り・比較ペアの存在を検査するだけで、文章の意味や面白さを保証しない。批評パスが実質的に別工程として行われていない場合はPASSにしない。

### 2.1.3 本人の過去X投稿を任意の種として使う（2026-11-12 明示許可）

ユーザー本人の過去X投稿は、3Dコントの発想素材として利用してよい。My Portal social_posts_search で今回の題材に関係する投稿を探す。これは任意の探索経路であり、毎回必ず投稿を起点にする必要はない。

- 投稿本文の言い換えだけで終わらせず、発想の核を抽象化し、別の舞台・人物関係・行動・結末へ展開する
- 使用した場合は design.ideation.userSeeds に platform=x、正確なMy Portal record ID（x_...）、transformation、reusedVerbatim=false を保存する
- 元の投稿本文は公開repoへ複製しない。AIが投稿を使ったことを本人の「好み」や採用決定の証拠として扱わない
- X投稿を使わない場合は userSeeds を空配列にしてよい。外部教師データとユーザー投稿を混同しない

好例: X投稿「競技人口が少なすぎて一位になっているものの例／一番西の高校生探偵」を着想源にした「日本一西の高校生探偵」。投稿を出発点にしつつ、人物・表彰・さらに西の学校へ展開して短い寸劇にした。採用されたのはこの具体案であり、地理的な一位や表彰を次の定型にしない。

### 2.1.4 笑いの核と脚本の独立審査（必須、2026-11-12）

15案の記録と構造的多様性チェックに加えて、**台本そのものがコントとして成立しているか**を審査する。テンプレートの design.comedyAudit に次を記録する。

1. comicKernel: 一言で言える具体的な笑いの核
2. audienceExpectation: 観客が普通なら何を予測するか
3. characterIntent: 登場人物がその場で何をしようとしているか
4. pressure: 目的を妨げる状況・利害・抵抗（無理に対立を追加しない）
5. escalations: 実際のbeat IDごとに、状況・理解・予測がどう変わるか。最低2段。台詞の繰り返しは段に数えない
6. payoffCausality: 最後のオチが前提と人物の行動から自然につながる理由
7. laughMoment: 具体的に笑いを生むbeat IDと、その画・動作・台詞
8. independentReview: 作者の意図を離れて実際の台本を読み直す hostile-reader 批評。最も強い反論と回答を含める

審査では「日常の小さな不便を描いただけではないか」「変な設定を置いただけで展開がないのではないか」「役割逆転だけで終わっていないか」「オチのために人物設定や小道具を後付けしていないか」を必ず検討する。反論が解消できない場合は revise/reject とし、候補数やFamily分布を満たしていても台本に進まない。

CIは必須項目やbeat IDとの対応を検査するだけで、実際の面白さや批評の独立性を証明しない。構造PASSを編集PASSと混同しない。

### 2.2 落とす（ふるい）

次のどれかに当たる案は落とす。落とした理由は `design.ideation.rejected` に書く（lint が2件以上を求める）。

- **現実にその場所でその出来事が起きない**（例: コンビニに試食はない）。手持ちのセットに合わせて場所を変えない。
- **狙いすぎ**: ボケのために用意した小道具を見せびらかす（恐竜が身分証に化石、魔女がお薬手帳に魔導書）／作った決め台詞で締める（「これが普通です」「絶滅したんで」）／真顔の確認を長くやる。
- **既存作と重なる**: 場面・ズレ・オチの仕組み（`payoffMechanism`）のどれかが同じ。直近と同じ仕組みは lint も警告する。
- **一度で分からない**、**結末が唐突**。
- **35秒以上もたない**: 同じズレで二段目・三段目の「新しい発見」が作れない（「できない」の繰り返しになるもの）。
- **笑いの核がない**: 日常の小さな不便・失敗・気まずさを描いただけ／変な前提を置いただけで展開も回収もない／「役割を逆にした」だけで終わる
- **人物の因果がない**: その人物がその行動を取る理由が既存設定・直前の行動から導けない／キャラクターの習慣・能力・人間関係・社会制度を根拠なく追加してオチに使う
- **回収が未準備**: 伏線・直前の行動・前提と結びつかない新情報や新人物だけで落とす／同じ台詞や反応を繰り返して尺を稼ぐ
- AI臭: 変な固有名詞を足しただけ／設定の全部が異常／説明がオチを解説している／「実は〜だった」で雑に反転。

### 2.3 選ぶ

基準は一つ: **場面とキャラが元からそうであるだけで笑いが起きているか。自分が足した物や台詞がなくても成立するか。**
見本（動物に例えると→カエルです→バーガーです）と並べて、同じくらい素直かを比べる。

- 配役に優先順位はない（2026-11-07 Yuto）。悪魔（`akuma`）・赤べこ（`akabeko`）・100Avatars（FrogEnjoyer・DogoBurger・LilShark・AjoMajo・CuteSaurus）・手続き型の人物から、案に一番合うものを選ぶ。キャラの見た目・性質がズレそのものになる案は歓迎。
- ズレ以外は現実どおりにする。相手役は普通の人間（手続き型）にすると「外す1点」が一つに保てる。
- 予約実行など人が選べない場合は、選んだ1案と落とした主な2〜3案を報告に書く。人が見られるなら3案程度を見せて選んでもらう。

## 3. 台本とセット

1. ブランチ `three-shorts/<id>` を main から切る（`<id>` は英小文字とハイフン）。
2. `templates/skit3d.json` を `productions/<id>/scene3d.json` にコピーして埋める。必須:
   `design.reality`（place／normalEvent／onlyBreak）、`design.payoffMechanism`（直前作と違うキー。新しい仕組みなら `catalog/skit-formats.json` の `payoffMechanisms` に1行で登録）、
   `design.ideation`（method・candidates・rejected）。
3. 構成:
   - タイトルカード（role `title`, 1.2〜1.4秒, `title-sting`）を**一番最初**に。`titleScreenText` は2行。タイトルはオチを言わない。
   - 直後に本当のフック（その場所の定番の一言から始める `line-first` が多い）。ルールは7秒までに分からせる。
   - escalate を3〜4段。**伸ばすのは段を増やすことで**。無言の間・同じ台詞の繰り返し・説明で水増ししない。
   - turn → payoff（`{"music":"cut"}` ＋ `payoff-hit`）→ button（4秒以内、`{"music":"resume"}`）。
   - 尺は **35〜50秒**（lint が警告する）。
4. 場所に合うセットがなければ `src/three/sets.ts` に作る。作ったら:
   `catalog/skit-formats.json` の `setPlaces`、`catalog/components.json` の `three.sets`（cameras・surfaces・notes）、`docs/three-shorts.md` の Sets 節に登録する。
   新しい小道具は `src/three/props.ts` ＋ `components.json` の `three.props`。作品専用の分岐をランタイムに入れない。
5. 音声: 役ごとに `voices` を決める。セリフは `／` で字幕の区切り。BGM は店なら `bossa-thank-you-for-shopping`、待合系は `waiting-lounge`（gain 0.24 前後）。

## 4. lint と静止画チェック

```bash
npm ci
npx tsc --noEmit
node tools/three/render3d.mjs <id> --timeline-only --no-voice      # 構造 lint（エラーは必ず直す、警告も読む）
CHROME_PATH=/usr/bin/google-chrome node tools/three/render3d.mjs <id> --no-voice --scale 0.5 --stills 0.6,3,6,9,12,...
```

ショットが切り替わるごとに1枚ずつ出し、横に並べて見る:
```bash
cd outputs/three/<id> && ffmpeg -y -i still-3.00.jpg -i still-6.00.jpg -i still-9.00.jpg -filter_complex "hstack=3,scale=1800:-1" /tmp/sheet.jpg
```

**見ること（全部）**:
- カメラが人物や帽子にめり込んでいない。手前の物で画面がふさがっていない。
- 顔・頭が切れていない。**字幕（`captions.y` 既定0.74〜0.76）が顔や大事な文字を隠していない**。
- 小道具が浮いていない／机に埋まっていない。紙の文字が**観客から読める向き**か（逆さになりやすい）。
- 動き（うなずき・身を乗り出す・手渡し）が見える角度か。
- 0秒の画（タイトルカードの下）と、タイトル明けの最初のコマで「どこで・誰が」が分かるか。

### 4.1 これまでに分かったカメラ・配置のコツ

- 机をはさんだ2人: 客側から机上を撮るときは、**真上近く**（例 `pos [0, 2.3, 0.2]`, `target [0, 0.72, -0.04]`, `fov 21`）にすると客の頭や帽子が入り込まない。斜めから撮ると紙が回って読みにくい。
- FrogEnjoyer はカエル帽が大きく、頭の芽が画面に入りやすい。表情は帽子の口の中の子どもの顔に出るので、アップはそこを狙い、字幕より上に来るよう `target.y` を下げる（被写体が上に寄る）。
- 担当者のアップは近すぎると顔だけになる。1.3m以上離して `fov 30` 前後。
- `floor-plan` / `document` は `ry: 0` で客（+Z 側）から読める。
- 手続き型の人物を座らせるには `seated: true` と `root.y ≈ -0.32`（座面 0.45m）。VRM も `seated: true`。
- 新しいカメラ位置はまずセットの既定カメラとして直す（次の作品も得をする）。作品だけの調整は `cameras` で上書き。

## 5. 実音声 → 本番レンダリング → QA

1. コミットして push し、PR を作る（説明に現実の土台・外す1点・オチ・新しい部品を書く）。
2. PR で自動実行される **3D Shorts** の通常実行は止める（cancel。ローカルで描くので不要）。
3. `three-shorts.yml` を **手動実行**: `ref=<branch>`, `production=<id>`, `voices_only=true`。2〜3分で終わる。
4. 成果物（artifact `three-shorts-<run_id>`）の中の `three-voice/` を **`outputs/three-voice/`** に入れる。
   （`gh run download <run_id> -R nomuonji/animation-factory -n three-shorts-<run_id> -D /tmp/v && cp /tmp/v/three-voice/* outputs/three-voice/`、または GitHub MCP の `download_workflow_run_artifact` で zip を取る）
5. `node tools/three/render3d.mjs <id> --timeline-only` で**実音声の秒数**を確認。35秒未満なら段を足す。台詞の間が長すぎる所は `pre`/`post` を詰める（台詞の文字を変えたら音声を作り直す。`pre`/`post` だけなら不要）。ルールが7秒を越えたら間を詰める。
6. 本番: `CHROME_PATH=/usr/bin/google-chrome node tools/three/render3d.mjs <id>`（約1300フレームで15分前後。`nohup ... &` で回して進捗をログで見る）。
7. **QA**: `node tools/three/qa.mjs <id>` — review 一式・実音声・尺35〜50秒・映像/音声の長さが timeline と一致・-14 LUFS 前後・VOICEVOX クレジットを確かめる。
8. **自分の目で** `review/contact-sheet.jpg`（1秒ごと）と `review/first-frame-phone.png` を見る（§4 の項目）。おかしければ直して再レンダリング。画を変えないなら `--reuse-video` で音だけ作り直せる。
9. 音は人の耳で聞いていない限り「聞いていない」と報告する（測定は聞いた代わりにならない）。

## 6. マージ

直したカメラ・タイミングもコミットして push → 自動実行をまた cancel → PR を main にマージ（squash）。
`productions/<id>/scene3d.json` とセット・小道具が main に入ることで、次の人が重複チェックと部品の再利用に使える。

## 7. 公開（nomuonji/video-publisher）

公開先は「おもしろ」コンセプト（YouTube）と TikTok `oyu295`（Buffer 経由、既定で即時投稿）。

```bash
git clone https://github.com/nomuonji/video-publisher ../video-publisher   # push 権限が必要
node tools/three/publish-pack.mjs <id> --publisher ../video-publisher --date $(date +%F)
cd ../video-publisher && git checkout -B incoming/<id> origin/main && git add incoming \
  && git commit -m "incoming: <題>" && git push origin incoming/<id>
```

- `publish-pack.mjs` は QA を通し、`incoming/おもしろ/<date>-<id>.mp4` と同名の `.json` を書く。
  `.json` は `{"title","description","hashtags","postNow":"YouTube,TikTok","tiktokAccount":"oyu295"}`。
  **`hashtags` は1本の文字列**（`"#a #b"`）。description には VOICEVOX のクレジットが必須（`description.txt` からそのまま入る）。
  `productions/<id>/published.json` がある作品は拒否する（二重投稿防止）。
- push すると **Queue From Repo** ワークフローが走り、投稿後にブランチを消す。ログから拾う:
  - `Posted … → https://youtube.com/shorts/…`
  - `TikTok … → Buffer shareNow → oyu295 (post <post id> …)`、または `TikTok skipped for …` の理由
- 数分後に video-publisher の **Buffer Tool** を `action=query`、
  `query=query { post(input: { id: "<post id>" }) { status externalLink error { message rawError } } }` で実行し、
  `status: "sent"` と `externalLink`（TikTok の URL）を確かめる。

### 7.1 失敗したとき

- **YouTube に投稿済みなら、同じ動画で YouTube を含む postNow を二度と push しない**（二重投稿になる）。
- TikTok だけ失敗: Buffer の投稿が `error` → Buffer Tool `action=sharenow`, `ids=<post id>` で送り直す。
  Buffer に投稿自体が無い → `postNow: "TikTok"` だけの sidecar を別ブランチ `incoming/<id>-tiktok` で送る。
- 認証切れ（`Invalid Credentials` など）は持ち主（Yuto）の作業。報告して止める。
- 作品として出せる出来にならなかったら投稿しない。その旨を報告する。

## 8. 記録と報告

1. 投稿できたら `productions/<id>/published.json` を作り、小さな PR で main に入れる（次の人の重複防止と `publish-pack` の二重投稿ガードになる）:
   ```json
   {"production":"<id>","title":"<題>","concept":"おもしろ","postedAt":"YYYY-MM-DD","durationSec":44.5,
    "youtube":"https://youtube.com/shorts/…","tiktok":"https://tiktok.com/@oyu295/video/…","bufferPostId":"…","editorial":"unreviewed"}
   ```
2. 報告（短く）: 題と公開URL（YouTube・TikTok、投稿しなかった場合は理由）、尺、選んだ案（場所・外した1点・オチ）、
   落とした主な案2〜3個と理由、配役とセット、直した所、不確かな所（音は人の耳で聞いていない、既存作と似て見えるおそれ等）。
3. Yuto の評価が来たら `docs/short-drama-design.md` に日付つきで反映する（好評・不評の理由を一般化しすぎずに）。

## 9. 守ること

- 同じコントを二重に投稿しない。既存のコントと同じネタを作らない（§1 の一覧と `published.json`）。
- 露骨な性描写、特定の実在人物・企業をからかう内容にしない。
- 素材は CC0 などライセンスが確認できるものだけ（`catalog/assets3d.json`、`catalog/asset-library.json`）。
- `character-sheet` の作品（`cast-akuma-akabeko` など）は公開しない。
- 技術チェックの合格や CI の成功を、「面白くない」という評価への反論に使わない。

## 10. 再生データの分析と検証

台帳は `docs/experiments.md` と `productions/<id>/metrics.json`。数字は **video-publisher の `YouTube Metrics`**（`metrics.yml`）を
workflow_dispatch で動かして取る（`mode=check` で疎通、`mode=video`・`concept=おもしろ`・`videos="<ID>:<公開日>:<尺秒、0なら自動> …"`）。
公開から3日以上たった動画だけ、公開日〜+2日の窓で、再生数・平均視聴・維持率（3/5/10/20秒/最後）・Shortsフィード経由・登録者増が出る。
ログの `METRICS_JSON` 行を台帳に写す。取得済みは取り直さない。他のリポジトリは使わない。数字は構成・形式の検証にだけ使い、笑いの質の判断には使わない。

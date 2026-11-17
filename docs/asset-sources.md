# 外部素材と音の確認ツール — Openverse / earshot

動画制作エージェント向けの選択肢として登録しておくツール（2026-11-04 追加）。どちらも**必須ではない**。既存の経路（Commons・Pixabay・`catalog/asset-library.json`・VOICEVOX）で足りるなら、それを使ってよい。
このファイルが正本。他の動画repo（error-english/beat-shorts、legal-english、kirinuki-generator）とMy Portalの動画系Chat Skillからはここを参照する。

| 困っていること | 選択肢 |
|---|---|
| Commons API がこの実行環境から 429 になる / 1サイトだけでは候補が少ない | **Openverse** で画像・音声を横断検索 |
| BGM が CC0 3曲しかない、出典不明・非商用の曲を差し替えたい | **Openverse**（`source=jamendo`、商用・改変可で絞る） |
| 効果音を足したい（実録音） | **Openverse**（`source=freesound` / `wikimedia_audio`） |
| 効果音を足したい（権利処理なし・オフライン） | **earshot** の `sfx` / `kit`（コード製のバンク252音） |
| 音を聴けないのに「合っている」「同期している」と言いそうになる | **earshot** で測定し、その数値つきで報告 |

---

## Openverse — CC/パブリックドメインの画像・音声の横断検索

WordPress が運営する検索エンジン。Flickr・Wikimedia の画像、Wikimedia の音声・Freesound・Jamendo の音声を一つのAPIで探せる。

- API: `https://api.openverse.org/v1/images/` と `https://api.openverse.org/v1/audio/`。**キー不要**（匿名）。1検索で最大240件（20件×12ページ）、匿名はレート制限がゆるく低め。大量に回すなら OAuth 登録（`/v1/auth_tokens/register/`）で上限を上げる。
- 2026-11-04 時点、このサンドボックスから匿名で 200 応答を確認済み（Commons API の 429 回避に使える）。
- 音声の収録元（2026-11-04 の `/v1/audio/stats/`）: `wikimedia_audio` 約399万、`jamendo`（音楽）約64万、`freesound`（効果音・環境音）約59万。

### 必ず付けるフィルタ

収益化チャンネルで、切り抜き・加工して使うので、**商用可・改変可**以外は使わない。

```bash
# 効果音（Freesound, CC0 のみ）
curl "https://api.openverse.org/v1/audio/?q=thunder&source=freesound&license=cc0&page_size=20"
# BGM（Jamendo, 商用・改変可）
curl "https://api.openverse.org/v1/audio/?q=calm+piano&source=jamendo&license_type=commercial,modification"
# 画像（商用・改変可）
curl "https://api.openverse.org/v1/images/?q=lightning&license_type=commercial,modification"
```

- `license_type=commercial,modification` で NC（非商用）・ND（改変禁止）を除外。表記を減らしたいときは `license=cc0,pdm,by`（BY-SA は同ライセンス表記が要る）。
- 効果音は `category=sound_effect` では0件になる（2026-11-04 確認：Freesound分にカテゴリが付いていない）。**`source=freesound` で絞る**。音楽は `source=jamendo`。
- `duration` はミリ秒。

### 結果の使い方

- 各結果に `url`（ファイル）、`foreign_landing_url`（元ページ）、`creator`、`license`、`license_version`、`license_url`、`attribution`（そのまま貼れる表記文）がある。
- **Openverse はライセンスを保証しない。** 使う前に `foreign_landing_url` の元ページでライセンスと作者を確認する。
- Freesound の `url` は高音質のプレビューMP3。元のWAVは `alt_files` の Freesound API（要認証）。ショート動画ならプレビューで足りることが多い。
- Jamendo の曲は既存の登録曲と同じく、公開前に YouTube の著作権申し立て（Content ID）が付かないか確認する。
- Shorts v3 の `src:` に `openverse:` 接頭辞はまだない。ダウンロードして `local:` で使い、出典は各repoの台帳に登録する（このrepo: `catalog/asset-library.json` と brief の `descriptionLines`、legal-english: `public/bgm/credits.json`、beat-shorts: `tracks/<id>/track.json` の `credit`/`license`）。台帳に出典がない素材は公開しない。

---

## earshot — 聴けないエージェントのための「耳」

[Leonxlnx/earshot](https://github.com/Leonxlnx/earshot)（MIT、v0.4.0 = 2026-10-22）。音声ファイルを、エージェントが判断に使える文字と数値に変える。CPUのみ・ローカル実行。CLI / Python API / MCPサーバーがある。

### インストール（注意）

**`pip install earshot` は使わない。** PyPI の `earshot` は別物（pykeio の音声区間検出ライブラリ）。GitHub からタグ固定で入れる。

```bash
pip install torch --index-url https://download.pytorch.org/whl/cpu
pip install "earshot[mcp] @ git+https://github.com/Leonxlnx/earshot@v0.4.0"   # ffmpeg / ffprobe が必要、Python 3.10+
earshot doctor
```

- 初回のモデル利用時に Hugging Face から約1.1GB（CLAP と AudioSet 分類器）をダウンロードする。Actions で使うなら `EARSHOT_HOME` をキャッシュする。
- **`measure`・`sfx`・`kit` はモデル不要**で軽い。ここから試す。
- CLI は1回ごとにモデルを読み込む（20〜40秒）。何度も呼ぶなら MCP（`python -m earshot mcp`）か Python スクリプト1本にまとめる。

### 動画制作での使いどころ

| やること | コマンド |
|---|---|
| Openverse で落とした候補から一番合う音を選ぶ | `earshot rank "a single distant thunder clap" cand/*.mp3 --top 5` |
| 長い録音から使う箇所を切り出す（秒） | `earshot find rec.mp3 "one clean thunder crack" --top 3` |
| 音量（LUFS・true peak）を測る | `earshot measure out.mp4`（モデル不要） |
| 画のカットと音の同期を確認 | `earshot timeline out.mp4 --video out.mp4`、`earshot sheet out.mp4 -o sheet.png`（画像として Read できる） |
| 権利処理なしの効果音を出す | `earshot sfx list --kind whoosh`、`earshot sfx render ui_pop/soft -o pop.wav`（コードで作った音。ネット不要） |
| 動画1本分の効果音一式を出す | `earshot kit init --preset calm -o audio/kit.json` → `earshot kit render audio/kit.json --out audio/kit` |

- バンクの音はコードで合成したもの。ただし15音は CC0 録音からの「fit」なので、使ったら earshot の `docs/CREDITS_FIT.md` の表記に従う。
- `critique` はプロのローンチ動画7本との比較。Shortsや教育動画の良し悪しの基準ではないので、合否判断に使わない。

### 報告のルール

- earshot の結果は**測定**であって、人が聴いた確認ではない。「earshot: strong match z +3.9、-14.2 LUFS」のように数値つきで書き、聴いて確かめる必要があるときは今まで通りユーザーに依頼する。
- earshot 自身の README にも、モデルの判定は騙されうると書いてある（特に realness）。モデル以外の測定とスペクトログラムを合わせて見る。
- 同梱の Skill（`skills/earshot`、`skills/real-sound`）は参考資料。`real-sound` は「実録音以外の音は使わない」という前提なので、VOICEVOX やコード製の効果音を使う制作にはそのまま当てはめない。

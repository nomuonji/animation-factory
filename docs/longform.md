# 長尺動画の制作基盤

正本: `productions/<id>/longform.json`。実行: `tools/longform/longform.py`。
横型の解説・観察・映像エッセイを、章ごとに制作して1本へ結合する。
Shorts v3 の素材検索・権利ロック・VOICEVOXの読みと字幕同期・映像デコード・BGMを共用する。
既存のPhaserアニメは `production.json` と従来のrendererで作り、完成した自作映像を `local:` のshotとして長尺へ組み込める。動画固有のコードを増やさない。

## 制作手順

1. 素材と現物を見る。既存の `shorts.py scout/inspect` を利用できる。台本に合わせた無関係な素材の穴埋めはしない。
2. `python tools/longform/longform.py new my-film --title "タイトル"`。
3. `question`（最初の問い）、`payoff`（最後に見せる答え）、`audience` を具体化。各章の `purpose` と各beatの `why` に前から新しく分かることを書く。
4. `templates/longform.json` を参考に、作られた `productions/my-film/longform.json` の素材・台本を実データへ置換する。テンプレートは制作例ではなく未完成の足場。
5. `python tools/longform/longform.py find productions/my-film/longform.json` で候補を探し、確認して選ぶ。
6. `python tools/longform/longform.py check productions/my-film/longform.json`。
7. `python tools/longform/longform.py lock productions/my-film/longform.json`。`sources.lock.json` をブリーフと一緒に保存。
8. `python tools/longform/longform.py render productions/my-film/longform.json --profile draft`。
9. `outputs/longform/my-film/draft/index.html` の全編MP4・各章・コンタクトシートを見て、音も聴いて修正。
10. 最後に `--profile final`（1920×1080 / 30fps）。draft は960×540 / 24fps。

必要環境: Python 3.12、FFmpeg/FFprobe、`numpy pillow opencv-python-headless`、fonts-noto-cjk、VOICEVOX engine。
VOICEVOX既定URLは `http://127.0.0.1:50021`。実音声clipの英語TTSを使う場合はShortsと同じKokoro依存も必要。
ローカルとGitHub Actionsの両方で使える。追加の有料APIは必須ではない。

## 長尺の編集

- 全体の問い→証拠→理解の更新→回収を設計する。Shortsを無関係に並べたり、尺のために同じ説明を繰り返したりしない。
- 5〜20分程度でも、章はシーン単位（音声合成後に180秒以下）へ分割。章内の音声配列と字幕画像だけを保持し、全編の生フレームをメモリに貯めない。
- `beats[].say` に語り、`／` で字幕区切り。`caption` を別にする場合は同数の区切りで対応させる。VOICEVOXのmora時刻から同期。
- `clip` に元音声を使う場合は `in/out/lines[].at/to/en/ja`。clipの間は語りを重ねない。長尺では元音声の20秒制限はない。
- 語りなしの観察は `min`。`voice.engine=none` は無音の尺見積もり用で、実ナレーション完成ではない。
- shotの `weight` でbeat内の配分、`in/speed/focus/zoom`、`frame=fit|fill`、`label` を使用。fitは全体を保つ黒帯表示でzoomを適用しない。fillのみfocus/zoomで寄る。
- 字幕は画面下部の安全領域。各beatの `overlay` / shotの `label` は上部の補助表示。
- 音楽は `catalog/asset-library.json` の既存資産を使用。章ごとの `music` で停止・曲・gainを変更できる。章末にフェードし、結合時に全編を一括で-16 LUFSへ調整。

## 再生成・中断からの再開

章の入力・素材チェックサム・音楽ファイル・profile・制作コードを指紋化し、章MP4と確認画像のチェックサムも検証する。
同じ出力先で再実行すると、変わっていない章を再利用。章変更時は該当章、共通voiceやレンダラー変更時は関係する章を再生成する。
`--force` で章キャッシュを使わず作り直せる。draft/finalのキャッシュは別。

素材ハッシュが変わったときはエラーにし、元のローカルファイルを削除しない。
意図して素材を交換した場合は、既存lockから該当srcのエントリを除き、`lock`し直す。勝手な再ロックはしない。
失敗時は `report.json` を成功証跡として残さない。途中までの章receiptは次回使える。
キャッシュ復元ができなくても正しさは変わらず、再レンダリングの時間だけが増える。

## GitHub Actions

Actions **Long-form production** → Run workflow → production ID + draft/final。
`tools/longform` / 共通Shortsエンジン / longform定義のPRでは、186秒・3章の合成映像を実際に結合してCIで検証する。
実コンテンツの全編レンダリングは手動起動。長尺を毎pushで全編出力して実行枠を浪費しない。
素材検索はローカルCLIまたは既存Shorts scout/inspectの経路を使える。
Secretsの `PIXABAY_API_KEY` は任意。Commons / 自作素材 / VOICEVOXはPixabayキー不要。
章・音声・素材キャッシュは次回runで復元。失敗時も途中成果をartifactへ回収する。

完成artifactに含まれるもの:

- `video.mp4`（横型・H.264/AAC・48kHz stereo）
- `captions.srt` / `captions.vtt`（全編時刻へ変換済み）
- `chapters.txt` / `description.txt`（章開始時刻、出典、音声・音楽クレジット）
- `chapters/<id>/video.mp4` / `first-frame.png` / `contact-sheet.jpg` / `receipt.json`
- `timeline.json` / `sources.lock.json` / `longform.json` / `report.json`
- `index.html`（相対参照だけの再生・編集確認ページ） / `scorecard.md`

artifactを展開して `index.html` から全編を確認できる。長尺artifactは従来Phaser用Review Pages自動収集には接続していない。
このワークフローはYouTubeへの投稿を行わない。既存のShorts自動投稿先・チャンネルルートには長尺を流さない。
長尺を投稿する際は制作先チャンネル、タイトル、概要欄と動画の編集確認を済ませ、投稿先に対応した既存経路で明示的に扱う。
YouTubeがチャプターを表示するかは別判定（先頭00:00、3章以上、各10秒以上等）。条件不足は警告し、チャプター生成自体と分ける。

## 検証と品質の区別

`python tools/longform/smoke_test.py --long` は186秒の実MP4を出力する結合検証。
字幕オフセット、日本語字幕、48kHz stereo、キャッシュ再利用、破損検出、元素材を消さないハッシュ不一致処理を確認する。
CIではさらにVOICEVOX実音声のPCMと字幕分割を確認する。合成カラーパターンは公開用コンテンツではない。

`technical_pass` は出力が仕様どおりという意味だけ。`editorial=unreviewed` と `audience=unverified` を自動で合格にしない。
全編の冒頭・章の展開・証拠となる画・回収・音声字幕同期・固有価値を `scorecard.md` で実際に見て評価する。
動画ハッシュが変われば採点表も白紙へ戻る。数分の本編が作れる基盤と、面白い本編が完成したことを区別する。

# Shin-MotionMaker自由制作エンジンとの接続

既存のPhaser/JSON・Style Shorts・3D Shorts・長尺制作を置き換えず、nomuonji/Shin-MotionMaker（プライベート）を追加のReact/Remotion制作方式として使う。

## 長尺企画からの入口

実行: node tools/motionmaker/export-longform.mjs productions/<id>/longform.json /tmp/<id>-request.json

このスクリプトは長尺企画の title, audience, question, payoff, chapters, beats を公式request.jsonの form に変換する。元のlongform.jsonは変更しない。動画、音源、素材のバイトや権利情報は自動複製しない。参照映像は原典・利用条件を確認してから制作エージェントが取得する。

## 制作フロー

1. 生成したrequest.jsonをShin-MotionMakerの factory-requests/<id>.json としてPR提出。
2. Shin-MotionMaker Actions「Video Factory (manual)」で mode=generate、source=factory-requests/<id>.json を実行。編集可能なmotion-job.zipを取得。
3. 制作エージェントがジョブ内のAGENTS.mdを読み、台本・映像シーン・音声・検査結果を実装。変更したジョブをShin側の factory-jobs/<id>/ に配置。
4. 同Actionsの mode=render、source=factory-jobs/<id>、target=preview|final でvideo.mp4とreports/、handoff.jsonを取得。
5. 完成動画の内容・音声・素材権利・チャンネルを確認したのち、既存の投稿手順を別途使う。自動投稿は禁止。

handoff.jsonはeditorial_review=unreviewed、publishing_authorized=false。技術合格は編集合格でも公開許可でもない。

将来の自動化には別repoへの認証と制作エージェントの実行基盤が必要。公開トークンをexport-longformに持ち込まない。優れた演出は作品を確認してから再利用部品へ昇格させ、両エンジンは統合しない。

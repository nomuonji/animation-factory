# Reviewed creative briefs

Each filename is the canonical Keywords Idea Memory ID plus .json, for example idea-abc123.json.

The Keywords read-only feed returns only market idea metadata; it does not contain scripts. This directory owns per-idea derivative scripts, distinct from the canonical Idea Memory. Do not copy a whole idea collection here.

A real brief looks like:

{
  "ideaId": "example-id",
  "sourceRevision": 3,
  "videoExperiment": {
    "variant": "hook-a",
    "evidenceChecked": true,
    "rightsChecked": true,
    "hook": "質問形式の短い見出し",
    "hookVoice": "最初の読み上げの原稿",
    "beats": [
      {"heading":"1つ目","body":"画面に表示する文","voice":"短い読み上げ"},
      {"heading":"2つ目","body":"画面に表示する文","voice":"短い読み上げ"},
      {"heading":"3つ目","body":"画面に表示する文","voice":"短い読み上げ"}
    ],
    "close": "視聴者に尋ねること",
    "closeVoice": "最後の読み上げ"
  }
}

Do not mark evidenceChecked or rightsChecked true without editorial assessment of claims, source URLs, license/rights, and the actual scripted words. A passing score on an Idea Memory record is NOT an independent review of a derivative video.

If Keywords increments the idea revision, re-review and revise the creative brief to match; stale briefs do not render. There is no permanent video/approval stored in Idea Memory by this directory.

A future creative worker may prepare briefs automatically, but publishing stays disconnected until channel ownership, OAuth, verified video render and upload receipt storage are in place. The synthetic fixture in examples is never an actual audience test.

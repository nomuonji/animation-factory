# Market Shorts — experimental demand testing

This is a preview-only independent workstream. It does not alter English YouTube or the canonical Keywords Idea Memory. No YouTube channel, OAuth, schedule, posting, metrics retrieval or live Keywords feed is configured here.

## Data flow

Keywords Idea Memory -> independently reviewed short-form creative brief -> authenticated read-only JSON projection -> Animation Factory production -> VOICEVOX Nemo audio -> MP4 -> GitHub Actions review artifact.

GitHub Actions workflow: Market Shorts preview (no publishing). Manual mode "synthetic" runs a sample preview; "live" needs an explicit canonical idea ID, plus a read-only feed. A repository_dispatch with type market_shorts_preview and client_payload.idea_id also selects a real idea.

Repository variable: MARKET_IDEAS_FEED_URL. Repository secret: MARKET_IDEAS_FEED_TOKEN. Read-only HTTPS JSON with shape { "ideas": [ ... ] } or an array. Do not copy the entire idea collection into a public repo. The MCP tool is not directly callable from GitHub Actions, so an authenticated Keywords exporter/endpoint is a separate integration task.

## Canonical idea contract

Each live idea needs id, title, revision, status, destinations containing youtube_shorts (or short_video), nonempty marketEvidenceRefs, and agentReview with rubricVersion idea-final-judge-v4, verdict pass, all six axes integer 4 or higher.

videoExperiment must be a distinct editorial record with variant, evidenceChecked=true, rightsChecked=true, hook, hookVoice, exactly three beats with heading/body/voice, close and closeVoice. Review flags must come from actual independently reviewed evidence and rights, not model self-certification or synthetic scoring. The generator rejects absent inputs and rejected/deferred ideas.

Output uses production ID hashed from canonical idea ID, a reversible experiment.json source reference, vertical 1080x1920 video, existing Animation Factory essay-card visual, and VOICEVOX Nemo narration. The synthetic fixture contains invented test scores and a sentinel evidence marker solely to exercise software; it is NEVER eligible for publication or demand conclusions.

## Local rendering

1. Install Node 22, npm dependencies, FFmpeg, Playwright browser and VOICEVOX Nemo engine on local port 50021.
2. Run: node tools/market-shorts.mjs --input market-shorts/examples/synthetic-fixture.json
3. Read the returned production id.
4. Run: node tools/validate-production.mjs productions/<id>/production.json
5. Run: node tools/validate-attention.mjs productions/<id>/production.json
6. Run: npm run render -- <id>

The Actions workflow performs these steps plus builds the review artifact. No upload happens from it.

## Integration still required

- Keywords: build an authenticated read-only exporter using existing canonical Idea Memory; do not create another idea DB. Add a per-idea/variant experiment inventory and dedupe.
- Editorial: agent-generated video treatment must be independently checked for factual evidence, content rights, originality and speech/visual timing before feed publication.
- Channel: connect a distinct experimental channel with OAuth; start uploads as private, verify channel ID and persist upload receipts, never blindly retry an unknown upload.
- Measurement: pull YouTube Analytics checkpoints at 24h/72h/7d, compare normalized within-category data, distinguish topical attention from validated product demand, and attach experiment records back to Idea Memory.
- Automation: cap at two Shorts/day only after creative, cost, credential and publishing checks. This workflow intentionally has no timer and cannot publicly post.

Do not treat a merged PR or generated MP4 as evidence that the end-to-end live publishing system is running.

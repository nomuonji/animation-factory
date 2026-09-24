# Long-form YouTube production practice

The default path for this series is free-only.

## Voice
- Production default: VOICEVOX Nemo running locally in GitHub Actions.
- Store the required credit in `meta.credits`.
- `dialogue.say.text` is display copy.
- `dialogue.say.spokenText` is pronunciation/pause optimized narration copy.
- Piper Plus is a lightweight fallback; paid cloud TTS is not a dependency.

## Attention
Author attention beats before a full render.
- One primary reading target at a time.
- Essay/status cards suppress dialogue subtitles in deterministic render mode.
- Every readable block gets a reading-time budget.
- Use a 30–60 second quality probe before rendering a long video.

Workflow:
research → script → spoken script → attention beats → quality probe → review → full production

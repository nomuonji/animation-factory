# Footage-first Shorts — reusable production contract (2026-10-17)

Canonical editorial Skill: **My Portal chatSkills / short-form-video-direction revision 2**. Read before creative decisions. User's direct positive evaluation of the genuine chameleon-change video was «良くなったと思う。もっと尺長いほうがいいけど。その感じで、今後作れるようにしておいて». This repo implements a reusable **source video + narrative beats** producer; do not clone the animal subject to meet that request.

## Creative guidance

**Preferred starting runtime: 40–60 seconds**, because the prior 21s cut felt short. It is NOT a validator, SEO trick, or permission to pad content. Opening frame displays the promised object/event immediately, middle footage must show **new real physical action**, and the ending must actually resolve the visual promise. If the second act does not exist, change idea or shorten. Good moving footage may come from one continuous shot: never force five still pictures. Talk about *actual changing objects*, not a list of facts pasted over unrelated photographs. Use YouTube's stayed-to-watch and engagement retention after publishing for empirical editing feedback, not just export metrics.

## Usable tools now

- Reusable authoring spec: `productions/<slug>/footage-first.json`. Select source video objects with exact rights, SHA-1 and source pages, choose one or many story beats at source timecodes with `motion`, `wide`, `compare` layouts, subtitle phrases **separate** from narration. The JSON includes explicit first-frame promise and final payoff.
- Validation: `node tools/footage-first-validate.mjs productions/<slug>/footage-first.json`, including genuine moving footage (except synthetic demo), exact Commons source file, valid CC license, credited original author, nonempty story movements, no forced still count, advisory runtime only.
- Render: `python tools/footage-first-render.py productions/<slug>/footage-first.json`. Requires Python packages `numpy Pillow opencv-python-headless`, FFmpeg, Node 22 and Japanese Noto CJK font. For narration, VOICEVOX Nemo must already be listening at `http://127.0.0.1:50021`.
- Action: **Actions → Footage-first Shorts (draft review) → Run workflow**, set production folder. On each dispatch it validates the exact rights and downloads original video from approved Commons URL, verifies file SHA-1, normalizes decoder frames without recoloring, makes vertical 1080×1920 H.264/AAC video with Japanese Nemo TTS and original ambient audio, and uploads both the playable MP4 and review contact sheet as private GitHub artifact.
- Demo: `productions/footage-first-smoke/footage-first.json`. It uses synthetic FFmpeg test media **solely as a technical CI test**, never as YouTube content.
- Real 40.2-second authored *example brief*, not editorially approved final video: `productions/chameleon-short/footage-first.json`. It uses the previously verified 2015 CC BY 4.0 excited/relaxed source movies and includes new visible second-half action. Its output remains a draft until actually rendered, watched and judged.

## Distinguish the three gates

1. **Source rights/technical PASS**: origin, checksum, decoding, MP4/AAC output, source credit.
2. **Editorial PASS** (not automated): first frame viewable on a phone with sound muted, changes observable in real footage, narration/audio matches actual image, second act not padded, final reward. Watch real cut and regenerate when weak. A CI PASS never implies creative PASS.
3. **Audience validation** (not inferred): separate experimental channel and YouTube Analytics after eventual publication. No automatic upload from this workflow. Existing English channel unaffected.

## Compatibility with earlier adapter

The legacy `tools/market-shorts.mjs` still produces its own five-photo card/photo mode and should **not** be used for the preferred motion-led real-footage videos. This newer footage-first workflow is the default route for concepts where observable change and narrative are available. First research the market idea and actual source footage, then author its source- and beat-driven brief. Do not pretend the old five-image gate is an overall quality or publication criterion. The two workflows are complementary; they are not yet wired into one automatic routing service.

## Media specifics

For research footage accelerated in the source, note `sourceNotice` on the beat (visible on screen), and record changes of speed in the description. The chameleon example is from Teyssier et al. (2015), Nature Communications, DOI 10.1038/ncomms7368, licensed CC BY 4.0. Never describe a different clip as the same individual without evidence. All editing/source links/author credits belong in the eventual publication description. Short music cues are original synthesized sounds; no ripped YouTube trending tracks.

## Next authoring sequence

Select an interesting real action → verify license and source SHA → inspect source filmstrip → first and last frames → shotlist with *new information or physical change per beat* → try 40–60s with a genuine second act → generate rough cut → editorial review on phone → revise cut → optional channel distribution only after approval.

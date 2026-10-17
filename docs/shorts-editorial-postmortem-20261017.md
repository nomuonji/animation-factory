# Shorts editorial postmortem and direction handoff — 2026-10-17

**Status: EDITORIAL REJECT / TECHNICALLY VERIFIED. Not publishable.**

Canonical editorial skill: My Portal chatSkills DB \`short-form-video-direction\` revision 1 (Short-Form Video Direction — Shortsの構成・演出・編集審査). This GitHub file is a concrete audit of a video, not a replacement for that canonical skill. Retrieve the skill before choosing concepts or designing storyboards. The user's explicit feedback on the rendered video: 「動画としてごみ動画」. Do not describe this video as passing a creative quality review. Successful CI, media license checks, H.264/AAC export, and usable photographs demonstrate technical delivery only.

## Actual failed video

- Idea Memory source: \`marketidea-20261017-museum-artifact-transformations-v1\`
- Production: \`productions/museum-idea-shorts-20261017-02/production.json\`
- Source/copyright metadata: \`productions/museum-idea-shorts-20261017-02/experiment.json\`
- Completed render: https://github.com/nomuonji/animation-factory/actions/runs/39022159529
- 25.5 seconds, 1080x1920, 7 photographed cuts, 5 source assets, a voice track, repetitive lower-half subtitles / upper headlines / stock whooshes.

### Shot/time analysis from source timeline and actual MP4 filmstrip
| Time | Advertised storyline | What's actually shown | Why viewer does not receive payoff |
|---|---|---|---|
| 0–3.0 | National treasure replica selling for ¥4,950 | Photograph of an independently photographed *different* replica gold seal, large \`国宝4,950円!?\` headline | Viewer sees only a gold object, not the purchasable product, its size in hand, its selling page, or any transformation. A misleading promise is opened. |
| 3.0–6.1 | Museum replica correction | Another cropped gold seal face | Repeats the same visual category to explain an apology, not progress in the story. |
| 6.1–9.5 | 2.3 cm / gold plated / SOLD OUT | Repeated first gold seal photo | No size comparison, scale, or visually surprising demonstration; another numeric fact. |
| 9.5–13.6 | Clay dogu transformed into articulated figurine | Static archival photo of archaeological dogu | The core word **動く** is never demonstrated. |
| 13.6–17.4 | The figure costs ¥11,000 | Same photograph with a different text overlay | Not one shot of the poseable merchandise. Little new information in frame. |
| 17.4–21.4 | Haniwa transformed into buildable paper craft | ColBase photo of the original haniwa | No paper-cutout, folding, or transformation. |
| 21.4–25.5 | ¥960, audience question | Another archaeological haniwa photo + generic question | No final reveal, comic turn, sensory payoff or callback. |

Narration is expository and largely duplicates the captions. Cuts use similar timing, context, and on-screen typography for almost the entire duration. Sound effects are mapped to cut position automatically, not to filmed action. The character bank actors function as decoration, not story participants. This fails as entertainment or as a market demand-test video independent of research correctness.

### Independent craft assessment (1–5, *not* algorithm thresholds)
- First-frame visual promise: **2/5** — a concrete price is visible, but the product and the nature of the surprise are not.
- Film actually demonstrates its promise: **1/5** — product conversions never shown.
- Narrative change and curiosity: **1/5** — three items listed without developing a situation.
- Satisfying final payoff: **1/5** — interchangeable forced question.
- Synced intelligible audio/editing: **2/5** — track is encoded and hearable, but SFX are not motivated by action, voice reads slides.
- Originality / reason to share: **1/5** — information summary in a photomontage.
Result: **REJECT**. User's direct rejection is decisive even if a technical rubric gave higher marks; self-rating cannot override direct feedback.

## What should have been made (not a claim that assets are available)

A better direction for this very idea would *first* acquire rights-cleared photos/video of the exact products, and preferably actual in-hand demonstration: (1) hand places a 2.3cm gold seal replica beside a coin; (2) poseable dogu figurine bends its limbs on camera; (3) paper haniwa folds up from flat sheet. Every transition then depicts a real transformation. Define a specific viewer expectation in the first frame and pay it off in the final shot. If these assets are not available, **do not repurpose photographs of unrelated archaeological objects** and pretend they show merchandise. Change to a topic with strong demonstrable footage instead.

This is an example of a *possible* visual route, not final creative direction or a cleared shotlist. Product visuals and rights have not been obtained here.

## Next production contract (human-editing / automation boundary)
1. Choose the first frame and the last image before a general script or software implementation.
2. Record at least three comparable *real* Shorts reference links; distinguish documentary reading of interviews from actually frame-by-frame watching another video.
3. Explain what is visibly shown at 0s, each reversal, the payoff; cut shots that only repeat narration.
4. Generate a playable rough cut/probe and review **silent**, **audio only**, and **phone-sized audio/video** before full render. Actual visuals matter; static image count does not.
5. The final creative approval is independent of technical validation: production status \`technical_pass\` is not the same as \`editorial_pass\`; publish/upload only after both when channel credentials exist.
6. No fake virality promise and no blind 1-second/3-second/5-photo numerical rules. Capture actual YouTube Studio stayed-to-watch, engaged views, watch time and viewer responses after publishing, compare to similar content. Unknown until an experimental channel actually operates.
7. The earlier mandatory **exactly five licensed photos** generator rule may prevent card-only regressions but is **not a substitute for story, demonstrative footage, or creative assessment**. Rework that software rule before using it as a claim that a future video is good.

## Learning sources read (not substituted for watching specific reference videos)

- YouTube/Todd Sherman & Jenny Hoyos (2025): https://blog.youtube/creator-and-artist-stories/youtube-shorts-deep-dive/
- Direct Jenny Hoyos production interview: https://creatorscience.com/podcast/jenny-hoyos/
- YouTube/Jordan Howlett & Todd Sherman (2025): https://blog.youtube/creator-and-artist-stories/five-tips-to-master-shorts/
- YouTube Studio metrics: https://support.google.com/youtube/answer/12942217
- Note: **No new external Shorts video was directly watched frame-by-frame in this training pass**. Treat future reference-film study as outstanding, not falsely completed.

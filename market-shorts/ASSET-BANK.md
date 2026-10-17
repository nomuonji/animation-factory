# Shorts Asset Bank — rights, inventory and mix policy

Animation Factory now has an offline, curated starter bank: Kenney Interface Sounds (publisher lists 100 sounds), Impact Sounds (130), and Music Jingles (85). They are already stored locally under assets/kenney; the live inventory counts are computed by Node at test time rather than inferred from publisher counts. All three source packs are CC0-1.0 with local license files, per catalog/asset-library.json. Original source and archive SHA are recorded there.

The active sound roles in tools/sound-bank.mjs are:
- hook_hit: initial pattern interruption
- impact / thud: collision or reveal emphasis
- pop / click: visual beats and UI changes
- transition: change of scene or thought
- reveal / fail / suspense: short payoff cues

Each role selects an actual existing file from the approved pack. Selection is deterministic based on production ID and cue ID, so re-rendering the same video uses the same sound. There are no download calls in rendering and no mystery third-party assets.

The renderer also accepts the existing CC0 music IDs safe-space-loop, flowerbed-fields and battle-music-loop; these are hashed against the stored library catalog before using them. Music stays quieter than the narration by default. The original four procedural SFX and two synthetic music presets remain usable.

Operational checks:
- Run node tools/sound-bank.mjs to see the locally available number of media files and roles.
- Run node tools/sound-bank-smoke.mjs to check CC0 license evidence, paths, deterministic selection, local FFmpeg decode and approved music checksum.
- Choose audio.sfx entries with role (instead of preset); optionally use an approved bgm.assetId (instead of bgm.preset).
- Use at most one main dramatic effect per short beat. Overlays must not overpower spoken dialogue. Review final encoded audio and get human listening feedback.
- Keep background/video material license and author/source alongside the file; existing catalog has reusable background images, sprites and three CC0 music tracks.

Future asset acquisition: before adding stock footage or new audio packs, obtain from official source, verify license and restrictions (commercial derivatives, redistribution, attribution), store license + source URL + checksum + exact file, then select via an allowlisted role. Never download from another YouTube creator or rip platform licensed music as if it were royalty free.

**Rights distinction**: YouTube Studio's Audio Library is intended for YouTube production and is a source of copyright-safe assets subject to its licensing/attribution terms. The music and "Use this sound" remix options in Shorts are platform features with their own permissions and possible region restrictions. A track being popular on YouTube does not license file extraction, caching or external automated insertion. Trending sounds may be tracked as references/ideas separately and added only via a supported licensed flow.

**Performance distinction**: Sound is an editing tool. YouTube's official Shorts discovery guidance says watch choice and retention drive performance; having a large cache of effects does not, by itself, establish audience demand or improve a video's hook.

Primary source documents:
- https://kenney.nl/assets/interface-sounds
- https://kenney.nl/assets/impact-sounds
- https://kenney.nl/assets/music-jingles
- https://support.google.com/youtube/answer/3376882
- https://support.google.com/youtube/answer/11914225

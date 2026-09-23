# Asset library

Start with [`catalog/asset-library.json`](../catalog/asset-library.json) when choosing reusable art or sound. The library is deliberately broader than the current renderer: assets are stocked and licensed, while individual productions continue to use the supported component catalog until a reusable asset loader is added.

## Backgrounds

| Asset | Format | Best fit | Files |
| --- | --- | --- | --- |
| Rainy city alley | Portrait | Night streets, mystery, reflective scenes | [`master`](../assets/backgrounds/rainy-city-alley.png), [`270×480`](../assets/backgrounds/rainy-city-alley-270x480.png) |
| Summer shrine | Portrait | Fantasy, travel, summer, discovery | [`master`](../assets/backgrounds/summer-shrine.png), [`270×480`](../assets/backgrounds/summer-shrine-270x480.png) |
| Night office | Landscape | Dialogue, work, deadlines | [`master`](../assets/backgrounds/office-night-wide.png), [`480×270`](../assets/backgrounds/office-night-wide-480x270.png) |
| Rainy neighborhood | Landscape | Walking, travel, transitions, reflective scenes | [`master`](../assets/backgrounds/rainy-neighborhood-wide.png), [`480×270`](../assets/backgrounds/rainy-neighborhood-wide-480x270.png) |

All four have open foreground or floor space for character overlays. The smaller versions were scaled with nearest-neighbor filtering for the factory's portrait or landscape logical canvas. The generated masters are project assets, not CC0. The prompts were:

- **Rainy city alley:** “A rain-soaked Japanese city backstreet at blue hour, with small shop silhouettes, distant warm windows and wet pavement reflections. Polished hand-authored 16-bit pixel art; portrait 9:16; clear open foreground in the lower third; navy, teal and amber; no people, readable text, logos or watermark.”
- **Summer shrine:** “A sunlit small forest shrine clearing in early summer, with stone path, weathered shrine, hydrangeas, moss and filtered light. Polished hand-authored 16-bit pixel art; portrait 9:16; clear open foreground in the lower third; warm green and gold; no people, readable text, logos or watermark.”
- **Night office:** “An empty late-night Japanese office with panoramic city windows and desks at the sides. Polished 16-bit pixel art; landscape 16:9; open floor in the lower middle for actors; navy, charcoal and amber; no people, readable text, logos or watermark.”
- **Rainy neighborhood:** “A rainy Japanese neighborhood street at dusk, with small shops, a distant train crossing and wet pavement reflections. Polished 16-bit pixel art; landscape 16:9; open mid-ground in the lower center for actors; indigo, teal and amber; no people, readable text, logos or watermark.”

## Sprite packs

| Pack | Good for | Source |
| --- | --- | --- |
| `pico-8-platformer` | Tiny platform scenes and 8×8 tile animations | [Kenney](https://kenney.nl/assets/pico-8-platformer) |
| `roguelike-characters` | Modular characters, outfits and inventory | [Kenney](https://kenney.nl/assets/roguelike-characters) |
| `pixel-pack` | Monochrome UI pixels and simple particles | [Kenney](https://kenney.nl/assets/pixel-pack) |

All three are CC0 1.0. Keep the pixel grid aligned and use nearest-neighbor scaling. `roguelike-characters` is supplied as transparent and magenta spritesheets; choose the transparent sheet for compositing.

## Music

| Track | Length | Mood / suggested use | Source |
| --- | ---: | --- | --- |
| [`safe-space-loop.ogg`](../assets/music/safe-space-loop.ogg) | 2:28 | Soft, moody ambient; night or safe room | [Tsorthan Grove on OpenGameArt](https://opengameart.org/content/safe-space-0) |
| [`flowerbed-fields.ogg`](../assets/music/flowerbed-fields.ogg) | 1:46 | Bright chiptune; adventure and opening | [Zane Little Music on OpenGameArt](https://opengameart.org/content/flowerbed-fields-loop) |
| [`battle-music-loop.ogg`](../assets/music/battle-music-loop.ogg) | 2:32 | RPG battle; urgency and rising tension | [pmiller on OpenGameArt](https://opengameart.org/content/chiptune-battle-music) |

Each source page lists CC0. `safe-space-loop` is transcoded to Opus 160 kb/s from the author's FLAC; its source hash is in the catalog.

## Sound effects and stings

| Pack | Useful starting points | Source |
| --- | --- | --- |
| `interface-sounds` | `confirmation_001.ogg`, `select_001.ogg`, `error_001.ogg`, `open_001.ogg` | [Kenney](https://kenney.nl/assets/interface-sounds) |
| `impact-sounds` | `footstep_concrete_000.ogg`, `impactPunch_medium_000.ogg`, `impactWood_light_000.ogg` | [Kenney](https://kenney.nl/assets/impact-sounds) |
| `music-jingles` | `Audio/8-Bit jingles/` for title and completion stings; `Audio/Hit jingles/` for transitions | [Kenney](https://kenney.nl/assets/music-jingles) |

All three are CC0 1.0. Keep effects around the dialogue and BGM rather than driving them to 0 dB; the library files have not been loudness-normalized as a set.

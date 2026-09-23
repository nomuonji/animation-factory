# Audio pipeline

Audio is deliberately separate from Phaser rendering.

```text
production.json
├─ visual timeline -> deterministic PNG stream -> H.264 video
└─ audio config
   ├─ TTS
   ├─ procedural BGM
   └─ procedural SFX
          ↓
       mix.wav
          ↓
video + mix.wav -> FFmpeg -> final MP4
```

This separation keeps the animation runtime deterministic and lets TTS providers change without rewriting visual productions.

## Production audio block

```json
{
  "audio": {
    "masterVolume": 0.9,
    "tts": {
      "provider": "espeak-ng",
      "events": ["ui.speech"],
      "defaultVoice": {
        "voice": "ja",
        "rate": 175,
        "pitch": 50,
        "volume": 1
      },
      "actors": {
        "worker": { "rate": 185, "pitch": 55 },
        "boss": { "rate": 145, "pitch": 35 }
      }
    },
    "bgm": [
      {
        "id": "office",
        "preset": "office-night",
        "at": 0,
        "duration": 18,
        "volume": 0.12,
        "fadeIn": 0.7,
        "fadeOut": 1
      }
    ],
    "sfx": [
      { "id": "heal", "preset": "heal", "at": 3.5, "volume": 0.5 },
      { "id": "impact", "preset": "impact", "at": 8.15, "volume": 0.7 }
    ]
  }
}
```

## Automatic TTS alignment

TTS can be generated directly from existing `dialogue.say` and/or `ui.speech` events. The audio starts at the same absolute `at` timestamp, so agents do not need to duplicate dialogue text in a separate audio track.

Actor-specific voice settings override `defaultVoice`.

## Built-in TTS provider

The baseline provider is `espeak-ng`.

It is intentionally simple:

- no API key,
- available on Linux,
- deterministic enough for CI,
- supports Japanese voice selection through `voice: "ja"`.

It is a factory fallback, not the intended ceiling for voice quality. A later provider adapter can use VOICEVOX, Kokoro, OpenAI audio or another engine while preserving the production schema.

## Procedural audio

BGM and SFX presets are synthesized by FFmpeg itself, so the repository does not need binary sound files to prove the full pipeline.

Current BGM:

- `office-night`
- `retro-drone`

Current SFX:

- `heal`
- `impact`
- `coin`
- `alert`

The machine-readable inventory is `catalog/audio.json`.

## Render requirements

In addition to the visual renderer requirements:

- FFmpeg must be on `PATH`.
- `espeak-ng` is required only when a production uses the built-in TTS provider.

The manual GitHub Actions renderer installs both.

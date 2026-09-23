# Authoring productions

Productions are data. Agents should prefer composing existing capabilities over writing new Phaser code.

## 1. Inspect the catalog

Read `catalog/components.json` before authoring. It lists available actors, environments, event kinds and required parameters.

## 2. Create a production folder

```text
productions/my-short/
└─ production.json
```

The preview registry discovers this folder automatically.

## 3. Define the canvas and actors

```json
{
  "meta": {
    "id": "my-short",
    "title": "My Short",
    "duration": 8
  },
  "canvas": {
    "width": 270,
    "height": 480,
    "fps": 30,
    "outputScale": 4
  },
  "environment": "office-night",
  "actors": [
    {
      "id": "worker",
      "archetype": "salaryman",
      "x": 60,
      "y": 390,
      "scale": 2
    }
  ],
  "events": []
}
```

## 4. Add events on an absolute timeline

Every event has `at` in seconds. Timed events must finish before `meta.duration`.

```json
[
  {
    "kind": "actor.move",
    "at": 0.5,
    "actor": "worker",
    "x": 140,
    "y": 390,
    "duration": 2
  },
  {
    "kind": "dialogue.say",
    "at": 3,
    "actor": "worker",
    "text": "帰ろう。",
    "duration": 1.5
  }
]
```

## 5. Validate before rendering

```bash
npm run validate -- productions/my-short/production.json
```

Validation rejects unknown actors, unsupported poses/event kinds, invalid numeric values and timed events that extend past the production duration.

## Portrait and landscape

The canvas is part of each production, so both formats use the same events and renderer:

| Format | Logical canvas | Output scale | MP4 size | Typical use |
| --- | --- | --- | --- | --- |
| Vertical | 270×480 | 4 | 1080×1920 | Shorts |
| Landscape | 480×270 | 4 | 1920×1080 | Standard video and long-form episodes |

`productions/landscape-pilot/production.json` is a working 16:9 example using `office-night-wide`. For longer videos, set `meta.duration` to the intended number of seconds and divide the timeline into sections. Events still use absolute seconds, so a 10-minute production ends at 600. Check text legibility and actor spacing at the final 1920×1080 output size.

The preview studio and review gallery read the canvas aspect ratio from the production. They do not require a separate vertical or horizontal renderer.

## 6. Promote repeated ideas

If several productions repeat the same low-level event pattern, do not continue copying it. Promote that pattern into a reusable factory component or template and document it in the catalog.

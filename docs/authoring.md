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

## 6. Promote repeated ideas

If several productions repeat the same low-level event pattern, do not continue copying it. Promote that pattern into a reusable factory component or template and document it in the catalog.

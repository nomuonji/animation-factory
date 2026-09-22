# Component library

The factory component catalog is machine-readable at `catalog/components.json`. This document groups the current capabilities by directing intent.

## Actor motion

- `actor.move` — move an actor and automatically play the walk cycle.
- `actor.pose` — switch to a discrete pose.

## Dialogue and information

- `dialogue.say` — fixed RPG dialogue box.
- `ui.speech` — speech bubble anchored to an actor.
- `ui.caption` — fixed top caption.
- `ui.rpgStatus` — compact RPG status panel.

## Camera

- `camera.zoom` — interpolate zoom.
- `camera.pan` — interpolate camera scroll.
- `camera.shake` — short impact shake.

## Character reactions

- `effect.exclamation`
- `effect.damage`
- `effect.emote` with `heart` or `sweat`.

## Atmosphere and impact

- `effect.particles` with `spark`, `coin`, or `dust`.
- `effect.screenFlash` for impacts.
- `transition.fade` for scene boundaries.

## Props

`prop.show` currently supports:

- `coffee`
- `briefcase`
- `coin`

These are procedural placeholder props: they keep the system text-native and deterministic. Binary sprite assets can replace their renderer later without changing production files.

## Design rule

A production should express intent using these commands. If an agent repeatedly needs a sequence that is not represented here, promote the sequence into a reusable component or template rather than embedding Phaser-specific code in the production.

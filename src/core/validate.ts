import type { ActorPose, Production, TimelineEvent } from "./types";
import { validateAudioConfig } from "./validateAudio";

const ARCHETYPES = new Set(["salaryman", "boss", "robot"]);
const FACINGS = new Set(["left", "right"]);
const POSES = new Set<ActorPose>([
  "idle",
  "walk-a",
  "walk-b",
  "surprised",
  "dead-inside"
]);
const EMOTES = new Set(["sweat", "heart"]);
const PARTICLES = new Set(["spark", "coin", "dust"]);
const PROPS = new Set(["coffee", "briefcase", "coin"]);
const FADE_MODES = new Set(["in", "out"]);
const HEX_COLOR = /^#?[0-9a-fA-F]{6}$/;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function requireDuration(
  event: { kind: string; at: number; duration?: number },
  total: number
): number {
  if (!isFiniteNumber(event.duration) || event.duration <= 0) {
    throw new Error(`${event.kind} at ${event.at}s requires duration > 0.`);
  }
  if (event.at + event.duration > total + Number.EPSILON) {
    throw new Error(
      `${event.kind} at ${event.at}s ends after production duration (${total}s).`
    );
  }
  return event.duration;
}

function requireActorReference(
  event: { kind: string; actor?: string },
  actorIds: Set<string>
): string {
  if (typeof event.actor !== "string" || !actorIds.has(event.actor)) {
    throw new Error(
      `${event.kind} references unknown actor "${String(event.actor)}".`
    );
  }
  return event.actor;
}

function requireText(kind: string, text: unknown): string {
  if (typeof text !== "string" || text.length === 0) {
    throw new Error(`${kind} requires non-empty text.`);
  }
  return text;
}

function validateColor(kind: string, color: unknown): void {
  if (color !== undefined && (typeof color !== "string" || !HEX_COLOR.test(color))) {
    throw new Error(`${kind} color must be a 6-digit hex string.`);
  }
}

function validateEvent(
  event: TimelineEvent,
  actorIds: Set<string>,
  totalDuration: number
): void {
  if (!isFiniteNumber(event.at) || event.at < 0 || event.at > totalDuration) {
    throw new Error(`Event ${event.kind} has invalid at=${String(event.at)}.`);
  }

  switch (event.kind) {
    case "actor.move":
      requireActorReference(event, actorIds);
      requireDuration(event, totalDuration);
      if (!isFiniteNumber(event.x) || !isFiniteNumber(event.y)) {
        throw new Error("actor.move requires finite x and y.");
      }
      return;

    case "actor.pose":
      requireActorReference(event, actorIds);
      if (!POSES.has(event.pose)) {
        throw new Error(`actor.pose has unsupported pose "${String(event.pose)}".`);
      }
      return;

    case "dialogue.say":
    case "ui.speech":
      requireActorReference(event, actorIds);
      requireDuration(event, totalDuration);
      requireText(event.kind, event.text);
      return;

    case "ui.caption":
      requireDuration(event, totalDuration);
      requireText(event.kind, event.text);
      return;

    case "ui.rpgStatus":
      requireDuration(event, totalDuration);
      requireText(event.kind, event.title);
      if (
        !Array.isArray(event.lines) ||
        event.lines.length === 0 ||
        event.lines.some((line) => typeof line !== "string" || line.length === 0)
      ) {
        throw new Error("ui.rpgStatus requires a non-empty string lines array.");
      }
      return;

    case "camera.zoom":
      requireDuration(event, totalDuration);
      if (!isFiniteNumber(event.zoom) || event.zoom <= 0) {
        throw new Error("camera.zoom requires zoom > 0.");
      }
      return;

    case "camera.pan":
      requireDuration(event, totalDuration);
      if (!isFiniteNumber(event.x) || !isFiniteNumber(event.y)) {
        throw new Error("camera.pan requires finite x and y.");
      }
      return;

    case "camera.shake":
      requireDuration(event, totalDuration);
      if (
        event.intensity !== undefined &&
        (!isFiniteNumber(event.intensity) || event.intensity < 0)
      ) {
        throw new Error("camera.shake intensity must be >= 0.");
      }
      return;

    case "effect.damage":
      requireActorReference(event, actorIds);
      if (event.duration !== undefined) requireDuration(event, totalDuration);
      requireText(event.kind, event.text);
      return;

    case "effect.exclamation":
      requireActorReference(event, actorIds);
      if (event.duration !== undefined) requireDuration(event, totalDuration);
      return;

    case "effect.emote":
      requireActorReference(event, actorIds);
      requireDuration(event, totalDuration);
      if (!EMOTES.has(event.emote)) {
        throw new Error(`effect.emote has unsupported emote "${String(event.emote)}".`);
      }
      return;

    case "effect.particles":
      requireActorReference(event, actorIds);
      requireDuration(event, totalDuration);
      if (!PARTICLES.has(event.particle)) {
        throw new Error(
          `effect.particles has unsupported particle "${String(event.particle)}".`
        );
      }
      return;

    case "effect.screenFlash":
      requireDuration(event, totalDuration);
      validateColor(event.kind, event.color);
      if (
        event.strength !== undefined &&
        (!isFiniteNumber(event.strength) || event.strength < 0 || event.strength > 1)
      ) {
        throw new Error("effect.screenFlash strength must be between 0 and 1.");
      }
      return;

    case "transition.fade":
      requireDuration(event, totalDuration);
      if (!FADE_MODES.has(event.mode)) {
        throw new Error(`transition.fade has unsupported mode "${String(event.mode)}".`);
      }
      validateColor(event.kind, event.color);
      return;

    case "prop.show":
      requireDuration(event, totalDuration);
      if (!PROPS.has(event.prop)) {
        throw new Error(`prop.show has unsupported prop "${String(event.prop)}".`);
      }
      if (!isFiniteNumber(event.x) || !isFiniteNumber(event.y)) {
        throw new Error("prop.show requires finite x and y.");
      }
      if (
        event.scale !== undefined &&
        (!isFiniteNumber(event.scale) || event.scale <= 0)
      ) {
        throw new Error("prop.show scale must be > 0.");
      }
      return;

    default: {
      const unreachable: never = event;
      throw new Error(`Unsupported event kind: ${String(unreachable)}`);
    }
  }
}

export function validateProduction(value: unknown): asserts value is Production {
  if (!value || typeof value !== "object") {
    throw new Error("Production must be an object.");
  }

  const production = value as Partial<Production>;

  if (
    typeof production.meta?.id !== "string" ||
    production.meta.id.length === 0 ||
    typeof production.meta.title !== "string" ||
    production.meta.title.length === 0 ||
    !isFiniteNumber(production.meta.duration) ||
    production.meta.duration <= 0
  ) {
    throw new Error("Production meta.id, meta.title and meta.duration > 0 are required.");
  }

  const canvas = production.canvas;
  if (
    !canvas ||
    !Number.isInteger(canvas.width) ||
    canvas.width <= 0 ||
    !Number.isInteger(canvas.height) ||
    canvas.height <= 0 ||
    !Number.isInteger(canvas.fps) ||
    canvas.fps <= 0 ||
    canvas.fps > 120 ||
    !Number.isInteger(canvas.outputScale) ||
    canvas.outputScale <= 0 ||
    canvas.outputScale > 8
  ) {
    throw new Error("Canvas width/height/fps/outputScale are invalid.");
  }

  if (typeof production.environment !== "string" || production.environment.length === 0) {
    throw new Error("Production environment is required.");
  }

  if (!Array.isArray(production.actors) || !Array.isArray(production.events)) {
    throw new Error("Production actors and events must be arrays.");
  }

  const actorIds = new Set<string>();

  for (const actor of production.actors) {
    if (typeof actor.id !== "string" || actor.id.length === 0 || actorIds.has(actor.id)) {
      throw new Error(`Actor ids must be unique. Invalid id: ${String(actor.id)}`);
    }
    actorIds.add(actor.id);

    if (!ARCHETYPES.has(actor.archetype)) {
      throw new Error(`Unsupported actor archetype "${String(actor.archetype)}".`);
    }
    if (!isFiniteNumber(actor.x) || !isFiniteNumber(actor.y)) {
      throw new Error(`Actor "${actor.id}" requires finite x and y.`);
    }
    if (actor.scale !== undefined && (!isFiniteNumber(actor.scale) || actor.scale <= 0)) {
      throw new Error(`Actor "${actor.id}" scale must be > 0.`);
    }
    if (actor.facing !== undefined && !FACINGS.has(actor.facing)) {
      throw new Error(`Actor "${actor.id}" has invalid facing.`);
    }
    if (actor.pose !== undefined && !POSES.has(actor.pose)) {
      throw new Error(`Actor "${actor.id}" has invalid pose.`);
    }
  }

  for (const event of production.events) {
    validateEvent(event, actorIds, production.meta.duration);
  }

  if (production.audio) {
    validateAudioConfig(production.audio, actorIds, production.meta.duration);
  }
}

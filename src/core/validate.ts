import type { ActorPose, Production, TimelineEvent } from "./types";

const ARCHETYPES = new Set(["salaryman", "boss"]);
const FACINGS = new Set(["left", "right"]);
const POSES = new Set<ActorPose>([
  "idle",
  "walk-a",
  "walk-b",
  "surprised",
  "dead-inside"
]);

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function requireDuration(event: { kind: string; at: number; duration?: number }, total: number): number {
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
      requireActorReference(event, actorIds);
      requireDuration(event, totalDuration);
      if (typeof event.text !== "string" || event.text.length === 0) {
        throw new Error("dialogue.say requires non-empty text.");
      }
      return;

    case "ui.caption":
      requireDuration(event, totalDuration);
      if (typeof event.text !== "string" || event.text.length === 0) {
        throw new Error("ui.caption requires non-empty text.");
      }
      return;

    case "camera.zoom":
      requireDuration(event, totalDuration);
      if (!isFiniteNumber(event.zoom) || event.zoom <= 0) {
        throw new Error("camera.zoom requires zoom > 0.");
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
      if (typeof event.text !== "string" || event.text.length === 0) {
        throw new Error("effect.damage requires non-empty text.");
      }
      return;

    case "effect.exclamation":
      requireActorReference(event, actorIds);
      if (event.duration !== undefined) requireDuration(event, totalDuration);
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
}

import { validateAudio } from "./validate-audio.mjs";
import { readFile } from "node:fs/promises";

const path = process.argv[2];
if (!path) {
  console.error("Usage: node tools/validate-production.mjs <production.json>");
  process.exit(1);
}

const production = JSON.parse(await readFile(path, "utf8"));
const productionSchema = JSON.parse(
  await readFile(new URL("../schemas/production.schema.json", import.meta.url), "utf8")
);
const errors = [];
const archetypes = new Set(
  productionSchema.properties.actors.items.properties.archetype.enum
);
const facings = new Set(["left", "right"]);
const poses = new Set(["idle", "walk-a", "walk-b", "surprised", "dead-inside"]);
const emotes = new Set(["sweat", "heart"]);
const particles = new Set(["spark", "coin", "dust"]);
const props = new Set(["coffee", "briefcase", "coin"]);
const fadeModes = new Set(["in", "out"]);
const colorPattern = /^#?[0-9a-fA-F]{6}$/;

const finite = (value) => typeof value === "number" && Number.isFinite(value);

function durationOf(event) {
  if (!finite(event.duration) || event.duration <= 0) {
    errors.push(`${event.kind} at ${event.at}s requires duration > 0`);
    return null;
  }
  if (
    finite(production?.meta?.duration) &&
    event.at + event.duration > production.meta.duration + Number.EPSILON
  ) {
    errors.push(`${event.kind} at ${event.at}s ends after production duration`);
  }
  return event.duration;
}

function validColor(event) {
  if (
    event.color !== undefined &&
    (typeof event.color !== "string" || !colorPattern.test(event.color))
  ) {
    errors.push(`${event.kind} color must be a 6-digit hex string`);
  }
}

if (!production || typeof production !== "object") errors.push("production must be an object");
if (typeof production?.meta?.id !== "string" || !production.meta.id) errors.push("meta.id is required");
if (typeof production?.meta?.title !== "string" || !production.meta.title) errors.push("meta.title is required");
if (!finite(production?.meta?.duration) || production.meta.duration <= 0) errors.push("meta.duration must be > 0");

const canvas = production?.canvas;
if (!Number.isInteger(canvas?.width) || canvas.width <= 0) errors.push("canvas.width must be a positive integer");
if (!Number.isInteger(canvas?.height) || canvas.height <= 0) errors.push("canvas.height must be a positive integer");
if (!Number.isInteger(canvas?.fps) || canvas.fps <= 0 || canvas.fps > 120) errors.push("canvas.fps must be an integer from 1 to 120");
if (!Number.isInteger(canvas?.outputScale) || canvas.outputScale <= 0 || canvas.outputScale > 8) {
  errors.push("canvas.outputScale must be an integer from 1 to 8");
}

if (typeof production?.environment !== "string" || !production.environment) errors.push("environment is required");
if (!Array.isArray(production?.actors)) errors.push("actors must be an array");
if (!Array.isArray(production?.events)) errors.push("events must be an array");

const actorIds = new Set();
for (const actor of production.actors ?? []) {
  if (typeof actor.id !== "string" || !actor.id) errors.push("every actor needs a non-empty id");
  if (actorIds.has(actor.id)) errors.push(`duplicate actor id: ${actor.id}`);
  actorIds.add(actor.id);

  if (!archetypes.has(actor.archetype)) errors.push(`unsupported archetype for actor ${actor.id}: ${actor.archetype}`);
  if (!finite(actor.x) || !finite(actor.y)) errors.push(`actor ${actor.id} requires finite x/y`);
  if (actor.scale !== undefined && (!finite(actor.scale) || actor.scale <= 0)) errors.push(`actor ${actor.id} scale must be > 0`);
  if (actor.facing !== undefined && !facings.has(actor.facing)) errors.push(`actor ${actor.id} has invalid facing`);
  if (actor.pose !== undefined && !poses.has(actor.pose)) errors.push(`actor ${actor.id} has invalid pose`);
}

for (const event of production.events ?? []) {
  if (!event || typeof event !== "object") {
    errors.push("every event must be an object");
    continue;
  }
  if (!finite(event.at) || event.at < 0 || event.at > production.meta.duration) {
    errors.push(`event ${event.kind ?? "unknown"} has invalid at`);
    continue;
  }

  const requireActor = () => {
    if (typeof event.actor !== "string" || !actorIds.has(event.actor)) {
      errors.push(`${event.kind} references missing actor: ${String(event.actor)}`);
    }
  };
  const requireText = (field = "text") => {
    if (typeof event[field] !== "string" || !event[field]) {
      errors.push(`${event.kind} requires non-empty ${field}`);
    }
  };

  switch (event.kind) {
    case "actor.move":
      requireActor();
      durationOf(event);
      if (!finite(event.x) || !finite(event.y)) errors.push("actor.move requires finite x/y");
      break;
    case "actor.pose":
      requireActor();
      if (!poses.has(event.pose)) errors.push(`actor.pose has invalid pose: ${event.pose}`);
      break;
    case "dialogue.say":
    case "ui.speech":
      requireActor();
      durationOf(event);
      requireText();
      break;
    case "ui.caption":
      durationOf(event);
      requireText();
      break;
    case "ui.rpgStatus":
      durationOf(event);
      requireText("title");
      if (
        !Array.isArray(event.lines) ||
        event.lines.length === 0 ||
        event.lines.some((line) => typeof line !== "string" || !line)
      ) {
        errors.push("ui.rpgStatus requires a non-empty string lines array");
      }
      break;
    case "camera.zoom":
      durationOf(event);
      if (!finite(event.zoom) || event.zoom <= 0) errors.push("camera.zoom requires zoom > 0");
      break;
    case "camera.pan":
      durationOf(event);
      if (!finite(event.x) || !finite(event.y)) errors.push("camera.pan requires finite x/y");
      break;
    case "camera.shake":
      durationOf(event);
      if (event.intensity !== undefined && (!finite(event.intensity) || event.intensity < 0)) {
        errors.push("camera.shake intensity must be >= 0");
      }
      break;
    case "effect.damage":
      requireActor();
      requireText();
      if (event.duration !== undefined) durationOf(event);
      break;
    case "effect.exclamation":
      requireActor();
      if (event.duration !== undefined) durationOf(event);
      break;
    case "effect.emote":
      requireActor();
      durationOf(event);
      if (!emotes.has(event.emote)) errors.push(`effect.emote has invalid emote: ${event.emote}`);
      break;
    case "effect.particles":
      requireActor();
      durationOf(event);
      if (!particles.has(event.particle)) errors.push(`effect.particles has invalid particle: ${event.particle}`);
      break;
    case "effect.screenFlash":
      durationOf(event);
      validColor(event);
      if (event.strength !== undefined && (!finite(event.strength) || event.strength < 0 || event.strength > 1)) {
        errors.push("effect.screenFlash strength must be between 0 and 1");
      }
      break;
    case "transition.fade":
      durationOf(event);
      validColor(event);
      if (!fadeModes.has(event.mode)) errors.push(`transition.fade has invalid mode: ${event.mode}`);
      break;
    case "prop.show":
      durationOf(event);
      if (!props.has(event.prop)) errors.push(`prop.show has invalid prop: ${event.prop}`);
      if (!finite(event.x) || !finite(event.y)) errors.push("prop.show requires finite x/y");
      if (event.scale !== undefined && (!finite(event.scale) || event.scale <= 0)) {
        errors.push("prop.show scale must be > 0");
      }
      break;
    default:
      errors.push(`unsupported event kind: ${String(event.kind)}`);
  }
}

validateAudio(production.audio, actorIds, production.meta.duration, errors);

if (errors.length) {
  console.error("Production validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  `OK: ${production.meta.id} (${production.events.length} events, ${production.meta.duration}s, ${production.canvas.fps}fps)`
);

import { readFile } from "node:fs/promises";

const path = process.argv[2];
if (!path) {
  console.error("Usage: node tools/validate-production.mjs <production.json>");
  process.exit(1);
}

const production = JSON.parse(await readFile(path, "utf8"));
const errors = [];

if (!production?.meta?.id) errors.push("meta.id is required");
if (!production?.meta?.title) errors.push("meta.title is required");
if (!(production?.meta?.duration > 0)) errors.push("meta.duration must be > 0");
if (!(production?.canvas?.width > 0 && production?.canvas?.height > 0)) errors.push("canvas dimensions must be > 0");
if (!Array.isArray(production?.actors)) errors.push("actors must be an array");
if (!Array.isArray(production?.events)) errors.push("events must be an array");

const actorIds = new Set();
for (const actor of production.actors ?? []) {
  if (!actor.id) errors.push("every actor needs an id");
  if (actorIds.has(actor.id)) errors.push(`duplicate actor id: ${actor.id}`);
  actorIds.add(actor.id);
}
for (const event of production.events ?? []) {
  if (typeof event.at !== "number") errors.push(`event ${event.kind ?? "unknown"} needs numeric at`);
  if (event.at < 0 || event.at > production.meta.duration) {
    errors.push(`event ${event.kind} at ${event.at}s is outside production duration`);
  }
  if (event.actor && !actorIds.has(event.actor)) {
    errors.push(`event ${event.kind} references missing actor: ${event.actor}`);
  }
}

if (errors.length) {
  console.error("Production validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log(`OK: ${production.meta.id} (${production.events.length} events, ${production.meta.duration}s)`);

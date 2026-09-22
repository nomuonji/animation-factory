import type { Production } from "./types";

export function validateProduction(value: unknown): asserts value is Production {
  if (!value || typeof value !== "object") throw new Error("Production must be an object.");

  const production = value as Partial<Production>;
  if (!production.meta?.id || !production.meta.title || !production.meta.duration) {
    throw new Error("Production meta.id, meta.title and meta.duration are required.");
  }
  if (!production.canvas || production.canvas.width <= 0 || production.canvas.height <= 0) {
    throw new Error("Production canvas must have positive dimensions.");
  }
  if (!Array.isArray(production.actors) || !Array.isArray(production.events)) {
    throw new Error("Production actors and events must be arrays.");
  }

  const actorIds = new Set<string>();
  for (const actor of production.actors) {
    if (!actor.id || actorIds.has(actor.id)) throw new Error(`Actor ids must be unique. Invalid id: ${actor.id}`);
    actorIds.add(actor.id);
  }

  for (const event of production.events) {
    if (event.at < 0 || event.at > production.meta.duration) {
      throw new Error(`Event ${event.kind} is outside production duration.`);
    }
    if ("actor" in event && !actorIds.has(event.actor)) {
      throw new Error(`Event ${event.kind} references unknown actor "${event.actor}".`);
    }
  }
}

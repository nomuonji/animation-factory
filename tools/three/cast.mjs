/**
 * Resolve reusable cast presets (catalog/cast3d.json) into a production.
 * actors.<id>.cast = "<preset>" fills style / figure / height / expr / captionColor;
 * voices.<id> falls back to the preset voice. Values written in the production win
 * (style is merged key by key).
 */
import { readFile } from "node:fs/promises";

export async function loadCast(path = new URL("../../catalog/cast3d.json", import.meta.url)) {
  return JSON.parse(await readFile(path, "utf8")).cast;
}

export function resolveCast(prod, cast) {
  const actors = {}, voices = { ...(prod.voices ?? {}) };
  for (const [id, a] of Object.entries(prod.actors ?? {})) {
    if (!a.cast) { actors[id] = a; continue; }
    const p = cast[a.cast];
    if (!p) throw new Error(`actors.${id}: unknown cast "${a.cast}" (catalog/cast3d.json)`);
    const { name, role, voice, style, ...rest } = p;
    actors[id] = { ...rest, ...a, ...(style || a.style ? { style: { ...(style ?? {}), ...(a.style ?? {}) } } : {}) };
    if (voice) voices[id] = { ...voice, ...(prod.voices?.[id] ?? {}) };
  }
  return { ...prod, actors, voices };
}

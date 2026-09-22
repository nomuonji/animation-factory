import type { Production } from "./types";
import { validateProduction } from "./validate";

const modules = import.meta.glob("../../productions/*/production.json", {
  eager: true,
  import: "default"
}) as Record<string, unknown>;

function folderFromPath(path: string): string {
  const match = path.match(/productions\/([^/]+)\/production\.json$/);
  if (!match?.[1]) throw new Error(`Invalid production path: ${path}`);
  return match[1];
}

const registry = new Map<string, Production>();

for (const [path, value] of Object.entries(modules)) {
  validateProduction(value);
  registry.set(folderFromPath(path), value);
}

export function listProductions(): string[] {
  return [...registry.keys()].sort();
}

export function loadProduction(id: string): Production {
  const production = registry.get(id);
  if (!production) {
    throw new Error(
      `Unknown production "${id}". Available: ${listProductions().join(", ")}`
    );
  }
  return production;
}

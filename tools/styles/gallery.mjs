#!/usr/bin/env node
/**
 * Style gallery: renders one still per scene of a production in every style (or a list)
 * and tiles them into outputs/styles/gallery/<id>/<style>.jpg + all.jpg (rows in catalog order).
 *
 *   node tools/styles/gallery.mjs <production> [--styles stickman,clay] [--scale 0.4]
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const argv = process.argv.slice(2);
const id = argv[0];
if (!id || !/^[A-Za-z0-9._-]+$/.test(id)) { console.error("usage: gallery.mjs <production> [--styles a,b] [--scale 0.4]"); process.exit(2); }
const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const all = JSON.parse(readFileSync(join(root, "catalog", "styles.json"), "utf8")).styles.map((s) => s.id);
const styles = opt("styles") ? opt("styles").split(",") : all;
const scale = opt("scale", "0.4");
const out = join(root, "outputs", "styles", "gallery", id);
mkdirSync(out, { recursive: true });
const rows = [];
for (const s of styles) {
  const dir = join(root, "outputs", "styles", `${id}--${s}`);
  rmSync(dir, { recursive: true, force: true });
  const r = spawnSync("node", ["tools/styles/render-style.mjs", id, "--style", s, "--stills", "auto", "--scale", scale, "--no-lint"], { cwd: root, stdio: "inherit" });
  if (r.status !== 0) { console.error(`style ${s} failed`); process.exitCode = 1; continue; }
  const stills = readdirSync(dir).filter((f) => f.startsWith("still-")).sort((a, b) => parseFloat(a.slice(6)) - parseFloat(b.slice(6)));
  const row = join(out, `${s}.jpg`);
  const args = ["-y", "-loglevel", "error"];
  for (const f of stills) args.push("-i", join(dir, f));
  args.push("-filter_complex", `${stills.map((_, i) => `[${i}:v]scale=240:-2[v${i}]`).join(";")};${stills.map((_, i) => `[v${i}]`).join("")}hstack=inputs=${stills.length}`, "-frames:v", "1", row);
  if (stills.length === 1) args.splice(args.indexOf("-filter_complex"), 2, "-vf", "scale=240:-2");
  spawnSync("ffmpeg", args, { stdio: "inherit" });
  rows.push([s, row]);
}
if (rows.length > 1) {
  const args = ["-y", "-loglevel", "error"];
  for (const [, r] of rows) args.push("-i", r);
  args.push("-filter_complex", `${rows.map((_, i) => `[${i}:v]`).join("")}vstack=inputs=${rows.length}`, "-frames:v", "1", join(out, "all.jpg"));
  spawnSync("ffmpeg", args, { stdio: "inherit" });
}
writeFileSync(join(out, "rows.txt"), rows.map(([s]) => s).join("\n") + "\n");
console.log(`gallery: ${out} (${rows.length} styles; rows.txt lists the row order)`);

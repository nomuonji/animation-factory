import { spawn } from "node:child_process";
import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const productionFolder = process.argv[2];
if (!productionFolder || !/^[A-Za-z0-9._-]+$/.test(productionFolder)) {
  console.error("Usage: node tools/package-review.mjs <safe-production-folder>");
  process.exit(2);
}

const root = fileURLToPath(new URL("..", import.meta.url));
const productionPath = join(root, "productions", productionFolder, "production.json");
const production = JSON.parse(await readFile(productionPath, "utf8"));
const sourceVideo = join(root, "outputs", `${production.meta.id}.mp4`);
const packageDir = join(root, "review-package");
const videoPath = join(packageDir, "video.mp4");
const sheetPath = join(packageDir, "contact-sheet.jpg");
const ffmpeg = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

await rm(packageDir, { recursive: true, force: true });
await mkdir(packageDir, { recursive: true });
await copyFile(sourceVideo, videoPath);
await copyFile(productionPath, join(packageDir, "production.json"));

const duration = Math.max(1, Number(production.meta.duration) || 1);
const interval = Math.max(duration / 9, 0.25);

await run(ffmpeg, [
  "-hide_banner",
  "-loglevel",
  "error",
  "-y",
  "-i",
  videoPath,
  "-vf",
  `fps=1/${interval},scale=270:-1,tile=3x3:padding=6:margin=6`,
  "-frames:v",
  "1",
  "-q:v",
  "2",
  sheetPath
]);

const metadata = {
  schemaVersion: 1,
  productionFolder,
  productionId: production.meta.id,
  title: production.meta.title,
  description: production.meta.description ?? "",
  duration: production.meta.duration,
  fps: production.canvas?.fps ?? null,
  logicalSize: production.canvas
    ? `${production.canvas.width}x${production.canvas.height}`
    : null,
  outputScale: production.canvas?.outputScale ?? null,
  hasAudio: Boolean(production.audio),
  commitSha: process.env.GITHUB_SHA ?? null,
  runId: process.env.GITHUB_RUN_ID ?? null,
  runNumber: process.env.GITHUB_RUN_NUMBER ?? null,
  repository: process.env.GITHUB_REPOSITORY ?? null,
  renderedAt: new Date().toISOString()
};

await writeFile(
  join(packageDir, "metadata.json"),
  JSON.stringify(metadata, null, 2) + "\n",
  "utf8"
);

console.log(`Review package ready: ${packageDir}`);

import { spawn } from "node:child_process";
import { once } from "node:events";
import { copyFile, mkdir, readFile, rm } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { buildAudio } from "./audio-pipeline.mjs";

const productionFolder = process.argv[2] ?? "demo";
if (!/^[A-Za-z0-9._-]+$/.test(productionFolder) || productionFolder === "." || productionFolder === "..") {
  throw new Error(`Unsafe production folder: ${productionFolder}`);
}
const root = fileURLToPath(new URL("..", import.meta.url));
const host = "127.0.0.1";
const port = 4173;
const baseUrl = `http://${host}:${port}`;
const cacheRoot = resolve(root, ".render-cache");
const cacheDir = resolve(cacheRoot, productionFolder);
if (!cacheDir.startsWith(`${cacheRoot}${sep}`)) {
  throw new Error(`Render cache path escapes workspace: ${cacheDir}`);
}
const outputsDir = join(root, "outputs");
const productionPath = join(
  root,
  "productions",
  productionFolder,
  "production.json"
);
const ffmpegCommand = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
const espeakCommand = process.platform === "win32" ? "espeak-ng.exe" : "espeak-ng";

function run(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: "inherit",
      ...options
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

async function waitForServer(url, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Server is still starting.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }

  throw new Error(`Vite did not start within ${timeoutMs}ms.`);
}

function startVite() {
  return spawn(
    process.execPath,
    [join(root, "node_modules", "vite", "bin", "vite.js"), "--host", host, "--port", String(port), "--strictPort"],
    {
      cwd: root,
      stdio: ["ignore", "pipe", "pipe"]
    }
  );
}

async function ensureFfmpeg() {
  await new Promise((resolvePromise, reject) => {
    const child = spawn(ffmpegCommand, ["-version"], { stdio: "ignore" });
    child.on("error", () =>
      reject(new Error("FFmpeg is required. Install ffmpeg and ensure it is on PATH."))
    );
    child.on("exit", (code) =>
      code === 0
        ? resolvePromise()
        : reject(new Error("FFmpeg is required. Install ffmpeg and ensure it is on PATH."))
    );
  });
}

async function renderVideo(page, metadata) {
  const totalFrames = Math.ceil(metadata.duration * metadata.fps);
  const videoPath = join(cacheDir, "video-only.mp4");

  console.log(
    `Rendering ${metadata.title}: ${totalFrames} frames @ ${metadata.fps}fps (${metadata.width}x${metadata.height})`
  );

  const encoder = spawn(ffmpegCommand, [
    "-hide_banner", "-loglevel", "error", "-nostats",
    "-y",
    "-f", "image2pipe",
    "-framerate", String(metadata.fps),
    "-c:v", "png",
    "-i", "pipe:0",
    "-vf", `scale=iw*${metadata.outputScale}:ih*${metadata.outputScale}:flags=neighbor`,
    "-c:v", "libx264",
    "-preset", "medium",
    "-crf", "18",
    "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
    videoPath
  ], { cwd: root, stdio: ["pipe", "inherit", "inherit"] });
  // A closed encoder pipe can emit EPIPE before the process exit is observed.
  encoder.stdin.on("error", () => {});
  const encoded = new Promise((resolvePromise, reject) => {
    encoder.on("error", reject);
    encoder.on("exit", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`FFmpeg video encoding exited with code ${code}`));
    });
  });
  encoded.catch(() => {});

  try {
    for (let frame = 0; frame < totalFrames; frame += 1) {
      const seconds = frame / metadata.fps;

      const dataUrl = await page.evaluate(async (time) => {
        const factory = window.__ANIMATION_FACTORY__;
        if (!factory) throw new Error("Render bridge disappeared.");

        factory.renderAt(time);

        await new Promise((resolvePromise) =>
          requestAnimationFrame(() => resolvePromise())
        );
        await new Promise((resolvePromise) =>
          requestAnimationFrame(() => resolvePromise())
        );

        const canvas = document.querySelector("canvas");
        if (!(canvas instanceof HTMLCanvasElement)) {
          throw new Error("Canvas was not found.");
        }
        return canvas.toDataURL("image/png");
      }, seconds);

      const png = Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64");
      if (!encoder.stdin.write(png)) {
        await once(encoder.stdin, "drain");
      }

      if (frame === 0 || frame === totalFrames - 1 || frame % metadata.fps === 0) {
        console.log(`  frame ${frame + 1}/${totalFrames}`);
      }
    }
    encoder.stdin.end();
    await encoded;
  } catch (error) {
    encoder.kill();
    await encoded.catch(() => {});
    throw error;
  }

  return videoPath;
}

async function muxFinal({ videoPath, audioPath, outputPath, duration }) {
  if (!audioPath) {
    await copyFile(videoPath, outputPath);
    return;
  }

  await run(ffmpegCommand, [
    "-hide_banner", "-loglevel", "error", "-nostats",
    "-y",
    "-i",
    videoPath,
    "-i",
    audioPath,
    "-map",
    "0:v:0",
    "-map",
    "1:a:0",
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-t",
    String(duration),
    "-movflags",
    "+faststart",
    outputPath
  ]);
}

async function main() {
  await ensureFfmpeg();

  const production = JSON.parse(await readFile(productionPath, "utf8"));

  await rm(cacheDir, { recursive: true, force: true });
  await mkdir(cacheDir, { recursive: true });
  await mkdir(outputsDir, { recursive: true });

  const vite = startVite();
  let browser;

  vite.stdout?.on("data", (chunk) =>
    process.stdout.write(`[vite] ${chunk}`)
  );
  vite.stderr?.on("data", (chunk) =>
    process.stderr.write(`[vite] ${chunk}`)
  );

  try {
    await waitForServer(baseUrl);

    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({
      viewport: { width: 1280, height: 900 },
      deviceScaleFactor: 1
    });

    const url = new URL(baseUrl);
    url.searchParams.set("production", productionFolder);
    url.searchParams.set("render", "1");

    await page.goto(url.toString(), { waitUntil: "networkidle" });
    await page.waitForFunction(
      () => window.__ANIMATION_FACTORY__?.ready === true
    );

    const metadata = await page.evaluate(
      () => window.__ANIMATION_FACTORY__?.production
    );
    if (!metadata) {
      throw new Error("Animation Factory render bridge was not initialized.");
    }

    const videoPath = await renderVideo(page, metadata);

    const audioPath = await buildAudio({
      production,
      cacheDir,
      ffmpegCommand,
      espeakCommand
    });

    const outputPath = join(outputsDir, `${metadata.id}.mp4`);

    await muxFinal({
      videoPath,
      audioPath,
      outputPath,
      duration: metadata.duration
    });

    console.log(
      audioPath
        ? `Rendered with audio: ${outputPath}`
        : `Rendered: ${outputPath}`
    );
  } finally {
    await browser?.close();
    vite.kill();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const productionFolder = process.argv[2] ?? "demo";
const root = fileURLToPath(new URL("..", import.meta.url));
const host = "127.0.0.1";
const port = 4173;
const baseUrl = `http://${host}:${port}`;
const framesDir = join(root, ".render-cache", productionFolder, "frames");
const outputsDir = join(root, "outputs");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const ffmpegCommand = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";

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
    npmCommand,
    ["run", "dev", "--", "--host", host, "--port", String(port), "--strictPort"],
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

async function main() {
  await ensureFfmpeg();
  await rm(framesDir, { recursive: true, force: true });
  await mkdir(framesDir, { recursive: true });
  await mkdir(outputsDir, { recursive: true });

  const vite = startVite();
  let browser;

  vite.stdout?.on("data", (chunk) => process.stdout.write(`[vite] ${chunk}`));
  vite.stderr?.on("data", (chunk) => process.stderr.write(`[vite] ${chunk}`));

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
    await page.waitForFunction(() => window.__ANIMATION_FACTORY__?.ready === true);

    const metadata = await page.evaluate(() => window.__ANIMATION_FACTORY__?.production);
    if (!metadata) throw new Error("Animation Factory render bridge was not initialized.");

    const totalFrames = Math.ceil(metadata.duration * metadata.fps);
    const digits = Math.max(6, String(totalFrames).length);

    console.log(
      `Rendering ${metadata.title}: ${totalFrames} frames @ ${metadata.fps}fps (${metadata.width}x${metadata.height})`
    );

    for (let frame = 0; frame < totalFrames; frame += 1) {
      const seconds = frame / metadata.fps;

      const dataUrl = await page.evaluate(async (time) => {
        const factory = window.__ANIMATION_FACTORY__;
        if (!factory) throw new Error("Render bridge disappeared.");

        factory.renderAt(time);

        await new Promise((resolvePromise) => requestAnimationFrame(() => resolvePromise()));
        await new Promise((resolvePromise) => requestAnimationFrame(() => resolvePromise()));

        const canvas = document.querySelector("canvas");
        if (!(canvas instanceof HTMLCanvasElement)) throw new Error("Canvas was not found.");
        return canvas.toDataURL("image/png");
      }, seconds);

      const encoded = dataUrl.slice(dataUrl.indexOf(",") + 1);
      const filename = `${String(frame).padStart(digits, "0")}.png`;
      await writeFile(join(framesDir, filename), Buffer.from(encoded, "base64"));

      if (frame === 0 || frame === totalFrames - 1 || frame % metadata.fps === 0) {
        console.log(`  frame ${frame + 1}/${totalFrames}`);
      }
    }

    const outputPath = join(outputsDir, `${metadata.id}.mp4`);
    const inputPattern = join(framesDir, `%0${digits}d.png`);
    const scale = metadata.outputScale;

    await run(ffmpegCommand, [
      "-y",
      "-framerate",
      String(metadata.fps),
      "-i",
      inputPattern,
      "-vf",
      `scale=iw*${scale}:ih*${scale}:flags=neighbor`,
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-crf",
      "18",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      outputPath
    ]);

    console.log(`Rendered: ${outputPath}`);
  } finally {
    await browser?.close();
    vite.kill();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

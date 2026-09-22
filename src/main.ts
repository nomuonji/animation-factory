import Phaser from "phaser";
import "./styles.css";
import catalog from "../catalog/components.json";
import { listProductions, loadProduction } from "./core/productionRegistry";
import { FactoryScene } from "./runtime/FactoryScene";

interface FactoryBridge {
  ready: true;
  production: {
    folder: string;
    id: string;
    title: string;
    duration: number;
    fps: number;
    width: number;
    height: number;
    outputScale: number;
  };
  renderAt: (seconds: number) => void;
}

declare global {
  interface Window {
    __ANIMATION_FACTORY__?: FactoryBridge;
  }
}

const params = new URLSearchParams(window.location.search);
const requestedProduction = params.get("production") ?? "demo";
const renderMode = params.get("render") === "1";
const production = loadProduction(requestedProduction);

if (renderMode) document.body.classList.add("render-mode");

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("#app was not found.");

app.innerHTML = `
  <aside class="panel">
    <div>
      <div class="eyebrow">AGENT-NATIVE PIXEL STUDIO</div>
      <h1>Animation Factory</h1>
      <p class="muted">${production.meta.title}</p>
    </div>
    <div class="stats">
      <span>${production.canvas.width}×${production.canvas.height}</span>
      <span>${production.canvas.fps} fps</span>
      <span>${production.meta.duration}s</span>
    </div>
    <label class="production-picker">
      Production
      <select id="production-picker">
        ${listProductions()
          .map(
            (id) =>
              `<option value="${id}" ${id === requestedProduction ? "selected" : ""}>${id}</option>`
          )
          .join("")}
      </select>
    </label>
    <div class="actions">
      <button id="restart">Restart preview</button>
      <button id="record" class="secondary">Record WebM</button>
    </div>
    <section>
      <h2>Factory catalog</h2>
      <div class="catalog">
        ${catalog.components
          .map((item) => `<div><strong>${item.id}</strong><small>${item.kind}</small></div>`)
          .join("")}
      </div>
    </section>
    <p id="status" class="status">${renderMode ? "Deterministic render mode." : "Ready."}</p>
  </aside>
  <main class="preview-shell">
    <div class="phone-frame">
      <div id="stage"></div>
    </div>
  </main>
`;

let sceneRef: FactoryScene | undefined;

const scene = new FactoryScene(production, {
  deterministic: renderMode,
  onReady: (readyScene) => {
    sceneRef = readyScene;

    if (renderMode) {
      window.__ANIMATION_FACTORY__ = {
        ready: true,
        production: {
          folder: requestedProduction,
          id: production.meta.id,
          title: production.meta.title,
          duration: production.meta.duration,
          fps: production.canvas.fps,
          width: production.canvas.width,
          height: production.canvas.height,
          outputScale: production.canvas.outputScale
        },
        renderAt: (seconds: number) => readyScene.renderAt(seconds)
      };
    }
  }
});

const game = new Phaser.Game({
  type: renderMode ? Phaser.CANVAS : Phaser.AUTO,
  parent: "stage",
  width: production.canvas.width,
  height: production.canvas.height,
  backgroundColor: "#0d1120",
  pixelArt: true,
  antialias: false,
  roundPixels: true,
  scene: [scene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  }
});

const status = document.querySelector<HTMLParagraphElement>("#status");

document.querySelector<HTMLSelectElement>("#production-picker")?.addEventListener("change", (event) => {
  const next = (event.currentTarget as HTMLSelectElement).value;
  const url = new URL(window.location.href);
  url.searchParams.set("production", next);
  url.searchParams.delete("render");
  window.location.href = url.toString();
});

document.querySelector("#restart")?.addEventListener("click", () => {
  if (renderMode) {
    sceneRef?.renderAt(0);
    if (status) status.textContent = "Render frame reset to 0s.";
    return;
  }

  game.scene.getScene("factory").scene.restart();
  if (status) status.textContent = "Preview restarted.";
});

document.querySelector("#record")?.addEventListener("click", async () => {
  if (renderMode) {
    if (status) status.textContent = "WebM recording is disabled in deterministic render mode.";
    return;
  }

  if (!("MediaRecorder" in window) || !game.canvas.captureStream) {
    if (status) status.textContent = "Canvas recording is not supported in this browser.";
    return;
  }

  const button = document.querySelector<HTMLButtonElement>("#record");
  if (button) button.disabled = true;
  if (status) status.textContent = "Recording preview in real time…";

  const stream = game.canvas.captureStream(production.canvas.fps);
  const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
    ? "video/webm;codecs=vp9"
    : "video/webm";
  const recorder = new MediaRecorder(stream, { mimeType });
  const chunks: BlobPart[] = [];

  recorder.addEventListener("dataavailable", (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  });

  const stopped = new Promise<void>((resolve) =>
    recorder.addEventListener("stop", () => resolve(), { once: true })
  );

  recorder.start();
  game.scene.getScene("factory").scene.restart();

  await new Promise((resolve) =>
    window.setTimeout(resolve, production.meta.duration * 1000 + 250)
  );

  recorder.stop();
  await stopped;
  stream.getTracks().forEach((track) => track.stop());

  const blob = new Blob(chunks, { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${production.meta.id}.webm`;
  anchor.click();
  URL.revokeObjectURL(url);

  if (button) button.disabled = false;
  if (status) status.textContent = "WebM downloaded. This is a real-time preview export.";
});

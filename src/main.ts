import Phaser from "phaser";
import "./styles.css";
import productionData from "../productions/demo/production.json";
import catalog from "../catalog/components.json";
import type { Production } from "./core/types";
import { validateProduction } from "./core/validate";
import { FactoryScene } from "./runtime/FactoryScene";

validateProduction(productionData);
const production: Production = productionData;

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
    <div class="actions">
      <button id="restart">Restart preview</button>
      <button id="record" class="secondary">Record WebM</button>
    </div>
    <section>
      <h2>Factory catalog</h2>
      <div class="catalog">
        ${catalog.components.map((item) => `<div><strong>${item.id}</strong><small>${item.kind}</small></div>`).join("")}
      </div>
    </section>
    <p id="status" class="status">Ready.</p>
  </aside>
  <main class="preview-shell">
    <div class="phone-frame">
      <div id="stage"></div>
    </div>
  </main>
`;

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "stage",
  width: production.canvas.width,
  height: production.canvas.height,
  backgroundColor: "#0d1120",
  pixelArt: true,
  antialias: false,
  roundPixels: true,
  scene: [new FactoryScene(production)],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  }
});

const status = document.querySelector<HTMLParagraphElement>("#status");

document.querySelector("#restart")?.addEventListener("click", () => {
  game.scene.getScene("factory").scene.restart();
  if (status) status.textContent = "Preview restarted.";
});

document.querySelector("#record")?.addEventListener("click", async () => {
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
  await new Promise((resolve) => window.setTimeout(resolve, production.meta.duration * 1000 + 250));
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

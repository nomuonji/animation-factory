import { styleFor } from "./themes";
import { drawOverlay } from "./overlay";
import { Engine2D } from "./draw2d/engine2d";
import type { StyledTimeline } from "./types";

/**
 * Style Shorts page.
 *  - Preview: /styles.html?timeline=/outputs/styles/<id>/timeline.json  (play + scrub)
 *  - Render:  tools/styles/render-style.mjs injects window.__STYLED__ and calls __frame(t)
 */
declare global {
  interface Window {
    __STYLED__?: StyledTimeline;
    __ready?: Promise<void>;
    __frame?: (t: number) => Promise<string>;
  }
}

interface Engine { render(g: CanvasRenderingContext2D, t: number): void }

async function boot() {
  const params = new URLSearchParams(location.search);
  let tl = window.__STYLED__;
  if (!tl) {
    const url = params.get("timeline");
    if (!url) { document.body.textContent = "?timeline=/outputs/styles/<id>/timeline.json"; return; }
    tl = (await (await fetch(url)).json()) as StyledTimeline;
  }
  const st = styleFor(tl.style, tl.theme);
  await Promise.all([
    document.fonts.load(`900 40px "Noto Sans CJK JP"`),
    document.fonts.load(`900 40px "Noto Serif CJK JP"`),
    document.fonts.load(`700 40px "Noto Sans Mono CJK JP"`)
  ]).catch(() => undefined);
  const { width: W, height: H } = tl.meta;
  const out = document.createElement("canvas");
  out.width = W; out.height = H; out.id = "out";
  const g = out.getContext("2d")!;
  let engine: Engine;
  if (st.engine === "3d") {
    const { Engine3D } = await import("./three/engine3d");
    const e = new Engine3D(tl, st);
    await e.ready;
    engine = e;
  } else engine = new Engine2D(tl, st);

  const draw = (t: number) => {
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H); g.restore();
    engine.render(g, t);
    drawOverlay(g, tl!, st, t);
  };
  window.__frame = async (t: number) => { draw(t); return out.toDataURL("image/jpeg", 0.92); };

  if (!params.has("render")) {
    out.style.cssText = "height:92vh;display:block;margin:0 auto;background:#000";
    document.body.style.cssText = "margin:0;background:#111;color:#ddd;font:14px sans-serif";
    document.body.append(out);
    const bar = document.createElement("input");
    bar.type = "range"; bar.min = "0"; bar.max = String(tl.meta.duration); bar.step = "0.01"; bar.style.width = "100%";
    const label = document.createElement("div");
    document.body.append(bar, label);
    let playing = true, t0 = performance.now(), base = 0;
    bar.oninput = () => { playing = false; draw(+bar.value); label.textContent = `${(+bar.value).toFixed(2)}s`; };
    out.onclick = () => { playing = !playing; base = +bar.value; t0 = performance.now(); };
    const loop = () => {
      if (playing) { const t = (base + (performance.now() - t0) / 1000) % tl!.meta.duration; bar.value = String(t); draw(t); label.textContent = `${t.toFixed(2)}s  ${st.name}`; }
      requestAnimationFrame(loop);
    };
    loop();
  }
}

window.__ready = boot();

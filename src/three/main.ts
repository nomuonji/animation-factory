import * as THREE from "three";
import { Director3D } from "./Director3D";
import { preloadAssets } from "./assets";
import { JP_FONT } from "./toon";
import type { Timeline } from "./types";

/**
 * 3D Shorts page.
 *  - Preview:  /three.html?timeline=/outputs/three/<id>/timeline.json  (play + scrub)
 *  - Render:   the renderer injects window.__TIMELINE__ and calls __frame(t)
 */
declare global {
  interface Window {
    __TIMELINE__?: Timeline;
    __ready?: Promise<void>;
    __frame?: (t: number) => Promise<string>;
  }
}

function drawCaption(g: CanvasRenderingContext2D, tl: Timeline, t: number) {
  const W = tl.meta.width, H = tl.meta.height;
  const size = tl.captions?.size ?? Math.round(W * 0.058);
  const y = (tl.captions?.y ?? 0.735) * H;
  for (const l of tl.lines) {
    if (t < l.start - 0.02 || t > l.end + 0.25) continue;
    let chunk = l.chunks[0];
    for (const c of l.chunks) if (t >= c.start - 0.02) chunk = c;
    if (!chunk) continue;
    g.font = `900 ${size}px ${JP_FONT}`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.lineJoin = "round";
    const lines: string[] = [];
    let cur = "";
    const text = chunk.text.replace(/[、。]+$/u, "");
    for (const ch of text) { if (g.measureText(cur + ch).width > W * 0.86) { lines.push(cur); cur = ch; } else cur += ch; }
    if (cur) lines.push(cur);
    lines.forEach((txt, i) => {
      const yy = y + (i - (lines.length - 1) / 2) * size * 1.25;
      g.lineWidth = size * 0.2; g.strokeStyle = "#141216"; g.strokeText(txt, W / 2, yy);
      g.fillStyle = tl.actors[l.who]?.captionColor ?? "#ffffff"; g.fillText(txt, W / 2, yy);
    });
    break;
  }
  const tc = tl.titleCard;
  const wrap = (text: string, maxW: number) => {
    const lines: string[] = []; let cur = "";
    for (const ch of text) { if (ch === "\n") { lines.push(cur); cur = ""; } else if (g.measureText(cur + ch).width > maxW) { lines.push(cur); cur = ch; } else cur += ch; }
    if (cur) lines.push(cur);
    return lines;
  };
  if (tc && tc.style === "band" && t >= tc.start && t < tc.end) {
    const s = Math.round(W * 0.062);
    g.save(); g.font = `900 ${s}px ${JP_FONT}`; g.textAlign = "center"; g.textBaseline = "middle";
    const lines = wrap(tc.text, W * 0.84), top = H * 0.075, lh = s * 1.28, bandH = lines.length * lh + s * 0.6;
    g.fillStyle = "rgba(20,18,22,0.86)"; g.fillRect(0, top, W, bandH);
    lines.forEach((txt, i) => { g.fillStyle = "#ffffff"; g.fillText(txt, W / 2, top + s * 0.3 + lh * (i + 0.5)); });
    g.restore();
  }
  if (tc && tc.style === "card" && t >= tc.start && t < tc.end) {
    // full-frame title card: the scene darkens, the title lands with a small overshoot
    const u = Math.min(1, (t - tc.start) / 0.22);
    const k = 1 + 0.12 * (1 - u) * (1 - u) - 0.02 * Math.sin(Math.PI * u);
    g.save();
    g.fillStyle = "rgba(14,13,18,0.9)"; g.fillRect(0, 0, W, H);
    const s = Math.round(W * 0.094);
    g.translate(W / 2, H * 0.47); g.scale(k, k);
    g.font = `900 ${s}px ${JP_FONT}`; g.textAlign = "center"; g.textBaseline = "middle"; g.lineJoin = "round";
    const lines = wrap(tc.text, W * 0.86), lh = s * 1.3, h0 = -((lines.length - 1) * lh) / 2;
    if (tc.label) {
      const ls = Math.round(s * 0.42);
      g.font = `900 ${ls}px ${JP_FONT}`;
      const lw = g.measureText(tc.label).width + ls * 1.2;
      g.fillStyle = "#ffe14d"; g.beginPath(); g.roundRect(-lw / 2, h0 - lh * 0.5 - ls * 2.1, lw, ls * 1.5, ls * 0.25); g.fill();
      g.fillStyle = "#141216"; g.fillText(tc.label, 0, h0 - lh * 0.5 - ls * 1.33);
      g.font = `900 ${s}px ${JP_FONT}`;
    }
    lines.forEach((txt, i) => {
      const y = h0 + i * lh;
      g.lineWidth = s * 0.16; g.strokeStyle = "#000000"; g.strokeText(txt, 0, y);
      g.fillStyle = "#ffffff"; g.fillText(txt, 0, y);
    });
    g.fillStyle = "#ffe14d"; g.fillRect(-W * 0.3, h0 + (lines.length - 1) * lh + lh * 0.62, W * 0.6, s * 0.12);
    g.restore();
    return;
  }
  const o = tl.overlay;
  if (o && t >= o.start && t < o.end) {
    // hook text: big, top third, readable at phone size; fades out over 0.2s
    const s = Math.round(W * 0.075);
    const alpha = Math.min(1, (o.end - t) / 0.2);
    g.save(); g.globalAlpha = alpha;
    g.font = `900 ${s}px ${JP_FONT}`; g.textAlign = "center"; g.textBaseline = "middle"; g.lineJoin = "round";
    const y = H * (tl.titleCard?.style === "band" ? 0.25 : 0.155), w = g.measureText(o.text).width + s * 1.1;
    g.fillStyle = "#ffe14d"; g.beginPath(); g.roundRect(W / 2 - w / 2, y - s * 0.78, w, s * 1.56, s * 0.3); g.fill();
    g.lineWidth = s * 0.08; g.strokeStyle = "#141216"; g.stroke();
    g.fillStyle = "#141216"; g.fillText(o.text, W / 2, y + s * 0.04);
    g.restore();
  }
}

async function boot() {
  let tl = window.__TIMELINE__;
  const params = new URLSearchParams(location.search);
  if (!tl) {
    const url = params.get("timeline");
    if (!url) { document.body.textContent = "?timeline=/outputs/three/<id>/timeline.json"; return; }
    tl = (await (await fetch(url)).json()) as Timeline;
  }
  await document.fonts.load(`900 40px "Noto Sans CJK JP"`).catch(() => undefined);
  const { width: W, height: H } = tl.meta;
  const gl = document.createElement("canvas");
  gl.width = W; gl.height = H;
  const renderer = new THREE.WebGLRenderer({ canvas: gl, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const out = document.createElement("canvas");
  out.width = W; out.height = H;
  out.id = "out";
  const g = out.getContext("2d")!;
  const dir = new Director3D(tl, await preloadAssets(tl));

  const draw = (t: number) => {
    dir.update(t);
    renderer.render(dir.scene, dir.camera);
    g.drawImage(gl, 0, 0);
    drawCaption(g, tl!, t);
  };

  window.__frame = async (t: number) => {
    draw(t);
    return out.toDataURL("image/jpeg", 0.93);
  };

  if (!params.has("render")) {
    out.style.cssText = "height:92vh;display:block;margin:0 auto;background:#000";
    document.body.style.cssText = "margin:0;background:#111;color:#ddd;font:14px sans-serif";
    document.body.append(out);
    const bar = document.createElement("input");
    bar.type = "range"; bar.min = "0"; bar.max = String(tl.meta.duration); bar.step = "0.01"; bar.style.width = "100%";
    const label = document.createElement("div");
    document.body.append(bar, label);
    let playing = true, t0 = performance.now(), base = 0;
    bar.oninput = () => { playing = false; draw(+bar.value); label.textContent = `${(+bar.value).toFixed(2)}s  ${dir.shotAt(+bar.value).cam}`; };
    out.onclick = () => { playing = !playing; base = +bar.value; t0 = performance.now(); };
    const loop = () => {
      if (playing) { const t = (base + (performance.now() - t0) / 1000) % tl!.meta.duration; bar.value = String(t); draw(t); label.textContent = `${t.toFixed(2)}s  ${dir.shotAt(t).cam}`; }
      requestAnimationFrame(loop);
    };
    loop();
  }
}

window.__ready = boot();

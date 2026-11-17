import type { StyleDef } from "../themes";
import type { StyledTimeline, Visual } from "../types";
import { SCENES2D } from "./scenes";
import { ease } from "../pose";
import { clamp01, rand } from "../util";

/** Talk amount (0..1) from the narration's mora timings, for mouth flaps. */
export function talkAt(tl: StyledTimeline, t: number): number {
  for (const l of tl.lines) {
    if (t < l.start || t > l.end) continue;
    for (const [a, b] of l.moras) if (t >= a && t <= b) return Math.sin(((t - a) / (b - a || 1)) * Math.PI);
    return 0;
  }
  return 0;
}

export function sceneAt(tl: StyledTimeline, t: number): Visual | undefined {
  let cur = tl.scenes[0];
  for (const s of tl.scenes) if (t >= (s.start ?? 0)) cur = s;
  return cur;
}

export class Engine2D {
  private work: HTMLCanvasElement;
  private wg: CanvasRenderingContext2D;
  private px: number;
  private noise: CanvasPattern[] = [];
  private paper: CanvasPattern | null = null;

  constructor(private tl: StyledTimeline, private st: StyleDef) {
    const pix = st.fx.find((f) => f.startsWith("pixelate"));
    // pixelate:N is relative to a 1080-wide frame (N=4 -> 270x480 logical pixels at any output scale)
    this.px = pix ? Number(pix.split(":")[1] ?? 4) * (tl.meta.width / 1080) : 1;
    this.work = document.createElement("canvas");
    this.work.width = Math.round(tl.meta.width / this.px);
    this.work.height = Math.round(tl.meta.height / this.px);
    this.wg = this.work.getContext("2d")!;
    for (let k = 0; k < 4; k++) this.noise.push(this.makeNoise(k));
    this.paper = this.makePaper();
  }

  private makeNoise(seed: number): CanvasPattern {
    const c = document.createElement("canvas"); c.width = c.height = 256;
    const x = c.getContext("2d")!, img = x.createImageData(256, 256), r = rand(seed + 1);
    for (let i = 0; i < img.data.length; i += 4) { const v = r() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
    x.putImageData(img, 0, 0);
    return this.wg.createPattern(c, "repeat")!;
  }

  private makePaper(): CanvasPattern {
    const c = document.createElement("canvas"); c.width = c.height = 512;
    const x = c.getContext("2d")!, r = rand(42);
    x.fillStyle = "#808080"; x.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 900; i++) { x.strokeStyle = `rgba(${r() > 0.5 ? 255 : 0},${r() > 0.5 ? 255 : 0},${r() > 0.5 ? 255 : 0},0.06)`; x.lineWidth = 0.6 + r(); x.beginPath(); const a = r() * 512, b = r() * 512, ang = r() * Math.PI; x.moveTo(a, b); x.lineTo(a + Math.cos(ang) * (6 + r() * 20), b + Math.sin(ang) * (6 + r() * 20)); x.stroke(); }
    return this.wg.createPattern(c, "repeat")!;
  }

  render(out: CanvasRenderingContext2D, t: number) {
    const { tl, st, wg } = this;
    const W = this.work.width, H = this.work.height;
    const sc = sceneAt(tl, t);
    wg.save();
    wg.setTransform(1, 0, 0, 1, 0, 0);
    wg.globalCompositeOperation = "source-over"; wg.globalAlpha = 1; wg.shadowColor = "transparent";
    wg.fillStyle = st.bg; wg.fillRect(0, 0, W, H);
    if (sc) {
      const dt = t - (sc.start ?? 0);
      const first = (sc.index ?? 0) === 0;
      const tr = sc.transition ?? st.transition;
      wg.save();
      if (!first && tr === "slide" && dt < 0.32) { const e = ease.out(clamp01(dt / 0.32)); wg.translate((1 - e) * W, 0); }
      if (!first && tr === "pop" && dt < 0.25) { const e = ease.back(clamp01(dt / 0.25)); const k = 0.9 + 0.1 * e; wg.translate(W / 2, H / 2); wg.scale(k, k); wg.translate(-W / 2, -H / 2); }
      if (!first && tr === "wipe" && dt < 0.3) { wg.beginPath(); wg.arc(W / 2, H / 2, Math.hypot(W, H) * ease.out(clamp01(dt / 0.3)) * 0.6, 0, Math.PI * 2); wg.clip(); }
      (SCENES2D[sc.scene] ?? SCENES2D.card!)({ g: wg, st, tl, W, H, t, sc, talk: talkAt(tl, t) });
      wg.restore();
      if (!first && tr === "flash" && dt < 0.16) { wg.fillStyle = `rgba(255,255,255,${1 - dt / 0.16})`; wg.fillRect(0, 0, W, H); }
      if (!first && tr === "fade" && dt < 0.25) { wg.fillStyle = `rgba(0,0,0,${0.9 * (1 - dt / 0.25)})`; wg.fillRect(0, 0, W, H); }
    }
    this.fx(t, W, H);
    wg.restore();
    out.save();
    out.imageSmoothingEnabled = this.px === 1;
    out.drawImage(this.work, 0, 0, tl.meta.width, tl.meta.height);
    out.restore();
  }

  private fx(t: number, W: number, H: number) {
    const { wg, st } = this;
    const frame = Math.floor(t * 12);
    for (const f of st.fx) {
      if (f === "grain" || f === "grain-light") { wg.save(); wg.globalAlpha = f === "grain" ? 0.08 : 0.05; wg.globalCompositeOperation = "overlay"; wg.fillStyle = this.noise[frame % 4]!; wg.fillRect(0, 0, W, H); wg.restore(); }
      if (f === "paper") { wg.save(); wg.globalCompositeOperation = "overlay"; wg.globalAlpha = 0.5; wg.fillStyle = this.paper!; wg.fillRect(0, 0, W, H); wg.globalAlpha = 0.05; wg.fillStyle = this.noise[0]!; wg.fillRect(0, 0, W, H); wg.restore(); }
      if (f === "riso") {
        // misregistration: a faint offset copy, then coarse ink grain
        wg.save(); wg.globalCompositeOperation = "multiply"; wg.globalAlpha = 0.22;
        wg.drawImage(this.work, W * 0.004, -W * 0.003); wg.restore();
        wg.save(); wg.globalCompositeOperation = "screen"; wg.globalAlpha = 0.12; wg.fillStyle = this.noise[frame % 4]!; wg.scale(1.6, 1.6); wg.fillRect(0, 0, W, H); wg.restore();
        wg.save(); wg.globalCompositeOperation = "multiply"; wg.globalAlpha = 0.1; wg.fillStyle = this.noise[(frame + 2) % 4]!; wg.fillRect(0, 0, W, H); wg.restore();
      }
      if (f === "scanlines") { wg.save(); wg.fillStyle = "rgba(0,0,0,0.12)"; for (let y = 0; y < H; y += 4) wg.fillRect(0, y, W, 2); wg.restore(); }
      if (f === "speedlines") {
        wg.save(); wg.translate(W / 2, H * 0.42); wg.strokeStyle = "rgba(255,255,255,0.16)";
        const r = rand(frame % 6 + 3);
        for (let i = 0; i < 40; i++) { const a = r() * Math.PI * 2, r0 = W * (0.45 + r() * 0.2); wg.lineWidth = 1 + r() * 4; wg.beginPath(); wg.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); wg.lineTo(Math.cos(a) * H, Math.sin(a) * H); wg.stroke(); }
        wg.restore();
      }
      if (f === "aberration") { wg.save(); wg.globalCompositeOperation = "lighter"; wg.globalAlpha = 0.07; wg.drawImage(this.work, W * 0.003, 0); wg.restore(); }
      if (f === "panel") { wg.save(); const m = W * 0.03; wg.lineWidth = W * 0.012; wg.strokeStyle = st.ink; wg.strokeRect(m, m, W - m * 2, H - m * 2); wg.strokeStyle = "#ffffff"; wg.lineWidth = m * 1.2; wg.strokeRect(0, 0, W, H); wg.restore(); }
      if (f === "vignette") { const gr = wg.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75); gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(0,0,0,0.45)"); wg.fillStyle = gr; wg.fillRect(0, 0, W, H); }
    }
  }
}

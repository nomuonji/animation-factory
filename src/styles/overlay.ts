import type { StyleDef } from "./themes";
import type { StyledTimeline } from "./types";
import { clamp01, wrapText } from "./util";

/** Captions, title card, hook text and corner chip — drawn on top of every style, in the style's own type. */
export function drawOverlay(g: CanvasRenderingContext2D, tl: StyledTimeline, st: StyleDef, t: number) {
  const W = tl.meta.width, H = tl.meta.height;
  const tc = tl.titleCard;
  if (tc && tc.style === "card" && t >= tc.start && t < tc.end) { titleCard(g, W, H, st, tc.text, tc.label, t - tc.start); return; }
  if (!tl.captions?.off) captions(g, tl, st, t, W, H);
  if (tc && tc.style === "band" && t >= tc.start && t < tc.end) band(g, W, H, st, tc.text);
  const o = tl.overlay;
  if (o && t >= o.start && t < o.end) hook(g, W, H, st, o.text, Math.min(1, (o.end - t) / 0.2), t - o.start, tc?.style === "band");
  const sc = tl.scenes.find((s) => t >= (s.start ?? 0) && t < (s.end ?? 0));
  if (sc?.chip) chip(g, W, H, st, sc.chip);
}

function font(st: StyleDef, size: number, c = st.caption) {
  return `${c.italic ? "italic " : ""}${c.weight ?? st.weight} ${Math.round(size)}px ${c.font ?? st.font}`;
}

function captions(g: CanvasRenderingContext2D, tl: StyledTimeline, st: StyleDef, t: number, W: number, H: number) {
  const c = st.caption;
  const size = (tl.captions?.size ?? c.size) * W;
  const y0 = (tl.captions?.y ?? c.y) * H;
  for (const l of tl.lines) {
    if (t < l.start - 0.02 || t > l.end + 0.25) continue;
    let chunk = l.chunks[0];
    for (const ch of l.chunks) if (t >= ch.start - 0.02) chunk = ch;
    if (!chunk) continue;
    const text = chunk.text.replace(/[、。]+$/u, "");
    g.save();
    g.font = font(st, size);
    g.textAlign = "center"; g.textBaseline = "middle"; g.lineJoin = "round";
    const lines = wrapText(g, text, W * (c.kind === "plain" ? 0.84 : 0.8));
    const lh = size * 1.28;
    const pop = 1 + 0.07 * (1 - clamp01((t - chunk.start) / 0.09));
    g.translate(W / 2, y0); g.scale(pop, pop);
    const widest = Math.max(...lines.map((s) => g.measureText(s).width));
    const top = -((lines.length - 1) * lh) / 2;
    if (c.kind === "box" || c.kind === "pill" || c.kind === "tag") {
      const padX = size * 0.55, padY = size * 0.32;
      g.fillStyle = c.box ?? "#000";
      g.beginPath();
      g.roundRect(-widest / 2 - padX, top - lh / 2 - padY + size * 0.1, widest + padX * 2, lines.length * lh + padY * 2 - size * 0.2, c.kind === "box" ? size * 0.12 : size * 0.5);
      g.fill();
      if (c.kind === "box" && c.stroke) { g.lineWidth = size * 0.06; g.strokeStyle = c.stroke; g.stroke(); }
    }
    lines.forEach((s, i) => {
      const y = top + i * lh;
      if (c.kind === "stroke") { g.lineWidth = size * 0.22; g.strokeStyle = c.stroke ?? "#000"; g.strokeText(s, 0, y); }
      // plain captions get a thin halo in the opposite tone, so they survive any background (dark sets in light styles, 3D)
      if (c.kind === "plain") { g.lineWidth = size * 0.16; g.strokeStyle = isLight(c.fill) ? "rgba(0,0,0,0.85)" : "rgba(255,255,255,0.92)"; g.strokeText(s, 0, y); }
      g.fillStyle = c.fill; g.fillText(s, 0, y);
      g.shadowBlur = 0;
    });
    g.restore();
    break;
  }
}

function titleCard(g: CanvasRenderingContext2D, W: number, H: number, st: StyleDef, text: string, label: string | undefined, dt: number) {
  const u = clamp01(dt / 0.25);
  const k = 1 + 0.14 * (1 - u) * (1 - u);
  g.save();
  g.fillStyle = st.engine === "3d" ? "rgba(10,10,14,0.82)" : st.bg;
  g.fillRect(0, 0, W, H);
  const s = W * 0.095;
  g.translate(W / 2, H * 0.46); g.scale(k, k);
  g.font = `${st.weight} ${Math.round(s)}px ${st.font}`;
  g.textAlign = "center"; g.textBaseline = "middle"; g.lineJoin = "round";
  const lines = wrapText(g, text, W * 0.84), lh = s * 1.28, h0 = -((lines.length - 1) * lh) / 2;
  const light = isLight(st.engine === "3d" ? "#111111" : st.bg);
  const ink = light ? st.ink : "#ffffff";
  if (label) {
    const ls = s * 0.4;
    g.font = `${st.weight} ${Math.round(ls)}px ${st.font}`;
    const lw = g.measureText(label).width + ls * 1.2;
    g.fillStyle = st.accent; g.beginPath(); g.roundRect(-lw / 2, h0 - lh * 0.5 - ls * 2.1, lw, ls * 1.5, ls * 0.25); g.fill();
    g.fillStyle = isLight(st.accent) ? "#111" : "#fff"; g.fillText(label, 0, h0 - lh * 0.5 - ls * 1.33);
    g.font = `${st.weight} ${Math.round(s)}px ${st.font}`;
  }
  lines.forEach((txt, i) => {
    const y = h0 + i * lh;
    if (!light) { g.lineWidth = s * 0.14; g.strokeStyle = "#000"; g.strokeText(txt, 0, y); }
    g.fillStyle = ink; g.fillText(txt, 0, y);
  });
  g.fillStyle = st.accent2 === st.bg ? st.accent : st.accent2;
  g.fillRect(-W * 0.28 * u, h0 + (lines.length - 1) * lh + lh * 0.62, W * 0.56 * u, s * 0.1);
  g.restore();
}

function band(g: CanvasRenderingContext2D, W: number, H: number, st: StyleDef, text: string) {
  const s = W * 0.056;
  g.save(); g.font = `${st.weight} ${Math.round(s)}px ${st.font}`; g.textAlign = "center"; g.textBaseline = "middle";
  const lines = wrapText(g, text, W * 0.84), top = H * 0.06, lh = s * 1.25, bh = lines.length * lh + s * 0.6;
  g.fillStyle = "rgba(15,15,20,0.82)"; g.fillRect(0, top, W, bh);
  lines.forEach((txt, i) => { g.fillStyle = "#fff"; g.fillText(txt, W / 2, top + s * 0.3 + lh * (i + 0.5)); });
  g.restore();
}

function hook(g: CanvasRenderingContext2D, W: number, H: number, st: StyleDef, text: string, alpha: number, dt: number, belowBand: boolean) {
  const s = W * 0.068;
  const u = clamp01(dt / 0.2);
  g.save(); g.globalAlpha = alpha;
  g.font = `${st.weight} ${Math.round(s)}px ${st.font}`; g.textAlign = "center"; g.textBaseline = "middle";
  const lines = wrapText(g, text, W * 0.82), lh = s * 1.25;
  const y = H * (belowBand ? 0.24 : 0.14);
  const w = Math.max(...lines.map((l) => g.measureText(l).width)) + s * 1.1, h = lines.length * lh + s * 0.5;
  g.translate(W / 2, y); g.scale(0.85 + 0.15 * u, 0.85 + 0.15 * u); g.rotate(-0.02);
  g.fillStyle = st.accent; g.beginPath(); g.roundRect(-w / 2, -h / 2, w, h, s * 0.3); g.fill();
  g.lineWidth = s * 0.08; g.strokeStyle = st.ink; g.stroke();
  g.fillStyle = isLight(st.accent) ? "#141216" : "#ffffff";
  lines.forEach((l, i) => g.fillText(l, 0, -((lines.length - 1) * lh) / 2 + i * lh + s * 0.04));
  g.restore();
}

function chip(g: CanvasRenderingContext2D, W: number, H: number, st: StyleDef, text: string) {
  const s = W * 0.032;
  g.save(); g.font = `800 ${Math.round(s)}px ${st.font}`; g.textBaseline = "middle";
  const w = g.measureText(text).width + s * 1.2;
  g.fillStyle = st.engine === "3d" || !isLight(st.bg) ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.85)";
  g.beginPath(); g.roundRect(W * 0.05, H * 0.035, w, s * 1.8, s * 0.4); g.fill();
  g.fillStyle = st.engine === "3d" || !isLight(st.bg) ? "#fff" : st.ink; g.fillText(text, W * 0.05 + s * 0.6, H * 0.035 + s * 0.92);
  g.restore();
}

export function isLight(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return false;
  const n = parseInt(m[1]!, 16);
  const r = n >> 16, gg = (n >> 8) & 255, b = n & 255;
  return 0.299 * r + 0.587 * gg + 0.114 * b > 150;
}

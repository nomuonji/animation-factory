import { mapSet, type StyleDef } from "../themes";
import type { StyledTimeline, Visual, ActorSpec } from "../types";
import { drawIcon } from "../icons";
import { drawSet, DARK_SETS } from "./sets";
import { drawFigure, halftone, type FigureState } from "./figures";
import { mixPose, poseAt, ease } from "../pose";
import { atTime, clamp01, fmt, hash, lerp, span, timed, wrapText } from "../util";
import { isLight } from "../overlay";
import { figure as inspectFigure } from "../inspect";

export interface Ctx {
  g: CanvasRenderingContext2D;
  st: StyleDef;
  tl: StyledTimeline;
  W: number;
  H: number;
  t: number;
  sc: Visual;
  /** 0..1 mouth opening from the narration at t */
  talk: number;
  /** 3D styles: the backdrop is already drawn; scenes skip their own background */
  noBg?: boolean;
}

/** secondary text (axis labels, sources, small captions) that still passes 4.5:1 */
export const muted = (st: StyleDef) => (isLight(st.bg) ? "#555555" : "#bdbdbd");
/** use `c` for big text only when it stands out from the background, else the main ink */
function strong(st: StyleDef, c: string) {
  const L = (h: string) => { const m = /^#?([0-9a-f]{6})$/i.exec(h); if (!m) return 0.5; const n = parseInt(m[1]!, 16); const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(n >> 16) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255); };
  const a = L(c), b = L(st.bg); const r = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  return r >= 3.6 ? c : fg(st);
}
export const fg = (st: StyleDef) => (isLight(st.bg) ? st.ink : st.figure === "line" ? st.ink : st.paper);
/** top of the content area: while the hook text is on screen (top ~0.10-0.19), titles move below it */
const top0 = (c: Ctx, frac: number) => {
  const o = c.tl.overlay;
  return (o && c.t >= o.start && c.t < o.end ? Math.max(frac, 0.23) : frac) * c.H;
};
/** lowest y (px) content may use above the captions */
const zone = (st: StyleDef, H: number) => Math.min(0.74, st.caption.y - 0.08) * H;
const font = (st: StyleDef, px: number, w = st.weight) => `${w} ${Math.round(px)}px ${st.font}`;

function fitFont(g: CanvasRenderingContext2D, st: StyleDef, text: string, maxW: number, px: number, min: number) {
  let s = px;
  g.font = font(st, s);
  while (s > min && Math.max(...text.split("\n").map((l) => g.measureText(l).width)) > maxW) { s *= 0.93; g.font = font(st, s); }
  return s;
}

// ---------------------------------------------------------------- stage
export function stage(c: Ctx) {
  const { g, st, W, H, t, sc } = c;
  const gy = H * Number(sc.setParams?.ground ?? 0.6);
  const fh = H * 0.25;
  const cam = sc.camera ?? {};
  const k = span(t, sc, "start", "end");
  const zoom = lerp(cam.zoom ?? 1, cam.to?.zoom ?? cam.zoom ?? 1, ease.inOut(k));
  const cx = lerp(cam.x ?? 0, cam.to?.x ?? cam.x ?? 0, ease.inOut(k)) * W * 0.38;
  const cy = lerp(cam.y ?? 0, cam.to?.y ?? cam.y ?? 0, ease.inOut(k)) * fh;
  const shake = (cam.shake ?? 0) * W * 0.012;
  g.save();
  g.translate(W / 2 + Math.sin(t * 53) * shake, gy - fh * 0.5 + Math.cos(t * 41) * shake);
  g.scale(zoom, zoom);
  g.translate(-W / 2 - cx, -(gy - fh * 0.5) + cy);
  const setName = mapSet(st, sc.set);
  drawSet(g, st, setName, W, H, gy, t, sc.setParams ?? {});
  const layerShadow = st.fx.includes("shadow");
  if (layerShadow) { g.shadowColor = "rgba(20,10,40,0.35)"; g.shadowBlur = W * 0.018; g.shadowOffsetX = W * 0.006; g.shadowOffsetY = W * 0.01; }
  if (st.id === "risograph") g.globalCompositeOperation = "multiply";
  for (const p of sc.props ?? []) {
    const appear = p.at !== undefined ? atTime(p.at, sc) : -1;
    if (t < appear) continue;
    const pop = appear >= 0 ? ease.back(clamp01((t - appear) / 0.3)) : 1;
    const m = span(t, sc, p.to?.at, p.to?.until);
    const px = lerp(p.x ?? 0, p.to?.x ?? p.x ?? 0, ease.inOut(m));
    const py = lerp(p.y ?? 0, p.to?.y ?? p.y ?? 0, ease.inOut(m));
    const ps = lerp(p.scale ?? 1, p.to?.scale ?? p.scale ?? 1, ease.inOut(m)) * pop;
    const rot = lerp(p.rot ?? 0, p.to?.rot ?? p.rot ?? 0, ease.inOut(m));
    const size = fh * 0.5 * ps;
    const x = W / 2 + px * W * 0.38, y = gy - py * fh - size / 2;
    if (p.kind === "rocket" && (p.to?.y ?? 0) !== (p.y ?? 0)) {
      // exhaust flame while flying
      const fl = 0.7 + 0.3 * Math.sin(t * 40);
      drawIcon(g, "fire", x, y + size * 0.62, size * 0.45 * fl, { ink: st.ink, line: 0.05 }, Math.PI);
    }
    drawIcon(g, p.kind, x, y, size, { ink: st.figure === "line" ? st.ink : st.ink, fill: st.paper, accent: st.accent, line: Math.max(0.03, (st.stroke * W) / size) }, rot);
    if (p.label) label(g, st, p.label, x, y - size * 0.7, W * 0.034);
  }
  const actors = [...(sc.actors ?? [])].sort((a, b) => (a.z ?? 0) - (b.z ?? 0));
  for (const a of actors) actor(c, a, gy, fh);
  g.restore();
}

function actor(c: Ctx, a: ActorSpec, gy: number, fh: number) {
  const { g, st, W, t, sc } = c;
  const m = span(t, sc, a.to?.at, a.to?.until);
  const x0 = a.x0 ?? a.x ?? 0, y0 = a.y0 ?? a.y ?? 0;
  const ax = a.to?.x !== undefined ? lerp(x0, a.to.x, ease.inOut(m)) : (a.x ?? x0);
  const ay = a.to?.y !== undefined ? lerp(y0, a.to.y, ease.inOut(m)) : (a.y ?? y0);
  const P = timed(a.pose, t, sc, "idle");
  const blend = clamp01((t - P.since) / 0.2);
  const pose = blend < 1 ? mixPose(poseAt(P.prev, t), poseAt(P.cur, t), ease.inOut(blend)) : poseAt(P.cur, t);
  const F = timed(a.face, t, sc, "neutral");
  const E = timed(a.emote, t, sc, "");
  const scale = a.scale ?? 1;
  const moving = a.to?.x !== undefined && m > 0 && m < 1 ? Math.sign(a.to.x - x0) : 0;
  const pal = st.palette;
  const seed = hash(a.id);
  const f: FigureState = {
    pose, face: F.cur, talk: a.talks ? c.talk : 0,
    facing: moving || a.facing || 1,
    color: a.color ?? (st.figure === "stick" ? "" : pal[Math.floor(seed * pal.length)] ?? st.accent),
    accent: a.accent ?? st.accent2, skin: "#ffd9b8", hair: a.hair ?? (st.figure === "stick" ? "none" : "spiky"),
    holds: a.holds, emote: E.cur || undefined, emoteAge: t - E.since, t, seed
  };
  if (st.figure === "line" || st.figure === "pictogram") f.face = "none";
  const x = W / 2 + ax * W * 0.38, y = gy - ay * fh;
  const dark = DARK_SETS.has(mapSet(st, sc.set)) && !isLight(st.bg === "#000000" ? "#000000" : st.ink) && ["stick", "pictogram"].includes(st.figure);
  const fst = dark ? { ...st, ink: "#f4f4f4" } : st;
  // contact shadow
  if (st.figure !== "line" && ay < 0.05) { g.save(); g.shadowColor = "transparent"; g.fillStyle = "rgba(0,0,0,0.18)"; g.beginPath(); g.ellipse(x, gy + fh * 0.01, fh * 0.16 * scale, fh * 0.025, 0, 0, Math.PI * 2); g.fill(); g.restore(); }
  drawFigure(g, fst, f, x, y, fh * scale);
  inspectFigure(g, a.id, x - fh * 0.24 * scale, y - fh * 1.22 * scale - pose.lift * fh, x + fh * 0.24 * scale, y);
}

function label(g: CanvasRenderingContext2D, st: StyleDef, text: string, x: number, y: number, s: number) {
  g.save(); g.shadowColor = "transparent"; g.font = font(st, s, 800); g.textAlign = "center"; g.textBaseline = "middle";
  const w = g.measureText(text).width + s * 1.1;
  g.fillStyle = isLight(st.bg) ? st.ink : st.paper; g.beginPath(); g.roundRect(x - w / 2, y - s * 0.8, w, s * 1.6, s * 0.8); g.fill();
  g.fillStyle = isLight(st.bg) ? "#fff" : st.ink; g.fillText(text, x, y + s * 0.05);
  g.restore();
}

// ---------------------------------------------------------------- chart
export function chart(c: Ctx) {
  const { g, st, W, H, t, sc } = c;
  if (!c.noBg) drawSet(g, st, "plain", W, H, H, t);
  const ink = fg(st);
  const left = W * 0.1, right = W * 0.8, top = H * 0.32, bottom = zone(st, H) - W * 0.16;
  const u = ease.inOut(span(t, sc, "line", "lineEnd-0.3"));
  g.font = font(st, W * 0.036, 700); g.fillStyle = muted(st);
  if (sc.label) { g.textAlign = "left"; g.fillText(sc.label, left, top0(c, 0.2)); }
  if (sc.type === "bar" && sc.bars?.length) {
    const n = sc.bars.length, max = Math.max(...sc.bars.map((b) => b.value)) || 1, bw = (right - left) / n * 0.62;
    sc.bars.forEach((b, i) => {
      const k = ease.out(clamp01(u * (n + 1) - i * 0.8));
      const x = left + ((right - left) / n) * (i + 0.5);
      const h = (bottom - top) * (b.value / max) * k;
      g.fillStyle = b.color ?? (i === n - 1 ? st.accent2 : st.ink === "#ffffff" ? "#bbb" : ink);
      g.fillRect(x - bw / 2, bottom - h, bw, h);
      g.fillStyle = ink; g.textAlign = "center"; g.font = font(st, W * 0.042);
      if (k > 0.05) g.fillText(fmt(b.value * k, sc.format) + (sc.unit ?? ""), x, bottom - h - W * 0.025);
      g.font = font(st, W * 0.032, 600); g.fillText(b.label, x, bottom + W * 0.05);
      if (b.icon) drawIcon(g, b.icon, x, bottom + W * 0.12, W * 0.07, { ink, line: 0.05 });
    });
    return;
  }
  const pts = sc.points ?? [];
  if (pts.length < 2) return;
  const ys = pts.map((p) => p[1]);
  const lo = Math.min(...ys) * (Math.min(...ys) > 0 ? 0.92 : 1), hi = Math.max(...ys) * 1.03;
  const X = (i: number) => left + ((right - left) * i) / (pts.length - 1);
  const Y = (v: number) => bottom - ((v - lo) / (hi - lo || 1)) * (bottom - top);
  g.strokeStyle = "rgba(128,128,128,0.25)"; g.lineWidth = 2;
  for (let i = 0; i <= 4; i++) { const y = top + ((bottom - top) * i) / 4; g.beginPath(); g.moveTo(left, y); g.lineTo(right, y); g.stroke(); }
  g.fillStyle = muted(st); g.font = font(st, W * 0.034, 600); g.textAlign = "center";
  const every = Math.max(1, Math.round(pts.length / 6));
  pts.forEach((p, i) => { if (i % every === 0 || i === pts.length - 1) g.fillText(String(p[0]), X(i), bottom + W * 0.045); });
  const head = u * (pts.length - 1);
  const hi0 = Math.floor(head), frac = head - hi0;
  g.beginPath(); g.moveTo(X(0), Y(pts[0]![1]));
  for (let i = 1; i <= hi0; i++) g.lineTo(X(i), Y(pts[i]![1]));
  const cur = hi0 < pts.length - 1 ? lerp(pts[hi0]![1], pts[hi0 + 1]![1], frac) : pts[pts.length - 1]![1];
  const hx = hi0 < pts.length - 1 ? lerp(X(hi0), X(hi0 + 1), frac) : X(pts.length - 1);
  g.lineTo(hx, Y(cur));
  g.strokeStyle = ink; g.lineWidth = W * 0.006; g.lineJoin = "round"; g.stroke();
  g.beginPath(); g.arc(hx, Y(cur), W * 0.012, 0, Math.PI * 2); g.fillStyle = st.bg; g.fill(); g.lineWidth = W * 0.004; g.stroke();
  g.beginPath(); g.arc(hx, Y(cur), W * 0.022 + W * 0.006 * Math.sin(t * 6), 0, Math.PI * 2); g.strokeStyle = "rgba(128,128,128,0.4)"; g.stroke();
  g.fillStyle = ink; g.textAlign = "left"; g.font = font(st, W * 0.1, 800);
  g.fillText(fmt(cur, sc.format) + (sc.unit ?? ""), left, H * 0.28);
}

// ---------------------------------------------------------------- counter
export function counter(c: Ctx) {
  const { g, st, W, H, t, sc } = c;
  if (!c.noBg) drawSet(g, st, "plain", W, H, H, t);
  const ink = fg(st);
  const u = ease.out(span(t, sc, "line", "lineEnd-0.2"));
  const v = lerp(sc.from ?? 0, sc.to ?? 0, u);
  const appear = ease.back(clamp01((t - (sc.start ?? 0)) / 0.3));
  g.save(); g.translate(W / 2, H * 0.38); g.scale(appear, appear);
  if (sc.icon) drawIcon(g, sc.icon, 0, -H * 0.13, W * 0.2, { ink: st.ink, fill: st.paper, accent: st.accent, line: 0.04 }, Math.sin(t * 2) * 0.05);
  const text = fmt(v, sc.format) + (sc.unit ?? "");
  const s = fitFont(g, st, text, W * 0.86, W * 0.16, W * 0.06);
  g.textAlign = "center"; g.textBaseline = "middle";
  if (st.id === "comic") { g.lineWidth = s * 0.16; g.strokeStyle = st.ink; g.strokeText(text, 0, 0); g.fillStyle = "#fff"; }
  else g.fillStyle = strong(st, st.id === "pixel-art" || st.id === "retro-anime" ? st.accent : st.accent2);
  g.fillText(text, 0, 0);
  if (sc.label) { g.font = font(st, W * 0.05, 700); g.fillStyle = ink; g.fillText(sc.label, 0, s * 0.95); }
  g.restore();
}

// ---------------------------------------------------------------- card
export function card(c: Ctx) {
  const { g, st, W, H, t, sc } = c;
  if (!c.noBg) drawSet(g, st, "plain", W, H, H, t);
  const ink = fg(st);
  const age = t - (sc.start ?? 0);
  const k = ease.back(clamp01(age / 0.32));
  g.save(); g.translate(W / 2, H * 0.36);
  if (st.id === "comic") { g.save(); g.rotate(-0.06); burstShape(g, W * 0.42 * k, W * 0.32 * k); g.fillStyle = "#fff"; g.fill(); g.lineWidth = W * 0.012; g.strokeStyle = st.ink; g.stroke(); g.restore(); }
  if (st.id === "paper-presenter") {
    g.fillStyle = st.accent; g.fillRect(-W * 0.42, -H * 0.17, W * 0.84 * k, H * 0.008);
  }
  if (sc.icon) drawIcon(g, sc.icon, 0, -H * 0.11 + Math.sin(t * 2.2) * H * 0.006, W * 0.22 * k, { ink: st.ink, fill: st.paper, accent: st.accent, line: 0.04 });
  g.scale(k, k);
  const text = sc.text ?? "";
  const s = fitFont(g, st, text, W * 0.84, W * 0.13, W * 0.05);
  g.textAlign = "center"; g.textBaseline = "middle";
  const lines = text.split("\n"), lh = s * 1.15;
  lines.forEach((l, i) => {
    const y = (i - (lines.length - 1) / 2) * lh + (sc.icon ? H * 0.03 : 0);
    if (st.id === "comic" || st.id === "retro-anime") { g.lineWidth = s * 0.14; g.strokeStyle = st.ink; g.strokeText(l, 0, y); g.fillStyle = st.id === "comic" ? st.accent : st.accent2; }
    else g.fillStyle = st.id === "paper-presenter" ? st.accent : ink;
    g.fillText(l, 0, y);
  });
  if (sc.sub) {
    g.font = font(st, W * 0.045, 700); g.fillStyle = ink;
    wrapText(g, sc.sub, W * 0.8).forEach((l, i) => g.fillText(l, 0, (lines.length * lh) / 2 + (sc.icon ? H * 0.03 : 0) + W * 0.06 + i * W * 0.058));
  }
  g.restore();
}

function burstShape(g: CanvasRenderingContext2D, rx: number, ry: number) {
  g.beginPath();
  for (let i = 0; i < 22; i++) { const a = (i / 22) * Math.PI * 2, r = i % 2 ? 0.72 : 1; g.lineTo(Math.cos(a) * rx * r, Math.sin(a) * ry * r); }
  g.closePath();
}

// ---------------------------------------------------------------- list
export function list(c: Ctx) {
  const { g, st, W, H, t, sc } = c;
  if (!c.noBg) drawSet(g, st, "plain", W, H, H, t);
  const ink = fg(st);
  const items = sc.items ?? [];
  const a = atTime("line", sc), b = atTime("lineEnd-0.3", sc);
  g.textBaseline = "middle";
  if (sc.title) { g.font = font(st, W * 0.07); g.fillStyle = st.id === "paper-presenter" ? st.accent : ink; g.textAlign = "center"; g.fillText(sc.title, W / 2, top0(c, 0.14)); }
  const top = top0(c, 0.14) + H * 0.1, step = Math.min(H * 0.1, (zone(st, H) - top) / Math.max(1, items.length));
  items.forEach((it, i) => {
    const at = a + ((b - a) * i) / Math.max(1, items.length);
    const k = ease.back(clamp01((t - at) / 0.28));
    if (k <= 0) return;
    const text = typeof it === "string" ? it : it.text, icon = typeof it === "string" ? undefined : it.icon;
    const y = top + i * step;
    g.save(); g.translate(W * 0.1 + (1 - k) * W * 0.1, y); g.globalAlpha = clamp01(k);
    if (icon) drawIcon(g, icon, W * 0.04, 0, step * 0.6, { ink: st.ink, fill: st.paper, accent: st.accent, line: 0.05 });
    else { g.fillStyle = st.accent; g.beginPath(); g.arc(W * 0.04, 0, step * 0.26, 0, Math.PI * 2); g.fill(); g.fillStyle = isLight(st.accent) ? "#111" : "#fff"; g.font = font(st, step * 0.34); g.textAlign = "center"; g.fillText(String(i + 1), W * 0.04, step * 0.02); }
    g.textAlign = "left"; g.fillStyle = ink; g.font = font(st, Math.min(W * 0.055, step * 0.5), 800);
    g.fillText(text, W * 0.12, 0);
    g.restore();
  });
}

// ---------------------------------------------------------------- diagram
export function diagram(c: Ctx) {
  const { g, st, W, H, t, sc } = c;
  if (!c.noBg) drawSet(g, st, "plain", W, H, H, t);
  const ink = fg(st);
  const nodes = sc.nodes ?? [];
  const a = atTime("start+0.1", sc), b = atTime("lineEnd-0.4", sc);
  const appear = new Map<string, number>();
  nodes.forEach((n, i) => appear.set(n.id, n.at !== undefined ? atTime(n.at, sc) : a + ((b - a) * i) / Math.max(1, nodes.length)));
  const zc = (H * 0.16 + zone(st, H)) / 2, zs = (zone(st, H) - H * 0.16) / 2 - W * 0.12;
  const pos = (n: { x: number; y: number }) => [W / 2 + n.x * W * 0.36, zc + n.y * zs] as const;
  if (sc.title) { g.font = font(st, W * 0.06); g.fillStyle = ink; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(sc.title, W / 2, top0(c, 0.1)); }
  for (const e of sc.edges ?? []) {
    const na = nodes.find((n) => n.id === e.from), nb = nodes.find((n) => n.id === e.to);
    if (!na || !nb) continue;
    const start = e.at !== undefined ? atTime(e.at, sc) : Math.max(appear.get(na.id)!, appear.get(nb.id)!) + 0.15;
    const k = ease.inOut(clamp01((t - start) / 0.45));
    if (k <= 0) continue;
    const [x1, y1] = pos(na), [x2, y2] = pos(nb);
    const d = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / d, uy = (y2 - y1) / d, r = W * 0.1;
    const sx = x1 + ux * r, sy = y1 + uy * r, ex = x2 - ux * r, ey = y2 - uy * r;
    const hx = lerp(sx, ex, k), hy = lerp(sy, ey, k);
    g.strokeStyle = st.accent; g.lineWidth = W * 0.008; g.setLineDash([W * 0.02, W * 0.014]); g.lineDashOffset = -t * W * 0.06;
    g.beginPath(); g.moveTo(sx, sy); g.lineTo(hx, hy); g.stroke(); g.setLineDash([]);
    if (k > 0.95) { g.fillStyle = st.accent; g.beginPath(); g.moveTo(ex, ey); g.lineTo(ex - ux * W * 0.035 - uy * W * 0.022, ey - uy * W * 0.035 + ux * W * 0.022); g.lineTo(ex - ux * W * 0.035 + uy * W * 0.022, ey - uy * W * 0.035 - ux * W * 0.022); g.closePath(); g.fill(); }
    if (e.label && k > 0.6) { const mx = (sx + ex) / 2, my = (sy + ey) / 2; g.font = font(st, W * 0.036, 800); const w = g.measureText(e.label).width + W * 0.03; g.fillStyle = st.bg; g.fillRect(mx - w / 2, my - W * 0.025, w, W * 0.05); g.fillStyle = ink; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(e.label, mx, my); }
  }
  for (const n of nodes) {
    const k = ease.back(clamp01((t - appear.get(n.id)!) / 0.32));
    if (k <= 0) continue;
    const [x, y] = pos(n);
    g.save(); g.translate(x, y); g.scale(k, k);
    g.fillStyle = st.paper; g.beginPath(); g.arc(0, 0, W * 0.09, 0, Math.PI * 2); g.fill();
    g.lineWidth = W * 0.006; g.strokeStyle = n.color ?? ink; g.stroke();
    drawIcon(g, n.icon ?? "question", 0, 0, W * 0.1, { ink: st.ink, fill: st.paper, accent: n.color ?? st.accent, line: 0.05 });
    if (n.label) { g.font = font(st, W * 0.034, 800); g.textAlign = "center"; g.textBaseline = "middle"; const w = g.measureText(n.label).width + W * 0.04; g.fillStyle = ink; g.beginPath(); g.roundRect(-w / 2, W * 0.11, w, W * 0.058, W * 0.029); g.fill(); g.fillStyle = isLight(ink) ? "#111" : "#fff"; g.fillText(n.label, 0, W * 0.14); }
    g.restore();
  }
}

// ---------------------------------------------------------------- path (minimal line)
export function path(c: Ctx) {
  const { g, st, W, H, t, sc } = c;
  if (!c.noBg) drawSet(g, st, "void", W, H, H, t);
  const u = ease.inOut(span(t, sc, "start+0.1", "end-0.2"));
  const N = 240, pts: [number, number][] = [];
  const shape = sc.shape ?? "wander";
  for (let i = 0; i <= N; i++) {
    const s = i / N;
    let x = 0, y = 0;
    if (shape === "spiral") { const a = s * Math.PI * 7, r = (1 - s) * 0.32; x = 0.5 + Math.cos(a) * r; y = 0.45 + Math.sin(a) * r * 0.75; }
    else if (shape === "zigzag") { x = 0.5 + (Math.abs(((s * 6) % 2) - 1) - 0.5) * 0.5; y = 0.75 - s * 0.55; }
    else if (shape === "loop") { const a = s * Math.PI * 2; x = 0.5 + Math.sin(a) * 0.3 + Math.sin(a * 3) * 0.04; y = 0.75 - s * 0.5 + Math.sin(a * 2) * 0.08; }
    else if (shape === "up") { x = 0.2 + s * 0.6; y = 0.72 - s * s * 0.5 + Math.sin(s * 14) * 0.02 * (1 - s); }
    else { x = 0.5 + Math.sin(s * 9.3) * 0.18 * (1 - s * 0.4) + Math.sin(s * 23.1) * 0.03; y = 0.78 - s * 0.55 + Math.sin(s * 5.7) * 0.04; }
    const top = 0.16, bot = Math.min(0.74, st.caption.y - 0.06);
    pts.push([x * W, (top + ((y - 0.23) / 0.55) * (bot - top)) * H]);
  }
  const n = Math.max(1, Math.floor(u * N));
  g.beginPath(); pts.slice(0, n + 1).forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.strokeStyle = st.ink; g.lineWidth = W * 0.004; g.lineCap = "round"; g.lineJoin = "round"; g.stroke();
  const [hx, hy] = pts[n]!;
  g.beginPath(); g.arc(hx, hy, W * 0.012, 0, Math.PI * 2); g.fillStyle = st.ink; g.fill();
  const [sx, sy] = pts[0]!;
  g.beginPath(); g.arc(sx, sy, W * 0.008, 0, Math.PI * 2); g.fill();
  if (sc.text) { g.font = font(st, W * 0.036, 500); g.fillStyle = muted(st); g.textAlign = "center"; g.fillText(sc.text, W / 2, top0(c, 0.12)); }
}

// ---------------------------------------------------------------- quote
export function quote(c: Ctx) {
  const { g, st, W, H, t, sc } = c;
  if (!c.noBg) drawSet(g, st, "plain", W, H, H, t);
  const ink = fg(st);
  const k = clamp01((t - (sc.start ?? 0)) / 0.4);
  g.save(); g.globalAlpha = k;
  g.font = font(st, W * 0.3); g.fillStyle = st.accent; g.textAlign = "left"; g.fillText("“", W * 0.06, H * 0.2);
  g.font = font(st, W * 0.07); g.fillStyle = ink; g.textAlign = "center"; g.textBaseline = "middle";
  const lines = wrapText(g, sc.text ?? "", W * 0.78);
  lines.forEach((l, i) => g.fillText(l, W / 2, H * 0.34 + (i - (lines.length - 1) / 2) * W * 0.095));
  if (sc.author) { g.font = font(st, W * 0.04, 600); g.fillStyle = muted(st); g.fillText(`— ${sc.author}`, W / 2, H * 0.34 + lines.length * W * 0.06 + W * 0.06); }
  g.restore();
}

// ---------------------------------------------------------------- route (flat map)
export function route(c: Ctx) {
  const { g, st, W, H, t, sc } = c;
  if (!c.noBg) drawSet(g, st, "plain", W, H, H, t);
  const ink = fg(st);
  const top = top0(c, 0.1), bot = zone(st, H), cell = W * 0.13;
  const ox = W / 2 - cell * 3, oy = top + (bot - top) / 2 - cell * 2.5;
  g.save();
  g.beginPath(); g.rect(W * 0.04, top, W * 0.92, bot - top); g.clip();
  // blocks between streets
  g.fillStyle = isLight(st.bg) ? "rgba(0,0,0,0.07)" : "rgba(255,255,255,0.08)";
  for (let ix = -1; ix < 7; ix++) for (let iz = -2; iz < 7; iz++) g.fillRect(ox + ix * cell + cell * 0.12, oy + iz * cell + cell * 0.12, cell * 0.76, cell * 0.76);
  const pts: [number, number][] = [[0, 5], [0, 3], [2, 3], [2, 1], [4, 1], [4, 0], [6, 0]].map(([x, z]) => [ox + x! * cell, oy + z! * cell]);
  const u = ease.inOut(span(t, sc, "start+0.3", "lineEnd-0.2"));
  const total = pts.slice(1).reduce((a, p, i) => a + Math.hypot(p[0] - pts[i]![0], p[1] - pts[i]![1]), 0);
  let left = total * u; let head = pts[0]!;
  g.beginPath(); g.moveTo(pts[0]![0], pts[0]![1]);
  for (let i = 1; i < pts.length && left > 0; i++) { const a = pts[i - 1]!, b = pts[i]!, d = Math.hypot(b[0] - a[0], b[1] - a[1]), l = Math.min(d, left); left -= l; head = [a[0] + (b[0] - a[0]) * (l / d), a[1] + (b[1] - a[1]) * (l / d)]; g.lineTo(head[0], head[1]); }
  g.strokeStyle = st.accent; g.lineWidth = W * 0.022; g.lineCap = "round"; g.lineJoin = "round"; g.stroke();
  g.restore();
  const pin = (x: number, y: number, col: string, k: number) => { g.save(); g.translate(x, y); g.scale(k, k); g.fillStyle = col; g.beginPath(); g.arc(0, -W * 0.06, W * 0.035, Math.PI * 0.85, Math.PI * 2.15); g.lineTo(0, 0); g.closePath(); g.fill(); g.fillStyle = "#fff"; g.beginPath(); g.arc(0, -W * 0.06, W * 0.014, 0, Math.PI * 2); g.fill(); g.restore(); };
  pin(pts[0]![0], pts[0]![1], st.accent, 1);
  const endK = ease.back(clamp01((t - atTime("lineEnd-0.25", sc)) / 0.35));
  const end = pts.at(-1)!;
  if (endK > 0) pin(end[0], end[1], st.accent2 === ink ? "#e8463a" : st.accent2, endK);
  g.save(); g.font = font(st, W * 0.036, 800); g.fillStyle = ink; g.textAlign = "center";
  if (sc.text) g.fillText(sc.text, pts[0]![0], pts[0]![1] + W * 0.06);
  if (sc.label && endK > 0) g.fillText(sc.label, end[0] - W * 0.06, end[1] + W * 0.06);
  if (sc.eta && endK > 0) { const s = W * 0.06; g.font = font(st, s); const w = g.measureText(sc.eta).width + s; g.fillStyle = ink; g.beginPath(); g.roundRect(W / 2 - w / 2, top + W * 0.04, w, s * 1.5, s * 0.3); g.fill(); g.fillStyle = isLight(ink) ? "#111" : "#fff"; g.textBaseline = "middle"; g.fillText(sc.eta, W / 2, top + W * 0.04 + s * 0.78); }
  g.restore();
}

// ---------------------------------------------------------------- exploded (isometric, flat)
export function exploded(c: Ctx) {
  const { g, st, W, H, t, sc } = c;
  if (!c.noBg) drawSet(g, st, "plain", W, H, H, t);
  const ink = fg(st);
  const layers = sc.layers ?? [];
  const n = Math.max(1, layers.length);
  const u = ease.inOut(span(t, sc, "start+0.2", "line+1.2"));
  const top = H * 0.14, bot = zone(st, H);
  const cx = W * 0.34, gap = ((bot - top) / n) * u * 0.85 + W * 0.012;
  const mid = (top + bot) / 2;
  const a = atTime("line+0.6", sc), b = atTime("lineEnd-0.3", sc);
  if (sc.title) { g.font = font(st, W * 0.036, 700); g.fillStyle = ink; g.textAlign = "left"; g.fillText(sc.title, W * 0.07, top0(c, 0.09)); }
  // (labels stay left of the phone UI's right-hand buttons: x <= 0.86)
  for (let i = n - 1; i >= 0; i--) {
    const l = layers[i]!;
    const y = mid + (i - (n - 1) / 2) * gap;
    const w = W * 0.24, d = W * 0.12, th = W * 0.018;
    const col = l.color ?? st.palette[i % st.palette.length]!;
    g.save(); g.translate(cx, y);
    g.beginPath(); g.moveTo(-w, 0); g.lineTo(0, -d); g.lineTo(w, 0); g.lineTo(0, d); g.closePath(); g.fillStyle = col; g.fill(); g.strokeStyle = ink; g.lineWidth = W * 0.002; g.stroke();
    g.beginPath(); g.moveTo(-w, 0); g.lineTo(0, d); g.lineTo(w, 0); g.lineTo(w, th); g.lineTo(0, d + th); g.lineTo(-w, th); g.closePath(); g.fillStyle = shadeHex(col); g.fill(); g.stroke();
    g.restore();
    const at = a + ((b - a) * (n - 1 - i)) / n;
    const k = clamp01((t - at) / 0.3);
    if (k > 0) {
      g.save(); g.globalAlpha = k; g.strokeStyle = ink; g.lineWidth = 2; g.beginPath(); g.moveTo(cx + W * 0.12, y); g.lineTo(W * 0.6, y); g.stroke();
      g.fillStyle = st.accent; g.beginPath(); g.arc(cx + W * 0.12, y, W * 0.007, 0, Math.PI * 2); g.fill();
      g.font = font(st, W * 0.036, 800); g.fillStyle = ink; g.textAlign = "left"; g.textBaseline = "middle"; g.fillText(l.label, W * 0.62, y);
      g.restore();
    }
  }
}

function shadeHex(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex); if (!m) return hex;
  const v = parseInt(m[1]!, 16);
  return `rgb(${((v >> 16) & 255) * 0.7},${((v >> 8) & 255) * 0.7},${(v & 255) * 0.7})`;
}

export const SCENES2D: Record<string, (c: Ctx) => void> = { stage, chart, counter, card, list, diagram, path, quote, route, exploded };

export { halftone };

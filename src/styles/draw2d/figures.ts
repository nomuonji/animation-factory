import { BODY, joints, type Joints, type Pose } from "../pose";
import type { StyleDef } from "../themes";
import { drawIcon } from "../icons";
import { isLight } from "../overlay";

export interface FigureState {
  pose: Pose;
  face: string;
  talk: number;        // 0 closed .. 1 open mouth
  facing: number;      // 1 right, -1 left
  color: string;       // body / shirt
  accent: string;      // hair / cap
  skin: string;
  hair: string;
  holds?: string;
  emote?: string;
  emoteAge: number;
  t: number;
  seed: number;
}

type V = [number, number];

/** Draw one figure with its feet at (x, y); `h` is the figure height in pixels. */
export function drawFigure(g: CanvasRenderingContext2D, st: StyleDef, f: FigureState, x: number, y: number, h: number) {
  const J = joints(f.pose);
  const boil = st.fx.includes("wobble") ? Math.floor(f.t * 8) : -1;
  const P = (v: V, k = 0): V => {
    let jx = 0, jy = 0;
    if (boil >= 0) { const r = Math.sin((boil + 1) * 12.9898 * (k + 1) + f.seed * 78.233) * 43758.5453; jx = ((r - Math.floor(r)) - 0.5) * 0.008; jy = ((r * 7 - Math.floor(r * 7)) - 0.5) * 0.008; }
    return [x + (v[0] * f.facing + jx) * h, y + (v[1] + jy) * h];
  };
  switch (st.figure) {
    case "line": return lineFigure(g, st, J, P, h);
    case "pictogram": return pictogram(g, st, J, P, h);
    case "paper": return paperFigure(g, st, f, J, P, h);
    case "bean": case "pixel": return beanFigure(g, st, f, J, P, h);
    default: return stickFigure(g, st, f, J, P, h);
  }
}

function seg(g: CanvasRenderingContext2D, pts: V[], w: number, color: string) {
  g.beginPath(); pts.forEach(([a, b], i) => (i ? g.lineTo(a, b) : g.moveTo(a, b)));
  g.lineWidth = w; g.strokeStyle = color; g.lineCap = "round"; g.lineJoin = "round"; g.stroke();
}

function stickFigure(g: CanvasRenderingContext2D, st: StyleDef, f: FigureState, J: Joints, P: (v: V, k?: number) => V, h: number) {
  const w = h * 0.045, ink = st.ink;
  seg(g, [P(J.lf, 1), P(J.lk, 2), P(J.hip, 3)], w, ink);
  seg(g, [P(J.rf, 4), P(J.rk, 5), P(J.hip, 3)], w, ink);
  // shirt: a coloured torso with horizontal stripes when a colour is given
  if (f.color && f.color !== ink) {
    const a = P(J.hip, 3), b = P(J.neck, 6);
    const tw = h * 0.14;
    g.save();
    g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
    g.rotate(Math.atan2(b[1] - a[1], b[0] - a[0]) + Math.PI / 2);
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    g.beginPath(); g.roundRect(-tw / 2, -len / 2 - h * 0.01, tw, len + h * 0.02, tw * 0.3);
    g.fillStyle = "#ffffff"; g.fill();
    g.save(); g.clip();
    g.fillStyle = f.color;
    for (let i = -3; i < 6; i++) g.fillRect(-tw, -len / 2 + i * h * 0.045, tw * 2, h * 0.022);
    g.restore();
    g.lineWidth = w * 0.8; g.strokeStyle = ink; g.stroke();
    g.restore();
  } else seg(g, [P(J.hip, 3), P(J.neck, 6)], w, ink);
  seg(g, [P(J.shoulder, 6), P(J.le, 7), P(J.lh, 8)], w, ink);
  seg(g, [P(J.shoulder, 6), P(J.re, 9), P(J.rh, 10)], w, ink);
  if (f.holds) drawIcon(g, f.holds, P(J.rh)[0], P(J.rh)[1] - h * 0.05, h * 0.16, { ink, line: 0.06 });
  head(g, st, f, P(J.head, 11), h * BODY.headR * 1.25, ink, "#ffffff", w * 0.8);
  emote(g, st, f, P(J.head), h);
}

function lineFigure(g: CanvasRenderingContext2D, st: StyleDef, J: Joints, P: (v: V, k?: number) => V, h: number) {
  const w = Math.max(2, h * 0.018);
  seg(g, [P(J.lf), P(J.lk), P(J.hip), P(J.rk), P(J.rf)], w, st.ink);
  seg(g, [P(J.hip), P(J.neck)], w, st.ink);
  seg(g, [P(J.lh), P(J.le), P(J.shoulder), P(J.re), P(J.rh)], w, st.ink);
  const c = P(J.head);
  g.beginPath(); g.arc(c[0], c[1], h * 0.085, 0, Math.PI * 2); g.lineWidth = w; g.strokeStyle = st.ink; g.stroke();
}

function pictogram(g: CanvasRenderingContext2D, st: StyleDef, J: Joints, P: (v: V, k?: number) => V, h: number) {
  const w = h * 0.085, ink = st.ink;
  seg(g, [P(J.lf), P(J.lk), P(J.hip)], w, ink);
  seg(g, [P(J.rf), P(J.rk), P(J.hip)], w, ink);
  seg(g, [P(J.hip), P(J.neck)], w * 1.5, ink);
  seg(g, [P(J.shoulder), P(J.le), P(J.lh)], w * 0.8, ink);
  seg(g, [P(J.shoulder), P(J.re), P(J.rh)], w * 0.8, ink);
  const c = P(J.head);
  g.beginPath(); g.arc(c[0], c[1] - h * 0.02, h * 0.08, 0, Math.PI * 2); g.fillStyle = ink; g.fill();
}

function paperFigure(g: CanvasRenderingContext2D, st: StyleDef, f: FigureState, J: Joints, P: (v: V, k?: number) => V, h: number) {
  const limb = h * 0.07;
  const pants = shade(f.color, -0.35);
  seg(g, [P(J.lf), P(J.lk), P(J.hip)], limb, pants);
  seg(g, [P(J.rf), P(J.rk), P(J.hip)], limb, pants);
  for (const ft of [J.lf, J.rf]) { const p = P(ft); g.beginPath(); g.ellipse(p[0] + f.facing * h * 0.02, p[1], h * 0.05, h * 0.025, 0, 0, Math.PI * 2); g.fillStyle = st.ink; g.fill(); }
  // torso: a trapezoid of coloured paper
  const a = P(J.hip), b = P(J.neck);
  g.save(); g.translate(a[0], a[1]); g.rotate(Math.atan2(b[1] - a[1], b[0] - a[0]) + Math.PI / 2);
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  g.beginPath(); g.moveTo(-h * 0.08, h * 0.02); g.lineTo(h * 0.08, h * 0.02); g.lineTo(h * 0.1, -len); g.lineTo(-h * 0.1, -len); g.closePath();
  g.fillStyle = f.color; g.fill();
  g.restore();
  seg(g, [P(J.shoulder), P(J.le), P(J.lh)], limb * 0.85, f.color);
  seg(g, [P(J.shoulder), P(J.re), P(J.rh)], limb * 0.85, f.color);
  for (const hd of [J.lh, J.rh]) { const p = P(hd); g.beginPath(); g.arc(p[0], p[1], limb * 0.5, 0, Math.PI * 2); g.fillStyle = f.skin; g.fill(); }
  if (f.holds) drawIcon(g, f.holds, P(J.rh)[0], P(J.rh)[1] - h * 0.06, h * 0.17, { ink: st.ink, line: 0.04 });
  head(g, st, f, P(J.head), h * BODY.headR * 1.3, st.ink, f.skin, 0);
  emote(g, st, f, P(J.head), h);
}

function beanFigure(g: CanvasRenderingContext2D, st: StyleDef, f: FigureState, J: Joints, P: (v: V, k?: number) => V, h: number) {
  const ol = st.figure === "pixel" ? h * 0.03 : h * 0.022;
  const limb = h * 0.06;
  const ink = st.ink;
  const pants = shade(f.color, -0.4);
  const outlined = (pts: V[], w: number, col: string) => { if (st.id !== "risograph") seg(g, pts, w + ol * 2, ink); seg(g, pts, w, col); };
  outlined([P(J.lf), P(J.lk), P(J.hip)], limb, pants);
  outlined([P(J.rf), P(J.rk), P(J.hip)], limb, pants);
  outlined([P(J.shoulder), P(J.le), P(J.lh)], limb * 0.85, f.color);
  // torso bean
  const a = P(J.hip), b = P(J.neck);
  g.save(); g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2); g.rotate(Math.atan2(b[1] - a[1], b[0] - a[0]) + Math.PI / 2);
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  g.beginPath(); g.roundRect(-h * 0.085, -len / 2 - h * 0.02, h * 0.17, len + h * 0.06, h * 0.06);
  g.fillStyle = f.color; g.fill();
  if (st.id !== "risograph") { g.lineWidth = ol; g.strokeStyle = ink; g.stroke(); }
  if (st.id === "comic") { g.save(); g.clip(); halftone(g, -h * 0.085, 0, h * 0.17, len, h * 0.018, "rgba(0,0,0,0.28)"); g.restore(); }
  g.restore();
  outlined([P(J.shoulder), P(J.re), P(J.rh)], limb * 0.85, f.color);
  for (const hd of [J.lh, J.rh]) { const p = P(hd); g.beginPath(); g.arc(p[0], p[1], limb * 0.55, 0, Math.PI * 2); g.fillStyle = f.skin; g.fill(); if (st.id !== "risograph") { g.lineWidth = ol * 0.8; g.strokeStyle = ink; g.stroke(); } }
  if (f.holds) drawIcon(g, f.holds, P(J.rh)[0], P(J.rh)[1] - h * 0.06, h * 0.17, { ink, line: 0.06 });
  head(g, st, f, P(J.head), h * BODY.headR * 1.45, ink, f.skin, st.id === "risograph" ? 0 : ol);
  emote(g, st, f, P(J.head), h);
}

export function halftone(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, step: number, color: string) {
  g.fillStyle = color;
  for (let yy = 0, r = 0; yy < h; yy += step, r++) for (let xx = (r % 2) * step / 2; xx < w; xx += step) { g.beginPath(); g.arc(x + xx, y + yy, step * 0.28, 0, Math.PI * 2); g.fill(); }
}

function head(g: CanvasRenderingContext2D, st: StyleDef, f: FigureState, c: V, r: number, ink: string, fill: string, lw: number) {
  const [x, y] = c;
  // hair behind
  if (f.hair === "bob" || f.hair === "bun") { g.beginPath(); g.arc(x, y - r * 0.1, r * 1.12, Math.PI * 0.95, Math.PI * 2.05); g.lineTo(x + r * 1.12, y + r * 0.5); g.lineTo(x - r * 1.12, y + r * 0.5); g.closePath(); g.fillStyle = f.accent; g.fill(); }
  if (f.hair === "bun") { g.beginPath(); g.arc(x, y - r * 1.15, r * 0.4, 0, Math.PI * 2); g.fillStyle = f.accent; g.fill(); }
  g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fillStyle = fill; g.fill();
  if (lw) { g.lineWidth = lw; g.strokeStyle = ink; g.stroke(); }
  if (f.hair === "spiky") {
    g.beginPath();
    for (let i = 0; i <= 8; i++) { const a = Math.PI * (1.05 + i * 0.1125); const rr = i % 2 ? r * 1.0 : r * 1.55; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    g.closePath(); g.fillStyle = f.accent; g.fill(); if (lw) { g.lineWidth = lw * 0.8; g.stroke(); }
  }
  if (f.hair === "cap") {
    g.beginPath(); g.arc(x, y - r * 0.05, r * 1.02, Math.PI, 0); g.closePath(); g.fillStyle = f.accent; g.fill();
    g.beginPath(); g.ellipse(x + f.facing * r * 0.7, y - r * 0.05, r * 0.75, r * 0.16, 0, 0, Math.PI * 2); g.fill();
    if (lw) { g.lineWidth = lw * 0.8; g.stroke(); }
  }
  if (f.hair === "hood") { g.beginPath(); g.arc(x, y, r * 1.2, Math.PI * 0.8, Math.PI * 2.2); g.lineWidth = r * 0.35; g.strokeStyle = f.accent; g.stroke(); }
  if (f.hair === "bob") { g.beginPath(); g.arc(x, y - r * 0.15, r * 1.02, Math.PI * 1.05, Math.PI * 1.95); g.closePath(); g.fillStyle = f.accent; g.fill(); }
  face(g, st, f, x + f.facing * r * 0.12, y, r, isLight(fill) ? (isLight(ink) ? "#141414" : ink) : "#ffffff");
}

function face(g: CanvasRenderingContext2D, st: StyleDef, f: FigureState, x: number, y: number, r: number, ink: string) {
  const e = f.face;
  g.save();
  g.strokeStyle = ink; g.fillStyle = ink; g.lineCap = "round"; g.lineWidth = Math.max(1.5, r * 0.11);
  const ex = r * 0.36, ey = -r * 0.08;
  const eye = (dx: number) => {
    const cx = x + dx, cy = y + ey;
    if (e === "happy" || e === "laugh") { g.beginPath(); g.arc(cx, cy + r * 0.05, r * 0.13, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); }
    else if (e === "dizzy") { g.beginPath(); g.moveTo(cx - r * 0.1, cy - r * 0.1); g.lineTo(cx + r * 0.1, cy + r * 0.1); g.moveTo(cx + r * 0.1, cy - r * 0.1); g.lineTo(cx - r * 0.1, cy + r * 0.1); g.stroke(); }
    else if (e === "shock" || e === "scared") { g.beginPath(); g.arc(cx, cy, r * 0.17, 0, Math.PI * 2); g.fillStyle = "#fff"; g.fill(); g.stroke(); g.beginPath(); g.arc(cx, cy, r * 0.06, 0, Math.PI * 2); g.fillStyle = ink; g.fill(); }
    else if (e === "sleepy" || e === "smug") { g.beginPath(); g.moveTo(cx - r * 0.12, cy); g.lineTo(cx + r * 0.12, cy); g.stroke(); }
    else { const big = st.figure === "bean" ? 1.4 : 1; g.beginPath(); g.ellipse(cx, cy, r * 0.075 * big, r * 0.11 * big, 0, 0, Math.PI * 2); g.fill(); if (big > 1) { g.beginPath(); g.arc(cx + r * 0.03, cy - r * 0.04, r * 0.035, 0, Math.PI * 2); g.fillStyle = "#fff"; g.fill(); g.fillStyle = ink; } }
  };
  eye(-ex); eye(ex);
  if (e === "angry") { g.beginPath(); g.moveTo(x - ex - r * 0.15, y + ey - r * 0.28); g.lineTo(x - ex + r * 0.12, y + ey - r * 0.16); g.moveTo(x + ex + r * 0.15, y + ey - r * 0.28); g.lineTo(x + ex - r * 0.12, y + ey - r * 0.16); g.stroke(); }
  if (e === "sad" || e === "worried") { g.beginPath(); g.moveTo(x - ex - r * 0.14, y + ey - r * 0.16); g.lineTo(x - ex + r * 0.1, y + ey - r * 0.26); g.moveTo(x + ex + r * 0.14, y + ey - r * 0.16); g.lineTo(x + ex - r * 0.1, y + ey - r * 0.26); g.stroke(); }
  const my = y + r * 0.42;
  const open = f.talk;
  g.beginPath();
  if (open > 0.15) { g.ellipse(x, my, r * 0.18, r * 0.06 + r * 0.14 * open, 0, 0, Math.PI * 2); g.fillStyle = "#5a1a1a"; g.fill(); g.stroke(); }
  else if (e === "happy" || e === "laugh") { g.arc(x, my - r * 0.12, r * 0.24, Math.PI * 0.15, Math.PI * 0.85); if (e === "laugh") { g.closePath(); g.fillStyle = "#5a1a1a"; g.fill(); } g.stroke(); }
  else if (e === "sad" || e === "worried") { g.arc(x, my + r * 0.12, r * 0.2, Math.PI * 1.2, Math.PI * 1.8); g.stroke(); }
  else if (e === "shock" || e === "scared") { g.ellipse(x, my, r * 0.12, r * 0.17, 0, 0, Math.PI * 2); g.fillStyle = "#5a1a1a"; g.fill(); g.stroke(); }
  else if (e === "tongue") { g.moveTo(x - r * 0.22, my - r * 0.05); g.lineTo(x + r * 0.22, my - r * 0.05); g.stroke(); g.beginPath(); g.ellipse(x + r * 0.04, my + r * 0.08, r * 0.1, r * 0.14, 0, 0, Math.PI); g.fillStyle = "#ff6f8a"; g.fill(); g.stroke(); }
  else if (e === "smug") { g.moveTo(x - r * 0.2, my); g.quadraticCurveTo(x + r * 0.05, my + r * 0.08, x + r * 0.24, my - r * 0.1); g.stroke(); }
  else if (e === "angry") { g.moveTo(x - r * 0.2, my + r * 0.04); g.lineTo(x + r * 0.2, my + r * 0.04); g.stroke(); }
  else { g.moveTo(x - r * 0.14, my); g.lineTo(x + r * 0.14, my); g.stroke(); }
  if (e === "blush" || e === "laugh" || e === "happy") { g.fillStyle = "rgba(255,90,110,0.35)"; for (const k of [-1, 1]) { g.beginPath(); g.ellipse(x + k * r * 0.55, y + r * 0.2, r * 0.14, r * 0.08, 0, 0, Math.PI * 2); g.fill(); } }
  if (e === "scared" || e === "worried") { g.fillStyle = "#7cc6ff"; g.beginPath(); g.ellipse(x + r * 0.85, y - r * 0.3, r * 0.1, r * 0.16, 0, 0, Math.PI * 2); g.fill(); }
  g.restore();
}

function emote(g: CanvasRenderingContext2D, st: StyleDef, f: FigureState, c: V, h: number) {
  if (!f.emote) return;
  const k = Math.min(1, f.emoteAge / 0.15);
  const bob = Math.sin(f.t * 6) * h * 0.008;
  const x = c[0] + h * 0.12, y = c[1] - h * 0.2 + bob;
  const s = h * 0.13 * (0.6 + 0.4 * k);
  const ink = st.ink === "#ffffff" ? "#ffffff" : st.ink;
  g.save();
  g.lineWidth = s * 0.08; g.strokeStyle = ink; g.lineJoin = "round";
  switch (f.emote) {
    case "!": case "?": g.font = `900 ${s * 1.3}px sans-serif`; g.textAlign = "center"; g.textBaseline = "middle"; g.lineWidth = s * 0.18; g.strokeText(f.emote, x, y); g.fillStyle = f.emote === "!" ? st.accent2 : st.accent; g.fillText(f.emote, x, y); break;
    case "...": for (let i = 0; i < 3; i++) { if (f.emoteAge * 3 > i) { g.beginPath(); g.arc(x - s * 0.4 + i * s * 0.4, y, s * 0.1, 0, Math.PI * 2); g.fillStyle = ink; g.fill(); } } break;
    case "heart": drawIcon(g, "heart", x, y, s, { ink, line: 0.06 }); break;
    case "idea": drawIcon(g, "bolt", x, y, s, { ink, line: 0.06 }); break;
    case "sweat": drawIcon(g, "drop", x - h * 0.02, y + h * 0.08, s * 0.6, { ink, line: 0.06 }); break;
    case "anger": g.strokeStyle = "#e8263a"; g.lineWidth = s * 0.12; for (let i = 0; i < 4; i++) { g.save(); g.translate(x, y); g.rotate(i * Math.PI / 2); g.beginPath(); g.moveTo(s * 0.1, s * 0.35); g.quadraticCurveTo(s * 0.1, s * 0.1, s * 0.35, s * 0.1); g.stroke(); g.restore(); } break;
    case "zzz": g.font = `900 ${s * 0.6}px sans-serif`; g.fillStyle = ink; for (let i = 0; i < 3; i++) g.fillText("z", x + i * s * 0.3, y - i * s * 0.3 - ((f.t * 0.6) % 0.3) * s); break;
    default: drawIcon(g, f.emote, x, y, s, { ink, line: 0.06 });
  }
  g.restore();
}

export function shade(hex: string, k: number) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1]!, 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(k < 0 ? c * (1 + k) : c + (255 - c) * k)));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => f(c).toString(16).padStart(2, "0")).join("")}`;
}

/** Face only (used by the 3D figures as a texture). */
export function drawFace(g: CanvasRenderingContext2D, st: StyleDef, expr: string, talk: number, x: number, y: number, r: number, ink: string) {
  face(g, st, { face: expr, talk } as FigureState, x, y, r, ink);
}

import type { StyleDef } from "../themes";
import { drawIcon } from "../icons";
import { halftone, shade } from "./figures";
import { rand } from "../util";

/**
 * 2D sets. Each draws the full frame for a stage scene; `gy` is the ground line in pixels.
 * Colours come from the style so the same set reads differently per look.
 */
export type SetDraw = (g: CanvasRenderingContext2D, st: StyleDef, W: number, H: number, gy: number, t: number, p: Record<string, unknown>) => void;

const sky = (g: CanvasRenderingContext2D, W: number, gy: number, top: string, bottom: string) => {
  const gr = g.createLinearGradient(0, 0, 0, gy); gr.addColorStop(0, top); gr.addColorStop(1, bottom); g.fillStyle = gr; g.fillRect(-W, -gy, W * 3, gy * 2);
};
const ground = (g: CanvasRenderingContext2D, W: number, H: number, gy: number, color: string, line?: string, lw = 0) => {
  g.fillStyle = color; g.fillRect(-W, gy, W * 3, H * 2);
  if (line) { g.strokeStyle = line; g.lineWidth = lw; g.beginPath(); g.moveTo(-W, gy); g.lineTo(W * 2, gy); g.stroke(); }
};
const cloud = (g: CanvasRenderingContext2D, x: number, y: number, s: number, fill: string, ink?: string, lw = 0) => {
  g.beginPath(); g.arc(x - s * 0.5, y, s * 0.42, Math.PI * 0.5, Math.PI * 1.5); g.arc(x, y - s * 0.25, s * 0.55, Math.PI, 0); g.arc(x + s * 0.55, y, s * 0.4, Math.PI * 1.5, Math.PI * 0.5); g.closePath();
  g.fillStyle = fill; g.fill(); if (ink) { g.lineWidth = lw; g.strokeStyle = ink; g.stroke(); }
};

export const SETS: Record<string, SetDraw> = {
  plain: (g, st, W, H) => { g.fillStyle = st.bg; g.fillRect(-W, -H, W * 3, H * 3); },
  void: (g, st, W, H) => { g.fillStyle = st.bg; g.fillRect(-W, -H, W * 3, H * 3); },
  beach: (g, st, W, H, gy, t) => {
    const lw = W * st.stroke * 0.7;
    sky(g, W, gy, "#5ec2ff", "#c9ecff");
    drawIcon(g, "sun", W * 0.82, H * 0.08, W * 0.14, { ink: st.ink, line: 0.04 });
    cloud(g, W * 0.18 + Math.sin(t * 0.2) * W * 0.02, H * 0.09, W * 0.1, "#ffffff", st.ink, lw);
    const sea = gy - H * 0.06;
    g.fillStyle = "#2f8fd8"; g.fillRect(-W, gy - H * 0.2, W * 3, H * 0.2);
    g.strokeStyle = "#bfe6ff"; g.lineWidth = lw;
    for (let r = 0; r < 4; r++) { g.beginPath(); for (let x = -20; x < W + 40; x += 20) g.lineTo(x, gy - H * 0.16 + r * H * 0.04 + Math.sin(x * 0.03 + t * 2 + r) * 6); g.stroke(); }
    ground(g, W, H, sea + H * 0.06, "#f3d9a4", st.ink, lw);
  },
  desert: (g, st, W, H, gy) => {
    sky(g, W, gy, "#ffb36b", "#ffe2b8");
    const lw = W * st.stroke * 0.7;
    for (const [x, h, w] of [[0.18, 0.2, 0.18], [0.72, 0.28, 0.22], [0.5, 0.12, 0.1]] as const) {
      g.beginPath(); g.moveTo(W * (x - w / 2), gy); g.lineTo(W * x, gy - H * h); g.lineTo(W * (x + w / 2), gy); g.closePath();
      g.fillStyle = "#e8a85c"; g.fill(); g.strokeStyle = st.ink; g.lineWidth = lw; g.stroke();
      g.beginPath(); g.moveTo(W * x, gy - H * h); g.lineTo(W * (x + w / 2), gy); g.lineTo(W * (x + w * 0.1), gy); g.closePath(); g.fillStyle = "rgba(0,0,0,0.12)"; g.fill();
    }
    ground(g, W, H, gy, "#f1c27d", st.ink, lw);
  },
  city: (g, st, W, H, gy) => {
    sky(g, W, gy, "#8fd0ff", "#e6f6ff");
    const r = rand(3), lw = W * st.stroke * 0.6;
    for (let i = 0; i < 9; i++) { const bw = W * (0.09 + r() * 0.07), bh = H * (0.12 + r() * 0.2), x = -W * 0.05 + i * W * 0.13; g.fillStyle = shade("#9fb4c8", -0.1 * r()); g.fillRect(x, gy - bh, bw, bh); g.strokeStyle = st.ink; g.lineWidth = lw; g.strokeRect(x, gy - bh, bw, bh); g.fillStyle = "#e6f6ff"; for (let wy = gy - bh + H * 0.02; wy < gy - H * 0.02; wy += H * 0.03) for (let wx = x + bw * 0.15; wx < x + bw - bw * 0.2; wx += bw * 0.3) g.fillRect(wx, wy, bw * 0.15, H * 0.012); }
    ground(g, W, H, gy, "#8c8c8c", st.ink, lw);
    g.fillStyle = "#fff"; for (let x = 0; x < W; x += W * 0.16) g.fillRect(x, gy + H * 0.05, W * 0.08, H * 0.008);
  },
  room: (g, st, W, H, gy) => {
    g.fillStyle = "#f6e7cf"; g.fillRect(-W, -H, W * 3, gy + H);
    const lw = W * st.stroke * 0.6;
    g.fillStyle = "#bfe6ff"; g.fillRect(W * 0.6, H * 0.12, W * 0.28, H * 0.16); g.strokeStyle = st.ink; g.lineWidth = lw; g.strokeRect(W * 0.6, H * 0.12, W * 0.28, H * 0.16);
    g.beginPath(); g.moveTo(W * 0.74, H * 0.12); g.lineTo(W * 0.74, H * 0.28); g.stroke();
    g.fillStyle = "#e9c46a"; g.fillRect(W * 0.1, H * 0.16, W * 0.16, H * 0.1); g.strokeRect(W * 0.1, H * 0.16, W * 0.16, H * 0.1);
    ground(g, W, H, gy, "#c98f5a", st.ink, lw);
  },
  space: (g, st, W, H, gy, t) => {
    g.fillStyle = "#0b0d22"; g.fillRect(-W, -H, W * 3, H * 3);
    const r = rand(7);
    for (let i = 0; i < 160; i++) { const x = r() * W, y = r() * H, tw = 0.5 + 0.5 * Math.sin(t * 2 + i); g.fillStyle = `rgba(255,255,255,${0.3 + 0.7 * tw * r()})`; g.fillRect(x, y, 2 + r() * 3, 2 + r() * 3); }
    drawIcon(g, "moon", W * 0.75, H * 0.14, W * 0.24, { ink: st.ink === "#ffffff" ? "#ffffff" : "#0b0d22", line: 0.02 });
    g.fillStyle = "#3a3f8f"; g.beginPath(); g.ellipse(W / 2, gy + H * 0.5, W * 1.2, H * 0.5, 0, 0, Math.PI * 2); g.fill();
  },
  sky: (g, st, W, H, _gy, t) => {
    sky(g, W, H, "#4aa8ff", "#d6efff");
    for (const [x, y, s, sp] of [[0.15, 0.2, 0.16, 0.05], [0.8, 0.35, 0.2, 0.03], [0.3, 0.7, 0.24, 0.04], [0.85, 0.85, 0.18, 0.06]] as const) cloud(g, W * x, ((H * y + t * H * sp * 4) % (H * 1.2)) - H * 0.05, W * s, "#ffffff", st.ink, W * st.stroke * 0.5);
  },
  park: (g, st, W, H, gy) => {
    sky(g, W, gy, "#7cc8ff", "#dff3ff");
    const lw = W * st.stroke * 0.6;
    g.fillStyle = "#7cc36a"; g.beginPath(); g.ellipse(W * 0.2, gy, W * 0.5, H * 0.08, 0, Math.PI, 0); g.fill(); g.beginPath(); g.ellipse(W * 0.85, gy, W * 0.45, H * 0.06, 0, Math.PI, 0); g.fill();
    drawIcon(g, "tree", W * 0.12, gy - H * 0.06, W * 0.22, { ink: st.ink, line: 0.03 });
    drawIcon(g, "tree", W * 0.9, gy - H * 0.05, W * 0.18, { ink: st.ink, line: 0.03 });
    ground(g, W, H, gy, "#58b85c", st.ink, lw);
  },
  classroom: (g, st, W, H, gy) => {
    g.fillStyle = "#efe6d2"; g.fillRect(-W, -H, W * 3, gy + H);
    g.fillStyle = "#2f5d46"; g.fillRect(W * 0.08, H * 0.08, W * 0.84, H * 0.24); g.strokeStyle = "#8b5a2b"; g.lineWidth = W * 0.015; g.strokeRect(W * 0.08, H * 0.08, W * 0.84, H * 0.24);
    ground(g, W, H, gy, "#b9874f", st.ink, W * st.stroke * 0.5);
  },
  newsprint: (g, st, W, H, gy) => {
    g.fillStyle = st.bg; g.fillRect(-W, -H, W * 3, H * 3);
    g.strokeStyle = "rgba(0,0,0,0.12)"; g.lineWidth = 2;
    for (let y = H * 0.05; y < H; y += H * 0.012) { g.beginPath(); g.moveTo(W * 0.06, y); g.lineTo(W * 0.45, y); g.moveTo(W * 0.55, y); g.lineTo(W * 0.94, y); g.stroke(); }
    g.fillStyle = st.bg; g.fillRect(W * 0.04, H * 0.18, W * 0.92, gy - H * 0.2);
    ground(g, W, H, gy, shade(st.bg, -0.06), st.ink, 3);
  },
  "dusk-paper": (g, st, W, H, gy, t) => {
    const layers = ["#5d4a8c", "#7a5fb5", "#b8a6e8"];
    g.fillStyle = layers[0]!; g.fillRect(-W, -H, W * 3, H * 3);
    g.fillStyle = "#fff7e6"; for (let i = 0; i < 18; i++) { const x = (i * 97) % W, y = (i * 211) % (gy * 0.6); g.beginPath(); g.arc(x, y, 3 + (i % 3) * 2, 0, Math.PI * 2); g.fill(); }
    g.save(); g.shadowColor = "rgba(0,0,0,0.3)"; g.shadowBlur = W * 0.02; g.shadowOffsetY = W * 0.008;
    for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(W * (0.6 + i * 0.12), H * 0.1 + i * 30); for (let k = 0; k < 4; k++) g.arc(W * (0.6 + i * 0.12) + k * W * 0.04, H * 0.1 + i * 30 + Math.sin(t + i) * 4, W * 0.035, Math.PI, 0); g.fillStyle = "#fff7e6"; g.fill(); }
    g.fillStyle = layers[1]!; g.beginPath(); g.moveTo(-W, gy); for (let x = -W; x < W * 2; x += W * 0.25) g.quadraticCurveTo(x + W * 0.125, gy - H * 0.1, x + W * 0.25, gy - H * 0.02); g.lineTo(W * 2, H * 2); g.lineTo(-W, H * 2); g.fill();
    g.fillStyle = layers[2]!; g.fillRect(-W, gy, W * 3, H * 2);
    g.restore();
  },
  burst: (g, st, W, H, gy, t) => {
    g.fillStyle = st.bg; g.fillRect(-W, -H, W * 3, H * 3);
    g.save(); g.translate(W / 2, gy - H * 0.2); g.rotate(t * 0.15);
    for (let i = 0; i < 24; i++) { g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, H * 1.5, (i / 24) * Math.PI * 2, ((i + 0.5) / 24) * Math.PI * 2); g.closePath(); g.fillStyle = i % 2 ? "#ffd21f" : "#ffe766"; g.fill(); }
    g.restore();
    halftone(g, 0, gy - H * 0.05, W, H * 0.6, W * 0.025, "rgba(232,38,58,0.55)");
    ground(g, W, H, gy, "rgba(255,255,255,0)", st.ink, W * 0.012);
  },
  "riso-night": (g, st, W, H, gy) => {
    g.fillStyle = st.paper; g.fillRect(-W, -H, W * 3, H * 3);
    g.globalCompositeOperation = "multiply";
    g.fillStyle = "#ffcf3f"; g.beginPath(); g.arc(W * 0.68, H * 0.16, W * 0.2, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#1f3a93"; g.globalAlpha = 0.85; g.beginPath(); g.moveTo(-W, gy); g.quadraticCurveTo(W * 0.3, gy - H * 0.16, W * 0.7, gy - H * 0.04); g.quadraticCurveTo(W * 1.2, gy - H * 0.1, W * 2, gy); g.lineTo(W * 2, H * 2); g.lineTo(-W, H * 2); g.fill();
    g.fillStyle = "#ff4f79"; g.globalAlpha = 0.8; g.fillRect(-W, gy + H * 0.02, W * 3, H * 2);
    g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
  },
  "sunset-grid": (g, st, W, H, gy, t) => {
    const gr = g.createLinearGradient(0, 0, 0, gy); gr.addColorStop(0, "#2a1b5c"); gr.addColorStop(0.6, "#b2338a"); gr.addColorStop(1, "#ff8f5a"); g.fillStyle = gr; g.fillRect(-W, -H, W * 3, gy + H);
    const sx = W / 2, sy = gy - H * 0.12, sr = W * 0.32;
    g.save(); g.beginPath(); g.arc(sx, sy, sr, 0, Math.PI * 2); g.clip();
    const sg = g.createLinearGradient(0, sy - sr, 0, sy + sr); sg.addColorStop(0, "#ffd36b"); sg.addColorStop(1, "#ff6fb5"); g.fillStyle = sg; g.fillRect(sx - sr, sy - sr, sr * 2, sr * 2);
    g.fillStyle = "#b2338a"; for (let i = 0; i < 6; i++) g.fillRect(sx - sr, sy + i * sr * 0.17, sr * 2, sr * 0.02 + i * sr * 0.012);
    g.restore();
    g.fillStyle = "#14102a"; g.fillRect(-W, gy, W * 3, H * 2);
    g.strokeStyle = "#ff6fb5"; g.lineWidth = 3;
    for (let i = 0; i < 14; i++) { const z = ((i + (t * 1.5) % 1) / 14) ** 2; g.beginPath(); g.moveTo(-W, gy + z * (H - gy)); g.lineTo(W * 2, gy + z * (H - gy)); g.stroke(); }
    for (let i = -12; i <= 12; i++) { g.beginPath(); g.moveTo(W / 2 + i * W * 0.02, gy); g.lineTo(W / 2 + i * W * 0.3, H); g.stroke(); }
  },
  "night-pixel": (g, st, W, H, gy, t) => {
    g.fillStyle = "#1b1f4a"; g.fillRect(-W, -H, W * 3, H * 3);
    const r = rand(11);
    for (let i = 0; i < 70; i++) { const x = r() * W, y = r() * gy * 0.9; if ((i + Math.floor(t * 3)) % 7) { g.fillStyle = "#f4f4d8"; g.fillRect(Math.round(x), Math.round(y), 1, 1); } }
    g.fillStyle = "#f4f4d8"; g.beginPath(); g.arc(W * 0.74, H * 0.16, W * 0.1, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#d8d8b8"; g.beginPath(); g.arc(W * 0.71, H * 0.15, W * 0.02, 0, Math.PI * 2); g.arc(W * 0.77, H * 0.18, W * 0.014, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#3a3f8f"; g.fillRect(-W, gy - H * 0.05, W * 3, H * 0.05);
    g.fillStyle = "#5a2e1e"; g.fillRect(W * 0.04, gy - H * 0.11, W * 0.2, H * 0.11); g.fillStyle = "#8b3a2a"; g.beginPath(); g.moveTo(W * 0.02, gy - H * 0.11); g.lineTo(W * 0.14, gy - H * 0.17); g.lineTo(W * 0.26, gy - H * 0.11); g.fill(); g.fillStyle = "#ffd23f"; g.fillRect(W * 0.08, gy - H * 0.085, W * 0.04, H * 0.025); g.fillRect(W * 0.16, gy - H * 0.085, W * 0.04, H * 0.025);
    g.fillStyle = "#2d6a3e"; g.fillRect(-W, gy, W * 3, H * 2);
    g.fillStyle = "#3f8f52"; for (let x = 0; x < W; x += W * 0.04) g.fillRect(x, gy, W * 0.02, H * 0.006);
  }
};

/** sets whose background is dark: line-drawn figures switch to a light ink there */
export const DARK_SETS = new Set(["space", "void", "night-pixel", "sunset-grid", "dusk-paper", "riso-night"]);

export function drawSet(g: CanvasRenderingContext2D, st: StyleDef, name: string, W: number, H: number, gy: number, t: number, p: Record<string, unknown> = {}) {
  (SETS[name] ?? SETS.plain!)(g, st, W, H, gy, t, p);
}

/**
 * Code-drawn pictograms used by every 2D style (diagram nodes, list bullets, held props, cards)
 * and turned into textures by the 3D styles. Each icon is drawn in a unit box centred on 0
 * (−0.5..0.5). The caller sets the transform; `ink` strokes, `fill` fills the main shape.
 */
export interface IconPaint { ink: string; fill: string; accent: string; line: number }

type Draw = (g: CanvasRenderingContext2D, p: IconPaint) => void;

const circle = (g: CanvasRenderingContext2D, x: number, y: number, r: number) => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); };
const both = (g: CanvasRenderingContext2D, p: IconPaint, fill = p.fill) => { g.fillStyle = fill; g.fill(); g.strokeStyle = p.ink; g.lineWidth = p.line; g.stroke(); };
const rr = (g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => { g.beginPath(); g.roundRect(x, y, w, h, r); };
const line = (g: CanvasRenderingContext2D, p: IconPaint, pts: [number, number][]) => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.strokeStyle = p.ink; g.lineWidth = p.line; g.stroke(); };

export const ICONS: Record<string, Draw> = {
  person: (g, p) => { circle(g, 0, -0.22, 0.14); both(g, p); g.beginPath(); g.moveTo(-0.28, 0.42); g.quadraticCurveTo(-0.28, 0.02, 0, 0.02); g.quadraticCurveTo(0.28, 0.02, 0.28, 0.42); g.closePath(); both(g, p); },
  people: (g, p) => { for (const [x, k] of [[-0.18, 0.85], [0.18, 0.85], [0, 1]] as const) { g.save(); g.translate(x, 0.04 * (1 - k) * 4); g.scale(k * 0.8, k * 0.8); ICONS.person!(g, p); g.restore(); } },
  phone: (g, p) => { rr(g, -0.2, -0.42, 0.4, 0.84, 0.07); both(g, p); rr(g, -0.15, -0.33, 0.3, 0.6, 0.02); both(g, p, p.accent); circle(g, 0, 0.35, 0.03); g.fillStyle = p.ink; g.fill(); },
  coin: (g, p) => { circle(g, 0, 0, 0.36); both(g, p, "#f2c230"); circle(g, 0, 0, 0.26); g.strokeStyle = p.ink; g.lineWidth = p.line * 0.6; g.stroke(); g.fillStyle = p.ink; g.font = "900 0.34px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("¥", 0, 0.02); },
  money: (g, p) => { rr(g, -0.42, -0.24, 0.84, 0.48, 0.04); both(g, p, "#9fd88a"); circle(g, 0, 0, 0.13); g.strokeStyle = p.ink; g.lineWidth = p.line * 0.7; g.stroke(); },
  house: (g, p) => { g.beginPath(); g.moveTo(-0.42, -0.02); g.lineTo(0, -0.4); g.lineTo(0.42, -0.02); g.closePath(); both(g, p, p.accent); rr(g, -0.32, -0.04, 0.64, 0.44, 0.01); both(g, p); rr(g, -0.08, 0.14, 0.16, 0.26, 0.01); both(g, p, p.accent); },
  building: (g, p) => { rr(g, -0.3, -0.42, 0.6, 0.84, 0.02); both(g, p); g.fillStyle = p.accent; for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) g.fillRect(-0.22 + c * 0.16, -0.32 + r * 0.18, 0.1, 0.1); },
  car: (g, p) => { g.beginPath(); g.moveTo(-0.44, 0.12); g.lineTo(-0.44, -0.02); g.lineTo(-0.26, -0.06); g.lineTo(-0.14, -0.24); g.lineTo(0.18, -0.24); g.lineTo(0.3, -0.06); g.lineTo(0.44, -0.02); g.lineTo(0.44, 0.12); g.closePath(); both(g, p); for (const x of [-0.24, 0.24]) { circle(g, x, 0.14, 0.1); both(g, p, p.ink); } },
  clock: (g, p) => { circle(g, 0, 0, 0.38); both(g, p); line(g, p, [[0, -0.24], [0, 0], [0.16, 0.1]]); },
  heart: (g, p) => { g.beginPath(); g.moveTo(0, 0.36); g.bezierCurveTo(-0.5, 0.02, -0.34, -0.42, 0, -0.16); g.bezierCurveTo(0.34, -0.42, 0.5, 0.02, 0, 0.36); both(g, p, "#ff5a6e"); },
  bolt: (g, p) => { g.beginPath(); g.moveTo(0.08, -0.44); g.lineTo(-0.22, 0.06); g.lineTo(0, 0.06); g.lineTo(-0.08, 0.44); g.lineTo(0.24, -0.08); g.lineTo(0.02, -0.08); g.closePath(); both(g, p, "#ffd23f"); },
  cloud: (g, p) => { g.beginPath(); g.arc(-0.18, 0.04, 0.17, Math.PI * 0.5, Math.PI * 1.5); g.arc(0, -0.1, 0.2, Math.PI, 0); g.arc(0.2, 0.04, 0.16, Math.PI * 1.5, Math.PI * 0.5); g.closePath(); both(g, p, "#ffffff"); },
  sun: (g, p) => { for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; line(g, p, [[Math.cos(a) * 0.3, Math.sin(a) * 0.3], [Math.cos(a) * 0.44, Math.sin(a) * 0.44]]); } circle(g, 0, 0, 0.22); both(g, p, "#ffd23f"); },
  moon: (g, p) => { circle(g, 0, 0, 0.38); both(g, p, "#f4f1d8"); for (const [x, y, r] of [[-0.12, -0.1, 0.07], [0.14, 0.08, 0.09], [-0.04, 0.2, 0.05]] as const) { circle(g, x, y, r); g.fillStyle = "rgba(0,0,0,0.12)"; g.fill(); } },
  rocket: (g, p) => { g.beginPath(); g.moveTo(0, -0.46); g.bezierCurveTo(0.2, -0.3, 0.18, 0.1, 0.13, 0.26); g.lineTo(-0.13, 0.26); g.bezierCurveTo(-0.18, 0.1, -0.2, -0.3, 0, -0.46); both(g, p, "#f4f4f4"); circle(g, 0, -0.12, 0.07); both(g, p, "#4aa3ff"); for (const k of [-1, 1]) { g.beginPath(); g.moveTo(0.12 * k, 0.04); g.lineTo(0.27 * k, 0.3); g.lineTo(0.12 * k, 0.24); g.closePath(); both(g, p, "#e8463a"); } g.beginPath(); g.moveTo(-0.09, 0.27); g.lineTo(0, 0.46); g.lineTo(0.09, 0.27); both(g, p, "#ffb02e"); },
  book: (g, p) => { rr(g, -0.36, -0.3, 0.34, 0.6, 0.02); both(g, p); rr(g, 0.02, -0.3, 0.34, 0.6, 0.02); both(g, p); line(g, p, [[-0.28, -0.16], [-0.1, -0.16]]); line(g, p, [[0.1, -0.16], [0.28, -0.16]]); },
  cup: (g, p) => { g.beginPath(); g.moveTo(-0.26, -0.2); g.lineTo(0.2, -0.2); g.lineTo(0.16, 0.32); g.lineTo(-0.22, 0.32); g.closePath(); both(g, p); g.beginPath(); g.arc(0.24, 0.02, 0.1, -Math.PI / 2, Math.PI / 2); g.strokeStyle = p.ink; g.lineWidth = p.line; g.stroke(); line(g, p, [[-0.1, -0.42], [-0.06, -0.28]]); line(g, p, [[0.04, -0.44], [0.08, -0.3]]); },
  gear: (g, p) => { g.beginPath(); for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2, r = i % 2 ? 0.3 : 0.4; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); both(g, p); circle(g, 0, 0, 0.12); both(g, p, p.accent); },
  chart: (g, p) => { line(g, p, [[-0.4, -0.4], [-0.4, 0.4], [0.42, 0.4]]); g.fillStyle = p.accent; [[-0.28, 0.14], [-0.06, -0.06], [0.16, -0.26]].forEach(([x, top]) => { rr(g, x!, top!, 0.14, 0.4 - top!, 0.01); both(g, p, p.accent); }); },
  globe: (g, p) => { circle(g, 0, 0, 0.38); both(g, p, "#7cc6ff"); g.beginPath(); g.ellipse(0, 0, 0.16, 0.38, 0, 0, Math.PI * 2); g.moveTo(-0.38, 0); g.lineTo(0.38, 0); g.strokeStyle = p.ink; g.lineWidth = p.line * 0.7; g.stroke(); },
  fire: (g, p) => { g.beginPath(); g.moveTo(0, -0.44); g.bezierCurveTo(0.3, -0.12, 0.34, 0.1, 0.24, 0.26); g.bezierCurveTo(0.12, 0.44, -0.12, 0.44, -0.24, 0.26); g.bezierCurveTo(-0.34, 0.1, -0.2, -0.06, -0.08, -0.12); g.bezierCurveTo(-0.08, -0.26, -0.04, -0.34, 0, -0.44); both(g, p, "#ff7a2f"); },
  drop: (g, p) => { g.beginPath(); g.moveTo(0, -0.42); g.bezierCurveTo(0.3, -0.06, 0.32, 0.14, 0.28, 0.2); g.arc(0, 0.16, 0.28, 0, Math.PI); g.bezierCurveTo(-0.32, 0.14, -0.3, -0.06, 0, -0.42); both(g, p, "#4aa3ff"); },
  star: (g, p) => { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i / 10) * Math.PI * 2, r = i % 2 ? 0.17 : 0.42; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); both(g, p, "#ffd23f"); },
  warning: (g, p) => { g.beginPath(); g.moveTo(0, -0.4); g.lineTo(0.42, 0.34); g.lineTo(-0.42, 0.34); g.closePath(); both(g, p, "#ffd23f"); line(g, p, [[0, -0.12], [0, 0.12]]); circle(g, 0, 0.22, 0.03); g.fillStyle = p.ink; g.fill(); },
  check: (g, p) => { circle(g, 0, 0, 0.4); both(g, p, "#4cc76a"); g.save(); g.lineWidth = p.line * 1.6; line(g, { ...p, line: p.line * 1.6 }, [[-0.18, 0], [-0.04, 0.14], [0.2, -0.14]]); g.restore(); },
  cross: (g, p) => { circle(g, 0, 0, 0.4); both(g, p, "#ff5a5a"); line(g, { ...p, line: p.line * 1.6 }, [[-0.15, -0.15], [0.15, 0.15]]); line(g, { ...p, line: p.line * 1.6 }, [[0.15, -0.15], [-0.15, 0.15]]); },
  question: (g, p) => { g.fillStyle = p.fill; g.strokeStyle = p.ink; g.lineWidth = p.line; g.font = "900 0.9px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.strokeText("?", 0, 0.04); g.fillText("?", 0, 0.04); },
  flag: (g, p) => { line(g, p, [[-0.3, 0.44], [-0.3, -0.42]]); g.beginPath(); g.moveTo(-0.3, -0.42); g.lineTo(0.36, -0.28); g.lineTo(-0.3, -0.1); g.closePath(); both(g, p, "#ff5a5a"); },
  tree: (g, p) => { rr(g, -0.06, 0.06, 0.12, 0.38, 0.02); both(g, p, "#9a6a3c"); circle(g, 0, -0.14, 0.3); both(g, p, "#58b85c"); },
  burger: (g, p) => { g.beginPath(); g.ellipse(0, -0.1, 0.38, 0.22, 0, Math.PI, 0); g.closePath(); both(g, p, "#e9a54b"); rr(g, -0.4, -0.08, 0.8, 0.1, 0.04); both(g, p, "#6fbf4a"); rr(g, -0.38, 0.03, 0.76, 0.12, 0.05); both(g, p, "#7a3e22"); rr(g, -0.37, 0.16, 0.74, 0.14, 0.06); both(g, p, "#e9a54b"); },
  dumbbell: (g, p) => { rr(g, -0.24, -0.04, 0.48, 0.08, 0.02); both(g, p); for (const k of [-1, 1]) { rr(g, k * 0.24 - 0.07, -0.2, 0.14, 0.4, 0.04); both(g, p, p.accent); rr(g, k * 0.38 - 0.05, -0.13, 0.1, 0.26, 0.03); both(g, p, p.accent); } },
  laptop: (g, p) => { rr(g, -0.32, -0.32, 0.64, 0.44, 0.03); both(g, p); rr(g, -0.26, -0.26, 0.52, 0.32, 0.01); both(g, p, p.accent); g.beginPath(); g.moveTo(-0.44, 0.16); g.lineTo(0.44, 0.16); g.lineTo(0.38, 0.28); g.lineTo(-0.38, 0.28); g.closePath(); both(g, p); },
  mountain: (g, p) => { g.beginPath(); g.moveTo(-0.46, 0.34); g.lineTo(-0.1, -0.34); g.lineTo(0.08, -0.02); g.lineTo(0.2, -0.18); g.lineTo(0.46, 0.34); g.closePath(); both(g, p, "#8fa3b8"); },
  plane: (g, p) => { g.beginPath(); g.moveTo(0.44, -0.02); g.lineTo(-0.36, -0.06); g.lineTo(-0.44, -0.2); g.lineTo(-0.48, -0.02); g.lineTo(-0.36, 0.04); g.lineTo(0.44, 0.04); g.closePath(); both(g, p); g.beginPath(); g.moveTo(0.06, 0); g.lineTo(-0.14, 0.34); g.lineTo(-0.04, 0.34); g.lineTo(0.2, 0); g.closePath(); both(g, p, p.accent); },
  salt: (g, p) => { rr(g, -0.2, -0.16, 0.4, 0.56, 0.08); both(g, p); g.beginPath(); g.ellipse(0, -0.16, 0.2, 0.12, 0, Math.PI, 0); both(g, p, p.accent); g.fillStyle = p.ink; for (const [x, y] of [[-0.06, -0.24], [0.06, -0.24], [0, -0.2]] as const) { circle(g, x, y, 0.02); g.fill(); } },
  wave: (g, p) => { for (const y of [-0.16, 0.04, 0.24]) { g.beginPath(); for (let i = 0; i <= 20; i++) { const x = -0.44 + i * 0.044; g.lineTo(x, y + Math.sin(i * 0.9) * 0.06); } g.strokeStyle = p.ink; g.lineWidth = p.line; g.stroke(); } },
  brain: (g, p) => { g.beginPath(); g.ellipse(0, 0, 0.4, 0.32, 0, 0, Math.PI * 2); both(g, p, "#ffb3c6"); line(g, p, [[0, -0.3], [0, 0.3]]); g.beginPath(); g.arc(-0.18, -0.06, 0.1, 0, Math.PI); g.arc(0.18, 0.06, 0.1, Math.PI, 0); g.strokeStyle = p.ink; g.lineWidth = p.line * 0.7; g.stroke(); },
  eye: (g, p) => { g.beginPath(); g.moveTo(-0.44, 0); g.quadraticCurveTo(0, -0.4, 0.44, 0); g.quadraticCurveTo(0, 0.4, -0.44, 0); both(g, p, "#ffffff"); circle(g, 0, 0, 0.14); both(g, p, p.ink); },
  bed: (g, p) => { rr(g, -0.44, -0.04, 0.88, 0.22, 0.03); both(g, p); rr(g, -0.4, -0.16, 0.22, 0.12, 0.05); both(g, p, "#ffffff"); line(g, p, [[-0.44, 0.18], [-0.44, 0.34]]); line(g, p, [[0.44, 0.18], [0.44, 0.34]]); },
  pill: (g, p) => { g.save(); g.rotate(-0.6); rr(g, -0.36, -0.14, 0.72, 0.28, 0.14); both(g, p); g.beginPath(); g.rect(0, -0.14, 0.36, 0.28); g.restore(); },
  arrow: (g, p) => { line(g, { ...p, line: p.line * 1.4 }, [[-0.4, 0], [0.36, 0]]); line(g, { ...p, line: p.line * 1.4 }, [[0.16, -0.2], [0.38, 0], [0.16, 0.2]]); }
};

export function drawIcon(g: CanvasRenderingContext2D, name: string, x: number, y: number, size: number, paint: Partial<IconPaint> = {}, rot = 0) {
  const fn = ICONS[name] ?? ICONS.question!;
  g.save();
  g.translate(x, y); g.rotate(rot); g.scale(size, size);
  g.lineJoin = "round"; g.lineCap = "round";
  fn(g, { ink: "#1a1a1a", fill: "#ffffff", accent: "#ffd23f", line: 0.05, ...paint });
  g.restore();
}

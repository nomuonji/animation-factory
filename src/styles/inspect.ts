/**
 * Layout inspector for Style Shorts — the checks a reviewer does by eye, made mechanical so any
 * agent (Claude, Codex, ChatGPT, a person) gets the same answer from a still.
 *
 * Enabled when window.__INSPECT__ is true (tools/styles/render-style.mjs --inspect). While a frame
 * is drawn it records every text drawn on the frame canvases (with its screen rectangle, size,
 * colour, the background luminance behind it and whether it is outlined) and every figure box.
 * checkLayout() then turns the records into issues; annotate() draws them on a copy of the frame.
 */
export interface Box { x0: number; y0: number; x1: number; y1: number }
export interface TextRec extends Box { kind: "text"; phase: "scene" | "overlay"; text: string; px: number; fg: number; bg: number; outlined: boolean; boxed: boolean }
export interface FigRec extends Box { kind: "figure"; id: string }
export type Rec = TextRec | FigRec;
export interface Issue { level: "error" | "warn"; code: string; msg: string; box: Box }

/** Areas covered by the YouTube Shorts / TikTok player UI on a 9:16 frame (fractions). */
export const UNSAFE: (Box & { name: string })[] = [
  { name: "下部のタイトル・チャンネル名", x0: 0, y0: 0.82, x1: 1, y1: 1 },
  { name: "右側のいいね・コメントボタン", x0: 0.86, y0: 0.5, x1: 1, y1: 1 },
  { name: "上部の検索・タブ", x0: 0, y0: 0, x1: 1, y1: 0.04 }
];

let recs: Rec[] = [];
let phase: "scene" | "overlay" = "scene";
let lastStroke: string[] = [];
const watched = new WeakSet<HTMLCanvasElement>();

export const inspecting = () => (window as unknown as { __INSPECT__?: boolean }).__INSPECT__ === true;
export function beginFrame() { recs = []; lastStroke = []; phase = "scene"; }
export function setPhase(p: "scene" | "overlay") { phase = p; }
export function records() { return recs; }
export function watch(c: HTMLCanvasElement) { watched.add(c); }

function lum(r: number, g: number, b: number) {
  const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function colorLum(style: unknown): number {
  if (typeof style !== "string") return -1;
  const c = document.createElement("canvas").getContext("2d")!;
  c.fillStyle = style; const s = c.fillStyle as string;
  const m = /^#([0-9a-f]{6})$/i.exec(s);
  if (m) { const n = parseInt(m[1]!, 16); return lum(n >> 16, (n >> 8) & 255, n & 255); }
  const r = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/.exec(s);
  return r ? lum(+r[1]!, +r[2]!, +r[3]!) : -1;
}

function rectOf(g: CanvasRenderingContext2D, text: string, x: number, y: number): Box {
  const m = g.measureText(text);
  const T = g.getTransform();
  const pts = [[x - m.actualBoundingBoxLeft, y - m.actualBoundingBoxAscent], [x + m.actualBoundingBoxRight, y - m.actualBoundingBoxAscent], [x - m.actualBoundingBoxLeft, y + m.actualBoundingBoxDescent], [x + m.actualBoundingBoxRight, y + m.actualBoundingBoxDescent]]
    .map(([a, b]) => [T.a * a! + T.c * b! + T.e, T.b * a! + T.d * b! + T.f]);
  const W = g.canvas.width, H = g.canvas.height;
  return { x0: Math.min(...pts.map((p) => p[0]!)) / W, y0: Math.min(...pts.map((p) => p[1]!)) / H, x1: Math.max(...pts.map((p) => p[0]!)) / W, y1: Math.max(...pts.map((p) => p[1]!)) / H };
}

/** Patch the 2D context once; only canvases passed to watch() are recorded. */
export function install() {
  const P = CanvasRenderingContext2D.prototype;
  const fill = P.fillText, stroke = P.strokeText;
  P.strokeText = function (this: CanvasRenderingContext2D, text: string, x: number, y: number, mw?: number) {
    if (inspecting() && watched.has(this.canvas)) lastStroke.push(`${text}|${Math.round(x)}|${Math.round(y)}`);
    return mw === undefined ? stroke.call(this, text, x, y) : stroke.call(this, text, x, y, mw);
  };
  P.fillText = function (this: CanvasRenderingContext2D, text: string, x: number, y: number, mw?: number) {
    if (inspecting() && watched.has(this.canvas) && text.trim()) {
      const b = rectOf(this, text, x, y);
      const W = this.canvas.width, H = this.canvas.height;
      // background behind the text, sampled before the glyphs are drawn
      let bg = -1;
      const sx = Math.max(0, Math.floor(b.x0 * W)), sy = Math.max(0, Math.floor(b.y0 * H));
      const sw = Math.min(W - sx, Math.ceil((b.x1 - b.x0) * W)), sh = Math.min(H - sy, Math.ceil((b.y1 - b.y0) * H));
      if (sw > 0 && sh > 0) {
        const d = this.getImageData(sx, sy, sw, sh).data;
        let s = 0, n = 0;
        for (let i = 0; i < d.length; i += 4 * 7) { s += lum(d[i]!, d[i + 1]!, d[i + 2]!); n++; }
        bg = n ? s / n : -1;
      }
      const key = `${text}|${Math.round(x)}|${Math.round(y)}`;
      // px = glyph height on a 1080x1920 frame, whatever the render scale
      recs.push({ kind: "text", phase, text, ...b, px: (b.y1 - b.y0) * 1920, fg: colorLum(this.fillStyle), bg, outlined: lastStroke.includes(key) || this.shadowBlur > 0, boxed: false });
    }
    return mw === undefined ? fill.call(this, text, x, y) : fill.call(this, text, x, y, mw);
  };
}

/** Record a figure's box (local canvas coordinates through the current transform). */
export function figure(g: CanvasRenderingContext2D, id: string, x0: number, y0: number, x1: number, y1: number) {
  if (!inspecting()) return;
  const T = g.getTransform(), W = g.canvas.width, H = g.canvas.height;
  const xs = [x0, x1].map((x) => T.a * x + T.e), ys = [y0, y1].map((y) => T.d * y + T.f);
  recs.push({ kind: "figure", id, x0: Math.min(...xs) / W, y0: Math.min(...ys) / H, x1: Math.max(...xs) / W, y1: Math.max(...ys) / H });
}
export function figureBox(id: string, b: Box) { if (inspecting()) recs.push({ kind: "figure", id, ...b }); }

const area = (b: Box) => Math.max(0, b.x1 - b.x0) * Math.max(0, b.y1 - b.y0);
const inter = (a: Box, b: Box): Box => ({ x0: Math.max(a.x0, b.x0), y0: Math.max(a.y0, b.y0), x1: Math.min(a.x1, b.x1), y1: Math.min(a.y1, b.y1) });
function contrast(a: number, b: number) { const [h, l] = a > b ? [a, b] : [b, a]; return (h + 0.05) / (l + 0.05); }

export function checkLayout(rs: Rec[]): Issue[] {
  const out: Issue[] = [];
  const texts = rs.filter((r): r is TextRec => r.kind === "text");
  const figs = rs.filter((r): r is FigRec => r.kind === "figure");
  const overlay = texts.filter((t) => t.phase === "overlay"), scene = texts.filter((t) => t.phase === "scene");
  for (const t of texts) {
    if (/^[\p{P}\p{S}]$/u.test(t.text.trim())) continue; // decorative single marks (“ ! ?)
    if (t.x0 < -0.002 || t.x1 > 1.002 || t.y0 < -0.002 || t.y1 > 1.002) out.push({ level: "error", code: "text-cut", msg: `文字が画面からはみ出す「${t.text.slice(0, 16)}」`, box: t });
    for (const u of UNSAFE) {
      const i = inter(t, u);
      if (area(i) > area(t) * 0.25) out.push({ level: "warn", code: "unsafe-zone", msg: `「${t.text.slice(0, 16)}」が${u.name}の位置（スマホのUIで隠れる）`, box: t });
    }
    if (t.px < 30 && t.text.length > 1) out.push({ level: "warn", code: "tiny-text", msg: `文字が小さい（${t.px.toFixed(0)}px/1920）「${t.text.slice(0, 16)}」`, box: t });
    if (t.fg >= 0 && t.bg >= 0 && !t.outlined) {
      const c = contrast(t.fg, t.bg);
      if (c < 3) out.push({ level: c < 1.8 ? "error" : "warn", code: "low-contrast", msg: `背景と文字のコントラスト ${c.toFixed(1)}:1「${t.text.slice(0, 16)}」`, box: t });
    }
  }
  for (const o of overlay) for (const s of scene) {
    const i = inter(o, s);
    if (area(i) > Math.min(area(o), area(s)) * 0.15) out.push({ level: "error", code: "caption-over-content", msg: `字幕・見出し「${o.text.slice(0, 12)}」が画面内の文字「${s.text.slice(0, 12)}」に重なる`, box: i });
  }
  for (const f of figs) {
    const w = f.x1 - f.x0;
    if (f.x0 < -w * 0.15 || f.x1 > 1 + w * 0.15 || f.y0 < -0.01) out.push({ level: "warn", code: "figure-cut", msg: `人物「${f.id}」が画面から切れる`, box: f });
    const head: Box = { x0: f.x0, y0: f.y0, x1: f.x1, y1: f.y0 + (f.y1 - f.y0) * 0.28 };
    for (const o of overlay) { const i = inter(o, head); if (area(i) > area(head) * 0.2) out.push({ level: "warn", code: "caption-over-face", msg: `字幕「${o.text.slice(0, 12)}」が人物「${f.id}」の顔にかかる`, box: i }); }
  }
  // de-duplicate identical messages
  const seen = new Set<string>();
  return out.filter((i) => (seen.has(i.msg) ? false : (seen.add(i.msg), true)));
}

export function annotate(src: HTMLCanvasElement, issues: Issue[]): string {
  const c = document.createElement("canvas"); c.width = src.width; c.height = src.height;
  const g = c.getContext("2d")!;
  g.drawImage(src, 0, 0);
  const W = c.width, H = c.height;
  g.lineWidth = Math.max(3, W * 0.005);
  for (const u of UNSAFE) { g.fillStyle = "rgba(255,0,0,0.07)"; g.fillRect(u.x0 * W, u.y0 * H, (u.x1 - u.x0) * W, (u.y1 - u.y0) * H); }
  issues.forEach((i, k) => {
    g.strokeStyle = i.level === "error" ? "#ff1744" : "#ffb300";
    g.strokeRect(i.box.x0 * W, i.box.y0 * H, (i.box.x1 - i.box.x0) * W, (i.box.y1 - i.box.y0) * H);
    g.fillStyle = g.strokeStyle; g.font = `900 ${Math.round(W * 0.03)}px sans-serif`;
    g.fillText(String(k + 1), i.box.x0 * W + 4, i.box.y0 * H - 6);
  });
  return c.toDataURL("image/jpeg", 0.85);
}

import type { At, Visual } from "./types";

/** Absolute time for an "at" inside a scene: seconds from scene start, or line / line+0.3 / lineEnd-0.2 / end-0.5 / start. */
export function atTime(at: At | undefined, sc: Visual): number {
  const start = sc.start ?? 0;
  if (at === undefined || at === null) return start;
  if (typeof at === "number") return start + at;
  const m = /^(line|lineEnd|end|start)\s*([+-]\s*[0-9.]+)?$/.exec(String(at).trim());
  if (!m) return start;
  const off = m[2] ? Number(m[2].replace(/\s/g, "")) : 0;
  const ls = Number.isFinite(sc.lineStart) ? sc.lineStart! : start;
  const le = Number.isFinite(sc.lineEnd) ? sc.lineEnd! : sc.end ?? start;
  const base = { line: ls, lineEnd: le, end: sc.end ?? start, start }[m[1] as "line"];
  return base + off;
}

/** Value of a possibly-timed property: returns current, previous and when it changed. */
export function timed<T>(v: T | [At, T][] | undefined, t: number, sc: Visual, fallback: T): { cur: T; prev: T; since: number } {
  if (v === undefined) return { cur: fallback, prev: fallback, since: -99 };
  if (!Array.isArray(v) || (v.length && !Array.isArray(v[0]))) return { cur: v as T, prev: v as T, since: -99 };
  let cur = fallback, prev = fallback, since = -99;
  for (const [at, val] of v as [At, T][]) {
    const tt = atTime(at, sc);
    if (t >= tt) { prev = cur; cur = val; since = tt; }
  }
  return { cur, prev, since };
}

/** 0..1 progress of t between two "at"s of a scene. */
export function span(t: number, sc: Visual, from: At | undefined, until: At | undefined, defFrom: At = "start", defUntil: At = "end") {
  const a = atTime(from ?? defFrom, sc), b = atTime(until ?? defUntil, sc);
  if (b <= a) return t >= a ? 1 : 0;
  return Math.max(0, Math.min(1, (t - a) / (b - a)));
}

export function fmt(v: number, f: string | undefined): string {
  switch (f) {
    case "short": {
      const a = Math.abs(v);
      if (a >= 1e8) return `${(v / 1e8).toFixed(a >= 1e9 ? 0 : 1)}億`;
      if (a >= 1e4) return `${(v / 1e4).toFixed(a >= 1e5 ? 0 : 1)}万`;
      return Math.round(v).toLocaleString("ja-JP");
    }
    case "decimal1": return v.toFixed(1);
    case "percent": return `${Math.round(v)}%`;
    case "int": return String(Math.round(v));
    default: return Math.round(v).toLocaleString("ja-JP");
  }
}

/** Seeded pseudo-random (stable across frames). */
export function rand(seed: number) {
  let s = Math.floor(seed * 9301 + 49297) % 233280;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}

export function hash(str: string) { let h = 2166136261; for (const c of str) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; }

export function wrapText(g: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const first = wrapRaw(g, text, maxW);
  if (first.length < 2 || text.includes("\n")) return first;
  // balance the lines so a caption never ends with a one-character orphan
  const total = g.measureText(text).width;
  let w = total / first.length;
  for (let i = 0; i < 12; i++) { const r = wrapRaw(g, text, w * 1.02); if (r.length <= first.length) return r; w *= 1.04; }
  return first;
}

function wrapRaw(g: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = []; let cur = "";
  for (const ch of text) {
    if (ch === "\n") { out.push(cur); cur = ""; continue; }
    if (g.measureText(cur + ch).width > maxW && cur) {
      // keep closing punctuation on the line (kinsoku)
      if (/[、。！？」』）)…ー]/.test(ch)) { cur += ch; continue; }
      out.push(cur); cur = ch;
    } else cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

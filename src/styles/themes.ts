/**
 * Style registry for Style Shorts. One entry = one look. The engines read only this data,
 * so adding a style is mostly adding an entry (and, when needed, a figure/set renderer).
 * Keep catalog/styles.json and .claude/skills/style-* in sync with this file.
 */
export const JP = `"Noto Sans CJK JP", "Noto Sans JP", "Hiragino Sans", sans-serif`;
export const JP_SERIF = `"Noto Serif CJK JP", "Noto Serif JP", "Hiragino Mincho ProN", serif`;
export const MONO = `"Noto Sans Mono CJK JP", "DejaVu Sans Mono", monospace`;

export interface CaptionStyle {
  kind: "stroke" | "box" | "pill" | "plain" | "tag";
  fill: string;
  stroke?: string;
  box?: string;
  /** vertical centre as a fraction of height */
  y: number;
  /** font size as a fraction of width */
  size: number;
  font?: string;
  weight?: number;
  italic?: boolean;
  /** highlight colour for the last chunk word (karaoke-ish emphasis) */
  hot?: string;
}

export interface StyleDef {
  id: string;
  name: string;
  engine: "2d" | "3d";
  /** figure renderer */
  figure: string;
  bg: string;
  ink: string;
  paper: string;
  accent: string;
  accent2: string;
  palette: string[];
  font: string;
  weight: number;
  caption: CaptionStyle;
  /** 2D post effects in order. 3D styles use `look` instead */
  fx: string[];
  /** 3D render look: toon | flat | clay | voxel | ps2 | horror | studio */
  look?: string;
  defaultSet: string;
  transition: "cut" | "pop" | "wipe" | "flash" | "slide" | "fade";
  /** line width for 2D drawing as a fraction of width */
  stroke: number;
  /** semantic set name -> this style's own set ("*" = any set not listed) */
  setMap?: Record<string, string>;
  /** scenes this style is designed for (others still render, but look generic) */
  best: string[];
}

const S = (o: StyleDef) => o;

export const STYLES: Record<string, StyleDef> = {
  stickman: S({
    id: "stickman", name: "棒人間", engine: "2d", figure: "stick",
    bg: "#bfe6ff", ink: "#111111", paper: "#ffffff", accent: "#ffd23f", accent2: "#e8463a",
    palette: ["#e8463a", "#2f6fdb", "#ffd23f", "#2bb673", "#111111"],
    font: JP, weight: 900,
    caption: { kind: "stroke", fill: "#ffffff", stroke: "#111111", y: 0.64, size: 0.07 },
    fx: ["wobble"], defaultSet: "beach", transition: "pop", stroke: 0.011,
    best: ["stage", "card", "list"]
  }),
  "minimal-line": S({
    id: "minimal-line", name: "ミニマル線画", engine: "2d", figure: "line",
    bg: "#000000", ink: "#ffffff", paper: "#000000", accent: "#ffffff", accent2: "#9a9a9a",
    palette: ["#ffffff", "#bdbdbd", "#7a7a7a"],
    font: JP, weight: 500,
    caption: { kind: "plain", fill: "#ffffff", y: 0.76, size: 0.042, weight: 500 },
    fx: ["grain-light"], defaultSet: "void", setMap: { "*": "void" }, transition: "fade", stroke: 0.006,
    best: ["path", "stage", "card", "quote"]
  }),
  "living-chart": S({
    id: "living-chart", name: "動くグラフ", engine: "2d", figure: "stick",
    bg: "#ffffff", ink: "#111111", paper: "#ffffff", accent: "#111111", accent2: "#e8463a",
    palette: ["#111111", "#e8463a", "#2f6fdb", "#9a9a9a"],
    font: JP, weight: 800,
    caption: { kind: "plain", fill: "#111111", y: 0.76, size: 0.046, weight: 700 },
    fx: [], defaultSet: "plain", transition: "fade", stroke: 0.005,
    best: ["chart", "counter", "list"]
  }),
  "living-diagram": S({
    id: "living-diagram", name: "動く図解", engine: "2d", figure: "pictogram",
    bg: "#ecebe6", ink: "#222222", paper: "#ffffff", accent: "#2f6fdb", accent2: "#111111",
    palette: ["#222222", "#2f6fdb", "#9a9a9a", "#e8463a"],
    font: JP, weight: 800,
    caption: { kind: "tag", fill: "#ffffff", box: "#222222", y: 0.72, size: 0.042 },
    fx: [], defaultSet: "plain", transition: "slide", stroke: 0.006,
    best: ["diagram", "stage", "list", "counter"]
  }),
  "paper-presenter": S({
    id: "paper-presenter", name: "紙の解説者", engine: "2d", figure: "paper",
    bg: "#f1ece0", ink: "#1a1a1a", paper: "#fbf8f1", accent: "#d62f2f", accent2: "#1a1a1a",
    palette: ["#d62f2f", "#1a1a1a", "#7a6f5d", "#e9c46a"],
    font: JP_SERIF, weight: 900,
    caption: { kind: "box", fill: "#1a1a1a", box: "#fbf8f1", y: 0.6, size: 0.046, font: JP, weight: 800 },
    fx: ["paper"], defaultSet: "newsprint", setMap: { "*": "newsprint" }, transition: "slide", stroke: 0.006,
    best: ["card", "counter", "list", "quote", "chart"]
  }),
  "paper-cutout": S({
    id: "paper-cutout", name: "切り絵", engine: "2d", figure: "paper",
    bg: "#5d4a8c", ink: "#2b2140", paper: "#fff7e6", accent: "#ff8a3d", accent2: "#ffd6a5",
    palette: ["#ff8a3d", "#ffd6a5", "#b8a6e8", "#7a5fb5", "#fff7e6"],
    font: JP, weight: 900,
    caption: { kind: "box", fill: "#2b2140", box: "#fff7e6", y: 0.76, size: 0.05 },
    fx: ["shadow", "paper"], defaultSet: "dusk-paper", setMap: { space: "dusk-paper", void: "dusk-paper", sky: "dusk-paper" }, transition: "slide", stroke: 0.0,
    best: ["stage", "card", "list"]
  }),
  comic: S({
    id: "comic", name: "アメコミ", engine: "2d", figure: "bean",
    bg: "#ffe14d", ink: "#111111", paper: "#ffffff", accent: "#e8263a", accent2: "#2f6fdb",
    palette: ["#e8263a", "#2f6fdb", "#ffe14d", "#ffffff", "#111111"],
    font: JP, weight: 900,
    caption: { kind: "box", fill: "#111111", box: "#ffffff", y: 0.76, size: 0.05, italic: true },
    fx: ["halftone-bg", "panel"], defaultSet: "burst", setMap: { space: "burst", void: "burst", plain: "burst" }, transition: "flash", stroke: 0.012,
    best: ["stage", "card", "counter"]
  }),
  risograph: S({
    id: "risograph", name: "リソグラフ", engine: "2d", figure: "bean",
    bg: "#f3eee3", ink: "#1f3a93", paper: "#f3eee3", accent: "#ff4f79", accent2: "#1f3a93",
    palette: ["#ff4f79", "#1f3a93", "#ffcf3f"],
    font: JP, weight: 900,
    caption: { kind: "plain", fill: "#1f3a93", y: 0.76, size: 0.052 },
    fx: ["riso"], defaultSet: "riso-night", setMap: { "*": "riso-night", plain: "plain" }, transition: "cut", stroke: 0.0,
    best: ["stage", "card", "list"]
  }),
  "retro-anime": S({
    id: "retro-anime", name: "レトロアニメ", engine: "2d", figure: "bean",
    bg: "#2a1b5c", ink: "#14102a", paper: "#fff3e0", accent: "#ff6fb5", accent2: "#ffd36b",
    palette: ["#ff6fb5", "#ffd36b", "#5be0ff", "#7b4dff", "#fff3e0"],
    font: JP, weight: 900,
    caption: { kind: "stroke", fill: "#ffffff", stroke: "#2a1b5c", y: 0.76, size: 0.058, italic: true },
    fx: ["speedlines", "scanlines", "aberration", "grain"], defaultSet: "sunset-grid", setMap: { space: "sunset-grid", void: "sunset-grid", city: "sunset-grid" }, transition: "flash", stroke: 0.008,
    best: ["stage", "card"]
  }),
  "pixel-art": S({
    id: "pixel-art", name: "ドット絵", engine: "2d", figure: "pixel",
    bg: "#1b1f4a", ink: "#0b0d22", paper: "#f4f4d8", accent: "#ffd23f", accent2: "#ff7a2f",
    palette: ["#ffd23f", "#ff7a2f", "#5be0ff", "#f4f4d8", "#3a3f8f"],
    font: MONO, weight: 900,
    caption: { kind: "box", fill: "#f4f4d8", box: "#0b0d22", y: 0.76, size: 0.046, font: MONO },
    fx: ["pixelate:4"], defaultSet: "night-pixel", setMap: { space: "night-pixel", void: "night-pixel" }, transition: "cut", stroke: 0.012,
    best: ["stage", "card", "counter"]
  }),
  // ---------------- 3D ----------------
  "cartoon-3d": S({
    id: "cartoon-3d", name: "3Dアニメ", engine: "3d", figure: "toon", look: "toon",
    bg: "#9fd3ff", ink: "#1a1a1a", paper: "#ffffff", accent: "#ffd23f", accent2: "#e8463a",
    palette: ["#ffcf9e", "#e8463a", "#2f6fdb", "#ffd23f", "#2bb673"],
    font: JP, weight: 900,
    caption: { kind: "stroke", fill: "#ffe14d", stroke: "#111111", y: 0.72, size: 0.064 },
    fx: [], defaultSet: "town", setMap: { "*": "town" }, transition: "cut", stroke: 0.01,
    best: ["stage", "card"]
  }),
  "what-if-3d": S({
    id: "what-if-3d", name: "もしも3D", engine: "3d", figure: "lowpoly", look: "soft",
    bg: "#ffd9a8", ink: "#3a2a1a", paper: "#fff3e0", accent: "#ff9f43", accent2: "#c0703a",
    palette: ["#f2b46d", "#e08e45", "#ffe0b2", "#a0522d"],
    font: JP, weight: 900,
    caption: { kind: "stroke", fill: "#ffffff", stroke: "#3a2a1a", y: 0.72, size: 0.058 },
    fx: [], defaultSet: "desert", setMap: { "*": "desert" }, transition: "fade", stroke: 0.01,
    best: ["stage", "card", "counter"]
  }),
  "low-poly-3d": S({
    id: "low-poly-3d", name: "ローポリ3D", engine: "3d", figure: "lowpoly", look: "flat",
    bg: "#20203a", ink: "#111111", paper: "#ffffff", accent: "#ff8a3d", accent2: "#7b6cff",
    palette: ["#ff8a3d", "#7b6cff", "#c9c3ff", "#ffcf9e", "#5a5a8a"],
    font: JP, weight: 900,
    caption: { kind: "stroke", fill: "#ffffff", stroke: "#20203a", y: 0.76, size: 0.058 },
    fx: [], defaultSet: "space-rocks", setMap: { "*": "space-rocks" }, transition: "cut", stroke: 0.01,
    best: ["stage", "card"]
  }),
  "route-3d": S({
    id: "route-3d", name: "3Dルート", engine: "3d", figure: "pin", look: "studio",
    bg: "#f2f2f2", ink: "#222222", paper: "#ffffff", accent: "#2f6fdb", accent2: "#e8463a",
    palette: ["#ffffff", "#e6e6e6", "#2f6fdb", "#e8463a"],
    font: JP, weight: 800,
    caption: { kind: "tag", fill: "#ffffff", box: "#222222", y: 0.76, size: 0.044 },
    fx: [], defaultSet: "city-white", setMap: { "*": "city-white" }, transition: "fade", stroke: 0.006,
    best: ["route", "counter", "card"]
  }),
  "exploded-view": S({
    id: "exploded-view", name: "分解図", engine: "3d", figure: "pin", look: "studio-dark",
    bg: "#0d0f14", ink: "#e6e6e6", paper: "#151821", accent: "#ff7a5c", accent2: "#5be0ff",
    palette: ["#ff7a5c", "#5be0ff", "#9aa4b8", "#2a2f3a"],
    font: MONO, weight: 700,
    caption: { kind: "plain", fill: "#e6e6e6", y: 0.76, size: 0.042, font: JP, weight: 700 },
    fx: [], defaultSet: "void-dark", setMap: { "*": "void-dark" }, transition: "fade", stroke: 0.004,
    best: ["exploded", "card", "counter"]
  }),
  "block-world": S({
    id: "block-world", name: "ブロックワールド", engine: "3d", figure: "voxel", look: "voxel",
    bg: "#8ecbff", ink: "#1a1a1a", paper: "#ffffff", accent: "#ffd23f", accent2: "#5aa83a",
    palette: ["#5aa83a", "#8b5a2b", "#7f7f7f", "#2f6fdb", "#e0b07a"],
    font: JP, weight: 900,
    caption: { kind: "stroke", fill: "#ffffff", stroke: "#111111", y: 0.7, size: 0.064 },
    fx: [], defaultSet: "voxel-hills", setMap: { "*": "voxel-hills" }, transition: "cut", stroke: 0.01,
    best: ["stage", "card"]
  }),
  "toy-bricks": S({
    id: "toy-bricks", name: "おもちゃブロック", engine: "3d", figure: "brick", look: "toon",
    bg: "#7fd1ff", ink: "#1a1a1a", paper: "#ffffff", accent: "#ffcc00", accent2: "#e3000b",
    palette: ["#e3000b", "#ffcc00", "#0055bf", "#ffffff", "#237841"],
    font: JP, weight: 900,
    caption: { kind: "stroke", fill: "#ffffff", stroke: "#0b2a55", y: 0.76, size: 0.06 },
    fx: [], defaultSet: "brick-sky", setMap: { "*": "brick-sky" }, transition: "pop", stroke: 0.01,
    best: ["stage", "card"]
  }),
  "retro-console": S({
    id: "retro-console", name: "レトロ3Dゲーム", engine: "3d", figure: "lowpoly", look: "ps2",
    bg: "#2b3a5a", ink: "#111111", paper: "#ffffff", accent: "#ffd23f", accent2: "#5be0ff",
    palette: ["#ff8a3d", "#3b5f8f", "#c9d6e8", "#2c3e2c"],
    font: JP, weight: 900,
    caption: { kind: "box", fill: "#ffffff", box: "rgba(0,0,0,0.6)", y: 0.76, size: 0.046 },
    fx: [], defaultSet: "backyard-night", setMap: { "*": "backyard-night" }, transition: "fade", stroke: 0.01,
    best: ["stage", "card"]
  }),
  "block-horror": S({
    id: "block-horror", name: "ブロックホラー", engine: "3d", figure: "voxel", look: "horror",
    bg: "#050507", ink: "#000000", paper: "#d8d8d8", accent: "#ffffff", accent2: "#c21d1d",
    palette: ["#1a1a22", "#2a2a33", "#c21d1d"],
    font: JP, weight: 900,
    caption: { kind: "plain", fill: "#e8e8e8", y: 0.76, size: 0.05 },
    fx: [], defaultSet: "dark-corridor", setMap: { "*": "dark-corridor" }, transition: "fade", stroke: 0.01,
    best: ["stage", "card"]
  }),
  clay: S({
    id: "clay", name: "クレイアニメ", engine: "3d", figure: "clay", look: "clay",
    bg: "#bfe3ff", ink: "#2a2a2a", paper: "#ffffff", accent: "#ff7a2f", accent2: "#3f86e0",
    palette: ["#ff7a2f", "#3f86e0", "#ffd23f", "#7ac36a", "#f4f1ea"],
    font: JP, weight: 900,
    caption: { kind: "stroke", fill: "#ffffff", stroke: "#2a2a2a", y: 0.76, size: 0.06 },
    fx: [], defaultSet: "clay-sky", setMap: { "*": "clay-sky" }, transition: "cut", stroke: 0.01,
    best: ["stage", "card"]
  }),
  "game-avatar": S({
    id: "game-avatar", name: "ゲームアバター", engine: "3d", figure: "avatar", look: "toon",
    bg: "#b48cff", ink: "#111111", paper: "#ffffff", accent: "#ffd23f", accent2: "#ff3b5c",
    palette: ["#ffd23f", "#2f6fdb", "#ff3b5c", "#2bb673", "#ffffff"],
    font: JP, weight: 900,
    caption: { kind: "stroke", fill: "#ff3b5c", stroke: "#ffffff", y: 0.66, size: 0.07 },
    fx: [], defaultSet: "avatar-room", setMap: { "*": "avatar-room" }, transition: "pop", stroke: 0.01,
    best: ["stage", "card"]
  })
};

/** The set a style actually draws for a requested (semantic) set name. */
export function mapSet(st: StyleDef, name: string | undefined): string {
  const n = name ?? st.defaultSet;
  return st.setMap?.[n] ?? st.setMap?.["*"] ?? n;
}

export function styleFor(id: string, overrides?: Record<string, unknown>): StyleDef {
  const s = STYLES[id];
  if (!s) throw new Error(`Unknown style: ${id}. Known: ${Object.keys(STYLES).join(", ")}`);
  return overrides ? { ...s, ...(overrides as Partial<StyleDef>), caption: { ...s.caption, ...((overrides.caption as object) ?? {}) } } : s;
}

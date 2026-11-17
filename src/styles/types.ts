/**
 * Style Shorts — compiled timeline contract.
 * tools/styles/render-style.mjs turns productions/<id>/styled.json into this; src/styles/main.ts draws it.
 */

export type At = number | string;

export interface ActorSpec {
  id: string;
  /** horizontal position, -1 (left edge) .. 1 (right edge); 3D maps it onto the set */
  x?: number;
  /** vertical offset in figure heights (0 = standing on the ground) */
  y?: number;
  /** depth for 3D (-1 back .. 1 front) */
  z?: number;
  scale?: number;
  /** pose name, or timed changes [[at, pose], ...] */
  pose?: string | [At, string][];
  face?: string | [At, string][];
  /** small symbol above the head: ! ? ... heart sweat anger idea zzz */
  emote?: string | [At, string][];
  /** move during the beat */
  to?: { x?: number; y?: number; z?: number; at?: At; until?: At };
  /** colour of body / shirt (style decides how it is used) */
  color?: string;
  /** accent: hair / cap / hood colour */
  accent?: string;
  /** facing: 1 right, -1 left */
  facing?: number;
  /** speaks the narration: mouth flaps on the voice syllables */
  talks?: boolean;
  /** hair / hat silhouette: none spiky cap bob bun hood */
  hair?: string;
  /** what the actor holds in the right hand: an icon name */
  holds?: string;
  /** resolved by the compiler: start x/y/z (from the previous beat when continuing) */
  x0?: number; y0?: number; z0?: number;
}

export interface PropSpec {
  kind: string;
  x?: number;
  y?: number;
  z?: number;
  scale?: number;
  rot?: number;
  color?: string;
  label?: string;
  to?: { x?: number; y?: number; z?: number; scale?: number; rot?: number; at?: At; until?: At };
  /** appear at this moment (pop in) */
  at?: At;
}

export interface Visual {
  scene: "stage" | "chart" | "counter" | "diagram" | "card" | "list" | "path" | "route" | "exploded" | "quote";
  /** stage */
  set?: string;
  setParams?: Record<string, unknown>;
  actors?: ActorSpec[];
  props?: PropSpec[];
  camera?: { zoom?: number; x?: number; y?: number; shake?: number; to?: { zoom?: number; x?: number; y?: number }; angle?: string };
  /** chart */
  type?: "line" | "bar";
  points?: [number | string, number][];
  bars?: { label: string; value: number; color?: string; icon?: string }[];
  /** counter / card */
  from?: number;
  to?: number;
  unit?: string;
  format?: "int" | "comma" | "short" | "decimal1" | "percent";
  label?: string;
  text?: string;
  sub?: string;
  icon?: string;
  /** diagram */
  nodes?: { id: string; label?: string; icon?: string; x: number; y: number; color?: string; at?: At }[];
  edges?: { from: string; to: string; label?: string; at?: At }[];
  /** list */
  title?: string;
  items?: (string | { text: string; icon?: string })[];
  /** path */
  shape?: string;
  /** route */
  eta?: string;
  /** exploded */
  layers?: { label: string; color?: string; detail?: string }[];
  object?: string;
  /** quote */
  author?: string;
  /** small label in a corner (chip) for the duration of this scene */
  chip?: string;
  transition?: string;
  /** resolved by the compiler */
  start?: number;
  end?: number;
  lineStart?: number;
  lineEnd?: number;
  index?: number;
}

export interface StyledLine {
  id: string;
  who: string;
  text: string;
  start: number;
  end: number;
  moras: [number, number][];
  chunks: { text: string; start: number; end: number }[];
}

export interface StyledTimeline {
  meta: { id: string; title: string; fps: number; width: number; height: number; duration: number };
  style: string;
  /** production-level overrides of the style theme (palette etc.) */
  theme?: Record<string, unknown>;
  scenes: Visual[];
  lines: StyledLine[];
  captions?: { y?: number; size?: number; off?: boolean };
  overlay?: { text: string; start: number; end: number } | null;
  titleCard?: { text: string; start: number; end: number; style?: "card" | "band"; label?: string } | null;
}

import type { CharacterStyle } from "./Character";
import type { CameraPreset } from "./sets";

/** Compiled, absolute-time timeline produced by tools/three/compile.mjs. */
export interface Transform { x?: number; y?: number; z?: number; rx?: number; ry?: number; rz?: number; s?: number }

export interface TimelineEvent {
  t: number;
  dur: number;
  channel: "pose" | "root" | "look" | "face" | "tf" | "vis" | "param" | "wiggle";
  target: string;
  to: Record<string, number | string>;
  ease?: "linear" | "inOut" | "out" | "in" | "back";
  arc?: number;
}

export interface CompiledLine {
  id: string;
  who: string;
  text: string;
  start: number;
  end: number;
  moras: [number, number][];
  chunks: { text: string; start: number; end: number }[];
}

export interface Shot { start: number; end: number; cam: string; push?: number }

export interface Timeline {
  meta: { id: string; title: string; fps: number; width: number; height: number; duration: number };
  set: { kind: string; params?: Record<string, unknown> };
  cameras?: Record<string, CameraPreset>;
  actors: Record<string, { style?: CharacterStyle; vrm?: string; figure?: "akabeko" | "chibi"; figureParams?: { body?: string; pattern?: string }; cast?: string; height?: number; turn?: number; root: { x: number; y?: number; z: number; ry?: number }; pose?: string; look?: { yaw?: number; pitch?: number }; expr?: string; seed?: number; captionColor?: string }>;
  props: Record<string, { kind: string; params?: Record<string, unknown>; tf: Transform; visible?: boolean }>;
  lines: CompiledLine[];
  events: TimelineEvent[];
  shots: Shot[];
  captions?: { y?: number; size?: number };
  overlay?: { text: string; start: number; end: number } | null;
  titleCard?: { text: string; start: number; end: number; style?: "card" | "band"; label?: string } | null;
}

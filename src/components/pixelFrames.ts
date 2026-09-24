import type { ActorArchetype, ActorPose } from "../core/types";
export type PixelFrame = readonly string[];

const IDLE: PixelFrame = [
  "...HHHH...", "..HHHHHH..", "..HSSSSH..", "..HSSSSH..", "...SSSS...",
  "....T.....", "..JJTJJ...", ".JJJTJJJ..", ".J.JT.J...", "...PP.....",
  "..PPPP....", "..P..P....", ".PP..PP...", ".........."
];
const WALK_A: PixelFrame = [
  "...HHHH...", "..HHHHHH..", "..HSSSSH..", "..HSSSSH..", "...SSSS...",
  "....T.....", "..JJTJJ...", ".JJJTJJJ..", "...JT.J...", "...PP.....",
  "..PPPP....", "...P.P....", "..PP..P...", ".........."
];
const WALK_B: PixelFrame = [
  "...HHHH...", "..HHHHHH..", "..HSSSSH..", "..HSSSSH..", "...SSSS...",
  "....T.....", "..JJTJJ...", ".JJJTJJJ..", ".J.JTJ....", "...PP.....",
  "..PPPP....", "..P.P.....", ".P..PP....", ".........."
];
const SURPRISED: PixelFrame = [
  "...HHHH...", "..HHHHHH..", "..HWWSWH..", "..HSSSSH..", "...SSSS...",
  "....T.....", ".JJJTJJJ..", "J.JJTJJ.J.", "...JT.....", "...PP.....",
  "..PPPP....", "..P..P....", ".PP..PP...", ".........."
];
const DEAD_INSIDE: PixelFrame = [
  "...HHHH...", "..HHHHHH..", "..HSSSSH..", "..HSSSSH..", "...SSSS...",
  "..........", "..JJTJJ...", ".JJJTJJJ..", ".J.JT.J...", "...PP.....",
  "..PPPP....", "..P..P....", ".PP..PP...", ".........."
];

export const PIXEL_FRAMES: Record<ActorPose, PixelFrame> = {
  idle: IDLE, "walk-a": WALK_A, "walk-b": WALK_B, surprised: SURPRISED, "dead-inside": DEAD_INSIDE
};

export const PALETTES: Record<ActorArchetype, Record<string, number>> = {
  salaryman: { H: 0x171923, S: 0xe5b08f, W: 0xffffff, J: 0xd7dce5, T: 0xb33a42, P: 0x27334a },
  boss: { H: 0x3d3027, S: 0xd9a27f, W: 0xffffff, J: 0x33343f, T: 0x7a2030, P: 0x1f2029 },
  robot: { H: 0x102431, S: 0x7de7f2, W: 0xf5ffff, J: 0x6e8ea3, T: 0x00d9ff, P: 0x243b4a }
};

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
  robot: { H: 0x102431, S: 0x7de7f2, W: 0xf5ffff, J: 0x6e8ea3, T: 0x00d9ff, P: 0x243b4a },
  "worker-m": {H:2170923,S:15712673,W:15069170,J:4548261,T:13522529,P:2635342},
  "worker-f": {H:5910829,S:16172965,W:15069688,J:6186639,T:15556989,P:3749456},
  "manager": {H:5853776,S:14460799,W:15064275,J:2632498,T:11093056,P:2237486},
  "clerk": {H:6502187,S:15844512,W:16115923,J:11752258,T:16110711,P:3817544},
  "student-m": {H:1777706,S:15845038,W:15726067,J:3101809,T:6204106,P:2700859},
  "student-f": {H:3156269,S:15844256,W:16246234,J:10117241,T:15389042,P:4407387},
  "old-man": {H:11975105,S:15580563,W:16118244,J:7435898,T:7311789,P:7169893},
  "old-woman": {H:13025979,S:15846571,W:16314338,J:8944006,T:11493472,P:4669517},
  "nerd": {H:2499372,S:15253408,W:15659751,J:7765127,T:6135995,P:3686486},
  "gal": {H:14991208,S:15248515,W:16113890,J:12145029,T:16766043,P:5586541},
  "worker-exhausted": {H:2370611,S:13547174,W:13686236,J:5592934,T:9537675,P:3422016},
  "host": {H:1587529,S:8576492,W:15202556,J:3430252,T:6542546,P:1387582},

};

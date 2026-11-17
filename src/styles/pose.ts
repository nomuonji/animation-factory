/**
 * Shared skeleton poses for every Style Shorts figure (2D stick/paper/pixel… and 3D voxel/clay/brick…).
 *
 * Angles are degrees in the picture plane: 0 = straight down, 90 = towards screen right,
 * -90 = towards screen left, 180 = straight up. "l" is the limb on screen-left.
 * Arm and leg segments are absolute directions (not relative to the parent), which keeps
 * hand-authored poses readable.
 */
export interface Pose {
  lean: number;      // torso tilt from vertical (positive leans to screen right)
  head: number;      // head tilt
  la1: number; la2: number; ra1: number; ra2: number;
  ll1: number; ll2: number; rl1: number; rl2: number;
  drop: number;      // hip drop as a fraction of leg length (crouch / sit)
  lift: number;      // whole body lift in figure heights (jump)
  swing: number;     // forward/back limb swing for 3D figures (-1..1), walk/run phase
}

const P = (o: Partial<Pose>): Pose => ({
  lean: 0, head: 0,
  la1: -12, la2: -6, ra1: 12, ra2: 6,
  ll1: -7, ll2: -4, rl1: 7, rl2: 4,
  drop: 0, lift: 0, swing: 0, ...o
});

export const POSES: Record<string, Pose> = {
  idle: P({}),
  stand: P({}),
  wave: P({ ra1: 135, ra2: 165 }),
  point: P({ ra1: 92, ra2: 92 }),
  "point-left": P({ la1: -92, la2: -92 }),
  "point-up": P({ ra1: 160, ra2: 175 }),
  think: P({ ra1: 35, ra2: 168, head: 8, la1: -30, la2: 40 }),
  shrug: P({ la1: -55, la2: -140, ra1: 55, ra2: 140, head: -6 }),
  cheer: P({ la1: -155, la2: -170, ra1: 155, ra2: 170, lift: 0 }),
  "arms-up": P({ la1: -165, la2: -175, ra1: 165, ra2: 175 }),
  facepalm: P({ ra1: 30, ra2: 175, head: 14, lean: 4 }),
  "hands-hips": P({ la1: -40, la2: 40, ra1: 40, ra2: -40 }),
  hold: P({ la1: -35, la2: 60, ra1: 35, ra2: -60 }),
  present: P({ la1: -30, la2: -15, ra1: 70, ra2: 115 }),
  shock: P({ la1: -120, la2: -150, ra1: 120, ra2: 150, head: 0, ll1: -16, rl1: 16 }),
  sad: P({ la1: -4, la2: -2, ra1: 4, ra2: 2, head: 18, lean: 6 }),
  sit: P({ ll1: -80, ll2: 0, rl1: 80, rl2: 0, drop: 0.55, la1: -25, la2: 30, ra1: 25, ra2: -30 }),
  crouch: P({ ll1: -45, ll2: 25, rl1: 45, rl2: -25, drop: 0.3, la1: -40, la2: -10, ra1: 40, ra2: 10, lean: 6 }),
  bow: P({ lean: 35, head: 20, la1: 10, la2: 10, ra1: 25, ra2: 25 }),
  lying: P({ lean: 90, head: 90, la1: 80, la2: 85, ra1: 100, ra2: 95, ll1: -88, ll2: -90, rl1: -95, rl2: -92, drop: 0.95 }),
  // looping actions: base pose, animated by cycle()
  walk: P({}),
  run: P({ lean: 12 }),
  jump: P({}),
  dance: P({}),
  panic: P({}),
  "wave-loop": P({}),
  talk: P({}),
  fly: P({ la1: -95, la2: -95, ra1: 95, ra2: 95, ll1: -12, ll2: -18, rl1: 12, rl2: 18 })
};

const s = Math.sin;

/** Animated poses: returns the pose for time t (seconds, global so loops stay continuous). */
function cycle(name: string, t: number, base: Pose): Pose {
  const p = { ...base };
  switch (name) {
    case "walk": {
      const w = s(t * Math.PI * 2 * 1.6);
      p.ll1 = -22 * w; p.ll2 = p.ll1 + (w > 0 ? -18 * w : 0);
      p.rl1 = 22 * w; p.rl2 = p.rl1 + (w < 0 ? 18 * w : 0);
      p.la1 = -8 + 20 * w; p.la2 = p.la1 + 12;
      p.ra1 = 8 - 20 * w; p.ra2 = p.ra1 - 12;
      p.lift = Math.abs(s(t * Math.PI * 2 * 1.6)) * 0.015;
      p.swing = w;
      return p;
    }
    case "run": {
      const w = s(t * Math.PI * 2 * 2.6);
      p.ll1 = -42 * w; p.ll2 = p.ll1 + (w > 0 ? -55 * w : 10 * w);
      p.rl1 = 42 * w; p.rl2 = p.rl1 + (w < 0 ? 55 * w : 10 * w);
      p.la1 = 50 * w - 10; p.la2 = p.la1 + 85;
      p.ra1 = -50 * w + 10; p.ra2 = p.ra1 - 85;
      p.lift = Math.abs(w) * 0.04;
      p.swing = w;
      return p;
    }
    case "jump": {
      const ph = (t * 1.25) % 1;
      const up = Math.max(0, s(ph * Math.PI));
      p.lift = up * 0.35;
      const tuck = up > 0.2 ? 1 : up / 0.2;
      p.ll1 = -20 * tuck; p.ll2 = 30 * tuck; p.rl1 = 20 * tuck; p.rl2 = -30 * tuck;
      p.la1 = -150 * tuck - 10; p.la2 = p.la1 - 10; p.ra1 = 150 * tuck + 10; p.ra2 = p.ra1 + 10;
      return p;
    }
    case "dance": {
      const w = s(t * Math.PI * 2 * 1.8);
      p.lean = 10 * w; p.head = -8 * w;
      p.la1 = -120 + 40 * w; p.la2 = p.la1 - 30; p.ra1 = 60 + 50 * w; p.ra2 = p.ra1 + 40;
      p.ll1 = -12 + 8 * w; p.rl1 = 12 + 8 * w; p.ll2 = p.ll1; p.rl2 = p.rl1;
      p.drop = 0.08 + 0.06 * Math.abs(w);
      return p;
    }
    case "panic": {
      const w = s(t * Math.PI * 2 * 4.2), v = s(t * Math.PI * 2 * 3.1 + 1);
      p.la1 = -140 + 30 * w; p.la2 = p.la1 - 25 * v; p.ra1 = 140 - 30 * v; p.ra2 = p.ra1 + 25 * w;
      p.ll1 = -18 * w; p.rl1 = 18 * w; p.ll2 = p.ll1; p.rl2 = p.rl1;
      p.lift = Math.abs(w) * 0.03; p.head = 6 * v;
      return p;
    }
    case "wave-loop": {
      const w = s(t * Math.PI * 2 * 2.2);
      p.ra1 = 140; p.ra2 = 160 + 25 * w; return p;
    }
    case "talk": {
      const w = s(t * Math.PI * 2 * 0.9), v = s(t * Math.PI * 2 * 1.4 + 0.7);
      p.ra1 = 45 + 15 * w; p.ra2 = 100 + 25 * v; p.la1 = -20 - 8 * v; p.la2 = -10; p.head = 4 * w; return p;
    }
    case "fly": {
      const w = s(t * Math.PI * 2 * 1.2);
      p.lift = 0.05 * w; p.ll1 = -12 + 6 * w; p.rl1 = 12 - 6 * w; return p;
    }
    default:
      return p;
  }
}

export function poseAt(name: string, t: number): Pose {
  const base = POSES[name] ?? POSES.idle!;
  const p = cycle(name, t, base);
  // idle breathing so a still figure never looks frozen
  if (["idle", "stand", "point", "think", "hands-hips", "hold", "present", "point-left", "point-up", "wave", "shrug", "sad"].includes(name)) {
    const b = s(t * Math.PI * 2 * 0.45);
    p.head += 1.5 * b; p.la2 += 2 * b; p.ra2 -= 2 * b;
  }
  return p;
}

export function mixPose(a: Pose, b: Pose, k: number): Pose {
  const o = { ...a };
  for (const key of Object.keys(a) as (keyof Pose)[]) o[key] = a[key] + (b[key] - a[key]) * k;
  return o;
}

export const ease = {
  inOut: (x: number) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2),
  out: (x: number) => 1 - (1 - x) ** 3,
  back: (x: number) => 1 + 2.2 * (x - 1) ** 3 + 1.2 * (x - 1) ** 2,
  clamp: (x: number) => Math.max(0, Math.min(1, x))
};

/** Limb geometry shared by 2D and 3D: returns joint points in figure units (height ≈ 1, y down, origin at the feet). */
export interface Joints {
  hip: [number, number]; neck: [number, number]; head: [number, number];
  le: [number, number]; lh: [number, number]; re: [number, number]; rh: [number, number];
  lk: [number, number]; lf: [number, number]; rk: [number, number]; rf: [number, number];
  shoulder: [number, number];
}

export const BODY = { leg: 0.21, torso: 0.3, arm: 0.17, headR: 0.1 };

export function joints(p: Pose, B = BODY): Joints {
  const d = (deg: number): [number, number] => [Math.sin((deg * Math.PI) / 180), Math.cos((deg * Math.PI) / 180)];
  const add = (a: [number, number], v: [number, number], len: number): [number, number] => [a[0] + v[0] * len, a[1] + v[1] * len];
  const legLen = B.leg * 2;
  const hip: [number, number] = [0, -legLen * (1 - p.drop * 0.85) - p.lift];
  const neck = add(hip, d(180 + p.lean), B.torso);
  const shoulder = add(hip, d(180 + p.lean), B.torso * 0.92);
  const head = add(neck, d(180 + p.lean + p.head), B.headR * 1.15);
  const le = add(shoulder, d(p.la1), B.arm), lh = add(le, d(p.la2), B.arm);
  const re = add(shoulder, d(p.ra1), B.arm), rh = add(re, d(p.ra2), B.arm);
  const lk = add(hip, d(p.ll1), B.leg), lf = add(lk, d(p.ll2), B.leg);
  const rk = add(hip, d(p.rl1), B.leg), rf = add(rk, d(p.rl2), B.leg);
  return { hip, neck, head, le, lh, re, rh, lk, lf, rk, rf, shoulder };
}

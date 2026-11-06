import * as THREE from "three";
import { Character, EXPRESSIONS, POSES, type FaceState, type Joints } from "./Character";
import { PROPS, type Prop } from "./props";
import { SETS, type CameraPreset } from "./sets";
import type { Timeline, TimelineEvent } from "./types";

type Val = Record<string, number>;

const EASE: Record<string, (u: number) => number> = {
  linear: (u) => u,
  inOut: (u) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2),
  out: (u) => 1 - Math.pow(1 - u, 3),
  in: (u) => u * u * u,
  back: (u) => { const c = 1.6; return 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2); }
};

interface Seg { t: number; dur: number; from: Val; to: Val; ease: (u: number) => number; arc: number }

/** Tween channel evaluated from scratch for any t (deterministic, order-independent). */
class Channel {
  private evs: TimelineEvent[] = [];
  constructor(private init: Val, private resolve: (e: TimelineEvent) => Val) {}
  add(e: TimelineEvent) { this.evs.push(e); this.evs.sort((a, b) => a.t - b.t); }
  at(t: number): Val {
    let seg: Seg | null = null;
    for (const e of this.evs) {
      if (e.t > t) break;
      const from: Val = seg ? valueAt(seg, e.t) : { ...this.init };
      seg = { t: e.t, dur: e.dur, from, to: { ...from, ...this.resolve(e) }, ease: EASE[e.ease ?? "inOut"]!, arc: e.arc ?? 0 };
    }
    return seg ? valueAt(seg, t) : { ...this.init };
  }
}

function valueAt(s: Seg, t: number): Val {
  if (s.dur <= 0 || t >= s.t + s.dur) return s.to;
  const u = Math.max(0, (t - s.t) / s.dur);
  const k = s.ease(u);
  const out: Val = {};
  for (const key of Object.keys(s.to)) {
    const a = s.from[key] ?? s.to[key]!, b = s.to[key]!;
    out[key] = a + (b - a) * k;
  }
  if (s.arc && "y" in out) out.y = out.y! + Math.sin(Math.PI * u) * s.arc;
  return out;
}

function numeric(to: Record<string, number | string>): Val {
  const o: Val = {};
  for (const [k, v] of Object.entries(to)) if (typeof v === "number") o[k] = v;
  return o;
}

export class Director3D {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  private actors = new Map<string, { c: Character; ch: { pose: Channel; root: Channel; look: Channel; face: Channel; wiggle: Channel }; seed: number }>();
  private props = new Map<string, { p: Prop; tf: Channel; vis: Channel; param: Channel }>();
  private cameras: Record<string, CameraPreset>;

  constructor(readonly tl: Timeline) {
    const set = SETS[tl.set.kind];
    if (!set) throw new Error(`Unknown set: ${tl.set.kind}`);
    const built = set(this.scene, tl.set.params ?? {});
    this.cameras = { ...built.cameras, ...(tl.cameras ?? {}) };
    this.camera = new THREE.PerspectiveCamera(40, tl.meta.width / tl.meta.height, 0.05, 40);

    let seed = 1;
    for (const [id, a] of Object.entries(tl.actors)) {
      const c = new Character(id, a.style);
      this.scene.add(c.root);
      const face0 = { eyes: 1, brow: 0, smile: 0, ...(EXPRESSIONS[a.expr ?? "neutral"] ?? {}) } as Val;
      const ch = {
        pose: new Channel({ ...(POSES[a.pose ?? "idle"] ?? POSES.idle!) }, (e) => ({ ...(typeof e.to.pose === "string" ? POSES[e.to.pose] ?? {} : {}), ...numeric(e.to) })),
        root: new Channel({ x: a.root.x, y: a.root.y ?? 0, z: a.root.z, ry: a.root.ry ?? 0 }, (e) => numeric(e.to)),
        look: new Channel({ yaw: a.look?.yaw ?? 0, pitch: a.look?.pitch ?? 0 }, (e) => numeric(e.to)),
        face: new Channel(face0, (e) => ({ ...(typeof e.to.expr === "string" ? (EXPRESSIONS[e.to.expr] as Val) ?? {} : {}), ...numeric(e.to) })),
        wiggle: new Channel({ w: 0 }, (e) => numeric(e.to))
      };
      this.actors.set(id, { c, ch, seed: a.seed ?? seed++ });
    }
    for (const [id, pr] of Object.entries(tl.props)) {
      const b = PROPS[pr.kind];
      if (!b) throw new Error(`Unknown prop kind: ${pr.kind}`);
      const p = b(pr.params ?? {});
      this.scene.add(p.object);
      const tf0 = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, s: 1, ...pr.tf } as Val;
      this.props.set(id, { p, tf: new Channel(tf0, (e) => numeric(e.to)), vis: new Channel({ v: pr.visible === false ? 0 : 1 }, (e) => numeric(e.to)), param: new Channel({}, (e) => numeric(e.to)) });
    }
    for (const e of tl.events) {
      const a = this.actors.get(e.target);
      if (a) {
        const ch = (a.ch as Record<string, Channel>)[e.channel];
        if (!ch) throw new Error(`Channel ${e.channel} not valid for actor ${e.target}`);
        ch.add(e);
        continue;
      }
      const p = this.props.get(e.target);
      if (!p) throw new Error(`Unknown event target: ${e.target}`);
      if (e.channel === "tf") p.tf.add(e);
      else if (e.channel === "vis") p.vis.add({ ...e, dur: 0 });
      else if (e.channel === "param") p.param.add(e);
      else throw new Error(`Channel ${e.channel} not valid for prop ${e.target}`);
    }
  }

  shotAt(t: number) {
    const shots = this.tl.shots;
    let s = shots[0]!;
    for (const x of shots) if (x.start <= t + 1e-6) s = x;
    return s;
  }

  update(t: number) {
    // camera
    const shot = this.shotAt(t);
    const preset = this.cameras[shot.cam];
    if (!preset) throw new Error(`Unknown camera: ${shot.cam}`);
    const pos = new THREE.Vector3(...preset.pos);
    const target = new THREE.Vector3(...preset.target);
    if (shot.push) {
      const u = Math.min(1, Math.max(0, (t - shot.start) / Math.max(0.01, shot.end - shot.start)));
      pos.lerp(target, shot.push * EASE.inOut!(u));
    }
    this.camera.fov = preset.fov ?? 40;
    this.camera.position.copy(pos);
    this.camera.lookAt(target);
    this.camera.updateProjectionMatrix();

    // speaking state
    const speaking = new Map<string, { open: number; nod: number }>();
    for (const l of this.tl.lines) {
      if (t < l.start || t > l.end) continue;
      let open = 0;
      for (const [s, e] of l.moras) if (t >= s && t <= e) { open = 0.25 + 0.75 * Math.sin(Math.PI * (t - s) / Math.max(0.01, e - s)); break; }
      speaking.set(l.who, { open, nod: Math.sin((t - l.start) * 5.2) * 0.02 });
    }

    for (const [id, a] of this.actors) {
      const face = a.ch.face.at(t) as unknown as FaceState;
      const period = 2.9 + (a.seed % 5) * 0.37;
      const ph = (t + a.seed * 1.7) % period;
      const blink = ph < 0.14 ? 1 - Math.sin(Math.PI * ph / 0.14) : 1;
      const sp = speaking.get(id);
      const look = a.ch.look.at(t);
      a.c.apply({
        root: a.ch.root.at(t) as { x: number; y: number; z: number; ry: number },
        joints: a.ch.pose.at(t) as Joints,
        look: { yaw: look.yaw ?? 0, pitch: (look.pitch ?? 0) + (sp?.nod ?? 0) },
        face: { ...face, eyes: (face.eyes ?? 1) * blink, mouth: sp?.open ?? 0 },
        breath: Math.sin(t * 1.75 + a.seed),
        wiggle: a.ch.wiggle.at(t).w ?? 0,
        time: t
      });
    }
    for (const [, p] of this.props) {
      const v = p.tf.at(t);
      p.p.object.position.set(v.x!, v.y!, v.z!);
      p.p.object.rotation.set(v.rx!, v.ry!, v.rz!);
      p.p.object.scale.setScalar(v.s!);
      p.p.object.visible = (p.vis.at(t).v ?? 1) > 0.5;
      if (p.p.setParam) for (const [k, val] of Object.entries(p.param.at(t))) p.p.setParam(k, val);
    }
  }
}

import * as THREE from "three";
import { canvasTexture, flat, JP_FONT, mesh, toon } from "./toon";

/**
 * Procedural stylised humanoid (about 1.6 m, ~1:4.5 head ratio).
 * Faces +Z locally. Everything that moves is driven by plain numbers so the
 * Director can evaluate any frame deterministically.
 */
export interface CharacterStyle {
  skin?: string;
  hair?: string;
  hairStyle?: "side-part" | "ponytail" | "short" | "bald";
  top?: string;          // shirt / hoodie colour (also sleeves)
  vest?: string | null;  // uniform vest over the top
  vestTrim?: string;
  bottom?: string;
  shoes?: string;
  glasses?: boolean;
  nameTag?: string | null;
  hood?: boolean;
  height?: number;       // scale multiplier
}

export type Joints = Record<string, number>;

export const JOINT_NAMES = [
  "spineX", "spineY", "shoulderLX", "shoulderLZ", "elbowL", "shoulderRX", "shoulderRZ", "elbowR",
  "wristL", "wristR"
] as const;

/** Named poses. Angles in radians. Arms hang along -Y; negative X raises forward. */
export const POSES: Record<string, Joints> = {
  idle:        { spineX: 0, spineY: 0, shoulderLX: 0.05, shoulderLZ: 0.08, elbowL: -0.15, shoulderRX: 0.05, shoulderRZ: -0.08, elbowR: -0.15, wristL: 0, wristR: 0 },
  counter:     { spineX: 0.06, spineY: 0, shoulderLX: -0.55, shoulderLZ: 0.12, elbowL: -1.05, shoulderRX: -0.55, shoulderRZ: -0.12, elbowR: -1.05, wristL: 0, wristR: 0 },
  "hold-doc":  { spineX: 0.02, spineY: 0, shoulderLX: -0.75, shoulderLZ: 0.18, elbowL: -1.35, shoulderRX: -0.75, shoulderRZ: -0.18, elbowR: -1.35, wristL: 0.2, wristR: 0.2 },
  "lift-doc":  { spineX: -0.02, spineY: 0, shoulderLX: -1.05, shoulderLZ: 0.22, elbowL: -1.25, shoulderRX: -1.05, shoulderRZ: -0.22, elbowR: -1.25, wristL: 0.3, wristR: 0.3 },
  point:       { spineX: 0.12, spineY: 0.05, shoulderLX: -0.5, shoulderLZ: 0.12, elbowL: -1.0, shoulderRX: -0.95, shoulderRZ: -0.05, elbowR: -0.55, wristL: 0, wristR: -0.2 },
  "stamp-up":  { spineX: 0.08, spineY: 0.05, shoulderLX: -0.5, shoulderLZ: 0.12, elbowL: -1.0, shoulderRX: -1.25, shoulderRZ: -0.1, elbowR: -1.45, wristL: 0, wristR: 0.2 },
  "stamp-down":{ spineX: 0.16, spineY: 0.05, shoulderLX: -0.5, shoulderLZ: 0.12, elbowL: -1.0, shoulderRX: -0.9, shoulderRZ: -0.08, elbowR: -0.7, wristL: 0, wristR: 0 },
  give:        { spineX: 0.1, spineY: 0, shoulderLX: 0.05, shoulderLZ: 0.08, elbowL: -0.15, shoulderRX: -1.1, shoulderRZ: -0.02, elbowR: -0.35, wristL: 0, wristR: 0 },
  sign:        { spineX: 0.22, spineY: -0.08, shoulderLX: -0.6, shoulderLZ: 0.15, elbowL: -1.1, shoulderRX: -0.85, shoulderRZ: -0.05, elbowR: -0.95, wristL: 0, wristR: 0.1 },
  "hand-up":   { spineX: 0, spineY: 0, shoulderLX: 0.05, shoulderLZ: 0.08, elbowL: -0.15, shoulderRX: -0.75, shoulderRZ: -0.1, elbowR: -1.6, wristL: 0, wristR: 0.4 },
  "bow":       { spineX: 0.38, spineY: 0, shoulderLX: 0.15, shoulderLZ: 0.04, elbowL: -0.1, shoulderRX: 0.15, shoulderRZ: -0.04, elbowR: -0.1, wristL: 0, wristR: 0 }
};

export interface FaceState { eyes: number; brow: number; mouth: number; smile: number; }

export const EXPRESSIONS: Record<string, Partial<FaceState>> = {
  neutral: { eyes: 1, brow: 0, smile: 0 },
  blank: { eyes: 0.82, brow: -0.05, smile: 0 },
  polite: { eyes: 0.9, brow: 0.08, smile: 0.5 },
  surprised: { eyes: 1.25, brow: 0.35, smile: -0.1 },
  doubtful: { eyes: 0.72, brow: -0.25, smile: -0.25 },
  weary: { eyes: 0.6, brow: -0.15, smile: -0.35 }
};

export class Character {
  readonly root = new THREE.Group();
  private hips = new THREE.Group();
  private spine = new THREE.Group();
  private neck = new THREE.Group();
  readonly head = new THREE.Group();
  private shoulderL = new THREE.Group();
  private shoulderR = new THREE.Group();
  private elbowL = new THREE.Group();
  private elbowR = new THREE.Group();
  private handL = new THREE.Group();
  private handR = new THREE.Group();
  private eyeL!: THREE.Mesh;
  private eyeR!: THREE.Mesh;
  private browL!: THREE.Mesh;
  private browR!: THREE.Mesh;
  private mouth!: THREE.Mesh;
  private mouthInner!: THREE.Mesh;
  private chest!: THREE.Object3D;

  constructor(readonly id: string, readonly style: CharacterStyle) {
    const s = {
      skin: "#f2c9a8", hair: "#2a2226", hairStyle: "short", top: "#f4f2ee", vest: null, vestTrim: "#ffffff",
      bottom: "#3a3d4a", shoes: "#2b2b30", glasses: false, nameTag: null, hood: false, height: 1, ...style
    } as Required<CharacterStyle>;
    const skin = toon(s.skin);
    const top = toon(s.top);

    this.root.add(this.hips);
    this.hips.position.y = 0.82;

    // legs
    for (const side of [-1, 1]) {
      const leg = mesh(new THREE.CapsuleGeometry(0.065, 0.62, 4, 10), toon(s.bottom));
      leg.position.set(0.085 * side, -0.4, 0);
      this.hips.add(leg);
      const shoe = mesh(new THREE.BoxGeometry(0.11, 0.07, 0.2, 2, 1, 2), toon(s.shoes));
      shoe.position.set(0.085 * side, -0.79, 0.035);
      this.hips.add(shoe);
    }
    const pelvis = mesh(new THREE.CapsuleGeometry(0.15, 0.06, 4, 12), toon(s.bottom));
    pelvis.scale.set(1.12, 1, 0.78);
    this.hips.add(pelvis);

    this.hips.add(this.spine);
    this.spine.position.y = 0.05;
    const torso = mesh(new THREE.CapsuleGeometry(0.17, 0.3, 6, 16), top);
    torso.scale.set(1.08, 1, 0.74);
    torso.position.y = 0.25;
    this.spine.add(torso);
    this.chest = torso;

    if (s.vest) {
      const vestMat = toon(s.vest);
      const vest = mesh(new THREE.CapsuleGeometry(0.178, 0.26, 6, 16, 1), vestMat);
      vest.scale.set(1.09, 0.98, 0.77);
      vest.position.y = 0.235;
      this.spine.add(vest);
      // collar V of shirt showing at the front
      const v = mesh(new THREE.ConeGeometry(0.06, 0.13, 3), top, 0.004);
      v.rotation.set(Math.PI, 0, 0);
      v.position.set(0, 0.43, 0.118);
      v.scale.set(1, 1, 0.25);
      this.spine.add(v);
      const trim = mesh(new THREE.BoxGeometry(0.012, 0.3, 0.012), toon(s.vestTrim), false);
      trim.position.set(0, 0.24, 0.135);
      this.spine.add(trim);
    }
    if (s.hood) {
      const hood = mesh(new THREE.TorusGeometry(0.11, 0.05, 8, 16, Math.PI * 1.4), top);
      hood.rotation.set(Math.PI / 2 + 0.25, 0, Math.PI * 0.8);
      hood.position.set(0, 0.47, -0.05);
      this.spine.add(hood);
      for (const side of [-1, 1]) {
        const cord = mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.12), flat("#e8e4dc"), false);
        cord.position.set(0.035 * side, 0.36, 0.13);
        this.spine.add(cord);
      }
    }
    if (s.nameTag) {
      const tex = canvasTexture(256, 96, (g, w, h) => {
        g.fillStyle = "#ffffff"; g.fillRect(0, 0, w, h);
        g.fillStyle = "#1b1b1b"; g.font = `bold 58px ${JP_FONT}`; g.textAlign = "center"; g.textBaseline = "middle";
        g.fillText(s.nameTag!, w / 2, h / 2 + 3);
      });
      const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.085, 0.032), new THREE.MeshBasicMaterial({ map: tex }));
      tag.position.set(-0.075, 0.37, 0.134);
      tag.rotation.y = -0.18;
      this.spine.add(tag);
    }

    // arms
    const arm = (sh: THREE.Group, el: THREE.Group, hand: THREE.Group, side: number) => {
      sh.position.set(0.215 * side, 0.4, 0);
      this.spine.add(sh);
      const upper = mesh(new THREE.CapsuleGeometry(0.048, 0.2, 4, 10), top);
      upper.position.y = -0.13;
      sh.add(upper);
      el.position.y = -0.27;
      sh.add(el);
      const fore = mesh(new THREE.CapsuleGeometry(0.043, 0.18, 4, 10), top);
      fore.position.y = -0.11;
      el.add(fore);
      hand.position.y = -0.24;
      el.add(hand);
      const palm = mesh(new THREE.SphereGeometry(0.048, 12, 10), skin);
      palm.scale.set(0.95, 1.12, 0.7);
      hand.add(palm);
      const thumb = mesh(new THREE.CapsuleGeometry(0.014, 0.03, 2, 6), skin, 0.004);
      thumb.position.set(-0.035 * side, 0.005, 0.02);
      thumb.rotation.z = 0.6 * side;
      hand.add(thumb);
    };
    arm(this.shoulderL, this.elbowL, this.handL, 1);
    arm(this.shoulderR, this.elbowR, this.handR, -1);

    // neck + head
    this.neck.position.y = 0.5;
    this.spine.add(this.neck);
    const neckMesh = mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.09, 12), skin);
    neckMesh.position.y = 0.02;
    this.neck.add(neckMesh);
    this.head.position.y = 0.17;
    this.neck.add(this.head);
    const skull = mesh(new THREE.SphereGeometry(0.165, 32, 24), skin, 0.007);
    skull.scale.set(1, 1.06, 0.98);
    this.head.add(skull);
    for (const side of [-1, 1]) {
      const ear = mesh(new THREE.SphereGeometry(0.035, 10, 8), skin, 0.005);
      ear.scale.set(0.5, 1, 0.8);
      ear.position.set(0.162 * side, -0.01, 0);
      this.head.add(ear);
    }
    const nose = mesh(new THREE.SphereGeometry(0.018, 10, 8), toon(shade(s.skin, -0.08)), false);
    nose.position.set(0, -0.025, 0.163);
    this.head.add(nose);

    const eyeMat = flat("#17141a");
    const eye = () => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.019, 12, 10), eyeMat); e.scale.set(0.9, 1.25, 0.4); return e; };
    this.eyeL = eye(); this.eyeL.position.set(0.058, 0.018, 0.152);
    this.eyeR = eye(); this.eyeR.position.set(-0.058, 0.018, 0.152);
    this.head.add(this.eyeL, this.eyeR);
    const browMat = flat(shade(s.hair, 0.02));
    this.browL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.009, 0.01), browMat);
    this.browR = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.009, 0.01), browMat);
    this.browL.position.set(0.06, 0.07, 0.152);
    this.browR.position.set(-0.06, 0.07, 0.152);
    this.head.add(this.browL, this.browR);
    this.mouth = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.006, 0.01), flat("#5a2f2f"));
    this.mouth.position.set(0, -0.075, 0.155);
    this.mouthInner = new THREE.Mesh(new THREE.SphereGeometry(0.02, 12, 8), flat("#4a1f24"));
    this.mouthInner.scale.set(1, 0.01, 0.3);
    this.mouthInner.position.set(0, -0.078, 0.153);
    this.head.add(this.mouth, this.mouthInner);

    if (s.glasses) {
      const frame = flat("#222026");
      for (const side of [-1, 1]) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.034, 0.0045, 6, 20), frame);
        ring.scale.set(1.15, 0.85, 1);
        ring.position.set(0.06 * side, 0.018, 0.166);
        this.head.add(ring);
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.004, 0.15), frame);
        arm.position.set(0.155 * side, 0.025, 0.09);
        this.head.add(arm);
      }
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.004, 0.004), frame);
      bridge.position.set(0, 0.025, 0.17);
      this.head.add(bridge);
    }
    this.buildHair(s);

    this.root.scale.setScalar(s.height);
  }

  private buildHair(s: Required<CharacterStyle>) {
    if (s.hairStyle === "bald") return;
    const mat = toon(s.hair);
    // one continuous shell: full crown + sides/back with a window cut for the face
    const R = 0.178;
    const crown = mesh(new THREE.SphereGeometry(R, 32, 12, 0, Math.PI * 2, 0, Math.PI * 0.34), mat, 0.006);
    crown.scale.set(1, 1.04, 1);
    this.head.add(crown);
    const win = 0.82;
    const sides = mesh(new THREE.SphereGeometry(R, 32, 14, Math.PI / 2 + win, Math.PI * 2 - 2 * win, Math.PI * 0.335, Math.PI * (s.hairStyle === "ponytail" ? 0.36 : 0.27)), mat, 0.006);
    sides.scale.set(1, 1.04, 1);
    this.head.add(sides);
    if (s.hairStyle === "side-part") {
      const fringe = mesh(new THREE.CapsuleGeometry(0.05, 0.16, 4, 10), mat, 0.005);
      fringe.rotation.set(0.15, 0, Math.PI / 2 - 0.25);
      fringe.scale.set(0.6, 1, 0.5);
      fringe.position.set(0.035, 0.125, 0.125);
      this.head.add(fringe);
    }
    if (s.hairStyle === "ponytail") {
      for (const side of [-1, 1]) {
        const lock = mesh(new THREE.CapsuleGeometry(0.03, 0.12, 4, 8), mat, 0.005);
        lock.position.set(0.15 * side, -0.02, 0.06);
        lock.rotation.z = 0.12 * side;
        this.head.add(lock);
      }
      const tie = mesh(new THREE.SphereGeometry(0.035, 10, 8), mat, 0.005);
      tie.position.set(0, 0.06, -0.17);
      this.head.add(tie);
      const tail = mesh(new THREE.CapsuleGeometry(0.045, 0.2, 4, 10), mat, 0.006);
      tail.position.set(0, -0.07, -0.2);
      tail.rotation.x = 0.35;
      this.head.add(tail);
    }
  }

  /** Apply a fully resolved state. */
  apply(state: { root: { x: number; y: number; z: number; ry: number }; joints: Joints; look: { yaw: number; pitch: number }; face: FaceState; breath: number; wiggle: number; time: number; mora?: number }) {
    const { root, joints: j, look, face } = state;
    this.root.position.set(root.x, root.y, root.z);
    this.root.rotation.y = root.ry;
    this.spine.rotation.set(j.spineX ?? 0, j.spineY ?? 0, 0);
    this.shoulderL.rotation.set(j.shoulderLX ?? 0, 0, j.shoulderLZ ?? 0);
    this.shoulderR.rotation.set(j.shoulderRX ?? 0, 0, j.shoulderRZ ?? 0);
    this.elbowL.rotation.set(j.elbowL ?? 0, 0, 0);
    const wig = state.wiggle ? Math.sin(state.time * 31) * 0.06 * state.wiggle + Math.sin(state.time * 13) * 0.05 * state.wiggle : 0;
    this.elbowR.rotation.set((j.elbowR ?? 0) + wig, wig * 0.6, 0);
    this.handL.rotation.set(j.wristL ?? 0, 0, 0);
    this.handR.rotation.set(j.wristR ?? 0, 0, wig);
    this.neck.rotation.set(look.pitch - (j.spineX ?? 0) * 0.5, look.yaw, 0);
    this.chest.scale.y = 1 + state.breath * 0.012;
    const eyes = Math.max(0.05, face.eyes);
    this.eyeL.scale.y = this.eyeR.scale.y = 1.25 * eyes;
    const by = 0.07 + face.brow * 0.03;
    this.browL.position.y = this.browR.position.y = by;
    this.browL.rotation.z = -face.brow * 0.25 + face.smile * 0.1;
    this.browR.rotation.z = face.brow * 0.25 - face.smile * 0.1;
    const open = Math.max(0, Math.min(1, face.mouth));
    this.mouthInner.scale.y = 0.01 + open * 0.75;
    this.mouth.scale.x = 1 - open * 0.3 + face.smile * 0.15;
    this.mouth.rotation.z = 0;
    this.mouth.position.y = -0.075 + face.smile * 0.004 + open * 0.008;
    this.mouth.visible = open < 0.25;
  }
}

export function shade(hex: string, amount: number): string {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l + amount)));
  return "#" + c.getHexString();
}

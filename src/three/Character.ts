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
  hairStyle?: "side-part" | "ponytail" | "short" | "bald" | "spiky";
  top?: string;          // shirt / hoodie colour (also sleeves)
  vest?: string | null;  // uniform vest over the top
  vestTrim?: string;
  bottom?: string;
  shoes?: string;
  glasses?: boolean;
  nameTag?: string | null;
  hood?: boolean;
  height?: number;       // scale multiplier
  horns?: string | null; // horn colour (devil, oni); null = none
  ears?: "round" | "pointed";
  print?: string | null; // vertical text printed on the chest (e.g. 悪魔 on a hoodie)
  printColor?: string;
  teeth?: boolean;       // white teeth in a grin and when the mouth opens
  cheeks?: string | null; // flat blush/face-paint patches under the eyes
  eyeStyle?: "dot" | "big" | "frog" | "villain"; // frog = 100Avatars FrogEnjoyer-style painted face // big = white sclera, iris, highlight and a lash line (expressive close-ups)
  iris?: string;
  boldBrows?: boolean;      // thick, outward-raised brows
  eyeShadow?: string | null; // painted shading around the eyes (face paint)
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
  // hold something up beside the face for the camera (selfie / "look at this")
  "hold-up":   { spineX: 0, spineY: 0.05, shoulderLX: 0.05, shoulderLZ: 0.08, elbowL: -0.15, shoulderRX: -1.1, shoulderRZ: -0.45, elbowR: -1.6, wristL: 0, wristR: 0.3 },
  "bow":       { spineX: 0.38, spineY: 0, shoulderLX: 0.15, shoulderLZ: 0.04, elbowL: -0.1, shoulderRX: 0.15, shoulderRZ: -0.04, elbowR: -0.1, wristL: 0, wristR: 0 }
};

export interface FaceState { eyes: number; brow: number; mouth: number; smile: number; }

export const EXPRESSIONS: Record<string, Partial<FaceState>> = {
  neutral: { eyes: 1, brow: 0, smile: 0 },
  blank: { eyes: 0.82, brow: -0.05, smile: 0 },
  polite: { eyes: 0.9, brow: 0.08, smile: 0.5 },
  surprised: { eyes: 1.25, brow: 0.35, smile: -0.1 },
  doubtful: { eyes: 0.72, brow: -0.25, smile: -0.25 },
  weary: { eyes: 0.6, brow: -0.15, smile: -0.35 },
  grin: { eyes: 0.85, brow: 0.2, smile: 1 },
  smug: { eyes: 0.68, brow: -0.12, smile: 0.75 }
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
  private eyeL!: THREE.Object3D;
  private eyeR!: THREE.Object3D;
  private eyeBase = 1.25;
  private browTilt = 0;
  private browL!: THREE.Mesh;
  private browR!: THREE.Mesh;
  private mouth!: THREE.Mesh;
  private mouthInner!: THREE.Mesh;
  private grin: THREE.Object3D | null = null;
  private teethTop: THREE.Mesh | null = null;
  private grinSize = 1;
  private browBaseY = 0;
  private chest!: THREE.Object3D;

  constructor(readonly id: string, readonly style: CharacterStyle) {
    const s = {
      skin: "#f2c9a8", hair: "#2a2226", hairStyle: "short", top: "#f4f2ee", vest: null, vestTrim: "#ffffff",
      bottom: "#3a3d4a", shoes: "#2b2b30", glasses: false, nameTag: null, hood: false, height: 1,
      horns: null, ears: "round", print: null, printColor: "#f6f3ec", teeth: false, cheeks: null,
      eyeStyle: "dot", iris: "#2a1a14", boldBrows: false, eyeShadow: null, ...style
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
      for (const side of s.print ? [] : [-1, 1]) {
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

    if (s.print) {
      const chars = [...s.print];
      const tex = canvasTexture(160, 160 * chars.length, (g, w, h) => {
        g.clearRect(0, 0, w, h);
        g.fillStyle = s.printColor; g.font = `900 132px ${JP_FONT}`; g.textAlign = "center"; g.textBaseline = "middle";
        chars.forEach((c, i) => g.fillText(c, w / 2, (i + 0.5) * (h / chars.length) + 4));
      });
      const ph = Math.min(0.3, 0.13 * chars.length);
      const print = new THREE.Mesh(new THREE.PlaneGeometry(ph / chars.length, ph), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
      print.position.set(0, 0.36 - ph / 2, 0.1305);
      this.spine.add(print);
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
      if (s.ears === "pointed") {
        const ear = mesh(new THREE.ConeGeometry(0.034, 0.13, 10), skin, 0.005);
        ear.scale.set(1, 1, 0.45);
        ear.rotation.set(0, side * 0.35, -side * 1.05);
        ear.position.set(0.19 * side, 0.02, -0.005);
        this.head.add(ear);
      } else {
        const ear = mesh(new THREE.SphereGeometry(0.035, 10, 8), skin, 0.005);
        ear.scale.set(0.5, 1, 0.8);
        ear.position.set(0.162 * side, -0.01, 0);
        this.head.add(ear);
      }
    }
    // point on the skull surface, facing outward (for painted face parts)
    const onFace = (o: THREE.Object3D, x: number, y: number, lift = 0.002) => {
      const r = 0.165, z = 0.98 * Math.sqrt(Math.max(0, r * r - x * x - (y / 1.06) ** 2));
      o.position.set(x, y, z + lift);
      o.lookAt(new THREE.Vector3(x * 2.2, y * 2.2, z * 2.2 + lift));
      this.head.add(o);
    };
    const disc = (r: number, color: string, x = 0, y = 0, z = 0) => {
      const m = new THREE.Mesh(new THREE.CircleGeometry(r, 28), flat(color));
      m.position.set(x, y, z);
      return m;
    };
    if (s.eyeStyle === "frog") {
      const nose = new THREE.Mesh(new THREE.CircleGeometry(0.0065, 16), flat("#f08a8a"));
      nose.scale.set(1.25, 0.9, 1);
      onFace(nose, 0, -0.036, 0.002);
    } else {
      const nose = mesh(new THREE.SphereGeometry(0.018, 10, 8), toon(shade(s.skin, -0.08)), false);
      nose.position.set(0, -0.025, 0.163);
      this.head.add(nose);
    }

    const eyeMat = flat("#17141a");
    const eye = () => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.019, 12, 10), eyeMat); e.scale.set(0.9, 1.25, 0.4); return e; };
    if (s.eyeStyle === "villain") {
      // narrow upturned eyes: almond with the outer corner raised, tiny pupils, heavy upper lid
      this.eyeBase = 1;
      const villainEye = (side: number) => {
        const almond = (k: number) => {
          const sh = new THREE.Shape();
          sh.moveTo(-0.026 * k * side, -0.006 * k);
          sh.quadraticCurveTo(0.0, 0.024 * k, 0.034 * k * side, 0.018 * k);
          sh.quadraticCurveTo(0.012 * k * side, -0.02 * k, -0.026 * k * side, -0.006 * k);
          return new THREE.ShapeGeometry(sh, 12);
        };
        const g = new THREE.Group();
        const lid = new THREE.Mesh(almond(1.22), flat("#120c10"));
        lid.position.set(0.001 * side, 0.003, 0);
        g.add(lid);
        const white = new THREE.Mesh(almond(1), flat("#fbf3d8"));
        white.position.z = 0.0004;
        g.add(white);
        g.add(disc(0.0085, "#120c10", 0.004 * side, 0.003, 0.0008));
        g.add(disc(0.0026, "#ffffff", 0.0065 * side, 0.0058, 0.0011));
        const wrap = new THREE.Group();
        wrap.add(g);
        g.scale.setScalar(1.15);
        onFace(wrap, 0.06 * side, 0.004, 0.002);
        return g;
      };
      this.eyeL = villainEye(1);
      this.eyeR = villainEye(-1);
    } else if (s.eyeStyle === "frog") {
      this.eyeBase = 1;
      const frogEye = (side: number) => {
        const g = new THREE.Group();
        g.add(disc(0.042, "#2a1a14"));
        g.add(disc(0.0385, "#fbf8f0", 0, 0, 0.0003));
        g.add(disc(0.03, s.iris, -0.003 * side, -0.003, 0.0006));
        g.add(disc(0.0165, "#1a100c", -0.003 * side, -0.003, 0.0009));
        g.add(disc(0.0102, "#ffffff", 0.01, 0.011, 0.0012));
        g.add(disc(0.004, "#ffffff", -0.01, -0.013, 0.0012));
        const wrap = new THREE.Group();
        wrap.add(g);
        onFace(wrap, 0.062 * side, -0.006, 0.002);
        return g;
      };
      this.eyeL = frogEye(1);
      this.eyeR = frogEye(-1);
    } else if (s.eyeStyle === "big") {
      this.eyeBase = 1;
      const big = (side: number) => {
        const g = new THREE.Group();
        const sclera = new THREE.Mesh(new THREE.SphereGeometry(0.031, 18, 14), flat("#fbf8f2"));
        sclera.scale.set(1.12, 0.92, 0.32);
        const iris = new THREE.Mesh(new THREE.SphereGeometry(0.019, 16, 12), flat(s.iris));
        iris.scale.set(1, 1.05, 0.3); iris.position.set(-0.004 * side, -0.002, 0.007);
        const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.009, 12, 10), flat("#0d0a0c"));
        pupil.scale.set(1, 1, 0.3); pupil.position.set(-0.004 * side, -0.002, 0.0105);
        const hl = new THREE.Mesh(new THREE.SphereGeometry(0.0045, 8, 6), flat("#ffffff"));
        hl.scale.set(1, 1, 0.3); hl.position.set(0.004 - 0.004 * side, 0.006, 0.0125);
        const lash = new THREE.Mesh(new THREE.TorusGeometry(0.032, 0.0042, 4, 18, Math.PI), flat("#141014"));
        lash.scale.set(1.1, 0.88, 0.6); lash.position.z = 0.004;
        g.add(sclera, iris, pupil, hl, lash);
        g.rotation.y = 0.32 * side;
        return g;
      };
      this.eyeL = big(1); this.eyeL.position.set(0.06, 0.012, 0.146);
      this.eyeR = big(-1); this.eyeR.position.set(-0.06, 0.012, 0.146);
    } else {
      this.eyeL = eye(); this.eyeL.position.set(0.058, 0.018, 0.152);
      this.eyeR = eye(); this.eyeR.position.set(-0.058, 0.018, 0.152);
    }
    if (s.eyeStyle !== "frog" && s.eyeStyle !== "villain") this.head.add(this.eyeL, this.eyeR);
    if (s.eyeShadow) {
      for (const side of [-1, 1]) {
        const c = new THREE.Mesh(new THREE.CircleGeometry(0.046, 20), new THREE.MeshBasicMaterial({ color: s.eyeShadow, transparent: true, opacity: 0.75 }));
        c.scale.set(1.05, 0.95, 1);
        c.position.set(0.062 * side, 0.016, 0.1435);
        c.rotation.y = 0.36 * side;
        this.head.add(c);
      }
    }
    const browMat = flat(shade(s.hair, 0.02));
    const bw = s.boldBrows ? 0.068 : 0.05, bh = s.boldBrows ? 0.017 : 0.009;
    this.browTilt = s.eyeStyle === "villain" ? 0.5 : s.boldBrows ? 0.22 : 0;
    this.browL = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.012), browMat);
    this.browR = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.012), browMat);
    if (s.boldBrows) { this.browL.rotation.y = 0.3; this.browR.rotation.y = -0.3; }
    if (s.eyeStyle === "frog") this.browL.visible = this.browR.visible = false; // painted face: no brows
    if (s.eyeStyle === "villain") {
      // sharp V brows: thick, tapered toward the outside, inner ends pulled down
      for (const [b, side] of [[this.browL, 1], [this.browR, -1]] as const) {
        b.geometry = new THREE.BoxGeometry(0.07, 0.02, 0.012);
        b.position.x = 0.058 * side;
        b.rotation.y = 0.32 * side;
      }
      this.browBaseY = 0.05;
    }
    this.browL.position.set(0.06, 0.07, 0.152);
    this.browR.position.set(-0.06, 0.07, 0.152);
    this.head.add(this.browL, this.browR);
    this.mouth = new THREE.Mesh(new THREE.BoxGeometry(s.eyeStyle === "frog" ? 0.03 : 0.045, s.eyeStyle === "frog" ? 0.0035 : 0.006, 0.01), flat(s.eyeStyle === "frog" ? "#3a1a14" : "#5a2f2f"));
    this.mouth.position.set(0, s.eyeStyle === "frog" ? -0.066 : -0.075, 0.155);
    this.mouthInner = new THREE.Mesh(new THREE.SphereGeometry(0.02, 12, 8), flat("#4a1f24"));
    this.mouthInner.scale.set(1, 0.01, 0.3);
    this.mouthInner.position.set(0, -0.078, 0.153);
    this.head.add(this.mouth, this.mouthInner);
    if (s.teeth) {
      this.teethTop = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.007, 0.006), flat("#fbfaf4"));
      this.teethTop.position.set(0, -0.069, 0.158);
      this.head.add(this.teethTop);
    }
    if (s.eyeStyle === "villain") {
      // villain grin: a wide crescent full of jagged teeth that meet in a zigzag
      const W = 0.06;
      const up = (x: number) => 0.016 - 0.02 * (1 - (x / W) ** 2);
      const lo = (x: number) => 0.016 - 0.056 * (1 - (x / W) ** 2);
      const crescent = (k: number) => {
        const sh = new THREE.Shape();
        const n = 24;
        for (let i = 0; i <= n; i++) { const x = -W + (2 * W * i) / n; i ? sh.lineTo(x * k, up(x) * k) : sh.moveTo(x * k, up(x) * k); }
        for (let i = n; i >= 0; i--) { const x = -W + (2 * W * i) / n; sh.lineTo(x * k, lo(x) * k); }
        return new THREE.ShapeGeometry(sh);
      };
      const g = new THREE.Group();
      const rim = new THREE.Mesh(crescent(1.1), flat("#120c10"));
      rim.position.y = -0.001;
      g.add(rim);
      const teeth = new THREE.Mesh(crescent(1), flat("#fbf6e6"));
      teeth.position.z = 0.0004;
      g.add(teeth);
      // zigzag gap between upper and lower teeth
      const zz = new THREE.Shape();
      const T = 9, pts: [number, number][] = [];
      for (let i = 0; i <= T * 2; i++) {
        const x = -W * 0.92 + (W * 1.84 * i) / (T * 2);
        const mid = (up(x) + lo(x)) / 2, a = (lo(x) - up(x)) * 0.42;
        pts.push([x, mid + (i % 2 ? a : -a)]);
      }
      pts.forEach(([x, y], i) => (i ? zz.lineTo(x, y + 0.0028) : zz.moveTo(x, y + 0.0028)));
      for (let i = pts.length - 1; i >= 0; i--) zz.lineTo(pts[i]![0], pts[i]![1] - 0.0028);
      const gap = new THREE.Mesh(new THREE.ShapeGeometry(zz), flat("#120c10"));
      gap.position.z = 0.0008;
      g.add(gap);
      g.position.set(0, -0.06, 0.154);
      g.rotation.x = -0.3;
      g.visible = false;
      this.grin = g;
      this.head.add(g);
    } else {
      const shape = new THREE.Shape();
      shape.moveTo(-0.058, 0.004); shape.quadraticCurveTo(0, -0.004, 0.058, 0.004);
      shape.quadraticCurveTo(0.054, -0.06, 0, -0.064);
      shape.quadraticCurveTo(-0.054, -0.06, -0.058, 0.004);
      const g = new THREE.Group();
      const rim = new THREE.Mesh(new THREE.ShapeGeometry(shape, 14), flat("#3a1216"));
      g.add(rim);
      if (s.teeth) {
        const ts = new THREE.Shape();
        ts.moveTo(-0.052, 0.001); ts.quadraticCurveTo(0, -0.006, 0.052, 0.001);
        ts.lineTo(0.046, -0.016); ts.quadraticCurveTo(0, -0.022, -0.046, -0.016); ts.lineTo(-0.052, 0.001);
        const t = new THREE.Mesh(new THREE.ShapeGeometry(ts, 10), flat("#fbfaf4"));
        t.position.z = 0.0004;
        g.add(t);
        const tongue = new THREE.Mesh(new THREE.CircleGeometry(0.03, 16, 0, Math.PI), flat("#d0505a"));
        tongue.scale.set(1.15, 0.6, 1); tongue.position.set(0, -0.063, 0.0003);
        g.add(tongue);
      }
      if (s.eyeStyle === "frog") { g.scale.setScalar(0.62); this.grinSize = 0.62; }
      g.position.set(0, -0.058, 0.152);
      g.rotation.x = -0.32;
      g.visible = false;
      this.grin = g;
      this.head.add(g);
    }
    if (s.cheeks) {
      for (const side of [-1, 1]) {
        const frog = s.eyeStyle === "frog";
        const c = new THREE.Mesh(new THREE.CircleGeometry(frog ? 0.026 : 0.03, 20), new THREE.MeshBasicMaterial({ color: s.cheeks, transparent: true, opacity: frog ? 0.8 : 0.55 }));
        if (frog) onFace(c, 0.104 * side, -0.046, 0.0015);
        else {
          c.scale.set(1.2, 0.7, 1);
          c.position.set(0.085 * side, -0.02, 0.146);
          c.rotation.y = 0.5 * side;
          this.head.add(c);
        }
      }
    }
    if (s.horns) {
      for (const side of [-1, 1]) this.head.add(horn(s.horns, side));
    }

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
    const win = s.hairStyle === "spiky" ? 1.15 : 0.82;
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
    if (s.hairStyle === "spiky") {
      // messy tufts pointing out of the crown and over the forehead
      const tufts: [number, number, number, number][] = [
        // [azimuth (0 = front), elevation (PI/2 = top), length, radius]
        [0.0, 1.3, 0.1, 0.05], [0.8, 1.05, 0.1, 0.048], [-0.8, 1.05, 0.1, 0.048], [1.7, 0.95, 0.1, 0.046], [-1.7, 0.95, 0.1, 0.046],
        [2.6, 0.85, 0.1, 0.046], [-2.6, 0.85, 0.1, 0.046], [3.14, 0.75, 0.1, 0.046], [2.1, 0.45, 0.09, 0.042], [-2.1, 0.45, 0.09, 0.042],
        [2.9, 0.35, 0.09, 0.042], [-2.9, 0.35, 0.09, 0.042], [1.45, 0.5, 0.08, 0.036], [-1.45, 0.5, 0.08, 0.036],
        // bangs: messy locks falling over the forehead
        [0.0, 0.8, 0.12, 0.034], [0.38, 0.8, 0.12, 0.033], [-0.38, 0.8, 0.12, 0.033], [0.72, 0.74, 0.11, 0.032], [-0.72, 0.74, 0.11, 0.032],
        [0.18, 0.95, 0.11, 0.034], [-0.2, 0.95, 0.11, 0.034]
      ];
      for (const [az, el, len, r] of tufts) {
        const dir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).normalize();
        // front tufts droop down over the forehead
        const front = Math.cos(az) > 0.6 && el < 1.0;
        const jitter = new THREE.Vector3(Math.sin(az * 7.3) * 0.25, 0, Math.cos(az * 5.1) * 0.1);
        const aim = front
          ? dir.clone().add(new THREE.Vector3(Math.sin(az) * 0.3, -1.15, 0.35)).add(jitter).normalize()
          : dir.clone().add(new THREE.Vector3(0, 0.05, -0.25)).add(jitter).normalize();
        const cone = mesh(new THREE.ConeGeometry(r, len, 8), mat, 0.005);
        cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), aim);
        cone.position.copy(dir.multiplyScalar(R * 0.98)).add(aim.clone().multiplyScalar(len * 0.32));
        cone.position.y *= 1.04;
        this.head.add(cone);
      }
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
    this.eyeL.scale.y = this.eyeR.scale.y = this.eyeBase * eyes;
    const by = (this.browBaseY || (this.browTilt ? 0.074 : 0.07)) + face.brow * 0.03;
    this.browL.position.y = this.browR.position.y = by;
    this.browL.rotation.z = -face.brow * 0.25 + face.smile * 0.1 + this.browTilt;
    this.browR.rotation.z = face.brow * 0.25 - face.smile * 0.1 - this.browTilt;
    const open = Math.max(0, Math.min(1, face.mouth));
    this.mouthInner.scale.y = 0.01 + open * 0.75;
    this.mouth.scale.x = 1 - open * 0.3 + face.smile * 0.15;
    this.mouth.rotation.z = 0;
    this.mouth.position.y = -0.075 + face.smile * 0.004 + open * 0.008;
    // a big smile stays a big open grin while talking (laughing speech); the jaw opens with each mora
    const grinning = !!this.grin && face.smile > 0.6;
    if (this.grin) { this.grin.visible = grinning; this.grin.scale.set(this.grinSize * (0.7 + face.smile * 0.3), this.grinSize * (0.45 + face.smile * 0.55) * (0.8 + open * 0.4), 1); }
    if (this.teethTop) { this.teethTop.visible = open >= 0.25 && !grinning; this.teethTop.position.y = -0.069 + open * 0.004; }
    this.mouthInner.visible = !grinning;
    this.mouth.visible = open < 0.25 && !grinning;
  }
}

/** Tapered curved horn growing from the top of the head (side = +1 left, -1 right). */
function horn(color: string, side: number): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.088 * side, 0.118, 0.0),
    new THREE.Vector3(0.16 * side, 0.155, -0.012),
    new THREE.Vector3(0.198 * side, 0.225, -0.02),
    new THREE.Vector3(0.182 * side, 0.295, -0.012),
    new THREE.Vector3(0.132 * side, 0.33, 0.012)
  ]);
  const segs = 24, radial = 12;
  const geo = new THREE.TubeGeometry(curve, segs, 1, radial, false);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const c = curve.getPointAt(i / segs);
    const r = 0.046 * Math.pow(1 - i / segs, 0.8) + 0.003;
    for (let k = 0; k <= radial; k++) {
      const idx = i * (radial + 1) + k;
      v.fromBufferAttribute(pos, idx).sub(c).multiplyScalar(r).add(c);
      pos.setXYZ(idx, v.x, v.y, v.z);
    }
  }
  geo.computeVertexNormals();
  return mesh(geo, toon(color), 0.005);
}

export function shade(hex: string, amount: number): string {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l + amount)));
  return "#" + c.getHexString();
}

import * as THREE from "three";
import type { FaceState, Joints } from "./Character";
import { canvasTexture, flat, JP_FONT, mesh, toon } from "./toon";

/**
 * Chibi (super-deformed, ~2.2 heads tall) character for cute mascots.
 * Big round head, eyes set low, tiny mouth, stubby limbs. Same joint names and
 * state contract as Character, so poses / look / face / lip movement all work.
 * Faces +Z. height 1 = about 1.0 m.
 */
export interface ChibiStyle {
  skin?: string;
  hair?: string;
  top?: string;
  bottom?: string;
  shoes?: string;
  horns?: string | null;
  ears?: "round" | "pointed";
  tail?: string | null;       // devil tail with a spade tip
  print?: string | null;      // text on the hoodie belly
  printColor?: string;
  cheeks?: string;
  hood?: boolean;
  fang?: boolean;
  height?: number;
}

export class Chibi {
  readonly root = new THREE.Group();
  private hips = new THREE.Group();
  private spine = new THREE.Group();
  private neck = new THREE.Group();
  private head = new THREE.Group();
  private shoulderL = new THREE.Group();
  private shoulderR = new THREE.Group();
  private elbowL = new THREE.Group();
  private elbowR = new THREE.Group();
  private handL = new THREE.Group();
  private handR = new THREE.Group();
  private eyes: THREE.Group[] = [];
  private brows: THREE.Mesh[] = [];
  private mouthRest!: THREE.Object3D;
  private mouthOpen!: THREE.Object3D;
  private mouthPout!: THREE.Object3D;
  private belly!: THREE.Object3D;
  private tail: THREE.Group | null = null;

  constructor(readonly id: string, style: ChibiStyle = {}) {
    const s = {
      skin: "#f2c9a8", hair: "#2a2226", top: "#2a2a30", bottom: "#24232a", shoes: "#1b1a1f", horns: null, ears: "round",
      tail: null, print: null, printColor: "#fbf8f2", cheeks: "#ff8f9c", hood: true, fang: false, height: 1, ...style
    } as Required<ChibiStyle>;
    const skin = toon(s.skin), top = toon(s.top), bottom = toon(s.bottom), hairM = toon(s.hair);

    // ---- legs + body
    this.root.add(this.hips);
    this.hips.position.y = 0.2;
    for (const side of [-1, 1]) {
      const leg = mesh(new THREE.CapsuleGeometry(0.052, 0.08, 4, 10), bottom, 0.006);
      leg.position.set(0.07 * side, -0.1, 0);
      this.hips.add(leg);
      const foot = mesh(new THREE.SphereGeometry(0.062, 14, 10), toon(s.shoes), 0.006);
      foot.scale.set(0.95, 0.6, 1.3);
      foot.position.set(0.07 * side, -0.17, 0.025);
      this.hips.add(foot);
    }
    this.hips.add(this.spine);
    const body = mesh(new THREE.SphereGeometry(0.17, 24, 18), top, 0.007);
    body.scale.set(1.0, 1.02, 0.88);
    body.position.y = 0.1;
    this.spine.add(body);
    this.belly = body;
    // hoodie pocket band
    const band = mesh(new THREE.CylinderGeometry(0.152, 0.16, 0.04, 24), toon(shade(s.top, -0.04)), 0.005);
    band.scale.set(1, 1, 0.88);
    band.position.y = -0.03;
    this.spine.add(band);
    if (s.hood) {
      const hood = mesh(new THREE.TorusGeometry(0.11, 0.05, 10, 20, Math.PI * 1.3), top, 0.006);
      hood.rotation.set(Math.PI / 2 + 0.45, 0, Math.PI * 0.85);
      hood.position.set(0, 0.25, -0.07);
      this.spine.add(hood);
    }
    if (s.print) {
      const chars = [...s.print];
      const tex = canvasTexture(180, 180 * chars.length, (g, w, h) => {
        g.clearRect(0, 0, w, h);
        g.fillStyle = s.printColor; g.font = `900 150px ${JP_FONT}`; g.textAlign = "center"; g.textBaseline = "middle";
        chars.forEach((c, i) => g.fillText(c, w / 2, (i + 0.5) * (h / chars.length) + 6));
      });
      const ph = 0.075 * chars.length;
      const print = new THREE.Mesh(new THREE.PlaneGeometry(ph / chars.length, ph), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
      print.position.set(0, 0.1, 0.151);
      this.spine.add(print);
    }
    if (s.tail) {
      const tm = toon(s.tail);
      const t = new THREE.Group();
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.02, -0.02, -0.09), new THREE.Vector3(0.09, 0.03, -0.16), new THREE.Vector3(0.12, 0.13, -0.17)
      ]);
      t.add(mesh(new THREE.TubeGeometry(curve, 20, 0.013, 8, false), tm, 0.004));
      const spade = new THREE.Shape();
      spade.moveTo(0, 0.05); spade.quadraticCurveTo(0.045, 0.0, 0.012, -0.012); spade.lineTo(0, -0.004);
      spade.lineTo(-0.012, -0.012); spade.quadraticCurveTo(-0.045, 0.0, 0, 0.05);
      const sp = mesh(new THREE.ExtrudeGeometry(spade, { depth: 0.014, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 2 }), tm, 0.004);
      sp.position.set(0.12, 0.135, -0.177);
      sp.rotation.y = 0.5;
      t.add(sp);
      t.position.set(0, 0.0, -0.13);
      this.spine.add(t);
      this.tail = t;
    }

    // ---- arms (short, mitten hands)
    const arm = (sh: THREE.Group, el: THREE.Group, hand: THREE.Group, side: number) => {
      sh.position.set(0.15 * side, 0.18, 0);
      this.spine.add(sh);
      const upper = mesh(new THREE.CapsuleGeometry(0.045, 0.05, 4, 10), top, 0.006);
      upper.position.y = -0.05;
      sh.add(upper);
      el.position.y = -0.1;
      sh.add(el);
      const fore = mesh(new THREE.CapsuleGeometry(0.042, 0.04, 4, 10), top, 0.006);
      fore.position.y = -0.03;
      el.add(fore);
      hand.position.y = -0.085;
      el.add(hand);
      const palm = mesh(new THREE.SphereGeometry(0.045, 14, 10), skin, 0.006);
      hand.add(palm);
    };
    arm(this.shoulderL, this.elbowL, this.handL, 1);
    arm(this.shoulderR, this.elbowR, this.handR, -1);

    // ---- head
    this.neck.position.y = 0.24;
    this.spine.add(this.neck);
    this.neck.add(this.head);
    const R = 0.235;
    this.head.position.y = R * 0.9;
    const skull = mesh(new THREE.SphereGeometry(R, 40, 30), skin, 0.008);
    skull.scale.set(1.06, 0.96, 1);
    this.head.add(skull);
    const surf = (x: number, y: number) => Math.sqrt(Math.max(0, R * R - (x / 1.06) ** 2 - (y / 0.96) ** 2));

    // eyes: big glossy ovals, set low on the face
    for (const side of [-1, 1]) {
      const g = new THREE.Group();
      const ex = 0.085 * side, ey = -0.025;
      const iris = new THREE.Mesh(new THREE.SphereGeometry(0.042, 20, 16), flat("#1d1420"));
      iris.scale.set(0.82, 1.12, 0.3);
      const low = new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 12), flat("#5a3a4e"));
      low.scale.set(0.75, 0.55, 0.3); low.position.set(0, -0.022, 0.004);
      const hl = new THREE.Mesh(new THREE.SphereGeometry(0.0145, 12, 10), flat("#ffffff"));
      hl.scale.set(1, 1.1, 0.3); hl.position.set(0.012, 0.018, 0.009);
      const hl2 = new THREE.Mesh(new THREE.SphereGeometry(0.007, 10, 8), flat("#ffffff"));
      hl2.scale.set(1, 1, 0.3); hl2.position.set(-0.012, -0.018, 0.009);
      g.add(iris, low, hl, hl2);
      g.position.set(ex, ey, surf(ex, ey) - 0.006);
      g.rotation.set(0.08, Math.asin(ex / R) * 0.9, 0);
      this.head.add(g);
      this.eyes.push(g);
      const brow = new THREE.Mesh(new THREE.CapsuleGeometry(0.008, 0.03, 3, 8), flat(shade(s.hair, 0.02)));
      brow.rotation.z = Math.PI / 2;
      const by = 0.042;
      brow.position.set(0.085 * side, by, surf(0.085, by) + 0.002);
      brow.rotation.y = Math.asin(0.085 * side / R);
      this.head.add(brow);
      this.brows.push(brow);
      // blush
      const cx = 0.148 * side, cy = -0.085;
      const cheek = new THREE.Mesh(new THREE.CircleGeometry(0.03, 20), new THREE.MeshBasicMaterial({ color: s.cheeks, transparent: true, opacity: 0.65 }));
      cheek.scale.set(1.3, 0.75, 1);
      cheek.position.set(cx, cy, surf(cx, cy) + 0.001);
      cheek.rotation.y = Math.asin(cx / (R * 1.06)) * 1.05;
      this.head.add(cheek);
    }

    // mouth: rest = small smile curve, open = rounded D with a fang, pout = small flat arc
    const my = -0.1, mz = surf(0, -0.1) + 0.0015;
    const rest = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.0035, 4, 14, Math.PI * 0.9), flat("#3a1a20"));
    rest.rotation.z = Math.PI * 1.05;
    rest.position.set(0, my + 0.008, mz);
    this.mouthRest = rest;
    const open = new THREE.Group();
    const d = new THREE.Shape();
    d.moveTo(-0.028, 0); d.lineTo(0.028, 0); d.quadraticCurveTo(0.027, -0.034, 0, -0.036); d.quadraticCurveTo(-0.027, -0.034, -0.028, 0);
    open.add(new THREE.Mesh(new THREE.ShapeGeometry(d, 12), flat("#5a1a26")));
    const tongue = new THREE.Mesh(new THREE.CircleGeometry(0.016, 14, 0, Math.PI), flat("#f07a86"));
    tongue.scale.set(1.1, 0.7, 1); tongue.position.set(0, -0.034, 0.0004);
    open.add(tongue);
    if (s.fang) {
      const f = new THREE.Shape(); f.moveTo(0, 0); f.lineTo(0.011, 0); f.lineTo(0.0055, -0.012); f.lineTo(0, 0);
      const fang = new THREE.Mesh(new THREE.ShapeGeometry(f), flat("#ffffff"));
      fang.position.set(0.008, 0, 0.0006);
      open.add(fang);
    }
    open.position.set(0, my + 0.012, mz - 0.002);
    open.rotation.x = -0.35;
    this.mouthOpen = open;
    const pout = new THREE.Mesh(new THREE.TorusGeometry(0.013, 0.0035, 4, 12, Math.PI * 0.8), flat("#3a1a20"));
    pout.rotation.z = Math.PI * 0.1;
    pout.position.set(0, my - 0.004, mz);
    this.mouthPout = pout;
    this.head.add(rest, open, pout);

    // ears
    for (const side of [-1, 1]) {
      if (s.ears === "pointed") {
        const ear = mesh(new THREE.ConeGeometry(0.036, 0.1, 12), skin, 0.006);
        ear.scale.set(1, 1, 0.5);
        ear.rotation.set(0, 0, -side * 1.2);
        ear.position.set((R * 1.06 + 0.02) * side, 0.0, -0.01);
        this.head.add(ear);
      } else {
        const ear = mesh(new THREE.SphereGeometry(0.04, 12, 10), skin, 0.006);
        ear.scale.set(0.5, 1, 0.8);
        ear.position.set(R * 1.04 * side, -0.02, 0);
        this.head.add(ear);
      }
    }

    // hair: fluffy cap + rounded bangs + side locks + one ahoge
    const cap = mesh(new THREE.SphereGeometry(R * 1.05, 40, 20, 0, Math.PI * 2, 0, Math.PI * 0.3), hairM, 0.008);
    cap.scale.set(1.06, 1.0, 1.02);
    cap.position.y = 0.006;
    this.head.add(cap);
    const back = mesh(new THREE.SphereGeometry(R * 1.05, 32, 16, Math.PI * 0.5 + 1.3, Math.PI * 2 - 2.6, Math.PI * 0.29, Math.PI * 0.36), hairM, 0.008);
    back.scale.set(1.06, 1.0, 1.02);
    this.head.add(back);
    const lock = (x: number, y: number, len: number, w: number, tilt: number) => {
      const m = mesh(new THREE.CapsuleGeometry(w, len, 4, 12), hairM, 0.006);
      m.scale.set(1, 1, 0.55);
      m.rotation.z = tilt;
      const z = surf(x, y) + 0.008;
      m.position.set(x, y, z);
      m.rotation.x = -0.25 - y * 1.2;
      m.rotation.y = Math.asin(Math.max(-1, Math.min(1, x / R))) * 0.9;
      this.head.add(m);
    };
    // scalloped fringe across the forehead
    lock(0.0, 0.125, 0.045, 0.046, 0.0);
    lock(0.07, 0.122, 0.045, 0.045, -0.22);
    lock(-0.07, 0.122, 0.045, 0.045, 0.24);
    lock(0.135, 0.1, 0.05, 0.042, -0.42);
    lock(-0.135, 0.1, 0.05, 0.042, 0.45);
    lock(0.035, 0.165, 0.03, 0.05, -0.1);
    lock(-0.04, 0.165, 0.03, 0.05, 0.12);
    for (const side of [-1, 1]) {
      const sideLock = mesh(new THREE.CapsuleGeometry(0.04, 0.09, 4, 10), hairM, 0.006);
      sideLock.scale.set(0.6, 0.9, 0.8);
      sideLock.position.set(0.225 * side, 0.03, -0.01);
      sideLock.rotation.z = 0.1 * side;
      this.head.add(sideLock);
    }
    const ahoge = new THREE.CatmullRomCurve3([new THREE.Vector3(0.0, R * 0.98, 0.02), new THREE.Vector3(0.02, R * 1.15, 0.03), new THREE.Vector3(0.07, R * 1.2, 0.01), new THREE.Vector3(0.09, R * 1.12, -0.01)]);
    this.head.add(mesh(new THREE.TubeGeometry(ahoge, 16, 0.012, 6, false), hairM, 0.005));

    // horns: short stubby curved, rounded tips
    if (s.horns) {
      for (const side of [-1, 1]) {
        const c = new THREE.CatmullRomCurve3([
          new THREE.Vector3(0.12 * side, 0.17, 0.02), new THREE.Vector3(0.165 * side, 0.215, 0.015),
          new THREE.Vector3(0.18 * side, 0.27, 0.01), new THREE.Vector3(0.155 * side, 0.305, 0.02)
        ]);
        const segs = 16, radial = 12;
        const geo = new THREE.TubeGeometry(c, segs, 1, radial, false);
        const pos = geo.attributes.position as THREE.BufferAttribute;
        const v = new THREE.Vector3();
        for (let i = 0; i <= segs; i++) {
          const ctr = c.getPointAt(i / segs);
          const r = 0.038 * (1 - i / segs * 0.7);
          for (let k = 0; k <= radial; k++) {
            const idx = i * (radial + 1) + k;
            v.fromBufferAttribute(pos, idx).sub(ctr).multiplyScalar(r).add(ctr);
            pos.setXYZ(idx, v.x, v.y, v.z);
          }
        }
        geo.computeVertexNormals();
        const hm = toon(s.horns);
        this.head.add(mesh(geo, hm, 0.006));
        const tip = mesh(new THREE.SphereGeometry(0.0115, 10, 8), hm, 0.006);
        tip.position.copy(c.getPointAt(1));
        this.head.add(tip);
      }
    }

    this.root.scale.setScalar(s.height);
  }

  apply(state: { root: { x: number; y: number; z: number; ry: number }; joints: Joints; look: { yaw: number; pitch: number }; face: FaceState; breath: number; wiggle: number; time: number; mora?: number }) {
    const { root, joints: j, look, face, time } = state;
    this.root.position.set(root.x, root.y, root.z);
    this.root.rotation.y = root.ry;
    this.spine.rotation.set((j.spineX ?? 0) * 0.6, j.spineY ?? 0, 0);
    this.shoulderL.rotation.set(j.shoulderLX ?? 0, 0, (j.shoulderLZ ?? 0) + 0.12);
    this.shoulderR.rotation.set(j.shoulderRX ?? 0, 0, (j.shoulderRZ ?? 0) - 0.12);
    const wig = state.wiggle ? Math.sin(time * 31) * 0.06 * state.wiggle : 0;
    this.elbowL.rotation.set(j.elbowL ?? 0, 0, 0);
    this.elbowR.rotation.set((j.elbowR ?? 0) + wig, 0, 0);
    this.handL.rotation.set(j.wristL ?? 0, 0, 0);
    this.handR.rotation.set(j.wristR ?? 0, 0, wig);
    this.neck.rotation.set(look.pitch * 0.8 - (j.spineX ?? 0) * 0.3, look.yaw, Math.sin(time * 1.3) * 0.02);
    this.belly.scale.y = 1.02 + state.breath * 0.012;
    if (this.tail) this.tail.rotation.set(Math.sin(time * 2.1) * 0.12, Math.sin(time * 1.6) * 0.35, 0);
    const eyes = Math.max(0.06, face.eyes);
    for (const e of this.eyes) e.scale.set(1, eyes * (1 + face.smile * 0.02), 1);
    for (const [i, b] of this.brows.entries()) {
      const side = i === 0 ? -1 : 1;
      b.position.y = 0.042 + face.brow * 0.02;
      b.rotation.z = Math.PI / 2 + side * (face.brow * 0.35 - face.smile * 0.1);
    }
    const open = Math.max(0, Math.min(1, face.mouth));
    const big = face.smile > 0.6;
    this.mouthOpen.visible = open > 0.15 || big;
    this.mouthOpen.scale.set(big ? 1.15 : 0.8 + open * 0.2, big ? 0.75 + open * 0.4 : 0.35 + open * 0.75, 1);
    this.mouthRest.visible = !this.mouthOpen.visible && face.smile >= -0.15;
    this.mouthPout.visible = !this.mouthOpen.visible && face.smile < -0.15;
  }
}

function shade(hex: string, amount: number): string {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l + amount)));
  return "#" + c.getHexString();
}

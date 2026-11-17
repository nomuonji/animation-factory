import * as THREE from "three";
import type { Pose } from "../pose";
import { BODY } from "../pose";
import type { StyleDef } from "../themes";
import { drawFace } from "../draw2d/figures";
import { Mats } from "./materials";

/**
 * One rig, many bodies: every 3D style uses the same joint hierarchy (driven by the shared
 * 2D pose angles in the picture plane) and swaps the meshes: toon capsules, low-poly,
 * voxel boxes, brick stacks, clay blobs, blocky game avatars.
 * Units: figure height ≈ 1 (scaled by the caller).
 */
export class Figure3D {
  root = new THREE.Group();
  private hips = new THREE.Group();
  private torso = new THREE.Group();
  private head = new THREE.Group();
  private arms: { up: THREE.Group; low: THREE.Group }[] = [];
  private legs: { up: THREE.Group; low: THREE.Group }[] = [];
  private faceMat: THREE.MeshBasicMaterial | null = null;
  private faceCanvas = document.createElement("canvas");
  private faceTex: THREE.CanvasTexture;
  private faceKey = "";
  private emoteSprite: THREE.Sprite | null = null;

  constructor(private st: StyleDef, private mats: Mats, opts: { color: string; accent: string; skin: string; hair: string; kind?: string }) {
    const kind = opts.kind ?? st.figure;
    this.faceCanvas.width = this.faceCanvas.height = 256;
    this.faceTex = new THREE.CanvasTexture(this.faceCanvas);
    this.faceTex.colorSpace = THREE.SRGBColorSpace;
    if (st.look === "ps2" || kind === "voxel") { this.faceTex.magFilter = THREE.NearestFilter; this.faceTex.minFilter = THREE.NearestFilter; }
    const legLen = BODY.leg, armLen = BODY.arm;
    const shadowCaster = (m: THREE.Object3D) => { m.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } }); return m; };
    const skin = mats.body(opts.skin), shirt = mats.body(opts.color), pants = mats.body(shade(opts.color, kind === "avatar" ? -0.55 : -0.45)), acc = mats.body(opts.accent);
    const boxy = kind === "voxel" || kind === "avatar" || kind === "brick";
    const limbW = kind === "voxel" ? 0.085 : kind === "avatar" ? 0.1 : kind === "brick" ? 0.09 : kind === "clay" ? 0.09 : kind === "lowpoly" ? 0.08 : 0.08;
    const segment = (len: number, mat: THREE.Material, w = limbW) => {
      const g = new THREE.Group();
      let mesh: THREE.Mesh;
      if (boxy) mesh = new THREE.Mesh(new THREE.BoxGeometry(w, len + (kind === "voxel" ? 0 : 0.02), w), mat);
      else if (kind === "lowpoly") mesh = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.5, w * 0.42, len, 5, 1), mat);
      else mesh = new THREE.Mesh(new THREE.CapsuleGeometry(w * 0.5, len - w * 0.2, 4, kind === "clay" ? 12 : 8), mat);
      mesh.position.y = -len / 2;
      g.add(shadowCaster(mesh));
      return g;
    };
    // hips sit at leg length * 2; root origin at the feet
    this.root.add(this.hips);
    this.hips.position.y = legLen * 2;
    this.hips.add(this.torso);
    const tw = kind === "avatar" ? 0.26 : kind === "voxel" ? 0.2 : kind === "brick" ? 0.22 : kind === "clay" ? 0.22 : 0.17;
    let torsoMesh: THREE.Mesh;
    if (boxy) torsoMesh = new THREE.Mesh(new THREE.BoxGeometry(tw, BODY.torso, tw * 0.55), shirt);
    else if (kind === "lowpoly") torsoMesh = new THREE.Mesh(new THREE.CylinderGeometry(tw * 0.48, tw * 0.4, BODY.torso, 6), shirt);
    else torsoMesh = new THREE.Mesh(new THREE.CapsuleGeometry(tw * 0.5, BODY.torso - tw * 0.45, 6, kind === "clay" ? 16 : 10), shirt);
    torsoMesh.position.y = BODY.torso / 2;
    if (kind === "clay") torsoMesh.scale.set(1, 1, 0.85);
    this.torso.add(shadowCaster(torsoMesh));
    if (kind === "brick") {
      // stud row on the shoulders
      for (const x of [-0.05, 0.05]) { const s = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.02, 12), shirt); s.position.set(x, BODY.torso + 0.005, 0); this.torso.add(s); }
    }
    // head
    this.head.position.y = BODY.torso + 0.01;
    this.torso.add(this.head);
    const hr = BODY.headR * (kind === "clay" ? 1.35 : kind === "toon" ? 1.45 : kind === "avatar" ? 1.15 : 1.2);
    let headMesh: THREE.Mesh;
    if (kind === "voxel") headMesh = new THREE.Mesh(new THREE.BoxGeometry(hr * 2, hr * 2, hr * 2), skin);
    else if (kind === "avatar") headMesh = new THREE.Mesh(new THREE.CylinderGeometry(hr, hr, hr * 1.7, 20), skin);
    else if (kind === "brick") headMesh = new THREE.Mesh(new THREE.CylinderGeometry(hr * 0.95, hr * 0.95, hr * 1.7, 24), skin);
    else if (kind === "lowpoly") headMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(hr, 0), skin);
    else headMesh = new THREE.Mesh(new THREE.SphereGeometry(hr, kind === "clay" ? 24 : 20, 16), skin);
    headMesh.position.y = hr * 0.95;
    this.head.add(shadowCaster(headMesh));
    if (kind === "brick") { const stud = new THREE.Mesh(new THREE.CylinderGeometry(hr * 0.45, hr * 0.45, hr * 0.35, 16), skin); stud.position.y = hr * 0.95 + hr * 0.95; this.head.add(stud); }
    // face decal
    this.faceMat = new THREE.MeshBasicMaterial({ map: this.faceTex, transparent: true, depthWrite: false });
    const face = new THREE.Mesh(new THREE.PlaneGeometry(hr * 1.7, hr * 1.7), this.faceMat);
    face.position.set(0, hr * 0.95, (kind === "voxel" || kind === "avatar" || kind === "brick" ? hr : hr * 0.98) + 0.004);
    if (kind === "avatar" || kind === "brick") face.position.z = hr * 0.95 + 0.004;
    face.renderOrder = 2;
    this.head.add(face);
    // hair / hat
    const hair = opts.hair;
    if (hair === "cap") {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(hr * 1.04, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), acc); cap.position.y = hr * 1.05; this.head.add(cap);
      const brim = new THREE.Mesh(new THREE.BoxGeometry(hr * 1.2, hr * 0.08, hr * 0.9), acc); brim.position.set(0, hr * 1.08, hr * 0.8); this.head.add(brim);
    } else if (hair === "spiky") {
      for (let i = 0; i < 7; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry(hr * 0.32, hr * 0.8, kind === "lowpoly" ? 4 : 8), acc); const a = (i / 7) * Math.PI * 2; c.position.set(Math.cos(a) * hr * 0.45, hr * 1.75, Math.sin(a) * hr * 0.45 - hr * 0.1); c.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5); this.head.add(c); }
    } else if (hair === "bob" || hair === "bun") {
      const h = new THREE.Mesh(boxy ? new THREE.BoxGeometry(hr * 2.15, hr * 1.1, hr * 2.15) : new THREE.SphereGeometry(hr * 1.08, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), acc);
      h.position.set(0, boxy ? hr * 1.5 : hr * 1.0, boxy ? -hr * 0.08 : -hr * 0.05); this.head.add(h);
      if (hair === "bun") { const b = new THREE.Mesh(new THREE.SphereGeometry(hr * 0.4, 12, 8), acc); b.position.set(0, hr * 2.1, -hr * 0.3); this.head.add(b); }
    } else if (hair === "hood") {
      const h = new THREE.Mesh(new THREE.TorusGeometry(hr * 1.05, hr * 0.18, 8, 20), acc); h.position.y = hr * 0.95; this.head.add(h);
    } else if (boxy && hair !== "none") {
      const h = new THREE.Mesh(new THREE.BoxGeometry(hr * 2.1, hr * 0.5, hr * 2.1), acc); h.position.y = hr * 1.8; this.head.add(h);
    }
    // arms
    for (const side of [-1, 1]) {
      const up = segment(armLen, shirt), low = segment(armLen, kind === "avatar" || kind === "voxel" ? skin : shirt);
      up.position.set(side * (tw * 0.5 + limbW * 0.4), BODY.torso * 0.92, 0);
      low.position.y = -armLen;
      up.add(low);
      const hand = new THREE.Mesh(boxy ? new THREE.BoxGeometry(limbW, limbW, limbW) : new THREE.SphereGeometry(limbW * 0.62, 10, 8), skin);
      hand.position.y = -armLen; low.add(hand);
      this.torso.add(up);
      this.arms.push({ up, low });
    }
    for (const side of [-1, 1]) {
      const up = segment(legLen, pants), low = segment(legLen, pants);
      up.position.set(side * tw * 0.26, 0, 0);
      low.position.y = -legLen;
      up.add(low);
      const foot = new THREE.Mesh(boxy ? new THREE.BoxGeometry(limbW * 1.1, limbW * 0.6, limbW * 1.6) : new THREE.SphereGeometry(limbW * 0.7, 10, 6), mats.body(shade(opts.color, -0.7)));
      foot.position.set(0, -legLen, limbW * 0.3); if (!boxy) foot.scale.set(1, 0.6, 1.5);
      low.add(foot);
      this.hips.add(up);
      this.legs.push({ up, low });
    }
  }

  /** Apply a pose. `side` true = turned 90° (walking across the frame). */
  setPose(p: Pose) {
    const r = (d: number) => (d * Math.PI) / 180;
    // the 2D angles are drawn as seen from the camera, so screen-left = the figure's right hand
    this.hips.position.y = BODY.leg * 2 * (1 - p.drop * 0.85) + p.lift;
    this.torso.rotation.z = -r(p.lean);
    this.head.rotation.z = -r(p.head);
    const [l, rr] = this.arms as [typeof this.arms[0], typeof this.arms[0]];
    l.up.rotation.z = r(p.la1); l.low.rotation.z = r(p.la2 - p.la1);
    rr.up.rotation.z = r(p.ra1); rr.low.rotation.z = r(p.ra2 - p.ra1);
    const [ll, rl] = this.legs as [typeof this.legs[0], typeof this.legs[0]];
    ll.up.rotation.z = r(p.ll1); ll.low.rotation.z = r(p.ll2 - p.ll1);
    rl.up.rotation.z = r(p.rl1); rl.low.rotation.z = r(p.rl2 - p.rl1);
    // undo the torso lean for the legs (they hang from the hips, not the torso)
  }

  setFace(expr: string, talk: number) {
    const level = talk > 0.6 ? 2 : talk > 0.2 ? 1 : 0;
    const key = `${expr}:${level}`;
    if (key === this.faceKey) return;
    this.faceKey = key;
    const g = this.faceCanvas.getContext("2d")!;
    g.clearRect(0, 0, 256, 256);
    const ink = this.st.look === "horror" ? "#f2f2f2" : "#1a1a1a";
    drawFace(g, { ...this.st, figure: this.st.figure === "voxel" ? "stick" : "bean" }, expr, level / 2, 128, 128, 100, ink);
    this.faceTex.needsUpdate = true;
  }

  setEmote(tex: THREE.Texture | null) {
    if (!tex) { if (this.emoteSprite) this.emoteSprite.visible = false; return; }
    if (!this.emoteSprite) {
      this.emoteSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
      this.emoteSprite.scale.set(0.22, 0.22, 1);
      this.emoteSprite.position.set(0.16, 1.18, 0);
      this.emoteSprite.renderOrder = 5;
      this.root.add(this.emoteSprite);
    }
    this.emoteSprite.material.map = tex;
    this.emoteSprite.visible = true;
  }
}

export function shade(hex: string, k: number) {
  const c = new THREE.Color(hex);
  if (k < 0) c.multiplyScalar(1 + k); else c.lerp(new THREE.Color("#ffffff"), k);
  return `#${c.getHexString()}`;
}

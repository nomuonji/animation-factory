import * as THREE from "three";
import type { FaceState, Joints } from "./Character";
import { flat, mesh, toon } from "./toon";

/**
 * Akabeko (赤べこ) — the Aizu papier-mâché cow whose head hangs on a spring and nods.
 * Usable as an actor (`"figure": "akabeko"`): it has no mouth, so "talking" is the head
 * bobbing on each mora, which is how the real toy "speaks". Idle = a slow residual sway.
 * Faces +Z. `height` scales the whole toy (1 = about 0.2 m tall, hand-held size).
 */
export interface AkabekoOpts { height?: number; body?: string; pattern?: string }

export class Akabeko {
  readonly root = new THREE.Group();
  private neck = new THREE.Group();
  private head = new THREE.Group();
  private eyes: THREE.Object3D[] = [];
  private body!: THREE.Object3D;

  constructor(readonly id: string, opts: AkabekoOpts = {}) {
    const red = toon(opts.body ?? "#d42a24");
    const black = toon("#17141a");
    const gold = toon(opts.pattern ?? "#f2c64a");
    const white = toon("#fbf6ea");

    // body: a rounded barrel
    const body = new THREE.Group();
    body.position.y = 0.105;
    this.root.add(body);
    this.body = body;
    const barrel = mesh(new THREE.CapsuleGeometry(0.055, 0.1, 6, 16), red, 0.004);
    barrel.rotation.x = Math.PI / 2;
    barrel.scale.set(1, 1, 0.92);
    body.add(barrel);
    // painted markings: gold-ringed black dots on the flanks and back, black stripe along the spine
    const dot = (x: number, y: number, z: number, ry: number, rz: number, r: number) => {
      const g = new THREE.Group();
      const ring = new THREE.Mesh(new THREE.CircleGeometry(r, 20), gold);
      const core = new THREE.Mesh(new THREE.CircleGeometry(r * 0.55, 20), black);
      core.position.z = 0.0006;
      g.add(ring, core);
      g.position.set(x, y, z);
      g.rotation.set(0, ry, rz);
      body.add(g);
    };
    for (const side of [-1, 1]) {
      dot(0.0565 * side, 0.012, 0.04, (Math.PI / 2) * side, 0, 0.018);
      dot(0.0565 * side, 0.01, -0.035, (Math.PI / 2) * side, 0, 0.016);
      dot(0.04 * side, 0.042, 0.0, (Math.PI / 2) * side, -0.75 * side, 0.012);
    }
    const stripe = mesh(new THREE.BoxGeometry(0.014, 0.006, 0.16), black, false);
    stripe.position.set(0, 0.055, -0.01);
    body.add(stripe);
    // chest bib (white with a gold edge)
    const bib = new THREE.Mesh(new THREE.CircleGeometry(0.03, 20, Math.PI, Math.PI), white);
    bib.rotation.z = Math.PI;
    bib.position.set(0, -0.005, 0.1065);
    body.add(bib);

    // legs and hooves
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const leg = mesh(new THREE.CylinderGeometry(0.016, 0.018, 0.075, 10), red, 0.003);
      leg.position.set(0.032 * sx, 0.0375, 0.055 * sz);
      this.root.add(leg);
      const hoof = mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.012, 10), black, 0.003);
      hoof.position.set(0.032 * sx, 0.006, 0.055 * sz);
      this.root.add(hoof);
    }
    // tail
    const tail = mesh(new THREE.CapsuleGeometry(0.008, 0.05, 3, 6), red, 0.003);
    tail.position.set(0, 0.11, -0.115);
    tail.rotation.x = 0.5;
    this.root.add(tail);
    const tuft = mesh(new THREE.SphereGeometry(0.012, 8, 6), black, 0.003);
    tuft.position.set(0, 0.085, -0.128);
    this.root.add(tuft);

    // head on its spring, pivot at the front of the body
    this.neck.position.set(0, 0.135, 0.075);
    this.root.add(this.neck);
    this.neck.add(this.head);
    this.head.position.set(0, 0.02, 0.045);
    const skull = mesh(new THREE.SphereGeometry(0.048, 24, 18), red, 0.004);
    skull.scale.set(1.05, 0.95, 1.05);
    this.head.add(skull);
    const muzzle = mesh(new THREE.SphereGeometry(0.034, 18, 14), red, 0.004);
    muzzle.scale.set(1.1, 0.85, 0.9);
    muzzle.position.set(0, -0.022, 0.035);
    this.head.add(muzzle);
    // black painted nose band and nostrils
    const nose = new THREE.Mesh(new THREE.CircleGeometry(0.02, 18), black);
    nose.scale.set(1.25, 0.6, 1);
    nose.position.set(0, -0.022, 0.066);
    this.head.add(nose);
    // forehead tuft (black fringe painted as a crescent)
    const fringe = mesh(new THREE.SphereGeometry(0.03, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.42), black, 0.003);
    fringe.position.set(0, 0.022, 0.02);
    fringe.rotation.x = 0.85;
    this.head.add(fringe);
    // big painted eyes: white disc, gold ring, black pupil
    for (const side of [-1, 1]) {
      const eye = new THREE.Group();
      const ring = new THREE.Mesh(new THREE.CircleGeometry(0.019, 24), gold);
      const white2 = new THREE.Mesh(new THREE.CircleGeometry(0.0155, 24), flat("#fbf6ea"));
      white2.position.z = 0.0005;
      const pupil = new THREE.Mesh(new THREE.CircleGeometry(0.009, 20), flat("#17141a"));
      pupil.position.set(0.001 * side, -0.001, 0.001);
      const hl = new THREE.Mesh(new THREE.CircleGeometry(0.003, 10), flat("#ffffff"));
      hl.position.set(0.004, 0.004, 0.0015);
      eye.add(ring, white2, pupil, hl);
      eye.position.set(0.029 * side, 0.016, 0.038);
      eye.rotation.set(-0.05, 0.55 * side, 0);
      this.head.add(eye);
      this.eyes.push(eye);
    }
    // horns and ears
    for (const side of [-1, 1]) {
      const hornM = mesh(new THREE.ConeGeometry(0.008, 0.035, 8), toon("#f3ead2"), 0.003);
      hornM.position.set(0.035 * side, 0.045, -0.005);
      hornM.rotation.z = -0.55 * side;
      this.head.add(hornM);
      const ear = mesh(new THREE.SphereGeometry(0.015, 10, 8), red, 0.003);
      ear.scale.set(1.5, 0.5, 0.9);
      ear.position.set(0.052 * side, 0.012, -0.012);
      ear.rotation.z = 0.35 * side;
      this.head.add(ear);
    }
    // collar: gold band where the head meets the body
    const collar = mesh(new THREE.TorusGeometry(0.03, 0.006, 6, 20), gold, 0.002);
    collar.position.set(0, 0.125, 0.085);
    collar.rotation.x = Math.PI / 2 - 0.5;
    this.root.add(collar);

    this.root.scale.setScalar(opts.height ?? 1);
  }

  /** Same state contract as Character/VrmCharacter; poses/wiggle are ignored (a toy has no arms). */
  apply(state: { root: { x: number; y: number; z: number; ry: number }; joints: Joints; look: { yaw: number; pitch: number }; face: FaceState; breath: number; wiggle: number; time: number; mora?: number }) {
    const { root, look, face, time } = state;
    this.root.position.set(root.x, root.y, root.z);
    this.root.rotation.y = root.ry;
    // deterministic: talking = one nod per mora, idle = slow residual sway; no stored state between frames
    const talk = Math.max(0, Math.min(1, face.mouth));
    const idle = Math.sin(time * 2.6) * 0.06 + Math.sin(time * 1.1) * 0.03;
    const nod = talk * 0.32;
    this.neck.rotation.set(look.pitch + idle + nod, look.yaw, Math.sin(time * 1.7) * 0.03);
    this.body.rotation.z = Math.sin(time * 1.75) * 0.008 * (1 + state.breath * 0.2);
    const open = Math.max(0.08, face.eyes);
    for (const e of this.eyes) e.scale.set(1 + face.brow * 0.3, open, 1);
  }
}

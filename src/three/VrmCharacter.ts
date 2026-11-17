import * as THREE from "three";
import { VRMUtils, type VRM, type VRMHumanBoneName } from "@pixiv/three-vrm";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { FaceState, Joints } from "./Character";

/**
 * VRM avatar driven by the same joint/face numbers as the procedural Character,
 * so productions can swap `style` for `vrm` without touching their beats.
 *
 * Our joint convention: character faces +Z, arms hang along -Y, shoulderX<0 raises
 * forward, elbow<0 bends forward. We convert that to target bone directions and
 * aim the VRM's normalized humanoid bones at them (rest pose independent).
 */
const VISEMES = ["aa", "oh", "aa", "ih", "ou", "ee"] as const;

export class VrmCharacter {
  readonly root = new THREE.Group();
  private vrm: VRM;
  private conj = new THREE.Quaternion();
  private rest = new Map<string, THREE.Vector3>();
  private scale = 1;

  private seated = false;

  constructor(readonly id: string, gltf: GLTF, opts: { height?: number; turn?: number; seated?: boolean } = {}) {
    this.seated = !!opts.seated;
    const vrm = gltf.userData.vrm as VRM | undefined;
    if (!vrm) throw new Error(`${id}: file is not a VRM`);
    // independent copy per actor
    this.vrm = vrm;
    const isV0 = vrm.meta?.metaVersion === "0";
    VRMUtils.rotateVRM0(vrm);
    // normalized bones live in model space; VRM0 models face -Z there
    if (isV0) this.conj.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
    vrm.scene.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; } });
    vrm.humanoid.resetNormalizedPose();
    vrm.scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(vrm.scene);
    const h = box.max.y - box.min.y;
    this.scale = (opts.height ?? 1.62) / Math.max(0.1, h);
    // some models are authored facing the other way; `turn` (degrees) fixes that per actor
    const facing = new THREE.Group();
    facing.rotation.y = ((opts.turn ?? 0) * Math.PI) / 180;
    facing.add(vrm.scene);
    this.root.add(facing);
    this.root.scale.setScalar(this.scale);
    for (const [bone, child] of [["leftUpperArm", "leftLowerArm"], ["leftLowerArm", "leftHand"], ["rightUpperArm", "rightLowerArm"], ["rightLowerArm", "rightHand"]] as const) {
      const a = this.node(bone), b = this.node(child);
      if (!a || !b) continue;
      this.rest.set(bone, b.position.clone().normalize());
    }
  }

  private node(name: VRMHumanBoneName) { return this.vrm.humanoid.getNormalizedBoneNode(name); }

  /** character-space quaternion -> model space */
  private toModel(q: THREE.Quaternion) { return this.conj.clone().multiply(q).multiply(this.conj.clone().invert()); }

  private aimArm(side: "left" | "right", sx: number, sz: number, elbow: number) {
    const upper = this.node(`${side}UpperArm`), lower = this.node(`${side}LowerArm`);
    const restU = this.rest.get(`${side}UpperArm`), restL = this.rest.get(`${side}LowerArm`);
    if (!upper || !lower || !restU || !restL) return;
    // procedural arm: Rx(sx)·Rz(sz) applied to (0,-1,0); elbow: extra Rx(elbow) in shoulder frame
    const rSh = new THREE.Quaternion().setFromEuler(new THREE.Euler(sx, 0, sz, "XYZ"));
    const dU = new THREE.Vector3(0, -1, 0).applyQuaternion(rSh).applyQuaternion(this.conj);
    const rEl = rSh.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), elbow));
    const dL = new THREE.Vector3(0, -1, 0).applyQuaternion(rEl).applyQuaternion(this.conj);
    // keep the palm/twist sensible: rotate rest->target with minimal arc
    const qU = new THREE.Quaternion().setFromUnitVectors(restU, dU);
    upper.quaternion.copy(qU);
    const dLlocal = dL.clone().applyQuaternion(qU.clone().invert());
    lower.quaternion.setFromUnitVectors(restL, dLlocal.normalize());
  }

  apply(state: { root: { x: number; y: number; z: number; ry: number; rx?: number }; joints: Joints; look: { yaw: number; pitch: number }; face: FaceState; breath: number; wiggle: number; time: number; mora?: number }) {
    const { root, joints: j, look, face } = state;
    this.root.position.set(root.x, root.y, root.z);
    // rx tilts the whole body back (>0) or forward, e.g. a reclined dental chair; applied after the yaw
    this.root.rotation.set(root.rx ?? 0, root.ry, 0, "YXZ");
    const spine = this.node("spine"), chest = this.node("chest") ?? this.node("upperChest"), neck = this.node("neck"), head = this.node("head");
    if (spine) spine.quaternion.copy(this.toModel(new THREE.Quaternion().setFromEuler(new THREE.Euler((j.spineX ?? 0) * 0.6, (j.spineY ?? 0) * 0.6, 0))));
    if (chest) chest.quaternion.copy(this.toModel(new THREE.Quaternion().setFromEuler(new THREE.Euler((j.spineX ?? 0) * 0.4 + state.breath * 0.01, (j.spineY ?? 0) * 0.4, 0))));
    const lookQ = this.toModel(new THREE.Quaternion().setFromEuler(new THREE.Euler((look.pitch - (j.spineX ?? 0) * 0.5) * 0.5, look.yaw * 0.5, 0, "YXZ")));
    if (neck) neck.quaternion.copy(lookQ);
    if (head) head.quaternion.copy(lookQ);
    const wig = state.wiggle ? Math.sin(state.time * 31) * 0.06 * state.wiggle + Math.sin(state.time * 13) * 0.05 * state.wiggle : 0;
    // procedural "left" (+X when facing +Z) is the character's left
    this.aimArm("left", j.shoulderLX ?? 0, j.shoulderLZ ?? 0, j.elbowL ?? 0);
    this.aimArm("right", j.shoulderRX ?? 0, j.shoulderRZ ?? 0, (j.elbowR ?? 0) + wig);
    if (this.seated) {
      // thighs forward (+Z), shins straight down
      for (const side of ["left", "right"] as const) {
        const ul = this.node(`${side}UpperLeg`), ll = this.node(`${side}LowerLeg`);
        if (ul) ul.quaternion.copy(this.toModel(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2)));
        if (ll) ll.quaternion.copy(this.toModel(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2)));
      }
    }
    const em = this.vrm.expressionManager;
    if (em) {
      for (const v of new Set(VISEMES)) em.setValue(v, 0);
      const open = Math.max(0, Math.min(1, face.mouth));
      if (open > 0) em.setValue(VISEMES[(state.mora ?? 0) % VISEMES.length]!, open);
      // face.jaw: extra mouth opening on the "aa" shape; values above 1 exaggerate the blend shape
      // (setValue clamps to 0..1, so the weight is written directly)
      const jaw = face.jaw ?? 0;
      if (jaw > 0) {
        const aa = em.getExpression("aa");
        if (aa) aa.weight = Math.max(jaw, aa.weight);
      }
      em.setValue("blink", Math.max(0, Math.min(1, 1 - face.eyes)));
      // map procedural face numbers onto VRM emotion presets when the model has them
      const clamp = (v: number) => Math.max(0, Math.min(1, v));
      em.setValue("happy", clamp(face.smile * 1.2));
      em.setValue("sad", clamp(-face.smile * 1.4));
      em.setValue("angry", clamp((-face.brow - 0.12) * 2.5));
      em.setValue("surprised", clamp((face.brow - 0.2) * 3));
    }
    this.vrm.update(0);
  }
}

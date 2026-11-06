import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRMLoaderPlugin } from "@pixiv/three-vrm";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { Timeline } from "./types";

/**
 * External CC0 3D assets (KayKit glTF props, 100Avatars VRM characters).
 * Every file must be vendored under assets/3d/ and listed in catalog/assets3d.json.
 * Loading is async, so everything a timeline references is preloaded before
 * the first frame; the Director then stays synchronous and deterministic.
 */
export type AssetCache = Map<string, GLTF>;

export function referencedAssets(tl: Timeline): string[] {
  const out = new Set<string>();
  for (const a of Object.values(tl.actors)) if (a.vrm) out.add(a.vrm);
  for (const p of Object.values(tl.props)) if (p.kind === "gltf" && typeof p.params?.src === "string") out.add(p.params.src);
  return [...out];
}

export async function preloadAssets(tl: Timeline, base = "/"): Promise<AssetCache> {
  const loader = new GLTFLoader();
  loader.register((parser) => new VRMLoaderPlugin(parser));
  const cache: AssetCache = new Map();
  await Promise.all(referencedAssets(tl).map(async (src) => {
    if (!/^assets\/3d\/[A-Za-z0-9._/-]+$/.test(src) || src.includes("..")) throw new Error(`3D asset must live under assets/3d/: ${src}`);
    cache.set(src, await loader.loadAsync(base + src));
  }));
  return cache;
}

/**
 * Clone a glTF scene as a prop (skeleton-aware, so rigged characters can be placed many times).
 * If the file has animation clips, params.clip names one; it is evaluated from the timeline time
 * (params.clipSpeed, params.clipLoop default true) so frames stay deterministic.
 */
export function gltfProp(cache: AssetCache, src: string, params: Record<string, unknown>): { object: THREE.Object3D; animate?: (t: number) => void } {
  const g = cache.get(src);
  if (!g) throw new Error(`asset not preloaded: ${src}`);
  const obj = cloneSkinned(g.scene);
  obj.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; } });
  const wrap = new THREE.Group();
  wrap.add(obj);
  const s = typeof params.scale === "number" ? params.scale : 1;
  obj.scale.setScalar(s);
  const clipName = typeof params.clip === "string" ? params.clip : null;
  if (!clipName) return { object: wrap };
  const clip = g.animations.find((c) => c.name === clipName);
  if (!clip) throw new Error(`${src}: no animation clip "${clipName}" (has: ${g.animations.map((c) => c.name).join(", ")})`);
  const mixer = new THREE.AnimationMixer(obj);
  const action = mixer.clipAction(clip);
  action.play();
  const speed = typeof params.clipSpeed === "number" ? params.clipSpeed : 1;
  const loop = params.clipLoop !== false;
  return {
    object: wrap,
    animate: (t: number) => {
      let x = t * speed;
      x = loop ? x % clip.duration : Math.min(x, clip.duration - 1e-3);
      mixer.setTime(x);
    }
  };
}

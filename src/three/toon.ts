import * as THREE from "three";

/** Shared look for the 3D line: 3-step toon ramp + inverted-hull outlines. */
let ramp: THREE.DataTexture | null = null;

export function toonRamp(): THREE.DataTexture {
  if (ramp) return ramp;
  const steps = [90, 170, 255];
  const data = new Uint8Array(steps.length * 4);
  steps.forEach((v, i) => data.set([v, v, v, 255], i * 4));
  ramp = new THREE.DataTexture(data, steps.length, 1, THREE.RGBAFormat);
  ramp.minFilter = THREE.NearestFilter;
  ramp.magFilter = THREE.NearestFilter;
  ramp.needsUpdate = true;
  return ramp;
}

const cache = new Map<string, THREE.Material>();

export function toon(color: string | number, opts: { emissive?: string | number; transparent?: boolean; opacity?: number; map?: THREE.Texture } = {}): THREE.MeshToonMaterial {
  const key = JSON.stringify([color, opts.emissive, opts.transparent, opts.opacity, opts.map?.uuid]);
  const hit = cache.get(key);
  if (hit) return hit as THREE.MeshToonMaterial;
  const m = new THREE.MeshToonMaterial({
    color: new THREE.Color(color),
    gradientMap: toonRamp(),
    emissive: opts.emissive !== undefined ? new THREE.Color(opts.emissive) : new THREE.Color(0x000000),
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
    map: opts.map ?? null
  });
  cache.set(key, m);
  return m;
}

export function flat(color: string | number): THREE.MeshBasicMaterial {
  const key = "flat" + color;
  const hit = cache.get(key);
  if (hit) return hit as THREE.MeshBasicMaterial;
  const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color) });
  cache.set(key, m);
  return m;
}

const outlineCache = new Map<number, THREE.ShaderMaterial>();

/** Normal-extruded back faces. Thickness is in object units. */
export function outlineMaterial(thickness = 0.008): THREE.ShaderMaterial {
  const hit = outlineCache.get(thickness);
  if (hit) return hit;
  const m = new THREE.ShaderMaterial({
    uniforms: { thickness: { value: thickness }, color: { value: new THREE.Color(0x1d1a20) } },
    vertexShader: `
      uniform float thickness;
      void main() {
        vec3 p = position + normalize(normal) * thickness;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `uniform vec3 color; void main(){ gl_FragColor = vec4(color, 1.0); }`,
    side: THREE.BackSide
  });
  outlineCache.set(thickness, m);
  return m;
}

/** Mesh with toon material, shadows and an outline shell. */
export function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, outline: number | false = 0.008): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  if (outline !== false) {
    const o = new THREE.Mesh(geo, outlineMaterial(outline));
    o.castShadow = false;
    o.receiveShadow = false;
    o.userData.outline = true;
    m.add(o);
  }
  return m;
}

export const JP_FONT = `"Noto Sans CJK JP", "Noto Sans JP", "Hiragino Sans", sans-serif`;

/** Canvas texture helper for paper, labels, screens. */
export function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Deterministic pseudo-random in [0,1). */
export function rand(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

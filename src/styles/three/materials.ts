import * as THREE from "three";
import { toonRamp } from "../../three/toon";

/** Material factory per 3D look (toon, flat, soft, clay, voxel, ps2, horror, studio, studio-dark). */
export class Mats {
  private cache = new Map<string, THREE.Material>();
  private bump: THREE.Texture | null = null;
  private grain: THREE.Texture | null = null;
  constructor(public look: string) {}

  private clayBump(): THREE.Texture {
    if (this.bump) return this.bump;
    const c = document.createElement("canvas"); c.width = c.height = 256;
    const g = c.getContext("2d")!;
    g.fillStyle = "#808080"; g.fillRect(0, 0, 256, 256);
    let s = 7;
    const r = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    // thumb prints and smears
    for (let i = 0; i < 260; i++) {
      const x = r() * 256, y = r() * 256, rad = 4 + r() * 18;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      const v = r() > 0.5 ? 255 : 0;
      gr.addColorStop(0, `rgba(${v},${v},${v},0.18)`); gr.addColorStop(1, "rgba(128,128,128,0)");
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
    }
    this.bump = new THREE.CanvasTexture(c);
    this.bump.wrapS = this.bump.wrapT = THREE.RepeatWrapping;
    return this.bump;
  }

  private voxelGrain(): THREE.Texture {
    if (this.grain) return this.grain;
    const c = document.createElement("canvas"); c.width = c.height = 16;
    const g = c.getContext("2d")!;
    let s = 3;
    const r = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const v = 205 + Math.floor(r() * 50); g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x, y, 1, 1); }
    this.grain = new THREE.CanvasTexture(c);
    this.grain.magFilter = THREE.NearestFilter; this.grain.minFilter = THREE.NearestFilter;
    this.grain.colorSpace = THREE.SRGBColorSpace;
    return this.grain;
  }

  body(color: string, opts: { emissive?: string; opacity?: number } = {}): THREE.Material {
    const key = `${color}|${opts.emissive ?? ""}|${opts.opacity ?? 1}`;
    const hit = this.cache.get(key);
    if (hit) return hit;
    const col = new THREE.Color(color);
    const transparent = (opts.opacity ?? 1) < 1;
    const common = { color: col, transparent, opacity: opts.opacity ?? 1, emissive: new THREE.Color(opts.emissive ?? "#000000") };
    let m: THREE.Material;
    switch (this.look) {
      case "toon": m = new THREE.MeshToonMaterial({ ...common, gradientMap: toonRamp() }); break;
      case "flat": m = new THREE.MeshLambertMaterial({ ...common, flatShading: true }); break;
      case "ps2": m = snap(new THREE.MeshLambertMaterial({ ...common, flatShading: true })); break;
      case "clay": m = new THREE.MeshStandardMaterial({ ...common, roughness: 1, metalness: 0, bumpMap: this.clayBump(), bumpScale: 1.2 }); break;
      case "voxel": m = new THREE.MeshLambertMaterial({ ...common, map: this.voxelGrain() }); break;
      case "horror": m = new THREE.MeshStandardMaterial({ ...common, roughness: 0.95, metalness: 0 }); break;
      case "studio-dark": m = new THREE.MeshStandardMaterial({ ...common, roughness: 0.45, metalness: 0.25 }); break;
      default: m = new THREE.MeshStandardMaterial({ ...common, roughness: 0.82, metalness: 0, flatShading: this.look === "soft" ? false : false });
    }
    this.cache.set(key, m);
    return m;
  }
}

/** PS2-era wobble: snap clip-space vertices to a coarse grid. */
function snap<T extends THREE.Material>(m: T): T {
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace(
      "#include <project_vertex>",
      `#include <project_vertex>
       vec2 grid = vec2(160.0, 284.0);
       gl_Position.xy = floor(gl_Position.xy / gl_Position.w * grid + 0.5) / grid * gl_Position.w;`
    );
  };
  return m;
}

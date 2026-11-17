import * as THREE from "three";
import type { StyleDef } from "../themes";
import type { Mats } from "./materials";
import { drawIcon } from "../icons";

/** 3D props; any other kind becomes a billboard of the 2D pictogram with the same name. */
const m3 = (geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; return o; };

const iconCache = new Map<string, THREE.Texture>();
export function iconTexture(name: string, st: StyleDef, ink = "#1a1a1a"): THREE.Texture {
  const key = `${name}|${st.id}|${ink}`;
  const hit = iconCache.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas"); c.width = c.height = 256;
  const g = c.getContext("2d")!;
  drawIcon(g, name, 128, 128, 220, { ink, fill: "#ffffff", accent: st.accent, line: 0.05 });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  iconCache.set(key, t);
  return t;
}

export function buildProp(kind: string, st: StyleDef, m: Mats, color?: string): THREE.Object3D {
  const g = new THREE.Group();
  const flat = m.look === "flat" || m.look === "ps2" || m.look === "voxel";
  const seg = flat ? 6 : 20;
  switch (kind) {
    case "rocket": {
      g.add(m3(new THREE.CylinderGeometry(0.16, 0.2, 0.7, seg), m.body(color ?? "#f4f4f4"), 0, 0.45, 0));
      g.add(m3(new THREE.ConeGeometry(0.16, 0.32, seg), m.body("#e8463a"), 0, 0.96, 0));
      g.add(m3(new THREE.CylinderGeometry(0.07, 0.07, 0.03, seg), m.body("#4aa3ff"), 0, 0.6, 0.17).rotateX(Math.PI / 2));
      for (let i = 0; i < 3; i++) { const f = m3(new THREE.BoxGeometry(0.03, 0.22, 0.16), m.body("#e8463a"), 0, 0.2, 0); f.position.set(Math.cos((i / 3) * Math.PI * 2) * 0.2, 0.2, Math.sin((i / 3) * Math.PI * 2) * 0.2); f.rotation.y = -(i / 3) * Math.PI * 2; g.add(f); }
      const flame = m3(new THREE.ConeGeometry(0.12, 0.4, seg), m.body("#ffb02e", { emissive: "#ff7a00" }), 0, -0.05, 0); flame.rotation.x = Math.PI; flame.name = "flame"; flame.visible = false; g.add(flame);
      break;
    }
    case "moon": g.add(m3(new THREE.SphereGeometry(0.5, flat ? 8 : 32, flat ? 6 : 24), m.body("#f4f1d8", { emissive: "#55533f" }), 0, 0.5, 0)); break;
    case "sun": g.add(m3(new THREE.SphereGeometry(0.5, flat ? 8 : 32, 16), m.body("#ffd23f", { emissive: "#d9a400" }), 0, 0.5, 0)); break;
    case "flag": g.add(m3(new THREE.CylinderGeometry(0.02, 0.02, 1, 8), m.body("#dddddd"), 0, 0.5, 0)); g.add(m3(new THREE.BoxGeometry(0.4, 0.26, 0.02), m.body(color ?? "#e8463a"), 0.2, 0.85, 0)); break;
    case "tree": g.add(m3(new THREE.CylinderGeometry(0.06, 0.09, 0.6, flat ? 5 : 10), m.body("#8a5a33"), 0, 0.3, 0)); g.add(m3(flat ? new THREE.IcosahedronGeometry(0.4, 0) : new THREE.SphereGeometry(0.4, 16, 12), m.body("#4fae4a"), 0, 0.85, 0)); break;
    case "box": g.add(m3(new THREE.BoxGeometry(0.5, 0.5, 0.5), m.body(color ?? "#c98f5a"), 0, 0.25, 0)); break;
    case "coin": { const c = m3(new THREE.CylinderGeometry(0.3, 0.3, 0.06, seg * 2), m.body("#f2c230", { emissive: "#5a4500" }), 0, 0.35, 0); c.rotation.x = Math.PI / 2; g.add(c); break; }
    case "phone": g.add(m3(new THREE.BoxGeometry(0.34, 0.66, 0.05), m.body("#222222"), 0, 0.4, 0)); g.add(m3(new THREE.BoxGeometry(0.3, 0.58, 0.01), m.body("#5be0ff", { emissive: "#1a6f80" }), 0, 0.4, 0.03)); break;
    case "house": { g.add(m3(new THREE.BoxGeometry(1, 0.8, 0.9), m.body(color ?? "#ffe0b2"), 0, 0.4, 0)); const r = m3(new THREE.ConeGeometry(0.8, 0.5, 4), m.body("#e8463a"), 0, 1.05, 0); r.rotation.y = Math.PI / 4; g.add(r); break; }
    case "cloud": for (const [x, y, r] of [[-0.3, 0, 0.28], [0, 0.1, 0.36], [0.32, 0, 0.26]] as const) g.add(m3(new THREE.SphereGeometry(r, seg, 10), m.body("#ffffff"), x, y + 0.4, 0)); break;
    case "pin": {
      const col = m.body(color ?? st.accent2);
      g.add(m3(new THREE.ConeGeometry(0.16, 0.42, 24), col, 0, 0.21, 0).rotateX(Math.PI));
      g.add(m3(new THREE.SphereGeometry(0.2, 24, 16), col, 0, 0.5, 0));
      g.add(m3(new THREE.SphereGeometry(0.08, 16, 12), m.body("#ffffff"), 0, 0.5, 0.15));
      break;
    }
    default: {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: iconTexture(kind, st), transparent: true }));
      sp.scale.set(0.8, 0.8, 1); sp.position.y = 0.4; g.add(sp);
    }
  }
  return g;
}

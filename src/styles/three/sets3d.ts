import * as THREE from "three";
import type { StyleDef } from "../themes";
import type { Mats } from "./materials";

/** 3D sets for Style Shorts. The stage floor is y=0; actors stand around x∈[-0.8,0.8], z≈0. */
export interface Built3D { group: THREE.Group; bg: string; fog?: [string, number, number]; cam?: { pos: [number, number, number]; target: [number, number, number]; fov?: number } }

type Builder = (st: StyleDef, m: Mats) => Built3D;

const rng = (seed: number) => { let s = seed; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; };
const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0, cast = true) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.castShadow = cast; o.receiveShadow = true; return o; };
const ground = (m: Mats, color: string, size = 60) => { const g = mesh(new THREE.PlaneGeometry(size, size), m.body(color), 0, 0, 0, false); g.rotation.x = -Math.PI / 2; return g; };

function cloud(m: Mats, color = "#ffffff", detail = 12) {
  const g = new THREE.Group();
  for (const [x, y, r] of [[-0.35, 0, 0.32], [0, 0.12, 0.42], [0.38, 0, 0.3], [0.15, -0.05, 0.3]] as const) g.add(mesh(new THREE.SphereGeometry(r, detail, Math.max(4, detail - 4)), m.body(color), x, y, 0, false));
  return g;
}
function tree(m: Mats, kind: string, h = 1) {
  const g = new THREE.Group();
  if (kind === "voxel") {
    g.add(mesh(new THREE.BoxGeometry(0.2, 0.8 * h, 0.2), m.body("#7a4f2a"), 0, 0.4 * h, 0));
    g.add(mesh(new THREE.BoxGeometry(0.8, 0.6, 0.8), m.body("#3f8f2f"), 0, 0.95 * h, 0));
    g.add(mesh(new THREE.BoxGeometry(0.4, 0.3, 0.4), m.body("#3f8f2f"), 0, 1.35 * h, 0));
  } else {
    g.add(mesh(new THREE.CylinderGeometry(0.06, 0.09, 0.7 * h, kind === "flat" ? 5 : 10), m.body("#8a5a33"), 0, 0.35 * h, 0));
    g.add(mesh(kind === "flat" ? new THREE.IcosahedronGeometry(0.42, 0) : new THREE.SphereGeometry(0.42, 16, 12), m.body("#4fae4a"), 0, 0.95 * h, 0));
  }
  return g;
}
function house(m: Mats, wall: string, roof: string) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(1.2, 0.9, 1), m.body(wall), 0, 0.45, 0));
  const r = mesh(new THREE.ConeGeometry(0.95, 0.6, 4), m.body(roof), 0, 1.2, 0); r.rotation.y = Math.PI / 4; g.add(r);
  g.add(mesh(new THREE.BoxGeometry(0.26, 0.42, 0.02), m.body("#6b4226"), 0, 0.21, 0.51));
  g.add(mesh(new THREE.BoxGeometry(0.24, 0.22, 0.02), m.body("#bfe6ff"), 0.36, 0.55, 0.51));
  return g;
}

export const SETS3D: Record<string, Builder> = {
  studio: (st, m) => { const g = new THREE.Group(); g.add(ground(m, st.paper)); return { group: g, bg: st.bg }; },
  town: (_st, m) => {
    const g = new THREE.Group();
    g.add(ground(m, "#8fd16a"));
    const road = mesh(new THREE.PlaneGeometry(60, 1.2), m.body("#d9d2c2"), 0, 0.005, 0.2, false); road.rotation.x = -Math.PI / 2; g.add(road);
    const cols = [["#ffe0b2", "#e8463a"], ["#cfe8ff", "#2f6fdb"], ["#fff4c2", "#ff8a3d"], ["#e0f5d9", "#4a9e5c"]];
    for (let i = 0; i < 5; i++) { const h = house(m, cols[i % 4]![0]!, cols[i % 4]![1]!); h.position.set(-3 + i * 1.6, 0, -2.6 - (i % 2) * 0.6); g.add(h); }
    for (const x of [-1.6, 1.7, 3.4]) { const tr = tree(m, "toon"); tr.position.set(x, 0, -1.4); g.add(tr); }
    for (const [x, y, z] of [[-2, 3.4, -6], [1.8, 3.9, -7]] as const) { const c = cloud(m); c.position.set(x, y, z); c.scale.setScalar(1.4); g.add(c); }
    return { group: g, bg: "#9fd3ff" };
  },
  desert: (_st, m) => {
    const g = new THREE.Group();
    g.add(ground(m, "#f0c48a"));
    const r = rng(5);
    for (let i = 0; i < 7; i++) { const h = 1.2 + r() * 2.4; const c = mesh(new THREE.ConeGeometry(h * 0.55, h, 48), m.body(["#e7a35f", "#efb571", "#dc9550"][i % 3]!), (r() - 0.5) * 9, h / 2, -3 - r() * 7); g.add(c); }
    const crater = mesh(new THREE.TorusGeometry(0.9, 0.12, 12, 48), m.body("#d99a5a"), 0.4, 0.02, -1.4); crater.rotation.x = -Math.PI / 2; crater.scale.z = 0.4; g.add(crater);
    const hole = mesh(new THREE.CircleGeometry(0.85, 40), m.body("#a8622f"), 0.4, 0.012, -1.4, false); hole.rotation.x = -Math.PI / 2; g.add(hole);
    for (const [x, y, z, s] of [[-1.6, 3.2, -5, 1.3], [2.2, 2.6, -4, 1], [0.4, 4.2, -8, 1.8]] as const) { const c = cloud(m, "#fff6ea", 20); c.position.set(x, y, z); c.scale.setScalar(s); g.add(c); }
    return { group: g, bg: "#ffd9a8", fog: ["#ffd9a8", 8, 26] };
  },
  "space-rocks": (_st, m) => {
    const g = new THREE.Group();
    const planet = mesh(new THREE.IcosahedronGeometry(14, 3), m.body("#5a5a8a"), 0, -14, -2, false); g.add(planet);
    const r = rng(9);
    for (let i = 0; i < 14; i++) { const s = 0.2 + r() * 0.9; const a = mesh(new THREE.IcosahedronGeometry(s, 0), m.body(["#c9c3ff", "#8a84c8", "#ff8a3d"][i % 3]!), (r() - 0.5) * 10, 1 + r() * 6, -3 - r() * 8); a.rotation.set(r() * 3, r() * 3, 0); a.userData.spin = (r() - 0.5) * 0.4; g.add(a); }
    const pts = new THREE.BufferGeometry(); const arr: number[] = [];
    for (let i = 0; i < 600; i++) arr.push((r() - 0.5) * 80, r() * 40 - 5, -20 - r() * 20);
    pts.setAttribute("position", new THREE.Float32BufferAttribute(arr, 3));
    g.add(new THREE.Points(pts, new THREE.PointsMaterial({ color: "#ffffff", size: 0.12 })));
    const moon = mesh(new THREE.IcosahedronGeometry(1.6, 1), m.body("#f4f1d8"), 3.2, 6.5, -12, false); g.add(moon);
    return { group: g, bg: "#20203a" };
  },
  "city-white": (_st, m) => {
    const g = new THREE.Group();
    g.add(ground(m, "#dedede", 80));
    const r = rng(17);
    const white = m.body("#fbfbfb");
    for (let ix = -8; ix <= 8; ix++) for (let iz = -10; iz <= 4; iz++) {
      if (ix % 3 === 0 || iz % 3 === 0) continue;
      const h = 0.25 + r() * (Math.abs(ix) < 5 && iz > -8 ? 0.9 : 2.2);
      g.add(mesh(new THREE.BoxGeometry(0.85, h, 0.85), white, ix, h / 2, iz));
    }
    return { group: g, bg: "#f2f2f2", cam: { pos: [3.5, 6.5, 6.5], target: [0, 0, -1.5], fov: 45 } };
  },
  "void-dark": (st, m) => {
    const g = new THREE.Group();
    const grid = new THREE.GridHelper(40, 80, "#2a2f3a", "#1a1e27"); grid.position.y = -0.6; g.add(grid);
    void m; void st;
    return { group: g, bg: "#0d0f14", fog: ["#0d0f14", 6, 20] };
  },
  "voxel-hills": (_st, m) => {
    const g = new THREE.Group();
    const grass = m.body("#5aa83a"), dirt = m.body("#8b5a2b"), stone = m.body("#8a8a8a");
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const r = rng(23);
    for (let x = -9; x <= 9; x++) for (let z = -14; z <= 3; z++) {
      const h = z > -2 && Math.abs(x) < 3 ? 0 : Math.max(0, Math.round(Math.sin(x * 0.5) * 1.2 + Math.cos(z * 0.4) * 1.5 + (z < -6 ? 2 : 0) + r() * 0.6));
      for (let y = 0; y <= h; y++) g.add(mesh(geo, y === h ? grass : y < h - 2 ? stone : dirt, x * 1, y - 0.5, z));
    }
    for (const [x, z] of [[-3, -3], [3.5, -4], [-6, -6], [6, -2]] as const) { const tr = tree(m, "voxel", 1.6); tr.position.set(x, 0.5 + Math.max(0, Math.round(Math.sin(x * 0.5) * 1.2 + Math.cos(z * 0.4) * 1.5)), z); g.add(tr); }
    return { group: g, bg: "#8ecbff", fog: ["#8ecbff", 10, 24] };
  },
  "brick-sky": (_st, m) => {
    const g = new THREE.Group();
    const base = m.body("#237841");
    g.add(mesh(new THREE.BoxGeometry(12, 0.1, 8), base, 0, -0.05, -2));
    const stud = new THREE.CylinderGeometry(0.06, 0.06, 0.05, 12);
    const inst = new THREE.InstancedMesh(stud, base, 24 * 16);
    let k = 0; const mat = new THREE.Matrix4();
    for (let x = 0; x < 24; x++) for (let z = 0; z < 16; z++) { mat.setPosition(-6 + 0.25 + x * 0.5, 0.025, -6 + 0.25 + z * 0.5); inst.setMatrixAt(k++, mat); }
    inst.receiveShadow = true; g.add(inst);
    const colors = ["#e3000b", "#ffcc00", "#0055bf", "#ffffff"];
    const r = rng(31);
    for (let i = 0; i < 16; i++) {
      const w = r() > 0.5 ? 1 : 0.5, x = -4.5 + (i % 8) * 1.2, z = -3 - Math.floor(i / 8) * 1.4, y = 0.2 + (i % 3) * 0.4;
      const b = new THREE.Group();
      b.add(mesh(new THREE.BoxGeometry(w, 0.4, 0.5), m.body(colors[i % 4]!), 0, 0, 0));
      for (let sx = 0; sx < w / 0.5; sx++) b.add(mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.08, 14), m.body(colors[i % 4]!), -w / 2 + 0.25 + sx * 0.5, 0.24, 0));
      b.position.set(x, y, z); g.add(b);
    }
    return { group: g, bg: "#7fd1ff" };
  },
  "backyard-night": (_st, m) => {
    const g = new THREE.Group();
    g.add(ground(m, "#2c3e2c"));
    for (let i = -6; i <= 6; i++) { g.add(mesh(new THREE.BoxGeometry(0.18, 1.2, 0.06), m.body("#6b5236"), i * 0.5, 0.6, -2.5)); }
    g.add(mesh(new THREE.BoxGeometry(6.5, 0.1, 0.08), m.body("#5a4430"), 0, 0.9, -2.45));
    const tr = tree(m, "flat", 2.2); tr.position.set(-2.2, 0, -3.4); g.add(tr);
    const moon = mesh(new THREE.SphereGeometry(0.8, 8, 6), m.body("#f4f1d8", { emissive: "#c9c6a8" }), 2.2, 5.5, -10, false); g.add(moon);
    const house = mesh(new THREE.BoxGeometry(3, 2.4, 2), m.body("#3b5f8f"), 3.6, 1.2, -4.5); g.add(house);
    g.add(mesh(new THREE.BoxGeometry(0.6, 0.5, 0.05), m.body("#ffd23f", { emissive: "#ffb000" }), 3.0, 1.5, -3.47, false));
    return { group: g, bg: "#2b3a5a", fog: ["#2b3a5a", 4, 16] };
  },
  "dark-corridor": (_st, m) => {
    const g = new THREE.Group();
    const wall = m.body("#2a2a33"), floor = m.body("#1a1a22");
    g.add(mesh(new THREE.BoxGeometry(3, 0.2, 40), floor, 0, -0.1, -15));
    for (const x of [-1.6, 1.6]) for (let z = 2; z > -34; z -= 1) g.add(mesh(new THREE.BoxGeometry(0.2, 3, 0.96), wall, x, 1.5, z));
    g.add(mesh(new THREE.BoxGeometry(3.4, 0.2, 40), wall, 0, 3.0, -15));
    for (let z = -2; z > -34; z -= 6) g.add(mesh(new THREE.BoxGeometry(0.4, 0.05, 0.4), m.body("#d8d8d8", { emissive: "#777777" }), 0, 2.88, z, false));
    return { group: g, bg: "#050507", fog: ["#050507", 2, 12] };
  },
  "clay-sky": (_st, m) => {
    const g = new THREE.Group();
    g.add(ground(m, "#8fcf6a"));
    for (const [x, z, s, c] of [[-3, -5, 3, "#7ac36a"], [2.5, -6, 3.6, "#9ad67a"], [0, -9, 5, "#6bb35a"]] as const) { const h = mesh(new THREE.SphereGeometry(1, 24, 16), m.body(c), x, 0, z); h.scale.set(s, s * 0.45, s * 0.8); g.add(h); }
    for (const [x, y, z, s] of [[-1.8, 3, -4, 1.1], [1.9, 3.6, -6, 1.4]] as const) { const c = cloud(m, "#f4f1ea", 20); c.position.set(x, y, z); c.scale.setScalar(s); g.add(c); }
    const sun = mesh(new THREE.SphereGeometry(0.7, 24, 16), m.body("#ffd23f", { emissive: "#c99a00" }), 2.4, 4.6, -8, false); g.add(sun);
    return { group: g, bg: "#bfe3ff" };
  },
  "avatar-room": (_st, m) => {
    const g = new THREE.Group();
    const tiles = new THREE.Group();
    for (let x = -6; x < 6; x++) for (let z = -8; z < 3; z++) { const t = mesh(new THREE.BoxGeometry(1, 0.1, 1), m.body((x + z) % 2 ? "#ffffff" : "#e8e0ff"), x + 0.5, -0.05, z + 0.5, false); tiles.add(t); }
    g.add(tiles);
    g.add(mesh(new THREE.BoxGeometry(12, 5, 0.3), m.body("#b48cff"), 0, 2.5, -4));
    g.add(mesh(new THREE.BoxGeometry(0.3, 5, 10), m.body("#9a6ff0"), -3.2, 2.5, 0));
    g.add(mesh(new THREE.BoxGeometry(1.8, 1.2, 0.1), m.body("#bfe6ff"), 1.2, 2.6, -3.82));
    g.add(mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.08, 32), m.body("#ffd23f"), 0, 0.04, 0, false));
    g.add(mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), m.body("#ff3b5c"), -2.2, 0.45, -2.2));
    return { group: g, bg: "#b48cff" };
  }
};

export function buildSet3D(name: string, st: StyleDef, m: Mats): Built3D {
  return (SETS3D[name] ?? SETS3D.studio!)(st, m);
}

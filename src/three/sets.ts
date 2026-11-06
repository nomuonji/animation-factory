import * as THREE from "three";
import { canvasTexture, flat, JP_FONT, mesh, rand, toon } from "./toon";

/**
 * Reusable sets. A set builds static geometry, lights and named camera
 * presets. Productions pick a set by `kind` and may add/override cameras.
 */
export interface CameraPreset { pos: [number, number, number]; target: [number, number, number]; fov?: number }
export interface BuiltSet { cameras: Record<string, CameraPreset>; surfaces: Record<string, number> }
export type SetBuilder = (scene: THREE.Scene, params: Record<string, unknown>) => BuiltSet;

function lights(scene: THREE.Scene, opts: { key?: number; warm?: boolean } = {}) {
  scene.add(new THREE.HemisphereLight(0xfffbf2, 0x9c9488, 1.5));
  const key = new THREE.DirectionalLight(0xffffff, opts.key ?? 1.6);
  key.position.set(1.2, 3.2, 2.0);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -2.5; key.shadow.camera.right = 2.5;
  key.shadow.camera.top = 2.5; key.shadow.camera.bottom = -2.5;
  key.shadow.camera.near = 0.5; key.shadow.camera.far = 8;
  key.shadow.bias = -0.0006;
  key.shadow.normalBias = 0.02;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xdfe8ff, 0.5);
  fill.position.set(-2, 1.6, -1.5);
  scene.add(fill);
}

function shelfWall(parent: THREE.Object3D, opts: { w: number; h: number; rows: number; cols: number; seed: number; palette: string[]; depth?: number }) {
  const g = new THREE.Group();
  const frame = toon("#e9e6df");
  const back = mesh(new THREE.BoxGeometry(opts.w, opts.h, 0.04), frame, 0.004);
  back.position.set(0, opts.h / 2, -0.02);
  g.add(back);
  const rowH = opts.h / opts.rows;
  for (let r = 0; r < opts.rows; r++) {
    const shelf = mesh(new THREE.BoxGeometry(opts.w, 0.025, opts.depth ?? 0.3), frame, 0.004);
    shelf.position.set(0, r * rowH + 0.0125, (opts.depth ?? 0.3) / 2);
    g.add(shelf);
    const pw = opts.w / opts.cols;
    for (let c = 0; c < opts.cols; c++) {
      const k = opts.seed + r * 31 + c * 7;
      const color = opts.palette[Math.floor(rand(k) * opts.palette.length)]!;
      const ph = rowH * (0.45 + rand(k + 1) * 0.35);
      const item = mesh(new THREE.BoxGeometry(pw * 0.78, ph, (opts.depth ?? 0.3) * 0.6), toon(color), 0.004);
      item.position.set(-opts.w / 2 + pw * (c + 0.5), r * rowH + 0.025 + ph / 2, (opts.depth ?? 0.3) * 0.45);
      g.add(item);
      if (rand(k + 3) > 0.45) {
        const band = new THREE.Mesh(new THREE.PlaneGeometry(pw * 0.6, ph * 0.22), flat(rand(k + 4) > 0.5 ? "#ffffff" : "#1e1e24"));
        band.position.set(item.position.x, item.position.y + ph * 0.1, (opts.depth ?? 0.3) * 0.75 + 0.001);
        g.add(band);
      }
    }
  }
  parent.add(g);
  return g;
}

export const SETS: Record<string, SetBuilder> = {
  /** Neutral cyclorama for character sheets, lineups and title shots. */
  studio(scene, p) {
    const bg = String(p.color ?? "#f3e9dc");
    scene.background = new THREE.Color(bg);
    lights(scene, { key: 1.4 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshToonMaterial({ color: new THREE.Color(bg), gradientMap: (toon("#fff") as THREE.MeshToonMaterial).gradientMap }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(30, 12), new THREE.MeshToonMaterial({ color: new THREE.Color(bg), gradientMap: (toon("#fff") as THREE.MeshToonMaterial).gradientMap }));
    wall.position.set(0, 6, -3); wall.receiveShadow = true; scene.add(wall);
    return {
      surfaces: { floor: 0 },
      cameras: {
        front: { pos: [0, 1.0, 4.2], target: [0, 0.75, 0], fov: 34 },
        close: { pos: [0, 1.3, 1.6], target: [0, 1.15, 0], fov: 32 }
      }
    };
  },

  "convenience-store"(scene, p) {
    scene.background = new THREE.Color("#ece9e2");
    lights(scene);
    const counterTop = 0.96;

    const floorTex = canvasTexture(512, 512, (g, w, h) => {
      g.fillStyle = "#d9d6cf"; g.fillRect(0, 0, w, h);
      g.fillStyle = "#cfccc4"; g.fillRect(0, 0, w / 2, h / 2); g.fillRect(w / 2, h / 2, w / 2, h / 2);
      g.strokeStyle = "#bdb9b0"; g.lineWidth = 3; g.strokeRect(0, 0, w, h); g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
    });
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(8, 8);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.MeshToonMaterial({ map: floorTex, gradientMap: (toon("#fff") as THREE.MeshToonMaterial).gradientMap }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // counter
    const counterColor = String(p.counterColor ?? "#8a9a92");
    const body = mesh(new THREE.BoxGeometry(2.8, counterTop - 0.04, 0.58), toon(counterColor));
    body.position.set(0, (counterTop - 0.04) / 2, 0);
    scene.add(body);
    const kick = mesh(new THREE.BoxGeometry(2.82, 0.08, 0.6), toon("#4b4f55"), 0.004);
    kick.position.set(0, 0.04, 0);
    scene.add(kick);
    const slab = mesh(new THREE.BoxGeometry(2.9, 0.04, 0.66), toon("#f1efe9"), 0.005);
    slab.position.set(0, counterTop - 0.02, 0);
    scene.add(slab);
    const stripe = mesh(new THREE.BoxGeometry(2.81, 0.05, 0.005), toon(String(p.stripe ?? "#e2b443")), false);
    stripe.position.set(0, counterTop - 0.12, 0.293);
    scene.add(stripe);

    // register (clerk's left = +x when clerk faces +z)
    const reg = new THREE.Group();
    const regBase = mesh(new THREE.BoxGeometry(0.34, 0.1, 0.3), toon("#3a3d44"), 0.005);
    regBase.position.y = 0.05; reg.add(regBase);
    const pole = mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.16, 10), toon("#2c2e33"), 0.004);
    pole.position.set(0, 0.17, -0.06); reg.add(pole);
    const screenTex = canvasTexture(320, 200, (g, w, h) => {
      g.fillStyle = "#102018"; g.fillRect(0, 0, w, h);
      g.fillStyle = "#8ef0b4"; g.font = `bold 34px ${JP_FONT}`; g.textAlign = "left"; g.fillText("おにぎり 梅", 18, 56);
      g.textAlign = "right"; g.font = `bold 54px ${JP_FONT}`; g.fillText(String(p.price ?? "¥160"), w - 18, 150);
    });
    const scr = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.17, 0.02), [flat("#222"), flat("#222"), flat("#222"), flat("#222"), new THREE.MeshBasicMaterial({ map: screenTex }), flat("#222")]);
    scr.position.set(0, 0.3, -0.05); scr.rotation.x = -0.25; reg.add(scr);
    // customer-facing small display
    const cust = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.015), [flat("#222"), flat("#222"), flat("#222"), flat("#222"), new THREE.MeshBasicMaterial({ map: canvasTexture(256, 128, (g, w, h) => { g.fillStyle = "#0e1a14"; g.fillRect(0, 0, w, h); g.fillStyle = "#8ef0b4"; g.font = `bold 60px ${JP_FONT}`; g.textAlign = "center"; g.fillText(String(p.price ?? "¥160"), w / 2, 84); }) }), flat("#222")]);
    cust.position.set(0, 0.33, -0.04); cust.rotation.y = Math.PI; reg.add(cust);
    reg.position.set(0.95, counterTop, -0.08);
    reg.rotation.y = 0.12;
    scene.add(reg);

    // hot-snack case
    const caseG = new THREE.Group();
    const caseBase = mesh(new THREE.BoxGeometry(0.5, 0.08, 0.36), toon("#c8402f"), 0.005);
    caseBase.position.y = 0.04; caseG.add(caseBase);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.3, 0.34), new THREE.MeshPhongMaterial({ color: 0xfff1d6, transparent: true, opacity: 0.22, shininess: 90 }));
    glass.position.y = 0.23; caseG.add(glass);
    const warm = new THREE.PointLight(0xffb060, 0.6, 0.8);
    warm.position.set(0, 0.32, 0); caseG.add(warm);
    for (let i = 0; i < 6; i++) {
      const nug = mesh(new THREE.SphereGeometry(0.035, 10, 8), toon("#d08a2e", { emissive: "#3a1a00" }), 0.003);
      nug.scale.set(1.3, 0.8, 1);
      nug.position.set(-0.16 + (i % 3) * 0.16, 0.12 + Math.floor(i / 3) * 0.12, -0.02 + rand(i) * 0.05);
      caseG.add(nug);
    }
    const roof = mesh(new THREE.BoxGeometry(0.5, 0.03, 0.36), toon("#c8402f"), 0.004);
    roof.position.y = 0.395; caseG.add(roof);
    caseG.position.set(-1.3, counterTop, -0.04);
    scene.add(caseG);

    // back counter + microwave behind the clerk
    const backZ = -1.15;
    const back = mesh(new THREE.BoxGeometry(2.6, 0.9, 0.5), toon("#e4e1da"));
    back.position.set(0, 0.45, backZ);
    scene.add(back);
    const mw = new THREE.Group();
    const mwBody = mesh(new THREE.BoxGeometry(0.5, 0.3, 0.38), toon("#f4f3ef"), 0.005);
    mwBody.position.y = 0.15; mw.add(mwBody);
    const door = new THREE.Mesh(new THREE.PlaneGeometry(0.33, 0.22), flat("#1c2127"));
    door.position.set(-0.05, 0.15, 0.191); mw.add(door);
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.07), new THREE.MeshBasicMaterial({ map: canvasTexture(128, 96, (g, w, h) => { g.fillStyle = "#0b120e"; g.fillRect(0, 0, w, h); g.fillStyle = "#7cf2a0"; g.font = `bold 42px monospace`; g.textAlign = "center"; g.fillText("0:40", w / 2, 62); }) }));
    panel.position.set(0.18, 0.21, 0.191); mw.add(panel);
    mw.position.set(Number(p.microwaveX ?? 0.35), 0.9, backZ + 0.02);
    mw.rotation.y = 0;
    scene.add(mw);
    const mw2 = mw.clone(); mw2.position.x = Number(p.microwaveX ?? 0.35) - 0.62; scene.add(mw2);

    // back wall with generic merchandise shelves (no real brands)
    const wall = mesh(new THREE.BoxGeometry(6, 3, 0.05), toon("#f2efe8"), false);
    wall.position.set(0, 1.5, -1.45);
    scene.add(wall);
    const shelves = shelfWall(scene, { w: 2.4, h: 0.9, rows: 4, cols: 12, seed: 11, palette: ["#e7b84c", "#5b8fb8", "#d9573f", "#f4f1ea", "#7bb38a", "#3a3d44", "#e98aa0"], depth: 0.18 });
    shelves.position.set(0, 1.45, -1.43);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.16), new THREE.MeshBasicMaterial({ map: canvasTexture(800, 128, (g, w, h) => { g.fillStyle = String(p.stripe ?? "#e2b443"); g.fillRect(0, 0, w, h); g.fillStyle = "#2a2a2a"; g.font = `bold 72px ${JP_FONT}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(String(p.signText ?? "レジ"), w / 2, h / 2 + 4); }) }));
    sign.position.set(0, 2.5, -1.42);
    scene.add(sign);

    // customer side: snack shelves + night window
    const front = new THREE.Group();
    shelfWall(front, { w: 2.2, h: 1.5, rows: 5, cols: 10, seed: 97, palette: ["#f0c34b", "#d84f3c", "#4f86c6", "#f6f3ec", "#5fae74", "#ef9a3c", "#8d5fb5"], depth: 0.32 });
    front.position.set(-0.4, 0.05, 2.4);
    front.rotation.y = Math.PI;
    scene.add(front);
    const win = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.0), flat("#1d2a3e"));
    win.position.set(2.2, 1.3, 1.0); win.rotation.y = -Math.PI / 2;
    scene.add(win);
    const wallR = mesh(new THREE.BoxGeometry(0.05, 3, 6), toon("#f2efe8"), false);
    wallR.position.set(2.25, 1.5, 0); scene.add(wallR);
    const wallL = mesh(new THREE.BoxGeometry(0.05, 3, 6), toon("#f2efe8"), false);
    wallL.position.set(-2.25, 1.5, 0); scene.add(wallL);
    const wallF = mesh(new THREE.BoxGeometry(6, 3, 0.05), toon("#f2efe8"), false);
    wallF.position.set(0, 1.5, 2.75); scene.add(wallF);

    // ceiling light strips
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), flat("#f7f6f2"));
    ceil.rotation.x = Math.PI / 2; ceil.position.y = 2.75; scene.add(ceil);
    for (const z of [-0.8, 0.6, 1.9]) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.03, 0.14), flat("#ffffff"));
      strip.position.set(0, 2.72, z); scene.add(strip);
    }

    return {
      surfaces: { counter: counterTop, backCounter: 0.9 },
      cameras: {
        hero: { pos: [0.62, 1.62, 1.62], target: [-0.05, 1.2, -0.25], fov: 40 },
        wide: { pos: [0.9, 1.55, 2.25], target: [0, 1.15, -0.3], fov: 42 },
        side: { pos: [-0.85, 2.02, 1.35], target: [0.05, 1.22, -0.15], fov: 42 },
        "clerk-cu": { pos: [-0.28, 1.56, 0.9], target: [0.04, 1.47, -0.6], fov: 34 },
        "customer-cu": { pos: [-0.5, 1.52, -0.98], target: [0.14, 1.44, 0.64], fov: 32 },
        "counter-top": { pos: [-0.05, 2.0, 0.58], target: [-0.04, 0.96, 0.02], fov: 36 },
        "counter-wide": { pos: [-0.09, 2.15, 0.66], target: [-0.08, 0.98, -0.02], fov: 40 },
        "over-clerk": { pos: [-0.35, 1.62, -1.05], target: [0.1, 1.1, 0.55], fov: 44 }
      }
    };
  }
};

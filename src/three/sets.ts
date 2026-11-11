import * as THREE from "three";
import { canvasTexture, flat, JP_FONT, mesh, rand, toon } from "./toon";
import { drawFloorPlan } from "./props";

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
  },

  /** Company meeting room used for job interviews: interviewer desk at z<0, candidate chair at z>0. */
  "interview-room"(scene, p) {
    scene.background = new THREE.Color("#e9e7e2");
    lights(scene, { key: 1.45 });
    const deskTop = 0.72;
    const grad = (toon("#fff") as THREE.MeshToonMaterial).gradientMap;
    // carpet tiles
    const carpet = canvasTexture(512, 512, (g, w, h) => {
      g.fillStyle = "#8c939c"; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 2600; i++) { g.fillStyle = rand(i) > 0.5 ? "#838a93" : "#959ca5"; g.fillRect(rand(i + 1) * w, rand(i + 2) * h, 2, 2); }
      g.strokeStyle = "#7c838b"; g.lineWidth = 2; g.strokeRect(0, 0, w, h);
    });
    carpet.wrapS = carpet.wrapT = THREE.RepeatWrapping; carpet.repeat.set(6, 6);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.MeshToonMaterial({ map: carpet, gradientMap: grad }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
    const wallC = String(p.wall ?? "#f1efea");
    const wallB = mesh(new THREE.BoxGeometry(6, 3, 0.05), toon(wallC), false); wallB.position.set(0, 1.5, -1.6); scene.add(wallB);
    const wallL = mesh(new THREE.BoxGeometry(0.05, 3, 6), toon(wallC), false); wallL.position.set(-2.2, 1.5, 0.4); scene.add(wallL);
    const wallR = mesh(new THREE.BoxGeometry(0.05, 3, 6), toon(wallC), false); wallR.position.set(2.2, 1.5, 0.4); scene.add(wallR);
    const wallF = mesh(new THREE.BoxGeometry(6, 3, 0.05), toon(wallC), false); wallF.position.set(0, 1.5, 3.2); scene.add(wallF);
    const skirting = mesh(new THREE.BoxGeometry(6, 0.08, 0.02), toon("#6d6a66"), false); skirting.position.set(0, 0.04, -1.57); scene.add(skirting);
    // window with blinds on the right wall
    const win = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.3), flat("#cfe3f2"));
    win.position.set(2.17, 1.5, 0.2); win.rotation.y = -Math.PI / 2; scene.add(win);
    for (let i = 0; i < 16; i++) {
      const slat = mesh(new THREE.BoxGeometry(0.01, 0.05, 1.82), toon("#f7f6f2"), false);
      slat.position.set(2.14, 0.9 + i * 0.08, 0.2); slat.rotation.z = 0.5; scene.add(slat);
    }
    // wall clock behind the interviewer
    const clock = new THREE.Group();
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.16, 32), new THREE.MeshBasicMaterial({ map: canvasTexture(256, 256, (g, w, h) => {
      g.fillStyle = "#ffffff"; g.beginPath(); g.arc(w / 2, h / 2, w / 2, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "#2a2a2a"; g.lineWidth = 14; g.stroke();
      g.fillStyle = "#2a2a2a"; for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; g.fillRect(w / 2 + Math.sin(a) * 100 - 4, h / 2 - Math.cos(a) * 100 - 4, 8, 8); }
      g.lineWidth = 9; g.beginPath(); g.moveTo(w / 2, h / 2); g.lineTo(w / 2 + 50, h / 2 + 10); g.stroke();
      g.lineWidth = 6; g.beginPath(); g.moveTo(w / 2, h / 2); g.lineTo(w / 2 - 20, h / 2 - 82); g.stroke();
    }) }));
    clock.add(face); clock.position.set(-0.75, 2.05, -1.57); scene.add(clock);
    // interviewer desk with modesty panel (hides legs)
    const deskC = String(p.desk ?? "#d8c3a2");
    const top = mesh(new THREE.BoxGeometry(1.7, 0.04, 0.62), toon(deskC), 0.005); top.position.set(0, deskTop - 0.02, -0.4); scene.add(top);
    const panel = mesh(new THREE.BoxGeometry(1.66, deskTop - 0.1, 0.03), toon("#6f7378"), 0.004); panel.position.set(0, (deskTop - 0.1) / 2 + 0.06, -0.12); scene.add(panel);
    for (const x of [-0.8, 0.8]) { const leg = mesh(new THREE.BoxGeometry(0.04, deskTop - 0.04, 0.58), toon("#5d6166"), 0.004); leg.position.set(x, (deskTop - 0.04) / 2, -0.4); scene.add(leg); }
    // whiteboard on back wall (blank)
    const wb = mesh(new THREE.BoxGeometry(1.3, 0.8, 0.03), toon("#fbfbfa"), 0.005); wb.position.set(0.6, 1.65, -1.56); scene.add(wb);
    const tray = mesh(new THREE.BoxGeometry(1.3, 0.03, 0.06), toon("#9aa0a6"), 0.003); tray.position.set(0.6, 1.24, -1.52); scene.add(tray);
    // ceiling panels
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), flat("#f6f5f1")); ceil.rotation.x = Math.PI / 2; ceil.position.y = 2.7; scene.add(ceil);
    for (const z of [-0.6, 1.1]) { const strip = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.02, 0.6), flat("#ffffff")); strip.position.set(0, 2.69, z); scene.add(strip); }
    return {
      surfaces: { desk: deskTop, floor: 0 },
      cameras: {
        wide: { pos: [1.35, 1.45, 2.3], target: [-0.1, 0.85, -0.2], fov: 40 },
        side: { pos: [2.0, 1.15, 0.25], target: [-0.4, 0.95, 0.2], fov: 42 },
        "interviewer-cu": { pos: [-0.12, 1.12, 0.6], target: [0, 1.05, -0.7], fov: 32 },
        "candidate-cu": { pos: [0.12, 1.12, -0.25], target: [0, 0.95, 0.95], fov: 32 },
        "over-interviewer": { pos: [0.45, 1.35, -1.0], target: [-0.05, 0.85, 0.95], fov: 40 },
        "over-candidate": { pos: [-0.45, 1.25, 1.75], target: [0.05, 0.95, -0.6], fov: 40 }
      }
    };
  },


  /**
   * Real-estate agency (不動産屋の賃貸カウンター). Consultation desk centred at z≈-0.35 (top 0.72) with a
   * centre modesty divider and low booth partitions; the agent sits behind it (z≈-0.85, facing +Z), the
   * customer on a chair in front (z≈0.25, facing -Z). Back wall: a corkboard of property flyers under an
   * 「おすすめ物件」 header; right wall: shop window with flyers taped to the glass; left: brochure rack.
   * Floor-plan sheets on the desk are `floor-plan` props.
   */
  "real-estate-office"(scene, p) {
    scene.background = new THREE.Color("#eeece6");
    lights(scene, { key: 1.4 });
    const grad = (toon("#fff") as THREE.MeshToonMaterial).gradientMap;
    const deskTop = 0.72;
    const accent = String(p.accent ?? "#2f7d4f");
    const wood = canvasTexture(512, 512, (g, w, h) => {
      g.fillStyle = "#c9b08a"; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? "#c2a881" : "#cdb591"; g.fillRect(0, i * h / 8, w, h / 8 - 2); }
      for (let i = 0; i < 900; i++) { g.fillStyle = "rgba(120,90,60,0.08)"; g.fillRect(rand(i) * w, rand(i + 5) * h, 30 + rand(i + 9) * 60, 1); }
    });
    wood.wrapS = wood.wrapT = THREE.RepeatWrapping; wood.repeat.set(3, 3);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.MeshToonMaterial({ map: wood, gradientMap: grad }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
    const wallC = String(p.wall ?? "#f4f2ec");
    const wallB = mesh(new THREE.BoxGeometry(6, 3, 0.05), toon(wallC), false); wallB.position.set(0, 1.5, -1.6); scene.add(wallB);
    const wallL = mesh(new THREE.BoxGeometry(0.05, 3, 6), toon(wallC), false); wallL.position.set(-2.0, 1.5, 0.6); scene.add(wallL);
    const wallR = mesh(new THREE.BoxGeometry(0.05, 3, 6), toon(wallC), false); wallR.position.set(2.0, 1.5, 0.6); scene.add(wallR);
    const wallF = mesh(new THREE.BoxGeometry(6, 3, 0.05), toon(wallC), false); wallF.position.set(0, 1.5, 3.4); scene.add(wallF);
    const skirt = mesh(new THREE.BoxGeometry(5.9, 0.08, 0.02), toon("#7b6a58"), false); skirt.position.set(0, 0.04, -1.57); scene.add(skirt);
    // corkboard of property flyers on the back wall
    const cols = 6, rows = 3, fw = 0.24, fh = 0.34, gap = 0.05;
    const bw = cols * fw + (cols + 1) * gap, bh = rows * fh + (rows + 1) * gap;
    const by = 1.68;
    const board = mesh(new THREE.BoxGeometry(bw, bh, 0.03), toon("#b98f5e"), 0.004); board.position.set(0, by, -1.56); scene.add(board);
    const accents = [accent, "#2c5d9e", "#c7462f", "#7a4fa0", "#d0892a"];
    const layouts = ["1K", "1R", "1DK", "2DK", "1LDK", "1K", "2LDK", "1R"];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const k = r * cols + c;
      const tex = canvasTexture(240, 340, (g, w, h) => drawFloorPlan(g, w, h, {
        seed: k + 3, accent: accents[k % accents.length], layout: layouts[k % layouts.length],
        rent: `${(4.2 + rand(k + 11) * 5).toFixed(1)}万円`, room: "", tags: []
      }));
      const f = new THREE.Mesh(new THREE.PlaneGeometry(fw, fh), new THREE.MeshBasicMaterial({ map: tex }));
      f.position.set(-bw / 2 + gap + fw / 2 + c * (fw + gap), by + bh / 2 - gap - fh / 2 - r * (fh + gap), -1.54);
      f.rotation.z = (rand(k + 21) - 0.5) * 0.03;
      scene.add(f);
    }
    const head = canvasTexture(512, 96, (g, w, h) => {
      g.fillStyle = accent; g.fillRect(0, 0, w, h);
      g.fillStyle = "#ffffff"; g.font = `bold 58px ${JP_FONT}`; g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText(String(p.header ?? "おすすめ物件"), w / 2, h / 2 + 3);
    });
    const hd = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.17), new THREE.MeshBasicMaterial({ map: head }));
    hd.position.set(0, by + bh / 2 + 0.13, -1.55); scene.add(hd);
    // shop window on the right wall, flyers taped to the glass (seen from behind: plain sheets)
    const win = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.9), flat("#d8ebf5")); win.rotation.y = -Math.PI / 2; win.position.set(1.97, 1.3, 0.4); scene.add(win);
    const mull = toon("#8c8f93");
    for (const z of [-0.9, 0.4, 1.7]) { const m = mesh(new THREE.BoxGeometry(0.04, 1.9, 0.04), mull, false); m.position.set(1.95, 1.3, z); scene.add(m); }
    for (let i = 0; i < 8; i++) {
      const sh = new THREE.Mesh(new THREE.PlaneGeometry(0.21, 0.3), flat(rand(i + 40) > 0.3 ? "#f6f5f1" : "#efe8d6"));
      sh.rotation.y = -Math.PI / 2; sh.position.set(1.94, 1.05 + (i % 2) * 0.42, -0.6 + Math.floor(i / 2) * 0.55); scene.add(sh);
    }
    // brochure rack on the left wall
    const rack = mesh(new THREE.BoxGeometry(0.3, 1.3, 0.7), toon("#e4e1da"), 0.004); rack.position.set(-1.82, 0.65, -0.6); scene.add(rack);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) {
      const b = mesh(new THREE.BoxGeometry(0.02, 0.26, 0.2), toon(accents[(i + j) % accents.length]!), 0.002);
      b.position.set(-1.66, 0.35 + i * 0.28, -0.75 + j * 0.3); b.rotation.z = -0.15; scene.add(b);
    }
    // consultation desk with a centre modesty divider and low booth partitions
    const deskC = String(p.desk ?? "#f2efe8");
    const top = mesh(new THREE.BoxGeometry(1.4, 0.04, 0.72), toon(deskC), 0.005); top.position.set(0, deskTop - 0.02, -0.35); scene.add(top);
    const edge = mesh(new THREE.BoxGeometry(1.4, 0.02, 0.02), toon(accent), false); edge.position.set(0, deskTop - 0.03, 0.015); scene.add(edge);
    const divider = mesh(new THREE.BoxGeometry(1.36, deskTop - 0.06, 0.03), toon("#d9d5cc"), 0.004); divider.position.set(0, (deskTop - 0.06) / 2, -0.35); scene.add(divider);
    for (const x of [-0.68, 0.68]) {
      const leg = mesh(new THREE.BoxGeometry(0.04, deskTop - 0.04, 0.68), toon("#bdb8ae"), 0.004); leg.position.set(x, (deskTop - 0.04) / 2, -0.35); scene.add(leg);
      const part = mesh(new THREE.BoxGeometry(0.03, 0.42, 0.72), toon("#fbfbf8"), 0.004); part.position.set(x, deskTop + 0.21, -0.35); scene.add(part);
    }
    // pen stand and a small business-card holder on the agent's side
    const ps = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.1, 14), toon("#4b5058"), 0.003); ps.position.set(-0.5, deskTop + 0.05, -0.6); scene.add(ps);
    for (let i = 0; i < 3; i++) { const pn = mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.14, 6), toon(accents[i]!), false); pn.position.set(-0.5 + (i - 1) * 0.012, deskTop + 0.12, -0.6); pn.rotation.z = (i - 1) * 0.15; scene.add(pn); }
    const card = mesh(new THREE.BoxGeometry(0.1, 0.04, 0.05), toon("#d6d2c8"), 0.003); card.position.set(0.5, deskTop + 0.02, -0.62); scene.add(card);
    // agent's chair back (visible behind the agent)
    const cb = mesh(new THREE.BoxGeometry(0.44, 0.5, 0.06), toon("#3d4450"), 0.004); cb.position.set(0, 0.78, -1.12); scene.add(cb);
    const cs = mesh(new THREE.BoxGeometry(0.46, 0.07, 0.44), toon("#3d4450"), 0.004); cs.position.set(0, 0.45, -0.92); scene.add(cs);
    const cp = mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.4, 8), toon("#9aa0a6"), 0.003); cp.position.set(0, 0.22, -0.92); scene.add(cp);
    // ceiling with light panels
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), flat("#f7f6f2")); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, 2.8, 0.6); scene.add(ceil);
    for (const z of [-0.6, 1.1]) { const strip = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.02, 0.6), flat("#ffffff")); strip.position.set(0, 2.79, z); scene.add(strip); }
    return {
      surfaces: { desk: deskTop, floor: 0, seat: 0.48 },
      cameras: {
        wide: { pos: [1.3, 1.5, 1.9], target: [-0.1, 0.9, -0.45], fov: 42 },
        "agent-cu": { pos: [0.45, 1.2, 0.5], target: [0, 0.98, -0.86], fov: 30 },
        "customer-cu": { pos: [0.38, 1.06, -0.95], target: [0, 0.76, 0.3], fov: 28 },
        "over-customer": { pos: [-0.4, 1.3, 1.25], target: [0.05, 0.98, -0.7], fov: 40 },
        "over-agent": { pos: [0.42, 1.42, -1.35], target: [-0.05, 0.9, 0.3], fov: 40 },
        "desk-top": { pos: [0.02, 1.6, 0.14], target: [0, 0.72, -0.02], fov: 34 }
      }
    };
  },

  /**
   * Photo studio (写真館) for ID / portrait photos: a paper backdrop sweep at the back (z≈-1.7),
   * the sitter's stool area around z≈-0.6, the photographer's side at z>0.6.
   * Camera-on-tripod and strobes are props (`photo-camera`, `strobe`) so they can be placed and flashed.
   */
  "photo-studio"(scene, p) {
    scene.background = new THREE.Color("#e8e4dc");
    lights(scene, { key: 1.35 });
    const grad = (toon("#fff") as THREE.MeshToonMaterial).gradientMap;
    // wooden floor
    const wood = canvasTexture(512, 512, (g, w, h) => {
      g.fillStyle = "#b98d62"; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 8; i++) {
        g.fillStyle = rand(i) > 0.5 ? "#b48659" : "#c0956a"; g.fillRect(0, i * h / 8, w, h / 8 - 2);
        g.fillStyle = "#9a7048"; g.fillRect(0, (i + 1) * h / 8 - 2, w, 2);
        g.fillRect(rand(i + 9) * w, i * h / 8, 2, h / 8);
      }
    });
    wood.wrapS = wood.wrapT = THREE.RepeatWrapping; wood.repeat.set(5, 5);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.MeshToonMaterial({ map: wood, gradientMap: grad }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
    const wallC = String(p.wall ?? "#efebe4");
    const wallB = mesh(new THREE.BoxGeometry(6, 3, 0.05), toon(wallC), false); wallB.position.set(0, 1.5, -2.0); scene.add(wallB);
    const wallL = mesh(new THREE.BoxGeometry(0.05, 3, 6), toon(wallC), false); wallL.position.set(-2.2, 1.5, 0.6); scene.add(wallL);
    const wallR = mesh(new THREE.BoxGeometry(0.05, 3, 6), toon(wallC), false); wallR.position.set(2.2, 1.5, 0.6); scene.add(wallR);
    const wallF = mesh(new THREE.BoxGeometry(6, 3, 0.05), toon(wallC), false); wallF.position.set(0, 1.5, 3.4); scene.add(wallF);
    // seamless paper backdrop: vertical sheet + quarter-cylinder sweep onto the floor
    const paperC = String(p.backdrop ?? "#8ea9bf");
    const paper = toon(paperC);
    const bw = 2.6, r = 0.45, back = -1.75;
    const vert = mesh(new THREE.PlaneGeometry(bw, 2.3), paper, false); vert.position.set(0, r + 1.15, back); scene.add(vert);
    const sweepMat = paper.clone(); sweepMat.side = THREE.DoubleSide;
    const sweep = new THREE.Mesh(new THREE.CylinderGeometry(r, r, bw, 24, 1, true, Math.PI, Math.PI / 2), sweepMat);
    sweep.rotation.z = Math.PI / 2; sweep.position.set(0, r, back + r); sweep.receiveShadow = true;
    scene.add(sweep);
    const run = mesh(new THREE.PlaneGeometry(bw, 1.2), paper, false); run.rotation.x = -Math.PI / 2; run.position.set(0, 0.002, back + r + 0.6); scene.add(run);
    // backdrop stands and roll
    for (const x of [-bw / 2 - 0.08, bw / 2 + 0.08]) {
      const pole = mesh(new THREE.CylinderGeometry(0.018, 0.018, 2.85, 8), toon("#2b2c30"), 0.004); pole.position.set(x, 1.425, back - 0.05); scene.add(pole);
      for (const a of [0, 2.1, 4.2]) { const leg = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 6), toon("#2b2c30"), 0.003); leg.position.set(x + Math.cos(a) * 0.18, 0.12, back - 0.05 + Math.sin(a) * 0.18); leg.rotation.set(Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1); scene.add(leg); }
    }
    const roll = mesh(new THREE.CylinderGeometry(0.06, 0.06, bw + 0.1, 16), toon(paperC), 0.004); roll.rotation.z = Math.PI / 2; roll.position.set(0, 2.82, back - 0.02); scene.add(roll);
    // sample portraits on the side wall (generic silhouettes, no real people)
    for (const [i, z] of [0.4, 1.3, 2.2].entries()) {
      const tex = canvasTexture(256, 320, (g, w, h) => {
        g.fillStyle = "#f7f4ee"; g.fillRect(0, 0, w, h);
        g.fillStyle = ["#9fb4c6", "#c9b8a6", "#b7c2a9"][i]!; g.fillRect(24, 24, w - 48, h - 48);
        g.fillStyle = "#4a4650"; g.beginPath(); g.arc(w / 2, h * 0.42, 44, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.ellipse(w / 2, h * 0.84, 82, 60, 0, Math.PI, 0); g.fill();
      });
      const frame = mesh(new THREE.BoxGeometry(0.03, 0.5, 0.4), toon("#3a2c22"), 0.004); frame.position.set(-2.16, 1.55, z); scene.add(frame);
      const pic = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.44), new THREE.MeshBasicMaterial({ map: tex })); pic.rotation.y = Math.PI / 2; pic.position.set(-2.14, 1.55, z); scene.add(pic);
    }
    // ceiling
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(6, 7), flat("#f6f5f1")); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, 2.95, 0.6); scene.add(ceil);
    return {
      surfaces: { floor: 0 },
      cameras: {
        wide: { pos: [1.55, 1.45, 2.6], target: [-0.05, 0.75, -0.3], fov: 42 },
        side: { pos: [1.8, 1.05, 0.0], target: [-0.2, 0.8, 0.0], fov: 40 },
        "sitter-cu": { pos: [0.08, 0.82, 0.25], target: [0, 0.62, -0.6], fov: 28 },
        "photographer-cu": { pos: [-0.25, 1.4, 0.15], target: [0.05, 1.4, 1.35], fov: 34 },
        "over-photographer": { pos: [0.5, 1.5, 2.25], target: [0, 0.65, -0.6], fov: 34 }
      }
    };
  },
  "dental-clinic"(scene, p) {
    // 歯科医院の診療台。患者は原点の診療台に +Z 向きで座り、背もたれは -Z 側へ倒れる（params.recline, ラジアン）。
    // 歯科医は患者の右後ろ（x≈-0.5, z≈-0.4）、ライトは顔の上、うがいの鉢とコップは患者の左（+X）。
    scene.background = new THREE.Color("#eef2f0");
    lights(scene, { key: 1.35 });
    const grad = (toon("#fff") as THREE.MeshToonMaterial).gradientMap;
    const recline = Number(p.recline ?? 0.62);
    const chairC = String(p.chair ?? "#6cc3b8");
    // vinyl floor tiles
    const tiles = canvasTexture(512, 512, (g, w, h) => {
      g.fillStyle = "#e3e0d8"; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g.fillStyle = (i + j) % 2 ? "#dcd8cf" : "#e6e3dc"; g.fillRect(i * w / 4, j * h / 4, w / 4 - 2, h / 4 - 2); }
    });
    tiles.wrapS = tiles.wrapT = THREE.RepeatWrapping; tiles.repeat.set(4, 4);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.MeshToonMaterial({ map: tiles, gradientMap: grad }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
    const wallC = String(p.wall ?? "#f3f6f4");
    const wallB = mesh(new THREE.BoxGeometry(6, 3, 0.05), toon(wallC), false); wallB.position.set(0, 1.5, -1.9); scene.add(wallB);
    const wallL = mesh(new THREE.BoxGeometry(0.05, 3, 6), toon(wallC), false); wallL.position.set(-2.0, 1.5, 0.8); scene.add(wallL);
    const wallR = mesh(new THREE.BoxGeometry(0.05, 3, 6), toon(wallC), false); wallR.position.set(2.0, 1.5, 0.8); scene.add(wallR);
    const wallF = mesh(new THREE.BoxGeometry(6, 3, 0.05), toon(wallC), false); wallF.position.set(0, 1.5, 3.6); scene.add(wallF);
    const skirt = mesh(new THREE.BoxGeometry(5.9, 0.1, 0.02), toon("#9fb7b2"), false); skirt.position.set(0, 0.05, -1.87); scene.add(skirt);
    // window with blinds on the right wall
    const win = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.0), flat("#dceefa")); win.rotation.y = -Math.PI / 2; win.position.set(1.97, 1.6, -0.3); scene.add(win);
    for (let i = 0; i < 14; i++) { const sl = mesh(new THREE.BoxGeometry(0.02, 0.012, 1.3), toon("#f7f7f4"), false); sl.position.set(1.95, 1.12 + i * 0.07, -0.3); scene.add(sl); }
    // back counter: cabinets, sink, gloves box, paper cups
    const cab = mesh(new THREE.BoxGeometry(2.4, 0.85, 0.55), toon("#f8f8f5"), 0.004); cab.position.set(-0.3, 0.425, -1.6); scene.add(cab);
    for (let i = 0; i < 4; i++) { const d = mesh(new THREE.BoxGeometry(0.56, 0.7, 0.01), toon("#eceee9"), 0.003); d.position.set(-1.2 + i * 0.6, 0.42, -1.32); scene.add(d); const h = mesh(new THREE.BoxGeometry(0.12, 0.015, 0.02), toon("#9aa3a3"), false); h.position.set(-1.2 + i * 0.6, 0.72, -1.31); scene.add(h); }
    const top = mesh(new THREE.BoxGeometry(2.44, 0.04, 0.58), toon("#cfd8d6"), 0.004); top.position.set(-0.3, 0.87, -1.6); scene.add(top);
    const sink = mesh(new THREE.BoxGeometry(0.42, 0.02, 0.3), toon("#b9c4c4"), false); sink.position.set(-1.05, 0.895, -1.6); scene.add(sink);
    const tap = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 8), toon("#c9cfd2"), 0.003); tap.position.set(-1.05, 1.0, -1.78); scene.add(tap);
    const glove = mesh(new THREE.BoxGeometry(0.24, 0.1, 0.12), toon("#a8c8ec"), 0.003); glove.position.set(0.2, 0.94, -1.62); scene.add(glove);
    for (let i = 0; i < 4; i++) { const c = mesh(new THREE.CylinderGeometry(0.035, 0.028, 0.08, 12), toon("#ffffff"), 0.003); c.position.set(0.55, 0.93 + i * 0.06, -1.62); scene.add(c); }
    const upper = mesh(new THREE.BoxGeometry(2.4, 0.6, 0.32), toon("#f8f8f5"), 0.004); upper.position.set(-0.3, 2.05, -1.72); scene.add(upper);
    // tooth-brushing poster (generic drawing, no text brand)
    const poster = canvasTexture(320, 440, (g, w, h) => {
      g.fillStyle = "#fffdf6"; g.fillRect(0, 0, w, h);
      g.fillStyle = "#4bb3a8"; g.fillRect(0, 0, w, 70);
      g.fillStyle = "#ffffff"; g.font = `bold 40px ${JP_FONT}`; g.textAlign = "center"; g.fillText("はみがき", w / 2, 50);
      // a big tooth
      g.fillStyle = "#ffffff"; g.strokeStyle = "#7a8a8c"; g.lineWidth = 5;
      g.beginPath(); g.moveTo(90, 150); g.bezierCurveTo(90, 100, 230, 100, 230, 150); g.lineTo(220, 260); g.lineTo(190, 330); g.lineTo(165, 250); g.lineTo(140, 330); g.lineTo(105, 260); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = "#2a2a2a"; g.beginPath(); g.arc(135, 175, 7, 0, Math.PI * 2); g.arc(185, 175, 7, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "#2a2a2a"; g.lineWidth = 4; g.beginPath(); g.arc(160, 195, 18, 0.2, Math.PI - 0.2); g.stroke();
      g.fillStyle = "#5a6a6c"; g.font = `24px ${JP_FONT}`; g.fillText("1日3回 3分間", w / 2, 390);
    });
    const pf = mesh(new THREE.BoxGeometry(0.5, 0.68, 0.02), toon("#d8dcd8"), 0.003); pf.position.set(0.85, 1.55, -1.86); scene.add(pf);
    const pp = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.64), new THREE.MeshBasicMaterial({ map: poster })); pp.position.set(0.85, 1.55, -1.845); scene.add(pp);
    // x-ray viewer on the left wall
    const xr = mesh(new THREE.BoxGeometry(0.03, 0.42, 0.62), toon("#e8ecef"), 0.003); xr.position.set(-1.97, 1.5, -0.6); scene.add(xr);
    const xrs = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.36), flat("#cfe3ef")); xrs.rotation.y = Math.PI / 2; xrs.position.set(-1.95, 1.5, -0.6); scene.add(xrs);

    // ---- dental chair ----
    const chair = toon(chairC), frame = toon("#f4f4f1"), metal = toon("#c4cacc");
    const base = mesh(new THREE.BoxGeometry(0.6, 0.06, 0.8), frame, 0.004); base.position.set(0, 0.03, 0.15); scene.add(base);
    const col = mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.38, 16), frame, 0.004); col.position.set(0, 0.24, 0.1); scene.add(col);
    const seat = mesh(new THREE.BoxGeometry(0.56, 0.09, 0.5), chair, 0.005); seat.position.set(0, 0.47, 0.17); scene.add(seat);
    // leg rest rising forward a little (reclined chairs lift the legs)
    const leg = mesh(new THREE.BoxGeometry(0.5, 0.08, 0.62), chair, 0.005); leg.rotation.x = -0.18 * recline / 0.62; leg.position.set(0, 0.5, 0.72); scene.add(leg);
    // backrest hinged at the back of the seat
    const hinge = new THREE.Group(); hinge.position.set(0, 0.5, -0.07); hinge.rotation.x = -recline; scene.add(hinge);
    const back = mesh(new THREE.BoxGeometry(0.56, 0.78, 0.1), chair, 0.005); back.position.set(0, 0.39, -0.03); hinge.add(back);
    const backShell = mesh(new THREE.BoxGeometry(0.54, 0.74, 0.03), frame, 0.004); backShell.position.set(0, 0.39, -0.1); hinge.add(backShell);
    const head = mesh(new THREE.BoxGeometry(0.3, 0.16, 0.09), chair, 0.005); head.position.set(0, 0.86, 0.0); hinge.add(head);
    for (const x of [-0.31, 0.31]) { const arm = mesh(new THREE.BoxGeometry(0.07, 0.05, 0.42), frame, 0.004); arm.position.set(x, 0.66, 0.18); scene.add(arm); const post = mesh(new THREE.BoxGeometry(0.04, 0.16, 0.04), frame, 0.003); post.position.set(x, 0.57, 0.02); scene.add(post); }
    // spittoon unit on the patient's left (+X)
    const unit = mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.8, 12), frame, 0.004); unit.position.set(0.55, 0.4, -0.15); scene.add(unit);
    const bowl = mesh(new THREE.SphereGeometry(0.12, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), toon("#dfe9ea"), 0.004); bowl.rotation.x = Math.PI; bowl.position.set(0.55, 0.86, -0.08); scene.add(bowl);
    const rim = mesh(new THREE.TorusGeometry(0.12, 0.012, 8, 24), frame, false); rim.rotation.x = Math.PI / 2; rim.position.set(0.55, 0.86, -0.08); scene.add(rim);
    const cup = mesh(new THREE.CylinderGeometry(0.03, 0.025, 0.07, 12), toon("#ffffff"), 0.003); cup.position.set(0.66, 0.9, 0.05); scene.add(cup);
    // instrument tray on an arm in front-left of the patient
    const tpole = mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.45, 8), metal, 0.003); tpole.position.set(0.55, 0.85, 0.05); scene.add(tpole);
    const tarm = mesh(new THREE.BoxGeometry(0.04, 0.03, 0.5), metal, 0.003); tarm.position.set(0.55, 1.07, 0.3); scene.add(tarm);
    const tray = mesh(new THREE.BoxGeometry(0.36, 0.03, 0.26), toon("#e9ecea"), 0.004); tray.position.set(0.48, 1.09, 0.58); scene.add(tray);
    for (let i = 0; i < 4; i++) { const t = mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.16, 6), metal, false); t.rotation.z = Math.PI / 2; t.position.set(0.48, 1.11, 0.5 + i * 0.05); scene.add(t); }
    // overhead light: post behind the chair, arm over the patient, lamp head aimed at the mouth
    const lpost = mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.95, 10), frame, 0.004); lpost.position.set(0.0, 0.98, -0.9); scene.add(lpost);
    const larm = mesh(new THREE.BoxGeometry(0.05, 0.05, 1.05), frame, 0.004); larm.position.set(0.0, 1.95, -0.38); scene.add(larm);
    const ldrop = mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.2, 8), frame, 0.003); ldrop.position.set(0.0, 1.85, 0.12); scene.add(ldrop);
    const lamp = new THREE.Group(); lamp.position.set(0.0, 1.72, 0.14); lamp.rotation.x = 0.9; scene.add(lamp);
    const lh = mesh(new THREE.BoxGeometry(0.34, 0.08, 0.16), frame, 0.005); lamp.add(lh);
    const lens = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.11), flat(p.lampOff ? "#cfd6d8" : "#fffbe6")); lens.rotation.x = Math.PI / 2; lens.position.y = -0.041; lamp.add(lens);
    if (!p.lampOff) {
      const spot = new THREE.SpotLight(0xfff6e0, 2.2, 3, 0.5, 0.6, 1.2);
      spot.position.set(0.0, 1.7, 0.2); spot.target.position.set(0, 0.95, -0.2); scene.add(spot, spot.target);
    }
    // dentist's stool
    const st = mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.06, 18), toon("#56636a"), 0.004); st.position.set(-1.0, 0.5, -0.95); scene.add(st);
    const sp = mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.46, 8), metal, 0.003); sp.position.set(-1.0, 0.24, -0.95); scene.add(sp);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(6, 7), flat("#f7f8f6")); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, 2.95, 0.8); scene.add(ceil);
    return {
      surfaces: { floor: 0, seat: 0.52, tray: 1.1 },
      cameras: {
        wide: { pos: [1.5, 1.6, 2.5], target: [-0.1, 0.85, -0.1], fov: 44 },
        side: { pos: [1.9, 1.15, 0.1], target: [0, 0.9, -0.1], fov: 40 },
        "patient-cu": { pos: [0.35, 1.45, 0.75], target: [0, 1.0, -0.15], fov: 34 },
        "dentist-cu": { pos: [0.2, 1.35, 0.55], target: [-0.5, 1.4, -0.45], fov: 34 },
        "over-dentist": { pos: [-0.85, 1.75, -0.95], target: [0.05, 0.95, 0.0], fov: 40 }
      }
    };
  }
};

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
        "desk-top": { pos: [0, 2.3, 0.2], target: [0, 0.72, -0.04], fov: 21 }
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
  },
  /**
   * Family restaurant (ファミレス). Booth table area around x=0 and the entrance register area around x=2.9.
   * Booth: bench seat (top 0.45) at z≈-0.95 facing +Z with a high back, table top 0.72 centred (0,-0.35)
   * (x -0.6..0.6, z -0.7..0.0); a server stands at the open end x≈0.95 facing -X. Register counter
   * (top 1.0) centred (2.9,-0.75): staff behind at z≈-1.15 facing +Z, customer in front at x≈2.85, z≈-0.05 facing -Z.
   * Back wall window behind the booth, pendant lamp, menu stand and napkin box on the table,
   * glass entrance door on the right wall. Props (glasses, plates, toy basket) are placed by productions.
   */
  /** ホテルのフロント: marble-top reception counter at z=0 (top 1.05), key cubbies and logo behind the staff (staff z≈-0.55 facing +Z, guest z≈0.6 facing -Z). */
  "hotel-front-desk"(scene, p) {
    scene.background = new THREE.Color("#efe6d8");
    lights(scene, { key: 1.4 });
    const grad = (toon("#fff") as THREE.MeshToonMaterial).gradientMap;
    const accent = String(p.accent ?? "#7a1f2e");
    const gold = "#c9a24a";
    const carpet = canvasTexture(512, 512, (g, w, h) => {
      g.fillStyle = "#6f2a35"; g.fillRect(0, 0, w, h);
      g.strokeStyle = "#8a3a47"; g.lineWidth = 6;
      for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * w / 4, 0); g.lineTo(i * w / 4, h); g.moveTo(0, i * h / 4); g.lineTo(w, i * h / 4); g.stroke(); }
      g.fillStyle = "#8a3a47";
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g.beginPath(); g.arc(i * w / 4 + w / 8, j * h / 4 + h / 8, 14, 0, Math.PI * 2); g.fill(); }
    });
    carpet.wrapS = carpet.wrapT = THREE.RepeatWrapping; carpet.repeat.set(7, 7);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.MeshToonMaterial({ map: carpet, gradientMap: grad }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
    const wallC = String(p.wall ?? "#f3ead9");
    const back = mesh(new THREE.BoxGeometry(8, 3.2, 0.05), toon(wallC), false); back.position.set(0, 1.6, -1.45); scene.add(back);
    const wallL = mesh(new THREE.BoxGeometry(0.05, 3.2, 6), toon(wallC), false); wallL.position.set(-3.2, 1.6, 1.4); scene.add(wallL);
    const wallR = mesh(new THREE.BoxGeometry(0.05, 3.2, 6), toon(wallC), false); wallR.position.set(3.2, 1.6, 1.4); scene.add(wallR);
    const wainscot = mesh(new THREE.BoxGeometry(7.9, 0.95, 0.03), toon("#5a2a22"), false); wainscot.position.set(0, 0.475, -1.4); scene.add(wainscot);
    const wRail = mesh(new THREE.BoxGeometry(7.9, 0.04, 0.05), toon(gold), false); wRail.position.set(0, 0.96, -1.38); scene.add(wRail);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), flat("#fbf6ec")); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, 3.1, 1.2); scene.add(ceil);

    // counter: marble top, wood body, brass rail
    const cTop = 1.05;
    const body = mesh(new THREE.BoxGeometry(2.6, cTop - 0.05, 0.6), toon("#6b3f2a"), 0.005); body.position.set(0, (cTop - 0.05) / 2, 0); scene.add(body);
    const panel = mesh(new THREE.BoxGeometry(2.3, 0.62, 0.01), toon("#7d4b33"), false); panel.position.set(0, 0.52, 0.305); scene.add(panel);
    const slab = mesh(new THREE.BoxGeometry(2.72, 0.05, 0.7), toon("#ece8e0"), 0.005); slab.position.set(0, cTop - 0.025, 0); scene.add(slab);
    const brass = mesh(new THREE.BoxGeometry(2.6, 0.025, 0.02), toon(gold), false); brass.position.set(0, 0.13, 0.31); scene.add(brass);
    // service bell, pen cup, registration card, desk monitor (staff side)
    const bellBase = mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.015, 20), toon("#b98f3a"), 0.003); bellBase.position.set(0.62, cTop + 0.008, 0.12); scene.add(bellBase);
    const bellDome = mesh(new THREE.SphereGeometry(0.055, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), toon(gold), 0.003); bellDome.position.set(0.62, cTop + 0.016, 0.12); scene.add(bellDome);
    const bellKnob = mesh(new THREE.SphereGeometry(0.01, 8, 6), toon("#8a6a22"), false); bellKnob.position.set(0.62, cTop + 0.074, 0.12); scene.add(bellKnob);
    const cup = mesh(new THREE.CylinderGeometry(0.03, 0.026, 0.07, 12), toon("#2c3340"), 0.003); cup.position.set(-0.7, cTop + 0.035, -0.12); scene.add(cup);
    const monitor = mesh(new THREE.BoxGeometry(0.36, 0.23, 0.02), toon("#2b2e33"), 0.004); monitor.position.set(-0.45, cTop + 0.2, -0.17); monitor.rotation.y = 0.15; scene.add(monitor);
    const stand = mesh(new THREE.BoxGeometry(0.05, 0.1, 0.04), toon("#2b2e33"), 0.003); stand.position.set(-0.45, cTop + 0.05, -0.17); scene.add(stand);
    const monScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.19), new THREE.MeshBasicMaterial({ map: canvasTexture(256, 160, (g, w, h) => {
      g.fillStyle = "#dfe9f3"; g.fillRect(0, 0, w, h); g.fillStyle = "#5f7f9f"; g.fillRect(0, 0, w, 26);
      g.fillStyle = "#34495e"; for (let i = 0; i < 6; i++) g.fillRect(14, 40 + i * 18, 60 + (i * 37) % 120, 8);
    }) })); monScreen.position.set(-0.45 + 0.0035, cTop + 0.2, -0.158); monScreen.rotation.y = 0.15; scene.add(monScreen);

    // key cubbies behind the staff
    const rackW = 1.7, rackH = 1.0, rackY = 1.35, rows = 4, cols = 8;
    const rack = mesh(new THREE.BoxGeometry(rackW + 0.1, rackH + 0.1, 0.1), toon("#4a2a20"), 0.004); rack.position.set(0.15, rackY + rackH / 2, -1.36); scene.add(rack);
    const holes = canvasTexture(512, 320, (g, w, h) => {
      g.fillStyle = "#2a1712"; g.fillRect(0, 0, w, h);
      const cw = w / cols, ch = h / rows;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        g.fillStyle = "#3d241b"; g.fillRect(c * cw + 4, r * ch + 4, cw - 8, ch - 8);
        g.fillStyle = gold; g.fillRect(c * cw + cw / 2 - 3, r * ch + ch * 0.28, 6, ch * 0.34);
        g.fillStyle = "#e9e1cf"; g.font = `bold 16px ${JP_FONT}`; g.textAlign = "center"; g.fillText(String(301 + r * 10 + c), c * cw + cw / 2, r * ch + ch - 10);
      }
    });
    const rackFace = new THREE.Mesh(new THREE.PlaneGeometry(rackW, rackH), new THREE.MeshBasicMaterial({ map: holes })); rackFace.position.set(0.15, rackY + rackH / 2, -1.305); scene.add(rackFace);
    // logo plaque above the keys
    const logo = canvasTexture(512, 128, (g, w, h) => {
      g.fillStyle = accent; g.fillRect(0, 0, w, h); g.strokeStyle = gold; g.lineWidth = 6; g.strokeRect(8, 8, w - 16, h - 16);
      g.fillStyle = "#fff6df"; g.font = `bold 54px ${JP_FONT}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(String(p.logo ?? "ホテル グランドみなみ"), w / 2, h / 2 + 2);
    });
    const plaque = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.3), new THREE.MeshBasicMaterial({ map: logo })); plaque.position.set(0.15, 2.65, -1.4); scene.add(plaque);
    // 「フロント」 sign hanging over the counter
    const sgn = canvasTexture(256, 96, (g, w, h) => {
      g.fillStyle = "#fffaf0"; g.fillRect(0, 0, w, h); g.fillStyle = accent; g.fillRect(0, h - 10, w, 10);
      g.fillStyle = "#333"; g.font = `bold 52px ${JP_FONT}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("フロント", w / 2, h / 2 - 4);
    });
    const sgnM = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.19), new THREE.MeshBasicMaterial({ map: sgn })); sgnM.position.set(-1.05, 2.35, -1.39); scene.add(sgnM);
    // lobby plant and a floor lamp in the guest area
    const pot = mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.28, 14), toon("#b77a4e"), 0.004); pot.position.set(-2.4, 0.14, 0.2); scene.add(pot);
    for (let i = 0; i < 7; i++) { const lf = mesh(new THREE.SphereGeometry(0.16, 10, 8), toon(i % 2 ? "#3f8a4e" : "#4da05d"), 0.004); lf.scale.set(0.8, 1.7, 0.5); lf.position.set(-2.4 + Math.cos(i * 0.9) * 0.18, 0.62 + (i % 3) * 0.12, 0.2 + Math.sin(i * 0.9) * 0.14); lf.rotation.z = Math.cos(i * 0.9) * 0.4; scene.add(lf); }
    return {
      surfaces: { counter: cTop, floor: 0 },
      cameras: {
        wide: { pos: [2.3, 1.7, 2.6], target: [0.1, 1.25, 0], fov: 42 },
        side: { pos: [2.9, 1.4, -0.05], target: [0, 1.28, -0.2], fov: 28 },
        "staff-cu": { pos: [0.85, 1.62, 0.95], target: [0.04, 1.62, -0.55], fov: 26 },
        "bow-3q": { pos: [1.6, 1.22, 1.2], target: [0.04, 1.3, -0.35], fov: 30 },
        "guest-cu": { pos: [-0.75, 1.6, -0.9], target: [0.14, 1.55, 0.62], fov: 28 },
        "two-shot": { pos: [2.2, 1.7, 1.8], target: [0.1, 1.3, 0.0], fov: 38 }
      }
    };
  },

  "diner-counter"(scene, p) {
    scene.background = new THREE.Color("#efe3cf");
    lights(scene, { key: 1.4 });
    const grad = (toon("#fff") as THREE.MeshToonMaterial).gradientMap;
    const accent = String(p.accent ?? "#b8322a");
    const shopName = String(p.shopName ?? "大衆食堂 まるき");
    const floorTex = canvasTexture(512, 512, (g, w, h) => {
      g.fillStyle = "#8d6e55"; g.fillRect(0, 0, w, h);
      g.fillStyle = "#7f6149";
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if ((i + j) % 2 === 0) g.fillRect(i * w / 4, j * h / 4, w / 4, h / 4);
    });
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(7, 7);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.MeshToonMaterial({ map: floorTex, gradientMap: grad }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
    const wallC = String(p.wall ?? "#f1e7d2");
    const back = mesh(new THREE.BoxGeometry(8, 3.2, 0.05), toon(wallC), false); back.position.set(0, 1.6, -1.5); scene.add(back);
    const wallL = mesh(new THREE.BoxGeometry(0.05, 3.2, 6), toon(wallC), false); wallL.position.set(-3.0, 1.6, 1.3); scene.add(wallL);
    const wallR = mesh(new THREE.BoxGeometry(0.05, 3.2, 6), toon(wallC), false); wallR.position.set(3.0, 1.6, 1.3); scene.add(wallR);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), flat("#f7f1e4")); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, 3.1, 1.2); scene.add(ceil);
    // kitchen back wall: white tile below, menu boards above
    const tiles = canvasTexture(512, 256, (g, w, h) => {
      g.fillStyle = "#f6f4ee"; g.fillRect(0, 0, w, h);
      g.strokeStyle = "#cfcabd"; g.lineWidth = 3;
      for (let i = 0; i <= 16; i++) { g.beginPath(); g.moveTo(i * w / 16, 0); g.lineTo(i * w / 16, h); g.stroke(); }
      for (let j = 0; j <= 8; j++) { g.beginPath(); g.moveTo(0, j * h / 8); g.lineTo(w, j * h / 8); g.stroke(); }
    });
    const tileWall = new THREE.Mesh(new THREE.PlaneGeometry(7.6, 1.5), new THREE.MeshBasicMaterial({ map: tiles })); tileWall.position.set(0, 0.9, -1.47); scene.add(tileWall);
    const tileCap = mesh(new THREE.BoxGeometry(7.6, 0.05, 0.06), toon("#8c8579"), false); tileCap.position.set(0, 1.66, -1.45); scene.add(tileCap);
    // menu boards (短冊): wooden strips with item and price
    const menuItems: Array<[string, string]> = [["ラーメン", "700"], ["餃子", "350"], ["チャーハン", "800"], ["中華そば", "650"], ["生ビール", "500"], ["定食", "900"]];
    menuItems.forEach(([name, price], i) => {
      const tex = canvasTexture(128, 300, (g, w, h) => {
        g.fillStyle = "#f8f1de"; g.fillRect(0, 0, w, h); g.strokeStyle = "#6b4a2a"; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6);
        g.fillStyle = "#2a1c12"; g.font = `bold 46px ${JP_FONT}`; g.textAlign = "center"; g.textBaseline = "middle";
        const chars = [...name]; const step = Math.min(52, 190 / chars.length);
        chars.forEach((ch, k) => g.fillText(ch, w / 2, 30 + step * (k + 0.5)));
        g.fillStyle = accent; g.font = `bold 36px ${JP_FONT}`; g.fillText(price, w / 2, h - 36);
      });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.47), new THREE.MeshBasicMaterial({ map: tex }));
      m.position.set(-1.45 + i * 0.5, 2.15, -1.46); scene.add(m);
    });
    // shop name plaque + clock
    const plq = canvasTexture(512, 112, (g, w, h) => {
      g.fillStyle = accent; g.fillRect(0, 0, w, h); g.strokeStyle = "#f1d58a"; g.lineWidth = 5; g.strokeRect(7, 7, w - 14, h - 14);
      g.fillStyle = "#fff4d6"; g.font = `bold 56px ${JP_FONT}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(shopName, w / 2, h / 2 + 2);
    });
    const plaque = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.285), new THREE.MeshBasicMaterial({ map: plq })); plaque.position.set(0.05, 2.75, -1.46); scene.add(plaque);
    const clockFace = mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.03, 28), toon("#fbfaf4"), 0.004); clockFace.rotation.x = Math.PI / 2; clockFace.position.set(2.1, 2.3, -1.44); scene.add(clockFace);
    for (const [len, rot] of [[0.1, 0.5], [0.14, -1.2]] as const) { const hnd = mesh(new THREE.BoxGeometry(0.012, len, 0.01), toon("#222"), false); hnd.position.set(2.1 + Math.sin(rot) * len / 2, 2.3 + Math.cos(rot) * len / 2, -1.42); hnd.rotation.z = -rot; scene.add(hnd); }
    // stove and pot behind the counter on the left, with a bowl shelf
    const stove = mesh(new THREE.BoxGeometry(1.0, 0.85, 0.6), toon("#9ea3a8"), 0.005); stove.position.set(-1.2, 0.425, -1.1); scene.add(stove);
    const pot = mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.34, 22), toon("#c7ccd1"), 0.004); pot.position.set(-1.2, 1.02, -1.1); scene.add(pot);
    const potLid = mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.02, 22), toon("#b4babf"), 0.003); potLid.position.set(-1.2, 1.2, -1.1); scene.add(potLid);
    const sh = shelfWall(scene, { w: 1.2, h: 0.6, rows: 2, cols: 6, seed: 41, palette: ["#f4f0e6", "#e7e2d6", "#c0392b", "#2f4f7a"], depth: 0.25 });
    sh.position.set(1.3, 1.78, -1.47);
    // counter: wooden top, plain front
    const cTop = 0.98;
    const body = mesh(new THREE.BoxGeometry(3.6, cTop - 0.05, 0.62), toon("#a8754f"), 0.005); body.position.set(0, (cTop - 0.05) / 2, 0); scene.add(body);
    const slab = mesh(new THREE.BoxGeometry(3.72, 0.05, 0.74), toon("#c9a073"), 0.005); slab.position.set(0, cTop - 0.025, 0.04); scene.add(slab);
    const kick = mesh(new THREE.BoxGeometry(3.6, 0.1, 0.02), toon("#6a4730"), false); kick.position.set(0, 0.2, 0.32); scene.add(kick);
    // counter items: tissue box, soy, pepper, chopstick cup, water pitcher
    const tissue = mesh(new THREE.BoxGeometry(0.11, 0.06, 0.07), toon("#f4efe2"), 0.003); tissue.position.set(-0.55, cTop + 0.03, 0.12); scene.add(tissue);
    const soy = mesh(new THREE.CylinderGeometry(0.025, 0.028, 0.1, 12), toon("#6a2f19"), 0.003); soy.position.set(-0.38, cTop + 0.05, 0.1); scene.add(soy);
    const soyCap = mesh(new THREE.CylinderGeometry(0.014, 0.018, 0.03, 10), toon("#c0392b"), false); soyCap.position.set(-0.38, cTop + 0.115, 0.1); scene.add(soyCap);
    const pep = mesh(new THREE.CylinderGeometry(0.02, 0.022, 0.07, 12), toon("#e9e3d1"), 0.003); pep.position.set(-0.28, cTop + 0.035, 0.12); scene.add(pep);
    const cup = mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.09, 14), toon("#d9d3c3"), 0.003); cup.position.set(1.0, cTop + 0.045, 0.1); scene.add(cup);
    for (let i = 0; i < 6; i++) { const c = mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.17, 5), toon("#7a4b2a"), false); c.position.set(1.0 + (i - 2.5) * 0.007, cTop + 0.12, 0.1 + ((i % 2) - 0.5) * 0.01); c.rotation.z = (i - 2.5) * 0.04; scene.add(c); }
    // wooden stools in front of the counter
    const stoolM = toon("#7a4b2a");
    for (const sx of [-1.4, -0.9, 0.14, 1.2]) {
      const seat = mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.06, 20), toon(accent), 0.004); seat.position.set(sx, 0.55, 0.85); scene.add(seat);
      for (const [dx, dz] of [[-0.1, -0.1], [0.1, -0.1], [-0.1, 0.1], [0.1, 0.1]] as const) { const lg = mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.52, 6), stoolM, 0.002); lg.position.set(sx + dx, 0.26, 0.85 + dz); scene.add(lg); }
    }
    return {
      surfaces: { counter: cTop, seat: 0.58, floor: 0 },
      cameras: {
        wide: { pos: [2.2, 1.75, 2.7], target: [0.1, 1.2, 0], fov: 42 },
        "taisho-cu": { pos: [0.75, 1.55, 1.0], target: [0.04, 1.5, -0.55], fov: 27 },
        "guest-cu": { pos: [-0.75, 1.5, -0.85], target: [0.14, 1.28, 0.8], fov: 28 },
        "two-shot": { pos: [0.9, 1.7, 2.7], target: [-0.35, 1.2, 0.3], fov: 40 },
        "regular-cu": { pos: [-0.5, 1.45, -0.65], target: [-0.9, 1.25, 0.8], fov: 28 },
        "counter-top": { pos: [0.1, 1.9, 0.9], target: [0.1, 1.0, -0.1], fov: 34 },
        side: { pos: [2.9, 1.4, 0.2], target: [0, 1.25, 0.2], fov: 30 }
      }
    };
  },

  /** 銭湯の番台ロビー／湯上がりの休憩所。番台（フロント）が左、背面の壁に男湯・女湯ののれん、右にフルーツ牛乳の冷蔵ケース、中央に木のベンチと扇風機。壁時計は prop `wall-clock`（param t）。 */
  "sento-lobby"(scene, p) {
    scene.background = new THREE.Color("#efe2c8");
    lights(scene, { key: 1.35, warm: true });
    const grad = (toon("#fff") as THREE.MeshToonMaterial).gradientMap;
    const accent = String(p.accent ?? "#2f6f8f");
    const shopName = String(p.shopName ?? "旭湯");
    const floorTex = canvasTexture(512, 512, (g, w, h) => {
      g.fillStyle = "#b99a72"; g.fillRect(0, 0, w, h);
      g.strokeStyle = "#a58760"; g.lineWidth = 4;
      for (let i = 0; i <= 8; i++) { g.beginPath(); g.moveTo(i * w / 8, 0); g.lineTo(i * w / 8, h); g.stroke(); }
    });
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(6, 6);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.MeshToonMaterial({ map: floorTex, gradientMap: grad }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
    const wallC = String(p.wall ?? "#f3e8cf");
    const back = mesh(new THREE.BoxGeometry(8, 3.2, 0.05), toon(wallC), false); back.position.set(0, 1.6, -1.6); scene.add(back);
    const wallL = mesh(new THREE.BoxGeometry(0.05, 3.2, 6), toon(wallC), false); wallL.position.set(-3.1, 1.6, 1.2); scene.add(wallL);
    const wallR = mesh(new THREE.BoxGeometry(0.05, 3.2, 6), toon(wallC), false); wallR.position.set(3.1, 1.6, 1.2); scene.add(wallR);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), flat("#f6eedb")); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, 3.1, 1.2); scene.add(ceil);
    // lower wall: pale green tile band
    const tileTex = canvasTexture(512, 128, (g, w, h) => {
      g.fillStyle = "#b9d6c7"; g.fillRect(0, 0, w, h);
      g.strokeStyle = "#9bbdac"; g.lineWidth = 3;
      for (let i = 0; i <= 16; i++) { g.beginPath(); g.moveTo(i * w / 16, 0); g.lineTo(i * w / 16, h); g.stroke(); }
      for (let j = 0; j <= 4; j++) { g.beginPath(); g.moveTo(0, j * h / 4); g.lineTo(w, j * h / 4); g.stroke(); }
    });
    const tiles = new THREE.Mesh(new THREE.PlaneGeometry(7.6, 0.95), new THREE.MeshBasicMaterial({ map: tileTex })); tiles.position.set(0, 0.48, -1.57); scene.add(tiles);
    const tileCap = mesh(new THREE.BoxGeometry(7.6, 0.05, 0.06), toon("#7d9a8a"), false); tileCap.position.set(0, 0.97, -1.56); scene.add(tileCap);
    // noren on the back wall (blue 男 / red 女) over two dark doorways
    const norenSpecs: Array<[number, string, string, string]> = [[-0.55, "#2c4f86", "男", "ゆ"], [0.2, "#b53a3a", "女", "ゆ"]];
    for (const [nx, col, label] of norenSpecs) {
      const door = mesh(new THREE.BoxGeometry(0.62, 1.75, 0.03), toon("#3a2a22"), false); door.position.set(nx, 0.9, -1.56); scene.add(door);
      const tex = canvasTexture(256, 220, (g, w, h) => {
        g.fillStyle = col; g.fillRect(0, 0, w, h);
        g.fillStyle = "#f7f1e0"; g.font = `bold 120px ${JP_FONT}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(label, w / 2, h * 0.5);
        g.strokeStyle = "#f7f1e0"; g.lineWidth = 6; g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.stroke();
      });
      const nm = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.52), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide })); nm.position.set(nx, 1.62, -1.5); scene.add(nm);
      const rod = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.72, 8), toon("#5a4636"), false); rod.rotation.z = Math.PI / 2; rod.position.set(nx, 1.89, -1.5); scene.add(rod);
    }
    // sign plaque above the noren
    const plq = canvasTexture(512, 112, (g, w, h) => {
      g.fillStyle = accent; g.fillRect(0, 0, w, h); g.strokeStyle = "#f1e2b8"; g.lineWidth = 5; g.strokeRect(7, 7, w - 14, h - 14);
      g.fillStyle = "#fff6dc"; g.font = `bold 62px ${JP_FONT}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(`${shopName}　ゆ`, w / 2, h / 2 + 2);
    });
    const plaque = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.285), new THREE.MeshBasicMaterial({ map: plq })); plaque.position.set(-0.17, 2.42, -1.56); scene.add(plaque);
    // 番台 (front desk) on the left: wooden counter with price board and ticket box
    const dTop = 1.0;
    const dBody = mesh(new THREE.BoxGeometry(2.0, dTop - 0.05, 0.6), toon("#9c6f46"), 0.005); dBody.position.set(-1.0, (dTop - 0.05) / 2, -0.75); scene.add(dBody);
    const dSlab = mesh(new THREE.BoxGeometry(2.12, 0.05, 0.72), toon("#c79f6e"), 0.005); dSlab.position.set(-1.0, dTop - 0.025, -0.72); scene.add(dSlab);
    const price = canvasTexture(384, 192, (g, w, h) => {
      g.fillStyle = "#fffaf0"; g.fillRect(0, 0, w, h); g.strokeStyle = "#5a3d28"; g.lineWidth = 7; g.strokeRect(4, 4, w - 8, h - 8);
      g.fillStyle = "#2b1d12"; g.font = `bold 40px ${JP_FONT}`; g.textAlign = "left"; g.textBaseline = "middle";
      g.fillText("大人　　 520円", 24, 52); g.fillText("小学生　 200円", 24, 100); g.fillText("サウナ　 +300円", 24, 148);
    });
    const board = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.25), new THREE.MeshBasicMaterial({ map: price })); board.position.set(-1.75, 1.34, -0.43); board.rotation.x = -0.1; scene.add(board);
    const stand = mesh(new THREE.BoxGeometry(0.52, 0.27, 0.02), toon("#5a3d28"), false); stand.position.set(-1.75, 1.34, -0.445); stand.rotation.x = -0.1; scene.add(stand);
    // shelf behind the desk with soap and shampoo
    const sh = shelfWall(scene, { w: 1.6, h: 0.6, rows: 2, cols: 6, seed: 17, palette: ["#e9e4d3", "#cfe3ea", "#f1c0a0", "#2f6f8f"], depth: 0.22 });
    sh.position.set(-1.0, 1.85, -1.55);
    // fruit-milk fridge on the right (glass door, three rows of bottles)
    const fx = 2.15, fz = -1.25;
    const fBody = mesh(new THREE.BoxGeometry(0.95, 1.5, 0.5), toon("#e8e4da"), 0.005); fBody.position.set(fx, 0.75, fz); scene.add(fBody);
    const fLabel = canvasTexture(256, 64, (g, w, h) => {
      g.fillStyle = "#c9462f"; g.fillRect(0, 0, w, h); g.fillStyle = "#fff6dc"; g.font = `bold 40px ${JP_FONT}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("冷たい牛乳 150円", w / 2, h / 2 + 2);
    });
    const fTop = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.22), new THREE.MeshBasicMaterial({ map: fLabel })); fTop.position.set(fx, 1.38, fz + 0.255); scene.add(fTop);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(0.82, 1.0, 0.02), new THREE.MeshPhongMaterial({ color: 0xcfe8f2, transparent: true, opacity: 0.35, shininess: 90 })); glass.position.set(fx, 0.72, fz + 0.26); scene.add(glass);
    const bottleCols = ["#f5f0dc", "#e8c36a", "#e9b6c6", "#7fb77e"];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) {
      const b = mesh(new THREE.CylinderGeometry(0.027, 0.027, 0.15, 10), toon(bottleCols[(r + c) % bottleCols.length]!), 0.002);
      b.position.set(fx - 0.32 + c * 0.128, 0.28 + r * 0.3, fz + 0.12); scene.add(b);
      const cap = mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.02, 10), toon("#f4efe2"), false); cap.position.set(fx - 0.32 + c * 0.128, 0.37 + r * 0.3, fz + 0.12); scene.add(cap);
    }
    // wooden bench against the back wall (seat height 0.45)
    const benchX = Number(p.benchX ?? 0.95), benchZ = -1.15;
    const seat = mesh(new THREE.BoxGeometry(1.6, 0.06, 0.42), toon("#b98a57"), 0.005); seat.position.set(benchX, 0.42, benchZ); scene.add(seat);
    for (const dx of [-0.7, 0.7]) for (const dz of [-0.15, 0.15]) { const lg = mesh(new THREE.BoxGeometry(0.06, 0.4, 0.06), toon("#7d5a36"), 0.003); lg.position.set(benchX + dx, 0.2, benchZ + dz); scene.add(lg); }
    // electric fan on a stand, left of the bench
    const fanX = Number(p.fanX ?? 0.12), fanZ = -0.15;
    const fanPole = mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.85, 8), toon("#b9bec4"), 0.002); fanPole.position.set(fanX, 0.43, fanZ); scene.add(fanPole);
    const fanBase = mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.04, 16), toon("#8a8f96"), 0.003); fanBase.position.set(fanX, 0.02, fanZ); scene.add(fanBase);
    const fanHead = new THREE.Group();
    const cage = mesh(new THREE.TorusGeometry(0.17, 0.012, 8, 28), toon("#c9ced4"), false); fanHead.add(cage);
    for (let i = 0; i < 4; i++) { const bl = mesh(new THREE.BoxGeometry(0.09, 0.16, 0.012), toon("#a9d2e4"), 0.002); bl.rotation.z = i * Math.PI / 2 + 0.3; bl.position.set(Math.cos(i * Math.PI / 2 + 0.3 + Math.PI / 2) * 0.085, Math.sin(i * Math.PI / 2 + 0.3 + Math.PI / 2) * 0.085, 0); fanHead.add(bl); }
    const hub = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.04, 12), toon("#6f757c"), false); hub.rotation.x = Math.PI / 2; fanHead.add(hub);
    fanHead.position.set(fanX, 0.9, fanZ); fanHead.rotation.y = 1.15; scene.add(fanHead);
    // body scale by the left doorway
    const scaleBase = mesh(new THREE.BoxGeometry(0.38, 0.1, 0.34), toon("#d9d4c8"), 0.004); scaleBase.position.set(-2.5, 0.05, -1.2); scene.add(scaleBase);
    const scaleDial = new THREE.Mesh(new THREE.CircleGeometry(0.09, 20), new THREE.MeshBasicMaterial({ map: canvasTexture(128, 128, (g, w, h) => { g.fillStyle = "#fffdf6"; g.fillRect(0, 0, w, h); g.strokeStyle = "#333"; g.lineWidth = 5; g.beginPath(); g.arc(w / 2, h / 2, 54, 0, Math.PI * 2); g.stroke(); g.fillStyle = "#c0392b"; g.fillRect(w / 2 - 3, 26, 6, 40); }) }));
    scaleDial.rotation.x = -Math.PI / 2; scaleDial.position.set(-2.5, 0.102, -1.2); scene.add(scaleDial);
    // framed poster on the right wall side of the back wall
    const poster = canvasTexture(240, 320, (g, w, h) => {
      g.fillStyle = "#fffaf0"; g.fillRect(0, 0, w, h); g.fillStyle = accent; g.fillRect(0, 0, w, 64);
      g.fillStyle = "#fff"; g.font = `bold 34px ${JP_FONT}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("お願い", w / 2, 34);
      g.fillStyle = "#2b2b2b"; g.font = `bold 26px ${JP_FONT}`; g.textAlign = "left";
      ["・湯上がりは水分補給", "・飲酒後の入浴は", "　ご遠慮ください", "・のぼせたら無理せず", "　休憩してください"].forEach((t, i) => g.fillText(t, 20, 100 + i * 42));
    });
    const pst = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.75), new THREE.MeshBasicMaterial({ map: poster })); pst.position.set(1.2, 1.9, -1.57); scene.add(pst);
    return {
      surfaces: { desk: dTop, bench: 0.45, floor: 0 },
      cameras: {
        wide: { pos: [1.5, 1.6, 4.4], target: [0.15, 1.05, -1.0], fov: 48 },
        "bench-cu": { pos: [0.62, 1.18, 1.45], target: [0.62, 1.0, -1.12], fov: 30 },
        "bench-wide": { pos: [1.7, 1.5, 3.3], target: [0.95, 0.95, -1.0], fov: 38 },
        "clerk-cu": { pos: [-0.1, 1.5, 1.2], target: [-0.85, 1.38, -1.3], fov: 30 },
        "clock-cu": { pos: [0.4, 2.0, 1.6], target: [0.4, 2.2, -1.6], fov: 22 },
        "over-bench": { pos: [-0.2, 1.4, 0.2], target: [1.0, 1.0, -1.15], fov: 38 },
        side: { pos: [3.0, 1.4, 0.4], target: [0.6, 1.0, -1.0], fov: 38 }
      }
    };
  },

  "family-restaurant"(scene, p) {
    scene.background = new THREE.Color("#f1ece2");
    lights(scene, { key: 1.4 });
    const grad = (toon("#fff") as THREE.MeshToonMaterial).gradientMap;
    const accent = String(p.accent ?? "#c0392b");
    const tiles = canvasTexture(512, 512, (g, w, h) => {
      g.fillStyle = "#e9dcc6"; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
        g.fillStyle = (i + j) % 2 ? "#e3d3b8" : "#ecdfca"; g.fillRect(i * w / 4 + 2, j * h / 4 + 2, w / 4 - 4, h / 4 - 4);
      }
    });
    tiles.wrapS = tiles.wrapT = THREE.RepeatWrapping; tiles.repeat.set(8, 8);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.MeshToonMaterial({ map: tiles, gradientMap: grad }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
    const wallC = String(p.wall ?? "#f6efe2");
    const wallB = mesh(new THREE.BoxGeometry(7, 3, 0.05), toon(wallC), false); wallB.position.set(1.2, 1.5, -1.6); scene.add(wallB);
    const wallL = mesh(new THREE.BoxGeometry(0.05, 3, 6), toon(wallC), false); wallL.position.set(-2.0, 1.5, 0.6); scene.add(wallL);
    const wallR = mesh(new THREE.BoxGeometry(0.05, 3, 6), toon(wallC), false); wallR.position.set(4.4, 1.5, 0.6); scene.add(wallR);
    const wallF = mesh(new THREE.BoxGeometry(7, 3, 0.05), toon(wallC), false); wallF.position.set(1.2, 1.5, 3.4); scene.add(wallF);
    const wainscot = mesh(new THREE.BoxGeometry(6.9, 0.9, 0.02), toon("#a8754f"), false); wainscot.position.set(1.2, 0.45, -1.565); scene.add(wainscot);
    const rail = mesh(new THREE.BoxGeometry(6.9, 0.04, 0.04), toon("#7d5236"), false); rail.position.set(1.2, 0.9, -1.55); scene.add(rail);
    // window behind the booth: sky, frame and a striped awning edge
    const sky = canvasTexture(512, 320, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "#bfe0f2"); gr.addColorStop(1, "#eaf5f9");
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.fillStyle = "#9cc58f"; for (let i = 0; i < 9; i++) { g.beginPath(); g.arc(i * 64 + 20, h - 20, 46 + rand(i) * 20, 0, Math.PI * 2); g.fill(); }
    });
    const win = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.0), new THREE.MeshBasicMaterial({ map: sky })); win.position.set(0, 1.62, -1.57); scene.add(win);
    const frameM = toon("#f4f1ea");
    for (const [w, h, x, y] of [[1.8, 0.06, 0, 2.14], [1.8, 0.06, 0, 1.1], [0.06, 1.1, -0.88, 1.62], [0.06, 1.1, 0.88, 1.62], [0.04, 1.0, 0, 1.62]] as const) {
      const f = mesh(new THREE.BoxGeometry(w, h, 0.05), frameM, 0.003); f.position.set(x, y, -1.55); scene.add(f);
    }
    // booth: bench with a high back, side panel
    const uph = toon(accent);
    const seat = mesh(new THREE.BoxGeometry(1.3, 0.12, 0.5), uph, 0.005); seat.position.set(0, 0.39, -0.97); scene.add(seat);
    const base = mesh(new THREE.BoxGeometry(1.3, 0.33, 0.46), toon("#6e4a32"), 0.004); base.position.set(0, 0.165, -0.97); scene.add(base);
    const back = mesh(new THREE.BoxGeometry(1.3, 0.72, 0.14), uph, 0.005); back.position.set(0, 0.8, -1.25); scene.add(back);
    const backTop = mesh(new THREE.BoxGeometry(1.34, 0.06, 0.18), toon("#6e4a32"), 0.004); backTop.position.set(0, 1.18, -1.25); scene.add(backTop);
    const side = mesh(new THREE.BoxGeometry(0.06, 1.2, 0.72), toon("#6e4a32"), 0.004); side.position.set(-0.68, 0.6, -1.0); scene.add(side);
    // table
    const tTop = 0.72;
    const top = mesh(new THREE.BoxGeometry(1.2, 0.04, 0.72), toon(String(p.table ?? "#efe6d6")), 0.005); top.position.set(0, tTop - 0.02, -0.35); scene.add(top);
    const edge = mesh(new THREE.BoxGeometry(1.22, 0.025, 0.74), toon("#8a6446"), false); edge.position.set(0, tTop - 0.045, -0.35); scene.add(edge);
    const post = mesh(new THREE.CylinderGeometry(0.04, 0.04, tTop - 0.06, 10), toon("#3b3b40"), 0.003); post.position.set(0, (tTop - 0.06) / 2, -0.35); scene.add(post);
    const foot = mesh(new THREE.BoxGeometry(0.7, 0.03, 0.4), toon("#3b3b40"), 0.003); foot.position.set(0, 0.015, -0.35); scene.add(foot);
    // menu stand and napkin box at the wall end of the table
    const stand = canvasTexture(200, 280, (g, w, h) => {
      g.fillStyle = "#fffaf0"; g.fillRect(0, 0, w, h);
      g.fillStyle = accent; g.fillRect(0, 0, w, 60);
      g.fillStyle = "#fff"; g.font = `bold 34px ${JP_FONT}`; g.textAlign = "center"; g.fillText("季節のおすすめ", w / 2, 42);
      g.fillStyle = "#d9a441"; g.beginPath(); g.ellipse(w / 2, 150, 70, 46, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#7a3f1f"; g.beginPath(); g.ellipse(w / 2, 145, 46, 28, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#333"; g.font = `bold 30px ${JP_FONT}`; g.fillText("ハンバーグ", w / 2, 240);
    });
    const card = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.14), new THREE.MeshBasicMaterial({ map: stand }));
    card.position.set(-0.4, tTop + 0.075, -0.62); card.rotation.x = -0.12; scene.add(card);
    const cardBack = mesh(new THREE.BoxGeometry(0.104, 0.144, 0.006), toon("#e8e1d4"), false); cardBack.position.set(-0.4, tTop + 0.075, -0.624); cardBack.rotation.x = -0.12; scene.add(cardBack);
    const nap = mesh(new THREE.BoxGeometry(0.12, 0.06, 0.08), toon("#f3f3f0"), 0.003); nap.position.set(-0.5, tTop + 0.03, -0.5); scene.add(nap);
    const napSlot = mesh(new THREE.BoxGeometry(0.08, 0.004, 0.01), flat("#ffffff"), false); napSlot.position.set(-0.5, tTop + 0.062, -0.5); scene.add(napSlot);
    const bell = mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.03, 16), toon("#2c2c30"), 0.003); bell.position.set(-0.38, tTop + 0.015, -0.48); scene.add(bell);
    const bellBtn = mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.012, 12), toon("#e8c547"), false); bellBtn.position.set(-0.38, tTop + 0.035, -0.48); scene.add(bellBtn);
    // pendant lamp over the table
    const cord = mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.75, 4), toon("#222"), false); cord.position.set(0, 2.6, -0.4); scene.add(cord);
    const shadeM = toon("#f2d39a", { emissive: "#6b4a10" }).clone(); shadeM.side = THREE.DoubleSide;
    const shade = mesh(new THREE.ConeGeometry(0.2, 0.18, 20, 1, true), shadeM, 0.004); shade.position.set(0, 2.16, -0.4); scene.add(shade);
    // register counter by the entrance
    const rx = 2.9, rz = -0.75, rTop = 1.0;
    const ctr = mesh(new THREE.BoxGeometry(1.1, rTop - 0.04, 0.5), toon("#8a5a3a"), 0.005); ctr.position.set(rx, (rTop - 0.04) / 2, rz); scene.add(ctr);
    const ctrTop = mesh(new THREE.BoxGeometry(1.16, 0.04, 0.56), toon("#efe6d6"), 0.005); ctrTop.position.set(rx, rTop - 0.02, rz); scene.add(ctrTop);
    const front = mesh(new THREE.BoxGeometry(1.0, 0.18, 0.01), toon(accent), false); front.position.set(rx, rTop - 0.2, rz + 0.255); scene.add(front);
    const reg = mesh(new THREE.BoxGeometry(0.3, 0.1, 0.26), toon("#d9d9d6"), 0.004); reg.position.set(rx + 0.25, rTop + 0.05, rz - 0.06); scene.add(reg);
    const scr = mesh(new THREE.BoxGeometry(0.24, 0.16, 0.02), toon("#2b2e33"), 0.003); scr.position.set(rx + 0.25, rTop + 0.19, rz - 0.14); scr.rotation.x = -0.25; scene.add(scr);
    const tray = mesh(new THREE.BoxGeometry(0.18, 0.012, 0.13), toon("#3a6fb0"), 0.002); tray.position.set(rx + 0.05, rTop + 0.006, rz + 0.12); scene.add(tray);
    const signTex = canvasTexture(256, 96, (g, w, h) => {
      g.fillStyle = "#fffaf0"; g.fillRect(0, 0, w, h); g.fillStyle = accent; g.fillRect(0, h - 10, w, 10);
      g.fillStyle = "#333"; g.font = `bold 52px ${JP_FONT}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("お会計", w / 2, h / 2 - 4);
    });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.16), new THREE.MeshBasicMaterial({ map: signTex })); sign.position.set(rx, 2.15, -1.55); scene.add(sign);
    // shelf of takeaway goods behind the register
    const sh = shelfWall(scene, { w: 0.9, h: 0.9, rows: 3, cols: 5, seed: 17, palette: ["#e7c27a", "#d86b4a", "#f1ece2", "#8fb3d1"], depth: 0.22 });
    sh.position.set(rx - 0.15, 1.0, -1.57);
    // glass entrance door on the right wall
    const door = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 2.1), flat("#cfe6ef")); door.rotation.y = -Math.PI / 2; door.position.set(4.37, 1.05, 0.4); scene.add(door);
    for (const z of [-0.1, 0.9]) { const df = mesh(new THREE.BoxGeometry(0.05, 2.1, 0.05), toon("#8c8f93"), false); df.position.set(4.35, 1.05, z); scene.add(df); }
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(7, 7), flat("#f8f5ee")); ceil.rotation.x = Math.PI / 2; ceil.position.set(1.2, 2.9, 0.6); scene.add(ceil);
    return {
      surfaces: { table: tTop, seat: 0.45, register: rTop, floor: 0 },
      cameras: {
        "table-wide": { pos: [1.55, 1.55, 1.5], target: [0.3, 0.9, -0.35], fov: 46 },
        "table-top": { pos: [0.3, 1.25, 0.6], target: [0.27, 0.78, -0.24], fov: 38 },
        "beko-cu": { pos: [0.75, 1.0, 0.45], target: [0.32, 0.81, -0.14], fov: 30 },
        "akuma-cu": { pos: [0.3, 1.18, 0.45], target: [-0.2, 1.0, -0.85], fov: 32 },
        "server-cu": { pos: [-0.15, 1.35, 0.35], target: [0.95, 1.38, -0.15], fov: 32 },
        "entrance-wide": { pos: [4.0, 1.65, 1.05], target: [2.8, 1.2, -0.6], fov: 46 },
        "register-staff": { pos: [2.15, 1.5, 0.25], target: [2.95, 1.35, -1.15], fov: 30 },
        "register-customer": { pos: [3.5, 1.55, -1.25], target: [2.85, 1.4, -0.05], fov: 34 },
        "register-top": { pos: [3.45, 1.5, 0.1], target: [2.65, 1.02, -0.6], fov: 30 }
      }
    };
  },
  "clinic-exam-room"(scene, p) {
    scene.background = new THREE.Color("#e9f1ee");
    lights(scene, { key: 1.5 });
    const grad = (toon("#fff") as THREE.MeshToonMaterial).gradientMap;
    const accent = String(p.accent ?? "#3e8f86");
    const floorTex = canvasTexture(512, 512, (g, w, h) => {
      g.fillStyle = "#cfd6d0"; g.fillRect(0, 0, w, h);
      g.strokeStyle = "#bfc7c0"; g.lineWidth = 4;
      for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * w / 4, 0); g.lineTo(i * w / 4, h); g.stroke(); g.beginPath(); g.moveTo(0, i * h / 4); g.lineTo(w, i * h / 4); g.stroke(); }
    });
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(6, 6);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.MeshToonMaterial({ map: floorTex, gradientMap: grad }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
    const wallC = String(p.wall ?? "#f3f7f4");
    const back = mesh(new THREE.BoxGeometry(8, 3, 0.05), toon(wallC), false); back.position.set(0, 1.5, -1.6); scene.add(back);
    const wallL = mesh(new THREE.BoxGeometry(0.05, 3, 6), toon(wallC), false); wallL.position.set(-2.5, 1.5, 1.2); scene.add(wallL);
    const wallR = mesh(new THREE.BoxGeometry(0.05, 3, 6), toon(wallC), false); wallR.position.set(2.5, 1.5, 1.2); scene.add(wallR);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), flat("#f8faf8")); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, 2.9, 1.0); scene.add(ceil);
    // green stripe along the back wall
    const stripe = mesh(new THREE.BoxGeometry(8, 0.12, 0.02), toon(accent), false); stripe.position.set(0, 0.95, -1.57); scene.add(stripe);
    // wall air conditioner (above the desk side) with a wall controller beside it
    const ac = mesh(new THREE.BoxGeometry(0.95, 0.28, 0.2), toon("#f6f6f2"), 0.004); ac.position.set(-0.95, 2.45, -1.48); scene.add(ac);
    const louver = mesh(new THREE.BoxGeometry(0.85, 0.03, 0.12), toon("#e4e4de"), false); louver.position.set(-0.95, 2.33, -1.38); scene.add(louver);
    const acLamp = mesh(new THREE.BoxGeometry(0.04, 0.02, 0.01), toon("#6fcf7a"), false); acLamp.position.set(-0.55, 2.5, -1.375); scene.add(acLamp);
    const ctl = mesh(new THREE.BoxGeometry(0.11, 0.16, 0.025), toon("#f3f2ec"), 0.003); ctl.position.set(-0.4, 1.42, -1.575); scene.add(ctl);
    const ctlLcd = mesh(new THREE.BoxGeometry(0.07, 0.04, 0.004), toon("#cfd8c8"), false); ctlLcd.position.set(-0.4, 1.47, -1.56); scene.add(ctlLcd);
    for (const [bx, by] of [[-0.425, 1.395], [-0.375, 1.395], [-0.425, 1.36], [-0.375, 1.36]] as const) { const b = mesh(new THREE.BoxGeometry(0.03, 0.022, 0.006), toon("#8a8f92"), false); b.position.set(bx, by, -1.56); scene.add(b); }
    // window with blind and a sash handle
    const winX = 1.55;
    const sky = canvasTexture(256, 320, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "#c8e3f2"); gr.addColorStop(1, "#f1f8fb"); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = "#a9cf9c"; g.beginPath(); g.arc(70, h, 90, Math.PI, 0); g.fill(); g.beginPath(); g.arc(190, h, 70, Math.PI, 0); g.fill(); });
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 1.2), new THREE.MeshBasicMaterial({ map: sky })); pane.position.set(winX, 1.75, -1.57); scene.add(pane);
    const fm = toon("#e8ebe8");
    for (const [w, h, x, y] of [[1.05, 0.06, winX, 2.38], [1.05, 0.06, winX, 1.12], [0.06, 1.26, winX - 0.5, 1.75], [0.06, 1.26, winX + 0.5, 1.75], [0.04, 1.2, winX, 1.75]] as const) { const f = mesh(new THREE.BoxGeometry(w, h, 0.05), fm, 0.003); f.position.set(x, y, -1.55); scene.add(f); }
    const latch = mesh(new THREE.BoxGeometry(0.05, 0.02, 0.03), toon("#7c8084"), false); latch.position.set(winX, 1.75, -1.5); scene.add(latch);
    // poster on the left wall
    const poster = canvasTexture(256, 340, (g, w, h) => {
      g.fillStyle = "#fffdf7"; g.fillRect(0, 0, w, h); g.fillStyle = accent; g.fillRect(0, 0, w, 70);
      g.fillStyle = "#fff"; g.font = `bold 34px ${JP_FONT}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("手洗い・うがい", w / 2, 36);
      g.fillStyle = "#cfe8f2"; g.beginPath(); g.arc(w / 2, 190, 62, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#333"; g.font = `bold 26px ${JP_FONT}`; g.fillText("感染症予防", w / 2, 300);
    });
    const pst = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.56), new THREE.MeshBasicMaterial({ map: poster })); pst.position.set(-2.47, 1.65, 0.2); pst.rotation.y = Math.PI / 2; scene.add(pst);
    // desk with a PC (electronic chart): the entry form shows its accepted range
    const dTop = 0.74;
    const dx = -1.5, dz = -1.15;
    const dTopM = mesh(new THREE.BoxGeometry(1.3, 0.04, 0.6), toon("#e3d5bd"), 0.005); dTopM.position.set(dx, dTop - 0.02, dz); scene.add(dTopM);
    for (const sx of [-0.6, 0.6]) { const lg = mesh(new THREE.BoxGeometry(0.05, dTop - 0.04, 0.55), toon("#9aa3a6"), 0.004); lg.position.set(dx + sx, (dTop - 0.04) / 2, dz); scene.add(lg); }
    const drawer = mesh(new THREE.BoxGeometry(0.35, 0.5, 0.5), toon("#cfd5d6"), 0.004); drawer.position.set(dx + 0.38, 0.45, dz); scene.add(drawer);
    const monBody = mesh(new THREE.BoxGeometry(0.5, 0.32, 0.03), toon("#2b2e33"), 0.003); monBody.position.set(dx, dTop + 0.27, dz - 0.18); scene.add(monBody);
    const monStand = mesh(new THREE.BoxGeometry(0.06, 0.1, 0.05), toon("#2b2e33"), 0.003); monStand.position.set(dx, dTop + 0.05, dz - 0.18); scene.add(monStand);
    const screen = canvasTexture(512, 320, (g, w, h) => {
      g.fillStyle = "#f4f8fb"; g.fillRect(0, 0, w, h);
      g.fillStyle = accent; g.fillRect(0, 0, w, 56);
      g.fillStyle = "#fff"; g.font = `bold 30px ${JP_FONT}`; g.textAlign = "left"; g.textBaseline = "middle"; g.fillText("電子カルテ  バイタル入力", 18, 30);
      g.fillStyle = "#222"; g.font = `bold 34px ${JP_FONT}`; g.fillText("体温", 24, 118);
      g.strokeStyle = "#7a8a96"; g.lineWidth = 3; g.strokeRect(120, 88, 190, 60);
      g.fillStyle = "#222"; g.fillText("℃", 322, 118);
      g.fillStyle = "#c0392b"; g.font = `bold 28px ${JP_FONT}`; g.fillText("入力できる範囲：36.0〜42.0", 24, 196);
      g.fillStyle = "#222"; g.font = `bold 26px ${JP_FONT}`; g.fillText("血圧", 24, 258); g.strokeRect(120, 232, 190, 46);
    });
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.288), new THREE.MeshBasicMaterial({ map: screen })); scr.position.set(dx, dTop + 0.27, dz - 0.163); scene.add(scr);
    const kb = mesh(new THREE.BoxGeometry(0.34, 0.015, 0.12), toon("#d8dadc"), 0.002); kb.position.set(dx, dTop + 0.008, dz + 0.1); scene.add(kb);
    // exam bed with a paper sheet in the back right corner
    const bed = mesh(new THREE.BoxGeometry(0.7, 0.45, 1.8), toon("#8aa7b3"), 0.005); bed.position.set(2.05, 0.225, -0.55); scene.add(bed);
    const pad = mesh(new THREE.BoxGeometry(0.66, 0.08, 1.76), toon("#e9f0f2"), 0.004); pad.position.set(2.05, 0.49, -0.55); scene.add(pad);
    // low cabinet with a plant at the left
    const cab = mesh(new THREE.BoxGeometry(0.9, 0.85, 0.4), toon("#d9dedc"), 0.004); cab.position.set(-2.0, 0.425, 0.8); scene.add(cab);
    return {
      surfaces: { desk: dTop, seat: 0.45, floor: 0 },
      cameras: {
        wide: { pos: [0.2, 1.7, 3.2], target: [0.1, 1.2, -0.2], fov: 44 },
        "two-shot": { pos: [0.05, 1.3, 3.9], target: [0.05, 1.05, 0.1], fov: 40 },
        "nurse-cu": { pos: [1.2, 1.5, 1.3], target: [-0.35, 1.35, 0.1], fov: 30 },
        "patient-cu": { pos: [-1.3, 1.1, 1.6], target: [0.5, 0.95, 0.1], fov: 30 },
        "wall-cu": { pos: [0.3, 1.5, 0.9], target: [0.15, 1.5, -1.6], fov: 26 },
        "pc-cu": { pos: [-0.9, 1.3, 0.2], target: [-1.45, 1.05, -1.3], fov: 32 },
        "ac-cu": { pos: [-2.0, 1.6, -0.2], target: [-0.7, 1.9, -1.3], fov: 42 },
        window: { pos: [0.9, 1.6, 0.4], target: [1.5, 1.6, -1.55], fov: 34 },
        side: { pos: [2.2, 1.35, 1.7], target: [0.05, 1.2, 0.0], fov: 34 }
      }
    };
  },

  "personal-gym"(scene, p) {
    scene.background = new THREE.Color("#e8ecf0");
    lights(scene, { key: 1.5 });
    const grad = (toon("#fff") as THREE.MeshToonMaterial).gradientMap;
    const accent = String(p.accent ?? "#e0663a");
    // rubber floor, with a lighter mat in the training area
    const floorTex = canvasTexture(512, 512, (g, w, h) => {
      g.fillStyle = "#3b4048"; g.fillRect(0, 0, w, h);
      g.strokeStyle = "#343840"; g.lineWidth = 4;
      for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * w / 4, 0); g.lineTo(i * w / 4, h); g.stroke(); g.beginPath(); g.moveTo(0, i * h / 4); g.lineTo(w, i * h / 4); g.stroke(); }
    });
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(6, 6);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.MeshToonMaterial({ map: floorTex, gradientMap: grad }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
    const wallC = String(p.wall ?? "#eef0f2");
    const back = mesh(new THREE.BoxGeometry(8, 3, 0.05), toon(wallC), false); back.position.set(0, 1.5, -1.8); scene.add(back);
    const wallL = mesh(new THREE.BoxGeometry(0.05, 3, 6), toon(wallC), false); wallL.position.set(-2.0, 1.5, 1.2); scene.add(wallL);
    const wallR = mesh(new THREE.BoxGeometry(0.05, 3, 6), toon(wallC), false); wallR.position.set(2.8, 1.5, 1.2); scene.add(wallR);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(9, 8), flat("#f6f7f8")); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, 2.9, 1.0); scene.add(ceil);
    // orange stripe along the walls
    const stripeB = mesh(new THREE.BoxGeometry(8, 0.1, 0.02), toon(accent), false); stripeB.position.set(0, 0.95, -1.77); scene.add(stripeB);
    const stripeL = mesh(new THREE.BoxGeometry(0.02, 0.1, 6), toon(accent), false); stripeL.position.set(-1.97, 0.95, 1.2); scene.add(stripeL);
    // big mirror on the back wall (pale glass panel with a soft sheen)
    const mir = canvasTexture(512, 192, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, "#dbe7ee"); gr.addColorStop(0.5, "#eef5f8"); gr.addColorStop(1, "#cfdde6");
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.fillStyle = "rgba(255,255,255,0.55)"; g.beginPath(); g.moveTo(90, 0); g.lineTo(150, 0); g.lineTo(80, h); g.lineTo(20, h); g.fill();
      g.beginPath(); g.moveTo(260, 0); g.lineTo(290, 0); g.lineTo(220, h); g.lineTo(190, h); g.fill();
    });
    const mirror = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.35), new THREE.MeshBasicMaterial({ map: mir })); mirror.position.set(0.3, 1.7, -1.76); scene.add(mirror);
    const mf = toon("#2b2e33");
    for (const [w, h, x, y] of [[3.7, 0.05, 0.3, 2.4], [3.7, 0.05, 0.3, 1.0], [0.05, 1.4, -1.55, 1.7], [0.05, 1.4, 2.15, 1.7]] as const) { const f = mesh(new THREE.BoxGeometry(w, h, 0.04), mf, 0.003); f.position.set(x, y, -1.75); scene.add(f); }
    // wall clock on the left wall
    const clk = canvasTexture(128, 128, (g, w, h) => {
      g.fillStyle = "#fff"; g.beginPath(); g.arc(64, 64, 60, 0, Math.PI * 2); g.fill(); g.strokeStyle = "#333"; g.lineWidth = 6; g.stroke();
      g.lineWidth = 6; g.beginPath(); g.moveTo(64, 64); g.lineTo(64, 24); g.stroke(); g.beginPath(); g.moveTo(64, 64); g.lineTo(92, 74); g.stroke();
    });
    const clock = new THREE.Mesh(new THREE.CircleGeometry(0.16, 24), new THREE.MeshBasicMaterial({ map: clk })); clock.position.set(-1.96, 2.05, 0.7); clock.rotation.y = Math.PI / 2; scene.add(clock);
    // rubber exercise mat in the middle of the floor
    const mat = mesh(new THREE.BoxGeometry(1.5, 0.02, 1.9), toon("#5aa0c8"), 0.003); mat.position.set(0.25, 0.012, 0.0); scene.add(mat);
    // dumbbell rack along the back wall (right)
    const rack = new THREE.Group();
    const rb = mesh(new THREE.BoxGeometry(1.5, 0.05, 0.4), toon("#4a4f57"), 0.004); rb.position.y = 0.55; rack.add(rb);
    const rb2 = mesh(new THREE.BoxGeometry(1.5, 0.05, 0.4), toon("#4a4f57"), 0.004); rb2.position.y = 0.95; rack.add(rb2);
    for (const lx of [-0.72, 0.72]) { const lg = mesh(new THREE.BoxGeometry(0.05, 1.0, 0.4), toon("#4a4f57"), 0.004); lg.position.set(lx, 0.5, 0); rack.add(lg); }
    for (let i = 0; i < 7; i++) for (const [ry, sz] of [[0.6, 0.09], [1.0, 0.07]] as const) {
      const d = mesh(new THREE.CylinderGeometry(sz, sz, 0.26, 14), toon(i % 2 ? "#202328" : "#3a3f47"), 0.003); d.rotation.z = Math.PI / 2; d.position.set(-0.6 + i * 0.2, ry + sz, 0); rack.add(d);
    }
    rack.position.set(1.4, 0, -1.55); scene.add(rack);
    // kettlebells on the floor at the left of the back wall
    for (const [kx, kz, kc] of [[-1.25, -1.5, "#c9382f"], [-0.95, -1.5, "#2f6fbf"], [-1.1, -1.28, "#e8b53a"]] as const) {
      const kb = new THREE.Group();
      const ball = mesh(new THREE.SphereGeometry(0.12, 16, 12), toon(kc), 0.004); ball.position.y = 0.12; kb.add(ball);
      const hd = mesh(new THREE.TorusGeometry(0.06, 0.016, 8, 14), toon(kc), 0.003); hd.position.y = 0.27; kb.add(hd);
      kb.position.set(kx, 0, kz); scene.add(kb);
    }
    return {
      surfaces: { floor: 0, mat: 0.02 },
      cameras: {
        wide: { pos: [0.1, 1.5, 5.2], target: [0.0, 0.95, 0.0], fov: 44 },
        "two-shot": { pos: [0.0, 1.1, 4.4], target: [-0.05, 0.85, 0.0], fov: 40 },
        "trainer-cu": { pos: [1.0, 1.4, 1.9], target: [-0.5, 1.3, 0.0], fov: 30 },
        "client-cu": { pos: [-0.9, 0.95, 1.7], target: [0.35, 0.8, 0.0], fov: 30 },
        "floor-wide": { pos: [0.3, 0.9, 4.6], target: [0.3, 0.85, 0.0], fov: 44 },
        "floor-low": { pos: [0.4, 0.35, 4.6], target: [0.4, 0.3, 0.0], fov: 34 },
        "bench-side": { pos: [0.4, 0.55, 4.0], target: [0.4, 0.5, 0.0], fov: 34 },
        "wall-side": { pos: [-1.25, 0.85, 4.2], target: [-1.25, 0.75, 0.0], fov: 44 },
        "wall-cu": { pos: [-1.65, 0.7, 3.0], target: [-1.65, 0.65, 0.0], fov: 34 }
      }
    };
  },

  /**
   * Animal clinic examination room. A human patient stands on the floor scale;
   * keep the owner, patient and veterinarian inside the wide vertical frame.
   */
  "animal-clinic"(scene, p) {
    scene.background = new THREE.Color("#e8efed");
    lights(scene, { key: 1.45 });
    const grad = (toon("#fff") as THREE.MeshToonMaterial).gradientMap;
    const floorTex = canvasTexture(512, 512, (g, w, h) => {
      g.fillStyle = "#e5e2d9"; g.fillRect(0, 0, w, h);
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
        g.fillStyle = (x + y) % 2 ? "#ddd9cf" : "#e9e6de";
        g.fillRect(x * w / 4 + 2, y * h / 4 + 2, w / 4 - 4, h / 4 - 4);
      }
    });
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(5, 5);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.MeshToonMaterial({ map: floorTex, gradientMap: grad }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

    const wallColor = String(p.wall ?? "#f3f5f1");
    const back = mesh(new THREE.BoxGeometry(5.4, 3.0, 0.06), toon(wallColor), false);
    back.position.set(0, 1.5, -2.0); scene.add(back);
    const left = mesh(new THREE.BoxGeometry(0.06, 3.0, 5.2), toon("#e7ece8"), false);
    left.position.set(-2.7, 1.5, 0.5); scene.add(left);
    const right = mesh(new THREE.BoxGeometry(0.06, 3.0, 5.2), toon("#e7ece8"), false);
    right.position.set(2.7, 1.5, 0.5); scene.add(right);
    const base = mesh(new THREE.BoxGeometry(5.35, 0.13, 0.035), toon("#9eafa8"), false);
    base.position.set(0, 0.08, -1.96); scene.add(base);

    // Clinic sign with legible Japanese lettering.
    const signTex = canvasTexture(512, 180, (g, w, h) => {
      g.fillStyle = "#eaf4ee"; g.fillRect(0, 0, w, h);
      g.fillStyle = "#2b6654"; g.fillRect(0, 0, 14, h);
      g.fillStyle = "#31594c"; g.font = `bold 76px ${JP_FONT}`; g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText("動物病院", w / 2 + 4, h / 2);
    });
    const sign = mesh(new THREE.BoxGeometry(1.45, 0.58, 0.06), toon("#f8faf6"), 0.004);
    sign.position.set(0, 2.48, -1.91); scene.add(sign);
    const signFace = new THREE.Mesh(new THREE.PlaneGeometry(1.36, 0.48), new THREE.MeshBasicMaterial({ map: signTex }));
    signFace.position.set(0, 2.48, -1.875); scene.add(signFace);

    // Animal-health poster with simple silhouettes.
    const posterTex = canvasTexture(256, 340, (g, w, h) => {
      g.fillStyle = "#fffdf7"; g.fillRect(0, 0, w, h);
      g.fillStyle = "#7bb19b"; g.fillRect(0, 0, w, 54);
      g.fillStyle = "#ffffff"; g.font = `bold 25px ${JP_FONT}`; g.textAlign = "center"; g.fillText("健康チェック", w / 2, 37);
      g.fillStyle = "#b98655";
      g.beginPath(); g.arc(92, 142, 38, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(63, 101, 15, 34, -0.35, 0, Math.PI * 2); g.ellipse(121, 101, 15, 34, 0.35, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#24292b"; g.beginPath(); g.arc(78, 139, 4, 0, Math.PI * 2); g.arc(106, 139, 4, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#6b7b79"; g.font = `18px ${JP_FONT}`;
      ["食事・運動・体重", "定期的に確認しましょう"].forEach((t, i) => g.fillText(t, w / 2, 232 + i * 34));
    });
    const posterFrame = mesh(new THREE.BoxGeometry(0.72, 0.98, 0.035), toon("#d7ddd7"), 0.003);
    posterFrame.position.set(1.95, 1.75, -1.91); scene.add(posterFrame);
    const poster = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.92), new THREE.MeshBasicMaterial({ map: posterTex }));
    poster.position.set(1.95, 1.75, -1.887); scene.add(poster);

    // Floor scale: the human patient stands on it.
    const scaleBase = mesh(new THREE.BoxGeometry(0.82, 0.10, 0.72), toon("#536d6c"), 0.008);
    scaleBase.position.set(0.05, 0.07, 0.77); scene.add(scaleBase);
    const scaleTop = mesh(new THREE.BoxGeometry(0.75, 0.035, 0.65), toon("#dce8e3"), 0.004);
    scaleTop.position.set(0.05, 0.137, 0.77); scene.add(scaleTop);
    const display = mesh(new THREE.BoxGeometry(0.28, 0.095, 0.035), toon("#273b3c"), 0.003);
    display.position.set(0.05, 0.19, 1.12); scene.add(display);
    const displayFace = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.052), flat("#a8d1bf"));
    displayFace.position.set(0.05, 0.19, 1.14); scene.add(displayFace);

    // A real dog lead and collar make the single role reversal readable at a glance.
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.018, 8, 28), toon("#cb5d54"));
    collar.rotation.x = Math.PI / 2; collar.position.set(0.05, 1.38, 0.77); scene.add(collar);
    const leadCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.48, 1.08, -0.20),
      new THREE.Vector3(-0.22, 1.24, 0.06),
      new THREE.Vector3(-0.04, 1.36, 0.42),
      new THREE.Vector3(0.05, 1.38, 0.67)
    ]);
    const lead = mesh(new THREE.TubeGeometry(leadCurve, 24, 0.012, 8, false), toon("#c65a52"), false);
    scene.add(lead);

    return {
      surfaces: { floor: 0, scale: 0.155, exam: 0.98 },
      cameras: {
        wide: { pos: [0.12, 1.95, 5.8], target: [0.02, 1.0, 0.0], fov: 44 },
        "dog-cu": { pos: [-1.0, 1.35, 2.6], target: [-0.72, 1.05, -0.15], fov: 38 },
        "patient-cu": { pos: [0.12, 1.35, 2.85], target: [0.05, 1.1, 0.78], fov: 37 },
        "vet-cu": { pos: [1.5, 1.45, 2.65], target: [0.82, 1.15, -0.45], fov: 38 },
        "over-dog": { pos: [-1.65, 1.85, 2.7], target: [0.05, 0.95, 0.1], fov: 44 },
        payoff: { pos: [0.18, 2.05, 5.3], target: [0.02, 0.95, 0.18], fov: 46 },
        side: { pos: [-2.1, 1.55, 1.8], target: [0.1, 0.9, 0.15], fov: 44 }
      }
    };
  },

  /** 焼肉店のテーブル席。壁側にベンチ、中央に無煙ロースター付きの木のテーブル（天板 0.72・ロースター網 0.74）、上に排気ダクト。
   *  客は +Z 側（ry=π）と -Z 側（ry=0）のベンチに `seated: true` で座る（座面 0.45）。通路は +X 側で、店員はテーブルの +X 端（x≈1.0, ry=-π/2）に立つ。
   *  壁時計は prop `wall-clock`（奥の壁 x=-2.36、ry=π/2）。カメラ: wide（+X から2人の横顔）, grill-top, dog-cu, friend-cu, table-low, aisle。 */
  "yakiniku-booth"(scene, p) {
    scene.background = new THREE.Color("#2a1a14");
    lights(scene, { key: 1.25, warm: true });
    const grad = (toon("#fff") as THREE.MeshToonMaterial).gradientMap;
    const accent = String(p.accent ?? "#b3261e");
    const shopName = String(p.shopName ?? "焼肉 ほまれ");
    const floorTex = canvasTexture(512, 512, (g, w, h) => {
      g.fillStyle = "#4a3a30"; g.fillRect(0, 0, w, h);
      g.fillStyle = "#3f3027";
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if ((i + j) % 2 === 0) g.fillRect(i * w / 4, j * h / 4, w / 4, h / 4);
    });
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(7, 7);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.MeshToonMaterial({ map: floorTex, gradientMap: grad }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
    const wallC = String(p.wall ?? "#6b4a37");
    const backW = mesh(new THREE.BoxGeometry(0.05, 3.2, 7), toon(wallC), false); backW.position.set(-2.4, 1.6, 0); scene.add(backW);
    const wallN = mesh(new THREE.BoxGeometry(7, 3.2, 0.05), toon("#7a5640"), false); wallN.position.set(0, 1.6, -2.5); scene.add(wallN);
    const wallS = mesh(new THREE.BoxGeometry(7, 3.2, 0.05), toon("#7a5640"), false); wallS.position.set(0, 1.6, 2.5); scene.add(wallS);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), flat("#3a2a22")); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, 3.1, 0); scene.add(ceil);
    // lower wall: dark wood boards + a plaster band above
    const boards = canvasTexture(512, 128, (g, w, h) => {
      g.fillStyle = "#4b3226"; g.fillRect(0, 0, w, h);
      g.strokeStyle = "#392519"; g.lineWidth = 4;
      for (let i = 0; i <= 12; i++) { g.beginPath(); g.moveTo(i * w / 12, 0); g.lineTo(i * w / 12, h); g.stroke(); }
    });
    const boardWall = new THREE.Mesh(new THREE.PlaneGeometry(6.8, 1.0), new THREE.MeshBasicMaterial({ map: boards })); boardWall.position.set(-2.37, 0.5, 0); boardWall.rotation.y = Math.PI / 2; scene.add(boardWall);
    // menu strips and a shop plaque on the back wall (x=-2.37)
    const menuItems: Array<[string, string]> = [["上カルビ", "1,280"], ["ハラミ", "1,180"], ["タン塩", "1,480"], ["ロース", "980"], ["ホルモン", "680"], ["ライス", "250"]];
    menuItems.forEach(([name, price], i) => {
      const tex = canvasTexture(128, 300, (g, w, h) => {
        g.fillStyle = "#f6ecd6"; g.fillRect(0, 0, w, h); g.strokeStyle = "#5a3a22"; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6);
        g.fillStyle = "#2a1c12"; g.font = `bold 44px ${JP_FONT}`; g.textAlign = "center"; g.textBaseline = "middle";
        const chars = [...name]; const step = Math.min(50, 190 / chars.length);
        chars.forEach((ch, k) => g.fillText(ch, w / 2, 28 + step * (k + 0.5)));
        g.fillStyle = accent; g.font = `bold 30px ${JP_FONT}`; g.fillText(price, w / 2, h - 34);
      });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.47), new THREE.MeshBasicMaterial({ map: tex }));
      m.position.set(-2.36, 1.55, -1.3 + i * 0.5); m.rotation.y = Math.PI / 2; scene.add(m);
    });
    const plq = canvasTexture(512, 112, (g, w, h) => {
      g.fillStyle = accent; g.fillRect(0, 0, w, h); g.strokeStyle = "#f1d58a"; g.lineWidth = 5; g.strokeRect(7, 7, w - 14, h - 14);
      g.fillStyle = "#fff4d6"; g.font = `bold 56px ${JP_FONT}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(shopName, w / 2, h / 2 + 2);
    });
    const plaque = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.285), new THREE.MeshBasicMaterial({ map: plq })); plaque.position.set(-2.36, 2.55, -0.9); plaque.rotation.y = Math.PI / 2; scene.add(plaque);
    // paper lanterns
    for (const lz of [-1.7, 1.6]) {
      const lan = mesh(new THREE.SphereGeometry(0.16, 16, 12), toon(accent, { emissive: "#5a1410" }), 0.004); lan.scale.set(1, 1.15, 1); lan.position.set(-2.1, 2.35, lz); scene.add(lan);
      const cap = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 10), toon("#2a1c12"), false); cap.position.set(-2.1, 2.55, lz); scene.add(cap);
    }
    // table: wooden top on a dark base, long axis along X
    const tTop = 0.72;
    const top = mesh(new THREE.BoxGeometry(1.4, 0.05, 0.9), toon("#b98a5c"), 0.005); top.position.set(0, tTop - 0.025, 0); scene.add(top);
    const base = mesh(new THREE.BoxGeometry(0.2, tTop - 0.05, 0.2), toon("#3b2a20"), 0.004); base.position.set(0, (tTop - 0.05) / 2, 0); scene.add(base);
    const foot = mesh(new THREE.BoxGeometry(0.9, 0.04, 0.5), toon("#3b2a20"), 0.004); foot.position.set(0, 0.02, 0); scene.add(foot);
    // smokeless roaster set into the table centre
    const ring = mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.03, 28), toon("#2b2b30"), 0.004); ring.position.set(0, tTop + 0.005, 0); scene.add(ring);
    const coal = mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.02, 28), toon("#ff6a2a", { emissive: "#9c2a08" }), false); coal.position.set(0, tTop + 0.015, 0); scene.add(coal);
    for (let i = 0; i < 9; i++) {
      const bar = mesh(new THREE.BoxGeometry(0.46, 0.008, 0.012), toon("#3a3a42"), false);
      bar.position.set(0, tTop + 0.04, -0.2 + i * 0.05); scene.add(bar);
    }
    const rim = mesh(new THREE.TorusGeometry(0.235, 0.012, 6, 32), toon("#4a4a52"), false); rim.rotation.x = Math.PI / 2; rim.position.set(0, tTop + 0.035, 0); scene.add(rim);
    // exhaust hood and duct
    const hood = mesh(new THREE.CylinderGeometry(0.2, 0.55, 0.28, 24, 1, true), toon("#b7bcc2"), 0.004);
    (hood.material as THREE.Material).side = THREE.DoubleSide; hood.position.set(0, 1.9, 0); scene.add(hood);
    const duct = mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.4, 20), toon("#a9aeb4"), 0.004); duct.position.set(0, 2.55, 0); scene.add(duct);
    // table items: tare dishes, cups, chopstick box, tongs, call button
    const dishM = toon("#f4efe4");
    for (const [dx, dz, sauce] of [[-0.5, 0.3, "#5a2a12"], [-0.5, -0.3, "#6b3a1a"], [0.5, 0.3, "#5a2a12"], [0.5, -0.3, "#6b3a1a"]] as const) {
      const dish = mesh(new THREE.CylinderGeometry(0.06, 0.045, 0.025, 18), dishM, 0.003); dish.position.set(dx, tTop + 0.0125, dz); scene.add(dish);
      const sc = mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.004, 18), toon(sauce), false); sc.position.set(dx, tTop + 0.022, dz); scene.add(sc);
    }
    for (const [dx, dz] of [[-0.62, 0.0], [0.62, 0.0]] as const) {
      const glass = mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.11, 14), toon("#d6ecf2", { transparent: true, opacity: 0.55 }), 0.002); glass.position.set(dx, tTop + 0.055, dz); scene.add(glass);
    }
    const chopBox = mesh(new THREE.BoxGeometry(0.05, 0.12, 0.05), toon("#7a4b2a"), 0.003); chopBox.position.set(0.62, tTop + 0.06, -0.3); scene.add(chopBox);
    const tongM = toon("#c9ced4");
    for (const k of [-1, 1]) { const arm = mesh(new THREE.BoxGeometry(0.22, 0.008, 0.012), tongM, false); arm.position.set(0.4, tTop + 0.006, 0.34 + k * 0.012); arm.rotation.y = k * 0.05; scene.add(arm); }
    const callBtn = mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.02, 14), toon(accent), 0.002); callBtn.position.set(-0.62, tTop + 0.01, 0.3); scene.add(callBtn);
    // bench seats along both long sides (seat 0.45), with a low back
    const benchM = toon("#7a3b2a");
    for (const sz of [-1, 1]) {
      const seat = mesh(new THREE.BoxGeometry(1.5, 0.08, 0.42), benchM, 0.004); seat.position.set(0, 0.41, sz * 0.82); scene.add(seat);
      const bBase = mesh(new THREE.BoxGeometry(1.4, 0.37, 0.36), toon("#3b2a20"), false); bBase.position.set(0, 0.185, sz * 0.82); scene.add(bBase);
      const back = mesh(new THREE.BoxGeometry(1.5, 0.5, 0.06), benchM, 0.004); back.position.set(0, 0.74, sz * 1.04); scene.add(back);
    }
    return {
      surfaces: { table: tTop, grill: tTop + 0.045, seat: 0.45, floor: 0 },
      cameras: {
        wide: { pos: [4.5, 1.55, 0], target: [0, 0.98, 0], fov: 45 },
        aisle: { pos: [3.4, 1.4, 0.0], target: [0.3, 1.0, 0], fov: 40 },
        "grill-top": { pos: [0.55, 1.55, 0.0], target: [0, 0.76, 0], fov: 34 },
        "table-low": { pos: [1.55, 1.05, 0.0], target: [0, 0.84, 0], fov: 32 },
        "dog-cu": { pos: [0.7, 1.35, -1.6], target: [0, 1.0, 0.8], fov: 30 },
        "friend-cu": { pos: [0.7, 1.4, 1.7], target: [0, 1.1, -0.8], fov: 30 },
        side: { pos: [3.0, 1.2, 1.6], target: [0, 0.95, 0], fov: 40 }
      }
    };
  },

  /** 通勤電車のロングシート（座席の前の通路から見る）。奥の壁(z=-1.1)に窓と窓上の広告枠、壁沿いに5人掛けのベンチ（座面 0.45、座面の中心 z=-0.72）。
   *  座る人は `seated: true`、x=-1.0/-0.5/0/0.5/1.0、z≈-0.78、root.y≈-0.32、ry=0。立つ人は z≈-0.15、ry=π。吊り革は z=0.15。
   *  窓上の広告は `params.posterX`（既定 -0.5）に `params.posterTitle` / `posterSub` / `posterAccent` で出す。カメラ: wide, front, row-cu, s-cu, ko-cu, poster, low-row。 */
  "train-seat"(scene, p) {
    scene.background = new THREE.Color("#cfd8de");
    lights(scene, { key: 1.35 });
    const grad = (toon("#fff") as THREE.MeshToonMaterial).gradientMap;
    const posterX = Number(p.posterX ?? -0.5);
    const accent = String(p.posterAccent ?? "#d9532b");
    const floorTex = canvasTexture(512, 512, (g, w, h) => {
      g.fillStyle = "#9aa2ab"; g.fillRect(0, 0, w, h);
      g.fillStyle = "#8f979f";
      for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) if ((i + j) % 2 === 0) g.fillRect(i * w / 8, j * h / 8, w / 8, h / 8);
    });
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(6, 6);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 10), new THREE.MeshToonMaterial({ map: floorTex, gradientMap: grad }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; floor.position.set(0, 0, 1.5); scene.add(floor);
    // wall pieces around the windows (z=-1.1)
    const wallM = "#e6e1d3";
    const lower = mesh(new THREE.BoxGeometry(9, 0.95, 0.06), toon("#d8d2c2"), false); lower.position.set(0, 0.475, -1.13); scene.add(lower);
    const upper = mesh(new THREE.BoxGeometry(9, 0.6, 0.06), toon(wallM), false); upper.position.set(0, 2.1, -1.13); scene.add(upper);
    const upper2 = mesh(new THREE.BoxGeometry(9, 0.4, 0.06), toon(wallM), false); upper2.position.set(0, 2.5, -1.13); scene.add(upper2);
    for (const px of [-2.6, -0.95, 0.95, 2.6]) { const pil = mesh(new THREE.BoxGeometry(0.16, 0.95, 0.07), toon("#d5cfbe"), false); pil.position.set(px, 1.425, -1.13); scene.add(pil); }
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(10, 3.2), flat("#f1f0ea")); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, 2.4, 0.3); scene.add(ceil);
    for (const lx of [-1.8, 0.2, 2.2]) { const lamp = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.16), flat("#fffef2")); lamp.rotation.x = Math.PI / 2; lamp.position.set(lx, 2.395, -0.25); scene.add(lamp); }
    // view through the windows: daytime city strip
    const cityTex = canvasTexture(1024, 256, (g, w, h) => {
      const sky = g.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, "#9fd0ee"); sky.addColorStop(1, "#e4f1f7");
      g.fillStyle = sky; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 30; i++) {
        const bw = 30 + rand(i * 3) * 60, bh = 40 + rand(i * 5 + 1) * 110, bx = i * 36 + rand(i) * 10;
        g.fillStyle = ["#c7ced6", "#b7c0ca", "#d6d8d4", "#aab4bf"][i % 4]!; g.fillRect(bx, h - bh, bw, bh);
        g.fillStyle = "#e9eff4";
        for (let wy = h - bh + 8; wy < h - 10; wy += 16) for (let wx = bx + 6; wx < bx + bw - 8; wx += 14) g.fillRect(wx, wy, 6, 8);
      }
    });
    const city = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.1), new THREE.MeshBasicMaterial({ map: cityTex })); city.position.set(0, 1.4, -1.5); scene.add(city);
    // window-top advert rail with the focus poster and decoys
    const poster = canvasTexture(640, 320, (g, w, h) => {
      g.fillStyle = "#fff6e0"; g.fillRect(0, 0, w, h);
      g.fillStyle = accent; g.fillRect(0, 0, w, 78);
      g.fillStyle = "#fff"; g.font = `bold 54px ${JP_FONT}`; g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText(String(p.posterTitle ?? "全国 駅弁フェア"), w / 2, 42);
      g.fillStyle = "#3b2a20"; g.font = `bold 58px ${JP_FONT}`;
      g.fillText(String(p.posterSub ?? "桜ヶ丘駅 ホール"), w / 2, 150);
      g.fillStyle = accent; g.font = `bold 66px ${JP_FONT}`;
      g.fillText(String(p.posterNote ?? "本日まで"), w / 2, 238);
      g.fillStyle = "#d9a441"; g.beginPath(); g.arc(70, 240, 34, 0, Math.PI * 2); g.arc(570, 240, 34, 0, Math.PI * 2); g.fill();
    });
    const frame = mesh(new THREE.BoxGeometry(1.1, 0.58, 0.03), toon("#ffffff"), 0.003); frame.position.set(posterX, 2.12, -1.08); scene.add(frame);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.5), new THREE.MeshBasicMaterial({ map: poster })); face.position.set(posterX, 2.12, -1.062); scene.add(face);
    [[posterX - 1.6, "#3f7fb5"], [posterX + 1.6, "#5aa36b"], [posterX + 3.2, "#c9a13c"], [posterX - 3.2, "#8b6bb1"]].forEach(([dx, col], i) => {
      const f2 = mesh(new THREE.BoxGeometry(1.1, 0.58, 0.03), toon("#ffffff"), 0.003); f2.position.set(dx as number, 2.12, -1.08); scene.add(f2);
      const tex = canvasTexture(256, 128, (g, w, h) => {
        g.fillStyle = col as string; g.fillRect(0, 0, w, h); g.fillStyle = "rgba(255,255,255,0.85)";
        g.fillRect(14, 16, 150, 14); g.fillRect(14, 44, 110, 10); g.fillRect(14, 64, 190, 10); g.fillRect(150, 90, 90, 24);
      });
      const f3 = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.5), new THREE.MeshBasicMaterial({ map: tex })); f3.position.set(dx as number, 2.12, -1.062 + i * 0.0001); scene.add(f3);
    });
    // bench: 5 seats of 0.5 m
    const benchBase = mesh(new THREE.BoxGeometry(2.7, 0.38, 0.5), toon("#3a3f48"), 0.004); benchBase.position.set(0, 0.19, -0.72); scene.add(benchBase);
    for (let i = 0; i < 5; i++) {
      const cx = -1.0 + i * 0.5;
      const cush = mesh(new THREE.BoxGeometry(0.46, 0.09, 0.48), toon("#2f6aa0"), 0.004); cush.position.set(cx, 0.405, -0.72); scene.add(cush);
      const back = mesh(new THREE.BoxGeometry(0.46, 0.36, 0.07), toon("#2f6aa0"), 0.004); back.position.set(cx, 0.78, -1.04); back.rotation.x = -0.1; scene.add(back);
    }
    for (const ex of [-1.3, 1.3]) { const arm = mesh(new THREE.BoxGeometry(0.06, 0.3, 0.46), toon("#bfc4cb"), 0.003); arm.position.set(ex, 0.6, -0.74); scene.add(arm); }
    // stanchion pole and the divider at the right end
    const pole = mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.4, 12), toon("#c7ccd2"), 0.003); pole.position.set(1.42, 1.2, -0.28); scene.add(pole);
    const divider = mesh(new THREE.BoxGeometry(0.03, 0.9, 0.45), toon("#dfe6ea", { transparent: true, opacity: 0.45 }), false); divider.position.set(1.34, 1.0, -0.78); scene.add(divider);
    // overhead grab rail and straps along z=0.15
    const rail = mesh(new THREE.CylinderGeometry(0.018, 0.018, 7, 10), toon("#c7ccd2"), false); rail.rotation.z = Math.PI / 2; rail.position.set(0, 2.18, 0.15); scene.add(rail);
    for (let i = -6; i <= 6; i++) {
      const sx = i * 0.5 + 0.25;
      if (Math.abs(sx - posterX) < 0.62) continue; // keep the advert readable
      const cord = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.26, 6), toon("#555b63"), false); cord.position.set(sx, 2.04, 0.15); scene.add(cord);
      const ring = mesh(new THREE.TorusGeometry(0.075, 0.012, 8, 20), toon("#e9ecef"), 0.002); ring.position.set(sx, 1.82, 0.15); ring.rotation.y = Math.PI / 2; scene.add(ring);
    }
    return {
      surfaces: { seat: 0.45, floor: 0, rail: 2.18 },
      cameras: {
        wide: { pos: [1.9, 1.7, 5.4], target: [-0.05, 1.1, -0.5], fov: 48 },
        front: { pos: [0.1, 1.5, 5.4], target: [0.0, 1.1, -0.6], fov: 46 },
        "row-cu": { pos: [0.2, 1.3, 2.8], target: [0.0, 1.05, -0.75], fov: 36 },
        "s-cu": { pos: [-3.6, 1.6, -0.1], target: [-0.85, 1.5, -0.15], fov: 30 },
        "ko-cu": { pos: [0.9, 1.45, 1.5], target: [-0.25, 1.1, -0.7], fov: 28 },
        poster: { pos: [posterX, 1.9, 1.4], target: [posterX, 2.1, -1.1], fov: 30 },
        "low-row": { pos: [0.3, 0.9, 3.3], target: [0.0, 0.9, -0.75], fov: 38 }
      }
    };
  }
};

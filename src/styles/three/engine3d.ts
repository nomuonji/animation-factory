import * as THREE from "three";
import { mapSet, type StyleDef } from "../themes";
import type { ActorSpec, StyledTimeline, Visual } from "../types";
import { Mats } from "./materials";
import { buildSet3D, type Built3D } from "./sets3d";
import { buildProp, iconTexture } from "./props3d";
import { Figure3D, shade } from "./figure3d";
import { mixPose, poseAt, ease } from "../pose";
import { atTime, clamp01, hash, lerp, rand, span, timed } from "../util";
import { SCENES2D } from "../draw2d/scenes";
import { sceneAt, talkAt } from "../draw2d/engine2d";
import { isLight } from "../overlay";
import { JP } from "../themes";
import { figureBox, inspecting } from "../inspect";

const X = 0.62; // stage x (-1..1) -> world units

interface Live { sc: Visual; set: Built3D; setName: string; figures: Map<string, Figure3D>; props: { spec: NonNullable<Visual["props"]>[number]; obj: THREE.Object3D }[]; extra: THREE.Group }

/**
 * 3D engine for Style Shorts. Builds the scene for the current beat, poses the shared rig,
 * renders with the style's look, then draws 2D content (cards, counters, labels) on top.
 */
export class Engine3D {
  ready: Promise<void>;
  private renderer: THREE.WebGLRenderer;
  private gl: HTMLCanvasElement;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private mats: Mats;
  private live: Live | null = null;
  private setCache = new Map<string, Built3D>();
  private lights = new THREE.Group();
  private flicker: THREE.PointLight | null = null;
  private lowRes: number;
  private dither: CanvasPattern | null = null;
  private emoteTex = new Map<string, THREE.Texture>();

  constructor(private tl: StyledTimeline, private st: StyleDef) {
    const { width: W, height: H } = tl.meta;
    this.lowRes = st.look === "ps2" ? 4 * (W / 1080) : 1;
    this.gl = document.createElement("canvas");
    this.gl.width = Math.round(W / this.lowRes); this.gl.height = Math.round(H / this.lowRes);
    this.renderer = new THREE.WebGLRenderer({ canvas: this.gl, antialias: st.look !== "ps2" && st.look !== "voxel", preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(this.gl.width, this.gl.height, false);
    this.renderer.shadowMap.enabled = st.look !== "ps2";
    this.renderer.shadowMap.type = st.look === "clay" || st.look === "soft" ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = st.look === "clay" || st.look === "soft" || st.look === "studio-dark" ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
    this.camera = new THREE.PerspectiveCamera(40, W / H, 0.05, 200);
    this.mats = new Mats(st.look ?? "toon");
    this.scene.add(this.lights);
    this.setupLights();
    if (st.look === "ps2") this.dither = this.makeDither();
    this.ready = Promise.resolve();
  }

  private setupLights() {
    const L = this.lights, look = this.st.look;
    const sun = new THREE.DirectionalLight("#ffffff", look === "clay" ? 2.2 : look === "soft" ? 2.4 : 1.6);
    sun.position.set(-3, 6, 4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 0.5, far: 30 });
    sun.shadow.bias = -0.0008;
    sun.shadow.radius = look === "clay" ? 6 : 2;
    if (look === "horror") {
      L.add(new THREE.AmbientLight("#9aa0b8", 0.12));
      this.flicker = new THREE.PointLight("#e8e8ff", 6, 9, 1.6);
      this.flicker.position.set(0, 2.6, 1.2); this.flicker.castShadow = true;
      L.add(this.flicker);
      return;
    }
    if (look === "studio-dark") {
      L.add(new THREE.HemisphereLight("#9aa4b8", "#0d0f14", 0.6));
      const key = new THREE.DirectionalLight("#ffffff", 2.0); key.position.set(2, 4, 5); L.add(key);
      const r1 = new THREE.DirectionalLight(this.st.accent, 2.5); r1.position.set(-5, 2, -3); L.add(r1);
      const r2 = new THREE.DirectionalLight(this.st.accent2, 2.0); r2.position.set(5, 3, -4); L.add(r2);
      return;
    }
    const hemi = look === "ps2" ? new THREE.HemisphereLight("#9fb0d8", "#2c3e2c", 1.3)
      : look === "soft" ? new THREE.HemisphereLight("#fff1dc", "#e0a060", 1.2)
      : look === "studio" ? new THREE.HemisphereLight("#ffffff", "#d8d8d8", 1.6)
      : new THREE.HemisphereLight("#ffffff", "#8a9a7a", look === "toon" ? 1.1 : 1.3);
    L.add(hemi);
    if (look === "studio") sun.intensity = 1.2;
    L.add(sun, sun.target);
  }

  private makeDither(): CanvasPattern {
    const c = document.createElement("canvas"); c.width = c.height = 4;
    const g = c.getContext("2d")!;
    const b = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { const v = b[y]![x]! / 16; g.fillStyle = `rgba(${v > 0.5 ? 255 : 0},${v > 0.5 ? 255 : 0},${v > 0.5 ? 255 : 0},${Math.abs(v - 0.5) * 0.25})`; g.fillRect(x, y, 1, 1); }
    return document.createElement("canvas").getContext("2d")!.createPattern(c, "repeat")!;
  }

  private getSet(name: string): Built3D {
    let s = this.setCache.get(name);
    if (!s) { s = buildSet3D(name, this.st, this.mats); this.setCache.set(name, s); }
    return s;
  }

  private build(sc: Visual) {
    if (this.live) {
      this.scene.remove(this.live.set.group, this.live.extra);
      for (const f of this.live.figures.values()) this.scene.remove(f.root);
      for (const p of this.live.props) this.scene.remove(p.obj);
    }
    const stageLike = sc.scene === "stage" || sc.scene === "route" || sc.scene === "exploded";
    const setName = sc.scene === "route" ? "city-white" : sc.scene === "exploded" ? "void-dark" : mapSet(this.st, stageLike ? sc.set : undefined);
    const set = this.getSet(setName);
    this.scene.add(set.group);
    this.scene.background = new THREE.Color(set.bg);
    this.scene.fog = set.fog ? new THREE.Fog(set.fog[0], set.fog[1], set.fog[2]) : null;
    const figures = new Map<string, Figure3D>();
    const props: Live["props"] = [];
    const extra = new THREE.Group();
    this.scene.add(extra);
    if (sc.scene === "stage") {
      for (const a of sc.actors ?? []) {
        const seed = hash(a.id);
        const shadowFig = a.color === "shadow";
        const f = new Figure3D(this.st, this.mats, {
          color: shadowFig ? "#060608" : a.color ?? this.st.palette[Math.floor(seed * this.st.palette.length)] ?? this.st.accent,
          accent: shadowFig ? "#060608" : a.accent ?? this.st.accent2,
          skin: shadowFig ? "#060608" : this.st.figure === "avatar" ? "#ffd23f" : this.st.figure === "brick" ? "#ffcc00" : "#ffd2b0",
          hair: a.hair ?? (this.st.figure === "voxel" || this.st.figure === "avatar" ? "short" : "spiky")
        });
        f.root.userData.actor = a;
        this.scene.add(f.root);
        figures.set(a.id, f);
      }
      for (const p of sc.props ?? []) { const obj = buildProp(p.kind, this.st, this.mats, p.color); this.scene.add(obj); props.push({ spec: p, obj }); }
    }
    if (sc.scene === "exploded") this.buildExploded(sc, extra);
    this.live = { sc, set, setName, figures, props, extra };
  }

  private buildExploded(sc: Visual, extra: THREE.Group) {
    const layers = sc.layers ?? [];
    const disc = ["burger", "cake", "sandwich", "onigiri", "planet", "earth"].includes(sc.object ?? "");
    layers.forEach((l, i) => {
      const col = l.color ?? this.st.palette[i % this.st.palette.length]!;
      const geo = disc ? new THREE.CylinderGeometry(0.8, 0.8, 0.14, 48) : new THREE.BoxGeometry(1.0, 0.07, 1.9);
      const mesh = new THREE.Mesh(geo, this.mats.body(col));
      if (!disc) { const edge = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: shade(col, 0.4), transparent: true, opacity: 0.6 })); mesh.add(edge); }
      mesh.userData.i = i;
      extra.add(mesh);
    });
    extra.rotation.set(0.5, -0.6, 0.15);
    extra.scale.setScalar(Math.min(0.62, 3.2 / Math.max(1, layers.length)));
  }

  private emote(name: string): THREE.Texture {
    let tx = this.emoteTex.get(name);
    if (tx) return tx;
    const map: Record<string, string> = { heart: "heart", sweat: "drop", idea: "bolt", anger: "fire" };
    if (map[name] || !["!", "?", "...", "zzz"].includes(name)) tx = iconTexture(map[name] ?? name, this.st);
    else {
      const c = document.createElement("canvas"); c.width = c.height = 256;
      const g = c.getContext("2d")!;
      g.font = `900 200px ${JP}`; g.textAlign = "center"; g.textBaseline = "middle"; g.lineJoin = "round";
      const txt = name === "zzz" ? "z" : name;
      g.lineWidth = 26; g.strokeStyle = "#111"; g.strokeText(txt, 128, 136); g.fillStyle = name === "!" ? "#ff3b3b" : "#ffd23f"; g.fillText(txt, 128, 136);
      tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace;
    }
    this.emoteTex.set(name, tx);
    return tx;
  }

  render(out: CanvasRenderingContext2D, tRaw: number) {
    const { tl, st } = this;
    const W = tl.meta.width, H = tl.meta.height;
    const sc = sceneAt(tl, tRaw);
    if (!sc) return;
    if (!this.live || this.live.sc !== sc) this.build(sc);
    // clay is shot on twos (12 fps steps); everything else is smooth
    const t = st.look === "clay" ? Math.floor(tRaw * 12) / 12 : tRaw;
    const talk = talkAt(tl, tRaw);
    const live = this.live!;
    // camera
    const base = live.set.cam ?? { pos: [0, 0.95, 3.4] as [number, number, number], target: [0, 0.58, 0] as [number, number, number], fov: 40 };
    const cam = sc.camera ?? {};
    const k = ease.inOut(span(t, sc, "start", "end"));
    const zoom = lerp(cam.zoom ?? 1, cam.to?.zoom ?? cam.zoom ?? 1, k);
    const cx = lerp(cam.x ?? 0, cam.to?.x ?? cam.x ?? 0, k) * X;
    const cy = lerp(cam.y ?? 0, cam.to?.y ?? cam.y ?? 0, k);
    const drift = Math.sin(t * 0.35) * 0.12;
    const dir = new THREE.Vector3(...base.pos).sub(new THREE.Vector3(...base.target));
    const stageLike = sc.scene === "stage";
    const orbit = stageLike ? drift * 0.5 : t * 0.08;
    dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), orbit);
    dir.multiplyScalar(1 / zoom);
    const target = new THREE.Vector3(base.target[0] + cx, base.target[1] + cy, base.target[2]);
    const shake = (cam.shake ?? 0) * 0.03;
    this.camera.position.copy(target).add(dir).add(new THREE.Vector3(Math.sin(t * 53) * shake, Math.cos(t * 41) * shake, 0));
    this.camera.fov = base.fov ?? 40;
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(target);
    if (this.flicker) this.flicker.intensity = 5 + Math.sin(t * 23) * 0.6 + (Math.sin(t * 3.1) > 0.97 ? -4 : 0);
    // animated set details
    live.set.group.traverse((o) => { if (o.userData.spin) o.rotation.y += 0; if (o.userData.spin) o.rotation.y = t * o.userData.spin; });
    if (sc.scene === "stage") this.updateStage(sc, t, talk);
    if (sc.scene === "route") this.updateRoute(sc, t);
    if (sc.scene === "exploded") this.updateExploded(sc, t);
    this.renderer.render(this.scene, this.camera);
    if (inspecting() && sc.scene === "stage") for (const [id, f] of live.figures) {
      const b = new THREE.Box3().setFromObject(f.root);
      const xs: number[] = [], ys: number[] = [];
      for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) { const p = new THREE.Vector3(x, y, z).project(this.camera); xs.push(p.x * 0.5 + 0.5); ys.push(-p.y * 0.5 + 0.5); }
      figureBox(id, { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) });
    }
    // scene transitions (same vocabulary as the 2D engine)
    const dt = tRaw - (sc.start ?? 0), first = (sc.index ?? 0) === 0;
    const tr = first ? "cut" : (sc.transition ?? st.transition);
    out.save();
    out.imageSmoothingEnabled = this.lowRes === 1;
    if (tr === "pop" && dt < 0.25) { const k = 0.9 + 0.1 * ease.back(clamp01(dt / 0.25)); out.fillStyle = st.bg; out.fillRect(0, 0, W, H); out.translate(W / 2, H / 2); out.scale(k, k); out.translate(-W / 2, -H / 2); }
    if (tr === "slide" && dt < 0.32) { out.fillStyle = st.bg; out.fillRect(0, 0, W, H); out.translate((1 - ease.out(clamp01(dt / 0.32))) * W, 0); }
    out.drawImage(this.gl, 0, 0, W, H);
    out.restore();
    if (tr === "flash" && dt < 0.16) { out.fillStyle = `rgba(255,255,255,${1 - dt / 0.16})`; out.fillRect(0, 0, W, H); }
    if (tr === "fade" && dt < 0.25) { out.fillStyle = `rgba(0,0,0,${0.9 * (1 - dt / 0.25)})`; out.fillRect(0, 0, W, H); }
    if (st.look === "ps2" && this.dither) { out.save(); out.fillStyle = this.dither; out.scale(this.lowRes, this.lowRes); out.fillRect(0, 0, W / this.lowRes, H / this.lowRes); out.restore(); }
    if (st.look === "horror" || st.look === "ps2") vignette(out, W, H, st.look === "horror" ? 0.75 : 0.4);
    if (sc.scene === "route") this.routeLabels(out, sc, t, W, H);
    if (sc.scene === "exploded") this.explodedLabels(out, sc, t, W, H);
    if (!["stage", "route", "exploded"].includes(sc.scene)) this.flatContent(out, sc, tRaw, W, H, talk);
    if (st.id === "game-avatar") this.gameHud(out, t, W, H);
  }

  private updateStage(sc: Visual, t: number, talk: number) {
    const live = this.live!;
    for (const [id, f] of live.figures) {
      const a = (sc.actors ?? []).find((x) => x.id === id) as ActorSpec;
      const m = span(t, sc, a.to?.at, a.to?.until);
      const x0 = a.x0 ?? a.x ?? 0, y0 = a.y0 ?? a.y ?? 0, z0 = a.z0 ?? a.z ?? 0;
      const ax = a.to?.x !== undefined ? lerp(x0, a.to.x, ease.inOut(m)) : a.x ?? x0;
      const ay = a.to?.y !== undefined ? lerp(y0, a.to.y, ease.inOut(m)) : a.y ?? y0;
      const az = a.to?.z !== undefined ? lerp(z0, a.to.z, ease.inOut(m)) : a.z ?? z0;
      const P = timed(a.pose, t, sc, "idle");
      const blend = clamp01((t - P.since) / 0.2);
      f.setPose(blend < 1 ? mixPose(poseAt(P.prev, t), poseAt(P.cur, t), ease.inOut(blend)) : poseAt(P.cur, t));
      f.setFace(timed(a.face, t, sc, "neutral").cur, a.talks ? talk : 0);
      const E = timed(a.emote, t, sc, "");
      f.setEmote(E.cur ? this.emote(E.cur) : null);
      const s = (a.scale ?? 1) * (a.color === "shadow" ? 1.45 : 1);
      f.root.scale.setScalar(s);
      f.root.position.set(ax * X, ay, az);
      // walking across: turn sideways so the picture-plane leg swing becomes a stride
      let turn = 0;
      if (a.to?.x !== undefined && a.to.x !== x0) {
        const a0 = atTime(a.to.at ?? "start", sc), a1 = atTime(a.to.until ?? "end", sc);
        turn = Math.sign(a.to.x - x0) * clamp01((t - a0) / 0.2) * clamp01((a1 - t) / 0.2);
      }
      f.root.rotation.y = turn * Math.PI / 2 + (a.facing && !turn ? a.facing * 0.35 : 0);
    }
    for (const { spec: p, obj } of live.props) {
      const appear = p.at !== undefined ? atTime(p.at, sc) : -1;
      obj.visible = t >= appear;
      const pop = appear >= 0 ? ease.back(clamp01((t - appear) / 0.3)) : 1;
      const m = span(t, sc, p.to?.at, p.to?.until);
      const px = lerp(p.x ?? 0, p.to?.x ?? p.x ?? 0, ease.inOut(m)), py = lerp(p.y ?? 0, p.to?.y ?? p.y ?? 0, ease.inOut(m));
      const pz = lerp(p.z ?? -0.3, p.to?.z ?? p.z ?? -0.3, ease.inOut(m));
      obj.position.set(px * X, py, pz);
      obj.scale.setScalar(lerp(p.scale ?? 1, p.to?.scale ?? p.scale ?? 1, ease.inOut(m)) * pop * 0.6);
      obj.rotation.z = lerp(p.rot ?? 0, p.to?.rot ?? p.rot ?? 0, m);
      const flame = obj.getObjectByName("flame");
      if (flame) { flame.visible = (p.to?.y ?? p.y ?? 0) !== (p.y ?? 0) && m > 0 && m < 1; flame.scale.y = 0.8 + 0.4 * Math.sin(t * 40); }
    }
  }

  // ---------------- route ----------------
  private routePts(sc: Visual): THREE.Vector3[] {
    // a deterministic Manhattan route along the street grid (streets at multiples of 3)
    const r = rand(hash(`${sc.label ?? ""}${sc.text ?? ""}`) * 1000 + 1);
    const pts: THREE.Vector3[] = [new THREE.Vector3(-3, 0.06, 3)];
    let x = -3, z = 3;
    const goals: [number, number][] = [[-3, 0], [0, 0], [0, -3], [3, -3], [3, -6]];
    if (r() > 0.5) goals.splice(1, 2, [-3, -3], [0, -3]);
    for (const [gx, gz] of goals) { x = gx; z = gz; pts.push(new THREE.Vector3(x, 0.06, z)); }
    return pts;
  }

  private updateRoute(sc: Visual, t: number) {
    const live = this.live!;
    const pts = this.routePts(sc);
    const u = ease.inOut(span(t, sc, "start+0.3", "lineEnd-0.2"));
    live.extra.clear();
    const total = pts.slice(1).reduce((s, p, i) => s + p.distanceTo(pts[i]!), 0);
    let left = total * u;
    const mat = this.mats.body(this.st.accent, { emissive: shade(this.st.accent, -0.6) });
    for (let i = 1; i < pts.length && left > 0; i++) {
      const a = pts[i - 1]!, b = pts[i]!, d = a.distanceTo(b), l = Math.min(d, left);
      left -= l;
      const dirv = b.clone().sub(a).normalize();
      const seg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.04, l + 0.22), mat);
      seg.position.copy(a.clone().add(dirv.clone().multiplyScalar(l / 2)));
      seg.lookAt(seg.position.clone().add(dirv));
      live.extra.add(seg);
    }
    const start = buildProp("pin", this.st, this.mats, this.st.accent); start.position.copy(pts[0]!); start.scale.setScalar(0.9); live.extra.add(start);
    const endK = ease.back(clamp01((t - atTime("lineEnd-0.2", sc)) / 0.35));
    if (endK > 0) { const end = buildProp("pin", this.st, this.mats, this.st.accent2); end.position.copy(pts.at(-1)!); end.scale.setScalar(1.1 * endK); live.extra.add(end); }
    // camera follows the head of the line
    let walk = total * u; let head = pts[0]!.clone();
    for (let i = 1; i < pts.length; i++) { const d = pts[i]!.distanceTo(pts[i - 1]!); if (walk <= d) { head = pts[i - 1]!.clone().lerp(pts[i]!, walk / d); break; } walk -= d; head = pts[i]!.clone(); }
    this.camera.position.set(head.x + 2.2, 13, head.z + 5.5);
    this.camera.lookAt(head.x, 0, head.z - 1.2);
  }

  private routeLabels(g: CanvasRenderingContext2D, sc: Visual, t: number, W: number, H: number) {
    const pts = this.routePts(sc);
    const p = pts.at(-1)!.clone().add(new THREE.Vector3(0, 1.0, 0)).project(this.camera);
    const k = ease.back(clamp01((t - atTime("lineEnd-0.1", sc)) / 0.35));
    if (k > 0 && sc.eta) {
      const x = (p.x * 0.5 + 0.5) * W, y = (-p.y * 0.5 + 0.5) * H;
      chipCard(g, this.st, x, y - W * 0.06, sc.eta, sc.label ?? "", W, k);
    }
    // start chip always visible at the top
    const s = W * 0.034;
    g.save(); g.font = `800 ${Math.round(s)}px ${JP}`; g.textBaseline = "middle";
    const txt = sc.text ?? sc.label ?? "";
    if (txt) { const w = g.measureText(txt).width + s * 3; g.fillStyle = "#ffffff"; g.shadowColor = "rgba(0,0,0,0.18)"; g.shadowBlur = s; g.beginPath(); g.roundRect(W * 0.06, H * 0.06, w, s * 2.2, s * 0.5); g.fill(); g.shadowBlur = 0; g.fillStyle = this.st.accent; g.beginPath(); g.arc(W * 0.06 + s * 1.2, H * 0.06 + s * 1.1, s * 0.45, 0, Math.PI * 2); g.fill(); g.fillStyle = "#222"; g.fillText(txt, W * 0.06 + s * 2.1, H * 0.06 + s * 1.12); }
    g.restore();
  }

  // ---------------- exploded ----------------
  private updateExploded(sc: Visual, t: number) {
    const live = this.live!;
    const n = Math.max(1, live.extra.children.length);
    const u = ease.inOut(span(t, sc, "start+0.2", "line+1.2"));
    live.extra.children.forEach((c, i) => { c.position.y = ((n - 1) / 2 - i) * (0.08 + 0.42 * u); });
    live.extra.rotation.y = -0.6 + Math.sin(t * 0.4) * 0.15;
    this.camera.position.set(0, 0.5, 5.6);
    this.camera.lookAt(0, -0.45, 0);
  }

  private explodedLabels(g: CanvasRenderingContext2D, sc: Visual, t: number, W: number, H: number) {
    const live = this.live!;
    const layers = sc.layers ?? [];
    const a = atTime("line+0.6", sc), b = atTime("lineEnd-0.3", sc);
    live.extra.children.forEach((c, i) => {
      const l = layers[i]; if (!l) return;
      const at = a + ((b - a) * i) / Math.max(1, layers.length);
      const k = clamp01((t - at) / 0.3); if (k <= 0) return;
      const wp = new THREE.Vector3(); (c as THREE.Mesh).getWorldPosition(wp);
      const p = wp.project(this.camera);
      const x = (p.x * 0.5 + 0.5) * W, y = (-p.y * 0.5 + 0.5) * H;
      const lx = W * 0.6, s = W * 0.036;
      g.save(); g.globalAlpha = k;
      g.strokeStyle = "rgba(230,230,230,0.7)"; g.lineWidth = 2; g.beginPath(); g.moveTo(x + W * 0.05, y); g.lineTo(lx - W * 0.02, y); g.stroke();
      g.fillStyle = this.st.accent; g.beginPath(); g.arc(x + W * 0.05, y, 5, 0, Math.PI * 2); g.fill();
      g.font = `700 ${Math.round(s)}px ${this.st.font}`; g.textBaseline = "middle"; g.lineJoin = "round";
      g.lineWidth = s * 0.25; g.strokeStyle = "#0d0f14"; g.strokeText(l.label, lx, y - (l.detail ? s * 0.5 : 0));
      g.fillStyle = "#f2f2f2"; g.fillText(l.label, lx, y - (l.detail ? s * 0.5 : 0));
      if (l.detail) { g.font = `400 ${Math.round(s * 0.75)}px ${this.st.font}`; g.fillStyle = "#9aa4b8"; g.fillText(l.detail, lx, y + s * 0.7); }
      g.restore();
    });
    if (sc.title || sc.text) { const s = W * 0.034; g.save(); g.font = `700 ${Math.round(s)}px ${this.st.font}`; g.fillStyle = "#9aa4b8"; g.fillText((sc.title ?? sc.text)!, W * 0.07, H * 0.08); g.restore(); }
  }

  // ---------------- 2D content over a 3D backdrop ----------------
  private flatContent(g: CanvasRenderingContext2D, sc: Visual, t: number, W: number, H: number, talk: number) {
    const st = this.st;
    const zoneBottom = Math.min(0.74, st.caption.y - 0.08) * H;
    const k = ease.out(clamp01((t - (sc.start ?? 0)) / 0.25));
    const dark = !isLight(st.paper);
    g.save();
    g.globalAlpha = 0.9 * k;
    g.fillStyle = st.paper;
    g.beginPath(); g.roundRect(W * 0.06, H * 0.08 + (1 - k) * H * 0.03, W * 0.88, zoneBottom - H * 0.06, W * 0.05); g.fill();
    g.restore();
    const flat: StyleDef = { ...st, engine: "2d", bg: st.paper, ink: dark ? "#e6e6e6" : st.ink, paper: dark ? "#e6e6e6" : st.paper, accent2: st.accent2 };
    g.save();
    (SCENES2D[sc.scene] ?? SCENES2D.card!)({ g, st: flat, tl: this.tl, W, H, t, sc, talk, noBg: true });
    g.restore();
  }

  private gameHud(g: CanvasRenderingContext2D, t: number, W: number, H: number) {
    const s = W * 0.032;
    g.save(); g.font = `800 ${Math.round(s)}px ${JP}`; g.textBaseline = "middle";
    g.fillStyle = "rgba(20,20,30,0.55)"; g.beginPath(); g.roundRect(W * 0.04, H * 0.05, W * 0.2, s * 1.8, s * 0.4); g.fill();
    g.fillStyle = "#fff"; g.fillText("● あなた", W * 0.06, H * 0.05 + s * 0.92);
    const mm = Math.floor(7 + t / 60), ss = Math.floor(t % 60);
    const clock = `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
    g.fillStyle = "rgba(20,20,30,0.55)"; g.beginPath(); g.roundRect(W * 0.78, H * 0.05, W * 0.18, s * 1.8, s * 0.4); g.fill();
    g.fillStyle = "#fff"; g.textAlign = "center"; g.fillText(clock, W * 0.87, H * 0.05 + s * 0.92);
    g.restore();
  }
}

function vignette(g: CanvasRenderingContext2D, W: number, H: number, a: number) {
  const gr = g.createRadialGradient(W / 2, H * 0.45, H * 0.18, W / 2, H * 0.45, H * 0.72);
  gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, `rgba(0,0,0,${a})`);
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
}

function chipCard(g: CanvasRenderingContext2D, st: StyleDef, x: number, y: number, big: string, small: string, W: number, k: number) {
  const s = W * 0.05;
  g.save(); g.translate(x, y); g.scale(k, k);
  g.font = `900 ${Math.round(s)}px ${JP}`;
  const w = Math.max(g.measureText(big).width, small ? g.measureText(small).width * 0.6 : 0) + s * 2.4, h = small ? s * 2.4 : s * 1.6;
  g.shadowColor = "rgba(0,0,0,0.2)"; g.shadowBlur = s * 0.6;
  g.fillStyle = "#fff"; g.beginPath(); g.roundRect(-w / 2, -h, w, h, s * 0.35); g.fill();
  g.shadowBlur = 0;
  g.beginPath(); g.moveTo(-s * 0.3, 0); g.lineTo(0, s * 0.35); g.lineTo(s * 0.3, 0); g.fill();
  g.fillStyle = st.accent; g.beginPath(); g.roundRect(-w / 2 + s * 0.3, -h + s * 0.3, s * 1.0, s * 1.0, s * 0.2); g.fill();
  g.fillStyle = "#fff"; g.font = `900 ${Math.round(s * 0.55)}px ${JP}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("▲", -w / 2 + s * 0.8, -h + s * 0.82);
  g.fillStyle = "#222"; g.textAlign = "left"; g.font = `900 ${Math.round(s)}px ${JP}`; g.fillText(big, -w / 2 + s * 1.55, -h + s * 0.82);
  if (small) { g.font = `600 ${Math.round(s * 0.55)}px ${JP}`; g.fillStyle = "#777"; g.fillText(small, -w / 2 + s * 0.35, -h + s * 1.85); }
  g.restore();
}

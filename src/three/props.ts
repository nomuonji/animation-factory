import * as THREE from "three";
import { canvasTexture, flat, JP_FONT, mesh, rand, toon } from "./toon";

/**
 * Reusable 3D props. Each builder returns a Prop whose pivot sits on the
 * bottom-centre, so `y` in a production means "resting surface height".
 * Params (e.g. signature progress) are numbers so they can be tweened.
 */
export interface Prop {
  object: THREE.Object3D;
  setParam?(key: string, value: number): void;
  animate?(t: number): void;
}

export type PropBuilder = (params: Record<string, unknown>) => Prop;

const str = (v: unknown, d: string) => (typeof v === "string" ? v : d);
const num = (v: unknown, d: number) => (typeof v === "number" ? v : d);

function wrapText(g: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number) {
  let line = "";
  for (const ch of text) {
    if (g.measureText(line + ch).width > maxW) { g.fillText(line, x, y); line = ch; y += lh; }
    else line += ch;
  }
  if (line) g.fillText(line, x, y);
  return y + lh;
}

/** Document page texture: readable title, numbered clauses, signature + seal boxes. */
function drawDocument(g: CanvasRenderingContext2D, w: number, h: number, p: Record<string, unknown>, sig: number, stamp: number) {
  g.fillStyle = "#fbfaf6"; g.fillRect(0, 0, w, h);
  g.fillStyle = "#1b1b1f"; g.textAlign = "center"; g.textBaseline = "top";
  const title = str(p.title, "重要事項説明書");
  g.font = `bold ${Math.round(w * 0.072)}px ${JP_FONT}`;
  let tl = h * 0.05;
  for (const part of title.split("\n")) tl = wrapText(g, part, w / 2, tl, w * 0.86, w * 0.085);
  g.fillRect(w * 0.08, tl + h * 0.005, w * 0.84, 3);
  g.textAlign = "left";
  const clauses = Array.isArray(p.clauses) ? (p.clauses as string[]) : [];
  let y = tl + h * 0.03;
  g.font = `bold ${Math.round(w * 0.04)}px ${JP_FONT}`;
  for (let i = 0; i < clauses.length; i++) {
    g.fillStyle = "#1b1b1f";
    y = wrapText(g, clauses[i]!, w * 0.08, y, w * 0.84, w * 0.05);
    g.fillStyle = "#b9b6ae";
    for (let k = 0; k < 2; k++) { g.fillRect(w * 0.1, y + 4, w * (0.62 + rand(i * 7 + k) * 0.18), w * 0.012); y += w * 0.03; }
    y += w * 0.015;
  }
  if (!p.noFill) {
    g.fillStyle = "#c9c6be";
    while (y < h * 0.72) { g.fillRect(w * 0.08, y, w * (0.55 + rand(y) * 0.3), w * 0.012); y += w * 0.03; }
  }
  if (p.signature) {
    const by = h * 0.8;
    g.fillStyle = "#1b1b1f"; g.font = `bold ${Math.round(w * 0.04)}px ${JP_FONT}`;
    g.fillText("ご署名", w * 0.08, by - w * 0.055);
    g.strokeStyle = "#1b1b1f"; g.lineWidth = 3; g.strokeRect(w * 0.08, by, w * 0.55, h * 0.1);
    g.fillText("受付印", w * 0.7, by - w * 0.055);
    g.strokeRect(w * 0.7, by, w * 0.22, h * 0.1);
    if (sig > 0) {
      g.save(); g.beginPath(); g.rect(w * 0.08, by, w * 0.55 * sig, h * 0.1); g.clip();
      g.strokeStyle = "#1c2a6b"; g.lineWidth = w * 0.009; g.lineCap = "round"; g.beginPath();
      for (let i = 0; i <= 80; i++) {
        const u = i / 80; const x = w * (0.11 + u * 0.48);
        const yy = by + h * 0.05 + Math.sin(u * 23) * h * 0.022 + Math.sin(u * 7.3) * h * 0.012;
        i ? g.lineTo(x, yy) : g.moveTo(x, yy);
      }
      g.stroke(); g.restore();
    }
    if (stamp > 0) {
      g.save(); g.globalAlpha = Math.min(1, stamp) * 0.88; g.strokeStyle = "#cf2a2a"; g.fillStyle = "#cf2a2a";
      const cx = w * 0.81, cy = by + h * 0.05, r = w * 0.075;
      g.lineWidth = w * 0.01; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
      g.font = `bold ${Math.round(r * 0.75)}px ${JP_FONT}`; g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText("受付", cx, cy + 2); g.restore();
    }
  }
  if (p.footer) {
    g.fillStyle = "#6b6860"; g.font = `${Math.round(w * 0.032)}px ${JP_FONT}`; g.textAlign = "right";
    g.fillText(str(p.footer, ""), w * 0.92, h * 0.94);
  }
}


/**
 * Real-estate flyer (物件チラシ / 間取り図): header band with layout and rent, a drawn floor plan,
 * and feature tags at the bottom. Shared by the `floor-plan` prop and the `real-estate-office` set wall.
 */
export function drawFloorPlan(g: CanvasRenderingContext2D, w: number, h: number, p: Record<string, unknown>) {
  const seed = num(p.seed, 1);
  const accent = str(p.accent, "#2f7d4f");
  g.fillStyle = "#fdfdfb"; g.fillRect(0, 0, w, h);
  // header band
  g.fillStyle = accent; g.fillRect(0, 0, w, h * 0.13);
  g.fillStyle = "#ffffff"; g.textBaseline = "middle"; g.textAlign = "left";
  g.font = `bold ${Math.round(h * 0.075)}px ${JP_FONT}`; g.fillText(str(p.layout, "1K"), w * 0.06, h * 0.068);
  g.textAlign = "right"; g.font = `bold ${Math.round(h * 0.07)}px ${JP_FONT}`;
  g.fillText(str(p.rent, "5.8万円"), w * 0.95, h * 0.068);
  // floor plan
  const px = w * 0.1, py = h * 0.19, pw = w * 0.8, ph = h * 0.5;
  g.strokeStyle = "#2a2a2e"; g.lineWidth = Math.max(3, w * 0.012);
  g.fillStyle = "#f4efe3"; g.fillRect(px, py, pw, ph); g.strokeRect(px, py, pw, ph);
  const split = 0.38 + rand(seed) * 0.12;          // room vs. kitchen depth
  const side = 0.42 + rand(seed + 1) * 0.12;       // bath/toilet width
  g.fillStyle = "#e6ddc8"; g.fillRect(px, py + ph * split, pw, ph * (1 - split));
  g.beginPath(); g.moveTo(px, py + ph * split); g.lineTo(px + pw, py + ph * split); g.stroke();
  g.beginPath(); g.moveTo(px + pw * side, py + ph * split); g.lineTo(px + pw * side, py + ph); g.stroke();
  g.beginPath(); g.moveTo(px, py + ph * (split + (1 - split) / 2)); g.lineTo(px + pw * side, py + ph * (split + (1 - split) / 2)); g.stroke();
  g.lineWidth = Math.max(2, w * 0.006);
  // window marks on the top wall
  g.strokeStyle = "#5aa0d0"; g.beginPath(); g.moveTo(px + pw * 0.2, py); g.lineTo(px + pw * 0.8, py); g.stroke();
  g.fillStyle = "#2a2a2e"; g.textAlign = "center";
  g.font = `bold ${Math.round(h * 0.038)}px ${JP_FONT}`;
  g.fillText(str(p.room, "洋室 6帖"), px + pw / 2, py + ph * split / 2);
  g.font = `${Math.round(h * 0.03)}px ${JP_FONT}`;
  g.fillText("バス", px + pw * side / 2, py + ph * (split + (1 - split) / 4));
  g.fillText("トイレ", px + pw * side / 2, py + ph * (split + (1 - split) * 0.75));
  g.fillText("キッチン", px + pw * (side + (1 - side) / 2), py + ph * (split + (1 - split) / 2));
  // compass (N up)
  g.font = `bold ${Math.round(h * 0.03)}px ${JP_FONT}`; g.fillText("N", w * 0.9, py - h * 0.025);
  g.beginPath(); g.moveTo(w * 0.9, py - h * 0.012); g.lineTo(w * 0.88, py + h * 0.02); g.lineTo(w * 0.92, py + h * 0.02); g.closePath(); g.fill();
  // feature tags
  const tags = Array.isArray(p.tags) ? (p.tags as string[]) : [];
  let ty = h * 0.74;
  g.textAlign = "left"; g.textBaseline = "middle";
  const fs = Math.round(h * (tags.length > 2 ? 0.05 : 0.058));
  g.font = `bold ${fs}px ${JP_FONT}`;
  for (const t of tags) {
    const tw = g.measureText(t).width + fs;
    g.fillStyle = str(p.tagColor, "#e8542f"); g.fillRect(w * 0.08, ty - fs * 0.62, tw, fs * 1.24);
    g.fillStyle = "#ffffff"; g.fillText(t, w * 0.08 + fs * 0.5, ty + 1);
    ty += fs * 1.45;
  }
  if (!tags.length) {
    g.fillStyle = "#c9c6be";
    for (let i = 0; i < 3; i++) g.fillRect(w * 0.08, h * (0.76 + i * 0.05), w * (0.5 + rand(seed + i) * 0.3), h * 0.014);
  }
}

function paperSheet(p: Record<string, unknown>): Prop {
  const w = num(p.w, 0.21), d = num(p.d, 0.297);
  const tw = 512, th = Math.round(512 * d / w);
  const canvas = document.createElement("canvas");
  canvas.width = tw; canvas.height = th;
  const g = canvas.getContext("2d")!;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  let sig = -1, stamp = -1;
  const redraw = (s: number, st: number) => {
    const qs = Math.round(s * 40) / 40, qst = Math.round(st * 10) / 10;
    if (qs === sig && qst === stamp) return;
    sig = qs; stamp = qst; drawDocument(g, tw, th, p, qs, qst); tex.needsUpdate = true;
  };
  redraw(0, 0);
  const group = new THREE.Group();
  const sheet = new THREE.Mesh(new THREE.BoxGeometry(w, 0.0015, d), [
    flat("#efede6"), flat("#efede6"), new THREE.MeshToonMaterial({ map: tex, gradientMap: (toon("#fff") as THREE.MeshToonMaterial).gradientMap }), flat("#efede6"), flat("#efede6"), flat("#efede6")
  ]);
  sheet.position.y = 0.00075;
  sheet.receiveShadow = true; sheet.castShadow = true;
  group.add(sheet);
  return { object: group, setParam(k, v) { if (k === "sig") redraw(v, stamp); if (k === "stamp") redraw(sig, v); } };
}

export const PROPS: Record<string, PropBuilder> = {
  onigiri(p) {
    const s = num(p.size, 1);
    const shape = new THREE.Shape();
    const r = 0.018, a = 0.055;
    const pts = [[0, a * 1.15], [-a, -a * 0.6], [a, -a * 0.6]] as const;
    shape.moveTo(pts[0][0], pts[0][1] - r);
    shape.quadraticCurveTo(pts[0][0], pts[0][1], pts[0][0] - r * 0.7, pts[0][1] - r * 0.9);
    shape.lineTo(pts[1][0] + r * 0.6, pts[1][1] + r * 0.9);
    shape.quadraticCurveTo(pts[1][0], pts[1][1], pts[1][0] + r, pts[1][1]);
    shape.lineTo(pts[2][0] - r, pts[2][1]);
    shape.quadraticCurveTo(pts[2][0], pts[2][1], pts[2][0] - r * 0.6, pts[2][1] + r * 0.9);
    shape.lineTo(pts[0][0] + r * 0.7, pts[0][1] - r * 0.9);
    shape.quadraticCurveTo(pts[0][0], pts[0][1], pts[0][0], pts[0][1] - r);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.032, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 3 });
    geo.translate(0, a * 0.6, -0.016);
    const g = new THREE.Group();
    const rice = mesh(geo, toon("#fbfaf4"), 0.003);
    g.add(rice);
    const nori = mesh(new THREE.BoxGeometry(0.05, 0.05, 0.05), toon("#1f2b22"), 0.002);
    nori.scale.set(1, 1, 1.02);
    nori.position.set(0, 0.026, 0);
    g.add(nori);
    const label = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.018), new THREE.MeshBasicMaterial({ map: canvasTexture(128, 80, (c, w, h) => {
      c.fillStyle = "#d9433a"; c.fillRect(0, 0, w, h); c.fillStyle = "#fff"; c.font = `bold 54px ${JP_FONT}`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(str(p.label, "梅"), w / 2, h / 2 + 3);
    }) }));
    label.position.set(0, 0.08, 0.0255);
    g.add(label);
    const film = new THREE.Mesh(geo, new THREE.MeshPhongMaterial({ color: 0xffffff, transparent: true, opacity: 0.18, shininess: 120, specular: 0xffffff }));
    film.scale.set(1.06, 1.04, 1.25);
    g.add(film);
    g.scale.setScalar(s);
    return { object: g };
  },

  "paper-stack"(p) {
    const w = num(p.w, 0.21), d = num(p.d, 0.297), hgt = num(p.height, 0.06);
    const g = new THREE.Group();
    const edge = canvasTexture(64, 256, (c, cw, ch) => {
      c.fillStyle = "#f3f1ea"; c.fillRect(0, 0, cw, ch);
      for (let y = 0; y < ch; y += 3) { c.fillStyle = rand(y) > 0.5 ? "#dcd8cd" : "#e8e5dc"; c.fillRect(0, y, cw, 1); }
    });
    edge.wrapS = edge.wrapT = THREE.RepeatWrapping;
    const edgeMat = new THREE.MeshToonMaterial({ map: edge, gradientMap: (toon("#fff") as THREE.MeshToonMaterial).gradientMap });
    const body = mesh(new THREE.BoxGeometry(w, hgt, d), [edgeMat, edgeMat, flat("#f3f1ea"), flat("#f3f1ea"), edgeMat, edgeMat] as unknown as THREE.Material, 0.003);
    body.position.y = hgt / 2;
    g.add(body);
    const top = paperSheet(p);
    top.object.position.y = hgt;
    g.add(top.object);
    return { object: g, setParam: top.setParam };
  },

  /** Real-estate flyer with a floor plan (A4, lies flat). params: layout, rent, room, tags[], seed, accent, tagColor. */
  "floor-plan"(p) {
    const w = num(p.w, 0.21), d = num(p.d, 0.297);
    const tex = canvasTexture(512, Math.round(512 * d / w), (g, cw, ch) => drawFloorPlan(g, cw, ch, p));
    tex.anisotropy = 8;
    const group = new THREE.Group();
    const sheet = new THREE.Mesh(new THREE.BoxGeometry(w, 0.0015, d), [
      flat("#efede6"), flat("#efede6"), new THREE.MeshToonMaterial({ map: tex, gradientMap: (toon("#fff") as THREE.MeshToonMaterial).gradientMap }), flat("#efede6"), flat("#efede6"), flat("#efede6")
    ]);
    sheet.position.y = 0.00075; sheet.receiveShadow = true; sheet.castShadow = true;
    group.add(sheet);
    return { object: group };
  },

  document(p) { return paperSheet(p); },

  binder(p) {
    const w = num(p.w, 0.26), d = num(p.d, 0.32), hgt = num(p.height, 0.2);
    const color = str(p.color, "#2f4f7a");
    const g = new THREE.Group();
    const cover = toon(color);
    const pages = mesh(new THREE.BoxGeometry(w * 0.94, hgt * 0.9, d * 0.95), toon("#f3f1ea"), 0.003);
    pages.position.set(w * 0.02, hgt / 2, 0);
    g.add(pages);
    for (const y of [0.006, hgt - 0.006]) {
      const c = mesh(new THREE.BoxGeometry(w, 0.012, d), cover, 0.004);
      c.position.y = y;
      g.add(c);
    }
    const spine = mesh(new THREE.BoxGeometry(0.02, hgt, d), cover, 0.004);
    spine.position.set(-w / 2, hgt / 2, 0);
    g.add(spine);
    const labelTex = canvasTexture(256, 640, (c, cw, ch) => {
      c.fillStyle = "#fbfaf6"; c.fillRect(0, 0, cw, ch);
      c.fillStyle = "#1b1b1f"; c.font = `bold 46px ${JP_FONT}`; c.textAlign = "center";
      const t = str(p.label, "重要事項説明書");
      let y = 70; for (const ch2 of t) { c.fillText(ch2, cw / 2, y); y += 52; }
    });
    const lab = new THREE.Mesh(new THREE.PlaneGeometry(hgt * 0.42, d * 0.85), new THREE.MeshBasicMaterial({ map: labelTex }));
    lab.rotation.set(-Math.PI / 2, 0, -Math.PI / 2);
    // top-cover title label (what the camera mostly sees)
    const coverTex = canvasTexture(512, 640, (c, cw, ch) => {
      c.fillStyle = color; c.fillRect(0, 0, cw, ch);
      c.fillStyle = "#fbfaf6"; c.fillRect(40, 90, cw - 80, 300);
      c.fillStyle = "#1b1b1f"; c.font = `bold 52px ${JP_FONT}`; c.textAlign = "center"; c.textBaseline = "top";
      wrapText(c, str(p.title, str(p.label, "")), cw / 2, 120, cw - 120, 64);
      if (p.volume) { c.fillStyle = "#fbfaf6"; c.font = `bold 44px ${JP_FONT}`; c.fillText(str(p.volume, ""), cw / 2, 470); }
    });
    const coverLab = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.96, d * 0.96), new THREE.MeshBasicMaterial({ map: coverTex }));
    coverLab.rotation.x = -Math.PI / 2;
    coverLab.position.y = hgt + 0.0005;
    g.add(coverLab);
    const spineLab = new THREE.Mesh(new THREE.PlaneGeometry(d * 0.85, hgt * 0.6), new THREE.MeshBasicMaterial({ map: canvasTexture(640, 160, (c, cw, ch) => {
      c.fillStyle = "#fbfaf6"; c.fillRect(0, 0, cw, ch); c.fillStyle = "#1b1b1f"; c.font = `bold 64px ${JP_FONT}`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(str(p.label, ""), cw / 2, ch / 2 + 4);
    }) }));
    spineLab.rotation.y = -Math.PI / 2;
    spineLab.position.set(-w / 2 - 0.011, hgt / 2, 0);
    g.add(spineLab);
    void lab;
    return { object: g };
  },

  /** Folded A-frame desk card with text on both faces (reception, "面接会場", price tags). */
  "tent-card"(p) {
    const w = num(p.w, 0.24), h = num(p.h, 0.1);
    const tex = canvasTexture(768, Math.round(768 * h / w), (c, cw, ch) => {
      c.fillStyle = str(p.color, "#fbfaf6"); c.fillRect(0, 0, cw, ch);
      c.strokeStyle = str(p.accent, "#2f4f7a"); c.lineWidth = 10; c.strokeRect(12, 12, cw - 24, ch - 24);
      c.fillStyle = "#1b1b1f"; c.font = `bold ${Math.round(ch * 0.42)}px ${JP_FONT}`; c.textAlign = "center"; c.textBaseline = "middle";
      c.fillText(str(p.text, ""), cw / 2, ch / 2 + 4);
    });
    const g = new THREE.Group();
    const face = new THREE.MeshBasicMaterial({ map: tex });
    for (const side of [1, -1]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), face);
      m.position.set(0, h / 2 * Math.cos(0.32), side * h / 2 * Math.sin(0.32));
      m.rotation.set(-side * 0.32, side > 0 ? 0 : Math.PI, 0);
      g.add(m);
    }
    return { object: g };
  },

  /** Small white plate with bite-size samples on toothpicks. */
  "sample-plate"(p) {
    const n = Math.max(1, Math.min(6, num(p.count, 3)));
    const g = new THREE.Group();
    const plate = mesh(new THREE.CylinderGeometry(0.075, 0.06, 0.012, 24), toon("#fbfbf8"), 0.003);
    plate.position.y = 0.006; g.add(plate);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const bit = mesh(new THREE.SphereGeometry(0.017, 10, 8), toon(str(p.food, "#c9852f"), { emissive: "#2a1400" }), 0.002);
      bit.scale.set(1.25, 0.8, 1);
      bit.position.set(Math.cos(a) * 0.035, 0.024, Math.sin(a) * 0.035);
      g.add(bit);
      const pick = mesh(new THREE.CylinderGeometry(0.0016, 0.0016, 0.05, 5), toon("#e7d3a3"), false);
      pick.position.set(Math.cos(a) * 0.035, 0.05, Math.sin(a) * 0.035);
      pick.rotation.z = 0.15;
      g.add(pick);
    }
    return { object: g };
  },

  pen(p) {
    const g = new THREE.Group();
    const body = mesh(new THREE.CylinderGeometry(0.0055, 0.0055, 0.14, 10), toon(str(p.color, "#2b3f8f")), 0.002);
    body.rotation.z = Math.PI / 2;
    body.position.y = 0.006;
    g.add(body);
    const tip = mesh(new THREE.ConeGeometry(0.0055, 0.02, 10), toon("#d9d6cf"), 0.002);
    tip.rotation.z = -Math.PI / 2;
    tip.position.set(0.08, 0.006, 0);
    g.add(tip);
    return { object: g };
  },

  hanko() {
    const g = new THREE.Group();
    const body = mesh(new THREE.CylinderGeometry(0.011, 0.012, 0.06, 16), toon("#e7dcc4"), 0.002);
    body.position.y = 0.03;
    g.add(body);
    const face = new THREE.Mesh(new THREE.CylinderGeometry(0.0121, 0.0121, 0.002, 16), flat("#cf2a2a"));
    face.position.y = 0.001;
    g.add(face);
    return { object: g };
  },

  /** Camera on a tripod (photo studio). Pivot on the floor; lens faces +z, tilt with params.tilt (rad, + = down). */
  "photo-camera"(p) {
    const h = num(p.height, 1.0), tilt = num(p.tilt, 0);
    const g = new THREE.Group();
    const metal = toon("#2a2b30");
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + Math.PI / 6;
      const leg = mesh(new THREE.CylinderGeometry(0.009, 0.012, h * 1.02, 6), metal, 0.003);
      leg.position.set(Math.sin(a) * h * 0.14, h * 0.48, Math.cos(a) * h * 0.14);
      leg.rotation.set(Math.cos(a) * -0.3, 0, Math.sin(a) * 0.3);
      g.add(leg);
    }
    const col = mesh(new THREE.CylinderGeometry(0.014, 0.014, h * 0.2, 8), metal, 0.003); col.position.y = h * 0.92; g.add(col);
    const head = new THREE.Group(); head.position.y = h + 0.02; head.rotation.x = tilt; g.add(head);
    const body = mesh(new THREE.BoxGeometry(0.15, 0.1, 0.08), toon("#1b1c20"), 0.004); body.position.y = 0.05; head.add(body);
    const grip = mesh(new THREE.BoxGeometry(0.035, 0.085, 0.09), toon("#141417"), 0.003); grip.position.set(-0.06, 0.045, 0.01); head.add(grip);
    const prism = mesh(new THREE.BoxGeometry(0.06, 0.04, 0.06), toon("#1b1c20"), 0.003); prism.position.set(0, 0.115, 0); head.add(prism);
    const lens = mesh(new THREE.CylinderGeometry(0.034, 0.036, 0.1, 18), toon("#202126"), 0.003); lens.rotation.x = Math.PI / 2; lens.position.set(0, 0.05, 0.09); head.add(lens);
    const glass = new THREE.Mesh(new THREE.CircleGeometry(0.026, 18), new THREE.MeshPhongMaterial({ color: 0x1a2a3a, shininess: 120, specular: 0x8899aa })); glass.position.set(0, 0.05, 0.141); head.add(glass);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.065), flat("#24303a")); screen.rotation.y = Math.PI; screen.position.set(0.005, 0.05, -0.041); head.add(screen);
    return { object: g };
  },

  /** Studio strobe: stand + square softbox. params.flash (0..1) lights the front panel and a point light (the flash). */
  strobe(p) {
    const h = num(p.height, 1.7);
    const g = new THREE.Group();
    const metal = toon("#2a2b30");
    const pole = mesh(new THREE.CylinderGeometry(0.014, 0.014, h, 8), metal, 0.003); pole.position.y = h / 2; g.add(pole);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const leg = mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.45, 6), metal, 0.003);
      leg.position.set(Math.sin(a) * 0.16, 0.12, Math.cos(a) * 0.16); leg.rotation.set(Math.cos(a) * 1.05, 0, -Math.sin(a) * 1.05); g.add(leg);
    }
    const s = num(p.size, 0.55);
    const box = new THREE.Group(); box.position.y = h; box.rotation.x = num(p.tilt, 0.15); g.add(box);
    const shellMat = toon("#1d1e22").clone(); shellMat.side = THREE.DoubleSide;
    const shell = mesh(new THREE.CylinderGeometry(s * 0.72, s * 0.18, s * 0.45, 4, 1, true), shellMat, 0.004);
    shell.rotation.set(Math.PI / 2, Math.PI / 4, 0); shell.position.z = -s * 0.22; box.add(shell);
    const panelMat = new THREE.MeshBasicMaterial({ color: new THREE.Color("#d9d6cf") });
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(s, s), panelMat); panel.position.z = 0.002; box.add(panel);
    const light = new THREE.PointLight(0xffffff, 0, 6, 1.2); light.position.z = 0.25; box.add(light);
    const base = new THREE.Color("#d9d6cf"), hot = new THREE.Color("#ffffff");
    const power = num(p.power, 9);
    return {
      object: g,
      setParam(k, v) {
        if (k !== "flash") return;
        const f = Math.max(0, Math.min(1, v));
        panelMat.color.copy(base).lerp(hot, f);
        light.intensity = f * power;
      }
    };
  },

  /** Restaurant water glass (お冷). params.water 0..1 fill; params.straw (0/1, tweenable via `param`) shows a straw. */
  "water-glass"(p) {
    const h = num(p.height, 0.12), r = num(p.radius, 0.036);
    const g = new THREE.Group();
    const glassM = toon("#dfeff6", { transparent: true, opacity: 0.45 });
    const glass = mesh(new THREE.CylinderGeometry(r, r * 0.85, h, 20, 1, true), glassM, 0.002);
    (glass.material as THREE.Material).side = THREE.DoubleSide;
    glass.position.y = h / 2; g.add(glass);
    const bottom = mesh(new THREE.CylinderGeometry(r * 0.85, r * 0.85, 0.008, 20), glassM, false); bottom.position.y = 0.004; g.add(bottom);
    const wh = h * num(p.water, 0.75);
    const water = mesh(new THREE.CylinderGeometry(r * 0.92, r * 0.84, wh, 20), toon("#bfe3f2", { transparent: true, opacity: 0.6 }), false);
    water.position.y = wh / 2 + 0.006; g.add(water);
    for (let i = 0; i < 2; i++) { const ice = mesh(new THREE.BoxGeometry(r * 0.7, r * 0.6, r * 0.7), toon("#f4fbfe", { transparent: true, opacity: 0.8 }), false); ice.position.set((i - 0.5) * r * 0.6, wh - r * 0.1, (i - 0.5) * r * 0.3); ice.rotation.set(0.3 * i, 0.6, 0.2); g.add(ice); }
    const straw = new THREE.Group();
    const sm = mesh(new THREE.CylinderGeometry(0.004, 0.004, h * 1.45, 8), toon(str(p.strawColor, "#e85a5a")), 0.0015);
    sm.position.set(r * 0.35, h * 0.72, 0); sm.rotation.z = -0.18; straw.add(sm);
    straw.visible = num(p.straw, 0) > 0.5; g.add(straw);
    return { object: g, setParam(k, v) { if (k === "straw") straw.visible = v > 0.5; } };
  },

  /** Hamburg steak plate (ハンバーグ): white plate, glazed patty, fries, corn, broccoli. params.size = plate diameter (m); params.empty = true for a bare side plate (取り皿). */
  "hamburg-plate"(p) {
    const d = num(p.size, 0.26), s = d / 0.26;
    const g = new THREE.Group();
    const plate = mesh(new THREE.CylinderGeometry(d / 2, d / 2 * 0.8, 0.016, 32), toon(str(p.plate, "#fbfbf8")), 0.003);
    plate.position.y = 0.008; g.add(plate);
    if (p.empty === true) return { object: g };
    const patty = mesh(new THREE.SphereGeometry(0.055 * s, 20, 12), toon("#6b3418", { emissive: "#1c0800" }), 0.003);
    patty.scale.set(1.3, 0.45, 1); patty.position.set(-0.02 * s, 0.03 * s, 0.01 * s); g.add(patty);
    const sauce = mesh(new THREE.SphereGeometry(0.05 * s, 20, 10), toon("#4a1d0c"), false);
    sauce.scale.set(1.25, 0.2, 0.95); sauce.position.set(-0.02 * s, 0.05 * s, 0.01 * s); g.add(sauce);
    for (let i = 0; i < 5; i++) { const f = mesh(new THREE.BoxGeometry(0.06 * s, 0.012 * s, 0.012 * s), toon("#e8b94a"), 0.0015); f.position.set(0.065 * s, 0.022 * s + i * 0.004, -0.045 * s + i * 0.018 * s); f.rotation.y = 0.4 + rand(i) * 0.5; g.add(f); }
    const corn = mesh(new THREE.CylinderGeometry(0.022 * s, 0.022 * s, 0.012 * s, 14), toon("#f2d43a"), 0.0015); corn.position.set(0.06 * s, 0.022 * s, 0.05 * s); g.add(corn);
    const broc = mesh(new THREE.SphereGeometry(0.018 * s, 10, 8), toon("#3f8a3a"), 0.0015); broc.position.set(-0.075 * s, 0.03 * s, 0.065 * s); g.add(broc);
    return { object: g };
  },

  /** Ramen bowl (ラーメン): bowl, broth, noodles, narutomaki, chashu, egg, nori, negi. params.negi = amount of green onion 0..1. Pivot at the bottom. */
  "ramen-bowl"(p) {
    const g = new THREE.Group();
    const bowlM = toon(str(p.bowl, "#f4f0e6"));
    const bowl = mesh(new THREE.CylinderGeometry(0.095, 0.05, 0.085, 28, 1, true), bowlM, 0.003);
    (bowl.material as THREE.Material).side = THREE.DoubleSide; bowl.position.y = 0.0425; g.add(bowl);
    const foot = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.012, 20), bowlM, 0.002); foot.position.y = 0.006; g.add(foot);
    const rim = mesh(new THREE.TorusGeometry(0.095, 0.004, 6, 28), toon("#c0392b"), false); rim.rotation.x = Math.PI / 2; rim.position.y = 0.083; g.add(rim);
    const broth = mesh(new THREE.CylinderGeometry(0.088, 0.088, 0.004, 28), toon("#b8793a"), false); broth.position.y = 0.07; g.add(broth);
    const noodle = mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.014, 24), toon("#f0d27a"), 0.002); noodle.position.y = 0.076; g.add(noodle);
    for (let i = 0; i < 5; i++) { const w = mesh(new THREE.TorusGeometry(0.03 + i * 0.008, 0.003, 4, 20), toon("#e6c05e"), false); w.rotation.x = Math.PI / 2; w.position.y = 0.085; g.add(w); }
    const nori = mesh(new THREE.BoxGeometry(0.05, 0.05, 0.004), toon("#1c2a22"), 0.002); nori.position.set(-0.068, 0.1, 0.0); nori.rotation.set(0, 0.2, 0.25); g.add(nori);
    const egg = mesh(new THREE.SphereGeometry(0.026, 14, 10), toon("#f7f1dd"), 0.002); egg.scale.set(1, 0.55, 1); egg.position.set(0.04, 0.09, 0.03); g.add(egg);
    const yolk = mesh(new THREE.SphereGeometry(0.012, 10, 8), toon("#f2a93b"), false); yolk.scale.set(1, 0.6, 1); yolk.position.set(0.04, 0.098, 0.03); g.add(yolk);
    const chashu = mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.008, 18), toon("#c68a63"), 0.002); chashu.position.set(0.015, 0.088, -0.04); chashu.rotation.x = 0.15; g.add(chashu);
    const naruto = mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.006, 16), toon("#f7efe8"), 0.002); naruto.position.set(-0.03, 0.092, 0.045); naruto.rotation.x = 0.4; g.add(naruto);
    const swirl = mesh(new THREE.TorusGeometry(0.008, 0.0016, 4, 12), toon("#e66d86"), false); swirl.position.set(-0.03, 0.0955, 0.0475); swirl.rotation.x = 0.4 + Math.PI / 2; g.add(swirl);
    const n = num(p.negi, 0.6);
    for (let i = 0; i < Math.round(14 * n); i++) { const o = mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.003, 6), toon("#5cae47"), false); o.position.set(0.03 + (rand(i + 5) - 0.5) * 0.06, 0.094, -0.01 + (rand(i + 9) - 0.5) * 0.05); g.add(o); }
    return { object: g };
  },

  /** Plate of pan-fried dumplings (餃子). params.count (default 5). Pivot at the plate bottom. */
  "gyoza-plate"(p) {
    const g = new THREE.Group();
    const plate = mesh(new THREE.CylinderGeometry(0.085, 0.07, 0.014, 26), toon("#f6f3ec"), 0.003); plate.position.y = 0.007; g.add(plate);
    const n = Math.round(num(p.count, 5));
    for (let i = 0; i < n; i++) {
      const body = mesh(new THREE.SphereGeometry(0.026, 12, 8), toon("#f2dca4"), 0.002); body.scale.set(1.45, 0.62, 0.75);
      body.position.set(-0.04 + i * 0.02, 0.026 + i * 0.001, (i % 2 ? 0.014 : -0.014)); body.rotation.y = 0.12; g.add(body);
      const crisp = mesh(new THREE.BoxGeometry(0.06, 0.002, 0.014), toon("#b9742f"), false); crisp.position.set(-0.04 + i * 0.02, 0.0165, (i % 2 ? 0.014 : -0.014) + 0.012); g.add(crisp);
    }
    return { object: g };
  },

  /** Beer mug (生ビール): thick glass mug with foam head and handle. Pivot at the bottom. */
  "beer-mug"(p) {
    const g = new THREE.Group();
    const h = num(p.height, 0.13), r = num(p.radius, 0.036);
    const glassM = toon("#e8f2f6", { transparent: true, opacity: 0.5 });
    const glass = mesh(new THREE.CylinderGeometry(r, r * 0.92, h, 20, 1, true), glassM, 0.002);
    (glass.material as THREE.Material).side = THREE.DoubleSide; glass.position.y = h / 2; g.add(glass);
    const base = mesh(new THREE.CylinderGeometry(r * 0.92, r * 0.92, 0.014, 20), glassM, false); base.position.y = 0.007; g.add(base);
    const beer = mesh(new THREE.CylinderGeometry(r * 0.94, r * 0.86, h * 0.72, 20), toon("#e3a62c", { emissive: "#3a2400" }), false); beer.position.y = 0.01 + h * 0.36; g.add(beer);
    const foam = mesh(new THREE.CylinderGeometry(r * 0.98, r * 0.96, h * 0.2, 20), toon("#fffaf0"), 0.002); foam.position.y = h * 0.85; g.add(foam);
    const handle = mesh(new THREE.TorusGeometry(h * 0.26, 0.007, 6, 18, Math.PI), toon("#dbe9ee"), 0.002); handle.rotation.z = -Math.PI / 2; handle.position.set(r * 0.98, h * 0.5, 0); g.add(handle);
    return { object: g };
  },

  /** Basket of small giveaway toys (ファミレスのレジのおもちゃ). Pivot at the basket bottom. */
  "toy-basket"(p) {
    const g = new THREE.Group();
    const w = num(p.width, 0.26), dpt = num(p.depth, 0.18), h = 0.07;
    const wick = toon("#c79a5c");
    const bot = mesh(new THREE.BoxGeometry(w, 0.012, dpt), wick, 0.002); bot.position.y = 0.006; g.add(bot);
    for (const [sx, sz, x, z] of [[w, 0.012, 0, dpt / 2], [w, 0.012, 0, -dpt / 2], [0.012, dpt, w / 2, 0], [0.012, dpt, -w / 2, 0]] as const) {
      const side = mesh(new THREE.BoxGeometry(sx, h, sz), wick, 0.002); side.position.set(x, h / 2, z); g.add(side);
    }
    const colors = ["#e74c3c", "#3498db", "#f1c40f", "#2ecc71", "#9b59b6", "#ff8fb1", "#1abc9c"];
    for (let i = 0; i < 9; i++) {
      const c = colors[i % colors.length]!;
      const x = (rand(i + 3) - 0.5) * (w - 0.05), z = (rand(i + 7) - 0.5) * (dpt - 0.05);
      const k = i % 3;
      const geo = k === 0 ? new THREE.SphereGeometry(0.022, 12, 10) : k === 1 ? new THREE.BoxGeometry(0.045, 0.025, 0.03) : new THREE.CylinderGeometry(0.016, 0.016, 0.05, 10);
      const toy = mesh(geo, toon(c), 0.0015); toy.position.set(x, 0.045 + rand(i + 11) * 0.02, z); toy.rotation.set(rand(i) * 2, rand(i + 1) * 3, rand(i + 2) * 2); g.add(toy);
    }
    if (p.label !== false) {
      const tex = canvasTexture(256, 72, (gc, cw, ch) => {
        gc.fillStyle = "#fffaf0"; gc.fillRect(0, 0, cw, ch);
        gc.fillStyle = "#c0392b"; gc.font = `bold 40px ${JP_FONT}`; gc.textAlign = "center"; gc.textBaseline = "middle";
        gc.fillText(str(p.label, "おもちゃ"), cw / 2, ch / 2 + 2);
      });
      const tag = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.6, w * 0.17), new THREE.MeshBasicMaterial({ map: tex }));
      tag.position.set(0, h * 0.55, dpt / 2 + 0.008); g.add(tag);
    }
    return { object: g };
  },

  /** Small toy car (giveaway toy). Faces +x. */
  "toy-car"(p) {
    const g = new THREE.Group();
    const c = str(p.color, "#3498db");
    const body = mesh(new THREE.BoxGeometry(0.07, 0.02, 0.036), toon(c), 0.0015); body.position.y = 0.018; g.add(body);
    const cab = mesh(new THREE.BoxGeometry(0.036, 0.018, 0.032), toon(c), 0.0015); cab.position.set(-0.004, 0.036, 0); g.add(cab);
    const win = mesh(new THREE.BoxGeometry(0.038, 0.012, 0.028), toon("#cfe8f5"), false); win.position.set(-0.004, 0.037, 0); g.add(win);
    for (const x of [-0.022, 0.022]) for (const z of [-0.019, 0.019]) {
      const wh = mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.006, 12), toon("#222"), 0.001); wh.rotation.x = Math.PI / 2; wh.position.set(x, 0.009, z); g.add(wh);
    }
    return { object: g };
  },

  box(p) {
    const s = p.size as number[] | undefined;
    const m = mesh(new THREE.BoxGeometry(s?.[0] ?? 0.1, s?.[1] ?? 0.1, s?.[2] ?? 0.1), toon(str(p.color, "#cccccc")));
    m.position.y = (s?.[1] ?? 0.1) / 2;
    const g = new THREE.Group(); g.add(m);
    return { object: g };
  }
};

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

  box(p) {
    const s = p.size as number[] | undefined;
    const m = mesh(new THREE.BoxGeometry(s?.[0] ?? 0.1, s?.[1] ?? 0.1, s?.[2] ?? 0.1), toon(str(p.color, "#cccccc")));
    m.position.y = (s?.[1] ?? 0.1) / 2;
    const g = new THREE.Group(); g.add(m);
    return { object: g };
  }
};

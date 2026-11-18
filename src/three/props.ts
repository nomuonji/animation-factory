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

  /** 窓口の呼出表示（壁掛け）。param n = 呼び出し番号。params: window（窓口番号）。向きは +Z（ry 0）で客側から読める。 */
  "ticket-display"(p) {
    const w = num(p.w, 0.72), h = num(p.h, 0.3);
    const tex = canvasTexture(512, Math.round(512 * h / w), () => {});
    const g2 = (tex.image as HTMLCanvasElement).getContext("2d")!;
    let cur = -1;
    const draw = (n: number) => {
      if (n === cur) return;
      cur = n;
      const cw = 512, ch = Math.round(512 * h / w);
      g2.fillStyle = "#14171a"; g2.fillRect(0, 0, cw, ch);
      g2.strokeStyle = "#4b535a"; g2.lineWidth = 8; g2.strokeRect(6, 6, cw - 12, ch - 12);
      g2.fillStyle = "#e9ecee"; g2.font = `bold 34px ${JP_FONT}`; g2.textAlign = "left"; g2.textBaseline = "middle";
      g2.fillText("お呼び出し番号", 26, 38);
      g2.textAlign = "right"; g2.fillStyle = "#7ddc8a"; g2.fillText(`${str(p.window, "3")}番窓口`, cw - 26, 38);
      g2.fillStyle = "#ff5a3c"; g2.font = `bold ${Math.round(ch * 0.58)}px ${JP_FONT}`; g2.textAlign = "center";
      g2.fillText(String(Math.round(n)).padStart(3, "0"), cw / 2, ch * 0.64);
      tex.needsUpdate = true;
    };
    draw(num(p.n, 42));
    const g = new THREE.Group();
    const board = mesh(new THREE.BoxGeometry(w, h, 0.05), toon("#23282c"), 0.004); board.position.y = h / 2; g.add(board);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.98, h * 0.96), new THREE.MeshBasicMaterial({ map: tex }));
    face.position.set(0, h / 2, 0.027); g.add(face);
    return { object: g, setParam(k, v) { if (k === "n") draw(v); } };
  },

  /**
   * 届出書（A4）。params: title, sample（記入例: 赤い「記入例」札つきで整った手書き）, hand（"neat" | "messy"）,
   * name / birth / address / prev（記入内容）, stack（>0 で下に紙束の厚み[m]）。
   * param fill 0..1 で記入欄が上から順に埋まる、stamp 0..1 で「受理」の朱印。向きは document と同じ（ry 0 で客側から読める）。
   */
  "todoke-form"(p) {
    const w = num(p.w, 0.21), d = num(p.d, 0.297), stackH = num(p.stack, 0);
    const tw = 512, th = Math.round(512 * d / w);
    const canvas = document.createElement("canvas"); canvas.width = tw; canvas.height = th;
    const g = canvas.getContext("2d")!;
    const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const sample = !!p.sample, messy = str(p.hand, "neat") === "messy";
    const fields: Array<[string, string]> = [
      ["氏名", str(p.name, "山田 太郎")], ["生年月日", str(p.birth, "昭和63年4月1日")],
      ["新しい住所", str(p.address, "○○市△△町1-2-3")], ["前の住所", str(p.prev, "□□市◇◇町4-5-6")]
    ];
    let fillQ = -1, stampQ = -1;
    const redraw = (fill: number, stamp: number) => {
      const fq = Math.round(fill * 40) / 40, sq = Math.round(stamp * 10) / 10;
      if (fq === fillQ && sq === stampQ) return;
      fillQ = fq; stampQ = sq;
      g.fillStyle = "#fbfaf6"; g.fillRect(0, 0, tw, th);
      g.fillStyle = "#1b1b1f"; g.textAlign = "center"; g.textBaseline = "middle";
      g.font = `bold ${Math.round(tw * 0.1)}px ${JP_FONT}`; g.fillText(str(p.title, "転入届"), tw / 2, th * 0.07);
      g.fillRect(tw * 0.08, th * 0.115, tw * 0.84, 4);
      const rowH = th * 0.17;
      fields.forEach(([label, val], i) => {
        const y0 = th * 0.16 + i * rowH;
        g.strokeStyle = "#1b1b1f"; g.lineWidth = 3; g.strokeRect(tw * 0.08, y0, tw * 0.84, rowH * 0.86);
        g.fillStyle = "#e7ece3"; g.fillRect(tw * 0.08 + 1.5, y0 + 1.5, tw * 0.22, rowH * 0.86 - 3);
        g.fillStyle = "#1b1b1f"; g.font = `bold ${Math.round(tw * 0.04)}px ${JP_FONT}`; g.textAlign = "center"; g.fillText(label, tw * 0.19, y0 + rowH * 0.43);
        const prog = Math.max(0, Math.min(1, fq * fields.length - i));
        if (prog <= 0) return;
        const chars = [...val]; const n = Math.ceil(chars.length * prog);
        const fs = Math.round(tw * (i === 0 ? 0.085 : 0.056));
        g.textAlign = "center"; g.textBaseline = "middle";
        let x = tw * 0.34;
        for (let k = 0; k < n; k++) {
          const ch = chars[k]!;
          const r = rand(i * 31 + k * 7 + 3);
          g.save();
          const size = messy ? fs * (0.8 + r * 0.45) : fs;
          g.font = `${messy ? "" : "bold "}${Math.round(size)}px ${JP_FONT}`;
          const adv = size * (/[0-9\-]/.test(ch) ? 0.6 : 1.02);
          g.translate(x + adv / 2, y0 + rowH * 0.43 + (messy ? (rand(k + i * 13) - 0.5) * fs * 0.45 : 0));
          if (messy) g.rotate((rand(i * 17 + k) - 0.5) * 0.7);
          g.fillStyle = messy ? "#2a2a52" : "#1c2a6b";
          g.fillText(ch, 0, 0);
          if (messy && r > 0.72) { g.strokeStyle = "#2a2a52"; g.lineWidth = 3; g.beginPath(); g.moveTo(-size * 0.5, size * 0.2); g.lineTo(size * 0.5, -size * 0.25); g.stroke(); }
          g.restore();
          x += adv;
        }
      });
      if (sample) {
        g.save(); g.translate(tw * 0.78, th * 0.07); g.rotate(0.12);
        g.strokeStyle = "#cf2a2a"; g.fillStyle = "#cf2a2a"; g.lineWidth = 6; g.strokeRect(-tw * 0.15, -th * 0.04, tw * 0.3, th * 0.08);
        g.font = `bold ${Math.round(tw * 0.085)}px ${JP_FONT}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("記入例", 0, 2); g.restore();
      }
      if (stamp > 0) {
        g.save(); g.globalAlpha = Math.min(1, stamp) * 0.9; g.strokeStyle = "#cf2a2a"; g.fillStyle = "#cf2a2a";
        const cx = tw * 0.76, cy = th * 0.88, r = tw * 0.1; g.lineWidth = tw * 0.014; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
        g.font = `bold ${Math.round(r * 0.9)}px ${JP_FONT}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("受理", cx, cy + 3); g.restore();
      }
      tex.needsUpdate = true;
    };
    redraw(sample ? 1 : num(p.fill, 0), 0);
    const sheetMats = [flat("#efede6"), flat("#efede6"), new THREE.MeshToonMaterial({ map: tex, gradientMap: (toon("#fff") as THREE.MeshToonMaterial).gradientMap }), flat("#efede6"), flat("#efede6"), flat("#efede6")];
    const group = new THREE.Group();
    if (stackH > 0) {
      const edge = canvasTexture(64, 256, (c, cw, ch) => {
        c.fillStyle = "#f3f1ea"; c.fillRect(0, 0, cw, ch);
        for (let y = 0; y < ch; y += 3) { c.fillStyle = rand(y) > 0.5 ? "#dcd8cd" : "#e8e5dc"; c.fillRect(0, y, cw, 1); }
      });
      edge.wrapS = edge.wrapT = THREE.RepeatWrapping;
      const em = new THREE.MeshToonMaterial({ map: edge, gradientMap: (toon("#fff") as THREE.MeshToonMaterial).gradientMap });
      const stackBody = mesh(new THREE.BoxGeometry(w, stackH, d), [em, em, flat("#f3f1ea"), flat("#f3f1ea"), em, em] as unknown as THREE.Material, 0.003);
      stackBody.position.y = stackH / 2; group.add(stackBody);
    }
    const sheet = new THREE.Mesh(new THREE.BoxGeometry(w, 0.0015, d), sheetMats);
    sheet.position.y = stackH + 0.00075; sheet.receiveShadow = true; sheet.castShadow = true;
    group.add(sheet);
    return { object: group, setParam(k, v) { if (k === "fill") redraw(v, stampQ < 0 ? 0 : stampQ); if (k === "stamp") redraw(fillQ < 0 ? 0 : fillQ, v); } };
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

  /** Wall room thermometer (室温計): white plate with a big LCD. param v = temperature in °C (tweenable); params.label (default "室温"). */
  /** Analog wall clock (壁時計). Faces +Z, centred on its own origin. param t = time of day in hours (e.g. 20.67 = 20:40); hands redraw per minute. */
  "wall-clock"(p) {
    const r = num(p.r, 0.2);
    const g = new THREE.Group();
    const rim = mesh(new THREE.CylinderGeometry(r, r, 0.04, 36), toon("#5a4636"), 0.004);
    rim.rotation.x = Math.PI / 2; g.add(rim);
    const c = document.createElement("canvas"); c.width = 256; c.height = 256;
    const ctx = c.getContext("2d")!;
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    let shown = -1;
    const draw = (t: number) => {
      const m = Math.round(((t % 12) + 12) % 12 * 60);
      if (m === shown) return;
      shown = m;
      ctx.fillStyle = "#fbf8ee"; ctx.fillRect(0, 0, 256, 256);
      ctx.strokeStyle = "#2a2a2a"; ctx.fillStyle = "#2a2a2a";
      for (let i = 0; i < 12; i++) {
        const a = i * Math.PI / 6;
        ctx.lineWidth = i % 3 === 0 ? 9 : 4;
        ctx.beginPath(); ctx.moveTo(128 + Math.sin(a) * 100, 128 - Math.cos(a) * 100); ctx.lineTo(128 + Math.sin(a) * 118, 128 - Math.cos(a) * 118); ctx.stroke();
      }
      const hourA = (m / 720) * Math.PI * 2, minA = ((m % 60) / 60) * Math.PI * 2;
      ctx.lineCap = "round";
      ctx.lineWidth = 11; ctx.beginPath(); ctx.moveTo(128, 128); ctx.lineTo(128 + Math.sin(hourA) * 62, 128 - Math.cos(hourA) * 62); ctx.stroke();
      ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(128, 128); ctx.lineTo(128 + Math.sin(minA) * 92, 128 - Math.cos(minA) * 92); ctx.stroke();
      ctx.beginPath(); ctx.arc(128, 128, 9, 0, Math.PI * 2); ctx.fill();
      tex.needsUpdate = true;
    };
    draw(num(p.t, 20.67));
    const face = new THREE.Mesh(new THREE.CircleGeometry(r * 0.93, 36), new THREE.MeshBasicMaterial({ map: tex }));
    face.position.z = 0.0215; g.add(face);
    return { object: g, setParam(k, v) { if (k === "t") draw(v); } };
  },

  /** Fruit-milk glass bottle (フルーツ牛乳). Stands on its origin; param empty = 1 hides the milk. */
  "milk-bottle"(p) {
    const g = new THREE.Group();
    const col = str(p.color, "#f3e7c4");
    const body = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.13, 14), new THREE.MeshPhongMaterial({ color: 0xe6f3f7, transparent: true, opacity: 0.6, shininess: 100 }), false);
    body.position.y = 0.065; g.add(body);
    const milk = mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.1, 14), toon(col), false);
    milk.position.y = 0.055; g.add(milk);
    const neck = mesh(new THREE.CylinderGeometry(0.015, 0.03, 0.03, 12), new THREE.MeshPhongMaterial({ color: 0xe6f3f7, transparent: true, opacity: 0.6 }), false);
    neck.position.y = 0.145; g.add(neck);
    const cap = mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.012, 12), toon("#f4efe2"), false);
    cap.position.y = 0.166; g.add(cap);
    const label = new THREE.Mesh(new THREE.CylinderGeometry(0.0305, 0.0305, 0.045, 14, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color("#c9462f"), side: THREE.DoubleSide }));
    label.position.y = 0.06; g.add(label);
    return { object: g, setParam(k, v) { if (k === "empty") milk.visible = v < 0.5; } };
  },

  "wall-thermo"(p) {
    const w = num(p.w, 0.3), h = num(p.h, 0.2);
    const g = new THREE.Group();
    const body = mesh(new THREE.BoxGeometry(w, h, 0.03), toon("#f4f4f0"), 0.004);
    body.position.set(0, 0, 0); g.add(body);
    const c = document.createElement("canvas"); c.width = 512; c.height = Math.round(512 * h / w);
    const ctx = c.getContext("2d")!;
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    let shown = "";
    const draw = (v: number) => {
      const t = v.toFixed(1);
      if (t === shown) return;
      shown = t;
      ctx.fillStyle = "#dfe8dc"; ctx.fillRect(0, 0, c.width, c.height);
      ctx.fillStyle = "#6f7a6c"; ctx.font = `bold ${Math.round(c.height * 0.16)}px ${JP_FONT}`; ctx.textAlign = "left"; ctx.textBaseline = "top";
      ctx.fillText(str(p.label, "室温"), c.width * 0.06, c.height * 0.06);
      ctx.fillStyle = "#1d241c"; ctx.font = `bold ${Math.round(c.height * 0.62)}px ${JP_FONT}`; ctx.textAlign = "right"; ctx.textBaseline = "alphabetic";
      ctx.fillText(t, c.width * 0.8, c.height * 0.88);
      ctx.font = `bold ${Math.round(c.height * 0.24)}px ${JP_FONT}`; ctx.textAlign = "left";
      ctx.fillText("℃", c.width * 0.8, c.height * 0.88);
      tex.needsUpdate = true;
    };
    draw(num(p.v, 22.4));
    const lcd = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.86, h * 0.8), new THREE.MeshBasicMaterial({ map: tex }));
    lcd.position.set(0, 0, 0.0165); g.add(lcd);
    return { object: g, setParam(k, v) { if (k === "v") draw(v); } };
  },

  /** Digital clinical thermometer (電子体温計). Lies along +x, pivot at the tip-centre. param v = reading (°C) shown on the small LCD when param on = 1. */
  "clinical-thermometer"(p) {
    const g = new THREE.Group();
    const len = 0.13;
    const body = mesh(new THREE.CylinderGeometry(0.0075, 0.0075, len, 12), toon("#f2f2ee"), 0.0015);
    body.rotation.z = Math.PI / 2; body.position.x = len / 2; g.add(body);
    const tip = mesh(new THREE.CylinderGeometry(0.004, 0.0075, 0.018, 12), toon("#c9ced4"), 0.0015);
    tip.rotation.z = Math.PI / 2; tip.position.x = -0.006; g.add(tip);
    const c = document.createElement("canvas"); c.width = 128; c.height = 48;
    const ctx = c.getContext("2d")!;
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    let shown = "";
    const draw = (v: number, on: boolean) => {
      const t = on ? v.toFixed(1) : "";
      if (t === shown + "") return; shown = t;
      ctx.fillStyle = "#cfd8c8"; ctx.fillRect(0, 0, 128, 48);
      ctx.fillStyle = "#1d241c"; ctx.font = "bold 36px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(t, 64, 26);
      tex.needsUpdate = true;
    };
    let v = num(p.v, 36.5), on = num(p.on, 0) > 0.5;
    draw(v, on);
    const lcd = new THREE.Mesh(new THREE.PlaneGeometry(0.036, 0.0135), new THREE.MeshBasicMaterial({ map: tex }));
    lcd.position.set(len * 0.55, 0.0078, 0); lcd.rotation.x = -Math.PI / 2; g.add(lcd);
    return { object: g, setParam(k, val) { if (k === "v") v = val; if (k === "on") on = val > 0.5; draw(v, on); } };
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

  "exercise-bench"(p) {
    // flat weight bench, long axis along z (seat top at 0.48 m)
    const g = new THREE.Group();
    const seat = mesh(new THREE.BoxGeometry(0.3, 0.08, 1.15), toon("#2b2e33"), 0.004); seat.position.y = 0.41; g.add(seat);
    const pad = mesh(new THREE.BoxGeometry(0.28, 0.05, 1.1), toon(str(p.color, "#c9382f")), 0.003); pad.position.y = 0.455; g.add(pad);
    for (const lz of [-0.45, 0.45]) { const lg = mesh(new THREE.BoxGeometry(0.36, 0.38, 0.05), toon("#7b8087"), 0.003); lg.position.set(0, 0.19, lz); g.add(lg); }
    return { object: g };
  },

  box(p) {
    const s = p.size as number[] | undefined;
    const m = mesh(new THREE.BoxGeometry(s?.[0] ?? 0.1, s?.[1] ?? 0.1, s?.[2] ?? 0.1), toon(str(p.color, "#cccccc")));
    m.position.y = (s?.[1] ?? 0.1) / 2;
    const g = new THREE.Group(); g.add(m);
    return { object: g };
  },

  /** 焼肉の肉1枚（カルビ）。param done 0..1 で 生(ピンク) → 焼き上がり(茶) → 焦げ(黒)。ピボットは底面中央。params.size で大きさ。 */
  "meat"(p) {
    const g = new THREE.Group();
    const sz = num(p.size, 1);
    const mat = new THREE.MeshToonMaterial({ color: new THREE.Color("#d8566a"), gradientMap: (toon("#fff") as THREE.MeshToonMaterial).gradientMap });
    const slab = mesh(new THREE.BoxGeometry(0.1 * sz, 0.012 * sz, 0.07 * sz), mat, 0.002); slab.position.y = 0.006 * sz; slab.rotation.y = 0.15; g.add(slab);
    const fatM = new THREE.MeshToonMaterial({ color: new THREE.Color("#f6dfe0"), gradientMap: (toon("#fff") as THREE.MeshToonMaterial).gradientMap });
    const fats: THREE.Mesh[] = [];
    for (let i = 0; i < 3; i++) {
      const f = new THREE.Mesh(new THREE.BoxGeometry(0.085 * sz, 0.0006, 0.007 * sz), fatM);
      f.position.set(0, 0.0125 * sz, (-0.02 + i * 0.02) * sz); f.rotation.y = 0.15 + (i - 1) * 0.08; g.add(f); fats.push(f);
    }
    const cols = ["#d8566a", "#b86a50", "#8a4a2a", "#3a2a20", "#161212"].map((c) => new THREE.Color(c));
    const fcols = ["#f6dfe0", "#e8c9a0", "#b8855a", "#4a3a30", "#1c1616"].map((c) => new THREE.Color(c));
    const ramp = (arr: THREE.Color[], t: number) => { const x = Math.min(Math.max(t, 0), 1) * (arr.length - 1); const i = Math.min(Math.floor(x), arr.length - 2); return arr[i]!.clone().lerp(arr[i + 1]!, x - i); };
    const apply = (d: number) => { mat.color.copy(ramp(cols, d)); fatM.color.copy(ramp(fcols, d)); };
    apply(num(p.done, 0));
    return { object: g, setParam(k, v) { if (k === "done") apply(v); } };
  },

  /** 生肉を盛った皿（店員が運ぶ）。ピボットは皿底。 */
  "meat-plate"(p) {
    const g = new THREE.Group();
    const plate = mesh(new THREE.CylinderGeometry(0.15, 0.115, 0.02, 28), toon("#f6f3ec"), 0.003); plate.position.y = 0.01; g.add(plate);
    const n = Math.round(num(p.count, 5));
    for (let i = 0; i < n; i++) {
      const sl = mesh(new THREE.BoxGeometry(0.1, 0.012, 0.07), toon("#d8566a"), 0.002);
      sl.position.set((rand(i + 3) - 0.5) * 0.09, 0.026 + i * 0.011, (rand(i + 8) - 0.5) * 0.07); sl.rotation.y = rand(i + 1) * 1.2;
      g.add(sl);
      const fat = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.0006, 0.007), toon("#f6dfe0")); fat.position.set(sl.position.x, sl.position.y + 0.0068, sl.position.z); fat.rotation.y = sl.rotation.y; g.add(fat);
    }
    return { object: g };
  },

  /** 割り箸ではない塗り箸（2本）。ピボットは持ち手の中点、先端が +Z 側へ向く（params.length 既定 0.22）。 */
  "chopsticks"(p) {
    const g = new THREE.Group();
    const len = num(p.length, 0.22);
    for (const dx of [-0.006, 0.006]) {
      const s = mesh(new THREE.CylinderGeometry(0.0035, 0.0025, len, 6), toon("#2b2b30"), false);
      s.rotation.x = Math.PI / 2; s.position.set(dx, 0, len / 2 - 0.05); g.add(s);
    }
    return { object: g };
  },

  /** 網の上の煙。param amount 0..1 で濃さ。上昇する灰色の玉（t から決定的に動く）。ピボットは網の上。 */
  "grill-smoke"(p) {
    const g = new THREE.Group();
    const puffs: THREE.Mesh[] = [];
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(str(p.color, "#cfcfd4")), transparent: true, opacity: 0 });
    for (let i = 0; i < 9; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), m); puffs.push(s); g.add(s); }
    let amount = num(p.amount, 0);
    const place = (t: number) => {
      puffs.forEach((s, i) => {
        const ph = ((t * 0.35 + i / puffs.length) % 1);
        s.position.set((rand(i + 2) - 0.5) * 0.12 + Math.sin(ph * 6 + i) * 0.03, ph * 0.5, (rand(i + 7) - 0.5) * 0.12);
        const k = 0.5 + ph * 1.6; s.scale.set(k, k, k);
      });
      m.opacity = 0.42 * amount;
    };
    place(0);
    return { object: g, setParam(k, v) { if (k === "amount") { amount = v; m.opacity = 0.42 * amount; } }, animate(t) { place(t); } };
  },

  /**
   * 図書館の本(ハードカバー)。ピボットは底面の中心、表紙が +Y を向いて平置き。
   * params: color(表紙), title(表紙の題字、縦に2行まで), thick(厚み m)。
   */
  "library-book"(p) {
    const g = new THREE.Group();
    const w = 0.15, d = 0.21, t = num(p.thick, 0.035);
    const cover = str(p.color, "#2f4f6b");
    const pages = mesh(new THREE.BoxGeometry(w - 0.01, t - 0.012, d - 0.01), toon("#f3ecd8"), 0.002); pages.position.set(0.004, t / 2, 0); g.add(pages);
    const bot = mesh(new THREE.BoxGeometry(w, 0.006, d), toon(cover), 0.002); bot.position.y = 0.003; g.add(bot);
    const top = mesh(new THREE.BoxGeometry(w, 0.006, d), toon(cover), 0.002); top.position.y = t - 0.003; g.add(top);
    const spine = mesh(new THREE.BoxGeometry(0.008, t, d), toon(cover), 0.002); spine.position.set(-w / 2 + 0.004, t / 2, 0); g.add(spine);
    const title = str(p.title, "");
    if (title) {
      const tex = canvasTexture(150, 210, (c, cw, ch) => {
        c.fillStyle = "rgba(255,255,255,0.0)"; c.clearRect(0, 0, cw, ch);
        c.fillStyle = "#f6efd8"; c.fillRect(14, 30, cw - 28, 96);
        c.fillStyle = "#222"; c.font = `bold 30px ${JP_FONT}`; c.textAlign = "center"; c.textBaseline = "middle";
        title.split("\n").forEach((ln, i, a) => c.fillText(ln, cw / 2, 78 + (i - (a.length - 1) / 2) * 36));
      });
      const lab = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
      lab.rotation.x = -Math.PI / 2; lab.position.y = t + 0.0005; g.add(lab);
    }
    return { object: g };
  },
  /**
   * セルフレジ（無人精算機）。ピボットは床の中央、画面は +Z 向き。高さ約1.12。
   * param alert 0..1 で画面が赤い「係員をお呼びします」表示に変わり、上のランプが点く。
   */
  "self-register"(p) {
    const g = new THREE.Group();
    const body = mesh(new THREE.BoxGeometry(0.46, 0.8, 0.36), toon(str(p.color, "#e9e6df")), 0.004); body.position.y = 0.4; g.add(body);
    const base = mesh(new THREE.BoxGeometry(0.5, 0.06, 0.4), toon("#3a3d44"), 0.004); base.position.y = 0.03; g.add(base);
    const shelf = mesh(new THREE.BoxGeometry(0.44, 0.03, 0.3), toon("#c9ccd1"), 0.004); shelf.position.set(0, 0.82, 0.24); g.add(shelf);
    const head = mesh(new THREE.BoxGeometry(0.46, 0.3, 0.12), toon("#2c2e33"), 0.004); head.position.set(0, 0.97, 0.02); head.rotation.x = -0.28; g.add(head);
    const c = document.createElement("canvas"); c.width = 320; c.height = 200;
    const ctx = c.getContext("2d")!;
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    let shown = -1;
    const draw = (a: number) => {
      const on = a > 0.5 ? 1 : 0;
      if (on === shown) return;
      shown = on;
      ctx.fillStyle = on ? "#b3261e" : "#14324a"; ctx.fillRect(0, 0, 320, 200);
      ctx.fillStyle = "#ffffff"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = `bold ${on ? 46 : 40}px ${JP_FONT}`;
      if (on) { ctx.fillText("係員を", 160, 70); ctx.fillText("お呼びします", 160, 132); }
      else { ctx.fillText("商品を", 160, 70); ctx.fillText("スキャン", 160, 130); }
      tex.needsUpdate = true;
    };
    draw(num(p.alert, 0));
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.25), new THREE.MeshBasicMaterial({ map: tex }));
    scr.position.set(0, 0.97, 0.083); scr.rotation.x = -0.28; g.add(scr);
    const lampMat = new THREE.MeshBasicMaterial({ color: new THREE.Color("#5a1a16") });
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.045, 14, 10), lampMat); lamp.position.set(0, 1.17, 0.0); g.add(lamp);
    const setLamp = (a: number) => lampMat.color.set(a > 0.5 ? "#ff3b2e" : "#5a1a16");
    setLamp(num(p.alert, 0));
    return { object: g, setParam(k, v) { if (k === "alert") { draw(v); setLamp(v); } } };
  }
};

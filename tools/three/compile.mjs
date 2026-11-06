/**
 * Compile productions/<id>/scene3d.json (beat-relative, human-authored) into an
 * absolute timeline the 3D page can evaluate for any frame.
 *
 * Beat timing is driven by the spoken line length (VOICEVOX or estimate), so a
 * production never hard-codes seconds for dialogue.
 */

const VERBS = {
  pose: "pose", move: "root", look: "look", face: "face", prop: "tf", param: "param", wiggle: "wiggle"
};

/**
 * Title presentation. Default: a full-frame title card played by the beat whose role is "title"
 * (a real cut, like a sketch-show title). design.titleOnScreen = "band" keeps a top band for the
 * whole video instead; "none" shows nothing.
 */
function titleCard(prod, duration, beats) {
  const d = prod.design;
  if (!d?.title || d.titleOnScreen === "none") return null;
  const text = d.titleScreenText ?? d.title;
  if (d.titleOnScreen === "band") return { text, start: 0, end: duration + 1, style: "band" };
  const i = prod.beats.findIndex((b) => b.role === "title");
  if (i < 0) return null;
  return { text, start: beats[i].start, end: beats[i].end, style: "card", label: d.titleLabel ?? "ショートコント" };
}

export function splitChunks(text) {
  return text.split("／").map((s) => s.trim()).filter(Boolean);
}

export function plainText(text) {
  return text.replaceAll("／", "");
}

/** Fallback when VOICEVOX is not reachable: ~8 morae per second at speed 1. */
export function estimateVoice(text, speed = 1) {
  const chars = [...plainText(text)].filter((c) => !/[、。！？…・\s「」]/.test(c));
  const per = 0.125 / speed;
  const pre = 0.05;
  const moras = chars.map((_, i) => [pre + i * per, pre + (i + 0.85) * per]);
  const pauses = (plainText(text).match(/[、。！？…]/g) ?? []).length * 0.12;
  return { duration: pre + chars.length * per + pauses + 0.12, moras, estimated: true };
}

function parseAt(at, beat) {
  if (at === undefined || at === null) return beat.start;
  if (typeof at === "number") return beat.start + at;
  const m = /^(line|lineEnd|end|start)\s*([+-]\s*[0-9.]+)?$/.exec(String(at).trim());
  if (!m) throw new Error(`Bad "at" in beat ${beat.id}: ${at}`);
  const off = m[2] ? Number(m[2].replace(/\s/g, "")) : 0;
  const base = { line: beat.lineStart, lineEnd: beat.lineEnd, end: beat.end, start: beat.start }[m[1]];
  if (base === undefined || Number.isNaN(base)) throw new Error(`"at": ${at} needs a line in beat ${beat.id}`);
  return base + off;
}

/**
 * @param {object} prod scene3d.json
 * @param {(line:{who:string,text:string})=>{duration:number,moras:[number,number][]}} voiceFor
 */
export function compile(prod, voiceFor) {
  const fps = prod.meta.fps ?? 30;
  const lines = [], events = [], shots = [], sfx = [], music = [];
  let t = prod.lead ?? 0;
  const beats = [];
  for (const [i, b] of prod.beats.entries()) {
    const id = b.id ?? `b${i + 1}`;
    const start = t;
    let lineStart = NaN, lineEnd = NaN;
    if (b.line) {
      const v = voiceFor(b.line);
      lineStart = start + (b.pre ?? 0.12);
      lineEnd = lineStart + v.duration;
      const parts = splitChunks(b.line.text);
      const total = parts.reduce((n, p) => n + [...p].length, 0) || 1;
      const chunks = [];
      let acc = 0;
      for (const p of parts) {
        const s = lineStart + (acc / total) * v.duration;
        acc += [...p].length;
        chunks.push({ text: p, start: s, end: lineStart + (acc / total) * v.duration });
      }
      lines.push({ id, who: b.line.who, text: plainText(b.line.text), start: lineStart, end: lineEnd, moras: v.moras.map(([a, c]) => [lineStart + a, lineStart + c]), chunks, audio: v.audio ?? null });
    }
    const natural = b.line ? (lineEnd - start) + (b.post ?? 0.22) : (b.role === "title" ? 1.5 : 0);
    const end = start + Math.max(natural, b.dur ?? 0) + (b.hold ?? 0);
    const beat = { id, start, end, lineStart, lineEnd };
    beats.push(beat);
    if (b.shot) shots.push({ start, end, cam: b.shot, push: b.push ?? 0 });
    for (const a of b.do ?? []) {
      const at = parseAt(a.at, beat);
      if (a.sfx) { sfx.push({ t: at, name: a.sfx, gain: a.gain ?? 1 }); continue; }
      if (a.music) { music.push({ t: at, op: a.music, fade: a.fade ?? 0.08 }); continue; }
      if (a.shot) { shots.push({ start: at, end, cam: a.shot, push: a.push ?? 0 }); continue; }
      if (a.show || a.hide) { events.push({ t: at, dur: 0, channel: "vis", target: a.show ?? a.hide, to: { v: a.show ? 1 : 0 } }); continue; }
      const verb = Object.keys(VERBS).find((k) => k in a);
      if (!verb) throw new Error(`Unknown action in beat ${id}: ${JSON.stringify(a)}`);
      let to = a.to;
      if (verb === "pose" && typeof to === "string") to = { pose: to };
      if (verb === "face" && typeof to === "string") to = { expr: to };
      if (verb === "wiggle") to = { w: typeof to === "number" ? to : 1 };
      events.push({ t: at, dur: a.dur ?? (verb === "param" ? 0.5 : 0.35), channel: VERBS[verb], target: a[verb], to, ease: a.ease, arc: a.arc });
    }
    t = end;
  }
  const duration = t + (prod.tail ?? 0);
  shots.sort((a, b) => a.start - b.start);
  for (let i = 0; i < shots.length; i++) shots[i].end = shots[i + 1]?.start ?? duration;
  events.sort((a, b) => a.t - b.t);
  sfx.sort((a, b) => a.t - b.t);
  const frames = Math.ceil(duration * fps);
  let overlay = prod.overlay ?? null;
  const ho = prod.design?.hook?.overlay;
  if (!overlay && ho) {
    // hook text stays only while the hook beats play (it must not cover faces later)
    const until = beats.find((b, i) => prod.beats[i].role && prod.beats[i].role !== "hook")?.start ?? beats[0]?.end ?? 3;
    overlay = { text: ho, start: 0, end: until };
  }
  return {
    timeline: {
      meta: { id: prod.meta.id, title: prod.meta.title, fps, width: prod.meta.width ?? 1080, height: prod.meta.height ?? 1920, duration: frames / fps },
      set: prod.set, cameras: prod.cameras ?? {}, actors: prod.actors, props: prod.props ?? {},
      lines: lines.map(({ audio, ...l }) => l), events, shots, captions: prod.captions ?? {}, overlay,
      titleCard: titleCard(prod, frames / fps, beats)
    },
    audio: { lines: lines.map((l) => ({ t: l.start, end: l.end, audio: l.audio, who: l.who })), sfx, music: { ...(prod.music ?? {}), events: music } },
    beats
  };
}

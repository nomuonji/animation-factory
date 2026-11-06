#!/usr/bin/env node
/**
 * 3D Shorts renderer.
 *
 *   node tools/three/render3d.mjs <production> [--timeline-only] [--stills 0,3.5,10]
 *        [--scale 0.5] [--no-voice] [--frames-from S --frames-to E]
 *
 * Pipeline: voices (VOICEVOX, else estimated timing + no voice) -> compile timeline
 * -> Vite dev server + headless Chromium (WebGL) -> JPEG frames piped to FFmpeg
 * -> audio mix (voices + CC0 SFX + generated room tone) -> MP4 + review pack.
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createServer } from "vite";
import { compile, estimateVoice, plainText } from "./compile.mjs";
import { lintDesign, loadFormats } from "./design-lint.mjs";

const root = fileURLToPath(new URL("../..", import.meta.url));
const argv = process.argv.slice(2);
const id = argv.find((a) => !a.startsWith("--"));
const flag = (n) => argv.includes(`--${n}`);
const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
if (!id || !/^[A-Za-z0-9._-]+$/.test(id)) throw new Error("usage: render3d.mjs <production-folder>");

const prodPath = join(root, "productions", id, "scene3d.json");
const outDir = join(root, "outputs", "three", id);
const voiceDir = join(root, "outputs", "three-voice");
await mkdir(outDir, { recursive: true });
await mkdir(voiceDir, { recursive: true });
const prod = JSON.parse(await readFile(prodPath, "utf8"));
const VV = process.env.VOICEVOX_URL ?? "http://127.0.0.1:50021";

function run(cmd, args, input) {
  return new Promise((res, rej) => {
    const p = spawn(cmd, args, { cwd: root, stdio: [input ? "pipe" : "ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => { err += d; if (err.length > 20000) err = err.slice(-20000); });
    p.on("error", rej);
    p.on("exit", (c) => (c === 0 ? res() : rej(new Error(`${cmd} ${c}\n${err.slice(-3000)}`))));
    if (input) input(p.stdin);
  });
}

// ---------- voices ----------
async function vvAlive() {
  if (flag("no-voice")) return false;
  try { const r = await fetch(`${VV}/version`, { signal: AbortSignal.timeout(3000) }); return r.ok; } catch { return false; }
}
let speakers = null;
async function speakerId(v) {
  speakers ??= await (await fetch(`${VV}/speakers`)).json();
  const s = speakers.find((x) => x.name === v.speaker);
  if (!s) throw new Error(`VOICEVOX speaker not installed: ${v.speaker}`);
  return (s.styles.find((st) => st.name === (v.style ?? "ノーマル")) ?? s.styles[0]).id;
}
function moraTimes(q) {
  const speed = q.speedScale ?? 1;
  let t = q.prePhonemeLength ?? 0.1;
  const out = [];
  for (const ap of q.accent_phrases) {
    for (const m of ap.moras) { const d = (m.consonant_length ?? 0) + m.vowel_length; out.push([t / speed, (t + d) / speed]); t += d; }
    if (ap.pause_mora) t += ap.pause_mora.vowel_length;
  }
  return out;
}
function wavDuration(buf) {
  const rate = buf.readUInt32LE(24), ch = buf.readUInt16LE(22), bits = buf.readUInt16LE(34);
  let off = 12;
  while (off < buf.length - 8) { const tag = buf.toString("ascii", off, off + 4), size = buf.readUInt32LE(off + 4); if (tag === "data") return size / (rate * ch * bits / 8); off += 8 + size; }
  throw new Error("bad wav");
}
async function synth(line) {
  const v = { speaker: "青山龍星", style: "ノーマル", speed: 1.1, ...(prod.voices?.[line.who] ?? {}), ...(line.voice ?? {}) };
  const text = plainText(line.text);
  const key = createHash("sha1").update(JSON.stringify([text, v])).digest("hex").slice(0, 16);
  const wav = join(voiceDir, `${key}.wav`), meta = join(voiceDir, `${key}.json`);
  if (existsSync(wav) && existsSync(meta)) return { ...JSON.parse(await readFile(meta, "utf8")), audio: wav };
  const sid = await speakerId(v);
  const q = await (await fetch(`${VV}/audio_query?text=${encodeURIComponent(text)}&speaker=${sid}`, { method: "POST" })).json();
  q.speedScale = v.speed; q.prePhonemeLength = 0.05; q.postPhonemeLength = 0.12;
  if (v.pitch !== undefined) q.pitchScale = v.pitch;
  if (v.intonation !== undefined) q.intonationScale = v.intonation;
  q.outputSamplingRate = 48000;
  const r = await fetch(`${VV}/synthesis?speaker=${sid}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(q) });
  if (!r.ok) throw new Error(`VOICEVOX synthesis failed: ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  await writeFile(wav, buf);
  const info = { duration: wavDuration(buf), moras: moraTimes(q), speaker: v.speaker };
  await writeFile(meta, JSON.stringify(info));
  return { ...info, audio: wav };
}

const voiced = await vvAlive();
const voices = new Map();
for (const b of prod.beats) if (b.line) {
  const v = voiced ? await synth(b.line) : estimateVoice(b.line.text, prod.voices?.[b.line.who]?.speed ?? 1.1);
  voices.set(b.line, v);
}
const compiled = compile(prod, (l) => voices.get(l));
const { timeline, audio } = compiled;
const lint = lintDesign(prod, compiled, await loadFormats());
await writeFile(join(outDir, "design-report.md"), lint.report);
for (const w of lint.warnings) console.warn("design warning:", w);
if (lint.errors.length) {
  for (const e of lint.errors) console.error("design error:", e);
  if (!flag("no-lint")) { console.error(`design check failed (${outDir}/design-report.md). Fix it, or pass --no-lint for a technical test.`); process.exit(2); }
}
const scale = Number(opt("scale", "1"));
if (scale !== 1) { timeline.meta.width = Math.round(timeline.meta.width * scale / 2) * 2; timeline.meta.height = Math.round(timeline.meta.height * scale / 2) * 2; }
await writeFile(join(outDir, "timeline.json"), JSON.stringify(timeline, null, 1));
console.log(`timeline: ${timeline.meta.duration.toFixed(2)}s, ${timeline.lines.length} lines, voice=${voiced ? "VOICEVOX" : "ESTIMATED (silent)"}`);
if (flag("timeline-only")) process.exit(0);

// ---------- visuals ----------
const server = await createServer({ root, logLevel: "error", server: { port: 0, host: "127.0.0.1" } });
await server.listen();
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--disable-gpu-sandbox"]
});
const page = await browser.newPage({ viewport: { width: 400, height: 400 } });
page.on("pageerror", (e) => console.error("page error:", e.message));
await page.addInitScript((tl) => { window.__TIMELINE__ = tl; }, timeline);
await page.goto(`${url}three.html?render=1`);
await page.waitForFunction(() => window.__ready !== undefined);
await page.evaluate(() => window.__ready);
const grab = async (t) => Buffer.from((await page.evaluate((x) => window.__frame(x), t)).split(",")[1], "base64");

const stills = opt("stills");
if (stills) {
  for (const s of stills.split(",")) { await writeFile(join(outDir, `still-${Number(s).toFixed(2)}.jpg`), await grab(Number(s))); }
  console.log("stills written to", outDir);
  await browser.close(); await server.close();
  process.exit(0);
}

const fps = timeline.meta.fps;
const f0 = Math.round(Number(opt("frames-from", "0")) * fps);
const f1 = Math.min(Math.round(timeline.meta.duration * fps), Math.round(Number(opt("frames-to", String(timeline.meta.duration))) * fps));
const videoOnly = join(outDir, "video-only.mp4");
const started = Date.now();
if (flag("reuse-video") && existsSync(videoOnly)) console.log("reusing", videoOnly);
else await run("ffmpeg", ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(fps), "-c:v", "mjpeg", "-i", "-",
  "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", videoOnly], async (stdin) => {
  for (let f = f0; f < f1; f++) {
    const buf = await grab(f / fps);
    if (!stdin.write(buf)) await new Promise((r) => stdin.once("drain", r));
    if (f % 60 === 0) process.stdout.write(`\rframe ${f}/${f1} (${((Date.now() - started) / 1000).toFixed(0)}s)`);
  }
  stdin.end();
});
console.log(`\nvisuals done in ${((Date.now() - started) / 1000).toFixed(0)}s`);
await browser.close();
await server.close();

// ---------- audio ----------
// buses: voices -> [vox] (also the ducking key), sfx + room tone -> [fx], music -> [bgm] ducked under [vox]
const SFX = JSON.parse(await readFile(join(root, "catalog", "sfx3d.json"), "utf8")).sfx;
const LIB = JSON.parse(await readFile(join(root, "catalog", "asset-library.json"), "utf8"));
const genDir = join(outDir, "sfx");
await mkdir(genDir, { recursive: true });
const dur = timeline.meta.duration;
const inputs = [], filters = [], vox = [], fx = [];
const add = (file, t, gain, bus, extra = []) => { const i = inputs.length / 2; inputs.push("-i", file); const ms = Math.max(0, Math.round(t * 1000)); filters.push(`[${i}:a]aresample=48000,aformat=channel_layouts=stereo,volume=${gain},adelay=${ms}|${ms}[a${i}]`); bus.push(`[a${i}]`); void extra; };
for (const l of audio.lines) if (l.audio) add(l.audio, l.t, prod.voices?.[l.who]?.gain ?? 1, vox);
for (const s of audio.sfx) {
  const def = SFX[s.name];
  if (!def) throw new Error(`Unknown sfx: ${s.name} (catalog/sfx3d.json)`);
  for (const layer of def.layers) {
    let file = layer.file ? join(root, layer.file) : join(genDir, `${s.name}-${def.layers.indexOf(layer)}.wav`);
    if (layer.lavfi && !existsSync(file)) await run("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", layer.lavfi, "-ar", "48000", "-ac", "2", file]);
    add(file, s.t + (layer.offset ?? 0), (layer.gain ?? 1) * s.gain, fx);
  }
}
const tone = join(genDir, "roomtone.wav");
await run("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", `anoisesrc=color=brown:amplitude=0.6:d=${dur.toFixed(2)}`, "-f", "lavfi", "-i", `sine=f=100:d=${dur.toFixed(2)}`,
  "-filter_complex", "[0:a]lowpass=f=400,volume=0.05[n];[1:a]volume=0.006[h];[n][h]amix=inputs=2:normalize=0", "-ar", "48000", "-ac", "2", tone]);
add(tone, 0, 1, fx);
const graph = [...filters];
if (!vox.length) { add(tone, 0, 0, vox); graph.push(filters.at(-1)); }
graph.push(`${vox.join("")}amix=inputs=${vox.length}:normalize=0:duration=longest,asplit=2[vox][key]`);
graph.push(`${fx.join("")}amix=inputs=${fx.length}:normalize=0:duration=longest[fx]`);
const m = audio.music ?? {};
let buses = "[vox][fx]", nb = 2, musicCredit = null;
if (m.track) {
  const tr = LIB.music.find((x) => x.id === m.track);
  if (!tr) throw new Error(`music.track not in catalog/asset-library.json music: ${m.track}`);
  musicCredit = tr;
  const i = inputs.length / 2;
  inputs.push("-stream_loop", "-1", "-i", join(root, tr.path));
  // silence windows from music:cut / music:resume actions
  const cuts = [];
  let open = null;
  for (const e of m.events ?? []) { if (e.op === "cut" && open === null) open = e.t; if (e.op === "resume" && open !== null) { cuts.push([open, e.t]); open = null; } }
  if (open !== null) cuts.push([open, dur + 1]);
  const mute = cuts.length ? `,volume='if(${cuts.map(([a, b]) => `between(t,${a.toFixed(3)},${b.toFixed(3)})`).join("+")},0,1)':eval=frame` : "";
  const start = m.from ?? 0, fadeOut = m.fadeOut ?? 0.8;
  const ms = Math.round(start * 1000);
  graph.push(`[${i}:a]aresample=48000,aformat=channel_layouts=stereo,atrim=0:${(dur - start).toFixed(3)},volume=${m.gain ?? 0.3},afade=t=in:d=${m.fadeIn ?? 0.3},afade=t=out:st=${Math.max(0, dur - start - fadeOut).toFixed(3)}:d=${fadeOut},adelay=${ms}|${ms}${mute}[bgmraw]`);
  graph.push(`[bgmraw][key]sidechaincompress=threshold=0.015:ratio=${m.duckRatio ?? 6}:attack=15:release=350:makeup=1[bgm]`);
  buses += "[bgm]"; nb = 3;
} else graph.push("[key]anullsink");
graph.push(`${buses}amix=inputs=${nb}:normalize=0:duration=first,atrim=0:${dur.toFixed(3)},loudnorm=I=-15:TP=-1.5:LRA=11,aresample=48000[out]`);
const mix = join(outDir, "mix.wav");
await run("ffmpeg", ["-y", "-loglevel", "error", ...inputs, "-filter_complex", graph.join(";"), "-map", "[out]", "-ar", "48000", "-ac", "2", mix]);

const final = join(outDir, `${id}.mp4`);
await run("ffmpeg", ["-y", "-loglevel", "error", "-i", videoOnly, "-i", mix, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", final]);

// ---------- review pack ----------
const review = join(outDir, "review");
await rm(review, { recursive: true, force: true });
await mkdir(review, { recursive: true });
await run("ffmpeg", ["-y", "-loglevel", "error", "-ss", "0", "-i", videoOnly, "-frames:v", "1", "-vf", "scale=360:-2", join(review, "first-frame-phone.png")]);
const cols = 6, rows = Math.ceil(dur / cols);
await run("ffmpeg", ["-y", "-loglevel", "error", "-i", videoOnly, "-vf", `fps=1,scale=216:-2,tile=${cols}x${rows}:padding=4:color=black`, "-frames:v", "1", join(review, "contact-sheet.jpg")]);
const ts = (x) => { const ms = Math.round(x * 1000); const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60; return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms % 1000).padStart(3, "0")}`; };
let srt = "", k = 1;
for (const l of timeline.lines) for (const c of l.chunks) srt += `${k++}\n${ts(c.start)} --> ${ts(c.end)}\n${c.text}\n\n`;
await writeFile(join(review, "captions.srt"), srt);
const credits = [...new Set([...voices.values()].map((v) => v.speaker).filter(Boolean))].map((s) => `VOICEVOX:${s}`);
const assetCredits = [];
if (musicCredit) assetCredits.push(`BGM: "${musicCredit.title ?? musicCredit.id}" by ${musicCredit.author} (${musicCredit.license}) ${musicCredit.source}`);
for (const a of Object.values(prod.actors)) if (a.vrm) assetCredits.push(`3Dキャラクター: ${a.vrm.split("/").pop()} — 100Avatars by Polygonal Mind (CC0)`);
if (Object.values(prod.props ?? {}).some((p) => p.kind === "gltf")) assetCredits.push("3D小道具: KayKit by Kay Lousberg (CC0)");
const desc = [prod.design?.title ?? prod.meta.title, "", ...(prod.description ?? []), "", ...credits, ...assetCredits, "効果音: Kenney (CC0) / 一部コード生成", "3D: animation-factory three"].join("\n");
await writeFile(join(review, "description.txt"), desc);
if (prod.design?.title) { const safe = prod.design.title.replace(/[\\/:*?"<>|\s]+/g, "_"); await run("cp", [final, join(review, `${safe}.mp4`)]); }
await writeFile(join(review, "title.txt"), [prod.design?.title ?? prod.meta.title, ...(prod.design?.titleAlternatives ?? [])].join("\n") + "\n");
await writeFile(join(review, "design-report.md"), lint.report);
await writeFile(join(review, "status.json"), JSON.stringify({ production: id, duration: dur, voice: voiced ? "voicevox" : "none-estimated-timing", technical: "pass", editorial: "unreviewed", renderedAt: new Date().toISOString() }, null, 2));
console.log(`done: ${final} (${dur.toFixed(1)}s, voice=${voiced ? "VOICEVOX" : "none"})`);

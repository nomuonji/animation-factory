#!/usr/bin/env node
/**
 * Style Shorts renderer — one topic, one look (catalog/styles.json).
 *
 *   node tools/styles/render-style.mjs <production> [--timeline-only] [--stills 0,3.5,10]
 *        [--scale 0.5] [--no-voice] [--voices-only] [--style <id>] [--out <dir-name>]
 *
 * productions/<id>/styled.json -> VOICEVOX narration (else estimated timing, silent)
 * -> compiled timeline (tools/three/compile.mjs timing) -> styles.html in headless Chromium
 * -> JPEG frames piped to FFmpeg -> voice + SFX + ducked BGM, -14 LUFS -> MP4 + review pack.
 *
 * --style overrides the production's style so one script can be previewed in every look.
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createServer } from "vite";
import { compile, estimateVoice, plainText } from "../three/compile.mjs";
import { lintStyled, resolveScenes } from "./scenes.mjs";

const root = fileURLToPath(new URL("../..", import.meta.url));
const argv = process.argv.slice(2);
const id = argv.find((a, i) => !a.startsWith("--") && !["--stills", "--scale", "--style", "--out", "--frames-from", "--frames-to"].includes(argv[i - 1]));
const flag = (n) => argv.includes(`--${n}`);
const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
if (!id || !/^[A-Za-z0-9._-]+$/.test(id)) throw new Error("usage: render-style.mjs <production-folder> [--style id]");

const prod = JSON.parse(await readFile(join(root, "productions", id, "styled.json"), "utf8"));
const STYLES = JSON.parse(await readFile(join(root, "catalog", "styles.json"), "utf8")).styles;
const style = opt("style", prod.style);
if (!STYLES.some((s) => s.id === style)) throw new Error(`unknown style "${style}" (catalog/styles.json)`);
const outName = opt("out", opt("style") ? `${id}--${style}` : id);
if (!/^[A-Za-z0-9._-]+$/.test(outName)) throw new Error("bad --out");
const outDir = join(root, "outputs", "styles", outName);
const voiceDir = join(root, "outputs", "three-voice"); // shared VOICEVOX cache with the 3D line
await mkdir(outDir, { recursive: true });
await mkdir(voiceDir, { recursive: true });
const VV = process.env.VOICEVOX_URL ?? "http://127.0.0.1:50021";
prod.meta = { fps: 30, width: 1080, height: 1920, ...prod.meta };
const defaultVoice = { speaker: "青山龍星", style: "ノーマル", speed: 1.15 };

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

// ---------- voices (same cache keys as tools/three/render3d.mjs) ----------
const voiceOf = (line) => ({ ...defaultVoice, ...(prod.voices?.[line.who] ?? {}), ...(line.voice ?? {}) });
const keyOf = (line) => createHash("sha1").update(JSON.stringify([plainText(line.text), voiceOf(line)])).digest("hex").slice(0, 16);
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
async function cached(line) {
  const k = keyOf(line), wav = join(voiceDir, `${k}.wav`), meta = join(voiceDir, `${k}.json`);
  return existsSync(wav) && existsSync(meta) ? { ...JSON.parse(await readFile(meta, "utf8")), audio: wav } : null;
}
async function synth(line) {
  const v = voiceOf(line), k = keyOf(line);
  const wav = join(voiceDir, `${k}.wav`), meta = join(voiceDir, `${k}.json`);
  if (v.engine === "espeak-ng") {
    // Offline English prototype voice, without API credentials or paid services.
    await run("espeak-ng", ["-v", v.voice ?? "en-us", "-s", String(v.wpm ?? 145),
      "-p", String(v.pitch ?? 50), "-w", wav, plainText(line.text)]);
    const duration = wavDuration(await readFile(wav));
    const moras = Array.from({ length: Math.max(1, Math.floor(duration * 6)) },
      (_, i) => [i / 6, Math.min(duration, (i + 0.7) / 6)]);
    const info = { duration, moras, speaker: v.speaker ?? "English", engine: "espeak-ng" };
    await writeFile(meta, JSON.stringify(info));
    return { ...info, audio: wav };
  }
  const sid = await speakerId(v);
  const q = await (await fetch(`${VV}/audio_query?text=${encodeURIComponent(plainText(line.text))}&speaker=${sid}`, { method: "POST" })).json();
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
const alive = await vvAlive();
const voices = new Map();
let voiced = true;
for (const b of prod.beats) if (b.line) {
  b.line.who ??= "n";
  let v = flag("no-voice") ? null : await cached(b.line);
  if (!v && (voiceOf(b.line).engine === "espeak-ng" || alive) && !flag("no-voice")) v = await synth(b.line);
  if (!v) { voiced = false; v = estimateVoice(b.line.text, voiceOf(b.line).speed); }
  voices.set(b.line, v);
}
if (flag("voices-only")) { console.log(`voices: ${voiced ? "all synthesized/cached" : "MISSING (VOICEVOX offline)"} in ${voiceDir}`); process.exit(voiced ? 0 : 1); }

// ---------- timeline ----------
const compiled = compile({ ...prod, beats: prod.beats.map((b) => ({ ...b, pre: b.pre ?? 0.06, post: b.post ?? 0.14 })) }, (l) => voices.get(l));
const scenes = resolveScenes(prod, compiled.beats);
const lint = lintStyled(prod, compiled, scenes, style);
await writeFile(join(outDir, "design-report.md"), lint.report);
for (const w of lint.warnings) console.warn("style warning:", w);
if (lint.errors.length) {
  for (const e of lint.errors) console.error("style error:", e);
  if (!flag("no-lint")) { console.error(`style check failed (${outDir}/design-report.md). Fix it, or pass --no-lint for a technical test.`); process.exit(2); }
}
const scale = Number(opt("scale", "1"));
const meta = { ...compiled.timeline.meta };
if (scale !== 1) { meta.width = Math.round(meta.width * scale / 2) * 2; meta.height = Math.round(meta.height * scale / 2) * 2; }
// hook text: only while the opening hook beat(s) play
let overlay = null;
if (prod.design?.hook?.overlay) {
  let n = 0;
  while (n < prod.beats.length && (prod.beats[n].role === "hook" || n === 0)) n++;
  overlay = { text: prod.design.hook.overlay, start: 0, end: compiled.beats[n - 1].end };
}
const timeline = {
  meta, style, theme: prod.theme ?? undefined, scenes,
  lines: compiled.timeline.lines, captions: prod.captions ?? {}, overlay, titleCard: compiled.timeline.titleCard
};
await writeFile(join(outDir, "timeline.json"), JSON.stringify(timeline, null, 1));
console.log(`timeline: ${meta.duration.toFixed(2)}s, ${scenes.length} scenes, style=${style}, voice=${voiced ? "VOICEVOX" : "ESTIMATED (silent)"}`);
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
page.on("console", (m) => { if (m.type() === "error") console.error("console:", m.text()); });
await page.addInitScript(([tl, insp]) => { window.__STYLED__ = tl; window.__INSPECT__ = insp; }, [timeline, flag("inspect")]);
await page.goto(`${url}styles.html?render=1`);
await page.waitForFunction(() => window.__ready !== undefined, null, { timeout: 120000 });
await page.evaluate(() => window.__ready);
const grab = async (t) => Buffer.from((await page.evaluate((x) => window.__frame(x), t)).split(",")[1], "base64");

// --inspect: the layout checks a reviewer does by eye (src/styles/inspect.ts), on two moments per scene
if (flag("inspect")) {
  const moments = opt("stills") && opt("stills") !== "auto" ? opt("stills").split(",").map(Number)
    : scenes.flatMap((s) => [Math.min(s.end - 0.05, s.start + 0.45), Math.max(s.start + 0.5, (s.lineEnd ?? s.end) - 0.12)]);
  const dir = join(outDir, "inspect");
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const report = [];
  for (const t of moments) {
    await grab(t);
    const r = await page.evaluate(() => window.__inspect());
    const sc = scenes.filter((s) => t >= s.start).at(-1);
    const name = `t${t.toFixed(2)}-${sc?.beat ?? ""}.jpg`;
    await writeFile(join(dir, name), Buffer.from(r.annotated.split(",")[1], "base64"));
    report.push({ t, beat: sc?.beat, scene: sc?.scene, image: name, issues: r.issues.map(({ level, code, msg }) => ({ level, code, msg })) });
  }
  const errors = report.flatMap((r) => r.issues.filter((i) => i.level === "error")).length;
  const warns = report.flatMap((r) => r.issues.filter((i) => i.level === "warn")).length;
  await writeFile(join(dir, "inspect.json"), JSON.stringify(report, null, 1));
  const md = [`# layout inspect — ${outName} (${style})`, "", `errors ${errors} / warnings ${warns}。画像は番号付きの枠で問題箇所を示す（赤=error、橙=warn、薄赤の帯=スマホUIで隠れる領域）。`, "",
    ...report.flatMap((r) => [`## ${r.t.toFixed(2)}s — ${r.beat} (${r.scene}) — ${r.image}`, ...(r.issues.length ? r.issues.map((i, k) => `${k + 1}. **${i.level}** ${i.msg}`) : ["- 問題なし"]), ""]),
    "機械で見られるのは配置・はみ出し・重なり・文字の大きさ・コントラストだけ。何が映っているか・分かりやすいか・面白いかは画像を自分で見て判断する。"].join("\n");
  await writeFile(join(dir, "inspect.md"), md + "\n");
  console.log(`inspect: ${errors} errors, ${warns} warnings -> ${dir}/inspect.md`);
  await browser.close(); await server.close();
  process.exit(errors ? 1 : 0);
}

const stills = opt("stills");
if (stills) {
  const list = stills === "auto" ? scenes.map((s) => Math.min(s.end - 0.05, (s.lineEnd ?? s.end) - 0.1)) : stills.split(",").map(Number);
  for (const s of list) await writeFile(join(outDir, `still-${s.toFixed(2)}.jpg`), await grab(s));
  console.log(`${list.length} stills written to`, outDir);
  await browser.close(); await server.close();
  process.exit(0);
}

const fps = meta.fps;
const f0 = Math.round(Number(opt("frames-from", "0")) * fps);
const f1 = Math.min(Math.round(meta.duration * fps), Math.round(Number(opt("frames-to", String(meta.duration))) * fps));
const videoOnly = join(outDir, "video-only.mp4");
const started = Date.now();
await run("ffmpeg", ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(fps), "-c:v", "mjpeg", "-i", "-",
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
const SFX = { ...JSON.parse(await readFile(join(root, "catalog", "sfx3d.json"), "utf8")).sfx, ...JSON.parse(await readFile(join(root, "catalog", "sfx-styles.json"), "utf8")).sfx };
const LIB = JSON.parse(await readFile(join(root, "catalog", "asset-library.json"), "utf8"));
const styleInfo = STYLES.find((s) => s.id === style);
const STYLE_TRANSITION = Object.fromEntries(STYLES.map((s) => [s.id, s.transition]));
const genDir = join(outDir, "sfx");
await mkdir(genDir, { recursive: true });
const dur = meta.duration;
const inputs = [], filters = [], vox = [], fx = [];
const add = (file, t, gain, bus) => { const i = inputs.length / 2; inputs.push("-i", file); const ms = Math.max(0, Math.round(t * 1000)); filters.push(`[${i}:a]aresample=48000,aformat=channel_layouts=stereo,volume=${gain},adelay=${ms}|${ms}[a${i}]`); bus.push(`[a${i}]`); };
for (const l of compiled.audio.lines) if (l.audio) add(l.audio, l.t, prod.voices?.[l.who]?.gain ?? 1, vox);
// scene-change cue from the style (production can switch it off with "autoSfx": false)
const cues = [...compiled.audio.sfx];
// only where the picture visibly moves (pop / slide / flash / wipe); a hard cut or fade gets no sound (docs/agent-video-craft.md §音)
const MOVING = new Set(["pop", "slide", "flash", "wipe"]);
const transitionOf = (sc) => sc.transition ?? STYLE_TRANSITION[style];
if (prod.autoSfx !== false && styleInfo.sceneSfx) for (const s of scenes.slice(1)) if (!s.continued && MOVING.has(transitionOf(s))) cues.push({ t: s.start, name: styleInfo.sceneSfx, gain: 0.8 });
for (const s of cues) {
  const def = SFX[s.name];
  if (!def) throw new Error(`Unknown sfx: ${s.name} (catalog/sfx3d.json)`);
  for (const [li, layer] of def.layers.entries()) {
    const file = layer.file ? join(root, layer.file) : join(genDir, `${s.name}-${li}.wav`);
    if (layer.lavfi && !existsSync(file)) await run("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", layer.lavfi, "-ar", "48000", "-ac", "2", file]);
    add(file, s.t + (layer.offset ?? 0), (layer.gain ?? 1) * s.gain, fx);
  }
}
const silence = join(genDir, "silence.wav");
if (!existsSync(silence)) await run("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo:d=1", silence]);
add(silence, 0, 1, fx);
const graph = [...filters];
if (!vox.length) { add(silence, 0, 0, vox); graph.push(filters.at(-1)); }
graph.push(`${vox.join("")}amix=inputs=${vox.length}:normalize=0:duration=longest,highpass=f=90,acompressor=threshold=0.08:ratio=3:attack=8:release=120:makeup=1.6,equalizer=f=2600:t=q:w=1.2:g=3,equalizer=f=7200:t=q:w=2:g=-2,asplit=2[vox][key]`);
graph.push(`${fx.join("")}amix=inputs=${fx.length}:normalize=0:duration=longest[fx]`);
const m = { track: styleInfo.music, gain: 0.16, ...(prod.music ?? {}) };
let buses = "[vox][fx]", nb = 2, musicCredit = null;
if (m.track && m.track !== "none") {
  const tr = LIB.music.find((x) => x.id === m.track);
  if (!tr) throw new Error(`music.track not in catalog/asset-library.json music: ${m.track}`);
  musicCredit = tr;
  const i = inputs.length / 2;
  inputs.push("-stream_loop", "-1", "-i", join(root, tr.path));
  const fadeOut = m.fadeOut ?? 0.8;
  graph.push(`[${i}:a]aresample=48000,aformat=channel_layouts=stereo,atrim=0:${dur.toFixed(3)},volume=${m.gain},afade=t=in:d=${m.fadeIn ?? 0.3},afade=t=out:st=${Math.max(0, dur - fadeOut).toFixed(3)}:d=${fadeOut}[bgmraw]`);
  graph.push(`[bgmraw][key]sidechaincompress=threshold=0.02:ratio=${m.duckRatio ?? 5}:attack=20:release=450:makeup=1[bgm]`);
  buses += "[bgm]"; nb = 3;
} else graph.push("[key]anullsink");
graph.push(`${buses}amix=inputs=${nb}:normalize=0:duration=longest,apad,atrim=0:${dur.toFixed(3)}[out]`);
const pre = join(outDir, "mix-pre.wav"), mix = join(outDir, "mix.wav");
await run("ffmpeg", ["-y", "-loglevel", "error", ...inputs, "-filter_complex", graph.join(";"), "-map", "[out]", "-ar", "48000", "-ac", "2", pre]);
const probe = await new Promise((res, rej) => {
  const p = spawn("ffmpeg", ["-hide_banner", "-nostats", "-i", pre, "-af", "loudnorm=I=-14:TP=-1.5:LRA=9:print_format=json", "-f", "null", "-"], { cwd: root });
  let err = ""; p.stderr.on("data", (d) => { err += d; }); p.on("error", rej);
  p.on("exit", () => { try { res(JSON.parse(err.slice(err.lastIndexOf("{"), err.lastIndexOf("}") + 1))); } catch (e) { rej(e); } });
});
const silentMix = !Number.isFinite(Number(probe.input_i));
await run("ffmpeg", ["-y", "-loglevel", "error", "-i", pre, "-af",
  silentMix ? "anull" : `loudnorm=I=-14:TP=-1.5:LRA=9:measured_I=${probe.input_i}:measured_TP=${probe.input_tp}:measured_LRA=${probe.input_lra}:measured_thresh=${probe.input_thresh}:offset=${probe.target_offset}:linear=true,aresample=48000`,
  "-ar", "48000", "-ac", "2", mix]);
const final = join(outDir, `${outName}.mp4`);
await run("ffmpeg", ["-y", "-loglevel", "error", "-i", videoOnly, "-i", mix, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", final]);

// ---------- review pack ----------
const review = join(outDir, "review");
await rm(review, { recursive: true, force: true });
await mkdir(review, { recursive: true });
await run("ffmpeg", ["-y", "-loglevel", "error", "-ss", "0", "-i", videoOnly, "-frames:v", "1", "-vf", "scale=360:-2", join(review, "first-frame-phone.png")]);
const cols = 6, rows = Math.ceil(dur / cols);
await run("ffmpeg", ["-y", "-loglevel", "error", "-i", videoOnly, "-vf", `fps=1,scale=216:-2,tile=${cols}x${rows}:padding=4:color=black`, "-frames:v", "1", join(review, "contact-sheet.jpg")]);
const ts = (x) => { const ms = Math.round(x * 1000); const h = Math.floor(ms / 3600000), mm = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60; return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms % 1000).padStart(3, "0")}`; };
let srt = "", k = 1;
for (const l of timeline.lines) for (const c of l.chunks) srt += `${k++}\n${ts(c.start)} --> ${ts(c.end)}\n${c.text}\n\n`;
await writeFile(join(review, "captions.srt"), srt);
const voicevoxCredits = [...new Set([...voices.values()].filter((v) => v.engine !== "espeak-ng").map((v) => v.speaker).filter(Boolean))].map((s) => `VOICEVOX:${s}`);
const credits = [...voicevoxCredits, ...([...voices.values()].some((v) => v.engine === "espeak-ng") ? ["English voice: eSpeak NG (offline prototype)"] : [])];
const extra = [];
if (musicCredit) extra.push(`BGM: "${musicCredit.title ?? musicCredit.id}" by ${musicCredit.author} (${musicCredit.license}) ${musicCredit.source}`);
if (cues.length) extra.push("効果音: Kenney (CC0) / 一部コード生成");
const desc = [prod.design?.title ?? prod.meta.title, "", ...(prod.description ?? []), "", ...(prod.sources ?? []).map((s) => `出典: ${s}`), ...credits, ...extra, `映像: animation-factory style shorts (${styleInfo.name})`, ...(prod.hashtags?.length ? ["", prod.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")] : [])].join("\n");
await writeFile(join(review, "description.txt"), desc);
const title = prod.design?.title ?? prod.meta.title;
await run("cp", [final, join(review, `${title.replace(/[\\/:*?"<>|\s]+/g, "_")}.mp4`)]);
await writeFile(join(review, "title.txt"), [title, ...(prod.design?.titleAlternatives ?? [])].join("\n") + "\n");
await writeFile(join(review, "design-report.md"), lint.report);
await writeFile(join(review, "status.json"), JSON.stringify({ production: id, style, duration: dur, voice: voiced ? ([...voices.values()].every((v) => v.engine === "espeak-ng") ? "espeak-ng" : "voicevox") : "none-estimated-timing", technical: "pass", editorial: "unreviewed", renderedAt: new Date().toISOString() }, null, 2));
console.log(`done: ${final} (${dur.toFixed(1)}s, style=${style}, voice=${voiced ? "VOICEVOX" : "none"})`);

#!/usr/bin/env node
/**
 * Technical QA for a rendered 3D skit (run after a full render3d.mjs).
 * Checks what an agent can measure; it cannot judge whether the skit is funny
 * and it does not replace a person listening to the sound.
 *
 *   node tools/three/qa.mjs <id>
 *
 * Fails (exit 1) when: review pack files are missing, voice timing was estimated,
 * the length is outside 35–50 s, the MP4's video/audio length differs from the
 * timeline by more than 0.15 s, or integrated loudness is outside -15.5..-12.5 LUFS.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const id = process.argv[2];
if (!id) { console.error("usage: node tools/three/qa.mjs <id>"); process.exit(2); }
const out = join(root, "outputs", "three", id), review = join(out, "review");
const bad = [], ok = [];
const check = (cond, okMsg, badMsg) => (cond ? ok : bad).push(cond ? okMsg : badMsg);

const need = ["contact-sheet.jpg", "first-frame-phone.png", "description.txt", "title.txt", "captions.srt", "status.json"];
for (const f of need) check(existsSync(join(review, f)), `review/${f}`, `review/${f} がない（本番レンダリングをしたか）`);
const mp4 = existsSync(review) ? readdirSync(review).find((f) => f.endsWith(".mp4")) : null;
check(!!mp4, `review/${mp4}`, "review/ に完成MP4がない");
if (!mp4) { report(); }

const tl = JSON.parse(readFileSync(join(out, "timeline.json"), "utf8"));
const status = JSON.parse(readFileSync(join(review, "status.json"), "utf8"));
const dur = tl.meta.duration;
check(status.voice === "voicevox", "音声: VOICEVOX の実音声", `音声が ${status.voice}（推定タイミング）。three-voice を outputs/three-voice/ に置いて再レンダリング`);
check(dur >= 35 && dur <= 50, `尺 ${dur.toFixed(1)}s（35〜50s）`, `尺 ${dur.toFixed(1)}s が 35〜50s の外。段（escalate）で調整する`);

const file = join(review, mp4);
const probe = execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_type,duration", "-of", "csv=p=0", file]).toString().trim().split("\n");
for (const row of probe) {
  const [type, d] = row.split(",");
  const diff = Math.abs(Number(d) - dur);
  check(diff <= 0.15, `${type} ${Number(d).toFixed(2)}s（timeline ${dur.toFixed(2)}s）`, `${type} ${Number(d).toFixed(2)}s が timeline ${dur.toFixed(2)}s と ${diff.toFixed(2)}s ずれている`);
}
let lufs = NaN;
const log = String(spawnSync("ffmpeg", ["-nostats", "-i", file, "-af", "ebur128", "-f", "null", "-"], { encoding: "utf8" }).stderr ?? "");
const m = [...log.matchAll(/I:\s+(-?[\d.]+) LUFS/g)].at(-1);
if (m) lufs = Number(m[1]);
check(lufs >= -15.5 && lufs <= -12.5, `音量 ${lufs} LUFS（目標 -14）`, `音量 ${lufs} LUFS が -15.5〜-12.5 の外`);
const desc = existsSync(join(review, "description.txt")) ? readFileSync(join(review, "description.txt"), "utf8") : "";
check(/VOICEVOX:/.test(desc), "description.txt に VOICEVOX クレジット", "description.txt に VOICEVOX のクレジットがない");
report();

function report() {
  for (const s of ok) console.log("  ok  ", s);
  for (const s of bad) console.log("  NG  ", s);
  console.log(bad.length ? `QA failed (${bad.length})` : "QA passed (technical only — editorial is a person's call, and nobody has listened yet)");
  console.log("Also look at review/contact-sheet.jpg and review/first-frame-phone.png yourself (docs/three-shorts-playbook.md §5).");
  process.exit(bad.length ? 1 : 0);
}

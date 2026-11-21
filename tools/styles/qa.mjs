#!/usr/bin/env node
/**
 * Technical QA for a rendered Style Short (after a full render-style.mjs).
 * It cannot judge whether the video is interesting or the facts are right.
 *
 *   node tools/styles/qa.mjs <output-folder>   (outputs/styles/<output-folder>)
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const id = process.argv[2];
if (!id || !/^[A-Za-z0-9._-]+$/.test(id)) { console.error("usage: node tools/styles/qa.mjs <id>"); process.exit(2); }
const out = join(root, "outputs", "styles", id), review = join(out, "review");
const bad = [], ok = [];
const check = (c, a, b) => (c ? ok : bad).push(c ? a : b);
for (const f of ["contact-sheet.jpg", "first-frame-phone.png", "description.txt", "title.txt", "captions.srt", "status.json", "design-report.md"]) check(existsSync(join(review, f)), `review/${f}`, `review/${f} がない`);
const mp4 = existsSync(review) ? readdirSync(review).find((f) => f.endsWith(".mp4")) : null;
check(!!mp4, `review/${mp4}`, "review/ に完成MP4がない");
if (mp4) {
  const tl = JSON.parse(readFileSync(join(out, "timeline.json"), "utf8"));
  const status = JSON.parse(readFileSync(join(review, "status.json"), "utf8"));
  const dur = tl.meta.duration;
  check(["voicevox", "espeak-ng"].includes(status.voice), `音声: ${status.voice}`, `音声が ${status.voice}（推定タイミング・無音）`);
  check(dur >= 15 && dur <= 59, `尺 ${dur.toFixed(1)}s`, `尺 ${dur.toFixed(1)}s が 15〜59s の外`);
  const file = join(review, mp4);
  for (const row of execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_type,duration", "-of", "csv=p=0", file]).toString().trim().split("\n")) {
    const [type, d] = row.split(","); const diff = Math.abs(Number(d) - dur);
    check(diff <= 0.15, `${type} ${Number(d).toFixed(2)}s`, `${type} ${Number(d).toFixed(2)}s が timeline ${dur.toFixed(2)}s と ${diff.toFixed(2)}s ずれ`);
  }
  const log = String(spawnSync("ffmpeg", ["-nostats", "-i", file, "-af", "ebur128", "-f", "null", "-"], { encoding: "utf8" }).stderr ?? "");
  const m = [...log.matchAll(/I:\s+(-?[\d.]+) LUFS/g)].at(-1);
  const lufs = m ? Number(m[1]) : NaN;
  check(lufs >= -15.5 && lufs <= -12.5, `音量 ${lufs} LUFS`, `音量 ${lufs} LUFS が -15.5〜-12.5 の外`);
  const desc = readFileSync(join(review, "description.txt"), "utf8");
  check(/VOICEVOX:|English voice: eSpeak NG/.test(desc), "音声クレジット", "description.txt に音声クレジットがない");
  const report = readFileSync(join(review, "design-report.md"), "utf8");
  check(!/## errors\n- (?!なし)/.test(report), "style lint: errors なし", "style lint に errors がある");
}
for (const s of ok) console.log("  ok  ", s);
for (const s of bad) console.log("  NG  ", s);
console.log(bad.length ? `QA failed (${bad.length})` : "QA passed (technical only — look at contact-sheet.jpg and check every number against its source yourself)");
process.exit(bad.length ? 1 : 0);

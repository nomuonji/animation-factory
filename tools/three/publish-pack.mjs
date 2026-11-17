#!/usr/bin/env node
/**
 * Put a finished 3D skit into a nomuonji/video-publisher checkout as
 * incoming/<concept>/<date>-<id>.mp4 + .json (the sidecar Queue From Repo reads).
 * It only writes files; you still branch (incoming/<id>), commit and push there.
 *
 *   node tools/three/publish-pack.mjs <id> --publisher ../video-publisher
 *        [--date 2026-11-11] [--concept おもしろ] [--post "YouTube,TikTok"] [--tiktok oyu295]
 *
 * Refuses when: the production is a character sheet, QA (tools/three/qa.mjs) fails,
 * or productions/<id>/published.json already records a post (no double posting).
 * Title, description and hashtags come from review/description.txt
 * (line 1 = title, lines starting with # = hashtags, the rest incl. credits = description).
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const argv = process.argv.slice(2);
const id = argv.find((a) => !a.startsWith("--") && !argv[argv.indexOf(a) - 1]?.startsWith("--"));
const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const die = (m) => { console.error(m); process.exit(1); };
if (!id || !opt("publisher")) die("usage: node tools/three/publish-pack.mjs <id> --publisher <video-publisher checkout> [--date YYYY-MM-DD] [--concept おもしろ] [--post YouTube,TikTok] [--tiktok oyu295]");

const prod = JSON.parse(readFileSync(join(root, "productions", id, "scene3d.json"), "utf8"));
if (prod.meta?.kind === "character-sheet") die(`${id} is a character sheet (publish: false)`);
const ledger = join(root, "productions", id, "published.json");
if (existsSync(ledger)) die(`${id} is already published (${ledger}). Do not post it again.`);
const qa = spawnSync(process.execPath, [join(root, "tools/three/qa.mjs"), id], { stdio: "inherit" });
if (qa.status !== 0) die("QA failed; fix it before publishing");

const review = join(root, "outputs", "three", id, "review");
const mp4 = readdirSync(review).find((f) => f.endsWith(".mp4"));
const lines = readFileSync(join(review, "description.txt"), "utf8").split("\n");
const title = lines[0].trim();
const hashtags = lines.filter((l) => l.startsWith("#")).join(" ").trim();
const description = lines.slice(1).filter((l) => !l.startsWith("#")).join("\n").replace(/\n{3,}/g, "\n\n").trim();
if (!/VOICEVOX:/.test(description)) die("description lost the VOICEVOX credit");

const date = opt("date", new Date().toISOString().slice(0, 10));
const concept = opt("concept", "おもしろ");
const dir = join(resolve(opt("publisher")), "incoming", concept);
mkdirSync(dir, { recursive: true });
const base = join(dir, `${date}-${id}`);
copyFileSync(join(review, mp4), `${base}.mp4`);
// hashtags must be ONE string ("#a #b"), not an array: queue-from-repo appends it to the description
const sidecar = { title, description, hashtags, postNow: opt("post", "YouTube,TikTok"), tiktokAccount: opt("tiktok", "oyu295") };
writeFileSync(`${base}.json`, JSON.stringify(sidecar, null, 2) + "\n");
console.log(`wrote ${base}.mp4 and .json`);
console.log(JSON.stringify(sidecar, null, 2));
console.log(`next (in the video-publisher checkout): git checkout -B incoming/${id} origin/main && git add incoming && git commit -m "incoming: ${title}" && git push origin incoming/${id}`);
console.log(`after posting: record the URLs in productions/${id}/published.json (docs/three-shorts-playbook.md §8)`);

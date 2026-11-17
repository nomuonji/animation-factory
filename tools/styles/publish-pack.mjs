#!/usr/bin/env node
/**
 * Put a finished Style Short into a nomuonji/video-publisher checkout as
 * incoming/<concept>/<date>-<id>.mp4 + .json (the sidecar Queue From Repo reads).
 * Only writes files; you still branch, commit and push in the publisher checkout.
 * Publish only when the user asked for it and named the channel (--concept is required).
 *
 *   node tools/styles/publish-pack.mjs <id> --publisher ../video-publisher --concept <concept>
 *        [--date YYYY-MM-DD] [--post "YouTube,TikTok"] [--tiktok <account>]
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const argv = process.argv.slice(2);
const id = argv.find((a, i) => !a.startsWith("--") && !argv[i - 1]?.startsWith("--"));
const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const die = (m) => { console.error(m); process.exit(1); };
if (!id || !/^[A-Za-z0-9._-]+$/.test(id) || !opt("publisher") || !opt("concept")) die("usage: node tools/styles/publish-pack.mjs <id> --publisher <video-publisher checkout> --concept <concept> [--date] [--post] [--tiktok]");
const prod = JSON.parse(readFileSync(join(root, "productions", id, "styled.json"), "utf8"));
if (prod.meta?.kind === "style-demo") die(`${id} is a style demo (never published)`);
const ledger = join(root, "productions", id, "published.json");
if (existsSync(ledger)) die(`${id} is already published (${ledger}). Do not post it again.`);
const qa = spawnSync(process.execPath, [join(root, "tools/styles/qa.mjs"), id], { stdio: "inherit" });
if (qa.status !== 0) die("QA failed; fix it before publishing");
const review = join(root, "outputs", "styles", id, "review");
const mp4 = readdirSync(review).find((f) => f.endsWith(".mp4"));
const lines = readFileSync(join(review, "description.txt"), "utf8").split("\n");
const title = lines[0].trim();
const hashtags = lines.filter((l) => l.startsWith("#")).join(" ").trim();
const description = lines.slice(1).filter((l) => !l.startsWith("#")).join("\n").replace(/\n{3,}/g, "\n\n").trim();
const date = opt("date", new Date().toISOString().slice(0, 10));
const dir = join(resolve(opt("publisher")), "incoming", opt("concept"));
mkdirSync(dir, { recursive: true });
const base = join(dir, `${date}-${id}`);
copyFileSync(join(review, mp4), `${base}.mp4`);
const sidecar = { title, description, hashtags, postNow: opt("post", "YouTube,TikTok"), ...(opt("tiktok") ? { tiktokAccount: opt("tiktok") } : {}) };
writeFileSync(`${base}.json`, JSON.stringify(sidecar, null, 2) + "\n");
console.log(`wrote ${base}.mp4 and .json`);
console.log(`after posting: record the URLs in productions/${id}/published.json`);

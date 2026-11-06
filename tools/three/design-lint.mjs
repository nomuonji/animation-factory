#!/usr/bin/env node
/**
 * Short-drama meta-design check for productions/<id>/scene3d.json.
 * Structure only: it cannot tell whether a joke is funny. Passing it is a
 * precondition for spending render time, not an editorial approval.
 *
 *   node tools/three/design-lint.mjs <id>     (estimated voice timing)
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { compile, estimateVoice } from "./compile.mjs";

const root = fileURLToPath(new URL("../..", import.meta.url));
const chars = (s) => [...String(s ?? "")].length;

export async function loadFormats() {
  return JSON.parse(await readFile(join(root, "catalog", "skit-formats.json"), "utf8"));
}

/** @returns {{errors:string[], warnings:string[], report:string}} */
export function lintDesign(prod, compiled, catalog) {
  const E = [], W = [];
  const L = catalog.lint;
  const d = prod.design;
  const tl = compiled.timeline;
  const dur = tl.meta.duration;
  if (!d) return { errors: ["design ブロックがない（templates/skit3d.json を参照）"], warnings: [], report: "" };
  const fmt = catalog.formats[d.format];
  if (!fmt) E.push(`design.format が未知: ${d.format}（catalog/skit-formats.json）`);

  // --- title / overlay / first frame: the three promises
  if (!d.title) E.push("design.title がない");
  else {
    if (chars(d.title) > L.maxTitleChars) E.push(`タイトルが長い（${chars(d.title)}字 > ${L.maxTitleChars}）: ${d.title}`);
    if (/[!！?？]{2,}|【|】|衝撃|ヤバ/.test(d.title)) W.push("タイトルに煽り表現・記号の多用がある");
  }
  if (!Array.isArray(d.titleAlternatives) || d.titleAlternatives.length < 2) W.push("titleAlternatives を2案以上（ABテスト・選定用）");
  if (d.titlePattern && !catalog.titlePatterns[d.titlePattern]) E.push(`titlePattern が未知: ${d.titlePattern}`);
  if (d.titlePattern === "if") W.push("『もしも〜』型は飽和気味。他の型で言えないか確認");
  if (fmt && d.titlePattern && !fmt.titlePatterns.includes(d.titlePattern)) W.push(`${d.format} の推奨タイトル型は ${fmt.titlePatterns.join("/")}`);
  const h = d.hook ?? {};
  if (!h.type || !catalog.hookTypes[h.type]) E.push(`design.hook.type が未知: ${h.type}`);
  if (!h.firstFrame) E.push("design.hook.firstFrame（0秒に何が見えるか）がない");
  if (!h.overlay) W.push("design.hook.overlay（画面上のフック文字）がない");
  else {
    if (chars(h.overlay) > L.maxOverlayChars) E.push(`フック文字が長い（${chars(h.overlay)}字 > ${L.maxOverlayChars}）: ${h.overlay}`);
    if (d.title && (h.overlay === d.title || d.title.includes(h.overlay))) W.push("フック文字がタイトルの繰り返し。別の層（絵の補足・問い）にする");
  }
  for (const k of ["rule", "turn", "payoff", "button"]) if (!d[k]) E.push(`design.${k} がない`);
  if (!Array.isArray(d.escalations) || d.escalations.length < 2) E.push("design.escalations を2段以上");
  if (d.payoff && d.title && [...d.payoff.matchAll(/[一-龠ァ-ヶー]{3,}/g)].some((m) => d.title.includes(m[0]) && !(d.rule ?? "").includes(m[0])))
    W.push("タイトルがオチ（payoff）の語を含んでいる可能性。ネタバレしていないか");

  // --- beats & timing
  const beats = prod.beats.map((b, i) => ({ ...b, ...compiled.beats[i] }));
  const missing = beats.filter((b) => !b.role).map((b) => b.id);
  if (missing.length) E.push(`role のないビート: ${missing.join(", ")}`);
  const order = beats.map((b) => b.role).filter((r) => r && r !== "bridge" && r !== "title");
  const titleBeat = beats.find((b) => b.role === "title");
  const cardDur = titleBeat ? titleBeat.end - titleBeat.start : 0;
  if ((d.titleOnScreen ?? "card") === "card" && !titleBeat) E.push("タイトルカードのビート（role=title）がない。動画の一番最初に置く");
  if (titleBeat && beats[0]?.role !== "title") E.push(`タイトルカードは一番最初のビートにする（今は${titleBeat.start.toFixed(1)}s）`);
  if (titleBeat && cardDur > L.maxTitleCard) W.push(`タイトルカードが長い（${cardDur.toFixed(1)}s > ${L.maxTitleCard}s）。最初の画で離脱される`);
  const unknown = beats.filter((b) => b.role && !catalog.roles[b.role]);
  if (unknown.length) E.push(`未知の role: ${unknown.map((b) => b.role).join(",")}`);
  if (order[0] !== "hook") E.push("タイトルの次（なければ最初）のビートは role=hook");
  if (order.at(-1) !== "button") W.push("最後のビートは role=button（余韻・ループ）を推奨");
  const idx = (r) => order.indexOf(r), last = (r) => order.lastIndexOf(r);
  const esc = beats.filter((b) => b.role === "escalate");
  if (esc.length < 2) E.push(`escalate ビートが${esc.length}個（2個以上）`);
  const levels = esc.map((b) => b.level ?? 0);
  if (levels.some((v) => !v)) W.push("escalate に level(1,2,3…) を付けると段の上がり方を検査できる");
  else if (levels.some((v, i) => i && v < levels[i - 1])) E.push(`escalate の level が下がっている: ${levels.join("→")}`);
  if (idx("turn") < 0) E.push("turn ビートがない（But/Therefore の転換）");
  else if (idx("turn") < last("escalate")) W.push("turn が escalate より前にある");
  if (idx("payoff") < 0) E.push("payoff ビートがない");
  else if (idx("payoff") < idx("turn")) E.push("payoff が turn より前");
  const firstSound = Math.min(compiled.audio.sfx.find((x) => x.t <= 0.05) ? 0 : Infinity, tl.lines[0]?.start ?? Infinity, compiled.audio.sfx[0]?.t ?? Infinity);
  if (firstSound > L.firstSoundBy) E.push(`最初の音が遅い（${firstSound.toFixed(2)}s > ${L.firstSoundBy}s）`);
  const rule = beats.find((b) => b.role === "rule");
  if (!rule) E.push("rule ビートがない（世界のルールが一つだと分かる瞬間）");
  else if (rule.end - cardDur > L.ruleBy) E.push(`ルールの提示が遅い（タイトルカードを除き${(rule.end - cardDur).toFixed(1)}s > ${L.ruleBy}s）`);
  const pay = beats.find((b) => b.role === "payoff");
  if (pay && pay.start < dur * L.payoffAfterRatio) W.push(`payoff が早い（${pay.start.toFixed(1)}s, 全体の${Math.round(pay.start / dur * 100)}%）`);
  const btn = beats.filter((b) => b.role === "button").at(-1);
  if (btn && btn.end - btn.start > L.maxButton) W.push(`button が長い（${(btn.end - btn.start).toFixed(1)}s > ${L.maxButton}s）`);
  for (const b of beats.filter((x) => x.role === "bridge")) if (b.end - b.start > L.maxBridge) W.push(`bridge ${b.id} が長い`);
  if (fmt) {
    const [lo, hi] = fmt.duration;
    if (dur < lo || dur > hi) W.push(`尺 ${dur.toFixed(1)}s は ${d.format} の目安 ${lo}〜${hi}s の外`);
  }
  // visual change every few seconds: cuts, actions, new lines
  const marks = [...tl.shots.map((s) => s.start), ...tl.events.map((e) => e.t), ...tl.lines.map((l) => l.start), dur].sort((a, b) => a - b);
  let gap = 0, at = 0;
  for (let i = 1; i < marks.length; i++) if (marks[i] - marks[i - 1] > gap) { gap = marks[i] - marks[i - 1]; at = marks[i - 1]; }
  if (gap > L.maxStaticShot) W.push(`${at.toFixed(1)}s から ${gap.toFixed(1)}s 間、画も台詞も変化しない`);
  if (d.loop && !beats.at(-1)?.loopsTo) W.push("design.loop=true なら最後のビートに loopsTo（つながる先のビートid）を書く");

  // --- report
  const rows = beats.map((b) => `| ${b.start.toFixed(1)}–${b.end.toFixed(1)} | ${b.role ?? "?"}${b.level ? ` L${b.level}` : ""} | ${b.shot ?? ""} | ${b.line ? `${b.line.who}: ${b.line.text.replaceAll("／", "")}` : "（無言）"} |`);
  const report = [
    `# Design report: ${prod.meta.id}`, "",
    `- format: **${d.format}** ${fmt ? `（${fmt.label}）` : ""}`,
    `- title: **${d.title}**（${chars(d.title)}字, ${d.titlePattern ?? "-"}）`,
    `- alternatives: ${(d.titleAlternatives ?? []).join(" / ")}`,
    `- hook: ${h.type} — 0秒: ${h.firstFrame ?? "?"} / 画面文字: 「${h.overlay ?? ""}」`,
    `- rule: ${d.rule ?? ""}`,
    `- escalations: ${(d.escalations ?? []).map((x, i) => `${i + 1}) ${x}`).join(" ")}`,
    `- turn: ${d.turn ?? ""}`, `- payoff: ${d.payoff ?? ""}`, `- button: ${d.button ?? ""}${d.loop ? "（ループ）" : ""}`,
    `- duration: ${dur.toFixed(1)}s`, "",
    "| 秒 | role | shot | セリフ |", "|---|---|---|---|", ...rows, "",
    `## Errors (${E.length})`, ...E.map((x) => `- ${x}`), "", `## Warnings (${W.length})`, ...W.map((x) => `- ${x}`), "",
    "構造チェックの合格は編集上の合格ではない。面白いかどうかは人が観て決める。"
  ].join("\n");
  return { errors: E, warnings: W, report };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const id = process.argv[2];
  if (!id || !/^[A-Za-z0-9._-]+$/.test(id)) throw new Error("usage: design-lint.mjs <production>");
  const prod = JSON.parse(await readFile(join(root, "productions", id, "scene3d.json"), "utf8"));
  const compiled = compile(prod, (l) => estimateVoice(l.text, prod.voices?.[l.who]?.speed ?? 1.1));
  const r = lintDesign(prod, compiled, await loadFormats());
  console.log(r.report);
  process.exit(r.errors.length ? 1 : 0);
}

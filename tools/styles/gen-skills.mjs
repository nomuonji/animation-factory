#!/usr/bin/env node
/**
 * Generates .claude/skills/style-<id>/SKILL.md for every style in catalog/styles.json.
 * Edit the catalog (look / fits / recipe / sets / cast / avoid), then run:
 *   node tools/styles/gen-skills.mjs
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const { styles } = JSON.parse(readFileSync(join(root, "catalog", "styles.json"), "utf8"));

const example = (s) => {
  const stage = { scene: "stage", actors: [{ id: "a", x: 0, pose: [["start", "idle"], ["line+0.5", "think"]], face: "smug", emote: [["line+1", "?"]] }] };
  const second = s.best.includes("chart") ? { scene: "chart", type: "bar", label: "比較", unit: "日", bars: [{ label: "A", value: 120 }, { label: "B", value: 30 }] }
    : s.best.includes("route") ? { scene: "route", text: "出発", label: "到着", eta: "徒歩 9分" }
    : s.best.includes("exploded") ? { scene: "exploded", object: "phone", title: "中身（模式図）", layers: [{ label: "ガラス" }, { label: "画面" }, { label: "基板" }, { label: "電池" }] }
    : s.best.includes("diagram") ? { scene: "diagram", nodes: [{ id: "a", icon: "person", label: "あなた", x: -0.5, y: 0.4 }, { id: "b", icon: "house", label: "お店", x: 0.5, y: -0.3 }], edges: [{ from: "a", to: "b", label: "払う" }] }
    : s.best.includes("path") ? { scene: "path", shape: "wander", text: "道はまっすぐじゃない" }
    : { scene: "counter", from: 0, to: 384400, unit: "km", label: "地球 → 月", icon: "moon" };
  const first = s.best[0] === "stage" ? stage : second;
  return JSON.stringify({
    meta: { id: "my-topic", title: "タイトル" }, style: s.id,
    design: { title: "動画タイトル（疑問形か意外な数字）", hook: { overlay: "短いフック" } },
    sources: ["数字を使うなら出典"],
    beats: [
      { id: "hook", role: "hook", line: { who: "n", text: "最初の一言で／問いを立てる" }, visual: first },
      { id: "answer", line: { who: "n", text: "答えや数字を／ひとつだけ" }, visual: first === stage ? second : { scene: "card", text: "答え", sub: "補足" } },
      { id: "payoff", role: "payoff", line: { who: "n", text: "最後に／回収する一言" }, visual: s.best.includes("stage") ? { scene: "stage", actors: [{ id: "a", pose: "cheer", face: "laugh" }] } : { scene: "card", text: "結論" } }
    ]
  }, null, 2);
};

for (const s of styles) {
  const dir = join(root, ".claude", "skills", `style-${s.id}`);
  mkdirSync(dir, { recursive: true });
  const md = `---
name: style-${s.id}
description: 「${s.name}」画風のショート動画をトピックから作る（animation-factory Style Shorts）。${s.fits}。ユーザーが「${s.name}で」「${s.name}風の動画」と言ったとき、またはこの見た目が合う題材のときに使う。
---

# ${s.name}（\`${s.id}\`）

全体の手順は \`docs/style-shorts-playbook.md\`、判断の理由と見るべき所は \`docs/agent-video-craft.md\`、データ仕様は \`docs/style-shorts.md\`。このファイルは「${s.name}」固有の作り方だけを書く（普通の Markdown なので、どのエージェントもそのまま読んで使える）。

## 見た目
${s.look}

- エンジン: ${s.engine === "3d" ? "3D（three.js、1フレーム約0.5〜0.9秒）" : "2D（Canvas、1フレーム約30ms）"}
- 得意なシーン: ${s.best.map((b) => `\`${b}\``).join(" ")}
- 既定BGM: \`${s.music}\`${s.sceneSfx ? ` / シーン切替音: \`${s.sceneSfx}\`` : " / シーン切替音なし"}

## 合う題材
${s.fits}

## 構成の型
${s.recipe}

## セット
${s.sets}

## 人物・小道具
${s.cast}

## やらないこと
${s.avoid}

## 雛形

\`\`\`json
${example(s)}
\`\`\`

## 確認

\`\`\`bash
node tools/styles/render-style.mjs <id> --stills auto --scale 0.5   # シーンごとの静止画を見る
node tools/styles/render-style.mjs <id> --inspect --scale 0.5      # はみ出し・重なり・小さい文字・コントラスト・スマホUIの位置（error は必ず直す）
node tools/styles/render-style.mjs <id>                            # 本番（VOICEVOX が必要。無ければ Actions「Style Shorts」）
node tools/styles/qa.mjs <id>
\`\`\`

他の画風と見比べたいときは \`node tools/styles/gallery.mjs <id> --styles ${s.id},<別のid>\`。
`;
  writeFileSync(join(dir, "SKILL.md"), md);
}
console.log(`generated ${styles.length} skills in .claude/skills/style-*`);

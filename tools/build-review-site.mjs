import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import process from "node:process";

const artifactsRoot = process.argv[2];
const siteRoot = process.argv[3];

if (!artifactsRoot || !siteRoot) {
  console.error("Usage: node tools/build-review-site.mjs <artifacts-dir> <site-dir>");
  process.exit(2);
}

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const safeSegment = (value) => {
  const normalized = String(value ?? "").trim();
  if (!/^[A-Za-z0-9._-]+$/.test(normalized)) {
    throw new Error(`Unsafe review path segment: ${normalized}`);
  }
  return normalized;
};

async function findFile(dir, predicate) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = await findFile(path, predicate);
      if (nested) return nested;
    } else if (predicate(entry.name)) {
      return path;
    }
  }
  return null;
}

async function readJsonMaybe(path) {
  if (!path) return null;
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return null;
  }
}

function formatDate(value) {
  if (!value) return "unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, " UTC");
}

const css = `
:root{color-scheme:dark;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#090b10;color:#eef1f6}
*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 75% 0,#18213a 0,transparent 35rem),#090b10;color:#eef1f6}
a{color:inherit}.wrap{width:min(1180px,calc(100% - 32px));margin:0 auto;padding:38px 0 64px}.eyebrow{font:700 11px/1.2 ui-monospace,monospace;letter-spacing:.18em;color:#8fa8ed}
h1{font-size:clamp(34px,6vw,72px);letter-spacing:-.055em;line-height:.95;margin:10px 0 12px}.lede{color:#9da7b9;max-width:720px;font-size:15px;line-height:1.65}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px;margin-top:32px}.card{display:block;text-decoration:none;border:1px solid #29303d;background:rgba(18,22,31,.88);border-radius:15px;padding:18px;transition:.15s transform,.15s border-color}.card:hover{transform:translateY(-2px);border-color:#53678f}.card h2{font-size:18px;margin:10px 0 8px}.muted{color:#8d97aa}.meta{display:flex;flex-wrap:wrap;gap:7px;margin-top:14px}.badge{font:600 11px/1 ui-monospace,monospace;border:1px solid #313a49;border-radius:999px;padding:7px 9px;color:#b9c5dc}.topbar{display:flex;justify-content:space-between;gap:20px;align-items:center;margin-bottom:28px}.back{color:#a8b6d4;text-decoration:none}.video-shell{display:grid;grid-template-columns:minmax(0,420px) 1fr;gap:26px;align-items:start}.video-shell video{width:100%;aspect-ratio:9/16;background:#000;border:1px solid #303848;border-radius:16px}.panel{border:1px solid #29303d;background:#11151e;border-radius:15px;padding:20px}.panel h2{margin:0 0 12px}.sheet{width:100%;border-radius:10px;border:1px solid #29303d;margin-top:12px}.actions{display:flex;flex-wrap:wrap;gap:9px;margin-top:18px}.button{display:inline-block;text-decoration:none;border:1px solid #38445a;background:#171d29;padding:10px 12px;border-radius:9px;font-weight:700;font-size:13px}.json{margin-top:24px}.json pre{overflow:auto;white-space:pre-wrap;background:#07090e;border:1px solid #242b37;padding:16px;border-radius:12px;color:#bec8dc;font:12px/1.55 ui-monospace,monospace}
.empty{margin-top:30px;border:1px dashed #354056;padding:24px;border-radius:14px;color:#9ca8bc}
@media(max-width:760px){.video-shell{grid-template-columns:1fr}.video-shell video{max-height:72vh}.wrap{width:min(100% - 22px,1180px);padding-top:24px}}
`;

await rm(siteRoot, { recursive: true, force: true });
await mkdir(join(siteRoot, "review"), { recursive: true });

const artifactDirs = (await readdir(artifactsRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

const reviews = [];

for (const dirName of artifactDirs) {
  const dir = join(artifactsRoot, dirName);
  const metadataPath = await findFile(dir, (name) => name === "metadata.json");
  const productionPath = await findFile(dir, (name) => name === "production.json");
  const videoPath = await findFile(dir, (name) => name.endsWith(".mp4"));
  const sheetPath = await findFile(dir, (name) => name === "contact-sheet.jpg");

  if (!videoPath) continue;

  const metadata = (await readJsonMaybe(metadataPath)) ?? {};
  const production = (await readJsonMaybe(productionPath)) ?? {};
  const folder = safeSegment(metadata.productionFolder ?? dirName);
  const detailDir = join(siteRoot, "review", folder);
  await mkdir(detailDir, { recursive: true });

  await cp(videoPath, join(detailDir, "video.mp4"));
  if (sheetPath) await cp(sheetPath, join(detailDir, "contact-sheet.jpg"));
  if (productionPath) await cp(productionPath, join(detailDir, "production.json"));
  if (metadataPath) await cp(metadataPath, join(detailDir, "metadata.json"));

  const title = metadata.title ?? production.meta?.title ?? folder;
  const description = metadata.description ?? production.meta?.description ?? "";
  const duration = metadata.duration ?? production.meta?.duration ?? null;
  const commitSha = metadata.commitSha ?? null;
  const repository = metadata.repository ?? null;
  const runId = metadata.runId ?? null;
  const renderedAt = metadata.renderedAt ?? null;
  const eventKinds = [
    ...new Set((production.events ?? []).map((event) => event.kind))
  ].sort();

  reviews.push({
    folder,
    title,
    description,
    duration,
    commitSha,
    repository,
    runId,
    renderedAt,
    eventKinds,
    hasAudio: metadata.hasAudio ?? Boolean(production.audio),
    production
  });

  const repoUrl = repository ? `https://github.com/${repository}` : null;
  const commitUrl = repoUrl && commitSha ? `${repoUrl}/commit/${commitSha}` : null;
  const runUrl = repoUrl && runId ? `${repoUrl}/actions/runs/${runId}` : null;
  const shortSha = commitSha ? commitSha.slice(0, 8) : "unknown";

  const detailHtml = `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)} · Animation Factory Review</title><style>${css}</style></head>
<body><main class="wrap">
<div class="topbar"><a class="back" href="../">← Review Gallery</a><span class="eyebrow">ANIMATION FACTORY REVIEW</span></div>
<div class="video-shell">
  <video controls playsinline preload="metadata" src="./video.mp4"></video>
  <section class="panel">
    <div class="eyebrow">${escapeHtml(folder)}</div>
    <h1 style="font-size:clamp(30px,5vw,56px)">${escapeHtml(title)}</h1>
    <p class="lede">${escapeHtml(description || "Rendered production review.")}</p>
    <div class="meta">
      ${duration != null ? `<span class="badge">${escapeHtml(duration)}s</span>` : ""}
      <span class="badge">${escapeHtml(shortSha)}</span>
      <span class="badge">${metadata.hasAudio ?? Boolean(production.audio) ? "audio" : "silent"}</span>
      <span class="badge">${escapeHtml(formatDate(renderedAt))}</span>
    </div>
    <div class="actions">
      <a class="button" href="./video.mp4">Open MP4</a>
      ${productionPath ? '<a class="button" href="./production.json">production.json</a>' : ""}
      ${commitUrl ? `<a class="button" href="${escapeHtml(commitUrl)}">Commit</a>` : ""}
      ${runUrl ? `<a class="button" href="${escapeHtml(runUrl)}">Workflow run</a>` : ""}
    </div>
    ${eventKinds.length ? `<h2 style="margin-top:24px">Components used</h2><div class="meta">${eventKinds.map((kind) => `<span class="badge">${escapeHtml(kind)}</span>`).join("")}</div>` : ""}
    ${sheetPath ? '<h2 style="margin-top:24px">Contact sheet</h2><img class="sheet" src="./contact-sheet.jpg" alt="Contact sheet">' : ""}
  </section>
</div>
${productionPath ? `<details class="json"><summary>Production definition</summary><pre>${escapeHtml(JSON.stringify(production, null, 2))}</pre></details>` : ""}
</main></body></html>`;

  await writeFile(join(detailDir, "index.html"), detailHtml, "utf8");
}

reviews.sort((a, b) => {
  const at = a.renderedAt ? new Date(a.renderedAt).getTime() : 0;
  const bt = b.renderedAt ? new Date(b.renderedAt).getTime() : 0;
  return bt - at || a.title.localeCompare(b.title);
});

const gallery = reviews.length
  ? `<div class="grid">${reviews.map((review) => `
<a class="card" href="./${encodeURIComponent(review.folder)}/">
  <div class="eyebrow">${escapeHtml(review.folder)}</div>
  <h2>${escapeHtml(review.title)}</h2>
  <p class="muted">${escapeHtml(review.description || "Rendered production review.")}</p>
  <div class="meta">
    ${review.duration != null ? `<span class="badge">${escapeHtml(review.duration)}s</span>` : ""}
    <span class="badge">${review.hasAudio ? "audio" : "silent"}</span>
    <span class="badge">${escapeHtml(review.commitSha?.slice(0, 8) ?? "unknown")}</span>
  </div>
</a>`).join("")}</div>`
  : '<div class="empty">No live render artifacts are available yet. Run the “Render production” workflow first.</div>';

const galleryHtml = `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Animation Factory · Review Gallery</title><style>${css}</style></head>
<body><main class="wrap">
<div class="eyebrow">ANIMATION FACTORY</div>
<h1>Review Gallery</h1>
<p class="lede">Latest successful rendered video for each production. Open a production to watch the final MP4, inspect its contact sheet, production definition, render commit and workflow run.</p>
${gallery}
</main></body></html>`;

await writeFile(join(siteRoot, "review", "index.html"), galleryHtml, "utf8");
await writeFile(
  join(siteRoot, "index.html"),
  '<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=./review/"><title>Animation Factory Review</title></head><body><a href="./review/">Open Review Gallery</a></body></html>',
  "utf8"
);

console.log(`Built ${reviews.length} review page(s) at ${siteRoot}`);

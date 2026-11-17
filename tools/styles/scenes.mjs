/**
 * Style Shorts: beat visuals -> absolute scenes, plus the editorial/technical lint.
 *
 * A beat's `visual` starts a new scene. A beat without `visual`, or with `"continue": true`,
 * keeps the previous scene running (actors stay where they ended; keys you give override).
 */
const KINDS = new Set(["stage", "chart", "counter", "diagram", "card", "list", "path", "route", "exploded", "quote"]);

const finalOf = (v) => (Array.isArray(v) ? v.at(-1)?.[1] : v);

function settleActor(a) {
  const x = a.to?.x ?? a.x ?? a.x0 ?? 0, y = a.to?.y ?? a.y ?? a.y0 ?? 0, z = a.to?.z ?? a.z ?? a.z0 ?? 0;
  const { to, emote, ...rest } = a;
  void to; void emote;
  return { ...rest, x, y, z, x0: x, y0: y, z0: z, pose: finalOf(a.pose), face: finalOf(a.face) };
}
function settleProp(p) {
  const { to, at, ...rest } = p;
  void at;
  return { ...rest, x: to?.x ?? p.x, y: to?.y ?? p.y, z: to?.z ?? p.z, scale: to?.scale ?? p.scale, rot: to?.rot ?? p.rot };
}

export function resolveScenes(prod, beats) {
  const out = [];
  let prev = null;
  prod.beats.forEach((b, i) => {
    const bt = beats[i];
    let v;
    const own = b.visual ? { ...b.visual } : null;
    if (prev && (!own || own.continue)) {
      v = { ...prev, continued: true, transition: "cut" };
      const byId = new Map((prev.actors ?? []).map((a) => [a.id, settleActor(a)]));
      for (const a of own?.actors ?? []) byId.set(a.id, { ...(byId.get(a.id) ?? {}), ...a, x0: byId.get(a.id)?.x0 ?? a.x, y0: byId.get(a.id)?.y0 ?? a.y, z0: byId.get(a.id)?.z0 ?? a.z });
      if (own?.drop) for (const d of own.drop) byId.delete(d);
      v.actors = [...byId.values()];
      v.props = [...(prev.props ?? []).map(settleProp), ...(own?.props ?? [])];
      if (prev.camera) v.camera = { ...prev.camera, zoom: prev.camera.to?.zoom ?? prev.camera.zoom, x: prev.camera.to?.x ?? prev.camera.x, y: prev.camera.to?.y ?? prev.camera.y, to: undefined, shake: 0 };
      for (const [k, val] of Object.entries(own ?? {})) if (!["actors", "props", "continue", "drop"].includes(k)) v[k] = val;
    } else {
      v = own ?? { scene: "card", text: prod.design?.title ?? "" };
      v.actors = (v.actors ?? []).map((a) => ({ ...a, x0: a.x, y0: a.y, z0: a.z }));
      v.continued = false;
    }
    v.start = bt.start; v.end = bt.end;
    v.lineStart = Number.isFinite(bt.lineStart) ? bt.lineStart : null;
    v.lineEnd = Number.isFinite(bt.lineEnd) ? bt.lineEnd : null;
    v.index = i;
    v.beat = bt.id;
    delete v.continue;
    out.push(v);
    prev = v;
  });
  return out;
}

export function lintStyled(prod, compiled, scenes, style) {
  const errors = [], warnings = [];
  const dur = compiled.timeline.meta.duration;
  if (!prod.beats?.length) errors.push("beats が空");
  if (!prod.beats?.[0]?.visual) errors.push("最初の beat に visual がない（1フレーム目が決まらない）");
  for (const s of scenes) {
    if (!KINDS.has(s.scene)) errors.push(`beat ${s.beat}: 未知の scene "${s.scene}"（${[...KINDS].join(" / ")}）`);
    for (const a of s.actors ?? []) if (!a.id) errors.push(`beat ${s.beat}: actor に id がない`);
    if (s.scene === "chart" && !(s.points?.length > 1 || s.bars?.length)) errors.push(`beat ${s.beat}: chart に points（2点以上）か bars が必要`);
    if (s.scene === "diagram" && !s.nodes?.length) errors.push(`beat ${s.beat}: diagram に nodes が必要`);
    if (s.scene === "list" && !s.items?.length) errors.push(`beat ${s.beat}: list に items が必要`);
    if (s.end - s.start > 7) warnings.push(`beat ${s.beat}: 同じ画が ${(s.end - s.start).toFixed(1)}s 続く（Shortsでは6s以内に画を変える）`);
  }
  const first = compiled.timeline.lines[0];
  if (first && first.start > 0.6) warnings.push(`最初の声が ${first.start.toFixed(2)}s から。冒頭の無音を詰める`);
  if (dur < 15) warnings.push(`尺 ${dur.toFixed(1)}s は短い（目安 20〜58s）`);
  if (dur > 59) errors.push(`尺 ${dur.toFixed(1)}s は Shorts の 60s を超える`);
  for (const b of prod.beats) if (b.line) for (const ch of b.line.text.split("／")) if ([...ch].length > 26) warnings.push(`字幕チャンクが長い（${[...ch].length}字）: 「${ch.slice(0, 20)}…」 ／ で区切る`);
  if (!prod.design?.title) warnings.push("design.title がない（タイトル・説明文に使う）");
  if (!prod.sources?.length && scenes.some((s) => ["chart", "counter"].includes(s.scene))) warnings.push("数字を出しているのに sources（出典）がない。数字は出典を確認してから使う");
  const report = [
    `# style lint — ${prod.meta?.id} (${style})`, "",
    `- 尺: ${dur.toFixed(1)}s / シーン ${scenes.length} / 新しい画 ${scenes.filter((s) => !s.continued).length}`,
    `- 最初の声: ${first ? first.start.toFixed(2) + "s" : "なし"}`,
    "", "## errors", ...(errors.length ? errors.map((e) => `- ${e}`) : ["- なし"]),
    "", "## warnings", ...(warnings.length ? warnings.map((e) => `- ${e}`) : ["- なし"]),
    "", "技術チェックのみ。面白さ・正確さは人が見て判断する。"
  ].join("\n") + "\n";
  return { errors, warnings, report };
}

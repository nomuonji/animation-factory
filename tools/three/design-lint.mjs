#!/usr/bin/env node
/**
 * Short-drama meta-design check for productions/<id>/scene3d.json.
 * Structure only: it cannot tell whether a joke is funny. Passing it is a
 * precondition for spending render time, not an editorial approval.
 *
 *   node tools/three/design-lint.mjs <id>     (estimated voice timing)
 */
import { readFile } from "node:fs/promises";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { compile, estimateVoice } from "./compile.mjs";

const root = fileURLToPath(new URL("../..", import.meta.url));
const chars = (s) => [...String(s ?? "")].length;

export async function loadFormats() {
  return JSON.parse(await readFile(join(root, "catalog", "skit-formats.json"), "utf8"));
}

/** Other productions' payoff mechanisms, to stop the same twist being reused back to back. */
function otherMechanisms(selfId) {
  const dir = join(root, "productions"), out = [];
  for (const id of readdirSync(dir)) {
    const f = join(dir, id, "scene3d.json");
    if (id === selfId || !existsSync(f)) continue;
    try { const m = JSON.parse(readFileSync(f, "utf8")).design?.payoffMechanism; if (m) out.push({ id, m }); } catch { /* ignore */ }
  }
  return out;
}


/**
 * Fail-closed provenance gate for new 3D skits.
 * Source text stays in My Portal; the public production record stores only IDs
 * and abstracted mechanisms, not copied Radichichi answers.
 */
export function validateIdeationEvidence(ideation) {
  const errors = [];
  if (ideation?.gateVersion !== 2)
    errors.push("新規3Dコントは design.ideation.gateVersion=2 が必須");
  const c = ideation?.corpus ?? {};
  if (!ideation?.method || !/creative-thinking/i.test(ideation.method))
    errors.push("design.ideation.method は My Portal creative-thinking を明記する");
  if (ideation?.candidates < 15)
    errors.push("design.ideation.candidates は新規15案以上");
  if (!Array.isArray(ideation?.rejected) || ideation.rejected.length < 2)
    errors.push("design.ideation.rejected は却下理由つきで2案以上");
  if (c.dataset !== "radichichi")
    errors.push("design.ideation.corpus.dataset は radichichi");
  if (!c.datasetVersion)
    errors.push("design.ideation.corpus.datasetVersion がない");
  if (!c.retrievedAt)
    errors.push("design.ideation.corpus.retrievedAt（実検索日時）がない");
  const queries = Array.isArray(c.queryLog) ? c.queryLog : [];
  if (new Set(queries.map((x) => String(x?.query ?? "").trim()).filter(Boolean)).size < 2)
    errors.push("design.ideation.corpus.queryLog に異なる実検索クエリが2つ以上必要");
  const chunks = Array.isArray(c.sourceChunks) ? c.sourceChunks : [];
  if (chunks.length < 3)
    errors.push("design.ideation.corpus.sourceChunks は3チャンク以上必要");
  for (const [i, x] of chunks.entries()) {
    if (!x?.id) errors.push(`sourceChunks[${i}].id がない`);
    if (x?.dataset !== "radichichi") errors.push(`sourceChunks[${i}] の dataset が radichichi ではない`);
    if (x?.retrievalTier !== "creative") errors.push(`sourceChunks[${i}] は retrievalTier=creative ではない`);
    if (x?.role !== "ogiri_reference") errors.push(`sourceChunks[${i}] は role=ogiri_reference ではない`);
  }
  const chunkIds = new Set(chunks.map((x) => x?.id).filter(Boolean));
  const declaredChunkIds = Array.isArray(c.sourceChunkIds) ? c.sourceChunkIds : [];
  if (new Set(declaredChunkIds).size !== declaredChunkIds.length || declaredChunkIds.length < 3 || declaredChunkIds.some((id) => !chunkIds.has(id)))
    errors.push("design.ideation.corpus.sourceChunkIds は sourceChunks と一致する3件以上が必要");
  for (const q of queries) {
    if (!Array.isArray(q?.resultChunkIds) || !q.resultChunkIds.some((id) => chunkIds.has(id)))
      errors.push(`queryLog「${q?.query ?? "?"}」に取得済みsourceChunkIdsが紐づいていない`);
  }
  const exampleIds = Array.isArray(c.sourceExampleIds) ? c.sourceExampleIds : [];
  if (new Set(exampleIds).size < 5 || exampleIds.some((id) => !/^radichichi-\d+$/.test(String(id))))
    errors.push("design.ideation.corpus.sourceExampleIds は実例IDを重複なしで5件以上");
  const mechanisms = Array.isArray(ideation?.mechanisms) ? ideation.mechanisms : [];
  if (mechanisms.length < 3)
    errors.push("design.ideation.mechanisms は3種類以上必要");
  const mechanismIds = new Set(mechanisms.map((x) => x?.id).filter(Boolean));
  if (mechanismIds.size < 3) errors.push("design.ideation.mechanisms は重複しない3種類以上必要");
  for (const [i, m] of mechanisms.entries()) {
    if (!m?.abstractOperation) errors.push(`mechanisms[${i}].abstractOperation がない`);
    if (!m?.transfer) errors.push(`mechanisms[${i}].transfer がない`);
    if (!Array.isArray(m?.sourceExampleIds) || !m.sourceExampleIds.some((id) => exampleIds.includes(id)))
      errors.push(`mechanisms[${i}] に実際に取得したsourceExampleIdsが結びついていない`);
  }
  const candidates = Array.isArray(ideation?.candidateLog) ? ideation.candidateLog : [];
  if (candidates.length < 15 || candidates.length !== ideation?.candidates)
    errors.push("design.ideation.candidateLog は candidates と件数が一致する新規15案以上の全数記録が必要");
  const candidateIds = new Set(candidates.map((x) => x?.id).filter(Boolean));
  if (candidateIds.size !== candidates.length) errors.push("candidateLog の候補IDはすべて一意でなければならない");
  for (const [i, x] of candidates.entries()) {
    if (!x?.id || !x?.concept) errors.push(`candidateLog[${i}] にid/conceptがない`);
    if (!mechanismIds.has(x?.mechanism)) errors.push(`candidateLog[${i}] のmechanismが定義済み3系統にない`);
    if (!/^[a-z0-9][a-z0-9-]{1,47}$/.test(String(x?.mechanismFamily ?? "")))
      errors.push(`candidateLog[${i}].mechanismFamily は自由記述の一意なslugが必要`);
    if (String(x?.causalCore ?? "").trim().length < 12)
      errors.push(`candidateLog[${i}].causalCore は舞台・人物を除いた因果構造を12字以上で記述する`);
    if (!["shortlisted", "selected", "rejected", "other"].includes(x?.status))
      errors.push(`candidateLog[${i}] のstatusが不正`);
    if (x?.status === "rejected" && !x?.reason) errors.push(`candidateLog[${i}] の却下理由がない`);
  }
  if (candidates.filter((x) => x?.status === "rejected").length < 2)
    errors.push("candidateLog に却下理由つき候補が2案以上必要");

  const userSeeds = Array.isArray(ideation?.userSeeds) ? ideation.userSeeds : [];
  for (const [i, seed] of userSeeds.entries()) {
    if (seed?.platform !== "x") errors.push(`userSeeds[${i}].platform は x が必要`);
    if (!/^x_\d+$/.test(String(seed?.sourcePostId ?? "")))
      errors.push(`userSeeds[${i}].sourcePostId は My Portal social_posts の正確な x_投稿ID が必要`);
    if (String(seed?.transformation ?? "").trim().length < 20)
      errors.push(`userSeeds[${i}].transformation は投稿の核から今回の案への転用を20字以上で記述する`);
    if (seed?.reusedVerbatim !== false)
      errors.push(`userSeeds[${i}].reusedVerbatim は false（原文の転載・置換コピー禁止）`);
  }

  const shortlist = Array.isArray(ideation?.shortlist) ? ideation.shortlist : [];
  if (shortlist.length !== 3 || new Set(shortlist).size !== 3 || shortlist.some((id) => !candidateIds.has(id)))
    errors.push("design.ideation.shortlist は候補ログに存在する重複なしの3案ちょうどでなければならない");
  if (!candidateIds.has(ideation?.selectedCandidateId) || !shortlist.includes(ideation?.selectedCandidateId))
    errors.push("selectedCandidateId は提示したshortlistから選ばれた候補IDでなければならない");
  const selected = candidates.find((x) => x?.id === ideation?.selectedCandidateId);
  if (selected?.status !== "selected")
    errors.push("selectedCandidateId の候補statusは selected");
  if (!["user", "delegated"].includes(ideation?.selectionAuthority))
    errors.push("selectionAuthority は user または明示委任時の delegated");

  // Structural diversity: labels are free-form diagnostics, never a fixed idea-generation taxonomy.
  const familyCounts = new Map();
  const causalCores = new Map();
  for (const x of candidates) {
    const family = String(x?.mechanismFamily ?? "");
    familyCounts.set(family, (familyCounts.get(family) ?? 0) + 1);
    const core = String(x?.causalCore ?? "").trim().toLocaleLowerCase("ja");
    if (core) causalCores.set(core, (causalCores.get(core) ?? 0) + 1);
  }
  if (familyCounts.size < 4)
    errors.push("candidateLog は固定分類表ではなく自由記述のmechanismFamilyを4系統以上含める");
  const familyLimit = Math.floor(candidates.length * 0.4);
  if ([...familyCounts.values()].some((count) => count > familyLimit))
    errors.push("candidateLog の最大mechanismFamilyが全候補の40%を超えている（同じ発想構造への偏り）");
  if ([...causalCores.values()].some((count) => count > 1))
    errors.push("candidateLog に同一causalCoreの重複がある");

  const audit = ideation?.diversityAudit ?? {};
  if (audit.mode !== "blind-reclassification")
    errors.push("diversityAudit.mode はラベルを隠した blind-reclassification が必須");
  if (audit.verdict !== "pass")
    errors.push("diversityAudit.verdict は別工程の批評パス完了後の pass が必須");
  if (String(audit.summary ?? "").trim().length < 30)
    errors.push("diversityAudit.summary に批評結果の具体的な要約が必要");
  const reviewedIds = Array.isArray(audit.reviewedCandidateIds) ? audit.reviewedCandidateIds : [];
  if (new Set(reviewedIds).size !== candidateIds.size || candidateIds.size !== reviewedIds.length || reviewedIds.some((id) => !candidateIds.has(id)))
    errors.push("diversityAudit.reviewedCandidateIds は15案以上のcandidateLog全件と一致する必要がある");
  const assignments = Array.isArray(audit.familyAssignments) ? audit.familyAssignments : [];
  const blindMap = new Map();
  for (const x of assignments) {
    if (!x?.candidateId || !candidateIds.has(x.candidateId) || !x?.familyId || blindMap.has(x.candidateId))
      errors.push("diversityAudit.familyAssignments は全候補に一意なcandidateId/familyIdを割り当てる");
    else blindMap.set(x.candidateId, x.familyId);
  }
  if (blindMap.size !== candidateIds.size || [...candidateIds].some((id) => !blindMap.has(id)))
    errors.push("diversityAudit.familyAssignments がcandidateLog全件を再分類していない");
  for (const x of candidates) {
    if (blindMap.has(x.id) && blindMap.get(x.id) !== x.mechanismFamily)
      errors.push(`候補 ${x.id} の生成時mechanismFamilyと盲検再分類が一致しない。ラベルだけでなく案を再評価する`);
  }
  const blindCounts = new Map();
  for (const family of blindMap.values()) blindCounts.set(family, (blindCounts.get(family) ?? 0) + 1);
  if (blindCounts.size < 4)
    errors.push("blind-reclassification の結果は4つ以上の因果機序に分かれている必要がある");
  if ([...blindCounts.values()].some((count) => count > familyLimit))
    errors.push("blind-reclassification で同一因果機序が候補全体の40%を超えている");

  const definitions = Array.isArray(audit.familyDefinitions) ? audit.familyDefinitions : [];
  const definitionIds = new Set(definitions.map((x) => x?.id).filter(Boolean));
  if (definitionIds.size !== blindCounts.size || [...blindCounts.keys()].some((id) => !definitionIds.has(id)) ||
      definitions.some((x) => String(x?.definingMove ?? "").trim().length < 15))
    errors.push("diversityAudit.familyDefinitions は盲検分類の全系統について固有の因果機序を記述する");

  const shortlistFamilies = shortlist.map((id) => blindMap.get(id));
  if (new Set(shortlistFamilies).size !== 3 || shortlistFamilies.some((x) => !x))
    errors.push("shortlistの3案は盲検再分類後も3つの異なる発想構造でなければならない");
  const expectedPairs = new Set();
  for (let i = 0; i < shortlist.length; i++) for (let j = i + 1; j < shortlist.length; j++)
    expectedPairs.add([shortlist[i], shortlist[j]].sort().join("::"));
  const pairChecks = Array.isArray(audit.shortlistPairChecks) ? audit.shortlistPairChecks : [];
  const seenPairs = new Set();
  for (const pair of pairChecks) {
    const key = [pair?.candidateA, pair?.candidateB].sort().join("::");
    if (!expectedPairs.has(key) || seenPairs.has(key))
      errors.push("diversityAudit.shortlistPairChecks はshortlistの3組を重複なく比較する");
    seenPairs.add(key);
    if (pair?.sameCausalStructure !== false || pair?.notOnlySettingChange !== true ||
        String(pair?.difference ?? "").trim().length < 20)
      errors.push("shortlistPairChecks は因果構造が異なり、設定差だけでない具体的な違いを説明する");
  }
  if (seenPairs.size !== 3 || pairChecks.length !== 3)
    errors.push("diversityAudit.shortlistPairChecks はshortlistの全3ペアが必須");
  return [...new Set(errors)];
}


/**
 * Required editorial evidence for a new 3D skit.
 * This validates that a hostile comedy review was documented; it cannot
 * determine whether the premise or punchline is actually funny.
 */
export function validateComedyAudit(audit, beatIds = []) {
  const errors = [];
  const requireText = (key, min = 16) => {
    if (String(audit?.[key] ?? "").trim().length < min)
      errors.push(`design.comedyAudit.${key} は具体的に${min}字以上で記述する`);
  };
  requireText("comicKernel", 18);
  requireText("audienceExpectation", 16);
  requireText("characterIntent", 16);
  requireText("pressure", 12);
  requireText("payoffCausality", 20);

  const knownBeatIds = new Set(beatIds.filter(Boolean));
  const escalations = Array.isArray(audit?.escalations) ? audit.escalations : [];
  if (escalations.length < 2)
    errors.push("design.comedyAudit.escalations は状況の変化を示す2段以上が必要");
  const escalationIds = new Set();
  for (const [i, item] of escalations.entries()) {
    if (!item?.beatId || !knownBeatIds.has(item.beatId))
      errors.push(`comedyAudit.escalations[${i}].beatId は実際のbeat IDを指定する`);
    if (item?.beatId && escalationIds.has(item.beatId))
      errors.push(`comedyAudit.escalations[${i}] は異なるbeatを指定する（同じ場面の言い換えを段数に数えない）`);
    if (item?.beatId) escalationIds.add(item.beatId);
    if (String(item?.change ?? "").trim().length < 14)
      errors.push(`comedyAudit.escalations[${i}].change は何が変わるか14字以上で記述する`);
  }

  const laugh = audit?.laughMoment ?? {};
  if (!laugh.beatId || !knownBeatIds.has(laugh.beatId))
    errors.push("design.comedyAudit.laughMoment.beatId は実際のbeat IDを指定する");
  if (String(laugh.description ?? "").trim().length < 16)
    errors.push("design.comedyAudit.laughMoment.description は具体的な笑いの瞬間を16字以上で記述する");

  const review = audit?.independentReview ?? {};
  if (review.mode !== "hostile-reader")
    errors.push("design.comedyAudit.independentReview.mode は hostile-reader が必要");
  if (review.verdict !== "pass")
    errors.push("design.comedyAudit.independentReview.verdict は修正・却下を解消した pass が必要");
  if (String(review.summary ?? "").trim().length < 30)
    errors.push("independentReview.summary に台本を読み直した批評を30字以上で記述する");
  if (String(review.strongestObjection ?? "").trim().length < 16)
    errors.push("independentReview.strongestObjection に最も強い反論を16字以上で記述する");
  if (String(review.resolution ?? "").trim().length < 16)
    errors.push("independentReview.resolution に反論への回答または修正を16字以上で記述する");

  const checks = review.checks ?? {};
  const requiredChecks = [
    "premiseHasComicEngine",
    "notJustMundaneIncident",
    "payoffIsEarned",
    "characterCanonRespected",
    "noUnmotivatedAdditions",
    "notOnlyRoleReversal"
  ];
  for (const key of requiredChecks) {
    if (checks[key] !== true)
      errors.push(`independentReview.checks.${key} は批評で確認して true にする`);
  }
  return [...new Set(errors)];
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

  // --- reality: everything except the one broken rule must be true to life (2026-11-07 再発防止)
  const r = d.reality ?? {};
  if (!r.place) E.push("design.reality.place（どこで起きる話か）がない");
  if (!r.normalEvent) E.push("design.reality.normalEvent（その場所で現実に普通に起きる出来事）がない");
  if (!r.onlyBreak) E.push("design.reality.onlyBreak（現実から外す1点）がない");
  const setPlaces = catalog.setPlaces?.[prod.set?.kind];
  if (r.place && setPlaces && !setPlaces.some((k) => r.place.includes(k)))
    E.push(`セット「${prod.set.kind}」は「${r.place}」ではない（${setPlaces.join("/")}用）。場所に合うセットを作る。手持ちのセットに合わせて場所を変えない`);
  if (r.place && !setPlaces) E.push(`セット「${prod.set?.kind}」の対応場所が catalog/skit-formats.json の setPlaces にない`);

  // --- the twist itself: not a repeat of a recent payoff
  if (!d.payoffMechanism) E.push("design.payoffMechanism（オチの仕組みを短い英語のキーで。例: escape-route-also-procedure）がない");
  else for (const o of otherMechanisms(prod.meta.id)) if (o.m === d.payoffMechanism) W.push(`オチの仕組み「${d.payoffMechanism}」は ${o.id} と同じ。続けて出すなら別の仕組みにする`);
  if (d.ideation?.gateVersion === 2) {
    const ideationErrors = validateIdeationEvidence(d.ideation);
    E.push(...ideationErrors.map((message) => `ideation provenance: ${message}`));
    const comedyErrors = validateComedyAudit(d.comedyAudit, prod.beats?.map((beat) => beat.id) ?? []);
    E.push(...comedyErrors.map((message) => `comedy audit: ${message}`));
  } else {
    W.push("legacy production: unchanged existing works remain renderable; every new or modified scene3d.json must set ideation.gateVersion=2 (PR gate enforces provenance and structural diversity)");
  }
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
  if (L.targetDuration && d.format && (dur < L.targetDuration[0] || dur > L.targetDuration[1]))
    W.push(`尺 ${dur.toFixed(1)}s は 3Dコントの目安 ${L.targetDuration[0]}〜${L.targetDuration[1]}s の外（2026-11-07 本人指示）。段（escalate）を足す／削る`);
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
    `- reality: ${r.place ?? "?"} — 普通: ${r.normalEvent ?? "?"} / 外す1点: ${r.onlyBreak ?? "?"}`,
    `- payoff mechanism: ${d.payoffMechanism ?? "?"} / ideation: ${d.ideation?.method ?? "?"}（${d.ideation?.candidates ?? "?"}案）`,
    `- Radichichi evidence: ${d.ideation?.corpus?.sourceExampleIds?.length ?? 0} example IDs / ${d.ideation?.corpus?.sourceChunkIds?.length ?? 0} creative chunks / ${d.ideation?.mechanisms?.length ?? 0} mechanisms`,
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

import test from "node:test";
import assert from "node:assert/strict";
import { validateComedyAudit, validateIdeationEvidence } from "./design-lint.mjs";

function validIdeation() {
  const chunkIds = ["chunk-101", "chunk-102", "chunk-103"];
  const exampleIds = [
    "radichichi-101", "radichichi-102", "radichichi-103",
    "radichichi-104", "radichichi-105"
  ];
  const mechanismIds = ["rule-shift", "mundane-detail", "social-script"];
  const familyIds = [
    "quiet-physical-consequence",
    "misapplied-procedure",
    "literal-causal-chain",
    "character-consistency"
  ];
  const candidateLog = Array.from({ length: 15 }, (_, index) => {
    const id = `C${String(index + 1).padStart(2, "0")}`;
    const family = familyIds[Math.min(3, Math.floor(index / 4))];
    const status = [3, 7, 11].includes(index) ? (index === 11 ? "selected" : "shortlisted") : "rejected";
    return {
      id,
      mechanism: mechanismIds[index % mechanismIds.length],
      mechanismFamily: family,
      causalCore: `Distinct causal chain number ${index + 1} creates its own outcome.`,
      concept: `A fresh skit concept ${index + 1}`,
      status,
      ...(status === "rejected" ? { reason: "The premise is overdesigned." } : {})
    };
  });
  const shortlist = ["C04", "C08", "C12"];
  const pair = (candidateA, candidateB, difference) => ({
    candidateA, candidateB, sameCausalStructure: false,
    notOnlySettingChange: true, difference
  });
  return {
    gateVersion: 2,
    method: "creative-thinking (My Portal chat Skill)",
    candidates: 15,
    rejected: ["C01: overdesigned", "C02: too close to an existing skit"],
    corpus: {
      dataset: "radichichi",
      datasetVersion: "v1",
      retrievedAt: "2026-11-11T06:00:00Z",
      queryLog: [
        { query: "interview scene", resultChunkIds: [chunkIds[0], chunkIds[1]] },
        { query: "everyday role reversal", resultChunkIds: [chunkIds[2]] }
      ],
      sourceChunks: chunkIds.map((id) => ({
        id, dataset: "radichichi", retrievalTier: "creative", role: "ogiri_reference"
      })),
      sourceChunkIds: chunkIds,
      sourceExampleIds: exampleIds
    },
    mechanisms: [
      { id: mechanismIds[0], sourceExampleIds: [exampleIds[0], exampleIds[1]],
        abstractOperation: "Shift one operating rule without changing the setting.",
        transfer: "Apply it to a different everyday interaction." },
      { id: mechanismIds[1], sourceExampleIds: [exampleIds[2], exampleIds[3]],
        abstractOperation: "Use an ordinary procedural detail as the source of the turn.",
        transfer: "Move that detail to a new social situation." },
      { id: mechanismIds[2], sourceExampleIds: [exampleIds[4]],
        abstractOperation: "Corrupt one familiar conversational script.",
        transfer: "Reuse the mechanism with different roles and dialogue." }
    ],
    candidateLog,
    shortlist,
    selectedCandidateId: "C12",
    selectionAuthority: "user",
    diversityAudit: {
      mode: "blind-reclassification",
      verdict: "pass",
      summary: "All candidates were reread with generator labels hidden, and shortlist pairs differ in their causal moves.",
      reviewedCandidateIds: candidateLog.map((x) => x.id),
      familyAssignments: candidateLog.map((x) => ({
        candidateId: x.id, familyId: x.mechanismFamily
      })),
      familyDefinitions: familyIds.map((id) => ({
        id, definingMove: `This family uses a distinct causal move: ${id}.`
      })),
      shortlistPairChecks: [
        pair("C04", "C08", "One derives the outcome from a physical consequence; the other from a procedure applied in the wrong context."),
        pair("C04", "C12", "One relies on a visible physical consequence; the other depends on consistent character behavior over time."),
        pair("C08", "C12", "One turns on procedural misapplication; the other follows a character trait to a different logical endpoint.")
      ]
    }
  };
}

test("accepts complete provenance and genuinely diverse shortlist evidence", () => {
  assert.deepEqual(validateIdeationEvidence(validIdeation()), []);
});

test("blocks source chunks outside the creative ogiri corpus", () => {
  const ideation = validIdeation();
  ideation.corpus.sourceChunks[1].retrievalTier = "raw_context";
  assert.ok(validateIdeationEvidence(ideation).some((message) => message.includes("retrievalTier=creative")));
});

test("blocks a claimed candidate count without the full candidate log", () => {
  const ideation = validIdeation();
  ideation.candidateLog = ideation.candidateLog.slice(0, 5);
  assert.ok(validateIdeationEvidence(ideation).some((message) => message.includes("candidateLog")));
});

test("blocks a selected idea that was not in the displayed shortlist", () => {
  const ideation = validIdeation();
  ideation.selectedCandidateId = "C01";
  assert.ok(validateIdeationEvidence(ideation).some((message) => message.includes("shortlist")));
});

test("requires three distinct source mechanisms and unique source chunk IDs", () => {
  const ideation = validIdeation();
  ideation.mechanisms[2].id = ideation.mechanisms[1].id;
  ideation.corpus.sourceChunkIds[2] = ideation.corpus.sourceChunkIds[1];
  const errors = validateIdeationEvidence(ideation);
  assert.ok(errors.some((message) => message.includes("重複しない3種類")));
  assert.ok(errors.some((message) => message.includes("sourceChunkIds")));
});

test("blocks a new production that does not opt into gate version 2", () => {
  const ideation = validIdeation();
  delete ideation.gateVersion;
  assert.ok(validateIdeationEvidence(ideation).some((message) => message.includes("gateVersion=2")));
});

test("rejects shortlist candidates that collapse into the same blind family", () => {
  const ideation = validIdeation();
  ideation.candidateLog.find((x) => x.id === "C08").mechanismFamily = "quiet-physical-consequence";
  ideation.diversityAudit.familyAssignments.find((x) => x.candidateId === "C08").familyId = "quiet-physical-consequence";
  assert.ok(validateIdeationEvidence(ideation).some((message) => message.includes("shortlistの3案")));
});

test("rejects a pair whose only distinction is the setting", () => {
  const ideation = validIdeation();
  ideation.diversityAudit.shortlistPairChecks[0].notOnlySettingChange = false;
  assert.ok(validateIdeationEvidence(ideation).some((message) => message.includes("設定差だけでない")));
});

test("rejects a generator label that the blind critic does not confirm", () => {
  const ideation = validIdeation();
  ideation.diversityAudit.familyAssignments[0].familyId = "different-family";
  assert.ok(validateIdeationEvidence(ideation).some((message) => message.includes("盲検再分類が一致しない")));
});

test("rejects a single family dominating the candidate pool", () => {
  const ideation = validIdeation();
  for (let index = 0; index < 7; index++) {
    ideation.candidateLog[index].mechanismFamily = "quiet-physical-consequence";
    ideation.diversityAudit.familyAssignments[index].familyId = "quiet-physical-consequence";
  }
  assert.ok(validateIdeationEvidence(ideation).some((message) => message.includes("40%")));
});

test("rejects incomplete blind review coverage", () => {
  const ideation = validIdeation();
  ideation.diversityAudit.reviewedCandidateIds.pop();
  assert.ok(validateIdeationEvidence(ideation).some((message) => message.includes("reviewedCandidateIds")));
});

test("rejects duplicate causal cores even when candidate labels differ", () => {
  const ideation = validIdeation();
  ideation.candidateLog[1].causalCore = ideation.candidateLog[0].causalCore;
  assert.ok(validateIdeationEvidence(ideation).some((message) => message.includes("同一causalCore")));
});

test("keeps the taxonomy open: unlisted family names are accepted when evidence is diverse", () => {
  const ideation = validIdeation();
  assert.deepEqual(validateIdeationEvidence(ideation), []);
});


function validComedyAudit() {
  return {
    comicKernel: "表彰の順位が探偵の推理能力でなく学校の地理的位置で決まる。",
    audienceExpectation: "観客は日本一という表彰を実績や推理力への評価だと考える。",
    characterIntent: "高校生は表彰を受け取り、記者の質問に正直に答えようとする。",
    pressure: "記者が受賞理由を尋ね、表彰の建前と実際の基準の差が露呈する。",
    escalations: [
      { beatId: "hook", change: "一件も事件を解決していない事実が明らかになる。" },
      { beatId: "turn", change: "順位の基準が地理的位置だと明かされる。" }
    ],
    payoffCausality: "さらに西の高校の探偵が現れ、地理順位が更新される。",
    laughMoment: { beatId: "payoff", description: "新しい探偵も事件未解決のまま同じ賞を受け取る。" },
    independentReview: {
      mode: "hostile-reader",
      verdict: "pass",
      summary: "台詞と行動だけで確認し、序盤の受賞と未解決の落差が終盤の順位更新につながっている。",
      strongestObjection: "地理的順位を言うだけでは一発ネタで終わる可能性がある。",
      resolution: "受賞理由の説明後に順位が実際に更新される展開を加え、前半の前提を再度動かす。",
      checks: {
        premiseHasComicEngine: true,
        notJustMundaneIncident: true,
        payoffIsEarned: true,
        characterCanonRespected: true,
        noUnmotivatedAdditions: true,
        notOnlyRoleReversal: true
      }
    }
  };
}

const comedyBeatIds = ["hook", "turn", "payoff"];

test("accepts a complete, beat-linked comedy audit", () => {
  assert.deepEqual(validateComedyAudit(validComedyAudit(), comedyBeatIds), []);
});

test("blocks comedy audit with no distinct escalation or no laugh moment", () => {
  const audit = validComedyAudit();
  audit.escalations = [audit.escalations[0], audit.escalations[0]];
  audit.laughMoment.beatId = "not-a-real-beat";
  const errors = validateComedyAudit(audit, comedyBeatIds);
  assert.ok(errors.some((message) => message.includes("異なるbeat")));
  assert.ok(errors.some((message) => message.includes("実際のbeat ID")));
});

test("blocks an everyday inconvenience that has no independent comic engine", () => {
  const audit = validComedyAudit();
  audit.independentReview.checks.notJustMundaneIncident = false;
  assert.ok(validateComedyAudit(audit, comedyBeatIds).some((message) => message.includes("notJustMundaneIncident")));
});

test("blocks an unearned payoff or invented character traits", () => {
  const audit = validComedyAudit();
  audit.independentReview.checks.payoffIsEarned = false;
  audit.independentReview.checks.characterCanonRespected = false;
  audit.independentReview.checks.noUnmotivatedAdditions = false;
  const errors = validateComedyAudit(audit, comedyBeatIds);
  assert.ok(errors.some((message) => message.includes("payoffIsEarned")));
  assert.ok(errors.some((message) => message.includes("characterCanonRespected")));
  assert.ok(errors.some((message) => message.includes("noUnmotivatedAdditions")));
});

test("blocks an unresolved hostile-reader objection", () => {
  const audit = validComedyAudit();
  audit.independentReview.verdict = "revise";
  assert.ok(validateComedyAudit(audit, comedyBeatIds).some((message) => message.includes("verdict")));
});

test("allows optional user X-post inspiration when the source and transformation are recorded", () => {
  const ideation = validIdeation();
  ideation.userSeeds = [{
    platform: "x",
    sourcePostId: "x_1986463621413806176",
    transformation: "競技人口が少なくて一位という核を地理順位の表彰と後続校へ転用した。",
    reusedVerbatim: false
  }];
  assert.deepEqual(validateIdeationEvidence(ideation), []);
});

test("rejects verbatim or untraceable user X-post reuse", () => {
  const ideation = validIdeation();
  ideation.userSeeds = [{
    platform: "x",
    sourcePostId: "1986463621413806176",
    transformation: "元投稿をほぼそのまま台詞にした。",
    reusedVerbatim: true
  }];
  const errors = validateIdeationEvidence(ideation);
  assert.ok(errors.some((message) => message.includes("正確な x_投稿ID")));
  assert.ok(errors.some((message) => message.includes("reusedVerbatim")));
});

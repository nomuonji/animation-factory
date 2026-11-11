import test from "node:test";
import assert from "node:assert/strict";
import { validateIdeationEvidence } from "./design-lint.mjs";

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

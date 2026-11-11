import test from "node:test";
import assert from "node:assert/strict";
import { validateIdeationEvidence } from "./design-lint.mjs";

function validIdeation() {
  const chunkIds = ["chunk-101", "chunk-102", "chunk-103"];
  const exampleIds = [
    "radichichi-101",
    "radichichi-102",
    "radichichi-103",
    "radichichi-104",
    "radichichi-105"
  ];
  const mechanismIds = ["rule-shift", "mundane-detail", "social-script"];
  const candidateLog = Array.from({ length: 15 }, (_, index) => {
    const id = `C${String(index + 1).padStart(2, "0")}`;
    const status = index < 12 ? "rejected" : index < 14 ? "shortlisted" : "selected";
    return {
      id,
      mechanism: mechanismIds[index % mechanismIds.length],
      concept: `A fresh skit concept ${index + 1}`,
      status,
      ...(status === "rejected" ? { reason: "The premise is overdesigned." } : {})
    };
  });
  return {
    gateVersion: 1,
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
        id,
        dataset: "radichichi",
        retrievalTier: "creative",
        role: "ogiri_reference"
      })),
      sourceChunkIds: chunkIds,
      sourceExampleIds: exampleIds
    },
    mechanisms: [
      {
        id: mechanismIds[0],
        sourceExampleIds: [exampleIds[0], exampleIds[1]],
        abstractOperation: "Shift one operating rule without changing the setting.",
        transfer: "Apply it to a different everyday interaction."
      },
      {
        id: mechanismIds[1],
        sourceExampleIds: [exampleIds[2], exampleIds[3]],
        abstractOperation: "Use an ordinary procedural detail as the source of the turn.",
        transfer: "Move that detail to a new social situation."
      },
      {
        id: mechanismIds[2],
        sourceExampleIds: [exampleIds[4]],
        abstractOperation: "Corrupt one familiar conversational script.",
        transfer: "Reuse the mechanism with different roles and dialogue."
      }
    ],
    candidateLog,
    shortlist: ["C13", "C14", "C15"],
    selectedCandidateId: "C15",
    selectionAuthority: "user"
  };
}

test("accepts a fully evidenced, selected Radichichi ideation record", () => {
  assert.deepEqual(validateIdeationEvidence(validIdeation()), []);
});

test("blocks source chunks outside the creative ogiri corpus", () => {
  const ideation = validIdeation();
  ideation.corpus.sourceChunks[1].retrievalTier = "raw_context";
  const errors = validateIdeationEvidence(ideation);
  assert.ok(errors.some((message) => message.includes("retrievalTier=creative")));
});

test("blocks a claimed candidate count without the full candidate log", () => {
  const ideation = validIdeation();
  ideation.candidateLog = ideation.candidateLog.slice(0, 5);
  const errors = validateIdeationEvidence(ideation);
  assert.ok(errors.some((message) => message.includes("candidateLog")));
});

test("blocks a selected idea that was not in the displayed shortlist", () => {
  const ideation = validIdeation();
  ideation.selectedCandidateId = "C01";
  const errors = validateIdeationEvidence(ideation);
  assert.ok(errors.some((message) => message.includes("shortlist")));
});

test("requires three distinct mechanisms and unique source chunk IDs", () => {
  const ideation = validIdeation();
  ideation.mechanisms[2].id = ideation.mechanisms[1].id;
  ideation.corpus.sourceChunkIds[2] = ideation.corpus.sourceChunkIds[1];
  const errors = validateIdeationEvidence(ideation);
  assert.ok(errors.some((message) => message.includes("重複しない3種類")));
  assert.ok(errors.some((message) => message.includes("sourceChunkIds")));
});

test("blocks a new production that does not opt into gate version 1", () => {
  const ideation = validIdeation();
  delete ideation.gateVersion;
  const errors = validateIdeationEvidence(ideation);
  assert.ok(errors.some((message) => message.includes("gateVersion=1")));
});

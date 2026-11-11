#!/usr/bin/env node
/**
 * PR gate for every added or modified 3D skit scene file.
 * Unchanged legacy scenes remain renderable; changed/new scenes must include
 * complete Radichichi provenance, broad candidate families, blind reclassification, and a structurally distinct shortlist.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import process from "node:process";
import { validateIdeationEvidence } from "./design-lint.mjs";

const base = process.env.BASE_SHA;
const head = process.env.HEAD_SHA;
if (!base || !head) throw new Error("BASE_SHA and HEAD_SHA are required");

const changed = execFileSync(
  "git",
  ["diff", "--name-only", "--diff-filter=ACMRT", `${base}...${head}`, "--", "productions/*/scene3d.json"],
  { encoding: "utf8" }
).trim().split("\n").filter(Boolean);

if (!changed.length) {
  console.log("No added or modified scene3d.json files; legacy render compatibility preserved.");
  process.exit(0);
}

let failed = false;
for (const path of changed) {
  let production;
  try {
    const raw = execFileSync("git", ["show", `${head}:${path}`], { encoding: "utf8" });
    production = JSON.parse(raw);
  } catch (error) {
    console.error(`FAIL ${path}: cannot read scene file from PR head: ${error.message}`);
    failed = true;
    continue;
  }
  const issues = validateIdeationEvidence(production.design?.ideation);
  if (issues.length) {
    console.error(`FAIL ${path}`);
    for (const issue of issues) console.error(`  - ${issue}`);
    failed = true;
  } else {
    console.log(`PASS ${path}: Radichichi evidence structure is complete`);
  }
}

if (failed) process.exit(1);
console.log(`Passed Radichichi provenance gate for ${changed.length} changed production(s).`);

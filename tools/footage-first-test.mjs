import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {validateBrief} from "./footage-first-validate.mjs";

const smoke=JSON.parse(await readFile("productions/footage-first-smoke/footage-first.json","utf8"));
const real=JSON.parse(await readFile("productions/chameleon-short/footage-first.json","utf8"));
const a=validateBrief(smoke);
const b=validateBrief(real);
assert.equal(a.sources,1,"A moving source is allowed; no arbitrary five-photo minimum");
assert.equal(a.moving,true);
assert.ok(b.duration>40 && b.duration<60,"longer documentary beats should be represented");
assert.equal(b.sources,2);
assert.ok(real.beats.some(x=>x.layout==="motion"));
assert.ok(real.beats.every(x=>x.sourceNotice?.includes("8倍速")));
const withoutFootage=structuredClone(real);
withoutFootage.beats=withoutFootage.beats.map(beat=>({...beat,layout:"compare",
  compareAt:[7.3,14.2],sourceId:"chameleon-excitation"}));
assert.throws(()=>validateBrief(withoutFootage),/moving footage required/);
const badLicense=structuredClone(real);
badLicense.sources[0].license="unknown";
assert.throws(()=>validateBrief(badLicense),/SHA1, creator and rights/);
const badSha=structuredClone(real);
badSha.sources[0].sha1="anything";
assert.throws(()=>validateBrief(badSha),/SHA1, creator and rights/);
const noEnding=structuredClone(real);
noEnding.finalPayoff="";
assert.throws(()=>validateBrief(noEnding),/first frame and final payoff/);
const wrongSource=structuredClone(real);
wrongSource.beats[0].sourceId="fictional";
assert.throws(()=>validateBrief(wrongSource),/beat id, source or duration/);
const short=structuredClone(real);
short.beats=short.beats.slice(0,2);
assert.ok(validateBrief(short).duration<40,
 "Duration target should be advisory, not a software rule forcing filler");
console.log("Footage-first contract passed",JSON.stringify({smoke:a,longFilm:b}));

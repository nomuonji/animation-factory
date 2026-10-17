/**
 * Footage-first Shorts brief validator.
 * Technical rights checks; not a surrogate for actual human creative judgment.
 * Usage: node tools/footage-first-validate.mjs productions/<name>/footage-first.json
 */
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const fail=(reason)=>{throw new Error("Footage-first brief invalid: "+reason);};
const str=(v,max=500)=>typeof v==="string" && !!v.trim() && v.length<=max;
const id=(s)=>/^[a-z0-9][a-z0-9-]{1,70}$/.test(s||"");
const number=(v,min,max)=>typeof v==="number" && Number.isFinite(v) && v>=min && v<=max;
export function validateBrief(b) {
  if(!b||b.version!==1||!id(b.id)||!str(b.title,160)) fail("metadata");
  if(b.publishStatus !== "draft") fail("Only draft/review video production is allowed");
  if(typeof b.demoOnly !== "boolean") fail("Explicit demoOnly boolean");
  const size=b.canvas||{};
  if(size.width!==720||size.height!==1280||![15,20,24,25,30].includes(size.fps)) fail("720x1280 working canvas/fps");
  if(!str(b.viewerPromise,240)||!str(b.finalPayoff,240)) fail("first frame and final payoff required");
  if(!Array.isArray(b.sources)||!b.sources.length||b.sources.length>8) fail("1..8 real video sources required");
  const sources=new Set();
  for(const s of b.sources) {
    if(!id(s.id)||sources.has(s.id)) fail("source ID");
    sources.add(s.id);
    if(!str(s.title,180)) fail("source title");
    if(!b.demoOnly){
      if (!/^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\//.test(s.downloadUrl||""))
        fail("live source must have trusted approved https Commons media URL: "+s.id);
      if (!/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/.test(s.sourcePage||""))
        fail("original Commons source page required: "+s.id);
      if (!/^[0-9a-f]{40}$/.test(s.sha1||"") ||
          !["CC BY 4.0","CC BY-SA 4.0","CC BY-SA 3.0","CC0 1.0"].includes(s.license) ||
          !str(s.author,220) || !str(s.credit,500)) fail("SHA1, creator and rights must be specified: "+s.id);
    }
  }
  if(!Array.isArray(b.beats)||b.beats.length<2||b.beats.length>36) fail("2..36 story beats");
  let sec=0,hasMoving=false;
  for(const beat of b.beats){
    if(!id(beat.id)||!sources.has(beat.sourceId)||!number(beat.duration,0.4,24)) fail("beat id, source or duration");
    if(!["compare","motion","wide"].includes(beat.layout)) fail("layout");
    if(!number(beat.sourceIn,0,3600)||!number(beat.rate,0.25,4)) fail("source in/rate");
    if(beat.layout==="compare"){
      if(!Array.isArray(beat.compareAt)||beat.compareAt.length!==2||
         !beat.compareAt.every(t=>number(t,0,3600))) fail("comparison must contain two actual timestamps");
    } else hasMoving=true;
    if(!str(beat.onScreen,80)||!str(beat.visualChange,500)||!str(beat.storyFunction,180)) fail("visible change/purpose");
    if(beat.narration !== undefined && !str(beat.narration,260)) fail("spoken script");
    if(beat.soundCue !== undefined && !["hit","reveal","none"].includes(beat.soundCue)) fail("sound cue");
    if(beat.focalX !== undefined && !number(beat.focalX,0,1)) fail("focalX");
    sec+=beat.duration;
  }
  if(!hasMoving && !b.demoOnly) fail("real visible moving footage required; no image slideshow");
  if(!number(sec,2,180)) fail("total runtime invalid");
  if(b.voice !== undefined && !["voicevox-nemo","none"].includes(b.voice.provider)) fail("voice backend");
  if(!b.demoOnly && b.voice?.provider==="none" && b.beats.every(x=>!x.narration)) fail("no narratorial intent or audio plan");
  if(!b.demoOnly && !str(b.licenseStatement,2500)) fail("visible source/rights statement for upload draft required");
  return {duration:+sec.toFixed(3),beats:b.beats.length,sources:sources.size,
    moving:hasMoving, suggestedDuration:"40-60s editorial starting point; never pad to hit a number"};
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const p=process.argv[2];
  if(!p) fail("path required");
  const b=JSON.parse(await readFile(p,"utf8"));
  console.log(JSON.stringify(validateBrief(b),null,2));
}

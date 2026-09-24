import { readFile } from "node:fs/promises";

const path = process.argv[2];
if (!path) {
  console.error("Usage: node tools/validate-attention.mjs <production.json>");
  process.exit(1);
}
const p = JSON.parse(await readFile(path, "utf8"));
if (!p.attention) {
  console.log("Attention validation skipped: no attention policy.");
  process.exit(0);
}
const cps = p.attention.maxReadingCharsPerSecond ?? 8;
const maxLayers = p.attention.maxTextLayers ?? 1;
const errors = [];
const warnings = [];
const chars = (text) => Array.from(String(text ?? "").replace(/\s+/g, "")).length;
const readable = (p.events ?? []).flatMap((event) => {
  if (!Number.isFinite(event.duration) || event.duration <= 0) return [];
  if (event.kind === "dialogue.say") return event.showSubtitle === false ? [] : [{...event,label:"subtitle",readText:event.text}];
  if (event.kind === "ui.caption") return [{...event,label:"caption",readText:event.text}];
  if (event.kind === "ui.speech") return [{...event,label:"speech",readText:event.text}];
  if (event.kind === "ui.essayCard") return [{...event,label:"essay",readText:[event.title,event.body].join(" ")}];
  if (event.kind === "ui.rpgStatus") return [{...event,label:"status",readText:[event.title,...(event.lines??[])].join(" ")}];
  return [];
});
for (const event of readable) {
  const minimum = chars(event.readText) / cps + 0.6;
  if (minimum > event.duration + 0.01) {
    errors.push(`${event.kind} at ${event.at}s: ${chars(event.readText)} chars / ${event.duration}s; needs ~${minimum.toFixed(1)}s`);
  }
}
const points=new Set([0,p.meta.duration]);
for(const event of readable){points.add(event.at);points.add(event.at+event.duration);}
const sorted=[...points].sort((a,b)=>a-b);
for(let i=0;i<sorted.length-1;i+=1){
  const t=(sorted[i]+sorted[i+1])/2;
  const active=readable.filter((event)=>t>=event.at&&t<event.at+event.duration);
  const primary=active.filter((event)=>["caption","essay","status"].includes(event.label));
  const subtitle=active.filter((event)=>event.label==="subtitle");
  const effective=primary.length+(primary.length?0:subtitle.length);
  if(effective>maxLayers) errors.push(`too many primary reading targets around ${t.toFixed(1)}s: ${active.map((e)=>e.label).join(", ")}`);
  if(active.length>=3) warnings.push(`high visual load around ${t.toFixed(1)}s: ${active.map((e)=>e.label).join(", ")}`);
}
for(const beat of p.attention.beats??[]){
  if(!beat.id||!Number.isFinite(beat.at)||!Number.isFinite(beat.duration)||beat.duration<=0) errors.push("attention beats require id, at and duration > 0");
  else if(beat.at<0||beat.at+beat.duration>p.meta.duration+0.01) errors.push(`attention beat ${beat.id} falls outside production duration`);
}
if(warnings.length){console.warn("Attention warnings:");for(const w of warnings)console.warn(`- ${w}`);}
if(errors.length){console.error("Attention validation failed:");for(const e of errors)console.error(`- ${e}`);process.exit(1);}
console.log(`Attention OK: ${readable.length} readable events, ${(p.attention.beats??[]).length} beats`);

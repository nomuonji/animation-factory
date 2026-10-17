import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { loadBank, findCast, validateVideoUsage, validateBank } from "./character-bank.mjs";

const bank=await loadBank();
const original=bank.characters.filter(c=>c.sourceType==="project-original");
const refs=bank.characters.filter(c=>c.sourceType==="irasutoya");
assert.equal(original.length,12);
assert.equal(refs.length,12);
assert.ok(original.every(c=>c.render?.archetype===c.id && c.state==="ready"));
assert.ok(refs.every(c=>c.render===null && c.state==="reference_only"));
assert.equal(findCast(bank,{role:"boss",emotion:"angry"})?.id,"manager");
assert.equal(findCast(bank,{role:"office-worker",emotion:"dead-inside"})?.id,"worker-exhausted");
assert.equal(findCast(bank,{role:"shop-clerk",emotion:"friendly"})?.id,"clerk");
assert.equal(findCast(bank,{role:"unicorn"}),null);

const sample=JSON.parse(await readFile("productions/market-short-character-test/production.json","utf8"));
for (const actor of sample.actors) {
  const item=bank.characters.find(c=>c.id===actor.archetype);
  assert.ok(item && item.state==="ready" && item.render?.archetype===actor.archetype,
    "Sample uses an unapproved or missing character: "+actor.archetype);
}
assert.equal(validateVideoUsage(bank,{videoAssets:["manager","worker-exhausted"],thumbnailAssets:["manager"]}).totalDistinct,2);
assert.throws(()=>validateVideoUsage(bank,{videoAssets:["irasutoya-manager-angry"]}),/reference-only/);
assert.throws(()=>validateVideoUsage(bank,{videoAssets:["unknown"]}),/Unknown/);
assert.throws(()=>validateBank({...bank,characters:[...bank.characters,original[0]]}),/duplicate/);

// Unit-test the commercial 20 distinct illustration count (including thumbnail,
// repeated use counts once) with an artificial isolated render-ready mock catalog.
const fake=structuredClone(bank);
fake.characters=Array.from({length:21},(_,i)=>({
  id:"ira-"+i,sourceType:"irasutoya",state:"ready",render:{kind:"mock-only"}
}));
const ids=fake.characters.map(x=>x.id);
assert.equal(validateVideoUsage(fake,{videoAssets:ids.slice(0,19),thumbnailAssets:[ids[0]]}).irasutoyaDistinct,19);
assert.equal(validateVideoUsage(fake,{videoAssets:ids.slice(0,20),thumbnailAssets:[ids[0]]}).irasutoyaDistinct,20);
assert.throws(()=>validateVideoUsage(fake,{videoAssets:ids.slice(0,20),thumbnailAssets:[ids[20]]}),/limit exceeded: 21\/20/);

console.log("Character bank contract passed:",original.length,"ready original cast,",refs.length,"licensed-source references, 20-limit tested");

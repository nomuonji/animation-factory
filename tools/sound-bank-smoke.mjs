// Fast offline smoke for local CC0 audio library and role selection.
import assert from "node:assert/strict";
import { stat } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { inventorySoundBank, chooseSound, chooseMusic, SOUND_ROLES } from "./sound-bank.mjs";

const catalog = await inventorySoundBank();
const count = Object.values(catalog.counts).reduce((a,b) => a+b, 0);
assert.ok(count > 20, "Sound bank is unexpectedly empty");
for (const [pack, sounds] of Object.entries(catalog.packs)) {
  assert.ok(sounds.length > 0, "Empty local pack: " + pack);
  assert.ok(sounds.every(asset => asset.license === "CC0-1.0"));
}
for (const role of Object.keys(SOUND_ROLES)) {
  const a = await chooseSound({role,seed:"same-production"});
  const b = await chooseSound({role,seed:"same-production"});
  assert.equal(a.relativePath,b.relativePath,"Selection must be repeatable: " + role);
  assert.ok((await stat(a.path)).size > 0);
  assert.ok(a.relativePath.startsWith("assets/kenney/"));
}
const bgm = await chooseMusic({id:"battle-music-loop"});
assert.ok((await stat(bgm.path)).size > 0);
await assert.rejects(()=>chooseSound({role:"copyrighted_meme",seed:"x"}),/Unknown sound role/);
await assert.rejects(()=>chooseMusic({id:"unlicensed-viral-song"}),/Unknown or unapproved/);

// Decode an actual Kenney asset rather than trusting metadata alone.
const sample=await chooseSound({role:"hook_hit",seed:"decode-check"});
const ffmpeg=spawnSync("ffmpeg",["-hide_banner","-loglevel","error","-y",
  "-i",sample.path,"-t","0.25","-ar","48000","-ac","2","-f","null","-"],
  {encoding:"utf8",timeout:15000});
assert.equal(ffmpeg.status,0,ffmpeg.stderr || "FFmpeg unable to decode local CC0 sound");
console.log("Sound bank OK: "+JSON.stringify({total:count,packs:catalog.counts,
  roles:Object.keys(SOUND_ROLES).length,sampled:sample.relativePath}));

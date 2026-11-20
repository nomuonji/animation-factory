import assert from "node:assert/strict";
import { test } from "node:test";
import { toMotionMakerRequest } from "../tools/motionmaker/export-longform.mjs";
test("longform export preserves narrative and does not authorize publication",()=>{
  const original={id:"x",title:"Film",audience:"Viewers",question:"Why?",payoff:"Because.",chapters:[{id:"c1",title:"Chapter",purpose:"Explain",beats:[{why:"Evidence",say:"Narration",shots:[{src:"local:shot.mp4"}]}]}]};
  const before=JSON.stringify(original);
  const request=toMotionMakerRequest(original);
  assert.equal(request.form.styleMode,"motion");
  assert.match(request.form.outline,/Evidence/);
  assert.match(request.form.outline,/local:shot.mp4/);
  assert.equal(request.form.videoGeneration,false);
  assert.equal(request.form.voiceEngine,"none");
  assert.deepEqual(request.assets,{});
  assert.equal(JSON.stringify(original),before);
  assert.throws(()=>toMotionMakerRequest({...original,chapters:[]}),/chapters/);
});

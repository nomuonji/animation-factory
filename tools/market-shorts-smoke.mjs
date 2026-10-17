// Smoke-check accepted production and blocked submissions without network access.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';

const fixture = JSON.parse(await readFile('market-shorts/examples/synthetic-fixture.json','utf8'));
const temp = await mkdtemp(join(tmpdir(),'market-shorts-contract-'));
const outputId = 'market-short-' + createHash('sha256')
  .update(fixture.ideas[0].id + ':' + fixture.ideas[0].videoExperiment.variant).digest('hex').slice(0,12);
function produce(file) {
  return spawnSync(process.execPath,['tools/market-shorts.mjs','--input',file],{
    cwd:process.cwd(),encoding:'utf8',timeout:10000
  });
}
const good = produce('market-shorts/examples/synthetic-fixture.json');
assert.equal(good.status,0,good.stderr);
const productionPath = join('productions',outputId,'production.json');
const production = JSON.parse(await readFile(productionPath,'utf8'));
assert.equal(production.canvas.width * production.canvas.outputScale,1080);
assert.equal(production.canvas.height * production.canvas.outputScale,1920);
assert.equal(production.audio.tts.provider,'voicevox-nemo');
const record = JSON.parse(await readFile(join('productions',outputId,'experiment.json'),'utf8'));
assert.equal(record.demoOnly,true);
assert.equal(record.uploadStatus,'not_connected');
const validator = spawnSync(process.execPath,['tools/validate-production.mjs',productionPath],{
  cwd:process.cwd(),encoding:'utf8',timeout:10000
});
assert.equal(validator.status,0,validator.stderr);

for (const [label,mutation] of [
  ['rejected',i => {i.status='rejected';}],
  ['unscored',i => {delete i.agentReview;}],
  ['rights-unchecked',i => {i.videoExperiment.rightsChecked=false;}]
]) {
  const changed = structuredClone(fixture);
  mutation(changed.ideas[0]);
  const path = join(temp,label+'.json');
  await writeFile(path,JSON.stringify(changed));
  const bad = produce(path);
  assert.notEqual(bad.status,0,label+' must not render');
  assert.match(bad.stderr,/No independently approved/);
}
console.log('Market Shorts smoke passed');

/**
 * Market Shorts: canonical Keywords Idea Memory export -> Animation Factory.
 * Only pre-reviewed, evidence-backed, explicitly scripted experiments can render.
 * No publishing, database writes or synthetic market scoring here.
 *
 * Usage:
 *   node tools/market-shorts.mjs --input market-shorts/examples/demo.json
 *   MARKET_IDEAS_FEED_URL=https://... MARKET_IDEAS_FEED_TOKEN=... node tools/market-shorts.mjs
 */
import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
function arg(name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}
function requireText(value, field, max = 160) {
  if (typeof value !== 'string' || !value.trim() || value.length > max)
    throw new Error('Invalid ' + field + ': expected 1..' + max + ' characters');
  return value.trim();
}
function scoreEligible(idea) {
  const review = idea.agentReview;
  if (!review || review.verdict !== 'pass' || review.rubricVersion !== 'idea-final-judge-v4') return false;
  const a = review.axes || {};
  return ['appeal','dbValue','seo','revenue','contentFeasibility','upkeep']
    .every(k => Number.isInteger(a[k]) && a[k] >= 4 && a[k] <= 5);
}
function validate(idea) {
  const title = requireText(idea.title, 'idea.title', 120);
  const id = requireText(idea.id, 'idea.id', 100);
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error('Unsafe idea id');
  if (['rejected', 'deferred'].includes(idea.status)) throw new Error('Idea is rejected/deferred: ' + id);
  if (!scoreEligible(idea)) throw new Error('Idea lacks independently scored, passing v4 review: ' + id);
  if (!Array.isArray(idea.destinations) ||
      !idea.destinations.some(d => ['youtube_shorts','short_video'].includes(d)))
    throw new Error('Not routed to shorts: ' + id);
  if (!Array.isArray(idea.marketEvidenceRefs) || idea.marketEvidenceRefs.length === 0)
    throw new Error('Missing source references: ' + id);
  const video = idea.videoExperiment;
  if (!video || video.evidenceChecked !== true || video.rightsChecked !== true)
    throw new Error('Independent evidence and rights review is required: ' + id);
  requireText(video.hook, 'videoExperiment.hook', 48);
  requireText(video.hookVoice, 'videoExperiment.hookVoice', 42);
  if (!Array.isArray(video.beats) || video.beats.length !== 3)
    throw new Error('Exactly 3 authored beats required: ' + id);
  for (const [i, beat] of video.beats.entries()) {
    requireText(beat.heading, 'beats[' + i + '].heading', 36);
    requireText(beat.body, 'beats[' + i + '].body', 54);
    requireText(beat.voice, 'beats[' + i + '].voice', 42);
  }
  requireText(video.close, 'videoExperiment.close', 48);
  requireText(video.closeVoice, 'videoExperiment.closeVoice', 42);
  return title;
}
async function feed() {
  const input = arg('--input');
  if (input) return JSON.parse(await readFile(resolve(input), 'utf8'));
  const urlText = process.env.MARKET_IDEAS_FEED_URL;
  if (!urlText) throw new Error('Supply --input or MARKET_IDEAS_FEED_URL; live Keywords feed is not configured.');
  const url = new URL(urlText);
  if (url.protocol !== 'https:') throw new Error('HTTPS-only feed');
  const token = process.env.MARKET_IDEAS_FEED_TOKEN;
  if (!token) throw new Error('MARKET_IDEAS_FEED_TOKEN is required for a remote feed');
  const res = await fetch(url, {
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
    signal: AbortSignal.timeout(20000),
    redirect: 'error'
  });
  if (!res.ok) throw new Error('Idea feed HTTP ' + res.status);
  return res.json();
}
function production(idea) {
  const exp = idea.videoExperiment;
  const id = 'market-short-' + createHash('sha256').update(idea.id).digest('hex').slice(0,12);
  const clips = [
    { title: exp.hook, body: 'この話、あなたならどう思う？', voice: exp.hookVoice, seconds: 4.5, kicker: 'MARKET LAB / 01' },
    ...exp.beats.map((b,i) => ({ title:b.heading, body:b.body, voice:b.voice, seconds:7, kicker:'OBSERVATION / 0' + (i+1) })),
    { title:exp.close, body:'コメントで教えてください', voice:exp.closeVoice, seconds:4.5, kicker:'YOUR TAKE' }
  ];
  let t = 0;
  const events = [];
  for (const clip of clips) {
    events.push({kind:'ui.essayCard', at:t, duration:clip.seconds - 0.05,
      kicker:clip.kicker, title:clip.title, body:clip.body, accent:'#77D8E8'});
    // An off-canvas speech anchor supplies VOICEVOX audio without obscuring the essay card.
    events.push({kind:'ui.speech', at:t + 0.12, duration:clip.seconds - 0.24,
      actor:'narrator', text:'・', spokenText:clip.voice});
    t += clip.seconds;
  }
  return {
    meta: {id, title:idea.title, description:'Market demand experiment / sourceIdeaId=' + idea.id,
      duration:t, credits:['VOICEVOX Nemo']},
    canvas:{width:270,height:480,fps:24,outputScale:4},
    environment:'office-night',
    actors:[{id:'narrator',archetype:'robot',x:-900,y:-900,scale:1}],
    events,
    audio:{masterVolume:0.95,tts:{provider:'voicevox-nemo',events:['ui.speech'],
      defaultVoice:{voice:'男声2',speedScale:1.1,volume:1}},
      bgm:[{id:'market-bed',preset:'retro-drone',at:0,duration:t,volume:0.12,fadeIn:0.4,fadeOut:0.7}]}
  };
}
async function main() {
  const data = await feed();
  const ideas = Array.isArray(data) ? data : (Array.isArray(data.ideas) ? data.ideas : null);
  if (!ideas) throw new Error('Feed must be an array or {ideas:[...]}');
  const specified = arg('--id');
  const eligible = ideas.filter(i =>
    i && i.status !== 'rejected' && i.status !== 'deferred' &&
    scoreEligible(i) && Array.isArray(i.destinations) &&
    i.destinations.some(d => ['youtube_shorts','short_video'].includes(d)) &&
    i.videoExperiment?.evidenceChecked && i.videoExperiment?.rightsChecked
  );
  const chosen = specified ? eligible.find(i => i.id === specified) : eligible[0];
  if (!chosen) throw new Error('No independently approved, scripted and evidence-backed candidate in feed');
  validate(chosen);
  const value = production(chosen);
  const dir = join(root, 'productions', value.meta.id);
  await mkdir(dir, {recursive:true});
  const path = join(dir, 'production.json');
  await writeFile(path, JSON.stringify(value,null,2) + '\n', {flag:'w'});
  const result = {sourceIdeaId:chosen.id, sourceRevision:chosen.revision ?? null,
    production:value.meta.id, productionFile:'productions/' + value.meta.id + '/production.json',
    title:chosen.title, experimentVariant:chosen.videoExperiment.variant || 'baseline',
    marketEvidenceRefs:chosen.marketEvidenceRefs, rightsChecked:true, evidenceChecked:true,
    uploadStatus:'not_connected', createdAt:new Date().toISOString()};
  await writeFile(join(dir,'experiment.json'),JSON.stringify(result,null,2) + '\n');
  console.log(JSON.stringify(result));
  if (process.env.GITHUB_OUTPUT) {
    const {appendFile} = await import('node:fs/promises');
    await appendFile(process.env.GITHUB_OUTPUT, 'production=' + value.meta.id + '\n');
  }
}
main().catch(error => {console.error(error.message);process.exitCode=1;});

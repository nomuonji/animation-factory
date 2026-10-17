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
import { readFile, mkdir, writeFile, readdir } from 'node:fs/promises';
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
async function readLicensedImages() {
  const base = join(root, 'market-shorts', 'photo-bank');
  const files = (await readdir(base)).filter(name=>/^[a-z0-9-]+\.json$/.test(name));
  const catalog = new Map();
  for (const file of files) {
    const data = JSON.parse(await readFile(join(base,file),'utf8'));
    for (const p of data.photos || []) {
      if (!/^[a-z0-9-]+$/.test(p.id || '') || catalog.has(p.id) ||
          !['CC BY 4.0','CC BY-SA 3.0','CC BY-SA 4.0'].includes(p.license) ||
          !p.sourcePage?.startsWith('https://commons.wikimedia.org/wiki/File:') ||
          !p.author || !p.filename) throw new Error('Unapproved or duplicate licensed photo: ' + p.id);
      catalog.set(p.id,p);
    }
  }
  return catalog;
}
function validateMediaPlan(video, catalog) {
  const shots = video.mediaPlan?.shots;
  if (!Array.isArray(shots) || shots.length !== 5)
    throw new Error('Real Shorts require exactly 5 planned licensed-photo shots; no slide-only fallback');
  const ids = new Set();
  for (const [i,shot] of shots.entries()) {
    const asset = catalog.get(shot.assetId);
    if (!asset) throw new Error('Licensed photo missing from approved bank: ' + shot.assetId);
    requireText(shot.caption,'mediaPlan.shots['+i+'].caption',120);
    if (shot.zoom !== undefined && (!Number.isFinite(shot.zoom)||shot.zoom<1||shot.zoom>1.35))
      throw new Error('Photo zoom outside 1.0..1.35');
    ids.add(shot.assetId);
  }
  if (ids.size < 3) throw new Error('Live Shorts require at least 3 genuinely different licensed photos');
}
function validate(idea, {demoOnly=false, catalog=new Map()}={}) {
  const title = requireText(idea.title, 'idea.title', 120);
  const id = requireText(idea.id, 'idea.id', 100);
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error('Unsafe idea id');
  if (['rejected', 'deferred'].includes(idea.status)) throw new Error('Idea is rejected/deferred: ' + id);
  if (!scoreEligible(idea)) throw new Error('Idea lacks independently scored, passing v4 review: ' + id);
  if (!Array.isArray(idea.destinations) ||
      !idea.destinations.some(d => ['youtube_video','youtube_shorts','short_video'].includes(d)))
    throw new Error('Not routed to shorts: ' + id);
  if (!Array.isArray(idea.marketEvidenceRefs) || idea.marketEvidenceRefs.length === 0)
    throw new Error('Missing source references: ' + id);
  const video = idea.videoExperiment;
  if (!video || video.evidenceChecked !== true || video.rightsChecked !== true)
    throw new Error('Independent evidence and rights review is required: ' + id);
  requireText(video.hook, 'videoExperiment.hook', 48);
  requireText(video.hookVoice, 'videoExperiment.hookVoice', 34);
  if (!Array.isArray(video.beats) || video.beats.length !== 3)
    throw new Error('Exactly 3 authored beats required: ' + id);
  for (const [i, beat] of video.beats.entries()) {
    requireText(beat.heading, 'beats[' + i + '].heading', 36);
    requireText(beat.body, 'beats[' + i + '].body', 54);
    requireText(beat.voice, 'beats[' + i + '].voice', 34);
  }
  requireText(video.close, 'videoExperiment.close', 48);
  requireText(video.closeVoice, 'videoExperiment.closeVoice', 34);
  if (!demoOnly) validateMediaPlan(video,catalog);
  return title;
}
async function feed() {
  const input = arg('--input');
  if (input) return JSON.parse(await readFile(resolve(input), 'utf8'));
  const urlText = process.env.MARKET_IDEAS_FEED_URL;
  if (!urlText) throw new Error('Supply --input or MARKET_IDEAS_FEED_URL; live Keywords feed is not configured.');
  const url = new URL(urlText);
  if (url.protocol !== 'https:') throw new Error('HTTPS-only feed');
  const id = arg('--id');
  if (!id || !/^[a-zA-Z0-9_-]{1,100}$/.test(id)) throw new Error('Remote feed requires canonical --id');
  url.searchParams.set('id', id);
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
function production(idea, demoOnly=false) {
  const exp = idea.videoExperiment;
  const id = 'market-short-' + createHash('sha256').update(idea.id + ':' + (exp.variant || 'baseline')).digest('hex').slice(0,12);
  const clips = [
    { title: exp.hook, body: 'この話、あなたならどう思う？', voice: exp.hookVoice, seconds: 4.5, kicker: 'MARKET LAB / 01' },
    ...exp.beats.map((b,i) => ({ title:b.heading, body:b.body, voice:b.voice, seconds:7, kicker:'OBSERVATION / 0' + (i+1) })),
    { title:exp.close, body:'コメントで教えてください', voice:exp.closeVoice, seconds:4.5, kicker:'YOUR TAKE' }
  ];
  let t = 0;
  const events = [];
  const soundCues = [];
  for (const [i, clip] of clips.entries()) {
    // Real market experiments MUST be led by actual cleared photography.
    // Synthetic smoke fixtures remain visibly non-publishable text demos.
    if (!demoOnly) {
      const shot = exp.mediaPlan.shots[i];
      events.push({kind:'ui.photo',at:t,duration:clip.seconds-0.05,assetId:shot.assetId,
        caption:shot.caption,zoom:shot.zoom || 1.08});
      events.push({kind:'ui.kineticText',at:t,duration:clip.seconds-0.1,
        text:clip.title,accent:i===0?'#ffe568':'#f6e1a4',placement:'upper'});
    } else {
    // Synthetic fixtures may keep the historical card-only layout.
    if (i === 0 || i === clips.length - 1) {
      events.push({kind:'ui.kineticText',at:t,duration:clip.seconds - 0.1,
        text:clip.title,accent:i === 0 ? '#ffe568' : '#f78ea4',placement:'middle'});
    } else {
      events.push({kind:'ui.essayCard',at:t,duration:clip.seconds - 0.05,
        kicker:clip.kicker,title:clip.title,body:clip.body,accent:'#77D8E8'});
    }
    }
    if (!demoOnly) {
      events.push({kind:'dialogue.say',at:t+0.12,duration:clip.seconds-0.24,
        actor:'narrator',text:clip.voice,spokenText:clip.voice,showSubtitle:true});
    } else {
      events.push({kind:'ui.speech',at:t+0.12,duration:clip.seconds-0.24,
        actor:'narrator',text:'・',spokenText:clip.voice});
    }
    soundCues.push({
      id:'beat-sfx-' + i,role:i === 0 ? 'hook_hit' : i === clips.length - 1 ? 'reveal' : 'pop',
      at:t,volume:i === 0 ? 0.38 : 0.22
    });
    t += clip.seconds;
  }
  return {
    meta: {id, title:idea.title, description:'Market demand experiment / sourceIdeaId=' + idea.id,
      duration:t, credits:['VOICEVOX Nemo',...(!demoOnly ? exp.mediaPlan.shots.map(s=>'Photo: '+s.assetId+' (see photo-bank manifest, source + license)') : [])]},
    canvas:{width:270,height:480,fps:24,outputScale:4},
    environment:'office-night',
    actors:[{id:'narrator',archetype:'robot',x:-900,y:-900,scale:1}],
    events,
    audio:{masterVolume:0.95,tts:{provider:'voicevox-nemo',events:[demoOnly?'ui.speech':'dialogue.say'],
      defaultVoice:{voice:'男声2',speedScale:1.1,volume:1}},
      bgm:[{id:'market-bed',assetId:'battle-music-loop',at:0,duration:t,volume:0.08,fadeIn:0.25,fadeOut:0.7}],
      sfx:soundCues}
  };
}
async function main() {
  const data = await feed();
  const rawIdeas = Array.isArray(data) ? data : (Array.isArray(data.ideas) ? data.ideas : null);
  let ideas = rawIdeas;
  if (!arg('--input') && rawIdeas && arg('--id')) {
    const id = arg('--id');
    const briefPath = join(root, 'market-shorts', 'briefs', id + '.json');
    let brief;
    try { brief = JSON.parse(await readFile(briefPath, 'utf8')); }
    catch { throw new Error('Reviewed creative brief missing: market-shorts/briefs/' + id + '.json'); }
    ideas = rawIdeas.map(idea => {
      if (idea.id !== id) return idea;
      if (brief.ideaId !== id || brief.sourceRevision !== idea.revision) throw new Error('Creative brief source revision mismatch: ' + id);
      return { ...idea, videoExperiment:brief.videoExperiment };
    });
  }
  if (!ideas) throw new Error('Feed must be an array or {ideas:[...]}');
  const specified = arg('--id');
  const eligible = ideas.filter(i =>
    i && i.status !== 'rejected' && i.status !== 'deferred' &&
    scoreEligible(i) && Array.isArray(i.destinations) &&
    i.destinations.some(d => ['youtube_video','youtube_shorts','short_video'].includes(d)) &&
    i.videoExperiment?.evidenceChecked && i.videoExperiment?.rightsChecked
  );
  const chosen = specified ? eligible.find(i => i.id === specified) : eligible[0];
  if (!chosen) throw new Error('No independently approved, scripted and evidence-backed candidate in feed');
  const demoOnly = Boolean(data.demoOnly || chosen.demoOnly);
  const catalog = demoOnly ? new Map() : await readLicensedImages();
  validate(chosen,{demoOnly,catalog});
  const value = production(chosen,demoOnly);
  const dir = join(root, 'productions', value.meta.id);
  await mkdir(dir, {recursive:true});
  const path = join(dir, 'production.json');
  await writeFile(path, JSON.stringify(value,null,2) + '\n', {flag:'w'});
  const result = {sourceIdeaId:chosen.id, sourceRevision:chosen.revision ?? null,
    production:value.meta.id, productionFile:'productions/' + value.meta.id + '/production.json',
    title:chosen.title, experimentVariant:chosen.videoExperiment.variant || 'baseline',
    marketEvidenceRefs:chosen.marketEvidenceRefs, rightsChecked:true, evidenceChecked:true,
    demoOnly, photoFirst:!demoOnly, photoIds:demoOnly?[]:chosen.videoExperiment.mediaPlan.shots.map(s=>s.assetId),
    uploadStatus:'not_connected', createdAt:new Date().toISOString()};
  await writeFile(join(dir,'experiment.json'),JSON.stringify(result,null,2) + '\n');
  console.log(JSON.stringify(result));
  if (process.env.GITHUB_OUTPUT) {
    const {appendFile} = await import('node:fs/promises');
    await appendFile(process.env.GITHUB_OUTPUT, 'production=' + value.meta.id + '\n');
  }
}
main().catch(error => {console.error(error.message);process.exitCode=1;});

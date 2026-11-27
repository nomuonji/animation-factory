import {verifyGanbaruChannel} from './verify-channel.mjs';
import {readFile,writeFile} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';

const approval=JSON.parse(await readFile('growth/publish-request.json','utf8'));
const manifest=JSON.parse(await readFile('preview/manifest.json','utf8'));
const id=approval.productionId;
if (!/^growth-[a-z0-9-]{3,50}$/.test(id)||id!==manifest.productionId||
    String(approval.previewRunId)!==manifest.runId||approval.sha256!==manifest.sha256||
    !/^[a-f0-9]{64}$/.test(approval.sha256)) throw new Error('Manifest mismatch');
const digest=createHash('sha256').update(await readFile('preview/video.mp4')).digest('hex');
if(digest!==approval.sha256) throw new Error('Exact reviewed bytes required');
const review=approval.review||{};
// One-time owner-requested first pilot: actual full-timeline frames and decoded audio
// were inspected, but listening and continuous playback were unavailable in chat.
// Never represent this as a completed ordinary editorial review or apply it to another video.
const firstPilot = id==='growth-commute-clock-001' &&
  digest==='b0811384053bc1e458c8da789a214b885454cacd7e49b00887e720525eccca60' &&
  String(approval.previewRunId)==='45917659793' &&
  review.ownerRequestedFirstPilot===true && review.fullTimelineFramesChecked===true &&
  review.decodedAudioChecked===true && review.listenedAudio===false &&
  review.watchedFullVideo===false && review.editorialPass===false;
const normalReview = review.watchedFullVideo===true && review.listenedAudio===true &&
  review.editorialPass===true;
if(!review.reviewer||(!normalReview&&!firstPilot)||
    review.rightsChecked!==true||review.claimsChecked!==true||review.originalityChecked!==true||
    !review.notes||review.notes.length<20)
  throw new Error('Substantive review of the exact video is required');
if(typeof approval.madeForKids!=='boolean'||typeof approval.containsSyntheticMedia!=='boolean')
  throw new Error('Audience and synthetic media declarations required');
if(typeof approval.title!=='string'||!approval.title.trim()||approval.title.length>100||
    typeof approval.description!=='string'||approval.description.length>4700)
  throw new Error('Invalid publication metadata');
const channel=await verifyGanbaruChannel();
if(approval.channelId!==channel.id) throw new Error('Wrong channel');
const youtube=channel.youtube;
const ch=(await youtube.channels.list({part:['contentDetails'],id:[channel.id]})).data.items?.[0];
const playlist=ch?.contentDetails?.relatedPlaylists?.uploads;
if(!playlist) throw new Error('Upload history unavailable');
const recent=(await youtube.playlistItems.list({part:['contentDetails'],playlistId:playlist,maxResults:50})).data.items||[];
const ids=recent.map(x=>x.contentDetails?.videoId).filter(Boolean);
const videos=ids.length?(await youtube.videos.list({part:['snippet','status'],id:ids})).data.items||[]:[];
if(videos.some(v=>v.snippet?.description?.includes('Ganbaru-Growth-ID: '+id)))
  throw new Error('Duplicate production found');
if(videos.length>=50 && videos.filter(v=>Date.now()-Date.parse(v.snippet?.publishedAt)<86400000).length>=50)
  throw new Error('Daily upload history truncated');
if(videos.filter(v=>v.status?.privacyStatus==='public'&&Date.now()-Date.parse(v.snippet?.publishedAt)<86400000).length>=1)
  throw new Error('Rolling 24h channel public-post cap reached');
if(process.argv.includes('--check')) {console.log('Publication preflight passed');}
else {
  const intent=JSON.parse(await readFile('growth/ledger/'+id+'.json','utf8'));
  if(intent.stage!=='upload_started'||intent.sha256!==digest||String(intent.runId)!==process.env.GITHUB_RUN_ID)
    throw new Error('Durable unique intent required');
  // Never retry ambiguous upload results. Only a verified public ID is written to public ledger.
  try {
    const result=await youtube.videos.insert({part:['snippet','status'],requestBody:{
      snippet:{title:approval.title,description:approval.description+'\n\nGanbaru-Growth-ID: '+id,categoryId:'22',defaultLanguage:'ja'},
      status:{privacyStatus:'public',selfDeclaredMadeForKids:approval.madeForKids,containsSyntheticMedia:approval.containsSyntheticMedia}
    },media:{mimeType:'video/mp4',body:createReadStream('preview/video.mp4')}},{retry:false});
    const vid=result.data.id;
    if(!vid) throw new Error('No video ID');
    const v=(await youtube.videos.list({part:['snippet','status'],id:[vid]})).data.items?.[0];
    if(v?.snippet?.channelId!==channel.id||v.status?.privacyStatus!=='public') throw new Error('Public result not verified');
    await writeFile('growth/ledger/'+id+'.json',JSON.stringify({...intent,stage:'published',videoId:vid,channelId:channel.id,publishedAt:v.snippet.publishedAt},null,2)+'\n');
    console.log('Verified public publication: '+vid);
  }catch{console.error('Upload outcome unknown. Reconcile in Studio; never automatically retry.');process.exitCode=1;}
}

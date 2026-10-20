/** Manual-only publishing of an owner-approved, checksum-pinned finished film. */
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const need=n=>{if(!process.env[n])throw Error('Missing '+n);return process.env[n];};
const receipt='publication-receipt.json';
async function json(r,label){if(!r.ok)throw Error(label+' HTTP '+r.status);return r.json();}
async function main(){
  const id=need('PRODUCTION'),sha=need('FILM_SHA');
  if(!/^[a-z0-9][a-z0-9-]+$/.test(id)||! /^[a-f0-9]{64}$/.test(sha))throw Error('Invalid identity/checksum');
  const spec=JSON.parse(await readFile('productions/'+id+'/longform.json','utf8'));
  if(spec.demoOnly||spec.id!==id||!spec.title||spec.title.length>100)throw Error('Invalid real film metadata');
  const check={channelId:need('YOUTUBE_CHANNEL_ID')};
  const auth=await json(await fetch('https://oauth2.googleapis.com/token',{method:'POST',
    body:new URLSearchParams({client_id:need('YOUTUBE_CLIENT_ID'),client_secret:need('YOUTUBE_CLIENT_SECRET'),refresh_token:need('YOUTUBE_REFRESH_TOKEN'),grant_type:'refresh_token'}),signal:AbortSignal.timeout(30000)}),'OAuth');
  const H={Authorization:'Bearer '+auth.access_token};
  const channel=(await json(await fetch('https://www.googleapis.com/youtube/v3/channels?part=id,snippet,contentDetails&mine=true',{headers:H}),'Channel')).items;
  if(channel?.length!==1||channel[0].id!==check.channelId)throw Error('Channel mismatch: '+JSON.stringify(channel?.map(c=>({id:c.id,title:c.snippet?.title}))));
  check.channelTitle=channel[0].snippet.title;
  console.log(JSON.stringify({stage:'channel_verified',channelId:check.channelId,channelTitle:check.channelTitle}));
  const marker='Production-ID: '+id;
  // The channel is the durable duplicate ledger. Walk all pages, including private uploads.
  let page='';
  do{
    const pl=await json(await fetch('https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=50&playlistId='+channel[0].contentDetails.relatedPlaylists.uploads+(page?'&pageToken='+page:''),{headers:H}),'Uploads');
    const ids=(pl.items||[]).map(x=>x.contentDetails.videoId).join(',');
    if(ids){const vs=await json(await fetch('https://www.googleapis.com/youtube/v3/videos?part=snippet,status&id='+ids,{headers:H}),'Duplicate check');
      for(const v of vs.items||[])if(v.snippet.description?.split('\n').includes(marker)||v.snippet.title===spec.title){
        await writeFile(receipt,JSON.stringify({stage:'already_exists',videoId:v.id,channelId:check.channelId,privacyStatus:v.status.privacyStatus}));
        throw Error('Video already exists: '+v.id+'; reconcile instead of uploading again');}}
    page=pl.nextPageToken||'';
  }while(page);
  const event=JSON.parse(await readFile(need('GITHUB_EVENT_PATH'),'utf8'));
  const transferUrl=event.inputs.download_url;
  console.log('::add-mask::'+transferUrl);
  const url=new URL(transferUrl);
  if(url.protocol!=='https:'||!url.hostname.endsWith('.oaiusercontent.com'))throw Error('Expected approved file transfer host');
  const response=await fetch(url,{signal:AbortSignal.timeout(300000)});
  if(!response.ok)throw Error('Film download failed');
  const bytes=Buffer.from(await response.arrayBuffer());
  if(createHash('sha256').update(bytes).digest('hex')!==sha)throw Error('Approved film checksum mismatch');
  await writeFile('approved-film.mp4',bytes);
  const info=JSON.parse(execFileSync('ffprobe',['-v','error','-show_chapters','-show_format','-show_streams','-of','json','approved-film.mp4'],{encoding:'utf8'}));
  if(Number(info.format.duration)<180||!info.streams.some(x=>x.codec_type==='audio'))throw Error('Invalid long-form media');
  const chapters=(info.chapters||[]).map(c=>{const s=Math.floor(Number(c.start_time));return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0')+' '+c.tags.title;});
  const sources=JSON.parse(await readFile('productions/'+id+'/media-manifest.json','utf8'));
  const credits=[...new Set(sources.map(s=>[s.author,s.license,s.pageUrl].join(' | ')))];
  const music=spec.music?.asset?JSON.parse(await readFile('catalog/asset-library.json','utf8')):null;
  const find=(v)=>{if(!v||typeof v!=='object')return null;if(v.id===spec.music?.asset)return v;for(const x of Object.values(v)){const f=find(x);if(f)return f;}return null;};
  const track=find(music);
  const description=[...(spec.descriptionLines||[]),'',...chapters,'','映像出典:',...credits,'','音声: VOICEVOX '+spec.voice.speaker,
    track?'音楽: '+[track.title||track.id,track.author||track.creator,track.license,track.sourceUrl||track.url||track.source].filter(Boolean).join(' | '):'',
    '',marker,'Approved-MP4-SHA256: '+sha].filter(x=>x!==undefined).join('\n');
  if(description.length>5000)throw Error('Description too long');
  const state={stage:'upload_started',productionId:id,sha256:sha,channelId:check.channelId,channelTitle:check.channelTitle,startedAt:new Date().toISOString()};
  await writeFile(receipt,JSON.stringify(state),{flag:'wx'});
  let videoId;
  try{
    const init=await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',{method:'POST',headers:{...H,'Content-Type':'application/json','X-Upload-Content-Type':'video/mp4','X-Upload-Content-Length':String(bytes.length)},body:JSON.stringify({snippet:{title:spec.title,description,categoryId:'27',defaultLanguage:'ja'},status:{privacyStatus:'private',selfDeclaredMadeForKids:false}}),signal:AbortSignal.timeout(30000)});
    if(!init.ok)throw Error('Upload initialization failed');
    const session=init.headers.get('location');
    if(!session?.startsWith('https://www.googleapis.com/'))throw Error('Invalid upload session');
    const inserted=await json(await fetch(session,{method:'PUT',headers:{'Content-Type':'video/mp4','Content-Length':String(bytes.length)},body:bytes,signal:AbortSignal.timeout(600000)}),'Upload');
    videoId=inserted.id;if(!videoId)throw Error('Missing video ID');
    await writeFile(receipt,JSON.stringify({...state,stage:'uploaded_private',videoId}));
    await json(await fetch('https://www.googleapis.com/youtube/v3/videos?part=status',{method:'PUT',headers:{...H,'Content-Type':'application/json'},body:JSON.stringify({id:videoId,status:{privacyStatus:'public',selfDeclaredMadeForKids:false}})}),'Publication');
    const done=(await json(await fetch('https://www.googleapis.com/youtube/v3/videos?part=snippet,status&id='+videoId,{headers:H}),'Readback')).items?.[0];
    if(done?.snippet.channelId!==check.channelId||done.status.privacyStatus!=='public')throw Error('Public visibility not confirmed');
    const result={...state,stage:'published_public',videoId,url:'https://www.youtube.com/watch?v='+videoId,finishedAt:new Date().toISOString()};
    await writeFile(receipt,JSON.stringify(result,null,2));console.log(JSON.stringify(result));
  }catch(e){await writeFile(receipt,JSON.stringify({...state,stage:videoId?'publication_unconfirmed':'upload_unknown',videoId,notice:'Inspect existing upload; do not retry automatically'}));throw e;}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});

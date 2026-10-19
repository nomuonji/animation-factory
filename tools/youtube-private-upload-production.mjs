/** Private-only production uploader. Invoked only after the selected channel and human review are verified. */
import {readFile,writeFile,stat} from 'node:fs/promises';
import {resolve} from 'node:path';

const arg=name=>{const i=process.argv.indexOf(name);return i>=0?process.argv[i+1]:null;};
const required=name=>{const v=process.env[name];if(!v)throw Error('Missing '+name);return v;};
async function json(response,label) {
  if(!response.ok)throw Error(label+' HTTP '+response.status);
  try{return await response.json();}catch{throw Error(label+' invalid JSON');}
}
async function credentials() {
  const form=new URLSearchParams({
    client_id:required('YOUTUBE_CLIENT_ID'),
    client_secret:required('YOUTUBE_CLIENT_SECRET'),
    refresh_token:required('YOUTUBE_REFRESH_TOKEN'),grant_type:'refresh_token'
  });
  const token=await json(await fetch('https://oauth2.googleapis.com/token',{
    method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:form,signal:AbortSignal.timeout(30000)
  }),'OAuth');
  if(!token.access_token)throw Error('OAuth access token missing');
  return token.access_token;
}
async function main() {
  if(process.env.ANIMATION_FACTORY_UPLOAD_MODE!=='private_only' ||
     process.env.ANIMATION_FACTORY_REVIEW_CONFIRMED!=='true')
    throw Error('A reviewed production and private-only upload lock are required');
  const audience=required('ANIMATION_FACTORY_MADE_FOR_KIDS');
  if(!['true','false'].includes(audience))throw Error('Select a YouTube audience');
  const format=arg('--format'),mp4=arg('--mp4'),file=arg('--metadata'),receiptArg=arg('--receipt');
  if(!mp4||!file||!receiptArg||!['standard','footage-first'].includes(format))throw Error('Upload arguments are incomplete');
  const metadata=JSON.parse(await readFile(resolve(file),'utf8'));
  const productionId=format==='standard'?metadata.meta?.id:metadata.id;
  const title=format==='standard'?metadata.meta?.title:metadata.title;
  if(!/^[a-z0-9][a-z0-9-]{1,99}$/i.test(productionId||'')||!title||title.length>150)
    throw Error('Missing genuine production identity/title');
  if(metadata.demoOnly===true||/(^demo|smoke|fixture|test)/i.test(productionId))
    throw Error('Technical demos cannot be uploaded');
  let description='';
  if(format==='footage-first') {
    const sources=metadata.sources||[];
    if(!metadata.licenseStatement||!sources.length||sources.some(s=>!s.credit||!s.sourcePage||!s.license))
      throw Error('Missing source attribution or rights review');
    description=[metadata.licenseStatement,
      ...sources.map(s=>[s.credit,s.sourcePage,s.license].join(' | '))].join('\n\n');
  } else {
    if(!Array.isArray(metadata.events)||!metadata.events.length)throw Error('Empty production');
    description=metadata.meta?.description||'';
  }
  description=[description,'Created with Animation Factory.'].filter(Boolean).join('\n\n').slice(0,4800);
  const video=resolve(mp4);
  if((await stat(video)).size<1024)throw Error('No valid rendered MP4');
  const check=JSON.parse(await readFile('ops/youtube-channel-verification.json','utf8'));
  const expected=required('YOUTUBE_CHANNEL_ID');
  if(check.status!=='verified'||check.channelId!==expected||
     !['xeoGIqyAY8I','GatfRfzaH3U','m_JwNRut4DU'].includes(check.historicalVideoMatch))
    throw Error('Current action did not verify ownership of historical Ganbaru YouTube uploads');

  const token=await credentials();
  const headers={Authorization:'Bearer '+token};
  const mine=await json(await fetch('https://www.googleapis.com/youtube/v3/channels?part=id&mine=true',{
    headers,signal:AbortSignal.timeout(30000)
  }),'Channel identity');
  if(mine.items?.length!==1||mine.items[0].id!==expected)
    throw Error('Authenticated channel does not match verified historic channel');

  const receipt=resolve(receiptArg);
  const started={stage:'upload_started',productionId,channelId:expected,visibility:'private',
    sourceRepo:'nomuonji/animation-factory',startedAt:new Date().toISOString()};
  await writeFile(receipt,JSON.stringify(started,null,2),{flag:'wx',mode:0o600});
  try{
    const size=(await stat(video)).size;
    const init=await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',{
      method:'POST',headers:{...headers,'Content-Type':'application/json; charset=UTF-8',
        'X-Upload-Content-Type':'video/mp4','X-Upload-Content-Length':String(size)},
      body:JSON.stringify({snippet:{title:title.slice(0,100),description,categoryId:'22',defaultLanguage:'ja'},
        status:{privacyStatus:'private',selfDeclaredMadeForKids:audience==='true'}}),
      signal:AbortSignal.timeout(30000)
    });
    if(!init.ok)throw Error('Could not open upload session');
    const session=init.headers.get('location');
    if(!session?.startsWith('https://www.googleapis.com/'))
      throw Error('Unsafe or missing upload URL');
    const inserted=await json(await fetch(session,{method:'PUT',headers:{
      'Content-Type':'video/mp4','Content-Length':String(size)},
      body:await readFile(video),signal:AbortSignal.timeout(600000)}),'Private video upload');
    if(!inserted.id)throw Error('YouTube returned no video ID');
    const videos=await json(await fetch('https://www.googleapis.com/youtube/v3/videos?part=snippet,status&id='+encodeURIComponent(inserted.id),{
      headers,signal:AbortSignal.timeout(30000)
    }),'Uploaded video verification');
    const done=videos.items?.[0];
    if(done?.snippet?.channelId!==expected||done?.status?.privacyStatus!=='private')
      throw Error('Uploaded video ownership or visibility cannot be confirmed');
    const success={...started,stage:'uploaded_private',videoId:inserted.id,finishedAt:new Date().toISOString()};
    await writeFile(receipt,JSON.stringify(success,null,2),{mode:0o600});
    console.log(JSON.stringify({stage:'uploaded_private',videoId:inserted.id}));
  }catch{
    const state={...started,stage:'upload_unknown',notice:'Check YouTube Studio before attempting a retry'};
    await writeFile(receipt,JSON.stringify(state,null,2),{mode:0o600});
    throw Error('Unknown upload state; inspect YouTube Studio before a new upload');
  }
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});

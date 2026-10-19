/**
 * Experimental-channel private upload adapter.
 *
 * Deliberately NOT referenced by any workflow. Call manually after channel OAuth
 * is connected and a durable external upload-intent store has been designed.
 * Never auto-retry uncertain uploads or change visibility to public.
 */
import {readFile,writeFile,stat} from 'node:fs/promises';
import {resolve} from 'node:path';

function flag(name) {
  const index=process.argv.indexOf(name);
  return index < 0 ? '' : process.argv[index+1] || '';
}
function requiredEnv(name) {
  const v=process.env[name]?.trim();
  if (!v) throw new Error('Missing ' + name);
  return v;
}
async function jsonOrFail(response,stage) {
  const body=await response.text();
  if (!response.ok) throw new Error(stage+' returned HTTP '+response.status);
  try {return JSON.parse(body);} catch {throw new Error(stage+' returned invalid JSON');}
}
async function token() {
  const form=new URLSearchParams({
    client_id:requiredEnv('YOUTUBE_CLIENT_ID'),
    client_secret:requiredEnv('YOUTUBE_CLIENT_SECRET'),
    refresh_token:requiredEnv('YOUTUBE_REFRESH_TOKEN'),
    grant_type:'refresh_token'
  });
  const response=await fetch('https://oauth2.googleapis.com/token',{
    method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:form,signal:AbortSignal.timeout(20000)
  });
  const data=await jsonOrFail(response,'OAuth refresh');
  if (typeof data.access_token!=='string') throw new Error('Missing access token');
  return data.access_token;
}
async function currentChannel(accessToken) {
  const response=await fetch('https://www.googleapis.com/youtube/v3/channels?part=id&mine=true',{
    headers:{Authorization:'Bearer '+accessToken},signal:AbortSignal.timeout(20000)
  });
  const data=await jsonOrFail(response,'Channel verification');
  if (!Array.isArray(data.items) || data.items.length!==1) throw new Error('Expected one authenticated YouTube channel');
  const actual=data.items[0].id;
  if (actual!==requiredEnv('YOUTUBE_CHANNEL_ID')) throw new Error('Authenticated YouTube channel ID mismatch');
  return actual;
}
async function main() {
  if (process.env.MARKET_SHORTS_UPLOAD_MODE!=='private_only')
    throw new Error('Upload locked: MARKET_SHORTS_UPLOAD_MODE must be private_only');
  const file=flag('--mp4'),experiment=flag('--experiment'),receiptFile=flag('--receipt'),descFile=flag('--description');
  if (!file || !experiment || !receiptFile) throw new Error('Require --mp4, --experiment, --receipt');
  const mp4=resolve(file), record=JSON.parse(await readFile(resolve(experiment),'utf8'));
  if (record.demoOnly) throw new Error('Synthetic fixtures are never uploadable');
  if (record.rightsChecked!==true || record.evidenceChecked!==true ||
      record.uploadStatus!=='not_connected') throw new Error('Unapproved experiment cannot upload');
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(record.sourceIdeaId||''))
    throw new Error('Invalid source idea ID');
  if (process.env.YOUTUBE_MADE_FOR_KIDS!=='true' && process.env.YOUTUBE_MADE_FOR_KIDS!=='false')
    throw new Error('Set YOUTUBE_MADE_FOR_KIDS explicitly after reviewing the content');
  const receipt=resolve(receiptFile);
  try {await stat(receipt);throw new Error('Receipt already exists; reconcile the previous attempt first');}
  catch (e) {if (e.code!=='ENOENT') throw e;}
  // Credits for CC BY / CC BY-SA footage must reach the public description, so a
  // generated description file (with credits) replaces the fixed text when given.
  const description=descFile ? (await readFile(resolve(descFile),'utf8')).slice(0,4900) : '';
  const size=(await stat(mp4)).size;
  if (!(size>0)) throw new Error('Empty video');
  const accessToken=await token();
  const channel=await currentChannel(accessToken);
  const metadata={
    snippet:{
      title:String(record.title || record.sourceIdeaId).slice(0,100),
      description:description || ('市場テーマの検証動画。VOICEVOX Nemo\nsourceIdeaId: '+record.sourceIdeaId+
        '\nvariant: '+String(record.experimentVariant || 'baseline')),
      categoryId:'22',defaultLanguage:'ja'
    },
    status:{privacyStatus:'private',selfDeclaredMadeForKids:process.env.YOUTUBE_MADE_FOR_KIDS==='true'}
  };
  const start=await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',{
    method:'POST',headers:{
      Authorization:'Bearer '+accessToken, 'Content-Type':'application/json; charset=UTF-8',
      'X-Upload-Content-Type':'video/mp4','X-Upload-Content-Length':String(size)
    },body:JSON.stringify(metadata),signal:AbortSignal.timeout(20000)
  });
  if (!start.ok) throw new Error('YouTube upload session could not start: HTTP '+start.status);
  const session=start.headers.get('location');
  if (!session || !session.startsWith('https://www.googleapis.com/'))
    throw new Error('No trusted resumable upload URL; do not start a second session');
  const intent={sourceIdeaId:record.sourceIdeaId,variant:record.experimentVariant || 'baseline',
    channelId:channel,stage:'upload_started',startedAt:new Date().toISOString(),
    sessionUrl:session};
  // Session URL is sensitive. Store this receipt ONLY in a private durable store later.
  await writeFile(receipt,JSON.stringify(intent,null,2),{flag:'wx',mode:0o600});
  try {
    const bytes=await readFile(mp4);
    const response=await fetch(session,{
      method:'PUT',headers:{'Content-Type':'video/mp4','Content-Length':String(size)},
      body:bytes,signal:AbortSignal.timeout(600000)
    });
    const result=await jsonOrFail(response,'YouTube upload');
    if (!result.id) throw new Error('Upload succeeded without a video ID');
    const verify=await fetch('https://www.googleapis.com/youtube/v3/videos?part=snippet,status&id='+encodeURIComponent(result.id),{
      headers:{Authorization:'Bearer '+accessToken},signal:AbortSignal.timeout(20000)
    });
    const checked=await jsonOrFail(verify,'Uploaded-video verification');
    const item=checked.items?.[0];
    if (item?.snippet?.channelId!==channel || item?.status?.privacyStatus!=='private')
      throw new Error('Video uploaded but verification failed; check it manually before any retry');
    const finished={sourceIdeaId:record.sourceIdeaId,variant:record.experimentVariant || 'baseline',
      channelId:channel,videoId:result.id,privacyStatus:'private',
      stage:'uploaded_private',finishedAt:new Date().toISOString()};
    await writeFile(receipt,JSON.stringify(finished,null,2),{mode:0o600});
    console.log(JSON.stringify({stage:finished.stage,videoId:finished.videoId}));
  } catch (e) {
    // Upload may have succeeded; the receipt retains session URL for reconciliation.
    await writeFile(receipt,JSON.stringify({...intent,stage:'upload_unknown',
      error:'Upload/verification response uncertain; reconcile before another insert'},null,2),
      {mode:0o600});
    throw new Error('Upload uncertain; inspect private receipt and YouTube Studio. Do not retry automatically.');
  }
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});

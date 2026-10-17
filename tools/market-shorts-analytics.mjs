/**
 * Read-only YouTube Analytics checkpoint exporter.
 * No scheduler, scores, posting or changes to Keywords' human review.
 */
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

function opt(name) {
  const n=process.argv.indexOf(name);
  return n<0 ? '' : process.argv[n+1]||'';
}
function required(name) {
  const x=process.env[name]?.trim();
  if (!x) throw new Error('Missing '+name);
  return x;
}
function date(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(s+'T00:00:00Z')))
    throw new Error('Expected YYYY-MM-DD');
  return s;
}
async function main() {
  const receipt=opt('--receipt'), out=opt('--out'), checkpoint=opt('--checkpoint');
  if (!receipt || !out || !['24h','72h','7d'].includes(checkpoint))
    throw new Error('Require --receipt, --out, --checkpoint=24h|72h|7d');
  const record=JSON.parse(await readFile(resolve(receipt),'utf8'));
  if (record.stage!=='uploaded_private' || !/^[a-zA-Z0-9_-]{11}$/.test(record.videoId))
    throw new Error('Verified uploaded video receipt required');
  if (record.channelId!==required('YOUTUBE_CHANNEL_ID')) throw new Error('Channel mismatch');
  const start=date(opt('--start')), end=date(opt('--end'));
  if (start>end) throw new Error('Start date exceeds end date');
  const body=new URLSearchParams({
    client_id:required('YOUTUBE_CLIENT_ID'),client_secret:required('YOUTUBE_CLIENT_SECRET'),
    refresh_token:required('YOUTUBE_REFRESH_TOKEN'),grant_type:'refresh_token'
  });
  const auth=await fetch('https://oauth2.googleapis.com/token',{
    method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body,
    signal:AbortSignal.timeout(20000)
  });
  if (!auth.ok) throw new Error('OAuth refresh rejected: HTTP '+auth.status);
  const token=(await auth.json()).access_token;
  if (!token) throw new Error('OAuth access token missing');
  const params=new URLSearchParams({
    ids:'channel==MINE', filters:'video=='+record.videoId,startDate:start,endDate:end,
    metrics:'views,engagedViews,averageViewDuration,likes,comments,shares'
  });
  const result=await fetch('https://youtubeanalytics.googleapis.com/v2/reports?'+params,{
    headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(30000)
  });
  if (!result.ok) throw new Error('YouTube Analytics HTTP '+result.status);
  const data=await result.json();
  const headers=(data.columnHeaders||[]).map(x=>x.name);
  const row=data.rows?.[0] || [];
  const metrics=Object.fromEntries(headers.map((key,i)=>[key,row[i]??null]));
  const snapshot={source:'youtube_analytics',sourceIdeaId:record.sourceIdeaId,
    videoId:record.videoId,checkpoint,startDate:start,endDate:end,metrics,
    retrievedAt:new Date().toISOString(),notes:'Daily Analytics reports may lag; checkpoint refers to collection time, not an exact rolling-hour window.'};
  await writeFile(resolve(out),JSON.stringify(snapshot,null,2)+'\n');
  console.log(JSON.stringify({videoId:record.videoId,checkpoint,reported:row.length>0}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});

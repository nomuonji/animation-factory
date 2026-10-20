/**
 * Pre-flight guard for automatic publishing. Exits non-zero (and publishes nothing) unless:
 *  - repository variable AUTO_PUBLISH_ENABLED is exactly "true" (kill switch)
 *  - fewer than MAX_PER_DAY videos went public on the channel today (JST)
 *  - no video on the channel already carries "Production-ID: <production>" (duplicate guard)
 * The channel itself is the ledger, so nothing has to be committed back to the repository.
 * Usage: node tools/shorts-publish-guard.mjs <production-id>
 */
const prod=process.argv[2]||'';
const need=n=>{const v=process.env[n]?.trim();if(!v)throw new Error('Missing '+n);return v;};
async function j(r,stage){const t=await r.text();if(!r.ok)throw new Error(stage+' HTTP '+r.status+' '+t.slice(0,300));return JSON.parse(t);}
async function main(){
  if(!/^[a-z0-9][a-z0-9-]{2,63}$/.test(prod))throw new Error('Bad production id');
  if(process.env.AUTO_PUBLISH_ENABLED!=='true'){console.log('Auto publishing is switched off (AUTO_PUBLISH_ENABLED != true).');process.exit(3);}
  const max=Number(process.env.MAX_PER_DAY||3);
  const tok=await j(await fetch('https://oauth2.googleapis.com/token',{method:'POST',
    headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({
    client_id:need('YOUTUBE_CLIENT_ID'),client_secret:need('YOUTUBE_CLIENT_SECRET'),
    refresh_token:need('YOUTUBE_REFRESH_TOKEN'),grant_type:'refresh_token'})}),'OAuth');
  const H={Authorization:'Bearer '+tok.access_token};
  const ch=(await j(await fetch('https://www.googleapis.com/youtube/v3/channels?part=contentDetails&mine=true',{headers:H}),'channel')).items;
  if(ch?.length!==1||ch[0].id!==need('YOUTUBE_CHANNEL_ID'))throw new Error('Channel mismatch');
  const up=ch[0].contentDetails.relatedPlaylists.uploads;
  const pl=(await j(await fetch('https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=50&playlistId='+up,{headers:H}),'uploads')).items||[];
  const ids=pl.map(i=>i.contentDetails.videoId);
  const vids=ids.length?(await j(await fetch('https://www.googleapis.com/youtube/v3/videos?part=snippet,status&id='+ids.join(','),{headers:H}),'videos')).items:[];
  const jst=d=>new Date(new Date(d).getTime()+9*3600e3).toISOString().slice(0,10);
  const today=jst(Date.now());
  let publicToday=0;
  for(const v of vids){
    if((v.snippet.description||'').includes('Production-ID: '+prod)){
      console.log('Duplicate: '+prod+' already on the channel as '+v.id+' ('+v.status.privacyStatus+')');process.exit(4);}
    if(v.status.privacyStatus==='public'&&jst(v.snippet.publishedAt)===today)publicToday++;
  }
  if(publicToday>=max){console.log('Daily cap reached: '+publicToday+'/'+max+' public videos today (JST).');process.exit(5);}
  console.log('Guard OK: '+publicToday+'/'+max+' today, '+prod+' is new.');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});

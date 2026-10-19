/**
 * Switch specific, already-uploaded private videos to public. Manual only.
 * Refuses videos that are not on the authenticated channel or not currently private.
 */
const ids=(process.argv[2]||'').split(',').map(s=>s.trim()).filter(Boolean);
const need=n=>{const v=process.env[n]?.trim();if(!v)throw new Error('Missing '+n);return v;};
async function j(r,stage){const t=await r.text();if(!r.ok)throw new Error(stage+' HTTP '+r.status+' '+t.slice(0,300));return JSON.parse(t);}
async function main(){
  if(!ids.length||ids.some(i=>!/^[A-Za-z0-9_-]{11}$/.test(i)))throw new Error('Give comma-separated video IDs');
  const tok=await j(await fetch('https://oauth2.googleapis.com/token',{method:'POST',
    headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({
    client_id:need('YOUTUBE_CLIENT_ID'),client_secret:need('YOUTUBE_CLIENT_SECRET'),
    refresh_token:need('YOUTUBE_REFRESH_TOKEN'),grant_type:'refresh_token'})}),'OAuth');
  const H={Authorization:'Bearer '+tok.access_token,'Content-Type':'application/json'};
  for(const id of ids){
    const v=(await j(await fetch('https://www.googleapis.com/youtube/v3/videos?part=snippet,status&id='+id,{headers:H}),'get')).items?.[0];
    if(!v)throw new Error(id+': not found');
    if(v.snippet.channelId!==need('YOUTUBE_CHANNEL_ID'))throw new Error(id+': not on the expected channel');
    if(v.status.privacyStatus==='public'){console.log(id,'already public');continue;}
    if(v.status.privacyStatus!=='private')throw new Error(id+': unexpected state '+v.status.privacyStatus);
    const status={...v.status,privacyStatus:'public'};
    delete status.uploadStatus;delete status.publishAt;
    await j(await fetch('https://www.googleapis.com/youtube/v3/videos?part=status',{method:'PUT',headers:H,
      body:JSON.stringify({id,status})}),'update');
    const after=(await j(await fetch('https://www.googleapis.com/youtube/v3/videos?part=status&id='+id,{headers:H}),'verify')).items[0];
    console.log(id,'->',after.status.privacyStatus,'https://youtu.be/'+id);
  }
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});

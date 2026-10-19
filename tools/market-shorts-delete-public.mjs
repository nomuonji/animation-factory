/**
 * List (default) or delete every PUBLIC video on the authenticated channel. Manual only.
 * Deletion is permanent. It runs only with --delete, and only for the expected channel.
 */
const doDelete=process.argv.includes('--delete');
const need=n=>{const v=process.env[n]?.trim();if(!v)throw new Error('Missing '+n);return v;};
async function j(r,stage){const t=await r.text();if(!r.ok)throw new Error(stage+' HTTP '+r.status+' '+t.slice(0,300));return t?JSON.parse(t):{};}
async function main(){
  const tok=await j(await fetch('https://oauth2.googleapis.com/token',{method:'POST',
    headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({
    client_id:need('YOUTUBE_CLIENT_ID'),client_secret:need('YOUTUBE_CLIENT_SECRET'),
    refresh_token:need('YOUTUBE_REFRESH_TOKEN'),grant_type:'refresh_token'})}),'OAuth');
  const H={Authorization:'Bearer '+tok.access_token};
  const ch=(await j(await fetch('https://www.googleapis.com/youtube/v3/channels?part=id,contentDetails&mine=true',{headers:H}),'channel')).items;
  if(ch?.length!==1||ch[0].id!==need('YOUTUBE_CHANNEL_ID'))throw new Error('Authenticated channel is not the expected one');
  const uploads=ch[0].contentDetails.relatedPlaylists.uploads;
  const ids=[];let page='';
  do{
    const r=await j(await fetch('https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=50&playlistId='+uploads+(page?'&pageToken='+page:''),{headers:H}),'list');
    ids.push(...r.items.map(i=>i.contentDetails.videoId));page=r.nextPageToken||'';
  }while(page);
  const pub=[];
  for(let i=0;i<ids.length;i+=50){
    const r=await j(await fetch('https://www.googleapis.com/youtube/v3/videos?part=snippet,status&id='+ids.slice(i,i+50).join(','),{headers:H}),'videos');
    for(const v of r.items)if(v.status.privacyStatus==='public'&&v.snippet.channelId===ch[0].id)pub.push(v);
  }
  console.log(`${ids.length} uploads on the channel, ${pub.length} public`);
  for(const v of pub)console.log(v.id,'|',v.snippet.publishedAt,'|',v.snippet.title);
  if(!doDelete){console.log('DRY RUN: nothing deleted');return;}
  for(const v of pub){
    await j(await fetch('https://www.googleapis.com/youtube/v3/videos?id='+v.id,{method:'DELETE',headers:H}),'delete');
    console.log('deleted',v.id);
  }
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});

import {google} from 'googleapis';
import {readFileSync} from 'node:fs';
const expected='UCka8SDf1XsNGVccbyLTj8cA';
export async function verifyGanbaruChannel(){
  const record=JSON.parse(readFileSync('ops/youtube-channel-verification.json','utf8'));
  if(record.status!=='verified'||record.channelId!==expected||!record.historicalVideoMatch)throw Error('Historical verification record mismatch');
  for(const name of ['YOUTUBE_CLIENT_ID','YOUTUBE_CLIENT_SECRET','YOUTUBE_REFRESH_TOKEN'])if(!process.env[name])throw Error('Missing Actions secret: '+name);
  const auth=new google.auth.OAuth2(process.env.YOUTUBE_CLIENT_ID,process.env.YOUTUBE_CLIENT_SECRET);
  auth.setCredentials({refresh_token:process.env.YOUTUBE_REFRESH_TOKEN});
  const youtube=google.youtube({version:'v3',auth});
  const mine=(await youtube.channels.list({part:['id','snippet'],mine:true})).data.items||[];
  if(mine.length!==1||mine[0].id!==expected)throw Error('OAuth channel does not match verified Ganbaru ID');
  return {id:expected,title:mine[0].snippet?.title,youtube};
}

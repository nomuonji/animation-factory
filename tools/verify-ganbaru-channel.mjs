/**
 * Validate that Animation Factory's OAuth secrets resolve to the channel that
 * published historical 今日の頑張り videos. No upload, no token in output.
 *
 * Safe status is persisted for independent GitHub connector readback.
 */
import {mkdir, writeFile} from 'node:fs/promises';

const output = 'ops/youtube-channel-verification.json';
const history = ['xeoGIqyAY8I', 'GatfRfzaH3U', 'm_JwNRut4DU'];
const result = {
  source: 'nomuonji/animation-factory',
  destination: '今日の頑張り',
  checkedAt: new Date().toISOString(),
  status: 'unverified'
};

async function fetchJson(url, options, label) {
  const response = await fetch(url, {...options, signal: AbortSignal.timeout(30000)});
  if (!response.ok) throw new Error(label);
  const json = await response.json();
  if (!json || typeof json !== 'object') throw new Error(label);
  return json;
}
function env(name) {
  const value = process.env[name];
  if (!value) throw new Error('missing_' + name.toLowerCase());
  return value;
}
async function check() {
  const body = new URLSearchParams({
    client_id: env('YOUTUBE_CLIENT_ID'),
    client_secret: env('YOUTUBE_CLIENT_SECRET'),
    refresh_token: env('YOUTUBE_REFRESH_TOKEN'),
    grant_type:'refresh_token'
  });
  const auth = await fetchJson('https://oauth2.googleapis.com/token', {
    method:'POST',
    headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body
  }, 'oauth_refresh_failed');
  if (!auth.access_token) throw new Error('oauth_access_token_missing');
  const headers = {Authorization:'Bearer ' + auth.access_token};
  const mine = await fetchJson('https://www.googleapis.com/youtube/v3/channels?part=id,snippet&mine=true',
    {headers}, 'youtube_channel_lookup_failed');
  if (!Array.isArray(mine.items) || mine.items.length !== 1 || !mine.items[0].id)
    throw new Error('youtube_channel_ambiguous');
  const channelId = mine.items[0].id;
  const videos = await fetchJson('https://www.googleapis.com/youtube/v3/videos?part=snippet&id=' + history.join(','),
    {headers}, 'youtube_history_lookup_failed');
  const ownVideo = (videos.items || []).find(v=>v?.snippet?.channelId === channelId);
  if (!ownVideo) throw new Error('youtube_channel_does_not_own_historical_ganbaru_video');

  result.status = 'verified';
  result.channelId = channelId;
  result.channelTitle = mine.items[0].snippet?.title || null;
  result.historicalVideoMatch = ownVideo.id;
  const expected = process.env.YOUTUBE_CHANNEL_ID?.trim();
  result.configurationStatus = !expected ? 'channel_id_variable_missing' :
    (expected === channelId ? 'ready' : 'configured_channel_id_mismatch');
  if (result.configurationStatus !== 'ready') {
    result.status = 'needs_configuration';
    process.exitCode = 1;
  }
}
try {
  await check();
} catch (err) {
  result.status = 'verification_failed';
  const reason = String(err?.message || 'unknown_failure');
  result.reason = /^([a-z][a-z0-9_]*)$/.test(reason) ? reason : 'unexpected_error';
  process.exitCode = 1;
}
await mkdir('ops',{recursive:true});
await writeFile(output, JSON.stringify(result,null,2) + '\n');
console.log(JSON.stringify(result));

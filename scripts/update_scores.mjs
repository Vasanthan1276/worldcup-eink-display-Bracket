/**
 * Scheduled GitHub Actions cache updater.
 * The display itself also fetches the live feed directly. This script writes the
 * latest successful response into public/data/live.json, so the display keeps
 * working when the public API is unavailable from the e-ink browser.
 */
import { readFile, writeFile } from 'node:fs/promises';
const url='https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?limit=500&dates=20260601-20260731';
const target='public/data/live.json';
const feed=await fetch(url,{headers:{'user-agent':'worldcup-eink-display/1.0'}});
if(!feed.ok) throw new Error(`Live score feed failed: ${feed.status}`);
const json=await feed.json();
const current=JSON.parse(await readFile(target,'utf8'));
function number(event){const text=[event.name,event.shortName,event.notes?.[0]?.headline,event.competitions?.[0]?.notes?.[0]?.headline].filter(Boolean).join(' ');const hit=text.match(/(?:match|game)\s*(\d{2,3})/i);return hit?'M'+hit[1]:null;}
const byId=new Map((current.matches||[]).map(m=>[m.id,m]));
for(const event of json.events||[]){
  const id=number(event); if(!id) continue;
  const c=event.competitions?.[0], competitors=c?.competitors||[]; if(competitors.length<2) continue;
  const teams=competitors.sort((a,b)=>a.homeAway==='home'?-1:1).map(x=>({name:x.team?.displayName||'TBD',score:x.score??'–',winner:!!x.winner}));
  byId.set(id,{id,time:event.date,venue:c?.venue?.fullName||'',status:event.status?.type?.completed?'final':event.status?.type?.state||'scheduled',teams,winner:teams.find(t=>t.winner)?.name||null});
}
const output={updatedAt:new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Singapore',dateStyle:'medium',timeStyle:'short',hour12:false}).format(new Date()).replace(',',' · ')+' SGT',matches:[...byId.values()].sort((a,b)=>Number(a.id.slice(1))-Number(b.id.slice(1)))};
await writeFile(target,JSON.stringify(output,null,2)+'\n');

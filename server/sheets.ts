import { importPKCS8, SignJWT } from 'jose';
import { type Env, type Actor, assert, now } from './types';
import { progress } from './store';
let tokenCache:{email:string;token:string;until:number}|undefined;
async function token(env:Env){
  assert(env.GOOGLE_SERVICE_ACCOUNT,'Sheet service account is not configured.',503);
  const sa=JSON.parse(env.GOOGLE_SERVICE_ACCOUNT);
  if(tokenCache&&tokenCache.email===sa.client_email&&tokenCache.until>Date.now())return tokenCache.token;
  const key=await importPKCS8(sa.private_key,'RS256');
  const jwt=await new SignJWT({scope:'https://www.googleapis.com/auth/spreadsheets'}).setProtectedHeader({alg:'RS256'}).setIssuer(sa.client_email).setAudience('https://oauth2.googleapis.com/token').setIssuedAt().setExpirationTime('1h').sign(key);
  const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:jwt})});
  assert(response.ok,'Google service account authentication failed.',502);const data=await response.json<any>();
  tokenCache={email:sa.client_email,token:data.access_token,until:Date.now()+Math.min(data.expires_in,3500)*1000};return data.access_token as string;
}
export async function sheets(env:Env,path:string,body?:unknown){
  const response=await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(env.SPREADSHEET_ID)}${path}`,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${await token(env)}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
  if(!response.ok)throw new Error(response.status===403?'Google Sheet access revoked or insufficient. Share the configured workbook with the service account.':`Google Sheets returned ${response.status}; update remains pending.`);
  return response.json<any>();
}
export const PROGRESS_HEADERS=['Record ID','Condition / presentation','Type','Body systems','Blocks','CCS status','Accuracy (%)','Domain coverage','Evidence count','Last assessed','Next review','Reason','Rule version'];
export const SESSION_HEADERS=['Session ID','Completed at','Pack','Score','Total','Accuracy (%)','Synapse link'];
export const MSK_HEADERS=['CCS status','Accuracy (%)','Domain coverage','Last assessed','Next review'];
export function mskProjection(values:any[][]){
  const header=values[0]??[];
  assert(header[0]==='Record ID','MSK Record ID column changed; refusing to write.',409);
  const managed=MSK_HEADERS.every((h,i)=>header[i+1]===h);
  assert(managed||values.every(r=>r.slice(1).every(v=>v===''||v==null)),'MSK J:N contains unrecognised content; refusing to overwrite it.',409);
  return [{range:"'MSK'!J4:N4",values:[MSK_HEADERS]},...values.slice(1).flatMap((r,i)=>{
    if(!r[0])return [];const row=i+5;
    return [{range:`'MSK'!J${row}:N${row}`,values:[[6,7,8,10,11].map(col=>`=IFERROR(VLOOKUP($I${row},'CCS Progress'!$A:$M,${col},FALSE),"")`)]}];
  })];
}
async function verifyHeaders(env:Env,title:string,headers:string[]){
  const data=await sheets(env,`/values/${encodeURIComponent(`'${title}'!A1:${String.fromCharCode(64+headers.length)}1`)}`);
  const row=data.values?.[0]??[];
  assert(!row.length||headers.every((h,i)=>row[i]===h),`${title} headers changed; refusing to overwrite unrelated content.`,409);
}
export async function syncSheets(env:Env,force=false){
  if(env.SHEETS_ENABLED!=='true')return {status:'not_configured'};
  const time=now(),lock=crypto.randomUUID(),expiry=Date.now()+240000;
  const taken=await env.DB.prepare("INSERT INTO settings(key,value) VALUES('sheet_lock',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value WHERE CAST(json_extract(settings.value,'$.until') AS INTEGER)<?").bind(JSON.stringify({id:lock,until:expiry}),Date.now()).run();
  if(!taken.meta.changes)return {status:'busy'};
  try{
    const jobs=await env.DB.prepare(`SELECT * FROM sync_jobs WHERE status IN ('pending','error') ${force?'':'AND next_at<=?'} ORDER BY updated_at LIMIT 50`).bind(...(force?[]:[time])).all<any>();
    if(!jobs.results.length)return {status:'synced'};
    const actor:Actor={id:jobs.results[0].owner,email:env.OWNER_EMAIL};
    const owned=jobs.results.filter(j=>j.owner===actor.id);
    try{
      let meta=await sheets(env,'?fields=sheets.properties');
      const missing=['CCS Progress','CCS Sessions'].filter(title=>!meta.sheets.some((s:any)=>s.properties.title===title));
      if(missing.length)await sheets(env,':batchUpdate',{requests:missing.map(title=>({addSheet:{properties:{title,gridProperties:{rowCount:2000,columnCount:20,frozenRowCount:1}}}}))});
      await verifyHeaders(env,'CCS Progress',PROGRESS_HEADERS);await verifyHeaders(env,'CCS Sessions',SESSION_HEADERS);
      const ps=await progress(env,actor);
      const sessions=await env.DB.prepare("SELECT s.*,p.title,(SELECT count(*) FROM questions q WHERE q.pack_id=s.pack_id) total FROM sessions s JOIN packs p ON p.id=s.pack_id WHERE s.owner=? AND s.status='completed' ORDER BY s.completed_at").bind(actor.id).all<any>();
      meta=await sheets(env,'?fields=sheets.properties');
      const resize=[];
      for(const [title,count] of [['CCS Progress',ps.length+1],['CCS Sessions',sessions.results.length+1]] as const){const s=meta.sheets.find((s:any)=>s.properties.title===title).properties;if(s.gridProperties.rowCount<count)resize.push({updateSheetProperties:{properties:{sheetId:s.sheetId,gridProperties:{rowCount:count+100}},fields:'gridProperties.rowCount'}});}
      if(resize.length)await sheets(env,':batchUpdate',{requests:resize});
      const rows=ps.map(p=>[p.id,p.label,p.type,p.systems.join(', '),p.blocks.join(', '),p.status,p.accuracy===null?'':Number(p.accuracy.toFixed(2)),`${p.coverage}/5`,p.evidenceCount,p.lastAssessed??'',p.nextReview??'',p.reason,p.ruleVersion]);
      const sessionRows=sessions.results.map(s=>[s.id,s.completed_at,s.title,s.score,s.total,s.score/s.total*100,`${env.APP_ORIGIN}/?session=${s.id}`]);
      // Replacing the ID-keyed projection makes an ambiguous timeout safe to retry.
      await sheets(env,'/values:batchUpdate',{valueInputOption:'RAW',data:[{range:"'CCS Progress'!A1",values:[PROGRESS_HEADERS,...rows]},{range:"'CCS Sessions'!A1",values:[SESSION_HEADERS,...sessionRows]}]});
      if(meta.sheets.some((s:any)=>s.properties.title==='MSK')){
        const msk=await sheets(env,`/values/${encodeURIComponent("'MSK'!I4:N1000")}?valueRenderOption=FORMULA`);
        await sheets(env,'/values:batchUpdate',{valueInputOption:'USER_ENTERED',data:mskProjection(msk.values??[])});
      }
      const verify=await sheets(env,`/values/${encodeURIComponent("'CCS Sessions'!A1:A"+(sessionRows.length+1))}`);
      assert(JSON.stringify(verify.values?.slice(1).map((r:any)=>r[0])??[])===JSON.stringify(sessionRows.map(r=>r[0])),'Sheet verification failed.',502);
      await env.DB.prepare("UPDATE sync_jobs SET status='synced',error=NULL,updated_at=? WHERE id IN (SELECT value FROM json_each(?))").bind(now(),JSON.stringify(owned.map(j=>j.id))).run();
      return {status:'synced',at:now()};
    }catch(e){
      const message=e instanceof Error?e.message:'Sheet update failed';
      const retries=owned.map(j=>({id:j.id,next:new Date(Date.now()+Math.min(3600000,300000*2**Math.min(j.attempts,4))).toISOString()}));
      await env.DB.prepare("UPDATE sync_jobs SET status='error',attempts=attempts+1,next_at=(SELECT json_extract(value,'$.next') FROM json_each(?) WHERE json_extract(value,'$.id')=sync_jobs.id),error=?,updated_at=? WHERE id IN (SELECT json_extract(value,'$.id') FROM json_each(?))").bind(JSON.stringify(retries),message,now(),JSON.stringify(retries)).run();
      return {status:'pending',error:message};
    }
  }finally{await env.DB.prepare("DELETE FROM settings WHERE key='sheet_lock' AND json_extract(value,'$.id')=?").bind(lock).run();}
}

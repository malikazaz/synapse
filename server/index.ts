import {curriculumContext,previewCurriculum,confirmCurriculum} from './curriculum';
import {performanceProfile} from './performance';
import OAuthProvider from '@cloudflare/workers-oauth-provider';
import { ZodError,z } from 'zod';
import { type Env,assert,HttpError,json,now } from './types';
import { actorFor,authRoute,checkOrigin } from './auth';
import * as store from './store';
import { syncSheets } from './sheets';
import { mcpHandler } from './mcp';
import { exportBackup,restoreBackup } from './backup';
import { uuid } from './schema';
import {previewCatalog,confirmCatalog} from './catalog';
import {getStudySettings,saveStudySettings} from './study';

async function body(req:Request){
  assert(Number(req.headers.get('content-length')??0)<=2*1024*1024,'Request too large.',413);
  const reader=req.body?.getReader();assert(reader,'Request body missing.');const chunks:Uint8Array[]=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>2*1024*1024){await reader.cancel();throw new HttpError(413,'Request too large.');}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}return JSON.parse(new TextDecoder().decode(bytes));
}
async function routes(req:Request,env:Env,ctx:ExecutionContext):Promise<Response>{
  const url=new URL(req.url),path=url.pathname;
  if(path.startsWith('/auth/')||path==='/authorize'){const r=await authRoute(req,env);if(r)return r;}
  if(path==='/api/status')return json({connected:!!(env.GOOGLE_CLIENT_ID&&env.GOOGLE_CLIENT_SECRET),sheetsConfigured:env.SHEETS_ENABLED==='true',actor:await actorFor(req,env)});
  if(!path.startsWith('/api/'))return env.ASSETS.fetch(req);
  const actor=await actorFor(req,env);assert(actor,'Sign in to access your saved work.',401);
  if(req.method!=='GET')checkOrigin(req,env);
  const parts=path.split('/').filter(Boolean);
  if(path==='/api/curriculum'&&req.method==='GET'){
    const filter=z.object({offset:z.coerce.number().int().min(0).default(0),limit:z.coerce.number().int().min(1).max(500).default(100)}).parse(Object.fromEntries(url.searchParams));
    return json(await curriculumContext(env,filter));
  }
  if(path==='/api/curriculum/preview'&&req.method==='POST')return json(await previewCurriculum(env,actor,await body(req)));
  if(path==='/api/curriculum/confirm'&&req.method==='POST'){const d=z.object({previewId:uuid}).strict().parse(await body(req));const result=await confirmCurriculum(env,actor,d.previewId);ctx.waitUntil(syncSheets(env));return json(result);}
  if(path==='/api/topics'&&req.method==='GET')return json(await store.topics(env));
  if(path==='/api/study-settings'&&req.method==='GET')return json(await getStudySettings(env,actor));
  if(path==='/api/study-settings'&&req.method==='POST')return json(await saveStudySettings(env,actor,await body(req)));
  if(path==='/api/catalog/preview'&&req.method==='POST')return json(await previewCatalog(env,actor,await body(req)));
  if(path==='/api/catalog/confirm'&&req.method==='POST'){const d=z.object({previewId:uuid}).strict().parse(await body(req));return json(await confirmCatalog(env,actor,d.previewId));}
  if(path==='/api/progress'&&req.method==='GET')return json(await store.progress(env,actor));
  if(path==='/api/packs'){
    if(req.method==='POST')return json(await store.savePack(env,actor,await body(req),'imported'),201);
    if(req.method==='GET')return json((await env.DB.prepare('SELECT p.id,p.title,p.mode,p.origin,p.created_at,(SELECT COUNT(*) FROM questions q WHERE q.pack_id=p.id) AS question_count FROM packs p WHERE p.owner=? ORDER BY p.created_at DESC LIMIT 500').bind(actor.id).all()).results);
  }
  if(parts[1]==='packs'&&parts.length===3&&req.method==='GET')return json(await store.getPack(env,actor,uuid.parse(parts[2])));
  if(path==='/api/sessions'){
    if(req.method==='POST')return json(await store.createSession(env,actor,await body(req)),201);
    if(req.method==='GET')return json((await env.DB.prepare('SELECT s.id,s.pack_id,s.status,s.revision,s.started_at,s.completed_at,s.score,p.title,json_array_length(s.state,\'$.order\') AS question_count,(SELECT COUNT(DISTINCT a.question_id) FROM answer_events a WHERE a.session_id=s.id) AS answered FROM sessions s JOIN packs p ON p.id=s.pack_id WHERE s.owner=? ORDER BY COALESCE(s.completed_at,s.started_at) DESC LIMIT 100').bind(actor.id).all()).results);
  }
  if(parts[1]==='sessions'&&parts.length===3){
    const id=uuid.parse(parts[2]);if(req.method==='GET')return json(await store.getSession(env,actor,id));
    if(req.method==='POST'){const s=await store.updateSession(env,actor,id,await body(req));if(s.status==='completed')ctx.waitUntil(syncSheets(env));return json(s);}
  }
  if(path==='/api/performance'&&req.method==='GET')return json(await performanceProfile(env,actor,{topicId:url.searchParams.get('topicId')??undefined,block:url.searchParams.get('block')??undefined,allBlocks:url.searchParams.get('allBlocks')==='true'}));
  if(path==='/api/results'&&req.method==='GET')return json(await store.results(env,actor,url.searchParams.get('id')||undefined));
  if(path==='/api/mappings'&&req.method==='POST')return json(await store.proposeMappings(env,actor,await body(req)));
  if(path==='/api/mappings'&&req.method==='GET')return json((await env.DB.prepare("SELECT * FROM mapping_proposals WHERE owner=? AND pack_id=? AND status='pending'").bind(actor.id,uuid.parse(url.searchParams.get('packId'))).all<any>()).results.map(r=>({...r,payload:JSON.parse(r.payload)})));
  if(parts[1]==='mappings'&&parts[3]==='confirm'&&req.method==='POST'){const r=await store.confirmMappings(env,actor,uuid.parse(parts[2]));ctx.waitUntil(syncSheets(env));return json(r);}
  if(path==='/api/exclusions'&&req.method==='POST'){const r=await store.excludeQuestion(env,actor,await body(req));ctx.waitUntil(syncSheets(env));return json(r);}
  if(path==='/api/sync'&&req.method==='GET')return json({enabled:env.SHEETS_ENABLED==='true',jobs:(await env.DB.prepare('SELECT status,error,updated_at FROM sync_jobs WHERE owner=? ORDER BY updated_at DESC LIMIT 10').bind(actor.id).all()).results});
  if(path==='/api/sync'&&req.method==='POST')return json(await syncSheets(env,true));
  if(path==='/api/backup'&&req.method==='GET')return json(await exportBackup(env,actor));
  if(path==='/api/restore'&&req.method==='POST')return json(await restoreBackup(env,actor,await body(req)));
  throw new HttpError(404,'Endpoint not found.');
}
export async function handle(req:Request,env:Env,ctx:ExecutionContext){
  try{return await routes(req,env,ctx);}catch(e){if(e instanceof ZodError)return json({error:'Invalid input.',details:e.issues},400);if(e instanceof HttpError)return json({error:e.message,details:e.details},e.status);if(e instanceof SyntaxError)return json({error:'Invalid JSON.'},400);console.error('request_failed',e instanceof Error?e.name:'Error');return json({error:'Request failed. Your saved work has not been discarded.'},500);}
}
export default {
  async fetch(req:Request,env:Env,ctx:ExecutionContext){
    // No development authentication bypass; local anonymous quizzes still work.
    const provider=new OAuthProvider<Env>({
      apiRoute:'/mcp',apiHandler:{fetch:(r:any,e:any,c:any)=>mcpHandler(r,e,c)},
      defaultHandler:{fetch:handle},authorizeEndpoint:'/authorize',tokenEndpoint:'/oauth/token',clientRegistrationEndpoint:'/oauth/register',
      scopesSupported:['mcp:read','mcp:write','offline_access'],requiredScopes:['mcp:read','mcp:write'],
      resourceMetadata:{resource:env.APP_ORIGIN+'/mcp',authorization_servers:[env.APP_ORIGIN]},
      accessTokenTTL:3600,refreshTokenTTL:30*86400
    });
    try{return await provider.fetch(req,env,ctx);}catch(e){return json({error:e instanceof HttpError?e.message:'Authentication service unavailable.'},e instanceof HttpError?e.status:503);}
  },
  async scheduled(_event:ScheduledController,env:Env,ctx:ExecutionContext){ctx.waitUntil(syncSheets(env));ctx.waitUntil(env.DB.batch([env.DB.prepare('DELETE FROM web_sessions WHERE expires_at<?').bind(Date.now()),env.DB.prepare('DELETE FROM login_states WHERE expires_at<?').bind(Date.now())]));}
};

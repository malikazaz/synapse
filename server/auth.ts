import { createRemoteJWKSet, jwtVerify } from 'jose';
import { digest } from '../shared/quiz.js';
import { assert, type Env, type Actor } from './types';
const jwks=createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
const cookieName='synapse_session';
const cookie=(req:Request,name:string)=>req.headers.get('Cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='))?.slice(name.length+1);
export const escape=(s:unknown)=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function safeReturn(value:string|null){return value?.startsWith('/')&&!value.startsWith('//')&&!value.includes('\\')?value:'/';}
export function consentPolicy(redirectUri:string){
  // Chromium checks form-action against the redirect destination as well as
  // the form target. parseAuthRequest has already validated the registered URI.
  const callback=new URL(redirectUri);
  assert(/^https?:$/.test(callback.protocol)&&/^https?:\/\/[a-z0-9.\[\]:-]+$/i.test(callback.origin),'Unsupported callback origin.');
  return `default-src 'self'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'; form-action 'self' ${callback.origin}`;
}
export function checkOrigin(req:Request,env:Env){assert(req.headers.get('Origin')===env.APP_ORIGIN,'Cross-origin request rejected.',403);}
export async function actorFor(req:Request,env:Env):Promise<Actor|null>{
  const token=cookie(req,cookieName);if(!token)return null;
  const row=await env.DB.prepare('SELECT owner FROM web_sessions WHERE token_hash=? AND expires_at>?').bind(await digest(token),Date.now()).first<any>();
  return row?{id:row.owner,email:env.OWNER_EMAIL}:null;
}
function sessionCookie(token:string,env:Env,seconds:number){return `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${seconds}${env.APP_ORIGIN.startsWith('https:')?'; Secure':''}`;}
export async function authRoute(req:Request,env:Env){
  const url=new URL(req.url);
  if(url.pathname==='/auth/login'){
    assert(env.GOOGLE_CLIENT_ID&&env.GOOGLE_CLIENT_SECRET,'Google sign-in has not been configured.',503);
    const state=crypto.randomUUID(),nonce=crypto.randomUUID();
    await env.DB.prepare('INSERT INTO login_states VALUES(?,?,?,?)').bind(state,nonce,safeReturn(url.searchParams.get('returnTo')),Date.now()+600000).run();
    const target=new URL('https://accounts.google.com/o/oauth2/v2/auth');
    target.search=new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,redirect_uri:env.APP_ORIGIN+'/auth/callback',response_type:'code',scope:'openid email',state,nonce,prompt:'select_account'}).toString();
    return new Response(null,{status:302,headers:{Location:target.toString(),'Set-Cookie':`synapse_login=${state}; Path=/auth; HttpOnly; SameSite=Lax; Max-Age=600${env.APP_ORIGIN.startsWith('https:')?'; Secure':''}`,'Cache-Control':'no-store'}});
  }
  if(url.pathname==='/auth/callback'){
    const state=url.searchParams.get('state');assert(state&&state===cookie(req,'synapse_login'),'Invalid sign-in state.',403);
    const record=await env.DB.prepare('DELETE FROM login_states WHERE id=? AND expires_at>? RETURNING *').bind(state,Date.now()).first<any>();assert(record,'Sign-in expired.',403);
    const code=url.searchParams.get('code');assert(code,'Google sign-in cancelled.',400);
    const res=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID!,client_secret:env.GOOGLE_CLIENT_SECRET!,code,grant_type:'authorization_code',redirect_uri:env.APP_ORIGIN+'/auth/callback'})});
    assert(res.ok,'Google sign-in failed.',502);const tokens=await res.json<any>();
    const {payload}=await jwtVerify(tokens.id_token,jwks,{audience:env.GOOGLE_CLIENT_ID,issuer:['https://accounts.google.com','accounts.google.com']});
    assert(payload.nonce===record.nonce&&payload.email_verified===true&&String(payload.email).toLowerCase()===env.OWNER_EMAIL.toLowerCase()&&payload.sub,'This account is not authorised.',403);
    const token=crypto.randomUUID()+crypto.randomUUID();await env.DB.prepare('INSERT INTO web_sessions VALUES(?,?,?)').bind(await digest(token),payload.sub,Date.now()+30*86400000).run();
    return new Response(null,{status:302,headers:{Location:env.APP_ORIGIN+safeReturn(record.return_to),'Set-Cookie':sessionCookie(token,env,30*86400),'Cache-Control':'no-store'}});
  }
  if(url.pathname==='/auth/logout'&&req.method==='POST'){
    checkOrigin(req,env);const token=cookie(req,cookieName);if(token)await env.DB.prepare('DELETE FROM web_sessions WHERE token_hash=?').bind(await digest(token)).run();
    return new Response('{}',{headers:{'Content-Type':'application/json','Set-Cookie':sessionCookie('',env,0),'Cache-Control':'no-store'}});
  }
  if(url.pathname==='/authorize'){
    const actor=await actorFor(req,env);
    if(!actor)return Response.redirect(env.APP_ORIGIN+'/auth/login?returnTo='+encodeURIComponent(url.pathname+url.search),302);
    if(req.method==='GET'){
      const auth=await env.OAUTH_PROVIDER.parseAuthRequest(req);
      assert(auth.scope.every((s:string)=>['mcp:read','mcp:write','offline_access'].includes(s)),'Unsupported scope.');
      const csrf=crypto.randomUUID();await env.DB.prepare('INSERT INTO login_states VALUES(?,?,?,?)').bind('consent:'+csrf,actor.id,JSON.stringify(auth),Date.now()+600000).run();
      const client=await env.OAUTH_PROVIDER.lookupClient(auth.clientId);
      return new Response(`<!doctype html><html lang="en"><meta name="viewport" content="width=device-width"><title>Connect Synapse</title><link rel="stylesheet" href="/styles.css"><main class="card padded" style="max-width:650px;margin:40px auto"><h1>Connect Synapse</h1><p>Signed in as ${escape(actor.email)}.</p><p>Client: <strong>${escape(client?.clientName||auth.clientId)}</strong></p><p>Access requested: ${escape(auth.scope.join(', '))}.</p><p>This allows reading your saved questions and progress${auth.scope.includes('mcp:write')?', saving question packs, mapping proposals and reviews':''}. Scores are calculated by Synapse.</p><form method="post"><input type="hidden" name="csrf" value="${csrf}"><button class="btn" name="decision" value="allow">Connect</button> <button class="btn secondary" name="decision" value="deny">Cancel</button></form></main></html>`,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':consentPolicy(auth.redirectUri)}});
    }
    checkOrigin(req,env);const form=await req.formData();
    const record=await env.DB.prepare('DELETE FROM login_states WHERE id=? AND nonce=? AND expires_at>? RETURNING *').bind('consent:'+String(form.get('csrf')),actor.id,Date.now()).first<any>();assert(record,'Consent expired.',403);
    if(form.get('decision')!=='allow')return Response.redirect(env.APP_ORIGIN,302);
    const auth=JSON.parse(record.return_to);
    const result=await env.OAUTH_PROVIDER.completeAuthorization({request:auth,userId:actor.id,metadata:{},scope:auth.scope,props:{userId:actor.id,email:actor.email}});
    return Response.redirect(result.redirectTo,302);
  }
  return null;
}

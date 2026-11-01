import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {readFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {resolve,extname} from 'node:path';
import {readdir} from 'node:fs/promises';
import {createServer} from 'node:http';
process.env.PLAYWRIGHT_BROWSERS_PATH=resolve('.cache/browsers');
const origin='http://127.0.0.1:8791';
const callbackUrl='http://127.0.0.1:8792/callback';
const assets=new Map();for(const name of await readdir('dist',{recursive:true})){if(extname(name))assets.set('/'+name.replaceAll('\\','/'),await readFile('dist/'+name));}
const mf=new Miniflare(convertV4MiniflareOptions({host:'127.0.0.1',port:8791,modules:true,scriptPath:'.wrangler/build/index.js',compatibilityDate:'2026-10-30',compatibilityFlags:['nodejs_compat','global_fetch_strictly_public'],d1Databases:['DB'],kvNamespaces:['OAUTH_KV'],bindings:{APP_ORIGIN:origin,OWNER_EMAIL:'owner@example.com',SHEETS_ENABLED:'false',SPREADSHEET_ID:'test-only'},serviceBindings:{ASSETS:req=>{const path=new URL(req.url).pathname.replace(/^\/$/,'/index.html'),body=assets.get(path);return new Response(body??'Not found',{status:body?200:404,headers:{'Content-Type':{'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png'}[extname(path)]??'text/plain'}});}}}));
const sha=s=>createHash('sha256').update(s).digest('hex');
try{
  const db=await mf.getD1Database('DB');
  const sql=(await Promise.all((await readdir('migrations')).filter(f=>f.endsWith('.sql')).sort().map(f=>readFile('migrations/'+f,'utf8')))).join('\n');for(const statement of sql.split(';').map(s=>s.trim()).filter(Boolean))await db.prepare(statement).run();
  await db.prepare("INSERT INTO topics(id,label,type) VALUES('C1','Example','Condition')").run();
  await db.prepare('INSERT INTO web_sessions VALUES(?,?,?)').bind(sha('test-session'),'owner',Date.now()+3600000).run();
  const call=(path,opts={})=>mf.dispatchFetch(origin+path,opts);
  const headers={Cookie:'synapse_session=test-session',Origin:origin,'Content-Type':'application/json'};
  const unauthorised=await call('/api/progress');assert.equal(unauthorised.status,401,await unauthorised.text());
  assert.equal((await call('/mcp',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,401);
  assert.equal((await call('/api/packs',{method:'POST',headers:{...headers,Origin:'https://evil.test'},body:'{}'})).status,403);
  assert.equal((await call('/api/progress',{headers})).status,200);
  const options={A:'One',B:'Two',C:'Three',D:'Four',E:'Five'};
  const packResponse=await call('/api/packs',{method:'POST',headers,body:JSON.stringify({requestId:randomUUID(),title:'Proof',mode:'imported',questions:[{question:'Proof?',options,answer:'A'}]})});assert.equal(packResponse.status,201);const p=await packResponse.json();
  const sessionId=randomUUID();assert.equal((await call('/api/sessions',{method:'POST',headers,body:JSON.stringify({id:sessionId,packId:p.id,order:[p.questions[0].id]})})).status,201);
  const update={mutationId:randomUUID(),expectedRevision:0,currentIndex:0,complete:true,events:[{id:randomUUID(),questionId:p.questions[0].id,selection:'A',at:new Date().toISOString()}]};
  const done=await call('/api/sessions/'+sessionId,{method:'POST',headers,body:JSON.stringify(update)});assert.equal(done.status,200);assert.equal((await done.json()).score,1);
  assert.equal((await call('/api/sessions/'+sessionId,{method:'POST',headers,body:JSON.stringify(update)})).status,200);
  const sessionSummary=await(await call('/api/sessions',{headers})).json();assert.equal(sessionSummary[0].score,1);assert.equal(sessionSummary[0].question_count,1);assert.equal(sessionSummary[0].answered,1);
  const packSummary=await(await call('/api/packs',{headers})).json();assert.equal(packSummary[0].question_count,1);
  const registration=await call('/oauth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({client_name:'Integration test',redirect_uris:[callbackUrl],grant_types:['authorization_code','refresh_token'],response_types:['code'],token_endpoint_auth_method:'none'})});
  assert.equal(registration.status,201);const client=await registration.json();
  const verifier='v'.repeat(64),challenge=createHash('sha256').update(verifier).digest('base64url');
  const query=new URLSearchParams({client_id:client.client_id,redirect_uri:callbackUrl,response_type:'code',scope:'mcp:read mcp:write offline_access',state:'state',code_challenge:challenge,code_challenge_method:'S256',resource:origin+'/mcp'});
  const consent=await call('/authorize?'+query,{headers});assert.equal(consent.status,200);const html=await consent.text();const csrf=html.match(/name="csrf" value="([^"]+)"/)[1];
  const allowed=await call('/authorize',{method:'POST',redirect:'manual',headers:{...headers,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrf,decision:'allow'}).toString()});assert.equal(allowed.status,302);
  const code=new URL(allowed.headers.get('location')).searchParams.get('code');
  const tokenResponse=await call('/oauth/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',client_id:client.client_id,code,redirect_uri:callbackUrl,code_verifier:verifier,resource:origin+'/mcp'}).toString()});assert.equal(tokenResponse.status,200);const tokens=await tokenResponse.json();
  const mcpHeaders={Authorization:'Bearer '+tokens.access_token,'Content-Type':'application/json',Accept:'application/json, text/event-stream'};
  const tools=await call('/mcp',{method:'POST',headers:mcpHeaders,body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/list',params:{}})});assert.equal(tools.status,200);const listed=await tools.json();assert.equal(listed.result.tools.length,9);
  const context=await call('/mcp',{method:'POST',headers:mcpHeaders,body:JSON.stringify({jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'get_study_context',arguments:{}}})});assert.equal(context.status,200);const result=await context.json();assert.equal(result.result.structuredContent.topics[0].status,'Untested');
  assert.equal(result.result.structuredContent.sourcePolicy.version,'uk-sources-1');assert.ok(result.result.structuredContent.sourcePolicy.references.some(s=>s.name==='BNF'));
  const mcpCall=async(name,args)=>{const response=await call('/mcp',{method:'POST',headers:mcpHeaders,body:JSON.stringify({jsonrpc:'2.0',id:randomUUID(),method:'tools/call',params:{name,arguments:args}})});const body=await response.json();assert.equal(response.status,200);assert.ok(!body.result.isError,JSON.stringify(body));return body.result.structuredContent;};
  assert.equal((await mcpCall('get_akt_generation_skill',{})).version,'akt-1');
  assert.equal((await mcpCall('get_performance_profile',{})).version,'performance-1');
  assert.equal((await mcpCall('get_curriculum_context',{})).blocks.length,0);
  // Read-only pagination must expose guide origins beyond the original first 100.
  await db.prepare("INSERT INTO curriculum_blocks VALUES('y3-fixture',3,'Fixture','Fixture','current','Guide.pdf',?,?)").bind('a'.repeat(64),new Date().toISOString()).run();
  const guideItems=Array.from({length:102},(_,i)=>({id:randomUUID(),label:'Guide topic '+String(i).padStart(3,'0')}));
  await db.prepare("INSERT INTO curriculum_items SELECT json_extract(value,'$.id'),'y3-fixture',json_extract(value,'$.label'),'Condition','C1','Radiology conditions','self-study','page 8','exact-normalized','' FROM json_each(?)").bind(JSON.stringify(guideItems)).run();
  const firstPage=await(await call('/api/curriculum',{headers})).json(),lastPage=await(await call('/api/curriculum?offset=100&limit=500',{headers})).json();
  assert.equal(firstPage.items.length,100);assert.equal(firstPage.nextOffset,100);assert.equal(lastPage.items.length,2);assert.equal(lastPage.nextOffset,null);assert.equal(lastPage.items[1].source_label,'Guide topic 101');
  assert.equal((await call('/api/curriculum?offset=-1',{headers})).status,400);assert.equal((await call('/api/curriculum?limit=501',{headers})).status,400);
  await db.prepare('DELETE FROM curriculum_items').run();await db.prepare('DELETE FROM curriculum_blocks').run();
  const generated=await mcpCall('save_question_pack',{requestId:randomUUID(),title:'Connected proof',mode:'diagnostic',questions:Array.from({length:20},(_,i)=>({question:`Integration question ${i}?`,options,answer:'A',explanation:'Test fixture explanation.',sources:[{title:'Test fixture',reference:'Local integration fixture; not clinical content',retrievedAt:new Date().toISOString()}],topicId:'C1',domain:'management',learningStage:'clinical',difficulty:'standard',learningObjective:'Test one integration fact',optionRationales:{A:'One is correct',B:'Two is not',C:'Three is not',D:'Four is not',E:'Five is not'}}))});
  assert.ok(generated.quizUrl??generated.url??generated.link,JSON.stringify(generated));
  query.set('scope','mcp:read');
  const readConsent=await call('/authorize?'+query,{headers}),readHtml=await readConsent.text(),readCsrf=readHtml.match(/name="csrf" value="([^"]+)"/)[1];
  const readAllow=await call('/authorize',{method:'POST',redirect:'manual',headers:{...headers,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrf:readCsrf,decision:'allow'}).toString()});
  const readCode=new URL(readAllow.headers.get('location')).searchParams.get('code');
  const readToken=await(await call('/oauth/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',client_id:client.client_id,code:readCode,redirect_uri:callbackUrl,code_verifier:verifier,resource:origin+'/mcp'}).toString()})).json();
  const readHeaders={...mcpHeaders,Authorization:'Bearer '+readToken.access_token};
  const denied=await(await call('/mcp',{method:'POST',headers:readHeaders,body:JSON.stringify({jsonrpc:'2.0',id:99,method:'tools/call',params:{name:'save_question_pack',arguments:{requestId:randomUUID(),title:'Must not save',mode:'imported',questions:[{question:'Test?',options,answer:'A'}]}}})})).json();
  assert.equal(denied.result.isError,true);assert.match(denied.result.content[0].text,/mcp:write scope required/);
  assert.equal((await db.prepare("SELECT count(*) n FROM packs WHERE title='Must not save'").first()).n,0);
  mcpHeaders.Authorization=readHeaders.Authorization; // Re-consent invalidates the earlier grant.
  console.log('Worker integration passed: private API, CSRF, real D1 writes, idempotency, OAuth consent/token exchange, read-only scope enforcement, nine authenticated MCP tools and 20-question generation.');
  if(process.argv.includes('--browser')){
    const {chromium}=await import('@playwright/test');const browser=await chromium.launch();
    const callbackServer=createServer((_req,res)=>{res.writeHead(200,{'Content-Type':'text/html'});res.end('<h1>OAuth callback reached</h1>');});
    await new Promise((resolve,reject)=>{callbackServer.once('error',reject);callbackServer.listen(8792,'127.0.0.1',resolve);});
    try{
      const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),desktop=await browser.newContext();
      for(const c of [mobile,desktop])await c.addCookies([{name:'synapse_session',value:'test-session',url:origin,httpOnly:true,sameSite:'Lax'}]);
      const phone=await mobile.newPage(),computer=await desktop.newPage();const errors=[];phone.on('pageerror',e=>errors.push(e.message));computer.on('pageerror',e=>errors.push(e.message));
      await phone.goto(origin+'/?pack='+p.id);await phone.locator('[data-key="A"]').waitFor();
      const current=()=>phone.evaluate(async()=>(await import('/connected.js')).connected.active);
      await phone.waitForFunction(async()=>(await import('/connected.js')).connected.active?.serverCreated);
      const first=await current();await phone.evaluate(()=>navigator.serviceWorker.ready);await phone.goto(origin+'/?session='+first.id);await phone.locator('[data-key="A"]').waitFor();
      await mobile.setOffline(true);await phone.locator('[data-key="A"]').click();await phone.waitForFunction(()=>document.querySelector('[data-key="A"]')?.classList.contains('correct'));
      await phone.reload();await phone.locator('#resumeBtn').click();assert.ok(await phone.locator('[data-key="A"]').evaluate(e=>e.classList.contains('correct')));
      await mobile.setOffline(false);await phone.evaluate(async()=>(await import('/connected.js')).connected.tick());
      await phone.waitForFunction(async()=>!(await import('/connected.js')).connected.active.pending.length);
      await computer.goto(origin+'/?session='+first.id);await computer.waitForFunction(()=>document.querySelector('[data-key="A"]')?.classList.contains('correct'));await computer.locator('#nextBtn').click();
      await computer.waitForFunction(async()=>(await import('/connected.js')).connected.active.status==='completed');
      const result=await mcpCall('get_session_results',{sessionId:first.id});assert.ok(JSON.stringify(result).includes(first.id));
      assert.equal((await db.prepare('SELECT count(*) n FROM answer_events WHERE session_id=?').bind(first.id).first()).n,1);
      // Both devices now start from the same revision; the phone answers offline.
      await phone.goto(origin+'/?pack='+p.id);await phone.locator('[data-key="A"]').waitFor();await phone.waitForFunction(async()=>(await import('/connected.js')).connected.active?.serverCreated);const concurrent=await current();
      await computer.goto(origin+'/?session='+concurrent.id);await computer.locator('[data-key="A"]').waitFor();await mobile.setOffline(true);await phone.locator('[data-key="A"]').click();await computer.locator('[data-key="B"]').click();
      await computer.waitForFunction(()=>document.querySelector('[data-key="B"]')?.classList.contains('wrong'));
      await computer.waitForFunction(async()=>{const c=(await import('/connected.js')).connected;return !c.active.pending.length&&!c.busy;});
      await mobile.setOffline(false);await phone.evaluate(async()=>(await import('/connected.js')).connected.tick());await phone.waitForFunction(async()=>(await import('/connected.js')).connected.active.conflict);
      assert.equal((await db.prepare('SELECT selection FROM answer_events WHERE session_id=?').bind(concurrent.id).first()).selection,'B',JSON.stringify({phone:await current(),desktop:await computer.evaluate(async()=>(await import('/connected.js')).connected.active)}));
      await phone.locator('[data-view="packs"]').click();await phone.locator('[data-conflict="remote"]').click();await phone.waitForFunction(()=>document.querySelector('[data-key="B"]')?.classList.contains('wrong'));
      const archive=await phone.evaluate(async id=>(await import('/shared/offline.js')).storage('get','conflict-archive:'+id),concurrent.id);assert.equal(archive.local.events[0].selection,'A');assert.equal(archive.remote.state.events[0].selection,'B');
      await phone.screenshot({path:'test-results/connected-phone.png',fullPage:true});assert.deepEqual(errors,[]);
      await phone.locator('[data-view="performance"]').click();await phone.getByRole('heading',{name:'Your weak points',exact:true}).waitFor();assert.equal(await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await phone.screenshot({path:'test-results/performance-phone.png',fullPage:true});assert.deepEqual(errors,[]);
      // Close an account session on the phone; another device must see the same history.
      const endedId=randomUUID(),discardedId=randomUUID();
      for(const id of [endedId,discardedId])assert.equal((await call('/api/sessions',{method:'POST',headers,body:JSON.stringify({id,packId:p.id,order:p.questions.map(q=>q.id)})})).status,201);
      assert.equal((await call('/api/sessions/'+endedId+'/close',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mutationId:randomUUID(),expectedRevision:0,action:'end'})})).status,401);
      await phone.goto(origin+'/?session='+endedId);await phone.locator('[data-key="A"]').waitFor();await phone.locator('[data-view="packs"]').click();phone.once('dialog',d=>d.accept());await phone.locator(`[data-close-session="end"][data-session-id="${endedId}"]`).click();await phone.locator(`#endedSessions [data-resume="${endedId}"]`).waitFor();
      assert.equal((await db.prepare('SELECT status FROM sessions WHERE id=?').bind(endedId).first()).status,'ended');
      await computer.goto(origin+'/?view=packs');await computer.locator(`#endedSessions [data-resume="${endedId}"]`).waitFor();computer.once('dialog',d=>d.accept());await computer.locator(`[data-close-session="discard"][data-session-id="${discardedId}"]`).click();await computer.locator('#discardedSessions').waitFor();
      assert.equal((await db.prepare('SELECT status FROM sessions WHERE id=?').bind(discardedId).first()).status,'discarded');
      assert.equal((await call('/api/sessions/'+first.id+'/close',{method:'POST',headers,body:JSON.stringify({mutationId:randomUUID(),expectedRevision:2,action:'discard'})})).status,409);
      assert.deepEqual(errors,[]);console.log('Account session controls passed: phone end, computer discard, cross-device history, anonymous denial and completed-result protection.');
      // Exercise the HTML form's cross-origin OAuth redirect in a real browser.
      // fetch(..., redirect:'manual') cannot detect a browser CSP navigation block.
      const consentContext=await browser.newContext({serviceWorkers:'block'});
      await consentContext.addCookies([{name:'synapse_session',value:'test-session',url:origin,httpOnly:true,sameSite:'Lax'}]);
      const consentPage=await consentContext.newPage();
      const consoleErrors=[];consentPage.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});
      consentPage.on('requestfailed',request=>consoleErrors.push(new URL(request.url()).origin+': '+request.failure()?.errorText));
      await consentPage.goto(origin+'/authorize?'+query);
      await consentPage.getByRole('button',{name:'Connect',exact:true}).click();
      try{await consentPage.waitForURL(callbackUrl+'**',{timeout:5000});}catch{throw new Error('Browser consent navigation failed: '+consoleErrors.join(' | ')+'; path='+new URL(consentPage.url()).pathname+'; body='+(await consentPage.locator('body').innerText()).slice(0,1000));}
      const browserCallback=new URL(consentPage.url());assert.ok(browserCallback.searchParams.get('code'));assert.equal(browserCallback.searchParams.get('state'),'state');
      console.log('Browser integration passed: one-click cross-origin OAuth callback; phone offline answer survives reload, computer resumes and completes, MCP retrieves results, duplicate-free sync and concurrent-device conflict preserves both paths.');
    }finally{await browser.close();await new Promise(resolve=>callbackServer.close(resolve));}
  }
}finally{await mf.dispose();}

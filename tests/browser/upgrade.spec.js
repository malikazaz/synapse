import {navigate,resume,display} from './navigation.js';
import {test,expect} from '@playwright/test';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {extname,resolve,sep} from 'node:path';

test('an existing offline cache reproduces blank tabs, then upgrades without losing device data',async({page,context})=>{
  test.setTimeout(60000);
  let phase='legacy';
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const root=resolve('dist'),legacy=new Map();
  let settings={revision:1,exams:[],activeBlocks:['MSK'],recallFirst:true,foundationPackSize:10};
  const profile={scope:{topics:1},summary:{recentAccuracy:null,recentCount:0,evidenceCount:0,untestedTopics:1,retries:0,recoveredAfterError:0,dueTopics:0},priorities:[],stages:[],confidence:[],timing:{measuredFirstAnswers:0,unmeasuredFirstAnswers:0,medianActiveMs:null,optionReveals:0,interpretation:'No measurements yet.'},definitions:{mastery:'First answers only.',curriculum:'Stable catalogue IDs.'}};
  const server=http.createServer(async(req,res)=>{
    try{
      const path=new URL(req.url,'http://localhost').pathname;
      if(path==='/index.html'){res.writeHead(308,{Location:'/'}).end();return;}
      if(path.startsWith('/api/')){
        if(path==='/api/study-settings'&&req.method==='POST'){let body='';for await(const part of req)body+=part;settings={...JSON.parse(body).preferences,revision:settings.revision+1};}
        const values={'/api/status':{connected:true,actor:{id:'upgrade-fixture',email:'learner@example.test'}},'/api/study-settings':settings,'/api/topics':[{id:'C1',label:'Example',type:'Condition',blocks:['MSK']}],'/api/curriculum':{blocks:[]},'/api/performance':profile,'/api/progress':[],'/api/packs':[],'/api/sessions':[],'/api/sync':{enabled:true,jobs:[]}};
        res.writeHead(values[path]?200:404,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify(values[path]??{error:'Unknown fixture'}));return;
      }
      const file=path==='/'?'index.html':path.slice(1),target=resolve(root,file);if(!target.startsWith(root+sep)){res.writeHead(403).end();return;}
      let bytes;
      if(phase==='legacy'||phase==='broken'&&file==='sw.js'){
        if(!legacy.has(file))legacy.set(file,execFileSync('git',['show','5f3ea35:'+file],{maxBuffer:2e6}));bytes=legacy.get(file);
      }else{bytes=await readFile(target);if(phase==='broken'&&file==='index.html')bytes=Buffer.from(bytes.toString().replace('  <script src="updates.js" type="module"></script>',''));}
      res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png'})[extname(file)]??'text/plain','Cache-Control':'no-store'}).end(bytes);
    }catch{res.writeHead(404).end();}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
  try{
    await page.goto(origin);await page.evaluate(()=>navigator.serviceWorker.ready);await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true);
    await page.locator('[data-view=quiz]').click();await page.locator('#paste').fill('Question 1: Upgrade test?\nA) Alpha\nB) Beta\nC) Gamma\nD) Delta\nE) Epsilon\nAnswer: B');await page.locator('#loadBtn').click();await page.locator('[data-key=A]').click();await expect(page.locator('[data-key=A]')).toHaveClass(/wrong/);
    const original=await page.evaluate(async()=>(await(await import('/shared/offline.js')).storage('all')).find(r=>r.kind==='session'));
    phase='broken';await page.reload();
    for(const view of ['study','performance']){await page.locator(`[data-view=${view}]`).click();await expect(page.locator('#workspace')).toBeEmpty();}
    phase='fixed';await page.reload();await expect(page.getByRole('button',{name:'Update Synapse',exact:true})).toBeVisible();
    await page.locator('[data-view=quiz]').click();await page.locator('#paste').fill('Keep my pasted questions across the update');
    await page.getByRole('button',{name:'Update Synapse',exact:true}).click();await expect(page.locator('#appUpdate')).toHaveCount(0);await expect(page.locator('#paste')).toHaveValue('Keep my pasted questions across the update');
    const restored=await page.evaluate(async id=>(await import('/shared/offline.js')).storage('get','session:'+id),original.id);expect(restored.events).toEqual(original.events);expect(restored.pending).toEqual(original.pending);
    await resume(page);await expect(page.locator('[data-key=A]')).toHaveClass(/wrong/);await expect(page.locator('#score')).toHaveText('Score 0');
    await navigate(page,'study');await expect(page.getByRole('heading',{name:'Your AKT study plan'})).toBeVisible();await page.locator('#addExam').click();await page.locator('[name=examName]').fill('AKT fixture');await page.locator('[name=examDate]').fill('2027-02-04');await page.locator('#saveStudyPlan').click();await expect(page.locator('#studyPlanStatus')).toContainText('Study plan synced');
    await navigate(page,'performance');await expect(page.getByRole('heading',{name:'Your weak points'})).toBeVisible();
    await page.reload();await navigate(page,'study');await expect(page.locator('[name=examName]')).toHaveValue('AKT fixture');
    await context.setOffline(true);await page.reload();await navigate(page,'study');await expect(page.locator('[data-view=study]')).toHaveAttribute('aria-pressed','true');
    expect(await page.evaluate(()=>caches.keys())).toHaveLength(1);
    expect(errors).toEqual([]);
  }finally{await context.setOffline(false);await new Promise(r=>server.close(r));}
});

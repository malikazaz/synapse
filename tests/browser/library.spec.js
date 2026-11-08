import {test,expect} from '@playwright/test';
test('library search, shelves, collections, filters and offline snapshot preserve session history',async({page,context},info)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const packs=Array.from({length:26},(_,i)=>({id:crypto.randomUUID(),title:i===0?'Fractures basics':`Topic pack ${String(i).padStart(2,'0')}`,mode:'diagnostic',created_at:new Date(Date.UTC(2026,10,28-i)).toISOString(),question_count:10,attempt_count:i===0?1:0,completed_count:i===0?1:0,active_session_id:null,collection:'',pinned:false,archived:false,library_revision:0,topics:[{id:'C1',label:i===0?'Fractures':'Asthma'}],blocks:[i===0?'MSK':'Medicine 1'],stages:[i===0?'foundation':'clinical']}));
 const sessions=[{id:crypto.randomUUID(),pack_id:packs[0].id,title:packs[0].title,revision:2,status:'completed',score:8,question_count:10,answered:10,started_at:packs[0].created_at,completed_at:packs[0].created_at}];let writes=0;
 await page.route('**/api/**',async route=>{
  const req=route.request(),path=new URL(req.url()).pathname;
  if(path.endsWith('/organisation')){const p=packs.find(p=>p.id===path.split('/')[3]),d=req.postDataJSON();writes++;if(d.expectedRevision!==p.library_revision)return route.fulfill({status:409,json:{error:'Pack organisation changed on another device. Refresh the library before trying again.'}});Object.assign(p,d.preferences,{library_revision:p.library_revision+1});return route.fulfill({json:{collection:p.collection,pinned:p.pinned,archived:p.archived,library_revision:p.library_revision}});}
  const values={'/api/status':{connected:true,actor:{id:'library-owner',email:'learner@example.test'}},'/api/study-settings':{revision:0,exams:[],activeBlocks:[],recallFirst:true,foundationPackSize:10},'/api/packs':packs,'/api/sessions':sessions,'/api/sync':{enabled:true,jobs:[]}};
  return route.fulfill({status:values[path]?200:404,json:values[path]??{error:'Fixture'}});
 });
 await page.goto('/?view=packs');await expect(page.locator('#packCount')).toHaveText('26 packs · showing 12');await expect(page.locator('.library-pack')).toHaveCount(12);
 await page.locator('#morePacks').click();await expect(page.locator('.library-pack')).toHaveCount(24);
 await page.locator('#packSearch').fill('fractures');await expect(page.locator('.library-pack')).toHaveCount(1);await expect(page.locator('.library-pack')).toContainText('1 completed attempt');
 await page.locator('[data-pin]').click();await expect(page.locator('#libraryMessage')).toContainText('synced');
 await page.locator('.pack-actions>summary').click();await page.locator('[name=collection]').fill('MSK revision');await page.getByRole('button',{name:'Save collection',exact:true}).click();await expect(page.locator('.pack-folder')).toHaveText('MSK revision');
 await page.locator('#clearPackFilters').click();await page.locator('[data-shelf=pinned]').click();await expect(page.locator('.library-pack')).toHaveCount(1);
 await page.locator('.pack-actions>summary').click();await page.locator('[data-archive]').click();await expect(page.locator('.library-pack')).toHaveCount(0);await expect(page.locator('#libraryMessage')).toContainText('history are retained');
 await page.locator('[data-shelf=archive]').click();await expect(page.locator('.library-pack')).toContainText('Fractures basics');await page.locator('.library-sessions>summary').click();await expect(page.locator('#completedSessions')).toContainText('Fractures basics');
 await page.locator('.pack-actions>summary').click();await page.locator('[data-archive]').click();await expect(page.locator('.library-pack')).toHaveCount(0);
 await page.locator('[data-shelf=library]').click();await page.locator('#packCollection').selectOption('MSK revision');await expect(page.locator('.library-pack')).toHaveCount(1);
 await page.locator('.filter-details>summary').click();await page.locator('#packStage').selectOption('clinical');await expect(page.locator('.library-pack')).toHaveCount(0);await page.locator('#packStage').selectOption('foundation');await expect(page.locator('.library-pack')).toHaveCount(1);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`test-results/library-${info.project.name}.png`,fullPage:true});
 await page.unroute('**/api/**');await context.setOffline(true);await page.reload();await expect(page.locator('.pack-library .notice')).toContainText('saved library');await page.locator('#packCollection').selectOption('MSK revision');await expect(page.locator('.library-pack')).toHaveCount(1);await page.locator('[data-pin]').click();await expect(page.locator('#libraryMessage')).toContainText('Reconnect');expect(writes).toBe(4);expect(errors).toEqual([]);
});

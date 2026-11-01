import {test,expect} from '@playwright/test';
const names=['MSK','Mental Health','Medicine 1','Medicine 2','Surgery & Perioperative Care','Primary Care'];
const blocks=names.map((name,i)=>({id:'block-'+i,year:3,label:name==='MSK'?'Musculoskeletal':name,topic_block:name,status:i===0?'current':'upcoming',source_name:name+' guide.pdf',matchedTopics:1,unmatchedItems:0}));
const topic=(id,label,systems,groups)=>({id,label,type:'Condition',systems,blocks:groups,aliases:[],status:'Untested',accuracy:null,coverage:0,evidenceCount:0,nextReview:null,overdue:false,reason:'No eligible evidence yet.',domains:Array.from({length:5},()=>({count:0,accuracy:null}))});
const topics=[topic('C1','Bladder cancer',['Kidneys and urinary tract'],['MSK',names[4]]),topic('C2','Osteoarthritis',['Musculoskeletal'],['MSK','Core MSK']),topic('C3','Retained example',['Musculoskeletal'],['MSK','Related MSK']),...names.slice(1).map((n,i)=>topic('C'+(i+4),n+' example',['Other'],[n]))];
const entry=(id,topicId,blockIndex,section,priority='core')=>({id,topic_id:topicId,block_id:blocks[blockIndex].id,section,priority,source_label:topics.find(t=>t.id===topicId)?.label??'Unresolved guide wording',source_type:'Condition',source_locator:'page 8, table 2',match_method:topicId?'exact-normalized':'unmatched',notes:''});
const entries=[entry('a','C2',0,'Rheumatology conditions'),...names.slice(1).map((n,i)=>entry('e'+i,'C'+(i+4),i+1,n+' conditions')),entry('bladder-surgery','C1',4,'Urological conditions'),entry('bladder-msk','C1',0,'Radiology conditions','self-study'),entry('unresolved',null,0,'Radiology conditions','self-study')];
async function fixture(page){
  let settings={revision:1,exams:[],activeBlocks:['MSK','Core MSK'],recallFirst:true,foundationPackSize:10};const offsets=[],writes=[];
  await page.route('**/api/**',async route=>{
    const req=route.request(),url=new URL(req.url()),path=url.pathname;
    if(req.method()==='POST'){writes.push({path,data:req.postDataJSON()});if(path==='/api/study-settings')settings={...req.postDataJSON().preferences,revision:settings.revision+1};}
    let curriculum;if(path==='/api/curriculum'){const offset=Number(url.searchParams.get('offset')||0);offsets.push(offset);curriculum={blocks,items:offset===0?entries.slice(0,2):entries.slice(2),total:entries.length,nextOffset:offset===0?2:null};}
    const responses={'/api/status':{actor:{id:'curriculum-fixture',email:'learner@example.test'},connected:true},'/api/study-settings':settings,'/api/progress':topics,'/api/topics':topics,'/api/curriculum':curriculum,'/api/packs':[],'/api/sessions':[],'/api/sync':{enabled:true,jobs:[]}};
    await route.fulfill({status:responses[path]?200:404,json:responses[path]??{error:'Unknown fixture'}});
  });return {offsets,writes,getSettings:()=>settings};
}
test('teaching blocks, sections, scope and body systems filter independently without losing guide origins',async({page,context},info)=>{
  const f=await fixture(page);await page.goto('/?view=progress');await expect(page.locator('#topicCount')).toHaveText('8 topics');
  expect(f.offsets).toEqual([0,2]);await expect(page.locator('#blockFilter option')).toHaveCount(7);await expect(page.locator('#blockFilter')).not.toContainText('Core MSK');
  await page.getByLabel('Filter teaching block').selectOption('MSK');await expect(page.locator('#topicCount')).toHaveText('3 topics');
  const bladder=page.locator('#progressRows tr').filter({has:page.locator('strong', {hasText:'Bladder cancer'})});await expect(bladder).toContainText('Radiology conditions');await expect(bladder).toContainText('Self-directed study');await expect(bladder).toContainText('Kidneys and urinary tract');
  await bladder.getByText('Why this topic is here',{exact:true}).click();await expect(bladder).toContainText('MSK guide.pdf');await expect(bladder).toContainText('page 8, table 2');await expect(bladder).not.toContainText('Urological conditions');
  await page.getByLabel('Filter guide section').selectOption('Radiology conditions');await expect(page.locator('#topicCount')).toHaveText('1 topic');await expect(page.locator('#unmappedGuideEntries')).toBeVisible();await page.locator('#unmappedGuideEntries summary').click();await expect(page.locator('#unmappedGuideEntries')).toContainText('Unresolved guide wording');
  await page.getByLabel('Filter teaching scope').selectOption('core');await expect(page.locator('#topicCount')).toHaveText('0 topics');
  await page.getByLabel('Filter teaching scope').selectOption('');await page.getByLabel('Filter guide section').selectOption('');await page.getByLabel('Filter body system').selectOption('Musculoskeletal');await expect(page.locator('#topicCount')).toHaveText('2 topics');await expect(page.locator('#progressRows')).not.toContainText('Bladder cancer');await expect(page.locator('#progressRows')).toContainText('Retained catalogue topic');
  await page.getByLabel('Filter body system').selectOption('');
  for(let i=1;i<names.length;i++){await page.getByLabel('Filter teaching block').selectOption(names[i]);await expect(page.locator('#progressRows')).toContainText(names[i]+' example');await expect(page.locator('#sectionFilter')).toContainText(names[i]+' conditions');await expect(page.locator('#sectionFilter')).not.toContainText('Radiology conditions');}
  await page.getByLabel('Filter teaching block').selectOption(names[4]);await page.getByLabel('Filter guide section').selectOption('Urological conditions');await expect(page.locator('#progressRows')).toContainText('Bladder cancer');await expect(page.locator('#progressRows')).toContainText('Core teaching');
  expect(f.writes).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`test-results/curriculum-${info.project.name}.png`,fullPage:true});
  await page.unroute('**/api/**');await context.setOffline(true);await page.reload();await expect(page.locator('#workspace')).toContainText('Showing saved guide descriptions');await page.getByLabel('Filter teaching block').selectOption('MSK');await expect(page.locator('#progressRows')).toContainText('Radiology conditions');
});
test('study plan separates teaching blocks and earlier groups while preserving old preference values',async({page})=>{
  const f=await fixture(page);await page.goto('/?view=study');await expect(page.locator('[name=activeBlock][value=MSK]')).toBeChecked();await expect(page.locator('[name=activeBlock][value="Core MSK"]')).toBeChecked();
  await expect(page.locator('.earlier-groups').first()).toContainText('Core MSK');await expect(page.locator('#studyPlanForm')).toContainText('Year 3 · Musculoskeletal (MSK)');
  await page.locator('#saveStudyPlan').click();await expect(page.locator('#studyPlanStatus')).toContainText('Study plan synced');expect(f.getSettings().activeBlocks).toEqual(['MSK','Core MSK']);expect(f.writes.map(w=>w.path)).toEqual(['/api/study-settings']);
  await page.getByText('Sections in this guide',{exact:true}).first().click();await expect(page.locator('#workspace')).toContainText('Radiology conditions');await expect(page.locator('#workspace')).toContainText('Self-directed study');
});

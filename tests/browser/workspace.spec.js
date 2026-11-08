import {navigate,resume,display} from './navigation.js';
import {test,expect} from '@playwright/test';
const actor={id:'fixture-owner',email:'student@example.test'};
const makeTopics=()=>[
  {id:'C1',label:'Asthma',type:'Condition',systems:['Respiratory'],blocks:['Respiratory block'],aliases:['Wheeze'],status:'Red',accuracy:40,coverage:2,evidenceCount:5,nextReview:new Date(Date.now()-86400000).toISOString(),overdue:true,reason:'Recent accuracy below 50%.',domains:Array.from({length:5},(_,i)=>({count:i<2?2:0,accuracy:i<2?40:null}))},
  {id:'C2',label:'Osteoarthritis',type:'Condition',systems:['Musculoskeletal'],blocks:['MSK'],aliases:[],status:'Green',accuracy:90,coverage:5,evidenceCount:20,nextReview:new Date(Date.now()+86400000).toISOString(),overdue:false,reason:'Coverage and spaced retention requirements met.',domains:Array.from({length:5},()=>({count:4,accuracy:90}))},
  {id:'P1',label:'Chest pain',type:'Presentation',systems:['Cardiovascular'],blocks:[],aliases:[],status:'Untested',accuracy:null,coverage:0,evidenceCount:0,nextReview:null,overdue:false,reason:'No eligible evidence yet.',domains:Array.from({length:5},()=>({count:0,accuracy:null}))}
];
async function mockAccount(page){
  await page.route('**/api/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    const responses={
      '/api/status':{connected:true,actor},'/api/progress':makeTopics(),
      '/api/sessions':[{id:'session-fixture',title:'Respiratory review',status:'completed',score:7,question_count:10,answered:10,started_at:new Date().toISOString(),completed_at:new Date().toISOString()}],
      '/api/packs':[{id:'pack-fixture',title:'Respiratory review',question_count:10,mode:'diagnostic',created_at:new Date().toISOString()}],
      '/api/sync':{enabled:true,jobs:[]}
    };
    await route.fulfill({status:responses[path]?200:404,contentType:'application/json',body:JSON.stringify(responses[path]??{error:'Fixture endpoint not provided'})});
  });
}
test('home uses account evidence, filters every body system, and sources stay separate from clinical claims',async({page},info)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await mockAccount(page);await page.goto('/');
  await expect(page.locator('#workspace h1')).toHaveText('Pick up where you left off.');
  await expect(page.locator('.metric strong')).toHaveText(['2','1','1','0']);
  await expect(page.locator('#workspace')).toContainText('7/10 first answers correct');
  await expect(page.locator('.activity').first()).toContainText('Asthma');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`test-results/home-${info.project.name}.png`,fullPage:true});
  await page.locator('#studyPromptBtn').click();await expect(page.locator('#studyPrompt')).toHaveValue(/Asthma \(topic ID C1\)/);await page.locator('#closePrompt').click();
  await navigate(page,'progress');await page.locator('.filter-details>summary').click();await page.getByLabel('Filter body system').selectOption('Respiratory');await expect(page.locator('#topicCount')).toHaveText('1 topic');await expect(page.locator('#progressRows')).toContainText('Asthma');
  await page.getByLabel('Filter body system').selectOption('');await page.getByLabel('Filter topic type').selectOption('Presentation');await expect(page.locator('#progressRows')).toContainText('Chest pain');await expect(page.locator('#progressRows')).not.toContainText('Asthma');
  await navigate(page,'sources');await expect(page.locator('#sourceCount')).toHaveText('25 references');await page.locator('#sourceSearch').fill('BNF');await expect(page.locator('.source-card')).toHaveCount(3);
  await page.locator('#sourceSearch').fill('unlikely-no-match');await expect(page.locator('#sourceGroups')).toContainText('No matching reference');
  await display(page,()=>page.locator('#themeSelect').selectOption('UCAT Light'));await navigate(page,'home');await expect(page.locator('#workspace h1')).toHaveText('Pick up where you left off.');
  await page.screenshot({path:`test-results/home-light-${info.project.name}.png`,fullPage:true});expect(errors).toEqual([]);
});
test('slow responses cannot replace a newly selected view; cached home is labelled when offline',async({page,context})=>{
  await mockAccount(page);await page.goto('/');await expect(page.locator('.metric')).toHaveCount(4);
  let release;const gate=new Promise(r=>release=r);
  await page.route('**/api/progress',async route=>{await gate;await route.fulfill({contentType:'application/json',body:JSON.stringify(makeTopics())});});
  await navigate(page,'progress');await navigate(page,'sources');await expect(page.locator('#workspace h1')).toHaveText('Trusted sources');const finished=page.waitForResponse('**/api/progress');release();await finished;await page.waitForTimeout(100);await expect(page.locator('#workspace h1')).toHaveText('Trusted sources');
  await page.unroute('**/api/**');await page.unroute('**/api/progress');await context.setOffline(true);await navigate(page,'home');await expect(page.locator('.notice')).toContainText('Showing saved data');await expect(page.locator('.metric strong')).toHaveText(['2','1','1','0']);
});
test('guest empty state and failed cloud state never invent progress',async({page})=>{
  await page.goto('/');await expect(page.locator('#workspace h1')).toHaveText('Make your next study session count.');await expect(page.locator('.metric')).toHaveCount(0);await expect(page.locator('#workspace')).toContainText('No sessions yet');
  await navigate(page,'quiz');await page.locator('#paste').fill('Draft in progress');await navigate(page,'home');await navigate(page,'quiz');await expect(page.locator('#paste')).toHaveValue('Draft in progress');
  await page.route('**/api/status',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({connected:true,actor})}));await page.reload();await expect(page.locator('.notice')).toContainText('Cloud data is unavailable');await expect(page.locator('.metric strong')).toHaveText(['—','—','—','0']);
});

test('narrow screen and large text keep controls accessible; source links can open directly',async({page})=>{
  await page.setViewportSize({width:320,height:780});await page.goto('/?view=sources');await expect(page.locator('#workspace h1')).toHaveText('Trusted sources');
  await display(page,()=>page.locator('#fontSize').fill('30'));await page.locator('#sourceSearch').fill('prescribing');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await navigate(page,'quiz');await expect(page.locator('#paste')).toBeVisible();
});

test('background cloud continuation cannot navigate away from sources',async({page})=>{
  await mockAccount(page);await page.goto('/?view=sources');await expect(page.locator('#workspace h1')).toHaveText('Trusted sources');
  await page.evaluate(async()=>{
    const {connected}=await import('/connected.js');
    const q={id:crypto.randomUUID(),question:'Fixture?',options:{A:'a',B:'b',C:'c',D:'d',E:'e'},answer:'A',original_q_number:1};
    await connected.installRemote({id:crypto.randomUUID(),owner:'fixture-owner',revision:1,status:'active',started_at:new Date().toISOString(),state:{order:[q.id],events:[],currentIndex:0}},{id:crypto.randomUUID(),title:'Fixture pack',questions:[q]},false);
  });
  await expect(page.locator('#workspace h1')).toHaveText('Trusted sources');await expect(page.locator('#app')).toBeHidden();
});

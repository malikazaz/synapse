import {navigate,resume,display} from './navigation.js';
import {test,expect} from '@playwright/test';
const actor={id:'fixture-owner',email:'student@example.test'};
const topic={id:'C1',label:'Example',type:'Condition',blocks:['MSK'],systems:[],aliases:[]};
test('personal plan persists, appears on home, and stale saves retain the draft',async({page},info)=>{
 let settings={revision:0,exams:[],activeBlocks:[],recallFirst:true,foundationPackSize:10};let conflict=false;
 await page.route('**/api/**',async route=>{
  const request=route.request(),path=new URL(request.url()).pathname;
  if(path==='/api/study-settings'&&request.method()==='POST'){
   if(conflict)return route.fulfill({status:409,json:{error:'Study settings changed on another device. Reload before saving.'}});
   settings={...request.postDataJSON().preferences,revision:settings.revision+1};
  }
  const responses={'/api/status':{connected:true,actor},'/api/study-settings':settings,'/api/topics':[topic],'/api/curriculum':{blocks:[]},'/api/progress':[],'/api/packs':[],'/api/sessions':[],'/api/sync':{enabled:true,jobs:[]}};
  await route.fulfill({status:responses[path]?200:404,json:responses[path]??{error:'Missing fixture'}});
 });
 await page.goto('/');await navigate(page,'study');await expect(page.locator('#recallFirst')).toBeChecked();await page.locator('#addExam').click();await page.locator('[name=examName]').fill('My AKT');await page.locator('[name=examDate]').fill('2027-02-04');await page.locator('[name=activeBlock]').check();await page.locator('#saveStudyPlan').click();await expect(page.locator('#studyPlanStatus')).toContainText('Study plan synced');
 expect(settings.exams[0].name).toBe('My AKT');expect(settings.activeBlocks).toEqual(['MSK']);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`test-results/study-plan-${info.project.name}.png`,fullPage:true});
 await page.reload();await expect(page.locator('#workspace')).toContainText('My AKT');await navigate(page,'study');await expect(page.locator('[name=examName]')).toHaveValue('My AKT');
 conflict=true;await page.locator('[name=examName]').fill('Keep my edit');await page.locator('#saveStudyPlan').click();await expect(page.locator('#studyPlanStatus')).toContainText('another device');await expect(page.locator('[name=examName]')).toHaveValue('Keep my edit');
 await page.reload();await navigate(page,'study');await page.locator('#recoverStudyDraft').click();await expect(page.locator('[name=examName]')).toHaveValue('Keep my edit');
});
test('recall reveal has no answer event; confidence and timing survive an offline answer and reload',async({page,context},info)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await expect(page.locator('#workspace h1')).toBeVisible();
 await page.evaluate(async()=>{
  const {connected}=await import('/connected.js');
  const q={id:crypto.randomUUID(),original_q_number:1,question:'Recall one concept?',options:{A:'One',B:'Two',C:'Three',D:'Four',E:'Five'},answer:'A',learningStage:'foundation',difficulty:'introductory',explanation:'One is correct.',optionRationales:{A:'One is correct',B:'Two is not',C:'Three is not',D:'Four is not',E:'Five is not'}};
  await connected.begin([q]);connected.emit();
 });
 await expect(page.locator('#revealOptions')).toBeVisible();await expect(page.locator('button.opt')).toHaveCount(0);await expect(page.locator('#nextBtn')).toBeDisabled();expect(await page.locator('#warn').evaluate(el=>getComputedStyle(el).borderLeftWidth)).toBe('0px');await page.locator('#answerConfidence').selectOption('confident');await page.screenshot({path:`test-results/recall-${info.project.name}.png`,fullPage:true});await page.locator('#revealOptions').click();
 expect(await page.evaluate(async()=>(await import('/connected.js')).connected.active.events.length)).toBe(0);
 await context.setOffline(true);await page.locator('[data-key=B]').click();await expect(page.locator('[data-key=B]')).toHaveClass(/wrong/);await page.locator('[data-key=A]').click();await expect(page.locator('#score')).toHaveText('Score 0');await page.locator('details.explanation').click();await expect(page.locator('details.explanation')).toContainText('Two is not');
 const events=await page.evaluate(async()=>(await import('/connected.js')).connected.active.events);expect(events[0].measurement.confidence).toBe('confident');expect(events[0].measurement.optionsRevealedAt).toBeTruthy();expect(events[0].measurement.activeMs).toBeGreaterThanOrEqual(events[0].measurement.recallMs);
 await context.setOffline(false);await page.reload();await resume(page);await expect(page.locator('[data-key=A]')).toHaveClass(/correct/);expect(await page.evaluate(async()=>(await import('/connected.js')).connected.active.events)).toEqual(events);expect(errors).toEqual([]);
});

import {test,expect} from '@playwright/test';
const quiz='Question 1: Test?\nA) Alpha\nB) Beta\nC) Gamma\nD) Delta\nE) Epsilon\nAnswer: B';
test('public paste, first-answer score, offline resume, report and retake make no private requests',async({page,context},info)=>{
  const forbidden=[],errors=[];
  context.on('request',r=>{const u=new URL(r.url());if(u.hostname!=='127.0.0.1'||/\/(api|auth|oauth|mcp)(\/|$)/.test(u.pathname)||r.method()!=='GET')forbidden.push(r.url());});
  page.on('pageerror',e=>errors.push(e.message));await page.goto('./');
  await expect(page.locator('#paste')).toBeVisible();await expect(page.locator('#accountBtn,[data-view],#savePackBtn,#workspace')).toHaveCount(0);
  await page.locator('#paste').fill(quiz);await page.locator('#appearanceBtn').click();await page.locator('.toggle').click();await expect(page.locator('#randomToggle')).toBeChecked();await page.getByRole('button',{name:'Close display settings',exact:true}).click();await expect(page.locator('#paste')).toHaveValue(quiz);
  await page.locator('#loadBtn').click();await page.locator('[data-key=A]').click();await expect(page.locator('[data-key=A]')).toHaveClass(/wrong/);
  await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>!!navigator.serviceWorker.controller);await context.setOffline(true);await page.reload();await page.locator('#resumeBtn').click();await expect(page.locator('[data-key=A]')).toHaveClass(/wrong/);
  await page.locator('[data-key=B]').click();await expect(page.locator('#score')).toHaveText('Score 0');await page.locator('#nextBtn').click();await page.locator('#reportBtn').click();await expect(page.locator('#modalText')).toHaveValue(/Answer Path: A -> B/);
  await page.getByRole('button',{name:'Close',exact:true}).last().click();await page.locator('#retakeBtn').click();await page.locator('[data-key=B]').click();await expect(page.locator('#score')).toHaveText('Score 1');
  await page.screenshot({path:`test-results/public-quiz-${info.project.name}.png`,fullPage:true});expect(forbidden).toEqual([]);expect(errors).toEqual([]);
});
test('public upload and device export restore retain answer history',async({page,context})=>{
  await page.goto('./');await page.locator('#file').setInputFiles({name:'quiz.txt',mimeType:'text/plain',buffer:Buffer.from(quiz)});await page.locator('#loadBtn').click();await page.locator('[data-key=A]').click();await expect(page.locator('[data-key=A]')).toHaveClass(/wrong/);
  const downloading=page.waitForEvent('download');await page.locator('#exportLocal').click();const file=await downloading;const backupPath=await file.path();
  const clean=await context.browser().newContext();try{const other=await clean.newPage();await other.goto('http://127.0.0.1:8788/synapse/');await other.locator('#restoreLocal').setInputFiles(backupPath);await expect(other.locator('#connectionNotice')).toContainText('Backup restored');await other.locator('#resumeBtn').click();await expect(other.locator('[data-key=A]')).toHaveClass(/wrong/);await other.locator('[data-key=B]').click();await expect(other.locator('#score')).toHaveText('Score 0');}finally{await clean.close();}
});
test('public artifact contains only the browser runner and subpath assets',async({page})=>{
  await page.goto('./?pack=untrusted&view=progress');await expect(page.locator('#paste')).toBeVisible();
  for(const path of ['workspace.js','shared/sources.js','data/catalog.json','server/auth.ts','wrangler.production.jsonc','api/status'])expect((await page.request.get(path)).status()).toBe(404);
  const adapter=await(await page.request.get('connected.js')).text();expect(adapter).not.toMatch(/fetch\s*\(|\.\/api\/|workers\.dev|setInterval\s*\(/);
  const caches=await page.evaluate(async()=>{await navigator.serviceWorker.ready;return (await Promise.all((await window.caches.keys()).map(async key=>(await(await window.caches.open(key)).keys()).map(r=>new URL(r.url).pathname)))).flat();});
  expect(caches.every(path=>path.startsWith('/synapse/'))).toBe(true);expect(caches.some(path=>/\/api\/|\/auth\/|workspace\.js/.test(path))).toBe(false);
});

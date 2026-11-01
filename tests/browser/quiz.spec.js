import {test,expect} from '@playwright/test';
const text='Question 1: Test?\nA) Alpha\nB) Beta\nC) Gamma\nD) Delta\nE) Epsilon\nAnswer: B';
test('paste, retries, report, reload resume and offline retake',async({page,context})=>{
  const external=[];page.on('request',r=>{if(!new URL(r.url()).hostname.match(/^(127\.0\.0\.1|localhost)$/))external.push(r.url());});
  await page.goto('/');await expect(page.locator('#workspace h1')).toBeVisible();await page.locator('[data-view=quiz]').click();await page.locator('#paste').fill(text);await page.getByRole('button',{name:'Start quiz',exact:false}).click();
  await page.locator('[data-key="A"]').click();await expect(page.locator('[data-key="A"]')).toHaveClass(/wrong/);await page.locator('[data-key="B"]').click();await expect(page.locator('[data-key="B"]')).toHaveClass(/correct/);await expect(page.locator('#score')).toHaveText('Score 0');
  await page.reload();await page.locator('#resumeBtn').click();await expect(page.locator('[data-key="B"]')).toHaveClass(/correct/);await page.locator('#nextBtn').click();
  await page.locator('#reportBtn').click();await expect(page.locator('#modalText')).toHaveValue(/Answer Path: A -> B/);await page.getByRole('button',{name:'Close',exact:true}).last().click();
  await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload();await page.locator('#resumeBtn').click();await context.setOffline(true);await page.reload();await page.locator('#resumeBtn').click();await page.locator('#retakeBtn').click();await page.locator('[data-key="B"]').click();await expect(page.locator('#score')).toHaveText('Score 1');expect(external).toEqual([]);
});
test('txt upload preserves original quiz path without sign-in',async({page})=>{
  await page.goto('/');await expect(page.locator('#workspace h1')).toBeVisible();await page.locator('[data-view=quiz]').click();await page.locator('#file').setInputFiles({name:'questions.txt',mimeType:'text/plain',buffer:Buffer.from(text)});await page.locator('#loadBtn').click();await expect(page.locator('.question')).toContainText('Test?');await expect(page.locator('#accountBtn')).toBeDisabled();
});
test('unmapped local work never posts to account or inference endpoints',async({page})=>{
  const posts=[];page.on('request',r=>{if(r.method()==='POST')posts.push(r.url());});await page.goto('/');await expect(page.locator('#workspace h1')).toBeVisible();await page.locator('[data-view=quiz]').click();await page.locator('#paste').fill(text);await page.locator('#loadBtn').click();await page.locator('[data-key="B"]').click();await page.locator('#nextBtn').click();expect(posts).toEqual([]);
  const cache=await page.evaluate(async()=>{await navigator.serviceWorker.ready;return (await Promise.all((await caches.keys()).map(async k=>(await(await caches.open(k)).keys()).map(r=>r.url)))).flat();});expect(cache.some(u=>/\/api\/|\/auth\/|\/mcp/.test(u))).toBe(false);
});

test('device export and restore preserve answer paths without silently replacing a continuation',async({page})=>{
  await page.goto('/');await expect(page.locator('#workspace h1')).toBeVisible();await page.locator('[data-view=quiz]').click();await page.locator('#paste').fill(text);await page.locator('#loadBtn').click();await page.locator('[data-key="A"]').click();await expect(page.locator('[data-key="A"]')).toHaveClass(/wrong/);
  const backup=await page.evaluate(async()=>({format:'synapse-device-v1',records:await(await import('/shared/offline.js')).storage('all')}));
  await page.evaluate(async()=>{const db=await(await import('/shared/offline.js')).openDatabase();await new Promise(resolve=>{const tx=db.transaction('records','readwrite');tx.objectStore('records').clear();tx.oncomplete=resolve;});db.close();});
  await page.reload();await page.locator('[data-view="settings"]').click();await page.locator('#restoreDevice').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});await expect(page.locator('#connectionNotice')).toContainText('restored');await page.locator('#resumeBtn').click();await expect(page.locator('[data-key="A"]')).toHaveClass(/wrong/);
  await page.locator('[data-key="B"]').click();await expect(page.locator('[data-key="B"]')).toHaveClass(/correct/);await page.locator('[data-view="settings"]').click();await page.locator('#restoreDevice').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});await expect(page.locator('#connectionNotice')).toContainText('different continuation');await page.locator('#resumeBtn').click();await expect(page.locator('[data-key="B"]')).toHaveClass(/correct/);
});

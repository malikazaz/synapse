// Read-only public smoke check. Never seeds or authenticates a production account.
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
process.env.PLAYWRIGHT_BROWSERS_PATH=resolve('.cache/browsers');
const {chromium}=await import('@playwright/test');
const origin=process.env.SYNAPSE_ORIGIN;
if(!origin||new URL(origin).protocol!=='https:')throw new Error('Set SYNAPSE_ORIGIN to your HTTPS deployment origin.');
const browser=await chromium.launch();
try {
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  page.setDefaultTimeout(15000);
  const errors=[],external=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(new URL(r.url()).origin!==origin)external.push(new URL(r.url()).origin);});
  await page.goto(origin,{waitUntil:'networkidle'});
  assert.equal(await page.locator('#workspace h1').innerText(),'Make your next study session count.');
  assert.equal(await page.locator('#accountBtn').isEnabled(),true);
  await page.locator('#moreBtn').click();
  assert.equal(await page.locator('#moreDialog').isVisible(),true);
  await page.locator('#moreItems [data-view=sources]').click();
  await page.locator('#sourceCount').waitFor();
  assert.equal(await page.locator('#moreDialog').isVisible(),false);
  await page.locator('#appearanceBtn').click();
  assert.equal(await page.locator('#themeSelect').isVisible(),true);
  await page.getByRole('button',{name:'Close display settings',exact:true}).click();
  await page.goto(origin+'/?view=sources',{waitUntil:'networkidle'});
  assert.equal(await page.locator('#workspace h1').innerText(),'Trusted sources');
  assert.equal(await page.locator('#sourceCount').innerText(),'25 references');
  await page.screenshot({path:'test-results/live-sources-phone.png'});
  for(const view of ['study','performance']){
    await page.goto(origin+'/?view='+view,{waitUntil:'networkidle'});
    assert.match(await page.locator('#workspace').innerText(),/Sign in/);
  }
  await page.goto(origin+'/?view=packs',{waitUntil:'networkidle'});
  assert.equal(await page.locator('#packSearch').isVisible(),true);
  assert.equal(await page.locator('[data-shelf=archive]').isVisible(),true);
  assert.equal(await page.locator('#packCount').innerText(),'0 packs');
  await page.locator('[data-view=quiz]').click();assert.equal(await page.locator('#paste').isVisible(),true);
  console.log('Live home, Sources, Study plan/My weak points sign-in states and paste/upload passed.');
  const responses=await page.evaluate(async()=>Promise.all(['/api/progress','/.well-known/oauth-protected-resource/mcp'].map(async path=>{const r=await fetch(path,{signal:AbortSignal.timeout(15000)});return {path,status:r.status};})));
  assert.equal(responses[0].status,401);assert.equal(responses[1].status,200);
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  console.log('Live privacy and OAuth discovery passed; no browser errors or external/inference requests.');
} catch(e) {
  console.error(e);process.exitCode=1;
} finally {await browser.close();}

import {test,expect} from '@playwright/test';
import {navigate,display,resume} from './navigation.js';

test('mobile navigation, sheets and large text remain usable across phone sizes',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:390,height:844});await page.goto('/');
  await expect(page.locator('#workspace h1')).toBeVisible();
  await expect(page.locator('.workspace-nav [data-view]')).toHaveCount(4);
  const dock=await page.locator('.workspace-nav').boundingBox();expect(dock.y+dock.height).toBe(844);
  await page.locator('#moreBtn').click();await expect(page.locator('#moreDialog')).toBeVisible();
  await expect(page.locator('#moreDialog').getByRole('button',{name:'My weak points',exact:true})).toBeVisible();
  await page.keyboard.press('Escape');await expect(page.locator('#moreDialog')).not.toBeVisible();
  await expect(page.locator('#moreBtn')).toBeFocused();
  await navigate(page,'sources');await expect(page.locator('#sourceCount')).toHaveText('25 references');
  await expect(page.locator('#moreBtn')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('#moreDialog')).not.toBeVisible();
  await display(page,async()=>{await page.locator('#themeSelect').selectOption('UCAT Light');await page.locator('#fontSize').fill('30');});
  for(const width of [320,390,430,844]){
    await page.setViewportSize({width,height:844});
    await expect.poll(()=>page.evaluate(()=>({viewport:innerWidth,overflow:Math.max(0,document.documentElement.scrollWidth-innerWidth),elements:[...document.querySelectorAll('body *')].filter(el=>el.getBoundingClientRect().right>innerWidth+1&&el.getBoundingClientRect().width>0).slice(0,5).map(el=>el.tagName+'.'+el.className)})),{message:`No horizontal overflow at ${width}px with large text`}).toMatchObject({viewport:width,overflow:0});
    if(width>720)await expect(page.locator('.workspace-nav [data-view=sources]')).toBeVisible();
    else{await page.locator('#moreBtn').click();await expect(page.locator('#moreItems [data-view=sources]')).toBeVisible();await page.getByRole('button',{name:'Close menu',exact:true}).click();}
  }
  await page.setViewportSize({width:390,height:844});await navigate(page,'quiz');await expect(page.locator('#paste')).toBeVisible();
  await page.locator('#paste').fill('A draft that survives switching screens');await navigate(page,'home');await navigate(page,'quiz');
  await expect(page.locator('#paste')).toHaveValue('A draft that survives switching screens');expect(errors).toEqual([]);
});

test('long mobile questions, question list, feedback and offline resume preserve answers',async({page,context})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/?view=quiz');
  const question=n=>`Question ${n}: ${'A long clinical vignette with relevant history, examination findings and investigations. '.repeat(5)}Which option best answers the question?\nA) ${'A long distractor with additional detail. '.repeat(3)}\nB) The correct option\nC) Another possible option\nD) A fourth option\nE) A fifth option\nAnswer: B`;
  await page.locator('#paste').fill(question(1)+'\n\n'+question(2));await page.locator('#loadBtn').click();
  await expect(page.locator('#questionNavigator')).toBeHidden();
  await page.locator('#toggleNavBtn').click();await expect(page.locator('#questionNavigator')).toBeVisible();
  await page.locator('#toggleNavBtn').click();await expect(page.locator('#questionNavigator')).toBeHidden();
  await page.locator('[data-key=A]').click();await expect(page.locator('.question-feedback')).toContainText('Not quite');
  await page.locator('[data-key=B]').click();await expect(page.locator('.question-feedback')).toContainText('first-answer score is unchanged');
  await page.locator('#nextBtn').click();await expect(page.locator('#progress')).toHaveText('Question 2 / 2');
  expect((await page.locator('.question').boundingBox()).y).toBeLessThan(40);
  await display(page,async()=>{await page.keyboard.press('b');await expect(page.locator('#progress')).toHaveText('Question 2 / 2');});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.locator('[data-key=B]').click();await expect(page.locator('#score')).toHaveText('Score 1');
  await page.screenshot({path:'test-results/mobile-quiz.png',fullPage:true});
  await page.locator('#nextBtn').click();await expect(page.locator('.score-pct')).toContainText('50%');await page.evaluate(()=>navigator.serviceWorker.ready);
  await context.setOffline(true);await page.reload();await resume(page);await expect(page.locator('.score-pct')).toContainText('50%');
  await display(page,()=>page.locator('#themeSelect').selectOption('High Contrast'));
  await page.locator('#reportBtn').click();await expect(page.locator('#modalText')).toHaveValue(/A -> B/);
});

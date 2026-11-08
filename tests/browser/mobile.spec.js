import {test,expect} from '@playwright/test';
import {navigate,display,resume} from './navigation.js';

test('lower answer options remain tappable on a short phone viewport',async({page})=>{
  await page.setViewportSize({width:390,height:600});await page.goto('/?view=quiz');
  await page.locator('#paste').fill('Question 1: A longer question with several relevant observations. Which of the following options is the best answer?\nA) A longer first option with enough text to wrap over several lines on a phone\nB) A longer second option with supporting detail to consider\nC) A third option with more detail to read before answering\nD) A fourth option near the bottom of the question\nE) The final option, which must stay fully reachable\nAnswer: E');
  await page.locator('#loadBtn').click();await expect(page.locator('.workspace-nav')).toBeHidden();
  await expect(page.locator('.topbar')).toBeHidden();
  for(const width of [320,390]){
    await page.setViewportSize({width,height:600});
    for(const key of ['D','E']){
      const option=page.locator(`[data-key=${key}]`);await option.scrollIntoViewIfNeeded();
      expect(await option.evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));})).toBe(true);
    }
    const end=await page.locator('[data-key=E]').boundingBox(),footer=await page.locator('.footerBar').boundingBox();expect(footer.y).toBeGreaterThanOrEqual(end.y+end.height);
    expect(footer.y+footer.height).toBeLessThanOrEqual(600);
    expect(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight)).toBe(true);
    await expect(page.locator('#nextBtn')).toBeInViewport();
  }
  await page.locator('[data-key=D]').click();await expect(page.locator('[data-key=D]')).toHaveClass(/wrong/);
  await page.locator('[data-key=E]').click();await expect(page.locator('[data-key=E]')).toHaveClass(/correct/);await expect(page.locator('#score')).toHaveText('Score 0');
  await page.locator('#homeBtn').click();await expect(page.locator('.workspace-nav')).toBeVisible();
  await page.locator('.continue-card [data-resume]').click();await expect(page.locator('[data-key=E]')).toHaveClass(/correct/);await expect(page.locator('.workspace-nav')).toBeHidden();
  await page.locator('#nextBtn').click();await expect(page.locator('.results-card')).toBeVisible();await expect(page.locator('.workspace-nav')).toBeVisible();
});

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
  expect((await page.locator('.question').boundingBox()).y).toBeLessThan(110);
  expect(await page.locator('.quiz-scroll').evaluate(el=>el.scrollTop)).toBe(0);
  await display(page,async()=>{await page.keyboard.press('b');await expect(page.locator('#progress')).toHaveText('Question 2 / 2');});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.locator('[data-key=B]').click();await expect(page.locator('#score')).toHaveText('Score 1');
  await page.screenshot({path:'test-results/mobile-quiz.png',fullPage:true});
  await page.locator('#nextBtn').click();await expect(page.locator('.score-pct')).toContainText('50%');await page.evaluate(()=>navigator.serviceWorker.ready);
  await context.setOffline(true);await page.reload();await resume(page);await expect(page.locator('.score-pct')).toContainText('50%');
  await display(page,()=>page.locator('#themeSelect').selectOption('High Contrast'));
  await page.locator('#reportBtn').click();await expect(page.locator('#modalText')).toHaveValue(/A -> B/);
});


test('focused quiz keeps navigation reachable, settings available and errors visible as the viewport changes',async({page},info)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:390,height:700});await page.goto('/');
  await page.evaluate(async()=>{
    const {connected}=await import('/connected.js');
    const question={id:crypto.randomUUID(),original_q_number:1,question:'Which observation best supports the proposed explanation?',options:{A:'A consistent pattern across repeated observations',B:'One isolated finding without supporting evidence',C:'A result unrelated to the original question',D:'An assumption that has not yet been tested',E:'A possibility contradicted by the available evidence'},answer:'A',learningStage:'foundation',difficulty:'introductory',explanation:'Look for evidence that consistently supports the explanation.'};
    await connected.begin([question,{...question,id:crypto.randomUUID(),original_q_number:2}]);connected.emit();
  });
  await page.locator('#revealOptions').click();
  await expect(page.locator('[data-key=E]')).toBeInViewport();
  await expect(page.locator('#nextBtn')).toBeInViewport();
  await page.screenshot({path:`test-results/focused-quiz-${info.project.name}.png`});
  await page.locator('#quizToolsBtn').click();await expect(page.locator('#savePackBtn')).toBeVisible();
  await expect(page.locator('#quizToolsStatus')).toContainText('Saved');
  await page.locator('.install-help summary').click();await expect(page.locator('.install-help')).toContainText('Open as Web App');
  await page.getByRole('button',{name:'Close quiz settings',exact:true}).click();
  await expect(page.locator('#quizToolsBtn')).toBeFocused();
  await page.evaluate(async()=>{(await import('/connected.js')).connected.notify('Answer not saved: storage unavailable',true);});
  await expect(page.locator('.quiz-live-status')).toContainText('Answer not saved');
  await page.evaluate(async()=>{(await import('/connected.js')).connected.notify('',false);});
  await page.locator('[data-key=A]').click();await page.locator('#reviewExplanation').click();
  await expect(page.locator('.explanation')).toHaveAttribute('open','');await expect(page.locator('.explanation p')).toBeInViewport();
  await page.locator('#nextBtn').click();await expect(page.locator('#progress')).toHaveText('Question 2 / 2');
  await expect(page.locator('#revealOptions')).toBeInViewport();
  await display(page,()=>page.locator('#fontSize').fill('30'));await page.locator('#revealOptions').click();
  await page.setViewportSize({width:320,height:480});
  await page.locator('[data-key=E]').scrollIntoViewIfNeeded();
  const pane=await page.locator('.quiz-scroll').boundingBox(),footer=await page.locator('.footerBar').boundingBox();
  expect(pane.height).toBeGreaterThan(100);expect(pane.y+pane.height).toBeLessThanOrEqual(footer.y+1);
  await expect(page.locator('#nextBtn')).toBeInViewport();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.locator('#toggleNavBtn').click();await expect(page.locator('#questionNavigator')).toBeVisible();
  await page.locator('.navbtn[data-idx="0"]').click();await expect(page.locator('#questionNavigator')).toBeHidden();
  await page.setViewportSize({width:1280,height:800});await expect(page.locator('.topbar')).toBeVisible();
  await expect(page.locator('body>.quiz-actions #savePackBtn')).toBeVisible();
  expect(errors).toEqual([]);
});

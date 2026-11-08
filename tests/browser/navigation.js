export async function navigate(page,view){
  const button=page.locator(`[data-view="${view}"]`);
  if(!await button.isVisible()&&await page.locator('#homeBtn').isVisible()&&await page.locator('.quizmain').isVisible())await page.locator('#homeBtn').click();
  if(!await button.isVisible()&&await page.locator('#moreBtn').isVisible())await page.locator('#moreBtn').click();
  await button.click();
}
export async function resume(page){
  if(!await page.locator('#resumeBtn').isVisible())await navigate(page,'quiz');
  await page.locator('#resumeBtn').click();
}
export async function display(page,change){
  await page.locator('#appearanceBtn').click();await change();
  await page.getByRole('button',{name:'Close display settings',exact:true}).click();
}

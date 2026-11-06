import {test,expect,type Page} from '@playwright/test';
async function ready(page:Page,path:string){await page.goto(path);await expect(page.locator('[data-ready]')).toHaveAttribute('data-ready','true',{timeout:45000});await page.evaluate(()=>document.fonts.ready);}
async function nativeClick(page:Page,name:string){
 const view=page.locator('.table-view');
 await expect.poll(async()=>JSON.parse((await view.getAttribute('data-targets'))??'[]').some((p:{name:string})=>p.name===name)).toBe(true);
 const targets=JSON.parse((await view.getAttribute('data-targets'))!);const target=targets.find((t:{name:string})=>t.name===name),box=(await view.boundingBox())!;
 await page.mouse.click(box.x+target.x,box.y+target.y);
}
async function seek(page:Page,value:number){await page.getByLabel('Animation timeline').fill(String(Math.round(value*1000)/1000));await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));}
test('native 3D plaques select, move, save, and pass the turn',async({page})=>{
 await ready(page,'/dev/animations?scene=pair');
 await nativeClick(page,'6 + 8');await expect(page.getByRole('button',{name:'Pair 6 and 8',exact:true})).toHaveAttribute('aria-pressed','true');
 await nativeClick(page,'7 + 7');await nativeClick(page,'MOVE 7 TWICE');
 await expect(page.locator('.table-view')).toHaveAttribute('data-kind','advance');
 await expect(page.locator('.table-view')).toHaveAttribute('data-phase','decide',{timeout:10000});
 await page.screenshot({path:'artifacts/desktop-advance.png',fullPage:true});
 await nativeClick(page,'STOP & SAVE');await expect(page.locator('.table-view')).toHaveAttribute('data-kind','save');
 await expect(page.locator('.table-view')).toHaveAttribute('data-phase','ready',{timeout:10000});
 await nativeClick(page,'ROLL DICE');await expect(page.locator('.table-view')).toHaveAttribute('data-kind',/roll|bust/);
});
test('every motion can be scrubbed backward, and reduced motion settles immediately',async({page})=>{
 test.setTimeout(180000); // Full-quality software rendering visits every material and motion.
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await ready(page,'/dev/animations?scene=advance');
 await seek(page,0);const start=await page.locator('.table-view').getAttribute('data-runners');
 await seek(page,1.05);expect(await page.locator('.table-view').getAttribute('data-runners')).not.toBe(start);
 await seek(page,0);expect(await page.locator('.table-view').getAttribute('data-runners')).toBe(start);
 for(const id of ['roll','save','bust','summit','claim','win','last-runner','reconnect','turn']){
  await page.getByRole('button',{name:({'roll':/Roll the dice/,'save':/Stop & save/,'bust':/A roll too far/,'summit':/The summit is still/,'claim':/Claim a column/,'win':/The third summit/,'last-runner':/One runner, two/,'reconnect':/Return to the table/,'turn':/A complete turn/} as Record<string,RegExp>)[id]}).click();
  const max=Number(await page.getByLabel('Animation timeline').getAttribute('max'));await seek(page,max*.5);await seek(page,max);
  await expect(page.locator('[data-ready="true"]')).toBeVisible();
 }
 await page.getByRole('button',{name:/The third summit/}).click();await page.getByLabel('Reduced motion').check();
 await expect(page.locator('.table-view')).toHaveAttribute('data-phase','finished');await expect(page.getByLabel('Play animation',{exact:true})).toBeDisabled();
 expect(errors).toEqual([]);
});
test('phone canvas uses the same model, accepts touch, and fits its viewport',async({browser})=>{
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 await ready(page,'/dev/animations?scene=pair&device=phone&clean=1');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
 const view=page.locator('.table-view');await expect(view).toHaveAttribute('data-phone','true');
 const targets=JSON.parse((await view.getAttribute('data-targets'))!),target=targets.find((p:{name:string})=>p.name==='MOVE 7 TWICE'),box=(await view.boundingBox())!;
 expect(target.x).toBeGreaterThan(0);expect(target.x).toBeLessThan(390);expect(target.y).toBeLessThan(844);
 await page.touchscreen.tap(box.x+target.x,box.y+target.y);
 await expect(view).toHaveAttribute('data-phase','decide',{timeout:10000});
 await page.screenshot({path:'artifacts/phone-advance.png'});
 await page.setViewportSize({width:844,height:390});await expect(view).toHaveAttribute('data-phase','decide');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(844);
 await page.close();
});
test('all gallery components render and camera orbit is available',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await ready(page,'/gallery?component=board');
 for(const text of ['Ruby dice','Black runners','Saved markers','Action pieces','The materials','The diamond']){
  await page.locator('.component-list').getByRole('button',{name:new RegExp(text)}).click();
  await expect(page.locator('.component-caption h2')).toHaveText(text);
  await expect(page.locator('[data-ready="true"]')).toBeVisible();
 }
 await page.getByRole('button',{name:'Orbit camera',exact:true}).click();await expect(page.getByRole('button',{name:'Lock camera',exact:true})).toBeVisible();
 await page.screenshot({path:'artifacts/gallery-board.png',fullPage:true});expect(errors).toEqual([]);
});

test('the final runner is chosen on the 3D table before the move commits',async({page})=>{
 await ready(page,'/dev/animations?scene=last-runner');
 await nativeClick(page,'RUNNER ON 8');
 await nativeClick(page,'MOVE 8 ONLY');
 await expect(page.locator('.table-view')).toHaveAttribute('data-phase','decide',{timeout:10000});
 const runners=JSON.parse((await page.locator('.table-view').getAttribute('data-runners'))!);
 expect(runners).toHaveLength(3);expect(runners.some((p:{id:string})=>p.id==='runner-8')).toBe(true);
 await page.screenshot({path:'artifacts/last-runner.png',fullPage:true});
});

test('approved pieces, the podium, and both phone orientations preserve the same frame',async({page})=>{
 await ready(page,'/dev/animations?scene=ready&look=walnut');
 const view=page.locator('.table-view');
 await expect(view).toHaveAttribute('data-track-finish','ivory');
 await expect(view).toHaveAttribute('data-runner-colour','#171619');
 await expect(page.getByRole('group',{name:'Material comparison'})).toHaveCount(0);
 expect(page.url()).not.toContain('look=');
 const readyPieces=JSON.parse((await view.getAttribute('data-pieces'))!);
 const reserve=readyPieces.filter((p:{runner:boolean;onBoard:boolean})=>p.runner&&!p.onBoard);
 expect(reserve).toHaveLength(3);
 expect(new Set(readyPieces.map((p:{scale:number})=>p.scale))).toEqual(new Set([1.22]));
 await page.screenshot({path:'artifacts/podium-desktop.png',fullPage:true});
 await page.getByRole('button',{name:/Move 7 twice/}).click();await seek(page,1.05);
 const runners=await view.getAttribute('data-runners');
 await page.getByRole('button',{name:'Phone portrait',exact:true}).click();
 await expect(view).toHaveAttribute('data-phone','true');
 const portrait=(await view.boundingBox())!;expect(portrait.height/portrait.width).toBeCloseTo(844/390,2);
 await expect(page.getByLabel('Animation timeline')).toHaveValue('1.05');await expect(view).toHaveAttribute('data-runners',runners!);
 await page.getByRole('button',{name:'Phone landscape',exact:true}).click();
 const landscape=(await view.boundingBox())!;expect(landscape.width/landscape.height).toBeCloseTo(844/390,2);
 await expect(page.getByLabel('Animation timeline')).toHaveValue('1.05');await expect(view).toHaveAttribute('data-runners',runners!);
 await page.screenshot({path:'artifacts/podium-landscape-lab.png',fullPage:true});
 await page.reload();await expect(view).toHaveAttribute('data-ready','true',{timeout:45000});
 await expect(page.getByRole('button',{name:'Phone landscape',exact:true})).toHaveAttribute('aria-pressed','true');
});

test('portrait crops empty diamond corners while keeping every track and number visible',async({browser})=>{
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 await ready(page,'/dev/animations?scene=ready&device=phone&clean=1');
 const view=page.locator('.table-view');
 await expect.poll(async()=>!!await view.getAttribute('data-board-framing')).toBe(true);
 const framing=JSON.parse((await view.getAttribute('data-board-framing'))!);
 expect(framing.leftCorner.x).toBeLessThan(0);expect(framing.rightCorner.x).toBeGreaterThan(390);
 expect(framing.tracks).toHaveLength(11);
 for(const track of framing.tracks){
  expect(track.x).toBeGreaterThan(0);expect(track.x).toBeLessThan(390);
  expect(track.label.left).toBeGreaterThan(0);expect(track.label.right).toBeLessThan(390);
  expect(track.label.top).toBeGreaterThan(0);expect(track.label.bottom).toBeLessThan(844);
 }
 expect(framing.tracks.find((t:{column:number})=>t.column===2).x).toBeLessThan(390*.08);
 expect(framing.tracks.find((t:{column:number})=>t.column===12).x).toBeGreaterThan(390*.92);
 await page.screenshot({path:'artifacts/portrait-board-zoom.png'});
 await page.close();
});

test('desktop table and overhead cameras contain complete action plaques',async({page})=>{
 await page.setViewportSize({width:1280,height:720});
 await ready(page,'/dev/animations?scene=pair');
 const view=page.locator('.table-view');
 async function checkPlaques(){
  await page.evaluate(()=>new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r()))));
  const box=(await view.boundingBox())!;
  const targets=JSON.parse((await view.getAttribute('data-targets'))!);
  expect(targets.length).toBeGreaterThanOrEqual(2);
  for(const target of targets){
   expect(target.bounds.left,`${target.name} left`).toBeGreaterThan(8);
   expect(target.bounds.right,`${target.name} right`).toBeLessThan(box.width-8);
   expect(target.bounds.top,`${target.name} top`).toBeGreaterThan(8);
   expect(target.bounds.bottom,`${target.name} bottom`).toBeLessThan(box.height-8);
  }
 }
 for(const angle of ['table','overhead']){
  await page.getByLabel('Camera angle').selectOption(angle);
  await page.getByRole('button',{name:/Choose your climb/}).click();await checkPlaques();
  await page.getByRole('button',{name:/One runner, two/}).click();
  await nativeClick(page,'RUNNER ON 8');await checkPlaques();
  await page.getByRole('button',{name:/Move 7 twice/}).click();await seek(page,2.4);await checkPlaques();
  await page.screenshot({path:`artifacts/desktop-actions-${angle}.png`,fullPage:true});
 }
 await page.setViewportSize({width:1440,height:1000});await checkPlaques();
});

test('a closed sum remains visibly inactive while its usable partner moves',async({page})=>{
 await ready(page,'/dev/animations?scene=closed-column');
 await expect(page.getByRole('button',{name:'Pair 5 and 10 (closed)',exact:true})).toHaveAttribute('aria-pressed','true');
 const view=page.locator('.table-view');
 await expect.poll(async()=>JSON.parse((await view.getAttribute('data-targets'))??'[]').some((t:{name:string})=>t.name==='MOVE 5')).toBe(true);
 await nativeClick(page,'MOVE 5');
 await expect(view).toHaveAttribute('data-phase','decide',{timeout:10000});
 const runners=JSON.parse((await view.getAttribute('data-runners'))!);
 expect(runners.map((p:{id:string})=>p.id)).toEqual(['runner-5']);
});

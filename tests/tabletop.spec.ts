import {test,expect,type Page} from '@playwright/test';
import {readEvents,settled} from './helpers/game';
import {replay} from '../src/game/engine';
test.setTimeout(300000);
async function touch(page:Page,name:string,commits=true){
 const revision=Number(await page.locator('.game-shell').getAttribute('data-revision'));
 await expect.poll(async()=>JSON.parse(await page.locator('.table-view').getAttribute('data-targets')??'[]').some((t:{name:string})=>t.name===name)).toBe(true);
 const view=page.locator('.table-view'),target=JSON.parse((await view.getAttribute('data-targets'))!).find((t:{name:string})=>t.name===name),box=(await view.boundingBox())!;
 await page.touchscreen.tap(box.x+target.x,box.y+target.y);
 if(commits)await expect.poll(async()=>Number(await page.locator('.game-shell').getAttribute('data-revision')),{timeout:30000}).toBeGreaterThan(revision);
}
async function fit(page:Page){
 const view=page.locator('.table-view'),box=(await view.boundingBox())!;
 for(const target of JSON.parse((await view.getAttribute('data-targets'))!)){
  expect(target.bounds.left,`${target.name} left`).toBeGreaterThan(4);expect(target.bounds.right,`${target.name} right`).toBeLessThan(box.width-4);
  expect(target.bounds.top,`${target.name} top`).toBeGreaterThan(4);expect(target.bounds.bottom,`${target.name} bottom`).toBeLessThan(box.height-4);
 }
}
test('four people share a touch table, pick physical seats, and take turns on every edge',async({browser,request})=>{
 const context=await browser.newContext({viewport:{width:1920,height:1080},hasTouch:true,deviceScaleFactor:1}),page=await context.newPage();
 await context.addInitScript(()=>localStorage.setItem('cantstop:settings:v1',JSON.stringify({view:'tabletop',animationSpeed:'blazing'})));
 try{
  await page.goto('/?view=tabletop');await page.getByLabel('Your name',{exact:true}).fill('Alex');await page.getByRole('button',{name:'New tabletop game',exact:true}).click();
  await expect(page.getByRole('button',{name:'Start game',exact:true})).toBeVisible();
  for(const [i,name] of ['Sam','Cal','Dev'].entries()){await page.getByLabel('Next player’s name',{exact:true}).fill(name);await page.getByRole('button',{name:'Add player on this screen',exact:true}).click();await expect(page.locator('.seat-list li')).toHaveCount(i+2);}
  await page.getByLabel('Seat for Sam',{exact:true}).selectOption('east');await page.getByLabel('Seat for Cal',{exact:true}).selectOption('north-right');await page.getByLabel('Seat for Dev',{exact:true}).selectOption('west');
  await page.getByRole('button',{name:'Start game',exact:true}).click();await settled(page);
  const room=new URL(page.url()).searchParams.get('table')!,initial=await readEvents(request,room),players=replay(initial).players;
  expect(players.every(p=>!p.bot)).toBe(true);expect(new Set(players.map(p=>p.id)).size).toBe(4);await expect(page.locator('.table-view')).toHaveAttribute('data-tabletop','true');
  const yaw=[0,Math.PI/2,Math.PI,-Math.PI/2];
  for(let seat=0;seat<4;seat++){
   await settled(page);await expect(page.locator('.game-shell')).toHaveAttribute('data-can-act','true');
   expect(JSON.parse((await page.locator('.table-view').getAttribute('data-tabletop-pose'))!).angle).toBeCloseTo(yaw[seat]);
   const target=JSON.parse((await page.locator('.table-view').getAttribute('data-targets'))!).find((t:{name:string})=>/^\d+ \+ \d+$/.test(t.name));expect(target).toBeTruthy();
   await touch(page,target.name);await settled(page);await fit(page);await page.screenshot({path:`artifacts/tabletop-edge-${seat}.png`});
   await touch(page,'STOP & SAVE');await settled(page);
  }
  const log=await readEvents(request,room);expect(log.slice(initial.length).map((e:{actor:string})=>e.actor)).toEqual(players.flatMap(p=>[p.id,p.id]));
  // Reseating is a device preference, and is reached through native 3D plaques.
  await touch(page,'ALEX · 0/3',false);await touch(page,'SEAT SOUTH RIGHT',false);await settled(page);
  const seats=JSON.parse((await page.locator('.table-view').getAttribute('data-seats'))!);expect(seats[players[0].id]).toBe('south-right');expect(await readEvents(request,room)).toEqual(log);
  await page.reload();await settled(page);expect(JSON.parse((await page.locator('.table-view').getAttribute('data-seats'))!)).toEqual(seats);
  await expect(page.locator('.game-shell')).toHaveAttribute('data-can-act','true');expect(JSON.parse((await page.locator('.game-shell').getAttribute('data-local-players'))!)).toHaveLength(3);
  // Full resolution uses the same scene, not a scaled screenshot or test renderer.
  await page.setViewportSize({width:3840,height:2160});await settled(page);await fit(page);await page.screenshot({path:'artifacts/tabletop-4k.png'});
  await touch(page,'TABLE MENU',false);await expect(page.getByRole('dialog',{name:'Settings',exact:true})).toBeVisible();await expect(page.getByLabel('View',{exact:true})).toHaveValue('tabletop');
  await page.getByRole('button',{name:'Back to the table',exact:true}).click();expect(await readEvents(request,room)).toEqual(log);
 }finally{await context.close();}
});


test('the tabletop lab handoff can be scrubbed backward without changing the game',async({page})=>{
 await page.setViewportSize({width:1920,height:1080});await page.goto('/dev/animations?device=tabletop&scene=save');
 const view=page.locator('.table-view');await expect(view).toHaveAttribute('data-ready','true',{timeout:90000});await expect(view).toHaveAttribute('data-tabletop','true');
 await page.getByLabel('Animation timeline',{exact:true}).fill('0');const first=await view.getAttribute('data-tabletop-pose');
 const max=(await page.getByLabel('Animation timeline',{exact:true}).getAttribute('max'))!;await page.getByLabel('Animation timeline',{exact:true}).fill(max);
 await expect.poll(async()=>JSON.parse((await view.getAttribute('data-tabletop-pose'))!).angle).toBeCloseTo(Math.PI/2);
 await page.getByLabel('Animation timeline',{exact:true}).fill('0');await expect(view).toHaveAttribute('data-tabletop-pose',first!);
 await page.getByRole('button',{name:'Phone landscape',exact:true}).click();await expect(view).toHaveAttribute('data-tabletop','false');
 await page.getByRole('button',{name:'Tabletop',exact:true}).click();await expect(view).toHaveAttribute('data-tabletop','true');expect(page.url()).toContain('device=tabletop');
});

import {test,expect,type Page} from '@playwright/test';
import {readEvents,settled} from './helpers/game';
import {replay} from '../src/game/engine';
// Full-resolution 4K software rendering is substantially slower than a GPU table.
test.setTimeout(600000);
async function touch(page:Page,name:string,commits=true,occurrence=0){
 const revision=Number(await page.locator('.game-shell').getAttribute('data-revision'));
 await expect.poll(async()=>JSON.parse(await page.locator('.table-view').getAttribute('data-targets')??'[]').some((t:{name:string})=>t.name===name)).toBe(true);
 const view=page.locator('.table-view'),target=JSON.parse((await view.getAttribute('data-targets'))!).filter((t:{name:string})=>t.name===name)[occurrence],box=(await view.boundingBox())!;
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
test('four people share a walk-up touch table, choose colours, and take turns on every edge',async({browser,request})=>{
 const context=await browser.newContext({viewport:{width:1920,height:1080},hasTouch:true,deviceScaleFactor:1}),page=await context.newPage();
 await context.addInitScript(()=>localStorage.setItem('cantstop:settings:v1',JSON.stringify({view:'standard',animationSpeed:'blazing'})));
 try{
  await page.goto('/tt/');await settled(page);await expect(page.locator('.game-shell')).toHaveAttribute('data-game-phase','gathering');
  await expect(page.getByRole('textbox')).toHaveCount(0);expect(new URL(page.url()).search).toBe('');
  const room=(await page.locator('.game-shell').getAttribute('data-room'))!;
  expect(await readEvents(request,room)).toEqual([]);await page.screenshot({path:'artifacts/tabletop-empty.png'});
  const seats=['SOUTH LEFT','EAST','NORTH RIGHT','WEST'],colours=['RUBY','TEAL','VIOLET','GOLD'];
  for(let i=0;i<4;i++){
   await touch(page,`TAKE ${seats[i]} SEAT`,false);
   if(i===0)await page.screenshot({path:'artifacts/tabletop-colour-picker.png'});
   if(i===1)await expect(page.getByRole('button',{name:'Choose Ruby',exact:true})).toBeDisabled();
   await touch(page,`CHOOSE ${colours[i]}`);await settled(page);
  }
  await page.screenshot({path:'artifacts/tabletop-ready.png'});
  await touch(page,'START GAME',true,1);await settled(page);
  const initial=await readEvents(request,room),players=replay(initial).players;
  expect(initial.slice(0,4).map((e:{intent:{type:string}})=>e.intent.type)).toEqual(['sit','sit','sit','sit']);
  expect(players.map(p=>p.colour)).toEqual([2,0,3,1]);expect(new Set(players.map(p=>p.id)).size).toBe(4);expect(initial[4].actor).toBe(players[1].id);
  const yaw=[0,Math.PI/2,Math.PI,-Math.PI/2];
  for(let seat=0;seat<4;seat++){
   await settled(page);await expect(page.locator('.game-shell')).toHaveAttribute('data-can-act','true');
   expect(JSON.parse((await page.locator('.table-view').getAttribute('data-tabletop-pose'))!).angle).toBeCloseTo(yaw[seat]);
   const target=JSON.parse((await page.locator('.table-view').getAttribute('data-targets'))!).find((t:{name:string})=>/^\d+ \+ \d+$/.test(t.name));expect(target).toBeTruthy();
   await touch(page,target.name);await settled(page);await fit(page);await page.screenshot({path:`artifacts/tabletop-edge-${seat}.png`});
   await touch(page,'STOP & SAVE');await settled(page);
  }
  const log=await readEvents(request,room);expect(log.slice(initial.length).map((e:{actor:string})=>e.actor)).toEqual(players.flatMap(p=>[p.id,p.id]));
  await touch(page,'RUBY · 0/3',false);await touch(page,'SEAT SOUTH RIGHT',false);await settled(page);
  const places=JSON.parse((await page.locator('.table-view').getAttribute('data-seats'))!);expect(places[players[0].id]).toBe('south-right');expect(await readEvents(request,room)).toEqual(log);
  await page.reload();await expect(page.locator('.game-shell')).toHaveAttribute('data-revision',String(log.length),{timeout:90000});await settled(page);expect(await page.locator('.game-shell').getAttribute('data-room')).toBe(room);expect(JSON.parse((await page.locator('.table-view').getAttribute('data-seats'))!)).toEqual(places);
  await expect(page.locator('.game-shell')).toHaveAttribute('data-can-act','true');expect(JSON.parse((await page.locator('.game-shell').getAttribute('data-local-players'))!)).toHaveLength(3);
  await page.setViewportSize({width:3840,height:2160});await settled(page);await fit(page);await page.screenshot({path:'artifacts/tabletop-4k.png'});
  await touch(page,'TABLE MENU',false);await expect(page.getByRole('dialog',{name:'Table menu',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'New game',exact:true}).click();await settled(page);
  expect(await page.locator('.game-shell').getAttribute('data-room')).not.toBe(room);await expect(page.locator('.game-shell')).toHaveAttribute('data-revision','0');await expect(page.getByRole('textbox')).toHaveCount(0);
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

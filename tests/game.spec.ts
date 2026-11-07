import {test,expect,type Page,type APIRequestContext} from '@playwright/test';
import {replay} from '../src/game/engine';
test.setTimeout(240000);
import {code,readEvents,settled,clickMesh,clickFirstPairing,nextGameSeed} from './helpers/game';
test('four independent clients launch, take turns, restore, and replay only player choices',async({browser,request},info)=>{
 // Independent devices do not share one browser GPU process. Keep all four full
 // renderers active while isolating driver contexts, just as separate computers do.
 const clients=await Promise.all(Array.from({length:4},()=>browser.browserType().launch({...info.project.use.launchOptions,channel:'chromium'})));
 const room=code(),contexts=await Promise.all(clients.map(client=>client.newContext({viewport:{width:1180,height:820}})));
 for(const context of contexts)await context.addInitScript(()=>{if(location.protocol.startsWith('http')&&!localStorage.getItem('cantstop:settings:v1'))localStorage.setItem('cantstop:settings:v1',JSON.stringify({view:'standard',animationSpeed:'blazing'}));});
 const pages=await Promise.all(contexts.map(c=>c.newPage())),errors:string[]=[];pages.forEach(p=>p.on('pageerror',e=>errors.push(e.message)));
 try{
  await pages[1].goto(`/?launch=join&table=${room}&name=Sam`);await expect(pages[1].getByText('Waiting for the host',{exact:true})).toBeVisible();
  await pages[0].goto(`/?launch=create&table=${room}&name=Sam`);await expect(pages[0].getByRole('button',{name:'Start game'})).toBeVisible();
  for(let i=2;i<4;i++)await pages[i].goto(`/?launch=join&table=${room}&name=Friend${i}`);
  await expect(pages[0].locator('.seat-list li')).toHaveCount(4,{timeout:15000});
  await nextGameSeed(pages[0],'00000000-0000-4000-8000-000000000001');await pages[0].getByRole('button',{name:'Start game'}).click();for(const page of pages)await settled(page);
  const initial=await readEvents(request,room);expect(initial).toHaveLength(5);
  await pages[0].getByRole('button',{name:'Settings',exact:true}).click();await expect(pages[0].getByLabel('View',{exact:true})).toHaveValue('standard');await expect(pages[0].getByLabel('Animation speed',{exact:true})).toHaveValue('blazing');
  await pages[0].getByLabel('View',{exact:true}).selectOption('overhead');await pages[0].getByLabel('Animation speed',{exact:true}).selectOption('fast');await pages[0].getByRole('button',{name:'Back to the table'}).click();
  expect(await readEvents(request,room)).toEqual(initial);
  await pages[0].reload();await settled(pages[0]);expect(await readEvents(request,room)).toEqual(initial);
  await pages[0].getByRole('button',{name:'Settings',exact:true}).click();await expect(pages[0].getByLabel('View',{exact:true})).toHaveValue('overhead');await pages[0].getByLabel('Animation speed',{exact:true}).selectOption('blazing');await pages[0].getByRole('button',{name:'Back to the table'}).click();
  const view=pages[0].locator('.table-view');await expect(view).toHaveAttribute('data-phase','choose');
  await expect(pages[0].getByRole('button',{name:'Roll dice',exact:true})).toHaveCount(0);await expect(pages[0].getByRole('button',{name:'Move selected pairing',exact:true})).toHaveCount(0);
  const {pairings}=await import('../src/lib/model/game');const {apply}=await import('../src/game/engine');const opening=replay(initial);
  const first=pairings(opening.game!)[0],second=pairings(opening.game!)[1];
  await clickMesh(pages[0],first.sums.join(' + '));await settled(pages[0]);
  await clickMesh(pages[0],second.sums.join(' + '),true,first.sums.join(' + ')===second.sums.join(' + ')?1:0);await settled(pages[0]);
  let log=await readEvents(request,room);expect(log).toHaveLength(initial.length+2);
  expect(replay(log).game).toEqual(apply(opening,opening.players[0].id,{type:'advance',pairing:1}).game);
  for(const page of pages)await expect(page.locator('.table-view')).toHaveAttribute('data-selected-pairing','1');
  await pages[0].reload();await settled(pages[0]);await expect(view).toHaveAttribute('data-selected-pairing','1');
  await clickMesh(pages[0],first.sums.join(' + '));await settled(pages[0]);
  log=await readEvents(request,room);expect(replay(log).game).toEqual(apply(opening,opening.players[0].id,{type:'advance',pairing:0}).game);
  await clickMesh(pages[0],'STOP & SAVE');for(const page of pages)await settled(page);
  const final=await readEvents(request,room),restored=replay(final);expect(restored.game!.active).toBe(1);expect(restored.game!.phase).toBe('choose');
  expect(final.slice(initial.length).map((e:{intent:{type:string}})=>e.intent.type)).toEqual(['advance','advance','advance','stop']);
  for(const page of pages){await expect(page.locator('.game-shell')).toHaveAttribute('data-revision',String(final.length));await expect(page.locator('.table-view')).toHaveAttribute('data-phase','choose');}
  expect((await readEvents(request,room)).length).toBe(final.length);
  await pages[0].getByRole('button',{name:'History',exact:true}).click();await pages[0].getByRole('slider',{name:'Replay action',exact:true}).fill('5');
  const download=pages[0].waitForEvent('download');await pages[0].getByRole('button',{name:'Download game log'}).click();const file=await download;expect(file.suggestedFilename()).toBe(`cantstop-${room}.json`);
  await pages[0].getByRole('button',{name:'Close history',exact:true}).click();
  await pages[0].screenshot({path:'artifacts/game-host-overhead.png',fullPage:true});await pages[1].screenshot({path:'artifacts/game-guest-standard.png',fullPage:true});
  expect(final.every((e:{intent:object})=>!['dice','positions','claims','winner'].some(k=>k in e.intent))).toBe(true);expect(errors).toEqual([]);
 }finally{await Promise.all(clients.map(client=>client.close()));}
});

test('a phone creates a table with a companion and restores personal settings',async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true}),page=await context.newPage();
 try{
  await page.goto('/');await page.getByLabel('Your name').fill('Ari');await page.getByRole('button',{name:'New table',exact:true}).click();await page.getByRole('button',{name:'Add companion'}).click();await nextGameSeed(page,'00000000-0000-4000-8000-000000000001');await page.getByRole('button',{name:'Start game'}).click();await settled(page);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
  await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByLabel('Animation speed',{exact:true}).selectOption('blazing');await page.getByRole('button',{name:'Back to the table'}).click();await expect(page.locator('.table-view')).toHaveAttribute('data-phase','choose');await clickFirstPairing(page);await settled(page);await expect(page.getByRole('button',{name:'Stop and save',exact:true})).toBeEnabled();await clickMesh(page,'ROLL AGAIN');await settled(page);await page.screenshot({path:'artifacts/game-phone.png'});
  await page.reload();await settled(page);await page.getByRole('button',{name:'Settings',exact:true}).click();await expect(page.getByLabel('Animation speed',{exact:true})).toHaveValue('blazing');
 }finally{await context.close();}
});

test('a downloaded intent log opens as a read-only, seekable game',async({page})=>{
 const {apply,initialState}=await import('../src/game/engine');let current=initialState(1);const log:import('../src/game/engine').Event[]=[];
 const add=(actor:string,intent:import('../src/game/engine').Intent)=>{log.push({version:1,id:`import-${log.length+1}`,sequence:log.length+1,actor,intent});current=apply(current,actor,intent);};
 add('alex',{type:'create',name:'Alex'});add('sam',{type:'join',name:'Sam'});add('alex',{type:'begin',seed:'read-only-log'});add('alex',{type:'roll'});add('alex',{type:'advance',pairing:0});add('alex',{type:'stop'});
 await page.goto('/');await page.getByLabel('Import game log',{exact:true}).setInputFiles({name:'game.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(log))});await settled(page);
 await expect(page.getByRole('dialog',{name:'Game history'})).toBeVisible();const view=page.locator('.table-view'),end=await view.getAttribute('data-pieces');
 await page.getByRole('slider',{name:'Replay action',exact:true}).fill('3');await expect.poll(()=>view.getAttribute('data-pieces')).not.toBe(end);
 await page.getByRole('slider',{name:'Replay action',exact:true}).fill('6');await expect(view).toHaveAttribute('data-pieces',end!);await page.getByLabel('Close history',{exact:true}).click();
 await expect(page.getByText('Game log · read only',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Roll dice',exact:true})).toBeDisabled();
});

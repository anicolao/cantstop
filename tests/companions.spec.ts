import {test,expect,type APIRequestContext} from '@playwright/test';
import {readEvents,settled,clickMesh,clickFirstPairing,nextGameSeed} from './helpers/game';
import {COMPANION_GAMES} from './helpers/companion-games';
import {replay,type Player} from '../src/game/engine';
// Native software-rendered transitions can each take 10–20 seconds in CI.
test.setTimeout(600000);
async function companionTurn(request:APIRequestContext,room:string,before:number,players:Player[],game:typeof COMPANION_GAMES[keyof typeof COMPANION_GAMES]){
 for(const [i,action] of game.actions.entries()){
  const sequence=before+i+1;
  // A progress deadline catches a stuck bot without imposing one deadline on
  // an entire variable-length turn. Keep every animation fully rendered.
  await expect.poll(async()=>(await readEvents(request,room)).length,{timeout:30000,message:`Companion action ${sequence}`}).toBeGreaterThanOrEqual(sequence);
  const event=(await readEvents(request,room))[sequence-1];
  expect(event.actor).toBe(players[action.seat].id);expect(event.intent).toEqual(action.intent);
 }
 const log=await readEvents(request,room);
 expect(log).toHaveLength(before+game.actions.length);expect(replay(log).game!.active).toBe(game.nextSeat);
 return log;
}

test('companion levels on the web persist and each bot takes its own turn',async({browser,request})=>{
 const context=await browser.newContext({viewport:{width:1180,height:820}}),page=await context.newPage(),errors:string[]=[];
 await context.addInitScript(()=>localStorage.setItem('cantstop:settings:v1',JSON.stringify({view:'standard',animationSpeed:'blazing'})));
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto('/');await page.getByLabel('Your name').fill('Host');await page.getByRole('button',{name:'New table',exact:true}).click();
  const level=page.getByLabel('Companion level',{exact:true});await expect(level).toHaveValue('standard');
  await expect(level.locator('option')).toHaveText(['Easy','Yolo','Standard','Hard']);
  for(const value of ['easy','yolo','hard']){await level.selectOption(value);await page.getByRole('button',{name:'Add companion',exact:true}).click();await expect(page.locator('.seat-list li')).toHaveCount(['easy','yolo','hard'].indexOf(value)+2);}
  await expect(page.getByRole('button',{name:'Add companion',exact:true})).toBeDisabled();
  const room=new URL(page.url()).searchParams.get('table')!,initial=await readEvents(request,room);
  expect(replay(initial).players.map(p=>p.level)).toEqual([undefined,'easy','yolo','hard']);
  await page.reload();await expect(page.locator('.seat-list li')).toHaveCount(4);
  for(const text of ['Easy companion','Yolo companion','Hard companion'])await expect(page.locator('.seat-list')).toContainText(text);
  await nextGameSeed(page,COMPANION_GAMES.web.seed);await page.getByRole('button',{name:'Start game',exact:true}).click();await settled(page);
  expect((await readEvents(request,room))[initial.length].intent).toEqual({type:'begin',seed:COMPANION_GAMES.web.seed});
  await clickFirstPairing(page);await settled(page);await clickMesh(page,'STOP & SAVE');
  const log=await companionTurn(request,room,initial.length+3,replay(initial).players,COMPANION_GAMES.web),s=replay(log);
  for(const bot of s.players.filter(p=>p.bot))expect(log.some(e=>e.actor===bot.id&&['advance','roll','stop'].includes(e.intent.type))).toBe(true);
  expect(log.slice(initial.length+1).every(e=>!['dice','positions','claims','winner','turnRolls'].some(key=>key in e.intent))).toBe(true);
  await settled(page);await page.screenshot({path:'artifacts/companion-levels-web.png'});expect(errors).toEqual([]);
 }finally{await context.close();}
});

test('tabletop companions share colours with real local humans and resume after reload',async({browser,request})=>{
 const context=await browser.newContext({viewport:{width:1920,height:1080},hasTouch:true}),page=await context.newPage(),errors:string[]=[];
 await context.addInitScript(()=>localStorage.setItem('cantstop:settings:v1',JSON.stringify({view:'standard',animationSpeed:'blazing'})));
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto('/tt/');await settled(page);await clickMesh(page,'TAKE SOUTH LEFT SEAT',false);await clickMesh(page,'CHOOSE RUBY');await settled(page);
  await clickMesh(page,'TABLE MENU',false);await page.getByLabel('Companion level',{exact:true}).selectOption('hard');await page.getByLabel('Companion colour',{exact:true}).selectOption('1');
  await page.getByRole('button',{name:'Add companion',exact:true}).click();await expect(page.getByText('Gold · Hard companion',{exact:true})).toBeVisible();
  await expect(page.getByLabel('Companion colour').locator('option')).toHaveText(['Teal','Violet']);
  await page.getByRole('button',{name:'Back to the table',exact:true}).click();
  await clickMesh(page,'TAKE EAST SEAT',false);await expect(page.getByRole('button',{name:'Choose Gold',exact:true})).toBeDisabled();await clickMesh(page,'CHOOSE TEAL');await settled(page);
  const room=(await page.locator('.game-shell').getAttribute('data-room'))!,initial=await readEvents(request,room),players=replay(initial).players;
  expect(players.map(p=>p.bot)).toEqual([false,true,false]);expect(new Set(players.map(p=>p.id)).size).toBe(3);
  expect(initial.map(e=>e.intent.type)).toEqual(['sit','invite-bot','sit']);expect(players[1].level).toBe('hard');expect(players[1].colour).toBe(1);expect(players[1].seat).toBeUndefined();
  await nextGameSeed(page,COMPANION_GAMES.tabletop.seed);await clickMesh(page,'START GAME');await settled(page);
  expect((await readEvents(request,room))[initial.length].intent).toEqual({type:'begin',seed:COMPANION_GAMES.tabletop.seed});
  await clickFirstPairing(page);await settled(page);await clickMesh(page,'STOP & SAVE');
  await companionTurn(request,room,initial.length+3,players,COMPANION_GAMES.tabletop);
  await settled(page);await expect(page.locator('.game-shell')).toHaveAttribute('data-can-act','true');
  expect(JSON.parse((await page.locator('.table-view').getAttribute('data-tabletop-pose'))!).angle).toBeCloseTo(Math.PI/2);
  const log=await readEvents(request,room);await page.reload();await expect(page.locator('.game-shell')).toHaveAttribute('data-revision',String(log.length),{timeout:90000});await settled(page);
  expect(JSON.parse((await page.locator('.game-shell').getAttribute('data-local-players'))!)).toHaveLength(1);
  await expect(page.locator('.game-shell')).toHaveAttribute('data-can-act','true');
  await clickFirstPairing(page);await settled(page);
  const moved=await readEvents(request,room);expect(moved.at(-1)!.actor).toBe(players[2].id);
  await page.screenshot({path:'artifacts/tabletop-companion-hard.png'});expect(errors).toEqual([]);
 }finally{await context.close();}
});

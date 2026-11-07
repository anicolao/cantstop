import {test,expect,type APIRequestContext} from '@playwright/test';
import {code,settled,readEvents,clickMesh} from './helpers/game';
import {replay} from '../src/game/engine';
test.setTimeout(600000);
const namespace='demo-dicetower-e2e-default-rtdb';
async function input(request:APIRequestContext,path:string,value:unknown){const response=await request.put(`http://127.0.0.1:9013/${path}.json?ns=${namespace}`,{headers:{Authorization:'Bearer owner'},data:value});expect(response.ok(),await response.text()).toBe(true);}
async function tower(request:APIRequestContext,id:string){await input(request,`towers/${id}`,{schemaVersion:1,name:'Test tray',sharing:true,createdAt:Date.now(),updatedAt:Date.now()});}
async function publish(request:APIRequestContext,id:string,eventId:string,rollId:string,dice:number[],kind='roll'){
 await tower(request,id); // A sharing tower sends a heartbeat while the browser renders.
 await input(request,`rolls/${id}/${eventId}`,{schemaVersion:1,eventId,rollId,kind,capturedAt:Date.now(),receivedAt:Date.now(),modelSHA256:'a'.repeat(64),experimental:true,count:dice.length,total:dice.reduce((a,b)=>a+b,0),dice:dice.map(value=>({value,confidence:.95,box:{x:.1,y:.1,width:.1,height:.1}})),thumbnail:'data:image/jpeg;base64,AA=='});
}
test('tower input on the web resets dice, auto-selects equivalent moves, corrects and replays physical rolls',async({browser,request},info)=>{
 const clients=await Promise.all([0,1].map(()=>browser.browserType().launch({...info.project.use.launchOptions,channel:'chromium'})));
 const room=code(),id=`tower-${room}`,hostContext=await clients[0].newContext({viewport:{width:1180,height:820}}),guestContext=await clients[1].newContext({viewport:{width:1180,height:820}});
 await hostContext.addInitScript(()=>{if(location.protocol.startsWith('http'))localStorage.setItem('cantstop:settings:v1',JSON.stringify({view:'standard',animationSpeed:'blazing'}));});
 const host=await hostContext.newPage(),guest=await guestContext.newPage(),errors:string[]=[];host.on('pageerror',e=>errors.push(e.message));
 try{
  await tower(request,id);await publish(request,id,'history','history',[6,6,6,6]);
  await host.goto(`/?launch=create&table=${room}&name=Host`);await expect(host.getByRole('button',{name:'Start game',exact:true})).toBeVisible({timeout:30000});await guest.goto(`/?launch=join&table=${room}&name=Guest`);await expect(host.locator('.seat-list li')).toHaveCount(2,{timeout:15000});
  await host.getByRole('button',{name:'Settings',exact:true}).click();const picker=host.getByLabel('Dice source',{exact:true});await expect(picker.locator(`option[value="${id}"]`)).toBeAttached();await picker.selectOption(id);await host.getByRole('button',{name:'Back to the table',exact:true}).click();
  await expect.poll(async()=>replay(await readEvents(request,room)).players[0]?.tower).toBe(id);
  await host.getByRole('button',{name:'Start game',exact:true}).click();await settled(host);
  let state=replay(await readEvents(request,room));expect(state.game!.phase).toBe('ready');expect(state.game!.rollIndex).toBe(0);expect(state.towerEvents).toHaveLength(0);
  await expect(host.locator('.game-shell')).toHaveAttribute('data-tower-status',/Ready/,{timeout:30000});
  await publish(request,id,'first','throw-1',[3,1,3,3]);
  await expect.poll(async()=>replay(await readEvents(request,room)).game!.runners,{timeout:30000}).toEqual({4:1,6:1});await settled(host);
  await expect(host.getByRole('button',{name:'Roll in tower',exact:true})).toBeDisabled();
  await publish(request,id,'corrected','throw-1',[2,2,2,2],'recognitionChanged');
  await expect.poll(async()=>replay(await readEvents(request,room)).game!.runners,{timeout:30000}).toEqual({4:2});await settled(host);
  await publish(request,id,'next','throw-2',[2,2,2,2]);
  await expect.poll(async()=>replay(await readEvents(request,room)).game!.runners,{timeout:30000}).toEqual({4:4});await settled(host);
  const log=await readEvents(request,room);state=replay(log);expect(state.turnRolls).toBe(2);expect(log.filter(e=>e.intent.type==='tower-roll')).toHaveLength(3);expect(log.filter(e=>e.intent.type==='roll')).toHaveLength(0);
  await host.reload();await expect(host.locator('.game-shell')).toHaveAttribute('data-revision',String(log.length),{timeout:90000});await settled(host);expect(await readEvents(request,room)).toEqual(log);
  await clickMesh(host,'STOP & SAVE');await expect.poll(async()=>replay(await readEvents(request,room)).game!.active,{timeout:30000}).toBe(1);await settled(guest);
  const after=await readEvents(request,room);await publish(request,id,'other-turn','other-turn',[1,1,1,1]);await guest.getByRole('button',{name:'Settings',exact:true}).click();expect((await readEvents(request,room)).filter(e=>e.intent.type==='tower-roll')).toHaveLength(3);
  expect(replay(after).players[1].tower).toBeUndefined();expect(errors).toEqual([]);
  await host.screenshot({path:'artifacts/tower-web.png'});
 }finally{await Promise.all(clients.map(c=>c.close()));}
});

test('tabletop tower settings apply to local humans and physical turns stay under separate identities',async({browser,request})=>{
 const id=`table-${code()}`,context=await browser.newContext({viewport:{width:1920,height:1080},hasTouch:true}),page=await context.newPage();
 await context.addInitScript(()=>{if(location.protocol.startsWith('http'))localStorage.setItem('cantstop:settings:v1',JSON.stringify({view:'standard',animationSpeed:'blazing'}));});
 try{
  await tower(request,id);await page.goto('/tt/');await settled(page);await clickMesh(page,'TAKE SOUTH LEFT SEAT',false);await clickMesh(page,'CHOOSE RUBY');await settled(page);
  await clickMesh(page,'TAKE EAST SEAT',false);await clickMesh(page,'CHOOSE TEAL');await settled(page);
  const room=(await page.locator('.game-shell').getAttribute('data-room'))!;
  await clickMesh(page,'TABLE MENU',false);const picker=page.getByLabel('Dice source',{exact:true});await expect(picker.locator(`option[value="${id}"]`)).toBeAttached();await picker.selectOption(id);await page.getByRole('button',{name:'Back to the table',exact:true}).click();
  await expect.poll(async()=>replay(await readEvents(request,room)).players.every(p=>p.tower===id)).toBe(true);
  await clickMesh(page,'START GAME');await settled(page);expect(replay(await readEvents(request,room)).game!.phase).toBe('ready');
  await expect(page.locator('.game-shell')).toHaveAttribute('data-tower-status',/Ready/,{timeout:30000});
  await publish(request,id,'first','first',[3,1,3,3]);await expect.poll(async()=>replay(await readEvents(request,room)).game!.phase,{timeout:30000}).toBe('decide');await settled(page);
  await clickMesh(page,'STOP & SAVE');await settled(page);const initial=replay(await readEvents(request,room));expect(initial.game!.active).toBe(1);expect(initial.game!.phase).toBe('ready');
  await publish(request,id,'second','second',[3,1,3,3]);await expect.poll(async()=>replay(await readEvents(request,room)).game!.phase,{timeout:30000}).toBe('decide');await settled(page);
  const log=await readEvents(request,room),players=replay(log).players,rolls=log.filter(e=>e.intent.type==='tower-roll');expect(rolls.map(e=>e.actor)).toEqual(players.map(p=>p.id));expect(new Set(players.map(p=>p.id)).size).toBe(2);
  await expect(page.getByRole('button',{name:'Roll in tower',exact:true})).toBeDisabled();await page.screenshot({path:'artifacts/tabletop-tower.png'});
 }finally{await context.close();}
});

import type {Event} from '../../src/game/engine';
import {expect,type Page,type APIRequestContext} from '@playwright/test';
function decode(value:Record<string,any>):any{
 if('mapValue' in value)return Object.fromEntries(Object.entries(value.mapValue.fields??{}).map(([key,item])=>[key,decode(item as Record<string,any>)]));
 if('arrayValue' in value)return (value.arrayValue.values??[]).map(decode);
 if('integerValue' in value)return Number(value.integerValue);
 if('nullValue' in value)return null;
 return value.stringValue??value.booleanValue??value.doubleValue;
}
export async function readEvents(request:APIRequestContext,room:string):Promise<Event[]>{
 const response=await request.get(`http://127.0.0.1:8213/v1/projects/demo-cantstop-e2e/databases/(default)/documents/previews/e2e/tables/${room}/events?pageSize=1000`,{headers:{Authorization:'Bearer owner'}});
 expect(response.ok()).toBe(true);
 const data=await response.json();return (data.documents??[]).map((doc:{fields:Record<string,any>})=>decode({mapValue:{fields:doc.fields}})).sort((a:{sequence:number},b:{sequence:number})=>a.sequence-b.sequence);
}
export const code=()=>Math.random().toString(16).slice(2,10).toUpperCase().padEnd(8,'A');
export async function settled(page:Page){await page.bringToFront();await expect(page.locator('[data-ready]')).toHaveAttribute('data-ready','true',{timeout:90000});await expect(page.locator('.game-shell')).toHaveAttribute('data-moving','false',{timeout:30000});await expect(page.locator('.table-view')).not.toHaveAttribute('data-tabletop-turning','true',{timeout:30000});await page.waitForFunction(()=>document.fonts.status==='loaded'&&document.querySelector('[data-ready]')?.getAttribute('data-ready')==='true'&&document.querySelector('.game-shell')?.getAttribute('data-moving')==='false');}
export async function clickMesh(page:Page,name:string,commits=true,occurrence=0){
 await settled(page);await expect(page.locator('.game-shell')).toHaveAttribute('data-can-act','true');const view=page.locator('.table-view');
 await expect.poll(async()=>JSON.parse((await view.getAttribute('data-targets'))??'[]').some((t:{name:string})=>t.name===name)).toBe(true);
 const revision=Number(await page.locator('.game-shell').getAttribute('data-revision'));const target=JSON.parse((await view.getAttribute('data-targets'))!).filter((t:{name:string})=>t.name===name)[occurrence],box=(await view.boundingBox())!;await page.mouse.click(box.x+target.x,box.y+target.y);if(commits)await expect.poll(async()=>Number(await page.locator('.game-shell').getAttribute('data-revision')),{timeout:30000}).toBeGreaterThan(revision);
}
/** Wait for the native controls to finish updating after a dialog or renderer mounts. */
export async function clickFirstPairing(page:Page){
 await settled(page);let name:string|undefined;
 await expect.poll(async()=>{
  const view=page.locator('.table-view');
  if(await view.getAttribute('data-phase')==='decide')return true; // A forced equivalent move was already chosen.
  name=JSON.parse(await view.getAttribute('data-targets')??'[]').find((t:{name:string})=>/^\d+ \+ \d+$/.test(t.name))?.name;
  return !!name;
 }).toBe(true);
 if(await page.locator('.table-view').getAttribute('data-phase')!=='decide')await clickMesh(page,name!);
}

/** Control only the next begin intent's entropy; command IDs and Auth stay random. */
export async function nextGameSeed(page:Page,seed:string){
 await page.evaluate(seed=>{
  const original=crypto.randomUUID.bind(crypto);
  crypto.randomUUID=()=>{crypto.randomUUID=original;return seed as ReturnType<Crypto['randomUUID']>;};
 },seed);
}

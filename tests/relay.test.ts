import {test,expect} from 'bun:test';
import {createRelay} from '../server/relay';
import {replay} from '../src/game/engine';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
test('the persistent relay serializes intents, reconciles retries, and rejects stale/altered writes',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'cantstop-')),path=join(dir,'events.sqlite');
 let relay=createRelay(path,0);let url=`http://127.0.0.1:${relay.server.port}/api/tables/TESTA`;
 const post=(body:unknown)=>fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 try{
  const create={id:'one',actor:'p0',expectedRevision:0,intent:{type:'create',name:'Alex'}};
  expect((await post(create)).status).toBe(200);expect((await post(create)).status).toBe(200);expect(relay.read('TESTA').length).toBe(1);
  expect((await post({...create,intent:{type:'create',name:'Changed'}})).status).toBe(409);
  const writes=await Promise.all([post({id:'two',actor:'p1',expectedRevision:1,intent:{type:'join',name:'Rowan'}}),post({id:'three',actor:'p2',expectedRevision:1,intent:{type:'join',name:'Jules'}})]);
  expect(writes.map(r=>r.status).sort()).toEqual([200,409]);
  expect((await post({id:'bad',actor:'p0',expectedRevision:2,intent:{type:'begin',seed:'x',score:121}})).status).toBe(409);
  const saved=relay.read('TESTA');relay.close();relay=createRelay(path,0);url=`http://127.0.0.1:${relay.server.port}/api/tables/TESTA`;
  expect(await (await fetch(url)).json()).toEqual(saved);expect(replay(saved).players.length).toBe(2);
 }finally{relay.close();rmSync(dir,{recursive:true,force:true});}
});

import {beforeAll,afterAll,test,expect} from 'bun:test';
import {initializeTestEnvironment,assertFails,type RulesTestEnvironment} from '@firebase/rules-unit-testing';
import {readFileSync} from 'node:fs';
import {doc,getDoc,getDocs,collection,writeBatch,setDoc,deleteDoc,type Firestore} from 'firebase/firestore';
import {appendFirestore,tableRef,watchFirestore} from '../../src/game/firestore';
import {apply,replay,initialState,type Event,type Intent} from '../../src/game/engine';
let env:RulesTestEnvironment;
beforeAll(async()=>{if(!process.env.FIRESTORE_EMULATOR_HOST)throw new Error('Run with the Firestore emulator.');env=await initializeTestEnvironment({projectId:'demo-cantstop',firestore:{host:'127.0.0.1',port:8211,rules:readFileSync('firestore.rules','utf8')}});});
afterAll(async()=>{await env?.cleanup();});
const db=(uid:string)=>env.authenticatedContext(uid).firestore() as unknown as Firestore;
async function until(check:()=>boolean){const end=Date.now()+8000;while(!check()){if(Date.now()>end)throw new Error('Observer did not receive the action.');await Bun.sleep(10);}}
test('four authenticated clients share committed choices and replay after a turn',async()=>{
 const clients=[0,1,2,3].map(i=>db(`p${i}`)),views:Event[][]=[[],[],[],[]];let current=initialState();
 const stops=clients.map((client,i)=>watchFirestore(client,'test','FIRE1',events=>views[i]=events,()=>{}));
 async function act(seat:number,intent:Intent){await appendFirestore(clients[seat],'test','FIRE1',`p${seat}`,{id:`action-${current.revision+1}`,actor:`p${seat}`,expectedRevision:current.revision,intent},views[seat]);current=apply(current,`p${seat}`,intent);await until(()=>views.every(v=>v.length===current.revision));for(const log of views)expect(replay(log)).toEqual(current);}
 try{
  await act(0,{type:'create',name:'Sam'});for(let i=1;i<4;i++)await act(i,{type:'join',name:`Friend ${i}`});
  await act(0,{type:'begin',seed:'cloud-choice-log'});expect(current.game!.phase).toBe('choose');
  const {pairings}=await import('../../src/lib/model/game');const p=pairings(current.game!).find(p=>p.variants.length)!;
  await act(0,{type:'advance',pairing:p.index,...(p.variants.length>1?{column:p.variants[0].column}: {})});await act(0,{type:'stop'});expect(current.game!.active).toBe(1);
  const pending={id:'action-7',actor:'p0',expectedRevision:6,intent:{type:'stop'} as Intent};await appendFirestore(clients[0],'test','FIRE1','p0',pending);
  expect((await getDocs(collection(tableRef(clients[0],'test','FIRE1'),'events'))).size).toBe(7);
  await expect(appendFirestore(clients[0],'test','FIRE1','p0',{...pending,intent:{type:'roll'}})).rejects.toThrow('already been used');
 }finally{stops.forEach(stop=>stop());}
},30000);
test('rules reject altered history, computed outcomes, and impersonation',async()=>{
 const owner=db('owner'),root=tableRef(owner,'rules','RULE1');await appendFirestore(owner,'rules','RULE1','owner',{id:'create',actor:'owner',expectedRevision:0,intent:{type:'create',name:'Owner'}});
 await assertFails(getDoc(tableRef(env.unauthenticatedContext().firestore() as unknown as Firestore,'rules','RULE1')));
 await assertFails(deleteDoc(doc(root,'events','1')));await assertFails(setDoc(doc(root,'events','1'),{version:1,id:'replace',sequence:1,actor:'owner',intent:{type:'roll'}}));
 async function forged(actor:string,intent:unknown,client=owner){const target=tableRef(client,'rules','RULE1'),batch=writeBatch(client);batch.set(target,{owner:'owner',members:['owner'],bots:[],revision:2});batch.set(doc(target,'events','2'),{version:1,id:'forged',sequence:2,actor,intent});batch.set(doc(target,'commands','forged'),{sequence:2});await assertFails(batch.commit());}
 await forged('owner',{type:'roll',dice:[1,2,3,4]});await forged('owner',{type:'begin',seed:'x',winner:'owner'});await forged('owner',{type:'roll'},db('stranger'));await forged('bot-not-invited',{type:'roll'});
 expect((await getDoc(root)).data()?.revision).toBe(1);
});
test('concurrent joins serialize and separate preview namespaces do not share a log',async()=>{
 const owner=db('captain'),a=db('join-a'),b=db('join-b');await appendFirestore(owner,'one','RACE1','captain',{id:'create',actor:'captain',expectedRevision:0,intent:{type:'create',name:'Host'}});
 const race=await Promise.allSettled([appendFirestore(a,'one','RACE1','join-a',{id:'a',actor:'join-a',expectedRevision:1,intent:{type:'join',name:'A'}}),appendFirestore(b,'one','RACE1','join-b',{id:'b',actor:'join-b',expectedRevision:1,intent:{type:'join',name:'B'}})]);expect(race.filter(r=>r.status==='fulfilled')).toHaveLength(1);
 await appendFirestore(owner,'two','RACE1','captain',{id:'create',actor:'captain',expectedRevision:0,intent:{type:'create',name:'Other'}});expect((await getDoc(tableRef(owner,'one','RACE1'))).data()?.revision).toBe(2);expect((await getDoc(tableRef(owner,'two','RACE1'))).data()?.revision).toBe(1);
});

test('walk-up colours create a hidden table and a second seated identity can start it',async()=>{
 const first=db('walk-a'),second=db('walk-b');const pending={id:'sit-a',actor:'walk-a',expectedRevision:0,intent:{type:'sit',seat:'west',colour:2} as Intent};
 await appendFirestore(first,'walkup','WALK1','walk-a',pending);
 await appendFirestore(second,'walkup','WALK1','walk-b',{id:'sit-b',actor:'walk-b',expectedRevision:1,intent:{type:'sit',seat:'east',colour:0}});
 await appendFirestore(second,'walkup','WALK1','walk-b',{id:'begin',actor:'walk-b',expectedRevision:2,intent:{type:'begin',seed:'walk-up'}});
 const log=(await getDocs(collection(tableRef(first,'walkup','WALK1'),'events'))).docs.map(d=>d.data() as Event).sort((a,b)=>a.sequence-b.sequence);
 expect(log.map(e=>e.version)).toEqual([3,3,3]);expect(log.map(e=>e.intent.type)).toEqual(['sit','sit','begin']);expect(replay(log).game!.phase).toBe('choose');
 await assertFails(setDoc(doc(tableRef(second,'walkup','WALK1'),'events','4'),{version:2,id:'downgrade',sequence:4,actor:'walk-b',intent:{type:'roll'}}));
});

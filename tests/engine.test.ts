import {describe,test,expect} from 'bun:test';
import {apply,replay,initialState,parseIntent,chooseBot,evolve,choiceBoard,type Protocol,type Event,type State,type Intent} from '../src/game/engine';
import {apply as applyBoard,pairings,fixture,seedFor} from '../src/lib/model/game';
import {transitions} from '../src/game/presentation';
import {sample} from '../src/lib/presentation/frame';
import {normalizePreferences,DEFAULTS,RATES} from '../src/game/settings';
function table(count:number,protocol:Protocol=2){let s=apply(initialState(protocol),'p0',{type:'create',name:'Alex'});for(let i=1;i<count;i++)s=apply(s,`p${i}`,{type:'join',name:`Player ${i}`});return apply(s,'p0',{type:'begin',seed:'protocol-v1'});}
describe('intent-only complete games',()=>{
 for(const protocol of [1,2] as const)for(const count of [2,3,4])test(`v${protocol}: ${count} players finish a full game and replay every outcome from choices`,()=>{
  let current=initialState(protocol);const events:Event[]=[];
  const send=(actor:string,intent:Intent)=>{const event:Event={version:protocol,id:`event-${events.length}`,sequence:events.length+1,actor,intent};events.push(event);current=apply(current,actor,intent);};
  send('p0',{type:'create',name:'Alex'});for(let i=1;i<count;i++)send(`p${i}`,{type:'join',name:`Player ${i}`});send('p0',{type:'begin',seed:`finish-${count}`});
  for(let i=0;i<5000&&current.phase!=='finished';i++){
   const intent=chooseBot({...current,players:current.players.map(p=>({...p,bot:true}))});expect(intent).not.toBeNull();
   send(current.players[current.game!.active].id,intent!);expect(current.game!.active).toBeLessThan(count);
  }
  expect(current.phase).toBe('finished');expect(current.game!.claims.some(c=>c.length>=3)).toBe(true);
  expect(replay(JSON.parse(JSON.stringify(events)))).toEqual(current);
  for(const event of events){expect(Object.keys(event).sort()).toEqual(['actor','id','intent','sequence','version']);expect('dice'in event.intent).toBe(false);expect('winner'in event.intent).toBe(false);expect('positions'in event.intent).toBe(false);}
  const restarted=apply(current,'p0',{type:'begin',seed:'another-game'});expect(restarted.phase).toBe('playing');expect(restarted.game!.claims.flat()).toHaveLength(0);expect(restarted.game!.runners).toEqual({});
 });
 test('new games are empty boards and out-of-turn actions are rejected',()=>{
  const s=table(3);expect(s.game!.saved).toEqual([{},{},{},{}]);expect(s.game!.claims.flat()).toHaveLength(0);
  expect(()=>apply(s,'p1',{type:'roll'})).toThrow('Wait for your turn');expect(()=>apply(s,'p0',{type:'stop'})).toThrow();
 });
 test('outcomes and unexpected fields cannot enter a valid action',()=>{
  for(const value of [{type:'roll',dice:[1,2,3,4]},{type:'stop',winner:'p0'},{type:'advance',pairing:0,runners:{}},{type:'advance',pairing:9},{type:'begin',seed:''}])expect(()=>parseIntent(value)).toThrow();
 });
 test('event identities, order and protocol versions are immutable',()=>{
  const first:Event={version:1,id:'a',sequence:1,actor:'p0',intent:{type:'create',name:'Alex'}};
  for(const change of [{...first,version:4},{...first,sequence:2},{...first,dice:[1,2,3,4]}])expect(()=>replay([change as Event])).toThrow();
  expect(()=>replay([first,{...first,sequence:2}])).toThrow();
  expect(()=>replay([first,{...first,version:2,id:'b',sequence:2,actor:'p1',intent:{type:'join',name:'Other'}}])).toThrow();
 });
 test('only the host starts or adds a companion; duplicate names remain distinct identities',()=>{
  let s=apply(initialState(),'alex',{type:'create',name:'Sam'});s=apply(s,'sam',{type:'join',name:'Sam'});
  expect(s.players.map(p=>p.id)).toEqual(['alex','sam']);expect(()=>apply(s,'sam',{type:'begin',seed:'s'})).toThrow();
  expect(()=>apply(s,'sam',{type:'invite-bot',id:'bot-a',name:'Cal'})).toThrow();
 });
 test('personal camera and speed preferences are normalized separately from game actions',()=>{
  expect(normalizePreferences(null)).toEqual(DEFAULTS);expect(normalizePreferences({view:'overhead',animationSpeed:'blazing'})).toEqual({view:'overhead',animationSpeed:'blazing'});
  expect(normalizePreferences({view:'bad',animationSpeed:'bad'})).toEqual(DEFAULTS);expect(RATES).toEqual({standard:1,fast:2,blazing:4});expect(()=>parseIntent({type:'settings',animationSpeed:'fast'})).toThrow();
 });
});

describe('direct choices in protocol 2',()=>{
 test('begin and stop derive opening rolls without additional player actions',()=>{
  const start=table(2);expect(start.game!.phase).toBe('choose');expect(start.game!.rollIndex).toBe(1);expect(start.choice).toBeNull();
  const moved=apply(start,'p0',{type:'advance',pairing:0});const result=evolve(moved,'p0',{type:'stop'});
  expect(result.state.revision).toBe(moved.revision+1);expect(result.state.game!.phase).toBe('choose');expect(result.state.choice).toBeNull();
  expect(result.changes.map(c=>c.action)).toEqual(['stop','roll']);expect(result.changes[1].before.phase).toBe('ready');
  expect(result.state.game!.saved[0]).toEqual(moved.game!.runners);
 });
 test('changing a pairing replaces only this roll, including after reload and another roll',()=>{
  let current=initialState();const events:Event[]=[];
  function send(actor:string,intent:Intent){events.push({version:2,sequence:events.length+1,id:`choice-${events.length}`,actor,intent});current=apply(current,actor,intent);expect(replay(events)).toEqual(current);}
  send('p0',{type:'create',name:'Alex'});send('p1',{type:'join',name:'Sam'});send('p0',{type:'begin',seed:'protocol-v1'});
  const original=structuredClone(current.game!);send('p0',{type:'advance',pairing:0});send('p0',{type:'advance',pairing:1});
  expect(current.game).toEqual(applyBoard(original,{type:'advance',pairing:1}));expect(current.choice!.before).toEqual(original);
  send('p0',{type:'advance',pairing:2});expect(current.game).toEqual(applyBoard(original,{type:'advance',pairing:2}));
  const kept=structuredClone(current.game!.runners);send('p0',{type:'roll'});expect(current.choice).toBeNull();
  if(current.game!.active===0){const base=structuredClone(current.game!);const choices=pairings(base).filter(p=>p.variants.length===1);expect(choices.length).toBeGreaterThan(1);
   send('p0',{type:'advance',pairing:choices[0].index});send('p0',{type:'advance',pairing:choices[1].index});
   expect(current.game).toEqual(applyBoard(base,{type:'advance',pairing:choices[1].index}));for(const [column,position] of Object.entries(kept))expect(current.game!.runners[+column]).toBeGreaterThanOrEqual(position);
  }
  expect(events.filter(e=>e.intent.type==='roll')).toHaveLength(1);
 });
 test('the last pawn can change destinations without gaining an extra pawn',()=>{
  const state={...table(2),game:fixture({phase:'choose',runners:{7:7,9:3}}),choice:null};
  const first=apply(state,'p0',{type:'advance',pairing:1,column:6}),second=apply(first,'p0',{type:'advance',pairing:1,column:8});
  expect(Object.keys(second.game!.runners)).toHaveLength(3);expect(second.game!.runners[6]).toBeUndefined();expect(second.game!.runners[8]).toBe(3);
  expect(second.game).toEqual(applyBoard(state.game,{type:'advance',pairing:1,column:8}));
 });
 test('a bust derives the next opening roll, and an opening bust passes again',()=>{
  const original=fixture({phase:'decide',seed:seedFor([1,1,1,1])});
  const state={...table(3),game:original,choice:{before:{...original,phase:'choose' as const},pairing:0}};
  const result=evolve(state,'p0',{type:'roll'});
  expect(result.changes[0].after.lastOutcome).toBe('bust');expect(result.changes.length).toBeGreaterThanOrEqual(2);
  expect(result.state.game!.phase).toBe('choose');expect(result.state.choice).toBeNull();expect(result.state.revision).toBe(state.revision+1);
  // Both 2 and 12 are closed; find a seed whose first automatic throw also busts.
  let seed=1;for(;seed<100000;seed++){const test=fixture({seed,rollIndex:0,phase:'ready',runners:{},claims:[[2],[],[12],[]]});if(applyBoard(test,{type:'roll'}).lastOutcome==='bust')break;}
  const start={...state,game:fixture({seed,rollIndex:0,runners:{7:7},claims:[[2],[],[12],[]]})};
  const passed=evolve(start,'p0',{type:'stop'});expect(passed.changes[1].after.lastOutcome).toBe('bust');expect(passed.changes.length).toBeGreaterThan(2);expect(passed.state.game!.phase).toBe('choose');
 });
 test('replacement motion preserves exactly three pawns and settles identically when reduced',()=>{
  const start=table(2),first=apply(start,'p0',{type:'advance',pairing:0});const event:Event={version:2,sequence:first.revision+1,id:'replacement',actor:'p0',intent:{type:'advance',pairing:1}};
  const [motion]=transitions(first,event);expect(motion.kind).toBe('replace');
  for(const t of [0,.5,1,1.5])expect(sample(motion,t).pieces.filter(p=>p.runner)).toHaveLength(3);
  expect(sample(motion,motion.duration)).toEqual(sample(motion,0,true));expect(choiceBoard(first)).toEqual(start.game);
 });
});

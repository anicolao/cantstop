import {describe,test,expect} from 'bun:test';
import {apply,replay,initialState,parseIntent,chooseBot,type Event,type State,type Intent} from '../src/game/engine';
import {normalizePreferences,DEFAULTS,RATES} from '../src/game/settings';
function table(count:number){let s=apply(initialState(),'p0',{type:'create',name:'Alex'});for(let i=1;i<count;i++)s=apply(s,`p${i}`,{type:'join',name:`Player ${i}`});return apply(s,'p0',{type:'begin',seed:'protocol-v1'});}
describe('intent-only complete games',()=>{
 for(const count of [2,3,4])test(`${count} players finish a full game and replay every outcome from choices`,()=>{
  let current=initialState();const events:Event[]=[];
  const send=(actor:string,intent:Intent)=>{const event:Event={version:1,id:`event-${events.length}`,sequence:events.length+1,actor,intent};events.push(event);current=apply(current,actor,intent);};
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
  for(const change of [{...first,version:2},{...first,sequence:2},{...first,dice:[1,2,3,4]}])expect(()=>replay([change as Event])).toThrow();
  expect(()=>replay([first,{...first,sequence:2}])).toThrow();
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

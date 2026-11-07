import {describe,test,expect} from 'bun:test';
import {BOT_LEVELS,chooseCompanion} from '../src/game/companion';
import {apply,chooseBot,initialState,replay,parseIntent,type Event,type Intent} from '../src/game/engine';
import {fixture,pairings} from '../src/lib/model/game';
import {choose,policies} from '../scripts/ai-comparison/policies';

describe('companion levels',()=>{
 test('selected personalities match the calibrated research policies',()=>{
  const mapping={easy:'easy',yolo:'yolo-035',standard:'balanced',hard:'board-80-risk2'};
  for(let n=0;n<18;n++)for(const {id} of BOT_LEVELS){
   const g=fixture({active:0,phase:'decide',saved:[{4:n%3,7:n%6},{4:(n+1)%5,7:(n+2)%8},{},{}],claims:[[],[],[],[]],runners:{4:n%3+1,7:n%6+2,8:n%4+1},rollIndex:2+n%3});
   const reference=policies.find(p=>p.name===mapping[id])!;
   expect(chooseCompanion(g,id,g.rollIndex)).toEqual(choose(g,reference));
   g.phase='choose';expect(chooseCompanion(g,id,g.rollIndex)).toEqual(choose(g,reference));
  }
 });
 test('choices cannot see future seeded dice and never risk a bankable win',()=>{
  for(const {id} of BOT_LEVELS){
   const g=fixture({phase:'choose',active:0,claims:[[],[],[],[]]});
   expect(chooseCompanion(g,id,2)).toEqual(chooseCompanion({...g,seed:12345,rollIndex:900},id,2));
   expect(chooseCompanion(fixture({claims:[[2,12],[],[],[]],runners:{7:13}}),id,1)).toEqual({type:'stop'});
  }
 });
 test('new levels validate strictly and legacy protocol 1 remains classic',()=>{
  let s=apply(initialState(1),'host',{type:'create',name:'Host'});
  expect(()=>apply(s,'host',{type:'invite-bot',id:'bot-a',name:'Bea',level:'hard'})).toThrow('classic');
  s=apply(s,'host',{type:'invite-bot',id:'bot-a',name:'Bea'});
  expect(s.players[1].level).toBeUndefined();
  for(const level of ['expert','tutorial','STANDARD',null,5])expect(()=>parseIntent({type:'invite-bot',id:'bot-b',name:'Cal',level})).toThrow();
  expect(()=>parseIntent({type:'invite-bot',id:'bot-b',name:'Cal',level:'hard',bonus:80})).toThrow();
 });
 test('turn roll count is derived across replacements, extra rolls, banking, and replay',()=>{
  let state=initialState();const log:Event[]=[];
  const send=(actor:string,intent:Intent)=>{state=apply(state,actor,intent);log.push({version:2,sequence:log.length+1,id:`count-${log.length}`,actor,intent});};
  send('host',{type:'create',name:'Host'});send('host',{type:'invite-bot',id:'bot-a',name:'Bea',level:'standard'});send('host',{type:'begin',seed:'protocol-v1'});
  expect(state.turnRolls).toBe(1);
  send('host',{type:'advance',pairing:0});send('host',{type:'advance',pairing:1});expect(state.turnRolls).toBe(1);
  send('host',{type:'roll'});expect(state.turnRolls).toBe(state.game!.active===0?2:1);
  if(state.game!.active===0){const p=pairings(state.game!).find(p=>p.variants.length)!;send('host',{type:'advance',pairing:p.index,...(p.variants.length>1?{column:p.variants[0].column}:{})});send('host',{type:'stop'});}
  expect(state.turnRolls).toBe(1);expect(replay(log)).toEqual(state);
  expect(log.some(e=>'turnRolls' in e.intent)).toBe(false);
 });
 for(const count of [2,3,4])test(`${count} mixed-level players finish and replay using ordinary actions`,()=>{
  let state=initialState();const events:Event[]=[];
  const send=(actor:string,intent:Intent)=>{state=apply(state,actor,intent);events.push({version:2,sequence:events.length+1,id:`levels-${events.length}`,actor,intent});};
  send('host',{type:'create',name:'Host'});
  for(let i=1;i<count;i++)send('host',{type:'invite-bot',id:`bot-${i}`,name:`Bot ${i}`,level:BOT_LEVELS[i].id});
  send('host',{type:'begin',seed:`mixed-levels-${count}`});
  for(let i=0;i<2500&&state.phase!=='finished';i++){
   // Test driver makes the human use Easy; real callers still require their UID.
   const simulated={...state,players:state.players.map(p=>p.id==='host'?{...p,bot:true,level:'easy' as const}:p)};
   const intent=chooseBot(simulated);expect(intent).not.toBeNull();send(state.players[state.game!.active].id,intent!);
  }
  expect(state.phase).toBe('finished');expect(replay(events)).toEqual(state);
  expect(events.filter(e=>['roll','advance','stop'].includes(e.intent.type)).every(e=>Object.keys(e.intent).every(k=>['type','pairing','column'].includes(k)))).toBe(true);
 },10000);
 test('tabletop companions reserve a colour without a human identity or physical-seat event',()=>{
  let state=apply(initialState(3),'host',{type:'sit',seat:'west',colour:2});
  const invitation={type:'invite-bot',id:'bot-hard',name:'Gold',level:'hard',colour:1} as const;
  expect(()=>apply(state,'stranger',invitation)).toThrow();
  expect(()=>apply(state,'host',{...invitation,colour:2})).toThrow('colour');
  expect(()=>apply(state,'host',{type:'invite-bot',id:'bot-no-colour',name:'Bea',level:'easy'})).toThrow('colour');
  state=apply(state,'host',invitation);expect(state.players[1]).toEqual({id:'bot-hard',name:'Gold',bot:true,level:'hard',colour:1});
  expect(state.players[1].seat).toBeUndefined();
  state=apply(state,'remote',{type:'sit',seat:'east',colour:0});state=apply(state,'remote',{type:'begin',seed:'remote-owner'});
  expect(chooseBot(state)).toBeNull();expect(()=>apply(state,'bot-hard',{type:'advance',pairing:0})).toThrow('Wait for your turn');
 });
});

for(const mode of ['web','tabletop'] as const)test(`${mode} browser fixture exercises the expected real bot choices`,async()=>{
 const {COMPANION_GAMES}=await import('./helpers/companion-games');const game=COMPANION_GAMES[mode];
 let state=initialState();
 if(mode==='web'){
  state=apply(state,'host',{type:'create',name:'Host'});
  for(const [i,level] of ['easy','yolo','hard'].entries())state=apply(state,'host',{type:'invite-bot',id:`bot-${i}`,name:level,level:level as 'easy'|'yolo'|'hard'});
 }else{
  state=apply(state,'host',{type:'sit',seat:'south-left',colour:2});state=apply(state,'host',{type:'invite-bot',id:'bot-hard',name:'Gold',level:'hard',colour:1});state=apply(state,'human2',{type:'sit',seat:'east',colour:0});
 }
 state=apply(state,'host',{type:'begin',seed:game.seed});state=apply(state,'host',{type:'advance',pairing:0});state=apply(state,'host',{type:'stop'});
 for(const action of game.actions){
  expect(state.game!.active).toBe(action.seat);const intent=chooseBot(state);expect(intent).toEqual(action.intent);
  state=apply(state,state.players[action.seat].id,intent!);
 }
 expect(state.game!.active).toBe(game.nextSeat);expect(chooseBot(state)).toBeNull();
});

test('the long Hard turn from the CI trace finishes legally and passes to the local human',()=>{
 let state=apply(initialState(3),'host',{type:'sit',seat:'south-left',colour:2});
 state=apply(state,'host',{type:'invite-bot',id:'bot-hard',name:'Gold',level:'hard',colour:1});state=apply(state,'human2',{type:'sit',seat:'east',colour:0});
 state=apply(state,'host',{type:'begin',seed:'1eb94ab4-484a-45c4-8b81-241f7f68359e'});
 state=apply(state,'host',{type:'advance',pairing:0});state=apply(state,'host',{type:'stop'});
 let actions=0,maxRolls=0;
 while(state.game!.active===1&&actions<70){
  maxRolls=Math.max(maxRolls,state.turnRolls);const intent=chooseBot(state);expect(intent).not.toBeNull();state=apply(state,'bot-hard',intent!);actions++;
 }
 expect(actions).toBe(24);expect(maxRolls).toBe(12);expect(state.game!.active).toBe(2);expect(chooseBot(state)).toBeNull();
});

import {test,expect} from 'bun:test';
import {automaticMove} from '../src/game/automatic-move';
import {apply,replay,initialState,parseIntent,evolve,type Event,type Intent} from '../src/game/engine';
import {equivalentMove,fixture,pairings} from '../src/lib/model/game';
import {sample} from '../src/lib/presentation/frame';
import {transitions,frameFor} from '../src/game/presentation';
import {activeTowers,towerRoll,RollCursor} from '../src/game/towers/model';
const empty=()=>fixture({phase:'choose',active:0,saved:[{},{},{},{}],runners:{},claims:[[],[],[],[]]});
test('auto-selection compares legal resulting advances, including reversed sums and capped doubles',()=>{
 const reversed={...empty(),dice:[3,1,3,3]};expect(pairings(reversed).map(p=>p.sums)).toEqual([[4,6],[6,4],[6,4]]);expect(equivalentMove(reversed)).toEqual({type:'advance',pairing:0});
 expect(equivalentMove({...empty(),dice:[1,1,1,1],runners:{2:2}})).toEqual({type:'advance',pairing:0});
 expect(pairings({...empty(),dice:[1,1,1,1],runners:{2:2}})[0].variants[0].moves).toEqual({2:1});
 expect(equivalentMove({...empty(),dice:[1,2,5,6]})).toBeNull();
 expect(equivalentMove(fixture({phase:'choose',runners:{7:7,9:3}}))).toBeNull();
 const forced={...empty(),dice:[1,2,3,4],runners:{4:2,6:2,8:2},claims:[[3],[7],[],[]]};expect(equivalentMove(forced)).toEqual({type:'advance',pairing:1});
});
function table(protocol:2|3=2){
 let state=initialState(protocol);const log:Event[]=[];
 const send=(actor:string,intent:Intent)=>{const before=state;state=apply(state,actor,intent);const event={version:protocol,sequence:log.length+1,id:`input-${log.length}`,actor,intent};log.push(event);return {before,event};};
 send('p0',protocol===3?{type:'sit',seat:'west',colour:2}:{type:'create',name:'Host'});send('p1',protocol===3?{type:'sit',seat:'east',colour:0}:{type:'join',name:'Guest'});
 send('p0',{type:'dice-source',tower:'tower-a'});send('p1',{type:'dice-source',tower:'tower-a'});send('p0',{type:'begin',seed:'real-dice'});
 return {send,log,get state(){return state;}};
}
const roll=(eventId:string,rollId:string,dice=[3,1,3,3]):Intent=>({type:'tower-roll',tower:'tower-a',eventId,rollId,dice});
for(const protocol of [2,3] as const)test(`v${protocol}: physical turns wait, replace corrected choices, retain earlier progress, and replay offline`,()=>{
 const t=table(protocol);expect(t.state.game!.phase).toBe('ready');expect(t.state.game!.rollIndex).toBe(0);expect(frameFor(t.state,null,0)!.dice).toEqual([]);
 expect(()=>apply(t.state,'p0',{type:'roll'})).toThrow('selected dice tower');
 const first=t.send('p0',roll('event-1','roll-1'));expect(t.state.game!.dice).toEqual([3,1,3,3]);expect(t.state.turnRolls).toBe(1);
 const motion=transitions(first.before,first.event)[0];for(const time of [0,motion.duration])expect(sample(motion,time).diceProgress).toBe(1);
 t.send('p0',{type:'advance',pairing:0});expect(t.state.game!.runners).toEqual({4:1,6:1});
 t.send('p0',roll('event-2','roll-2',[1,2,5,6]));t.send('p0',{type:'advance',pairing:2});expect(t.state.game!.runners).toEqual({4:1,6:1,7:2});
 t.send('p0',roll('event-3','roll-2',[2,2,2,2]));expect(t.state.game!.runners).toEqual({4:1,6:1});expect(t.state.turnRolls).toBe(2);expect(t.state.game!.rollIndex).toBe(2);expect(t.state.choice).toBeNull();
 t.send('p0',{type:'advance',pairing:0});expect(t.state.game!.runners).toEqual({4:3,6:1});
 t.send('p0',{type:'stop'});expect(t.state.game!.active).toBe(1);expect(t.state.game!.phase).toBe('ready');expect(t.state.game!.saved[0]).toEqual({4:3,6:1});
 expect(()=>apply(t.state,'p1',roll('event-4','roll-2'))).toThrow('already ended');
 expect(replay(JSON.parse(JSON.stringify(t.log)))).toEqual(t.state);
 expect(t.log.filter(e=>e.intent.type==='roll')).toHaveLength(0);
});
test('physical input validates attribution, duplicates, dice, and frozen protocol 1',()=>{
 const t=table();expect(()=>apply(t.state,'p1',roll('bad','first'))).toThrow('your turn');
 t.send('p0',roll('event-a','first'));expect(()=>apply(t.state,'p0',roll('event-a','first'))).toThrow('already been accepted');
 for(const dice of [[1,2,3],[0,2,3,4],[7,2,3,4],[1.5,2,3,4]])expect(()=>parseIntent(roll('x','y',dice))).toThrow();
 expect(()=>parseIntent({...roll('x','y'),positions:{4:2}})).toThrow();
 const old=apply(initialState(1),'p0',{type:'create',name:'Host'});expect(()=>apply(old,'p0',{type:'dice-source',tower:'tower-a'})).toThrow();
});
test('switching back to digital resumes automatic throws; input preferences never control a remote seat',()=>{
 const t=table();expect(()=>apply(t.state,'stranger',{type:'dice-source',tower:'tower-a'})).toThrow();
 t.send('p0',{type:'dice-source',tower:null});expect(t.state.game!.phase).toBe('choose');expect(t.state.players[1].tower).toBe('tower-a');
});
test('a physical bust passes to the next tower-controlled human without inventing a roll',()=>{
 const t=table();t.send('p0',roll('one','one'));t.send('p0',{type:'advance',pairing:0});
 t.send('p0',roll('two','two',[3,3,3,3]));t.send('p0',{type:'advance',pairing:0});
 t.send('p0',roll('three','three',[1,1,3,3]));t.send('p0',{type:'advance',pairing:0}); // three active columns: 2,4,6
 const result=evolve(t.state,'p0',roll('bust','bust',[6,6,6,6]));expect(result.state.game!.active).toBe(1);expect(result.state.game!.phase).toBe('ready');expect(result.state.game!.runners).toEqual({});expect(result.changes).toHaveLength(1);
});
const now=1000000;
const event=(eventId:string,rollId:string,extra:Record<string,unknown>={})=>({schemaVersion:1,eventId,rollId,kind:'roll',capturedAt:now,receivedAt:now,count:4,total:10,dice:[1,2,3,4].map(value=>({value,confidence:.9,box:{x:.1,y:.1,width:.1,height:.1}})),...extra});
test('active tower discovery excludes stale, stopped, and malformed profiles',()=>{
 const tower={schemaVersion:1,name:'Tray',updatedAt:now,sharing:true};
 expect(activeTowers({active:tower,old:{...tower,updatedAt:now-120001},stopped:{...tower,sharing:false},invalid:{...tower,name:''}},now).map(t=>t.id)).toEqual(['active']);
});
test('stream cursor rejects history, duplicates, delayed data and malformed recognition but keeps identical new throws',()=>{
 const cursor=new RollCursor(now);expect(cursor.update({old:event('old','old',{capturedAt:now-1,receivedAt:now-1})})).toEqual([]);
 const fresh=event('a','roll-a');expect(cursor.update({old:event('old','old'),a:fresh})).toHaveLength(1);expect(cursor.update({a:fresh})).toEqual([]);
 expect(cursor.update({b:event('b','roll-b')})).toHaveLength(1);
 expect(cursor.update({c:event('c','roll-b',{kind:'recognitionChanged'})})[0].kind).toBe('recognitionChanged');
 expect(cursor.update({late:event('late','late',{capturedAt:now-1})})).toEqual([]);
 expect(towerRoll('bad',event('bad','x',{count:3}))).toBeNull();expect(towerRoll('bad',event('bad','x',{total:99}))).toBeNull();
});

test('a real throw during connection is accepted from the first snapshot without replaying older history',()=>{
 const cursor=new RollCursor(now);
 expect(cursor.update({old:event('old','old',{capturedAt:now-1}),fresh:event('fresh','fresh',{capturedAt:now+1,receivedAt:now+1})}).map(r=>r.eventId)).toEqual(['fresh']);
});

test('tower automatic moves pause on consecutive equal faces across fresh IDs and reloads',()=>{
 const t=table();t.send('p0',roll('first','first'));expect(automaticMove(t.state,t.log)).toEqual({type:'advance',pairing:0});
 t.send('p0',automaticMove(t.state,t.log)!);const runners=structuredClone(t.state.game!.runners);
 t.send('p0',roll('repeat','repeat',[1,3,3,3]));expect(automaticMove(t.state,t.log)).toBeNull();expect(t.state.game!.runners).toEqual(runners);
 // Another reading overwrites the unplayed duplicate; the bridge must be free to deliver it.
 t.send('p0',roll('repeat-again','repeat-again'));expect(automaticMove(replay(t.log),t.log)).toBeNull();expect(t.state.game!.runners).toEqual(runners);
 // A legitimate identical throw remains playable by an ordinary manual selection.
 t.send('p0',{type:'advance',pairing:0});expect(t.state.game!.runners).toEqual({4:2,6:2});
 t.send('p0',roll('different','different',[3,3,3,3]));expect(automaticMove(t.state,t.log)).toEqual({type:'advance',pairing:0});
});

test('tower corrections replace their throw without disabling its first automatic move',()=>{
 const t=table();t.send('p0',roll('first','first'));t.send('p0',automaticMove(t.state,t.log)!);
 t.send('p0',roll('correction','first',[2,2,2,2]));expect(automaticMove(t.state,t.log)).toEqual({type:'advance',pairing:0});
 t.send('p0',automaticMove(t.state,t.log)!);
 t.send('p0',roll('second','second',[2,2,2,2]));expect(automaticMove(t.state,t.log)).toBeNull();
 t.send('p0',roll('second-correction','second',[2,2,2,2]));expect(automaticMove(t.state,t.log)).toBeNull();
 t.send('p0',roll('changed-correction','second',[3,3,3,3]));expect(automaticMove(t.state,t.log)).toEqual({type:'advance',pairing:0});
});

for(const protocol of [2,3] as const)test(`v${protocol}: an identical opening throw can auto-move on the next human's turn`,()=>{
 const t=table(protocol);t.send('p0',roll('first','first'));t.send('p0',automaticMove(t.state,t.log)!);t.send('p0',{type:'stop'});
 t.send('p1',roll('next-person','next-person'));expect(automaticMove(t.state,t.log)).toEqual({type:'advance',pairing:0});
});

test('digital equivalent moves remain automatic and selecting a new dice source starts fresh',()=>{
 const digital=initialState();digital.game={...empty(),dice:[1,1,1,1]};expect(automaticMove(digital,[])).toEqual({type:'advance',pairing:0});
 const t=table();t.send('p0',roll('first','first'));t.send('p0',automaticMove(t.state,t.log)!);
 t.send('p0',{type:'dice-source',tower:'tower-b'});t.send('p0',{type:'tower-roll',tower:'tower-b',eventId:'other-source',rollId:'other-source',dice:[3,1,3,3]});expect(automaticMove(t.state,t.log)).toEqual({type:'advance',pairing:0});
});

test('the 5,4,6,2 incident cannot turn repeated readings into a forced climb and bust',()=>{
 const t=table();t.send('p0',roll('opening','opening',[5,4,3,2]));t.send('p0',{type:'advance',pairing:0});
 t.send('p0',roll('physical-throw','physical-throw',[5,4,6,2]));expect(automaticMove(t.state,t.log)).toBeNull();
 t.send('p0',{type:'advance',pairing:0});const progress=structuredClone(t.state.game!.runners);
 for(let i=0;i<9;i++){
  t.send('p0',roll(`false-reading-${i}`,`false-roll-${i}`,[5,4,6,2]));
  expect(equivalentMove(t.state.game!)).toEqual({type:'advance',pairing:0});
  expect(automaticMove(t.state,t.log)).toBeNull();expect(t.state.game!.runners).toEqual(progress);expect(t.state.game!.active).toBe(0);
 }
});

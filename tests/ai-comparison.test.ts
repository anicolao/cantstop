import {describe,expect,test} from 'bun:test';
import {pairings,type State,apply,lengthOf} from '../src/lib/model/game';
import {bust,classes,choose,policies,value} from '../scripts/ai-comparison/policies';
const board=(extra:Partial<State>={}):State=>({version:1,seed:1,rollIndex:2,active:0,phase:'decide',saved:[{},{},{},{}],runners:{6:2,7:3,8:2},claims:[[],[],[],[]],dice:[1,2,5,6],lastOutcome:'none',...extra});
describe('research comparison',()=>{
 test('126 dice classes represent all 1296 ordered throws',()=>{
  expect(classes).toHaveLength(126);expect(classes.reduce((sum,c)=>sum+c.weight,0)).toBe(1296);
  const ordered=new Map<string,number>();
  for(let a=1;a<=6;a++)for(let b=1;b<=6;b++)for(let c=1;c<=6;c++)for(let d=1;d<=6;d++){
   const key=[a,b,c,d].sort().join(',');ordered.set(key,(ordered.get(key)??0)+1);
  }
  for(const c of classes)expect(c.weight).toBe(ordered.get(c.dice.join(','))!);
 });
 test('bust shortcut matches production legality including capped runners and closed columns',()=>{
  for(const g of [board(),board({runners:{2:3,7:8,12:3}}),board({runners:{2:3},claims:[[4],[6,8],[],[]]}),board({runners:{},claims:[[2,3],[4,5],[],[]]})]){
   let count=0;
   for(let a=1;a<=6;a++)for(let b=1;b<=6;b++)for(let c=1;c<=6;c++)for(let d=1;d<=6;d++)if(!pairings({...g,dice:[a,b,c,d]}).some(p=>p.variants.length))count++;
   expect(bust(g)).toBe(count/1296);
  }
 });
 test('all fair policies choose legal moves and bank an available win',()=>{
  for(const p of policies.filter(p=>!p.model&&!p.samples)){
   const g=board({phase:'choose'});expect(()=>apply(g,choose(g,p))).not.toThrow();
   expect(choose(board({claims:[[2,12],[],[],[]],runners:{7:13}}),p)).toEqual({type:'stop'});
  }
 });
 test('claimed column value survives the engine removing closed saved positions',()=>{
  const g=board({claims:[[7],[6],[],[]],runners:{},saved:[{8:4},{8:2},{},{}]});
  expect(value(g,{},policies.find(p=>p.name==='board-80')!)).toBeCloseTo(1.5**lengthOf(7)-1+80+1.5**2-1,10);
 });
 test('conservative and aggressive policies straddle the balanced stopping threshold',()=>{
  let passive=0,reckless=0;
  for(let pos=1;pos<=7;pos++){
   const g=board({runners:{4:pos,7:pos,10:pos}});
   const actions=['easy','balanced','yolo'].map(name=>choose(g,policies.find(p=>p.name===name)!).type);
   if(actions[0]==='roll')expect(actions[1]).toBe('roll');
   if(actions[1]==='roll')expect(actions[2]).toBe('roll');
   passive+=Number(actions[0]==='stop'&&actions[1]==='roll');reckless+=Number(actions[1]==='stop'&&actions[2]==='roll');
  }
  expect(passive).toBeGreaterThan(0);expect(reckless).toBeGreaterThan(0);
 });
});

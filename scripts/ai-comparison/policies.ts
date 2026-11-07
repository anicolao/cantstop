import {encode,prediction} from './neural';
// Research-only adapters. Production companion and replay are unchanged.
import {pairings, lengthOf, type State, type Intent, type Positions} from '../../src/lib/model/game';
import {chooseBot, initialState} from '../../src/game/engine';
export type Policy={name:string;model?:string;neuralStop?:boolean;style?:'balanced'|'central'|'short';risk?:number;minRolls?:number;maxRolls?:number;balancedStop?:boolean;evRisk?:number;samples?:number;bonus?:number;base?:number};
export const policies:Policy[]=[
 {name:'current'},
 {name:'imitation',model:'imitation',neuralStop:true,bonus:80},
 {name:'imitation-exact',model:'imitation',bonus:80},
 {name:'rl',model:'rl',neuralStop:true,bonus:80},
 ...['value','selfplay','selfplay-retry','oracle'].map(name=>({name,model:name,bonus:80})),
 {name:'one-roll',style:'balanced',risk:4,minRolls:1,maxRolls:1},
 {name:'cautious',style:'balanced',risk:4,minRolls:1},
 {name:'board-0-balanced-stop',bonus:0,balancedStop:true},
 {name:'board-80-balanced-stop',bonus:80,balancedStop:true},
 {name:'easy',style:'balanced',risk:4},
 {name:'yolo-035',style:'balanced',risk:.35},
 {name:'yolo-050',style:'balanced',risk:.5},
 {name:'yolo',style:'balanced',risk:.25},
 {name:'balanced',style:'balanced',risk:1},
 {name:'central',style:'central',risk:1},
 {name:'short',style:'short',risk:1},
 {name:'board-0-risk2',bonus:0,evRisk:2},{name:'board-80-risk2',bonus:80,evRisk:2},
 {name:'board-0-risk4',bonus:0,evRisk:4},{name:'board-80-risk4',bonus:80,evRisk:4},
 {name:'sampled-0',bonus:0,samples:16},{name:'sampled-80',bonus:80,samples:16},
 {name:'board-0',bonus:0},{name:'board-5',bonus:5},{name:'board-20',bonus:20},
 {name:'board-40',bonus:40},{name:'board-80',bonus:80},{name:'board-160',bonus:160},
 {name:'board-1000',bonus:1000},{name:'base-10',base:10},
];
export const classes:{dice:number[];weight:number}[]=[];
for(let a=1;a<=6;a++)for(let b=a;b<=6;b++)for(let c=b;c<=6;c++)for(let d=c;d<=6;d++){
 const counts=[a,b,c,d].reduce((m,n)=>(m[n]=(m[n]??0)+1,m),{} as Record<number,number>);
 const factorial=[1,1,2,6,24];
 classes.push({dice:[a,b,c,d],weight:24/Object.values(counts).reduce((p,n)=>p*factorial[n],1)});
}
export function successors(g:State){
 return pairings(g).flatMap(p=>p.variants.map(v=>{
  const runners={...g.runners};for(const [c,n] of Object.entries(v.moves))runners[+c]=(runners[+c]??g.saved[g.active][+c]??0)+n;
  return {runners,intent:{type:'advance',pairing:p.index,...(p.variants.length>1?{column:v.column!}:{})} as Intent};
 }));
}
export function value(g:State,runners:Positions,p:Policy){
 const own=g.active,other=1-own,closed=new Set(g.claims.flat());let v=0;
 for(let c=2;c<=12;c++){
  if(g.claims[other].includes(c))continue;
  const pos=g.claims[own].includes(c)?lengthOf(c):(runners[c]??g.saved[own][c]??0);
  v+=(p.base??1.5)**(pos-(g.saved[other][c]??0))-1;
  if(g.claims[own].includes(c)||(pos===lengthOf(c)&&!closed.has(c)))v+=p.base===10?10**lengthOf(c):(p.bonus??0);
 }
 return v;
}
function balancedValue(g:State,r:Positions,p:Policy){
 let value=0;for(const [key,pos] of Object.entries(r)){
  const c=+key,saved=g.saved[g.active][c]??0,remaining=lengthOf(c)-saved;
  const w=p.style==='central'?(c>=5&&c<=9?1.45:.6):p.style==='short'?([2,3,11,12].includes(c)?1.7:.85):1;
  value+=w*((pos-saved)/remaining)**.85;if(pos===lengthOf(c))value+=w*.55;
 }return value;
}
// Exactly enumerate legal outcomes, including full runners and closed columns.
const bustCache=new Map<number,number>();
export function bust(g:State){
 const closed=new Set(g.claims.flat()),full=Object.keys(g.runners).length===3;
 let mask=0;for(let c=2;c<=12;c++)if(!closed.has(c)&&(!full||g.runners[c]!==undefined)&&(g.runners[c]??g.saved[g.active][c]??0)<lengthOf(c))mask|=1<<(c-2);
 const cached=bustCache.get(mask);if(cached!==undefined)return cached;
 let count=0;for(const {dice:[a,b,c,d],weight} of classes){
  if(![a+b,c+d,a+c,b+d,a+d,b+c].some(n=>mask&(1<<(n-2))))count+=weight;
 }
 const probability=count/1296;bustCache.set(mask,probability);return probability;
}
export function choose(g:State,p:Policy,lookahead?:number[][]):Intent{
 if(p.name==='current')return chooseBot({...initialState(),phase:'playing',players:[{id:'bot-0',name:'0',bot:true},{id:'bot-1',name:'1',bot:true}],game:g})!;
 const evaluate=p.style?(r:Positions)=>balancedValue(g,r,p):scorer(g,p);
 if(g.phase==='choose'){
  let best:ReturnType<typeof successors>[number]|undefined,bestValue=-Infinity,bestBust=Infinity;
  for(const s of successors(g)){
   const v=p.model?prediction(p.model,encode(g,s.runners,!['imitation','rl'].includes(p.model),!['imitation','rl'].includes(p.model)?1:0)):evaluate(s.runners);
   if(v<bestValue)continue;
   const b=p.style?bust({...g,runners:s.runners}):0;
   if(v>bestValue||b<bestBust){best=s;bestValue=v;bestBust=b;}
  }
  if(!best)throw new Error('No legal move');return best.intent;
 }
 if(g.phase!=='decide')throw new Error('Expected choose or decide');
 const complete=g.claims[g.active].length+Object.entries(g.runners).filter(([c,n])=>n===lengthOf(+c)).length;
 if(complete>=3||g.rollIndex>=(p.maxRolls??35))return {type:'stop'};
 if(p.model&&p.neuralStop)return {type:prediction(p.model,encode(g,g.runners,false,1),'stop')>0?'roll':'stop'};
 if(p.style||p.balancedStop){
  if(g.rollIndex<(p.minRolls??2))return {type:'roll'}; // Archive's forced second throw, preserved.
  const b=bust(g),risk=balancedValue(g,g.runners,p);
  const open=Object.entries(g.runners).filter(([c,n])=>n<lengthOf(+c)).length;
  return {type:b*(p.risk??1)*risk<(1-b)*(.15+.035*open)?'roll':'stop'};
 }
 const stop=evaluate(g.runners),lost=evaluate({});let ev=0,bustWeight=0;
 const draws=p.samples?lookahead!.map(dice=>({dice,weight:1})):classes,denominator=p.samples??1296;
 for(const x of draws){
  const opts=successors({...g,dice:x.dice});let best=-Infinity;
  for(const opt of opts)best=Math.max(best,evaluate(opt.runners));
  ev+=x.weight*(opts.length?best:lost);if(!opts.length)bustWeight+=x.weight;
 }
 return {type:ev/denominator-stop>((p.evRisk??1)-1)*bustWeight/denominator*(stop-lost)?'roll':'stop'};
}

// Precompute column contributions once per decision, avoiding exponentiation per outcome.
function scorer(g:State,p:Policy){
 const baseline=value(g,{},p),deltas:number[][]=[];
 const own=g.active,other=1-own,closed=new Set(g.claims.flat());
 for(let c=2;c<=12;c++){
  const saved=g.saved[own][c]??0,op=g.saved[other][c]??0,values:number[]=[];
  for(let pos=0;pos<=lengthOf(c);pos++)values[pos]=g.claims[other].includes(c)||g.claims[own].includes(c)?0:
   (p.base??1.5)**(pos-op)-(p.base??1.5)**(saved-op)+(pos===lengthOf(c)&&!closed.has(c)?(p.base===10?10**lengthOf(c):(p.bonus??0)):0);
  deltas[c]=values;
 }
 return (r:Positions)=>{let v=baseline;for(const key in r)v+=deltas[+key][r[+key]];return v;};
}

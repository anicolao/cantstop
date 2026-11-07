import {lengthOf,pairings,type State,type Positions,type Intent} from '../lib/model/game';
export const BOT_LEVELS=[
 {id:'easy',label:'Easy',description:'Cautious · saves early'},
 {id:'yolo',label:'Yolo',description:'Reckless · keeps climbing'},
 {id:'standard',label:'Standard',description:'Balanced risk and reward'},
 {id:'hard',label:'Hard',description:'Values the board and races for summits'}
] as const;
export type BotLevel=typeof BOT_LEVELS[number]['id'];
export const isBotLevel=(value:unknown):value is BotLevel=>BOT_LEVELS.some(level=>level.id===value);
export const botLabel=(level?:BotLevel)=>BOT_LEVELS.find(l=>l.id===level)?.label??'Classic';
/** Exact next-roll distribution. All 1,296 ordered outcomes are represented. */
const rolls:{dice:number[];weight:number;sums:number[]}[]=[];
for(let a=1;a<=6;a++)for(let b=a;b<=6;b++)for(let c=b;c<=6;c++)for(let d=c;d<=6;d++){
 const counts=[a,b,c,d].reduce((m,n)=>(m[n]=(m[n]??0)+1,m),{} as Record<number,number>);
 const factorial=[1,1,2,6,24],weight=24/Object.values(counts).reduce((p,n)=>p*factorial[n],1);
 rolls.push({dice:[a,b,c,d],weight,sums:[a+b,c+d,a+c,b+d,a+d,b+c]});
}
const bustCache=new Map<number,number>();
function bustProbability(g:State){
 const closed=new Set(g.claims.flat()),full=Object.keys(g.runners).length===3;let mask=0;
 for(let c=2;c<=12;c++)if(!closed.has(c)&&(!full||g.runners[c]!==undefined)&&(g.runners[c]??g.saved[g.active][c]??0)<lengthOf(c))mask|=1<<(c-2);
 const cached=bustCache.get(mask);if(cached!==undefined)return cached;
 const probability=rolls.reduce((sum,r)=>sum+(r.sums.some(n=>mask&(1<<(n-2)))?0:r.weight),0)/1296;
 bustCache.set(mask,probability);return probability;
}
function choices(g:State){
 return pairings(g).flatMap(p=>p.variants.map(v=>{
  const runners={...g.runners};for(const [c,n] of Object.entries(v.moves))runners[+c]=(runners[+c]??g.saved[g.active][+c]??0)+n;
  return {runners,intent:{type:'advance',pairing:p.index,...(p.variants.length>1?{column:v.column!}:{})} as Intent};
 }));
}
function balanced(g:State,r:Positions){
 let value=0;for(const [key,pos] of Object.entries(r)){
  const c=+key,saved=g.saved[g.active][c]??0,remaining=lengthOf(c)-saved;
  value+=((pos-saved)/remaining)**.85;if(pos===lengthOf(c))value+=.55;
 }return value;
}
/** Value gained this turn. In multiplayer, race the leading opponent on each column. */
function boardValue(g:State){
 const closed=new Set(g.claims.flat()),deltas:number[][]=[];
 for(let c=2;c<=12;c++){
  const saved=g.saved[g.active][c]??0,opponent=Math.max(0,...g.saved.filter((_,i)=>i!==g.active).map(s=>s[c]??0));
  deltas[c]=Array.from({length:lengthOf(c)+1},(_,pos)=>closed.has(c)?0:1.5**(pos-opponent)-1.5**(saved-opponent)+(pos===lengthOf(c)?80:0));
 }
 return (r:Positions)=>{let value=0;for(const c in r)value+=deltas[+c][r[+c]];return value;};
}
/** Fair, deterministic choices from the visible board only; never reads the seed or future dice. */
export function chooseCompanion(g:State,level:BotLevel,turnRolls:number):Intent|null{
 if(g.phase==='ready')return {type:'roll'};
 if(g.phase==='finished')return null;
 const evaluate=level==='hard'?boardValue(g):(r:Positions)=>balanced(g,r);
 if(g.phase==='choose'){
  let best:ReturnType<typeof choices>[number]|undefined,bestValue=-Infinity,bestBust=Infinity;
  for(const choice of choices(g)){
   const value=evaluate(choice.runners);if(value<bestValue)continue;
   const bust=level==='hard'?0:bustProbability({...g,runners:choice.runners});
   if(value>bestValue||bust<bestBust){best=choice;bestValue=value;bestBust=bust;}
  }
  return best?.intent??null;
 }
 const complete=g.claims[g.active].length+Object.entries(g.runners).filter(([c,pos])=>pos===lengthOf(+c)).length;
 if(complete>=3||turnRolls>=35)return {type:'stop'};
 if(level!=='hard'){
  if(turnRolls<2)return {type:'roll'};
  const bust=bustProbability(g),penalty=level==='easy'?4:level==='yolo'?.35:1;
  const open=Object.entries(g.runners).filter(([c,pos])=>pos<lengthOf(+c)).length;
  return {type:bust*penalty*evaluate(g.runners)<(1-bust)*(.15+.035*open)?'roll':'stop'};
 }
 const stop=evaluate(g.runners);let ev=0,bustWeight=0;
 for(const roll of rolls){
  const next=choices({...g,dice:roll.dice});let best=0;
  if(next.length){best=-Infinity;for(const choice of next)best=Math.max(best,evaluate(choice.runners));}else bustWeight+=roll.weight;
  ev+=roll.weight*best;
 }
 // Double the expected bust loss, calibrated against balanced on two seed ranges.
 return {type:ev/1296-stop>bustWeight/1296*stop?'roll':'stop'};
}

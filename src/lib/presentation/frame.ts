import {lengthOf,type State,type Positions} from '../model/game';
import type {Transition} from './catalog';
import {FINISH} from './finish';
import {cell,markerPoint,runnerPoint,runnerHome,PIECE_SCALE,type Vec3} from './layout';
export {cell,spacing,PIECE_SCALE,runnerHome,PODIUM} from './layout';
export type {Vec3} from './layout';
export type PieceFrame={id:string;column:number;position:Vec3;color:string;runner:boolean;opacity:number;scale:number;owner:number;onBoard:boolean;slot?:number};
export type Frame={state:State;pieces:PieceFrame[];dice:number[];diceProgress:number;kind:string;progress:number;lightColumn?:number;label:string;detail:string;dim:number;claims:number[][]};
export function mix(a:number,b:number,t:number){return a+(b-a)*t;}
export function ease(t:number){return t*t*(3-2*t);}
const ramp=(t:number,a:number,b:number)=>ease(Math.max(0,Math.min(1,(t-a)/(b-a))));
const pos=(a:Vec3,b:Vec3,t:number,hop=0):Vec3=>[mix(a[0],b[0],t),mix(a[1],b[1],t)+Math.sin(t*Math.PI)*hop,mix(a[2],b[2],t)];
function staticPieces(s:State):PieceFrame[]{
 const out:PieceFrame[]=[];
 for(const [owner,positions] of s.saved.entries())for(const [c,p] of Object.entries(positions)){
   if(s.claims.flat().includes(+c))continue;
   out.push({id:`saved-${owner}-${c}`,column:+c,position:markerPoint(s,+c,p,owner),color:FINISH.players[owner],runner:false,opacity:1,scale:PIECE_SCALE,owner,onBoard:true});
 }
 const active=Object.entries(s.runners).sort(([a],[b])=>+a-+b);
 for(let slot=0;slot<3;slot++){
   const entry=active[slot];
   out.push({id:entry?`runner-${entry[0]}`:`runner-home-${slot}`,column:entry?+entry[0]:0,position:entry?runnerPoint(s,+entry[0],entry[1]):runnerHome(slot),color:FINISH.runner,runner:true,opacity:1,scale:PIECE_SCALE,owner:s.active,onBoard:!!entry,slot});
 }
 for(const [owner,claims] of s.claims.entries())for(const c of claims)out.push({id:`claim-${c}`,column:c,position:cell(c,lengthOf(c)),color:FINISH.players[owner],runner:false,opacity:1,scale:PIECE_SCALE,owner,onBoard:true});
 return out;
}
export function sample(step:Transition,time:number,reduced=false):Frame {
 const t=reduced?step.duration:Math.max(0,Math.min(time,step.duration)),p=t/step.duration;
 const {before,after,kind}=step;
 let pieces=staticPieces(before),state=p>=1?after:before;
 let label='Choose your climb',detail='Pair the dice, then make your move.',lightColumn:number|undefined;
 const isRoll=kind==='roll'||kind==='bust';
 if(kind==='ready'){label='Your turn. Three runners ready.';detail='Roll the dice to begin your climb.';}
 if(kind==='advance'){
   pieces=pieces.map(piece=>{
     if(!piece.runner||!piece.onBoard)return piece;
     const start=before.runners[piece.column],end=after.runners[piece.column]??start,delta=end-start;
     if(delta<=0)return piece;
     const local=ramp(t,.25,1.85)*delta,whole=Math.min(delta-1,Math.floor(local)),fraction=local-whole;
     return {...piece,position:pos(runnerPoint(before,piece.column,start+whole),runnerPoint(before,piece.column,start+whole+1),fraction,.43)};
   });
   let slot=Object.keys(before.runners).length;
   for(const [c,end] of Object.entries(after.runners))if(before.runners[+c]===undefined){
     const home=runnerHome(slot),start=(before.saved[before.active][+c]??0)+1;
     const point=t<.95?pos(home,runnerPoint(before,+c,start),ramp(t,.25,.95),1.1):pos(runnerPoint(before,+c,start),runnerPoint(before,+c,end),ramp(t,.95,1.85),.43);
     pieces=pieces.filter(piece=>piece.id!==`runner-home-${slot}`);
     pieces.push({id:`runner-${c}`,column:+c,position:point,color:FINISH.runner,runner:true,opacity:1,scale:PIECE_SCALE,owner:before.active,onBoard:true,slot});slot++;
   }
   lightColumn=Object.keys(after.runners).map(Number).find(c=>after.runners[c]===lengthOf(c));
   label=lightColumn?`Stop to claim ${lightColumn}`:'A little higher.';detail=lightColumn?'This summit is still at risk.':'Your saved positions have not moved.';
   if(p>=1)pieces=staticPieces(after);
 }
 if(['save','claim','win'].includes(kind)){
   const move=ramp(t,.2,1.25),leave=ramp(t,1.25,2.35);
   pieces=pieces.filter(piece=>{
     if(piece.runner)return true;
     if(piece.owner!==before.active&&after.claims.flat().includes(piece.column)&&!before.claims.flat().includes(piece.column))return leave<1;
     return true;
   }).map(piece=>{
     if(piece.runner)return piece.onBoard?{...piece,position:pos(piece.position,runnerHome(piece.slot!),leave,.7),onBoard:leave<1}:piece;
     if(piece.owner===before.active&&before.runners[piece.column])return {...piece,position:pos(piece.position,markerPoint(after,piece.column,before.runners[piece.column],piece.owner),move,.25)};
     if(after.claims.flat().includes(piece.column)&&!before.claims.flat().includes(piece.column)&&piece.owner!==before.active)return {...piece,opacity:1-leave};
     return piece;
   });
   for(const [c,end] of Object.entries(before.runners))if(!before.saved[before.active][+c])pieces.push({id:`new-save-${c}`,column:+c,position:markerPoint(after,+c,end,before.active),color:FINISH.players[before.active],runner:false,opacity:move,scale:PIECE_SCALE,owner:before.active,onBoard:true});
   label=kind==='win'?'Ari wins.':kind==='claim'?'A summit, made yours.':'Progress, kept.';
   detail=kind==='win'?'Three saved summits. One well-timed stop.':kind==='claim'?'Column 6 is closed to everyone.':'Your runners return to their ivory podium.';
   if(p>=1)pieces=staticPieces(after);
   lightColumn=kind==='win'||kind==='claim'?6:undefined;
 }
 if(kind==='bust'){
   const drop=ramp(t,2,3.15);
   pieces=pieces.map(piece=>piece.runner&&piece.onBoard?{...piece,position:pos(piece.position,runnerHome(piece.slot!),drop,.45),onBoard:drop<1}:piece);
   label=t<1.9?'One more roll…':'Bust.';detail=t<1.9?'The dice have the last word.':'This turn is lost. Saved positions remain.';
   if(p>=1)pieces=staticPieces(after);
 }
 if(kind==='roll'){label=t<2?'One more roll…':'Choose your climb';detail=t<2?'Four dice. Three possibilities.':'1 · 2 · 5 · 6';}
 if(kind==='reconnect'){label=p<.7?'Rejoining your table…':'Right where you left off.';detail=p<.7?'Your roll and decision are preserved.':'The same dice. The same choice.';}
 return {state,pieces,dice:isRoll?after.dice:before.dice,diceProgress:isRoll?ramp(t,.15,2):1,kind,progress:p,lightColumn,label,detail,dim:kind==='reconnect'?.65*Math.sin(p*Math.PI):0,claims:p>.65?after.claims:before.claims};
}
export function previewPositions(state:State,moves:Positions){return Object.entries(moves).map(([c,n])=>({column:+c,position:runnerPoint(state,+c,(state.runners[+c]??state.saved[state.active][+c]??0)+n)}));}

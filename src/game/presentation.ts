import type {State,Event} from './engine';
import type {Transition} from '../lib/presentation/catalog';
import type {Frame} from '../lib/presentation/frame';
import {sample} from '../lib/presentation/frame';
export function transition(before:State,after:State,event:Event):Transition|null{
 if(!before.game||!after.game||!['roll','advance','stop'].includes(event.intent.type))return null;
 const kind=event.intent.type==='advance'?'advance':event.intent.type==='roll'?after.game.lastOutcome==='bust'?'bust':'roll':after.game.lastOutcome;
 const duration=({advance:2.4,roll:2.8,bust:3.6,save:3.1,claim:3.3,win:3.8} as Record<string,number>)[kind]??2;
 return {before:before.game,after:after.game,kind,duration};
}
export function frameFor(state:State,step:Transition|null,time:number,reduced=false):Frame|null{
 if(!state.game)return null;
 const current=step??{before:state.game,after:state.game,kind:state.game.phase==='ready'?'ready':'settled',duration:1};
 const frame=sample(current,step?time:1,reduced);
 const player=state.players[frame.state.active]?.name??'Player';
 if(!step||frame.progress>=1){
  frame.label=state.phase==='finished'?`${state.players.find(p=>p.id===state.winner)?.name} wins`:frame.state.phase==='ready'?`${player}'s turn`:frame.state.phase==='choose'?`${player}, choose your climb`:`${player}, roll or save?`;
  frame.detail=state.phase==='finished'?'Three summits, claimed.':frame.state.phase==='choose'?'Pair the dice, then move.':frame.state.phase==='ready'?'Roll to begin your climb.':'Keep climbing or save your progress.';
 }else if(current.kind==='win'){frame.label=`${state.players.find(p=>p.id===state.winner)?.name} wins`;}
 else if(current.kind==='roll'){frame.detail=frame.dice.join(' · ');}
 else if(current.kind==='claim'){const claimed=state.game.claims.flat().filter(c=>!current.before.claims.flat().includes(c));frame.detail=`${claimed.join(' & ')} closed to everyone.`;}
 return frame;
}

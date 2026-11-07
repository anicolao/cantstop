import {evolve,type State,type Event} from './engine';
import type {Transition} from '../lib/presentation/catalog';
import type {Frame} from '../lib/presentation/frame';
import {FINISH} from '../lib/presentation/finish';
import {sample} from '../lib/presentation/frame';
export function transitions(before:State,event:Event):Transition[]{
 return evolve(before,event.actor,event.intent).changes.map(change=>{
  const {before,after,action,replacement}=change;
  const kind=action==='tower-roll'?(after.lastOutcome==='bust'?'tower-bust':replacement?'tower-replace':'tower'):replacement?'replace':action==='advance'?'advance':action==='roll'?after.lastOutcome==='bust'?'bust':'roll':after.lastOutcome;
  const duration=({tower:.05,'tower-replace':1.5,'tower-bust':3.6,advance:2.4,replace:1.5,roll:2.8,bust:3.6,save:3.1,claim:3.3,win:3.8} as Record<string,number>)[kind]??2;
  return {before,after,kind,duration};
 });
}
export function frameFor(state:State,step:Transition|null,time:number,reduced=false):Frame|null{
 if(!state.game)return null;
 const current=step??{before:state.game,after:state.game,kind:state.game.phase==='ready'?'ready':'settled',duration:1};
 const frame=sample(current,step?time:1,reduced);
 for(const piece of frame.pieces)piece.color=FINISH.players[state.players[piece.owner]?.colour??piece.owner];
 const player=state.players[frame.state.active]?.name??'Player';
 if(!step||frame.progress>=1){
  frame.label=frame.state.phase==='ready'&&state.players[frame.state.active]?.tower?`${player}, roll in your tower`:state.phase==='finished'?`${state.players.find(p=>p.id===state.winner)?.name} wins`:frame.state.phase==='ready'?`${player}'s turn`:frame.state.phase==='choose'?`${player}, choose your climb`:`${player}, roll or save?`;
  frame.detail=frame.state.phase==='ready'&&state.players[frame.state.active]?.tower?'Waiting for four dice.':state.phase==='finished'?'Three summits, claimed.':frame.state.phase==='choose'?'Choose a pairing to climb.':frame.state.phase==='ready'?'The dice are coming your way.':'Keep climbing or save your progress.';
 }else if(current.kind==='win'){frame.label=`${state.players.find(p=>p.id===state.winner)?.name} wins`;}
 else if(current.kind==='roll'){frame.detail=frame.dice.join(' · ');}
 else if(current.kind==='claim'){const claimed=state.game.claims.flat().filter(c=>!current.before.claims.flat().includes(c));frame.detail=`${claimed.join(' & ')} closed to everyone.`;}
 if(frame.state.phase==='ready'&&state.players[frame.state.active]?.tower)frame.dice=[];
 return frame;
}

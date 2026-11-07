<script lang="ts">
 import {automaticMove} from '../../game/automatic-move';
 import {watchTowerRolls} from '../../game/towers/connection';
 import type {TowerRoll} from '../../game/towers/model';
 import type {State,Intent,Event} from '../../game/engine';
 let {gameState,gameEvents,selected,actors,paused,onIntent,onStatus}:{gameState:State;gameEvents:readonly Event[];selected:string|null;actors:string[];paused:boolean;onIntent:(intent:Intent,actor:string)=>Promise<boolean>;onStatus:(text:string)=>void}=$props();
 const actorKey=$derived(actors.join(','));
 let pending=$state.raw<{event:TowerRoll;actor:string;turnId:number}[]>([]),busy=$state(false);let attempted='';
 $effect(()=>{
  const tower=selected,hasActors=actorKey.length>0;pending=[];attempted='';if(!tower){onStatus('Digital dice');return;}if(!hasActors){onStatus('Take a seat to connect your tower.');return;}
  return watchTowerRolls(tower,event=>{
   const actor=gameState.players[gameState.game?.active??-1]?.id;
   if(gameState.phase!=='playing'||!actor||!actors.includes(actor))return;
   if(event.kind==='recognitionChanged'&&gameState.towerRoll?.rollId!==event.rollId&&!pending.some(p=>p.event.rollId===event.rollId))return;
   pending=[...pending,{event,actor,turnId:gameState.turnId}].slice(-32);
  },onStatus);
 });
 $effect(()=>{
  if(paused||busy||gameState.protocol===1)return;
  const person=gameState.players.find(p=>actors.includes(p.id)&&(p.tower??null)!==selected);
  const next=pending[0];
  if(!person&&next&&(next.turnId!==gameState.turnId||gameState.players[gameState.game?.active??-1]?.id!==next.actor||gameState.towerEvents.includes(`${selected}/${next.event.eventId}`))){pending=pending.slice(1);return;}
  if(!person&&next&&automaticMove(gameState,gameEvents))return; // Let the controller commit a forced move before the next throw.
  const actor=person?.id??next?.actor;if(!actor)return;
  const intent:Intent=person?{type:'dice-source',tower:selected}:{type:'tower-roll',tower:selected!,eventId:next.event.eventId,rollId:next.event.rollId,dice:next.event.dice};
  const key=`${gameState.revision}:${actor}:${JSON.stringify(intent)}`;if(attempted===key)return;attempted=key;busy=true;
  void onIntent(intent,actor).then(ok=>{if(ok&&!person)pending=pending.filter(p=>p.event.eventId!==next.event.eventId);}).finally(()=>busy=false);
 });
</script>

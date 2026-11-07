import {equivalentMove} from '../lib/model/game';
import type {Event,State} from './engine';

type Reading={tower:string;rollId:string;faces:string};
const faces=(dice:readonly number[])=>[...dice].sort((a,b)=>a-b).join(',');

/** Live-controller policy only: historical replay still applies every recorded choice. */
export function automaticMove(state:State,events:readonly Event[]){
 const game=state.game;if(game?.phase!=='choose')return null;
 const player=state.players[game.active];
 if(player?.tower&&state.towerRoll){
  let previous:Reading|null=null,current:Reading|null=null;
  for(const event of events){
   if(event.sequence<=state.turnId||event.actor!==player.id)continue;
   const intent=event.intent;
   if(intent.type==='dice-source'||intent.type==='roll'){previous=current=null;continue;}
   if(intent.type!=='tower-roll')continue;
   const reading={tower:intent.tower,rollId:intent.rollId,faces:faces(intent.dice)};
   // Recognition corrections replace the current throw, rather than adding another one.
   if(current?.tower!==reading.tower||current.rollId!==reading.rollId)previous=current;
   current=reading;
  }
  if(previous&&current&&previous.tower===current.tower&&previous.faces===current.faces)return null;
 }
 return equivalentMove(game);
}

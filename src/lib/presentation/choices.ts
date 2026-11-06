import {lengthOf,type State,type Pairing} from '../model/game';

/** Use the model's legal moves for each sum, including partial pairings. */
export function pairingNumbers(state:State,pairing:Pairing,runnerColumn?:number){
 const variants=runnerColumn!==undefined&&pairing.variants.length>1
  ?pairing.variants.filter(v=>v.column===runnerColumn):pairing.variants;
 const closed=state.claims.flat();
 return pairing.sums.map((number,index)=>{
  const occurrence=pairing.sums.slice(0,index+1).filter(n=>n===number).length;
  const inactive=!variants.some(v=>(v.moves[number]??0)>=occurrence);
  const reason=!inactive?undefined:closed.includes(number)?'closed'
   :state.runners[number]!==undefined?'no further step'
   :Object.keys(state.runners).length>=3?'no pawn'
   :runnerColumn!==undefined?'not chosen':'unavailable';
  return {number,inactive,reason};
 });
}

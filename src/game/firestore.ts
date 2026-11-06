import {doc,collection,query,orderBy,onSnapshot,runTransaction,type Firestore} from 'firebase/firestore';
import {apply,replay,parseIntent,type Event} from './engine';
import type {Pending} from './repository';
export function tableRef(db:Firestore,scope:string,room:string){return doc(db,'previews',scope,'tables',room);}
/** The only persisted game data is the immutable intent stream. Metadata gates writes. */
export async function appendFirestore(db:Firestore,scope:string,room:string,uid:string,pending:Pending,prefix:readonly Event[]=[]){
 const root=tableRef(db,scope,room),intent=parseIntent(pending.intent);
 return runTransaction(db,async transaction=>{
  const [snapshot,ack]=await Promise.all([transaction.get(root),transaction.get(doc(root,'commands',pending.id))]);
  const meta=snapshot.exists()?snapshot.data() as {owner:string;members:string[];bots:string[];revision:number}:undefined;
  if(ack.exists()){
   const saved=(await transaction.get(doc(root,'events',String(ack.data().sequence)))).data() as Event;
   const stored=parseIntent(saved.intent),keys=Object.keys(intent);
   if(saved.actor!==pending.actor||keys.length!==Object.keys(stored).length||keys.some(key=>(stored as unknown as Record<string,unknown>)[key] !== (intent as unknown as Record<string,unknown>)[key]))throw new Error('That action has already been used.');
   return;
  }
  const revision=meta?.revision??0;
  if(revision!==pending.expectedRevision)throw new Error('The table changed. Try again.');
  const cached=prefix.length<=revision&&(!meta||prefix[0]?.actor===meta.owner)?[...prefix]:[];
  const tail=await Promise.all(Array.from({length:revision-cached.length},(_,i)=>transaction.get(doc(root,'events',String(cached.length+i+1)))));
  const events=[...cached,...tail.map(row=>row.data() as Event)];
  const state=replay(events);
  if(pending.actor!==uid&&!(meta?.owner===uid&&meta.bots.includes(pending.actor)))throw new Error('Take your own seat.');
  const next=apply(state,pending.actor,intent);
  const event:Event={version:state.protocol,id:pending.id,actor:pending.actor,sequence:revision+1,intent};
  transaction.set(root,{owner:next.host,members:next.players.map(p=>p.id),bots:next.players.filter(p=>p.bot).map(p=>p.id),revision:revision+1});
  transaction.set(doc(root,'events',String(event.sequence)),event);
  transaction.set(doc(root,'commands',pending.id),{sequence:event.sequence});
 });
}
export function watchFirestore(db:Firestore,scope:string,room:string,accept:(events:Event[])=>void,fail:()=>void){
 return onSnapshot(query(collection(tableRef(db,scope,room),'events'),orderBy('sequence')),{includeMetadataChanges:true},snapshot=>{
  if(snapshot.metadata.hasPendingWrites||snapshot.metadata.fromCache)return;
  try{const events=snapshot.docs.map(row=>row.data() as Event);replay(events);accept(events);}catch{fail();}
 },fail);
}

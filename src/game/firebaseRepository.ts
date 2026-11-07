import {actorConnection} from './local-players';
import {randomId} from './random-id';
import {connectFirebase,previewScope} from '../firebase';
import {appendFirestore,watchFirestore} from './firestore';
import {getDoc} from 'firebase/firestore';
import {tableRef} from './firestore';
import {type Event,type Intent,apply,replay} from './engine';
import type {Pending} from './repository';
export function firebaseRepository(room:string,onEvents:(events:Event[])=>void,onError:(message:string)=>void){
 let events:Event[]=[],closed=false,unsubscribe=()=>{};
 const services=connectFirebase(),key=`cantstop:pending:firebase:${previewScope}:${room}`;
 const accept=(next:Event[])=>{if(!closed&&next.length>=events.length){events=next;onEvents(events);}};
 void services.then(({db})=>{if(!closed)unsubscribe=watchFirestore(db,previewScope,room,accept,()=>onError('Couldn’t reach the table. Try again.'));}).catch(()=>onError('Couldn’t reach the table. Try again.'));
 async function send(pending:Pending){
  const {db,uid}=await actorConnection(room,pending.actor);
  try{await appendFirestore(db,previewScope,room,uid,pending,events);localStorage.removeItem(key);}
  catch(error){
   const message=(error as Error).message;
   if(message==='The table changed. Try again.'||message==='That action has already been used.')localStorage.removeItem(key);
   if(typeof error==='object'&&error!==null&&'code' in error&&error.code==='permission-denied'){
    localStorage.removeItem(key);
    const current=await getDoc(tableRef(db,previewScope,room));
    if(current.data()?.revision!==pending.expectedRevision)throw new Error('The table changed. Try again.');
   }
   throw new Error((typeof error==='object'&&error!==null&&'code' in error)?'Couldn’t reach the table. Try again.':message);
  }
 }
 return {
  async append(actor:string,intent:Intent){
   if(localStorage.getItem(key))throw new Error('Finish your last action first.');
   apply(replay(events),actor,intent);
   const pending:Pending={id:randomId(),actor,expectedRevision:events.length,intent};localStorage.setItem(key,JSON.stringify(pending));await send(pending);
  },
  async retry(){const pending=localStorage.getItem(key);if(pending)await send(JSON.parse(pending));else{const {db}=await services;unsubscribe();unsubscribe=watchFirestore(db,previewScope,room,accept,()=>onError('Couldn’t reach the table. Try again.'));}},
  close(){closed=true;unsubscribe();}
 };
}

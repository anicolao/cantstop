import {connectFirebase,previewScope} from '../firebase';
import {randomId} from './random-id';
const key=(room:string)=>`cantstop:local-players:${previewScope}:${room}`;
function profiles(room:string):string[]{try{const list=JSON.parse(localStorage.getItem(key(room))??'[]');return Array.isArray(list)?list.filter(p=>typeof p==='string'&&/^[a-f0-9-]{36}$/.test(p)).slice(0,3):[];}catch{return [];}}
export async function localIdentities(room:string){return Promise.all(profiles(room).map(async profile=>(await connectFirebase(profile)).uid));}
export async function newLocalIdentity(room:string){
 const list=profiles(room);if(list.length>=3)throw new Error('All four places on this screen are taken.');
 const profile=randomId();const service=await connectFirebase(profile);
 localStorage.setItem(key(room),JSON.stringify([...list,profile]));return service.uid;
}
export async function actorConnection(room:string,actor:string){
 const primary=await connectFirebase();if(primary.uid===actor)return primary;
 for(const profile of profiles(room)){const service=await connectFirebase(profile);if(service.uid===actor)return service;}
 // The primary host may also act for invited bots. Firestore validates attribution.
 return primary;
}

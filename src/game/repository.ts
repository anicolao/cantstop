import {firebaseRepository} from './firebaseRepository';
import {connectFirebase} from '../firebase';
import type {Event,Intent} from './engine';
export type Pending={id:string;actor:string;expectedRevision:number;intent:Intent};
/** Anonymous Firebase Auth and Firestore are the sole live-game backend. */
export function repository(room:string,onEvents:(events:Event[])=>void,onError:(message:string)=>void){
 return firebaseRepository(room,onEvents,onError);
}
export async function playerIdentity(){return (await connectFirebase()).uid;}

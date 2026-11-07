// Read-only observer of ../dicetower's public Firebase stream. Game data stays in Firestore.
import {initializeApp,getApps,getApp} from 'firebase/app';
import {getAuth,signInAnonymously,connectAuthEmulator} from 'firebase/auth';
import {getDatabase,connectDatabaseEmulator,ref,onValue,query,orderByChild,limitToLast} from 'firebase/database';
import config from './client-config.json';
import {activeTowers,RollCursor,type Tower,type TowerRoll} from './model';
async function connect(){
 const local=import.meta.env.VITE_USE_FIREBASE_EMULATORS==='true';
 const project=local?`demo-dicetower-${import.meta.env.VITE_PREVIEW_ID==='e2e'?'e2e':'local'}`:config.projectId;
 const fresh=!getApps().some(app=>app.name==='cantstop-dicetower-observer');
 const app=fresh?initializeApp({...config,...(local?{projectId:project,apiKey:'fake-api-key',authDomain:`${project}.firebaseapp.com`,databaseURL:`https://${project}-default-rtdb.firebaseio.com`}:{})},'cantstop-dicetower-observer'):getApp('cantstop-dicetower-observer');
 const auth=getAuth(app),db=getDatabase(app);
 if(local&&fresh){connectAuthEmulator(auth,`http://127.0.0.1:${import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_PORT??9299}`,{disableWarnings:true});connectDatabaseEmulator(db,'127.0.0.1',Number(import.meta.env.VITE_DICE_TOWER_EMULATOR_PORT??9012));}
 await auth.authStateReady();if(!auth.currentUser)await signInAnonymously(auth);return db;
}
let connection:ReturnType<typeof connect>|undefined;
const database=()=>connection??=connect().catch(error=>{connection=undefined;throw error;});
export function watchTowers(update:(towers:Tower[])=>void,error:(message:string)=>void){
 let closed=false,stop=()=>{},timer:ReturnType<typeof setInterval>,raw:unknown;
 void database().then(db=>{
  if(closed)return;stop=onValue(query(ref(db,'towers'),orderByChild('updatedAt'),limitToLast(200)),snapshot=>{raw=snapshot.val();update(activeTowers(raw));},()=>error('Could not load dice towers.'));
  timer=setInterval(()=>update(activeTowers(raw)),15_000);
 }).catch(()=>{if(!closed)error('Could not connect to DiceTower.');});
 return()=>{closed=true;stop();clearInterval(timer);};
}
export function watchTowerRolls(tower:string,roll:(value:TowerRoll)=>void,status:(message:string)=>void){
 let closed=false,stop=()=>{},connected=()=>{},profile=()=>{},timer:ReturnType<typeof setInterval>;
 let online=false,listening=false,profileLoaded=false,rawProfile:unknown,deferred:TowerRoll[]=[];const cursor=new RollCursor(Date.now());
 const report=()=>status(!online?'DiceTower disconnected · waiting to reconnect':!profileLoaded||!listening?'Connecting to DiceTower…':!activeTowers({[tower]:rawProfile}).length?'Selected tower is offline · waiting for rolls':cursor.warning??'Ready · roll four dice in your tower');
 const deliver=()=>{if(!profileLoaded)return;const batch=deferred;deferred=[];if(activeTowers({[tower]:rawProfile}).length)for(const value of batch)roll(value);};
 status('Connecting to DiceTower…');
 void database().then(db=>{
  if(closed)return;
  connected=onValue(ref(db,'.info/connected'),snapshot=>{online=!!snapshot.val();report();});
  profile=onValue(ref(db,`towers/${tower}`),snapshot=>{rawProfile=snapshot.val();profileLoaded=true;report();deliver();});timer=setInterval(report,15_000);
  stop=onValue(query(ref(db,`rolls/${tower}`),orderByChild('capturedAt'),limitToLast(10)),snapshot=>{
   deferred.push(...cursor.update(snapshot.val()));listening=true;report();deliver();
  },()=>status('Could not read this tower. Select Digital dice and reconnect the tower.'));
 }).catch(()=>{if(!closed)status('Could not connect to DiceTower.');});
 return()=>{closed=true;stop();connected();profile();clearInterval(timer);};
}

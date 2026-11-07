import {initializeApp} from 'firebase/app';
import {getAuth,signInAnonymously,connectAuthEmulator} from 'firebase/auth';
import {initializeFirestore,connectFirestoreEmulator} from 'firebase/firestore';
export const firebaseConfigured=!!import.meta.env.VITE_FIREBASE_PROJECT_ID;
export const previewScope=import.meta.env.VITE_PREVIEW_ID??'main';
async function connect(profile?:string){
 const env=import.meta.env;
 if(!firebaseConfigured)throw new Error('This build is missing its Firebase configuration.');
 const app=initializeApp({apiKey:env.VITE_FIREBASE_API_KEY,authDomain:env.VITE_FIREBASE_AUTH_DOMAIN,projectId:env.VITE_FIREBASE_PROJECT_ID,appId:env.VITE_FIREBASE_APP_ID},profile?`cantstop-local-${profile}`:undefined);
 const auth=getAuth(app);
 // XHR avoids Safari buffering the last Fetch Streams response frame.
 const db=initializeFirestore(app,{experimentalAutoDetectLongPolling:true,useFetchStreams:false} as Parameters<typeof initializeFirestore>[1]);
 if(env.VITE_USE_FIREBASE_EMULATORS==='true'){
  connectAuthEmulator(auth,`http://127.0.0.1:${env.VITE_FIREBASE_AUTH_EMULATOR_PORT??9299}`,{disableWarnings:true});connectFirestoreEmulator(db,'127.0.0.1',Number(env.VITE_FIRESTORE_EMULATOR_PORT??8199));
 }
 await auth.authStateReady();if(!auth.currentUser)await signInAnonymously(auth);
 return {db,uid:auth.currentUser!.uid};
}
const connections=new Map<string,ReturnType<typeof connect>>();
/** Each shared-screen human owns a real, separately persisted anonymous Auth session. */
export function connectFirebase(profile?:string){
 const key=profile??'primary';let connection=connections.get(key);
 if(!connection){connection=connect(profile).catch(error=>{connections.delete(key);throw error;});connections.set(key,connection);}
 return connection;
}

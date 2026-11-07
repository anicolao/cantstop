import {existsSync,readdirSync} from 'node:fs';
export function javaEnv(){
 const env={...process.env};
 if(env.JAVA_HOME)return {...env,PATH:`${env.JAVA_HOME}/bin:${env.PATH}`};
 if(process.platform==='darwin'&&existsSync('/nix/store')){
  const jdk=readdirSync('/nix/store').find(n=>n.includes('jdk-21')&&existsSync(`/nix/store/${n}/bin/java`));
  if(jdk)return {...env,JAVA_HOME:`/nix/store/${jdk}`,PATH:`/nix/store/${jdk}/bin:${env.PATH}`};
 }
 return env;
}
export function emulatorEnv(kind:'local'|'e2e'){
 const project=`demo-cantstop-${kind}`;
 return {...javaEnv(),PUBLIC_BASE_PATH:'/',VITE_FIREBASE_API_KEY:'fake-api-key',VITE_FIREBASE_PROJECT_ID:project,VITE_FIREBASE_AUTH_DOMAIN:`${project}.firebaseapp.com`,VITE_FIREBASE_APP_ID:`${project}-app`,VITE_USE_FIREBASE_EMULATORS:'true',VITE_FIRESTORE_EMULATOR_PORT:kind==='local'?'8212':'8213',VITE_FIREBASE_AUTH_EMULATOR_PORT:kind==='local'?'9212':'9213',VITE_DICE_TOWER_EMULATOR_PORT:kind==='local'?'9012':'9013',VITE_PREVIEW_ID:kind};
}

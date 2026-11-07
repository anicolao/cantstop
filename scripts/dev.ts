import {emulatorEnv} from './environment';
const kind=process.argv[2]==='e2e'?'e2e':'local';
const useEmulators=kind==='e2e'||process.argv[2]==='local'||!process.env.VITE_FIREBASE_PROJECT_ID;
const vite=['bun','x','vite','--host','127.0.0.1','--port',kind==='e2e'?'5399':'5199','--strictPort'];
const command=useEmulators?['node','node_modules/firebase-tools/lib/bin/firebase.js','emulators:exec','--config',`firebase.${kind}.json`,'--project',`demo-cantstop-${kind}`,'--only','auth,firestore',vite.join(' ')]:vite;
const child=Bun.spawn(command,{env:useEmulators?emulatorEnv(kind):process.env,stdout:'inherit',stderr:'inherit'});
for(const signal of ['SIGINT','SIGTERM'] as const)process.on(signal,()=>child.kill(useEmulators?'SIGINT':signal));
process.exit(await child.exited);

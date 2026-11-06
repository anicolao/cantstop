import {existsSync,readdirSync} from 'node:fs';
let env={...process.env};
if(!env.JAVA_HOME&&process.platform==='darwin'&&existsSync('/nix/store')){
 const jdk=readdirSync('/nix/store').find(n=>n.includes('jdk-21')&&existsSync(`/nix/store/${n}/bin/java`));
 if(jdk)env={...env,JAVA_HOME:`/nix/store/${jdk}`,PATH:`/nix/store/${jdk}/bin:${env.PATH}`};
}
const child=Bun.spawn(['bun','x','firebase','emulators:exec','--config','firebase.test.json','--project','demo-cantstop','--only','firestore','bun test tests/firebase'],{env,stdout:'inherit',stderr:'inherit'});
process.on('SIGINT',()=>child.kill('SIGINT'));process.exit(await child.exited);

import {mkdirSync} from 'node:fs';
import {createRelay} from './relay';
mkdirSync('.data',{recursive:true});
const relay=createRelay(process.env.CANTSTOP_DB??'.data/cantstop.sqlite',Number(process.env.PORT??5200),process.env.HOST??'127.0.0.1');
console.log(`Can't Stop relay: http://${relay.server.hostname}:${relay.server.port}`);
for(const signal of ['SIGTERM','SIGINT'] as const)process.on(signal,()=>{relay.close();process.exit(0);});

import {apply, pairings, type State} from '../../src/lib/model/game';
import {choose,policies} from './policies';
import {mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
const start=Number(process.env.AI_SEED??75000000),games=Number(process.env.AI_GAMES??500),maxTurns=200;
const out=process.env.AI_OUTPUT??'docs/ai',streamPath=`/tmp/cantstop-streams-${start}-${games}.bin`;
mkdirSync(out,{recursive:true});
if(!existsSync(streamPath)){
 const proc=Bun.spawnSync(['python3','scripts/ai-comparison/streams.py',String(start),String(games),String(maxTurns),streamPath]);
 if(proc.exitCode)throw new Error(proc.stderr.toString());
}
const bytes=await Bun.file(streamPath).arrayBuffer(),streams=new DataView(bytes);
const decode=(i:number)=>[Math.floor(i/216)+1,Math.floor(i/36)%6+1,Math.floor(i/6)%6+1,i%6+1];
const names=(process.env.AI_POLICIES??'easy,yolo-035,balanced,board-0,board-80').split(',');
const sourceHashes=Object.fromEntries(await Promise.all(['run.ts','policies.ts','neural.ts','streams.py'].map(async file=>[file,createHash('sha256').update(await Bun.file(`scripts/ai-comparison/${file}`).bytes()).digest('hex')])));
let lookStreams:DataView|undefined;const lookTurns=100;
if(names.some(name=>policies.find(p=>p.name===name)?.samples)){
 const path=`/tmp/cantstop-lookahead-${start}-${games}.bin`;
 if(!existsSync(path)){
  const proc=Bun.spawnSync(['python3','scripts/ai-comparison/streams.py',String(start),String(games),String(lookTurns),path,'lookahead']);
  if(proc.exitCode)throw new Error(proc.stderr.toString());
 }
 lookStreams=new DataView(await Bun.file(path).arrayBuffer());
}
const opponents=process.env.AI_ROUND_ROBIN==='1'?names:(process.env.AI_OPPONENTS??'current').split(',');
const records:string[]=['policyA,policyB,gameId,swapped,winner,turns,aTurns,aBusts,aRolls,aBanks,aBankedSteps,bTurns,bBusts,bRolls,bBanks,bBankedSteps'];
const summaries:unknown[]=[];
for(let ai=0;ai<names.length;ai++)for(const bname of opponents){
 const aname=names[ai];if(aname===bname||process.env.AI_ROUND_ROBIN==='1'&&names.indexOf(bname)<ai)continue;
 const a=policies.find(p=>p.name===aname)!,b=policies.find(p=>p.name===bname)!;
 if(!a||!b)throw new Error('Unknown policy');
 let wins=0;const totals=[[0,0,0,0,0],[0,0,0,0,0]],byOrder=[0,0];
 // Each of 500 IDs is played twice with policies exchanged between seats.
 for(let i=0;i<games;i++)for(let swapped=0;swapped<2;swapped++){
  const gid=start+i,ownTurns=[0,0],stats=[[0,0,0,0,0],[0,0,0,0,0]];
  let g:State={version:1,seed:0,rollIndex:0,active:gid%2,phase:'ready',saved:[{},{},{},{}],runners:{},claims:[[],[],[],[]],dice:[1,1,1,1],lastOutcome:'none'};
  let turns=0;
  while(g.phase!=='finished'){
   if(turns>=maxTurns*2)throw new Error('Turn cap');
   const seat=g.active,policyIndex=seat^swapped,policy=policyIndex===0?a:b,own=ownTurns[seat]++;
   if(own>=maxTurns)throw new Error('Stream exhausted');
   stats[policyIndex][0]++;g={...g,rollIndex:0,phase:'decide'};
   while(true){
    const offset=(((i*2+seat)*maxTurns+own)*35+g.rollIndex)*2;
    g={...g,dice:decode(streams.getUint16(offset,true)),rollIndex:g.rollIndex+1,phase:'choose'};
    stats[policyIndex][2]++;
    // Match production legal actions; supply benchmark dice only, never expose future draws to policies.
    if(!pairings(g).some(p=>p.variants.length)){
     stats[policyIndex][1]++;g={...g,runners:{},active:1-seat,phase:'ready'};break;
    }
    g=apply(g,choose(g,policy));
    const look=policy.samples?Array.from({length:policy.samples},(_,k)=>{
     if(own>=lookTurns)throw new Error('Lookahead stream exhausted');
     return decode(lookStreams!.getUint16(((((i*2+seat)*lookTurns+own)*35+g.rollIndex-1)*16+k)*2,true));
    }):undefined;
    const intent=choose(g,policy,look);
    if(intent.type==='stop'){
     stats[policyIndex][3]++;
     stats[policyIndex][4]+=Object.entries(g.runners).reduce((sum,[c,n])=>sum+n-(g.saved[seat][+c]??0),0);
     const previousSaved=g.saved.map(s=>({...s})),banked={...g.runners};
     g=apply(g,intent);
     // Archive feature vectors retain closed progress, whereas production discards it.
     // Restore it only in this offline board so recovered neural inputs remain faithful.
     for(let p=0;p<2;p++)for(const c of g.claims.flat())g.saved[p][c]=p===seat&&banked[c]!==undefined?banked[c]:(previousSaved[p][c]??0);
     if(g.phase!=='finished')g.active=1-seat;break;
    }
   }
   turns++;
  }
  const winner=g.active^swapped;wins+=winner===0?1:0;byOrder[swapped]+=winner===0?1:0;
  for(let p=0;p<2;p++)for(let k=0;k<5;k++)totals[p][k]+=stats[p][k];
  records.push([aname,bname,gid,swapped,winner===0?aname:bname,turns,...stats[0],...stats[1]].join(','));
 }
 const result={a:aname,b:bname,games:games*2,wins,winRate:wins/(games*2),byOrder,stats:totals};
 summaries.push(result);console.log(JSON.stringify(result));
 await Bun.write(`${out}/results.json`,JSON.stringify({start,seedCount:games,seatOrders:2,sourceHashes,policyDefinitions:policies.filter(p=>names.includes(p.name)||opponents.includes(p.name)),streamSha256:createHash('sha256').update(new Uint8Array(bytes)).digest('hex'),summaries},null,2)+'\n');
 await Bun.write(`${out}/games.csv`,records.join('\n')+'\n');
}

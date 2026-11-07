// Cross-check the Bun adapter against the original ZIP's legal actions and exact EV.
import {type State} from '../../src/lib/model/game';
import {bust,choose,policies,successors,value} from './policies';
const boards:State[]=Array.from({length:20},(_,i)=>({
 version:1,seed:0,rollIndex:2,active:0,phase:'decide',
 saved:[{4:i%3,7:i%7,8:i%4,...(i%2?{2:3}:{})},{4:i%5,7:(i+2)%8,...(i%3?{}:{12:3})},{},{}],
 runners:{4:Math.min(7,i%3+2),7:Math.min(13,i%7+3),8:Math.min(11,i%4+1)},
 claims:[i%2?[2]:[],i%3?[]:[12],[],[]],dice:[i%6+1,(i+2)%6+1,(i+3)%6+1,(i+4)%6+1],lastOutcome:'none',
}));
const python=String.raw`
import json,sys
sys.path.insert(0,sys.argv[1])
import cant_stop_full_game as b
import cant_stop_shared_fate as sf
out=[]
for g in json.load(sys.stdin):
 perm={n:g['saved'][0].get(str(n),0) for n in b.L}
 opp={n:g['saved'][1].get(str(n),0) for n in b.L}
 claimed=set(g['claims'][0]);opclaimed=set(g['claims'][1]);closed=claimed|opclaimed
 temp={int(n):p-perm[int(n)] for n,p in g['runners'].items()}
 a,c,d,e=g['dice'];roll=((a+c,d+e),(a+d,c+e),(a+e,c+d))
 options=b.actions(roll,perm,temp,closed)
 positions=[{n:perm[n]+v for n,v in t.items()} for t in options]
 row={'positions':positions,'bust':b.bust_probability(temp,perm,closed),'values':{}}
 for bonus in ('0','80'):
  stop=sf.value(perm,opp,claimed,opclaimed,closed,temp,bonus)
  lost=sf.value(perm,opp,claimed,opclaimed,closed,{},bonus)
  total=0
  for roll in b.ROLLS:
   opts=b.actions(roll,perm,temp,closed)
   total+=max(sf.value(perm,opp,claimed,opclaimed,closed,s,bonus) for s in opts) if opts else lost
  row['values'][bonus]={'stop':stop,'again':total/1296>stop}
 out.append(row)
print(json.dumps(out))
`;
const proc=Bun.spawnSync(['python3','-c',python,process.argv[2]??'/tmp/cantstop-ai-handoff/artifacts'],{stdin:Buffer.from(JSON.stringify(boards))});
if(proc.exitCode)throw new Error(proc.stderr.toString());
const expected=JSON.parse(proc.stdout.toString()) as {positions:Record<number,number>[];bust:number;values:Record<string,{stop:number;again:boolean}>}[];
const key=(r:Record<number,number>)=>JSON.stringify(Object.entries(r).sort(([a],[b])=>+a-+b));
for(const [i,g] of boards.entries()){
 const actual=[...new Set(successors(g).map(s=>key(s.runners)))].sort(),want=expected[i].positions.map(key).sort();
 if(JSON.stringify(actual)!==JSON.stringify(want)||bust(g)!==expected[i].bust)throw new Error(`Rules differ on fixture ${i}`);
 for(const bonus of ['0','80']){
  const p=policies.find(p=>p.name===`board-${bonus}`)!,v=value(g,g.runners,p),e=expected[i].values[bonus];
  if(Math.abs(v-e.stop)>1e-9||(choose(g,p).type==='roll')!==e.again)throw new Error(`Value/EV differs on fixture ${i}, bonus ${bonus}`);
 }
}
console.log('20 board fixtures: legal successors, bust probabilities, board values, and exact stopping match archive.');

import {readFileSync} from 'node:fs';
import {lengthOf,type State,type Positions} from '../../src/lib/model/game';
type Model={sha256:string;weights:Record<string,number[]|number[][]>};
const models=new Map<string,Model>();
export function model(name:string){
 if(!models.has(name))models.set(name,JSON.parse(readFileSync(`${process.env.AI_MODEL_DIR??'/tmp/cantstop-ai-models'}/${name}.json`,'utf8')) as Model);
 return models.get(name)!;
}
export function encode(g:State,r:Positions,bank=false,phase=0){
 const own=g.active,other=1-own,claimed=new Set(g.claims[own]),closed=new Set(g.claims.flat());
 if(bank)for(const key in r)if(r[+key]===lengthOf(+key)){claimed.add(+key);closed.add(+key);}
 const x:number[]=[];
 for(let n=2;n<=12;n++){
  // The archive retains both players' saved progress after a column closes.
  // Models require it too; the runner supplies a historical saved-position shadow.
  const saved=g.saved[own][n]??0,opp=g.saved[other][n]??0;
  x.push((bank?(r[n]??saved):saved)/lengthOf(n),opp/lengthOf(n),bank?0:(r[n]===undefined?0:r[n]-saved)/lengthOf(n),Number(claimed.has(n)),Number(g.claims[other].includes(n)),Number(closed.has(n)),bank?0:Number(r[n]!==undefined));
 }
 x.push(claimed.size/3,g.claims[other].length/3,bank?0:Object.keys(r).length/3,phase,0,0,0,0);
 return x;
}
function layer(m:Model,key:string,x:number[],tanh=false){
 const weights=m.weights[`${key}.weight`] as number[][],bias=m.weights[`${key}.bias`] as number[];
 return weights.map((row,i)=>{let v=bias[i];for(let j=0;j<row.length;j++)v+=row[j]*x[j];return tanh?Math.tanh(v):v;});
}
export function prediction(name:string,x:number[],head:'pair'|'stop'='pair'){
 const m=model(name);
 if(name==='imitation'||name==='rl'){
  const hidden=layer(m,'trunk.2',layer(m,'trunk.0',x,true),true);
  const y=layer(m,head,hidden);return head==='pair'?y[0]:y[1]-y[0];
 }
 return layer(m,'4',layer(m,'2',layer(m,'0',x,true),true))[0];
}

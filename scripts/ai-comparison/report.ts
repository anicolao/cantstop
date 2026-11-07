import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
type Summary={a:string;b:string;games:number;wins:number;winRate:number;stats:number[][]};
const root='docs/ai';
const paths=[root,...readdirSync(root,{withFileTypes:true}).filter(d=>d.isDirectory()).map(d=>join(root,d.name))];
const rows:string[]=['| Dataset | A | B | A wins | Seed-clustered 95% interval | A busts/turn | A rolls/turn |','|---|---|---|---:|---:|---:|---:|'];
for(const path of paths){
 const data=JSON.parse(readFileSync(join(path,'results.json'),'utf8')) as {summaries:Summary[]};
 const games=readFileSync(join(path,'games.csv'),'utf8').trim().split('\n').slice(1).map(line=>line.split(','));
 for(const s of data.summaries){
  const bySeed=new Map<string,number[]>();
  for(const g of games)if(g[0]===s.a&&g[1]===s.b){const arr=bySeed.get(g[2])??[];arr.push(Number(g[4]===s.a));bySeed.set(g[2],arr);}
  const pairs=[...bySeed.values()].map(g=>g.reduce((a,b)=>a+b,0)/g.length);
  if(pairs.length!==500)throw new Error(`Missing seed pairs: ${path} ${s.a} ${s.b}`);
  const variance=pairs.reduce((sum,p)=>sum+(p-s.winRate)**2,0)/(pairs.length-1),margin=1.96*Math.sqrt(variance/pairs.length);
  const [turns,busts,rolls]=s.stats[0];
  rows.push(`| ${path===root?'baseline':path.slice(root.length+1)} | ${s.a} | ${s.b} | ${(100*s.winRate).toFixed(1)}% (${s.wins}/${s.games}) | ${(100*Math.max(0,s.winRate-margin)).toFixed(1)}–${(100*Math.min(1,s.winRate+margin)).toFixed(1)}% | ${(100*busts/turns).toFixed(1)}% | ${(rolls/turns).toFixed(2)} |`);
 }
}
writeFileSync(`${root}/ALL_RESULTS.md`,rows.join('\n')+'\n');

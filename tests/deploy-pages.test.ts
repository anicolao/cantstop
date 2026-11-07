import {afterEach,expect,test} from 'bun:test';
import {mkdtemp,rm,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {deployPages,publishedFiles,verifyPublished,ENTRY_ROUTES,type GitHub} from '../scripts/deploy-pages';
const sha='a'.repeat(40),otherSha='b'.repeat(40),repo='owner/game';
const run=(id:number,status='in_progress',conclusion:string|null=null,head_sha=sha)=>({id,status,conclusion,head_sha,html_url:`https://github.com/${repo}/actions/runs/${id}`});
const fakeClock=()=>{let now=0;return {now:()=>now,sleep:async(ms:number)=>{now+=ms;},log:()=>{}};};
function server(batches:ReturnType<typeof run>[][]){
 let reads=0,requests=0;
 const api:GitHub=async(path,method='GET')=>{
  if(path===`repos/${repo}/pages`)return {build_type:'legacy',html_url:'https://owner.github.io/game/',source:{branch:'gh-pages',path:'/'}};
  if(path.endsWith('/git/ref/heads/gh-pages'))return {object:{sha}};
  if(path.endsWith('/actions/workflows?per_page=100'))return {workflows:[{id:42,path:'dynamic/pages/pages-build-deployment'}]};
  if(path===`repos/${repo}/pages/builds`&&method==='POST'){requests++;return {status:'queued'};}
  if(path.includes(`/actions/workflows/42/runs?head_sha=${sha}&`))return {workflow_runs:batches[Math.min(reads++,batches.length-1)]};
  throw new Error(`Unexpected request: ${method} ${path}`);
 };
 return {api,requests:()=>requests};
}
const waitOptions=()=>({clock:fakeClock(),interval:10,timeout:100,cancelGrace:20});
test('queue acceptance is not deployment success; wait for the exact published commit',async()=>{
 const s=server([[run(1,'completed','success',otherSha)],[run(2,'queued')],[run(2)],[run(2,'completed','success')]]);
 const result=await deployPages(s.api,repo,'pr5',waitOptions());
 expect(s.requests()).toBe(1);expect(result.sha).toBe(sha);expect(result.run.id).toBe(2);expect(result.url).toBe('https://owner.github.io/game/pr5/');
});
test('reuse the automatic matching deployment without issuing a cancelling duplicate request',async()=>{
 const s=server([[run(2)],[run(2,'completed','success')]]);
 expect((await deployPages(s.api,repo,'',waitOptions())).run.id).toBe(2);expect(s.requests()).toBe(0);
});
test('an old failed deployment cannot satisfy a new request',async()=>{
 const s=server([[run(1,'completed','failure')],[run(1,'completed','failure'),run(2)],[run(2,'completed','success')]]);
 expect((await deployPages(s.api,repo,'',waitOptions())).run.id).toBe(2);expect(s.requests()).toBe(1);
});
test('actual deployment failures fail publication with the Actions run link',async()=>{
 const s=server([[],[run(2,'completed','failure')]]);
 await expect(deployPages(s.api,repo,'',waitOptions())).rejects.toThrow('Pages deployment failed: https://github.com/owner/game/actions/runs/2');
});
test('a queued run or wrong-commit success times out instead of going green',async()=>{
 for(const runs of [[run(2,'queued')],[run(2,'completed','success',otherSha)]]){
  const s=server([[],runs]);await expect(deployPages(s.api,repo,'',waitOptions())).rejects.toThrow('Pages deployment timed out');
 }
});
test('allow a cancelled duplicate to be superseded, but fail a terminal cancellation',async()=>{
 const replaced=server([[],[run(2,'completed','cancelled')],[run(2,'completed','cancelled'),run(3)],[run(3,'completed','success')]]);
 expect((await deployPages(replaced.api,repo,'',waitOptions())).run.id).toBe(3);
 const cancelled=server([[],[run(2,'completed','cancelled')]]);
 await expect(deployPages(cancelled.api,repo,'',waitOptions())).rejects.toThrow('Pages deployment cancelled');
});
const bytes=(text:string)=>new TextEncoder().encode(text);
const expected=new Map([['',bytes('html')],['tt/',bytes('tabletop')],['deployment.json',bytes('new run')],['assets/main.js',bytes('new js')]]);
const response=(url:string|URL|Request,body:string,status=200)=>new Response(body,{status});
test('live verification waits for fresh marker bytes and keeps public requests unauthenticated',async()=>{
 let fresh=false;const requests:URL[]=[];
 const c=fakeClock(),request=(async(url,init)=>{
  const u=new URL(String(url));requests.push(u);expect(new Headers(init?.headers).has('Authorization')).toBe(false);expect(u.searchParams.has('__deployment')).toBe(true);
  const path=u.pathname.slice('/game/pr5/'.length);
  const body=path==='deployment.json'&&!fresh?bytes('previous run'):expected.get(path)!;
  return new Response(body);
 }) as typeof fetch;
 await verifyPublished('https://owner.github.io/game/pr5/',expected,{request,clock:{...c,sleep:async ms=>{fresh=true;await c.sleep(ms);}},interval:10,timeout:100});
 expect(requests.length).toBe(8);
});
test('HTTP 200 with stale build contents still fails publication',async()=>{
 const request=(async url=>response(url,'old content')) as typeof fetch;
 await expect(verifyPublished('https://owner.github.io/game/pr5/',expected,{request,clock:fakeClock(),interval:10,timeout:20})).rejects.toThrow('served bytes differ');
});
test('a missing JS asset or tabletop route fails even when the main page and marker are correct',async()=>{
 for(const missing of ['assets/main.js','tt/']){
  const request=(async url=>{
   const path=new URL(String(url)).pathname.slice('/game/pr5/'.length);
   return path===missing?response(url,'not found',404):new Response(expected.get(path)!);
  }) as typeof fetch;
  await expect(verifyPublished('https://owner.github.io/game/pr5/',expected,{request,clock:fakeClock(),interval:10,timeout:20})).rejects.toThrow(`${missing}: HTTP 404`);
 }
});
const temporary:string[]=[];
afterEach(async()=>{await Promise.all(temporary.splice(0).map(path=>rm(path,{recursive:true,force:true})));});
test('collect the real entry routes, unique marker, and referenced build assets',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'cantstop-pages-'));temporary.push(directory);
 const html='<script src="/game/pr5/assets/main.js"></script><link href="/game/pr5/assets/main.css">';
 for(const route of ENTRY_ROUTES){await mkdir(join(directory,route),{recursive:true});await writeFile(join(directory,route,'index.html'),html);}
 await mkdir(join(directory,'assets'));await writeFile(join(directory,'assets/main.js'),'js');await writeFile(join(directory,'assets/main.css'),'css');await writeFile(join(directory,'deployment.json'),'stamp');
 const files=await publishedFiles(directory,'https://owner.github.io/game/pr5/');
 expect([...files.keys()]).toEqual([...ENTRY_ROUTES,'deployment.json','assets/main.js','assets/main.css']);
 await writeFile(join(directory,'index.html'),'<script src="/game/assets/wrong-base.js"></script>');
 await expect(publishedFiles(directory,'https://owner.github.io/game/pr5/')).rejects.toThrow('outside the published namespace');
});

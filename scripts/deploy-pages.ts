import {appendFileSync} from 'node:fs';
import {join} from 'node:path';
export type GitHub=(endpoint:string,method?:'GET'|'POST')=>Promise<unknown>;
type Run={id:number;head_sha:string;status:string;conclusion:string|null;html_url:string};
type Clock={now:()=>number;sleep:(ms:number)=>Promise<void>;log:(message:string)=>void};
const clock:Clock={now:Date.now,sleep:ms=>Bun.sleep(ms),log:console.log};
type WaitOptions={timeout?:number;interval?:number;cancelGrace?:number;clock?:Clock};
/** Wait for the real deployment workflow, not the Pages API's queued receipt. */
export async function deployPages(api:GitHub,repo:string,destination='',options:WaitOptions={}){
 if(!/^[\w.-]+\/[\w.-]+$/.test(repo)||destination!==''&&!/^pr\d+$/.test(destination))throw new Error('Invalid repository or preview destination.');
 const pages=await api(`repos/${repo}/pages`) as {build_type:string;html_url:string;source:{branch:string;path:string}};
 if(pages.build_type!=='legacy'||pages.source?.branch!=='gh-pages'||pages.source.path!=='/')throw new Error('This publisher requires Pages to serve gh-pages from its root.');
 const {object:{sha}}=await api(`repos/${repo}/git/ref/heads/gh-pages`) as {object:{sha:string}};
 const {workflows}=await api(`repos/${repo}/actions/workflows?per_page=100`) as {workflows:{id:number;path:string}[]};
 const workflow=workflows.find(w=>w.path==='dynamic/pages/pages-build-deployment');
 if(!workflow)throw new Error('GitHub Pages deployment workflow was not found.');
 const endpoint=`repos/${repo}/actions/workflows/${workflow.id}/runs?head_sha=${sha}&per_page=100`;
 const runs=async()=>((await api(endpoint)) as {workflow_runs:Run[]}).workflow_runs.filter(r=>r.head_sha===sha);
 // Reuse an automatic deployment of this exact commit instead of cancelling it
 // with a duplicate request. Otherwise exclude runs predating our new request.
 const existing=(await runs()).sort((a,b)=>b.id-a.id)[0];
 const reuse=existing&&(existing.status!=='completed'||existing.conclusion==='success');
 const previous=reuse?existing.id-1:(existing?.id??0);
 if(!reuse)await api(`repos/${repo}/pages/builds`,'POST');
 const c=options.clock??clock,deadline=c.now()+(options.timeout??15*60_000),interval=options.interval??10_000;
 let last='',cancelled:{id:number;at:number}|undefined;
 while(c.now()<deadline){
  const run=(await runs()).filter(r=>r.id>previous).sort((a,b)=>b.id-a.id)[0];
  const status=run?`${run.html_url}: ${run.status}${run.conclusion?` (${run.conclusion})`:''}`:`Waiting for a new Pages deployment of ${sha}`;
  if(status!==last){c.log(status);last=status;}
  if(run?.status==='completed'){
   if(run.conclusion==='success'){
    const root=new URL(pages.html_url);if(!root.pathname.endsWith('/'))root.pathname+='/';
    return {sha,run,url:new URL(destination?`${destination}/`:'',root).href};
   }
   // GitHub can cancel an automatic duplicate while a replacement is appearing.
   if(run.conclusion!=='cancelled')throw new Error(`Pages deployment failed: ${status}`);
   if(cancelled?.id!==run.id)cancelled={id:run.id,at:c.now()};
   if(c.now()-cancelled.at>=(options.cancelGrace??30_000))throw new Error(`Pages deployment cancelled: ${status}`);
  }
  await c.sleep(interval);
 }
 throw new Error(`Pages deployment timed out: ${last}`);
}
export const ENTRY_ROUTES=['','tt/','gallery/','dev/animations/','dev/components/'];
/** Compare every entry route plus the marker and the entry HTML's JS/CSS assets. */
export async function publishedFiles(directory:string,baseUrl:string){
 const files=new Map<string,Uint8Array>(),base=new URL(baseUrl);
 for(const route of ENTRY_ROUTES)files.set(route,await Bun.file(join(directory,route,'index.html')).bytes());
 files.set('deployment.json',await Bun.file(join(directory,'deployment.json')).bytes());
 const html=new TextDecoder().decode(files.get('')!);
 const assets=[...html.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css))["']/g)];
 if(!assets.length)throw new Error('Built HTML has no JavaScript or CSS assets to verify.');
 for(const [,path] of assets){
  const url=new URL(path,base);
  if(url.origin!==base.origin||!url.pathname.startsWith(base.pathname))throw new Error(`Asset is outside the published namespace: ${path}`);
  const relative=url.pathname.slice(base.pathname.length);files.set(relative,await Bun.file(join(directory,relative)).bytes());
 }
 return files;
}
export async function verifyPublished(baseUrl:string,files:Map<string,Uint8Array>,options:{timeout?:number;interval?:number;clock?:Clock;request?:typeof fetch}={}){
 const c=options.clock??clock,request=options.request??fetch,deadline=c.now()+(options.timeout??120_000);let last='';
 while(c.now()<deadline){
  const results=await Promise.allSettled([...files].map(async([path,expected])=>{
   const url=new URL(path,baseUrl);url.searchParams.set('__deployment',String(c.now()));
   const response=await request(url,{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(10_000)});
   if(response.status!==200)throw new Error(`${path||'/'}: HTTP ${response.status}`);
   if(!Buffer.from(await response.arrayBuffer()).equals(Buffer.from(expected)))throw new Error(`${path||'/'}: served bytes differ from this build`);
  }));
  const errors=results.flatMap(r=>r.status==='rejected'?[String(r.reason)]:[]);
  if(!errors.length){c.log(`Verified live build: ${baseUrl}`);return;}
  const failure=errors.join('; ');if(failure!==last){c.log(failure);last=failure;}
  await c.sleep(options.interval??10_000);
 }
 throw new Error(`Live Pages verification timed out: ${last}`);
}
if(import.meta.main){
 try{
  const directory=process.env.ARTIFACT_DIR??'dist';
  if(process.argv[2]==='stamp'){
   const {GITHUB_SHA:commit,GITHUB_RUN_ID:runId,GITHUB_RUN_ATTEMPT:runAttempt}=process.env;
   if(!commit||!runId||!runAttempt)throw new Error('Deployment stamp requires the GitHub commit, run ID, and attempt.');
   await Bun.write(join(directory,'deployment.json'),JSON.stringify({commit,runId,runAttempt})+'\n');
  }else if(process.argv[2]==='deploy'){
   const token=process.env.GH_TOKEN,repo=process.env.GITHUB_REPOSITORY;if(!token||!repo)throw new Error('GH_TOKEN and GITHUB_REPOSITORY are required.');
   const api:GitHub=async(endpoint,method='GET')=>{
    const response=await fetch(`https://api.github.com/${endpoint}`,{method,headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},signal:AbortSignal.timeout(30_000)});
    if(!response.ok)throw new Error(`GitHub ${method} ${endpoint}: HTTP ${response.status}`);
    return response.json();
   };
   const deployment=await deployPages(api,repo,process.env.PREVIEW_DESTINATION??'');
   await verifyPublished(deployment.url,await publishedFiles(directory,deployment.url));
   if(process.env.GITHUB_OUTPUT)appendFileSync(process.env.GITHUB_OUTPUT,`url=${deployment.url}\n`);
   if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,`### Pages deployment verified\n\n[Live site](${deployment.url}) · [Successful deployment](${deployment.run.html_url})\n\nPublished commit: \`${deployment.sha}\`\n`);
  }else throw new Error('Use stamp or deploy.');
 }catch(error){console.error(`::error::${(error as Error).message}`);process.exitCode=1;}
}

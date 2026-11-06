import {Database} from 'bun:sqlite';
import {apply,replay,parseIntent,type Event} from '../src/game/engine';
export function createRelay(database=':memory:',port=5200,hostname='127.0.0.1',staticRoot='dist'){
 const db=new Database(database,{create:true});db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS events(room TEXT NOT NULL, sequence INTEGER NOT NULL, id TEXT NOT NULL, body TEXT NOT NULL, PRIMARY KEY(room,sequence), UNIQUE(room,id))');
 const listeners=new Map<string,Set<(events:Event[])=>void>>();
 const read=(room:string)=>db.query('SELECT body FROM events WHERE room=? ORDER BY sequence').all(room).map(row=>JSON.parse((row as {body:string}).body) as Event);
 const append=db.transaction((room:string,body:{actor:string;id:string;expectedRevision:number;intent:unknown})=>{
  if(!body||Object.keys(body).sort().join(',')!=='actor,expectedRevision,id,intent'||typeof body.actor!=='string'||typeof body.id!=='string'||!/^[\w-]{1,128}$/.test(body.id)||!Number.isInteger(body.expectedRevision))throw new Error('Choose an action.');
  const intent=parseIntent(body.intent),events=read(room),existing=events.find(e=>e.id===body.id);
  if(existing){if(existing.actor!==body.actor||JSON.stringify(existing.intent)!==JSON.stringify(intent))throw new Error('That action has already been used.');return events;}
  if(body.expectedRevision!==events.length)throw new Error('The table changed. Try again.');
  const state=replay(events);apply(state,body.actor,intent);
  const event:Event={version:state.protocol,id:body.id,sequence:events.length+1,actor:body.actor,intent};
  db.query('INSERT INTO events(room,sequence,id,body) VALUES(?,?,?,?)').run(room,event.sequence,event.id,JSON.stringify(event));return [...events,event];
 });
 const server=Bun.serve({port,hostname,idleTimeout:0,maxRequestBodySize:4096,async fetch(request){
  const url=new URL(request.url),match=url.pathname.match(/^\/api\/tables\/([A-Z0-9]{5,8})(\/events)?$/);
  if(match){
   const room=match[1];
   if(request.method==='GET'&&match[2]){
    let unsubscribe=()=>{};
    const stream=new ReadableStream({start(controller){
     const send=(events:Event[])=>{try{controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(events)}\n\n`));}catch{unsubscribe();}};
     const set=listeners.get(room)??new Set();set.add(send);listeners.set(room,set);unsubscribe=()=>{set.delete(send);if(set.size===0)listeners.delete(room);};
     request.signal.addEventListener('abort',unsubscribe,{once:true});send(read(room));
    },cancel(){unsubscribe();}});
    return new Response(stream,{headers:{'Content-Type':'text/event-stream','Cache-Control':'no-cache','X-Accel-Buffering':'no'}});
   }
   if(request.method==='GET')return Response.json(read(room),{headers:{'Cache-Control':'no-store'}});
   if(request.method==='POST'){
    // Browser requests stay same-origin; the relay deliberately trusts named clients.
    if(request.headers.get('sec-fetch-site')==='cross-site')return new Response('Use your invitation.',{status:403});
    try{const events=append(room,await request.json());for(const send of listeners.get(room)??[])send(events);return Response.json(events);}
    catch(error){return Response.json({error:(error as Error).message},{status:409});}
   }
   return new Response('Choose an action.',{status:405});
  }
  if(url.pathname==='/api/health')return Response.json({ready:true});
  const pathname=decodeURIComponent(url.pathname);if(pathname.includes('..'))return new Response('Not found',{status:404});
  const file=Bun.file(`${staticRoot}${pathname}`);if(await file.exists())return new Response(file);
  if(!pathname.includes('.')||pathname==='/')return new Response(Bun.file(`${staticRoot}/index.html`));
  return new Response('Not found',{status:404});
 }});
 return {server,read,close(){server.stop(true);db.close();}};
}

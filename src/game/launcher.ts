import type {Intent,State} from './engine';
export type Launch={mode:'create'|'join';table:string;name:string;returnTo:string|null};
/** URL values are launch preferences, never Firebase identities or game events. */
export function readLaunch(search:string):Launch|null{
 const params=new URLSearchParams(search),mode=params.get('launch');
 if(mode===null)return null;
 if(mode!=='create'&&mode!=='join')throw new Error('This game invitation needs a create or join instruction.');
 const table=params.get('table')??'',name=(params.get('name')??'').trim();
 if(!/^[A-Z0-9]{5,8}$/.test(table)||!name||name.length>24)throw new Error('This game invitation needs a table and a name of up to 24 characters.');
 let returnTo:string|null=null;
 const destination=params.get('returnTo');
 if(destination){
  try{const url=new URL(destination);if(['http:','https:'].includes(url.protocol)&&!url.username&&!url.password)returnTo=url.href;}catch{/* An invalid return link never prevents joining a valid table. */}
 }
 return {mode,table,name,returnTo};
}
export function launchIntent(launch:Launch,state:State,viewer:string):Intent|null{
 if(state.players.some(p=>p.id===viewer))return null;
 if(launch.mode==='create'){
  if(state.revision)throw new Error('This table already belongs to someone else. Set a new table in your room.');
  return {type:'create',name:launch.name};
 }
 // A guest must never become host merely by arriving first.
 if(!state.revision)return null;
 if(state.phase!=='gathering')throw new Error('This game has already begun. Ask your friends to start another round.');
 if(state.players.length>=4)throw new Error('This table is full.');
 return {type:'join',name:launch.name};
}

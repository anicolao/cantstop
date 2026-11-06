import {apply as advanceGame,pairings,type State as BoardState,type Intent as BoardIntent} from '../lib/model/game';
export const VERSION=1 as const;
export type Intent={type:'create';name:string}|{type:'join';name:string}|{type:'invite-bot';id:string;name:string}|{type:'begin';seed:string}|BoardIntent;
export type Player={id:string;name:string;bot:boolean};
export type State={protocol:1;revision:number;host:string;players:Player[];phase:'gathering'|'playing'|'finished';seed:string;game:BoardState|null;winner:string|null};
export type Event={version:1;sequence:number;id:string;actor:string;intent:Intent};
const requireChoice=(ok:unknown,message:string)=>{if(!ok)throw new Error(message);};
export const initialState=():State=>({protocol:VERSION,revision:0,host:'',players:[],phase:'gathering',seed:'',game:null,winner:null});
/** Versioned FNV-1a seed derivation; v1 dice use the prototype's frozen PRNG. */
export function seedNumber(seed:string){let h=2166136261;for(let i=0;i<seed.length;i++){h^=seed.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
export function parseIntent(value:unknown):Intent{
 requireChoice(!!value&&typeof value==='object'&&!Array.isArray(value),'Choose an action.');
 const v=value as Record<string,unknown>;
 const fields:Record<string,string[]>={create:['name'],join:['name'],'invite-bot':['id','name'],begin:['seed'],roll:[],advance:['pairing'],stop:[]};
 requireChoice(typeof v.type==='string'&&Object.hasOwn(fields,v.type),'Choose an action.');
 const expected=['type',...fields[v.type as string],...(v.type==='advance'&&Object.hasOwn(v,'column')?['column']:[])];
 requireChoice(Object.keys(v).length===expected.length&&expected.every(k=>Object.hasOwn(v,k)),'That action has unexpected details.');
 if('name'in v)requireChoice(typeof v.name==='string'&&v.name.trim().length>0&&v.name.trim().length<=24,'Choose a name of 1–24 characters.');
 if('id'in v)requireChoice(typeof v.id==='string'&&/^bot-[\w-]{1,80}$/.test(v.id),'Choose a companion.');
 if('seed'in v)requireChoice(typeof v.seed==='string'&&v.seed.length>0&&v.seed.length<=96,'Choose a new game.');
 if('pairing'in v)requireChoice(Number.isInteger(v.pairing)&&Number(v.pairing)>=0&&Number(v.pairing)<=2,'Choose a dice pairing.');
 if('column'in v)requireChoice(Number.isInteger(v.column)&&Number(v.column)>=2&&Number(v.column)<=12,'Choose a runner destination.');
 return structuredClone(v) as Intent;
}
export function apply(state:State,actor:string,input:Intent):State{
 requireChoice(typeof actor==='string'&&/^[\w-]{1,128}$/.test(actor),'Take your own seat.');
 const intent=parseIntent(input),next=structuredClone(state),seat=state.players.findIndex(p=>p.id===actor);
 if(intent.type==='create'||intent.type==='join'){
  requireChoice(state.phase==='gathering'&&seat<0&&state.players.length<4,'That seat is not available.');
  requireChoice(intent.type==='create'?state.revision===0:state.players.length>0,'Wait for the host to open this table.');
  if(intent.type==='create')next.host=actor;
  next.players.push({id:actor,name:intent.name.trim(),bot:false});
 }else if(intent.type==='invite-bot'){
  requireChoice(actor===state.host&&state.phase==='gathering'&&state.players.length<4&&!state.players.some(p=>p.id===intent.id),'That seat is not available.');
  next.players.push({id:intent.id,name:intent.name.trim(),bot:true});
 }else if(intent.type==='begin'){
  requireChoice(actor===state.host&&state.players.length>=2&&['gathering','finished'].includes(state.phase),'Only the host can start once at least two players are seated.');
  next.seed=intent.seed;next.winner=null;next.phase='playing';
  next.game={version:1,seed:seedNumber(intent.seed),rollIndex:0,active:0,phase:'ready',saved:[{},{},{},{}],runners:{},claims:[[],[],[],[]],dice:[1,1,1,1],lastOutcome:'none'};
 }else{
  requireChoice(state.phase==='playing'&&state.game&&seat===state.game.active,'Wait for your turn.');
  const before=state.game!;
  next.game=advanceGame(before,intent);
  if((intent.type==='stop'||next.game.lastOutcome==='bust')&&next.game.phase!=='finished')next.game.active=(before.active+1)%state.players.length;
  if(next.game.phase==='finished'){next.phase='finished';next.winner=state.players[before.active].id;}
 }
 next.revision++;return next;
}
export function replay(events:readonly Event[],visit?:(before:State,after:State,event:Event)=>void){
 requireChoice(Array.isArray(events),'Choose a game log.');
 let state=initialState();const ids=new Set<string>();
 for(const event of events){
  requireChoice(event&&Object.keys(event).sort().join(',')==='actor,id,intent,sequence,version'&&event.version===VERSION&&event.sequence===state.revision+1&&typeof event.id==='string'&&/^[\w-]{1,128}$/.test(event.id)&&!ids.has(event.id),'This game log is not a supported, ordered intent history.');
  ids.add(event.id);const before=state;state=apply(state,event.actor,event.intent);visit?.(before,state,event);
 }
 return state;
}
export function chooseBot(state:State):BoardIntent|null{
 const game=state.game;if(!game||state.phase!=='playing'||!state.players[game.active]?.bot)return null;
 if(game.phase==='ready')return {type:'roll'};
 if(game.phase==='choose'){
  const choices=pairings(game).flatMap(p=>p.variants.map(v=>({p,v,value:Object.entries(v.moves).reduce((sum,[c,n])=>sum+n+(game.runners[+c]??game.saved[game.active][+c]??0)+(+c===2||+c===12?2:0),0)}))).sort((a,b)=>b.value-a.value);
  const choice=choices[0];return choice?{type:'advance',pairing:choice.p.index,...(choice.p.variants.length>1?{column:choice.v.column!}:{})}:null;
 }
 if(game.phase==='decide'){
  const risk=Object.entries(game.runners).reduce((n,[c,p])=>n+p-(game.saved[game.active][+c]??0),0);
  const summit=Object.entries(game.runners).some(([c,p])=>p===[3,5,7,9,11,13,11,9,7,5,3][+c-2]);
  return {type:summit||risk>=5?'stop':'roll'};
 }
 return null;
}

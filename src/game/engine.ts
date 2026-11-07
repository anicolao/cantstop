import {apply as advanceGame,pairings,type State as BoardState,type Intent as BoardIntent} from '../lib/model/game';
import {chooseCompanion,isBotLevel,type BotLevel} from './companion';
import {COLOUR_NAMES,SEAT_IDS,type SeatId} from './seating';
export const VERSION=2 as const;
export type Protocol=1|2|3;
export type Intent={type:'create';name:string}|{type:'join';name:string}|{type:'invite-bot';id:string;name:string;level?:BotLevel;colour?:number}|{type:'begin';seed:string}|{type:'sit';seat:SeatId;colour:number}|BoardIntent;
export type Player={id:string;name:string;bot:boolean;level?:BotLevel;colour?:number;seat?:SeatId};
export type State={protocol:Protocol;turnRolls:number;choice:{before:BoardState;pairing:number;column?:number}|null;revision:number;host:string;players:Player[];phase:'gathering'|'playing'|'finished';seed:string;game:BoardState|null;winner:string|null};
export type Event={version:Protocol;sequence:number;id:string;actor:string;intent:Intent};
const requireChoice=(ok:unknown,message:string)=>{if(!ok)throw new Error(message);};
export const initialState=(protocol:Protocol=VERSION):State=>({protocol,turnRolls:0,choice:null,revision:0,host:'',players:[],phase:'gathering',seed:'',game:null,winner:null});
/** Versioned FNV-1a seed derivation; v1 dice use the prototype's frozen PRNG. */
export function seedNumber(seed:string){let h=2166136261;for(let i=0;i<seed.length;i++){h^=seed.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
export function parseIntent(value:unknown):Intent{
 requireChoice(!!value&&typeof value==='object'&&!Array.isArray(value),'Choose an action.');
 const v=value as Record<string,unknown>;
 const fields:Record<string,string[]>={sit:['seat','colour'],create:['name'],join:['name'],'invite-bot':['id','name'],begin:['seed'],roll:[],advance:['pairing'],stop:[]};
 requireChoice(typeof v.type==='string'&&Object.hasOwn(fields,v.type),'Choose an action.');
 const expected=['type',...fields[v.type as string],...(v.type==='invite-bot'?['level','colour'].filter(k=>Object.hasOwn(v,k)):[]),...(v.type==='advance'&&Object.hasOwn(v,'column')?['column']:[])];
 requireChoice(Object.keys(v).length===expected.length&&expected.every(k=>Object.hasOwn(v,k)),'That action has unexpected details.');
 if(v.type==='sit')requireChoice(SEAT_IDS.includes(v.seat as SeatId)&&Number.isInteger(v.colour)&&Number(v.colour)>=0&&Number(v.colour)<4,'Choose a place and colour.');
 if('level'in v)requireChoice(isBotLevel(v.level),'Choose Easy, Yolo, Standard, or Hard.');
 if(v.type==='invite-bot'&&'colour'in v)requireChoice(Number.isInteger(v.colour)&&Number(v.colour)>=0&&Number(v.colour)<4,'Choose an available colour.');
 if('name'in v)requireChoice(typeof v.name==='string'&&v.name.trim().length>0&&v.name.trim().length<=24,'Choose a name of 1–24 characters.');
 if('id'in v)requireChoice(typeof v.id==='string'&&/^bot-[\w-]{1,80}$/.test(v.id),'Choose a companion.');
 if('seed'in v)requireChoice(typeof v.seed==='string'&&v.seed.length>0&&v.seed.length<=96,'Choose a new game.');
 if('pairing'in v)requireChoice(Number.isInteger(v.pairing)&&Number(v.pairing)>=0&&Number(v.pairing)<=2,'Choose a dice pairing.');
 if('column'in v)requireChoice(Number.isInteger(v.column)&&Number(v.column)>=2&&Number(v.column)<=12,'Choose a runner destination.');
 return structuredClone(v) as Intent;
}
export type BoardChange={before:BoardState;after:BoardState;action:BoardIntent['type'];replacement:boolean};
/** Derived board steps for presentation; never persisted as game events. */
export function evolve(state:State,actor:string,input:Intent):{state:State;changes:BoardChange[]}{
 requireChoice(typeof actor==='string'&&/^[\w-]{1,128}$/.test(actor),'Take your own seat.');
 const intent=parseIntent(input),next=structuredClone(state),seat=state.players.findIndex(p=>p.id===actor),changes:BoardChange[]=[];
 const change=(before:BoardState,after:BoardState,action:BoardIntent['type'],replacement=false)=>{next.game=after;changes.push({before,after,action,replacement});};
 if(intent.type==='sit'){
  requireChoice((state.protocol===3||state.revision===0)&&state.phase==='gathering'&&seat<0&&state.players.length<4,'Choose an empty place.');
  requireChoice(!state.players.some(p=>p.colour===intent.colour||p.seat===intent.seat),'That place or colour is taken.');
  next.protocol=3;if(!state.revision)next.host=actor;
  next.players.push({id:actor,name:COLOUR_NAMES[intent.colour],bot:false,colour:intent.colour,seat:intent.seat});
 }else if(intent.type==='create'||intent.type==='join'){
  requireChoice(state.protocol!==3,'Choose a colour on the table.');
  requireChoice(state.phase==='gathering'&&seat<0&&state.players.length<4,'That seat is not available.');
  requireChoice(intent.type==='create'?state.revision===0:state.players.length>0,'Wait for the host to open this table.');
  if(intent.type==='create')next.host=actor;
  next.players.push({id:actor,name:intent.name.trim(),bot:false});
 }else if(intent.type==='invite-bot'){
  requireChoice(actor===state.host&&state.phase==='gathering'&&state.players.length<4&&!state.players.some(p=>p.id===intent.id),'That seat is not available.');
  requireChoice(state.protocol!==1||intent.level===undefined,'This game uses classic companions.');
  requireChoice(state.protocol===3?intent.colour!==undefined&&!state.players.some(p=>p.colour===intent.colour):intent.colour===undefined,'Choose an available colour.');
  next.players.push({id:intent.id,name:intent.name.trim(),bot:true,...(intent.level===undefined?{}:{level:intent.level}),...(intent.colour===undefined?{}:{colour:intent.colour})});
 }else if(intent.type==='begin'){
  requireChoice((state.protocol===3?seat>=0:actor===state.host)&&state.players.length>=2&&['gathering','finished'].includes(state.phase),'Only the host can start once at least two players are seated.');
  next.turnRolls=0;next.seed=intent.seed;next.winner=null;next.phase='playing';next.choice=null;
  next.game={version:1,seed:seedNumber(intent.seed),rollIndex:0,active:0,phase:'ready',saved:[{},{},{},{}],runners:{},claims:[[],[],[],[]],dice:[1,1,1,1],lastOutcome:'none'};
 }else{
  requireChoice(state.phase==='playing'&&state.game&&seat===state.game.active,'Wait for your turn.');
  const before=state.game!;
  const replacement=state.protocol>=2&&intent.type==='advance'&&before.phase==='decide';
  requireChoice(!replacement||state.choice,'Roll before choosing.');
  const base=replacement?state.choice!.before:before;
  change(before,advanceGame(base,intent),intent.type,replacement);
  if(intent.type==='roll')next.turnRolls++;
  if(intent.type==='stop'||next.game!.lastOutcome==='bust')next.turnRolls=0;
  next.choice=state.protocol>=2&&intent.type==='advance'?{before:structuredClone(base),pairing:intent.pairing,...(intent.column===undefined?{}:{column:intent.column})}:null;
  if((intent.type==='stop'||next.game!.lastOutcome==='bust')&&next.game!.phase!=='finished')next.game!.active=(before.active+1)%state.players.length;
  if(next.game!.phase==='finished'){next.phase='finished';next.winner=state.players[before.active].id;}
 }
 // A turn opening offers no choice. Its seeded rolls (including consecutive
 // opening busts) are derived from begin/stop/roll, never appended as actions.
 if(state.protocol>=2&&next.phase==='playing')while(next.game?.phase==='ready'){
  const before=next.game,after=advanceGame(before,{type:'roll'});next.turnRolls++;
  if(after.lastOutcome==='bust')next.turnRolls=0;
  if(after.lastOutcome==='bust')after.active=(before.active+1)%next.players.length;
  change(before,after,'roll');next.choice=null;
 }
 next.revision++;return {state:next,changes};
}
export function apply(state:State,actor:string,input:Intent):State{return evolve(state,actor,input).state;}
export const choiceBoard=(state:State)=>state.choice?.before??state.game;
export function replay(events:readonly Event[],visit?:(before:State,after:State,event:Event)=>void){
 requireChoice(Array.isArray(events),'Choose a game log.');
 let state=initialState();const ids=new Set<string>();
 for(const event of events){
  requireChoice(event&&Object.keys(event).sort().join(',')==='actor,id,intent,sequence,version'&&[1,2,3].includes(event.version)&&(!state.revision||event.version===state.protocol)&&event.sequence===state.revision+1&&typeof event.id==='string'&&/^[\w-]{1,128}$/.test(event.id)&&!ids.has(event.id),'This game log is not a supported, ordered intent history.');
  if(!state.revision)state=initialState(event.version);
  ids.add(event.id);const before=state;state=apply(state,event.actor,event.intent);requireChoice(state.protocol===event.version,'This action does not match the game protocol.');visit?.(before,state,event);
 }
 return state;
}
export function chooseBot(state:State):BoardIntent|null{
 const game=state.game;if(!game||state.phase!=='playing'||!state.players[game.active]?.bot)return null;
 const level=state.players[game.active].level;if(level)return chooseCompanion(game,level,state.turnRolls);
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

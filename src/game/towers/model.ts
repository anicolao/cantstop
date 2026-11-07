export type Tower={id:string;name:string;updatedAt:number;sharing:boolean};
export type TowerRoll={eventId:string;rollId:string;kind:'roll'|'recognitionChanged';capturedAt:number;receivedAt:number;dice:number[]};
const id=(v:unknown,max=128):v is string=>typeof v==='string'&&v.length<=max&&/^[\w-]+$/.test(v);
export function activeTowers(value:unknown,now=Date.now()):Tower[]{
 if(!value||typeof value!=='object')return [];
 return Object.entries(value).flatMap(([key,v])=>{
  const p=v as Partial<Tower>&{schemaVersion?:number};
  return p&&id(key)&&p.schemaVersion===1&&typeof p.name==='string'&&p.name.trim().length>0&&p.name.length<=60&&p.sharing===true&&typeof p.updatedAt==='number'&&Number.isFinite(p.updatedAt)&&p.updatedAt>now-120_000&&p.updatedAt<=now+60_000?[{id:key,name:p.name,updatedAt:p.updatedAt,sharing:true}]:[];
 }).sort((a,b)=>b.updatedAt-a.updatedAt||a.id.localeCompare(b.id));
}
export function towerRoll(key:string,value:unknown):TowerRoll|null{
 if(!value||typeof value!=='object'||!id(key,64))return null;
 const r=value as Record<string,unknown>;
 if(r.schemaVersion!==1||r.eventId!==key||!id(r.rollId,64)||!['roll','recognitionChanged'].includes(String(r.kind))||r.count!==4||!Number.isFinite(r.capturedAt)||!Number.isFinite(r.receivedAt)||Number(r.capturedAt)<=0||Number(r.receivedAt)<=0)return null;
 if(!r.dice||typeof r.dice!=='object'||Object.keys(r.dice).sort().join(',')!=='0,1,2,3')return null;
 const entries=Object.values(r.dice) as {value?:number;confidence?:number;box?:Record<string,number>}[];
 if(!entries.every(d=>d&&Number.isInteger(d.value)&&d.value!>=1&&d.value!<=6&&typeof d.confidence==='number'&&d.confidence>=0&&d.confidence<=1&&d.box&&['x','y','width','height'].every(k=>Number.isFinite(d.box![k]))&&d.box.x>=0&&d.box.y>=0&&d.box.width>0&&d.box.height>0&&d.box.x+d.box.width<=1.000001&&d.box.y+d.box.height<=1.000001))return null;
 const dice=entries.map(d=>d.value!);if(r.total!==dice.reduce((sum,n)=>sum+n,0))return null;
 return {eventId:key,rollId:r.rollId,kind:r.kind as TowerRoll['kind'],capturedAt:Number(r.capturedAt),receivedAt:Number(r.receivedAt),dice};
}
/** Selection time is the boundary, including fresh rolls arriving in the initial snapshot. */
export class RollCursor{
 private seen=new Set<string>();
 warning:string|null=null;
 constructor(private armedAt:number){}
 update(raw:unknown):TowerRoll[]{
  const entries=raw&&typeof raw==='object'?Object.entries(raw):[];
  return entries.filter(([key])=>{if(this.seen.has(key))return false;this.seen.add(key);return true;})
   .flatMap(([key,value])=>{const raw=value as {capturedAt?:number;receivedAt?:number};if(!raw||Number(raw.capturedAt)<this.armedAt||Number(raw.receivedAt)<this.armedAt)return [];const roll=towerRoll(key,value);this.warning=roll?null:'Waiting for exactly four valid dice.';return roll?[roll]:[];})
   .sort((a,b)=>a.capturedAt-b.capturedAt||a.eventId.localeCompare(b.eventId));
 }
}
export const TOWER_KEY='cantstop:dice-tower:v1';
export function savedTower():string|null{try{const v=localStorage.getItem(TOWER_KEY);return id(v)?v:null;}catch{return null;}}
export function saveTower(value:string|null){try{if(value)localStorage.setItem(TOWER_KEY,value);else localStorage.removeItem(TOWER_KEY);}catch{}}

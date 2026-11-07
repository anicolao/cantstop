export type SeatId='south-left'|'south-right'|'east'|'north-right'|'north-left'|'west';
export type SeatPose={x:number;z:number;angle:number};
export const TABLETOP_SPAN=25.6;
export const SEATS:readonly {id:SeatId;label:string;pose:SeatPose}[]=[
 {id:'south-left',label:'South left',pose:{x:-9.2,z:9.0,angle:0}},
 {id:'south-right',label:'South right',pose:{x:9.2,z:9.0,angle:0}},
 {id:'east',label:'East',pose:{x:18,z:0,angle:Math.PI/2}},
 {id:'north-right',label:'North right',pose:{x:9.2,z:-9.0,angle:Math.PI}},
 {id:'north-left',label:'North left',pose:{x:-9.2,z:-9.0,angle:Math.PI}},
 {id:'west',label:'West',pose:{x:-18,z:0,angle:-Math.PI/2}}
];
export const seatPose=(id:SeatId)=>SEATS.find(s=>s.id===id)!.pose;
export function assignSeats(players:readonly {id:string}[],saved:unknown={}):Record<string,SeatId>{
 const stored=saved&&typeof saved==='object'&&!Array.isArray(saved)?saved as Record<string,SeatId>:{};
 const next:Record<string,SeatId>={},used=new Set<SeatId>();
 for(const player of players){const seat=stored[player.id];if(SEATS.some(s=>s.id===seat)&&!used.has(seat)){next[player.id]=seat;used.add(seat);}}
 const defaults:SeatId[]=['south-left','north-right','south-right','north-left','east','west'];
 for(const player of players)if(!next[player.id]){const seat=defaults.find(s=>!used.has(s))!;next[player.id]=seat;used.add(seat);}
 return next;
}
export function shortestAngle(from:number,to:number){return Math.atan2(Math.sin(to-from),Math.cos(to-from));}
/** Travel around the playfield, never dragging the dice through its centre. */
export function seatTravel(from:SeatPose,to:SeatPose,t:number):SeatPose{
 const p=Math.max(0,Math.min(1,t)),e=p*p*(3-2*p);
 const a=Math.atan2(from.x,from.z),b=Math.atan2(to.x,to.z),angle=a+shortestAngle(a,b)*e;
 const radius=Math.hypot(from.x,from.z)+(Math.hypot(to.x,to.z)-Math.hypot(from.x,from.z))*e;
 return {x:Math.sin(angle)*radius,z:Math.cos(angle)*radius,angle:from.angle+shortestAngle(from.angle,to.angle)*e};
}

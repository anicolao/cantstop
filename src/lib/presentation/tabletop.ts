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
/** Perimeter travel stays on the table, including the rotated dock's footprint. */
export function seatTravel(from:SeatPose,to:SeatPose,t:number):SeatPose{
 const p=Math.max(0,Math.min(1,t)),e=p*p*(3-2*p),perimeter=108;
 const distance=(pose:SeatPose)=>{
  if(Math.abs(pose.x)/18>=Math.abs(pose.z)/9)return pose.x>=0?36+9-pose.z:90+pose.z+9;
  return pose.z>=0?pose.x+18:54+18-pose.x;
 };
 const start=distance(from),end=distance(to);
 let delta=((end-start+perimeter*1.5)%perimeter)-perimeter/2;
 const d=((start+delta*e)%perimeter+perimeter)%perimeter;
 let x:number,z:number;
 if(d<=36){x=d-18;z=9;}else if(d<=54){x=18;z=45-d;}else if(d<=90){x=72-d;z=-9;}else{x=-18;z=d-99;}
 const normal=(position:number)=>{
  const cycle=Math.floor((position+4)/perimeter),v=position-cycle*perimeter;
  const smooth=(t:number)=>{const n=Math.max(0,Math.min(1,t));return n*n*(3-2*n);};
  const a=v<4?-Math.PI/2+smooth((v+4)/8)*Math.PI/2:v<32?0:v<40?smooth((v-32)/8)*Math.PI/2:v<50?Math.PI/2:v<58?Math.PI/2+smooth((v-50)/8)*Math.PI/2:v<86?Math.PI:v<94?Math.PI+smooth((v-86)/8)*Math.PI/2:Math.PI*1.5;
  return cycle*Math.PI*2+a;
 };
 const angle=from.angle+normal(start+delta*e)-normal(start),c=Math.cos(angle),s=Math.sin(angle);
 const corners=[-3.7,6.3].flatMap(a=>[-2.8,3.4].map(b=>({x:a*c+b*s,z:-a*s+b*c})));
 const minX=Math.min(...corners.map(p=>p.x)),maxX=Math.max(...corners.map(p=>p.x));
 const minZ=Math.min(...corners.map(p=>p.z)),maxZ=Math.max(...corners.map(p=>p.z));
 x=Math.max(-22+.3-minX,Math.min(22-.3-maxX,x));z=Math.max(-12.8+.3-minZ,Math.min(12.8-.3-maxZ,z));
 return {x,z,angle};
}

import {test,expect} from 'bun:test';
import {SEATS,assignSeats,seatPose,seatTravel,shortestAngle} from '../src/lib/presentation/tabletop';
import {normalizePreferences} from '../src/game/settings';
test('six physical places cover four edges, with two places on each long side',()=>{
 expect(SEATS).toHaveLength(6);expect(new Set(SEATS.map(s=>s.id)).size).toBe(6);
 expect(SEATS.filter(s=>s.pose.z===9)).toHaveLength(2);expect(SEATS.filter(s=>s.pose.z===-9)).toHaveLength(2);
 expect(SEATS.filter(s=>s.pose.x===18)).toHaveLength(1);expect(SEATS.filter(s=>s.pose.x===-18)).toHaveLength(1);
 expect(seatPose('east').angle).toBe(Math.PI/2);expect(seatPose('west').angle).toBe(-Math.PI/2);expect(seatPose('north-left').angle).toBe(Math.PI);
});
test('places stay unique across joins, reloads, stale preferences and malformed storage',()=>{
 const players=['a','b','c','d'].map(id=>({id}));const assigned=assignSeats(players,{a:'east',b:'east',c:'west',d:'missing'});
 expect(assigned.a).toBe('east');expect(assigned.c).toBe('west');expect(new Set(Object.values(assigned)).size).toBe(4);
 expect(assignSeats(players,JSON.parse(JSON.stringify(assigned)))).toEqual(assigned);
 for(const value of [null,[],true,'bad'])expect(new Set(Object.values(assignSeats(players,value))).size).toBe(4);
 expect(normalizePreferences({view:'overhead',animationSpeed:'fast'})).toEqual({view:'overhead',animationSpeed:'fast'});
});
test('dice travel around the board and spins use the shortest orientation',()=>{
 for(const from of SEATS)for(const to of SEATS){
  for(const t of [0,.1,.25,.5,.75,.9,1]){const pose=seatTravel(from.pose,to.pose,t);expect(Math.hypot(pose.x,pose.z)).toBeGreaterThan(8);expect(Math.abs(pose.angle-from.pose.angle)).toBeLessThanOrEqual(Math.PI+.0001);
   for(const x of [-3.7,6.3])for(const z of [-2.8,3.4]){const worldX=pose.x+x*Math.cos(pose.angle)+z*Math.sin(pose.angle),worldZ=pose.z-x*Math.sin(pose.angle)+z*Math.cos(pose.angle);expect(Math.abs(worldX)).toBeLessThan(22);expect(Math.abs(worldZ)).toBeLessThan(12.8);}}
  const end=seatTravel(from.pose,to.pose,1);expect(end.x).toBeCloseTo(to.pose.x);expect(end.z).toBeCloseTo(to.pose.z);expect(shortestAngle(end.angle,to.pose.angle)).toBeCloseTo(0);
 }
 expect(shortestAngle(Math.PI-.1,-Math.PI+.1)).toBeCloseTo(.2);
});


test('walk-up seats record colour choices without names and any seated colour can start',async()=>{
 const {apply,initialState,replay,chooseBot,parseIntent}=await import('../src/game/engine');
 const {COLOUR_NAMES}=await import('../src/game/seating');
 for(const count of [2,3,4]){
  let state=initialState(3);const log:import('../src/game/engine').Event[]=[];
  const send=(actor:string,intent:import('../src/game/engine').Intent)=>{state=apply(state,actor,intent);log.push({version:3,id:`walk-${log.length}`,sequence:log.length+1,actor,intent});};
  const colours=[2,0,3,1];for(let i=0;i<count;i++)send(`p${i}`,{type:'sit',seat:SEATS[i].id,colour:colours[i]});
  expect(state.players.map(p=>p.name)).toEqual(colours.slice(0,count).map(c=>COLOUR_NAMES[c]));
  expect(()=>apply(state,'stranger',{type:'sit',seat:'west',colour:2})).toThrow();
  expect(()=>apply(state,'stranger',{type:'join',name:'No name form'})).toThrow();
  send('p1',{type:'begin',seed:`walkup-${count}`});expect(state.game!.phase).toBe('choose');
  for(let turn=0;turn<5000&&state.phase!=='finished';turn++){const action=chooseBot({...state,players:state.players.map(p=>({...p,bot:true}))})!;send(state.players[state.game!.active].id,action);}
  expect(state.phase).toBe('finished');expect(replay(log)).toEqual(state);
  expect(log.filter(e=>e.intent.type==='sit').every(e=>!('name' in e.intent))).toBe(true);
 }
 for(const version of [1,2] as const)expect(()=>replay([{version,id:'wrong-protocol',sequence:1,actor:'p0',intent:{type:'sit',seat:'east',colour:0}}])).toThrow();
 for(const value of [{type:'sit',colour:4,seat:'east'},{type:'sit',colour:0,seat:'ceiling'},{type:'sit',colour:0,seat:'east',name:'hidden'}])expect(()=>parseIntent(value)).toThrow();
});

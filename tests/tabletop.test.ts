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
 expect(normalizePreferences({view:'tabletop',animationSpeed:'fast'})).toEqual({view:'tabletop',animationSpeed:'fast'});
});
test('dice travel around the board and spins use the shortest orientation',()=>{
 for(const from of SEATS)for(const to of SEATS){
  for(const t of [0,.1,.25,.5,.75,.9,1]){const pose=seatTravel(from.pose,to.pose,t);expect(Math.hypot(pose.x,pose.z)).toBeGreaterThan(8);expect(Math.abs(pose.angle-from.pose.angle)).toBeLessThanOrEqual(Math.PI+.0001);
   for(const x of [-3.7,6.3])for(const z of [-2.8,3.4]){const worldX=pose.x+x*Math.cos(pose.angle)+z*Math.sin(pose.angle),worldZ=pose.z-x*Math.sin(pose.angle)+z*Math.cos(pose.angle);expect(Math.abs(worldX)).toBeLessThan(22);expect(Math.abs(worldZ)).toBeLessThan(12.8);}}
  const end=seatTravel(from.pose,to.pose,1);expect(end.x).toBeCloseTo(to.pose.x);expect(end.z).toBeCloseTo(to.pose.z);expect(shortestAngle(end.angle,to.pose.angle)).toBeCloseTo(0);
 }
 expect(shortestAngle(Math.PI-.1,-Math.PI+.1)).toBeCloseTo(.2);
});

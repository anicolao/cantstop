import {describe,test,expect} from 'bun:test';
import {apply,fixture,seedFor,roll,pairings,replay,risk,LENGTHS} from '../src/lib/model/game';
import {examples,atTime,durationOf} from '../src/lib/presentation/catalog';
import {pairingNumbers} from '../src/lib/presentation/choices';
import {cell,sample} from '../src/lib/presentation/frame';
import {rotatedSquare} from '../src/lib/scene/geometry';
import {PIECE_SCALE,MARKER_STACK_HEIGHT,PODIUM,runnerHome,BOARD_FACE,BOARD_LAYERS,GRID,GRID_CENTRE_Z,SOCKET_SIZE,TILE_SIZE,LABEL_SIZE,trackLabel} from '../src/lib/presentation/layout';
describe('seeded choices and classic rules',()=>{
 test('the canonical diamond has eleven tracks and 83 spaces',()=>{expect(LENGTHS.reduce((a,b)=>a+b,0)).toBe(83);expect(cell(2,1)[2]+cell(2,3)[2]).toBeCloseTo(2*GRID_CENTRE_Z);expect(cell(7,1)[2]+cell(7,13)[2]).toBeCloseTo(2*GRID_CENTRE_Z);});
 test('roll outcomes are reproducible from seed and roll index',()=>{const seed=seedFor([1,2,5,6]);expect(roll(seed)).toEqual([1,2,5,6]);expect(roll(seed,3)).toEqual(roll(seed,3));});
 test('double 7 advances twice while saved progress remains unchanged',()=>{const before=fixture(),after=replay(before,[{type:'roll'},{type:'advance',pairing:2}]);expect(after.runners[7]).toBe(9);expect(after.saved).toEqual(before.saved);expect(risk(after)).toBe(6);expect(before.runners[7]).toBe(7);});
 test('one spare runner offers two explicit destinations',()=>{const before=fixture({phase:'choose',runners:{7:7,9:3}});expect(pairings(before)[1].variants.map(v=>v.column).sort()).toEqual([6,8]);expect(()=>apply(before,{type:'advance',pairing:1})).toThrow();expect(apply(before,{type:'advance',pairing:1,column:8}).runners[8]).toBe(3);});
 test('a partial pairing remains legal',()=>{const before=fixture({phase:'choose',runners:{6:4,7:7,9:3}});const after=apply(before,{type:'advance',pairing:1});expect(after.runners[6]).toBe(5);expect(after.runners[8]).toBeUndefined();});
 test('a bust removes only provisional progress and passes the turn',()=>{const before=fixture({seed:seedFor([1,1,1,1])}),after=apply(before,{type:'roll'});expect(after.lastOutcome).toBe('bust');expect(after.runners).toEqual({});expect(after.saved).toEqual(before.saved);expect(after.claims).toEqual(before.claims);expect(after.active).toBe(1);});
 test('reaching a summit does not free its runner or claim it',()=>{const before=fixture({phase:'choose',runners:{6:10,7:7,8:3}}),after=apply(before,{type:'advance',pairing:1});expect(after.runners[6]).toBe(11);expect(after.claims[0]).not.toContain(6);expect(Object.keys(after.runners)).toHaveLength(3);});
 test('stop saves once; a third claim wins immediately',()=>{const before=fixture({runners:{6:11,7:7,8:3},claims:[[4,10],[2],[12],[]]}),after=apply(before,{type:'stop'});expect(after.phase).toBe('finished');expect(after.claims[0]).toEqual([4,10,6]);expect(after.saved.every(s=>s[6]===undefined)).toBe(true);expect(()=>apply(after,{type:'stop'})).toThrow();});
 test('unresolved dice cannot be rerolled or saved',()=>{const s=apply(fixture(),{type:'roll'});expect(()=>apply(s,{type:'roll'})).toThrow();expect(()=>apply(s,{type:'stop'})).toThrow();});
 test('an equal pair caps at the summit',()=>{const s=fixture({phase:'choose',runners:{6:4,7:12,8:3}});expect(apply(s,{type:'advance',pairing:2}).runners[7]).toBe(13);});
});
describe('presentation is a seekable projection',()=>{
 test('every catalog intent is legal and produces its recorded target',()=>{for(const e of examples)for(const step of e.steps)if(step.intent)expect(apply(step.before,step.intent)).toEqual(step.after);});
 test('scrubbing backward is independent of prior samples',()=>{for(const e of examples){const t=atTime(e,durationOf(e)*.48);const a=sample(t,t.time);sample(t,t.duration);sample(t,0);expect(sample(t,t.time)).toEqual(a);}});
 test('normal and reduced motion have identical settled state and pieces',()=>{for(const e of examples)for(const step of e.steps){const full=sample(step,step.duration);const reduced=sample(step,0,true);expect(reduced.state).toEqual(full.state);expect(reduced.pieces).toEqual(full.pieces);}});
 test('preview, sampling, and seeking never mutate the model',()=>{for(const e of examples){const copy=structuredClone(e);for(const step of e.steps)for(const t of [0,.2,.8,1.8,step.duration])sample(step,t);expect(e).toEqual(copy);}});
 test('double advance visits the intermediate space',()=>{const step=examples.find(e=>e.id==='advance')!.steps[0];const frame=sample(step,1.05),runner=frame.pieces.find(p=>p.id==='runner-7')!;expect(runner.position[2]).toBeCloseTo(cell(7,8)[2]);});
});

describe('centred pieces and the runner podium',()=>{
 test('all pieces keep the larger size, including claims and animated returns',()=>{
  for(const example of examples)for(const step of example.steps)for(const time of [0,.7,1.4,2.3,step.duration]){
   const frame=sample(step,time);
   expect(frame.pieces.filter(p=>p.runner)).toHaveLength(3);
   for(const piece of frame.pieces)expect(piece.scale).toBe(PIECE_SCALE);
  }
 });
 test('every settled board piece is exactly centred on its square',()=>{
  for(const example of examples)for(const step of example.steps){
   const frame=sample(step,step.duration);
   for(const piece of frame.pieces.filter(p=>p.onBoard)){
    const position=piece.runner?frame.state.runners[piece.column]:piece.id.startsWith('claim-')?LENGTHS[piece.column-2]:frame.state.saved[piece.owner][piece.column];
    const centre=cell(piece.column,position);
    expect(piece.position[0]).toBe(centre[0]);expect(piece.position[2]).toBe(centre[2]);
   }
  }
 });
 test('shared positions stack vertically and the black runner rests above the markers',()=>{
  const state=fixture({saved:[{7:5},{7:5},{7:5},{}],runners:{7:5}});
  const frame=sample({before:state,after:state,kind:'preview',duration:1},1);
  const occupants=frame.pieces.filter(p=>p.column===7&&p.onBoard),centre=cell(7,5);
  expect(occupants).toHaveLength(4);
  for(const piece of occupants){expect(piece.position[0]).toBe(centre[0]);expect(piece.position[2]).toBe(centre[2]);}
  expect(occupants.map(p=>p.position[1])).toEqual([0,1,2,3].map(i=>centre[1]+i*MARKER_STACK_HEIGHT));
 });
 test('unused pawns fit on three non-overlapping slots on the ivory disk',()=>{
  const footprint=.27*PIECE_SCALE;
  for(let i=0;i<3;i++){
   const p=runnerHome(i);expect(p[1]).toBe(PODIUM.surface);
   expect(Math.hypot(p[0]-PODIUM.x,p[2]-PODIUM.z)+footprint).toBeLessThan(PODIUM.radius-.05);
   for(let j=i+1;j<3;j++){const q=runnerHome(j);expect(Math.hypot(p[0]-q[0],p[2]-q[2])).toBeGreaterThan(2*footprint);}
  }
 });
 test('save and bust return all three opaque black pawns to the podium',()=>{
  for(const id of ['save','bust']){
   const step=examples.find(e=>e.id===id)!.steps[0],frame=sample(step,step.duration);
   const pawns=frame.pieces.filter(p=>p.runner);
   expect(pawns).toHaveLength(3);
   for(const piece of pawns){expect(piece.position).toEqual(runnerHome(piece.slot!));expect(piece.onBoard).toBe(false);expect(piece.opacity).toBe(1);}
  }
 });
 test('a new runner lifts from its own podium slot',()=>{
  const step=examples.find(e=>e.id==='turn')!.steps[1];
  const runner=sample(step,0).pieces.find(p=>p.id==='runner-7')!;
  expect(runner.position).toEqual(runnerHome(runner.slot!));
 });
});

describe('the number ribbon',()=>{
 test('every number has a complete clear face below its track and inside the lacquer',()=>{
  for(let c=2;c<=12;c++){
   const label=trackLabel(c),bottom=cell(c,1);
   expect(label[2]-LABEL_SIZE.depth/2).toBeGreaterThan(bottom[2]+TILE_SIZE.depth/2);
   for(const x of [-1,1])for(const z of [-1,1]){
    const px=label[0]+x*LABEL_SIZE.width/2,pz=label[2]+z*LABEL_SIZE.depth/2;
    expect(Math.abs(px)/BOARD_FACE.halfWidth+Math.abs(pz-BOARD_FACE.centreZ)/BOARD_FACE.halfDepth).toBeLessThan(1);
   }
  }
 });

});

describe('the diamond follows the actual playing surface',()=>{
 test('all 83 socket rectangles fit fully inside the face',()=>{
  let count=0;
  for(let c=2;c<=12;c++)for(let row=1;row<=LENGTHS[c-2];row++){
   const point=cell(c,row);count++;
   for(const x of [-1,1])for(const z of [-1,1]){
    const px=point[0]+x*SOCKET_SIZE.width/2,pz=point[2]+z*SOCKET_SIZE.depth/2;
    expect(Math.abs(px)/BOARD_FACE.halfWidth+Math.abs(pz)/BOARD_FACE.halfDepth).toBeLessThan(1);
   }
   expect(TILE_SIZE.width).toBeLessThan(SOCKET_SIZE.width);expect(TILE_SIZE.depth).toBeLessThan(SOCKET_SIZE.depth);
  }
  expect(count).toBe(83);
 });
 test('top ends, bottom ends and numbers follow edges parallel to every board layer',()=>{
  for(const layer of Object.values(BOARD_LAYERS)){
   expect(layer.centreZ).toBe(0);
   for(let c=2;c<12;c++){
    const direction=c<7?1:-1;
    const lowerA=cell(c,1),lowerB=cell(c+1,1),upperA=cell(c,LENGTHS[c-2]),upperB=cell(c+1,LENGTHS[c-1]);
    const numberA=trackLabel(c),numberB=trackLabel(c+1);
    const cross=(a:number[],b:number[],sign:number)=>(b[2]-a[2])*layer.halfWidth-(b[0]-a[0])*sign*layer.halfDepth;
    expect(cross(lowerA,lowerB,direction)).toBeCloseTo(0,10);
    expect(cross(upperA,upperB,-direction)).toBeCloseTo(0,10);
    expect(cross(numberA,numberB,direction)).toBeCloseTo(0,10);
   }
  }
 });
 test('the complete tile-and-number composition is centred in its backing',()=>{
  const slope=BOARD_FACE.halfDepth/BOARD_FACE.halfWidth;
  let near=-Infinity,far=-Infinity;
  const include=(point:number[],width:number,depth:number)=>{
   for(const dx of [-1,1])for(const dz of [-1,1]){
    const x=point[0]+dx*width/2,z=point[2]+dz*depth/2;
    near=Math.max(near,slope*Math.abs(x)+z);far=Math.max(far,slope*Math.abs(x)-z);
   }
  };
  for(let c=2;c<=12;c++){
   for(let row=1;row<=LENGTHS[c-2];row++)include(cell(c,row),SOCKET_SIZE.width,SOCKET_SIZE.depth);
   include(trackLabel(c),LABEL_SIZE.width,LABEL_SIZE.depth);
  }
  expect(near).toBeCloseTo(far,10);
  expect(BOARD_FACE.halfDepth-near).toBeCloseTo(.20,10);
 });
});

describe('a real square oriented at 45 degrees',()=>{
 test('all backing layers have equal diagonals and four right angles',()=>{
  for(const layer of Object.values(BOARD_LAYERS)){
   expect(layer.halfWidth).toBe(layer.halfDepth);
   const corners=rotatedSquare(layer.halfWidth).getPoints().slice(0,4);
   expect(corners).toHaveLength(4);
   const sides=corners.map((p,i)=>corners[(i+1)%4].clone().sub(p));
   for(let i=0;i<4;i++){
    expect(sides[i].length()).toBeCloseTo(sides[0].length(),10);
    expect(sides[i].dot(sides[(i+1)%4])).toBeCloseTo(0,10);
   }
   expect(corners[0].distanceTo(corners[2])).toBeCloseTo(corners[1].distanceTo(corners[3]),10);
  }
 });
 test('the tracks use equal spacing along both axes',()=>{
  expect(GRID.columnStep).toBe(GRID.rowStep);
  expect(SOCKET_SIZE.width).toBe(SOCKET_SIZE.depth);
  expect(TILE_SIZE.width).toBe(TILE_SIZE.depth);
  expect(cell(8,1)[0]-cell(7,1)[0]).toBeCloseTo(cell(7,1)[2]-cell(7,2)[2],10);
 });
});

describe('individual sum availability',()=>{
 test('no spare pawn dims a new column while an existing pawn can still advance',()=>{
  const state=fixture({phase:'choose',runners:{6:4,7:7,9:3}});
  const values=pairingNumbers(state,pairings(state)[1]);
  expect(values).toEqual([{number:6,inactive:false,reason:undefined},{number:8,inactive:true,reason:'no pawn'}]);
 });
 test('the last-pawn choice keeps both alternatives available until a destination is chosen',()=>{
  const state=fixture({phase:'choose',runners:{7:7,9:3}}),pair=pairings(state)[1];
  expect(pairingNumbers(state,pair).every(n=>!n.inactive)).toBe(true);
  expect(pairingNumbers(state,pair,8).map(n=>n.inactive)).toEqual([true,false]);
 });
 test('a duplicate sum with only one step left marks just the extra occurrence inactive',()=>{
  const state=fixture({phase:'choose',runners:{6:4,7:12,8:3}});
  expect(pairingNumbers(state,pairings(state)[2]).map(n=>n.inactive)).toEqual([false,true]);
 });
 test('closed columns use the same inactive flag as unavailable pawns',()=>{
  const state=fixture({phase:'choose',runners:{},dice:[2,3,4,6]});
  expect(pairingNumbers(state,pairings(state)[0])).toEqual([{number:5,inactive:false,reason:undefined},{number:10,inactive:true,reason:'closed'}]);
 });
});

import {expect,test} from 'bun:test';
import {Vector3} from 'three';
import {mergedPips,pipsFor} from '../src/lib/scene/dice-pips';

const HALF=1.03/2;
// Each pip is a 20-segment circle: a centre vertex plus 21 rim vertices.
const PER_PIP=22;

/** Pip centres grouped by the face they sit on (+y is the top face). */
function pipCentres(value:number){
 const pos=mergedPips(value,.078,.0045).getAttribute('position'),v=new Vector3(),faces:Record<string,number>={};
 for(let i=0;i<pos.count;i+=PER_PIP){
  v.fromBufferAttribute(pos,i);
  const axis=(['x','y','z'] as const).reduce((a,b)=>Math.abs(v[b])>Math.abs(v[a])?b:a);
  expect(Math.abs(v[axis])).toBeGreaterThan(HALF);expect(Math.abs(v[axis])).toBeLessThan(HALF+.01);
  const key=`${v[axis]>0?'+':'-'}${axis}`;faces[key]=(faces[key]??0)+1;
 }
 return faces;
}

test('every glossy die carries all 21 pips in one geometry',()=>{
 for(let value=1;value<=6;value++)expect(mergedPips(value,.078,.0045).getAttribute('position').count).toBe(21*PER_PIP);
});

test('the rolled value is on top, its complement underneath, and pips sit just outside each face',()=>{
 for(let value=1;value<=6;value++){
  const faces=pipCentres(value);
  expect(faces['+y']).toBe(value);expect(faces['-y']).toBe(7-value);
  expect(Object.values(faces).sort()).toEqual([1,2,3,4,5,6]);
 }
});

test('pip geometry is shared between dice showing the same value',()=>{
 expect(pipsFor(4)).toBe(pipsFor(4));expect(pipsFor(4).pips).not.toBe(pipsFor(5).pips);
});

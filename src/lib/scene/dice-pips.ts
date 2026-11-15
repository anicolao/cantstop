/** Pip layout for the dice, and merged pip geometry for the glossy tabletop dice. */
import {CircleGeometry,Euler,Matrix4,Quaternion,Vector3,type BufferGeometry} from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
export type Face={n:number;p:[number,number,number];r:[number,number,number]};
export const dots:Record<number,number[][]>={1:[[0,0]],2:[[-1,-1],[1,1]],3:[[-1,-1],[0,0],[1,1]],4:[[-1,-1],[-1,1],[1,-1],[1,1]],5:[[-1,-1],[-1,1],[0,0],[1,-1],[1,1]],6:[[-1,-1],[-1,0],[-1,1],[1,-1],[1,0],[1,1]]};
export function facesFor(value:number):Face[]{
 return [
  {n:value,p:[0,.513,0],r:[-Math.PI/2,0,0]},
  {n:7-value,p:[0,-.513,0],r:[Math.PI/2,0,0]},
  {n:value===1||value===6?3:1,p:[0,0,.513],r:[0,0,0]},
  {n:value===1||value===6?4:6,p:[0,0,-.513],r:[0,Math.PI,0]},
  {n:[1,6].includes(value)?2:[2,5].includes(value)?3:2,p:[.513,0,0],r:[0,Math.PI/2,0]},
  {n:[1,6].includes(value)?5:[2,5].includes(value)?4:5,p:[-.513,0,0],r:[0,-Math.PI/2,0]}
 ];
}
/** Every pip of a die as one flat mesh: one draw call instead of 21. */
export function mergedPips(value:number,radius:number,lift:number){
 const parts:BufferGeometry[]=[];
 for(const face of facesFor(value))for(const [x,y] of dots[face.n]){
  const local=new Matrix4().makeTranslation(x*.255,y*.255,lift);
  const placed=new Matrix4().compose(new Vector3(...face.p),new Quaternion().setFromEuler(new Euler(...face.r)),new Vector3(1,1,1)).multiply(local);
  parts.push(new CircleGeometry(radius,20).applyMatrix4(placed));
 }
 const merged=mergeGeometries(parts);parts.forEach(g=>g.dispose());return merged;
}
// Six top-face values, each with a pip and a rim layer; shared by every glossy die.
const glossPips=new Map<number,{pips:BufferGeometry;rims:BufferGeometry}>();
export function pipsFor(value:number){
 let g=glossPips.get(value);
 if(!g){g={pips:mergedPips(value,.078,.0045),rims:mergedPips(value,.1,.0035)};glossPips.set(value,g);}
 return g;
}

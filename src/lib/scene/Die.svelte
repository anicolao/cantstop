<script lang="ts">
 import {T} from '@threlte/core';
 import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
 import type {Vec3} from '../presentation/frame';
 import type {Library} from './materials';
 let {value=1,lib,position=[0,0,0],rotation=[0,0,0],scale=1,selected=false}:{value?:number;lib:Library;position?:Vec3;rotation?:Vec3;scale?:number;selected?:boolean}=$props();
 const geometry=new RoundedBoxGeometry(1.03,1.03,1.03,5,.14);
 $effect(()=>()=>geometry.dispose());
 const dots:Record<number,number[][]>={1:[[0,0]],2:[[-1,-1],[1,1]],3:[[-1,-1],[0,0],[1,1]],4:[[-1,-1],[-1,1],[1,-1],[1,1]],5:[[-1,-1],[-1,1],[0,0],[1,-1],[1,1]],6:[[-1,-1],[-1,0],[-1,1],[1,-1],[1,0],[1,1]]};
 const faces=$derived([
  {n:value,p:[0,.513,0] as Vec3,r:[-Math.PI/2,0,0] as Vec3},
  {n:7-value,p:[0,-.513,0] as Vec3,r:[Math.PI/2,0,0] as Vec3},
  {n:value===1||value===6?3:1,p:[0,0,.513] as Vec3,r:[0,0,0] as Vec3},
  {n:value===1||value===6?4:6,p:[0,0,-.513] as Vec3,r:[0,Math.PI,0] as Vec3},
  {n:[1,6].includes(value)?2:[2,5].includes(value)?3:2,p:[.513,0,0] as Vec3,r:[0,Math.PI/2,0] as Vec3},
  {n:[1,6].includes(value)?5:[2,5].includes(value)?4:5,p:[-.513,0,0] as Vec3,r:[0,-Math.PI/2,0] as Vec3}
 ]);
</script>
<T.Group {position} {rotation} {scale}>
 <T.Mesh {geometry} material={lib.ruby} castShadow receiveShadow/>
 {#each faces as face}
  <T.Group position={face.p} rotation={face.r}>
   {#each dots[face.n] as [x,y]}
    <T.Mesh position={[x*.255,y*.255,-.004]} scale={[1,1,.24]} material={lib.pip}><T.SphereGeometry args={[.09,16,12]}/></T.Mesh>
   {/each}
  </T.Group>
 {/each}
 {#if selected}<T.Mesh rotation.x={-Math.PI/2} position.y={-.51}><T.RingGeometry args={[.73,.75,48]}/><T.MeshBasicMaterial color="#f6c766" transparent opacity={.8} toneMapped={false}/></T.Mesh>{/if}
</T.Group>

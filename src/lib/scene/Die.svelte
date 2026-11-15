<script lang="ts">
 import {T} from '@threlte/core';
 import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
 import type {Vec3} from '../presentation/frame';
 import type {Library} from './materials';
 import {dots,facesFor,pipsFor} from './dice-pips';
 let {value=1,lib,position=[0,0,0],rotation=[0,0,0],scale=1,selected=false,gloss=false}:{value?:number;lib:Library;position?:Vec3;rotation?:Vec3;scale?:number;selected?:boolean;gloss?:boolean}=$props();
 const geometry=new RoundedBoxGeometry(1.03,1.03,1.03,5,.14);
 $effect(()=>()=>geometry.dispose());
 const faces=$derived(facesFor(value));
 const glossy=$derived(gloss?pipsFor(value):undefined);
</script>
<T.Group {position} {rotation} {scale}>
 <T.Mesh {geometry} material={gloss?lib.rubyGloss:lib.ruby} castShadow receiveShadow/>
 {#if glossy}
  <T.Mesh geometry={glossy.rims} material={lib.pipRim}/>
  <T.Mesh geometry={glossy.pips} material={lib.pipGloss}/>
 {:else}
  {#each faces as face}
   <T.Group position={face.p} rotation={face.r}>
    {#each dots[face.n] as [x,y]}
     <T.Mesh position={[x*.255,y*.255,-.004]} scale={[1,1,.24]} material={lib.pip}><T.SphereGeometry args={[.09,16,12]}/></T.Mesh>
    {/each}
   </T.Group>
  {/each}
 {/if}
 {#if selected}<T.Mesh rotation.x={-Math.PI/2} position.y={-.51}><T.RingGeometry args={[.73,.75,48]}/><T.MeshBasicMaterial color="#f6c766" transparent opacity={.8} toneMapped={false}/></T.Mesh>{/if}
</T.Group>

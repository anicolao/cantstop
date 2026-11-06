<script lang="ts">
 import {T} from '@threlte/core';
 import {runnerGeometry} from './geometry';
 import {FINISH} from '../presentation/finish';
 import type {Vec3} from '../presentation/frame';
 import type {Library} from './materials';
 let {lib,position=[0,0,0],color=FINISH.players[0],runner=false,opacity=1,scale=1,owner=0}:{lib:Library;position?:Vec3;color?:string;runner?:boolean;opacity?:number;scale?:number;owner?:number}=$props();
 const runnerGeo=runnerGeometry();$effect(()=>()=>runnerGeo.dispose());
</script>
<T.Group {position} {scale} visible={opacity>.005}>
 {#if runner}
  <T.Mesh geometry={runnerGeo} castShadow receiveShadow><T.MeshPhysicalMaterial color={FINISH.runner} roughness={.3} clearcoat={.5} transparent={opacity<1} {opacity}/></T.Mesh>
  <T.Mesh position.y={.12} rotation.x={-Math.PI/2}><T.TorusGeometry args={[.225,.016,8,32]}/><T.MeshStandardMaterial color="#a78042" metalness={.65} roughness={.3} transparent={opacity<1} {opacity}/></T.Mesh>
 {:else}
  <T.Mesh position.y={.07} castShadow receiveShadow><T.CylinderGeometry args={[.245,.27,.14,48]}/><T.MeshPhysicalMaterial {color} metalness={.18} roughness={.22} clearcoat={1} clearcoatRoughness={.1} transparent={opacity<1} {opacity}/></T.Mesh>
  <T.Mesh position.y={.145} rotation.x={-Math.PI/2}><T.TorusGeometry args={[.20,.013,8,40]}/><T.MeshPhysicalMaterial color="#ffdf9b" metalness={.7} roughness={.3} transparent={opacity<1} opacity={opacity*.8}/></T.Mesh>
  {#if owner===0}<T.Mesh position.y={.15} rotation.x={-Math.PI/2}><T.RingGeometry args={[.06,.075,24]}/><T.MeshBasicMaterial color={FINISH.ownerMark} transparent {opacity}/></T.Mesh>
  {:else if owner===1}<T.Mesh position.y={.15} rotation.x={-Math.PI/2}><T.PlaneGeometry args={[.1,.1]}/><T.MeshBasicMaterial color={FINISH.ownerMark} transparent {opacity}/></T.Mesh>
  {:else if owner===2}<T.Mesh position.y={.15} rotation.x={-Math.PI/2}><T.CircleGeometry args={[.08,3]}/><T.MeshBasicMaterial color={FINISH.ownerMark} transparent {opacity}/></T.Mesh>
  {:else}<T.Mesh position.y={.15} rotation={[-Math.PI/2,0,Math.PI/4]}><T.PlaneGeometry args={[.1,.1]}/><T.MeshBasicMaterial color={FINISH.ownerMark} transparent {opacity}/></T.Mesh>{/if}
 {/if}
</T.Group>

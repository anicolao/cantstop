<script lang="ts">
 import {T} from '@threlte/core';
 import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
 import {LENGTHS} from '../model/game';
 import {cell} from '../presentation/frame';
 import {BOARD_FACE,BOARD_LAYERS,TILE_SIZE,SOCKET_SIZE,LABEL_SIZE,trackLabel} from '../presentation/layout';
 import {rotatedSquare,slab} from './geometry';
 import Inscription from './Inscription.svelte';
 import type {Library} from './materials';
 let {lib,closed=[],highlight,preview=[]}:{lib:Library;closed?:number[];highlight?:number;preview?:{column:number;position:[number,number,number]}[]}=$props();
 const base=slab(rotatedSquare(BOARD_LAYERS.base.halfWidth),.22,.12),rim=slab(rotatedSquare(BOARD_LAYERS.rim.halfWidth),.04,.035),face=slab(rotatedSquare(BOARD_FACE.halfWidth),.07,.045);
 const inset=new RoundedBoxGeometry(SOCKET_SIZE.width,SOCKET_SIZE.height,SOCKET_SIZE.depth,3,.06),tile=new RoundedBoxGeometry(TILE_SIZE.width,TILE_SIZE.height,TILE_SIZE.depth,4,.075);
 $effect(()=>()=>{[base,rim,face,inset,tile].forEach(g=>g.dispose());});
</script>
<T.Mesh geometry={base} rotation.x={-Math.PI/2} position={[0,.02,BOARD_FACE.centreZ]} material={lib.wood} castShadow receiveShadow/>
<T.Mesh geometry={rim} rotation.x={-Math.PI/2} position={[0,.33,BOARD_FACE.centreZ]} material={lib.brass} castShadow receiveShadow/>
<T.Mesh geometry={face} rotation.x={-Math.PI/2} position={[0,.41,BOARD_FACE.centreZ]} material={lib.enamel} receiveShadow/>
{#each LENGTHS as length,index}
 {@const c=index+2}
 {#each Array.from({length}) as _,i}
  {@const p=cell(c,i+1)}
  <T.Mesh geometry={inset} position={[p[0],.525,p[2]]} material={lib.darkBrass} receiveShadow/>
  <T.Mesh geometry={tile} position={[p[0],.58,p[2]]} material={lib.ivory} castShadow receiveShadow/>
  {#if closed.includes(c)}
   <T.Mesh position={[p[0],.639,p[2]]} rotation.x={-Math.PI/2}><T.PlaneGeometry args={[.57,.57]}/><T.MeshBasicMaterial color="#642920" transparent opacity={.35} depthWrite={false}/></T.Mesh>
  {/if}
 {/each}
 <Inscription text={String(c)} position={trackLabel(c)} inactive={closed.includes(c)} width={LABEL_SIZE.width} height={LABEL_SIZE.depth}/>
 {#if highlight===c}
  {@const p=cell(c,length)}
  <T.Mesh position={[p[0],.65,p[2]]} rotation.x={-Math.PI/2}><T.RingGeometry args={[.29,.38,4,1,Math.PI/4]}/><T.MeshBasicMaterial color="#ffd489" toneMapped={false}/></T.Mesh>
  <T.PointLight position={[p[0],1.0,p[2]]} color="#ffd282" intensity={2} distance={2.5}/>
 {/if}
{/each}
{#each preview as item}
 <T.Mesh position={[item.position[0],.65,item.position[2]]} rotation.x={-Math.PI/2}><T.RingGeometry args={[.23,.30,48]}/><T.MeshBasicMaterial color="#ffe0a0" toneMapped={false} transparent opacity={.85}/></T.Mesh>
 <T.Mesh position={[item.position[0],.645,item.position[2]]} rotation.x={-Math.PI/2}><T.PlaneGeometry args={[.57,.57]}/><T.MeshBasicMaterial color="#edb254" toneMapped={false} transparent opacity={.22} depthWrite={false}/></T.Mesh>
{/each}

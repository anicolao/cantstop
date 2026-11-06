<script lang="ts">
 import {T} from '@threlte/core';
 import {slab,outline} from './geometry';
 import Inscription from './Inscription.svelte';
 import type {Library} from './materials';
 import type {Vec3} from '../presentation/frame';
 let {lib,text,sub='',position=[0,0,0],width=3.3,depth=.85,selected=false,disabled=false,values,interactive=true,onactivate=()=>{}}:{lib:Library;text:string;sub?:string;position?:Vec3;width?:number;depth?:number;selected?:boolean;disabled?:boolean;values?:{number:number;inactive:boolean}[];interactive?:boolean;onactivate?:()=>void}=$props();
 let hovered=$state(false),pressed=$state(false);
 const base=$derived(slab(outline(width,depth,.16),.14,.055));
 const face=$derived(slab(outline(width-.20,depth-.15,.12),.035,.025));
 $effect(()=>{const g=base;return()=>g.dispose();});$effect(()=>{const g=face;return()=>g.dispose();});
</script>
<T.Group {position} position.y={position[1]+(pressed?-.045:hovered && !disabled && interactive ? .035 : 0)}>
 <T.Mesh geometry={base} rotation.x={-Math.PI/2} material={lib.wood} castShadow receiveShadow/>
 <T.Mesh geometry={face} rotation.x={-Math.PI/2} position.y={.20} material={disabled?lib.buttonDisabled:selected||hovered?lib.buttonActive:lib.button} castShadow receiveShadow
  name={disabled||!interactive?'':`action:${text}`}
  onpointerdown={()=>{if(!disabled&&interactive)pressed=true;}} onpointerup={()=>pressed=false}
  onclick={(e:{stopPropagation:()=>void})=>{e.stopPropagation();if(!disabled&&interactive)onactivate();}} onpointerenter={()=>{if(!disabled&&interactive){hovered=true;document.body.style.cursor='pointer';}}} onpointerleave={()=>{hovered=false;pressed=false;document.body.style.cursor='';}}>
 </T.Mesh>
 {#if values}
  {#each values as value,i}
   <Inscription text={String(value.number)} position={[(i-.5)*width*.56,.273,0]} width={width*.32} height={depth*.60} dark inactive={value.inactive} opacity={disabled?.65:1}/>
  {/each}
  <Inscription text="+" position={[0,.273,0]} width={width*.16} height={depth*.43} dark opacity={disabled?.45:.7}/>
 {:else}
 <Inscription {text} {sub} position={[0,.273,0]} width={width-.38} height={sub?depth-.16:depth*.60} dark opacity={disabled?.48:1}/>
 {/if}
 {#each [-1,1] as side}
  <T.Mesh position={[side*(width/2-.16),.257,0]} rotation.x={-Math.PI/2}><T.SphereGeometry args={[.037,12,8]}/><T.MeshStandardMaterial color="#67431f" metalness={.7} roughness={.3}/></T.Mesh>
 {/each}
</T.Group>

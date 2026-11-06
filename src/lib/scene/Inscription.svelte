<script lang="ts">
 import {T} from '@threlte/core';
 import {labelTexture} from './materials';
 import type {Vec3} from '../presentation/frame';
 let {text,sub='',position=[0,0,0],width=2,height=.44,dark=false,opacity=1,inactive=false}:{text:string;sub?:string;position?:Vec3;width?:number;height?:number;dark?:boolean;opacity?:number;inactive?:boolean}=$props();
 const texture=$derived(labelTexture(text,sub,dark,width/height,inactive));
 $effect(()=>{const t=texture;return()=>t.dispose();});
</script>
<T.Mesh {position} rotation.x={-Math.PI/2}>
 <T.PlaneGeometry args={[width,height]}/>
 <T.MeshBasicMaterial map={texture} transparent {opacity} depthWrite={false} toneMapped={false}/>
</T.Mesh>

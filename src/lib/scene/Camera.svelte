<script lang="ts">
 import {T,useThrelte} from '@threlte/core';
 import {OrthographicCamera,Vector3} from 'three';
 import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
 import {onMount,untrack} from 'svelte';
 import {TABLETOP_SPAN} from '../presentation/tabletop';
 import {BOARD_FACE} from '../presentation/layout';
 let {tabletop=false,phone=false,preset='table',lowAngle=60,focus='table',orbit=false}:{tabletop?:boolean;phone?:boolean;preset?:string;lowAngle?:number;focus?:string;orbit?:boolean}=$props();
 const {size,renderer,invalidate}=useThrelte();
 const camera=new OrthographicCamera(-10,10,9,-9,.1,160);
 let controls:OrbitControls|undefined;
 const aim=new Vector3();
 $effect(()=>{
  const {width,height}=$size,aspect=width/Math.max(1,height);
  const landscape=phone&&aspect>1.2;
  const target=new Vector3(0,0,landscape?.25:phone?.25:.9);
  let span=landscape?Math.max(12.4,21/aspect):phone?Math.max(19.5,9/aspect):Math.max(16.3,19/aspect);
  if(focus!=='table'){target.set(0,.5,focus==='board'?BOARD_FACE.centreZ:0);span=focus==='board'?Math.max(13.7,15.5/aspect):focus==='dice'?Math.max(5.8,8.8/aspect):focus==='surface'?Math.max(7.6,9.8/aspect):Math.max(4.8,6.8/aspect);}
  const elevation=(tabletop?89.99:preset==='overhead'?89.8:preset==='low'?Math.max(15,Math.min(80,lowAngle)):phone?78:60)*Math.PI/180;
  if(!phone&&focus==='table'){
   // Fit the whole desktop arrangement, including the near-edge pairing tabs
   // and plaque bevels. Overhead needs more depth than the tilted table camera.
   const back=-7.3,front=10.1,lowest=-.2,highest=2.4;
   const sin=Math.sin(elevation),cos=Math.cos(elevation);
   target.z=(back+front)/2-(lowest+highest)/2*cos/sin;
   span=Math.max(16.3,(front-back)*sin+(highest-lowest)*cos+1.2,19/aspect);
  }
  if(tabletop){target.set(0,0,0);span=Math.max(TABLETOP_SPAN,44/aspect);}
  aim.copy(target);
  camera.left=-span*aspect/2;camera.right=span*aspect/2;camera.top=span/2;camera.bottom=-span/2;
  camera.position.copy(target).add(new Vector3(0,Math.sin(elevation)*30,Math.cos(elevation)*30));camera.lookAt(target);camera.updateProjectionMatrix();camera.updateMatrixWorld();
  untrack(()=>{if(controls){controls.target.copy(target);controls.update();}invalidate();});
 });
 onMount(()=>{controls=new OrbitControls(camera,renderer.domElement);controls.target.copy(aim);controls.enabled=orbit;controls.enableDamping=false;controls.minPolarAngle=.01;controls.maxPolarAngle=1.35;controls.minZoom=.5;controls.maxZoom=3;const change=()=>invalidate();controls.addEventListener('change',change);return()=>{controls?.removeEventListener('change',change);controls?.dispose();};});
 $effect(()=>{const enabled=orbit;if(controls)controls.enabled=enabled;});
</script>
<T is={camera} makeDefault manual/>

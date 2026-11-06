<script lang="ts">
 import {T,useThrelte} from '@threlte/core';
 import {interactivity} from '@threlte/extras';
 import {onMount} from 'svelte';
 import {Box3,Color,PMREMGenerator,Vector3,type WebGLRenderTarget, type Texture} from 'three';
 import {HDRLoader} from 'three/examples/jsm/loaders/HDRLoader.js';
 import {slab,outline} from './geometry';
 import {loadSurfaces,materials,disposeLibrary,type Library,type Surfaces} from './materials';
 import type {Frame,Vec3} from '../presentation/frame';
 import {previewPositions} from '../presentation/frame';
 import {cell,BOARD_FACE,BOARD_LAYERS,LABEL_SIZE,trackLabel,type BoardFraming} from '../presentation/layout';
 import {FINISH} from '../presentation/finish';
 import RunnerPodium from './RunnerPodium.svelte';
 import {pairingNumbers} from '../presentation/choices';
 import {pairings,PLAYERS,lengthOf} from '../model/game';
 import Camera from './Camera.svelte';import Board from './Board.svelte';import Token from './Token.svelte';import Die from './Die.svelte';import Plaque from './Plaque.svelte';import Inscription from './Inscription.svelte';
 let {frame,phone=false,selected=2,runnerColumn,focus='table',preset='table',lowAngle=60,players=PLAYERS,orbit=false,onPair=()=>{},onDestination=()=>{},onMove=()=>{},onRoll=()=>{},onStop=()=>{},onReady=()=>{},onTargets=()=>{},onFraming=()=>{}}:{frame:Frame;phone?:boolean;selected?:number;runnerColumn?:number;focus?:string;preset?:string;lowAngle?:number;players?:{name:string}[];orbit?:boolean;onPair?:(n:number)=>void;onDestination?:(n:number)=>void;onMove?:()=>void;onRoll?:()=>void;onStop?:()=>void;onReady?:()=>void;onFraming?:(framing:BoardFraming)=>void;onTargets?:(targets:{name:string;x:number;y:number}[])=>void}=$props();
 const {scene,renderer,invalidate,camera,size}=useThrelte();interactivity();
 let lib=$state.raw<Library>();let ready=$state(false);
 const table=slab(outline(28,25,.9),.25,.22),mat=slab(outline(24,21,.65),.06,.09);
 const tray=slab(outline(7.0,2.24,.5),.22,.08),trayLeather=slab(outline(6.65,1.9,.4),.035,.04);
 const mapleSample=slab(outline(6.5,1.9,.18),.16,.065);
 const disc=slab(outline(2.65,.68,.22),.09,.04),sampleTrack=slab(outline(1.35,1.35,.12),.08,.04);
 const landscape=$derived(phone&&$size.width/$size.height>1.2);
 const boardScale=$derived(landscape?.97:phone?.98:1);
 const boardX=$derived(landscape?-4.2:0);
 const boardZ=$derived(landscape?.25:phone?-1.1:-.8);
 const diceX=$derived(landscape?5.5:phone?0:-4.0),diceZ=$derived(landscape?-1.5:phone?6.25:7.7);
 const options=$derived(pairings(frame.state));
 const selection=$derived(options.find(p=>p.index===selected));
 const variant=$derived(selection?.variants.find(v=>runnerColumn===undefined||v.column===runnerColumn)??selection?.variants[0]);
 const ambiguous=$derived((selection?.variants.length??0)>1);
 const destinations=$derived((frame.state.phase==='choose'||frame.kind==='preview')&&variant&&(!ambiguous||runnerColumn!==undefined)?previewPositions(frame.state,variant.moves):[]);
 const closed=$derived(frame.claims.flat());
 const inactiveSums=$derived(selection?pairingNumbers(frame.state,selection,runnerColumn).filter(n=>n.inactive):[]);
 const moveColumns=$derived(Object.keys(variant?.moves??{}).map(Number));
 const moveText=$derived(ambiguous?(runnerColumn===undefined?'CHOOSE A RUNNER':`MOVE ${runnerColumn} ONLY`):!variant?'NO LEGAL MOVE':moveColumns.length===1?`MOVE ${moveColumns[0]}${variant.moves[moveColumns[0]]===2?' TWICE':''}`:`MOVE ${moveColumns.join(' & ')}`);
 const samplePositions=$derived(focus==='runner'?[-1.5,0,1.5]:[-2.1,-.7,.7,2.1]);
 const isChoose=$derived(frame.state.phase==='choose'||frame.kind==='preview');
 const riskNow=$derived(Object.entries(frame.state.runners).reduce((n,[c,p])=>n+p-(frame.state.saved[frame.state.active][+c]??0),0));
 const riskText=$derived(`${inactiveSums.length&&isChoose?inactiveSums.map(n=>`${n.number} ${n.reason}`).join(' · ')+' · ':''}${riskNow} steps at risk`);
 const diceFrame=$derived(frame.dice.map((value,i)=>{
  const progress=frame.diceProgress,remaining=1-progress;
  const finalX=(i-1.5)*1.43;
  const lift=progress<1?(Math.abs(Math.sin(progress*Math.PI*3.2+i*.35))*1.4+.15)*remaining:0;
  return {value,position:[finalX+Math.sin(i*2.4+progress*9)*remaining*.8,.84+lift,Math.cos(i*3+progress*7)*remaining*.5] as Vec3,rotation:[remaining*(8+i*.8),[-.12,.13,-.08,.17][i]+remaining*(10-i),remaining*(6+i*.5)] as Vec3};
 }));
 $effect(()=>{
  const currentFrame=frame,currentPhone=phone,currentPreset=preset,currentLowAngle=lowAngle,currentFocus=focus,currentSelected=selected,currentDestination=runnerColumn;
  const width=$size.width,height=$size.height,cam=$camera;
  if(!ready)return;
  const id=requestAnimationFrame(()=>{
   scene.updateMatrixWorld(true);cam.updateMatrixWorld();const targets:{name:string;x:number;y:number;bounds:{left:number;right:number;top:number;bottom:number}}[]=[];
   scene.traverse(object=>{if(object.name.startsWith('action:')){
    const p=object.getWorldPosition(new Vector3()).project(cam),box=new Box3().setFromObject(object.parent!);
    const corners=[box.min.x,box.max.x].flatMap(x=>[box.min.y,box.max.y].flatMap(y=>[box.min.z,box.max.z].map(z=>new Vector3(x,y,z).project(cam))));
    targets.push({name:object.name.slice(7),x:(p.x+1)*width/2,y:(1-p.y)*height/2,bounds:{left:Math.min(...corners.map(c=>(c.x+1)*width/2)),right:Math.max(...corners.map(c=>(c.x+1)*width/2)),top:Math.min(...corners.map(c=>(1-c.y)*height/2)),bottom:Math.max(...corners.map(c=>(1-c.y)*height/2))}});
   }});
   onTargets(targets);
   const board=scene.getObjectByName('game-board');
   if(board){
    const project=(point:Vec3)=>{const p=board.localToWorld(new Vector3(...point)).project(cam);return {x:(p.x+1)*width/2,y:(1-p.y)*height/2};};
    const tracks=Array.from({length:11},(_,i)=>{
     const column=i+2,label=trackLabel(column),corners=[-1,1].flatMap(x=>[-1,1].map(z=>project([label[0]+x*LABEL_SIZE.width/2,label[1],label[2]+z*LABEL_SIZE.depth/2])));
     return {column,...project(cell(column,1)),label:{left:Math.min(...corners.map(p=>p.x)),right:Math.max(...corners.map(p=>p.x)),top:Math.min(...corners.map(p=>p.y)),bottom:Math.max(...corners.map(p=>p.y))}};
    });
    onFraming({topCorner:project([0,.02,-BOARD_LAYERS.base.halfDepth]),bottomCorner:project([0,.02,BOARD_LAYERS.base.halfDepth]),leftCorner:project([-BOARD_LAYERS.base.halfWidth,.02,BOARD_LAYERS.base.centreZ]),rightCorner:project([BOARD_LAYERS.base.halfWidth,.02,BOARD_LAYERS.base.centreZ]),tracks});
   }
  });return()=>cancelAnimationFrame(id);
 });
 onMount(()=>{
  let disposed=false,surfaces:Surfaces|undefined,environment:WebGLRenderTarget|undefined;
  scene.background=new Color('#102529');renderer.setClearColor('#102529');
  void Promise.all([loadSurfaces(),new HDRLoader().loadAsync(`${import.meta.env.BASE_URL}materials/studio.hdr`)]).then(([maps,hdr])=>{
   if(disposed){Object.values(maps).forEach(t=>t.dispose());hdr.dispose();return;}
   surfaces=maps;const pmrem=new PMREMGenerator(renderer);environment=pmrem.fromEquirectangular(hdr);hdr.dispose();pmrem.dispose();scene.environment=environment.texture;scene.environmentIntensity=.4;
   lib=materials(maps);ready=true;invalidate();requestAnimationFrame(()=>requestAnimationFrame(onReady));
  }).catch(error=>console.error('Unable to load game materials',error));
  return()=>{disposed=true;if(lib)disposeLibrary(lib);if(surfaces)Object.values(surfaces).forEach((t:Texture)=>t.dispose());environment?.dispose();[table,mat,tray,trayLeather,disc,sampleTrack,mapleSample].forEach(g=>g.dispose());};
 });
</script>
<Camera {phone} {preset} {lowAngle} {focus} {orbit}/>
<T.HemisphereLight args={['#f7e8cc','#122831',.3]}/>
<T.DirectionalLight position={[-8,14,6]} color="#ffdfa6" intensity={2.5} castShadow shadow.mapSize.width={2048} shadow.mapSize.height={2048} shadow.camera.left={-15} shadow.camera.right={15} shadow.camera.top={15} shadow.camera.bottom={-15} shadow.camera.near={1} shadow.camera.far={45} shadow.bias={-.00015} shadow.normalBias={.02} shadow.radius={3}/>
<T.DirectionalLight position={[9,10,-10]} color="#b8dce5" intensity={.6}/>
<T.PointLight position={[-9,5,-6]} color="#f6b25c" intensity={65} distance={24} decay={2}/>
{#if lib && ready}
 <T.Mesh geometry={table} rotation.x={-Math.PI/2} position.y={-.75} material={lib.wood} receiveShadow/>
 <T.Mesh geometry={mat} rotation.x={-Math.PI/2} position.y={-.35} material={lib.cloth} receiveShadow/>
 {#if focus==='table'||focus==='board'}
  <T.Group name="game-board" position={[focus==='board'?0:boardX,0,focus==='board'?0:boardZ]} scale={focus==='board'?1:boardScale}>
   <RunnerPodium {lib}/>
   <Board {lib} {closed} highlight={frame.lightColumn} preview={destinations}/>
   {#each frame.pieces as piece (piece.id)}<Token {lib} position={piece.position} color={FINISH.players[piece.owner]} runner={piece.runner} opacity={piece.opacity} scale={piece.scale} owner={piece.owner}/>{/each}
  </T.Group>
 {/if}
 {#if focus==='table'}
  {#each players as player,i}
   {@const x=landscape?[-8.3,-.1,-10.4,-.1][i]:phone?[-3.3,-1.1,1.1,3.3][i]:[-6.9,6.9,-7.6,7.6][i]}
   {@const z=landscape?[-4.4,-4.4,3.7,3.7][i]:phone?[-8.05,-8.05,-8.05,-8.05][i]:[-5.85,-5.85,3.65,3.65][i]}
   <T.Group position={[x,0,z]} scale={phone&&!landscape?.65:phone?.88:1}>
    <T.Mesh position.y={.03} castShadow><T.CylinderGeometry args={[.69,.75,.13,64]}/><T.MeshPhysicalMaterial color="#b9904b" metalness={.7} roughness={.32}/></T.Mesh>
    <T.Mesh position.y={.12}><!-- Medal is horizontal, unlike a UI badge. -->
     <T.CylinderGeometry args={[.58,.58,.07,64]}/><T.MeshPhysicalMaterial color={FINISH.players[i]} roughness={.27} metalness={.25} clearcoat={.8}/>
    </T.Mesh>
    <Inscription text={player.name.trim().slice(0,1).toUpperCase()} position={[0,.23,0]} width={.75} height={.70}/>
    <Plaque {lib} text={`${player.name.toUpperCase()}   ${frame.claims[i].length}/3`} position={[0,.015,.98]} width={phone&&!landscape?3.05:phone?2.5:2.9} depth={.65} selected={frame.state.active===i} interactive={false}/>
    {#each Array.from({length:frame.claims[i].length}) as _,j}<Token {lib} color={FINISH.players[i]} position={[(j-.5)*.6,.02,1.65]} scale={.8} owner={i}/>{/each}
   </T.Group>
  {/each}
 {/if}
 {#if focus==='table'||focus==='dice'}
  <T.Group position={[focus==='dice'?0:diceX,0,focus==='dice'?0:diceZ]}>
   <T.Mesh geometry={tray} rotation.x={-Math.PI/2} material={lib.wood} castShadow receiveShadow/>
   <T.Mesh geometry={trayLeather} rotation.x={-Math.PI/2} position.y={.24} material={lib.leather} receiveShadow/>
   {#each diceFrame as die,i}<Die {lib} value={die.value} position={die.position} rotation={die.rotation} selected={isChoose&&selection?.dice[0].includes(i)}/>{/each}
   <Inscription text="✧     FORTUNE FAVOURS THE BRAVE     ✧" position={[0,.30,.90]} width={5.4} height={.21}/>
  </T.Group>
 {/if}
 {#if focus==='table'}
  {#if isChoose}
   <T.Group position={[landscape?5.5:phone?0:-4.0,.04,landscape?.3:phone?7.85:9.4]}>
    {#each options as option,i}
     <Plaque {lib} text={option.sums.join(' + ')} values={pairingNumbers(frame.state,option,option.index===selected?runnerColumn:undefined)} width={2.06} depth={.72} position={[(i-1)*2.32,0,0]} selected={i===selected} disabled={!option.variants.length} onactivate={()=>onPair(i)}/>
    {/each}
   </T.Group>
   {#if ambiguous}
    <T.Group position={[landscape?5.5:phone?0:4,.04,landscape?1.8:phone?8.65:6.0]}>
     {#each selection?.variants??[] as v,i}
      <Plaque {lib} text={`RUNNER ON ${v.column}`} position={[(i-.5)*(phone?3.6:2.9),0,0]} width={phone?3.3:2.65} depth={phone&&!landscape?.65:.86} selected={runnerColumn===v.column} onactivate={()=>onDestination(v.column!)}/>
     {/each}
    </T.Group>
   {/if}
   <Plaque {lib} text={moveText} position={[landscape?5.5:phone?0:4.0,.04,(landscape?1.95:phone?9.05:6.35)+(ambiguous?(phone&&!landscape?.4:1.3):0)]} width={phone?7.05:5.45} depth={ambiguous&&phone&&!landscape?.85:1.1} selected disabled={!variant||(ambiguous&&runnerColumn===undefined)} onactivate={onMove}/>
   <Inscription text={riskText} position={[landscape?5.5:phone?0:4,.08,phone&&!landscape&&ambiguous?9.95:(landscape?3.0:phone?9.95:7.6)+(ambiguous?1.3:0)]} width={phone?5:4.4} height={.40}/>
  {:else if frame.state.phase==='finished'}
   <Plaque {lib} text={`THREE SUMMITS. ${players[frame.state.active]?.name.toUpperCase()} WINS.`} position={[landscape?5.5:phone?0:4,.04,landscape?2:phone?8.15:6.7]} width={phone?7:6.3} depth={1.05} selected/>
  {:else}
   <Plaque {lib} text={frame.state.phase==='ready'?'ROLL DICE':'STOP & SAVE'} position={[landscape?5.5:phone?0:4.0,.04,landscape?1.25:phone?8.05:6.25]} width={phone?7.05:5.45} depth={1.0} selected onactivate={frame.state.phase==='ready'?onRoll:onStop}/>
   {#if frame.state.phase!=='ready'}<Plaque {lib} text="ROLL AGAIN" position={[landscape?5.5:phone?0:4.0,.04,landscape?2.8:phone?9.15:7.85]} width={phone?7.05:5.45} depth={.95} onactivate={onRoll}/>{/if}
   <Inscription text={riskText} position={[landscape?5.5:phone?0:-4.0,.05,landscape?4.0:phone?9.95:9.5]} width={4.8} height={.40}/>
  {/if}
 {/if}
 {#if focus==='runner'||focus==='token'}
  <T.Mesh geometry={disc} rotation.x={-Math.PI/2} scale={[2.8,4,1]} material={lib.enamel} receiveShadow/>
  {#each samplePositions as x,i}
   <T.Mesh geometry={sampleTrack} rotation.x={-Math.PI/2} position={[x,.22,0]} material={lib.ivory} castShadow receiveShadow/>
   <Token {lib} position={[x,.36,0]} runner={focus==='runner'} color={FINISH.players[i]} scale={2.2} owner={i}/>
  {/each}
 {/if}
 {#if focus==='plaque'}
  <Plaque {lib} text="ROLL AGAIN" position={[0,.2,-1.2]} width={5.5} depth={1.4} onactivate={onRoll}/>
  <Plaque {lib} text="STOP & SAVE" position={[0,.2,1.2]} width={5.5} depth={1.4} selected onactivate={onStop}/>
 {/if}
 {#if focus==='surface'}
  <T.Group position={[-1.8,.3,-1.7]}><T.Mesh geometry={disc} rotation.x={-Math.PI/2} scale={[1.1,2.4,1]} material={lib.wood} castShadow/><Inscription text="WALNUT" position={[0,.25,.1]} width={2.5}/></T.Group>
  <T.Group position={[1.8,.3,-1.7]}><T.Mesh geometry={disc} rotation.x={-Math.PI/2} scale={[1.1,2.4,1]} material={lib.enamel} castShadow/><Inscription text="LACQUER" position={[0,.25,.1]} width={2.5}/></T.Group>
  <T.Group position={[0,.3,1.25]}>
   <T.Mesh name="material-sample:maple" geometry={mapleSample} rotation.x={-Math.PI/2} material={lib.button} castShadow receiveShadow/>
   <Inscription text="MAPLE" position={[0,.015,1.55]} width={3.8} height={.35}/>
  </T.Group>
 {/if}
{/if}

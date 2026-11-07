<script lang="ts">
 import {Canvas} from '@threlte/core';
 import {PCFSoftShadowMap,ACESFilmicToneMapping} from 'three';
 import Scene from '../scene/Scene.svelte';
 import type {Frame} from '../presentation/frame';
 import {pairingNumbers} from '../presentation/choices';
 import {pairings,type State as BoardState} from '../model/game';
 import {SEATS,type SeatId,type SeatPose} from '../presentation/tabletop';
 import {FINISH} from '../presentation/finish';
 import {PIECE_SCALE,type BoardFraming} from '../presentation/layout';
 let {frame,tabletop=false,seats={},tabletopPose={x:-9.2,z:9,angle:0},tabletopTurning=false,choosingSeat=null,onSeatPlayer=()=>{},onSeat=()=>{},onMenu=()=>{},directSelection=false,decisionReady=true,choiceState,phone=false,selected=2,runnerColumn,focus='table',preset='table',lowAngle=60,players,canAct=true,orbit=false,onPair=()=>{},onDestination=()=>{},onMove=()=>{},onRoll=()=>{},onStop=()=>{}}:{frame:Frame;tabletop?:boolean;seats?:Record<string,SeatId>;tabletopPose?:SeatPose;tabletopTurning?:boolean;choosingSeat?:number|null;onSeatPlayer?:(index:number)=>void;onSeat?:(seat:SeatId)=>void;onMenu?:()=>void;directSelection?:boolean;decisionReady?:boolean;choiceState?:BoardState;phone?:boolean;selected?:number;runnerColumn?:number;focus?:string;preset?:string;lowAngle?:number;players?:{id?:string;name:string}[];canAct?:boolean;orbit?:boolean;onPair?:(n:number)=>void;onDestination?:(n:number)=>void;onMove?:()=>void;onRoll?:()=>void;onStop?:()=>void}=$props();
 let ready=$state(false),failure=$state(false);
 let framing=$state<BoardFraming>();
 let targets=$state<{name:string;x:number;y:number}[]>([]);
 const selectionState=$derived(choiceState&&choiceState.active===frame.state.active&&choiceState.rollIndex===frame.state.rollIndex?choiceState:frame.state);
 const available=$derived(pairings(selectionState));
</script>
<div class="table-view" data-table-view data-tabletop={tabletop} data-tabletop-turning={tabletopTurning} data-tabletop-pose={JSON.stringify(tabletopPose)} data-seats={JSON.stringify(seats)} data-selected-pairing={selected} data-motion-idle={frame.progress>=1} data-board-framing={JSON.stringify(framing)} data-track-finish="ivory" data-runner-colour={FINISH.runner} data-player-colours={JSON.stringify(FINISH.players)} data-piece-scale={PIECE_SCALE} data-pieces={JSON.stringify(frame.pieces)} data-targets={JSON.stringify(targets)} data-runners={JSON.stringify(frame.pieces.filter(p=>p.runner&&p.onBoard).map(p=>({id:p.id,position:p.position,opacity:p.opacity})))} data-ready={ready} data-kind={frame.kind} data-phase={frame.state.phase} data-phone={phone} data-render-quality="shared" data-piece-count={frame.pieces.length}>
 <svelte:boundary onerror={(error)=>{failure=true;console.error(error);}}>
  <Canvas toneMapping={ACESFilmicToneMapping} shadows={PCFSoftShadowMap} dpr={Math.min(window.devicePixelRatio,1.75)} renderMode="on-demand">
   <Scene {frame} {tabletop} {seats} {tabletopPose} {choosingSeat} {onSeatPlayer} {onSeat} {onMenu} {directSelection} {decisionReady} choiceState={selectionState} {canAct} {phone} {selected} {runnerColumn} {focus} {preset} {lowAngle} {players} {orbit} {onPair} {onDestination} {onMove} {onRoll} {onStop} onFraming={(value)=>framing=value} onTargets={(value)=>targets=value} onReady={()=>ready=true}/>
  </Canvas>
  {#snippet failed()}<div class="load-message">This 3D scene needs WebGL.<br><small>Try a browser with hardware acceleration enabled.</small></div>{/snippet}
 </svelte:boundary>
 <div class="scene-vignette"></div>
 {#if !ready&&!failure}<div class="load-message"><span class="loading-diamond">◇</span> Preparing the table…<small>Walnut · lacquer · ruby · ivory</small></div>{/if}
 {#if ready&&focus==='table'&&!tabletop}
  <div class="scene-caption" class:phone aria-live="polite"><p>{frame.label}</p><small>{frame.detail}</small></div>
 {/if}
 {#if tabletop}<span class="tabletop-announcement" aria-live="polite">{frame.label}. {frame.detail}</span>{/if}
 {#if frame.dim>0}<div class="connection-shade" style:opacity={frame.dim}></div>{/if}
 <div class="keyboard-controls" aria-label="Game controls">
  {#if tabletop&&choosingSeat!==null}
   {#each SEATS as seat}<button onclick={()=>onSeat(seat.id)}>Seat {seat.label}</button>{/each}
  {:else if frame.state.phase==='choose'||directSelection&&frame.state.phase==='decide'}
   {#each available as p}<button disabled={!canAct||!p.variants.length} aria-pressed={selected===p.index} onfocus={()=>{if(!directSelection)onPair(p.index);}} onclick={()=>onPair(p.index)}>Pair {pairingNumbers(selectionState,p,p.index===selected?runnerColumn:undefined).map(n=>`${n.number}${n.inactive?` (${n.reason})`:''}`).join(' and ')}</button>{/each}
   {#each available.find(p=>p.index===selected)?.variants??[] as v}
    {#if (available.find(p=>p.index===selected)?.variants.length??0)>1}<button disabled={!canAct} aria-pressed={runnerColumn===v.column} onclick={()=>onDestination(v.column!)}>Use runner on {v.column}</button>{/if}
   {/each}
   {#if !directSelection}<button disabled={!canAct||!available.find(p=>p.index===selected)?.variants.length||((available.find(p=>p.index===selected)?.variants.length??0)>1&&runnerColumn===undefined)} onclick={onMove}>Move selected pairing</button>{/if}
  {/if}
  {#if choosingSeat===null&&(frame.state.phase==='decide'||!directSelection&&frame.state.phase==='ready')}
   <button disabled={!canAct||!decisionReady} onclick={onRoll}>{frame.state.phase==='ready'?'Roll dice':'Roll again'}</button>
   {#if frame.state.phase==='decide'}<button disabled={!canAct||!decisionReady} onclick={onStop}>Stop and save</button>{/if}
  {/if}
  {#if tabletop}{#each players??[] as player,i}<button onclick={()=>onSeatPlayer(i)}>Choose seat for {player.name}</button>{/each}<button onclick={onMenu}>Table menu</button>{/if}
 </div>
</div>
<style>
 .tabletop-announcement{position:absolute;width:1px;height:1px;clip-path:inset(50%);overflow:hidden}
 .scene-vignette{position:absolute;inset:0;pointer-events:none;box-shadow:inset 0 0 90px 25px #04101155;background:radial-gradient(ellipse at 46% 38%,transparent 30%,#06121b40 100%)}.table-view{width:100%;height:100%;position:relative;overflow:hidden;background:#102529;touch-action:manipulation;container-type:size}.table-view :global(canvas){display:block;outline:none}.scene-caption{position:absolute;top:22px;left:22%;right:22%;text-align:center;pointer-events:none;color:#f5e1bb;text-shadow:0 2px 12px #000;z-index:1}.scene-caption p{font-family:Georgia,serif;font-size:21px;margin:0}.scene-caption small{display:block;font-size:11px;letter-spacing:.04em;color:#e0ceaaa3;margin-top:7px}.scene-caption.phone{top:15px;left:5%;right:5%}.scene-caption.phone p{font-size:19px}.scene-caption.phone small{font-size:10px}.load-message{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:16px;font:20px Georgia,serif;background:#102529;color:#edd7a9}.load-message small{font:11px Arial,sans-serif;letter-spacing:.12em;color:#c6b99280}.loading-diamond{font-size:46px;color:#e4b76a;animation:breathe 1.2s infinite alternate}@container (min-aspect-ratio:6/5){.scene-caption.phone{left:57%;right:4%;top:16px}.scene-caption.phone small{display:none}}@keyframes breathe{to{opacity:.3;transform:rotate(90deg)}}.connection-shade{position:absolute;inset:0;background:#07141c;pointer-events:none}.keyboard-controls{position:absolute;width:1px;height:1px;clip-path:inset(50%);overflow:hidden}.keyboard-controls:focus-within{width:auto;height:auto;clip-path:none;left:12px;right:12px;bottom:12px;display:flex;gap:8px;flex-wrap:wrap;background:#12282fee;padding:12px;z-index:4}.keyboard-controls button{color:#f6e1bd;background:#57391e;border:1px solid #ccae75;padding:10px}
</style>

<script lang="ts">
 import {T} from '@threlte/core';
 import {slab,outline} from './geometry';
 import type {Library} from './materials';
 import type {Frame,Vec3} from '../presentation/frame';
 import {pairings,type State as BoardState} from '../model/game';
 import {pairingNumbers} from '../presentation/choices';
 import {FINISH} from '../presentation/finish';
 import {SEATS,assignSeats,seatPose,type SeatId,type SeatPose} from '../presentation/tabletop';
 import {COLOUR_NAMES} from '../../game/seating';
 import Die from './Die.svelte';import Plaque from './Plaque.svelte';import Inscription from './Inscription.svelte';
 let {lib,frame,walkup=false,gathering=false,pickingSeat=null,onPickSeat=()=>{},onColour=()=>{},onBegin=()=>{},choiceState,players,seats,pose,selected,runnerColumn,canAct,decisionReady,directSelection,choosingSeat,onSeatPlayer,onSeat,onPair,onDestination,onMove,onRoll,onStop,onMenu}:{lib:Library;walkup?:boolean;gathering?:boolean;pickingSeat?:SeatId|null;onPickSeat?:(seat:SeatId|null)=>void;onColour?:(colour:number)=>void;onBegin?:(actor:string)=>void;frame:Frame;choiceState:BoardState;players:{id:string;name:string;colour?:number}[];seats:Record<string,SeatId>;pose:SeatPose;selected:number;runnerColumn?:number;canAct:boolean;decisionReady:boolean;directSelection:boolean;choosingSeat:number|null;onSeatPlayer:(index:number)=>void;onSeat:(seat:SeatId)=>void;onPair:(pairing:number)=>void;onDestination:(column:number)=>void;onMove:()=>void;onRoll:()=>void;onStop:()=>void;onMenu:(index?:number)=>void}=$props();
 const places=$derived(assignSeats(players,seats));
 const tray=slab(outline(7,2.24,.5),.22,.08),leather=slab(outline(6.65,1.9,.4),.035,.04);
 const options=$derived(pairings(choiceState)),selection=$derived(options.find(p=>p.index===selected));
 const ambiguous=$derived((selection?.variants.length??0)>1);
 const choosing=$derived(frame.state.phase==='choose'||directSelection&&frame.state.phase==='decide');
 $effect(()=>()=>{tray.dispose();leather.dispose();});
</script>
{#each players as player,i}
 {@const seat=seatPose(places[player.id])}
 <T.Group position={[seat.x,0,seat.z]} rotation.y={seat.angle}>
  <T.Mesh position={[-3.6,.12,-3.25]} castShadow><T.CylinderGeometry args={[.65,.69,.16,48]}/><T.MeshPhysicalMaterial color={FINISH.players[player.colour??i]} roughness={.27} metalness={.25} clearcoat={.8}/></T.Mesh>
  <Inscription text={player.name.trim().slice(0,1).toUpperCase()} position={[-3.6,.23,-3.25]} width={.8} height={.75}/>
  <Plaque {lib} text={`${player.name.toUpperCase()} · ${frame.claims[i].length}/3`} sub={gathering?'READY TO PLAY':'TOUCH TO CHOOSE YOUR SEAT'} interactive={!gathering} position={[0,.04,-3.25]} width={5.3} depth={1.1} selected={frame.state.active===i} onactivate={()=>onSeatPlayer(i)}/>
  {#if walkup&&gathering}
  <Plaque {lib} text={players.length<2?'WAITING FOR ANOTHER COLOUR':'START GAME'} position={[0,.04,1.35]} width={6} depth={1.2} disabled={!canAct||players.length<2||pickingSeat!==null} onactivate={()=>onBegin(player.id)}/>
  <Plaque {lib} text="TABLE MENU" position={[4.9,.04,.45]} width={2.5} depth={1.3} onactivate={()=>onMenu(i)}/>
 {/if}
 </T.Group>
{/each}
{#if walkup&&gathering}
 {#each SEATS as seat}
  {#if !players.some(p=>places[p.id]===seat.id)&&pickingSeat!==seat.id}
   <T.Group position={[seat.pose.x,0,seat.pose.z]} rotation.y={seat.pose.angle}><Plaque {lib} text={`TAKE ${seat.label.toUpperCase()} SEAT`} sub="TOUCH TO CHOOSE A COLOUR" position={[0,.04,.5]} width={7.1} depth={1.45} disabled={!canAct} onactivate={()=>onPickSeat(seat.id)}/></T.Group>
  {/if}
 {/each}
 {#if pickingSeat}
  {@const pick=seatPose(pickingSeat)}
  <T.Group position={[pick.x,0,pick.z]} rotation.y={pick.angle}>
   {#each COLOUR_NAMES as colour,i}
    {@const taken=players.some(p=>p.colour===i)}
    <T.Group position={[(i%2-.5)*3.65,.04,Math.floor(i/2)*1.8-1]}>
     <T.Mesh position={[0,.16,-.15]} castShadow name={taken||!canAct?'':`action:CHOOSE ${colour.toUpperCase()}`} onclick={(event:{stopPropagation:()=>void})=>{event.stopPropagation();if(!taken&&canAct)onColour(i);}}><T.CylinderGeometry args={[.63,.69,.2,48]}/><T.MeshPhysicalMaterial color={FINISH.players[i]} roughness={.27} metalness={.25} clearcoat={.8} transparent opacity={taken?.3:1}/></T.Mesh>
     <Plaque {lib} text={`CHOOSE ${colour.toUpperCase()}`} position={[0,.04,.68]} width={3.35} depth={.85} disabled={taken||!canAct} onactivate={()=>onColour(i)}/>
    </T.Group>
   {/each}
   <Plaque {lib} text="CANCEL COLOUR" position={[4.9,.04,.45]} width={2.5} depth={1.3} onactivate={()=>onPickSeat(null)}/>
  </T.Group>
 {/if}
{/if}
{#if !gathering}<T.Group name="tabletop-dock" position={[pose.x,0,pose.z]} rotation.y={pose.angle}>
 <T.Group position={[0,0,-1.55]}>
  <T.Mesh geometry={tray} rotation.x={-Math.PI/2} material={lib.wood} castShadow receiveShadow/>
  <T.Mesh geometry={leather} rotation.x={-Math.PI/2} position.y={.24} material={lib.leather} receiveShadow/>
  {#each frame.dice as value,i}
   {@const p=frame.diceProgress}{@const r=1-p}
   <Die {lib} {value} position={[(i-1.5)*1.43+Math.sin(i*2.4+p*9)*r*.8,.84+(p<1?(Math.abs(Math.sin(p*Math.PI*3.2+i*.35))*1.4+.15)*r:0),Math.cos(i*3+p*7)*r*.5] as Vec3} rotation={[r*(8+i*.8),[-.12,.13,-.08,.17][i]+r*(10-i),r*(6+i*.5)]} selected={choosing&&selection?.dice[0].includes(i)}/>
  {/each}
 </T.Group>
 {#if choosingSeat===null}
  {#if choosing}
   {#each options as option,i}<Plaque {lib} text={option.sums.join(' + ')} values={pairingNumbers(choiceState,option,i===selected?runnerColumn:undefined)} position={[(i-1)*2.32,.04,.1]} width={2.06} depth={.85} selected={selected===i} disabled={!canAct||!option.variants.length} onactivate={()=>onPair(i)}/>{/each}
   {#if ambiguous}
    {#each selection?.variants??[] as variant,i}<Plaque {lib} text={`RUNNER ON ${variant.column}`} position={[(i-.5)*3.6,.04,1.12]} width={3.4} depth={.85} selected={runnerColumn===variant.column} disabled={!canAct} onactivate={()=>onDestination(variant.column!)}/>{/each}
   {/if}
   {#if !directSelection}<Plaque {lib} text="MOVE SELECTED PAIRING" position={[0,.04,ambiguous?2.15:1.35]} width={7} depth={1} disabled={!canAct||!selection?.variants.length||ambiguous&&runnerColumn===undefined} onactivate={onMove}/>{/if}
  {/if}
  {#if frame.state.phase==='decide'}
   <Plaque {lib} text="STOP & SAVE" position={[-1.8,.04,ambiguous?2.15:1.35]} width={3.45} depth={1} selected disabled={!canAct||!decisionReady} onactivate={onStop}/>
   <Plaque {lib} text="ROLL AGAIN" position={[1.8,.04,ambiguous?2.15:1.35]} width={3.45} depth={1} disabled={!canAct||!decisionReady} onactivate={onRoll}/>
  {:else if !directSelection&&frame.state.phase==='ready'}<Plaque {lib} text="ROLL DICE" position={[0,.04,1.35]} width={7} depth={1} disabled={!canAct} onactivate={onRoll}/>{/if}
  <Plaque {lib} text="TABLE MENU" position={[4.9,.04,.45]} width={2.5} depth={1.3} onactivate={onMenu}/>
  <Inscription text={frame.label.toUpperCase()} position={[0,.1,ambiguous?3.05:2.35]} width={7.1} height={.45}/>
 {/if}
</T.Group>{/if}
{#if choosingSeat!==null}
 {#each SEATS as seat}
  {@const occupant=players.find(p=>places[p.id]===seat.id)}
  <T.Group position={[seat.pose.x,0,seat.pose.z]} rotation.y={seat.pose.angle}>
   <Plaque {lib} text={`SEAT ${seat.label.toUpperCase()}`} sub={occupant&&occupant!==players[choosingSeat]?`${occupant.name.toUpperCase()} IS HERE`:`${players[choosingSeat].name.toUpperCase()} · SIT HERE`} position={[0,.04,1.15]} width={7.1} depth={1.45} selected={occupant===players[choosingSeat]} disabled={!!occupant&&occupant!==players[choosingSeat]} onactivate={()=>onSeat(seat.id)}/>
  </T.Group>
 {/each}
{/if}

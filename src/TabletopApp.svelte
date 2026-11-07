<script lang="ts">
 import DiceTowerPicker from './lib/components/DiceTowerPicker.svelte';
 import DiceTowerBridge from './lib/components/DiceTowerBridge.svelte';
 import {savedTower} from './game/towers/model';
 import {BOT_LEVELS,botLabel,type BotLevel} from './game/companion';
 import {onMount,untrack} from 'svelte';
 import TableView from './lib/components/TableView.svelte';
 import {initialState,replay,chooseBot,choiceBoard,type State,type Event,type Intent} from './game/engine';
 import {COLOUR_NAMES} from './game/seating';
 import {repository,playerIdentity} from './game/repository';
 import {newLocalIdentity,localIdentities} from './game/local-players';
 import {randomId} from './game/random-id';
 import {previewScope} from './firebase';
 import {frameFor,transitions} from './game/presentation';
 import {pairings,equivalentMove,type State as BoardState} from './lib/model/game';
 import {sample} from './lib/presentation/frame';
 import type {Transition} from './lib/presentation/catalog';
 import {assignSeats,seatPose,seatTravel,TABLETOP_SPAN,type SeatId,type SeatPose} from './lib/presentation/tabletop';
 import {normalizePreferences,SETTINGS_KEY,RATES} from './game/settings';
 const sessionKey=`cantstop:walkup:${previewScope}`;
 const empty:BoardState={version:1,seed:0,rollIndex:0,active:0,phase:'ready',saved:[{},{},{},{}],runners:{},claims:[[],[],[],[]],dice:[1,1,1,1],lastOutcome:'none'};
 const emptyFrame={...sample({before:empty,after:empty,kind:'ready',duration:1},1),label:'Choose a seat and a colour',detail:'Two to four colours. Start when ready.'};
 let tower=$state<string|null>(null),towerStatus=$state('');
 let room=$state(''),viewer=$state(''),locals=$state<string[]>([]),tableState=$state.raw<State>(initialState(3)),events=$state.raw<Event[]>([]);
 let repo=$state.raw<ReturnType<typeof repository>>(),loaded=$state(false),sending=$state(false),error=$state('');
 let selected=$state(-1),runnerColumn=$state<number>(),pickingSeat=$state<SeatId|null>(null),choosingSeat=$state<number|null>(null);
 let companionLevel=$state<BotLevel>('standard'),companionColour=$state(1);
 let seatsSaved=$state<Record<string,SeatId>>({});
 let step=$state.raw<Transition|null>(null),queue=$state.raw<Transition[]>([]),time=$state(0),reduced=$state(false);
 let speed=$state<'standard'|'fast'|'blazing'>('standard'),menu=$state(false),rules=$state(false),aspect=$state(16/9);
 let pose=$state<SeatPose>({...seatPose('south-left')}),menuPose=$state<SeatPose>({...seatPose('south-left')}),turning=$state(false);
 let motion:{from:SeatPose;to:SeatPose;start:number;duration:number}|null=null,target='',initialized=false;
 const host=$derived(viewer!==''&&tableState.host===viewer);
 const freeColours=$derived(COLOUR_NAMES.map((name,colour)=>({name,colour})).filter(c=>!tableState.players.some(p=>p.colour===c.colour)));
 const gathering=$derived(tableState.phase==='gathering');
 const places=$derived(assignSeats(tableState.players,{...Object.fromEntries(tableState.players.map(p=>[p.id,p.seat])),...seatsSaved}));
 const frame=$derived(frameFor(tableState,reduced?null:step,time,reduced)??emptyFrame);
 const moving=$derived(!!step&&!reduced&&(time<step.duration||queue.length>0));
 const active=$derived(tableState.players[tableState.game?.active??0]);
 const ownsTurn=$derived(!!active&&(active.id===viewer||locals.includes(active.id)));
 const canAct=$derived(loaded&&!sending&&!moving&&!turning&&!menu&&(gathering||ownsTurn)&&choosingSeat===null);
 const board=$derived(choiceBoard(tableState));
 const options=$derived(board?pairings(board):[]);
 const decisionReady=$derived(!!tableState.choice&&tableState.choice.pairing===selected&&tableState.choice.column===runnerColumn);
 const overlayPose=$derived(menu?menuPose:pose);
 const worldHeight=$derived(Math.max(TABLETOP_SPAN,44/aspect));
 onMount(()=>{
  tower=savedTower();
  if(!/\/tt\/?$/.test(location.pathname))history.replaceState(null,'',`${import.meta.env.BASE_URL}tt/`);
  try{speed=normalizePreferences(JSON.parse(localStorage.getItem(SETTINGS_KEY)??'{}')).animationSpeed;room=localStorage.getItem(sessionKey)??'';}catch{}
  if(!/^[A-F0-9]{8}$/.test(room))room=randomId().replaceAll('-','').slice(0,8).toUpperCase();
  const media=matchMedia('(prefers-reduced-motion: reduce)');reduced=media.matches;
  const resize=()=>aspect=innerWidth/innerHeight;resize();window.addEventListener('resize',resize);
  const changed=()=>reduced=media.matches;media.addEventListener('change',changed);
  let last=performance.now(),id=0;
  const tick=(now:number)=>{
   if(motion){const p=reduced?1:Math.min(1,(now-motion.start)/motion.duration);pose=seatTravel(motion.from,motion.to,p);if(p>=1){pose=motion.to;motion=null;turning=false;}}
   if(step&&!document.hidden&&!reduced){time=Math.min(step.duration,time+Math.max(0,(now-last)/1000)*RATES[speed]);if(time>=step.duration&&queue.length){step=queue[0];queue=queue.slice(1);time=0;}}
   last=now;id=requestAnimationFrame(tick);
  };id=requestAnimationFrame(tick);
  const visibility=()=>{if(document.hidden){step=null;queue=[];time=0;if(motion)pose=motion.to;motion=null;turning=false;}last=performance.now();};
  const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'){menu=false;pickingSeat=null;choosingSeat=null;}};
  document.addEventListener('visibilitychange',visibility);window.addEventListener('keydown',escape);
  return()=>{cancelAnimationFrame(id);window.removeEventListener('resize',resize);media.removeEventListener('change',changed);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('keydown',escape);};
 });
 $effect(()=>{
  const table=room;if(!table)return;let closed=false,connection:ReturnType<typeof repository>|undefined;
  loaded=false;events=[];tableState=initialState(3);step=null;queue=[];pickingSeat=null;choosingSeat=null;
  try{localStorage.setItem(sessionKey,table);seatsSaved=JSON.parse(localStorage.getItem(`${sessionKey}:seats:${table}`)??'{}');}catch{seatsSaved={};}
  void Promise.all([playerIdentity(),localIdentities(table)]).then(([uid,ids])=>{
   if(closed)return;viewer=uid;locals=ids;
   connection=repository(table,next=>{
    if(closed)return;const before=tableState,wasLoaded=loaded;
    if(wasLoaded&&next.length<events.length)return;
    const after=next.length?replay(next):initialState(3);
    if(wasLoaded&&next.length===events.length+1&&!document.hidden&&!reduced){const steps=transitions(before,next.at(-1)!);step=steps[0]??null;queue=steps.slice(1);time=0;}else if(!wasLoaded||next.length>events.length+1||document.hidden){step=null;queue=[];time=0;}
    tableState=after;events=next;loaded=true;selected=after.choice?.pairing??-1;runnerColumn=after.choice?.column;if(after.phase!=='gathering')pickingSeat=null;error='';
   },message=>error=message);repo=connection;
  }).catch(e=>error=e.message);
  return()=>{closed=true;connection?.close();repo=undefined;};
 });
 $effect(()=>{
  const enabled=!gathering,person=tableState.players[frame.state.active],seat=person?places[person.id]:'south-left',reduce=reduced,rate=RATES[speed];
  if(!enabled){target='';initialized=false;return;}
  if(menu||target===seat)return;target=seat;
  const to={...seatPose(seat)};untrack(()=>{if(!initialized||reduce||document.hidden){pose=to;motion=null;turning=false;}else{motion={from:{...pose},to,start:performance.now(),duration:1100/rate};turning=true;}initialized=true;});
 });
 $effect(()=>{const table=room,seats=places;if(table&&tableState.players.length)try{localStorage.setItem(`${sessionKey}:seats:${table}`,JSON.stringify(seats));}catch{}});
 $effect(()=>{if(freeColours.length&&!freeColours.some(c=>c.colour===companionColour))companionColour=freeColours[0].colour;});
 $effect(()=>{
  const current=tableState,connection=repo,rate=RATES[speed];
  if(!host||!loaded||sending||moving||turning||menu||!connection)return;
  const intent=chooseBot(current);if(!intent)return;
  const actor=current.players[current.game!.active].id;
  const timer=setTimeout(()=>void act(intent,actor),600/rate);
  return()=>clearTimeout(timer);
 });
 async function addCompanion(){
  if(!host||!gathering||!freeColours.some(c=>c.colour===companionColour)||tableState.players.length>=4)return;
  await act({type:'invite-bot',id:`bot-${randomId()}`,name:COLOUR_NAMES[companionColour],level:companionLevel,colour:companionColour},tableState.host);
 }
 function towerStatusChanged(text:string){towerStatus=text;}
 async function act(intent:Intent,actor=active?.id??viewer):Promise<boolean>{
  if(!repo||sending)return false;sending=true;error='';try{await repo.append(actor,intent);return true;}catch(e){error=(e as Error).message;return false;}finally{sending=false;}
 }
 $effect(()=>{if(canAct&&tableState.game?.phase==='choose'&&(tableState.players[tableState.game.active].tower??null)===tower){const forced=equivalentMove(tableState.game);if(forced)void act(forced);}});
 async function sit(colour:number){
  const seat=pickingSeat;if(!repo||!seat||!canAct||tableState.players.some(p=>p.colour===colour))return;
  sending=true;error='';try{const actor=tableState.players.length?(locals.find(id=>!tableState.players.some(p=>p.id===id))??await newLocalIdentity(room)):viewer;locals=await localIdentities(room);await repo.append(actor,{type:'sit',seat,colour});pickingSeat=null;}catch(e){error=(e as Error).message;}finally{locals=await localIdentities(room);sending=false;}
 }
 function pair(index:number){if(!canAct)return;const p=options.find(p=>p.index===index);if(!p?.variants.length)return;selected=index;if(tableState.choice?.pairing===index){runnerColumn=tableState.choice.column;return;}runnerColumn=undefined;if(p.variants.length===1)void act({type:'advance',pairing:index});}
 function destination(column:number){if(!canAct)return;runnerColumn=column;void act({type:'advance',pairing:selected,column});}
 function takeSeat(seat:SeatId){if(choosingSeat===null)return;const player=tableState.players[choosingSeat];if(tableState.players.some(p=>p.id!==player.id&&places[p.id]===seat))return;seatsSaved={...places,[player.id]:seat};choosingSeat=null;}
 function openMenu(index:number|undefined=undefined){menuPose=index===undefined?{...pose}:{...seatPose(places[tableState.players[index].id])};rules=false;menu=true;}
 function fresh(){menu=false;motion=null;turning=false;initialized=false;target='';pose={...seatPose('south-left')};room=randomId().replaceAll('-','').slice(0,8).toUpperCase();}
 function saveSpeed(){try{const p=normalizePreferences(JSON.parse(localStorage.getItem(SETTINGS_KEY)??'{}'));localStorage.setItem(SETTINGS_KEY,JSON.stringify({...p,animationSpeed:speed}));}catch{}}
 async function fullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{error='Use the browser fullscreen control.';}}
 function exportLog(){const url=URL.createObjectURL(new Blob([JSON.stringify(events,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='cantstop-tabletop.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
</script>
<svelte:head><title>Can’t Stop · Touch table</title></svelte:head>
<div class="game-shell tabletop playing walkup" data-room={room} data-game-phase={tableState.phase} data-revision={tableState.revision} data-tower-status={towerStatus} data-moving={moving||turning} data-can-act={canAct} data-actor={active?.id??viewer} data-local-players={JSON.stringify(locals)} style:--edge-angle={`${-overlayPose.angle*180/Math.PI}deg`} style:--edge-x={`${50+overlayPose.x/(worldHeight*aspect)*100}%`} style:--edge-y={`${50+overlayPose.z/worldHeight*100}%`}>
 <DiceTowerBridge gameState={tableState} selected={tower} actors={tableState.players.filter(p=>!p.bot&&(p.id===viewer||locals.includes(p.id))).map(p=>p.id)} paused={!loaded||sending||moving||turning||menu} onIntent={act} onStatus={towerStatusChanged}/>
 <main class="play-surface"><TableView {frame} tabletop walkup {gathering} {pickingSeat} onPickSeat={seat=>pickingSeat=seat} onColour={sit} onBegin={actor=>act({type:'begin',seed:randomId()},actor)} seats={places} tabletopPose={pose} tabletopTurning={turning} {choosingSeat} onSeatPlayer={i=>{if(!gathering)choosingSeat=i;}} onSeat={takeSeat} onMenu={openMenu} players={tableState.players} {selected} {runnerColumn} {canAct} externalDice={!!active?.tower} directSelection {decisionReady} choiceState={board??empty} onPair={pair} onDestination={destination} onRoll={()=>{if(canAct&&decisionReady)void act({type:'roll'});}} onStop={()=>{if(canAct&&decisionReady)void act({type:'stop'});}}/>
 {#if tableState.phase==='finished'}<button class="walkup-rematch" onclick={()=>{menuPose={...pose};fresh();}}>New game</button>{/if}</main>
 {#if error}<div class="game-error" role="alert"><span>{error}</span><button onclick={()=>repo?.retry().catch(e=>error=e.message)}>Retry</button><button aria-label="Dismiss message" onclick={()=>error=''}>×</button></div>{/if}
 {#if menu}<div class="game-shade" role="presentation"><div class="game-dialog" role="dialog" aria-modal="true" aria-label="Table menu" tabindex="-1"><button class="dialog-close" aria-label="Close table menu" onclick={()=>menu=false}>×</button><h2>{rules?'How to play':'At the table'}</h2>
  {#if rules}<p>Touch an empty seat and choose a colour. Two to four people can play. Start when everyone is ready.</p><p>Your turn rolls automatically. Choose a pairing to move the pawns. Change the pairing until you roll again or stop and save.</p><p>A roll with no usable pairing loses this turn’s progress. Stop at a summit to claim it. Three claimed summits win.</p>
  {:else}<DiceTowerPicker bind:value={tower} disabled={sending||tableState.protocol===1}/><p>{towerStatus}</p>{#if gathering&&host}<label>Companion level<select aria-label="Companion level" bind:value={companionLevel} disabled={sending||tableState.players.length>=4}>{#each BOT_LEVELS as level}<option value={level.id}>{level.label}</option>{/each}</select></label><p>{BOT_LEVELS.find(level=>level.id===companionLevel)?.description}</p><label>Companion colour<select aria-label="Companion colour" bind:value={companionColour} disabled={sending||!freeColours.length}>{#each freeColours as colour}<option value={colour.colour}>{colour.name}</option>{/each}</select></label><button disabled={sending||tableState.players.length>=4} onclick={addCompanion}>Add companion</button>{/if}{#each tableState.players.filter(p=>p.bot) as bot}<p>{bot.name} · {botLabel(bot.level)} companion</p>{/each}<label>Animation speed<select aria-label="Animation speed" bind:value={speed} onchange={saveSpeed}><option value="standard">Standard</option><option value="fast">Fast</option><option value="blazing">Blazing</option></select></label><button onclick={fullscreen}>Toggle fullscreen</button><button onclick={()=>rules=true}>How to play</button>{#if events.length}<button onclick={exportLog}>Download game log</button>{/if}<button onclick={fresh}>New game</button>{/if}
  <button class="primary" onclick={()=>menu=false}>Back to the table</button></div></div>{/if}
</div>

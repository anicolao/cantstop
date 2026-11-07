<script lang="ts">
 import {onMount,untrack} from 'svelte';
 import TableView from './lib/components/TableView.svelte';
 import {apply,initialState,replay,chooseBot,choiceBoard,type State,type Intent,type Event} from './game/engine';
 import {repository,playerIdentity} from './game/repository';
 import {readLaunch,launchIntent,type Launch} from './game/launcher';
 import {pairings} from './lib/model/game';
 import {localIdentities} from './game/local-players';
 import {previewScope} from './firebase';
 import {SEATS,assignSeats,seatPose,seatTravel,TABLETOP_SPAN,type SeatId,type SeatPose} from './lib/presentation/tabletop';
 import {randomId} from './game/random-id';
 import {frameFor,transitions} from './game/presentation';
 import type {Transition} from './lib/presentation/catalog';
 import {DEFAULTS,RATES,SETTINGS_KEY,normalizePreferences,type Preferences} from './game/settings';
 const initialRoom=new URLSearchParams(location.search).get('table')??'';
 let room=$state(/^[A-Z0-9]{5,8}$/.test(initialRoom)?initialRoom:'');
 let viewer=$state(''),tableState=$state.raw<State>(initialState()),events=$state.raw<Event[]>([]);
 let loaded=$state(false),sending=$state(false),error=$state(''),launch=$state<Launch|null>(null),launching=$state(false),launchRevision=$state(-1);
 let repo=$state.raw<ReturnType<typeof repository>>();
 let name=$state(''),joinCode=$state(''),lastTable=$state('');
 let preferences=$state<Preferences>({...DEFAULTS}),settingsOpen=$state(false),historyOpen=$state(false),helpOpen=$state(false);
 let historyRevision=$state<number|null>(null),imported=$state(false),copied=$state(false);
 let selected=$state(-1),runnerColumn=$state<number>(),step=$state.raw<Transition|null>(null),time=$state(0),reduced=$state(false),phone=$state(false);
 let pendingSteps=$state.raw<Transition[]>([]);
 let localPlayers=$state<string[]>([]),localName=$state('');
 let seatPreferences=$state<Record<string,SeatId>>({}),choosingSeat=$state<number|null>(null);
 let tabletopPose=$state<SeatPose>({...seatPose('south-left')}),tabletopTurning=$state(false);
 let seatMotion:{from:SeatPose;to:SeatPose;start:number;duration:number}|null=null,seatTarget='',poseInitialized=false;
 const tabletop=$derived(preferences.view==='tabletop');
 const assignedSeats=$derived(assignSeats(tableState.players,seatPreferences));
 const activeId=$derived(tableState.players[tableState.game?.active??0]?.id??viewer);
 const actingActor=$derived(tabletop&&localPlayers.includes(activeId)?activeId:viewer);
 let importInput:HTMLInputElement;
 const viewing=$derived(historyRevision===null?tableState:replay(events.slice(0,historyRevision)));
 const frame=$derived(frameFor(viewing,historyRevision===null&&!reduced?step:null,time,reduced));
 const moving=$derived(!!step&&!reduced&&(time<step.duration||pendingSteps.length>0));
 const ownTurn=$derived(!imported&&tableState.phase==='playing'&&(activeId===viewer||tabletop&&localPlayers.includes(activeId)));
 const canAct=$derived(ownTurn&&!moving&&!tabletopTurning&&choosingSeat===null&&!sending&&!settingsOpen&&!historyOpen&&loaded);
 const directSelection=$derived(tableState.protocol===2);
 const options=$derived(choiceBoard(tableState)?pairings(choiceBoard(tableState)!):[]);
 const decisionReady=$derived(!directSelection||!!tableState.choice&&tableState.choice.pairing===selected&&tableState.choice.column===runnerColumn);
 const seated=$derived(tableState.players.some(p=>p.id===viewer));
 const host=$derived(tableState.host===viewer&&!imported);
 const invitation=$derived.by(()=>{const u=new URL(location.href);u.search='';u.searchParams.set('table',room);return u.href;});
 const activeName=$derived(tableState.players[tableState.game?.active??0]?.name??'Player');
 try{launch=readLaunch(location.search);}catch(e){error=(e as Error).message;}
 if(initialRoom&&!/^[A-Z0-9]{5,8}$/.test(initialRoom))error='Enter a table code of 5–8 letters or numbers.';
 onMount(()=>{
  try{name=localStorage.getItem('cantstop:name')??'';lastTable=localStorage.getItem('cantstop:lastTable')??'';preferences=normalizePreferences(JSON.parse(localStorage.getItem(SETTINGS_KEY)??'{}'));}catch{/* Defaults also work without storage. */}
  if(new URLSearchParams(location.search).get('view')==='tabletop')preferences.view='tabletop';
  const motion=matchMedia('(prefers-reduced-motion: reduce)');reduced=motion.matches;
  const resize=()=>{phone=innerWidth<700||(innerHeight<520&&innerWidth<1100);};resize();window.addEventListener('resize',resize);
  const changed=()=>reduced=motion.matches;motion.addEventListener('change',changed);
  let last=performance.now(),id=0;
  const tick=(now:number)=>{if(seatMotion){const p=reduced?1:Math.min(1,(now-seatMotion.start)/seatMotion.duration);tabletopPose=seatTravel(seatMotion.from,seatMotion.to,p);if(p>=1){tabletopPose=seatMotion.to;seatMotion=null;tabletopTurning=false;}}if(step&&!document.hidden&&!reduced){time=Math.min(step.duration,time+Math.max(0,(now-last)/1000)*RATES[preferences.animationSpeed]);if(time>=step.duration&&pendingSteps.length){step=pendingSteps[0];pendingSteps=pendingSteps.slice(1);time=0;}}last=now;id=requestAnimationFrame(tick);};id=requestAnimationFrame(tick);
  const visibility=()=>{if(document.hidden){step=null;pendingSteps=[];time=0;if(seatMotion)tabletopPose=seatMotion.to;seatMotion=null;tabletopTurning=false;}last=performance.now();};document.addEventListener('visibilitychange',visibility);
  const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'){choosingSeat=null;settingsOpen=historyOpen=helpOpen=false;historyRevision=null;}};window.addEventListener('keydown',escape);
  return()=>{cancelAnimationFrame(id);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('resize',resize);window.removeEventListener('keydown',escape);motion.removeEventListener('change',changed);};
 });
 $effect(()=>{const value=preferences;try{localStorage.setItem(SETTINGS_KEY,JSON.stringify(value));}catch{}});
 $effect(()=>{
  const table=room;if(!table||imported)return;
  let closed=false,connection:ReturnType<typeof repository>|undefined;
  loaded=false;error='';events=[];localPlayers=[];choosingSeat=null;
  try{seatPreferences=JSON.parse(localStorage.getItem(`cantstop:tabletop-seats:${previewScope}:${table}`)??'{}');}catch{seatPreferences={};}
  tableState=initialState();step=null;pendingSteps=[];
  void Promise.all([playerIdentity(),localIdentities(table)]).then(([uid,locals])=>{
   if(closed)return;viewer=uid;localPlayers=locals;
   connection=repository(table,next=>{
    if(closed)return;
    const before=tableState,wasLoaded=loaded,after=replay(next);
    if(wasLoaded&&next.length<events.length)return;
    if(wasLoaded&&next.length===events.length&&events.some((e,i)=>e.id!==next[i]?.id)){error='This table has a different history. Reload to reconnect.';return;}
    if(!wasLoaded||next.length>events.length){
     selected=after.choice?.pairing??(after.protocol===1?2:-1);runnerColumn=after.choice?.column;
    }
    if(wasLoaded&&next.length===events.length+1&&!document.hidden&&!reduced){
     const motion=transitions(before,next.at(-1)!);step=motion[0]??null;pendingSteps=motion.slice(1);time=0;
    }else if(!wasLoaded||next.length>events.length+1||document.hidden){step=null;pendingSteps=[];time=0;}
    events=next;tableState=after;loaded=true;error='';
   },message=>{if(!closed)error=message;});repo=connection;
   try{localStorage.setItem('cantstop:lastTable',table);}catch{}
   void connection.retry().catch(e=>{if(!closed)error=(e as Error).message;});
  }).catch(e=>{if(!closed)error=(e as Error).message;});
  return()=>{closed=true;connection?.close();repo=undefined;};
 });
 $effect(()=>{
  const current=launch,ready=loaded,currentState=tableState,uid=viewer,connection=repo;
  if(!current||!ready||!uid||!connection||launching||seated||imported||launchRevision===currentState.revision)return;
  try{
   const intent=launchIntent(current,currentState,uid);if(!intent)return;
   launching=true;launchRevision=currentState.revision;
   void connection.append(uid,intent).catch(e=>{error=(e as Error).message;if(!['The table changed. Try again.','Failed to fetch'].includes(error))launch=null;}).finally(()=>{launching=false;});
  }catch(e){error=(e as Error).message;launch=null;}
 });
 $effect(()=>{
  const current=tableState,connection=repo,rate=RATES[preferences.animationSpeed];
  if(!host||!loaded||sending||moving||settingsOpen||historyOpen||!connection||imported)return;
  const intent=chooseBot(current);if(!intent)return;
  const actor=current.players[current.game!.active].id;
  const timer=setTimeout(()=>void send(intent,actor),600/rate);
  return()=>clearTimeout(timer);
 });
 async function send(intent:Intent,actor=actingActor){
  if(!repo||sending||imported)return;
  if(['roll','advance','stop'].includes(intent.type)&&tableState.players.find(p=>p.id===actor)?.bot!==true&&!canAct){error=moving?'Let the pieces settle.':'Wait for your turn.';return;}
  if(directSelection&&['roll','stop'].includes(intent.type)&&tableState.players.find(p=>p.id===actor)?.bot!==true&&!decisionReady)return;
  sending=true;error='';
  try{await repo.append(actor,intent);}
  catch(e){error=(e as Error).message;}
  finally{sending=false;}
 }
 $effect(()=>{
  const enabled=tabletop,player=tableState.players[frame?.state.active??0],seat=player?assignedSeats[player.id]:'south-left';
  const reducedMotion=reduced,speed=preferences.animationSpeed;
  if(!enabled){seatTarget='';poseInitialized=false;seatMotion=null;tabletopTurning=false;return;}
  if(seatTarget===seat)return;seatTarget=seat;
  const target={...seatPose(seat)};
  untrack(()=>{if(!poseInitialized||reducedMotion||document.hidden){tabletopPose=target;tabletopTurning=false;seatMotion=null;}else{seatMotion={from:{...tabletopPose},to:target,start:performance.now(),duration:1100/RATES[speed]};tabletopTurning=true;}poseInitialized=true;});
 });
 $effect(()=>{const seats=assignedSeats,table=room;if(table&&tableState.players.length)try{localStorage.setItem(`cantstop:tabletop-seats:${previewScope}:${table}`,JSON.stringify(seats));}catch{}});
 function takeSeat(seat:SeatId){
  if(choosingSeat===null)return;const player=tableState.players[choosingSeat];
  if(tableState.players.some(p=>p.id!==player.id&&assignedSeats[p.id]===seat))return;
  seatPreferences={...assignedSeats,[player.id]:seat};choosingSeat=null;
 }
 async function addLocalPlayer(){
  const player=localName.trim();if(!repo||sending||!player||player.length>24)return;
  sending=true;error='';try{const uid=await repo.addLocalPlayer(player);localPlayers=[...localPlayers,uid];localName='';}
  catch(e){error=(e as Error).message;}finally{localPlayers=await localIdentities(room);sending=false;}
 }
 async function fullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{error='Use your browser’s fullscreen control.';}}
 function selectPair(pairing:number){
  if(!canAct)return;
  if(!directSelection){selected=pairing;runnerColumn=undefined;return;}
  const option=options.find(p=>p.index===pairing);if(!option?.variants.length)return;
  selected=pairing;
  if(tableState.choice?.pairing===pairing){runnerColumn=tableState.choice.column;return;}
  runnerColumn=undefined;
  if(option.variants.length===1)void send({type:'advance',pairing});
 }
 function selectDestination(column:number){
  if(!canAct)return;runnerColumn=column;
  if(directSelection&&!(tableState.choice?.pairing===selected&&tableState.choice.column===column))void send({type:'advance',pairing:selected,column});
 }
 function openTable(mode:'create'|'join'){
  const player=name.trim();if(!player||player.length>24){error='Choose a name of 1–24 characters.';return;}
  const code=mode==='create'?randomId().replaceAll('-','').slice(0,8).toUpperCase():joinCode.trim().toUpperCase();
  if(!/^[A-Z0-9]{5,8}$/.test(code)){error='Enter a table code of 5–8 letters or numbers.';return;}
  try{localStorage.setItem('cantstop:name',player);}catch{}
  launchRevision=-1;launch={mode,table:code,name:player,returnTo:null};room=code;
  const u=new URL(location.href);u.search='';u.searchParams.set('table',code);history.replaceState(null,'',u);
 }
 async function copyInvite(){try{await navigator.clipboard.writeText(invitation);copied=true;setTimeout(()=>copied=false,2000);}catch{error='Copy the invitation from the address bar.';}}
 function showHistory(){historyOpen=true;historyRevision=events.length;}
 function closeHistory(){historyOpen=false;historyRevision=null;}
 function exportLog(){const url=URL.createObjectURL(new Blob([JSON.stringify(events,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=`cantstop-${room||'replay'}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 async function importLog(e:globalThis.Event){
  const file=(e.target as HTMLInputElement).files?.[0];if(!file)return;
  try{if(file.size>2_000_000)throw new Error('Choose a game log smaller than 2 MB.');const next=JSON.parse(await file.text()) as Event[],restored=replay(next);if(!restored.game)throw new Error('This table has not started a game yet.');imported=true;repo?.close();repo=undefined;events=next;tableState=restored;step=null;pendingSteps=[];selected=restored.choice?.pairing??(restored.protocol===1?2:-1);runnerColumn=restored.choice?.column;loaded=true;historyRevision=next.length;historyOpen=true;room='';error='';}
  catch(e){error=(e as Error).message;}
 }
 function focusDialog(node:HTMLDivElement){
  const previous=document.activeElement as HTMLElement|null;node.focus();
  const key=(event:KeyboardEvent)=>{
   if(event.key!=='Tab')return;
   const controls=Array.from(node.querySelectorAll<HTMLElement>('button:not(:disabled),select,input,a[href]'));
   const first=controls[0],last=controls.at(-1);
   if(event.shiftKey&&(document.activeElement===first||document.activeElement===node)){event.preventDefault();last?.focus();}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
  };node.addEventListener('keydown',key);
  return {destroy(){node.removeEventListener('keydown',key);previous?.focus();}};
 }
 function nextCompanion(){const names=['Bea','Cal','Dev'];const botName=names.find(n=>!tableState.players.some(p=>p.name===n))??'Companion';void send({type:'invite-bot',id:`bot-${randomId()}`,name:botName});}
</script>
<svelte:head><title>Can’t Stop{room?` · ${room}`:''}</title></svelte:head>
<div class="game-shell" class:tabletop class:playing={tableState.phase!=='gathering'} style:--edge-angle={`${-tabletopPose.angle*180/Math.PI}deg`} style:--edge-x={`${50+tabletopPose.x/Math.max(44,TABLETOP_SPAN*(typeof innerWidth==='number'?innerWidth/innerHeight:16/9))*100}%`} style:--edge-y={`${50+tabletopPose.z/TABLETOP_SPAN*100}%`} data-local-players={JSON.stringify(localPlayers)} data-game-phase={tableState.phase} data-revision={tableState.revision} data-moving={moving} data-can-act={canAct} data-actor={viewer}>
 <span class="connection-status" role="status" data-status={loaded?'synced':'connecting'}>{loaded?'Table connected':'Connecting'}</span>
 <header class="game-topbar">
  <a class="game-brand" href={import.meta.env.BASE_URL}>CAN’T STOP</a>
  {#if room}<span class="table-code">{room}</span>{/if}
  <nav aria-label="Table controls">
   {#if room}<button onclick={copyInvite}>{copied?'Copied':'Invite'}</button>{/if}
   {#if events.length}<button onclick={showHistory}>History</button>{/if}
   <button onclick={()=>helpOpen=true}>How to play</button><button onclick={()=>settingsOpen=true}>Settings</button>
  </nav>
 </header>
 {#if !room&&!imported}
  <main class="game-welcome"><div class="welcome-copy"><span class="eyebrow">ONE MORE ROLL</span><h1>How far will<br/>you climb?</h1><p>Four dice. Three runners. Claim three summits to win.</p></div>
   <section class="game-folio"><h2>Take a seat</h2><label>Your name<input autocomplete="nickname" maxlength="24" bind:value={name}/></label><button class="primary" onclick={()=>openTable('create')}>New table</button><button onclick={()=>{preferences.view='tabletop';openTable('create');}}>New tabletop game</button><div class="join-row"><label>Table code<input maxlength="8" autocapitalize="characters" bind:value={joinCode}/></label><button onclick={()=>openTable('join')}>Join table</button></div>
    {#if lastTable}<a class="continue-table" href={`?table=${lastTable}`}>Return to table {lastTable}</a>{/if}
    <button class="quiet" onclick={()=>importInput.click()}>Open a game log</button><a class="quiet" href={`${import.meta.env.BASE_URL}dev/animations`}>Animation lab</a>
   </section>
  </main>
 {:else if !loaded}
  <main class="game-wait"><h1>Opening your table…</h1><p>Your invitation and seat stay with you.</p></main>
 {:else if tableState.phase==='gathering'}
  <main class="game-gathering"><section class="game-folio"><span class="eyebrow">{room}</span><h1>{tableState.players.length?'A place at the table':'Waiting for the host'}</h1><p>Two to four players. Friends can join using the invitation.</p>
   <ol class="seat-list">{#each tableState.players as player,i}<li><span class="seat-dot" style:background={['#08615c','#965508','#8d2030','#523171'][i]}></span>{player.name}{player.id===viewer?' · you':''}{player.bot?' · companion':localPlayers.includes(player.id)?' · on this screen':''}{player.id===tableState.host?' · host':''}</li>{/each}</ol>
   {#if !seated&&!launch}<label>Your name<input maxlength="24" bind:value={name}/></label><button class="primary" disabled={sending||!tableState.players.length||tableState.players.length>=4} onclick={()=>{launchRevision=-1;launch={mode:'join',table:room,name:name.trim(),returnTo:null};}}>Join this table</button>{/if}
   {#if host&&tabletop}<div class="local-player-entry"><label>Next player’s name<input aria-label="Next player’s name" maxlength="24" bind:value={localName}/></label><button disabled={sending||!localName.trim()||tableState.players.length>=4} onclick={addLocalPlayer}>Add player on this screen</button></div>
   <fieldset class="tabletop-seat-list"><legend>Where is everyone sitting?</legend>{#each tableState.players as player}<label>{player.name}<select aria-label={`Seat for ${player.name}`} value={assignedSeats[player.id]} onchange={e=>{choosingSeat=tableState.players.findIndex(p=>p.id===player.id);takeSeat(e.currentTarget.value as SeatId);}}>{#each SEATS as seat}<option value={seat.id} disabled={tableState.players.some(p=>p.id!==player.id&&assignedSeats[p.id]===seat.id)}>{seat.label}</option>{/each}</select></label>{/each}</fieldset>{/if}
   {#if host}<div class="folio-actions"><button disabled={sending||tableState.players.length>=4} onclick={nextCompanion}>Add companion</button><button class="primary" disabled={sending||tableState.players.length<2} onclick={()=>send({type:'begin',seed:randomId()},viewer)}>Start game</button></div>{/if}
   <label>Invitation<input aria-label="Invitation link" readonly value={invitation} onclick={e=>e.currentTarget.select()}/></label>
   {#if launch?.mode==='join'&&!tableState.players.length}<p class="waiting-note">Your seat will be taken when the host arrives.</p>{/if}
  </section></main>
 {:else}
  <main class="play-surface">
   {#if frame}<TableView {frame} {phone} {tabletop} seats={assignedSeats} {tabletopPose} {tabletopTurning} {choosingSeat} onSeatPlayer={index=>choosingSeat=index} onSeat={takeSeat} onMenu={()=>settingsOpen=true} {selected} {runnerColumn} players={tableState.players} preset={preferences.view==='overhead'?'overhead':'low'} lowAngle={60} {canAct} {directSelection} {decisionReady} choiceState={choiceBoard(viewing)??undefined} onPair={selectPair} onDestination={selectDestination} onMove={()=>send({type:'advance',pairing:selected,...(runnerColumn!==undefined?{column:runnerColumn}:{})})} onRoll={()=>send({type:'roll'})} onStop={()=>send({type:'stop'})}/>{:else}<div class="game-wait">The game had not begun at this point.</div>{/if}
   {#if imported}<div class="table-status">Game log · read only</div>{:else if !seated}<div class="table-status">Watching {activeName}'s table</div>{:else if !ownTurn&&tableState.phase!=='finished'}<div class="table-status">{activeName}'s turn</div>{/if}
   {#if tableState.phase==='finished'&&!historyOpen}<div class="end-actions"><button onclick={showHistory}>Review the game</button>{#if host}<button onclick={()=>send({type:'begin',seed:randomId()},viewer)}>Play again</button>{/if}</div>{/if}
  </main>
 {/if}
 {#if error}<div class="game-error" role="alert"><span>{error}</span>{#if repo}<button onclick={()=>repo?.retry().catch(e=>error=e.message)}>Retry</button>{/if}<button aria-label="Dismiss message" onclick={()=>error=''}>×</button></div>{/if}
 {#if settingsOpen}<div class="game-shade" role="presentation"><div class="game-dialog" use:focusDialog role="dialog" aria-modal="true" aria-label="Settings" tabindex="-1"><button class="dialog-close" aria-label="Close settings" onclick={()=>settingsOpen=false}>×</button><h2>Your table</h2><p>These settings stay on this device.</p><label>View<select aria-label="View" bind:value={preferences.view}><option value="standard">Standard · 60°</option><option value="overhead">Overhead</option><option value="tabletop">Tabletop · shared touch screen</option></select></label><label>Animation speed<select aria-label="Animation speed" bind:value={preferences.animationSpeed}><option value="standard">Standard</option><option value="fast">Fast</option><option value="blazing">Blazing</option></select></label>{#if tabletop}<button onclick={fullscreen}>Toggle fullscreen</button>{#if events.length}<button onclick={()=>{settingsOpen=false;showHistory();}}>Game history</button>{/if}<button onclick={()=>{settingsOpen=false;helpOpen=true;}}>How to play</button>{/if}<button class="primary" onclick={()=>settingsOpen=false}>Back to the table</button></div></div>{/if}
 {#if helpOpen}<div class="game-shade" role="presentation"><div class="game-dialog" use:focusDialog role="dialog" aria-modal="true" aria-label="How to play" tabindex="-1"><button class="dialog-close" aria-label="Close rules" onclick={()=>helpOpen=false}>×</button><h2>One more roll?</h2><p>Your turn starts with an automatic roll. Choose how to split the four dice into two pairs. Selecting a pairing moves the runners immediately. You can change that pairing until you roll again or save. Each sum advances its numbered track; doubles advance twice.</p><p>You have three black runners for the turn. Once all three are on the board, only their columns can advance. Use every usable sum in a pairing; if only one spare runner could start either column, choose where it goes.</p><p>Roll again to climb higher, or stop to save your progress. If no pairing can move, you bust: this turn’s progress is lost, and the next player rolls.</p><p>Reach a summit and stop to claim it. That column closes to everyone. The first player to claim three columns wins.</p><button class="primary" onclick={()=>helpOpen=false}>Let’s play</button></div></div>{/if}
 {#if historyOpen}<div class="game-history" role="dialog" tabindex="-1" aria-label="Game history"><button class="dialog-close" aria-label="Close history" onclick={closeHistory}>×</button><h2>At the table</h2><p>{events.length} player actions · {imported?'Replay':'Live game'}</p><label>Replay action <output>{historyRevision??events.length} / {events.length}</output><input type="range" min="0" max={events.length} step="1" bind:value={historyRevision} aria-label="Replay action"/></label><ol>{#each events as event}<li><button class:current={historyRevision===event.sequence} onclick={()=>historyRevision=event.sequence}><span>{event.sequence}</span> {tableState.players.find(p=>p.id===event.actor)?.name??'Player'} · {event.intent.type}{event.intent.type==='advance'?` · pairing ${event.intent.pairing+1}`:''}</button></li>{/each}</ol><button onclick={exportLog}>Download game log</button><button class="primary" onclick={closeHistory}>{imported?'Close history':'Return to live game'}</button></div>{/if}
 <input class="file-input" type="file" accept="application/json,.json" aria-label="Import game log" bind:this={importInput} onchange={importLog}/>
</div>

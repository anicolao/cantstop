<script lang="ts">
 import {onMount} from 'svelte';
 import desktopConcept from '../docs/ux/concepts/01-desktop.png';
 import phoneConcept from '../docs/ux/concepts/02-phone.png';
 import TableView from './lib/components/TableView.svelte';
 import {examples,durationOf,atTime,type Example,type Transition} from './lib/presentation/catalog';
 import {sample} from './lib/presentation/frame';
 import {apply,type Intent} from './lib/model/game';
 const params=new URLSearchParams(location.search);
 let gallery=$state(location.pathname==='/gallery'||location.pathname==='/dev/components');
 let scenario=$state(params.get('scene')??'ready');
 let custom=$state.raw<Example>();
 let time=$state(0),playing=$state(false),loop=$state(false),speed=$state(1);
 let device=$state(params.get('device')??(window.innerWidth<700?'phone':'desktop'));
 let lowAngle=$state(60);
 let preset=$state('table'),selected=$state(['last-runner','no-pawn'].includes(params.get('scene')??'')?1:params.get('scene')==='closed-column'?0:2),runnerColumn=$state<number>();
 let component=$state(params.get('component')??'board'),orbit=$state(false),reduced=$state(false);
 let clean=$state(params.get('clean')==='1');
 let notice=$state(''),viewport=$state<HTMLDivElement>(),viewportSize=$state({w:1000,h:700});
 const catalog=[
  {id:'board',symbol:'◇',name:'The diamond',material:'Ivory tracks · red lacquer',description:'Eleven raised tracks, exactly 83 spaces. A beveled walnut body, brass rim and red lacquer face.'},
  {id:'dice',symbol:'⚄',name:'Ruby dice',material:'Translucent resin · inset pips',description:'Rounded cubes with six pip faces, physical transmission, reflections, and readable top-face values.'},
  {id:'runner',symbol:'♟',name:'Black runners',material:'Polished black · brass collar',description:'Tall tactile markers for progress still at risk. A turned pawn is the first sculptural placeholder.'},
  {id:'token',symbol:'◉',name:'Saved markers',material:'Deep lacquer · owner marks',description:'Low polished markers with owner symbols. Their silhouette stays distinct from the tall black runners.'},
  {id:'plaque',symbol:'▱',name:'Action pieces',material:'Maple · engraved type',description:'Actual clickable 3D controls. Pale maple faces on walnut, a warmer maple tone for selection, and readable engraved type.'},
  {id:'surface',symbol:'≋',name:'The materials',material:'Walnut · lacquer · maple',description:'Locally bundled PBR scans and an HDR environment. Inspect walnut, red lacquer, and the same maple finish used on the action controls.'}
 ];
 const active=$derived(custom??examples.find(e=>e.id===scenario)??examples[0]);
 const total=$derived(durationOf(active));
 const transition=$derived(atTime(active,time));
 const frame=$derived(sample(transition,transition.time,reduced));
 const selectedComponent=$derived(catalog.find(c=>c.id===component)??catalog[0]);
 const stagePhone=$derived(device==='phone'||device==='phone-landscape');
 const stageLandscape=$derived(device==='phone-landscape');
 const previewSize=$derived(stageLandscape?{w:844,h:390}:{w:390,h:844});
 const groups=['The turn','Turning points','Close inspection'];
 const phoneScale=$derived(Math.min(1,(viewportSize.h-24)/previewSize.h,(viewportSize.w-24)/previewSize.w));
 function updateUrl(){const url=new URL(location.href);url.pathname=gallery?'/gallery':'/dev/animations';url.searchParams.set('scene',scenario);url.searchParams.set('device',device);url.searchParams.delete('look');if(gallery)url.searchParams.set('component',component);else url.searchParams.delete('component');if(clean)url.searchParams.set('clean','1');else url.searchParams.delete('clean');history.replaceState(null,'',url);}
 function choose(id:string){scenario=id;custom=undefined;time=0;playing=false;selected=['last-runner','no-pawn'].includes(id)?1:id==='closed-column'?0:2;runnerColumn=undefined;notice='';updateUrl();}
 function switchView(value:boolean){gallery=value;orbit=value;playing=false;updateUrl();}
 function replay(){time=0;playing=!reduced;}
 function togglePlay(){if(reduced)return;if(time>=total)time=0;playing=!playing;}
 function act(intent:Intent){
  if(playing)return;
  try{
   const before=frame.state,after=apply(before,intent);
   const kind=intent.type==='roll'?(after.lastOutcome==='bust'?'bust':'roll'):intent.type==='advance'?'advance':after.lastOutcome==='win'?'win':after.lastOutcome==='claim'?'claim':'save';
   const step:Transition={before,after,intent,kind,duration:kind==='roll'?2.8:kind==='bust'?3.6:kind==='advance'?2.4:3.1};
   custom={id:'interactive',name:'Your turn at the table',group:'Interactive',description:'You are controlling the same scene components. Choose a pairing, move, and decide whether to roll or save.',beats:['Your choice','Its motion','Its result'],steps:[step]};time=0;playing=!reduced;notice='';
  }catch(e){notice=e instanceof Error?e.message:'Choose a legal move.';}
 }
 function move(){act({type:'advance',pairing:selected,column:runnerColumn});}
 function pair(n:number){selected=n;runnerColumn=undefined;notice='';}
 onMount(()=>{
  if(params.has('look')){const url=new URL(location.href);url.searchParams.delete('look');history.replaceState(null,'',url);}
  const media=matchMedia('(prefers-reduced-motion: reduce)');reduced=media.matches;
  let last=performance.now(),raf=0;
  function tick(now:number){if(playing&&!gallery&&!document.hidden){time=Math.min(total,time+Math.max(0,(now-last)/1000)*speed);if(time>=total){if(loop)time=0;else playing=false;}}last=now;raf=requestAnimationFrame(tick);}
  raf=requestAnimationFrame(tick);
  const keyboard=(e:KeyboardEvent)=>{if((e.target as HTMLElement).matches('input,select,button,textarea'))return;if(e.code==='Space'){e.preventDefault();togglePlay();}else if(e.code==='ArrowRight'){playing=false;time=Math.min(total,time+.1);}else if(e.code==='ArrowLeft'){playing=false;time=Math.max(0,time-.1);}else if(e.key==='Escape'&&clean){clean=false;updateUrl();}};
  const visibility=()=>{last=performance.now();};document.addEventListener('visibilitychange',visibility);
  window.addEventListener('keydown',keyboard);
  return()=>{cancelAnimationFrame(raf);window.removeEventListener('keydown',keyboard);document.removeEventListener('visibilitychange',visibility);};
 });
 $effect(()=>{if(!viewport)return;const observer=new ResizeObserver(([entry])=>viewportSize={w:entry.contentRect.width,h:entry.contentRect.height});observer.observe(viewport);return()=>observer.disconnect();});
</script>
<svelte:head><title>Can’t Stop · {gallery?'Component gallery':'Animation lab'}</title></svelte:head>
<div class="workshop" class:clean>
 {#if !clean}
 <header class="workspace-header">
  <a class="brand" href="/dev/animations"><span class="brand-mark">7</span><span>CAN’T STOP<small>THE WORKSHOP</small></span></a>
  <nav aria-label="Workshop"><button class:active={!gallery} onclick={()=>switchView(false)}>Animation lab</button><button class:active={gallery} onclick={()=>switchView(true)}>Component gallery</button></nav>
  <div class="build-note"><i></i> LIVE 3D PROTOTYPE <span>01</span></div>
 </header>
 {/if}
 <main>
 {#if !clean}
 <aside class="sidebar">
  <div class="sidebar-intro"><span class="eyebrow">{gallery?'THE OBJECT LIBRARY':'MOTION STUDIES'}</span><h1>{gallery?'Made to be held.':'One more roll.'}</h1><p>{gallery?'The objects that make the table. Inspect the same components used in every animation.':'A study in luck, weight and knowing when to stop.'}</p></div>
  {#if gallery}
   <div class="component-list">{#each catalog as c}<button class:selected={component===c.id} onclick={()=>{component=c.id;updateUrl();}}><span class="component-symbol">{c.symbol}</span><span>{c.name}<small>{c.material}</small></span><span class="chevron">↗</span></button>{/each}</div>
  {:else}
   {#each groups as group}<section class="scenario-group"><h2>{group}</h2>{#each examples.filter(e=>e.group===group) as e}<button class:selected={!custom&&scenario===e.id} onclick={()=>choose(e.id)}><span>{e.name}</span><small>{durationOf(e).toFixed(1)}s</small></button>{/each}</section>{/each}
  {/if}
  <div class="sidebar-footer"><span class="tiny-diamond">◇</span><p>A real-time table.<br>Every object, rendered in 3D.</p></div>
 </aside>
 {/if}
 <div class="workspace-main">
  {#if !clean}
   <div class="view-toolbar"><div class="view-heading"><span class="eyebrow">{gallery?'COMPONENT':'SCENE'}</span><strong>{gallery?selectedComponent.name:active.name}</strong></div><div class="view-tools">
    {#if !gallery}<div class="segmented" role="group" aria-label="Form factor">
     <button aria-label="Desktop" aria-pressed={!stagePhone} class:active={!stagePhone} onclick={()=>{device='desktop';updateUrl();}}>▰ <span>Desktop</span></button>
     <button aria-label="Phone portrait" aria-pressed={device==='phone'} class:active={device==='phone'} onclick={()=>{device='phone';updateUrl();}}>▯ <span>Portrait</span></button>
     <button aria-label="Phone landscape" aria-pressed={stageLandscape} class:active={stageLandscape} onclick={()=>{device='phone-landscape';updateUrl();}}>▭ <span>Landscape</span></button>
    </div>{/if}
    <select aria-label="Camera angle" bind:value={preset}><option value="table">Table view</option><option value="overhead">Overhead</option><option value="low">Low angle</option></select>
    <button class="icon-button expand" title="Focus on the scene" aria-label="Focus on the scene" onclick={()=>{clean=true;updateUrl();}}>⤢</button>
   </div></div>

  {/if}
  <div class="preview-stage" class:phone-stage={stagePhone&&!gallery} class:gallery-stage={gallery} bind:this={viewport}>
   <div class="stage-annotation top">{gallery?'MATERIAL STUDY / REAL-TIME 3D':stagePhone?(stageLandscape?'PHONE LANDSCAPE / 844 × 390':'PHONE PORTRAIT / 390 × 844'):'DESKTOP / LIVE SCENE'}</div>
   <div class="scene-container" class:phone-frame={stagePhone&&!gallery} class:landscape-frame={stageLandscape&&!gallery} style:width={stagePhone&&!gallery&&!clean?`${previewSize.w*phoneScale}px`:'100%'} style:height={stagePhone&&!gallery&&!clean?`${previewSize.h*phoneScale}px`:'100%'}>
    <TableView {frame} phone={stagePhone&&!gallery} {selected} {runnerColumn} focus={gallery?component:'table'} {preset} {lowAngle} orbit={gallery&&orbit} onPair={pair} onDestination={(n)=>runnerColumn=n} onMove={move} onRoll={()=>act({type:'roll'})} onStop={()=>act({type:'stop'})}/>
    {#if stagePhone&&!gallery&&!clean}<div class="home-indicator"></div>{/if}
   </div>
   {#if preset==='low'}
    <label class="angle-control">
     <span>Tilt <output for="camera-elevation">{lowAngle}°</output></span>
     <input id="camera-elevation" aria-label="Camera elevation" aria-valuetext={`${lowAngle} degrees above the table`} type="range" min="15" max="80" step="1" bind:value={lowAngle}/>
    </label>
   {/if}
   {#if notice}<div class="notice" role="status">{notice}</div>{/if}

   {#if gallery}<div class="orbit-hint">{orbit?'Drag to orbit · Scroll to zoom':'Fixed camera'}<button onclick={()=>orbit=!orbit}>{orbit?'Lock camera':'Orbit camera'}</button></div>{/if}
   {#if clean}<button class="return-workshop" onclick={()=>{clean=false;updateUrl();}}>← Workshop</button>{/if}
  </div>
  {#if !clean}
   {#if gallery}
    <div class="component-caption"><div><span class="eyebrow">{selectedComponent.material}</span><h2>{selectedComponent.name}</h2><p>{selectedComponent.description}</p></div><span class="component-number">0{catalog.findIndex(c=>c.id===component)+1}<small>/ 06</small></span></div>
   {:else}
    <div class="transport"><div class="transport-controls"><button class="play-button" aria-label={playing?'Pause animation':'Play animation'} onclick={togglePlay} disabled={reduced}>{playing?'Ⅱ':'▶'}</button><button class="replay-button" aria-label="Replay animation" title="Replay" onclick={replay}>↺</button><span class="timecode">{time.toFixed(2)} <em>/ {total.toFixed(2)} s</em></span><label class="speed"><select aria-label="Playback speed" bind:value={speed}><option value={.25}>¼×</option><option value={.5}>½×</option><option value={1}>1×</option><option value={1.5}>1½×</option></select></label><button class:enabled={loop} class="loop-button" aria-pressed={loop} onclick={()=>loop=!loop} title="Loop animation" aria-label="Loop animation">↻</button><label class="reduce"><input type="checkbox" bind:checked={reduced} onchange={()=>playing=false}>Reduced motion</label></div>
    <div class="timeline"><input aria-label="Animation timeline" type="range" min="0" max={total} step=".001" bind:value={time} oninput={()=>playing=false}><div class="timeline-marks">{#each active.beats as beat,i}<button onclick={()=>{playing=false;time=i===0?0:i===1?total*.45:total;}}><i></i>{beat}</button>{/each}</div></div></div>
    <div class="scene-description"><p>{active.description}</p><span>SPACE TO PLAY <b>·</b> ← → TO SCRUB</span></div>
   {/if}
  {/if}
 </div>
 </main>
 {#if !clean}<footer class="workspace-footer"><span>CAN’T STOP <i> / </i> DESKTOP + PHONE STUDIES</span><span>THRELTE · PHYSICAL MATERIALS · SEEDED MOTION</span><a href={stagePhone?phoneConcept:desktopConcept} target="_blank" rel="noreferrer">Concept reference ↗</a></footer>{/if}
</div>

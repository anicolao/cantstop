<script lang="ts">
 import {onMount} from 'svelte';
 import {watchTowers} from '../../game/towers/connection';
 import {saveTower,type Tower} from '../../game/towers/model';
 let {value=$bindable<string|null>(null),disabled=false}:{value?:string|null;disabled?:boolean}=$props();
 let towers=$state<Tower[]>([]),message=$state('Looking for active towers…');
 onMount(()=>watchTowers(list=>{towers=list;message=list.length?'Rolls will come from the selected tower.':'No active towers. Start sharing rolls in DiceTower.';},text=>message=text));
 function changed(){saveTower(value);}
</script>
<label>Dice source<select aria-label="Dice source" bind:value {disabled} onchange={changed}>
 <option value={null}>Digital dice</option>
 {#each towers as tower}<option value={tower.id}>{tower.name} · {tower.id.slice(-6)}</option>{/each}
 {#if value&&!towers.some(t=>t.id===value)}<option value={value}>Selected tower · offline ({value.slice(-6)})</option>{/if}
</select></label>
<p role="status">{message}</p>

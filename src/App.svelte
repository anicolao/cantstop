<script lang="ts">
 import LabApp from './LabApp.svelte';
 import TabletopApp from './TabletopApp.svelte';
 import GameApp from './GameApp.svelte';
 const lab=/\/(dev\/animations|dev\/components|gallery)\/?$/.test(location.pathname);
 const tabletop=/\/tt\/?$/.test(location.pathname)||new URLSearchParams(location.search).get('view')==='tabletop';
</script>
{#if tabletop}<TabletopApp/>{:else if lab}<LabApp/>{:else}<GameApp/>{/if}

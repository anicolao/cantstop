<script lang="ts">
 import LabApp from './LabApp.svelte';
 import GameApp from './GameApp.svelte';
 const lab=/\/(dev\/animations|dev\/components|gallery)\/?$/.test(location.pathname);
</script>
{#if lab}<LabApp/>{:else}<GameApp/>{/if}

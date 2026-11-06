<script lang="ts">
 import {T} from '@threlte/core';
 import {PODIUM} from '../presentation/layout';
 import type {Library} from './materials';
 let {lib}:{lib:Library}=$props();
</script>
<T.Group position={[PODIUM.x,0,PODIUM.z]} name="runner-podium">
 <T.Mesh position.y={-.14} material={lib.wood} castShadow receiveShadow><T.CylinderGeometry args={[PODIUM.radius+.05,PODIUM.radius+.12,.28,96]}/></T.Mesh>
 <T.Mesh position.y={.025} material={lib.brass} castShadow receiveShadow><T.CylinderGeometry args={[PODIUM.radius,PODIUM.radius+.035,.05,96]}/></T.Mesh>
 <T.Mesh position.y={.125} material={lib.ivory} castShadow receiveShadow><T.CylinderGeometry args={[PODIUM.radius-.05,PODIUM.radius,.15,96]}/></T.Mesh>
 <T.Mesh position.y={.202} rotation.x={-Math.PI/2} material={lib.brass}><T.RingGeometry args={[PODIUM.radius-.14,PODIUM.radius-.12,96]}/></T.Mesh>
</T.Group>

import type {MeshPhysicalMaterial} from 'three';
/**
 * Rendering budget for the shared tabletop.
 *
 * Measured on the 55-inch table (Orange Pi 5 Plus, Mali-G610 MC4, Chromium/ANGLE,
 * 3840x2160) by timing the real scene with one factor changed at a time:
 *
 *   as shipped (4K, ruby transmission)       200 ms/frame   6.5 fps
 *   empty scene at 4K (clear + present)       17 ms         59.4 fps
 *   ruby transmission off                     88 ms         13.3 fps
 *   1920x1080 drawing buffer                  69 ms         18.4 fps
 *   1920x1080 and transmission off            37 ms         37.6 fps
 *
 * Presenting a 4K canvas is cheap; shading 8.3M pixels is not. The GPU is the
 * bottleneck (render() submits in ~29 ms of the 200), cost scales with pixel
 * count, and transmission doubles it: three.js re-renders every opaque object
 * into a full-size target each frame (831 draw calls instead of 506).
 * Rendering the transmission pass at quarter resolution still left 115 ms.
 *
 * So the table renders at most a 1080p-equivalent buffer, which the compositor
 * scales to the panel, and its dice are polished rather than transmissive.
 * Desktop and phone keep the full treatment.
 */
export const TABLETOP_PIXEL_BUDGET=1920*1080;
const MAX_DPR=1.75;

/** Device pixel ratio for a canvas of `width`x`height` CSS pixels. */
export function tableDpr(tabletop:boolean,width:number,height:number,deviceRatio:number){
 const cap=Math.min(deviceRatio,MAX_DPR);
 if(!tabletop||!(width>0)||!(height>0))return cap;
 return Math.min(cap,Math.sqrt(TABLETOP_PIXEL_BUDGET/(width*height)));
}

const TRANSMISSIVE={transmission:.65,thickness:1.1,emissiveIntensity:0};
const POLISHED={transmission:0,thickness:0,emissiveIntensity:.35};
/** Switch the ruby dice between real transmission and an opaque polished finish. */
export function setRubyTransmission(ruby:MeshPhysicalMaterial,transmissive:boolean){
 const finish=transmissive?TRANSMISSIVE:POLISHED;
 if(ruby.transmission===finish.transmission)return;
 Object.assign(ruby,finish);ruby.needsUpdate=true;
}

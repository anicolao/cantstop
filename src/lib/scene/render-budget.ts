/**
 * Rendering budget for the shared tabletop.
 *
 * Measured on the 55-inch table (Orange Pi 5 Plus, Mali-G610 MC4, Chromium/ANGLE,
 * 3840x2160) by timing the real scene with one factor changed at a time.
 *
 * Native 4K, as first shipped:
 *   as shipped (4K, ruby transmission)       200 ms/frame   6.5 fps
 *   empty scene at 4K (clear + present)       17 ms         59.4 fps
 *   ruby transmission off                     88 ms         13.3 fps
 *   1920x1080 drawing buffer                  69 ms         18.4 fps
 *   1920x1080 and transmission off            37 ms         37.6 fps
 *
 * Presenting a 4K canvas is cheap; shading 8.3M pixels is not. Transmission
 * re-renders every opaque object into a full-size target each frame, so the
 * table's dice use an opaque gloss finish instead (Die `gloss`).
 *
 * At 1920x1080 without transmission (37.8 ms), the felt and table that fill
 * the screen were the largest remaining cost:
 *   felt and table unlit                      24.8 ms        59.6 fps
 *   scene.environment removed                 28.5 ms        52.3 fps
 *   felt and table as Lambert                 30.1 ms        52.2 fps
 *   shadows off                               37.2 ms        39.8 fps
 *   dice and all 84 pips hidden               34.5 ms        38.4 fps
 *
 * Image-based lighting is sampled per pixel by every standard and physical
 * material, twice for clearcoat. three.js only applies scene.environment to
 * those materials, so the table's felt and wood use per-fragment Lambert with
 * the same maps: they keep lights, normal maps and received shadows, and the
 * glossy pieces keep their reflections.
 */
export const TABLETOP_PIXEL_BUDGET=1920*1080;
const MAX_DPR=1.75;

/** Device pixel ratio for a canvas of `width`x`height` CSS pixels. */
export function tableDpr(tabletop:boolean,width:number,height:number,deviceRatio:number){
 const cap=Math.min(deviceRatio,MAX_DPR);
 if(!tabletop||!(width>0)||!(height>0))return cap;
 return Math.min(cap,Math.sqrt(TABLETOP_PIXEL_BUDGET/(width*height)));
}

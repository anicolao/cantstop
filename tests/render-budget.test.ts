import {expect,test} from 'bun:test';
import {MeshPhysicalMaterial} from 'three';
import {TABLETOP_PIXEL_BUDGET,tableDpr,setRubyTransmission} from '../src/lib/scene/render-budget';

test('the 4K table renders a 1080p-equivalent drawing buffer',()=>{
 const dpr=tableDpr(true,3840,2160,1);
 expect(dpr).toBeCloseTo(.5,6);
 expect(Math.round(3840*dpr)*Math.round(2160*dpr)).toBeLessThanOrEqual(TABLETOP_PIXEL_BUDGET);
});

test('a table already within budget keeps its native ratio',()=>{
 expect(tableDpr(true,1920,1080,1)).toBe(1);
 expect(tableDpr(true,1280,720,1)).toBe(1);
});

test('desktop and phone keep the existing cap regardless of size',()=>{
 expect(tableDpr(false,3840,2160,1)).toBe(1);
 expect(tableDpr(false,390,844,3)).toBe(1.75);
});

test('an unmeasured canvas falls back to the device cap',()=>{
 expect(tableDpr(true,0,0,2)).toBe(1.75);
});

test('ruby switches between transmissive and polished finishes',()=>{
 const ruby=new MeshPhysicalMaterial({transmission:.65,thickness:1.1,emissive:'#5c0712',emissiveIntensity:0});
 const version=ruby.version;
 setRubyTransmission(ruby,false);
 expect(ruby.transmission).toBe(0);expect(ruby.emissiveIntensity).toBeGreaterThan(0);expect(ruby.version).toBeGreaterThan(version);
 setRubyTransmission(ruby,true);
 expect(ruby.transmission).toBe(.65);expect(ruby.thickness).toBe(1.1);expect(ruby.emissiveIntensity).toBe(0);
 const settled=ruby.version;setRubyTransmission(ruby,true);expect(ruby.version).toBe(settled);
});

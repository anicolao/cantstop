import {CanvasTexture,TextureLoader,RepeatWrapping,SRGBColorSpace,MeshPhysicalMaterial,MeshStandardMaterial,Vector2,type Texture} from 'three';
import {random} from '../model/game';
export type Surfaces={wood:Texture;woodNormal:Texture;woodRough:Texture;clothNormal:Texture;clothRough:Texture};
export async function loadSurfaces():Promise<Surfaces>{
 const loader=new TextureLoader();
 const names=['walnut-color','walnut-normal','walnut-roughness','cloth-normal','cloth-roughness'];
 const maps=await Promise.all(names.map(n=>loader.loadAsync(`/materials/${n}.jpg`)));
 for(const [i,t] of maps.entries()){t.anisotropy=8;t.wrapS=t.wrapT=RepeatWrapping;if(i===0)t.colorSpace=SRGBColorSpace;if(i>=3)t.repeat.set(20,20);}
 return {wood:maps[0],woodNormal:maps[1],woodRough:maps[2],clothNormal:maps[3],clothRough:maps[4]};
}
export function canvasTexture(canvas:HTMLCanvasElement){const t=new CanvasTexture(canvas);t.colorSpace=SRGBColorSpace;t.anisotropy=8;return t;}
export function grain(kind:'lacquer'|'ivory'|'felt'){
 const c=document.createElement('canvas');c.width=c.height=512;const g=c.getContext('2d')!,data=g.createImageData(512,512),rand=random(72);
 const base=kind==='lacquer'?[134,23,24]:kind==='ivory'?[233,215,177]:[9,34,39];
 for(let y=0;y<512;y++)for(let x=0;x<512;x++){
   const noise=(rand()-.5)*(kind==='felt'?24:8),marble=Math.sin(x*.04+Math.sin(y*.014)*5)*Math.sin(y*.023+x*.008)*(kind==='lacquer'?15:3),i=(y*512+x)*4;
   for(let j=0;j<3;j++)data.data[i+j]=base[j]+noise+marble;
   data.data[i+3]=255;
 }
 g.putImageData(data,0,0);
 if(kind==='ivory'){for(let i=0;i<12;i++){g.beginPath();g.moveTo(rand()*512,0);g.bezierCurveTo(rand()*512,150,rand()*512,350,rand()*512,512);g.strokeStyle='#8d794b0b';g.lineWidth=.8;g.stroke();}}
 const t=canvasTexture(c);if(kind==='felt'){t.wrapS=t.wrapT=RepeatWrapping;t.repeat.set(8,8);}return t;
}
/** Pale maple with gently curling growth lines and fine pores. */
function mapleTextures(){
 const color=document.createElement('canvas'),rough=document.createElement('canvas');
 color.width=rough.width=1024;color.height=rough.height=512;
 const cg=color.getContext('2d')!,rg=rough.getContext('2d')!;
 const pixels=cg.createImageData(1024,512),roughPixels=rg.createImageData(1024,512),rand=random(319);
 for(let y=0;y<512;y++)for(let x=0;x<1024;x++){
  const i=(y*1024+x)*4;
  const flow=y+9*Math.sin(x*.008)+5*Math.sin(x*.019+y*.006);
  const growth=Math.sin(flow*.105+Math.sin(x*.004)*1.6);
  const pore=Math.pow((Math.sin(flow*.92+x*.001)+1)/2,14);
  const grain=growth*5-pore*13+(rand()-.5)*3;
  for(const [j,base] of [238,213,171].entries())pixels.data[i+j]=base+grain;
  const r=180-pore*22+growth*8;
  roughPixels.data[i]=roughPixels.data[i+1]=roughPixels.data[i+2]=r;
  pixels.data[i+3]=roughPixels.data[i+3]=255;
 }
 cg.putImageData(pixels,0,0);rg.putImageData(roughPixels,0,0);
 const albedo=canvasTexture(color),roughness=new CanvasTexture(rough);roughness.anisotropy=8;
 return {albedo,roughness};
}
export function labelTexture(text:string,sub='',dark=false,aspect=5,inactive=false){
 const c=document.createElement('canvas');c.width=1024;c.height=Math.max(96,Math.min(1024,Math.round(1024/aspect)));const g=c.getContext('2d')!;
 g.textAlign='center';g.textBaseline='middle';
 let size=c.height*(sub?.44:.75);g.font=`600 ${size}px Georgia,serif`;
 const measured=g.measureText(text).width;if(measured>950)size*=950/measured;
 g.font=`600 ${size}px Georgia,serif`;g.fillStyle=inactive?(dark?'#73777a':'#9c8c78'):dark?'#182028':'#f7dfb0';g.shadowColor=dark?'#fff0c566':'#1d080b';g.shadowBlur=dark?0:2;g.shadowOffsetY=dark?-1:2;
 g.fillText(text,512,sub?c.height*.36:c.height*.52,980);
 if(inactive){
  const half=Math.min(460,g.measureText(text).width/2+size*.08),y=sub?c.height*.36:c.height*.52;
  g.strokeStyle=dark?'#60686d':'#ac9980';g.lineWidth=Math.max(5,size*.065);g.beginPath();g.moveTo(512-half,y);g.lineTo(512+half,y);g.stroke();
 }
 if(sub){g.font=`${c.height*.18}px Arial,sans-serif`;g.fillStyle=dark?'#664321':'#c9b68e';g.fillText(sub,512,c.height*.79,980);}
 return canvasTexture(c);
}
export function materials(s:Surfaces){
 const lacquer=grain('lacquer'),ivory=grain('ivory'),felt=grain('felt'),maple=mapleTextures();
 const mapleFinish={map:maple.albedo,metalness:0,roughness:.68,roughnessMap:maple.roughness,bumpMap:maple.roughness,bumpScale:.008,clearcoat:.28,clearcoatRoughness:.4};
 return {
  button:new MeshPhysicalMaterial({...mapleFinish,color:'#ffffff'}),
  buttonActive:new MeshPhysicalMaterial({...mapleFinish,color:'#fff2d7'}),
  buttonDisabled:new MeshPhysicalMaterial({...mapleFinish,color:'#918574',roughness:.85,clearcoat:0}),
  wood:new MeshPhysicalMaterial({map:s.wood,normalMap:s.woodNormal,normalScale:new Vector2(.14,.14),roughnessMap:s.woodRough,color:'#986742',roughness:.5,clearcoat:.5,clearcoatRoughness:.3}),
  brass:new MeshPhysicalMaterial({color:'#c49950',metalness:.73,roughness:.32,clearcoat:.18}),
  darkBrass:new MeshStandardMaterial({color:'#5f3b20',metalness:.65,roughness:.44}),
  enamel:new MeshPhysicalMaterial({map:lacquer,color:'#ffffff',roughness:.19,clearcoat:1,clearcoatRoughness:.18}),
  ivory:new MeshPhysicalMaterial({map:ivory,roughness:.48,clearcoat:.35,clearcoatRoughness:.3}),
  cloth:new MeshPhysicalMaterial({map:felt,normalMap:s.clothNormal,normalScale:new Vector2(.14,.14),roughnessMap:s.clothRough,roughness:1,sheen:.8,sheenColor:'#4b8984',sheenRoughness:.85}),
  leather:new MeshPhysicalMaterial({color:'#361a16',bumpMap:felt,bumpScale:.035,roughness:.75,clearcoat:.13}),
  ruby:new MeshPhysicalMaterial({color:'#a01122',metalness:.05,roughness:.09,transmission:.65,thickness:1.1,ior:1.49,clearcoat:1,clearcoatRoughness:.07,attenuationColor:'#c91834',attenuationDistance:2.4}),
  pip:new MeshPhysicalMaterial({color:'#fff0c6',roughness:.3,clearcoat:.4}),
  textures:[lacquer,ivory,felt,maple.albedo,maple.roughness]
 };
}
export type Library=ReturnType<typeof materials>;
export function disposeLibrary(lib:Library){for(const v of Object.values(lib)){if(Array.isArray(v))v.forEach(t=>t.dispose());else v.dispose();}}

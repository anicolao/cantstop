import {Shape,ExtrudeGeometry,Vector2,LatheGeometry} from 'three';
/** A square on the X/Z table plane, with a vertex facing each table edge. */
export function rotatedSquare(halfDiagonal:number){
 const s=new Shape();s.moveTo(0,halfDiagonal);s.lineTo(halfDiagonal,0);
 s.lineTo(0,-halfDiagonal);s.lineTo(-halfDiagonal,0);s.closePath();return s;
}
export function outline(width:number,depth:number,r=.16){const s=new Shape(),x=-width/2,y=-depth/2;s.moveTo(x+r,y);s.lineTo(x+width-r,y);s.quadraticCurveTo(x+width,y,x+width,y+r);s.lineTo(x+width,y+depth-r);s.quadraticCurveTo(x+width,y+depth,x+width-r,y+depth);s.lineTo(x+r,y+depth);s.quadraticCurveTo(x,y+depth,x,y+depth-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);return s;}
export function slab(shape:Shape,height=.12,bevel=.05){const g=new ExtrudeGeometry(shape,{depth:height,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:bevel,bevelThickness:bevel,curveSegments:16});
 g.computeBoundingBox();const b=g.boundingBox!,p=g.getAttribute('position'),uv=g.getAttribute('uv'),norm=g.getAttribute('normal');
 for(let i=0;i<p.count;i++)if(Math.abs(norm.getZ(i))>.9)uv.setXY(i,(p.getX(i)-b.min.x)/(b.max.x-b.min.x),(p.getY(i)-b.min.y)/(b.max.y-b.min.y));
 return g;}
export function runnerGeometry(){return new LatheGeometry([[.27,0],[.29,.06],[.27,.12],[.2,.16],[.18,.23],[.11,.55],[.11,.61],[.16,.66],[.16,.74],[.11,.79],[0,.81]].map(([radius,height])=>new Vector2(radius*.27/.29,height)),32);}

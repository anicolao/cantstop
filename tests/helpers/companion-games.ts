import type {Intent} from '../../src/lib/model/game';
// Real seeded choices, not injected outcomes. Keep browser turns short enough to
// review at full rendering quality on CI's software renderer.
export const COMPANION_GAMES={
 web:{seed:'00000000-0000-4000-8000-000000000001',nextSeat:0,actions:[
  {seat:1,intent:{type:'advance',pairing:2}},{seat:1,intent:{type:'roll'}},{seat:1,intent:{type:'advance',pairing:2}},{seat:1,intent:{type:'stop'}},
  {seat:2,intent:{type:'advance',pairing:2}},{seat:2,intent:{type:'roll'}},{seat:2,intent:{type:'advance',pairing:0}},{seat:2,intent:{type:'roll'}},{seat:2,intent:{type:'advance',pairing:0}},{seat:2,intent:{type:'roll'}},
  {seat:3,intent:{type:'advance',pairing:0}},{seat:3,intent:{type:'roll'}},{seat:3,intent:{type:'advance',pairing:0}},{seat:3,intent:{type:'roll'}}
 ]},
 tabletop:{seed:'00000000-0000-4000-8000-00000000000d',nextSeat:2,actions:[
  {seat:1,intent:{type:'advance',pairing:0}},{seat:1,intent:{type:'roll'}},{seat:1,intent:{type:'advance',pairing:0}},{seat:1,intent:{type:'stop'}}
 ]}
} satisfies Record<string,{seed:string;nextSeat:number;actions:{seat:number;intent:Intent}[]}>;

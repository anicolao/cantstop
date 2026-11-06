import {describe,test,expect} from 'bun:test';
import {apply,initialState} from '../src/game/engine';
import {readLaunch,launchIntent} from '../src/game/launcher';
describe('URL launches',()=>{
 test('existing invitation URLs retain the manual seating flow',()=>expect(readLaunch('?table=ABC123')).toBeNull());
 test('names and return URLs are preferences, without an identity override',()=>{
  expect(readLaunch('?table=ABC123&launch=join&name=Alex%20%26%20Sam&returnTo=https%3A%2F%2Fexample.com%2F%3Froom%3D1234')).toEqual({table:'ABC123',mode:'join',name:'Alex & Sam',returnTo:'https://example.com/?room=1234'});
 });
 test('invalid and unsafe invitations never silently create a game',()=>{
  for(const url of ['?launch=no','?launch=join&table=bad&name=Alex','?launch=create&table=ABC123&name='])expect(()=>readLaunch(url)).toThrow();
  expect(readLaunch('?launch=join&table=ABC123&name=Alex&returnTo=javascript:alert(1)')?.returnTo).toBeNull();
  expect(readLaunch('?launch=join&table=ABC123&name=Alex&returnTo=https://user:password@example.com')?.returnTo).toBeNull();
 });
 test('guest arriving before the host waits; only host creates',()=>{
  const guest=readLaunch('?table=ABC123&launch=join&name=Sam')!,host=readLaunch('?table=ABC123&launch=create&name=Alex')!;
  const empty=initialState();expect(launchIntent(guest,empty,'sam')).toBeNull();
  const created=apply(empty,'alex',launchIntent(host,empty,'alex')!);
  const joined=apply(created,'sam',launchIntent(guest,created,'sam')!);
  expect(joined.host).toBe('alex');expect(joined.players.map(p=>p.name)).toEqual(['Alex','Sam']);
  expect(launchIntent(host,joined,'alex')).toBeNull();expect(launchIntent(guest,joined,'sam')).toBeNull();
 });
 test('colliding host URL cannot claim or join someone else’s table',()=>{
  const other=apply(initialState(),'other',{type:'create',name:'Other'});
  expect(()=>launchIntent(readLaunch('?table=ABC123&launch=create&name=Alex')!,other,'alex')).toThrow('already belongs');
 });
});

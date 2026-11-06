/** A small, pure prototype model. Animation clocks never enter these intents. */
export const LENGTHS = [3,5,7,9,11,13,11,9,7,5,3] as const;
export const PLAYERS = [
  { name: 'Ari', mark: '◉' }, { name: 'Bea', mark: '■' },
  { name: 'Cal', mark: '▲' }, { name: 'Dev', mark: '◆' }
];
export type Column = number;
export type Positions = Record<number, number>;
export type State = {
  version: 1; seed: number; rollIndex: number; active: number; phase: 'ready'|'choose'|'decide'|'finished';
  saved: Positions[]; runners: Positions; claims: number[][]; dice: number[];
  lastOutcome: 'none'|'roll'|'advance'|'save'|'bust'|'claim'|'win';
};
export type Intent = { type: 'roll' } | { type: 'advance'; pairing: number; column?: number } | { type: 'stop' };
export type Pairing = { index: number; dice: number[][]; sums: number[]; variants: { moves: Positions; column?: number }[] };
export const pairIndices = [[[0,1],[2,3]], [[0,2],[1,3]], [[0,3],[1,2]]];
export const lengthOf = (column:number) => LENGTHS[column-2];
export function random(seed:number) { let x=seed>>>0; return () => { x += 0x6D2B79F5; let t=x; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; }; }
export function roll(seed:number,index=0) { const next=random((seed+Math.imul(index,7919))>>>0); return Array.from({length:4},()=>1+Math.floor(next()*6)); }
export function seedFor(values:number[]) { for(let seed=1;seed<200000;seed++)if(roll(seed).join(',')===values.join(','))return seed; throw new Error('No review seed'); }
export function fixture(overrides:Partial<State>={}):State {
  return { version:1, seed:seedFor([1,2,5,6]), rollIndex:0, active:0, phase:'decide',
    saved:[{6:3,7:5,8:2},{3:2,5:3,7:4,11:2},{5:4,8:5},{4:3,6:6,9:2}],
    runners:{6:4,7:7,8:3}, claims:[[10],[2],[12],[]], dice:[1,2,5,6], lastOutcome:'none', ...overrides };
}
export function risk(state:State) { return Object.entries(state.runners).reduce((n,[c,p])=>n+p-(state.saved[state.active][+c]??0),0); }
export function pairings(state:State):Pairing[] {
  const closed=new Set(state.claims.flat());
  return pairIndices.map((pairs,index)=> {
    const sums=pairs.map(([a,b])=>state.dice[a]+state.dice[b]);
    const attempts: {moves:Positions;column?:number}[]=[];
    // Both processing orders expose the final-runner choice without discarding usable sums.
    for(const order of [sums,[...sums].reverse()]){
      const runners={...state.runners},moves:Positions={}; let column:number|undefined;
      for(const c of order){
        if(closed.has(c))continue;
        if(runners[c]!==undefined){if(runners[c]<lengthOf(c)){runners[c]++;moves[c]=(moves[c]??0)+1;}}
        else if(Object.keys(runners).length<3){runners[c]=(state.saved[state.active][c]??0)+1;moves[c]=(moves[c]??0)+1;column=c;}
      }
      const key=JSON.stringify(Object.entries(moves).sort(([a],[b])=>+a-+b));
      if(Object.keys(moves).length&&!attempts.some(a=>JSON.stringify(Object.entries(a.moves).sort(([a],[b])=>+a-+b))===key))attempts.push({moves,column});
    }
    return { index,dice:pairs,sums,variants:attempts };
  });
}
export function apply(state:State,intent:Intent):State {
  if(state.phase==='finished')throw new Error('The game has finished');
  const next:State=structuredClone(state);
  if(intent.type==='roll'){
    if(!['ready','decide'].includes(state.phase))throw new Error('Finish this roll first');
    next.dice=roll(state.seed,state.rollIndex);next.rollIndex++;next.phase='choose';next.lastOutcome='roll';
    if(!pairings(next).some(p=>p.variants.length)){next.runners={};next.active=(state.active+1)%4;next.phase='ready';next.lastOutcome='bust';}
  }else if(intent.type==='advance'){
    if(state.phase!=='choose')throw new Error('Roll before choosing');
    const p=pairings(state).find(p=>p.index===intent.pairing);
    const v=p?.variants.length===1?p.variants[0]:p?.variants.find(v=>v.column===intent.column);
    if(!v)throw new Error('Choose a legal runner destination');
    for(const [c,steps] of Object.entries(v.moves))next.runners[+c]=(state.runners[+c]??state.saved[state.active][+c]??0)+steps;
    next.phase='decide';next.lastOutcome='advance';
  }else{
    if(state.phase!=='decide'||!Object.keys(state.runners).length)throw new Error('Move before stopping');
    let claimed=false;
    for(const [c,pos] of Object.entries(state.runners)){
      next.saved[state.active][+c]=pos;
      if(pos===lengthOf(+c)){
        claimed=true;next.claims[state.active].push(+c);
        for(const s of next.saved)delete s[+c];
      }
    }
    next.runners={};next.lastOutcome=claimed?'claim':'save';
    if(next.claims[state.active].length>=3){next.phase='finished';next.lastOutcome='win';}
    else {next.phase='ready';next.active=(state.active+1)%4;}
  }
  return next;
}
export function replay(initial:State,intents:Intent[]) { return intents.reduce(apply,structuredClone(initial)); }

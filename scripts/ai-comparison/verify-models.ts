import {prediction,model} from './neural';
for(const name of ['imitation','rl','value','selfplay','selfplay-retry','oracle']){
 const m=model(name) as ReturnType<typeof model>&{probes:{input:number[];outputs:Record<'pair'|'stop',number>}[]};
 let maxError=0;
 for(const probe of m.probes)for(const [head,expected] of Object.entries(probe.outputs)){
  const error=Math.abs(prediction(name,probe.input,head as 'pair'|'stop')-expected);
  maxError=Math.max(maxError,error);if(error>1e-4)throw new Error(`${name} inference error ${error}`);
 }
 console.log(name,m.sha256,'maximum absolute error',maxError);
}

"""Export recovered checkpoints safely for dependency-free Bun inference.
Usage: python export-models.py handoff.zip output-directory
Requires torch only in this offline conversion environment.
"""
import hashlib, io, json, pathlib, sys, zipfile
import torch
names = {'imitation':'imitation_model', 'rl':'rl_model', 'value':'value_trained',
         'selfplay':'selfplay_latest', 'selfplay-retry':'selfplay_latest_retry', 'oracle':'vs_oracle_latest'}
out=pathlib.Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True)
with zipfile.ZipFile(sys.argv[1]) as z:
    for name, suffix in names.items():
        raw=z.read(f'artifacts/cant_stop_{suffix}.pt')
        weights=torch.load(io.BytesIO(raw),weights_only=True,map_location='cpu')
        result={'sha256':hashlib.sha256(raw).hexdigest(),'weights':{k:v.tolist() for k,v in weights.items()}}
        probes=[]
        for k in range(4):
            x=torch.tensor([((i*17+k*7)%23)/23 for i in range(85)],dtype=torch.float32)
            def layer(key, x, tanh=False):
                y=torch.nn.functional.linear(x,weights[key+'.weight'],weights[key+'.bias'])
                return y.tanh() if tanh else y
            if name in ('imitation','rl'):
                hidden=layer('trunk.2',layer('trunk.0',x,True),True)
                stop=layer('stop',hidden)
                outputs={'pair':layer('pair',hidden).item(),'stop':(stop[1]-stop[0]).item()}
            else:
                outputs={'pair':layer('4',layer('2',layer('0',x,True),True)).item()}
            probes.append({'input':x.tolist(),'outputs':outputs})
        result['probes']=probes
        (out/f'{name}.json').write_text(json.dumps(result,separators=(',',':')))
        print(name,result['sha256'])

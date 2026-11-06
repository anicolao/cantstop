import './start';
const vite=Bun.spawn(['bun','x','vite','--host',process.env.VITE_HOST??'127.0.0.1','--port',process.env.VITE_PORT??'5199','--strictPort'],{stdout:'inherit',stderr:'inherit'});
process.on('exit',()=>vite.kill());process.exit(await vite.exited);

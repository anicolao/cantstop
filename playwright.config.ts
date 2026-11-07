import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'./tests',testMatch:'*.spec.ts',fullyParallel:false,workers:1,timeout:60000,
 use:{channel:'chromium',launchOptions:{args:['--disable-gpu','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']},baseURL:'http://127.0.0.1:5399',viewport:{width:1440,height:1000},deviceScaleFactor:1,trace:'retain-on-failure'},
 webServer:{command:'bun run scripts/dev.ts e2e',url:'http://127.0.0.1:5399',reuseExistingServer:false,timeout:120000},
 reporter:[['list']]
});

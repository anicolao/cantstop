import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  plugins: [svelte()],
  resolve: { alias: [{ find: /^@threlte\/extras$/, replacement: fileURLToPath(new URL('./node_modules/@threlte/extras/dist/interactivity/index.js', import.meta.url)) }] }
});

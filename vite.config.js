import { defineConfig } from 'vite';

// base './' lets the built site run from any folder (GitHub Pages serves it under /<repo>/)
export default defineConfig({ base: './', build: { target: 'es2022', chunkSizeWarningLimit: 4000 } });

import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [svelte()],
    base: './', 
    logLevel: 'info',  // Options are 'info', 'warn', 'error', and 'silent'

    build: {
      target: "es2022",
      rollupOptions: {
        output: {

        }
      }
    },
    esbuild: {
      target: "es2022"
    },
    optimizeDeps:{
      esbuildOptions: {
        target: "es2022",
        // Disable sourcemaps for prebundled deps to suppress dev console warnings from .vite/deps
        sourcemap: false,
      }
    }


})

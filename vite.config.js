import { defineConfig } from 'vite';
import { execSync } from 'node:child_process';

let build = 'dev';
try { build = execSync('git rev-parse --short HEAD').toString().trim(); } catch {}

// Relative base so the build works from any GitHub Pages sub-path.
export default defineConfig({
  base: './',
  define: { __BUILD__: JSON.stringify(build) },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1500,
  },
});

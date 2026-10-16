import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import {defineConfig, Plugin} from 'vite';

// SATU NILAI BUILD ID: Dihitung SATU KALI saja di tingkat modul
const BUILD_ID = Date.now().toString();
const BUILD_TIME = new Date().toISOString();

function versionPlugin(): Plugin {
  return {
    name: 'generate-version-file',
    buildStart() {
      try {
        const publicDir = path.resolve(import.meta.dirname ?? '.', 'public');
        if (!fs.existsSync(publicDir)) {
          fs.mkdirSync(publicDir, { recursive: true });
        }
        fs.writeFileSync(
          path.join(publicDir, 'version.json'),
          JSON.stringify({ buildId: BUILD_ID, buildTime: BUILD_TIME }, null, 2)
        );
      } catch (err) {
        console.warn('Gagal menulis public/version.json:', err);
      }
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ buildId: BUILD_ID, buildTime: BUILD_TIME }, null, 2),
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), versionPlugin()],
    define: {
      __APP_BUILD_ID__: JSON.stringify(BUILD_ID),
      __APP_BUILD_TIME__: JSON.stringify(BUILD_TIME),
    },
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname ?? '.', '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});


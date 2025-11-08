import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import svgr from 'vite-plugin-svgr'
import path from 'path'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const monacoEditorPlugin = require('vite-plugin-monaco-editor').default

// https://vite.dev/config/
export default defineConfig({
  // CRITICAL: Use relative paths for Electron (file:// protocol)
  // Without this, assets will try to load from filesystem root
  base: './',

  plugins: [
    react(),
    svgr({
      svgrOptions: {
        exportType: 'default',
      },
    }),
    monacoEditorPlugin({
      languageWorkers: ['editorWorkerService', 'css', 'html', 'json', 'typescript']
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Monaco Editor optimization
  optimizeDeps: {
    include: ['monaco-editor']
  },
})

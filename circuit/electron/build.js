/**
 * Build script for Electron main process
 * Bundles all TypeScript files into a single JavaScript file
 */

import { build } from 'esbuild'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)

build({
  entryPoints: ['electron/main.cjs'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  external: [
    'electron',
    'better-sqlite3',
    'chokidar'
  ],
  outfile: 'dist-electron/main.js',
  format: 'cjs',
  sourcemap: true,
  logLevel: 'info',
}).catch(() => process.exit(1))

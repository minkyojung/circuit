# Octave macOS Distribution - Quick Reference

## Current State
- **Type**: Electron 38.3.0 + React 19 + Vite 7 + TypeScript
- **Status**: Development-ready, NOT distribution-ready
- **Main Issue**: electron-builder installed but unconfigured

## Build Commands
```bash
# Development (with hot reload)
npm run dev

# Production build
npm run build

# Package (creates .app - currently uses defaults)
npm run package

# Detailed flow
npm run build:electron    # Compile Electron main process
npm run build            # Full build: TS + Vite + Electron
npm run package          # Run electron-builder
```

## Entry Points
| Type | File | Role |
|------|------|------|
| **Electron** | `electron/main.cjs` | Main process, IPC handlers, window management |
| **React** | `src/main.tsx` | React app entry |
| **React Root** | `src/App.tsx` | Root component |
| **HTML** | `index.html` | DOM entry, loads React |
| **Production Electron** | `dist-electron/main.js` | Compiled main process |
| **Production React** | `dist/index.html` | Built React app |

## Distribution Checklist
- [ ] Create electron-builder.yml with appId, icon, signing config
- [ ] Generate app icon (1024x1024 PNG → .icns)
- [ ] Obtain Apple Developer ID Certificate
- [ ] Configure code signing in electron-builder.yml
- [ ] Setup notarization (Apple ID required)
- [ ] Enable security: contextIsolation: true, nodeIntegration: false
- [ ] Update version in package.json (currently 0.0.0)
- [ ] Test packaging locally
- [ ] Create release process (GitHub Actions recommended)

## Security Issues to Fix
1. **contextIsolation: false** → should be true (in main.cjs)
2. **nodeIntegration: true** → should be false (in main.cjs)
3. Implement preload script for secure IPC

## Build Process
```
1. TypeScript Compilation
   tsc -b (app + electron)
   └─→ dist/ (React)
   └─→ dist-electron/ (CommonJS)

2. Vite Build (React)
   vite build
   └─→ dist/index.html + assets

3. Electron Packaging
   electron-builder
   └─→ Octave.app (macOS bundle)
   └─→ Octave.dmg (optional)
```

## Key Files
- Package config: `package.json` (scripts + dependencies)
- Frontend build: `vite.config.ts`
- Electron build: `tsconfig.electron.json`
- Main process: `electron/main.cjs`
- **MISSING**: `electron-builder.yml` ← CREATE THIS FIRST

## Dependencies (Distribution-Relevant)
- electron: 38.3.0
- electron-builder: 26.0.12 ← NOT CONFIGURED
- electron-rebuild: 3.2.9 (auto-rebuild native modules)
- better-sqlite3: 12.4.1 (native)
- node-pty: 1.0.0 (native, requires rebuild)

## Next Steps (Priority Order)
1. Create electron-builder.yml
2. Generate .icns icon
3. Add code signing config (once you have certificate)
4. Enable contextIsolation security
5. Setup notarization
6. Test with: npm run build && npm run package

## File Locations
- Source: `/Users/williamjung/conductor/octave-1/.octave/victoria/octave/`
- Main process: `electron/main.cjs`
- React app: `src/`
- Built output: `dist/` and `dist-electron/`
- Config needed: Create `electron-builder.yml` in project root

## Useful Commands for Testing
```bash
# Test the app locally
npm run dev

# Build everything
npm run build

# Try packaging (will use defaults)
npm run package

# Check the main process compiles
tsc -p tsconfig.electron.json

# Rebuild native modules for current platform
npm run postinstall
```

## Security Notes
- Current config has nodeIntegration & !contextIsolation (dev-only!)
- For production: need preload script + proper IPC isolation
- Unsigned app won't run on other macOS machines
- Notarization required for modern macOS (10.15+)


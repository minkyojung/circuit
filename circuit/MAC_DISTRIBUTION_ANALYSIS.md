# Circuit Mac App - Build & Distribution Analysis

## Executive Summary
Circuit is an Electron-based macOS developer tool that monitors tests and applies AI-suggested fixes automatically. The project uses modern web technologies (React, Vite, TypeScript) paired with Electron for desktop distribution. Currently, there is **minimal distribution configuration** - electron-builder is installed but not configured.

---

## 1. PROJECT TYPE & STRUCTURE

### Type: Electron Desktop Application
- **Framework**: Electron 38.3.0
- **Frontend**: React 19 + TypeScript
- **Build Tool**: Vite 7.1.7
- **Platform Target**: macOS 12+
- **Architecture**: Hybrid (CommonJS main process + ES modules renderer)

### Project Structure
```
circuit/
├── electron/
│   ├── main.cjs                    # Main Electron entry point
│   ├── *.ts                        # Electron process handlers (MCP, IPC, etc.)
│   └── dist-electron/              # Compiled CommonJS modules
├── src/
│   ├── components/                 # React UI components
│   ├── contexts/                   # React contexts
│   ├── core/                       # Business logic
│   ├── hooks/                      # React hooks
│   ├── lib/                        # Utilities
│   ├── types/                      # TypeScript types
│   ├── App.tsx                     # Main React app
│   └── main.tsx                    # React entry point
├── dist/                           # Built React app (production)
├── public/                         # Static assets
├── package.json                    # Dependencies & scripts
├── vite.config.ts                  # Vite configuration
├── tsconfig.*.json                 # TypeScript configurations
└── index.html                      # HTML entry point
```

---

## 2. BUILD CONFIGURATION

### Build Scripts (package.json)
```json
{
  "scripts": {
    "postinstall": "electron-rebuild -f -w better-sqlite3",
    "build:electron": "tsc -p tsconfig.electron.json && echo '{\"type\":\"commonjs\"}' > dist-electron/package.json",
    "dev": "npm run build:electron && concurrently \"vite\" \"wait-on http://localhost:5173 && cross-env VITE_DEV_SERVER_URL=http://localhost:5173 electron .\"",
    "build": "tsc -b && vite build && npm run build:electron",
    "lint": "eslint .",
    "preview": "vite preview",
    "electron": "electron .",
    "package": "electron-builder"
  }
}
```

### Build Process
1. **TypeScript Compilation**
   - `tsc -b`: Compiles all TypeScript projects
   - `tsc -p tsconfig.electron.json`: Compiles Electron main process
   - Outputs to `dist-electron/` directory
   - ES2022 target with CommonJS modules

2. **React/Frontend Build**
   - `vite build`: Bundles React app
   - Optimizes Monaco Editor
   - Outputs to `dist/` directory

3. **Packaging**
   - `electron-builder`: Creates macOS .app bundle
   - Currently uses default configuration (minimal)

### Configuration Files

#### tsconfig.electron.json
```json
{
  "compilerOptions": {
    "module": "CommonJS",
    "target": "ES2022",
    "outDir": "./dist-electron",
    "rootDir": "./electron"
  }
}
```

#### vite.config.ts
```typescript
export default defineConfig({
  plugins: [
    react(),
    svgr({...}),
  ],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") }
  },
  optimizeDeps: {
    include: ['monaco-editor']
  },
})
```

---

## 3. CURRENT DISTRIBUTION SETUP

### electron-builder Configuration
- **Status**: INSTALLED (v26.0.12) but UNCONFIGURED
- **Configuration File**: NONE (not using electron-builder.yml or forge.config.js)
- **Build Command**: `npm run package` (uses electron-builder defaults)

### Currently Generated Artifacts
When `npm run package` is run, electron-builder will:
- Generate a macOS .app bundle
- Default location: `./dist/` directory
- Use default naming and settings
- No code signing or notarization configured
- No DMG creation configured

### Main Electron Configuration (main.cjs)
```javascript
const mainWindow = new BrowserWindow({
  width: 1400,
  height: 900,
  transparent: true,
  vibrancy: 'under-window',  // macOS native glassmorphism
  visualEffectState: 'active',
  titleBarStyle: process.platform === 'darwin' ? 'hidden' : 'default',
  trafficLightPosition: { x: 20, y: 15 },  // macOS custom title bar
  webPreferences: {
    nodeIntegration: true,
    contextIsolation: false,  // NOTE: Security risk - should be enabled in prod
  },
});

// Load from Vite dev server or built files
if (process.env.VITE_DEV_SERVER_URL) {
  mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);  // Dev mode
} else {
  mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));  // Prod mode
}
```

---

## 4. CODE SIGNING & NOTARIZATION

### Current Status
- **Code Signing**: NOT CONFIGURED
- **Notarization**: NOT CONFIGURED
- **Entitlements**: NOT DEFINED
- **Gatekeeper**: Will block unsigned app on macOS

### What's Needed for Distribution
For a production macOS app, you need:

1. **Code Signing Certificate**
   - Apple Developer ID Application certificate
   - Installed in Keychain
   - Referenced in electron-builder config

2. **Entitlements File** (circuit.entitlements)
   - Define app capabilities (network access, file access, etc.)
   - Required for sandboxing

3. **Notarization** (Apple requirement for macOS 10.15+)
   - Submit app to Apple for notarization
   - Requires Apple ID
   - Proof of notarization must be stapled to app

4. **electron-builder.yml Configuration**
   ```yaml
   appId: com.example.circuit
   productName: Circuit
   
   mac:
     category: public.app-category.developer-tools
     icon: ./public/icon.icns
     certificateFile: /path/to/cert.p12
     certificatePassword: $CSC_KEY_PASSWORD
     signingIdentity: "Developer ID Application: Your Name"
     notarize:
       teamId: ABCDE12345
   
   files:
     - dist/**/*
     - dist-electron/**/*
     - node_modules/**/*
   ```

---

## 5. KEY DEPENDENCIES

### Core Dependencies (Relevant to Build/Distribution)
- **electron**: 38.3.0 - Desktop framework
- **electron-builder**: 26.0.12 - Packaging tool
- **electron-rebuild**: 3.2.9 - Native module rebuilding
- **better-sqlite3**: 12.4.1 - Database (requires native rebuilding)
- **node-pty**: 1.0.0 - Terminal emulation (native module)

### Build Dependencies
- **vite**: 7.1.7 - Frontend bundler
- **@vitejs/plugin-react**: 5.0.4 - React support
- **typescript**: 5.9.3 - Type checking
- **tailwindcss**: 3.4.18 - Styling
- **postcss**: 8.5.6 - CSS processing
- **concurrently**: 9.2.1 - Run dev and Electron together
- **wait-on**: 9.0.1 - Wait for dev server
- **cross-env**: 10.1.0 - Cross-platform env vars

### Native Modules (Require electron-rebuild)
- **better-sqlite3**: Database library
- **node-pty**: Terminal/PTY emulation

---

## 6. MAIN ENTRY POINTS

### Electron Entry Point
- **File**: `electron/main.cjs`
- **Size**: 900+ lines
- **Responsibilities**:
  - Creates main window with macOS native styling
  - Manages IPC handlers for React → Electron communication
  - Runs MCP (Model Context Protocol) servers
  - Manages terminal, conversations, memory, git operations
  - Handles webhooks (Vercel, GitHub)
  - Loads Vite dev server in development or dist bundle in production

### React Entry Points
- **File**: `src/main.tsx`
- **Root Component**: `src/App.tsx`
- **HTML Template**: `index.html` (loads `/src/main.tsx`)

### Built Entry Point (Production)
- **Main Process**: `dist-electron/main.js` (compiled from main.cjs)
- **Renderer**: `dist/index.html` with bundled React app

---

## 7. ENVIRONMENT CONFIGURATION

### Environment Files
- `.env.example` - Template for all variables
- `.env.development` - Development settings
- `.env.production` - Production settings

### Environment Variables
```bash
# Feature Flags
VITE_FEATURE_PLAN_MODE=false        # AI task planning
VITE_FEATURE_GIT_GRAPH=false        # Git graph visualization

# Optional (from code inspection)
VERCEL_TOKEN=                       # For Vercel MCP integration
VERCEL_TEAM_ID=                     # Vercel team identifier
```

### Package Configuration
- **npmrc**: Minimal config - just handles electron native modules
- **No special build vars** currently configured

---

## 8. BUNDLER & BUILD TOOLS ANALYSIS

### Frontend Build (Vite)
- **Bundler**: Vite 7.1.7
- **Target**: Modern browsers + Electron renderer process
- **Output**: Single-page app in `dist/`
- **Optimizations**:
  - Code splitting
  - Monaco Editor pre-optimization
  - SVG import support (vite-plugin-svgr)
  - JSX transformation

### Main Process Build (TypeScript)
- **Compiler**: TypeScript 5.9.3
- **Target**: CommonJS (ES2022 syntax)
- **Output**: `dist-electron/` directory
- **Entry**: `dist-electron/main.js` (from `electron/main.cjs`)

### Distribution Build (electron-builder)
- **Tool**: electron-builder 26.0.12
- **Currently**: Uses defaults (no config file)
- **Default Output**: macOS .app bundle
- **Missing**: 
  - Code signing config
  - DMG creation config
  - Notarization setup
  - App ID and metadata
  - Icon configuration

---

## 9. SECURITY CONSIDERATIONS

### Current Issues
1. **contextIsolation: false** in BrowserWindow
   - Risk: Direct access to Node.js from renderer
   - Recommendation: Enable for production
   - Change: `contextIsolation: true`

2. **nodeIntegration: true** in BrowserWindow
   - Risk: Electron APIs directly from web content
   - Recommendation: Disable and use IPC
   - Change: `nodeIntegration: false`

3. **No Code Signing**
   - macOS will block app on first run

4. **No Notarization**
   - Required for macOS 10.15+
   - Apps won't run without notarization proof

### Recommended Changes for Production
```javascript
webPreferences: {
  nodeIntegration: false,
  contextIsolation: true,
  enableRemoteModule: false,
  preload: path.join(__dirname, 'preload.js')
}
```

---

## 10. NATIVE MODULES

### Modules Requiring Building
- **better-sqlite3** (v12.4.1) - Database
  - Automatically rebuilt via `postinstall` script
  - Command: `electron-rebuild -f -w better-sqlite3`

- **node-pty** (v1.0.0) - Terminal emulation
  - Used for interactive terminal
  - Rebuilt automatically

### Building on Different Architectures
- Current setup rebuilds for current platform
- For Apple Silicon (M1/M2/M3), build on Apple Silicon
- For Intel, build on Intel
- Universal binaries require special configuration

---

## SUMMARY OF GAPS FOR DISTRIBUTION

### What's Missing

| Aspect | Current | Needed |
|--------|---------|--------|
| **electron-builder config** | None | electron-builder.yml or package.json config |
| **App ID** | Not set | com.example.circuit (reverse domain) |
| **Code Signing** | No | Developer ID certificate + signingIdentity |
| **Notarization** | No | Apple ID + notarization credentials |
| **Entitlements** | No | circuit.entitlements file |
| **Icon** | Missing | circuit.icns (1024x1024 PNG recommended) |
| **DMG Creation** | No | Configuration for distribution DMG |
| **App Store Ready** | No | Sandboxing + additional requirements |
| **Security Settings** | Weak | contextIsolation: true, nodeIntegration: false |
| **Version Management** | "0.0.0" | Semantic versioning strategy |

---

## RECOMMENDED NEXT STEPS

### Phase 1: Enable Basic Packaging (1-2 hours)
1. Create `electron-builder.yml` with basic config
2. Set appId and productName
3. Configure output formats (DMG, ZIP)
4. Test packaging locally

### Phase 2: Add Code Signing (1-2 hours)
1. Obtain Apple Developer ID Certificate
2. Install certificate in Keychain
3. Add signing config to electron-builder.yml
4. Build signed app

### Phase 3: Notarization (1-2 hours)
1. Create Apple ID for notarization
2. Generate app-specific password
3. Configure notarization in electron-builder
4. Submit and wait for Apple approval

### Phase 4: Distribution (1 hour)
1. Create GitHub release
2. Upload signed/notarized app
3. Setup auto-update mechanism
4. Document installation

---

## FILE PATHS

### Key Project Files
- Main entry: `/Users/williamjung/conductor/circuit-1/.conductor/victoria/circuit/electron/main.cjs`
- React app: `/Users/williamjung/conductor/circuit-1/.conductor/victoria/circuit/src/App.tsx`
- Build config (missing): `/Users/williamjung/conductor/circuit-1/.conductor/victoria/circuit/electron-builder.yml`
- Package.json: `/Users/williamjung/conductor/circuit-1/.conductor/victoria/circuit/package.json`
- Vite config: `/Users/williamjung/conductor/circuit-1/.conductor/victoria/circuit/vite.config.ts`


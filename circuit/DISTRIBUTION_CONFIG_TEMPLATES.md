# Distribution Configuration Templates

This file contains ready-to-use configuration templates for macOS distribution setup.

## 1. electron-builder.yml (Main Distribution Config)

Create this file at: `circuit/electron-builder.yml`

```yaml
# Application metadata
appId: com.circuitdev.circuit
productName: Circuit
directories:
  buildResources: public
  output: dist

files:
  - dist/**/*
  - dist-electron/**/*
  - node_modules/**/*
  - package.json

# macOS configuration
mac:
  category: public.app-category.developer-tools
  icon: ./public/icon.icns
  notarize: true
  
  # Code signing (uncomment when you have a certificate)
  # certificateFile: ./certs/certificate.p12
  # certificatePassword: $CSC_KEY_PASSWORD
  # signingIdentity: Developer ID Application: Your Name (TEAM_ID)
  
  # Entitlements for app capabilities
  entitlements: ./build/entitlements.mac.plist
  entitlementsInherit: ./build/entitlements.mac.plist
  
  # Target formats
  target:
    - dmg
    - zip
  
  # DMG configuration
  dmg:
    contents:
      - x: 130
        y: 220
        type: file
        path: ${productFilename}
      - x: 410
        y: 220
        type: link
        path: /Applications
    window:
      x: 200
      y: 120
      width: 540
      height: 380

# GitHub releases configuration (optional)
# publish:
#   provider: github
#   owner: your-org
#   repo: circuit

# Development mode (for testing without signing)
# Uncomment to build unsigned during development
# publish: []
```

## 2. entitlements.mac.plist (App Capabilities)

Create this file at: `circuit/build/entitlements.mac.plist`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <!-- Allow running unsigned executables (for node-pty) -->
  <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
  <true/>
  
  <!-- File system access -->
  <key>com.apple.security.files.user-selected.read-write</key>
  <true/>
  
  <!-- Network access -->
  <key>com.apple.security.network.client</key>
  <true/>
  <key>com.apple.security.network.server</key>
  <true/>
  
  <!-- Terminal/Process management -->
  <key>com.apple.security.automation.apple-events</key>
  <true/>
  
  <!-- Development mode (remove for App Store) -->
  <key>com.apple.security.sandbox</key>
  <false/>
</dict>
</plist>
```

## 3. Updated main.cjs (Security Hardening)

Replace the webPreferences section in `circuit/electron/main.cjs`:

```javascript
// BEFORE (current - insecure for production):
webPreferences: {
  nodeIntegration: true,
  contextIsolation: false,
},

// AFTER (secure for production):
webPreferences: {
  nodeIntegration: false,
  contextIsolation: true,
  enableRemoteModule: false,
  preload: path.join(__dirname, 'preload.js'),
  sandbox: true,
},
```

## 4. preload.js (Secure IPC Bridge)

Create this file at: `circuit/electron/preload.js`

```javascript
const { contextBridge, ipcRenderer } = require('electron');

// Expose only needed IPC methods to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // Example: send messages to main process
  sendCommand: (command, data) => {
    return ipcRenderer.invoke('electron-command', { command, data });
  },
  
  // Example: listen for main process events
  onEvent: (eventName, callback) => {
    ipcRenderer.on(eventName, (event, data) => {
      callback(data);
    });
  },
  
  // Platform detection
  getPlatform: () => process.platform,
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
});
```

## 5. Update package.json Build Config

Add to `circuit/package.json` after version field:

```json
{
  "name": "circuit",
  "version": "0.1.0",  // Update from 0.0.0
  
  "main": "dist-electron/main.js",
  "homepage": "https://circuit.dev",
  
  "build": {
    "appId": "com.circuitdev.circuit",
    "productName": "Circuit",
    "files": [
      "dist/**/*",
      "dist-electron/**/*",
      "node_modules/**/*"
    ],
    "mac": {
      "category": "public.app-category.developer-tools",
      "target": ["dmg", "zip"]
    }
  }
}
```

## 6. GitHub Actions Workflow (Optional)

Create this file at: `.github/workflows/release.yml`

```yaml
name: Release

on:
  push:
    tags:
      - v*

jobs:
  release:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build
        run: npm run build
      
      - name: Package
        env:
          CSC_LINK: ${{ secrets.CSC_LINK }}
          CSC_KEY_PASSWORD: ${{ secrets.CSC_KEY_PASSWORD }}
          APPLEID: ${{ secrets.APPLEID }}
          APPLEIDPASS: ${{ secrets.APPLEIDPASS }}
        run: npm run package
      
      - name: Create Release
        uses: softprops/action-gh-release@v1
        with:
          files: dist/*.dmg
          draft: true
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## 7. TSConfig Update for Preload Script

Add to `circuit/tsconfig.electron.json`:

```json
{
  "compilerOptions": {
    "lib": ["ES2022"],
    "types": ["electron"]
  },
  "include": [
    "electron/**/*.ts",
    "electron/preload.js"
  ]
}
```

## 8. .env.production Enhancement

Update `circuit/.env.production`:

```bash
# Feature Flags
VITE_FEATURE_PLAN_MODE=false
VITE_FEATURE_GIT_GRAPH=false

# App Metadata
VITE_APP_VERSION=0.1.0
VITE_APP_NAME=Circuit
VITE_TELEMETRY_ENABLED=false
```

## Setup Instructions

### Step 1: Create directories
```bash
mkdir -p circuit/build
```

### Step 2: Create configuration files
```bash
# Copy the electron-builder.yml to project root
cp electron-builder.yml circuit/

# Copy entitlements
cp entitlements.mac.plist circuit/build/
```

### Step 3: Create preload script
```bash
# Create circuit/electron/preload.js with content from template above
```

### Step 4: Update main.cjs
- Find webPreferences section (around line 263)
- Replace with secure version from template

### Step 5: Test the build
```bash
cd circuit
npm run build
npm run package
```

### Step 6: Sign and notarize (when ready)
- Get Apple Developer ID Certificate
- Update CSC_LINK env var
- Update electron-builder.yml signing config
- Uncomment notarization section
- Re-run `npm run package`

## Certificate Setup

### Obtaining Code Signing Certificate
1. Go to Apple Developer: https://developer.apple.com/
2. Create "Developer ID Application" certificate
3. Download and install in Keychain
4. Export to .p12 file:
   ```bash
   # In Keychain Access:
   # Right-click certificate → Export
   # Format: Personal Information Exchange (.p12)
   # Password: (set secure password)
   ```

### Environment Variables for CI/CD
```bash
# In GitHub Secrets, add:
CSC_LINK=<base64 of .p12 file>
CSC_KEY_PASSWORD=<password for .p12>
APPLEID=<your apple id email>
APPLEIDPASS=<app-specific password>
```

## Icon Generation

### Convert PNG to ICNS
```bash
# Create icon from 1024x1024 PNG
./node_modules/.bin/electron-builder create-icon \
  --input public/icon.png \
  --output public/icon.icns
```

## Quick Test
```bash
# Without signing (for testing locally)
npm run build
npm run package

# App will be at: dist/Circuit.app
# DMG will be at: dist/Circuit.dmg
```

## Troubleshooting

### "No code signing identity found"
- You need Apple Developer ID Certificate in Keychain
- Export as .p12 and set CSC_LINK env var

### "App can't be opened"
- App isn't signed/notarized
- Only works on your Mac currently
- Add code signing for wider distribution

### "notarize is not defined"
- You need Apple ID credentials
- Add APPLEID and APPLEIDPASS to env
- Or disable notarization while testing


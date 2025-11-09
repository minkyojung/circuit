# Development Workflow Guide

This document outlines the complete development, testing, and deployment workflow for Octave.

## Table of Contents

- [Current Setup Overview](#current-setup-overview)
- [Development Workflow](#development-workflow)
  - [Phase 1: Local Development](#phase-1-local-development)
  - [Phase 2: Local Integration Testing](#phase-2-local-integration-testing)
  - [Phase 3: Automated Testing](#phase-3-automated-testing)
  - [Phase 4: Pre-Release Validation](#phase-4-pre-release-validation)
  - [Phase 5: Release & Distribution](#phase-5-release--distribution)
- [Environment Configuration](#environment-configuration)
- [CI/CD Recommendations](#cicd-recommendations)
- [Version Management](#version-management)
- [Troubleshooting](#troubleshooting)

---

## Current Setup Overview

Octave has a clear separation between development and production environments:

### Development Environment
- **Command**: `npm run dev`
- **Features**:
  - Vite dev server with Hot Module Replacement (HMR)
  - Localhost development at `http://localhost:5173`
  - Fast feedback loop for rapid iteration
  - No code signing (instant startup)
- **Use Case**: Active feature development and debugging

### Production Environment
- **Command**: `npm run package:prod`
- **Features**:
  - Full production build with optimizations
  - Code signing with Apple Developer Certificate
  - Notarization for macOS Gatekeeper compatibility
  - DMG creation for distribution
- **Use Case**: Final release builds for end users

### Development Build (Intermediate)
- **Command**: `npm run package:dev`
- **Features**:
  - Production-like bundle without code signing
  - Faster than production builds
  - Tests asset loading and production paths
- **Use Case**: Pre-release testing without security overhead

---

## Development Workflow

### Phase 1: Local Development

**Objective**: Rapid feature development with instant feedback.

```bash
npm run dev
```

**What happens:**
1. TypeScript compilation for Electron main process
2. Vite development server starts on port 5173
3. Electron launches and connects to dev server
4. Hot Module Replacement (HMR) enabled

**Best Practices:**
- Keep DevTools open for debugging (`electron/main.cjs:316`)
- Monitor both Vite and Electron logs in terminal
- Use React DevTools for component inspection
- Leverage HMR for instant UI updates

**When to use:**
- Writing new features
- Fixing bugs
- Experimenting with UI/UX
- Refactoring code

---

### Phase 2: Local Integration Testing

**Objective**: Verify the production bundle works correctly before investing in code signing.

```bash
# Build all assets
npm run build

# Create unsigned DMG for testing
npm run package:dev
```

**What happens:**
1. TypeScript compiles to JavaScript
2. Vite bundles React app for production
3. Electron main process builds
4. electron-builder creates DMG (unsigned)

**Test Checklist:**
- [ ] Application launches successfully
- [ ] All assets load correctly (images, icons, fonts)
- [ ] Monaco Editor renders and functions
- [ ] Terminal integration works
- [ ] MCP servers connect properly
- [ ] Database operations succeed
- [ ] All core features function as expected
- [ ] No console errors related to asset paths

**Why this phase matters:**
- Catches production-only issues early
- Asset loading problems only appear in production builds
- Path resolution differs between dev and production
- Faster iteration than full production builds

**Test the DMG:**
```bash
# The DMG will be in the release/ directory
open release/Octave-*.dmg

# Install to /Applications and test
# Verify it works on a clean user account
```

---

### Phase 3: Automated Testing

**Objective**: Ensure code quality and prevent regressions.

```bash
# Run all tests
npm run test

# Interactive test UI
npm run test:ui

# Coverage report
npm run test:coverage
```

**Testing Strategy:**

#### 1. Unit Tests
- Business logic functions
- Utility helpers
- Data transformations
- Isolated component logic

#### 2. Component Tests
- React component rendering
- User interactions
- State management
- Props validation

#### 3. Integration Tests
- IPC communication between renderer and main process
- Database operations (better-sqlite3)
- File system operations
- Terminal integration
- MCP server connectivity

**When to run tests:**
- Before every commit
- After completing a feature
- Before creating a pull request
- In CI/CD pipeline (recommended)

**Writing good tests:**
```typescript
// Example: Testing IPC communication
describe('Workspace IPC', () => {
  it('should create workspace with valid path', async () => {
    const result = await ipcRenderer.invoke('workspace:create', {
      path: '/valid/path',
      name: 'test-workspace'
    });

    expect(result.success).toBe(true);
    expect(result.workspace).toBeDefined();
  });
});
```

---

### Phase 4: Pre-Release Validation

**Objective**: Create a production-ready build with code signing and notarization.

#### Prerequisites

Set up Apple Developer credentials:

```bash
# Required environment variables
export APPLE_ID="your-apple-id@example.com"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="6DQK5MQC4H"
```

> **Note**: See [CODE_SIGNING_SETUP.md](./CODE_SIGNING_SETUP.md) for detailed setup instructions.

#### Build Production DMG

```bash
npm run package:prod
```

**What happens:**
1. Full production build (TypeScript + Vite)
2. Code signing with hardened runtime
3. DMG creation
4. Automatic notarization with Apple
5. Stapling notarization ticket to DMG

**This process takes 10-15 minutes** due to Apple's notarization service.

#### Verification Checklist

```bash
# 1. Verify code signature
codesign --verify --deep --strict release/Octave-*.dmg

# 2. Check notarization status
spctl -a -vv -t install release/Octave-*.dmg

# 3. Test installation on a different Mac
# - Transfer DMG to another Mac
# - Install to /Applications
# - Verify Gatekeeper allows execution
# - Test all features work correctly
```

**Final Pre-Release Tests:**
- [ ] DMG installs without security warnings
- [ ] Application opens on first launch
- [ ] All features function correctly
- [ ] No crashes or errors in Console.app
- [ ] Performance is acceptable
- [ ] Asset loading is correct
- [ ] Database migrations work
- [ ] MCP servers connect

---

### Phase 5: Release & Distribution

**Objective**: Distribute the application to end users.

#### Option A: GitHub Releases (Recommended)

```bash
# 1. Update version in package.json
npm version patch  # or minor/major

# 2. Create Git tag
git tag -a v0.0.2 -m "Release version 0.0.2"
git push origin v0.0.2

# 3. Create GitHub Release
gh release create v0.0.2 \
  ./release/Octave-*.dmg \
  --title "Octave v0.0.2" \
  --notes-file CHANGELOG.md \
  --draft  # Remove --draft when ready to publish
```

**Configure Auto-Updates:**

Update `electron-builder.production.yml`:
```yaml
publish:
  provider: github
  owner: your-github-username    # Replace with actual username
  repo: octave                   # Replace with actual repo name
  releaseType: release
```

This enables automatic update checking in future versions.

#### Option B: Direct Distribution

1. Build production DMG: `npm run package:prod`
2. Upload to your web server or CDN
3. Share download link with users
4. Provide SHA-256 checksum for verification:
   ```bash
   shasum -a 256 release/Octave-*.dmg
   ```

---

## Environment Configuration

### Development vs Production

Octave uses environment-specific configuration files:

```
.env.development    # Used in npm run dev
.env.production     # Used in npm run build
```

#### Example Configuration

**.env.development**
```bash
VITE_API_ENDPOINT=http://localhost:3000
VITE_LOG_LEVEL=debug
VITE_ENABLE_DEVTOOLS=true
```

**.env.production**
```bash
VITE_API_ENDPOINT=https://api.octave.app
VITE_LOG_LEVEL=error
VITE_ENABLE_DEVTOOLS=false
```

#### Accessing Environment Variables

```typescript
// In renderer process (React components)
const apiEndpoint = import.meta.env.VITE_API_ENDPOINT;

// In main process (Electron)
const isDev = process.env.VITE_DEV_SERVER_URL !== undefined;
```

---

## CI/CD Recommendations

### GitHub Actions Workflow

Create `.github/workflows/build.yml`:

```yaml
name: Build and Test

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run linter
        run: npm run lint

      - name: Run tests
        run: npm run test

      - name: Build application
        run: npm run build

  build-dev:
    runs-on: macos-latest
    if: github.event_name == 'pull_request'
    needs: test
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build development package
        run: npm run package:dev

      - name: Upload artifact
        uses: actions/upload-artifact@v4
        with:
          name: octave-dev-build
          path: release/*.dmg
          retention-days: 7

  release:
    runs-on: macos-latest
    if: startsWith(github.ref, 'refs/tags/v')
    needs: test
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build production package
        run: npm run package:prod
        env:
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_APP_SPECIFIC_PASSWORD: ${{ secrets.APPLE_APP_SPECIFIC_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v1
        with:
          files: release/*.dmg
          body_path: CHANGELOG.md
          draft: true
```

### Required GitHub Secrets

Add these secrets to your GitHub repository settings:

- `APPLE_ID`: Your Apple ID email
- `APPLE_APP_SPECIFIC_PASSWORD`: App-specific password from Apple
- `APPLE_TEAM_ID`: Your Apple Developer Team ID (6DQK5MQC4H)

---

## Version Management

### Semantic Versioning

Octave follows [Semantic Versioning 2.0.0](https://semver.org/):

- **MAJOR**: Breaking changes (e.g., 1.0.0 → 2.0.0)
- **MINOR**: New features, backward compatible (e.g., 0.1.0 → 0.2.0)
- **PATCH**: Bug fixes, backward compatible (e.g., 0.0.1 → 0.0.2)

### Version Bump Commands

Add to `package.json`:

```json
{
  "scripts": {
    "version:patch": "npm version patch -m \"chore: bump version to %s\"",
    "version:minor": "npm version minor -m \"feat: bump version to %s\"",
    "version:major": "npm version major -m \"feat!: bump version to %s\"",
    "release": "npm run build && npm run package:prod"
  }
}
```

### Release Process

```bash
# 1. Update CHANGELOG.md with changes

# 2. Bump version (creates git tag)
npm run version:patch  # or minor/major

# 3. Push changes and tags
git push && git push --tags

# 4. Build and release (or wait for CI/CD)
npm run release

# 5. Create GitHub Release
gh release create v0.0.2 \
  ./release/Octave-*.dmg \
  --title "Octave v0.0.2" \
  --notes-file CHANGELOG.md
```

---

## Troubleshooting

### Common Issues

#### 1. Assets Not Loading in Production Build

**Symptoms**: Images, icons, or other assets missing after packaging.

**Solution**: Verify `vite.config.ts` has `base: './'`:
```typescript
export default defineConfig({
  base: './',  // Critical for Electron file:// protocol
  // ... other config
});
```

#### 2. Code Signing Fails

**Symptoms**: `electron-builder` fails during code signing step.

**Solution**: Check certificate:
```bash
# List available certificates
security find-identity -v -p codesigning

# Verify the identity in electron-builder.production.yml matches
```

#### 3. Notarization Times Out

**Symptoms**: Build hangs during notarization for 30+ minutes.

**Solution**:
- Check Apple ID credentials are correct
- Verify app-specific password is valid
- Check Apple System Status: https://developer.apple.com/system-status/

#### 4. Tests Fail in CI but Pass Locally

**Symptoms**: GitHub Actions tests fail, but `npm test` works locally.

**Solution**:
- Ensure Node version matches (check `.github/workflows/*.yml`)
- Clear npm cache: `npm ci` instead of `npm install`
- Check for timing-dependent tests

#### 5. Electron Window Not Showing

**Symptoms**: Electron starts but no window appears.

**Solution**: Check main process logs:
```typescript
// In electron/main.cjs
console.log('Window created:', mainWindow);
console.log('Loading URL:', process.env.VITE_DEV_SERVER_URL);
```

---

## Quick Reference

### Daily Development Cycle

```bash
npm run dev              # Start development
# ... make changes ...
npm run test            # Run tests
git add . && git commit  # Commit changes
```

### Pre-Commit Checks

```bash
npm run lint            # Check code style
npm run test            # Run tests
npm run build           # Verify production build
```

### Pre-Release Workflow

```bash
npm run test:coverage   # Verify test coverage
npm run package:dev     # Test unsigned build
npm run package:prod    # Create release build
```

### Release Workflow

```bash
npm run version:patch   # Bump version
git push --follow-tags  # Push with tags
npm run release         # Build production
gh release create ...   # Publish release
```

---

## Additional Resources

- [BUILD_DISTRIBUTION_QUICK_REFERENCE.md](./BUILD_DISTRIBUTION_QUICK_REFERENCE.md) - Quick build commands
- [CODE_SIGNING_SETUP.md](./CODE_SIGNING_SETUP.md) - Apple code signing setup
- [DISTRIBUTION_DOCUMENTATION_INDEX.md](./DISTRIBUTION_DOCUMENTATION_INDEX.md) - All distribution docs
- [ROADMAP.md](./ROADMAP.md) - Future development plans
- [CHANGELOG.md](./CHANGELOG.md) - Version history

---

**Last Updated**: 2025-11-08
**Maintained by**: Octave Development Team
